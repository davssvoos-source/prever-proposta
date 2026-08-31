-- ═══════════════════════════════════════════════════════════════════════════
-- U76 — A DUPLA VIRA EQUIPE DE CAMPO: VEÍCULO E COMPOSIÇÃO POR SEMANA
--        (R96/R97 — Fase 1, Passo 1 da absorção do Gestor OS)
--
-- Davi, 2026-08-31: "a dupla EVOLUI para equipe de campo com composição
-- semanal, em vez de nascer um segundo conceito de turma."
--
-- >>> RODAR NO SQL EDITOR DO SUPABASE, À MÃO. Idempotente: rodar de novo é
-- >>> no-op (o backfill só semeia num banco SEM escala nenhuma).
-- >>> ESTA MIGRATION E O CÓDIGO NOVO VÃO JUNTOS — ver "A JANELA DE DEPLOY".
--
-- ── A PALAVRA "EQUIPE" ESTÁ OCUPADA E CONTINUA OCUPADA ─────────────────────
-- `chamados.equipe`, `profiles.equipe`, `chamado_equipes` e src/lib/equipes.ts
-- significam DEPARTAMENTO (ti|patrimonio|tecnica|comercial|sac|monitoramento|
-- outras) desde a U71. A turma de campo NÃO pode roubar essa palavra no banco:
-- a tabela continua `duplas` e a escala é `duplas_escala`. "Equipe de campo" é
-- rótulo de TELA. Renomear a tabela seria caro pelo lado errado — rename leva
-- os gatilhos mas NÃO reescreve o corpo deles, e não renomeia constraint
-- nenhuma (a cicatriz que `chamado_apoios` exibe até hoje: o PK dela ainda se
-- chama `demanda_apoios_pkey`, herdado do rename da U7).
--
-- ── O DEFEITO QUE ESTA MIGRATION EXISTE PARA CONSERTAR ─────────────────────
-- Hoje a composição da dupla é um ESTADO ATUAL sem eixo de tempo. O gráfico
-- "atividades por dupla" resolve a dupla de CADA chamado das 12 semanas com a
-- composição de HOJE — então trocar o Luan de dupla reescreve o gráfico de
-- todas as semanas passadas, em silêncio. É o mesmo defeito que a U64 evitou
-- para o APOIO ("usar a dupla de hoje em chamado antigo é o erro que a decisão
-- de gravar evita") e que sobrou na dupla. A escala semanal troca um estado
-- implícito e mutante por uma SÉRIE TEMPORAL explícita: depois daqui, a
-- composição da semana 30 está escrita, e lançar a escala da semana 36 não
-- alcança.
--
-- ── POR QUE OS ÍNDICES ÚNICOS DA U47 PRECISAM SAIR ─────────────────────────
-- `duplas_membro_a_unico` e `duplas_membro_b_unico` (ambos `WHERE ativa`)
-- afirmam "a pessoa está numa dupla ativa só, para sempre". Com escala semanal
-- isso é FALSO POR CONSTRUÇÃO: a mesma pessoa em turmas diferentes em semanas
-- diferentes é o recurso pedido, não um defeito a barrar — e os dois índices
-- travariam o primeiro remanejamento, inclusive o que a tela antiga faz pela
-- ponte do §7. Junto com eles sai `trg_duplas_valida_membros`, que existia por
-- um motivo só: o formato de DUAS COLUNAS escondia o "caso cruzado" (a pessoa
-- como membro_a de uma turma e membro_b de outra), que índice nenhum pegava
-- porque cada um via uma ocorrência só. Uma LINHA POR PESSOA dissolve o caso
-- cruzado — é uma coluna só — e a regra inteira vira a CHAVE PRIMÁRIA
-- (semana, pessoa_id) de `duplas_escala`. Trocamos três mecanismos frágeis
-- (dois índices parciais + um gatilho plpgsql com early-return) por um
-- declarativo, que não tem early-return, não tem search_path e não pode ser
-- desligado com DISABLE TRIGGER numa carga. De quebra a turma perde o teto de
-- duas pessoas — que é o que "equipe de campo" quer dizer — sem DDL a mais.
-- Nada é dropado antes de o §5 provar, nome por nome, que a escala nova
-- reproduz a composição antiga; e o DESFAZER nível 1 recria os dois.
--
-- ── A HERANÇA É DA SEMANA INTEIRA, NÃO DE CADA TURMA ───────────────────────
-- Esta é a decisão menos óbvia do arquivo, e ela existe para a unicidade
-- sobreviver à RESOLUÇÃO. Se cada turma herdasse por conta própria: turma A
-- escrita em S30 (Breno dentro), turma B escrita em S32 (Breno dentro). Em S32
-- a turma A ainda herdaria a linha de S30 — e o Breno estaria em DUAS turmas
-- na mesma semana resolvida. Índice nenhum pega, porque as duas linhas moram
-- em semanas diferentes; e o `Set jaListados` de `porGrupo`
-- (chamados.programacao.tsx:178) listaria a OS na primeira turma por ordem de
-- nome e engoliria a segunda, sem erro e sem aviso.
-- Com herança de semana inteira a semana resolvida é UMA só, e dentro dela a
-- PK (semana, pessoa_id) é garantia COMPLETA.
--
-- ── "SEMANA ABERTA" É UM FATO DECLARADO, NÃO UM PALPITE ────────────────────
-- Consequência da herança de grade: escrever UMA turma numa semana virgem
-- faria as OUTRAS sumirem daquela semana. Por isso existe
-- `duplas_escala_semanas` — uma linha por semana DECIDIDA. Ela é o âncora da
-- herança (`max(semana) <= W` roda sobre ELA, não sobre as linhas), e é o que
-- distingue "semana ainda não decidida" de "turma deliberadamente vazia nesta
-- semana": a primeira não tem linha na tabela de semanas, a segunda tem a
-- semana aberta e nenhuma linha de escala para aquela turma. Sem esse
-- marcador, a ausência significaria as duas coisas ao mesmo tempo e a próxima
-- materialização ressuscitaria a turma que o gestor tinha esvaziado.
-- LER NUNCA ABRE SEMANA. Passear pelo calendário não pode congelar o futuro:
-- só `abrir_escala_semana()` e `escala_definir()` abrem, e só gestor.
--
-- ── A JANELA DE DEPLOY (o aviso que a U13 já precisou dar) ─────────────────
-- >>> Esta migration e o código novo vão JUNTOS <<<
-- A verdade muda de lugar: `duplas.membro_a/membro_b` viram ESPELHO LEGADO e
-- nenhum resolvedor os lê. Entre "o Davi roda o SQL" e "o deploy sobe" a tela
-- antiga (dois <select>) continua no ar, e sem ponte o gestor editaria a
-- dupla, veria "Dupla atualizada." e nada mudaria onde importa — o pior dos
-- fins, porque é silencioso. Por isso o §7 traz
-- `trg_duplas_espelhar_na_escala`, que converte o que a tela antiga escreve na
-- escala da SEMANA CORRENTE e RECUSA (não sobrescreve) quando aquela semana já
-- foi lançada pela porta nova.
-- ORDEM CORRETA: migration primeiro, deploy depois. A ponte e as duas colunas
-- caem no Passo 2, no MESMO deploy que remove o DialogoDuplas antigo.
--
-- ── O QUE NÃO MUDA ─────────────────────────────────────────────────────────
-- `chamados.dupla_id` continua não existindo, de propósito. A turma de um
-- chamado continua DERIVADA do responsável — o que ganha data é a derivação,
-- não a fonte. E a invariante do CLAUDE.md fica de pé: o APOIO continua
-- GRAVADO em `chamado_apoios` com origem='dupla' no momento da atribuição.
-- Esta migration NÃO escreve, apaga ou altera UMA LINHA de `chamado_apoios`, e
-- a conferência prova isso com contagem antes × depois. A frase da U64 ("NÃO
-- HÁ BACKFILL, DE PROPÓSITO") continua inteira.
--
-- ── ORDEM DAS SEÇÕES (é segurança, não estilo) ─────────────────────────────
--   §1 veículo (aditivo)
--   §2 as duas tabelas novas + RLS      ← a garantia NOVA nasce primeiro
--   §3 funções de LEITURA
--   §4 funções de ESCRITA (abrir / definir)
--   §5 backfill de uma vez só + PORTÃO  ← prova antes de destruir
--   §6 os DROPs da U47                  ← só depois do portão passar
--   §7 gatilhos em `duplas` (updated_at, desativar, ponte)
--   §8 o apoio automático, agora pela semana do chamado
--   §9 conferência
-- Tudo em UMA transação: DDL no Postgres é transacional, então qualquer RAISE
-- (inclusive o do portão) devolve índices, gatilhos e linhas ao estado exato
-- de antes. O BEGIN/COMMIT também é obrigatório porque o DROP de
-- `parceiro_da_dupla(uuid)` e a troca do corpo de `chamado_apoio_da_dupla()`
-- têm de aterrissar juntos.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- §0) FOTO DE ANTES — a afirmação mais importante daqui é NEGATIVA
-- ═══════════════════════════════════════════════════════════════════════
-- "Nada em chamado_apoios é criado, apagado ou alterado" se prova com número,
-- não com promessa. ON COMMIT DROP porque temp table sem isso sobrevive ao
-- COMMIT e fica pendurada na sessão do pool do SQL Editor — o padrão da casa
-- está na U65 (`_seed`, `_tecnicos`, `_clientes`).
CREATE TEMP TABLE _u76_antes ON COMMIT DROP AS
SELECT (SELECT count(*) FROM public.chamado_apoios)                         AS apoios_total,
       (SELECT count(*) FROM public.chamado_apoios WHERE origem = 'dupla')  AS apoios_dupla,
       (SELECT count(*) FROM public.chamado_apoios WHERE origem = 'manual') AS apoios_manual;

-- ═══════════════════════════════════════════════════════════════════════
-- §1) O VEÍCULO — é da TURMA, não da semana
-- ═══════════════════════════════════════════════════════════════════════
-- Texto livre de propósito: não existe cadastro de frota neste sistema, e
-- criar uma tabela `veiculos` para guardar "Fiorino branca / BRA-2E19" seria
-- trocar um campo por um cadastro que ninguém pediu. Fica em `duplas` porque
-- o carro acompanha a turma; quem gira toda semana é a COMPOSIÇÃO. No dia em
-- que o veículo passar a variar por semana, ele desce para `duplas_escala` e
-- esta coluna vira o padrão da turma.
ALTER TABLE public.duplas ADD COLUMN IF NOT EXISTS veiculo text;

COMMENT ON COLUMN public.duplas.veiculo IS
  'Veículo que a turma leva a campo — placa, modelo ou apelido, texto livre. '
  'Pertence à TURMA, não à semana. ATENÇÃO: src/features/duplas/data.ts lista '
  'as colunas do SELECT à mão (a constante CAMPOS), então esta coluna só chega '
  'ao cliente depois de entrar naquela string.';

COMMENT ON TABLE public.duplas IS
  'Equipe de campo (U47/R56, evoluída na U76). NOME e VEÍCULO são da turma; a '
  'COMPOSIÇÃO é POR SEMANA e mora em public.duplas_escala. A turma de um '
  'chamado continua DERIVADA do responsável — não existe chamados.dupla_id, e '
  'continua não existindo de propósito. Na tela o rótulo é "Equipe de campo"; '
  'no banco a palavra "equipe" está ocupada por DEPARTAMENTO desde a U71.';

-- ═══════════════════════════════════════════════════════════════════════
-- §2) AS DUAS TABELAS: a semana DECIDIDA, e quem está em quê
-- ═══════════════════════════════════════════════════════════════════════

