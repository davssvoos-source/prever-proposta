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

| Papel | Vê valores? | Resumo |
|---|:-:|---|
| **Admin** | ✅ | **Tudo.** Todas as telas, todas as ações, gestão de usuários. |
| **Comercial** | ✅ | Gestor **que vê valores** e aprova visita técnica para fazer propostas. Contratos, cobrança, fechamentos. **Não é técnico.** |
| **SAC** | ❌ | Gestor de chamados — **não vê valores**. Recebe, abre, tria e acompanha chamados de todos os trilhos. **Não é técnico.** |
| **Técnico** | ❌ | Executa o que está atribuído a ele. Perfil enxuto de 3 abas. |

**Quem é quem** (definido em 2026-08-18):

| Pessoa | Papel | Equipe |
|---|---|---|
| Davi | **Admin** | — |
| Vinicius | **Admin** | Técnica (coordenação) |
| Atendentes do SAC | **SAC** | — |
| Time comercial | **Comercial** | Comercial |
| Gilleno | **Técnico** | Controle Patrimonial |
| Nicholas | **Técnico** | T.I |
| Erik | **Técnico** | T.I |
| Breno | **Técnico** | Técnica (líder de dupla) |
| Líderes das duplas de campo | **Técnico** | Técnica |

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
| Cobrança e fechamentos (valores) | ✅ | ✅ | **❌ (decidido)** | — |
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
| **Home** | Topo: **"Você tem X chamados hoje"** (R11). Abaixo, cards do trabalho dele: visitas técnicas atribuídas, chamados de campo e demandas em que é responsável — tudo numa fila só, ordenada por data/prazo. |
| **Agenda** | O calendário só com o que é dele. |
| **Perfil** | Dados, tema, sair. |

- **R11** — o contador do topo soma tudo que é dele com data para hoje (visitas
  agendadas, chamados agendados, o que está em atendimento agora e demandas com
  prazo hoje). **Visita técnica conta como chamado** nesse número.
- **R12** — no perfil do técnico, a visita técnica para proposta comercial é
  **tratada como um chamado** (mesmo card, mesma fila); ao **iniciar**, ela
  leva para o fluxo de montagem do orçamento que já existe. O trilho por trás
  não muda — muda a apresentação.

Muda em relação a hoje: a barra do técnico tinha 4–5 itens (Início, Calendário,
Chamados, Demandas, Perfil) — passa a 3, com chamados e demandas dentro da
Home. O Controle Patrimonial vê a mesma coisa; a fila dele são os pedidos de
compra. O quadro completo de demandas passa a ser tela de gestor; o técnico
chega ao detalhe da demanda pelo card da Home.

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

Consequências no sistema — **construídas na U8**:
- `visitas_tecnicas` ganhou o pós-aprovação: `proposta_enviada_em`,
  `proposta_resultado` (aguardando | aceita | recusada), `proposta_resultado_em`
  e `proposta_motivo_recusa`.
- Duas RPCs: `registrar_envio_proposta()` e `registrar_resultado_proposta()`.
  O aceite é o único ponto que promove `clientes.situacao` para `ativo`.
- **Visita aprovada ≠ cliente.** O backfill da Etapa 1 marcava "visita aprovada
  → ativo": foi **desfeito**. Continua ativo só quem tem prova de relação real
  — proposta aceita, contrato, chamado de campo executado, cobrança gerada, ou
  presença no QAP. Os rebaixados ficaram registrados em
  `clientes_rebaixados_u8` (reversível).
- A tela de consolidação parou de sugerir "ativo" a partir da aprovação.
- O botão de gerar implantação **saiu da aprovação e foi para o aceite**.
- Painel comercial ganhou o funil real: visitas → aprovadas → enviadas →
  aceitas / recusadas.

Ainda em aberto: o elo `origem_proposta_id` do contrato (U2) deve passar a
nascer do aceite — hoje o contrato é cadastrado à mão e o campo fica livre.

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
- **R11** — A Home do técnico abre com **"Você tem X chamados hoje"** no topo.
- **R12** — Para o técnico, a visita técnica de proposta é um chamado como os
  outros; iniciar a visita leva ao fluxo de montagem do orçamento existente.
- **R13** — Papéis definidos: Davi e Vinicius são **Admin**; Gilleno, Nicholas,
  Erik e Breno são **Técnicos**; o SAC é **gestor que não vê valores**; o
  Comercial é **gestor que vê valores** e aprova visitas para fazer propostas.
- **R14** — Nas duplas de campo, **só o líder tem conta no app**; o ajudante
  não. Tudo é registrado no nome do líder. O Breno é líder de uma das duplas
  (equipe Técnica).
