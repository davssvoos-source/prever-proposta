-- ═══════════════════════════════════════════════════════════════════════════
-- U81 — O APOIO QUE JÁ FOI É REGISTRO (R107/R108 — Fase 1, Passo 1.4)
--
-- >>> RODAR NO SQL EDITOR DO SUPABASE, À MÃO, DEPOIS DA U80/S4. <<<
-- >>> O §1 ABORTA (e não deixa rastro: é tudo uma transação) se o corpo vivo <<<
-- >>> de chamado_sincronizar_apoio NÃO for o da U76, ou se alguém tiver      <<<
-- >>> ligado FORCE ROW LEVEL SECURITY em chamado_apoios.                     <<<
--
-- ── O DEFEITO QUE ELA FECHA ────────────────────────────────────────────────
-- Um chamado com DOIS blocos em semanas ISO diferentes — a visita de terça e o
-- retorno da quinta da semana seguinte. Carimbar o primeiro como "feito" faz o
-- espelho andar para o segundo (CORRETO: é o estágio 1 de
-- agenda_campo_espelhar, U78). Isso muda chamados.data_hora_agendada, o que
-- acorda trg_chamado_apoio_dupla_upd (U76), que vê v_mudou_semana = true e
-- chama chamado_sincronizar_apoio — que APAGA as linhas origem='dupla' da
-- turma que JÁ FOI e grava a turma da semana nova.
--
-- Ou seja: MARCAR A VISITA COMO FEITA APAGAVA O REGISTRO DE QUEM A FEZ. Sem
-- sino (trg_notify_chamado_apoio é AFTER INSERT), sem evento
-- (trg_chamado_evento_upd é OF status, responsavel_id, sprint) e sem
-- updated_at (a tabela não tem). O CLAUDE.md lista como invariante
-- não-regressível exatamente isto: "o apoio é GRAVADO, não derivado — apoio
-- responde QUEM FOI".
--
-- ── A FRASE DO DAVI (02/09), que é a decisão de produto ─────────────────────
--   "Se o retorno cai para outra semana, sem problemas nós podemos ou trocar o
--    apoio ou manter o mesmo, de qualquer forma será computado POR VISITA e
--    não por obra completa."
--
-- Ela tem DUAS metades, e elas respondem a perguntas diferentes:
--   1ª "trocar ou manter, sem problemas" — é uma PERMISSÃO: a máquina tem de
--      parar de forçar uma resposta. É o que esta migration entrega.
--   2ª "computado POR VISITA" — é uma CONTAGEM, e ela NÃO É ENTREGUE AQUI.
--      Está declarado por extenso em R107 e no §5 do diário. Ver "O QUE ESTA
--      MIGRATION NÃO FAZ", logo abaixo.
--
-- ── O DESENHO: CONGELAR POR MARCA, NÃO POR GUARDA ──────────────────────────
-- chamado_apoios ganha UMA COLUNA ANULÁVEL (congelado_em). O carimbo de
-- "feito" CONGELA as linhas origem='dupla' daquele chamado, e o DELETE de
-- chamado_sincronizar_apoio ganha UMA LINHA: AND a.congelado_em IS NULL.
--
-- A saída óbvia — "não rode sincronizar quando existir bloco cumprido" — é
-- STATELESS: ela re-deriva a decisão a cada chamada, e o botão "Tirar o feito"
-- (agenda_campo_cumprir(id, false)) a desfaz com um clique; a história volta a
-- ser apagável. A MARCA é MONOTÔNICA: congelado_em só vai de NULL para um
-- instante, e NADA nesta migration o devolve. É o que "registro é registro"
-- quer dizer em DDL.
--
-- E a alternativa que eu também recusei, dita por extenso porque ela é
-- sedutora e curta — proteger por RE-DERIVAÇÃO, um NOT EXISTS contra
-- escala_da_semana(referencia_semanal(bloco.dia)):
--   escala_definir (U76:601-663) NÃO recusa semana passada, e
--   escala_semana_vigente é max(semana) <= W (U76:415-420) — logo abrir uma
--   semana INTERMEDIÁRIA também muda a resposta de W. O conjunto protegido
--   mudaria retroativamente: reescrever a S36 hoje faria alguém DEIXAR de
--   estar protegido amanhã, e a próxima sincronização o apagaria. Seria um
--   congelamento que descongela sozinho — e derivar "quem foi" da escala é
--   literalmente o que a U64 proibiu em prosa (:11-26).
--
-- ── O QUE ESTA MIGRATION NÃO FAZ ───────────────────────────────────────────
-- · NÃO cria agenda_campo_equipe (o apoio pendurado no BLOCO). A U78:171 já
--   nomeou esse caminho estrutural, e ele continua sendo o certo — DEPOIS. O
--   pré-requisito de contar por visita não é o formato da tabela: é a operação
--   carimbar "feito" com disciplina, e hoje existe UMA ÚNICA MÃO no sistema
--   inteiro que faz isso (o clique de FormularioDoBloco.tsx:616). A segunda
--   mão que a U78:1566-1568 prometeu — executarChamado marcando os blocos
--   abertos — NÃO EXISTE: src/features/chamados/data.ts:281-293 escreve só
--   status e carimbos em chamados. A conferência 110 abaixo REPETE a
--   conferência 112 da U80 de propósito: enquanto esse número não estiver
--   perto de zero, uma métrica "visitas por técnico" subcontaria justamente o
--   técnico que não clica, e publicar isso destruiria a disciplina do carimbo
--   que as duas saídas precisam. A ordem é: (1) parar de apagar; (2) a segunda
--   mão do carimbo; (3) só então a cardinalidade por visita.
-- · NÃO toca chamado_apoio_da_dupla(), reconciliar_apoios_abertos(),
--   agenda_campo_cumprir(), agenda_campo_espelhar() nem NENHUMA das seis
--   funções/policies de autorização que leem apoio (pode_editar_chamado,
--   pode_acessar_chamado, chamados_select, pode_ver_cliente,
--   pode_ver_prospeccao, chamado_compra_select). Zero policy, zero GRANT.
--   Como a proteção é propriedade da LINHA e não guarda no CAMINHO, ela vale
--   igualmente para os dois chamadores — inclusive para a reconciliação, que
--   chama a função direto e pula o gatilho.
-- · E ISSO TEM UM PREÇO NA RECONCILIAÇÃO, dito aqui porque é fácil de vender
--   como ganho e não é. `reconciliar_apoios_abertos` (U76 §8.4) existe para UM
--   caso: o apoio nasceu da escala HERDADA porque a semana ainda não estava
--   aberta, e o gestor abriu a semana depois e corrigiu a composição. Se o
--   bloco daquela semana já tiver sido carimbado, a linha errada está
--   CONGELADA: o DELETE não a alcança, o INSERT acrescenta a pessoa certa, o
--   GET DIAGNOSTICS conta 1, e a função devolve "1 chamado corrigido" com o
--   nome errado ainda na lista. O gestor lê sucesso e vai embora. A saída passa
--   a ser humana — o X do chip — e nada na tela avisa disso. A conferência 115
--   mede essa população para que ela não seja só uma frase, e o backfill do §5
--   congela os palpites herdados que já existem hoje (P26). Aceito: o preço de
--   errar para o lado de GUARDAR é uma linha a mais; o de errar para o lado de
--   APAGAR é registro que não volta.
-- · NÃO insere e NÃO apaga uma única linha de chamado_apoios. O backfill do §5
--   é um UPDATE de uma coluna que acabou de nascer — a prova de que nada sumiu
--   é a conferência 105, e ela é mais forte do que "copiou e a contagem bate":
--   NÃO HOUVE CÓPIA.
-- · NÃO toca sino nenhum. trg_notify_chamado_apoio é AFTER **INSERT**; esta
--   migration não insere. Não é preciso DISABLE TRIGGER (o precedente de carga
--   u59:420/480, u61:396/503 não se aplica), e não desligar é melhor: gatilho
--   desligado que alguém esquece de religar é uma cicatriz conhecida da casa.
--
-- ── O QUE ELA MUDA E QUE NÃO ESTAVA NO BRIEFING (R108) ─────────────────────
-- Linha origem='dupla' CONCEDE pode_editar_chamado e pode_acessar_chamado pela
-- terceira perna da S2 (:136-141, :159-162). Congelar significa que, num
-- chamado de bloco ÚNICO já cumprido, TROCAR O RESPONSÁVEL passa a ACUMULAR:
-- a turma antiga fica (congelada, o DELETE não a alcança) e a nova entra. As
-- duas passam a ver e editar o chamado, o cliente, o local, as fotos, o
-- checklist e o pedido de compra. A promessa da U76 ("apoio segue o
-- responsável") continua inteira no que ela prometia — a turma nova É
-- atribuída —, mas o descarte da antiga era efeito colateral dela, e o efeito
-- colateral acaba aqui. A saída é HUMANA e continua aberta: o X do chip
-- (removerApoio passa por chamado_apoios_delete, que não olha origem nem
-- congelado_em). Fechar esse X seria trancar a porta com o erro dentro.
--
-- ── ORDEM DAS SEÇÕES ───────────────────────────────────────────────────────
--   §1 pré-voo + a FOTO   ← aborta se qualquer pressuposto for falso
--   §2 a coluna
--   §3 o gatilho do congelamento (BEFORE, e o §3 explica por quê)
--   §4 o DELETE para de apagar registro (uma linha, e um DIFF a prova)
--   §5 backfill            ← zero INSERT, zero DELETE
--   §6 conferência         ← obtido × esperado × veredito
-- Tudo em UMA transação, e a tabela de veredito é o ÚLTIMO result set (o
-- COMMIT vem depois dela, como na U79/U80): RAISE NOTICE é invisível no editor
-- do Supabase, então tudo que precisa ser visto sai em SELECT.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- §1) PRÉ-VOO — as pressuposições, uma a uma, com aborto
-- ═══════════════════════════════════════════════════════════════════════
-- O PRÉ-VOO VEM ANTES DA FOTO, e a ordem foi corrigida de propósito. A foto lê
-- `chamado_apoios` e `notificacoes`; se um desses pressupostos for falso, é a
-- foto que estoura primeiro e o Davi recebe `relation ... does not exist` —
-- exatamente a mensagem crua que o pré-voo existe para substituir por uma que
-- diz o que fazer. O argumento de "a foto antes de qualquer escrita" continua
-- de pé: o pré-voo só LÊ.
DO $preflight$
DECLARE
  v_src   text;
  v_falta text[] := ARRAY[]::text[];
  v_force boolean;