-- ── 2.1 A SEMANA ABERTA ────────────────────────────────────────────────────
-- Uma linha aqui = "alguém decidiu esta semana". É o ÂNCORA DA HERANÇA: a
-- pergunta "de qual semana sai a escala que vale em W" é respondida por
-- max(semana) <= W SOBRE ESTA TABELA, e não sobre as linhas de escala. Três
-- consequências que o desenho aproveita:
--   · turma deliberadamente vazia numa semana é representável (a semana está
--     aberta e a turma não tem linha) — sem isto, a próxima materialização
--     ressuscitaria a turma que o gestor esvaziou;
--   · a herança não depende de `duplas.ativa`: desfazer uma turma não pode
--     tornar uma semana inteira inalcançável e jogar o retrato de um bloco
--     contíguo de semanas para outra época;
--   · o backfill fica trancado numa execução só — "existe alguma semana
--     aberta?" é a pergunta exata que decide se ele semeia.
--
-- COLLATE "C" não é decoração: a herança inteira é `max(semana)` e
-- `semana <= W`, ou seja, ordem ALFABÉTICA fazendo as vezes de ordem
-- CRONOLÓGICA. Isso vale porque 'AAAA-SNN' é largura fixa, zero-padded e com
-- ANO ISO na frente ('2025-S52' < '2026-S01'), mas só é garantido byte a byte;
-- "C" prende a comparação ao byte e tira o calendário das mãos do locale.
CREATE TABLE IF NOT EXISTS public.duplas_escala_semanas (
  semana     text COLLATE "C" NOT NULL,
  -- de onde veio a decisão. Mesmo truque de chamado_apoios.origem (U64):
  -- separar o que uma pessoa decidiu do que o sistema presumiu.
  --   backfill = a U76 congelou o cadastro fixo (ninguém confirmou)
  --   herdada  = abrir_escala_semana() copiou a semana anterior
  --   espelho  = a tela ANTIGA (membro_a/membro_b) escreveu por aqui
  --   manual   = alguém lançou pela porta nova (escala_definir)
  origem     text NOT NULL DEFAULT 'manual',
  aberta_em  timestamptz NOT NULL DEFAULT now(),
  aberta_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT duplas_escala_semanas_pkey PRIMARY KEY (semana),
  CONSTRAINT duplas_escala_semanas_formato
    CHECK (semana ~ '^[0-9]{4}-S(0[1-9]|[1-4][0-9]|5[0-3])$'),
  CONSTRAINT duplas_escala_semanas_origem_check
    CHECK (origem IN ('backfill','herdada','espelho','manual'))
);

COMMENT ON TABLE public.duplas_escala_semanas IS
  'As semanas cuja escala já foi DECIDIDA (U76). É o âncora da herança: a '
  'escala que vale em W é a da maior semana aberta <= W, e NUNCA de uma '
  'futura. A semana 0001-S01 é o MARCO ZERO — anterior a qualquer data real, '
  'existe para que todo o passado herde a composição do dia da migração, que é '
  'exatamente o que os gráficos já desenhavam. LER NÃO ABRE SEMANA.';

-- ── 2.2 A COMPOSIÇÃO ───────────────────────────────────────────────────────
-- UMA LINHA POR PESSOA POR SEMANA, e a CHAVE PRIMÁRIA (semana, pessoa_id) É A
-- REGRA: "a pessoa está em uma turma só por semana" deixa de ser trigger e
-- vira chave. Não é `(dupla_id, semana, membro_a, membro_b)` — a turma de
-- campo não é capada em dois, e o terceiro (ajudante, alguém cobrindo férias)
-- é justamente o caso que o modelo fixo não sabia dizer. `chamado_apoios` já
-- aceita N apoios por chamado; o gargalo era só aqui.
--
-- A FK de `semana` é o que torna impossível escrever escala numa semana que
-- ninguém abriu — inclusive por SQL escrito à mão no editor. O gatilho do §2.3
-- existe só para trocar o erro cru de FK por uma frase que se entende.
--
-- SEM coluna `ativa` aqui: "desfazer a turma" é um FATO DATADO — a partir da
-- semana seguinte ela não aparece mais na escala, e as semanas anteriores
-- continuam contando a história delas.
CREATE TABLE IF NOT EXISTS public.duplas_escala (
  semana     text COLLATE "C" NOT NULL
             REFERENCES public.duplas_escala_semanas(semana) ON DELETE CASCADE,
  pessoa_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  -- RESTRICT, e não CASCADE: `duplas_write` é FOR ALL e a U47 concedeu DELETE
  -- em public.duplas — com CASCADE, um DELETE de turma levaria junto TODA a
  -- história de composição dela, semanas passadas inclusive. A doutrina da
  -- casa desde a U47 é DESATIVAR, NÃO APAGAR; que o banco grite.
  dupla_id   uuid NOT NULL REFERENCES public.duplas(id) ON DELETE RESTRICT,
  -- só exibição (quem aparece primeiro no chip). NÃO é regra: nenhuma
  -- unicidade e nenhuma leitura de composição dependem dela.
  ordem      smallint NOT NULL DEFAULT 1,
  origem     text NOT NULL DEFAULT 'manual',
  criada_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- PK nomeada à mão: a cicatriz de `demanda_apoios_pkey` existe porque o
  -- Postgres batizou sozinho e o rename da U7 não renomeia constraint. Aqui o
  -- nome já nasce certo.
  CONSTRAINT duplas_escala_pkey PRIMARY KEY (semana, pessoa_id),
  CONSTRAINT duplas_escala_origem_check
    CHECK (origem IN ('backfill','herdada','espelho','manual'))
);

-- "quem está na turma X na semana W" e "o histórico da turma X". A PK já cobre
-- o eixo (semana, pessoa); este cobre o eixo turma.
CREATE INDEX IF NOT EXISTS duplas_escala_dupla_idx
  ON public.duplas_escala (dupla_id, semana);

COMMENT ON TABLE public.duplas_escala IS
  'Composição da equipe de campo POR SEMANA (U76). A PK (semana, pessoa_id) É '
  'a regra "uma pessoa em uma turma só por semana" — ela substitui, sozinha, '
  'os dois índices parciais e o trigger do caso cruzado da U47. Semana sem '
  'linha própria HERDA a maior semana ABERTA anterior (ver '
  'public.duplas_escala_semanas) — nunca uma futura.';
COMMENT ON COLUMN public.duplas_escala.origem IS
  'backfill = a U76 congelou o cadastro fixo; herdada = copiada da semana '
  'anterior ao abrir; espelho = veio da tela ANTIGA (membro_a/membro_b); '
  'manual = lançada pela porta nova. A ponte do §7 recusa escrever numa semana '
  'que já tem linha manual — a decisão da tela nova vence a do espelho.';

-- ── 2.3 A FRASE QUE O ÍNDICE NÃO SABE DIZER ────────────────────────────────
-- Mesma divisão de trabalho da U47 (índice guarda a regra, gatilho guarda a
-- frase), só que agora o gatilho NÃO tem regra nenhuma dentro dele — e é isso
-- que o torna seguro. Ele não materializa nada: materializar dentro de gatilho
-- é o caminho para a herança desfazer, no meio de uma escrita, o DELETE que a
-- própria escrita acabou de fazer.
CREATE OR REPLACE FUNCTION public.duplas_escala_valida()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_outra text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.duplas_escala_semanas s WHERE s.semana = NEW.semana) THEN
    RAISE EXCEPTION 'A semana % ainda não foi aberta — chame public.abrir_escala_semana(%) antes. Escrever uma turma numa semana virgem faria as OUTRAS turmas sumirem dela.',
      NEW.semana, quote_literal(NEW.semana)
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  SELECT d.nome INTO v_outra
    FROM public.duplas_escala e
    JOIN public.duplas d ON d.id = e.dupla_id
   WHERE e.semana = NEW.semana
     AND e.pessoa_id = NEW.pessoa_id
     AND e.dupla_id <> NEW.dupla_id
   LIMIT 1;
  IF v_outra IS NOT NULL THEN
    RAISE EXCEPTION 'Este técnico já está na equipe "%" na semana % — tire-o de lá antes, ou use escala_definir(..., _mover => true).',
      v_outra, NEW.semana
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_duplas_escala_valida ON public.duplas_escala;
CREATE TRIGGER trg_duplas_escala_valida
  BEFORE INSERT OR UPDATE ON public.duplas_escala
  FOR EACH ROW EXECUTE FUNCTION public.duplas_escala_valida();

-- ── 2.4 RLS: mesmo desenho de `duplas` (U47) ───────────────────────────────
-- Leitura aberta ao time — o técnico precisa ver com quem sai, e a programação
-- e o gráfico leem isto em toda tela. Escrita de gestor, como o resto do
-- cadastro estrutural.
--
-- SEM GRANT DE UPDATE, de propósito: a linha é chave-toda mais auditoria. Um
-- UPDATE de pessoa_id manteria created_at/criada_por da linha original e o
-- registro passaria a mentir sobre quem escalou quem e quando. Mover alguém é
-- DELETE + INSERT, e quem faz isso é escala_definir() (SECURITY DEFINER, que
-- não passa por estes grants). É o mesmo raciocínio de chamado_apoios (U1/U7),
-- que também só nasce e morre.
ALTER TABLE public.duplas_escala_semanas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duplas_escala         ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.duplas_escala_semanas TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.duplas_escala         TO authenticated;
GRANT ALL ON public.duplas_escala_semanas TO service_role;
GRANT ALL ON public.duplas_escala         TO service_role;

DROP POLICY IF EXISTS "duplas_escala_semanas_select" ON public.duplas_escala_semanas;
DROP POLICY IF EXISTS "duplas_escala_semanas_write"  ON public.duplas_escala_semanas;
CREATE POLICY "duplas_escala_semanas_select" ON public.duplas_escala_semanas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "duplas_escala_semanas_write" ON public.duplas_escala_semanas
  FOR ALL TO authenticated
  USING (public.is_gestor(auth.uid()))
  WITH CHECK (public.is_gestor(auth.uid()));

