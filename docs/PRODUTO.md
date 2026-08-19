# Prever App — Documento Mestre do Produto

O documento vivo do sistema: papéis, telas, fluxos e regras de negócio, do
jeito que o aplicativo DEVE ser. As regras chegam ditadas pelo Davi, entram
aqui numeradas, e só depois viram implementação — sempre gradual, sempre
revisada.

Divisão de papéis entre os documentos:
- **PRODUTO.md** (este) — o que o sistema é: perfis, telas, fluxos, regras.
- **PLANO_UNIFICACAO.md** — como estamos construindo: etapas, migrations,
  registro de execução.
- **SISTEMA_OS.md** — histórico da fundação do módulo de OS (etapas 0–6).

Última atualização: 2026-08-18.

---

## 1. Visão

Um único aplicativo para toda a operação da Prever: propostas comerciais,
chamados de todas as áreas, execução de campo, demandas internas, contratos,
cobrança e fechamentos — integrado ao QAP ERP, que permanece como fonte de
verdade do patrimônio, do estoque e do cadastro societário dos clientes.

O **SAC é a porta de entrada** da operação: recebe demandas de todos os lados
(interfone de apartamento, portão que o zelador reportou por WhatsApp, pedido
de controle remoto, pedido de proposta nova) e as distribui pelos trilhos
certos do sistema.

## 2. Papéis (permissão) e equipes (roteamento)

Princípio herdado da U0 e inegociável: **papel responde "o que pode"; equipe
responde "de quem é a fila"**. Equipes nunca viram papel.

### 2.1 Os papéis

| Papel | Quem é | Resumo |
|---|---|---|
| **Admin** | Davi | **Tudo.** Todas as telas, todas as ações, gestão de usuários. |
| **Comercial** | time comercial | Gestor. Aprova visitas, prepara e envia propostas, contratos, financeiro. **Não é técnico** — não executa OS. |
| **SAC** | atendentes do SAC | Gestor de chamados. Recebe, abre, tria e acompanha chamados de todos os trilhos. Coordena, planeja, programa — **não é técnico**, não executa. |
| **Técnico** | técnicos de orçamento, duplas de campo, Controle Patrimonial | Executa o que está atribuído a ele. Perfil enxuto de 3 abas. |

- **Gestor não é técnico**: gestor coordena, planeja e programa as atividades
  dos outros (R1).
- **Controle Patrimonial (Gilleno) usa o perfil de técnico** (R6): a fila dele
  são os chamados de "pedido de compra". Sem perfil especial.
- A **equipe** (`profiles.equipe`: ti, patrimonio, tecnica, audiovisual,
  business_ops, comercial) continua sendo atributo, definindo para qual fila as
  demandas vão.

### 2.2 Matriz de acesso (proposta — confirmar nas questões §8)

| Módulo | Admin | Comercial | SAC | Técnico |
|---|:-:|:-:|:-:|:-:|
| Painel de chamados (dashboards) | ✅ | ✅ | ✅ | — |
| Calendário geral (todos os técnicos) | ✅ | ✅ | ✅ | só o próprio |
| Lista de chamados (todos) | ✅ | ✅ | ✅ | só os seus |
| Abrir chamado (qualquer trilho) | ✅ | ✅ | ✅ | ❓ (Q em aberto desde a etapa 3) |
| Programação da equipe técnica | ✅ | ✅ | ❓ | — |
| Executar OS (fotos, assinatura, peças) | ✅ | — | — | ✅ |
| Conferir e fechar OS | ✅ | ✅ | ❓ | — |
| Visitas / propostas (gerencial) | ✅ | ✅ | — | as suas |
| Demandas internas (quadro) | ✅ | ✅ | ✅ | as suas |
| Contratos | ✅ | ✅ | — | — |
| Cobrança e fechamentos (valores) | ✅ | ✅ | ❓ (proposta: não) | — |
| Clientes (cadastro) | ✅ | ✅ | leitura | leitura |
| Usuários | ✅ | — | — | — |

