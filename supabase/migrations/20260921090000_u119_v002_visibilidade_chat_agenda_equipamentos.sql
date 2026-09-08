-- ═══════════════════════════════════════════════════════════════════════════
-- U119 — a atualização v0.0.2: todos veem todas as atividades, o chat como
-- conversa, toda atividade pode ser agendada, equipamentos removidos e
-- instalados pela atividade (R221–R229)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Davi, 08/09/2026: "Subimos o sistema no servidor. A partir de hoje as pessoas
-- começarão a usar o sistema, qualquer alteração que façamos será executada via
-- versionamento do sistema, para preservar o banco de dados."
--
-- PRÉ-VOO: a U117 tem de ter rodado (esta migration REESCREVE minhas_mencoes
-- com colunas novas — o bloco §0 aborta se ela não existir).
-- IDEMPOTENTE: pode rodar duas vezes. Termina com a conferência (>>> OLHAR <<<)
-- e o DESFAZER no rodapé.
--
-- §1 VISIBILIDADE (R221). Davi: "Todos os usuários devem poder visualizar todas
--    as atividades do sistema." — `chamados_select` e `visitas_select` passam
--    a USING (true) para authenticated; `pode_acessar_chamado()` passa a
--    "estou logado e a atividade existe". As policies de ESCRITA não mudam;
--    valores (pode_ver_financeiro) e a escala de sobreaviso continuam fechados.
-- §2 CHAT (R222–R223). `mensagens_chat` (a mensagem para todo mundo),
--    `minhas_mencoes` v2 (+status, prazo, agenda, "respondida"; +origens
--    diagnóstico e solução), gatilho de menção no diagnóstico e na solução.
-- §3 AGENDA (R225). `chamados.reagendamentos` + gatilho que conta; a função
--    `notificar_agendadas_de_hoje()` e o job das 08h (BRT) no pg_cron.
-- §4 EQUIPAMENTOS (R226). `situacao`/`retirado_*` no patrimônio, a tabela
--    `equipamento_movimentos` e as RPCs `mover_equipamento`,
--    `desfazer_movimento_equipamento`, `equipamentos_da_atividade`,
--    `equipamentos_do_cliente_da_atividade`, `buscar_equipamentos_livres`.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §0) PRÉ-VOO ─────────────────────────────────────────────────────────────
DO $u119pre$
BEGIN
  IF to_regprocedure('public.minhas_mencoes(integer)') IS NULL THEN
    RAISE EXCEPTION 'U119: a U117 não rodou (minhas_mencoes não existe). Rode a U117 primeiro.';
  END IF;
  IF to_regclass('public.equipamentos_patrimonio') IS NULL THEN
    RAISE EXCEPTION 'U119: a U109 não rodou (equipamentos_patrimonio não existe).';
  END IF;
  IF to_regprocedure('public.agendar_job(text, text, text)') IS NULL THEN
    RAISE EXCEPTION 'U119: agendar_job não existe (U0).';
  END IF;
END
$u119pre$;

-- ═══════════════════════════════════════════════════════════════════════════
-- §1) VISIBILIDADE TOTAL (R221)
-- ═══════════════════════════════════════════════════════════════════════════
-- O que sai: a régua de "só o meu, o que abri, o que está sem dono e o que
-- apoio" (u29/s2). O que fica: valores (cobrança, fechamento, propostas) atrás
-- de pode_ver_financeiro; o sobreaviso atrás da própria policy; a ESCRITA em
-- chamados exatamente como estava.

DROP POLICY IF EXISTS chamados_select ON public.chamados;
CREATE POLICY chamados_select ON public.chamados
  FOR SELECT TO authenticated
  USING (true);
COMMENT ON POLICY chamados_select ON public.chamados IS
  'R221 (U119): toda pessoa logada vê toda atividade — Davi, 08/09/2026: "Todos os usuários devem poder visualizar todas as atividades do sistema."';

DROP POLICY IF EXISTS "visitas_select" ON public.visitas_tecnicas;
CREATE POLICY "visitas_select" ON public.visitas_tecnicas
  FOR SELECT TO authenticated
  USING (true);
COMMENT ON POLICY "visitas_select" ON public.visitas_tecnicas IS
  'R221 (U119): a visita é uma atividade como as outras (R218) — toda pessoa logada a vê. Os VALORES da proposta continuam nas tabelas de blocos/itens, atrás das policies delas.';

-- a régua de comentários, reações, apoios, movimentos: "estou logado e a
-- atividade existe". Continua SECURITY DEFINER e com a mesma assinatura — as
-- policies que a citam (chamado_eventos, chamado_reacoes, …) não mudam.
CREATE OR REPLACE FUNCTION public.pode_acessar_chamado(_chamado_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $u119a$
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.chamados c WHERE c.id = _chamado_id);
$u119a$;
COMMENT ON FUNCTION public.pode_acessar_chamado(uuid) IS
  'R221 (U119): quem está logado acessa qualquer atividade que exista. Era a régua de dono/autor/fila aberta/apoio (u7, s2).';

