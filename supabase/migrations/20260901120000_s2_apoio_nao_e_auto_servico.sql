-- ═══════════════════════════════════════════════════════════════════════════
-- S2 — APOIO DEIXA DE SER AUTO-SERVIÇO
--      (correção de ESCALADA DE PRIVILÉGIO — série S, como a S1)
--
-- >>> RODAR NO SQL EDITOR DO SUPABASE, À MÃO. Idempotente.
-- >>> Isto NÃO é funcionalidade nova. É um buraco aberto desde a U7/S1 (agosto),
-- >>> vivo em produção agora. Rode assim que puder ler o que segue.
--
-- ── O BURACO, EM DUAS CHAMADAS DE API ──────────────────────────────────────
-- Existe um CICLO entre uma policy e a função que decide quem edita chamado:
--
--   (1) chamado_apoios_insert (U7:642-644) tem
--         WITH CHECK (pode_acessar_chamado(chamado_id) OR profile_id = auth.uid())
--       O segundo termo diz, em português: "qualquer autenticado pode se
--       inscrever como apoio de QUALQUER chamado" — inclusive de um que ele não
--       pode nem ler.
--
--   (2) pode_editar_chamado (S1:398-410) concede edição a quem for apoio:
--         OR EXISTS (SELECT 1 FROM chamado_apoios a
--                    WHERE a.chamado_id = _chamado_id AND a.profile_id = auth.uid())
--
--   (3) chamados_update (S1:419-422) É pode_editar_chamado(id).
--
-- Então, com a chave publishable que está no .env VERSIONADO e o login de
-- qualquer funcionário:
--     POST /rest/v1/chamado_apoios  {"chamado_id":"<X>","profile_id":"<eu>"}
--     PATCH /rest/v1/chamados?id=eq.<X>  {...}
-- e pronto: escrita em chamado que não é dele. O `chamado_apoios_select` é
-- `USING (true)`, então os ids de chamado saem de lá mesmo — não é preciso
-- adivinhar nada.
--
-- Alcance honesto: exige LOGIN (as policies são TO authenticated), então isto é
-- escalada de privilégio INTERNA, não porta aberta para a internet. Não é
-- incêndio de madrugada. Mas torna a matriz de permissões decorativa para quem
-- souber abrir o DevTools, e é barato de fechar.
--
-- ── POR QUE FECHAR NOS DOIS LADOS ──────────────────────────────────────────
-- Tirar só o `OR profile_id = auth.uid()` da policy NÃO basta: sobra o caminho
-- pelo `pode_acessar_chamado`, que inclui `OR c.responsavel_id IS NULL` — a
-- FILA ABERTA, que é assim de propósito. Por ela, alguém se inscreve como apoio
-- de um chamado ainda sem dono (legítimo) e continua com direito de edição
-- DEPOIS que o chamado for atribuído a outra pessoa (não legítimo).
-- Por isso o remédio ataca o CICLO, e não só a porta:
--   · §1 a policy para de aceitar auto-inscrição em chamado inacessível;
--   · §2 ser apoio só dá direito de edição quando FOI OUTRA PESSOA que te pôs
--     lá, ou quando foi o gatilho da escala. Pôr-se a si mesmo não conta.
--
-- ── A REGRA NOVA, EM UMA FRASE ─────────────────────────────────────────────
-- "Ser apoio dá direito de editar quando ALGUÉM COM AUTORIDADE te pôs lá."
-- Isso pede saber QUEM pôs, e o banco não sabia — daí a coluna `criado_por`.
--
-- LINHAS ANTIGAS CONTINUAM VALENDO. Elas nascem com `criado_por IS NULL`, e
-- `NULL IS DISTINCT FROM profile_id` é TRUE, então elas seguem concedendo
-- edição exatamente como hoje. É deliberado: não dá para saber quais das linhas
-- antigas foram auto-inscrição, e trancar gente legítima para fora por suspeita
-- seria trocar um problema por outro pior. O §1 fecha a porta daqui para a
-- frente; o §4 lista as linhas suspeitas para o Davi olhar com calma.
--
-- ── O QUE NÃO MUDA ─────────────────────────────────────────────────────────
-- · O gatilho da escala (U64/U76) escreve apoio com origem='dupla' passando por
--   cima da RLS (SECURITY DEFINER) — ele não é afetado, e o §2 lhe dá passe
--   explícito.
-- · adicionarApoio()/removerApoio() (features/chamados/data.ts:364-377)
--   continuam funcionando para quem PODE acessar o chamado, que é todo mundo
--   que hoje os usa de verdade: o que morre é só "me inscrever num chamado que
--   eu não posso nem abrir".
-- · A invariante do CLAUDE.md continua de pé: apoio é REGISTRO de quem foi.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- §0) FOTO DE ANTES — para o §4 poder comparar
-- ═══════════════════════════════════════════════════════════════════════
CREATE TEMP TABLE _s2_antes ON COMMIT DROP AS
SELECT (SELECT count(*) FROM public.chamado_apoios)                         AS apoios_total,
       (SELECT count(*) FROM public.chamado_apoios WHERE origem = 'dupla')  AS apoios_dupla,
       (SELECT count(*) FROM public.chamado_apoios WHERE origem = 'manual') AS apoios_manual;

