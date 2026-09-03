-- ═══════════════════════════════════════════════════════════════════════════
-- U87 — O ATENDIMENTO DE PLANTÃO (R117 — Fase 3, Passo 3 e último)
--
-- Davi: registrar o atendimento de plantão — hora, cliente, plantonista, tipo
-- (remoto/presencial), descrição e vínculo opcional com chamado.
--
-- >>> RODAR NO SQL EDITOR DO SUPABASE, À MÃO. Idempotente: rodar de novo é
-- >>> no-op (nenhum backfill, nenhuma semente de dado operacional).
--
-- ── A ORDEM DE DEPLOY INVERTE AQUI, E ISSO É PROPRIEDADE DO CÓDIGO ─────────
-- >>> ESTA MIGRATION PRIMEIRO. O PUSH DEPOIS. <<<
-- O código NOMEIA objeto que não existe: o painel de plantão do "+" da Início
-- faz rpc("plantao_salvar"), rpc("plantao_apagar") e
-- from("atendimentos_plantao"). Subir o push antes abriria o painel com
-- PGRST205 ("Could not find the table 'public.atendimentos_plantao' in the
-- schema cache") para todo mundo.
--
-- E NÃO é a dança de dois commits da U83: nenhum valor novo entra em CHECK de
-- tabela que já existe. Isso não é sorte — é CONSEQUÊNCIA de a marca ser
-- SATÉLITE. Ver "AS TRÊS MARCAS RECUSADAS", abaixo. As duas metades desta
-- entrega (o registro e o gancho do texto do dia) vão num commit só, com uma
-- ordem só.
--
-- ── O FATO QUE NÃO TINHA CASA ─────────────────────────────────────────────
-- "às 02:30 de 30/08 o Igor atendeu a Padaria X, remoto, e isto foi o que ele
-- fez". Nada no repositório guardava isso:
--   · a ESCALA (public.sobreaviso, U86) guarda o PLANO — quem DEVERIA estar —,
--     e na segunda de virada nem isso: plantaoDoDia devolve DOIS nomes e nada
--     no dado diz quem cobre qual metade (a convenção de semanaPadrao não é
--     gravada; `origem` sequer chega a plantaoDoDia);
--   · o CHAMADO, quando existe, guarda O QUÊ — nunca a que horas se atendeu,
--     nunca que aquilo foi plantão.
--
-- ── AS TRÊS MARCAS RECUSADAS, E O TESTE DE FORMA (R117) ───────────────────
-- A pergunta "onde este trabalho mora?" tem três respostas possíveis neste
-- repositório, e a regra que as separa é:
--
--   · VALOR NUM CHECK, quando a coisa responde a MESMA pergunta que a coluna
--     já faz, com uma resposta nova. Precedente: `vistoria` como tipo de
--     chamado de campo (R112/U83) — "que tipo de trabalho de campo é este?"
--     ganhou mais uma resposta.
--   · FUNÇÃO PURA, quando a coisa já está GRAVADA noutras colunas e só
--     precisava de nome. Precedente: `emergencial` (R99) — derivado, nunca
--     coluna.
--   · SATÉLITE, quando a coisa traz PERGUNTAS QUE A TABELA NÃO FAZ.
--
-- O atendimento de plantão é o terceiro caso, e por isso NÃO É:
--
--  1. `chamados.natureza = 'plantao'` — RECUSADO. `natureza` responde "de que
--     espécie é este trabalho" e o CHECK vivo é ('campo','interno','comercial')
--     (20260821160000_u29_proposta_e_chamado.sql:32-33). Um quarto valor
--     mudaria o kanban, a numeração CH-, o Painel Operacional (R95), a fila de
--     conferência e o SLA — e o ramo ELSE de `chamados_select` (u29:185-194)
--     deixaria a linha MAIS permissiva, não menos, que é pior do que quebrar.
--  2. `chamados.tipo = 'plantao'` — RECUSADO pela mesma régua: `tipo` é
--     subdivisão DENTRO de uma natureza, e plantão atravessa as duas.
--  3. UM CHAMADO POR TELEFONEMA ATENDIDO — RECUSADO, e é a recusa mais cara de
--     explicar porque o desenho é sedutor. Cinco custos, medidos:
--       a) 480 linhas/ano na tabela mais quente do sistema (537 chamados
--          importados hoje), cada uma passando por `chamado_preencher`,
--          `notify_chamado`, numeração CH- e SLA;
--       b) o plantão herdaria kanban, Painel Operacional e fila de conferência
--          sem ninguém ter pedido;
--       c) a tela do técnico exige ASSINATURA para concluir
--          (`DetalheCampo.tsx:345`) — o objeto não serve para o caso;
--       d) o cliente que o plantonista não enxerga (pode_ver_cliente,
--          u71:333-370) iria para dentro do TÍTULO, que é campo de outra coisa;
--       e) às 2h da manhã, no celular, seriam três textos obrigatórios em vez
--          de um.
--     O argumento a FAVOR que se costuma dar — "um chamado nascido concluído
--     não dispararia a notificação que avisa o financeiro" — é FALSO, e foi
--     medido: o ramo que manda "aguarda sua conferência" é
--     `NEW.status = 'executado'` (u7:415-422), e 'executado' está PROIBIDO pelo
--     CHECK desde a U13 (20260820100000_u13_executado_vira_concluido.sql:60-63).
--     É código morto. A fila do financeiro é DERIVADA em consulta, por `aConferir`
--     (`src/features/atividades/modelo.ts:485-486`), e funciona igual.
--
-- ── PLANTONISTA É GRAVADO, NÃO DERIVADO ───────────────────────────────────
-- Mesma doutrina de "apoio é GRAVADO, dupla é DERIVADA" (U47 × U64, U81). A
-- escala responde QUEM DEVERIA; esta linha responde QUEM ESTEVE. O fundamento
-- é de DADO e não só de doutrina: na segunda de virada a escala tem dois nomes
-- e não sabe quem cobre qual metade; no dia `curto` ela tem um nome só,
-- confiante, para a metade que ele não cobre.
-- CUSTO DECLARADO: escala e registro podem divergir e NENHUMA tela avisa. O
-- aviso é o que a porta devolve NA HORA de gravar (horas_escaladas /
-- horas_do_dia). Sem tela de divergência, sem selo de divergência, sem tabela
-- de reconciliação — regra 8: prefira apagar a acrescentar.
--
-- ── NENHUM REAL MORA AQUI, E NENHUM PASSA POR AQUI ────────────────────────
-- ZERO coluna de dinheiro (a conferência 202 mede isso pelo CATÁLOGO, não pela
-- promessa). Esta migration NÃO cria cobrança, NÃO toca em `cobrancas`, NÃO
-- reescreve `chamados_com_lancamento` (U80 §3) e NÃO acrescenta selo nenhum.
-- O selo do plantão é MUDO, por construção: não existe.
-- E a razão de não haver cobrança AGORA vai escrita, porque ela é decisão:
--   · pelo caminho do CHAMADO, uma cobrança avulsa vinculada arma o P19 — o
--     DELETE incondicional de `aprovar_chamado_financeiro` (u13:95) come o
--     avulso vinculado;
--   · pelo caminho de uma COLUNA NOVA em `cobrancas`, nenhum dos dois índices
--     únicos da U80 (u80:152-154 e u80:171-176) cobriria a forma nova;
--   · e os dois se apoiam num `montar_fechamento` que HOJE levanta 42702 (P50).
-- CUSTO LOAD-BEARING do cliente em texto: enquanto for `cliente_informado`, o
-- atendimento NÃO é cobrável — `cobrancas.cliente_id` é NOT NULL
-- (20260818200000_u4_cobrancas.sql:29).
--
-- ── A HORA QUE ATRAVESSA A MEIA-NOITE ─────────────────────────────────────
-- `hora timestamptz` é O FATO; `dia date` é a PROJEÇÃO, escrita por um gatilho
-- BEFORE INSERT OR UPDATE INCONDICIONAL, em America/Sao_Paulo. Não pode ser
-- GENERATED nem índice funcional: `AT TIME ZONE` é STABLE, e o Postgres recusa
-- os dois. E não existe uma coluna `dia_do_sobreaviso` com a frase humana —
-- gravá-la criaria as duas datas que divergiriam no primeiro dia `curto`.
-- 02:30 de domingo é o plantão de DOMINGO: a madrugada pertence ao próprio dia
-- de calendário, que é o que `coberturaDoDia` (sobreaviso/modelo.ts:68) já diz
-- ao descontar o expediente DAQUELE dia, e o que `semanaPadrao` diz por
-- extenso em `modelo.ts:114`.
--
-- ── ORDEM DAS SEÇÕES ──────────────────────────────────────────────────────
--   §0 pré-voo que ABORTA
--   §1 a tabela, os índices e os comentários de catálogo
--   §2 o gatilho da projeção e do carimbo
--   §3 RLS e privilégio — a tabela é SÓ-LEITURA no navegador
--   §4 a porta de escrita
--   §5 a porta de apagar
--   §6 o PORTÃO — oito provas de COMPORTAMENTO dentro da transação
--   §7 conferência em SELECT, com obtido × esperado × veredito
-- Tudo em UMA transação: DDL no Postgres é transacional, então qualquer RAISE
-- (inclusive o do portão) devolve tabela, gatilho, funções e políticas ao
-- estado exato de antes.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- §0) PRÉ-VOO — ele ABORTA, não avisa
-- ═══════════════════════════════════════════════════════════════════════
-- RAISE NOTICE é INVISÍVEL no editor do Supabase. Um pré-voo que só avisa é um
-- pré-voo que ninguém lê. Este levanta.
--
-- Ele checa TUDO o que o §6 vai precisar de cobaia, e não só o que o §1 nomeia:
-- descobrir no portão que não há cliente, ou que não há chamado, seria descobrir
-- DEPOIS de já ter criado tabela, gatilho, políticas e duas funções — e o Davi
-- veria um erro que não tem nada a ver com o que ele rodou.
DO $preflight$
DECLARE
  v_pessoas int;
  v_clientes int;
  v_chamados int;
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'U87 PRÉ-VOO: public.profiles não existe. O plantonista sai de profiles e de mais nenhum lugar (não existe, e não vai existir, uma segunda lista de gente).';
  END IF;
  IF to_regclass('public.clientes') IS NULL THEN
    RAISE EXCEPTION 'U87 PRÉ-VOO: public.clientes não existe — é a forma 1 do cliente do atendimento.';
  END IF;
  IF to_regclass('public.chamados') IS NULL THEN
    RAISE EXCEPTION 'U87 PRÉ-VOO: public.chamados não existe — é o vínculo OPCIONAL do atendimento, e o portão liga um chamado de verdade.';
  END IF;
  IF to_regclass('public.sobreaviso') IS NULL THEN
    RAISE EXCEPTION 'U87 PRÉ-VOO: public.sobreaviso não existe. Rode a U86 antes: é dela que sai a resposta "esta pessoa estava na escala deste dia?", que a porta devolve no ato da gravação.';
  END IF;
  IF to_regprocedure('public.is_gestor(uuid)') IS NULL THEN
    RAISE EXCEPTION 'U87 PRÉ-VOO: public.is_gestor(uuid) não existe — é a metade da PROCURAÇÃO do gate (lançar em nome de outro).';
  END IF;
  IF to_regprocedure('public.pode_acessar_chamado(uuid)') IS NULL THEN
    RAISE EXCEPTION 'U87 PRÉ-VOO: public.pode_acessar_chamado(uuid) não existe — é a régua do vínculo com chamado no WITH CHECK da porta.';
  END IF;

  -- As colunas de profiles que o gate lê, nomeadas UMA A UMA: um SELECT * que
  -- funciona hoje não prova que `status` existe.
  IF NOT EXISTS (SELECT 1 FROM pg_attribute a
                  WHERE a.attrelid = 'public.profiles'::regclass
                    AND a.attname = 'ativo' AND a.attnum > 0 AND NOT a.attisdropped) THEN
    RAISE EXCEPTION 'U87 PRÉ-VOO: profiles.ativo não existe — é um dos dois eixos do VÍNCULO, e ele fica ao lado de is_gestor() porque is_gestor NÃO olha ativo (P51).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute a
                  WHERE a.attrelid = 'public.profiles'::regclass
                    AND a.attname = 'status' AND a.attnum > 0 AND NOT a.attisdropped) THEN
    RAISE EXCEPTION 'U87 PRÉ-VOO: profiles.status não existe — é o outro eixo do VÍNCULO (pendente_aprovacao é convite não aceito).';
  END IF;

  -- DUAS pessoas, e não uma: o portão precisa provar os TRÊS estados do aviso
  -- da escala, e o terceiro ("o dia tem escala, e não é sua") exige uma SEGUNDA
  -- pessoa escalada. Com uma só, esse ramo nunca seria exercitado — e ramo não
  -- exercitado dentro de um portão é conforto falso.
  SELECT count(*) INTO v_pessoas FROM public.profiles p;
  IF v_pessoas < 2 THEN
    RAISE EXCEPTION 'U87 PRÉ-VOO: há % profile(s), e o portão precisa de DUAS pessoas para exercitar o terceiro estado do aviso da escala (o dia tem escala, e ela é de outro).', v_pessoas;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p
                  WHERE p.ativo AND p.status <> 'pendente_aprovacao') THEN
    RAISE EXCEPTION 'U87 PRÉ-VOO: não há NENHUM profile ativo e aprovado — o portão precisa de um plantonista real (a FK é RESTRICT, não há como inventar id).';
  END IF;

  SELECT count(*) INTO v_clientes FROM public.clientes c;
  IF v_clientes = 0 THEN
    RAISE EXCEPTION 'U87 PRÉ-VOO: a base não tem NENHUM cliente. O portão prova a forma 1 do XOR (cliente_id) com um cliente real.';
  END IF;

  SELECT count(*) INTO v_chamados FROM public.chamados c;
  IF v_chamados = 0 THEN
    RAISE EXCEPTION 'U87 PRÉ-VOO: a base não tem NENHUM chamado. O portão prova o vínculo OPCIONAL ligando um chamado real — sem um, a prova 7 diria que ligou e não teria ligado nada.';
  END IF;
