-- ═══════════════════════════════════════════════════════════════════════════
-- U132 — O TÉCNICO DE CAMPO LÊ SÓ ATIVIDADE DE CAMPO (R264) e tem 3 telas (R263)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Davi, 12/09/2026: "Os técnicos de campo são os com cargo TÉCNICO, eles
-- utilizarão pelo celular. Eles devem ter em seu app somente 3 páginas: INICIO,
-- AGENDA, PERFIL. […] os usuário com CARGO TÉCNICO no tipo de perfil só terão
-- acesso as atividades do cargo TÉCNICO." E, perguntado se ele vê só as dele
-- ou as da equipe: "Todas as atividades da equipe para saber o que os colegas
-- tem."
--
-- ── O QUE MUDA, E O QUE NÃO MUDA ──────────────────────────────────────────
--
-- A R221 (U119) abriu a leitura de `chamados` e `visitas_tecnicas` para toda
-- pessoa logada (`USING (true)`). Ela continua valendo para TODO MUNDO que não
-- tem cargo técnico. Para o cargo técnico, a leitura de `chamados` passa a
-- parar na natureza: ele lê o que é de CAMPO — e a capa da proposta (natureza
-- `comercial`), porque a visita técnica para proposta é o quarto fluxo dele
-- (R134) e a capa é a metade "chamado" dela. O que ele NÃO lê é a atividade
-- INTERNA das outras equipes — T.I., patrimônio, comercial, SAC.
--
-- Visitas continuam abertas: toda visita técnica é trabalho de campo. E a
-- tarefa que é DELE — responsável, autor ou apoio — entra seja de que natureza
-- for (o porquê está no §2): o que ele não lê é a interna dos OUTROS.
--
-- ANTES DE RODAR: troque o cargo do Gilleno para SAC (Administrativo ›
-- Usuários). Ele opera o Controle Patrimonial em atividade INTERNA; com cargo
-- técnico, depois desta migration, ele veria só as que são dele. A conferência
-- do fim lista quem tem cargo técnico e responde por interna, para você
-- conferir a lista antes de fechar a sessão.
--
-- SEM ESTA MIGRATION a Início nova do técnico funciona, mas (1) ele ainda lê a
-- atividade interna dos outros e (2) a grade /sobreaviso continua abrindo para
-- ele pela URL — a linha da U86 na matriz diz true, e o catálogo do código só
-- vale quando não há linha no banco.
--
-- É um recorte por CARGO, e é a primeira vez que este banco recorta leitura
-- por cargo. Está certo assim: o cargo é PERMISSÃO (o COMMENT de
-- `profiles.equipe` diz que equipe NÃO é), e o Davi definiu que o que separa
-- quem trabalha na rua de quem trabalha na sede é o cargo TÉCNICO — desde que
-- o OPERACIONAL (R244) passou a existir para quem está na sede sem ser gestor.
--
-- `pode_acessar_chamado()` — a régua que abre comentários, reações, fotos,
-- movimentos de equipamento — ganha o mesmo recorte, senão o técnico veria o
-- chat de uma atividade cuja linha ele não consegue ler.
--
-- E a chave `sobreaviso` da matriz fecha para o técnico: as três telas dele são
-- Início, Agenda e Perfil, e o que ele precisa saber da escala (a semana em que
-- ele é o plantonista) passou a estar NA Início e NO Perfil dele. A grade
-- inteira é do Vinicius.
--
-- ── POR QUE UMA FUNÇÃO E NÃO O EXISTS INLINE NA POLICY ────────────────────
--
-- `eh_tecnico(uid)` é STABLE SECURITY DEFINER, como `is_gestor()`: a policy de
-- `chamados` a chama uma vez por linha lida, e a função lê `profiles` — que tem
-- a própria RLS. SECURITY DEFINER é o que garante que a régua funciona mesmo se
-- um dia a leitura de `profiles` apertar. E o nome deixa a policy legível: quem
-- ler `NOT eh_tecnico(auth.uid()) OR natureza <> 'interno'` entende a regra sem
-- abrir subconsulta.
--
-- IDEMPOTENTE: CREATE OR REPLACE nas duas funções, DROP/CREATE na policy (o
-- mesmo nome `chamados_select`, que o censo do verificador conhece), UPSERT na
-- matriz. Não cria tabela nem coluna.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §0  PRÉ-VOO ────────────────────────────────────────────────────────────
DO $u132pre$
BEGIN
  IF to_regclass('public.chamados') IS NULL THEN
    RAISE EXCEPTION 'U132 PRÉ-VOO: public.chamados não existe — rode a U7 primeiro.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chamados' AND policyname = 'chamados_select') THEN
    RAISE EXCEPTION 'U132 PRÉ-VOO: a policy chamados_select não existe — esta migration a SUBSTITUI (U119). Descubra quem a removeu antes de rodar.';
  END IF;
  IF to_regprocedure('public.pode_acessar_chamado(uuid)') IS NULL THEN
    RAISE EXCEPTION 'U132 PRÉ-VOO: pode_acessar_chamado não existe — rode a U119 primeiro.';
  END IF;
  IF to_regclass('public.permissoes_tela') IS NULL THEN
    RAISE EXCEPTION 'U132 PRÉ-VOO: public.permissoes_tela não existe (U11).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'cargo') THEN
    RAISE EXCEPTION 'U132 PRÉ-VOO: profiles.cargo não existe — não há como saber quem é técnico.';
  END IF;
