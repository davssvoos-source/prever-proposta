-- ═══════════════════════════════════════════════════════════════════════════
-- U71 — EQUIPES REVISADAS, MÚLTIPLAS EQUIPES E O LOCAL QUE PODE NÃO SER CLIENTE
--        (R80–R85)
--
-- Davi, 2026-08-26:
--   "Remova as equipes: Audiovisual e Business Ops, e adicione a opção
--    'Outras'."
--   "Vamos considerar que mais de uma equipe pode fazer parte da mesma
--    atividade. Em uma atividade de 'Proposta Comercial' por exemplo, o
--    técnico é responsável pela visita técnica, enquanto a equipe comercial é
--    responsável pela proposta em si."
--   "A etiqueta de cliente na verdade seria uma etiqueta de LOCAL, este tempo
--    todo estávamos usando a palavra errada. Então o Local pode SER OU NÃO SER
--    nosso cliente."
--   "adicione a opção de colocar clientes na atividade sem limite de clientes,
--    e atalhos para agregar a um setor inteiro"
--
-- TRÊS MUDANÇAS, nesta ordem. Idempotente. SELECTs de conferência no fim,
-- comando de DESFAZER no rodapé.
--
-- ── Sobre o momento ────────────────────────────────────────────────────────
-- A U69 esvaziou `chamados` e `visitas_tecnicas`. Portanto `chamado_clientes`
-- (CASCADE de chamados) também está vazia, e a parte 3 desta migration move
-- ZERO linhas. Se você estiver rodando isto num banco que já voltou a ter
-- chamados, a cópia continua correta — ela é um INSERT..SELECT idempotente,
-- não um "confie que está vazio".
--
-- ── Por que LOCAL e não "cliente" ──────────────────────────────────────────
-- R21 continua de pé: o app NÃO cria cliente, o QAP é quem manda. O que muda é
-- o vocabulário e o alcance. Um LOCAL é o lugar onde a atividade acontece, e
-- ele tem três formas possíveis:
--
--   1. um CLIENTE da base (veio do QAP)
--   2. uma PROSPECÇÃO (prédio que orçamos e que não é nosso cliente — R22)
--   3. um SETOR inteiro ("todos os clientes de Portaria Remota")
--
-- A forma 3 é uma ETIQUETA, não a expansão em 80 linhas: "Enviar relatórios de
-- acessos dos clientes de Portaria Remota" é UMA atividade com UM rótulo, não
-- uma atividade com oitenta chips. Quem precisar da lista expande na leitura,
-- por `clientes.servicos_prestados`.
-- ═══════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- 1. AS EQUIPES: sai Audiovisual e Business Ops, entra "Outras"
-- ════════════════════════════════════════════════════════════════════════════
--
-- O destino de quem já estava nas duas que saem NÃO é arbitrário:
--   audiovisual  → comercial  (é a regra nova do Davi: material visual,
--                              comunicação e proposta são da equipe comercial)
--   business_ops → outras     (administrativo/RH/processo não tem casa nova)
--
-- `chamados` está vazia, mas `profiles` NÃO foi tocada pela U69 — lá o UPDATE
-- tem trabalho de verdade. Os dois rodam do mesmo jeito: idempotentes.

UPDATE public.chamados SET equipe = 'comercial' WHERE equipe = 'audiovisual';
UPDATE public.chamados SET equipe = 'outras'    WHERE equipe = 'business_ops';

UPDATE public.profiles SET equipe = 'comercial' WHERE equipe = 'audiovisual';
UPDATE public.profiles SET equipe = 'outras'    WHERE equipe = 'business_ops';

ALTER TABLE public.chamados DROP CONSTRAINT IF EXISTS chamados_equipe_check;
ALTER TABLE public.chamados ADD CONSTRAINT chamados_equipe_check
  CHECK (equipe IN ('ti','patrimonio','tecnica','comercial','sac',
                    'monitoramento','outras'));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_equipe_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_equipe_check
  CHECK (equipe IS NULL OR equipe IN ('ti','patrimonio','tecnica','comercial',
                                      'sac','monitoramento','outras'));

