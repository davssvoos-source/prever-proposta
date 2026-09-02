-- ═══════════════════════════════════════════════════════════════════════════
-- U84 — TROCAR O ENDEREÇO ZERA A COORDENADA (R114)
--
-- >>> RODAR NO SQL EDITOR, À MÃO. O §1 ABORTA e não deixa rastro.           <<<
-- >>> O REPOSITÓRIO NUNCA APLICA MIGRATION.                                  <<<
--
-- ── O QUE ELA CRIA, E É SÓ ISTO ───────────────────────────────────────────
-- UMA função de gatilho e UM gatilho. Zero coluna nova, zero RPC, zero policy,
-- zero GRANT, zero extensão, zero tabela, zero job. Ela não escreve UMA LINHA
-- de dado de produção: as únicas escritas em public.clientes que existem aqui
-- são as do PORTÃO (§3), em duas linhas descartáveis que ela mesma cria e
-- apaga DENTRO da mesma transação.
--
-- ── O DEFEITO QUE ELA FECHA ───────────────────────────────────────────────
-- `ClienteForm.tsx` tem UM campo de endereço e um botão "buscar coordenadas".
-- Trocar o endereço e salvar SEM apertar o botão grava o endereço NOVO com a
-- coordenada VELHA. O erro é silencioso e é do pior tipo: ele não produz um
-- campo vazio (que alguém conserta), produz um PONTO PLAUSÍVEL para o endereço
-- ANTERIOR do cliente — o mapa de clientes desenha o prédio onde ele não fica
-- mais, e quem for até lá vai ao lugar errado sem nenhum sinal de que errou.
--
-- E ELE SÓ FICA MAIS CARO COM O TEMPO: a coordenada do cliente é a entrada da
-- estimativa de deslocamento, que é entrega PRÓPRIA e está descrita em
-- docs/PENDENCIAS_TECNICAS.md — ela ainda não existe no código. Um cadastro
-- sujo hoje é um minuto de estrada errado depois. Limpar a fonte antes de o
-- consumidor nascer é a ordem barata; nada aqui depende dele.
--
-- ── POR QUE GATILHO NO BANCO, E NÃO A PROMESSA NO APP ─────────────────────
-- A casa tem doutrina sobre isto, e ela nasceu de um defeito real: a promessa
-- que mora no app é esquecida. Foi o defeito da U82 — a tela prometia uma
-- coisa que só um dos quatro pontos de chamada cumpria. Aqui os pontos de
-- escrita em public.clientes já são pelo menos três (ClienteForm no cadastro,
-- ClienteForm na edição, e o `criarCliente`/`atualizarCliente` que o
-- /gerencial/nova chama por conta própria), e nada impede o quarto.
--
-- MAS GATILHO TEM CUSTO, e o custo é real: ele roda em TODO update de cliente,
-- para sempre, inclusive nos que nada têm a ver com endereço; ele é invisível
-- para quem lê só o TypeScript; e ele pode apagar dado que alguém queria
-- manter. Os três foram pesados:
--   · CUSTO DE EXECUÇÃO: a condição são três comparações de campo em memória,
--     sem consulta, sem índice, sem I/O. Já existe um BEFORE UPDATE nesta
--     tabela (clientes_set_updated_at) e ninguém nunca o notou.
--   · INVISIBILIDADE: é o argumento mais forte CONTRA, e a resposta é a
--     conferência 5 mais o `COMMENT ON TRIGGER` — e o fato de o efeito ser
--     visível na tela (o mapa passa a dizer "sem coordenada" para o cliente).
--   · APAGAR DADO: a coordenada apagada é sempre RECUPERÁVEL com um clique no
--     botão que já existe, e ela estava ERRADA por definição — é a coordenada
--     de um endereço que não é mais o endereço do cliente.
--
-- A ASSIMETRIA DO ERRO É QUEM DECIDE, e ela não é simétrica nem um pouco:
--   · gatilho ESQUECIDO  -> coordenada velha -> um ponto plausível sobre o
--     endereço ANTERIOR, no mapa, sem ninguém saber.             INVISÍVEL.
--   · gatilho ZELOSO     -> coordenada nula  -> campo VAZIO e uma frase que
--     diz "este cliente não tem coordenada".                     VISÍVEL.
-- Entre errar para o invisível e errar para o visível, erra-se para o visível.
--
-- E O QUE O APP FAZ NÃO É A MESMA REGRA DUAS VEZES — SÃO ESCOPOS DIFERENTES.
-- Os quatro formulários que geocodificam limpam a coordenada no `onChange` do
-- campo de endereço. Isso é ESTADO DE FORMULÁRIO, e existe para a pessoa VER a
-- coordenada sumir enquanto ainda pode relocalizar — inclusive em CADASTRO
-- NOVO, que é um INSERT, onde este gatilho (BEFORE UPDATE) não alcança nada.
-- O gatilho cobre o que nenhum formulário cobre: `consolidarGrupo`, import, o
-- /gerencial/nova, e o próximo caminho de escrita que ninguém escreveu ainda.
-- Duas implementações da MESMA regra seriam a receita da U83/R113; duas camadas
-- com escopos diferentes são o que a U82 provou ser necessário — lá, a promessa
-- morava só na tela e só um dos quatro pontos de chamada a cumpria.
-- NÃO APAGUE os `setLat(null)` das quatro telas achando que o banco basta: em
-- INSERT o banco não age, e o gestor deixaria de ver o que vai ser gravado.
--
-- ── ORDEM DE DEPLOY: NÃO HÁ JANELA, NOS DOIS SENTIDOS ─────────────────────
-- O código desta entrega só LÊ colunas que existem desde a etapa1 (2026-08-17)
-- e não nomeia coluna, RPC ou parâmetro novo. Ele não ESCREVE nada que o banco
-- de hoje recuse. Logo:
--   · migration ANTES do push  -> o gatilho passa a zerar, e o front antigo não
--     muda de comportamento. O único efeito visível é o mapa de clientes deixar
--     de desenhar quem trocou de endereço, que é o correto.
--   · push ANTES da migration  -> o front novo não nomeia nada que o banco não
--     tenha. O que não acontece é a zeragem — ou seja, exatamente o
--     comportamento de hoje.
-- Esta migration pode rodar antes ou depois do push, e sozinha ela já melhora
-- o sistema de hoje (o mapa de clientes para de mentir).
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- §1) PRÉ-VOO — aborta e não deixa rastro
-- ═══════════════════════════════════════════════════════════════════════════
DO $preflight$
DECLARE
  v_falta text[] := ARRAY[]::text[];
