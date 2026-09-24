-- ═══════════════════════════════════════════════════════════════════════
-- U158 — TICKET MÉDIO: a proposta passa a GRAVAR dois valores (R306)
-- 2026-09-23 · v1.0.3
-- ═══════════════════════════════════════════════════════════════════════
--
-- Davi, 23/09/2026 (respondendo à D1): "o valor anual recorrente, ou seja,
-- quanto o cliente paga por ano, e também o valor da implantação, que é o
-- investimento inicial de equipamentos e instalação, guardados separadamente."
--
-- Até aqui o valor da proposta nascia em gerarProposta.ts e morria no PDF
-- (R302 deixou o "ticket médio" de fora por isso). Duas colunas NULÁVEIS em
-- `visitas_tecnicas`, gravadas pela tela de pagamento no momento em que a
-- proposta é gerada (valoresDaProposta em src/features/comercial/ticket.ts):
--   · valor_anual_recorrente = 12 × total mensal da forma escolhida
--   · valor_implantacao      = locação: insumos + mão de obra; compra:
--                              equipamentos + mão de obra; comodato: 0
-- Propostas anteriores ficam NULL de propósito: o KPI conta só as que têm o
-- número, e diz quantas são. Nenhum backfill — inventar valor é fingir dado.
--
-- Idempotente. Não mexe em policy: as colunas herdam a RLS da tabela.
-- ═══════════════════════════════════════════════════════════════════════

-- ── PRÉ-VOO: o que existe hoje ─────────────────────────────────────────
SELECT 'propostas enviadas (candidatas a receber valor daqui em diante)' AS o_que,
       count(*)::text AS obtido
  FROM public.visitas_tecnicas WHERE proposta_enviada_em IS NOT NULL
UNION ALL
SELECT 'coluna valor_anual_recorrente ja existe?',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_schema = 'public' AND table_name = 'visitas_tecnicas'
                            AND column_name = 'valor_anual_recorrente') THEN 'sim' ELSE 'nao' END;

-- ── 1) AS DUAS COLUNAS ─────────────────────────────────────────────────
ALTER TABLE public.visitas_tecnicas
  ADD COLUMN IF NOT EXISTS valor_anual_recorrente numeric(14,2),
  ADD COLUMN IF NOT EXISTS valor_implantacao      numeric(14,2);

COMMENT ON COLUMN public.visitas_tecnicas.valor_anual_recorrente IS
  'R306 (U158): 12 x o total mensal da proposta na forma escolhida (servicos + locacao ou comodato). Gravado pela tela de pagamento ao gerar a proposta; NULL nas propostas anteriores a 23/09/2026.';
COMMENT ON COLUMN public.visitas_tecnicas.valor_implantacao IS
  'R306 (U158): o investimento inicial — locacao: insumos + mao de obra; compra: equipamentos + mao de obra; comodato: 0. Gravado junto com valor_anual_recorrente.';

-- valor negativo é erro de conta, não dado
DO $$
BEGIN
  ALTER TABLE public.visitas_tecnicas
    ADD CONSTRAINT visitas_tecnicas_valores_nao_negativos
    CHECK (valor_anual_recorrente IS NULL OR valor_anual_recorrente >= 0)
      NOT VALID;
  ALTER TABLE public.visitas_tecnicas VALIDATE CONSTRAINT visitas_tecnicas_valores_nao_negativos;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.visitas_tecnicas
    ADD CONSTRAINT visitas_tecnicas_implantacao_nao_negativa
    CHECK (valor_implantacao IS NULL OR valor_implantacao >= 0)
      NOT VALID;
  ALTER TABLE public.visitas_tecnicas VALIDATE CONSTRAINT visitas_tecnicas_implantacao_nao_negativa;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── CONFERÊNCIA: obtido × esperado × veredito ──────────────────────────
SELECT o_que, obtido, esperado,
       CASE WHEN obtido = esperado THEN 'OK' ELSE 'VERIFICAR' END AS veredito
FROM (
  SELECT 'as duas colunas existem' AS o_que,
         (SELECT count(*) FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'visitas_tecnicas'
             AND column_name IN ('valor_anual_recorrente', 'valor_implantacao'))::text AS obtido,
         '2' AS esperado
  UNION ALL
  SELECT 'os dois CHECKs de nao-negativo existem',
         (SELECT count(*) FROM pg_constraint
           WHERE conname IN ('visitas_tecnicas_valores_nao_negativos', 'visitas_tecnicas_implantacao_nao_negativa'))::text,
         '2'
  UNION ALL
  SELECT 'nenhuma proposta antiga ganhou valor inventado',
         (SELECT count(*) FROM public.visitas_tecnicas
           WHERE valor_anual_recorrente IS NOT NULL OR valor_implantacao IS NOT NULL)::text,
         '0'
) c;

-- ── DESFAZER (se precisar) ─────────────────────────────────────────────
-- ALTER TABLE public.visitas_tecnicas DROP CONSTRAINT IF EXISTS visitas_tecnicas_valores_nao_negativos;
-- ALTER TABLE public.visitas_tecnicas DROP CONSTRAINT IF EXISTS visitas_tecnicas_implantacao_nao_negativa;
-- ALTER TABLE public.visitas_tecnicas DROP COLUMN IF EXISTS valor_anual_recorrente;
-- ALTER TABLE public.visitas_tecnicas DROP COLUMN IF EXISTS valor_implantacao;
