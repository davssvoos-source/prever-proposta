-- ═══════════════════════════════════════════════════════════════════════════
-- U134 — AS VIATURAS: quem usou qual carro, em que dia (R266–R274)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Davi, 13/09/2026: "Vamos criar um sistema onde faremos o controle da viatura
-- utilizada pelo técnico. O objetivo é controlar quem usou qual carro em que
-- dia. […] a pessoa bipar para iniciar a viagem de ida a um cliente e bipar para
-- encerrar, e ao iniciar inserir a kilometragem inicial e ao finalizar inserir
-- a kilometragem final. Quem utiliza isso são os técnicos de campo, que são os
-- usuários que tem o cargo Técnico." E: "Cada trecho é um trecho"; "Deixa
-- passar com aviso"; "Por enquanto somente o técnico".
-- O contexto inteiro: docs/CONTEXTO_VIATURAS.md.
--
-- ── O QUE NASCE ────────────────────────────────────────────────────────────
--
--  §1 `locais_de_referencia` — a SEDE como ponto (Rua Conde de Linhares, 243,
--     Interlagos): é o destino do trecho de volta e o que a chegada por
--     localização (R273/R274) usa quando o técnico está voltando. A coordenada
--     semeada é o CENTRO DA RUA no OpenStreetMap (-23.7087991, -46.7035152);
--     o Davi ajusta o ponto exato na aba Viaturas, e o ON CONFLICT DO NOTHING
--     garante que rodar de novo não desfaz o ajuste.
--  §2 `viaturas` — placa, apelido, o CÓDIGO da etiqueta (o que vai no endereço
--     …/viatura/<codigo>) e `ativa`. Remover = desativar quando já rodou (R271).
--  §3 `viagens_viatura` — UM TRECHO por linha (R267): saída (instante, km,
--     quem, qual carro, atividade opcional) e chegada (instante, km). Km rodado
--     e duração são CALCULADOS na leitura, nunca colunas. Dois avisos
--     (`aviso_saida`, `aviso_chegada`) marcam km fora de ordem — passa com
--     aviso, não bloqueia (R268). Dois índices únicos PARCIAIS são as duas
--     invariantes da R269: no máximo UMA viagem aberta por viatura e UMA por
--     técnico.
--  §4 as policies: todo logado LÊ as três tabelas (metadado operacional — o
--     técnico precisa ver "em uso por Nicholas"); só a gestão ESCREVE
--     viaturas e a sede pela tabela; e NINGUÉM escreve viagem pela tabela —
--     só pelas três portas do §5.
--  §5 as portas (SECURITY DEFINER, gate por cargo):
--     · `viatura_iniciar_viagem(codigo, km, chamado?, assumir?)` — técnico;
--       recusa se ele já está em viagem; se o carro está com outro e
--       `assumir` é false, recusa com a frase; se `assumir`, encerra a do
--       outro com o km digitado (marcada `assumida`) e abre a dele;
--     · `viatura_encerrar_viagem(viagem, km)` — só quem iniciou;
--     · `viatura_corrigir_viagem(...)` — a gestão, na folha, com rastro
--       (`corrigida_por/em`); pode fechar uma viagem aberta (`gestor`).
--
-- ── POR QUE PORTAS E NÃO INSERT/UPDATE PELO CLIENTE ───────────────────────
-- A viagem tem regra de TRANSIÇÃO (assumir fecha uma e abre outra na MESMA
-- transação; o aviso é calculado contra o último km da viatura). Deixar o
-- cliente escrever a linha faria a regra morar em três telas; aqui ela mora
-- num lugar, e a asserção do verificador a cobra pelo texto.
--
-- DEPENDE DA U132: `eh_tecnico(uuid)` é o gate de quem registra. O pré-voo
-- aborta sem ela.
--
-- IDEMPOTENTE: CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
-- DROP/CREATE nas policies, CREATE OR REPLACE nas funções, ON CONFLICT na
-- semente. O portão roda numa transação própria que termina em ROLLBACK.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §0  PRÉ-VOO ────────────────────────────────────────────────────────────
DO $u134pre$
BEGIN
  IF to_regclass('public.profiles') IS NULL OR to_regclass('public.chamados') IS NULL THEN
    RAISE EXCEPTION 'U134 PRÉ-VOO: profiles/chamados não existem — rode as migrations anteriores.';
  END IF;
  IF to_regprocedure('public.eh_tecnico(uuid)') IS NULL THEN
    RAISE EXCEPTION 'U134 PRÉ-VOO: eh_tecnico(uuid) não existe — rode a U132 PRIMEIRO (é o gate de quem registra viagem).';
  END IF;
  IF to_regprocedure('public.is_gestor(uuid)') IS NULL THEN
    RAISE EXCEPTION 'U134 PRÉ-VOO: is_gestor(uuid) não existe (U6a).';
  END IF;
