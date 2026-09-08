-- ============================================================================
-- U117 — REAÇÕES a comentário e a leitura "minhas menções" (R215–R217)
-- ============================================================================
--
-- Davi, 2026-09-08: "Adicione um botão circular de Chat, na tela Início […]
-- onde aparecerá todas as menções a aquele usuário […] deve ter um botão de
-- responder aqui […] Além disso no chat deve dar para reagir se for
-- comentário, reagindo no comentário da atividade."
--
-- O QUE ESTA MIGRATION FAZ (duas coisas, nenhuma toca em public.chamados):
--
--   1) public.chamado_reacoes — a REAÇÃO (emoji) de uma pessoa a um COMENTÁRIO
--      (chamado_eventos.tipo = 'comentario'). Uma por pessoa+comentário+emoji
--      (CONSTRAINT UNIQUE — não índice parcial: o ON CONFLICT infere sem o
--      42P10 da U110). chamado_id DESNORMALIZADO de propósito: a policy usa a
--      régua da casa, pode_acessar_chamado(chamado_id), sem subselect por
--      linha, e o app lê todas as reações de uma atividade num SELECT só.
--      A lista de emojis é FECHADA e é A MESMA de EMOJIS_REACAO em
--      src/features/home/chat.ts — o verificador compara as duas.
--
--   2) public.minhas_mencoes(_limite) — a leitura "quem me mencionou": os
--      comentários (chamado_eventos) e as descrições (chamados.descricao_problema)
--      cujo texto menciona auth.uid(). REUSA public.mencoes_em (U95) — a regex
--      da menção existe em UM lugar no banco e o verificador a compara com a do
--      TS. SECURITY INVOKER: a RLS de chamados e de chamado_eventos filtra
--      sozinha (a régua S4). Nenhuma tabela nova de "menção": a menção continua
--      sendo o token no texto; o sino continua sendo public.notificacoes (U95).
--
-- O QUE NÃO FAZ: não cria gatilho em chamados (o censo de gatilhos da U82 não
-- muda), não escreve em chamado_eventos (reação não é evento da linha do
-- tempo), não edita a U95 (já rodou).
--
-- ORDEM: exige a U95 (mencoes_em e o gatilho de menção — rodada em 03/09/2026).
-- Independe da U106, da U109 e da U110. Idempotente: pode rodar de novo.
--
-- REGRA 5 (ordem de deploy): o app trata 42P01 (tabela ausente) e
-- 42883/PGRST202 (função ausente) como "a migration ainda não rodou" — as
-- reações não aparecem e o chat avisa, sem tela vermelha.
-- ============================================================================

-- ── PRÉ-VOO ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regprocedure('public.mencoes_em(text)') IS NULL THEN
    RAISE EXCEPTION 'U117: rode a U95 antes — public.mencoes_em(text) não existe';
  END IF;
  IF to_regclass('public.chamado_eventos') IS NULL THEN
    RAISE EXCEPTION 'U117: public.chamado_eventos não existe';
  END IF;
  IF to_regprocedure('public.pode_acessar_chamado(uuid)') IS NULL THEN
    RAISE EXCEPTION 'U117: public.pode_acessar_chamado(uuid) não existe (S2/S4)';
  END IF;
END $$;

-- ── 1) REAÇÕES ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chamado_reacoes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id  uuid NOT NULL REFERENCES public.chamado_eventos(id) ON DELETE CASCADE,
  chamado_id uuid NOT NULL REFERENCES public.chamados(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chamado_reacoes_unica UNIQUE (evento_id, profile_id, emoji),
  CONSTRAINT chamado_reacoes_emoji_check CHECK (emoji IN ('👍','❤️','😂','😮','😢','🙏','✅','👀'))
);
COMMENT ON TABLE public.chamado_reacoes IS
  'R217 (U117): reação (emoji) de uma pessoa a um COMENTÁRIO de atividade. Uma por pessoa+comentário+emoji. chamado_id desnormalizado para a policy e para o SELECT por atividade. A lista de emojis é a mesma de EMOJIS_REACAO no app.';

CREATE INDEX IF NOT EXISTS chamado_reacoes_chamado_idx ON public.chamado_reacoes (chamado_id);
CREATE INDEX IF NOT EXISTS chamado_reacoes_evento_idx  ON public.chamado_reacoes (evento_id);

GRANT SELECT, INSERT, DELETE ON public.chamado_reacoes TO authenticated;  -- sem UPDATE: reagir/desreagir é insert/delete
GRANT ALL ON public.chamado_reacoes TO service_role;
ALTER TABLE public.chamado_reacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chamado_reacoes_select" ON public.chamado_reacoes;
CREATE POLICY "chamado_reacoes_select" ON public.chamado_reacoes
  FOR SELECT TO authenticated
  USING (public.pode_acessar_chamado(chamado_id));            -- quem vê a atividade vê as reações (a régua da S4)

DROP POLICY IF EXISTS "chamado_reacoes_insert_proprio" ON public.chamado_reacoes;
CREATE POLICY "chamado_reacoes_insert_proprio" ON public.chamado_reacoes
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = auth.uid()
    AND public.pode_acessar_chamado(chamado_id)
    -- o chamado_id desnormalizado tem de bater com o do comentário, e só se reage a COMENTÁRIO
    AND EXISTS (
      SELECT 1 FROM public.chamado_eventos e
       WHERE e.id = evento_id AND e.chamado_id = chamado_reacoes.chamado_id AND e.tipo = 'comentario'
    )
  );

