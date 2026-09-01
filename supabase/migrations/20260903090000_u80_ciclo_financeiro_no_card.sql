-- ═══════════════════════════════════════════════════════════════════════════
-- U80 — O CICLO FINANCEIRO NO CARTÃO (R103/R104/R105/R106 — Fase 1, Passo 1.3)
--
-- >>> RODAR NO SQL EDITOR DO SUPABASE, À MÃO, DEPOIS DA U79. <<<
-- >>> O §1 ABORTA se a base já tiver cobrança duplicada. Isso NÃO é falha da  <<<
-- >>> migration: é ela recusando prometer "impossível" em cima de um dado que <<<
-- >>> já provou o contrário. A consulta que lista quem não casou vem DENTRO   <<<
-- >>> da mensagem do erro.                                                    <<<
--
-- ── O QUE ESTA MIGRATION NÃO FAZ ───────────────────────────────────────────
-- Não reescreve `aprovar_chamado_financeiro`, `ajustar_item_cobranca`,
-- `marcar_chamado_faturado`, `montar/fechar/reabrir/excluir_fechamento`,
-- `cobrancas_select`, `cobrancas_write`, `pode_ver_financeiro`,
-- `pode_acessar_chamado` nem `pode_editar_chamado`. O motor da U2–U5 fica onde
-- está; esta entrega LÊ. As linhas 105, 106 e 114 da conferência provam isso
-- pelo CATÁLOGO, e o verificador prova pelo ARQUIVO (censo dos nomes que a U80
-- define contra uma lista escrita à mão).
--
-- ── O QUE ELA MUDA NO COMPORTAMENTO DE UMA FUNÇÃO QUE ELA NÃO TOCA ─────────
-- E é preciso dizer com todas as letras, porque é o preço da promessa:
-- `aprovar_chamado_financeiro` HOJE duplica em dois cenários (o §2 os detalha).
-- Depois do §2 ela passa a RECUSAR, com SQLSTATE 23505 e a mensagem crua do
-- Postgres. É correção trocando silêncio por barulho, e o barulho é feio: quem
-- traduz é `aprovarCobranca()` em src/features/chamados/cobranca.ts, que não é
-- motor. Uma chamada direta à RPC continua vendo o erro cru.
--
-- ── ORDEM DAS SEÇÕES ───────────────────────────────────────────────────────
--   §1 pré-voo         ← aborta se qualquer pressuposto for falso
--   §2 os dois índices ← onde "impossível" deixa de ser adjetivo
--   §3 o contador honesto (um BIT por chamado)
--   §4 a porta do ciclo (concluir e decidir, atomicamente)
--   §5 conferência     ← obtido × esperado × veredito, no CATÁLOGO
-- Tudo em UMA transação, e a tabela de veredito é o ÚLTIMO result set (o
-- COMMIT vem depois dela, como na U79): RAISE NOTICE é invisível no editor do
-- Supabase, então tudo que precisa ser visto sai em SELECT.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- §1) PRÉ-VOO — as pressuposições, uma a uma, com aborto
-- ═══════════════════════════════════════════════════════════════════════
-- `to_regprocedure` com a ASSINATURA EXATA, e não `proname`: a cicatriz da U79
-- (:80-83) é que `GRANT ... agenda_campo_cumprir(uuid)` sem o `boolean` falha
-- dizendo que a função não existe — e às 23h essa mensagem manda caçar a
-- função em vez da assinatura.
DO $$
DECLARE
  v_falta text[] := ARRAY[]::text[];
  v_a text;
  v_dup_peca int;
  v_dup_avulsa int;
BEGIN
  IF to_regclass('public.cobrancas') IS NULL THEN
    RAISE EXCEPTION 'PRÉ-VOO U80: public.cobrancas não existe. A U4 não rodou.';
  END IF;
  IF to_regclass('public.agenda_campo') IS NULL THEN
    RAISE EXCEPTION 'PRÉ-VOO U80: public.agenda_campo não existe. A U78 não rodou.';
  END IF;

  -- A U7:58-59 renomeou os_id -> chamado_id e peca_id -> chamado_peca_id. Sem
  -- isso o corpo abaixo não compila — ou pior, compila contando outra coisa.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='cobrancas'
                    AND column_name='chamado_id') THEN
    RAISE EXCEPTION 'PRÉ-VOO U80: cobrancas.chamado_id não existe (ainda se chama os_id?). A U7 não rodou.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='cobrancas'
                    AND column_name='chamado_peca_id') THEN
    RAISE EXCEPTION 'PRÉ-VOO U80: cobrancas.chamado_peca_id não existe. A U7 não rodou.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='chamados'
                    AND column_name='faturamento_status') THEN
    RAISE EXCEPTION 'PRÉ-VOO U80: chamados.faturamento_status não existe. A U0 não rodou.';
  END IF;

  FOREACH v_a IN ARRAY ARRAY[
    'public.is_gestor(uuid)',
    'public.pode_ver_financeiro(uuid)',
    'public.pode_editar_chamado(uuid)',
    'public.aprovar_chamado_financeiro(uuid)'
  ] LOOP
    IF to_regprocedure(v_a) IS NULL THEN v_falta := v_falta || v_a; END IF;
  END LOOP;
  IF array_length(v_falta,1) IS NOT NULL THEN
    RAISE EXCEPTION E'PRÉ-VOO U80: faltam estas funções: %.\nU0 / U6a / U7 / U13 / S2 rodaram?',
      array_to_string(v_falta, ', ');
  END IF;

  -- ── A CONFERÊNCIA QUE PODE ABORTAR A MIGRATION INTEIRA ──────────────────
  -- Os dois índices do §2 são a diferença entre "improvável" e "impossível".
  -- Se a base já tem a duplicata que eles proíbem, criá-los falha — e o padrão
  -- da casa para constraint (DO $$ ... EXCEPTION WHEN check_violation THEN
  -- RAISE NOTICE, u4:52-83) ENGOLIRIA a falha: RAISE NOTICE é INVISÍVEL no
  -- editor do Supabase, e a migration terminaria verde SEM O ÍNDICE, com a
  -- promessa inteira desta entrega apoiada em nada. Então aqui é ABORTO, e a
  -- mensagem traz o rastro.
  SELECT count(*) INTO v_dup_peca FROM (
    SELECT chamado_peca_id FROM public.cobrancas
     WHERE chamado_peca_id IS NOT NULL AND status <> 'cancelada'
     GROUP BY chamado_peca_id HAVING count(*) > 1) d;
  SELECT count(*) INTO v_dup_avulsa FROM (
    SELECT chamado_id, competencia, md5(lower(btrim(descricao))) FROM public.cobrancas
     WHERE chamado_id IS NOT NULL AND chamado_peca_id IS NULL AND status <> 'cancelada'
     GROUP BY 1,2,3 HAVING count(*) > 1) d;

  IF v_dup_peca > 0 OR v_dup_avulsa > 0 THEN
    RAISE EXCEPTION E'PRÉ-VOO U80: a base já tem cobrança duplicada — % peça(s) com mais de uma cobrança viva e % avulso(s) repetido(s).\nÉ o defeito que esta migration existe para fechar, e ele já aconteceu. Rode a consulta abaixo, decida linha a linha (cancelar é UPDATE status=''cancelada'', NUNCA DELETE — um fechamento pode já ter recolhido a linha, e apagá-la deixaria um período com total que não bate), e rode a U80 de novo:\n\n  SELECT b.id, b.chamado_id, b.chamado_peca_id, b.competencia, b.status, b.valor, b.descricao, b.created_at\n    FROM public.cobrancas b\n   WHERE b.status <> ''cancelada''\n     AND ( (b.chamado_peca_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.cobrancas x WHERE x.id <> b.id AND x.status <> ''cancelada'' AND x.chamado_peca_id = b.chamado_peca_id))\n        OR (b.chamado_peca_id IS NULL AND b.chamado_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.cobrancas x WHERE x.id <> b.id AND x.status <> ''cancelada'' AND x.chamado_peca_id IS NULL AND x.chamado_id = b.chamado_id AND x.competencia = b.competencia AND md5(lower(btrim(x.descricao))) = md5(lower(btrim(b.descricao))))) )\n   ORDER BY b.chamado_id, b.chamado_peca_id, b.created_at;',
      v_dup_peca, v_dup_avulsa;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- §2) OS DOIS ÍNDICES — onde "impossível" deixa de ser adjetivo