-- `demandas` é tabela MORTA desde a U7 (que absorveu tudo em `chamados`), mas
-- o CHECK dela ainda cita as duas equipes que saem. Deixá-lo divergente é
-- convite para alguém "consertar" a tabela viva pelo espelho errado.
DO $$
BEGIN
  IF to_regclass('public.demandas') IS NOT NULL THEN
    UPDATE public.demandas SET equipe = 'comercial' WHERE equipe = 'audiovisual';
    UPDATE public.demandas SET equipe = 'outras'    WHERE equipe = 'business_ops';
    ALTER TABLE public.demandas DROP CONSTRAINT IF EXISTS demandas_equipe_check;
    ALTER TABLE public.demandas ADD CONSTRAINT demandas_equipe_check
      CHECK (equipe IN ('ti','patrimonio','tecnica','comercial','sac',
                        'monitoramento','outras'));
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. MAIS DE UMA EQUIPE POR ATIVIDADE
-- ════════════════════════════════════════════════════════════════════════════
--
-- Mesmo desenho ADITIVO da U45: `chamados.equipe` continua sendo a equipe
-- PRINCIPAL e não muda de tipo nem de semântica — toda leitura que hoje só
-- conhece uma equipe (filtro do dashboard, coluna da tabela, roteamento)
-- continua funcionando sem tocar numa linha. Esta tabela guarda só as equipes
-- ALÉM da principal, então atividade de uma equipe só não ganha linha aqui.
--
-- A lista canônica é sempre [equipe, ...extras], montada na leitura.

CREATE TABLE IF NOT EXISTS public.chamado_equipes (
  chamado_id uuid NOT NULL REFERENCES public.chamados(id) ON DELETE CASCADE,
  equipe     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chamado_id, equipe)
);

ALTER TABLE public.chamado_equipes DROP CONSTRAINT IF EXISTS chamado_equipes_equipe_check;
ALTER TABLE public.chamado_equipes ADD CONSTRAINT chamado_equipes_equipe_check
  CHECK (equipe IN ('ti','patrimonio','tecnica','comercial','sac',
                    'monitoramento','outras'));

CREATE INDEX IF NOT EXISTS chamado_equipes_equipe_idx
  ON public.chamado_equipes (equipe);

ALTER TABLE public.chamado_equipes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.chamado_equipes TO authenticated;
GRANT ALL ON public.chamado_equipes TO service_role;

DROP POLICY IF EXISTS "chamado_equipes_select" ON public.chamado_equipes;
DROP POLICY IF EXISTS "chamado_equipes_insert" ON public.chamado_equipes;
DROP POLICY IF EXISTS "chamado_equipes_delete" ON public.chamado_equipes;

CREATE POLICY "chamado_equipes_select" ON public.chamado_equipes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "chamado_equipes_insert" ON public.chamado_equipes
  FOR INSERT TO authenticated WITH CHECK (public.pode_editar_chamado(chamado_id));
CREATE POLICY "chamado_equipes_delete" ON public.chamado_equipes
  FOR DELETE TO authenticated USING (public.pode_editar_chamado(chamado_id));

-- ════════════════════════════════════════════════════════════════════════════
-- 3. O LOCAL — cliente, prospecção ou setor inteiro
-- ════════════════════════════════════════════════════════════════════════════
--
-- Substitui `chamado_clientes` (U45), que só sabia falar de cliente. A linha
-- aponta para EXATAMENTE UMA das três formas — o CHECK com num_nonnulls
-- garante isso no banco, não na confiança da aplicação.
--
-- `chamados.cliente_id` continua sendo o local PRINCIPAL quando ele é cliente,
-- exatamente como a U45 deixou. Nada em cobrança, matching ou relatório muda.

