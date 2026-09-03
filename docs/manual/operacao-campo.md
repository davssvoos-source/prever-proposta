# Operação de campo — chamados, fila e programação

> Manual Prever Proposta — segmento: operação de campo. Gerado em 2026-08-21 a
> partir de revisão do código. Fonte de verdade: o código e docs/PRODUTO.md;
> se este documento discordar deles, eles ganham.

## Para que serve este documento

Como o chamado vive: quem abre, quem coordena, quem executa, como a fila se
lê e o que os indicadores do Painel Operacional significam de verdade.

## O ciclo de vida do chamado

Vocabulário central em `src/lib/chamado-status.ts`:

- **Em aberto** = `aberto`, `agendado`, `em_andamento`, `stand_by`,
  `aguardando_aprovacao` (`chamadoEmAberto()`).
- **Encerrado** = concluído/cancelado. R19: "executado" e "concluído" são a
  mesma coisa.
- `statusDaNatureza()` decide quais status cabem em cada natureza (ex.:
  `agendado` pressupõe deslocamento — não existe no interno).
- Prazo: `situacaoPrazo(prazo, status, agora)` →
  `encerrado | sem_prazo | estourado | ...`.

Timestamps que os indicadores usam: `created_at` (abriu), `iniciada_em`
(alguém começou), `finalizada_em` (executou), `fechada_em` (fechou).

## Quem faz o quê

- **Qualquer usuário pode abrir chamado** (campo "Abrir chamado" da Início —
  decisão do Davi, R25: o chamado entra por três portas).
- **Quem coordena** (SAC/gestores, R1/R26): vê tudo de todos, agenda,
  distribui. As telas de coordenação são o Painel Operacional, o calendário,
  a programação das duplas e o painel de chamados.
- **O técnico** (R7): 3 abas; os chamados dele vivem na Início. Ele NÃO abre
  a fila de todo mundo — as telas de coordenação são bloqueadas por padrão
  para o cargo `tecnico`.
- **Chamado sem responsável é de todos** — regra deliberada do produto: a
  fila aberta convida quem pegar primeiro. **Exceção:** natureza `comercial`
  NÃO herda isso (o funil não é de todos — policy da U29).

## A fila canônica: a Início (R17/R31)

Kanban + lista na `/dashboard`, modelo único em
`src/features/atividades/modelo.ts` — chamados de campo, demandas internas e
propostas juntos, com prioridade, número e cor de fundo por **faixa de prazo**
(`faixaPrazo()`): amarelo = vence nesta semana, azul = semana seguinte em
diante, vermelho = atrasado. O corte da faixa é o **fim da semana corrente**,
não "daqui a 7 dias" — errar isso pinta de azul card que vence amanhã (há
asserção cobrindo).

A antiga lista `/chamados` morreu (R31). O detalhe continua em
`/chamados/$id` (corpo de campo ou interno conforme a natureza).

## Programação e painéis

- **Programação das equipes** (`/chamados/programacao`): quem sai com quem e
  para onde, com o filtro e a agenda do dia lendo a escala **da semana daquele
  dia** (R98). Só o líder da equipe tem conta (R14).
- **Painel de chamados** (`/chamados/painel`): a visão gerencial dos quatro
  trilhos com filtros aplicados a tudo (R8). Tem guarda de rota própria
  (`chamados.painel`) desde a U30.
- **Painel Operacional Técnica** (`/painel/operacional`): a entrada do domínio,
  com os indicadores de campo NA tela (R32). Desde a R95 ele recorta pela
  **equipe técnica** — é o painel do Vinicius, não a fila de campo de todas as
  equipes. A chave da tela continua `painel.operacional` (renomear a chave
  apagaria a linha de permissão de cada papel); no celular o menu mostra
  "Técnica", porque o nome inteiro não cabe na barra.

## Equipe de campo: a composição tem SEMANA (R96/R97, U76)

**"Equipe" sem adjetivo é DEPARTAMENTO** (técnica, T.I., comercial, controle
patrimonial, outras — R80). A turma que sai na rua é **"equipe de campo"**,
sempre com o adjetivo. No banco a tabela continua `duplas` e a escala é
`duplas_escala`: renomear tabela leva os gatilhos mas não reescreve o corpo
deles nem renomeia constraints, e a palavra já está ocupada desde a U71.

**Quem sai com quem é uma série, não um cadastro.** Cada semana tem a sua
composição; a semana que ninguém lançou **herda a última lançada antes dela**.
Isso é o que faz o passado parar de mudar: até a U76, mover alguém de equipe
reescrevia em silêncio as 12 semanas do gráfico do painel, porque a equipe de
cada atividade era resolvida pela composição de hoje.

Três consequências que valem saber de cor:

- **A herança olha só para trás.** Lançar a escala de amanhã nunca reescreve
  ontem. Se olhasse para o mais próximo, teríamos o defeito de volta com outro
  nome.
- **"Semana não decidida" ≠ "equipe que não sai nesta semana".** A primeira
  herda; a segunda fica vazia de propósito, e a herança respeita isso. É por
  isso que são duas tabelas (`duplas_escala_semanas` guarda as semanas
  DECIDIDAS).
- **Uma pessoa está em uma equipe só POR SEMANA** — não mais "uma equipe só,
  para sempre". A regra é a chave primária `(semana, pessoa_id)`, que
  substituiu os dois índices parciais e o trigger do caso cruzado da U47.

**Marco zero `0001-S01`:** semana sintética anterior a qualquer data real, onde
a U76 gravou a composição do dia da migração. Todo o passado herda dela — congela
o que a tela já dizia em vez de esvaziar o histórico. Na tela aparece como
"escala de sempre".

**Desfazer uma equipe libera o FUTURO, não o passado.** Apaga a escala das
semanas seguintes; a semana em curso e as passadas ficam, e continuam explicando
o gráfico. Foi a promessa que `duplas/data.ts` carregava desde a R56 sem ter
como cumprir.

### O apoio, com data

O apoio continua **gravado**, nunca derivado na hora de exibir (R75). O que mudou
é que a derivação virou função de *(pessoa, data)*: `parceiro_da_dupla(uuid)`
virou `parceiro_da_dupla(uuid, date)`, e o gatilho passou a escutar
`data_hora_agendada` além de `responsavel_id`. Sem isso, reagendar uma OS
entre semanas deixaria gravado o par da semana errada — o mesmo erro que a U64
existe para evitar, por outro caminho.

- Reagendar uma OS **aberta** entre semanas recalcula o apoio (e cada apoio novo
  toca o sino de quem entrou). De terça para quarta, não muda nada.
- Corrigir a **data** de um chamado concluído nunca mexe no apoio; corrigir o
  **responsável** dele, sim.
- Equipe de três grava os **dois** outros como apoio. Não existe "eleger o par"
  quando são três: escolher por sorte seria inventar.
- Agendar para uma semana e **depois** lançar a escala dela não refaz o apoio já
  gravado — de propósito. A conferência §9.6 da U76 lista os chamados abertos
  divergentes, e `SELECT public.reconciliar_apoios_abertos();` acerta (nunca
  alcança concluído, cancelado, nem apoio posto à mão).

### Onde se mexe nisso (R98)

O pop-up **Equipes de campo**, no Painel Operacional Técnica. Ele tem um
**seletor de semana no topo**, e é ele que manda em tudo abaixo.

Duas coisas separadas na mesma janela, porque têm prazos diferentes:

- o **cadastro** — nome e veículo — vale até alguém mudar;
- a **escala** (botão **Escalar**) — quem sai naquela semana — vale para aquela
  semana e só.

