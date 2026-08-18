-- ETAPA U2 da unificação — Contratos do cliente.
-- Referência: docs/PLANO_UNIFICACAO.md §4.1 e §10.
--
-- >>> RODAR NO SQL EDITOR DA LOVABLE (Cloud → SQL editor). Idempotente. <<<
-- >>> Rodar DEPOIS da U0 (usa normalizar_texto e pode_ver_financeiro).   <<<
-- >>> Conferir o SELECT final: cada linha traz o valor esperado ao lado. <<<
--
-- Preenche a lacuna declarada na Etapa 2 do sistema de OS ("serviços SV*
-- contratados ficam anotados no cliente — campo/tabela leve, detalhe na Etapa
-- 2", nunca implementada) e traz o model Contrato do gestor-os para o padrão
-- banco-primeiro daqui.
--
-- É a peça que faltava para a decisão de cobrança do Vinicius:
--   locação   → equipamento é da Prever, não se cobra
--   manutenção→ mão de obra coberta, equipamento entra no boleto
--   sem contrato vigente → cobra tudo (MO + equipamento)
--
-- Cria:
--   cliente_contratos        — o contrato (modalidade, vigência, cobertura geral)
--   contrato_cobertura_itens — exceções por equipamento (EquipamentoCoberto)
--   contrato_precos          — tabela de preço do contrato (vence o catálogo)
--   contrato_vigente()       — qual contrato vale para um cliente numa data
--   bucket contratos         — privado, só quem enxerga financeiro
--   ordens_servico.contrato_id, preenchido sozinho na abertura

-- ═══════════════════════════════════════════════════════════════════════
-- 1) CONTRATO
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.cliente_contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- RESTRICT: não se apaga cliente que tem contrato (nem histórico de cobrança)
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  numero text,
  titulo text,
  -- alinhada às naturezas do QAP (Compra/Comodato/Locação/…): é o que decide
  -- se o equipamento instalado é faturável
  modalidade text NOT NULL DEFAULT 'manutencao',
  tipo_cobranca text NOT NULL DEFAULT 'mensal_fixo',
  status text NOT NULL DEFAULT 'rascunho',
  vigencia_inicio date,
  vigencia_fim date,                     -- NULL = vigência aberta
  valor_mensal numeric(12,2),
  dia_vencimento integer,
  franquia_visitas_mes integer,          -- NULL = sem franquia
  -- regra geral do contrato; contrato_cobertura_itens sobrepõe item a item
  inclui_pecas boolean NOT NULL DEFAULT false,
  inclui_mao_de_obra boolean NOT NULL DEFAULT true,
  inclui_deslocamento boolean NOT NULL DEFAULT false,
  -- o elo que nenhum dos dois sistemas tinha: proposta aprovada → contrato
  origem_proposta_id uuid REFERENCES public.visitas_tecnicas(id) ON DELETE SET NULL,
  -- rastro da leitura por I.A (o humano confere antes de ativar)
  arquivo_url text,
  arquivo_path text,
  texto_extraido text,
  confianca_extracao numeric(4,3),
  extraido_em timestamptz,
  observacoes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE public.cliente_contratos ADD CONSTRAINT cliente_contratos_modalidade_check
    CHECK (modalidade IN ('locacao','manutencao','comodato','venda'));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN
  RAISE NOTICE 'modalidade fora da lista — constraint nao criada';
END $$;

DO $$
BEGIN
  ALTER TABLE public.cliente_contratos ADD CONSTRAINT cliente_contratos_cobranca_check
    CHECK (tipo_cobranca IN ('mensal_fixo','por_chamado','misto'));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN
  RAISE NOTICE 'tipo_cobranca fora da lista — constraint nao criada';
END $$;

DO $$
BEGIN
  ALTER TABLE public.cliente_contratos ADD CONSTRAINT cliente_contratos_status_check
    CHECK (status IN ('rascunho','ativo','encerrado'));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN
  RAISE NOTICE 'status fora da lista — constraint nao criada';