## 3. O chamado unificado — a espinha do sistema

O SAC abre **uma coisa só** — um chamado — e escolhe o trilho. O sistema cria o
registro no lugar certo. Painel, calendário e lista do SAC enxergam os quatro
trilhos juntos.

```
                          ┌──────────────────────────────────────────┐
   WhatsApp do SAC        │              CHAMADO (SAC)               │
   telefone, e-mail  ───► │  cliente? · descrição · trilho · prazo   │
   portaria remota        └───────┬──────────┬──────────┬───────┬────┘
   pedido interno                 │          │          │       │
                                  ▼          ▼          ▼       ▼
                            ┌─────────┐ ┌────────┐ ┌────────┐ ┌─────────────┐
                            │OS campo │ │Demanda │ │Demanda │ │Visita       │
                            │(Técnica)│ │  T.I   │ │Patrim. │ │técnica      │
                            │         │ │        │ │(compra)│ │(→ proposta) │
                            └─────────┘ └────────┘ └────────┘ └─────────────┘
```

### 3.1 Os quatro trilhos

| Trilho | Vira | Tipos | Executor | Ciclo |
|---|---|---|---|---|
| **Técnica (campo)** | `ordens_servico` | corretiva · preventiva · **operacional** (R5 — ex.: entrega de controle remoto) · implantação | duplas de campo | aberta → agendada → em atendimento → executada → fechada |
| **T.I** | `demandas` (equipe ti) | melhoria · corretiva · implantação · operacional | Erik, Nicholas | não iniciada → em andamento → (stand-by) → concluída |
| **Controle Patrimonial** | `demandas` (equipe patrimonio) | **pedido de compra** (R6 — tipo novo) · operacional | Gilleno | idem demandas |
| **Comercial (proposta)** | `visitas_tecnicas` | pedido de proposta | técnico de orçamento agenda/executa; comercial aprova e envia | ver §5 |

- **R5**: a OS de campo ganha o tipo `operacional` — entrega de controle
  remoto, cadastros, tarefas de campo que não são conserto nem rotina.
  (Hoje o CHECK aceita corretiva/preventiva/implantacao; muda na implementação.)
- **R6**: `demandas` ganha o tipo `pedido_compra`.
- Todo chamado guarda **quem abriu, quando, por qual canal** e, quando houver,
  o **cliente** e o **equipamento envolvido**.

## 4. Interfaces por perfil

### 4.1 SAC — 3 abas de trabalho (+ Perfil)

**Aba 1 — Painel (gerencial, dashboards e infos)**
- Chamados em aberto **agora** (número grande).
- Totais por **semana / mês / ano**.
- Lista dos chamados em aberto.
- **Filtros em tudo**: por técnico, por tipo (corretiva, preventiva,
  operacional…), por cliente, por trilho.
- **Gráfico de quantidade de manutenções** (por período; quebra por tipo).
- Base: o `/os/painel` atual, estendido para os quatro trilhos e com os
  filtros novos.

**Aba 2 — Calendário geral**
- **Tudo o que está previsto**: chamados + visitas técnicas, de **todos os
  técnicos**, num calendário só.
- Filtros: por técnico, por tipo de chamado.
- Base: o `/calendario` atual (que já funde visitas + OS), ganhando os filtros
  e a visão "todos" para o SAC.

**Aba 3 — Chamados (lista de cards)**
- Cards de **todos os chamados** (os quatro trilhos).
- **Filtros**: status, trilho, tipo, técnico/responsável, cliente, prioridade.
- **Ordenação** (ícone de ordenar) — proposta a confirmar:
  1. Mais recentes primeiro (padrão)
  2. Prazo/SLA mais apertado primeiro
  3. Prioridade (urgente → baixa)
  4. Cliente A→Z
  5. Última atualização
