-- ═══════════════════════════════════════════════════════════════════════════
-- U129 — v0.0.11: TROCAR O PLANTONISTA DA SEMANA, numa transação só (R254)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Davi, 11/09/2026: "Quando o usuário seleciona quem é o plantonista escalado
-- da semana, no modo de visualização semanal, as horas aplicam para quem está
-- selecionado, e quando altera o usuário selecionado para fazer o plantão, as
-- horas zeram do usuário que estava e passa para o que colocou depois. Ou seja
-- não é cumulativo entre alternância do botão."
--
-- ── POR QUE ISTO É UMA FUNÇÃO NOVA, E NÃO DUAS CHAMADAS DO QUE JÁ EXISTE ───
--
-- A composição óbvia — `sobreaviso_limpar(A)` e depois `sobreaviso_aplicar_
-- padrao(B)` — está errada por TRÊS motivos, e os três doem no mesmo lugar:
--
--  1. SÃO DUAS TRANSAÇÕES. Se a segunda falhar (rede, token, RLS), a semana
--     fica SEM NINGUÉM; se falhar a primeira, ficam os dois. E como o
--     plantonista é DERIVADO de quem tem mais horas, o nome que a tela mostra
--     muda com a falha — o pior tipo de erro, o que reescreve a resposta.
--  2. LIMPAR APAGA A CÉLULA INTEIRA, NUNCA SUBTRAI. Nas duas pontas da semana
--     a célula da MESMA pessoa pode valer 14 = 8h da madrugada que a semana
--     ANTERIOR lançou + 6h da noite desta (é o ramo `somar` da U86). Apagar os
--     oito dias de A destrói, na segunda de entrada, horas que pertencem ao
--     plantão da semana passada — e `horas` é ESCALAR: o banco não guarda quem
--     pôs cada pedaço, então não há como devolver o que levou junto.
--  3. `_confirmar = false` NÃO É DRY-RUN em `aplicar_padrao`: a regra é
--     `escreve = _confirmar OR NOT EXISTS(trocar)`. Uma "prévia" de B já
--     GRAVA B sempre que não houver colisão — antes de A sair.
--
-- Esta função é o ESPELHO EXATO de `sobreaviso_aplicar_padrao`: mesmo gate,
-- mesmas validações, os mesmos oito dias, o mesmo CASE de quatro ações para
-- quem ENTRA — e, para quem SAI, a subtração que é a volta da ida.
--
-- ── A CONTA DA SAÍDA, DITA POR EXTENSO ────────────────────────────────────
-- Para cada um dos oito dias: `novo = atual - horas_da_semana_padrao`.
--   · segunda de entrada com 14h e a semana pondo 6  → sobra 8  (a madrugada
--     da semana anterior FICA, que é o ponto);
--   · segunda de entrada com 6h e a semana pondo 6   → sobra 0  → DELETE;
--   · miolo com 14h e a semana pondo 14              → sobra 0  → DELETE;
--   · miolo com 24h (alguém inflou à mão) pondo 14   → sobra 10 → UPDATE.
-- NUNCA SE TIRA MAIS DO QUE A SEMANA PADRÃO PÔS. O excedente digitado à mão
-- fica com a pessoa, e a tela passa a mostrar a semana como "dividida" — que é
-- a verdade: alguém digitou aquilo, e apagar em silêncio seria inventar.
--
-- IDEMPOTENTE: CREATE OR REPLACE. Não cria tabela, não cria coluna, não mexe
-- em policy. O portão do §3 escreve e apaga as próprias linhas em 1900.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §0  PRÉ-VOO ────────────────────────────────────────────────────────────
DO $u129pre$
BEGIN
  IF to_regclass('public.sobreaviso') IS NULL THEN
    RAISE EXCEPTION 'U129 PRÉ-VOO: public.sobreaviso não existe — rode a U86 primeiro.';
  END IF;
  IF to_regprocedure('public.sobreaviso_aplicar_padrao(uuid, date, integer[], integer[], boolean)') IS NULL THEN
    RAISE EXCEPTION 'U129 PRÉ-VOO: sobreaviso_aplicar_padrao não existe — esta função é o espelho dela; rode a U86 primeiro.';
  END IF;
  IF to_regprocedure('public.is_gestor(uuid)') IS NULL THEN
    RAISE EXCEPTION 'U129 PRÉ-VOO: is_gestor não existe — rode a U6a primeiro.';
  END IF;
