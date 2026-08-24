-- U69 — LIMPEZA TOTAL DOS DADOS OPERACIONAIS (2026-08-24).
--
-- Davi: "Apague todas as atividades, todos os chamados registrados no
-- sistema. Quero começar a imputar os dados do zero. Vamos começar com o pé
-- direito" — véspera da migração de máquina e da saída da Lovable; o sistema
-- assume o lugar do Notion e do Sigma OS com dados lançados do zero.
--
-- >>> RODAR NO SQL EDITOR DO SUPABASE.                                    <<<
-- >>> ISTO É IRREVERSÍVEL. NÃO HÁ DESFAZER. Antes de rodar, confirme um   <<<
-- >>> backup no painel (Database → Backups) ou tire um dump.              <<<
--
-- ── O QUE ESTA MIGRATION APAGA ─────────────────────────────────────────────
--   A) o financeiro DERIVADO dos chamados: cobranças e fechamentos.
--      (cobrancas.chamado_id é ON DELETE SET NULL — sem esta seção, apagar
--      os chamados deixaria cobrança órfã apontando para o nada, e a tela
--      financeira mostraria dinheiro sem origem.)
--   B) TODOS os chamados (campo, interno, comercial) — os 537 do Notion, as
--      227 OS retroativas (U59/U61), os 30 de teste (U65) e os criados no
--      app. Os satélites saem por CASCADE: apoios, eventos, fotos,
--      checklist, peças, análise, ficha de compra, clientes extras (U45) e
--      as notificações ligadas a chamado.
--   C) TODAS as visitas técnicas (o funil comercial: orçamentos, blocos,
--      fotos de visita saem por CASCADE). No vocabulário do app, visita É
--      atividade — "todas as atividades" as inclui.
--      >> Se quiser PRESERVAR o funil comercial e as propostas já geradas,
--      >> comente a seção C antes de rodar. Os contratos NÃO dependem dela
--      >> (contratos.origem_proposta_id é SET NULL).
--   D) as notificações restantes e os CONTADORES de numeração — o próximo
--      chamado criado volta a ser CH-2026-0001, que é o "do zero" pedido.
--
-- ── O QUE FICA INTACTO (a fundação) ────────────────────────────────────────
--   clientes, cliente_sistemas, inventário/equipamentos (os ponteiros de
--   instalação ficam nulos — o item continua no prédio), contratos,
--   catálogo/preços, profiles/usuários, permissões, duplas, aliases de
--   técnico, prospecções.
--
-- ── DEPOIS DE RODAR, NUNCA MAIS RODE ───────────────────────────────────────
--   U59 (20260822070000), U61 (20260822080000) e U65 (20260822100000): elas
--   são idempotentes POR ORIGEM — num banco limpo, re-rodá-las REIMPORTARIA
--   as 227 OS e os 30 testes que você acabou de apagar.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- A) FINANCEIRO DERIVADO
-- ═══════════════════════════════════════════════════════════════════════
DELETE FROM public.cobrancas;
DELETE FROM public.fechamentos;

-- ═══════════════════════════════════════════════════════════════════════
-- B) CHAMADOS (satélites saem por CASCADE)
-- ═══════════════════════════════════════════════════════════════════════
DELETE FROM public.chamados;

-- ═══════════════════════════════════════════════════════════════════════
-- C) VISITAS TÉCNICAS / FUNIL COMERCIAL (satélites saem por CASCADE)
--    >> comente este bloco para preservar propostas já geradas <<
-- ═══════════════════════════════════════════════════════════════════════
DELETE FROM public.visitas_tecnicas;

-- ═══════════════════════════════════════════════════════════════════════
-- D) NOTIFICAÇÕES RESTANTES E CONTADORES
-- ═══════════════════════════════════════════════════════════════════════
DELETE FROM public.notificacoes;
-- zera a numeração: o próximo chamado nasce CH-<ano>-0001
DELETE FROM public.chamado_contadores;

-- ═══════════════════════════════════════════════════════════════════════
-- CONFERÊNCIA — os alvos zerados, a fundação de pé
-- ═══════════════════════════════════════════════════════════════════════
SELECT 'chamados' AS tabela, count(*)::text AS restam, '0' AS esperado FROM public.chamados
UNION ALL SELECT 'visitas_tecnicas', count(*)::text, '0' FROM public.visitas_tecnicas
UNION ALL SELECT 'cobrancas', count(*)::text, '0' FROM public.cobrancas
UNION ALL SELECT 'fechamentos', count(*)::text, '0' FROM public.fechamentos
UNION ALL SELECT 'notificacoes', count(*)::text, '0' FROM public.notificacoes
UNION ALL SELECT 'chamado_apoios (cascade)', count(*)::text, '0' FROM public.chamado_apoios
UNION ALL SELECT 'chamado_eventos (cascade)', count(*)::text, '0' FROM public.chamado_eventos
UNION ALL SELECT 'contadores (próximo = 0001)', count(*)::text, '0' FROM public.chamado_contadores;

-- a fundação: estes números NÃO podem ter mudado — se algum estiver zerado
-- e você tinha dados, PARE e restaure o backup antes de qualquer coisa
SELECT 'clientes' AS fundacao, count(*)::text AS registros FROM public.clientes
UNION ALL SELECT 'contratos', count(*)::text FROM public.contratos
UNION ALL SELECT 'profiles', count(*)::text FROM public.profiles
UNION ALL SELECT 'duplas', count(*)::text FROM public.duplas
UNION ALL SELECT 'prospeccoes (mantidas de propósito)', count(*)::text FROM public.prospeccoes;

COMMIT;
