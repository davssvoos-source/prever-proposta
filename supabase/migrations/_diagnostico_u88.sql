-- ═══════════════════════════════════════════════════════════════════════════
-- DIAGNÓSTICO DA U88 — POR QUE ELA ABORTOU
--
-- >>> NÃO É MIGRATION. Leitura pura: nenhum INSERT, UPDATE, DELETE ou DDL.
-- >>> Rodar quantas vezes quiser, a qualquer hora, sem consequência.
--
-- O prefixo `_` marca isto como arquivo que o repositório NUNCA aplica — mesma
-- convenção de `_medir_antes_da_carga_u82.sql`.
--
-- ── POR QUE ELE EXISTE ────────────────────────────────────────────────────
-- Quando o pré-voo da U88 aborta, o SQL Editor mostra UMA mensagem vermelha e
-- NENHUMA grade de resultado — e o botão de exportar acaba levando a grade
-- anterior, de outra query. O erro fica difícil de capturar.
--
-- Este arquivo transforma as 12 recusas do §0 da U88 em UMA TABELA. Cada linha
-- é uma das perguntas que o pré-voo faz, com a resposta do SEU banco e o
-- veredito. Procure '>>> E ESTE <<<' na coluna `veredito`: é a recusa que
-- disparou.
--
-- Tudo é medido em `pg_proc.prosrc` — o corpo VIVO no catálogo —, e não nos
-- arquivos do repositório. O repositório é evidência do que foi ESCRITO; só o
-- catálogo sabe o que foi APLICADO.
--
-- A saída é ASCII de propósito: exportada em CSV, ela sobrevive ao encoding.
-- ═══════════════════════════════════════════════════════════════════════════

WITH corpo AS (
  SELECT p.proname,
         p.prosrc
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('aprovar_chamado_financeiro','montar_fechamento')
),
apr AS (SELECT prosrc AS s FROM corpo WHERE proname = 'aprovar_chamado_financeiro'),
mon AS (SELECT prosrc AS s FROM corpo WHERE proname = 'montar_fechamento')

SELECT t.ordem, t.pergunta, t.resposta, t.veredito FROM (

-- ══ 1) A U80 RODOU? ══════════════════════════════════════════════════════
SELECT 1 AS ordem,
       'A U80 rodou? (concluir_chamado_com_cobranca existe)' AS pergunta,
       COALESCE(to_regprocedure('public.concluir_chamado_com_cobranca(uuid,text,text,numeric,numeric[],text)')::text,
                'NAO EXISTE') AS resposta,
       CASE WHEN to_regprocedure('public.concluir_chamado_com_cobranca(uuid,text,text,numeric,numeric[],text)') IS NULL
            THEN '>>> E ESTE <<< rode a U80 (20260903090000) primeiro'
            ELSE 'ok' END AS veredito

UNION ALL
-- ══ 2) aprovar_chamado_financeiro EXISTE? ════════════════════════════════
SELECT 2, 'aprovar_chamado_financeiro(uuid) existe?',
       COALESCE(to_regprocedure('public.aprovar_chamado_financeiro(uuid)')::text, 'NAO EXISTE'),
       CASE WHEN to_regprocedure('public.aprovar_chamado_financeiro(uuid)') IS NULL
            THEN '>>> E ESTE <<< a funcao nao existe neste banco'
            ELSE 'ok' END

UNION ALL
-- ══ 3) montar_fechamento EXISTE? ═════════════════════════════════════════
SELECT 3, 'montar_fechamento(text,date) existe? (a U5 rodou)',
       COALESCE(to_regprocedure('public.montar_fechamento(text,date)')::text, 'NAO EXISTE'),
       CASE WHEN to_regprocedure('public.montar_fechamento(text,date)') IS NULL
            THEN '>>> E ESTE <<< a U5 nao rodou neste banco'
            ELSE 'ok' END