END
$preflight$;

-- ═══════════════════════════════════════════════════════════════════════
-- §1) A TABELA — UMA FOLHA
-- ═══════════════════════════════════════════════════════════════════════
-- FOLHA no sentido literal: nada no banco a LÊ. `cobrancas` não ganha coluna,
-- `chamados` não ganha coluna, nenhum gatilho vivo passa a olhar para cá, e
-- cada coluna daqui tem EXATAMENTE UM escritor. É o que torna esta entrega
-- reversível por um DROP TABLE.
--
-- `id` sintético (e não a chave natural (plantonista, hora)): o mesmo
-- atendimento pode ser CORRIGIDO — inclusive na hora —, e uma PK que muda é uma
-- linha nova com cara de correção. A unicidade que interessa é a do duplo
-- toque, e ela é um ÍNDICE, abaixo.
CREATE TABLE IF NOT EXISTS public.atendimentos_plantao (
  id             uuid NOT NULL DEFAULT gen_random_uuid(),

  -- O FATO. Instante absoluto; a projeção é `dia`, e quem a escreve é o
  -- gatilho do §2, incondicionalmente.
  hora           timestamptz NOT NULL,
  -- A PROJEÇÃO, em America/Sao_Paulo. NOT NULL e sem DEFAULT de propósito: ela
  -- é preenchida pelo gatilho BEFORE, que roda ANTES de o NOT NULL ser
  -- checado. Quem escrever direto (service_role, migration) recebe a mesma
  -- projeção; não há caminho que a contorne.
  dia            date NOT NULL,

  -- GRAVADO, e RESTRICT pela mesma doutrina de sobreaviso.pessoa_id: quem sai
  -- da empresa NÃO some do histórico de quem atendeu às 2h da manhã.
  plantonista_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,

  -- remoto × presencial NÃO MUDA NADA além do rótulo e do filtro. Ver o
  -- COMMENT ON COLUMN abaixo, que é onde isso fica gravado no banco.
  tipo           text NOT NULL,

  descricao      text NOT NULL,

  -- O CLIENTE, EM DUAS FORMAS EXCLUDENTES — o idioma vivo de
  -- `chamado_locais_uma_forma` (20260826120000_u71_equipes_e_locais.sql:156-157).
  -- A forma 2 existe porque `pode_ver_cliente` (u71:333-370) pode simplesmente
  -- não deixar aquele plantonista LER aquele cliente às 2h da manhã, e um campo
  -- que ele não consegue preencher vira um atendimento não registrado.
  cliente_id        uuid REFERENCES public.clientes(id) ON DELETE RESTRICT,
  cliente_informado text,

  -- O VÍNCULO É OPCIONAL, E O ATENDIMENTO NUNCA CRIA CHAMADO. Ligar o chamado
  -- amanhã É correção, e passa pela MESMA porta com `_id` preenchido.
  -- RESTRICT: apagar um chamado não pode levar junto o registro de que alguém
  -- trabalhou de madrugada.
  chamado_id     uuid REFERENCES public.chamados(id) ON DELETE RESTRICT,

  -- Quem LANÇOU (pode não ser o plantonista: um gestor lança em nome de quem
  -- não conseguiu). NULO quando a escrita não veio do app — um COALESCE para
  -- outra pessoa aqui seria carimbo FALSO, que é pior que carimbo ausente.
  registrado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  registrado_em  timestamptz NOT NULL DEFAULT now(),
  -- Quem TOCOU por último, e quando. É o idioma de sobreaviso.alterada_em: a
  -- correção posterior fica ENCONTRÁVEL sem uma coluna `travado`, que é o
  -- booleano-promessa que a U78 recusou.
  alterado_por   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  alterado_em    timestamptz NOT NULL DEFAULT now(),

  -- PK nomeada à mão: a cicatriz de `demanda_apoios_pkey` existe porque o
  -- Postgres batizou sozinho e o rename da U7 não renomeia constraint.
  CONSTRAINT atendimentos_plantao_pkey PRIMARY KEY (id),
  CONSTRAINT atendimentos_plantao_tipo_check
    CHECK (tipo IN ('remoto','presencial')),
  CONSTRAINT atendimentos_plantao_cliente_uma_forma
    CHECK (num_nonnulls(cliente_id, cliente_informado) = 1),
  CONSTRAINT atendimentos_plantao_descricao_check
    CHECK (btrim(descricao) <> ''),
  CONSTRAINT atendimentos_plantao_cliente_informado_check
    CHECK (cliente_informado IS NULL OR btrim(cliente_informado) <> '')
);

-- O EIXO DIA: "o que aconteceu no plantão de sábado". É a leitura normal.
CREATE INDEX IF NOT EXISTS atendimentos_plantao_dia_idx
  ON public.atendimentos_plantao (dia, hora);

-- O EIXO PESSOA: "o que o Igor atendeu neste mês" — a leitura de folha, que o
-- índice acima não atende (nele `plantonista_id` nem aparece).
CREATE INDEX IF NOT EXISTS atendimentos_plantao_pessoa_idx
  ON public.atendimentos_plantao (plantonista_id, hora DESC);

-- A PERGUNTA REVERSA — "este chamado tem atendimento de plantão?" — SEM uma
-- coluna nova em `chamados`. É o que mantém a tabela folha: `chamados` não
-- sabe que esta tabela existe. Parcial porque o vínculo é opcional e a maioria
-- das linhas o terá nulo.
CREATE INDEX IF NOT EXISTS atendimentos_plantao_chamado_idx
  ON public.atendimentos_plantao (chamado_id)
  WHERE chamado_id IS NOT NULL;

-- ── O DUPLO TOQUE, E POR QUE ELE SÓ FUNCIONA COM A HORA TRUNCADA ──────────
-- Às 2h da manhã, no celular, um toque que parece não ter respondido vira dois.
-- Sem a truncagem ao minuto do §2, os dois toques mandariam instantes
-- diferentes por 40 ms e este índice não pegaria NADA — teria a forma de uma
-- proteção e a eficácia de zero. A truncagem é a CONDIÇÃO de ele existir, e o
-- PORTÃO prova as duas coisas juntas (prova 3).
--
-- `md5(lower(btrim(descricao)))` e não `descricao`: as três funções são
-- IMMUTABLE, o índice cabe, e "Alarme disparado" e "  alarme disparado " são o
-- mesmo toque repetido.
CREATE UNIQUE INDEX IF NOT EXISTS atendimentos_plantao_sem_duplo_toque
  ON public.atendimentos_plantao (plantonista_id, hora, md5(lower(btrim(descricao))));

