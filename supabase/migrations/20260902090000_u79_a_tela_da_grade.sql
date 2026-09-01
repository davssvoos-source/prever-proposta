-- ═══════════════════════════════════════════════════════════════════════════
-- U79 — A TELA DA GRADE: AS QUATRO PORTAS ABREM
--        (R99/R100/R101/R102 — Fase 1, Passo 1.2, a metade de cima)
--
-- >>> RODAR NO SQL EDITOR DO SUPABASE, À MÃO, **DEPOIS DA U78** e ANTES do
-- >>> deploy da tela. GRANT é idempotente por natureza: rodar de novo é no-op.
-- >>> Esta migration NÃO cria tabela, NÃO cria função, NÃO toca uma linha de
-- >>> dado e NÃO reescreve corpo de função nenhum. Ela faz UMA coisa: abre a
-- >>> `authenticated` as quatro portas de escrita da agenda de campo.
--
-- ── POR QUE ESTAS QUATRO LINHAS NÃO ESTAVAM NA U78 ─────────────────────────
-- A U78 se declara ADITIVA e INERTE, e pagou o preço de sê-lo: as quatro RPCs
-- do §6 nasceram concedidas SÓ a `service_role`, com as quatro linhas de GRANT
-- prontas e COMENTADAS no rodapé dela ("AS QUATRO PORTAS, QUANDO A TELA
-- CHEGAR"). O argumento, verbatim de lá: sem tela não há consumidor, e uma
-- porta de escrita concedida a todo autenticado sem consumidor é só superfície
-- de ataque — a chave publishable está no `.env` VERSIONADO, e
-- `POST /rest/v1/rpc/desagendar_chamado` apaga `data_hora_agendada` de um
-- chamado de campo com UMA requisição, sem bloco nenhum envolvido.
--
-- AGORA EXISTE ALGUÉM DO OUTRO LADO. `src/features/programacao/data.ts` chama
-- as quatro, e `src/routes/_authenticated/chamados.programacao.tsx`,
-- `chamados.novo-campo.tsx` e `PainelChamado.tsx` deixaram de escrever
-- `chamados.data_hora_agendada` direto. Abrir a porta passa a ser uma decisão
-- com consequência visível, que é o que a U78 pediu que fosse.
--
-- ── AS TRÊS COISAS QUE A U78 MANDOU CONFERIR ANTES DE COLAR (rodapé, :2750) ─
--   1. O GATE DE ESCALA DO §6.1 É O QUE O DAVI QUER. Sim — a decisão está
--      tomada e escrita ("A DECISÃO DE FRONTEIRA", cabeçalho da U78): gate em
--      camadas, `is_gestor` OU (pode editar o que sai E o que entra E está
--      escalado naquela equipe naquela semana). Ele preserva o técnico que hoje
--      reagenda o próprio atendimento pelo PainelChamado, e essa é justamente a
--      superfície que esta entrega mantém viva (o painel continua editando o
--      bloco único). Se o Davi preferir gestor-só um dia, o custo é UMA linha
--      no §6.1 da U78 — e o custo do caminho contrário seria reconstruir as
--      três camadas.
--   2. A TELA NÃO ESCREVE `chamados.data_hora_agendada` POR FORA. Esta é a
--      condição dura, e ela é do CÓDIGO, não do banco — nenhum SELECT daqui
--      consegue prová-la. Quem a prova é o verificador, com um CENSO por
--      varredura: `node scripts/verificar-logica.cjs` deriva do `src/` a lista
--      de arquivos que escrevem a coluna e a compara com a lista escrita à mão
--      dos CINCO escritores COMERCIAIS (VisitaForm, NovaVisitaDialog,
--      gerencial.nova, visita.$id.pendente, visita.$id.reagendar), que gravam
--      `visitas_tecnicas` e são de outro dono (o gatilho da U41). Nasceu um
--      escritor de CAMPO? O censo acusa antes do deploy.
--   3. A LINHA 209 DA CONFERÊNCIA DA U78 VAI PASSAR A DIZER '>>> OLHAR <<<'
--      COM O VALOR 4. É o certo, e é bom que doa: quer dizer que a fronteira
--      mudou. Quem afirma o novo estado é a linha 101 daqui, e o CENSO da 102.
--
-- ── E O QUE ESTA MIGRATION SE RECUSA A FAZER ───────────────────────────────
-- · Não concede `agenda_campo_frase_do_conflito`. Ela é chamada de dentro das
--   portas, que já rodam como dono (SECURITY DEFINER). Abrir
--   /rest/v1/rpc/agenda_campo_frase_do_conflito seria dar de graça um probe de
--   agenda com resposta em TEXTO — a linha 105 confere que ela continua
--   fechada.
-- · Não concede INSERT/UPDATE/DELETE em `public.agenda_campo`. A porta é a RPC,
--   que é quem autoriza os dois lados do gesto, nomeia o conflito e checa a
--   jornada. A linha 104 confere.
-- · Não semeia bloco nenhum. "NÃO HÁ BACKFILL, DE PROPÓSITO" (U64/U78): 12:00
--   na base significa duas coisas indistinguíveis por valor, e chutar uma
--   duração envenenaria o chip de ocupação com um número inventado que tem cara
--   de medição. A linha 106 conta quantos chamados começam a vida na faixa
--   "agendado sem horário" — é o denominador da barra de progresso, e o Davi o
--   vê ANTES de abrir a tela.
--
-- ── ORDEM DAS SEÇÕES ───────────────────────────────────────────────────────
--   §1 pré-voo    ← aborta se qualquer pressuposto for falso
--   §2 os quatro GRANT (copiados VERBATIM do rodapé da U78, linhas 2760-2763)
--   §3 conferência ← obtido × esperado × veredito, no CATÁLOGO
-- Tudo em UMA transação, pelo mesmo motivo da U78: qualquer RAISE devolve o
-- privilégio ao estado exato de antes.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- §1) PRÉ-VOO — as pressuposições, uma a uma, com aborto
-- ═══════════════════════════════════════════════════════════════════════
-- `to_regprocedure` com a ASSINATURA EXATA, e não `proname`, por um motivo
-- medido: `GRANT EXECUTE ON FUNCTION public.agenda_campo_cumprir(uuid)` (sem o
-- `boolean`) falha com "function ... does not exist", e às 23h essa mensagem
-- manda o Davi caçar a função — que existe — em vez de a assinatura. Perguntar
-- antes, pelo catálogo, transforma a caçada numa frase.
DO $$
DECLARE
  v_faltando text[] := ARRAY[]::text[];
  v_assinatura text;
