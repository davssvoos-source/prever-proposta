-- ETAPA 3 do sistema de Ordens de Serviço — Chamados ponta a ponta.
-- Referência: docs/SISTEMA_OS.md §4.3, §4.4 e §5.
--
-- >>> RODAR NO SQL EDITOR DA LOVABLE (Cloud → SQL editor). Idempotente. <<<
-- >>> Conferir o SELECT final: cada linha traz o valor esperado ao lado. <<<
--
-- Cria:
--   ordens_servico   — a OS (corretiva, preventiva ou implantação)
--   os_sla           — prazo de atendimento por prioridade (editável por vocês)
--   os_contadores    — numeração sequencial por ano (OS-2026-0001)
--   os_fotos         — registro fotográfico antes/depois
--   os_eventos       — linha do tempo/auditoria da OS
--   bucket fotos-os  — privado, para fotos e assinatura
--
-- Domínios em text + CHECK (e não enum) por coerência com o resto do schema
-- (clientes.situacao, cliente_sistemas.tipo) e para permitir evoluir a lista
-- sem ALTER TYPE.

-- ═══════════════════════════════════════════════════════════════════════
-- 1) SLA e NUMERAÇÃO
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.os_sla (
  prioridade text PRIMARY KEY,
  horas_prazo integer,             -- NULL = sem prazo (agendável livremente)
  descricao text
);

-- Valores iniciais propostos — ajuste à vontade, é tabela de configuração:
--   UPDATE public.os_sla SET horas_prazo = 6 WHERE prioridade = 'urgente';
INSERT INTO public.os_sla (prioridade, horas_prazo, descricao) VALUES
  ('urgente', 4,    'Sistema parado — portão, acesso ou central fora de operação'),
  ('alta',    24,   'Falha que degrada a operação, com contorno possível'),
  ('normal',  72,   'Atendimento comum'),
  ('baixa',   NULL, 'Melhoria ou ajuste sem impacto — agendar livremente')
ON CONFLICT (prioridade) DO NOTHING;

GRANT SELECT ON public.os_sla TO authenticated;
GRANT ALL ON public.os_sla TO service_role;
ALTER TABLE public.os_sla ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "os_sla_select" ON public.os_sla;
CREATE POLICY "os_sla_select" ON public.os_sla FOR SELECT TO authenticated USING (true);

-- Numeração: OS-<ano>-<sequência de 4 dígitos>, reiniciando a cada ano.
CREATE TABLE IF NOT EXISTS public.os_contadores (
  ano integer PRIMARY KEY,
  ultimo integer NOT NULL DEFAULT 0
);
GRANT ALL ON public.os_contadores TO service_role;

CREATE OR REPLACE FUNCTION public.proximo_numero_os()
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ano int := EXTRACT(YEAR FROM now())::int;
  v_seq int;
