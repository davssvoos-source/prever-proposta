-- ═══════════════════════════════════════════════════════════════════════════
-- U30 — TRÊS TELAS A MENOS (R31/R32)
--
-- 1) A lista /chamados morreu: a Início entrega a mesma fila, em kanban e
--    lista, pelo mesmo modelo. A rota virou tronco (só as filhas vivem).
-- 2) Os indicadores de campo foram absorvidos pelo Painel Operacional — a
--    página /chamados/indicadores não existe mais.
-- 3) O Painel Comercial FUNDIU com "Visitas e propostas": /gerencial é a
--    página do domínio; /painel/comercial só redireciona.
--
-- O que muda no banco é só a matriz de permissões:
--   a) o acesso que o SAC tinha ao painel comercial (U28) segue o painel para
--      o endereço novo — a tela fundida é a 'gerencial';
--   b) as chaves que saíram do catálogo perdem as linhas. Linha órfã não
--      bloqueia nada (a guarda morreu junto com a tela), mas apareceria como
--      lixo se um dia a tela de permissões listasse o banco em vez do
--      catálogo — e banco limpo é o único estado que não engana.
--
-- Idempotente: rodar duas vezes dá no mesmo.
-- ═══════════════════════════════════════════════════════════════════════════

-- a) o SAC entra na página fundida (era o acesso dele ao painel comercial).
--    DO UPDATE de propósito, como na U28: a fusão é decisão de produto e vale
--    por cima de configuração antiga da tela separada.
INSERT INTO public.permissoes_tela (tela, cargo, permitido) VALUES
  ('gerencial', 'sac', true)
ON CONFLICT (tela, cargo) DO UPDATE SET permitido = true;

-- b) linhas das telas que deixaram de existir
DELETE FROM public.permissoes_tela
 WHERE tela IN ('chamados', 'chamados.indicadores', 'painel.comercial');

-- ── Verificação ─────────────────────────────────────────────────────────────
SELECT 'linhas órfãs restantes (esperado 0)' AS item,
       count(*)::text AS valor
  FROM public.permissoes_tela
 WHERE tela IN ('chamados', 'chamados.indicadores', 'painel.comercial')
UNION ALL
SELECT 'gerencial para o SAC (esperado true)',
       COALESCE((SELECT permitido::text FROM public.permissoes_tela
                  WHERE tela = 'gerencial' AND cargo = 'sac'), 'SEM LINHA');
