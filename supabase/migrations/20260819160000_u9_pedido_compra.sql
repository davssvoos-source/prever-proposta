-- ═══════════════════════════════════════════════════════════════════════════
-- U9 — O PEDIDO DE COMPRA GANHA CORPO (questão 6 do PRODUTO §8)
-- ═══════════════════════════════════════════════════════════════════════════
-- Roda depois da U7 (a fusão) — usa public.chamados.
--
-- Até aqui "pedido de compra" era só um `tipo` de chamado interno: dava para
-- abrir e classificar, mas não para responder as perguntas que o Controle
-- Patrimonial faz na prática — o que é, quanto custa, de quem, e quem
-- autorizou a gastar.
--
-- O caminho real da compra:
--
--   solicitado → em cotação → aprovado → comprado → recebido
--                     └──────── recusado (com motivo)
--
-- Fica num satélite 1:1 em vez de colunas soltas em `chamados` porque só uma
-- fatia dos chamados é compra, e porque a decisão de gasto tem dono próprio.

-- ═══════════════════════════════════════════════════════════════════════
-- 1) O SATÉLITE
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.chamado_compra (
  chamado_id          uuid PRIMARY KEY REFERENCES public.chamados(id) ON DELETE CASCADE,
  quantidade          numeric(12,2) NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  unidade             text NOT NULL DEFAULT 'un',
  fornecedor_sugerido text,
  link_produto        text,
  -- valor de COMPRA (o que pagamos ao fornecedor). Não é preço de cliente:
  -- a régua do pode_ver_financeiro é sobre o que cobramos, e quem compra
  -- precisa enxergar o que gasta.
  valor_estimado      numeric(12,2) CHECK (valor_estimado IS NULL OR valor_estimado >= 0),
  valor_final         numeric(12,2) CHECK (valor_final    IS NULL OR valor_final    >= 0),
  justificativa       text,
  situacao            text NOT NULL DEFAULT 'solicitado',
  decidido_por        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decidido_em         timestamptz,
  motivo_recusa       text,
  comprado_em         timestamptz,
  recebido_em         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chamado_compra DROP CONSTRAINT IF EXISTS chamado_compra_situacao_check;
ALTER TABLE public.chamado_compra ADD CONSTRAINT chamado_compra_situacao_check
  CHECK (situacao IN ('solicitado','em_cotacao','aprovado','comprado','recebido','recusado'));

CREATE INDEX IF NOT EXISTS chamado_compra_situacao_idx ON public.chamado_compra (situacao);

COMMENT ON TABLE public.chamado_compra IS
  'Detalhe do chamado tipo pedido_compra (R6/Q6). 1:1 com chamados.';
COMMENT ON COLUMN public.chamado_compra.valor_estimado IS
  'Custo de aquisição, não preço de venda — quem compra precisa ver.';

-- ═══════════════════════════════════════════════════════════════════════
-- 2) RLS — segue o acesso do chamado
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE public.chamado_compra ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chamado_compra_select" ON public.chamado_compra;
DROP POLICY IF EXISTS "chamado_compra_insert" ON public.chamado_compra;
DROP POLICY IF EXISTS "chamado_compra_update" ON public.chamado_compra;
DROP POLICY IF EXISTS "chamado_compra_delete" ON public.chamado_compra;

CREATE POLICY "chamado_compra_select" ON public.chamado_compra
  FOR SELECT TO authenticated USING (public.pode_acessar_chamado(chamado_id));
CREATE POLICY "chamado_compra_insert" ON public.chamado_compra
  FOR INSERT TO authenticated WITH CHECK (public.pode_acessar_chamado(chamado_id));
-- a decisão de gasto (aprovar/recusar) não passa por aqui: é RPC.
CREATE POLICY "chamado_compra_update" ON public.chamado_compra
  FOR UPDATE TO authenticated USING (public.pode_acessar_chamado(chamado_id));
