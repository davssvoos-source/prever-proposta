-- ═══════════════════════════════════════════════════════════════════════════
-- U142 — A EQUIPE PASSA A VALER DO INSTANTE DA TROCA (R285)
--
-- Davi, 14/09/2026, apurando com o Vinicius: "isso é adaptado semanalmente, as
-- vezes quinzenalmente, as vezes mensalmente, as vezes a dupla muda durante a
-- semana… Ou seja, é dinâmico" — e: "sempre que ele atualizar uma equipe,
-- alterna a partir do momento que ele fez a alteração".
--
-- ── O QUE ESTAVA ERRADO ────────────────────────────────────────────────────
-- A U76 fez a composição ser por SEMANA ISO, com herança: a semana sem escala
-- própria herda a última lançada antes dela. Era a leitura certa do que se
-- sabia em 31/08 — a escala era montada na segunda e valia a semana.
--
-- Mas com a troca podendo acontecer numa quarta-feira, a semana como unidade
-- REESCREVE O PASSADO: mexer na quarta faz a segunda e a terça passarem a
-- dizer que o ajudante novo esteve no prédio. E como o apoio do chamado é
-- DERIVADO da composição daquela semana (`chamado_sincronizar_apoio`), o
-- registro de quem foi ao cliente mudava sozinho, sem sino e sem evento.
--
-- ── O QUE MUDA ─────────────────────────────────────────────────────────────
-- A composição passa a ser uma FAIXA DE TEMPO por pessoa: entrou em tal
-- instante, saiu em tal outro (ou ainda não saiu). Ler "quem estava com o
-- André no dia 10 às 14h" vira uma pergunta que o banco responde direto, e
-- nenhuma troca futura mexe no que já foi.
--
-- Duas regras deixam de ser combinação e viram GARANTIA DECLARATIVA, pelo
-- mesmo btree_gist que a U78 comprou para a grade:
--   · uma pessoa está em no máximo UMA equipe a cada instante;
--   · uma equipe tem no máximo UM líder a cada instante.
--
-- É a segunda que dá o pop-up que o Davi pediu ("o sistema deve sugerir a
-- remoção do técnico da outra equipe… e só poderá prosseguir se ele clicar em
-- remover"): a RPC tenta, o banco recusa por sobreposição, e a tela pergunta.
-- Sem `_mover`, a porta responde com um erro que a tela reconhece e traduz.
--
-- ── O QUE ESTA MIGRATION NÃO FAZ ───────────────────────────────────────────
-- Não derruba `duplas_escala` nem `duplas_escala_semanas`. Elas ficam como
-- ARQUIVO: são a fonte do backfill, e apagar a origem de uma conversão no
-- mesmo passo em que se converte é o jeito mais rápido de não ter para onde
-- voltar. O DESFAZER no rodapé depende delas.
--
-- Não inventa LÍDER. `duplas_escala.ordem` é, por decisão escrita na própria
-- U76, "só exibição — NÃO é regra"; promover a ordem 1 a líder seria inventar
-- um dado que ninguém digitou. Todo mundo é backfilled como `ajudante`, e o
-- Vinicius nomeia os líderes na tela. Até ele nomear, a equipe funciona igual:
-- o apoio automático continua sendo "todos os OUTROS da equipe", que é o que
-- ele sempre foi e o que o Davi não pediu para mudar.
--
-- IDEMPOTENTE: CREATE TABLE IF NOT EXISTS, DROP/ADD em cada constraint,
-- CREATE OR REPLACE em cada função, e o backfill só roda com a tabela vazia.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §0  PRÉ-VOO ────────────────────────────────────────────────────────────
DO $u142pre$
BEGIN
  IF to_regclass('public.duplas') IS NULL THEN
    RAISE EXCEPTION 'U142 PRÉ-VOO: `duplas` não existe — este não é o banco do Prever, ou a U47 nunca rodou.';
  END IF;
  IF to_regclass('public.duplas_escala') IS NULL THEN
    RAISE EXCEPTION E'U142 PRÉ-VOO: `duplas_escala` não existe — a U76 não rodou.\nSem ela não há de onde trazer a composição de hoje, e a equipe nasceria VAZIA: todo chamado de campo perderia o apoio automático em silêncio.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist') THEN
    RAISE EXCEPTION E'U142 PRÉ-VOO: a extensão btree_gist não está instalada (a U78 a criou).\nSem ela as duas regras desta entrega — uma pessoa numa equipe só, uma equipe com um líder só — não podem ser declarativas, e viram gatilho com corrida. NÃO troque por gatilho sem falar com o Davi.';
  END IF;
  IF to_regclass('public.chamado_apoios') IS NULL THEN
    RAISE EXCEPTION 'U142 PRÉ-VOO: `chamado_apoios` não existe — a U64 não rodou.';
  END IF;
END
$u142pre$;