BEGIN
  IF to_regclass('public.chamado_apoios') IS NULL THEN
    RAISE EXCEPTION 'PRÉ-VOO U81: public.chamado_apoios não existe.';
  END IF;
  IF to_regclass('public.agenda_campo') IS NULL THEN
    RAISE EXCEPTION 'PRÉ-VOO U81: public.agenda_campo não existe. A U78 não rodou.';
  END IF;
  -- A conferência 107 (nenhum sino nasceu) depende desta tabela, e a foto logo
  -- abaixo a lê. Sem esta guarda o erro viria da foto, cru.
  IF to_regclass('public.notificacoes') IS NULL THEN
    RAISE EXCEPTION 'PRÉ-VOO U81: public.notificacoes não existe — a conferência 107 não teria como provar que nenhum sino nasceu.';
  END IF;

  -- `to_regprocedure` com a ASSINATURA EXATA, e não `proname`: a cicatriz da
  -- U79 (:80-83) é que um GRANT sem o argumento certo falha dizendo que a
  -- função não existe, e às 23h essa mensagem manda caçar a função em vez da
  -- assinatura.
  IF to_regprocedure('public.referencia_semanal(date)') IS NULL THEN
    v_falta := v_falta || 'referencia_semanal(date)'; END IF;
  IF to_regprocedure('public.dia_da_dupla(timestamptz,timestamptz)') IS NULL THEN
    v_falta := v_falta || 'dia_da_dupla(timestamptz,timestamptz)'; END IF;
  IF to_regprocedure('public.escala_semana_vigente(text)') IS NULL THEN
    v_falta := v_falta || 'escala_semana_vigente(text)'; END IF;
  IF to_regprocedure('public.chamado_sincronizar_apoio(uuid)') IS NULL THEN
    v_falta := v_falta || 'chamado_sincronizar_apoio(uuid)'; END IF;
  IF array_length(v_falta, 1) IS NOT NULL THEN
    RAISE EXCEPTION E'PRÉ-VOO U81 — nada foi alterado (ROLLBACK).\nFaltam da U76: %',
      array_to_string(v_falta, ', ');
  END IF;

  -- O CORPO VIVO É O DA U76? A U81 vai REESCREVÊ-LO. Reescrever por cima de
  -- uma versão que eu não li é o jeito de apagar a correção de outra pessoa sem
  -- que ninguém veja (precedente: U78:505). Os dois termos abaixo são os que a
  -- U81 preserva palavra por palavra — se algum sumiu, o corpo é outro.
  SELECT p.prosrc INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'chamado_sincronizar_apoio';

  IF position('NOT (a.profile_id = ANY (v_alvo))' in COALESCE(v_src, '')) = 0
     OR position('escala_semana_vigente' in COALESCE(v_src, '')) = 0 THEN
    RAISE EXCEPTION E'PRÉ-VOO U81 — nada foi alterado (ROLLBACK).\npublic.chamado_sincronizar_apoio(uuid) NÃO é a versão da U76: falta o DELETE por v_alvo ou a chamada de escala_semana_vigente.\nO QUE FAZER: rode  SELECT prosrc FROM pg_proc WHERE proname = ''chamado_sincronizar_apoio'';  descubra quem a trocou, e só então decida. NÃO force esta migration.';
  END IF;

  IF position('congelado_em' in COALESCE(v_src, '')) > 0 THEN
    RAISE NOTICE 'U81 já aplicada ao corpo de chamado_sincronizar_apoio — seguindo (idempotente).';
  END IF;

  -- A ÚNICA FALHA MUDA DESTE DESENHO, e ela morre aqui. O congelamento é um
  -- UPDATE em chamado_apoios, e NÃO EXISTE policy de UPDATE nesta tabela
  -- (S3:89-91: "não há GRANT de UPDATE, nunca houve"). Ele funciona porque o
  -- dono da tabela passa por cima da RLS — o que deixa de ser verdade no
  -- instante em que alguém liga FORCE ROW LEVEL SECURITY. A partir daí o
  -- congelamento casaria ZERO linhas, em silêncio, e a U81 viraria decoração
  -- sem uma linha de erro. Nenhuma tabela deste repo tem FORCE hoje; esta
  -- checagem é o que impede que isso vire folclore.
  SELECT c.relforcerowsecurity INTO v_force
    FROM pg_class c WHERE c.oid = 'public.chamado_apoios'::regclass;
  IF COALESCE(v_force, false) THEN
    RAISE EXCEPTION E'PRÉ-VOO U81 — nada foi alterado (ROLLBACK).\npublic.chamado_apoios está com FORCE ROW LEVEL SECURITY, e NÃO existe policy de UPDATE nesta tabela: o congelamento casaria zero linhas EM SILÊNCIO.\nO QUE FAZER: ou desligue o FORCE, ou acrescente uma policy de UPDATE para o dono ANTES de rodar esta migration.';
  END IF;