END
$u134pre$;

-- ── §1  A SEDE (e outros pontos de referência que vierem) ──────────────────
CREATE TABLE IF NOT EXISTS public.locais_de_referencia (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      text NOT NULL UNIQUE,
  nome        text NOT NULL,
  endereco    text,
  latitude    numeric,
  longitude   numeric,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT locais_de_referencia_codigo_check CHECK (codigo ~ '^[a-z0-9][a-z0-9-]{0,39}$')
);
COMMENT ON TABLE public.locais_de_referencia IS
  'R274 (U134): pontos fixos da operação — hoje só a SEDE. É o destino do trecho de volta e um dos alvos da chegada por localização.';

ALTER TABLE public.locais_de_referencia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS locais_de_referencia_select ON public.locais_de_referencia;
CREATE POLICY locais_de_referencia_select ON public.locais_de_referencia
  FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS locais_de_referencia_escrita ON public.locais_de_referencia;
CREATE POLICY locais_de_referencia_escrita ON public.locais_de_referencia
  FOR ALL TO authenticated
  USING (public.is_gestor(auth.uid()))
  WITH CHECK (public.is_gestor(auth.uid()));

-- Davi, 13/09/2026: "O endereço da sede é Rua Conde de Linhares, 243 -
-- Interlagos, São Paulo". A coordenada é o centro da rua no OSM; o ajuste
-- fino é feito na aba Viaturas, e rodar de novo NÃO sobrescreve.
INSERT INTO public.locais_de_referencia (codigo, nome, endereco, latitude, longitude)
VALUES ('sede', 'Sede — Grupo Prever', 'Rua Conde de Linhares, 243 - Interlagos, São Paulo', -23.7087991, -46.7035152)
ON CONFLICT (codigo) DO NOTHING;

-- ── §2  AS VIATURAS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.viaturas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- o que vai na etiqueta: …/viatura/<codigo>. Nome estável, separado da
  -- placa: a etiqueta está colada no carro (R271, D2).
  codigo         text NOT NULL UNIQUE,
  placa          text NOT NULL,
  apelido        text NOT NULL,
  ativa          boolean NOT NULL DEFAULT true,
  desativada_em  timestamptz,
  criada_por     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT viaturas_codigo_check  CHECK (codigo ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  CONSTRAINT viaturas_placa_check   CHECK (length(trim(placa)) BETWEEN 5 AND 12),
  CONSTRAINT viaturas_apelido_check CHECK (length(trim(apelido)) BETWEEN 2 AND 60)
);
-- a mesma placa não pode estar ATIVA duas vezes (uma desativada pode voltar com outra etiqueta)
CREATE UNIQUE INDEX IF NOT EXISTS viaturas_placa_ativa_idx ON public.viaturas (upper(replace(placa, '-', ''))) WHERE ativa;
COMMENT ON TABLE public.viaturas IS
  'R266/R271 (U134): os carros da empresa. `codigo` é o que a etiqueta NFC carrega no endereço. Remover = desativar quando já rodou.';