- Clicar no card → **página do chamado** com todas as informações (a página
  do trilho correspondente: OS, demanda ou visita).

### 4.2 Técnico — 3 abas (R7)

| Aba | Conteúdo |
|---|---|
| **Home** | Cards do trabalho dele: visitas técnicas atribuídas, chamados de campo atribuídos e demandas em que é responsável — tudo numa fila só, ordenada por data/prazo. |
| **Agenda** | O calendário só com o que é dele. |
| **Perfil** | Dados, tema, sair. |

Muda em relação a hoje: a barra do técnico tem 4 itens (Início, Calendário,
Chamados, Perfil) — passa a 3, com os chamados dentro da Home. O Controle
Patrimonial vê a mesma coisa; a fila dele são os pedidos de compra.

### 4.3 Comercial

Tudo do gerencial de hoje (visitas, propostas, aprovações) + Contratos +
Fechamentos + o painel de chamados. Não executa OS.

### 4.4 Admin

Tudo (R3).

## 5. Ciclo comercial — corrigido (R4)

**A aprovação da visita é interna; quem aprova a PROPOSTA é o cliente.**

```
visita técnica (orçamento)
  → concluída → aguardando aprovação
  → APROVADA pelo comercial          ← aprovação INTERNA da visita
  → proposta preparada e ENVIADA ao cliente
  → decisão DO CLIENTE:
       ACEITA   → cliente ativo · contrato · OS de implantação
       RECUSADA → registrado; cliente segue prospecto
```

Consequências no sistema (a implementar):
- `visitas_tecnicas` ganha o pós-aprovação: `proposta_enviada_em`,
  `proposta_resultado` (aguardando | aceita | recusada), `proposta_resultado_em`.
- **Visita aprovada ≠ cliente.** `clientes.situacao = 'ativo'` só com aceite do
  cliente (ou presença no QAP — §6). O backfill da Etapa 1 e a sugestão da tela
  de consolidação usavam "visita aprovada → ativo": **serão corrigidos**.
- O elo `origem_proposta_id` do contrato (U2) passa a nascer do **aceite**, não
  da aprovação.
- O botão "gerar implantação" (etapa 5) passa a aparecer no aceite.
- Painel comercial ganha o funil real: visitas → aprovadas → enviadas →
  aceitas.

## 6. Integração QAP — atualizada

**Davi exporta via API do QAP**: os **clientes**, os **equipamentos em
estoque** e os **equipamentos em cada cliente**. Fora essas informações, tudo
fica centralizado no app.

| Dado | Fonte de verdade | Papel no app |
|---|---|---|
| Clientes (razão social, CNPJ) | **QAP** | importa/concilia → preenche `documento`, `qap_cliente_id`, corrige `situacao` (quem está no QAP é cliente de verdade) |
| Estoque | **QAP** | consulta importada (disponibilidade p/ agendar implantação) |
| Equipamentos por cliente | **QAP** | concilia com o as-built (`cliente_equipamentos` + unidades) |
| Contratos, OS, chamados, demandas, cobranças, fechamentos | **App** | nasce e vive aqui |
| Catálogo comercial (preço/markup) | planilha (ETL) | como hoje |
| Movimentação física | registrada no app (`os_pecas`) → lançada no QAP | relatório para o Gilleno até a escrita via API existir |

## 7. Regras ditadas (log numerado)

Cada conversa de produto acrescenta regras aqui. Fonte: Davi, 2026-08-18.

- **R1** — O SAC é gestor. Gestor não é técnico: coordena, planeja e programa
  as atividades dos outros.
- **R2** — O Comercial também não é técnico.
- **R3** — O Admin é tudo.
- **R4** — Aprovar visita é ato interno do comercial; quem aprova ou recusa a
  **proposta** é o **cliente**. Visita aprovada não significa cliente.
- **R5** — Chamado de campo tem o tipo **operacional** (ex.: entrega de
  controle remoto), além de corretiva, preventiva e implantação.