END
$preflight$;

-- A FOTO, agora que os pressupostos estão provados e antes de qualquer ESCRITA:
-- a prova de que nada some sai daqui, e ela é UMA LINHA. ON COMMIT DROP porque
-- ela não é dado, é evidência de uma execução.
CREATE TEMP TABLE u81_foto ON COMMIT DROP AS
SELECT (SELECT count(*) FROM public.chamado_apoios)                         AS apoios_antes,
       (SELECT count(*) FROM public.chamado_apoios WHERE origem = 'dupla')  AS dupla_antes,
       (SELECT count(*) FROM public.chamado_apoios WHERE origem = 'manual') AS manual_antes,
       (SELECT count(*) FROM public.notificacoes WHERE tipo = 'chamado_apoio') AS sinos_antes;

-- ═══════════════════════════════════════════════════════════════════════
-- §2) A COLUNA
-- ═══════════════════════════════════════════════════════════════════════
-- ANULÁVEL, SEM DEFAULT, E ISSO É A SEMÂNTICA: NULL quer dizer "linha VIVA — o
-- automatismo ainda responde por ela". Um instante quer dizer "o automatismo
-- SOLTOU esta linha: a visita a que ela corresponde foi afirmada".
--
-- O QUE ELA NÃO É: não é "quando a visita aconteceu" (isso é
-- agenda_campo.cumprido_em) e não é "quando a pessoa foi posta" (isso é
-- created_at). É quando a linha deixou de ser cadastro e virou registro.
--
-- SÓ TEM SIGNIFICADO EM origem='dupla'. Linha 'manual' nunca esteve sob o
-- automatismo — o DELETE de U76:1030-1033 nunca a alcançou —, então congelá-la
-- seria afirmar que ela foi solta por quem nunca a segurou.
--
-- SEM GRANT, E ISSO NÃO É ESQUECIMENTO. A S3 fez REVOKE INSERT na tabela e
-- devolveu POR COLUNA (GRANT INSERT (chamado_id, profile_id)): coluna nova não
-- entra num grant por coluna. E UPDATE nunca existiu aqui. Logo congelado_em
-- nasce INESCREVÍVEL PELO CLIENTE sem eu escrever uma linha — e as
-- conferências 102 e 103 PROVAM isso pelo catálogo, em vez de afirmar. O
-- SELECT continua sendo de TABELA (S3:80-87, de propósito), então o `select *`
-- do PostgREST não quebra: a cicatriz da S1b é sobre REVOKE de coluna em
-- SELECT, e ela não se repete aqui.
ALTER TABLE public.chamado_apoios
  ADD COLUMN IF NOT EXISTS congelado_em timestamptz;

COMMENT ON COLUMN public.chamado_apoios.congelado_em IS
  'NULL = linha viva: o automatismo da escala (chamado_sincronizar_apoio) ainda '
  'a reescreve. Preenchida = REGISTRO: alguém carimbou "feito" no bloco da '
  'semana desta linha, e o automatismo a soltou para sempre. Monotônica — nada '
  'na máquina a devolve para NULL, inclusive tirar o "feito". Só tem sentido em '
  'origem=dupla. O valor é o timestamp da TRANSAÇÃO: linhas congeladas no mesmo '
  'carimbo compartilham o instante, e é isso que dá a ORDEM DAS IDAS na tela '
  '(idasDoApoio, no modelo puro). Correção continua sendo humana: removerApoio '
  'pela tela — não há GRANT de UPDATE nesta tabela.';

-- A segunda metade da foto, e ela só pode ser tirada AGORA porque a coluna
-- acabou de nascer. Numa segunda execução este número já não é zero, e é
-- exatamente por isso que a conferência 107 mostra a DIFERENÇA e não o total:
-- idempotência que se mede é idempotência que se prova.
CREATE TEMP TABLE u81_foto_congelado ON COMMIT DROP AS
SELECT (SELECT count(*) FROM public.chamado_apoios WHERE congelado_em IS NOT NULL) AS congelados_antes,
       (SELECT count(DISTINCT chamado_id) FROM public.chamado_apoios
         WHERE congelado_em IS NOT NULL) AS chamados_antes;

-- ═══════════════════════════════════════════════════════════════════════
-- §3) O GATILHO DO CONGELAMENTO
-- ═══════════════════════════════════════════════════════════════════════
-- BEFORE, E O "BEFORE" NÃO É ESTÉTICA — É A ÚNICA ORDEM QUE O POSTGRES GARANTE
-- SEM DEPENDER DO NOME DO GATILHO.
--
-- Na mesma linha de agenda_campo, `cumprido_em` acorda também
-- trg_agenda_campo_espelho_upd (U78:948-951, AFTER), que move
-- chamados.data_hora_agendada, que acorda trg_chamado_apoio_dupla_upd (U76),
-- que chama o DELETE. Se o congelamento fosse AFTER, quem chega primeiro seria
-- decidido pela ORDEM ALFABÉTICA DO NOME do gatilho — e um rename futuro
-- reabriria o defeito em silêncio, sem uma linha de diff que o denuncie. TODO
-- gatilho BEFORE de linha roda antes de TODO gatilho AFTER de linha. Estrutura,
-- não convenção.
--
-- E OS VIZINHOS BEFORE são inertes aqui: trg_agenda_campo_valida é
-- `OF chamado_id, dia, inicio_min` (U78:786) e não acorda num UPDATE de
-- cumprido_em; e ele nunca devolve NULL (devolve NEW ou levanta), então não
-- existe o caso "congelei e a linha foi descartada".
CREATE OR REPLACE FUNCTION public.apoio_congelar_da_visita()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $congelar$
DECLARE
  v_natureza text;
  v_agendada timestamptz;
  v_criado   timestamptz;
