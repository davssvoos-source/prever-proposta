-- ═══════════════════════════════════════════════════════════════════════════
-- U155 — o OPERACIONAL lê a base de clientes inteira (R305) — 2026-09-17
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Davi, 17/09/2026: "O Erik me relatou que foi criar uma atividade e atribuir
-- um cliente a ela, e o cliente Paineiras não apareceu... Eu pedi a ele para
-- verificar e notei que vários clientes não aparecem para ele."
--
-- ── O DEFEITO ──────────────────────────────────────────────────────────────
-- `pode_ver_cliente` (S1, revista na U71) libera a leitura de um cliente para
-- `is_gestor()` OU para quem tem relação de trabalho com ele (chamado,
-- apoio, visita, ou a fila sem dono). O cargo OPERACIONAL não é gestor — é a
-- decisão da R244, "vê tudo, não manda" — e por isso caía no balde do
-- técnico: enxergava só os clientes em que já tinha trabalhado.
--
-- Isso contradiz três coisas que já estavam de pé:
--   · a R244 dá a ele a TELA Clientes (telas.ts: `clientes: true`);
--   · a R221 + a policy de `chamados` (U132) deixam ele ler TODA atividade —
--     e sem o cliente o card aparece com o nome em branco, que é o sintoma
--     que o comentário da própria S1 diz não querer;
--   · a R294 (U144) deu a ele a capacidade de CRIAR atividade — e criar sem
--     poder escolher o cliente é porta trancada com a placa errada.
--
-- ── O QUE MUDA, E O QUE NÃO MUDA ───────────────────────────────────────────
-- MUDA: nasce `pode_ler_cliente(uuid)` = `pode_ver_cliente(uuid)` OU cargo
-- operacional, e as TRÊS policies de SELECT que dependiam da outra passam a
-- lê-la: `clientes`, `cliente_sistemas` e `cliente_equipamentos` (as unidades
-- herdam pelo salto). Nasce também `eh_operacional(uuid)`, no molde do
-- `eh_tecnico` da U132.
--
-- NÃO MUDA: `pode_ver_cliente` continua existindo com o MESMO corpo, e é ela
-- que segue gateando a ESCRITA (`cliente_sistemas_insert/update`,
-- `cliente_equipamentos_insert/update`). Dar ao operacional a escrita do
-- patrimônio pode fazer sentido — é ele quem controla o QAP —, mas é decisão
-- de produto que ninguém pediu, e conserto de defeito não é hora de ampliar
-- poder. O TÉCNICO continua recortado (R264/U132), de propósito.
--
-- >>> RODAR NO SQL EDITOR DO SUPABASE, À MÃO. Idempotente (CREATE OR REPLACE,
-- >>> DROP/CREATE das policies por nome). ORDEM: depois da U154. ORDEM DE
-- >>> DEPLOY DO CÓDIGO: tanto faz — nenhuma tela muda; o que muda é o que o
-- >>> banco devolve para o cargo operacional.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Pré-voo ────────────────────────────────────────────────────────────────
DO $u155pre$
BEGIN
  IF to_regprocedure('public.pode_ver_cliente(uuid)') IS NULL THEN
    RAISE EXCEPTION 'U155: pode_ver_cliente não existe — rode a S1 e a U71 primeiro.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                  WHERE t.typname = 'app_role' AND e.enumlabel = 'operacional') THEN
    RAISE EXCEPTION 'U155: o enum não tem operacional — rode a U127 primeiro.';
  END IF;
END
$u155pre$;

