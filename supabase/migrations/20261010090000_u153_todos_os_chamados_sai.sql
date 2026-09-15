-- ═══════════════════════════════════════════════════════════════════════════
-- U153 — a tela "Todos os chamados" SAI da matriz (R301) — 2026-09-15
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Davi, 15/09/2026: "Remova o botão 'Ver todos os chamados', e remova também a
-- tela da página Todos os Chamados, pois na verdade, na tela 'Operacional
-- Técnica' já deverão aparecer TODOS os chamados, então o botão levaria a uma
-- tela com as mesmas informações."
--
-- A rota /chamados/painel virou redirect para /painel/operacional e a chave
-- `chamados.painel` saiu do catálogo (src/lib/telas.ts). Linha órfã na matriz
-- é lixo — o mesmo caso da U94 (gerencial.usuarios/permissoes), da U99
-- (historico/chamados.importar) e da U106 (mapa). O verificador exige que
-- catálogo e semente falem das MESMAS telas: este DELETE participa da semente.
--
-- >>> RODAR NO SQL EDITOR DO SUPABASE, À MÃO. Idempotente (apagar o que não
-- >>> existe apaga zero linhas). ORDEM DE DEPLOY DO CÓDIGO: tanto faz — a chave
-- >>> já não é lida por tela nenhuma, e a rota redireciona com ou sem a linha.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Pré-voo: a tabela tem de existir ────────────────────────────────────────
DO $u153pre$
BEGIN
  IF to_regclass('public.permissoes_tela') IS NULL THEN
    RAISE EXCEPTION 'U153: permissoes_tela não existe — rode a U11 primeiro.';
  END IF;
END
$u153pre$;

-- ── O que vai sair, ANTES de sair (para o DESFAZER ter o retrato) ───────────
SELECT tela, cargo, permitido, atualizado_em
  FROM public.permissoes_tela
 WHERE tela IN ('chamados.painel')
 ORDER BY cargo;

-- ── 1) a matriz perde a tela (R301) ─────────────────────────────────────────
DELETE FROM public.permissoes_tela WHERE tela IN ('chamados.painel');

-- ── CONFERÊNCIA (obtido × esperado × veredito) ──────────────────────────────
WITH conferencia AS (
  SELECT 'R301: linhas órfãs de chamados.painel na matriz' AS item,
         (SELECT count(*)::text FROM public.permissoes_tela WHERE tela = 'chamados.painel') AS obtido,
         '0' AS esperado
  UNION ALL
  SELECT 'R301: as outras telas continuam lá (nada além da chave saiu)',
         (SELECT count(DISTINCT tela)::text FROM public.permissoes_tela),
         -- 17 chaves no catálogo depois desta: dashboard, calendario, sobreaviso,
         -- chamados.novo, atividades.nova, chamados.programacao,
         -- painel.operacional, painel.administrativo, gerencial, gerencial.nova,
         -- clientes, clientes.novo, clientes.migrar, contratos, fechamentos,
         -- perfil, equipamentos
         '17'
)
SELECT item, obtido, esperado,
       CASE WHEN obtido IS NOT DISTINCT FROM esperado THEN 'ok' ELSE '>>> OLHAR <<<' END AS veredito
  FROM conferencia;

-- ── DESFAZER ────────────────────────────────────────────────────────────────
-- ║ Devolve as linhas da semente da U11/U127 (o retrato de antes está no SELECT
-- ║ do topo, se o admin tiver mexido nelas). A rota continuaria redirecionando:
-- ║ desfazer o banco sem desfazer o código deixa uma chave sem tela.
-- ║   INSERT INTO public.permissoes_tela (tela, cargo, permitido) VALUES
-- ║     ('chamados.painel', 'tecnico', false), ('chamados.painel', 'comercial', true),
-- ║     ('chamados.painel', 'sac', true), ('chamados.painel', 'operacional', false)
-- ║   ON CONFLICT (tela, cargo) DO NOTHING;
