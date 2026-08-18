-- ETAPA U1 da unificação — Demandas internas (substitui o Notion).
-- Referência: docs/PLANO_UNIFICACAO.md §4.1, §5.1, §6 e §10.
--
-- >>> RODAR NO SQL EDITOR DA LOVABLE (Cloud → SQL editor). Idempotente. <<<
-- >>> Rodar DEPOIS da U0 (20260818120000): usa normalizar_texto, a coluna  <<<
-- >>> profiles.equipe e agendar_job().                                     <<<
-- >>> Conferir o SELECT final: cada linha traz o valor esperado ao lado.   <<<
--
-- Demanda interna NÃO cabe em ordens_servico: lá cliente_id é obrigatório e o
-- ciclo pressupõe campo (SLA, fotos, assinatura). Aqui nasce a tabela irmã,
-- clonando os padrões já testados nas etapas 0–6 — numeração por contador,
-- regras no banco por trigger, feed/timeline em tabela de eventos e
-- notificações por trigger SECURITY DEFINER.
--
-- Cria:
--   demandas              — a demanda (título, equipe, responsável, sprint…)
--   demanda_apoios        — quem mais está junto (campo "Apoio" do Notion)
--   demanda_eventos       — feed de comentários + linha do tempo
--   demanda_equipamentos  — equipamentos envolvidos (lacuna apontada do Notion)
--   demanda_contadores    — numeração DEM-2026-0001
--   3 rotinas agendadas   — virada de sprint, alertas diários, resumo semanal

-- ═══════════════════════════════════════════════════════════════════════
-- 1) NUMERAÇÃO
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.demanda_contadores (
  ano integer PRIMARY KEY,
  ultimo integer NOT NULL DEFAULT 0
);
GRANT ALL ON public.demanda_contadores TO service_role;

CREATE OR REPLACE FUNCTION public.proximo_numero_demanda()
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ano int := EXTRACT(YEAR FROM now())::int;
  v_seq int;
BEGIN
  INSERT INTO public.demanda_contadores (ano, ultimo)
  VALUES (v_ano, 1)
  ON CONFLICT (ano) DO UPDATE SET ultimo = demanda_contadores.ultimo + 1
  RETURNING ultimo INTO v_seq;
  RETURN 'DEM-' || v_ano::text || '-' || lpad(v_seq::text, 4, '0');
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- 2) CLASSIFICAÇÃO SUGERIDA PELO TÍTULO (automação 1 do §6)
-- ═══════════════════════════════════════════════════════════════════════
-- Heurística determinística e barata, rodando no INSERT. A sugestão é sempre
-- editável — a ordem dos testes importa: sinal de falha vence sinal de rotina.
CREATE OR REPLACE FUNCTION public.sugerir_tipo_demanda(_titulo text, _descricao text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  t text := public.normalizar_texto(COALESCE(_titulo, '') || ' ' || COALESCE(_descricao, ''));
BEGIN
  IF t IS NULL THEN RETURN 'operacional'; END IF;
  IF t ~ '(nao funciona|nao esta funcionando|parou|caiu|travand|travou|quebrad|defeito|falha|falhou|erro|bug|corrig|conserto|reparo|urgente|sem sinal|sem acesso|offline)'
    THEN RETURN 'corretiva'; END IF;
  IF t ~ '(preventiv|revisao|inspec|limpeza|checagem|vistoria|rotina de manutencao|manutencao programada)'
    THEN RETURN 'preventiva'; END IF;
  IF t ~ '(implanta|instala|nova unidade|novo sistema|migra|migracao|deploy|homologa|ativacao|start)'
    THEN RETURN 'implantacao'; END IF;
  IF t ~ '(melhor|otimiz|aprimor|refator|upgrade|atualiz|padroniz|automatiz|redesenh|nova funcionalidade|criar tela)'
    THEN RETURN 'melhoria'; END IF;
  RETURN 'operacional';
END;
$$;
GRANT EXECUTE ON FUNCTION public.sugerir_tipo_demanda(text, text) TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════
-- 3) DEMANDAS
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.demandas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text UNIQUE,
  titulo text NOT NULL,
  descricao text,
  -- cliente é opcional: existe demanda puramente interna
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  equipe text NOT NULL DEFAULT 'ti',
  -- nulo = sem responsável, estado legítimo de triagem (a automação 4 cobra)
  responsavel_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- prazo é do responsável, não do gestor (regra do Notion): data simples
  prazo date,
  sprint text NOT NULL DEFAULT 'este_mes',
  tipo text,
  status text NOT NULL DEFAULT 'nao_iniciada',
  iniciada_em timestamptz,
  concluida_em timestamptz,
  criada_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- rastro da importação do Notion (não reusar id: são bancos diferentes)
  origem text NOT NULL DEFAULT 'app',
  origem_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE public.demandas ADD CONSTRAINT demandas_equipe_check
    CHECK (equipe IN ('ti','patrimonio','audiovisual','business_ops','tecnica','comercial'));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN
  RAISE NOTICE 'equipe fora da lista — constraint nao criada';