-- ── MEDIDA ANTES (o retrato do defeito, para comparar depois) ──────────────
-- Quantos clientes CADA pessoa de cargo operacional enxerga hoje, contra o
-- total. Antes da migration os dois números divergem; depois, batem.
SELECT p.nome,
       (SELECT count(*) FROM public.clientes) AS total_de_clientes,
       (SELECT count(*) FROM public.clientes c
         WHERE public.is_gestor(p.id)
            OR EXISTS (SELECT 1 FROM public.chamados ch
                        LEFT JOIN public.chamado_apoios a ON a.chamado_id = ch.id
                        WHERE ch.cliente_id = c.id
                          AND (ch.responsavel_id = p.id OR ch.aberto_por = p.id OR a.profile_id = p.id
                               OR (ch.responsavel_id IS NULL
                                   AND ch.status IN ('aberto','agendado','em_andamento','stand_by'))))
            OR EXISTS (SELECT 1 FROM public.chamado_locais l
                        JOIN public.chamados ch ON ch.id = l.chamado_id
                        LEFT JOIN public.chamado_apoios a ON a.chamado_id = ch.id
                        WHERE l.cliente_id = c.id
                          AND (ch.responsavel_id = p.id OR ch.aberto_por = p.id OR a.profile_id = p.id
                               OR (ch.responsavel_id IS NULL
                                   AND ch.status IN ('aberto','agendado','em_andamento','stand_by'))))
            OR EXISTS (SELECT 1 FROM public.visitas_tecnicas v
                        WHERE v.cliente_id = c.id AND v.tecnico_id = p.id)
       ) AS via_pode_ver_cliente
  FROM public.profiles p
 WHERE p.cargo = 'operacional'
 ORDER BY p.nome;

BEGIN;

-- ── §1  a régua do cargo, no molde do eh_tecnico (U132) ────────────────────
CREATE OR REPLACE FUNCTION public.eh_operacional(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user_id AND p.cargo = 'operacional'),
    false);
