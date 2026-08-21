-- ═══════════════════════════════════════════════════════════════════════════
-- U41 — VOCABULÁRIO DE TIPOS DE CHAMADO (R48, 2026-08-21)
--
-- Davi definiu a lista definitiva de tipos: Manutenção Corretiva, Manutenção
-- Preventiva, Operacional, Prospecção, Implantação, Melhoria. Duas mudanças
-- de fato em relação ao que já existia:
--
--   1. "proposta_comercial" → "prospeccao". Mesmo tipo, nome novo — passa a
--      nomear o FLUXO ("é o fluxo que havíamos criado para elaborar
--      orçamentos"), não o resultado dele. Aplica-se a TODA demanda que já é
--      proposta comercial, não só às novas — daí o backfill da seção 3.
--
--   2. "pedido_compra" sai da SELEÇÃO — não do vocabulário. "na prática, vou
--      usar o Operacional no lugar": daqui pra frente, pedido de compra nasce
--      como chamado operacional comum. Os pedidos JÁ abertos continuam com
--      ficha própria (chamado_compra), fila e filtro funcionando — só não é
--      mais oferecido para um chamado NOVO. Essa parte é só código de
--      seleção (tiposDaNatureza em chamado-status.ts); aqui no banco o CHECK
--      continua aceitando 'pedido_compra' para não travar a leitura do que
--      já existe.
--
-- "Manutenção Corretiva"/"Manutenção Preventiva" são só RÓTULO mais explícito
-- — os valores gravados continuam 'corretiva'/'preventiva'. Sem mudança de
-- banco nenhuma para essas duas.
--
-- Idempotente. Ao final, um SELECT de verificação.
-- ═══════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- 1. O CHECK ABRE ESPAÇO PARA 'prospeccao'
-- ════════════════════════════════════════════════════════════════════════════
-- 'proposta_comercial' e 'pedido_compra' continuam aceitos: histórico e
-- pedidos de compra antigos precisam continuar legíveis.
ALTER TABLE public.chamados DROP CONSTRAINT IF EXISTS chamados_tipo_check;
ALTER TABLE public.chamados ADD CONSTRAINT chamados_tipo_check
  CHECK (tipo IN ('corretiva', 'preventiva', 'operacional', 'implantacao',
                  'melhoria', 'pedido_compra', 'proposta_comercial', 'prospeccao'));

-- ════════════════════════════════════════════════════════════════════════════
-- 2. O TRIGGER DA VISITA PASSA A GRAVAR 'prospeccao'
-- ════════════════════════════════════════════════════════════════════════════
-- Mesma função da U38 (fim do fluxo pós-envio), só trocando o tipo gravado no
-- INSERT — o resto do corpo (status derivado do funil, título fixo) não muda.
CREATE OR REPLACE FUNCTION public.sincronizar_chamado_da_visita()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE novo_status text;
BEGIN
  novo_status := CASE
    WHEN lower(COALESCE(NEW.status, '')) = 'aprovada' AND NEW.proposta_resultado = 'recusada' THEN 'cancelado'
    WHEN lower(COALESCE(NEW.status, '')) = 'aprovada' AND NEW.proposta_enviada_em IS NOT NULL  THEN 'concluido'
    WHEN lower(COALESCE(NEW.status, '')) = 'aprovada'                                          THEN 'aguardando_aprovacao'
    WHEN lower(COALESCE(NEW.status, '')) IN ('aguardando_aprovacao', 'concluida')              THEN 'aguardando_aprovacao'
    WHEN lower(COALESCE(NEW.status, '')) IN ('reprovada', 'cancelada')                         THEN 'aberto'
    WHEN lower(COALESCE(NEW.status, '')) = 'em_andamento'                                      THEN 'em_andamento'
    WHEN NEW.data_hora_agendada IS NOT NULL                                                    THEN 'agendado'
    ELSE 'aberto'
  END;

  INSERT INTO public.chamados (
    id, natureza, tipo, titulo, descricao_problema,
    cliente_id, responsavel_id, status, prioridade,
    data_hora_agendada, aberto_por, created_at, updated_at
  ) VALUES (
    NEW.id, 'comercial', 'prospeccao', 'Proposta Comercial',
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

-- ════════════════════════════════════════════════════════════════════════════
-- 3. BACKFILL — toda demanda que já é proposta comercial vira 'prospeccao'
-- ════════════════════════════════════════════════════════════════════════════
-- "aplicado... para todas as demandas que são de propostas comerciais" —
-- Davi pediu explicitamente que valesse para as já existentes, não só as
-- novas. Sem isto, cada capa só mudaria de tipo na próxima vez que a visita
-- correspondente fosse atualizada (o UPDATE do trigger), o que para muitas
-- propostas fechadas talvez nunca aconteça de novo.
UPDATE public.chamados
   SET tipo = 'prospeccao', updated_at = now()
 WHERE natureza = 'comercial' AND tipo = 'proposta_comercial';

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO
-- ════════════════════════════════════════════════════════════════════════════
SELECT 'chamados comerciais com tipo antigo (esperado 0)' AS item, count(*)::text AS valor
  FROM public.chamados WHERE natureza = 'comercial' AND tipo = 'proposta_comercial'
UNION ALL
SELECT 'chamados com tipo prospeccao', count(*)::text
  FROM public.chamados WHERE tipo = 'prospeccao'
UNION ALL
SELECT 'chamado comercial com tipo fora do esperado (esperado 0)', count(*)::text
  FROM public.chamados WHERE natureza = 'comercial' AND tipo IS DISTINCT FROM 'prospeccao'
UNION ALL
SELECT 'pedidos de compra antigos preservados (tipo pedido_compra)', count(*)::text
  FROM public.chamados WHERE tipo = 'pedido_compra'
UNION ALL
SELECT 'CHECK aceita prospeccao',
       (SELECT (pg_get_constraintdef(oid) LIKE '%prospeccao%')::text
          FROM pg_constraint WHERE conname = 'chamados_tipo_check');
