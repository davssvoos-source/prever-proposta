-- ═══════════════════════════════════════════════════════════════════════════
-- U77 — O FIM DAS COLUNAS LEGADAS: a escala passa a ser a única verdade
--        (R98 — Fase 1, Passo 2 da absorção do Gestor OS)
--
-- >>> RODAR NO SQL EDITOR DO SUPABASE, À MÃO, DEPOIS DA U76 E DEPOIS DO DEPLOY.
-- >>> Idempotente: rodar de novo é no-op.
--
-- ── O QUE ELA FAZ ──────────────────────────────────────────────────────────
-- A U76 criou a escala semanal e deixou `duplas.membro_a/membro_b` como
-- ESPELHO LEGADO, mais uma ponte (`trg_duplas_espelhar_na_escala`) para a tela
-- antiga continuar funcionando na janela entre "rodei o SQL" e "o deploy
-- subiu". O deploy subiu: a tela nova escreve pela RPC `escala_definir`, e
-- ninguém mais lê nem escreve as duas colunas.
--
-- ── ESTE É O PONTO SEM VOLTA DA U76 ────────────────────────────────────────
-- O DESFAZER nível 1 da U76 (recriar os índices parciais e o trigger do caso
-- cruzado) depende de membro_a/membro_b existirem e estarem coerentes. Depois
-- desta migration ele DEIXA DE FUNCIONAR — e é por isso que ela é uma
-- migration separada, rodada num segundo momento, e não um parágrafo da U76.
-- Se a escala semanal ainda estiver em observação, NÃO RODE ESTA. Ela não tem
-- pressa: as colunas paradas não custam nada.
--
-- ── A PONTE PRECISA SAIR, E NÃO É SÓ FAXINA ────────────────────────────────
-- `trg_duplas_espelhar_na_escala` dispara em `AFTER INSERT OR UPDATE OF
-- membro_a, membro_b` — e o INSERT dispara SEMPRE, mesmo com as duas colunas
-- nulas. Como a ponte RECUSA quando a semana corrente já tem escala lançada
-- pela porta nova (era exatamente o ponto dela), cadastrar uma equipe nova
-- numa semana já lançada passaria a falhar com "a escala da semana X já foi
-- lançada". Enquanto esta migration não roda, esse é o único efeito colateral
-- conhecido do Passo 2 — barulhento, recuperável, e some aqui.
--
-- ── NADA SE PERDE ──────────────────────────────────────────────────────────
-- As colunas eram o último registro da composição das equipes DESFEITAS (a U76
-- não pôde incluí-las no backfill sem violar "uma pessoa por equipe por
-- semana"). O §1 copia isso para `duplas_composicao_legada` antes de dropar —
-- uma tabela de arquivo, sem FK e sem RLS de escrita, que existe para o dia em
-- que alguém perguntar "quem era a Equipe 3 que foi desfeita em julho?".
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- §0) TRAVA: esta migration não faz sentido antes da U76
-- ═══════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF to_regclass('public.duplas_escala') IS NULL THEN
    RAISE EXCEPTION E'ABORTADO — nada foi alterado (ROLLBACK).\nA U76 (escala semanal) não foi rodada neste banco. Rode-a primeiro: sem a escala, dropar membro_a/membro_b apagaria a composição das equipes sem deixar substituto.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.duplas_escala_semanas) THEN
    RAISE EXCEPTION E'ABORTADO — nada foi alterado (ROLLBACK).\nA escala está VAZIA: nenhuma semana foi aberta. Isso quer dizer que a U76 rodou mas o backfill não semeou, ou que alguém esvaziou as tabelas. Dropar as colunas agora deixaria o sistema sem composição nenhuma.';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- §1) O ARQUIVO — antes de dropar, guardar