COMMENT ON TABLE public.atendimentos_plantao IS
  'O ATENDIMENTO de plantão: hora, quem atendeu, cliente, remoto/presencial, o '
  'que foi feito, e um vínculo OPCIONAL com chamado. É uma FOLHA — nada no '
  'banco a lê, cobrancas e chamados não ganharam coluna, e cada coluna tem '
  'exatamente um escritor. NÃO é chamado (não tem kanban, numeração CH-, SLA '
  'nem fila de conferência) e NÃO cria chamado. ZERO coluna de dinheiro: nesta '
  'entrega o plantão não é cobrável (R117/U87).';
COMMENT ON COLUMN public.atendimentos_plantao.hora IS
  'O FATO: instante absoluto, já truncado ao MINUTO do relógio de parede de '
  'America/Sao_Paulo pelo gatilho. A truncagem não é cosmética — é o que faz o '
  'índice único do duplo toque funcionar (dois toques a 40 ms mandam instantes '
  'diferentes).';
COMMENT ON COLUMN public.atendimentos_plantao.dia IS
  'A PROJEÇÃO de `hora` em America/Sao_Paulo, escrita por gatilho BEFORE '
  'INCONDICIONAL. 02:30 de domingo é o plantão de DOMINGO: a madrugada '
  'pertence ao próprio dia de calendário (sobreaviso/modelo.ts:68 e :114). NÃO '
  'existe uma segunda data com a frase humana do plantão — ela divergiria '
  'desta no primeiro dia de cobertura curta. Não pode ser GENERATED nem índice '
  'funcional: AT TIME ZONE é STABLE.';
COMMENT ON COLUMN public.atendimentos_plantao.plantonista_id IS
  'QUEM ESTEVE, e é GRAVADO — não derivado de public.sobreaviso. A escala diz '
  'quem DEVERIA; os dois divergem (troca de última hora, o colega que pegou '
  'porque o outro não acordou). Custo declarado: escala e registro podem '
  'divergir e nenhuma TELA avisa — o aviso é o que plantao_salvar devolve no '
  'ato (horas_escaladas / horas_do_dia).';
COMMENT ON COLUMN public.atendimentos_plantao.tipo IS
  'remoto ou presencial. NÃO MUDA NADA ALÉM DO RÓTULO E DO FILTRO: não muda '
  'deslocamento (que mora em agenda_campo.deslocamento_min e é digitado à '
  'mão), não muda cobrança (não há), não muda gate, policy nem selo. Está '
  'escrito aqui porque a próxima pessoa vai supor que muda.';
COMMENT ON COLUMN public.atendimentos_plantao.cliente_informado IS
  'A forma 2 do cliente, EXCLUDENTE de cliente_id (num_nonnulls = 1). Existe '
  'porque pode_ver_cliente() pode não deixar o plantonista ler aquele cliente '
  'às 2h da manhã. CUSTO LOAD-BEARING: enquanto for texto, o atendimento não é '
  'cobrável — cobrancas.cliente_id é NOT NULL (u4:29).';
COMMENT ON COLUMN public.atendimentos_plantao.chamado_id IS
  'Vínculo OPCIONAL. O atendimento NUNCA cria chamado; ele se liga a um que já '
  'existe, na hora ou dias depois, pela MESMA porta com _id preenchido — ligar '
  'o chamado amanhã É correção. Nenhum evento é gravado em chamado_eventos, e '
  'chamados NÃO ganhou coluna: a pergunta reversa sai do índice parcial '
  'atendimentos_plantao_chamado_idx.';

-- ═══════════════════════════════════════════════════════════════════════
-- §2) O GATILHO — A PROJEÇÃO E O CARIMBO
-- ═══════════════════════════════════════════════════════════════════════
-- INCONDICIONAL: não há `IF NEW.dia IS NULL`. Uma projeção condicional aceitaria
-- um `dia` vindo de fora e passaria a ter DUAS verdades sobre a mesma pergunta —
-- que é exatamente o defeito que esta coluna existe para não ter.
--
-- O RELÓGIO DE PAREDE É LIDO UMA VEZ SÓ (v_local), e `hora` e `dia` saem os
-- DOIS dele. Truncar em UTC e projetar em America/Sao_Paulo daria um instante
-- cujo minuto local NÃO é redondo — em 1900 o fuso de São Paulo é LMT
-- (-03:06:28), com SEGUNDOS no deslocamento, e o portão apanharia disso. Com
-- uma leitura só, "o minuto" quer dizer o minuto que a pessoa digitou.
--
-- NÃO É SECURITY DEFINER, e a ausência é decisão: ele só escreve em NEW, em
-- memória. Não lê nem grava tabela nenhuma, então não há privilégio a elevar —
-- é o mesmo argumento de `sobreaviso_carimbo` (u86:250-255), e mantê-lo assim
-- deixa as DUAS funções definer deste arquivo dentro do censo da conferência 209.
CREATE OR REPLACE FUNCTION public.atendimento_plantao_carimbo()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $carimbo$
DECLARE
  v_local timestamp;
BEGIN
  v_local := date_trunc('minute', NEW.hora AT TIME ZONE 'America/Sao_Paulo');
  NEW.hora := v_local AT TIME ZONE 'America/Sao_Paulo';
  NEW.dia  := v_local::date;
  NEW.alterado_em  := now();
  NEW.alterado_por := COALESCE(auth.uid(), NEW.alterado_por);
  NEW.registrado_por := COALESCE(NEW.registrado_por, auth.uid());
  RETURN NEW;
END
$carimbo$;

DROP TRIGGER IF EXISTS trg_atendimento_plantao_carimbo ON public.atendimentos_plantao;
CREATE TRIGGER trg_atendimento_plantao_carimbo
  BEFORE INSERT OR UPDATE ON public.atendimentos_plantao
  FOR EACH ROW EXECUTE FUNCTION public.atendimento_plantao_carimbo();

-- ═══════════════════════════════════════════════════════════════════════
-- §3) RLS E PRIVILÉGIO — SÓ-LEITURA NO NAVEGADOR
-- ═══════════════════════════════════════════════════════════════════════
-- A POLICY É A ÚNICA FRONTEIRA REAL: todo usuário fala com o Postgres com a
-- MESMA chave publicável, que está no .env VERSIONADO. O que a tela esconde, o
-- curl mostra.
--
-- ── O REVOKE VEM PRIMEIRO, E ELE É ESTRUTURA, NÃO HERANÇA ────────────────
-- É o desenho de `agenda_campo` (u78:805-834), com o argumento dele: "não
-- escrevi um GRANT" NÃO é o mesmo que "não há GRANT". Todo projeto Supabase
-- pode trazer, do bootstrap, um ALTER DEFAULT PRIVILEGES concedendo tudo a
-- authenticated — e aí a tabela nasceria escrevível e a porta única viraria uma
-- peça só. Revogar o que não existe é no-op e idempotente.
REVOKE ALL   ON public.atendimentos_plantao FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.atendimentos_plantao TO authenticated;
GRANT ALL    ON public.atendimentos_plantao TO service_role;

ALTER TABLE public.atendimentos_plantao ENABLE ROW LEVEL SECURITY;

-- ── QUEM LÊ: O DONO DA LINHA E QUEM RESPONDE PELA OPERAÇÃO ────────────────
-- DUAS metades, e as duas são necessárias:
--   · VÍNCULO — linha ATIVA e não `pendente_aprovacao` em profiles. Vai ao lado
--     de is_gestor() e não dentro dela porque is_gestor NÃO olha `ativo`
--     (P51: um ex-funcionário com login vivo continua gestor do sistema
--     inteiro). Enquanto a P51 estiver de pé, esta metade é o que segura.
--   · PROPRIEDADE — `plantonista_id = auth.uid()` OU is_gestor().
--
-- E NÃO É `pode_acessar_chamado(chamado_id)`, que seria a régua "óbvia" para
-- uma tabela com chamado_id. Aquela função tem o ramo `c.responsavel_id IS
-- NULL` SEM filtro de status (s2:152-155): um plantão pendurado num chamado da
-- fila aberta ficaria legível por QUALQUER autenticado ativo. É a mesma recusa
-- que a U80 §3 fez, pelo mesmo motivo (u80:212-228).
--
-- NENHUM PREDICADO NOVO. Um `pode_ver_plantao()` seria a quinta lista de papéis
-- a ter de concordar com as outras quatro.
DROP POLICY IF EXISTS "atendimentos_plantao_select" ON public.atendimentos_plantao;
CREATE POLICY "atendimentos_plantao_select" ON public.atendimentos_plantao
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p
                  WHERE p.id = auth.uid()
                    AND p.ativo
                    AND p.status <> 'pendente_aprovacao')
         AND (plantonista_id = auth.uid() OR public.is_gestor(auth.uid())));

COMMENT ON POLICY "atendimentos_plantao_select" ON public.atendimentos_plantao IS
  'O dono da linha e quem responde pela operação. NÃO é pode_acessar_chamado: '
  'aquela função abre a fila sem dono para qualquer autenticado (s2:152-155), e '
  'um plantão pendurado num chamado sem responsável ficaria legível por todos. '
  'NÃO há policy de escrita: a tabela é só-leitura no navegador por PRIVILÉGIO '
  '(REVOKE), e toda escrita passa por plantao_salvar / plantao_apagar.';