DROP POLICY IF EXISTS "duplas_escala_select" ON public.duplas_escala;
DROP POLICY IF EXISTS "duplas_escala_write"  ON public.duplas_escala;
CREATE POLICY "duplas_escala_select" ON public.duplas_escala
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "duplas_escala_write" ON public.duplas_escala
  FOR ALL TO authenticated
  USING (public.is_gestor(auth.uid()))
  WITH CHECK (public.is_gestor(auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════
-- §3) AS FUNÇÕES DE LEITURA
-- ═══════════════════════════════════════════════════════════════════════
-- TODAS as SECURITY DEFINER daqui para baixo levam REVOKE de PUBLIC e anon.
-- Não é zelo: o modelo de ameaça escrito no cabeçalho da S1 diz que TODO
-- usuário fala direto com o Postgres usando a MESMA chave pública, que está
-- versionada no .env — EXECUTE é concedido a PUBLIC por padrão, e `anon`
-- herda. Uma SECURITY DEFINER sem REVOKE é um `/rest/v1/rpc/<nome>` aberto.

-- ── A CHAVE DA SEMANA ──────────────────────────────────────────────────────
-- Gêmea SQL de referenciaSemanal() (src/lib/periodos.ts) e a mesma máscara que
-- montar_fechamento() usa desde a U5. ANO ISO e não civil: 31/12/2025 é
-- 2026-S01 — com ano civil existiriam dois "2025-S01", um em janeiro e outro
-- em dezembro, e a U5 documenta o episódio.
--
-- UM argumento só, e é `date`. Não há sobrecarga (date, timestamptz) de
-- propósito: com as duas, um literal de texto sem cast resolveria para
-- timestamptz (o tipo PREFERIDO da categoria) sem avisar, e a conversão de
-- fuso escolheria a semana errada na fronteira. Quem tem timestamptz converte
-- na chamada, à vista, com (x AT TIME ZONE 'America/Sao_Paulo')::date.
CREATE OR REPLACE FUNCTION public.referencia_semanal(_dia date)
RETURNS text
LANGUAGE sql STABLE SET search_path = public
AS $$ SELECT to_char(_dia, 'IYYY-"S"IW'); $$;
REVOKE EXECUTE ON FUNCTION public.referencia_semanal(date) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.referencia_semanal(date) TO authenticated, service_role;

COMMENT ON FUNCTION public.referencia_semanal(date) IS
  'A semana ISO no formato AAAA-SNN (ANO ISO, não civil). Gêmea de '
  'referenciaSemanal() em src/lib/periodos.ts — este é o primeiro lugar em que '
  'o mesmo valor viaja do banco para a tela, e a virada de ano é onde importa.';

-- ── A DATA QUE MANDA, NUM LUGAR SÓ ─────────────────────────────────────────
-- É a do AGENDAMENTO, não a de hoje e não a de criação. A escala responde
-- "quem sai junto NAQUELA semana", e o atendimento acontece na semana em que
-- foi programado: se hoje é a S35 e eu programo para a S37, o par certo é o da
-- S37. É a MESMA data que o gráfico usa para jogar a atividade numa semana
-- (serieAtividadesPorDupla) — se o gráfico disser "esta OS é da S37" e o apoio
-- viesse da S35, painel e registro discordariam sobre o mesmo trabalho.
-- `created_at` foi descartada pelo motivo que o gráfico já registra: ela mede
-- quando a demanda ENTROU, não quando o trabalho CAI. Sem agendamento, ela é o
-- melhor palpite — e é autocorrigível, porque o gatilho reavalia quando a data
-- chega.
--
-- FUSO EXPLÍCITO, e esta é a armadilha mais cara do arquivo:
-- `data_hora_agendada` é timestamptz e o TimeZone da sessão no Supabase é UTC.
-- Domingo 22h em Brasília é 01h de SEGUNDA em UTC — cairia na SEMANA SEGUINTE.
-- Uma hora de fuso vira uma semana de erro, e só em agendamento noturno.
CREATE OR REPLACE FUNCTION public.dia_da_dupla(_agendada timestamptz, _criado timestamptz)
RETURNS date
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT COALESCE((_agendada AT TIME ZONE 'America/Sao_Paulo')::date,
                  (_criado   AT TIME ZONE 'America/Sao_Paulo')::date,
                  (now()     AT TIME ZONE 'America/Sao_Paulo')::date);
$$;
REVOKE EXECUTE ON FUNCTION public.dia_da_dupla(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.dia_da_dupla(timestamptz, timestamptz) TO authenticated, service_role;

COMMENT ON FUNCTION public.dia_da_dupla(timestamptz, timestamptz) IS
  'A data de referência do apoio automático: a do agendamento; a de criação do '
  'chamado quando ainda não há agendamento. Um lugar só, para gatilho, '
  'reconciliação e conferência não divergirem.';

-- ── A HERANÇA, EM UM OPERADOR ──────────────────────────────────────────────
-- `semana <= _semana` é a migration inteira num sinal. Com `<=` a escala nova
-- só alcança do seu ponto para a frente, e nenhuma semana já vivida muda de
-- resposta. Com a "mais próxima" (menor distância absoluta), uma escala do
-- FUTURO preencheria buraco no PASSADO e teríamos reconstruído, com outro
-- nome, exatamente o defeito que esta migration existe para consertar.
--
-- Roda sobre `duplas_escala_semanas` e NÃO faz join com `duplas.ativa`. Pôr o
-- filtro de turma ativa dentro da escolha de QUAL semana vence faria desfazer
-- uma turma apagar SEMANAS INTEIRAS da leitura: uma semana cujas únicas linhas
-- são de turmas depois desfeitas deixaria de vencer o max(), e o retrato de um
-- bloco contíguo de semanas cairia para outra época. Registro é registro; o
-- filtro de `ativa` só cabe onde a pergunta é sobre PLANO (ver
-- abrir_escala_semana).
--
-- NULL quando nenhuma semana anterior foi aberta — e NULL é a resposta
-- honesta, não "ninguém". Quem consome tem de tratar assim: o §8 devolve cedo
-- em vez de apagar apoio.
CREATE OR REPLACE FUNCTION public.escala_semana_vigente(_semana text)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT max(s.semana) FROM public.duplas_escala_semanas s WHERE s.semana <= _semana;
$$;
REVOKE EXECUTE ON FUNCTION public.escala_semana_vigente(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.escala_semana_vigente(text) TO authenticated, service_role;

COMMENT ON FUNCTION public.escala_semana_vigente(text) IS
  'A semana cuja escala vale em _semana: ela mesma, ou a aberta mais recente '
  'antes dela. NUNCA uma futura — é o <= que impede a escala nova de reescrever '
  'o passado. NULL = antes da primeira semana aberta (não sei ≠ ninguém).';

-- ── O RETRATO DA SEMANA ────────────────────────────────────────────────────
-- A porta ÚNICA de leitura: dupla_da_pessoa, parceiros_da_dupla, o gatilho de
-- apoio e o gráfico saem todos daqui, para não existirem duas respostas para
-- "quem estava com quem".
--
-- `herdada` é informação de tela, não enfeite: escala herdada é escala que
-- ninguém confirmou para aquela semana, e a programação precisa poder dizer
-- "escala herdada de 2026-S30" antes de o gestor confiar nela.
CREATE OR REPLACE FUNCTION public.escala_da_semana(_semana text)
RETURNS TABLE (dupla_id uuid, pessoa_id uuid, ordem smallint,
               semana_origem text, herdada boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.dupla_id, e.pessoa_id, e.ordem, e.semana,
         (e.semana IS DISTINCT FROM _semana)
    FROM public.duplas_escala e
   WHERE e.semana = public.escala_semana_vigente(_semana);
$$;
REVOKE EXECUTE ON FUNCTION public.escala_da_semana(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.escala_da_semana(text) TO authenticated, service_role;

-- ── A TURMA DE UMA PESSOA NUM DIA ──────────────────────────────────────────
-- Gêmea de duplaDaPessoa(), agora com data. Sem LIMIT 1 e sem "primeiro
-- achado": escala_da_semana devolve UMA semana e a PK (semana, pessoa_id)
-- garante no máximo uma linha. O comentário de modelo.ts sempre disse que o
-- primeiro achado é O achado "porque o banco garante" — agora garante mesmo.
CREATE OR REPLACE FUNCTION public.dupla_da_pessoa(_pessoa uuid, _quando date)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.dupla_id
    FROM public.escala_da_semana(public.referencia_semanal(_quando)) s
   WHERE s.pessoa_id = _pessoa;
$$;
REVOKE EXECUTE ON FUNCTION public.dupla_da_pessoa(uuid, date) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.dupla_da_pessoa(uuid, date) TO authenticated, service_role;

-- ── OS PARCEIROS (PLURAL) — é esta que o apoio usa ─────────────────────────
-- Com a turma podendo ter três, "o parceiro" deixou de ser pergunta bem-posta:
-- gravar só um perderia gente que foi ao prédio. `_pessoa` nulo devolve
-- conjunto vazio sem explodir — chamado sem responsável é o caso mais comum da
-- fila.
CREATE OR REPLACE FUNCTION public.parceiros_da_dupla(_pessoa uuid, _quando date)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH grade AS (
    SELECT * FROM public.escala_da_semana(public.referencia_semanal(_quando))
  )
  SELECT o.pessoa_id
    FROM grade eu
    JOIN grade o ON o.dupla_id = eu.dupla_id AND o.pessoa_id <> eu.pessoa_id
   WHERE eu.pessoa_id = _pessoa
   ORDER BY o.ordem, o.pessoa_id;
$$;
REVOKE EXECUTE ON FUNCTION public.parceiros_da_dupla(uuid, date) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.parceiros_da_dupla(uuid, date) TO authenticated, service_role;

COMMENT ON FUNCTION public.parceiros_da_dupla(uuid, date) IS
  'Todos os OUTROS membros da turma da pessoa na semana daquele dia. É esta que '
  'o apoio automático usa: turma de três grava dois apoios. Vazio quando não há '
  'turma, quando ela é de uma pessoa só, ou quando _pessoa é NULL.';

-- ── O PARCEIRO (SINGULAR) — o gêmeo do TS ──────────────────────────────────
-- Existe para parceiroDaDupla() (src/features/duplas/modelo.ts) poder ser
-- travado por asserção sem subir banco. Devolve NULL quando há ZERO parceiros
-- E TAMBÉM quando há dois ou mais: escolher um por sorte seria inventar, e a
-- doutrina do modelo.ts já diz que inventar um apoio é pior que deixar em
-- branco. Quem precisa da resposta completa usa a plural — inclusive o gatilho,
-- que é quem grava.
CREATE OR REPLACE FUNCTION public.parceiro_da_dupla(_pessoa uuid, _quando date)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE WHEN count(*) = 1 THEN (array_agg(p.pessoa_id))[1] END
    FROM public.parceiros_da_dupla(_pessoa, _quando) AS p(pessoa_id);
$$;
REVOKE EXECUTE ON FUNCTION public.parceiro_da_dupla(uuid, date) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.parceiro_da_dupla(uuid, date) TO authenticated, service_role;

COMMENT ON FUNCTION public.parceiro_da_dupla(uuid, date) IS
  'O outro membro da turma da pessoa NA SEMANA de _quando, ou NULL (sem escala, '
  'sozinha, ou mais de um par — aí a pergunta certa é parceiros_da_dupla). A '
  'versão de UM argumento foi removida na U76: sem data ela devolvia a '
  'composição de hoje para chamado de qualquer época.';

-- ═══════════════════════════════════════════════════════════════════════
-- §4) AS FUNÇÕES DE ESCRITA — as ÚNICAS que abrem semana
-- ═══════════════════════════════════════════════════════════════════════

-- ── ABRIR A SEMANA ─────────────────────────────────────────────────────────
-- Materializa o retrato herdado como linhas próprias. É o passo obrigatório
-- antes de editar, porque a herança é da GRADE: sem ele, gravar uma turma numa
-- semana virgem faria as outras sumirem daquela semana — perda de dado por
-- omissão, o pior tipo.
--
-- LEITURA NUNCA CHAMA ISTO. Se a tela materializasse ao abrir a semana,
-- passear até a S40 só para olhar congelaria a S40 com a composição de hoje —
-- e a partir dali toda mudança feita na S36 deixaria de chegar lá, sem erro e
-- sem aviso. Pior: como a herança é max() global, a S40 gravada por engano
-- viraria a origem de S41 em diante. A tela pinta com escala_da_semana(), que
-- já resolve a herança sem gravar nada, e mostra "herdada de Sxx".
--
-- Copia só turmas ATIVAS — aqui o filtro de `ativa` é legítimo, porque isto é
-- PLANO e não registro: uma turma desfeita não pode ressuscitar vinda do
-- passado. (No caminho de LEITURA o filtro não existe, de propósito.)
CREATE OR REPLACE FUNCTION public.abrir_escala_semana(_semana text)
RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_origem text; v_linhas int := 0;
BEGIN
  -- auth.uid() é NULL quando isto roda pela migration ou pelo SQL Editor
  -- (sem JWT) — aí o gate não faz sentido e passa.
  IF auth.uid() IS NOT NULL AND NOT public.is_gestor(auth.uid()) THEN
    RAISE EXCEPTION 'Só quem responde pela operação abre a escala de uma semana.'
      USING ERRCODE = '42501';
  END IF;
  IF _semana !~ '^[0-9]{4}-S(0[1-9]|[1-4][0-9]|5[0-3])$' THEN
    RAISE EXCEPTION 'Semana fora do formato AAAA-SNN: %', _semana;
  END IF;

  -- Já aberta: -1, e não 0. Os dois casos são diferentes e a tela precisa
  -- distinguir — "já estava aberta" × "abri e não havia de onde herdar".
  IF EXISTS (SELECT 1 FROM public.duplas_escala_semanas WHERE semana = _semana) THEN
    RETURN -1;
  END IF;

  v_origem := public.escala_semana_vigente(_semana);

  INSERT INTO public.duplas_escala_semanas (semana, origem, aberta_por)
  VALUES (_semana, CASE WHEN v_origem IS NULL THEN 'manual' ELSE 'herdada' END, auth.uid());

  IF v_origem IS NULL THEN
    RETURN 0;  -- semana aberta e vazia: não há passado de onde copiar
  END IF;

  INSERT INTO public.duplas_escala (semana, pessoa_id, dupla_id, ordem, origem, criada_por)
  SELECT _semana, e.pessoa_id, e.dupla_id, e.ordem, 'herdada', auth.uid()
    FROM public.duplas_escala e
    JOIN public.duplas d ON d.id = e.dupla_id AND d.ativa
   WHERE e.semana = v_origem
  ON CONFLICT ON CONSTRAINT duplas_escala_pkey DO NOTHING;

  GET DIAGNOSTICS v_linhas = ROW_COUNT;
  RETURN v_linhas;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.abrir_escala_semana(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.abrir_escala_semana(text) TO authenticated, service_role;

COMMENT ON FUNCTION public.abrir_escala_semana(text) IS
  'Materializa numa semana ainda fechada a escala herdada, para que editar UMA '
  'turma não deixe as outras sem composição. Devolve -1 se a semana já estava '
  'aberta (nada feito), 0 se abriu sem ter de onde herdar, ou o nº de linhas '
  'copiadas. LEITURA NÃO DEVE CHAMAR: abrir uma semana futura só para olhar '
  'congela a composição dela e corta a herança dali para a frente.';

-- ── A PORTA DE ESCRITA ─────────────────────────────────────────────────────
-- Abre a semana, tira quem saiu e põe quem entrou, em uma transação só. Existe
-- para a tela não ter de acertar a ORDEM das três operações: DELETE antes de
-- abrir não apaga nada, e INSERT antes de abrir faz a herança trazer de volta
-- quem acabou de ser tirado.
--
-- `_mover` é explícito de propósito. Com false (o padrão) a função levanta a
-- MESMA frase que o trigger da U47 levantava, dizendo em qual turma a pessoa
-- já está — roubar membro em silêncio é pior que atritar. A tela pergunta
-- ("Breno está na Equipe A — mover?") e só então passa true.
--
-- Array vazio é resposta legítima: "esta turma NÃO sai nesta semana". Como a
-- semana fica ABERTA, essa decisão sobrevive à próxima materialização — é o
-- caso que um desenho sem `duplas_escala_semanas` não sabe representar.
CREATE OR REPLACE FUNCTION public.escala_definir(_dupla uuid, _semana text,
                                                 _membros uuid[],
                                                 _mover boolean DEFAULT false)
RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_membros uuid[];
  v_outra   text;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_gestor(auth.uid()) THEN
    RAISE EXCEPTION 'Só quem responde pela operação lança a escala.'
      USING ERRCODE = '42501';
  END IF;

  -- Tira NULL e repetido ANTES de qualquer coisa: um <select> vazio no cliente
  -- manda {null}, e `profile_id = ANY (ARRAY[null])` é NULL — o DELETE não
  -- apagaria ninguém e o erro só apareceria lá na frente, no NOT NULL, com uma
  -- mensagem que não tem relação com o que o gestor fez.
  SELECT COALESCE(array_agg(DISTINCT x), '{}'::uuid[]) INTO v_membros
    FROM unnest(COALESCE(_membros, '{}'::uuid[])) AS x
   WHERE x IS NOT NULL;

  PERFORM public.abrir_escala_semana(_semana);

  IF _mover THEN
    DELETE FROM public.duplas_escala e
     WHERE e.semana = _semana
       AND e.dupla_id <> _dupla
       AND e.pessoa_id = ANY (v_membros);
  ELSE
    SELECT d.nome INTO v_outra
      FROM public.duplas_escala e
      JOIN public.duplas d ON d.id = e.dupla_id
     WHERE e.semana = _semana
       AND e.dupla_id <> _dupla
       AND e.pessoa_id = ANY (v_membros)
     LIMIT 1;
    IF v_outra IS NOT NULL THEN
      RAISE EXCEPTION 'Alguém desta lista já está na equipe "%" na semana % — confirme a mudança para movê-lo.',
        v_outra, _semana USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  DELETE FROM public.duplas_escala e
   WHERE e.dupla_id = _dupla
     AND e.semana = _semana
     AND NOT (e.pessoa_id = ANY (v_membros));

  INSERT INTO public.duplas_escala (semana, pessoa_id, dupla_id, ordem, origem, criada_por)
  SELECT _semana, m.id, _dupla, m.ord::smallint, 'manual', auth.uid()
    FROM unnest(v_membros) WITH ORDINALITY AS m(id, ord)
  ON CONFLICT ON CONSTRAINT duplas_escala_pkey
  DO UPDATE SET dupla_id = EXCLUDED.dupla_id,
                ordem    = EXCLUDED.ordem,
                origem   = 'manual';

  -- a semana passa a ser decisão de gente, não herança arrastada
  UPDATE public.duplas_escala_semanas SET origem = 'manual' WHERE semana = _semana;

  RETURN COALESCE(array_length(v_membros, 1), 0);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.escala_definir(uuid, text, uuid[], boolean) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.escala_definir(uuid, text, uuid[], boolean) TO authenticated, service_role;

COMMENT ON FUNCTION public.escala_definir(uuid, text, uuid[], boolean) IS
  'A porta única de escrita da escala: abre a semana, remove quem saiu e grava '
  'quem entrou, na ordem do array. Array vazio = a turma NÃO sai nesta semana '
  '(diferente de "semana fechada", que herda). _mover=false recusa roubar quem '
  'já está em outra turma naquela semana, nomeando-a.';

-- ═══════════════════════════════════════════════════════════════════════
-- §5) BACKFILL — DE UMA VEZ SÓ — E O PORTÃO
-- ═══════════════════════════════════════════════════════════════════════
-- ── A TRANCA ───────────────────────────────────────────────────────────────
-- O backfill semeia SOMENTE quando não existe semana aberta nenhuma. Sem essa
-- tranca, rodar a migration de novo semanas depois encontraria a semana
-- corrente fechada, semearia nela membro_a/membro_b — que a essa altura são
-- INERTES e congelados no dia da primeira execução — e, como a herança é
-- max(semana) <= W, TODAS as semanas seguintes passariam a herdar a composição
-- errada, descartando em silêncio os remanejamentos do gestor. Uma reexecução
-- tem de ser no-op de verdade, não "no-op quase sempre".
--
-- ── DUAS SEMANAS, NÃO UMA ──────────────────────────────────────────────────
--   · '0001-S01' — MARCO ZERO. Semana sintética, anterior a qualquer data
--     real, que faz TODO o passado herdar a composição do dia da migração. Não
--     é invenção de histórico: é EXATAMENTE o que o gráfico já desenha hoje,
--     porque hoje ele resolve toda semana passada pela composição ATUAL. O
--     marco zero CONGELA esse comportamento em vez de mudá-lo — converte uma
--     afirmação implícita e mutante numa explícita e estável.
--     Ancorar só na semana corrente esvaziaria as 11 semanas anteriores do
--     gráfico de uma vez e jogaria tudo no contador "fora de dupla" — um
--     número que existe para dizer a verdade sobre trabalho não atribuído e
--     que passaria a mentir.
--     Preferido a uma âncora CALCULADA (menor data do sistema, ou hoje-84):
--     uma importação retroativa futura — as U59/U61 já fizeram isso uma vez —
--     cairia ANTES da âncora e perderia a turma em silêncio. Antes de
--     '0001-S01' não existe data.
--   · a SEMANA CORRENTE, e ela precisa ser PRÓPRIA. Senão, no dia em que o
--     gestor corrigir uma semana intermediária, a correção escorregaria para
--     frente e reescreveria a escala do presente. Materializar hoje é a parede
--     que segura o passado no passado.
--
-- Duplas INATIVAS ficam de fora, e não é descuido: os membros delas quase
-- sempre já foram recompostos em turmas ativas, e gravá-los violaria
-- (semana, pessoa_id). É por isso que membro_a/membro_b NÃO caem nesta
-- migration — passam a ser o único registro da composição das turmas desfeitas.
DO $$
DECLARE
  v_marco  constant text := '0001-S01';
  v_hoje   date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_semana text;
  v_alvo   text;
  v_dup    text;
  v_falta  text;
  v_sobra  text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.duplas_escala_semanas) THEN
    RAISE NOTICE 'U76: já existe escala lançada — backfill e portão PULADOS (a escala manda, não as colunas legadas).';
    RETURN;
  END IF;

  v_semana := public.referencia_semanal(v_hoje);

  -- ── PRÉ-VOO ──────────────────────────────────────────────────────────────
  -- A PK nova é (semana, pessoa_id). Se HOJE alguém já estiver em duas duplas
  -- ativas (os índices da U47 impedem, mas carga à mão não passa por trigger),
  -- o ON CONFLICT engoliria uma das duas em silêncio e a escala nasceria
  -- mentindo. Agrupa por pessoa_id e NÃO por nome: `profiles.nome` é text sem
  -- unicidade, e dois "Lucas" em turmas diferentes fariam o pré-voo abortar
  -- uma base perfeitamente válida.
  SELECT string_agg(format('  · %s (em %s turmas ativas)', x.quem, x.quantas), E'\n')
    INTO v_dup
    FROM (SELECT m.pessoa_id,
                 COALESCE(max(p.nome), m.pessoa_id::text) AS quem,
                 count(*) AS quantas
            FROM public.duplas d
            CROSS JOIN LATERAL (VALUES (d.membro_a), (d.membro_b)) AS m(pessoa_id)
            LEFT JOIN public.profiles p ON p.id = m.pessoa_id
           WHERE d.ativa AND m.pessoa_id IS NOT NULL
           GROUP BY m.pessoa_id
          HAVING count(*) > 1) x;
  IF v_dup IS NOT NULL THEN
    RAISE EXCEPTION E'ABORTADO NO PRÉ-VOO — nada foi alterado (ROLLBACK).\nEstas pessoas estão em mais de uma dupla ATIVA e não cabem na regra nova ("uma equipe por pessoa por semana"):\n%\nArrume na tela Operacional → Duplas e rode de novo.', v_dup;
  END IF;

  -- ── O SEED ───────────────────────────────────────────────────────────────
  FOREACH v_alvo IN ARRAY ARRAY[v_marco, v_semana]
  LOOP
    INSERT INTO public.duplas_escala_semanas (semana, origem) VALUES (v_alvo, 'backfill');

    INSERT INTO public.duplas_escala (semana, pessoa_id, dupla_id, ordem, origem)
    SELECT v_alvo, m.pessoa_id, d.id, m.ordem, 'backfill'
      FROM public.duplas d
      CROSS JOIN LATERAL (VALUES (d.membro_a, 1::smallint),
                                 (d.membro_b, 2::smallint)) AS m(pessoa_id, ordem)
     WHERE d.ativa AND m.pessoa_id IS NOT NULL;
  END LOOP;

  -- ── O PORTÃO ─────────────────────────────────────────────────────────────
  -- A peça que transforma "espero que dê certo" em "não dá para dar errado".
  -- Antes de a U76 remover os índices parciais e o trigger da U47, ela prova,
  -- pessoa por pessoa e pelos DOIS lados, que a escala nova reproduz EXATAMENTE
  -- a composição antiga para a semana de hoje. Se faltar ou sobrar um nome, o
  -- RAISE estoura, o ROLLBACK devolve tudo — inclusive as tabelas novas, que
  -- somem junto — e o banco fica idêntico ao que era antes do Run.
  --
  -- Ele só existe DENTRO do seed: numa execução que não semeou (a tranca lá em
  -- cima), comparar a escala VIVA contra membro_a/membro_b acusaria corrupção
  -- justamente quando o banco está certo — divergir das colunas inertes é o
  -- comportamento ESPERADO depois do primeiro remanejamento.
  SELECT string_agg(format('  · %s — esperado na equipe "%s"', x.quem, x.turma), E'\n')
    INTO v_falta
    FROM (SELECT d.nome AS turma, COALESCE(p.nome, m.pessoa_id::text) AS quem
            FROM public.duplas d
            CROSS JOIN LATERAL (VALUES (d.membro_a), (d.membro_b)) AS m(pessoa_id)
            LEFT JOIN public.profiles p ON p.id = m.pessoa_id
           WHERE d.ativa AND m.pessoa_id IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM public.duplas_escala e
                              WHERE e.semana = v_semana
                                AND e.dupla_id = d.id
                                AND e.pessoa_id = m.pessoa_id)) x;

  SELECT string_agg(format('  · %s — na escala da equipe "%s" sem estar na composição antiga',
                           COALESCE(p.nome, e.pessoa_id::text), d.nome), E'\n')
    INTO v_sobra
    FROM public.duplas_escala e
    JOIN public.duplas d ON d.id = e.dupla_id
    LEFT JOIN public.profiles p ON p.id = e.pessoa_id
   WHERE e.semana = v_semana
     AND e.pessoa_id IS DISTINCT FROM d.membro_a
     AND e.pessoa_id IS DISTINCT FROM d.membro_b;

  IF v_falta IS NOT NULL OR v_sobra IS NOT NULL THEN
    RAISE EXCEPTION E'ABORTADO ANTES DE QUALQUER DROP — nada foi alterado (ROLLBACK).\nA escala semanal NÃO reproduz a composição atual para a semana %:\n%\n%',
      v_semana, COALESCE(v_falta, '  (ninguém faltando)'), COALESCE(v_sobra, '  (ninguém sobrando)');
  END IF;

  RAISE NOTICE 'U76: escala semeada no marco zero e em % — portão passou.', v_semana;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- §6) OS DROPS DA U47 — só agora, com o portão já passado
-- ═══════════════════════════════════════════════════════════════════════
-- Os dois índices e o trigger saem JUNTOS. Sair um sem o outro deixaria
-- meia-garantia, que é pior que nenhuma: passa a impressão de estar protegido.
DROP INDEX   IF EXISTS public.duplas_membro_a_unico;
DROP INDEX   IF EXISTS public.duplas_membro_b_unico;
DROP TRIGGER IF EXISTS trg_duplas_valida_membros ON public.duplas;

-- A FUNÇÃO duplas_valida_membros() NÃO é dropada. Custa nada mantê-la e ela
-- transforma o DESFAZER num CREATE TRIGGER de UMA linha, em vez de exigir
-- retranscrever um corpo plpgsql à mão — que é exatamente o erro que a
-- cicatriz "rename de tabela não reescreve o corpo do trigger" descreve.
COMMENT ON FUNCTION public.duplas_valida_membros() IS
  'INERTE desde a U76 (o trigger trg_duplas_valida_membros foi removido). '
  'Mantida INTACTA só para o DESFAZER poder recriar o trigger sem '
  'retranscrição. Não religue sem antes esvaziar public.duplas_escala.';

-- Turma nova nasce sem "membro_a": a composição dela é linha em duplas_escala,
-- e no Passo 2 as duas colunas caem. DROP NOT NULL é a DDL destrutiva mais
-- barata que existe — o inverso (SET NOT NULL) só exige que não haja nulo, e o
-- DESFAZER traz a consulta que acha os nulos.
ALTER TABLE public.duplas ALTER COLUMN membro_a DROP NOT NULL;

COMMENT ON COLUMN public.duplas.membro_a IS
  'ESPELHO LEGADO desde a U76 — NÃO LEIA DAQUI. A composição vive em '
  'public.duplas_escala, por semana. A coluna fica por três motivos: (1) é o '
  'único registro que sobrou da composição das duplas DESFEITAS, que não '
  'puderam entrar no backfill sem violar "uma equipe por pessoa por semana"; '
  '(2) é a matéria-prima do DESFAZER — como só o espelho escreve aqui, recriar '
  'os índices parciais da U47 é garantido de funcionar; (3) a U65 (seed de '
  'chamados de teste) ainda lê esta coluna EM EXECUÇÃO. Cai no Passo 2.';
COMMENT ON COLUMN public.duplas.membro_b IS
  'ESPELHO LEGADO desde a U76 — ver o comentário de membro_a.';
COMMENT ON COLUMN public.duplas.ativa IS
  'Aparece na lista de quem pode ser escalado, e é copiada para a frente ao '
  'abrir uma semana. DEIXOU de ser critério de composição na U76: desfazer a '
  'turma NÃO apaga mais as semanas passadas dela — o que a tira do futuro é a '
  'ausência na escala da semana seguinte em diante.';

-- ═══════════════════════════════════════════════════════════════════════
-- §7) OS GATILHOS DE `duplas`
-- ═══════════════════════════════════════════════════════════════════════