-- ═══════════════════════════════════════════════════════════════════════
-- Tabela de arquivo morto: sem FK (para sobreviver a qualquer faxina futura em
-- profiles), sem gatilho, e com escrita fechada. Só leitura, e só para gestor —
-- é histórico de composição, e a mesma régua de `duplas` se aplica.
CREATE TABLE IF NOT EXISTS public.duplas_composicao_legada (
  dupla_id     uuid PRIMARY KEY,
  nome         text,
  ativa        boolean,
  membro_a     uuid,
  membro_b     uuid,
  nome_membro_a text,
  nome_membro_b text,
  arquivado_em timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.duplas_composicao_legada IS
  'ARQUIVO MORTO (U77): a composição fixa que morava em duplas.membro_a/membro_b '
  'até 2026-08-31, congelada antes de as colunas serem dropadas. Guarda os NOMES '
  'além dos ids porque é histórico — se o profile sumir, o nome ainda responde '
  '"quem era a Equipe 3 desfeita em julho". Não é fonte de verdade para nada: a '
  'composição viva é public.duplas_escala, por semana.';

-- Idempotente pelo ON CONFLICT: rodar de novo não sobrescreve o que já foi
-- arquivado (e depois do DROP não há mais o que copiar, então o INSERT
-- inteiro é pulado pelo guard abaixo).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'duplas'
                AND column_name = 'membro_a') THEN
    EXECUTE $sql$
      INSERT INTO public.duplas_composicao_legada
        (dupla_id, nome, ativa, membro_a, membro_b, nome_membro_a, nome_membro_b)
      SELECT d.id, d.nome, d.ativa, d.membro_a, d.membro_b, pa.nome, pb.nome
        FROM public.duplas d
        LEFT JOIN public.profiles pa ON pa.id = d.membro_a
        LEFT JOIN public.profiles pb ON pb.id = d.membro_b
       WHERE d.membro_a IS NOT NULL OR d.membro_b IS NOT NULL
      ON CONFLICT (dupla_id) DO NOTHING
    $sql$;
  END IF;
END $$;

ALTER TABLE public.duplas_composicao_legada ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.duplas_composicao_legada TO authenticated;
GRANT ALL    ON public.duplas_composicao_legada TO service_role;

DROP POLICY IF EXISTS "duplas_composicao_legada_select" ON public.duplas_composicao_legada;
CREATE POLICY "duplas_composicao_legada_select" ON public.duplas_composicao_legada
  FOR SELECT TO authenticated USING (public.is_gestor(auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════
-- §2) A PONTE SAI
-- ═══════════════════════════════════════════════════════════════════════
-- Ordem: trigger antes da função, senão o DROP FUNCTION exigiria CASCADE — e
-- CASCADE aqui derrubaria em silêncio qualquer outra coisa pendurada.
DROP TRIGGER  IF EXISTS trg_duplas_espelhar_na_escala ON public.duplas;
DROP FUNCTION IF EXISTS public.duplas_espelhar_na_escala();

-- ═══════════════════════════════════════════════════════════════════════
-- §3) AS COLUNAS SAEM
-- ═══════════════════════════════════════════════════════════════════════
-- `duplas_valida_membros()` foi mantida INERTE pela U76 só para o DESFAZER
-- nível 1 dela poder recriar o trigger com uma linha. O corpo dela referencia
-- membro_a/membro_b, então ela morre junto com as colunas — é a consequência
-- que o cabeçalho anuncia como o ponto sem volta.
DROP FUNCTION IF EXISTS public.duplas_valida_membros() CASCADE;

-- SEM CASCADE, de propósito: se alguma view ou constraint tiver passado a
-- depender destas colunas desde a U76, o Postgres RECUSA o drop e a migration
-- aborta inteira — que é melhor do que a dependência sumir sem ninguém ver.
ALTER TABLE public.duplas DROP COLUMN IF EXISTS membro_a;
ALTER TABLE public.duplas DROP COLUMN IF EXISTS membro_b;

COMMENT ON TABLE public.duplas IS
  'Equipe de campo (U47/R56 → U76/U77). NOME e VEÍCULO são da turma; a '
  'COMPOSIÇÃO é POR SEMANA e mora em public.duplas_escala — desde a U77 não há '
  'mais nenhuma outra. A equipe de um chamado continua DERIVADA do responsável: '
  'não existe chamados.dupla_id, e continua não existindo de propósito. Na tela '
  'o rótulo é "Equipe de campo"; no banco a palavra "equipe" está ocupada por '
  'DEPARTAMENTO desde a U71.';

-- ═══════════════════════════════════════════════════════════════════════
-- §4) CONFERÊNCIA
-- ═══════════════════════════════════════════════════════════════════════
SELECT 'as colunas legadas saíram' AS conferencia,
       (SELECT count(*)::text FROM information_schema.columns
         WHERE table_schema='public' AND table_name='duplas'
           AND column_name IN ('membro_a','membro_b')) AS valor,
       '0' AS esperado
