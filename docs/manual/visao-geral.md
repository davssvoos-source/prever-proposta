# Visão geral do sistema

> Manual Prever Proposta — segmento: visão geral. Gerado em 2026-08-21 a partir
> de revisão do código. Fonte de verdade: o código e docs/PRODUTO.md; se este
> documento discordar deles, eles ganham.

## Para que serve este documento

É a porta de entrada do manual: o que o sistema é, quem o usa, como o trabalho
flui e como a navegação está organizada. Quem for mexer em qualquer segmento
lê este primeiro e depois o documento do segmento.

## O que o sistema é

O **Prever Proposta** é o sistema interno da Prever (sistemas de segurança
predial) que está absorvendo, nesta ordem histórica, três ferramentas:

1. O **wizard de orçamento/proposta comercial** (a origem do app — visita
   técnica, blocos de orçamento, proposta .docx).
2. O **sistema de ordens de serviço** (ex-SIGMA/Notion — chamados de campo e
   demandas internas, unificados na U7).
3. A **gestão** (contratos, fechamentos, clientes — portados do gestor-os).

O plano dessa absorção é `docs/PLANO_UNIFICACAO.md` (diário técnico U0–U30).
As regras de produto são `docs/PRODUTO.md` (R1–R32) — **cada regra nova entra
lá antes de virar código**, e as importantes viram asserção permanente em
`scripts/verificar-logica.cjs`.

## Quem usa (cargos e aparelhos)

| Cargo | Quem | Aparelho (R28) | Resumo |
|---|---|---|---|
| **admin** | Davi, Vinicius | desktop | vê e pode tudo; NUNCA entra na matriz de permissões (regra de sistema) |
| **comercial** | — | desktop | funil de proposta + gestão (compartilha a barra do admin) |
| **sac** | — | desktop | coordena chamados, agenda visitas (R1: o SAC é gestor) |
| **tecnico** | Gilleno, Nicholas, Erik, Breno… | **celular** | executa em campo; só o líder da dupla tem conta (R14) |

O Controle Patrimonial usa perfil de técnico (R6). T.I. e Controle Patrimonial
trabalham nas atividades de natureza `interno`; a equipe da atividade é a das
pessoas nela (R139) — não se escolhe, e o sprint saiu (R141). A **Rubia**
(supervisora do atendimento da Portaria Remota) é **sac**: abre e gerencia os
chamados técnicos (R158). O técnico de campo **não abre chamado** sozinho
(R163); o "+" da Início, para ele, é a porta do plantão.

## O fluxo macro

```
prospecção ──► visita técnica ──► orçamento (blocos) ──► aprovação INTERNA
                                                              │
                              cliente ACEITA/RECUSA ◄── proposta enviada (.docx)
                                    │
              cliente é criado NO QAP (nunca no app — R21)
                                    │
        chamados de campo (corretiva/preventiva/implantação) ── faturamento
```

Dois pontos que já causaram confusão e têm regra própria:

- **Visita aprovada ≠ negócio fechado (R4).** Aprovar é ato interno do
  comercial; quem aceita a proposta é o cliente. Nunca ligar lógica de "ganhou"
  ao status `aprovada`.
- **O app não cria cliente (R21/R22).** Prospecto orçado não é cliente; a
  base de clientes vem do QAP (hoje por planilha provisória, futuramente pelo
  botão Sincronizar).

## Chamado: o registro central

Desde a U7, **tudo que é trabalho é um chamado** (R16), diferenciado por:

- **natureza** — `campo` (dupla se desloca, foto, assinatura, cobrança),
  `interno` (a atividade das outras equipes: apoio, prazo, data agendada,
  impacto — a equipe é a das pessoas), `comercial` (o funil da proposta —
  U29/R29).
- **tipo de demanda** (R137) — `corretiva`, `preventiva`, `operacional`,
  `prospeccao` ("Proposta Comercial"), `implantacao`, `melhoria`. A área
  técnica tem só corretiva, preventiva e implantação (R156).

