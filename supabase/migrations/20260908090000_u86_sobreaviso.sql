-- ═══════════════════════════════════════════════════════════════════════════
-- U86 — SOBREAVISO: A GRADE PESSOA × DIAS DO MÊS (R116 — Fase 3, Passo 2)
--
-- Davi: a escala de sobreaviso vira tela, com horas por dia, total do mês,
-- fim de semana e feriado destacados e um botão de "aplicar semana padrão".
--
-- >>> RODAR NO SQL EDITOR DO SUPABASE, À MÃO. Idempotente: rodar de novo é
-- >>> no-op (nenhum backfill, nenhuma semente de dado operacional).
--
-- ── A ORDEM DE DEPLOY INVERTE AQUI, E ISSO É PROPRIEDADE DO CÓDIGO ─────────
-- >>> ESTA MIGRATION PRIMEIRO. O PUSH DEPOIS. <<<
-- A regra 5 da casa diz que push publica NA HORA e migration roda à mão
-- depois — e ela INVERTE quando o código passa a NOMEAR objeto que não existe.
-- É o caso: `/sobreaviso` faz `from("sobreaviso")` e `rpc("sobreaviso_aplicar_
-- padrao")`. Subir o código antes abriria a tela com PGRST205 ("Could not find
-- the table 'public.sobreaviso' in the schema cache") para todo mundo.
--
-- E a ENTREGA IRMÃ desta rodada, o calendário (R115/U85, `src/lib/feriados.ts`),
-- é o contrário: é .ts puro, não tem migration, não tem janela, sobe sozinho.
-- Duas ordens OPOSTAS no mesmo dia é a receita para a metade errada subir
-- primeiro — por isso são duas entradas de diário e dois commits.
--
-- ── A UNIDADE DO DADO: UMA LINHA POR (dia, pessoa_id) ─────────────────────
-- Não é um mês por linha com vetor de 31 posições, e a razão é medida: a
-- unidade de DECISÃO é a semana, a de RELATÓRIO é a competência, e a semana
-- padrão tem OITO dias de calendário. 12 das 52 segundas de um ano têm o
-- oitavo dia no mês seguinte — e não é acidente do calendário de 2026: todo
-- mês contém exatamente uma segunda nos seus últimos sete dias, então são 12
-- por ano, para sempre. A única virtude do vetor mensal seria "uma linha, uma
-- transação", e ela é falsa em 23% das aplicações do gesto mais usado da tela.
-- O DIA é a única unidade que é subconjunto tanto da semana quanto do mês, e é
-- o que permite responder "quem estava de sobreaviso em 14/03?" com SQL comum,
-- sem decodificador, sem view e sem domínio sobre array. `dia date` também
-- torna 30 de fevereiro INEXPRIMÍVEL, que um vetor de 31 posições não faz.
--
-- Também NÃO é intervalo `(dia, inicio_min, fim_min)`: a U78 já recusou essa
-- forma por ser fatal para plantão que atravessa a meia-noite
-- (docs/PLANO_UNIFICACAO.md:5033). O preço assumido está escrito na dívida: o
-- escalar não sabe a HORA do handover. Se um dia precisar, o conserto é
-- RENAME horas TO minutos, multiplicar por 60 e trocar o CHECK.
--
-- ── NÃO NASCE UMA SEGUNDA LISTA DE GENTE ──────────────────────────────────
-- `pessoa_id` referencia `public.profiles`. Não existe (e não vai existir)
-- `funcionarios`: desde 2026-08-22 TODO técnico tem usuário no app
-- (docs/PRODUTO.md:828-832, que supera a R14 explicitamente), e a própria
-- migration 20260628063033 já registra a doutrina no comentário da coluna
-- `ativo` — "reutilizando profiles em vez de criar perfis". Uma segunda lista
-- de pessoas seria a QUINTA colisão de vocabulário deste projeto e a mais
-- cara: a pergunta "quem é essa pessoa?" passaria a ter duas respostas que
-- divergem em silêncio.
--
-- ── CÉLULA VAZIA É AUSÊNCIA DE LINHA ──────────────────────────────────────
-- `CHECK (horas > 0 AND horas <= 24)`, e zerar é DELETE. Isto mata a
-- tricotomia 0 / NULL / ausente antes que ela exista: um `horas = 0` gravado
-- seria VAZIO para a tela e PREENCHIDO para o teste de colisão do gesto em
-- massa, e a divergência apareceria exatamente no lugar mais caro.
--
-- ── ORDEM DAS SEÇÕES ──────────────────────────────────────────────────────
--   §0 pré-voo que ABORTA
--   §1 a tabela, os índices e os comentários de catálogo
--   §2 RLS e grants
--   §3 a porta do gesto em massa (aplicar semana padrão), em DUAS FASES
--   §4 a porta de limpar, ASSIMÉTRICA de propósito
--   §5 a chave da tela em permissoes_tela
--   §6 o PORTÃO — seis provas dentro da transação, e ele NÃO deixa lixo
--   §7 conferência em SELECT, com obtido × esperado × veredito
-- Tudo em UMA transação: DDL no Postgres é transacional, então qualquer RAISE
-- (inclusive o do portão) devolve tabela, funções e políticas ao estado exato
-- de antes.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- §0) PRÉ-VOO — ele ABORTA, não avisa
-- ═══════════════════════════════════════════════════════════════════════
-- RAISE NOTICE é INVISÍVEL no editor do Supabase. Um pré-voo que só avisa é
-- um pré-voo que ninguém lê. Este levanta.
--
-- A ÚLTIMA CHECAGEM É A QUE FALTAVA NA CASA: contar profiles escaláveis. Sem
-- ela, o §6 descobriria que não há cobaia DEPOIS de já ter criado tabela,
-- políticas e duas funções — e o Davi veria um erro que não tem nada a ver com
-- o que ele rodou.
DO $preflight$
DECLARE
  v_pessoas int;
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'U86 PRÉ-VOO: public.profiles não existe. A escala de sobreaviso sai de profiles e de mais nenhum lugar.';
  END IF;
  IF to_regprocedure('public.is_gestor(uuid)') IS NULL THEN
    RAISE EXCEPTION 'U86 PRÉ-VOO: public.is_gestor(uuid) não existe — é ela que decide quem edita a escala (e ela INCLUI o SAC desde a U6a).';
  END IF;
  IF to_regclass('public.permissoes_tela') IS NULL THEN
    RAISE EXCEPTION 'U86 PRÉ-VOO: public.permissoes_tela não existe (U11) — a chave da tela nova não teria onde morar.';
  END IF;
  -- As três colunas de profiles que a grade lê. Nomeadas uma a uma: um
  -- `SELECT *` que funciona hoje não prova que `status` existe.
  IF NOT EXISTS (SELECT 1 FROM pg_attribute a
                  WHERE a.attrelid = 'public.profiles'::regclass
                    AND a.attname = 'ativo' AND a.attnum > 0 AND NOT a.attisdropped) THEN
    RAISE EXCEPTION 'U86 PRÉ-VOO: profiles.ativo não existe — é um dos dois eixos de quem entra na grade.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute a
                  WHERE a.attrelid = 'public.profiles'::regclass
                    AND a.attname = 'status' AND a.attnum > 0 AND NOT a.attisdropped) THEN
    RAISE EXCEPTION 'U86 PRÉ-VOO: profiles.status não existe — é o outro eixo (pendente_aprovacao é convite não aceito).';
  END IF;

  SELECT count(*) INTO v_pessoas
    FROM public.profiles p
   WHERE p.ativo AND p.status <> 'pendente_aprovacao';
  IF v_pessoas = 0 THEN
    RAISE EXCEPTION 'U86 PRÉ-VOO: não há NENHUM profile ativo e aprovado. O portão do §6 precisa de uma pessoa real para exercitar as duas RPCs, e a grade nasceria vazia.';
  END IF;
