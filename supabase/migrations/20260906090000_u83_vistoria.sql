-- ═══════════════════════════════════════════════════════════════════════════
-- U83 — VISTORIA É UM TIPO DE CHAMADO DE CAMPO (R112, 2026-09-02)
--
-- >>> RODAR NO SQL EDITOR DO SUPABASE, À MÃO, DEPOIS DA U82. <<<
-- >>> O §1 ABORTA (e não deixa rastro: é tudo uma transação) se o CHECK vivo <<<
-- >>> NÃO for o da U41, ou se existir alguma linha com tipo fora da lista.   <<<
--
-- ── A DECISÃO DO DAVI, E POR QUE O NOME IMPORTA ────────────────────────────
-- O Vinicius (líder da equipe técnica) tem na programação dele uma atividade
-- que ele chama de "visita técnica" e que NÃO É a visita comercial de
-- proposta: é ir ao cliente só para OLHAR — medir, conferir uma instalação de
-- terceiro, avaliar o que vai ser preciso. Hoje ela não tem tipo: cai em
-- 'corretiva' (o default de campo em chamado_preencher, u7:296-297) ou em
-- 'operacional', e some do relatório de manutenção como se fosse conserto.
--
-- O tipo se chama `vistoria`, e o rótulo é "Vistoria". Escolha explícita do
-- Davi entre alternativas, e a razão está no que as palavras JÁ SIGNIFICAM
-- aqui: "visita técnica" é a visita COMERCIAL — tabela `visitas_tecnicas`,
-- tela /gerencial, tipo `prospeccao`, trigger sincronizar_chamado_da_visita.
-- Reusar as duas palavras seria a quarta colisão de vocabulário do projeto e a
-- pior delas: as outras três (equipe, modalidade, bloco) pelo menos moram em
-- telas diferentes; estas duas dividiriam a MESMA lista de tipos de chamado,
-- lado a lado, no mesmo <select>.
--
-- ATENÇÃO A UMA ARMADILHA JÁ CONFIRMADA: o plano do projeto dizia "e então
-- `vistoria` cobre", como se o tipo já existisse. NÃO EXISTIA. Os tipos de
-- campo eram corretiva, preventiva, operacional, implantacao — e é este
-- arquivo que cria o quinto.
--
-- ── O QUE ELA FAZ: UMA CONSTRAINT. SÓ ISSO. ────────────────────────────────
-- Um DROP/ADD de `chamados_tipo_check` acrescentando 'vistoria' à lista, sem
-- tirar NENHUM dos oito valores que já estavam lá. Zero DDL de coluna, zero
-- backfill, zero linha escrita, zero policy, zero GRANT.
--
-- ── A ORDEM DE DEPLOY INVERTEU, E É POR ISSO QUE ELA VEM SOZINHA ───────────
-- Nos casos anteriores desta casa o perigo era o CÓDIGO LER coluna que ainda
-- não existe — por isso a migration ia na frente e o código atrás. Aqui é o
-- contrário: o código passaria a ESCREVER um valor que o CHECK ainda recusa
-- (23514) na janela entre o push da Lovable e a rodada desta migration. Como
-- push em `main` publica sozinho e esta migration é rodada à mão pelo Davi,
-- essa janela é REAL e tem o tamanho do tempo dele.
--
-- Por isso a entrega é em DOIS COMMITS, e o commit A (este) traz:
--   · esta migration;
--   · o suporte a RENDERIZAR 'vistoria' — union, TIPO_LABEL, TIPO_CORES,
--     TIPOS, filtro do painel, série do gráfico, filtro da programação;
--   · a desduplicação das quatro cópias à mão do domínio de tipos de campo.
-- E NÃO traz nada que ofereça 'vistoria' para ESCRITA. O gate é uma linha só,
-- em src/lib/chamado-status.ts: a entrada "vistoria" na lista
-- `NAO_OFERECIDOS`. O commit B APAGA ESSA LINHA e mais nada — o seletor de
-- novo chamado de campo, o seletor do PainelChamado, o diálogo de nova
-- atividade, o enum do schema da IA e a linha de descrição dela no prompt
-- derivam todos da mesma função.
--
-- Renderizar é aditivo e inofensivo: só faz um valor existente ficar legível.
-- Oferecer é o que grava. Esta migration é o que torna "oferecer" seguro.
--
-- ── O QUE ELA DELIBERADAMENTE NÃO FAZ ──────────────────────────────────────
-- · NÃO toca `public.sugerir_tipo_chamado`. Aquela função tem a palavra
--   "vistoria" como palavra-chave DESDE A U1 (u1:63, u6c:60) — e devolve
--   'preventiva'. Depois do R112 isso é uma resposta errada em português, e
--   ainda assim ela fica, por três razões medidas:
--     1. o gêmeo em TS (`sugerirTipoChamado`, chamado-status.ts) é gravado
--        direto por importar-notion.ts:364 — mudá-lo antes desta migration
--        rodar é exatamente o 23514 que o desenho de dois commits evita;
--     2. os dois lados PRECISAM concordar palavra por palavra (é a convenção
--        "trigger espelha função do app" do manual de banco) — então mudam
--        juntos ou não mudam;
--     3. o estrago está medido e é pequeno: `chamado_preencher` (u7:296-298)
--        só consulta essa função quando `natureza <> 'campo'`; no campo o
--        default é 'corretiva', fixo. A vistoria do Vinicius é atividade de
--        CAMPO — ela nunca passa por ali. O que sobra é um chamado INTERNO
--        intitulado "vistoria" nascendo preventiva, como sempre nasceu.
--   Fica para o commit B, nos dois lados de uma vez.
--
-- · NÃO toca `chamado_preencher`, e isso vale por escrito porque ela contém
--   uma ENUMERAÇÃO POR EXCLUSÃO que passa a alcançar o tipo novo (u7:308-310):
--       NEW.tipo_servico := CASE WHEN NEW.tipo = 'implantacao'
--                                THEN 'instalacao' ELSE 'manutencao' END;
--   Uma vistoria cai no ELSE e nasce `tipo_servico = 'manutencao'`. Isso está
--   CERTO e é o motivo de não mexer: `tipo_servico` tem exatamente dois
--   valores (chamados_tipo_servico_check, u7:142-143) e eles são as duas
--   seções do PDF de fechamento — vistoria não é obra, logo é manutenção. Um
--   terceiro valor seria maquinaria nova para um detalhe que já está resolvido.
--
-- · NÃO mexe em SLA. `chamado_sla` é indexada por PRIORIDADE e só por ela
--   (u7:302, u7:335); o tipo não entra no cálculo de `prazo_limite` em lugar
--   nenhum. Uma vistoria normal tem o mesmo prazo de uma corretiva normal.
--   Está dito aqui porque "não muda" também é uma resposta que precisa ficar
--   escrita — senão o próximo leitor procura o SLA da vistoria e não acha.
--
-- · NÃO faz backfill. Não existe critério: nada no banco distingue hoje uma
--   vistoria de uma corretiva mal classificada, e adivinhar por palavra do
--   título reescreveria histórico com um chute. A conferência 104 conta
--   quantos chamados já têm tipo='vistoria' (tem de ser 0 nesta execução) —
--   é o número que prova que esta migration não escreveu nada.
--
-- ── ORDEM DAS SEÇÕES ───────────────────────────────────────────────────────
--   §1 pré-voo            ← aborta se qualquer pressuposto for falso
--   §2 a foto (só leitura, depois do pré-voo — a cicatriz da U81)
--   §3 o CHECK
--   §4 conferência        ← obtido × esperado × veredito
-- Tudo em UMA transação, e a tabela de veredito é o ÚLTIMO result set. RAISE
-- NOTICE é INVISÍVEL no editor do Supabase: tudo que precisa ser visto sai em
-- SELECT.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- §1) PRÉ-VOO — as pressuposições, uma a uma, com aborto
-- ═══════════════════════════════════════════════════════════════════════
-- Sem ele, os dois modos de falhar desta migration dão mensagens cruas:
--   · o CHECK vivo não é o que eu li  → o DROP apaga a constraint de outra
--     pessoa e o ADD põe a MINHA no lugar, em silêncio, perdendo o que ela
--     tinha acrescentado;
--   · existe linha com tipo fora da lista → o ADD CONSTRAINT valida a tabela
--     inteira e devolve um 23514 que aponta para a constraint, não para a
--     linha, e às 23h isso manda caçar no lugar errado.
DO $preflight$
DECLARE
  v_def   text;
  v_vals  text[];
  v_forai bigint;
