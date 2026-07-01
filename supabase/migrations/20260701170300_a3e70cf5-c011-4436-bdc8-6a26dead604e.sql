ALTER TABLE public.visita_orcamentos
  ADD COLUMN IF NOT EXISTS sistema_proposto text
  CHECK (sistema_proposto IS NULL OR sistema_proposto IN ('PR','PP'));