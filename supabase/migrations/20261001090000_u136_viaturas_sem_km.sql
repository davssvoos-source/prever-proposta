-- ═══════════════════════════════════════════════════════════════════════════
-- U136 — AS VIATURAS SEM KM (R276)
--
-- Davi, 13/09/2026, com a U134 já rodada e a primeira viagem já registrada:
--   "Remova a inserção do KM, mudei de ideia, não vamos controlar isso no
--    nosso sistema. Já é controlado no ERP e não tem necessidade de passar
--    isso pro nosso sistema. Quero apenas mapear local e data e com quem
--    estava a viatura."
--
-- É a mesma decisão da R274 sobre abastecimento: o que já é controlado no QAP
-- não se duplica aqui. Some o km — as quatro colunas, o CHECK que amarrava
-- chegada a km de chegada, e os dois avisos da R268 (que existiam só por causa
-- dele). Ficam QUEM (tecnico_id), QUANDO (saida_em / chegada_em), ONDE
-- (chamado_id → o cliente do trecho, e a chegada por localização da R274) e o
-- TEMPO, que é calculado.
--
-- As três portas mudam de ASSINATURA, então é DROP + CREATE: `CREATE OR
-- REPLACE` não muda a lista de argumentos, e deixar a antiga viva seria uma
-- sobrecarga que o PostgREST escolheria pelo nome dos argumentos que o app
-- mandasse — o pior tipo de bug, o silencioso.
--
-- Exige a U134 (as tabelas e as portas) e, por tabela, a U132 (`eh_tecnico`).
-- Rodar duas vezes dá no mesmo.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── §0  PRÉ-VOO ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.viagens_viatura') IS NULL THEN
    RAISE EXCEPTION 'U136 PRÉ-VOO: `viagens_viatura` não existe — rode a U134 antes desta.';
  END IF;
  IF to_regprocedure('public.eh_tecnico(uuid)') IS NULL THEN
    RAISE EXCEPTION 'U136 PRÉ-VOO: `eh_tecnico(uuid)` não existe — rode a U132 antes desta.';
  END IF;
  IF to_regprocedure('public.is_gestor(uuid)') IS NULL THEN
    RAISE EXCEPTION 'U136 PRÉ-VOO: `is_gestor(uuid)` não existe — a etapa 0 não rodou neste banco.';
  END IF;
END
$$;

-- ── §1  AS PORTAS ANTIGAS SAEM ─────────────────────────────────────────────
-- Primeiro as funções, depois as colunas: uma função que referencia a coluna
-- num corpo plpgsql não impede o DROP COLUMN (plpgsql não cria dependência),
-- mas deixar as duas versões vivas por um instante é pior do que a ordem certa.
DROP FUNCTION IF EXISTS public.viatura_iniciar_viagem(text, integer, uuid, boolean);
DROP FUNCTION IF EXISTS public.viatura_encerrar_viagem(uuid, integer);
DROP FUNCTION IF EXISTS public.viatura_corrigir_viagem(uuid, integer, integer, timestamptz, text);

-- ── §2  O KM SAI DA TABELA ─────────────────────────────────────────────────
-- O CHECK primeiro, explícito: o DROP COLUMN levaria junto, mas quem lê a
-- migration merece ver que a amarra "chegada ⇔ km de chegada" foi desfeita de
-- propósito. A que sobra — `viagens_encerramento_coere` — é a que importa
-- agora: "aberta" é exatamente "sem chegada".
ALTER TABLE public.viagens_viatura DROP CONSTRAINT IF EXISTS viagens_chegada_completa;
ALTER TABLE public.viagens_viatura DROP COLUMN IF EXISTS km_saida;
ALTER TABLE public.viagens_viatura DROP COLUMN IF EXISTS km_chegada;
ALTER TABLE public.viagens_viatura DROP COLUMN IF EXISTS aviso_saida;
ALTER TABLE public.viagens_viatura DROP COLUMN IF EXISTS aviso_chegada;

COMMENT ON TABLE public.viagens_viatura IS
  'R267/R269/R276 (U134, U136): um TRECHO por linha — quem, quando, para onde. A duração é calculada na leitura; o km saiu do sistema (fica no QAP ERP). Escrita só pelas portas viatura_iniciar_viagem / viatura_encerrar_viagem / viatura_corrigir_viagem.';

-- ── §3  AS PORTAS NOVAS ────────────────────────────────────────────────────