BEGIN
  -- Bloco de serviço fora do sistema não tem apoio a congelar.
  IF NEW.chamado_id IS NULL THEN RETURN NEW; END IF;

  -- SÓ A SUBIDA. Tirar o "feito" NÃO DESCONGELA: o congelamento registrou que
  -- alguém AFIRMOU que a visita aconteceu, e desafirmar não a desacontece. Se
  -- descongelasse, o botão "Tirar o feito" viraria o botão "apagar quem foi",
  -- que é o defeito de volta com outra roupa.
  IF NEW.cumprido_em IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' THEN
    -- OLD só é tocado DENTRO deste ramo: em gatilho de INSERT, OLD não está
    -- atribuído, e o AND de SQL não promete curto-circuito.
    IF OLD.cumprido_em IS NOT NULL THEN RETURN NEW; END IF;
  END IF;

  SELECT c.natureza, c.data_hora_agendada, c.created_at
    INTO v_natureza, v_agendada, v_criado
    FROM public.chamados c WHERE c.id = NEW.chamado_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF v_natureza IS DISTINCT FROM 'campo' THEN RETURN NEW; END IF;

  -- SEM DATA NÃO SE CONGELA. Com data_hora_agendada NULL, dia_da_dupla cai em
  -- created_at — o palpite que a U78 §7.1 declarou não-confiável. Congelar
  -- contra um palpite promoveria o palpite a registro.
  IF v_agendada IS NULL THEN RETURN NEW; END IF;

  -- A TURMA GRAVADA É A DESTA IDA? Carimbar "feito" no RETORNO antes da visita
  -- é possível (nada ordena os carimbos, e há um botão por bloco). Nesse caso o
  -- espelho ainda aponta para a IDA pendente, o apoio gravado é a turma da IDA,
  -- e congelá-lo aqui carimbaria a turma ERRADA como quem fez o retorno.
  -- ONDE A TURMA DO RETORNO É SALVA: NÃO É AQUI. Sair por esta porta deixaria a
  -- turma do retorno desprotegida para sempre, porque quando a ida for
  -- carimbada o espelho pula para o retorno e a turma dele é escrita pela
  -- `chamado_sincronizar_apoio` — e este gatilho nunca mais dispara para aquele
  -- bloco, já que `cumprido_em` só transiciona de NULL uma vez. Quem fecha esse
  -- caso é a SEGUNDA METADE DA TRAVA, no §4: a linha nasce congelada quando a
  -- semana em que ela está entrando já tem visita afirmada. As duas metades são
  -- necessárias; nenhuma sozinha fecha o buraco.
  -- A comparação é por SEMANA ISO e não por dia, porque a semana é a unidade em
  -- que a turma existe (escala_da_semana, U76:437-446).
  IF public.referencia_semanal(NEW.dia)
     IS DISTINCT FROM public.referencia_semanal(public.dia_da_dupla(v_agendada, v_criado)) THEN
    RETURN NEW;
  END IF;

  -- É UM UPDATE, E POR ISSO É MUDO. trg_notify_chamado_apoio é AFTER **INSERT**
  -- (u7:502-503). Congelar não toca sino nenhum, hoje nem em massa no backfill.
  -- `congelado_em IS NULL` faz disto um no-op na segunda passagem, e é ele que
  -- garante a MONOTONICIDADE: o primeiro instante vence, e nenhum carimbo
  -- posterior reescreve o de uma ida anterior — que é o que faz idasDoApoio
  -- conseguir ordenar as turmas por ida.
  -- O INSTANTE É O DO BLOCO, NÃO O DO RELÓGIO. Hoje os dois valem o mesmo
  -- (`agenda_campo_cumprir` grava `COALESCE(cumprido_em, now())`, u78:1614),
  -- mas escrever `NEW.cumprido_em` faz este caminho e o do §4 gravarem
  -- demonstravelmente o MESMO instante para o MESMO bloco — que é o que permite
  -- a `idasDoApoio` separar as idas quando as duas turmas são escritas na mesma
  -- transação. Com `now()` nos dois lados elas colapsariam em uma ida só.
  UPDATE public.chamado_apoios a
     SET congelado_em = NEW.cumprido_em
   WHERE a.chamado_id = NEW.chamado_id
     AND a.origem = 'dupla'
     AND a.congelado_em IS NULL;

  RETURN NEW;
END;
$congelar$;
REVOKE EXECUTE ON FUNCTION public.apoio_congelar_da_visita() FROM PUBLIC, anon;

COMMENT ON FUNCTION public.apoio_congelar_da_visita() IS
  'No instante em que alguém afirma que a visita aconteceu (cumprido_em passa '
  'de NULL a instante), marca as linhas origem=dupla daquele chamado como '
  'REGISTRO. Só sobe, nunca desce — tirar o "feito" não descongela. Não congela '
  'quando a semana ISO do bloco carimbado é diferente da semana do apoio '
  'gravado: ali a turma na tabela não é a desta ida.';

-- O BRAÇO DE INSERT É INERTE HOJE, DE PROPÓSITO: agenda_campo_marcar (U78:1386)
-- não escreve cumprido_em, então nenhum bloco nasce cumprido pela porta viva.
-- Ele existe para que a carga ou a migração futura que inserir bloco já
-- cumprido não pule o congelamento em silêncio. A conferência 109 mede que o
-- resíduo é zero.
DROP TRIGGER IF EXISTS trg_agenda_campo_congela_apoio ON public.agenda_campo;
CREATE TRIGGER trg_agenda_campo_congela_apoio
  BEFORE INSERT OR UPDATE OF cumprido_em ON public.agenda_campo
  FOR EACH ROW EXECUTE FUNCTION public.apoio_congelar_da_visita();

