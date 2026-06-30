
ALTER TABLE public.visita_blocos
  ADD COLUMN IF NOT EXISTS fotos_urls TEXT[] NOT NULL DEFAULT '{}';

-- Storage policies for blocos-fotos bucket (private)
CREATE POLICY "Authenticated read blocos-fotos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'blocos-fotos');

CREATE POLICY "Authenticated upload blocos-fotos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'blocos-fotos');

CREATE POLICY "Authenticated update blocos-fotos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'blocos-fotos');

CREATE POLICY "Authenticated delete blocos-fotos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'blocos-fotos');