-- ═══════════════════════════════════════════════════════════════════════
-- §4) A PORTA DE ESCRITA
-- ═══════════════════════════════════════════════════════════════════════
-- ── QUEM REGISTRA, E QUANDO: É O PLANTONISTA, ÀS 2H, NO CELULAR ──────────
-- Um gate de `is_gestor` impediria a ÚNICA pessoa que estava lá de registrar —
-- e o SAC, que é gestor, não estava. Um gate aberto deixaria qualquer um lançar
-- atendimento em nome de outro, num registro que é de PESSOAL.
-- O gate é por VÍNCULO + PROCURAÇÃO, e não por PAPEL:
--   · VÍNCULO   — `p.ativo AND p.status <> 'pendente_aprovacao'` (ao lado de
--                 is_gestor, porque ela não olha `ativo` — P51);
--   · PROCURAÇÃO— `_plantonista = auth.uid()` OU `is_gestor(auth.uid())`.
-- Ou seja: qualquer pessoa da casa registra PARA SI; lançar por OUTRO é de quem
-- responde pela operação.
--
-- ── O GATE INTEIRO SOB `IF v_eu IS NOT NULL`, E SEM ISSO O PORTÃO NÃO RODA ─
-- Na migration e no SQL Editor não há JWT: `auth.uid()` é NULL. Um gate que
-- comece por `IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() …)`
-- levanta 42501 CONTRA SI MESMO, e o portão do §6 — que é o único lugar onde se
-- prova que esta função roda — nunca roda. O idioma da casa é o curto-circuito
-- de u86:326-331, e ele está aqui pelo mesmo motivo.
--
-- ── O MESMO TESTE NA POLICY E NO CORPO ────────────────────────────────────
-- SECURITY DEFINER NÃO PASSA PELA RLS. O teste de dois eixos que está na policy
-- do §3 tem de estar escrito aqui também — é o que impede um login de
-- ex-funcionário de gravar plantão por /rest/v1/rpc.
--
-- ── AS RECUSAS TÊM GÊMEO PURO ─────────────────────────────────────────────
-- Cada frase abaixo existe, PALAVRA POR PALAVRA, em `erroDoAtendimento`
-- (src/features/plantao/modelo.ts), e o verificador mede o acordo dos dois
-- lados. A porta continua sendo a fronteira de verdade; o gêmeo existe para o
-- botão poder ficar desabilitado com uma frase em vez de mandar uma requisição
-- para receber um 22023.
--
-- ── POR QUE OS NOMES DO `RETURNS TABLE` NÃO SÃO `id`, `dia` E `hora` ──────
-- Em PL/pgSQL, um nome que é ao mesmo tempo parâmetro OUT e coluna de tabela em
-- escopo levanta 42702 "column reference is ambiguous" EM EXECUÇÃO, não na
-- leitura. `id`, `dia` e `hora` são colunas desta tabela, e `dia` é também
-- coluna de public.sobreaviso, que esta função consulta. Qualificar tudo
-- resolveria; NOMEAR DIFERENTE torna a classe inexprimível, que é melhor do que
-- resolvida por disciplina.
CREATE OR REPLACE FUNCTION public.plantao_salvar(
  _hora              timestamptz,
  _plantonista       uuid,
  _tipo              text,
  _descricao         text,
  _cliente           uuid    DEFAULT NULL,
  _cliente_informado text    DEFAULT NULL,
  _chamado           uuid    DEFAULT NULL,
  _id                uuid    DEFAULT NULL
)
RETURNS TABLE (
  atendimento_id  uuid,
  dia_do_plantao  date,
  hora_gravada    timestamptz,
  horas_escaladas smallint,
  horas_do_dia    smallint
)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $salvar$
DECLARE
  v_eu     uuid := auth.uid();
  v_dono   uuid;
  v_texto  text := nullif(btrim(COALESCE(_cliente_informado, '')), '');
  v_desc   text := btrim(COALESCE(_descricao, ''));
  v_id     uuid;
  v_dia    date;
  v_hora   timestamptz;
  v_he     smallint;
  v_hd     smallint;
BEGIN
  -- ── O GATE, EM DUAS METADES, E SÓ QUANDO HÁ QUEM GATEAR ────────────────
  IF v_eu IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles p
                    WHERE p.id = v_eu
                      AND p.ativo
                      AND p.status <> 'pendente_aprovacao') THEN
      RAISE EXCEPTION 'Só quem trabalha aqui registra atendimento de plantão.'
        USING ERRCODE = '42501';
    END IF;
    IF NOT (_plantonista = v_eu OR public.is_gestor(v_eu)) THEN
      RAISE EXCEPTION 'Você registra plantão em seu próprio nome; lançar por outra pessoa é de quem responde pela operação.'
        USING ERRCODE = '42501';
    END IF;
    -- O vínculo com chamado carrega a régua de LEITURA do chamado, e é a lição
    -- da S4 em chamado_eventos (s4:317-321): sem isto, esta porta viraria um
    -- oráculo que confirma a existência de um uuid de chamado alheio.
    IF _chamado IS NOT NULL AND NOT public.pode_acessar_chamado(_chamado) THEN
      RAISE EXCEPTION 'Você não tem acesso a esse chamado, então não pode pendurar um atendimento nele.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- ── AS RECUSAS, NA MESMA ORDEM DO GÊMEO PURO ───────────────────────────
  IF _hora IS NULL THEN
    RAISE EXCEPTION 'Informe a hora do atendimento.' USING ERRCODE = '22023';
  END IF;
  IF _plantonista IS NULL THEN
    RAISE EXCEPTION 'Informe quem atendeu.' USING ERRCODE = '22023';
  END IF;
  IF _tipo IS NULL OR _tipo NOT IN ('remoto','presencial') THEN
    RAISE EXCEPTION 'Diga se o atendimento foi remoto ou presencial. Recebi %.',
      COALESCE(_tipo, 'NULL') USING ERRCODE = '22023';
  END IF;
  IF v_desc = '' THEN
    RAISE EXCEPTION 'Descreva o que foi feito no atendimento.' USING ERRCODE = '22023';
  END IF;
  IF _cliente IS NOT NULL AND v_texto IS NOT NULL THEN
    RAISE EXCEPTION 'Escolha o cliente da lista OU escreva o nome, não os dois.'
      USING ERRCODE = '22023';
  END IF;
  IF _cliente IS NULL AND v_texto IS NULL THEN
    RAISE EXCEPTION 'Informe o cliente — escolha da lista ou escreva o nome.'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _plantonista) THEN
    RAISE EXCEPTION 'Não existe ninguém com o id % — o plantonista sai de public.profiles, e não de uma segunda lista de gente.',
      _plantonista USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- ── CORREÇÃO: A MESMA PORTA, COM `_id` ─────────────────────────────────
  IF _id IS NOT NULL THEN
    SELECT a.plantonista_id INTO v_dono
      FROM public.atendimentos_plantao a
     WHERE a.id = _id;
    IF v_dono IS NULL THEN
      RAISE EXCEPTION 'Não existe atendimento de plantão com o id %.', _id
        USING ERRCODE = '22023';
    END IF;
    IF v_eu IS NOT NULL AND NOT (v_dono = v_eu OR public.is_gestor(v_eu)) THEN
      RAISE EXCEPTION 'Esse atendimento é de outra pessoa; só ela ou quem responde pela operação corrige.'
        USING ERRCODE = '42501';
    END IF;

    UPDATE public.atendimentos_plantao AS a
       SET hora              = _hora,
           plantonista_id    = _plantonista,
           tipo              = _tipo,
           descricao         = v_desc,
           cliente_id        = _cliente,
           cliente_informado = v_texto,
           chamado_id        = _chamado
     WHERE a.id = _id
    RETURNING a.id, a.dia, a.hora INTO v_id, v_dia, v_hora;
  ELSE
    -- `dia` NÃO entra na lista de colunas: o gatilho BEFORE a escreve, e o NOT
    -- NULL é verificado DEPOIS dos gatilhos BEFORE. Passar um valor aqui seria
    -- inventar um segundo escritor para a projeção.
    INSERT INTO public.atendimentos_plantao
      (hora, plantonista_id, tipo, descricao, cliente_id, cliente_informado, chamado_id, registrado_por)
    VALUES
      (_hora, _plantonista, _tipo, v_desc, _cliente, v_texto, _chamado, v_eu)
    RETURNING atendimentos_plantao.id, atendimentos_plantao.dia, atendimentos_plantao.hora
      INTO v_id, v_dia, v_hora;
  END IF;

  -- ── A DIVERGÊNCIA, DITA NO ATO ─────────────────────────────────────────
  -- Dois NÚMEROS e nenhum booleano: `horas_escaladas` responde "esta pessoa
  -- está na escala deste dia" e `horas_do_dia` responde "há escala neste dia".
  -- Um booleano `escalado` sozinho colapsaria "furou a escala" com "não há
  -- escala nenhuma lançada", que é acusação sobre o trabalho de outro. Quem
  -- monta a frase é `avisoDaEscala`, no modelo puro.
  -- 0 é inequívoco: `sobreaviso_horas_check` recusa 0 e célula vazia é AUSÊNCIA
  -- de linha (u86:143).
  SELECT COALESCE(sum(s.horas) FILTER (WHERE s.pessoa_id = _plantonista), 0)::smallint,
         COALESCE(sum(s.horas), 0)::smallint
    INTO v_he, v_hd
    FROM public.sobreaviso s
   WHERE s.dia = v_dia;

  RETURN QUERY SELECT v_id, v_dia, v_hora, v_he, v_hd;
END
$salvar$;

