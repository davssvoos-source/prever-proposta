-- ═══════════════════════════════════════════════════════════════════════════
-- U96 — A ESTRUTURA DAS ATIVIDADES (R137–R150, Davi, 2026-09-03)
-- ═══════════════════════════════════════════════════════════════════════════
-- Roda depois da U95. Idempotente: pode rodar duas vezes sem estrago.
--
-- O que ela faz, na ordem:
--   1) chamados.impacto_operacional (R142) — a régua de urgência FORA da área
--      técnica: sem_impacto · baixo · moderado · critico. Só corretiva e
--      operacional a usam; o app decide isso, o banco só guarda e valida.
--   2) chamados.proposta_id (R148) — a proposta comercial aprovada que origina
--      uma implantação. Por enquanto é o vínculo; a leitura do PDF pela IA vem
--      depois.
--   3) O PEDIDO DE COMPRA SAI (R140). Davi: "remova isso do nosso sistema".
--        · os dois gatilhos que criavam a ficha caem;
--        · todo chamado com tipo 'pedido_compra' vira 'operacional' — é o que a
--          R48 já mandava abrir no lugar dele desde agosto;
--        · o CHECK de tipo perde 'pedido_compra' e 'proposta_comercial' (morto
--          desde a U41; qualquer sobrevivente vira 'prospeccao' antes);
--        · o job diário de "pedido parado" é desagendado;
--        · a tabela chamado_compra FICA, como ARQUIVO — apagá-la seria destruir
--          histórico sem o Davi pedir. A RPC de decidir perde o EXECUTE de
--          authenticated: ninguém decide compra pelo app.
--   4) O bucket `clientes-fachadas` (R146): a foto da fachada do cliente,
--      privado como todos desde a S1 — lida por qualquer autenticado, escrita e
--      apagada só por gestor.
--
-- O que ela NÃO faz, de propósito:
--   · não apaga chamados.sprint nem chamados.equipe — a R141 e a R139 mudam
--     QUEM escreve (ninguém / o app, a partir do responsável), não o schema;
--   · não apaga chamado_compra nem chamado_equipes (histórico — ver
--     PENDENCIAS_TECNICAS.md);
--   · não toca em data_hora_agendada (a R101 continua inteira).
--
-- DESFAZER: no rodapé.

-- ═══════════════════════════════════════════════════════════════════════
-- 1) IMPACTO OPERACIONAL (R142)
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE public.chamados ADD COLUMN IF NOT EXISTS impacto_operacional text;

ALTER TABLE public.chamados DROP CONSTRAINT IF EXISTS chamados_impacto_operacional_check;
ALTER TABLE public.chamados ADD CONSTRAINT chamados_impacto_operacional_check
  CHECK (impacto_operacional IS NULL
         OR impacto_operacional IN ('sem_impacto','baixo','moderado','critico'));

COMMENT ON COLUMN public.chamados.impacto_operacional IS
  'R142 (U96): urgência das atividades fora da área técnica — sem_impacto · baixo · moderado · critico. '
  'Só corretiva e operacional têm (implantação, preventiva, melhoria e proposta não). '
  'No campo continua valendo `prioridade` (SLA, R112).';

-- ═══════════════════════════════════════════════════════════════════════
-- 2) A PROPOSTA DE ORIGEM DA IMPLANTAÇÃO (R148)
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE public.chamados ADD COLUMN IF NOT EXISTS proposta_id uuid
  REFERENCES public.visitas_tecnicas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS chamados_proposta_idx
  ON public.chamados (proposta_id) WHERE proposta_id IS NOT NULL;

COMMENT ON COLUMN public.chamados.proposta_id IS
  'R148 (U96): a proposta comercial (visita técnica com proposta enviada) que originou esta implantação. '
  'Vínculo por enquanto; a criação automática das atividades a partir do PDF da proposta vem depois.';