END $$;

-- vigência invertida é erro de digitação que só apareceria meses depois,
-- na hora de decidir se a OS estava coberta
DO $$
BEGIN
  ALTER TABLE public.cliente_contratos ADD CONSTRAINT cliente_contratos_vigencia_check
    CHECK (vigencia_fim IS NULL OR vigencia_inicio IS NULL OR vigencia_fim >= vigencia_inicio);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN
  RAISE NOTICE 'ha contrato com vigencia invertida — constraint nao criada';
END $$;

DO $$
BEGIN
  ALTER TABLE public.cliente_contratos ADD CONSTRAINT cliente_contratos_dia_check
    CHECK (dia_vencimento IS NULL OR dia_vencimento BETWEEN 1 AND 31);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN
  RAISE NOTICE 'dia_vencimento fora de 1..31 — constraint nao criada';
END $$;

CREATE INDEX IF NOT EXISTS contratos_cliente_idx ON public.cliente_contratos (cliente_id, status);
CREATE INDEX IF NOT EXISTS contratos_vigencia_idx ON public.cliente_contratos (vigencia_inicio, vigencia_fim);
-- numero do contrato é único dentro do cliente (era assim no gestor-os)
CREATE UNIQUE INDEX IF NOT EXISTS contratos_numero_unico
  ON public.cliente_contratos (cliente_id, numero) WHERE numero IS NOT NULL;

DROP TRIGGER IF EXISTS cliente_contratos_set_updated_at ON public.cliente_contratos;
CREATE TRIGGER cliente_contratos_set_updated_at
  BEFORE UPDATE ON public.cliente_contratos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════
-- 2) COBERTURA POR EQUIPAMENTO (o EquipamentoCoberto do gestor-os)
-- ═══════════════════════════════════════════════════════════════════════
-- NÃO é um inventário paralelo: aponta para cliente_equipamentos, que já é o
-- as-built. Só existe linha aqui quando o contrato trata aquele item de forma
-- diferente da regra geral, ou quando o contrato lista algo que ainda não foi
-- reconhecido no inventário (aí fica em texto + nº de série).
CREATE TABLE IF NOT EXISTS public.contrato_cobertura_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES public.cliente_contratos(id) ON DELETE CASCADE,
  cliente_equipamento_id uuid REFERENCES public.cliente_equipamentos(id) ON DELETE SET NULL,
  descricao text,
  marca text,
  modelo text,
  numero_serie text,
  tag_patrimonio text,
  local text,
  quantidade numeric NOT NULL DEFAULT 1,
  cobertura text NOT NULL DEFAULT 'integral',
  -- NULL = herda do contrato; true/false sobrepõem
  inclui_pecas boolean,
  inclui_mao_de_obra boolean,
  -- chave normalizada para o pré-match determinístico da U4
  chave_busca text GENERATED ALWAYS AS (
    public.normalizar_texto(
      COALESCE(marca, '') || ' ' || COALESCE(modelo, '') || ' ' || COALESCE(descricao, '')
    )
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE public.contrato_cobertura_itens ADD CONSTRAINT contrato_cobertura_check
    CHECK (cobertura IN ('integral','parcial','nao_coberto'));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN
  RAISE NOTICE 'cobertura fora da lista — constraint nao criada';
END $$;

CREATE INDEX IF NOT EXISTS cobertura_contrato_idx ON public.contrato_cobertura_itens (contrato_id);
CREATE INDEX IF NOT EXISTS cobertura_chave_idx    ON public.contrato_cobertura_itens (chave_busca);
CREATE INDEX IF NOT EXISTS cobertura_serie_idx
  ON public.contrato_cobertura_itens (public.normalizar_texto(numero_serie));

-- ═══════════════════════════════════════════════════════════════════════
-- 3) PREÇOS DO CONTRATO
-- ═══════════════════════════════════════════════════════════════════════
-- O PADRÃO global é o catálogo comercial (equipamentos/servicos) que já
-- alimenta as propostas — decisão registrada no PLANO_UNIFICACAO §11.2.
-- Esta tabela é a exceção: preço combinado NAQUELE contrato, que vence o
-- catálogo na cascata de valoração da U4.
CREATE TABLE IF NOT EXISTS public.contrato_precos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES public.cliente_contratos(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  unidade text,
  valor_unitario numeric(12,2) NOT NULL,
  chave_busca text GENERATED ALWAYS AS (public.normalizar_texto(descricao)) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS contrato_precos_unico
  ON public.contrato_precos (contrato_id, chave_busca);

-- ═══════════════════════════════════════════════════════════════════════
-- 4) QUAL CONTRATO VALE? (regra do contratoVigente do gestor-os)
-- ═══════════════════════════════════════════════════════════════════════
-- Ativo, já começou e ainda não terminou (fim nulo = aberto). Havendo mais de
-- um — renovação cadastrada antes de encerrar o anterior —, vence o de início
-- mais recente: é o que o operador esperaria ver.
CREATE OR REPLACE FUNCTION public.contrato_vigente(_cliente_id uuid, _data date DEFAULT NULL)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id
  FROM public.cliente_contratos c
  WHERE c.cliente_id = _cliente_id
    AND c.status = 'ativo'
    AND (c.vigencia_inicio IS NULL
         OR c.vigencia_inicio <= COALESCE(_data, (now() AT TIME ZONE 'America/Sao_Paulo')::date))
    AND (c.vigencia_fim IS NULL
         OR c.vigencia_fim >= COALESCE(_data, (now() AT TIME ZONE 'America/Sao_Paulo')::date))
  ORDER BY c.vigencia_inicio DESC NULLS LAST, c.created_at DESC
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.contrato_vigente(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contrato_vigente(uuid, date) TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════
-- 5) A OS NASCE VINCULADA AO CONTRATO
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS contrato_id uuid REFERENCES public.cliente_contratos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS os_contrato_idx ON public.ordens_servico (contrato_id);

