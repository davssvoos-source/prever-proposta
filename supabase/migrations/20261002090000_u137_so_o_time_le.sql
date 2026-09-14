-- ═══════════════════════════════════════════════════════════════════════════
-- U137 — SÓ QUEM É DO TIME LÊ (R277)
--
-- A revisão completa de 13/09/2026 achou o buraco: o botão "Criar conta" da
-- tela /auth deixava qualquer pessoa da internet virar `authenticated` no
-- Postgres. A TELA barrava — o perfil nascia `pendente_aprovacao` e a rota
-- mostrava "Aguardando aprovação" — mas a API não: as 28 policies de LEITURA
-- com `USING (true)` respondem para todo `authenticated`, e entre elas estão
-- `profiles` (nome, e-mail e telefone de todo mundo) e o catálogo de preço
-- (`equipamentos`, `servicos`, `blocos`, `blocos_itens`).
--
-- O código já fechou a porta pública (R277: a conta nasce por convite do admin,
-- como manda a R59 desde 22/08). Esta migration fecha a JANELA — inclusive para
-- as contas que já entraram por ali, e para quem for desativado daqui em diante.
--
-- O QUE MUDA, em uma frase: `USING (true)` vira `USING (eh_do_time(auth.uid()))`
-- nas 28 policies do censo. Ninguém do time perde nada — todo usuário ativo e
-- aprovado passa exatamente como passava. Quem não é do time deixa de ler.
--
-- EFEITO DE QUEBRA, e é grande: "Desativar usuário" era cosmético (gravava
-- `profiles.ativo = false` e não revogava sessão nenhuma). Depois desta
-- migration, o token de quem foi desativado continua válido e não lê mais nada.
-- Não substitui revogar a sessão — substitui o silêncio.
--
-- O QUE ESTA MIGRATION NÃO FAZ: não toca em `is_gestor()`, que continua sem
-- olhar `ativo` (dívida P51, de propósito — mexer nela muda dezenas de policies
-- de uma vez e merece entrega própria).
--
-- IDEMPOTENTE: CREATE OR REPLACE na função, DROP/CREATE em cada policy.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §0  PRÉ-VOO ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'U137 PRÉ-VOO: `profiles` não existe — este não é o banco do Prever.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'status') THEN
    RAISE EXCEPTION 'U137 PRÉ-VOO: `profiles.status` não existe — rode as migrations anteriores.';
  END IF;
END
$$;

-- ── §1  O CRACHÁ ───────────────────────────────────────────────────────────
-- O predicado que a casa já usava à mão em 17 migrations (o gate de duas
-- metades da U86/U87/U109: `p.ativo AND p.status <> 'pendente_aprovacao'`),
-- agora com um nome. SECURITY DEFINER porque a policy de `profiles` não pode
-- depender de ler `profiles` pela própria RLS.
--
-- `COALESCE(p.ativo, true)`: linha antiga com `ativo` nulo continua passando —
-- a migration não pode transformar dado histórico em porta fechada.
CREATE OR REPLACE FUNCTION public.eh_do_time(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = _user_id
       AND COALESCE(p.ativo, true)
       AND COALESCE(p.status, 'ativo') <> 'pendente_aprovacao'
  );