CREATE TABLE IF NOT EXISTS public.chamado_locais (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id    uuid NOT NULL REFERENCES public.chamados(id)    ON DELETE CASCADE,

  -- forma 1: cliente da base (QAP)
  cliente_id    uuid REFERENCES public.clientes(id)    ON DELETE CASCADE,
  -- forma 2: prospecção — o local que NÃO é nosso cliente (R22)
  prospeccao_id uuid REFERENCES public.prospeccoes(id) ON DELETE CASCADE,
  -- forma 3: um setor de serviço inteiro, como ETIQUETA
  setor         text,

  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chamado_locais_uma_forma
    CHECK (num_nonnulls(cliente_id, prospeccao_id, setor) = 1),
  CONSTRAINT chamado_locais_setor_check
    CHECK (setor IS NULL OR setor IN ('portaria_remota','monitoramento_alarmes'))
);

-- Sem duplicata em nenhuma das três formas. Índices parciais únicos, porque
-- UNIQUE(chamado_id, cliente_id, prospeccao_id, setor) não serve: em SQL,
-- NULL nunca é igual a NULL, então a mesma etiqueta entraria duas vezes.
CREATE UNIQUE INDEX IF NOT EXISTS chamado_locais_cliente_unico
  ON public.chamado_locais (chamado_id, cliente_id)    WHERE cliente_id    IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS chamado_locais_prospeccao_unico
  ON public.chamado_locais (chamado_id, prospeccao_id) WHERE prospeccao_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS chamado_locais_setor_unico
  ON public.chamado_locais (chamado_id, setor)         WHERE setor         IS NOT NULL;

CREATE INDEX IF NOT EXISTS chamado_locais_chamado_idx    ON public.chamado_locais (chamado_id);
CREATE INDEX IF NOT EXISTS chamado_locais_cliente_idx    ON public.chamado_locais (cliente_id);
CREATE INDEX IF NOT EXISTS chamado_locais_prospeccao_idx ON public.chamado_locais (prospeccao_id);

ALTER TABLE public.chamado_locais ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.chamado_locais TO authenticated;
GRANT ALL ON public.chamado_locais TO service_role;

DROP POLICY IF EXISTS "chamado_locais_select" ON public.chamado_locais;
DROP POLICY IF EXISTS "chamado_locais_insert" ON public.chamado_locais;
DROP POLICY IF EXISTS "chamado_locais_delete" ON public.chamado_locais;

CREATE POLICY "chamado_locais_select" ON public.chamado_locais
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "chamado_locais_insert" ON public.chamado_locais
  FOR INSERT TO authenticated WITH CHECK (public.pode_editar_chamado(chamado_id));
CREATE POLICY "chamado_locais_delete" ON public.chamado_locais
  FOR DELETE TO authenticated USING (public.pode_editar_chamado(chamado_id));

