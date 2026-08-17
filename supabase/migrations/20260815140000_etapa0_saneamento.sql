-- ETAPA 0 do sistema de Ordens de Serviço — Saneamento e fundações.
-- Referência: docs/SISTEMA_OS.md §8. Corrige as fraquezas do app atual antes
-- de qualquer tabela de OS se apoiar nelas.
--
-- >>> RODAR NO SQL EDITOR DA LOVABLE (Cloud → SQL editor). Idempotente. <<<
-- >>> Conferir o resultado do SELECT final: todas as linhas devem bater  <<<
-- >>> com o "esperado" descrito ao lado de cada verificação.             <<<
--
-- ANTES DE RODAR, execute os dois pré-voos (o repo pode divergir do banco):
--
--   -- 1) os nomes de policy que esta migration substitui existem mesmo?
--   SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies
--   WHERE schemaname='public'
--     AND tablename IN ('visita_blocos','visita_bloco_itens','visita_orcamentos',
--                       'fotos_visita','profiles','user_roles')
--   ORDER BY tablename, policyname;
--
--   -- 2) quem hoje usa papel herdado sem cargo definido? (perde acesso de
--   --    gestor na interface; defina o cargo dessas pessoas ANTES de rodar)
--   SELECT p.email, p.nome, p.cargo, p.status, p.ativo,
--          string_agg(ur.role::text, ',') AS roles_hoje
--   FROM public.profiles p
--   LEFT JOIN public.user_roles ur ON ur.user_id = p.id
--   GROUP BY p.id, p.email, p.nome, p.cargo, p.status, p.ativo
--   ORDER BY (p.cargo IS NULL) DESC, p.cargo;
--
-- O que esta migration faz:
--   1) Papéis: user_roles vira a fonte de verdade; profiles.cargo é espelho
--      sincronizado por trigger. Fecha a brecha de auto-promoção a admin.
--   2) Notificações: passam a nascer de triggers SECURITY DEFINER (os inserts
--      client-side para outros usuários eram bloqueados pela RLS e falhavam
--      em silêncio).
--   3) Status legados: 'aprovado'/'reprovado' (masculino) normalizados.
--   4) RLS: tabelas do orçamento deixam de aceitar qualquer autenticado.

-- ═══════════════════════════════════════════════════════════════════════
-- 1) PAPÉIS
-- ═══════════════════════════════════════════════════════════════════════

-- 1a) Helper: "é gestor?" (admin ou comercial). SECURITY DEFINER para poder
--     ser usado dentro de policies sem recursão de RLS.
CREATE OR REPLACE FUNCTION public.is_gestor(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role IN ('admin', 'comercial')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = _user_id AND cargo IN ('admin', 'comercial')
    ),
    false
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_gestor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_gestor(uuid) TO authenticated, service_role;

-- 1b) Helper: "posso acessar esta visita?" (técnico responsável ou gestor).
CREATE OR REPLACE FUNCTION public.pode_acessar_visita(_visita_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    public.is_gestor(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.visitas_tecnicas v
      WHERE v.id = _visita_id AND v.tecnico_id = auth.uid()
    ),
    false
  );
$$;
REVOKE EXECUTE ON FUNCTION public.pode_acessar_visita(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_acessar_visita(uuid) TO authenticated, service_role;

-- 1c) Backfill: user_roles passa a refletir profiles.cargo.
--     (Antes: quem foi aprovado pela tela de usuários ficava sem role, e todo
--      usuário novo ganhava 'comercial' automaticamente — inclusive pendentes.)
--     Aborta se a reconciliação deixaria o sistema sem administrador ativo.
DO $$
DECLARE
  v_admins int;
  v_perdem_admin int;