REVOKE EXECUTE ON FUNCTION public.plantao_salvar(timestamptz, uuid, text, text, uuid, text, uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.plantao_salvar(timestamptz, uuid, text, text, uuid, text, uuid, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.plantao_salvar(timestamptz, uuid, text, text, uuid, text, uuid, uuid) IS
  'Registra (ou CORRIGE, com _id) um atendimento de plantão. Gate em duas '
  'metades: VÍNCULO (linha ativa e não pendente em profiles, ao lado de '
  'is_gestor porque ela não olha ativo — P51) e PROCURAÇÃO (_plantonista = '
  'auth.uid() OU is_gestor). Qualquer pessoa da casa registra PARA SI; lançar '
  'por outro é de quem responde pela operação — um gate de gestor impediria a '
  'única pessoa que estava lá, às 2h da manhã, de registrar. Devolve o dia '
  'projetado pelo gatilho e DUAS horas de escala (as desta pessoa e as do dia), '
  'que é como a divergência entre escala e registro aparece no ato, sem tabela '
  'de reconciliação. NUNCA cria chamado e NUNCA toca em dinheiro (R117/U87).';

-- ═══════════════════════════════════════════════════════════════════════
-- §5) A PORTA DE APAGAR
-- ═══════════════════════════════════════════════════════════════════════
-- SEM duas fases, ao contrário de `sobreaviso_limpar`, e a assimetria tem
-- razão: lá o gesto apaga uma FAIXA de datas de uma pessoa e o usuário não sabe
-- o que vai levar junto; aqui ele apaga UMA linha que ele está vendo na tela,
-- com a hora, o cliente e a descrição na frente. Uma prévia de uma linha só é
-- um "tem certeza?" com outro nome, e não existe "tem certeza?" nesta casa.
--
-- E ELE NÃO DEIXA LÁPIDE, o que é dívida declarada (P53): apagar um atendimento
-- não deixa rastro nenhum. A condição para reabrir está escrita lá — o dia em
-- que o plantão virar cobrável.
CREATE OR REPLACE FUNCTION public.plantao_apagar(_id uuid)
RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $apagar$
DECLARE
  v_eu    uuid := auth.uid();
  v_dono  uuid;
  v_n     integer;
BEGIN
  IF _id IS NULL THEN
    RAISE EXCEPTION 'Informe qual atendimento apagar.' USING ERRCODE = '22023';
  END IF;

  SELECT a.plantonista_id INTO v_dono
    FROM public.atendimentos_plantao a
   WHERE a.id = _id;
  IF v_dono IS NULL THEN
    -- Idempotente de propósito: apagar o que já não existe devolve 0, e não um
    -- erro. O duplo toque também acontece no botão de apagar.
    RETURN 0;
  END IF;

  IF v_eu IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles p
                    WHERE p.id = v_eu
                      AND p.ativo
                      AND p.status <> 'pendente_aprovacao') THEN
      RAISE EXCEPTION 'Só quem trabalha aqui apaga atendimento de plantão.'
        USING ERRCODE = '42501';
    END IF;
    IF NOT (v_dono = v_eu OR public.is_gestor(v_eu)) THEN
      RAISE EXCEPTION 'Esse atendimento é de outra pessoa; só ela ou quem responde pela operação apaga.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  DELETE FROM public.atendimentos_plantao a WHERE a.id = _id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END
$apagar$;

