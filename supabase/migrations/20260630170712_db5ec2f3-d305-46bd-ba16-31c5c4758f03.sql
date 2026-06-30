ALTER TABLE public.visitas_tecnicas
  ADD COLUMN IF NOT EXISTS telefone_sindico TEXT,
  ADD COLUMN IF NOT EXISTS telefone_zelador TEXT;