-- ═══════════════════════════════════════════════════════════════════════
-- 3) O PEDIDO DE COMPRA SAI (R140)
-- ═══════════════════════════════════════════════════════════════════════
-- 3a) os gatilhos da ficha — antes do remap, senão o UPDATE de tipo abaixo
--     ainda acordaria o de UPDATE (que só dispara QUANDO NEW.tipo = 'pedido_compra',
--     então não acordaria; cai pela ordem, por clareza)
DROP TRIGGER IF EXISTS trg_chamado_ficha_compra_ins ON public.chamados;
DROP TRIGGER IF EXISTS trg_chamado_ficha_compra_upd ON public.chamados;

-- 3b) o remap, com os gatilhos de usuário DESLIGADOS (CLAUDE.md: mexer em dado
--     histórico com gatilho ligado rende sinos e linha do tempo para todo mundo)
DO $$
BEGIN
  ALTER TABLE public.chamados DISABLE TRIGGER USER;
  UPDATE public.chamados SET tipo = 'operacional' WHERE tipo = 'pedido_compra';
  UPDATE public.chamados SET tipo = 'prospeccao'  WHERE tipo = 'proposta_comercial';
  ALTER TABLE public.chamados ENABLE TRIGGER USER;
EXCEPTION WHEN OTHERS THEN
  ALTER TABLE public.chamados ENABLE TRIGGER USER;
  RAISE;
END $$;

-- 3c) o CHECK sem os dois valores mortos (a lista viva da U83, menos eles).
--     PRÉ-VOO (a regra da U83, herdada): ABORTA sem mexer em nada se
--       · a constraint não existe (tipo virou texto livre — descubra quem a
--         removeu antes de recriar);
--       · o CHECK vivo não é o da U83 (alguém trocou a lista por fora, e
--         recriar aqui apagaria um valor que não conhecemos);
--       · depois do remap ainda existe linha com tipo fora da lista NOVA (o
--         ADD CONSTRAINT falharia na validação — melhor a frase certa).
DO $$
DECLARE
  v_def   text;
  v_fora  int;
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO v_def
    FROM pg_constraint c
   WHERE c.conrelid = 'public.chamados'::regclass AND c.conname = 'chamados_tipo_check';
  IF v_def IS NULL THEN
    RAISE EXCEPTION E'PRÉ-VOO U96 — nada foi alterado (ROLLBACK).\nA constraint chamados_tipo_check NÃO existe em public.chamados.\nO QUE FAZER: descubra quem a removeu (SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = ''public.chamados''::regclass) antes de recriar. NÃO force.';
  END IF;
  -- o conjunto da U83 (a ordem dentro do IN não importa; o conjunto importa).
  -- Já rodou uma vez? Então o CHECK é o desta migration e o passo é pulado.
  IF v_def LIKE '%''pedido_compra''%' AND (
       v_def NOT LIKE '%''corretiva''%' OR v_def NOT LIKE '%''preventiva''%'
    OR v_def NOT LIKE '%''operacional''%' OR v_def NOT LIKE '%''implantacao''%'
    OR v_def NOT LIKE '%''vistoria''%' OR v_def NOT LIKE '%''melhoria''%'
    OR v_def NOT LIKE '%''proposta_comercial''%' OR v_def NOT LIKE '%''prospeccao''%') THEN
    RAISE EXCEPTION E'PRÉ-VOO U96 — nada foi alterado (ROLLBACK).\nchamados_tipo_check não é a versão da U83: o conjunto de valores aceitos não é o esperado.\nCHECK vivo: %\nO QUE FAZER: descubra quem o trocou e reescreva o §3c com a lista CERTA antes de rodar. NÃO force.', v_def;
  END IF;
  SELECT count(*) INTO v_fora FROM public.chamados
   WHERE tipo NOT IN ('corretiva','preventiva','operacional','implantacao','vistoria','melhoria','prospeccao');
  IF v_fora > 0 THEN
    RAISE EXCEPTION E'PRÉ-VOO U96 — nada foi alterado (ROLLBACK).\n% linha(s) de chamados com tipo fora da lista nova mesmo depois do remap (SELECT tipo, count(*) FROM public.chamados GROUP BY 1).\nO QUE FAZER: entenda de onde veio esse valor antes de apertar o CHECK.', v_fora;
  END IF;
END $$;

ALTER TABLE public.chamados DROP CONSTRAINT IF EXISTS chamados_tipo_check;
ALTER TABLE public.chamados ADD CONSTRAINT chamados_tipo_check
  CHECK (tipo IN ('corretiva','preventiva','operacional','implantacao','vistoria','melhoria','prospeccao'));

