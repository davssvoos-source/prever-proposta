-- ═══════════════════════════════════════════════════════════════════════════
-- U150 — O RETORNO É A MESMA ATIVIDADE (R286)
--
-- Davi, 14/09/2026, pedindo a decisão: "O retorno deve manter a mesma
-- atividade e adicionar uma etiqueta de Retornado 2x ou algo do tipo… Assim
-- mapeamos quantas vezes foram ao local tentar solucionar, quem foi, quando
-- foi, e o que cada um tentou… Ou talvez seja melhor criar um chamado novo..?
-- Eu quero que você analise isso e tome a decisão de maneira estratégica."
--
-- ── A DECISÃO, E POR QUE ELA É PEQUENA NO BANCO ────────────────────────────
-- A mesma atividade, não um chamado novo. As três razões estão na R286; a
-- consequência técnica é esta: **o sistema já tem a forma**. `agenda_campo` é
-- UMA LINHA POR IDA desde a U78, e a U81 já congela o apoio de cada ida para
-- preservar quem esteve no prédio. Um chamado novo duplicaria um mecanismo que
-- existe e ainda perderia o fio entre as idas.
--
-- Então esta migration NÃO cria estrutura de retorno. Ela acrescenta a única
-- coisa que faltava: **como a ida terminou**.
--
-- ── §1  COMO A IDA TERMINOU (`agenda_campo.resultado`) ─────────────────────
-- `cumprido_em` já diz QUE a visita aconteceu. O que ninguém registrava é se
-- ela RESOLVEU. Sem isso, "foram e não resolveram" e "foram e resolveram" são
-- a mesma linha no banco, e a diferença entre as duas é a única coisa que o
-- gestor precisa saber para decidir se manda alguém de volta.
--
-- `resultado_nota` é o "o que cada um tentou" que o Davi pediu. Ele vai TAMBÉM
-- para a linha do tempo do chamado (§3), e não para o bloco da agenda: a R99
-- mantém o bloco magro de propósito, e um parágrafo dentro de um retângulo de
-- 40px de altura seria texto que ninguém lê.
--
-- ── §2  O CONTADOR (`chamados.retornos`) ───────────────────────────────────
-- O card diz "Retornado 2x", e o card não faz JOIN com a agenda: ele lê uma
-- linha de `chamados`. Espelho, como `reagendamentos` (R225/U119) — e com a
-- mesma disciplina: **a coluna nunca é escrita à mão**. Um gatilho em
-- `agenda_campo` RECONTA da verdade a cada mudança, então o espelho não tem
-- como divergir; ele é cache de uma conta, não uma segunda verdade.
--
-- ── O QUE ESTA MIGRATION NÃO FAZ, E É DE PROPÓSITO ─────────────────────────
-- 1. NÃO marca `resultado = 'resolvido'` ao concluir o chamado. Isso exigiria
--    mexer em `concluir_chamado_com_cobranca`, que é a porta mais delicada do
--    sistema (trava de duplicata, cobrança, faturamento), e o contador de
--    retornos não precisa disso: ele conta 'retorno', não a ausência dele.
--    `resultado IS NULL` quer dizer "ninguém disse", e é honesto.
-- 2. NÃO cria coluna "retorno pendente". Ela seria um terceiro espelho, e a
--    pergunta já é respondível com o que existe: `retornos > 0`, o chamado em
--    aberto, e sem data futura marcada. Isso mora em lógica pura na tela, onde
--    dá para exercitar sem banco.
-- 3. NÃO conta bloco CANCELADO. Ida desmarcada não é ida — ninguém foi ao
--    prédio, e um "Retornado 3x" que inclui uma visita que não aconteceu é
--    exatamente o número que faz o gestor perder a confiança na etiqueta.
--
-- IDEMPOTENTE: ADD COLUMN IF NOT EXISTS, DROP CONSTRAINT IF EXISTS antes de
-- cada ADD, CREATE OR REPLACE nas funções, DROP TRIGGER IF EXISTS antes do
-- CREATE. A recontagem do §2.2 é uma conta a partir da verdade: rodar duas
-- vezes dá o mesmo número.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §0  PRÉ-VOO ────────────────────────────────────────────────────────────
DO $u150pre$
BEGIN
  IF to_regclass('public.agenda_campo') IS NULL THEN
    RAISE EXCEPTION 'U150 PRÉ-VOO: `agenda_campo` não existe — a U78 não rodou.';
  END IF;
  IF to_regclass('public.chamado_eventos') IS NULL THEN
    RAISE EXCEPTION 'U150 PRÉ-VOO: `chamado_eventos` não existe — a linha do tempo é onde o retorno é contado.';
  END IF;
  IF to_regprocedure('public.pode_editar_chamado(uuid)') IS NULL THEN
    RAISE EXCEPTION 'U150 PRÉ-VOO: `pode_editar_chamado(uuid)` não existe — sem ela a porta de escrita não tem como recusar.';
  END IF;
  -- `cumprido_em` é a coluna em que esta migration se apoia para dizer "a
  -- visita aconteceu". Se ela não estiver lá, o CHECK do §1 é inexprimível.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'agenda_campo' AND column_name = 'cumprido_em'
  ) THEN
    RAISE EXCEPTION 'U150 PRÉ-VOO: `agenda_campo.cumprido_em` não existe — a U78 desta base não é a que eu li.';
  END IF;
  RAISE NOTICE 'U150 pré-voo ok.';
