-- ETAPA U6a da unificação — Papel SAC.
-- Referência: docs/PRODUTO.md §2 (R1, R13) e docs/PLANO_UNIFICACAO.md §10.
--
-- >>> RODAR NO SQL EDITOR DA LOVABLE (Cloud → SQL editor). Idempotente. <<<
-- >>> Conferir o SELECT final: cada linha traz o valor esperado ao lado. <<<
--
-- O SAC é GESTOR (coordena, abre e acompanha chamados) mas NÃO VÊ VALORES.
-- Até aqui pode_ver_financeiro() delegava para is_gestor() — era a costura
-- deixada pronta na U0 exatamente para este momento. Agora as duas réguas se
-- separam:
--
--   is_gestor()           → admin, comercial, SAC   (operação)
--   pode_ver_financeiro() → admin, comercial        (dinheiro)
--
-- ATENÇÃO à ordem DENTRO desta migration: o valor novo do enum não pode ser
-- usado na mesma transação em que foi criado (regra do Postgres 12+). Nada
-- aqui usa 'sac'::app_role — as funções guardam texto e são avaliadas depois,
-- e o CHECK de profiles.cargo é sobre coluna text.

-- ═══════════════════════════════════════════════════════════════════════
-- 1) ENUM app_role GANHA 'sac'
-- ═══════════════════════════════════════════════════════════════════════
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sac';

-- ═══════════════════════════════════════════════════════════════════════
-- 2) CHECK DE profiles.cargo ACEITA 'sac'
-- ═══════════════════════════════════════════════════════════════════════
-- O CHECK original nasceu sem nome explícito (cargo IN tecnico|comercial|admin).
-- Derruba qualquer CHECK de profiles que cite cargo e recria com nome fixo.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%cargo%'
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', c.conname);
  END LOOP;

  ALTER TABLE public.profiles ADD CONSTRAINT profiles_cargo_check
    CHECK (cargo IS NULL OR cargo IN ('admin','comercial','sac','tecnico'));
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'ha cargo fora da lista — constraint nao recriada';
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 3) is_gestor() PASSA A INCLUIR O SAC
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.is_gestor(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role::text IN ('admin', 'comercial', 'sac')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = _user_id AND cargo IN ('admin', 'comercial', 'sac')
    ),
    false
  );
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- 4) pode_ver_financeiro() DEIXA DE DELEGAR PARA is_gestor()
-- ═══════════════════════════════════════════════════════════════════════
-- É AQUI que "SAC não vê valores" se materializa: contratos, cobranças,
-- fechamentos, análise de cobrança e o bucket de contratos usam esta função
-- nas policies (U2–U5) — mudou aqui, mudou em todo lugar.
CREATE OR REPLACE FUNCTION public.pode_ver_financeiro(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role::text IN ('admin', 'comercial')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = _user_id AND cargo IN ('admin', 'comercial')
    ),
    false
  );
$$;
COMMENT ON FUNCTION public.pode_ver_financeiro(uuid) IS
  'Quem enxerga valores, cobranças e fechamentos: admin e comercial. O SAC é gestor mas NÃO vê valores (PRODUTO.md R13). Técnico nunca.';

-- ═══════════════════════════════════════════════════════════════════════
-- 5) NOVO USUÁRIO CONVIDADO COMO SAC
-- ═══════════════════════════════════════════════════════════════════════
-- handle_new_user validava o cargo dos metadados contra a lista antiga; sem
-- isto, convite de SAC entraria como pendente de aprovação e sem papel.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cargo text;
BEGIN
  v_cargo := NULLIF(NEW.raw_user_meta_data->>'cargo', '');
  IF v_cargo NOT IN ('admin', 'comercial', 'sac', 'tecnico') THEN
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
-- VERIFICAÇÃO FINAL
-- ═══════════════════════════════════════════════════════════════════════
SELECT 'enum app_role tem sac' AS verificacao,
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_enum e
         JOIN pg_type t ON t.oid = e.enumtypid
         WHERE t.typname = 'app_role' AND e.enumlabel = 'sac'
       ) THEN 'sim' ELSE 'NAO' END AS resultado, 'sim' AS esperado
UNION ALL
SELECT 'CHECK de cargo aceita sac',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_constraint
         WHERE conrelid = 'public.profiles'::regclass
           AND conname = 'profiles_cargo_check'
           AND pg_get_constraintdef(oid) LIKE '%sac%'
       ) THEN 'sim' ELSE 'NAO' END, 'sim'
UNION ALL
SELECT 'is_gestor inclui sac',
       CASE WHEN (SELECT prosrc FROM pg_proc WHERE proname = 'is_gestor')
                 LIKE '%''sac''%' THEN 'sim' ELSE 'NAO' END, 'sim'
UNION ALL
SELECT 'pode_ver_financeiro NAO inclui sac (so admin/comercial)',
       CASE WHEN (SELECT prosrc FROM pg_proc WHERE proname = 'pode_ver_financeiro')
                 NOT LIKE '%sac%'
             AND (SELECT prosrc FROM pg_proc WHERE proname = 'pode_ver_financeiro')
                 NOT LIKE '%is_gestor%'
       THEN 'sim' ELSE 'NAO' END, 'sim'
UNION ALL
SELECT 'handle_new_user aceita convite de sac',
       CASE WHEN (SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_user')
                 LIKE '%''sac''%' THEN 'sim' ELSE 'NAO' END, 'sim'
UNION ALL
SELECT 'usuarios por cargo (informativo)',
       COALESCE((SELECT string_agg(cargo || '=' || n::text, ', ' ORDER BY cargo)
                 FROM (SELECT cargo, count(*) AS n FROM public.profiles
                       WHERE cargo IS NOT NULL GROUP BY cargo) t), '(nenhum)'),
       '(admin, comercial, tecnico… sac aparece quando alguem for cadastrado)';
