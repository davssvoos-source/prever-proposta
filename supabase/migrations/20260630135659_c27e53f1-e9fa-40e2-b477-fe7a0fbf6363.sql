ALTER TABLE public.visitas_tecnicas ALTER COLUMN data_hora_agendada DROP NOT NULL;
ALTER TABLE public.visitas_tecnicas ADD COLUMN IF NOT EXISTS nome_zelador TEXT;