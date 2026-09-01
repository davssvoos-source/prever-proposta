-- ═══════════════════════════════════════════════════════════════════════════
-- S4 — AUDITORIA DE VALOR: O MOTOR PARA DE FALAR DE DINHEIRO EM VOZ ALTA
--      (série S, como a S1, a S2 e a S3)
--
-- >>> RODAR NO SQL EDITOR DO SUPABASE, À MÃO, **DEPOIS DA U80**. Idempotente. <<<
-- >>> O §0 ABORTA se a U80 ainda não rodou — e isso não é preciosismo de     <<<
-- >>> ordem: a U80 reescreve `aprovar_chamado_financeiro`. Rodar a S4 antes   <<<
-- >>> dela é ter o conserto sobrescrito pelo defeito meia hora depois.        <<<
--
-- A pergunta desta migration é uma só: **quem consegue ler dinheiro neste
-- sistema, e isso bate com a R13?** ("o SAC é gestor que NÃO vê valores").
-- Ela responde em dois pontos, e recusa mexer em mais nada.
--
-- ── DEFEITO 1 · A LINHA DO TEMPO ENTREGA O TOTAL EM REAIS A TODO AUTENTICADO
--
-- `chamado_eventos_select` é, desde 19/08 (u7:586-587), literalmente:
--
--     FOR SELECT TO authenticated USING (true)
--
-- Não é `pode_acessar_chamado`, como as irmãs `chamado_fotos_select` (u7:579)
-- e `chamado_checklist_select` (u7:594) escritas NA MESMA MIGRATION, 8 linhas
-- acima. É `true`. E `aprovar_chamado_financeiro` grava nessa tabela
-- (u13:116-120):
--
--     'Cobrança aprovada: ' || v_itens || ' item(ns), total ' ||
--     to_char(v_total,'FM999G999G990D00')
--
-- O que um `curl` com a chave publishable (que está no `.env` VERSIONADO) e
-- QUALQUER login consegue hoje, sem passar por tela nenhuma:
--
--     GET /rest/v1/chamado_eventos?tipo=eq.cobranca_aprovada&select=descricao
--     → os totais aprovados da empresa INTEIRA, chamado a chamado.
--
-- Não é "o técnico vê o total do chamado dele". É todo mundo vendo tudo. A tela
-- (`DetalheCampo.tsx:1252-1278`, que pinta `{ev.descricao ?? ev.tipo}` na 1267,
-- fora de qualquer `veFinanceiro`) é o caso MENOR — o modelo de ameaça desta
-- casa é que todo usuário fala direto com o Postgres, e a policy é a única
-- fronteira real.
--
-- Duas coisas que já estavam certas e ficam registradas para ninguém "arrumar":
--   · `authenticated` NÃO tem UPDATE nem DELETE nesta tabela. O único GRANT é
--     `GRANT SELECT, INSERT ON public.os_eventos TO authenticated` (etapa3:349),
--     carregado pelo rename da u7:45. Ninguém reescreve a linha do tempo.
--   · a U80 NÃO repetiu o erro: o evento dela (`cobranca_decidida`, u80:514-520)
--     grava o FATO e a CONTAGEM, nunca o dinheiro, e diz por quê em u80:505-513.
--     Esta migration faz a porta VELHA combinar com a nova.
--
-- ── DEFEITO 2 · A U80 APAGOU O GATE DE PAPEL DE `aprovar_chamado_financeiro`
--
-- Este é o mais grave, e ele ainda não aconteceu em produção — a U80 está em
-- `main` e o diário manda rodá-la depois da U79 (`PLANO_UNIFICACAO.md:6113`).
-- Dá para pegar antes.
--
-- O cabeçalho da U80 afirma, na linha 11: "Não reescreve
-- `aprovar_chamado_financeiro`". A linha 583 afirma: "A ÚNICA MUDANÇA DA U80
-- NESTE CORPO, e é esta linha: AT TIME ZONE em vez de ::date". **As duas são
-- falsas.** O corpo de `u80:562-605` não é o de `u13:70-124` com uma linha
-- trocada — é um corpo novo. Comparado linha a linha, sumiram CINCO coisas:
--
--   1. O GATE DE PAPEL (u13:76-78):
--        IF NOT public.pode_ver_financeiro(auth.uid()) THEN
--          RAISE EXCEPTION '…' USING ERRCODE = '42501';
--      A função é SECURITY DEFINER e `GRANT … TO authenticated` (u80:607) —
--      numa SECURITY DEFINER o GRANT **tem** de ser `authenticated`, então o
--      corpo é o ÚNICO lugar onde o papel pode ser checado. Sem ele, qualquer
--      técnico faz POST /rest/v1/rpc/aprovar_chamado_financeiro e recebe
--      `RETURNS TABLE (itens integer, total numeric)` — o total em reais — e de
--      quebra grava as cobranças, passando por cima de `cobrancas_write`.
--      Isto é PIOR que o Defeito 1: não depende de o chamado ter tido evento.
--   2. A trava `IF v_ch.status <> 'concluido'` (u13:81-83).
--   3. O `sem_cobranca`: `faturamento_status` virou `'aprovada'` FIXO (u80:601),
--      e chamado sem nada a cobrar passaria a entrar na fila de faturamento.
--   4. O `concluida_em` do COALESCE da competência (u13:92 × u80:586).
--   5. (E o INSERT com a cifra sumiu junto — ganho acidental que ninguém
--      reivindicou, e que esta migration passa a fazer de propósito.)
--
-- E O CORPO NOVO NÃO RODA. Ele lê `a.decisao` (u80:576, 595), `a.valor_cobravel`
-- (u80:592, duas vezes), `a.descricao` e `a.id` (u80:591-592) de
-- `chamado_pecas_analise`. Essa tabela nasce em `u3:150-165` como
-- `os_pecas_analise` e tem `peca_id` (PK), `chamado_id`, `resultado`,
-- `cobertura_item_id`, `valor_calculado`, `confianca`, `justificativa`,
-- `ajustado_manualmente`, `ajustado_por`, `analisado_em`, `updated_at`. Os
-- únicos DDLs posteriores são dois renames (u7:49, u7:57). **`decisao` e
-- `valor_cobravel` não existem em migration nenhuma nem em uma linha do `src/`.**
-- Corpo plpgsql não é resolvido no CREATE: a U80 aplica VERDE e a função quebra
-- com 42703 na primeira aprovação (`src/features/chamados/cobranca.ts:197`) —
-- a fila de faturamento inteira morre com ela.
--
-- Por que nem a conferência da U80 nem o verificador pegaram, e a lição:
--   · a conferência da U80 (linha 105) lê o CATÁLOGO, e diz em u80:614-615 que
--     "privilégio não mora no corpo da função". Para GRANT/REVOKE, verdade
--     inteira. Para o gate de papel de uma SECURITY DEFINER, é o oposto exato:
--     o catálogo NÃO PODE enxergá-lo. A linha 105 deu "ok" no ACL enquanto a
--     régua que ele deveria proteger não estava mais lá;
--   · a asserção `verificar-logica.cjs:8698-8706` jura, verde, que "o que ela
--     muda é o FUSO, nada mais" — e prova isso com três regex de PRESENÇA.
--     Nenhuma pergunta o que SAIU. É a regra 4 desta casa em estado puro: a
--     asserção foi escrita a partir do corpo NOVO, listou o que o corpo novo
--     manteve, e chamou isso de "as duas garantias". Eram três. O §4 do
--     verificador SUBSTITUI essa asserção — deixar uma asserção verde que diz
--     uma falsidade é pior do que não ter asserção nenhuma.
--
-- ── O QUE ESTA MIGRATION **NÃO** FAZ, e cada "não" tem motivo escrito ──────
--
-- · NÃO fecha `equipamentos` (custo, markup) nem `servicos`
--   (preco_unitario_mensal), que são `USING (true)` desde junho e por onde
--   qualquer autenticado reproduz a tabela de preço e a margem da empresa.
--   Motivo: ali não há policy errada, há **R12 contra R13**. A R12 manda o
--   técnico montar o orçamento na visita, e `BlocoItensEditor.tsx:168-178` faz
--   `custo × markup` em quatro telas do fluxo dele. Fechar quebra a R12; não
--   fechar deixa a R13 literalmente falsa. É chamada de produto do Davi, não
--   conserto de auditor. Registrado como P22.
-- · NÃO mexe em `pode_acessar_visita` (o SAC lê o orçamento da visita por
--   deriva da U6a). Motivo: as três tabelas do trio não têm coluna de dinheiro
--   — o R$ daquela tela é calculado no navegador a partir de `equipamentos` —
--   e fechá-las quebraria `inventario.ts:298-310` e `checklist.ts:119-135` para
--   o SAC sem esconder um real. É sintoma do anterior. Registrado como P23.
-- · NÃO droppa `unidades_select` (a S1 §2.3 nunca entrou em vigor: ela dropou
--   um nome que não existia). Motivo: é segurança física/LGPD, não R13, e antes
--   precisa do `pg_policies` real da base. Registrado como P24.
-- · NÃO cria a coluna `chamado_eventos.financeiro`. Ela era o desenho mais
--   completo — marcar o passado por regra e travar o futuro com DEFAULT true —
--   mas o custo dela depende de um número que ninguém mediu, e o §3 desta
--   migration É essa medição. Se o resíduo voltar ZERO (a U69:57 fez
--   `DELETE FROM public.chamados`, e `chamado_eventos` sai por CASCADE), a
--   coluna estaria guardando conjunto vazio ao preço de recriar cinco funções.
--   Se voltar linha, ela vira a S5 e é obrigatória.
-- · NÃO conserta o P19 (o DELETE incondicional come a cobrança avulsa
--   vinculada). Motivo NOVO, e é preciso dizer: o conserto de uma linha que o
--   P19 propõe é INSUFICIENTE. Estreitar o DELETE para `chamado_peca_id IS NOT
--   NULL` salva o dinheiro, mas o `v_itens = 0` seguinte crava `sem_cobranca` —
--   trocaria "o dinheiro some e a linha do tempo confirma que não havia
--   dinheiro" por "o dinheiro fica e o status mente". O conserto certo mexe
--   também na decisão de `faturamento_status`, e isso é motor, não auditoria.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- §0) TRAVA DE ORDEM — a U80 tem de ter rodado ANTES
-- ═══════════════════════════════════════════════════════════════════════
-- Não é capricho. `CREATE OR REPLACE` é a última palavra: se a S4 rodar
-- primeiro, a U80 sobrescreve o conserto com o corpo quebrado e sem gate, e
-- ninguém percebe porque as duas aplicam verde. A presença de
-- `concluir_chamado_com_cobranca` é a assinatura da U80 no catálogo.
DO $trava$
BEGIN
  IF to_regprocedure('public.concluir_chamado_com_cobranca(uuid,text,text,numeric,numeric[],text)') IS NULL THEN
    RAISE EXCEPTION E'ABORTADO — nada foi alterado (ROLLBACK).\nA U80 (20260903090000) ainda não rodou neste banco: `concluir_chamado_com_cobranca` não existe.\nRode a U80 PRIMEIRO e a S4 em seguida, na MESMA sessão, sem clicar em "Aprovar cobrança" no meio — a janela entre as duas é o único momento em que o motor fica sem gate E quebrado.';
  END IF;
