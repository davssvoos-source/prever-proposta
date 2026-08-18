-- ETAPA U0 da unificação — Fundações.
-- Referência: docs/PLANO_UNIFICACAO.md §4.2 e §10.
--
-- >>> RODAR NO SQL EDITOR DA LOVABLE (Cloud → SQL editor). Idempotente. <<<
-- >>> Conferir o SELECT final: cada linha traz o valor esperado ao lado. <<<
--
-- Esta etapa não cria nenhum módulo novo: prepara o terreno das etapas U1–U7
-- para que nenhuma delas precise mexer no que já está em produção.
--
--   1) profiles.equipe — as 5 equipes do Notion como ATRIBUTO de roteamento
--      (nunca papel: app_role continua com 3 valores e is_gestor() intacta).
--   2) clientes.documento / qap_cliente_id — o CNPJ é pré-requisito do
--      financeiro (o fechamento imprime CNPJ) e a chave do de-para com o QAP,
--      onde todos os clientes também estão cadastrados.
--   3) ordens_servico: numero_externo (SIGMA/legado), tipo_servico
--      (instalação × manutenção, dimensão do fechamento) e faturamento_status
--      — estado financeiro FORA do CHECK de status, para não contaminar SLA,
--      painel de campo e a policy os_update.
--   4) tecnico_aliases — reconcilia "nome do técnico" em texto (PDF do SIGMA,
--      importação do gestor-os) com o profile de verdade.
--   5) normalizar_texto() — o gêmeo SQL do normalizarChave do gestor-os, base
--      do matching da U4 e das chaves de conciliação.
--   6) pode_ver_financeiro() — a costura da RLS financeira: hoje é gestor,
--      amanhã um papel 'financeiro' entra aqui e em nenhum outro lugar.
--   7) agendar_job() — cron versionado em migration (hoje os jobs do projeto
--      foram criados à mão no dashboard e não estão em lugar nenhum do repo).

-- ═══════════════════════════════════════════════════════════════════════
-- 1) NORMALIZAÇÃO DE TEXTO (base de todo matching)
-- ═══════════════════════════════════════════════════════════════════════
-- IMMUTABLE de propósito: é usada em coluna gerada e em índice.
-- unaccent() não serve aqui — depende de dicionário e por isso é só STABLE.
CREATE OR REPLACE FUNCTION public.normalizar_texto(_t text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT NULLIF(
    btrim(regexp_replace(
      translate(
        lower(COALESCE(_t, '')),
        'áàâãäéèêëíìîïóòôõöúùûüçñ',
        'aaaaaeeeeiiiiooooouuuucn'
      ),
      '\s+', ' ', 'g'
    )),
  '');
$$;
COMMENT ON FUNCTION public.normalizar_texto(text) IS
  'Minúsculas, sem acento, espaços colapsados. Gêmeo SQL do normalizarChave (src/lib/normalizar.ts). IMMUTABLE: usada em coluna gerada e índices.';
GRANT EXECUTE ON FUNCTION public.normalizar_texto(text) TO authenticated, service_role;

-- Só dígitos — para CNPJ/CPF, onde a máscara do formulário não pode virar
-- chave (11.222.333/0001-44 e 11222333000144 são o mesmo documento).
CREATE OR REPLACE FUNCTION public.somente_digitos(_t text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT NULLIF(regexp_replace(COALESCE(_t, ''), '\D', '', 'g'), '');
$$;
GRANT EXECUTE ON FUNCTION public.somente_digitos(text) TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════
-- 2) EQUIPES NO PERFIL (atributo, não papel)
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS equipe text;

DO $$
BEGIN
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_equipe_check
    CHECK (equipe IS NULL OR equipe IN
      ('ti','patrimonio','audiovisual','business_ops','tecnica','comercial'));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN
  RAISE NOTICE 'equipe fora da lista — constraint nao criada';
END $$;

CREATE INDEX IF NOT EXISTS profiles_equipe_idx ON public.profiles (equipe);

COMMENT ON COLUMN public.profiles.equipe IS
  'Equipe de roteamento de demandas (Notion). NÃO é permissão — quem pode o quê continua em user_roles/is_gestor().';

-- A equipe define de quem é a fila de demandas: trocar a própria equipe seria
-- desviar trabalho. Entra no mesmo guarda-corpo de cargo/status/ativo.
CREATE OR REPLACE FUNCTION public.guard_profiles_privilegios()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- criar o próprio perfil já vindo com cargo seria auto-promoção
    IF NEW.cargo IS NOT NULL THEN
      RAISE EXCEPTION 'Somente administradores podem definir o cargo de um perfil.'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.cargo IS DISTINCT FROM OLD.cargo
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.ativo IS DISTINCT FROM OLD.ativo
     OR NEW.equipe IS DISTINCT FROM OLD.equipe THEN
    RAISE EXCEPTION
      'Somente administradores podem alterar cargo, equipe, status ou ativação de um perfil.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- CREATE OR REPLACE da função já basta: o trigger aponta para ela por OID.
-- DROP + CREATE do trigger abriria uma janela — curta, mas justamente na trava
-- que impede auto-promoção a admin. Só cria se não existir.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_guard_profiles_privilegios'
      AND tgrelid = 'public.profiles'::regclass
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER trg_guard_profiles_privilegios
      BEFORE INSERT OR UPDATE ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.guard_profiles_privilegios();
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 3) CLIENTES — documento (CNPJ/CPF) e de-para com o QAP
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS documento              text,
  ADD COLUMN IF NOT EXISTS responsavel_financeiro text,
  ADD COLUMN IF NOT EXISTS email_financeiro       text,
  ADD COLUMN IF NOT EXISTS qap_cliente_id         text;