END $$;

DO $$
BEGIN
  ALTER TABLE public.demandas ADD CONSTRAINT demandas_sprint_check
    CHECK (sprint IN ('este_mes','mes_que_vem','mes_passado','backlog'));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN
  RAISE NOTICE 'sprint fora da lista — constraint nao criada';
END $$;

DO $$
BEGIN
  ALTER TABLE public.demandas ADD CONSTRAINT demandas_tipo_check
    CHECK (tipo IS NULL OR tipo IN ('melhoria','implantacao','corretiva','preventiva','operacional'));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN
  RAISE NOTICE 'tipo fora da lista — constraint nao criada';
END $$;

-- stand_by existe aqui e NÃO no ciclo de OS: no campo o relógio de SLA não
-- sabe pausar (ver PLANO_UNIFICACAO §3.3 e SISTEMA_OS §4.4).
DO $$
BEGIN
  ALTER TABLE public.demandas ADD CONSTRAINT demandas_status_check
    CHECK (status IN ('nao_iniciada','em_andamento','stand_by','aguardando_aprovacao','concluida','cancelada'));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN
  RAISE NOTICE 'status fora da lista — constraint nao criada';
END $$;

DO $$
BEGIN
  ALTER TABLE public.demandas ADD CONSTRAINT demandas_origem_check
    CHECK (origem IN ('app','notion','gestor_os'));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN
  RAISE NOTICE 'origem fora da lista — constraint nao criada';
END $$;

CREATE INDEX IF NOT EXISTS demandas_equipe_idx      ON public.demandas (equipe, sprint);
CREATE INDEX IF NOT EXISTS demandas_responsavel_idx ON public.demandas (responsavel_id);
CREATE INDEX IF NOT EXISTS demandas_status_idx      ON public.demandas (status);
CREATE INDEX IF NOT EXISTS demandas_prazo_idx       ON public.demandas (prazo);
CREATE INDEX IF NOT EXISTS demandas_cliente_idx     ON public.demandas (cliente_id);
-- Reimportar o mesmo item do Notion não pode duplicar.
-- SEM predicado parcial de propósito: o ON CONFLICT da tela de importação não
-- consegue inferir um índice parcial (o PostgREST não manda o WHERE junto) e
-- falharia com "no unique or exclusion constraint matching". Índice cheio
-- resolve e não atrapalha: NULLs são distintos entre si, então as demandas
-- criadas no app (origem_id nulo) continuam podendo repetir à vontade.
CREATE UNIQUE INDEX IF NOT EXISTS demandas_origem_unico
  ON public.demandas (origem, origem_id);

DROP TRIGGER IF EXISTS demandas_set_updated_at ON public.demandas;
CREATE TRIGGER demandas_set_updated_at
  BEFORE UPDATE ON public.demandas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Número, classificação sugerida e carimbos de início/conclusão: regra do
-- banco, como a numeração e o SLA da OS.
CREATE OR REPLACE FUNCTION public.demanda_preencher()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.numero IS NULL OR NEW.numero = '' THEN
      NEW.numero := public.proximo_numero_demanda();
    END IF;
    IF NEW.tipo IS NULL THEN
      NEW.tipo := public.sugerir_tipo_demanda(NEW.titulo, NEW.descricao);
    END IF;
    IF NEW.status = 'em_andamento' AND NEW.iniciada_em IS NULL THEN
      NEW.iniciada_em := now();
    END IF;
    IF NEW.status = 'concluida' AND NEW.concluida_em IS NULL THEN
      NEW.concluida_em := now();
    END IF;
    RETURN NEW;
  END IF;

  -- automação do Notion: data/hora de conclusão preenchida sozinha
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'em_andamento' AND NEW.iniciada_em IS NULL THEN
      NEW.iniciada_em := now();
    END IF;
    IF NEW.status = 'concluida' THEN
      NEW.concluida_em := COALESCE(NEW.concluida_em, now());
    ELSIF OLD.status = 'concluida' THEN
      -- reabriu: o carimbo de conclusão deixa de valer
      NEW.concluida_em := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_demanda_preencher_ins ON public.demandas;
