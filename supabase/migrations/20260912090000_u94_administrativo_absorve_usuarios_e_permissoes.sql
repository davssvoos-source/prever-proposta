-- ═══════════════════════════════════════════════════════════════════════════
-- U94 — O ADMINISTRATIVO ABSORVE USUÁRIOS E PERMISSÕES (R131)
--
-- >>> RODAR NO SQL EDITOR DO SUPABASE, À MÃO. Idempotente.
-- >>> ORDEM DE DEPLOY: tanto faz. Linha órfã não bloqueia nada (a guarda das
-- >>> duas telas morreu junto com elas), e o código não lê estas linhas.
--
-- As telas `/gerencial/usuarios` e `/gerencial/permissoes` deixaram de ser
-- páginas: viraram as abas Usuários e Permissões do painel Administrativo
-- (Davi, 03/09/2026: "Os usuários podem ser listados diretamente nesta página e
-- as permissões estarem junto"). As rotas antigas só redirecionam.
--
-- O que muda no banco é só a matriz de permissões: as chaves
-- 'gerencial.usuarios' e 'gerencial.permissoes' saíram do catálogo
-- (src/lib/telas.ts) e as linhas delas ficam órfãs — o mesmo caso da
-- 'prospeccao' na U34 e das telas fundidas na U30.
--
-- NENHUM ACESSO MUDA. As duas tinham [tecnico=false, comercial=false,
-- sac=false] desde a U11 — eram do admin por regra de sistema, e o admin
-- continua entrando pelo painel Administrativo, que tem a própria linha.
--
-- Linha órfã apareceria como lixo se um dia a tela de permissões listasse o
-- banco em vez do catálogo — e banco limpo é o único estado que não engana.
-- ═══════════════════════════════════════════════════════════════════════════

DELETE FROM public.permissoes_tela WHERE tela IN ('gerencial.usuarios', 'gerencial.permissoes');

-- ── Verificação ─────────────────────────────────────────────────────────────
SELECT 'linhas órfãs das duas telas (esperado 0)' AS item,
       count(*)::text AS valor
  FROM public.permissoes_tela
 WHERE tela IN ('gerencial.usuarios', 'gerencial.permissoes')
UNION ALL
-- o painel que as absorveu tem que continuar na matriz, com os três papéis
SELECT 'painel.administrativo na matriz (esperado 3: tecnico, comercial, sac)',
       count(*)::text
  FROM public.permissoes_tela
 WHERE tela = 'painel.administrativo';

-- ── DESFAZER (só se a decisão voltar atrás; recria as seis linhas negadas) ──
-- INSERT INTO public.permissoes_tela (tela, cargo, permitido) VALUES
--   ('gerencial.usuarios', 'tecnico', false), ('gerencial.usuarios', 'comercial', false), ('gerencial.usuarios', 'sac', false),
--   ('gerencial.permissoes', 'tecnico', false), ('gerencial.permissoes', 'comercial', false), ('gerencial.permissoes', 'sac', false)
-- ON CONFLICT DO NOTHING;