-- Índice único PARCIAL: cliente sem CNPJ cadastrado continua válido (a maioria
-- hoje), mas o mesmo documento não pode existir em dois cadastros — é a chave
-- que o pipeline financeiro usa para reconciliar.
CREATE UNIQUE INDEX IF NOT EXISTS clientes_documento_unico
  ON public.clientes (public.somente_digitos(documento))
  WHERE documento IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS clientes_qap_unico
  ON public.clientes (qap_cliente_id)
  WHERE qap_cliente_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS clientes_nome_normalizado_idx
  ON public.clientes (public.normalizar_texto(nome));

COMMENT ON COLUMN public.clientes.documento IS
  'CNPJ/CPF. Fonte: QAP (todos os clientes estão lá). Chave de reconciliação do financeiro e do de-para com o ERP.';
COMMENT ON COLUMN public.clientes.qap_cliente_id IS
  'Id do cliente no QAP ERP. Preenchido pelo import (fase 1) ou pela API (fase 2). Ver PLANO_UNIFICACAO.md §8.';

-- ═══════════════════════════════════════════════════════════════════════
-- 4) ORDENS DE SERVIÇO — campos de fronteira com o financeiro
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS numero_externo     text,
  ADD COLUMN IF NOT EXISTS tipo_servico       text,
  ADD COLUMN IF NOT EXISTS faturamento_status text NOT NULL DEFAULT 'a_analisar';

COMMENT ON COLUMN public.ordens_servico.numero_externo IS
  'Número da OS no sistema de origem (SIGMA/gestor-os). numero continua SEMPRE nativo: ele é UNIQUE global e o número do SIGMA só é único por cliente.';
COMMENT ON COLUMN public.ordens_servico.faturamento_status IS
  'Estado financeiro. Deliberadamente FORA do CHECK de status: o ciclo de campo (SLA, painel, policy os_update) não pode depender do financeiro.';

-- número externo é único dentro do cliente (era assim no gestor-os), nunca global
CREATE UNIQUE INDEX IF NOT EXISTS os_numero_externo_unico
  ON public.ordens_servico (cliente_id, numero_externo)
  WHERE numero_externo IS NOT NULL;