-- ═══════════════════════════════════════════════════════════════════════════
-- §2) O CHAT COMO CONVERSA (R222–R223)
-- ═══════════════════════════════════════════════════════════════════════════

-- 2a) a MENSAGEM PARA TODO MUNDO — Davi: "qualquer mensagem enviada no chat
--     que não seja uma resposta a nada, deve ser enviada para todos os usuários"
CREATE TABLE IF NOT EXISTS public.mensagens_chat (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  autor_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  texto     text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mensagens_chat_texto_check CHECK (length(btrim(texto)) BETWEEN 1 AND 4000)
);
COMMENT ON TABLE public.mensagens_chat IS
  'R223 (U119): a mensagem do chat da Início que não responde a nada — vai para todo mundo. A resposta a uma menção NÃO mora aqui: vira comentário na atividade (R216).';
CREATE INDEX IF NOT EXISTS mensagens_chat_criado_em_idx ON public.mensagens_chat (criado_em DESC);

ALTER TABLE public.mensagens_chat ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.mensagens_chat TO authenticated;
GRANT ALL ON public.mensagens_chat TO service_role;

DROP POLICY IF EXISTS "mensagens_chat_select" ON public.mensagens_chat;
CREATE POLICY "mensagens_chat_select" ON public.mensagens_chat
  FOR SELECT TO authenticated
  USING (true);
COMMENT ON POLICY "mensagens_chat_select" ON public.mensagens_chat IS
  'R223: a mensagem para todo mundo é pública por definição — quem está logado lê.';

DROP POLICY IF EXISTS "mensagens_chat_insert" ON public.mensagens_chat;
CREATE POLICY "mensagens_chat_insert" ON public.mensagens_chat
  FOR INSERT TO authenticated
  WITH CHECK (autor_id = auth.uid()
              AND EXISTS (SELECT 1 FROM public.profiles p
                           WHERE p.id = auth.uid() AND p.ativo AND p.status <> 'pendente_aprovacao'));

DROP POLICY IF EXISTS "mensagens_chat_delete_autor" ON public.mensagens_chat;
CREATE POLICY "mensagens_chat_delete_autor" ON public.mensagens_chat
  FOR DELETE TO authenticated
  USING (autor_id = auth.uid());

-- ao vivo: o chat assina a tabela (o canal `mensagens-chat` no app)
ALTER TABLE public.mensagens_chat REPLICA IDENTITY FULL;
DO $u119pub$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens_chat;
EXCEPTION WHEN duplicate_object THEN NULL;
END $u119pub$;

