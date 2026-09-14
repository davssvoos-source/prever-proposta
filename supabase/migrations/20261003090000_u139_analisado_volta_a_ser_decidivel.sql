-- ═══════════════════════════════════════════════════════════════════════════
-- U139 — O CHAMADO ANALISADO VOLTA A SER DECIDÍVEL (P20)
--
-- A revisão completa de 13/09/2026 achou o buraco negro: `analisarCobranca`
-- grava `faturamento_status = 'em_conferencia'` logo depois de salvar a análise
-- da I.A., e TODOS os caminhos de decisão exigiam `a_analisar`. Ou seja:
-- **analisar fechava o caminho de aprovar**. O chamado saía da fila do
-- financeiro, o card de Conferência do gestor sumia, o botão "Aprovar
-- cobrança" sumia — e o dinheiro ficava lá dentro, sem ninguém para decidir.
--
-- A U80 já tinha visto METADE disto. O item 113 da conferência dela conta os
-- "chamados de campo CONCLUÍDOS parados em em_conferencia — analisados e nunca
-- aprovados, hoje invisíveis para toda a operação", e os painéis passaram a
-- somá-los como pendentes (`FATURAMENTO_PENDENTE`). Ela consertou a CONTAGEM.
-- A DECISÃO ficou trancada mais dez dias.
--
-- O que esta migration faz: UMA linha do gate de
-- `concluir_chamado_com_cobranca`. A trava da duplicata continua inteira — o
-- que ela protege são os três estados DECIDIDOS (`aprovada`, `faturada`,
-- `sem_cobranca`) —, e `em_conferencia` passa a ser tratado pelo que é:
-- ninguém decidiu ainda.
--
-- A outra porta, `aprovar_chamado_financeiro`, NUNCA olhou o
-- `faturamento_status` (só exige concluído e sem item em revisão), então ela já
-- aceitava — o que faltava era a tela deixar chegar até lá. Isso é código, e
-- foi junto na mesma entrega (a regra virou `podeDecidirCobranca`, em
-- `features/chamados/cobranca.ts`).
--
-- IDEMPOTENTE: CREATE OR REPLACE. Exige a U80.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §0  PRÉ-VOO ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regprocedure('public.concluir_chamado_com_cobranca(uuid, text, text, numeric, numeric[], text)') IS NULL THEN
    RAISE EXCEPTION 'U139 PRÉ-VOO: `concluir_chamado_com_cobranca` não existe — rode a U80 antes desta.';
  END IF;
END
$$;

-- ── §1  A PORTA, COM O GATE CERTO ──────────────────────────────────────────
-- O corpo abaixo é o da U80, byte a byte, com UMA linha trocada (o IF do §5).
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
AS $u139a$
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
  --    A trava existe contra decidir DUAS VEZES — e decidir é o que deixa o
  --    chamado em `aprovada`, `faturada` ou `sem_cobranca`. Os outros dois
  --    estados são "ninguém decidiu ainda": `a_analisar`, onde ele nasce, e
  --    `em_conferencia`, onde a I.A. o deixa depois de analisar.
  --
  --    ATÉ A U139 ESTE GATE EXIGIA `a_analisar`, E ERA UM BURACO NEGRO (P20):
  --    `analisarCobranca` grava `em_conferencia` logo depois de salvar a
  --    análise, então ANALISAR fechava o caminho de decidir — aqui e nos três
  --    gates da tela. O chamado sumia da operação com dinheiro dentro. A
  --    própria U80 media esses presos no item 113 da conferência dela e os
  --    chamava de "hoje invisíveis para toda a operação": ela consertou a
  --    contagem, não a decisão.
  --
  --    O cadeado continua serializando: o segundo gestor lê `aprovada` porque
  --    o primeiro já commitou (EvalPlanQual reavalia a versão nova depois do
  --    commit do bloqueador).
  IF _decisao <> 'conferir_depois' AND v_ch.faturamento_status NOT IN ('a_analisar', 'em_conferencia') THEN
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
    -- OS PARÊNTESES SÃO OBRIGATÓRIOS, e não estilo: o plpgsql delimita a
    -- condição de um IF procurando a palavra THEN no nível zero de parênteses.
    -- Um CASE nu põe um THEN nesse nível, a condição é cortada em
    -- "v_tipo = 'instalacao'" e o resto do corpo derrapa — o Postgres devolve
    -- "syntax error at end of input" apontando para esta linha, que está certa.
    IF v_n > (CASE WHEN v_tipo = 'instalacao' THEN 60 ELSE 12 END) THEN
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
$u139a$;
COMMIT;

-- ── §2  CONFERÊNCIA ────────────────────────────────────────────────────────
WITH conferencia AS (
  SELECT 1 AS n, 'a porta aceita em_conferencia' AS o_que,
         (pg_get_functiondef('public.concluir_chamado_com_cobranca(uuid, text, text, numeric, numeric[], text)'::regprocedure)
           LIKE '%NOT IN (''a_analisar'', ''em_conferencia'')%')::text AS obtido, 'true' AS esperado
  UNION ALL SELECT 2, 'e NÃO aceita mais um chamado já decidido',
         (pg_get_functiondef('public.concluir_chamado_com_cobranca(uuid, text, text, numeric, numeric[], text)'::regprocedure)
           LIKE '%já teve a cobrança decidida%')::text, 'true'
  UNION ALL SELECT 3, 'o cadeado da duplicata continua no corpo',
         (pg_get_functiondef('public.concluir_chamado_com_cobranca(uuid, text, text, numeric, numeric[], text)'::regprocedure)
           LIKE '%FOR UPDATE%')::text, 'true'
  UNION ALL SELECT 4, 'chamados que estavam presos em em_conferencia (voltam a ser decidíveis agora)',
         (SELECT count(*)::text FROM public.chamados
           WHERE natureza = 'campo' AND status = 'concluido' AND faturamento_status = 'em_conferencia'), '>>> LEIA <<<'
  UNION ALL SELECT 5, 'e quanto há de cobrança aberta esperando decisão neles',
         (SELECT COALESCE(to_char(sum(c.valor), 'FM999G999D00'), '(nenhuma)')
            FROM public.cobrancas c
            JOIN public.chamados ch ON ch.id = c.chamado_id
           WHERE ch.faturamento_status = 'em_conferencia' AND c.status = 'aberta'), '>>> LEIA <<<'
)
SELECT n, o_que, obtido, esperado,
       CASE WHEN esperado = '>>> LEIA <<<' THEN 'leia'
            WHEN obtido IS NOT DISTINCT FROM esperado THEN 'ok' ELSE '>>> OLHAR <<<' END AS veredito
FROM conferencia ORDER BY n;

-- ═══════════════════════════════════════════════════════════════════════════
-- DESFAZER
--   Volta o gate ao que era (e o buraco negro junto): rode a U80 de novo, que
--   é idempotente e recria esta função com `<> 'a_analisar'`.
-- ═══════════════════════════════════════════════════════════════════════════