END $trava$;

-- ═══════════════════════════════════════════════════════════════════════
-- §1) O MOTOR DE APROVAÇÃO, INTEIRO E COM O GATE DE VOLTA
-- ═══════════════════════════════════════════════════════════════════════
-- É o corpo da U13 (u13:70-124) com exatamente DUAS diferenças declaradas:
--
--   (a) MANTÉM o `AT TIME ZONE 'America/Sao_Paulo'` que a U80 trouxe. É o
--       único ganho legítimo do §4b dela, e é obrigatório: a U80 criou uma
--       SEGUNDA porta para nascer cobrança (`concluir_chamado_com_cobranca`) e
--       deixar as duas com convenções de fuso diferentes faria a mesma conta
--       cair em meses diferentes conforme a porta por onde entrou.
--   (b) O evento da linha do tempo perde o `to_char`. Passa a gravar
--       'Cobrança aprovada: N item(ns).' — o FATO e a CONTAGEM, sem a cifra.
--       Nada de informação legítima se perde: a linha do tempo nunca foi o
--       livro-caixa. O dinheiro mora em `cobrancas`, linha a linha, com
--       `criada_por` e `created_at`, atrás de `cobrancas_select =
--       pode_ver_financeiro(auth.uid())` (u4:293), e o total é derivável de lá
--       por quem pode. O evento existe para dizer QUE a etapa aconteceu, e
--       'Cobrança aprovada: 3 item(ns).' diz isso inteiro.
--
-- Tudo o mais é restauração: o gate, a trava de status, o `resultado` de
-- verdade em vez de `decisao`, o `valor_calculado` em vez de `valor_cobravel`,
-- o join com `chamado_pecas` (que é de onde saem `descricao` e `quantidade`,
-- porque `chamado_pecas_analise` não tem nenhuma das duas), o `sem_cobranca` e
-- o `concluida_em`.
--
-- O GATE É A PRIMEIRA INSTRUÇÃO EXECUTÁVEL DO CORPO, e isso é medido pelo
-- verificador. A ordem importa: em u80 a primeira instrução era
-- `SELECT * INTO v_ch FROM public.chamados` — SECURITY DEFINER, furando a RLS —
-- o que fazia da função um oráculo de existência de UUID mesmo depois de
-- quebrar no 42703 da instrução seguinte.
CREATE OR REPLACE FUNCTION public.aprovar_chamado_financeiro(_chamado_id uuid)
RETURNS TABLE (itens integer, total numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $s4$
DECLARE
  v_ch record; v_revisar int; v_competencia text; v_data date;
  v_itens int := 0; v_total numeric := 0;
BEGIN
  IF NOT public.pode_ver_financeiro(auth.uid()) THEN
    RAISE EXCEPTION 'Somente quem responde pelo financeiro pode aprovar cobrança.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_ch FROM public.chamados WHERE id = _chamado_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chamado não encontrado.'; END IF;
  IF v_ch.status <> 'concluido' THEN
    RAISE EXCEPTION 'O chamado precisa estar concluído para ter a cobrança aprovada.';
  END IF;

  SELECT count(*) INTO v_revisar FROM public.chamado_pecas_analise a
   WHERE a.chamado_id = _chamado_id AND a.resultado IN ('revisar','nao_identificado');
  IF v_revisar > 0 THEN
    RAISE EXCEPTION 'Ainda há % item(ns) em revisão. Resolva antes de aprovar.', v_revisar;
  END IF;

  v_data := COALESCE(v_ch.finalizada_em, v_ch.concluida_em, v_ch.created_at)
              AT TIME ZONE 'America/Sao_Paulo';
  v_competencia := to_char(v_data, 'YYYY-MM');

  DELETE FROM public.cobrancas WHERE chamado_id = _chamado_id AND status = 'aberta';

  INSERT INTO public.cobrancas
    (cliente_id, chamado_id, chamado_peca_id, contrato_id, descricao, quantidade,
     valor_unitario, valor, competencia, data_referencia, tipo_servico, criada_por)
  SELECT v_ch.cliente_id, _chamado_id, p.id, v_ch.contrato_id, p.descricao, p.quantidade,
         a.valor_calculado, round(a.valor_calculado * p.quantidade, 2),
         v_competencia, v_data, COALESCE(v_ch.tipo_servico,'manutencao'), auth.uid()
    FROM public.chamado_pecas p
    JOIN public.chamado_pecas_analise a ON a.peca_id = p.id
   WHERE p.chamado_id = _chamado_id AND a.resultado = 'faturavel'
     AND a.valor_calculado IS NOT NULL AND a.valor_calculado > 0;
  GET DIAGNOSTICS v_itens = ROW_COUNT;

  SELECT COALESCE(sum(valor),0) INTO v_total FROM public.cobrancas
   WHERE chamado_id = _chamado_id AND status = 'aberta';

  UPDATE public.chamados
     SET faturamento_status = CASE WHEN v_itens = 0 THEN 'sem_cobranca' ELSE 'aprovada' END
   WHERE id = _chamado_id;

  INSERT INTO public.chamado_eventos (chamado_id, tipo, descricao, user_id)
  VALUES (_chamado_id, 'cobranca_aprovada',
          CASE WHEN v_itens = 0 THEN 'Conferência concluída: nada a cobrar.'
               ELSE 'Cobrança aprovada: ' || v_itens || ' item(ns).' END, auth.uid());

  RETURN QUERY SELECT v_itens, v_total;
END;
$s4$;

-- `CREATE OR REPLACE` PRESERVA a ACL, mas repetir REVOKE/GRANT torna a linha
-- verdadeira sozinha e é a regra 5 da casa: anon é o mundo, porque a chave
-- publishable está no `.env` VERSIONADO.
REVOKE EXECUTE ON FUNCTION public.aprovar_chamado_financeiro(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.aprovar_chamado_financeiro(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.aprovar_chamado_financeiro(uuid) IS
  'Aprova a cobrança de um chamado concluído e devolve (itens, total). SECURITY '
  'DEFINER: o GRANT é obrigatoriamente authenticated, então o gate de papel '
  '(pode_ver_financeiro, R13) mora no CORPO e é a PRIMEIRA instrução executável '
  '— o catálogo não sabe enxergá-lo, e a U80 o apagou sem que nenhuma '
  'conferência de ACL pudesse notar (S4). O evento que ela grava na linha do '
  'tempo carrega o FATO e a CONTAGEM, nunca a cifra.';

-- ═══════════════════════════════════════════════════════════════════════
-- §2) A LINHA DO TEMPO PASSA A TER DONO
-- ═══════════════════════════════════════════════════════════════════════
-- A régua é `pode_acessar_chamado(chamado_id)` — a MESMA que
-- `chamado_fotos_select` (u7:579) e `chamado_checklist_select` (u7:594) usam
-- desde 19/08. Não é régua nova, é a régua que faltou nesta tabela.
--
-- ── "QUEM USA ISTO HOJE, E PARA QUÊ?" — respondido por varredura do `src/`,
--    porque fechar demais quebra trabalho legítimo, e em silêncio (policy de
--    SELECT FILTRA LINHAS, não levanta erro: o feed volta `[]` e a tela desenha
--    "Ninguém comentou ainda." para uma conversa cheia).
--
-- Existe UM ÚNICO SELECT de `chamado_eventos` em todo o `src/`:
-- `useChamadoEventos` (`src/features/chamados/data.ts:332-346`), e ele é SEMPRE
-- `.eq("chamado_id", <um id>)`. Três chamadores, todos a partir de um chamado
-- JÁ ABERTO: `DetalheCampo.tsx:55` (linha do tempo), `DetalheInterno.tsx:46`
-- (linha do tempo + comentários, fatiados do mesmo resultado) e
-- `PainelChamado.tsx:466` (só comentários). Nenhum feed agregado, nenhuma
-- listagem entre chamados. **Nenhuma tela depende de ler evento de chamado
-- alheio.** `supabase/functions/` não toca a tabela.
--
-- ── E A ARMADILHA QUE QUASE ENTROU AQUI, porque ela ensina o método ────────
-- Duas leituras independentes desta auditoria propuseram uma função NOVA
-- (`pode_ler_chamado`) só para acrescentar uma perna `OR natureza = 'interno'`,
-- as duas citando `chamados_select` como estando em `u7:545-548`. Essa policy
-- está MORTA: `u29:181` a droppa e `u29:182-196` a recria, e o ramo não-comercial
-- da versão viva é `is_gestor OR responsavel_id OR aberto_por OR responsavel_id
-- IS NULL OR apoio` — **sem `natureza = 'interno'`**. Hoje o técnico já não
-- enxerga chamado interno de outra pessoa. A perna teria sido um AFROUXAMENTO
-- disfarçado de compatibilidade: daria linha do tempo de chamado interno a quem
-- não consegue nem abrir a capa. Regra 2 da casa aplicada a policy em vez de a
-- regex: a linha existia no repo, mas não estava VIVA.
--
-- Com a régua viva na mão, `pode_acessar_chamado` (s2:147-164) é SUPERCONJUNTO
-- de `chamados_select` no ramo não-comercial — quem abre o chamado hoje continua
-- lendo a linha do tempo dele, sem exceção. A única diferença é exigir apoio
-- LEGÍTIMO, e ninguém perde por isso: a S2 matou a auto-inscrição (s2:86-89) e
-- linha antiga tem `criado_por` NULL, que passa no `IS DISTINCT FROM`.
--
-- ── O RESÍDUO, DECLARADO ──────────────────────────────────────────────────
-- Para `natureza = 'comercial'`, `chamados_select` (u29:184-185) é MAIS ESTRITA
-- que `pode_acessar_chamado`: ela é só `is_gestor OR responsavel_id`, sem
-- `aberto_por`, sem fila sem dono, sem apoio. Então quem abriu um chamado
-- comercial que não é seu passa a ler o evento dele sem conseguir abrir a capa.
-- É muito menos que `true`, é EXATAMENTE o mesmo desvio que `chamado_fotos` e
-- `chamado_checklist` já têm desde 19/08, e fica dito aqui em vez de descoberto
-- daqui a três meses.
DROP POLICY IF EXISTS "chamado_eventos_select" ON public.chamado_eventos;
CREATE POLICY "chamado_eventos_select" ON public.chamado_eventos
  FOR SELECT TO authenticated
  USING (public.pode_acessar_chamado(chamado_id));

COMMENT ON POLICY "chamado_eventos_select" ON public.chamado_eventos IS
  'Linha do tempo e comentários seguem a régua das fotos e do checklist do '
  'mesmo chamado (pode_acessar_chamado). Era USING (true) de 19/08 a 03/09, e '
  'nesse período um curl com qualquer login lia o total em reais de toda '
  'cobrança aprovada da empresa (S4, R13).';

-- De brinde, o par que ninguém tinha olhado: o WITH CHECK de u7:589 exige
-- autoria e tipo, mas NÃO exige vínculo — hoje qualquer autenticado comenta em
-- qualquer chamado, inclusive num que ele não consegue ver. Os três caminhos de
-- comentário da UI partem de um chamado já aberto, e quem abre satisfaz a
-- função: nenhum quebra.
DROP POLICY IF EXISTS "chamado_eventos_insert" ON public.chamado_eventos;
CREATE POLICY "chamado_eventos_insert" ON public.chamado_eventos
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND tipo = 'comentario'
              AND public.pode_acessar_chamado(chamado_id));

-- ═══════════════════════════════════════════════════════════════════════
-- §3) CONFERÊNCIA — obtido × esperado × veredito
-- ═══════════════════════════════════════════════════════════════════════
-- O QUE O DAVI OLHA: a TABELA. Ele procura '>>> OLHAR <<<' na coluna
-- `veredito`, e depois lê as três linhas de RESÍDUO (300-302), que não têm
-- esperado porque são medição, não promessa. RAISE NOTICE é invisível no editor
-- do Supabase; por isso tudo aqui é SELECT.
--
-- ── UMA DECLARAÇÃO NECESSÁRIA SOBRE A LINHA 204 ───────────────────────────
-- A U80 escreveu, em u80:614-615, "privilégio não mora no corpo da função, mora
-- no catálogo — nenhuma linha aqui procura substring em `prosrc`". Para
-- GRANT/REVOKE isso é verdade inteira, e a linha 203 abaixo respeita.
-- Para o GATE DE PAPEL de uma SECURITY DEFINER é o oposto exato: o catálogo NÃO
-- PODE enxergá-lo, e foi essa cegueira que deixou a U80 passar verde sem ele.
-- Então a 204 lê `prosrc` — de propósito, uma vez, e ORDENADA: não pergunta se
-- o gate "aparece", pergunta se ele aparece ANTES da primeira leitura de
-- `chamados`. Um gate posto depois do SELECT não é gate.
SELECT t.ordem, t.conferencia, t.valor, t.esperado,
       CASE WHEN t.esperado = '(referência)'             THEN '— referência'
            WHEN t.valor IS NOT DISTINCT FROM t.esperado THEN 'ok'
            ELSE '>>> OLHAR <<<' END AS veredito
  FROM (

-- Medido por PEDAÇO e não por igualdade de texto inteiro: `pg_get_expr`
-- reformata o predicado (parênteses, `::text`, e qualifica ou não o schema
-- conforme o `search_path` da sessão que está LENDO). Uma comparação literal
-- daria '>>> OLHAR <<<' por causa de um parêntese, e o Davi ia caçar um defeito
-- que não existe. A linha 208 mostra o texto cru, para os olhos.
SELECT 200 AS ordem,
       'CRÍTICO: chamado_eventos_select NÃO é mais `true` — é pode_acessar_chamado' AS conferencia,
       (SELECT (qual LIKE '%pode_acessar_chamado(chamado_id)%' AND btrim(qual) <> 'true')::text
          FROM pg_policies
         WHERE schemaname='public' AND tablename='chamado_eventos'
           AND policyname='chamado_eventos_select') AS valor,
       'true' AS esperado

UNION ALL
SELECT 201, 'CRÍTICO: e o INSERT de comentário passa a exigir as TRÊS coisas: autoria, tipo e vínculo com o chamado',
       (SELECT ((with_check LIKE '%user_id = auth.uid()%')::int
              + (with_check LIKE '%tipo = ''comentario''%')::int
              + (with_check LIKE '%pode_acessar_chamado(chamado_id)%')::int)::text
          FROM pg_policies
         WHERE schemaname='public' AND tablename='chamado_eventos'
           AND policyname='chamado_eventos_insert'), '3'

UNION ALL
-- Não é conserto desta migration: é o que já estava apertado, medido para não
-- ser afrouxado por engano um dia. Ninguém reescreve nem apaga linha do tempo.
-- `has_table_privilege` e não `information_schema.table_privileges`: a view do
-- information_schema só mostra a linha quando o usuário corrente é o grantor,
-- o grantee, ou membro de um dos dois — ela pode devolver 0 por FALTA DE
-- VISIBILIDADE, e um 0 desses passaria como "ok" sem provar nada. A função lê
-- o ACL direto. Os quatro de uma vez, para a mesma linha provar que SELECT e
-- INSERT continuam de pé (sem eles a linha do tempo some do app).
SELECT 202, 'CRÍTICO: authenticated continua SEM UPDATE e SEM DELETE em chamado_eventos (ninguém reescreve nem apaga a linha do tempo), e COM SELECT e INSERT (senão o app perde a timeline e o comentário)',
       (has_table_privilege('authenticated','public.chamado_eventos','UPDATE')::text || '/' ||
        has_table_privilege('authenticated','public.chamado_eventos','DELETE')::text || '/' ||
        has_table_privilege('authenticated','public.chamado_eventos','SELECT')::text || '/' ||
        has_table_privilege('authenticated','public.chamado_eventos','INSERT')::text),
       'false/false/true/true'

UNION ALL
SELECT 203, 'CRÍTICO: aprovar_chamado_financeiro continua fechada a anon e aberta a authenticated (a chave publishable está no .env versionado)',
       (has_function_privilege('anon','public.aprovar_chamado_financeiro(uuid)','EXECUTE')::text
        || '/' ||
        has_function_privilege('authenticated','public.aprovar_chamado_financeiro(uuid)','EXECUTE')::text),
       'false/true'

UNION ALL
SELECT 204, 'CRÍTICO: o gate de papel está VIVO e vem ANTES da primeira leitura de chamados — é a única checagem que o catálogo não sabe ver, e a U80 a tinha apagado',
       (SELECT (strpos(p.prosrc, 'pode_ver_financeiro') > 0
                AND strpos(p.prosrc, 'pode_ver_financeiro')
                    < strpos(p.prosrc, 'SELECT * INTO v_ch FROM public.chamados'))::text
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname='public' AND p.proname='aprovar_chamado_financeiro' AND p.pronargs = 1), 'true'

UNION ALL
SELECT 205, 'CRÍTICO: e o corpo NÃO grava mais cifra na linha do tempo — nada de to_char(…FM…) nem de v_total no evento',
       (SELECT (p.prosrc LIKE '%FM999G999G990D00%')::text
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname='public' AND p.proname='aprovar_chamado_financeiro' AND p.pronargs = 1), 'false'

UNION ALL
SELECT 206, 'CRÍTICO: e o fuso da U80 sobreviveu — as DUAS portas de nascer cobrança têm o mesmo relógio',
       (SELECT (p.prosrc LIKE '%America/Sao_Paulo%')::text
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname='public' AND p.proname='aprovar_chamado_financeiro' AND p.pronargs = 1), 'true'

UNION ALL
-- A ASSERÇÃO QUE TERIA PEGO A U80 SOZINHA, e ela lê o CATÁLOGO DE COLUNAS: as
-- quatro que o corpo da U80 inventou (decisao, valor_cobravel, descricao, id)
-- contra as duas que existem de verdade. Corpo plpgsql não é resolvido no
-- CREATE — a única forma de o texto e o schema conversarem é esta.
SELECT 207, 'CRÍTICO: chamado_pecas_analise tem `resultado` e `valor_calculado` e NÃO tem `decisao` nem `valor_cobravel` — as colunas que o corpo da U80 lia e que nunca existiram',
       (SELECT string_agg(c.column_name, ',' ORDER BY c.column_name)
          FROM information_schema.columns c
         WHERE c.table_schema='public' AND c.table_name='chamado_pecas_analise'
           AND c.column_name IN ('resultado','valor_calculado','decisao','valor_cobravel')),
       'resultado,valor_calculado'

UNION ALL
SELECT 208, 'referência: o texto cru das duas policies, como o catálogo as guarda — para os olhos, já que a 200 e a 201 medem por pedaço',
       (SELECT string_agg(policyname || ' → ' || COALESCE(qual, with_check), '  |  ' ORDER BY policyname)
          FROM pg_policies
         WHERE schemaname='public' AND tablename='chamado_eventos'),
       '(referência)'

UNION ALL
-- ══ 300-302: O RESÍDUO. Não é promessa, é medição — e é o número que decide
--    se existe uma S5 com a coluna `chamado_eventos.financeiro`.
--
--    O padrão casa OS DOIS formatos possíveis de FM999G999G990D00: `G` e `D`
--    saem de `lc_numeric`, então num projeto com pt_BR o texto gravado é
--    "1.842,50" e com en_US é "1,842.50". Não sei qual é o desta base — por
--    isso: dígito, separador, dois dígitos, fim.
--
--    EXPECTATIVA (e é só expectativa): a U69:57 fez `DELETE FROM public.chamados`
--    e `chamado_eventos` sai por CASCADE — a conferência de u69:77 exigia
--    `chamado_eventos = 0`. Se a U69 completou, o resíduo é só o escrito depois
--    de 24/08. A consulta é o que decide.
SELECT 300, 'RESÍDUO: linhas de evento JÁ GRAVADAS que carregam cifra (por tipo) — se voltar 0, a coluna `financeiro` da S5 nunca precisou existir',
       COALESCE((SELECT string_agg(x.tipo || '=' || x.n::text, ', ' ORDER BY x.n DESC, x.tipo)
                   FROM (SELECT e.tipo, count(*) AS n
                           FROM public.chamado_eventos e
                          WHERE e.descricao ~ '[0-9][.,][0-9]{2}([^0-9]|$)'
                          GROUP BY e.tipo) x), '(nenhuma)'),
       '(referência)'

UNION ALL
-- A S4 conserta O FUTURO (nenhum escritor grava cifra) e estreita QUEM (só quem
-- alcança o chamado). Ela NÃO reescreve `descricao` de linha antiga — isso seria
-- destruir registro de auditoria e mentir sobre o que foi aprovado. Então uma
-- linha histórica com cifra continua legível pelo técnico responsável DAQUELE
-- chamado. Este é o tamanho exato do que sobra, e é o que o Davi decide.
SELECT 301, 'RESÍDUO: dessas, quantas continuam legíveis DEPOIS da S4 por alguém que não vê financeiro (o técnico do próprio chamado, ou qualquer um se o chamado está sem dono)',
       (SELECT count(*)::text
          FROM public.chamado_eventos e
          JOIN public.chamados c ON c.id = e.chamado_id
         WHERE e.descricao ~ '[0-9][.,][0-9]{2}([^0-9]|$)'
           AND (c.responsavel_id IS NULL
                OR NOT public.pode_ver_financeiro(c.responsavel_id)
                OR (c.aberto_por IS NOT NULL AND NOT public.pode_ver_financeiro(c.aberto_por)))),
       '(referência)'

UNION ALL
SELECT 302, 'RESÍDUO: quantas pessoas NÃO veem financeiro hoje, e destas quantas são gestor (o SAC) — o segundo fator do dano; com USING (true) era esta lista inteira, para TODA linha',
       ((SELECT count(*) FROM public.profiles p WHERE NOT public.pode_ver_financeiro(p.id))::text
        || ' pessoas, das quais ' ||
        (SELECT count(*) FROM public.profiles p
          WHERE public.is_gestor(p.id) AND NOT public.pode_ver_financeiro(p.id))::text
        || ' são SAC'),
       '(referência)'

) t ORDER BY t.ordem;