BEGIN
  FOREACH v_assinatura IN ARRAY ARRAY[
    'public.agenda_campo_marcar(uuid,uuid,uuid,date,int,int,int,text,text)',
    'public.agenda_campo_cancelar(uuid)',
    'public.agenda_campo_cumprir(uuid,boolean)',
    'public.desagendar_chamado(uuid)'
  ] LOOP
    IF to_regprocedure(v_assinatura) IS NULL THEN
      v_faltando := v_faltando || v_assinatura;
    END IF;
  END LOOP;

  IF array_length(v_faltando, 1) IS NOT NULL THEN
    RAISE EXCEPTION E'PRÉ-VOO U79: estas portas não existem com esta assinatura: %.\nA U78 (20260901090000_u78_grade_da_programacao.sql) não rodou, rodou pela metade, ou alguém mudou uma assinatura. Rode a U78 primeiro.',
      array_to_string(v_faltando, ', ');
  END IF;

  IF to_regclass('public.agenda_campo') IS NULL THEN
    RAISE EXCEPTION 'PRÉ-VOO U79: public.agenda_campo não existe. A U78 não rodou.';
  END IF;

  -- A TELA CHAMA `is_gestor` DIRETO (é assim que ela sabe se quem olha é
  -- gestor, em vez de re-derivar de profiles.cargo — que seria a segunda
  -- verdade sobre quem manda). Se ela não estiver concedida, a grade decide
  -- "não é gestor" para TODO MUNDO, em silêncio, e a afordância inteira
  -- desaparece sem uma linha de erro. Melhor abortar aqui.
  IF NOT has_function_privilege('authenticated', 'public.is_gestor(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PRÉ-VOO U79: is_gestor(uuid) não está concedida a authenticated — a tela a chama direto e, sem ela, a grade trata todo mundo como não-gestor em silêncio.';
  END IF;
  -- `pode_editar_chamado` é o predicado que as portas cobram (S2). A tela tem
  -- um gêmeo LOCAL dele (montarAutorizacao, no modelo puro) para não fazer uma
  -- chamada por cartão; o gêmeo é AFORDÂNCIA, e quem autoriza continua sendo
  -- esta função. Ela precisa estar aberta porque `chamados_select` e as
  -- policies a consultam no caminho quente.
  IF NOT has_function_privilege('authenticated', 'public.pode_editar_chamado(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PRÉ-VOO U79: pode_editar_chamado(uuid) não está concedida a authenticated. A S2 não rodou?';
  END IF;

  -- Se alguém abriu a escrita DIRETA na tabela entre a U78 e agora, esta
  -- migration estaria acrescentando superfície em cima de uma porta que já
  -- deixou de ser única. Dizer isso antes é mais barato do que descobrir na
  -- primeira gravação que pula a jornada inteira.
  IF has_table_privilege('authenticated', 'public.agenda_campo', 'INSERT')
     OR has_table_privilege('authenticated', 'public.agenda_campo', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.agenda_campo', 'DELETE') THEN
    RAISE EXCEPTION 'PRÉ-VOO U79: authenticated JÁ escreve direto em public.agenda_campo. A porta única deixou de ser única — conserte isso antes de abrir as RPCs.';
  END IF;
END
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- §2) AS QUATRO PORTAS
-- ═══════════════════════════════════════════════════════════════════════
-- Copiadas VERBATIM do rodapé da U78 (linhas 2760-2763). Elas pertencem a esta
-- migration desde que foram escritas; o arquivo da U78 só as guardou.
--
-- O `REVOKE ... FROM PUBLIC, anon` de cada uma continua onde está (U78), e um
-- GRANT a `authenticated` não o desfaz: são roles diferentes, e `anon` não
-- herda `authenticated`. A linha 103 da conferência prova isso pelo catálogo em
-- vez de pelo raciocínio.
GRANT EXECUTE ON FUNCTION public.agenda_campo_marcar(uuid,uuid,uuid,date,int,int,int,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agenda_campo_cancelar(uuid)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.agenda_campo_cumprir(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.desagendar_chamado(uuid)            TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- ═══════════════════════════════════════════════════════════════════════
-- §2b) A GUARDA QUE FALTAVA: o espelho é do satélite, e agora isso é ESTRUTURA
-- ═══════════════════════════════════════════════════════════════════════
-- O QUE ESTA MIGRATION AFIRMAVA E NÃO CONSEGUIA PROVAR: "a tela não escreve
-- chamados.data_hora_agendada por fora". A afirmação é sobre o CÓDIGO, e o
-- censo do verificador a guarda no repositório — mas ela não alcança um curl.
--
-- `chamados_update` é `USING/WITH CHECK pode_editar_chamado(id)` (S1:418-424) e
-- não há REVOKE de coluna em public.chamados. A chave publishable está no .env
-- VERSIONADO. Então isto funcionava, para qualquer autenticado que respondesse
-- pelo chamado:
--
--   PATCH /rest/v1/chamados?id=eq.<uuid-de-campo>
--   {"data_hora_agendada": "2026-12-25T03:00:00Z"}
--
-- e NADA nunca recalcularia: o espelho só roda por gatilho em `agenda_campo`. A
-- divergência ficaria de pé até alguém, por acaso, mexer num bloco daquele
-- chamado. É a segunda verdade que a U78 inteira existe para matar, entrando
-- pela porta que a U78 não trancou.
--
-- POR QUE NÃO REVOKE DE COLUNA: é a cicatriz da S1b. `REVOKE UPDATE (coluna)`
-- é NO-OP quando existe `GRANT UPDATE` de tabela, e o conserto de verdade
-- (revogar a tabela e reconceder coluna a coluna) apodrece na primeira coluna
-- nova que alguém acrescentar a `chamados` — que é uma tabela viva. Uma guarda
-- que se auto-valida não enumera nada e não envelhece.
--
-- A REGRA: para chamado de CAMPO, o único valor aceito em data_hora_agendada é
-- o que os blocos dizem. É a consulta "quem não casou" do §9.0 da U78 virando
-- CONSTRAINT — e os dois estágios estão aqui por extenso porque a guarda tem de
-- calcular o que o gatilho calcula, ou ela recusa o próprio espelho.
--
-- O QUE ELA NÃO BLOQUEIA, e é o que a torna segura de rodar hoje:
--   · o espelho (§5 da U78) escreve exatamente este valor — passa sempre;
--   · o chamado LEGADO, com data e sem bloco nenhum, que é a base inteira no
--     dia 1: ninguém está escrevendo a coluna dele, e a guarda só acorda quando
--     o valor MUDA (`IS NOT DISTINCT FROM OLD` devolve cedo). Editar o título
--     de um chamado desses continua funcionando;
--   · desagendar, que escreve NULL: sem bloco pendente nem cumprido o esperado
--     também é NULL, e NULL casa com NULL.
-- O que ela bloqueia é exatamente o curl acima, e o UPDATE de qualquer tela
-- futura que se esqueça da regra.
CREATE OR REPLACE FUNCTION public.chamados_espelho_e_do_satelite()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $guarda$
DECLARE v_dia date; v_min int; v_esperado timestamptz;
BEGIN
  IF NEW.natureza IS DISTINCT FROM 'campo'
     OR NEW.data_hora_agendada IS NOT DISTINCT FROM OLD.data_hora_agendada THEN
    RETURN NEW;
  END IF;

  -- ESTÁGIO 1 — o bloco PENDENTE mais antigo (gêmeo literal do §5 da U78)
  SELECT a.dia, a.inicio_min INTO v_dia, v_min
    FROM public.agenda_campo a
   WHERE a.chamado_id = NEW.id
     AND a.cancelado_em IS NULL
     AND a.cumprido_em IS NULL
   ORDER BY a.dia, a.inicio_min, a.id
   LIMIT 1;

  -- ESTÁGIO 2 — todos cumpridos: vale o ÚLTIMO
  IF v_dia IS NULL THEN
    SELECT a.dia, a.inicio_min INTO v_dia, v_min
      FROM public.agenda_campo a
     WHERE a.chamado_id = NEW.id
       AND a.cancelado_em IS NULL
     ORDER BY a.dia DESC, a.inicio_min DESC, a.id DESC
     LIMIT 1;
  END IF;

  v_esperado := CASE WHEN v_dia IS NULL THEN NULL
                     ELSE (v_dia + make_interval(mins => v_min)) AT TIME ZONE 'America/Sao_Paulo'
                END;

  IF NEW.data_hora_agendada IS DISTINCT FROM v_esperado THEN
    RAISE EXCEPTION 'A data de um chamado de campo é ESPELHO dos blocos de agenda (R101): quem a escreve é agenda_campo_marcar ou desagendar_chamado, nunca um UPDATE direto. O que os blocos dizem hoje é %.',
      COALESCE(to_char(v_esperado AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'), 'nenhuma data')
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$guarda$;

DROP TRIGGER IF EXISTS trg_chamados_espelho_e_do_satelite ON public.chamados;
CREATE TRIGGER trg_chamados_espelho_e_do_satelite
  BEFORE UPDATE OF data_hora_agendada ON public.chamados
  FOR EACH ROW EXECUTE FUNCTION public.chamados_espelho_e_do_satelite();

COMMENT ON FUNCTION public.chamados_espelho_e_do_satelite() IS
  'Recusa qualquer escrita em chamados.data_hora_agendada de chamado de CAMPO '
  'que não seja o que os blocos de agenda_campo dizem (R101). Transforma "a '
  'tela não escreve a coluna por fora" de afirmação sobre o código em garantia '
  'do banco — o censo do verificador não alcança um curl com a chave '
  'publishable. Comercial passa direto: aquela agenda é do gatilho da U41.';

-- §3) CONFERÊNCIA — A TABELA DE VEREDITO É O ÚLTIMO RESULT SET
-- ═══════════════════════════════════════════════════════════════════════
-- O QUE O DAVI OLHA: a TABELA. Ele procura '>>> OLHAR <<<' na coluna
-- `veredito`. Nada mais. RAISE NOTICE é invisível no editor do Supabase, então
-- tudo que precisa ser visto sai em SELECT — e este é o único SELECT do
-- arquivo, para nada esconder o veredito.
--
-- PRIVILÉGIO NÃO MORA NO CORPO DA FUNÇÃO, MORA NO CATÁLOGO. Nenhuma linha aqui
-- procura substring em `prosrc`: `has_function_privilege` e
-- `has_table_privilege` são COMPORTAMENTO MEDIDO. É a mesma escolha da linha
-- 209 da U78, que é a linha que esta migration existe para virar.
SELECT t.ordem, t.conferencia, t.valor, t.esperado,
       CASE WHEN t.esperado = '(referência)'             THEN '— referência'
            WHEN t.valor IS NOT DISTINCT FROM t.esperado THEN 'ok'
            ELSE '>>> OLHAR <<<' END AS veredito
  FROM (

-- ── 101: a fronteira mudou, e o número é 4 ────────────────────────────────
-- Este é o par exato da linha 209 da U78 ('0' lá, '4' aqui). Lá a promessa era
-- "não há tela"; aqui a afirmação é "há tela, e são exatamente estas quatro".
SELECT 101 AS ordem,
       'CRÍTICO: as QUATRO portas de escrita da agenda agora chegam a authenticated — é a linha 209 da U78 mudando de valor, e é o que faz a tela existir' AS conferencia,
       (SELECT count(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.proname IN ('agenda_campo_marcar','agenda_campo_cancelar',
                             'agenda_campo_cumprir','desagendar_chamado')
           AND has_function_privilege('authenticated', p.oid, 'EXECUTE')) AS valor,
       '4' AS esperado

UNION ALL
-- ── 102: CENSO, e não contagem ────────────────────────────────────────────
-- Um GRANT parcial (três de quatro, porque uma assinatura mudou e o §1 não
-- pegou) sai como '3 ≠ 4' numa contagem e como QUAIS FALTAM num censo. É a
-- regra da casa ("censo, não asserção-por-caso") aplicada ao catálogo: a lista
-- é DERIVADA do estado do banco e comparada com uma lista escrita à mão.
SELECT 102, 'CENSO: e são exatamente ESTAS quatro, pelo nome — um GRANT parcial vira "quais faltam" em vez de um número que não localiza nada',
       (SELECT COALESCE(string_agg(p.proname, ',' ORDER BY p.proname), '(nenhuma)')
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.proname IN ('agenda_campo_marcar','agenda_campo_cancelar',
                             'agenda_campo_cumprir','desagendar_chamado')
           AND has_function_privilege('authenticated', p.oid, 'EXECUTE')),
       'agenda_campo_cancelar,agenda_campo_cumprir,agenda_campo_marcar,desagendar_chamado'

UNION ALL
-- ── 103: e anon continua de fora ──────────────────────────────────────────
-- A chave publishable está no `.env` VERSIONADO: `anon` é o mundo. Um GRANT a
-- `authenticated` não toca `anon` — mas quem prova isso é o catálogo, não o
-- raciocínio, e é por isso que a linha existe.
SELECT 103, 'CRÍTICO: nenhuma das quatro portas alcança anon — a chave publishable está no .env versionado, e anon é o mundo',
       (SELECT count(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.proname IN ('agenda_campo_marcar','agenda_campo_cancelar',
                             'agenda_campo_cumprir','desagendar_chamado')
           AND has_function_privilege('anon', p.oid, 'EXECUTE')), '0'

UNION ALL
-- ── 104: a porta continua ÚNICA ───────────────────────────────────────────
-- Abrir a RPC não pode ter aberto a tabela por tabela. Se `authenticated`
-- escrevesse direto, toda a autorização em camadas, a frase do conflito e a
-- jornada seriam contornáveis por um POST em /rest/v1/agenda_campo.
SELECT 104, 'CRÍTICO: authenticated continua SEM escrever direto na tabela — a porta é a RPC, que autoriza os dois lados, nomeia o conflito e checa a jornada',
       (has_table_privilege('authenticated','public.agenda_campo','INSERT')
     OR has_table_privilege('authenticated','public.agenda_campo','UPDATE')
     OR has_table_privilege('authenticated','public.agenda_campo','DELETE'))::text, 'false'

UNION ALL
-- ── 105: a frase do conflito continua fechada ─────────────────────────────
-- Ela roda SECURITY DEFINER e passa por cima de `chamados_select`. Concedida,
-- viraria um oráculo de enumeração com resposta em texto: uma requisição por
-- bloco devolve número, título e (no título) quase sempre o cliente. Ela é
-- chamada de DENTRO das portas, que já rodam como dono — não precisa de GRANT.
SELECT 105, 'CRÍTICO: agenda_campo_frase_do_conflito continua FECHADA — concedê-la seria um probe de agenda com resposta em texto, uma requisição por bloco',
       has_function_privilege('authenticated',
         'public.agenda_campo_frase_do_conflito(uuid,uuid,date,int,int)', 'EXECUTE')::text, 'false'

UNION ALL
-- ── 106: o denominador do dia 1 ───────────────────────────────────────────
-- Quantos chamados a tela vai mostrar na faixa "agendado sem horário" no
-- primeiro minuto. É o gêmeo exato do §9.7 da U78 e de `semHorario()` no modelo
-- puro: campo, não encerrado, COM data e SEM bloco ativo. É referência, não
-- veredito — o número certo é o que for, e ele só precisa ser VISTO antes de
-- alguém abrir a tela e se assustar com uma faixa cheia.
SELECT 106, 'referência: quantos chamados nascem na faixa "agendado sem horário" (é a barra de progresso da migração — ela ANDA, e some sozinha quando zerar)',
       (SELECT count(*)::text FROM public.chamados c
         WHERE c.natureza = 'campo'
           AND c.status NOT IN ('concluido','cancelado')
           AND c.data_hora_agendada IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM public.agenda_campo a
                            WHERE a.chamado_id = c.id AND a.cancelado_em IS NULL)),
       '(referência)'

UNION ALL
-- ── 107: e quantos já têm bloco ───────────────────────────────────────────
-- O outro termo da mesma fração. A faixa diz "N de M já têm horário", e os dois
-- números saem do MESMO censo — aqui como no `classificarChamado` da tela.
SELECT 107, 'referência: e quantos já têm horário de verdade (o outro termo da fração que a faixa mostra)',
       (SELECT count(*)::text FROM public.chamados c
         WHERE c.natureza = 'campo'
           AND c.status NOT IN ('concluido','cancelado')
           AND EXISTS (SELECT 1 FROM public.agenda_campo a
                        WHERE a.chamado_id = c.id AND a.cancelado_em IS NULL)),
       '(referência)'

) t ORDER BY t.ordem;

COMMIT;

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ DESFAZER                                                             ║
-- ╚══════════════════════════════════════════════════════════════════════╝
-- Fecha as quatro portas de novo. O efeito é imediato e é o estado da U78: todo
-- `supabase.rpc(...)` da tela volta a devolver 42501 para qualquer usuário
-- logado, e a grade fica somente-leitura de verdade (a leitura é
-- `agenda_campo_select USING (true)`, que não passa por aqui).
--
-- ANTES DE RODAR ISTO, saiba o que volta junto: as três telas religadas
-- (programação, novo-campo, PainelChamado) NÃO voltam a escrever
-- `chamados.data_hora_agendada` — elas perderam esse caminho no código, e o
-- `tsc` o barra (as duas portas de tipo em features/chamados/data.ts foram
-- fechadas). Ou seja, desfazer isto deixa a agenda de campo SEM caminho de
-- escrita nenhum até alguém reverter o deploy. É freio de emergência, não
-- rollback de rotina.
--
-- BEGIN;
--   REVOKE EXECUTE ON FUNCTION public.agenda_campo_marcar(uuid,uuid,uuid,date,int,int,int,text,text) FROM authenticated;
--   REVOKE EXECUTE ON FUNCTION public.agenda_campo_cancelar(uuid)         FROM authenticated;
--   REVOKE EXECUTE ON FUNCTION public.agenda_campo_cumprir(uuid, boolean) FROM authenticated;
--   REVOKE EXECUTE ON FUNCTION public.desagendar_chamado(uuid)            FROM authenticated;
-- COMMIT;
-- ═══════════════════════════════════════════════════════════════════════════
