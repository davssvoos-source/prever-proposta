-- ETAPA U88 — OS DOIS CONSERTOS DE DINHEIRO QUE A FASE 4 EXIGE ANTES DE NASCER
-- Referência: docs/PRODUTO.md R118 e R119; docs/PENDENCIAS_TECNICAS.md P19 e P50.
--
-- >>> RODAR NO SQL EDITOR DA LOVABLE (Cloud → SQL editor). Idempotente.  <<<
-- >>> Rodar DEPOIS da U80 e da S4 (o §0 ABORTA se não rodaram).          <<<
-- >>> Conferir a TABELA final: procurar '>>> OLHAR <<<' na coluna veredito. <<<
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ O QUE ESTA MIGRATION CONSERTA                                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- P50 — O BOTÃO DE MONTAR FECHAMENTO ESTÁ QUEBRADO DESDE AGOSTO.
--   `public.montar_fechamento(text, date)` (u5:88) declara `fechamento_id` como
--   coluna do RETURNS TABLE e depois o usa NU duas vezes contra
--   `public.cobrancas`, que tem coluna com esse nome exato: `AND fechamento_id
--   IS NULL` (u5:134) e `WHERE fechamento_id = v_id` (u5:139). Com o
--   `plpgsql.variable_conflict = error` padrão isso é 42702 "column reference
--   is ambiguous" EM EXECUÇÃO — não na leitura, e não no CREATE. Quem chama é
--   `src/features/financeiro/fechamentos.ts:88`, o botão de montar fechamento.
--
--   AS DUAS LINHAS ESTÃO NO CAMINHO COMUM, depois do IF semanal x mensal: a
--   função inteira morre, não um ramo. E o 42702 estoura DEPOIS do INSERT em
--   `fechamentos` — como a RPC é uma instrução só, tudo volta e NENHUM rastro
--   fica no banco. É por isso que `fechamentos` vazia não distingue "ninguém
--   usou" de "todo mundo tentou e falhou", e é por isso que ninguém relatou.
--   O defeito foi achado pelo detector de classe que nasceu na U86.
--
-- P19 — O DELETE COME A COBRANÇA AVULSA VINCULADA.
--   `aprovar_chamado_financeiro` (definição VIVA: s4:210) faz, sem condição:
--     DELETE FROM public.cobrancas WHERE chamado_id = _chamado_id AND status = 'aberta';
--   A intenção era limpar o rascunho da própria aprovação antes de regravar.
--   Mas ele não distingue a cobrança que a APROVAÇÃO criou da cobrança AVULSA
--   VINCULADA que a `concluir_chamado_com_cobranca` da U80 cria — e a U80 está
--   NO AR desde 03/09. Não é risco prospectivo da Fase 4: é exposição de hoje.
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ AS CINCO PERGUNTAS, RESPONDIDAS AQUI E NÃO SÓ NO CÓDIGO                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- 1) P50: QUALIFICAR, e não renomear o parâmetro OUT.
--    A U87 escolheu NOMEAR DIFERENTE (`atendimento_id`, `dia_do_plantao`) com o
--    argumento de que isso torna a classe INEXPRIMÍVEL em vez de resolvida por
--    disciplina. O argumento continua correto — e continua GRÁTIS só no
--    NASCIMENTO de uma função. `plantao_salvar` estava nascendo; esta já é
--    contrato. `fechamentos.ts:95` lê `(l as any)?.fechamento_id` e
--    `fechamentos.tsx:76` usa o valor em `navigate({ params: { id: r.id } })`.
--    Os dois lados passam por `as any`: renomear NÃO gera erro de compilação —
--    `npx tsc --noEmit` continuaria no baseline —, o botão devolveria
--    `id: undefined` e o usuário cairia em `/fechamentos/undefined` DEPOIS de
--    montar o fechamento com sucesso. Trocaríamos um 42702 barulhento por um
--    undefined silencioso, e o deploy viraria três passos (front tolerante aos
--    dois nomes → migration → limpeza) sem nenhum deles protegido pelo tsc.
--    O QUE SE COMPRA: contrato intacto, deploy de um passo, zero push.
--    O QUE SE PAGA: a classe continua EXPRIMÍVEL aqui, e a guarda passa a ser
--    o censo do verificador em vez da impossibilidade. Preço declarado.
--
--    E NÃO É `#variable_conflict use_column`, que resolveria tudo numa linha.
--    O detector da U86 faz `if (/#variable_conflict/.test(cru)) continue;`
--    (verificar-logica.cjs:13884-13888): a diretiva esvaziaria o censo por
--    ISENÇÃO, não por conserto, e tiraria a função da vigilância PARA SEMPRE —
--    uma referência nua NOVA acrescentada aqui em 2027 nunca mais seria
--    acusada. É a regra 10 da casa na versão em que o defeito é o conserto.
--
-- 2) P50: SÃO TRÊS LUGARES, E EU TINHA ESCRITO "DUAS LINHAS".
--    O detector da U86 foi rodado literal sobre as 108 migrations. Denominador
--    declarado: 15 declarações `RETURNS TABLE`, das quais 13 em
--    `LANGUAGE plpgsql` (única linguagem onde a classe existe) e 2 em
--    `LANGUAGE sql` (imunes por construção); 2 das 13 declaram
--    `#variable_conflict use_column` e são absolvidas. Função acusada:
--    exatamente uma, `montar_fechamento` — e ela é acusada DUAS VEZES:
--    `fechamento_id x2` (as duas do §3) e `referencia x1` (o ON CONFLICT).
--
--    ── O ERRO QUE ESTA CORREÇÃO DESFAZ, E ELE É O MAIS CARO DA ENTREGA ────
--    A versão anterior deste arquivo listava `referencia x1` numa seção
--    chamada "QUATRO FALSOS POSITIVOS FICAM REGISTRADOS PARA NINGUÉM
--    CONSERTÁ-LOS", com a justificativa de que a lista de inferência do
--    ON CONFLICT não passa pelo hook de variável do plpgsql.
--
--    **O DETECTOR ESTAVA CERTO E EU O ANULEI.** Ele apontou a linha exata que
--    derrubou a primeira execução desta migration, e o cabeçalho o absolveu com
--    um mecanismo inventado — inclusive citando um campo de struct
--    (`IndexElem.name`) para dar peso de fonte a uma frase que eu não tinha
--    como verificar. Escrever "falso positivo" ao lado de uma acusação
--    verdadeira é pior que não ter detector nenhum: um detector sem argumento
--    faz alguém ir olhar; um detector com um argumento errado ao lado faz todo
--    mundo parar de olhar.
--
--    A REGRA QUE FICA: ferramenta que acusa só é absolvida por PROVA
--    EXECUTADA, nunca por raciocínio sobre o interior do motor. Quando não dá
--    para executar, a acusação vira DÍVIDA declarada — não absolvição.
--
--    OS FALSOS POSITIVOS QUE CONTINUAM SENDO FALSOS, esses sim verificáveis
--    por leitura direta do literal:
--    · `total x1` em aprovar_os_financeiro (u4:198) e nas versões U7/U13/U80 de
--      aprovar_chamado_financeiro é a palavra dentro do literal ' item(ns),
--      total ' — texto de evento, não referência de coluna. Dá para conferir
--      abrindo a linha: está entre aspas. A S4 não aparece porque foi ela que
--      tirou a cifra.
--
--    O censo do verificador passa a ser medido sobre a definição VIVA de cada
--    função, e não sobre todo texto do repositório — e ganhou um IRMÃO para a
--    classe do ON CONFLICT, que ninguém estava varrendo. Ver o §7 desta
--    migration e os dois censos em verificar-logica.cjs.
--
-- 3) P19: O DISCRIMINADOR JÁ EXISTE NA LINHA, e chama-se `chamado_peca_id`.
--    Não é preciso coluna de origem nem carimbo de quem criou (regra 8:
--    PREFIRA APAGAR A ACRESCENTAR). Censo de TODOS os escritores de
--    `public.cobrancas` no repositório:
--      · os INSERTs de aprovação (u4:168, u7:716, u13:97, u80:600, s4:212)
--        selecionam `p.id` de `chamado_pecas` — PK, nunca NULL. 100% das linhas
--        nascidas de aprovação têm `chamado_peca_id` PREENCHIDO;
--      · `concluir_chamado_com_cobranca` no ramo 'lancar' (u80:473-480) grava
--        NULL LITERAL nessa coluna, com `chamado_id` preenchido;
--      · `lancarCobrancaAvulsa` (fechamentos.ts:125-157) não manda `chamado_id`
--        no payload — é o avulso SEM chamado, e o DELETE nunca o alcançou.
--    Logo `chamado_id IS NOT NULL AND chamado_peca_id IS NULL` é ASSINATURA DE
--    ORIGEM **NO NASCIMENTO**: nenhum ESCRITOR de aprovação produz essa forma.
--
--    E A ASSINATURA PODE SER APAGADA DEPOIS, POR UM MUTADOR — o censo acima é
--    de escritores, e escritor não é a única coisa que muda uma linha.
--    `cobrancas.peca_id` (renomeada para `chamado_peca_id` em u7:59) é
--    `REFERENCES public.os_pecas(id) ON DELETE SET NULL` desde u4:31-32, e o
--    comentário da U4 diz o porquê, por extenso: *"SET NULL: apagar a peça não
--    pode apagar a cobrança já aprovada"*. Ou seja: APAGAR A PEÇA transforma
--    uma cobrança NASCIDA DE APROVAÇÃO na forma que este §2 passou a proteger.
--
--    O CENÁRIO, todo em DetalheCampo: aprovar (nasce a cobrança da peça) →
--    reabrir → apagar a peça (a FK zera `chamado_peca_id` e
--    `chamado_pecas_analise` cascateia) → concluir → aprovar de novo. Antes
--    desta migration a linha órfã morria no DELETE incondicional; depois dela
--    ela SOBREVIVE, é contada como viva e o total volta com ela dentro — uma
--    cobrança por uma peça que não existe mais, permanente.
--
--    NÃO DÁ PARA DISTINGUIR AS DUAS PELA LINHA, e é por isso que aqui não se
--    inventa coluna (regra 8): depois da FK zerar, a órfã de aprovação e a
--    avulsa vinculada são IDÊNTICAS no dado. Fica declarado como dívida, com o
--    cenário escrito, e a conferência 101 desdobra a contagem para não misturar
--    as duas populações — o chamado que NÃO tem peça nenhuma é avulso legítimo;
--    o que TEM peça é suspeita de órfã.
--
--    MELHOR AINDA: A U80 JÁ CRAVOU ESSE RECORTE EM ÍNDICE ÚNICO VIVO.
--    `cobrancas_avulsa_unica_por_chamado_idx` (u80:152-176) é
--    `WHERE chamado_id IS NOT NULL AND chamado_peca_id IS NULL AND status <>
--    'cancelada'`, e o COMMENT dela nomeia a forma com todas as letras:
--    'Cobrança avulsa VINCULADA a chamado'. O índice irmão
--    `cobrancas_uma_por_peca_idx` usa o predicado complementar. Estreitar o
--    DELETE não inventa recorte: usa o que o catálogo já tem gravado.
--
--    AS TRÊS OUTRAS CANDIDATAS, MEDIDAS E RECUSADAS — escritas aqui para
--    ninguém as repropor em 2027:
--      · `fechamento_id IS NULL` não é sinal de PROVENIÊNCIA, é de CICLO DE
--        VIDA: `montar_fechamento` (u5:131) recolhe por `status='aberta' AND
--        data_referencia BETWEEN`, sem olhar origem — rascunho e avulsa
--        vinculada ficam recolhidos igual. E discordaria de um índice vivo.
--      · a ausência de `chamado_pecas_analise` é propriedade do CHAMADO, não da
--        LINHA: não separa duas cobranças do mesmo chamado.
--      · `criada_por` é o MESMO usuário nos dois casos (u80:480 e s4:218 gravam
--        `auth.uid()`, e as duas portas exigem papel financeiro).
--
--    E O ESTREITAMENTO NÃO DEIXA DE LIMPAR NADA. Como todo rascunho de
--    aprovação tem `chamado_peca_id` preenchido, o DELETE estreitado remove
--    exatamente o mesmo conjunto de hoje MENOS a avulsa vinculada. A
--    reaprovação legítima continua funcionando, e ela PRECISA do DELETE: sem
--    ele o INSERT da segunda aprovação bateria em `cobrancas_uma_por_peca_idx`
--    com 23505. O PORTÃO prova os dois lados (provas 2a e 2b).
--
--    UMA LINHA SÓ É INSUFICIENTE, E A S4 JÁ TINHA DITO (s4:128-134). Com o
--    DELETE estreitado, um chamado com avulsa vinculada e zero peças faturáveis
--    dá `v_itens = 0`, e o corpo vivo crava `sem_cobranca` (s4:228) e grava
--    'Conferência concluída: nada a cobrar.' (s4:233) com dinheiro vivo na
--    tabela. Trocaria "o dinheiro some e a linha do tempo confirma que não
--    havia dinheiro" por "o dinheiro fica e o status mente". SÃO TRÊS EDIÇÕES,
--    e não uma: o predicado do DELETE, a decisão de `faturamento_status` e o
--    texto do evento.
--
--    O RECORTE DE "VIVA", DECLARADO: a decisão de `faturamento_status` passa a
--    contar `status <> 'cancelada'`, e NÃO `= 'aberta'`. `sem_cobranca` é
--    afirmação sobre o ATENDIMENTO ("não há o que cobrar aqui"), não sobre o
--    período aberto: com `= 'aberta'`, um chamado cuja única cobrança já foi
--    FECHADA num período voltaria a ser carimbado `sem_cobranca` numa
--    reaprovação. `<> 'cancelada'` é o mesmo recorte de `montar_fechamento`
--    (u5:139), dos dois índices da U80 e do `v_vivas` de
--    `concluir_chamado_com_cobranca`. `v_total` FICA em `= 'aberta'`, e a
--    divergência é DELIBERADA: são duas perguntas diferentes — "existe algo a
--    cobrar neste atendimento" (existência, ao longo da vida) e "quanto está em
--    aberto agora" (saldo). Está escrito aqui para não ser "limpado" depois.
--
--    EFEITO COLATERAL DECLARADO NO `total` DEVOLVIDO: `v_total` (s4:224-225) já
--    soma DEPOIS do DELETE. Hoje ele exclui a avulsa porque ela foi apagada;
--    com o DELETE estreitado ele passa a INCLUÍ-la, sem que esta migration toque
--    naquela linha. O número que `aprovarCobranca` recebe e a tela pinta muda
--    sozinho — e muda PARA MELHOR: passa a ser o que o chamado tem em aberto.
--
-- 4) P19: A POPULAÇÃO AFETADA HOJE, medida em SELECT de leitura pura.
--    O §1 desta migration a mede antes de qualquer escrita, e a conferência 101
--    a repete na tabela final. O recorte declara-se: são as cobranças com
--    chamado vinculado e SEM peça — a forma que NENHUMA aprovação produz.
--    NUM BANCO LIMPO ELE RESPONDE ZERO em todas as colunas, e isso é censo e
--    não suposição: a U69:47-55 fez `DELETE FROM public.cobrancas`,
--    `DELETE FROM public.fechamentos` e `DELETE FROM public.chamados`, e a
--    única porta que produz esta forma é a `concluir_chamado_com_cobranca` da
--    U80 (03/09), mais a escrita direta por PostgREST sob `cobrancas_write`.
--    SE VOLTAR ZERO, o conserto é preventivo e barato — mas NÃO dispensável: o
--    produtor está no ar e a próxima conclusão com cobrança cria a primeira
--    linha. SE VOLTAR LINHA, existe dinheiro já lançado que uma aprovação pode
--    apagar, e a coluna `ja_recolhidos_em_fechamento` diz se o estrago alcança
--    um período já montado. O número vai para o diário.
--
-- 5) A ORDEM DE DEPLOY: UMA MIGRATION, UMA TRANSAÇÃO, ZERO PUSH — e o P19
--    NUNCA depois do P50. A ordem é propriedade do CÓDIGO (regra 5):
--
--    (a) ZERO PUSH porque as duas funções são `CREATE OR REPLACE` com a MESMA
--        assinatura e com os MESMOS nomes de coluna no RETURNS TABLE. PostgREST
--        não precisa de recarga (a rota /rest/v1/rpc já existe), nenhum arquivo
--        de src/ muda, e o front lê tudo por `as any`. A ausência de push é
--        COMPRADA com a preservação dos nomes — é o mesmo fato da resposta 1.
--
--    (b) OS DOIS NA MESMA TRANSAÇÃO, e não em duas migrations, porque
--        CONSERTAR O P50 SOZINHO ABRE UM MODO DE FALHA NOVO E PIOR.
--        `montar_fechamento` recolhe carimbando `fechamento_id` mas DEIXA
--        `status = 'aberta'` (u5:131-135; quem muda para 'fechada' é
--        `fechar_periodo`, u5:163). Logo uma parcela recém-recolhida para um
--        fechamento ABERTO continua casando com `WHERE chamado_id = _ AND
--        status = 'aberta'` e o DELETE do P19 a apaga de DENTRO do fechamento.
--        E `fechamentos.total` foi gravado no momento da montagem (u5:141) e só
--        é recalculado em `fechar_periodo` ou `excluir_fechamento`: nada o
--        recalcula depois de um DELETE. A lista pinta o total ARMAZENADO
--        (fechamentos.tsx:273) e o PDF/CSV somam as LINHAS (`consolidar()`) —
--        os dois discordariam em silêncio.
--        HOJE O 42702 É, SEM QUERER, A TRAVA QUE SEGURA O P19: como
--        `montar_fechamento` nunca rodou, não há fechamento de onde o dinheiro
--        possa sumir. Consertar o P50 primeiro destrava exatamente isso.
--        O PORTÃO PROVA A COMPOSIÇÃO (prova 5): monta um fechamento, e a
--        aprovação seguinte NÃO tira a linha de dentro dele.
--
--    (c) NO INSTANTE DO COMMIT, sem push:
--        · o botão de montar fechamento sai de "sempre 42702" para "funciona".
--          Não existe estado intermediário pior que hoje.
--        · `aprovar_chamado_financeiro` para de comer a avulsa vinculada e
--          passa a carimbar 'aprovada' onde antes carimbava 'sem_cobranca'.
--          `DetalheCampo.tsx` desenha isso sozinho, porque lê a coluna.
--        · o `total` devolvido por `aprovarCobranca` passa a incluir as avulsas
--          sobreviventes (efeito colateral declarado na resposta 3).
--
--    (d) NENHUMA DAS DUAS TEM CHAMADOR DENTRO DO BANCO — não há trigger, cron
--        nem PERFORM sobre elas em migration alguma. Por isso a análise de
--        ordem se esgota no src/, e por isso ela é analisável.
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ O QUE ESTA MIGRATION **NÃO** FAZ, e cada "não" tem motivo escrito        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ CORREÇÃO DE 03/09 — A PRIMEIRA VERSÃO DESTE ARQUIVO AFIRMOU UMA FALSIDADE ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- A versão anterior tinha, exatamente aqui, um parágrafo dizendo que
-- `ON CONFLICT (tipo, referencia)` NÃO PODE levantar 42702 — "a lista de
-- inferência de índice não é expressão: o parser guarda o nome em
-- `IndexElem.name` e o resolve direto contra a relação alvo, sem passar pelo
-- hook de variável do plpgsql".
--
-- ISSO ESTAVA ERRADO, e o banco do Davi provou na primeira execução:
--
--     ERROR: 42702: column reference "referencia" is ambiguous
--     DETAIL: It could refer to either a PL/pgSQL variable or a table column.
--     QUERY: INSERT INTO public.fechamentos (tipo, referencia, inicio, fim, created_by)
--
-- O MECANISMO REAL: em `resolve_unique_index_expr` (parse_clause.c), um
-- elemento de inferência que é um NOME SIMPLES é embrulhado num `ColumnRef`
-- construído na hora e passado por `transformExpr`. É `transformColumnRef` que
-- chama os hooks `pre/post_column_ref` — e é neles que o plpgsql injeta a
-- resolução de variável. Só o elemento que já vem como EXPRESSÃO pula esse
-- caminho. Ou seja: a lista de inferência passa pelo hook exatamente como
-- qualquer outra referência de coluna, e `referencia` — que é parâmetro OUT do
-- RETURNS TABLE — colide ali como colidia nas outras duas linhas.
--
-- ONDE A AMBIGUIDADE **NÃO** ESTÁ, por eliminação: a lista de colunas-alvo do
-- INSERT (`(tipo, referencia, inicio, fim, created_by)`) é resolvida por
-- `checkInsertTargets` contra a relação alvo, sem passar por `transformExpr` —
-- e o `RETURNING id, status` cita nomes que não são variáveis desta função.
-- Sobra um único `referencia` capaz de alcançar o hook: o do ON CONFLICT.
--
-- ── O QUE SE FAZ AGORA, E POR QUE ESTA ESCOLHA E NÃO OUTRA ────────────────
-- Depois de errar sobre o parser, o conserto NÃO PODE depender de eu acertar
-- sobre o parser na segunda tentativa. Então não se qualifica nada: **elimina-
-- se a referência de coluna**. O §3a promove o índice único `fechamentos_unico`
-- (u5:60) a CONSTRAINT de mesmo nome — `ADD CONSTRAINT ... UNIQUE USING INDEX`,
-- que reaproveita o índice existente sem reconstruí-lo — e o upsert passa a
-- dizer `ON CONFLICT ON CONSTRAINT fechamentos_unico`. Ali não há ColumnRef
-- nenhum: é um identificador procurado em `pg_constraint`. A classe deixa de
-- ser resolvida por disciplina e passa a ser INEXPRIMÍVEL, que é o critério da
-- U87.
--
-- AS TRÊS SAÍDAS RECUSADAS, escritas para ninguém as repropor:
--   · `ON CONFLICT (tipo, (fechamentos.referencia))` — talvez funcione, e
--     "talvez" é exatamente o que não serve depois de um erro deste tipo.
--   · `#variable_conflict use_column` — resolveria numa linha, e o argumento
--     contra continua valendo por inteiro: ela ISENTA a função do detector da
--     U86 PARA SEMPRE (verificar-logica.cjs:13884-13888 pula quem a declara),
--     trocando conserto por cegueira.
--   · renomear o parâmetro OUT `referencia` — é contrato com fechamentos.ts:95,
--     lido por `as any`, então o tsc não acusaria e o deploy viraria três
--     passos. É o mesmo motivo da resposta 1 acima.
--
-- ── E O PORTÃO FEZ O TRABALHO DELE ────────────────────────────────────────
-- O parágrafo antigo terminava assim, e esta parte estava CERTA: "o PORTÃO
-- chama a função DUAS VEZES no mesmo período de propósito; se o ON CONFLICT
-- fosse ambíguo, esta migration ABORTA e nada é commitado". Foi o que
-- aconteceu. O 42702 estourou na PROVA 1, a transação inteira voltou, e o banco
-- do Davi ficou exatamente como estava. Um portão que só lesse o texto das
-- funções teria dado COMMIT com a função tão quebrada quanto antes.
--
-- ── E UM CENSO, PORQUE A AFIRMAÇÃO FALSA PODIA ESTAR PROTEGENDO OUTRAS ────
-- Se a lista de inferência passa pelo hook, toda função plpgsql com
-- `ON CONFLICT (col)` onde `col` também é variável está morta do mesmo jeito.
-- Varredura das 108 migrations, 89 funções plpgsql: ACUSADA exatamente UMA,
-- `montar_fechamento`, `referencia`. Não há segunda. O censo virou asserção
-- permanente no verificador, para que a próxima função que nascer com a forma
-- seja acusada antes de chegar ao banco.
--
-- · NÃO muda `marcar_chamado_faturado` (u7:747, definição viva). Ela tem a MESMA
--   forma incondicional do P19 — `UPDATE public.cobrancas SET status='faturada'
--   WHERE chamado_id = _chamado_id AND status IN ('aberta','fechada')` — e
--   varre a avulsa vinculada junto com as cobranças de peça. A DECISÃO É
--   DELIBERADA E FICA COMO ESTÁ, com o motivo escrito: ao contrário do DELETE,
--   ela NÃO É DESTRUTIVA (muda status, não apaga linha) e o comportamento é o
--   DESEJADO — faturar o chamado é faturar tudo que está pendurado nele; um
--   avulso vinculado que ficasse 'aberta' depois de o chamado ser faturado
--   seria dinheiro esquecido, que é o defeito oposto e pior. Sem esta linha,
--   ficaria a assimetria não declarada de o DELETE distinguir origem e o UPDATE
--   não. O §4 grava a decisão num COMMENT, onde o próximo leitor olha.
--
-- · NÃO acrescenta `AND fechamento_id IS NULL` ao DELETE do P19. Seria OUTRA
--   entrega: transformaria uma corrupção silenciosa num 23505 duro na
--   reaprovação (por `cobrancas_uma_por_peca_idx`), o que talvez seja o certo —
--   e é decisão de produto, não conserto de defeito. Com o P50 vivo, a prova 5
--   do portão mostra que a linha recolhida SOBREVIVE à aprovação, que é o que
--   esta entrega promete. Fica como P52.
--
-- · NÃO reescreve `concluir_chamado_com_cobranca`. A disjunção do passo 6 dela
--   (u80:406-410) é de MÃO ÚNICA: ela recusa 'lancar' sobre chamado que já tem
--   análise, mas nada impede APROVAR sobre chamado já lançado. A trava certa
--   para esse par é no MOTOR de aprovação, que é o que o §2 faz — e não uma
--   segunda recusa na outra porta, que só cobriria metade do par.
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ATENÇÃO — O PORTÃO DESTA MIGRATION ESCREVE NA TABELA DE DINHEIRO         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- `montar_fechamento` NÃO é read-only: ela dá UPDATE em `public.cobrancas`. Um
-- portão que a chamasse com data-base do mês corrente RE-ARQUIVARIA todas as
-- cobranças abertas de produção dentro de um fechamento de teste. POR ISSO
-- todas as janelas do portão são de 1900 (o idioma da U86/U87), o portão AFIRMA
-- o número de linhas recolhidas contra a própria fixture (v_itens = 1, provando
-- que não pegou mais nada), e o §0 ABORTA se já existir qualquer linha anterior
-- a 1990 em `cobrancas` ou `fechamentos` — porque então a limpeza do portão
-- comeria dado que não é dele.
--
-- E O PORTÃO PERSONIFICA, senão ele fica VERDE POR CAUSA DO DEFEITO.
-- `montar_fechamento` tem como PRIMEIRA instrução executável
-- `IF NOT public.pode_ver_financeiro(auth.uid())`, e no SQL Editor não há JWT:
-- `auth.uid()` é NULL, `pode_ver_financeiro(NULL)` é false, e a chamada morre em
-- 42501 ANTES de chegar nas linhas ambíguas. Um portão que só verificasse "não
-- levantou 42702" passaria com a função exatamente tão quebrada quanto hoje. O
-- remédio é `set_config('request.jwt.claims', …, true)` DENTRO da transação, e
-- o portão CONFERE que a personificação pegou antes de provar qualquer coisa.
-- A saída da U87 (curto-circuito `IF v_eu IS NOT NULL`) não serve aqui: o gate
-- da U5 é contrato vivo e não se afrouxa uma trava de papel para o teste rodar.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- §0) PRÉ-VOO — ele ABORTA, e confere LITERAL contra a definição VIVA
-- ═══════════════════════════════════════════════════════════════════════════
-- O repositório é evidência do que foi ESCRITO, não do que foi APLICADO. Tudo
-- aqui é medido em `pg_proc.prosrc`, no banco, e não no arquivo. A U84 ia
-- abortar exatamente por não fazer isto.
DO $preVoo$
DECLARE
  v_src   text;
  v_n     bigint;
  v_user  uuid;