-- QUEM NÃO CASOU — as linhas com cifra, para o Davi olhar antes de decidir se
-- quer uma S5. Só leitura; nada aqui muda dado.
SELECT 'as linhas com cifra, para olhar' AS bloco,
       e.created_at, e.tipo, c.numero, c.natureza,
       left(e.descricao, 140) AS descricao
  FROM public.chamado_eventos e
  LEFT JOIN public.chamados c ON c.id = e.chamado_id
 WHERE e.descricao ~ '[0-9][.,][0-9]{2}([^0-9]|$)'
 ORDER BY e.created_at DESC
 LIMIT 200;

COMMIT;

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ DESFAZER                                                             ║
-- ╚══════════════════════════════════════════════════════════════════════╝
-- Volta ao estado de 03/09 às 18h, e o que volta junto, dito por extenso:
--   · `chamado_eventos_select` volta a `USING (true)` — e com ela volta o
--     `curl` que lê a linha do tempo de todo chamado da empresa;
--   · `chamado_eventos_insert` volta a aceitar comentário em chamado que o
--     autor não consegue ver;
--   · `aprovar_chamado_financeiro` volta ao corpo da U80: SEM gate de papel,
--     SEM trava de status, e lendo quatro colunas que não existem — ou seja,
--     42703 na primeira aprovação. **Não é rollback de rotina; é o defeito.**
--     Se o problema for só a policy, desfaça SÓ o segundo bloco.
-- Nenhuma tela quebra desfazendo as policies: elas só voltam a ser mais largas.
--
-- BEGIN;
--   DROP POLICY IF EXISTS "chamado_eventos_select" ON public.chamado_eventos;
--   CREATE POLICY "chamado_eventos_select" ON public.chamado_eventos
--     FOR SELECT TO authenticated USING (true);
--   DROP POLICY IF EXISTS "chamado_eventos_insert" ON public.chamado_eventos;
--   CREATE POLICY "chamado_eventos_insert" ON public.chamado_eventos
--     FOR INSERT TO authenticated
--     WITH CHECK (user_id = auth.uid() AND tipo = 'comentario');
--   -- e, se for MESMO para desfazer o motor, reaplique o §4b da U80
--   -- (20260903090000_u80_ciclo_financeiro_no_card.sql, linhas 564-608).
-- COMMIT;
-- ═══════════════════════════════════════════════════════════════════════════