-- ═══════════════════════════════════════════════════════════════════════
-- §4) O DELETE PARA DE APAGAR REGISTRO
-- ═══════════════════════════════════════════════════════════════════════
-- O corpo abaixo é o de U76:997-1048 LITERAL, com UMA linha nova (marcada) e
-- nada a menos. Nem a assinatura, nem os GRANTs, nem os dois chamadores mudam.
-- O verificador prova isso por DIFF contra o corpo da U76 recortado do arquivo,
-- com a única diferença esperada escrita à mão — porque quando uma migration
-- reescreve função de outra, o risco é DELEÇÃO, e regex de PRESENÇA não vê
-- deleção.
CREATE OR REPLACE FUNCTION public.chamado_sincronizar_apoio(_chamado uuid)
RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $sinc$
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
     -- ══ A LINHA DA U81 ═══════════════════════════════════════════════════
     -- Linha congelada é REGISTRO: alguém carimbou "feito" no bloco da semana
     -- dela, e o automatismo a soltou. Sem esta cláusula, dar "feito" numa
     -- visita cujo RETORNO cai em outra semana ISO faz o espelho andar (certo),
     -- a semana do chamado mudar (certo) e este DELETE apagar a turma que
     -- ESTEVE NO PRÉDIO — sem sino, sem evento, sem updated_at.
     -- ISTO NÃO ENFRAQUECE "APOIO SEGUE O RESPONSÁVEL": trocar o responsável
     -- continua chamando esta função e continua INSERINDO a turma nova, logo
     -- abaixo. O que a linha impede é o DESCARTE da turma antiga QUE JÁ FOI — e
     -- esse descarte nunca foi a promessa da U76, era o efeito colateral dela.
     -- O preço está declarado em R108 e no cabeçalho: as duas turmas passam a
     -- conceder acesso, e a saída é humana (o X do chip).
     AND a.congelado_em IS NULL
     -- ═════════════════════════════════════════════════════════════════════
     AND NOT (a.profile_id = ANY (v_alvo));
  GET DIAGNOSTICS v_n = ROW_COUNT; v_mexeu := v_mexeu + v_n;

  IF c.responsavel_id IS NOT NULL AND array_length(v_alvo, 1) IS NOT NULL THEN
    -- PLURAL: turma de três grava dois apoios. Já existe como 'manual'? Fica
    -- manual — a escolha da pessoa vence a do automatismo, e é isso que impede
    -- o gatilho de tomar posse (e depois remover) um apoio que ele não criou.
    -- ══ A SEGUNDA METADE DA TRAVA DA U81 ═════════════════════════════════════
    -- A LINHA PODE NASCER JÁ SENDO REGISTRO, e sem isto a U81 fecha metade do
    -- buraco. Nada ordena os carimbos (há um botão por bloco), e carimbar o
    -- RETORNO antes da IDA produz esta sequência: o carimbo do retorno não
    -- congela nada (o espelho ainda aponta para a ida pendente, e a turma
    -- gravada é a da ida — congelá-la ali carimbaria a turma ERRADA); depois, o
    -- carimbo da ida congela a turma da ida (certo) e faz o espelho pular para
    -- o retorno pelo estágio 2, o que traz esta função aqui para gravar a turma
    -- DELE. Essa turma esteve no prédio — mas nasceria VIVA, e o gatilho do
    -- bloco nunca mais dispararia para aquele bloco, porque `cumprido_em` já
    -- transicionou de NULL. Ficaria alcançável pelo DELETE para sempre: era o
    -- defeito original, inteiro, dentro da entrega feita para fechá-lo.
    -- A régua é a mesma do gatilho e do backfill: a semana para a qual estou
    -- escrevendo já tem visita AFIRMADA? Então isto é registro, não cadastro.
    -- O valor é o `cumprido_em` DAQUELE bloco e não `now()`, porque as duas
    -- turmas estão sendo escritas na MESMA transação (o carimbo da ida) e
    -- `now()` daria a ambas o mesmo instante, colapsando duas idas em uma e
    -- cegando `idasDoApoio` justamente no caso que ela existe para descrever.
    -- NULL (nenhum bloco cumprido naquela semana) devolve o comportamento de
    -- sempre — que é o certo no fluxo em ordem, onde o retorno ainda não foi.
    INSERT INTO public.chamado_apoios (chamado_id, profile_id, origem, congelado_em)
    SELECT c.id, p.pessoa_id, 'dupla',
           (SELECT max(b.cumprido_em) FROM public.agenda_campo b
             WHERE b.chamado_id = c.id
               AND b.cancelado_em IS NULL
               AND b.cumprido_em IS NOT NULL
               AND public.referencia_semanal(b.dia) = public.referencia_semanal(v_dia))
      FROM unnest(v_alvo) AS p(pessoa_id)
    ON CONFLICT (chamado_id, profile_id) DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_mexeu := v_mexeu + v_n;
  END IF;

  RETURN v_mexeu;
END;
$sinc$;
-- CREATE OR REPLACE preserva a ACL, mas repetir é barato e torna a linha
-- verdadeira sozinha, sem depender de o leitor conhecer essa regra.
REVOKE EXECUTE ON FUNCTION public.chamado_sincronizar_apoio(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.chamado_sincronizar_apoio(uuid) TO service_role;

COMMENT ON FUNCTION public.chamado_sincronizar_apoio(uuid) IS
  'Refaz o apoio origem=dupla de UM chamado pela escala da semana em que ele '
  'está programado (U76). Devolve quantas linhas mexeu (0 = já estava certo). '
  'Volta cedo quando nenhuma semana aberta cobre a data: não saber quem era NÃO '
  'é o mesmo que saber que não era ninguém. A U81 acrescentou UMA cláusula ao '
  'DELETE: linha CONGELADA (congelado_em preenchida) é registro de uma visita '
  'afirmada e não é mais alcançada pelo automatismo — nem por este gatilho, nem '
  'pela reconciliação, que chama esta função direto.';

-- ═══════════════════════════════════════════════════════════════════════
-- §5) BACKFILL — ZERO INSERT, ZERO DELETE. Ele só MARCA o que já está lá.
-- ═══════════════════════════════════════════════════════════════════════
-- A REGRA É A MESMA DO GATILHO, deliberadamente — duas réguas para o mesmo
-- juízo é a garantia de divergirem: congela as linhas origem='dupla' do chamado
-- cuja semana do ESPELHO DE HOJE coincide com a semana de um bloco CUMPRIDO.
-- Onde coincide, o que está gravado É a turma de uma ida que aconteceu. Onde
-- não coincide, eu não sei o que está gravado — e não chuto.
--
-- O UNIVERSO É PEQUENO POR CONSTRUÇÃO: agenda_campo nasceu VAZIA (U78:11 e
-- :2386-2395) e só recebe bloco por gente desde que a U79 abriu as portas. São
-- dias de dados, não anos.
--
-- ── O QUE EU ME RECUSO A INVENTAR, POR EXTENSO ─────────────────────────────
-- 1. RECONSTRUIR A TURMA QUE O DEFEITO JÁ APAGOU. Para o chamado que já sofreu
--    o caso (B), as linhas da semana antiga NÃO EXISTEM: o DELETE não deixou
--    sino, nem evento, nem updated_at (a tabela não tem). Derivá-las de
--    escala_da_semana seria INVENTAR, porque escala_definir (U76:601-663) não
--    recusa semana passada — a composição de hoje pode não ser a que vigorava
--    quando o apoio foi escrito. Escrever essas linhas seria fabricar registro
--    histórico, que é o que a U64 recusou em prosa. NÃO ESCREVO UMA LINHA. Elas
--    ficam perdidas, e a conferência 109 conta onde isso pode ter acontecido,
--    para o Davi olhar com olho humano.
-- 2. CONGELAR CHAMADO SEM BLOCO CUMPRIDO. Ninguém afirmou que a visita
--    aconteceu, então nada virou registro. Congelar ali travaria "apoio segue o
--    responsável" de graça, para milhares de chamados, em troca de nada.
-- 3. CONGELAR origem='manual'. O automatismo nunca as segurou; a coluna diria
--    uma falsidade sobre elas.
-- 4. CONGELAR QUANDO A SEMANA DO ESPELHO ≠ A SEMANA DE QUALQUER BLOCO CUMPRIDO.
--    É precisamente o caso em que as linhas gravadas podem ser a turma ERRADA.
--    Congelar ali carimbaria o erro.
-- 5. USAR O CONJUNTO DA CONFERÊNCIA 112 DA U80 (blocos pendentes com dia
--    passado há mais de 7 dias — "aconteceu, ninguém marcou feito"). Tratar
--    "provavelmente aconteceu" como "aconteceu" é a substituição exata que este
--    desenho existe para não fazer. O remédio é humano: alguém clica "feito", e
--    o clique congela.
-- 6. USAR agenda_campo.criado_por COMO "QUEM FOI" (U78:1388). É quem ARRASTOU o
--    cartão, e o portão deixa gestor puro passar — tipicamente o SAC, que não
--    esteve no prédio.
--
-- ── O QUE ELE ALCANÇA E QUE VALE DIZER EM VOZ ALTA ─────────────────────────
-- O BACKFILL NÃO FILTRA STATUS, e isso é uma decisão, não um esquecimento.
-- A U76 (:1096-1100) declarou que em chamado ENCERRADO ainda vale corrigir o
-- responsável, porque "o apoio que o automatismo pôs veio do responsável errado,
-- e deixá-lo é deixar uma mentira". Depois do congelamento essa correção deixa
-- de acontecer sozinha no encerrado — que é justamente o caso em que nada mais
-- re-sincroniza. Ou seja: a U81 aplica retroativamente, a registro já encerrado,
-- uma recusa que a U76 tinha nomeado como válida.
-- ACEITO, e pelo mesmo motivo de todo o resto: no encerrado, a linha gravada é a
-- última coisa que alguém escreveu sobre quem esteve lá, e apagá-la em nome de
-- uma correção automática é trocar um registro possivelmente errado por NENHUM
-- registro. A saída continua sendo o X do chip, e a conferência 115 mede quanto
-- disso existe. Se o número for grande, a conversa muda.
--
-- E UM AVISO SOBRE O INSTANTE: `now()` é o timestamp da TRANSAÇÃO, e o backfill
-- é UMA transação. Tudo o que ele congelar compartilha um único `congelado_em`.
-- Isso é a marca de procedência (carga × carimbo ficam distinguíveis para
-- sempre, custo zero) e é também o limite: para TODO chamado anterior à U81,
-- `idasDoApoio` devolve UMA ida só, com as turmas de todas as semanas juntas. A
-- ordem de idas só passa a ser real do primeiro carimbo em diante, e quem for
-- pintar isso numa tela tem de dizer isso ao usuário.
WITH visita_afirmada AS (
  SELECT DISTINCT c.id AS chamado_id
    FROM public.chamados c
    JOIN public.agenda_campo a
      ON a.chamado_id = c.id
     AND a.cancelado_em IS NULL
     AND a.cumprido_em  IS NOT NULL
   WHERE c.natureza = 'campo'
     AND c.data_hora_agendada IS NOT NULL
     AND public.referencia_semanal(a.dia)
       = public.referencia_semanal(public.dia_da_dupla(c.data_hora_agendada, c.created_at))
)
UPDATE public.chamado_apoios ap
   SET congelado_em = now()
  FROM visita_afirmada v
 WHERE ap.chamado_id = v.chamado_id
   AND ap.origem = 'dupla'
   AND ap.congelado_em IS NULL;