-- 3d) o job de "pedido parado" (u9 §5) — sem pedido, sem alerta
DO $$
BEGIN
  PERFORM cron.unschedule('alertas-compras');
  RAISE NOTICE 'job alertas-compras desagendado';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'job alertas-compras nao desagendado (%): se nao existe, esta certo', SQLERRM;
END $$;

-- 3e) a ficha vira arquivo; a decisão de compra deixa de ser chamável pelo app
COMMENT ON TABLE public.chamado_compra IS
  'ARQUIVO (R140/U96): o pedido de compra saiu do sistema. As fichas ficam como histórico; '
  'nenhuma tela lê ou escreve aqui. Os chamados que eram pedido_compra viraram operacional.';
REVOKE EXECUTE ON FUNCTION public.decidir_pedido_compra(uuid, text, text, numeric) FROM authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 4) A FOTO DA FACHADA DO CLIENTE (R146) — bucket privado
-- ═══════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public) VALUES ('clientes-fachadas','clientes-fachadas',false)
  ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'bucket clientes-fachadas nao criado por SQL (%): crie no dashboard como PRIVADO.', SQLERRM;
END $$;

-- Lê quem está autenticado (a lista de clientes mostra a fachada a todos que
-- veem a lista); escreve e apaga quem é gestor — a ficha do cliente já é dele.
DROP POLICY IF EXISTS "clientes_fachadas_read"   ON storage.objects;
DROP POLICY IF EXISTS "clientes_fachadas_insert" ON storage.objects;
DROP POLICY IF EXISTS "clientes_fachadas_update" ON storage.objects;
DROP POLICY IF EXISTS "clientes_fachadas_delete" ON storage.objects;
CREATE POLICY "clientes_fachadas_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'clientes-fachadas');
CREATE POLICY "clientes_fachadas_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'clientes-fachadas' AND public.is_gestor(auth.uid()));
CREATE POLICY "clientes_fachadas_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'clientes-fachadas' AND public.is_gestor(auth.uid()));
CREATE POLICY "clientes_fachadas_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'clientes-fachadas' AND public.is_gestor(auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — valor obtido × esperado × veredito (RAISE NOTICE é invisível
-- no editor do Supabase; a linha que não casou aparece como ">>> OLHAR <<<")
-- ═══════════════════════════════════════════════════════════════════════
WITH conferencia AS (
SELECT 1 AS n, 'impacto_operacional existe em chamados' AS o_que,
       (SELECT count(*)::text FROM information_schema.columns
         WHERE table_schema='public' AND table_name='chamados' AND column_name='impacto_operacional') AS obtido,
       '1' AS esperado
UNION ALL
SELECT 2, 'proposta_id existe em chamados',
       (SELECT count(*)::text FROM information_schema.columns
         WHERE table_schema='public' AND table_name='chamados' AND column_name='proposta_id'), '1'
UNION ALL
SELECT 3, 'nenhum chamado continua pedido_compra ou proposta_comercial',
       (SELECT count(*)::text FROM public.chamados WHERE tipo IN ('pedido_compra','proposta_comercial')), '0'
UNION ALL
-- a LISTA INTEIRA extraída do catálogo, não um LIKE: presença do valor novo não
-- vê a remoção de um antigo (regra 2 da U83)
SELECT 4, 'o CHECK vivo de tipo é EXATAMENTE a lista da U96 (sem pedido_compra nem proposta_comercial)',
       -- COLLATE "C": a mesma ordem do sort() de JS — o verificador compara os dois lados
       (SELECT string_agg(v, ',' ORDER BY v COLLATE "C")
          FROM pg_constraint c,
               regexp_matches(pg_get_constraintdef(c.oid), '''([a-z_]+)''', 'g') AS m(v)
         WHERE c.conrelid = 'public.chamados'::regclass AND c.conname = 'chamados_tipo_check'),
       'corretiva,implantacao,melhoria,operacional,preventiva,prospeccao,vistoria'
UNION ALL
-- uma constraint NOT VALID passa por todas as outras conferências sem proteger uma linha
SELECT 5, 'e o CHECK de tipo está VALIDADO (convalidated)',
       (SELECT convalidated::text FROM pg_constraint
         WHERE conrelid = 'public.chamados'::regclass AND conname = 'chamados_tipo_check'), 'true'
UNION ALL
SELECT 6, 'os gatilhos da ficha de compra caíram',
       (SELECT count(*)::text FROM pg_trigger t
         WHERE t.tgrelid = 'public.chamados'::regclass AND t.tgname LIKE 'trg_chamado_ficha_compra%'), '0'
UNION ALL
SELECT 7, 'bucket clientes-fachadas existe e é privado',
       (SELECT CASE WHEN public THEN 'PUBLICO' ELSE 'privado' END FROM storage.buckets WHERE id = 'clientes-fachadas'), 'privado'
UNION ALL
SELECT 8, 'policies do bucket clientes-fachadas',
       (SELECT count(*)::text FROM pg_policies
         WHERE schemaname='storage' AND tablename='objects' AND policyname LIKE 'clientes_fachadas_%'), '4'
UNION ALL
SELECT 9, 'authenticated NÃO executa mais decidir_pedido_compra',
       (SELECT CASE WHEN has_function_privilege('authenticated',
               'public.decidir_pedido_compra(uuid, text, text, numeric)', 'EXECUTE') THEN 'EXECUTA' ELSE 'nao executa' END), 'nao executa'
)
SELECT n, o_que, obtido, esperado,
       CASE WHEN obtido = esperado THEN 'ok' ELSE '>>> OLHAR <<<' END AS veredito
  FROM conferencia
 ORDER BY n;

