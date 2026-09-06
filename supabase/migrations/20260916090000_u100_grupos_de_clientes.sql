-- ═══════════════════════════════════════════════════════════════════════════
-- U100 — PORTARIA AUTÔNOMA E PORTARIA PRESENCIAL VIRAM GRUPOS DE CLIENTES (R173)
--
-- >>> RODAR NO SQL EDITOR DO SUPABASE, À MÃO. Idempotente.
-- >>> ORDEM: independe da U96/U99 (mexe só em dois CHECKs que existem desde a
-- >>>        U36 e a U71). Pode rodar a qualquer hora.
-- >>> ORDEM DE DEPLOY DO CÓDIGO: tanto faz. O app RENDERIZA os dois grupos
-- >>>        novos (rótulo, cor, filtro) mas NÃO os oferece — nem na ficha do
-- >>>        cliente, nem como grupo de uma atividade — até estes CHECKs
-- >>>        aceitá-los (clientes/data.ts: SERVICOS_NAO_OFERECIDOS). Depois de
-- >>>        rodar, a lista esvazia num commit de uma linha.
--
-- Davi, 04/09/2026 (Q23 — "portaria autônoma e presencial entram como grupos
-- de clientes, ou só como sistemas no catálogo?"): "Sim, entra no grupo de
-- clientes." Os grupos (R143) são o que o campo Cliente de uma atividade
-- oferece no topo da lista — "Clientes de Portaria Remota" —, contam no
-- histórico de cada cliente do grupo e põem o checklist deles na descrição.
--
-- Dois CHECKs guardam a lista, e os dois mudam juntos — senão o cadastro
-- aceita um serviço que a etiqueta da atividade recusa (ou vice-versa):
--   · clientes.servicos_prestados (U36): o que a Prever presta em cada cliente
--   · chamado_locais.setor (U71): a etiqueta de grupo numa atividade
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) o que a Prever presta no cliente ─────────────────────────────────────
ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_servicos_check;
ALTER TABLE public.clientes ADD CONSTRAINT clientes_servicos_check
  CHECK (servicos_prestados <@ ARRAY['portaria_remota', 'monitoramento_alarmes', 'portaria_autonoma', 'portaria_presencial']::text[]);

-- ── 2) a etiqueta de grupo na atividade ─────────────────────────────────────
ALTER TABLE public.chamado_locais DROP CONSTRAINT IF EXISTS chamado_locais_setor_check;
ALTER TABLE public.chamado_locais ADD CONSTRAINT chamado_locais_setor_check
  CHECK (setor IS NULL OR setor IN ('portaria_remota', 'monitoramento_alarmes', 'portaria_autonoma', 'portaria_presencial'));

-- ── Verificação ─────────────────────────────────────────────────────────────
WITH conferencia AS (
  SELECT 1 AS n, 'clientes_servicos_check aceita os quatro grupos' AS o_que,
         (SELECT CASE WHEN pg_get_constraintdef(c.oid) LIKE '%portaria_autonoma%'
                       AND pg_get_constraintdef(c.oid) LIKE '%portaria_presencial%'
                       AND pg_get_constraintdef(c.oid) LIKE '%portaria_remota%'
                       AND pg_get_constraintdef(c.oid) LIKE '%monitoramento_alarmes%' THEN 'sim' ELSE 'NAO' END
            FROM pg_constraint c
           WHERE c.conname = 'clientes_servicos_check' AND c.conrelid = 'public.clientes'::regclass) AS obtido,
         'sim' AS esperado
  UNION ALL
  SELECT 2, 'chamado_locais_setor_check aceita os quatro grupos',
         (SELECT CASE WHEN pg_get_constraintdef(c.oid) LIKE '%portaria_autonoma%'
                       AND pg_get_constraintdef(c.oid) LIKE '%portaria_presencial%'
                       AND pg_get_constraintdef(c.oid) LIKE '%portaria_remota%'
                       AND pg_get_constraintdef(c.oid) LIKE '%monitoramento_alarmes%' THEN 'sim' ELSE 'NAO' END
            FROM pg_constraint c
           WHERE c.conname = 'chamado_locais_setor_check' AND c.conrelid = 'public.chamado_locais'::regclass), 'sim'
  UNION ALL
  -- os dois CHECKs continuam VALIDADOS (nenhuma linha antiga fora da lista)
  SELECT 3, 'os dois CHECKs estão validados',
         (SELECT count(*)::text FROM pg_constraint
           WHERE conname IN ('clientes_servicos_check', 'chamado_locais_setor_check') AND convalidated), '2'
)
SELECT n, o_que, obtido, esperado,
       CASE WHEN obtido = esperado THEN 'ok' ELSE '>>> OLHAR <<<' END AS veredito
  FROM conferencia
 ORDER BY n;

-- ── DESFAZER (falha se já houver cliente ou etiqueta com os grupos novos — apague-os antes) ──
-- ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_servicos_check;
-- ALTER TABLE public.clientes ADD CONSTRAINT clientes_servicos_check
--   CHECK (servicos_prestados <@ ARRAY['portaria_remota', 'monitoramento_alarmes']::text[]);
-- ALTER TABLE public.chamado_locais DROP CONSTRAINT IF EXISTS chamado_locais_setor_check;
-- ALTER TABLE public.chamado_locais ADD CONSTRAINT chamado_locais_setor_check
--   CHECK (setor IS NULL OR setor IN ('portaria_remota', 'monitoramento_alarmes'));