COMMENT ON COLUMN public.ordens_servico.contrato_id IS
  'Contrato vigente na abertura, congelado aqui. Renovar o contrato depois NÃO reescreve a OS antiga — a cobrança dela seguiu a regra da época.';

-- Estende o trigger de abertura (U0 já tinha acrescentado tipo_servico).
CREATE OR REPLACE FUNCTION public.os_preencher_numero_e_prazo()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_horas int;
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := public.proximo_numero_os();
  END IF;
  IF NEW.prazo_limite IS NULL THEN
    SELECT horas_prazo INTO v_horas FROM public.os_sla WHERE prioridade = NEW.prioridade;
    IF v_horas IS NOT NULL THEN
      NEW.prazo_limite := COALESCE(NEW.created_at, now()) + make_interval(hours => v_horas);
    END IF;
  END IF;
  -- instalação × manutenção: dimensão do fechamento, derivada do tipo da OS
  IF NEW.tipo_servico IS NULL THEN
    NEW.tipo_servico := CASE WHEN NEW.tipo = 'implantacao' THEN 'instalacao' ELSE 'manutencao' END;
  END IF;
  -- congela o contrato vigente na abertura
  IF NEW.contrato_id IS NULL THEN
    NEW.contrato_id := public.contrato_vigente(NEW.cliente_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Backfill conservador: só OS ainda em aberto recebe o contrato vigente HOJE.
-- OS encerrada fica sem vínculo de propósito — não dá para afirmar qual
-- contrato valia no dia em que ela foi atendida.
UPDATE public.ordens_servico o
SET contrato_id = public.contrato_vigente(o.cliente_id)
WHERE o.contrato_id IS NULL
  AND o.status NOT IN ('fechada','cancelada');

-- ═══════════════════════════════════════════════════════════════════════
-- 6) RLS — FINANCEIRO NÃO É PARA TODO MUNDO
-- ═══════════════════════════════════════════════════════════════════════
-- Técnico que acessa a OS NÃO enxerga valor, vigência nem cobertura: a leitura
-- passa por pode_ver_financeiro() (U0), e não por pode_acessar_os().
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_contratos        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contrato_cobertura_itens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contrato_precos          TO authenticated;
GRANT ALL ON public.cliente_contratos, public.contrato_cobertura_itens,
             public.contrato_precos TO service_role;