END
$preflight$;

-- ═══════════════════════════════════════════════════════════════════════
-- §1) A TABELA
-- ═══════════════════════════════════════════════════════════════════════
-- A PK é `(dia, pessoa_id)` NESSA ORDEM, e a ordem é medida: a consulta de
-- TODA abertura da tela é uma faixa contígua de datas (três meses — ver o
-- comentário de `janelaDaCompetencia` no modelo puro), com todas as pessoas.
-- `dia` na frente faz dessa consulta uma varredura de faixa no índice da PK.
-- O eixo inverso ("quanto a Fabiana fez em 2027") ganha índice próprio abaixo.
CREATE TABLE IF NOT EXISTS public.sobreaviso (
  dia          date     NOT NULL,
  -- RESTRICT, e é a mesma doutrina de duplas_escala (U76): quem sai da empresa
  -- NÃO some do histórico. Ele sai das grades futuras e continua nas passadas,
  -- esmaecido. Com CASCADE, apagar um usuário levaria junto a folha de plantão
  -- dele — e é justamente a folha que alguém vai querer conferir depois.
  pessoa_id    uuid     NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  horas        smallint NOT NULL,
  origem       text     NOT NULL DEFAULT 'manual',
  -- NULO quando a escrita não veio do app (SQL Editor, migration). Um COALESCE
  -- para outra pessoa aqui seria carimbo FALSO, que é pior que carimbo ausente.
  alterada_por uuid     REFERENCES public.profiles(id) ON DELETE SET NULL,
  alterada_em  timestamptz NOT NULL DEFAULT now(),
  -- PK nomeada à mão: a cicatriz de `demanda_apoios_pkey` existe porque o
  -- Postgres batizou sozinho e o rename da U7 não renomeia constraint.
  CONSTRAINT sobreaviso_pkey PRIMARY KEY (dia, pessoa_id),
  CONSTRAINT sobreaviso_horas_check CHECK (horas > 0 AND horas <= 24),
  CONSTRAINT sobreaviso_origem_check CHECK (origem IN ('manual','padrao'))
);

-- O eixo PESSOA. A PK cobre o eixo DIA; este cobre "o ano da Fabiana" e o
-- fechamento por pessoa, que é a leitura da folha.
CREATE INDEX IF NOT EXISTS sobreaviso_pessoa_idx
  ON public.sobreaviso (pessoa_id, dia);

COMMENT ON TABLE public.sobreaviso IS
  'Escala de sobreaviso: UMA LINHA POR (dia, pessoa). Célula vazia é AUSÊNCIA '
  'de linha — zerar é DELETE, e CHECK (horas > 0) impede o 0 gravado, que '
  'seria vazio para a tela e preenchido para o teste de colisão do gesto em '
  'massa. É PLANO que vira REGISTRO por decurso: editar mês passado é '
  'CORREÇÃO, permitida e carimbada em alterada_em — NÃO há coluna travado.';
COMMENT ON COLUMN public.sobreaviso.horas IS
  'Horas de sobreaviso desta pessoa neste dia, 1 a 24. É ESCALAR e não '
  'intervalo: a U78 já recusou (dia, inicio_min) por ser fatal para plantão '
  'que atravessa a meia-noite. O preço é não saber a HORA do handover; o '
  'conserto, se vier, é RENAME horas TO minutos e multiplicar por 60.';
COMMENT ON COLUMN public.sobreaviso.origem IS
  'padrao = escrita pelo gesto em massa sobreaviso_aplicar_padrao; manual = '
  'digitada célula a célula. É o que permite a sobreaviso_limpar(_so_padrao) '
  'apagar o que a máquina pôs sem apagar o que uma pessoa digitou.';
COMMENT ON COLUMN public.sobreaviso.alterada_em IS
  'O mês fechado pode ser reaberto sem o fechamento saber — um booleano '
  '"travado" seria o sobreposicao_ok que a U78 recusou (um booleano que '
  'qualquer escritor liga devolve a regra ao estado de promessa). O que existe '
  'é este carimbo, que torna a alteração pós-fechamento ENCONTRÁVEL.';

-- ═══════════════════════════════════════════════════════════════════════
-- §2) RLS — VER É DE TODOS, EDITAR É DE GESTOR (E GESTOR INCLUI O SAC)
-- ═══════════════════════════════════════════════════════════════════════
-- A POLICY É A ÚNICA FRONTEIRA REAL. Todo usuário fala com o Postgres com a
-- MESMA chave publicável, que está no .env VERSIONADO (o modelo de ameaça está
-- escrito no cabeçalho da S1): o que a tela esconde, o `curl` mostra.
--
-- VER: TODO MUNDO QUE TRABALHA AQUI, E MAIS NINGUÉM.
--
-- A primeira versão era `USING (true)`, copiando duplas_escala (U76 §2.4). O
-- argumento a favor continua de pé e é o que mantém a leitura ampla: se o
-- técnico não vê as horas dos outros, a faixa de cobertura do mês MENTE para
-- ele — ele veria buraco onde o colega já cobre —, e a associação pessoa × dia
-- × horas é COBERTURA e não dinheiro (a valoração vive atrás de
-- pode_ver_financeiro(), que é outra função e outra tabela).
--
-- MAS `true` NÃO É "TODO MUNDO QUE TRABALHA AQUI": é todo mundo que consegue
-- LOGAR. E a tela exclui dois grupos que a policy não excluía —
-- `status = 'pendente_aprovacao'` (o convite que tem linha em auth.users, loga,
-- e cuja triagem era só de tela) e `ativo = false` (o ex-funcionário, cujo
-- login NADA no repositório revoga). Com a chave publicável no .env
-- VERSIONADO, um `curl` de qualquer um dos dois devolvia a folha de plantão
-- inteira: quem estava trabalhando às 2h da manhã, todo dia, para sempre. Isso
-- é informação de PESSOAL, e a policy é a única fronteira.
--
-- O predicado NÃO é um quarto papel: é o MESMO teste de dois eixos que
-- `pessoasDaGrade()` já faz na tela (`ativo` e `status`), movido para a
-- fronteira que vale. Nada de `cargo` — quem não pode ser escalado ainda
-- precisa ver a escala.
--
-- `<>` E NÃO `IS DISTINCT FROM`, ao contrário de uma dúzia de policies mais
-- antigas: `profiles.status` é `NOT NULL DEFAULT 'ativo'` desde
-- 20260629182152_cdc541b7-...sql:2, e `profiles.ativo` é `NOT NULL DEFAULT
-- true` desde 20260628063033_...sql:33. A guarda contra NULL naquelas policies
-- é peso morto herdado de quando as colunas eram anuláveis; aqui não se copia
-- o peso. O pré-voo do §0 aborta se qualquer uma das duas colunas sumir.
--
-- EDITAR: is_gestor(), que INCLUI o SAC (20260818230000_u6a_papel_sac.sql:51).
-- RECUSO criar um `pode_escalar()`: seria a QUARTA lista de papéis a ter de
-- concordar com as outras três (is_gestor, pode_ver_financeiro, e os gêmeos em
-- src/features/gerencial/data.ts). O sobreaviso existe PARA o SAC — uma escala
-- que ele não pode corrigir fica velha exatamente quando importa, às 2h da
-- manhã. A defesa é o carimbo alterada_por/alterada_em mais a grade ser
-- visível para todo mundo. Se o Davi quiser o SAC fora, o lugar é um quarto
-- valor no par de listas que JÁ EXISTE, não um predicado novo.
ALTER TABLE public.sobreaviso ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sobreaviso TO authenticated;
GRANT ALL ON public.sobreaviso TO service_role;