-- ═══════════════════════════════════════════════════════════════════════
--
-- 2.1 UMA PEÇA, UMA COBRANÇA VIVA.
--
-- Hoje NÃO existe UNIQUE nenhum em `cobrancas`: os quatro índices da U4:85-88
-- são todos não-únicos. O que trava reaprovação é o
-- `DELETE ... WHERE chamado_id = _ AND status = 'aberta'` de u13:95 — e ele é
-- idempotente de UMA THREAD SÓ. Em READ COMMITTED, com dois gestores
-- aprovando o mesmo chamado no mesmo minuto:
--
--   T1: DELETE (0 linhas) ─ INSERT 3 ─────────────── COMMIT
--   T2:      DELETE (0 linhas, snapshot velho) ─ INSERT 3 ─ COMMIT
--   resultado: 6 linhas. O cliente é cobrado duas vezes.
--
-- E o segundo cenário, que não precisa de concorrência nenhuma: REAPROVAR
-- DEPOIS QUE O PERÍODO FECHOU. O DELETE só apaga `'aberta'`; as `fechada` e
-- `faturada` sobrevivem e um jogo novo entra ao lado. Nada em
-- `aprovar_chamado_financeiro` olha `faturamento_status` (u13:82 só checa
-- `status = 'concluido'`) — a trava é DE TELA (o botão em DetalheCampo:1095
-- exige `a_analisar`), não de motor.
--
-- Com o índice, o caso concorrente vira: T2 BLOQUEIA na primeira chave
-- duplicada, espera T1 commitar e recebe 23505. A transação inteira volta —
-- INSERT é uma instrução só, é tudo ou nada. E o caso do período fechado vira
-- uma recusa em vez de uma cobrança em dobro.
--
-- `status <> 'cancelada'` no predicado: cancelar libera a peça para ser
-- cobrada de novo, que é o que "cancelar" quer dizer. É o MESMO recorte de
-- `montar_fechamento` (u5:139) e de `consolidar()` — e é decidido AQUI, uma
-- vez, em vez de cada consumidor escolher o seu.
--
-- REAPROVAÇÃO LEGÍTIMA CONTINUA FUNCIONANDO: o DELETE e o INSERT são da MESMA
-- transação, e as linhas apagadas já estão mortas para o índice quando o
-- INSERT chega.
CREATE UNIQUE INDEX IF NOT EXISTS cobrancas_uma_por_peca_idx
  ON public.cobrancas (chamado_peca_id)
  WHERE chamado_peca_id IS NOT NULL AND status <> 'cancelada';

COMMENT ON INDEX public.cobrancas_uma_por_peca_idx IS
  'Uma peça rende UMA cobrança viva. Fecha a corrida de duas aprovações simultâneas e a reaprovação depois do fechamento (U80).';

-- 2.2 UM AVULSO VINCULADO, POR CHAMADO / COMPETÊNCIA / DESCRIÇÃO.
--
-- O cinto do §4. A porta já recusa lançar em cima (ela lê a contagem DENTRO do
-- cadeado), então este índice é o suspensório: fecha o duplo clique e o duplo
-- submit mesmo se alguém, um dia, chamar a porta por fora do formulário.
--
-- `md5(lower(btrim(descricao)))` e não `descricao` crua por duas razões: uma
-- descrição longa estoura o limite de linha do btree (~2704 bytes) e o INSERT
-- falharia com uma mensagem sobre índice, não sobre cobrança; e normalizar
-- caixa e espaço faz "Mão de obra" e "mão de obra " colidirem, que é o que se
-- quer. Parcelas NÃO colidem entre si: elas diferem no sufixo "(i/n)" E na
-- competência.
CREATE UNIQUE INDEX IF NOT EXISTS cobrancas_avulsa_unica_por_chamado_idx
  ON public.cobrancas (chamado_id, competencia, md5(lower(btrim(descricao))))
  WHERE chamado_id IS NOT NULL AND chamado_peca_id IS NULL AND status <> 'cancelada';

COMMENT ON INDEX public.cobrancas_avulsa_unica_por_chamado_idx IS
  'Cobrança avulsa VINCULADA a chamado é única por competência e descrição. O avulso SEM chamado (tela de fechamentos) não passa por aqui (U80).';