BEGIN
  -- ── ORDEM: a U80 e a S4 têm de ter rodado ────────────────────────────────
  IF to_regprocedure('public.concluir_chamado_com_cobranca(uuid,text,text,numeric,numeric[],text)') IS NULL THEN
    RAISE EXCEPTION E'ABORTADO — nada foi alterado (ROLLBACK).\nA U80 (20260903090000) ainda não rodou neste banco: `concluir_chamado_com_cobranca` não existe.\nRode a U80, depois a S4, e só então esta.';
  END IF;
  IF to_regprocedure('public.aprovar_chamado_financeiro(uuid)') IS NULL THEN
    RAISE EXCEPTION E'ABORTADO — nada foi alterado (ROLLBACK).\n`aprovar_chamado_financeiro(uuid)` não existe neste banco.';
  END IF;
  IF to_regprocedure('public.montar_fechamento(text,date)') IS NULL THEN
    RAISE EXCEPTION E'ABORTADO — nada foi alterado (ROLLBACK).\n`montar_fechamento(text,date)` não existe neste banco: a U5 não rodou.';
  END IF;

  -- ── O CORPO VIVO DE `aprovar_chamado_financeiro` É O DA S4, MEDIDO ───────
  -- Presença nunca detecta DELEÇÃO (regra 2) — mas aqui a pergunta é outra:
  -- "a última definição APLICADA é mesmo a da S4?". As quatro marcas abaixo
  -- separam a S4 da U80 (que não tem gate nem as colunas certas), da U13 (que
  -- tem a cifra e não tem o fuso) e da U7 (que tem `decisao`/`valor_cobravel`).
  SELECT p.prosrc INTO v_src FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'aprovar_chamado_financeiro';
  IF v_src NOT LIKE '%pode_ver_financeiro(auth.uid())%' THEN
    RAISE EXCEPTION E'ABORTADO — nada foi alterado (ROLLBACK).\nO corpo VIVO de aprovar_chamado_financeiro NÃO tem o gate `pode_ver_financeiro` — ele é o da U80, que a S4 corrigiu.\nRode a S4 (20260903180000) ANTES desta migration: reescrever a partir daqui apagaria a correção dela.';
  END IF;
  IF v_src NOT LIKE '%America/Sao_Paulo%' THEN
    RAISE EXCEPTION E'ABORTADO — nada foi alterado (ROLLBACK).\nO corpo VIVO de aprovar_chamado_financeiro não tem o fuso de Brasília: ele é anterior à U80/S4.';
  END IF;
  IF v_src LIKE '%valor_cobravel%' OR v_src LIKE '%a.decisao%' THEN
    RAISE EXCEPTION E'ABORTADO — nada foi alterado (ROLLBACK).\nO corpo VIVO de aprovar_chamado_financeiro usa `valor_cobravel`/`decisao` — colunas que morreram na U13. É o corpo da U7.';
  END IF;
  IF v_src LIKE '%to_char(v_total%' THEN
    RAISE EXCEPTION E'ABORTADO — nada foi alterado (ROLLBACK).\nO corpo VIVO de aprovar_chamado_financeiro ainda grava a CIFRA no evento: ele é o da U13, não o da S4. Rode a S4 primeiro.';
  END IF;
  -- E o defeito P19 tem de estar VIVO. Se já não estiver, alguém consertou à
  -- mão e este arquivo passaria por cima de um corpo desconhecido.
  -- DUAS FORMAS CONHECIDAS, E A SEGUNDA É A DESTA MIGRATION. Exigir só a forma
  -- da S4 fazia a SEGUNDA execução abortar com "alguém já mexeu nesta função
  -- fora do repositório" — mandando caçar um sabotador que é esta própria
  -- migration. O cabeçalho promete idempotência, e a U86/U87 cumprem; aqui a
  -- promessa quebrava no pré-voo. Aborta-se na TERCEIRA forma, que é a
  -- desconhecida de verdade.
  IF v_src NOT LIKE '%DELETE FROM public.cobrancas WHERE chamado_id = _chamado_id AND status = ''aberta'';%'
 AND v_src NOT LIKE '%chamado_id = _chamado_id AND status = ''aberta''%AND chamado_peca_id IS NOT NULL;%' THEN
    RAISE EXCEPTION E'ABORTADO — nada foi alterado (ROLLBACK).\nO DELETE de aprovar_chamado_financeiro não está nem na forma da S4 (defeito P19 vivo) nem na da U88 (já corrigida): o corpo é DESCONHECIDO.\nNÃO sobrescreva às cegas: compare `pg_get_functiondef` com o §2 desta migration antes de decidir.';
  END IF;

  -- ── E O DEFEITO P50 TAMBÉM TEM DE ESTAR VIVO ─────────────────────────────
  SELECT p.prosrc INTO v_src FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'montar_fechamento';
  -- Idem: a forma NUA (U5, defeito vivo) ou a QUALIFICADA (esta migration).
  -- Qualquer outra é corpo desconhecido, e aí sim aborta.
  IF (v_src NOT LIKE '%AND fechamento_id IS NULL%'   OR v_src NOT LIKE '%WHERE fechamento_id = v_id%')
 AND (v_src NOT LIKE '%AND c.fechamento_id IS NULL%' OR v_src NOT LIKE '%WHERE c.fechamento_id = v_id%') THEN
    RAISE EXCEPTION E'ABORTADO — nada foi alterado (ROLLBACK).\nO corpo vivo de montar_fechamento não está nem na forma NUA da U5 (defeito P50 vivo) nem na QUALIFICADA da U88 (já corrigida): é corpo DESCONHECIDO.\nCompare `pg_get_functiondef(''public.montar_fechamento(text,date)''::regprocedure)` com o §3 antes de decidir.';
  END IF;
  IF v_src LIKE '%variable_conflict%' THEN
    RAISE EXCEPTION E'ABORTADO — nada foi alterado (ROLLBACK).\nO corpo vivo de montar_fechamento declara `#variable_conflict`. Não é o corpo da U5, e o §3 desta migration removeria essa diretiva sem que ninguém tivesse decidido isso.';
  END IF;

  -- ── O PORTÃO PRECISA DE MATÉRIA-PRIMA, E ELE APAGA O QUE É ANTERIOR A 1990 ─
  SELECT count(*) INTO v_n FROM public.cobrancas b WHERE b.data_referencia < DATE '1990-01-01';
  IF v_n > 0 THEN
    RAISE EXCEPTION E'ABORTADO — nada foi alterado (ROLLBACK).\nJá existem % cobranças com data_referencia anterior a 1990 neste banco. A limpeza do PORTÃO apaga tudo que é anterior a 1990, e comeria essas linhas.\nInvestigue-as antes de rodar.', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM public.fechamentos f WHERE f.inicio < DATE '1990-01-01';
  IF v_n > 0 THEN
    RAISE EXCEPTION E'ABORTADO — nada foi alterado (ROLLBACK).\nJá existem % fechamentos com início anterior a 1990 neste banco. A limpeza do PORTÃO os apagaria.', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM public.chamados c WHERE c.numero LIKE 'U88-PORTAO-%';
  IF v_n > 0 THEN
    RAISE EXCEPTION E'ABORTADO — nada foi alterado (ROLLBACK).\nJá existem % chamados numerados U88-PORTAO-%%. Uma execução anterior desta migration não limpou o que criou.', v_n;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.clientes) THEN
    RAISE EXCEPTION E'ABORTADO — nada foi alterado (ROLLBACK).\nNão há nenhum cliente neste banco, e `cobrancas.cliente_id` é NOT NULL: o PORTÃO não tem como montar a fixture, e sem PORTÃO esta migration não prova nada.';
  END IF;

  SELECT p.id INTO v_user FROM public.profiles p
   WHERE public.pode_ver_financeiro(p.id) ORDER BY p.id LIMIT 1;
  IF v_user IS NULL THEN
    RAISE EXCEPTION E'ABORTADO — nada foi alterado (ROLLBACK).\nNão há NENHUM usuário para quem `pode_ver_financeiro` seja verdadeiro (admin ou comercial).\nO PORTÃO precisa personificar um deles: as duas funções desta entrega começam por esse gate, e sem personificação elas morrem em 42501 ANTES de tocar no defeito — o portão ficaria VERDE POR CAUSA DO DEFEITO.';
  END IF;

  RAISE NOTICE 'PRÉ-VOO U88: definições vivas conferidas (S4 em aprovar_chamado_financeiro, U5 em montar_fechamento), os dois defeitos presentes, banco sem resíduo anterior a 1990.';