- **R15** — As equipes reais (confirmadas no export do Notion) incluem **SAC**
  e **Monitoramento / Portaria** — entraram no domínio junto com as demais.
  "T.I / Técnica" do Notion vira **T.I.** aqui; "Marketing / Comercial" vira
  **Comercial**. Célula com várias equipes usa a primeira.
- **R17** — **A Início mostra TODAS as atividades que envolvem a pessoa**, numa
  fila só, com duas visões: lista de cards e **quadro por status**. O quadro
  tem botões de *padrão* (Meu dia · Tudo meu · Sprint deste mês · Stand-by ·
  Atrasados · A conferir · Sem responsável · Minha equipe) e filtros de
  **vínculo** (responsável · apoio · eu abri), período e pessoa. Padrão filtra
  e destaca colunas; **nunca reagrupa** — o eixo é sempre o status, senão o
  botão vira um segundo seletor de visualização escondido.
- **R16** — **Chamado e demanda são a mesma coisa: chamado.** Um registro só,
  com `natureza` dizendo como se executa: `campo` (a dupla se desloca, tira
  foto, colhe assinatura, gera cobrança) ou `interno` (equipe, sprint, apoio —
  o que era o quadro do Notion). Um endereço só (`/chamados`), um número só
  (`CH-AAAA-NNNN`), uma aba só no rodapé. O que era "trilho" virou filtro
  dentro da lista, não menu separado. Visita técnica de proposta continua
  fora da tabela: ela é o funil comercial, não o trabalho.

## 8. Questões em aberto — para responder de uma vez

**Respondidas em 2026-08-18** (viraram a R13): ~~papel do Vinicius~~ → admin;
~~SAC vê valores?~~ → não.

**Papéis e permissões**
1. ~~Equipe do Breno~~ → **respondida**: Técnica, líder de dupla (R14).
2. ~~SAC programa técnicos?~~ → **respondida pela sua própria definição do
   papel**: "o SAC é gestor… ele coordena, ele planeja, **programa as
   atividades dos outros**". `/chamados/programacao` e `/chamados/indicadores`
   foram abertos para o SAC na U7 — nenhuma das duas mostra valor. Se a
   intenção era outra, é só dizer e eu fecho de volta.
3. **SAC confere e fecha OS?** Hoje fechar é do gestor. O SAC fecha, ou avisa e
   quem fecha é Vinicius/admin? *(enquanto não responde: o botão de fechar
   aparece para o SAC, já que é gestor)*
4. **Técnico pode abrir chamado?** (pergunta herdada da etapa 3 — hoje só
   gestor abre.)

**Chamado unificado**
5. Chamado de **proposta**: o SAC já agenda a visita (escolhe técnico de
   orçamento e data), ou só registra o pedido e o comercial agenda?
6. ~~Pedido de compra: precisa de campos próprios?~~ → **construído na U9**
   com as suposições: quantidade, fornecedor sugerido, valor estimado, link do
   produto e justificativa; caminho `solicitado → em cotação → aprovado →
   comprado → recebido` (ou `recusado` com motivo); **quem libera o gasto é
   quem responde pelo financeiro** (admin e comercial) — SAC abre e acompanha,
   Patrimônio cota, compra e recebe. Se a alçada for outra (ex.: Patrimônio
   aprova até certo valor), é um IF na RPC `decidir_pedido_compra`.
7. Chamado **operacional** de campo tem SLA? (proposta: usa o padrão "normal",
   72h, editável no os_sla.)
8. A **ordenação** da lista do SAC (recentes / prazo / prioridade / cliente /
   última atualização) — está bom esse conjunto?

**Ciclo comercial**
9. ~~O registro do aceite do cliente~~ → **construído na U8** com a suposição
   de que o motivo da recusa vale a pena (campo livre, opcional): é o dado que
   responde "por que perdemos". Se não quiser esse campo, digo e removo.

**Insumos aguardados**
10. **Conversas do SAC** (export do WhatsApp) — para eu ler, interpretar os
    padrões de demanda e refinar o chamado (e alimentar a futura IA, U9).
11. **Export do QAP via API** — clientes + estoque + equipamentos por cliente.
    Em que formato vem (JSON/CSV)? Assim que chegar, desenho a importação.
12. ~~Export do Notion~~ → **recebido e importado** (2026-08-18): 537 tasks de
    2026 do Davi e do Erik entraram pela migration
    `20260819000000_import_notion_davi_erik.sql`. **Não reimportar o mesmo CSV
    pela tela /demandas/importar** (chave de origem diferente duplicaria).
    Ficaram de fora, por regra: 564 tasks só de 2024/2025, 31 sem equipe,
    5 abertas sem sprint, 1 sem título — lista no PLANO_UNIFICACAO §12.
