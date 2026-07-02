
ALTER TABLE public.visita_blocos
  ADD COLUMN IF NOT EXISTS perimetro integer,
  ADD COLUMN IF NOT EXISTS esquinas  integer;

CREATE TABLE IF NOT EXISTS public.regras_cerca (
  sigla       text PRIMARY KEY,
  cod_eq      text NOT NULL,
  descricao   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.regras_cerca TO authenticated;
GRANT ALL    ON public.regras_cerca TO service_role;

ALTER TABLE public.regras_cerca ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read regras_cerca"
  ON public.regras_cerca FOR SELECT
  TO authenticated
  USING (true);