UNION ALL
-- ══ 4) QUAL CORPO ESTA VIVO EM aprovar_chamado_financeiro? ═══════════════
-- A ORDEM DOS TESTES AQUI E A MESMA DO PRE-VOO, de proposito: assim o nome
-- que aparece e o da recusa que disparou primeiro, e nao de uma que viria
-- depois. Trocar a ordem faria este diagnostico apontar a causa errada.
SELECT 4, 'Qual corpo esta VIVO em aprovar_chamado_financeiro?',
       (SELECT CASE
          WHEN s IS NULL                              THEN 'FUNCAO NAO EXISTE'
          WHEN s NOT LIKE '%pode_ver_financeiro(auth.uid())%'
               THEN 'U80 - SEM o gate de papel'
          WHEN s NOT LIKE '%America/Sao_Paulo%'
               THEN 'anterior a U80/S4 - sem o fuso'
          WHEN s LIKE '%valor_cobravel%' OR s LIKE '%a.decisao%'
               THEN 'U7 - usa colunas que morreram na U13'
          WHEN s LIKE '%to_char(v_total%'
               THEN 'U13 - ainda grava a cifra no evento'
          ELSE 'S4 ou U88 (o esperado)' END FROM apr),
       (SELECT CASE
          WHEN s IS NULL THEN '>>> E ESTE <<<'
          WHEN s NOT LIKE '%pode_ver_financeiro(auth.uid())%'
               THEN '>>> E ESTE <<< rode a S4 (20260903180000) ANTES da U88'
          WHEN s NOT LIKE '%America/Sao_Paulo%'   THEN '>>> E ESTE <<< rode a U80 e a S4'
          WHEN s LIKE '%valor_cobravel%' OR s LIKE '%a.decisao%'
               THEN '>>> E ESTE <<< corpo da U7; rode U13, U80 e S4'
          WHEN s LIKE '%to_char(v_total%' THEN '>>> E ESTE <<< rode a S4'
          ELSE 'ok' END FROM apr)

UNION ALL
-- ══ 5) EM QUE FORMA ESTA O DELETE DO P19? ════════════════════════════════
-- Duas formas sao ACEITAS: a da S4 (defeito vivo, primeira rodada) e a da U88
-- (ja corrigida, segunda rodada). Qualquer terceira e corpo desconhecido, e o
-- pre-voo se recusa a escrever por cima sem que um humano compare.
SELECT 5, 'Em que forma esta o DELETE de aprovar_chamado_financeiro?',
       (SELECT CASE
          WHEN s IS NULL THEN 'FUNCAO NAO EXISTE'
          WHEN s LIKE '%DELETE FROM public.cobrancas WHERE chamado_id = _chamado_id AND status = ''aberta'';%'
               THEN 'forma da S4 - defeito P19 VIVO (a U88 vai consertar)'
          WHEN s LIKE '%chamado_id = _chamado_id AND status = ''aberta''%AND chamado_peca_id IS NOT NULL;%'
               THEN 'forma da U88 - JA CORRIGIDA (2a rodada e no-op)'
          ELSE 'DESCONHECIDA' END FROM apr),
       (SELECT CASE
          WHEN s IS NULL THEN '>>> E ESTE <<<'
          WHEN s LIKE '%DELETE FROM public.cobrancas WHERE chamado_id = _chamado_id AND status = ''aberta'';%'
            OR s LIKE '%chamado_id = _chamado_id AND status = ''aberta''%AND chamado_peca_id IS NOT NULL;%'
               THEN 'ok'
          ELSE '>>> E ESTE <<< corpo desconhecido; NAO force' END FROM apr)

UNION ALL
-- ══ 6) EM QUE FORMA ESTA montar_fechamento? ══════════════════════════════
SELECT 6, 'Em que forma esta montar_fechamento?',
       (SELECT CASE
          WHEN s IS NULL THEN 'FUNCAO NAO EXISTE'
          WHEN s LIKE '%AND fechamento_id IS NULL%' AND s LIKE '%WHERE fechamento_id = v_id%'
               THEN 'forma NUA da U5 - defeito P50 VIVO (a U88 vai consertar)'
          WHEN s LIKE '%AND c.fechamento_id IS NULL%' AND s LIKE '%WHERE c.fechamento_id = v_id%'
               THEN 'forma QUALIFICADA da U88 - JA CORRIGIDA'
          ELSE 'DESCONHECIDA' END FROM mon),
       (SELECT CASE
          WHEN s IS NULL THEN '>>> E ESTE <<<'
          WHEN (s LIKE '%AND fechamento_id IS NULL%' AND s LIKE '%WHERE fechamento_id = v_id%')
            OR (s LIKE '%AND c.fechamento_id IS NULL%' AND s LIKE '%WHERE c.fechamento_id = v_id%')
               THEN 'ok'
          ELSE '>>> E ESTE <<< corpo desconhecido; NAO force' END FROM mon)

UNION ALL
-- ══ 7) A DIRETIVA QUE A U88 SE RECUSA A APAGAR ═══════════════════════════
SELECT 7, 'montar_fechamento declara #variable_conflict?',
       (SELECT CASE WHEN s IS NULL THEN 'FUNCAO NAO EXISTE'
                    WHEN s LIKE '%variable_conflict%' THEN 'SIM' ELSE 'nao' END FROM mon),
       (SELECT CASE WHEN s LIKE '%variable_conflict%'
                    THEN '>>> E ESTE <<< a U88 removeria a diretiva sem ninguem ter decidido isso'
                    ELSE 'ok' END FROM mon)

