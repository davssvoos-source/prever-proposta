-- ═══════════════════════════════════════════════════════════════════════════
-- Uxxx — TÍTULO EM CAIXA ALTA: O QUE MUDA, EM UMA LINHA (Rnnn)
--
-- >>> RODAR NO SQL EDITOR DO SUPABASE, À MÃO. Idempotente.
-- >>> ORDEM: DEPOIS da Uyyy (ou: independe das anteriores). O pré-voo abaixo
-- >>>        aborta se a Uyyy não tiver rodado.
-- >>> ORDEM DE DEPLOY DO CÓDIGO: tanto faz — o app renderiza o valor novo mas
-- >>>        NÃO o oferece até este CHECK aceitá-lo (arquivo.ts:
-- >>>        LISTA_NAO_OFERECIDOS). Depois de rodar, a lista esvazia num commit.
--
-- O QUE E POR QUÊ, numerado, citando a regra e a frase do Davi:
--   1) …  (Rnnn — Davi, DD/MM/AAAA: "…")
--   2) …
-- O que NÃO faz, e por quê (o que se recusou a apagar/mudar aqui).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── GUARDAR CÓPIA (opcional; rodar ANTES, à parte) — só quando algo é apagado ─
-- CREATE TABLE public.arquivo_<tabela> AS SELECT * FROM public.<tabela>;

-- ── Pré-voo: a Uyyy tem de ter rodado ───────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = '<tabela>' AND column_name = '<coluna_da_uyyy>'
  ) THEN
    RAISE EXCEPTION 'Uxxx: rode a Uyyy antes — <tabela>.<coluna_da_uyyy> nao existe';
  END IF;
END $$;

-- ── 1) coluna nova ──────────────────────────────────────────────────────────
ALTER TABLE public.<tabela> ADD COLUMN IF NOT EXISTS <coluna> <tipo>;
COMMENT ON COLUMN public.<tabela>.<coluna> IS
  'Rnnn (Uxxx): o que é. Não confundir com <outra coluna>, que é <outra coisa> (Rmmm).';

-- ── 2) CHECK que ganha um valor (a lista COMPLETA, igual à do código) ───────
ALTER TABLE public.<tabela> DROP CONSTRAINT IF EXISTS <tabela>_<coluna>_check;
ALTER TABLE public.<tabela>
  ADD CONSTRAINT <tabela>_<coluna>_check
  CHECK (<coluna> IN ('a', 'b', 'c', 'novo'));

-- ── 3) semente de permissões (tela nova / tela que saiu) ────────────────────
-- Tela nova:
-- INSERT INTO public.permissoes_tela (tela, cargo, permitido) VALUES
--   ('chave', 'tecnico', false), ('chave', 'comercial', true), ('chave', 'sac', true)
-- ON CONFLICT (tela, cargo) DO NOTHING;
-- Tela que saiu (o arquivo entra em ARQUIVOS_SEMENTE do verificador):
-- DELETE FROM public.permissoes_tela WHERE tela IN ('chave');

-- ── 4) tabela nova (RLS desde o nascimento) ─────────────────────────────────
-- CREATE TABLE IF NOT EXISTS public.<nova> (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   …,
--   created_at timestamptz NOT NULL DEFAULT now(),
--   updated_at timestamptz NOT NULL DEFAULT now()
-- );
-- ALTER TABLE public.<nova> ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "<nova>_select" ON public.<nova>;
-- CREATE POLICY "<nova>_select" ON public.<nova> FOR SELECT TO authenticated USING (…);
-- (insert/update/delete idem — pensadas por cargo; capa nunca mais frouxa que corpo)

-- ── Verificação ─────────────────────────────────────────────────────────────
WITH conferencia AS (
  SELECT 1 AS n, 'a coluna existe e é <tipo>' AS o_que,
         (SELECT data_type FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = '<tabela>' AND column_name = '<coluna>') AS obtido,
         '<tipo>' AS esperado
  UNION ALL
  SELECT 2, 'o CHECK aceita o valor novo',
         (SELECT CASE WHEN pg_get_constraintdef(c.oid) LIKE '%''novo''%' THEN 'sim' ELSE 'NAO' END
            FROM pg_constraint c
           WHERE c.conname = '<tabela>_<coluna>_check' AND c.conrelid = 'public.<tabela>'::regclass), 'sim'
  UNION ALL
  SELECT 3, 'o CHECK está validado (nenhuma linha antiga fora da lista)',
         (SELECT CASE WHEN convalidated THEN 'sim' ELSE 'NAO' END FROM pg_constraint
           WHERE conname = '<tabela>_<coluna>_check'), 'sim'
)
SELECT n, o_que, obtido, esperado,
       CASE WHEN obtido = esperado THEN 'ok' ELSE '>>> OLHAR <<<' END AS veredito
  FROM conferencia
 ORDER BY n;

-- ── DESFAZER ────────────────────────────────────────────────────────────────
-- 1) ALTER TABLE public.<tabela> DROP COLUMN IF EXISTS <coluna>;
-- 2) ALTER TABLE public.<tabela> DROP CONSTRAINT IF EXISTS <tabela>_<coluna>_check;
--    ALTER TABLE public.<tabela> ADD CONSTRAINT <tabela>_<coluna>_check CHECK (<coluna> IN ('a', 'b', 'c'));
--    -- falha se já houver linha com 'novo': apague-as antes, de propósito
-- 3) INSERT INTO public.permissoes_tela … (as linhas apagadas, com os valores que tinham)
-- Dados apagados: NÃO há desfazer. A cópia opcional de "GUARDAR CÓPIA" devolve com
--   INSERT INTO public.<tabela> SELECT * FROM public.arquivo_<tabela>;
