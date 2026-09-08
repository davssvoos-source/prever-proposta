-- ═══════════════════════════════════════════════════════════════════════════
-- U121 — v0.0.4: equipamento ENTRA no cliente só pelo QAP; a atividade só move
-- para dentro de um bloco ou remove do cliente (R237)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Davi, 08/09/2026: "Em uma atividade, o usuário só pode movimentar um
-- equipamento para dentro de um bloco ou então clicar em remover um equipamento
-- do cliente. Os equipamentos que vão para o cliente vão sempre
-- OBRIGATORIAMENTE pelo QAP, e o sistema lê isso a partir do sincronismo. No
-- nosso sistema, o que é possível fazer é mover o equipamento para dentro de um
-- bloco ou removê-lo do cliente."
--
-- O QUE MUDA: `mover_equipamento` (U119) aceitava 'instalacao' de um item que
-- não estava em cliente nenhum (com uma pessoa, no almoxarifado, retirado) —
-- isso é um equipamento ENTRANDO no cliente pela nossa tela, o que a regra
-- proíbe: quem põe equipamento em cliente é o QAP. Agora a instalação exige que
-- o item JÁ SEJA do cliente da atividade (chegou pelo QAP, está "sem bloco" ou
-- noutro bloco) e só troca o bloco. A retirada continua igual. A regra mora no
-- banco porque a tela pode mudar e a RPC é chamada por qualquer cliente.
--
-- PRÉ-VOO: exige a U119 (a função existe). IDEMPOTENTE (CREATE OR REPLACE).
-- Nada de tabela nova. Termina com a conferência (>>> OLHAR <<<) e o DESFAZER.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $u121pre$
BEGIN
  IF to_regprocedure('public.mover_equipamento(uuid, uuid, text, uuid)') IS NULL THEN
    RAISE EXCEPTION 'U121: a U119 não rodou (mover_equipamento não existe). Rode a U119 primeiro.';
  END IF;
END
$u121pre$;

CREATE OR REPLACE FUNCTION public.mover_equipamento(_patrimonio uuid, _chamado uuid, _tipo text, _sistema uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $u121f$
DECLARE
  v_uid uuid := auth.uid();
  v_ch  record;
  v_it  record;
  v_id  uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Faça login para movimentar equipamentos.'; END IF;
  IF _tipo NOT IN ('retirada', 'instalacao') THEN RAISE EXCEPTION 'Tipo de movimento inválido: %', _tipo; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_uid AND p.ativo AND p.status <> 'pendente_aprovacao') THEN
    RAISE EXCEPTION 'Seu acesso ainda não foi aprovado.';
  END IF;

  SELECT id, cliente_id, natureza INTO v_ch FROM public.chamados WHERE id = _chamado;
  IF NOT FOUND THEN RAISE EXCEPTION 'Atividade não encontrada.'; END IF;
  -- R226: só cliente ÚNICO — sem cliente (interna) ou com mais de um (grupo) não movimenta
  IF v_ch.cliente_id IS NULL THEN RAISE EXCEPTION 'A atividade não tem um cliente único.'; END IF;
  IF EXISTS (SELECT 1 FROM public.chamado_locais l
              WHERE l.chamado_id = _chamado AND l.cliente_id IS NOT NULL AND l.cliente_id <> v_ch.cliente_id) THEN
    RAISE EXCEPTION 'A atividade tem mais de um cliente (grupo) — movimente o patrimônio pela ficha do cliente.';
  END IF;

  SELECT id, cliente_id, pessoa_id, cliente_sistema_id, situacao
    INTO v_it FROM public.equipamentos_patrimonio WHERE id = _patrimonio FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Equipamento não encontrado.'; END IF;

  -- R237: nos DOIS movimentos o item tem de JÁ SER do cliente da atividade.
  -- Equipamento entra no cliente só pelo QAP — esta função nunca faz um item
  -- de fora (com uma pessoa, no almoxarifado, retirado) entrar num cliente.
  IF v_it.cliente_id IS DISTINCT FROM v_ch.cliente_id THEN
    RAISE EXCEPTION 'Este equipamento não está no cliente da atividade. Equipamento entra no cliente só pelo QAP (R237).';
  END IF;

  IF _tipo = 'retirada' THEN
    INSERT INTO public.equipamento_movimentos
      (patrimonio_id, chamado_id, tipo, cliente_id, cliente_sistema_id,
       antes_cliente_id, antes_sistema_id, antes_pessoa_id, antes_situacao, feito_por)
    VALUES (_patrimonio, _chamado, 'retirada', v_ch.cliente_id, v_it.cliente_sistema_id,
            v_it.cliente_id, v_it.cliente_sistema_id, v_it.pessoa_id, v_it.situacao, v_uid)
    RETURNING id INTO v_id;
    UPDATE public.equipamentos_patrimonio
       SET cliente_id = NULL, cliente_sistema_id = NULL, situacao = 'retirado',
           retirado_em = now(), retirado_de_cliente_id = v_ch.cliente_id, updated_at = now()
     WHERE id = _patrimonio;
  ELSE
    -- 'instalacao' = dizer EM QUAL BLOCO do cliente o equipamento está
    IF _sistema IS NULL THEN RAISE EXCEPTION 'Escolha o bloco em que o equipamento foi instalado.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.cliente_sistemas s WHERE s.id = _sistema AND s.cliente_id = v_ch.cliente_id) THEN
      RAISE EXCEPTION 'O bloco escolhido não é deste cliente.';
    END IF;
    IF v_it.cliente_sistema_id IS NOT DISTINCT FROM _sistema THEN
      RAISE EXCEPTION 'O equipamento já está nesse bloco.';
    END IF;
    INSERT INTO public.equipamento_movimentos
      (patrimonio_id, chamado_id, tipo, cliente_id, cliente_sistema_id,
       antes_cliente_id, antes_sistema_id, antes_pessoa_id, antes_situacao, feito_por)
    VALUES (_patrimonio, _chamado, 'instalacao', v_ch.cliente_id, _sistema,
            v_it.cliente_id, v_it.cliente_sistema_id, v_it.pessoa_id, v_it.situacao, v_uid)
    RETURNING id INTO v_id;
    UPDATE public.equipamentos_patrimonio
       SET cliente_sistema_id = _sistema, situacao = 'ativo', updated_at = now()
     WHERE id = _patrimonio;
  END IF;
  RETURN v_id;
