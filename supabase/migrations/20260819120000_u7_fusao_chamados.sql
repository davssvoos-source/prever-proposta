-- ETAPA U7 da unificação — FUSÃO: chamado e demanda viram a MESMA coisa.
-- Referência: docs/PRODUTO.md §3 e §9. Regra ditada: "Chamados e Demanda devem
-- ser a mesma coisa, vamos chamar tudo de Chamado".
--
-- >>> RODAR NO SQL EDITOR DA LOVABLE (Cloud → SQL editor). <<<
-- >>> ATENÇÃO: esta migration e o código novo vão JUNTOS. Rode e publique  <<<
-- >>> na mesma janela — o código antigo não encontra mais ordens_servico.  <<<
-- >>> Conferir o SELECT final: cada linha traz o valor esperado ao lado.   <<<
--
-- ESTRATÉGIA (menor risco): em vez de criar tabela nova e religar 9 satélites,
-- RENOMEIA ordens_servico → chamados e ABSORVE demandas dentro dela. Assim
-- fotos, checklist, peças, análise e cobranças mantêm suas chaves intactas —
-- só os chamados internos migram, preservando os MESMOS ids (por isso apoios,
-- feed e equipamentos continuam apontando certo).
--
-- O QUE MUDA PARA QUEM USA
--   • numeração única: CH-2026-0001 (o número antigo fica em numero_legado)
--   • um vocabulário de status para tudo
--   • "técnico" e "responsável" viram o mesmo campo
--
-- NÃO É IDEMPOTENTE por natureza (renomeia tabelas). Roda UMA vez; o guard
-- abaixo aborta sem estragar nada se já tiver rodado.

-- ═══════════════════════════════════════════════════════════════════════
-- 0) GUARD — não deixa rodar duas vezes
-- ═══════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='chamados') THEN
    RAISE EXCEPTION 'A fusão já foi aplicada (a tabela chamados existe). Nada foi alterado.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='ordens_servico') THEN
    RAISE EXCEPTION 'ordens_servico não existe — banco em estado inesperado. Nada foi alterado.';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 1) RENOMEIA O NÚCLEO E OS SATÉLITES
-- ═══════════════════════════════════════════════════════════════════════
-- Renomear leva junto chaves, índices, triggers e policies — nada se perde.
ALTER TABLE public.ordens_servico   RENAME TO chamados;
ALTER TABLE public.os_fotos         RENAME TO chamado_fotos;
ALTER TABLE public.os_eventos       RENAME TO chamado_eventos;
ALTER TABLE public.os_checklist     RENAME TO chamado_checklist;
ALTER TABLE public.os_checklist_templates RENAME TO chamado_checklist_templates;
ALTER TABLE public.os_pecas         RENAME TO chamado_pecas;
ALTER TABLE public.os_pecas_analise RENAME TO chamado_pecas_analise;
ALTER TABLE public.os_sla           RENAME TO chamado_sla;
ALTER TABLE public.os_contadores    RENAME TO chamado_contadores;

ALTER TABLE public.chamado_fotos         RENAME COLUMN os_id TO chamado_id;
ALTER TABLE public.chamado_eventos       RENAME COLUMN os_id TO chamado_id;
ALTER TABLE public.chamado_checklist     RENAME COLUMN os_id TO chamado_id;
ALTER TABLE public.chamado_pecas         RENAME COLUMN os_id TO chamado_id;
ALTER TABLE public.chamado_pecas_analise RENAME COLUMN os_id TO chamado_id;
ALTER TABLE public.cobrancas             RENAME COLUMN os_id TO chamado_id;
ALTER TABLE public.cobrancas             RENAME COLUMN peca_id TO chamado_peca_id;
ALTER TABLE public.cliente_equipamento_unidades RENAME COLUMN os_instalacao_id TO chamado_instalacao_id;
ALTER TABLE public.cliente_equipamento_unidades RENAME COLUMN os_retirada_id   TO chamado_retirada_id;

-- "técnico" e "responsável" eram o mesmo papel com dois nomes
ALTER TABLE public.chamados RENAME COLUMN tecnico_id TO responsavel_id;

-- ═══════════════════════════════════════════════════════════════════════
-- 1.1) SILENCIA OS TRIGGERS ANTIGOS ANTES DE ENCOSTAR NOS DADOS
-- ═══════════════════════════════════════════════════════════════════════
-- Renomear a tabela leva os triggers junto, mas NÃO reescreve o corpo das
-- funções deles. Os sete triggers herdados de ordens_servico ainda procuram
-- coisas que acabaram de deixar de existir:
--   trg_os_numero_prazo / trg_os_recalcular_prazo → public.os_sla
--   trg_os_evento_ins|upd                        → public.os_eventos
--   trg_notify_os_ins|upd                        → NEW.tecnico_id
-- Sem isto, o primeiro UPDATE de status da seção 3 já morre com
-- 'relation "public.os_sla" does not exist' e a fusão inteira volta atrás.
--
-- Desligados também protegem os dados históricos: com o set_updated_at ativo,
-- a renumeração da seção 5 carimbaria now() em updated_at de TODOS os
-- registros, e os 537 chamados vindos do Notion perderiam a data real.
-- A seção 7 religa, já com os nomes novos no lugar.
ALTER TABLE public.chamados DISABLE TRIGGER USER;

-- ═══════════════════════════════════════════════════════════════════════
-- 2) CAMPOS QUE VÊM DO LADO INTERNO
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE public.chamados
  ADD COLUMN IF NOT EXISTS natureza      text NOT NULL DEFAULT 'campo',
  ADD COLUMN IF NOT EXISTS equipe        text NOT NULL DEFAULT 'tecnica',
  ADD COLUMN IF NOT EXISTS sprint        text,
  ADD COLUMN IF NOT EXISTS concluida_em  timestamptz,
  ADD COLUMN IF NOT EXISTS origem        text NOT NULL DEFAULT 'app',
  ADD COLUMN IF NOT EXISTS origem_id     text,
  ADD COLUMN IF NOT EXISTS numero_legado text;

-- chamado interno não tem cliente obrigatório
ALTER TABLE public.chamados ALTER COLUMN cliente_id DROP NOT NULL;
-- descricao_problema atende os dois lados (o interno chamava de "descricao")
COMMENT ON COLUMN public.chamados.descricao_problema IS
  'Descrição do chamado. No campo é o problema relatado; no interno, o pedido.';

-- ═══════════════════════════════════════════════════════════════════════
-- 3) VOCABULÁRIO ÚNICO DE STATUS E TIPO
-- ═══════════════════════════════════════════════════════════════════════
-- Ciclo do campo:   aberto → agendado → em_andamento → executado → concluido
-- Ciclo do interno: aberto → em_andamento → (stand_by|aguardando_aprovacao) → concluido
-- 'executado' é o portão da conferência que libera a cobrança — segue só no campo.
ALTER TABLE public.chamados DROP CONSTRAINT IF EXISTS ordens_servico_status_check;
ALTER TABLE public.chamados DROP CONSTRAINT IF EXISTS ordens_servico_tipo_check;
ALTER TABLE public.chamados DROP CONSTRAINT IF EXISTS ordens_servico_prioridade_check;
ALTER TABLE public.chamados DROP CONSTRAINT IF EXISTS ordens_servico_tipo_servico_check;
ALTER TABLE public.chamados DROP CONSTRAINT IF EXISTS ordens_servico_faturamento_check;

