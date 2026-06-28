
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.visitas_tecnicas ADD COLUMN IF NOT EXISTS foto_fachada_url TEXT;

CREATE TABLE IF NOT EXISTS public.notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'info',
  titulo TEXT NOT NULL,
  corpo TEXT,
  lida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_select_own_or_global" ON public.notificacoes;
CREATE POLICY "notif_select_own_or_global" ON public.notificacoes
  FOR SELECT TO authenticated USING (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "notif_update_own_or_global" ON public.notificacoes;
CREATE POLICY "notif_update_own_or_global" ON public.notificacoes
  FOR UPDATE TO authenticated USING (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "notif_insert_auth" ON public.notificacoes;
CREATE POLICY "notif_insert_auth" ON public.notificacoes
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS notif_user_created_idx ON public.notificacoes (user_id, created_at DESC);
