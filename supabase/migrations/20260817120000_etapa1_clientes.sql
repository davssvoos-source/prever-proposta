-- ETAPA 1 do sistema de Ordens de Serviço — Cadastro de Clientes.
-- Referência: docs/SISTEMA_OS.md §4.1. Promove public.clientes de tabela rasa
-- e descartável (uma linha por visita, com o nome do síndico e sem endereço)
-- a REGISTRO MESTRE corporativo dos clientes atendidos pela Prever.
--
-- >>> RODAR NO SQL EDITOR DA LOVABLE (Cloud → SQL editor). Idempotente. <<<
-- >>> Conferir o SELECT final: cada linha traz o valor esperado ao lado. <<<
--
-- O que muda:
--   1) Colunas de identificação, endereço, contatos e situação do contrato.
--   2) owner_id deixa de ser obrigatório: o cadastro é da empresa, não de um
--      usuário. created_by passa a registrar quem cadastrou.
--   3) RLS corporativa: todos os autenticados leem (técnico precisa dos dados
--      do cliente em campo); gestor cadastra/edita; admin exclui.
--   4) Backfill conservador: as linhas antigas (1 por visita) recebem os dados
--      da própria visita, para deixarem de ser inúteis. A CONSOLIDAÇÃO de
--      duplicados é assistida na tela /clientes/migrar — nada é fundido aqui.

-- ═══════════════════════════════════════════════════════════════════════
-- 1) COLUNAS
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS nome_predio      text,
  ADD COLUMN IF NOT EXISTS tipo_local       text,
  ADD COLUMN IF NOT EXISTS endereco         text,
  ADD COLUMN IF NOT EXISTS complemento      text,
  ADD COLUMN IF NOT EXISTS latitude         numeric,
  ADD COLUMN IF NOT EXISTS longitude        numeric,
  ADD COLUMN IF NOT EXISTS nome_sindico     text,
  ADD COLUMN IF NOT EXISTS telefone_sindico text,
  ADD COLUMN IF NOT EXISTS email_sindico    text,
  ADD COLUMN IF NOT EXISTS nome_zelador     text,
  ADD COLUMN IF NOT EXISTS telefone_zelador text,
  ADD COLUMN IF NOT EXISTS email_zelador    text,
  ADD COLUMN IF NOT EXISTS foto_fachada_url text,
  ADD COLUMN IF NOT EXISTS qtd_apartamentos integer,
  ADD COLUMN IF NOT EXISTS qtd_acessos      integer,
  ADD COLUMN IF NOT EXISTS observacoes      text,
  ADD COLUMN IF NOT EXISTS situacao         text NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at       timestamptz NOT NULL DEFAULT now();

-- situacao: prospecto (ainda não é cliente) | ativo | inativo (contrato encerrado)
DO $$
BEGIN
  ALTER TABLE public.clientes
    ADD CONSTRAINT clientes_situacao_check
    CHECK (situacao IN ('prospecto', 'ativo', 'inativo'));
EXCEPTION
  WHEN duplicate_object THEN NULL;   -- constraint já existe
  WHEN check_violation THEN
    RAISE NOTICE 'Ha linhas com situacao fora de (prospecto, ativo, inativo) — constraint nao criada.';
END $$;

-- o cadastro é da empresa: não pertence mais a um usuário
ALTER TABLE public.clientes ALTER COLUMN owner_id DROP NOT NULL;

-- ...e excluir o usuário que cadastrou não pode levar os clientes dele embora.
-- A FK original era ON DELETE CASCADE: apagar um usuário no dashboard apagaria
-- os clientes e órfãnaria as visitas (cliente_id é SET NULL).
DO $$
DECLARE
  v_fk text;