-- UPDATE é concedido aqui (ao contrário de duplas_escala, que só nasce e
-- morre) porque a célula solta é o caminho da R90 — "tudo salva sozinho" — e
-- corrigir 14 para 12 é UPDATE de uma coluna, não troca de identidade. A
-- chave-toda (dia, pessoa) NÃO é atualizável na prática: mudar qualquer uma
-- das duas é mudar de célula, e a tela faz DELETE + INSERT.
DROP POLICY IF EXISTS "sobreaviso_select" ON public.sobreaviso;
DROP POLICY IF EXISTS "sobreaviso_write"  ON public.sobreaviso;
CREATE POLICY "sobreaviso_select" ON public.sobreaviso
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p
                  WHERE p.id = auth.uid()
                    AND p.ativo
                    AND p.status <> 'pendente_aprovacao'));
CREATE POLICY "sobreaviso_write" ON public.sobreaviso
  FOR ALL TO authenticated
  USING (public.is_gestor(auth.uid())
         AND EXISTS (SELECT 1 FROM public.profiles p
                      WHERE p.id = auth.uid()
                        AND p.ativo
                        AND p.status <> 'pendente_aprovacao'))
  WITH CHECK (public.is_gestor(auth.uid())
         AND EXISTS (SELECT 1 FROM public.profiles p
                      WHERE p.id = auth.uid()
                        AND p.ativo
                        AND p.status <> 'pendente_aprovacao'));

-- O carimbo, para o caminho da célula solta (a RPC carimba sozinha).
--
-- NÃO É `SECURITY DEFINER`, e a ausência é decisão. Ele só escreve em `NEW`, em
-- memória: não lê nem grava tabela nenhuma, então não há privilégio a elevar.
-- Com o definer ele seria a TERCEIRA função definer deste arquivo — e a única
-- sem o `REVOKE … FROM PUBLIC, anon` que a conferência 107 mede nas outras
-- duas, ou seja, uma exceção fora do próprio censo. Regra 8: em vez de
-- acrescentar o REVOKE, tirou-se o que não era preciso.
CREATE OR REPLACE FUNCTION public.sobreaviso_carimbo()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $carimbo$
BEGIN
  NEW.alterada_em  := now();
  NEW.alterada_por := COALESCE(auth.uid(), NEW.alterada_por);
  RETURN NEW;
END
$carimbo$;

DROP TRIGGER IF EXISTS trg_sobreaviso_carimbo ON public.sobreaviso;
CREATE TRIGGER trg_sobreaviso_carimbo
  BEFORE INSERT OR UPDATE ON public.sobreaviso
  FOR EACH ROW EXECUTE FUNCTION public.sobreaviso_carimbo();

-- ═══════════════════════════════════════════════════════════════════════
-- §3) O GESTO EM MASSA — "APLICAR SEMANA PADRÃO", EM DUAS FASES
-- ═══════════════════════════════════════════════════════════════════════
-- O gesto mais destrutivo da tela, e ele NÃO PODE SER SILENCIOSO.
--
-- NENHUMA DAS TRÊS RESPOSTAS ÓBVIAS ACERTA, e o caso que as derruba é a mesma
-- pessoa em duas semanas seguidas. Na segunda de virada ela já tem as 8h de
-- madrugada que a semana ANTERIOR gravou, e a semana nova quer pôr as 6h de
-- noite:
--   · sobrescrever  -> 6, e perdem-se 8h;
--   · só preencher vazio -> 8, e perdem-se 6h;
--   · perguntar sempre -> pergunta no caso em que a resposta é óbvia, e treina
--     todo mundo a clicar "sim" sem ler, que é como o gesto vira silencioso.
-- O certo é SOMAR até o teto: 8 + 6 = 14, que é exatamente a cobertura daquela
-- segunda-feira. Daí as QUATRO ações nomeadas.
--
-- DUAS FASES, no padrão vivo de escala_definir(_mover => false) (U76:640),
-- melhorado: em vez de UMA FRASE, os OITO NÚMEROS. Com _confirmar = false e
-- qualquer célula em `trocar`, NADA é escrito e voltam as 8 linhas com `antes`,
-- `depois` e `acao`. A tela mostra a tabela e só então repete com true.
--
-- IDEMPOTENTE POR CONSTRUÇÃO: reaplicar devolve 8 `igual` e não toca no banco.
--
-- O CALENDÁRIO NÃO ENTRA AQUI, DE PROPÓSITO. Quem calcula os oito números é
-- `semanaPadrao()` em `src/features/sobreaviso/modelo.ts`, e eles CHEGAM nos
-- arrays. Portar feriado, ponto facultativo e Páscoa para o SQL faria a regra
-- ter DUAS respostas — que é a coisa que a U83 passou uma entrega inteira
-- consertando (o classificador de tipo de chamado, dois meses divergindo com o
-- verificador verde). Aqui o servidor deriva do DADO: o teto de 24h é CHECK, e
-- ele vale para o array e para a digitação solta igualmente.
--
-- POR QUE NENHUM NOME DE COLUNA DO `RETURNS TABLE` APARECE SEM QUALIFICAÇÃO:
-- em PL/pgSQL, com o padrão `plpgsql.variable_conflict = error`, um nome que é
-- ao mesmo tempo variável (parâmetro OUT) e coluna de uma tabela em escopo
-- levanta 42702 "column reference is ambiguous" — EM EXECUÇÃO, não na leitura.
-- `dia` é OUT desta função E coluna de public.sobreaviso. Por isso as CTEs
-- usam nomes que NÃO colidem (d, ant, h, ab, ac) e toda referência é
-- qualificada. Há uma asserção permanente no verificador medindo isso em TODA
-- migration do repositório, porque é defeito de CLASSE e nada o pegava.
CREATE OR REPLACE FUNCTION public.sobreaviso_aplicar_padrao(
  _pessoa    uuid,
  _segunda   date,
  _horas     integer[],
  _absorve   integer[],
  _confirmar boolean DEFAULT false
)
RETURNS TABLE (dia date, antes smallint, depois smallint, acao text, aplicado boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $aplicar$
DECLARE
  v_nh int := COALESCE(array_length(_horas, 1), 0);
  v_na int := COALESCE(array_length(_absorve, 1), 0);
BEGIN
  -- auth.uid() é NULL quando isto roda pela migration ou pelo SQL Editor (sem
  -- JWT) — aí o gate não faz sentido e passa. É o idioma literal da U76/U78.
  -- As duas metades do gate: o PAPEL (is_gestor, que inclui o SAC) e o VÍNCULO
  -- (linha ativa em profiles, e não um convite pendente). SECURITY DEFINER não
  -- passa pela RLS, então o mesmo teste de dois eixos da policy tem de estar
  -- escrito aqui — é o que impede um login de ex-funcionário de reescrever a
  -- escala por /rest/v1/rpc.
  IF auth.uid() IS NOT NULL AND NOT (
       public.is_gestor(auth.uid())
       AND EXISTS (SELECT 1 FROM public.profiles p
                    WHERE p.id = auth.uid()
                      AND p.ativo
                      AND p.status <> 'pendente_aprovacao')
     ) THEN
    RAISE EXCEPTION 'Só quem responde pela operação lança a escala de sobreaviso.'
      USING ERRCODE = '42501';
  END IF;

  -- ERRO QUE DEVOLVE O QUE CHEGOU. "Tem de ter 8 dias" manda quem lê ir
  -- procurar o que ele mandou; dizer os dois tamanhos recebidos encerra a
  -- investigação na própria mensagem.
  IF v_nh <> 8 OR v_na <> 8 THEN
    RAISE EXCEPTION 'A semana padrão tem 8 dias de calendário (segunda 18:00 à segunda 08:00); recebi % horas e % absorve.',
      v_nh, v_na USING ERRCODE = '22023';
  END IF;

  IF _pessoa IS NULL OR _segunda IS NULL THEN
    RAISE EXCEPTION 'Pessoa e segunda-feira são obrigatórias; recebi pessoa=% e segunda=%.',
      COALESCE(_pessoa::text, 'NULL'), COALESCE(_segunda::text, 'NULL')
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _pessoa) THEN
    RAISE EXCEPTION 'Não existe ninguém com o id % — a escala de sobreaviso sai de public.profiles, e não de uma segunda lista de gente.',
      _pessoa USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF EXTRACT(ISODOW FROM _segunda) <> 1 THEN
    RAISE EXCEPTION 'A semana padrão começa numa SEGUNDA-feira; recebi % (ISODOW %).',
      _segunda, EXTRACT(ISODOW FROM _segunda) USING ERRCODE = '22007';
  END IF;

  RETURN QUERY
  WITH entrada AS (
    SELECT (_segunda + (eh.ord - 1)::int)::date AS d,
           eh.v::smallint                       AS h,
           ea.v::smallint                       AS ab
      FROM unnest(_horas)   WITH ORDINALITY AS eh(v, ord)
      JOIN unnest(_absorve) WITH ORDINALITY AS ea(v, ord) ON ea.ord = eh.ord
  ),
  calc AS (
    SELECT en.d, en.h, en.ab, s.horas AS ant,
           -- OS QUATRO RAMOS, NA ORDEM. `somar` vem ANTES de `igual por soma`:
           -- os dois olham `ab`, e trocá-los mandaria o caso da virada para o
           -- ramo errado se `h` chegasse zero. O gêmeo em TypeScript é
           -- `acaoDoPadrao()`, e o verificador mede o ACORDO exercitando os
           -- dois lados — presença de texto não prova concordância.
           (CASE
              WHEN s.horas IS NULL                             THEN 'inserir'
              WHEN s.horas = en.h                              THEN 'igual'
              WHEN en.ab IS NOT NULL AND s.horas = en.ab
                   AND s.horas + en.h <= 24                    THEN 'somar'
              WHEN en.ab IS NOT NULL AND s.horas = en.h + en.ab THEN 'igual'
              ELSE 'trocar'
            END) AS ac
      FROM entrada en
      LEFT JOIN public.sobreaviso s
             ON s.dia = en.d AND s.pessoa_id = _pessoa
  ),
  -- `c2.ac` QUALIFICADO. Sem o alias, `ac` seria só uma coluna de CTE — mas
  -- esta é exatamente a expressão que decide se o gesto destrutivo escreve, e
  -- é onde uma não-qualificação custa a migration inteira.
  decisao AS (
    SELECT (_confirmar
            OR NOT EXISTS (SELECT 1 FROM calc c2 WHERE c2.ac = 'trocar')) AS escreve
  ),
  -- CTE que MODIFICA DADO roda sempre e por inteiro, mesmo sem ser referenciada
  -- pela consulta principal — e as duas enxergam o MESMO snapshot, então o
  -- LEFT JOIN de `calc` continua vendo o estado de ANTES. É por isso que a
  -- prévia e a escrita não podem discordar.
  gravado AS (
    INSERT INTO public.sobreaviso (dia, pessoa_id, horas, origem, alterada_por)
    SELECT c.d, _pessoa,
           (CASE WHEN c.ac = 'somar' THEN c.ant + c.h ELSE c.h END)::smallint,
           'padrao', auth.uid()
      FROM calc c CROSS JOIN decisao dc
     WHERE dc.escreve AND c.ac <> 'igual'
    ON CONFLICT ON CONSTRAINT sobreaviso_pkey DO UPDATE
      SET horas        = EXCLUDED.horas,
          origem       = 'padrao',
          alterada_por = EXCLUDED.alterada_por
    RETURNING sobreaviso.dia AS d
  )
  SELECT c.d,
         c.ant,
         (CASE WHEN c.ac = 'somar' THEN (c.ant + c.h)::smallint
               WHEN c.ac = 'igual' THEN c.ant
               ELSE c.h END),
         c.ac,
         (dc.escreve AND c.ac <> 'igual')
    FROM calc c CROSS JOIN decisao dc
   ORDER BY c.d;
