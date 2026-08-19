-- ═══════════════════════════════════════════════════════════════════════════
-- U8 — O ACEITE DO CLIENTE (regra R4)
-- ═══════════════════════════════════════════════════════════════════════════
-- Ver docs/PRODUTO.md §5 e docs/PLANO_UNIFICACAO.md §12.
--
-- A correção que o Davi ditou: "quando o comercial aprova uma visita técnica,
-- ele está aprovando a VISITA... mas o CLIENTE quem aprova ou não a proposta.
-- Todas as visitas que foram aprovadas não significam que a proposta foi
-- aprovada, ou seja, não significa que são nossos clientes."
--
-- O que existia até aqui parava na aprovação interna. Esta migration acrescenta
-- os dois passos que faltavam depois dela:
--
--   aprovada (interno)  →  proposta ENVIADA  →  decisão DO CLIENTE
--                                                 ├─ aceita   → vira cliente
--                                                 └─ recusada → segue prospecto
--
-- E desfaz o atalho antigo "visita aprovada ⇒ cliente ativo", que inflou a base
-- com prospectos marcados como clientes.

-- ═══════════════════════════════════════════════════════════════════════
-- 1) O PÓS-APROVAÇÃO NA VISITA
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE public.visitas_tecnicas
  ADD COLUMN IF NOT EXISTS proposta_enviada_em     timestamptz,
  ADD COLUMN IF NOT EXISTS proposta_resultado      text,
  ADD COLUMN IF NOT EXISTS proposta_resultado_em   timestamptz,
  ADD COLUMN IF NOT EXISTS proposta_motivo_recusa  text;

-- NULL = a proposta ainda nem saiu. Depois de enviada ela fica 'aguardando'
-- até o cliente responder — é esse estado que o funil comercial precisa ver.
ALTER TABLE public.visitas_tecnicas DROP CONSTRAINT IF EXISTS visitas_proposta_resultado_check;
ALTER TABLE public.visitas_tecnicas ADD CONSTRAINT visitas_proposta_resultado_check
  CHECK (proposta_resultado IS NULL
         OR proposta_resultado IN ('aguardando', 'aceita', 'recusada'));

CREATE INDEX IF NOT EXISTS visitas_proposta_resultado_idx
  ON public.visitas_tecnicas (proposta_resultado);

COMMENT ON COLUMN public.visitas_tecnicas.proposta_resultado IS
  'Decisão DO CLIENTE sobre a proposta (R4). NULL = proposta ainda não enviada. '
  'Não confundir com status=aprovada, que é a aprovação INTERNA da visita.';

-- ═══════════════════════════════════════════════════════════════════════
-- 2) AS DUAS AÇÕES, COMO RPC
-- ═══════════════════════════════════════════════════════════════════════
-- SECURITY DEFINER porque o aceite atravessa tabelas: mexe na visita, promove
-- o cliente e escreve na linha do tempo. Pela RLS, o comercial não conseguiria
-- fazer os três do lado do cliente.

CREATE OR REPLACE FUNCTION public.registrar_envio_proposta(_visita_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_status text;
BEGIN
  IF NOT public.is_gestor(auth.uid()) THEN
    RAISE EXCEPTION 'Somente gestor registra o envio da proposta.' USING ERRCODE = '42501';
  END IF;

  SELECT status INTO v_status FROM public.visitas_tecnicas WHERE id = _visita_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Visita não encontrada.';
  END IF;
  IF v_status <> 'aprovada' THEN
    RAISE EXCEPTION 'A proposta só sai depois da visita aprovada internamente (situação atual: %).', v_status;
  END IF;

  UPDATE public.visitas_tecnicas
  SET proposta_enviada_em    = COALESCE(proposta_enviada_em, now()),
      proposta_resultado     = COALESCE(proposta_resultado, 'aguardando'),
      proposta_resultado_em  = NULL,
      proposta_motivo_recusa = NULL
  WHERE id = _visita_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.registrar_envio_proposta(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.registrar_envio_proposta(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.registrar_resultado_proposta(
  _visita_id uuid, _resultado text, _motivo text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cliente uuid;
  v_enviada timestamptz;
BEGIN
  IF NOT public.is_gestor(auth.uid()) THEN
    RAISE EXCEPTION 'Somente gestor registra a resposta do cliente.' USING ERRCODE = '42501';
  END IF;
  IF _resultado NOT IN ('aguardando', 'aceita', 'recusada') THEN
    RAISE EXCEPTION 'Resultado inválido: %', _resultado;
  END IF;

  SELECT cliente_id, proposta_enviada_em INTO v_cliente, v_enviada
  FROM public.visitas_tecnicas WHERE id = _visita_id;

  IF v_enviada IS NULL THEN
    RAISE EXCEPTION 'Registre primeiro o envio da proposta ao cliente.';
  END IF;

  UPDATE public.visitas_tecnicas
  SET proposta_resultado     = _resultado,
      proposta_resultado_em  = CASE WHEN _resultado = 'aguardando' THEN NULL ELSE now() END,
      proposta_motivo_recusa = CASE WHEN _resultado = 'recusada' THEN _motivo ELSE NULL END
  WHERE id = _visita_id;

  -- É AQUI que o prospecto vira cliente — não na aprovação interna (R4).
  IF _resultado = 'aceita' AND v_cliente IS NOT NULL THEN
    UPDATE public.clientes SET situacao = 'ativo'
    WHERE id = v_cliente AND situacao = 'prospecto';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.registrar_resultado_proposta(uuid, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.registrar_resultado_proposta(uuid, text, text) TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════
-- 3) DESFAZ O ATALHO "VISITA APROVADA ⇒ CLIENTE ATIVO"
-- ═══════════════════════════════════════════════════════════════════════
-- O backfill da Etapa 1 (20260817120000) marcou como 'ativo' todo cliente que
-- tivesse UMA visita aprovada. Pela R4 isso está errado: aprovar a visita é
-- decisão nossa, não do cliente.
--
-- Critério para CONTINUAR ativo — qualquer prova de relação real:
--   a) proposta aceita registrada, ou
--   b) contrato cadastrado, ou
--   c) chamado de campo concluído (alguém já foi lá prestar serviço), ou
--   d) cobrança gerada, ou
--   e) veio do QAP (quem está lá é cliente de verdade — §6).
-- Quem não tem nenhuma das cinco volta a 'prospecto'.
--
-- Reversível: a lista exata dos rebaixados fica em clientes_rebaixados_u8.