BEGIN
  SELECT conname INTO v_fk
  FROM pg_constraint
  WHERE conrelid = 'public.clientes'::regclass
    AND contype = 'f'
    AND conkey = ARRAY[(SELECT attnum FROM pg_attribute
                        WHERE attrelid = 'public.clientes'::regclass AND attname = 'owner_id')];
  IF v_fk IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.clientes DROP CONSTRAINT %I', v_fk);
  END IF;
  ALTER TABLE public.clientes
    ADD CONSTRAINT clientes_owner_id_fkey
    FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN OTHERS THEN
    RAISE NOTICE 'FK de owner_id nao ajustada: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS clientes_nome_idx     ON public.clientes (lower(nome));
CREATE INDEX IF NOT EXISTS clientes_situacao_idx ON public.clientes (situacao);

DROP TRIGGER IF EXISTS clientes_set_updated_at ON public.clientes;
CREATE TRIGGER clientes_set_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════
-- 2) RLS CORPORATIVA (substitui o escopo por owner_id)
-- ═══════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "clientes owner or admin select" ON public.clientes;
DROP POLICY IF EXISTS "clientes owner insert"          ON public.clientes;
DROP POLICY IF EXISTS "clientes owner update"          ON public.clientes;
DROP POLICY IF EXISTS "clientes owner delete"          ON public.clientes;
DROP POLICY IF EXISTS "clientes_select_autenticados"   ON public.clientes;
DROP POLICY IF EXISTS "clientes_insert_gestor"         ON public.clientes;
DROP POLICY IF EXISTS "clientes_update_gestor"         ON public.clientes;
DROP POLICY IF EXISTS "clientes_delete_admin"          ON public.clientes;
DROP POLICY IF EXISTS "clientes_delete_gestor"         ON public.clientes;

-- técnico precisa ler o cliente da visita/OS que vai atender
CREATE POLICY "clientes_select_autenticados" ON public.clientes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "clientes_insert_gestor" ON public.clientes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_gestor(auth.uid()));

CREATE POLICY "clientes_update_gestor" ON public.clientes
  FOR UPDATE TO authenticated
  USING (public.is_gestor(auth.uid()))
  WITH CHECK (public.is_gestor(auth.uid()));

