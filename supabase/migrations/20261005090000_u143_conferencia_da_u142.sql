-- ═══════════════════════════════════════════════════════════════════════════
-- U143 — A CONFERÊNCIA E O PORTÃO DA U142, REFEITOS
--
-- A U142 aplicou o trabalho dela e FALHOU NO PORTÃO — o teste do fim, que roda
-- depois do COMMIT. Por causa disso o Davi nunca viu a conferência: o SQL
-- Editor mostra o erro no lugar do último resultado.
--
-- Esta migration NÃO muda schema. Ela existe para (1) imprimir a conferência
-- que a U142 não conseguiu mostrar e (2) rodar o portão de verdade, corrigido.
--
-- ── O DEFEITO DO PORTÃO ────────────────────────────────────────────────────
-- Ele pegava `SELECT id FROM profiles ORDER BY id LIMIT 1` — uma pessoa REAL,
-- que o backfill já tinha posto numa equipe com faixa aberta. A primeira
-- inserção do teste então colidia com a composição de verdade, e o erro subia
-- ANTES do bloco que sabia tratá-lo:
--
--   ERROR 23P01: conflicting key value violates exclusion constraint
--   "equipe_membros_uma_equipe_por_vez"
--
-- O erro é, ele mesmo, a prova de que a regra funciona: foi a restrição
-- recusando a mesma pessoa em duas equipes ao mesmo tempo. O que estava errado
-- era o teste, não a regra. Aqui o portão usa gente LIVRE — quem não tem
-- nenhuma faixa aberta — e pula com aviso se não houver duas pessoas assim.
--
-- ── O QUE EU QUASE "CONSERTEI" E NÃO DEVIA ─────────────────────────────────
-- As seis linhas do backfill nasceram com `entrou_em = 0001-01-01`, e a minha
-- primeira leitura foi "data absurda, corrigir". Estava errado: `0001-S01` é o
-- MARCO ZERO que a U76 criou de propósito, com o motivo escrito no arquivo —
-- "antes de '0001-S01' não existe data", para que uma importação retroativa não
-- caia antes da âncora e perca a turma em silêncio.
--
-- No modelo por instante esse motivo vale IGUAL: um chamado com
-- `data_hora_agendada` retroativa pergunta "quem estava na equipe naquele dia?"
-- e, com a faixa começando em 31/08/2026, receberia NINGUÉM — o apoio sumiria
-- sem erro nenhum. A faixa que começa no marco zero responde "esta equipe,
-- desde sempre", que é a verdade que o sistema tem.
--
-- O ano 1 é feio na tela, e é problema DE TELA: quem desenhar a composição
-- mostra "desde sempre" no lugar da data (ver `ehMarcoZero` em
-- src/features/duplas/modelo.ts). Trocar o dado para arrumar a vista teria
-- reintroduzido, calado, o defeito que a U76 documentou.
--
-- IDEMPOTENTE: não escreve nada fora do portão, e o portão desfaz o que faz.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── §0  PRÉ-VOO ────────────────────────────────────────────────────────────
DO $u143pre$
DECLARE
  v_falta text := '';
BEGIN
  IF to_regclass('public.equipe_membros') IS NULL THEN
    RAISE EXCEPTION E'U143 PRÉ-VOO: `equipe_membros` não existe.\nA U142 não chegou a aplicar o trabalho dela — rode a U142 primeiro, e só depois esta.';
  END IF;
  IF to_regprocedure('public.equipe_da_pessoa(uuid, timestamptz)') IS NULL THEN
    v_falta := v_falta || E'\n  · public.equipe_da_pessoa(uuid, timestamptz)'; END IF;
  IF to_regprocedure('public.parceiros_da_equipe(uuid, timestamptz)') IS NULL THEN
    v_falta := v_falta || E'\n  · public.parceiros_da_equipe(uuid, timestamptz)'; END IF;
  IF to_regprocedure('public.equipe_definir_membro(uuid, uuid, text, boolean)') IS NULL THEN
    v_falta := v_falta || E'\n  · public.equipe_definir_membro(uuid, uuid, text, boolean)'; END IF;
  IF v_falta <> '' THEN
    RAISE EXCEPTION E'U143 PRÉ-VOO: a U142 aplicou a tabela mas não as funções — ela parou no meio.%\nRode a U142 de novo (ela é idempotente) antes desta.', v_falta;
  END IF;