END
$u129pre$;

-- ── §1  A FUNÇÃO ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sobreaviso_trocar_plantonista(
  -- quem SAI. NULL = ninguém sai (é só um lançamento, e aí isto é
  -- `aplicar_padrao` com outro nome — aceito de propósito, para a tela ter UM
  -- caminho só de escrita de semana).
  _de_pessoa   uuid,
  -- quem ENTRA. NULL = ninguém entra (a semana só é retirada de quem estava).
  _para_pessoa uuid,
  _segunda     date,
  _horas       integer[],
  _absorve     integer[]
)
RETURNS TABLE (pessoa_id uuid, dia date, antes smallint, depois smallint, acao text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $u129troca$
DECLARE
  v_nh int := COALESCE(array_length(_horas, 1), 0);
  v_na int := COALESCE(array_length(_absorve, 1), 0);
BEGIN
  -- O MESMO GATE DAS DUAS RPCS DA U86, copiado e não reinventado. SECURITY
  -- DEFINER não passa pela RLS: sem isto, /rest/v1/rpc vira porta aberta.
  -- Pulado quando auth.uid() é nulo (SQL Editor, migration, portão).
  IF auth.uid() IS NOT NULL AND NOT (
       public.is_gestor(auth.uid())
       AND EXISTS (SELECT 1 FROM public.profiles p
                    WHERE p.id = auth.uid()
                      AND p.ativo
                      AND p.status <> 'pendente_aprovacao')
     ) THEN
    RAISE EXCEPTION 'Só quem responde pela operação lança a escala de sobreaviso.'
      USING ERRCODE = '42501';
  END IF;

  IF _de_pessoa IS NULL AND _para_pessoa IS NULL THEN
    RAISE EXCEPTION 'Troca sem ninguém dos dois lados não é troca — mande quem sai, quem entra, ou os dois.'
      USING ERRCODE = '22023';
  END IF;
  IF _de_pessoa IS NOT NULL AND _de_pessoa = _para_pessoa THEN
    RAISE EXCEPTION 'Quem sai e quem entra são a mesma pessoa — nada a trocar.'
      USING ERRCODE = '22023';
  END IF;
  IF _de_pessoa IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _de_pessoa) THEN
    RAISE EXCEPTION 'Não existe ninguém com o id % — a escala sai de public.profiles.', _de_pessoa
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF _para_pessoa IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _para_pessoa) THEN
    RAISE EXCEPTION 'Não existe ninguém com o id % — a escala sai de public.profiles.', _para_pessoa
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF EXTRACT(ISODOW FROM _segunda) <> 1 THEN
    RAISE EXCEPTION 'A semana padrão começa numa SEGUNDA-feira; recebi % (ISODOW %).',
      _segunda, EXTRACT(ISODOW FROM _segunda) USING ERRCODE = '22007';
  END IF;
  IF v_nh <> 8 OR v_na <> 8 THEN
    RAISE EXCEPTION 'A semana padrão tem 8 dias de calendário (segunda 18:00 à segunda 08:00); recebi % horas e % absorve.',
      v_nh, v_na USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH entrada AS (
    SELECT (_segunda + (eh.ord - 1)::int)::date AS d,
           eh.v::smallint                       AS h,
           ea.v::smallint                       AS ab
      FROM unnest(_horas)   WITH ORDINALITY AS eh(v, ord)
      JOIN unnest(_absorve) WITH ORDINALITY AS ea(v, ord) ON ea.ord = eh.ord
  ),
  -- ── QUEM SAI: subtrai o que a semana padrão pôs, nunca mais do que isso ──
  saida AS (
    SELECT en.d,
           s.horas                                   AS ant,
           GREATEST(0, COALESCE(s.horas, 0) - en.h)::smallint AS dep
      FROM entrada en
      LEFT JOIN public.sobreaviso s
             ON s.dia = en.d AND s.pessoa_id = _de_pessoa
     WHERE _de_pessoa IS NOT NULL
  ),
  saida_apagada AS (
    DELETE FROM public.sobreaviso s
     USING saida x
     WHERE s.pessoa_id = _de_pessoa
       AND s.dia = x.d
       AND x.ant IS NOT NULL
       AND x.dep = 0
    RETURNING s.dia AS d
  ),
  saida_reduzida AS (
    UPDATE public.sobreaviso s
       SET horas = x.dep, alterada_por = auth.uid()
      FROM saida x
     WHERE s.pessoa_id = _de_pessoa
       AND s.dia = x.d
       AND x.ant IS NOT NULL
       AND x.dep > 0
       AND s.horas <> x.dep
    RETURNING s.dia AS d
  ),
  -- ── QUEM ENTRA: o MESMO CASE de quatro ações da U86 ─────────────────────
  -- Roda contra o estado JÁ SEM a pessoa que saiu? NÃO: as CTEs modificadoras
  -- de uma mesma instrução enxergam o MESMO instantâneo. E está certo assim —
  -- quem entra é OUTRA pessoa, então as linhas dela são outras linhas. O único
  -- caso em que as duas metades tocariam a mesma linha é _de = _para, que a
  -- validação acima recusa.
  chegada AS (
    SELECT en.d, en.h, en.ab, s.horas AS ant,
           (CASE
              WHEN s.horas IS NULL                              THEN 'inserir'
              WHEN s.horas = en.h                               THEN 'igual'
              WHEN en.ab IS NOT NULL AND s.horas = en.ab
                   AND s.horas + en.h <= 24                     THEN 'somar'
              WHEN en.ab IS NOT NULL AND s.horas = en.h + en.ab THEN 'igual'
              ELSE 'trocar'
            END) AS ac
      FROM entrada en
      LEFT JOIN public.sobreaviso s
             ON s.dia = en.d AND s.pessoa_id = _para_pessoa
     WHERE _para_pessoa IS NOT NULL
  ),
  chegada_gravada AS (
    INSERT INTO public.sobreaviso (dia, pessoa_id, horas, origem, alterada_por)
    SELECT c.d, _para_pessoa,
           (CASE WHEN c.ac = 'somar' THEN c.ant + c.h ELSE c.h END)::smallint,
           'padrao', auth.uid()
      FROM chegada c
     WHERE c.ac <> 'igual'
    ON CONFLICT ON CONSTRAINT sobreaviso_pkey DO UPDATE
      SET horas        = EXCLUDED.horas,
          origem       = 'padrao',
          alterada_por = EXCLUDED.alterada_por
    RETURNING sobreaviso.dia AS d
  )
  -- A PRÉVIA É O RECIBO: uma linha por dia e por lado, com o antes e o depois.
  -- Não há duas fases aqui, e é decisão: a troca é UM gesto do gestor sobre
  -- uma semana que ele acabou de olhar, e a volta é escolher o nome de antes.
  -- Perguntar "tem certeza?" num gesto reversível treina a clicar sim sem ler.
  SELECT _de_pessoa, x.d, x.ant, NULLIF(x.dep, 0),
         (CASE WHEN x.ant IS NULL THEN 'nada'
               WHEN x.dep = 0     THEN 'saiu'
               ELSE 'reduziu' END)
    FROM saida x
  UNION ALL
  SELECT _para_pessoa, c.d, c.ant,
         (CASE WHEN c.ac = 'somar' THEN (c.ant + c.h)::smallint
               WHEN c.ac = 'igual' THEN c.ant
               ELSE c.h END),
         c.ac
    FROM chegada c
   ORDER BY 2, 1;
