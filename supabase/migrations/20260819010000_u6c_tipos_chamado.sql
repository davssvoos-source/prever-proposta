-- ETAPA U6c da unificação — Tipos de chamado ditados nas regras R5 e R6.
-- Referência: docs/PRODUTO.md §3.1 e §7.
--
-- >>> RODAR NO SQL EDITOR DA LOVABLE (Cloud → SQL editor). Idempotente. <<<
-- >>> Conferir o SELECT final: cada linha traz o valor esperado ao lado. <<<
--
--   R5 — chamado de campo tem o tipo OPERACIONAL (entrega de controle remoto,
--        cadastros, tarefas de campo que não são conserto nem rotina).
--        SLA: segue a prioridade, como os demais (suposição da questão 7 do
--        PRODUTO §8 — o padrão "normal" de 72h vale e é editável em os_sla).
--   R6 — demanda tem o tipo PEDIDO_COMPRA (o chamado do Controle Patrimonial).
--        Campos próprios (fornecedor, valor…) aguardam a questão 6; por ora a
--        descrição carrega os detalhes.

-- ═══════════════════════════════════════════════════════════════════════
-- 1) OS DE CAMPO: tipo 'operacional' (R5)
-- ═══════════════════════════════════════════════════════════════════════
-- O handler de exceção reverte o bloco INTEIRO (subtransação): se o ADD
-- falhasse, o DROP também seria desfeito e a lista ANTIGA continuaria ativa.
DO $$
BEGIN
  ALTER TABLE public.ordens_servico DROP CONSTRAINT IF EXISTS ordens_servico_tipo_check;
  ALTER TABLE public.ordens_servico ADD CONSTRAINT ordens_servico_tipo_check
    CHECK (tipo IN ('corretiva','preventiva','implantacao','operacional'));
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'ha OS com tipo fora da lista — a constraint ANTIGA foi mantida';
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 2) DEMANDAS: tipo 'pedido_compra' (R6)
-- ═══════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  ALTER TABLE public.demandas DROP CONSTRAINT IF EXISTS demandas_tipo_check;
  ALTER TABLE public.demandas ADD CONSTRAINT demandas_tipo_check
    CHECK (tipo IS NULL OR tipo IN ('melhoria','implantacao','corretiva','preventiva',
                                    'operacional','pedido_compra'));
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'ha demanda com tipo fora da lista — a constraint ANTIGA foi mantida';
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 3) CLASSIFICAÇÃO SUGERIDA reconhece pedido de compra
-- ═══════════════════════════════════════════════════════════════════════
-- Intenção de compra vem primeiro: "Comprar peça para conserto" é um pedido
-- de compra, mesmo contendo palavra de corretiva. O gêmeo TS
-- (src/lib/demanda-status.ts) muda junto — os dois precisam concordar.
CREATE OR REPLACE FUNCTION public.sugerir_tipo_demanda(_titulo text, _descricao text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  t text := public.normalizar_texto(COALESCE(_titulo, '') || ' ' || COALESCE(_descricao, ''));
BEGIN
  IF t IS NULL THEN RETURN 'operacional'; END IF;
  IF t ~ '(compra|comprar|cotacao|cotar|aquisicao|adquirir|fornecedor|pedido de material)'
    THEN RETURN 'pedido_compra'; END IF;
  IF t ~ '(nao funciona|nao esta funcionando|parou|caiu|travand|travou|quebrad|defeito|falha|falhou|erro|bug|corrig|conserto|reparo|urgente|sem sinal|sem acesso|offline)'
    THEN RETURN 'corretiva'; END IF;
  IF t ~ '(preventiv|revisao|inspec|limpeza|checagem|vistoria|rotina de manutencao|manutencao programada)'
    THEN RETURN 'preventiva'; END IF;
  IF t ~ '(implanta|instala|nova unidade|novo sistema|migra|migracao|deploy|homologa|ativacao|start)'
    THEN RETURN 'implantacao'; END IF;
  IF t ~ '(melhor|otimiz|aprimor|refator|upgrade|atualiz|padroniz|automatiz|redesenh|nova funcionalidade|criar tela)'
    THEN RETURN 'melhoria'; END IF;
  RETURN 'operacional';
END;
$$;
GRANT EXECUTE ON FUNCTION public.sugerir_tipo_demanda(text, text) TO authenticated, service_role;

-- Backfill (achado da revisão): o import do Notion gravou as compras como
-- 'operacional' — "Compra dos materiais", "Cotação tubo e flange", "Pedido
-- 000.355.758 - Portseg"… — porque o tipo pedido_compra não existia. Sem
-- reclassificar, o filtro "Pedido de compra" do painel novo nasceria vazio de
-- histórico. Só mexe no que veio do Notion como operacional e que a própria
-- heurística reconhece como compra; classificações explícitas (corretiva,
-- melhoria…) ficam como estão.
UPDATE public.demandas
SET tipo = 'pedido_compra'
WHERE origem = 'notion'
  AND tipo = 'operacional'
  AND public.sugerir_tipo_demanda(titulo, descricao) = 'pedido_compra';

-- ═══════════════════════════════════════════════════════════════════════
-- 4) VISITAS VISÍVEIS PARA O SAC (achado da revisão adversarial)
-- ═══════════════════════════════════════════════════════════════════════
-- As policies de visitas_tecnicas (migration 20260628071711) checam o cargo
-- inline com IN ('admin','comercial') — anteriores ao papel sac. Sem isto o
-- SAC criaria a visita pelo trilho de proposta (o INSERT é liberado) e não a
-- veria nunca mais; e as propostas sumiriam do painel, do calendário e da
-- lista dele. Troca pelo helper is_gestor(), que é a régua certa e já inclui
-- o SAC desde a U6a.
DROP POLICY IF EXISTS "visitas_select" ON public.visitas_tecnicas;
CREATE POLICY "visitas_select" ON public.visitas_tecnicas
  FOR SELECT TO authenticated
  USING (tecnico_id = auth.uid() OR public.is_gestor(auth.uid()));

