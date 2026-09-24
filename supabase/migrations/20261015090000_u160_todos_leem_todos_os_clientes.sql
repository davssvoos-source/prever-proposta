-- ═══════════════════════════════════════════════════════════════════════
-- U160 — TODOS LEEM TODOS OS CLIENTES (R319)
-- 2026-09-23 · v1.0.3
-- ═══════════════════════════════════════════════════════════════════════
--
-- Davi, 23/09/2026: "Para o Nicholas, Erik, enfim para alguns usuários não
-- aparece todos os clientes para adicionar em uma atividade, todos os clientes
-- devem ser possível visualizar ou adicionar em uma atividade por todos."
--
-- A U155 (R305) abriu a leitura para o cargo OPERACIONAL somando-o à régua de
-- quem manda ou tem relação de trabalho. O Davi fecha a questão pelo outro
-- lado: a LEITURA da base de clientes não depende mais de cargo nem de relação
-- — qualquer pessoa autenticada lê qualquer cliente (e os blocos e o patrimônio
-- dele, cujas policies de SELECT já leem por `pode_ler_cliente`). A ESCRITA
-- continua em `pode_ver_cliente` (gestor ou relação de trabalho) — ninguém
-- ganhou poder de mudar cadastro. Adicionar um cliente a uma atividade grava
-- em `chamado_locais`, cuja policy é `pode_editar_chamado` — não muda.
--
-- Idempotente (CREATE OR REPLACE). Nenhuma tabela, nenhuma policy nova: as
-- três policies da U155 continuam apontando para esta função.
-- ═══════════════════════════════════════════════════════════════════════

-- ── PRÉ-VOO: a medida ANTES (rode como um usuário que "não via tudo") ───
SELECT 'clientes que ESTE usuário lê hoje' AS o_que, count(*)::text AS obtido
  FROM public.clientes
UNION ALL
SELECT 'clientes na base (o que ele passa a ler)', count(*)::text
  FROM public.clientes c
 WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid());

-- ── 1) A REGRA DE LEITURA ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pode_ler_cliente(_cliente_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  -- R319 (U160): quem está autenticado lê qualquer cliente. O parâmetro fica
  -- pela assinatura — as policies continuam chamando pode_ler_cliente(id).
  SELECT auth.uid() IS NOT NULL AND _cliente_id IS NOT NULL;
$$;
REVOKE EXECUTE ON FUNCTION public.pode_ler_cliente(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.pode_ler_cliente(uuid) TO authenticated, service_role;
COMMENT ON FUNCTION public.pode_ler_cliente(uuid) IS
  'R319 (U160): quem LE um cliente — qualquer pessoa autenticada. Vale para clientes, cliente_sistemas e cliente_equipamentos (policies de SELECT da U155). A ESCRITA continua em pode_ver_cliente (gestor ou relacao de trabalho).';

-- ── CONFERÊNCIA: obtido × esperado × veredito ──────────────────────────
SELECT o_que, obtido, esperado,
       CASE WHEN obtido = esperado THEN 'OK' ELSE 'VERIFICAR' END AS veredito
FROM (
  SELECT 'pode_ler_cliente le qualquer cliente para quem esta autenticado' AS o_que,
         CASE WHEN pg_get_functiondef('public.pode_ler_cliente(uuid)'::regprocedure) LIKE '%auth.uid() IS NOT NULL AND _cliente_id IS NOT NULL%'
              THEN 'sim' ELSE 'nao' END AS obtido,
         'sim' AS esperado
  UNION ALL
  SELECT 'as tres policies de SELECT continuam em pode_ler_cliente',
         (SELECT count(*) FROM pg_policies
           WHERE schemaname = 'public'
             AND policyname IN ('clientes_select', 'cliente_sistemas_select', 'cliente_equipamentos_select')
             AND qual LIKE '%pode_ler_cliente%')::text,
         '3'
  UNION ALL
  SELECT 'a escrita continua em pode_ver_cliente (nao mudou)',
         CASE WHEN pg_get_functiondef('public.pode_ver_cliente(uuid)'::regprocedure) LIKE '%is_gestor%'
              THEN 'sim' ELSE 'nao' END,
         'sim'
  UNION ALL
  SELECT 'este usuario le a base inteira agora',
         (SELECT count(*) FROM public.clientes)::text,
         (SELECT count(*) FROM public.clientes c
           WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()))::text
) c;

-- ── DESFAZER (se precisar): a regra da U155 ────────────────────────────
-- CREATE OR REPLACE FUNCTION public.pode_ler_cliente(_cliente_id uuid)
-- RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
-- AS $$ SELECT public.pode_ver_cliente(_cliente_id) OR public.eh_operacional(auth.uid()); $$;