BEGIN
  IF to_regclass('public.clientes') IS NULL THEN
    RAISE EXCEPTION 'PRE-VOO U84 — nada foi alterado (ROLLBACK). public.clientes não existe.';
  END IF;

  -- AS TRÊS COLUNAS QUE A CONDIÇÃO DO GATILHO LÊ. Se qualquer uma tiver sido
  -- renomeada, o CREATE FUNCTION abaixo passaria (plpgsql não resolve nome de
  -- coluna de NEW/OLD em tempo de criação) e o erro apareceria no primeiro
  -- UPDATE de cliente feito por um usuário, em produção. É o modo de falha que
  -- este pré-voo existe para tornar impossível.
  IF NOT EXISTS (SELECT 1 FROM pg_attribute
                  WHERE attrelid = 'public.clientes'::regclass
                    AND attname = 'endereco' AND NOT attisdropped) THEN
    v_falta := v_falta || 'clientes.endereco'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute
                  WHERE attrelid = 'public.clientes'::regclass
                    AND attname = 'latitude' AND NOT attisdropped) THEN
    v_falta := v_falta || 'clientes.latitude'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute
                  WHERE attrelid = 'public.clientes'::regclass
                    AND attname = 'longitude' AND NOT attisdropped) THEN
    v_falta := v_falta || 'clientes.longitude'; END IF;
  IF array_length(v_falta, 1) IS NOT NULL THEN
    RAISE EXCEPTION E'PRE-VOO U84 — nada foi alterado (ROLLBACK).\nFaltam: %',
      array_to_string(v_falta, ', ');
  END IF;

  -- AS DUAS COLUNAS TÊM DE SER ANULÁVEIS, senão o gatilho não pode zerá-las e o
  -- primeiro UPDATE de endereço em produção devolveria 23502 ao usuário, que
  -- ficaria sem conseguir salvar o cliente.
  IF EXISTS (SELECT 1 FROM pg_attribute
              WHERE attrelid = 'public.clientes'::regclass
                AND attname IN ('latitude','longitude')
                AND NOT attisdropped AND attnotnull) THEN
    RAISE EXCEPTION E'PRE-VOO U84 — nada foi alterado (ROLLBACK).\nclientes.latitude/longitude viraram NOT NULL. O gatilho não pode zerá-las.';
  END IF;
END
$preflight$;