-- ═══════════════════════════════════════════════════════════════════════
-- §1) A PORTA: auto-inscrição em chamado inacessível acaba
-- ═══════════════════════════════════════════════════════════════════════
-- Some o `OR profile_id = auth.uid()`. O que sobra é `pode_acessar_chamado`,
-- que já cobre TODO uso real da tela: quem edita o apoio de um chamado está
-- com ele aberto, e para isso já precisa acessá-lo.
DROP POLICY IF EXISTS "chamado_apoios_insert" ON public.chamado_apoios;
CREATE POLICY "chamado_apoios_insert" ON public.chamado_apoios
  FOR INSERT TO authenticated
  WITH CHECK (public.pode_acessar_chamado(chamado_id));

-- O DELETE tinha o mesmo `OR profile_id = auth.uid()`, e ali ele é outro tipo
-- de problema: deixava a pessoa APAGAR o registro de que ela foi ao prédio.
-- Apoio é registro de quem foi (R75) — quem esteve lá não se desconvida.
DROP POLICY IF EXISTS "chamado_apoios_delete" ON public.chamado_apoios;
CREATE POLICY "chamado_apoios_delete" ON public.chamado_apoios
  FOR DELETE TO authenticated
  USING (public.pode_acessar_chamado(chamado_id));

-- ═══════════════════════════════════════════════════════════════════════
-- §2) O CICLO: ser apoio só conta quando OUTRA PESSOA te pôs lá
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE public.chamado_apoios
  ADD COLUMN IF NOT EXISTS criado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- DEFAULT auth.uid() e não um valor fixo: a coluna tem de registrar QUEM estava
-- logado no INSERT, e é justamente a diferença entre esse valor e `profile_id`
-- que separa "me puseram aqui" de "eu me pus aqui". Nas escritas do gatilho
-- (SECURITY DEFINER) auth.uid() é o gestor que trocou o responsável, nunca o
-- apoiador — então elas continuam concedendo, como devem.
ALTER TABLE public.chamado_apoios
  ALTER COLUMN criado_por SET DEFAULT auth.uid();

COMMENT ON COLUMN public.chamado_apoios.criado_por IS
  'Quem estava logado quando esta linha nasceu (S2). Existe por UM motivo: '
  'pode_editar_chamado() só conta o apoio quando criado_por é DIFERENTE de '
  'profile_id — pôr-se a si mesmo como apoio não pode virar direito de edição. '
  'NULL = linha anterior à S2, e essas seguem concedendo (ver o cabeçalho).';

CREATE INDEX IF NOT EXISTS chamado_apoios_criado_por_idx
  ON public.chamado_apoios (criado_por);