END
$preVoo$;

-- ═══════════════════════════════════════════════════════════════════════════
-- §1) A MEDIÇÃO — leitura pura, ANTES de qualquer escrita (pergunta 4)
-- ═══════════════════════════════════════════════════════════════════════════
-- O recorte declara-se: cobranças NÃO CANCELADAS com chamado vinculado e SEM
-- peça. É a forma que nenhuma aprovação jamais produziu (censo de escritores no
-- cabeçalho), logo é a população que o DELETE incondicional come sem recriar.
-- `na_mira_e_aprovavel_hoje` é a coluna que decide a natureza do conserto: só
-- chamado 'concluido' passa pela trava de s4:196.
DO $medir$
DECLARE
  v_vivos int; v_mira int; v_chs int; v_reais numeric; v_hoje int; v_fech int;
BEGIN
  SELECT count(*),
         count(*) FILTER (WHERE b.status = 'aberta'),
         count(DISTINCT b.chamado_id) FILTER (WHERE b.status = 'aberta'),
         COALESCE(sum(b.valor) FILTER (WHERE b.status = 'aberta'), 0),
         count(*) FILTER (WHERE b.status = 'aberta' AND c.status = 'concluido'),
         count(*) FILTER (WHERE b.status = 'aberta' AND b.fechamento_id IS NOT NULL)
    INTO v_vivos, v_mira, v_chs, v_reais, v_hoje, v_fech
    FROM public.cobrancas b
    JOIN public.chamados c ON c.id = b.chamado_id
   WHERE b.chamado_peca_id IS NULL
     AND b.chamado_id IS NOT NULL
     AND b.status <> 'cancelada';

  RAISE NOTICE 'U88 POPULAÇÃO P19: avulsos_vinculados_vivos=%, na_mira_do_delete=%, chamados_expostos=%, reais_na_mira=%, na_mira_e_aprovavel_hoje=%, ja_recolhidos_em_fechamento=%',
    v_vivos, v_mira, v_chs, v_reais, v_hoje, v_fech;
  IF v_mira > 0 THEN
    RAISE NOTICE 'U88: NÃO é conserto preventivo — há % linha(s) que uma aprovação apagaria HOJE. O número vai para o diário.', v_mira;
  END IF;