Enquanto as duas eram o mesmo formulário (os dois `<select>` "Técnico" e
"Parceiro"), trocar a composição reescrevia o passado. A tela diz sempre de
onde veio o que mostra: *escala desta semana* × *herdada de 2026-S32* ×
*escala de sempre*.

A composição é uma **lista**, não dois campos — a equipe de campo pode ter
três. Quem já está em outra equipe **naquela semana** não aparece nas opções, e
**mover alguém pergunta antes**: a RPC vai com `_mover: false`, o banco recusa
nomeando a outra equipe, e a tela só repete depois do "sim".

Equipe sem ninguém grava, e o botão assume: **"Não sai nesta semana"**.

### Anti-práticas específicas da escala

- Perguntar o par **sem dizer quando**. A assinatura sem data foi dropada
  justamente para o erro não ser possível.
- Ler `membro_a`/`membro_b`: **não existem mais** (U77). A verdade é a escala,
  e o arquivo do que foi congelado está em `duplas_composicao_legada`.
- Tratar `null` de "semana vigente" como "ninguém". É "não sei" — o gatilho
  volta cedo em vez de apagar registro, e a tela diz "sem escala".
- Filtrar a escala por `duplas.ativa` na LEITURA. Desfazer uma equipe voltaria
  a apagar o passado dela — o gráfico e a agenda iteram a lista inteira.
- Escrever em `duplas_escala` direto do cliente. A porta é a RPC
  `escala_definir`: a ORDEM das três operações (abrir, remover, inserir) é o
  que faz a coisa funcionar, e ela resolve as três numa transação.
- Resolver todos os chamados de uma tela pela semana aberta nela. A régua de
  dias da programação vai de domingo a sábado e atravessa a virada da semana
  ISO: cada chamado é resolvido pela semana DELE.

## A programação por BLOCO DE TEMPO (R99/R100/R101/R102 — U78/U79)

### O que mudou de conceito

A atividade em campo **deixou de ser o chamado** e virou um **bloco de agenda**
(`public.agenda_campo`): uma equipe, um dia, uma hora de início, uma duração e um
tempo de estrada. Um chamado pode ter **vários** blocos — foi terça, faltou peça,
volta quinta — e "retorno" é **derivado da ordem** deles, sem nenhuma coluna nova
e sem nenhum valor novo em `chamados.status`.

E existe o bloco **sem chamado**: a OS que veio de fora do sistema. Ela não cabe
em `public.chamados` porque `cliente_id` é `NOT NULL`, mas ocupa a equipe igual —
e uma grade que não a mostra mente sobre a semana. Só a gestão marca serviço de
fora.

`chamados.data_hora_agendada` **não é mais digitada**: ela é o **espelho** do
bloco pendente mais antigo (ou, se todos foram cumpridos, do último), mantido por
gatilho. É isso que faz o calendário, o card da Início, os indicadores, o gráfico
por equipe e o PDF continuarem lendo a mesma coluna de sempre — agora com hora de
verdade, em vez do meio-dia que a programação escrevia por não perguntar a hora.

### As quatro portas, e o que cada uma autoriza

| Porta | O que faz | Quem pode |
|---|---|---|
| `agenda_campo_marcar` | cria (`_id` nulo) ou **move** um bloco | gestor, **ou** quem responde pelo chamado que sai E pelo que entra E está escalado naquela equipe naquela semana |
| `agenda_campo_cancelar` | desmarca **um** bloco | gestor, ou quem responde pelo chamado |
| `agenda_campo_cumprir` | liga/desliga o "feito" | idem |
| `desagendar_chamado` | tira o **chamado** da agenda | idem |

Bloco **sem chamado** é ato de gestão nas quatro.

`marcar` é **PATCH e não REPLACE**: parâmetro nulo quer dizer "não mexi", nunca
"apague". Consequência que vale saber: ela **não desliga** um bloco do chamado
dele — para isso existe "tirar da agenda".

**O que já aconteceu não se move.** Um bloco marcado como feito recusa mudança de
dia, hora, equipe ou chamado. Duração e deslocamento **continuam corrigíveis**:
eles são medição do que houve ("levou três horas, não uma"), e proibir a correção
obrigaria a apagar o bloco para consertar um número.

### A faixa "agendado sem horário"

