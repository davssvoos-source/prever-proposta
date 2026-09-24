-- ═══════════════════════════════════════════════════════════════════════
-- U159 — OS AVISOS AUTOMÁTICOS VÃO SÓ PARA O ADMINISTRADOR (R312, P73)
-- 2026-09-23 · v1.0.3
-- ═══════════════════════════════════════════════════════════════════════
--
-- Davi, 23/09/2026, sobre quem recebe os avisos automáticos: "Somente o
-- administrador."
--
-- As listas de destinatários das funções da U7 e da U13 enumeravam
-- `admin/comercial/sac` (ou `admin/comercial`) à mão — a P73 registrou que o
-- cargo GESTOR (R304) nunca entrou nelas. A decisão do Davi resolve a pendência
-- pelo outro lado: em vez de ampliar a lista, ela encolhe para `admin`.
--
-- O que muda (e só isso):
--   · notify_chamado (U13)           — "Chamado aguardando aprovação" e
--                                      "Chamado a conferir": só admin
--   · alertas_chamados (U7)          — "Chamado atrasado": responsável + admin
--   · alertas_chamado_faturamento    — "Chamado esperando análise": só admin
-- O que NÃO muda: o responsável continua avisado do que é dele (atribuição,
-- conclusão, prazo, parado) e quem abriu continua sabendo da conclusão. Os
-- corpos das funções são os da U13/U7, copiados — a única diferença é a lista.
--
-- Idempotente (CREATE OR REPLACE). Nenhuma tabela, nenhuma policy.
-- ═══════════════════════════════════════════════════════════════════════

-- ── PRÉ-VOO: quem recebe hoje × quem vai receber ───────────────────────
SELECT 'pessoas ativas que recebiam os avisos (admin/comercial/sac)' AS o_que,
       count(*)::text AS obtido
  FROM public.profiles p
 WHERE p.cargo IN ('admin','comercial','sac') AND p.ativo IS DISTINCT FROM false
   AND p.status IS DISTINCT FROM 'rejeitado' AND p.status IS DISTINCT FROM 'pendente_aprovacao'
UNION ALL
SELECT 'pessoas ativas que vao receber (admin)',
       count(*)::text
  FROM public.profiles p
 WHERE p.cargo = 'admin' AND p.ativo IS DISTINCT FROM false
   AND p.status IS DISTINCT FROM 'rejeitado' AND p.status IS DISTINCT FROM 'pendente_aprovacao';

-- ── 1) notify_chamado — o corpo da U13, com as duas listas em `admin` ──
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
      -- R312: só o administrador
      INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, chamado_id)
      SELECT p.id, 'chamado_aprovacao', 'Chamado aguardando aprovação', v_resumo, NEW.id
      FROM public.profiles p
      WHERE p.cargo = 'admin' AND p.ativo IS DISTINCT FROM false
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
      -- R312: só o administrador
      IF NEW.natureza = 'campo' AND NEW.faturamento_status = 'a_analisar' THEN
        INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, chamado_id)
        SELECT p.id, 'chamado_a_conferir', 'Chamado a conferir',
               v_resumo || ' — concluído, aguardando análise de cobrança.', NEW.id
        FROM public.profiles p
        WHERE p.cargo = 'admin' AND p.ativo IS DISTINCT FROM false
          AND p.status IS DISTINCT FROM 'rejeitado' AND p.status IS DISTINCT FROM 'pendente_aprovacao'
          AND p.id IS DISTINCT FROM auth.uid();
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ── 2) alertas_chamados — o corpo da U7, "atrasado" para responsável + admin ──
CREATE OR REPLACE FUNCTION public.alertas_chamados(_dias_parada int DEFAULT 7)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_vence int := 0; v_venceu int := 0; v_parada int := 0;
BEGIN
  INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, chamado_id)
  SELECT c.responsavel_id, 'chamado_prazo', 'Prazo vence amanhã', c.numero || ' · ' || c.titulo, c.id
  FROM public.chamados c
  WHERE c.responsavel_id IS NOT NULL AND c.status NOT IN ('concluido','cancelado')
    AND c.prazo_limite::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date + 1
    AND NOT EXISTS (SELECT 1 FROM public.notificacoes n WHERE n.chamado_id = c.id
                    AND n.tipo = 'chamado_prazo' AND n.created_at > now() - interval '20 hours');
  GET DIAGNOSTICS v_vence = ROW_COUNT;

  -- R312: só o administrador (além do responsável)
  INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, chamado_id)
  SELECT alvo, 'chamado_atrasado', 'Chamado atrasado', c.numero || ' · ' || c.titulo, c.id
  FROM public.chamados c
  CROSS JOIN LATERAL (
    SELECT c.responsavel_id AS alvo
    UNION SELECT p.id FROM public.profiles p
    WHERE p.cargo = 'admin' AND p.ativo IS DISTINCT FROM false
      AND p.status IS DISTINCT FROM 'rejeitado' AND p.status IS DISTINCT FROM 'pendente_aprovacao'
  ) alvos
  WHERE alvo IS NOT NULL AND c.status NOT IN ('concluido','cancelado')
    AND c.prazo_limite < now()
    AND NOT EXISTS (SELECT 1 FROM public.notificacoes n WHERE n.chamado_id = c.id
                    AND n.tipo = 'chamado_atrasado' AND n.user_id = alvo
                    AND n.created_at > now() - interval '20 hours');
  GET DIAGNOSTICS v_venceu = ROW_COUNT;

  INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, chamado_id)
  SELECT c.responsavel_id, 'chamado_parado', 'Chamado parado',
         c.numero || ' · ' || c.titulo || ' — sem atualização há ' ||
         EXTRACT(DAY FROM now() - c.updated_at)::int::text || ' dias.', c.id
  FROM public.chamados c
  WHERE c.responsavel_id IS NOT NULL AND c.status IN ('em_andamento','stand_by')
    AND c.updated_at < now() - make_interval(days => _dias_parada)
    AND NOT EXISTS (SELECT 1 FROM public.notificacoes n WHERE n.chamado_id = c.id
                    AND n.tipo = 'chamado_parado' AND n.created_at > now() - interval '6 days');
  GET DIAGNOSTICS v_parada = ROW_COUNT;
  RETURN 'vence amanha: ' || v_vence || ' | atrasados: ' || v_venceu || ' | parados: ' || v_parada;