CREATE TRIGGER trg_demanda_preencher_ins
  BEFORE INSERT ON public.demandas
  FOR EACH ROW EXECUTE FUNCTION public.demanda_preencher();

DROP TRIGGER IF EXISTS trg_demanda_preencher_upd ON public.demandas;
CREATE TRIGGER trg_demanda_preencher_upd
  BEFORE UPDATE OF status ON public.demandas
  FOR EACH ROW EXECUTE FUNCTION public.demanda_preencher();

-- ═══════════════════════════════════════════════════════════════════════
-- 4) APOIO, FEED E EQUIPAMENTOS ENVOLVIDOS
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.demanda_apoios (
  demanda_id uuid NOT NULL REFERENCES public.demandas(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (demanda_id, profile_id)
);
CREATE INDEX IF NOT EXISTS demanda_apoios_profile_idx ON public.demanda_apoios (profile_id);

-- Feed de comentários E linha do tempo na mesma tabela, exatamente como
-- os_eventos: tipo é texto livre, 'comentario' é o post do usuário.
CREATE TABLE IF NOT EXISTS public.demanda_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demanda_id uuid NOT NULL REFERENCES public.demandas(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  descricao text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS demanda_eventos_idx ON public.demanda_eventos (demanda_id, created_at DESC);

-- A lacuna que o Notion tinha: qual equipamento está envolvido na demanda.
-- Aponta para o inventário do cliente quando existe, ou fica em texto livre.
CREATE TABLE IF NOT EXISTS public.demanda_equipamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demanda_id uuid NOT NULL REFERENCES public.demandas(id) ON DELETE CASCADE,
  cliente_equipamento_id uuid REFERENCES public.cliente_equipamentos(id) ON DELETE SET NULL,
  equipamento_id uuid REFERENCES public.equipamentos(id) ON DELETE SET NULL,
  descricao text,
  numero_serie text,
  tag_patrimonio text,
  quantidade numeric NOT NULL DEFAULT 1,
  observacao text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS demanda_equipamentos_idx ON public.demanda_equipamentos (demanda_id);
CREATE INDEX IF NOT EXISTS demanda_equipamentos_serie_idx
  ON public.demanda_equipamentos (public.normalizar_texto(numero_serie));

-- Linha do tempo automática (molde os_registrar_evento).
CREATE OR REPLACE FUNCTION public.demanda_registrar_evento()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.demanda_eventos (demanda_id, tipo, descricao, user_id)
    VALUES (NEW.id, 'criada', 'Demanda registrada', NEW.criada_por);
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.demanda_eventos (demanda_id, tipo, descricao, user_id)
    VALUES (NEW.id, 'status', 'Status: ' || OLD.status || ' → ' || NEW.status, auth.uid());
  END IF;
  IF NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id THEN
    INSERT INTO public.demanda_eventos (demanda_id, tipo, descricao, user_id)
    VALUES (NEW.id, 'atribuida',
            CASE WHEN NEW.responsavel_id IS NULL THEN 'Responsável removido'
                 ELSE 'Responsável definido' END, auth.uid());
  END IF;
  IF NEW.sprint IS DISTINCT FROM OLD.sprint THEN
    INSERT INTO public.demanda_eventos (demanda_id, tipo, descricao, user_id)
    VALUES (NEW.id, 'sprint', 'Sprint: ' || OLD.sprint || ' → ' || NEW.sprint, auth.uid());
  END IF;
  IF NEW.prazo IS DISTINCT FROM OLD.prazo THEN
    INSERT INTO public.demanda_eventos (demanda_id, tipo, descricao, user_id)
    VALUES (NEW.id, 'prazo',
            CASE WHEN NEW.prazo IS NULL THEN 'Prazo removido'
                 ELSE 'Prazo definido para ' || to_char(NEW.prazo, 'DD/MM/YYYY') END, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_demanda_evento_ins ON public.demandas;
CREATE TRIGGER trg_demanda_evento_ins
  AFTER INSERT ON public.demandas
  FOR EACH ROW EXECUTE FUNCTION public.demanda_registrar_evento();

DROP TRIGGER IF EXISTS trg_demanda_evento_upd ON public.demandas;
CREATE TRIGGER trg_demanda_evento_upd
  AFTER UPDATE OF status, responsavel_id, sprint, prazo ON public.demandas
  FOR EACH ROW EXECUTE FUNCTION public.demanda_registrar_evento();

-- ═══════════════════════════════════════════════════════════════════════
-- 5) NOTIFICAÇÕES (trigger SECURITY DEFINER — regra da Etapa 0)
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE public.notificacoes
  ADD COLUMN IF NOT EXISTS demanda_id uuid REFERENCES public.demandas(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.notify_demanda()
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

  -- quem recebe a demanda precisa saber (menos quando ele mesmo se atribuiu)
  IF v_novo_resp AND NEW.responsavel_id IS DISTINCT FROM auth.uid() THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, demanda_id)
    VALUES (NEW.responsavel_id, 'demanda_atribuida', 'Nova demanda para você', v_resumo, NEW.id);
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    -- concluída: avisa quem pediu
    IF NEW.status = 'concluida' AND NEW.criada_por IS NOT NULL
       AND NEW.criada_por IS DISTINCT FROM auth.uid() THEN
      INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, demanda_id)
      VALUES (NEW.criada_por, 'demanda_concluida', 'Demanda concluída', v_resumo, NEW.id);
    -- aguardando aprovação: avisa os gestores
    ELSIF NEW.status = 'aguardando_aprovacao' THEN
      INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, demanda_id)
      SELECT p.id, 'demanda_aprovacao', 'Demanda aguardando aprovação', v_resumo, NEW.id
      FROM public.profiles p
      WHERE p.cargo IN ('admin','comercial')
        AND p.ativo IS DISTINCT FROM false
        AND p.status IS DISTINCT FROM 'rejeitado'
        AND p.status IS DISTINCT FROM 'pendente_aprovacao'
        AND p.id IS DISTINCT FROM auth.uid();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_demanda_ins ON public.demandas;