END
$medir$;

-- ═══════════════════════════════════════════════════════════════════════════
-- §2) P19 — O MOTOR DE APROVAÇÃO PARA DE COMER A AVULSA VINCULADA
-- ═══════════════════════════════════════════════════════════════════════════
-- BASE: o corpo VIVO da S4 (s4:183-238), e NÃO o da U13, nem o da U80.
-- A U80 §4b reescreveu esta função a partir do corpo ERRADO — copiou a U7 em
-- vez da U13 viva — e teria revertido em silêncio o gate `pode_ver_financeiro`,
-- os nomes de coluna, a trava de status e o `sem_cobranca`. A asserção que
-- guardava a promessa checava PRESENÇA de três coisas, e PRESENÇA NUNCA DETECTA
-- DELEÇÃO. A asserção desta migration é um DIFF contra o corpo da S4 com as
-- QUATRO mudanças escritas à mão (verificar-logica.cjs), e o §0 acima confere o
-- corpo VIVO no catálogo antes de deixar a migration escrever.
--
-- AS QUATRO MUDANÇAS, E NENHUMA A MAIS:
--   (a) `v_vivas` no DECLARE;
--   (b) o DELETE ganha `AND chamado_peca_id IS NOT NULL` — o discriminador que
--       já existe na linha e que a U80 já cravou em índice único;
--   (c) `v_vivas` é contado DEPOIS do INSERT, com o recorte `<> 'cancelada'`;
--   (d) `faturamento_status` e o texto do evento passam a olhar `v_vivas` (o
--       que EXISTE vivo no chamado) em vez de `v_itens` (o ROW_COUNT do próprio
--       INSERT). Sem (d), o dinheiro ficaria e o status mentiria.
--
-- O GATE CONTINUA SENDO A PRIMEIRA INSTRUÇÃO EXECUTÁVEL, e isso é medido: em
-- SECURITY DEFINER com GRANT a authenticated, ele é a R13 inteira.
CREATE OR REPLACE FUNCTION public.aprovar_chamado_financeiro(_chamado_id uuid)
RETURNS TABLE (itens integer, total numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $u88a$
DECLARE
  v_ch record; v_revisar int; v_competencia text; v_data date;
  v_itens int := 0; v_total numeric := 0; v_vivas int := 0;
BEGIN
  IF NOT public.pode_ver_financeiro(auth.uid()) THEN
    RAISE EXCEPTION 'Somente quem responde pelo financeiro pode aprovar cobrança.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_ch FROM public.chamados WHERE id = _chamado_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chamado não encontrado.'; END IF;
  IF v_ch.status <> 'concluido' THEN
    RAISE EXCEPTION 'O chamado precisa estar concluído para ter a cobrança aprovada.';
  END IF;

  SELECT count(*) INTO v_revisar FROM public.chamado_pecas_analise a
   WHERE a.chamado_id = _chamado_id AND a.resultado IN ('revisar','nao_identificado');
  IF v_revisar > 0 THEN
    RAISE EXCEPTION 'Ainda há % item(ns) em revisão. Resolva antes de aprovar.', v_revisar;
  END IF;

  v_data := COALESCE(v_ch.finalizada_em, v_ch.concluida_em, v_ch.created_at)
              AT TIME ZONE 'America/Sao_Paulo';
  v_competencia := to_char(v_data, 'YYYY-MM');

  -- O DELETE limpa o RASCUNHO DESTA APROVAÇÃO, e só ele.
  -- `chamado_peca_id IS NOT NULL` é assinatura de ORIGEM, não heurística:
  -- todo INSERT de aprovação preenche essa coluna com `p.id` (PK, nunca NULL),
  -- e o único escritor que grava NULL ali com chamado preenchido é o ramo
  -- 'lancar' de concluir_chamado_com_cobranca — a cobrança AVULSA VINCULADA.
  -- É o MESMO recorte que a U80 gravou em cobrancas_avulsa_unica_por_chamado_idx.
  -- A limpeza NÃO ENCOLHE: nenhuma linha de aprovação deixa de ser apagada, e
  -- por isso a reaprovação continua não batendo em cobrancas_uma_por_peca_idx.
  DELETE FROM public.cobrancas
   WHERE chamado_id = _chamado_id AND status = 'aberta'
     AND chamado_peca_id IS NOT NULL;

  INSERT INTO public.cobrancas
    (cliente_id, chamado_id, chamado_peca_id, contrato_id, descricao, quantidade,
     valor_unitario, valor, competencia, data_referencia, tipo_servico, criada_por)
  SELECT v_ch.cliente_id, _chamado_id, p.id, v_ch.contrato_id, p.descricao, p.quantidade,
         a.valor_calculado, round(a.valor_calculado * p.quantidade, 2),
         v_competencia, v_data, COALESCE(v_ch.tipo_servico,'manutencao'), auth.uid()
    FROM public.chamado_pecas p
    JOIN public.chamado_pecas_analise a ON a.peca_id = p.id
   WHERE p.chamado_id = _chamado_id AND a.resultado = 'faturavel'
     AND a.valor_calculado IS NOT NULL AND a.valor_calculado > 0;
  GET DIAGNOSTICS v_itens = ROW_COUNT;

  -- SALDO: o que está em ABERTO agora. Com o DELETE estreitado ele passa a
  -- incluir as avulsas vinculadas sobreviventes — efeito colateral declarado.
  SELECT COALESCE(sum(valor),0) INTO v_total FROM public.cobrancas
   WHERE chamado_id = _chamado_id AND status = 'aberta';

  -- EXISTÊNCIA: há ALGO a cobrar neste atendimento? Recorte `<> cancelada`, o
  -- mesmo de montar_fechamento (u5:139) e dos dois índices da U80 — e não
  -- `= aberta`, senão um chamado cuja única cobrança já foi FECHADA num período
  -- voltaria a ser carimbado sem_cobranca numa reaprovação. Os dois recortes
  -- coexistem de propósito: são duas perguntas diferentes.
  SELECT count(*) INTO v_vivas FROM public.cobrancas
   WHERE chamado_id = _chamado_id AND status <> 'cancelada';

  -- É `v_vivas`, e não `v_itens`: `v_itens` é o ROW_COUNT do INSERT acima, e
  -- com o DELETE estreitado ele pode ser 0 num chamado que TEM lançamento vivo.
  -- Carimbar sem_cobranca ali trocaria "o dinheiro some e a linha do tempo
  -- confirma que não havia dinheiro" por "o dinheiro fica e o status mente".
  UPDATE public.chamados
     SET faturamento_status = CASE WHEN v_vivas = 0 THEN 'sem_cobranca' ELSE 'aprovada' END
   WHERE id = _chamado_id;

  INSERT INTO public.chamado_eventos (chamado_id, tipo, descricao, user_id)
  VALUES (_chamado_id, 'cobranca_aprovada',
          CASE WHEN v_itens > 0 THEN 'Cobrança aprovada: ' || v_itens || ' item(ns).'
               WHEN v_vivas > 0 THEN 'Conferência concluída: nenhuma peça a faturar; ' || v_vivas || ' lançamento(s) vinculado(s) permanece(m).'
               ELSE 'Conferência concluída: nada a cobrar.' END, auth.uid());

  RETURN QUERY SELECT v_itens, v_total;
END;
$u88a$;

-- `CREATE OR REPLACE` PRESERVA a ACL, mas repetir REVOKE/GRANT torna a linha
-- verdadeira sozinha (regra 5). anon é o mundo: a chave publishable está no
-- .env VERSIONADO.
REVOKE EXECUTE ON FUNCTION public.aprovar_chamado_financeiro(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.aprovar_chamado_financeiro(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.aprovar_chamado_financeiro(uuid) IS
  'Aprova a cobrança de um chamado concluído e devolve (itens, total). O DELETE '
  'de limpeza apaga SÓ o rascunho desta aprovação (chamado_peca_id IS NOT NULL); '
  'a cobrança AVULSA VINCULADA que concluir_chamado_com_cobranca cria fica '
  'intacta — U88/P19. faturamento_status olha o que EXISTE vivo no chamado '
  '(status <> cancelada), e não o ROW_COUNT do INSERT: sem isso o dinheiro fica '
  'e o status mente. SECURITY DEFINER com GRANT a authenticated, então o gate de '
  'papel (pode_ver_financeiro, R13) mora no CORPO e é a PRIMEIRA instrução '
  'executável — o catálogo não sabe enxergá-lo, e a U80 o apagou em silêncio.';

-- ═══════════════════════════════════════════════════════════════════════════
-- §3) P50 — `montar_fechamento` VOLTA A RODAR
-- ═══════════════════════════════════════════════════════════════════════════
-- BASE: o corpo VIVO da U5 (u5:88-144). `montar_fechamento` tem UMA ÚNICA
-- definição em todo o repositório — nenhuma migration posterior a redefine ou
-- dropa, confirmado por grep ancorado — e o §0 confere isso no catálogo.
--
-- AS QUATRO MUDANÇAS, E NENHUMA A MAIS:
--   (a,b,c) as três referências de `public.cobrancas` e `public.fechamentos`
--           ganham alias, e os nomes ficam QUALIFICADOS;
--   (d)     o `ON CONFLICT (tipo, referencia)` vira `ON CONFLICT ON CONSTRAINT
--           fechamentos_unico`. Esta quarta nasceu do 42702 que o banco do Davi
--           devolveu em 03/09 — ver a caixa "A PRIMEIRA VERSÃO DESTE ARQUIVO
--           AFIRMOU UMA FALSIDADE", no cabeçalho.
-- Nada mais muda: nem a assinatura, nem os nomes das colunas do RETURNS TABLE
-- (que são contrato com fechamentos.ts:95-97), nem a ACL, nem a semântica do
-- upsert — `fechamentos_unico` é o MESMO índice de antes, agora com nome no
-- catálogo de constraints.
--
-- O ALVO DO `SET` FICA NU, E TEM DE FICAR: `SET c.fechamento_id` não compila.
-- Ali o nome nu É a coluna, sem ambiguidade possível — é por isso que o
-- detector da U86 apaga a cláusula SET antes de medir.

-- ═══════════════════════════════════════════════════════════════════════════
-- §3a) O ÍNDICE VIRA CONSTRAINT — é o que torna a ambiguidade INEXPRIMÍVEL
-- ═══════════════════════════════════════════════════════════════════════════
-- `ADD CONSTRAINT ... UNIQUE USING INDEX` ADOTA o índice que já existe: não
-- reconstrói, não bloqueia por muito tempo, não muda o plano de nenhuma
-- consulta. `fechamentos_unico` (u5:60) é btree, único, não-parcial e sem
-- expressão — as quatro condições que a forma `USING INDEX` exige. O nome da
-- constraint é o MESMO do índice, então nem renomeação há.
--
-- ESTA É A ÚNICA DDL DA MIGRATION, e ela é aditiva: nenhuma coluna nasce,
-- nenhuma morre, nenhum dado se move. O que muda é que o upsert do §3 passa a
-- poder NOMEAR o árbitro em vez de inferi-lo por lista de colunas — e nomear é
-- o que elimina o ColumnRef.
DO $promover$
DECLARE v_uniq boolean;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint
              WHERE conrelid = 'public.fechamentos'::regclass
                AND conname  = 'fechamentos_unico'
                AND contype  = 'u') THEN
    RAISE NOTICE 'U88 §3a: fechamentos_unico já é constraint (2a rodada). Nada a fazer.';
    RETURN;
  END IF;

  SELECT x.indisunique INTO v_uniq
    FROM pg_class i
    JOIN pg_index x ON x.indexrelid = i.oid
    JOIN pg_namespace n ON n.oid = i.relnamespace
   WHERE n.nspname = 'public' AND i.relname = 'fechamentos_unico';

  IF v_uniq IS NULL THEN
    RAISE EXCEPTION E'ABORTADO — nada foi alterado (ROLLBACK).\nO índice `fechamentos_unico` NÃO existe em public.fechamentos, e o §3 vai citá-lo por nome no ON CONFLICT.\nEle nasce em u5:60. Descubra quem o removeu antes de rodar: sem ele, montar_fechamento deixa de ser idempotente e um período pode ganhar DOIS fechamentos.';
  END IF;
  IF NOT v_uniq THEN
    RAISE EXCEPTION E'ABORTADO — nada foi alterado (ROLLBACK).\n`fechamentos_unico` existe mas NÃO é único. `ADD CONSTRAINT ... USING INDEX` recusaria, e o ON CONFLICT do §3 não teria árbitro.';
  END IF;

  ALTER TABLE public.fechamentos
    ADD CONSTRAINT fechamentos_unico UNIQUE USING INDEX fechamentos_unico;
  RAISE NOTICE 'U88 §3a: fechamentos_unico promovido de índice a constraint (mesmo índice, sem reconstrução).';