BEGIN
  -- referência sem schema é a forma canônica dentro de ON CONFLICT DO UPDATE;
  -- o RETURNING devolve a linha já incrementada, então dois chamados
  -- simultâneos nunca recebem o mesmo número
  INSERT INTO public.os_contadores (ano, ultimo)
  VALUES (v_ano, 1)
  ON CONFLICT (ano) DO UPDATE SET ultimo = os_contadores.ultimo + 1
  RETURNING ultimo INTO v_seq;
  RETURN 'OS-' || v_ano::text || '-' || lpad(v_seq::text, 4, '0');
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- 2) ORDENS DE SERVIÇO
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.ordens_servico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text UNIQUE,
  tipo text NOT NULL DEFAULT 'corretiva',
  -- RESTRICT: não se apaga um cliente que tem histórico de atendimento
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  cliente_sistema_id uuid REFERENCES public.cliente_sistemas(id) ON DELETE SET NULL,
  -- origem, quando a OS nasce de uma proposta aprovada (implantação)
  visita_id uuid REFERENCES public.visitas_tecnicas(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  descricao_problema text,
  prioridade text NOT NULL DEFAULT 'normal',
  prazo_limite timestamptz,
  status text NOT NULL DEFAULT 'aberta',
  tecnico_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  data_hora_agendada timestamptz,
  iniciada_em timestamptz,
  finalizada_em timestamptz,
  -- execução
  diagnostico text,
  servico_executado text,
  pecas_texto text,               -- peças em texto: o estoque vive no ERP
  assinatura_nome text,
  assinatura_url text,
  -- controle
  aberto_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  fechado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  fechada_em timestamptz,
  motivo_cancelamento text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE public.ordens_servico ADD CONSTRAINT ordens_servico_tipo_check
    CHECK (tipo IN ('corretiva','preventiva','implantacao'));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN
  RAISE NOTICE 'tipo fora da lista — constraint nao criada';
END $$;

DO $$
BEGIN
  ALTER TABLE public.ordens_servico ADD CONSTRAINT ordens_servico_prioridade_check
    CHECK (prioridade IN ('baixa','normal','alta','urgente'));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN
  RAISE NOTICE 'prioridade fora da lista — constraint nao criada';
END $$;

DO $$
BEGIN
  ALTER TABLE public.ordens_servico ADD CONSTRAINT ordens_servico_status_check
    CHECK (status IN ('aberta','agendada','em_atendimento','executada','fechada','cancelada'));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN
  RAISE NOTICE 'status fora da lista — constraint nao criada';
END $$;

CREATE INDEX IF NOT EXISTS os_cliente_idx  ON public.ordens_servico (cliente_id);
CREATE INDEX IF NOT EXISTS os_tecnico_idx  ON public.ordens_servico (tecnico_id);
CREATE INDEX IF NOT EXISTS os_status_idx   ON public.ordens_servico (status);
CREATE INDEX IF NOT EXISTS os_agenda_idx   ON public.ordens_servico (data_hora_agendada);
CREATE INDEX IF NOT EXISTS os_prazo_idx    ON public.ordens_servico (prazo_limite);

DROP TRIGGER IF EXISTS ordens_servico_set_updated_at ON public.ordens_servico;
CREATE TRIGGER ordens_servico_set_updated_at
  BEFORE UPDATE ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Número e prazo preenchidos pelo banco: o app não precisa saber a regra e
-- não há risco de duas OS com o mesmo número.
CREATE OR REPLACE FUNCTION public.os_preencher_numero_e_prazo()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_horas int;
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := public.proximo_numero_os();
  END IF;
  IF NEW.prazo_limite IS NULL THEN
    SELECT horas_prazo INTO v_horas FROM public.os_sla WHERE prioridade = NEW.prioridade;
    IF v_horas IS NOT NULL THEN
      NEW.prazo_limite := COALESCE(NEW.created_at, now()) + make_interval(hours => v_horas);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_os_numero_prazo ON public.ordens_servico;
CREATE TRIGGER trg_os_numero_prazo
  BEFORE INSERT ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.os_preencher_numero_e_prazo();

-- ═══════════════════════════════════════════════════════════════════════
-- 3) FOTOS e LINHA DO TEMPO
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.os_fotos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  etapa text NOT NULL DEFAULT 'outra',
  url text NOT NULL,
  storage_path text,
  legenda text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE public.os_fotos ADD CONSTRAINT os_fotos_etapa_check
    CHECK (etapa IN ('antes','depois','outra'));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN
  RAISE NOTICE 'etapa fora da lista — constraint nao criada';
END $$;

CREATE INDEX IF NOT EXISTS os_fotos_os_idx ON public.os_fotos (os_id);

CREATE TABLE IF NOT EXISTS public.os_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  descricao text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS os_eventos_os_idx ON public.os_eventos (os_id, created_at DESC);