-- ── Traz o que existia em chamado_clientes ──────────────────────────────────
-- Hoje são zero linhas (U69). O INSERT existe para a migration continuar
-- correta se rodar num banco que já voltou a ter dados.
DO $$
BEGIN
  IF to_regclass('public.chamado_clientes') IS NOT NULL THEN
    INSERT INTO public.chamado_locais (chamado_id, cliente_id, created_at)
    SELECT cc.chamado_id, cc.cliente_id, cc.created_at
      FROM public.chamado_clientes cc
     WHERE NOT EXISTS (
       SELECT 1 FROM public.chamado_locais cl
        WHERE cl.chamado_id = cc.chamado_id
          AND cl.cliente_id = cc.cliente_id
     );

    -- Só derruba a antiga depois de conferir que TUDO atravessou. Se algo
    -- ficou para trás, a migration aborta com a tabela velha intacta — perder
    -- vínculo de local é pior do que ter duas tabelas por mais um dia.
    IF EXISTS (
      SELECT 1 FROM public.chamado_clientes cc
       WHERE NOT EXISTS (
         SELECT 1 FROM public.chamado_locais cl
          WHERE cl.chamado_id = cc.chamado_id AND cl.cliente_id = cc.cliente_id
       )
    ) THEN
      RAISE EXCEPTION 'U71: sobrou linha em chamado_clientes sem par em chamado_locais — nada foi derrubado, investigue';
    END IF;

    DROP TABLE public.chamado_clientes;
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3b. O APP PODE CRIAR PROSPECÇÃO (e continua NÃO podendo criar cliente)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Davi: "Se o local não existir na base de dados, considere como um local que
-- estamos PROSPECTANDO."
--
-- Isto NÃO afrouxa a R21. A R21 tranca `clientes` porque aquela tabela é
-- espelho do QAP e um sync futuro faz upsert (e algum dia delete) nela — um
-- cliente criado aqui seria apagado pelo ERP, ou pior, duplicaria o cadastro
-- oficial. `prospeccoes` é o oposto: nasceu na U27 exatamente para guardar o
-- que é NOSSO e o QAP não conhece. Criar prospecção é o uso pretendido da
-- tabela, não uma brecha nela.
--
-- Até aqui só gestor podia inserir, porque a única porta era a tela de
-- Prospecção (que a R38/R64 já aposentou). Com a abertura rápida por IA a
-- porta passa a ser a Início, que o técnico também usa — e um local mapeado
-- por quem esteve lá vale mais do que um local não mapeado.
DROP POLICY IF EXISTS "prospeccoes_insert_autenticado" ON public.prospeccoes;
CREATE POLICY "prospeccoes_insert_autenticado" ON public.prospeccoes
  FOR INSERT TO authenticated WITH CHECK (true);
GRANT INSERT ON public.prospeccoes TO authenticated;

-- ...e quem cria precisa conseguir LER de volta, senão o chip do local nasce em
-- branco — o mesmo sintoma que o comentário da S1 descreve para clientes.
-- Mesma regra, mesma forma: gestor vê tudo; os demais veem a prospecção que
-- está pendurada num chamado ou numa visita que eles já podem ver.
CREATE OR REPLACE FUNCTION public.pode_ver_prospeccao(_prospeccao_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    public.is_gestor(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.chamado_locais l
      JOIN public.chamados c ON c.id = l.chamado_id
      LEFT JOIN public.chamado_apoios a ON a.chamado_id = c.id
      WHERE l.prospeccao_id = _prospeccao_id
        AND (c.responsavel_id = auth.uid()
             OR c.aberto_por = auth.uid()
             OR a.profile_id = auth.uid()
             OR (c.responsavel_id IS NULL
                 AND c.status IN ('aberto', 'agendado', 'em_andamento', 'stand_by')))
    )
    OR EXISTS (
      SELECT 1 FROM public.visitas_tecnicas v
      WHERE v.prospeccao_id = _prospeccao_id AND v.tecnico_id = auth.uid()
    ),
    false);
