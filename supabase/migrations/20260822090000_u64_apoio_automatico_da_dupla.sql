-- U64 — APOIO AUTOMÁTICO PELA DUPLA (R75).
--
-- Davi, 2026-08-22: "crie um mecanismo onde o sistema agrega a dupla de acordo
-- com o responsável do chamado — se eu agendo um chamado pro Breno e a dupla
-- dele está configurada para ser o Luan, o sistema preenche o apoio como Luan.
-- Se um dia eu mudar a dupla do Breno para o Denner, desse dia em diante o
-- apoio automático vai ser o Denner. Sempre dinâmico."
--
-- >>> RODAR NO SQL EDITOR DA LOVABLE. Idempotente.                         <<<
--
-- ── A DECISÃO QUE MUDA TUDO: GRAVAR, NÃO DERIVAR ───────────────────────────
-- "Desse dia em diante" é o coração do pedido, e ele decide a arquitetura.
--
-- A U47 estabeleceu que a DUPLA de um chamado é DERIVADA do responsável — não
-- existe `chamados.dupla_id` de propósito, para funcionar retroativamente. Se
-- o APOIO seguisse a mesma regra (derivado na leitura), trocar a dupla do
-- Breno reescreveria o PASSADO: todo chamado que o Luan atendeu passaria a
-- dizer "Denner", e o histórico mentiria sobre quem foi ao prédio.
--
-- Por isso o apoio é MATERIALIZADO em `chamado_apoios` no momento em que o
-- responsável é definido. As duas regras convivem sem conflito porque
-- respondem perguntas diferentes:
--   · a DUPLA (derivada) responde "de quem é este trabalho hoje" — é o
--     agrupamento do gráfico, e faz sentido acompanhar o cadastro atual;
--   · o APOIO (gravado) responde "quem foi neste chamado" — é registro, e
--     registro não muda quando o cadastro muda.
--
-- ── QUANDO DISPARA ─────────────────────────────────────────────────────────
-- Ao INSERIR com responsável, e ao TROCAR o responsável. É isso que dá o
-- "sempre dinâmico": o gatilho lê a tabela `duplas` NO MOMENTO da atribuição,
-- então quem estiver na dupla naquele dia é quem entra.
--
-- ── POR QUE `chamado_apoios.origem` PRECISOU EXISTIR ───────────────────────
-- Trocar o responsável de Breno para Lucas tem de tirar o Luan e pôr o Paulo.
-- Sem marcar quem entrou automaticamente, o único jeito de remover o Luan
-- seria apagar TODOS os apoios do chamado — levando junto quem alguém pôs à
-- mão. A coluna separa as duas origens: o gatilho só mexe no que ele mesmo
-- criou.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- 1) DE ONDE VEIO CADA APOIO
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE public.chamado_apoios
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual';