-- ═══════════════════════════════════════════════════════════════════════════
-- §2) O GATILHO
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.clientes_zerar_coordenada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
BEGIN
  -- A CONDIÇÃO TEM TRÊS PERNAS, E CADA UMA TEM UM CASO REAL ATRÁS DELA.
  --
  --  1. NEW.endereco IS DISTINCT FROM OLD.endereco
  --     Só age quando o endereço REALMENTE mudou. Um UPDATE que só troca o
  --     telefone do síndico não pode apagar a coordenada.
  --
  --  2 e 3. a coordenada NÃO veio junto (é idêntica à que já estava)
  --     Esta é a perna que faz o botão "Localizar no mapa" continuar
  --     funcionando, e ela é o desenho inteiro. `ClienteForm.submeter()` manda
  --     SEMPRE `latitude` e `longitude` no patch, com o valor que estiver no
  --     estado da tela. Então:
  --       · trocou o endereço e APERTOU o botão -> a lat/lng enviada é a NOVA,
  --         diferente da do banco -> perna 2 é falsa -> NÃO zera, e a
  --         coordenada recém-buscada sobrevive.
  --       · trocou o endereço e NÃO apertou o botão -> o PRÓPRIO FORMULÁRIO já
  --         zerou a coordenada no `onChange` do campo (ClienteForm.tsx), então
  --         a lat/lng enviada é NULL, DIFERENTE da do banco, a perna 2 é falsa
  --         e o gatilho não precisa agir: o app já agiu, um passo antes, onde a
  --         pessoa VÊ o campo dizer "sem coordenadas".
  --     Sem estas duas pernas o gatilho apagaria justamente a coordenada CERTA
  --     de quem fez tudo direito, e o botão viraria decorativo.
  --
  --     E ENTÃO PARA QUE O GATILHO, SE O FORMULÁRIO JÁ ZERA? Porque os dois têm
  --     ESCOPOS DIFERENTES, e não são a mesma regra escrita duas vezes. O app
  --     limpa o ESTADO DE UM FORMULÁRIO, para a pessoa ver a coordenada sumir e
  --     poder relocalizar. O gatilho cobre TODO caminho de escrita que não é
  --     aquele formulário: `consolidarGrupo`, import, o /gerencial/nova, o
  --     próximo chamador que ninguém escreveu ainda. Foi assim que a U82
  --     falhou: uma promessa de tela que só um dos quatro pontos de chamada
  --     cumpria.
  --
  --     E O QUE ELAS NÃO ALCANÇAM, DITO AQUI PARA NINGUÉM SUPOR O CONTRÁRIO:
  --     "apertou o botão" NÃO implica "coordenada diferente". A U24
  --     geocodificou POR CEP, um CEP cobre a quadra, e 46 clientes dividem 20
  --     coordenadas — corrigir o complemento de um endereço e rebuscar devolve
  --     o MESMO centróide. Aí as pernas 2 e 3 são verdadeiras e o gatilho ZERA
  --     a coordenada recém-conferida. O banco não distingue "não veio" de "veio
  --     igual", e não tem como. Está MEDIDO na perna 4 do PORTÃO (§3) e escrito
  --     no COMMENT ON TRIGGER. O CONSERTO É CLICAR EM "Localizar no mapa" DE
  --     NOVO E SALVAR: na segunda vez o endereço JÁ ESTÁ GRAVADO, a perna 1 é
  --     falsa, e a coordenada sobrevive. E NÃO basta salvar de novo SEM
  --     relocalizar: o `onSuccess` da ficha desmonta o formulário, ele reabre
  --     lendo `inicial?.latitude` — que agora é NULL —, e `submeter()` remanda
  --     esse mesmo NULL. A coordenada ficaria nula para sempre, e o gestor que
  --     seguisse a instrução antiga concluiria que ela é irrecuperável.
  --
  --     ESCOPO: a condição vigia `endereco`, e SÓ ele. `cep`, `cidade`, `uf` e
  --     `complemento` também existem em public.clientes e NÃO disparam a
  --     zeragem. Hoje isso não tem caminho de tela (ClienteForm não tem campo
  --     para nenhuma das quatro), mas `consolidarGrupo` e qualquer import
  --     alcançam. Está no COMMENT ON FUNCTION, e ampliar a condição é decisão
  --     de quem tiver o caso — não se amplia um gatilho por hipótese.
  --
  -- `IS [NOT] DISTINCT FROM` nas três, e não `<>` / `=`: as três colunas são
  -- ANULÁVEIS, e com `<>` um endereço que passa de NULL para 'Rua X' devolveria
  -- NULL (nem verdadeiro nem falso), o IF não entraria, e o caso "cliente sem
  -- endereço ganhou endereço" — que é o caso do cadastro sendo completado —
  -- passaria batido.
  --
  -- A condição é BOOLEANA PURA, sem nenhum CASE: um CASE nu na condição de um
  -- IF põe um THEN no nível zero de parênteses, a condição termina ali e o
  -- corpo inteiro derrapa. É a segunda armadilha de sintaxe da casa, e o
  -- verificador tem detector para ela.
  IF NEW.endereco  IS DISTINCT     FROM OLD.endereco
 AND NEW.latitude  IS NOT DISTINCT FROM OLD.latitude
 AND NEW.longitude IS NOT DISTINCT FROM OLD.longitude
  THEN
    NEW.latitude  := NULL;
    NEW.longitude := NULL;
  END IF;

  RETURN NEW;
END
$fn$;