-- Gestor exclui: a consolidação assistida (/clientes/migrar) é liberada a
-- admin E comercial e precisa descartar os cadastros duplicados que sobram.
-- Restringir a admin faria o DELETE ser filtrado pela RLS em silêncio.
CREATE POLICY "clientes_delete_gestor" ON public.clientes
  FOR DELETE TO authenticated
  USING (public.is_gestor(auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════
-- 3) BACKFILL CONSERVADOR — cada linha antiga herda os dados da SUA visita
-- ═══════════════════════════════════════════════════════════════════════
-- Só toca em clientes sem endereço que são referenciados por exatamente UMA
-- visita: não há ambiguidade sobre a origem do dado. Duplicados continuam
-- duplicados (a consolidação é assistida em /clientes/migrar).
-- array_agg em vez de min(): min(uuid) só existe no PostgreSQL 18+ e o
-- Supabase roda 15/17 — o erro abortaria a migration inteira. Com
-- HAVING count(*) = 1, qualquer elemento do array é O elemento.
WITH unicos AS (
  SELECT v.cliente_id, (array_agg(v.id))[1] AS visita_id
  FROM public.visitas_tecnicas v
  WHERE v.cliente_id IS NOT NULL
  GROUP BY v.cliente_id
  HAVING count(*) = 1
)
UPDATE public.clientes c
SET nome             = COALESCE(NULLIF(v.nome_predio, ''), c.nome),
    nome_predio      = COALESCE(c.nome_predio, NULLIF(v.nome_predio, '')),
    tipo_local       = COALESCE(c.tipo_local, v.tipo_local),
    endereco         = COALESCE(c.endereco, v.endereco),
    complemento      = COALESCE(c.complemento, v.complemento),
    latitude         = COALESCE(c.latitude, v.latitude),
    longitude        = COALESCE(c.longitude, v.longitude),
    -- c.nome guardava o nome do síndico nas linhas legadas: preserva se a
    -- visita não tiver o campo preenchido
    nome_sindico     = COALESCE(c.nome_sindico, NULLIF(v.nome_sindico, ''), c.nome),
    telefone_sindico = COALESCE(c.telefone_sindico, v.telefone_sindico),
    email_sindico    = COALESCE(c.email_sindico, v.email_sindico),
    nome_zelador     = COALESCE(c.nome_zelador, v.nome_zelador),
    telefone_zelador = COALESCE(c.telefone_zelador, v.telefone_zelador),
    email_zelador    = COALESCE(c.email_zelador, v.email_zelador),
    foto_fachada_url = COALESCE(c.foto_fachada_url, v.foto_fachada_url),
    situacao         = CASE WHEN lower(COALESCE(v.status, '')) = 'aprovada'
                            THEN 'ativo' ELSE 'prospecto' END
FROM unicos u
JOIN public.visitas_tecnicas v ON v.id = u.visita_id
WHERE c.id = u.cliente_id
  AND c.endereco IS NULL;

-- clientes que nunca foram usados por visita alguma e estão vazios: marca como
-- prospecto para não poluir a lista de ativos (não exclui nada)
UPDATE public.clientes c
SET situacao = 'prospecto'
WHERE c.endereco IS NULL
  AND c.situacao = 'ativo'
  AND NOT EXISTS (SELECT 1 FROM public.visitas_tecnicas v WHERE v.cliente_id = c.id);

-- ═══════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO FINAL
-- ═══════════════════════════════════════════════════════════════════════
SELECT 'colunas novas em clientes' AS verificacao,
       count(*)::text AS resultado, '19' AS esperado
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'clientes'
  AND column_name IN ('nome_predio','tipo_local','endereco','complemento','latitude',
                      'longitude','nome_sindico','telefone_sindico','email_sindico',
                      'nome_zelador','telefone_zelador','email_zelador','foto_fachada_url',
                      'qtd_apartamentos','qtd_acessos','observacoes','situacao',
                      'created_by','updated_at')
UNION ALL
SELECT 'owner_id deixou de ser obrigatorio',
       CASE WHEN is_nullable = 'YES' THEN 'sim' ELSE 'NAO' END, 'sim'
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'clientes' AND column_name = 'owner_id'
UNION ALL
SELECT 'policies de clientes (select/insert/update/delete)',
       count(*)::text, '4'
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'clientes'
  AND policyname IN ('clientes_select_autenticados','clientes_insert_gestor',
                     'clientes_update_gestor','clientes_delete_admin')
UNION ALL
SELECT 'policies antigas por owner_id restantes',
       count(*)::text, '0'
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'clientes'
  AND policyname LIKE 'clientes owner%'
UNION ALL
SELECT 'constraint clientes_situacao_check criada',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_constraint
         WHERE conname = 'clientes_situacao_check'
           AND conrelid = 'public.clientes'::regclass
       ) THEN 'sim' ELSE 'NAO' END, 'sim'
UNION ALL
SELECT 'FK de owner_id nao apaga clientes em cascata',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_constraint
         WHERE conrelid = 'public.clientes'::regclass
           AND contype = 'f' AND confdeltype = 'n'   -- 'n' = SET NULL
           AND pg_get_constraintdef(oid) LIKE '%owner_id%'
       ) THEN 'sim' ELSE 'NAO' END, 'sim'
UNION ALL
SELECT 'clientes com endereco preenchido (apos backfill)',
       count(*)::text, '(informativo)'
FROM public.clientes WHERE endereco IS NOT NULL
UNION ALL
SELECT 'clientes ainda sem endereco (consolidar em /clientes/migrar)',
       count(*)::text, '(informativo)'
FROM public.clientes WHERE endereco IS NULL
UNION ALL
SELECT 'visitas sem cliente vinculado',
       count(*)::text, '(informativo — a tela de migracao resolve)'
FROM public.visitas_tecnicas WHERE cliente_id IS NULL;