$$;
REVOKE EXECUTE ON FUNCTION public.eh_do_time(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.eh_do_time(uuid) TO authenticated, service_role;
COMMENT ON FUNCTION public.eh_do_time(uuid) IS
  'R277 (U137): tem conta ATIVA e APROVADA. É o predicado das policies de leitura que antes eram USING (true).';

-- ── §2  AS 28 POLICIES DO CENSO ────────────────────────────────────────────
-- Uma por uma, com o nome exato que o censo do verificador conhece. Mudou o
-- PREDICADO, não o alcance: quem é do time lê o mesmo que lia.

-- profiles: a EXCEÇÃO. Quem está aguardando aprovação precisa ler o PRÓPRIO
-- perfil, senão a tela "Aguardando aprovação" não sabe o que mostrar.
DROP POLICY IF EXISTS "profiles_select_all_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.eh_do_time(auth.uid()) OR id = auth.uid());

DROP POLICY IF EXISTS "agenda_campo_select" ON public.agenda_campo;
CREATE POLICY "agenda_campo_select" ON public.agenda_campo FOR SELECT TO authenticated USING (public.eh_do_time(auth.uid()));

DROP POLICY IF EXISTS "blocos_itens read all auth" ON public.blocos_itens;
CREATE POLICY "blocos_itens read all auth" ON public.blocos_itens FOR SELECT TO authenticated USING (public.eh_do_time(auth.uid()));

DROP POLICY IF EXISTS "blocos read all auth" ON public.blocos;
CREATE POLICY "blocos read all auth" ON public.blocos FOR SELECT TO authenticated USING (public.eh_do_time(auth.uid()));

DROP POLICY IF EXISTS "catalogo_equipamentos_select" ON public.catalogo_equipamentos;
CREATE POLICY "catalogo_equipamentos_select" ON public.catalogo_equipamentos FOR SELECT TO authenticated USING (public.eh_do_time(auth.uid()));

DROP POLICY IF EXISTS "chamado_apoios_select" ON public.chamado_apoios;
CREATE POLICY "chamado_apoios_select" ON public.chamado_apoios FOR SELECT TO authenticated USING (public.eh_do_time(auth.uid()));

DROP POLICY IF EXISTS "chamado_checklist_templates_select" ON public.chamado_checklist_templates;
CREATE POLICY "chamado_checklist_templates_select" ON public.chamado_checklist_templates FOR SELECT TO authenticated USING (public.eh_do_time(auth.uid()));

DROP POLICY IF EXISTS "chamado_equipamentos_select" ON public.chamado_equipamentos;
CREATE POLICY "chamado_equipamentos_select" ON public.chamado_equipamentos FOR SELECT TO authenticated USING (public.eh_do_time(auth.uid()));

DROP POLICY IF EXISTS "chamado_equipes_select" ON public.chamado_equipes;
CREATE POLICY "chamado_equipes_select" ON public.chamado_equipes FOR SELECT TO authenticated USING (public.eh_do_time(auth.uid()));

DROP POLICY IF EXISTS "chamado_locais_select" ON public.chamado_locais;
CREATE POLICY "chamado_locais_select" ON public.chamado_locais FOR SELECT TO authenticated USING (public.eh_do_time(auth.uid()));

DROP POLICY IF EXISTS "chamado_sla_select" ON public.chamado_sla;
CREATE POLICY "chamado_sla_select" ON public.chamado_sla FOR SELECT TO authenticated USING (public.eh_do_time(auth.uid()));

DROP POLICY IF EXISTS "unidades_select" ON public.cliente_equipamento_unidades;
CREATE POLICY "unidades_select" ON public.cliente_equipamento_unidades FOR SELECT TO authenticated USING (public.eh_do_time(auth.uid()));

DROP POLICY IF EXISTS "duplas_escala_semanas_select" ON public.duplas_escala_semanas;
CREATE POLICY "duplas_escala_semanas_select" ON public.duplas_escala_semanas FOR SELECT TO authenticated USING (public.eh_do_time(auth.uid()));

DROP POLICY IF EXISTS "duplas_escala_select" ON public.duplas_escala;
CREATE POLICY "duplas_escala_select" ON public.duplas_escala FOR SELECT TO authenticated USING (public.eh_do_time(auth.uid()));

DROP POLICY IF EXISTS "duplas_select" ON public.duplas;
CREATE POLICY "duplas_select" ON public.duplas FOR SELECT TO authenticated USING (public.eh_do_time(auth.uid()));

DROP POLICY IF EXISTS "equip read all auth" ON public.equipamentos;
CREATE POLICY "equip read all auth" ON public.equipamentos FOR SELECT TO authenticated USING (public.eh_do_time(auth.uid()));

DROP POLICY IF EXISTS "locais_de_referencia_select" ON public.locais_de_referencia;
CREATE POLICY "locais_de_referencia_select" ON public.locais_de_referencia FOR SELECT TO authenticated USING (public.eh_do_time(auth.uid()));

DROP POLICY IF EXISTS "mensagens_chat_select" ON public.mensagens_chat;
CREATE POLICY "mensagens_chat_select" ON public.mensagens_chat FOR SELECT TO authenticated USING (public.eh_do_time(auth.uid()));

DROP POLICY IF EXISTS "permissoes_select" ON public.permissoes_tela;
CREATE POLICY "permissoes_select" ON public.permissoes_tela FOR SELECT TO authenticated USING (public.eh_do_time(auth.uid()));

DROP POLICY IF EXISTS "authenticated read regras_blocos" ON public.regras_blocos;
CREATE POLICY "authenticated read regras_blocos" ON public.regras_blocos FOR SELECT TO authenticated USING (public.eh_do_time(auth.uid()));

DROP POLICY IF EXISTS "auth read regras_cerca" ON public.regras_cerca;
CREATE POLICY "auth read regras_cerca" ON public.regras_cerca FOR SELECT TO authenticated USING (public.eh_do_time(auth.uid()));

DROP POLICY IF EXISTS "authenticated read regras_cftv" ON public.regras_cftv;
CREATE POLICY "authenticated read regras_cftv" ON public.regras_cftv FOR SELECT TO authenticated USING (public.eh_do_time(auth.uid()));

DROP POLICY IF EXISTS "servicos read all auth" ON public.servicos;
CREATE POLICY "servicos read all auth" ON public.servicos FOR SELECT TO authenticated USING (public.eh_do_time(auth.uid()));

DROP POLICY IF EXISTS "tecnico_aliases_select" ON public.tecnico_aliases;
CREATE POLICY "tecnico_aliases_select" ON public.tecnico_aliases FOR SELECT TO authenticated USING (public.eh_do_time(auth.uid()));

DROP POLICY IF EXISTS "viagens_viatura_select" ON public.viagens_viatura;
CREATE POLICY "viagens_viatura_select" ON public.viagens_viatura FOR SELECT TO authenticated USING (public.eh_do_time(auth.uid()));

DROP POLICY IF EXISTS "viaturas_select" ON public.viaturas;
CREATE POLICY "viaturas_select" ON public.viaturas FOR SELECT TO authenticated USING (public.eh_do_time(auth.uid()));

DROP POLICY IF EXISTS "visitas_select" ON public.visitas_tecnicas;
CREATE POLICY "visitas_select" ON public.visitas_tecnicas FOR SELECT TO authenticated USING (public.eh_do_time(auth.uid()));

-- ── §3  A TABELA SEM PERÍMETRO ─────────────────────────────────────────────
-- `chamado_contadores` é a única tabela viva do schema sem RLS habilitada
-- (achado da revisão). Ela guarda o último número de OS por ano: leitura de
-- todo o time, escrita só pelas funções (que são SECURITY DEFINER e passam por
-- cima da RLS de qualquer jeito).
DO $$
BEGIN
  IF to_regclass('public.chamado_contadores') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.chamado_contadores ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS chamado_contadores_select ON public.chamado_contadores';
    EXECUTE 'CREATE POLICY chamado_contadores_select ON public.chamado_contadores FOR SELECT TO authenticated USING (public.eh_do_time(auth.uid()))';
  END IF;
END
$$;

-- ── §4  A POLICY ZUMBI ─────────────────────────────────────────────────────
-- "Tecnico or admin update visitas" sobreviveu ao aperto que a U6c fez em
-- `visitas_tecnicas`: as policies de UPDATE são OR'adas, então a frouxa anula a
-- apertada. Achado da revisão; some aqui.
DROP POLICY IF EXISTS "Tecnico or admin update visitas" ON public.visitas_tecnicas;

COMMIT;

-- ── §5  CONFERÊNCIA ────────────────────────────────────────────────────────
WITH conferencia AS (
  SELECT 1 AS n, 'a função eh_do_time existe' AS o_que,
         (to_regprocedure('public.eh_do_time(uuid)') IS NOT NULL)::text AS obtido, 'true' AS esperado
  UNION ALL SELECT 2, 'nenhuma policy de SELECT continua com predicado literal `true`',
         (SELECT count(*)::text FROM pg_policies
           WHERE schemaname = 'public' AND cmd = 'SELECT' AND qual = 'true'), '0'
  UNION ALL SELECT 3, 'as policies reguardadas apontam para eh_do_time',
         (SELECT count(*)::text FROM pg_policies
           WHERE schemaname = 'public' AND cmd = 'SELECT' AND qual LIKE '%eh_do_time%'), '28'
  UNION ALL SELECT 4, 'profiles deixou de ter a policy duplicada',
         (SELECT count(*)::text FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'profiles' AND cmd = 'SELECT'), '1'
  UNION ALL SELECT 5, 'quem aguarda aprovação ainda lê o PRÓPRIO perfil',
         (SELECT (qual LIKE '%id = auth.uid()%')::text FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_select'), 'true'
  UNION ALL SELECT 6, 'chamado_contadores tem RLS habilitada',
         (SELECT relrowsecurity::text FROM pg_class WHERE oid = 'public.chamado_contadores'::regclass), 'true'
  UNION ALL SELECT 7, 'a policy zumbi de UPDATE de visitas sumiu',
         (SELECT count(*)::text FROM pg_policies
           WHERE schemaname = 'public' AND policyname = 'Tecnico or admin update visitas'), '0'
  UNION ALL SELECT 8, 'quantas pessoas PERDERIAM leitura agora (esperado: só quem não é do time)',
         (SELECT count(*)::text FROM public.profiles p
           WHERE NOT (COALESCE(p.ativo, true) AND COALESCE(p.status, 'ativo') <> 'pendente_aprovacao')), '>>> LEIA <<<'
  UNION ALL SELECT 9, 'e quem são (confira a lista antes de sair da tela)',
         (SELECT COALESCE(string_agg(p.email || ' [' || COALESCE(p.status, '—') || ']', ', '), '(ninguém)')
            FROM public.profiles p
           WHERE NOT (COALESCE(p.ativo, true) AND COALESCE(p.status, 'ativo') <> 'pendente_aprovacao')), '>>> LEIA <<<'
)
SELECT n, o_que, obtido, esperado,
       CASE WHEN esperado = '>>> LEIA <<<' THEN 'leia'
            WHEN obtido IS NOT DISTINCT FROM esperado THEN 'ok' ELSE '>>> OLHAR <<<' END AS veredito
FROM conferencia ORDER BY n;

-- ═══════════════════════════════════════════════════════════════════════════
-- PORTÃO — transação própria que termina em ROLLBACK (cicatriz da U136: o
-- trabalho acima JÁ foi commitado, senão este ROLLBACK levaria tudo junto).
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;
DO $u137portao$
DECLARE
  v_id uuid;
BEGIN
  -- um perfil de mentira, pendente de aprovação: eh_do_time tem de recusar
  SELECT id INTO v_id FROM public.profiles LIMIT 1;
  IF v_id IS NULL THEN
    RAISE NOTICE 'U137 PORTÃO: sem perfis neste banco — portão pulado.';
    RETURN;
  END IF;

  IF NOT public.eh_do_time(v_id) THEN
    RAISE EXCEPTION 'U137 PORTÃO 1: o primeiro perfil do banco não passou no crachá — confira o item 9 da conferência.';
  END IF;

  UPDATE public.profiles SET status = 'pendente_aprovacao' WHERE id = v_id;
  IF public.eh_do_time(v_id) THEN
    RAISE EXCEPTION 'U137 PORTÃO 2: quem aguarda aprovação passou no crachá.';
  END IF;

  UPDATE public.profiles SET status = 'ativo', ativo = false WHERE id = v_id;
  IF public.eh_do_time(v_id) THEN
    RAISE EXCEPTION 'U137 PORTÃO 3: quem foi desativado passou no crachá.';
  END IF;

  IF public.eh_do_time(NULL) THEN
    RAISE EXCEPTION 'U137 PORTÃO 4: sem login o crachá passou.';
  END IF;

  RAISE NOTICE 'U137 PORTÃO: ok — ativo passa, pendente não passa, desativado não passa, anônimo não passa.';
END
$u137portao$;
ROLLBACK;

-- ═══════════════════════════════════════════════════════════════════════════
-- DESFAZER (cole num editor e rode, se precisar voltar)
--
--   Devolve as 28 policies ao `USING (true)`. NÃO devolve o botão "Criar
--   conta" — esse é código, e a R277 é decisão de produto.
--
--   DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
--   CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);
--   -- … e assim por diante para as outras 27, trocando eh_do_time por true.
--   -- O jeito curto, se for mesmo necessário:
--   --   SELECT 'DROP POLICY ' || quote_ident(policyname) || ' ON public.' || quote_ident(tablename) || ';'
--   --       || 'CREATE POLICY ' || quote_ident(policyname) || ' ON public.' || quote_ident(tablename)
--   --       || ' FOR SELECT TO authenticated USING (true);'
--   --     FROM pg_policies WHERE schemaname='public' AND cmd='SELECT' AND qual LIKE '%eh_do_time%';
--   DROP FUNCTION IF EXISTS public.eh_do_time(uuid);
-- ═══════════════════════════════════════════════════════════════════════════
