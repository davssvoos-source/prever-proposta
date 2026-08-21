-- S1 — BLINDAGEM DE SEGURANÇA (2026-08-20)
--
-- Motivo: o sistema passou a guardar DADO PESSOAL REAL. A base de clientes tem
-- 192 registros com CNPJ e, entre eles, CPF de pessoa física — dado pessoal sob
-- LGPD. Até aqui a RLS era permissiva porque o banco estava vazio ou com dado
-- de teste; isso deixou de ser verdade.
--
-- O modelo de ameaça: TODO usuário do app fala direto com o Postgres usando a
-- MESMA chave pública (anon). Não existe camada intermediária filtrando nada —
-- a RLS É o perímetro. Um técnico com login válido pode abrir o console do
-- navegador e consultar qualquer tabela que a RLS permita. Portanto "a tela não
-- mostra" NÃO é proteção; só a policy é.
--
-- Origem: auditoria em leque (5 frentes, cada achado verificado por um cético).
-- O que esta migration NÃO faz, por já estar correto:
--   · auto-promoção a admin: fechada por trigger (guard_cargo, etapa0);
--   · buckets fotos-os e contratos: já gateados por chamado/contrato;
--   · as 77 funções SECURITY DEFINER: todas com SET search_path.
--
-- Idempotente. Ao final, um SELECT de verificação.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. CLIENTES — o achado CRÍTICO
-- ════════════════════════════════════════════════════════════════════════════
-- Antes: FOR SELECT USING (true). Qualquer autenticado lia a base inteira —
-- CNPJ, CPF, endereço, telefone e e-mail de síndico e zelador de 192 clientes.
-- Um técnico terceirizado, um estagiário, uma conta comprometida: todos com a
-- lista completa a um SELECT de distância.
--
-- Agora: gestor (admin/comercial/sac) vê tudo — é o trabalho deles. O técnico
-- vê SÓ os clientes com os quais ele tem relação de trabalho: o cliente de um
-- chamado que ele pode acessar, ou de uma visita que é dele.
--
-- A função abaixo existe para a policy não fazer subconsulta correlacionada
-- linha a linha (que ficaria lenta com a base crescendo). STABLE permite ao
-- planner reusar o resultado dentro da mesma consulta.
CREATE OR REPLACE FUNCTION public.pode_ver_cliente(_cliente_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    public.is_gestor(auth.uid())
    -- Cliente de um chamado meu (responsável, apoio ou autor) — E TAMBÉM da
    -- fila sem dono, que por decisão de produto é de todos
    -- (pode_acessar_chamado devolve true quando responsavel_id IS NULL).
    --
    -- Sem o caso da fila, o técnico veria o chamado aberto na Início com o
    -- nome do cliente em branco: a RLS filtraria o join e o card viraria
    -- "chamado em ???". As duas regras precisam contar a mesma história —
    -- se o chamado é visível, o cliente dele também é.
    --
    -- O custo: um cliente com pelo menos um chamado na fila fica legível pelo
    -- time todo. É bem menos que "todos os 192" e é exatamente a superfície
    -- que a fila aberta já implica. Fechar isso exige acabar com a fila
    -- aberta, que é decisão de produto, não de segurança.
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
    -- cliente de uma visita minha
    OR EXISTS (
      SELECT 1 FROM public.visitas_tecnicas v
      WHERE v.cliente_id = _cliente_id AND v.tecnico_id = auth.uid()
    ),
    false);