END
$aplicar$;

REVOKE EXECUTE ON FUNCTION public.sobreaviso_aplicar_padrao(uuid, date, integer[], integer[], boolean) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.sobreaviso_aplicar_padrao(uuid, date, integer[], integer[], boolean) TO authenticated, service_role;

COMMENT ON FUNCTION public.sobreaviso_aplicar_padrao(uuid, date, integer[], integer[], boolean) IS
  'Aplica a semana padrão (8 dias: segunda 18:00 à segunda 08:00) para uma '
  'pessoa. DUAS FASES: com _confirmar=false e qualquer célula em "trocar", '
  'NADA é escrito e voltam as 8 linhas com antes/depois/acao para a tela '
  'mostrar. Ações: inserir (vazio), igual (nada muda), somar (o vizinho já '
  'gravou a outra metade daquele dia — 8 + 6 = 14), trocar (substitui, e é a '
  'única que exige confirmação). Idempotente: reaplicar devolve 8 "igual". '
  'Quem calcula os 8 números é semanaPadrao() em TypeScript — o calendário de '
  'feriados NÃO existe em SQL, de propósito, para a regra não ter duas '
  'respostas.';

-- ═══════════════════════════════════════════════════════════════════════
-- §4) LIMPAR — E A ASSIMETRIA É O ARGUMENTO
-- ═══════════════════════════════════════════════════════════════════════
-- Aplicar tem um caminho livre (quando nada colide, escreve direto). Limpar
-- NÃO TEM: `_confirmar` não tem atalho, porque limpar SEMPRE perde. A primeira
-- chamada nunca apaga nada — ela devolve exatamente as linhas que morreriam,
-- com as horas e a origem de cada uma, e é isso que a tela mostra. Não existe
-- "tem certeza?" nesta migration.
--
-- `_so_padrao` nasce TRUE: o alvo normal é desfazer o que a máquina pôs, sem
-- levar junto o que uma pessoa digitou à mão. Passar false é decisão
-- explícita, e a lista devolvida na fase 1 mostra a coluna `origem` para que
-- ela seja tomada com o dado na frente.
CREATE OR REPLACE FUNCTION public.sobreaviso_limpar(
  _pessoa    uuid,
  _de        date,
  _ate       date,
  _so_padrao boolean DEFAULT true,
  _confirmar boolean DEFAULT false
)
RETURNS TABLE (dia date, horas smallint, origem text, apagado boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $limpar$
BEGIN
  -- O mesmo gate de duas metades da RPC de aplicar. Ver a nota lá.
  IF auth.uid() IS NOT NULL AND NOT (
       public.is_gestor(auth.uid())
       AND EXISTS (SELECT 1 FROM public.profiles p
                    WHERE p.id = auth.uid()
                      AND p.ativo
                      AND p.status <> 'pendente_aprovacao')
     ) THEN
    RAISE EXCEPTION 'Só quem responde pela operação limpa a escala de sobreaviso.'
      USING ERRCODE = '42501';
  END IF;

  IF _pessoa IS NULL OR _de IS NULL OR _ate IS NULL THEN
    RAISE EXCEPTION 'Pessoa e faixa de datas são obrigatórias; recebi pessoa=%, de=%, ate=%.',
      COALESCE(_pessoa::text, 'NULL'), COALESCE(_de::text, 'NULL'), COALESCE(_ate::text, 'NULL')
      USING ERRCODE = '22023';
  END IF;

  IF _ate < _de THEN
    RAISE EXCEPTION 'A faixa está invertida: de=% vem depois de ate=%.', _de, _ate
      USING ERRCODE = '22007';
  END IF;

  RETURN QUERY
  WITH alvo AS (
    SELECT s.dia AS d, s.horas AS h, s.origem AS og
      FROM public.sobreaviso s
     WHERE s.pessoa_id = _pessoa
       AND s.dia BETWEEN _de AND _ate
       AND (NOT _so_padrao OR s.origem = 'padrao')
  ),
  removido AS (
    DELETE FROM public.sobreaviso s
     USING alvo a
     WHERE _confirmar
       AND s.pessoa_id = _pessoa
       AND s.dia = a.d
    RETURNING s.dia AS d
  )
  SELECT a.d, a.h, a.og, _confirmar
    FROM alvo a
   ORDER BY a.d;
END
$limpar$;

REVOKE EXECUTE ON FUNCTION public.sobreaviso_limpar(uuid, date, date, boolean, boolean) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.sobreaviso_limpar(uuid, date, date, boolean, boolean) TO authenticated, service_role;

COMMENT ON FUNCTION public.sobreaviso_limpar(uuid, date, date, boolean, boolean) IS
  'Apaga a escala de uma pessoa numa faixa de datas. ASSIMÉTRICA em relação a '
  'sobreaviso_aplicar_padrao de propósito: aqui _confirmar NÃO tem caminho '
  'livre, porque limpar sempre perde. A primeira chamada devolve as linhas que '
  'morreriam (dia, horas, origem) e não apaga nada. _so_padrao=true (o padrão) '
  'poupa o que foi digitado à mão.';

-- ═══════════════════════════════════════════════════════════════════════
-- §5) A CHAVE DA TELA
-- ═══════════════════════════════════════════════════════════════════════
-- `permissoes_tela` esconde o MENU; quem decide de verdade é a policy do §2
-- (docs/manual/seguranca.md:62). Os três papéis nascem TRUE porque a leitura
-- já é aberta pela policy — deixar false aqui esconderia o item de menu de
-- quem pode ver a página por `curl`, que é o pior dos dois mundos.
--
-- Os valores batem, um a um, com o `padrao` de src/lib/telas.ts. O verificador
-- compara os dois conjuntos e falha se divergirem — foi por isso que esta
-- migration entrou na lista ARQUIVOS_SEMENTE dele.
--
-- CHECK VIVO de permissoes_tela.cargo, conferido:
--   CHECK (cargo IN ('tecnico','comercial','sac'))
--   -- 20260819180000_u11_permissoes_tela.sql:34-35, e NENHUMA migration
--   -- posterior a redefine (conferido por grep em ADD/DROP CONSTRAINT).
-- Os três literais abaixo estão na lista.
INSERT INTO public.permissoes_tela (tela, cargo, permitido) VALUES
  ('sobreaviso', 'tecnico', true),
  ('sobreaviso', 'comercial', true),
  ('sobreaviso', 'sac', true)