CREATE TRIGGER trg_notify_demanda_ins
  AFTER INSERT ON public.demandas
  FOR EACH ROW EXECUTE FUNCTION public.notify_demanda();

DROP TRIGGER IF EXISTS trg_notify_demanda_upd ON public.demandas;
CREATE TRIGGER trg_notify_demanda_upd
  AFTER UPDATE OF status, responsavel_id ON public.demandas
  FOR EACH ROW EXECUTE FUNCTION public.notify_demanda();

-- Comentário no feed avisa os envolvidos — é o que fazia o Notion.
CREATE OR REPLACE FUNCTION public.notify_demanda_comentario()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  d record;
BEGIN
  IF NEW.tipo <> 'comentario' THEN RETURN NEW; END IF;
  SELECT numero, titulo, responsavel_id, criada_por INTO d
  FROM public.demandas WHERE id = NEW.demanda_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, demanda_id)
  SELECT DISTINCT alvo, 'demanda_comentario', 'Novo comentário',
         d.numero || ' · ' || d.titulo, NEW.demanda_id
  FROM (
    SELECT d.responsavel_id AS alvo
    UNION SELECT d.criada_por
    UNION SELECT a.profile_id FROM public.demanda_apoios a WHERE a.demanda_id = NEW.demanda_id
  ) envolvidos
  WHERE alvo IS NOT NULL
    AND alvo IS DISTINCT FROM NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_demanda_comentario ON public.demanda_eventos;
CREATE TRIGGER trg_notify_demanda_comentario
  AFTER INSERT ON public.demanda_eventos
  FOR EACH ROW EXECUTE FUNCTION public.notify_demanda_comentario();

