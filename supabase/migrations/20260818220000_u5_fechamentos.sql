-- ETAPA U5 da unificação — Fechamentos.
-- Referência: docs/PLANO_UNIFICACAO.md §3.2, §5.2 e §10.
--
-- >>> RODAR NO SQL EDITOR DA LOVABLE (Cloud → SQL editor). Idempotente. <<<
-- >>> Rodar DEPOIS da U4.                                              <<<
-- >>> Conferir o SELECT final: cada linha traz o valor esperado ao lado. <<<
--
-- Fecha o ciclo do Vinicius: programar → executar → conferir → FECHAR → mandar
-- para o financeiro. É a última peça antes de o gestor-os poder ser desligado.
--
-- Monta o período, é idempotente (rodar de novo só recolhe o que entrou
-- depois) e nunca apaga cobrança: excluir um fechamento devolve as cobranças
-- para "aberta", intactas.
--
-- Cria:
--   fechamentos              — o período consolidado
--   montar_fechamento()      — junta as cobranças abertas da janela
--   fechar_periodo()         — trava o período
--   reabrir_periodo()        — destrava
--   excluir_fechamento()     — descarta o período, devolvendo as cobranças
--   alertas_cobrancas_orfas()— automação 7 do §6

-- ═══════════════════════════════════════════════════════════════════════
-- 1) FECHAMENTO
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.fechamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  -- semanal: 'AAAA-Sxx' com ANO ISO; mensal: 'AAAA-MM'
  referencia text NOT NULL,
  inicio date NOT NULL,
  fim date NOT NULL,
  total numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'aberto',
  observacoes text,
  fechado_em timestamptz,
  fechado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE public.fechamentos ADD CONSTRAINT fechamentos_tipo_check
    CHECK (tipo IN ('semanal','mensal'));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN
  RAISE NOTICE 'tipo fora da lista — constraint nao criada';
END $$;

DO $$
BEGIN
  ALTER TABLE public.fechamentos ADD CONSTRAINT fechamentos_status_check
    CHECK (status IN ('aberto','fechado'));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN
  RAISE NOTICE 'status fora da lista — constraint nao criada';
END $$;

-- um período, um fechamento (era @@unique([tipo, referencia]) no gestor-os)
CREATE UNIQUE INDEX IF NOT EXISTS fechamentos_unico ON public.fechamentos (tipo, referencia);
CREATE INDEX IF NOT EXISTS fechamentos_periodo_idx ON public.fechamentos (inicio, fim);

DROP TRIGGER IF EXISTS fechamentos_set_updated_at ON public.fechamentos;
CREATE TRIGGER fechamentos_set_updated_at
  BEFORE UPDATE ON public.fechamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- a coluna nasceu na U4 sem FK, porque fechamentos ainda não existia
DO $$
BEGIN
  ALTER TABLE public.cobrancas
    ADD CONSTRAINT cobrancas_fechamento_fkey
    FOREIGN KEY (fechamento_id) REFERENCES public.fechamentos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN OTHERS THEN
  RAISE NOTICE 'FK de fechamento nao criada: %', SQLERRM;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 2) MONTAR — junta as cobranças abertas da janela