ON CONFLICT (tela, cargo) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
-- §6) O PORTÃO — seis provas, dentro da transação, e sem deixar lixo
-- ═══════════════════════════════════════════════════════════════════════
-- Ele exercita as DUAS RPCs e os DOIS caminhos de escrita (o array e a
-- digitação solta), porque um portão que prova o caminho que ninguém usa é a
-- pior asserção que existe: fica verde POR CAUSA do defeito.
--
-- A cobaia é uma pessoa REAL (a FK é RESTRICT, não há como inventar id) e uma
-- faixa de datas de 1900, que nenhum dado de produção alcança. 1900-03-05 é uma
-- segunda-feira, e a semana dela não tem feriado brasileiro nenhum — escolhida
-- assim para que os oito números abaixo sejam a semana padrão CANÔNICA.
--
-- OS OITO NÚMEROS SÃO FIXTURE ESCRITA À MÃO (regra 4), e não a saída de
-- `semanaPadrao()`. Se o portão chamasse o gerador, ele conferiria a função
-- contra ela mesma. Aqui ele confere a RPC contra uma constante independente:
-- 6 + 14x4 + 24x2 + 8 = 118, que é a mesma soma por outro caminho (14 x 5 dias
-- úteis + 24 x 2 de fim de semana).
DO $portao$
DECLARE
  v_p        uuid;
  v_seg      date := DATE '1900-03-05';
  v_horas    integer[] := ARRAY[6, 14, 14, 14, 14, 24, 24, 8];
  v_absorve  integer[] := ARRAY[8, NULL, NULL, NULL, NULL, NULL, NULL, 6];
  v_acoes    text;
  v_aplicou  int;
  v_soma     int;
  v_virada   date := DATE '1900-03-12';
  v_pegou    boolean;
  v_sobra    int;
