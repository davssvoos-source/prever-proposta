-- ═══════════════════════════════════════════════════════════════════════════
-- U124 — v0.0.6: a visita de um prédio que ainda não é cliente registra uma
-- PROSPECÇÃO com os dados do local (R21/R22) — o app não cria cliente
-- ═══════════════════════════════════════════════════════════════════════════
--
-- O DEFEITO QUE ISTO CONSERTA (Davi, 09/09/2026, ao tentar criar uma proposta:
-- "Erro: new row violates row-level security policy for table clientes").
--
-- A U27 (§6, R21) tirou a policy de INSERT de `clientes` — "o app não cria mais
-- cliente", quem cria é o QAP. Mas a tela Nova Visita Técnica continuou
-- chamando `criarCliente` quando o prédio não tem cadastro: desde 21/08/2026,
-- TODA visita de prédio novo morre na RLS, e com ela a proposta que nasceria
-- dela. A P44 (U84) já havia consertado um segundo defeito no MESMO INSERT (o
-- `situacao: 'prospecto'` fora do CHECK) sem que este aparecesse — o erro é o
-- mesmo INSERT, e o primeiro que estoura esconde o outro.
--
-- O caminho certo já existia no banco desde a U27: `prospeccoes` (R22) e
-- `visitas_tecnicas.prospeccao_id`. Faltava a porta para o app escrever lá com
-- os dados do local.
--
-- POR QUE UMA FUNÇÃO, E NÃO UM INSERT DIRETO:
--   · quem usa a tela é admin, comercial e SAC (permissão `gerencial.nova`),
--     mas `prospeccoes_write` exige `is_gestor` — que é admin/comercial. O SAC
--     insere (policy da U71, WITH CHECK true) e não consegue ATUALIZAR: os
--     dados do local ficariam pelo caminho, em silêncio.
--   · `prospeccoes_select` (U71) mostra a cada um só o que lhe pertence, então
--     uma busca feita pelo app responderia "não existe" para um prédio que
--     existe — e cada visita criaria outra linha do mesmo lugar.
-- SECURITY DEFINER resolve os dois: a função enxerga a tabela inteira para
-- DECIDIR, escreve por quem chamou e devolve só um uuid. É a mesma tese de
-- `achar_ou_criar_prospeccao` (U71), que fica de pé para a triagem da Início.
--
-- NÃO DEGRADA DADO: num prédio que já tem prospecção, só preenche o que está
-- vazio (a mesma regra do `preservar` da consolidação). E o `_dados` é lido
-- COLUNA POR COLUNA — nada de despejar jsonb na tabela: `situacao`,
-- `cliente_id` e `origem` não se escrevem por aqui.
--
-- PRÉ-VOO: exige `prospeccoes` (U27) e `normalizar_texto` (U71). IDEMPOTENTE
-- (CREATE OR REPLACE). Termina com a conferência (>>> OLHAR <<<) e o DESFAZER.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $u124pre$
BEGIN
  IF to_regclass('public.prospeccoes') IS NULL THEN
    RAISE EXCEPTION 'U124: a tabela prospeccoes não existe — rode a U27 primeiro.';
  END IF;
  IF to_regprocedure('public.normalizar_texto(text)') IS NULL THEN
    RAISE EXCEPTION 'U124: normalizar_texto não existe — rode a U71 primeiro.';
  END IF;
END
$u124pre$;

