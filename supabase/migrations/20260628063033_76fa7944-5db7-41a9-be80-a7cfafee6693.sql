
-- 1) Novos campos em visitas_tecnicas
ALTER TABLE public.visitas_tecnicas
  ADD COLUMN IF NOT EXISTS nome_predio        text,
  ADD COLUMN IF NOT EXISTS nome_sindico       text,
  ADD COLUMN IF NOT EXISTS contato_sindico    text,
  ADD COLUMN IF NOT EXISTS tipo_local         text,
  ADD COLUMN IF NOT EXISTS servico_solicitado text,
  ADD COLUMN IF NOT EXISTS prioridade         text DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS obs_agendamento    text;

-- Constraints de domínio (idempotentes)
DO $$ BEGIN
  ALTER TABLE public.visitas_tecnicas ADD CONSTRAINT visitas_tipo_local_check
    CHECK (tipo_local IS NULL OR tipo_local IN ('condominio_vertical','condominio_horizontal','empresa','residencia'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.visitas_tecnicas ADD CONSTRAINT visitas_servico_solicitado_check
    CHECK (servico_solicitado IS NULL OR servico_solicitado IN (
      'portaria_remota','cftv','alarme','cerca_eletrica',
      'acesso_pedestre','acesso_veicular','elevadores','manutencao','consultoria','outro'
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.visitas_tecnicas ADD CONSTRAINT visitas_prioridade_check
    CHECK (prioridade IN ('baixa','normal','alta','urgente'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Campo "ativo" em profiles (reutilizando profiles em vez de criar perfis)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

-- Permitir leitura de profiles para todos os autenticados (necessário para listar técnicos no painel)
DO $$ BEGIN
  DROP POLICY IF EXISTS "profiles_select_all_authenticated" ON public.profiles;
  CREATE POLICY "profiles_select_all_authenticated"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);
END $$;

-- 3) Realtime para visitas_tecnicas
ALTER TABLE public.visitas_tecnicas REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.visitas_tecnicas;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