UNION ALL
-- ══ 8) LIXO ANTERIOR A 1990 EM cobrancas ═════════════════════════════════
-- O PORTAO da U88 usa datas de 1900 e apaga TUDO que e anterior a 1990 na
-- limpeza. Se ja houver linha assim, ela seria comida por engano.
SELECT 8, 'Cobrancas com data_referencia anterior a 1990',
       (SELECT count(*)::text FROM public.cobrancas b WHERE b.data_referencia < DATE '1990-01-01'),
       CASE WHEN (SELECT count(*) FROM public.cobrancas b WHERE b.data_referencia < DATE '1990-01-01') > 0
            THEN '>>> E ESTE <<< a limpeza do portao comeria essas linhas'
            ELSE 'ok' END

UNION ALL
-- ══ 9) LIXO ANTERIOR A 1990 EM fechamentos ═══════════════════════════════
SELECT 9, 'Fechamentos com inicio anterior a 1990',
       (SELECT count(*)::text FROM public.fechamentos f WHERE f.inicio < DATE '1990-01-01'),
       CASE WHEN (SELECT count(*) FROM public.fechamentos f WHERE f.inicio < DATE '1990-01-01') > 0
            THEN '>>> E ESTE <<< a limpeza do portao os apagaria'
            ELSE 'ok' END

UNION ALL
-- ══ 10) RESIDUO DE UMA EXECUCAO ANTERIOR ═════════════════════════════════
SELECT 10, 'Chamados numerados U88-PORTAO-% (residuo de execucao anterior)',
       (SELECT count(*)::text FROM public.chamados c WHERE c.numero LIKE 'U88-PORTAO-%'),
       CASE WHEN (SELECT count(*) FROM public.chamados c WHERE c.numero LIKE 'U88-PORTAO-%') > 0
            THEN '>>> E ESTE <<< uma execucao anterior nao limpou o que criou'
            ELSE 'ok' END

UNION ALL
-- ══ 11) O PORTAO PRECISA DE UM CLIENTE ═══════════════════════════════════
SELECT 11, 'Existe ao menos um cliente? (cobrancas.cliente_id e NOT NULL)',
       (SELECT count(*)::text FROM public.clientes),
       CASE WHEN NOT EXISTS (SELECT 1 FROM public.clientes)
            THEN '>>> E ESTE <<< o portao nao tem como montar a fixture'
            ELSE 'ok' END

UNION ALL
-- ══ 12) O PORTAO PRECISA PERSONIFICAR ALGUEM ═════════════════════════════
-- As duas funcoes comecam por pode_ver_financeiro(auth.uid()), e no SQL Editor
-- nao ha JWT. Sem um usuario para personificar, elas morreriam em 42501 ANTES
-- de tocar no defeito, e o portao ficaria verde com a funcao quebrada.
SELECT 12, 'Usuarios para quem pode_ver_financeiro e verdadeiro (admin/comercial)',
       (SELECT count(*)::text FROM public.profiles p WHERE public.pode_ver_financeiro(p.id)),
       CASE WHEN (SELECT count(*) FROM public.profiles p WHERE public.pode_ver_financeiro(p.id)) = 0
            THEN '>>> E ESTE <<< sem personificacao o portao fica verde por causa do defeito'
            ELSE 'ok' END

UNION ALL
-- ══ 13) REFERENCIA: A POPULACAO DO P19 HOJE ══════════════════════════════
-- Nao e causa de recusa. E o numero que a U88 ia te mostrar na conferencia 101:
-- quantas cobrancas avulsas vinculadas o motor antigo ainda pode apagar.
SELECT 13, 'REFERENCIA - avulsos vinculados vivos / na mira do DELETE / reais na mira',
       (SELECT count(*) || ' / '
             || count(*) FILTER (WHERE b.status = 'aberta') || ' / '
             || to_char(COALESCE(sum(b.valor) FILTER (WHERE b.status = 'aberta'), 0), 'FM999G999G990D00')
          FROM public.cobrancas b
          JOIN public.chamados c ON c.id = b.chamado_id
         WHERE b.chamado_peca_id IS NULL AND b.chamado_id IS NOT NULL
           AND b.status <> 'cancelada'),
       'referencia'

) t ORDER BY t.ordem;
