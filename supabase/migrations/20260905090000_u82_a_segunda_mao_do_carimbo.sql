-- ═══════════════════════════════════════════════════════════════════════════
-- U82 — A SEGUNDA MÃO DO CARIMBO (R109/R110/R111)
--
-- >>> RODAR NO SQL EDITOR, À MÃO, DEPOIS DA U81. O §1 ABORTA se a U81 não   <<<
-- >>> rodou ou se a trava dela saiu do corpo vivo de chamado_sincronizar_apoio.
--
-- ── A DIVISÃO, E ELA É O DESENHO INTEIRO ──────────────────────────────────
-- QUEM AFIRMA É GENTE, E AFIRMA ANTES DO STATUS. A porta nova
-- (agenda_campo_afirmar) é chamada pelo app ANTES de o status ser escrito. Só
-- nessa ordem: (a) agenda_campo_espelhar passa no próprio WHERE (u78:895) e o
-- espelho anda bloco a bloco, de modo que o congelamento da U81 pega a turma de
-- CADA semana ISO; (b) agenda_campo_valida (u78:774-776, gatilho em u78:786)
-- ainda deixa o TÉCNICO corrigir o dia — depois de 'concluido', só a gestão.
--
-- E AGORA A PARTE QUE ESTA MIGRATION AFIRMAVA FALSO, CORRIGIDA: "o chamado
-- ainda ABERTO" vale para UM dos quatro pontos de chamada, e não para os
-- quatro. Conferido, arquivo por arquivo:
--   · DetalheCampo `concluir` -> executarChamado ..... chamado ABERTO   ✔
--   · DetalheCampo `fechar`   -> concluirChamado ..... JÁ 'concluido'   ✘
--   · PainelDoCiclo `disparar` ....................... JÁ 'concluido'   ✘
--   · o CHIP da AgendaDoChamado ...................... JÁ encerrado     ✘
-- Nos três de baixo o espelho está PINADO (u78:895 casa zero linhas) e
-- chamado_apoio_da_dupla volta cedo em encerrado sem troca de dono (u78:1825).
-- Logo o único congelamento possível ali é o do BEFORE da U81, e só para o
-- bloco que cai na semana do espelho parado. Para bloco de OUTRA semana, a
-- turma daquela semana NUNCA foi sequer escrita em chamado_apoios.
-- ISSO É LIMITAÇÃO IRREDUTÍVEL, NÃO BUG: reconstruir aquela turma exigiria
-- mover o espelho de um chamado encerrado e chamar chamado_sincronizar_apoio,
-- cujo DELETE reabriria o defeito que a U81 existe para fechar — ou, pior,
-- INVENTAR linha de apoio, que a U64 e a U81 recusaram por escrito. Está
-- declarada no P38, com canário SQL, e a TELA foi corrigida para não prometer
-- o que a máquina não faz.
--
-- QUEM SOLTA É A MÁQUINA, E ELA NÃO AFIRMA NADA. O gatilho novo, no
-- encerramento, apenas DESMARCA o que ainda era PLANO FUTURO. Ele não precisa
-- de evidência porque não afirma nada, não precisa de gate porque não concede
-- nada, e toda escrita dele é REVERSÍVEL (agenda_campo_marcar ressuscita bloco
-- desmarcado, u78:1399).
--
-- POR QUE O GATILHO NÃO PODE AFIRMAR — o teorema, não a preferência:
--   · BEFORE: agenda_campo_espelhar leria o status ANTIGO, passaria no gate de
--     u78:895 e emitiria UPDATE public.chamados na PRÓPRIA linha em atualização
--     -> 09000, e INTERMITENTE (um bloco passa, dois estouram).
--   · AFTER: o status já é terminal, o espelho casa zero linhas, o gate de
--     semana da U81 (u81:330-333) devolve cedo para todo bloco de outra semana
--     e chamado_apoio_da_dupla volta cedo em encerrado (u78:1825). Afirmar N
--     visitas gravaria UMA turma e perderia as demais — o defeito que a U81
--     existe para fechar, dentro da correção.
--   · E `dia` é impossível nos dois: com `dia` no SET acorda
--     trg_agenda_campo_valida, que num chamado encerrado devolve 42501 a quem
--     não é gestor. O técnico deixaria de concluir o próprio chamado.
--
-- A DECISÃO DO DAVI (04/09) É REGRA: nenhuma linha desta migration recusa um
-- carimbo por causa de data. `current_date` NÃO aparece no corpo de nenhuma
-- função criada aqui, e a conferência 122 lê isso do CATÁLOGO. A data decide o
-- que é POSSÍVEL ESCREVER, nunca se se escreve.
--
-- O QUE ELA CRIA, E É SÓ ISTO: 1 função nova (a porta), 1 função nova + 1
-- gatilho (o soltador). NENHUM CREATE OR REPLACE de função existente — a
-- conferência 124 prova pelo catálogo que as cinco vizinhas saem daqui com as
-- marcas da U78/U81 intactas.
--
-- ── O QUE ESTA MIGRATION *NÃO* FAZ, E POR QUÊ ─────────────────────────────
-- ELA NÃO TEM CARGA RETROATIVA. Uma versão anterior tinha três passadas
-- (afirmar o passado dos concluídos com laudo, soltar o plano dos encerrados,
-- destravar os blocos presos) e DOIS `ALTER TABLE ... DISABLE TRIGGER`. Foram
-- CORTADAS inteiras, e o corte é a entrega:
--   · A CARGA É ONDE MORAVAM TODOS OS DEFEITOS FATAIS que as rodadas de
--     refutação acharam. O caminho vivo (a porta e o soltador) passou limpo.
--   · E ELA NÃO TINHA NÚMERO. Escrever uma carga contra public.chamados e
--     public.chamado_apoios sem saber quantas linhas ela alcança é escrever às
--     cegas. Medir antes de escrever é o método da casa.
--     OS NÚMEROS ESTÃO EM: supabase/migrations/_medir_antes_da_carga_u82.sql
--     (seis SELECTs, LEITURA PURA, rodam a qualquer hora). A carga vira entrega
--     separada depois deles. Dívida declarada em docs/PENDENCIAS_TECNICAS.md.
--   · O `DISABLE TRIGGER` SAIU E NÃO VOLTA. A U81 declarou por escrito que
--     gatilho desligado que alguém esquece de religar é cicatriz da casa
--     (U59/U61); e pedir ShareRowExclusive sobre public.chamados no meio de uma
--     carga que já segura RowExclusive é ESCALADA DE LOCK, com risco de deadlock
--     e com toda escrita de chamado do app pendurada atrás. Se a carga futura
--     precisar impedir uma cascata, ela impede pelo PREDICADO.
-- SEM A CARGA, ESTA MIGRATION NÃO ESCREVE UMA LINHA DE DADO: ela cria duas
-- funções e um gatilho, e as conferências 125, 126, 129 e 133 provam isso
-- medindo delta ZERO contra a foto do §1.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- §1) PRÉ-VOO — aborta e não deixa rastro
-- ═══════════════════════════════════════════════════════════════════════
DO $preflight$
DECLARE v_falta text[] := ARRAY[]::text[]; v_src text;
BEGIN
  IF to_regclass('public.agenda_campo') IS NULL THEN
    RAISE EXCEPTION 'PRE-VOO U82: public.agenda_campo não existe. A U78 não rodou.';
  END IF;

  -- A GUARDA QUE MAIS IMPORTA. Esta migration afirma N blocos numa transação.
  -- Cada carimbo move o espelho, o espelho acorda trg_chamado_apoio_dupla_upd
  -- (u76:1129) e ele chama chamado_sincronizar_apoio, cujo DELETE varre as
  -- linhas origem=dupla. SEM a coluna congelado_em e sem a linha
  -- "AND a.congelado_em IS NULL" que a U81 pôs naquele DELETE, esta migration
  -- seria uma máquina de apagar registro mais depressa.
  IF NOT EXISTS (SELECT 1 FROM pg_attribute a
                  WHERE a.attrelid = 'public.chamado_apoios'::regclass
                    AND a.attname = 'congelado_em' AND NOT a.attisdropped) THEN
    RAISE EXCEPTION E'PRE-VOO U82 — nada foi alterado (ROLLBACK).\nA U81 não rodou: chamado_apoios.congelado_em não existe. RODE A U81 PRIMEIRO.';
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname='chamado_sincronizar_apoio';
  IF position('a.congelado_em IS NULL' in COALESCE(v_src,'')) = 0 THEN
    RAISE EXCEPTION E'PRE-VOO U82 — nada foi alterado (ROLLBACK).\nO corpo VIVO de chamado_sincronizar_apoio não tem a trava da U81 no DELETE. Alguém a reescreveu por cima. NÃO force esta migration.';
  END IF;

  -- A TRAVA QUE IMPEDE O GATILHO NOVO DE SE REALIMENTAR. Ele é de
  -- public.chamados e escreve em agenda_campo; a cascata do espelho volta para
  -- public.chamados. Quem a barra é esta cláusula, e ela é LIDA, não suposta.
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname='agenda_campo_espelhar';
  IF position('status NOT IN (''concluido'',''cancelado'')' in COALESCE(v_src,'')) = 0 THEN
    RAISE EXCEPTION E'PRE-VOO U82 — nada foi alterado (ROLLBACK).\nO corpo VIVO de agenda_campo_espelhar perdeu a cláusula "status NOT IN (concluido,cancelado)".';
  END IF;

  -- O GÊMEO DO GATE TEM DE SER GÊMEO: o gate da porta nova é uma CÓPIA do de
  -- agenda_campo_cumprir. Copiar um gate que mudou é copiar o buraco.
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname='agenda_campo_cumprir';
  IF position('pode_editar_chamado' in COALESCE(v_src,'')) = 0 THEN
    RAISE EXCEPTION 'PRE-VOO U82 — nada foi alterado (ROLLBACK). agenda_campo_cumprir não cobra mais pode_editar_chamado.';
  END IF;

  IF to_regprocedure('public.agenda_campo_frase_do_conflito(uuid,uuid,date,int,int)') IS NULL THEN
    v_falta := v_falta || 'agenda_campo_frase_do_conflito(uuid,uuid,date,int,int)'; END IF;
  IF to_regprocedure('public.pode_editar_chamado(uuid)') IS NULL THEN
    v_falta := v_falta || 'pode_editar_chamado(uuid)'; END IF;
  IF to_regprocedure('public.agenda_campo_marcar(uuid,uuid,uuid,date,int,int,int,text,text)') IS NULL THEN
    v_falta := v_falta || 'agenda_campo_marcar(...)'; END IF;
  -- AS DUAS QUE O CORPO NOVO PASSOU A CHAMAR, e que o validador de plpgsql NÃO
  -- resolve: uma chamada dentro do corpo de uma função é texto até a primeira
  -- execução. Sem estas duas linhas, se `referencia_semanal` ou `dia_da_dupla`
  -- sumir ou trocar de assinatura, esta migration CRIA a porta sem reclamar e o
  -- erro aparece em produção, no meio de um encerramento. As duas travas de
  -- A terceira metade da trava (o congelamento do §2) depende das duas.
  IF to_regprocedure('public.referencia_semanal(date)') IS NULL THEN
    v_falta := v_falta || 'referencia_semanal(date)'; END IF;
  IF to_regprocedure('public.dia_da_dupla(timestamptz,timestamptz)') IS NULL THEN
    v_falta := v_falta || 'dia_da_dupla(timestamptz,timestamptz)'; END IF;
  IF array_length(v_falta,1) IS NOT NULL THEN
    RAISE EXCEPTION E'PRE-VOO U82 — nada foi alterado (ROLLBACK).\nFaltam: %', array_to_string(v_falta, ', ');
  END IF;

  -- A porta única continua única (a mesma checagem da U79 §1).
  IF has_table_privilege('authenticated','public.agenda_campo','UPDATE') THEN
    RAISE EXCEPTION 'PRE-VOO U82: authenticated JÁ escreve direto em public.agenda_campo. Conserte isso antes de abrir mais uma porta.';
  END IF;