END
$u150pre$;

-- ═══════════════════════════════════════════════════════════════════════════
-- §1  COMO A IDA TERMINOU
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.agenda_campo ADD COLUMN IF NOT EXISTS resultado      text;
ALTER TABLE public.agenda_campo ADD COLUMN IF NOT EXISTS resultado_nota text;

COMMENT ON COLUMN public.agenda_campo.resultado IS
  'R286 (U150): como esta IDA terminou. NULL = ninguém disse (é o estado normal de quem ainda não voltou, e também do que foi concluído pela porta de conclusão). ''retorno'' = foi e não resolveu — é o que o contador `chamados.retornos` conta. ''resolvido'' = foi e resolveu.';
COMMENT ON COLUMN public.agenda_campo.resultado_nota IS
  'R286 (U150): o que se tentou nesta ida. Vai TAMBÉM para `chamado_eventos` (a linha do tempo), que é onde se lê — o bloco da agenda é magro de propósito (R99).';

-- O vocabulário fechado. Sem ele, a terceira grafia de "retorno" ("Retorno",
-- "RETORNO", "retornou") nasce na primeira vez que alguém escrever pela API e
-- o contador passa a ignorar idas de verdade, em silêncio.
ALTER TABLE public.agenda_campo DROP CONSTRAINT IF EXISTS agenda_campo_resultado_valido;
ALTER TABLE public.agenda_campo ADD  CONSTRAINT agenda_campo_resultado_valido
  CHECK (resultado IS NULL OR resultado IN ('resolvido', 'retorno'));

-- RESULTADO SÓ EXISTE DEPOIS DA VISITA. "Não resolveu" numa ida que não
-- aconteceu é uma frase sem sentido, e seria contada como retorno — o mesmo
-- estrago do bloco cancelado, pelo outro lado.
ALTER TABLE public.agenda_campo DROP CONSTRAINT IF EXISTS agenda_campo_resultado_so_cumprido;
ALTER TABLE public.agenda_campo ADD  CONSTRAINT agenda_campo_resultado_so_cumprido
  CHECK (resultado IS NULL OR cumprido_em IS NOT NULL);

-- O índice que o gatilho do §2 usa a cada recontagem.
CREATE INDEX IF NOT EXISTS agenda_campo_retorno_idx
  ON public.agenda_campo (chamado_id)
  WHERE resultado = 'retorno' AND cancelado_em IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- §2  O CONTADOR, QUE NUNCA É ESCRITO À MÃO
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.chamados ADD COLUMN IF NOT EXISTS retornos integer NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.chamados.retornos IS
  'R286 (U150): quantas IDAS terminaram sem resolver. ESPELHO — recontado pelo gatilho `trg_contar_retornos` a partir de `agenda_campo`; nunca escrever à mão. O card diz "Retornado Nx". Bloco cancelado não conta: ninguém foi ao prédio.';

-- ── 2.1  a conta, num lugar só ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recontar_retornos(_chamado uuid)
RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $u150a$
DECLARE v_n integer;
BEGIN
  IF _chamado IS NULL THEN RETURN 0; END IF;
  SELECT count(*) INTO v_n
    FROM public.agenda_campo a
   WHERE a.chamado_id = _chamado
     AND a.resultado = 'retorno'
     AND a.cancelado_em IS NULL;
  -- a guarda do UPDATE evita escrita inútil: sem ela, cada carimbo numa ida
  -- reescreveria a linha do chamado e acordaria os gatilhos AFTER UPDATE dele
  UPDATE public.chamados SET retornos = v_n
   WHERE id = _chamado AND retornos IS DISTINCT FROM v_n;
  RETURN v_n;