BEGIN
  SELECT p.id INTO v_p
    FROM public.profiles p
   WHERE p.ativo AND p.status <> 'pendente_aprovacao'
   ORDER BY p.id
   LIMIT 1;

  -- ── PROVA 1: a primeira aplicação numa faixa virgem escreve as 8 ────────
  SELECT string_agg(r.acao, ',' ORDER BY r.dia), count(*) FILTER (WHERE r.aplicado)
    INTO v_acoes, v_aplicou
    FROM public.sobreaviso_aplicar_padrao(v_p, v_seg, v_horas, v_absorve, false) r;
  IF v_acoes <> 'inserir,inserir,inserir,inserir,inserir,inserir,inserir,inserir' THEN
    RAISE EXCEPTION 'U86 PORTÃO 1: faixa virgem devia dar 8 "inserir"; deu %.', v_acoes;
  END IF;
  IF v_aplicou <> 8 THEN
    RAISE EXCEPTION 'U86 PORTÃO 1: sem colisão, _confirmar=false ESCREVE (não há o que perder); esperava 8 aplicados, deu %.', v_aplicou;
  END IF;
  SELECT COALESCE(sum(s.horas), 0) INTO v_soma
    FROM public.sobreaviso s
   WHERE s.pessoa_id = v_p AND s.dia BETWEEN v_seg AND v_seg + 7;
  IF v_soma <> 118 THEN
    RAISE EXCEPTION 'U86 PORTÃO 1: a semana padrão soma 118h (6 + 14x4 + 24x2 + 8); gravou %.', v_soma;
  END IF;

  -- ── PROVA 2: reaplicar é 8 "igual" e NÃO toca no banco ──────────────────
  SELECT string_agg(r.acao, ',' ORDER BY r.dia), count(*) FILTER (WHERE r.aplicado)
    INTO v_acoes, v_aplicou
    FROM public.sobreaviso_aplicar_padrao(v_p, v_seg, v_horas, v_absorve, false) r;
  IF v_acoes <> 'igual,igual,igual,igual,igual,igual,igual,igual' OR v_aplicou <> 0 THEN
    RAISE EXCEPTION 'U86 PORTÃO 2: reaplicar tem de ser idempotente (8 "igual", 0 aplicados); deu % com % aplicados.', v_acoes, v_aplicou;
  END IF;

  -- ── PROVA 3: a semana SEGUINTE soma na virada, e não sobrescreve ────────
  -- O 12/03/1900 (v_virada) já tem as 8h de madrugada da semana anterior. A semana nova
  -- quer pôr 6h de noite. `somar` é a única resposta que fecha 14 = cobertura.
  SELECT string_agg(r.acao, ',' ORDER BY r.dia) INTO v_acoes
    FROM public.sobreaviso_aplicar_padrao(v_p, v_virada, v_horas, v_absorve, false) r;
  IF v_acoes <> 'somar,inserir,inserir,inserir,inserir,inserir,inserir,inserir' THEN
    RAISE EXCEPTION 'U86 PORTÃO 3: a segunda de virada tinha de cair em "somar" (8 + 6 = 14); a sequência veio %.', v_acoes;
  END IF;
  SELECT s.horas INTO v_soma FROM public.sobreaviso s
   WHERE s.pessoa_id = v_p AND s.dia = v_virada;
  IF v_soma <> 14 THEN
    RAISE EXCEPTION 'U86 PORTÃO 3: a virada tinha de ficar com 14h (8 da madrugada + 6 da noite); ficou com %.', v_soma;
  END IF;

  -- ── PROVA 4: com colisão real, _confirmar=false NÃO ESCREVE ─────────────
  -- Põe 12h à mão num dia do miolo (que o padrão quer em 14) e prova que a
  -- fase 1 devolve `trocar`, marca aplicado=false em TODAS as oito e deixa o
  -- 12 exatamente onde estava. É o teste do gesto destrutivo.
  UPDATE public.sobreaviso s SET horas = 12, origem = 'manual'
   WHERE s.pessoa_id = v_p AND s.dia = v_seg + 2;
  SELECT string_agg(r.acao, ',' ORDER BY r.dia), count(*) FILTER (WHERE r.aplicado)
    INTO v_acoes, v_aplicou
    FROM public.sobreaviso_aplicar_padrao(v_p, v_seg, v_horas, v_absorve, false) r;
  IF position('trocar' in v_acoes) = 0 THEN
    RAISE EXCEPTION 'U86 PORTÃO 4: 12h onde o padrão quer 14h tinha de ser "trocar"; a sequência veio %.', v_acoes;
  END IF;
  IF v_aplicou <> 0 THEN
    RAISE EXCEPTION 'U86 PORTÃO 4: com "trocar" na lista e _confirmar=false, NADA pode ser escrito; % células foram aplicadas.', v_aplicou;
  END IF;
  SELECT s.horas INTO v_soma FROM public.sobreaviso s
   WHERE s.pessoa_id = v_p AND s.dia = v_seg + 2;
  IF v_soma <> 12 THEN
    RAISE EXCEPTION 'U86 PORTÃO 4: a célula em conflito tinha de continuar com 12h; está com %.', v_soma;
  END IF;

  -- ── PROVA 5: o teto de 24h vale no caminho DA DIGITAÇÃO, não só no array ─
  -- A tela salva célula solta por UPDATE/INSERT direto (R90, a cada 0,7s de
  -- digitação). É ESSE o caminho que precisa da prova — provar o teto só pelo
  -- array seria provar a porta que quase ninguém usa.
  v_pegou := false;
  BEGIN
    UPDATE public.sobreaviso s SET horas = 25
     WHERE s.pessoa_id = v_p AND s.dia = v_seg + 2;
  EXCEPTION WHEN check_violation THEN
    v_pegou := true;
  END;
  IF NOT v_pegou THEN
    RAISE EXCEPTION 'U86 PORTÃO 5: o CHECK tinha de recusar 25h num UPDATE direto — é o caminho da digitação, e ele passou.';
  END IF;
  v_pegou := false;
  BEGIN
    UPDATE public.sobreaviso s SET horas = 0
     WHERE s.pessoa_id = v_p AND s.dia = v_seg + 2;
  EXCEPTION WHEN check_violation THEN
    v_pegou := true;
  END;
  IF NOT v_pegou THEN
    RAISE EXCEPTION 'U86 PORTÃO 5: o CHECK tinha de recusar 0h — célula vazia é AUSÊNCIA de linha, e um 0 gravado é vazio para a tela e preenchido para a colisão.';
  END IF;

  -- ── PROVA 6: limpar não apaga na primeira chamada, e apaga na segunda ───
  SELECT count(*), count(*) FILTER (WHERE r.apagado) INTO v_aplicou, v_sobra
    FROM public.sobreaviso_limpar(v_p, v_seg, v_seg + 14, false, false) r;
  IF v_aplicou = 0 THEN
    RAISE EXCEPTION 'U86 PORTÃO 6: a fase 1 de limpar tinha de LISTAR o que morreria; listou nada.';
  END IF;
  IF v_sobra <> 0 THEN
    RAISE EXCEPTION 'U86 PORTÃO 6: limpar NÃO TEM caminho livre — a primeira chamada não pode apagar nada, e marcou % como apagadas.', v_sobra;
  END IF;
  SELECT count(*) INTO v_sobra FROM public.sobreaviso s
   WHERE s.pessoa_id = v_p AND s.dia BETWEEN v_seg AND v_seg + 14;
  IF v_sobra = 0 THEN
    RAISE EXCEPTION 'U86 PORTÃO 6: a fase 1 de limpar APAGOU as linhas. Nenhuma podia sair.';
  END IF;

  -- ── LIMPEZA: o portão não deixa lixo, e a ausência é PROVADA ────────────
  DELETE FROM public.sobreaviso s
   WHERE s.pessoa_id = v_p AND s.dia BETWEEN v_seg AND v_seg + 30;
  SELECT count(*) INTO v_sobra FROM public.sobreaviso s
   WHERE s.dia < DATE '1990-01-01';
  IF v_sobra <> 0 THEN
    RAISE EXCEPTION 'U86 PORTÃO: sobraram % linhas de teste anteriores a 1990. Esta migration não pode deixar dado inventado no banco.', v_sobra;
  END IF;
END
$portao$;