-- 2b) minhas_mencoes v2 — a assinatura de retorno muda, então DROP + CREATE
--     (CREATE OR REPLACE recusa mudar as colunas de saída).
--     Novas colunas: status, prazo_limite, data_agendada, data_hora_agendada
--     (a COR do fundo da mensagem — R222: "cor estratégica por prazo") e
--     `respondida` (eu já comentei nessa atividade DEPOIS da menção — R222:
--     "chamar a atenção para mensagens novas/não respondidas").
--     Novas origens: 'diagnostico' e 'solucao' (Davi: "menção em descrição,
--     problema ou diagnóstico → clica e abre o pop-up da atividade").
DROP FUNCTION IF EXISTS public.minhas_mencoes(integer);
CREATE FUNCTION public.minhas_mencoes(_limite integer DEFAULT 100)
RETURNS TABLE (
  origem             text,
  chamado_id         uuid,
  numero             text,
  titulo             text,
  evento_id          uuid,
  autor_id           uuid,
  texto              text,
  criado_em          timestamptz,
  status             text,
  prazo_limite       timestamptz,
  data_agendada      date,
  data_hora_agendada timestamptz,
  respondida         boolean
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $u119b$
  SELECT m.origem, m.chamado_id, m.numero, m.titulo, m.evento_id, m.autor_id, m.texto, m.criado_em,
         m.status, m.prazo_limite::timestamptz, m.data_agendada, m.data_hora_agendada,
         EXISTS (SELECT 1 FROM public.chamado_eventos r
                  WHERE r.chamado_id = m.chamado_id AND r.tipo = 'comentario'
                    AND r.user_id = auth.uid() AND r.created_at > m.criado_em) AS respondida
    FROM (
      -- menção num COMENTÁRIO: o texto inteiro do comentário
      SELECT 'comentario'::text AS origem, e.chamado_id, c.numero, c.titulo,
             e.id AS evento_id, e.user_id AS autor_id, e.descricao AS texto, e.created_at AS criado_em,
             c.status, c.prazo_limite, c.data_agendada, c.data_hora_agendada
        FROM public.chamado_eventos e
        JOIN public.chamados c ON c.id = e.chamado_id
       WHERE e.tipo = 'comentario'
         AND public.mencoes_em(coalesce(e.descricao, '')) @> ARRAY[auth.uid()]
      UNION ALL
      -- menção na DESCRIÇÃO / PROBLEMA da atividade: o app recorta o parágrafo
      SELECT 'descricao'::text, c.id, c.numero, c.titulo,
             NULL::uuid, c.aberto_por, c.descricao_problema, coalesce(c.updated_at, c.created_at),
             c.status, c.prazo_limite, c.data_agendada, c.data_hora_agendada
        FROM public.chamados c
       WHERE public.mencoes_em(coalesce(c.descricao_problema, '')) @> ARRAY[auth.uid()]
      UNION ALL
      -- menção no DIAGNÓSTICO
      SELECT 'diagnostico'::text, c.id, c.numero, c.titulo,
             NULL::uuid, coalesce(c.responsavel_id, c.aberto_por), c.diagnostico, coalesce(c.updated_at, c.created_at),
             c.status, c.prazo_limite, c.data_agendada, c.data_hora_agendada
        FROM public.chamados c
       WHERE public.mencoes_em(coalesce(c.diagnostico, '')) @> ARRAY[auth.uid()]
      UNION ALL
      -- menção na SOLUÇÃO APLICADA
      SELECT 'solucao'::text, c.id, c.numero, c.titulo,
             NULL::uuid, coalesce(c.responsavel_id, c.aberto_por), c.servico_executado, coalesce(c.updated_at, c.created_at),
             c.status, c.prazo_limite, c.data_agendada, c.data_hora_agendada
        FROM public.chamados c
       WHERE public.mencoes_em(coalesce(c.servico_executado, '')) @> ARRAY[auth.uid()]
    ) m
   ORDER BY m.criado_em DESC
   LIMIT greatest(1, least(coalesce(_limite, 100), 500));
$u119b$;

COMMENT ON FUNCTION public.minhas_mencoes(integer) IS
  'R215/R222 (U119, v2): as menções a quem chama — comentários, descrição, diagnóstico e solução cujo texto traz @[Nome](user:<meu id>), com status/prazo/agenda (a cor da mensagem) e "respondida". SECURITY INVOKER: a RLS filtra. Reusa mencoes_em (U95).';

REVOKE ALL ON FUNCTION public.minhas_mencoes(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.minhas_mencoes(integer) TO authenticated, service_role;

-- 2c) menção nova no DIAGNÓSTICO ou na SOLUÇÃO avisa a pessoa — o mesmo
--     "antes × depois" do gatilho da descrição (U95): o autosave grava dezenas
--     de vezes e a pessoa recebe UM sino.
CREATE OR REPLACE FUNCTION public.notify_mencao_registro()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $u119c$
DECLARE
  v_novas uuid[] := '{}';
BEGIN
  IF NEW.diagnostico IS DISTINCT FROM OLD.diagnostico THEN
    v_novas := v_novas || ARRAY(
      SELECT unnest(public.mencoes_em(coalesce(NEW.diagnostico, '')))
      EXCEPT SELECT unnest(public.mencoes_em(coalesce(OLD.diagnostico, ''))));
  END IF;
  IF NEW.servico_executado IS DISTINCT FROM OLD.servico_executado THEN
    v_novas := v_novas || ARRAY(
      SELECT unnest(public.mencoes_em(coalesce(NEW.servico_executado, '')))
      EXCEPT SELECT unnest(public.mencoes_em(coalesce(OLD.servico_executado, ''))));
  END IF;
  IF array_length(v_novas, 1) IS NOT NULL THEN
    PERFORM public.notificar_mencoes(NEW.id, ARRAY(SELECT DISTINCT unnest(v_novas)), auth.uid());
  END IF;
  RETURN NEW;
END;
$u119c$;

DROP TRIGGER IF EXISTS trg_notify_mencao_registro ON public.chamados;
CREATE TRIGGER trg_notify_mencao_registro
  AFTER UPDATE OF diagnostico, servico_executado ON public.chamados
  FOR EACH ROW EXECUTE FUNCTION public.notify_mencao_registro();

-- ═══════════════════════════════════════════════════════════════════════════
-- §3) TODA ATIVIDADE PODE SER AGENDADA (R225)
-- ═══════════════════════════════════════════════════════════════════════════
-- Davi: "toda atividade deve poder ser agendada (…) caso a atividade seja
-- re-agendada, deve aparecer 'Re-agendado 2x, 3x…' (…) uma notificação
-- diariamente às 08h das atividades agendadas para o dia."
-- `data_agendada` (date) já existe desde a U99; o campo usa `data_hora_agendada`.

ALTER TABLE public.chamados ADD COLUMN IF NOT EXISTS reagendamentos integer NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.chamados.reagendamentos IS
  'R225 (U119): quantas vezes a data agendada MUDOU depois de marcada (gatilho contar_reagendamento). 0 = nunca reagendada. O card diz "Re-agendado Nx".';

CREATE OR REPLACE FUNCTION public.contar_reagendamento()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $u119d$
BEGIN
  -- só conta quando JÁ havia data e a data virou OUTRA data (limpar a agenda
  -- não é reagendar; marcar pela primeira vez também não)
  IF (OLD.data_agendada IS NOT NULL OR OLD.data_hora_agendada IS NOT NULL)
     AND (NEW.data_agendada IS NOT NULL OR NEW.data_hora_agendada IS NOT NULL)
     AND (NEW.data_agendada IS DISTINCT FROM OLD.data_agendada
          OR NEW.data_hora_agendada IS DISTINCT FROM OLD.data_hora_agendada) THEN
    NEW.reagendamentos := coalesce(OLD.reagendamentos, 0) + 1;
  END IF;
  RETURN NEW;
END;
$u119d$;

DROP TRIGGER IF EXISTS trg_contar_reagendamento ON public.chamados;
CREATE TRIGGER trg_contar_reagendamento
  BEFORE UPDATE OF data_agendada, data_hora_agendada ON public.chamados
  FOR EACH ROW EXECUTE FUNCTION public.contar_reagendamento();

-- o aviso das 08h: responsável e apoios de cada atividade agendada para HOJE
-- (horário de Brasília), uma vez por dia por pessoa — idempotente pelo
-- NOT EXISTS, então rodar duas vezes no mesmo dia não duplica.
CREATE OR REPLACE FUNCTION public.notificar_agendadas_de_hoje()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $u119e$
DECLARE
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_n integer := 0;
BEGIN
  INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, chamado_id)
  SELECT DISTINCT alvo.pid, 'agenda_hoje', 'Agendada para hoje',
         coalesce(c.numero, '') || ' · ' || coalesce(c.titulo, ''), c.id
    FROM public.chamados c
    CROSS JOIN LATERAL (
      SELECT c.responsavel_id AS pid
      UNION
      SELECT a.profile_id FROM public.chamado_apoios a WHERE a.chamado_id = c.id
    ) alvo
    JOIN public.profiles p ON p.id = alvo.pid AND p.ativo IS DISTINCT FROM false
   WHERE c.status NOT IN ('concluido', 'cancelado')
     AND coalesce(c.data_agendada, (c.data_hora_agendada AT TIME ZONE 'America/Sao_Paulo')::date) = v_hoje
     AND NOT EXISTS (SELECT 1 FROM public.notificacoes n
                      WHERE n.user_id = alvo.pid AND n.chamado_id = c.id AND n.tipo = 'agenda_hoje'
                        AND (n.created_at AT TIME ZONE 'America/Sao_Paulo')::date = v_hoje);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$u119e$;