$$;
REVOKE EXECUTE ON FUNCTION public.eh_operacional(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.eh_operacional(uuid) TO authenticated, service_role;
COMMENT ON FUNCTION public.eh_operacional(uuid) IS
  'R244/R305: o cargo OPERACIONAL — vê tudo, não manda. Usado na LEITURA da base de clientes (U155); não abre escrita nenhuma.';

-- ── §2  quem LÊ um cliente ─────────────────────────────────────────────────
-- Irmã de `pode_ver_cliente`, e não uma reescrita dela: quem gateia ESCRITA
-- continua chamando a outra, e a diferença entre as duas é justamente o que
-- esta migration decide (ler é de mais gente do que escrever).
CREATE OR REPLACE FUNCTION public.pode_ler_cliente(_cliente_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.pode_ver_cliente(_cliente_id)
      OR public.eh_operacional(auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION public.pode_ler_cliente(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.pode_ler_cliente(uuid) TO authenticated, service_role;
COMMENT ON FUNCTION public.pode_ler_cliente(uuid) IS
  'R305 (U155): quem LÊ um cliente — gestor, quem tem relação de trabalho com ele (pode_ver_cliente) e o cargo OPERACIONAL, que vê tudo (R244). A ESCRITA continua em pode_ver_cliente.';

COMMENT ON FUNCTION public.pode_ver_cliente(uuid) IS
  'R305 (U155): quem ESCREVE em cliente_sistemas/cliente_equipamentos — gestor ou relação de trabalho. Para LEITURA use pode_ler_cliente, que inclui o operacional.';

-- ── §3  as três policies de SELECT ─────────────────────────────────────────
DROP POLICY IF EXISTS "clientes_select" ON public.clientes;
CREATE POLICY "clientes_select" ON public.clientes
  FOR SELECT TO authenticated
  USING (public.pode_ler_cliente(id));

DROP POLICY IF EXISTS "cliente_sistemas_select" ON public.cliente_sistemas;
CREATE POLICY "cliente_sistemas_select" ON public.cliente_sistemas
  FOR SELECT TO authenticated
  USING (public.pode_ler_cliente(cliente_id));

DROP POLICY IF EXISTS "cliente_equipamentos_select" ON public.cliente_equipamentos;
CREATE POLICY "cliente_equipamentos_select" ON public.cliente_equipamentos
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.cliente_sistemas s
    WHERE s.id = cliente_equipamentos.cliente_sistema_id
      AND public.pode_ler_cliente(s.cliente_id)
  ));

COMMIT;

-- ── CONFERÊNCIA (obtido × esperado × veredito) ─────────────────────────────
WITH conferencia AS (
  SELECT 'R305: eh_operacional existe e lê o CARGO (não o papel)' AS item,
         (pg_get_functiondef('public.eh_operacional(uuid)'::regprocedure) LIKE '%cargo = ''operacional''%')::text AS obtido,
         'true' AS esperado
  UNION ALL
  SELECT 'R305: pode_ler_cliente delega a pode_ver_cliente e acrescenta o operacional',
         (pg_get_functiondef('public.pode_ler_cliente(uuid)'::regprocedure) LIKE '%pode_ver_cliente%'
          AND pg_get_functiondef('public.pode_ler_cliente(uuid)'::regprocedure) LIKE '%eh_operacional%')::text, 'true'
  UNION ALL
  SELECT 'R305: as TRÊS policies de SELECT leem pode_ler_cliente',
         (SELECT count(*)::text FROM pg_policies
           WHERE schemaname = 'public' AND cmd = 'SELECT'
             AND tablename IN ('clientes','cliente_sistemas','cliente_equipamentos')
             AND qual LIKE '%pode_ler_cliente%'), '3'
  UNION ALL
  SELECT 'R305 CRÍTICO: a ESCRITA não mudou — insert/update continuam em pode_ver_cliente',
         (SELECT count(*)::text FROM pg_policies
           WHERE schemaname = 'public' AND cmd IN ('INSERT','UPDATE')
             AND tablename IN ('cliente_sistemas','cliente_equipamentos')
             AND with_check LIKE '%pode_ver_cliente%'), '4'
  UNION ALL
  SELECT 'R305 CRÍTICO: nenhuma policy de ESCRITA passou a ler pode_ler_cliente',
         (SELECT count(*)::text FROM pg_policies
           WHERE schemaname = 'public' AND cmd <> 'SELECT'
             AND (qual LIKE '%pode_ler_cliente%' OR with_check LIKE '%pode_ler_cliente%')), '0'
  UNION ALL
  -- O NÚMERO QUE IMPORTA: cada operacional passa a enxergar a base inteira.
  SELECT 'R305: o operacional enxerga TODOS os clientes (conta pela função nova)',
         (SELECT string_agg(p.nome || '=' || (SELECT count(*) FROM public.clientes c
                                               WHERE public.pode_ver_cliente(c.id) OR p.cargo = 'operacional'), ', ')
            FROM public.profiles p WHERE p.cargo = 'operacional'),
         (SELECT string_agg(p.nome || '=' || (SELECT count(*) FROM public.clientes), ', ')
            FROM public.profiles p WHERE p.cargo = 'operacional')
  UNION ALL
  SELECT 'R305: o TÉCNICO continua recortado (eh_tecnico intocado, R264)',
         (pg_get_functiondef('public.eh_tecnico(uuid)'::regprocedure) LIKE '%cargo = ''tecnico''%')::text, 'true'
)
SELECT item, obtido, esperado,
       CASE WHEN obtido IS NOT DISTINCT FROM esperado THEN 'ok' ELSE '>>> OLHAR <<<' END AS veredito
  FROM conferencia;

-- ── DESFAZER ───────────────────────────────────────────────────────────────
-- ║ Volta as três policies de SELECT para pode_ver_cliente. As funções novas
-- ║ ficam (inofensivas, sem quem as chame) ou caem com o DROP no fim.
-- ║   DROP POLICY IF EXISTS "clientes_select" ON public.clientes;
-- ║   CREATE POLICY "clientes_select" ON public.clientes
-- ║     FOR SELECT TO authenticated USING (public.pode_ver_cliente(id));
-- ║   DROP POLICY IF EXISTS "cliente_sistemas_select" ON public.cliente_sistemas;
-- ║   CREATE POLICY "cliente_sistemas_select" ON public.cliente_sistemas
-- ║     FOR SELECT TO authenticated USING (public.pode_ver_cliente(cliente_id));
-- ║   DROP POLICY IF EXISTS "cliente_equipamentos_select" ON public.cliente_equipamentos;
-- ║   CREATE POLICY "cliente_equipamentos_select" ON public.cliente_equipamentos
-- ║     FOR SELECT TO authenticated USING (EXISTS (
-- ║       SELECT 1 FROM public.cliente_sistemas s
-- ║        WHERE s.id = cliente_equipamentos.cliente_sistema_id
-- ║          AND public.pode_ver_cliente(s.cliente_id)));
-- ║   DROP FUNCTION IF EXISTS public.pode_ler_cliente(uuid);
-- ║   DROP FUNCTION IF EXISTS public.eh_operacional(uuid);
