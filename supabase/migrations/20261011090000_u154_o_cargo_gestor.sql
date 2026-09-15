-- ═══════════════════════════════════════════════════════════════════════════
-- U154 — o cargo GESTOR (R304) — 2026-09-15
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Davi, 15/09/2026: "Não me lembro se mencionei isso, mas acho que ficou
-- explícito. Vou criar um novo cargo chamado Gestor, que atualmente o Vinicius
-- quem faz este papel."
--
-- É o molde da U127 (o operacional): um cargo novo entra em TODOS os lugares
-- que enumeram cargos, de uma vez, senão o app se comporta de um jeito antes
-- da migration e de outro depois. Aqui são SETE, porque o gestor — ao
-- contrário do operacional — É gestor e VÊ valores:
--
-- §1  o enum `app_role` ganha 'gestor' (FORA da transação: valor novo de enum
--     não pode ser usado na mesma transação em que nasce — a forma da U6a/U127);
-- §2  o CHECK de `profiles.cargo` aceita 'gestor';
-- §3  o CHECK de `permissoes_tela.cargo` aceita 'gestor', e `salvar_permissoes`
--     (U11) deixa o admin gravar a coluna dele;
-- §4  `handle_new_user` reconhece o cargo vindo do convite;
-- §5  `is_gestor` inclui 'gestor' — é o que abre as portas de coordenação nas
--     policies (programar, escalar, fechar);
-- §6  `pode_ver_financeiro` inclui 'gestor' — é ele quem lança a cobrança do
--     chamado (R125/R300), e quem lança tem de ver o número; como Admin o
--     Vinicius sempre viu;
-- §7  a SEMENTE da matriz: onze portas abertas (Início, Calendário, Gestão
--     Técnica, abrir chamado, criar atividade, programação, Operacional
--     Técnica, Clientes, Fechamentos, Perfil, Equipamentos), seis fechadas
--     (Administrativo, Comercial e Nova visita, Contratos, e as duas telas
--     desativadas de cliente). Uma linha por tela do catálogo — paridade
--     catálogo ↔ semente (U11). ON CONFLICT DO NOTHING: a mão do admin vale.
--
-- O que NÃO muda: quem convida, aprova e altera permissões continua exigindo
-- cargo = 'admin' (enviarConvite, aprovar, salvar_permissoes). E as funções
-- que decidem QUEM É AVISADO (U7, U13: chamado sem dono, prazo) enumeram
-- admin/comercial/sac à mão e NÃO ganham o gestor aqui — está dito na R304 e
-- listado em ESTADO_ATUAL como pendência; enquanto o Vinicius for Admin não
-- muda nada.
--
-- A TROCA DO VINICIUS de Admin para Gestor NÃO está aqui: é gesto do Davi na
-- aba Usuários (editar cargo) depois desta rodar — o cargo é dele para mudar,
-- e uma migration não sabe o e-mail de ninguém.
--
-- >>> RODAR NO SQL EDITOR DO SUPABASE, À MÃO. ORDEM: depois da U153 (a semente
-- >>> abaixo já não traz `chamados.painel`). Idempotente: ADD VALUE IF NOT
-- >>> EXISTS, DROP/ADD dos CHECKs por nome, CREATE OR REPLACE nas funções, seed
-- >>> com ON CONFLICT DO NOTHING. Conferência e DESFAZER no fim.
-- >>> ORDEM DE DEPLOY DO CÓDIGO: o app já aceita 'gestor' nos tipos e na
-- >>> matriz; sem esta migration ninguém consegue RECEBER o cargo (o CHECK
-- >>> recusa) — nada quebra, só não existe gestor ainda.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── §1  O ENUM (fora da transação, como na U6a/U127) ────────────────────────
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gestor';

BEGIN;

