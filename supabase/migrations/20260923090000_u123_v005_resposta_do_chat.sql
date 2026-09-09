-- ═══════════════════════════════════════════════════════════════════════════
-- U123 — v0.0.5: a resposta enviada pelo chat FICA no chat, junto da mensagem
-- que ela respondeu (R240)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Davi, 09/09/2026: "quando um usuário manda uma mensagem no chat que vai
-- diretamente para os comentários daquela atividade, a mensagem também deve
-- ficar no chat, se juntando com a mensagem que ele respondeu, sendo caixas de
-- mensagem diferentes no mesmo campo (fundo colorido) dentro do chat."
--
-- O QUE FALTAVA: a resposta do chat vira um COMENTÁRIO na atividade (R216) que
-- menciona quem mencionou — então ela aparece no chat DA OUTRA PESSOA (é uma
-- menção a ela), mas nunca no meu: `minhas_mencoes` devolve o que menciona
-- QUEM CHAMA. Faltava a ligação "esta mensagem responde àquela".
--
-- §1  `chamado_eventos.responde_a` — o comentário que esta mensagem responde.
--     Null é o normal (comentário escrito na tela da atividade). Um gatilho
--     garante o invariante: só se responde a um comentário da MESMA atividade.
-- §2  `respostas_do_chat(_chamados uuid[])` — as respostas das atividades que o
--     chat está mostrando, para a tela agrupar cada uma sob a sua mensagem.
--     SECURITY INVOKER: a RLS de chamado_eventos filtra (R221).
--
-- PRÉ-VOO: exige `chamado_eventos` e `minhas_mencoes` (U117/U119).
-- IDEMPOTENTE: ADD COLUMN IF NOT EXISTS, a FK e o gatilho por catálogo,
-- CREATE OR REPLACE nas funções. Termina com a conferência e o DESFAZER.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $u123pre$
BEGIN
  IF to_regclass('public.chamado_eventos') IS NULL THEN
    RAISE EXCEPTION 'U123: a tabela chamado_eventos não existe.';
  END IF;
  IF to_regprocedure('public.minhas_mencoes(integer)') IS NULL THEN
    RAISE EXCEPTION 'U123: minhas_mencoes não existe — rode a U117 e a U119 primeiro.';
  END IF;
END
$u123pre$;

-- ── §1  A LIGAÇÃO: esta mensagem responde àquela ───────────────────────────

ALTER TABLE public.chamado_eventos ADD COLUMN IF NOT EXISTS responde_a uuid;

DO $u123fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.chamado_eventos'::regclass
       AND conname = 'chamado_eventos_responde_a_fkey'
  ) THEN
    ALTER TABLE public.chamado_eventos
      ADD CONSTRAINT chamado_eventos_responde_a_fkey
      FOREIGN KEY (responde_a) REFERENCES public.chamado_eventos(id) ON DELETE SET NULL;
  END IF;
END
$u123fk$;

CREATE INDEX IF NOT EXISTS chamado_eventos_responde_a_idx
  ON public.chamado_eventos (responde_a) WHERE responde_a IS NOT NULL;

COMMENT ON COLUMN public.chamado_eventos.responde_a IS
  'R240 (U123): o comentário que esta mensagem responde — é o que faz a resposta enviada pelo chat ficar no mesmo campo da mensagem respondida. Null = comentário solto.';

-- O invariante, no banco: responder é responder a um comentário DA MESMA
-- atividade. A tela sempre manda o par certo; o gatilho é para o dia em que
-- outro cliente (ou uma correção à mão) mandar errado.
CREATE OR REPLACE FUNCTION public.checar_responde_a()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $u123t$
BEGIN
  IF NEW.responde_a IS NOT NULL THEN
    IF NEW.responde_a = NEW.id THEN
      RAISE EXCEPTION 'R240: uma mensagem não responde a si mesma.';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.chamado_eventos p
       WHERE p.id = NEW.responde_a
         AND p.chamado_id = NEW.chamado_id
         AND p.tipo = 'comentario'
    ) THEN
      RAISE EXCEPTION 'R240: só se responde a um comentário da MESMA atividade.';
    END IF;
  END IF;
  RETURN NEW;
END
$u123t$;

DROP TRIGGER IF EXISTS chamado_eventos_responde_a_valido ON public.chamado_eventos;
CREATE TRIGGER chamado_eventos_responde_a_valido
  BEFORE INSERT OR UPDATE OF responde_a ON public.chamado_eventos
  FOR EACH ROW EXECUTE FUNCTION public.checar_responde_a();

