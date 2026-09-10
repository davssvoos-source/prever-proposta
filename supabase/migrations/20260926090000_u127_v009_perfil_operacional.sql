-- ═══════════════════════════════════════════════════════════════════════════
-- U127 — v0.0.9: o perfil OPERACIONAL (R244)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Davi, 10/09/2026: "vamos criar um novo perfil de usuário: OPERACIONAL. O
-- perfil OPERACIONAL tem acesso a página INICIO, CALENDARIO, CLIENTES e PERFIL.
-- Na prática vou alterar o Nicholas e o Erik para o perfil OPERACIONAL. Este
-- perfil consegue visualizar todas as atividades de todos, na página INICIO. O
-- Perfil de usuário TECNICA na verdade quem usará são os técnicos de campo."
--
-- O QUE MUDA NO BANCO — cinco lugares que enumeram cargos, e um cargo novo tem
-- de entrar nos cinco de uma vez, senão o app se comporta de um jeito antes da
-- migration e de outro depois:
--
-- §1  o enum `app_role` ganha 'operacional' (FORA da transação: um valor novo
--     de enum não pode ser usado na mesma transação em que nasce — é a mesma
--     forma da U6a, que pôs 'sac');
-- §2  o CHECK de `profiles.cargo` aceita 'operacional';
-- §3  o CHECK de `permissoes_tela.cargo` aceita 'operacional', e a função
--     `salvar_permissoes` (U11) deixa o admin gravar linhas dele;
-- §4  `handle_new_user` (o gatilho do cadastro, U6a) reconhece o cargo vindo do
--     convite — sem isto um convidado como operacional entraria pendente de
--     aprovação e sem papel;
-- §5  a SEMENTE da matriz: as quatro telas do perfil em `true`, todas as outras
--     em `false` — uma linha por tela, porque o verificador exige que catálogo
--     e semente falem das mesmas telas (paridade, U11).
--
-- O que NÃO muda: `is_gestor` (operacional NÃO é gestor — vê tudo, não manda),
-- `pode_acessar_visita`, RLS nenhuma. A leitura de tudo já é de todo logado
-- (R221); o operacional herda isso sem uma linha nova.
--
-- IDEMPOTENTE: ADD VALUE IF NOT EXISTS, DROP/ADD dos CHECKs por nome, CREATE OR
-- REPLACE nas funções, seed com ON CONFLICT DO NOTHING (não pisa no que o
-- admin já tiver ajustado na tela de Permissões). Conferência e DESFAZER no fim.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── §1  O ENUM (fora da transação, como na U6a) ─────────────────────────────
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operacional';

BEGIN;

DO $u127pre$
BEGIN
  IF to_regclass('public.permissoes_tela') IS NULL THEN
    RAISE EXCEPTION 'U127: permissoes_tela não existe — rode a U11 primeiro.';
  END IF;
  IF to_regprocedure('public.salvar_permissoes(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'U127: salvar_permissoes não existe — rode a U11 primeiro.';
  END IF;
  IF to_regprocedure('public.handle_new_user()') IS NULL THEN
    RAISE EXCEPTION 'U127: handle_new_user não existe — rode a U6a primeiro.';
  END IF;
END
$u127pre$;

-- ── §2  profiles.cargo aceita o cargo novo ──────────────────────────────────
-- Derruba qualquer CHECK de profiles que cite `cargo` (o nome variou entre as
-- migrations) e recria com nome fixo — a mesma manobra da U6a.
DO $u127chk$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.profiles'::regclass AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%cargo%'
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', r.conname);
  END LOOP;
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_cargo_check
    CHECK (cargo IS NULL OR cargo IN ('admin', 'comercial', 'sac', 'tecnico', 'operacional'));
END
$u127chk$;

-- ── §3  a matriz de telas conhece o cargo ───────────────────────────────────
ALTER TABLE public.permissoes_tela DROP CONSTRAINT IF EXISTS permissoes_tela_cargo_check;
ALTER TABLE public.permissoes_tela ADD CONSTRAINT permissoes_tela_cargo_check
  CHECK (cargo IN ('tecnico', 'comercial', 'sac', 'operacional'));

CREATE OR REPLACE FUNCTION public.salvar_permissoes(_linhas jsonb)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $u127sp$
DECLARE v_n int := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles p
                 WHERE p.id = auth.uid() AND p.cargo = 'admin') THEN
    RAISE EXCEPTION 'Somente administrador altera permissões.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.permissoes_tela (tela, cargo, permitido, atualizado_em, atualizado_por)
  SELECT x.tela, x.cargo, x.permitido, now(), auth.uid()
  FROM jsonb_to_recordset(_linhas) AS x(tela text, cargo text, permitido boolean)
  -- R244: o operacional entra na lista — sem isto a tela de Permissões
  -- "salvaria" a coluna dele e o banco descartaria em silêncio
  WHERE x.cargo IN ('tecnico', 'comercial', 'sac', 'operacional')
  ON CONFLICT (tela, cargo) DO UPDATE
    SET permitido = EXCLUDED.permitido,
        atualizado_em = now(),
        atualizado_por = auth.uid();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$u127sp$;