END;
$$;

-- ── 3) alertas_chamado_faturamento — o corpo da U7, só admin ───────────
CREATE OR REPLACE FUNCTION public.alertas_chamado_faturamento(_dias int DEFAULT 2)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_envios int := 0;
BEGIN
  -- R312: só o administrador
  INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, chamado_id)
  SELECT p.id, 'chamado_sem_analise', 'Chamado esperando análise de cobrança',
         c.numero || ' · ' || COALESCE(cl.nome,'cliente') || ' — executado há ' ||
         EXTRACT(DAY FROM now() - c.finalizada_em)::int::text || ' dias.', c.id
  FROM public.chamados c
  JOIN public.clientes cl ON cl.id = c.cliente_id
  CROSS JOIN public.profiles p
  WHERE c.natureza = 'campo' AND c.status = 'executado'
    AND c.faturamento_status = 'a_analisar' AND c.finalizada_em IS NOT NULL
    AND c.finalizada_em < now() - make_interval(days => _dias)
    AND p.cargo = 'admin' AND p.ativo IS DISTINCT FROM false
    AND p.status IS DISTINCT FROM 'rejeitado' AND p.status IS DISTINCT FROM 'pendente_aprovacao'
    AND NOT EXISTS (SELECT 1 FROM public.notificacoes n WHERE n.chamado_id = c.id
                    AND n.tipo = 'chamado_sem_analise' AND n.user_id = p.id
                    AND n.created_at > now() - interval '3 days');
  GET DIAGNOSTICS v_envios = ROW_COUNT;
  RETURN 'avisos: ' || v_envios;
END;
$$;

-- ── CONFERÊNCIA: obtido × esperado × veredito ──────────────────────────
SELECT o_que, obtido, esperado,
       CASE WHEN obtido = esperado THEN 'OK' ELSE 'VERIFICAR' END AS veredito
FROM (
  SELECT 'notify_chamado: nenhuma lista cita comercial ou sac' AS o_que,
         CASE WHEN pg_get_functiondef('public.notify_chamado()'::regprocedure) LIKE '%''comercial''%'
                OR pg_get_functiondef('public.notify_chamado()'::regprocedure) LIKE '%''sac''%'
              THEN 'ainda cita' ELSE 'so admin' END AS obtido,
         'so admin' AS esperado
  UNION ALL
  SELECT 'alertas_chamados: nenhuma lista cita comercial ou sac',
         CASE WHEN pg_get_functiondef('public.alertas_chamados(int)'::regprocedure) LIKE '%''comercial''%'
                OR pg_get_functiondef('public.alertas_chamados(int)'::regprocedure) LIKE '%''sac''%'
              THEN 'ainda cita' ELSE 'so admin' END,
         'so admin'
  UNION ALL
  SELECT 'alertas_chamado_faturamento: nenhuma lista cita comercial',
         CASE WHEN pg_get_functiondef('public.alertas_chamado_faturamento(int)'::regprocedure) LIKE '%''comercial''%'
              THEN 'ainda cita' ELSE 'so admin' END,
         'so admin'
  UNION ALL
  SELECT 'as tres funcoes listam cargo = admin',
         (SELECT count(*) FROM pg_proc pr JOIN pg_namespace ns ON ns.oid = pr.pronamespace
           WHERE ns.nspname = 'public'
             AND pr.proname IN ('notify_chamado','alertas_chamados','alertas_chamado_faturamento')
             AND pg_get_functiondef(pr.oid) LIKE '%p.cargo = ''admin''%')::text,
         '3'
  UNION ALL
  SELECT 'o gatilho de notify_chamado continua ligado em chamados',
         (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
           WHERE c.relname = 'chamados' AND NOT t.tgisinternal
             AND t.tgfoid = 'public.notify_chamado()'::regprocedure)::text,
         '1'
) c;

-- ── DESFAZER (se precisar) ─────────────────────────────────────────────
-- Rode de novo o bloco "CREATE OR REPLACE FUNCTION public.notify_chamado()" da
-- migration 20260820100000_u13_executado_vira_concluido.sql e os blocos
-- "alertas_chamados" e "alertas_chamado_faturamento" da
-- 20260819120000_u7_fusao_chamados.sql — os corpos são estes, com as listas
-- em ('admin','comercial','sac') / ('admin','comercial').