-- Entrar como apoio também avisa.
CREATE OR REPLACE FUNCTION public.notify_demanda_apoio()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  d record;
BEGIN
  IF NEW.profile_id IS NOT DISTINCT FROM auth.uid() THEN RETURN NEW; END IF;
  SELECT numero, titulo INTO d FROM public.demandas WHERE id = NEW.demanda_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, demanda_id)
  VALUES (NEW.profile_id, 'demanda_apoio', 'Você entrou como apoio',
          d.numero || ' · ' || d.titulo, NEW.demanda_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_demanda_apoio ON public.demanda_apoios;
CREATE TRIGGER trg_notify_demanda_apoio
  AFTER INSERT ON public.demanda_apoios
  FOR EACH ROW EXECUTE FUNCTION public.notify_demanda_apoio();

-- realtime, no padrão de ordens_servico
ALTER TABLE public.demandas REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.demandas;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 6) RLS
-- ═══════════════════════════════════════════════════════════════════════
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demandas             TO authenticated;
GRANT SELECT, INSERT, DELETE         ON public.demanda_apoios       TO authenticated;
GRANT SELECT, INSERT                 ON public.demanda_eventos      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demanda_equipamentos TO authenticated;
GRANT ALL ON public.demandas, public.demanda_apoios,
             public.demanda_eventos, public.demanda_equipamentos TO service_role;

ALTER TABLE public.demandas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demanda_apoios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demanda_eventos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demanda_equipamentos ENABLE ROW LEVEL SECURITY;

-- "posso mexer nesta demanda?" — responsável, quem abriu, apoio ou gestor.
-- A leitura é aberta ao time (era assim no Notion e o quadro depende disso).
CREATE OR REPLACE FUNCTION public.pode_editar_demanda(_demanda_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    public.is_gestor(auth.uid())
    OR EXISTS (SELECT 1 FROM public.demandas d
               WHERE d.id = _demanda_id
                 AND (d.responsavel_id = auth.uid()
                      OR d.criada_por = auth.uid()
                      -- demanda sem dono pode ser assumida por quem quiser:
                      -- travar isso no gestor deixaria a triagem parada
                      OR d.responsavel_id IS NULL))
    OR EXISTS (SELECT 1 FROM public.demanda_apoios a
               WHERE a.demanda_id = _demanda_id AND a.profile_id = auth.uid()),
    false
  );
$$;
REVOKE EXECUTE ON FUNCTION public.pode_editar_demanda(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_editar_demanda(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "demandas_select" ON public.demandas;
DROP POLICY IF EXISTS "demandas_insert" ON public.demandas;
DROP POLICY IF EXISTS "demandas_update" ON public.demandas;
DROP POLICY IF EXISTS "demandas_delete" ON public.demandas;
CREATE POLICY "demandas_select" ON public.demandas
  FOR SELECT TO authenticated USING (true);
-- qualquer um do time registra uma demanda, mas sempre em nome próprio
CREATE POLICY "demandas_insert" ON public.demandas
  FOR INSERT TO authenticated WITH CHECK (criada_por = auth.uid());
CREATE POLICY "demandas_update" ON public.demandas
  FOR UPDATE TO authenticated
  USING (public.pode_editar_demanda(id))
  WITH CHECK (public.pode_editar_demanda(id));
CREATE POLICY "demandas_delete" ON public.demandas
  FOR DELETE TO authenticated USING (public.is_gestor(auth.uid()));

DROP POLICY IF EXISTS "demanda_apoios_select" ON public.demanda_apoios;
DROP POLICY IF EXISTS "demanda_apoios_insert" ON public.demanda_apoios;
DROP POLICY IF EXISTS "demanda_apoios_delete" ON public.demanda_apoios;
CREATE POLICY "demanda_apoios_select" ON public.demanda_apoios
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "demanda_apoios_insert" ON public.demanda_apoios
  FOR INSERT TO authenticated
  WITH CHECK (public.pode_editar_demanda(demanda_id) OR profile_id = auth.uid());
CREATE POLICY "demanda_apoios_delete" ON public.demanda_apoios
  FOR DELETE TO authenticated
  USING (public.pode_editar_demanda(demanda_id) OR profile_id = auth.uid());

DROP POLICY IF EXISTS "demanda_eventos_select" ON public.demanda_eventos;
DROP POLICY IF EXISTS "demanda_eventos_insert" ON public.demanda_eventos;
CREATE POLICY "demanda_eventos_select" ON public.demanda_eventos
  FOR SELECT TO authenticated USING (true);
-- comentar é de todo mundo; o autor não pode ser forjado
CREATE POLICY "demanda_eventos_insert" ON public.demanda_eventos
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND tipo = 'comentario');

DROP POLICY IF EXISTS "demanda_equipamentos_select" ON public.demanda_equipamentos;
DROP POLICY IF EXISTS "demanda_equipamentos_write"  ON public.demanda_equipamentos;
CREATE POLICY "demanda_equipamentos_select" ON public.demanda_equipamentos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "demanda_equipamentos_write" ON public.demanda_equipamentos
  FOR ALL TO authenticated
  USING (public.pode_editar_demanda(demanda_id))
  WITH CHECK (public.pode_editar_demanda(demanda_id));

-- ═══════════════════════════════════════════════════════════════════════
-- 7) ROTINAS AGENDADAS (§6 — automações 2, 3, 4 e 8)
-- ═══════════════════════════════════════════════════════════════════════