CREATE INDEX IF NOT EXISTS os_faturamento_idx
  ON public.ordens_servico (faturamento_status)
  WHERE faturamento_status <> 'sem_cobranca';

DO $$
BEGIN
  ALTER TABLE public.ordens_servico ADD CONSTRAINT ordens_servico_tipo_servico_check
    CHECK (tipo_servico IS NULL OR tipo_servico IN ('instalacao','manutencao'));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN
  RAISE NOTICE 'tipo_servico fora da lista — constraint nao criada';
END $$;

DO $$
BEGIN
  ALTER TABLE public.ordens_servico ADD CONSTRAINT ordens_servico_faturamento_check
    CHECK (faturamento_status IN
      ('a_analisar','em_conferencia','aprovada','faturada','sem_cobranca'));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN
  RAISE NOTICE 'faturamento_status fora da lista — constraint nao criada';
END $$;

-- Backfill: implantação é instalação; o resto é manutenção (a dimensão que o
-- fechamento separa, conforme o PDF do gestor-os).
UPDATE public.ordens_servico
SET tipo_servico = CASE WHEN tipo = 'implantacao' THEN 'instalacao' ELSE 'manutencao' END
WHERE tipo_servico IS NULL;

-- OS encerrada antes de o motor de cobrança existir nunca passou por análise:
-- marcar 'a_analisar' encheria a fila da U4 de histórico morto.
UPDATE public.ordens_servico
SET faturamento_status = 'sem_cobranca'
WHERE status IN ('fechada','cancelada')
  AND faturamento_status = 'a_analisar';

-- Com o histórico preenchido, o banco passa a derivar sozinho na abertura.
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
  -- instalação × manutenção: dimensão do fechamento, derivada do tipo da OS
  IF NEW.tipo_servico IS NULL THEN
    NEW.tipo_servico := CASE WHEN NEW.tipo = 'implantacao' THEN 'instalacao' ELSE 'manutencao' END;
  END IF;
  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- 5) TECNICO_ALIASES — nome em texto → pessoa de verdade
-- ═══════════════════════════════════════════════════════════════════════
-- No SIGMA e no gestor-os o técnico é uma string extraída do PDF; aqui é
-- tecnico_id uuid com RLS (tecnico_id = auth.uid()). Sem esta ponte, toda OS
-- importada nasce invisível para o técnico e fora do painel por responsável.
CREATE TABLE IF NOT EXISTS public.tecnico_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_original text NOT NULL,
  nome_normalizado text GENERATED ALWAYS AS (public.normalizar_texto(nome_original)) STORED,
  -- SET NULL, não CASCADE: se a pessoa sai, o alias vira "não reconhecido" e
  -- pode ser reapontado — apagá-lo perderia a memória de que aquele nome já
  -- apareceu nos PDFs importados.
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  origem text NOT NULL DEFAULT 'manual',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE public.tecnico_aliases ADD CONSTRAINT tecnico_aliases_origem_check
    CHECK (origem IN ('sigma','gestor_os','notion','manual'));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN
  RAISE NOTICE 'origem fora da lista — constraint nao criada';
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS tecnico_aliases_unico
  ON public.tecnico_aliases (nome_normalizado);

