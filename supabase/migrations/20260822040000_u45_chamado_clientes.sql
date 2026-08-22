-- ═══════════════════════════════════════════════════════════════════════════
-- U45 — UMA ATIVIDADE PODE SER DE MAIS DE UM CLIENTE (R54)
--
-- Davi: "Uma atividade pode ser para mais de um cliente, então deve ter a
-- possibilidade de agregar mais de um cliente na mesma task." Hoje
-- `chamados.cliente_id` é uma FK única — esta migration adiciona uma tabela
-- de associação SEM mexer em `cliente_id`.
--
-- `cliente_id` CONTINUA EXATAMENTE COMO ERA — é o "cliente principal", e é
-- ele que toda parte do sistema que só conhece UM cliente por chamado ainda
-- lê sem mudar uma linha: cobrança (mensalidadesProjeto.ts, cobranca.ts),
-- casamento por cliente (matching.ts), filtro por cliente, relatório, os
-- cards da Início e do Calendário. Reescrever essas leituras para
-- multi-cliente é um projeto à parte — não foi o que foi pedido agora, e
-- forçar isso aqui só pra "ficar completo" arriscaria quebrar cobrança de
-- verdade sem necessidade.
--
-- `chamado_clientes` é ADITIVA: guarda só os clientes ALÉM do principal. Uma
-- atividade de 1 cliente não ganha linha nenhuma aqui (continua só
-- `cliente_id`, como sempre foi) — por isso NÃO HÁ BACKFILL nesta migration:
-- não existia "cliente extra" antes de existir este recurso.
--
-- Mesmo desenho de `chamado_apoios` (U1/U7): chave composta
-- (chamado_id, cliente_id), RLS gated por `pode_editar_chamado` — a mesma
-- função que já guarda quem pode mudar `cliente_id` hoje, então "quem pode
-- adicionar/remover um cliente extra" nunca diverge de "quem pode editar o
-- chamado".
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.chamado_clientes (
  chamado_id uuid NOT NULL REFERENCES public.chamados(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chamado_id, cliente_id)
);
CREATE INDEX IF NOT EXISTS chamado_clientes_cliente_idx ON public.chamado_clientes (cliente_id);

ALTER TABLE public.chamado_clientes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.chamado_clientes TO authenticated;
GRANT ALL ON public.chamado_clientes TO service_role;

DROP POLICY IF EXISTS "chamado_clientes_select" ON public.chamado_clientes;
DROP POLICY IF EXISTS "chamado_clientes_insert" ON public.chamado_clientes;
DROP POLICY IF EXISTS "chamado_clientes_delete" ON public.chamado_clientes;

-- leitura aberta ao time autenticado — mesmo padrão de chamado_apoios: a
-- linha por si só (dois uuids) não vaza nada que a policy de `chamados`/
-- `clientes` já não decida separadamente para quem faz o JOIN.
CREATE POLICY "chamado_clientes_select" ON public.chamado_clientes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "chamado_clientes_insert" ON public.chamado_clientes
  FOR INSERT TO authenticated WITH CHECK (public.pode_editar_chamado(chamado_id));
CREATE POLICY "chamado_clientes_delete" ON public.chamado_clientes
  FOR DELETE TO authenticated USING (public.pode_editar_chamado(chamado_id));

-- ── Verificação ─────────────────────────────────────────────────────────────
SELECT 'chamado_clientes existe' AS item,
       (to_regclass('public.chamado_clientes') IS NOT NULL)::text AS valor
UNION ALL
SELECT 'RLS ligado em chamado_clientes',
       relrowsecurity::text
  FROM pg_class WHERE oid = 'public.chamado_clientes'::regclass
UNION ALL
SELECT 'as 3 policies existem (select/insert/delete)', count(*)::text
  FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chamado_clientes';