-- ═══════════════════════════════════════════════════════════════════════
-- DESFAZER (só o que é reversível; o remap de tipo volta pela ficha)
-- ═══════════════════════════════════════════════════════════════════════
-- Só funciona enquanto nenhum chamado novo tiver nascido com impacto ou
-- proposta gravados que alguém queira manter — as duas colunas caem inteiras.
-- 1) o CHECK de tipo volta à lista da U83: reaplique o §3 de
--    20260906090000_u83_vistoria.sql (a lista está lá, não repetida aqui de
--    propósito — o censo do verificador lê a ÚLTIMA lista literal do diretório).
-- 2) quem tinha ficha ERA pedido de compra: é o que faz o remap ser reversível
-- UPDATE public.chamados c SET tipo = 'pedido_compra'
--   FROM public.chamado_compra cp WHERE cp.chamado_id = c.id AND c.tipo = 'operacional';
-- CREATE TRIGGER trg_chamado_ficha_compra_ins AFTER INSERT ON public.chamados
--   FOR EACH ROW EXECUTE FUNCTION public.chamado_criar_ficha_compra();
-- CREATE TRIGGER trg_chamado_ficha_compra_upd AFTER UPDATE OF tipo ON public.chamados
--   FOR EACH ROW WHEN (NEW.tipo = 'pedido_compra') EXECUTE FUNCTION public.chamado_criar_ficha_compra();
-- GRANT EXECUTE ON FUNCTION public.decidir_pedido_compra(uuid, text, text, numeric) TO authenticated;
-- SELECT public.agendar_job('alertas-compras', '30 10 * * 1-5', 'SELECT public.alertas_compras(5);');
-- ALTER TABLE public.chamados DROP CONSTRAINT IF EXISTS chamados_impacto_operacional_check;
-- ALTER TABLE public.chamados DROP COLUMN IF EXISTS impacto_operacional;
-- DROP INDEX IF EXISTS public.chamados_proposta_idx;
-- ALTER TABLE public.chamados DROP COLUMN IF EXISTS proposta_id;
-- DROP POLICY IF EXISTS "clientes_fachadas_read"   ON storage.objects;
-- DROP POLICY IF EXISTS "clientes_fachadas_insert" ON storage.objects;
-- DROP POLICY IF EXISTS "clientes_fachadas_update" ON storage.objects;
-- DROP POLICY IF EXISTS "clientes_fachadas_delete" ON storage.objects;
-- -- o bucket só sai vazio: DELETE FROM storage.buckets WHERE id = 'clientes-fachadas';
