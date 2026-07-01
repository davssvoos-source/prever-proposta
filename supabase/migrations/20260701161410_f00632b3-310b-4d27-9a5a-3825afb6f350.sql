ALTER TABLE public.visita_blocos
  ADD COLUMN IF NOT EXISTS b1_tamanho text,
  ADD COLUMN IF NOT EXISTS b2_tamanho text,
  ADD COLUMN IF NOT EXISTS b1_peso text,
  ADD COLUMN IF NOT EXISTS b2_peso text,
  ADD COLUMN IF NOT EXISTS qtd_dome integer,
  ADD COLUMN IF NOT EXISTS qtd_bullet integer;