DO $u154pre$
BEGIN
  IF to_regclass('public.permissoes_tela') IS NULL THEN
    RAISE EXCEPTION 'U154: permissoes_tela não existe — rode a U11 primeiro.';
  END IF;
  IF to_regprocedure('public.salvar_permissoes(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'U154: salvar_permissoes não existe — rode a U11 primeiro.';
  END IF;
  IF to_regprocedure('public.handle_new_user()') IS NULL THEN
    RAISE EXCEPTION 'U154: handle_new_user não existe — rode a U6a primeiro.';
  END IF;
  IF to_regprocedure('public.is_gestor(uuid)') IS NULL
     OR to_regprocedure('public.pode_ver_financeiro(uuid)') IS NULL THEN
    RAISE EXCEPTION 'U154: is_gestor/pode_ver_financeiro não existem — rode a U6a primeiro.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                  WHERE t.typname = 'app_role' AND e.enumlabel = 'operacional') THEN
    RAISE EXCEPTION 'U154: o enum não tem operacional — rode a U127 primeiro.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.permissoes_tela WHERE tela = 'chamados.painel') THEN
    RAISE EXCEPTION 'U154: a matriz ainda tem chamados.painel — rode a U153 primeiro.';
  END IF;
END
$u154pre$;

-- ── §2  profiles.cargo aceita o cargo novo ──────────────────────────────────
DO $u154chk$
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
    CHECK (cargo IS NULL OR cargo IN ('admin', 'comercial', 'sac', 'tecnico', 'operacional', 'gestor'));
END
$u154chk$;

-- ── §3  a matriz de telas conhece o cargo ───────────────────────────────────
ALTER TABLE public.permissoes_tela DROP CONSTRAINT IF EXISTS permissoes_tela_cargo_check;
ALTER TABLE public.permissoes_tela ADD CONSTRAINT permissoes_tela_cargo_check
  CHECK (cargo IN ('tecnico', 'comercial', 'sac', 'operacional', 'gestor'));

CREATE OR REPLACE FUNCTION public.salvar_permissoes(_linhas jsonb)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $u154sp$
DECLARE v_n int := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles p
                 WHERE p.id = auth.uid() AND p.cargo = 'admin') THEN
    RAISE EXCEPTION 'Somente administrador altera permissões.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.permissoes_tela (tela, cargo, permitido, atualizado_em, atualizado_por)
  SELECT x.tela, x.cargo, x.permitido, now(), auth.uid()
  FROM jsonb_to_recordset(_linhas) AS x(tela text, cargo text, permitido boolean)
  -- R304: o gestor entra na lista — sem isto a tela de Permissões "salvaria"
  -- a coluna dele e o banco descartaria em silêncio (a lição da U127)
  WHERE x.cargo IN ('tecnico', 'comercial', 'sac', 'operacional', 'gestor')
  ON CONFLICT (tela, cargo) DO UPDATE
    SET permitido = EXCLUDED.permitido,
        atualizado_em = now(),
        atualizado_por = auth.uid();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$u154sp$;

REVOKE EXECUTE ON FUNCTION public.salvar_permissoes(jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.salvar_permissoes(jsonb) TO authenticated, service_role;

-- ── §4  o cadastro reconhece o cargo do convite ─────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $u154hnu$
DECLARE
  v_cargo text;
BEGIN
  v_cargo := NULLIF(NEW.raw_user_meta_data->>'cargo', '');
  -- R304: 'gestor' entra na lista dos cargos que um convite pode trazer
  IF v_cargo NOT IN ('admin', 'comercial', 'sac', 'tecnico', 'operacional', 'gestor') THEN
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
$u154hnu$;

-- ── §5  o gestor É gestor ───────────────────────────────────────────────────
-- Mesmo corpo da U6a, com o cargo novo nas duas listas (papel e cargo): as
-- policies de coordenação (programar, escalar, fechar, cobrar) leem esta
-- função em 164 lugares — mudou aqui, mudou em todo lugar.
CREATE OR REPLACE FUNCTION public.is_gestor(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role::text IN ('admin', 'comercial', 'sac', 'gestor')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = _user_id AND cargo IN ('admin', 'comercial', 'sac', 'gestor')
    ),
    false
  );
$$;
COMMENT ON FUNCTION public.is_gestor(uuid) IS
  'Quem coordena: admin, comercial, SAC e GESTOR (R304, U154). O operacional vê tudo mas não manda (R244); o técnico nunca.';

-- ── §6  o gestor VÊ valores ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pode_ver_financeiro(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role::text IN ('admin', 'comercial', 'gestor')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = _user_id AND cargo IN ('admin', 'comercial', 'gestor')
    ),
    false
  );
$$;
COMMENT ON FUNCTION public.pode_ver_financeiro(uuid) IS
  'Quem enxerga valores, cobranças e fechamentos: admin, comercial e GESTOR (R304 — é ele quem lança a cobrança do chamado). O SAC é gestor mas NÃO vê valores (R13). Técnico e operacional nunca.';

-- ── §7  A SEMENTE: as portas do gestor, e as outras fechadas ────────────────
-- Uma linha por tela do catálogo (src/lib/telas.ts, sem `chamados.painel`
-- desde a U153) — paridade catálogo ↔ semente. DO NOTHING: se o admin já tiver
-- mexido na coluna, a mão dele vale.
INSERT INTO public.permissoes_tela (tela, cargo, permitido) VALUES
  -- as onze portas
  ('dashboard',             'gestor', true),
  ('calendario',            'gestor', true),
  ('sobreaviso',            'gestor', true),   -- a Gestão Técnica (R299): a chave ficou
  ('chamados.novo',         'gestor', true),
  ('atividades.nova',       'gestor', true),
  ('chamados.programacao',  'gestor', true),
  ('painel.operacional',    'gestor', true),
  ('clientes',              'gestor', true),
  ('fechamentos',           'gestor', true),
  ('perfil',                'gestor', true),
  ('equipamentos',          'gestor', true),
  -- o resto fecha
  ('painel.administrativo', 'gestor', false),
  ('gerencial',             'gestor', false),
  ('gerencial.nova',        'gestor', false),
  ('clientes.novo',         'gestor', false),
  ('clientes.migrar',       'gestor', false),
  ('contratos',             'gestor', false)
ON CONFLICT (tela, cargo) DO NOTHING;

