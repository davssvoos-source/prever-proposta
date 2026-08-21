-- ═══════════════════════════════════════════════════════════════════════════
-- ESTADO DAS MIGRATIONS — cola no SQL Editor e lê a coluna "situação".
--
-- Não altera nada: é só leitura. Serve para responder "rodei tudo?" sem ter
-- que reabrir migration por migration. A coluna `situação` já vem com o
-- veredito escrito — OK ou FALTA — para não depender de comparar números
-- de cabeça.
--
-- As linhas que dependem de RLS (permissões) só podem ser conferidas aqui
-- dentro: pela API pública elas voltam vazias mesmo quando existem.
-- ═══════════════════════════════════════════════════════════════════════════

WITH checagens AS (
  -- ── U27 · Prospecção ────────────────────────────────────────────────────
  SELECT 1 AS ord, 'U27' AS migration, 'tabela prospeccoes' AS item,
         (to_regclass('public.prospeccoes') IS NOT NULL) AS passou,
         'existe' AS esperado
  UNION ALL
  SELECT 2, 'U27', 'coluna visitas_tecnicas.prospeccao_id',
         EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='visitas_tecnicas'
                    AND column_name='prospeccao_id'), 'existe'
  UNION ALL
  SELECT 3, 'U27', 'função registrar_resultado_proposta',
         EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                  WHERE n.nspname='public' AND p.proname='registrar_resultado_proposta'), 'existe'

  -- ── U28 · Três painéis (matriz de permissões) ───────────────────────────
  UNION ALL
  SELECT 4, 'U28', 'linhas painel.* na matriz',
         (SELECT count(*) FROM public.permissoes_tela WHERE tela LIKE 'painel.%') = 6,
         '6 (eram 9; a U30 apaga as 3 de painel.comercial)'

  -- ── U29 · Proposta é chamado ────────────────────────────────────────────
  UNION ALL
  SELECT 5, 'U29', 'FK visitas_e_chamado',
         EXISTS (SELECT 1 FROM pg_constraint WHERE conname='visitas_e_chamado'), 'existe'
  UNION ALL
  SELECT 6, 'U29', 'toda visita tem chamado-capa',
         NOT EXISTS (SELECT 1 FROM public.visitas_tecnicas v
                      WHERE NOT EXISTS (SELECT 1 FROM public.chamados c WHERE c.id=v.id)),
         '0 visitas órfãs'
  UNION ALL
  SELECT 7, 'U29', 'trigger de sincronia da visita',
         EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_sincronizar_chamado_da_visita'), 'existe'
  UNION ALL
  SELECT 8, 'U29', 'chamado comercial sem número',
         NOT EXISTS (SELECT 1 FROM public.chamados
                      WHERE natureza='comercial' AND (numero IS NULL OR numero='')), '0'
  UNION ALL
  SELECT 9, 'U29', 'check aceita natureza comercial',
         EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname='chamados_natureza_check'
                    AND pg_get_constraintdef(oid) LIKE '%comercial%'), 'aceita'

  -- ── U30 · Fusão de telas ────────────────────────────────────────────────
  UNION ALL
  SELECT 10, 'U30', 'telas mortas removidas da matriz',
         NOT EXISTS (SELECT 1 FROM public.permissoes_tela
                      WHERE tela IN ('chamados','chamados.indicadores','painel.comercial')),
         '0 linhas órfãs'
  UNION ALL
  SELECT 11, 'U30', 'SAC abre a página comercial (/gerencial)',
         COALESCE((SELECT permitido FROM public.permissoes_tela
                    WHERE tela='gerencial' AND cargo='sac'), false), 'true'
)
SELECT migration,
       item,
       esperado,
       CASE WHEN passou THEN '✅ OK' ELSE '❌ FALTA' END AS situacao
  FROM checagens
 ORDER BY ord;
