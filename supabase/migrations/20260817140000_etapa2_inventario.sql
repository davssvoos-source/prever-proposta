-- ETAPA 2 do sistema de Ordens de Serviço — Inventário do cliente (as-built).
-- Referência: docs/SISTEMA_OS.md §4.2.
--
-- >>> RODAR NO SQL EDITOR DA LOVABLE (Cloud → SQL editor). Idempotente. <<<
-- >>> Conferir o SELECT final: cada linha traz o valor esperado ao lado. <<<
--
-- Duas tabelas novas:
--   cliente_sistemas     — o que está instalado no cliente, por sistema
--                          (eclusa de pedestres, CFTV, cerca, central…),
--                          usando a mesma taxonomia dos blocos do orçamento.
--   cliente_equipamentos — os equipamentos de cada sistema, ligados ao
--                          catálogo por FK de verdade (o vínculo por cod_eq
--                          em texto, sem FK, é o que permitiu o bug do EQ302).
--
-- Origem dos dados: derivados do escopo aprovado de uma visita (blocos + itens)
-- ou registrados em campo pelos técnicos nos clientes antigos, que nunca
-- passaram pelo app.

-- ═══════════════════════════════════════════════════════════════════════
-- 1) SISTEMAS INSTALADOS
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.cliente_sistemas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  -- mesma taxonomia de tipo_bloco do orçamento + OUTRO para o que vier de campo
  tipo text NOT NULL,
  nome text NOT NULL,
  descricao text,
  -- rastro de qual bloco do orçamento originou este sistema (quando derivado)
  origem_visita_bloco_id uuid REFERENCES public.visita_blocos(id) ON DELETE SET NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE public.cliente_sistemas
    ADD CONSTRAINT cliente_sistemas_tipo_check
    CHECK (tipo IN ('PED','VEI','CFTV','AL','CER','CENT','ELV','TOT','OUTRO'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN check_violation THEN
    RAISE NOTICE 'Ha linhas com tipo fora da lista — constraint de tipo nao criada.';
END $$;

CREATE INDEX IF NOT EXISTS cliente_sistemas_cliente_idx ON public.cliente_sistemas (cliente_id);
CREATE INDEX IF NOT EXISTS cliente_sistemas_bloco_idx   ON public.cliente_sistemas (origem_visita_bloco_id);

-- um bloco de orçamento só pode originar um sistema (evita importar 2x o mesmo
-- escopo e duplicar o inventário)
CREATE UNIQUE INDEX IF NOT EXISTS cliente_sistemas_bloco_unico
  ON public.cliente_sistemas (origem_visita_bloco_id)
  WHERE origem_visita_bloco_id IS NOT NULL;

DROP TRIGGER IF EXISTS cliente_sistemas_set_updated_at ON public.cliente_sistemas;
CREATE TRIGGER cliente_sistemas_set_updated_at
  BEFORE UPDATE ON public.cliente_sistemas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════
-- 2) EQUIPAMENTOS INSTALADOS
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.cliente_equipamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_sistema_id uuid NOT NULL REFERENCES public.cliente_sistemas(id) ON DELETE CASCADE,
  -- FK de verdade para o catálogo; SET NULL para o item não desaparecer do
  -- inventário se o catálogo for reorganizado pelo ETL externo
  equipamento_id uuid REFERENCES public.equipamentos(id) ON DELETE SET NULL,
  -- snapshots: o catálogo é mantido por importação de planilha e pode mudar
  cod_eq text,
  nome_snapshot text,
  qtd numeric NOT NULL DEFAULT 1,
  estado text NOT NULL DEFAULT 'ativo',
  origem text NOT NULL DEFAULT 'manual',
  instalado_em date,
  observacao text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE public.cliente_equipamentos
    ADD CONSTRAINT cliente_equipamentos_estado_check
    CHECK (estado IN ('ativo','substituido','removido'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN check_violation THEN
    RAISE NOTICE 'Ha linhas com estado fora da lista — constraint de estado nao criada.';
END $$;

DO $$
BEGIN
  ALTER TABLE public.cliente_equipamentos
    ADD CONSTRAINT cliente_equipamentos_origem_check
    CHECK (origem IN ('implantacao','campo','manual'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN check_violation THEN
    RAISE NOTICE 'Ha linhas com origem fora da lista — constraint de origem nao criada.';
END $$;

CREATE INDEX IF NOT EXISTS cliente_equipamentos_sistema_idx ON public.cliente_equipamentos (cliente_sistema_id);
CREATE INDEX IF NOT EXISTS cliente_equipamentos_cod_idx     ON public.cliente_equipamentos (cod_eq);

DROP TRIGGER IF EXISTS cliente_equipamentos_set_updated_at ON public.cliente_equipamentos;
CREATE TRIGGER cliente_equipamentos_set_updated_at
  BEFORE UPDATE ON public.cliente_equipamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════
-- 3) RLS
-- ═══════════════════════════════════════════════════════════════════════
-- Leitura e escrita para a equipe interna: o técnico registra o que encontra em
-- campo (decisão do usuário: "equipamentos registrados aos poucos pelos
-- técnicos em campo"). Exclusão só de gestor — remoção normal é mudar o
-- `estado` para 'removido', que preserva o histórico.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_sistemas TO authenticated;
GRANT ALL ON public.cliente_sistemas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_equipamentos TO authenticated;
GRANT ALL ON public.cliente_equipamentos TO service_role;

ALTER TABLE public.cliente_sistemas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_equipamentos  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cliente_sistemas_select"       ON public.cliente_sistemas;
DROP POLICY IF EXISTS "cliente_sistemas_insert"       ON public.cliente_sistemas;
DROP POLICY IF EXISTS "cliente_sistemas_update"       ON public.cliente_sistemas;
DROP POLICY IF EXISTS "cliente_sistemas_delete"       ON public.cliente_sistemas;
CREATE POLICY "cliente_sistemas_select" ON public.cliente_sistemas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "cliente_sistemas_insert" ON public.cliente_sistemas
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cliente_sistemas_update" ON public.cliente_sistemas
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "cliente_sistemas_delete" ON public.cliente_sistemas
  FOR DELETE TO authenticated USING (public.is_gestor(auth.uid()));

DROP POLICY IF EXISTS "cliente_equipamentos_select"   ON public.cliente_equipamentos;
DROP POLICY IF EXISTS "cliente_equipamentos_insert"   ON public.cliente_equipamentos;
DROP POLICY IF EXISTS "cliente_equipamentos_update"   ON public.cliente_equipamentos;
DROP POLICY IF EXISTS "cliente_equipamentos_delete"   ON public.cliente_equipamentos;
CREATE POLICY "cliente_equipamentos_select" ON public.cliente_equipamentos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "cliente_equipamentos_insert" ON public.cliente_equipamentos
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cliente_equipamentos_update" ON public.cliente_equipamentos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "cliente_equipamentos_delete" ON public.cliente_equipamentos
  FOR DELETE TO authenticated USING (public.is_gestor(auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO FINAL
-- ═══════════════════════════════════════════════════════════════════════
SELECT 'tabelas criadas (cliente_sistemas, cliente_equipamentos)' AS verificacao,
       count(*)::text AS resultado, '2' AS esperado
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('cliente_sistemas','cliente_equipamentos')
UNION ALL
SELECT 'RLS ativa nas duas tabelas',
       count(*)::text, '2'
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('cliente_sistemas','cliente_equipamentos')
  AND c.relrowsecurity
UNION ALL
SELECT 'policies criadas (4 por tabela)',
       count(*)::text, '8'
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('cliente_sistemas','cliente_equipamentos')
UNION ALL
SELECT 'constraints de dominio (tipo, estado, origem)',
       count(*)::text, '3'
FROM pg_constraint
WHERE conname IN ('cliente_sistemas_tipo_check',
                  'cliente_equipamentos_estado_check',
                  'cliente_equipamentos_origem_check')
UNION ALL
SELECT 'indice unico impedindo importar o mesmo bloco 2x',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_indexes
         WHERE schemaname = 'public' AND indexname = 'cliente_sistemas_bloco_unico'
       ) THEN 'sim' ELSE 'NAO' END, 'sim'
UNION ALL
SELECT 'FK de equipamento_id aponta para o catalogo',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_constraint
         WHERE conrelid = 'public.cliente_equipamentos'::regclass
           AND contype = 'f'
           AND confrelid = 'public.equipamentos'::regclass
       ) THEN 'sim' ELSE 'NAO' END, 'sim'
UNION ALL
SELECT 'triggers de updated_at',
       count(*)::text, '2'
FROM pg_trigger
WHERE NOT tgisinternal
  AND tgname IN ('cliente_sistemas_set_updated_at','cliente_equipamentos_set_updated_at')
UNION ALL
SELECT 'visitas aprovadas com escopo (fonte para derivar o as-built)',
       count(DISTINCT v.id)::text, '(informativo)'
FROM public.visitas_tecnicas v
JOIN public.visita_blocos b ON b.visita_id = v.id
WHERE lower(COALESCE(v.status, '')) = 'aprovada';