UPDATE public.chamados SET status = CASE status
  WHEN 'aberta'         THEN 'aberto'
  WHEN 'agendada'       THEN 'agendado'
  WHEN 'em_atendimento' THEN 'em_andamento'
  WHEN 'executada'      THEN 'executado'
  WHEN 'fechada'        THEN 'concluido'
  WHEN 'cancelada'      THEN 'cancelado'
  ELSE status END;

-- concluida_em nasce do fechamento que já existia
UPDATE public.chamados SET concluida_em = fechada_em
WHERE concluida_em IS NULL AND fechada_em IS NOT NULL;

ALTER TABLE public.chamados ADD CONSTRAINT chamados_status_check
  CHECK (status IN ('aberto','agendado','em_andamento','stand_by',
                    'aguardando_aprovacao','executado','concluido','cancelado'));
ALTER TABLE public.chamados ADD CONSTRAINT chamados_tipo_check
  CHECK (tipo IN ('corretiva','preventiva','operacional','implantacao',
                  'melhoria','pedido_compra'));
ALTER TABLE public.chamados ADD CONSTRAINT chamados_natureza_check
  CHECK (natureza IN ('campo','interno'));
ALTER TABLE public.chamados ADD CONSTRAINT chamados_equipe_check
  CHECK (equipe IN ('ti','patrimonio','audiovisual','business_ops','tecnica',
                    'comercial','sac','monitoramento'));
ALTER TABLE public.chamados ADD CONSTRAINT chamados_sprint_check
  CHECK (sprint IS NULL OR sprint IN ('este_mes','mes_que_vem','mes_passado','backlog'));
ALTER TABLE public.chamados ADD CONSTRAINT chamados_prioridade_check
  CHECK (prioridade IN ('baixa','normal','alta','urgente'));
ALTER TABLE public.chamados ADD CONSTRAINT chamados_tipo_servico_check
  CHECK (tipo_servico IS NULL OR tipo_servico IN ('instalacao','manutencao'));
ALTER TABLE public.chamados ADD CONSTRAINT chamados_faturamento_check
  CHECK (faturamento_status IN ('a_analisar','em_conferencia','aprovada','faturada','sem_cobranca'));

-- ═══════════════════════════════════════════════════════════════════════
-- 4) ABSORVE OS CHAMADOS INTERNOS (as antigas "demandas")
-- ═══════════════════════════════════════════════════════════════════════
-- Preserva os MESMOS ids: é isso que faz apoios, feed e equipamentos
-- continuarem apontando para o registro certo depois da fusão.
INSERT INTO public.chamados
  (id, numero, numero_legado, natureza, equipe, sprint, tipo, titulo,
   descricao_problema, cliente_id, responsavel_id, status, prioridade,
   prazo_limite, iniciada_em, concluida_em, aberto_por, origem, origem_id,
   created_at, updated_at, faturamento_status, tipo_servico)
SELECT
  d.id,
  d.numero,                       -- provisório; a renumeração abaixo troca
  d.numero,
  'interno',
  d.equipe,
  d.sprint,
  COALESCE(d.tipo, 'operacional'),
  d.titulo,
  d.descricao,
  d.cliente_id,
  d.responsavel_id,
  CASE d.status
    WHEN 'nao_iniciada'         THEN 'aberto'
    WHEN 'em_andamento'         THEN 'em_andamento'
    WHEN 'stand_by'             THEN 'stand_by'
    WHEN 'aguardando_aprovacao' THEN 'aguardando_aprovacao'
    WHEN 'concluida'            THEN 'concluido'
    WHEN 'cancelada'            THEN 'cancelado'
    ELSE 'aberto' END,
  'normal',
  -- prazo do interno era data; vira o fim daquele dia no fuso de Brasília
  CASE WHEN d.prazo IS NULL THEN NULL
       ELSE (d.prazo::text || ' 23:59:59')::timestamp AT TIME ZONE 'America/Sao_Paulo' END,
  d.iniciada_em,
  d.concluida_em,
  d.criada_por,
  d.origem,
  d.origem_id,
  d.created_at,
  d.updated_at,
  'sem_cobranca',                 -- chamado interno não gera cobrança de OS
  NULL
FROM public.demandas d;

-- ═══════════════════════════════════════════════════════════════════════
-- 5) NUMERAÇÃO ÚNICA — CH-AAAA-NNNN
-- ═══════════════════════════════════════════════════════════════════════
-- O número antigo (OS-… / DEM-…) fica preservado em numero_legado para quem
-- procurar pelo que já circulou em conversa.
UPDATE public.chamados SET numero_legado = numero WHERE numero_legado IS NULL;

ALTER TABLE public.chamados DROP CONSTRAINT IF EXISTS ordens_servico_numero_key;

WITH ordenados AS (
  SELECT id,
         EXTRACT(YEAR FROM created_at)::int AS ano,
         row_number() OVER (PARTITION BY EXTRACT(YEAR FROM created_at) ORDER BY created_at, id) AS seq
  FROM public.chamados
)
UPDATE public.chamados c
SET numero = 'CH-' || o.ano::text || '-' || lpad(o.seq::text, 4, '0')
FROM ordenados o WHERE o.id = c.id;

ALTER TABLE public.chamados ADD CONSTRAINT chamados_numero_key UNIQUE (numero);
CREATE INDEX IF NOT EXISTS chamados_numero_legado_idx ON public.chamados (numero_legado);

-- contador reflete o último número de cada ano
DELETE FROM public.chamado_contadores;
INSERT INTO public.chamado_contadores (ano, ultimo)
SELECT EXTRACT(YEAR FROM created_at)::int, count(*)
FROM public.chamados GROUP BY 1;

CREATE OR REPLACE FUNCTION public.proximo_numero_chamado()
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ano int := EXTRACT(YEAR FROM now() AT TIME ZONE 'America/Sao_Paulo')::int;
  v_seq int;
BEGIN
  INSERT INTO public.chamado_contadores (ano, ultimo) VALUES (v_ano, 1)
  ON CONFLICT (ano) DO UPDATE SET ultimo = chamado_contadores.ultimo + 1
  RETURNING ultimo INTO v_seq;
  RETURN 'CH-' || v_ano::text || '-' || lpad(v_seq::text, 4, '0');
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- 6) SATÉLITES DO LADO INTERNO PASSAM A APONTAR PARA chamados
-- ═══════════════════════════════════════════════════════════════════════
-- O feed interno entra no mesmo histórico do chamado (mesmos ids).
INSERT INTO public.chamado_eventos (id, chamado_id, tipo, descricao, user_id, created_at)
SELECT id, demanda_id, tipo, descricao, user_id, created_at FROM public.demanda_eventos;

ALTER TABLE public.demanda_apoios       RENAME TO chamado_apoios;
ALTER TABLE public.demanda_equipamentos RENAME TO chamado_equipamentos;
ALTER TABLE public.chamado_apoios       RENAME COLUMN demanda_id TO chamado_id;
ALTER TABLE public.chamado_equipamentos RENAME COLUMN demanda_id TO chamado_id;

