
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_auth_insert" ON storage.objects;
CREATE POLICY "avatars_auth_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_auth_update" ON storage.objects;
CREATE POLICY "avatars_auth_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_auth_delete" ON storage.objects;
CREATE POLICY "avatars_auth_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "visita_fotos_public_read" ON storage.objects;
CREATE POLICY "visita_fotos_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'visita-fotos');

DROP POLICY IF EXISTS "visita_fotos_auth_insert" ON storage.objects;
CREATE POLICY "visita_fotos_auth_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'visita-fotos');

DROP POLICY IF EXISTS "visita_fotos_auth_update" ON storage.objects;
CREATE POLICY "visita_fotos_auth_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'visita-fotos');
