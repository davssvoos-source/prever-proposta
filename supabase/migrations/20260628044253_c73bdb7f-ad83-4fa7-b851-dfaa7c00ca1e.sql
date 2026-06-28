
-- ============ ENUMS & ROLES ============
CREATE TYPE public.app_role AS ENUM ('admin','comercial','tecnico');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles self read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Trigger: create profile + assign default role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email,'@',1)), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'comercial')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ CATÁLOGOS ============
CREATE TABLE public.blocos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  layer int NOT NULL,
  hh numeric NOT NULL DEFAULT 0,
  descricao text,
  obs text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.blocos TO authenticated;
GRANT ALL ON public.blocos TO service_role;
ALTER TABLE public.blocos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocos read all auth" ON public.blocos FOR SELECT TO authenticated USING (true);
CREATE POLICY "blocos admin write" ON public.blocos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.equipamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  nome text NOT NULL,
  cat text,
  subcat text,
  marca text,
  modelo text UNIQUE NOT NULL,
  un text NOT NULL DEFAULT 'un',
  custo numeric NOT NULL DEFAULT 0,
  markup numeric NOT NULL DEFAULT 1.389,
  fornecedor text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.equipamentos TO authenticated;
GRANT ALL ON public.equipamentos TO service_role;
ALTER TABLE public.equipamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equip read all auth" ON public.equipamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "equip admin write" ON public.equipamentos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.blocos_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bloco_id uuid NOT NULL REFERENCES public.blocos(id) ON DELETE CASCADE,
  seq int NOT NULL DEFAULT 1,
  nome text NOT NULL,
  marca text,
  modelo text NOT NULL,
  qty int NOT NULL DEFAULT 0,
  variavel boolean NOT NULL DEFAULT false
);
GRANT SELECT ON public.blocos_itens TO authenticated;
GRANT ALL ON public.blocos_itens TO service_role;
ALTER TABLE public.blocos_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocos_itens read all auth" ON public.blocos_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "blocos_itens admin write" ON public.blocos_itens FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX blocos_itens_bloco_idx ON public.blocos_itens(bloco_id);

CREATE TABLE public.servicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  nome text NOT NULL,
  cat text,
  preco_unitario_mensal numeric NOT NULL DEFAULT 0,
  ativo_padrao boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.servicos TO authenticated;
GRANT ALL ON public.servicos TO service_role;
ALTER TABLE public.servicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "servicos read all auth" ON public.servicos FOR SELECT TO authenticated USING (true);
CREATE POLICY "servicos admin write" ON public.servicos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ CLIENTES E PROJETOS ============
CREATE TABLE public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo_empreendimento text CHECK (tipo_empreendimento IN ('condominio','empresa','hospital','shopping','outro')),
  email text,
  telefone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clientes owner or admin select" ON public.clientes FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "clientes owner insert" ON public.clientes FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "clientes owner update" ON public.clientes FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "clientes owner delete" ON public.clientes FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.projetos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  nome text NOT NULL,
  data_visita date,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','enviado','aprovado','perdido')),
  tipo_contrato text NOT NULL DEFAULT 'implantacao' CHECK (tipo_contrato IN ('implantacao','aproveitamento','manutencao')),
  fornecimento boolean NOT NULL DEFAULT true,
  valor_hora_hh numeric NOT NULL DEFAULT 120,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projetos TO authenticated;
GRANT ALL ON public.projetos TO service_role;
ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projetos owner or admin select" ON public.projetos FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "projetos owner insert" ON public.projetos FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "projetos owner update" ON public.projetos FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "projetos owner delete" ON public.projetos FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER projetos_updated BEFORE UPDATE ON public.projetos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.projeto_blocos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  bloco_id uuid NOT NULL REFERENCES public.blocos(id),
  ativo boolean NOT NULL DEFAULT false,
  quantidade int NOT NULL DEFAULT 0,
  UNIQUE(projeto_id, bloco_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_blocos TO authenticated;
GRANT ALL ON public.projeto_blocos TO service_role;
ALTER TABLE public.projeto_blocos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pb owner select" ON public.projeto_blocos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_id AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "pb owner write" ON public.projeto_blocos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_id AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_id AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

CREATE TABLE public.projeto_itens_variaveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  bloco_item_id uuid NOT NULL REFERENCES public.blocos_itens(id) ON DELETE CASCADE,
  quantidade int NOT NULL DEFAULT 0,
  UNIQUE(projeto_id, bloco_item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_itens_variaveis TO authenticated;
GRANT ALL ON public.projeto_itens_variaveis TO service_role;
ALTER TABLE public.projeto_itens_variaveis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "piv owner all" ON public.projeto_itens_variaveis FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_id AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_id AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

CREATE TABLE public.projeto_servicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  servico_id uuid NOT NULL REFERENCES public.servicos(id),
  ativo boolean NOT NULL DEFAULT false,
  quantidade int NOT NULL DEFAULT 0,
  UNIQUE(projeto_id, servico_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_servicos TO authenticated;
GRANT ALL ON public.projeto_servicos TO service_role;
ALTER TABLE public.projeto_servicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps owner all" ON public.projeto_servicos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_id AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_id AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));
