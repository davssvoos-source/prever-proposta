-- ═══════════════════════════════════════════════════════════════════════════
-- U152 — O APOIO AUTOMÁTICO PASSA A EXIGIR QUE O RESPONSÁVEL SEJA LÍDER (R297)
--
-- Davi, 15/09/2026: "o apoio é preenchido automaticamente de acordo com a dupla
-- do responsável (CASO O RESPONSAVEL QUE FOI INSERIDO SEJA LIDER DE ALGUMA
-- DUPLA, CASO NAO SEJA LIDER, NÃO DEVE APARECER O APOIO AUTOMATICAMENTE)."
--
-- ── POR QUE ISTO É MIGRATION, E NÃO SÓ TELA ────────────────────────────────
-- A frase dele é sobre a janela de abertura, e a tela já obedece. Mas quem
-- ESCREVE o apoio não é a tela: é o gatilho `chamado_sincronizar_apoio`, que
-- roda no INSERT e a cada troca de responsável. Deixá-lo como está faria a
-- tela mostrar campo vazio e o banco gravar a equipe inteira logo em seguida —
-- a tela mentindo em silêncio, que é o defeito que esta casa mais persegue.
--
-- E o efeito NÃO é teórico: medido em 15/09/2026, das três equipes vivas
-- NENHUMA tem líder nomeado — o backfill da U142 trouxe todo mundo como
-- 'ajudante', porque `duplas_escala` não tinha o conceito. Ou seja, hoje o
-- gatilho grava apoio para TODOS os responsáveis e a tela nova não mostra
-- nenhum. A divergência começaria no primeiro chamado aberto.
--
-- ── O QUE REVISA, DITO POR EXTENSO ─────────────────────────────────────────
-- A **R285** (14/09/2026) decidiu o contrário, e está escrito no COMMENT da
-- `parceiros_da_equipe`: "Não olha papel: o líder não é condição". A R297
-- revisa exatamente essa metade.
--
-- Por que a distinção faz sentido: o líder é quem RESPONDE pela equipe, e
-- atribuir a ele é atribuir à turma. Atribuir a um ajudante é outra frase — é
-- mandar aquela pessoa —, e arrastar o líder junto como "apoio" inverteria a
-- hierarquia sem ninguém ter pedido.
--
-- ── O QUE NÃO MUDA, E É DE PROPÓSITO ───────────────────────────────────────
-- 1. `parceiros_da_equipe` FICA COMO ESTÁ. Ela responde "quem mais está nesta
--    equipe", e a programação e a grade continuam fazendo essa pergunta. O que
--    muda é quem o APOIO consulta. Alterar a função compartilhada para servir a
--    um chamador só é como uma resposta certa vira errada em três telas.
-- 2. O APOIO POSTO À MÃO CONTINUA INTOCADO. O `origem = 'dupla'` do DELETE é o
--    que garante isso, e ele não muda: quem o Vinicius escolheu fica.
-- 3. A TRAVA DA U81 (`congelado_em IS NULL`) continua exatamente onde estava —
--    é ela que impede o automatismo de apagar a turma que JÁ ESTEVE NO PRÉDIO.
--
-- ── A CONSEQUÊNCIA VISÍVEL, DECLARADA ──────────────────────────────────────
-- Enquanto nenhuma equipe tiver líder, NENHUM chamado ganha apoio automático.
-- Isso é o pedido do Davi funcionando, não um defeito — e a tela de abertura
-- diz ao usuário o que fazer ("A equipe dele ainda não tem líder nomeado.
-- Nomeie um em Equipes"). Nomear é um clique por equipe, na janela Equipes.
--
-- Os apoios que JÁ EXISTEM não são tocados por esta migration: ela não roda
-- ressincronização nenhuma. O que já foi gravado fica; o que nascer daqui em
-- diante segue a regra nova.
--
-- IDEMPOTENTE: CREATE OR REPLACE em duas funções, sem DDL de tabela e sem
-- escrita de dado. Rodar duas vezes é o mesmo que rodar uma.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §0  PRÉ-VOO ────────────────────────────────────────────────────────────
DO $u152pre$
BEGIN
  IF to_regprocedure('public.lider_da_equipe(uuid,timestamptz)') IS NULL THEN
    RAISE EXCEPTION 'U152 PRÉ-VOO: `lider_da_equipe(uuid,timestamptz)` não existe — a U142 não rodou.';
  END IF;
  IF to_regprocedure('public.equipe_da_pessoa(uuid,timestamptz)') IS NULL THEN
    RAISE EXCEPTION 'U152 PRÉ-VOO: `equipe_da_pessoa(uuid,timestamptz)` não existe — a U142 não rodou.';
  END IF;
  IF to_regprocedure('public.chamado_sincronizar_apoio(uuid)') IS NULL THEN
    RAISE EXCEPTION 'U152 PRÉ-VOO: `chamado_sincronizar_apoio(uuid)` não existe.';
  END IF;
  -- A U142 é a dona do corpo vivo. Se a marca dela não estiver lá, este arquivo
  -- está prestes a sobrescrever uma versão que não é a que eu li — e a trava da
  -- U81 sumiria junto, calada.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
     WHERE proname = 'chamado_sincronizar_apoio'
       AND pronamespace = 'public'::regnamespace
       AND prosrc LIKE '%congelado_em IS NULL%'
  ) THEN
    RAISE EXCEPTION 'U152 PRÉ-VOO: o corpo vivo de `chamado_sincronizar_apoio` não tem a trava da U81 (congelado_em IS NULL) — não é a versão que eu li. ABORTANDO.';
  END IF;
  RAISE NOTICE 'U152 pré-voo ok.';