REVOKE EXECUTE ON FUNCTION public.plantao_apagar(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.plantao_apagar(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.plantao_apagar(uuid) IS
  'Apaga UM atendimento de plantão. Mesmo gate de plantao_salvar (vínculo + '
  'dono ou gestor). Idempotente: apagar o que já não existe devolve 0. NÃO '
  'deixa lápide — dívida declarada em P53, a reabrir no dia em que o plantão '
  'virar cobrável.';

-- ═══════════════════════════════════════════════════════════════════════
-- §6) O PORTÃO — oito provas de COMPORTAMENTO, dentro da transação
-- ═══════════════════════════════════════════════════════════════════════
-- Ele exercita a PORTA e os CAMINHOS, e não a existência dos objetos: existência
-- é o que a §7 mede. Um portão que só conferisse `to_regclass` ficaria verde com
-- a função inteira quebrada.
--
-- ── NENHUMA PROVA DEPENDE DO RELÓGIO ──────────────────────────────────────
-- Nada aqui chama `now()` para construir um caso. Uma prova que comparasse
-- `now() - interval '30 minutes'` com a data corrente de Brasília abortaria a
-- migration quando rodada entre 00:00 e 00:30 — falha por HORA DO DIA, que é a
-- pior forma de um portão mentir.
--
-- ── E NÃO HÁ PROVA DE `alterado_em` MONOTÔNICO, DE PROPÓSITO ──────────────
-- Ela é INASSERTÁVEL aqui: `now()` é `transaction_timestamp()`, constante
-- dentro da transação. Um INSERT e um UPDATE no mesmo BEGIN gravam o MESMO
-- instante, e uma asserção de "avançou" abortaria num banco perfeitamente
-- sadio. O gatilho usa `now()` porque é o idioma vivo de `sobreaviso_carimbo`;
-- o que ele promete é ENCONTRABILIDADE entre transações, não monotonicidade
-- dentro de uma.
--
-- AS DATAS SÃO DE 1900, que nenhum dado de produção alcança. 1900-03-05 é uma
-- segunda-feira (a U86 usa a mesma), logo 1900-03-11 é um DOMINGO — e é ele que
-- prova "02:30 de domingo é o plantão de domingo".
DO $portao$
DECLARE
  v_p       uuid;
  v_p2      uuid;
  v_cli     uuid;
  v_cha     uuid;
  v_id      uuid;
  v_id2     uuid;
  v_dia     date;
  v_hora    timestamptz;
  v_he      smallint;
  v_hd      smallint;
  v_n       int;
  v_n2      int;
  v_pegou   boolean;
  v_tipo    text;
BEGIN
  SELECT p.id INTO v_p
    FROM public.profiles p
   WHERE p.ativo AND p.status <> 'pendente_aprovacao'
   ORDER BY p.id LIMIT 1;
  SELECT p.id INTO v_p2
    FROM public.profiles p
   WHERE p.id <> v_p
   ORDER BY p.id LIMIT 1;
  SELECT c.id INTO v_cli FROM public.clientes c ORDER BY c.id LIMIT 1;
  SELECT c.id INTO v_cha FROM public.chamados c ORDER BY c.id LIMIT 1;

  -- ── PROVA 1: O DIA É O LOCAL, E NÃO O UTC ────────────────────────────────
  -- 21:00 de 10/03/1900 em São Paulo é 11/03/1900 em UTC (o fuso de 1900 é LMT,
  -- -03:06:28). Se o gatilho fizesse `NEW.hora::date`, este `dia` sairia 11.
  -- As DUAS asserções juntas é que provam alguma coisa: a segunda mostra que o
  -- caso realmente atinge o alvo — sem ela, a primeira ficaria verde num
  -- instante em que as duas datas coincidem, que é o dia inteiro menos três
  -- horas.
  SELECT r.atendimento_id, r.dia_do_plantao, r.hora_gravada
    INTO v_id, v_dia, v_hora
    FROM public.plantao_salvar(
           (TIMESTAMP '1900-03-10 21:00:00' AT TIME ZONE 'America/Sao_Paulo'),
           v_p, 'remoto', 'Portao 1 — virada de meia-noite',
           v_cli, NULL, NULL, NULL) r;
  IF v_dia <> DATE '1900-03-10' THEN
    RAISE EXCEPTION 'U87 PORTÃO 1: 21:00 de 10/03 em São Paulo é plantão de 10/03; o gatilho projetou %.', v_dia;
  END IF;
  IF (v_hora AT TIME ZONE 'UTC')::date <> DATE '1900-03-11' THEN
    RAISE EXCEPTION 'U87 PORTÃO 1: o caso não atingiu o alvo — em UTC este instante tinha de cair em 11/03 (senão a prova acima não prova que a projeção usa America/Sao_Paulo); caiu em %.',
      (v_hora AT TIME ZONE 'UTC')::date;
  END IF;

  -- ── PROVA 2: 02:30 DE DOMINGO É O PLANTÃO DE DOMINGO ────────────────────
  -- A madrugada pertence ao PRÓPRIO dia de calendário. Não existe uma segunda
  -- data dizendo "isto é do sobreaviso de sábado": ela divergiria desta no
  -- primeiro dia de cobertura curta.
  SELECT r.atendimento_id, r.dia_do_plantao
    INTO v_id2, v_dia
    FROM public.plantao_salvar(
           (TIMESTAMP '1900-03-11 02:30:00' AT TIME ZONE 'America/Sao_Paulo'),
           v_p, 'presencial', 'Portao 2 — madrugada de domingo',
           NULL, 'Cliente escrito à mão', NULL, NULL) r;
  IF v_dia <> DATE '1900-03-11' THEN
    RAISE EXCEPTION 'U87 PORTÃO 2: 02:30 de domingo é o plantão de DOMINGO (11/03); veio %.', v_dia;
  END IF;
  IF EXTRACT(ISODOW FROM v_dia) <> 7 THEN
    RAISE EXCEPTION 'U87 PORTÃO 2: a fixture está errada — 11/03/1900 tinha de ser domingo (ISODOW 7), e é %.',
      EXTRACT(ISODOW FROM v_dia);
  END IF;

  -- ── PROVA 3: A TRUNCAGEM AO MINUTO, E O DUPLO TOQUE QUE ELA TORNA VISÍVEL ─
  -- Primeiro que o segundo some do instante gravado; depois que DOIS toques no
  -- mesmo minuto, com a mesma descrição, batem no índice único. Sem a
  -- truncagem, os dois instantes seriam diferentes e o índice não pegaria nada.
  SELECT r.atendimento_id, r.hora_gravada INTO v_id, v_hora
    FROM public.plantao_salvar(
           (TIMESTAMP '1900-03-11 04:15:41' AT TIME ZONE 'America/Sao_Paulo'),
           v_p, 'remoto', '  Alarme DISPARADO  ', v_cli, NULL, NULL, NULL) r;
  IF (v_hora AT TIME ZONE 'America/Sao_Paulo') <> TIMESTAMP '1900-03-11 04:15:00' THEN
    RAISE EXCEPTION 'U87 PORTÃO 3: a hora tinha de ser truncada ao minuto do relógio de parede (04:15:00); ficou %.',
      (v_hora AT TIME ZONE 'America/Sao_Paulo');
  END IF;
  v_pegou := false;
  BEGIN
    PERFORM 1 FROM public.plantao_salvar(
      (TIMESTAMP '1900-03-11 04:15:49' AT TIME ZONE 'America/Sao_Paulo'),
      v_p, 'remoto', 'alarme disparado', v_cli, NULL, NULL, NULL) r2;
  EXCEPTION WHEN unique_violation THEN
    v_pegou := true;
  END;
  IF NOT v_pegou THEN
    RAISE EXCEPTION 'U87 PORTÃO 3: o segundo toque no MESMO minuto com a MESMA descrição tinha de bater no índice único do duplo toque, e passou.';
  END IF;
  -- E o par negativo: o índice não é "um atendimento por minuto". Descrição
  -- diferente, mesmo minuto, passa — senão a proteção viraria uma trava.
  SELECT r.atendimento_id INTO v_id
    FROM public.plantao_salvar(
           (TIMESTAMP '1900-03-11 04:15:12' AT TIME ZONE 'America/Sao_Paulo'),
           v_p, 'remoto', 'Outro chamado no mesmo minuto', v_cli, NULL, NULL, NULL) r;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'U87 PORTÃO 3: o índice do duplo toque virou trava — descrição DIFERENTE no mesmo minuto tinha de passar.';
  END IF;

  -- ── PROVA 4: O CLIENTE É UMA FORMA, E A GUARDA NÃO É A TELA ─────────────
  v_pegou := false;
  BEGIN
    PERFORM 1 FROM public.plantao_salvar(
      (TIMESTAMP '1900-03-11 05:00:00' AT TIME ZONE 'America/Sao_Paulo'),
      v_p, 'remoto', 'Portao 4a', v_cli, 'e também escrito', NULL, NULL) r2;
  EXCEPTION WHEN OTHERS THEN
    v_pegou := (SQLSTATE = '22023');
  END;
  IF NOT v_pegou THEN
    RAISE EXCEPTION 'U87 PORTÃO 4: cliente da lista E nome escrito ao mesmo tempo tinha de ser recusado com 22023 pela porta.';
  END IF;
  v_pegou := false;
  BEGIN
    PERFORM 1 FROM public.plantao_salvar(
      (TIMESTAMP '1900-03-11 05:01:00' AT TIME ZONE 'America/Sao_Paulo'),
      v_p, 'remoto', 'Portao 4b', NULL, '   ', NULL, NULL) r2;
  EXCEPTION WHEN OTHERS THEN
    v_pegou := (SQLSTATE = '22023');
  END;
  IF NOT v_pegou THEN
    RAISE EXCEPTION 'U87 PORTÃO 4: nem cliente da lista nem nome escrito (espaços contam como vazio) tinha de ser recusado com 22023.';
  END IF;
  -- E o CHECK vivo, pelo caminho que não passa pela porta — é o caminho do
  -- service_role e o de qualquer migration futura.
  v_pegou := false;
  BEGIN
    INSERT INTO public.atendimentos_plantao (hora, plantonista_id, tipo, descricao, cliente_id, cliente_informado)
    VALUES ((TIMESTAMP '1900-03-11 05:02:00' AT TIME ZONE 'America/Sao_Paulo'),
            v_p, 'remoto', 'Portao 4c', v_cli, 'os dois');
  EXCEPTION WHEN check_violation THEN
    v_pegou := true;
  END;
  IF NOT v_pegou THEN
    RAISE EXCEPTION 'U87 PORTÃO 4: o CHECK num_nonnulls(cliente_id, cliente_informado) = 1 tinha de recusar as duas formas juntas num INSERT direto — a porta não é a única guarda.';
  END IF;

  -- ── PROVA 5: TIPO E DESCRIÇÃO ──────────────────────────────────────────
  v_pegou := false;
  BEGIN
    PERFORM 1 FROM public.plantao_salvar(
      (TIMESTAMP '1900-03-11 06:00:00' AT TIME ZONE 'America/Sao_Paulo'),
      v_p, 'hibrido', 'Portao 5a', v_cli, NULL, NULL, NULL) r2;
  EXCEPTION WHEN OTHERS THEN
    v_pegou := (SQLSTATE = '22023');
  END;
  IF NOT v_pegou THEN
    RAISE EXCEPTION 'U87 PORTÃO 5: um tipo fora de (remoto, presencial) tinha de ser recusado com 22023.';
  END IF;
  v_pegou := false;
  BEGIN
    PERFORM 1 FROM public.plantao_salvar(
      (TIMESTAMP '1900-03-11 06:01:00' AT TIME ZONE 'America/Sao_Paulo'),
      v_p, 'remoto', '     ', v_cli, NULL, NULL, NULL) r2;
  EXCEPTION WHEN OTHERS THEN
    v_pegou := (SQLSTATE = '22023');
  END;
  IF NOT v_pegou THEN
    RAISE EXCEPTION 'U87 PORTÃO 5: descrição só de espaços tinha de ser recusada com 22023 — o CHECK usa btrim, e a porta também.';
  END IF;

  -- ── PROVA 6: OS TRÊS ESTADOS DO AVISO DA ESCALA ────────────────────────
  -- Estado A: a pessoa TEM horas naquele dia.
  INSERT INTO public.sobreaviso (dia, pessoa_id, horas, origem)
  VALUES (DATE '1900-03-13', v_p, 14, 'manual')
  ON CONFLICT ON CONSTRAINT sobreaviso_pkey DO UPDATE SET horas = 14;
  SELECT r.atendimento_id, r.horas_escaladas, r.horas_do_dia
    INTO v_id, v_he, v_hd
    FROM public.plantao_salvar(
           (TIMESTAMP '1900-03-13 03:00:00' AT TIME ZONE 'America/Sao_Paulo'),
           v_p, 'remoto', 'Portao 6a', v_cli, NULL, NULL, NULL) r;
  IF v_he <> 14 OR v_hd <> 14 THEN
    RAISE EXCEPTION 'U87 PORTÃO 6a: a pessoa está na escala de 13/03 com 14h; a porta devolveu escaladas=% e do_dia=%.', v_he, v_hd;
  END IF;

  -- Estado B: o dia TEM escala, e ela é de OUTRA pessoa. É por isto que o
  -- pré-voo exige duas pessoas — sem a segunda, este ramo nunca rodaria.
  INSERT INTO public.sobreaviso (dia, pessoa_id, horas, origem)
  VALUES (DATE '1900-03-14', v_p2, 24, 'manual')
  ON CONFLICT ON CONSTRAINT sobreaviso_pkey DO UPDATE SET horas = 24;
  SELECT r.atendimento_id, r.horas_escaladas, r.horas_do_dia
    INTO v_id, v_he, v_hd
    FROM public.plantao_salvar(
           (TIMESTAMP '1900-03-14 03:00:00' AT TIME ZONE 'America/Sao_Paulo'),
           v_p, 'remoto', 'Portao 6b', v_cli, NULL, NULL, NULL) r;
  IF v_he <> 0 OR v_hd <> 24 THEN
    RAISE EXCEPTION 'U87 PORTÃO 6b: quem atendeu está FORA da escala de 14/03, que tem 24h de outra pessoa; a porta devolveu escaladas=% e do_dia=%.', v_he, v_hd;
  END IF;

  -- Estado C: não há escala nenhuma naquele dia. Colapsar este caso com o B
  -- acusaria o plantonista de furar uma escala que ninguém lançou.
  SELECT r.atendimento_id, r.horas_escaladas, r.horas_do_dia
    INTO v_id, v_he, v_hd
    FROM public.plantao_salvar(
           (TIMESTAMP '1900-03-15 03:00:00' AT TIME ZONE 'America/Sao_Paulo'),
           v_p, 'remoto', 'Portao 6c', v_cli, NULL, NULL, NULL) r;
  IF v_he <> 0 OR v_hd <> 0 THEN
    RAISE EXCEPTION 'U87 PORTÃO 6c: 15/03 não tem escala lançada; a porta devolveu escaladas=% e do_dia=%.', v_he, v_hd;
  END IF;

  -- ── PROVA 7: A CORREÇÃO É A MESMA PORTA, E NÃO UMA LINHA NOVA ──────────
  -- `_id` preenchido troca o tipo e LIGA um chamado que já existe. Ligar o
  -- chamado amanhã É correção — é a razão de não haver uma segunda porta.
  SELECT count(*) INTO v_n FROM public.atendimentos_plantao a
   WHERE a.plantonista_id = v_p AND a.dia = DATE '1900-03-15';
  SELECT r.atendimento_id INTO v_id2
    FROM public.plantao_salvar(
           (TIMESTAMP '1900-03-15 03:00:00' AT TIME ZONE 'America/Sao_Paulo'),
           v_p, 'presencial', 'Portao 6c', v_cli, NULL, v_cha, v_id) r;
  IF v_id2 <> v_id THEN
    RAISE EXCEPTION 'U87 PORTÃO 7: corrigir tinha de devolver o MESMO id (% esperado, % veio) — se devolvesse outro, a correção seria uma linha nova.', v_id, v_id2;
  END IF;
  SELECT count(*) INTO v_n2 FROM public.atendimentos_plantao a
   WHERE a.plantonista_id = v_p AND a.dia = DATE '1900-03-15';
  IF v_n2 <> v_n THEN
    RAISE EXCEPTION 'U87 PORTÃO 7: a correção criou linha — havia % em 15/03 e agora há %.', v_n, v_n2;
  END IF;
  SELECT a.tipo INTO v_tipo FROM public.atendimentos_plantao a WHERE a.id = v_id;
  IF v_tipo <> 'presencial' THEN
    RAISE EXCEPTION 'U87 PORTÃO 7: a correção não gravou o tipo novo; ficou %.', v_tipo;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.atendimentos_plantao a
                  WHERE a.id = v_id AND a.chamado_id = v_cha) THEN
    RAISE EXCEPTION 'U87 PORTÃO 7: a correção não ligou o chamado — o vínculo OPCIONAL não foi gravado.';
  END IF;

  -- ── PROVA 8: APAGAR APAGA, E APAGAR DE NOVO DEVOLVE 0 ──────────────────
  v_n := public.plantao_apagar(v_id);
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'U87 PORTÃO 8: apagar um atendimento existente tinha de devolver 1; devolveu %.', v_n;
  END IF;
  v_n := public.plantao_apagar(v_id);
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'U87 PORTÃO 8: apagar o que já não existe tinha de devolver 0 (o duplo toque também acontece no botão de apagar); devolveu %.', v_n;
  END IF;

  -- ── LIMPEZA: o portão não deixa lixo, e a ausência é PROVADA ───────────
  DELETE FROM public.atendimentos_plantao a WHERE a.dia < DATE '1990-01-01';
  DELETE FROM public.sobreaviso s
   WHERE s.dia IN (DATE '1900-03-13', DATE '1900-03-14')
     AND s.pessoa_id IN (v_p, v_p2);
  SELECT count(*) INTO v_n FROM public.atendimentos_plantao a WHERE a.dia < DATE '1990-01-01';
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'U87 PORTÃO: sobraram % atendimentos de teste anteriores a 1990. Esta migration não pode deixar dado inventado no banco.', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM public.sobreaviso s WHERE s.dia < DATE '1990-01-01';
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'U87 PORTÃO: sobraram % linhas de escala de teste anteriores a 1990 — o portão escreveu em sobreaviso e tinha de devolver a tabela ao estado de antes.', v_n;
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

