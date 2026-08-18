-- ETAPA U4 da unificação — Motor de cobrança.
-- Referência: docs/PLANO_UNIFICACAO.md §3.2, §4.3 e §10.
--
-- >>> RODAR NO SQL EDITOR DA LOVABLE (Cloud → SQL editor). Idempotente. <<<
-- >>> Rodar DEPOIS da U0, U2 e U3.                                      <<<
-- >>> Conferir o SELECT final: cada linha traz o valor esperado ao lado. <<<
--
-- Traz o coração do gestor-os para cá. As 7 invariantes do §3.2 estão
-- preservadas, e as que dá para o banco garantir, o banco garante:
--   1. I.A nunca cria cobrança — só aprovar_os_financeiro(), que é humana
--   2. item sem preço vira REVISAR, nunca R$ 0        → constraint (U3)
--   3. ajuste manual trava o item contra reanálise    → coluna + RPC
--   4. id de equipamento validado contra o contrato   → FK de cobertura (U3)
--   5. reaprovação apaga só cobranças ABERTAS         → RPC em transação
--   6. parcelamento em centavos, resto na 1ª parcela  → src/lib/periodos.ts
--   7. referência semanal com ano ISO                 → src/lib/periodos.ts
--
-- Cria:
--   cobrancas                  — o que será cobrado, item a item
--   aprovar_os_financeiro()    — a aprovação humana, em transação
--   marcar_os_faturada()       — depois que o financeiro emitiu
--   visitas_na_competencia()   — para a regra de franquia

