ALTER TABLE public.visitas_tecnicas
  ADD COLUMN IF NOT EXISTS iniciada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_aprovacao TEXT DEFAULT 'rascunho';