CREATE POLICY "chamado_compra_delete" ON public.chamado_compra
  FOR DELETE TO authenticated USING (public.is_gestor(auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════
-- 3) A DECISÃO DE GASTAR — RPC
-- ═══════════════════════════════════════════════════════════════════════
-- Quem autoriza compra é quem responde pelo dinheiro: admin e comercial
-- (pode_ver_financeiro). O SAC abre o pedido e acompanha; o Patrimônio cota,
-- compra e recebe — mas nenhum dos dois libera o gasto sozinho.
--
-- Suposição registrada (Q6). Se a autorização for do Vinicius como admin
-- apenas, ou do Patrimônio até certo valor, é um IF nesta função.

CREATE OR REPLACE FUNCTION public.decidir_pedido_compra(
  _chamado_id uuid, _situacao text, _motivo text DEFAULT NULL, _valor numeric DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tipo    text;
  v_atual   text;
  v_decisor boolean := public.pode_ver_financeiro(auth.uid());
BEGIN
  IF _situacao NOT IN ('solicitado','em_cotacao','aprovado','comprado','recebido','recusado') THEN
    RAISE EXCEPTION 'Situação inválida: %', _situacao;
  END IF;

  SELECT c.tipo INTO v_tipo FROM public.chamados c WHERE c.id = _chamado_id;
  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'Chamado não encontrado.';
  END IF;
  IF v_tipo <> 'pedido_compra' THEN
    RAISE EXCEPTION 'Este chamado não é um pedido de compra.';
  END IF;
  IF NOT public.pode_acessar_chamado(_chamado_id) THEN
    RAISE EXCEPTION 'Sem acesso a este chamado.' USING ERRCODE = '42501';
  END IF;

  -- liberar o gasto e recusar são atos de quem responde pelo dinheiro;
  -- cotar, comprar e receber são do dia a dia de quem executa.
  IF _situacao IN ('aprovado','recusado') AND NOT v_decisor THEN
    RAISE EXCEPTION 'Somente quem responde pelo financeiro aprova ou recusa uma compra.'
      USING ERRCODE = '42501';
  END IF;

  SELECT situacao INTO v_atual FROM public.chamado_compra WHERE chamado_id = _chamado_id;
  IF v_atual IS NULL THEN
    RAISE EXCEPTION 'Este pedido ainda não tem os dados da compra preenchidos.';
  END IF;
  IF _situacao IN ('comprado','recebido') AND v_atual = 'recusado' THEN
    RAISE EXCEPTION 'Pedido recusado não vira compra. Reabra antes.';
  END IF;
  IF _situacao = 'comprado' AND v_atual NOT IN ('aprovado','comprado') THEN
    RAISE EXCEPTION 'A compra precisa ser aprovada antes de ser efetivada.';
  END IF;

  UPDATE public.chamado_compra
  SET situacao      = _situacao,
      valor_final   = COALESCE(_valor, valor_final),
      motivo_recusa = CASE WHEN _situacao = 'recusado' THEN _motivo ELSE NULL END,
      decidido_por  = CASE WHEN _situacao IN ('aprovado','recusado') THEN auth.uid() ELSE decidido_por END,
      decidido_em   = CASE WHEN _situacao IN ('aprovado','recusado') THEN now() ELSE decidido_em END,
      comprado_em   = CASE WHEN _situacao = 'comprado' THEN COALESCE(comprado_em, now()) ELSE comprado_em END,
      recebido_em   = CASE WHEN _situacao = 'recebido' THEN COALESCE(recebido_em, now()) ELSE recebido_em END,
      updated_at    = now()
  WHERE chamado_id = _chamado_id;

  -- o chamado acompanha a compra: recebido encerra, recusado cancela
  IF _situacao = 'recebido' THEN
    UPDATE public.chamados SET status = 'concluido'
    WHERE id = _chamado_id AND status <> 'concluido';
  ELSIF _situacao = 'recusado' THEN
    UPDATE public.chamados
    SET status = 'cancelado',
        motivo_cancelamento = COALESCE(_motivo, 'Compra não autorizada.')
    WHERE id = _chamado_id AND status <> 'cancelado';
  ELSIF _situacao IN ('em_cotacao','aprovado','comprado') THEN
    UPDATE public.chamados SET status = 'em_andamento'
    WHERE id = _chamado_id AND status = 'aberto';
  END IF;

  -- entra na linha do tempo do chamado, como qualquer outro passo
  INSERT INTO public.chamado_eventos (chamado_id, tipo, descricao, user_id)
  VALUES (_chamado_id, 'compra',
          'Pedido de compra: ' || _situacao ||
          COALESCE(' — ' || nullif(_motivo, ''), ''),
          auth.uid());
END;
$$;

REVOKE EXECUTE ON FUNCTION public.decidir_pedido_compra(uuid, text, text, numeric) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.decidir_pedido_compra(uuid, text, text, numeric) TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════
-- 4) TODO PEDIDO NASCE COM A FICHA DE COMPRA
-- ═══════════════════════════════════════════════════════════════════════
-- Sem isto a tela teria que lidar com "pedido sem ficha", e a RPC acima
-- rejeitaria a primeira decisão.
CREATE OR REPLACE FUNCTION public.chamado_criar_ficha_compra()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.tipo = 'pedido_compra' THEN
    INSERT INTO public.chamado_compra (chamado_id) VALUES (NEW.id)
    ON CONFLICT (chamado_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chamado_ficha_compra_ins ON public.chamados;
CREATE TRIGGER trg_chamado_ficha_compra_ins AFTER INSERT ON public.chamados
  FOR EACH ROW EXECUTE FUNCTION public.chamado_criar_ficha_compra();

DROP TRIGGER IF EXISTS trg_chamado_ficha_compra_upd ON public.chamados;
CREATE TRIGGER trg_chamado_ficha_compra_upd AFTER UPDATE OF tipo ON public.chamados
  FOR EACH ROW WHEN (NEW.tipo = 'pedido_compra')
  EXECUTE FUNCTION public.chamado_criar_ficha_compra();

-- ficha para os pedidos que já existem (os reclassificados na U6c)
INSERT INTO public.chamado_compra (chamado_id)
SELECT id FROM public.chamados WHERE tipo = 'pedido_compra'
ON CONFLICT (chamado_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
-- 5) ALERTA — pedido parado esperando decisão
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.alertas_compras(_dias int DEFAULT 5)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_n int := 0; r record;
BEGIN
  FOR r IN
    SELECT c.id, c.numero, c.titulo, cp.situacao, cp.updated_at
    FROM public.chamado_compra cp
    JOIN public.chamados c ON c.id = cp.chamado_id
    WHERE cp.situacao IN ('solicitado','em_cotacao')
      AND cp.updated_at < now() - make_interval(days => _dias)
  LOOP
    INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, chamado_id)
    SELECT p.id, 'compra_parada',
           'Pedido de compra parado',
           coalesce(r.numero, '') || ' — ' || r.titulo || ' está em "' || r.situacao ||
           '" há mais de ' || _dias || ' dias.',
           r.id
    FROM public.profiles p
    WHERE p.cargo IN ('admin', 'comercial') AND p.ativo;
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.alertas_compras(int) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.alertas_compras(int) TO service_role;

-- 07:30 de Brasília em dia útil (pg_cron roda em UTC)
DO $$
DECLARE r text;
BEGIN
  r := public.agendar_job('alertas-compras', '30 10 * * 1-5', 'SELECT public.alertas_compras(5);');
  RAISE NOTICE '%', r;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'agendamento nao aplicado: %', SQLERRM;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO
-- ═══════════════════════════════════════════════════════════════════════
SELECT 'tabela chamado_compra',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables
                         WHERE table_schema='public' AND table_name='chamado_compra')
       THEN 'sim' ELSE 'NAO' END, 'sim'
UNION ALL
SELECT 'fichas criadas para os pedidos existentes', count(*)::text,
       (SELECT count(*)::text FROM public.chamados WHERE tipo = 'pedido_compra')
FROM public.chamado_compra
UNION ALL
SELECT 'RPC + trigger + alerta', count(*)::text, '3'
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('decidir_pedido_compra','chamado_criar_ficha_compra','alertas_compras')
UNION ALL
SELECT 'policies de chamado_compra', count(*)::text, '4'
FROM pg_policies WHERE schemaname='public' AND tablename='chamado_compra';