BEGIN
  IF to_regclass('public.chamados') IS NULL THEN
    RAISE EXCEPTION 'PRÉ-VOO U83: public.chamados não existe. A U7 não rodou.';
  END IF;

  SELECT pg_get_constraintdef(c.oid) INTO v_def
    FROM pg_constraint c
   WHERE c.conrelid = 'public.chamados'::regclass
     AND c.conname  = 'chamados_tipo_check';

  IF v_def IS NULL THEN
    RAISE EXCEPTION E'PRÉ-VOO U83 — nada foi alterado (ROLLBACK).\nA constraint chamados_tipo_check NÃO existe em public.chamados.\nO QUE FAZER: rode  SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = ''public.chamados''::regclass;  e descubra quem a removeu. NÃO force esta migration: sem ela, tipo é texto livre e recriá-la aqui poderia falhar na validação de linhas que nasceram nesse intervalo.';
  END IF;

  -- O CHECK VIVO É O DA U41 — ou o desta migration, já rodada. Este arquivo o
  -- REESCREVE por inteiro, e reescrever por cima de uma versão que ninguém leu
  -- é o jeito de apagar a correção de outra pessoa em silêncio.
  --
  -- COMPARAÇÃO POR CONJUNTO, e as duas direções importam. A versão anterior
  -- desta guarda tinha oito `position(…) = 0` dentro de um `ELSE`, e falhava
  -- de dois jeitos ao mesmo tempo:
  --   (a) OITO `position` SÓ DETECTAM REMOÇÃO. Se uma migration futura
  --       acrescentar um nono valor ao CHECK, os oito continuam lá, o pré-voo
  --       passa, e o §3 APAGA o valor novo em silêncio — o próximo INSERT
  --       daquele tipo vira 23514 em produção;
  --   (b) NA SEGUNDA RODADA O GUARDA INTEIRO ERA PULADO, porque ele morava no
  --       `ELSE` de "já tem vistoria?". Ou seja: desligado exatamente no
  --       caminho em que (a) é mais provável — e rodar duas vezes é caminho de
  --       primeira classe nesta casa.
  -- `@>` exige que os oito da U41 estejam TODOS lá; `<@` proíbe qualquer coisa
  -- além deles e de 'vistoria'. Pega remoção E adição, não depende de ordem
  -- nem de collation, e continua ligada em toda rodada.
  --
  -- `v_vals IS NULL` É OBRIGATÓRIO: sem ele, `NOT (NULL AND …)` é NULL, o IF
  -- não dispara e o guarda passa MUDO. É a mesma família do `position(…) >= 0`
  -- que nunca é falso — a guarda que parece guardar.
  SELECT array_agg(m.grupo[1]) INTO v_vals
    FROM regexp_matches(v_def, '''([a-z_]+)''', 'g') AS m(grupo);

  IF v_vals IS NULL
     OR NOT (v_vals @> ARRAY['corretiva','preventiva','operacional','implantacao',
                             'melhoria','pedido_compra','proposta_comercial','prospeccao']
         AND v_vals <@ ARRAY['corretiva','preventiva','operacional','implantacao',
                             'melhoria','pedido_compra','proposta_comercial','prospeccao',
                             'vistoria']) THEN
    RAISE EXCEPTION E'PRÉ-VOO U83 — nada foi alterado (ROLLBACK).\nchamados_tipo_check não é a versão da U41 nem a desta migration: o conjunto de valores aceitos não é o esperado (falta um dos oito, ou existe um nono que esta migration APAGARIA).\nCHECK vivo: %\nO QUE FAZER: descubra quem o trocou e reescreva o §3 desta migration com a lista CERTA antes de rodar. NÃO force.', v_def;
  END IF;

  -- A LINHA QUE FARIA O ADD CONSTRAINT ESTOURAR, contada ANTES.
  -- `tipo` é NOT NULL (etapa3:75), mas o IS NOT NULL fica de propósito: se
  -- alguém tiver afrouxado a coluna, uma linha nula não é o defeito que este
  -- pré-voo existe para pegar, e acusá-la mandaria caçar a coisa errada.
  SELECT count(*) INTO v_forai
    FROM public.chamados
   WHERE tipo IS NOT NULL
     AND tipo NOT IN ('corretiva', 'preventiva', 'operacional', 'implantacao',
                      'vistoria', 'melhoria', 'pedido_compra',
                      'proposta_comercial', 'prospeccao');
  IF v_forai > 0 THEN
    RAISE EXCEPTION E'PRÉ-VOO U83 — nada foi alterado (ROLLBACK).\n% chamado(s) têm tipo FORA da lista nova, e o ADD CONSTRAINT do §3 valida a tabela inteira.\nO QUE FAZER: rode  SELECT tipo, count(*) FROM public.chamados GROUP BY 1 ORDER BY 2 DESC;  e decida o que fazer com esses valores ANTES de rodar esta migration.', v_forai;
  END IF;