$$;
REVOKE EXECUTE ON FUNCTION public.pode_ver_cliente(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.pode_ver_cliente(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "clientes_select_autenticados" ON public.clientes;
DROP POLICY IF EXISTS "clientes_select"              ON public.clientes;
CREATE POLICY "clientes_select" ON public.clientes
  FOR SELECT TO authenticated
  USING (public.pode_ver_cliente(id));

-- Índices que a policy passa a exercitar a cada consulta de cliente.
CREATE INDEX IF NOT EXISTS chamados_cliente_id_idx     ON public.chamados (cliente_id);
CREATE INDEX IF NOT EXISTS chamados_responsavel_id_idx ON public.chamados (responsavel_id);
CREATE INDEX IF NOT EXISTS chamado_apoios_profile_idx  ON public.chamado_apoios (profile_id);
CREATE INDEX IF NOT EXISTS visitas_cliente_tecnico_idx ON public.visitas_tecnicas (cliente_id, tecnico_id);

-- ════════════════════════════════════════════════════════════════════════════
-- 2. INVENTÁRIO POR CLIENTE
-- ════════════════════════════════════════════════════════════════════════════
-- O que está instalado na casa do cliente é informação de segurança física
-- (quantas câmeras, onde, de que modelo). Segue o mesmo gate do cliente.
--
-- A CADEIA NÃO É PLANA — e a primeira versão desta migration errou nisso:
--   cliente_sistemas            .cliente_id            → clientes
--   cliente_equipamentos        .cliente_sistema_id    → cliente_sistemas
--   cliente_equipamento_unidades.cliente_equipamento_id → cliente_equipamentos
-- Só a primeira tem `cliente_id`. Escrevi as três como se todas tivessem, e o
-- Postgres recusou: `column e.cliente_id does not exist`.
--
-- Escrito tabela a tabela, sem laço genérico, de propósito: a versão anterior
-- usava FOREACH com `IF EXISTS (coluna cliente_id)` e teria PULADO
-- cliente_equipamentos EM SILÊNCIO — deixando a tabela em USING(true) sem que
-- nada acusasse. Numa migration de segurança, pular calado é pior que falhar.

-- 2.1 cliente_sistemas — o único elo com cliente_id direto
DROP POLICY IF EXISTS "cliente_sistemas_select" ON public.cliente_sistemas;
CREATE POLICY "cliente_sistemas_select" ON public.cliente_sistemas
  FOR SELECT TO authenticated
  USING (public.pode_ver_cliente(cliente_id));

-- 2.2 cliente_equipamentos — chega ao cliente pelo SISTEMA
DROP POLICY IF EXISTS "cliente_equipamentos_select" ON public.cliente_equipamentos;
CREATE POLICY "cliente_equipamentos_select" ON public.cliente_equipamentos
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.cliente_sistemas s
    WHERE s.id = cliente_equipamentos.cliente_sistema_id
      AND public.pode_ver_cliente(s.cliente_id)
  ));

-- 2.3 cliente_equipamento_unidades — dois saltos até o cliente
DROP POLICY IF EXISTS "cliente_equipamento_unidades_select" ON public.cliente_equipamento_unidades;
CREATE POLICY "cliente_equipamento_unidades_select"
  ON public.cliente_equipamento_unidades FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.cliente_equipamentos e
    JOIN public.cliente_sistemas s ON s.id = e.cliente_sistema_id
    WHERE e.id = cliente_equipamento_unidades.cliente_equipamento_id
      AND public.pode_ver_cliente(s.cliente_id)
  ));

CREATE INDEX IF NOT EXISTS cliente_sistemas_cliente_idx
  ON public.cliente_sistemas (cliente_id);
CREATE INDEX IF NOT EXISTS cliente_equipamentos_sistema_idx
  ON public.cliente_equipamentos (cliente_sistema_id);