CREATE OR REPLACE FUNCTION public.achar_ou_criar_prospeccao_do_local(
  _nome     text,
  _endereco text DEFAULT NULL,
  _dados    jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $u124f$
DECLARE
  v_nome text := btrim(coalesce(_nome, ''));
  v_end  text := nullif(btrim(coalesce(_endereco, '')), '');
  v_d    jsonb := coalesce(_dados, '{}'::jsonb);
  v_id   uuid;
BEGIN
  IF v_nome = '' THEN
    RAISE EXCEPTION 'R22: uma prospecção precisa do nome do prédio.';
  END IF;

  -- Achar pelo NOME normalizado — a mesma chave da achar_ou_criar_prospeccao
  -- (U71). Endereço não entra na busca porque ele muda de grafia ("R." / "Rua")
  -- muito mais do que o nome do prédio, e duplicar é pior que casar demais:
  -- separar é recuperável, fundir não.
  SELECT id INTO v_id
    FROM public.prospeccoes
   WHERE public.normalizar_texto(nome) = public.normalizar_texto(v_nome)
   ORDER BY created_at
   LIMIT 1;

  IF v_id IS NOT NULL THEN
    -- Só preenche o VAZIO: a prospecção pode ter sido conferida por alguém.
    UPDATE public.prospeccoes p SET
      endereco         = coalesce(p.endereco,         v_end),
      tipo_local       = coalesce(p.tipo_local,       nullif(v_d->>'tipo_local', '')),
      complemento      = coalesce(p.complemento,      nullif(v_d->>'complemento', '')),
      cidade           = coalesce(p.cidade,           nullif(v_d->>'cidade', '')),
      uf               = coalesce(p.uf,               nullif(v_d->>'uf', '')),
      cep              = coalesce(p.cep,              nullif(v_d->>'cep', '')),
      latitude         = coalesce(p.latitude,         (nullif(v_d->>'latitude', ''))::numeric),
      longitude        = coalesce(p.longitude,        (nullif(v_d->>'longitude', ''))::numeric),
      nome_sindico     = coalesce(p.nome_sindico,     nullif(v_d->>'nome_sindico', '')),
      telefone_sindico = coalesce(p.telefone_sindico, nullif(v_d->>'telefone_sindico', '')),
      email_sindico    = coalesce(p.email_sindico,    nullif(v_d->>'email_sindico', '')),
      nome_zelador     = coalesce(p.nome_zelador,     nullif(v_d->>'nome_zelador', '')),
      telefone_zelador = coalesce(p.telefone_zelador, nullif(v_d->>'telefone_zelador', '')),
      email_zelador    = coalesce(p.email_zelador,    nullif(v_d->>'email_zelador', '')),
      qtd_apartamentos = coalesce(p.qtd_apartamentos, (nullif(v_d->>'qtd_apartamentos', ''))::integer),
      observacoes      = coalesce(p.observacoes,      nullif(v_d->>'observacoes', '')),
      foto_fachada_url = coalesce(p.foto_fachada_url, nullif(v_d->>'foto_fachada_url', ''))
     WHERE p.id = v_id;
    RETURN v_id;
  END IF;

  INSERT INTO public.prospeccoes (
    nome, endereco, tipo_local, complemento, cidade, uf, cep, latitude, longitude,
    nome_sindico, telefone_sindico, email_sindico,
    nome_zelador, telefone_zelador, email_zelador,
    qtd_apartamentos, observacoes, foto_fachada_url,
    origem, created_by
  ) VALUES (
    v_nome, v_end,
    nullif(v_d->>'tipo_local', ''), nullif(v_d->>'complemento', ''),
    nullif(v_d->>'cidade', ''), nullif(v_d->>'uf', ''), nullif(v_d->>'cep', ''),
    (nullif(v_d->>'latitude', ''))::numeric, (nullif(v_d->>'longitude', ''))::numeric,
    nullif(v_d->>'nome_sindico', ''), nullif(v_d->>'telefone_sindico', ''), nullif(v_d->>'email_sindico', ''),
    nullif(v_d->>'nome_zelador', ''), nullif(v_d->>'telefone_zelador', ''), nullif(v_d->>'email_zelador', ''),
    (nullif(v_d->>'qtd_apartamentos', ''))::integer,
    nullif(v_d->>'observacoes', ''), nullif(v_d->>'foto_fachada_url', ''),
    'visita_tecnica', auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END
$u124f$;

COMMENT ON FUNCTION public.achar_ou_criar_prospeccao_do_local(text, text, jsonb) IS
  'R21/R22 (U124): o prédio da visita que ainda não é cliente entra como PROSPECÇÃO, com os dados do local. Acha pelo nome normalizado e só preenche o que está vazio. SECURITY DEFINER porque prospeccoes_select mostra a cada um só o que lhe pertence e prospeccoes_write exige is_gestor (o SAC monta visita e não é).';

REVOKE ALL ON FUNCTION public.achar_ou_criar_prospeccao_do_local(text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.achar_ou_criar_prospeccao_do_local(text, text, jsonb) TO authenticated, service_role;

COMMIT;

-- ── CONFERÊNCIA (obtido × esperado × veredito) ──────────────────────────────
WITH conferencia AS (
  SELECT 'R21/R22: a função do local existe, é SECURITY DEFINER e authenticated executa' AS item,
         (SELECT prosecdef::text FROM pg_proc WHERE oid = 'public.achar_ou_criar_prospeccao_do_local(text, text, jsonb)'::regprocedure)
           || '/' || has_function_privilege('authenticated', 'public.achar_ou_criar_prospeccao_do_local(text, text, jsonb)', 'EXECUTE')::text AS obtido,
         'true/true' AS esperado
  UNION ALL
  SELECT 'a função da triagem (U71) continua de pé — são duas portas, cada uma com o seu uso',
         (to_regprocedure('public.achar_ou_criar_prospeccao(text)') IS NOT NULL)::text, 'true'
  UNION ALL
  SELECT 'R21: `clientes` continua SEM policy de INSERT (o app não cria cliente)',
         (SELECT count(*)::text FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'clientes' AND cmd = 'INSERT'), '0'
  UNION ALL
  SELECT 'a visita aponta para UM dos dois (o CHECK da U27 está vivo)',
         (SELECT count(*)::text FROM pg_constraint
           WHERE conrelid = 'public.visitas_tecnicas'::regclass
             AND conname = 'visitas_alvo_unico'), '1'
  UNION ALL
  SELECT 'nenhuma visita com cliente E prospecção ao mesmo tempo',
         (SELECT count(*)::text FROM public.visitas_tecnicas
           WHERE cliente_id IS NOT NULL AND prospeccao_id IS NOT NULL), '0'
  UNION ALL
  SELECT 'toda prospecção desta porta tem nome (o RAISE cobre o vazio)',
         (SELECT count(*)::text FROM public.prospeccoes
           WHERE origem = 'visita_tecnica' AND btrim(coalesce(nome, '')) = ''), '0'
)
SELECT item, obtido, esperado,
       CASE WHEN obtido IS NOT DISTINCT FROM esperado THEN 'ok' ELSE '>>> OLHAR <<<' END AS veredito
  FROM conferencia;

-- ── DESFAZER ────────────────────────────────────────────────────────────────
--   DROP FUNCTION IF EXISTS public.achar_ou_criar_prospeccao_do_local(text, text, jsonb);
--
-- As prospecções criadas por ela FICAM (são o registro do funil, R22) e as
-- visitas continuam apontando para elas. Sem a função, a tela volta a avisar
-- que o prédio novo precisa da U124 — não volta a tentar criar cliente.