COMMENT ON FUNCTION public.clientes_zerar_coordenada() IS
  'U84/R114: trocar o endereço de um cliente sem trazer coordenada nova APAGA a '
  'coordenada antiga. A coordenada é o LUGAR do cliente: o mapa de clientes '
  'desenha por ela, e a estimativa de deslocamento (entrega futura) vai ler por '
  'ela. Coordenada de um endereço ANTIGO é um ponto plausível e errado, em '
  'silêncio. Campo vazio é visível; ponto errado não é. '
  'ESCOPO: "endereço" aqui é UMA coluna — clientes.endereco. '
  'Mexer só em cep, cidade, uf ou complemento NÃO zera nada, ainda que o CEP '
  'seja o que determina a coordenada de boa parte da base (a U24 geocodificou '
  'por CEP). E ele não distingue "a coordenada não veio" de "veio igual à que já '
  'estava": ver o COMMENT ON TRIGGER e a perna 4 do PORTÃO.';

DROP TRIGGER IF EXISTS trg_clientes_zerar_coordenada ON public.clientes;
CREATE TRIGGER trg_clientes_zerar_coordenada
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.clientes_zerar_coordenada();

COMMENT ON TRIGGER trg_clientes_zerar_coordenada ON public.clientes IS
  'U84/R114. Convive com clientes_set_updated_at: os dois são BEFORE UPDATE FOR '
  'EACH ROW e rodam em ordem alfabética de nome do gatilho, mexendo em colunas '
  'diferentes (updated_at × latitude/longitude). Não há ordem entre eles que '
  'mude o resultado. O QUE ELE NÃO DISTINGUE: "a coordenada não veio" de "veio '
  'IGUAL à que já estava". A U24 geocodificou por CEP e um CEP cobre a quadra, '
  'então rebuscar um endereço cujo CEP devolve o mesmo centróide também ZERA — '
  'a perna 4 do PORTÃO mede isso. O CONSERTO É CLICAR EM "Localizar no mapa" DE '
  'NOVO E SALVAR: o endereço já está gravado, a perna 1 é falsa, e a coordenada '
  'sobrevive. Salvar de novo SEM relocalizar não devolve nada — o formulário '
  'reabre com a coordenada nula que está no banco e remanda esse mesmo NULL.';

-- ═══════════════════════════════════════════════════════════════════════════
-- §3) O PORTÃO — comportamento MEDIDO, antes do COMMIT
--
-- Uma asserção que procura texto no corpo da função prova que a LINHA EXISTE,
-- nunca que ela está VIVA: ela não vê uma guarda desligada, não vê um operador
-- trocado, não vê o gatilho criado com o nome errado na tabela errada. Este
-- bloco não procura texto: ele EXERCITA as QUATRO pernas contra o gatilho recém-
-- criado e compara o que saiu com o que tinha de sair. Se qualquer uma
-- responder diferente, ele levanta e a transação inteira volta atrás — o
-- gatilho não fica, e nada foi gravado.
--
-- ── ELE NÃO ENCOSTA EM CLIENTE DE VERDADE ────────────────────────────────
-- Duas linhas DESCARTÁVEIS, criadas aqui, com id fixo, apagadas aqui. Exercitar
-- o gatilho contra um cliente REAL passaria sete escritas por uma linha viva —
-- e, mesmo restaurando os valores à mão no fim, cada uma dessas escritas
-- acordaria `clientes_set_updated_at` e deixaria o `updated_at` daquele cliente
-- carimbado pela migration, para sempre, sem que ninguém o tivesse editado.
-- Com linhas descartáveis não há o que restaurar: o DELETE leva tudo.
--
-- O `DELETE` de abertura é o que torna este bloco IDEMPOTENTE: rodar a
-- migration duas vezes não esbarra na chave primária.
-- ═══════════════════════════════════════════════════════════════════════════
DO $portao$
DECLARE
  -- ids fixos e reconhecíveis: se um deles algum dia aparecer numa listagem de
  -- clientes, é porque este bloco morreu no meio, e o nome diz o que fazer.
  v_a   uuid := '00000000-0000-4084-8a84-000000000001';
  v_b   uuid := '00000000-0000-4084-8a84-000000000002';
  v_lat numeric;
  v_lng numeric;
  v_sobrou int;