-- ════════════════════════════════════════════════════════════════════════════
-- 3. FICHA DE COMPRA — fechando a brecha do responsável nulo
-- ════════════════════════════════════════════════════════════════════════════
-- A policy usava pode_acessar_chamado(), que devolve TRUE quando
-- responsavel_id IS NULL (regra deliberada: chamado sem dono é da fila de
-- todos). Só que a ficha de compra herdou isso — e um pedido recém-aberto,
-- ainda sem responsável, ficava legível por QUALQUER autenticado, valor
-- incluso. Era a pendência S2/S3 do registro de segurança.
--
-- O custo da compra CONTINUA visível a quem tem o chamado: a U9 decidiu isso
-- de propósito e a decisão segue valendo — R13 trata do que COBRAMOS do
-- cliente, não do que pagamos ao fornecedor. O que muda é só quem "tem o
-- chamado": vínculo real, não a fila aberta.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'chamado_compra') THEN
    DROP POLICY IF EXISTS "chamado_compra_select" ON public.chamado_compra;
    CREATE POLICY "chamado_compra_select"
      ON public.chamado_compra FOR SELECT TO authenticated
      USING (
        public.is_gestor(auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.chamados c
          LEFT JOIN public.chamado_apoios a ON a.chamado_id = c.id
          WHERE c.id = chamado_compra.chamado_id
            AND (c.responsavel_id = auth.uid()
                 OR c.aberto_por = auth.uid()
                 OR a.profile_id = auth.uid())
        )
      );
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. STORAGE — fotos de visita e de bloco
-- ════════════════════════════════════════════════════════════════════════════
-- As policies destes buckets só checavam bucket_id: qualquer autenticado
-- baixava, sobrescrevia OU APAGAVA a foto de qualquer cliente. Uma delas nem
-- tinha cláusula TO, o que a estendia ao papel anon.
--
-- fotos-os e contratos já estavam corretos (gateados por chamado/contrato) —
-- ficam como estão.
DO $$
DECLARE b text;
BEGIN
  FOREACH b IN ARRAY ARRAY['visita-fotos', 'fotos-visitas', 'blocos-fotos'] LOOP
    -- garante que o bucket é privado (não serve por URL pública)
    UPDATE storage.buckets SET public = false WHERE id = b;

    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || '_public_read');
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || '_read');
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || '_auth_read');
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || '_select');
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || '_insert');
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || '_auth_insert');
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || '_update');
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || '_auth_update');
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || '_delete');
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || '_auth_delete');

    -- leitura e escrita: qualquer autenticado do time pode (são fotos de
    -- trabalho, e amarrar por caminho exigiria convenção que hoje não existe);
    -- APAGAR passa a ser só de gestor — destruir prova de serviço não é
    -- operação de quem estava passando por ali.
    EXECUTE format(
      'CREATE POLICY %I ON storage.objects FOR SELECT TO authenticated
         USING (bucket_id = %L)', b || '_select', b);
    EXECUTE format(
      'CREATE POLICY %I ON storage.objects FOR INSERT TO authenticated
         WITH CHECK (bucket_id = %L)', b || '_insert', b);
    EXECUTE format(
      'CREATE POLICY %I ON storage.objects FOR UPDATE TO authenticated
         USING (bucket_id = %L AND owner = auth.uid())
         WITH CHECK (bucket_id = %L)', b || '_update', b, b);
    EXECUTE format(
      'CREATE POLICY %I ON storage.objects FOR DELETE TO authenticated
         USING (bucket_id = %L AND (owner = auth.uid() OR public.is_gestor(auth.uid())))',
      b || '_delete', b);
  END LOOP;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. PROFILES — contato dos funcionários  (NADA A FAZER — ver por quê)
-- ════════════════════════════════════════════════════════════════════════════
-- `profiles` tem SELECT USING(true): e-mail e telefone de todo o time legíveis
-- por qualquer autenticado. Tentei fechar o telefone com REVOKE de COLUNA e
-- REVERTI (migration S1b), por dois motivos:
--
-- 1. Não separa ninguém. GRANT/REVOKE são por ROLE DE BANCO e, no Supabase,
--    todo usuário logado é o MESMO role (`authenticated`). O REVOKE tira de
--    todos — admin inclusive. "Gestor vê, técnico não" só se expressa por RLS
--    (linha) ou por view, nunca por privilégio de coluna.
-- 2. Quebra `select *`. O Postgres recusa a consulta INTEIRA quando uma coluna
--    está revogada, e o app faz `select("*")` em profiles no início da sessão
--    (visitas/data.ts → fetchProfile). Fechou o telefone e derrubou o login.
--
-- Fica como pendência S4, com o caminho certo anotado. O risco é dado de
-- COLEGA (e-mail, telefone), não de cliente, e exige conta válida.

-- ════════════════════════════════════════════════════════════════════════════
-- 6. funil_comercial() — SECURITY DEFINER sem checagem de papel
-- ════════════════════════════════════════════════════════════════════════════
-- Sendo DEFINER, ela ignora a RLS de visitas_tecnicas: qualquer autenticado
-- lia o funil comercial inteiro (quantas visitas, quantas propostas aceitas).
-- Recriada com a MESMA assinatura — em plpgsql, que é o que permite o RAISE —
-- e a checagem de papel na primeira linha. O app não muda.
CREATE OR REPLACE FUNCTION public.funil_comercial(_desde date DEFAULT NULL)
RETURNS TABLE (etapa text, quantidade bigint, ordem int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_gestor(auth.uid()) THEN
    RAISE EXCEPTION 'Somente gestor consulta o funil comercial.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT * FROM public.visitas_tecnicas
    WHERE _desde IS NULL OR created_at >= _desde
  )
  SELECT 'Visitas'::text,            count(*),                                                1
    FROM base
  UNION ALL
  SELECT 'Aprovadas'::text,          count(*) FILTER (WHERE status = 'aprovada'),             2
    FROM base
  UNION ALL
  SELECT 'Propostas enviadas'::text, count(*) FILTER (WHERE proposta_enviada_em IS NOT NULL), 3
    FROM base
  UNION ALL
  SELECT 'Aceitas'::text,            count(*) FILTER (WHERE proposta_resultado = 'aceita'),   4
    FROM base;
END $$;

REVOKE EXECUTE ON FUNCTION public.funil_comercial(date) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.funil_comercial(date) TO authenticated, service_role;


-- ════════════════════════════════════════════════════════════════════════════
-- 7. ESCRITA EM CLIENTES — a regressão silenciosa do SAC
-- ════════════════════════════════════════════════════════════════════════════
-- A etapa1 escreveu `is_gestor` nas policies de UPDATE e DELETE de clientes
-- pensando em admin+comercial — o comentário dela diz isso com todas as
-- letras. Três dias depois a U6a AMPLIOU is_gestor para incluir o SAC, e as
-- duas policies herdaram o novo papel por efeito colateral: ninguém revisitou.
--
-- Resultado: o atendimento podia reescrever o CNPJ/CPF de qualquer cliente e
-- apagar os que ainda não têm contrato ou chamado (os com vínculo são
-- protegidos por FK RESTRICT — o que limita o estrago, não a falha).
--
-- Agora vale uma função PRÓPRIA, com o papel dito por extenso no nome — não
-- `is_gestor`, cujo significado já mudou uma vez e pode mudar de novo.
--
-- Ela lê as DUAS fontes de papel (user_roles e profiles.cargo), como
-- is_gestor e pode_ver_financeiro fazem. Usar `has_role` aqui seria errado:
-- has_role consulta só user_roles, e um comercial cujo papel esteja apenas em
-- profiles.cargo perderia o acesso — a migration de segurança viraria uma
-- migration de bloqueio. O trigger trg_sync_user_role mantém as duas em dia,
-- mas segurança não deve depender de um trigger estar sempre correto.
CREATE OR REPLACE FUNCTION public.pode_gerir_clientes(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    EXISTS (SELECT 1 FROM public.user_roles
             WHERE user_id = _user_id AND role::text IN ('admin', 'comercial'))
    OR EXISTS (SELECT 1 FROM public.profiles
               WHERE id = _user_id AND cargo IN ('admin', 'comercial')),
    false);
$$;
COMMENT ON FUNCTION public.pode_gerir_clientes(uuid) IS
  'Quem cria e edita cliente: admin e comercial. O SAC NÃO — ele atende, não '
  'mantém o cadastro. Deliberadamente separada de is_gestor(), que inclui sac.';
REVOKE EXECUTE ON FUNCTION public.pode_gerir_clientes(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.pode_gerir_clientes(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.e_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    EXISTS (SELECT 1 FROM public.user_roles
             WHERE user_id = _user_id AND role::text = 'admin')
    OR EXISTS (SELECT 1 FROM public.profiles
               WHERE id = _user_id AND cargo = 'admin'),
    false);
$$;
REVOKE EXECUTE ON FUNCTION public.e_admin(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.e_admin(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "clientes_update_gestor" ON public.clientes;
CREATE POLICY "clientes_update_gestor" ON public.clientes
  FOR UPDATE TO authenticated
  USING      (public.pode_gerir_clientes(auth.uid()))
  WITH CHECK (public.pode_gerir_clientes(auth.uid()));

-- Apagar cliente é destrutivo, sobre dado pessoal e sem desfazer: só admin.
-- A consolidação (/clientes/migrar) também é de admin.
DROP POLICY IF EXISTS "clientes_delete_gestor" ON public.clientes;
DROP POLICY IF EXISTS "clientes_delete_admin"  ON public.clientes;
CREATE POLICY "clientes_delete_admin" ON public.clientes
  FOR DELETE TO authenticated
  USING (public.e_admin(auth.uid()));

DROP POLICY IF EXISTS "clientes_insert_gestor" ON public.clientes;
CREATE POLICY "clientes_insert_gestor" ON public.clientes
  FOR INSERT TO authenticated
  WITH CHECK (public.pode_gerir_clientes(auth.uid()));

-- ════════════════════════════════════════════════════════════════════════════
-- 8. INVENTÁRIO — escrita aberta
-- ════════════════════════════════════════════════════════════════════════════
-- cliente_sistemas e cliente_equipamentos tinham INSERT/UPDATE com
-- USING(true)/WITH CHECK(true): qualquer autenticado alterava o inventário de
-- qualquer cliente. O técnico PRECISA registrar equipamento em campo — a
-- escrita continua, mas só onde ele já tem acesso ao cliente.
--
-- IMPORTANTE PARA A SINCRONIZAÇÃO COM O QAP (quando existir): o importador
-- deve rodar com `service_role`, que ignora a RLS por definição. Se ele rodar
-- com a sessão de um usuário comum, estas policies vão barrar a escrita em
-- cliente que aquele usuário não atende — e o sync falharia parcialmente, em
-- silêncio, cliente a cliente.
DROP POLICY IF EXISTS "cliente_sistemas_insert" ON public.cliente_sistemas;
DROP POLICY IF EXISTS "cliente_sistemas_update" ON public.cliente_sistemas;
DROP POLICY IF EXISTS "cliente_sistemas_write"  ON public.cliente_sistemas;
CREATE POLICY "cliente_sistemas_insert" ON public.cliente_sistemas
  FOR INSERT TO authenticated
  WITH CHECK (public.pode_ver_cliente(cliente_id));
CREATE POLICY "cliente_sistemas_update" ON public.cliente_sistemas
  FOR UPDATE TO authenticated
  USING      (public.pode_ver_cliente(cliente_id))
  WITH CHECK (public.pode_ver_cliente(cliente_id));

DROP POLICY IF EXISTS "cliente_equipamentos_insert" ON public.cliente_equipamentos;
DROP POLICY IF EXISTS "cliente_equipamentos_update" ON public.cliente_equipamentos;
DROP POLICY IF EXISTS "cliente_equipamentos_write"  ON public.cliente_equipamentos;
CREATE POLICY "cliente_equipamentos_insert" ON public.cliente_equipamentos
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.cliente_sistemas s
    WHERE s.id = cliente_equipamentos.cliente_sistema_id
      AND public.pode_ver_cliente(s.cliente_id)));
CREATE POLICY "cliente_equipamentos_update" ON public.cliente_equipamentos
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.cliente_sistemas s
    WHERE s.id = cliente_equipamentos.cliente_sistema_id
      AND public.pode_ver_cliente(s.cliente_id)))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.cliente_sistemas s
    WHERE s.id = cliente_equipamentos.cliente_sistema_id
      AND public.pode_ver_cliente(s.cliente_id)));

