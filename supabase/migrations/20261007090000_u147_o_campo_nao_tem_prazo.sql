-- ═══════════════════════════════════════════════════════════════════════════
-- U147 — O CHAMADO DE CAMPO NÃO TEM MAIS PRAZO AUTOMÁTICO (R284)
--
-- Davi, 14/09/2026: "Não precisa ter o campo de prazo, podemos trabalhar
-- somente com Data agendada com o sistema de contar a quantidade de vezes em
-- que foi remarcada." E, sobre o SLA automático: "na verdade o gestor ou SAC
-- vai agendar a atividade de acordo com a prioridade. Se a prioridade for
-- baixa, alta ou urgente ele vai adaptar a data agendada de acordo com isso."
--
-- ── O QUE SAI, E POR QUÊ ───────────────────────────────────────────────────
-- Dois ramos do gatilho `chamado_preencher()`:
--
--   1. no INSERT, o prazo que nascia do SLA por prioridade (`chamado_sla`:
--      urgente 4h · alta 24h · normal 72h);
--   2. no UPDATE, o "escalar prioridade aperta o prazo".
--
-- Os dois produziam um NÚMERO QUE NINGUÉM USAVA PARA DECIDIR. Quem decide
-- quando a equipe vai é gente — o SAC ou o gestor —, e a prioridade é o que
-- orienta essa escolha. Um prazo que o sistema calcula sozinho e que nenhuma
-- decisão consulta é número que envelhece em silêncio: ele pinta card de
-- vermelho, entra em contador de "atrasados" e não corresponde a promessa
-- nenhuma que alguém tenha feito ao cliente.
--
-- ── O QUE FICA, E ISSO É DECISÃO ───────────────────────────────────────────
-- O prazo da IMPLANTAÇÃO fica. Ele não vem do SLA: é o ESPELHO de
-- `implantacao_fim`, uma data que uma pessoa escolheu ao planejar a obra
-- (R89/U89). A R284 derruba "o número que o sistema calcula sozinho", não "a
-- data que alguém marcou" — e tirar o espelho quebraria o cronograma da obra
-- sem que ninguém tenha pedido.
--
-- ── O QUE ESTA MIGRATION NÃO FAZ, E É DE PROPÓSITO ─────────────────────────
-- NÃO limpa os prazos que já existem. Medido antes de decidir: os 5 chamados
-- de campo da base têm prazo e NENHUM tem data agendada — o prazo é a única
-- data que eles têm, e é por ela que aparecem no calendário. Apagá-lo os faria
-- sumir da tela de quem trabalha com eles hoje. O que já foi prometido fica
-- registrado; o que nasce daqui em diante não inventa promessa.
--
-- ── A CONSEQUÊNCIA VISÍVEL, DECLARADA ──────────────────────────────────────
-- Um chamado de campo criado SEM agendar passa a não ter data nenhuma. Ele
-- some do calendário (que mostra o que tem dia) e vive na coluna "não
-- agendado" do quadro, que é onde a R76 já dizia que ele deveria estar.
-- AGENDAR PASSA A FAZER PARTE DE ABRIR. A tela de abertura acompanha esta
-- migration pedindo a data e mostrando a prioridade ao lado para orientar.
--
-- IDEMPOTENTE: CREATE OR REPLACE na função, sem DDL de tabela e sem escrita de
-- dado. Rodar duas vezes é o mesmo que rodar uma.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §0  PRÉ-VOO ────────────────────────────────────────────────────────────
DO $u147pre$
BEGIN
  IF to_regprocedure('public.chamado_preencher()') IS NULL THEN
    RAISE EXCEPTION 'U147 PRÉ-VOO: `chamado_preencher()` não existe — a U7 não rodou.';
  END IF;
  -- A U89 é a dona do corpo vivo. Se a marca dela não estiver lá, este arquivo
  -- está prestes a sobrescrever uma versão que não é a que eu li — e o
  -- espelho de `implantacao_fim` sumiria junto, calado.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'chamado_preencher'
       AND prosrc LIKE '%implantacao_fim IS DISTINCT FROM OLD.implantacao_fim%'
  ) THEN
    RAISE EXCEPTION E'ABORTADO NO PRÉ-VOO — nada foi alterado (ROLLBACK).\nO corpo vivo de `chamado_preencher()` não é o da U89: falta o espelho de `implantacao_fim`.\nSubstituí-lo por este levaria junto o cronograma da obra. Confira quem reescreveu a função antes de continuar.';
  END IF;
  IF to_regclass('public.chamado_sla') IS NULL THEN
    RAISE EXCEPTION 'U147 PRÉ-VOO: `chamado_sla` não existe — este não é o banco do Prever.';
  END IF;
END
$u147pre$;