-- ── as duas funções do ciclo ───────────────────────────────────────────────
-- O predicado é o MESMO nas duas, escrito por extenso nas duas em vez de sair
-- numa função auxiliar: são SECURITY DEFINER chamadas por policy em caminho
-- quente, e uma indireção a mais aqui é uma chamada a mais por linha avaliada.
-- Se um dia virarem três, aí vale extrair.
CREATE OR REPLACE FUNCTION public.pode_editar_chamado(_chamado_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    public.is_gestor(auth.uid())
    OR EXISTS (SELECT 1 FROM public.chamados c
               WHERE c.id = _chamado_id
                 AND (c.responsavel_id = auth.uid() OR c.aberto_por = auth.uid()))
    OR EXISTS (SELECT 1 FROM public.chamado_apoios a
               WHERE a.chamado_id = _chamado_id
                 AND a.profile_id = auth.uid()
                 -- origem='dupla' é escrita do gatilho da escala: ninguém a
                 -- forja, porque ela é derivada de duplas_escala.
                 AND (a.origem = 'dupla' OR a.criado_por IS DISTINCT FROM a.profile_id)),
    false);
$$;
REVOKE EXECUTE ON FUNCTION public.pode_editar_chamado(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.pode_editar_chamado(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pode_acessar_chamado(_chamado_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    public.is_gestor(auth.uid())
    OR EXISTS (SELECT 1 FROM public.chamados c
               WHERE c.id = _chamado_id
                 AND (c.responsavel_id = auth.uid() OR c.aberto_por = auth.uid()
                      -- a FILA ABERTA continua aberta, de propósito: chamado sem
                      -- dono é de quem pegar, e é assim que a operação funciona.
                      OR c.responsavel_id IS NULL))
    OR EXISTS (SELECT 1 FROM public.chamado_apoios a
               WHERE a.chamado_id = _chamado_id
                 AND a.profile_id = auth.uid()
                 AND (a.origem = 'dupla' OR a.criado_por IS DISTINCT FROM a.profile_id)),
    false);
$$;
REVOKE EXECUTE ON FUNCTION public.pode_acessar_chamado(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.pode_acessar_chamado(uuid) TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════
-- §3) CONFERÊNCIA
-- ═══════════════════════════════════════════════════════════════════════
SELECT 'a policy de INSERT não aceita mais auto-inscrição' AS conferencia,
       (SELECT (with_check NOT LIKE '%profile_id = auth.uid()%')::text
          FROM pg_policies
         WHERE schemaname='public' AND tablename='chamado_apoios'
           AND policyname='chamado_apoios_insert') AS valor,
       'true' AS esperado
UNION ALL
SELECT 'a policy de DELETE também não',
       (SELECT (qual NOT LIKE '%profile_id = auth.uid()%')::text
          FROM pg_policies
         WHERE schemaname='public' AND tablename='chamado_apoios'
           AND policyname='chamado_apoios_delete'), 'true'
UNION ALL
SELECT 'a coluna criado_por existe e tem DEFAULT auth.uid()',
       (SELECT (column_default LIKE '%auth.uid()%')::text
          FROM information_schema.columns
         WHERE table_schema='public' AND table_name='chamado_apoios'
           AND column_name='criado_por'), 'true'
UNION ALL
SELECT 'CRÍTICO: as DUAS funções do ciclo exigem que outra pessoa tenha posto',
       (SELECT count(*)::text FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname='public'
           AND p.proname IN ('pode_editar_chamado','pode_acessar_chamado')
           AND pg_get_functiondef(p.oid) LIKE '%criado_por IS DISTINCT FROM a.profile_id%'),
       '2'
UNION ALL
SELECT 'CRÍTICO: nada foi apagado de chamado_apoios (antes × depois)',
       (SELECT count(*) FROM public.chamado_apoios)::text,
       (SELECT apoios_total::text FROM _s2_antes)
UNION ALL
SELECT 'a fila aberta continua aberta (chamado sem dono é de quem pegar)',
       (SELECT (pg_get_functiondef(p.oid) LIKE '%c.responsavel_id IS NULL%')::text
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname='public' AND p.proname='pode_acessar_chamado'), 'true';

-- ═══════════════════════════════════════════════════════════════════════
-- §4) O QUE OLHAR COM CALMA — as linhas que o buraco pode ter deixado
-- ═══════════════════════════════════════════════════════════════════════
-- Não dá para saber quais linhas antigas foram auto-inscrição: `criado_por` só
-- passa a existir agora. O que dá para fazer é mostrar as MAIS SUSPEITAS —
-- apoio manual numa pessoa que não é responsável nem abriu o chamado, ou seja,
-- alguém que só está ligado àquele chamado por esta linha. Quase todas vão ser
-- legítimas (o gestor pôs). Se alguma não for, apague-a à mão.
SELECT p.nome                     AS apoiador,
       c.numero                   AS chamado,
       c.titulo,
       c.natureza,
       a.origem,
       a.created_at               AS apoio_criado_em
  FROM public.chamado_apoios a
  JOIN public.chamados c ON c.id = a.chamado_id
  LEFT JOIN public.profiles p ON p.id = a.profile_id
 WHERE a.origem <> 'dupla'
   AND a.criado_por IS NULL
   AND c.responsavel_id IS DISTINCT FROM a.profile_id
   AND c.aberto_por     IS DISTINCT FROM a.profile_id
 ORDER BY a.created_at DESC;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- DESFAZER — devolve o comportamento anterior, buraco incluído.
-- Só faz sentido se a S2 tiver trancado alguém legítimo para fora; nesse caso o
-- certo é descobrir QUEM e por quê (a consulta do §4 ajuda) antes de reabrir.
-- ═══════════════════════════════════════════════════════════════════════════

-- BEGIN;
--
-- DROP POLICY IF EXISTS "chamado_apoios_insert" ON public.chamado_apoios;
-- CREATE POLICY "chamado_apoios_insert" ON public.chamado_apoios
--   FOR INSERT TO authenticated
--   WITH CHECK (public.pode_acessar_chamado(chamado_id) OR profile_id = auth.uid());
--
-- DROP POLICY IF EXISTS "chamado_apoios_delete" ON public.chamado_apoios;
-- CREATE POLICY "chamado_apoios_delete" ON public.chamado_apoios
--   FOR DELETE TO authenticated
--   USING (public.pode_acessar_chamado(chamado_id) OR profile_id = auth.uid());
--
-- CREATE OR REPLACE FUNCTION public.pode_editar_chamado(_chamado_id uuid)
-- RETURNS boolean
-- LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
-- AS $desfaz$
--   SELECT COALESCE(
--     public.is_gestor(auth.uid())
--     OR EXISTS (SELECT 1 FROM public.chamados c
--                WHERE c.id = _chamado_id
--                  AND (c.responsavel_id = auth.uid() OR c.aberto_por = auth.uid()))
--     OR EXISTS (SELECT 1 FROM public.chamado_apoios a
--                WHERE a.chamado_id = _chamado_id AND a.profile_id = auth.uid()),
--     false);
-- $desfaz$;
--
-- CREATE OR REPLACE FUNCTION public.pode_acessar_chamado(_chamado_id uuid)
-- RETURNS boolean
-- LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
-- AS $desfaz$
--   SELECT COALESCE(
--     public.is_gestor(auth.uid())
--     OR EXISTS (SELECT 1 FROM public.chamados c
--                WHERE c.id = _chamado_id
--                  AND (c.responsavel_id = auth.uid() OR c.aberto_por = auth.uid()
--                       OR c.responsavel_id IS NULL))
--     OR EXISTS (SELECT 1 FROM public.chamado_apoios a
--                WHERE a.chamado_id = _chamado_id AND a.profile_id = auth.uid()),
--     false);
-- $desfaz$;
--
-- COMMIT;
--
-- A coluna criado_por pode ficar: ela não atrapalha nada e o histórico dela é
-- útil de qualquer forma.
-- ALTER TABLE public.chamado_apoios DROP COLUMN IF EXISTS criado_por;