REVOKE EXECUTE ON FUNCTION public.salvar_permissoes(jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.salvar_permissoes(jsonb) TO authenticated, service_role;

-- ── §4  o cadastro reconhece o cargo do convite ─────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $u127hnu$
DECLARE
  v_cargo text;
BEGIN
  v_cargo := NULLIF(NEW.raw_user_meta_data->>'cargo', '');
  -- R244: 'operacional' entra na lista dos cargos que um convite pode trazer
  IF v_cargo NOT IN ('admin', 'comercial', 'sac', 'tecnico', 'operacional') THEN
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
$u127hnu$;

-- ── §5  A SEMENTE: as quatro portas do operacional, e as outras fechadas ────
-- Uma linha por tela do catálogo (src/lib/telas.ts) — paridade catálogo ↔
-- semente. DO NOTHING: se o admin já tiver mexido na coluna, a mão dele vale.
INSERT INTO public.permissoes_tela (tela, cargo, permitido) VALUES
  -- as quatro portas (Davi: "INICIO, CALENDARIO, CLIENTES e PERFIL")
  ('dashboard',             'operacional', true),
  ('calendario',            'operacional', true),
  ('clientes',              'operacional', true),
  ('perfil',                'operacional', true),
  -- o resto fecha
  ('sobreaviso',            'operacional', false),
  ('chamados.novo',         'operacional', false),
  ('chamados.painel',       'operacional', false),
  ('chamados.programacao',  'operacional', false),
  ('painel.operacional',    'operacional', false),
  ('painel.administrativo', 'operacional', false),
  ('gerencial',             'operacional', false),
  ('gerencial.nova',        'operacional', false),
  ('clientes.novo',         'operacional', false),
  ('clientes.migrar',       'operacional', false),
  ('contratos',             'operacional', false),
  ('fechamentos',           'operacional', false),
  ('equipamentos',          'operacional', false)
ON CONFLICT (tela, cargo) DO NOTHING;

COMMIT;

-- ── CONFERÊNCIA (obtido × esperado × veredito) ──────────────────────────────
WITH conferencia AS (
  SELECT 'R244: o enum app_role tem operacional' AS item,
         (SELECT count(*)::text FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
           WHERE t.typname = 'app_role' AND e.enumlabel = 'operacional') AS obtido,
         '1' AS esperado
  UNION ALL
  SELECT 'R244: o CHECK de profiles.cargo aceita operacional',
         (SELECT count(*)::text FROM pg_constraint
           WHERE conrelid = 'public.profiles'::regclass AND conname = 'profiles_cargo_check'
             AND pg_get_constraintdef(oid) LIKE '%operacional%'), '1'
  UNION ALL
  SELECT 'R244: o CHECK de permissoes_tela.cargo aceita operacional',
         (SELECT count(*)::text FROM pg_constraint
           WHERE conrelid = 'public.permissoes_tela'::regclass AND conname = 'permissoes_tela_cargo_check'
             AND pg_get_constraintdef(oid) LIKE '%operacional%'), '1'
  UNION ALL
  SELECT 'R244: salvar_permissoes grava linhas do operacional',
         (pg_get_functiondef('public.salvar_permissoes(jsonb)'::regprocedure) LIKE '%''operacional''%')::text, 'true'
  UNION ALL
  SELECT 'R244: handle_new_user reconhece o cargo do convite',
         (pg_get_functiondef('public.handle_new_user()'::regprocedure) LIKE '%''operacional''%')::text, 'true'
  UNION ALL
  SELECT 'R244: a semente tem UMA linha por tela do catálogo (17 telas)',
         (SELECT count(*)::text FROM public.permissoes_tela WHERE cargo = 'operacional'), '17'
  UNION ALL
  SELECT 'R244: as quatro portas abertas — dashboard, calendario, clientes, perfil',
         (SELECT string_agg(tela, ',' ORDER BY tela) FROM public.permissoes_tela
           WHERE cargo = 'operacional' AND permitido), 'calendario,clientes,dashboard,perfil'
  UNION ALL
  SELECT 'is_gestor NÃO mudou (operacional vê, não manda)',
         (pg_get_functiondef('public.is_gestor(uuid)'::regprocedure) LIKE '%operacional%')::text, 'false'
)
SELECT item, obtido, esperado,
       CASE WHEN obtido IS NOT DISTINCT FROM esperado THEN 'ok' ELSE '>>> OLHAR <<<' END AS veredito
  FROM conferencia;

-- ── DESFAZER ────────────────────────────────────────────────────────────────
-- Antes de qualquer coisa, tirar as pessoas do cargo (o CHECK antigo recusaria
-- a linha delas):
--   UPDATE public.profiles SET cargo = 'tecnico' WHERE cargo = 'operacional';
--   DELETE FROM public.permissoes_tela WHERE cargo = 'operacional';
--   ALTER TABLE public.permissoes_tela DROP CONSTRAINT IF EXISTS permissoes_tela_cargo_check;
--   ALTER TABLE public.permissoes_tela ADD CONSTRAINT permissoes_tela_cargo_check
--     CHECK (cargo IN ('tecnico', 'comercial', 'sac'));
--   ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_cargo_check;
--   ALTER TABLE public.profiles ADD CONSTRAINT profiles_cargo_check
--     CHECK (cargo IS NULL OR cargo IN ('admin', 'comercial', 'sac', 'tecnico'));
--   -- salvar_permissoes e handle_new_user: recriar pelo texto da U11 e da U6a.
-- O valor do enum NÃO se remove (PostgreSQL não tem DROP VALUE); fica inerte.
