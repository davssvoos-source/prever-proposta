ALTER TABLE public.visita_orcamentos
  ADD COLUMN IF NOT EXISTS blocos_selecionados jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.clientes
  ALTER COLUMN tipo_empreendimento DROP NOT NULL;