-- ── 7.1 O CARIMBO QUE A U47 PERDIA ─────────────────────────────────────────
-- Na U47 o `NEW.updated_at := now()` estava DEPOIS do early-return de
-- `IF NOT NEW.ativa` — então DESATIVAR uma dupla nunca carimbava. Sem o
-- trigger da U47, nada mais carimbaria. O set_updated_at() da casa faz só
-- isso, e não tem opinião sobre composição nenhuma.
DROP TRIGGER IF EXISTS trg_duplas_updated_at ON public.duplas;
CREATE TRIGGER trg_duplas_updated_at
  BEFORE UPDATE ON public.duplas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 7.2 DESFAZER A TURMA LIBERA O FUTURO, NÃO O PASSADO ────────────────────
-- Sem isto, as linhas de uma turma desfeita continuariam ocupando o slot
-- (semana, pessoa) das semanas planejadas e o gestor levaria uma violação de
-- chave incompreensível ao remanejar.
--
-- APAGA DA SEMANA SEGUINTE EM DIANTE — `>` e não `>=`. Na quinta-feira a
-- semana corrente já tem segunda, terça e quarta VIVIDAS: apagá-la seria
-- destruir registro do que aconteceu, e faria os chamados desses dias voltarem
-- a engordar o "fora de dupla" do painel. Para liberar a vaga da semana em
-- curso, o gestor usa a porta de escrita — escala_definir(turma, semana, '{}')
-- ou _mover => true — onde ele VÊ o que está tirando.
-- Semana passada é REGISTRO; semana futura é PLANO, e plano de turma extinta
-- não é plano.
CREATE OR REPLACE FUNCTION public.duplas_liberar_escala_futura()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM public.duplas_escala
   WHERE dupla_id = NEW.id
     AND semana > public.referencia_semanal((now() AT TIME ZONE 'America/Sao_Paulo')::date);
  RETURN NULL;  -- AFTER trigger: o retorno é ignorado