END
$u143pre$;

-- ═══════════════════════════════════════════════════════════════════════════
-- §1  A CONFERÊNCIA DA U142 — olhe a coluna VEREDITO
-- ═══════════════════════════════════════════════════════════════════════════
WITH conferencia AS (

  SELECT 1 AS n, 'a tabela existe' AS o_que,
         (to_regclass('public.equipe_membros') IS NOT NULL)::text AS obtido, 'true' AS esperado
  UNION ALL
  SELECT 2, 'as duas garantias são EXCLUDE (não gatilho)',
         (SELECT count(*)::text FROM pg_constraint
           WHERE conrelid = 'public.equipe_membros'::regclass AND contype = 'x'), '2'
  UNION ALL
  SELECT 3, 'RLS ligada',
         (SELECT relrowsecurity::text FROM pg_class WHERE oid = 'public.equipe_membros'::regclass), 'true'
  UNION ALL
  SELECT 4, 'a composição de HOJE veio (ninguém perdeu equipe)',
         (SELECT count(DISTINCT pessoa_id)::text FROM public.equipe_membros WHERE saiu_em IS NULL),
         (SELECT count(DISTINCT e.pessoa_id)::text
            FROM public.duplas_escala e
           WHERE e.semana = (SELECT max(semana) FROM public.duplas_escala_semanas))
  UNION ALL
  SELECT 5, 'ninguém está em duas equipes ao mesmo tempo',
         (SELECT count(*)::text FROM (
            SELECT pessoa_id FROM public.equipe_membros WHERE saiu_em IS NULL
             GROUP BY pessoa_id HAVING count(*) > 1) x), '0'
  UNION ALL
  SELECT 6, 'nenhuma equipe tem dois líderes',
         (SELECT count(*)::text FROM (
            SELECT equipe_id FROM public.equipe_membros WHERE saiu_em IS NULL AND papel = 'lider'
             GROUP BY equipe_id HAVING count(*) > 1) x), '0'
  UNION ALL
  SELECT 7, 'nenhum líder foi INVENTADO pelo backfill',
         (SELECT count(*)::text FROM public.equipe_membros WHERE papel = 'lider'), '0'
  UNION ALL
  SELECT 8, 'o apoio automático lê o instante',
         (SELECT (prosrc LIKE '%instante_da_equipe%' AND prosrc LIKE '%parceiros_da_equipe%')::text
            FROM pg_proc WHERE proname = 'chamado_sincronizar_apoio'), 'true'
  UNION ALL
  SELECT 9, 'a trava da U81 continua no corpo vivo (congelado_em)',
         (SELECT (prosrc LIKE '%congelado_em IS NULL%')::text
            FROM pg_proc WHERE proname = 'chamado_sincronizar_apoio'), 'true'
  UNION ALL
  SELECT 10, 'as portas de escrita existem',
         (SELECT count(*)::text FROM pg_proc
           WHERE proname IN ('equipe_definir_membro', 'equipe_tirar_membro')), '2'
  UNION ALL
  SELECT 11, 'o arquivo ficou de pé (dá para desfazer)',
         (to_regclass('public.duplas_escala') IS NOT NULL)::text, 'true'
  UNION ALL
  -- O MARCO ZERO É ESPERADO, e esta linha existe para ninguém "consertar" o que
  -- não está quebrado: faixa que começa no ano 1 quer dizer "nesta equipe desde
  -- sempre", e é o que faz um chamado com data retroativa ainda achar a turma.
  SELECT 12, 'faixas ancoradas no MARCO ZERO (0001-01-01) — é ESPERADO, não é defeito',
         (SELECT count(*)::text FROM public.equipe_membros WHERE entrou_em < '1900-01-01'),
         (SELECT count(*)::text FROM public.equipe_membros
           WHERE saiu_em IS NULL
             AND EXISTS (SELECT 1 FROM public.duplas_escala e
                          WHERE e.pessoa_id = equipe_membros.pessoa_id
                            AND e.dupla_id  = equipe_membros.equipe_id
                            AND e.semana    = '0001-S01'))
  UNION ALL
  SELECT 13, 'quantas pessoas estão LIVRES (o portão do §2 precisa de 2)',
         (SELECT count(*)::text FROM public.profiles p
           WHERE NOT EXISTS (SELECT 1 FROM public.equipe_membros m
                              WHERE m.pessoa_id = p.id AND m.saiu_em IS NULL)),
         '>= 2'

)
SELECT n, o_que, obtido, esperado,
       CASE WHEN n = 13 THEN CASE WHEN obtido::int >= 2 THEN 'ok' ELSE '>>> OLHAR <<<' END
            WHEN obtido IS NOT DISTINCT FROM esperado THEN 'ok'
            ELSE '>>> OLHAR <<<' END AS veredito
  FROM conferencia ORDER BY n;

