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

## Referências

- `src/lib/chamado-status.ts` · `src/features/atividades/modelo.ts`
- `src/features/paineis/indicadores.ts` · `painel.operacional.tsx`
- `docs/SISTEMA_OS.md` (o plano original do sistema de OS)
- `src/features/duplas/modelo.ts` — a escala semanal e a herança (R96/U76)
- `docs/PRODUTO.md` — R1, R5–R9, R11–R12, R14–R20, R24–R26, R31, R95–R97