13. **Base do gestor-os** — contratos/cobranças históricos para migrar (U4
    pendente).

**Herdadas**
14. Alcance de notificação com o app fechado (FCM × WhatsApp/e-mail) — §10.6
    do SISTEMA_OS; fica mais urgente com o SAC operando dentro do app.

## 9. Mapa de telas — depois da fusão (revisão de 2026-08-19)

Levantado do código real. É a **pauta da discussão página por página**: cada
item abaixo pode ser ajustado.

> **Fusão (U7).** Chamado e demanda viraram o mesmo registro. Não existe mais
> `/os/*` nem `/demandas/*`: tudo mora em `/chamados/*`, e o que separa os dois
> modos de trabalho é o campo **natureza** — `campo` (a dupla se desloca, tira
> foto, colhe assinatura, gera cobrança) e `interno` (o antigo quadro do
> Notion: equipe, sprint, apoio). Isso responde os pontos 1 e 2 da revisão
> anterior.

### 9.1 As barras de rodapé

São **4 perfis** e **3 barras** — Admin e Comercial compartilham a mesma
(`useUserCargo` devolve "admin" para os dois).

| Perfil | Itens do rodapé |
|---|---|
| **Admin** (Davi, Vinicius) | Início · Calendário · **Chamados** · Gerencial · Perfil |
| **Comercial** | *idêntica à do Admin* |
| **SAC** | Início · Calendário · **Chamados** · Perfil |
| **Técnico** (Gilleno, Nicholas, Erik, Breno, líderes de dupla) | Início · **Agenda** · Perfil |

Agora "Chamados" leva **todo mundo para o mesmo lugar** (`/chamados`), e a
antiga aba "Demandas" saiu: o quadro por sprint virou um modo de visualização
dentro da própria lista (botão de alternar lista ↔ quadro).

### 9.2 Admin e Comercial — 5 abas

| Aba | Rota | O que tem hoje |
|---|---|---|
| **Início** | `/dashboard` | Banner "X visitas hoje", card da próxima visita (contagem regressiva + foto da fachada), card do próximo chamado, 4 métricas de visitas, filtros hoje/semana/mês, filtro por técnico e por status, lista de visitas |
| **Calendário** | `/calendario` | Grade mensal com visitas **+** chamados de todos os técnicos; filtros por técnico e por tipo |
| **Chamados** | `/chamados` | A fila inteira: campo, interno e visitas de proposta. Filtros de situação, trilho (campo / proposta / por equipe), responsável, busca, 5 ordenações e alternância **lista ↔ quadro por sprint**. Botões: painel, abrir chamado |
| **Gerencial** | `/gerencial` | Painel de visitas/propostas + atalhos para Chamados, Clientes, **Contratos**, **Fechamentos**, Usuários |
| **Perfil** | `/perfil` | Dados, tema, sair |

**Telas internas alcançáveis** (sem entrada própria no rodapé):
`/chamados/$id` (a página do chamado — corpo de campo ou interno conforme a
natureza) · `/chamados/novo` (triagem) · `/chamados/novo-campo` ·
`/chamados/novo-interno` · `/chamados/painel` (gerencial dos trilhos) ·
`/chamados/indicadores` (mergulho da operação de campo: SLA, carga por técnico,
clientes que mais chamam) · `/chamados/programacao` (agenda das duplas) ·
`/chamados/importar` (CSV do Notion) ·
`/clientes` · `/clientes/$id` (inventário e contratos) · `/clientes/novo` ·
`/clientes/migrar` · `/contratos` · `/contratos/novo` · `/contratos/$id` ·
`/fechamentos` · `/fechamentos/$id` · `/gerencial/nova` ·
`/gerencial/usuarios` *(só Admin)* · `/visita/$id` e todo o fluxo de orçamento
(categorias → blocos → complementos → pré-envio → pagamento) ·
`/historico` · `/mapa` · `/projeto/$id` · `/admin`

### 9.3 SAC — 4 abas

| Aba | Rota | O que tem hoje |
|---|---|---|
| **Início** | `/dashboard` | Mesma tela do Admin |
| **Calendário** | `/calendario` | Tudo de todos os técnicos, com filtros por técnico e tipo |
| **Chamados** | `/chamados` | A mesma lista do Admin — é a aba 3 do R8 |
| **Perfil** | `/perfil` | — |