ALTER TABLE public.cliente_contratos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contrato_cobertura_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contrato_precos          ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contratos_select" ON public.cliente_contratos;
DROP POLICY IF EXISTS "contratos_write"  ON public.cliente_contratos;
CREATE POLICY "contratos_select" ON public.cliente_contratos
  FOR SELECT TO authenticated USING (public.pode_ver_financeiro(auth.uid()));
CREATE POLICY "contratos_write" ON public.cliente_contratos
  FOR ALL TO authenticated
  USING (public.pode_ver_financeiro(auth.uid()))
  WITH CHECK (public.pode_ver_financeiro(auth.uid()));

DROP POLICY IF EXISTS "cobertura_select" ON public.contrato_cobertura_itens;
DROP POLICY IF EXISTS "cobertura_write"  ON public.contrato_cobertura_itens;
CREATE POLICY "cobertura_select" ON public.contrato_cobertura_itens
  FOR SELECT TO authenticated USING (public.pode_ver_financeiro(auth.uid()));
CREATE POLICY "cobertura_write" ON public.contrato_cobertura_itens
  FOR ALL TO authenticated
  USING (public.pode_ver_financeiro(auth.uid()))
  WITH CHECK (public.pode_ver_financeiro(auth.uid()));

DROP POLICY IF EXISTS "contrato_precos_select" ON public.contrato_precos;
DROP POLICY IF EXISTS "contrato_precos_write"  ON public.contrato_precos;
CREATE POLICY "contrato_precos_select" ON public.contrato_precos
  FOR SELECT TO authenticated USING (public.pode_ver_financeiro(auth.uid()));
CREATE POLICY "contrato_precos_write" ON public.contrato_precos
  FOR ALL TO authenticated
  USING (public.pode_ver_financeiro(auth.uid()))
  WITH CHECK (public.pode_ver_financeiro(auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════
-- 7) STORAGE — PDF do contrato
-- ═══════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public) VALUES ('contratos','contratos',false)
  ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'bucket contratos nao criado por SQL (%): crie no dashboard como PRIVADO.', SQLERRM;
END $$;

