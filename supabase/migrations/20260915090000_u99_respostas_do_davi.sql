-- ═══════════════════════════════════════════════════════════════════════════
-- U99 — AS RESPOSTAS DO DAVI VIRAM BANCO (2026-09-04)
--        matriz sem Histórico e Importar · o pedido de compra apagado ·
--        o catálogo de sistemas maior · a data agendada da atividade interna
--        (R165, R167, R159, R168, R171)
--
-- >>> RODAR NO SQL EDITOR DO SUPABASE, À MÃO. Idempotente.
-- >>> ORDEM: DEPOIS da U96 (20260914090000_u96_estrutura_das_atividades.sql).
-- >>>        O pré-voo abaixo aborta se a U96 não tiver rodado — a U96 ainda
-- >>>        comenta e revoga objetos do pedido de compra que esta apaga.
-- >>> ORDEM DE DEPLOY DO CÓDIGO: tanto faz. O app RENDERIZA os dois códigos
-- >>>        novos de sistema mas NÃO os oferece até este CHECK aceitá-los
-- >>>        (inventario.ts: TIPOS_SISTEMA_NAO_OFERECIDOS); a coluna nova
-- >>>        ainda não é lida por tela nenhuma.
--
-- 1) permissoes_tela: 'historico' e 'chamados.importar' saem (Q14/Q17 — Davi:
--    "Pode sumir, já que o início já mostra isso"; "Não conheço essa tela,
--    pode deletar ela"). As rotas viraram redirect; as chaves saíram do
--    catálogo (src/lib/telas.ts). Linha órfã é lixo — o mesmo caso da U94.
-- 2) chamado_compra e as três funções do pedido de compra SOMEM (Q21 — Davi:
--    "Pode apagar"). A U96 já tinha derrubado os gatilhos, desagendado o cron
--    e revogado a RPC; faltava a estrutura. IRREVERSÍVEL para as fichas — se
--    quiser guardar cópia, rode ANTES o comentado em "GUARDAR CÓPIA".
-- 3) cliente_sistemas.tipo aceita 'CAE' (Controle de Acesso Eletrônico) e
--    'CCA' (Central de Controle de Acesso Eletrônico) — R159 (Q6).
-- 4) chamados.data_agendada (date): o dia em que a atividade INTERNA vai ser
--    feita, além do prazo (R168, Q18 — Davi: "Sim, também deve ter data
--    agendada além do prazo. Isso inclusive pode ser uma nova coluna no
--    Kanban, para os 'Agendados'"). Só a coluna: a tela e a coluna do quadro
--    vêm com os fluxos da área técnica. `data_hora_agendada` continua sendo
--    o espelho da agenda de CAMPO (R101) — são duas colunas de propósito.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── GUARDAR CÓPIA (opcional; rodar ANTES, à parte) ──────────────────────────
-- CREATE TABLE public.arquivo_chamado_compra AS SELECT * FROM public.chamado_compra;

-- ── Pré-voo: a U96 tem de ter rodado ────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'chamados' AND column_name = 'impacto_operacional'
  ) THEN
    RAISE EXCEPTION 'U99: rode a U96 antes — chamados.impacto_operacional nao existe';
  END IF;
END $$;

-- ── 1) a matriz de permissões perde as duas telas (R165, R167) ──────────────
DELETE FROM public.permissoes_tela WHERE tela IN ('historico', 'chamados.importar');

-- ── 2) o pedido de compra some de vez (R171) ────────────────────────────────
DROP TRIGGER IF EXISTS trg_chamado_ficha_compra_ins ON public.chamados;
DROP TRIGGER IF EXISTS trg_chamado_ficha_compra_upd ON public.chamados;
DROP FUNCTION IF EXISTS public.chamado_criar_ficha_compra();
DROP FUNCTION IF EXISTS public.alertas_compras(int);
DROP FUNCTION IF EXISTS public.decidir_pedido_compra(uuid, text, text, numeric);
DROP TABLE IF EXISTS public.chamado_compra CASCADE;

