-- ═══════════════════════════════════════════════════════════════════════════
-- U125 — v0.0.7: a CAPA do chamado nasce ANTES da visita (é o que a chave
-- estrangeira exige), e já registra o LOCAL da proposta
-- ═══════════════════════════════════════════════════════════════════════════
--
-- O DEFEITO (Davi, 09/09/2026, print da tela): "insert or update on table
-- visitas_tecnicas violates foreign key constraint visitas_e_chamado".
--
-- A U29 fez a visita ser SATÉLITE do chamado: `visitas_tecnicas.id` É o id do
-- chamado, e a FK `visitas_e_chamado` (id → chamados.id) garante que não sobre
-- visita órfã. Quem cria a capa é o gatilho `sincronizar_chamado_da_visita`,
-- que a U29 armou como **AFTER INSERT** — e aí está o defeito:
--
--   uma FK não-deferrável do PostgreSQL é conferida por um gatilho INTERNO
--   (RI_ConstraintTrigger_c_…) que entra na MESMA fila de AFTER e dispara em
--   ordem de NOME. "RI_…" vem antes de "trg_…": a conferência acontece com a
--   capa ainda inexistente, e o INSERT morre. Ou seja: desde a U29 (21/08/2026)
--   NENHUMA visita podia ser criada pelo app — nem por esta tela, nem pelo
--   diálogo de visita, porque nenhuma das duas manda `id`.
--
-- Ninguém tinha visto porque o caminho estava interrompido ANTES: prédio novo
-- morria no INSERT de `clientes` (R21, consertado na U124), e o primeiro erro
-- esconde o segundo. É a terceira camada do mesmo caminho — a P44 consertou a
-- primeira, a U124 a segunda, esta é a terceira.
--
-- §1  A capa passa a nascer num gatilho **BEFORE INSERT**: quando a linha da
--     visita entra, a capa já existe e a FK confere. A sincronização continua
--     AFTER UPDATE, como era. A FUNÇÃO NÃO MUDA — ela já fazia
--     `INSERT … ON CONFLICT DO UPDATE` e devolvia NEW, que é o que um BEFORE
--     precisa; muda a hora em que ela roda.
-- §2  A capa passa a registrar o LOCAL em `chamado_locais` (cliente OU
--     prospecção, R22/U124): sem isso o card da Início mostra a proposta sem
--     lugar — `chamados` não tem `prospeccao_id`, quem guarda as três formas de
--     local é `chamado_locais`.
-- §3  Backfill do local para as visitas que já existem e não têm nenhum.
--
-- PRÉ-VOO: exige `visitas_tecnicas`, `chamado_locais` (U71) e a função da U38.
-- IDEMPOTENTE. Termina com a conferência (>>> OLHAR <<<) e o DESFAZER.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $u125pre$
BEGIN
  IF to_regclass('public.chamado_locais') IS NULL THEN
    RAISE EXCEPTION 'U125: chamado_locais não existe — rode a U71 primeiro.';
  END IF;
  IF to_regprocedure('public.sincronizar_chamado_da_visita()') IS NULL THEN
    RAISE EXCEPTION 'U125: sincronizar_chamado_da_visita não existe — rode a U29/U38 primeiro.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.visitas_tecnicas'::regclass AND conname = 'visitas_e_chamado'
  ) THEN
    RAISE EXCEPTION 'U125: a FK visitas_e_chamado não existe — rode a U29 primeiro.';
  END IF;
END
$u125pre$;

-- ── §1  A CAPA NASCE ANTES ─────────────────────────────────────────────────
-- Um gatilho por evento, a MESMA função: BEFORE INSERT cria; AFTER UPDATE
-- mantém em dia. O gatilho único da U38 (AFTER INSERT OR UPDATE) sai.
DROP TRIGGER IF EXISTS trg_sincronizar_chamado_da_visita ON public.visitas_tecnicas;

DROP TRIGGER IF EXISTS trg_capa_da_visita ON public.visitas_tecnicas;
CREATE TRIGGER trg_capa_da_visita
  BEFORE INSERT ON public.visitas_tecnicas
  FOR EACH ROW EXECUTE FUNCTION public.sincronizar_chamado_da_visita();

CREATE TRIGGER trg_sincronizar_chamado_da_visita
  AFTER UPDATE OF status, proposta_resultado, proposta_enviada_em,
                  data_hora_agendada, titulo, nome_predio,
                  cliente_id, tecnico_id, prioridade
  ON public.visitas_tecnicas
  FOR EACH ROW EXECUTE FUNCTION public.sincronizar_chamado_da_visita();