-- Toda mudança de status entra na linha do tempo sozinha.
CREATE OR REPLACE FUNCTION public.os_registrar_evento()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.os_eventos (os_id, tipo, descricao, user_id)
    VALUES (NEW.id, 'aberta', 'Chamado aberto como ' || NEW.status, NEW.aberto_por);
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.os_eventos (os_id, tipo, descricao, user_id)
    VALUES (NEW.id, NEW.status, 'Status: ' || OLD.status || ' → ' || NEW.status, auth.uid());
  END IF;
  IF NEW.tecnico_id IS DISTINCT FROM OLD.tecnico_id AND NEW.tecnico_id IS NOT NULL THEN
    INSERT INTO public.os_eventos (os_id, tipo, descricao, user_id)
    VALUES (NEW.id, 'atribuida', 'Técnico responsável definido', auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_os_evento_ins ON public.ordens_servico;
CREATE TRIGGER trg_os_evento_ins
  AFTER INSERT ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.os_registrar_evento();

DROP TRIGGER IF EXISTS trg_os_evento_upd ON public.ordens_servico;
CREATE TRIGGER trg_os_evento_upd
  AFTER UPDATE OF status, tecnico_id ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.os_registrar_evento();

-- ═══════════════════════════════════════════════════════════════════════
-- 4) NOTIFICAÇÕES (mesmo padrão da Etapa 0: trigger SECURITY DEFINER)
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE public.notificacoes
  ADD COLUMN IF NOT EXISTS os_id uuid REFERENCES public.ordens_servico(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.notify_os()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cliente text;
  v_novo text;
  v_ant text;
BEGIN
  SELECT nome INTO v_cliente FROM public.clientes WHERE id = NEW.cliente_id;
  v_cliente := COALESCE(v_cliente, 'cliente');
  v_novo := lower(COALESCE(NEW.status, ''));
  v_ant := CASE WHEN TG_OP = 'INSERT' THEN '' ELSE lower(COALESCE(OLD.status, '')) END;

  -- técnico recebe a atribuição (na abertura ou quando muda o responsável)
  IF NEW.tecnico_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.tecnico_id IS DISTINCT FROM OLD.tecnico_id) THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, os_id)
    VALUES (NEW.tecnico_id, 'os_atribuida',
            CASE NEW.prioridade WHEN 'urgente' THEN 'Chamado URGENTE atribuído' ELSE 'Novo chamado atribuído' END,
            NEW.numero || ' · ' || v_cliente || ' — ' || NEW.titulo, NEW.id);
  END IF;

  IF TG_OP = 'UPDATE' AND v_novo IS DISTINCT FROM v_ant THEN
    -- gestores: chamado executado, aguardando conferência
    IF v_novo = 'executada' THEN
      INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, os_id)
      SELECT p.id, 'os_executada', 'Chamado executado',
             NEW.numero || ' · ' || v_cliente || ' aguarda sua conferência.', NEW.id
      FROM public.profiles p
      WHERE p.cargo IN ('admin','comercial')
        AND p.ativo IS DISTINCT FROM false
        AND p.status IS DISTINCT FROM 'rejeitado'
        AND p.status IS DISTINCT FROM 'pendente_aprovacao';
    -- técnico: chamado conferido e fechado
    ELSIF v_novo = 'fechada' AND NEW.tecnico_id IS NOT NULL THEN
      INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, os_id)
      VALUES (NEW.tecnico_id, 'os_fechada', 'Chamado fechado',
              NEW.numero || ' · ' || v_cliente || ' foi conferido e encerrado.', NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_os_ins ON public.ordens_servico;
CREATE TRIGGER trg_notify_os_ins
  AFTER INSERT ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.notify_os();

DROP TRIGGER IF EXISTS trg_notify_os_upd ON public.ordens_servico;
CREATE TRIGGER trg_notify_os_upd
  AFTER UPDATE OF status, tecnico_id ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.notify_os();

-- realtime, para as listas se atualizarem sozinhas (padrão de visitas_tecnicas)
ALTER TABLE public.ordens_servico REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ordens_servico;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 5) RLS
-- ═══════════════════════════════════════════════════════════════════════
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ordens_servico TO authenticated;
GRANT ALL ON public.ordens_servico TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_fotos TO authenticated;
GRANT ALL ON public.os_fotos TO service_role;
GRANT SELECT, INSERT ON public.os_eventos TO authenticated;
GRANT ALL ON public.os_eventos TO service_role;

ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_fotos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_eventos     ENABLE ROW LEVEL SECURITY;

-- "posso ver/mexer nesta OS?" — técnico responsável ou gestor
CREATE OR REPLACE FUNCTION public.pode_acessar_os(_os_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    public.is_gestor(auth.uid())
    OR EXISTS (SELECT 1 FROM public.ordens_servico o
               WHERE o.id = _os_id AND o.tecnico_id = auth.uid()),
    false
  );
$$;
REVOKE EXECUTE ON FUNCTION public.pode_acessar_os(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_acessar_os(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "os_select" ON public.ordens_servico;
CREATE POLICY "os_select" ON public.ordens_servico
  FOR SELECT TO authenticated
  USING (tecnico_id = auth.uid() OR public.is_gestor(auth.uid()));

-- quem abre chamado é o gestor (SAC)
DROP POLICY IF EXISTS "os_insert_gestor" ON public.ordens_servico;
CREATE POLICY "os_insert_gestor" ON public.ordens_servico
  FOR INSERT TO authenticated
  WITH CHECK (public.is_gestor(auth.uid()));

-- técnico responsável atualiza a execução; gestor atualiza tudo
DROP POLICY IF EXISTS "os_update" ON public.ordens_servico;
CREATE POLICY "os_update" ON public.ordens_servico
  FOR UPDATE TO authenticated
  USING (tecnico_id = auth.uid() OR public.is_gestor(auth.uid()))
  WITH CHECK (tecnico_id = auth.uid() OR public.is_gestor(auth.uid()));

DROP POLICY IF EXISTS "os_delete_admin" ON public.ordens_servico;
CREATE POLICY "os_delete_admin" ON public.ordens_servico
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_gestor(auth.uid()));

DROP POLICY IF EXISTS "os_fotos_select" ON public.os_fotos;
DROP POLICY IF EXISTS "os_fotos_insert" ON public.os_fotos;
DROP POLICY IF EXISTS "os_fotos_delete" ON public.os_fotos;
CREATE POLICY "os_fotos_select" ON public.os_fotos
  FOR SELECT TO authenticated USING (public.pode_acessar_os(os_id));
CREATE POLICY "os_fotos_insert" ON public.os_fotos
  FOR INSERT TO authenticated WITH CHECK (public.pode_acessar_os(os_id) AND created_by = auth.uid());
CREATE POLICY "os_fotos_delete" ON public.os_fotos
  FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_gestor(auth.uid()));