-- ══ 201: AS COLUNAS, UMA A UMA ═══════════════════════════════════════════
-- Conte a COLUNA, não o literal (regra 2). Uma coluna nova acende esta linha —
-- inclusive uma coluna de dinheiro que alguém acrescente sem ler o cabeçalho.
SELECT 201 AS ordem,
       'CRÍTICO: public.atendimentos_plantao tem EXATAMENTE estas colunas — uma coluna nova (de dinheiro ou não) acende esta linha' AS conferencia,
       (SELECT string_agg(a.attname, ',' ORDER BY a.attnum)
          FROM pg_attribute a
         WHERE a.attrelid = 'public.atendimentos_plantao'::regclass
           AND a.attnum > 0 AND NOT a.attisdropped) AS valor,
       'id,hora,dia,plantonista_id,tipo,descricao,cliente_id,cliente_informado,chamado_id,registrado_por,registrado_em,alterado_por,alterado_em' AS esperado

UNION ALL
-- ══ 202: NENHUM REAL MORA AQUI ═══════════════════════════════════════════
-- Medido pelo CATÁLOGO e por DOIS eixos: o TIPO (numeric/money são os tipos em
-- que valor mora neste banco) e o NOME. Uma promessa em comentário não é
-- medida; esta é.
SELECT 202, 'CRÍTICO: ZERO coluna de dinheiro em atendimentos_plantao — nem por tipo (numeric/money) nem por nome (valor/preco/custo/total/reais). O plantão não é cobrável nesta entrega, e o selo dele é MUDO porque não existe',
       (SELECT count(*)::text
          FROM pg_attribute a
          JOIN pg_type ty ON ty.oid = a.atttypid
         WHERE a.attrelid = 'public.atendimentos_plantao'::regclass
           AND a.attnum > 0 AND NOT a.attisdropped
           AND (ty.typname IN ('numeric','money')
                OR a.attname ~ '(valor|preco|custo|total|reais)')),
       '0'

UNION ALL
-- ══ 203: OS DOIS VALORES DE `tipo`, EXTRAÍDOS DO CHECK VIVO ══════════════
-- O CONJUNTO, e não a string renderizada: o Postgres reescreve a parentização e
-- deparsa `text` de um jeito e `varchar` de outro, e uma conferência que
-- comparasse a string bruta diria '>>> OLHAR <<<' numa execução PERFEITA.
SELECT 203, 'CRÍTICO: `tipo` aceita EXATAMENTE remoto e presencial, lido do CHECK vivo (o conjunto, não a renderização)',
       (SELECT string_agg(x.v, ',' ORDER BY x.v)
          FROM (SELECT DISTINCT
                       (regexp_matches(pg_get_constraintdef(c.oid), '''([a-z_]+)''', 'g'))[1] AS v
                  FROM pg_constraint c
                 WHERE c.conrelid = 'public.atendimentos_plantao'::regclass
                   AND c.conname = 'atendimentos_plantao_tipo_check') x),
       'presencial,remoto'

UNION ALL
-- ══ 204: OS QUATRO CHECK ESTÃO VALIDADOS ═════════════════════════════════
-- Uma constraint NOT VALID aparece no catálogo, casa a 203 e não protege uma
-- linha sequer. É o modo silencioso de esta migration virar decoração.
SELECT 204, 'CRÍTICO: os quatro CHECK estão VALIDADOS — NOT VALID passaria pela conferência acima protegendo nada',
       (SELECT string_agg(c.conname || '=' || c.convalidated::text, ' | ' ORDER BY c.conname)
          FROM pg_constraint c
         WHERE c.conrelid = 'public.atendimentos_plantao'::regclass AND c.contype = 'c'),
       'atendimentos_plantao_cliente_informado_check=true | atendimentos_plantao_cliente_uma_forma=true | atendimentos_plantao_descricao_check=true | atendimentos_plantao_tipo_check=true'

UNION ALL
-- ══ 205: AS CINCO FKs, COM A AÇÃO DE CADA UMA ════════════════════════════
-- 'a' = NO ACTION, 'r' = RESTRICT, 'c' = CASCADE, 'n' = SET NULL.
-- CASCADE em plantonista_id levaria junto o registro de quem trabalhou às 2h da
-- manhã ao se apagar um usuário; CASCADE em chamado_id apagaria o atendimento
-- quando o chamado morresse. As duas são RESTRICT de propósito.
SELECT 205, 'CRÍTICO: plantonista/cliente/chamado são RESTRICT (o histórico de quem trabalhou de madrugada não some junto com um cadastro) e os dois carimbos são SET NULL',
       (SELECT string_agg(a.attname || '=' || c.confdeltype::text, ' | ' ORDER BY a.attname)
          FROM pg_constraint c
          JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
         WHERE c.conrelid = 'public.atendimentos_plantao'::regclass AND c.contype = 'f'),
       'alterado_por=n | chamado_id=r | cliente_id=r | plantonista_id=r | registrado_por=n'

UNION ALL
-- ══ 206: RLS LIGADA ══════════════════════════════════════════════════════
SELECT 206, 'CRÍTICO: RLS está LIGADA em public.atendimentos_plantao — sem ela a tabela é pública para qualquer portador da chave do .env VERSIONADO',
       (SELECT c.relrowsecurity::text FROM pg_class c WHERE c.oid = 'public.atendimentos_plantao'::regclass),
       'true'

UNION ALL
-- ══ 207: A POLICY, CLASSIFICADA E NÃO COPIADA ════════════════════════════
-- `pg_get_expr` decide sozinho se qualifica `public.is_gestor` conforme o
-- search_path de quem lê; comparar a string crua faria esta linha depender de
-- quem abriu o editor. O que importa é a CLASSE. O ramo `true` continua
-- NOMEADO: se alguém afrouxar a policy, esta linha diz `todos` em vez de sumir.
-- E o ramo `chamado` também: se alguém trocar o predicado por
-- pode_acessar_chamado, a linha muda de valor em vez de continuar verde.
SELECT 207, 'CRÍTICO: só o DONO da linha e quem responde pela operação leem, e ambos precisam de vínculo vivo. NÃO é `true` e NÃO é pode_acessar_chamado — aquela abre a fila sem dono para qualquer autenticado (s2:152-155)',
       (SELECT string_agg(p.policyname || ':' ||
                 CASE WHEN p.qual = 'true' THEN 'todos'
                      WHEN p.qual LIKE '%pode_acessar_chamado%' THEN 'chamado'
                      WHEN p.qual LIKE '%plantonista_id = auth.uid()%'
                       AND p.qual LIKE '%is_gestor%'
                       AND p.qual LIKE '%pendente_aprovacao%' THEN 'dono+gestor+vinculo'
                      ELSE COALESCE(p.qual, '(sem qual)') END, ' | ' ORDER BY p.policyname)
          FROM pg_policies p
         WHERE p.schemaname = 'public' AND p.tablename = 'atendimentos_plantao'),
       'atendimentos_plantao_select:dono+gestor+vinculo'

UNION ALL
-- ══ 208: A TABELA É SÓ-LEITURA NO NAVEGADOR ══════════════════════════════
-- "Não escrevi um GRANT" não é o mesmo que "não há GRANT" — um ALTER DEFAULT
-- PRIVILEGES do bootstrap do projeto tornaria a tabela escrevível e a porta
-- única viraria uma peça só. Aqui se mede o privilégio EFETIVO.
SELECT 208, 'CRÍTICO: authenticated LÊ e NÃO escreve direto — toda escrita passa por plantao_salvar / plantao_apagar',
       (SELECT string_agg(x.op || '=' || x.pode::text, ' | ' ORDER BY x.op)
          FROM (SELECT 'delete' AS op, has_table_privilege('authenticated', 'public.atendimentos_plantao', 'DELETE') AS pode
                UNION ALL SELECT 'insert', has_table_privilege('authenticated', 'public.atendimentos_plantao', 'INSERT')
                UNION ALL SELECT 'select', has_table_privilege('authenticated', 'public.atendimentos_plantao', 'SELECT')
                UNION ALL SELECT 'update', has_table_privilege('authenticated', 'public.atendimentos_plantao', 'UPDATE')) x),
       'delete=false | insert=false | select=true | update=false'

UNION ALL
-- ══ 209: NEM anon NEM PUBLIC EXECUTAM AS DUAS PORTAS ═════════════════════
-- EXECUTE é concedido a PUBLIC por padrão e `anon` herda. Uma SECURITY DEFINER
-- sem REVOKE é um /rest/v1/rpc/<nome> aberto ao mundo. `to_regrole` guarda
-- contra um ambiente sem o papel — uma conferência não pode ser o motivo de o
-- DDL não aplicar.
SELECT 209, 'CRÍTICO: nem anon nem PUBLIC executam plantao_salvar / plantao_apagar — SECURITY DEFINER sem REVOKE é endpoint REST aberto',
       (SELECT string_agg(x.nome || '=' || x.pode::text, ' | ' ORDER BY x.nome)
          FROM (SELECT 'apagar' AS nome,
                       (to_regrole('anon') IS NOT NULL
                        AND has_function_privilege('anon', 'public.plantao_apagar(uuid)', 'EXECUTE')) AS pode
                UNION ALL
                SELECT 'salvar',
                       (to_regrole('anon') IS NOT NULL
                        AND has_function_privilege('anon', 'public.plantao_salvar(timestamptz,uuid,text,text,uuid,text,uuid,uuid)', 'EXECUTE'))) x),
       'apagar=false | salvar=false'

UNION ALL
SELECT 210, 'CRÍTICO: e authenticated executa as duas — sem isto o painel abre e nenhum botão funciona',
       (SELECT string_agg(x.nome || '=' || x.pode::text, ' | ' ORDER BY x.nome)
          FROM (SELECT 'apagar' AS nome,
                       (to_regrole('authenticated') IS NOT NULL
                        AND has_function_privilege('authenticated', 'public.plantao_apagar(uuid)', 'EXECUTE')) AS pode
                UNION ALL
                SELECT 'salvar',
                       (to_regrole('authenticated') IS NOT NULL
                        AND has_function_privilege('authenticated', 'public.plantao_salvar(timestamptz,uuid,text,text,uuid,text,uuid,uuid)', 'EXECUTE'))) x),
       'apagar=true | salvar=true'

