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

- **Programação das duplas** (`/chamados/programacao`): quem sai com quem e
  para onde. Só o líder da dupla tem conta (R14).
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

### Anti-práticas específicas da escala

- Perguntar o par **sem dizer quando**. A assinatura sem data foi dropada
  justamente para o erro não ser possível.
- Ler `membro_a`/`membro_b` em código novo: são espelho legado e somem no
  Passo 2. A verdade é a escala.
- Tratar `null` de "semana vigente" como "ninguém". É "não sei" — o gatilho
  volta cedo em vez de apagar registro, e a tela diz "sem escala".
- Filtrar a escala por `duplas.ativa` na LEITURA. Desfazer uma equipe voltaria
  a apagar o passado dela.

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