A proposta comercial É um chamado (R29): mesma fila, mesmo Kanban, número
CH-. O fluxo dela continua em `visitas_tecnicas`, que virou **satélite 1:1**
do chamado (mesmo id). Vocabulário e transições: `src/lib/chamado-status.ts`.

## A decisão estrutural central: a Início é a fila (R17/R31)

A tela **Início** (`/dashboard`) mostra TODAS as atividades da pessoa —
chamados de campo, demandas internas e propostas — como lista e kanban, pelo
modelo único `src/features/atividades/modelo.ts`. Por isso a antiga lista
`/chamados` **morreu** (R31): duas telas para a mesma pergunta é uma tela
sempre atrasada. `/chamados` hoje é só tronco de rotas filhas; o endereço
exato redireciona para a Início.

**Prática:** status novo, cor nova, tradução nova de atividade → mexa em
`features/atividades/modelo.ts` (e `lib/chamado-status.ts`), nunca numa tela.
Um arquivo serve todas as telas.

## Navegação depois da R31/R32

**Menu lateral (desktop)** — `src/components/nav-itens.ts` é a fonte única;
a sidebar é recolhível (`src/lib/sidebar-recolhida.ts`):

- Início · Calendário · Clientes · Prospecção
- **Operacional** (`/painel/operacional`) — indicadores de campo NA entrada
- **Comercial** (`/gerencial`) — a própria lista de visitas/propostas (R32)
- **Administrativo** (`/painel/administrativo`) — abas Usuários · Permissões ·
  APIs, com Catálogo e Fechamentos como atalhos (R131; na prática, só admin)
- Perfil

**Barra inferior (celular)** — 5 vagas: Início · Calendário · Clientes ·
Operacional · Perfil. Técnico tem 3: Início · Agenda · Perfil (R7).

A matriz de permissões (ver `permissoes-e-acesso.md`) filtra os itens por
cima dessas listas: tela bloqueada some do menu.

## Mapa de rotas (resumo)

| Área | Rotas |
|---|---|
| Fila e detalhe | `/dashboard` · `/chamados/$id` · `/chamados/novo(-campo,-interno)` · `/chamados/painel` · `/chamados/programacao` (`/chamados/importar` redireciona, R167) |
| Comercial | `/gerencial` (+`/nova`, `/visita/$id/editar`) · `/visita/$id` e todo o wizard `/visita/$id/orcamento/*` · `/prospeccao` (`/historico` redireciona para a Início, R165; `/mapa` redireciona para o Comercial, R192) |
| Clientes | `/clientes` · `/clientes/$id` |
| Financeiro | `/contratos/novo` e `/contratos/$id` pela ficha do cliente (`/contratos` redireciona, R132) · `/fechamentos(/$id)` |
| Painéis | `/painel/operacional` · `/painel/administrativo` (·`/painel/comercial` = redirect) |
| Conta/Admin | `/perfil` · `/painel/administrativo?aba=usuarios` · `?aba=permissoes` · `?aba=apis` · `/admin` (Catálogo) |

`src/routeTree.gen.ts` é **gerado** pelo build — nunca editar à mão (ver
`desenvolvimento-e-verificacao.md`).

## Em que aparelho (R134)