-- ═══════════════════════════════════════════════════════════════════════
-- §7) CONFERÊNCIA — obtido × esperado × veredito, em SELECT
-- ═══════════════════════════════════════════════════════════════════════
-- O QUE O DAVI OLHA: a TABELA. Ele procura '>>> OLHAR <<<' na coluna
-- `veredito`. RAISE NOTICE é invisível no editor; nada aqui depende dele.
SELECT t.ordem, t.conferencia, t.valor, t.esperado,
       CASE WHEN t.esperado = '(referência)'             THEN '— referência'
            WHEN t.valor IS NOT DISTINCT FROM t.esperado THEN 'ok'
            ELSE '>>> OLHAR <<<' END AS veredito
  FROM (

-- ══ 101: A TABELA EXISTE E A CHAVE É (dia, pessoa_id) NESSA ORDEM ═════════
-- A ORDEM é medida, e não só a presença: (pessoa_id, dia) casaria qualquer
-- teste de "a PK tem as duas colunas" e trocaria a varredura de faixa da
-- consulta de toda abertura por um percurso de índice inteiro.
SELECT 101 AS ordem,
       'CRÍTICO: a PK de public.sobreaviso é (dia, pessoa_id) NESSA ORDEM — a consulta de toda abertura é faixa contígua de datas' AS conferencia,
       (SELECT string_agg(a.attname, ',' ORDER BY k.ord)
          FROM pg_constraint c
          JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(att, ord) ON true
          JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.att
         WHERE c.conrelid = 'public.sobreaviso'::regclass
           AND c.conname  = 'sobreaviso_pkey') AS valor,
       'dia,pessoa_id' AS esperado

UNION ALL
-- ══ 102: O TETO, LIDO DO CATÁLOGO ════════════════════════════════════════
-- É a MESMA string que o verificador extrai por regex do arquivo e compara com
-- `HORAS_MAX` importado e executado do modelo puro. Os dois lados exercitados,
-- e a terceira metade derivada de uma regra que não vem de nenhum dos dois:
-- um dia tem 24 horas.
-- Os dois NÚMEROS são extraídos do texto deparsado, e não o texto inteiro: o
-- Postgres reescreve a parentização (`CHECK (((horas > 0) AND (horas <= 24)))`)
-- e uma conferência que comparasse a string bruta diria '>>> OLHAR <<<' numa
-- execução PERFEITA — que é o pior jeito de falhar, porque ensina a ignorar a
-- única coluna que existe para ser lida.
SELECT 102, 'CRÍTICO: o teto de horas por célula é CHECK no banco, e ele recusa 0 e 25 — a tela não é a guarda',
       (SELECT (regexp_match(pg_get_constraintdef(c.oid), 'horas > ([0-9]+)'))[1]
               || ' < horas <= ' ||
               (regexp_match(pg_get_constraintdef(c.oid), 'horas <= ([0-9]+)'))[1]
          FROM pg_constraint c
         WHERE c.conrelid = 'public.sobreaviso'::regclass
           AND c.conname  = 'sobreaviso_horas_check'),
       '0 < horas <= 24'

UNION ALL
-- ══ 103: E AS DUAS CONSTRAINTS ESTÃO VALIDADAS ═══════════════════════════
-- Uma constraint NOT VALID aparece no catálogo, casa a 102 e NÃO protege uma
-- linha sequer. É o modo silencioso de esta migration virar decoração.
SELECT 103, 'CRÍTICO: os dois CHECK estão VALIDADOS — NOT VALID passaria pela conferência acima protegendo nada',
       (SELECT string_agg(c.convalidated::text, ',' ORDER BY c.conname)
          FROM pg_constraint c
         WHERE c.conrelid = 'public.sobreaviso'::regclass AND c.contype = 'c'),
       'true,true'

UNION ALL
-- ══ 104: A FK É RESTRICT ═════════════════════════════════════════════════
-- 'a' = NO ACTION, 'r' = RESTRICT, 'c' = CASCADE. Com CASCADE, apagar um
-- usuário levaria junto a folha de plantão dele.
SELECT 104, 'CRÍTICO: pessoa_id -> profiles é RESTRICT — quem sai da empresa NÃO some do histórico de plantão',
       (SELECT c.confdeltype::text
          FROM pg_constraint c
          JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
         WHERE c.conrelid = 'public.sobreaviso'::regclass
           AND c.contype = 'f' AND a.attname = 'pessoa_id'),
       'r'

UNION ALL
-- ══ 105: RLS LIGADA, E AS DUAS POLÍTICAS ═════════════════════════════════
-- A policy é a única fronteira real: todo usuário fala com o Postgres com a
-- mesma chave publicável, versionada no .env.
SELECT 105, 'CRÍTICO: RLS está LIGADA em public.sobreaviso — sem ela a tabela é pública para qualquer portador da chave do .env',
       (SELECT c.relrowsecurity::text FROM pg_class c WHERE c.oid = 'public.sobreaviso'::regclass),
       'true'

UNION ALL
SELECT 106, 'CRÍTICO: ver é de quem TRABALHA aqui (linha ativa em profiles, e não convite pendente) e editar exige TAMBÉM is_gestor() — que INCLUI o SAC. NENHUMA das duas é `true`: a escala diz quem estava trabalhando às 2h da manhã, e isso é informação de pessoal',
       -- O predicado é CLASSIFICADO e não copiado: `pg_get_expr` decide sozinho
       -- se qualifica `public.is_gestor` conforme o search_path de quem lê, e
       -- comparar a string crua faria esta linha depender de quem abriu o
       -- editor. O que importa é a CLASSE do predicado, e ela é medida.
       -- O ramo `true` continua NOMEADO de propósito: se alguém afrouxar a
       -- policy um dia, esta linha diz `todos` em vez de sumir em silêncio.
       (SELECT string_agg(p.policyname || ':' ||
                 CASE WHEN p.qual = 'true' THEN 'todos'
                      WHEN p.qual LIKE '%is_gestor%' AND p.qual LIKE '%pendente_aprovacao%' THEN 'gestor+vinculo'
                      WHEN p.qual LIKE '%is_gestor%' THEN 'gestor'
                      WHEN p.qual LIKE '%pendente_aprovacao%' AND p.qual LIKE '%ativo%' THEN 'vinculo'
                      ELSE COALESCE(p.qual, '(sem qual)') END, ' | ' ORDER BY p.policyname)
          FROM pg_policies p
         WHERE p.schemaname = 'public' AND p.tablename = 'sobreaviso'),
       'sobreaviso_select:vinculo | sobreaviso_write:gestor+vinculo'

UNION ALL
-- ══ 107: AS DUAS RPCs SÃO SECURITY DEFINER E NÃO SÃO EXECUTÁVEIS POR anon ═
-- EXECUTE é concedido a PUBLIC por padrão e `anon` herda. Uma SECURITY DEFINER
-- sem REVOKE é um /rest/v1/rpc/<nome> aberto ao mundo.
-- `to_regrole` guarda contra um ambiente sem o papel `anon` (um Postgres local,
-- por exemplo). Sem ele, `has_function_privilege` levantaria e ABORTARIA a
-- migration inteira por uma razão que não tem nada a ver com esta entrega —
-- uma conferência não pode ser o motivo de o DDL não aplicar.
SELECT 107, 'CRÍTICO: nem anon nem PUBLIC executam as duas RPCs — SECURITY DEFINER sem REVOKE é endpoint REST aberto',
       (SELECT string_agg(x.nome || '=' || x.pode::text, ' | ' ORDER BY x.nome)
          FROM (SELECT 'aplicar' AS nome,
                       (to_regrole('anon') IS NOT NULL
                        AND has_function_privilege('anon', 'public.sobreaviso_aplicar_padrao(uuid,date,integer[],integer[],boolean)', 'EXECUTE')) AS pode
                UNION ALL
                SELECT 'limpar',
                       (to_regrole('anon') IS NOT NULL
                        AND has_function_privilege('anon', 'public.sobreaviso_limpar(uuid,date,date,boolean,boolean)', 'EXECUTE'))) x),
       'aplicar=false | limpar=false'

UNION ALL
SELECT 108, 'CRÍTICO: e authenticated executa as duas — sem isto a tela abre e nenhum botão funciona',
       (SELECT string_agg(x.nome || '=' || x.pode::text, ' | ' ORDER BY x.nome)
          FROM (SELECT 'aplicar' AS nome,
                       (to_regrole('authenticated') IS NOT NULL
                        AND has_function_privilege('authenticated', 'public.sobreaviso_aplicar_padrao(uuid,date,integer[],integer[],boolean)', 'EXECUTE')) AS pode
                UNION ALL
                SELECT 'limpar',
                       (to_regrole('authenticated') IS NOT NULL
                        AND has_function_privilege('authenticated', 'public.sobreaviso_limpar(uuid,date,date,boolean,boolean)', 'EXECUTE'))) x),
       'aplicar=true | limpar=true'

UNION ALL
-- ══ 109: A CHAVE DE TELA, OS TRÊS PAPÉIS ═════════════════════════════════
SELECT 109, 'CRÍTICO: a chave "sobreaviso" existe para os três papéis e os três valores batem com o padrão de src/lib/telas.ts — numa INSTALAÇÃO NOVA. Um ajuste deliberado do admin na tela de permissões faz esta linha divergir, e isso é CORRETO: a tela de permissões existe justamente para quebrar este padrão',
       (SELECT string_agg(p.cargo || '=' || p.permitido::text, ',' ORDER BY p.cargo)
          FROM public.permissoes_tela p WHERE p.tela = 'sobreaviso'),
       'comercial=true,sac=true,tecnico=true'

UNION ALL
-- ══ 110: O PORTÃO NÃO DEIXOU LIXO ════════════════════════════════════════
-- Ele escreveu 1900 e apagou. Se este número não for 0, há dado INVENTADO em
-- produção, e ele entraria no total do mês de alguém.
SELECT 110, 'CRÍTICO: nenhuma linha de teste sobreviveu ao portão — ele escreveu em 1900 e apagou',
       (SELECT count(*)::text FROM public.sobreaviso s WHERE s.dia < DATE '1990-01-01'),
       '0'

UNION ALL
-- ══ 111: O CENSO DO MÊS CORRENTE — REFERÊNCIA, NUNCA VEREDITO ════════════
-- Regra 3: censo, e ele DECLARA O PRÓPRIO RECORTE. Recorte: os dias do mês
-- corrente, somando TODAS as pessoas, uma contagem por total de horas.
--
-- ELE NÃO CALCULA O VEREDITO, E ISSO É DELIBERADO. O esperado real de um dia
-- (14 se útil, 24 se não) depende do CALENDÁRIO DE FERIADOS, que mora em
-- src/lib/feriados.ts e NÃO existe em SQL — portá-lo para cá faria a regra ter
-- duas respostas, que é exatamente o defeito que a U83 passou uma entrega
-- consertando. Chumbar 24 aqui acenderia "curto" em todo dia útil; chumbar
-- ISODOW < 6 acenderia "curto" em todo feriado. As duas mentem. O que este
-- número faz é mostrar a DISTRIBUIÇÃO crua, para o olho humano comparar com a
-- faixa de cobertura que a tela desenha.
SELECT 111, 'referência: distribuição de horas somadas por dia no mês corrente (recorte: dias do mês atual, TODAS as pessoas). 0h = dia descoberto; 14h = dia útil coberto; 24h = fim de semana ou feriado coberto',
       (SELECT COALESCE(string_agg(x.rot, ' · ' ORDER BY x.rot), '(mês vazio)')
          FROM (SELECT t.h::text || 'h=' || count(*)::text AS rot
                  FROM (SELECT d.dia::date AS dia,
                               COALESCE((SELECT sum(s.horas) FROM public.sobreaviso s
                                          WHERE s.dia = d.dia::date), 0) AS h
                          FROM generate_series(date_trunc('month', current_date),
                                               date_trunc('month', current_date) + INTERVAL '1 month - 1 day',
                                               INTERVAL '1 day') AS d(dia)) t
                 GROUP BY t.h) x),
       '(referência)'

UNION ALL
SELECT 112, 'referência: total de linhas na tabela (numa execução limpa é 0 — esta migration não semeia dado operacional nenhum)',
       (SELECT count(*)::text FROM public.sobreaviso),
       '(referência)'

UNION ALL
-- ══ 113: O CARIMBO ARMADO E O ÍNDICE DO EIXO INVERSO ═════════════════════
-- Os dois são load-bearing e nenhuma das doze linhas acima os media.
--
-- O GATILHO é quem sustenta a promessa da P49 — "a correção de um mês já
-- fechado é ENCONTRÁVEL". Sem ele, `alterada_em` fica no DEFAULT do INSERT e o
-- UPDATE não carimba nada: a alteração pós-fechamento vira invisível, e o
-- argumento inteiro de recusar a coluna `travado` cai junto. Medir a EXISTÊNCIA
-- não basta — `tgenabled = 'O'` mede que ele está ARMADO, porque um
-- `ALTER TABLE … DISABLE TRIGGER` deixa o objeto no catálogo e a promessa no
-- chão.
--
-- O ÍNDICE é o eixo "quanto a Fabiana fez em 2027", que a PK (dia, pessoa_id)
-- não atende — nela `pessoa_id` é a segunda coluna.
SELECT 113, 'CRÍTICO: o gatilho do carimbo está ARMADO (é ele que torna a correção pós-fechamento encontrável, e é por isso que NÃO existe coluna `travado`) e o índice do eixo pessoa existe',
       (SELECT COALESCE(string_agg(x.nome || '=' || x.tem::text, ' | ' ORDER BY x.nome), '(nada)')
          FROM (SELECT 'trigger' AS nome,
                       EXISTS (SELECT 1 FROM pg_trigger g
                                WHERE g.tgrelid = 'public.sobreaviso'::regclass
                                  AND g.tgname = 'trg_sobreaviso_carimbo'
                                  AND NOT g.tgisinternal
                                  AND g.tgenabled = 'O') AS tem
                UNION ALL
                SELECT 'indice',
                       EXISTS (SELECT 1 FROM pg_class c
                                WHERE c.relname = 'sobreaviso_pessoa_idx'
                                  AND c.relkind = 'i')) x),
       'indice=true | trigger=true'

  ) t
 ORDER BY t.ordem;