-- ── §1  O GATILHO SEM O SLA ────────────────────────────────────────────────
-- Corpo da U89 preservado linha por linha, com DUAS remoções e nada mais.
-- `v_horas` saiu do DECLARE junto: com os dois ramos fora, ela não é lida em
-- lugar nenhum, e variável que sobra é a próxima pessoa perguntando "para que
-- serve isto?" sem resposta.
CREATE OR REPLACE FUNCTION public.chamado_preencher()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $u147$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.numero IS NULL OR NEW.numero = '' THEN
      NEW.numero := public.proximo_numero_chamado();
    END IF;
    IF NEW.tipo IS NULL THEN
      NEW.tipo := CASE WHEN NEW.natureza = 'campo' THEN 'corretiva'
                       ELSE public.sugerir_tipo_chamado(NEW.titulo, NEW.descricao_problema) END;
    END IF;
    -- ══ R284 (U147): O PRAZO DE SLA SAIU DAQUI ═══════════════════════════
    -- Morava aqui o ramo que dava ao chamado de campo um prazo calculado da
    -- prioridade (`chamado_sla`: urgente 4h · alta 24h · normal 72h). Ele
    -- produzia um número que NINGUÉM usava para decidir: quem diz quando a
    -- equipe vai é o SAC ou o gestor, ao agendar, e a prioridade é o que
    -- orienta essa escolha. O número sozinho pintava card de vermelho e
    -- entrava em contador de "atrasados" sem corresponder a promessa alguma.
    -- A tabela `chamado_sla` FICA: ela continua sendo a referência de "para
    -- quando isto deveria ir", e é dela que a tela de abertura tira a
    -- sugestão que mostra ao lado da prioridade.
    -- ═════════════════════════════════════════════════════════════════════
    -- U89 (2 de 3): implantação que já NASCE com período leva o fim como prazo.
    -- FICA, e não é exceção à R284: este prazo não é calculado pelo sistema —
    -- é o ESPELHO de uma data que alguém escolheu ao planejar a obra.
    IF NEW.tipo = 'implantacao'
       AND NEW.implantacao_fim IS NOT NULL
       AND NEW.prazo_limite IS NULL THEN
      NEW.prazo_limite := ((NEW.implantacao_fim + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo');
    END IF;
    IF NEW.natureza = 'campo' THEN
      IF NEW.tipo_servico IS NULL THEN
        NEW.tipo_servico := CASE WHEN NEW.tipo = 'implantacao' THEN 'instalacao' ELSE 'manutencao' END;
      END IF;
      IF NEW.contrato_id IS NULL AND NEW.cliente_id IS NOT NULL THEN
        NEW.contrato_id := public.contrato_vigente(NEW.cliente_id);
      END IF;
    ELSE
      -- interno entra no sprint do mês quando ninguém disse outra coisa
      IF NEW.sprint IS NULL THEN NEW.sprint := 'este_mes'; END IF;
    END IF;
    IF NEW.status = 'em_andamento' AND NEW.iniciada_em IS NULL THEN NEW.iniciada_em := now(); END IF;
    IF NEW.status = 'concluido'   AND NEW.concluida_em IS NULL THEN NEW.concluida_em := now(); END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'em_andamento' AND NEW.iniciada_em IS NULL THEN NEW.iniciada_em := now(); END IF;
    IF NEW.status = 'concluido' THEN
      NEW.concluida_em := COALESCE(NEW.concluida_em, now());
      IF NEW.natureza = 'campo' THEN NEW.fechada_em := COALESCE(NEW.fechada_em, now()); END IF;
    ELSIF OLD.status = 'concluido' THEN
      NEW.concluida_em := NULL; NEW.fechada_em := NULL;   -- reabriu
    END IF;
  END IF;
  -- ══ R284 (U147): "ESCALAR PRIORIDADE APERTA O PRAZO" SAIU ═══════════════
  -- Era o gêmeo do ramo do INSERT, no UPDATE. Sem prazo de SLA para apertar,
  -- ele não tem o que fazer — e mantê-lo faria a prioridade REESCREVER um
  -- prazo que hoje só existe quando alguém o digitou à mão.
  -- ═══════════════════════════════════════════════════════════════════════
  -- U89 (3 de 3, segunda metade): O ESPELHO. Mudou o fim previsto, mudou o
  -- prazo. Vale também quando o fim vira NULL (apagaram o período): o prazo
  -- some junto, e "sem prazo" volta a ser a verdade.
  -- O fim é uma DATA; o prazo é um INSTANTE. A obra está no prazo até o
  -- ÚLTIMO minuto do dia previsto, então o instante é a meia-noite do dia
  -- SEGUINTE, em São Paulo — nunca 00:00 do próprio dia, que roubaria 24h.
  IF NEW.tipo = 'implantacao'
     AND NEW.implantacao_fim IS DISTINCT FROM OLD.implantacao_fim THEN
    NEW.prazo_limite := CASE
      WHEN NEW.implantacao_fim IS NULL THEN NULL
      ELSE ((NEW.implantacao_fim + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
    END;
  END IF;
  RETURN NEW;
END;
$u147$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- §2  CONFERÊNCIA — olhe a coluna VEREDITO
-- ═══════════════════════════════════════════════════════════════════════════
WITH conferencia AS (

  SELECT 1 AS n, 'o SLA saiu do corpo vivo (nenhuma leitura de chamado_sla)' AS o_que,
         (SELECT (prosrc LIKE '%chamado_sla%')::text
            FROM pg_proc WHERE proname = 'chamado_preencher') AS obtido, 'false' AS esperado
  UNION ALL
  SELECT 2, 'o espelho da implantação CONTINUA (o cronograma da obra não foi junto)',
         (SELECT (prosrc LIKE '%implantacao_fim IS DISTINCT FROM OLD.implantacao_fim%')::text
            FROM pg_proc WHERE proname = 'chamado_preencher'), 'true'
  UNION ALL
  SELECT 3, 'a numeração e o tipo padrão continuam sendo preenchidos',
         (SELECT (prosrc LIKE '%proximo_numero_chamado%' AND prosrc LIKE '%sugerir_tipo_chamado%')::text
            FROM pg_proc WHERE proname = 'chamado_preencher'), 'true'
  UNION ALL
  SELECT 4, 'o carimbo de início e conclusão continua',
         (SELECT (prosrc LIKE '%iniciada_em := now()%' AND prosrc LIKE '%fechada_em%')::text
            FROM pg_proc WHERE proname = 'chamado_preencher'), 'true'
  UNION ALL
  SELECT 5, 'a tabela chamado_sla FICA (é a referência da sugestão na abertura)',
         (to_regclass('public.chamado_sla') IS NOT NULL)::text, 'true'
  UNION ALL
  SELECT 6, 'os prazos que já existiam NÃO foram apagados',
         (SELECT count(*)::text FROM public.chamados
           WHERE natureza = 'campo' AND prazo_limite IS NOT NULL),
         '(o mesmo número de antes — esta migration não escreve dado)'
  UNION ALL
  SELECT 7, 'chamados de campo SEM data nenhuma (ficam fora do calendário, na coluna não agendado)',
         (SELECT count(*)::text FROM public.chamados
           WHERE natureza = 'campo' AND prazo_limite IS NULL
             AND data_agendada IS NULL AND data_hora_agendada IS NULL),
         '(informativo — daqui em diante é o estado normal de quem ainda não foi agendado)'

)
SELECT n, o_que, obtido, esperado,
       CASE WHEN esperado LIKE '(%' THEN 'leia'
            WHEN obtido IS NOT DISTINCT FROM esperado THEN 'ok'
            ELSE '>>> OLHAR <<<' END AS veredito
  FROM conferencia ORDER BY n;

-- ═══════════════════════════════════════════════════════════════════════════
-- §3  O PORTÃO — prova que o prazo não nasce mais, e desfaz sozinho
-- ═══════════════════════════════════════════════════════════════════════════
COMMIT;

BEGIN;

DO $u147portao$
DECLARE
  v_id    uuid;
  v_prazo timestamptz;
BEGIN
  INSERT INTO public.chamados (titulo, natureza, tipo, prioridade, status)
  VALUES ('__portao_u147', 'campo', 'corretiva', 'urgente', 'aberto')
  RETURNING id, prazo_limite INTO v_id, v_prazo;

  IF v_prazo IS NOT NULL THEN
    RAISE EXCEPTION 'PORTÃO FALHOU: o chamado de campo urgente NASCEU com prazo % — o SLA continua no corpo vivo.', v_prazo;
  END IF;
  RAISE NOTICE 'PORTÃO 1 ok: chamado de campo URGENTE nasce sem prazo.';

  -- e escalar a prioridade não inventa um
  UPDATE public.chamados SET prioridade = 'alta' WHERE id = v_id;
  SELECT prazo_limite INTO v_prazo FROM public.chamados WHERE id = v_id;
  IF v_prazo IS NOT NULL THEN
    RAISE EXCEPTION 'PORTÃO FALHOU: mudar a prioridade inventou um prazo (%).', v_prazo;
  END IF;
  RAISE NOTICE 'PORTÃO 2 ok: escalar a prioridade não inventa prazo.';

  RAISE NOTICE 'PORTÃO COMPLETO. Nada disto foi gravado (ROLLBACK a seguir).';
END
$u147portao$;

ROLLBACK;

-- ═══════════════════════════════════════════════════════════════════════════
-- §4  DESFAZER (só se precisar)
--
-- Recrie `chamado_preencher()` com o corpo da U89
-- (`20260911090000_u89_implantacao_com_periodo.sql`, linhas 336–423), que traz
-- os dois ramos do SLA de volta. O gatilho não muda: ele já escuta status,
-- prioridade e implantacao_fim.
-- ═══════════════════════════════════════════════════════════════════════════