-- ════════════════════════════════════════════════════════════════════════════
-- 9. ESCRITA EM CHAMADO SEM DONO
-- ════════════════════════════════════════════════════════════════════════════
-- pode_acessar_chamado devolve true quando responsavel_id IS NULL. Para LER a
-- fila isso é a regra de produto. Para ESCREVER, não: qualquer autenticado
-- editava um chamado sem dono. Leitura fica; escrita passa a exigir vínculo.
CREATE OR REPLACE FUNCTION public.pode_editar_chamado(_chamado_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    public.is_gestor(auth.uid())
    OR EXISTS (SELECT 1 FROM public.chamados c
               WHERE c.id = _chamado_id
                 AND (c.responsavel_id = auth.uid() OR c.aberto_por = auth.uid()))
    OR EXISTS (SELECT 1 FROM public.chamado_apoios a
               WHERE a.chamado_id = _chamado_id AND a.profile_id = auth.uid()),
    false);
$$;
REVOKE EXECUTE ON FUNCTION public.pode_editar_chamado(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.pode_editar_chamado(uuid) TO authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies
              WHERE schemaname='public' AND tablename='chamados' AND policyname='chamados_update') THEN
    DROP POLICY "chamados_update" ON public.chamados;
    CREATE POLICY "chamados_update" ON public.chamados
      FOR UPDATE TO authenticated
      USING (public.pode_editar_chamado(id))
      WITH CHECK (public.pode_editar_chamado(id));
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 10. PROFILES — escrita de cargo  (NADA A FAZER — ver por quê)
-- ════════════════════════════════════════════════════════════════════════════
-- Tentei uma segunda camada contra auto-promoção a admin, com
-- REVOKE UPDATE (cargo). Mesmo problema da seção 5: o REVOKE atinge o role
-- `authenticated` inteiro, admin junto, e quebra qualquer UPDATE que toque a
-- coluna. Revertido pela S1b.
--
-- E não faz falta: quem barra a auto-promoção é o trigger
-- `trg_guard_profiles_privilegios` (etapa0, linha 205) — a auditoria testou e
-- confirmou fechado. Uma segunda camada que derruba o app não é camada.

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO
-- ════════════════════════════════════════════════════════════════════════════
SELECT 'clientes: policy restritiva' AS item,
       (SELECT count(*) FROM pg_policies
         WHERE schemaname='public' AND tablename='clientes'
           AND policyname='clientes_select' AND qual LIKE '%pode_ver_cliente%')::text AS valor