-- ═══════════════════════════════════════════════════════════════════════
-- 1) COBRANÇAS
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.cobrancas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  os_id uuid REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  -- SET NULL: apagar a peça não pode apagar a cobrança já aprovada
  peca_id uuid REFERENCES public.os_pecas(id) ON DELETE SET NULL,
  contrato_id uuid REFERENCES public.cliente_contratos(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  quantidade numeric NOT NULL DEFAULT 1,
  valor_unitario numeric(12,2) NOT NULL,
  valor numeric(12,2) NOT NULL,
  -- 'AAAA-MM' — a competência em que entra no boleto
  competencia text NOT NULL,
  data_referencia date NOT NULL,
  -- instalacao × manutencao: as duas seções do PDF de fechamento
  tipo_servico text NOT NULL DEFAULT 'manutencao',
  status text NOT NULL DEFAULT 'aberta',
  -- FK criada na U5, quando fechamentos existir
  fechamento_id uuid,
  observacao text,
  criada_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE public.cobrancas ADD CONSTRAINT cobrancas_status_check
    CHECK (status IN ('aberta','fechada','faturada','cancelada'));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN
  RAISE NOTICE 'status fora da lista — constraint nao criada';
END $$;

DO $$
BEGIN
  ALTER TABLE public.cobrancas ADD CONSTRAINT cobrancas_tipo_servico_check
    CHECK (tipo_servico IN ('instalacao','manutencao'));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN
  RAISE NOTICE 'tipo_servico fora da lista — constraint nao criada';
END $$;

DO $$
BEGIN
  ALTER TABLE public.cobrancas ADD CONSTRAINT cobrancas_competencia_check
    CHECK (competencia ~ '^\d{4}-\d{2}$');
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN
  RAISE NOTICE 'ha competencia fora do formato AAAA-MM — constraint nao criada';
END $$;

-- cobrança de valor zero é sintoma de item sem preço que passou batido
DO $$
BEGIN
  ALTER TABLE public.cobrancas ADD CONSTRAINT cobrancas_valor_check
    CHECK (valor > 0);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN
  RAISE NOTICE 'ha cobranca com valor <= 0 — constraint nao criada';
END $$;

CREATE INDEX IF NOT EXISTS cobrancas_cliente_idx     ON public.cobrancas (cliente_id, competencia);
CREATE INDEX IF NOT EXISTS cobrancas_os_idx          ON public.cobrancas (os_id);
CREATE INDEX IF NOT EXISTS cobrancas_status_idx      ON public.cobrancas (status, data_referencia);
CREATE INDEX IF NOT EXISTS cobrancas_fechamento_idx  ON public.cobrancas (fechamento_id);

DROP TRIGGER IF EXISTS cobrancas_set_updated_at ON public.cobrancas;
CREATE TRIGGER cobrancas_set_updated_at
  BEFORE UPDATE ON public.cobrancas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════
-- 2) FRANQUIA DE VISITAS
-- ═══════════════════════════════════════════════════════════════════════
-- Quantos atendimentos do cliente já foram encerrados na competência. É o que
-- decide quando a visita N+1 deixa de estar coberta.
-- Conta OS FECHADA (conferida), não executada: enquanto a conferência não
-- aconteceu, o atendimento ainda pode ser cancelado ou reaberto.
CREATE OR REPLACE FUNCTION public.visitas_na_competencia(_cliente_id uuid, _competencia text)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT count(*)::int
  FROM public.ordens_servico o
  WHERE o.cliente_id = _cliente_id
    AND o.status = 'fechada'
    AND to_char(COALESCE(o.finalizada_em, o.fechada_em, o.created_at)
                AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') = _competencia;
$$;
REVOKE EXECUTE ON FUNCTION public.visitas_na_competencia(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.visitas_na_competencia(uuid, text) TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════
-- 3) APROVAÇÃO — o único caminho que cria cobrança
-- ═══════════════════════════════════════════════════════════════════════
-- No gestor-os isto era um $transaction do Prisma. No Supabase não existe
-- transação do lado do cliente: sem a função, duas aprovações simultâneas
-- criariam cobrança em dobro. Aqui roda tudo em uma chamada, atômica.
--
-- SECURITY DEFINER com verificação explícita de papel: a função ignora a RLS
-- de propósito (precisa escrever em cobrancas e ler análise), então ela mesma
-- precisa perguntar quem está chamando.
CREATE OR REPLACE FUNCTION public.aprovar_os_financeiro(_os_id uuid)
RETURNS TABLE (itens integer, total numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_os record;
  v_revisar int;
  v_competencia text;
  v_data date;
  v_itens int := 0;
  v_total numeric := 0;
BEGIN
  IF NOT public.pode_ver_financeiro(auth.uid()) THEN
    RAISE EXCEPTION 'Somente quem responde pelo financeiro pode aprovar cobrança.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_os FROM public.ordens_servico WHERE id = _os_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chamado não encontrado.';
  END IF;
  IF v_os.status NOT IN ('executada','fechada') THEN
    RAISE EXCEPTION 'O chamado precisa estar executado para ter a cobrança aprovada.';
  END IF;

  -- item em dúvida bloqueia a aprovação inteira: cobrança indevida custa mais
  -- caro do que uma conferência (regra do PROMPT_ANALISE do gestor-os)
  SELECT count(*) INTO v_revisar
  FROM public.os_pecas_analise a
  WHERE a.os_id = _os_id AND a.resultado IN ('revisar','nao_identificado');
  IF v_revisar > 0 THEN
    RAISE EXCEPTION 'Ainda há % item(ns) em revisão. Resolva antes de aprovar.', v_revisar;
  END IF;

  v_data := COALESCE(v_os.finalizada_em, v_os.created_at)::date;
  v_competencia := to_char(v_data, 'YYYY-MM');

  -- invariante 5: reaprovar SUBSTITUI o que ainda está aberto e não encosta
  -- no que já foi fechado ou faturado
  DELETE FROM public.cobrancas
  WHERE os_id = _os_id AND status = 'aberta';

  INSERT INTO public.cobrancas
    (cliente_id, os_id, peca_id, contrato_id, descricao, quantidade,
     valor_unitario, valor, competencia, data_referencia, tipo_servico, criada_por)
  SELECT
    v_os.cliente_id, _os_id, p.id, v_os.contrato_id,
    p.descricao, p.quantidade,
    a.valor_calculado,
    round(a.valor_calculado * p.quantidade, 2),
    v_competencia, v_data,
    COALESCE(v_os.tipo_servico, 'manutencao'),
    auth.uid()
  FROM public.os_pecas p
  JOIN public.os_pecas_analise a ON a.peca_id = p.id
  WHERE p.os_id = _os_id
    AND a.resultado = 'faturavel'
    AND a.valor_calculado IS NOT NULL
    AND a.valor_calculado > 0;
  GET DIAGNOSTICS v_itens = ROW_COUNT;

  SELECT COALESCE(sum(valor), 0) INTO v_total
  FROM public.cobrancas WHERE os_id = _os_id AND status = 'aberta';

  UPDATE public.ordens_servico
  SET faturamento_status = CASE WHEN v_itens = 0 THEN 'sem_cobranca' ELSE 'aprovada' END
  WHERE id = _os_id;

  INSERT INTO public.os_eventos (os_id, tipo, descricao, user_id)
  VALUES (_os_id, 'cobranca_aprovada',
          CASE WHEN v_itens = 0
               THEN 'Conferência concluída: nada a cobrar.'
               ELSE 'Cobrança aprovada: ' || v_itens || ' item(ns), total ' ||
                    to_char(v_total, 'FM999G999G990D00') END,
          auth.uid());

  RETURN QUERY SELECT v_itens, v_total;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.aprovar_os_financeiro(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aprovar_os_financeiro(uuid) TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════
-- 4) MARCAR COMO FATURADA
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.marcar_os_faturada(_os_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_n int := 0;
BEGIN
  IF NOT public.pode_ver_financeiro(auth.uid()) THEN
    RAISE EXCEPTION 'Somente quem responde pelo financeiro pode marcar como faturada.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.cobrancas
  SET status = 'faturada'
  WHERE os_id = _os_id AND status IN ('aberta','fechada');
  GET DIAGNOSTICS v_n = ROW_COUNT;

  UPDATE public.ordens_servico SET faturamento_status = 'faturada' WHERE id = _os_id;

  INSERT INTO public.os_eventos (os_id, tipo, descricao, user_id)
  VALUES (_os_id, 'cobranca_faturada', v_n || ' cobrança(s) marcadas como faturadas.', auth.uid());
  RETURN v_n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.marcar_os_faturada(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marcar_os_faturada(uuid) TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════
-- 5) AJUSTE MANUAL — trava o item contra reanálise (invariante 3)
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.ajustar_item_cobranca(
  _peca_id uuid,
  _resultado text,
  _valor numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_os uuid;
BEGIN
  IF NOT public.pode_ver_financeiro(auth.uid()) THEN
    RAISE EXCEPTION 'Somente quem responde pelo financeiro pode ajustar itens.'
      USING ERRCODE = '42501';
  END IF;
  IF _resultado NOT IN ('coberto','faturavel','nao_identificado','revisar') THEN
    RAISE EXCEPTION 'Resultado inválido: %', _resultado;
  END IF;
  IF _resultado = 'faturavel' AND (_valor IS NULL OR _valor <= 0) THEN
    RAISE EXCEPTION 'Item faturável precisa de valor. Sem preço, deixe em revisão.';
  END IF;

  SELECT os_id INTO v_os FROM public.os_pecas WHERE id = _peca_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado.'; END IF;

  INSERT INTO public.os_pecas_analise
    (peca_id, os_id, resultado, valor_calculado, confianca, justificativa,
     ajustado_manualmente, ajustado_por)
  VALUES
    (_peca_id, v_os, _resultado,
     CASE WHEN _resultado = 'coberto' THEN NULL ELSE _valor END,
     1, 'Ajustado manualmente na conferência.', true, auth.uid())
  ON CONFLICT (peca_id) DO UPDATE
    SET resultado = EXCLUDED.resultado,
        valor_calculado = EXCLUDED.valor_calculado,
        confianca = 1,
        justificativa = 'Ajustado manualmente na conferência.',
        ajustado_manualmente = true,
        ajustado_por = auth.uid(),
        updated_at = now();
END;
$$;
REVOKE EXECUTE ON FUNCTION public.ajustar_item_cobranca(uuid, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ajustar_item_cobranca(uuid, text, numeric) TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════
-- 6) RLS
-- ═══════════════════════════════════════════════════════════════════════
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cobrancas TO authenticated;
GRANT ALL ON public.cobrancas TO service_role;
ALTER TABLE public.cobrancas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cobrancas_select" ON public.cobrancas;
DROP POLICY IF EXISTS "cobrancas_write"  ON public.cobrancas;
CREATE POLICY "cobrancas_select" ON public.cobrancas
  FOR SELECT TO authenticated USING (public.pode_ver_financeiro(auth.uid()));
-- Escrita direta existe para lançamento avulso (mensalidade, acerto); a
-- cobrança que vem de OS nasce só pela aprovação.
CREATE POLICY "cobrancas_write" ON public.cobrancas
  FOR ALL TO authenticated
  USING (public.pode_ver_financeiro(auth.uid()))
  WITH CHECK (public.pode_ver_financeiro(auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO FINAL
-- ═══════════════════════════════════════════════════════════════════════
SELECT 'tabela cobrancas criada' AS verificacao,
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables
         WHERE table_schema='public' AND table_name='cobrancas')
       THEN 'sim' ELSE 'NAO' END AS resultado, 'sim' AS esperado
UNION ALL
SELECT 'constraints de dominio (status, tipo, competencia, valor)', count(*)::text, '4'
FROM pg_constraint
WHERE conname IN ('cobrancas_status_check','cobrancas_tipo_servico_check',
                  'cobrancas_competencia_check','cobrancas_valor_check')
UNION ALL
SELECT 'RPCs instaladas (aprovar, faturar, ajustar, franquia)', count(*)::text, '4'
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname='public' AND p.proname IN
  ('aprovar_os_financeiro','marcar_os_faturada','ajustar_item_cobranca','visitas_na_competencia')
UNION ALL
SELECT 'aprovacao exige papel financeiro',
       CASE WHEN (SELECT prosrc FROM pg_proc WHERE proname='aprovar_os_financeiro')
                 LIKE '%pode_ver_financeiro%' THEN 'sim' ELSE 'NAO' END, 'sim'
UNION ALL
SELECT 'reaprovacao apaga so cobranca ABERTA',
       CASE WHEN (SELECT prosrc FROM pg_proc WHERE proname='aprovar_os_financeiro')
                 LIKE '%status = ''aberta''%' THEN 'sim' ELSE 'NAO' END, 'sim'
UNION ALL
SELECT 'item em revisao bloqueia aprovacao',
       CASE WHEN (SELECT prosrc FROM pg_proc WHERE proname='aprovar_os_financeiro')
                 LIKE '%em revisão%' THEN 'sim' ELSE 'NAO' END, 'sim'
UNION ALL
SELECT 'policies de cobrancas (so financeiro)', count(*)::text, '2'
FROM pg_policies WHERE schemaname='public' AND tablename='cobrancas'
UNION ALL
SELECT 'cobrancas lancadas', count(*)::text, '(informativo — 0 numa base nova)'
FROM public.cobrancas;
