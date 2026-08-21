-- U28 — "Gerencial" vira três painéis (R27, 2026-08-21)
--
-- Painel Operacional · Painel Comercial · Painel Administrativo.
--
-- OS PAINÉIS SÃO PORTAS, NÃO SUBSTITUTOS. Cada um mostra o estado do seu
-- domínio (números) e leva às telas onde se trabalha. Nenhuma tela existente
-- muda de rota — o que muda é por onde se entra.
--
-- POR QUE CHAVES NOVAS, e não renomear 'gerencial':
-- `permissoes_tela.tela` é chave gravada no banco, e o próprio catálogo
-- (src/lib/telas.ts) avisa que renomear invalida a linha. Renomear 'gerencial'
-- para 'painel.comercial' faria toda permissão já configurada pelo admin sumir
-- em silêncio. As três chaves nascem novas; 'gerencial' continua existindo e
-- passa a ser a LISTA de visitas — que é o que ela sempre foi de fato.
--
-- QUEM ABRE O QUÊ:
--   operacional   → comercial e SAC. É o painel de quem coordena (R26).
--   comercial     → comercial e SAC. O SAC agenda a visita de proposta.
--   administrativo→ ninguém na matriz. Na prática só o admin, que passa por
--                   regra de sistema e nunca entra na matriz.
-- O técnico não abre nenhum: ele não coordena (R1/R7).
--
-- Idempotente. Ao final, um SELECT de verificação.

INSERT INTO public.permissoes_tela (tela, cargo, permitido) VALUES
  ('painel.operacional',    'tecnico',   false),
  ('painel.operacional',    'comercial', true),
  ('painel.operacional',    'sac',       true),
  ('painel.comercial',      'tecnico',   false),
  ('painel.comercial',      'comercial', true),
  ('painel.comercial',      'sac',       true),
  ('painel.administrativo', 'tecnico',   false),
  ('painel.administrativo', 'comercial', false),
  ('painel.administrativo', 'sac',       false)
ON CONFLICT (tela, cargo) DO UPDATE SET permitido = EXCLUDED.permitido;

-- ── Verificação ─────────────────────────────────────────────────────────────
SELECT 'painéis na matriz (esperado 9)' AS item,
       count(*)::text AS valor
  FROM public.permissoes_tela WHERE tela LIKE 'painel.%'
UNION ALL
SELECT 'operacional liberado p/ comercial e sac (esperado 2)',
       (SELECT count(*) FROM public.permissoes_tela
         WHERE tela = 'painel.operacional' AND permitido = true)::text
UNION ALL
SELECT 'comercial liberado p/ comercial e sac (esperado 2)',
       (SELECT count(*) FROM public.permissoes_tela
         WHERE tela = 'painel.comercial' AND permitido = true)::text
UNION ALL
SELECT 'administrativo negado a todos na matriz (esperado 0)',
       (SELECT count(*) FROM public.permissoes_tela
         WHERE tela = 'painel.administrativo' AND permitido = true)::text
UNION ALL
SELECT 'a chave gerencial CONTINUA (não foi renomeada)',
       (SELECT count(*) FROM public.permissoes_tela WHERE tela = 'gerencial')::text
UNION ALL
SELECT 'nenhum painel liberado ao técnico (esperado 0)',
       (SELECT count(*) FROM public.permissoes_tela
         WHERE tela LIKE 'painel.%' AND cargo = 'tecnico' AND permitido = true)::text;