END;
$$;

DROP TRIGGER IF EXISTS trg_duplas_ao_desativar ON public.duplas;
CREATE TRIGGER trg_duplas_ao_desativar
  AFTER UPDATE OF ativa ON public.duplas
  FOR EACH ROW WHEN (OLD.ativa AND NOT NEW.ativa)
  EXECUTE FUNCTION public.duplas_liberar_escala_futura();

COMMENT ON FUNCTION public.duplas_liberar_escala_futura() IS
  'Ao DESFAZER uma turma, solta as pessoas dela das semanas FUTURAS — senão a '
  'PK (semana, pessoa_id) continuaria bloqueando o remanejo. A semana corrente '
  'e as passadas ficam: são registro, não plano. REATIVAR não restaura o que '
  'foi apagado.';

-- ── 7.3 A PONTE DA TELA ANTIGA ─────────────────────────────────────────────
-- Enquanto o DialogoDuplas antigo estiver no ar, o que ele salvar em
-- membro_a/membro_b tem de virar escala — da SEMANA CORRENTE, nunca do
-- passado. É, palavra por palavra, o pedido do Davi na U64: "se um dia eu
-- mudar a dupla do Breno para o Denner, desse dia em diante".
--
-- ELA RECUSA, NÃO SOBRESCREVE. O espelho é de mão ÚNICA (escala nunca volta
-- para as colunas), então, a partir do primeiro lançamento pela porta nova, as
-- colunas legadas estão defasadas. Se o espelho sobrescrevesse, uma aba antiga
-- deixada aberta apagaria a composição REAL da semana com o par velho, em
-- silêncio e com um toast dizendo "Dupla atualizada." — o pior fim possível,
-- na direção contrária à que este bloco existe para evitar. Por isso: semana
-- que já tem linha `manual` recusa o espelho, com uma frase que manda editar
-- na tela nova.
CREATE OR REPLACE FUNCTION public.duplas_espelhar_na_escala()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_sem text := public.referencia_semanal((now() AT TIME ZONE 'America/Sao_Paulo')::date);
BEGIN
  -- turma desfeita não ganha escala; quem cuida dela é o 7.2
  IF NOT NEW.ativa THEN RETURN NULL; END IF;

  -- renomear a turma ou trocar o veículo não é composição (a lista OF já
  -- filtra, mas um UPDATE que cite as colunas com o mesmo valor dispara).
  IF TG_OP = 'UPDATE'
     AND NEW.membro_a IS NOT DISTINCT FROM OLD.membro_a
     AND NEW.membro_b IS NOT DISTINCT FROM OLD.membro_b THEN
    RETURN NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM public.duplas_escala e
              WHERE e.semana = v_sem AND e.origem = 'manual') THEN
    RAISE EXCEPTION 'A escala da semana % já foi lançada na tela de Equipes de campo — edite lá, não pelo cadastro antigo da dupla.',
      v_sem USING ERRCODE = '55000';
  END IF;

  -- a semana inteira primeiro, senão as OUTRAS turmas ficariam sem composição
  PERFORM public.abrir_escala_semana(v_sem);

  DELETE FROM public.duplas_escala e
   WHERE e.semana = v_sem AND e.dupla_id = NEW.id;

  -- e libera o slot da semana para quem esta turma está reivindicando, senão a
  -- PK barraria o remanejo que a tela antiga acabou de fazer
  DELETE FROM public.duplas_escala e
   WHERE e.semana = v_sem
     AND e.pessoa_id IN (NEW.membro_a, NEW.membro_b);

  INSERT INTO public.duplas_escala (semana, pessoa_id, dupla_id, ordem, origem, criada_por)
  SELECT v_sem, m.pessoa_id, NEW.id, m.ordem, 'espelho', auth.uid()
    FROM (VALUES (NEW.membro_a, 1::smallint), (NEW.membro_b, 2::smallint)) AS m(pessoa_id, ordem)
   WHERE m.pessoa_id IS NOT NULL;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_duplas_espelhar_na_escala ON public.duplas;
CREATE TRIGGER trg_duplas_espelhar_na_escala
  AFTER INSERT OR UPDATE OF membro_a, membro_b ON public.duplas
  FOR EACH ROW EXECUTE FUNCTION public.duplas_espelhar_na_escala();

COMMENT ON FUNCTION public.duplas_espelhar_na_escala() IS
  'PONTE TEMPORÁRIA (U76): o que a tela ANTIGA grava em membro_a/membro_b vira '
  'escala da semana corrente. RECUSA quando a semana já tem linha manual — a '
  'tela nova vence. Sai no Passo 2, no mesmo deploy que remove o DialogoDuplas '
  'antigo e as duas colunas.';

-- ═══════════════════════════════════════════════════════════════════════
-- §8) O APOIO AUTOMÁTICO, AGORA PELA SEMANA DO CHAMADO
-- ═══════════════════════════════════════════════════════════════════════
-- A U64 continua inteira: o apoio é GRAVADO em chamado_apoios com
-- origem='dupla' no momento da atribuição, o gatilho só mexe no que ele mesmo
-- criou, e apoio posto à mão vence o automático. O que muda é de QUAL semana a
-- turma é lida — e, com a data no resolvedor, o gatilho não CONSEGUE mais
-- puxar "a dupla de hoje" para um chamado antigo nem se quiser. O medo que a
-- U64 tinha ficou estruturalmente impossível.

-- ── 8.1 A ASSINATURA SEM DATA MORRE ────────────────────────────────────────
-- Não é depreciação: enquanto ela existir, alguém a chama sem data e recebe a
-- composição de hoje aplicada a um chamado de qualquer época — o erro exato
-- que estamos consertando. Manter uma fachada "de hoje" seria manter o footgun
-- por conveniência.
-- O DROP é seguro sem CASCADE: o único chamador no banco é o corpo de
-- chamado_apoio_da_dupla(), e corpo plpgsql não cria dependência de catálogo
-- (ele é substituído logo abaixo, na MESMA transação — daí o BEGIN/COMMIT).
-- Não há view, policy nem .rpc() no app apontando para ela. NÃO use CASCADE
-- aqui: se um dia houver algo pendurado, é melhor a migration abortar do que a
-- dependência sumir em silêncio.
DROP FUNCTION IF EXISTS public.parceiro_da_dupla(uuid);