COMMIT;

-- ── CONFERÊNCIA (obtido × esperado × veredito) ──────────────────────────────
WITH conferencia AS (
  SELECT 'R304: o enum app_role tem gestor' AS item,
         (SELECT count(*)::text FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
           WHERE t.typname = 'app_role' AND e.enumlabel = 'gestor') AS obtido,
         '1' AS esperado
  UNION ALL
  SELECT 'R304: o CHECK de profiles.cargo aceita gestor',
         (SELECT count(*)::text FROM pg_constraint
           WHERE conrelid = 'public.profiles'::regclass AND conname = 'profiles_cargo_check'
             AND pg_get_constraintdef(oid) LIKE '%gestor%'), '1'
  UNION ALL
  SELECT 'R304: o CHECK de permissoes_tela.cargo aceita gestor',
         (SELECT count(*)::text FROM pg_constraint
           WHERE conrelid = 'public.permissoes_tela'::regclass AND conname = 'permissoes_tela_cargo_check'
             AND pg_get_constraintdef(oid) LIKE '%gestor%'), '1'
  UNION ALL
  SELECT 'R304: salvar_permissoes grava linhas do gestor',
         (pg_get_functiondef('public.salvar_permissoes(jsonb)'::regprocedure) LIKE '%''gestor''%')::text, 'true'
  UNION ALL
  SELECT 'R304: handle_new_user reconhece o cargo do convite',
         (pg_get_functiondef('public.handle_new_user()'::regprocedure) LIKE '%''gestor''%')::text, 'true'
  UNION ALL
  SELECT 'R304: is_gestor inclui o gestor',
         (pg_get_functiondef('public.is_gestor(uuid)'::regprocedure) LIKE '%''gestor''%')::text, 'true'
  UNION ALL
  SELECT 'R304: pode_ver_financeiro inclui o gestor',
         (pg_get_functiondef('public.pode_ver_financeiro(uuid)'::regprocedure) LIKE '%''gestor''%')::text, 'true'
  UNION ALL
  SELECT 'R304: a semente tem UMA linha por tela do catálogo (17 telas)',
         (SELECT count(*)::text FROM public.permissoes_tela WHERE cargo = 'gestor'), '17'
  UNION ALL
  SELECT 'R304: as onze portas abertas',
         (SELECT string_agg(tela, ',' ORDER BY tela) FROM public.permissoes_tela
           WHERE cargo = 'gestor' AND permitido),
         'atividades.nova,calendario,chamados.novo,chamados.programacao,clientes,dashboard,equipamentos,fechamentos,painel.operacional,perfil,sobreaviso'
  UNION ALL
  SELECT 'operacional NÃO virou gestor por tabela (is_gestor continua sem ele)',
         (pg_get_functiondef('public.is_gestor(uuid)'::regprocedure) LIKE '%operacional%')::text, 'false'
)
SELECT item, obtido, esperado,
       CASE WHEN obtido IS NOT DISTINCT FROM esperado THEN 'ok' ELSE '>>> OLHAR <<<' END AS veredito
  FROM conferencia;

-- ── DEPOIS DE RODAR (o Davi, na tela) ───────────────────────────────────────
-- Administrativo → Usuários → Vinicius → editar → cargo "Gestor". A tela grava
-- em profiles.cargo; o gatilho trg_sync_user_role acerta user_roles. Nenhum
-- UPDATE aqui de propósito: a migration não conhece o e-mail de ninguém.

-- ── DESFAZER ────────────────────────────────────────────────────────────────
-- ║ Um valor de enum NÃO se remove (limitação do Postgres) — 'gestor' fica no
-- ║ tipo, inofensivo, se ninguém o tiver. Antes de desfazer, ninguém pode
-- ║ estar com cargo = 'gestor' (o CHECK novo recusaria):
-- ║   UPDATE public.profiles SET cargo = 'admin' WHERE cargo = 'gestor';
-- ║ Depois:
-- ║   DELETE FROM public.permissoes_tela WHERE cargo = 'gestor';
-- ║   ALTER TABLE public.permissoes_tela DROP CONSTRAINT IF EXISTS permissoes_tela_cargo_check;
-- ║   ALTER TABLE public.permissoes_tela ADD CONSTRAINT permissoes_tela_cargo_check
-- ║     CHECK (cargo IN ('tecnico', 'comercial', 'sac', 'operacional'));
-- ║   ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_cargo_check;
-- ║   ALTER TABLE public.profiles ADD CONSTRAINT profiles_cargo_check
-- ║     CHECK (cargo IS NULL OR cargo IN ('admin', 'comercial', 'sac', 'tecnico', 'operacional'));
-- ║ E as quatro funções voltam aos corpos anteriores: salvar_permissoes e
-- ║ handle_new_user aos da U127 (20260926090000_u127_v009_perfil_operacional.sql
-- ║ §3 e §4); is_gestor e pode_ver_financeiro aos da U6a
-- ║ (20260818230000_u6a_papel_sac.sql) — só sem 'gestor' nas listas.