-- ── §1  A TABELA ───────────────────────────────────────────────────────────
-- Uma linha = "esta pessoa esteve nesta equipe, neste papel, deste instante
-- até aquele". `saiu_em` NULL = ainda está.
CREATE TABLE IF NOT EXISTS public.equipe_membros (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- RESTRICT nos dois, e não CASCADE: é a doutrina escrita na U76 ("a doutrina
  -- da casa desde a U47 é DESATIVAR, NÃO APAGAR; que o banco grite"). Com
  -- CASCADE, apagar uma equipe levaria junto TODA a história de quem esteve
  -- nela — e é dessa história que sai "quem foi ao prédio em agosto".
  equipe_id  uuid NOT NULL REFERENCES public.duplas(id)   ON DELETE RESTRICT,
  pessoa_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  papel      text NOT NULL DEFAULT 'ajudante',
  entrou_em  timestamptz NOT NULL DEFAULT now(),
  saiu_em    timestamptz NULL,
  criado_por uuid DEFAULT auth.uid(),
  criado_em  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.equipe_membros IS
  'R285 (U142): a composição da equipe de campo por FAIXA DE TEMPO. Uma linha '
  'é "fulano esteve nesta equipe deste instante até aquele". Substitui '
  'duplas_escala (semana ISO com herança), que fica como arquivo.';
COMMENT ON COLUMN public.equipe_membros.papel IS
  'lider | ajudante. O líder é quem a R126 propõe como responsável ao escolher '
  'a equipe. NÃO governa o apoio automático: apoio é "todos os OUTROS da '
  'equipe", com ou sem líder nomeado.';
COMMENT ON COLUMN public.equipe_membros.saiu_em IS
  'NULL = ainda está na equipe. A faixa é [entrou_em, saiu_em): sair e entrar '
  'no mesmo instante NÃO se sobrepõe, que é o que faz a troca ser atômica.';

DO $u142ck$
BEGIN
  -- papel: só dois valores, e o CHECK é o que impede um terceiro entrar por
  -- uma tela nova sem ninguém decidir o que ele significa
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipe_membros_papel_check') THEN
    ALTER TABLE public.equipe_membros
      ADD CONSTRAINT equipe_membros_papel_check CHECK (papel IN ('lider', 'ajudante'));
  END IF;
  -- faixa coerente: quem saiu, saiu DEPOIS de entrar
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipe_membros_periodo_check') THEN
    ALTER TABLE public.equipe_membros
      ADD CONSTRAINT equipe_membros_periodo_check CHECK (saiu_em IS NULL OR saiu_em > entrou_em);
  END IF;
END
$u142ck$;

-- ── §1.1  AS DUAS GARANTIAS ────────────────────────────────────────────────
-- Estas não são conveniência: são o que faz o pop-up do Davi existir. Sem a
-- primeira, pôr o Lucas na equipe B sem tirá-lo da A produziria DOIS apoios
-- automáticos para o mesmo chamado e ninguém saberia qual equipe foi.
ALTER TABLE public.equipe_membros DROP CONSTRAINT IF EXISTS equipe_membros_uma_equipe_por_vez;
ALTER TABLE public.equipe_membros
  ADD CONSTRAINT equipe_membros_uma_equipe_por_vez
  EXCLUDE USING gist (pessoa_id WITH =, tstzrange(entrou_em, saiu_em) WITH &&);

ALTER TABLE public.equipe_membros DROP CONSTRAINT IF EXISTS equipe_membros_um_lider_por_vez;
ALTER TABLE public.equipe_membros
  ADD CONSTRAINT equipe_membros_um_lider_por_vez
  EXCLUDE USING gist (equipe_id WITH =, tstzrange(entrou_em, saiu_em) WITH &&)
  WHERE (papel = 'lider');

-- A leitura quente é "quem está nesta equipe agora" e "onde está esta pessoa
-- agora". Índice parcial em quem ainda não saiu: é a fatia que toda tela lê.
CREATE INDEX IF NOT EXISTS equipe_membros_vivos_idx
  ON public.equipe_membros (equipe_id, pessoa_id) WHERE saiu_em IS NULL;
CREATE INDEX IF NOT EXISTS equipe_membros_pessoa_idx
  ON public.equipe_membros (pessoa_id, entrou_em DESC);

-- ── §1.2  RLS ──────────────────────────────────────────────────────────────
-- Mesmo perímetro de `duplas` depois da U137: lê quem é do time, escreve quem
-- é gestor. A escrita real passa pelas RPCs do §5 — a policy é o cinto.
ALTER TABLE public.equipe_membros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS equipe_membros_select ON public.equipe_membros;
CREATE POLICY equipe_membros_select ON public.equipe_membros
  FOR SELECT TO authenticated USING (public.eh_do_time(auth.uid()));

DROP POLICY IF EXISTS equipe_membros_write ON public.equipe_membros;
CREATE POLICY equipe_membros_write ON public.equipe_membros
  FOR ALL TO authenticated USING (public.is_gestor()) WITH CHECK (public.is_gestor());

-- ── §2  O BACKFILL ─────────────────────────────────────────────────────────
-- A composição de hoje não pode nascer vazia: se nascer, todo chamado de campo
-- perde o apoio automático na primeira sincronização, em silêncio.
--
-- A conversão semana → faixa usa o que a herança da U76 já significava: as
-- semanas EXPLÍCITAS de `duplas_escala_semanas` são os pontos de mudança, e
-- cada uma vale até a próxima explícita (a última fica aberta). Segunda-feira
-- 00:00 no fuso de Brasília é a borda — é o que `referencia_semanal` sempre
-- quis dizer.
--
-- Ilhas: semanas consecutivas com a mesma pessoa na mesma equipe viram UMA
-- faixa. Sem isso o histórico nasceria com uma linha por semana por pessoa —
-- verdadeiro, mas ilegível, e a tela mostraria "entrou e saiu" toda segunda.
DO $u142bf$
DECLARE
  v_linhas int;
BEGIN
  IF EXISTS (SELECT 1 FROM public.equipe_membros) THEN
    RAISE NOTICE 'U142 §2: equipe_membros já tem linha — backfill PULADO (idempotência).';
    RETURN;
  END IF;

  WITH semanas AS (
    SELECT s.semana,
           -- segunda-feira 00:00 local da semana ISO 'AAAA-Snn'. O 4 de janeiro
           -- está SEMPRE na semana ISO 1 — é a definição —, então recuar dele
           -- até a segunda e avançar (nn-1) semanas dá a borda certa em
           -- qualquer ano, inclusive nos de 53 semanas.
           ((to_date(split_part(s.semana, '-S', 1) || '-01-04', 'YYYY-MM-DD')
             - ((extract(isodow FROM to_date(split_part(s.semana, '-S', 1) || '-01-04', 'YYYY-MM-DD'))::int) - 1)
             + ((split_part(s.semana, '-S', 2))::int - 1) * 7)::timestamp
            AT TIME ZONE 'America/Sao_Paulo') AS inicio
      FROM public.duplas_escala_semanas s
  ),
  janelas AS (
    SELECT semana, inicio,
           lead(inicio) OVER (ORDER BY inicio) AS fim
      FROM semanas
  ),
  bruto AS (
    SELECT e.dupla_id AS equipe_id, e.pessoa_id, j.inicio, j.fim
      FROM public.duplas_escala e
      JOIN janelas j ON j.semana = e.semana
  ),
  marcado AS (
    SELECT b.*,
           CASE WHEN lag(b.fim) OVER (PARTITION BY b.equipe_id, b.pessoa_id ORDER BY b.inicio)
                     IS NOT DISTINCT FROM b.inicio
                THEN 0 ELSE 1 END AS quebra
      FROM bruto b
  ),
  ilhas AS (
    SELECT m.*,
           sum(m.quebra) OVER (PARTITION BY m.equipe_id, m.pessoa_id ORDER BY m.inicio) AS ilha
      FROM marcado m
  )
  INSERT INTO public.equipe_membros (equipe_id, pessoa_id, papel, entrou_em, saiu_em, criado_por)
  SELECT equipe_id, pessoa_id, 'ajudante', min(inicio),
         -- a ilha que contém a semana aberta (fim NULL) fica ABERTA; as outras
         -- fecham no fim da última semana da ilha
         CASE WHEN bool_or(fim IS NULL) THEN NULL ELSE max(fim) END,
         NULL
    FROM ilhas
   GROUP BY equipe_id, pessoa_id, ilha;

  GET DIAGNOSTICS v_linhas = ROW_COUNT;
  RAISE NOTICE 'U142 §2: % faixa(s) de composição trazidas de duplas_escala.', v_linhas;
END
$u142bf$;

-- ── §3  A LEITURA ──────────────────────────────────────────────────────────
-- Tudo o que pergunta "quem estava com quem" passa por aqui. Um lugar só, para
-- gatilho, tela e conferência não divergirem — a mesma doutrina da U76.

-- Os membros de uma equipe num instante.
CREATE OR REPLACE FUNCTION public.membros_da_equipe(_equipe uuid, _quando timestamptz DEFAULT now())
RETURNS TABLE (pessoa_id uuid, papel text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.pessoa_id, m.papel
    FROM public.equipe_membros m
   WHERE m.equipe_id = _equipe
     AND m.entrou_em <= _quando
     AND (m.saiu_em IS NULL OR m.saiu_em > _quando)
   ORDER BY (m.papel = 'lider') DESC, m.entrou_em, m.pessoa_id;
$$;
REVOKE EXECUTE ON FUNCTION public.membros_da_equipe(uuid, timestamptz) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.membros_da_equipe(uuid, timestamptz) TO authenticated, service_role;

-- A equipe de uma pessoa num instante. Sem LIMIT: o EXCLUDE do §1.1 garante
-- que há no máximo uma, e é por isso que ele é constraint e não gatilho.
CREATE OR REPLACE FUNCTION public.equipe_da_pessoa(_pessoa uuid, _quando timestamptz DEFAULT now())
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.equipe_id
    FROM public.equipe_membros m
   WHERE m.pessoa_id = _pessoa
     AND m.entrou_em <= _quando
     AND (m.saiu_em IS NULL OR m.saiu_em > _quando);
$$;
REVOKE EXECUTE ON FUNCTION public.equipe_da_pessoa(uuid, timestamptz) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.equipe_da_pessoa(uuid, timestamptz) TO authenticated, service_role;

-- O líder de uma equipe num instante. NULL = equipe sem líder nomeado, que é o
-- estado de TODAS elas logo depois desta migration (o backfill não inventa).
CREATE OR REPLACE FUNCTION public.lider_da_equipe(_equipe uuid, _quando timestamptz DEFAULT now())
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.pessoa_id
    FROM public.equipe_membros m
   WHERE m.equipe_id = _equipe
     AND m.papel = 'lider'
     AND m.entrou_em <= _quando
     AND (m.saiu_em IS NULL OR m.saiu_em > _quando);
$$;
REVOKE EXECUTE ON FUNCTION public.lider_da_equipe(uuid, timestamptz) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.lider_da_equipe(uuid, timestamptz) TO authenticated, service_role;

-- Os OUTROS da equipe da pessoa — é esta que o apoio automático usa.
-- Vazia quando a pessoa não está em equipe nenhuma, quando a equipe é de uma
-- pessoa só, ou quando `_pessoa` é NULL (chamado sem responsável é o caso mais
-- comum da fila, e explodir ali derrubaria a criação).
CREATE OR REPLACE FUNCTION public.parceiros_da_equipe(_pessoa uuid, _quando timestamptz DEFAULT now())
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT o.pessoa_id
    FROM public.membros_da_equipe(public.equipe_da_pessoa(_pessoa, _quando), _quando) o
   WHERE _pessoa IS NOT NULL
     AND o.pessoa_id <> _pessoa;
$$;
REVOKE EXECUTE ON FUNCTION public.parceiros_da_equipe(uuid, timestamptz) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.parceiros_da_equipe(uuid, timestamptz) TO authenticated, service_role;

COMMENT ON FUNCTION public.parceiros_da_equipe(uuid, timestamptz) IS
  'R285: todos os OUTROS membros da equipe da pessoa NAQUELE INSTANTE. É esta '
  'que o apoio automático usa — equipe de três grava dois apoios. Não olha '
  'papel: o líder não é condição, é quem a R126 propõe como responsável.';

-- ── §4  O APOIO PASSA A LER O INSTANTE ─────────────────────────────────────
-- O instante de referência do apoio, num lugar só.
CREATE OR REPLACE FUNCTION public.instante_da_equipe(_agendada timestamptz, _criado timestamptz)
RETURNS timestamptz
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT COALESCE(_agendada, _criado, now());
$$;
REVOKE EXECUTE ON FUNCTION public.instante_da_equipe(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.instante_da_equipe(timestamptz, timestamptz) TO authenticated, service_role;

COMMENT ON FUNCTION public.instante_da_equipe(timestamptz, timestamptz) IS
  'R285: a referência do apoio automático — o instante do agendamento; o da '
  'criação enquanto não há agendamento. Sucessora de dia_da_dupla(), que '
  'devolvia DATA e por isso não sabia responder por uma troca feita à tarde.';

-- Os três gêmeos por DATA continuam existindo para quem ainda os chama, mas
-- passam a ler a tabela nova. Um sistema com duas composições é um sistema com
-- duas respostas para "quem foi ao prédio" — e a pior hora de descobrir isso é
-- numa discussão sobre quem quebrou o quê. A data vira MEIO-DIA local: é o
-- instante que representa um dia de trabalho sem tomar partido entre uma troca
-- feita de manhã e uma feita à tarde.
CREATE OR REPLACE FUNCTION public.dupla_da_pessoa(_pessoa uuid, _quando date)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.equipe_da_pessoa(_pessoa, (_quando + time '12:00') AT TIME ZONE 'America/Sao_Paulo');
$$;

CREATE OR REPLACE FUNCTION public.parceiros_da_dupla(_pessoa uuid, _quando date)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.parceiros_da_equipe(_pessoa, (_quando + time '12:00') AT TIME ZONE 'America/Sao_Paulo');
$$;

-- Devolve NULL quando há ZERO parceiros E TAMBÉM quando há dois ou mais:
-- escolher um por sorte seria inventar, e o modelo.ts já diz que inventar um
-- apoio é pior que deixar em branco. (Sem `min()`: uuid não tem agregado de
-- mínimo em Postgres — o corpo antigo desta função nunca precisou de um, e o
-- meu primeiro rascunho desta migration precisava. Ficou a conta explícita.)
CREATE OR REPLACE FUNCTION public.parceiro_da_dupla(_pessoa uuid, _quando date)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH todos AS (SELECT p FROM public.parceiros_da_dupla(_pessoa, _quando) AS p)
  SELECT CASE WHEN (SELECT count(*) FROM todos) = 1
              THEN (SELECT p FROM todos) END;
$$;

-- ── §4.1  chamado_sincronizar_apoio ────────────────────────────────────────
-- Corpo da U81 preservado linha por linha, com UMA troca: a referência deixa
-- de ser `v_dia` (data + semana vigente) e passa a ser `v_quando` (instante).
-- A trava da U81 (`congelado_em IS NULL`) continua exatamente onde estava — ela
-- é o que impede o automatismo de apagar a turma que JÁ ESTEVE NO PRÉDIO.
CREATE OR REPLACE FUNCTION public.chamado_sincronizar_apoio(_chamado uuid)
RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $sinc142$
DECLARE
  c        record;
  v_quando timestamptz;
  v_alvo   uuid[];
  v_mexeu  int := 0;
  v_n      int;
BEGIN
  SELECT id, natureza, responsavel_id, data_hora_agendada, created_at
    INTO c
    FROM public.chamados WHERE id = _chamado;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- Equipe é conceito de CAMPO: o chamado interno tem equipe (departamento) e
  -- apoio próprios, e a proposta comercial não tem par que a acompanhe.
  IF c.natureza IS DISTINCT FROM 'campo' THEN RETURN 0; END IF;

  v_quando := public.instante_da_equipe(c.data_hora_agendada, c.created_at);

  SELECT COALESCE(array_agg(p.pessoa_id), '{}'::uuid[]) INTO v_alvo
    FROM public.parceiros_da_equipe(c.responsavel_id, v_quando) AS p(pessoa_id);

  -- Sai quem o automatismo pôs e a composição daquele instante não confirma
  -- mais. `origem='dupla'` é o que torna isto seguro: apoio posto à mão fica
  -- sempre, inclusive as cargas históricas da U59/U61.
  DELETE FROM public.chamado_apoios a
   WHERE a.chamado_id = c.id
     AND a.origem = 'dupla'
     -- ══ A LINHA DA U81, INTACTA ══════════════════════════════════════════
     -- Linha congelada é REGISTRO: alguém carimbou "feito" no bloco, e o
     -- automatismo a soltou. Sem esta cláusula, o apoio de uma visita já
     -- cumprida some quando a composição muda — sem sino, sem evento, sem
     -- updated_at. Com a vigência por instante isto fica MENOS provável (uma
     -- troca de hoje não reescreve a semana passada), mas não impossível: o
     -- agendamento pode ser movido para frente, e aí o instante de referência
     -- anda junto.
     AND a.congelado_em IS NULL
     -- ═════════════════════════════════════════════════════════════════════
     AND NOT (a.profile_id = ANY (v_alvo));
  GET DIAGNOSTICS v_n = ROW_COUNT; v_mexeu := v_mexeu + v_n;

  IF c.responsavel_id IS NOT NULL AND array_length(v_alvo, 1) IS NOT NULL THEN
    -- PLURAL: equipe de três grava dois apoios. Já existe como 'manual'? Fica
    -- manual — a escolha da pessoa vence a do automatismo.
    -- A SEGUNDA METADE DA TRAVA DA U81: a linha pode NASCER já congelada,
    -- quando a semana para a qual estou escrevendo já tem visita afirmada.
    -- O valor é o `cumprido_em` DAQUELE bloco e não `now()`, porque as duas
    -- turmas podem estar sendo escritas na MESMA transação.
    INSERT INTO public.chamado_apoios (chamado_id, profile_id, origem, congelado_em)
    SELECT c.id, p.pessoa_id, 'dupla',
           (SELECT max(b.cumprido_em) FROM public.agenda_campo b
             WHERE b.chamado_id = c.id
               AND b.cancelado_em IS NULL
               AND b.cumprido_em IS NOT NULL
               AND public.referencia_semanal(b.dia)
                   = public.referencia_semanal((v_quando AT TIME ZONE 'America/Sao_Paulo')::date))
      FROM unnest(v_alvo) AS p(pessoa_id)
    ON CONFLICT (chamado_id, profile_id) DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_mexeu := v_mexeu + v_n;
  END IF;

  RETURN v_mexeu;
END;
$sinc142$;

-- ── §5  A ESCRITA ──────────────────────────────────────────────────────────
-- Pôr alguém numa equipe A PARTIR DE AGORA.
--
-- É aqui que o pop-up do Davi vive. Sem `_mover`, a porta RECUSA quando a
-- pessoa já está em outra equipe e devolve o nome dela no erro — a tela lê o
-- código, mostra "o Lucas está na Equipe B; remover de lá?" e chama de novo
-- com `_mover => true`. O gesto de mover é ATÔMICO: fecha lá e abre aqui no
-- MESMO instante, e como a faixa é [entrou, saiu) os dois não se sobrepõem.
CREATE OR REPLACE FUNCTION public.equipe_definir_membro(
  _equipe uuid, _pessoa uuid, _papel text DEFAULT 'ajudante', _mover boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $u142def$
DECLARE
  v_agora   timestamptz := now();
  v_atual   record;
  -- `FOUND` é reescrito por TODO SELECT INTO, INSERT e UPDATE seguinte — a
  -- consulta do líder, logo abaixo, já o zeraria. Guardar a resposta numa
  -- variável é o que impede este procedimento de decidir pelo resultado da
  -- última escrita em vez de pela pergunta que ele realmente fez.
  v_tem     boolean;
  v_outra   text;
  v_lider   uuid;
  v_moveu   boolean := false;
  v_trocou  boolean := false;
BEGIN
  IF NOT public.is_gestor() THEN
    RAISE EXCEPTION 'Só a gestão monta equipe de campo.' USING ERRCODE = '42501';
  END IF;
  IF _papel NOT IN ('lider', 'ajudante') THEN
    RAISE EXCEPTION 'Papel inválido: %. Só existem lider e ajudante.', _papel USING ERRCODE = '22023';
  END IF;
  IF _equipe IS NULL OR _pessoa IS NULL THEN
    RAISE EXCEPTION 'Equipe e pessoa são obrigatórias.' USING ERRCODE = '22023';
  END IF;

  -- onde ela está AGORA
  SELECT m.id, m.equipe_id, m.papel INTO v_atual
    FROM public.equipe_membros m
   WHERE m.pessoa_id = _pessoa AND m.saiu_em IS NULL
     AND m.entrou_em <= v_agora;
  v_tem := FOUND;

  -- já está nesta equipe, neste papel: nada a fazer (e não suja o histórico
  -- com uma saída e uma entrada no mesmo instante)
  IF v_tem AND v_atual.equipe_id = _equipe AND v_atual.papel = _papel THEN
    RETURN jsonb_build_object('mudou', false, 'moveu', false, 'trocouPapel', false);
  END IF;

  -- está em OUTRA equipe: sem `_mover`, para aqui e diz de onde.
  -- O prefixo no texto é o contrato com a tela — é por ele que ela sabe abrir
  -- o pop-up em vez de mostrar um erro cru. Não reuso o SQLSTATE de
  -- exclusion_violation: isto não é o banco recusando, é a porta perguntando,
  -- e confundir os dois faria um erro de verdade parecer uma pergunta.
  IF v_tem AND v_atual.equipe_id <> _equipe THEN
    IF NOT _mover THEN
      SELECT d.nome INTO v_outra FROM public.duplas d WHERE d.id = v_atual.equipe_id;
      RAISE EXCEPTION 'JA_EM_OUTRA_EQUIPE: %', COALESCE(v_outra, 'outra equipe')
        USING HINT = 'Chame de novo com _mover => true para remover de lá e trazer para cá.';
    END IF;
    v_moveu := true;
  END IF;

  IF v_tem AND v_atual.equipe_id = _equipe THEN
    v_trocou := true;
  END IF;

  -- promover a líder REBAIXA o líder de hoje — a equipe tem um só, e o banco
  -- recusaria dois. Rebaixar é fechar e reabrir no MESMO instante: a pessoa
  -- não sai da equipe, só muda de papel.
  IF _papel = 'lider' THEN
    SELECT public.lider_da_equipe(_equipe, v_agora) INTO v_lider;
    IF v_lider IS NOT NULL AND v_lider <> _pessoa THEN
      UPDATE public.equipe_membros SET saiu_em = v_agora
       WHERE pessoa_id = v_lider AND equipe_id = _equipe AND saiu_em IS NULL;
      INSERT INTO public.equipe_membros (equipe_id, pessoa_id, papel, entrou_em)
      VALUES (_equipe, v_lider, 'ajudante', v_agora);
    END IF;
  END IF;

  -- fecha onde estava (na outra equipe, ou aqui mesmo com outro papel)
  IF v_tem THEN
    UPDATE public.equipe_membros SET saiu_em = v_agora WHERE id = v_atual.id;
  END IF;

  INSERT INTO public.equipe_membros (equipe_id, pessoa_id, papel, entrou_em)
  VALUES (_equipe, _pessoa, _papel, v_agora);

  RETURN jsonb_build_object('mudou', true, 'moveu', v_moveu, 'trocouPapel', v_trocou);
END;
$u142def$;
REVOKE EXECUTE ON FUNCTION public.equipe_definir_membro(uuid, uuid, text, boolean) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.equipe_definir_membro(uuid, uuid, text, boolean) TO authenticated, service_role;

-- Tirar alguém da equipe a partir de agora. Fechar, nunca apagar: a linha é o
-- registro de que ela esteve lá, e é dela que sai "quem foi ao prédio em
-- agosto".
CREATE OR REPLACE FUNCTION public.equipe_tirar_membro(_pessoa uuid)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $u142tir$
DECLARE
  v_n int;
BEGIN
  IF NOT public.is_gestor() THEN
    RAISE EXCEPTION 'Só a gestão monta equipe de campo.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.equipe_membros SET saiu_em = now()
   WHERE pessoa_id = _pessoa AND saiu_em IS NULL AND entrou_em <= now();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n > 0;
END;
$u142tir$;
REVOKE EXECUTE ON FUNCTION public.equipe_tirar_membro(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.equipe_tirar_membro(uuid) TO authenticated, service_role;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- §6  CONFERÊNCIA — rode DEPOIS do COMMIT e olhe a coluna VEREDITO
-- ═══════════════════════════════════════════════════════════════════════════
WITH conferencia AS (

  SELECT 1 AS n, 'a tabela existe' AS o_que,
         (to_regclass('public.equipe_membros') IS NOT NULL)::text AS obtido, 'true' AS esperado
  UNION ALL
  SELECT 2, 'as duas garantias são EXCLUDE (não gatilho)',
         (SELECT count(*)::text FROM pg_constraint
           WHERE conrelid = 'public.equipe_membros'::regclass AND contype = 'x'), '2'
  UNION ALL
  SELECT 3, 'RLS ligada',
         (SELECT relrowsecurity::text FROM pg_class WHERE oid = 'public.equipe_membros'::regclass), 'true'
  UNION ALL
  SELECT 4, 'a composição de HOJE veio (ninguém perdeu equipe)',
         (SELECT count(DISTINCT pessoa_id)::text FROM public.equipe_membros WHERE saiu_em IS NULL),
         (SELECT count(DISTINCT e.pessoa_id)::text
            FROM public.duplas_escala e
           WHERE e.semana = (SELECT max(semana) FROM public.duplas_escala_semanas))
  UNION ALL
  SELECT 5, 'ninguém está em duas equipes ao mesmo tempo',
         (SELECT count(*)::text FROM (
            SELECT pessoa_id FROM public.equipe_membros WHERE saiu_em IS NULL
             GROUP BY pessoa_id HAVING count(*) > 1) x), '0'
  UNION ALL
  SELECT 6, 'nenhuma equipe tem dois líderes',
         (SELECT count(*)::text FROM (
            SELECT equipe_id FROM public.equipe_membros WHERE saiu_em IS NULL AND papel = 'lider'
             GROUP BY equipe_id HAVING count(*) > 1) x), '0'
  UNION ALL
  SELECT 7, 'nenhum líder foi INVENTADO pelo backfill',
         (SELECT count(*)::text FROM public.equipe_membros WHERE papel = 'lider'), '0'
  UNION ALL
  SELECT 8, 'o apoio automático lê o instante',
         (SELECT (prosrc LIKE '%instante_da_equipe%' AND prosrc LIKE '%parceiros_da_equipe%')::text
            FROM pg_proc WHERE proname = 'chamado_sincronizar_apoio'), 'true'
  UNION ALL
  SELECT 9, 'a trava da U81 continua no corpo vivo (congelado_em)',
         (SELECT (prosrc LIKE '%congelado_em IS NULL%')::text
            FROM pg_proc WHERE proname = 'chamado_sincronizar_apoio'), 'true'
  UNION ALL
  SELECT 10, 'os três gêmeos por DATA leem a tabela nova',
         (SELECT count(*)::text FROM pg_proc
           WHERE proname IN ('dupla_da_pessoa', 'parceiros_da_dupla', 'parceiro_da_dupla')
             AND (prosrc LIKE '%equipe_da_pessoa%' OR prosrc LIKE '%parceiros_da_equipe%'
                  OR prosrc LIKE '%parceiros_da_dupla%')), '3'
  UNION ALL
  SELECT 11, 'as portas de escrita existem',
         (SELECT count(*)::text FROM pg_proc
           WHERE proname IN ('equipe_definir_membro', 'equipe_tirar_membro')), '2'
  UNION ALL
  SELECT 12, 'o arquivo ficou de pé (dá para desfazer)',
         (to_regclass('public.duplas_escala') IS NOT NULL)::text, 'true'

)
SELECT n, o_que, obtido, esperado,
       CASE WHEN obtido IS NOT DISTINCT FROM esperado THEN 'ok' ELSE '>>> OLHAR <<<' END AS veredito
  FROM conferencia ORDER BY n;

-- ═══════════════════════════════════════════════════════════════════════════
-- §7  O PORTÃO — prova que a regra pega, e desfaz sozinho
--
-- Escreve de mentira, confere que o banco recusou o que tem de recusar, e
-- ROLLBACK. Nada aqui sobrevive. (O ROLLBACK só é seguro porque o trabalho
-- acima já foi fechado com COMMIT — cicatriz da U136, que rodava e não
-- aplicava nada.)
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;

DO $u142portao$
DECLARE
  v_eq1  uuid;
  v_eq2  uuid;
  v_p1   uuid;
  v_p2   uuid;
  -- `clock_timestamp()`, e NÃO `now()`: dentro de uma transação o `now()` é
  -- CONSTANTE, então fechar e reabrir aqui produziria uma faixa de duração
  -- zero — que o CHECK `saiu_em > entrou_em` recusa, e o portão acusaria um
  -- defeito que não existe fora dele. Na vida real cada chamada da RPC é uma
  -- transação própria e os instantes já são distintos.
  v_t0   timestamptz := clock_timestamp() - interval '2 hours';
  v_t1   timestamptz := clock_timestamp() - interval '1 hour';
BEGIN
  INSERT INTO public.duplas (nome, ativa) VALUES ('__portao_u142_a', true) RETURNING id INTO v_eq1;
  INSERT INTO public.duplas (nome, ativa) VALUES ('__portao_u142_b', true) RETURNING id INTO v_eq2;
  SELECT id INTO v_p1 FROM public.profiles ORDER BY id LIMIT 1;
  SELECT id INTO v_p2 FROM public.profiles ORDER BY id OFFSET 1 LIMIT 1;
  IF v_p1 IS NULL OR v_p2 IS NULL THEN
    RAISE NOTICE 'PORTÃO: menos de dois perfis no banco — teste pulado.';
    RETURN;
  END IF;

  -- 1) uma pessoa em duas equipes ao mesmo tempo TEM de ser recusada
  INSERT INTO public.equipe_membros (equipe_id, pessoa_id, papel, entrou_em)
  VALUES (v_eq1, v_p1, 'ajudante', v_t0);
  BEGIN
    INSERT INTO public.equipe_membros (equipe_id, pessoa_id, papel, entrou_em)
    VALUES (v_eq2, v_p1, 'ajudante', v_t0);
    RAISE EXCEPTION 'PORTÃO FALHOU: o banco ACEITOU a mesma pessoa em duas equipes ao mesmo tempo.';
  EXCEPTION WHEN exclusion_violation THEN
    RAISE NOTICE 'PORTÃO 1 ok: duas equipes ao mesmo tempo → recusado.';
  END;

  -- 2) dois líderes na mesma equipe TEM de ser recusado
  UPDATE public.equipe_membros SET papel = 'lider' WHERE equipe_id = v_eq1 AND pessoa_id = v_p1;
  BEGIN
    INSERT INTO public.equipe_membros (equipe_id, pessoa_id, papel, entrou_em)
    VALUES (v_eq1, v_p2, 'lider', v_t0);
    RAISE EXCEPTION 'PORTÃO FALHOU: o banco ACEITOU dois líderes na mesma equipe.';
  EXCEPTION WHEN exclusion_violation THEN
    RAISE NOTICE 'PORTÃO 2 ok: dois líderes → recusado.';
  END;

  -- 3) SAIR E ENTRAR NO MESMO INSTANTE tem de ser ACEITO — é o gesto de mover,
  --    e se a faixa fosse fechada nos dois lados ele seria impossível
  UPDATE public.equipe_membros SET saiu_em = v_t1 WHERE equipe_id = v_eq1 AND pessoa_id = v_p1;
  BEGIN
    INSERT INTO public.equipe_membros (equipe_id, pessoa_id, papel, entrou_em)
    VALUES (v_eq2, v_p1, 'ajudante', v_t1);
    RAISE NOTICE 'PORTÃO 3 ok: sair e entrar no mesmo instante → aceito (a troca é atômica).';
  EXCEPTION WHEN exclusion_violation THEN
    RAISE EXCEPTION 'PORTÃO FALHOU: o banco RECUSOU sair e entrar no mesmo instante — mover ficaria impossível.';
  END;

  -- 4) a leitura responde pelo INSTANTE: antes da troca ele estava na primeira
  --    equipe, depois na segunda — e é isso que a semana não sabia dizer
  IF public.equipe_da_pessoa(v_p1, v_t1 - interval '30 minutes') IS DISTINCT FROM v_eq1 THEN
    RAISE EXCEPTION 'PORTÃO FALHOU: antes da troca, equipe_da_pessoa não devolveu a equipe ANTIGA — o passado foi reescrito.';
  END IF;
  IF public.equipe_da_pessoa(v_p1, clock_timestamp()) IS DISTINCT FROM v_eq2 THEN
    RAISE EXCEPTION 'PORTÃO FALHOU: depois de mover, equipe_da_pessoa não devolveu a equipe nova.';
  END IF;
  RAISE NOTICE 'PORTÃO 4 ok: antes da troca a equipe antiga, depois a nova — o passado NÃO é reescrito.';
END
$u142portao$;

ROLLBACK;

-- ═══════════════════════════════════════════════════════════════════════════
-- §8  DESFAZER (só se precisar)
--
-- O arquivo continua de pé, então desfazer é voltar as funções para o corpo da
-- U76/U81 e largar a tabela nova. Copie da U76 (§ das leituras) e da U81 (§
-- chamado_sincronizar_apoio) — os dois arquivos estão no repositório.
--
--   DROP FUNCTION IF EXISTS public.equipe_definir_membro(uuid, uuid, text, boolean);
--   DROP FUNCTION IF EXISTS public.equipe_tirar_membro(uuid);
--   DROP FUNCTION IF EXISTS public.parceiros_da_equipe(uuid, timestamptz);
--   DROP FUNCTION IF EXISTS public.lider_da_equipe(uuid, timestamptz);
--   DROP FUNCTION IF EXISTS public.equipe_da_pessoa(uuid, timestamptz);
--   DROP FUNCTION IF EXISTS public.membros_da_equipe(uuid, timestamptz);
--   DROP FUNCTION IF EXISTS public.instante_da_equipe(timestamptz, timestamptz);
--   DROP TABLE IF EXISTS public.equipe_membros;
--   -- e recrie dupla_da_pessoa/parceiros_da_dupla/parceiro_da_dupla e
--   -- chamado_sincronizar_apoio com os corpos da U76 e da U81.
-- ═══════════════════════════════════════════════════════════════════════════