END
$preflight$;

CREATE TEMP TABLE u82_foto ON COMMIT DROP AS
SELECT (SELECT count(*) FROM public.agenda_campo WHERE cumprido_em  IS NOT NULL) AS cumpridos_antes,
       (SELECT count(*) FROM public.agenda_campo WHERE cancelado_em IS NOT NULL) AS cancelados_antes,
       (SELECT count(*) FROM public.chamado_apoios)                              AS apoios_antes,
       (SELECT count(*) FROM public.chamado_apoios WHERE origem='dupla')         AS dupla_antes,
       (SELECT count(*) FROM public.chamado_apoios WHERE congelado_em IS NOT NULL) AS congelados_antes,
       (SELECT count(*) FROM public.notificacoes)                                AS sinos_antes;

-- ═══════════════════════════════════════════════════════════════════════
-- §2) A PORTA — afirmar as visitas de UM chamado, de uma vez, atomicamente
-- ═══════════════════════════════════════════════════════════════════════
-- ELA NÃO ESCREVE chamados.status, e isso é decisão. Existem três semânticas de
-- encerramento vivas (executarChamado, concluirChamado, concluir_chamado_com_
-- cobranca); dobrar qualquer uma criaria a quarta. A ÚNICA escrita em
-- public.chamados aqui é a transição estreita 'agendado' -> 'aberto' quando cai
-- o último pendente — gêmeo literal de u78:1546-1553.
--
-- N BLOCOS SÃO UM LAÇO, E NÃO UM UPDATE EM CONJUNTO. Esta é a linha mais fácil
-- de "simplificar" e a que mais estraga. Num UPDATE por conjunto os N gatilhos
-- BEFORE rodam durante a varredura (todos leem o MESMO espelho) e os N AFTER só
-- disparam no fim do statement, quando todos os blocos já estão cumpridos: o
-- estágio 1 de agenda_campo_espelhar não acha nada, o estágio 2 devolve o
-- ÚLTIMO, o espelho SALTA do primeiro ao último e as turmas de TODAS as semanas
-- do meio nunca são escritas. O laço em ordem CRESCENTE faz o espelho andar
-- semana a semana, e cada turma é gravada e congelada no caminho.
--
-- MAS A ORDEM SOZINHA NÃO BASTA, e isto custou uma rodada inteira para
-- aparecer: dentro do laço, mover o dia e carimbar têm de ser DOIS statements.
-- Num só, o bloco deixa de ser pendente no MESMO instante em que muda de dia, o
-- estágio 1 já não o vê e salta para o próximo pendente — o espelho nunca
-- repousa na semana afirmada, e ordenar o laço não muda isso. As duas coisas
-- juntas é que fazem a promessa acima ser verdade. Ver o §2, item 4.
--
-- E A ORDEM É PELO DIA EFETIVO: quem move um bloco de terça-que-vem para hoje
-- está dizendo que ele aconteceu HOJE.
--
-- clock_timestamp() E NÃO now(): now() é o timestamp da TRANSAÇÃO, e os N
-- blocos receberiam UM instante só — o gatilho da U81 gravaria congelado_em
-- igual para todas as turmas e idasDoApoio (modelo.ts) devolveria UMA ida com
-- as turmas de todas as semanas juntas, cega no caso que ela existe para
-- descrever. clock_timestamp() avança dentro da transação.
CREATE OR REPLACE FUNCTION public.agenda_campo_afirmar(
  _chamado     uuid,
  _feitos      jsonb  DEFAULT '[]'::jsonb,
  _desmarcados uuid[] DEFAULT NULL)
RETURNS TABLE(afirmados int, movidos int, desmarcados int)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $afirmar$
DECLARE
  r          record;
  v_natureza text;
  v_agora    timestamptz;
  v_hoje     date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_frase    text;
  v_af int := 0; v_mv int := 0; v_ds int := 0; v_n int;
