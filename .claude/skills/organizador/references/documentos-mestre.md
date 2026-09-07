# Os documentos mestre — onde mora cada fato

> Um fato, um lugar. Este mapa diz qual. Se dois documentos disserem a mesma
> coisa, um deles vai envelhecer e passar a mentir — e o leitor não tem como
> saber qual.

---

## 1. O mapa

### `docs/ESTADO_ATUAL.md` — o retrato

**Entra:** última regra e último diário; contagem do verificador e baseline
do tsc; migrations rodadas e pendentes; o que foi entregue nos últimos dias
(uma linha por leva); as decisões recentes que mudam o rumo; perguntas em
aberto; o que o Davi vai mandar; quem é quem (resumo); a ordem de leitura.
**Não entra:** regra completa (cite a R), raciocínio técnico (é do diário),
histórico antigo (pode ser podado — o diário guarda).
**Atualiza:** no fim de toda entrega. Uma asserção confere que a "última
regra" dele é a do PRODUTO.

### `docs/PRODUTO.md` — as regras

**Entra:** toda regra de produto, numerada (R-série), com a frase do Davi
entre aspas e a data; o que ela revisa, quando revisa. Seções temáticas (§1
Visão … §21 A estrutura das atividades) e o log numerado.
**Não entra:** como foi implementado (diário), defeito (P), pergunta (Q).
**Formato da regra:** `- **Rnnn** — **A frase-título em negrito.** O corpo,
com as consequências e o que revisa. *(Davi, DD/MM/AAAA: "a frase literal".)*`
**Linha "Última atualização"** no cabeçalho aponta para a última regra.

### `docs/PLANO_UNIFICACAO.md` — o diário

**Entra:** uma entrada `## Unnn — título (data)` por entrega, em prosa: o
pedido, o que foi feito e **por quê assim**, o que se recusou a fazer e por
quê, o que a verificação pegou, e os números no fim (verificador, build, tsc,
última regra, migration).
**Não entra:** a regra em si (cite), o tutorial de uso (manual).
**Lê-se** pela entrada citada no código ou no PRODUTO — nunca de ponta a
ponta. O sumário no topo lista as entradas.

### `docs/PENDENCIAS_TECNICAS.md` — as dívidas

**Entra:** `## Pnn — GRAVIDADE · título (data, origem)` com o arquivo, o
caminho de quebra e a correção mínima — "para que consertar seja executar,
não investigar de novo". Fechou? O título ganha `~~GRAVIDADE~~ FECHADA (Uxx)`
e um parágrafo "Fechada:" — o histórico fica, porque quando o defeito voltar
o caminho já está escrito.
**Não entra:** decisão de produto pendente (é Q, no plano).

### `docs/PLANO_V0.1.md` — o plano

**Entra:** a definição de pronto, o inventário, as fases (A–H) com entregas
e dependências, as perguntas Q-série **anotadas com a resposta** (`→
**Respondida em DD/MM (Rnnn):** …`), os riscos, o acompanhamento (checklist).
**Não entra:** o que já virou regra (cite) ou diário.

### `docs/CONTEXTO_OPERACAO_TECNICA.md` · `docs/CONTEXTO_ESTRUTURA_ATIVIDADES.md` — o que o Davi ditou

**Entra:** o texto do Davi **na íntegra** (transcrito, não resumido), a
leitura estruturada (matriz, glossário), as decisões D-série onde o texto
admitia duas leituras, as perguntas que nasceram. Quando uma D é revista por
regra posterior, ela ganha a nota `**REVISTA em DD/MM (Rnnn): …**` — o texto
original fica.
**Não entra:** implementação.

### `docs/manual/*.md` — como funciona, por segmento

**Entra:** o comportamento do sistema como um usuário ou um desenvolvedor
novo precisa entender, por segmento (operação de campo, comercial, clientes,
financeiro, permissões, interface, banco, desenvolvimento, segurança,
códigos de erro). Cita a regra; não a reproduz.
**Não entra:** tokens (DESIGN_SYSTEM), regra (PRODUTO), raciocínio (diário).
**Atualiza:** na mesma leva em que a regra muda o comportamento. O manual
descrevendo uma tela que saiu é o sinal de envelhecimento mais comum.

### `DESIGN_SYSTEM.md` — tokens, componentes, anti-padrões