REVOKE EXECUTE ON FUNCTION public.notificar_agendadas_de_hoje() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.notificar_agendadas_de_hoje() TO service_role;

-- pg_cron roda em UTC: 08:00 de Brasília = 11:00 UTC (o Brasil não tem mais horário de verão)
SELECT public.agendar_job('agenda-de-hoje', '0 11 * * *', 'SELECT public.notificar_agendadas_de_hoje()') AS job_agenda;

-- ═══════════════════════════════════════════════════════════════════════════
-- §4) EQUIPAMENTOS REMOVIDOS E INSTALADOS PELA ATIVIDADE (R226)
-- ═══════════════════════════════════════════════════════════════════════════
-- Davi: "'Equipamentos Removidos' (…) deve listar os blocos do cliente (…) ao
-- remover, o equipamento passa a ser 'Retirado do cliente'. 'Equipamentos
-- Instalados' deve listar os equipamentos que não estão vinculados a nenhum
-- bloco do cliente, e ao selecionar (…) escolher para qual bloco ele foi
-- instalado. (…) somente quando o cliente da atividade for um cliente único."

ALTER TABLE public.equipamentos_patrimonio
  ADD COLUMN IF NOT EXISTS situacao text NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS retirado_em timestamptz,
  ADD COLUMN IF NOT EXISTS retirado_de_cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL;