END;
$u121f$;

COMMENT ON FUNCTION public.mover_equipamento(uuid, uuid, text, uuid) IS
  'R226/R237 (U121): retirada (sai do cliente → lista de removidos) ou instalacao (troca o bloco) de um equipamento que JÁ É do cliente da atividade. Nunca faz equipamento entrar num cliente — isso é do QAP.';

COMMIT;

-- ── CONFERÊNCIA (obtido × esperado × veredito) ──────────────────────────────
WITH conferencia AS (
  SELECT 'R237: mover_equipamento exige que o item seja do cliente ANTES de qualquer movimento' AS item,
         (SELECT (pg_get_functiondef('public.mover_equipamento(uuid, uuid, text, uuid)'::regprocedure) LIKE '%só pelo QAP (R237)%')::text) AS obtido,
         'true' AS esperado
  UNION ALL
  SELECT 'R237: a instalação não escreve mais cliente_id (o item já é do cliente)',
         (SELECT (pg_get_functiondef('public.mover_equipamento(uuid, uuid, text, uuid)'::regprocedure) NOT LIKE '%SET cliente_id = v_ch.cliente_id%')::text), 'true'
  UNION ALL
  SELECT 'R237: instalar no mesmo bloco é recusado',
         (SELECT (pg_get_functiondef('public.mover_equipamento(uuid, uuid, text, uuid)'::regprocedure) LIKE '%já está nesse bloco%')::text), 'true'
  UNION ALL
  SELECT 'a função continua SECURITY DEFINER e executável por authenticated',
         (SELECT prosecdef::text FROM pg_proc WHERE oid = 'public.mover_equipamento(uuid, uuid, text, uuid)'::regprocedure)
           || '/' || has_function_privilege('authenticated', 'public.mover_equipamento(uuid, uuid, text, uuid)', 'EXECUTE')::text, 'true/true'
  UNION ALL
  SELECT 'nenhum item entrou em cliente por esta função (todo movimento tem antes_cliente_id = cliente_id)',
         (SELECT count(*)::text FROM public.equipamento_movimentos WHERE antes_cliente_id IS DISTINCT FROM cliente_id), '0'
)
SELECT item, obtido, esperado,
       CASE WHEN obtido IS NOT DISTINCT FROM esperado THEN 'ok' ELSE '>>> OLHAR <<<' END AS veredito
  FROM conferencia;

-- ── DESFAZER ────────────────────────────────────────────────────────────────
-- Recriar a função pelo texto da U119 (20260921090000_u119_…, §4, $u119f$).
