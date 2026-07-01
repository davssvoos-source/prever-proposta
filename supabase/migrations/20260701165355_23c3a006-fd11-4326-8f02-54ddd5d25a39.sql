
-- regras_blocos
CREATE TABLE IF NOT EXISTS public.regras_blocos (
  id bigserial PRIMARY KEY,
  regra_id text NOT NULL,
  escopo text NOT NULL,             -- POR_BLOCO | POR_PROJETO
  condicao text NOT NULL,
  cod_eq text NOT NULL,
  qtd numeric NOT NULL DEFAULT 1,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS regras_blocos_escopo_idx ON public.regras_blocos(escopo);
GRANT SELECT ON public.regras_blocos TO authenticated;
GRANT ALL ON public.regras_blocos TO service_role;
ALTER TABLE public.regras_blocos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read regras_blocos" ON public.regras_blocos;
CREATE POLICY "Authenticated read regras_blocos"
  ON public.regras_blocos FOR SELECT TO authenticated USING (true);

-- regras_cftv
CREATE TABLE IF NOT EXISTS public.regras_cftv (
  id bigserial PRIMARY KEY,
  tipo text NOT NULL,               -- CAMERA | GRAVADOR | HD | ACESSORIO
  chave1 text,
  chave2 text,
  chave3 text,
  cod_eq text NOT NULL,
  qtd numeric NOT NULL DEFAULT 1,
  cod_eq2 text,
  qtd2 numeric,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS regras_cftv_tipo_idx ON public.regras_cftv(tipo);
GRANT SELECT ON public.regras_cftv TO authenticated;
GRANT ALL ON public.regras_cftv TO service_role;
ALTER TABLE public.regras_cftv ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read regras_cftv" ON public.regras_cftv;
CREATE POLICY "Authenticated read regras_cftv"
  ON public.regras_cftv FOR SELECT TO authenticated USING (true);

-- visita_bloco_itens
CREATE TABLE IF NOT EXISTS public.visita_bloco_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_bloco_id uuid NOT NULL REFERENCES public.visita_blocos(id) ON DELETE CASCADE,
  cod_eq text NOT NULL,
  qtd numeric NOT NULL DEFAULT 1,
  origem text NOT NULL DEFAULT 'auto',   -- auto | manual
  removido boolean NOT NULL DEFAULT false,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vbi_visita_bloco_idx ON public.visita_bloco_itens(visita_bloco_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visita_bloco_itens TO authenticated;
GRANT ALL ON public.visita_bloco_itens TO service_role;
ALTER TABLE public.visita_bloco_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated manage visita_bloco_itens" ON public.visita_bloco_itens;
CREATE POLICY "Authenticated manage visita_bloco_itens"
  ON public.visita_bloco_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS vbi_set_updated_at ON public.visita_bloco_itens;
CREATE TRIGGER vbi_set_updated_at BEFORE UPDATE ON public.visita_bloco_itens
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