END;
$u150a$;

-- ── 2.2  o gatilho ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.contar_retornos()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $u150b$
BEGIN
  -- NO DELETE, `NEW` NÃO EXISTE. Em plpgsql ele não é "nulo": é um record não
  -- atribuído, e ler `NEW.chamado_id` levanta "record new is not assigned yet"
  -- — o COALESCE que parece resolver isto estoura ANTES de avaliar o segundo
  -- braço. O ramo tem de ser separado, e o portão apaga um bloco de propósito
  -- para provar que é.
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recontar_retornos(OLD.chamado_id);
    RETURN NULL;
  END IF;

  -- O bloco pode ter MUDADO de chamado. Recontar só o novo deixaria o antigo
  -- com um retorno a mais para sempre — e ninguém olharia, porque o número
  -- continua plausível.
  IF TG_OP = 'UPDATE' AND OLD.chamado_id IS DISTINCT FROM NEW.chamado_id THEN
    PERFORM public.recontar_retornos(OLD.chamado_id);
  END IF;
  PERFORM public.recontar_retornos(NEW.chamado_id);
  RETURN NULL;
END;
$u150b$;

DROP TRIGGER IF EXISTS trg_contar_retornos ON public.agenda_campo;
CREATE TRIGGER trg_contar_retornos
  AFTER INSERT OR DELETE OR UPDATE OF chamado_id, resultado, cancelado_em
  ON public.agenda_campo
  FOR EACH ROW EXECUTE FUNCTION public.contar_retornos();

-- ── 2.3  o espelho nasce certo ─────────────────────────────────────────────
-- Hoje isto escreve ZERO linhas (a coluna `resultado` acabou de nascer e é
-- toda NULL). Fica porque uma segunda execução, depois de haver retornos,
-- precisa terminar com o espelho batendo — e porque é a mesma conta do
-- gatilho, não uma segunda.
UPDATE public.chamados c
   SET retornos = sub.n
  FROM (
    SELECT ch.id, count(a.id) AS n
      FROM public.chamados ch
      LEFT JOIN public.agenda_campo a
        ON a.chamado_id = ch.id AND a.resultado = 'retorno' AND a.cancelado_em IS NULL
     GROUP BY ch.id
  ) sub
 WHERE c.id = sub.id AND c.retornos IS DISTINCT FROM sub.n;