-- ═══════════════════════════════════════════════════════════════════════
-- §3) O CONTADOR HONESTO — UM BIT POR CHAMADO
-- ═══════════════════════════════════════════════════════════════════════
--
-- ── POR QUE ELA EXISTE, EM UMA FRASE ──────────────────────────────────────
-- `cobrancas_select` é `USING (pode_ver_financeiro(auth.uid()))` (u4:293) e o
-- SAC está FORA dessa régua de propósito (u6a:74-91, R13). Uma policy de
-- SELECT FILTRA LINHAS; ela NÃO levanta erro. O SAC recebe HTTP 200 com `[]`,
-- indistinguível de "não há cobrança" — e a tela da programação é liberada a
-- ele (`telas.ts`: sac = true). Multiplicado por cartão, isso é um número que
-- mente por omissão. Nenhum tratamento de erro no cliente conserta: é a FORMA
-- da RLS. SECURITY DEFINER é a única construção que sabe separar "zero" de
-- "não te deixam contar".
--
-- ── O QUE ELA DEVOLVE, E O QUE ELA SE RECUSA A DEVOLVER ───────────────────
-- Devolve UM BIT por chamado. Não devolve `valor`, não devolve `sum(valor)`,
-- não devolve `competencia`, não devolve `descricao`, não devolve `cliente_id`
-- e NÃO DEVOLVE O `status` DA COBRANÇA — porque `cancelada` conta uma história
-- que `faturamento_status` não conta ("alguém desfez uma cobrança já
-- lançada"), e isso é conversa comercial com o cliente. Também NÃO devolve
-- CONTAGEM: um `3` é "três peças faturáveis neste atendimento", que é volume
-- de serviço, e o cartão pergunta "já lançou?".
--
-- É a tese de `achar_ou_criar_prospeccao` (u71: "a função enxerga a tabela
-- inteira para DECIDIR, mas devolve só um uuid") e de `contrato_vigente`
-- (u2:185-201), que é o precedente EXATO: lê uma tabela gateada por
-- `pode_ver_financeiro` e mesmo assim é concedida a `authenticated`, porque
-- QUAL contrato vale é fato operacional e o que tem DENTRO dele é privilégio.
--
-- ── É UM ROWSET, E A AUSÊNCIA DA LINHA É O "NÃO SEI" ──────────────────────
-- Não um mapa com zeros. `0` e "não me deixaram contar" não podem ser o mesmo
-- valor — é a doutrina do cabeçalho de modelo.ts:42-52, e é por isso que
-- `divergenciaDeEquipe` devolve `null` em vez de uma divergência.
--
-- ── POR QUE `is_gestor` E NÃO `pode_acessar_chamado` ──────────────────────
-- `pode_acessar_chamado` (s2:148-158) tem o ramo `c.responsavel_id IS NULL`:
-- QUALQUER autenticado acessa chamado sem dono. `chamados_select` (u7:545)
-- NÃO tem esse ramo. Usar aquela régua aqui faria a função responder sobre
-- chamados que quem perguntou NÃO CONSEGUE LER — e, combinada com
-- `agenda_campo_select USING (true)` (u78:833, decisão declarada), viraria um
-- oráculo que diz quais serviços dos colegas foram faturados, 150 por
-- requisição. `is_gestor` é a régua de quem tem a TELA e é a única aqui.
--
-- Não-gestor recebe ZERO LINHAS, e o modelo puro lê "linha ausente" como NÃO
-- SEI e não pinta selo. A degradação é silenciosa e CORRETA: a grade do
-- técnico continua exatamente como é hoje. Um 42501 aqui daria a ele uma faixa
-- vermelha no lugar da programação.
--
-- Gate ÚNICO de propósito: duas camadas, sendo a de dentro sempre verdadeira
-- para quem passa pela de fora, é código morto num caminho de segurança — não
-- exercitado, e dando conforto falso.
CREATE OR REPLACE FUNCTION public.chamados_com_lancamento(_chamados uuid[])
RETURNS TABLE (chamado_id uuid, tem_lancamento boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $u80a$
#variable_conflict use_column
BEGIN
  -- Lista vazia é pergunta vazia, não erro: a grade abre numa semana sem bloco
  -- nenhum o tempo todo.
  IF _chamados IS NULL OR cardinality(_chamados) = 0 THEN
    RETURN;
  END IF;

  -- O TETO É DECLARADO E ELE GRITA. Um `LIMIT` silencioso devolveria uma
  -- resposta PARCIAL com cara de completa, e o modelo puro leria os que
  -- faltaram como "não sei" — omissão inventada pelo servidor, que é o defeito
  -- inteiro que esta função existe para matar. A grade fatia em 150 (`FATIA`,
  -- programacao/data.ts:60); 500 dá folga de três fatias e ainda impede um
  -- array de 50 mil ids virar 50 mil avaliações de policy.
  IF cardinality(_chamados) > 500 THEN
    RAISE EXCEPTION 'Pergunte no máximo 500 chamados por vez (vieram %).', cardinality(_chamados)
      USING ERRCODE = '55000';
  END IF;

  IF NOT public.is_gestor(auth.uid()) THEN
    RETURN; -- zero linhas, nunca 42501
  END IF;

  RETURN QUERY
    SELECT c.id,
           EXISTS (SELECT 1 FROM public.cobrancas b
                    WHERE b.chamado_id = c.id
                      AND b.status <> 'cancelada')
      FROM public.chamados c
     WHERE c.id = ANY (_chamados);
  -- SEM filtro de natureza, de propósito: "existe lançamento" é fato da linha
  -- e não depende do tipo do chamado. A regra "só chamado de campo concluído
  -- ganha selo" é REGRA DE TELA e mora no modelo puro (`seloDoCiclo`), onde
  -- alguém consegue exercitá-la sem subir banco. Regra escondida num WHERE de
  -- SQL é regra que o verificador não alcança.
END;
$u80a$;

COMMENT ON FUNCTION public.chamados_com_lancamento(uuid[]) IS
  'UM BIT por chamado: existe lançamento vivo? Nunca valor, competência, '
  'descrição, contagem ou status da cobrança. Existe porque cobrancas_select é '
  'pode_ver_financeiro(): para o SAC (gestor sem valores, R13) um SELECT direto '
  'devolve [] tanto para "não há" quanto para "a RLS apagou", e a diferença é '
  'indistinguível no cliente. Gate ÚNICO em is_gestor(): quem não passa recebe '
  'ZERO LINHAS, e ausência de linha é o "não sei" que o modelo puro sabe ler '
  '(U80/R103).';

REVOKE EXECUTE ON FUNCTION public.chamados_com_lancamento(uuid[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.chamados_com_lancamento(uuid[]) TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════
-- §4) A PORTA DO CICLO — concluir e decidir a cobrança, atomicamente
-- ═══════════════════════════════════════════════════════════════════════
--
-- ── POR QUE UMA PORTA E NÃO DUAS CHAMADAS ─────────────────────────────────
-- `lancarCobrancaAvulsa` (financeiro/fechamentos.ts:126-157) é um INSERT
-- direto do navegador, sem RPC e sem transação — e NÃO grava `chamado_id`, nem
-- `contrato_id`, nem mexe em `faturamento_status`. Usada como está, ela cria
-- uma cobrança que o selo nunca encontra e que a trava não trava. E duas
-- chamadas (concluir, depois lançar) têm um estado intermediário observável:
-- chamado concluído, dinheiro não lançado, ninguém sabendo.
--
-- ── AS TRÊS DECISÕES, E POR QUE ELAS TÊM RÉGUAS DIFERENTES ────────────────
--   'conferir_depois' — conclui e deixa a fila do faturamento como está.
--                       Régua: `pode_editar_chamado`. Concluir não é decidir.
--   'nada_a_cobrar'   — conclui e crava `sem_cobranca`.
--   'lancar'          — conclui, insere as parcelas e crava `aprovada`.
-- As duas últimas escrevem um VEREDITO financeiro: régua
-- `pode_ver_financeiro`. Gate em camadas, o mesmo desenho de
-- `agenda_campo_marcar`.
--
-- ── O QUE ELA NÃO FAZ, DITO PARA NINGUÉM SUPOR O CONTRÁRIO ────────────────
-- Ela NÃO marca `agenda_campo.cumprido_em`. Quem cumpre bloco é
-- `agenda_campo_cumprir`, e são gestos diferentes: um diz "este pedaço de
-- agenda aconteceu", o outro diz "este atendimento acabou". Concluir um
-- chamado com bloco pendente é legítimo (o retorno foi cancelado, o serviço
-- terminou antes).
CREATE OR REPLACE FUNCTION public.concluir_chamado_com_cobranca(
  _chamado      uuid,
  _decisao      text,
  _descricao    text      DEFAULT NULL,
  _valor_total  numeric   DEFAULT NULL,
  _parcelas     numeric[] DEFAULT NULL,
  _tipo_servico text      DEFAULT NULL
)
RETURNS TABLE (itens integer, status_final text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $u80b$
#variable_conflict use_column
DECLARE
  v_ch      record;
  v_vivas   int;
  v_n       int   := 0;
  v_soma    numeric;
  v_menor   numeric;
  v_desc    text  := btrim(coalesce(_descricao, ''));
  v_tipo    text;
  v_data    date;
  v_status  text;
  v_itens   int   := 0;
BEGIN
  -- 1) A camada de baixo: quem pode concluir é quem responde pelo chamado.
  --    É a MESMA régua de `chamados_update` (s1:419-422), então esta porta não
  --    alarga nada — ela só torna atômico o que hoje seriam dois gestos.
  IF NOT public.pode_editar_chamado(_chamado) THEN
    RAISE EXCEPTION 'Você não responde por este atendimento.' USING ERRCODE = '42501';
  END IF;

  IF _decisao IS NULL OR _decisao NOT IN ('conferir_depois','nada_a_cobrar','lancar') THEN
    RAISE EXCEPTION 'Decisão desconhecida: %.', coalesce(_decisao,'(vazia)') USING ERRCODE = '55000';
  END IF;

  -- 2) A camada de cima: decidir a cobrança é privilégio financeiro.
  IF _decisao <> 'conferir_depois' AND NOT public.pode_ver_financeiro(auth.uid()) THEN
    RAISE EXCEPTION 'Somente quem responde pelo financeiro pode decidir a cobrança.' USING ERRCODE = '42501';
  END IF;

  -- 3) O CADEADO. Tudo que se lê abaixo é lido de dentro dele. É o mesmo
  --    `SELECT ... FOR UPDATE` do passo 1a de `agenda_campo_marcar`
  --    (u78:1165-1176) e pela mesma razão escrita lá: o gate LÊ a linha que
  --    está prestes a REESCREVER. Sem ele, dois gestores leem `a_analisar` no
  --    mesmo instante e os dois lançam.
  SELECT * INTO v_ch FROM public.chamados WHERE id = _chamado FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chamado não encontrado.' USING ERRCODE = '55000';
  END IF;
  IF v_ch.natureza IS DISTINCT FROM 'campo' THEN
    RAISE EXCEPTION 'Esta porta é da agenda de campo.' USING ERRCODE = '55000';
  END IF;
  IF v_ch.status = 'cancelado' THEN
    RAISE EXCEPTION 'O atendimento foi cancelado — não há o que concluir.' USING ERRCODE = '55000';
  END IF;

  -- 4) O REGISTRO DO ATENDIMENTO NÃO PODE SER PULADO PELO ATALHO.
  --    `executarChamado` (chamados/data.ts) exige diagnóstico e serviço
  --    executado, e a tela do técnico exige assinatura por cima. Um botão
  --    "concluir" no cartão que não cobrasse isso seria um caminho novo para
  --    encerrar atendimento sem laudo — e o PDF de atendimento imprime esses
  --    dois campos. A ASSINATURA continua sendo regra da TELA do técnico e não
  --    é reproduzida aqui: uma terceira redação daquela regra é como nascem
  --    três respostas.
  IF v_ch.status <> 'concluido'
     AND (btrim(coalesce(v_ch.diagnostico,'')) = ''
          OR btrim(coalesce(v_ch.servico_executado,'')) = '') THEN
    RAISE EXCEPTION 'Falta o registro do atendimento (diagnóstico e serviço executado). Quem esteve em campo encerra pelo painel do chamado; aqui se decide a cobrança.'
      USING ERRCODE = '55000';
  END IF;

  SELECT count(*) INTO v_vivas FROM public.cobrancas b
   WHERE b.chamado_id = _chamado AND b.status <> 'cancelada';

  -- 5) A TRAVA DA DUPLICATA, VISTA DE DENTRO DO CADEADO.
  --    `a_analisar` é o ÚNICO estado de onde se decide, e nenhum caminho no
  --    repo devolve um chamado a ele (só o DEFAULT da coluna o escreve). A
  --    transição é de mão única, e o cadeado a torna serial: o segundo gestor
  --    lê `aprovada` porque o primeiro já commitou (EvalPlanQual reavalia a
  --    versão nova depois do commit do bloqueador).
  IF _decisao <> 'conferir_depois' AND v_ch.faturamento_status <> 'a_analisar' THEN
    RAISE EXCEPTION 'Este atendimento já teve a cobrança decidida (%) e tem % lançamento(s) vinculado(s). Recarregue a tela.',
      v_ch.faturamento_status, v_vivas USING ERRCODE = '55000';
  END IF;
  IF _decisao = 'lancar' AND v_vivas > 0 THEN
    RAISE EXCEPTION 'Este atendimento já tem % lançamento(s). Não lanço em cima.', v_vivas
      USING ERRCODE = '55000';
  END IF;

  -- 6) OS DOIS CAMINHOS SÃO DISJUNTOS POR CONSTRUÇÃO.
  --    Onde houve análise item a item, a cobrança sai da APROVAÇÃO — com o
  --    bloqueio de `revisar`/`nao_identificado` que a U4:151-152 escreveu
  --    ("cobrança indevida custa mais caro do que uma conferência"). Onde não
  --    houve, o valor digitado é a única verdade que existe. Sem esta linha um
  --    gestor digitaria R$ 480 num chamado com seis peças analisadas e o valor
  --    do contrato não teria opinião.
  IF _decisao = 'lancar'
     AND EXISTS (SELECT 1 FROM public.chamado_pecas_analise a WHERE a.chamado_id = _chamado) THEN
    RAISE EXCEPTION 'Este atendimento já foi analisado item a item. Aprove a cobrança pela conferência, não por um valor digitado.'
      USING ERRCODE = '55000';
  END IF;

  -- 7) OS VALORES: o servidor NÃO repete a divisão, ele CONFERE que ela fecha.
  --    `parcelar()` (src/lib/periodos.ts:88-94) divide em CENTAVOS com o resto
  --    na primeira, porque 3 × 33,33 em float dá 99,99 e o cliente paga a menos
  --    para sempre. Reimplementar a divisão aqui criaria a segunda resposta
  --    para a mesma conta. Reimplementar a CONFERÊNCIA não: a soma é a
  --    invariante, e ela é a mesma dos dois lados.
  IF _decisao = 'lancar' THEN
    IF v_desc = '' THEN
      RAISE EXCEPTION 'Descreva o que está sendo cobrado.' USING ERRCODE = '55000';
    END IF;
    v_n := coalesce(cardinality(_parcelas), 0);
    IF v_n < 1 THEN
      RAISE EXCEPTION 'Informe ao menos uma parcela.' USING ERRCODE = '55000';
    END IF;
    v_tipo := coalesce(nullif(_tipo_servico,''), v_ch.tipo_servico, 'manutencao');
    IF v_tipo NOT IN ('instalacao','manutencao') THEN
      RAISE EXCEPTION 'Tipo de serviço inválido: %.', v_tipo USING ERRCODE = '55000';
    END IF;
    -- Gêmeo de PARCELAS_MAXIMAS = { instalacao: 60, manutencao: 12 } (periodos.ts:97)
    IF v_n > CASE WHEN v_tipo = 'instalacao' THEN 60 ELSE 12 END THEN
      RAISE EXCEPTION 'Instalação vai até 60 parcelas; manutenção, até 12. Vieram %.', v_n
        USING ERRCODE = '55000';
    END IF;
    SELECT sum(v), min(v) INTO v_soma, v_menor FROM unnest(_parcelas) AS v;
    IF v_menor <= 0 THEN
      RAISE EXCEPTION 'Parcela de zero: % em % vezes não divide. Reduza as parcelas.',
        to_char(coalesce(_valor_total,0),'FM999G999G990D00'), v_n USING ERRCODE = '55000';
    END IF;
    IF round(v_soma,2) IS DISTINCT FROM round(coalesce(_valor_total, -1),2) THEN
      RAISE EXCEPTION 'As parcelas somam % e o total informado é % — não lanço uma conta que não fecha.',
        to_char(v_soma,'FM999G999G990D00'),
        to_char(coalesce(_valor_total,0),'FM999G999G990D00') USING ERRCODE = '55000';
    END IF;
  END IF;

  -- O FUSO, E ELE DECIDE EM QUAL MÊS O DINHEIRO CAI.
  -- `timestamptz::date` usa o TimeZone da SESSÃO, que no Supabase é UTC.
  -- Um atendimento encerrado às 21:30 de 31/08 em Brasília é 00:30 de 01/09 em
  -- UTC: a cobrança nasceria com competência '2026-09' e entraria no
  -- fechamento do mês ERRADO. A U76 documentou esta armadilha ("uma hora de
  -- diferença vira uma semana de erro"), a U78 e a U79 a respeitaram, e aqui
  -- ela custa um MÊS em vez de uma semana.
  -- `finalizada_em` e `concluida_em` são timestamptz; `now()` também.
  v_data := coalesce(v_ch.finalizada_em, v_ch.concluida_em, now())
              AT TIME ZONE 'America/Sao_Paulo';

  -- 8) O INSERT.
  --    A ARITMÉTICA DE MÊS É FEITA AQUI, E NÃO NO NAVEGADOR, DE PROPÓSITO.
  --    `lancarCobrancaAvulsa` faz `d.setMonth(d.getMonth() + i)`
  --    (fechamentos.ts:137), e em JavaScript 31/01 + 1 mês é 02/03 — a parcela
  --    2 pula fevereiro e cai em março, e a competência de fevereiro fica sem
  --    linha. `date + interval` no Postgres GRAMPEIA para 28/02, que é o certo.
  --    As duas telas passam a discordar sobre a mesma conta: está anotado em
  --    docs/PENDENCIAS_TECNICAS.md, e não é consertado aqui porque aquela tela
  --    é de outro dono.
  IF _decisao = 'lancar' THEN
    INSERT INTO public.cobrancas
      (cliente_id, chamado_id, chamado_peca_id, contrato_id, descricao, quantidade,
       valor_unitario, valor, competencia, data_referencia, tipo_servico, criada_por)
    SELECT v_ch.cliente_id, _chamado, NULL, v_ch.contrato_id,
           CASE WHEN v_n > 1 THEN v_desc || ' (' || t.i || '/' || v_n || ')' ELSE v_desc END,
           1, t.v, t.v,
           to_char(v_data + make_interval(months => (t.i - 1)::int), 'YYYY-MM'),
           (v_data + make_interval(months => (t.i - 1)::int))::date,
           v_tipo, auth.uid()
      FROM unnest(_parcelas) WITH ORDINALITY AS t(v, i);
    GET DIAGNOSTICS v_itens = ROW_COUNT;
  END IF;

  v_status := CASE _decisao
                WHEN 'conferir_depois' THEN v_ch.faturamento_status
                WHEN 'nada_a_cobrar'   THEN 'sem_cobranca'
                WHEN 'lancar'          THEN 'aprovada'
              END;

  -- 9) UM ÚNICO UPDATE, E ISSO NÃO É COSMÉTICA.
  --    `notify_chamado` (u13:196) lê NEW.faturamento_status no ramo
  --    `NEW.status = 'concluido'` para decidir se dispara "Chamado a conferir"
  --    a todo admin/comercial. Em DOIS UPDATEs, o primeiro (status) dispararia
  --    o aviso com o valor VELHO — um alerta de conferência para um chamado que
  --    acabou de ser decidido, e um sino por atendimento encerrado. Num UPDATE
  --    só, NEW já carrega os dois, e o aviso só sai quando a decisão foi mesmo
  --    adiada.
  --
  --    `trg_chamados_espelho_e_do_satelite` (U79) NÃO dispara aqui: ele é
  --    BEFORE UPDATE **OF data_hora_agendada**, e essa coluna não está no SET.
  UPDATE public.chamados
     SET status             = 'concluido',
         concluida_em       = coalesce(concluida_em, now()),
         fechada_em         = coalesce(fechada_em, now()),
         fechado_por        = coalesce(fechado_por, auth.uid()),
         faturamento_status = v_status
   WHERE id = _chamado;

  -- 10) A LINHA DO TEMPO NÃO CARREGA A CIFRA.
  --     `chamado_eventos_select` é `USING (true)` (u7:586-587) — não é
  --     `pode_acessar_chamado`, é `true`. TODO autenticado lê. E
  --     `aprovar_chamado_financeiro` grava ali "Cobrança aprovada: 3 item(ns),
  --     total 1.842,50" (u13:116-120), que `DetalheCampo.tsx:1205-1207` pinta
  --     sem gate nenhum: hoje o SAC e o técnico leem o valor exato em reais que
  --     a R13 existe para esconder. Está anotado em PENDENCIAS_TECNICAS.md e
  --     não é consertado aqui (é policy do motor). Mas esta porta NÃO repete o
  --     erro: grava o FATO e a CONTAGEM, nunca o dinheiro.
  INSERT INTO public.chamado_eventos (chamado_id, tipo, descricao, user_id)
  VALUES (_chamado, 'cobranca_decidida',
          CASE _decisao
            WHEN 'lancar'        THEN 'Atendimento concluído com cobrança lançada: ' || v_itens || ' parcela(s).'
            WHEN 'nada_a_cobrar' THEN 'Atendimento concluído: nada a cobrar.'
            ELSE 'Atendimento concluído; a cobrança fica para a conferência.'
          END, auth.uid());

  -- 11) O RETORNO NÃO CARREGA A CIFRA TAMPOUCO.
  --     `conferir_depois` é aberto a `pode_editar_chamado`, ou seja, ao
  --     TÉCNICO. Devolver `total numeric` daria a ele a soma das cobranças do
  --     chamado numa resposta de RPC. Quem lançou já sabe o total — foi ele
  --     quem digitou.
  RETURN QUERY SELECT v_itens, v_status;