-- ── 3) o catálogo de sistemas (R159) ────────────────────────────────────────
ALTER TABLE public.cliente_sistemas DROP CONSTRAINT IF EXISTS cliente_sistemas_tipo_check;
ALTER TABLE public.cliente_sistemas
  ADD CONSTRAINT cliente_sistemas_tipo_check
  CHECK (tipo IN ('PED','VEI','CFTV','AL','CER','CENT','ELV','TOT','CAE','CCA','OUTRO'));

-- ── 4) a data agendada da atividade interna (R168) ──────────────────────────
ALTER TABLE public.chamados ADD COLUMN IF NOT EXISTS data_agendada date;
COMMENT ON COLUMN public.chamados.data_agendada IS
  'R168 (U99): o dia em que a atividade INTERNA vai ser feita, além do prazo. '
  'Não confundir com data_hora_agendada, que é o espelho da agenda de CAMPO (R101).';

-- ── Verificação ─────────────────────────────────────────────────────────────
WITH conferencia AS (
  SELECT 1 AS n, 'linhas órfãs de historico/chamados.importar na matriz' AS o_que,
         (SELECT count(*)::text FROM public.permissoes_tela
           WHERE tela IN ('historico', 'chamados.importar')) AS obtido,
         '0' AS esperado
  UNION ALL
  SELECT 2, 'chamado_compra ainda existe',
         (SELECT CASE WHEN to_regclass('public.chamado_compra') IS NULL THEN 'nao' ELSE 'SIM' END), 'nao'
  UNION ALL
  SELECT 3, 'funções do pedido de compra restantes',
         (SELECT count(*)::text FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
           WHERE ns.nspname = 'public'
             AND p.proname IN ('decidir_pedido_compra', 'chamado_criar_ficha_compra', 'alertas_compras')), '0'
  UNION ALL
  SELECT 4, 'o CHECK de cliente_sistemas.tipo aceita CAE e CCA',
         (SELECT CASE WHEN pg_get_constraintdef(c.oid) LIKE '%''CAE''%'
                       AND pg_get_constraintdef(c.oid) LIKE '%''CCA''%' THEN 'sim' ELSE 'NAO' END
            FROM pg_constraint c
           WHERE c.conname = 'cliente_sistemas_tipo_check'
             AND c.conrelid = 'public.cliente_sistemas'::regclass), 'sim'
  UNION ALL
  SELECT 5, 'chamados.data_agendada existe e é date',
         (SELECT data_type FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'chamados' AND column_name = 'data_agendada'), 'date'
)
SELECT n, o_que, obtido, esperado,
       CASE WHEN obtido = esperado THEN 'ok' ELSE '>>> OLHAR <<<' END AS veredito
  FROM conferencia
 ORDER BY n;

-- ── DESFAZER ────────────────────────────────────────────────────────────────
-- 1) matriz:
--    INSERT INTO public.permissoes_tela (tela, cargo, permitido) VALUES
--      ('historico', 'tecnico', true), ('historico', 'comercial', true), ('historico', 'sac', true),
--      ('chamados.importar', 'tecnico', false), ('chamados.importar', 'comercial', true), ('chamados.importar', 'sac', true)
--    ON CONFLICT DO NOTHING;
-- 2) pedido de compra: NÃO há desfazer para os dados. A estrutura se recria
--    rodando a U9 (20260819160000_u9_pedido_compra.sql) de novo, e a cópia
--    opcional de "GUARDAR CÓPIA" devolve as fichas com
--    INSERT INTO public.chamado_compra SELECT * FROM public.arquivo_chamado_compra;
-- 3) catálogo (falha se já houver CAE/CCA gravados — apague-os antes):
--    ALTER TABLE public.cliente_sistemas DROP CONSTRAINT cliente_sistemas_tipo_check;
--    ALTER TABLE public.cliente_sistemas ADD CONSTRAINT cliente_sistemas_tipo_check
--      CHECK (tipo IN ('PED','VEI','CFTV','AL','CER','CENT','ELV','TOT','OUTRO'));
-- 4) data agendada: ALTER TABLE public.chamados DROP COLUMN IF EXISTS data_agendada;