BEGIN
  DELETE FROM public.clientes WHERE id IN (v_a, v_b);

  -- ── O INSERT NOMEIA O MÍNIMO, E ISSO É A CORREÇÃO ───────────────────────
  -- A versão anterior deste bloco escrevia `situacao = 'prospecto'`. A U27
  -- (u27:213-218) DERRUBOU esse valor do CHECK assim que nenhum prospecto
  -- sobrou: hoje a constraint viva é `CHECK (situacao IN ('ativo','inativo'))`.
  -- O INSERT violaria `clientes_situacao_check`, a transação INTEIRA abortaria,
  -- e o gatilho NUNCA seria instalado — com uma mensagem do Postgres que não
  -- nomeia a U84, não nomeia o portão e não diz o que fazer. O portão que
  -- existe para provar o comportamento era o que impedia a migration de rodar.
  --
  -- A correção é APAGAR a coluna da lista, não trocar o valor: `situacao` é
  -- `NOT NULL DEFAULT 'ativo'` (etapa1_clientes:39), e 'ativo' é aceito pelas
  -- DUAS versões do CHECK que já existiram (etapa1 e u27) — a linha nasce
  -- válida sem esta migration ter opinião sobre situação de cliente. Nenhuma
  -- outra coluna citada aqui tem CHECK: `nome` é text NOT NULL,
  -- `endereco`/`latitude`/`longitude` são anuláveis e sem constraint, e as
  -- demais colunas com CHECK de public.clientes ficam de fora do INSERT e caem
  -- no default — `tipo_empreendimento` em NULL (um CHECK com NULL não é
  -- violado) e `servicos_prestados` em `'{}'`, que satisfaz o `<@` da u36.
  INSERT INTO public.clientes (id, nome, endereco, latitude, longitude)
  VALUES
    (v_a, 'U84 DESCARTAVEL A — apagar', 'Rua Descartavel A, 1', -23.5000000, -46.6000000),
    (v_b, 'U84 DESCARTAVEL B — apagar', 'Rua Descartavel B, 2', -23.5000000, -46.6000000);

  -- ── PERNA 1: o endereço muda e a coordenada NÃO vem junto -> ZERA ───────
  -- É o caso do defeito: alguém corrige o endereço e não aperta o botão.
  UPDATE public.clientes SET endereco = 'Rua Descartavel A, 999' WHERE id = v_a;
  SELECT latitude, longitude INTO v_lat, v_lng FROM public.clientes WHERE id = v_a;
  IF v_lat IS NOT NULL OR v_lng IS NOT NULL THEN
    RAISE EXCEPTION E'PORTAO U84 (perna 1) — nada foi alterado (ROLLBACK).\nTroquei só o endereço e a coordenada NÃO foi zerada (lat=%, lng=%). O gatilho não está agindo: confira o nome, a tabela e o BEFORE UPDATE.',
      v_lat, v_lng;
  END IF;

  -- ── PERNA 2: o endereço muda E a coordenada nova vem no MESMO UPDATE ────
  -- É o caso de quem fez tudo direito. Se esta perna falhar, o gatilho apaga a
  -- coordenada RECÉM-BUSCADA e o botão "buscar coordenadas" vira decorativo —
  -- um defeito pior do que o que esta migration veio consertar.
  UPDATE public.clientes
     SET endereco = 'Rua Descartavel B, 999', latitude = -23.7000000, longitude = -46.7000000
   WHERE id = v_b;
  SELECT latitude, longitude INTO v_lat, v_lng FROM public.clientes WHERE id = v_b;
  IF v_lat IS DISTINCT FROM -23.7000000 OR v_lng IS DISTINCT FROM -46.7000000 THEN
    RAISE EXCEPTION E'PORTAO U84 (perna 2) — nada foi alterado (ROLLBACK).\nMandei endereço novo COM coordenada nova e a coordenada não sobreviveu (lat=%, lng=%). O gatilho está zerando demais: faltam as pernas IS NOT DISTINCT FROM.',
      v_lat, v_lng;
  END IF;

  -- ── PERNA 3: o endereço NÃO muda -> a coordenada fica ───────────────────
  -- É todo o resto: trocar telefone, síndico, situação, quantidade de acessos.
  -- Se esta perna falhar, o gatilho apaga coordenada de gente que nem endereço
  -- tocou, e a base se esvazia sozinha a cada edição de cadastro.
  UPDATE public.clientes SET nome = 'U84 DESCARTAVEL B2 — apagar' WHERE id = v_b;
  SELECT latitude, longitude INTO v_lat, v_lng FROM public.clientes WHERE id = v_b;
  IF v_lat IS DISTINCT FROM -23.7000000 OR v_lng IS DISTINCT FROM -46.7000000 THEN
    RAISE EXCEPTION E'PORTAO U84 (perna 3) — nada foi alterado (ROLLBACK).\nTroquei só o NOME e a coordenada se mexeu (lat=%, lng=%). O gatilho está agindo fora da hora.',
      v_lat, v_lng;
  END IF;

  -- ── PERNA 4: endereço novo E coordenada nova IGUAL à velha -> ZERA ──────
  -- E É PRECISO MEDIR QUE ELE ZERA, porque o §2 acima presume que "apertou o
  -- botão" implica "coordenada diferente" — e NESTA BASE isso é falso com
  -- frequência: a U24 geocodificou POR CEP, um CEP cobre a quadra, e 46
  -- clientes dividem 20 coordenadas. Corrigir o complemento de um endereço e
  -- rebuscar devolve o MESMO centróide; o banco não distingue "a coordenada nao
  -- veio" de "veio igual", e a coordenada recém-conferida e' apagada. O gestor
  -- fez tudo certo e a coordenada some.
  --
  -- NÃO SE TROCA O MECANISMO POR ISSO: a assimetria continua valendo (campo
  -- vazio e' visivel, numero errado nao e'), e o conserto e' clicar em
  -- "Localizar no mapa" DE NOVO e salvar — na segunda vez o endereço ja' esta'
  -- gravado, a perna 1 e' falsa e a coordenada sobrevive. Salvar de novo sem
  -- relocalizar NAO devolve nada: o formulario reabre lendo a coordenada nula
  -- do banco e remanda esse mesmo NULL. O que muda e' que este comportamento
  -- passa a ser um FATO MEDIDO aqui, e nao uma surpresa na ficha do cliente. A
  -- perna 2 nao pode pega-lo: ela planta -23.7 sobre -23.5, coordenadas
  -- diferentes de propósito.
  UPDATE public.clientes SET latitude = -23.7000000, longitude = -46.7000000 WHERE id = v_b;
  UPDATE public.clientes
     SET endereco = 'Rua Descartavel B, 999 bloco B',
         latitude = -23.7000000, longitude = -46.7000000
   WHERE id = v_b;
  SELECT latitude, longitude INTO v_lat, v_lng FROM public.clientes WHERE id = v_b;
  IF v_lat IS NOT NULL OR v_lng IS NOT NULL THEN
    RAISE EXCEPTION E'PORTAO U84 (perna 4) — nada foi alterado (ROLLBACK).\nEndereço novo com a MESMA coordenada NÃO zerou (lat=%, lng=%). O gatilho mudou de comportamento e o comentário do §2 e o COMMENT ON TRIGGER estão desatualizados.',
      v_lat, v_lng;
  END IF;

  -- ── E O PORTÃO NÃO DEIXA RASTRO ─────────────────────────────────────────
  DELETE FROM public.clientes WHERE id IN (v_a, v_b);
  SELECT count(*) INTO v_sobrou FROM public.clientes WHERE id IN (v_a, v_b);
  IF v_sobrou <> 0 THEN
    RAISE EXCEPTION E'PORTAO U84 (limpeza) — nada foi alterado (ROLLBACK).\nSobraram % linhas descartáveis em public.clientes.', v_sobrou;
  END IF;