-- 7a) VIRADA DE SPRINT — dia 1º, 00:01 de Brasília.
CREATE OR REPLACE FUNCTION public.virada_sprint()
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_passado int;
  v_atual int;
  v_lotado int;
BEGIN
  -- ordem importa: "este mês" precisa sair antes de "mês que vem" entrar
  UPDATE public.demandas SET sprint = 'mes_passado'
  WHERE sprint = 'este_mes' AND status <> 'concluida';
  GET DIAGNOSTICS v_passado = ROW_COUNT;

  -- concluídas não viram pendência do mês passado: saem do quadro ativo
  UPDATE public.demandas SET sprint = 'mes_passado'
  WHERE sprint = 'este_mes' AND status = 'concluida';

  UPDATE public.demandas SET sprint = 'este_mes' WHERE sprint = 'mes_que_vem';
  GET DIAGNOSTICS v_atual = ROW_COUNT;

  -- automação 8: sprint lotado — avisa os gestores para a reunião do mês
  SELECT count(*) INTO v_lotado
  FROM public.demandas
  WHERE sprint = 'este_mes' AND status NOT IN ('concluida','cancelada');

  IF v_lotado > 0 THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo)
    SELECT p.id, 'sprint_virada', 'Sprint do mês virou',
           v_lotado::text || ' demanda(s) em "Este mês" — '
           || v_passado::text || ' vieram pendentes do mês anterior.'
    FROM public.profiles p
    WHERE p.cargo IN ('admin','comercial')
      AND p.ativo IS DISTINCT FROM false
      AND p.status IS DISTINCT FROM 'rejeitado'
      AND p.status IS DISTINCT FROM 'pendente_aprovacao';
  END IF;

  RETURN 'pendentes->mes_passado: ' || v_passado || ' | mes_que_vem->este_mes: ' || v_atual
      || ' | ativas no mes: ' || v_lotado;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.virada_sprint() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.virada_sprint() TO service_role;

-- 7b) ALERTAS DIÁRIOS — prazo vencendo/vencido e demanda parada.
-- Dedupe por janela de 20h: a rotina é diária, e repetir o mesmo aviso todo dia
-- transforma notificação em ruído que ninguém lê.
CREATE OR REPLACE FUNCTION public.alertas_demandas(_dias_parada int DEFAULT 7)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_vence int := 0;
  v_venceu int := 0;
  v_parada int := 0;
