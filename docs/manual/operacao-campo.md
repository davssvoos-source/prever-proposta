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
- **Painel Operacional** (`/painel/operacional`): a entrada do domínio, com
  os indicadores de campo NA tela (R32).

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
- `docs/PRODUTO.md` — R1, R5–R9, R11–R12, R14–R20, R24–R26, R31