DO $$
BEGIN
  ALTER TABLE public.chamado_apoios ADD CONSTRAINT chamado_apoios_origem_check
    CHECK (origem IN ('manual', 'dupla'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.chamado_apoios.origem IS
  'manual = alguém pôs à mão; dupla = o gatilho pôs por ser o par do '
  'responsável (U64). O gatilho só remove o que ele mesmo criou.';

-- ═══════════════════════════════════════════════════════════════════════
-- 2) O PAR DO RESPONSÁVEL, NA DUPLA ATIVA DE HOJE
-- ═══════════════════════════════════════════════════════════════════════
-- Gêmeo SQL de `parceiroDaDupla` (src/features/duplas/modelo.ts). Só duplas
-- ATIVAS: dupla desfeita não pode continuar puxando ninguém para o trabalho.
-- A U47 garante que a pessoa está em no máximo uma dupla ativa (dois índices
-- parciais + um trigger para o caso cruzado), então a resposta é única.
CREATE OR REPLACE FUNCTION public.parceiro_da_dupla(_pessoa uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE WHEN d.membro_a = _pessoa THEN d.membro_b ELSE d.membro_a END
    FROM public.duplas d
   WHERE d.ativa
     AND (d.membro_a = _pessoa OR d.membro_b = _pessoa)
   LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.parceiro_da_dupla(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.parceiro_da_dupla(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.parceiro_da_dupla(uuid) IS
  'O outro membro da dupla ativa da pessoa, ou NULL (sem dupla, ou dupla de '
  'uma pessoa só). Gêmeo SQL de parceiroDaDupla() em features/duplas/modelo.ts.';

-- ═══════════════════════════════════════════════════════════════════════
-- 3) O GATILHO
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.chamado_apoio_da_dupla()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_parceiro uuid;
BEGIN
  -- Dupla é conceito de CAMPO: o chamado interno tem equipe e apoio próprios,
  -- e a proposta comercial não tem par que a acompanhe.
  IF NEW.natureza <> 'campo' THEN RETURN NEW; END IF;

  -- Ao TROCAR de responsável, o apoio automático do responsável ANTERIOR sai.
  -- `origem = 'dupla'` é o que torna isso seguro: quem foi posto à mão fica.
  IF TG_OP = 'UPDATE' AND NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id THEN
    DELETE FROM public.chamado_apoios
     WHERE chamado_id = NEW.id
       AND origem = 'dupla'
       AND profile_id IS DISTINCT FROM public.parceiro_da_dupla(NEW.responsavel_id);
  END IF;

  IF NEW.responsavel_id IS NULL THEN RETURN NEW; END IF;

  v_parceiro := public.parceiro_da_dupla(NEW.responsavel_id);
  -- Sem dupla, ou dupla de uma pessoa só: não há apoio a sugerir, e inventar
  -- um seria pior que deixar em branco.
  IF v_parceiro IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.chamado_apoios (chamado_id, profile_id, origem)
  VALUES (NEW.id, v_parceiro, 'dupla')
  -- Já existe como 'manual'? Fica manual — a escolha da pessoa vence a do
  -- automatismo, e é o que impede o gatilho de tomar posse de um apoio que
  -- ele não criou (e depois removê-lo numa troca de responsável).
  ON CONFLICT (chamado_id, profile_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chamado_apoio_dupla_ins ON public.chamados;
DROP TRIGGER IF EXISTS trg_chamado_apoio_dupla_upd ON public.chamados;
CREATE TRIGGER trg_chamado_apoio_dupla_ins AFTER INSERT ON public.chamados
  FOR EACH ROW EXECUTE FUNCTION public.chamado_apoio_da_dupla();
CREATE TRIGGER trg_chamado_apoio_dupla_upd AFTER UPDATE OF responsavel_id ON public.chamados
  FOR EACH ROW EXECUTE FUNCTION public.chamado_apoio_da_dupla();

-- ═══════════════════════════════════════════════════════════════════════
-- 4) CONFERÊNCIA
-- ═══════════════════════════════════════════════════════════════════════
SELECT 'coluna origem criada' AS conferencia,
       count(*)::text AS valor, '1' AS esperado
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name='chamado_apoios' AND column_name='origem'
UNION ALL
SELECT 'gatilhos ativos', count(*)::text, '2'
  FROM pg_trigger
 WHERE tgrelid = 'public.chamados'::regclass
   AND tgname IN ('trg_chamado_apoio_dupla_ins','trg_chamado_apoio_dupla_upd')
   AND NOT tgisinternal;

-- As duplas de hoje e o par que cada técnico vai puxar a partir de agora.
SELECT d.nome AS dupla,
       pa.nome AS membro,
       COALESCE(pp.nome, '— sem par —') AS apoio_automatico
  FROM public.duplas d
  JOIN public.profiles pa ON pa.id = d.membro_a
  LEFT JOIN public.profiles pp ON pp.id = public.parceiro_da_dupla(d.membro_a)
 WHERE d.ativa
UNION ALL
SELECT d.nome, pb.nome, COALESCE(pp.nome, '— sem par —')
  FROM public.duplas d
  JOIN public.profiles pb ON pb.id = d.membro_b
  LEFT JOIN public.profiles pp ON pp.id = public.parceiro_da_dupla(d.membro_b)
 WHERE d.ativa AND d.membro_b IS NOT NULL
 ORDER BY 1, 2;

COMMIT;

-- ───────────────────────────────────────────────────────────────────────
-- NÃO HÁ BACKFILL, DE PROPÓSITO. Preencher o apoio dos chamados que já
-- existem usaria a dupla de HOJE para trabalho que aconteceu ANTES — o
-- mesmo erro que a decisão de gravar (em vez de derivar) evita. Se quiser
-- mesmo assim, só para os que ainda estão EM ABERTO:
--
--   INSERT INTO public.chamado_apoios (chamado_id, profile_id, origem)
--   SELECT c.id, public.parceiro_da_dupla(c.responsavel_id), 'dupla'
--     FROM public.chamados c
--    WHERE c.natureza = 'campo'
--      AND c.status IN ('aberto','agendado','em_andamento','stand_by')
--      AND c.responsavel_id IS NOT NULL
--      AND public.parceiro_da_dupla(c.responsavel_id) IS NOT NULL
--   ON CONFLICT (chamado_id, profile_id) DO NOTHING;
--
-- DESFAZER O MECANISMO:
--   DROP TRIGGER IF EXISTS trg_chamado_apoio_dupla_ins ON public.chamados;
--   DROP TRIGGER IF EXISTS trg_chamado_apoio_dupla_upd ON public.chamados;
--   DELETE FROM public.chamado_apoios WHERE origem = 'dupla';
-- ───────────────────────────────────────────────────────────────────────