$$;
REVOKE EXECUTE ON FUNCTION public.pode_ver_prospeccao(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.pode_ver_prospeccao(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "prospeccoes_select" ON public.prospeccoes;
DROP POLICY IF EXISTS "prospeccoes_select_gestor" ON public.prospeccoes;
CREATE POLICY "prospeccoes_select" ON public.prospeccoes
  FOR SELECT TO authenticated USING (public.pode_ver_prospeccao(id));

-- ── Achar ou criar, sem duplicar ────────────────────────────────────────────
-- O app precisa perguntar "já existe uma prospecção com este nome?" ANTES de
-- criar. Mas a policy de leitura acima, de propósito, só mostra ao técnico as
-- prospecções que já estão penduradas nele — então uma busca feita pelo
-- cliente responderia "não existe" para um prédio que existe, e cada chamado
-- criaria outro registro do mesmo lugar.
--
-- SECURITY DEFINER resolve pelo caminho certo: a função enxerga a tabela
-- inteira para DECIDIR, mas devolve só um uuid. Não vaza listagem, não vaza
-- endereço, não vaza contato — quem chamou já sabia o nome, porque foi ele
-- quem digitou.
CREATE OR REPLACE FUNCTION public.achar_ou_criar_prospeccao(_nome text)
RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_nome text := btrim(coalesce(_nome, ''));
  v_id   uuid;
BEGIN
  IF v_nome = '' THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_id
    FROM public.prospeccoes
   WHERE public.normalizar_texto(nome) = public.normalizar_texto(v_nome)
   ORDER BY created_at
   LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.prospeccoes (nome, origem)
  VALUES (v_nome, 'triagem_ia')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.achar_ou_criar_prospeccao(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.achar_ou_criar_prospeccao(text) TO authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. A RLS PRECISA ENXERGAR O LOCAL VINCULADO (correção de um furo que já existia)
-- ════════════════════════════════════════════════════════════════════════════
--
-- `pode_ver_cliente()` é da S1 (2026-08-20); `chamado_clientes` chegou na U45
-- (2026-08-22) e a função NUNCA soube dela. Ou seja: hoje, um técnico num
-- chamado cujo cliente é EXTRA (não é `cliente_id`) simplesmente não enxerga
-- esse cliente — o card mostra o chamado com o local em branco, o mesmo
-- sintoma que o comentário da S1 diz estar evitando.
--
-- Com a U71 o vínculo por tabela deixa de ser exceção e vira o caminho normal,
-- então isto passa de incômodo a defeito de verdade. A regra não muda: se o
-- chamado é visível para você, o local dele também é. Só o caminho cresce.
CREATE OR REPLACE FUNCTION public.pode_ver_cliente(_cliente_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    public.is_gestor(auth.uid())
    -- cliente PRINCIPAL de um chamado meu — ou da fila sem dono, que por
    -- decisão de produto é de todos (idêntico à S1, não mexer)
    OR EXISTS (
      SELECT 1 FROM public.chamados c
      LEFT JOIN public.chamado_apoios a ON a.chamado_id = c.id
      WHERE c.cliente_id = _cliente_id
        AND (c.responsavel_id = auth.uid()
             OR c.aberto_por = auth.uid()
             OR a.profile_id = auth.uid()
             OR (c.responsavel_id IS NULL
                 AND c.status IN ('aberto', 'agendado', 'em_andamento', 'stand_by')))
    )
    -- U71: cliente vinculado pela tabela de LOCAIS, com exatamente o mesmo
    -- critério de acesso do bloco acima
    OR EXISTS (
      SELECT 1 FROM public.chamado_locais l
      JOIN public.chamados c ON c.id = l.chamado_id
      LEFT JOIN public.chamado_apoios a ON a.chamado_id = c.id
      WHERE l.cliente_id = _cliente_id
        AND (c.responsavel_id = auth.uid()
             OR c.aberto_por = auth.uid()
             OR a.profile_id = auth.uid()
             OR (c.responsavel_id IS NULL
                 AND c.status IN ('aberto', 'agendado', 'em_andamento', 'stand_by')))
    )
    -- cliente de uma visita minha
    OR EXISTS (
      SELECT 1 FROM public.visitas_tecnicas v
      WHERE v.cliente_id = _cliente_id AND v.tecnico_id = auth.uid()
    ),
    false);
$$;
REVOKE EXECUTE ON FUNCTION public.pode_ver_cliente(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.pode_ver_cliente(uuid) TO authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- CONFERÊNCIA
-- ════════════════════════════════════════════════════════════════════════════
SELECT 'equipes fora do vocabulário novo em chamados (esperado 0)' AS item,
       count(*)::text AS valor
  FROM public.chamados
 WHERE equipe IN ('audiovisual','business_ops')
UNION ALL
SELECT 'equipes fora do vocabulário novo em profiles (esperado 0)',
       count(*)::text
  FROM public.profiles
 WHERE equipe IN ('audiovisual','business_ops')
UNION ALL
SELECT 'chamado_equipes existe (esperado true)',
       (to_regclass('public.chamado_equipes') IS NOT NULL)::text
UNION ALL
SELECT 'chamado_locais existe (esperado true)',
       (to_regclass('public.chamado_locais') IS NOT NULL)::text
UNION ALL
SELECT 'chamado_clientes foi derrubada (esperado true)',
       (to_regclass('public.chamado_clientes') IS NULL)::text
UNION ALL
SELECT 'RLS ligado nas duas tabelas novas (esperado 2)',
       count(*)::text
  FROM pg_class
 WHERE oid IN ('public.chamado_equipes'::regclass, 'public.chamado_locais'::regclass)
   AND relrowsecurity
UNION ALL
SELECT 'policies das duas tabelas novas (esperado 6)',
       count(*)::text
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('chamado_equipes','chamado_locais')
UNION ALL
SELECT 'locais com mais de uma forma preenchida (esperado 0)',
       count(*)::text
  FROM public.chamado_locais
 WHERE num_nonnulls(cliente_id, prospeccao_id, setor) <> 1;

-- ════════════════════════════════════════════════════════════════════════════
-- DESFAZER
-- ════════════════════════════════════════════════════════════════════════════
-- ATENÇÃO: o passo 3 é destrutivo de verdade — recriar `chamado_clientes` traz
-- de volta a tabela, mas os vínculos de prospecção e de setor NÃO têm para
-- onde voltar (a tabela velha não sabe representá-los) e se perdem.
--
-- CREATE TABLE public.chamado_clientes (
--   chamado_id uuid NOT NULL REFERENCES public.chamados(id) ON DELETE CASCADE,
--   cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
--   created_at timestamptz NOT NULL DEFAULT now(),
--   PRIMARY KEY (chamado_id, cliente_id)
-- );
-- INSERT INTO public.chamado_clientes (chamado_id, cliente_id, created_at)
--   SELECT chamado_id, cliente_id, created_at FROM public.chamado_locais
--    WHERE cliente_id IS NOT NULL;
-- ALTER TABLE public.chamado_clientes ENABLE ROW LEVEL SECURITY;
-- GRANT SELECT, INSERT, DELETE ON public.chamado_clientes TO authenticated;
-- GRANT ALL ON public.chamado_clientes TO service_role;
-- CREATE POLICY "chamado_clientes_select" ON public.chamado_clientes
--   FOR SELECT TO authenticated USING (true);
-- CREATE POLICY "chamado_clientes_insert" ON public.chamado_clientes
--   FOR INSERT TO authenticated WITH CHECK (public.pode_editar_chamado(chamado_id));
-- CREATE POLICY "chamado_clientes_delete" ON public.chamado_clientes
--   FOR DELETE TO authenticated USING (public.pode_editar_chamado(chamado_id));
--
-- DROP TABLE IF EXISTS public.chamado_locais;
-- DROP TABLE IF EXISTS public.chamado_equipes;
--
-- ALTER TABLE public.chamados DROP CONSTRAINT IF EXISTS chamados_equipe_check;
-- ALTER TABLE public.chamados ADD CONSTRAINT chamados_equipe_check
--   CHECK (equipe IN ('ti','patrimonio','audiovisual','business_ops','tecnica',
--                     'comercial','sac','monitoramento'));
-- ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_equipe_check;
-- ALTER TABLE public.profiles ADD CONSTRAINT profiles_equipe_check
--   CHECK (equipe IS NULL OR equipe IN ('ti','patrimonio','audiovisual',
--     'business_ops','tecnica','comercial','sac','monitoramento'));
