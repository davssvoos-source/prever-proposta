-- ═══════════════════════════════════════════════════════════════════════════
-- S3 — `criado_por` E `origem` DEIXAM DE SER DO CLIENTE
--      (a S2 estava incompleta — série S, como a S1 e a S2)
--
-- >>> RODAR NO SQL EDITOR DO SUPABASE, À MÃO. Idempotente.
-- >>> A S2 (rodada em 01/09) fechou MENOS do que prometeu. Isto completa.
--
-- ── O QUE A S2 ERROU ───────────────────────────────────────────────────────
-- A S2 passou a decidir autorização lendo DUAS COLUNAS da própria linha:
--
--   AND (a.origem = 'dupla' OR a.criado_por IS DISTINCT FROM a.profile_id)
--
-- e apostou que `criado_por` seria preenchida pelo `DEFAULT auth.uid()`. Só que
-- DEFAULT vale para coluna AUSENTE do comando. O GRANT de `chamado_apoios` é de
-- TABELA (`GRANT SELECT, INSERT, DELETE`, vindo da U1:427 e carregado pelo
-- rename da U7), e GRANT de tabela alcança TODAS as colunas — inclusive as duas
-- que a S2 transformou em regra de segurança. Não há gatilho BEFORE INSERT, e a
-- policy da S2 só olha `chamado_id`.
--
-- Então a escalada que a S2 fechou voltou custando um campo JSON a mais:
--     POST /rest/v1/chamado_apoios
--          {"chamado_id":"<X>","profile_id":"<eu>","criado_por":null}
--   → `NULL IS DISTINCT FROM '<eu>'` é TRUE, e pode_editar_chamado concede.
-- Ou, mais direto ainda, pelo outro ramo do OR:
--          {"chamado_id":"<X>","profile_id":"<eu>","origem":"dupla"}
--   → e o comentário da S2 dizia, com todas as letras, que origem='dupla' é
--     "derivada, ninguém a forja". Era falso.
--
-- O alcance é menor que o da S2 original — a policy dela ainda exige
-- `pode_acessar_chamado(chamado_id)`, então não é mais "qualquer chamado". Mas
-- a FILA ABERTA (`responsavel_id IS NULL`) é acessível a todos de propósito, e
-- por ela dá para virar apoio de um chamado sem dono e MANTER a edição depois
-- que ele for atribuído a outra pessoa. Que é exatamente o caminho que a S2 diz
-- ter fechado.
--
-- ── A CORREÇÃO: PRIVILÉGIO DE COLUNA, NÃO MAIS UM GATILHO ──────────────────
-- No Postgres, GRANT de tabela cobre todas as colunas e não há como "tirar uma".
-- O caminho é REVOGAR o INSERT da tabela e CONCEDER só as colunas que o cliente
-- tem direito de escrever. Com isso:
--   · quem manda só {chamado_id, profile_id} passa, e os DEFAULTs valem;
--   · quem tenta mandar `criado_por` ou `origem` leva
--     "permission denied for column" — do PRÓPRIO POSTGRES, antes da policy;
--   · as funções SECURITY DEFINER (o gatilho da escala da U64/U76 e
--     chamado_sincronizar_apoio) rodam como a dona da tabela e passam por cima,
--     que é como elas já gravam origem='dupla' hoje.
--
-- Escolhi privilégio de coluna em vez de um gatilho BEFORE INSERT por um motivo
-- só: o gatilho teria de distinguir "o gatilho da escala está escrevendo" de "o
-- cliente está escrevendo", e a única forma de fazer isso é uma flag de sessão —
-- que é mais uma peça para alguém esquecer de setar, e mais um jeito de a regra
-- falhar ABERTA. Privilégio é declarativo, mora no catálogo, e o §3 o confere
-- lendo o catálogo em vez de ler texto.
--
-- ── A LIÇÃO, PARA O PRÓXIMO ────────────────────────────────────────────────
-- Quando uma coluna passa a DECIDIR AUTORIZAÇÃO, ela deixa de ser dado e vira
-- superfície de ataque. A pergunta "quem pode escrever nela?" tem de ser
-- respondida NA MESMA MIGRATION que a promove — e respondida lendo o catálogo,
-- não lendo a intenção de quem escreveu o DEFAULT.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- §0) TRAVA: sem a S2 no banco, isto não faz sentido
-- ═══════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='chamado_apoios'
                    AND column_name='criado_por') THEN
    RAISE EXCEPTION E'ABORTADO — nada foi alterado (ROLLBACK).\nA coluna criado_por não existe: a S2 não foi rodada neste banco. Rode a S2 primeiro (20260901120000).';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- §1) O CLIENTE ESCREVE DUAS COLUNAS, E SÓ ESSAS DUAS