END
$promover$;

CREATE OR REPLACE FUNCTION public.montar_fechamento(_tipo text, _data_base date DEFAULT NULL)
RETURNS TABLE (fechamento_id uuid, referencia text, itens integer, total numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $u88b$
DECLARE
  v_base date := COALESCE(_data_base, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  v_ref text;
  v_inicio date;
  v_fim date;
  v_id uuid;
  v_status text;
  v_itens int := 0;
  v_total numeric := 0;
BEGIN
  IF NOT public.pode_ver_financeiro(auth.uid()) THEN
    RAISE EXCEPTION 'Somente quem responde pelo financeiro pode montar fechamento.'
      USING ERRCODE = '42501';
  END IF;
  IF _tipo NOT IN ('semanal','mensal') THEN
    RAISE EXCEPTION 'Tipo de fechamento inválido: %', _tipo;
  END IF;

  IF _tipo = 'semanal' THEN
    v_ref := to_char(v_base, 'IYYY-"S"IW');
    v_inicio := date_trunc('week', v_base)::date;          -- segunda
    v_fim := v_inicio + 6;                                  -- domingo
  ELSE
    v_ref := to_char(v_base, 'YYYY-MM');
    v_inicio := date_trunc('month', v_base)::date;
    v_fim := (date_trunc('month', v_base) + interval '1 month - 1 day')::date;
  END IF;

  -- O ÁRBITRO É NOMEADO, E NÃO INFERIDO POR LISTA DE COLUNAS.
  -- `ON CONFLICT (tipo, referencia)` — a forma da U5 — levanta
  -- 42702 "column reference referencia is ambiguous" EM EXECUÇÃO: `referencia`
  -- é coluna de public.fechamentos E parâmetro OUT desta função, e a lista de
  -- inferência PASSA pelo hook de variável do plpgsql (um nome simples vira um
  -- ColumnRef em `resolve_unique_index_expr` e é transformado como qualquer
  -- outra referência de coluna). Foi esse erro, e não os dois do P50, que
  -- abortou a primeira execução desta migration.
  --
  -- `ON CONFLICT ON CONSTRAINT <nome>` não tem ColumnRef nenhum: é um
  -- identificador procurado em pg_constraint. A ambiguidade fica INEXPRIMÍVEL
  -- aqui, e não apenas evitada — que é o critério da U87. O §3a é quem promove
  -- o índice de u5:60 a constraint de mesmo nome.
  --
  -- A LISTA DE COLUNAS-ALVO DO INSERT, LOGO ABAIXO, CONTINUA CITANDO
  -- `referencia` E ISSO ESTÁ CERTO: ela é resolvida por `checkInsertTargets`
  -- contra a relação alvo, sem passar por `transformExpr` — logo, sem hook e
  -- sem ambiguidade. Não "conserte por simetria".
  --
  -- Este upsert é o que torna a função idempotente: montar o mesmo período
  -- duas vezes recolhe só o que entrou depois, e não cria período em dobro.
  INSERT INTO public.fechamentos (tipo, referencia, inicio, fim, created_by)
  VALUES (_tipo, v_ref, v_inicio, v_fim, auth.uid())
  ON CONFLICT ON CONSTRAINT fechamentos_unico DO UPDATE SET updated_at = now()
  RETURNING id, status INTO v_id, v_status;

  IF v_status = 'fechado' THEN
    RAISE EXCEPTION 'O período % já está fechado. Reabra antes de recolher novas cobranças.', v_ref;
  END IF;

  -- só cobrança ABERTA e ainda sem período: o que já foi fechado ou faturado
  -- em outro fechamento fica onde está.
  -- QUALIFICADO (U88/P50): `fechamento_id` é coluna de public.cobrancas E nome
  -- de coluna do RETURNS TABLE desta função. Nu, isto é 42702 em EXECUÇÃO — e
  -- era, desde agosto, o que matava o botão de montar fechamento inteiro.
  UPDATE public.cobrancas c
  SET fechamento_id = v_id
  WHERE c.status = 'aberta'
    AND c.fechamento_id IS NULL
    AND c.data_referencia BETWEEN v_inicio AND v_fim;
  GET DIAGNOSTICS v_itens = ROW_COUNT;

  -- QUALIFICADO (U88/P50): a segunda das duas referências nuas.
  SELECT COALESCE(sum(c.valor), 0) INTO v_total
  FROM public.cobrancas c WHERE c.fechamento_id = v_id AND c.status <> 'cancelada';

  -- `total` também é coluna de public.fechamentos E do RETURNS TABLE, mas como
  -- alvo de SET o nome nu É a coluna. O alias existe para o WHERE.
  UPDATE public.fechamentos f SET total = v_total WHERE f.id = v_id;

  RETURN QUERY SELECT v_id, v_ref, v_itens, v_total;
END;
$u88b$;
REVOKE EXECUTE ON FUNCTION public.montar_fechamento(text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.montar_fechamento(text, date) TO authenticated, service_role;

COMMENT ON FUNCTION public.montar_fechamento(text, date) IS
  'Monta (ou recolhe para) o fechamento do período e devolve (fechamento_id, '
  'referencia, itens, total). Idempotente pelo upsert em (tipo, referencia). '
  'As referências a cobrancas.fechamento_id são QUALIFICADAS por alias: nuas, '
  'elas colidem com o parâmetro OUT de mesmo nome e levantam 42702 em EXECUÇÃO '
  '— o defeito que manteve este botão morto de 18/08 a 10/09 (U88/P50). '
  'O árbitro do upsert é NOMEADO (ON CONFLICT ON CONSTRAINT fechamentos_unico) '
  'e não inferido por lista de colunas: a lista de inferência TAMBÉM passa pelo '
  'hook de variável do plpgsql, e `ON CONFLICT (tipo, referencia)` levantava o '
  'mesmo 42702 — foi ele que abortou a primeira execução da U88. Já a lista de '
  'colunas-alvo do INSERT cita `referencia` e está CERTA assim: ela é resolvida '
  'contra a relação alvo sem passar pelo transformador de expressões.';

-- ═══════════════════════════════════════════════════════════════════════════
-- §4) A ASSIMETRIA DECLARADA — `marcar_chamado_faturado` FICA COMO ESTÁ
-- ═══════════════════════════════════════════════════════════════════════════
-- Ela tem a MESMA forma incondicional do P19 e NÃO é consertada, de propósito.
-- Sem esta linha ficaria a assimetria não declarada de o DELETE distinguir
-- origem e o UPDATE não. A decisão vai para o CATÁLOGO, que é onde o próximo
-- leitor olha antes de "corrigir por simetria".
COMMENT ON FUNCTION public.marcar_chamado_faturado(uuid) IS
  'Marca como faturadas TODAS as cobranças abertas ou fechadas do chamado, '
  'inclusive a avulsa VINCULADA. A assimetria com aprovar_chamado_financeiro '
  '(que desde a U88 distingue origem pelo chamado_peca_id) é DELIBERADA: aqui o '
  'gesto não é destrutivo — muda status, não apaga linha — e varrer tudo é o '
  'comportamento DESEJADO, porque faturar o chamado é faturar o que está '
  'pendurado nele. Um avulso vinculado que ficasse "aberta" depois de o chamado '
  'ser faturado seria dinheiro esquecido, que é o defeito oposto e pior (U88).';

-- ═══════════════════════════════════════════════════════════════════════════
-- §5) O PORTÃO — sete provas de COMPORTAMENTO, dentro da transação
-- ═══════════════════════════════════════════════════════════════════════════
-- Ele CHAMA as duas funções. Não confere o texto delas: um 42702 só existe em
-- EXECUÇÃO, e o `CREATE OR REPLACE` acima aplicaria VERDE com a função tão
-- quebrada quanto hoje, porque o plpgsql só resolve a expressão na primeira
-- execução daquela instrução.
--
-- TODAS AS DATAS SÃO DE 1900, que nenhum dado de produção alcança, e cada mês é
-- de uma prova para que uma não recolha a fixture da outra:
--   1900-01 → prova 1 (montar fechamento)
--   1900-02 → prova 5 (a composição dos dois consertos)
--   1900-03 → provas 2, 3 e 4 (o motor de aprovação)
--
-- E ELE PERSONIFICA ANTES DE PROVAR QUALQUER COISA, senão fica verde por causa
-- do defeito: as duas funções começam por `pode_ver_financeiro(auth.uid())`, e
-- sem JWT `auth.uid()` é NULL. A personificação é CONFERIDA — se ela não pegar,
-- a migration ABORTA em vez de "pular" as provas.
DO $portao$
DECLARE
  v_user   uuid;
  v_quem   uuid;
  v_cli    uuid;
  v_fid    uuid;
  v_ref    text;
  v_n      int;
  v_itens  int;
  v_tot    numeric;
  v_tot2   numeric;
  v_ch1    uuid;
  v_ch2    uuid;
  v_ch3    uuid;
  v_ch4    uuid;
  v_peca   uuid;
  v_avulsa uuid;
  v_av2    uuid;
  v_av3    uuid;
  v_rasc   uuid;
  v_fech5  uuid;
  v_txt    text;
  v_st     text;
BEGIN
  -- ── PERSONIFICAÇÃO, E A PROVA DE QUE ELA PEGOU ─────────────────────────
  SELECT p.id INTO v_user FROM public.profiles p
   WHERE public.pode_ver_financeiro(p.id) ORDER BY p.id LIMIT 1;
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', v_user::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);
  SELECT auth.uid() INTO v_quem;
  IF v_quem IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'U88 PORTÃO: a personificação NÃO pegou — auth.uid() devolveu % e era para devolver %. Sem ela as duas funções morrem em 42501 ANTES de tocar no defeito, e um portão que só verificasse "não levantou 42702" ficaria VERDE COM A FUNÇÃO QUEBRADA. Abortando de propósito.',
      COALESCE(v_quem::text,'NULL'), v_user::text;
  END IF;
  IF NOT public.pode_ver_financeiro(auth.uid()) THEN
    RAISE EXCEPTION 'U88 PORTÃO: personifiquei %, mas pode_ver_financeiro(auth.uid()) deu falso. O gate recusaria as duas chamadas.', v_user::text;
  END IF;

  SELECT c.id INTO v_cli FROM public.clientes c ORDER BY c.id LIMIT 1;

  -- ════════════════════════════════════════════════════════════════════════
  -- PROVA 1 — `montar_fechamento` RODA. É a prova de que o 42702 morreu.
  -- ════════════════════════════════════════════════════════════════════════
  -- UMA cobrança descartável em 1900-01. Se a função ainda tivesse as
  -- referências nuas, a chamada abaixo levantaria 42702 e esta migration
  -- inteira voltaria — que é exatamente o que se quer.
  INSERT INTO public.cobrancas
    (cliente_id, descricao, quantidade, valor_unitario, valor,
     competencia, data_referencia, tipo_servico, criada_por)
  VALUES (v_cli, 'U88 portao 1 — cobranca descartavel', 1, 123.45, 123.45,
          '1900-01', DATE '1900-01-15', 'manutencao', v_user);

  SELECT r.fechamento_id, r.referencia, r.itens, r.total
    INTO v_fid, v_ref, v_n, v_tot
    FROM public.montar_fechamento('mensal', DATE '1900-01-15') r;

  IF v_fid IS NULL THEN
    RAISE EXCEPTION 'U88 PORTÃO 1: montar_fechamento devolveu fechamento_id NULO — o nome da coluna do RETURNS TABLE é contrato com fechamentos.ts:95, e ele tem de vir preenchido.';
  END IF;
  IF v_ref <> '1900-01' THEN
    RAISE EXCEPTION 'U88 PORTÃO 1: a referência mensal de 15/01/1900 é 1900-01; veio %.', v_ref;
  END IF;
  -- ESTA É A ASSERÇÃO QUE PROVA QUE O PORTÃO NÃO PEGOU MAIS NADA. Sem ela, um
  -- portão que rodasse com data-base do mês corrente re-arquivaria a produção
  -- inteira e ficaria verde.
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'U88 PORTÃO 1: a janela de 1900-01 tinha de recolher EXATAMENTE a 1 cobrança da fixture; recolheu %. Ou sobrou dado de teste, ou a janela pegou linha que não é dela.', v_n;
  END IF;
  IF v_tot <> 123.45 THEN
    RAISE EXCEPTION 'U88 PORTÃO 1: o total do período tinha de ser 123.45; veio %.', v_tot;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.fechamentos f WHERE f.id = v_fid AND f.total = 123.45) THEN
    RAISE EXCEPTION 'U88 PORTÃO 1: o UPDATE de fechamentos.total não gravou — é a terceira linha qualificada.';
  END IF;

  -- ── PROVA 1b: O RAMO `DO UPDATE` DO ON CONFLICT, E A IDEMPOTÊNCIA ──────
  -- A primeira chamada passou pelo ramo do INSERT; esta passa pelo DO UPDATE.
  -- As duas juntas são a única forma de provar que `ON CONFLICT (tipo,
  -- referencia)` NÃO é ambíguo, apesar de `referencia` ser parâmetro OUT.
  SELECT r.fechamento_id, r.itens INTO v_fid, v_n
    FROM public.montar_fechamento('mensal', DATE '1900-01-20') r;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'U88 PORTÃO 1b: montar de novo o MESMO período tinha de recolher 0 (a linha já tem fechamento_id); recolheu %. A idempotência é contrato.', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM public.fechamentos f WHERE f.referencia = '1900-01';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'U88 PORTÃO 1b: o upsert tinha de manter UM fechamento para 1900-01; existem %.', v_n;
  END IF;

  -- ════════════════════════════════════════════════════════════════════════
  -- PROVA 2 — P19 PELOS DOIS LADOS, NO MESMO CHAMADO
  -- ════════════════════════════════════════════════════════════════════════
  -- O chamado 1 é o cenário REAL de hoje: lançado pelo cartão (U80), portanto
  -- com faturamento_status 'aprovada' e uma avulsa vinculada viva — E com uma
  -- peça faturável analisada, cujo rascunho de uma aprovação anterior precisa
  -- ser limpo e regravado.
  INSERT INTO public.chamados
    (numero, cliente_id, titulo, natureza, status, faturamento_status,
     concluida_em, prioridade, equipe)
  VALUES ('U88-PORTAO-1', v_cli, 'U88 portao — avulsa vinculada + peca faturavel',
          'campo', 'concluido', 'aprovada',
          TIMESTAMPTZ '1900-03-15 12:00:00-03', 'normal', 'tecnica')
  RETURNING id INTO v_ch1;

  -- (i) a AVULSA VINCULADA: chamado_id preenchido, chamado_peca_id NULO.
  --     É a forma que concluir_chamado_com_cobranca cria, e a que o DELETE
  --     incondicional comia.
  INSERT INTO public.cobrancas
    (cliente_id, chamado_id, chamado_peca_id, descricao, quantidade,
     valor_unitario, valor, competencia, data_referencia, tipo_servico, criada_por)
  VALUES (v_cli, v_ch1, NULL, 'U88 avulsa vinculada (1/1)', 1, 500.00, 500.00,
          '1900-03', DATE '1900-03-15', 'manutencao', v_user)
  RETURNING id INTO v_avulsa;

  -- (ii) a peça faturável e a análise dela
  INSERT INTO public.chamado_pecas (chamado_id, descricao, quantidade)
  VALUES (v_ch1, 'U88 peca faturavel', 2) RETURNING id INTO v_peca;
  INSERT INTO public.chamado_pecas_analise (peca_id, chamado_id, resultado, valor_calculado)
  VALUES (v_peca, v_ch1, 'faturavel', 100.00);

  -- (iii) o RASCUNHO VELHO de uma aprovação anterior, com valor ERRADO.
  --       Ele TEM de sumir e ser regravado — é o outro lado do P19.
  INSERT INTO public.cobrancas
    (cliente_id, chamado_id, chamado_peca_id, descricao, quantidade,
     valor_unitario, valor, competencia, data_referencia, tipo_servico, criada_por)
  VALUES (v_cli, v_ch1, v_peca, 'U88 rascunho velho', 2, 999.00, 1998.00,
          '1900-03', DATE '1900-03-15', 'manutencao', v_user)
  RETURNING id INTO v_rasc;

  SELECT r.itens, r.total INTO v_itens, v_tot
    FROM public.aprovar_chamado_financeiro(v_ch1) r;

  -- ── 2a: A AVULSA VINCULADA SOBREVIVEU ──────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM public.cobrancas b
                  WHERE b.id = v_avulsa AND b.status = 'aberta' AND b.valor = 500.00) THEN
    RAISE EXCEPTION 'U88 PORTÃO 2a: a cobrança AVULSA VINCULADA foi comida pela aprovação. É o P19 exatamente como ele é hoje, e é o motivo desta migration existir.';
  END IF;

  -- ── 2b: E O RASCUNHO CONTINUA SENDO LIMPO ──────────────────────────────
  -- Sem esta prova, o §2 poderia ter apagado o DELETE inteiro e a 2a ficaria
  -- verde — a pior asserção é a que fica verde por causa do defeito.
  IF EXISTS (SELECT 1 FROM public.cobrancas b WHERE b.id = v_rasc) THEN
    RAISE EXCEPTION 'U88 PORTÃO 2b: o rascunho VELHO da peça sobreviveu à reaprovação. O DELETE parou de limpar o que é dele, e a próxima aprovação bate em cobrancas_uma_por_peca_idx com 23505.';
  END IF;
  SELECT count(*) INTO v_n FROM public.cobrancas b
   WHERE b.chamado_peca_id = v_peca AND b.status <> 'cancelada';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'U88 PORTÃO 2b: uma peça rende UMA cobrança viva (cobrancas_uma_por_peca_idx); esta peça ficou com %.', v_n;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cobrancas b
                  WHERE b.chamado_peca_id = v_peca AND b.valor = 200.00) THEN
    RAISE EXCEPTION 'U88 PORTÃO 2b: a cobrança da peça tinha de ser regravada por 200.00 (2 x 100.00) e não pelo valor velho de 1998.00 — o DELETE+INSERT é o que reprecifica.';
  END IF;

  -- ── 2c: O QUE A RPC DEVOLVE, E O CARIMBO ───────────────────────────────
  IF v_itens <> 1 THEN
    RAISE EXCEPTION 'U88 PORTÃO 2c: a aprovação tinha de gravar EXATAMENTE 1 item (a peça faturável); gravou %. Se vier 0, o INSERT parou de rodar e a prova 2a estaria verde por outro motivo.', v_itens;
  END IF;
  SELECT count(*) INTO v_n FROM public.cobrancas b
   WHERE b.chamado_id = v_ch1 AND b.status = 'aberta';
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'U88 PORTÃO 2c: o chamado tinha de ficar com 2 cobranças abertas (a avulsa de 500 e a peça de 200); ficou com %.', v_n;
  END IF;
  IF v_tot <> 700.00 THEN
    RAISE EXCEPTION 'U88 PORTÃO 2c: o `total` devolvido tinha de ser 700.00 (500 da avulsa sobrevivente + 200 da peça); veio %. Antes desta migration ele vinha 200.00, porque a avulsa tinha sido apagada — o efeito colateral está declarado no cabeçalho.', v_tot;
  END IF;
  SELECT c.faturamento_status INTO v_st FROM public.chamados c WHERE c.id = v_ch1;
  IF v_st <> 'aprovada' THEN
    RAISE EXCEPTION 'U88 PORTÃO 2c: faturamento_status tinha de ser aprovada; ficou %.', v_st;
  END IF;

  -- ════════════════════════════════════════════════════════════════════════
  -- PROVA 3 — O BURACO QUE A S4 ANUNCIOU: AVULSA VIVA E ZERO PEÇAS
  -- ════════════════════════════════════════════════════════════════════════
  -- Este é o caso em que estreitar só o DELETE trocaria um defeito por outro:
  -- v_itens = 0, e o corpo antigo cravaria 'sem_cobranca' com 400 reais vivos
  -- na tabela E gravaria "nada a cobrar" na linha do tempo.
  INSERT INTO public.chamados
    (numero, cliente_id, titulo, natureza, status, faturamento_status,
     concluida_em, prioridade, equipe)
  VALUES ('U88-PORTAO-2', v_cli, 'U88 portao — so avulsa vinculada, zero pecas',
          'campo', 'concluido', 'a_analisar',
          TIMESTAMPTZ '1900-03-16 12:00:00-03', 'normal', 'tecnica')
  RETURNING id INTO v_ch2;
  INSERT INTO public.cobrancas
    (cliente_id, chamado_id, chamado_peca_id, descricao, quantidade,
     valor_unitario, valor, competencia, data_referencia, tipo_servico, criada_por)
  VALUES (v_cli, v_ch2, NULL, 'U88 avulsa sozinha (1/1)', 1, 400.00, 400.00,
          '1900-03', DATE '1900-03-16', 'manutencao', v_user)
  RETURNING id INTO v_av2;

  SELECT r.itens, r.total INTO v_itens, v_tot
    FROM public.aprovar_chamado_financeiro(v_ch2) r;

  IF v_itens <> 0 THEN
    RAISE EXCEPTION 'U88 PORTÃO 3: o chamado não tem peça faturável, então itens tinha de ser 0; veio %. Sem isso a prova seguinte não prova nada.', v_itens;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cobrancas b WHERE b.id = v_av2 AND b.valor = 400.00) THEN
    RAISE EXCEPTION 'U88 PORTÃO 3: a avulsa vinculada sozinha foi comida pela aprovação.';
  END IF;
  SELECT c.faturamento_status INTO v_st FROM public.chamados c WHERE c.id = v_ch2;
  IF v_st <> 'aprovada' THEN
    RAISE EXCEPTION 'U88 PORTÃO 3: com 400 reais vivos no chamado, faturamento_status NÃO pode ser %; tinha de ser aprovada. É o aviso da S4:128-134: o dinheiro fica e o status mente.', v_st;
  END IF;
  IF v_tot <> 400.00 THEN
    RAISE EXCEPTION 'U88 PORTÃO 3: o total devolvido tinha de ser 400.00 (a avulsa sobrevivente); veio %.', v_tot;
  END IF;
  SELECT e.descricao INTO v_txt FROM public.chamado_eventos e
   WHERE e.chamado_id = v_ch2 AND e.tipo = 'cobranca_aprovada'
   ORDER BY e.created_at DESC LIMIT 1;
  -- SEM ESTE GUARDA AS DUAS PROVAS ABAIXO SÃO DECORAÇÃO. `SELECT … INTO` põe
  -- NULL quando não acha linha, e em plpgsql um `IF` sobre NULL não dispara:
  -- apagar o INSERT do evento faria `v_txt LIKE …` e `v_txt NOT LIKE …` valerem
  -- NULL, e as duas passariam caladas. É a regra 10 na forma mais barata.
  IF v_txt IS NULL THEN
    RAISE EXCEPTION 'U88 PORTÃO 3: a aprovação não gravou evento nenhum na linha do tempo. As duas provas de texto abaixo ficariam VERDES sobre NULL, porque IF sobre NULL não dispara.';
  END IF;
  IF v_txt LIKE '%nada a cobrar%' THEN
    RAISE EXCEPTION 'U88 PORTÃO 3: a linha do tempo gravou "%" num chamado com 400 reais vivos. O sistema estaria escrevendo a confirmação de que não havia dinheiro.', v_txt;
  END IF;
  IF v_txt NOT LIKE '%lançamento(s) vinculado(s) permanece(m)%' THEN
    RAISE EXCEPTION 'U88 PORTÃO 3: o evento tinha de dizer que o lançamento vinculado permanece; gravou "%".', v_txt;
  END IF;

  -- ════════════════════════════════════════════════════════════════════════
  -- PROVA 4 — O PAR NEGATIVO: `sem_cobranca` CONTINUA EXISTINDO
  -- ════════════════════════════════════════════════════════════════════════
  -- Sem esta prova, a mudança (d) do §2 poderia ter simplesmente removido o
  -- carimbo `sem_cobranca` e as provas 2 e 3 ficariam verdes.
  INSERT INTO public.chamados
    (numero, cliente_id, titulo, natureza, status, faturamento_status,
     concluida_em, prioridade, equipe)
  VALUES ('U88-PORTAO-3', v_cli, 'U88 portao — nada a cobrar mesmo',
          'campo', 'concluido', 'a_analisar',
          TIMESTAMPTZ '1900-03-17 12:00:00-03', 'normal', 'tecnica')
  RETURNING id INTO v_ch3;

  SELECT r.itens, r.total INTO v_itens, v_tot
    FROM public.aprovar_chamado_financeiro(v_ch3) r;
  IF v_itens <> 0 OR v_tot <> 0 THEN
    RAISE EXCEPTION 'U88 PORTÃO 4: chamado sem nada tinha de devolver (0, 0); devolveu (%, %).', v_itens, v_tot;
  END IF;
  SELECT c.faturamento_status INTO v_st FROM public.chamados c WHERE c.id = v_ch3;
  IF v_st <> 'sem_cobranca' THEN
    RAISE EXCEPTION 'U88 PORTÃO 4: um chamado SEM cobrança nenhuma tinha de ficar sem_cobranca; ficou %. O carimbo não pode ter sumido junto com o conserto.', v_st;
  END IF;
  SELECT e.descricao INTO v_txt FROM public.chamado_eventos e
   WHERE e.chamado_id = v_ch3 AND e.tipo = 'cobranca_aprovada'
   ORDER BY e.created_at DESC LIMIT 1;
  IF v_txt IS NULL THEN
    RAISE EXCEPTION 'U88 PORTÃO 4: a aprovação não gravou evento nenhum. A comparação abaixo seria NULL, e IF sobre NULL não dispara.';
  END IF;
  IF v_txt <> 'Conferência concluída: nada a cobrar.' THEN
    RAISE EXCEPTION 'U88 PORTÃO 4: a frase de "nada a cobrar" mudou sem que ninguém pedisse; gravou "%".', v_txt;
  END IF;

  -- ════════════════════════════════════════════════════════════════════════
  -- PROVA 5 — A COMPOSIÇÃO: O DINHEIRO NÃO SOME DE DENTRO DE UM FECHAMENTO
  -- ════════════════════════════════════════════════════════════════════════
  -- É a prova que justifica os dois consertos viajarem juntos. `montar_fechamento`
  -- recolhe carimbando fechamento_id mas DEIXA status='aberta' — então, com o
  -- P50 consertado e o P19 não, o DELETE apagaria a linha de DENTRO do período
  -- montado e `fechamentos.total`, gravado na montagem, ficaria maior que a
  -- soma das suas linhas: a lista pintaria um número e o PDF, outro.
  INSERT INTO public.chamados
    (numero, cliente_id, titulo, natureza, status, faturamento_status,
     concluida_em, prioridade, equipe)
  VALUES ('U88-PORTAO-4', v_cli, 'U88 portao — avulsa ja recolhida no fechamento',
          'campo', 'concluido', 'aprovada',
          TIMESTAMPTZ '1900-02-15 12:00:00-03', 'normal', 'tecnica')
  RETURNING id INTO v_ch4;
  INSERT INTO public.cobrancas
    (cliente_id, chamado_id, chamado_peca_id, descricao, quantidade,
     valor_unitario, valor, competencia, data_referencia, tipo_servico, criada_por)
  VALUES (v_cli, v_ch4, NULL, 'U88 avulsa recolhida (1/1)', 1, 250.00, 250.00,
          '1900-02', DATE '1900-02-15', 'manutencao', v_user)
  RETURNING id INTO v_av3;

  SELECT r.fechamento_id, r.itens INTO v_fech5, v_n
    FROM public.montar_fechamento('mensal', DATE '1900-02-15') r;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'U88 PORTÃO 5: a janela de 1900-02 tinha de recolher 1 linha; recolheu %.', v_n;
  END IF;
  -- O caso ATINGE O ALVO: a linha está DENTRO do fechamento E continua 'aberta',
  -- que é a condição exata que o DELETE do P19 casava.
  IF NOT EXISTS (SELECT 1 FROM public.cobrancas b
                  WHERE b.id = v_av3 AND b.fechamento_id = v_fech5 AND b.status = 'aberta') THEN
    RAISE EXCEPTION 'U88 PORTÃO 5: a fixture não atingiu o alvo — a linha tinha de estar recolhida no fechamento E ainda "aberta". Sem isso a prova de baixo não prova nada.';
  END IF;

  PERFORM * FROM public.aprovar_chamado_financeiro(v_ch4);

  IF NOT EXISTS (SELECT 1 FROM public.cobrancas b
                  WHERE b.id = v_av3 AND b.fechamento_id = v_fech5 AND b.valor = 250.00) THEN
    RAISE EXCEPTION 'U88 PORTÃO 5: a aprovação tirou a linha de DENTRO do fechamento já montado. É a composição dos dois defeitos, e é por isso que o P50 nunca pode ser consertado sem o P19.';
  END IF;
  SELECT f.total INTO v_tot FROM public.fechamentos f WHERE f.id = v_fech5;
  SELECT COALESCE(sum(b.valor), 0) INTO v_tot2 FROM public.cobrancas b
   WHERE b.fechamento_id = v_fech5 AND b.status <> 'cancelada';
  IF v_tot <> v_tot2 THEN
    RAISE EXCEPTION 'U88 PORTÃO 5: fechamentos.total (%) discorda da soma das linhas (%). É a divergência silenciosa entre a lista, que pinta o total armazenado, e o PDF, que soma as linhas.', v_tot, v_tot2;
  END IF;

  -- ════════════════════════════════════════════════════════════════════════
  -- LIMPEZA — o portão não deixa lixo, e a ausência é PROVADA
  -- ════════════════════════════════════════════════════════════════════════
  -- Cobranças ANTES dos chamados: `cobrancas.chamado_id` é ON DELETE SET NULL,
  -- então apagar o chamado deixaria a cobrança órfã viva em vez de removê-la.
  DELETE FROM public.cobrancas b WHERE b.data_referencia < DATE '1990-01-01';
  DELETE FROM public.fechamentos f WHERE f.inicio < DATE '1990-01-01';
  DELETE FROM public.chamados c WHERE c.numero LIKE 'U88-PORTAO-%';

  SELECT count(*) INTO v_n FROM public.cobrancas b WHERE b.data_referencia < DATE '1990-01-01';
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'U88 PORTÃO: sobraram % cobranças de teste anteriores a 1990. Esta migration não pode deixar dinheiro inventado na tabela de dinheiro.', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM public.fechamentos f WHERE f.inicio < DATE '1990-01-01';
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'U88 PORTÃO: sobraram % fechamentos de teste anteriores a 1990.', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM public.chamados c WHERE c.numero LIKE 'U88-PORTAO-%';
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'U88 PORTÃO: sobraram % chamados de teste U88-PORTAO.', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM public.cobrancas b WHERE b.chamado_id IS NULL AND b.descricao LIKE 'U88 %';
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'U88 PORTÃO: sobraram % cobranças órfãs da fixture (chamado apagado antes da cobrança).', v_n;
  END IF;

  -- ── DESPERSONIFICA: as conferências abaixo NÃO rodam de peruca ──────────
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);

  RAISE NOTICE 'U88 PORTÃO: 7 provas de comportamento passaram. montar_fechamento RODOU (o 42702 morreu), a avulsa vinculada sobreviveu à aprovação nos três cenários, o rascunho continua sendo limpo e reprecificado, sem_cobranca continua existindo, e o dinheiro não some de dentro de um fechamento montado.';