BEGIN
  IF _chamado IS NULL THEN
    RAISE EXCEPTION 'Diga de qual chamado são estes atendimentos.' USING ERRCODE = '55000';
  END IF;

  SELECT c.natureza INTO v_natureza FROM public.chamados c WHERE c.id = _chamado;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Este chamado não existe mais — recarregue a tela.' USING ERRCODE = '55000';
  END IF;

  -- 1) O GATE, LETRA POR LETRA O DE agenda_campo_cumprir (u78:1585-1589).
  --    ELE NÃO ALARGA NADA, e isso é fato de catálogo: o app encerra por UPDATE
  --    cru em public.chamados, cuja única policy de UPDATE é chamados_update
  --    com USING/WITH CHECK pode_editar_chamado(id) (s1:419-422). Mesma função,
  --    mesmo argumento. Quem consegue CONCLUIR já consegue CARIMBAR hoje, um
  --    bloco de cada vez, pelo botão da grade.
  IF auth.uid() IS NOT NULL AND NOT public.pode_editar_chamado(_chamado) THEN
    RAISE EXCEPTION 'Você não responde por este chamado. Peça a quem responde por ele, ou à gestão.'
      USING ERRCODE = '42501';
  END IF;

  -- A divisão do §3 da U78 dita de novo: esta função é SECURITY DEFINER e passa
  -- por cima de chamados_update.
  IF v_natureza IS DISTINCT FROM 'campo' THEN
    RAISE EXCEPTION 'A agenda de campo não manda em chamado comercial (este é "%") — quem desmarca a visita é a própria visita técnica.',
      COALESCE(v_natureza, 'sem natureza') USING ERRCODE = '55000';
  END IF;

  -- 2) DESMARCAR NÃO APAGA REGISTRO. A recusa vem ANTES de qualquer escrita e é
  --    a MESMA frase de agenda_campo_cancelar (u78:1523) e de erroDoCancelamento
  --    (modelo.ts:1213). Uma regra com duas redações é uma regra que o usuário
  --    aprende a não ler.
  IF _desmarcados IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.agenda_campo a
        WHERE a.chamado_id = _chamado AND a.id = ANY(_desmarcados)
          AND a.cumprido_em IS NOT NULL) THEN
    RAISE EXCEPTION 'Este atendimento já está marcado como feito — desmarcá-lo apagaria o registro de que ele aconteceu. Se ele NÃO aconteceu, tire o "feito" do bloco primeiro e desmarque depois.'
      USING ERRCODE = '55000';
  END IF;

  -- 3) ENSAIO GERAL — TODAS AS COLISÕES ANTES DE QUALQUER ESCRITA.
  --    Duas passagens em vez de uma, de propósito: numa passagem só, o quarto
  --    bloco colidindo abortaria depois de três carimbos já escritos, e o
  --    ROLLBACK devolveria o técnico a um estado que ele não consegue explicar.
  --    Aqui o gesto falha inteiro ANTES de existir, o chamado NÃO foi concluído,
  --    e a tela oferece as duas saídas com a frase que NOMEIA o conflitante.
  --    NADA É RECUSADO POR DATA: o que se checa é a agenda da equipe, e a saída
  --    "afirmar mantendo o dia marcado" está sempre disponível.
  FOR r IN
    SELECT a.id, a.dia AS dia_atual, COALESCE(f.dia, a.dia) AS dia_efetivo,
           a.dupla_id, a.inicio_min::int AS inicio,
           a.deslocamento_min::int AS desloc, a.servico_min::int AS servico
      FROM jsonb_to_recordset(COALESCE(_feitos, '[]'::jsonb)) AS f(id uuid, dia date)
      JOIN public.agenda_campo a ON a.id = f.id
     WHERE a.chamado_id = _chamado
       AND a.cancelado_em IS NULL AND a.cumprido_em IS NULL
  LOOP
    -- 3a) O DIA TEM DUAS RESPOSTAS, E SÃO ESTAS DUAS.
    --     `diaAfirmado` (modelo.ts) só sabe produzir DUAS datas: o dia do
    --     PRÓPRIO BLOCO ou HOJE. Qualquer terceira é corpo de REST fora do
    --     contrato — de um ataque ou de um bug de cliente, com o mesmo efeito.
    --     E a data escolhe a SEMANA ISO, a semana escolhe a turma, e a turma
    --     congelada é ACESSO PERMANENTE de edição ao chamado, ao cliente, às
    --     fotos e ao pedido de compra (R108).
    --     A VERSÃO ANTERIOR DESTA GUARDA RECUSAVA SÓ `> v_hoje`, E DEIXAVA O
    --     PASSADO INTEIRO ABERTO — que é justamente onde as escalas antigas
    --     moram: com `dia` numa semana de um ano atrás, o espelho anda, a
    --     semana muda, chamado_sincronizar_apoio roda e o INSERT de u81:461-469
    --     grava a turma DAQUELA semana já CONGELADA, porque a semana passou a
    --     ter visita afirmada. Gente que nunca esteve no prédio nasce com
    --     acesso permanente.
    --     ISTO NÃO É GUARDA DE DATA NO SENTIDO DO DAVI (04/09). Nada aqui
    --     recusa fazer o serviço antes do dia marcado, e nada aqui recusa o
    --     carimbo: o dia do PRÓPRIO BLOCO é sempre aceito (é a saída "afirmar
    --     mantendo o dia marcado", e é por isso que a condição exige
    --     `IS DISTINCT FROM`), e "aconteceu HOJE" é sempre aceito. O que se
    --     recusa é uma data que a TELA NÃO SABE PRODUZIR.
    IF r.dia_efetivo IS DISTINCT FROM r.dia_atual
       AND r.dia_efetivo IS DISTINCT FROM v_hoje THEN
      RAISE EXCEPTION 'O dia de um atendimento afirmado é o dia que estava marcado, ou HOJE — não uma data qualquer. Recarregue a tela e refaça o gesto.'
        USING ERRCODE = '55000';
    END IF;

    IF r.dia_efetivo IS DISTINCT FROM r.dia_atual THEN
      v_frase := public.agenda_campo_frase_do_conflito(
                   r.id, r.dupla_id, r.dia_efetivo,
                   r.inicio - r.desloc, r.inicio + r.servico);
      IF v_frase IS NOT NULL THEN
        RAISE EXCEPTION '% Este atendimento aconteceu num dia em que a equipe já tem outro compromisso marcado. Ajuste o horário dele na grade, ou afirme mantendo o dia que estava marcado — nesse caso o registro vai dizer esse dia.',
          v_frase USING ERRCODE = '23P01';
      END IF;
    END IF;
  END LOOP;

  -- 4) AS AFIRMAÇÕES, NA ORDEM EM QUE AS VISITAS ACONTECERAM
  FOR r IN
    SELECT a.id, a.dia AS dia_atual, COALESCE(f.dia, a.dia) AS dia_efetivo,
           a.dupla_id, a.inicio_min::int AS inicio,
           a.deslocamento_min::int AS desloc, a.servico_min::int AS servico
      FROM jsonb_to_recordset(COALESCE(_feitos, '[]'::jsonb)) AS f(id uuid, dia date)
      JOIN public.agenda_campo a ON a.id = f.id
     WHERE a.chamado_id = _chamado
       AND a.cancelado_em IS NULL AND a.cumprido_em IS NULL
     ORDER BY COALESCE(f.dia, a.dia), a.inicio_min, a.id
  LOOP
    v_agora := clock_timestamp();

    IF r.dia_efetivo IS DISTINCT FROM r.dia_atual THEN
      -- `dia` NO SET ACORDA agenda_campo_valida (u78:786), DE PROPÓSITO: é ele
      -- que recusa remarcar trabalho encerrado para quem não é gestão. Enquanto
      -- o app chamar esta porta ANTES de escrever o status, o técnico passa.
      -- O handler cobre a corrida que o ensaio não vê (duas afirmações
      -- simultâneas, ou dois blocos DESTE lote caindo no mesmo horário de hoje).
      --
      -- ── NÃO EXISTE PRÉ-TRAVA AQUI, E A AUSÊNCIA É A DECISÃO ──────────────
      -- Duas versões dela foram escritas e as duas foram apagadas. Vale contar,
      -- porque a terceira pessoa a ler isto vai querer escrevê-la de novo.
      --
      -- O QUE ELA TENTAVA SALVAR: quando a turma da semana em que o espelho
      -- repousa é VAZIA, o DELETE de u81:417-434 limpa toda linha origem='dupla'
      -- viva e o INSERT de u81:437-471 é PULADO — a lista de quem esteve no
      -- prédio some, sem sino, sem evento e sem DESFAZER.
      --
      -- POR QUE APAGAR MESMO ASSIM. `v_alvo` é vazio por DOIS caminhos, e a
      -- pré-trava só alcançava o primeiro:
      --   (a) `responsavel_id IS NULL` — e este é o caso quase morto: tirar o
      --       responsável já está na lista OF de trg_chamado_apoio_dupla_upd
      --       (u76:1129), então o sincronizar JÁ rodou com v_alvo vazio e já
      --       apagou as linhas vivas naquele instante;
      --   (b) responsável PRESENTE e `parceiros_da_dupla(resp, semana)` vazia —
      --       responsável fora da escala daquela semana, ou turma de uma pessoa
      --       só. É o caso COMUM, e a pré-trava não o cobria.
      -- Cobrir (b) exige saber EM QUE SEMANA O ESPELHO VAI REPOUSAR, e isto roda
      -- ANTES do movimento: com outro bloco pendente o espelho não vai para
      -- `dia_efetivo`, vai para o próximo pendente. Acertar o predicado obrigaria
      -- a reconstruir os dois estágios de agenda_campo_espelhar aqui dentro —
      -- exatamente a maquinaria nova pela qual o ramo de reabertura foi cortado
      -- do §3. Um mecanismo cuja condição de disparo ninguém consegue avaliar no
      -- instante em que ela roda é pior do que a ausência dele.
      --
      -- E O RESÍDUO NÃO É REGRESSÃO: pelo caminho de dois passos que sempre
      -- existiu (arrastar na grade, depois carimbar) o comportamento é IDÊNTICO —
      -- o arrasto move o espelho, o sincronizar roda, e turma vazia limpa a
      -- lista. A U82 não piora nada; ela só não conserta isto. Está declarado em
      -- docs/PENDENCIAS_TECNICAS.md, e a saída é humana: repor pelo chip de apoio.

      BEGIN
        -- DOIS STATEMENTS, E A SEPARAÇÃO É O MECANISMO — não é estilo.
        -- Num UPDATE só, o bloco deixa de ser pendente NO MESMO INSTANTE em que
        -- muda de dia. Quando trg_agenda_campo_espelho_upd roda (AFTER), o
        -- estágio 1 de agenda_campo_espelhar (u78:859-866) já não o vê e salta
        -- para o PRÓXIMO pendente: o espelho NUNCA REPOUSA na semana em que a
        -- visita foi afirmada. E como a turma de apoio só é escrita quando o
        -- espelho repousa numa semana, a turma daquela semana não é escrita por
        -- caminho nenhum — nem pelo BEFORE da U81 (que no BEFORE ainda vê o
        -- espelho antigo, u81:330-333), nem pelo item 5b (que mede a semana do
        -- espelho FINAL, que é outra). Quem esteve no prédio ficava sem linha,
        -- e na variante de semanas diferentes a turma ANTIGA era APAGADA e
        -- substituída por quem ainda não foi.
        -- Separando, o espelho passa pela semana nova com o bloco ainda
        -- PENDENTE — chamado_sincronizar_apoio grava a turma certa — e só então
        -- o carimbo acorda o BEFORE da U81, que a congela com o instante do
        -- bloco. É exatamente o que o caminho de dois passos da grade (arrastar,
        -- depois carimbar) sempre fez, e que a porta atômica tinha perdido.
        -- Conferido que a divisão não muda mais nada: agenda_campo_valida tem
        -- `dia` na lista OF e `cumprido_em` NÃO (u78:786), então ela continua
        -- acordando exatamente uma vez; o EXCLUDE é imediato e é o PRIMEIRO
        -- UPDATE que o viola, dentro do mesmo BEGIN…EXCEPTION; e o ROW_COUNT
        -- que interessa é o do segundo.
        UPDATE public.agenda_campo
           SET dia = r.dia_efetivo
         WHERE id = r.id AND cumprido_em IS NULL AND cancelado_em IS NULL;
        UPDATE public.agenda_campo
           SET cumprido_em = v_agora
         WHERE id = r.id AND cumprido_em IS NULL AND cancelado_em IS NULL;
        GET DIAGNOSTICS v_n = ROW_COUNT;
      EXCEPTION WHEN exclusion_violation THEN
        RAISE EXCEPTION '%', COALESCE(
          public.agenda_campo_frase_do_conflito(r.id, r.dupla_id, r.dia_efetivo,
                                                r.inicio - r.desloc, r.inicio + r.servico),
          'Outra pessoa marcou este horário para esta equipe agora mesmo — recarregue a grade e refaça o gesto.')
          USING ERRCODE = 'exclusion_violation';
      END;
      v_af := v_af + v_n; v_mv := v_mv + v_n;
    ELSE
      -- SEM `dia` NO SET. `AFTER UPDATE OF` dispara pela PRESENÇA da coluna no
      -- SET, mesmo com valor igual (u78:938-947): pôr `dia` aqui acordaria
      -- agenda_campo_valida à toa e mataria o caminho "afirmar depois" pelo chip
      -- num chamado que outro caminho já encerrou.
      UPDATE public.agenda_campo
         SET cumprido_em = v_agora
       WHERE id = r.id AND cumprido_em IS NULL AND cancelado_em IS NULL;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      v_af := v_af + v_n;
    END IF;
  END LOOP;

  -- 5) O QUE NÃO VAI ACONTECER
  IF _desmarcados IS NOT NULL AND array_length(_desmarcados,1) IS NOT NULL THEN
    UPDATE public.agenda_campo
       SET cancelado_em = now(), cancelado_por = auth.uid()
     WHERE chamado_id = _chamado AND id = ANY(_desmarcados)
       AND cancelado_em IS NULL AND cumprido_em IS NULL;
    GET DIAGNOSTICS v_ds = ROW_COUNT;
  END IF;

  -- 5b) A TERCEIRA METADE DA TRAVA — e ela é a ÚNICA que faz o trabalho aqui
  --     dentro, porque a pré-trava foi apagada (ver o item 4).
  --     ELA SÓ RODA QUANDO ESTA CHAMADA AFIRMOU ALGUMA COISA, e é isso que a
  --     guarda `v_af > 0` diz. Uma chamada que só DESMARCA passa por aqui sem
  --     escrever nada — de propósito, e a versão anterior deste comentário
  --     prometia o contrário ao dizer "inclusive o efeito dos desmarcados". O
  --     desmarque muda o espelho e pode mudar a turma viva, e NADA aqui congela
  --     essa mudança: congelar exige que alguém tenha afirmado uma visita.
  --     Quando há afirmação, o espelho já assentou (inclusive o efeito dos
  --     desmarcados desta mesma chamada) e aponta para a semana em que a última
  --     visita afirmada caiu; as linhas origem='dupla' daquela
  --     semana podem ter ficado com congelado_em NULL por DOIS caminhos:
  --       · o INSERT da U81 (u81:461-469) é ON CONFLICT DO NOTHING e não toca
  --         em quem já estava na tabela;
  --       · o BEFORE da U81 devolveu cedo porque, NAQUELE instante, o espelho
  --         ainda era o de antes.
  --     A régua aqui é a MESMA do §5 da U81 (u81:552-568) — "esta semana já tem
  --     visita afirmada?" —, restrita a UM chamado. O instante é o do BLOCO
  --     (max(cumprido_em) da semana), e nunca o do relógio, para idasDoApoio
  --     continuar separando as idas.
  --     A conferência 132 mede o furo. Se ela SUBIR depois que a porta entrar
  --     em uso, isto aqui não está fechando.
  --
  --     `IF v_af > 0`: SÓ QUANDO ESTA CHAMADA AFIRMOU ALGUMA COISA. Sem a
  --     guarda, uma chamada que só DESMARCA (o chip, com "não vai acontecer" e
  --     nenhum "aconteceu") congelava a turma viva com o max(cumprido_em) de uma
  --     visita ANTIGA. Congelar é irreversível e concede acesso permanente de
  --     edição (R108): um gesto que não afirmou nada não pode produzir escrita
  --     que ninguém desfaz.
  IF v_af > 0 THEN
    UPDATE public.chamado_apoios ap
       SET congelado_em = x.instante
      FROM (SELECT max(a.cumprido_em) AS instante
              FROM public.agenda_campo a
              JOIN public.chamados c ON c.id = a.chamado_id
             WHERE a.chamado_id = _chamado
               AND a.cancelado_em IS NULL
               AND a.cumprido_em  IS NOT NULL
               AND c.data_hora_agendada IS NOT NULL
               AND public.referencia_semanal(a.dia)
                 = public.referencia_semanal(
                     public.dia_da_dupla(c.data_hora_agendada, c.created_at))) x
     WHERE ap.chamado_id = _chamado
       AND ap.origem = 'dupla'
       AND ap.congelado_em IS NULL
       AND x.instante IS NOT NULL;
  END IF;

  -- 6) A TRANSIÇÃO ESTREITA — gêmeo de u78:1546-1553 e de statusAposOsBlocos.
  --    Sem ela, uma queda de rede entre esta chamada e o encerramento deixaria
  --    o chip dizendo "agendado" sem nada pendente.
  UPDATE public.chamados SET status = 'aberto'
   WHERE id = _chamado AND status = 'agendado' AND natureza = 'campo'
     AND NOT EXISTS (SELECT 1 FROM public.agenda_campo a
                      WHERE a.chamado_id = _chamado
                        AND a.cancelado_em IS NULL AND a.cumprido_em IS NULL);

  RETURN QUERY SELECT v_af, v_mv, v_ds;