BEGIN
  -- perfis antigos sem status (coluna criada depois deles)
  UPDATE public.profiles SET status = 'ativo'
  WHERE status IS NULL AND cargo IS NOT NULL;

  -- preserva quem é admin APENAS em user_roles (cargo nulo): o cargo assume o
  -- papel, em vez de o papel ser apagado por não ter cargo correspondente
  UPDATE public.profiles p
  SET cargo = 'admin'
  WHERE p.cargo IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.role = 'admin'
    );

  -- trava de segurança: ninguém pode perder a role de admin por divergência
  -- de cargo sem revisão humana (ex.: role='admin' com cargo='tecnico')
  SELECT count(*) INTO v_perdem_admin
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role = 'admin' AND p.cargo IS DISTINCT FROM 'admin';

  IF v_perdem_admin > 0 THEN
    RAISE EXCEPTION
      'Abortado: % usuario(s) perderiam a role de admin por divergencia com o cargo. Revise (SELECT ... FROM user_roles JOIN profiles) e acerte o cargo antes de rodar. Nada foi alterado.',
      v_perdem_admin;
  END IF;

  -- remove roles órfãs (sem perfil correspondente)
  DELETE FROM public.user_roles ur
  WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = ur.user_id);

  -- remove roles que não correspondem ao cargo atual do perfil
  DELETE FROM public.user_roles ur
  USING public.profiles p
  WHERE ur.user_id = p.id
    AND (p.cargo IS NULL OR ur.role::text IS DISTINCT FROM p.cargo);

  -- cria a role que falta para quem tem cargo definido
  INSERT INTO public.user_roles (user_id, role)
  SELECT p.id, p.cargo::public.app_role
  FROM public.profiles p
  WHERE p.cargo IN ('admin', 'comercial', 'tecnico')
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.role::text = p.cargo
    )
  ON CONFLICT DO NOTHING;

  SELECT count(*) INTO v_admins
  FROM public.profiles
  WHERE cargo = 'admin' AND ativo IS DISTINCT FROM false;

  IF v_admins = 0 THEN
    RAISE EXCEPTION
      'Abortado: a reconciliação de papéis deixaria o sistema sem administrador ativo. Nada foi alterado.';
  END IF;
END $$;

-- 1d) Sincronização contínua: profiles.cargo → user_roles.
CREATE OR REPLACE FUNCTION public.sync_user_role_from_cargo()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.cargo IS NOT DISTINCT FROM OLD.cargo THEN
    RETURN NEW;
  END IF;
  DELETE FROM public.user_roles WHERE user_id = NEW.id;
  IF NEW.cargo IN ('admin', 'comercial', 'tecnico') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, NEW.cargo::public.app_role)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_user_role ON public.profiles;
CREATE TRIGGER trg_sync_user_role
  AFTER INSERT OR UPDATE OF cargo ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_role_from_cargo();

-- 1e) GUARD — fecha a brecha de auto-promoção: só admin altera cargo, status
--     ou ativo. Contexto de servidor (auth.uid() nulo: service role, triggers,
--     server functions) continua liberado.
CREATE OR REPLACE FUNCTION public.guard_profiles_privilegios()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- criar o próprio perfil já vindo com cargo seria auto-promoção
    IF NEW.cargo IS NOT NULL THEN
      RAISE EXCEPTION 'Somente administradores podem definir o cargo de um perfil.'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.cargo IS DISTINCT FROM OLD.cargo
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.ativo IS DISTINCT FROM OLD.ativo THEN
    RAISE EXCEPTION
      'Somente administradores podem alterar cargo, status ou ativação de um perfil.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profiles_privilegios ON public.profiles;
CREATE TRIGGER trg_guard_profiles_privilegios
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profiles_privilegios();

-- 1f) Novo usuário: o BANCO define o estado inicial (o app não envia mais
--     cargo/status). Convidado por admin (cargo nos metadados) entra ativo;
--     auto-cadastro entra pendente de aprovação e SEM role.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cargo text;
BEGIN
  v_cargo := NULLIF(NEW.raw_user_meta_data->>'cargo', '');
  IF v_cargo NOT IN ('admin', 'comercial', 'tecnico') THEN
    v_cargo := NULL;
  END IF;

  INSERT INTO public.profiles (id, nome, email, cargo, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    v_cargo,
    CASE WHEN v_cargo IS NULL THEN 'pendente_aprovacao' ELSE 'ativo' END
  )
  ON CONFLICT (id) DO NOTHING;
  -- user_roles é criado por trg_sync_user_role a partir do cargo
  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- 2) NOTIFICAÇÕES — triggers no lugar dos inserts client-side
-- ═══════════════════════════════════════════════════════════════════════
-- A policy notif_insert_own (WITH CHECK user_id = auth.uid()) bloqueia insert
-- para outro usuário: os avisos de "aguardando aprovação" (→ gestores) e
-- "aprovada/reprovada" (→ técnico) nunca chegavam. Trigger SECURITY DEFINER
-- roda como dono da função e passa pela RLS.