END
$portao$;

-- ═══════════════════════════════════════════════════════════════════════════
-- §4) CONFERÊNCIAS — em SELECT, com obtido × esperado × veredito
--
-- RAISE NOTICE é INVISÍVEL no editor do Supabase: uma migration que "confere"
-- por NOTICE não confere nada, porque ninguém lê. Estas voltam como TABELA.
-- Elas são LEITURA PURA — nenhuma escreve — e por isso rodam depois do COMMIT
-- sem risco. Tudo o que ESCREVE nesta migration (o portão) está dentro dele.
-- ═══════════════════════════════════════════════════════════════════════════
COMMIT;

-- O QUE O DAVI OLHA: a TABELA. Ele procura '>>> OLHAR <<<' na coluna
-- `veredito`. Nada mais. É o protocolo escrito na U83 e usado byte a byte pelas
-- SEIS migrations anteriores (u78, u79, u80, s4, u81, u82, u83).
--
-- ── POR QUE TRÊS RAMOS, E NÃO DOIS ────────────────────────────────────────
-- As conferências 3, 4 e 5 têm `esperado = '(anote)'` DE PROPÓSITO: são
-- RETRATOS, não asserções. Com um CASE de dois ramos ('OK' / 'FALHOU'),
-- '192 de 210' <> '(anote)' e as três caem no ELSE — metade da tabela imprime
-- FALHOU numa execução PERFEITA. Um veredito que reprova o certo é o defeito da
-- U83 (linha CRÍTICA gritando numa rodada correta): ele ensina a IGNORAR a
-- coluna inteira, e no dia em que uma linha de verdade falhar ninguém vai
-- reparar. Pior: 'FALHOU' não é a palavra que o olho dele varre.
--
-- `IS NOT DISTINCT FROM` no lugar de `=` conserta junto o caso da conferência 2
-- devolver NULL do `string_agg` (nenhum gatilho BEFORE UPDATE): com `=` isso
-- vira NULL, cai no ELSE, e o veredito seria certo pelo motivo errado.
SELECT t.ordem, t.conferencia, t.obtido, t.esperado,
       CASE WHEN t.esperado = '(anote)'                   THEN '— referência'
            WHEN t.obtido IS NOT DISTINCT FROM t.esperado THEN 'ok'
            ELSE '>>> OLHAR <<<' END AS veredito