-- INICIAR: bipou a etiqueta e o carro está livre (ou ele vai assumir).
CREATE OR REPLACE FUNCTION public.viatura_iniciar_viagem(
  _codigo text,
  _chamado_id uuid DEFAULT NULL,
  _assumir boolean DEFAULT false
)
RETURNS TABLE (viagem_id uuid, assumida_de uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $u136a$
DECLARE
  v_uid       uuid := auth.uid();
  v_viatura   public.viaturas%ROWTYPE;
  v_minha     public.viagens_viatura%ROWTYPE;
  v_aberta    public.viagens_viatura%ROWTYPE;
  v_assumida  uuid := NULL;
  v_id        uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Faça login para registrar a viatura.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.eh_tecnico(v_uid) THEN
    RAISE EXCEPTION 'Só quem tem cargo técnico registra viagem de viatura (R266).' USING ERRCODE = '42501';
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
    -- R269/R276: a viagem do colega encerra AGORA (sem km para negociar),
    -- marcada como assumida, e a minha começa daqui.
    UPDATE public.viagens_viatura
       SET chegada_em = now(), encerramento = 'assumida', encerrada_por = v_uid
     WHERE id = v_aberta.id;
    v_assumida := v_aberta.tecnico_id;
  END IF;

  INSERT INTO public.viagens_viatura (viatura_id, tecnico_id, chamado_id)
  VALUES (v_viatura.id, v_uid, _chamado_id)
  RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, v_assumida;
END
$u136a$;
REVOKE EXECUTE ON FUNCTION public.viatura_iniciar_viagem(text, uuid, boolean) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.viatura_iniciar_viagem(text, uuid, boolean) TO authenticated;
COMMENT ON FUNCTION public.viatura_iniciar_viagem(text, uuid, boolean) IS
  'R266/R269/R276 (U136): abre o trecho. Só cargo técnico. P0005 = o carro está com outra pessoa (a tela oferece assumir).';

-- ENCERRAR: bipou de novo, ou tocou "Encerrar" na faixa da Início.
CREATE OR REPLACE FUNCTION public.viatura_encerrar_viagem(_viagem_id uuid)
RETURNS TABLE (minutos integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $u136b$
DECLARE
  v_uid  uuid := auth.uid();
  v      public.viagens_viatura%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Faça login para registrar a viatura.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.eh_tecnico(v_uid) THEN
    RAISE EXCEPTION 'Só quem tem cargo técnico registra viagem de viatura (R266).' USING ERRCODE = '42501';
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

  UPDATE public.viagens_viatura
     SET chegada_em = now(), encerramento = 'normal', encerrada_por = v_uid
   WHERE id = _viagem_id;

  RETURN QUERY SELECT (EXTRACT(EPOCH FROM (now() - v.saida_em)) / 60)::integer;
END
$u136b$;
REVOKE EXECUTE ON FUNCTION public.viatura_encerrar_viagem(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.viatura_encerrar_viagem(uuid) TO authenticated;
COMMENT ON FUNCTION public.viatura_encerrar_viagem(uuid) IS
  'R266/R276 (U136): fecha o trecho. Só quem iniciou; a gestão fecha pela folha (viatura_corrigir_viagem).';

-- CORRIGIR: a viagem que o técnico esqueceu aberta — a gestão fecha, com rastro.
CREATE OR REPLACE FUNCTION public.viatura_corrigir_viagem(
  _viagem_id uuid,
  _chegada_em timestamptz DEFAULT NULL,
  _observacao text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $u136c$
DECLARE
  v_uid         uuid := auth.uid();
  v             public.viagens_viatura%ROWTYPE;
  n_chegada_em  timestamptz;
BEGIN
  IF v_uid IS NULL OR NOT public.is_gestor(v_uid) THEN
    RAISE EXCEPTION 'Só a gestão corrige uma viagem (R276).' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.viagens_viatura WHERE id = _viagem_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Viagem não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  n_chegada_em := COALESCE(_chegada_em, v.chegada_em);
  IF n_chegada_em IS NOT NULL AND n_chegada_em < v.saida_em THEN
    RAISE EXCEPTION 'A chegada não pode ser anterior à saída (%).',
      to_char(v.saida_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI') USING ERRCODE = '22023';
  END IF;
  IF n_chegada_em IS NOT NULL AND n_chegada_em > now() + interval '1 minute' THEN
    RAISE EXCEPTION 'A chegada não pode estar no futuro.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.viagens_viatura
     SET chegada_em   = n_chegada_em,
         -- só carimba "gestor" quando é ELA que está fechando a viagem; uma
         -- observação numa viagem já encerrada não reescreve quem a encerrou
         encerramento = CASE WHEN v.chegada_em IS NULL AND n_chegada_em IS NOT NULL THEN 'gestor' ELSE v.encerramento END,
         encerrada_por = CASE WHEN v.chegada_em IS NULL AND n_chegada_em IS NOT NULL THEN v_uid ELSE v.encerrada_por END,
         observacao   = COALESCE(_observacao, v.observacao),
         corrigida_por = v_uid,
         corrigida_em  = now()
   WHERE id = _viagem_id;
END
$u136c$;
REVOKE EXECUTE ON FUNCTION public.viatura_corrigir_viagem(uuid, timestamptz, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.viatura_corrigir_viagem(uuid, timestamptz, text) TO authenticated;
COMMENT ON FUNCTION public.viatura_corrigir_viagem(uuid, timestamptz, text) IS
  'R276 (U136): a gestão encerra a viagem deixada aberta (encerramento = gestor) e registra observação. Grava corrigida_por/em.';

-- ── §4  CONFERÊNCIA ────────────────────────────────────────────────────────
WITH conferencia AS (
  SELECT 1 AS n, 'as quatro colunas de km sumiram de viagens_viatura' AS o_que,
         (SELECT count(*) FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'viagens_viatura'
             AND column_name IN ('km_saida', 'km_chegada', 'aviso_saida', 'aviso_chegada'))::text AS obtido,
         '0' AS esperado
  UNION ALL SELECT 2, 'o CHECK que amarrava chegada ao km de chegada saiu',
         (SELECT count(*) FROM pg_constraint WHERE conname = 'viagens_chegada_completa')::text, '0'
  UNION ALL SELECT 3, 'o CHECK de coerência do encerramento continua',
         (SELECT count(*) FROM pg_constraint WHERE conname = 'viagens_encerramento_coere')::text, '1'
  UNION ALL SELECT 4, 'as duas invariantes da R269 continuam (uma aberta por viatura, uma por técnico)',
         (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public'
           AND indexname IN ('viagens_uma_aberta_por_viatura', 'viagens_uma_aberta_por_tecnico'))::text, '2'
  UNION ALL SELECT 5, 'as portas ANTIGAS (com km) não existem mais',
         (CASE WHEN to_regprocedure('public.viatura_iniciar_viagem(text, integer, uuid, boolean)') IS NULL
                AND to_regprocedure('public.viatura_encerrar_viagem(uuid, integer)') IS NULL
                AND to_regprocedure('public.viatura_corrigir_viagem(uuid, integer, integer, timestamptz, text)') IS NULL
               THEN 'sim' ELSE 'NÃO' END), 'sim'
  UNION ALL SELECT 6, 'as portas NOVAS (sem km) existem',
         (CASE WHEN to_regprocedure('public.viatura_iniciar_viagem(text, uuid, boolean)') IS NOT NULL
                AND to_regprocedure('public.viatura_encerrar_viagem(uuid)') IS NOT NULL
                AND to_regprocedure('public.viatura_corrigir_viagem(uuid, timestamptz, text)') IS NOT NULL
               THEN 'sim' ELSE 'NÃO' END), 'sim'
  UNION ALL SELECT 7, 'iniciar e encerrar continuam com o gate de cargo técnico',
         ((SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname IN ('viatura_iniciar_viagem', 'viatura_encerrar_viagem')
              AND pg_get_functiondef(p.oid) LIKE '%eh_tecnico(v_uid)%'))::text, '2'
  UNION ALL SELECT 8, 'corrigir continua exigindo a gestão',
         ((SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = 'viatura_corrigir_viagem'
              AND pg_get_functiondef(p.oid) LIKE '%is_gestor(v_uid)%'))::text, '1'
  UNION ALL SELECT 9, 'ninguém escreve viagem pela tabela (só SELECT tem policy)',
         (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'viagens_viatura' AND cmd <> 'SELECT')::text, '0'
  UNION ALL SELECT 10, 'viagens já registradas (nenhuma se perdeu ao tirar as colunas)',
         (SELECT count(*) FROM public.viagens_viatura)::text, '(informativo)'
)
SELECT n, o_que, obtido, esperado,
       CASE WHEN esperado = '(informativo)' THEN 'ok' WHEN obtido = esperado THEN 'ok' ELSE '>>> OLHAR <<<' END AS veredito
FROM conferencia ORDER BY n;

-- ═══════════════════════════════════════════════════════════════════════════
-- PORTÃO — roda numa transação PRÓPRIA que termina em ROLLBACK: prova as
-- invariantes com dados de mentira e não deixa nada para trás.
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;
DO $u136portao$
DECLARE
  v_viatura uuid;
  v_tecnico uuid;
  v_viagem  uuid;
BEGIN
  -- um perfil que NÃO tenha viagem aberta: com um que tenha, o índice único
  -- por técnico recusaria a linha 1 e o portão acusaria um defeito que não há
  SELECT p.id INTO v_tecnico FROM public.profiles p
   WHERE NOT EXISTS (SELECT 1 FROM public.viagens_viatura v WHERE v.tecnico_id = p.id AND v.chegada_em IS NULL)
   LIMIT 1;
  IF v_tecnico IS NULL THEN
    RAISE NOTICE 'U136 PORTÃO: sem perfil livre neste banco — portão pulado.';
    RETURN;
  END IF;

  INSERT INTO public.viaturas (codigo, placa, apelido)
  VALUES ('portao-u136', 'ZZZ-9Z99', 'Portão U136') RETURNING id INTO v_viatura;

  -- 1) uma viagem nasce SEM km: se alguma coluna de km tivesse sobrado com
  --    NOT NULL, este INSERT falharia aqui
  INSERT INTO public.viagens_viatura (viatura_id, tecnico_id)
  VALUES (v_viatura, v_tecnico) RETURNING id INTO v_viagem;

  -- 2) a segunda aberta na MESMA viatura tem de ser recusada
  BEGIN
    INSERT INTO public.viagens_viatura (viatura_id, tecnico_id) VALUES (v_viatura, v_tecnico);
    RAISE EXCEPTION 'U136 PORTÃO 2: duas viagens abertas na mesma viatura foram aceitas.';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  -- 3) chegada sem trocar o encerramento tem de ser recusada
  BEGIN
    UPDATE public.viagens_viatura SET chegada_em = now() WHERE id = v_viagem;
    RAISE EXCEPTION 'U136 PORTÃO 3: encerramento=aberta com chegada foi aceito.';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  -- 4) encerrar de verdade (chegada + encerramento juntos) tem de passar
  UPDATE public.viagens_viatura
     SET chegada_em = now(), encerramento = 'normal' WHERE id = v_viagem;

  -- 5) a porta de corrigir recusa quem não é gestão (aqui não há auth.uid())
  BEGIN
    PERFORM public.viatura_corrigir_viagem(v_viagem, now(), NULL);
    RAISE EXCEPTION 'U136 PORTÃO 5: corrigir sem login foi aceito.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  RAISE NOTICE 'U136 PORTÃO: ok — viagem sem km, uma aberta por viatura, encerramento coerente, corrigir fechado sem login.';
END
$u136portao$;
ROLLBACK;

-- ═══════════════════════════════════════════════════════════════════════════
-- DESFAZER (cole num editor e rode, se precisar voltar)
--
--   As colunas voltam VAZIAS: o km que existia foi apagado com o DROP COLUMN e
--   não há de onde recuperá-lo — é dado, não estrutura. Se a volta for mesmo
--   necessária, rode isto e depois a U134 inteira de novo (ela é idempotente e
--   recria as portas antigas):
--
--   ALTER TABLE public.viagens_viatura ADD COLUMN IF NOT EXISTS km_saida integer NOT NULL DEFAULT 0;
--   ALTER TABLE public.viagens_viatura ADD COLUMN IF NOT EXISTS km_chegada integer;
--   ALTER TABLE public.viagens_viatura ADD COLUMN IF NOT EXISTS aviso_saida boolean NOT NULL DEFAULT false;
--   ALTER TABLE public.viagens_viatura ADD COLUMN IF NOT EXISTS aviso_chegada boolean NOT NULL DEFAULT false;
--   ALTER TABLE public.viagens_viatura ADD CONSTRAINT viagens_chegada_completa CHECK ((chegada_em IS NULL) = (km_chegada IS NULL));
--   DROP FUNCTION IF EXISTS public.viatura_iniciar_viagem(text, uuid, boolean);
--   DROP FUNCTION IF EXISTS public.viatura_encerrar_viagem(uuid);
--   DROP FUNCTION IF EXISTS public.viatura_corrigir_viagem(uuid, timestamptz, text);
--   -- e então rode 20260930090000_u134_viaturas.sql de novo.
-- ═══════════════════════════════════════════════════════════════════════════
