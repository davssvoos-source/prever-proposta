
-- Promote davssvoos@gmail.com
INSERT INTO public.profiles (id, nome, email, cargo, ativo)
SELECT id, COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)), email, 'admin', true
FROM auth.users WHERE email = 'davssvoos@gmail.com'
ON CONFLICT (id) DO UPDATE SET cargo = 'admin', ativo = true;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE email = 'davssvoos@gmail.com'
ON CONFLICT DO NOTHING;

-- Drop old status constraint FIRST, then migrate values, then add new constraint
ALTER TABLE public.visitas_tecnicas DROP CONSTRAINT IF EXISTS visitas_tecnicas_status_check;

UPDATE public.visitas_tecnicas SET status = 'aguardando_aprovacao' WHERE status = 'concluida';
UPDATE public.visitas_tecnicas SET status = 'aprovado' WHERE status IN ('aprovada', 'reprovada');
UPDATE public.visitas_tecnicas SET status = 'pendente' WHERE status = 'em_andamento';

ALTER TABLE public.visitas_tecnicas ADD CONSTRAINT visitas_tecnicas_status_check
  CHECK (status IN ('pendente','aguardando_aprovacao','aprovado'));

-- RLS visitas
ALTER TABLE public.visitas_tecnicas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "visitas_select" ON public.visitas_tecnicas;
DROP POLICY IF EXISTS "visitas_insert" ON public.visitas_tecnicas;
DROP POLICY IF EXISTS "visitas_update" ON public.visitas_tecnicas;
DROP POLICY IF EXISTS "visitas_delete" ON public.visitas_tecnicas;
DROP POLICY IF EXISTS "Auth users view visitas" ON public.visitas_tecnicas;
DROP POLICY IF EXISTS "Auth users create visitas" ON public.visitas_tecnicas;
DROP POLICY IF EXISTS "Admin delete visitas" ON public.visitas_tecnicas;

CREATE POLICY "visitas_select" ON public.visitas_tecnicas
  FOR SELECT TO authenticated
  USING (
    tecnico_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.cargo IN ('admin','comercial'))
  );

CREATE POLICY "visitas_insert" ON public.visitas_tecnicas
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "visitas_update" ON public.visitas_tecnicas
  FOR UPDATE TO authenticated
  USING (
    tecnico_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.cargo IN ('admin','comercial'))
  );

CREATE POLICY "visitas_delete" ON public.visitas_tecnicas
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- RLS profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