ALTER TABLE public.viaturas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS viaturas_select ON public.viaturas;
CREATE POLICY viaturas_select ON public.viaturas
  FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS viaturas_escrita ON public.viaturas;
CREATE POLICY viaturas_escrita ON public.viaturas
  FOR ALL TO authenticated
  USING (public.is_gestor(auth.uid()))
  WITH CHECK (public.is_gestor(auth.uid()));

-- ── §3  AS VIAGENS (um TRECHO por linha) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.viagens_viatura (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viatura_id      uuid NOT NULL REFERENCES public.viaturas(id) ON DELETE RESTRICT,
  tecnico_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  -- a atividade (opcional, R270): o cliente dela é o destino do trecho
  chamado_id      uuid REFERENCES public.chamados(id) ON DELETE SET NULL,
  saida_em        timestamptz NOT NULL DEFAULT now(),
  km_saida        integer NOT NULL CHECK (km_saida >= 0),
  chegada_em      timestamptz,
  km_chegada      integer CHECK (km_chegada IS NULL OR km_chegada >= 0),
  -- R268: km fora de ordem PASSA e fica marcado — a folha mostra, o gestor corrige
  aviso_saida     boolean NOT NULL DEFAULT false,
  aviso_chegada   boolean NOT NULL DEFAULT false,
  encerramento    text NOT NULL DEFAULT 'aberta'
                  CHECK (encerramento IN ('aberta', 'normal', 'assumida', 'gestor')),
  encerrada_por   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  corrigida_por   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  corrigida_em    timestamptz,
  observacao      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- chegada e km de chegada andam juntos; "aberta" é exatamente "sem chegada"
  CONSTRAINT viagens_chegada_completa   CHECK ((chegada_em IS NULL) = (km_chegada IS NULL)),
  CONSTRAINT viagens_encerramento_coere CHECK ((encerramento = 'aberta') = (chegada_em IS NULL))
);
-- AS DUAS INVARIANTES DA R269, no banco e não só na tela:
CREATE UNIQUE INDEX IF NOT EXISTS viagens_uma_aberta_por_viatura ON public.viagens_viatura (viatura_id) WHERE chegada_em IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS viagens_uma_aberta_por_tecnico ON public.viagens_viatura (tecnico_id) WHERE chegada_em IS NULL;
CREATE INDEX IF NOT EXISTS viagens_viatura_saida_idx ON public.viagens_viatura (viatura_id, saida_em DESC);
CREATE INDEX IF NOT EXISTS viagens_tecnico_saida_idx ON public.viagens_viatura (tecnico_id, saida_em DESC);
COMMENT ON TABLE public.viagens_viatura IS
  'R267–R269 (U134): um TRECHO por linha. Km rodados e duração são calculados na leitura. Escrita só pelas portas viatura_iniciar_viagem / viatura_encerrar_viagem / viatura_corrigir_viagem.';

ALTER TABLE public.viagens_viatura ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS viagens_viatura_select ON public.viagens_viatura;
CREATE POLICY viagens_viatura_select ON public.viagens_viatura
  FOR SELECT TO authenticated
  USING (true);
-- sem policy de INSERT/UPDATE/DELETE: pela tabela, ninguém escreve. As portas
-- são SECURITY DEFINER e passam por cima da RLS — é assim que se garante que
-- toda viagem nasce e fecha pela regra.