-- ── 8.2 UMA IMPLEMENTAÇÃO, DOIS CHAMADORES ─────────────────────────────────
-- O gatilho e a reconciliação usam a MESMA função. Duas implementações da
-- mesma regra divergem, é só questão de quando — e a reconciliação não pode
-- ser feita com o truque de "UPDATE que não muda nada", porque o gatilho novo
-- (de propósito) volta cedo quando nem o responsável nem a semana mudaram.
--
-- A REGRA DE OURO AQUI: "não sei" NUNCA autoriza DELETE. Quando nenhuma semana
-- aberta cobre a data do chamado, `escala_semana_vigente` devolve NULL, os
-- parceiros vêm vazios e um DELETE cego varreria TODO apoio origem='dupla' do
-- chamado — apagando, sem sino e sem log, o registro de quem foi ao prédio.
-- Corrigir a hora de uma OS antiga não pode custar isso.
CREATE OR REPLACE FUNCTION public.chamado_sincronizar_apoio(_chamado uuid)
RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c        record;
  v_dia    date;
  v_vig    text;
  v_alvo   uuid[];
  v_mexeu  int := 0;
  v_n      int;
BEGIN
  SELECT id, natureza, responsavel_id, data_hora_agendada, created_at
    INTO c
    FROM public.chamados WHERE id = _chamado;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- Turma é conceito de CAMPO: o chamado interno tem equipe (departamento) e
  -- apoio próprios, e a proposta comercial não tem par que a acompanhe.
  IF c.natureza IS DISTINCT FROM 'campo' THEN RETURN 0; END IF;

  v_dia := public.dia_da_dupla(c.data_hora_agendada, c.created_at);
  v_vig := public.escala_semana_vigente(public.referencia_semanal(v_dia));
  IF v_vig IS NULL THEN RETURN 0; END IF;   -- não sei ≠ ninguém

  SELECT COALESCE(array_agg(p.pessoa_id), '{}'::uuid[]) INTO v_alvo
    FROM public.parceiros_da_dupla(c.responsavel_id, v_dia) AS p(pessoa_id);

  -- Sai quem o automatismo pôs e a escala daquela semana não confirma mais.
  -- `origem='dupla'` é o que torna isto seguro: apoio posto à mão fica sempre,
  -- inclusive as cargas históricas da U59/U61, que entraram sem origem e
  -- portanto como 'manual'. Com conjunto vazio (responsável saiu, ou a turma
  -- virou de uma pessoa só) o NOT limpa tudo — mesmo comportamento da U64.
  DELETE FROM public.chamado_apoios a
   WHERE a.chamado_id = c.id
     AND a.origem = 'dupla'
     AND NOT (a.profile_id = ANY (v_alvo));
  GET DIAGNOSTICS v_n = ROW_COUNT; v_mexeu := v_mexeu + v_n;

  IF c.responsavel_id IS NOT NULL AND array_length(v_alvo, 1) IS NOT NULL THEN
    -- PLURAL: turma de três grava dois apoios. Já existe como 'manual'? Fica
    -- manual — a escolha da pessoa vence a do automatismo, e é isso que impede
    -- o gatilho de tomar posse (e depois remover) um apoio que ele não criou.
    INSERT INTO public.chamado_apoios (chamado_id, profile_id, origem)
    SELECT c.id, p.pessoa_id, 'dupla' FROM unnest(v_alvo) AS p(pessoa_id)
    ON CONFLICT (chamado_id, profile_id) DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_mexeu := v_mexeu + v_n;
  END IF;

  RETURN v_mexeu;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.chamado_sincronizar_apoio(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.chamado_sincronizar_apoio(uuid) TO service_role;

COMMENT ON FUNCTION public.chamado_sincronizar_apoio(uuid) IS
  'Refaz o apoio origem=dupla de UM chamado pela escala da semana em que ele '
  'está programado. Devolve quantas linhas mexeu (0 = já estava certo, e é o '
  'que torna a reconciliação idempotente e silenciosa). Volta cedo quando '
  'nenhuma semana aberta cobre a data: não saber quem era NÃO é o mesmo que '
  'saber que não era ninguém.';

-- ── 8.3 O GATILHO ──────────────────────────────────────────────────────────
-- QUANDO REAVALIAR — e este é o ponto onde a invariante do CLAUDE.md se
-- defende. Só quando a ATRIBUIÇÃO muda: o responsável, ou a SEMANA do trabalho.
--   · `AFTER UPDATE OF` dispara sempre que a coluna aparece no SET, mesmo com
--     valor igual. Sem a comparação com OLD, corrigir a HORA na sexta-feira de
--     um chamado atendido na quarta reavaliaria contra a escala de agora e
--     poderia reescrever quem foi ao prédio. Comparar SEMANA e não timestamp
--     também evita sino à toa: mover de terça para quarta não toca em nada.
--   · chamado ENCERRADO (concluido|cancelado) só é reavaliado quando o
--     RESPONSÁVEL muda. Corrigir a data de uma OS concluída é acertar cadastro
--     e não pode reescrever registro; corrigir o RESPONSÁVEL, sim — o apoio
--     que o automatismo pôs veio do responsável errado, e deixá-lo é deixar
--     uma mentira. É a menor mudança possível em relação à U64, que reavaliava
--     sempre que o responsável mudava.
--   · chamado que NASCE encerrado é CARGA HISTÓRICA, não atribuição: as
--     U59/U61 inserem OS já concluídas com data de meses atrás, e sem esta
--     linha uma carga futura sairia fabricando apoio automático para trabalho
--     histórico — o backfill que a U64 recusou em prosa, acontecendo por
--     acidente.
--   · `natureza` entrou na lista OF para o chamado que nasce interno e VIRA
--     campo ganhar apoio. O caminho inverso não apaga nada (a função volta
--     cedo em não-campo): tirar apoio já gravado seria apagar registro.
CREATE OR REPLACE FUNCTION public.chamado_apoio_da_dupla()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_dia          date;
  v_dia_antes    date;
  v_mudou_dono   boolean;
  v_mudou_semana boolean;
BEGIN
  IF NEW.natureza IS DISTINCT FROM 'campo' THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' AND NEW.status IN ('concluido','cancelado') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_dia        := public.dia_da_dupla(NEW.data_hora_agendada, NEW.created_at);
    v_dia_antes  := public.dia_da_dupla(OLD.data_hora_agendada, OLD.created_at);
    v_mudou_dono := NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id;
    v_mudou_semana := public.referencia_semanal(v_dia)
                      IS DISTINCT FROM public.referencia_semanal(v_dia_antes);

    IF NOT v_mudou_dono AND NOT v_mudou_semana
       AND NEW.natureza IS NOT DISTINCT FROM OLD.natureza THEN
      RETURN NEW;
    END IF;

    -- encerrado: só a troca de responsável reabre o assunto
    IF NEW.status IN ('concluido','cancelado') AND NOT v_mudou_dono THEN
      RETURN NEW;
    END IF;
  END IF;

  PERFORM public.chamado_sincronizar_apoio(NEW.id);
  RETURN NEW;
END;
$$;

-- Os NOMES dos gatilhos não mudam: U59/U61 desligam gatilhos por nome durante
-- carga, e renomear é criar uma cicatriz nova de graça. A única mudança de
-- superfície é a lista OF, e é ela que fecha o buraco de "reagendei para outra
-- semana e o apoio ficou na semana antiga".
DROP TRIGGER IF EXISTS trg_chamado_apoio_dupla_ins ON public.chamados;
DROP TRIGGER IF EXISTS trg_chamado_apoio_dupla_upd ON public.chamados;
CREATE TRIGGER trg_chamado_apoio_dupla_ins
  AFTER INSERT ON public.chamados
  FOR EACH ROW EXECUTE FUNCTION public.chamado_apoio_da_dupla();
CREATE TRIGGER trg_chamado_apoio_dupla_upd
  AFTER UPDATE OF responsavel_id, data_hora_agendada, natureza ON public.chamados
  FOR EACH ROW EXECUTE FUNCTION public.chamado_apoio_da_dupla();

COMMENT ON FUNCTION public.chamado_apoio_da_dupla() IS
  'Grava o apoio automático (origem=dupla) com a turma da SEMANA em que o '
  'chamado está programado (U76; antes era a dupla de hoje, U64). Só reavalia '
  'quando a ATRIBUIÇÃO muda — responsável, ou a semana do trabalho. Nunca toca '
  'em apoio manual. Chamado encerrado só é reavaliado na troca de responsável.';

-- ── 8.4 A VÁLVULA DELIBERADA ───────────────────────────────────────────────
-- O caso que ela resolve, e que É UM BURACO CONHECIDO deste desenho: o chamado
-- foi programado para uma semana AINDA NÃO ABERTA, então o apoio nasceu com a
-- escala HERDADA; depois disso o gestor abriu aquela semana e mexeu na
-- composição. O apoio gravado continua dizendo o par antigo, e o gráfico (que
-- resolve pela escala daquela semana) passa a dizer outra coisa.
--
-- NÃO existe gatilho em duplas_escala que refaça isso sozinho, e a ausência é
-- deliberada: lançar a escala da semana que vem sairia reescrevendo chamados em
-- cascata, e cada INSERT de apoio dispara trg_notify_chamado_apoio ("Você
-- entrou como apoio") — dezenas de sinos no bolso dos técnicos por uma escrita
-- de CADASTRO. Uma escrita de cadastro que dispara escrita em REGISTRO é
-- exatamente o que a U64 recusou.
-- Então o remédio é um ATO: alguém chama, a chamada fica no log, e a
-- conferência §9.6 lista quais chamados divergem em vez de mandar ignorar.
--
-- SÓ CHAMADO ABERTO. O que já foi concluído ou cancelado é registro — a
-- reconciliação não o alcança nem quando o gestor manda.
CREATE OR REPLACE FUNCTION public.reconciliar_apoios_abertos(_desde_semana text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE r record; v_n int := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_gestor(auth.uid()) THEN
    RAISE EXCEPTION 'Só quem responde pela operação reconcilia apoio.'
      USING ERRCODE = '42501';
  END IF;

  FOR r IN
    SELECT c.id
      FROM public.chamados c
     WHERE c.natureza = 'campo'
       AND c.status NOT IN ('concluido','cancelado')
       AND (_desde_semana IS NULL
            OR public.referencia_semanal(
                 public.dia_da_dupla(c.data_hora_agendada, c.created_at)) >= _desde_semana)
  LOOP
    IF public.chamado_sincronizar_apoio(r.id) > 0 THEN v_n := v_n + 1; END IF;
  END LOOP;

  RETURN v_n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reconciliar_apoios_abertos(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.reconciliar_apoios_abertos(text) TO authenticated, service_role;

COMMENT ON FUNCTION public.reconciliar_apoios_abertos(text) IS
  'Refaz o apoio automático dos chamados de campo AINDA ABERTOS cujo apoio '
  'gravado diverge da escala da semana deles. Deliberada: nenhum gatilho a '
  'chama. Devolve quantos chamados mudaram. Nunca alcança concluído ou '
  'cancelado, nem apoio manual.';

-- ═══════════════════════════════════════════════════════════════════════
-- §9) CONFERÊNCIA
-- ═══════════════════════════════════════════════════════════════════════
-- RAISE NOTICE é invisível no editor do Supabase (cicatriz em
-- docs/manual/banco-e-migrations.md): tudo que precisa ser visto sai em SELECT,
-- com valor obtido × esperado.

-- ── 9.1 estrutura ──────────────────────────────────────────────────────────
SELECT 'duplas.veiculo existe' AS conferencia,
       (EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='duplas'
                   AND column_name='veiculo'))::text AS valor,
       'true' AS esperado
UNION ALL
SELECT 'as duas tabelas novas existem',
       ((to_regclass('public.duplas_escala') IS NOT NULL)
        AND (to_regclass('public.duplas_escala_semanas') IS NOT NULL))::text, 'true'
UNION ALL
SELECT 'a PK da escala é (semana, pessoa_id) — a regra virou chave',
       (SELECT string_agg(a.attname, ', ' ORDER BY k.ord)
          FROM pg_constraint c
          CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
          JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
         WHERE c.conrelid = 'public.duplas_escala'::regclass AND c.contype = 'p'),
       'semana, pessoa_id'
UNION ALL
SELECT 'RLS ligada nas duas tabelas novas', count(*)::text, '2'
  FROM pg_class
 WHERE oid IN ('public.duplas_escala'::regclass, 'public.duplas_escala_semanas'::regclass)
   AND relrowsecurity
UNION ALL
SELECT 'policies das duas tabelas novas', count(*)::text, '4'
  FROM pg_policies
 WHERE schemaname='public' AND tablename IN ('duplas_escala','duplas_escala_semanas')
UNION ALL
SELECT 'authenticated NÃO tem UPDATE na escala (a linha é chave + auditoria)',
       count(*)::text, '0'
  FROM information_schema.role_table_grants
 WHERE table_schema='public' AND table_name='duplas_escala'
   AND grantee='authenticated' AND privilege_type='UPDATE'
UNION ALL
SELECT 'CRÍTICO: nenhuma função nova da U76 ficou aberta a anon',
       count(*)::text, '0'
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('referencia_semanal','dia_da_dupla','escala_semana_vigente',
                     'escala_da_semana','dupla_da_pessoa','parceiros_da_dupla',
                     'parceiro_da_dupla','abrir_escala_semana','escala_definir',
                     'chamado_sincronizar_apoio','reconciliar_apoios_abertos')
   AND has_function_privilege('anon', p.oid, 'EXECUTE')
UNION ALL
-- ── o que SAIU ─────────────────────────────────────────────────────────────
SELECT 'índices parciais da U47 removidos', count(*)::text, '0'
  FROM pg_indexes
 WHERE schemaname='public'
   AND indexname IN ('duplas_membro_a_unico','duplas_membro_b_unico')
UNION ALL
SELECT 'trigger trg_duplas_valida_membros removido', count(*)::text, '0'
  FROM pg_trigger
 WHERE tgrelid='public.duplas'::regclass AND tgname='trg_duplas_valida_membros'
UNION ALL
SELECT 'a FUNÇÃO duplas_valida_membros() FICOU (é o DESFAZER de uma linha)',
       (to_regprocedure('public.duplas_valida_membros()') IS NOT NULL)::text, 'true'
UNION ALL
SELECT 'parceiro_da_dupla SEM data foi removida (era o footgun)',
       (to_regprocedure('public.parceiro_da_dupla(uuid)') IS NULL)::text, 'true'
UNION ALL
SELECT 'membro_a passou a aceitar NULL (turma nova não tem membro_a)',
       (NOT attnotnull)::text, 'true'
  FROM pg_attribute
 WHERE attrelid='public.duplas'::regclass AND attname='membro_a'
UNION ALL
-- ── o que ENTROU ───────────────────────────────────────────────────────────
SELECT 'gatilhos novos em duplas (updated_at + desativar + ponte)', count(*)::text, '3'
  FROM pg_trigger
 WHERE tgrelid='public.duplas'::regclass AND NOT tgisinternal
   AND tgname IN ('trg_duplas_updated_at','trg_duplas_ao_desativar',
                  'trg_duplas_espelhar_na_escala')
UNION ALL
SELECT 'CRÍTICO: o gatilho de apoio escuta responsavel_id, data_hora_agendada e natureza',
       (SELECT (pg_get_triggerdef(t.oid) LIKE '%responsavel_id%'
            AND pg_get_triggerdef(t.oid) LIKE '%data_hora_agendada%'
            AND pg_get_triggerdef(t.oid) LIKE '%natureza%')::text
          FROM pg_trigger t
         WHERE t.tgrelid='public.chamados'::regclass
           AND t.tgname='trg_chamado_apoio_dupla_upd'), 'true';

-- ── 9.2 o formato bate com src/lib/periodos.ts, inclusive na virada ────────
-- Se estes divergirem, o mesmo dia terá duas semanas — uma no gráfico, outra
-- na escala — e a divergência só apareceria na última semana do ano.
SELECT 'virada de ano: 31/12/2025' AS conferencia,
       public.referencia_semanal(DATE '2025-12-31') AS valor, '2026-S01' AS esperado
UNION ALL
SELECT '01/01/2026 é a mesma semana',
       public.referencia_semanal(DATE '2026-01-01'), '2026-S01'
UNION ALL
SELECT 'gêmea de to_char(IYYY-"S"IW), a máscara que a U5 já usa',
       (public.referencia_semanal(DATE '2026-08-18')
        = to_char(DATE '2026-08-18','IYYY-"S"IW'))::text, 'true'
UNION ALL
SELECT 'FUSO: agendamento de domingo 22h em Brasília NÃO vira a semana seguinte',
       public.referencia_semanal(
         public.dia_da_dupla(TIMESTAMPTZ '2026-08-16 22:00:00-03', now())),
       public.referencia_semanal(DATE '2026-08-16');

-- ── 9.3 a herança, provada com dado ────────────────────────────────────────
SELECT 'antes do MARCO ZERO não existe escala (a ponta de baixo)' AS conferencia,
       (public.escala_semana_vigente('0000-S01') IS NULL)::text AS valor,
       'true' AS esperado
UNION ALL
SELECT 'a semana corrente é PRÓPRIA, não herdada',
       (public.escala_semana_vigente(
          public.referencia_semanal((now() AT TIME ZONE 'America/Sao_Paulo')::date))
        = public.referencia_semanal((now() AT TIME ZONE 'America/Sao_Paulo')::date))::text,
       'true'
UNION ALL
SELECT 'CRÍTICO: 8 semanas atrás herda o MARCO ZERO, e NÃO a semana corrente — a escala de hoje não alcança o passado',
       COALESCE(public.escala_semana_vigente(public.referencia_semanal(
         ((now() AT TIME ZONE 'America/Sao_Paulo')::date) - 56)), '(nenhuma)'),
       '0001-S01'
UNION ALL
SELECT 'CRÍTICO: nenhuma das 52 semanas anteriores resolve para uma semana POSTERIOR a ela',
       (SELECT count(*)::text
          FROM (SELECT public.referencia_semanal(
                  ((now() AT TIME ZONE 'America/Sao_Paulo')::date) - (gs.n*7)) AS w
                  FROM generate_series(0, 52) AS gs(n)) s
         WHERE public.escala_semana_vigente(s.w) > s.w), '0';

-- De onde cada uma das 12 semanas do gráfico tira a composição. Todas devem
-- apontar para o marco zero, menos a corrente — é a prova de que o painel
-- continua desenhando hoje o que desenhava ontem, agora congelado.
SELECT s.w AS semana_do_grafico,
       COALESCE(public.escala_semana_vigente(s.w), '— sem escala —') AS escala_que_vale,
       (SELECT count(DISTINCT v.dupla_id) FROM public.escala_da_semana(s.w) v)::text AS turmas,
       (SELECT count(*) FROM public.escala_da_semana(s.w) v)::text AS pessoas
  FROM (SELECT public.referencia_semanal(
          ((now() AT TIME ZONE 'America/Sao_Paulo')::date) - (gs.n*7)) AS w
          FROM generate_series(0, 11) AS gs(n)) s
 ORDER BY 1;

-- ── 9.4 unicidade e o backfill ─────────────────────────────────────────────
SELECT 'CRÍTICO: ninguém em duas turmas na mesma semana (a PK impede; conferindo)' AS conferencia,
       (SELECT count(*)::text FROM (SELECT semana, pessoa_id FROM public.duplas_escala
                                     GROUP BY 1,2 HAVING count(*) > 1) x) AS valor,
       '0' AS esperado
UNION ALL
SELECT 'membros de duplas ATIVAS (a composição antiga)',
       (SELECT count(*)::text
          FROM public.duplas d
          CROSS JOIN LATERAL (VALUES (d.membro_a), (d.membro_b)) AS m(p)
         WHERE d.ativa AND m.p IS NOT NULL), '(referência)'
UNION ALL
SELECT 'linhas no MARCO ZERO — tem de bater com a de cima',
       (SELECT count(*)::text FROM public.duplas_escala WHERE semana='0001-S01'),
       '(= referência)'
UNION ALL
SELECT 'linhas na SEMANA CORRENTE — tem de bater com a de cima',
       (SELECT count(*)::text FROM public.duplas_escala
         WHERE semana = public.referencia_semanal((now() AT TIME ZONE 'America/Sao_Paulo')::date)),
       '(= referência)';

-- QUEM NÃO CASOU nº 1: composição antiga × escala de hoje, nome a nome.
-- Depois do portão isto TEM de vir vazio na primeira execução. Fica no arquivo
-- porque é a consulta que o Davi vai querer rodar de novo daqui a um mês — e
-- aí divergir é ESPERADO, porque as colunas legadas congelaram.
SELECT d.nome AS equipe,
       COALESCE(p.nome, m.pessoa_id::text) AS pessoa,
       'na composição antiga, fora da escala de hoje' AS problema
  FROM public.duplas d
  CROSS JOIN LATERAL (VALUES (d.membro_a), (d.membro_b)) AS m(pessoa_id)
  LEFT JOIN public.profiles p ON p.id = m.pessoa_id
 WHERE d.ativa AND m.pessoa_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.duplas_escala e
                    WHERE e.semana = public.referencia_semanal((now() AT TIME ZONE 'America/Sao_Paulo')::date)
                      AND e.dupla_id = d.id AND e.pessoa_id = m.pessoa_id)
 ORDER BY 1, 2;

-- ── 9.5 CRÍTICO: o apoio ficou INTACTO ─────────────────────────────────────
-- A afirmação mais importante desta migration é negativa, e aqui ela vira
-- número. Se qualquer um dos três divergir, alguma coisa escreveu em
-- chamado_apoios — e nada aqui deveria.
SELECT 'apoios no total (antes × depois)' AS conferencia,
       (SELECT count(*) FROM public.chamado_apoios)::text AS valor,
       (SELECT apoios_total::text FROM _u76_antes) AS esperado
UNION ALL
SELECT 'apoios origem=dupla (antes × depois)',
       (SELECT count(*) FROM public.chamado_apoios WHERE origem='dupla')::text,
       (SELECT apoios_dupla::text FROM _u76_antes)
UNION ALL
SELECT 'apoios origem=manual (antes × depois)',
       (SELECT count(*) FROM public.chamado_apoios WHERE origem='manual')::text,
       (SELECT apoios_manual::text FROM _u76_antes);

-- ── 9.6 QUEM NÃO CASOU nº 2: apoio gravado × escala da semana ──────────────
-- Logo depois do backfill isto deve vir 0: a escala é, byte a byte, a
-- composição que gerou aqueles apoios. Daqui para frente o número deixa de ser
-- erro e passa a ser INFORMAÇÃO — "estes chamados ABERTOS foram programados
-- com uma escala que mudou depois". O remédio é deliberado:
--   SELECT public.reconciliar_apoios_abertos();
-- Note que a lista é só de chamado ABERTO. Divergência em chamado ENCERRADO
-- não entra aqui de propósito: lá a escala diz "quem estava escalado" e o
-- apoio diz "quem registramos que foi", e as duas coisas podem divergir sem
-- que nada esteja errado (U47 × U64).
SELECT 'chamados ABERTOS cujo apoio gravado diverge da escala da semana' AS conferencia,
       count(*)::text AS valor, '0' AS esperado
  FROM public.chamados c
 WHERE c.natureza='campo'
   AND c.status NOT IN ('concluido','cancelado')
   AND c.responsavel_id IS NOT NULL
   AND public.escala_semana_vigente(public.referencia_semanal(
         public.dia_da_dupla(c.data_hora_agendada, c.created_at))) IS NOT NULL
   AND (EXISTS (SELECT 1 FROM public.parceiros_da_dupla(c.responsavel_id,
                        public.dia_da_dupla(c.data_hora_agendada, c.created_at)) p(pessoa_id)
                 WHERE NOT EXISTS (SELECT 1 FROM public.chamado_apoios a
                                    WHERE a.chamado_id=c.id AND a.profile_id=p.pessoa_id))
     OR EXISTS (SELECT 1 FROM public.chamado_apoios a
                 WHERE a.chamado_id=c.id AND a.origem='dupla'
                   AND NOT EXISTS (SELECT 1 FROM public.parceiros_da_dupla(c.responsavel_id,
                                     public.dia_da_dupla(c.data_hora_agendada, c.created_at)) p(pessoa_id)
                                    WHERE p.pessoa_id = a.profile_id)));

-- ── 9.7 O RETRATO: as equipes de hoje, com veículo e composição ────────────
SELECT d.nome                                 AS equipe_de_campo,
       COALESCE(d.veiculo, '— sem veículo —') AS veiculo,
       s.semana_origem                        AS escala_vinda_de,
       CASE WHEN bool_or(s.herdada) THEN 'herdada' ELSE 'própria' END AS origem_da_escala,
       string_agg(COALESCE(p.nome,'?'), ' · ' ORDER BY s.ordem, p.nome) AS composicao,
       count(*)                               AS pessoas
  FROM public.escala_da_semana(
         public.referencia_semanal((now() AT TIME ZONE 'America/Sao_Paulo')::date)) s
  JOIN public.duplas   d ON d.id = s.dupla_id
  LEFT JOIN public.profiles p ON p.id = s.pessoa_id
 GROUP BY d.nome, d.veiculo, s.semana_origem
 ORDER BY 1;

-- Técnico ativo fora de qualquer equipe nesta semana. Não é erro — é a fatia
-- que o gestor precisa enxergar para escalar, e explica de antemão o "N fora
-- de equipe" que o painel vai mostrar.
SELECT p.nome AS tecnico_sem_equipe_nesta_semana
  FROM public.profiles p
 WHERE p.ativo IS DISTINCT FROM false
   AND p.cargo = 'tecnico'
   AND NOT EXISTS (SELECT 1 FROM public.escala_da_semana(
                     public.referencia_semanal((now() AT TIME ZONE 'America/Sao_Paulo')::date)) s
                    WHERE s.pessoa_id = p.id)
 ORDER BY 1;

-- Turmas DESFEITAS: o que só membro_a/membro_b ainda sabem. A prova visual de
-- por que as colunas não caíram nesta migration.
SELECT d.nome AS equipe_desfeita,
       COALESCE(pa.nome,'—') AS membro_a_congelado,
       COALESCE(pb.nome,'—') AS membro_b_congelado,
       (SELECT count(*) FROM public.duplas_escala e WHERE e.dupla_id = d.id) AS linhas_de_escala
  FROM public.duplas d
  LEFT JOIN public.profiles pa ON pa.id = d.membro_a
  LEFT JOIN public.profiles pb ON pb.id = d.membro_b
 WHERE NOT d.ativa
 ORDER BY 1;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- DESFAZER — EM DOIS NÍVEIS, porque um só seria teatro
--
-- NÍVEL 1 devolve o COMPORTAMENTO da U47/U64 sem apagar nada: dá para rodar às
-- cegas, no meio de um incêndio, e rodar a U76 de novo depois (a tranca do §5
-- vai PULAR o backfill, porque a escala continua lá — que é o certo: a escala
-- gravada manda, não as colunas legadas).
-- NÍVEL 2 apaga a escala, e é o único passo irreversível do conjunto.
--
-- Por que o nível 1 é garantido de funcionar: membro_a/membro_b não foram
-- dropados e só o espelho escreveu neles depois da U76, então os índices
-- parciais voltam sobre dados coerentes; e duplas_valida_membros() ficou
-- intacta, então o trigger volta sem retranscrição de corpo.
-- ═══════════════════════════════════════════════════════════════════════════

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ NÍVEL 1 — volta o comportamento antigo. NÃO apaga escala nenhuma.    ║
-- ╚══════════════════════════════════════════════════════════════════════╝
-- BEGIN;
--
-- -- 1.1 CONFERIR ANTES: os índices só voltam se ninguém repetir em
-- --     membro_a/membro_b hoje. Se vier linha, PARE e resolva — rodar o 1.4
-- --     com conflito aborta a transação inteira (o que é o certo).
-- SELECT quem, count(*) AS em_quantas_duplas_ativas
--   FROM (SELECT unnest(ARRAY[d.membro_a, d.membro_b]) AS quem
--           FROM public.duplas d WHERE d.ativa) x
--  WHERE quem IS NOT NULL GROUP BY 1 HAVING count(*) > 1;
--
-- -- 1.2 os gatilhos novos de duplas saem primeiro, senão convivem com o antigo
-- DROP TRIGGER IF EXISTS trg_duplas_espelhar_na_escala ON public.duplas;
-- DROP TRIGGER IF EXISTS trg_duplas_ao_desativar       ON public.duplas;
--
-- -- 1.3 o trigger da U47 volta — UMA linha, porque a função nunca saiu.
-- DROP TRIGGER IF EXISTS trg_duplas_valida_membros ON public.duplas;
-- CREATE TRIGGER trg_duplas_valida_membros
--   BEFORE INSERT OR UPDATE ON public.duplas
--   FOR EACH ROW EXECUTE FUNCTION public.duplas_valida_membros();
-- -- (atenção: aquele corpo carimba updated_at DEPOIS do early-return de
-- --  `IF NOT NEW.ativa` — a cicatriz volta junto. Manter o trg_duplas_updated_at
-- --  do §7.1 é inofensivo e conserta de novo; só derrube se algo depender do
-- --  defeito: DROP TRIGGER IF EXISTS trg_duplas_updated_at ON public.duplas;)
--
-- -- 1.4 os dois índices parciais, idênticos aos da U47
-- CREATE UNIQUE INDEX IF NOT EXISTS duplas_membro_a_unico
--   ON public.duplas (membro_a) WHERE ativa;
-- CREATE UNIQUE INDEX IF NOT EXISTS duplas_membro_b_unico
--   ON public.duplas (membro_b) WHERE ativa AND membro_b IS NOT NULL;
--
-- -- 1.5 parceiro_da_dupla(uuid) volta ao corpo LITERAL da U64…
-- CREATE OR REPLACE FUNCTION public.parceiro_da_dupla(_pessoa uuid)
-- RETURNS uuid
-- LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
-- AS $desfaz$
--   SELECT CASE WHEN d.membro_a = _pessoa THEN d.membro_b ELSE d.membro_a END
--     FROM public.duplas d
--    WHERE d.ativa
--      AND (d.membro_a = _pessoa OR d.membro_b = _pessoa)
--    LIMIT 1;
-- $desfaz$;
-- REVOKE EXECUTE ON FUNCTION public.parceiro_da_dupla(uuid) FROM PUBLIC, anon;
-- GRANT  EXECUTE ON FUNCTION public.parceiro_da_dupla(uuid) TO authenticated, service_role;
--
-- -- 1.6 …e o gatilho de apoio volta ao corpo LITERAL da U64
-- CREATE OR REPLACE FUNCTION public.chamado_apoio_da_dupla()
-- RETURNS trigger
-- LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
-- AS $desfaz$
-- DECLARE v_parceiro uuid;
-- BEGIN
--   IF NEW.natureza <> 'campo' THEN RETURN NEW; END IF;
--   IF TG_OP = 'UPDATE' AND NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id THEN
--     DELETE FROM public.chamado_apoios
--      WHERE chamado_id = NEW.id
--        AND origem = 'dupla'
--        AND profile_id IS DISTINCT FROM public.parceiro_da_dupla(NEW.responsavel_id);
--   END IF;
--   IF NEW.responsavel_id IS NULL THEN RETURN NEW; END IF;
--   v_parceiro := public.parceiro_da_dupla(NEW.responsavel_id);
--   IF v_parceiro IS NULL THEN RETURN NEW; END IF;
--   INSERT INTO public.chamado_apoios (chamado_id, profile_id, origem)
--   VALUES (NEW.id, v_parceiro, 'dupla')
--   ON CONFLICT (chamado_id, profile_id) DO NOTHING;
--   RETURN NEW;
-- END;
-- $desfaz$;
-- DROP TRIGGER IF EXISTS trg_chamado_apoio_dupla_upd ON public.chamados;
-- CREATE TRIGGER trg_chamado_apoio_dupla_upd
--   AFTER UPDATE OF responsavel_id ON public.chamados
--   FOR EACH ROW EXECUTE FUNCTION public.chamado_apoio_da_dupla();
--
-- -- 1.7 NÃO apague os apoios que a U76 gravou. O comando nuclear da U64
-- --     (DELETE ... WHERE origem='dupla') levaria junto os apoios corretos
-- --     gravados desde sempre. Os que a U76 escreveu são de gente que ESTAVA
-- --     escalada. Para só olhar:
-- --     SELECT * FROM public.chamado_apoios
-- --      WHERE origem='dupla' AND created_at >= DATE '2026-08-31';
--
-- -- 1.8 membro_a volta a ser NOT NULL — SÓ se ninguém criou turma sem ele:
-- --     SELECT id, nome FROM public.duplas WHERE membro_a IS NULL;
-- --     (a composição delas está em duplas_escala; preencha e então)
-- -- ALTER TABLE public.duplas ALTER COLUMN membro_a SET NOT NULL;
--
-- COMMIT;
--
-- Neste ponto o sistema se comporta como antes da U76, e as tabelas de escala
-- continuam lá, intactas e sem ninguém lendo.

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ NÍVEL 2 — APAGA A ESCALA. IRREVERSÍVEL. Só depois do nível 1.        ║
-- ╚══════════════════════════════════════════════════════════════════════╝
-- ATENÇÃO: a partir daqui perde-se TODA a composição por semana lançada depois
-- da migração. membro_a/membro_b só sabem falar do DIA DA MIGRAÇÃO (mais o que
-- o espelho escreveu) — tudo que mudou desde então mora só em duplas_escala.
--
-- BEGIN;
--
-- -- 2.1 BACKUP PRIMEIRO. Não é sugestão. Cópia sem FK, sem RLS e sem trigger:
-- --     é papel carbono, e é o que permite reconstruir.
-- CREATE TABLE IF NOT EXISTS public.zz_backup_duplas_escala_u76 AS
--   SELECT *, now() AS copiado_em FROM public.duplas_escala;
-- CREATE TABLE IF NOT EXISTS public.zz_backup_duplas_escala_semanas_u76 AS
--   SELECT *, now() AS copiado_em FROM public.duplas_escala_semanas;
-- SELECT (SELECT count(*) FROM public.zz_backup_duplas_escala_u76) AS linhas,
--        (SELECT count(*) FROM public.zz_backup_duplas_escala_semanas_u76) AS semanas;
--
-- -- 2.2 as funções saem antes das tabelas (senão ficam quebradas e invisíveis)
-- DROP FUNCTION IF EXISTS public.reconciliar_apoios_abertos(text);
-- DROP FUNCTION IF EXISTS public.chamado_sincronizar_apoio(uuid);
-- DROP FUNCTION IF EXISTS public.escala_definir(uuid, text, uuid[], boolean);
-- DROP FUNCTION IF EXISTS public.abrir_escala_semana(text);
-- DROP FUNCTION IF EXISTS public.duplas_espelhar_na_escala() CASCADE;
-- DROP FUNCTION IF EXISTS public.duplas_liberar_escala_futura() CASCADE;
-- DROP FUNCTION IF EXISTS public.duplas_escala_valida() CASCADE;
-- DROP FUNCTION IF EXISTS public.parceiro_da_dupla(uuid, date);
-- DROP FUNCTION IF EXISTS public.parceiros_da_dupla(uuid, date);
-- DROP FUNCTION IF EXISTS public.dupla_da_pessoa(uuid, date);
-- DROP FUNCTION IF EXISTS public.escala_da_semana(text);
-- DROP FUNCTION IF EXISTS public.escala_semana_vigente(text);
-- DROP FUNCTION IF EXISTS public.dia_da_dupla(timestamptz, timestamptz);
-- -- referencia_semanal(date) é utilitário genérico e não custa nada manter:
-- -- DROP FUNCTION IF EXISTS public.referencia_semanal(date);
--
-- -- 2.3 as tabelas (a de escala primeiro: ela referencia a de semanas)
-- DROP TABLE IF EXISTS public.duplas_escala;
-- DROP TABLE IF EXISTS public.duplas_escala_semanas;
--
-- COMMIT;
--
-- -- 2.4 (opcional, também irreversível) o veículo. Manter a coluna não
-- --     atrapalha nada; apagá-la perde o que o Davi digitou:
-- -- ALTER TABLE public.duplas DROP COLUMN IF EXISTS veiculo;
-- ═══════════════════════════════════════════════════════════════════════════