END
$portao$;

-- ═══════════════════════════════════════════════════════════════════════════
-- §6) CONFERÊNCIA — obtido × esperado × veredito, em SELECT
-- ═══════════════════════════════════════════════════════════════════════════
-- O QUE O DAVI OLHA: a TABELA. Procurar '>>> OLHAR <<<' na coluna `veredito`.
-- RAISE NOTICE é invisível no editor; nada aqui depende dele.
-- Tudo abaixo mede o CATÁLOGO VIVO (pg_proc), e não este arquivo. Uma asserção
-- que copiasse o valor do arquivo que audita não auditaria nada (regra 9).
SELECT t.ordem, t.conferencia, t.valor, t.esperado,
       CASE WHEN t.esperado = '(referência)'             THEN '— referência'
            WHEN t.valor IS NOT DISTINCT FROM t.esperado THEN 'ok'
            ELSE '>>> OLHAR <<<' END AS veredito
  FROM (

-- ══ 101: A POPULAÇÃO DO P19 HOJE ═════════════════════════════════════════
-- Recorte declarado: cobranças não canceladas, com chamado vinculado e SEM
-- peça — a forma que nenhuma aprovação produz. Num banco limpo é 0/0/0/0,00/0/0,
-- e isso é censo de escritores, não suposição. Este número vai para o diário.
SELECT 101 AS ordem,
       -- A ÚLTIMA PERNA DESDOBRA A POPULAÇÃO, e ela existe porque a assinatura
       -- de origem é do NASCIMENTO: a FK `ON DELETE SET NULL` da U4 apaga o
       -- `chamado_peca_id` de uma cobrança nascida de APROVAÇÃO quando alguém
       -- apaga a peça, e a partir daí ela é idêntica a uma avulsa vinculada.
       -- Sem o desdobramento, este número misturaria duas populações e o
       -- diário registraria a soma como se fosse uma só.
       -- Chamado SEM peça nenhuma = avulso legítimo. Chamado COM peça =
       -- suspeita de órfã, e é o número que a dívida P54 pede para olhar.
       'POPULAÇÃO P19 — avulsos vinculados vivos / na mira do DELETE / chamados / reais na mira / aprovável hoje / já recolhidos em fechamento / DESTES, em chamado que TEM peça (suspeita de órfã da FK — ver P54)' AS conferencia,
       (SELECT count(*) || ' / '
             || count(*) FILTER (WHERE b.status = 'aberta') || ' / '
             || count(DISTINCT b.chamado_id) FILTER (WHERE b.status = 'aberta') || ' / '
             || to_char(COALESCE(sum(b.valor) FILTER (WHERE b.status = 'aberta'), 0), 'FM999G999G990D00') || ' / '
             || count(*) FILTER (WHERE b.status = 'aberta' AND c.status = 'concluido') || ' / '
             || count(*) FILTER (WHERE b.status = 'aberta' AND b.fechamento_id IS NOT NULL) || ' / '
             || count(*) FILTER (WHERE b.status = 'aberta'
                             AND EXISTS (SELECT 1 FROM public.chamado_pecas p
                                          WHERE p.chamado_id = b.chamado_id))
          FROM public.cobrancas b
          JOIN public.chamados c ON c.id = b.chamado_id
         WHERE b.chamado_peca_id IS NULL AND b.chamado_id IS NOT NULL
           AND b.status <> 'cancelada') AS valor,
       '(referência)' AS esperado

UNION ALL
-- ══ 102: P50 — ZERO REFERÊNCIA NUA NO CORPO VIVO, MENOS O ALVO DO SET ════
-- Conte a OCORRÊNCIA no catálogo, não a linha no arquivo. O único `fechamento_id`
-- nu que pode sobrar é o alvo do `SET`, onde o nome nu É a coluna e onde
-- qualificar não compila. Qualquer outro é 42702 esperando execução.
SELECT 102, 'CRÍTICO: no corpo VIVO de montar_fechamento há EXATAMENTE 1 `fechamento_id` nu seguido de = ou IS — o alvo do SET, e nenhum outro',
       (SELECT (array_length(regexp_split_to_array(
                  p.prosrc, '(^|[^.[:alnum:]_])fechamento_id[[:space:]]*(=|IS)', 'i'), 1) - 1)::text
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = 'montar_fechamento'),
       '1'

UNION ALL
-- ══ 103: …E AS DUAS QUE FORAM QUALIFICADAS ESTÃO LÁ ══════════════════════
-- A 102 sozinha ficaria verde se alguém APAGASSE as duas linhas em vez de
-- qualificá-las. Presença nunca detecta deleção: as duas asserções são um par.
SELECT 103, 'CRÍTICO: e as DUAS referências qualificadas (c.fechamento_id) estão no corpo vivo — a 102 sozinha ficaria verde se alguém tivesse APAGADO as linhas',
       (SELECT ((length(p.prosrc) - length(replace(p.prosrc, 'c.fechamento_id', '')))
                / length('c.fechamento_id'))::text
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = 'montar_fechamento'),
       '2'

UNION ALL
-- ══ 104: O ÁRBITRO DO UPSERT É NOMEADO, E A LISTA DE COLUNAS SUMIU ═══════
-- As duas metades são um par. Só a primeira ficaria verde se alguém tivesse
-- apagado o ON CONFLICT inteiro (e aí a função perderia a idempotência); só a
-- segunda ficaria verde num corpo que não tem ON CONFLICT nenhum.
SELECT 104, 'CRÍTICO: o upsert usa ON CONFLICT ON CONSTRAINT (árbitro NOMEADO) e NÃO tem mais lista de colunas — a lista passa pelo hook de variável do plpgsql e `referencia` é parâmetro OUT: era ela que levantava 42702 e abortou a 1a execução da U88',
       (SELECT CASE WHEN p.prosrc LIKE '%ON CONFLICT ON CONSTRAINT fechamentos_unico DO UPDATE%'
                    THEN 'nomeado' ELSE 'AUSENTE' END
            || ' / ' ||
               CASE WHEN p.prosrc LIKE '%ON CONFLICT (%' THEN 'AINDA TEM LISTA' ELSE 'sem lista' END
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = 'montar_fechamento'),
       'nomeado / sem lista'

UNION ALL
-- ══ 105: O CONTRATO COM O FRONT — OS NOMES DO RETURNS TABLE ══════════════
-- É o que compra o "zero push". `fechamentos.ts:95` lê `fechamento_id` e
-- `referencia` por `as any`: se um nome mudasse, o tsc NÃO acusaria e o usuário
-- cairia em /fechamentos/undefined. Medido em pg_proc, e não no arquivo.
SELECT 105, 'CRÍTICO: montar_fechamento devolve EXATAMENTE fechamento_id, referencia, itens, total — os nomes são contrato com fechamentos.ts:95-97, e o front os lê por `as any` (renomear NÃO acusaria no tsc)',
       (SELECT string_agg(x.nome, ',' ORDER BY x.i)
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          CROSS JOIN LATERAL unnest(p.proargnames) WITH ORDINALITY AS x(nome, i)
         WHERE n.nspname = 'public' AND p.proname = 'montar_fechamento'
           AND x.i > 2),
       'fechamento_id,referencia,itens,total'

UNION ALL
-- ══ 106: P19 — O DELETE VIVO DISTINGUE A ORIGEM ══════════════════════════
SELECT 106, 'CRÍTICO: o DELETE de aprovar_chamado_financeiro carrega `chamado_peca_id IS NOT NULL` no corpo VIVO — sem isso ele come a cobrança avulsa vinculada',
       (SELECT CASE WHEN p.prosrc LIKE '%AND chamado_peca_id IS NOT NULL;%' THEN 'sim' ELSE 'NAO' END
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = 'aprovar_chamado_financeiro'),
       'sim'

UNION ALL
-- ══ 107: …E A DECISÃO DE STATUS OLHA O QUE EXISTE, NÃO O ROW_COUNT ═══════
SELECT 107, 'CRÍTICO: faturamento_status decide por v_vivas (o que existe vivo no chamado) e NÃO por v_itens (o ROW_COUNT do INSERT) — senão o dinheiro fica e o status mente',
       (SELECT CASE WHEN p.prosrc LIKE '%CASE WHEN v_vivas = 0 THEN ''sem_cobranca''%'
                     AND p.prosrc NOT LIKE '%CASE WHEN v_itens = 0 THEN ''sem_cobranca''%'
                    THEN 'sim' ELSE 'NAO' END
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = 'aprovar_chamado_financeiro'),
       'sim'

UNION ALL
-- ══ 108: O GATE DE PAPEL É A PRIMEIRA INSTRUÇÃO EXECUTÁVEL (a cicatriz U80) ══
-- A U80 §4b apagou este gate reescrevendo a função a partir do corpo errado, e
-- a asserção que guardava a promessa checava PRESENÇA. Aqui a medida é POSIÇÃO:
-- o gate tem de ser a primeira coisa depois do BEGIN, senão a função vira um
-- oráculo de existência de UUID para qualquer autenticado.
SELECT 108, 'CRÍTICO: o gate pode_ver_financeiro é a PRIMEIRA instrução executável de aprovar_chamado_financeiro (posição, não presença — a U80 o apagou em silêncio)',
       (SELECT CASE WHEN btrim(split_part(p.prosrc, 'BEGIN', 2), E' \t\r\n')
                         LIKE 'IF NOT public.pode_ver_financeiro(auth.uid()) THEN%'
                    THEN 'sim' ELSE 'NAO' END
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = 'aprovar_chamado_financeiro'),
       'sim'

UNION ALL
-- ══ 109: …E O MESMO PARA montar_fechamento ══════════════════════════════
SELECT 109, 'CRÍTICO: o gate pode_ver_financeiro continua sendo a PRIMEIRA instrução executável de montar_fechamento — reescrever a função não pode afrouxar a R13 para o portão rodar',
       (SELECT CASE WHEN btrim(split_part(p.prosrc, 'BEGIN', 2), E' \t\r\n')
                         LIKE 'IF NOT public.pode_ver_financeiro(auth.uid()) THEN%'
                    THEN 'sim' ELSE 'NAO' END
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = 'montar_fechamento'),
       'sim'

UNION ALL
-- ══ 110: A ACL DAS DUAS — anon É O MUNDO ════════════════════════════════
-- `proacl IS NULL` significa ACL PADRÃO, e o padrão do Postgres para função é
-- EXECUTE a PUBLIC — por isso o nulo conta como falha aqui, e não como "sem
-- concessão". A entrada de PUBLIC no aclitem é a que começa com `=X`, sem
-- concedido antes do sinal de igual.
SELECT 110, 'CRÍTICO: nem anon nem PUBLIC executam as duas funções desta entrega (a chave publishable está no .env versionado)',
       (SELECT count(*)::text FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.proname IN ('montar_fechamento','aprovar_chamado_financeiro')
           AND (has_function_privilege('anon', p.oid, 'EXECUTE')
                OR p.proacl IS NULL
                OR array_to_string(p.proacl, ',') ~ '(^|,)=X')),
       '0'

UNION ALL
-- ══ 111: O RECORTE QUE O CONSERTO USA JÁ ESTAVA NO CATÁLOGO ═════════════
-- O DELETE estreitado não inventa recorte: usa o MESMO que a U80 gravou em
-- índice único. Se um destes índices sumir, a defesa do §2 perde o chão.
SELECT 111, 'CRÍTICO: os dois índices da U80 que definem o recorte (avulsa vinculada = chamado_peca_id NULO; uma cobrança viva por peça) continuam existindo — é neles que o DELETE estreitado se apoia',
       (SELECT count(*)::text FROM pg_indexes i
         WHERE i.schemaname = 'public'
           AND i.indexname IN ('cobrancas_avulsa_unica_por_chamado_idx','cobrancas_uma_por_peca_idx')),
       '2'

UNION ALL
-- ══ 112: O PORTÃO NÃO DEIXOU LIXO ═══════════════════════════════════════
SELECT 112, 'CRÍTICO: nenhuma linha de teste sobrou — cobranças e fechamentos anteriores a 1990 e chamados U88-PORTAO. O portão desta migration escreve na tabela de dinheiro, e a ausência é medida, não prometida',
       ((SELECT count(*) FROM public.cobrancas b WHERE b.data_referencia < DATE '1990-01-01')
      + (SELECT count(*) FROM public.fechamentos f WHERE f.inicio < DATE '1990-01-01')
      + (SELECT count(*) FROM public.chamados c WHERE c.numero LIKE 'U88-PORTAO-%'))::text,
       '0'

UNION ALL
-- ══ 113: E NADA FICOU PERSONIFICADO ═════════════════════════════════════
SELECT 113, 'CRÍTICO: a personificação do portão foi desfeita — auth.uid() está nulo de novo, e estas conferências não rodaram de peruca',
       COALESCE(auth.uid()::text, 'nulo'),
       'nulo'

UNION ALL
-- ══ 114: O ÁRBITRO NOMEADO EXISTE, E É O MESMO ÍNDICE DE SEMPRE ══════════
-- A 104 mede o TEXTO da função; esta mede o ALVO dele. Um `ON CONFLICT ON
-- CONSTRAINT` cujo nome não existe é erro em EXECUÇÃO — a mesma classe do 42702
-- que abortou a primeira tentativa, e igualmente invisível na leitura.
-- `conindid` provando ser o índice de (tipo, referencia) é o que garante que a
-- promoção do §3a ADOTOU o índice da U5 em vez de criar um segundo.
SELECT 114, 'CRÍTICO: a constraint fechamentos_unico existe, é UNIQUE, e o índice por trás dela é o de (tipo, referencia) — é o árbitro que o §3 cita pelo nome',
       -- `::text` EM CADA OPERANDO, e não por preciosismo.
       -- `pg_constraint.contype` é do tipo interno `"char"` (um byte), e
       -- `"char" || unknown` é 42725 "operator is not unique": o Postgres acha
       -- mais de um caminho de conversão e se recusa a escolher. `relname` é
       -- `name`, mesma história. Foi assim que a SEGUNDA tentativa desta
       -- migration abortou — num SELECT de conferência que eu escrevi para
       -- provar o conserto da primeira.
       -- E AS COLUNAS SAEM DE `conkey`, NÃO DE `pg_get_constraintdef`.
       -- O deparse é uma RENDERIZAÇÃO: o Postgres reescreve a parentização e
       -- acrescenta cláusulas conforme a versão (`NULLS DISTINCT` entrou na 15).
       -- Uma conferência que comparasse a string bruta diria '>>> OLHAR <<<'
       -- numa execução PERFEITA — é a lição da conferência 203 da U87, e vale
       -- igual aqui. `WITH ORDINALITY` preserva a ordem de conkey, que é a
       -- ordem das colunas na constraint e não a ordem de attnum.
       (SELECT c.contype::text || ' / ' || i.relname::text || ' / ' ||
               (SELECT string_agg(a.attname::text, ',' ORDER BY k.ord)
                  FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
                  JOIN pg_attribute a ON a.attrelid = c.conrelid
                                     AND a.attnum   = k.attnum)
          FROM pg_constraint c JOIN pg_class i ON i.oid = c.conindid
         WHERE c.conrelid = 'public.fechamentos'::regclass
           AND c.conname  = 'fechamentos_unico'),
       'u / fechamentos_unico / tipo,referencia'

  ) t
 ORDER BY t.ordem;