END
$u152pre$;

-- ═══════════════════════════════════════════════════════════════════════════
-- §1  O APOIO AUTOMÁTICO, NUM LUGAR SÓ
--
-- Gêmea da `apoioAutomatico` do `src/features/duplas/modelo.ts`. As duas
-- existem porque as duas perguntas existem: a tela precisa MOSTRAR antes de
-- gravar, o banco precisa GRAVAR. O que não pode é a conta divergir — por isso
-- ela é uma função nomeada nos dois lados, e não um filtro escrito no meio de
-- um UPDATE aqui e de um `useMemo` lá.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.apoio_automatico(_pessoa uuid, _quando timestamptz DEFAULT now())
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $u152a$
  SELECT o.pessoa_id
    FROM public.membros_da_equipe(public.equipe_da_pessoa(_pessoa, _quando), _quando) o
   WHERE _pessoa IS NOT NULL
     -- SÓ O LÍDER PUXA A EQUIPE (R297). `lider_da_equipe` devolve NULL quando
     -- ninguém foi nomeado, e aí a comparação é NULL — nem verdadeira nem
     -- falsa —, o WHERE não passa, e o conjunto sai vazio. É o comportamento
     -- certo: sem líder não há liderança de onde puxar.
     AND public.lider_da_equipe(public.equipe_da_pessoa(_pessoa, _quando), _quando) = _pessoa
     AND o.pessoa_id <> _pessoa;
$u152a$;

REVOKE EXECUTE ON FUNCTION public.apoio_automatico(uuid, timestamptz) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.apoio_automatico(uuid, timestamptz) TO authenticated, service_role;

COMMENT ON FUNCTION public.apoio_automatico(uuid, timestamptz) IS
  'R297 (U152): os OUTROS da equipe NAQUELE INSTANTE, e SÓ quando `_pessoa` é o '
  'LÍDER dela. Vazia quando a pessoa não lidera, quando a equipe não tem líder '
  'nomeado, ou quando ela não está em equipe nenhuma. REVISA a R285, que dizia '
  '"o líder não é condição" — ver o COMMENT de parceiros_da_equipe, que continua '
  'respondendo a outra pergunta ("quem mais está nesta equipe") e NÃO mudou.';

-- ── §1.1  o COMMENT da função que a R297 revisa ────────────────────────────
-- Ela não muda de corpo, muda de escopo: deixou de ser a fonte do apoio.
COMMENT ON FUNCTION public.parceiros_da_equipe(uuid, timestamptz) IS
  'R285: todos os OUTROS membros da equipe da pessoa NAQUELE INSTANTE. Não olha '
  'papel — e isto continua certo PARA ESTA PERGUNTA, que é "quem mais está nesta '
  'equipe". ATENÇÃO (R297, U152): o APOIO AUTOMÁTICO deixou de sair daqui; ele '
  'agora exige que o responsável seja o LÍDER e mora em apoio_automatico(). '
  'Chamar esta função para preencher apoio põe o líder como apoio de um '
  'ajudante, que é o que a R297 recusa.';

