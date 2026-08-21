-- ═══════════════════════════════════════════════════════════════════════════
-- U31 — O NOME DO CLIENTE COMO VEIO DA ORIGEM
--
-- O export novo do Notion (2026-08-21) traz a coluna "Cliente" preenchida em
-- 2097 das 2100 atividades das cinco pessoas. Mas só parte dos nomes casa com
-- a base do QAP: o Notion escreve "Eurico Gaspar Dutra" onde o QAP tem
-- "Gaspar Dutra", e usa nomes que não são cliente nenhum ("Robson", "Beto").
--
-- POR QUE UMA COLUNA E NÃO SÓ O cliente_id: sem ela, toda atividade cujo nome
-- não casou perderia a etiqueta de cliente no quadro — a informação existe no
-- Notion, some na importação, e ninguém nunca mais sabe de quem era aquela
-- tarefa. Guardar o texto cru custa uma coluna e preserva o que o Davi
-- escreveu lá.
--
-- A coluna NÃO substitui o vínculo: quando o nome casa, `cliente_id` é
-- preenchido e vale mais (é o cliente de verdade, com endereço e contrato).
-- A etiqueta prefere o vínculo e cai no texto só quando não há vínculo.
--
-- Idempotente. Ao final, um SELECT de verificação.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.chamados
  ADD COLUMN IF NOT EXISTS cliente_origem_nome text;

COMMENT ON COLUMN public.chamados.cliente_origem_nome IS
  'Nome do cliente como veio do sistema de origem (Notion), quando não casou '
  'com um cliente do QAP. Só para exibição — o vínculo real é cliente_id.';

-- ── Verificação ─────────────────────────────────────────────────────────────
SELECT 'coluna cliente_origem_nome (esperado 1)' AS item,
       count(*)::text AS valor
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'chamados'
   AND column_name = 'cliente_origem_nome';