DO $u119chk$ BEGIN
  ALTER TABLE public.equipamentos_patrimonio
    ADD CONSTRAINT equipamentos_patrimonio_situacao_check CHECK (situacao IN ('ativo', 'retirado'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $u119chk$;
COMMENT ON COLUMN public.equipamentos_patrimonio.situacao IS
  'R226 (U119): ativo | retirado. "Retirado do cliente" = saiu do bloco por uma atividade (equipamento_movimentos); cliente_id e cliente_sistema_id ficam nulos e retirado_de_cliente_id guarda de onde saiu.';

CREATE TABLE IF NOT EXISTS public.equipamento_movimentos (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patrimonio_id      uuid NOT NULL REFERENCES public.equipamentos_patrimonio(id) ON DELETE CASCADE,
  chamado_id         uuid NOT NULL REFERENCES public.chamados(id) ON DELETE CASCADE,
  tipo               text NOT NULL,
  -- para onde foi / de onde saiu (o cliente da atividade)
  cliente_id         uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  cliente_sistema_id uuid REFERENCES public.cliente_sistemas(id) ON DELETE SET NULL,
  -- o estado ANTES do movimento — é o que o desfazer restaura
  antes_cliente_id   uuid,
  antes_sistema_id   uuid,
  antes_pessoa_id    uuid,
  antes_situacao     text,
  feito_por          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  feito_em           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT equipamento_movimentos_tipo_check CHECK (tipo IN ('retirada', 'instalacao'))
);
COMMENT ON TABLE public.equipamento_movimentos IS
  'R226 (U119): cada retirada/instalação de um equipamento físico feita por uma atividade. Só se escreve pela RPC mover_equipamento (e se desfaz por desfazer_movimento_equipamento).';
CREATE INDEX IF NOT EXISTS equipamento_movimentos_chamado_idx ON public.equipamento_movimentos (chamado_id);
CREATE INDEX IF NOT EXISTS equipamento_movimentos_patrimonio_idx ON public.equipamento_movimentos (patrimonio_id);

ALTER TABLE public.equipamento_movimentos ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.equipamento_movimentos TO authenticated;
GRANT ALL ON public.equipamento_movimentos TO service_role;
DROP POLICY IF EXISTS "equipamento_movimentos_select" ON public.equipamento_movimentos;
CREATE POLICY "equipamento_movimentos_select" ON public.equipamento_movimentos
  FOR SELECT TO authenticated
  USING (public.pode_acessar_chamado(chamado_id));
-- sem policy de INSERT/UPDATE/DELETE para authenticated: só a RPC escreve

-- a RPC do movimento — SECURITY DEFINER porque o técnico não tem UPDATE em
-- equipamentos_patrimonio (U109: só gestor), e não deve ter: o que ele pode
-- fazer é ESTE gesto, validado, com rastro.
CREATE OR REPLACE FUNCTION public.mover_equipamento(_patrimonio uuid, _chamado uuid, _tipo text, _sistema uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $u119f$
DECLARE
  v_uid uuid := auth.uid();
  v_ch  record;
  v_it  record;
  v_id  uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Faça login para movimentar equipamentos.'; END IF;
  IF _tipo NOT IN ('retirada', 'instalacao') THEN RAISE EXCEPTION 'Tipo de movimento inválido: %', _tipo; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_uid AND p.ativo AND p.status <> 'pendente_aprovacao') THEN
    RAISE EXCEPTION 'Seu acesso ainda não foi aprovado.';
  END IF;

  SELECT id, cliente_id, natureza INTO v_ch FROM public.chamados WHERE id = _chamado;
  IF NOT FOUND THEN RAISE EXCEPTION 'Atividade não encontrada.'; END IF;
  -- R226: só cliente ÚNICO — sem cliente (interna) ou com mais de um (grupo) não movimenta
  IF v_ch.cliente_id IS NULL THEN RAISE EXCEPTION 'A atividade não tem um cliente único.'; END IF;
  IF EXISTS (SELECT 1 FROM public.chamado_locais l
              WHERE l.chamado_id = _chamado AND l.cliente_id IS NOT NULL AND l.cliente_id <> v_ch.cliente_id) THEN
    RAISE EXCEPTION 'A atividade tem mais de um cliente (grupo) — movimente o patrimônio pela ficha do cliente.';
  END IF;

  SELECT id, cliente_id, pessoa_id, cliente_sistema_id, situacao
    INTO v_it FROM public.equipamentos_patrimonio WHERE id = _patrimonio FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Equipamento não encontrado.'; END IF;

  IF _tipo = 'retirada' THEN
    IF v_it.cliente_id IS DISTINCT FROM v_ch.cliente_id THEN
      RAISE EXCEPTION 'Este equipamento não está no cliente da atividade.';
    END IF;
    INSERT INTO public.equipamento_movimentos
      (patrimonio_id, chamado_id, tipo, cliente_id, cliente_sistema_id,
       antes_cliente_id, antes_sistema_id, antes_pessoa_id, antes_situacao, feito_por)
    VALUES (_patrimonio, _chamado, 'retirada', v_ch.cliente_id, v_it.cliente_sistema_id,
            v_it.cliente_id, v_it.cliente_sistema_id, v_it.pessoa_id, v_it.situacao, v_uid)
    RETURNING id INTO v_id;
    UPDATE public.equipamentos_patrimonio
       SET cliente_id = NULL, cliente_sistema_id = NULL, situacao = 'retirado',
           retirado_em = now(), retirado_de_cliente_id = v_ch.cliente_id, updated_at = now()
     WHERE id = _patrimonio;
  ELSE
    IF _sistema IS NULL THEN RAISE EXCEPTION 'Escolha o bloco em que o equipamento foi instalado.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.cliente_sistemas s WHERE s.id = _sistema AND s.cliente_id = v_ch.cliente_id) THEN
      RAISE EXCEPTION 'O bloco escolhido não é deste cliente.';
    END IF;
    IF v_it.cliente_id IS NOT NULL AND v_it.cliente_id <> v_ch.cliente_id THEN
      RAISE EXCEPTION 'O equipamento está em outro cliente — retire-o de lá primeiro.';
    END IF;
    INSERT INTO public.equipamento_movimentos
      (patrimonio_id, chamado_id, tipo, cliente_id, cliente_sistema_id,
       antes_cliente_id, antes_sistema_id, antes_pessoa_id, antes_situacao, feito_por)
    VALUES (_patrimonio, _chamado, 'instalacao', v_ch.cliente_id, _sistema,
            v_it.cliente_id, v_it.cliente_sistema_id, v_it.pessoa_id, v_it.situacao, v_uid)
    RETURNING id INTO v_id;
    UPDATE public.equipamentos_patrimonio
       SET cliente_id = v_ch.cliente_id, pessoa_id = NULL, cliente_sistema_id = _sistema,
           situacao = 'ativo', retirado_em = NULL, retirado_de_cliente_id = NULL, updated_at = now()
     WHERE id = _patrimonio;
  END IF;
  RETURN v_id;
END;
$u119f$;
REVOKE EXECUTE ON FUNCTION public.mover_equipamento(uuid, uuid, text, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.mover_equipamento(uuid, uuid, text, uuid) TO authenticated, service_role;

-- desfazer: quem fez (ou um gestor) volta o equipamento ao estado de antes e
-- apaga o movimento — para o clique errado, não para reescrever história antiga
CREATE OR REPLACE FUNCTION public.desfazer_movimento_equipamento(_movimento uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $u119g$
DECLARE
  v_uid uuid := auth.uid();
  v_m record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Faça login.'; END IF;
  SELECT * INTO v_m FROM public.equipamento_movimentos WHERE id = _movimento FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Movimento não encontrado.'; END IF;
  IF v_m.feito_por IS DISTINCT FROM v_uid AND NOT public.is_gestor(v_uid) THEN
    RAISE EXCEPTION 'Só quem fez o movimento (ou um gestor) pode desfazê-lo.';
  END IF;
  UPDATE public.equipamentos_patrimonio
     SET cliente_id = v_m.antes_cliente_id, cliente_sistema_id = v_m.antes_sistema_id,
         pessoa_id = v_m.antes_pessoa_id, situacao = coalesce(v_m.antes_situacao, 'ativo'),
         retirado_em = CASE WHEN coalesce(v_m.antes_situacao, 'ativo') = 'retirado' THEN retirado_em ELSE NULL END,
         retirado_de_cliente_id = CASE WHEN coalesce(v_m.antes_situacao, 'ativo') = 'retirado' THEN retirado_de_cliente_id ELSE NULL END,
         updated_at = now()
   WHERE id = v_m.patrimonio_id;
  DELETE FROM public.equipamento_movimentos WHERE id = _movimento;
END;
$u119g$;
REVOKE EXECUTE ON FUNCTION public.desfazer_movimento_equipamento(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.desfazer_movimento_equipamento(uuid) TO authenticated, service_role;

-- as três LEITURAS da tela — DEFINER porque a policy de leitura do patrimônio
-- (U109) só mostra ao técnico o cliente que ele "vê"; com a R221 toda pessoa
-- logada vê toda atividade, e a atividade precisa mostrar o patrimônio do
-- cliente dela. Cada uma exige login e (quando há atividade) pode_acessar_chamado.
CREATE OR REPLACE FUNCTION public.equipamentos_da_atividade(_chamado uuid)
RETURNS TABLE (
  movimento_id uuid, tipo text, patrimonio_id uuid, identificacao text,
  nome text, modelo text, fabricante text,
  sistema_id uuid, sistema_nome text, feito_por uuid, feito_em timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $u119h$
  SELECT m.id, m.tipo, m.patrimonio_id, e.identificacao,
         cat.nome, cat.modelo, cat.fabricante,
         m.cliente_sistema_id, s.nome, m.feito_por, m.feito_em
    FROM public.equipamento_movimentos m
    JOIN public.equipamentos_patrimonio e ON e.id = m.patrimonio_id
    JOIN public.catalogo_equipamentos cat ON cat.id = e.catalogo_id
    LEFT JOIN public.cliente_sistemas s ON s.id = m.cliente_sistema_id
   WHERE m.chamado_id = _chamado AND public.pode_acessar_chamado(_chamado)
   ORDER BY m.feito_em DESC;
$u119h$;

CREATE OR REPLACE FUNCTION public.equipamentos_do_cliente_da_atividade(_chamado uuid)
RETURNS TABLE (
  patrimonio_id uuid, identificacao text, nome text, modelo text, fabricante text,
  sistema_id uuid, sistema_nome text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $u119i$
  SELECT e.id, e.identificacao, cat.nome, cat.modelo, cat.fabricante, e.cliente_sistema_id, s.nome
    FROM public.chamados c
    JOIN public.equipamentos_patrimonio e ON e.cliente_id = c.cliente_id
    JOIN public.catalogo_equipamentos cat ON cat.id = e.catalogo_id
    LEFT JOIN public.cliente_sistemas s ON s.id = e.cliente_sistema_id
   WHERE c.id = _chamado AND c.cliente_id IS NOT NULL
     AND e.situacao = 'ativo'
     AND public.pode_acessar_chamado(_chamado)
   ORDER BY s.nome NULLS LAST, cat.nome, e.identificacao;
$u119i$;

-- os equipamentos que NÃO estão em cliente nenhum (com uma pessoa, no
-- almoxarifado, ou retirados) — os candidatos a instalação. Busca por
-- identificação, nome, modelo, fabricante ou local do QAP; teto para a lista
-- não virar os 4.241 itens.
CREATE OR REPLACE FUNCTION public.buscar_equipamentos_livres(_busca text DEFAULT '', _teto integer DEFAULT 30)
RETURNS TABLE (
  patrimonio_id uuid, identificacao text, nome text, modelo text, fabricante text,
  local_qap text, pessoa_nome text, situacao text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $u119j$
  SELECT e.id, e.identificacao, cat.nome, cat.modelo, cat.fabricante, e.local_qap, p.nome, e.situacao
    FROM public.equipamentos_patrimonio e
    JOIN public.catalogo_equipamentos cat ON cat.id = e.catalogo_id
    LEFT JOIN public.profiles p ON p.id = e.pessoa_id
   WHERE auth.uid() IS NOT NULL
     AND e.cliente_id IS NULL
     AND (coalesce(btrim(_busca), '') = ''
          OR concat_ws(' ', e.identificacao, cat.nome, cat.modelo, cat.fabricante, e.local_qap, p.nome)
             ILIKE '%' || btrim(_busca) || '%')
   ORDER BY cat.nome, e.identificacao
   LIMIT greatest(1, least(coalesce(_teto, 30), 200));
$u119j$;

REVOKE EXECUTE ON FUNCTION public.equipamentos_da_atividade(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.equipamentos_do_cliente_da_atividade(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.buscar_equipamentos_livres(text, integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.equipamentos_da_atividade(uuid) TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.equipamentos_do_cliente_da_atividade(uuid) TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.buscar_equipamentos_livres(text, integer) TO authenticated, service_role;

COMMIT;

-- ── CONFERÊNCIA (obtido × esperado × veredito) ──────────────────────────────
WITH conferencia AS (
  SELECT 'R221: chamados_select é qual = true' AS item,
         (SELECT qual FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chamados' AND policyname = 'chamados_select') AS obtido,
         'true' AS esperado
  UNION ALL
  SELECT 'R221: visitas_select é qual = true',
         (SELECT qual FROM pg_policies WHERE schemaname = 'public' AND tablename = 'visitas_tecnicas' AND policyname = 'visitas_select'), 'true'
  UNION ALL
  SELECT 'R221: pode_acessar_chamado não cita mais responsavel_id',
         (SELECT (pg_get_functiondef('public.pode_acessar_chamado(uuid)'::regprocedure) NOT LIKE '%responsavel_id%')::text), 'true'
  UNION ALL
  SELECT 'R223: mensagens_chat existe com RLS ligada',
         (SELECT relrowsecurity::text FROM pg_class WHERE oid = 'public.mensagens_chat'::regclass), 'true'
  UNION ALL
  SELECT 'R223: mensagens_chat tem 3 policies',
         (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'public' AND tablename = 'mensagens_chat'), '3'
  UNION ALL
  SELECT 'R223: mensagens_chat está na publicação realtime',
         (SELECT count(*)::text FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'mensagens_chat'), '1'
  UNION ALL
  SELECT 'R222: minhas_mencoes v2 devolve 13 colunas',
         (SELECT count(*)::text FROM pg_proc p, unnest(p.proargmodes) m WHERE p.oid = 'public.minhas_mencoes(integer)'::regprocedure AND m = 't'), '13'
  UNION ALL
  SELECT 'R222: minhas_mencoes continua SECURITY INVOKER',
         (SELECT (NOT prosecdef)::text FROM pg_proc WHERE oid = 'public.minhas_mencoes(integer)'::regprocedure), 'true'
  UNION ALL
  SELECT 'R222: minhas_mencoes tem as 4 origens',
         (SELECT ((d LIKE '%''comentario''%') AND (d LIKE '%''descricao''%') AND (d LIKE '%''diagnostico''%') AND (d LIKE '%''solucao''%'))::text
            FROM (SELECT pg_get_functiondef('public.minhas_mencoes(integer)'::regprocedure) AS d) x), 'true'
  UNION ALL
  SELECT 'R222: gatilho de menção no diagnóstico/solução vivo',
         (SELECT count(*)::text FROM pg_trigger WHERE tgname = 'trg_notify_mencao_registro' AND NOT tgisinternal), '1'
  UNION ALL
  SELECT 'R225: chamados.reagendamentos existe (integer, default 0)',
         (SELECT data_type || '/' || column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chamados' AND column_name = 'reagendamentos'), 'integer/0'
  UNION ALL
  SELECT 'R225: gatilho que conta reagendamentos vivo',
         (SELECT count(*)::text FROM pg_trigger WHERE tgname = 'trg_contar_reagendamento' AND NOT tgisinternal), '1'
  UNION ALL
  SELECT 'R225: job agenda-de-hoje às 11:00 UTC (08h BRT)',
         (SELECT coalesce((SELECT schedule FROM cron.job WHERE jobname = 'agenda-de-hoje'), 'pg_cron sem o job')), '0 11 * * *'
  UNION ALL
  SELECT 'R226: patrimônio tem situacao com CHECK',
         (SELECT count(*)::text FROM pg_constraint WHERE conrelid = 'public.equipamentos_patrimonio'::regclass AND conname = 'equipamentos_patrimonio_situacao_check'), '1'
  UNION ALL
  SELECT 'R226: nenhum item nasce retirado',
         (SELECT count(*)::text FROM public.equipamentos_patrimonio WHERE situacao <> 'ativo'), '0'
  UNION ALL
  SELECT 'R226: equipamento_movimentos existe, RLS ligada, 1 policy (só leitura)',
         (SELECT relrowsecurity::text || '/' || (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'equipamento_movimentos')::text
            FROM pg_class WHERE oid = 'public.equipamento_movimentos'::regclass), 'true/1'
  UNION ALL
  SELECT 'R226: authenticated NÃO insere direto em equipamento_movimentos (só pela RPC)',
         has_table_privilege('authenticated', 'public.equipamento_movimentos', 'INSERT')::text, 'false'
  UNION ALL
  SELECT 'R226: as 5 RPCs existem',
         (SELECT count(*)::text FROM pg_proc WHERE pronamespace = 'public'::regnamespace
            AND proname IN ('mover_equipamento', 'desfazer_movimento_equipamento', 'equipamentos_da_atividade', 'equipamentos_do_cliente_da_atividade', 'buscar_equipamentos_livres')), '5'
  UNION ALL
  SELECT 'R226: authenticated executa mover_equipamento',
         has_function_privilege('authenticated', 'public.mover_equipamento(uuid, uuid, text, uuid)', 'EXECUTE')::text, 'true'
  UNION ALL
  SELECT 'gatilhos da U95 continuam vivos',
         (SELECT count(*)::text FROM pg_trigger WHERE tgname IN ('trg_notify_chamado_comentario', 'trg_notify_mencao_descricao') AND NOT tgisinternal), '2'
)
SELECT item, obtido, esperado,
       CASE WHEN obtido IS NOT DISTINCT FROM esperado THEN 'ok' ELSE '>>> OLHAR <<<' END AS veredito
  FROM conferencia;

-- ── DESFAZER (na ordem inversa; só se precisar voltar) ──────────────────────
-- SELECT cron.unschedule('agenda-de-hoje');
-- DROP FUNCTION IF EXISTS public.notificar_agendadas_de_hoje();
-- DROP TRIGGER IF EXISTS trg_contar_reagendamento ON public.chamados;
-- DROP FUNCTION IF EXISTS public.contar_reagendamento();
-- ALTER TABLE public.chamados DROP COLUMN IF EXISTS reagendamentos;
-- DROP FUNCTION IF EXISTS public.buscar_equipamentos_livres(text, integer);
-- DROP FUNCTION IF EXISTS public.equipamentos_do_cliente_da_atividade(uuid);
-- DROP FUNCTION IF EXISTS public.equipamentos_da_atividade(uuid);
-- DROP FUNCTION IF EXISTS public.desfazer_movimento_equipamento(uuid);
-- DROP FUNCTION IF EXISTS public.mover_equipamento(uuid, uuid, text, uuid);
-- DROP TABLE IF EXISTS public.equipamento_movimentos;
-- ALTER TABLE public.equipamentos_patrimonio DROP COLUMN IF EXISTS situacao, DROP COLUMN IF EXISTS retirado_em, DROP COLUMN IF EXISTS retirado_de_cliente_id;
-- DROP TRIGGER IF EXISTS trg_notify_mencao_registro ON public.chamados;
-- DROP FUNCTION IF EXISTS public.notify_mencao_registro();
-- DROP FUNCTION IF EXISTS public.minhas_mencoes(integer);  -- e recriar a v1 pela U117
-- DROP TABLE IF EXISTS public.mensagens_chat;
-- pode_acessar_chamado / chamados_select / visitas_select: recriar pelos textos da s2, u29 e u6c.