-- ═══════════════════════════════════════════════════════════════════════════
-- §2  O GATILHO PASSA A LER A LIDERANÇA
--
-- Corpo da U142 preservado linha por linha, com UMA troca: a fonte do alvo
-- deixa de ser `parceiros_da_equipe` e passa a ser `apoio_automatico`. A trava
-- da U81 continua onde estava.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.chamado_sincronizar_apoio(_chamado uuid)
RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $u152b$
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

  -- ══ A ÚNICA TROCA DA U152 ════════════════════════════════════════════════
  -- Era `parceiros_da_equipe`. Agora é `apoio_automatico`, que devolve vazio
  -- quando o responsável não é o líder (R297).
  SELECT COALESCE(array_agg(p.pessoa_id), '{}'::uuid[]) INTO v_alvo
    FROM public.apoio_automatico(c.responsavel_id, v_quando) AS p(pessoa_id);
  -- ═════════════════════════════════════════════════════════════════════════

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
     -- updated_at.
     AND a.congelado_em IS NULL
     -- ═════════════════════════════════════════════════════════════════════
     AND NOT (a.profile_id = ANY (v_alvo));
  GET DIAGNOSTICS v_n = ROW_COUNT; v_mexeu := v_mexeu + v_n;

  IF c.responsavel_id IS NOT NULL AND array_length(v_alvo, 1) IS NOT NULL THEN
    -- PLURAL: equipe de três grava dois apoios. Já existe como 'manual'? Fica
    -- manual — a escolha da pessoa vence a do automatismo.
    -- A SEGUNDA METADE DA TRAVA DA U81: a linha pode NASCER já congelada,
    -- quando a semana para a qual estou escrevendo já tem visita afirmada.
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
$u152b$;

-- ═══════════════════════════════════════════════════════════════════════════
-- §3  CONFERÊNCIA — obtido × esperado × veredito
-- ═══════════════════════════════════════════════════════════════════════════
WITH conferencia AS (
  SELECT 1 AS n, 'a função do apoio por liderança existe' AS o_que,
         (SELECT CASE WHEN to_regprocedure('public.apoio_automatico(uuid,timestamptz)') IS NULL
                      THEN 'NÃO' ELSE 'sim' END) AS obtido,
         'sim' AS esperado
  UNION ALL
  SELECT 2, 'o gatilho do apoio passou a ler `apoio_automatico` (e não mais `parceiros_da_equipe`)',
         (SELECT CASE WHEN prosrc LIKE '%apoio_automatico(c.responsavel_id%' THEN 'sim' ELSE 'NÃO' END
            FROM pg_proc WHERE proname = 'chamado_sincronizar_apoio' AND pronamespace = 'public'::regnamespace),
         'sim'
  UNION ALL
  SELECT 3, 'a TRAVA DA U81 continua no corpo novo (sem ela o apoio de visita cumprida some calado)',
         (SELECT CASE WHEN prosrc LIKE '%congelado_em IS NULL%' THEN 'sim' ELSE 'NÃO' END
            FROM pg_proc WHERE proname = 'chamado_sincronizar_apoio' AND pronamespace = 'public'::regnamespace),
         'sim'
  UNION ALL
  SELECT 4, 'o `origem = ''dupla''` continua no DELETE (apoio posto à mão não é tocado)',
         (SELECT CASE WHEN prosrc LIKE '%a.origem = ''dupla''%' THEN 'sim' ELSE 'NÃO' END
            FROM pg_proc WHERE proname = 'chamado_sincronizar_apoio' AND pronamespace = 'public'::regnamespace),
         'sim'
  UNION ALL
  SELECT 5, '`parceiros_da_equipe` NÃO foi alterada — ela responde outra pergunta',
         (SELECT CASE WHEN prosrc LIKE '%o.pessoa_id <> _pessoa%' AND prosrc NOT LIKE '%lider_da_equipe%'
                      THEN 'intacta' ELSE 'MEXERAM' END
            FROM pg_proc WHERE proname = 'parceiros_da_equipe' AND pronamespace = 'public'::regnamespace),
         'intacta'
  UNION ALL
  SELECT 6, 'equipes de campo VIVAS hoje',
         (SELECT count(DISTINCT equipe_id)::text FROM public.equipe_membros WHERE saiu_em IS NULL),
         '(leia)'
  UNION ALL
  SELECT 7, 'dessas, quantas têm LÍDER nomeado — enquanto for zero, nenhum apoio nasce sozinho, e isso é a regra funcionando',
         (SELECT count(DISTINCT equipe_id)::text FROM public.equipe_membros
           WHERE saiu_em IS NULL AND papel = 'lider'),
         '(leia)'
  UNION ALL
  SELECT 8, 'apoios de origem `dupla` que JÁ existem (esta migration não os toca)',
         (SELECT count(*)::text FROM public.chamado_apoios WHERE origem = 'dupla'),
         '(leia)'
)
SELECT n, o_que, obtido, esperado,
       CASE WHEN esperado LIKE '(%' THEN 'leia'
            WHEN obtido IS NOT DISTINCT FROM esperado THEN 'ok'
            ELSE '>>> OLHAR <<<' END AS veredito
  FROM conferencia ORDER BY n;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- §4  O PORTÃO — prova a regra nos três casos, e desfaz sozinho
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;

DO $u152portao$
DECLARE
  v_equipe  uuid;
  v_lider   uuid;
  v_ajud    uuid;
  v_chamado uuid;
  v_n       int;