CREATE OR REPLACE FUNCTION public.notify_visita_status()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_nome text;
  v_novo text;
  v_ant  text;
BEGIN
  v_novo := lower(COALESCE(NEW.status, ''));
  v_ant  := lower(COALESCE(OLD.status, ''));
  IF v_novo = v_ant THEN
    RETURN NEW;
  END IF;
  v_nome := COALESCE(NEW.nome_predio, NEW.titulo, 'local não informado');

  IF v_novo = 'aguardando_aprovacao' THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, visita_id)
    SELECT p.id,
           'visita_aguardando_aprovacao',
           'Visita aguardando aprovação',
           'A visita técnica em ' || v_nome || ' foi concluída e aguarda sua aprovação.',
           NEW.id
    FROM public.profiles p
    WHERE p.cargo IN ('admin', 'comercial')
      AND p.ativo IS DISTINCT FROM false
      AND p.status IS DISTINCT FROM 'rejeitado'
      AND p.status IS DISTINCT FROM 'pendente_aprovacao';

  ELSIF v_novo IN ('aprovada', 'aprovado') AND NEW.tecnico_id IS NOT NULL THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, visita_id)
    VALUES (NEW.tecnico_id, 'visita_aprovada', 'Visita aprovada',
            'Sua visita técnica em ' || v_nome || ' foi aprovada!', NEW.id);

  ELSIF v_novo IN ('reprovada', 'reprovado') AND NEW.tecnico_id IS NOT NULL THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, visita_id)
    VALUES (NEW.tecnico_id, 'visita_reprovada', 'Visita reprovada',
            'A visita técnica em ' || v_nome || ' foi reprovada. Verifique o agendamento.',
            NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

-- substitui o trigger antigo (que só cobria 'aprovada') — evita duplicidade
DROP TRIGGER IF EXISTS trg_notify_visita_aprovada ON public.visitas_tecnicas;
DROP TRIGGER IF EXISTS trg_notify_visita_status ON public.visitas_tecnicas;

-- ═══════════════════════════════════════════════════════════════════════
-- 3) STATUS LEGADOS — 'aprovado'/'reprovado' não são reconhecidos pelo app
-- ═══════════════════════════════════════════════════════════════════════
-- ATENÇÃO À ORDEM: estes UPDATEs ficam entre os DROPs e o CREATE do trigger.
-- Com qualquer trigger de notificação ativo, normalizar o histórico dispararia
-- "sua visita foi aprovada/reprovada" para os técnicos — em tempo real, para
-- todas as visitas antigas de uma vez.
UPDATE public.visitas_tecnicas SET status = 'aprovada'  WHERE lower(status) = 'aprovado';
UPDATE public.visitas_tecnicas SET status = 'reprovada' WHERE lower(status) = 'reprovado';

-- agora sim, com o histórico já normalizado, liga o trigger novo
CREATE TRIGGER trg_notify_visita_status
  AFTER UPDATE OF status ON public.visitas_tecnicas
  FOR EACH ROW EXECUTE FUNCTION public.notify_visita_status();

-- ═══════════════════════════════════════════════════════════════════════
-- 4) RLS — orçamento deixa de ser aberto a qualquer autenticado
-- ═══════════════════════════════════════════════════════════════════════
-- Regra: técnico responsável pela visita OU gestor (admin/comercial).

-- visita_orcamentos
DROP POLICY IF EXISTS "Auth users view orcamentos"   ON public.visita_orcamentos;
DROP POLICY IF EXISTS "Auth users insert orcamentos" ON public.visita_orcamentos;
DROP POLICY IF EXISTS "Auth users update orcamentos" ON public.visita_orcamentos;
DROP POLICY IF EXISTS "Admin delete orcamentos"      ON public.visita_orcamentos;
DROP POLICY IF EXISTS "orcamentos_escopo_visita"     ON public.visita_orcamentos;
CREATE POLICY "orcamentos_escopo_visita" ON public.visita_orcamentos
  FOR ALL TO authenticated
  USING (public.pode_acessar_visita(visita_id))
  WITH CHECK (public.pode_acessar_visita(visita_id));