END
$preflight$;

-- ═══════════════════════════════════════════════════════════════════════
-- §2) A FOTO — depois do pré-voo, e antes de qualquer escrita
-- ═══════════════════════════════════════════════════════════════════════
-- A ordem foi corrigida na U81 e vale aqui igual: a foto LÊ public.chamados;
-- se a tabela não existisse, seria ela a estourar primeiro, com a mensagem
-- crua que o pré-voo existe para substituir.
--
-- ON COMMIT DROP porque ela não é dado, é evidência de UMA execução.
CREATE TEMP TABLE u83_foto ON COMMIT DROP AS
SELECT (SELECT count(*)          FROM public.chamados)                          AS chamados_antes,
       (SELECT count(*)          FROM public.chamados WHERE tipo = 'vistoria')  AS vistorias_antes,
       (SELECT count(DISTINCT tipo) FROM public.chamados)                       AS tipos_distintos_antes;

-- ═══════════════════════════════════════════════════════════════════════
-- §3) O CHECK ABRE ESPAÇO PARA 'vistoria'
-- ═══════════════════════════════════════════════════════════════════════
-- Os oito valores anteriores continuam TODOS aceitos. 'proposta_comercial' e
-- 'pedido_compra' seguem na lista pelo mesmo motivo da U41: histórico e
-- pedidos de compra antigos precisam continuar legíveis, e um CHECK que recusa
-- o que já está gravado trava qualquer UPDATE naquelas linhas.
--
-- DROP + ADD (e não ALTER ... ADD CONSTRAINT ... NOT VALID depois VALIDATE):
-- a tabela é pequena, a validação é imediata, e o pré-voo já provou que
-- nenhuma linha viola. Um NOT VALID deixaria a constraint mentindo sobre si
-- mesma no catálogo, e a conferência 106 é justamente `convalidated`.
ALTER TABLE public.chamados DROP CONSTRAINT IF EXISTS chamados_tipo_check;
ALTER TABLE public.chamados ADD CONSTRAINT chamados_tipo_check
  CHECK (tipo IN ('corretiva', 'preventiva', 'operacional', 'implantacao',
                  'vistoria',
                  'melhoria', 'pedido_compra', 'proposta_comercial', 'prospeccao'));

