-- ═══════════════════════════════════════════════════════════════════════════
-- U131 — CORRIGIR A DATA DE CONCLUSÃO deixa rastro na linha do tempo (R262)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Davi, 12/09/2026: "Ao acessar a tela de configuração de uma atividade que
-- esteja concluída, deve ser possível alterar manualmente a data de conclusão,
-- apesar de ficar registrado na timeline quem alterou, de quando pra quando a
-- data de conclusão."
--
-- ── POR QUE O REGISTRO É DO BANCO, E NÃO DA TELA ──────────────────────────
--
-- A tela poderia gravar o evento junto com a correção — duas escritas, uma
-- atrás da outra. Não pode, e não deve:
--
--  · NÃO PODE. A policy de INSERT de `chamado_eventos` aceita do cliente
--    apenas `tipo = 'comentario'` com o `user_id` do próprio autor (U7/U95).
--    Todo o resto da linha do tempo nasce de gatilho SECURITY DEFINER — é
--    assim desde a Etapa 3, e é o que impede alguém de escrever "Fulano
--    aprovou" em nome de Fulano.
--  · NÃO DEVE. Registro que depende de a tela lembrar de escrever é registro
--    que some no dia em que alguém alterar a data por outro caminho (uma
--    correção em lote, uma RPC futura, o SQL Editor). Aqui a coluna é uma só,
--    e o gatilho vê TODAS as escritas dela.
--
-- ── O QUE CONTA COMO CORREÇÃO ─────────────────────────────────────────────
--
-- Só a alteração de uma data de conclusão em atividade que JÁ ESTAVA e
-- CONTINUA concluída. Os outros dois movimentos já têm linha própria:
--   · concluir       → `status` muda, e o evento de status já diz isso;
--   · reabrir        → `status` muda e `concluida_em` vira NULL — de novo, o
--                      evento de status conta a história.
-- Sem esse recorte, toda conclusão geraria DUAS linhas dizendo a mesma coisa.
--
-- A data aparece no fuso de São Paulo, que é o relógio de quem lê — `now()`
-- em UTC escreveria "concluída às 21h" para trabalho entregue às 18h.
--
-- ── O QUE ESTA MIGRATION NÃO FAZ ──────────────────────────────────────────
--
-- Não toca em `finalizada_em` nem em `fechada_em`. A competência da cobrança
-- sai de `COALESCE(finalizada_em, fechada_em, created_at)` (U4/U7): corrigir
-- a data que a GESTÃO lê não pode reescrever, em silêncio, um mês de dinheiro
-- já lançado. Se um dia for para mexer também no dinheiro, isso é outra regra,
-- com outro nome e outra conferência.
--
-- IDEMPOTENTE: CREATE OR REPLACE na função e DROP/CREATE no gatilho, que volta
-- com o MESMO NOME (`trg_chamado_evento_upd`) — o nome importa: a ordem de
-- disparo dos gatilhos de `chamados` é alfabética e está registrada na U82.
-- Não cria tabela, não cria coluna, não mexe em policy.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §0  PRÉ-VOO ────────────────────────────────────────────────────────────
DO $u131pre$
BEGIN
  IF to_regclass('public.chamados') IS NULL THEN
    RAISE EXCEPTION 'U131 PRÉ-VOO: public.chamados não existe — rode a U7 primeiro.';
  END IF;
  IF to_regclass('public.chamado_eventos') IS NULL THEN
    RAISE EXCEPTION 'U131 PRÉ-VOO: public.chamado_eventos não existe — rode a U7 primeiro.';
  END IF;
  IF to_regprocedure('public.chamado_registrar_evento()') IS NULL THEN
    RAISE EXCEPTION 'U131 PRÉ-VOO: chamado_registrar_evento não existe — esta migration a SUBSTITUI; rode a U7 primeiro.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'chamados' AND column_name = 'concluida_em'
  ) THEN
    RAISE EXCEPTION 'U131 PRÉ-VOO: chamados.concluida_em não existe — nada a registrar.';
  END IF;
END
$u131pre$;