FROM (

-- 1) O GATILHO EXISTE **E ESTÁ LIGADO**. `tgenabled` é a metade que quase todo
--    mundo esquece: um ALTER TABLE ... DISABLE TRIGGER deixa a linha no
--    catálogo e o gatilho parado. Provar que ele EXISTE não prova que ele AGE —
--    e o portão do §3 já provou que ele age, então esta linha é a que garante
--    que ninguém o desligou entre o COMMIT e agora. 'O' = origin (ligado).
SELECT 1 AS ordem,
 'o gatilho existe e está LIGADO (tgenabled = O)' AS conferencia,
 COALESCE((SELECT t.tgenabled::text FROM pg_trigger t
            WHERE t.tgrelid = 'public.clientes'::regclass
              AND t.tgname = 'trg_clientes_zerar_coordenada'
              AND NOT t.tgisinternal), '(nao existe)') AS obtido,
 'O' AS esperado

UNION ALL
-- 2) OS DOIS BEFORE UPDATE CONVIVEM. `clientes_set_updated_at` é anterior a
--    esta migration e continua tendo de existir: se o CREATE TRIGGER daqui o
--    tivesse derrubado, todo cliente editado passaria a ficar com `updated_at`
--    congelado, em silêncio.
--
--    A MÁSCARA PEDE OS DOIS BITS. `tgtype & 2` é só o BEFORE, de QUALQUER
--    evento: no dia em que alguém criar um BEFORE INSERT em clientes
--    (normalizar CEP, por exemplo), esta linha CRÍTICA ficaria vermelha por um
--    motivo que não tem nada a ver com a U84 — a cicatriz da conferência 119 da
--    U82 voltando por outra porta. `& 16` é o bit de UPDATE.
SELECT 2,
 'os DOIS gatilhos BEFORE UPDATE de public.clientes convivem (o novo nao derrubou o antigo)',
 (SELECT string_agg(t.tgname, ', ' ORDER BY t.tgname) FROM pg_trigger t
   WHERE t.tgrelid = 'public.clientes'::regclass AND NOT t.tgisinternal
     AND (t.tgtype & 2) <> 0 AND (t.tgtype & 16) <> 0),
 'clientes_set_updated_at, trg_clientes_zerar_coordenada'

UNION ALL
-- 3) CENSO DE COBERTURA — a linha de base do re-geocode por porta.
--    ANOTE ESTE NÚMERO. Ele é o denominador de tudo o que vem depois: enquanto
--    um cliente não tiver coordenada, ele não aparece no mapa de clientes e
--    nenhuma conta sobre o lugar dele é possível. O esperado é '(anote)' de
--    propósito — é um
--    RETRATO, não uma asserção, e fingir que 192 é o valor "certo" faria a
--    linha ficar vermelha no dia em que a operação ganhasse um cliente novo.
SELECT 3,
 'REFERENCIA — clientes COM coordenada / total (anote: e a linha de base do re-geocode)',
 (SELECT count(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL)::text
         || ' de ' || count(*)::text FROM public.clientes),
 '(anote)'

UNION ALL
-- 4) CENSO DE PONTO COMPARTILHADO. A geocodificação da U24 foi por CEP, e um
--    CEP cobre a quadra: clientes DIFERENTES caem na MESMA coordenada. Para
--    esses pares a coordenada NÃO distingue os dois endereços: qualquer conta
--    de distância entre eles daria zero, e zero é uma afirmação ("coladinhos")
--    sobre algo que o mapa não sabe. Este número é a medida de quanto da base
--    está nessa situação, e é o que o re-geocode por PORTA (e não por CEP)
--    faria cair.
SELECT 4,
 'REFERENCIA — clientes que DIVIDEM coordenada com outro cliente (o CEP cobre a quadra inteira)',
 (SELECT COALESCE(sum(n)::text, '0') FROM (
    SELECT count(*) AS n FROM public.clientes
     WHERE latitude IS NOT NULL AND longitude IS NOT NULL
     GROUP BY latitude, longitude HAVING count(*) > 1) s),
 '(anote)'