END;
$u129troca$;

COMMENT ON FUNCTION public.sobreaviso_trocar_plantonista(uuid, uuid, date, integer[], integer[]) IS
  'R254: troca o plantonista de UMA semana numa transação só. Quem sai perde '
  'exatamente o que a semana padrão pôs (subtração, nunca DELETE cego — a '
  'ponta compartilhada com a semana vizinha fica); quem entra recebe pelo '
  'MESMO CASE de quatro ações de sobreaviso_aplicar_padrao. Sem duas fases: o '
  'gesto é reversível escolhendo o nome de antes.';

REVOKE EXECUTE ON FUNCTION public.sobreaviso_trocar_plantonista(uuid, uuid, date, integer[], integer[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.sobreaviso_trocar_plantonista(uuid, uuid, date, integer[], integer[]) TO authenticated, service_role;

COMMIT;

-- ── §3  PORTÃO: a função é exercitada de verdade, e limpa o que sujou ──────
-- Em 1900, com duas pessoas reais, montando à mão o caso que derruba a
-- composição ingênua: a MESMA pessoa emendando duas semanas.
DO $u129portao$
DECLARE
  v_a uuid; v_b uuid;
  v_seg date := DATE '1900-01-08';   -- uma segunda-feira
  v_horas   integer[] := ARRAY[6, 14, 14, 14, 14, 24, 24, 8];
  v_absorve integer[] := ARRAY[8, NULL, NULL, NULL, NULL, NULL, NULL, 6];
  v_n int;
  v_sobrou smallint;
BEGIN
  SELECT id INTO v_a FROM public.profiles WHERE ativo AND status <> 'pendente_aprovacao' ORDER BY id LIMIT 1;
  SELECT id INTO v_b FROM public.profiles WHERE ativo AND status <> 'pendente_aprovacao' AND id <> v_a ORDER BY id LIMIT 1;
  IF v_a IS NULL OR v_b IS NULL THEN
    RAISE NOTICE 'U129 PORTÃO: precisa de DUAS pessoas ativas para exercitar a troca — pulado.';
    RETURN;
  END IF;

  DELETE FROM public.sobreaviso WHERE dia BETWEEN v_seg - 7 AND v_seg + 8;

  -- A emenda: A é plantonista da semana ANTERIOR (deixa 8h na segunda v_seg)
  -- e da semana v_seg (põe 6h no mesmo dia) — a célula vale 14.
  INSERT INTO public.sobreaviso (dia, pessoa_id, horas, origem) VALUES (v_seg, v_a, 14, 'padrao');
  INSERT INTO public.sobreaviso (dia, pessoa_id, horas, origem)
  SELECT v_seg + (o - 1), v_a, v_horas[o], 'padrao'
    FROM generate_series(2, 8) AS o;

  PERFORM public.sobreaviso_trocar_plantonista(v_a, v_b, v_seg, v_horas, v_absorve);

  -- 1) a ponta compartilhada SOBREVIVEU, reduzida de 14 para 8
  SELECT horas INTO v_sobrou FROM public.sobreaviso WHERE dia = v_seg AND pessoa_id = v_a;
  IF v_sobrou IS DISTINCT FROM 8::smallint THEN
    RAISE EXCEPTION 'U129 PORTÃO 1: a madrugada da semana ANTERIOR tinha de ficar com 8h em quem saiu; achei %.', v_sobrou;
  END IF;
  -- 2) o resto da semana de quem saiu ACABOU
  SELECT count(*) INTO v_n FROM public.sobreaviso
   WHERE pessoa_id = v_a AND dia BETWEEN v_seg + 1 AND v_seg + 7;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'U129 PORTÃO 2: quem saiu ainda tem % dia(s) no miolo da semana.', v_n;
  END IF;
  -- 3) quem entrou tem os oito dias, e a segunda de entrada SOMOU com a ponta
  SELECT count(*) INTO v_n FROM public.sobreaviso
   WHERE pessoa_id = v_b AND dia BETWEEN v_seg AND v_seg + 7;
  IF v_n <> 8 THEN
    RAISE EXCEPTION 'U129 PORTÃO 3: quem entrou ficou com % dias em vez de 8.', v_n;
  END IF;
  SELECT sum(horas) INTO v_n FROM public.sobreaviso
   WHERE pessoa_id = v_b AND dia BETWEEN v_seg AND v_seg + 7;
  IF v_n <> 118 THEN
    RAISE EXCEPTION 'U129 PORTÃO 4: quem entrou ficou com %h em vez de 118h.', v_n;
  END IF;
  -- 4) a segunda de entrada agora tem 8 (de quem saiu) + 6 (de quem entrou) = a cobertura do dia
  SELECT sum(horas) INTO v_n FROM public.sobreaviso WHERE dia = v_seg;
  IF v_n <> 14 THEN
    RAISE EXCEPTION 'U129 PORTÃO 5: a segunda da virada tinha de somar 14h (8 de quem sai + 6 de quem entra); somou %.', v_n;
  END IF;
  -- 5) a mesma pessoa dos dois lados é recusada
  BEGIN
    PERFORM public.sobreaviso_trocar_plantonista(v_b, v_b, v_seg, v_horas, v_absorve);
    RAISE EXCEPTION 'U129 PORTÃO 6: trocar alguém por ele mesmo tinha de ser recusado.';
  EXCEPTION WHEN sqlstate '22023' THEN
    NULL;
  END;
  -- 6) dia que não é segunda é recusado
  BEGIN
    PERFORM public.sobreaviso_trocar_plantonista(v_a, v_b, v_seg + 1, v_horas, v_absorve);
    RAISE EXCEPTION 'U129 PORTÃO 7: semana que não começa na segunda tinha de ser recusada.';
  EXCEPTION WHEN sqlstate '22007' THEN
    NULL;
  END;

  DELETE FROM public.sobreaviso WHERE dia BETWEEN v_seg - 7 AND v_seg + 8;
  RAISE NOTICE 'U129 PORTÃO: ok — troca atômica, ponta da semana vizinha preservada, 118h em quem entrou.';