ALTER TABLE public.chamado_apoios DROP CONSTRAINT IF EXISTS demanda_apoios_demanda_id_fkey;
ALTER TABLE public.chamado_apoios ADD CONSTRAINT chamado_apoios_chamado_id_fkey
  FOREIGN KEY (chamado_id) REFERENCES public.chamados(id) ON DELETE CASCADE;
ALTER TABLE public.chamado_equipamentos DROP CONSTRAINT IF EXISTS demanda_equipamentos_demanda_id_fkey;
ALTER TABLE public.chamado_equipamentos ADD CONSTRAINT chamado_equipamentos_chamado_id_fkey
  FOREIGN KEY (chamado_id) REFERENCES public.chamados(id) ON DELETE CASCADE;

-- notificações: os dois ponteiros viram um só
ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS chamado_id uuid;
UPDATE public.notificacoes SET chamado_id = COALESCE(os_id, demanda_id)
WHERE chamado_id IS NULL AND (os_id IS NOT NULL OR demanda_id IS NOT NULL);
ALTER TABLE public.notificacoes DROP COLUMN IF EXISTS os_id;
ALTER TABLE public.notificacoes DROP COLUMN IF EXISTS demanda_id;
ALTER TABLE public.notificacoes ADD CONSTRAINT notificacoes_chamado_id_fkey
  FOREIGN KEY (chamado_id) REFERENCES public.chamados(id) ON DELETE CASCADE;

-- agora sim, o lado interno some
DROP TABLE public.demanda_eventos;
DROP TABLE public.demandas;
DROP TABLE IF EXISTS public.demanda_contadores;

-- ═══════════════════════════════════════════════════════════════════════
-- 7) ÍNDICES E TRIGGERS DO REGISTRO ÚNICO
-- ═══════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS chamados_natureza_idx    ON public.chamados (natureza, status);
CREATE INDEX IF NOT EXISTS chamados_equipe_idx      ON public.chamados (equipe, sprint);
CREATE INDEX IF NOT EXISTS chamados_responsavel_idx ON public.chamados (responsavel_id);
CREATE UNIQUE INDEX IF NOT EXISTS chamados_origem_unico ON public.chamados (origem, origem_id);

-- Número, SLA, tipo de serviço, contrato e carimbos — tudo num trigger só.
-- a heurística de classificação também passa a falar "chamado"
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sugerir_tipo_demanda') THEN
    ALTER FUNCTION public.sugerir_tipo_demanda(text, text) RENAME TO sugerir_tipo_chamado;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.chamado_preencher()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_horas int;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.numero IS NULL OR NEW.numero = '' THEN
      NEW.numero := public.proximo_numero_chamado();
    END IF;
    IF NEW.tipo IS NULL THEN
      NEW.tipo := CASE WHEN NEW.natureza = 'campo' THEN 'corretiva'
                       ELSE public.sugerir_tipo_chamado(NEW.titulo, NEW.descricao_problema) END;
    END IF;
    -- SLA só faz sentido no campo; o interno tem prazo combinado
    IF NEW.natureza = 'campo' AND NEW.prazo_limite IS NULL THEN
      SELECT horas_prazo INTO v_horas FROM public.chamado_sla WHERE prioridade = NEW.prioridade;
      IF v_horas IS NOT NULL THEN
        NEW.prazo_limite := COALESCE(NEW.created_at, now()) + make_interval(hours => v_horas);
      END IF;
    END IF;
    IF NEW.natureza = 'campo' THEN
      IF NEW.tipo_servico IS NULL THEN
        NEW.tipo_servico := CASE WHEN NEW.tipo = 'implantacao' THEN 'instalacao' ELSE 'manutencao' END;
      END IF;
      IF NEW.contrato_id IS NULL AND NEW.cliente_id IS NOT NULL THEN
        NEW.contrato_id := public.contrato_vigente(NEW.cliente_id);
      END IF;
    ELSE
      -- interno entra no sprint do mês quando ninguém disse outra coisa
      IF NEW.sprint IS NULL THEN NEW.sprint := 'este_mes'; END IF;
    END IF;
    IF NEW.status = 'em_andamento' AND NEW.iniciada_em IS NULL THEN NEW.iniciada_em := now(); END IF;
    IF NEW.status = 'concluido'   AND NEW.concluida_em IS NULL THEN NEW.concluida_em := now(); END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'em_andamento' AND NEW.iniciada_em IS NULL THEN NEW.iniciada_em := now(); END IF;
    IF NEW.status = 'concluido' THEN
      NEW.concluida_em := COALESCE(NEW.concluida_em, now());
      IF NEW.natureza = 'campo' THEN NEW.fechada_em := COALESCE(NEW.fechada_em, now()); END IF;
    ELSIF OLD.status = 'concluido' THEN
      NEW.concluida_em := NULL; NEW.fechada_em := NULL;   -- reabriu
    END IF;
  END IF;
  -- escalar prioridade aperta o prazo (só campo, e só enquanto está aberto)
  IF NEW.natureza = 'campo' AND NEW.prioridade IS DISTINCT FROM OLD.prioridade
     AND NEW.status NOT IN ('concluido','cancelado') THEN
    SELECT horas_prazo INTO v_horas FROM public.chamado_sla WHERE prioridade = NEW.prioridade;
    NEW.prazo_limite := CASE WHEN v_horas IS NULL THEN NULL
                             ELSE COALESCE(NEW.created_at, now()) + make_interval(hours => v_horas) END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_os_numero_prazo      ON public.chamados;
DROP TRIGGER IF EXISTS trg_os_recalcular_prazo  ON public.chamados;
DROP TRIGGER IF EXISTS trg_demanda_preencher_ins ON public.chamados;
DROP TRIGGER IF EXISTS trg_demanda_preencher_upd ON public.chamados;
CREATE TRIGGER trg_chamado_preencher_ins BEFORE INSERT ON public.chamados
  FOR EACH ROW EXECUTE FUNCTION public.chamado_preencher();
CREATE TRIGGER trg_chamado_preencher_upd BEFORE UPDATE OF status, prioridade ON public.chamados
  FOR EACH ROW EXECUTE FUNCTION public.chamado_preencher();