DROP POLICY IF EXISTS "os_eventos_select" ON public.os_eventos;
DROP POLICY IF EXISTS "os_eventos_insert" ON public.os_eventos;
CREATE POLICY "os_eventos_select" ON public.os_eventos
  FOR SELECT TO authenticated USING (public.pode_acessar_os(os_id));
CREATE POLICY "os_eventos_insert" ON public.os_eventos
  FOR INSERT TO authenticated WITH CHECK (public.pode_acessar_os(os_id));

-- ═══════════════════════════════════════════════════════════════════════
-- 6) STORAGE — bucket privado das fotos e assinaturas
-- ═══════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public) VALUES ('fotos-os', 'fotos-os', false)
  ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'bucket fotos-os nao criado por SQL (%): crie no dashboard da Lovable como PRIVADO.', SQLERRM;
END $$;

DROP POLICY IF EXISTS "fotos_os_read"   ON storage.objects;
DROP POLICY IF EXISTS "fotos_os_insert" ON storage.objects;
DROP POLICY IF EXISTS "fotos_os_delete" ON storage.objects;
CREATE POLICY "fotos_os_read" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'fotos-os');
CREATE POLICY "fotos_os_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'fotos-os');
CREATE POLICY "fotos_os_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'fotos-os' AND owner = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO FINAL
-- ═══════════════════════════════════════════════════════════════════════
SELECT 'tabelas criadas (ordens_servico, os_fotos, os_eventos, os_sla, os_contadores)' AS verificacao,
       count(*)::text AS resultado, '5' AS esperado
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('ordens_servico','os_fotos','os_eventos','os_sla','os_contadores')
UNION ALL
SELECT 'prazos de SLA cadastrados', count(*)::text, '4' FROM public.os_sla
UNION ALL
SELECT 'constraints de dominio da OS (tipo, prioridade, status)',
       count(*)::text, '3'
FROM pg_constraint
WHERE conname IN ('ordens_servico_tipo_check','ordens_servico_prioridade_check','ordens_servico_status_check')
UNION ALL
SELECT 'triggers da OS (numero/prazo, eventos, notificacoes, updated_at)',
       count(*)::text, '6'
FROM pg_trigger
WHERE NOT tgisinternal
  AND tgname IN ('trg_os_numero_prazo','trg_os_evento_ins','trg_os_evento_upd',
                 'trg_notify_os_ins','trg_notify_os_upd','ordens_servico_set_updated_at')
UNION ALL
SELECT 'policies criadas (OS 4 + fotos 3 + eventos 2 + sla 1)',
       count(*)::text, '10'
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('ordens_servico','os_fotos','os_eventos','os_sla')
UNION ALL
SELECT 'coluna os_id em notificacoes',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema='public' AND table_name='notificacoes' AND column_name='os_id'
       ) THEN 'sim' ELSE 'NAO' END, 'sim'
UNION ALL
SELECT 'funcao pode_acessar_os instalada',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
         WHERE n.nspname='public' AND p.proname='pode_acessar_os'
       ) THEN 'sim' ELSE 'NAO' END, 'sim'
UNION ALL
SELECT 'ordens_servico no realtime',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_publication_tables
         WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='ordens_servico'
       ) THEN 'sim' ELSE 'NAO' END, 'sim'
UNION ALL
SELECT 'bucket fotos-os (privado)',
       COALESCE((SELECT CASE WHEN public THEN 'PUBLICO (corrigir)' ELSE 'privado' END
                 FROM storage.buckets WHERE id='fotos-os'), 'NAO EXISTE — criar no dashboard'),
       'privado';