É a **barra de progresso da mudança**. Todo chamado de campo aberto que tem data
e nenhum bloco cai nela — no primeiro dia, isso é 100% da base, porque **não se
semeou bloco nenhum de propósito**: `12:00` na base significa duas coisas
indistinguíveis por valor ("a programação não perguntou a hora" e "meio-dia
mesmo"), e chutar uma duração envenenaria o chip de ocupação com um número
inventado que tem cara de medição.

A faixa não é um alerta: não tem vermelho, não tem triângulo, e o cartão mostra
**só a data**, nunca a hora. Ela some sozinha quando o último item ganhar horário
— sem troféu, sem estado vazio.

### Tirar da agenda NEM SEMPRE apaga a data

Se sobrar bloco **cumprido**, `data_hora_agendada` fica no último atendimento que
**aconteceu**, e o chamado lê-se "aberto, e a última visita foi dia tal". É de
propósito: zerar faria um chamado ainda aberto sumir do calendário e do PDF por
ter sido atendido. **Nenhum texto de tela pode prometer que "o horário some"** —
a confirmação é derivada, não escrita à mão.

### A CONSULTA-CANÁRIO DA DURAÇÃO (rodar de vez em quando)

Quanto dura um atendimento é **sempre digitado**. O sistema não chuta, e o campo
abre vazio — os atalhos (30min, 1h, 1h30, 2h, 3h, 4h) são digitação abreviada, e
nenhum vem pré-selecionado.

O risco disso não é lixo: é **uniformidade**. Sob pressão, no celular, no campo,
todo mundo toca o mesmo atalho — e em um mês a duração média vira um número com
cara de medição que ninguém mediu. Nesse ponto o chip de ocupação, a recusa da
jornada, o selo "disponível" e (na Fase 2) o cálculo de rota assentam num chute.

O verificador **não vê isso**: é problema de DADO, e ele lê código. A defesa é
esta consulta, com o limiar escrito ao lado:

```sql
SELECT servico_min, count(*) FROM agenda_campo GROUP BY 1 ORDER BY 2 DESC;
```

**Se um único valor passar de 70% do total, a duração está sendo chutada e o chip
de ocupação não vale nada.** A resposta certa aí não é apertar ninguém: é o Davi
dizer quanto dura, tipicamente, uma preventiva, uma corretiva, uma implantação e
uma operacional — e esses quatro números entrarem como padrão **etiquetado**
("padrão da preventiva"), nunca como um número mudo. Um dia depois disso, o
padrão honesto é a **mediana medida** dos blocos cumpridos, e aí os quatro
números decretados saem.

### A grade e o dia são o MESMO objeto

No desktop, a grade é semana × equipe; no celular, o dia continua sendo a
unidade. Não são duas telas: `linhasDaGrade` é calculada uma vez, com a semana
inteira, e o celular desenha **uma coluna** dela. O chip de ocupação diz sempre
"% da semana", inclusive no celular — é a mesma linha, com menos colunas
desenhadas.

**No celular não se arrasta**: HTML5 drag-and-drop não dispara em toque. O gesto
é tocar o cartão e usar o mesmo formulário — que é o gesto primário nos dois
viewports, porque o arrasto só sabe exprimir equipe e dia, e o formulário exprime
os cinco campos.

### Anti-práticas desta parte

- Escrever `chamados.data_hora_agendada` de um chamado de **campo** por qualquer
  caminho que não sejam as quatro portas. O verificador tem um censo por
  varredura que acusa isso nomeando o arquivo.
- Pré-selecionar uma duração "para agilizar". É um backfill, um clique por vez.
- Mostrar a HORA de um chamado que está na faixa "sem horário" (12:00 sentinela
  e 12:00 de verdade são o mesmo valor na base).
- Prometer, em texto de tela, que "tirar da agenda apaga o horário".
- Colapsar uma linha da grade sem desenhar os blocos dela: `blocosForaDaGrade`
  existe para pegar isso, e ele tem de ser sempre `{0, 0}`.

## Os indicadores de campo — o que cada número responde

Cálculo em `src/features/paineis/indicadores.ts` — **módulo puro, coberto por
teste de unidade real** no verificador. A régua: indicador que não responde
uma pergunta de gestão é enfeite.

| Indicador | Pergunta | Cuidado embutido |
|---|---|---|
| Em aberto / Sem responsável / Estourados / Urgentes | como está a fila agora? | urgente concluído não conta |
| **Saldo do mês** (entradas − saídas) | a fila está crescendo? | positivo = cresceu (pinta quente) |
| **Até começar** (mediana, h) | demoramos a IR? | separa agenda de execução |
| **Executando** (mediana, h) | demoramos a FAZER? | idem — dois relógios distintos |
| **Backlog**: idade mediana / mais antigo / +30d | o que está encalhado? | mediana resiste a outlier; o outlier aparece em "mais antigo" |
| **% no prazo** | cumprimos prazo? | só entre quem TINHA prazo — sem prazo não vira elogio |
| **Carga por pessoa** | quem está sobrecarregado? | "Sem técnico" em cor neutra |
| **Reincidência** (30 dias) | onde o problema volta? | conta PARES de corretivas próximas, não clientes grandes |

Duas exclusões deliberadas:

- **Natureza `comercial` fica FORA** — proposta é funil; misturar faria o
  "tempo de atendimento" somar negociação com conserto.
- A tela usa `useChamadosPorNatureza("campo")` — demandas internas também
  ficam fora (têm sprint, não SLA).

**Prática:** indicador novo → função no módulo + teste de unidade no
verificador + só então pintar na tela. A tela não calcula nada.

## Anti-práticas

- Criar uma segunda tradução de status→cor/coluna fora de
  `features/atividades/modelo.ts` (foi o defeito histórico que a U6b matou).
- Calcular métrica dentro de componente de tela.
- Fazer % de prazo contando os sem-prazo como cumprido.
- Ligar tela de coordenação sem guarda de rota (o menu esconder não é
  proteção — cicatriz da U30 em `chamados.painel`).

## O selo do ciclo financeiro no cartão (R103, U80)

Cada cartão da grade pode carregar **um selo** dizendo em que ponto do ciclo
financeiro aquele atendimento está. No desktop ele é um **ponto de 6 px** no
canto do cartão, com a palavra no `title` e no `aria-label`; no celular é um
**chip com a palavra**. O eixo do dia não tem espaço para uma sétima palavra
visível — um bloco de 30 minutos tem 21 px de altura e já corta a própria
segunda linha.

Os seis selos:

| Selo | Quer dizer | De onde sai |
|---|---|---|
| **A conferir** | acabou e ninguém decidiu a cobrança | `chamados.faturamento_status` |
| **Lançado** | existe lançamento vinculado | a RPC `chamados_com_lancamento` |
| **Nada a cobrar** | conferido, e não havia o que cobrar | `chamados.faturamento_status` |
| **Sem OS** | serviço feito e sem OS no sistema | o próprio bloco |
| **OS de fora** | serviço que veio de fora do sistema | o próprio bloco |
| **Cancelado** | o atendimento foi cancelado | `chamados.status` |

**"Lançado" nunca quer dizer "cobrado", "a receber" ou "faturado".** Ele afirma
que existe lançamento vinculado, e nada sobre valor — o cartão não mostra
dinheiro para ninguém, nem para quem vê valores.

**Cartão sem selo não quer dizer "sem cobrança".** O selo não aparece em quatro
situações, e nenhuma delas é "não tem": o atendimento ainda não acabou (a semana
à frente sai sem um único selo, de propósito), o chamado não é seu para ler, o
sistema não conseguiu perguntar, ou as duas fontes discordaram. **Se você
precisa saber, abra o chamado** — a ausência do selo é honesta, não é resposta.

## Concluir pelo cartão (R104)

Abaixo da grade, quando há atendimentos do dia esperando decisão, aparece a
seção **"A conferir"** com um botão **Decidir cobrança** por atendimento.
Clicar no CARTÃO continua abrindo o formulário do bloco — aquilo é agenda, e
não mudou.

O painel oferece, conforme o caso:

- **Concluir · conferir depois** — sempre. Encerra o atendimento e deixa a
  cobrança para quem responde pelo financeiro. Não é preciso ser do financeiro
  para isso: concluir não é decidir.
- **Concluir e lançar** — só para quem vê valores, e só quando **nenhuma peça
  foi analisada**. Descrição, valor total e parcelas; a prévia mostra as
  parcelas exatas antes de gravar.
- **Nada a cobrar** — só para quem vê valores.
- **Conferir e aprovar no chamado** — quando as peças FORAM analisadas. Aí a
  cobrança sai da conferência, com o valor do contrato, e não de um valor
  digitado. O sistema recusa o contrário.

**Sem diagnóstico e serviço executado o painel recusa concluir** e manda para o
painel do chamado. O relatório de atendimento imprime esses dois campos.

**Lançar duas vezes não é possível.** O banco recusa: uma peça rende uma
cobrança viva, e um lançamento avulso é único por atendimento, competência e
descrição. Se aparecer a mensagem "já tem cobrança lançada para estas peças",
recarregue — ou alguém decidiu no mesmo instante, ou o período já foi fechado
com elas dentro.

## Retornos pendentes (R106)

Entre a grade e a fila "aguardando programação" existe a seção **Retornos
pendentes**: atendimentos cuja visita **aconteceu**, que continuam **abertos** e
que **não têm nada marcado à frente**. Eles eram invisíveis — têm data (a do
último atendimento que aconteceu), então não caem na faixa "sem horário" nem na
fila "sem data", e não desenham cartão na semana aberta.

O botão é **Marcar retorno**. A lista some sozinha quando esvazia.

## Compartilhar o dia (R105)

Dois botões — **Copiar o dia** e **WhatsApp** — na linha de resumo do dia e no
topo da coluna do dia (celular). O texto sai com cada equipe (técnicos, veículo,
horas marcadas ou *disponível*) e cada atendimento (horário, duração, cliente,
endereço, tipo, prioridade, tempo de estrada, descrição). **Atendimento
cancelado fica de fora.**

O texto carrega **a hora em que foi gerado**: ele sobrevive à grade, e um plano
colado às 08:00 que mudou às 10:00 vira uma segunda verdade sem o carimbo.

**Só gestor vê os botões**, e a razão é o próprio texto: para quem não pode ler
os chamados, o dia sai cheio de "Outro atendimento" — o texto corta cliente,
endereço e descrição do atendimento alheio, não só o nome. Quem compartilha não
leva o parque de clientes dos colegas junto.

**Consulta-canário do ciclo** (o verificador não vê dado, só código) — quantos
atendimentos de campo concluídos estão parados esperando decisão de cobrança:

```sql
SELECT faturamento_status, count(*)
  FROM public.chamados
 WHERE natureza = 'campo' AND status = 'concluido'
 GROUP BY 1 ORDER BY 2 DESC;
```

Se `em_conferencia` não for zero, esses são os analisados que ninguém aprovou —
ver P20 em `docs/PENDENCIAS_TECNICAS.md`.

## Quem foi ao prédio: o apoio que já aconteceu (R107/R108, U81)

**A regra em uma frase:** no instante em que alguém marca um atendimento como
**feito**, quem está na lista de apoio daquele chamado vira **registro** — o
sistema nunca mais troca aqueles nomes sozinho.

### O que acontecia antes, e o que muda

O caso é o atendimento de **duas idas**: a visita de terça e o retorno da quinta
da semana seguinte. Marcar a visita de terça como feita faz o chamado passar a
aparecer no dia do retorno — isso está certo e é o que o "feito" existe para
fazer. Só que, ao mudar de semana, o sistema recalculava o apoio contra a escala
da semana NOVA e **apagava** quem tinha ido na terça. Sem sino, sem linha na
linha do tempo, sem rastro nenhum.

Agora o carimbo **congela** a lista antes de o chamado mudar de dia. A turma da
terça fica; a turma da quinta é **acrescentada**. O atendimento de duas idas
termina com os dois times na lista de apoio.

**Vale em qualquer ordem.** Se alguém marcar o retorno primeiro e a visita
depois — que acontece, porque há um botão por atendimento e nada obriga a ordem
— as duas turmas ficam protegidas do mesmo jeito.

**A turma do retorno entra quando a escala daquela semana existir.** Se a semana
do retorno ainda não foi lançada, o sistema não sabe quem é a turma e não
inventa: a lista fica só com quem já foi, e os nomes novos entram assim que a
escala for lançada. A caixa de confirmação diz isso.

A caixa de confirmação que aparece ao dar "feito" com retorno em outra semana
**continua existindo** — porque a surpresa continua existindo: o chamado muda de
dia. O que ela diz mudou: agora ela promete que o registro fica.

### Como isso aparece na tela

No campo **Apoio** do painel do chamado, o chip de quem esteve num atendimento
que já aconteceu ganha uma **borda mais forte** e um visto. Passando o mouse:
*"esteve num atendimento que já aconteceu — o sistema não troca mais este nome
sozinho"*.

O **X do chip continua funcionando**. Não existe "corrigir" um apoio no sistema:
se o nome congelado estiver errado, remova-o e ponha o certo. Fechar esse X
seria trancar a porta com o erro dentro.

### As três coisas que você precisa saber, e que não são óbvias

**1. O congelamento depende de alguém clicar "Feito".** É o único gesto no
sistema inteiro que transforma plano em registro. O atendimento que aconteceu e
ninguém marcou continua desprotegido: se o chamado mudar de semana, a lista é
recalculada e quem foi some. **Marcar "feito" deixou de ser burocracia e passou
a ser o que guarda quem trabalhou.**

**2. Tirar o "feito" NÃO descongela.** O carimbo registrou que alguém afirmou que
a visita aconteceu, e desafirmar não a desacontece. Se descongelasse, o botão
"Tirar o feito" viraria o botão "apagar quem foi".

**3. Quem foi continua com acesso, mesmo se o responsável mudar (R108).** Ser
apoio dá direito de ver e editar o chamado, o cliente, o local, as fotos, o
checklist e o pedido de compra. Como o registro não é mais apagado, trocar o
responsável de um atendimento já cumprido deixa **as duas turmas** com esse
acesso. É a troca deliberada: guardar um registro a mais é melhor do que apagar o
registro de quem esteve no prédio. Se a pessoa não deve mais ter acesso, remova-a
pelo X.

### O que o sistema AINDA NÃO sabe responder

*"Quantas visitas o Luan fez em setembro?"* — não sabe, e não é esquecimento.

A lista de apoio é **por atendimento**, não por visita: a mesma pessoa não cabe
duas vezes no mesmo chamado. O sistema consegue mostrar as turmas **na ordem das
idas** (quem foi primeiro, quem foi depois), mas quem foi nas DUAS idas aparece
só uma vez, e a lista não diz de qual bloco cada nome é.

Contar por visita exigiria pendurar o apoio no **bloco de agenda**, e isso está
adiado **de propósito** até que marcar "feito" seja rotina. Um ranking de
"visitas por técnico" construído hoje contaria menos visitas para o técnico que
esquece de clicar — que é medir disciplina administrativa e chamar de
produtividade.

**Consulta-canário** (o verificador não vê dado, só código) — quantos
atendimentos aconteceram e ninguém marcou "feito". É o número que decide se o
congelamento está protegendo alguma coisa de verdade:

```sql
SELECT count(*) AS blocos_esquecidos
  FROM public.agenda_campo
 WHERE cancelado_em IS NULL AND cumprido_em IS NULL
   AND dia < (current_date - 7);
```

E quantos atendimentos já têm registro congelado:

```sql
SELECT count(*) AS linhas, count(DISTINCT chamado_id) AS atendimentos
  FROM public.chamado_apoios
 WHERE congelado_em IS NOT NULL;
```

## Encerrar um chamado passa a perguntar pelas visitas (R109/R110/R111, U82)

### O que mudou, em uma frase

Ao encerrar um chamado de campo, o sistema **pergunta, um a um, se os
atendimentos que estavam marcados aconteceram** — e o que ficar marcado para um
dia que ainda não chegou é **desmarcado sozinho**.

### Por que ele pergunta em vez de decidir

Até aqui existia **um único clique** no sistema inteiro capaz de dizer "esta
visita aconteceu": o botão *Marcar como feito*, no cartão da grade. É esse clique
que guarda o registro de quem esteve no prédio (R107). Quando ele não acontecia,
o registro não era guardado — e ninguém via isso.

A saída **não** foi mandar o sistema marcar tudo sozinho ao concluir. "O dia
passou e ninguém disse nada" nunca foi prova de que alguém esteve lá, e um
sistema que trata *provavelmente aconteceu* como *aconteceu* passa a escrever
histórias. Então ele pergunta. E **nada nasce marcado**: três respostas por
atendimento — *aconteceu*, *não vai acontecer*, e deixar em branco.

**Deixar em branco é uma resposta legítima.** O atendimento fica pendente e o
chamado passa a mostrar um aviso, que não some sozinho.

### As três respostas, e o que cada uma faz

| Você diz | O sistema faz |
|---|---|
| **Aconteceu** | Marca a visita como feita e **guarda quem esteve** naquela ida. |
| **Não vai acontecer** | Desmarca o atendimento e **libera o horário** da equipe. Nada é afirmado. |
| *(em branco)* | Nada. O atendimento fica pendente e entra no aviso do chamado. |

### O atendimento marcado para depois, feito hoje

É comum e é legítimo — palavras do Davi (04/09): *"posso acabar fazendo algo
antes da data agendada por diversos motivos e o sistema não deve barrar isso"*.
**Nenhuma tela deste sistema recusa um carimbo porque a data ainda não chegou.**

O que ele faz é perguntar **em que dia**, e sugerir o certo:

- **Se o dia marcado ainda NÃO chegou**, o padrão é *"Aconteceu HOJE"*. Deixar o
  atendimento na terça que vem faria o sistema afirmar que a equipe esteve no
  prédio num dia que não existiu, **travaria aquele horário da equipe para
  sempre** e guardaria a turma da semana errada. Quem quiser manter o dia
  marcado ainda pode — o botão está ao lado, e o aviso embaixo diz o que isso
  significa.
- **Se o dia marcado JÁ passou** (o atendimento atrasou), ele **fica onde
  está**. E a assimetria é de propósito: um dia que já passou é *possível* —
  nada prova que não aconteceu, e o que estava planejado é a melhor informação
  que existe. Trocá-lo por "hoje", que é seguramente errado, seria jogar fora um
  dado bom para ganhar aparência de precisão.

**Se trazer o atendimento para hoje esbarrar em outro compromisso da mesma
equipe**, o sistema mostra COM O QUÊ, **não grava nada e não encerra o chamado**.
As duas saídas aparecem na mesma tela: afirmar mantendo o dia marcado, ou sair e
ajustar o horário na grade. Um conflito de agenda custa uma pergunta — nunca um
técnico parado no prédio com a assinatura na mão.

### O que a máquina faz sozinha ao encerrar

Só uma coisa, e ela **não afirma nada**: o que estava marcado para um dia que
ainda não chegou é **desmarcado**. O chamado acabou; aquele plano não vai
acontecer, e a agenda da equipe fica livre.

**NO CANCELAMENTO A RÉGUA É OUTRA, E ELA MORDE MAIS.** Ao cancelar, **todo**
atendimento sem resposta é desmarcado — **inclusive os de dia já passado**. E
esses somem do aviso: o aviso lista atendimento *pendente*, e desmarcado não é
pendente. Para voltar a marcá-lo é preciso ser gestão.

> **Se a equipe foi ao prédio e depois o cliente desistiu, responda
> "Aconteceu" ANTES de cancelar.** É a última chance de guardar aquele registro
> sem passar pela gestão. A caixa de perguntas aparece no fluxo de cancelar
> justamente para isso.

Três coisas que ela **não** faz:

- não marca nada como feito;
- não toca em atendimento **já marcado como feito** — desmarcá-lo apagaria o
  registro de que ele aconteceu;
- não toca em atendimento marcado para **hoje**. Um atendimento das 16h num
  chamado encerrado às 10h pode ter acontecido de manhã ou pode não ir
  acontecer, e o sistema não tem como saber. Ele fica pendente e entra no aviso.

Tudo que a máquina desmarca **volta**: arraste o cartão de novo na grade e ele
ressuscita. E aparece uma linha na linha do tempo do chamado dizendo quantos
foram desmarcados — o gesto não é secreto.

### O aviso do chamado encerrado

Há caminhos que encerram um chamado **sem perguntar nada**: arrastar o card no
quadro da Início, trocar o status no seletor do painel, recusar um pedido de
compra, a visita comercial que sincroniza. Para esses, o chamado passa a mostrar:

> ⚠ Este chamado foi encerrado com N atendimento(s) que ninguém afirmou.

Com o botão **Afirmar agora** ao lado, que abre a mesma pergunta. **Responder
depois ainda guarda o registro** — o aviso existe para isso, e ele não some
sozinho.

Uma ressalva: num chamado **já encerrado**, corrigir o DIA de um atendimento é
coisa de gestão. Se você não é gestor, a opção "Aconteceu HOJE" vai ser recusada
ali — mas "Aconteceu no dia marcado" continua funcionando, e é a que guarda o
registro. Por isso vale responder **antes** de encerrar, e não depois.

### Reabrir não desfaz nada

Reabrir um chamado encerrado **não** tira o "feito" de visita nenhuma e **não**
remarca o que foi desmarcado. É a mesma regra do R107: desafirmar não
desacontece. Se o trabalho continua, remarque na grade — o cartão desmarcado
volta com um arrasto.

Um detalhe que só aparece depois: um chamado reaberto pode ficar mostrando, na
Início e no calendário, **a data do atendimento que o encerramento desmarcou**.
Não é dado perdido, é uma data desatualizada. **Arraste o bloco na grade** (nem
que seja para o mesmo lugar) e ela se corrige sozinha. O sistema não faz isso no
momento da reabertura de propósito: fazer ali mexeria na lista de quem esteve no
prédio por tabela, tocando avisos e dando acesso a quem ninguém escolheu.

### O que esta entrega NÃO faz: o passado

A regra vale **da entrega para a frente**. Os chamados que já foram encerrados
sem ninguém responder **continuam exatamente como estão** — nada foi carimbado em
massa e nada foi desmarcado em massa. Quem drena o que ficou para trás é o
**aviso do chamado**, um por vez, com uma pessoa respondendo.

Uma passada retroativa foi desenhada e **ficou para depois, esperando número**:
carimbar em massa é a única coisa desta entrega que gravaria "aconteceu" sem uma
pessoa por trás, e isso não se faz no escuro. Se o aviso não estiver dando conta,
o que decide é a contagem de chamados encerrados sem resposta — a consulta está
logo abaixo.

**Consulta-canário** — quantos chamados foram encerrados com atendimento sem
resposta. É o número que diz se a pergunta está sendo respondida:

```sql
SELECT count(*) AS encerrados_sem_resposta
  FROM public.agenda_campo a JOIN public.chamados c ON c.id = a.chamado_id
 WHERE a.cancelado_em IS NULL AND a.cumprido_em IS NULL
   AND c.status IN ('concluido','cancelado');
```

## Vistoria: um tipo de chamado, e ele NÃO é a visita técnica comercial (R112, U83)

### As duas coisas que se chamavam parecido

Existem no Grupo Prever duas atividades diferentes que a boca chama do mesmo
jeito, e o sistema agora separa as duas por NOME:

| O que é | Como se chama no sistema | Onde vive |
|---|---|---|
| Ir ao cliente **só para olhar** — medir, conferir instalação de terceiro, avaliar o que vai ser preciso, laudo | tipo **Vistoria** de chamado de campo | fila de chamados, programação da equipe técnica |
| A **visita comercial** de proposta — levantar o escopo para orçar | "visita técnica", tipo **Prospecção** | `/gerencial`, tela da visita, funil da proposta |

**Se você está abrindo um chamado de CAMPO, o que você quer é "Vistoria".** Se
o que você quer é marcar a visita para fazer um orçamento, isso não é um
chamado de campo: é o fluxo comercial, e ele começa em `/gerencial`.

Esse é o motivo de o rótulo ser uma palavra só. "Visita técnica" já era o nome
do outro fluxo, e duas coisas diferentes com o mesmo nome na mesma lista é
erro de digitação esperando acontecer.

### Quando é Vistoria, e quando NÃO é

O corte é pelo que a equipe **vai fazer lá**, não pelo motivo de ir:

- **Vistoria** — ninguém conserta e ninguém instala nada nessa ida. Se sair
  serviço, ele vira **outro chamado**.
- **Manutenção Corretiva** — tem defeito relatado esperando conserto. Mesmo que
  a equipe precise olhar antes para saber o que fazer, é corretiva: o objetivo
  da ida é resolver.
- **Manutenção Preventiva** — é roteiro de manutenção programada de um sistema
  que já é nosso (aquele que abre checklist).
- **Operacional** — o serviço que se encaixa entre duas coisas: levar
  equipamento, buscar peça. Não ocupa a agenda de uma equipe como compromisso.

### O que a Vistoria muda na sua rotina — e o que não muda

**Ela entra na programação.** Aparece no filtro "tipo de demanda" da
programação da equipe técnica, junto com corretiva, preventiva e implantação,
porque ela ocupa uma janela de uma dupla num dia como qualquer atendimento.

**A cor dela é laranja** no cartão da grade e no chip do chamado.

**O prazo é o mesmo.** O prazo de atendimento do campo sai da **prioridade**, e
só dela — uma vistoria "normal" tem exatamente o mesmo prazo de uma corretiva
"normal". A vistoria não é mais nem menos urgente por ser vistoria: ela é
urgente pelo que a motivou. Se precisar de prazo curto, suba a **prioridade**.

**No fechamento ela conta como manutenção**, não como instalação — vistoria não
é obra.

### Enquanto o tipo não aparecer no seletor

A liberação vai em dois passos, de propósito. Até o segundo passo subir, você
vai **ver** "Vistoria" nos filtros e nos rótulos, mas ela **ainda não aparece**
na lista de tipos ao abrir um chamado novo. Isso é esperado, não é defeito: o
banco precisa aceitar o valor antes de o formulário oferecê-lo, senão quem
tentasse salvar levaria um erro. Enquanto isso, abra como estava abrindo e
troque o tipo depois.

E um aviso que vale para os chamados **internos**: escrever a palavra
"vistoria" no título de uma demanda interna ainda faz o sistema **sugerir**
"Manutenção Preventiva". É uma pendência conhecida, e a sugestão é só sugestão
— troque o tipo à mão se não for isso.

## Trocar a data no formulário move a grade junto (U84)

**Isso é novo, e é a única mudança de comportamento desta entrega.** Quando você
muda o dia dentro do formulário de horário **para outra semana**, a tela vai
buscar os atendimentos daquela semana. Você vê a grade atrás andar, e ao fechar o
formulário é lá que você fica. Trocar de dia **dentro da mesma semana** não move
nada — a lista já é a mesma.

Isso conserta um problema que já existia: a tela só tinha em mãos os atendimentos
da semana que estava aberta. Escolher um dia de outra semana fazia o formulário
**não enxergar** os compromissos daquela equipe naquele dia — ele deixava marcar,
e o servidor recusava depois, com uma mensagem de conflito que parecia vir do
nada. Agora as duas pontas olham para o mesmo dia.

## O que o mapa entendeu (e por que ler)

São **quatro** as telas que localizam um endereço:
ficha do cliente, nova visita, `/gerencial/nova`
e **edição da visita** — esta última é a que o gestor mais usa, porque é onde se
corrige endereço já cadastrado. Em todas elas, depois de clicar em
**Localizar** aparece uma linha:

> O mapa entendeu: **Interlagos, São Paulo, SP** — se não é este o lugar,
> corrija o endereço e localize de novo.

**Leia essa linha.** O campo de endereço é uma linha de texto livre, e é assim
que se erra de cidade: "Rua São Paulo, 1200" existe em dezenas de municípios, e
o mapa escolhe um sozinho, em silêncio. Duas coordenadas na tela não dizem nada
a ninguém; o nome do bairro e da cidade, sim. Essa coordenada fica **permanente**
no cadastro, e no dia seguinte não há nada na tela que denuncie o erro — porque
o rótulo que o sistema imprime é o **nome do prédio**, que está certo.

**Se você corrigir o endereço depois de localizar, a conferência some — e a
coordenada também.** É de propósito: aquela coordenada é do texto ANTIGO, e a
frase acima estaria descrevendo um endereço que o campo não contém mais. Localize
de novo, leia de novo.

**Enquanto a busca está no ar, o campo de endereço fica travado por alguns
segundos.** Também é de propósito: se desse para editar o texto no meio da
busca, a resposta do endereço antigo chegaria depois e ficaria descrevendo o
texto novo.

Se você **não** clicar em Localizar, o cadastro nasce **sem** coordenada. É de
propósito: ausência é visível e conserta-se com um clique; ponto errado não é
visível e não se conserta, porque ninguém sabe que ele está errado.

## Trocar o endereço do cliente apaga a coordenada (U84)

No cadastro do cliente, trocar o endereço **apaga a coordenada**. É de propósito
— a coordenada antiga é o lugar de onde o cliente saiu, e mantê-la faria o mapa
desenhar o prédio onde ele não fica mais. Depois de trocar o endereço, use o
botão de buscar no mapa.

Dois detalhes que valem saber:

- **rebuscar pode zerar mesmo assim.** Se o endereço novo cair no mesmo ponto do
  mapa que o antigo (acontece: boa parte da base foi localizada por CEP, e um
  CEP cobre a quadra), o sistema não consegue distinguir "não veio coordenada"
  de "veio a mesma", e apaga. **O conserto é abrir a ficha de novo, clicar em
  "Localizar no mapa" e salvar** — na segunda vez o endereço já está gravado, o
  sistema não tem por que apagar nada, e a coordenada fica. *Salvar de novo sem
  clicar em Localizar não devolve nada:* a ficha reabre sem coordenada e é isso
  que ela salva.
- **consolidar um cliente que estava sem endereço** também dispara a mesma
  regra: ele ganha o endereço da visita e perde a coordenada que tinha. Mesmo
  conserto — buscar no mapa uma vez.

**E o deslocamento continua sendo digitado à mão.** Calculá-lo automaticamente é
entrega futura; nada nesta rodada muda o campo **Deslocamento (min)**.


## Implantação: o período e o cronograma da obra (R120, U89)

Chamado do tipo **Implantação** ganhou um cartão próprio no detalhe, logo acima
de "Iniciar atendimento". Ele responde duas coisas: **quando a obra começa e
acaba**, e **como esse tempo se divide em quatro fases**.

### Antes de tudo: a implantação não tem mais prazo de 72 horas

Isto muda um número que você já olhava, então vale ler.

Até 11/09, toda implantação recebia o **mesmo prazo de uma corretiva** —
prioridade `normal` significa 72 horas, e o sistema aplicava isso a obra
também. Do quarto dia em diante a implantação aparecia como **prazo estourado**:
no KPI de atrasados, na coluna Atrasados do painel, e contando como
descumprimento no **percentual de prazo**. Toda implantação nascia atrasada.

Agora:

- **implantação não recebe mais prazo por prioridade** — nem ao nascer, nem ao
  escalar a prioridade depois;
- **o prazo da obra é o fim previsto do período**. Você tem até o **fim do dia**
  planejado, não até a manhã dele;
- **implantação sem período fica sem prazo** — e isso é a verdade, porque
  ninguém disse quando a obra acaba. As implantações antigas foram zeradas.

**Consequência que você vai ver:** o percentual de prazo dos meses passados
**subiu**. Não é maquiagem — o número anterior media obra de dois meses contra
régua de chamado de três dias.

### Definir o período

Dois campos de data e um botão **Salvar período**. Regras:

- **os dois juntos, ou nenhum.** Só o início não é aceito — meio período seria
  uma obra sem prazo se fingindo de obra com prazo;
- **o fim não pode ser antes do início**;
- **período só existe em implantação.** Em qualquer outro tipo o sistema recusa.

Enquanto o que está digitado for diferente do que está salvo, o cartão avisa em
âmbar: **"Período digitado e ainda não salvo"**. Ele só passa a valer como
prazo da obra depois que você clica em Salvar.

Salvar mostra `X dias úteis de Y corridos`. **Feriado e fim de semana não são
dia útil; ponto facultativo é** (a Prever é empresa privada — é a mesma regra
do sobreaviso, R115).

Apagar as duas datas e salvar **apaga o período e o prazo junto**.

### As quatro fases

Com o período salvo, o botão **Gerar as quatro fases** divide o tempo em
**Infraestrutura → Instalação → Configuração → Acabamento**.

A divisão é por **dia útil**, em partes iguais. Quando não divide certo, os dias
que sobram vão para as **primeiras** fases — não se configura o que ainda não
se instalou. Quando a obra tem menos de quatro dias úteis, as fases
**compartilham o último dia**, que é o que acontece de verdade numa instalação
pequena.

Cada fase tem:

- **Ajustar** — muda as datas e permite escrever uma observação. É edição
  explícita, com Salvar e Cancelar: nada é gravado enquanto você digita;
- **a caixa de marcar** — carimba a fase como concluída, com a hora do clique.
  O carimbo é o **registro** do que aconteceu; a data planejada é o **plano**, e
  os dois podem não bater. Acabar antes é normal e o sistema não impede;
- **Refazer a divisão** — apaga as quatro e recria a partir do período. **Todo
  ajuste de data e toda observação se perdem**, e o sistema pergunta antes.

### Os avisos em âmbar não impedem nada

O cartão aponta buraco entre fases, sobreposição, fase fora do período e fase
faltando. **São avisos, e você pode salvar do mesmo jeito.**

É deliberado: um vão de três dias entre a instalação e a configuração pode ser
a espera de um equipamento, e recusá-lo obrigaria a mentir na data para
conseguir salvar. Mesma lógica do bloco isento de jornada e do atendimento
feito antes da data agendada.

**Fim de semana e feriado entre duas fases não são buraco.** O vão é contado em
dias úteis, justamente para que o aviso signifique alguma coisa.

O que o sistema **recusa** é forma: fim antes do início, e duas linhas da mesma
fase.

### O PDF

**Baixar cronograma (PDF)** gera uma folha A4 paisagem com:

- cabeçalho: OS, cliente, período, dias úteis e corridos;
- legenda das quatro fases, com o **dígito** (1 a 4), a cor e as datas de cada
  uma. O dígito existe porque impressora monocromática transforma quatro cores
  em quatro cinzas iguais — a cor é conforto, o dígito é a informação;
- o calendário mês a mês, dois meses por linha, com cada dia pintado pela fase
  que o ocupa. Fim de semana e feriado aparecem em cinza, **sem sumir da
  folha** — o cliente precisa ver que aquele dia existe e não é de trabalho;
- **a lista dos feriados do período, com nome**. A grade mostra que o dia está
  fora; ela não diz por quê. Quem recebe o cronograma e vê a obra parada numa
  quinta-feira pergunta, e a resposta tem de estar na própria folha.

Se o período cair fora de 2025–2026, o rodapé avisa que os feriados daquele ano
não foram conferidos à mão. **As datas continuam calculadas** (a Páscoa é
algorítmica, as fixas não mudam) — o que falta é a checagem contra as leis do
ano. Planejar obra para 2027 é legítimo; confira as datas antes de imprimir.

### Quem pode mexer

**Ler:** qualquer pessoa ativa, inclusive o técnico que executa a obra — não há
valor em dinheiro neste cartão.
**Escrever** (período, gerar, ajustar, marcar concluída, apagar): admin,
comercial e SAC.

**Ainda não existe:** o técnico marcar a fase como concluída pelo celular. A
escrita é de gestor, e abrir isso exige uma regra de acesso por responsável —
está declarado como dívida.

### O que este cartão NÃO faz

- **não gera blocos na programação da equipe.** As fases são o plano da obra; a
  agenda de campo continua sendo montada dia a dia como em qualquer chamado;
- **não dispara cobrança na conclusão** — parcelada ou como acréscimo mensal ao
  contrato. É a segunda metade da Fase 4 e ainda não existe;
- **mudar a prioridade de uma implantação não mexe mais no prazo dela.** Isso é
  intencional: quem manda no prazo da obra é o fim previsto. Em corretiva,
  preventiva e nos demais tipos, escalar a prioridade continua apertando o
  prazo como sempre.


## Conferir e fechar agora decide a cobrança (R121, U90)

A caixa verde de **Conferência**, no detalhe do chamado, mudou. Antes ela tinha
um botão que carimbava quem conferiu e **deixava o chamado na fila** — o chamado
só saía dela quando alguém agisse pelo cartão de cobrança. Agora o gesto que
encerra é o gesto que decide.

### O que você vê, e depende de quem você é

**Se você responde pelo financeiro** (admin ou comercial), a caixa mostra um
formulário opcional — o que está sendo cobrado, o valor total e o número de
parcelas — e três saídas:

- **Conferir e fechar** (formulário vazio): fecha e deixa a cobrança para a
  conferência do cartão de peças. É o comportamento antigo.
- **Nada a cobrar**: fecha dizendo que não há o que cobrar neste atendimento.
- **Fechar e lançar N×**: o botão grande **muda de nome sozinho** quando o
  formulário está preenchido e válido. Ele fecha e lança a cobrança na mesma
  transação.

**Se você é do SAC**, a caixa continua exatamente como era: um botão, que fecha
e deixa a cobrança para a conferência. O SAC é gestor e não vê valores — então
aqui não há campo de valor nenhum, nem cinza nem desabilitado.

**Se você é técnico**, nada mudou: o seu botão é *Concluir atendimento*, e ele
registra a execução. A conferência é do gestor.

### A prévia das parcelas, e por que ela importa

Ao digitar valor e parcelas, aparece uma linha como:

> `3× — primeira de R$ 33,34, demais de R$ 33,33 · manutenção, até 12×`

**O resto vai na primeira parcela, sempre.** R$ 100 em 3 não é 33,33 três vezes
— isso somaria R$ 99,99 e o cliente pagaria um centavo a menos, para sempre. A
prévia mostra a divisão real ANTES de lançar, não depois, no boleto.

O teto também aparece ali: **instalação vai até 60 parcelas, manutenção até 12**.
Implantação é instalação automaticamente, então uma obra pode ser parcelada em
até 60×.

### Quando a tela NÃO oferece lançar

**Chamado com análise item a item.** Se o atendimento teve peças analisadas uma
a uma, a cobrança sai da conferência do cartão de peças — com o bloqueio de
itens em revisão, que existe porque cobrança indevida custa mais caro que uma
conferência. A caixa avisa isso em vez de oferecer um campo que seria recusado.

**Chamado que já teve a cobrança decidida.** A caixa de conferência some quando
o chamado sai da fila; se ela ainda estiver aberta numa aba velha, a porta
recusa com a frase certa e pede para recarregar.

**Chamado comercial.** A decisão de cobrança é do ciclo de campo. Chamado
comercial fecha como sempre fechou.

### O que NÃO existe, e é bom saber

**Não dá para somar o valor da obra à mensalidade do contrato.** O plano previa
isso, e não foi construído porque **não cobraria nada**: o sistema não gera
cobrança mensal automática — toda cobrança nasce de um gesto humano. O
`valor_mensal` do contrato é documentação (o que o contrato diz), não um motor
de faturamento. Aumentar aquele número não produziria nenhuma cobrança e ainda
apagaria o valor que veio do PDF.

**A obra se cobra em PARCELAS**, que são linhas reais, entram no fechamento do
período e podem ser faturadas. Se um dia a Prever precisar de aumento permanente
de mensalidade cobrado pelo sistema, isso pede um motor de mensalidade
recorrente — que é outra entrega.

## Referências

- `src/lib/chamado-status.ts` · `src/features/atividades/modelo.ts`
- `src/features/paineis/indicadores.ts` · `painel.operacional.tsx`
- `docs/SISTEMA_OS.md` (o plano original do sistema de OS)
- `src/features/duplas/modelo.ts` — a escala semanal e a herança (R96/U76)
- `docs/PRODUTO.md` — R1, R5–R9, R11–R12, R14–R20, R24–R26, R31, R95–R97, R107–R112


## Sobreaviso — a escala do plantão (R116, U86)

**Onde fica:** menu → **Sobreaviso** (só no desktop; no celular chega-se pelo
link). A tela é uma **grade: uma linha por pessoa, uma coluna por dia do mês**.
Digite as horas direto na célula — **salva sozinho, sem botão**, quando você sai
do campo (com **Tab**, com o mouse, ou apertando **Enter**). **Esc** desfaz o que
você digitou e devolve o número que estava lá. Apagar o conteúdo da célula apaga
o plantão daquele dia.

> **Salva quando você termina, e não a cada tecla.** É o que faz "24" ser vinte e
> quatro: uma gravação por tecla registraria o **2** e depois o **4**, e a folha
> ficaria com 4. Se você digitar um número maior que 24, a caixa mostra **24** na
> hora — o limite aparece na tela, ele não corrige escondido.

> **Se a tela disser que a escala não pôde ser lida, não é um mês vazio.** Nesse
> caso não há grade nem botão de PDF, de propósito: uma folha exportada de uma
> leitura que falhou diria "mês inteiro descoberto" e circularia por e-mail.

### O que a grade está dizendo

- **Coluna com fundo cinza** = não é dia útil. **Sábado, domingo e feriado
  recebem a mesma cor**, porque valem a mesma coisa: 24 horas de plantão. O que
  os distingue é o **nome**, que aparece ao passar o mouse sobre o número do dia
  (por exemplo *"Corpus Christi (feriado municipal)"*). Um pontinho abaixo do
  número indica que aquele dia tem nome.
- **Ponto facultativo NÃO é feriado.** Carnaval, Cinzas e o Dia do Servidor
  Público **contam como dia útil** aqui, porque a Prever é empresa privada.
- **A última linha, "Cobertura"**, é a que vale conferir. Ela mostra
  *somado/esperado*: **14 horas em dia útil** (o expediente das 8h às 18h é da
  equipe, não do plantonista) e **24 horas** em fim de semana e feriado.
  Vermelho = falta gente; laranja = há mais de um plantonista no dia (o que é
  legítimo, não é erro); cinza = ninguém.
- **Quem saiu da empresa aparece esmaecido** se tiver horas naquele mês. Ele não
  some do histórico — só não recebe célula nova.

### O botão "Semana padrão"

A semana padrão vai de **segunda 18:00 à segunda 08:00**: 6h na segunda de
entrada, 14h de terça a sexta, 24h no sábado e no domingo, 8h na segunda
seguinte. **118 horas** na semana. Com feriado no meio o total sobe, porque o
feriado troca 14 por 24.

**Ela tem OITO dias e ATRAVESSA o mês.** Em 12 das 52 semanas do ano o oitavo
dia cai no mês seguinte — a tela grava lá também, mesmo que você não veja aquela
coluna.

**O que ele faz com o que já está preenchido.** Ele não sobrescreve calado. Se
houver qualquer célula em conflito, **nada é gravado** e abre uma tabela com os
oito dias mostrando *o que está lá hoje*, *o que ficaria* e *o que vai acontecer
com cada um*:

- **preenche** — a célula estava vazia;
- **já está assim** — nada muda;
- **soma ao plantão que já estava** — é o caso da **segunda de virada**, quando
  a mesma pessoa emenda duas semanas: as 8h da madrugada mais as 6h da noite
  dão as 14h do dia. O sistema soma em vez de escolher uma das duas;
- **SUBSTITUI o que está lá** — em vermelho. Esta é a única que exige o seu
  "Gravar assim".

Aplicar duas vezes a mesma semana não muda nada e não pergunta nada.

### O botão da borracha

Apaga o que a **semana padrão** lançou para aquela pessoa **nos mesmos oito dias
que o botão ao lado grava** — a semana, e não o mês —, poupando o que foi
digitado à mão. Ele **nunca apaga na primeira vez**: mostra a lista de dias e
horas que morreriam, com as datas da faixa, e só apaga depois de você confirmar.

> A borracha é o **inverso exato** da varinha de propósito. Quando a semana
> atravessa o mês (12 vezes por ano), a varinha grava dos dois lados da
> fronteira — e uma borracha que só alcançasse o mês aberto deixaria a maior
> parte do gesto de pé, em outro mês, sem você ver.

### O PDF

Sai em **A4 paisagem** com o mês inteiro, o total por pessoa e a faixa de
cobertura na última linha. Se o calendário de feriados **não** tiver sido
conferido para aquele ano, o aviso vem impresso no cabeçalho — a folha circula
por e-mail e sobrevive à tela.

### No celular

O celular mostra **quem está de sobreaviso no dia**, com as setas para andar
dia a dia. É a mesma conta da grade, projetada num dia — o total do mês não vira
o total do dia. A grade completa e a edição são do desktop.

### O que esta tela faz, e o que é da tela ao lado

Ela registra **quem está de plantão**, não **o que aconteceu no plantão**. O
registro do atendimento (hora, cliente, plantonista, remoto ou presencial,
vínculo com o chamado) existe desde a **U87** e **não fica aqui** — fica no "+"
da Início, terceira opção. Ver a seção seguinte. A **cobrança** do plantão
continua não existindo.

## Registrar um atendimento de plantão (U87)

**Onde:** na **Início**, no botão **"+"** ao lado do alternador entre lista e
quadro — o mesmo que abre "Nova atividade". A terceira opção de *O que é* é
**Plantão**. Não há tela nova, não há item novo no menu, e no celular o botão
está exatamente onde já estava.

**O que se preenche:** a **hora**, **quem atendeu**, **remoto ou presencial**, o
**cliente** e **o que foi feito**. O vínculo com um **chamado** é opcional — e
pode ser ligado depois, reabrindo o mesmo atendimento.

### As coisas que costumam surpreender

**02:30 de domingo é o plantão de DOMINGO.** A madrugada pertence ao próprio dia
de calendário — é a mesma regra que a grade do sobreaviso usa para dizer que um
dia útil precisa de 14h de cobertura (as 8h de madrugada mais as 6h de noite). O
**dia** não é digitado nem calculado pelo aparelho: ele vem do servidor, e é o
que aparece na confirmação e na lista.

**Depois de registrar, o sistema diz se você estava na escala.** Três respostas,
e as três querem dizer coisas diferentes:

| o que aparece | o que quer dizer |
|---|---|
| *"na escala (8h)"* | você tinha horas de sobreaviso naquele dia |
| *"FORA da escala: o dia tem 24h lançadas para outra pessoa"* | o dia tem escala, e não é a sua |
| *"não há escala lançada para este dia"* | ninguém foi escalado naquele dia |

Isso **não impede nada**: quem atendeu foi quem atendeu. O aviso existe porque a
escala é o **plano** e o registro é o **fato**, e eles divergem de verdade —
troca de última hora, o colega que pegou porque o outro não acordou. Se a
divergência não era para existir, o lugar de consertar é a **/sobreaviso**.

**O cliente pode ser da lista OU escrito à mão, nunca os dois.** A opção de
escrever existe para o cliente que você não enxerga na lista — e ela tem um
preço, dito na própria tela: enquanto for texto, o atendimento **não é
cobrável**, porque cobrança exige cliente cadastrado.

**Isto NÃO vira chamado.** Não ganha número CH-, não entra no kanban, não entra
na fila de conferência do financeiro e não gera cobrança. Se o atendimento
precisar virar trabalho de campo, abra o chamado normalmente e depois **ligue** o
atendimento a ele, reabrindo o registro.

**Lançar em nome de outro é de quem responde pela operação.** Qualquer pessoa da
casa registra para si; escolher outro plantonista no campo *"quem atendeu"* só
funciona para admin, comercial e SAC.

### O que esta entrega AINDA NÃO faz

Não há **tela de listagem** nem **relatório mensal de plantão** — a lista dentro
do painel mostra os últimos atendimentos, por recência. O vínculo com o chamado
**não aparece** na página do chamado. E **apagar não deixa rastro**: o
atendimento some. Está registrado em `docs/PENDENCIAS_TECNICAS.md` (P53, P54).
