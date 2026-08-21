-- ═══════════════════════════════════════════════════════════════════════════
-- U38 — O FLUXO DA PROPOSTA ACABA NO ENVIO (R38, 2026-08-22)
--
-- Antes: aprovada → proposta enviada → "aguardando resposta do cliente" →
-- aceita/recusada, com dois botões na tela da visita para registrar o que o
-- cliente decidiu. O Davi cortou a segunda metade: "o restante acontece
-- somente fora do app". Enviar a proposta agora É o fim do fluxo — a
-- atividade fecha sozinha, direto para "concluído".
--
-- O QUE ESTA MIGRATION FAZ:
--   1. Reescreve `sincronizar_chamado_da_visita()` para refletir a regra
--      nova: proposta enviada (sem recusa registrada) já é concluído — não
--      existe mais o estado intermediário "aguardando_aprovacao com bola no
--      cliente". A distinção aceita/recusada só sobrevive para quem JÁ tinha
--      resultado gravado antes desta mudança (histórico real, não descartado).
--   2. Corrige o TÍTULO da capa: sempre "Proposta Comercial", nunca o nome do
--      prédio. O trigger antigo usava `COALESCE(NEW.titulo, NEW.nome_predio,
--      'Proposta comercial')` — quase toda visita tem um dos dois preenchido,
--      então a capa quase sempre nascia com o nome do condomínio no título,
--      e o card duplicava essa informação (título E etiqueta de local
--      mostrando a mesma coisa).
--   3. BACKFILL: visitas que JÁ estão presas no estado antigo — aprovada,
--      proposta enviada, sem resultado — têm a capa corrigida na hora, para
--      o card parar de mostrar "Proposta com o cliente · com o cliente" (o
--      defeito visual que motivou o Davi a mandar o print).
--
-- NÃO MEXE em `registrar_resultado_proposta` nem nas colunas
-- proposta_resultado/proposta_resultado_em: a função continua existindo (uma
-- visita com resultado já registrado precisa continuar sendo lida
-- corretamente), só não tem mais botão nenhum que a chame.
--
-- Idempotente. Ao final, um SELECT de verificação.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.sincronizar_chamado_da_visita()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE novo_status text;
BEGIN
  novo_status := CASE
    -- recusa registrada (só ocorre em visita de antes da R38): fica cancelada
    WHEN lower(COALESCE(NEW.status, '')) = 'aprovada' AND NEW.proposta_resultado = 'recusada' THEN 'cancelado'
    -- proposta enviada — com ou sem resultado 'aceita'/'aguardando' — é o fim
    -- do fluxo: concluído. Era aqui que existia o estado "aguardando_aprovacao
    -- com bola no cliente"; ele não existe mais.
    WHEN lower(COALESCE(NEW.status, '')) = 'aprovada' AND NEW.proposta_enviada_em IS NOT NULL  THEN 'concluido'
    WHEN lower(COALESCE(NEW.status, '')) = 'aprovada'                                          THEN 'aguardando_aprovacao'
    WHEN lower(COALESCE(NEW.status, '')) IN ('aguardando_aprovacao', 'concluida')              THEN 'aguardando_aprovacao'
    WHEN lower(COALESCE(NEW.status, '')) IN ('reprovada', 'cancelada')                         THEN 'aberto'
    WHEN lower(COALESCE(NEW.status, '')) = 'em_andamento'                                      THEN 'em_andamento'
    WHEN NEW.data_hora_agendada IS NOT NULL                                                    THEN 'agendado'
    ELSE 'aberto'
  END;

  -- INSERT de visita nova: cria a capa. UPDATE: mantém em dia.
  INSERT INTO public.chamados (
    id, natureza, tipo, titulo, descricao_problema,
    cliente_id, responsavel_id, status, prioridade,
    data_hora_agendada, aberto_por, created_at, updated_at
  ) VALUES (
    -- título FIXO — nunca o nome do prédio (ver item 2 do cabeçalho)
    NEW.id, 'comercial', 'proposta_comercial', 'Proposta Comercial',
    NEW.descricao_pedido, NEW.cliente_id, NEW.tecnico_id, novo_status,
    COALESCE(NULLIF(NEW.prioridade, ''), 'normal'),
    NEW.data_hora_agendada, NEW.created_by, NEW.created_at,
    COALESCE(NEW.updated_at, NEW.created_at)
  )
  ON CONFLICT (id) DO UPDATE SET
    titulo             = EXCLUDED.titulo,
    descricao_problema = EXCLUDED.descricao_problema,
    cliente_id         = EXCLUDED.cliente_id,
    responsavel_id     = EXCLUDED.responsavel_id,
    status             = EXCLUDED.status,
    data_hora_agendada = EXCLUDED.data_hora_agendada,
    updated_at         = now();

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sincronizar_chamado_da_visita ON public.visitas_tecnicas;
CREATE TRIGGER trg_sincronizar_chamado_da_visita
  AFTER INSERT OR UPDATE OF status, proposta_resultado, proposta_enviada_em,
                            data_hora_agendada, titulo, nome_predio,
                            cliente_id, tecnico_id, prioridade
  ON public.visitas_tecnicas
  FOR EACH ROW EXECUTE FUNCTION public.sincronizar_chamado_da_visita();

-- ── Backfill: quem já está preso no estado antigo ───────────────────────────
-- A função só roda em INSERT/UPDATE — sem isto, visitas já enviadas antes de
-- hoje ficariam com a capa desatualizada até a próxima edição delas, e o
-- print que o Davi mandou é exatamente uma visita nesse estado.
UPDATE public.chamados c
   SET status = 'concluido',
       titulo = 'Proposta Comercial',
       updated_at = now()
  FROM public.visitas_tecnicas v
 WHERE c.id = v.id
   AND lower(COALESCE(v.status, '')) = 'aprovada'
   AND v.proposta_enviada_em IS NOT NULL
   AND COALESCE(v.proposta_resultado, 'aguardando') <> 'recusada'
   AND (c.status IS DISTINCT FROM 'concluido' OR c.titulo IS DISTINCT FROM 'Proposta Comercial');

-- ── Verificação ─────────────────────────────────────────────────────────────
SELECT 'capas presas no estado antigo (esperado 0)' AS item,
       count(*)::text AS valor
  FROM public.chamados c
  JOIN public.visitas_tecnicas v ON v.id = c.id
 WHERE lower(COALESCE(v.status, '')) = 'aprovada'
   AND v.proposta_enviada_em IS NOT NULL
   AND COALESCE(v.proposta_resultado, 'aguardando') <> 'recusada'
   AND c.status <> 'concluido'
UNION ALL
SELECT 'capas de proposta com título errado (esperado 0)',
       count(*)::text
  FROM public.chamados
 WHERE natureza = 'comercial' AND titulo <> 'Proposta Comercial';
