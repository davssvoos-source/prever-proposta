ALTER TABLE public.visitas_tecnicas
  ADD COLUMN IF NOT EXISTS email_sindico TEXT,
  ADD COLUMN IF NOT EXISTS email_zelador TEXT;