-- ── §1  A FUNÇÃO, com o ramo novo ──────────────────────────────────────────
-- É a da U7 inteira, mais o último IF. Repetir os três ramos antigos é de
-- propósito: CREATE OR REPLACE substitui o corpo todo, e um corpo pela metade
-- apagaria em silêncio o registro de status, de responsável e de sprint.
CREATE OR REPLACE FUNCTION public.chamado_registrar_evento()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_de text;
  v_para text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.chamado_eventos (chamado_id, tipo, descricao, user_id)
    VALUES (NEW.id, 'aberto', 'Chamado aberto', NEW.aberto_por);
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.chamado_eventos (chamado_id, tipo, descricao, user_id)
    VALUES (NEW.id, NEW.status, 'Status: ' || OLD.status || ' → ' || NEW.status, auth.uid());
  END IF;
  IF NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id THEN
    INSERT INTO public.chamado_eventos (chamado_id, tipo, descricao, user_id)
    VALUES (NEW.id, 'atribuido',
            CASE WHEN NEW.responsavel_id IS NULL THEN 'Responsável removido'
                 ELSE 'Responsável definido' END, auth.uid());
  END IF;
  IF NEW.sprint IS DISTINCT FROM OLD.sprint THEN
    INSERT INTO public.chamado_eventos (chamado_id, tipo, descricao, user_id)
    VALUES (NEW.id, 'sprint', 'Sprint: ' || COALESCE(OLD.sprint,'—') || ' → ' || COALESCE(NEW.sprint,'—'), auth.uid());
  END IF;

  -- R262 (U131): a data de conclusão corrigida à mão.
  -- O recorte é o que evita linha duplicada: a atividade já estava concluída,
  -- continua concluída, e a data mudou. Concluir e reabrir mexem no status, e
  -- o ramo de status logo acima já conta essas duas.
  IF NEW.concluida_em IS DISTINCT FROM OLD.concluida_em
     AND NEW.concluida_em IS NOT NULL
     AND NEW.status = 'concluido'
     AND OLD.status = 'concluido'
  THEN
    v_de := COALESCE(
      to_char(OLD.concluida_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'), '—');
    v_para := to_char(NEW.concluida_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI');
    INSERT INTO public.chamado_eventos (chamado_id, tipo, descricao, user_id)
    VALUES (NEW.id, 'conclusao_corrigida',
            'Data de conclusão: ' || v_de || ' → ' || v_para, auth.uid());
  END IF;

  RETURN NEW;
END;
$$;

-- ── §2  O GATILHO, agora olhando também a coluna da conclusão ──────────────
-- MESMO NOME de sempre: a ordem alfabética de disparo dos gatilhos de
-- `chamados` está registrada na U82 e não pode mudar por causa disto.
DROP TRIGGER IF EXISTS trg_chamado_evento_upd ON public.chamados;
CREATE TRIGGER trg_chamado_evento_upd
  AFTER UPDATE OF status, responsavel_id, sprint, concluida_em ON public.chamados
  FOR EACH ROW EXECUTE FUNCTION public.chamado_registrar_evento();

COMMIT;

-- ── §3  PORTÃO (escreve, confere e DESFAZ tudo) ────────────────────────────
-- Numa transação PRÓPRIA que termina em ROLLBACK. O portão precisa inserir um
-- chamado de verdade para o gatilho ter o que ver, e um chamado de verdade
-- acorda os outros gatilhos da tabela (notificação, capa, agenda) — o ROLLBACK
-- é o que garante que nada disso sobrevive, mesmo que algum deles escreva numa
-- tabela que este arquivo nem menciona. Se o portão gritar, a correção do §1 e
-- do §2 JÁ ESTÁ aplicada (o COMMIT acima) e o DESFAZER do rodapé é uma linha.
BEGIN;

DO $u131portao$
DECLARE
  v_id uuid;
  v_eventos int;
  v_texto text;
BEGIN
  -- Um chamado de teste, com número fora da faixa de produção.
  INSERT INTO public.chamados (titulo, status, natureza, concluida_em)
  VALUES ('U131 PORTÃO — apagar', 'concluido', 'interno', TIMESTAMPTZ '2026-01-10 15:00-03')
  RETURNING id INTO v_id;

  -- 1) mudar a data de uma concluída registra UMA linha, com de → para
  UPDATE public.chamados SET concluida_em = TIMESTAMPTZ '2026-01-12 09:30-03' WHERE id = v_id;
  SELECT count(*), max(descricao) INTO v_eventos, v_texto
    FROM public.chamado_eventos WHERE chamado_id = v_id AND tipo = 'conclusao_corrigida';
  IF v_eventos <> 1 THEN
    RAISE EXCEPTION 'U131 PORTÃO 1: esperava 1 evento de correção, vieram %.', v_eventos;
  END IF;
  IF v_texto <> 'Data de conclusão: 10/01/2026 15:00 → 12/01/2026 09:30' THEN
    RAISE EXCEPTION 'U131 PORTÃO 2: o texto saiu como "%".', v_texto;
  END IF;

  -- 2) reabrir NÃO registra correção (é o status que conta a história)
  UPDATE public.chamados SET status = 'em_andamento', concluida_em = NULL WHERE id = v_id;
  SELECT count(*) INTO v_eventos
    FROM public.chamado_eventos WHERE chamado_id = v_id AND tipo = 'conclusao_corrigida';
  IF v_eventos <> 1 THEN
    RAISE EXCEPTION 'U131 PORTÃO 3: reabrir criou linha de correção (agora são %).', v_eventos;
  END IF;

  -- 3) concluir de novo também NÃO registra correção
  UPDATE public.chamados
     SET status = 'concluido', concluida_em = TIMESTAMPTZ '2026-01-20 18:00-03'
   WHERE id = v_id;
  SELECT count(*) INTO v_eventos
    FROM public.chamado_eventos WHERE chamado_id = v_id AND tipo = 'conclusao_corrigida';
  IF v_eventos <> 1 THEN
    RAISE EXCEPTION 'U131 PORTÃO 4: concluir criou linha de correção (agora são %).', v_eventos;
  END IF;

  -- 4) os ramos antigos continuam vivos: trocar o status escreve a linha dele
  SELECT count(*) INTO v_eventos
    FROM public.chamado_eventos WHERE chamado_id = v_id AND tipo IN ('concluido', 'em_andamento');
  IF v_eventos < 2 THEN
    RAISE EXCEPTION 'U131 PORTÃO 5: os eventos de status sumiram (vieram %).', v_eventos;
  END IF;

  RAISE NOTICE 'U131 PORTÃO: ok — correção registra uma linha com de → para; concluir e reabrir não duplicam.';
