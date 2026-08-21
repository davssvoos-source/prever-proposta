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
- **R19** — **"Executado" e "concluído" são a mesma coisa.** Quando o técnico
  encerra o atendimento, o chamado **já fica concluído** — não existe estado em
  que o trabalho está feito e o registro está aberto. A conferência que liberava
  a cobrança não some junto: ela nunca dependeu do status, e sim de
  `faturamento_status`, que a U0 deixou fora do ciclo justamente para isso. A
  fila "A conferir" passa a ser *campo + concluído + a analisar*, o que é mais
  fiel — chamado sem nada a cobrar sai dela sozinho.
- **R20** — **O quadro é a fila de trabalho, não o espelho do vocabulário.**
  Cinco colunas: Aguardando início · Em andamento · Stand-by · Aguardando
  aprovação · Concluído. `agendado` cai em "Aguardando início" (com hora
  marcada ou sem, continua esperando para começar) e `cancelado` não tem coluna
  — trabalho cancelado não é trabalho. Nenhum dos dois some calado: a hora fica
  no card, e o quadro diz quantos cancelados ficaram de fora.
- **R18** — **Quem abre cada tela é configuração, não código.** O admin edita
  uma matriz de 21 telas × 3 papéis em `/gerencial/permissoes`; o rodapé e as
  guardas de rota leem dela. O **admin não entra na matriz** (tem tudo por
  regra de sistema — se fosse linha de tabela, um clique errado trancaria o
  admin fora da própria tela). Início e Perfil são obrigatórias e não podem ser
  desmarcadas. Permissão de tela é **navegação**: impede de abrir, não
  substitui RLS — o técnico continua vendo só os chamados dele mesmo com o
  calendário liberado.
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

- **R21** — **O cliente é do QAP, não nosso.** Todo cliente registrado no
  sistema vem do QAP, e o único jeito de atualizar clientes e equipamentos é o
  botão **Sincronizar** na página de Clientes. O app **não cria cliente**: nem
  por formulário, nem ao montar visita, nem por proposta aceita. Cliente é
  leitura; o ERP é quem manda. *(Davi, 2026-08-21.)*

- **R22** — **Prospecto não é cliente.** Prédios e locais que orçamos e cuja
  proposta não foi aprovada não entram na base de clientes. Eles vivem numa
  tela própria, **Prospecção**, com a lista dos prospectos e o registro das
  propostas geradas — para guardarmos a informação, que hoje se perderia.

- **R23** — **Proposta também se faz para cliente existente.** Um cliente com
  portaria remota que quer controlar mais uma porta recebe proposta comercial
  normalmente. Se aprovada, vira **aditivo contratual — e isso NÃO entra no
  app**: aprovação e aditivo ficam no ERP. No app, o chamado de proposta é
  apenas **vinculado ao cliente**. Ou seja, a proposta aponta para um cliente
  (ampliação) **ou** para uma prospecção (prédio novo) — nunca para os dois.

- **R24** — **O chamado tem quatro fluxos, e os tipos existentes continuam.**
  Os quatro que estruturam a operação: **proposta comercial** (visita →
  aprovação interna → proposta → envio), **corretiva** (mapear, fotografar,
  registrar peça), **preventiva** (checklist com fotos) e **implantação**
  (upload da proposta aprovada → a IA lê o escopo e gera tasks com
  responsáveis → o gestor confirma ou edita cada uma antes de enviar).
  **Operacional** e **pedido de compra** seguem existindo (R5, R6).

- **R25** — **O chamado entra por três portas.** WhatsApp do SAC, WhatsApp da
  Portaria Remota (6 pessoas dividindo um Business) e o campo **Abrir chamado**,
  que qualquer usuário pode usar quando quiser. Os remetentes de fora são
  moradores, zeladores, síndicos e os próprios funcionários; os motivos vão de
  interfone e portão a PC de guarita, compra de controle/TAG e reclamação.
  Cada item vira um chamado, e alguém competente resolve ou escala.

- **R26** — **O calendário do SAC e dos gestores mostra tudo de todos**, porque
  são eles que administram cronograma e agendamento. O rumo declarado: tempo
  padrão por tipo de problema → carga por pessoa → considerando o deslocamento
  até o cliente.

- **R27** — **"Gerencial" vira três painéis:** Operacional, Comercial e
  Administrativo.