UNION ALL
-- ══ 211: O GATILHO DA PROJEÇÃO ESTÁ ARMADO, E É BEFORE ═══════════════════
-- `tgtype = 23` é ROW(1) + BEFORE(2) + INSERT(4) + UPDATE(16). Um AFTER
-- existiria no catálogo e não escreveria `dia` nenhum; um DISABLE deixaria o
-- objeto lá e a promessa no chão. Medir a EXISTÊNCIA não basta.
SELECT 211, 'CRÍTICO: o gatilho que projeta `dia` e trunca `hora` está ARMADO e é BEFORE INSERT OR UPDATE FOR EACH ROW — é ele que impede a segunda verdade sobre "de que dia foi esse plantão"',
       (SELECT g.tgtype::text || '/' || g.tgenabled::text
          FROM pg_trigger g
         WHERE g.tgrelid = 'public.atendimentos_plantao'::regclass
           AND g.tgname = 'trg_atendimento_plantao_carimbo'
           AND NOT g.tgisinternal),
       '23/O'

UNION ALL
-- ══ 212: OS QUATRO ÍNDICES ═══════════════════════════════════════════════
-- O do duplo toque é o único ÚNICO, e ele é medido junto com a expressão: um
-- índice sobre (plantonista_id, hora) sem o md5 travaria dois atendimentos
-- legítimos no mesmo minuto, e um sem a truncagem do gatilho não pegaria nada.
SELECT 212, 'CRÍTICO: os quatro índices existem, e o do duplo toque é ÚNICO e inclui o md5 da descrição (sem ele, dois atendimentos legítimos no mesmo minuto ficariam travados)',
       (SELECT string_agg(i.relname || '=' || x.indisunique::text, ' | ' ORDER BY i.relname)
          FROM pg_index x JOIN pg_class i ON i.oid = x.indexrelid
         WHERE x.indrelid = 'public.atendimentos_plantao'::regclass),
       'atendimentos_plantao_chamado_idx=false | atendimentos_plantao_dia_idx=false | atendimentos_plantao_pessoa_idx=false | atendimentos_plantao_pkey=true | atendimentos_plantao_sem_duplo_toque=true'

UNION ALL
SELECT 213, 'CRÍTICO: e o índice do duplo toque é mesmo sobre md5(lower(btrim(descricao))) — a expressão, e não só o nome',
       (SELECT (pg_get_indexdef(x.indexrelid) LIKE '%md5(lower(btrim(descricao)))%')::text
          FROM pg_index x JOIN pg_class i ON i.oid = x.indexrelid
         WHERE x.indrelid = 'public.atendimentos_plantao'::regclass
           AND i.relname = 'atendimentos_plantao_sem_duplo_toque'),
       'true'

UNION ALL
-- ══ 214: `chamados` NÃO GANHOU UMA QUARTA NATUREZA ═══════════════════════
-- O CONJUNTO extraído do CHECK VIVO, e não a string renderizada: `natureza` é
-- `text` (u7:88), e o deparse de uma coluna `varchar` é OUTRO. Uma conferência
-- que pinasse a renderização de varchar ficaria vermelha num banco correto.
SELECT 214, 'CRÍTICO: chamados.natureza continua com EXATAMENTE três valores — esta entrega recusou a quarta natureza, e a recusa é medida no CHECK vivo, não na promessa do cabeçalho',
       (SELECT string_agg(x.v, ',' ORDER BY x.v)
          FROM (SELECT DISTINCT
                       (regexp_matches(pg_get_constraintdef(c.oid), '''([a-z_]+)''', 'g'))[1] AS v
                  FROM pg_constraint c
                 WHERE c.conrelid = 'public.chamados'::regclass
                   AND c.conname = 'chamados_natureza_check') x),
       'campo,comercial,interno'

UNION ALL
-- ══ 215: NENHUMA COLUNA NOVA EM `chamados` E EM `cobrancas` ══════════════
-- A tabela é FOLHA. Se um dia alguém acrescentar `chamados.atendimento_plantao_id`
-- ou `cobrancas.atendimento_plantao_id`, esta linha acende — e é o momento de
-- reler o P19 e o P50 antes de continuar.
SELECT 215, 'CRÍTICO: nem chamados nem cobrancas ganharam coluna apontando para o plantão — a tabela é FOLHA, e é isso que a torna reversível por um DROP TABLE',
       (SELECT count(*)::text FROM pg_attribute a
         WHERE a.attrelid IN ('public.chamados'::regclass, 'public.cobrancas'::regclass)
           AND a.attnum > 0 AND NOT a.attisdropped
           AND a.attname ~ 'plantao'),
       '0'

UNION ALL
-- ══ 216: O PORTÃO NÃO DEIXOU LIXO ════════════════════════════════════════
-- Ele escreveu em 1900 nas DUAS tabelas (atendimentos e escala) e apagou. Se
-- algum destes números não for 0, há dado INVENTADO em produção — e o da escala
-- entraria no total do mês de alguém.
SELECT 216, 'CRÍTICO: nenhuma linha de teste sobreviveu ao portão, nem aqui nem na escala que ele tocou',
       (SELECT (SELECT count(*) FROM public.atendimentos_plantao a WHERE a.dia < DATE '1990-01-01')::text
               || '/' ||
               (SELECT count(*) FROM public.sobreaviso s WHERE s.dia < DATE '1990-01-01')::text),
       '0/0'

UNION ALL
-- ══ 217: ESTA MIGRATION NÃO CRIA CHAVE DE TELA ═══════════════════════════
-- Não há rota nova: a porta de entrada é a TERCEIRA opção do "+" da Início
-- (R91), que já existe no celular de propósito. `telas.ts` diz que "uma tela
-- existe quando existe rota" — uma chave em permissoes_tela sem rota seria
-- órfã nos dois sentidos, e é por isso que esta migration NÃO entra em
-- ARQUIVOS_SEMENTE no verificador. Este número mede a decisão em vez de
-- deixá-la como omissão.
SELECT 217, 'CRÍTICO: nenhuma chave `plantao` em permissoes_tela — não há rota nova (a porta é a terceira opção do "+" da Início, R91), e chave sem rota é órfã',
       (SELECT count(*)::text FROM public.permissoes_tela p WHERE p.tela ~ 'plantao'),
       '0'

UNION ALL
-- ══ 218: REFERÊNCIA — quantos atendimentos existem ═══════════════════════
SELECT 218, 'referência: total de atendimentos de plantão na tabela (numa execução limpa é 0 — esta migration não semeia dado operacional nenhum)',
       (SELECT count(*)::text FROM public.atendimentos_plantao),
       '(referência)'

UNION ALL
-- ══ 219: REFERÊNCIA — o censo, e ele DECLARA O PRÓPRIO RECORTE ═══════════
-- Recorte: os atendimentos do MÊS CORRENTE por `dia` (a projeção, não a hora),
-- contados por tipo. Ele NÃO julga: não existe um número "certo" de
-- atendimentos de plantão por mês, e chumbar um faria esta coluna acender todo
-- mês em que a operação foi tranquila.
SELECT 219, 'referência: atendimentos por tipo no mês corrente (recorte: linhas cujo `dia` cai no mês atual, TODOS os plantonistas). Não há número certo — é distribuição para o olho humano',
       (SELECT COALESCE(string_agg(x.rot, ' · ' ORDER BY x.rot), '(mês sem atendimento)')
          FROM (SELECT a.tipo || '=' || count(*)::text AS rot
                  FROM public.atendimentos_plantao a
                 WHERE a.dia >= date_trunc('month', current_date)::date
                   AND a.dia <  (date_trunc('month', current_date) + INTERVAL '1 month')::date
                 GROUP BY a.tipo) x),
       '(referência)'

  ) t
 ORDER BY t.ordem;

COMMIT;

-- ╔═════════════════════════════════════════════════════════════════════════╗
-- ║ DESFAZER — e ele QUEBRA O FRONT, de propósito.                          ║
-- ║                                                                          ║
-- ║ Depois que o push subir, o painel de plantão do "+" da Início chama as   ║
-- ║ duas RPCs e lê a tabela. Rodar o bloco abaixo com o código no ar devolve ║
-- ║ PGRST205 ao abrir o painel. A ordem do desfazer é a INVERSA da do        ║
-- ║ deploy: reverta o commit do código PRIMEIRO, e só então rode isto.       ║
-- ║                                                                          ║
-- ║ O QUE ELE NÃO ALCANÇA: os atendimentos já registrados. O DROP TABLE os   ║
-- ║ leva junto e não há de onde recuperá-los — é registro de trabalho de     ║
-- ║ madrugada. Se já houver linha, EXPORTE antes (a conferência 218 diz      ║
-- ║ quantas).                                                                ║
-- ║                                                                          ║
-- ║   BEGIN;                                                                 ║
-- ║   -- 0) CONFERIR ANTES: quantos atendimentos seriam perdidos             ║
-- ║   SELECT count(*) AS linhas, min(dia) AS primeiro, max(dia) AS ultimo    ║
-- ║     FROM public.atendimentos_plantao;                                    ║
-- ║   DROP FUNCTION IF EXISTS public.plantao_apagar(uuid);                   ║
-- ║   DROP FUNCTION IF EXISTS                                                ║
-- ║     public.plantao_salvar(timestamptz,uuid,text,text,uuid,text,uuid,uuid); ║
-- ║   DROP TRIGGER  IF EXISTS trg_atendimento_plantao_carimbo                ║
-- ║     ON public.atendimentos_plantao;                                      ║
-- ║   DROP FUNCTION IF EXISTS public.atendimento_plantao_carimbo();          ║
-- ║   DROP TABLE    IF EXISTS public.atendimentos_plantao;                   ║
-- ║   COMMIT;                                                                ║
-- ║                                                                          ║
-- ║ NÃO HÁ LINHA DE permissoes_tela A APAGAR: esta entrega não criou chave   ║
-- ║ de tela (conferência 217). E NÃO há nada a desfazer em `chamados`, em    ║
-- ║ `cobrancas` nem em `sobreaviso` — a tabela é FOLHA, e é essa a única     ║
-- ║ razão de o desfazer caber em seis linhas.                                ║
-- ╚═════════════════════════════════════════════════════════════════════════╝
