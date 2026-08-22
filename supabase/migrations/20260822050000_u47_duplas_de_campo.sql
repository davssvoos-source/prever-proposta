-- ═══════════════════════════════════════════════════════════════════════════
-- U47 — DUPLAS DE CAMPO (R56)
--
-- Davi, 2026-08-22: "Vou criar um usuário para cada técnico: Breno (já tem),
-- André, Luan, Lucas, Paulo, Denner. E depois quero cadastrar as duplas...
-- de acordo com os usuários do sistema."
--
-- ── ISTO SUPERA A R14 ──────────────────────────────────────────────────────
-- A R14 dizia: "nas duplas de campo, só o líder tem conta no app; o ajudante
-- não. Tudo é registrado no nome do líder." Não vale mais — agora TODO
-- técnico tem usuário, e a dupla é formada por dois usuários do sistema.
-- Ver docs/PRODUTO.md (R56) para a regra nova.
--
-- ── POR QUE NÃO EXISTE `chamados.dupla_id` ─────────────────────────────────
-- A dupla de um chamado é DERIVADA do responsável: se o responsável está numa
-- dupla ativa, o chamado é daquela dupla. Três razões:
--   1. funciona RETROATIVAMENTE — todo chamado que já tem responsável já tem
--      dupla, sem ninguém reprocessar nada;
--   2. não cria segunda fonte de verdade — com uma coluna própria, trocar o
--      responsável e esquecer de trocar a dupla deixaria o chamado mentindo
--      sobre quem foi;
--   3. é como a operação já funciona — a programação atribui o TÉCNICO, e a
--      dupla vem junto.
-- A conta mora em `src/features/duplas/modelo.ts` (`duplaDoResponsavel`).
--
-- ── UMA PESSOA EM UMA DUPLA ATIVA SÓ ───────────────────────────────────────
-- Sem essa garantia, "a dupla do responsável" teria mais de uma resposta e o
-- gráfico atribuiria a atividade a uma dupla escolhida por sorte. Os dois
-- índices parciais cobrem "duas vezes na mesma coluna"; o TRIGGER cobre o
-- caso cruzado (membro_a numa dupla e membro_b em outra), que índice nenhum
-- pega — é a razão de ele existir.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.duplas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text NOT NULL,
  membro_a   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  -- nullable de propósito: técnico sem par (alguém de férias, dupla ímpar)
  -- continua sendo uma "dupla" de uma pessoa só, e continua aparecendo no
  -- filtro e no gráfico. Obrigar par formado esconderia o trabalho dele.
  membro_b   uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  ativa      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT duplas_membros_distintos CHECK (membro_b IS NULL OR membro_a <> membro_b)
);

COMMENT ON TABLE public.duplas IS
  'Duplas de campo (R56/U47). A dupla de um chamado é derivada do responsável '
  '— não existe chamados.dupla_id de propósito; ver o cabeçalho da migration.';

CREATE UNIQUE INDEX IF NOT EXISTS duplas_membro_a_unico
  ON public.duplas (membro_a) WHERE ativa;
CREATE UNIQUE INDEX IF NOT EXISTS duplas_membro_b_unico
  ON public.duplas (membro_b) WHERE ativa AND membro_b IS NOT NULL;

-- O caso que os índices acima NÃO pegam: a pessoa é membro_a de uma dupla e
-- membro_b de outra. São colunas diferentes, então cada índice vê uma
-- ocorrência só e ambos passam.
CREATE OR REPLACE FUNCTION public.duplas_valida_membros()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE conflitante text;
BEGIN
  IF NOT NEW.ativa THEN RETURN NEW; END IF;
  SELECT d.nome INTO conflitante
    FROM public.duplas d
   WHERE d.ativa
     AND d.id <> NEW.id
     AND (d.membro_a = NEW.membro_a
       OR d.membro_b = NEW.membro_a
       OR (NEW.membro_b IS NOT NULL AND (d.membro_a = NEW.membro_b OR d.membro_b = NEW.membro_b)))
   LIMIT 1;
  IF conflitante IS NOT NULL THEN
    RAISE EXCEPTION 'Técnico já está na dupla ativa "%" — desative-a antes, ou tire-o de lá.', conflitante
      USING ERRCODE = 'unique_violation';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_duplas_valida_membros ON public.duplas;
CREATE TRIGGER trg_duplas_valida_membros
  BEFORE INSERT OR UPDATE ON public.duplas
  FOR EACH ROW EXECUTE FUNCTION public.duplas_valida_membros();

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Leitura aberta ao time: a composição das duplas é estrutura da operação —
-- o técnico precisa ver com quem sai, e a programação/gráfico leem isto em
-- toda tela. Escrita é de gestor, igual ao resto do cadastro estrutural.
ALTER TABLE public.duplas ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.duplas TO authenticated;
GRANT ALL ON public.duplas TO service_role;

DROP POLICY IF EXISTS "duplas_select" ON public.duplas;
DROP POLICY IF EXISTS "duplas_write"  ON public.duplas;
CREATE POLICY "duplas_select" ON public.duplas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "duplas_write" ON public.duplas
  FOR ALL TO authenticated
  USING (public.is_gestor(auth.uid()))
  WITH CHECK (public.is_gestor(auth.uid()));

-- ── Verificação ─────────────────────────────────────────────────────────────
SELECT 'duplas existe' AS item,
       (to_regclass('public.duplas') IS NOT NULL)::text AS valor
UNION ALL
SELECT 'RLS ligado', relrowsecurity::text
  FROM pg_class WHERE oid = 'public.duplas'::regclass
UNION ALL
SELECT 'policies (esperado 2)', count(*)::text
  FROM pg_policies WHERE schemaname = 'public' AND tablename = 'duplas'
UNION ALL
SELECT 'trigger de membro único (esperado 1)', count(*)::text
  FROM pg_trigger WHERE tgrelid = 'public.duplas'::regclass AND NOT tgisinternal
UNION ALL
SELECT 'duplas cadastradas', count(*)::text FROM public.duplas;
