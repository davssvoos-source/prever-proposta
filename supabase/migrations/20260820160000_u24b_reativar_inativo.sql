-- U24b — quem foi rebaixado volta a ser cliente ao aceitar proposta
--
-- A U8 fez `registrar_resultado_proposta()` promover só prospecto→ativo,
-- porque na época o funil só tinha esses dois estados. A U24 criou um
-- terceiro: ex-cliente rebaixado a 'inativo' por não estar na planilha.
--
-- Sem esta correção, um rebaixado que volta a negociar e ACEITA a proposta
-- (o gatilho canônico de "virou cliente", regra R4) continua 'inativo' para
-- sempre — sem erro nenhum, só inconsistência permanente. É o tipo de defeito
-- que só aparece meses depois, quando alguém pergunta por que o cliente sumiu
-- da lista de ativos.
--
-- A função é REPRODUZIDA INTEIRA de propósito (CREATE OR REPLACE substitui o
-- corpo todo): toda regra da U8 continua aqui — 'aguardando' como resultado
-- válido, a exigência de envio prévio, o ERRCODE 42501 na negativa. A ÚNICA
-- diferença está na última cláusula, marcada abaixo.

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
  -- U24b: 'inativo' entrou na lista. Ex-cliente que aceita proposta volta a
  -- ser cliente. 'ativo' fica de fora de propósito: seria no-op.
  IF _resultado = 'aceita' AND v_cliente IS NOT NULL THEN
    UPDATE public.clientes SET situacao = 'ativo'
    WHERE id = v_cliente AND situacao IN ('prospecto', 'inativo');
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.registrar_resultado_proposta(uuid, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.registrar_resultado_proposta(uuid, text, text) TO authenticated, service_role;

-- ── Verificação ─────────────────────────────────────────────────────────────
SELECT 'reativa inativo' AS verificacao,
       pg_get_functiondef(p.oid) LIKE '%''prospecto'', ''inativo''%' AS ok
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'registrar_resultado_proposta'
UNION ALL
SELECT 'exige envio prévio (regra da U8 preservada)',
       pg_get_functiondef(p.oid) LIKE '%Registre primeiro o envio%'
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'registrar_resultado_proposta';