END
$u129portao$;

-- ── CONFERÊNCIA (obtido × esperado × veredito) ──────────────────────────────
WITH conferencia AS (
  SELECT 'R254: a função de troca existe com os cinco parâmetros' AS item,
         (to_regprocedure('public.sobreaviso_trocar_plantonista(uuid, uuid, date, integer[], integer[])') IS NOT NULL)::text AS obtido,
         'true' AS esperado
  UNION ALL
  SELECT 'R254: ela é SECURITY DEFINER (como as duas irmãs da U86)',
         (SELECT p.prosecdef::text FROM pg_proc p
           WHERE p.oid = 'public.sobreaviso_trocar_plantonista(uuid, uuid, date, integer[], integer[])'::regprocedure), 'true'
  UNION ALL
  SELECT 'R254: ela repete o gate de duas metades (is_gestor + ativo)',
         (pg_get_functiondef('public.sobreaviso_trocar_plantonista(uuid, uuid, date, integer[], integer[])'::regprocedure)
           LIKE '%is_gestor(auth.uid())%')::text, 'true'
  UNION ALL
  SELECT 'R254: quem SAI perde por SUBTRAÇÃO (GREATEST(0, atual - horas)), nunca por DELETE cego',
         (pg_get_functiondef('public.sobreaviso_trocar_plantonista(uuid, uuid, date, integer[], integer[])'::regprocedure)
           LIKE '%GREATEST(0, COALESCE(s.horas, 0) - en.h)%')::text, 'true'
  UNION ALL
  SELECT 'R254: quem ENTRA usa o MESMO CASE de quatro ações da U86',
         (pg_get_functiondef('public.sobreaviso_trocar_plantonista(uuid, uuid, date, integer[], integer[])'::regprocedure)
           LIKE '%somar%' AND
          pg_get_functiondef('public.sobreaviso_trocar_plantonista(uuid, uuid, date, integer[], integer[])'::regprocedure)
           LIKE '%trocar%')::text, 'true'
  UNION ALL
  SELECT 'R254: anon NÃO executa',
         (has_function_privilege('anon', 'public.sobreaviso_trocar_plantonista(uuid, uuid, date, integer[], integer[])', 'EXECUTE'))::text, 'false'
  UNION ALL
  SELECT 'R254: authenticated executa',
         (has_function_privilege('authenticated', 'public.sobreaviso_trocar_plantonista(uuid, uuid, date, integer[], integer[])', 'EXECUTE'))::text, 'true'
  UNION ALL
  SELECT 'R254: o portão não deixou sujeira em 1900',
         (SELECT count(*)::text FROM public.sobreaviso WHERE dia < DATE '2000-01-01'), '0'
  UNION ALL
  SELECT 'U86 intacta: aplicar_padrao e limpar continuam lá',
         ((to_regprocedure('public.sobreaviso_aplicar_padrao(uuid, date, integer[], integer[], boolean)') IS NOT NULL)
          AND (to_regprocedure('public.sobreaviso_limpar(uuid, date, date, boolean, boolean)') IS NOT NULL))::text, 'true'
)
SELECT item, obtido, esperado,
       CASE WHEN obtido IS NOT DISTINCT FROM esperado THEN 'ok' ELSE '>>> OLHAR <<<' END AS veredito
  FROM conferencia;

-- ── DESFAZER ────────────────────────────────────────────────────────────────
--   DROP FUNCTION IF EXISTS public.sobreaviso_trocar_plantonista(uuid, uuid, date, integer[], integer[]);
-- Nada mais: esta migration não cria tabela, coluna, policy nem gatilho, e não
-- altera as duas funções da U86. Sem ela, a tela avisa que a troca precisa da
-- U129 e continua deixando lançar e limpar semana pelos caminhos antigos.