**Entra:** tokens com **valores resolvidos** (o Davi exporta este arquivo
para outros sistemas), receitas de componente com o código, anti-padrões
que foram bug real (com o `grep` que os acha), a paleta e as rampas, o
checklist de conformidade.
**Não entra:** regra de produto (cite a R que motivou), decisão de tela
específica (diário).

### `CLAUDE.md` — o método

**Entra:** o ciclo de trabalho, as invariantes, as armadilhas, o mapa do
repo, as confirmações de sanidade. Muda raramente. Quando mudar, avise o Davi
— é o contrato de como se trabalha.

### `docs/DASHBOARD.md` · `docs/REGRAS_BLOCOS.md` · `docs/SISTEMA_OS.md` · `docs/REVISAO_2026-09-03.md`

Receita de painel ("quem conta é quem filtra"); regras do motor de blocos do
orçamento; **documento histórico** da fundação (aviso no topo); a revisão tela
a tela de 03/09 com as Q11–Q17. Consultam-se pelo assunto.

### `.claude/skills/*/` — os métodos que carregam sozinhos

`designer` (interface), `organizador` (este), `banco` (migrations). Uma skill
nova entra no mapa do `CLAUDE.md` e no `ESTADO_ATUAL.md`.

## 2. Vocabulário das séries

| Série | O quê | Onde | Numeração |
|---|---|---|---|
| **R** | regra de produto | PRODUTO | sequencial; a última está na linha "Última atualização" |
| **U** | entrega (diário) | PLANO_UNIFICACAO | sequencial; sufixo `b` para complemento da mesma entrega (U97b) |
| **P** | dívida técnica | PENDENCIAS | sequencial |
| **Q** | pergunta ao Davi | PLANO_V0.1 §4 (Q1–Q10, Q23), REVISAO (Q11–Q17), CONTEXTO_ESTRUTURA §6 (Q18–Q22) | sequencial global |
| **D** | decisão minha onde o texto admitia duas leituras | CONTEXTO_* | por documento (D1–D9) |
| **S** | auditoria de segurança | PLANO_UNIFICACAO (S1, S4) e manual/seguranca | sequencial |

Ao criar item novo de uma série: `grep -c` para achar o último número —
nunca chute.

## 3. Modelo de documento novo

Todo documento mestre nasce com:

```markdown
# Título — subtítulo que diz o que é

> **Para que serve.** Uma frase. Quem deve ler, e quando.
> **Fonte de verdade:** o que ganha dele quando discordam (o código; o
> PRODUTO). Se este documento discordar, ele se corrige.

<!-- sumario:inicio -->
(gerado por scripts/sumario.cjs — não edite à mão)
<!-- sumario:fim -->

## 1. …
```

E, ao nascer, entra em três lugares: o mapa do `CLAUDE.md`, a ordem de
leitura do `ESTADO_ATUAL.md` e a lista de alvos de `scripts/sumario.cjs`
(se tiver mais de ~150 linhas).

Seções curtas, títulos que dizem a conclusão ("O painel recolhe, e a escolha
fica" em vez de "Painel"), tabelas para o que é tabular, prosa para o porquê.

## 4. Sinais de envelhecimento — a caça periódica

Quando algo sai do sistema, ele continua nos documentos por meses. Ao remover
tela, campo, conceito ou termo, rode:

```bash
grep -rln "<termo>" CLAUDE.md ONBOARDING.md DESIGN_SYSTEM.md docs/*.md docs/manual/*.md
```

e corrija **cada** menção — depois trave por asserção (a U100 fixou a
ausência de oito sinais: "Prioridade, Equipe, Sprint", "pedido de compra"
como acesso, "chamados.novo é a Q11", "360+ asserções", "~1300 asserções",
"~85 pré-existentes", "sprint/equipes — R15/R16", "têm sprint, não SLA").

Sinais clássicos: uma contagem ("N asserções", "baseline N") escrita à mão;
uma tela citada como viva depois de virar redirect; uma pergunta citada como
aberta depois de respondida; um retrato "na entrega de DD/MM" que virou
passado; uma decisão D sem a nota de revisão.

## 5. O que NÃO documentar

- O que o código já diz (estrutura de pastas, assinatura de função).
- O que o `git log` já diz (quando mudou, quem mudou).
- Rascunho, tentativa, pensamento em voz alta — vai para o scratchpad.
- Cópia de outro documento — vai como referência.