UNION ALL
SELECT 'clientes: policy aberta removida',
       (SELECT count(*) FROM pg_policies
         WHERE schemaname='public' AND tablename='clientes' AND qual = 'true')::text
UNION ALL
SELECT 'ficha de compra sem a brecha do responsável nulo',
       (SELECT count(*) FROM pg_policies
         WHERE schemaname='public' AND tablename='chamado_compra'
           AND policyname='chamado_compra_select'
           AND qual NOT LIKE '%pode_acessar_chamado%')::text
UNION ALL
SELECT 'funil_comercial exige gestor',
       (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
         WHERE n.nspname='public' AND p.proname='funil_comercial'
           AND pg_get_functiondef(p.oid) LIKE '%is_gestor%')::text
UNION ALL
SELECT 'buckets de foto privados',
       (SELECT count(*) FROM storage.buckets
         WHERE id IN ('visita-fotos','fotos-visitas','blocos-fotos','fotos-os','contratos')
           AND public = false)::text
UNION ALL
SELECT 'policies de storage sem clausula de role (esperado 0)',
       (SELECT count(*) FROM pg_policies
         WHERE schemaname='storage' AND tablename='objects' AND roles = '{public}')::text
UNION ALL
SELECT 'escrita em clientes: nenhuma policy usa is_gestor (esperado 0)',
       (SELECT count(*) FROM pg_policies
         WHERE schemaname='public' AND tablename='clientes'
           AND cmd IN ('UPDATE','DELETE','INSERT')
           AND (COALESCE(qual,'') LIKE '%is_gestor%'
             OR COALESCE(with_check,'') LIKE '%is_gestor%'))::text