-- ── §2  A LEITURA: as respostas das atividades que o chat mostra ───────────

CREATE OR REPLACE FUNCTION public.respostas_do_chat(_chamados uuid[])
RETURNS TABLE (
  id         uuid,
  chamado_id uuid,
  responde_a uuid,
  autor_id   uuid,
  texto      text,
  criado_em  timestamptz
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $u123f$
  SELECT e.id, e.chamado_id, e.responde_a, e.user_id, e.descricao, e.created_at
    FROM public.chamado_eventos e
   WHERE e.tipo = 'comentario'
     AND e.responde_a IS NOT NULL
     AND e.chamado_id = ANY (coalesce(_chamados, ARRAY[]::uuid[]))
   ORDER BY e.created_at
   LIMIT 500;
$u123f$;

COMMENT ON FUNCTION public.respostas_do_chat(uuid[]) IS
  'R240 (U123): as respostas (comentários com responde_a) das atividades que o chat da Início está mostrando. SECURITY INVOKER — a RLS de chamado_eventos filtra.';

REVOKE ALL ON FUNCTION public.respostas_do_chat(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respostas_do_chat(uuid[]) TO authenticated, service_role;

COMMIT;

-- ── CONFERÊNCIA (obtido × esperado × veredito) ──────────────────────────────
WITH conferencia AS (
  SELECT 'R240: a coluna responde_a existe em chamado_eventos' AS item,
         (SELECT count(*)::text FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'chamado_eventos' AND column_name = 'responde_a') AS obtido,
         '1' AS esperado
  UNION ALL
  SELECT 'R240: a FK aponta para chamado_eventos com ON DELETE SET NULL',
         (SELECT confdeltype::text FROM pg_constraint
           WHERE conrelid = 'public.chamado_eventos'::regclass AND conname = 'chamado_eventos_responde_a_fkey'), 'n'
  UNION ALL
  SELECT 'R240: o índice parcial de responde_a existe',
         (SELECT count(*)::text FROM pg_indexes
           WHERE schemaname = 'public' AND indexname = 'chamado_eventos_responde_a_idx'), '1'
  UNION ALL
  SELECT 'R240: o gatilho do invariante está armado',
         (SELECT count(*)::text FROM pg_trigger
           WHERE tgrelid = 'public.chamado_eventos'::regclass
             AND tgname = 'chamado_eventos_responde_a_valido' AND NOT tgisinternal), '1'
  UNION ALL
  SELECT 'R240: respostas_do_chat existe, é SECURITY INVOKER e authenticated executa',
         (SELECT prosecdef::text FROM pg_proc WHERE oid = 'public.respostas_do_chat(uuid[])'::regprocedure)
           || '/' || has_function_privilege('authenticated', 'public.respostas_do_chat(uuid[])', 'EXECUTE')::text,
         'false/true'
  UNION ALL
  SELECT 'nenhuma resposta aponta para comentário de OUTRA atividade',
         (SELECT count(*)::text FROM public.chamado_eventos f
            JOIN public.chamado_eventos p ON p.id = f.responde_a
           WHERE p.chamado_id IS DISTINCT FROM f.chamado_id), '0'
  UNION ALL
  SELECT 'minhas_mencoes continua de pé (o chat depende dela)',
         (to_regprocedure('public.minhas_mencoes(integer)') IS NOT NULL)::text, 'true'
)
SELECT item, obtido, esperado,
       CASE WHEN obtido IS NOT DISTINCT FROM esperado THEN 'ok' ELSE '>>> OLHAR <<<' END AS veredito
  FROM conferencia;

-- ── DESFAZER ────────────────────────────────────────────────────────────────
-- Nesta ordem (a coluna vai por último; apagá-la apaga as ligações):
--
--   DROP FUNCTION IF EXISTS public.respostas_do_chat(uuid[]);
--   DROP TRIGGER IF EXISTS chamado_eventos_responde_a_valido ON public.chamado_eventos;
--   DROP FUNCTION IF EXISTS public.checar_responde_a();
--   DROP INDEX IF EXISTS public.chamado_eventos_responde_a_idx;
--   ALTER TABLE public.chamado_eventos DROP CONSTRAINT IF EXISTS chamado_eventos_responde_a_fkey;
--   ALTER TABLE public.chamado_eventos DROP COLUMN IF EXISTS responde_a;
--
-- Nada de conteúdo se perde: `responde_a` é ligação, não texto. Sem ela, a
-- resposta continua sendo o comentário que já era na atividade — só volta a
-- não aparecer no chat de quem respondeu (a tela se defende, regra 5).
