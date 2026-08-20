-- ═══════════════════════════════════════════════════════════════════════════
-- U13 — "EXECUTADO" E "CONCLUÍDO" VIRAM A MESMA COISA
-- ═══════════════════════════════════════════════════════════════════════════
-- >>> RODAR NO SQL EDITOR DA LOVABLE (Cloud → SQL editor). <<<
-- >>> Esta migration e o código novo vão JUNTOS: o app velho ainda escreve   <<<
-- >>> 'executado', que o CHECK novo recusa.                                  <<<
-- >>> Conferir o SELECT final: cada linha traz o valor esperado ao lado.     <<<
--
-- Regra ditada pelo Davi: "EXECUTADO e CONCLUIDO é a mesma coisa".
--
-- O QUE SE PERDE, E POR QUE NÃO SE PERDE DE VERDADE
-- Até aqui 'executado' era o portão da conferência: o técnico entregava, o
-- chamado ficava executado, e o gestor conferia antes de fechar — e era esse
-- estado que a fila "A conferir" lia. Fundindo os dois, essa fila precisaria
-- sumir junto.
--
-- Só que ela não some, porque o portão nunca dependeu do status: quem manda na
-- conferência é `faturamento_status`, e a U0 tomou essa decisão de propósito.
-- O comentário dela ainda está lá: "Deliberadamente FORA do CHECK de status: o
-- ciclo de campo (SLA, painel, policy) não pode depender do financeiro".
-- Então a fila de conferência passa a ser `faturamento_status = 'a_analisar'`,
-- que é mais fiel: um chamado sem nada a cobrar não deveria estar nela, e hoje
-- estava.
--
-- O que muda de comportamento, dito com todas as letras: quando o técnico
-- encerra o atendimento, o chamado JÁ FICA CONCLUÍDO. Não há mais um estado
-- intermediário em que o trabalho está feito mas o registro está aberto.

-- ═══════════════════════════════════════════════════════════════════════
-- 0) GUARD
-- ═══════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='chamados') THEN
    RAISE EXCEPTION 'A tabela chamados não existe — rode a U7 antes. Nada foi alterado.';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 1) OS REGISTROS
-- ═══════════════════════════════════════════════════════════════════════
-- Silencia os triggers: `chamado_registrar_evento` escreveria uma linha de
-- "Status: executado → concluido" em cada chamado, e `notify_chamado`
-- dispararia um aviso de "Chamado concluído" para cada responsável — dezenas
-- de notificações sobre trabalho que já estava entregue há semanas.
ALTER TABLE public.chamados DISABLE TRIGGER USER;

-- concluida_em/fechada_em: quem estava executado já tinha finalizada_em (o
-- carimbo de quando o técnico entregou). É a data certa para o encerramento —
-- inventar now() diria que tudo foi concluído hoje.
UPDATE public.chamados
SET status       = 'concluido',
    concluida_em = COALESCE(concluida_em, finalizada_em, updated_at, created_at),
    fechada_em   = COALESCE(fechada_em,   finalizada_em, updated_at, created_at)
WHERE status = 'executado';

ALTER TABLE public.chamados ENABLE TRIGGER USER;

ALTER TABLE public.chamados DROP CONSTRAINT IF EXISTS chamados_status_check;
ALTER TABLE public.chamados ADD CONSTRAINT chamados_status_check
  CHECK (status IN ('aberto','agendado','em_andamento','stand_by',
                    'aguardando_aprovacao','concluido','cancelado'));

-- ═══════════════════════════════════════════════════════════════════════
-- 2) AS FUNÇÕES QUE LIAM 'executado'
-- ═══════════════════════════════════════════════════════════════════════

-- 2.1 Aprovação da cobrança: agora basta estar concluído.
CREATE OR REPLACE FUNCTION public.aprovar_chamado_financeiro(_chamado_id uuid)
RETURNS TABLE (itens integer, total numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  v_data := COALESCE(v_ch.finalizada_em, v_ch.concluida_em, v_ch.created_at)::date;
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
               ELSE 'Cobrança aprovada: ' || v_itens || ' item(ns), total ' ||
                    to_char(v_total,'FM999G999G990D00') END, auth.uid());
  RETURN QUERY SELECT v_itens, v_total;
END;
$$;