-- Contrato é documento financeiro: mesma régua das tabelas acima.
DROP POLICY IF EXISTS "contratos_arquivo_read"   ON storage.objects;
DROP POLICY IF EXISTS "contratos_arquivo_insert" ON storage.objects;
DROP POLICY IF EXISTS "contratos_arquivo_delete" ON storage.objects;
CREATE POLICY "contratos_arquivo_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'contratos' AND public.pode_ver_financeiro(auth.uid()));
CREATE POLICY "contratos_arquivo_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contratos' AND public.pode_ver_financeiro(auth.uid()));
CREATE POLICY "contratos_arquivo_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'contratos' AND public.pode_ver_financeiro(auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════
-- 8) ALERTA DE CONTRATO VENCENDO (§6, automação 6)
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.alertas_contratos(_dias int DEFAULT 60)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_envios int := 0;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo)
  SELECT p.id, 'contrato_vencendo', 'Contrato vencendo',
         cl.nome || ' — vence em ' || to_char(c.vigencia_fim, 'DD/MM/YYYY')
         || ' (' || (c.vigencia_fim - v_hoje)::text || ' dias).'
  FROM public.cliente_contratos c
  JOIN public.clientes cl ON cl.id = c.cliente_id
  CROSS JOIN public.profiles p
  WHERE c.status = 'ativo'
    AND c.vigencia_fim IS NOT NULL
    AND c.vigencia_fim BETWEEN v_hoje AND v_hoje + _dias
    AND p.cargo IN ('admin','comercial')
    AND p.ativo IS DISTINCT FROM false
    AND p.status IS DISTINCT FROM 'rejeitado'
    AND p.status IS DISTINCT FROM 'pendente_aprovacao'
    -- semanal, não diário: aviso repetido vira ruído e ninguém lê
    AND NOT EXISTS (
      SELECT 1 FROM public.notificacoes n
      WHERE n.user_id = p.id AND n.tipo = 'contrato_vencendo'
        AND n.corpo LIKE cl.nome || '%'
        AND n.created_at > now() - interval '7 days');
  GET DIAGNOSTICS v_envios = ROW_COUNT;
  RETURN 'avisos de contrato: ' || v_envios;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.alertas_contratos(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.alertas_contratos(int) TO service_role;

DO $$
DECLARE r text;
BEGIN
  -- 08:00 de segunda em Brasília = 11:00 UTC
  r := public.agendar_job('alertas-contratos', '0 11 * * 1', 'SELECT public.alertas_contratos();');
  RAISE NOTICE '%', r;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'agendamento nao aplicado: %', SQLERRM;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO FINAL
-- ═══════════════════════════════════════════════════════════════════════
SELECT 'tabelas criadas (contratos, cobertura, precos)' AS verificacao,
       count(*)::text AS resultado, '3' AS esperado
FROM information_schema.tables
WHERE table_schema='public' AND table_name IN
  ('cliente_contratos','contrato_cobertura_itens','contrato_precos')
UNION ALL
SELECT 'constraints de dominio do contrato', count(*)::text, '5'
FROM pg_constraint
WHERE conname IN ('cliente_contratos_modalidade_check','cliente_contratos_cobranca_check',
                  'cliente_contratos_status_check','cliente_contratos_vigencia_check',
                  'cliente_contratos_dia_check')
UNION ALL
SELECT 'coluna contrato_id em ordens_servico',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
         WHERE table_schema='public' AND table_name='ordens_servico' AND column_name='contrato_id')
       THEN 'sim' ELSE 'NAO' END, 'sim'
UNION ALL
SELECT 'trigger de abertura ja congela o contrato',
       CASE WHEN (SELECT prosrc FROM pg_proc WHERE proname='os_preencher_numero_e_prazo')
                 LIKE '%contrato_vigente%' THEN 'sim' ELSE 'NAO' END, 'sim'
UNION ALL
SELECT 'funcoes novas (contrato_vigente, alertas_contratos)', count(*)::text, '2'
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('contrato_vigente','alertas_contratos')
UNION ALL
SELECT 'policies financeiras (3 tabelas x 2)', count(*)::text, '6'
FROM pg_policies
WHERE schemaname='public' AND tablename IN
  ('cliente_contratos','contrato_cobertura_itens','contrato_precos')
UNION ALL
SELECT 'policies do bucket de contratos', count(*)::text, '3'
FROM pg_policies
WHERE schemaname='storage' AND tablename='objects'
  AND policyname IN ('contratos_arquivo_read','contratos_arquivo_insert','contratos_arquivo_delete')
UNION ALL
SELECT 'bucket contratos (privado)',
       COALESCE((SELECT CASE WHEN public THEN 'PUBLICO (corrigir)' ELSE 'privado' END
                 FROM storage.buckets WHERE id='contratos'), 'NAO EXISTE — criar no dashboard'),
       'privado'
UNION ALL
SELECT 'chave_busca gerada funciona',
       COALESCE((SELECT public.normalizar_texto('Intelbras  VIP 3230 B') ), '(nulo)'),
       'intelbras vip 3230 b'
UNION ALL
SELECT 'contratos cadastrados', count(*)::text, '(informativo — 0 numa base nova)'
FROM public.cliente_contratos
UNION ALL
SELECT 'jobs agendados', public.jobs_agendados(),
       'alertas-contratos deve aparecer na lista';