-- ═══════════════════════════════════════════════════════════════════════════
-- §2  O PORTÃO — prova as regras e desfaz sozinho
--
-- Nada aqui sobrevive: tudo dentro de BEGIN … ROLLBACK. Ele só toca gente
-- LIVRE — quem não tem faixa aberta —, porque foi justamente pegar gente real
-- que derrubou o portão da U142.
-- ═══════════════════════════════════════════════════════════════════════════

-- O COMMIT vem ANTES do portão mesmo esta migration não escrevendo nada: o SQL
-- Editor do Supabase roda o script inteiro DENTRO de uma transação, e sem ele o
-- `ROLLBACK;` do fim desfaria tudo o que veio antes — que aqui é só leitura,
-- mas em toda outra migration é o DDL. É a cicatriz da U136, e a varredura do
-- verificador cobra a estrutura, não a intenção: migration com ROLLBACK sem
-- COMMIT antes é falha, e está certo que seja.
COMMIT;

BEGIN;

DO $u143portao$
DECLARE
  v_eq1  uuid;
  v_eq2  uuid;
  v_p1   uuid;
  v_p2   uuid;
  -- `clock_timestamp()` e não `now()`: dentro de uma transação o `now()` é
  -- CONSTANTE, e fechar e reabrir com ele daria uma faixa de duração zero, que
  -- o CHECK `saiu_em > entrou_em` recusa. Fora do portão cada chamada da RPC é
  -- uma transação própria e os instantes já são distintos.
  v_t0   timestamptz := clock_timestamp() - interval '2 hours';
  v_t1   timestamptz := clock_timestamp() - interval '1 hour';