CREATE TABLE IF NOT EXISTS public.clientes_rebaixados_u8 (
  cliente_id   uuid PRIMARY KEY,
  nome         text,
  rebaixado_em timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.clientes_rebaixados_u8 IS
  'Trilha do rebaixamento ativo→prospecto feito na U8 (R4). Para desfazer: '
  'UPDATE clientes SET situacao=''ativo'' WHERE id IN (SELECT cliente_id FROM clientes_rebaixados_u8);';

WITH tem_relacao AS (
  SELECT DISTINCT c.id
  FROM public.clientes c
  WHERE c.qap_cliente_id IS NOT NULL
     OR EXISTS (SELECT 1 FROM public.visitas_tecnicas v
                WHERE v.cliente_id = c.id AND v.proposta_resultado = 'aceita')
     OR EXISTS (SELECT 1 FROM public.cliente_contratos ct WHERE ct.cliente_id = c.id)
     OR EXISTS (SELECT 1 FROM public.chamados ch
                WHERE ch.cliente_id = c.id AND ch.natureza = 'campo'
                  AND ch.status IN ('executado', 'concluido'))
     OR EXISTS (SELECT 1 FROM public.cobrancas cb WHERE cb.cliente_id = c.id)
)
INSERT INTO public.clientes_rebaixados_u8 (cliente_id, nome)
SELECT c.id, c.nome
FROM public.clientes c
WHERE c.situacao = 'ativo'
  AND c.id NOT IN (SELECT id FROM tem_relacao)
ON CONFLICT (cliente_id) DO NOTHING;

UPDATE public.clientes SET situacao = 'prospecto'
WHERE id IN (SELECT cliente_id FROM public.clientes_rebaixados_u8)
  AND situacao = 'ativo';

ALTER TABLE public.clientes_rebaixados_u8 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rebaixados_select" ON public.clientes_rebaixados_u8;
CREATE POLICY "rebaixados_select" ON public.clientes_rebaixados_u8
  FOR SELECT TO authenticated USING (public.is_gestor(auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════
-- 4) O FUNIL COMERCIAL, PRONTO PARA A TELA
-- ═══════════════════════════════════════════════════════════════════════
-- visitas → aprovadas → propostas enviadas → aceitas (e recusadas).
CREATE OR REPLACE FUNCTION public.funil_comercial(_desde date DEFAULT NULL)
RETURNS TABLE (etapa text, quantidade bigint, ordem int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH base AS (
    SELECT * FROM public.visitas_tecnicas
    WHERE _desde IS NULL OR created_at >= _desde
  )
  SELECT 'Visitas',            count(*),                                                          1 FROM base
  UNION ALL
  SELECT 'Aprovadas',          count(*) FILTER (WHERE status = 'aprovada'),                       2 FROM base
  UNION ALL
  SELECT 'Propostas enviadas', count(*) FILTER (WHERE proposta_enviada_em IS NOT NULL),           3 FROM base
  UNION ALL
  SELECT 'Aceitas',            count(*) FILTER (WHERE proposta_resultado = 'aceita'),             4 FROM base
  UNION ALL
  SELECT 'Recusadas',          count(*) FILTER (WHERE proposta_resultado = 'recusada'),           5 FROM base
  ORDER BY 3;
$$;

REVOKE EXECUTE ON FUNCTION public.funil_comercial(date) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.funil_comercial(date) TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO
-- ═══════════════════════════════════════════════════════════════════════
SELECT 'colunas do pos-aprovacao na visita', count(*)::text, '4'
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'visitas_tecnicas'
  AND column_name IN ('proposta_enviada_em','proposta_resultado','proposta_resultado_em','proposta_motivo_recusa')
UNION ALL
SELECT 'RPCs do aceite', count(*)::text, '3'
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('registrar_envio_proposta','registrar_resultado_proposta','funil_comercial')
UNION ALL
SELECT 'clientes ATIVOS agora', count(*)::text, '(so quem tem relacao real)'
FROM public.clientes WHERE situacao = 'ativo'
UNION ALL
SELECT 'clientes rebaixados para prospecto', count(*)::text, '(conferir a lista abaixo)'
FROM public.clientes_rebaixados_u8
UNION ALL
SELECT 'quem foi rebaixado', string_agg(nome, ' · ' ORDER BY nome), '(desfazer: ver COMMENT da tabela)'
FROM public.clientes_rebaixados_u8;