DROP POLICY IF EXISTS "visitas_update" ON public.visitas_tecnicas;
CREATE POLICY "visitas_update" ON public.visitas_tecnicas
  FOR UPDATE TO authenticated
  USING (tecnico_id = auth.uid() OR public.is_gestor(auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO FINAL
-- ═══════════════════════════════════════════════════════════════════════
SELECT 'OS aceita tipo operacional' AS verificacao,
       CASE WHEN pg_get_constraintdef((SELECT oid FROM pg_constraint
         WHERE conname='ordens_servico_tipo_check')) LIKE '%operacional%'
       THEN 'sim' ELSE 'NAO' END AS resultado, 'sim' AS esperado
UNION ALL
SELECT 'demanda aceita tipo pedido_compra',
       CASE WHEN pg_get_constraintdef((SELECT oid FROM pg_constraint
         WHERE conname='demandas_tipo_check')) LIKE '%pedido_compra%'
       THEN 'sim' ELSE 'NAO' END, 'sim'
UNION ALL
SELECT 'sugestao — "Compra de licenças Kaspersky"',
       public.sugerir_tipo_demanda('Compra de licenças Kaspersky'), 'pedido_compra'
UNION ALL
SELECT 'sugestao — "Cotação de tubo de fibra"',
       public.sugerir_tipo_demanda('Cotação de tubo de fibra'), 'pedido_compra'
UNION ALL
SELECT 'sugestao — "Comprar peça para conserto do portão"',
       public.sugerir_tipo_demanda('Comprar peça para conserto do portão'), 'pedido_compra'
UNION ALL
SELECT 'sugestao — "Portão não funciona" (segue corretiva)',
       public.sugerir_tipo_demanda('Portão não funciona'), 'corretiva'
UNION ALL
SELECT 'compras do Notion reclassificadas como pedido_compra',
       count(*)::text, '(informativo — > 0 esperado)'
FROM public.demandas WHERE origem = 'notion' AND tipo = 'pedido_compra'
UNION ALL
SELECT 'visitas visiveis para gestores via is_gestor (SAC incluido)',
       CASE WHEN EXISTS (SELECT 1 FROM pg_policies
         WHERE schemaname='public' AND tablename='visitas_tecnicas'
           AND policyname='visitas_select' AND qual LIKE '%is_gestor%')
       THEN 'sim' ELSE 'NAO' END, 'sim'
UNION ALL
SELECT 'OS por tipo (informativo)',
       COALESCE((SELECT string_agg(tipo || '=' || n::text, ', ' ORDER BY tipo)
                 FROM (SELECT tipo, count(*) AS n FROM public.ordens_servico GROUP BY tipo) t),
                '(nenhuma)'),
       '(operacional aparece quando o primeiro for aberto)';