END;
$afirmar$;

REVOKE EXECUTE ON FUNCTION public.agenda_campo_afirmar(uuid,jsonb,uuid[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.agenda_campo_afirmar(uuid,jsonb,uuid[]) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.agenda_campo_afirmar(uuid,jsonb,uuid[]) TO service_role;

COMMENT ON FUNCTION public.agenda_campo_afirmar(uuid,jsonb,uuid[]) IS
  'Afirma que N blocos de UM chamado aconteceram, e opcionalmente desmarca os '
  'que não vão acontecer. NÃO escreve chamados.status (salvo a transição '
  'agendado->aberto quando some o último pendente): quem encerra é o app, '
  'DEPOIS. Carimba num LAÇO em ordem crescente de dia EFETIVO — um UPDATE em '
  'conjunto faria o espelho saltar do primeiro bloco ao último e perderia as '
  'turmas de apoio de todas as semanas do meio. Um instante por bloco, para '
  'idasDoApoio separar as idas. Move o dia quando o carimbo diz que a visita '
  'aconteceu em outro dia; não checa jornada (política de planejamento) e '
  'respeita o EXCLUDE. NÃO recusa carimbo por data — fazer antes do dia marcado '
  'é legítimo (Davi, 04/09); o dia de um bloco afirmado é o dia que estava '
  'marcado ou HOJE, que são as duas únicas datas que a tela sabe produzir, e '
  'qualquer terceira é corpo de REST fora do contrato. Congela as linhas de '
  'apoio DEPOIS de o espelho assentar, e só quando esta chamada afirmou algo: é '
  'a TERCEIRA METADE DA TRAVA, necessária porque o gatilho BEFORE da U81 lê o '
  'espelho de ANTES e o INSERT dela é ON CONFLICT DO NOTHING. Mover o dia e '
  'carimbar são DOIS statements de propósito — num só, o bloco sai do conjunto '
  'pendente antes de o espelho passar pela semana nova, e a turma de quem '
  'esteve no prédio não é escrita por caminho nenhum. NÃO existe pré-trava '
  'antes do movimento: cobrir o caso que ela deixava aberto (responsável '
  'presente e turma vazia) exigiria prever em que semana o espelho vai '
  'repousar, que é reconstruir agenda_campo_espelhar aqui dentro.';

-- ═══════════════════════════════════════════════════════════════════════
-- §3) O SOLTADOR — o encerramento não deixa PLANO pendente, e afirma ZERO
-- ═══════════════════════════════════════════════════════════════════════
-- O QUE ELE FAZ: desmarca o bloco que ainda era PLANO FUTURO (dia > hoje) num
-- chamado concluído, e TODOS os pendentes num chamado cancelado.
--
-- O QUE ELE NÃO FAZ, E É POR ISSO QUE ELE PODE EXISTIR:
--   · NÃO escreve cumprido_em. Logo não precisa de evidência, não congela nada,
--     não concede acesso nenhum e a pergunta "um gatilho SECURITY DEFINER abre
--     porta?" não se aplica — ele não abre porta, ele fecha agenda.
--   · NÃO escreve `dia`. Logo trg_agenda_campo_valida (OF chamado_id, dia,
--     inicio_min) NÃO acorda, e ninguém leva 42501 ao concluir o próprio
--     chamado.
--   · TODA escrita dele é REVERSÍVEL: agenda_campo_marcar ressuscita bloco
--     desmarcado (u78:1399, cancelado_em = NULL).
--
-- E ELE É MUDO POR CONSTRUÇÃO, não por sorte: cancelado_em não está na lista OF
-- do gatilho de congelamento (BEFORE INSERT OR UPDATE OF cumprido_em, u81:372),
-- e o espelho, num chamado já terminal, casa zero linhas (u78:895) — logo
-- trg_chamado_apoio_dupla_upd nunca dispara, chamado_sincronizar_apoio não roda,
-- e o sino do apoio (AFTER INSERT, u7:502) não tem o que disparar.
CREATE OR REPLACE FUNCTION public.chamado_solta_agenda()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $solta$
DECLARE v_hoje date; v_n int := 0;
BEGIN
  -- SÓ CAMPO. agenda_campo_valida (u78:769-772) recusa bloco de outra natureza,
  -- então aqui ele é inerte por CONSTRUÇÃO — inclusive no
  -- INSERT ... ON CONFLICT DO UPDATE de trg_sincronizar_chamado_da_visita
  -- (u38:68-86), que é comercial e que DISPARA gatilhos de UPDATE.
  IF NEW.natureza IS DISTINCT FROM 'campo' THEN RETURN NULL; END IF;

  -- NÃO HÁ RAMO DE REABERTURA AQUI, E A AUSÊNCIA É DECISÃO ESCRITA.
  -- Uma rodada anterior pôs neste ponto um `PERFORM agenda_campo_espelhar(NEW.id)`
  -- para consertar, na reabertura, o espelho que ficou apontando para o bloco
  -- que este mesmo gatilho desmarcou. Ele foi RETIRADO, e por uma razão de
  -- mecanismo: agenda_campo_espelhar escreve chamados.data_hora_agendada
  -- (u78:891-898), e essa coluna ESTÁ na lista OF de trg_chamado_apoio_dupla_upd
  -- (u76:1129). Com o chamado já reaberto o status não é mais terminal, então
  -- chamado_apoio_da_dupla NÃO volta cedo (u78:1825): se a semana do espelho
  -- mudar ele chama chamado_sincronizar_apoio, que (a) APAGA as linhas
  -- origem='dupla' não congeladas fora da turma nova — a lista INTEIRA quando o
  -- responsável está vazio, porque v_alvo='{}' faz o NOT limpar tudo
  -- (u81:415-434); (b) INSERE a turma nova JÁ CONGELADA, porque a semana do
  -- espelho novo é a da última visita AFIRMADA e o max(cumprido_em) de
  -- u81:461-469 não é NULL — e congelar concede ACESSO PERMANENTE de edição ao
  -- chamado, ao cliente, às fotos e ao pedido de compra (R108); e (c) toca um
  -- sino por linha inserida (trg_notify_chamado_apoio, u7:502).
  -- O GATILHO QUE ESTE CABEÇALHO JURA QUE "NÃO AFIRMA NADA" PASSARIA A
  -- CONGELAR, APAGAR E TOCAR SINO — por efeito colateral, sem ninguém decidir,
  -- e sem nada disso ser reversível. Fechar aquele ramo para o caso perigoso
  -- exigiria RECONSTRUIR os dois estágios de agenda_campo_espelhar aqui dentro,
  -- como gêmeo, para saber de antemão se a semana muda: maquinaria nova para
  -- consertar um espelho podre que JÁ É PRÉ-EXISTENTE — encerrar um chamado
  -- com bloco futuro deixa o espelho pinado hoje, sem esta migration.
  -- Está declarado como P35 em docs/PENDENCIAS_TECNICAS.md, e a saída é a que
  -- já existe: rearrastar o bloco na grade (agenda_campo_marcar, u78:1399)
  -- recalcula o espelho pelo caminho normal.

  -- SÓ A TRANSIÇÃO PARA UM VALOR TERMINAL. "Continua concluído" não é um
  -- encerramento: sem a segunda linha, todo salvamento de um chamado já
  -- concluído desmarcaria blocos criados DEPOIS, sem ninguém ter dito nada.
  -- `IS NULL` explícito: é defesa em profundidade, NÃO necessidade — hoje
  -- chamados.status é `text NOT NULL DEFAULT 'aberta'` (etapa3:85) e nenhuma
  -- migration derruba o NOT NULL. (A versão anterior desta linha justificava-se
  -- dizendo que `chamados_status_check` deixa NULL passar; o CHECK realmente
  -- deixaria, mas a coluna nunca chega lá. Uma defesa correta com uma razão
  -- falsa é como nasce a crença que a próxima pessoa herda.) Se um dia o NOT
  -- NULL cair, `NULL NOT IN (…)` é NULL e o IF cairia no ramo "não retorna",
  -- deixando um status nulo escorrer para o UPDATE lá embaixo. Custa uma
  -- cláusula; fica.
  IF NEW.status IS NULL OR NEW.status NOT IN ('concluido','cancelado') THEN RETURN NULL; END IF;
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NULL; END IF;

  -- now() E NÃO NEW.concluida_em: `concluida_em` é escrevível por ChamadoPatch
  -- (chamados/data.ts:221), e quem escolhe a data escolheria onde cai o corte.
  -- O relógio não se negocia. E ele NÃO decide se afirmo — nada aqui afirma.
  v_hoje := (now() AT TIME ZONE 'America/Sao_Paulo')::date;

  -- BLOCO DE HOJE NÃO É TOCADO, e a ausência é decisão: um bloco marcado para
  -- hoje às 16h num chamado concluído às 10h pode ter acontecido de manhã ou
  -- pode não ir acontecer, e nenhuma das duas leituras é derivável. Ele fica
  -- PENDENTE e aparece no chip, para quem sabe responder.
  -- `cumprido_em IS NULL`: bloco afirmado NUNCA é desmarcado por esta função —
  -- é a recusa de agenda_campo_cancelar (u78:1522-1525) dita do lado de dentro.
  UPDATE public.agenda_campo a
     SET cancelado_em = now(), cancelado_por = auth.uid()
   WHERE a.chamado_id = NEW.id
     AND a.cancelado_em IS NULL
     AND a.cumprido_em IS NULL
     AND (NEW.status = 'cancelado' OR a.dia > v_hoje);
  GET DIAGNOSTICS v_n = ROW_COUNT;

  -- A LINHA DO TEMPO, e ela é a resposta à objeção mais forte contra qualquer
  -- gatilho: um que resolve doze blocos em silêncio é invisível para quem lê o
  -- app. chamado_eventos_select é `pode_acessar_chamado(chamado_id)` desde a S4
  -- (s4:301-305; era USING(true) de 19/08 a 03/09 — a premissa que a rodada
  -- anterior escreveu aqui, e que a S4 tinha substituído dois dias antes), logo
  -- o texto só chega a quem já pode abrir a capa. O INSERT passa porque este
  -- gatilho é SECURITY DEFINER. E não toca sino: notify_chamado_comentario volta
  -- cedo em tipo <> 'comentario' (u7:468).
  -- QUEM VÊ O EVENTO: a linha do tempo de DetalheCampo renderiza todo tipo
  -- (`ev.descricao ?? ev.tipo`); PainelChamado filtra `tipo === "comentario"`,
  -- então quem encerra pelo seletor daquele painel não vê este evento na hora.
  -- É recorte declarado, não promessa quebrada.
  -- O TEXTO NÃO AFIRMA O QUE NINGUÉM VERIFICOU. A versão anterior dizia que os
  -- atendimentos "ainda não tinham acontecido" — e no CANCELAMENTO isso é
  -- desmarcado também para bloco de dia PASSADO, sobre o qual ninguém disse
  -- nada. A máquina deduziu de "estava pendente" e gravou como fato na linha do
  -- tempo, que é exatamente a substituição que a recusa 5 do §5 da U81 proíbe.
  -- Agora ele diz só o que é verdade: foram desmarcados, e nenhum foi marcado
  -- como feito. A assimetria concluído × cancelado continua sendo decisão
  -- declarada (P39), e a frase deixou de depender dela.
  IF v_n > 0 THEN
    INSERT INTO public.chamado_eventos (chamado_id, tipo, descricao, user_id)
    VALUES (NEW.id, 'agenda_solta',
            'Encerramento: ' || v_n || ' atendimento(s) pendentes foram desmarcados. Nenhum foi marcado como feito — quem esteve no prédio ainda pode dizer isso pelo aviso do chamado.',
            auth.uid());
  END IF;

  RETURN NULL;   -- AFTER de linha: o retorno é ignorado
END;
$solta$;
REVOKE EXECUTE ON FUNCTION public.chamado_solta_agenda() FROM PUBLIC, anon;

COMMENT ON FUNCTION public.chamado_solta_agenda() IS
  'No encerramento de um chamado de CAMPO, desmarca o que ainda era PLANO: dia '
  'que não chegou (e TUDO, no cancelado). NUNCA escreve cumprido_em nem dia — '
  'não afirma nada, não congela nada, não concede nada, e toda escrita dele é '
  'reversível por agenda_campo_marcar. Bloco de HOJE e bloco já cumprido são '
  'intocados. Quem AFIRMA é gente, por agenda_campo_afirmar, ANTES do status. '
  'Na REABERTURA ele não faz NADA: não desfaz e também não conserta o espelho. '
  'Consertá-lo exigiria chamar agenda_campo_espelhar, que escreve '
  'chamados.data_hora_agendada e acorda a cascata do apoio (u76:1129) — '
  'congelando, apagando e tocando sino por efeito colateral. O espelho podre '
  'depois de reabrir é P35, pré-existente, e sai rearrastando o bloco na grade.';

-- A ORDEM CONTRA OS VIZINHOS É INDIFERENTE, E ISSO SE PROVA: este gatilho
-- escreve em agenda_campo e chamado_eventos; trg_chamado_apoio_dupla_upd
-- escreve em chamado_apoios. Conjuntos DISJUNTOS — e a frase é verdadeira nos
-- DOIS caminhos do gatilho porque ele não tem um terceiro: no encerramento ele
-- desmarca e registra, e na reabertura ele não faz nada. Foi um ramo de
-- REABERTURA que tornou esta frase falsa por uma rodada (ele chamava
-- agenda_campo_espelhar, que escreve chamados.data_hora_agendada, coluna que
-- ESTÁ na lista OF daquele vizinho, u76:1129) — e é por isso que ele saiu.
-- E mesmo que os conjuntos não fossem disjuntos,
-- chamado_apoio_da_dupla volta cedo em encerrado sem troca de dono (u78:1825).
-- O nome ainda vem antes de 'apoio' ('ag' < 'ap') por estabilidade, e a
-- conferência 120 lê a ordem do CATÁLOGO para que um rename futuro apareça.
DROP TRIGGER IF EXISTS trg_chamado_agenda_solta ON public.chamados;
CREATE TRIGGER trg_chamado_agenda_solta
  AFTER UPDATE OF status ON public.chamados
  FOR EACH ROW EXECUTE FUNCTION public.chamado_solta_agenda();
-- SEM BRAÇO DE INSERT, de propósito: um chamado não tem bloco antes de existir,
-- e a importação do Notion é ON CONFLICT DO NOTHING (INSERT puro). Bloco criado
-- DEPOIS num chamado encerrado é ato de gestor (u78:774-776) que DIZ que há mais
-- trabalho — soltá-lo sozinho seria desdizer quem acabou de marcar.

-- ═══════════════════════════════════════════════════════════════════════
-- §5) CONFERÊNCIA — obtido × esperado × veredito ('>>> OLHAR <<<')
-- ═══════════════════════════════════════════════════════════════════════
SELECT t.ordem, t.conferencia, t.valor, t.esperado,
       CASE WHEN t.esperado = '(referência)'             THEN '— referência'
            WHEN t.valor IS NOT DISTINCT FROM t.esperado THEN 'ok'
            ELSE '>>> OLHAR <<<' END AS veredito
  FROM (

SELECT 118 AS ordem,
 'CRÍTICO: a porta existe com a assinatura EXATA, é SECURITY DEFINER, authenticated executa e anon NÃO' AS conferencia,
 ((to_regprocedure('public.agenda_campo_afirmar(uuid,jsonb,uuid[])') IS NOT NULL)::int
 + (SELECT p.prosecdef::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname='agenda_campo_afirmar')
 + has_function_privilege('authenticated','public.agenda_campo_afirmar(uuid,jsonb,uuid[])','EXECUTE')::int
 + (NOT has_function_privilege('anon','public.agenda_campo_afirmar(uuid,jsonb,uuid[])','EXECUTE'))::int)::text AS valor,
 '4' AS esperado
UNION ALL
-- O SCHEMA SAIU DO `LIKE`, e não é detalhe: pg_get_triggerdef renderiza o nome
-- da tabela por generate_relation_name, que OMITE o schema quando a relação é
-- visível no search_path — e no SQL Editor do Supabase `public` está lá. O
-- `LIKE '%… ON public.chamados%'` daria FALSO numa migration correta, e falso
-- positivo em linha CRÍTICO é pior que linha nenhuma: ensina a ignorar o
-- '>>> OLHAR <<<'. O `tgrelid = 'public.chamados'::regclass` do WHERE já prende
-- a tabela, e as máscaras de tgtype leem o resto do CATÁLOGO, sem texto.
SELECT 119, 'CRÍTICO: o soltador é AFTER UPDATE OF status em public.chamados — BEFORE faria o espelho ler o status ANTIGO, passar no gate e escrever na PRÓPRIA linha (09000)',
 (SELECT ((t.tgtype & 1) <> 0        -- FOR EACH ROW
      AND (t.tgtype & 2)  =  0        -- AFTER, não BEFORE
      AND (t.tgtype & 16) <> 0        -- UPDATE
      AND (t.tgtype & 4)  =  0        -- não INSERT
      AND (t.tgtype & 8)  =  0        -- não DELETE
      AND pg_get_triggerdef(t.oid) LIKE '%UPDATE OF status ON %')::text
    FROM pg_trigger t WHERE t.tgrelid='public.chamados'::regclass
     AND t.tgname='trg_chamado_agenda_solta' AND NOT t.tgisinternal), 'true'
UNION ALL
SELECT 120, 'CRÍTICO: a ORDEM dos AFTER de linha de public.chamados, do CATÁLOGO. Ela é indiferente (os conjuntos escritos são disjuntos), e esta linha existe para que deixar de ser indiferente APAREÇA',
 (SELECT string_agg(t.tgname, ' < ' ORDER BY t.tgname) FROM pg_trigger t
   WHERE t.tgrelid='public.chamados'::regclass AND NOT t.tgisinternal
     AND (t.tgtype & 1) <> 0 AND (t.tgtype & 2) = 0 AND (t.tgtype & 16) <> 0),
 'trg_chamado_agenda_solta < trg_chamado_apoio_dupla_upd < trg_chamado_evento_upd < trg_chamado_ficha_compra_upd < trg_chamado_sincronizar_unidades < trg_notify_chamado_upd'
UNION ALL
-- DOIS TERMOS, E O SEGUNDO É A LIÇÃO DA RODADA. A versão anterior desta linha
-- media só o primeiro — "o texto da função não escreve cumprido_em nem dia" — e
-- era CEGA a uma escrita que não está no TEXTO e sim no NOME que a função CHAMA.
-- Foi assim que um `PERFORM agenda_campo_espelhar(...)` entrou no soltador e o
-- fez congelar, apagar linha de apoio e tocar sino pela cascata, com esta
-- conferência dizendo 'ok'. O segundo termo fecha isso pela forma: o soltador
-- não DELEGA escrita a ninguém — ele não tem um PERFORM.
SELECT 121, 'CRÍTICO: o SOLTADOR não escreve cumprido_em nem dia, E NÃO CHAMA NINGUÉM que escreva por ele — é isso que o dispensa de evidência, de gate e de congelamento, e é a costura inteira deste desenho',
 ((SELECT (p.prosrc !~ 'cumprido_em\s*=' AND p.prosrc !~ '\mdia\s*=')::int
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='chamado_solta_agenda')
+ (SELECT (p.prosrc !~ E'(^|\n)[ \t]*PERFORM')::int
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='chamado_solta_agenda'))::text, '2'
UNION ALL
-- TRÊS TERMOS, E O TERCEIRO EXISTE PORQUE O PRIMEIRO É QUASE TAUTOLOGIA:
-- `current_date` é uma expressão que esta função nunca usaria (ela calcula
-- v_hoje com now() AT TIME ZONE), então medir a ausência dela não prova muito.
-- O terceiro mede a FORMA REAL que uma guarda de data teria neste corpo: uma
-- comparação de ORDEM entre o dia de um bloco e o relógio. Se alguém escrever
-- `AND a.dia > v_hoje` para "não deixar carimbar antes", esta linha acusa.
SELECT 122, 'CRÍTICO: a porta NÃO recusa carimbo por data (Davi, 04/09) — o dia do próprio bloco é sempre aceito, e HOJE também. A única recusa é uma TERCEIRA data, que a tela não sabe produzir e que só chega por REST: ela escolheria uma semana ISO qualquer, e a turma daquela semana nasceria congelada (acesso permanente, R108)',
 ((SELECT (position('current_date' in pg_get_functiondef(p.oid))=0)::int
     FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='agenda_campo_afirmar')
+ (SELECT (position('IF r.dia_efetivo IS DISTINCT FROM r.dia_atual' in pg_get_functiondef(p.oid))>0
       AND position('AND r.dia_efetivo IS DISTINCT FROM v_hoje THEN' in pg_get_functiondef(p.oid))>0)::int
     FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='agenda_campo_afirmar')
+ (SELECT (position('a.dia >' in pg_get_functiondef(p.oid))=0
       AND position('a.dia <' in pg_get_functiondef(p.oid))=0
       AND position('dia_efetivo >' in pg_get_functiondef(p.oid))=0
       AND position('dia_efetivo <' in pg_get_functiondef(p.oid))=0)::int
     FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='agenda_campo_afirmar'))::text, '3'
UNION ALL
SELECT 123, 'CRÍTICO: o laço da porta ORDENA por dia EFETIVO, hora e id, e carimba com clock_timestamp(). Sem a ordem, as turmas das semanas do MEIO nunca são gravadas; com now(), as idas colapsam em uma',
 (SELECT ((position('ORDER BY COALESCE(f.dia, a.dia), a.inicio_min, a.id' in pg_get_functiondef(p.oid))>0)
       AND (position('clock_timestamp()' in pg_get_functiondef(p.oid))>0))::text
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='agenda_campo_afirmar'), 'true'
UNION ALL
SELECT 124, 'CRÍTICO: as CINCO funções vizinhas saem daqui com as marcas da U78/U81 intactas — esta migration não reescreve NENHUMA delas',
 ((SELECT (position('a.congelado_em IS NULL' in pg_get_functiondef(p.oid))>0)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='chamado_sincronizar_apoio')
+ (SELECT (position('SET congelado_em = NEW.cumprido_em' in pg_get_functiondef(p.oid))>0)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='apoio_congelar_da_visita')
+ (SELECT (position($q$c.status NOT IN ('concluido','cancelado')$q$ in pg_get_functiondef(p.oid))>0)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='agenda_campo_espelhar')
+ (SELECT (position('COALESCE(cumprido_em, now())' in pg_get_functiondef(p.oid))>0)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='agenda_campo_cumprir')
+ (SELECT (position('desmarcá-lo apagaria o registro' in pg_get_functiondef(p.oid))>0)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='agenda_campo_cancelar'))::text,
 '5'
UNION ALL
-- AS TRÊS LINHAS DE DELTA ZERO — E ELAS DEIXARAM DE SER 'referência'.
-- Enquanto esta migration tinha CARGA, 125/126 eram números que ninguém sabia
-- prever e só cabia olhar. Sem a carga, esta migration não escreve UMA LINHA DE
-- DADO: ela cria duas funções e um gatilho. Logo o esperado é conhecido e vale
-- CRÍTICO — e qualquer número diferente de zero significa que algo aqui escreveu
-- sem ninguém ter escrito, que é a definição de efeito colateral.
SELECT 125, 'CRÍTICO: esta migration NÃO AFIRMA e NÃO DESMARCA nada — a carga retroativa foi cortada e virou entrega separada (os números que a dimensionam estão em supabase/migrations/_medir_antes_da_carga_u82.sql). Qualquer coisa diferente de 0 / 0 é escrita que ninguém pediu',
 ((SELECT count(*) FROM public.agenda_campo WHERE cumprido_em IS NOT NULL) - (SELECT cumpridos_antes FROM u82_foto))::text || ' / ' ||
 ((SELECT count(*) FROM public.agenda_campo WHERE cancelado_em IS NOT NULL) - (SELECT cancelados_antes FROM u82_foto))::text, '0 / 0'
UNION ALL
SELECT 126, 'CRÍTICO: esta migration NÃO CONGELA nenhuma linha de apoio. Congelar é irreversível e concede acesso permanente de edição ao chamado, ao cliente, às fotos e ao pedido de compra (R108) — é a única escrita desta entrega que não se desfaz, e por isso ela só pode nascer de mão humana pela porta, DEPOIS, nunca da migration',
 ((SELECT count(*) FROM public.chamado_apoios WHERE congelado_em IS NOT NULL) - (SELECT congelados_antes FROM u82_foto))::text, '0'
UNION ALL
SELECT 127, 'referência: blocos PRESOS — cumpridos num dia POSTERIOR ao carimbo. Imóveis (o EXCLUDE é WHERE cancelado_em IS NULL, sem cumprido_em), não desmarcáveis, ocupando a janela futura da equipe para sempre, e com a turma congelada possivelmente da semana ERRADA. É a dívida P36/P37 e ESTA MIGRATION NÃO A TOCA: destravá-los era a terceira passada da carga cortada. O mesmo número está na linha 3 de _medir_antes_da_carga_u82.sql',
 (SELECT count(*)::text FROM public.agenda_campo a
   WHERE a.cumprido_em IS NOT NULL AND a.cancelado_em IS NULL
     AND a.dia > (a.cumprido_em AT TIME ZONE 'America/Sao_Paulo')::date), '(referência)'
UNION ALL
SELECT 128, 'CRÍTICO: os dois gatilhos da cascata do apoio estão LIGADOS. Esta migration NÃO DESLIGA gatilho nenhum — o ALTER TABLE ... DISABLE TRIGGER foi recusado por escrito (cicatriz da U59/U61, e escalada de lock sobre a tabela mais quente do sistema). Esta linha é o censo que pega o DISABLE esquecido por QUALQUER carga, desta ou de outra',
 ((SELECT (t.tgenabled = 'O')::int FROM pg_trigger t
    WHERE t.tgrelid='public.chamado_apoios'::regclass AND t.tgname='trg_notify_chamado_apoio')
+ (SELECT (t.tgenabled = 'O')::int FROM pg_trigger t
    WHERE t.tgrelid='public.chamados'::regclass      AND t.tgname='trg_chamado_apoio_dupla_upd'))::text, '2'
UNION ALL
SELECT 129, 'CRÍTICO: nenhum sino nasceu nesta migration',
 ((SELECT count(*) FROM public.notificacoes) - (SELECT sinos_antes FROM u82_foto))::text, '0'
UNION ALL
SELECT 130, 'referência: a 110/117, PARTIDA — chamado ABERTO (fila de trabalho, e nenhum encerramento a alcança) / chamado ENCERRADO (a pergunta não foi respondida; é ESTE que o chip tem de drenar). Se o segundo NÃO cair em 3 semanas, o desenho falhou e o gatilho que AFIRMA volta à mesa',
 (SELECT count(*) FILTER (WHERE c.status NOT IN ('concluido','cancelado'))::text || ' aberto / '
       || count(*) FILTER (WHERE c.status IN ('concluido','cancelado'))::text || ' ENCERRADO'
    FROM public.agenda_campo a JOIN public.chamados c ON c.id = a.chamado_id
   WHERE a.cancelado_em IS NULL AND a.cumprido_em IS NULL AND a.dia < (current_date - 7)), '(referência)'
UNION ALL
SELECT 131, 'referência: no BANCO INTEIRO, quantos chamados com apoio congelado sobre escala HERDADA — o P26 outra vez. É a gêmea EXATA da conferência 116 da U81 (não é um recorte desta execução): se o número não mudou desde a U81, esta migration não piorou o P26',
 (SELECT count(DISTINCT ap.chamado_id)::text FROM public.chamado_apoios ap
    JOIN public.chamados c ON c.id=ap.chamado_id
   WHERE ap.origem='dupla' AND ap.congelado_em IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.escala_da_semana(public.referencia_semanal(
                   public.dia_da_dupla(c.data_hora_agendada, c.created_at))) e WHERE e.herdada)),
 '(referência)'