- **R28** — **Cada perfil tem o seu aparelho.** O **técnico de campo usa o app
  no CELULAR**; TI, SAC, Controle Patrimonial e Gestor usam no **DESKTOP**.
  Isso não é preferência, é o desenho: o que o técnico faz é em pé, na rua, com
  luva — e o que os outros fazem é coordenar, olhando muita informação junto.
  Toda decisão de layout deve perguntar antes "quem usa isto, e em quê".
  *(Davi, 2026-08-21. A ser elaborado; gravado agora para não se perder.)*

- **R29** — **A proposta comercial é um TIPO DE CHAMADO.** Ela tem o fluxo
  próprio (visita → aprovação interna → proposta → resposta do cliente), mas é
  um chamado como todos os outros: entra na mesma fila, aparece no Kanban, tem
  número CH- e é contada junto. O fluxo continua em `visitas_tecnicas`, que
  virou **satélite** do chamado — mesmo id, mesma técnica que a U7 usou para
  absorver as demandas e a U9 para o pedido de compra.

- **R30** — **O WhatsApp identifica o remetente pelo NOME DO CONTATO.** Os
  números são salvos como `"Condomínio Apartamento Nome"`, e é daí que sai de
  qual prédio e de qual unidade veio a mensagem. Isso resolve a questão que
  estava em aberto (morador não é usuário do app). **A integração fica para
  depois** — a decisão do Davi é trabalhar primeiro no sistema.