-- ═══════════════════════════════════════════════════════════════════════
-- Idempotente de propósito: rodar de novo no mesmo período só recolhe o que
-- entrou depois. É o montarFechamento do gestor-os.
--
-- 'IYYY-"S"IW' é o ANO ISO, não o civil: 31/12/2025 sai como 2026-S01, que é a
-- semana a que aquele dia realmente pertence. Com o ano civil existiriam duas
-- referências "2025-S01" — uma em janeiro, outra em dezembro — colidindo no
-- índice único. Mesma regra do src/lib/periodos.ts.
CREATE OR REPLACE FUNCTION public.montar_fechamento(_tipo text, _data_base date DEFAULT NULL)
RETURNS TABLE (fechamento_id uuid, referencia text, itens integer, total numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_base date := COALESCE(_data_base, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  v_ref text;
  v_inicio date;
  v_fim date;
  v_id uuid;
  v_status text;
  v_itens int := 0;
  v_total numeric := 0;
BEGIN
  IF NOT public.pode_ver_financeiro(auth.uid()) THEN
    RAISE EXCEPTION 'Somente quem responde pelo financeiro pode montar fechamento.'
      USING ERRCODE = '42501';
  END IF;
  IF _tipo NOT IN ('semanal','mensal') THEN
    RAISE EXCEPTION 'Tipo de fechamento inválido: %', _tipo;
  END IF;

  IF _tipo = 'semanal' THEN
    v_ref := to_char(v_base, 'IYYY-"S"IW');
    v_inicio := date_trunc('week', v_base)::date;          -- segunda
    v_fim := v_inicio + 6;                                  -- domingo
  ELSE
    v_ref := to_char(v_base, 'YYYY-MM');
    v_inicio := date_trunc('month', v_base)::date;
    v_fim := (date_trunc('month', v_base) + interval '1 month - 1 day')::date;
  END IF;

  INSERT INTO public.fechamentos (tipo, referencia, inicio, fim, created_by)
  VALUES (_tipo, v_ref, v_inicio, v_fim, auth.uid())
  ON CONFLICT (tipo, referencia) DO UPDATE SET updated_at = now()
  RETURNING id, status INTO v_id, v_status;

  IF v_status = 'fechado' THEN
    RAISE EXCEPTION 'O período % já está fechado. Reabra antes de recolher novas cobranças.', v_ref;
  END IF;

  -- só cobrança ABERTA e ainda sem período: o que já foi fechado ou faturado
  -- em outro fechamento fica onde está
  UPDATE public.cobrancas
  SET fechamento_id = v_id
  WHERE status = 'aberta'
    AND fechamento_id IS NULL
    AND data_referencia BETWEEN v_inicio AND v_fim;
  GET DIAGNOSTICS v_itens = ROW_COUNT;

  SELECT COALESCE(sum(valor), 0) INTO v_total
  FROM public.cobrancas WHERE fechamento_id = v_id AND status <> 'cancelada';

  UPDATE public.fechamentos SET total = v_total WHERE id = v_id;

  RETURN QUERY SELECT v_id, v_ref, v_itens, v_total;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.montar_fechamento(text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.montar_fechamento(text, date) TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════
-- 3) FECHAR / REABRIR / EXCLUIR
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fechar_periodo(_fechamento_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_n int := 0;
BEGIN
  IF NOT public.pode_ver_financeiro(auth.uid()) THEN
    RAISE EXCEPTION 'Somente quem responde pelo financeiro pode fechar o período.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.cobrancas SET status = 'fechada'
  WHERE fechamento_id = _fechamento_id AND status = 'aberta';
  GET DIAGNOSTICS v_n = ROW_COUNT;

  UPDATE public.fechamentos
  SET status = 'fechado', fechado_em = now(), fechado_por = auth.uid(),
      total = COALESCE((SELECT sum(valor) FROM public.cobrancas
                        WHERE fechamento_id = _fechamento_id AND status <> 'cancelada'), 0)
  WHERE id = _fechamento_id;

  RETURN v_n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.fechar_periodo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fechar_periodo(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.reabrir_periodo(_fechamento_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_n int := 0;
BEGIN
  IF NOT public.pode_ver_financeiro(auth.uid()) THEN
    RAISE EXCEPTION 'Somente quem responde pelo financeiro pode reabrir o período.'
      USING ERRCODE = '42501';
  END IF;

  -- o que já foi faturado NÃO volta: a nota saiu, o período dele acabou
  UPDATE public.cobrancas SET status = 'aberta'
  WHERE fechamento_id = _fechamento_id AND status = 'fechada';
  GET DIAGNOSTICS v_n = ROW_COUNT;

  UPDATE public.fechamentos
  SET status = 'aberto', fechado_em = NULL, fechado_por = NULL
  WHERE id = _fechamento_id;

  RETURN v_n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reabrir_periodo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reabrir_periodo(uuid) TO authenticated, service_role;

-- Descarta o período SEM apagar cobrança: elas voltam para a fila de abertas e
-- podem entrar em outro fechamento. Apagar dinheiro por engano não tem desfazer.
CREATE OR REPLACE FUNCTION public.excluir_fechamento(_fechamento_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_faturadas int;
  v_n int := 0;
BEGIN
  IF NOT public.pode_ver_financeiro(auth.uid()) THEN
    RAISE EXCEPTION 'Somente quem responde pelo financeiro pode excluir fechamento.'
      USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_faturadas
  FROM public.cobrancas WHERE fechamento_id = _fechamento_id AND status = 'faturada';
  IF v_faturadas > 0 THEN
    RAISE EXCEPTION 'Este período tem % cobrança(s) já faturadas e não pode ser excluído.', v_faturadas;
  END IF;

  UPDATE public.cobrancas
  SET status = CASE WHEN status = 'fechada' THEN 'aberta' ELSE status END,
      fechamento_id = NULL
  WHERE fechamento_id = _fechamento_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  DELETE FROM public.fechamentos WHERE id = _fechamento_id;
  RETURN v_n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.excluir_fechamento(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.excluir_fechamento(uuid) TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════
-- 4) COBRANÇA ÓRFÃ (§6, automação 7)
-- ═══════════════════════════════════════════════════════════════════════
-- Cobrança aprovada que ficou de fora de qualquer fechamento depois que o
-- período virou. É dinheiro parado que ninguém está vendo.
CREATE OR REPLACE FUNCTION public.alertas_cobrancas_orfas(_dias int DEFAULT 10)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_qtd int;
  v_total numeric;
  v_envios int := 0;
BEGIN
  SELECT count(*), COALESCE(sum(valor), 0) INTO v_qtd, v_total
  FROM public.cobrancas
  WHERE status = 'aberta'
    AND fechamento_id IS NULL
    AND data_referencia < (now() AT TIME ZONE 'America/Sao_Paulo')::date - _dias;

  IF v_qtd = 0 THEN RETURN 'nenhuma cobranca orfa'; END IF;

  INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo)
  SELECT p.id, 'cobranca_orfa', 'Cobranças fora de fechamento',
         v_qtd::text || ' cobrança(s) aprovadas há mais de ' || _dias::text
         || ' dias ainda não entraram em nenhum fechamento — total '
         || to_char(v_total, 'FM999G999G990D00') || '.'
  FROM public.profiles p
  WHERE p.cargo IN ('admin','comercial')
    AND p.ativo IS DISTINCT FROM false
    AND p.status IS DISTINCT FROM 'rejeitado'
    AND p.status IS DISTINCT FROM 'pendente_aprovacao'
    AND NOT EXISTS (
      SELECT 1 FROM public.notificacoes n
      WHERE n.user_id = p.id AND n.tipo = 'cobranca_orfa'
        AND n.created_at > now() - interval '6 days');
  GET DIAGNOSTICS v_envios = ROW_COUNT;
  RETURN v_qtd || ' cobranca(s) orfa(s); avisos enviados: ' || v_envios;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.alertas_cobrancas_orfas(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.alertas_cobrancas_orfas(int) TO service_role;

DO $$
DECLARE r text;
BEGIN
  -- 08:00 de segunda em Brasília = 11:00 UTC
  r := public.agendar_job('alertas-cobrancas-orfas', '0 11 * * 1',
                          'SELECT public.alertas_cobrancas_orfas();');
  RAISE NOTICE '%', r;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'agendamento nao aplicado: %', SQLERRM;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 5) RLS
-- ═══════════════════════════════════════════════════════════════════════
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fechamentos TO authenticated;
GRANT ALL ON public.fechamentos TO service_role;
ALTER TABLE public.fechamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fechamentos_select" ON public.fechamentos;
DROP POLICY IF EXISTS "fechamentos_write"  ON public.fechamentos;
CREATE POLICY "fechamentos_select" ON public.fechamentos
  FOR SELECT TO authenticated USING (public.pode_ver_financeiro(auth.uid()));
CREATE POLICY "fechamentos_write" ON public.fechamentos
  FOR ALL TO authenticated
  USING (public.pode_ver_financeiro(auth.uid()))
  WITH CHECK (public.pode_ver_financeiro(auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO FINAL
-- ═══════════════════════════════════════════════════════════════════════
SELECT 'tabela fechamentos criada' AS verificacao,
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables
         WHERE table_schema='public' AND table_name='fechamentos')
       THEN 'sim' ELSE 'NAO' END AS resultado, 'sim' AS esperado
UNION ALL
SELECT 'um periodo, um fechamento (indice unico)',
       CASE WHEN EXISTS (SELECT 1 FROM pg_indexes
         WHERE schemaname='public' AND indexname='fechamentos_unico')
       THEN 'sim' ELSE 'NAO' END, 'sim'
UNION ALL
SELECT 'FK de cobrancas.fechamento_id criada',
       CASE WHEN EXISTS (SELECT 1 FROM pg_constraint
         WHERE conname='cobrancas_fechamento_fkey')
       THEN 'sim' ELSE 'NAO' END, 'sim'
UNION ALL
SELECT 'RPCs instaladas (montar, fechar, reabrir, excluir, orfas)', count(*)::text, '5'
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname='public' AND p.proname IN
  ('montar_fechamento','fechar_periodo','reabrir_periodo','excluir_fechamento','alertas_cobrancas_orfas')
UNION ALL
SELECT 'referencia semanal usa ANO ISO (31/12/2025 = semana 1 de 2026)',
       to_char(DATE '2025-12-31', 'IYYY-"S"IW'), '2026-S01'
UNION ALL
SELECT 'referencia mensal', to_char(DATE '2026-08-18', 'YYYY-MM'), '2026-08'
UNION ALL
SELECT 'semana comeca na segunda',
       to_char(date_trunc('week', DATE '2026-08-23')::date, 'YYYY-MM-DD'), '2026-08-17'
UNION ALL
SELECT 'excluir fechamento nao apaga cobranca',
       CASE WHEN (SELECT prosrc FROM pg_proc WHERE proname='excluir_fechamento')
                 LIKE '%fechamento_id = NULL%' THEN 'sim' ELSE 'NAO' END, 'sim'
UNION ALL
SELECT 'policies de fechamentos (so financeiro)', count(*)::text, '2'
FROM pg_policies WHERE schemaname='public' AND tablename='fechamentos'
UNION ALL
SELECT 'jobs agendados', public.jobs_agendados(),
       'alertas-cobrancas-orfas deve aparecer na lista';