BEGIN
  -- vence amanhã
  INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, demanda_id)
  SELECT d.responsavel_id, 'demanda_prazo', 'Prazo vence amanhã',
         d.numero || ' · ' || d.titulo, d.id
  FROM public.demandas d
  WHERE d.responsavel_id IS NOT NULL
    AND d.status NOT IN ('concluida','cancelada')
    AND d.prazo = (now() AT TIME ZONE 'America/Sao_Paulo')::date + 1
    AND NOT EXISTS (
      SELECT 1 FROM public.notificacoes n
      WHERE n.demanda_id = d.id AND n.tipo = 'demanda_prazo'
        AND n.created_at > now() - interval '20 hours');
  GET DIAGNOSTICS v_vence = ROW_COUNT;

  -- venceu: o gestor entra junto, porque a partir daqui é combinação, não aviso
  INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, demanda_id)
  SELECT alvo, 'demanda_atrasada', 'Demanda atrasada',
         d.numero || ' · ' || d.titulo, d.id
  FROM public.demandas d
  CROSS JOIN LATERAL (
    SELECT d.responsavel_id AS alvo
    UNION
    SELECT p.id FROM public.profiles p
    WHERE p.cargo IN ('admin','comercial')
      AND p.ativo IS DISTINCT FROM false
      AND p.status IS DISTINCT FROM 'rejeitado'
      AND p.status IS DISTINCT FROM 'pendente_aprovacao'
  ) alvos
  WHERE alvo IS NOT NULL
    AND d.status NOT IN ('concluida','cancelada')
    AND d.prazo < (now() AT TIME ZONE 'America/Sao_Paulo')::date
    AND NOT EXISTS (
      SELECT 1 FROM public.notificacoes n
      WHERE n.demanda_id = d.id AND n.tipo = 'demanda_atrasada'
        AND n.user_id = alvo
        AND n.created_at > now() - interval '20 hours');
  GET DIAGNOSTICS v_venceu = ROW_COUNT;

  -- parada: em andamento ou stand-by sem nenhum movimento há N dias
  INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, demanda_id)
  SELECT d.responsavel_id, 'demanda_parada', 'Demanda parada',
         d.numero || ' · ' || d.titulo || ' — sem atualização há '
         || EXTRACT(DAY FROM now() - d.updated_at)::int::text || ' dias.', d.id
  FROM public.demandas d
  WHERE d.responsavel_id IS NOT NULL
    AND d.status IN ('em_andamento','stand_by')
    AND d.updated_at < now() - make_interval(days => _dias_parada)
    AND NOT EXISTS (
      SELECT 1 FROM public.notificacoes n
      WHERE n.demanda_id = d.id AND n.tipo = 'demanda_parada'
        AND n.created_at > now() - interval '6 days');
  GET DIAGNOSTICS v_parada = ROW_COUNT;

  RETURN 'vence amanha: ' || v_vence || ' | atrasadas: ' || v_venceu || ' | paradas: ' || v_parada;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.alertas_demandas(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.alertas_demandas(int) TO service_role;

-- 7c) RESUMO DE SEGUNDA — uma notificação por pessoa, com o panorama da semana.
CREATE OR REPLACE FUNCTION public.resumo_semanal_demandas()
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_envios int := 0;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo)
  SELECT r.responsavel_id, 'resumo_semana', 'Sua semana',
         r.abertas::text || ' demanda(s) em aberto · '
         || r.semana::text || ' com prazo nesta semana · '
         || r.atrasadas::text || ' atrasada(s)'
  FROM (
    SELECT d.responsavel_id,
           count(*) FILTER (WHERE d.status NOT IN ('concluida','cancelada')) AS abertas,
           count(*) FILTER (WHERE d.status NOT IN ('concluida','cancelada')
                              AND d.prazo BETWEEN v_hoje AND v_hoje + 6)     AS semana,
           count(*) FILTER (WHERE d.status NOT IN ('concluida','cancelada')
                              AND d.prazo < v_hoje)                          AS atrasadas
    FROM public.demandas d
    WHERE d.responsavel_id IS NOT NULL
    GROUP BY d.responsavel_id
  ) r
  WHERE r.abertas > 0;
  GET DIAGNOSTICS v_envios = ROW_COUNT;

  -- demandas sem responsável são problema de quem coordena
  INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo)
  SELECT p.id, 'resumo_semana', 'Demandas sem responsável',
         (SELECT count(*) FROM public.demandas
           WHERE responsavel_id IS NULL AND status NOT IN ('concluida','cancelada'))::text
         || ' demanda(s) aguardando alguém assumir.'
  FROM public.profiles p
  WHERE p.cargo IN ('admin','comercial')
    AND p.ativo IS DISTINCT FROM false
    AND p.status IS DISTINCT FROM 'rejeitado'
    AND p.status IS DISTINCT FROM 'pendente_aprovacao'
    AND EXISTS (SELECT 1 FROM public.demandas
                 WHERE responsavel_id IS NULL AND status NOT IN ('concluida','cancelada'));

  RETURN 'resumos enviados: ' || v_envios;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.resumo_semanal_demandas() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resumo_semanal_demandas() TO service_role;