-- Linha do tempo (vale para os dois lados)
CREATE OR REPLACE FUNCTION public.chamado_registrar_evento()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.chamado_eventos (chamado_id, tipo, descricao, user_id)
    VALUES (NEW.id, 'aberto', 'Chamado aberto', NEW.aberto_por);
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.chamado_eventos (chamado_id, tipo, descricao, user_id)
    VALUES (NEW.id, NEW.status, 'Status: ' || OLD.status || ' → ' || NEW.status, auth.uid());
  END IF;
  IF NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id THEN
    INSERT INTO public.chamado_eventos (chamado_id, tipo, descricao, user_id)
    VALUES (NEW.id, 'atribuido',
            CASE WHEN NEW.responsavel_id IS NULL THEN 'Responsável removido'
                 ELSE 'Responsável definido' END, auth.uid());
  END IF;
  IF NEW.sprint IS DISTINCT FROM OLD.sprint THEN
    INSERT INTO public.chamado_eventos (chamado_id, tipo, descricao, user_id)
    VALUES (NEW.id, 'sprint', 'Sprint: ' || COALESCE(OLD.sprint,'—') || ' → ' || COALESCE(NEW.sprint,'—'), auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_os_evento_ins ON public.chamados;
DROP TRIGGER IF EXISTS trg_os_evento_upd ON public.chamados;
DROP TRIGGER IF EXISTS trg_demanda_evento_ins ON public.chamados;
DROP TRIGGER IF EXISTS trg_demanda_evento_upd ON public.chamados;
CREATE TRIGGER trg_chamado_evento_ins AFTER INSERT ON public.chamados
  FOR EACH ROW EXECUTE FUNCTION public.chamado_registrar_evento();
CREATE TRIGGER trg_chamado_evento_upd AFTER UPDATE OF status, responsavel_id, sprint ON public.chamados
  FOR EACH ROW EXECUTE FUNCTION public.chamado_registrar_evento();

-- Notificações (regra da Etapa 0: sempre por trigger SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.notify_chamado()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_resumo text;
  v_novo_resp boolean;
BEGIN
  v_resumo := NEW.numero || ' · ' || NEW.titulo;
  IF TG_OP = 'INSERT' THEN
    v_novo_resp := NEW.responsavel_id IS NOT NULL;
  ELSE
    v_novo_resp := NEW.responsavel_id IS NOT NULL
                   AND NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id;
  END IF;

  IF v_novo_resp AND NEW.responsavel_id IS DISTINCT FROM auth.uid() THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, chamado_id)
    VALUES (NEW.responsavel_id, 'chamado_atribuido',
            CASE WHEN NEW.prioridade = 'urgente' THEN 'Chamado URGENTE para você'
                 ELSE 'Novo chamado para você' END, v_resumo, NEW.id);
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'executado' THEN
      INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, chamado_id)
      SELECT p.id, 'chamado_executado', 'Chamado executado',
             v_resumo || ' aguarda sua conferência.', NEW.id
      FROM public.profiles p
      WHERE p.cargo IN ('admin','comercial','sac') AND p.ativo IS DISTINCT FROM false
        AND p.status IS DISTINCT FROM 'rejeitado' AND p.status IS DISTINCT FROM 'pendente_aprovacao';
    ELSIF NEW.status = 'aguardando_aprovacao' THEN
      INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, chamado_id)
      SELECT p.id, 'chamado_aprovacao', 'Chamado aguardando aprovação', v_resumo, NEW.id
      FROM public.profiles p
      WHERE p.cargo IN ('admin','comercial') AND p.ativo IS DISTINCT FROM false
        AND p.status IS DISTINCT FROM 'rejeitado' AND p.status IS DISTINCT FROM 'pendente_aprovacao'
        AND p.id IS DISTINCT FROM auth.uid();
    ELSIF NEW.status = 'concluido' THEN
      IF NEW.responsavel_id IS NOT NULL AND NEW.responsavel_id IS DISTINCT FROM auth.uid() THEN
        INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, chamado_id)
        VALUES (NEW.responsavel_id, 'chamado_concluido', 'Chamado concluído', v_resumo, NEW.id);
      END IF;
      IF NEW.aberto_por IS NOT NULL AND NEW.aberto_por IS DISTINCT FROM auth.uid()
         AND NEW.aberto_por IS DISTINCT FROM NEW.responsavel_id THEN
        INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, chamado_id)
        VALUES (NEW.aberto_por, 'chamado_concluido', 'Chamado concluído', v_resumo, NEW.id);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_os_ins ON public.chamados;
DROP TRIGGER IF EXISTS trg_notify_os_upd ON public.chamados;
DROP TRIGGER IF EXISTS trg_notify_demanda_ins ON public.chamados;
DROP TRIGGER IF EXISTS trg_notify_demanda_upd ON public.chamados;
CREATE TRIGGER trg_notify_chamado_ins AFTER INSERT ON public.chamados
  FOR EACH ROW EXECUTE FUNCTION public.notify_chamado();
CREATE TRIGGER trg_notify_chamado_upd AFTER UPDATE OF status, responsavel_id ON public.chamados
  FOR EACH ROW EXECUTE FUNCTION public.notify_chamado();

-- o último herdado que ainda apontava para o mundo antigo
DROP TRIGGER IF EXISTS trg_os_sincronizar_unidades ON public.chamados;

-- fim do silêncio da seção 1.1: os antigos já foram substituídos, e o
-- ordens_servico_set_updated_at (que sobreviveu ao rename) volta ao ar
ALTER TABLE public.chamados ENABLE TRIGGER USER;

-- comentário no feed avisa os envolvidos (era só do lado interno; agora vale p/ todos)
CREATE OR REPLACE FUNCTION public.notify_chamado_comentario()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE c record;
BEGIN
  IF NEW.tipo <> 'comentario' THEN RETURN NEW; END IF;
  SELECT numero, titulo, responsavel_id, aberto_por INTO c
  FROM public.chamados WHERE id = NEW.chamado_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, chamado_id)
  SELECT DISTINCT alvo, 'chamado_comentario', 'Novo comentário',
         c.numero || ' · ' || c.titulo, NEW.chamado_id
  FROM (SELECT c.responsavel_id AS alvo
        UNION SELECT c.aberto_por
        UNION SELECT a.profile_id FROM public.chamado_apoios a WHERE a.chamado_id = NEW.chamado_id) e
  WHERE alvo IS NOT NULL AND alvo IS DISTINCT FROM NEW.user_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_demanda_comentario ON public.chamado_eventos;
CREATE TRIGGER trg_notify_chamado_comentario AFTER INSERT ON public.chamado_eventos
  FOR EACH ROW EXECUTE FUNCTION public.notify_chamado_comentario();

DROP TRIGGER IF EXISTS trg_notify_demanda_apoio ON public.chamado_apoios;
CREATE OR REPLACE FUNCTION public.notify_chamado_apoio()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE c record;
BEGIN
  IF NEW.profile_id IS NOT DISTINCT FROM auth.uid() THEN RETURN NEW; END IF;
  SELECT numero, titulo INTO c FROM public.chamados WHERE id = NEW.chamado_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, chamado_id)
  VALUES (NEW.profile_id, 'chamado_apoio', 'Você entrou como apoio',
          c.numero || ' · ' || c.titulo, NEW.chamado_id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_notify_chamado_apoio AFTER INSERT ON public.chamado_apoios
  FOR EACH ROW EXECUTE FUNCTION public.notify_chamado_apoio();

-- ═══════════════════════════════════════════════════════════════════════
-- 8) ACESSO — uma régua só
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.pode_acessar_chamado(_chamado_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    public.is_gestor(auth.uid())
    OR EXISTS (SELECT 1 FROM public.chamados c
               WHERE c.id = _chamado_id
                 AND (c.responsavel_id = auth.uid() OR c.aberto_por = auth.uid()
                      OR c.responsavel_id IS NULL))
    OR EXISTS (SELECT 1 FROM public.chamado_apoios a
               WHERE a.chamado_id = _chamado_id AND a.profile_id = auth.uid()),
    false);
