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

O Controle Patrimonial usa perfil de técnico (R6). "TI" trabalha nos chamados
de natureza `interno` (sprint/equipes — R15/R16).

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
  `interno` (ex-Notion: equipe, sprint, apoio), `comercial` (o funil da
  proposta — U29/R29).
- **tipo** (R24) — `proposta_comercial`, `corretiva`, `preventiva`,
  `implantacao` (mais os operacionais herdados).

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
| Fila e detalhe | `/dashboard` · `/chamados/$id` · `/chamados/novo(-campo,-interno)` · `/chamados/painel` · `/chamados/programacao` · `/chamados/importar` |
| Comercial | `/gerencial` (+`/nova`, `/visita/$id/editar`) · `/visita/$id` e todo o wizard `/visita/$id/orcamento/*` · `/prospeccao` · `/mapa` · `/historico` |
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

## A tela da atividade (R135)

A página `/chamados/$id` de uma atividade interna (e o painel lateral, que usa
os mesmos componentes) tem, no computador, duas colunas: o **texto** na larga —
a descrição num editor de blocos e a conversa — e as **propriedades** na
estreita. Cada propriedade (Status, Classificação, Prioridade, Equipe, Sprint) é
um **seletor**: um botão pintado pela cor da coisa escolhida que abre a lista
(`SeletorDeOpcao`). No editor, um item de checklist é a caixa de marcar do
design system e não "[ ]"; digitar `@` abre a lista de pessoas, e a **menção**
avisa a pessoa (uma vez, mesmo com o autosave). Só quem escreveu um comentário
pode apagá-lo. Responsável e apoio mostram o rosto. O texto continua Markdown
puro no banco — o que muda é a apresentação.

## A estrutura das atividades (R137–R150)

Ditada pelo Davi em 03/09/2026 e transcrita em
`docs/CONTEXTO_ESTRUTURA_ATIVIDADES.md`. O essencial, para quem opera:

- **Seis tipos de demanda** fora da área técnica: Manutenção Corretiva,
  Manutenção Preventiva, Operacional, Proposta Comercial, Implantação e
  Melhoria. Cada um tem os seus campos (a matriz está no documento).
- **Criar uma atividade** começa com duas perguntas — o tipo de demanda e o
  responsável. Proposta Comercial abre o fluxo da visita; responsável da equipe
  Técnica abre o chamado de campo; o resto abre o formulário do tipo.
- **Equipe não se escolhe**: a etiqueta é a das pessoas na atividade
  (responsável e apoios), pelo cadastro. **Sprint não existe mais**: o prazo diz
  a semana e o mês. **Pedido de compra não existe mais**: demanda do
  Patrimônio é Operacional.
- **Impacto operacional** (Sem impacto · Baixo · Moderado · Crítico) é a
  urgência de Corretiva e Operacional. No campo continua a prioridade.
- **Cliente** pode ser um cliente, um **grupo** ("Clientes de Portaria Remota")
  ou interno. O grupo é um card só, conta no histórico de cada cliente e põe um
  checklist dos clientes na descrição.
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

## Referências

- `docs/PRODUTO.md` — as regras R1–R32 e o mapa de telas comentado
- `docs/PLANO_UNIFICACAO.md` — o diário técnico da unificação
- `docs/PENDENCIAS_TECNICAS.md` — defeitos conhecidos e riscos aceitos
- `DESIGN_SYSTEM.md` — o design system completo
