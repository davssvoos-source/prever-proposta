-- ═══════════════════════════════════════════════════════════════════════════
-- U95 — A MENÇÃO AVISA, E O AUTOR APAGA O PRÓPRIO COMENTÁRIO (R135)
--
-- >>> RODAR NO SQL EDITOR DO SUPABASE, À MÃO. Idempotente.
-- >>> ORDEM DE DEPLOY: indiferente — a migration é ADITIVA e o código não
-- >>> nomeia nada daqui. Sem ela: a menção é gravada como texto e ninguém é
-- >>> avisado; apagar comentário devolve "só quem escreveu pode apagá-lo".
-- >>> Com ela: os dois passam a funcionar. Nada quebra em nenhuma ordem.
--
-- Davi, 03/09/2026: "no espaço do texto deve poder mencionar outros usuários,
-- lembrando que sempre que alguém é mencionado em qualquer lugar, o usuário
-- recebe notificação. Por falar em menção, nos comentários das atividades, deve
-- ter a opção de excluir comentário (por quem escreveu)."
--
-- ── O TOKEN ──────────────────────────────────────────────────────────────────
-- O editor grava a menção como `@[Nome](user:<uuid>)` (src/lib/texto-rico.ts).
-- O NOME vai para o texto continuar legível onde ele é mostrado cru; o ID vai
-- porque é ele que avisa — casar por nome traria homônimo e quebraria quando
-- alguém mudasse o cadastro. `mencoes_em()` extrai os ids; é a MESMA regex do
-- TypeScript, e a asserção do verificador compara as duas.
--
-- ── DOIS GATILHOS, UMA REGRA: UM SINO POR MENÇÃO NOVA ───────────────────────
-- 1. COMENTÁRIO (INSERT em chamado_eventos): avisa cada mencionado, exceto o
--    autor. E o gatilho de "Novo comentário" que já existia (u7) passa a PULAR
--    quem foi mencionado — a pessoa recebe "Você foi mencionado", que é o aviso
--    mais específico, e não os dois.
-- 2. DESCRIÇÃO (UPDATE OF descricao_problema em chamados): avisa só as menções
--    que NÃO estavam no texto anterior. O editor grava a cada 700 ms parado; sem
--    o diff, cada tecla depois da menção tocaria o sino de novo.
--
-- ── O AUTOR APAGA ────────────────────────────────────────────────────────────
-- Uma policy de DELETE: `tipo = 'comentario' AND user_id = auth.uid()`. Só o
-- comentário (a linha do tempo nasce de gatilho e é registro), só o autor.
-- Gestor NÃO apaga comentário de outro — o pedido foi "por quem escreveu", e
-- apagar fala alheia é o tipo de porta que se abre com pedido explícito.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §1) mencoes_em(texto) → uuid[] ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mencoes_em(_texto text)
RETURNS uuid[]
LANGUAGE sql IMMUTABLE STRICT
AS $u95a$
  SELECT COALESCE(
    ARRAY(
      SELECT DISTINCT (m[1])::uuid
      FROM regexp_matches(
        _texto,
        '@\[[^\]\n]+\]\(user:([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\)',
        'g'
      ) AS m
    ),
    ARRAY[]::uuid[]
  );
$u95a$;

COMMENT ON FUNCTION public.mencoes_em(text) IS
  'U95/R135: os ids mencionados num texto (`@[Nome](user:uuid)`). Gêmea da '
  'regex de src/lib/texto-rico.ts — o verificador compara as duas.';

REVOKE EXECUTE ON FUNCTION public.mencoes_em(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.mencoes_em(text) TO authenticated, service_role;

-- ── §2) o aviso de menção, reaproveitável pelos dois gatilhos ───────────────
CREATE OR REPLACE FUNCTION public.notificar_mencoes(_chamado_id uuid, _alvos uuid[], _autor uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $u95b$
DECLARE
  c record;
  v_n integer := 0;
BEGIN
  IF _alvos IS NULL OR array_length(_alvos, 1) IS NULL THEN RETURN 0; END IF;
  SELECT numero, titulo INTO c FROM public.chamados WHERE id = _chamado_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, chamado_id)
  SELECT p.id, 'mencao', 'Você foi mencionado',
         coalesce(c.numero, '') || ' · ' || coalesce(c.titulo, ''), _chamado_id
  FROM public.profiles p
  WHERE p.id = ANY (_alvos)
    AND p.id IS DISTINCT FROM _autor
    AND p.ativo IS DISTINCT FROM false;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$u95b$;

REVOKE EXECUTE ON FUNCTION public.notificar_mencoes(uuid, uuid[], uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.notificar_mencoes(uuid, uuid[], uuid) TO service_role;

-- ── §3) comentário: menção avisa; "novo comentário" pula os mencionados ─────
CREATE OR REPLACE FUNCTION public.notify_chamado_comentario()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $u95c$
DECLARE
  c record;
  v_mencionados uuid[];