$$;
REVOKE EXECUTE ON FUNCTION public.pode_acessar_chamado(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_acessar_chamado(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pode_acessar_chamado_por_path(_name text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  BEGIN v_id := split_part(_name, '/', 1)::uuid;
  EXCEPTION WHEN OTHERS THEN RETURN false; END;
  RETURN public.pode_acessar_chamado(v_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.pode_acessar_chamado_por_path(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_acessar_chamado_por_path(text) TO authenticated, service_role;

-- policies do registro único (as antigas vieram junto no rename)
DROP POLICY IF EXISTS "os_select" ON public.chamados;
DROP POLICY IF EXISTS "os_insert_gestor" ON public.chamados;
DROP POLICY IF EXISTS "os_update" ON public.chamados;
DROP POLICY IF EXISTS "os_delete_admin" ON public.chamados;
-- leitura aberta ao time: o quadro interno sempre foi assim e o SAC precisa ver tudo
CREATE POLICY "chamados_select" ON public.chamados
  FOR SELECT TO authenticated
  USING (public.is_gestor(auth.uid()) OR responsavel_id = auth.uid()
         OR aberto_por = auth.uid() OR natureza = 'interno');
CREATE POLICY "chamados_insert" ON public.chamados
  FOR INSERT TO authenticated
  WITH CHECK (public.is_gestor(auth.uid()) OR aberto_por = auth.uid());
-- concluir e cancelar seguem sendo ato de gestor (é o portão da cobrança)
CREATE POLICY "chamados_update" ON public.chamados
  FOR UPDATE TO authenticated
  USING (public.pode_acessar_chamado(id))
  WITH CHECK (public.is_gestor(auth.uid())
              OR (public.pode_acessar_chamado(id)
                  AND (natureza = 'interno' OR status NOT IN ('concluido','cancelado'))));
CREATE POLICY "chamados_delete" ON public.chamados
  FOR DELETE TO authenticated USING (public.is_gestor(auth.uid()));

-- satélites passam a usar a régua nova
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['chamado_fotos','chamado_eventos','chamado_checklist',
                           'chamado_pecas','chamado_apoios','chamado_equipamentos'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', replace(t,'chamado_','os_') || '_select', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "os_fotos_select" ON public.chamado_fotos;
DROP POLICY IF EXISTS "os_fotos_insert" ON public.chamado_fotos;
DROP POLICY IF EXISTS "os_fotos_delete" ON public.chamado_fotos;
CREATE POLICY "chamado_fotos_select" ON public.chamado_fotos
  FOR SELECT TO authenticated USING (public.pode_acessar_chamado(chamado_id));
CREATE POLICY "chamado_fotos_insert" ON public.chamado_fotos
  FOR INSERT TO authenticated WITH CHECK (public.pode_acessar_chamado(chamado_id) AND created_by = auth.uid());
CREATE POLICY "chamado_fotos_delete" ON public.chamado_fotos
  FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_gestor(auth.uid()));

DROP POLICY IF EXISTS "os_eventos_select" ON public.chamado_eventos;
DROP POLICY IF EXISTS "os_eventos_insert" ON public.chamado_eventos;
DROP POLICY IF EXISTS "demanda_eventos_select" ON public.chamado_eventos;
DROP POLICY IF EXISTS "demanda_eventos_insert" ON public.chamado_eventos;
CREATE POLICY "chamado_eventos_select" ON public.chamado_eventos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "chamado_eventos_insert" ON public.chamado_eventos
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND tipo = 'comentario');

DROP POLICY IF EXISTS "os_checklist_select" ON public.chamado_checklist;
DROP POLICY IF EXISTS "os_checklist_insert" ON public.chamado_checklist;
DROP POLICY IF EXISTS "os_checklist_update" ON public.chamado_checklist;
DROP POLICY IF EXISTS "os_checklist_delete" ON public.chamado_checklist;
CREATE POLICY "chamado_checklist_select" ON public.chamado_checklist
  FOR SELECT TO authenticated USING (public.pode_acessar_chamado(chamado_id));
CREATE POLICY "chamado_checklist_insert" ON public.chamado_checklist
  FOR INSERT TO authenticated WITH CHECK (public.pode_acessar_chamado(chamado_id));
CREATE POLICY "chamado_checklist_update" ON public.chamado_checklist
  FOR UPDATE TO authenticated USING (public.pode_acessar_chamado(chamado_id))
  WITH CHECK (public.pode_acessar_chamado(chamado_id)
              AND (concluido_por IS NULL OR concluido_por = auth.uid()));
CREATE POLICY "chamado_checklist_delete" ON public.chamado_checklist
  FOR DELETE TO authenticated USING (public.is_gestor(auth.uid()));

DROP POLICY IF EXISTS "os_pecas_select" ON public.chamado_pecas;
DROP POLICY IF EXISTS "os_pecas_insert" ON public.chamado_pecas;
DROP POLICY IF EXISTS "os_pecas_update" ON public.chamado_pecas;
DROP POLICY IF EXISTS "os_pecas_delete" ON public.chamado_pecas;
CREATE POLICY "chamado_pecas_select" ON public.chamado_pecas
  FOR SELECT TO authenticated USING (public.pode_acessar_chamado(chamado_id));
CREATE POLICY "chamado_pecas_insert" ON public.chamado_pecas
  FOR INSERT TO authenticated
  WITH CHECK (public.pode_acessar_chamado(chamado_id)
              AND EXISTS (SELECT 1 FROM public.chamados c WHERE c.id = chamado_id
                          AND c.status NOT IN ('concluido','cancelado')));
CREATE POLICY "chamado_pecas_update" ON public.chamado_pecas
  FOR UPDATE TO authenticated USING (public.pode_acessar_chamado(chamado_id))
  WITH CHECK (public.is_gestor(auth.uid())
              OR EXISTS (SELECT 1 FROM public.chamados c WHERE c.id = chamado_id
                         AND c.status NOT IN ('concluido','cancelado')));
CREATE POLICY "chamado_pecas_delete" ON public.chamado_pecas
  FOR DELETE TO authenticated
  USING (public.pode_acessar_chamado(chamado_id)
         AND (public.is_gestor(auth.uid())
              OR EXISTS (SELECT 1 FROM public.chamados c WHERE c.id = chamado_id
                         AND c.status NOT IN ('concluido','cancelado'))));

DROP POLICY IF EXISTS "os_pecas_analise_select" ON public.chamado_pecas_analise;
DROP POLICY IF EXISTS "os_pecas_analise_write"  ON public.chamado_pecas_analise;
CREATE POLICY "chamado_pecas_analise_select" ON public.chamado_pecas_analise
  FOR SELECT TO authenticated USING (public.pode_ver_financeiro(auth.uid()));
CREATE POLICY "chamado_pecas_analise_write" ON public.chamado_pecas_analise
  FOR ALL TO authenticated USING (public.pode_ver_financeiro(auth.uid()))
  WITH CHECK (public.pode_ver_financeiro(auth.uid()));

DROP POLICY IF EXISTS "demanda_apoios_select" ON public.chamado_apoios;
DROP POLICY IF EXISTS "demanda_apoios_insert" ON public.chamado_apoios;
DROP POLICY IF EXISTS "demanda_apoios_delete" ON public.chamado_apoios;
CREATE POLICY "chamado_apoios_select" ON public.chamado_apoios
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "chamado_apoios_insert" ON public.chamado_apoios
  FOR INSERT TO authenticated
  WITH CHECK (public.pode_acessar_chamado(chamado_id) OR profile_id = auth.uid());
CREATE POLICY "chamado_apoios_delete" ON public.chamado_apoios
  FOR DELETE TO authenticated
  USING (public.pode_acessar_chamado(chamado_id) OR profile_id = auth.uid());

DROP POLICY IF EXISTS "demanda_equipamentos_select" ON public.chamado_equipamentos;
DROP POLICY IF EXISTS "demanda_equipamentos_write"  ON public.chamado_equipamentos;
CREATE POLICY "chamado_equipamentos_select" ON public.chamado_equipamentos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "chamado_equipamentos_write" ON public.chamado_equipamentos
  FOR ALL TO authenticated USING (public.pode_acessar_chamado(chamado_id))
  WITH CHECK (public.pode_acessar_chamado(chamado_id));

DROP POLICY IF EXISTS "os_checklist_templates_select" ON public.chamado_checklist_templates;
CREATE POLICY "chamado_checklist_templates_select" ON public.chamado_checklist_templates
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "os_sla_select" ON public.chamado_sla;
CREATE POLICY "chamado_sla_select" ON public.chamado_sla
  FOR SELECT TO authenticated USING (true);

-- storage das fotos/assinaturas
DROP POLICY IF EXISTS "fotos_os_read"   ON storage.objects;
DROP POLICY IF EXISTS "fotos_os_insert" ON storage.objects;
DROP POLICY IF EXISTS "fotos_os_delete" ON storage.objects;
CREATE POLICY "fotos_chamado_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'fotos-os' AND public.pode_acessar_chamado_por_path(name));
CREATE POLICY "fotos_chamado_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fotos-os' AND public.pode_acessar_chamado_por_path(name));
CREATE POLICY "fotos_chamado_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'fotos-os' AND (owner = auth.uid() OR public.is_gestor(auth.uid())));

-- ═══════════════════════════════════════════════════════════════════════
-- 9) FUNÇÕES DE NEGÓCIO QUE CITAVAM ordens_servico / demandas
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.visitas_na_competencia(_cliente_id uuid, _competencia text)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM public.chamados c
  WHERE c.cliente_id = _cliente_id AND c.natureza = 'campo' AND c.status = 'concluido'
    AND to_char(COALESCE(c.finalizada_em, c.fechada_em, c.created_at)
                AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') = _competencia;
$$;

CREATE OR REPLACE FUNCTION public.aprovar_chamado_financeiro(_chamado_id uuid)
RETURNS TABLE (itens integer, total numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ch record; v_revisar int; v_competencia text; v_data date;
  v_itens int := 0; v_total numeric := 0;
BEGIN
  IF NOT public.pode_ver_financeiro(auth.uid()) THEN
    RAISE EXCEPTION 'Somente quem responde pelo financeiro pode aprovar cobrança.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_ch FROM public.chamados WHERE id = _chamado_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chamado não encontrado.'; END IF;
  IF v_ch.status NOT IN ('executado','concluido') THEN
    RAISE EXCEPTION 'O chamado precisa estar executado para ter a cobrança aprovada.';
  END IF;

  SELECT count(*) INTO v_revisar FROM public.chamado_pecas_analise a
  WHERE a.chamado_id = _chamado_id AND a.resultado IN ('revisar','nao_identificado');
  IF v_revisar > 0 THEN
    RAISE EXCEPTION 'Ainda há % item(ns) em revisão. Resolva antes de aprovar.', v_revisar;
  END IF;

  v_data := COALESCE(v_ch.finalizada_em, v_ch.created_at)::date;
  v_competencia := to_char(v_data, 'YYYY-MM');

  DELETE FROM public.cobrancas WHERE chamado_id = _chamado_id AND status = 'aberta';

  INSERT INTO public.cobrancas
    (cliente_id, chamado_id, chamado_peca_id, contrato_id, descricao, quantidade,
     valor_unitario, valor, competencia, data_referencia, tipo_servico, criada_por)
  SELECT v_ch.cliente_id, _chamado_id, p.id, v_ch.contrato_id, p.descricao, p.quantidade,
         a.valor_calculado, round(a.valor_calculado * p.quantidade, 2),
         v_competencia, v_data, COALESCE(v_ch.tipo_servico,'manutencao'), auth.uid()
  FROM public.chamado_pecas p
  JOIN public.chamado_pecas_analise a ON a.peca_id = p.id
  WHERE p.chamado_id = _chamado_id AND a.resultado = 'faturavel'
    AND a.valor_calculado IS NOT NULL AND a.valor_calculado > 0;
  GET DIAGNOSTICS v_itens = ROW_COUNT;

  SELECT COALESCE(sum(valor),0) INTO v_total FROM public.cobrancas
  WHERE chamado_id = _chamado_id AND status = 'aberta';

  UPDATE public.chamados
  SET faturamento_status = CASE WHEN v_itens = 0 THEN 'sem_cobranca' ELSE 'aprovada' END
  WHERE id = _chamado_id;

  INSERT INTO public.chamado_eventos (chamado_id, tipo, descricao, user_id)
  VALUES (_chamado_id, 'cobranca_aprovada',
          CASE WHEN v_itens = 0 THEN 'Conferência concluída: nada a cobrar.'
               ELSE 'Cobrança aprovada: ' || v_itens || ' item(ns), total ' ||
                    to_char(v_total,'FM999G999G990D00') END, auth.uid());
  RETURN QUERY SELECT v_itens, v_total;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.aprovar_chamado_financeiro(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aprovar_chamado_financeiro(uuid) TO authenticated, service_role;
DROP FUNCTION IF EXISTS public.aprovar_os_financeiro(uuid);

CREATE OR REPLACE FUNCTION public.marcar_chamado_faturado(_chamado_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n int := 0;
BEGIN
  IF NOT public.pode_ver_financeiro(auth.uid()) THEN
    RAISE EXCEPTION 'Somente quem responde pelo financeiro pode marcar como faturada.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.cobrancas SET status = 'faturada'
  WHERE chamado_id = _chamado_id AND status IN ('aberta','fechada');
  GET DIAGNOSTICS v_n = ROW_COUNT;
  UPDATE public.chamados SET faturamento_status = 'faturada' WHERE id = _chamado_id;
  INSERT INTO public.chamado_eventos (chamado_id, tipo, descricao, user_id)
  VALUES (_chamado_id, 'cobranca_faturada', v_n || ' cobrança(s) marcadas como faturadas.', auth.uid());
  RETURN v_n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.marcar_chamado_faturado(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marcar_chamado_faturado(uuid) TO authenticated, service_role;
DROP FUNCTION IF EXISTS public.marcar_os_faturada(uuid);

CREATE OR REPLACE FUNCTION public.ajustar_item_cobranca(
  _peca_id uuid, _resultado text, _valor numeric DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ch uuid;
BEGIN
  IF NOT public.pode_ver_financeiro(auth.uid()) THEN
    RAISE EXCEPTION 'Somente quem responde pelo financeiro pode ajustar itens.' USING ERRCODE = '42501';
  END IF;
  IF _resultado NOT IN ('coberto','faturavel','nao_identificado','revisar') THEN
    RAISE EXCEPTION 'Resultado inválido: %', _resultado;
  END IF;
  IF _resultado = 'faturavel' AND (_valor IS NULL OR _valor <= 0) THEN
    RAISE EXCEPTION 'Item faturável precisa de valor. Sem preço, deixe em revisão.';
  END IF;
  SELECT chamado_id INTO v_ch FROM public.chamado_pecas WHERE id = _peca_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado.'; END IF;

  INSERT INTO public.chamado_pecas_analise
    (peca_id, chamado_id, resultado, valor_calculado, confianca, justificativa,
     ajustado_manualmente, ajustado_por)
  VALUES (_peca_id, v_ch, _resultado,
          CASE WHEN _resultado = 'coberto' THEN NULL ELSE _valor END,
          1, 'Ajustado manualmente na conferência.', true, auth.uid())
  ON CONFLICT (peca_id) DO UPDATE
    SET resultado = EXCLUDED.resultado, valor_calculado = EXCLUDED.valor_calculado,
        confianca = 1, justificativa = 'Ajustado manualmente na conferência.',
        ajustado_manualmente = true, ajustado_por = auth.uid(), updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.chamado_sincronizar_unidades()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; v_unidade uuid;
BEGIN
  IF NEW.status <> 'concluido' OR OLD.status = 'concluido' THEN RETURN NEW; END IF;
  FOR p IN SELECT * FROM public.chamado_pecas
           WHERE chamado_id = NEW.id AND numero_serie IS NOT NULL
             AND cliente_equipamento_id IS NOT NULL LOOP
    v_unidade := NULL;
    IF p.direcao IN ('instalado','substituido') THEN
      INSERT INTO public.cliente_equipamento_unidades
        (cliente_equipamento_id, numero_serie, tag_patrimonio, estado, instalado_em,
         chamado_instalacao_id, created_by)
      VALUES (p.cliente_equipamento_id, p.numero_serie, p.tag_patrimonio, 'instalado',
              COALESCE(NEW.finalizada_em, now())::date, NEW.id, p.created_by)
      ON CONFLICT (cliente_equipamento_id, (public.normalizar_texto(numero_serie)))
        WHERE numero_serie IS NOT NULL
      DO UPDATE SET estado = 'instalado',
                    tag_patrimonio = COALESCE(EXCLUDED.tag_patrimonio, cliente_equipamento_unidades.tag_patrimonio),
                    chamado_instalacao_id = EXCLUDED.chamado_instalacao_id,
                    retirado_em = NULL, updated_at = now()
      RETURNING id INTO v_unidade;
    ELSE
      UPDATE public.cliente_equipamento_unidades u
      SET estado = 'retirado', retirado_em = COALESCE(NEW.finalizada_em, now())::date,
          chamado_retirada_id = NEW.id, updated_at = now()
      WHERE u.cliente_equipamento_id = p.cliente_equipamento_id
        AND public.normalizar_texto(u.numero_serie) = public.normalizar_texto(p.numero_serie)
      RETURNING u.id INTO v_unidade;
    END IF;
    IF v_unidade IS NOT NULL AND p.unidade_id IS DISTINCT FROM v_unidade THEN
      UPDATE public.chamado_pecas SET unidade_id = v_unidade WHERE id = p.id;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_os_sincronizar_unidades ON public.chamados;
CREATE TRIGGER trg_chamado_sincronizar_unidades AFTER UPDATE OF status ON public.chamados
  FOR EACH ROW EXECUTE FUNCTION public.chamado_sincronizar_unidades();

-- ═══════════════════════════════════════════════════════════════════════
-- 10) ROTINAS AGENDADAS
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.virada_sprint()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_passado int; v_atual int; v_lotado int;
BEGIN
  UPDATE public.chamados SET sprint = 'mes_passado'
  WHERE natureza = 'interno' AND sprint = 'este_mes' AND status <> 'concluido';
  GET DIAGNOSTICS v_passado = ROW_COUNT;
  UPDATE public.chamados SET sprint = 'mes_passado'
  WHERE natureza = 'interno' AND sprint = 'este_mes' AND status = 'concluido';
  UPDATE public.chamados SET sprint = 'este_mes'
  WHERE natureza = 'interno' AND sprint = 'mes_que_vem';
  GET DIAGNOSTICS v_atual = ROW_COUNT;
  SELECT count(*) INTO v_lotado FROM public.chamados
  WHERE natureza = 'interno' AND sprint = 'este_mes' AND status NOT IN ('concluido','cancelado');
  IF v_lotado > 0 THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo)
    SELECT p.id, 'sprint_virada', 'Sprint do mês virou',
           v_lotado::text || ' chamado(s) em "Este mês" — ' || v_passado::text ||
           ' vieram pendentes do mês anterior.'
    FROM public.profiles p
    WHERE p.cargo IN ('admin','comercial') AND p.ativo IS DISTINCT FROM false
      AND p.status IS DISTINCT FROM 'rejeitado' AND p.status IS DISTINCT FROM 'pendente_aprovacao';
  END IF;
  RETURN 'pendentes->mes_passado: ' || v_passado || ' | mes_que_vem->este_mes: ' || v_atual;
END;
$$;

CREATE OR REPLACE FUNCTION public.alertas_chamados(_dias_parada int DEFAULT 7)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_vence int := 0; v_venceu int := 0; v_parada int := 0;
BEGIN
  INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, chamado_id)
  SELECT c.responsavel_id, 'chamado_prazo', 'Prazo vence amanhã', c.numero || ' · ' || c.titulo, c.id
  FROM public.chamados c
  WHERE c.responsavel_id IS NOT NULL AND c.status NOT IN ('concluido','cancelado')
    AND c.prazo_limite::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date + 1
    AND NOT EXISTS (SELECT 1 FROM public.notificacoes n WHERE n.chamado_id = c.id
                    AND n.tipo = 'chamado_prazo' AND n.created_at > now() - interval '20 hours');
  GET DIAGNOSTICS v_vence = ROW_COUNT;

  INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, chamado_id)
  SELECT alvo, 'chamado_atrasado', 'Chamado atrasado', c.numero || ' · ' || c.titulo, c.id
  FROM public.chamados c
  CROSS JOIN LATERAL (
    SELECT c.responsavel_id AS alvo
    UNION SELECT p.id FROM public.profiles p
    WHERE p.cargo IN ('admin','comercial','sac') AND p.ativo IS DISTINCT FROM false
      AND p.status IS DISTINCT FROM 'rejeitado' AND p.status IS DISTINCT FROM 'pendente_aprovacao'
  ) alvos
  WHERE alvo IS NOT NULL AND c.status NOT IN ('concluido','cancelado')
    AND c.prazo_limite < now()
    AND NOT EXISTS (SELECT 1 FROM public.notificacoes n WHERE n.chamado_id = c.id
                    AND n.tipo = 'chamado_atrasado' AND n.user_id = alvo
                    AND n.created_at > now() - interval '20 hours');
  GET DIAGNOSTICS v_venceu = ROW_COUNT;

  INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, chamado_id)
  SELECT c.responsavel_id, 'chamado_parado', 'Chamado parado',
         c.numero || ' · ' || c.titulo || ' — sem atualização há ' ||
         EXTRACT(DAY FROM now() - c.updated_at)::int::text || ' dias.', c.id
  FROM public.chamados c
  WHERE c.responsavel_id IS NOT NULL AND c.status IN ('em_andamento','stand_by')
    AND c.updated_at < now() - make_interval(days => _dias_parada)
    AND NOT EXISTS (SELECT 1 FROM public.notificacoes n WHERE n.chamado_id = c.id
                    AND n.tipo = 'chamado_parado' AND n.created_at > now() - interval '6 days');
  GET DIAGNOSTICS v_parada = ROW_COUNT;
  RETURN 'vence amanha: ' || v_vence || ' | atrasados: ' || v_venceu || ' | parados: ' || v_parada;
END;
$$;
DROP FUNCTION IF EXISTS public.alertas_demandas(int);

CREATE OR REPLACE FUNCTION public.resumo_semanal_chamados()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_envios int := 0; v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo)
  SELECT r.responsavel_id, 'resumo_semana', 'Sua semana',
         r.abertos::text || ' chamado(s) em aberto · ' || r.semana::text ||
         ' com prazo nesta semana · ' || r.atrasados::text || ' atrasado(s)'
  FROM (SELECT c.responsavel_id,
               count(*) FILTER (WHERE c.status NOT IN ('concluido','cancelado')) AS abertos,
               count(*) FILTER (WHERE c.status NOT IN ('concluido','cancelado')
                                AND c.prazo_limite::date BETWEEN v_hoje AND v_hoje + 6) AS semana,
               count(*) FILTER (WHERE c.status NOT IN ('concluido','cancelado')
                                AND c.prazo_limite < now()) AS atrasados
        FROM public.chamados c WHERE c.responsavel_id IS NOT NULL
        GROUP BY c.responsavel_id) r
  WHERE r.abertos > 0;
  GET DIAGNOSTICS v_envios = ROW_COUNT;
  RETURN 'resumos enviados: ' || v_envios;
END;
$$;
DROP FUNCTION IF EXISTS public.resumo_semanal_demandas();

CREATE OR REPLACE FUNCTION public.alertas_chamado_faturamento(_dias int DEFAULT 2)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_envios int := 0;
BEGIN
  INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, chamado_id)
  SELECT p.id, 'chamado_sem_analise', 'Chamado esperando análise de cobrança',
         c.numero || ' · ' || COALESCE(cl.nome,'cliente') || ' — executado há ' ||
         EXTRACT(DAY FROM now() - c.finalizada_em)::int::text || ' dias.', c.id
  FROM public.chamados c
  JOIN public.clientes cl ON cl.id = c.cliente_id
  CROSS JOIN public.profiles p
  WHERE c.natureza = 'campo' AND c.status = 'executado'
    AND c.faturamento_status = 'a_analisar' AND c.finalizada_em IS NOT NULL
    AND c.finalizada_em < now() - make_interval(days => _dias)
    AND p.cargo IN ('admin','comercial') AND p.ativo IS DISTINCT FROM false
    AND p.status IS DISTINCT FROM 'rejeitado' AND p.status IS DISTINCT FROM 'pendente_aprovacao'
    AND NOT EXISTS (SELECT 1 FROM public.notificacoes n WHERE n.chamado_id = c.id
                    AND n.tipo = 'chamado_sem_analise' AND n.user_id = p.id
                    AND n.created_at > now() - interval '3 days');
  GET DIAGNOSTICS v_envios = ROW_COUNT;
  RETURN 'avisos: ' || v_envios;
END;
$$;
DROP FUNCTION IF EXISTS public.alertas_os_faturamento(int);

DO $$
BEGIN
  PERFORM public.agendar_job('alertas-chamados','0 10 * * *','SELECT public.alertas_chamados();');
  PERFORM public.agendar_job('resumo-semana','0 11 * * 1','SELECT public.resumo_semanal_chamados();');
  PERFORM public.agendar_job('alertas-chamado-faturamento','0 12 * * 1-5','SELECT public.alertas_chamado_faturamento();');
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'agendamento: %', SQLERRM;
END $$;

-- funções antigas que não existem mais
DROP FUNCTION IF EXISTS public.pode_acessar_os(uuid);
DROP FUNCTION IF EXISTS public.pode_acessar_os_por_path(text);
DROP FUNCTION IF EXISTS public.pode_editar_demanda(uuid);
DROP FUNCTION IF EXISTS public.proximo_numero_os();
DROP FUNCTION IF EXISTS public.proximo_numero_demanda();
DROP FUNCTION IF EXISTS public.os_preencher_numero_e_prazo();
DROP FUNCTION IF EXISTS public.os_recalcular_prazo();
DROP FUNCTION IF EXISTS public.os_registrar_evento();
DROP FUNCTION IF EXISTS public.demanda_preencher();
DROP FUNCTION IF EXISTS public.demanda_registrar_evento();
DROP FUNCTION IF EXISTS public.notify_os();
DROP FUNCTION IF EXISTS public.notify_demanda();
DROP FUNCTION IF EXISTS public.notify_demanda_comentario();
DROP FUNCTION IF EXISTS public.notify_demanda_apoio();
DROP FUNCTION IF EXISTS public.os_sincronizar_unidades();

-- realtime
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.chamados;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO FINAL
-- ═══════════════════════════════════════════════════════════════════════
SELECT 'tabela chamados existe' AS verificacao,
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables
         WHERE table_schema='public' AND table_name='chamados') THEN 'sim' ELSE 'NAO' END AS resultado,
       'sim' AS esperado
UNION ALL
SELECT 'demandas e ordens_servico nao existem mais', count(*)::text, '0'
FROM information_schema.tables WHERE table_schema='public'
  AND table_name IN ('demandas','ordens_servico','demanda_eventos','demanda_apoios','demanda_equipamentos')
UNION ALL
SELECT 'chamados por natureza',
       COALESCE((SELECT string_agg(natureza || '=' || n::text, ', ' ORDER BY natureza)
                 FROM (SELECT natureza, count(*) n FROM public.chamados GROUP BY 1) t),'(vazio)'),
       '(campo + interno; interno deve ter ~537)'
UNION ALL
SELECT 'todos renumerados como CH-', count(*)::text, '0'
FROM public.chamados WHERE numero NOT LIKE 'CH-%'
UNION ALL
SELECT 'numero antigo preservado', count(*)::text, '(igual ao total)'
FROM public.chamados WHERE numero_legado IS NOT NULL
UNION ALL
SELECT 'status fora do vocabulario novo', count(*)::text, '0'
FROM public.chamados WHERE status NOT IN
  ('aberto','agendado','em_andamento','stand_by','aguardando_aprovacao','executado','concluido','cancelado')
UNION ALL
SELECT 'satelites religados (fotos+eventos+checklist+pecas+analise+apoios+equip)', count(*)::text, '7'
FROM information_schema.columns WHERE table_schema='public' AND column_name='chamado_id'
  AND table_name IN ('chamado_fotos','chamado_eventos','chamado_checklist','chamado_pecas',
                     'chamado_pecas_analise','chamado_apoios','chamado_equipamentos')
UNION ALL
SELECT 'feed interno absorvido no historico', count(*)::text, '(> 0 se havia comentarios)'
FROM public.chamado_eventos WHERE tipo = 'comentario'
UNION ALL
SELECT 'notificacoes com ponteiro unico',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                         AND table_name='notificacoes' AND column_name='chamado_id')
        AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                        AND table_name='notificacoes' AND column_name IN ('os_id','demanda_id'))
       THEN 'sim' ELSE 'NAO' END, 'sim'
UNION ALL
SELECT 'cobrancas preservadas', count(*)::text, '(informativo — nao pode ter zerado)'
FROM public.cobrancas
UNION ALL
SELECT 'RPCs novas (aprovar, faturar, acesso)', count(*)::text, '3'
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN
  ('aprovar_chamado_financeiro','marcar_chamado_faturado','pode_acessar_chamado');