COMMENT ON CONSTRAINT chamados_tipo_check ON public.chamados IS
  'R112/U83: o vocabulário de tipo. A fonte gêmea em TS é ChamadoTipo/TIPOS em src/lib/chamado-status.ts, e o verificador compara as duas listas valor por valor. proposta_comercial é legado da U41 (renomeado para prospeccao) e não existe do lado do TS.';

-- ═══════════════════════════════════════════════════════════════════════
-- §3b) O GÊMEO DO CLASSIFICADOR PÕE-SE EM DIA COM A R48
-- ═══════════════════════════════════════════════════════════════════════
-- ISTO É UM DEFEITO VIVO, achado ao fazer o censo do domínio de tipos, e ele
-- cabe aqui porque é a MESMA regra de produto: qual tipo o sistema escolhe
-- quando ninguém escolhe.
--
-- `sugerir_tipo_chamado` existe em DOIS exemplares — este, no banco (definido
-- em u6c:48 como `sugerir_tipo_demanda`, renomeado por u7:282, e o RENAME
-- preserva o corpo), e o gêmeo TS em `chamado-status.ts:519`. Os seis ramos
-- eram idênticos. A R48/U41 tirou `pedido_compra` da SELEÇÃO e trocou o ramo
-- de compra do lado do TS para `operacional` (o comentário em
-- chamado-status.ts:529-531 diz por quê). **O lado do BANCO ficou como estava
-- — e é ELE que grava.**
--
-- O CAMINHO, do clique ao registro:
--   1. chamado interno, a pessoa escreve "Comprar cabo de rede para o rack" e
--      NÃO toca no seletor. A tela mostra "Operacional" (o gêmeo TS);
--   2. `abrirChamado` grava `tipo = NULL`;
--   3. `chamado_preencher` (u7:296-298): natureza <> 'campo' e tipo nulo →
--      chama esta função → devolve **'pedido_compra'**;
--   4. `chamado_criar_ficha_compra` (u9:174-185, AFTER INSERT) cria a linha em
--      `chamado_compra`.
-- Resultado: o registro nasce com um tipo que a R48 APOSENTOU da seleção, e com
-- uma ficha de compra VAZIA que a tela nem sabe oferecer para preencher —
-- porque o mini-formulário de compra depende de o gêmeo TS ter dito
-- `pedido_compra`, e ele nunca mais diz. A tela promete um tipo e o registro
-- nasce com outro, que é exatamente o que o docblock do espelho
-- (chamado-status.ts:493-497) diz que os gêmeos existem para impedir.
--
-- O CORPO ABAIXO É O DE u6c:48-68 LITERAL, com UMA linha trocada (marcada), e
-- nada a menos. Não é comportamento novo: é o atraso da R48 sendo pago. Seguro
-- nas duas ordens de deploy — `operacional` já está no CHECK desde sempre, e é
-- o que o código publicado já espera.
CREATE OR REPLACE FUNCTION public.sugerir_tipo_chamado(_titulo text, _descricao text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $classificador$
DECLARE
  t text := public.normalizar_texto(COALESCE(_titulo, '') || ' ' || COALESCE(_descricao, ''));
BEGIN
  IF t IS NULL THEN RETURN 'operacional'; END IF;
  -- ══ A ÚNICA LINHA QUE MUDA (R48/U41): era 'pedido_compra' ═══════════════
  IF t ~ '(compra|comprar|cotacao|cotar|aquisicao|adquirir|fornecedor|pedido de material)'
    THEN RETURN 'operacional'; END IF;
  -- ═══════════════════════════════════════════════════════════════════════
  IF t ~ '(nao funciona|nao esta funcionando|parou|caiu|travand|travou|quebrad|defeito|falha|falhou|erro|bug|corrig|conserto|reparo|urgente|sem sinal|sem acesso|offline)'
    THEN RETURN 'corretiva'; END IF;
  IF t ~ '(preventiv|revisao|inspec|limpeza|checagem|vistoria|rotina de manutencao|manutencao programada)'
    THEN RETURN 'preventiva'; END IF;
  IF t ~ '(implanta|instala|nova unidade|novo sistema|migra|migracao|deploy|homologa|ativacao|start)'
    THEN RETURN 'implantacao'; END IF;
  IF t ~ '(melhor|otimiz|aprimor|refator|upgrade|atualiz|padroniz|automatiz|redesenh|nova funcionalidade|criar tela)'
    THEN RETURN 'melhoria'; END IF;
  RETURN 'operacional';
END;
$classificador$;
GRANT EXECUTE ON FUNCTION public.sugerir_tipo_chamado(text, text) TO authenticated, service_role;

-- A PALAVRA `vistoria` CONTINUA NO RAMO DE `preventiva`, e isso é decisão, não
-- esquecimento. Ela está ali desde a u6c como PALAVRA-CHAVE ("vistoria de
-- rotina" é preventiva), e o tipo novo se ESCOLHE no seletor — não se adivinha
-- por texto. Mover a palavra para um ramo próprio faria todo chamado que diz
-- "vistoria" mudar de tipo sozinho, inclusive os que hoje nascem preventiva de
-- propósito. Se um dia for para adivinhar, os DOIS gêmeos mudam juntos.

COMMENT ON FUNCTION public.sugerir_tipo_chamado(text, text) IS
  'Classificador por palavra-chave, usado por chamado_preencher quando um chamado NÃO-campo nasce sem tipo. GÊMEO EXATO de sugerirTipoChamado em src/lib/chamado-status.ts: os dois mudam juntos ou a tela promete um tipo e o registro nasce com outro. O ramo de compra devolve operacional desde a R48 (a U83 pôs o lado do banco em dia; ele ficou dois meses devolvendo pedido_compra, um tipo aposentado da seleção, e criando ficha de compra que ninguém preenchia).';

-- ═══════════════════════════════════════════════════════════════════════
-- §4) CONFERÊNCIA — obtido × esperado × veredito, no CATÁLOGO
-- ═══════════════════════════════════════════════════════════════════════
-- O QUE O DAVI OLHA: a TABELA. Ele procura '>>> OLHAR <<<' na coluna
-- `veredito`. Nada mais.
SELECT t.ordem, t.conferencia, t.valor, t.esperado,
       CASE WHEN t.esperado = '(referência)'             THEN '— referência'
            WHEN t.valor IS NOT DISTINCT FROM t.esperado THEN 'ok'
            ELSE '>>> OLHAR <<<' END AS veredito
  FROM (

-- ══ 101: A LISTA INTEIRA, VALOR POR VALOR — não "contém vistoria" ═════════
-- Um LIKE '%vistoria%' provaria que o valor novo entrou e NÃO veria que um dos
-- oito antigos saiu no mesmo DROP/ADD. A conferência é o CONJUNTO ordenado dos
-- literais extraídos do catálogo, comparado com a string esperada inteira: ela
-- pega adição, remoção e troca com a mesma linha.
SELECT 101 AS ordem,
       'CRÍTICO: o CHECK vivo aceita EXATAMENTE estes nove valores — o novo entrou e nenhum dos oito antigos saiu' AS conferencia,
       -- `AS m(grupo)` com o nome da COLUNA explícito: sem ele, `m` seria ao
       -- mesmo tempo o apelido da tabela e o da única coluna, e `m[1]` viraria
       -- um subscript sobre a linha inteira.
       -- `COLLATE "C"` NA ORDENAÇÃO, e não é preciosismo: sem ele a ordem
       -- depende da collation do banco, e o `esperado` abaixo é uma string
       -- FIXA. Com "C" a comparação é por byte, que é a mesma coisa que o
       -- `Array.prototype.sort` do verificador faz — os dois lados passam a
       -- derivar a ordem da MESMA regra, em vez de duas regras que por acaso
       -- coincidem hoje.
       (SELECT string_agg(m.grupo[1], ',' ORDER BY m.grupo[1] COLLATE "C")
          FROM pg_constraint c,
               LATERAL regexp_matches(pg_get_constraintdef(c.oid), '''([a-z_]+)''', 'g') AS m(grupo)
         WHERE c.conrelid = 'public.chamados'::regclass
           AND c.conname  = 'chamados_tipo_check') AS valor,
       -- A ORDEM É `proposta_comercial` ANTES de `prospeccao`: elas divergem na
       -- quarta letra, e `p` < `s`. A primeira versão desta linha tinha as duas
       -- trocadas — a conferência CRÍTICA teria dito '>>> OLHAR <<<' numa
       -- execução PERFEITA, que é o pior jeito de falhar, porque ensina a
       -- ignorar a coluna que existe para ser a única lida.
       'corretiva,implantacao,melhoria,operacional,pedido_compra,preventiva,proposta_comercial,prospeccao,vistoria' AS esperado

UNION ALL
-- ══ 102: E A CONSTRAINT É DE CHECK, NA COLUNA CERTA ═══════════════════════
-- `contype='c'` e a coluna em `conkey`: sem isto, uma constraint homônima de
-- outro tipo (ou sobre outra coluna) passaria pela 101, que só lê o texto.
SELECT 102, 'CRÍTICO: é uma CHECK constraint e recai sobre a coluna `tipo` — não sobre outra coluna com o nome parecido',
       (SELECT (c.contype = 'c' AND a.attname = 'tipo')::text
          FROM pg_constraint c
          JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
         WHERE c.conrelid = 'public.chamados'::regclass
           AND c.conname  = 'chamados_tipo_check'),
       'true'

UNION ALL
-- ══ 103: NADA FOI ESCRITO ═════════════════════════════════════════════════
-- Contra a foto do §2. Esta migration promete ser DDL pura; qualquer diferença
-- de zero quer dizer que ela mentiu.
SELECT 103, 'CRÍTICO: nenhuma linha entrou ou saiu de public.chamados — esta migration é DDL pura',
       ((SELECT count(*) FROM public.chamados) - (SELECT chamados_antes FROM u83_foto))::text,
       '0'

UNION ALL
-- ══ 104: E NENHUMA VISTORIA FOI INVENTADA ═════════════════════════════════
-- Sem backfill (ver o cabeçalho): o número tem de ser o mesmo de antes. E o
-- valor absoluto, logo abaixo, é o que prova que o commit A não grava nada.
SELECT 104, 'CRÍTICO: nenhum chamado virou vistoria nesta execução — não há backfill, e não havia critério para um',
       ((SELECT count(*) FROM public.chamados WHERE tipo = 'vistoria')
        - (SELECT vistorias_antes FROM u83_foto))::text,
       '0'

UNION ALL
SELECT 105, 'CRÍTICO: e o total de chamados com tipo=vistoria é ZERO enquanto o commit B não subir — se este número não for 0, alguém já está gravando o tipo novo',
       (SELECT count(*)::text FROM public.chamados WHERE tipo = 'vistoria'),
       '0'

UNION ALL
-- ══ 106: A CONSTRAINT ESTÁ VALIDADA ═══════════════════════════════════════
-- Uma constraint NOT VALID aparece no catálogo, casa a 101 e a 102, e NÃO
-- protege as linhas que já existem. É o modo silencioso desta migration virar
-- decoração.
SELECT 106, 'CRÍTICO: a constraint está VALIDADA (convalidated) — NOT VALID passaria por todas as conferências acima sem proteger uma linha sequer',
       (SELECT c.convalidated::text
          FROM pg_constraint c
         WHERE c.conrelid = 'public.chamados'::regclass
           AND c.conname  = 'chamados_tipo_check'),
       'true'

UNION ALL
-- ══ 107: O SLA NÃO MUDOU, E ISSO É AFIRMAÇÃO, NÃO OMISSÃO ═════════════════
-- `chamado_sla` é indexada por prioridade e nada mais. Se um dia alguém puser
-- tipo ali, esta linha muda de valor e a resposta do cabeçalho ("vistoria não
-- tem SLA próprio") deixa de valer sem que ninguém precise se lembrar dela.
SELECT 107, 'CRÍTICO: o SLA continua sendo função só de PRIORIDADE — chamado_sla tem uma linha por prioridade e nenhuma coluna de tipo',
       (SELECT (count(*) FILTER (WHERE a.attname = 'tipo') = 0)::text
          FROM pg_attribute a
         WHERE a.attrelid = 'public.chamado_sla'::regclass
           AND a.attnum > 0 AND NOT a.attisdropped),
       'true'

UNION ALL
-- ══ 108: O QUE EXISTE HOJE, PARA O OLHO HUMANO ════════════════════════════
SELECT 108, 'referência: quantos tipos DISTINTOS existem gravados hoje (antes: veja o valor, depois compare com a lista de nove)',
       (SELECT count(DISTINCT tipo)::text FROM public.chamados),
       '(referência)'

UNION ALL
SELECT 109, 'referência: a distribuição por tipo, para o Davi conferir que nada mudou de lugar',
       (SELECT string_agg(x.tipo || '=' || x.n::text, ' · ' ORDER BY x.n DESC, x.tipo)
          FROM (SELECT tipo, count(*) AS n FROM public.chamados GROUP BY tipo) x),
       '(referência)'

UNION ALL
-- ══ 110: O GÊMEO DO CLASSIFICADOR, MEDIDO PELO QUE ELE RESPONDE ═══════════
-- Não é "a função existe" nem "o texto tem operacional": é a RESPOSTA dela para
-- uma entrada de cada ramo, lida do banco. Um gêmeo que diverge não se detecta
-- por presença — foi assim que este ficou dois meses errado com o verificador
-- verde. `chamado_preencher` chama esta função em todo chamado NÃO-campo que
-- nasce sem tipo, então o que ela responde é o que fica gravado.
SELECT 110, 'CRÍTICO: o classificador do banco responde igual ao gêmeo TS nos seis ramos — em especial COMPRA, que devolve operacional desde a R48 e que ficou dois meses devolvendo pedido_compra, criando ficha de compra que ninguém preenchia',
       public.sugerir_tipo_chamado('Comprar cabo de rede para o rack')
       || ',' || public.sugerir_tipo_chamado('Portão não funciona, parou de abrir')
       || ',' || public.sugerir_tipo_chamado('Revisao preventiva mensal')
       || ',' || public.sugerir_tipo_chamado('Instalacao de nova unidade')
       || ',' || public.sugerir_tipo_chamado('Otimizar o fluxo de aprovacao')
       || ',' || public.sugerir_tipo_chamado('Levar o controle na portaria'),
       'operacional,corretiva,preventiva,implantacao,melhoria,operacional'

  ) t
 ORDER BY t.ordem;

COMMIT;

-- ╔═════════════════════════════════════════════════════════════════════════╗
-- ║ DESFAZER — volta o CHECK ao estado da U41 (sem 'vistoria').             ║
-- ║                                                                          ║
-- ║ SÓ FUNCIONA ENQUANTO NÃO EXISTIR NENHUM CHAMADO com tipo='vistoria': o   ║
-- ║ ADD CONSTRAINT valida a tabela inteira e devolve 23514 se houver um. É   ║
-- ║ por isso que a conferência 105 conta esse número — ela é, ao mesmo       ║
-- ║ tempo, a prova de que o commit A não grava e o pré-voo deste desfazer.   ║
-- ║ Se já houver vistorias gravadas, decida o que elas viram ANTES (o        ║
-- ║ candidato honesto é 'operacional', que é onde elas caíam antes do R112)  ║
-- ║ e só então rode o bloco abaixo.                                          ║
-- ║                                                                          ║
-- ║ E o desfazer do CÓDIGO é o par dele: reverter o commit A. Deixar o CHECK ║
-- ║ estreito com o código renderizando 'vistoria' é inofensivo (renderizar   ║
-- ║ um valor que nunca aparece não faz nada); o inverso é que quebra.        ║
-- ║                                                                          ║
-- ║   BEGIN;                                                                 ║
-- ║   SELECT count(*) AS vistorias_gravadas FROM public.chamados             ║
-- ║    WHERE tipo = 'vistoria';   -- tem de ser 0 antes de seguir            ║
-- ║   ALTER TABLE public.chamados                                            ║
-- ║     DROP CONSTRAINT IF EXISTS chamados_tipo_check;                       ║
-- ║   ALTER TABLE public.chamados ADD CONSTRAINT chamados_tipo_check         ║
-- ║     CHECK (tipo IN ('corretiva', 'preventiva', 'operacional',            ║
-- ║                     'implantacao', 'melhoria', 'pedido_compra',          ║
-- ║                     'proposta_comercial', 'prospeccao'));                ║
-- ║   COMMIT;                                                                ║
-- ╚═════════════════════════════════════════════════════════════════════════╝