DROP POLICY IF EXISTS "chamado_reacoes_delete_proprio" ON public.chamado_reacoes;
CREATE POLICY "chamado_reacoes_delete_proprio" ON public.chamado_reacoes
  FOR DELETE TO authenticated
  USING (profile_id = auth.uid());                            -- só a própria reação

-- ── 2) MINHAS MENÇÕES — a leitura do chat ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.minhas_mencoes(_limite integer DEFAULT 100)
RETURNS TABLE (
  origem     text,
  chamado_id uuid,
  numero     text,
  titulo     text,
  evento_id  uuid,
  autor_id   uuid,
  texto      text,
  criado_em  timestamptz
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $u117$
  SELECT m.origem, m.chamado_id, m.numero, m.titulo, m.evento_id, m.autor_id, m.texto, m.criado_em
    FROM (
      -- menção num COMENTÁRIO: o texto inteiro do comentário
      SELECT 'comentario'::text AS origem, e.chamado_id, c.numero, c.titulo,
             e.id AS evento_id, e.user_id AS autor_id, e.descricao AS texto, e.created_at AS criado_em
        FROM public.chamado_eventos e
        JOIN public.chamados c ON c.id = e.chamado_id
       WHERE e.tipo = 'comentario'
         AND public.mencoes_em(coalesce(e.descricao, '')) @> ARRAY[auth.uid()]
      UNION ALL
      -- menção na DESCRIÇÃO da atividade: o app recorta o parágrafo com a menção
      SELECT 'descricao'::text, c.id, c.numero, c.titulo,
             NULL::uuid, c.aberto_por, c.descricao_problema, coalesce(c.updated_at, c.created_at)
        FROM public.chamados c
       WHERE public.mencoes_em(coalesce(c.descricao_problema, '')) @> ARRAY[auth.uid()]
    ) m
   ORDER BY m.criado_em DESC
   LIMIT greatest(1, least(coalesce(_limite, 100), 500));
$u117$;

COMMENT ON FUNCTION public.minhas_mencoes(integer) IS
  'R215 (U117): as menções a quem chama — comentários e descrições cujo texto traz @[Nome](user:<meu id>). SECURITY INVOKER: a RLS de chamados/chamado_eventos filtra. Reusa mencoes_em (U95).';

REVOKE ALL ON FUNCTION public.minhas_mencoes(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.minhas_mencoes(integer) TO authenticated, service_role;

-- ── CONFERÊNCIA (obtido × esperado × veredito) ──────────────────────────────
WITH conferencia AS (
  SELECT 'tabela chamado_reacoes existe' AS item,
         (to_regclass('public.chamado_reacoes') IS NOT NULL)::text AS obtido, 'true' AS esperado
  UNION ALL
  SELECT 'RLS ligada em chamado_reacoes',
         (SELECT relrowsecurity::text FROM pg_class WHERE oid = 'public.chamado_reacoes'::regclass), 'true'
  UNION ALL
  SELECT 'chamado_reacoes tem 3 policies',
         (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chamado_reacoes'), '3'
  UNION ALL
  SELECT 'nenhuma policy permissiva (qual = true) em chamado_reacoes',
         (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chamado_reacoes' AND qual = 'true'), '0'
  UNION ALL
  SELECT 'unicidade pessoa+comentário+emoji é CONSTRAINT UNIQUE',
         (SELECT count(*)::text FROM pg_constraint WHERE conrelid = 'public.chamado_reacoes'::regclass AND conname = 'chamado_reacoes_unica' AND contype = 'u'), '1'
  UNION ALL
  SELECT 'CHECK de emoji existe',
         (SELECT count(*)::text FROM pg_constraint WHERE conrelid = 'public.chamado_reacoes'::regclass AND conname = 'chamado_reacoes_emoji_check' AND contype = 'c'), '1'
  UNION ALL
  SELECT 'authenticated NÃO tem UPDATE em chamado_reacoes',
         has_table_privilege('authenticated', 'public.chamado_reacoes', 'UPDATE')::text, 'false'
  UNION ALL
  SELECT 'minhas_mencoes existe',
         (to_regprocedure('public.minhas_mencoes(integer)') IS NOT NULL)::text, 'true'
  UNION ALL
  SELECT 'minhas_mencoes é SECURITY INVOKER (a RLS filtra)',
         (SELECT (NOT prosecdef)::text FROM pg_proc WHERE oid = 'public.minhas_mencoes(integer)'::regprocedure), 'true'
  UNION ALL
  SELECT 'minhas_mencoes reusa mencoes_em (não copia a regex)',
         (SELECT (pg_get_functiondef('public.minhas_mencoes(integer)'::regprocedure) LIKE '%mencoes_em(%')::text), 'true'
  UNION ALL
  SELECT 'authenticated executa minhas_mencoes',
         has_function_privilege('authenticated', 'public.minhas_mencoes(integer)', 'EXECUTE')::text, 'true'
  UNION ALL
  SELECT 'gatilhos da U95 continuam vivos',
         (SELECT count(*)::text FROM pg_trigger WHERE tgname IN ('trg_notify_chamado_comentario', 'trg_notify_mencao_descricao') AND NOT tgisinternal), '2'
)
SELECT item, obtido, esperado,
       CASE WHEN obtido = esperado THEN 'ok' ELSE '>>> OLHAR <<<' END AS veredito
  FROM conferencia;

-- ── DESFAZER (se for preciso voltar) ────────────────────────────────────────
-- DROP FUNCTION IF EXISTS public.minhas_mencoes(integer);
-- DROP TABLE IF EXISTS public.chamado_reacoes;
-- (as reações gravadas se perdem; a menção continua existindo como token no texto)