- **R31** — **A lista `/chamados` MORREU.** A Início entrega a mesma fila —
  kanban e lista, pelo mesmo modelo de atividades — e melhor. Duas telas para
  a mesma pergunta é uma tela sempre atrasada. A rota continua como **tronco**
  (as filhas `/chamados/$id`, `novo*`, `painel`, `programacao`, `importar`
  vivem); o endereço exato redireciona para a Início.
  *(Davi, 2026-08-21: "a tela Inicio entrega as mesmas coisas, e bem melhor.
  APAGUE A PAGINA CHAMADOS.")*

- **R32** — **"Visitas e propostas" É o Painel Comercial.** Não existe porta
  (painel-índice) e sala (lista) separadas: `/gerencial` é a página do domínio
  comercial — funil em cima, lista embaixo, botões só do próprio domínio
  (Prospecção, Mapa, Histórico, Clientes). Contratos, Fechamentos, Usuários e
  Permissões pertencem ao Painel Administrativo. `/painel/comercial` só
  redireciona. Os indicadores de campo, pela mesma lógica, moram NA ENTRADA
  do Painel Operacional — não numa página à parte.

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

| Perfil | Itens do rodapé (revisto na R31, 2026-08-21) |
|---|---|
| **Admin** (Davi, Vinicius) | Início · Calendário · **Clientes** · Operacional · Perfil |
| **Comercial** | *idêntica à do Admin* |
| **SAC** | Início · Calendário · **Clientes** · Operacional · Perfil |
| **Técnico** (Gilleno, Nicholas, Erik, Breno, líderes de dupla) | Início · **Agenda** · Perfil |

~~Agora "Chamados" leva todo mundo para o mesmo lugar (`/chamados`)~~ —
**R31**: a aba "Chamados" saiu junto com a lista. A fila mora na **Início**
(kanban e lista); a vaga que sobrou no celular devolveu **Clientes** à barra.
No desktop, o menu lateral soma Prospecção e os painéis (Operacional ·
Comercial · Administrativo — o Comercial aponta direto para `/gerencial`, R32).

### 9.2 Admin e Comercial — 5 abas

| Aba | Rota | O que tem hoje |
|---|---|---|
| **Início** | `/dashboard` | Banner "X visitas hoje", card da próxima visita (contagem regressiva + foto da fachada), card do próximo chamado, 4 métricas de visitas, filtros hoje/semana/mês, filtro por técnico e por status, lista de visitas |
| **Calendário** | `/calendario` | Grade mensal com visitas **+** chamados de todos os técnicos; filtros por técnico e por tipo |
| ~~**Chamados**~~ | ~~`/chamados`~~ | **R31: a lista morreu** — a Início entrega a fila (kanban + lista). A rota é só tronco das filhas; o endereço exato redireciona |
| **Painel Comercial** | `/gerencial` | **R32**: a página do domínio comercial — funil + lista de visitas/propostas. Botões só do domínio: Prospecção, Mapa, Histórico, Clientes |
| **Perfil** | `/perfil` | Dados, tema, sair |

**Telas internas alcançáveis** (sem entrada própria no rodapé):
`/chamados/$id` (a página do chamado — corpo de campo ou interno conforme a
natureza) · `/chamados/novo` (triagem) · `/chamados/novo-campo` ·
`/chamados/novo-interno` · `/chamados/painel` (gerencial dos trilhos) ·
`/chamados/programacao` (agenda das duplas) — os indicadores de campo (SLA,
carga por técnico, reincidência) moram na entrada do **Painel Operacional**
(R32) · `/chamados/importar` (CSV do Notion) ·
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
| ~~**Chamados**~~ | ~~`/chamados`~~ | **R31: morreu** — a fila do SAC também é a Início |
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
| ~~**Lista unificada de chamados**~~ (`/chamados`): construída na U6b, **apagada na R31/U30** — a Início absorveu o papel (kanban + lista, mesmo modelo) | ~~construído~~ → **removido** |
| **Abertura unificada** (`/chamados/novo` — R9), tipo `operacional` na OS (R5) e `pedido_compra` na demanda (R6) | **construído (U6c)** |
| **Painel de chamados** (`/chamados/painel` — aba 1) e **calendário geral com filtros** (aba 2) | **construído (U6d)** — as 3 abas do SAC estão completas |
| **Fusão chamado × demanda** (U7): tabela `chamados` única com `natureza`, endereço único `/chamados/*`, rodapé com uma aba só, quadro por sprint como modo de visualização | **construído (U7)** |
| **Aceite do cliente** (U8 — R4): pós-aprovação na visita, promoção do cliente só no aceite, correção do backfill "aprovada ⇒ ativo", funil comercial | **construído (U8)** |
| **Pedido de compra completo** (U9 — Q6): ficha `chamado_compra`, caminho solicitado→recebido, alçada de aprovação no financeiro, alerta de pedido parado | **construído (U9)** |
| **Permissões por tela** (U11 — R18): matriz tela × papel editável pelo admin em `/gerencial/permissoes`, rodapé e guardas de rota obedecendo | **construído (U11)** |
| **Criação rápida por IA** (U20): campo na Início onde o usuário descreve o chamado em linguagem corrente; a IA interpreta (natureza, tipo, título, prioridade, equipe) e o chamado nasce pelo fluxo normal, com anexos | **construído (U20)** |
| **Home de atividades** (U10 — R17): todas as atividades do usuário numa fila só, seletor lista ↔ quadro, quadro por status, padrões de kanban e filtro por vínculo | **construído (U10)** — só código, sem migration |
| Import QAP (clientes/estoque/equipamentos) | aguardando export (U10) |
| API QAP contínua | aguardando dev do QAP (U11) |
| IA no WhatsApp do SAC | futuro (U12) |

- **R33** — **O chamado abre num PAINEL, não em outra página.** Clicar num
  cartão na Início ou num item do calendário desliza um painel pela direita
  com as propriedades editáveis. O painel ocupa **no máximo 60% da tela** — o
  que está atrás continua vivo, e é esse o ponto: quem varre a fila está
  comparando cartões, e trocar de página perde filtro, rolagem e lugar.
  Salva **campo a campo**, sem botão de salvar. **A data de criação não é
  editável** — é a âncora temporal que a idade do backlog e a reincidência
  usam para contar. A página completa (execução, fotos, assinatura) continua
  a um botão de distância; a **visita** vai direto para o fluxo dela.
  *(Davi, 2026-08-21.)*

- **R34** — **O calendário mostra TODA atividade com data, não só a
  agendada.** Visita e chamado de campo entram pela hora marcada; chamado
  interno entra pelo **prazo** — que é a data que ele realmente tem. Cada dia
  mostra o **título** e o **rosto de quem toca**. A grade ocupa a tela inteira.

- **R35** — **O painel do topo da Início responde aos MESMOS filtros do
  quadro.** Gráfico de demanda, meta do mês e os quatro indicadores contam do
  recorte que está na tela — filtrar por Erik mostra os números do Erik. A
  única exceção é o filtro de **período**: o gráfico já é um eixo de tempo (oito
  semanas), e aplicar "hoje" nele deixaria uma barra em pé respondendo a
  pergunta errada. *(Davi, 2026-08-21.)*

- **R36** — **A visão de lista da Início é uma TABELA**, com as colunas
  Cliente · Título · Responsável · Apoio · Equipe · Tipo · Status · Recebido em
  · Prazo. Cards empilhados serviam para ler um item; comparar vinte pede
  colunas alinhadas. Clicar na linha abre o painel (R33).

- **R37** — **No calendário, a célula do dia mostra só o TÍTULO e o rosto de
  quem toca**, e **cresce com a quantidade de atividades** — sem rolagem por
  dia. Rolagem por célula esconde item dentro de item: 42 áreas de rolagem
  independentes, e o que está no fim de uma delas ninguém vê.

- **R38** — **Prospecção é ABA do Painel Comercial**, não página. Prospecção é
  o começo do funil (prospecto → proposta → cliente); ter porta separada
  obrigava a escolher entre duas telas antes de começar, sendo que o trabalho
  atravessa as duas. A aba mora na URL (`/gerencial?aba=prospeccao`), então
  continua linkável; `/prospeccao` redireciona. Saiu do menu lateral.
  *(Davi, 2026-08-21.)*

- **R39** — **Campo de escolha com BUSCA nas listas longas.** Digitar "Vila"
  mostra "Vila Lagos", "Vila Maria"… Vale para Cliente, Responsável e Apoio —
  as listas onde rolar custa mais que digitar (192 clientes). Listas curtas
  (prioridade, status, tipo, equipe, sprint) continuam seleção direta: para
  escolher entre quatro opções, digitar é trabalho a mais.

- **R40** — **O SPRINT SAI DO PRAZO.** Ao definir a data, o sistema escolhe o
  balde: **Essa semana · Semana que vem · Este mês · Mês que vem · Backlog**
  (mais *Mês passado*, retrospectivo). O balde mais **estreito** ganha — uma
  data desta semana também é deste mês, e a resposta útil é a semana. **Prazo
  vencido cai em "essa semana"**, não no passado: o que venceu e segue aberto
  é trabalho para agora, e mandá-lo ao retrospectivo o esconderia. O sprint
  continua editável à mão, para o que não tem data.

- **R41** — **Cliente tem "Serviço prestado"**: Portaria Remota e Monitoramento
  de Alarmes. É um **conjunto**, não uma escolha — o mesmo condomínio pode ter
  os dois, e guardar um só o esconderia do filtro do outro. A página de
  Clientes filtra por serviço, e esse filtro é um **eixo independente** da
  situação: um cliente é ativo *e* tem portaria. As contagens de cada eixo
  respeitam o filtro do outro. O serviço se liga e desliga na página do
  cliente. *(Davi, 2026-08-22.)*

- **R42** — **Botão "Ordenar" na Início**: Prazo · Cliente · Prioridade. A
  escolha manual **vence** a ordem embutida no padrão selecionado, mas
  **some ao trocar de padrão** — cada padrão já tem a ordem que faz sentido
  para ele ("Sem dono" por prioridade, "Atrasados" por prazo), e deixar a
  escolha manual vazar faria a troca de padrão parecer quebrada.
  *(Davi, 2026-08-22.)*

- **R43** — A tabela da Início **ocupa a tela inteira** (mesma sangria do
  quadro). O **título não mostra mais a sigla** CH- (continua no tooltip, ao
  passar o mouse). **Responsável e Apoio mostram foto ao lado do nome** — a
  cor do avatar é a mesma de sempre (hash pelo ID, não pelo nome), para a
  pessoa continuar reconhecível pela cor em qualquer tela do sistema.

- **R44** — Os filtros do Calendário usam o **mesmo componente** de filtro do
  resto do app (`MenuFiltro`), não `<select>` nativo — um só vocabulário de
  filtro, não dois.

- **R38** (retificação, 2026-08-22) — **O fluxo da proposta ACABA quando ela é
  ENVIADA.** Não existe mais "aguardando a resposta do cliente" como estado do
  app: enviar já fecha a atividade (**status concluído**, automaticamente). O
  que o cliente decide depois é combinado **fora do app** — os dois botões
  "O cliente aceitou/recusou" saíram da tela da visita. O histórico de
  visitas que já tinham aceite/recusa registrado antes desta mudança continua
  legível, só não existe mais o botão que grava um novo. Título do card:
  sempre **"Proposta Comercial"**, nunca o nome do prédio. A etiqueta que
  mostrava o cliente virou **Local** (o nome do condomínio) — o prospecto não
  é nosso cliente, e um card não pode insinuar o contrário. A etiqueta
  "Visita técnica" saiu (redundante com o chip de tipo). **Prioridade não
  aparece no card da proposta** — "por enquanto não aplicamos, vamos discutir
  mais pra frente". *(Davi, 2026-08-22.)*