-- ── §2  A CAPA REGISTRA O LOCAL ────────────────────────────────────────────
-- Só no nascimento da visita, e só se ainda não houver local: quem edita local
-- depois é a tela (adicionarClienteChamado / mexerLocal), e um gatilho que
-- reescrevesse isso a cada UPDATE apagaria escolha de gente.
CREATE OR REPLACE FUNCTION public.registrar_local_da_visita()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $u125f$
BEGIN
  IF NEW.cliente_id IS NULL AND NEW.prospeccao_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.chamado_locais WHERE chamado_id = NEW.id) THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.chamado_locais (chamado_id, cliente_id, prospeccao_id)
  VALUES (NEW.id, NEW.cliente_id, NEW.prospeccao_id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END
$u125f$;

COMMENT ON FUNCTION public.registrar_local_da_visita() IS
  'R22 (U125): a capa da visita ganha o local em chamado_locais — cliente da base ou prospecção. Roda só no INSERT da visita e só se não houver local, para não apagar escolha feita na tela.';

DROP TRIGGER IF EXISTS trg_local_da_visita ON public.visitas_tecnicas;
CREATE TRIGGER trg_local_da_visita
  AFTER INSERT ON public.visitas_tecnicas
  FOR EACH ROW EXECUTE FUNCTION public.registrar_local_da_visita();

-- ── §3  BACKFILL — as visitas que já existem e estão sem local ─────────────
INSERT INTO public.chamado_locais (chamado_id, cliente_id, prospeccao_id, created_at)
SELECT v.id, v.cliente_id, v.prospeccao_id, COALESCE(v.created_at, now())
  FROM public.visitas_tecnicas v
 WHERE num_nonnulls(v.cliente_id, v.prospeccao_id) = 1
   AND EXISTS (SELECT 1 FROM public.chamados c WHERE c.id = v.id)
   AND NOT EXISTS (SELECT 1 FROM public.chamado_locais cl WHERE cl.chamado_id = v.id)
ON CONFLICT DO NOTHING;

COMMIT;

-- ── CONFERÊNCIA (obtido × esperado × veredito) ──────────────────────────────
WITH conferencia AS (
  SELECT 'a capa nasce ANTES da visita (gatilho BEFORE INSERT)' AS item,
         (SELECT CASE WHEN tgtype & 2 = 2 THEN 'before' ELSE 'after' END
            FROM pg_trigger
           WHERE tgrelid = 'public.visitas_tecnicas'::regclass
             AND tgname = 'trg_capa_da_visita' AND NOT tgisinternal) AS obtido,
         'before' AS esperado
  UNION ALL
  SELECT 'a sincronização continua no UPDATE (e só nele)',
         (SELECT CASE WHEN tgtype & 4 = 4 THEN 'insert+' ELSE 'só update' END
            FROM pg_trigger
           WHERE tgrelid = 'public.visitas_tecnicas'::regclass
             AND tgname = 'trg_sincronizar_chamado_da_visita' AND NOT tgisinternal), 'só update'
  UNION ALL
  SELECT 'o gatilho do local está armado',
         (SELECT count(*)::text FROM pg_trigger
           WHERE tgrelid = 'public.visitas_tecnicas'::regclass
             AND tgname = 'trg_local_da_visita' AND NOT tgisinternal), '1'
  UNION ALL
  SELECT 'a FK visitas_e_chamado continua de pé (a visita segue satélite)',
         (SELECT count(*)::text FROM pg_constraint
           WHERE conrelid = 'public.visitas_tecnicas'::regclass AND conname = 'visitas_e_chamado'), '1'
  UNION ALL
  SELECT 'visita sem capa (a FK garante 0)',
         (SELECT count(*)::text FROM public.visitas_tecnicas v
           WHERE NOT EXISTS (SELECT 1 FROM public.chamados c WHERE c.id = v.id)), '0'
  UNION ALL
  SELECT 'visita com cliente ou prospecção e AINDA sem local (o backfill zera)',
         (SELECT count(*)::text FROM public.visitas_tecnicas v
           WHERE num_nonnulls(v.cliente_id, v.prospeccao_id) = 1
             AND NOT EXISTS (SELECT 1 FROM public.chamado_locais cl WHERE cl.chamado_id = v.id)), '0'
)
SELECT item, obtido, esperado,
       CASE WHEN obtido IS NOT DISTINCT FROM esperado THEN 'ok' ELSE '>>> OLHAR <<<' END AS veredito
  FROM conferencia;

-- ── DESFAZER ────────────────────────────────────────────────────────────────
-- Volta ao gatilho único da U38 (e a criação de visita volta a falhar na FK —
-- este DESFAZER existe para completude, não é um lugar bom para ficar):
--
--   DROP TRIGGER IF EXISTS trg_capa_da_visita   ON public.visitas_tecnicas;
--   DROP TRIGGER IF EXISTS trg_local_da_visita  ON public.visitas_tecnicas;
--   DROP FUNCTION IF EXISTS public.registrar_local_da_visita();
--   DROP TRIGGER IF EXISTS trg_sincronizar_chamado_da_visita ON public.visitas_tecnicas;
--   CREATE TRIGGER trg_sincronizar_chamado_da_visita
--     AFTER INSERT OR UPDATE OF status, proposta_resultado, proposta_enviada_em,
--                               data_hora_agendada, titulo, nome_predio,
--                               cliente_id, tecnico_id, prioridade
--     ON public.visitas_tecnicas
--     FOR EACH ROW EXECUTE FUNCTION public.sincronizar_chamado_da_visita();
--
-- As linhas de `chamado_locais` criadas pelo backfill podem ficar: elas dizem a
-- verdade (o local daquela proposta). Para tirá-las, apague as que têm
-- `chamado_id` de visita e nenhuma edição posterior — não há marca disso, então
-- é escolha manual, e por isso o backfill só preencheu quem estava VAZIO.
