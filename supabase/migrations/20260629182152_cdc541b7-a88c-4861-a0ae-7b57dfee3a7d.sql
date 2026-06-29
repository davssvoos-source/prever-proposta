ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo';

UPDATE public.profiles
  SET status = 'ativo'
  WHERE status IS NULL OR status = '';