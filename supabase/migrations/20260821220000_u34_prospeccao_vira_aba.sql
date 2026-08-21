-- ═══════════════════════════════════════════════════════════════════════════
-- U34 — PROSPECÇÃO VIRA ABA DO COMERCIAL (R38)
--
-- A Prospecção deixou de ser página própria (/prospeccao com item no menu
-- lateral) e passou a ser a segunda ABA do Painel Comercial. Prospecção é o
-- começo do funil — prospecto vira proposta vira cliente — e ter uma porta
-- separada obrigava a escolher entre duas telas antes de começar, sendo que o
-- trabalho atravessa as duas.
--
-- O que muda no banco é só a matriz de permissões: a chave 'prospeccao' saiu
-- do catálogo (src/lib/telas.ts) e as linhas dela ficam órfãs.
--
-- NENHUM ACESSO MUDA. A tela tinha [tecnico=false, comercial=true, sac=true]
-- e a 'gerencial' que a absorve tem exatamente os mesmos valores desde a U30
-- — quem entrava continua entrando, por outra porta.
--
-- Linha órfã não bloqueia nada (a guarda morreu junto com a tela), mas
-- apareceria como lixo se um dia a tela de permissões listasse o banco em vez
-- do catálogo — e banco limpo é o único estado que não engana.
--
-- Idempotente. Ao final, um SELECT de verificação.
-- ═══════════════════════════════════════════════════════════════════════════

DELETE FROM public.permissoes_tela WHERE tela = 'prospeccao';

-- ── Verificação ─────────────────────────────────────────────────────────────
SELECT 'linhas órfãs de prospeccao (esperado 0)' AS item,
       count(*)::text AS valor
  FROM public.permissoes_tela WHERE tela = 'prospeccao'
UNION ALL
-- a página que absorveu tem que continuar aberta a comercial e SAC
SELECT 'gerencial liberado (esperado 2: comercial e sac)',
       count(*)::text
  FROM public.permissoes_tela
 WHERE tela = 'gerencial' AND permitido = true AND cargo IN ('comercial', 'sac');