DROP TRIGGER IF EXISTS tecnico_aliases_set_updated_at ON public.tecnico_aliases;
CREATE TRIGGER tecnico_aliases_set_updated_at
  BEFORE UPDATE ON public.tecnico_aliases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Resolve um nome solto para o profile correspondente (NULL = não reconhecido,
-- que é resposta legítima: a conferência humana resolve).
CREATE OR REPLACE FUNCTION public.resolver_tecnico(_nome text)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT a.profile_id FROM public.tecnico_aliases a
      WHERE a.nome_normalizado = public.normalizar_texto(_nome)
        AND a.profile_id IS NOT NULL
      LIMIT 1),
    (SELECT p.id FROM public.profiles p
      WHERE public.normalizar_texto(p.nome) = public.normalizar_texto(_nome)
        AND p.ativo IS DISTINCT FROM false
      LIMIT 1)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.resolver_tecnico(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolver_tecnico(text) TO authenticated, service_role;

GRANT SELECT ON public.tecnico_aliases TO authenticated;
GRANT ALL ON public.tecnico_aliases TO service_role;
ALTER TABLE public.tecnico_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tecnico_aliases_select" ON public.tecnico_aliases;
DROP POLICY IF EXISTS "tecnico_aliases_write"  ON public.tecnico_aliases;
CREATE POLICY "tecnico_aliases_select" ON public.tecnico_aliases
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "tecnico_aliases_write" ON public.tecnico_aliases
  FOR ALL TO authenticated
  USING (public.is_gestor(auth.uid()))
  WITH CHECK (public.is_gestor(auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════
-- 6) RLS FINANCEIRA — a costura
-- ═══════════════════════════════════════════════════════════════════════
-- Hoje responde igual a is_gestor(). Existe separada de propósito: quando
-- houver um papel 'financeiro' (ou a equipe business_ops precisar ver valores),
-- a mudança acontece AQUI, e não em cada policy de contrato/cobrança/fechamento
-- espalhada pelas etapas U2–U5.
CREATE OR REPLACE FUNCTION public.pode_ver_financeiro(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(public.is_gestor(_user_id), false);
$$;
COMMENT ON FUNCTION public.pode_ver_financeiro(uuid) IS
  'Quem enxerga valores, cobranças e fechamentos. Técnico que acessa a OS NÃO enxerga o financeiro dela. Ver PLANO_UNIFICACAO.md §4.4.';
REVOKE EXECUTE ON FUNCTION public.pode_ver_financeiro(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_ver_financeiro(uuid) TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════
-- 7) AGENDAMENTO VERSIONADO (pg_cron)
-- ═══════════════════════════════════════════════════════════════════════
-- Os jobs do projeto (ex.: lembrete de visita a cada 5 min) foram criados à mão
-- no dashboard e não existem em nenhuma migration: ninguém sabe o que está
-- agendado sem abrir o SQL editor. A partir daqui, todo job passa por aqui.
--
-- ATENÇÃO: pg_cron roda em UTC. 00:01 de Brasília = '1 3 * * *'.
CREATE OR REPLACE FUNCTION public.agendar_job(_nome text, _cron text, _comando text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_existe boolean;
  v_id bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN 'pg_cron nao instalado — habilite em Database > Extensions';
  END IF;
  EXECUTE 'SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = $1)'
    INTO v_existe USING _nome;
  IF v_existe THEN
    EXECUTE 'SELECT cron.unschedule($1)' USING _nome;
  END IF;
  EXECUTE 'SELECT cron.schedule($1, $2, $3)' INTO v_id USING _nome, _cron, _comando;
  RETURN 'job ' || _nome || ' agendado (id ' || v_id::text || ')';
EXCEPTION WHEN OTHERS THEN
  RETURN 'falhou (' || SQLERRM || ')';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.agendar_job(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agendar_job(text, text, text) TO service_role;

-- Inventário do que está agendado hoje (para versionarmos os jobs manuais).
CREATE OR REPLACE FUNCTION public.jobs_agendados()
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN 'pg_cron nao instalado';
  END IF;
  EXECUTE 'SELECT COALESCE(string_agg(jobname || '' ['' || schedule || '']'', '', ''), ''(nenhum)'') FROM cron.job'
    INTO v;
  RETURN v;
EXCEPTION WHEN OTHERS THEN
  RETURN 'sem acesso a cron.job (' || SQLERRM || ')';
END;
$$;
-- não vale expor a agenda interna do banco a qualquer usuário logado
REVOKE EXECUTE ON FUNCTION public.jobs_agendados() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jobs_agendados() TO service_role;

-- ═══════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO FINAL
-- ═══════════════════════════════════════════════════════════════════════
SELECT 'coluna profiles.equipe' AS verificacao,
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
         WHERE table_schema='public' AND table_name='profiles' AND column_name='equipe')
       THEN 'sim' ELSE 'NAO' END AS resultado, 'sim' AS esperado
UNION ALL
SELECT 'colunas novas em clientes (documento, responsavel/email financeiro, qap_cliente_id)',
       count(*)::text, '4'
FROM information_schema.columns
WHERE table_schema='public' AND table_name='clientes'
  AND column_name IN ('documento','responsavel_financeiro','email_financeiro','qap_cliente_id')
UNION ALL
SELECT 'colunas novas em ordens_servico (numero_externo, tipo_servico, faturamento_status)',
       count(*)::text, '3'
FROM information_schema.columns
WHERE table_schema='public' AND table_name='ordens_servico'
  AND column_name IN ('numero_externo','tipo_servico','faturamento_status')
UNION ALL
SELECT 'OS sem tipo_servico (deve ter zerado no backfill)', count(*)::text, '0'
FROM public.ordens_servico WHERE tipo_servico IS NULL
UNION ALL
SELECT 'distribuicao de faturamento_status',
       COALESCE(string_agg(t.faturamento_status || '=' || t.n::text, ', ' ORDER BY t.faturamento_status), '(nenhuma OS)'),
       '(informativo — historico encerrado vira sem_cobranca)'
FROM (SELECT faturamento_status, count(*) AS n FROM public.ordens_servico GROUP BY 1) t
UNION ALL
SELECT 'tabela tecnico_aliases',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables
         WHERE table_schema='public' AND table_name='tecnico_aliases')
       THEN 'sim' ELSE 'NAO' END, 'sim'
UNION ALL
SELECT 'funcoes novas (normalizar_texto, somente_digitos, resolver_tecnico, pode_ver_financeiro, agendar_job, jobs_agendados)',
       count(*)::text, '6'
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname='public' AND p.proname IN
  ('normalizar_texto','somente_digitos','resolver_tecnico','pode_ver_financeiro','agendar_job','jobs_agendados')
UNION ALL
SELECT 'normalizar_texto funciona (Condomínio Água Verde)',
       public.normalizar_texto('  Condomínio   ÁGUA Verde '), 'condominio agua verde'
UNION ALL
SELECT 'somente_digitos funciona (11.222.333/0001-44)',
       public.somente_digitos('11.222.333/0001-44'), '11222333000144'
UNION ALL
SELECT 'guarda de perfil cobre equipe',
       CASE WHEN (SELECT prosrc FROM pg_proc WHERE proname='guard_profiles_privilegios')
                 LIKE '%NEW.equipe IS DISTINCT FROM OLD.equipe%'
       THEN 'sim' ELSE 'NAO' END, 'sim'
UNION ALL
SELECT 'indices unicos novos (documento, qap, numero_externo, alias)',
       count(*)::text, '4'
FROM pg_indexes
WHERE schemaname='public' AND indexname IN
  ('clientes_documento_unico','clientes_qap_unico','os_numero_externo_unico','tecnico_aliases_unico')
UNION ALL
SELECT 'constraints de dominio novas (equipe, tipo_servico, faturamento, origem do alias)',
       count(*)::text, '4'
FROM pg_constraint
WHERE conname IN ('profiles_equipe_check','ordens_servico_tipo_servico_check',
                  'ordens_servico_faturamento_check','tecnico_aliases_origem_check')
UNION ALL
SELECT 'clientes com documento preenchido', count(*)::text,
       '(informativo — o import do QAP preenche na U0/U6)'
FROM public.clientes WHERE documento IS NOT NULL
UNION ALL
SELECT 'jobs pg_cron agendados hoje', public.jobs_agendados(),
       '(informativo — anote para versionarmos os que existirem)';