Alcança também: `/chamados/painel`, `/chamados/novo` e os dois formulários,
`/chamados/$id`, `/chamados/indicadores`, `/chamados/programacao`
(coordenar e programar é papel do SAC, R13), `/clientes` (leitura),
`/gerencial/nova` (só o formulário de visita, pelo trilho de proposta).

**Bloqueado para o SAC:** contratos, fechamentos e **qualquer valor** — o card
de cobrança dentro do chamado só aparece para quem passa em
`pode_ver_financeiro` (admin e comercial). `/gerencial` (o painel) também fica
fora.

### 9.4 Técnico — 3 abas

| Aba | Rota | O que tem hoje |
|---|---|---|
| **Início** | `/dashboard` | **"Você tem X chamados hoje"** + próxima visita + a fila dele: chamados de campo e chamados internos |
| **Agenda** | `/calendario` | Só o que é dele |
| **Perfil** | `/perfil` | — |

Alcança pelos cards: `/chamados/$id` (executar: fotos, checklist, peças,
assinatura — ou tocar o chamado interno) e `/visita/$id` + fluxo de orçamento.
A lista `/chamados` fica fora do rodapé dele e a rota barra a entrada direta,
mas **os filhos passam**: tocar um card da Home abre o chamado normalmente.
Não vê valores em lugar nenhum.

### 9.5 Telas legadas / sem dono claro

`/admin` · `/historico` · `/mapa` · `/projeto/$id` · `/novo` (só redireciona
para `/gerencial/nova`). Nenhuma tem entrada no rodapé — **candidatas a
revisão**: manter, mover para dentro de outra tela, ou remover.

### 9.6 Pontos que a revisão levantou

1. ~~"Chamados" leva a telas diferentes por perfil~~ — **resolvido na U7**:
   um endereço só, `/chamados`, para todos os perfis.
2. **Dois painéis ainda**: `/chamados/painel` (visão gerencial dos trilhos) e
   `/chamados/indicadores` (SLA, carga por técnico, tempo médio — só campo).
   Fundir num só com aba interna, ou manter os dois? *Em aberto.*
3. **Comercial tem a barra idêntica à do Admin.** Faz sentido, ou o Comercial
   deveria ter uma barra própria (ex.: trocar "Gerencial" por "Contratos")?
   *Em aberto.*
4. **Técnico não tem "Chamados" no rodapé** — chega só pelo card da Home.
   Suficiente? *Em aberto.*
5. **Telas legadas** (§9.5) — o que fazer com cada uma. *Em aberto.*

## 10. Estado de implementação

| Módulo | Estado |
|---|---|
| Propostas/orçamento, OS de campo (etapas 0–6), demandas, contratos, cobrança, fechamentos | construídos (U0–U5) |
| Papel SAC (banco + gestão de usuários), técnico com 3 abas e "Você tem X chamados hoje" | **construído (U6a)** |
| Import das tasks 2026 do Notion (Davi 251 + Erik 286) e equipes reais (SAC, Monitoramento) | **construído** |
| **Lista unificada de chamados** (`/chamados` — aba 3 do SAC): quatro trilhos, filtros por situação/trilho/responsável, busca e 5 ordenações | **construído (U6b)** |
| **Abertura unificada** (`/chamados/novo` — R9), tipo `operacional` na OS (R5) e `pedido_compra` na demanda (R6) | **construído (U6c)** |
| **Painel de chamados** (`/chamados/painel` — aba 1) e **calendário geral com filtros** (aba 2) | **construído (U6d)** — as 3 abas do SAC estão completas |
| **Fusão chamado × demanda** (U7): tabela `chamados` única com `natureza`, endereço único `/chamados/*`, rodapé com uma aba só, quadro por sprint como modo de visualização | **construído (U7)** |
| **Aceite do cliente** (U8 — R4): pós-aprovação na visita, promoção do cliente só no aceite, correção do backfill "aprovada ⇒ ativo", funil comercial | **construído (U8)** |
| **Pedido de compra completo** (U9 — Q6): ficha `chamado_compra`, caminho solicitado→recebido, alçada de aprovação no financeiro, alerta de pedido parado | **construído (U9)** |
| **Home de atividades** (U10 — R17): todas as atividades do usuário numa fila só, seletor lista ↔ quadro, quadro por status, padrões de kanban e filtro por vínculo | **construído (U10)** — só código, sem migration |
| Import QAP (clientes/estoque/equipamentos) | aguardando export (U10) |
| API QAP contínua | aguardando dev do QAP (U11) |
| IA no WhatsApp do SAC | futuro (U12) |
