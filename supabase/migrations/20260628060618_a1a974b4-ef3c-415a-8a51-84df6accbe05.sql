ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cargo text CHECK (cargo IN ('tecnico','comercial','admin')),
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS avatar_url text;

CREATE TABLE IF NOT EXISTS public.visitas_tecnicas (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id           uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  projeto_id           uuid REFERENCES public.projetos(id) ON DELETE SET NULL,
  tecnico_id           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  titulo               text NOT NULL,
  descricao_pedido     text,
  endereco             text NOT NULL,
  complemento          text,
  latitude             numeric,
  longitude            numeric,
  data_hora_agendada   timestamptz NOT NULL,
  data_hora_inicio     timestamptz,
  data_hora_fim        timestamptz,
  status               text NOT NULL DEFAULT 'pendente'
                         CHECK (status IN ('pendente','em_andamento','concluida','aprovada','reprovada')),
  notas_visita         text,
  equipamentos_vistos  text,
  motivo_reprovacao    text,
  aprovado_por         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  aprovado_em          timestamptz,
  created_by           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.visitas_tecnicas TO authenticated;
GRANT ALL ON public.visitas_tecnicas TO service_role;

ALTER TABLE public.visitas_tecnicas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view visitas" ON public.visitas_tecnicas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth users create visitas" ON public.visitas_tecnicas
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Tecnico or admin update visitas" ON public.visitas_tecnicas
  FOR UPDATE TO authenticated USING (
    tecnico_id = auth.uid()
    OR created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'comercial')
  );

CREATE POLICY "Admin delete visitas" ON public.visitas_tecnicas
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_visitas_updated_at
  BEFORE UPDATE ON public.visitas_tecnicas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_visitas_data_agendada ON public.visitas_tecnicas(data_hora_agendada);
CREATE INDEX IF NOT EXISTS idx_visitas_status ON public.visitas_tecnicas(status);
CREATE INDEX IF NOT EXISTS idx_visitas_tecnico ON public.visitas_tecnicas(tecnico_id);

CREATE TABLE IF NOT EXISTS public.fotos_visita (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id  uuid NOT NULL REFERENCES public.visitas_tecnicas(id) ON DELETE CASCADE,
  url        text NOT NULL,
  storage_path text,
  legenda    text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fotos_visita TO authenticated;
GRANT ALL ON public.fotos_visita TO service_role;

ALTER TABLE public.fotos_visita ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth view fotos" ON public.fotos_visita
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth insert fotos" ON public.fotos_visita
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owner or admin delete fotos" ON public.fotos_visita
  FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_fotos_visita ON public.fotos_visita(visita_id);

-- Storage policies for fotos-visitas bucket (private)
CREATE POLICY "Auth read fotos-visitas" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'fotos-visitas');

CREATE POLICY "Auth upload fotos-visitas" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'fotos-visitas');

CREATE POLICY "Auth delete fotos-visitas" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'fotos-visitas' AND owner = auth.uid());