Computador para todo mundo que não é da área técnica; celular para o técnico de
campo, que tem Perfil, Calendário e uma Início própria ("Bom dia, você tem X
chamados hoje" + cards) — a Fase B2 do plano. Toda tela nova diz para qual
aparelho nasceu.

## A tela da atividade (R135, R234–R239)

A página `/chamados/$id` de uma atividade interna é feita para o **computador**
e é a tela mais usada do sistema. Ela é um **documento com uma ficha ao lado**
— o mesmo desenho que Linear, Jira e Notion usam para um item de trabalho:

- **O documento, à esquerda** (a parte larga): o título e, embaixo, o número,
  há quanto tempo foi aberta e por quem, e o tipo; depois os **textos** —
  Descrição (ou Problema detectado e Solução aplicada, na corretiva), que
  ocupam a faixa inteira e, em monitor grande, ficam lado a lado; depois os
  **equipamentos** (R237) e a **conversa** (comentários).
- **A ficha, à direita** (340px): abre com a **rosca do
  progresso** (R235) — 0% a 100% contados pelos itens de checklist do campo
  onde está o plano de trabalho, a Descrição em geral e a Solução aplicada na
  corretiva; três de cinco marcados = 60%; sem checklist é 0% em qualquer
  status e 100% quando concluída. Depois vêm as propriedades, uma por linha,
  rótulo à esquerda e valor à direita: Status, Tipo, Impacto operacional,
  **Quando** (o par prazo × agendar, R232), Responsável, Apoio, Equipes, a
  proposta aprovada (na implantação) e o Cliente; no rodapé da ficha, quem
  abriu e quando, o início e a conclusão. Abaixo, fotos e arquivos e a linha
  do tempo. A tela tem **uma barra de rolagem só**: a ficha desce junto com o
  texto.

Cada propriedade de escolha (Status, Tipo, Impacto operacional, a proposta) é
um **seletor**: um botão pintado pela cor da coisa escolhida que abre a lista
(`SeletorDeOpcao`). O status aparece só ali — não há etiqueta repetida no
título.

**Equipamentos** (R237/R239): o campo vem **recolhido** — o cabeçalho resume o
que tem lá dentro ("134 sem bloco · 3 em 2 blocos") e o botão da extremidade
direita abre. Aberto, são dois painéis — **Blocos do cliente** e **Sem bloco**
(o que chegou do QAP e ainda não tem lugar). Só há dois gestos: **arrastar**
um equipamento para dentro de um bloco (de "Sem bloco" ou de outro bloco) diz
onde ele foi instalado; **remover**, o botão em cada item, tira o equipamento
do cliente e o manda para a lista de removidos do Administrativo. Nada entra
num cliente por esta tela — equipamento chega só pelo QAP. "Nesta atividade"
lista o que se moveu, com desfazer.

**O pop-up** (R238): na Início, clicar num card do quadro ou numa menção do
chat abre esta mesma tela num diálogo largo, por cima de tudo, sem sair da
página; na barra do topo, "Página inteira" leva para a página e o X fecha. No Calendário e no painel Operacional a
folha lateral de consulta rápida continua.

No editor, um item de checklist é a caixa de marcar do design system e não
"[ ]"; digitar `@` abre a lista de pessoas, e a **menção** avisa a pessoa (uma
vez, mesmo com o autosave). Só quem escreveu um comentário pode apagá-lo.
Responsável e apoio mostram o rosto. O texto continua Markdown puro no banco —
o que muda é a apresentação.

## A estrutura das atividades (R137–R150)

Ditada pelo Davi em 03/09/2026 e transcrita em
`docs/CONTEXTO_ESTRUTURA_ATIVIDADES.md`. O essencial, para quem opera:

- **Seis tipos de demanda** fora da área técnica: Manutenção Corretiva,
  Manutenção Preventiva, Operacional, Proposta Comercial, Implantação e
  Melhoria. Cada um tem os seus campos (a matriz está no documento).
- **Criar uma atividade** começa com duas perguntas — o tipo de demanda e o
  responsável. Proposta Comercial expande o formulário da visita no próprio
  pop-up (R214); responsável da equipe Técnica abre o chamado de campo; o resto
  abre o formulário do tipo.
- **O chat da Início** (R215–R217, R222–R223): o botão redondo no canto
  inferior direito abre uma conversa em 9:16, como um chat de celular. Cada
  mensagem traz a foto de quem escreveu, o título da atividade, a data/hora e
  o conteúdo numa bolha na cor do prazo daquela atividade (vermelho atrasada,
  amarelo esta semana, azul mais adiante, verde concluída). Menção num
  comentário tem **responder** e **reagir** embaixo; menção na descrição, no
  diagnóstico ou na solução abre a atividade ao clicar. Escrever no campo de
  baixo sem responder a nada manda um **recado para todos**; clicar em
  responder põe o `#Código` da atividade no campo e a resposta vira comentário
  nela. A alça de cima arrasta o chat para onde você quiser; o botão do canto
  recolhe (e ao reabrir ele volta ao mesmo lugar). O selo vermelho no botão
  conta o que chegou.
- **Toda atividade pode ser agendada** (R225): a coluna **Agendado** do quadro
  guarda o que tem dia marcado e ainda não começou — agenda-se no "+"
  (Agendar para), no Configurador (Agendar) ou arrastando o card para a
  coluna. Atividade agendada não tem prazo. Remarcar mostra "Re-agendado Nx"
  no card, e às 08h do dia o responsável e os apoios recebem o aviso.
- **Equipamentos removidos e instalados** (R226): na página de uma atividade
  de UM cliente, o que a equipe tirou e o que instalou fica registrado por
  bloco — "Remover equipamento…" lista os blocos do cliente; "Instalar
  equipamento…" busca entre os que não estão em cliente nenhum e pede o
  bloco. O patrimônio do cliente reflete na hora.
- **Equipe não se escolhe**: a etiqueta é a das pessoas na atividade
  (responsável e apoios), pelo cadastro. **Sprint não existe mais**: o prazo diz
  a semana e o mês. **Pedido de compra não existe mais**: demanda do
  Patrimônio é Operacional.
- **Impacto operacional** (Sem impacto · Baixo · Moderado · Crítico) é a
  urgência de Corretiva, Preventiva (R169) e Operacional. No campo continua a
  prioridade.
- **Cliente** pode ser um ou **mais** clientes (R151), um ou mais **grupos**
  ("Clientes de Portaria Remota", "de Monitoramento", "de Portaria Autônoma",
  "de Portaria Presencial" — R143/R173) ou interno. O grupo é um card só,
  conta no histórico de cada cliente e põe um checklist dos clientes na
  descrição.
- **Calendário**: arrastar uma atividade em aberto para outro dia muda o prazo
  (R152); o card da semana mostra só quem toca, título, cliente e tipo (R153).
- **Recebimento, início e conclusão** ficam registrados; o **calendário**
  mostra a concluída no dia da conclusão e a em aberto na hora agendada ou no
  prazo.
- **Ficha do cliente**: duas colunas no computador, síndico e zelador com
  WhatsApp, tipo de local e a foto da fachada (que aparece no card da lista).

## O que ainda não existe (não confundir com defeito)

- **Sincronizar com o QAP** — bloqueado na API do QAP; a base de clientes está
  congelada na planilha até lá (R10/R21).
- **WhatsApp/IA** — adiado por decisão do Davi; identificação será pelo nome
  do contato `"Condomínio Apartamento Nome"` (R30).
- **Implantação com tarefas geradas por IA**; **preventiva com checklist
  fotográfico por item** — planos registrados, não construídos.
- **A validação do gestor como card na Início do Vinicius** (R155/R162), a
  **proposta em duas atividades** — visita do técnico, proposta do Davi (R170)
  —, a **visita comercial travando a agenda** (R172), a **data agendada** e a
  coluna "Agendados" no quadro (R168, a coluna do banco já existe): tudo
  registrado, aguardando os fluxos da área técnica que o Davi vai ditar.
- **O Catálogo refeito** (equipamentos pelo QAP, serviços editados no app —
  R166) e o **QAP sincronizando** (diário + botão, R160).

## Referências

- `docs/ESTADO_ATUAL.md` — onde o projeto está (ler primeiro)
- `docs/PRODUTO.md` — as regras R1–R173 e o mapa de telas comentado
- `docs/PLANO_UNIFICACAO.md` — o diário técnico da unificação
- `docs/PENDENCIAS_TECNICAS.md` — defeitos conhecidos e riscos aceitos
- `DESIGN_SYSTEM.md` — o design system completo