-- visita_blocos
DROP POLICY IF EXISTS "Authenticated users can manage visita_blocos" ON public.visita_blocos;
DROP POLICY IF EXISTS "blocos_escopo_visita" ON public.visita_blocos;
CREATE POLICY "blocos_escopo_visita" ON public.visita_blocos
  FOR ALL TO authenticated
  USING (public.pode_acessar_visita(visita_id))
  WITH CHECK (public.pode_acessar_visita(visita_id));

-- visita_bloco_itens (escopo herdado do bloco)
DROP POLICY IF EXISTS "Authenticated manage visita_bloco_itens" ON public.visita_bloco_itens;
DROP POLICY IF EXISTS "itens_escopo_visita" ON public.visita_bloco_itens;
CREATE POLICY "itens_escopo_visita" ON public.visita_bloco_itens
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.visita_blocos b
      WHERE b.id = visita_bloco_id AND public.pode_acessar_visita(b.visita_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.visita_blocos b
      WHERE b.id = visita_bloco_id AND public.pode_acessar_visita(b.visita_id)
    )
  );

-- fotos_visita (mesmo escopo; DELETE segue restrito a autor ou admin)
DROP POLICY IF EXISTS "Auth view fotos"   ON public.fotos_visita;
DROP POLICY IF EXISTS "Auth insert fotos" ON public.fotos_visita;
DROP POLICY IF EXISTS "fotos_escopo_visita_select" ON public.fotos_visita;
DROP POLICY IF EXISTS "fotos_escopo_visita_insert" ON public.fotos_visita;
CREATE POLICY "fotos_escopo_visita_select" ON public.fotos_visita
  FOR SELECT TO authenticated
  USING (public.pode_acessar_visita(visita_id));
CREATE POLICY "fotos_escopo_visita_insert" ON public.fotos_visita
  FOR INSERT TO authenticated
  WITH CHECK (public.pode_acessar_visita(visita_id) AND created_by = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO FINAL (o SQL editor mostra só o último resultado)
-- ═══════════════════════════════════════════════════════════════════════
SELECT 'perfis com cargo sem role correspondente' AS verificacao,
       count(*)::text AS resultado, '0' AS esperado
FROM public.profiles p
WHERE p.cargo IN ('admin','comercial','tecnico')
  AND NOT EXISTS (SELECT 1 FROM public.user_roles ur
                  WHERE ur.user_id = p.id AND ur.role::text = p.cargo)
UNION ALL
SELECT 'roles orfas ou divergentes do cargo',
       count(*)::text, '0'
FROM public.user_roles ur
LEFT JOIN public.profiles p ON p.id = ur.user_id
WHERE p.id IS NULL OR p.cargo IS NULL OR ur.role::text IS DISTINCT FROM p.cargo
UNION ALL
SELECT 'visitas com status legado (aprovado/reprovado)',
       count(*)::text, '0'
FROM public.visitas_tecnicas
WHERE lower(status) IN ('aprovado','reprovado')
UNION ALL
SELECT 'status distintos em uso (informativo)',
       string_agg(DISTINCT status, ', ' ORDER BY status),
       'nenhum valor fora da lista conhecida'
FROM public.visitas_tecnicas
UNION ALL
SELECT 'triggers de saneamento instalados',
       count(*)::text, '4'
FROM pg_trigger
WHERE NOT tgisinternal
  AND tgname IN ('trg_sync_user_role','trg_guard_profiles_privilegios',
                 'trg_notify_visita_status','trg_notify_visita_atribuida_ins')
UNION ALL
SELECT 'policies ainda abertas a qualquer autenticado',
       count(*)::text, '0'
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('visita_blocos','visita_bloco_itens','visita_orcamentos','fotos_visita')
  AND (qual = 'true' OR with_check = 'true')
UNION ALL
SELECT 'funcoes helper instaladas (is_gestor, pode_acessar_visita)',
       count(*)::text, '2'
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('is_gestor', 'pode_acessar_visita')
UNION ALL
SELECT 'handle_new_user define o estado inicial',
       CASE WHEN prosrc LIKE '%pendente_aprovacao%' THEN 'sim' ELSE 'NAO' END, 'sim'
FROM pg_proc WHERE proname = 'handle_new_user'
UNION ALL
SELECT 'admins ativos (precisa ser >= 1)',
       count(*)::text, '>= 1'
FROM public.profiles p
WHERE p.cargo = 'admin' AND p.ativo IS DISTINCT FROM false;