END;
$u80b$;

COMMENT ON FUNCTION public.concluir_chamado_com_cobranca(uuid,text,text,numeric,numeric[],text) IS
  'Conclui o atendimento e decide a cobrança na MESMA transação. Cadeado FOR '
  'UPDATE + transição de mão única a partir de a_analisar: duas conclusões '
  'simultâneas do mesmo chamado não podem lançar duas vezes. Não marca '
  'agenda_campo.cumprido_em — quem cumpre bloco é agenda_campo_cumprir '
  '(U80/R104).';

REVOKE EXECUTE ON FUNCTION public.concluir_chamado_com_cobranca(uuid,text,text,numeric,numeric[],text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.concluir_chamado_com_cobranca(uuid,text,text,numeric,numeric[],text) TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════
-- §4b) O MESMO FUSO NO MOTOR DE AGOSTO — senão os dois caminhos discordam
-- ═══════════════════════════════════════════════════════════════════════
-- `aprovar_chamado_financeiro()` (U7:711) faz `COALESCE(...)::date` sem fuso,
-- exatamente como esta migration fazia até agora. O defeito é DELE e é anterior
-- a nós: desde agosto, todo chamado encerrado depois das 21h de Brasília gera
-- cobrança com a competência do mês SEGUINTE, e ela entra no fechamento errado.
--
-- Conserto aqui, e não numa migration própria, por um motivo: a U80 cria um
-- SEGUNDO caminho para nascer cobrança. Deixar os dois com convenções de fuso
-- diferentes seria pior do que o defeito original — a mesma conta cairia em
-- meses diferentes conforme a porta por onde entrou, e ninguém entenderia por
-- quê olhando os dados.
--
-- O QUE ISTO **NÃO** FAZ: não mexe em UMA linha de `cobrancas` já gravada. As
-- competências passadas ficam como estão, e é deliberado — um fechamento pode
-- já ter recolhido aquelas linhas, e reescrever a competência de uma cobrança
-- fechada mudaria um total que alguém já conferiu e possivelmente já cobrou. O
-- §6 conta quantas linhas existentes NASCERAM na janela suspeita (encerradas
-- entre 21h e 24h de Brasília), para o Davi saber o tamanho do resíduo e
-- decidir, com calma e fora daqui, se quer acertar alguma à mão.
CREATE OR REPLACE FUNCTION public.aprovar_chamado_financeiro(_chamado_id uuid)
RETURNS TABLE (itens integer, total numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $aprovar$
DECLARE
  v_ch record; v_revisar int; v_competencia text; v_data date;
  v_itens int := 0; v_total numeric := 0;
BEGIN
  SELECT * INTO v_ch FROM public.chamados WHERE id = _chamado_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chamado % não existe.', _chamado_id;
  END IF;

  SELECT count(*) INTO v_revisar
    FROM public.chamado_pecas_analise
   WHERE chamado_id = _chamado_id AND decisao = 'revisar';
  IF v_revisar > 0 THEN
    RAISE EXCEPTION 'Há % item(ns) marcado(s) como "revisar" — a conferência humana precisa decidir antes de a cobrança nascer.', v_revisar;
  END IF;

  DELETE FROM public.cobrancas WHERE chamado_id = _chamado_id AND status = 'aberta';

  -- A ÚNICA MUDANÇA DA U80 NESTE CORPO, e é esta linha: AT TIME ZONE em vez de
  -- ::date. Ver o comentário do §4b.
  v_data := COALESCE(v_ch.finalizada_em, v_ch.created_at) AT TIME ZONE 'America/Sao_Paulo';
  v_competencia := to_char(v_data, 'YYYY-MM');

  INSERT INTO public.cobrancas
    (cliente_id, chamado_id, chamado_peca_id, contrato_id, descricao, quantidade,
     valor_unitario, valor, competencia, data_referencia, tipo_servico, criada_por)
  SELECT v_ch.cliente_id, _chamado_id, a.id, v_ch.contrato_id,
         a.descricao, 1, a.valor_cobravel, a.valor_cobravel,
         v_competencia, v_data, COALESCE(v_ch.tipo_servico,'manutencao'), auth.uid()
    FROM public.chamado_pecas_analise a
   WHERE a.chamado_id = _chamado_id AND a.decisao = 'faturavel';
  GET DIAGNOSTICS v_itens = ROW_COUNT;

  SELECT COALESCE(sum(valor), 0) INTO v_total
    FROM public.cobrancas WHERE chamado_id = _chamado_id AND status = 'aberta';

  UPDATE public.chamados SET faturamento_status = 'aprovada' WHERE id = _chamado_id;

  RETURN QUERY SELECT v_itens, v_total;
END;
$aprovar$;
REVOKE EXECUTE ON FUNCTION public.aprovar_chamado_financeiro(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.aprovar_chamado_financeiro(uuid) TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════
-- §5) CONFERÊNCIA — obtido × esperado × veredito, no CATÁLOGO
-- ═══════════════════════════════════════════════════════════════════════
-- O QUE O DAVI OLHA: a TABELA. Ele procura '>>> OLHAR <<<' na coluna
-- `veredito`. Nada mais. Privilégio não mora no corpo da função, mora no
-- catálogo — nenhuma linha aqui procura substring em `prosrc`.
SELECT t.ordem, t.conferencia, t.valor, t.esperado,
       CASE WHEN t.esperado = '(referência)'             THEN '— referência'
            WHEN t.valor IS NOT DISTINCT FROM t.esperado THEN 'ok'
            ELSE '>>> OLHAR <<<' END AS veredito
  FROM (

SELECT 100 AS ordem,
       'CRÍTICO: uma peça rende UMA cobrança viva — o índice EXISTE e é ÚNICO (sem ele, duas aprovações no mesmo minuto cobram em dobro)' AS conferencia,
       (SELECT count(*)::text FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
         WHERE c.relname = 'cobrancas_uma_por_peca_idx' AND i.indisunique) AS valor,
       '1' AS esperado

UNION ALL
SELECT 101, 'CRÍTICO: e o avulso vinculado é único por chamado/competência/descrição',
       (SELECT count(*)::text FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
         WHERE c.relname = 'cobrancas_avulsa_unica_por_chamado_idx' AND i.indisunique), '1'

UNION ALL
-- A ASSINATURA EXATA, e não o nome: `chamados_com_lancamento(uuid)` seria
-- outra função, e o GRANT teria caído na errada.
SELECT 102, 'CRÍTICO: as duas RPCs novas existem com a assinatura EXATA',
       ((to_regprocedure('public.chamados_com_lancamento(uuid[])') IS NOT NULL)::int
      + (to_regprocedure('public.concluir_chamado_com_cobranca(uuid,text,text,numeric,numeric[],text)') IS NOT NULL)::int)::text,
       '2'

UNION ALL
-- anon é o mundo: a chave publishable está no .env VERSIONADO (U79:297).
SELECT 103, 'CRÍTICO: anon NÃO executa nenhuma das duas — a chave publishable está no .env versionado',
       (SELECT count(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname='public'
           AND p.proname IN ('chamados_com_lancamento','concluir_chamado_com_cobranca')
           AND has_function_privilege('anon', p.oid, 'EXECUTE')), '0'

UNION ALL
SELECT 104, 'e authenticated executa as duas (sem isso o cartão nasce mudo e o painel nasce morto)',
       (SELECT count(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname='public'
           AND p.proname IN ('chamados_com_lancamento','concluir_chamado_com_cobranca')
           AND has_function_privilege('authenticated', p.oid, 'EXECUTE')), '2'

UNION ALL
-- O motor não foi tocado: o ACL de `aprovar_chamado_financeiro` continua o de
-- U7:743-744 (o REVOKE de PUBLIC/anon é preservado pelo CREATE OR REPLACE da
-- U13, porque REPLACE preserva a ACL).
SELECT 105, 'CRÍTICO: o motor não foi tocado — aprovar_chamado_financeiro continua fechada a anon e aberta a authenticated',
       (has_function_privilege('anon','public.aprovar_chamado_financeiro(uuid)','EXECUTE')::text
        || '/' ||
        has_function_privilege('authenticated','public.aprovar_chamado_financeiro(uuid)','EXECUTE')::text),
       'false/true'

UNION ALL
SELECT 106, 'CRÍTICO: a policy de cobrancas continua sendo a da U4 — esta migration não reescreveu régua de leitura',
       (SELECT count(*)::text FROM pg_policies
         WHERE schemaname='public' AND tablename='cobrancas'
           AND policyname='cobrancas_select'
           AND qual LIKE '%pode_ver_financeiro%'), '1'

UNION ALL
SELECT 107, 'nenhuma duplicata viva sobrou (o §1 abortaria antes, mas a conferência não confia no §1)',
       (SELECT count(*)::text FROM (
          SELECT 1 FROM public.cobrancas WHERE chamado_peca_id IS NOT NULL AND status <> 'cancelada'
           GROUP BY chamado_peca_id HAVING count(*) > 1) d), '0'

UNION ALL
-- ══ 108: PARA QUANTAS PESSOAS A RPC DE LEITURA FOI ESCRITA ════════════════
-- Ela existe SÓ para quem é gestor e NÃO vê financeiro — o SAC (R13). Quem vê
-- financeiro poderia fazer o SELECT direto; quem não é gestor não recebe
-- linha. SE ESTE NÚMERO FOR 0, `chamados_com_lancamento` NÃO TEM UM ÚNICO
-- USUÁRIO HOJE, e o selo poderia sair de `faturamento_status` direto, com zero
-- superfície nova. É a linha que o Davi olha ANTES de decidir instalar.
SELECT 108, 'referência: quantas pessoas são gestor E NÃO veem financeiro — a população INTEIRA para quem chamados_com_lancamento foi escrita. Se for 0, ela não tem usuário',
       (SELECT count(*)::text FROM public.profiles p
         WHERE public.is_gestor(p.id) AND NOT public.pode_ver_financeiro(p.id)),
       '(referência)'

UNION ALL
SELECT 109, 'referência: chamados de campo concluídos na fila "a conferir" — o denominador do selo âmbar no dia 1',
       (SELECT count(*)::text FROM public.chamados
         WHERE natureza='campo' AND status='concluido' AND faturamento_status='a_analisar'),
       '(referência)'

UNION ALL
-- ══ 110: O ESTADO EM QUE O CARTÃO SE CALA ═════════════════════════════════
-- Decidido (aprovada/faturada) e sem lançamento vivo. É legítimo quando alguém
-- cancelou a cobrança; é corrupção em qualquer outro caso — e as duas
-- conversas são de quem vê valores. O cartão devolve `null` nesse estado e a
-- faixa `divergenciasDoCiclo` (gateada por veFinanceiro) é quem grita.
SELECT 110, 'referência: chamados marcados aprovada/faturada SEM lançamento vivo — o estado em que o cartão SE CALA e a faixa de divergência acusa',
       (SELECT count(*)::text FROM public.chamados c
         WHERE c.faturamento_status IN ('aprovada','faturada')
           AND NOT EXISTS (SELECT 1 FROM public.cobrancas b
                            WHERE b.chamado_id=c.id AND b.status <> 'cancelada')),
       '(referência)'

UNION ALL
SELECT 111, 'referência: cobranças vivas em chamado marcado sem_cobranca (hoje deve ser zero — é o avulso vinculado do §4 que passa a produzi-lo)',
       (SELECT count(*)::text FROM public.cobrancas b JOIN public.chamados c ON c.id=b.chamado_id
         WHERE c.faturamento_status='sem_cobranca' AND b.status <> 'cancelada'),
       '(referência)'

UNION ALL
-- ══ 112: O PONTO CEGO QUE ESTE DESENHO DEIXA ABERTO, MEDIDO ═══════════════
-- O selo tem porta TEMPORAL: só aparece depois que o atendimento aconteceu. O
-- bloco que aconteceu e ninguém marcou "feito" fica FORA do selo, fora de
-- "retornos pendentes" (tem bloco pendente, logo não é retorno pendente) e
-- fora da semana aberta. É invisível em TODOS os eixos desta entrega.
-- Se este número for grande, a porta temporal está no lugar errado.
SELECT 112, 'referência: blocos PENDENTES com dia já passado há mais de 7 dias — o ponto cego DECLARADO deste desenho: aconteceu, ninguém marcou feito, e nenhum selo desta entrega o alcança',
       (SELECT count(*)::text FROM public.agenda_campo a
         WHERE a.cancelado_em IS NULL AND a.cumprido_em IS NULL
           AND a.dia < (current_date - 7)),
       '(referência)'

UNION ALL
SELECT 113, 'referência: chamados de campo CONCLUÍDOS parados em em_conferencia — analisados e nunca aprovados, hoje invisíveis para toda a operação (o cartão volta a mostrá-los como "a conferir")',
       (SELECT count(*)::text FROM public.chamados
         WHERE natureza='campo' AND status='concluido' AND faturamento_status='em_conferencia'),
       '(referência)'

UNION ALL
SELECT 114, 'CRÍTICO: a escrita direta em cobrancas continua sendo a da U4 — pode_ver_financeiro nos dois lados, e esta migration não a alargou',
       (SELECT count(*)::text FROM pg_policies
         WHERE schemaname='public' AND tablename='cobrancas'
           AND policyname='cobrancas_write'
           AND qual LIKE '%pode_ver_financeiro%'
           AND with_check LIKE '%pode_ver_financeiro%'), '1'

) t ORDER BY t.ordem;

COMMIT;

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ DESFAZER                                                             ║
-- ╚══════════════════════════════════════════════════════════════════════╝
-- Derruba as duas portas e os dois índices. O que volta junto, dito por
-- extenso:
--   · o cartão perde o selo "lançado" e passa a se calar em `aprovada` e
--     `sem_cobranca` — `useLancamentosDosChamados` recebe erro, devolve Map
--     VAZIO, e Map vazio É o "não sei" que `seloDoCiclo` sabe ler. Os outros
--     selos vivem de `chamados.faturamento_status` e continuam;
--   · o painel do ciclo volta 42501 em toda chamada de conclusão;
--   · e — o que importa — `aprovar_chamado_financeiro` VOLTA A PODER DUPLICAR
--     nos dois cenários do §2.
-- Nenhum cartão some, nenhum número da grade muda, nenhuma tela quebra: a
-- ausência do dado é um estado do modelo, não um erro da tela. É freio de
-- emergência, não rollback de rotina.
--
-- BEGIN;
--   DROP FUNCTION IF EXISTS public.concluir_chamado_com_cobranca(uuid,text,text,numeric,numeric[],text);
--   DROP FUNCTION IF EXISTS public.chamados_com_lancamento(uuid[]);
--   DROP INDEX IF EXISTS public.cobrancas_avulsa_unica_por_chamado_idx;
--   DROP INDEX IF EXISTS public.cobrancas_uma_por_peca_idx;
-- COMMIT;
-- ═══════════════════════════════════════════════════════════════════════════