-- ── §4  AS PORTAS ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.viatura_iniciar_viagem(
  _codigo text,
  _km_saida integer,
  _chamado_id uuid DEFAULT NULL,
  _assumir boolean DEFAULT false
)
RETURNS TABLE (viagem_id uuid, aviso_saida boolean, assumida_de uuid, ultimo_km integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $u134a$
DECLARE
  v_uid       uuid := auth.uid();
  v_viatura   public.viaturas%ROWTYPE;
  v_minha     public.viagens_viatura%ROWTYPE;
  v_aberta    public.viagens_viatura%ROWTYPE;
  v_ultimo    integer;
  v_aviso     boolean := false;
  v_assumida  uuid := NULL;
  v_id        uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Faça login para registrar a viatura.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.eh_tecnico(v_uid) THEN
    RAISE EXCEPTION 'Só quem tem cargo técnico registra viagem de viatura (R266).' USING ERRCODE = '42501';
  END IF;
  IF _km_saida IS NULL OR _km_saida < 0 THEN
    RAISE EXCEPTION 'Informe o km que o painel mostra.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_viatura FROM public.viaturas WHERE codigo = lower(trim(_codigo));
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esta etiqueta (%) não corresponde a nenhuma viatura cadastrada.', _codigo USING ERRCODE = 'P0002';
  END IF;
  IF NOT v_viatura.ativa THEN
    RAISE EXCEPTION 'A viatura % foi removida do sistema — fale com a gestão.', v_viatura.apelido USING ERRCODE = 'P0002';
  END IF;

  -- eu já estou em viagem?
  SELECT * INTO v_minha FROM public.viagens_viatura v WHERE v.tecnico_id = v_uid AND v.chegada_em IS NULL;
  IF FOUND THEN
    IF v_minha.viatura_id = v_viatura.id THEN
      RAISE EXCEPTION 'Você já está em viagem com esta viatura — bipe para ENCERRAR.' USING ERRCODE = 'P0004';
    END IF;
    RAISE EXCEPTION 'Você já está em viagem com outra viatura. Encerre-a antes de iniciar esta.' USING ERRCODE = 'P0003';
  END IF;

  -- o carro está com alguém?
  SELECT * INTO v_aberta FROM public.viagens_viatura v WHERE v.viatura_id = v_viatura.id AND v.chegada_em IS NULL;
  IF FOUND THEN
    IF NOT COALESCE(_assumir, false) THEN
      RAISE EXCEPTION 'A % está em uso por outra pessoa desde %. Se o carro está com você, assuma a viatura.',
        v_viatura.apelido, to_char(v_aberta.saida_em AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI')
        USING ERRCODE = 'P0005';
    END IF;
    -- R269: a viagem do colega encerra com o km que EU digitei, marcada como assumida
    UPDATE public.viagens_viatura
       SET chegada_em = now(), km_chegada = _km_saida,
           aviso_chegada = (_km_saida < km_saida),
           encerramento = 'assumida', encerrada_por = v_uid
     WHERE id = v_aberta.id;
    v_assumida := v_aberta.tecnico_id;
  END IF;

  -- R268: o aviso — o último km de chegada desta viatura
  SELECT v.km_chegada INTO v_ultimo
    FROM public.viagens_viatura v
   WHERE v.viatura_id = v_viatura.id AND v.chegada_em IS NOT NULL
   ORDER BY v.chegada_em DESC LIMIT 1;
  v_aviso := v_ultimo IS NOT NULL AND _km_saida < v_ultimo;

  INSERT INTO public.viagens_viatura (viatura_id, tecnico_id, chamado_id, km_saida, aviso_saida)
  VALUES (v_viatura.id, v_uid, _chamado_id, _km_saida, v_aviso)
  RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, v_aviso, v_assumida, v_ultimo;
END
$u134a$;
REVOKE EXECUTE ON FUNCTION public.viatura_iniciar_viagem(text, integer, uuid, boolean) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.viatura_iniciar_viagem(text, integer, uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.viatura_encerrar_viagem(_viagem_id uuid, _km_chegada integer)
RETURNS TABLE (km_rodados integer, aviso_chegada boolean, minutos integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $u134b$
DECLARE
  v_uid    uuid := auth.uid();
  v        public.viagens_viatura%ROWTYPE;
  v_aviso  boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Faça login para registrar a viatura.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.eh_tecnico(v_uid) THEN
    RAISE EXCEPTION 'Só quem tem cargo técnico registra viagem de viatura (R266).' USING ERRCODE = '42501';
  END IF;
  IF _km_chegada IS NULL OR _km_chegada < 0 THEN
    RAISE EXCEPTION 'Informe o km que o painel mostra.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v FROM public.viagens_viatura WHERE id = _viagem_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Viagem não encontrada.' USING ERRCODE = 'P0002';
  END IF;
  IF v.chegada_em IS NOT NULL THEN
    RAISE EXCEPTION 'Esta viagem já foi encerrada.' USING ERRCODE = 'P0004';
  END IF;
  IF v.tecnico_id <> v_uid THEN
    RAISE EXCEPTION 'Só quem iniciou a viagem a encerra — ou a gestão, pela folha.' USING ERRCODE = '42501';
  END IF;

  v_aviso := _km_chegada < v.km_saida;   -- R268: passa, e fica marcado
  UPDATE public.viagens_viatura
     SET chegada_em = now(), km_chegada = _km_chegada, aviso_chegada = v_aviso,
         encerramento = 'normal', encerrada_por = v_uid
   WHERE id = _viagem_id;

  RETURN QUERY SELECT GREATEST(0, _km_chegada - v.km_saida), v_aviso,
                      (EXTRACT(EPOCH FROM (now() - v.saida_em)) / 60)::integer;
END
$u134b$;
REVOKE EXECUTE ON FUNCTION public.viatura_encerrar_viagem(uuid, integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.viatura_encerrar_viagem(uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.viatura_corrigir_viagem(
  _viagem_id uuid,
  _km_saida integer DEFAULT NULL,
  _km_chegada integer DEFAULT NULL,
  _chegada_em timestamptz DEFAULT NULL,
  _observacao text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $u134c$
DECLARE
  v_uid         uuid := auth.uid();
  v             public.viagens_viatura%ROWTYPE;
  n_km_saida    integer;
  n_km_chegada  integer;
  n_chegada_em  timestamptz;
  n_ultimo      integer;
BEGIN
  IF v_uid IS NULL OR NOT public.is_gestor(v_uid) THEN
    RAISE EXCEPTION 'Só a gestão corrige uma viagem (R268).' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.viagens_viatura WHERE id = _viagem_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Viagem não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  n_km_saida   := COALESCE(_km_saida, v.km_saida);
  n_km_chegada := COALESCE(_km_chegada, v.km_chegada);
  n_chegada_em := COALESCE(_chegada_em, v.chegada_em, CASE WHEN _km_chegada IS NOT NULL THEN now() END);
  IF (n_chegada_em IS NULL) <> (n_km_chegada IS NULL) THEN
    RAISE EXCEPTION 'Para encerrar pela folha, informe o km de chegada.' USING ERRCODE = '22023';
  END IF;
  IF n_km_saida < 0 OR (n_km_chegada IS NOT NULL AND n_km_chegada < 0) THEN
    RAISE EXCEPTION 'Km não pode ser negativo.' USING ERRCODE = '22023';
  END IF;

  -- o aviso de saída se recalcula contra o último km de chegada ANTERIOR a esta viagem
  SELECT p.km_chegada INTO n_ultimo
    FROM public.viagens_viatura p
   WHERE p.viatura_id = v.viatura_id AND p.id <> v.id
     AND p.chegada_em IS NOT NULL AND p.chegada_em < v.saida_em
   ORDER BY p.chegada_em DESC LIMIT 1;

  UPDATE public.viagens_viatura
     SET km_saida      = n_km_saida,
         km_chegada    = n_km_chegada,
         chegada_em    = n_chegada_em,
         aviso_saida   = (n_ultimo IS NOT NULL AND n_km_saida < n_ultimo),
         aviso_chegada = (n_km_chegada IS NOT NULL AND n_km_chegada < n_km_saida),
         encerramento  = CASE WHEN n_chegada_em IS NULL THEN 'aberta'
                              WHEN v.encerramento = 'aberta' THEN 'gestor'
                              ELSE v.encerramento END,
         encerrada_por = CASE WHEN n_chegada_em IS NOT NULL AND v.encerrada_por IS NULL THEN v_uid ELSE v.encerrada_por END,
         observacao    = COALESCE(_observacao, observacao),
         corrigida_por = v_uid,
         corrigida_em  = now()
   WHERE id = _viagem_id;
END
$u134c$;
REVOKE EXECUTE ON FUNCTION public.viatura_corrigir_viagem(uuid, integer, integer, timestamptz, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.viatura_corrigir_viagem(uuid, integer, integer, timestamptz, text) TO authenticated;

COMMIT;

-- ── §5  PORTÃO (numa transação própria que termina em ROLLBACK) ────────────
-- Testa as INVARIANTES pela tabela (as portas exigem auth.uid(), que o SQL
-- Editor não tem). Nada do que ele escreve sobrevive.
BEGIN;
DO $u134portao$
DECLARE
  v_viatura uuid;
  v_pessoa  uuid;
  v_a       uuid;
BEGIN
  SELECT id INTO v_pessoa FROM public.profiles ORDER BY created_at LIMIT 1;
  IF v_pessoa IS NULL THEN
    RAISE NOTICE 'U134 PORTÃO: sem profiles no banco — portão pulado.';
    RETURN;
  END IF;

  INSERT INTO public.viaturas (codigo, placa, apelido) VALUES ('portao-u134', 'ZZZ-0000', 'Portão U134 — apagar')
  RETURNING id INTO v_viatura;

  -- 1) uma viagem aberta
  INSERT INTO public.viagens_viatura (viatura_id, tecnico_id, km_saida) VALUES (v_viatura, v_pessoa, 1000)
  RETURNING id INTO v_a;

  -- 2) a SEGUNDA aberta na mesma viatura tem de ser recusada (R269)
  BEGIN
    INSERT INTO public.viagens_viatura (viatura_id, tecnico_id, km_saida) VALUES (v_viatura, v_pessoa, 1001);
    RAISE EXCEPTION 'U134 PORTÃO 1: duas viagens abertas na mesma viatura foram aceitas.';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  -- 3) chegada sem km de chegada tem de ser recusada
  BEGIN
    UPDATE public.viagens_viatura SET chegada_em = now() WHERE id = v_a;
    RAISE EXCEPTION 'U134 PORTÃO 2: chegada sem km de chegada foi aceita.';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  -- 4) encerrar de verdade: chegada + km + encerramento coerente
  UPDATE public.viagens_viatura SET chegada_em = now(), km_chegada = 1023, encerramento = 'normal' WHERE id = v_a;
  IF (SELECT km_chegada - km_saida FROM public.viagens_viatura WHERE id = v_a) <> 23 THEN
    RAISE EXCEPTION 'U134 PORTÃO 3: km rodados deveria ser 23.';
  END IF;

  -- 5) "aberta" com chegada preenchida tem de ser recusada
  BEGIN
    UPDATE public.viagens_viatura SET encerramento = 'aberta' WHERE id = v_a;
    RAISE EXCEPTION 'U134 PORTÃO 4: encerramento=aberta com chegada foi aceito.';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  -- 6) as portas recusam quem não está logado (auth.uid() é NULL aqui)
  BEGIN
    PERFORM public.viatura_corrigir_viagem(v_a, 999);
    RAISE EXCEPTION 'U134 PORTÃO 5: corrigir sem login foi aceito.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  RAISE NOTICE 'U134 PORTÃO: ok — uma aberta por viatura, chegada completa, encerramento coerente, portas fechadas sem login.';
END
$u134portao$;
ROLLBACK;

-- ── CONFERÊNCIA (obtido × esperado × veredito) ──────────────────────────────
WITH conferencia AS (
  SELECT 'R266: as três tabelas existem' AS item,
         ((to_regclass('public.viaturas') IS NOT NULL) AND (to_regclass('public.viagens_viatura') IS NOT NULL)
          AND (to_regclass('public.locais_de_referencia') IS NOT NULL))::text AS obtido,
         'true' AS esperado
  UNION ALL
  SELECT 'R269: os dois índices únicos parciais (uma aberta por viatura, uma por técnico)',
         (SELECT count(*)::text FROM pg_indexes WHERE schemaname = 'public'
           AND indexname IN ('viagens_uma_aberta_por_viatura', 'viagens_uma_aberta_por_tecnico')), '2'
  UNION ALL
  SELECT 'R266/R268/R269: as três portas existem e são SECURITY DEFINER',
         (SELECT count(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.prosecdef
             AND p.proname IN ('viatura_iniciar_viagem', 'viatura_encerrar_viagem', 'viatura_corrigir_viagem')), '3'
  UNION ALL
  SELECT 'anon NÃO executa nenhuma das três',
         (has_function_privilege('anon', 'public.viatura_iniciar_viagem(text, integer, uuid, boolean)', 'EXECUTE')
          OR has_function_privilege('anon', 'public.viatura_encerrar_viagem(uuid, integer)', 'EXECUTE')
          OR has_function_privilege('anon', 'public.viatura_corrigir_viagem(uuid, integer, integer, timestamptz, text)', 'EXECUTE'))::text, 'false'
  UNION ALL
  SELECT 'R266: a porta de iniciar exige cargo técnico (eh_tecnico) e a de corrigir exige gestão (is_gestor)',
         ((pg_get_functiondef('public.viatura_iniciar_viagem(text, integer, uuid, boolean)'::regprocedure) LIKE '%eh_tecnico(v_uid)%')
          AND (pg_get_functiondef('public.viatura_corrigir_viagem(uuid, integer, integer, timestamptz, text)'::regprocedure) LIKE '%is_gestor(v_uid)%'))::text, 'true'
  UNION ALL
  SELECT 'R269: assumir encerra a do colega como ''assumida'' com o km digitado',
         (pg_get_functiondef('public.viatura_iniciar_viagem(text, integer, uuid, boolean)'::regprocedure) LIKE '%encerramento = ''assumida''%')::text, 'true'
  UNION ALL
  SELECT 'viagens_viatura: nenhuma policy de escrita pela tabela (só as portas escrevem)',
         (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'public' AND tablename = 'viagens_viatura' AND cmd <> 'SELECT'), '0'
  UNION ALL
  SELECT 'R274: a sede existe com coordenada',
         (SELECT (latitude IS NOT NULL AND longitude IS NOT NULL)::text FROM public.locais_de_referencia WHERE codigo = 'sede'), 'true'
  UNION ALL
  SELECT 'o portão não deixou sujeira',
         (SELECT count(*)::text FROM public.viaturas WHERE codigo = 'portao-u134'), '0'
  UNION ALL
  SELECT 'quantas viaturas cadastradas até agora (o Davi cadastra na aba Viaturas)',
         (SELECT count(*)::text FROM public.viaturas WHERE ativa), '>>> LEIA <<<'
)
SELECT item, obtido, esperado,
       CASE WHEN esperado = '>>> LEIA <<<' THEN 'leia'
            WHEN obtido IS NOT DISTINCT FROM esperado THEN 'ok' ELSE '>>> OLHAR <<<' END AS veredito
  FROM conferencia;

-- ── DESFAZER ────────────────────────────────────────────────────────────────
-- Apaga as viagens JUNTO (a FK é RESTRICT de propósito — a ordem importa):
--
--   DROP FUNCTION IF EXISTS public.viatura_corrigir_viagem(uuid, integer, integer, timestamptz, text);
--   DROP FUNCTION IF EXISTS public.viatura_encerrar_viagem(uuid, integer);
--   DROP FUNCTION IF EXISTS public.viatura_iniciar_viagem(text, integer, uuid, boolean);
--   DROP TABLE IF EXISTS public.viagens_viatura;
--   DROP TABLE IF EXISTS public.viaturas;
--   DROP TABLE IF EXISTS public.locais_de_referencia;
--
-- Se já houver viagem registrada de verdade, NÃO desfaça — as linhas são o
-- registro do que aconteceu; corrija pela folha.