UNION ALL
SELECT 132, 'referência: chamados com visita AFIRMADA e NENHUMA linha de apoio congelada — é a medida de "afirmou e NÃO congelou", o furo que a terceira metade da trava (§2) existe para fechar. Ele NÃO cai a zero HOJE: é o passivo que a U81 herdou, e esta migration não escreve nada. O que ele mede é a TENDÊNCIA — se ele SUBIR depois que a porta nova entrar em uso, ou a trava não está fechando, ou o espelho repousou numa semana sem turma (o resíduo declarado no P41), e é este número que avisa',
 (SELECT count(*)::text FROM public.chamados c
   WHERE c.natureza='campo'
     AND EXISTS (SELECT 1 FROM public.agenda_campo a
                  WHERE a.chamado_id=c.id AND a.cancelado_em IS NULL AND a.cumprido_em IS NOT NULL)
     AND EXISTS (SELECT 1 FROM public.chamado_apoios ap
                  WHERE ap.chamado_id=c.id AND ap.origem='dupla')
     AND NOT EXISTS (SELECT 1 FROM public.chamado_apoios ap
                      WHERE ap.chamado_id=c.id AND ap.origem='dupla' AND ap.congelado_em IS NOT NULL)),
 '(referência)'
UNION ALL
-- CONTAGEM NÃO É IDENTIDADE, E ISSO ESTÁ DITO AQUI DE PROPÓSITO.
-- chamado_sincronizar_apoio não APAGA, ele TROCA (DELETE por v_alvo seguido de
-- INSERT de unnest(v_alvo), no mesmo corpo, u81:417-471). Turma é par: duas
-- saem, duas entram, e um delta de CONTAGEM dá ZERO. Enquanto esta migration
-- tinha carga, isto tornava esta linha CEGA ao caso que ela nomeia. Sem a carga
-- não há caminho nenhum daqui até chamado_apoios — nem UPDATE, nem cascata, nem
-- gatilho desligado — e o delta zero volta a ser prova suficiente. QUANDO A
-- CARGA VOLTAR, ESTA LINHA TEM DE VOLTAR MEDINDO IDENTIDADE (chamado_id,
-- profile_id) contra uma foto TEMP, e não contagem.
SELECT 133, 'CRÍTICO: esta migration não toca em public.chamado_apoios por caminho nenhum — não há UPDATE, não há carga, e nada aqui move chamados.data_hora_agendada para acordar a cascata do apoio. Negativo aqui seria registro de quem esteve no prédio, apagado, sem sino, sem evento e sem DESFAZER: é ROLLBACK antes do COMMIT, não conversa',
 ((SELECT count(*) FROM public.chamado_apoios) - (SELECT apoios_antes FROM u82_foto))::text
   || ' total / '
   || ((SELECT count(*) FROM public.chamado_apoios WHERE origem='dupla') - (SELECT dupla_antes FROM u82_foto))::text
   || ' dupla', '0 total / 0 dupla'

) t ORDER BY t.ordem;