-- 7d) AGENDAMENTO — versionado aqui, não no dashboard (U0 §7).
--     pg_cron roda em UTC: Brasília (UTC-3) exige somar 3 horas.
--       00:01 do dia 1º  → '1 3 1 * *'
--       07:00 diário     → '0 10 * * *'
--       08:00 de segunda → '0 11 * * 1'
DO $$
DECLARE r1 text; r2 text; r3 text;
BEGIN
  r1 := public.agendar_job('virada-sprint',   '1 3 1 * *',  'SELECT public.virada_sprint();');
  r2 := public.agendar_job('alertas-demandas','0 10 * * *', 'SELECT public.alertas_demandas();');
  r3 := public.agendar_job('resumo-semana',   '0 11 * * 1', 'SELECT public.resumo_semanal_demandas();');
  RAISE NOTICE '% / % / %', r1, r2, r3;
EXCEPTION WHEN OTHERS THEN
  -- agendamento é acessório: pg_cron desabilitado ou sem permissão não pode
  -- derrubar a criação do módulo. O SELECT final mostra o que ficou agendado.
  RAISE NOTICE 'agendamento nao aplicado: %', SQLERRM;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO FINAL
-- ═══════════════════════════════════════════════════════════════════════
SELECT 'tabelas criadas (demandas, apoios, eventos, equipamentos, contadores)' AS verificacao,
       count(*)::text AS resultado, '5' AS esperado
FROM information_schema.tables
WHERE table_schema='public' AND table_name IN
  ('demandas','demanda_apoios','demanda_eventos','demanda_equipamentos','demanda_contadores')
UNION ALL
SELECT 'constraints de dominio (equipe, sprint, tipo, status, origem)', count(*)::text, '5'
FROM pg_constraint
WHERE conname IN ('demandas_equipe_check','demandas_sprint_check','demandas_tipo_check',
                  'demandas_status_check','demandas_origem_check')
UNION ALL
SELECT 'triggers de demandas (preencher x2, evento x2, notify x2, updated_at)', count(*)::text, '7'
FROM pg_trigger
WHERE NOT tgisinternal AND tgrelid = 'public.demandas'::regclass
UNION ALL
SELECT 'triggers de feed e apoio', count(*)::text, '2'
FROM pg_trigger
WHERE NOT tgisinternal
  AND tgname IN ('trg_notify_demanda_comentario','trg_notify_demanda_apoio')
UNION ALL
SELECT 'policies criadas (demandas 4 + apoios 3 + eventos 2 + equipamentos 2)', count(*)::text, '11'
FROM pg_policies
WHERE schemaname='public' AND tablename IN
  ('demandas','demanda_apoios','demanda_eventos','demanda_equipamentos')
UNION ALL
SELECT 'coluna demanda_id em notificacoes',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
         WHERE table_schema='public' AND table_name='notificacoes' AND column_name='demanda_id')
       THEN 'sim' ELSE 'NAO' END, 'sim'
UNION ALL
SELECT 'demandas no realtime',
       CASE WHEN EXISTS (SELECT 1 FROM pg_publication_tables
         WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='demandas')
       THEN 'sim' ELSE 'NAO' END, 'sim'
UNION ALL
SELECT 'rotinas instaladas (virada, alertas, resumo, numero, sugestao, pode_editar)',
       count(*)::text, '6'
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname='public' AND p.proname IN
  ('virada_sprint','alertas_demandas','resumo_semanal_demandas',
   'proximo_numero_demanda','sugerir_tipo_demanda','pode_editar_demanda')
UNION ALL
SELECT 'classificacao sugerida — "Portao nao funciona"',
       public.sugerir_tipo_demanda('Portão não funciona'), 'corretiva'
UNION ALL
SELECT 'classificacao sugerida — "Revisao preventiva do CFTV"',
       public.sugerir_tipo_demanda('Revisão preventiva do CFTV'), 'preventiva'
UNION ALL
SELECT 'classificacao sugerida — "Implantacao do sistema no Bloco B"',
       public.sugerir_tipo_demanda('Implantação do sistema no Bloco B'), 'implantacao'
UNION ALL
SELECT 'classificacao sugerida — "Melhorar o relatorio de fechamento"',
       public.sugerir_tipo_demanda('Melhorar o relatório de fechamento'), 'melhoria'
UNION ALL
SELECT 'classificacao sugerida — "Conferencia de notas"',
       public.sugerir_tipo_demanda('Conferência de notas'), 'operacional'
UNION ALL
SELECT 'jobs agendados', public.jobs_agendados(),
       'virada-sprint, alertas-demandas e resumo-semana na lista';