-- ═══════════════════════════════════════════════════════════════════════════
-- §3  A PORTA — registrar que a equipe foi e não resolveu
--
-- UM ATO, NÃO DOIS. Carimbar a ida e escrever na linha do tempo têm de
-- acontecer juntos: separados, a tela que falhar no meio deixa um retorno
-- contado sem ninguém saber o que se tentou — que é justamente a informação
-- que o Davi pediu para guardar.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.chamado_registrar_retorno(_chamado uuid, _nota text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $u150c$
DECLARE
  v_bloco  uuid;
  v_status text;
  v_n      integer;
  v_nota   text := nullif(btrim(coalesce(_nota, '')), '');
BEGIN
  SELECT c.status INTO v_status FROM public.chamados c WHERE c.id = _chamado;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Este chamado não existe mais — recarregue a tela.'
      USING ERRCODE = '55000';
  END IF;

  IF auth.uid() IS NOT NULL AND NOT public.pode_editar_chamado(_chamado) THEN
    RAISE EXCEPTION 'Você não responde por este chamado. Peça a quem responde por ele, ou à gestão.'
      USING ERRCODE = '42501';
  END IF;

  -- CHAMADO ENCERRADO NÃO RECEBE RETORNO. Se ele foi concluído, a ida resolveu
  -- por definição; e num cancelado ninguém foi. Aceitar aqui produziria a
  -- etiqueta "Retornado 1x" num chamado que a tela mostra como feito.
  IF v_status IN ('concluido', 'cancelado') THEN
    RAISE EXCEPTION 'Este chamado está encerrado — reabra-o antes de registrar um retorno.'
      USING ERRCODE = '55000';
  END IF;

  -- A IDA É A QUE ESTÁ ABERTA. Sem bloco aberto ninguém saiu, e "foi e não
  -- resolveu" não tem sujeito. A recusa é explícita porque o silêncio aqui
  -- seria pior: o gestor clicaria "Retorno", nada aconteceria, e ele acharia
  -- que registrou.
  SELECT a.id INTO v_bloco
    FROM public.agenda_campo a
   WHERE a.chamado_id = _chamado
     AND a.cumprido_em IS NULL
     AND a.cancelado_em IS NULL
   ORDER BY a.dia DESC, a.inicio_min DESC
   LIMIT 1;

  IF v_bloco IS NULL THEN
    RAISE EXCEPTION 'Não há visita em aberto neste chamado. Marque a ida na programação antes de registrar o retorno dela.'
      USING ERRCODE = '55000';
  END IF;

  -- O CARIMBO VAI PELA PORTA DA U78, não por um UPDATE meu. `cumprido_em` é
  -- coluna dela, e ela carrega regras que eu teria de copiar para acertar:
  -- a permissão por chamado, o braço de gestor para bloco sem chamado, e a
  -- recusa de dar baixa em bloco desmarcado (cancelado_em + cumprido_em juntos
  -- é um estado que nada na grade sabe ler). Copiar três regras é como as duas
  -- versões começam a discordar.
  PERFORM public.agenda_campo_cumprir(v_bloco, true);

  -- o que é MEU: as duas colunas que a U78 não conhecia.
  UPDATE public.agenda_campo
     SET resultado      = 'retorno',
         resultado_nota = v_nota,
         updated_at     = now()
   WHERE id = v_bloco;

  -- a linha do tempo, que é onde "o que se tentou" se lê (R286)
  INSERT INTO public.chamado_eventos (chamado_id, tipo, descricao, user_id)
  VALUES (_chamado, 'retorno',
          coalesce(v_nota, 'A equipe esteve no local e o problema não foi resolvido.'),
          auth.uid());

  -- o gatilho do §2 já recontou; esta chamada devolve o número para a tela
  -- poder dizer "Retornado Nx" sem uma segunda viagem ao banco
  SELECT c.retornos INTO v_n FROM public.chamados c WHERE c.id = _chamado;
  RETURN coalesce(v_n, 0);
END;
$u150c$;

REVOKE EXECUTE ON FUNCTION public.chamado_registrar_retorno(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.chamado_registrar_retorno(uuid, text) TO authenticated, service_role;

-- `recontar_retornos` é ferramenta do gatilho, não porta de tela: quem puder
-- chamá-la de fora pode reescrever o espelho de qualquer chamado.
REVOKE EXECUTE ON FUNCTION public.recontar_retornos(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.recontar_retornos(uuid) TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- §4  CONFERÊNCIA — obtido × esperado × veredito
-- ═══════════════════════════════════════════════════════════════════════════
WITH conferencia AS (
  SELECT 1 AS n, 'agenda_campo.resultado existe (text)' AS o_que,
         (SELECT data_type FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'agenda_campo' AND column_name = 'resultado') AS obtido,
         'text' AS esperado
  UNION ALL
  SELECT 2, 'agenda_campo.resultado_nota existe (text)',
         (SELECT data_type FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'agenda_campo' AND column_name = 'resultado_nota'),
         'text'
  UNION ALL
  SELECT 3, 'os dois CHECK do resultado existem (vocabulário fechado + só depois da visita)',
         (SELECT count(*)::text FROM pg_constraint
           WHERE conrelid = 'public.agenda_campo'::regclass
             AND conname IN ('agenda_campo_resultado_valido', 'agenda_campo_resultado_so_cumprido')),
         '2'
  UNION ALL
  SELECT 4, 'chamados.retornos existe (integer, default 0)',
         (SELECT data_type || '/' || coalesce(column_default, 'SEM DEFAULT') FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'chamados' AND column_name = 'retornos'),
         'integer/0'
  UNION ALL
  SELECT 5, 'o gatilho que reconta está armado em agenda_campo',
         (SELECT count(*)::text FROM pg_trigger
           WHERE tgrelid = 'public.agenda_campo'::regclass AND tgname = 'trg_contar_retornos' AND NOT tgisinternal),
         '1'
  UNION ALL
  SELECT 6, 'a porta de escrita existe',
         (SELECT CASE WHEN to_regprocedure('public.chamado_registrar_retorno(uuid,text)') IS NULL THEN 'NÃO' ELSE 'sim' END),
         'sim'
  UNION ALL
  SELECT 7, 'a porta está aberta para quem usa a tela (authenticated)',
         (SELECT CASE WHEN has_function_privilege('authenticated', 'public.chamado_registrar_retorno(uuid,text)', 'EXECUTE')
                      THEN 'sim' ELSE 'NÃO' END),
         'sim'
  UNION ALL
  SELECT 8, 'a ferramenta do gatilho está FECHADA para authenticated (ela reescreve o espelho)',
         (SELECT CASE WHEN has_function_privilege('authenticated', 'public.recontar_retornos(uuid)', 'EXECUTE')
                      THEN 'ABERTA' ELSE 'fechada' END),
         'fechada'
  UNION ALL
  SELECT 9, 'o espelho bate com a verdade da agenda (0 chamados divergentes)',
         (SELECT count(*)::text FROM public.chamados c
           WHERE c.retornos IS DISTINCT FROM (
             SELECT count(*) FROM public.agenda_campo a
              WHERE a.chamado_id = c.id AND a.resultado = 'retorno' AND a.cancelado_em IS NULL)),
         '0'
  UNION ALL
  SELECT 10, 'idas já registradas como retorno (hoje é zero — a coluna acabou de nascer)',
         (SELECT count(*)::text FROM public.agenda_campo WHERE resultado = 'retorno'),
         '(leia)'
)
SELECT n, o_que, obtido, esperado,
       CASE WHEN esperado LIKE '(%' THEN 'leia'
            WHEN obtido IS NOT DISTINCT FROM esperado THEN 'ok'
            ELSE '>>> OLHAR <<<' END AS veredito
  FROM conferencia ORDER BY n;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- §5  O PORTÃO — prova o ciclo inteiro e desfaz sozinho
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;

DO $u150portao$
DECLARE
  v_chamado uuid;
  v_dupla   uuid;
  v_bloco   uuid;
  v_n       integer;
  v_erro    text;
BEGIN
  SELECT id INTO v_dupla FROM public.duplas LIMIT 1;
  IF v_dupla IS NULL THEN
    RAISE NOTICE 'PORTÃO PULADO: não há nenhuma equipe de campo cadastrada para montar o bloco.';
    RETURN;
  END IF;

  INSERT INTO public.chamados (titulo, natureza, tipo, prioridade, status)
  VALUES ('__portao_u150', 'campo', 'corretiva', 'normal', 'aberto')
  RETURNING id INTO v_chamado;

  -- 1) sem bloco aberto, a porta RECUSA — e diz o que fazer
  BEGIN
    PERFORM public.chamado_registrar_retorno(v_chamado, 'tentei sem ida');
    RAISE EXCEPTION 'PORTÃO FALHOU: registrou retorno num chamado sem visita em aberto.';
  EXCEPTION WHEN sqlstate '55000' THEN
    GET STACKED DIAGNOSTICS v_erro = MESSAGE_TEXT;
    IF v_erro NOT LIKE '%visita em aberto%' THEN RAISE; END IF;
    RAISE NOTICE 'PORTÃO 1 ok: sem ida aberta, a porta recusa — "%"', v_erro;
  END;

  -- 2) com a ida marcada, o retorno é registrado e o espelho conta 1
  INSERT INTO public.agenda_campo (chamado_id, dupla_id, dia, inicio_min, servico_min)
  VALUES (v_chamado, v_dupla, current_date + 400, 9 * 60, 60)
  RETURNING id INTO v_bloco;

  v_n := public.chamado_registrar_retorno(v_chamado, 'trocou a fonte, o problema voltou');
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'PORTÃO FALHOU: depois de um retorno o contador diz % (esperado 1).', v_n;
  END IF;
  RAISE NOTICE 'PORTÃO 2 ok: uma ida sem resolver → "Retornado 1x".';

  -- 3) o que se tentou foi para a LINHA DO TEMPO, não só para o bloco
  IF NOT EXISTS (
    SELECT 1 FROM public.chamado_eventos
     WHERE chamado_id = v_chamado AND tipo = 'retorno'
       AND descricao = 'trocou a fonte, o problema voltou'
  ) THEN
    RAISE EXCEPTION 'PORTÃO FALHOU: o retorno não escreveu na linha do tempo.';
  END IF;
  RAISE NOTICE 'PORTÃO 3 ok: "o que se tentou" está na linha do tempo.';

  -- 4) cancelar a ida DESCONTA: ninguém foi ao prédio
  UPDATE public.agenda_campo SET cancelado_em = now() WHERE id = v_bloco;
  SELECT retornos INTO v_n FROM public.chamados WHERE id = v_chamado;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'PORTÃO FALHOU: bloco cancelado continua contando como retorno (contador = %).', v_n;
  END IF;
  RAISE NOTICE 'PORTÃO 4 ok: ida cancelada não conta como retorno.';

  -- 5) o CHECK recusa resultado sem visita. Num bloco NOVO, e não
  --    ressuscitando o cancelado: desfazer um cancelamento por UPDATE cru é um
  --    gesto que a U78 não autoriza, e o portão não pode ensinar caminho torto.
  INSERT INTO public.agenda_campo (chamado_id, dupla_id, dia, inicio_min, servico_min)
  VALUES (v_chamado, v_dupla, current_date + 401, 9 * 60, 60)
  RETURNING id INTO v_bloco;

  BEGIN
    UPDATE public.agenda_campo SET resultado = 'retorno' WHERE id = v_bloco;
    RAISE EXCEPTION 'PORTÃO FALHOU: aceitou resultado numa ida que não aconteceu.';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PORTÃO 5 ok: resultado sem visita é recusado pelo CHECK.';
  END;

  -- 6) APAGAR um bloco reconta. É o ramo em que `NEW` não existe, e é onde a
  --    forma óbvia do gatilho (um COALESCE) estouraria com "record new is not
  --    assigned yet" — sem este passo, o defeito só apareceria no dia em que
  --    alguém apagasse uma ida, meses depois.
  UPDATE public.agenda_campo SET cumprido_em = now(), resultado = 'retorno' WHERE id = v_bloco;
  SELECT retornos INTO v_n FROM public.chamados WHERE id = v_chamado;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'PORTÃO FALHOU: o segundo retorno não foi contado (contador = %).', v_n;
  END IF;

  DELETE FROM public.agenda_campo WHERE id = v_bloco;
  SELECT retornos INTO v_n FROM public.chamados WHERE id = v_chamado;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'PORTÃO FALHOU: apagar a ida não descontou o retorno (contador = %).', v_n;
  END IF;
  RAISE NOTICE 'PORTÃO 6 ok: apagar uma ida reconta (o ramo em que NEW não existe).';

  RAISE NOTICE 'PORTÃO COMPLETO. Nada disto foi gravado (ROLLBACK a seguir).';