-- 2.2 Aviso de chamado esperando análise: a fila passa a ser o faturamento.
--     Mais fiel que o status: chamado sem nada a cobrar sai da fila sozinho.
CREATE OR REPLACE FUNCTION public.alertas_chamado_faturamento(_dias int DEFAULT 2)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_envios int := 0;
BEGIN
  INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, chamado_id)
  SELECT p.id, 'chamado_sem_analise', 'Chamado esperando análise de cobrança',
         c.numero || ' · ' || COALESCE(cl.nome,'cliente') || ' — concluído há ' ||
         EXTRACT(DAY FROM now() - COALESCE(c.finalizada_em, c.concluida_em))::int::text || ' dias.', c.id
  FROM public.chamados c
  JOIN public.clientes cl ON cl.id = c.cliente_id
  CROSS JOIN public.profiles p
  WHERE c.natureza = 'campo' AND c.status = 'concluido'
    AND c.faturamento_status = 'a_analisar'
    AND COALESCE(c.finalizada_em, c.concluida_em) IS NOT NULL
    AND COALESCE(c.finalizada_em, c.concluida_em) < now() - make_interval(days => _dias)
    AND p.cargo IN ('admin','comercial') AND p.ativo IS DISTINCT FROM false
    AND p.status IS DISTINCT FROM 'rejeitado' AND p.status IS DISTINCT FROM 'pendente_aprovacao'
    AND NOT EXISTS (SELECT 1 FROM public.notificacoes n WHERE n.chamado_id = c.id
                    AND n.tipo = 'chamado_sem_analise' AND n.user_id = p.id
                    AND n.created_at > now() - interval '3 days');
  GET DIAGNOSTICS v_envios = ROW_COUNT;
  RETURN 'avisos: ' || v_envios;
END;
$$;

-- 2.3 Notificação de status: o aviso de "executado, confira" morre junto com o
--     estado. Quem conferia agora é avisado pelo alerta de faturamento acima.
CREATE OR REPLACE FUNCTION public.notify_chamado()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_resumo text;
  v_novo_resp boolean;
BEGIN
  v_resumo := NEW.numero || ' · ' || NEW.titulo;
  IF TG_OP = 'INSERT' THEN
    v_novo_resp := NEW.responsavel_id IS NOT NULL;
  ELSE
    v_novo_resp := NEW.responsavel_id IS NOT NULL
                   AND NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id;
  END IF;

  IF v_novo_resp AND NEW.responsavel_id IS DISTINCT FROM auth.uid() THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, chamado_id)
    VALUES (NEW.responsavel_id, 'chamado_atribuido',
            CASE WHEN NEW.prioridade = 'urgente' THEN 'Chamado URGENTE para você'
                 ELSE 'Novo chamado para você' END, v_resumo, NEW.id);
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'aguardando_aprovacao' THEN
      INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, chamado_id)
      SELECT p.id, 'chamado_aprovacao', 'Chamado aguardando aprovação', v_resumo, NEW.id
      FROM public.profiles p
      WHERE p.cargo IN ('admin','comercial') AND p.ativo IS DISTINCT FROM false
        AND p.status IS DISTINCT FROM 'rejeitado' AND p.status IS DISTINCT FROM 'pendente_aprovacao'
        AND p.id IS DISTINCT FROM auth.uid();
    ELSIF NEW.status = 'concluido' THEN
      IF NEW.responsavel_id IS NOT NULL AND NEW.responsavel_id IS DISTINCT FROM auth.uid() THEN
        INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, chamado_id)
        VALUES (NEW.responsavel_id, 'chamado_concluido', 'Chamado concluído', v_resumo, NEW.id);
      END IF;
      IF NEW.aberto_por IS NOT NULL AND NEW.aberto_por IS DISTINCT FROM auth.uid()
         AND NEW.aberto_por IS DISTINCT FROM NEW.responsavel_id THEN
        INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, chamado_id)
        VALUES (NEW.aberto_por, 'chamado_concluido', 'Chamado concluído', v_resumo, NEW.id);
      END IF;
      -- quem responde pelo financeiro precisa saber que entrou na fila de análise
      IF NEW.natureza = 'campo' AND NEW.faturamento_status = 'a_analisar' THEN
        INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, chamado_id)
        SELECT p.id, 'chamado_a_conferir', 'Chamado a conferir',
               v_resumo || ' — concluído, aguardando análise de cobrança.', NEW.id
        FROM public.profiles p
        WHERE p.cargo IN ('admin','comercial') AND p.ativo IS DISTINCT FROM false
          AND p.status IS DISTINCT FROM 'rejeitado' AND p.status IS DISTINCT FROM 'pendente_aprovacao'
          AND p.id IS DISTINCT FROM auth.uid();
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO
-- ═══════════════════════════════════════════════════════════════════════
SELECT 'nenhum chamado ficou em executado', count(*)::text, '0'
FROM public.chamados WHERE status = 'executado'
UNION ALL
SELECT 'o CHECK não aceita mais executado',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_constraint
         WHERE conname = 'chamados_status_check'
           AND pg_get_constraintdef(oid) NOT LIKE '%executado%')
       THEN 'sim' ELSE 'NAO' END, 'sim'
UNION ALL
SELECT 'todo concluído tem data de encerramento', count(*)::text, '0'
FROM public.chamados WHERE status = 'concluido' AND concluida_em IS NULL
UNION ALL
SELECT 'fila de conferência (campo concluído a analisar)', count(*)::text,
       '(é a nova fila "A conferir" — se for enorme, ver PLANO §U13)'
FROM public.chamados WHERE natureza='campo' AND status='concluido' AND faturamento_status='a_analisar'
UNION ALL
SELECT 'chamados por status',
       COALESCE((SELECT string_agg(status || '=' || n::text, ', ' ORDER BY status)
                 FROM (SELECT status, count(*) n FROM public.chamados GROUP BY 1) t), '(vazio)'),
       '(sem executado)';