COMMIT;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ DESFAZER — freio de emergência, não rollback de rotina                   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- ESTE RODAPÉ É CURTO PORQUE A MIGRATION NÃO ESCREVE DADO. O portão cria e
-- apaga as próprias fixtures dentro da transação, e as conferências 112 e 113
-- medem que não sobrou nada. Não há coluna a dropar nem linha a ressuscitar:
-- desfazer é reinstalar os dois corpos anteriores.
--
-- A ÚNICA DDL — a promoção de `fechamentos_unico` a constraint (§3a) — NÃO
-- PRECISA SER DESFEITA, e é melhor que não seja. Ela é aditiva: o índice é o
-- mesmo objeto de antes, com uma linha a mais em pg_constraint. Reverter o
-- corpo da função para o da U5 (que infere o árbitro por lista de colunas)
-- volta a funcionar exatamente como funcionava — isto é, volta a levantar
-- 42702, que é o que "desfazer" significa aqui. E se alguém QUISER desfazê-la
-- mesmo assim, `ALTER TABLE public.fechamentos DROP CONSTRAINT fechamentos_unico`
-- DERRUBA O ÍNDICE JUNTO (ele passou a pertencer à constraint), e aí um período
-- pode ganhar dois fechamentos. Nesse caso recrie-o antes de qualquer outra
-- coisa:  CREATE UNIQUE INDEX fechamentos_unico ON public.fechamentos (tipo, referencia);
--
-- O QUE VOLTA JUNTO, e é por isso que este rodapé é um freio e não uma opção:
--   · o botão de montar fechamento volta a levantar 42702 em TODA chamada, e a
--     tela de fechamentos volta a ser inutilizável;
--   · `aprovar_chamado_financeiro` volta a APAGAR a cobrança avulsa vinculada
--     de qualquer chamado concluído, a carimbar `sem_cobranca` por cima e a
--     gravar "nada a cobrar" na linha do tempo. É perda de dinheiro, silenciosa
--     e sem rastro.
-- O FRONT PUBLICADO NÃO QUEBRA COM ESTE DESFAZER — nenhuma assinatura muda e os
-- nomes do RETURNS TABLE são os mesmos nos dois mundos —, e essa é exatamente a
-- razão de o desfazer ser perigoso: ele não dá nenhum sinal.
--
-- O QUE ESTE RODAPÉ NÃO ALCANÇA: as cobranças avulsas vinculadas que o motor
-- antigo já apagou enquanto esteve no ar. Elas não existem mais e não há de
-- onde tirá-las — a conferência 101 diz quantas ainda estão expostas HOJE, que
-- é o número que o desfazer volta a colocar em risco.
--
-- Para desfazer: reaplicar `20260903180000_s4_auditoria_de_valor.sql` §1 (o
-- corpo de aprovar_chamado_financeiro) e `20260818220000_u5_fechamentos.sql` §2
-- (o corpo de montar_fechamento), nessa ordem, numa transação só. Os dois
-- arquivos estão versionados e são a única fonte dos corpos anteriores.
