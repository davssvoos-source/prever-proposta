-- ═══════════════════════════════════════════════════════════════════════════
-- U106 — A TELA /mapa SAI DA MATRIZ DE PERMISSÕES (R192)
--
-- >>> RODAR NO SQL EDITOR DO SUPABASE, À MÃO. Idempotente.
-- >>> ORDEM: independe das anteriores — só apaga linhas de permissoes_tela.
-- >>> ORDEM DE DEPLOY DO CÓDIGO: tanto faz. A rota /mapa já redireciona para
-- >>>        /gerencial e a chave 'mapa' saiu do catálogo (src/lib/telas.ts);
-- >>>        esta migration só tira a linha órfã da matriz. Até rodar, a linha
-- >>>        fica no banco sem ninguém ler — inofensiva.
--
-- 1) permissoes_tela: 'mapa' sai (R192 — Davi, 04/09/2026, revisão manual:
--    excluir a tela /mapa e o botão de mapa na aba Comercial). A tela era um
--    mapa Leaflet das visitas; o mapa que continua no sistema é o de CLIENTES,
--    dentro de /clientes, que não tem chave própria. Linha órfã na matriz é
--    lixo — o mesmo caso da U94 (usuários/permissões) e da U99 (histórico).
--
-- O que NÃO faz: não toca em visita nenhuma — a tela só LIA visitas_tecnicas.
-- ═══════════════════════════════════════════════════════════════════════════

DELETE FROM public.permissoes_tela WHERE tela IN ('mapa');

-- ── Verificação ─────────────────────────────────────────────────────────────
SELECT 1 AS n, 'linhas órfãs de mapa na matriz' AS o_que,
       count(*)::text AS obtido, '0' AS esperado,
       CASE WHEN count(*) = 0 THEN 'ok' ELSE '>>> OLHAR <<<' END AS veredito
  FROM public.permissoes_tela
 WHERE tela = 'mapa';

-- ── DESFAZER ────────────────────────────────────────────────────────────────
-- ║ As linhas apagadas, com o padrão que o catálogo tinha ([true, true, true]):
-- ║   INSERT INTO public.permissoes_tela (tela, cargo, permitido) VALUES
-- ║     ('mapa', 'tecnico', true), ('mapa', 'comercial', true), ('mapa', 'sac', true)
-- ║   ON CONFLICT (tela, cargo) DO NOTHING;
-- ║ E o front teria de voltar: T("mapa", …) em telas.ts, o botão em
-- ║ gerencial.tsx e o mapa.tsx anterior à U106 (git revert do commit da U106).