UNION ALL
-- 5) CENSO FORA DA GRANDE SÃO PAULO — e a caixa é ESTREITA DE PROPÓSITO.
--    O verificador do repositório usa uma caixa larga (lat -24..-13, lng
--    -48..-38) que serve para outra pergunta ("latitude nunca virou
--    longitude") e que ACEITA Belo Horizonte E ACEITA o Rio de Janeiro.
--    Reaproveitá-la aqui seria escrever uma conferência que não pode reprovar
--    justamente as duas cidades por causa das quais ela existe.
--    Esta caixa é a Grande São Paulo: lat -24,1..-23,2 × lng -47,2..-46,2.
--    O esperado NÃO é zero: a base tem Bertioga e Porto Seguro, que estão
--    legitimamente fora. É um retrato para o Davi conferir se o número
--    corresponde às exceções que ele conhece — se ele SUBIR, alguém colou uma
--    coordenada errada em algum cadastro.
SELECT 5,
 'REFERENCIA — clientes com coordenada FORA da Grande Sao Paulo (a base tem excecoes legitimas: Bertioga, Porto Seguro)',
 (SELECT count(*)::text FROM public.clientes
   WHERE latitude IS NOT NULL AND longitude IS NOT NULL
     AND NOT (latitude BETWEEN -24.1 AND -23.2 AND longitude BETWEEN -47.2 AND -46.2)),
 '(anote)'

UNION ALL
-- 6) NENHUMA LINHA DESCARTÁVEL SOBREVIVEU. O portão já provou isso antes do
--    COMMIT; esta linha prova depois, que é quando importa para quem lê.
SELECT 6,
 'CRITICO — nenhuma linha descartavel do PORTAO sobreviveu em public.clientes',
 (SELECT count(*)::text FROM public.clientes
   WHERE id IN ('00000000-0000-4084-8a84-000000000001',
                '00000000-0000-4084-8a84-000000000002')),
 '0'

UNION ALL
-- 7) QUAL É O CHECK VIVO DE `clientes.situacao` — e esta linha nasceu de um
--    defeito REAL desta migration. O PORTÃO do §3 escrevia `'prospecto'`, valor
--    que a U27 (u27:213-218) apagou do CHECK: o INSERT violava a constraint, a
--    transação inteira abortava e o gatilho NUNCA era instalado. Corrigido
--    APAGANDO a coluna do INSERT (o DEFAULT 'ativo' vale nas duas versões).
--
--    A LINHA FICA, mas o que ela pergunta MUDOU DE DONO. O app tinha DOIS
--    escritores de `'prospecto'`, e os dois foram APAGADOS nesta rodada:
--    `criarCliente` do /gerencial/nova (todo prédio novo batia em 23514 e
--    derrubava a criação da visita inteira, que é a mesma mutação) e
--    `consolidarGrupo`, que levava `situacaoSugerida` ao patch de UPDATE FORA
--    do `preservar` — /clientes/migrar morria, ou rebaixava um cliente oficial
--    e ativo. Nenhum dos dois existe mais; o `tsc` acusava os dois e caiu de 83
--    para 59 quando eles saíram.
--    A LINHA FICA porque saber QUAL constraint está de pé vale por si: é ela
--    que diz se a U27 chegou a rodar nesta base, e é o retrato contra o qual se
--    lê qualquer 23514 futuro em clientes.
SELECT 7,
 'REFERENCIA — o CHECK vivo de clientes.situacao (retrato: diz qual versao do CHECK esta de pe nesta base)',
 COALESCE((SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
            WHERE c.conrelid = 'public.clientes'::regclass
              AND c.conname = 'clientes_situacao_check'), '(nao existe)'),
 '(anote)'

) t ORDER BY t.ordem;

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ DESFAZER — freio de emergência, não rollback de rotina               ║
-- ╚══════════════════════════════════════════════════════════════════════╝
-- ESTE RODAPÉ É CURTO PORQUE A MIGRATION NÃO ESCREVE DADO. Não há carimbo a
-- apagar, não há coluna a dropar, não há linha a ressuscitar: desfazer é tirar
-- o gatilho.
--
-- O QUE VOLTA JUNTO: trocar o endereço de um cliente volta a deixar a
-- coordenada VELHA no lugar, e o mapa de clientes volta a desenhar o prédio
-- onde ele não fica mais. É o defeito original.
--
-- O FRONT PUBLICADO NÃO QUEBRA COM ESTE DESFAZER, e isso é propriedade do
-- código, não sorte: nada em src/ chama esta função, nomeia este gatilho ou
-- depende de a coordenada estar nula. Quem lê latitude/longitude no front é o
-- mapa de clientes (`features/clientes/MapaClientes.tsx`), e ele já conta e
-- rotula os SEM coordenada como um estado normal; com o gatilho fora ele
-- simplesmente recebe menos nulos. O caminho de código é o mesmo nos dois
-- mundos.
--
-- O QUE ESTE RODAPÉ NÃO ALCANÇA: as coordenadas que o gatilho JÁ zerou
-- enquanto esteve no ar. Elas eram a coordenada de um endereço que o cliente
-- não tem mais — restaurá-las seria devolver o dado errado. Quem as recupera é
-- o botão "buscar coordenadas" da ficha do cliente, um clique por cliente, e a
-- conferência 3 acima diz quantos são.
--
-- BEGIN;
--   DROP TRIGGER IF EXISTS trg_clientes_zerar_coordenada ON public.clientes;
--   DROP FUNCTION IF EXISTS public.clientes_zerar_coordenada();
-- COMMIT;