UNION ALL
SELECT 'a ponte da tela antiga saiu',
       (SELECT count(*)::text FROM pg_trigger
         WHERE tgrelid='public.duplas'::regclass
           AND tgname='trg_duplas_espelhar_na_escala'), '0'
UNION ALL
SELECT 'e a função dela também',
       (to_regprocedure('public.duplas_espelhar_na_escala()') IS NULL)::text, 'true'
UNION ALL
SELECT 'duplas_valida_membros() saiu (o corpo lia as colunas)',
       (to_regprocedure('public.duplas_valida_membros()') IS NULL)::text, 'true'
UNION ALL
SELECT 'os gatilhos que FICAM em duplas (updated_at + desativar)',
       (SELECT count(*)::text FROM pg_trigger
         WHERE tgrelid='public.duplas'::regclass AND NOT tgisinternal), '2'
UNION ALL
SELECT 'CRÍTICO: a escala continua inteira — nada aqui a tocou',
       (SELECT count(*)::text FROM public.duplas_escala), '(igual a antes)'
UNION ALL
SELECT 'semanas decididas',
       (SELECT count(*)::text FROM public.duplas_escala_semanas), '(igual a antes)'
UNION ALL
SELECT 'equipes arquivadas (as que tinham composição fixa)',
       (SELECT count(*)::text FROM public.duplas_composicao_legada), '(as que existiam)';

-- O arquivo, para conferir a olho antes de fechar a aba. As DESFEITAS são o
-- motivo de a tabela existir: a composição delas não estava em lugar nenhum.
SELECT nome AS equipe,
       CASE WHEN ativa THEN 'ativa' ELSE 'desfeita' END AS situacao,
       COALESCE(nome_membro_a, '—') AS membro_a_congelado,
       COALESCE(nome_membro_b, '—') AS membro_b_congelado,
       (SELECT count(*) FROM public.duplas_escala e WHERE e.dupla_id = l.dupla_id) AS linhas_de_escala
  FROM public.duplas_composicao_legada l
 ORDER BY ativa DESC, nome;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- DESFAZER
--
-- As colunas voltam VAZIAS e depois são repovoadas pelo arquivo do §1. O que
-- NÃO volta é a coerência com a realidade: entre a U77 e o desfazer, a escala
-- continuou andando, e membro_a/membro_b vão descrever o dia em que a U76
-- rodou. Se a intenção é voltar ao mundo da composição fixa, o caminho é este
-- e depois o DESFAZER nível 1 da U76 — nessa ordem, e conferindo os duplicados
-- que ele manda conferir (a escala pode ter posto a mesma pessoa em equipes
-- diferentes em semanas diferentes, que é justamente o que a U47 proibia).
-- ═══════════════════════════════════════════════════════════════════════════

-- BEGIN;
--
-- ALTER TABLE public.duplas ADD COLUMN IF NOT EXISTS membro_a uuid REFERENCES public.profiles(id);
-- ALTER TABLE public.duplas ADD COLUMN IF NOT EXISTS membro_b uuid REFERENCES public.profiles(id);
--
-- UPDATE public.duplas d
--    SET membro_a = l.membro_a, membro_b = l.membro_b
--   FROM public.duplas_composicao_legada l
--  WHERE l.dupla_id = d.id;
--
-- -- as equipes criadas DEPOIS da U77 não estão no arquivo: puxa a composição
-- -- da semana corrente, que é o mais próximo da verdade que existe
-- UPDATE public.duplas d
--    SET membro_a = x.a, membro_b = x.b
--   FROM (SELECT e.dupla_id,
--                (array_agg(e.pessoa_id ORDER BY e.ordem))[1] AS a,
--                (array_agg(e.pessoa_id ORDER BY e.ordem))[2] AS b
--           FROM public.duplas_escala e
--          WHERE e.semana = public.referencia_semanal((now() AT TIME ZONE 'America/Sao_Paulo')::date)
--          GROUP BY e.dupla_id) x
--  WHERE x.dupla_id = d.id AND d.membro_a IS NULL;
--
-- -- CONFERIR antes de seguir para o DESFAZER nível 1 da U76:
-- SELECT id, nome FROM public.duplas WHERE ativa AND membro_a IS NULL;
--
-- COMMIT;
--
-- A ponte (trg_duplas_espelhar_na_escala) e duplas_valida_membros() NÃO são
-- recriadas aqui: os corpos estão na U76, e recriá-las só faz sentido dentro
-- do DESFAZER dela.