BEGIN
  -- duas pessoas LIVRES: o EXCLUDE da U142 recusa quem já está em outra equipe,
  -- e foi exatamente isso que derrubou o portão da U142 no SQL Editor.
  SELECT id INTO v_lider FROM public.profiles p
   WHERE NOT EXISTS (SELECT 1 FROM public.equipe_membros m
                      WHERE m.pessoa_id = p.id AND m.saiu_em IS NULL)
   LIMIT 1;
  SELECT id INTO v_ajud FROM public.profiles p
   WHERE p.id <> v_lider
     AND NOT EXISTS (SELECT 1 FROM public.equipe_membros m
                      WHERE m.pessoa_id = p.id AND m.saiu_em IS NULL)
   LIMIT 1;

  IF v_lider IS NULL OR v_ajud IS NULL THEN
    RAISE NOTICE 'PORTÃO PULADO: não há duas pessoas fora de equipe para montar o teste.';
    RETURN;
  END IF;

  INSERT INTO public.duplas (nome) VALUES ('__portao_u152') RETURNING id INTO v_equipe;
  INSERT INTO public.equipe_membros (equipe_id, pessoa_id, papel, entrou_em)
  VALUES (v_equipe, v_lider, 'lider',    now() - interval '1 day'),
         (v_equipe, v_ajud,  'ajudante', now() - interval '1 day');

  -- 1) responsável É O LÍDER → o apoio nasce, e é o ajudante
  INSERT INTO public.chamados (titulo, natureza, tipo, prioridade, status, responsavel_id)
  VALUES ('__portao_u152_lider', 'campo', 'corretiva', 'normal', 'aberto', v_lider)
  RETURNING id INTO v_chamado;

  SELECT count(*) INTO v_n FROM public.chamado_apoios
   WHERE chamado_id = v_chamado AND origem = 'dupla' AND profile_id = v_ajud;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'PORTÃO FALHOU: o LÍDER não puxou o ajudante como apoio (achei % linha(s)).', v_n;
  END IF;
  RAISE NOTICE 'PORTÃO 1 ok: responsável LÍDER → o apoio nasce com a turma dele.';

  -- 2) responsável é AJUDANTE → nenhum apoio
  INSERT INTO public.chamados (titulo, natureza, tipo, prioridade, status, responsavel_id)
  VALUES ('__portao_u152_ajudante', 'campo', 'corretiva', 'normal', 'aberto', v_ajud)
  RETURNING id INTO v_chamado;

  SELECT count(*) INTO v_n FROM public.chamado_apoios WHERE chamado_id = v_chamado;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'PORTÃO FALHOU: o AJUDANTE puxou % apoio(s) — a R297 diz que não deve puxar nenhum.', v_n;
  END IF;
  RAISE NOTICE 'PORTÃO 2 ok: responsável AJUDANTE → nenhum apoio automático.';

  -- 3) equipe SEM líder → nenhum apoio, nem para quem quer que seja
  UPDATE public.equipe_membros SET papel = 'ajudante'
   WHERE equipe_id = v_equipe AND pessoa_id = v_lider;

  INSERT INTO public.chamados (titulo, natureza, tipo, prioridade, status, responsavel_id)
  VALUES ('__portao_u152_sem_lider', 'campo', 'corretiva', 'normal', 'aberto', v_lider)
  RETURNING id INTO v_chamado;

  SELECT count(*) INTO v_n FROM public.chamado_apoios WHERE chamado_id = v_chamado;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'PORTÃO FALHOU: equipe SEM líder puxou % apoio(s).', v_n;
  END IF;
  RAISE NOTICE 'PORTÃO 3 ok: equipe sem líder nomeado → nenhum apoio automático (é o estado de HOJE).';

  RAISE NOTICE 'PORTÃO COMPLETO. Nada disto foi gravado (ROLLBACK a seguir).';
END
$u152portao$;

ROLLBACK;

-- ═══════════════════════════════════════════════════════════════════════════
-- §5  DESFAZER (só se precisar)
--
-- Recrie `chamado_sincronizar_apoio` com o corpo da U142
-- (`20261004090000_u142_equipe_por_instante.sql`, §4.1), que lê
-- `parceiros_da_equipe` em vez de `apoio_automatico`. O gatilho não muda: ele
-- chama a função pelo nome.
--
--   DROP FUNCTION IF EXISTS public.apoio_automatico(uuid, timestamptz);
--
-- E devolva o COMMENT de `parceiros_da_equipe` ao texto da U142 (§3), que dizia
-- "É esta que o apoio automático usa".
--
-- Os apoios já gravados NÃO são tocados por nada disto — nem na ida, nem na
-- volta. Esta migration não ressincroniza nada.
-- ═══════════════════════════════════════════════════════════════════════════
