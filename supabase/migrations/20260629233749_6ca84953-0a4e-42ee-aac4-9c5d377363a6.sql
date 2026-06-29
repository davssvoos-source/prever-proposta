CREATE TABLE IF NOT EXISTS public.visita_blocos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  visita_id UUID NOT NULL REFERENCES public.visitas_tecnicas(id) ON DELETE CASCADE,
  codigo_bloco TEXT NOT NULL,
  nome_descritivo TEXT NOT NULL,
  tipo_bloco TEXT NOT NULL,
  qtd_barreiras TEXT,
  eclusa BOOLEAN DEFAULT FALSE,
  b1_tipo TEXT,
  b1_entrada TEXT,
  b1_saida TEXT,
  b1_material TEXT,
  b1_abertura TEXT,
  b1_folhas TEXT,
  b2_tipo TEXT,
  b2_entrada TEXT,
  b2_saida TEXT,
  b2_material TEXT,
  b2_abertura TEXT,
  b2_folhas TEXT,
  tecnologia TEXT,
  hh_padrao INTEGER NOT NULL DEFAULT 10,
  quantidade INTEGER NOT NULL DEFAULT 1,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.visita_blocos TO authenticated;
GRANT ALL ON public.visita_blocos TO service_role;

ALTER TABLE public.visita_blocos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage visita_blocos"
ON public.visita_blocos FOR ALL
TO authenticated
USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS visita_blocos_visita_id_idx ON public.visita_blocos(visita_id);
CREATE INDEX IF NOT EXISTS visita_blocos_visita_tipo_idx ON public.visita_blocos(visita_id, tipo_bloco);