-- ═══════════════════════════════════════════════════════════════════════
-- §6) CONFERÊNCIA — obtido × esperado × veredito, no CATÁLOGO
-- ═══════════════════════════════════════════════════════════════════════
-- O QUE O DAVI OLHA: a TABELA. Ele procura '>>> OLHAR <<<' na coluna
-- `veredito`. Nada mais.
SELECT t.ordem, t.conferencia, t.valor, t.esperado,
       CASE WHEN t.esperado = '(referência)'             THEN '— referência'
            WHEN t.valor IS NOT DISTINCT FROM t.esperado THEN 'ok'
            ELSE '>>> OLHAR <<<' END AS veredito
  FROM (

SELECT 101 AS ordem,
       'CRÍTICO: a coluna congelado_em existe em public.chamado_apoios e é ANULÁVEL (NOT NULL aqui congelaria o mundo inteiro de uma vez)' AS conferencia,
       (SELECT (a.attnotnull = false)::text
          FROM pg_attribute a
         WHERE a.attrelid = 'public.chamado_apoios'::regclass
           AND a.attname = 'congelado_em' AND NOT a.attisdropped) AS valor,
       'true' AS esperado

UNION ALL
-- PROVAR, NÃO AFIRMAR. O §2 argumenta que a coluna nasce inescrevível porque a
-- S3 deu INSERT por COLUNA; estas duas linhas leem o catálogo em vez de confiar
-- no argumento.
SELECT 102, 'CRÍTICO: authenticated NÃO insere congelado_em (o GRANT da S3 é por COLUNA, e coluna nova não entra nele)',
       has_column_privilege('authenticated','public.chamado_apoios','congelado_em','INSERT')::text,
       'false'

UNION ALL
SELECT 103, 'CRÍTICO: e continua não existindo UPDATE de tabela em chamado_apoios — apoio nasce e morre, não se corrige (S3:89-91)',
       has_table_privilege('authenticated','public.chamado_apoios','UPDATE')::text,
       'false'

UNION ALL
-- Do CATÁLOGO, via pg_get_triggerdef: BEFORE é a garantia de ordem contra o
-- AFTER do espelho, e a lista OF é o que impede o gatilho de acordar quando
-- alguém corrige duração ou deslocamento de um bloco.
SELECT 104, 'CRÍTICO: o gatilho do congelamento é BEFORE INSERT OR UPDATE OF cumprido_em — AFTER dependeria da ordem alfabética do NOME contra o gatilho do espelho',
       (SELECT (pg_get_triggerdef(t.oid) LIKE '%BEFORE INSERT OR UPDATE OF cumprido_em ON public.agenda_campo%')::text
          FROM pg_trigger t
         WHERE t.tgrelid = 'public.agenda_campo'::regclass
           AND t.tgname = 'trg_agenda_campo_congela_apoio' AND NOT t.tgisinternal),
       'true'

UNION ALL
-- ══ 105: A PROVA DE QUE NADA SUMIU, E ELA É MAIS FORTE QUE "A CÓPIA BATE" ══
-- Não houve cópia: o backfill é um UPDATE de uma coluna que acabou de nascer.
-- Total, dupla e manual, os três contra a foto do §1. Qualquer coisa diferente
-- de 0/0/0 quer dizer que esta migration apagou ou inseriu registro, que é
-- justamente o que ela promete não fazer.
SELECT 105, 'CRÍTICO: nada saiu e nada entrou em chamado_apoios — total/dupla/manual, contra a foto do §1',
       ((SELECT count(*) FROM public.chamado_apoios) - (SELECT apoios_antes FROM u81_foto))::text
       || '/' ||
       ((SELECT count(*) FROM public.chamado_apoios WHERE origem='dupla') - (SELECT dupla_antes FROM u81_foto))::text
       || '/' ||
       ((SELECT count(*) FROM public.chamado_apoios WHERE origem='manual') - (SELECT manual_antes FROM u81_foto))::text,
       '0/0/0'

UNION ALL
SELECT 106, 'CRÍTICO: o corpo VIVO de chamado_sincronizar_apoio tem a trava — lido do CATÁLOGO (pg_get_functiondef), não do arquivo. O verificador faz o DIFF do arquivo; as duas, não uma',
       (SELECT (pg_get_functiondef(p.oid) LIKE '%a.congelado_em IS NULL%')::text
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname='public' AND p.proname='chamado_sincronizar_apoio'),
       'true'

UNION ALL
SELECT 107, 'CRÍTICO: nenhum sino "Você entrou como apoio" nasceu nesta migration — o congelamento é UPDATE, e o sino é AFTER INSERT',
       ((SELECT count(*) FROM public.notificacoes WHERE tipo='chamado_apoio')
        - (SELECT sinos_antes FROM u81_foto))::text,
       '0'

UNION ALL
-- ══ 108: O TAMANHO EXATO DA AFIRMAÇÃO QUE O BACKFILL FAZ ══════════════════
-- Linhas e chamados que ESTA execução congelou (a diferença contra a foto do
-- §2, não o total — numa segunda execução tem de vir 0/0, e é assim que a
-- idempotência se prova em vez de se afirmar). É o número que o Davi olha para
-- saber o tamanho do que está aceitando.
SELECT 108, 'referência: linhas / chamados que ESTA execução congelou. Numa segunda execução tem de vir 0/0',
       ((SELECT count(*) FROM public.chamado_apoios WHERE congelado_em IS NOT NULL)
        - (SELECT congelados_antes FROM u81_foto_congelado))::text
       || ' / ' ||
       ((SELECT count(DISTINCT chamado_id) FROM public.chamado_apoios WHERE congelado_em IS NOT NULL)
        - (SELECT chamados_antes FROM u81_foto_congelado))::text,
       '(referência)'

UNION ALL
-- ══ 109: A RECUSA, CONTADA ════════════════════════════════════════════════
-- Blocos CUMPRIDOS cujo chamado NÃO ficou com nenhuma linha congelada. São os
-- casos em que a semana do espelho não casou com a semana do bloco: ou o apoio
-- gravado é de outra ida, ou ele já foi apagado pelo defeito. NÃO INVENTO essas
-- linhas (recusa 1 do §5) — elas ficam aqui para o olho humano.
SELECT 109, 'referência: blocos CUMPRIDOS cujo chamado ficou SEM apoio congelado — a recusa do §5 contada, e a lista que o Davi olha com olho humano',
       (SELECT count(*)::text
          FROM public.agenda_campo a
          JOIN public.chamados c ON c.id = a.chamado_id
         WHERE a.cancelado_em IS NULL AND a.cumprido_em IS NOT NULL
           AND c.natureza = 'campo'
           -- POR SEMANA, E NÃO POR CHAMADO. Com o NOT EXISTS por chamado, o caso
           -- MALIGNO desaparecia da conta: chamado com a visita de terça já
           -- apagada pelo defeito e o retorno de quinta congelado pelo backfill
           -- TEM linha congelada, e saía inteiro da contagem. Sobrava a
           -- população benigna, e a conferência afirmava contar justamente o que
           -- não contava.
           AND NOT EXISTS (SELECT 1 FROM public.chamado_apoios ap
                            WHERE ap.chamado_id = c.id
                              AND ap.origem = 'dupla'
                              AND ap.congelado_em IS NOT NULL
                              AND public.referencia_semanal(
                                    public.dia_da_dupla(c.data_hora_agendada, c.created_at))
                                  = public.referencia_semanal(a.dia))),
       '(referência)'

UNION ALL
-- ══ 110: O NÚMERO QUE DECIDE SE A U81 É DECORAÇÃO ═════════════════════════
-- É a conferência 112 da U80, repetida de propósito. Toda a proteção desta
-- entrega pende de um clique OPCIONAL, num único botão
-- (FormularioDoBloco.tsx:616) — a segunda mão que a U78:1566-1568 prometeu NÃO
-- EXISTE. Para os blocos deste conjunto a U81 não faz absolutamente nada: o
-- espelho anda, o DELETE roda, a turma da ida some. SE ESTE NÚMERO CRESCER, A
-- U81 É DECORAÇÃO — e é ele, não a vontade, que libera a próxima entrega da
-- linha (a segunda mão do carimbo, antes de qualquer tabela nova).
SELECT 110, 'referência: blocos PENDENTES com dia já passado há mais de 7 dias — aconteceu, ninguém marcou feito, e para eles a U81 não protege NADA (= conf. 112 da U80)',
       (SELECT count(*)::text FROM public.agenda_campo a
         WHERE a.cancelado_em IS NULL AND a.cumprido_em IS NULL
           AND a.dia < (current_date - 7)),
       '(referência)'

UNION ALL
SELECT 111, 'CRÍTICO: o sino continua sendo UM gatilho AFTER INSERT em chamado_apoios, e esta migration não o tocou',
       (SELECT count(*)::text FROM pg_trigger t
         WHERE t.tgrelid = 'public.chamado_apoios'::regclass
           AND t.tgname = 'trg_notify_chamado_apoio' AND NOT t.tgisinternal
           AND pg_get_triggerdef(t.oid) LIKE '%AFTER INSERT ON public.chamado_apoios%'),
       '1'

UNION ALL
-- As duas funções que esta migration NÃO reescreveu e das quais o desenho
-- inteiro depende. Se alguém as tiver trocado no meio do caminho, o argumento
-- de "a proteção é da LINHA, logo vale para os dois chamadores" precisa ser
-- reconferido antes de valer.
SELECT 112, 'CRÍTICO: os dois chamadores continuam existindo e NÃO foram tocados — a proteção é propriedade da LINHA, então ela vale para o gatilho E para a reconciliação',
       ((to_regprocedure('public.chamado_apoio_da_dupla()') IS NOT NULL)::int
      + (to_regprocedure('public.reconciliar_apoios_abertos(text)') IS NOT NULL)::int)::text,
       '2'

UNION ALL
SELECT 113, 'CRÍTICO: anon não executa o gatilho novo (a chave publishable está no .env versionado)',
       has_function_privilege('anon','public.apoio_congelar_da_visita()','EXECUTE')::text,
       'false'

UNION ALL
-- O caso que a frase do Davi descreve, medido HOJE: quantos chamados de campo
-- abertos têm blocos ativos em MAIS DE UMA semana ISO. É a população exata do
-- defeito, e o denominador de qualquer conversa futura sobre pendurar o apoio
-- no bloco.
SELECT 114, 'referência: chamados de campo com blocos ativos em MAIS DE UMA semana ISO — a população exata do defeito, e o denominador da conversa sobre apoio por bloco',
       (SELECT count(*)::text FROM (
          SELECT a.chamado_id
            FROM public.agenda_campo a
           WHERE a.chamado_id IS NOT NULL AND a.cancelado_em IS NULL
           GROUP BY a.chamado_id
          HAVING count(DISTINCT public.referencia_semanal(a.dia)) > 1) d),
       '(referência)'

UNION ALL
-- ══ 115: O QUE A RECONCILIAÇÃO NÃO ALCANÇA MAIS ═══════════════════════════
-- O preço declarado no cabeçalho, medido em vez de só afirmado. Cada uma destas
-- linhas é um nome que `reconciliar_apoios_abertos` deixa de corrigir enquanto
-- devolve "corrigido" — o chamado está ABERTO, a escala daquela semana não
-- confirma a pessoa, e a linha está congelada. Saem só pelo X do chip, à mão.
-- Se este número for grande na primeira rodada, a conversa muda: quer dizer que
-- o backfill cimentou palpite herdado em escala, e a próxima entrega tem de
-- abrir uma porta de correção antes de qualquer coisa.
SELECT 115, 'referência: apoios CONGELADOS de chamados ABERTOS que a escala da semana deles NÃO confirma — a reconciliação não os alcança mais e devolve sucesso assim mesmo. Saem só pelo X do chip',
       (SELECT count(*)::text
          FROM public.chamado_apoios ap
          JOIN public.chamados c ON c.id = ap.chamado_id
         WHERE ap.origem = 'dupla'
           AND ap.congelado_em IS NOT NULL
           AND c.natureza = 'campo'
           AND c.status NOT IN ('concluido','cancelado')
           AND public.escala_semana_vigente(public.referencia_semanal(
                 public.dia_da_dupla(c.data_hora_agendada, c.created_at))) IS NOT NULL
           AND NOT EXISTS (
                 SELECT 1 FROM public.parceiros_da_dupla(
                            c.responsavel_id,
                            public.dia_da_dupla(c.data_hora_agendada, c.created_at)
                          ) AS p(pessoa_id)
                  WHERE p.pessoa_id = ap.profile_id)),
       '(referência)'

UNION ALL
-- ══ 116: O P26 DIMENSIONADO ═══════════════════════════════════════════════
-- A 108 diz o TAMANHO do que está sendo congelado; esta diz a QUALIDADE. Escala
-- HERDADA quer dizer que ninguém confirmou a composição daquela semana — o
-- sistema repetiu a última conhecida. Congelar sobre isso promove um palpite a
-- registro permanente, e o Davi merece decidir com o número na frente, não com
-- a declaração.
SELECT 116, 'referência: destes, quantos chamados foram congelados sobre escala HERDADA (ninguém confirmou aquela semana) — o P26 dimensionado, e não só declarado',
       (SELECT count(DISTINCT ap.chamado_id)::text
          FROM public.chamado_apoios ap
          JOIN public.chamados c ON c.id = ap.chamado_id
         WHERE ap.congelado_em IS NOT NULL AND ap.origem = 'dupla'
           AND EXISTS (SELECT 1 FROM public.escala_da_semana(
                         public.referencia_semanal(
                           public.dia_da_dupla(c.data_hora_agendada, c.created_at))) e
                        WHERE e.herdada)),
       '(referência)'

UNION ALL
-- ══ 117: A 110, SEM O RUÍDO ═══════════════════════════════════════════════
-- A 110 fica idêntica à 112 da U80 porque a comparabilidade entre as duas é o
-- ponto. Mas ela conta blocos de OS EXTERNA junto (chamado_id NULL), e esses não
-- têm apoio nenhum a proteger — o próprio gatilho volta na primeira linha. Como
-- são criados por gestor e raramente carimbados, tendem a crescer sozinhos e a
-- embaçar exatamente o número que libera a próxima entrega. Este é o recorte que
-- decide.
SELECT 117, 'referência: destes, os que têm CHAMADO — os únicos em que existe apoio a proteger. É ESTE que decide se a U81 é decoração; a 110 fica como está, para bater com a 112 da U80',
       (SELECT count(*)::text FROM public.agenda_campo a
         WHERE a.cancelado_em IS NULL AND a.cumprido_em IS NULL
           AND a.chamado_id IS NOT NULL
           AND a.dia < (current_date - 7)),
       '(referência)'

) t ORDER BY t.ordem;