END
$u131portao$;

ROLLBACK;

-- ── CONFERÊNCIA (obtido × esperado × veredito) ──────────────────────────────
WITH conferencia AS (
  SELECT 'R262: o gatilho da linha do tempo também olha concluida_em' AS item,
         (SELECT count(*)::text FROM information_schema.triggers
           WHERE trigger_schema = 'public' AND event_object_table = 'chamados'
             AND trigger_name = 'trg_chamado_evento_upd') AS obtido,
         '1' AS esperado
  UNION ALL
  SELECT 'R262: a coluna concluida_em está na lista de colunas do gatilho',
         (SELECT (array_to_string(array_agg(c.attname ORDER BY c.attname), ','))
            FROM pg_trigger t
            JOIN LATERAL unnest(t.tgattr::int2[]) AS a(attnum) ON true
            JOIN pg_attribute c ON c.attrelid = t.tgrelid AND c.attnum = a.attnum
           WHERE t.tgrelid = 'public.chamados'::regclass AND t.tgname = 'trg_chamado_evento_upd'),
         'concluida_em,responsavel_id,sprint,status'
  UNION ALL
  SELECT 'R262: a função registra a correção com de → para',
         (pg_get_functiondef('public.chamado_registrar_evento()'::regprocedure)
           LIKE '%conclusao_corrigida%')::text, 'true'
  UNION ALL
  SELECT 'R262: só conta como correção quem já estava e continua concluído',
         (pg_get_functiondef('public.chamado_registrar_evento()'::regprocedure)
           LIKE '%OLD.status = ''concluido''%')::text, 'true'
  UNION ALL
  SELECT 'R262: a data sai no fuso de quem lê, não em UTC',
         (pg_get_functiondef('public.chamado_registrar_evento()'::regprocedure)
           LIKE '%America/Sao_Paulo%')::text, 'true'
  UNION ALL
  SELECT 'U7 intacta: os três ramos antigos continuam na função',
         ((pg_get_functiondef('public.chamado_registrar_evento()'::regprocedure) LIKE '%Chamado aberto%')
      AND (pg_get_functiondef('public.chamado_registrar_evento()'::regprocedure) LIKE '%Responsável definido%')
      AND (pg_get_functiondef('public.chamado_registrar_evento()'::regprocedure) LIKE '%Sprint: %'))::text, 'true'
  UNION ALL
  SELECT 'R262: a função continua SECURITY DEFINER (o cliente não escreve evento que não seja comentário)',
         (SELECT p.prosecdef::text FROM pg_proc p
           WHERE p.oid = 'public.chamado_registrar_evento()'::regprocedure), 'true'
  UNION ALL
  SELECT 'R262: o portão não deixou sujeira',
         (SELECT count(*)::text FROM public.chamados WHERE titulo = 'U131 PORTÃO — apagar'), '0'
)
SELECT item, obtido, esperado,
       CASE WHEN obtido IS NOT DISTINCT FROM esperado THEN 'ok' ELSE '>>> OLHAR <<<' END AS veredito
  FROM conferencia;

-- ── DESFAZER ────────────────────────────────────────────────────────────────
-- Volta a função e o gatilho da U7 (sem o ramo da conclusão):
--
--   DROP TRIGGER IF EXISTS trg_chamado_evento_upd ON public.chamados;
--   CREATE TRIGGER trg_chamado_evento_upd
--     AFTER UPDATE OF status, responsavel_id, sprint ON public.chamados
--     FOR EACH ROW EXECUTE FUNCTION public.chamado_registrar_evento();
--
-- (a função pode ficar como está: o ramo novo só dispara quando a coluna
-- `concluida_em` está na lista do gatilho. Para reverter também o corpo, copie
-- a definição da U7, §"Linha do tempo".)
--
-- As linhas já escritas não se apagam no DESFAZER: elas são o registro do que
-- aconteceu, e apagar histórico para desfazer código seria trocar o defeito
-- por uma mentira.