-- ═══════════════════════════════════════════════════════════════════════
-- REVOKE primeiro, GRANT depois: o INSERT de tabela precisa sumir antes, senão
-- ele continua cobrindo tudo e a concessão de coluna vira decoração.
--
-- SELECT e DELETE continuam de TABELA, e é de propósito:
--   · SELECT — a leitura de apoio é aberta ao time desde a U1, e o PostgREST
--     precisa dela inteira para o `Prefer: return=representation` do INSERT;
--   · DELETE — não existe privilégio de coluna em DELETE (a linha sai inteira),
--     e quem pode apagar já é filtrado pela policy `chamado_apoios_delete`.
REVOKE INSERT ON public.chamado_apoios FROM authenticated;
GRANT  INSERT (chamado_id, profile_id) ON public.chamado_apoios TO authenticated;

-- Não há GRANT de UPDATE nesta tabela (nunca houve), então não existe o caminho
-- "insiro certo e corrijo depois". A conferência do §3 prova isso em vez de
-- confiar na memória.

COMMENT ON COLUMN public.chamado_apoios.criado_por IS
  'Quem estava logado quando esta linha nasceu (S2). Decide AUTORIZAÇÃO: '
  'pode_editar_chamado() só conta o apoio quando criado_por é DIFERENTE de '
  'profile_id — pôr-se a si mesmo como apoio não vira direito de edição. '
  'POR ISSO O CLIENTE NÃO PODE ESCREVÊ-LA (S3, privilégio de coluna): mandar '
  '"criado_por": null derrotava a regra inteira. NULL = linha anterior à S2.';

COMMENT ON COLUMN public.chamado_apoios.origem IS
  'dupla = escrita pelo gatilho da escala (U64/U76), derivada de duplas_escala; '
  'manual = alguém pôs à mão. Decide AUTORIZAÇÃO junto com criado_por, e por '
  'isso o cliente NÃO pode escrevê-la (S3): antes disso, mandar '
  '"origem":"dupla" concedia edição de graça.';

-- ═══════════════════════════════════════════════════════════════════════
-- §2) O ESTRAGO QUE PODE TER SIDO FEITO
-- ═══════════════════════════════════════════════════════════════════════
-- A janela foi curta (a S2 rodou hoje) e exigia alguém sabendo exatamente disto,
-- então o esperado é ZERO. Ainda assim se conta, porque "esperado" não é
-- "conferido". Uma linha de auto-inscrição feita PELA API depois da S2 tem
-- assinatura reconhecível: profile_id = quem inseriu, e criado_por nulo (o
-- truque) ou igual a profile_id.
CREATE TEMP TABLE _s3_suspeitas ON COMMIT DROP AS
SELECT a.chamado_id, a.profile_id, a.origem, a.criado_por, a.created_at
  FROM public.chamado_apoios a
 WHERE a.created_at >= DATE '2026-09-01'
   AND (a.criado_por IS NULL OR a.criado_por = a.profile_id);