BEGIN
  IF NEW.tipo <> 'comentario' THEN RETURN NEW; END IF;
  SELECT numero, titulo, responsavel_id, aberto_por INTO c
  FROM public.chamados WHERE id = NEW.chamado_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- U95: quem foi mencionado recebe "Você foi mencionado" e NÃO "Novo comentário"
  v_mencionados := public.mencoes_em(coalesce(NEW.descricao, ''));
  PERFORM public.notificar_mencoes(NEW.chamado_id, v_mencionados, NEW.user_id);

  INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, chamado_id)
  SELECT DISTINCT alvo, 'chamado_comentario', 'Novo comentário',
         c.numero || ' · ' || c.titulo, NEW.chamado_id
  FROM (SELECT c.responsavel_id AS alvo
        UNION SELECT c.aberto_por
        UNION SELECT a.profile_id FROM public.chamado_apoios a WHERE a.chamado_id = NEW.chamado_id) e
  WHERE alvo IS NOT NULL
    AND alvo IS DISTINCT FROM NEW.user_id
    AND NOT (alvo = ANY (v_mencionados));
  RETURN NEW;
END;
$u95c$;

DROP TRIGGER IF EXISTS trg_notify_chamado_comentario ON public.chamado_eventos;
CREATE TRIGGER trg_notify_chamado_comentario AFTER INSERT ON public.chamado_eventos
  FOR EACH ROW EXECUTE FUNCTION public.notify_chamado_comentario();

-- ── §4) descrição: só as menções NOVAS avisam ───────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_mencao_descricao()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $u95d$
DECLARE
  v_antes  uuid[];
  v_depois uuid[];
  v_novas  uuid[];
BEGIN
  IF NEW.descricao_problema IS NOT DISTINCT FROM OLD.descricao_problema THEN RETURN NEW; END IF;
  v_antes  := public.mencoes_em(coalesce(OLD.descricao_problema, ''));
  v_depois := public.mencoes_em(coalesce(NEW.descricao_problema, ''));
  v_novas  := ARRAY(SELECT unnest(v_depois) EXCEPT SELECT unnest(v_antes));
  PERFORM public.notificar_mencoes(NEW.id, v_novas, auth.uid());
  RETURN NEW;
END;
$u95d$;

DROP TRIGGER IF EXISTS trg_notify_mencao_descricao ON public.chamados;
CREATE TRIGGER trg_notify_mencao_descricao AFTER UPDATE OF descricao_problema ON public.chamados
  FOR EACH ROW EXECUTE FUNCTION public.notify_mencao_descricao();

-- ── §5) o autor apaga o próprio comentário ──────────────────────────────────
GRANT DELETE ON public.chamado_eventos TO authenticated;

DROP POLICY IF EXISTS "chamado_eventos_delete_autor" ON public.chamado_eventos;
CREATE POLICY "chamado_eventos_delete_autor" ON public.chamado_eventos
  FOR DELETE TO authenticated
  USING (tipo = 'comentario' AND user_id = auth.uid());

COMMENT ON POLICY "chamado_eventos_delete_autor" ON public.chamado_eventos IS
  'U95/R135: só o AUTOR apaga, e só COMENTÁRIO — a linha do tempo é registro '
  'de gatilho e não se apaga pela tela.';

COMMIT;

-- ── Verificação ─────────────────────────────────────────────────────────────
SELECT 'mencoes_em acha os dois ids e ignora o texto solto (esperado 2)' AS item,
       array_length(public.mencoes_em(
         'oi @[Ana](user:11111111-1111-1111-1111-111111111111) e @[Bia](user:22222222-2222-2222-2222-222222222222) e um e-mail@x'), 1)::text AS valor
UNION ALL
SELECT 'mencoes_em sem menção devolve vazio (esperado 0)',
       coalesce(array_length(public.mencoes_em('sem ninguém aqui'), 1), 0)::text
UNION ALL
SELECT 'gatilho de menção na descrição VIVO em chamados (esperado 1)',
       count(*)::text FROM pg_trigger WHERE tgname = 'trg_notify_mencao_descricao' AND NOT tgisinternal
UNION ALL
SELECT 'gatilho de comentário VIVO em chamado_eventos (esperado 1)',
       count(*)::text FROM pg_trigger WHERE tgname = 'trg_notify_chamado_comentario' AND NOT tgisinternal
UNION ALL
SELECT 'o corpo do gatilho de comentário PULA os mencionados (esperado 1)',
       (position('NOT (alvo = ANY (v_mencionados))' IN pg_get_functiondef('public.notify_chamado_comentario()'::regprocedure)) > 0)::int::text
UNION ALL
SELECT 'policy de DELETE do autor existe (esperado 1)',
       count(*)::text FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'chamado_eventos' AND policyname = 'chamado_eventos_delete_autor'
UNION ALL
SELECT 'authenticated tem DELETE em chamado_eventos (esperado true)',
       has_table_privilege('authenticated', 'public.chamado_eventos', 'DELETE')::text;

-- ── DESFAZER ────────────────────────────────────────────────────────────────
-- DROP TRIGGER IF EXISTS trg_notify_mencao_descricao ON public.chamados;
-- DROP FUNCTION IF EXISTS public.notify_mencao_descricao();
-- DROP POLICY IF EXISTS "chamado_eventos_delete_autor" ON public.chamado_eventos;
-- REVOKE DELETE ON public.chamado_eventos FROM authenticated;
-- DROP FUNCTION IF EXISTS public.notificar_mencoes(uuid, uuid[], uuid);
-- DROP FUNCTION IF EXISTS public.mencoes_em(text);
-- (e recriar public.notify_chamado_comentario() com o corpo da U7 — o mesmo
--  deste arquivo sem as três linhas de v_mencionados.)