UNION ALL
SELECT 'delete de cliente é só admin',
       (SELECT count(*) FROM pg_policies
         WHERE schemaname='public' AND tablename='clientes'
           AND cmd='DELETE' AND qual LIKE '%e_admin%')::text
UNION ALL
SELECT 'auto-promoção barrada pelo trigger (esperado true)',
       (EXISTS (SELECT 1 FROM pg_trigger
                 WHERE tgrelid='public.profiles'::regclass
                   AND tgname='trg_guard_profiles_privilegios'
                   AND NOT tgisinternal))::text
UNION ALL
SELECT 'inventário: 3 tabelas com policy restritiva (esperado 3)',
       (SELECT count(*) FROM pg_policies
         WHERE schemaname='public'
           AND tablename IN ('cliente_sistemas','cliente_equipamentos','cliente_equipamento_unidades')
           AND cmd='SELECT' AND qual LIKE '%pode_ver_cliente%')::text
UNION ALL
SELECT 'inventário: nenhuma policy aberta sobrou (esperado 0)',
       (SELECT count(*) FROM pg_policies
         WHERE schemaname='public'
           AND tablename IN ('cliente_sistemas','cliente_equipamentos','cliente_equipamento_unidades')
           AND (qual = 'true' OR with_check = 'true'))::text
UNION ALL
SELECT 'tabelas public SEM RLS (esperado 0)',
       (SELECT count(*) FROM pg_tables t
         WHERE t.schemaname='public'
           AND NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                            WHERE n.nspname='public' AND c.relname=t.tablename AND c.relrowsecurity))::text;