END
$u132pre$;

-- ── §1  eh_tecnico(uid) ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.eh_tecnico(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user_id AND p.cargo = 'tecnico'),
    false);
$$;
REVOKE EXECUTE ON FUNCTION public.eh_tecnico(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.eh_tecnico(uuid) TO authenticated, service_role;
COMMENT ON FUNCTION public.eh_tecnico(uuid) IS
  'R264 (U132): o cargo TÉCNICO é quem trabalha em campo, no celular. É a única régua de LEITURA por cargo deste banco: o técnico lê só atividade de campo.';

-- ── §2  a leitura de chamados ──────────────────────────────────────────────
-- A EXCEÇÃO DA TAREFA QUE É DELE. O app deixa dar uma atividade interna a
-- alguém de cargo técnico (o seletor de responsável não filtra cargo, e a
-- @menção e o apoio também não) — e os gatilhos o notificam dela. Sem esta
-- cláusula a notificação abriria uma página vazia, e o técnico não leria nem
-- editaria a própria tarefa (o UPDATE do PostgREST passa pela leitura). Então:
-- o que é DELE — responsável, autor ou apoio — entra, seja de que natureza for.
-- O que ele não lê é a interna dos OUTROS.
DROP POLICY IF EXISTS chamados_select ON public.chamados;
CREATE POLICY chamados_select ON public.chamados
  FOR SELECT TO authenticated
  USING (
    NOT public.eh_tecnico(auth.uid())
    OR natureza <> 'interno'
    OR responsavel_id = auth.uid()
    OR aberto_por = auth.uid()
    OR EXISTS (SELECT 1 FROM public.chamado_apoios a
                WHERE a.chamado_id = chamados.id AND a.profile_id = auth.uid())
  );
COMMENT ON POLICY chamados_select ON public.chamados IS
  'R221 para todo mundo (toda pessoa logada vê toda atividade) — menos o cargo TÉCNICO, que desde a R264 (U132) lê o que não é interno (campo e a capa da proposta) mais a tarefa que é dele (responsável, autor ou apoio). Davi, 12/09/2026: "os usuário com CARGO TÉCNICO […] só terão acesso as atividades do cargo TÉCNICO".';

-- ── §3  a régua do que abre por dentro (chat, reações, fotos, equipamentos) ─
CREATE OR REPLACE FUNCTION public.pode_acessar_chamado(_chamado_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $u132a$
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.chamados c
                  WHERE c.id = _chamado_id
                    AND (NOT public.eh_tecnico(auth.uid())
                         OR c.natureza <> 'interno'
                         OR c.responsavel_id = auth.uid()
                         OR c.aberto_por = auth.uid()
                         OR EXISTS (SELECT 1 FROM public.chamado_apoios a
                                     WHERE a.chamado_id = c.id AND a.profile_id = auth.uid())));
$u132a$;
COMMENT ON FUNCTION public.pode_acessar_chamado(uuid) IS
  'R221 (U119): quem está logado acessa qualquer atividade que exista — e, desde a R264 (U132), o cargo técnico só o que não é interno mais a tarefa que é dele: o MESMO recorte da leitura.';

-- ── §4  a matriz: o técnico tem TRÊS telas ─────────────────────────────────
-- A única chave que ainda abria para ele fora das três (a U24 já tinha tirado
-- Clientes; Histórico e Mapa saíram do sistema). O bloco tem a forma exata que
-- o leitor de semente do verificador espera.
INSERT INTO public.permissoes_tela (tela, cargo, permitido) VALUES
  ('sobreaviso', 'tecnico', false)
ON CONFLICT (tela, cargo) DO UPDATE SET permitido = EXCLUDED.permitido;

COMMIT;

-- ── CONFERÊNCIA (obtido × esperado × veredito) ──────────────────────────────
WITH conferencia AS (
  SELECT 'R264: eh_tecnico existe e é SECURITY DEFINER' AS item,
         (SELECT p.prosecdef::text FROM pg_proc p WHERE p.oid = 'public.eh_tecnico(uuid)'::regprocedure) AS obtido,
         'true' AS esperado
  UNION ALL
  SELECT 'R264: anon NÃO executa eh_tecnico',
         has_function_privilege('anon', 'public.eh_tecnico(uuid)', 'EXECUTE')::text, 'false'
  UNION ALL
  SELECT 'R264: chamados_select para na natureza só para o técnico — e deixa passar a tarefa que é dele',
         (SELECT (qual LIKE '%eh_tecnico(auth.uid())%'
              AND qual LIKE '%natureza <> ''interno''%'
              AND qual LIKE '%responsavel_id = auth.uid()%'
              AND qual LIKE '%aberto_por = auth.uid()%'
              AND qual LIKE '%chamado_apoios%')::text
            FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chamados' AND policyname = 'chamados_select'),
         'true'
  UNION ALL
  SELECT 'R264 (informativo): técnicos que hoje respondem por atividade INTERNA em aberto — eles continuam vendo a própria tarefa; confira a lista com o Davi (o Gilleno vira SAC)',
         (SELECT COALESCE(string_agg(p.nome || ' (' || n || ')', ', ' ORDER BY p.nome), '(ninguém)')
            FROM (SELECT c.responsavel_id, count(*) AS n FROM public.chamados c
                   WHERE c.natureza = 'interno' AND c.status NOT IN ('concluido', 'cancelado')
                   GROUP BY c.responsavel_id) t
            JOIN public.profiles p ON p.id = t.responsavel_id
           WHERE p.cargo = 'tecnico'), '>>> LEIA <<<'
  UNION ALL
  SELECT 'R264: pode_acessar_chamado tem o mesmo recorte',
         (pg_get_functiondef('public.pode_acessar_chamado(uuid)'::regprocedure) LIKE '%eh_tecnico(auth.uid())%')::text, 'true'
  UNION ALL
  SELECT 'R221 intacta: visitas continuam abertas a toda pessoa logada',
         (SELECT qual FROM pg_policies WHERE schemaname = 'public' AND tablename = 'visitas_tecnicas' AND policyname = 'visitas_select'), 'true'
  UNION ALL
  SELECT 'R263: a chave sobreaviso fechou para o técnico',
         (SELECT permitido::text FROM public.permissoes_tela WHERE tela = 'sobreaviso' AND cargo = 'tecnico'), 'false'
  UNION ALL
  SELECT 'R263: as três telas do técnico continuam abertas (dashboard, calendario, perfil)',
         (SELECT count(*)::text FROM public.permissoes_tela
           WHERE cargo = 'tecnico' AND permitido AND tela IN ('dashboard', 'calendario', 'perfil')), '3'
  UNION ALL
  SELECT 'R263: e NENHUMA outra chave abre para ele',
         (SELECT count(*)::text FROM public.permissoes_tela
           WHERE cargo = 'tecnico' AND permitido AND tela NOT IN ('dashboard', 'calendario', 'perfil')), '0'
  UNION ALL
  SELECT 'quem tem cargo técnico hoje (para você conferir a lista com o Davi)',
         (SELECT COALESCE(string_agg(nome, ', ' ORDER BY nome), '(ninguém)') FROM public.profiles WHERE cargo = 'tecnico' AND ativo), '>>> LEIA <<<'
)
SELECT item, obtido, esperado,
       CASE WHEN esperado = '>>> LEIA <<<' THEN 'leia'
            WHEN obtido IS NOT DISTINCT FROM esperado THEN 'ok' ELSE '>>> OLHAR <<<' END AS veredito
  FROM conferencia;

-- ── DESFAZER ────────────────────────────────────────────────────────────────
-- Volta a R221 inteira (U119), reabre a escala para o técnico e apaga a função:
--
--   DROP POLICY IF EXISTS chamados_select ON public.chamados;
--   CREATE POLICY chamados_select ON public.chamados FOR SELECT TO authenticated USING (true);
--   COMMENT ON POLICY chamados_select ON public.chamados IS 'R221 (U119): toda pessoa logada vê toda atividade';
--   CREATE OR REPLACE FUNCTION public.pode_acessar_chamado(_chamado_id uuid)
--   RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $d$
--     SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.chamados c WHERE c.id = _chamado_id);
--   $d$;
--   UPDATE public.permissoes_tela SET permitido = true WHERE tela = 'sobreaviso' AND cargo = 'tecnico';
--   DROP FUNCTION IF EXISTS public.eh_tecnico(uuid);