COMMIT;

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ DESFAZER                                                             ║
-- ╚══════════════════════════════════════════════════════════════════════╝
-- O que volta junto, dito por extenso: marcar uma visita como feita VOLTA A
-- APAGAR o registro de quem a fez, quando o retorno cai em outra semana ISO e a
-- turma daquela semana é outra — sem sino, sem evento e sem rastro. E o
-- DROP COLUMN leva embora a única marca que dizia quais linhas eram história.
-- É freio de emergência, não rollback de rotina.
--
-- O APP NÃO QUEBRA JUNTO, e isso foi construído de propósito: `useChamadoApoios`
-- pede `select("*")` e nunca nomeia `congelado_em`, então derrubar a coluna com
-- o front publicado devolve as linhas sem ela e o `?? null` do mapa lê tudo como
-- "atual". Se alguém trocar aquele `*` por uma lista de colunas, este DESFAZER
-- passa a derrubar a lista de apoio de toda tela de chamado junto.
--
-- A ORDEM IMPORTA: o gatilho sai ANTES da coluna (senão ele erra no primeiro
-- carimbo), e a função volta ao corpo da U76 ANTES do DROP COLUMN (senão o
-- corpo vivo referencia uma coluna que não existe mais e todo INSERT/UPDATE de
-- chamado de campo estoura).
--
-- BEGIN;
--   DROP TRIGGER IF EXISTS trg_agenda_campo_congela_apoio ON public.agenda_campo;
--   DROP FUNCTION IF EXISTS public.apoio_congelar_da_visita();
--
--   CREATE OR REPLACE FUNCTION public.chamado_sincronizar_apoio(_chamado uuid)
--   RETURNS integer
--   LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
--   AS $desfazer$
--   DECLARE
--     c        record;
--     v_dia    date;
--     v_vig    text;
--     v_alvo   uuid[];
--     v_mexeu  int := 0;
--     v_n      int;
--   BEGIN
--     SELECT id, natureza, responsavel_id, data_hora_agendada, created_at
--       INTO c
--       FROM public.chamados WHERE id = _chamado;
--     IF NOT FOUND THEN RETURN 0; END IF;
--     IF c.natureza IS DISTINCT FROM 'campo' THEN RETURN 0; END IF;
--     v_dia := public.dia_da_dupla(c.data_hora_agendada, c.created_at);
--     v_vig := public.escala_semana_vigente(public.referencia_semanal(v_dia));
--     IF v_vig IS NULL THEN RETURN 0; END IF;
--     SELECT COALESCE(array_agg(p.pessoa_id), '{}'::uuid[]) INTO v_alvo
--       FROM public.parceiros_da_dupla(c.responsavel_id, v_dia) AS p(pessoa_id);
--     DELETE FROM public.chamado_apoios a
--      WHERE a.chamado_id = c.id
--        AND a.origem = 'dupla'
--        AND NOT (a.profile_id = ANY (v_alvo));
--     GET DIAGNOSTICS v_n = ROW_COUNT; v_mexeu := v_mexeu + v_n;
--     IF c.responsavel_id IS NOT NULL AND array_length(v_alvo, 1) IS NOT NULL THEN
--       INSERT INTO public.chamado_apoios (chamado_id, profile_id, origem)
--       SELECT c.id, p.pessoa_id, 'dupla' FROM unnest(v_alvo) AS p(pessoa_id)
--       ON CONFLICT (chamado_id, profile_id) DO NOTHING;
--       GET DIAGNOSTICS v_n = ROW_COUNT; v_mexeu := v_mexeu + v_n;
--     END IF;
--     RETURN v_mexeu;
--   END;
--   $desfazer$;
--   REVOKE EXECUTE ON FUNCTION public.chamado_sincronizar_apoio(uuid) FROM PUBLIC, anon;
--   GRANT  EXECUTE ON FUNCTION public.chamado_sincronizar_apoio(uuid) TO service_role;
--
--   -- O COMENTÁRIO TAMBÉM VOLTA. Sem esta linha, o `\df+` passa a descrever uma
--   -- cláusula que não existe mais, numa função cuja única documentação viva é
--   -- este texto — e a próxima pessoa a ler acredita nele.
--   COMMENT ON FUNCTION public.chamado_sincronizar_apoio(uuid) IS
--     'Reescreve o apoio origem=dupla de um chamado de campo a partir da escala da semana do trabalho. Apoio manual nunca é tocado. Chamada pelo gatilho de responsável/data e por reconciliar_apoios_abertos.';
--
--   ALTER TABLE public.chamado_apoios DROP COLUMN IF EXISTS congelado_em;
-- COMMIT;
-- ═══════════════════════════════════════════════════════════════════════════