END
$u150portao$;

ROLLBACK;

-- ═══════════════════════════════════════════════════════════════════════════
-- §6  DESFAZER (só se precisar)
--
--   DROP TRIGGER IF EXISTS trg_contar_retornos ON public.agenda_campo;
--   DROP FUNCTION IF EXISTS public.contar_retornos();
--   DROP FUNCTION IF EXISTS public.chamado_registrar_retorno(uuid, text);
--   DROP FUNCTION IF EXISTS public.recontar_retornos(uuid);
--   DROP INDEX IF EXISTS public.agenda_campo_retorno_idx;
--   ALTER TABLE public.agenda_campo DROP CONSTRAINT IF EXISTS agenda_campo_resultado_valido;
--   ALTER TABLE public.agenda_campo DROP CONSTRAINT IF EXISTS agenda_campo_resultado_so_cumprido;
--   ALTER TABLE public.agenda_campo DROP COLUMN IF EXISTS resultado_nota;
--   ALTER TABLE public.agenda_campo DROP COLUMN IF EXISTS resultado;   -- APAGA o registro das idas
--   ALTER TABLE public.chamados     DROP COLUMN IF EXISTS retornos;
--
-- As duas últimas linhas APAGAM DADO. Antes de rodá-las, copie:
--   CREATE TABLE zz_backup_resultado_u150 AS
--     SELECT id, chamado_id, resultado, resultado_nota FROM public.agenda_campo
--      WHERE resultado IS NOT NULL;
-- Os eventos da linha do tempo (`tipo = 'retorno'`) NÃO são apagados por nada
-- disto, e é de propósito: o que aconteceu no prédio continua registrado.
-- ═══════════════════════════════════════════════════════════════════════════