-- ═══════════════════════════════════════════════════════════════════════
-- §3) CONFERÊNCIA — lendo o CATÁLOGO, não o texto
-- ═══════════════════════════════════════════════════════════════════════
SELECT 'CRÍTICO: authenticated NÃO tem INSERT de tabela (o que cobria tudo)' AS conferencia,
       (SELECT count(*)::text FROM information_schema.table_privileges
         WHERE table_schema='public' AND table_name='chamado_apoios'
           AND grantee='authenticated' AND privilege_type='INSERT') AS valor,
       '0' AS esperado
UNION ALL
SELECT 'CRÍTICO: e tem INSERT em exatamente DUAS colunas',
       (SELECT count(*)::text FROM information_schema.column_privileges
         WHERE table_schema='public' AND table_name='chamado_apoios'
           AND grantee='authenticated' AND privilege_type='INSERT'), '2'
UNION ALL
SELECT '…e elas são chamado_id e profile_id',
       (SELECT string_agg(column_name, ', ' ORDER BY column_name)
          FROM information_schema.column_privileges
         WHERE table_schema='public' AND table_name='chamado_apoios'
           AND grantee='authenticated' AND privilege_type='INSERT'),
       'chamado_id, profile_id'
UNION ALL
SELECT 'CRÍTICO: criado_por não é gravável pelo cliente',
       (SELECT has_column_privilege('authenticated', 'public.chamado_apoios',
                                    'criado_por', 'INSERT')::text), 'false'
UNION ALL
SELECT 'CRÍTICO: origem também não',
       (SELECT has_column_privilege('authenticated', 'public.chamado_apoios',
                                    'origem', 'INSERT')::text), 'false'
UNION ALL
SELECT 'não existe UPDATE para o cliente corrigir depois',
       (SELECT count(*)::text FROM information_schema.table_privileges
         WHERE table_schema='public' AND table_name='chamado_apoios'
           AND grantee='authenticated' AND privilege_type='UPDATE'), '0'
UNION ALL
SELECT 'o time continua LENDO apoio (a U1 abriu de propósito)',
       (SELECT has_table_privilege('authenticated', 'public.chamado_apoios', 'SELECT')::text),
       'true'
UNION ALL
SELECT 'e continua podendo apagar (a policy é que filtra quem)',
       (SELECT has_table_privilege('authenticated', 'public.chamado_apoios', 'DELETE')::text),
       'true'
UNION ALL
SELECT 'linhas suspeitas na janela entre a S2 e a S3 (esperado: 0)',
       (SELECT count(*)::text FROM _s3_suspeitas), '0';

-- Se a linha de cima não vier 0, são estas — olhe e apague à mão o que não
-- fizer sentido. `criado_por = profile_id` é o caso claro; `criado_por IS NULL`
-- pode ser só uma linha antiga que escapou do recorte de data.
SELECT p.nome AS apoiador, c.numero AS chamado, s.origem, s.criado_por, s.created_at
  FROM _s3_suspeitas s
  JOIN public.chamados c ON c.id = s.chamado_id
  LEFT JOIN public.profiles p ON p.id = s.profile_id
 ORDER BY s.created_at DESC;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- DESFAZER — devolve o INSERT de tabela, e com ele o buraco.
-- Só faz sentido se algum caminho legítimo precisar gravar criado_por/origem
-- pelo cliente. Se for esse o caso, o certo é descobrir QUAL e dar privilégio
-- àquela coluna, não devolver o INSERT inteiro.
-- ═══════════════════════════════════════════════════════════════════════════

-- BEGIN;
-- REVOKE INSERT (chamado_id, profile_id) ON public.chamado_apoios FROM authenticated;
-- GRANT  INSERT ON public.chamado_apoios TO authenticated;
-- COMMIT;
--
-- Para conferir o que quebrou antes de decidir, o erro do Postgres nomeia a
-- coluna: "permission denied for column <nome> of relation chamado_apoios".