COMMIT;

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ DESFAZER — freio de emergência, não rollback de rotina               ║
-- ╚══════════════════════════════════════════════════════════════════════╝
-- ESTE RODAPÉ FICOU CURTO, E ISSO É CONSEQUÊNCIA DO CORTE. Sem a carga, esta
-- migration não escreve UMA LINHA DE DADO: desfazê-la é dropar o que ela criou.
-- Não há `<INSTANTE>` a caçar, não há carimbo a apagar, não há desmarcação a
-- ressuscitar — e não há o risco que a versão anterior deste rodapé tinha, de
-- estourar o EXCLUDE ao ressuscitar em bloco tudo o que a carga desmarcou.
--
-- O QUE VOLTA JUNTO: encerrar um chamado volta a deixar plano futuro ocupando
-- a grade para sempre, e a afirmação volta a depender de UM clique opcional.
-- O APP NÃO QUEBRA JUNTO, e isso foi construído: useAfirmarVisitas trata
-- PGRST202/42883 como "a porta não existe" e SEGUE COM O ENCERRAMENTO, dizendo
-- uma frase; e qualquer outra falha (rede, 503, timeout) degrada do mesmo jeito,
-- por `portaMuda`. Só os TRÊS códigos que a porta fala (42501, 55000, 23P01)
-- derrubam o gesto. Se alguém trocar aquele tratamento por um `throw` geral,
-- este DESFAZER passa a derrubar o encerramento de todo chamado de campo.
--
-- O QUE ESTE RODAPÉ NÃO ALCANÇA, E NUNCA VAI: o congelamento que a PORTA faz em
-- tempo de execução (a terceira metade da trava, no §2), depois que
-- gente começar a usá-la. Ele tem o instante de cada carimbo, é ato humano e é
-- irreversível por desenho — a saída continua sendo o X do chip de apoio (R108).
-- Do mesmo modo, `cumprido_em` gravado pela porta NÃO é desfeito aqui:
-- desafirmar não desacontece (U81), e apagar carimbo é apagar registro.
-- BEGIN;
--   DROP TRIGGER IF EXISTS trg_chamado_agenda_solta ON public.chamados;
--   DROP FUNCTION IF EXISTS public.chamado_solta_agenda();
--   DROP FUNCTION IF EXISTS public.agenda_campo_afirmar(uuid,jsonb,uuid[]);
-- COMMIT;