- **R6** — O Controle Patrimonial usa o perfil de técnico; o chamado dele é o
  **pedido de compra**.
- **R7** — O perfil do técnico tem **3 abas**: Home (cards das visitas e
  chamados dele), Agenda e Perfil.
- **R8** — O SAC tem 3 abas de trabalho: **Painel** (dashboards com filtros por
  técnico/tipo/cliente e gráfico de manutenções), **Calendário geral** (tudo de
  todos, filtrável) e **Chamados** (lista de cards com filtros e ordenação;
  card → página do chamado).
- **R9** — Chamados entram por todos os lados no SAC e podem ser: técnicos
  (campo), para o T.I, pedido de compra para o Controle Patrimonial, ou pedido
  de proposta (visita técnica → proposta → decisão do cliente).
- **R10** — Clientes e equipamentos (estoque e por cliente) vêm do QAP via
  API; o resto é centralizado no app.

## 8. Questões em aberto — para responder de uma vez

**Papéis e permissões**
1. **Papel do Vinicius** (coordena a técnica, programa as duplas, decide
   cobrança): admin, comercial, ou criamos um papel `gestor`? Ele precisa ver
   valores (cobrança/fechamentos).
2. **SAC vê valores?** Proposta: **não** — SAC coordena chamados, mas cobrança
   e fechamentos ficam com admin + comercial (e Vinicius). Confirma?
3. **SAC programa técnicos?** (tela `/os/programacao`) Ou só abre/acompanha e a
   programação fica com o Vinicius?
4. **SAC confere e fecha OS?** Hoje fechar é do gestor. O SAC fecha, ou avisa e
   quem fecha é Vinicius/comercial?
5. **Técnico pode abrir chamado?** (pergunta herdada da etapa 3 — hoje só
   gestor abre.)

**Chamado unificado**
6. Chamado de **proposta**: o SAC já agenda a visita (escolhe técnico de
   orçamento e data), ou só registra o pedido e o comercial agenda?
7. **Pedido de compra**: precisa de campos próprios? (fornecedor sugerido,
   valor estimado, link do produto, quem aprova a compra?)
8. Chamado **operacional** de campo tem SLA? (proposta: usa o padrão "normal",
   72h, editável no os_sla.)
9. A **ordenação** da lista do SAC (recentes / prazo / prioridade / cliente /
   última atualização) — está bom esse conjunto?

**Ciclo comercial**
10. O registro do **aceite do cliente** (proposta aceita/recusada + datas) no
    modelo da visita — confirma? Quer registrar também o motivo da recusa?

**Insumos aguardados**
11. **Conversas do SAC** (export do WhatsApp) — para eu ler, interpretar os
    padrões de demanda e refinar o chamado (e alimentar a futura IA, U9).
12. **Export do QAP via API** — clientes + estoque + equipamentos por cliente.
    Em que formato vem (JSON/CSV)? Assim que chegar, desenho a importação.
13. **Export do Notion** (CSV) — para a importação de demandas já construída.
14. **Base do gestor-os** — contratos/cobranças históricos para migrar (U4
    pendente).

**Herdadas**
15. Alcance de notificação com o app fechado (FCM × WhatsApp/e-mail) — §10.6
    do SISTEMA_OS; fica mais urgente com o SAC operando dentro do app.

## 9. Estado de implementação

| Módulo | Estado |
|---|---|
| Propostas/orçamento, OS de campo (etapas 0–6), demandas, contratos, cobrança, fechamentos | construídos (U0–U5) |
| Papel SAC, chamado unificado, painel/calendário/lista do SAC, técnico com 3 abas, tipo operacional, pedido de compra, aceite do cliente | **especificados aqui — a implementar (U6)** |
| Import QAP (clientes/estoque/equipamentos) | aguardando export (U7) |
| API QAP contínua | aguardando dev do QAP (U8) |
| IA no WhatsApp do SAC | futuro (U9) |
