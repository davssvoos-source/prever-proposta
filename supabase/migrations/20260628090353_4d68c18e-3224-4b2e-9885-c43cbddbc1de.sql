
DROP POLICY IF EXISTS "notif_insert_auth" ON public.notificacoes;
CREATE POLICY "notif_insert_own" ON public.notificacoes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