BEGIN
  -- SÓ GENTE LIVRE. A U142 pegava o primeiro perfil por id — que o backfill já
  -- tinha posto numa equipe — e colidia com a composição de verdade.
  SELECT p.id INTO v_p1 FROM public.profiles p
   WHERE NOT EXISTS (SELECT 1 FROM public.equipe_membros m
                      WHERE m.pessoa_id = p.id AND m.saiu_em IS NULL)
   ORDER BY p.id LIMIT 1;
  SELECT p.id INTO v_p2 FROM public.profiles p
   WHERE p.id <> COALESCE(v_p1, '00000000-0000-0000-0000-000000000000'::uuid)
     AND NOT EXISTS (SELECT 1 FROM public.equipe_membros m
                      WHERE m.pessoa_id = p.id AND m.saiu_em IS NULL)
   ORDER BY p.id LIMIT 1;

  IF v_p1 IS NULL OR v_p2 IS NULL THEN
    RAISE NOTICE 'PORTÃO PULADO: não há duas pessoas fora de equipe para testar sem tocar em dado real. (A linha 13 da conferência mostra quantas há.)';
    RETURN;
  END IF;

  INSERT INTO public.duplas (nome, ativa) VALUES ('__portao_u143_a', true) RETURNING id INTO v_eq1;
  INSERT INTO public.duplas (nome, ativa) VALUES ('__portao_u143_b', true) RETURNING id INTO v_eq2;

  -- 1) uma pessoa em duas equipes ao mesmo tempo TEM de ser recusada
  INSERT INTO public.equipe_membros (equipe_id, pessoa_id, papel, entrou_em)
  VALUES (v_eq1, v_p1, 'ajudante', v_t0);
  BEGIN
    INSERT INTO public.equipe_membros (equipe_id, pessoa_id, papel, entrou_em)
    VALUES (v_eq2, v_p1, 'ajudante', v_t0);
    RAISE EXCEPTION 'PORTÃO FALHOU: o banco ACEITOU a mesma pessoa em duas equipes ao mesmo tempo.';
  EXCEPTION WHEN exclusion_violation THEN
    RAISE NOTICE 'PORTÃO 1 ok: duas equipes ao mesmo tempo -> recusado.';
  END;

  -- 2) dois líderes na mesma equipe TEM de ser recusado
  UPDATE public.equipe_membros SET papel = 'lider' WHERE equipe_id = v_eq1 AND pessoa_id = v_p1;
  BEGIN
    INSERT INTO public.equipe_membros (equipe_id, pessoa_id, papel, entrou_em)
    VALUES (v_eq1, v_p2, 'lider', v_t0);
    RAISE EXCEPTION 'PORTÃO FALHOU: o banco ACEITOU dois líderes na mesma equipe.';
  EXCEPTION WHEN exclusion_violation THEN
    RAISE NOTICE 'PORTÃO 2 ok: dois líderes -> recusado.';
  END;

  -- 3) SAIR E ENTRAR NO MESMO INSTANTE tem de ser ACEITO — é o gesto de mover,
  --    e com a faixa fechada nos dois lados ele seria impossível
  UPDATE public.equipe_membros SET saiu_em = v_t1 WHERE equipe_id = v_eq1 AND pessoa_id = v_p1;
  BEGIN
    INSERT INTO public.equipe_membros (equipe_id, pessoa_id, papel, entrou_em)
    VALUES (v_eq2, v_p1, 'ajudante', v_t1);
    RAISE NOTICE 'PORTÃO 3 ok: sair e entrar no mesmo instante -> aceito (a troca é atômica).';
  EXCEPTION WHEN exclusion_violation THEN
    RAISE EXCEPTION 'PORTÃO FALHOU: o banco RECUSOU sair e entrar no mesmo instante — mover ficaria impossível.';
  END;

  -- 4) A LEITURA RESPONDE PELO INSTANTE. É a regra inteira numa linha: antes da
  --    troca, a equipe antiga; depois, a nova. Era isto que a semana não sabia
  --    dizer, e por isso o passado era reescrito.
  IF public.equipe_da_pessoa(v_p1, v_t1 - interval '30 minutes') IS DISTINCT FROM v_eq1 THEN
    RAISE EXCEPTION 'PORTÃO FALHOU: antes da troca, equipe_da_pessoa não devolveu a equipe ANTIGA — o passado foi reescrito.';
  END IF;
  IF public.equipe_da_pessoa(v_p1, clock_timestamp()) IS DISTINCT FROM v_eq2 THEN
    RAISE EXCEPTION 'PORTÃO FALHOU: depois de mover, equipe_da_pessoa não devolveu a equipe nova.';
  END IF;
  RAISE NOTICE 'PORTÃO 4 ok: antes da troca a equipe antiga, depois a nova — o passado NÃO é reescrito.';

  -- 5) O PARCEIRO segue a composição do instante — é daqui que sai o apoio
  --    automático do chamado.
  INSERT INTO public.equipe_membros (equipe_id, pessoa_id, papel, entrou_em)
  VALUES (v_eq2, v_p2, 'lider', v_t1);
  IF NOT EXISTS (SELECT 1 FROM public.parceiros_da_equipe(v_p1, clock_timestamp()) p WHERE p = v_p2) THEN
    RAISE EXCEPTION 'PORTÃO FALHOU: parceiros_da_equipe não devolveu o companheiro de equipe.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.parceiros_da_equipe(v_p1, v_t1 - interval '30 minutes') p WHERE p = v_p2) THEN
    RAISE EXCEPTION 'PORTÃO FALHOU: parceiros_da_equipe devolveu como parceiro alguém que ainda não estava na equipe.';
  END IF;
  RAISE NOTICE 'PORTÃO 5 ok: o parceiro (de onde sai o apoio) segue a composição do instante.';

  RAISE NOTICE 'PORTÃO COMPLETO: as cinco provas passaram. Nada disto foi gravado (ROLLBACK a seguir).';
END
$u143portao$;

ROLLBACK;

-- ═══════════════════════════════════════════════════════════════════════════
-- §3  DESFAZER
--
-- Não há o que desfazer: esta migration não escreve nada fora do portão, e o
-- portão termina em ROLLBACK. Para desfazer a U142, veja o rodapé dela.
-- ═══════════════════════════════════════════════════════════════════════════