COMMIT;

-- ╔═════════════════════════════════════════════════════════════════════════╗
-- ║ DESFAZER — e ele QUEBRA O FRONT, de propósito.                          ║
-- ║                                                                          ║
-- ║ Depois que o push subir, /sobreaviso faz from("sobreaviso") e chama as   ║
-- ║ duas RPCs. Rodar o bloco abaixo com o código no ar devolve PGRST205 na   ║
-- ║ abertura da tela. A ordem do desfazer é a INVERSA da do deploy: reverta  ║
-- ║ o commit do código PRIMEIRO, e só então rode isto.                       ║
-- ║                                                                          ║
-- ║ O QUE ELE NÃO ALCANÇA: as horas já lançadas. O DROP TABLE as leva junto  ║
-- ║ e não há de onde recuperá-las — é folha de plantão. Se já houver mês     ║
-- ║ lançado, EXPORTE antes (a conferência 112 diz quantas linhas existem).   ║
-- ║                                                                          ║
-- ║   BEGIN;                                                                 ║
-- ║   -- 0) CONFERIR ANTES: quantas horas seriam perdidas                    ║
-- ║   SELECT count(*) AS linhas, COALESCE(sum(horas),0) AS horas             ║
-- ║     FROM public.sobreaviso;                                              ║
-- ║   DROP FUNCTION IF EXISTS                                                ║
-- ║     public.sobreaviso_aplicar_padrao(uuid,date,integer[],integer[],boolean); ║
-- ║   DROP FUNCTION IF EXISTS                                                ║
-- ║     public.sobreaviso_limpar(uuid,date,date,boolean,boolean);            ║
-- ║   DROP TRIGGER  IF EXISTS trg_sobreaviso_carimbo ON public.sobreaviso;   ║
-- ║   DROP FUNCTION IF EXISTS public.sobreaviso_carimbo();                   ║
-- ║   DROP TABLE    IF EXISTS public.sobreaviso;                             ║
-- ║   DELETE FROM public.permissoes_tela WHERE tela = 'sobreaviso';          ║
-- ║   COMMIT;                                                                ║
-- ║                                                                          ║
-- ║ E O DELETE ACIMA NÃO ESCONDE O MENU: sem linha em permissoes_tela a      ║
-- ║ chave volta ao PADRÃO DO CATÁLOGO, que é [true,true,true] em             ║
-- ║ src/lib/telas.ts. Se o commit do front não tiver sido revertido, o item  ║
-- ║ REAPARECE no menu para todo mundo, apontando para uma tabela que já não  ║
-- ║ existe. É mais uma razão para a ordem inversa: código primeiro.          ║
-- ╚═════════════════════════════════════════════════════════════════════════╝
