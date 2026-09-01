# Unificação Prever — Plano da Temporada 2

De quatro sistemas para um: o app Prever absorve a gestão de demandas do
**Notion**, as ordens de serviço de campo do **Segware SIGMA OS** e o motor de
cobrança do **gestor-os** (sistema do Vinicius), integrando-se ao **QAP ERP**
(controle patrimonial, operado pelo Gilleno). O Notion e o SIGMA morrem; o QAP
permanece como fonte de verdade do patrimônio.

Escrito em 2026-08-18 a partir de: mapeamento do código real do gestor-os
(`~/Documents/gestor-os`), do estado atual do app (etapas 0–6 do
`docs/SISTEMA_OS.md`, já em produção), do manual do QAP v9.0 e da especificação
Gestor OS consolidada em 17/08. Complementa — não substitui — o
`docs/SISTEMA_OS.md`.

---

## 1. Visão

```
   HOJE (5 sistemas)                          DEPOIS (2 sistemas)
┌────────────────────────┐
│ App Prever             │
│  propostas + OS campo  │──┐
├────────────────────────┤  │            ┌───────────────────────────────┐
│ gestor-os (Vinicius)   │  │            │ APP PREVER unificado          │
│  contratos IA +        │──┼──────────► │  propostas · clientes ·       │
│  cobrança + fechamento │  │            │  inventário · contratos ·     │
├────────────────────────┤  │            │  OS de campo · cobrança ·     │
│ Notion (Davi + TI/CP)  │──┤            │  fechamentos · demandas ·     │
│  demandas internas     │  │            │  painéis                      │
├────────────────────────┤  │            └──────────────┬────────────────┘
│ SIGMA OS (técnica)     │──┘                           │ API (fase 2)
│  OS campo + assinatura │                              ▼
├────────────────────────┤              ┌───────────────────────────────┐
│ QAP ERP (Gilleno)      │─────────────►│ QAP ERP — patrimônio, estoque,│
│  patrimônio/compras    │  permanece   │ compras, movimentação         │
└────────────────────────┘              └───────────────────────────────┘
```

O elo que já existe e se completa: **proposta aprovada → OS de implantação →
inventário do cliente** (construído nas etapas 0–6). A temporada 2 acrescenta:
**proposta aprovada → contrato do cliente → decisão de cobrança de cada OS →
fechamento para o financeiro**, e traz para dentro a gestão do dia a dia das
equipes.

## 2. Decisões já tomadas

Definidas com o Davi em 2026-08-18:

| Tema | Decisão |
|---|---|
| Motor de cobrança | **Portar completo** o pipeline do gestor-os: contratos lidos por IA, análise de cobertura item a item, cobranças após conferência humana, fechamentos semanais/mensais com CSV/PDF. |
| Pessoas | **Grupos separados**: os técnicos de orçamento (visitas) e as 3 duplas de campo do Vinicius são grupos distintos. Davi, Vinicius, Gilleno, Nicholas e Erik entram como usuários. ~12 pessoas. |
| Estrutura | **Base única, duas visões**: demandas internas e OS de campo compartilham cadastros (cliente, equipe, responsável, equipamentos) mas têm telas próprias — quadro de demandas com sprint/feed para TI/Patrimônio, fila de campo com agenda/assinatura/cobrança para a Técnica. |
| Histórico | **Migrar o Notion** (export CSV) para começar com o quadro cheio; **SIGMA vira arquivo morto** de consulta. |
| QAP | Integração em **duas fases**: primeiro ponte humana (relatórios de movimentação para o Gilleno lançar), depois API — o pedido ao dev do QAP será feito "no momento certo", com a lista pronta (§8). |
| WhatsApp + IA | Futuro declarado: IA interpretando as mensagens do WhatsApp do SAC e da portaria remota para ajudar na abertura de OS. Fase própria (§9), depois do núcleo estável. |

Herdadas da temporada 1 (continuam valendo): equipe interna só; peças/estoque
no ERP; notificações sempre por trigger `SECURITY DEFINER`; migrations
idempotentes aplicadas no SQL Editor com SELECT de verificação; domínios em
`text + CHECK`.

## 3. O que cada sistema traz (e o que acontece com ele)

### 3.1 App Prever (permanece — é a base)

Já em produção: propostas automatizadas, clientes como registro mestre,
inventário as-built (`cliente_sistemas`/`cliente_equipamentos`), OS
corretiva/preventiva/implantação com numeração atômica (`OS-2026-0001`), SLA
por prioridade, fotos antes/depois, assinatura em canvas, checklist, relatório
PDF, painel, notificações realtime, RLS por papel.

### 3.2 gestor-os (morre após a portabilidade — o código vira fonte)

O que o mapeamento do código confirmou como valioso:

- **Funções puras, portáveis direto** (`src/lib/matching.ts`, `periodos.ts`,
  `normalizarChave`): casamento determinístico de equipamento (série=1,0 →
  TAG=0,95 → modelo único=0,85 → marca+modelo=0,80 → Jaccard≥0,45), valoração
  com precedência estrita (valor informado na OS → preço do contrato → preço
  padrão → `null`, nunca R$ 0), semana ISO `AAAA-Sxx`, competência `AAAA-MM`.
  Têm testes (`scripts/teste-logica.ts`) que vêm junto.
- **Pipeline de IA** (`ia.ts` + `ia-schemas.ts` + 3 prompts): extração de
  contrato, extração de OS e análise de cobertura em UMA chamada por OS, com
  structured outputs (Zod), prompt cache e a economia texto-vs-visual (≥200
  caracteres úteis → só texto; senão PDF base64). Porta como server function
  (precedente: `gerarResumosProposta`), com Edge Function se o modo visual
  estourar timeout.
- **Modelo financeiro**: Contrato (tipo de cobrança MENSAL_FIXO/POR_CHAMADO/
  MISTO, franquia de visitas, flags inclui peças/mão de obra/deslocamento,
  ciclo RASCUNHO→ATIVO→ENCERRADO), cobertura por equipamento com overrides,
  preços por contrato vencendo a tabela padrão, Cobrança com competência,
  Fechamento semanal/mensal idempotente, parcelamento em centavos (60x
  instalação, 12x manutenção, resto na 1ª parcela), CSV `;`+BOM e PDF com
  instalações separadas de manutenções e subtotal por cliente.
- **Tela de conferência** (`ordens/[id]`): o padrão de UX a reproduzir —
  resumo da IA com confiança, item a item com justificativa, ajuste inline que
  trava reanálise, aprovação bloqueada enquanto houver item REVISAR.

O que **não** porta: auth JWT própria (temos Supabase Auth), models
Cliente/Tarefa/Notificacao/PushSubscription (rasos ou conflitantes — a
Notificacao de lá nem tem user_id), ItemCatalogo (funde nos catálogos
`equipamentos`/`servicos`), pdfkit e toda a UI Next.

**As 7 invariantes do gestor-os que a portabilidade não pode perder:**

1. IA nunca cria cobrança — só a aprovação humana.
2. Item sem preço vira REVISAR, nunca cobrança zerada.
3. Ajuste manual trava o item contra reanálise.
4. Id de equipamento devolvido pela IA é validado contra o contrato.
5. Reaprovação apaga só cobranças ABERTAS (substitui, não duplica).
6. Parcelamento em centavos, resto na 1ª parcela.
7. Referência semanal com ano ISO (`RRRR-'S'II`) — sem colisão na virada de ano.

### 3.3 Notion (morre — vira o módulo Demandas)

Campos mapeados: Responsável*, Apoio, Cliente*, Sprint* (Este mês / Mês que vem
/ Mês passado / Backlog, com virada automática no dia 1º), Prazo (definido pelo
próprio responsável), Equipe* (Audiovisual, Business Ops, TI, Controle
Patrimonial, Técnica), Status* (Não iniciada, Em andamento, Stand-by,
Aguardando aprovação, Concluído), Título*, Descrição/feed de comentários.
Classificação (melhoria/implantação/corretiva/preventiva/operacional) passa a
ser **sugerida automaticamente** pelo título. Usuários: Davi, Gilleno,
Nicholas, Erik.

### 3.4 SIGMA OS (morre — a OS de campo nativa assume)

O que ele fazia que o app já cobre: OS para técnico de campo, fotos, assinatura
do responsável da contratante, PDF de recibo. O que falta no app e entra nesta
temporada: **equipamento enviado / retirado na OS** (hoje `pecas_texto` é texto
livre), a **programação de técnicos** do Vinicius (agenda por dupla,
prioridades, pendências) e o **controle do que será cobrado** — que é
exatamente o motor do gestor-os.

### 3.5 QAP ERP (permanece — integração)

Hierarquia Área→Almoxarifado→Categoria→Tipo→Modelo→**Unidade individual**
(série/placa/IMEI/código de barras; itens baratos agrupados por volume).
Compras (pedido/cotação→contrato→fatura→entrada SÓ por Compra>Estoque),
movimentação por Local/Pessoa, manutenção de patrimônio, frota. Regra de ouro
do manual: nada entra ou sai sem registro. **Fontes de verdade** (§8): QAP é
dono do patrimônio e do estoque; o app é dono de clientes, contratos, OS,
cobranças e fechamentos; o catálogo comercial continua vindo do ETL de
planilha (preço/markup), e a identidade de modelo, do QAP quando a API chegar.

## 4. Modelo de dados unificado

O crítico da unificação verificou os dois schemas no código e apontou 4 fatos
decisivos, incorporados abaixo: (i) `clientes` **não tem CNPJ/documento** — e
todo o financeiro do gestor-os concilia por documento e o imprime no
fechamento; (ii) `numero` da OS é UNIQUE **global**, e o número do SIGMA é
único só por cliente — número externo vai para coluna própria; (iii) o técnico
no gestor-os é **texto extraído do PDF**, o nosso é FK com RLS — precisa de
reconciliação; (iv) o estado financeiro **não entra** no status de campo da OS.

### 4.1 Novas tabelas

```
cliente_contratos                       ← porta o Contrato do gestor-os
├─ cliente_id FK, numero (@unique por cliente)
├─ modalidade: locacao | manutencao | comodato | venda   ← alinhada às
│    naturezas do QAP (decisão de cobrança do Vinicius: locação não cobra
│    equipamento; manutenção cobra equipamento; fora de contrato cobra tudo)
├─ tipo_cobranca: mensal_fixo | por_chamado | misto
├─ vigencia_inicio/fim (null = aberta), status: rascunho | ativo | encerrado
├─ valor_mensal, franquia_visitas_mes
├─ inclui_pecas (padrão false), inclui_mao_de_obra (true), inclui_deslocamento (false)
├─ origem_proposta_id FK visitas_tecnicas   ← NOVO ELO: proposta aprovada
│    pode gerar o contrato (nenhum dos dois sistemas fazia isso)
└─ rastro de IA: arquivo_url, texto_extraido, extraido_em, confianca_extracao

contrato_cobertura_itens                ← EquipamentoCoberto, sem duplicar inventário
├─ contrato_id FK, cliente_equipamento_id FK   (referencia o as-built existente)
├─ cobertura: integral | parcial | nao_coberto
├─ inclui_pecas / inclui_mao_de_obra (overrides da regra geral)
└─ chave_busca (normalizada, para o pré-match)

contrato_precos                         ← PrecoServico com contrato; o preço
├─ contrato_id FK, descricao, unidade      PADRÃO global é o catálogo comercial
├─ valor_unitario, chave_busca             (equipamentos/servicos) já existente

os_pecas                                ← substitui pecas_texto (previsto no §7
├─ os_id FK                                do SISTEMA_OS) — UMA tabela para DOIS
├─ direcao: instalado | retirado | substituido    consumidores: decisão de
├─ tipo: peca | mao_de_obra | deslocamento | servico | outro
├─ equipamento_id FK (catálogo) + descricao livre  cobrança E movimentação
├─ numero_serie, tag_patrimonio, quantidade        patrimonial p/ o Gilleno
├─ resultado: coberto | faturavel | nao_identificado | revisar
├─ valor_unitario_informado, valor_calculado, confianca, justificativa
└─ ajustado_manualmente (trava reanálise)

cliente_equipamento_unidades            ← a Unidade do QAP, só p/ serializáveis
├─ cliente_equipamento_id FK
├─ numero_serie, tag_patrimonio, imei, codigo_barras
├─ qap_unidade_id, qap_modelo_codigo (reservados p/ fase 2 da API)
└─ estado: instalado | retirado | em_manutencao

cobrancas                               ← Cobranca do gestor-os
├─ cliente_id FK, os_id FK, os_peca_id FK (SET NULL)
├─ descricao, quantidade, valor_unitario, valor
├─ competencia 'AAAA-MM', data_referencia
├─ status: aberta | fechada | faturada | cancelada
└─ fechamento_id FK (SET NULL)

fechamentos                             ← Fechamento do gestor-os
├─ tipo: semanal | mensal, referencia (@unique por tipo — 'AAAA-Sxx'/'AAAA-MM')
├─ inicio, fim, total, status: aberto | fechado, fechado_em

demandas                                ← o Notion, no molde de ordens_servico
├─ numero (DEM-2026-0001), titulo NOT NULL, descricao
├─ cliente_id FK NULLABLE (demanda pode ser interna pura)
├─ equipe: ti | patrimonio | audiovisual | business_ops | tecnica
├─ responsavel_id FK NOT NULL, prazo (definido pelo responsável)
├─ sprint: este_mes | mes_que_vem | mes_passado | backlog
├─ tipo: melhoria | implantacao | corretiva | preventiva | operacional
│    (sugerido por heurística/IA a partir do título — editável)
├─ status: nao_iniciada | em_andamento | stand_by | aguardando_aprovacao | concluida
├─ concluida_em (preenchida por trigger ao concluir)
└─ created_at (data/hora do registro da demanda)

demanda_apoios (N:N demanda↔profile)    demanda_eventos (feed de comentários +
tecnico_aliases (nome normalizado →       timeline, molde de os_eventos)
  profile_id, p/ reconciliar PDFs)      demanda_equipamentos (equipamentos
                                          envolvidos na demanda — lacuna que o
                                          Davi apontou no Notion)
```

### 4.2 Alterações em tabelas existentes

- `clientes` + **`documento`** (CNPJ/CPF, unique parcial) — pré-requisito do
  financeiro —, `responsavel_financeiro` e **`qap_cliente_id`** (reservada):
  os clientes também estão cadastrados no QAP, então o de-para com o ERP vale
  para clientes tanto quanto para equipamentos.
- `ordens_servico` + `contrato_id` FK, **`numero_externo`** (número
  SIGMA/legado — `numero` continua sempre nativo), `tipo_servico`
  (manutencao|instalacao — dimensão do fechamento), `resumo_ia`,
  `texto_extraido`, `confianca_extracao`, e **`faturamento_status`**
  (a_analisar | em_conferencia | aprovada | faturada | sem_cobranca) — coluna
  própria, **fora** do CHECK de `status`, para não contaminar SLA, painel e
  policy de campo.
- `profiles` + **`equipe`** — atributo de roteamento, **nunca** papel: o
  crítico confirmou que meter equipes no `app_role` quebraria `is_gestor()` e
  toda a RLS das etapas 0–6. Papel continua respondendo "o que pode"; equipe
  responde "de quem é a fila". As duplas de campo entram como cargo `tecnico`
  + equipe `tecnica`; os técnicos de orçamento seguem sem equipe técnica.
- `notificacoes` + `demanda_id`.
- `equipamentos`: remover o UNIQUE de `modelo` quando o de-para com o QAP
  chegar (mesmo modelo pode existir em categorias distintas).

### 4.3 Regras que viram RPC (transação)

`aprovar_os_financeiro` (apaga cobranças ABERTAS da OS e recria — invariante
5), `fechar_periodo`, `reabrir_periodo`, `excluir_fechamento` (devolve
FECHADA→ABERTA sem apagar). No gestor-os são `$transaction` do Prisma; no
Supabase client-side não há transação — sem RPC, reaprovação concorrente
duplica cobrança.

### 4.4 RLS

- Financeiro (`cliente_contratos`, `cobrancas`, `fechamentos`, valores em
  `os_pecas`): **só gestor** — técnico que acessa a OS não vê faturamento.
- Demandas: equipe interna toda lê; responsável + gestor editam; qualquer um
  comenta no feed.
- Restante herda os helpers existentes (`is_gestor`, `pode_acessar_os`).

## 5. Fluxos por persona

### 5.1 Davi — demandas internas (mata o Notion)

Quadro de demandas com filtros por equipe/sprint/responsável/status; contadores
por cliente (pendências e volume por período, como no Notion); detalhe com feed
de comentários (posts com autor e hora — molde `os_eventos`); criação rápida
com classificação sugerida. **Virada de sprint automática**: job pg_cron no dia
1º às 00:01 America/Sao_Paulo (`1 3 1 * *` UTC — pg_cron roda em UTC), Este
mês→Mês passado e Mês que vem→Este mês, **versionado em migration** (hoje
nenhum cron do projeto está versionado — corrigimos isso de vez).

### 5.2 Vinicius — programação e cobrança (mata o SIGMA + gestor-os)

Tela de **programação**: agenda por dupla/dia, arrastar prioridades, pendências
por cliente, disponibilidade de estoque (fase 2 da API do QAP). A execução de
campo já existe (iniciar → fotos → assinatura → recibo PDF); ganha o registro
estruturado de `os_pecas` (o que foi instalado/retirado, com série). Depois da
execução, a **análise de cobrança**: pré-match determinístico + IA classifica
cada item contra o contrato vigente do cliente (locação → coberto; manutenção →
equipamento faturável; fora de contrato → tudo faturável; franquia de visitas
considerada), Vinicius confere item a item na tela de conferência, aprova → nascem
as cobranças. No fim da semana/mês: fechamento, CSV + PDF para o financeiro.

### 5.3 Gilleno — patrimônio (ponte com o QAP)

Fase 1: o app gera o **relatório de movimentações** (CSV: data, cliente, OS,
direção, modelo, série/TAG) a partir de `os_pecas`, e o Gilleno lança no QAP
(Patrimônio > Local/Uso) como já faz hoje — sem redigitação a partir de papel.
Fase 2: o app envia a movimentação via API com referência à OS, e o Gilleno
audita em vez de digitar.

### 5.4 Técnicos de campo (duplas)

Veem a fila da dupla, o dia agendado no calendário, executam a OS no celular
(fotos, checklist, assinatura), registram peças com número de série (busca por
código de barras na fase 2 da API). Não veem valores.

### 5.5 SAC / gestores

Abertura de chamado continua como está; ganham visibilidade do estado
financeiro da OS (`faturamento_status`) e dos fechamentos.

## 6. Automações

Do Notion (mantidas): data/hora de criação; data/hora de conclusão ao marcar
Concluído; virada de sprint no dia 1º.

**Sugeridas (novas)** — todas no padrão pg_cron + trigger já usado no app:

1. **Classificação sugerida** do tipo da demanda pelo título/descrição
   (heurística por palavras-chave + IA quando ambíguo), editável.
2. **Demanda parada**: em Stand-by ou Em andamento sem atualização há N dias →
   notificação ao responsável (e ao Davi no resumo).
3. **Prazo vencendo**: véspera do prazo → notifica o responsável; estourado →
   notifica também o gestor da equipe.
4. **Resumo de segunda-feira** por equipe: o que venceu, o que vence na
   semana, o que está sem responsável (equivalente ao cron de alertas do
   gestor-os, que hoje faz isso para tarefas e cobranças).
5. **OS executada sem análise de cobrança** há 2+ dias → alerta ao Vinicius
   (espelho do "OS parada em EM_REVISAO" do gestor-os).
6. **Contrato vencendo** em 30/60 dias → alerta ao gestor.
7. **Cobrança órfã** (aberta sem fechamento na virada do período) → aviso na
   tela de fechamentos (regra que o gestor-os já tinha).
8. **Sprint lotado**: no dia da virada, se "Este mês" herdou mais de N
   demandas não concluídas → resumo para a reunião mensal.
9. **Aniversário de preventiva**: cliente com contrato ativo sem OS preventiva
   há N meses → sugestão de agendamento (usa o inventário + contrato).

## 7. Migração de dados

| Origem | Como | Quando |
|---|---|---|
| Notion | Export CSV → tela de importação com mapeamento de colunas (Responsável→profile por nome, Cliente→consolidação assistida, Sprint/Status→domínios novos). Demandas concluídas entram como histórico. | Etapa U1 |
| gestor-os | Script de migração: clientes (dedupe **assistido** contra os nossos — sem CNPJ dos dois lados, nada de fusão automática), contratos + cobertura + preços, cobranças e fechamentos históricos preservando referência e status. Ids cuid → uuid novos com `legacy_id` guardado. **Importação em lote desliga os triggers de notificação** — senão inunda o sino de todo mundo. | Etapa U4 |
| SIGMA | Arquivo morto (decisão). Se um dia mudar: o pipeline de importação de OS por PDF portado do gestor-os é a própria ferramenta. | — |

## 8. Integração com o QAP ERP

**Fontes de verdade:** QAP = patrimônio, unidades, estoque, compras (o app
NUNCA cria unidade nem dá entrada de estoque — regra do manual: entrada só por
Compra > Estoque). App = clientes, contratos, OS, cobranças, fechamentos.
Catálogo comercial: planilha (ETL) manda em preço/markup; QAP manda na
identidade do modelo quando a API chegar — dono por campo definido **antes** de
ligar a API, para não haver duas fontes de escrita.

**Fase 1 — sem API (ponte humana):** relatório de movimentações de `os_pecas`
para o Gilleno; **export da lista de clientes do QAP** (com CNPJ) para
preencher `clientes.documento` e casar `qap_cliente_id` — resolve a lacuna de
documento sem digitação; import do relatório de unidades por local do QAP (se
exportável) para conciliar `cliente_equipamento_unidades`; chaves naturais
(série, TAG, IMEI, código de barras) gravadas desde já + colunas
`qap_unidade_id`/`qap_modelo_codigo`/`qap_cliente_id` reservadas — a fase 2
vira um de-para, não uma migração.

> **Atualização 2026-08-18:** o Davi consegue **puxar pela API do QAP** os
> clientes, o estoque e os equipamentos por cliente. A fase 1 deixa de ser
> "ponte humana às cegas" e vira **importação de dados reais** (etapa U7). O
> pedido formal ao dev (fase 2) segue valendo para a parte contínua:
> movimentação via POST, delta e lookup em campo.

**Fase 2 — o pedido ao dev do QAP** (a lista pronta para "o momento certo"):

1. `GET` **clientes** (id estável, nome, CNPJ/CPF, endereço, responsável) —
   preenche `clientes.documento`, alimenta o de-para `qap_cliente_id` e é a
   chave que amarra todo o resto da integração por cliente;
2. `GET` catálogo de modelos com a hierarquia Categoria→Tipo→Modelo e código
   estável (para o de-para com `equipamentos.code`);
3. `GET` **equipamentos/unidades por cliente** (série, placa, IMEI, modelo,
   local/pessoa atual, data de envio) — conciliação do as-built
   (`cliente_sistemas`/`cliente_equipamentos`/unidades) contra o patrimônio;
4. `GET` unidade por número de série ou código de barras (lookup do técnico em
   campo);
5. `POST` movimentação Local/Uso (unidade → cliente/colaborador e retorno ao
   estoque), aceitando data e **referência externa = número da OS**;
6. `GET` saldo de estoque por modelo/almoxarifado (disponibilidade antes de
   agendar implantação);
7. Endpoint **delta** (`updated_since`) ou webhook de movimentação/cadastro —
   nada de full sync;
8. `GET` contratos de compra por natureza (Comodato/Locação/Consignação/
   Venda) por cliente — cruza com `cliente_contratos.modalidade` na decisão de
   cobrança;
9. Transversais: **id imutável de unidade** (série repete entre fabricantes),
   token de serviço, ambiente de homologação, e a regra de conflito escrita
   (QAP vence em patrimônio e na identidade do cliente para conciliação; app
   vence no vínculo comercial cliente↔contrato↔proposta).

## 9. IA no WhatsApp (futuro declarado)

Quando o núcleo estiver estável: IA lê as mensagens do WhatsApp do SAC e da
portaria remota, identifica cliente (pelo telefone → cadastro) e problema,
e **sugere** a abertura da OS com tudo preenchido — um gestor confirma (mesmo
princípio do gestor-os: a IA classifica e para; humano decide). Pré-requisitos
que já ficam prontos no caminho: cadastro de clientes com telefones,
`tecnico_aliases` (reconciliação de nomes), abertura de OS por server function.
Pendências para quando chegar lá: provedor da API do WhatsApp (Cloud API ou
similar), número dedicado, e a decisão da Etapa 7 do SISTEMA_OS (alcançar
técnico com app fechado) — que fica mais urgente com 12 usuários dentro.

## 10. Etapas de execução

Cada etapa é entregável e utilizável sozinha, no mesmo protocolo das etapas
0–6: migration idempotente → revisão adversarial → você roda no SQL Editor →
código → tsc → commit.

| # | Etapa | Entrega | Depende de |
|---|---|---|---|
| **U0** | **Fundações da temporada 2** | `profiles.equipe`; `clientes.documento`; `numero_externo`, `tipo_servico` e `faturamento_status` na OS; `tecnico_aliases`; RLS financeira base; cron versionado em migration; regenerar `types.ts` (dívida das etapas 0–6) | — |
| **U1** | **Demandas internas** (mata o Notion) | `demandas` + apoios + feed + equipamentos envolvidos; quadro com sprint e virada automática; classificação sugerida; automações 1–4 e 8; importação do CSV do Notion | U0 |
| **U2** | **Contratos do cliente** | `cliente_contratos` + cobertura + preços; importação de contrato por PDF (IA portada); criação a partir de proposta aprovada; telas na ficha do cliente | U0 |
| **U3** | **OS de campo completa** (mata o SIGMA) | `os_pecas` com direção + `cliente_equipamento_unidades`; tela de programação do Vinicius (agenda por dupla, prioridades); recibo PDF ajustado; automação 5 | U0 (U2 recomendada) |
| **U4** | **Motor de cobrança** | matching/valoração/períodos portados com testes; análise de cobertura (pré-match + IA em server function); tela de conferência; `cobrancas` + RPC de aprovação; migração dos dados do gestor-os | U2, U3 |
| **U5** | **Fechamentos** | `fechamentos` + RPCs; CSV `;`+BOM; PDF (instalações × manutenções, subtotal por cliente com CNPJ); automações 6–7; lançamento manual com parcelamento | U4 |
| **U6** | **Perfis e o chamado unificado (SAC)** | papel `sac` (+ decisão sobre o papel do Vinicius); painel, calendário geral e lista de chamados do SAC; trilhos do chamado (campo/TI/patrimônio/proposta); tipo `operacional` na OS e `pedido_compra` nas demandas; técnico com 3 abas; ciclo da proposta com aceite do cliente (R4) | U0–U5 + respostas do PRODUTO.md §8 |
| **U7** | **Integração QAP — import** | import de clientes (CNPJ, `qap_cliente_id`, correção de `situacao`), estoque e equipamentos por cliente; conciliação com o as-built; relatório de movimentações p/ Gilleno; automação 9 | U3 + export do QAP (Davi puxa pela API) |
| **U8** | **API QAP contínua** | de-para de modelos; consulta de unidades/estoque; POST de movimentação com referência à OS; delta | U7 + pedido ao dev (§8) |
| **U9** | **IA no WhatsApp** | leitura das mensagens SAC/portaria → sugestão de chamado | núcleo estável + conversas do SAC + decisões §9 |

Paralelismo: U1 e U2 podem andar juntas (não se tocam); U3 depois de U2 para a
OS já nascer vinculada ao contrato. O desligamento do Notion acontece ao fim de
U1; o do SIGMA e do gestor-os, ao fim de U5 — quando o Vinicius fizer um ciclo
completo (programar → executar → conferir → fechar → enviar ao financeiro) só
no app.

## 11. Questões em aberto

> **A lista viva e consolidada mudou de casa: PRODUTO.md §8.** Os itens abaixo
> ficam como registro histórico; o que segue em aberto foi reescrito lá.

1. **CNPJ dos clientes** (U0): a fonte é o QAP (todos os clientes estão lá).
   Resta saber se o QAP **exporta** a lista de clientes hoje (relatório/CSV) —
   se sim, preenchemos `documento` já na U0, sem esperar a API da fase 2.
2. **Dono do preço** (U2): confirmar a recomendação — catálogo comercial
   (`equipamentos`/`servicos`) é a tabela padrão global; `contrato_precos`
   vence o padrão. Isso substitui a "tabela de preços padrão" do gestor-os
   (hora técnica R$150, visita R$220, deslocamento R$3,50/km, hora fora do
   horário R$225 — esses valores entram no catálogo?).
3. **Franquia de visitas** (U4): a regra exata — o que conta como "visita
   consumida" no mês (OS fechada? por tipo?), e a visita N+1 fatura o quê?
4. **Dados do gestor-os** (U4): quantos contratos/cobranças já existem em
   produção lá? (Os scripts de importação em lote sugerem uma base já
   populada.) Define o tamanho da migração.
5. **Export do Notion** (U1): me mande um export CSV de exemplo para eu
   desenhar o mapeamento exato das colunas.
6. **As duplas de campo** (U3): nomes dos 6 técnicos para os convites, e se
   a dupla é fixa (a agenda é por dupla ou por técnico?).
7. **Recibo de campo** (U3): o PDF de recibo atual (relatório de atendimento)
   atende o que o SIGMA emitia, ou o Vinicius quer mudanças no layout/conteúdo?
8. **Alcance de notificação** (herdada da Etapa 7): com 12 usuários e alertas
   de madrugada (virada de sprint, fechamentos), o WebView sem push fica mais
   limitado — FCM ou WhatsApp/e-mail? (§10.6 do SISTEMA_OS.)

---

## 12. Registro de execução

Uma seção por etapa concluída, com o que foi entregue e o que a execução
mudou em relação ao planejado acima. Quem retomar o projeto lê daqui.

### U0 — Fundações (2026-08-18)

**Migration:** `supabase/migrations/20260818120000_u0_fundacoes_unificacao.sql`
— rodar no SQL Editor da Lovable. Idempotente, termina com SELECT de
verificação (18 linhas, cada uma com o valor esperado ao lado).

**Entregue no banco**

| O quê | Detalhe |
|---|---|
| `profiles.equipe` | text + CHECK, indexado. Entrou também no `guard_profiles_privilegios`: trocar a própria equipe seria desviar fila de trabalho, então é ato de admin, como cargo/status/ativo. |
| `clientes.documento` | + `responsavel_financeiro`, `email_financeiro`, `qap_cliente_id`. Índice único **parcial** sobre `somente_digitos(documento)` — cliente sem CNPJ continua válido, documento repetido não. |
| `ordens_servico` | `numero_externo` (único por cliente, nunca global), `tipo_servico` (instalação × manutenção) e `faturamento_status` com CHECK próprio, **fora** do CHECK de `status`. |
| `tecnico_aliases` | nome em texto → profile, com `nome_normalizado` como coluna gerada e `resolver_tecnico(text)` para consultar (alias primeiro, nome do perfil como fallback). |
| `normalizar_texto()` / `somente_digitos()` | funções IMMUTABLE — usadas em índice e em coluna gerada. Gêmeas TS em `src/lib/normalizar.ts`. |
| `pode_ver_financeiro(uuid)` | a costura da RLS financeira. Hoje devolve `is_gestor()`; quando existir papel financeiro, muda só aqui. |
| `agendar_job()` / `jobs_agendados()` | cron versionado em migration. Ambas resistem a pg_cron ausente (retornam texto em vez de abortar). |

**Entregue no app**

- `src/lib/normalizar.ts` — gêmeo TS das funções SQL + máscara e validação de
  CNPJ/CPF (dígito verificador). A base do `normalizarChave` do matching da U4.
- `src/lib/equipes.ts` — domínio de equipe (labels + cores claro/escuro).
- Cadastro de cliente: campo **CNPJ/CPF** com máscara e validação, e o par
  contato/e-mail do financeiro.
- `/gerencial/usuarios`: o modal virou **"Permissão e equipe"** — seletor de
  equipe com aviso explícito de que equipe não é permissão; selo da equipe na
  lista de usuários.

**Decisões tomadas durante a execução** (ajustes ao §4.2)

1. **`email_financeiro`** entrou junto de `responsavel_financeiro` — o
   fechamento vai precisar de destinatário, não só de nome.
2. **Equipe ganhou um 6º valor, `comercial`**: as 5 do Notion não cobrem o time
   de orçamento, que existe no app desde sempre e também recebe demanda.
3. **`normalizar_texto` não usa `unaccent`** — a extensão é só STABLE (depende
   de dicionário) e não pode entrar em índice nem em coluna gerada. Trocado por
   `translate` sobre o conjunto de acentos do português.
4. **Backfill de `faturamento_status`**: OS já `fechada`/`cancelada` nasce como
   `sem_cobranca`. Marcar tudo como `a_analisar` encheria a fila da U4 de
   histórico que nunca passou pelo motor.
5. **`tipo_servico` é derivado pelo banco** (implantação → instalação; resto →
   manutenção), estendendo o trigger `os_preencher_numero_e_prazo` que já
   existia. O app não precisa saber a regra.
6. **`tecnico_aliases.profile_id` é `ON DELETE SET NULL`**, não CASCADE: o
   alias sobrevive à saída da pessoa e pode ser reapontado.
7. O guard de perfis passou a ser recriado por `CREATE OR REPLACE` **sem**
   dropar o trigger — DROP+CREATE abriria uma janela sem trava justamente na
   proteção contra auto-promoção.

**Dívida encontrada (maior do que o previsto)**

`src/integrations/supabase/types.ts` não está apenas desatualizado desde as
etapas 2–6: está desatualizado desde a **Etapa 1** — não tem `endereco`,
`situacao` nem qualquer coluna nova de `clientes`, e não tem nenhuma tabela de
OS. O app funciona porque as consultas dessas tabelas usam `as any`. Regenerar
exige rede e credenciais do Supabase (é tarefa da Lovable, não deste repo).
**Enquanto não for regenerado, todo acesso a tabela nova continua com `as any`**
— foi assim que a U0 escreveu as consultas de `equipe`.

### U1 — Demandas internas (2026-08-18)

**Migration:** `supabase/migrations/20260818140000_u1_demandas.sql` — roda
**depois** da U0 (usa `normalizar_texto`, `profiles.equipe` e `agendar_job`).

**Entregue no banco**

| O quê | Detalhe |
|---|---|
| `demandas` | numeração `DEM-2026-0001` por contador próprio; equipe, responsável (nulo = triagem), prazo `date`, sprint, tipo, status com **stand_by**, carimbos de início/conclusão por trigger, `origem`/`origem_id` para a importação. |
| `demanda_apoios` | N:N com `profiles` (campo "Apoio" do Notion). |
| `demanda_eventos` | feed de comentários **e** linha do tempo na mesma tabela, como `os_eventos`: `tipo='comentario'` é o post da pessoa; o resto nasce de trigger. |
| `demanda_equipamentos` | a lacuna apontada do Notion — aponta para o inventário do cliente ou fica em texto livre com nº de série. |
| `sugerir_tipo_demanda()` | classificação por palavra-chave sobre o título (automação 1), com gêmeo TS para pré-visualizar enquanto se digita. |
| 5 notificações | atribuição, conclusão, aguardando aprovação, comentário no feed e entrada como apoio — todas por trigger `SECURITY DEFINER`. |
| `virada_sprint()` | Este mês→Mês passado, Mês que vem→Este mês, + aviso de sprint lotado (automação 8). |
| `alertas_demandas()` | vence amanhã, atrasada (avisa gestor junto) e parada há N dias (automações 2 e 3), com dedupe por janela. |
| `resumo_semanal_demandas()` | panorama por pessoa + cobrança das demandas sem dono (automação 4). |
| 3 jobs pg_cron | `virada-sprint` (`1 3 1 * *`), `alertas-demandas` (`0 10 * * *`), `resumo-semana` (`0 11 * * 1`) — **versionados em migration**, em UTC. |

**Entregue no app**

- `src/lib/demanda-status.ts` — domínio completo (status, sprint, tipo, prazo),
  no molde de `os-status.ts`.
- `src/features/demandas/data.ts` — consultas, mutações, feed, apoio,
  equipamentos, realtime.
- Rotas `/demandas` (quadro com sprint, equipe, "minhas" e busca),
  `/demandas/nova`, `/demandas/$id` (edição inline, feed, apoio, equipamentos,
  linha do tempo) e `/demandas/importar` (CSV do Notion).
- `BottomNav` ganhou **Demandas**; `NotificationPanel` navega por `demanda_id`
  e tem ícone para cada um dos 9 tipos novos.
- `routeTree.gen.ts` editado à mão (o `vite build` não roda aqui) — censo
  conferido contra `/os`: 8/5/5/5 ocorrências.

**Decisões tomadas durante a execução**

1. **`cancelada` entrou no ciclo** (o Notion não tinha): sem ela, demanda
   descartada só poderia ser excluída, perdendo o histórico.
2. **Demanda sem responsável pode ser assumida por qualquer um**
   (`pode_editar_demanda`): travar isso no gestor deixaria a triagem parada.
3. **Comentário é imutável** — a tabela do feed não recebe UPDATE/DELETE de
   usuário, porque ela também é a linha do tempo/auditoria.
4. **`origem_id` = título normalizado + prazo**: o CSV do Notion não traz id
   estável, e essa chave torna a reimportação idempotente (índice único
   `(origem, origem_id)`).
5. **Importação tolerante**: pessoa ou cliente que não casa não bloqueia a
   linha — entra sem responsável / como demanda interna, com aviso na
   pré-visualização. Travar tudo por um nome escrito diferente seria pior.
6. **Barra de navegação com 6 itens** para admin: espaçamento aperta
   automaticamente (`apertado`) em vez de esconder item existente.
7. **Quem vê Demandas**: admin ou quem tem equipe diferente de `tecnica` — o
   técnico de campo continua com a barra enxuta.
8. **`demandas_origem_unico` é índice cheio, não parcial**: o `ON CONFLICT` da
   importação não consegue inferir índice parcial (o PostgREST não envia o
   `WHERE`), e falharia. Sem o predicado funciona igual — NULLs são distintos
   entre si, então demanda criada no app segue sem restrição.
9. **A virada de sprint não mexe em quem já está em "Mês passado"** — é o
   comportamento do Notion hoje. Se esse balde crescer demais, a regra
   candidata é empurrar o que passou de 2 meses para o Backlog.

**Atenção na hora de subir:** o código novo lê colunas que só existem depois
das migrations. Rode **U0 e depois U1** no SQL Editor junto com o deploy — se o
app subir antes, a tela de clientes quebra até a U0 rodar.

### U2 — Contratos do cliente (2026-08-18)

**Migration:** `supabase/migrations/20260818160000_u2_contratos.sql` — depende
da U0 (`normalizar_texto`, `pode_ver_financeiro`).

Preenche a lacuna declarada na Etapa 2 do `SISTEMA_OS.md` e traz o model
Contrato do gestor-os para o padrão banco-primeiro daqui. É a peça que faltava
para a regra de cobrança do Vinicius ficar escrita em algum lugar em vez de
morar só na cabeça dele.

**Entregue no banco**

| O quê | Detalhe |
|---|---|
| `cliente_contratos` | modalidade (locação/manutenção/comodato/venda, alinhada às naturezas do QAP), tipo de cobrança, vigência com fim opcional, valor, dia de vencimento, franquia de visitas, flags peças/MO/deslocamento, `origem_proposta_id` (proposta aprovada → contrato) e o rastro da leitura por I.A. |
| `contrato_cobertura_itens` | exceções por equipamento, apontando para `cliente_equipamentos` — **não** é inventário paralelo. `chave_busca` é coluna gerada, pronta para o pré-match da U4. |
| `contrato_precos` | preço combinado naquele contrato; vence o catálogo comercial na cascata de valoração. |
| `contrato_vigente()` | a regra do `contratoVigente` do gestor-os em SQL; havendo dois, vence o de início mais recente. |
| `ordens_servico.contrato_id` | preenchido na abertura pelo trigger e **congelado**: renovar o contrato não reescreve OS antiga. |
| `alertas_contratos()` | automação 6 do §6, agendada às segundas (`0 11 * * 1`). |
| bucket `contratos` | privado, com policies pela mesma régua financeira. |

**Entregue no app**

- `src/lib/contrato.functions.ts` — leitura do PDF por I.A (porta o
  `PROMPT_CONTRATO` do gestor-os), com as regras inegociáveis preservadas:
  nunca inventar, datas ISO, confiança honesta, alertas para o humano.
- `src/features/contratos/data.ts` — consultas, cobertura, preços, upload e URL
  assinada, `contratoVigente` e `diasParaVencer`.
- Rotas `/contratos` (lista com filtro por situação e aviso de vencimento),
  `/contratos/novo` (PDF por I.A **ou** manual) e `/contratos/$id` (condições,
  cobertura item a item, tabela de preços).
- Ficha do cliente ganhou o card de contratos, com selo de "vigente".

**Decisões tomadas durante a execução**

1. **O PDF vai inteiro para o modelo, sempre.** O gestor-os usava `unpdf` para
   mandar só texto quando havia camada textual; o app não tem essa dependência
   e adicioná-la é tarefa da Lovable. Custa mais tokens e funciona igual para
   contrato escaneado — que é a maioria. Se `unpdf` entrar depois, a economia
   volta com o corte de 200 caracteres úteis.
2. **O arquivo sobe primeiro, a I.A lê depois.** O navegador manda o PDF para o
   bucket e a server function baixa com o service role — evita megabytes de
   base64 no corpo da requisição e o arquivo já fica guardado no contrato.
3. **Contrato nasce sempre como rascunho**, mesmo lido por I.A: só o ativo
   entra na decisão de cobrar. Ativar exige início de vigência preenchido.
4. **`dia_vencimento` entrou** (não estava no §4.1): o fechamento da U5 vai
   precisar dele e a coluna é barata agora.
5. **CNPJ divergente vira aviso, não bloqueio**: se o documento lido no PDF
   pertence a outro cliente do cadastro, a tela avisa e deixa a pessoa decidir.
6. **Backfill de `contrato_id` só em OS aberta** — para OS já encerrada não dá
   para afirmar qual contrato valia no dia do atendimento.

### U3 — OS de campo completa (2026-08-18)

**Migration:** `supabase/migrations/20260818180000_u3_os_pecas_unidades.sql` —
depende da U0 e da U2.

Fecha as três lacunas que faziam o SIGMA continuar existindo: o que foi
instalado e retirado, o número de série de cada item no cliente, e a
programação da equipe.

**Entregue no banco**

| O quê | Detalhe |
|---|---|
| `cliente_equipamento_unidades` | a Unidade do QAP: série, TAG, IMEI, código de barras + `qap_unidade_id`/`qap_modelo_codigo` reservados. Só para serializáveis — consumível segue por quantidade, como no QAP. |
| `os_pecas` | movimentação do atendimento (instalado/retirado/substituído), com `chave_busca` gerada para o matching da U4. Sucede `pecas_texto`, que virou legado somente-leitura. |
| `os_pecas_analise` | o veredito financeiro, 1:1 com a peça, com RLS própria. |
| `os_sincronizar_unidades()` | ao fechar a OS, o que o técnico registrou vira unidade no as-built — sem isso o inventário envelhece e a conciliação com o QAP nasce errada. |
| `alertas_os_faturamento()` | automação 5 do §6: OS executada há 2+ dias sem análise avisa o gestor (`0 12 * * 1-5`). |

**Entregue no app**

- `src/features/os/pecas.ts` — movimentação, unidades, busca por série/código de
  barras e o **CSV de movimentação** (`;` + BOM) que o Gilleno vai usar na U6.
- Tela do chamado: o campo de texto de peças deu lugar ao registro estruturado
  com direção e número de série; a anotação antiga aparece como histórico.
- Recibo PDF passa a listar o que foi instalado e retirado — é justamente o que
  o responsável precisa conferir antes de assinar.
- **`/os/programacao`** — a tela do Vinicius: semana com carga por dia, agenda
  do dia por técnico, e a fila "aguardando programação" ordenada por prazo
  estourado. Botão na lista de chamados.

**Decisões tomadas durante a execução**

1. **O veredito financeiro saiu de `os_pecas` para `os_pecas_analise`** —
   desvio consciente do §4.1. A RLS do Postgres é por linha, não por coluna, e
   o §4.4 exige que o técnico não veja valor. Manter tudo numa tabela pediria
   column-level GRANT + view: mais máquina do que benefício. O movimento
   físico continua tendo uma única fonte de verdade.
2. **Peça não é editável depois de fechada a OS** (policy): o registro vira
   base de cobrança, e gestor ainda pode corrigir.
3. **Constraint `resultado <> 'faturavel' OR valor_calculado IS NOT NULL`** —
   a invariante 2 do gestor-os ("sem preço vira REVISAR, nunca R$ 0") passa a
   ser garantida pelo banco, não só pelo código.
4. **Programação é por dia, não grade semana × técnico**: a grade não cabe na
   tela do celular, que é onde o Vinicius trabalha. A semana vira uma régua
   com a carga de cada dia.
5. **Agendar move `aberta` → `agendada`** automaticamente — era o passo que
   todo mundo esquecia de fazer à mão.
6. **Unicidade de série é por linha de equipamento do cliente**, não global:
   número de série se repete entre fabricantes (é por isso que o §8 pede um id
   imutável de unidade ao QAP).

### U4 — Motor de cobrança (2026-08-18)

**Migration:** `supabase/migrations/20260818200000_u4_cobrancas.sql` — depende
da U0, U2 e U3.

O coração do gestor-os, agora aqui. As 7 invariantes do §3.2 estão preservadas,
e as que o banco consegue garantir, o banco garante — não são mais convenção
de código.

**Entregue no banco**

| O quê | Detalhe |
|---|---|
| `cobrancas` | item a item, com competência `AAAA-MM`, `tipo_servico` (as duas seções do PDF de fechamento) e ciclo aberta→fechada→faturada. Constraint impede cobrança de valor zero. |
| `aprovar_os_financeiro()` | **o único caminho que cria cobrança.** Verifica papel financeiro, exige OS executada, **bloqueia se houver item em revisão**, apaga só as cobranças ABERTAS e recria — reaprovar substitui, nunca duplica. Tudo em uma transação. |
| `marcar_os_faturada()` | aberta/fechada → faturada, com evento na linha do tempo. |
| `ajustar_item_cobranca()` | o ajuste humano da conferência; trava o item contra reanálise e recusa "faturável sem valor". |
| `visitas_na_competencia()` | conta OS **fechada** (conferida) no mês — base da regra de franquia. |

**Entregue no app**

- `src/lib/matching.ts` — a cascata de casamento (série 1,0 → TAG 0,95 →
  modelo único 0,85 → marca+modelo 0,80 → descrição × 0,75 com piso 0,45), a
  valoração com precedência estrita e a **cobertura determinística**: a regra
  do Vinicius finalmente escrita em código.
- `src/lib/periodos.ts` — semana ISO (`AAAA-Sxx`), competência, janelas e o
  parcelamento em centavos com resto na primeira.
- `src/lib/cobranca.functions.ts` — a análise: determinística primeiro, I.A só
  no que sobrou em dúvida, e **fallback seguro** (sem chave ou com falha, o
  item vai para revisão em vez de travar a operação).
- `src/features/os/cobranca.ts` + a **tela de conferência** dentro do chamado:
  item a item com justificativa e confiança, ajuste inline, total faturável e
  aprovação bloqueada enquanto houver item em revisão.
- `scripts/verificar-logica.cjs` — **34 verificações, todas passando**.

**Decisões tomadas durante a execução**

1. **Determinístico primeiro, I.A depois.** O gestor-os mandava todos os itens
   para a I.A numa chamada. Aqui a regra que dá para decidir sem interpretar
   texto (locação/manutenção, peça/MO/deslocamento, item marcado como não
   coberto) é resolvida em código; a I.A vê só o que sobrou. Mais barato, mais
   auditável e funciona sem chave de API.
2. **Franquia consumida conta OS `fechada`, não `executada`** — enquanto a
   conferência não aconteceu, o atendimento ainda pode ser cancelado.
3. **Preço padrão do catálogo é `custo × markup`** — a mesma conta que o
   orçamento já usa, para não existirem dois preços de venda no sistema.
4. **A análise usa o cliente do próprio usuário** (não o service role): quem
   não tem papel financeiro esbarra na RLS, sem precisar de checagem própria.
5. **Verificação em script, não em framework de teste**: o projeto não tem um,
   e trazer vitest só para isto seria custo sem retorno. O script transpila os
   módulos na hora e roda as asserções.

**Pendente da U4:** a **migração dos dados do gestor-os** (clientes, contratos,
cobranças e fechamentos históricos). Depende de um export da base dele — está
na lista de perguntas (§11.4).

### U5 — Fechamentos (2026-08-18)

**Migration:** `supabase/migrations/20260818220000_u5_fechamentos.sql` —
depende da U4.

Fecha o ciclo do Vinicius: **programar → executar → conferir → fechar → mandar
para o financeiro**. Com isto o gestor-os pode ser desligado.

**Entregue no banco**

| O quê | Detalhe |
|---|---|
| `fechamentos` | tipo + referência únicos; semanal usa **ano ISO** (`IYYY-"S"IW`), o mesmo critério do `src/lib/periodos.ts`. |
| `montar_fechamento()` | recolhe as cobranças abertas da janela. **Idempotente**: rodar de novo só pega o que entrou depois. Recusa período já fechado. |
| `fechar_periodo()` / `reabrir_periodo()` | aberta↔fechada em lote. Reabrir **não** traz de volta o que já foi faturado — a nota saiu. |
| `excluir_fechamento()` | descarta o período **sem apagar cobrança**: elas voltam para a fila. Bloqueado se houver item faturado. |
| `alertas_cobrancas_orfas()` | automação 7 do §6: cobrança aprovada há 10+ dias fora de qualquer fechamento é dinheiro parado que ninguém vê. |
| FK `cobrancas.fechamento_id` | criada aqui, já que a coluna nasceu na U4 sem destino. |

**Entregue no app**

- `src/features/financeiro/fechamentos.ts` — consolidação (instalações ×
  manutenções, agrupado por cliente com CNPJ e subtotal), **CSV `;`+BOM**,
  **PDF** no layout que o financeiro já conhece, e o lançamento avulso com
  parcelamento em centavos.
- `/fechamentos` — cobranças aguardando período, montar semana/mês, lançamento
  avulso (mensalidade, acerto, parcela de instalação) e a lista de períodos.
- `/fechamentos/$id` — total, seções, ações e os dois downloads.
- `/gerencial` ganhou os atalhos **Contratos** e **Fechamentos** (a barra de
  navegação já está cheia com 6 itens).

**Decisões tomadas durante a execução**

1. **A referência semanal é calculada no banco com `IYYY-"S"IW`** — o mesmo ano
   ISO do TS. Verificado na própria migration: 31/12/2025 sai como `2026-S01`.
2. **Reabrir não desfaz faturamento.** Só `fechada` volta para `aberta`; o que
   virou nota fica como está.
3. **Excluir período nunca apaga cobrança** e é bloqueado se algo já foi
   faturado — apagar dinheiro por engano não tem desfazer.
4. **Lançamento avulso ficou na tela de fechamentos**, não numa rota própria: é
   ali que o Vinicius já está quando lembra da mensalidade.
5. **Parcelas caem em competências seguintes** (mês a mês), com a divisão em
   centavos e o resto na primeira.

### Ajuste de rumo — decisões de produto (2026-08-18)

Conversa de produto com o Davi mudou o modo de trabalho e corrigiu premissas.
A especificação completa foi para o **docs/PRODUTO.md** (novo documento mestre
do produto, com as regras numeradas R1–R10 e as questões consolidadas no §8).
Resumo do que muda aqui:

1. **Novo modo de trabalho**: o Davi dita funções/regras/estrutura → tudo é
   organizado no PRODUTO.md → implementação vem depois, gradual e revisada.
2. **O SAC é um pilar** que faltava: gestor (não técnico) com 3 abas — painel
   de chamados com dashboards e filtros, calendário geral de todos os técnicos
   e lista de cards de todos os chamados. Vira a etapa **U6**.
3. **Chamado unificado**: o SAC abre chamados de quatro trilhos — campo
   (ordens_servico, agora também tipo `operacional`), T.I (demandas),
   Controle Patrimonial (demandas tipo `pedido_compra`; Gilleno usa perfil de
   técnico) e proposta (visitas_tecnicas).
4. **Correção importante (R4): visita aprovada ≠ cliente.** A aprovação do
   comercial é interna; quem aceita ou recusa a proposta é o CLIENTE. O
   backfill da Etapa 1 (visita aprovada → situacao ativo), a sugestão da tela
   de consolidação, o gatilho do botão de implantação e o elo
   `origem_proposta_id` do contrato serão corrigidos para o **aceite**.
   O modelo ganha `proposta_enviada_em` / `proposta_resultado` /
   `proposta_resultado_em` na visita.
5. **Técnico passa a 3 abas** (Home com os cards, Agenda, Perfil) — os
   chamados saem da barra e entram na Home.
6. **QAP**: o Davi puxa clientes, estoque e equipamentos por cliente pela API.
   O roadmap final ficou U6 perfis/SAC → U7 import QAP → U8 API contínua →
   U9 IA no WhatsApp.
7. **Nada foi implementado nesta rodada** — por decisão: primeiro o Davi
   responde as questões do PRODUTO.md §8, depois a U6 começa.

**Insumos aguardados**: conversas do SAC (export), export do QAP via API,
CSV do Notion, base do gestor-os.

### U6a — Papel SAC + Home do técnico (2026-08-18)

Primeira fatia da U6, destravada pelas respostas do Davi (PRODUTO.md R13):
Davi e Vinicius admins; Gilleno, Nicholas, Erik e Breno técnicos; SAC é gestor
**sem valores**; Comercial é gestor **com valores**.

**Migration:** `supabase/migrations/20260818230000_u6a_papel_sac.sql`.

| O quê | Detalhe |
|---|---|
| enum `app_role` + CHECK de cargo | ganham `'sac'`. Cuidado respeitado: o valor novo de enum não é usado na mesma transação (regra do PG 12+) — nada no script faz cast para `app_role`. |
| `is_gestor()` | passa a incluir `sac` (operação: abrir/acompanhar chamados, editar demandas…). |
| **`pode_ver_financeiro()`** | **deixa de delegar para `is_gestor()`**: agora só admin+comercial. É a costura deixada pronta na U0 sendo usada — contratos, cobranças, fechamentos, análise e o bucket de contratos ficaram fechados para o SAC numa única mudança. |
| `handle_new_user()` | aceita convite com cargo `sac`. |

**App**

- `useUserCargo` agora devolve `admin | sac | tecnico`; novo hook
  `useVeFinanceiro` (admin/comercial) espelha a régua do banco na interface.
- `useIsGerente` inclui o SAC (gestor operacional).
- **BottomNav por perfil**: admin 6 itens; **SAC 5** (Início, Calendário,
  Chamados, Demandas, Perfil — sem Gerencial e sem financeiro); **técnico 3**
  (Início, **Agenda**, Perfil — R7): Chamados e Demandas saíram da barra dele.
- **Home do técnico (R11/R12)**: banner passa a "**Você tem X chamados
  hoje**" — soma visitas de hoje + OS agendadas p/ hoje ou em atendimento +
  demandas com prazo hoje (visita conta como chamado). Abaixo, a fila dele:
  seções "Seus chamados" (OS em aberto) e "Suas demandas", cards que levam
  direto ao fluxo de cada trilho — visita continua abrindo o fluxo de
  orçamento existente.
- Card de Cobrança na OS e card de Contratos na ficha do cliente passaram de
  `isGerente` para `veFinanceiro` (senão o SAC veria cascas vazias).
- `/gerencial/usuarios` ganhou o cargo **SAC** (convite e edição); o convite
  (`convites.functions.ts`) aceita o cargo novo.

**Decisões da execução**: enquanto as questões 2–3 do PRODUTO.md §8 não são
respondidas, o SAC **não** vê a tela de programação (`beforeLoad` continua
admin/comercial) e **vê** o botão de conferir/fechar (é gestor). Fáceis de
inverter depois.

### Importação do Notion — tasks 2026 do Davi e do Erik (2026-08-18)

**Migration:** `supabase/migrations/20260819000000_import_notion_davi_erik.sql`
(gerada por script a partir de `notion/Administrativo *_all.csv`, 2.322 linhas).

**Números:** 537 demandas importadas (Davi 251, Erik 286) + 283 vínculos de
apoio. Aborta com mensagem clara se o perfil do Erik ainda não existir.

**O Notion real ≠ o briefing** — o export revelou e o import respeitou:
- Status reais: Concluído, Não iniciado, Em andamento, Aguardando aprovação,
  **Aguardando terceiros** e **Aguardando material** (os dois → `stand_by`,
  com o status original anotado na descrição). Não existe "Stand-by" lá.
- **79% das linhas têm sprint vazio** — a automação do Notion limpa o campo
  das concluídas. Regra: concluída sem sprint → `mes_passado`; **aberta** sem
  sprint → não importa (info obrigatória faltando).
- Equipes reais: `T.I / Técnica`→ti, `Marketing / Comercial`→comercial,
  `Controle Patrimonial`→patrimonio, **`SAC`→sac** e **`Monitoramento /
  Portaria`→monitoramento** — os dois últimos ENTRARAM no CHECK de demandas e
  profiles (parte 0 da migration) e no `src/lib/equipes.ts`. Multi-equipe usa
  a primeira.
- A coluna `Demanda` é a classificação: Operação diária→operacional,
  Manutenção Corretiva→corretiva, Projeto de melhoria→melhoria,
  Implantação→implantacao, Manutenção Preventiva→preventiva.
- Cliente `Prever`/vazio = interna; outros tentam casar com o cadastro por
  nome normalizado; não casando, "Cliente (Notion): X" vai para a descrição
  (o import do QAP religa depois).
- `Risco Operacional` não tem campo equivalente — **não importado** (anotado).
- Davi+Erik na mesma célula: o primeiro é o responsável, o outro vira apoio;
  outros nomes (Gilleno, Nicholas, Vinicius…) viram apoio se tiverem conta.
- `created_at` preserva a data de criação original; conclusão usa a coluna
  Conclusão (fallback: prazo → criação).
- **Chave de origem**: título|prazo|criação|cliente — mais rica que a da tela
  `/demandas/importar` (título|prazo), porque o quadro tem 13 "Proposta
  Comercial" distintas sem prazo que colapsariam. Por isso: **não reimportar
  este CSV pela tela**.
- Notificações desligadas durante o insert (500+ sinos de uma vez) e
  religadas ao fim — a verificação confere.

**Fora da importação (por regra, recuperáveis sob pedido):** 564 tasks só de
2024/2025 · 31 sem equipe (ex.: "Croqui técnico", "Visita Técnica - Duplex
Residence", "Laudo técnico - Queima NoBreaks") · 5 abertas sem sprint (ex.:
"Atualizar firmware - Draytek", "Alarme off-line") · 1 sem título · 1 com
equipe "Dados" ("Relatório de atendimento").

### U6b — Lista unificada de chamados (2026-08-18)

Sem migration: só código. É a **aba 3 do SAC** (R8/R9), a primeira tela onde os
quatro trilhos aparecem juntos.

**Entregue**

- **`/chamados`** — agrega OS de campo + demandas internas + visitas técnicas
  (propostas) num modelo único de card: trilho, título, número, cliente,
  responsável, status com as cores do trilho, prioridade (OS), prazo/agenda e
  o link para a página certa de cada um. Realtime nos três registros.
- **Filtros**: situação (em aberto / encerrados / todos), trilho (campo,
  propostas e as equipes de demanda que tiverem itens), responsável (todas as
  pessoas) e busca por número/título/cliente/responsável.
- **Ordenação** (o "ícone para ordenar" da R8), 5 critérios: mais recentes ·
  prazo mais apertado (estourados primeiro) · prioridade · cliente A→Z ·
  última atualização.
- **Acesso**: admin, comercial e SAC (`beforeLoad`). A aba "Chamados" do SAC
  aponta para cá; admin/comercial chegam pelo botão novo na lista de campo
  (`/os`). Renderiza até 200 cards por vez, com aviso para refinar.

**Decisões da execução**

1. A tela **agrega, não substitui**: nenhum fluxo mudou de lugar — o card leva
   para `/os/$id`, `/demandas/$id` ou o fluxo da visita.
2. "Encerrado" por trilho: OS fechada/cancelada · demanda concluída/cancelada ·
   visita aprovada/reprovada (aprovação interna encerra o CHAMADO de proposta;
   o funil comercial pós-aprovação é assunto do R4, na fila).
3. A ordenação por prazo põe **estourados primeiro**, depois quem tem prazo,
   sem prazo por último — é a fila de cobrança natural do SAC.

### U6c — Abertura unificada + tipos de chamado (2026-08-18)

**Migration:** `supabase/migrations/20260819010000_u6c_tipos_chamado.sql`.

Materializa as regras R5, R6 e R9: a porta única de abertura e os dois tipos
ditados que faltavam no domínio.

**Entregue no banco**

| O quê | Detalhe |
|---|---|
| `ordens_servico.tipo` aceita **`operacional`** (R5) | entrega de controle, cadastros, tarefas de campo sem conserto. SLA segue a prioridade (suposição da questão 7: normal/72h, editável no `os_sla`). |
| `demandas.tipo` aceita **`pedido_compra`** (R6) | o chamado do Gilleno. Campos próprios aguardam a questão 6 — a descrição carrega os detalhes por enquanto. |
| `sugerir_tipo_demanda()` | intenção de compra vem **primeiro**: "Comprar peça para conserto" é pedido de compra, mesmo contendo palavra de corretiva. Gêmeo TS atualizado junto. |

**Entregue no app**

- **`/chamados/novo`** — a triagem (R9): quatro cartões com descrição e
  exemplos; cada um leva ao formulário certo já configurado:
  Campo → `/os/nova` (o wizard completo com SLA e agenda) ·
  T.I → `/demandas/nova?equipe=ti` ·
  Pedido de compra → `/demandas/nova?equipe=patrimonio&tipo=pedido_compra` ·
  Proposta → `/gerencial/nova` (o formulário de visita).
- `/chamados` ganhou o botão **Abrir** e virou rota-pai (Outlet).
- `/demandas/nova` aceita os parâmetros da triagem sem perder o
  comportamento antigo (equipe do perfil quando ninguém escolheu trilho).
- Seletor de tipo do `/os/nova` ganhou **Operacional**; labels e cores dos dois
  tipos novos em `os-status.ts` e `demanda-status.ts`.
- **Guard do gerencial abriu uma exceção cirúrgica**: SAC entra SÓ em
  `/gerencial/nova` (o trilho de proposta); painel e demais telas seguem
  admin/comercial.

**Suposições registradas** (questões 5 e 7 do PRODUTO §8, fáceis de mudar):
no trilho proposta o SAC registra e **pode** agendar — técnico e data são
opcionais no formulário de visita; chamado operacional usa o SLA da
prioridade escolhida.

### U6d — Painel de chamados + calendário com filtros (2026-08-18)

Sem migration: só código. Completa as **3 abas do SAC** (R8).

**Aba 1 — `/chamados/painel`** (herda o acesso de `/chamados`):
- **Em aberto agora** em número grande + atrasados ao lado.
- Totais **semana / mês / ano** (criados no período).
- **Filtros que valem para tudo** (números, gráfico e lista): trilho, técnico,
  tipo (campo + demanda + visita) e cliente.
- **Gráfico de quantidade de manutenções**: barras empilhadas por mês (últimos
  12), quebradas por tipo de chamado de campo — paleta §9, ordem fixa.
- Lista resumida dos em aberto com link para a lista completa.
- O `/os/painel` continua como mergulho específico do campo (SLA, carga por
  técnico); este é a visão do todo.

**Aba 2 — `/calendario` com filtros:**
- **Correção de efeito colateral da U6a**: o SAC caía no ramo de técnico
  (`cargo === "admin"`) e via o calendário vazio — agora SAC vê **todos os
  técnicos**, como manda a R8.
- Filtros novos para gestores: **por técnico** (select) e **por tipo de
  chamado** (Tudo / Visitas / Corretiva / Preventiva / Operacional /
  Implantação) — aplicados à grade, à contagem por dia e à lista.

**Verificação**: além das checagens de sintaxe/imports, uma revisão
adversarial multi-agente (4 lentes: roteamento, SQL, lógica de UI, permissões
→ verificação cética de cada achado) rodou sobre TODO o conjunto não
commitado (U6c + U6d) antes do commit. **Achados confirmados e corrigidos:**

1. **`/os/nova` bloqueava o SAC** (beforeLoad admin/comercial) — a triagem
   mandaria o SAC para lá e ele seria expulso. Corrigido: `sac` entrou no
   guard; a RLS `os_insert_gestor` já o aceitava via `is_gestor`.
2. **A policy `visitas_select` (de 20260628) não enxergava o SAC** — checagem
   inline `cargo IN ('admin','comercial')`, anterior ao papel. O SAC criaria a
   visita pelo trilho de proposta e nunca mais a veria; as propostas sumiriam
   das 3 abas dele. Corrigido na U6c: `visitas_select`/`visitas_update` agora
   usam `is_gestor()`.
3. **Espelho TS da classificação não colapsava whitespace** — "pedido de⏎
   material" (Enter no textarea) casava no trigger e não na pré-visualização:
   a tela prometia um tipo e o registro nascia outro. Corrigido:
   `sugerirTipoDemanda` agora normaliza espaços como o `normalizar_texto()`.
4. **Sem backfill, as compras importadas do Notion ficavam "operacional"** e o
   filtro "Pedido de compra" nascia vazio de histórico. Corrigido: UPDATE na
   U6c reclassifica só `origem='notion' AND tipo='operacional'` cuja própria
   heurística reconhece como compra.
5. **Gráfico do painel agrupava o mês pelo UTC** — chamado das 21h30 do dia 31
   caía no mês seguinte. Corrigido: chave de mês local.
6. Botões de painel de campo/programação apareciam para o SAC e o expulsavam
   ao toque — escondidos (questões 2–3 do §8 seguem mandando).
7. Texto do NOTICE das constraints dizia "não recriada" quando o bloco
   reverte inteiro e a **antiga é mantida** — mensagem corrigida para não
   induzir depuração errada.

⚠️ **Ordem de subida** (achado confirmado): a triagem e os seletores já
oferecem `operacional`/`pedido_compra` — **rode a U6c antes do deploy**, senão
o INSERT falha com violação de CHECK até a migration rodar.

### U7 — Fusão chamado × demanda (2026-08-19)

**Ordem ditada:** "Chamados e Demanda devem ser a mesma coisa, vamos chamar
tudo de 'Chamado'. Faça toda a alteração estrutural para tal regra." Escolha
do Davi entre as opções apresentadas: **fusão real das tabelas** (virou a R16
do PRODUTO.md).

**Migration** `20260819120000_u7_fusao_chamados.sql` (1003 linhas). Estratégia
de menor risco: em vez de criar tabela nova e religar os 9 satélites, a
`ordens_servico` foi **renomeada** e as `demandas` foram **absorvidas dentro
dela preservando os ids** — é isso que faz apoios, feed e equipamentos
continuarem apontando para o registro certo sem nenhum UPDATE de FK.

| Antes | Depois |
|---|---|
| `ordens_servico` | `chamados` |
| `os_fotos`, `os_eventos`, `os_checklist`, `os_checklist_templates`, `os_pecas`, `os_pecas_analise`, `os_sla`, `os_contadores` | `chamado_*` |
| `demanda_apoios`, `demanda_equipamentos` | `chamado_apoios`, `chamado_equipamentos` |
| `demanda_eventos` | absorvida em `chamado_eventos` |
| `demandas` | absorvida em `chamados`, depois `DROP` |
| `ordens_servico.tecnico_id` | `chamados.responsavel_id` |
| `cobrancas.os_id` / `.peca_id` | `.chamado_id` / `.chamado_peca_id` |
| `notificacoes.os_id` + `.demanda_id` | `notificacoes.chamado_id` |

**Vocabulário de status** — o ciclo virou um só, com dois recortes:

| OS de campo | Demanda interna | Chamado |
|---|---|---|
| `aberta` | `nao_iniciada` | `aberto` |
| `agendada` | — | `agendado` |
| `em_atendimento` | `em_andamento` | `em_andamento` |
| — | `stand_by` | `stand_by` (agora vale para os dois) |
| — | `aguardando_aprovacao` | `aguardando_aprovacao` |
| `executada` | — | `executado` |
| `fechada` | `concluida` | `concluido` |
| `cancelada` | `cancelada` | `cancelado` |

`statusDaNatureza()` decide o que aparece em cada tela: "agendado" e
"executado" pressupõem deslocamento e conferência, então não cabem no interno;
"aguardando aprovação" não cabe no campo.

**Numeração** — todo mundo renumerado por `created_at` como `CH-AAAA-NNNN`; o
número antigo (OS-… / DEM-…) ficou em `numero_legado`, indexado, para quem
procurar pelo que já circulou em conversa.

**17 funções reescritas**: `chamado_preencher`, `chamado_registrar_evento`,
`notify_chamado{,_comentario,_apoio}`, `pode_acessar_chamado{,_por_path}`,
`aprovar_chamado_financeiro`, `marcar_chamado_faturado`,
`chamado_sincronizar_unidades`, `virada_sprint`, `alertas_chamados`,
`resumo_semanal_chamados`, `alertas_chamado_faturamento`,
`proximo_numero_chamado`.

**App** — 29 arquivos tocados:

- **Domínio**: `lib/os-status.ts` + `lib/demanda-status.ts` → **`lib/chamado-status.ts`**
  (8 status, `Natureza`, `statusDaNatureza`/`tiposDaNatureza`, `prazoParaData`/
  `dataParaPrazo` para o input de data ↔ `timestamptz`).
- **Dados**: `features/os/*` + `features/demandas/*` → **`features/chamados/*`**
  (`data.ts` unificado, `pecas`, `cobranca`, `checklist`, `relatorio`,
  `AssinaturaCanvas`, e os dois corpos de tela `DetalheCampo`/`DetalheInterno`).
- **Rotas**: `/os*` e `/demandas*` deixaram de existir. Ficou
  `/chamados` · `/chamados/$id` · `/chamados/novo` (triagem) ·
  `/chamados/novo-campo` · `/chamados/novo-interno` · `/chamados/painel` ·
  `/chamados/indicadores` · `/chamados/programacao` · `/chamados/importar`.
- **Rodapé**: uma aba "Chamados" para todos os perfis; a aba "Demandas" saiu e
  o quadro por sprint virou um **modo de visualização** dentro da lista.
- **Bordas**: dashboard, calendário, ficha do cliente, notificações,
  fechamentos, visita → chamado de implantação, `cobranca.functions.ts`.

**Descobertas registradas nesta etapa**

1. **O `routeTree.gen.ts` não precisa mais ser editado à mão.** O
   `@tanstack/router-generator` roda direto pelo Node, sem passar pelo
   `vite.config.ts` (que exige rede e por isso nunca completou aqui). Basta um
   script na raiz do projeto — tem que ser na raiz, senão o import do pacote
   não resolve:
   ```js
   import { Generator, getConfig } from '@tanstack/router-generator'
   const root = process.argv[2]
   const config = await getConfig({ routesDirectory: root + '/src/routes',
     generatedRouteTree: root + '/src/routeTree.gen.ts' }, root)
   await new Generator({ config, root }).run()
   ```
   Gerou as 9 rotas de chamado com o censo perfeito (11 ocorrências por filha).
   Isso encerra o cuidado manual que vinha desde a Etapa 3 do sistema de OS.
2. **A trava da rota-pai derrubaria o técnico.** `/chamados` bloqueia quem não
   é gestor; como `/chamados/$id` é filha, o técnico seria mandado para o
   dashboard ao tocar num card da Home. O `beforeLoad` passou a checar
   `location.pathname` e só barra a **lista**, não os filhos.
3. **O feed interno é cronológico, o de campo é invertido.** Ao fundir os dois
   hooks isso quase se perdeu: `useChamadoEventos(id, "asc" | "desc")` mantém
   cada tela como era.
4. **O importador de CSV duplicaria as 537 tasks.** A migration do Notion
   gravou `origem_id` como `titulo|prazo|criacao|cliente`; a tela montava
   `titulo|prazo`. O `ON CONFLICT` não pegaria. Passou a conferir título +
   prazo contra o que já está no banco antes de gravar.
5. **`prazo` (date) virou `prazo_limite` (timestamptz)** às 23:59 de Brasília.
   Fatiar a string ISO dá o dia seguinte — por isso `prazoParaData()` existe e
   é usada em toda comparação de data.
6. **Programação e indicadores abertos para o SAC**, pela definição do papel
   ("coordena, planeja, programa as atividades dos outros"). Nenhuma das duas
   mostra valor, então não fere a R13. Fecha a questão 2 do PRODUTO §8.

**Verificação**: 169 arquivos conferidos pelo parser do TypeScript — 0 erros de
sintaxe, 0 imports quebrados, 0 símbolos importados que não existem (os 2
avisos restantes são `?url` de CSS e `.asset.json`, falsos positivos).
`scripts/verificar-logica.cjs`: 34/34.

**Ordem de publicação (obrigatória):** a migration e o deploy vão na **mesma
janela**. O app novo não fala com o banco velho e vice-versa — diferente das
etapas anteriores, aqui não existe período de convivência.

**Correção depois da primeira tentativa (2026-08-19).** A migration quebrou no
SQL Editor e o motivo era estrutural, não de digitação: **renomear uma tabela
leva os triggers junto, mas não reescreve o corpo das funções deles.** Os sete
triggers herdados de `ordens_servico` continuavam procurando `public.os_sla`,
`public.os_eventos` e `NEW.tecnico_id` — que a seção 1 tinha acabado de
renomear. O primeiro `UPDATE` de status da seção 3 já morria com
`relation "public.os_sla" does not exist`, e a fusão inteira voltava atrás.

A correção é uma linha em cada ponta: `ALTER TABLE public.chamados DISABLE
TRIGGER USER` logo depois dos renames (seção 1.1) e `ENABLE TRIGGER USER`
depois que a seção 7 troca os antigos pelos novos. Isso resolve um segundo
problema que teria passado despercebido: com o `ordens_servico_set_updated_at`
ativo, a renumeração da seção 5 carimbaria `now()` em `updated_at` de **todos**
os registros, e os 537 chamados vindos do Notion perderiam a data real.

Lição para as próximas migrations que renomeiam tabelas: **desligar os triggers
da tabela renomeada antes de encostar nos dados** é regra, não precaução.
`supabase/diagnostico_u7.sql` mostra se uma tentativa que falhou desfez tudo.

### U8 — O aceite do cliente (2026-08-19)

Fecha a regra **R4**, a correção que o Davi ditou: *"quando o comercial aprova
uma visita técnica, ele está aprovando a visita… mas o cliente quem aprova ou
não a proposta. Todas as visitas que foram aprovadas não significam que a
proposta foi aprovada, ou seja, não significa que são nossos clientes."*

**Migration** `20260819140000_u8_aceite_cliente.sql` (223 linhas).
**Roda depois da U7** — o rebaixamento consulta `public.chamados`.

**1. O pós-aprovação na visita.** `visitas_tecnicas` ganhou
`proposta_enviada_em`, `proposta_resultado` (`aguardando|aceita|recusada`),
`proposta_resultado_em` e `proposta_motivo_recusa`. `NULL` em
`proposta_resultado` quer dizer "a proposta nem saiu ainda" — é o que separa
"aprovamos internamente" de "o cliente está decidindo".

**2. Duas RPCs**, `SECURITY DEFINER` porque o aceite atravessa tabelas (visita
+ cliente) e pela RLS o comercial não conseguiria fazer os dois:
- `registrar_envio_proposta(_visita_id)` — só a partir de `status = 'aprovada'`.
- `registrar_resultado_proposta(_visita_id, _resultado, _motivo)` — exige envio
  registrado antes, e é **o único ponto do sistema** que promove
  `clientes.situacao` de `prospecto` para `ativo`.

**3. Desfaz o atalho "visita aprovada ⇒ cliente ativo".** O backfill da Etapa 1
(`20260817120000`) marcava como ativo qualquer cliente com uma visita aprovada.
Um rebaixamento cego devolveria todo mundo para prospecto, inclusive clientes
reais — então o critério para **continuar ativo** é qualquer prova de relação:
proposta aceita · contrato cadastrado · chamado de campo executado/concluído ·
cobrança gerada · `qap_cliente_id` preenchido. Quem não tem nenhuma volta a
prospecto, e a lista exata fica em `clientes_rebaixados_u8` — desfazer é um
UPDATE só, documentado no `COMMENT` da tabela. A verificação final da migration
imprime quantos e **quais** foram rebaixados, para conferência antes de seguir.

**4. Funil comercial.** `funil_comercial(_desde date)` devolve visitas →
aprovadas → enviadas → aceitas → recusadas. A tela `/gerencial` calcula o mesmo
funil do lado do cliente (os dados já estavam carregados; evita uma ida a mais
ao banco) — a RPC fica disponível para relatório com recorte de data, ainda sem
consumidor.

**App**
- `visita/$id`: depois de aprovada aparece um aviso de que aprovação interna
  não faz cliente, e o botão **"Marcar proposta como enviada"**. Enviada, surgem
  **"O cliente ACEITOU"** e **"O cliente RECUSOU"** (com campo de motivo).
- **O botão de gerar implantação saiu da aprovação e foi para o aceite** — antes
  aparecia cedo demais e podia gerar chamado para negócio que nunca fechou.
- `features/clientes/data.ts`: a consolidação parou de sugerir "ativo" a partir
  de `status = 'aprovada'`; agora só a partir de `proposta_resultado = 'aceita'`.
- `/gerencial`: card do funil, com a frase que resume a regra — "visita aprovada
  é aprovação interna; cliente de verdade é o que aceitou a proposta". O card
  "Total" saiu dos indicadores porque o funil já abre com ele.

**Suposição registrada** (questão 9 do PRODUTO §8): o **motivo da recusa** entrou
como campo livre opcional — é o dado que responde "por que perdemos". Se não
fizer sentido, é só dizer.

**Pendência declarada:** o elo `origem_proposta_id` do contrato (U2) deveria
nascer do aceite. Hoje o contrato é cadastrado à mão e o campo fica livre — não
mexi porque exige decidir se o aceite passa a **oferecer** a criação do contrato.

**Verificação**: 169 arquivos pelo parser do TypeScript — 0 erros de sintaxe,
0 imports quebrados. `verificar-logica.cjs` 34/34. Migration com `$$` e aspas
balanceados.

### U9 — O pedido de compra ganha corpo (2026-08-19)

Fecha a **questão 6** do PRODUTO §8. Até aqui "pedido de compra" era só um
`tipo` de chamado interno: dava para abrir e classificar, mas não para
responder o que o Controle Patrimonial pergunta na prática — o que é, quanto
custa, de quem, e quem autorizou a gastar.

**Migration** `20260819160000_u9_pedido_compra.sql`. **Roda depois da U7.**

**Satélite 1:1 `chamado_compra`**, não colunas soltas em `chamados`: só uma
fatia dos chamados é compra, e a decisão de gasto tem dono próprio.
Campos: quantidade + unidade, fornecedor sugerido, link do produto, valor
estimado, valor final, justificativa, situação, quem decidiu e quando, motivo
da recusa, datas de compra e recebimento.

**O caminho:**

```
solicitado → em cotação → aprovado → comprado → recebido
                  └────── recusado (com motivo)
```

**A alçada** — a parte que exigia decisão de produto, registrada como suposição:

| Ato | Quem |
|---|---|
| Abrir o pedido, acompanhar | qualquer um com acesso ao chamado (SAC inclusive) |
| Cotar, comprar, receber | quem executa (Controle Patrimonial) |
| **Aprovar / recusar** | **`pode_ver_financeiro` — admin e comercial** |

Se a alçada real for outra (Patrimônio aprova até certo valor, por exemplo), é
um `IF` na RPC `decidir_pedido_compra`.

**Decisão de modelagem registrada:** o valor da compra **não** entrou na régua
do `pode_ver_financeiro` para leitura. A R13 ("SAC não vê valores") é sobre o
que **cobramos do cliente**; custo de aquisição é outra coisa, e quem compra
precisa enxergar o que gasta. Se a intenção era esconder também o custo, o
caminho é o mesmo do veredito financeiro da U3: policy de SELECT no satélite.

**Automações**
- `chamado_criar_ficha_compra()` — todo chamado `pedido_compra` nasce com a
  ficha (INSERT e também UPDATE do tipo). Sem isso a primeira decisão falharia.
  Backfill para os pedidos que a U6c já reclassificou.
- A situação **move o chamado**: `recebido` conclui, `recusado` cancela com o
  motivo, e cotar/aprovar/comprar tira de `aberto` para `em_andamento`.
- Cada passo entra na linha do tempo (`chamado_eventos`, tipo `compra`).
- `alertas_compras(dias)` + job `alertas-compras` às 07:30 de dia útil: avisa
  admin e comercial de pedido parado em `solicitado`/`em_cotacao`.

**App**
- `features/chamados/compra.ts` — dados, rótulos, cores e `proximasSituacoes()`,
  que é o que impede a tela de oferecer um passo que o banco vai negar.
- `DetalheInterno`: cartão "Pedido de compra" com os campos editáveis (salvam
  no blur), o link do produto clicável, o valor pago quando existe, o motivo da
  recusa, e os botões do próximo passo — **aprovar e recusar só aparecem para
  quem pode**, porque botão que sempre dá erro é armadilha.
- `chamados/novo-interno`: quando o tipo (escolhido **ou sugerido**) é compra,
  o formulário mostra quantidade, valor estimado, fornecedor e link — o que o
  solicitante já sabe na hora de pedir. O resto do caminho acontece na página
  do chamado.

**Verificação**: 170 arquivos pelo parser do TypeScript — 0 erros de sintaxe,
0 imports quebrados. `verificar-logica.cjs` 34/34. Migration balanceada; o
agendamento do cron vai dentro de `DO … EXCEPTION` para não derrubar a
migration se o pg_cron estiver desligado (mesmo padrão da U1).

---

## Fila de migrations a aplicar (nesta ordem)

| # | Arquivo | Observação |
|---|---|---|
| 1 | `20260819120000_u7_fusao_chamados.sql` | **deploy do app na mesma janela** — não há convivência |
| 2 | `20260819140000_u8_aceite_cliente.sql` | confira a lista de clientes rebaixados que ela imprime |
| 3 | `20260819160000_u9_pedido_compra.sql` | — |

### U10 — A Início vira tela de atividades (2026-08-19)

Regra **R17**. Ditada em duas partes: *"Na página home devem aparecer todas as
atividades possíveis que envolvam o usuário. Crie visualizações diferentes com
um botão seletor: lista com cards (atualmente usado) e kanban."* E depois:
*"kanban principal pode ser por status. Podem ter botões com padrões de kanban:
sprint este mês, outra opção é standby. Aí dá pra filtrar por responsável, por
apoio, etc."*

**Só código — nenhuma migration.**

**O problema que não estava no pedido.** A Home junta atividades de tabelas que
não compartilham vocabulário de status: chamado tem oito, visita tem os buckets
dela (e o CHECK foi derrubado, hoje é texto livre), pedido de compra tem seis
situações. Um quadro "por status" precisa decidir de quem é o status. Três
estratégias foram desenhadas e julgadas por três lentes independentes (uso no
celular, correção/segurança, custo de manutenção). Venceu **traduzir tudo para
o vocabulário do chamado**, 16,5 × 13,5 × 12,5.

O perdedor mais interessante foi o que inventava cinco estágios genéricos: era
o melhor no celular (rótulos curtos, cinco colunas) e caiu porque se apoiava em
três premissas que não sobrevivem à leitura das migrations — entre elas a de
que `chamados.equipe` seria nula fora do interno (é `NOT NULL DEFAULT 'tecnica'`,
u7:90; a nulidade é convenção do cliente) e a de que um override de
`faturamento_status` teria janela (não tem: a coluna é `NOT NULL DEFAULT
'a_analisar'` e o backfill da U0 só alcançou o que já estava fechado, então a
coluna receberia o histórico inteiro e crescente).

**A tradução** vive em `src/features/atividades/modelo.ts`, função total com
precedência ordenada: terminal do chamado → situação da compra → status da
visita → identidade → `sem_status`. Nada some em silêncio. Onde ela mente está
escrito no próprio arquivo, sem suavizar — a pior mentira é "Aguardando
aprovação", que junta o aval interno do comercial (minutos, quem decide está na
sala) com a espera pela resposta do cliente (semanas, fora do nosso controle).
O campo `bolaCom` devolve no card a diferença que a coluna apagou.

**O que a revisão adversarial pegou, e que virou código**

1. **O cabeçalho da coluna sumia na rolagem.** Deixar a coluna crescer e a
   página rolar é o instinto errado: a 600px de rolagem a única coisa que diz o
   que a coluna significa sai da tela. Pior, com "Aberto" em 20 cards e
   "Cancelado" em 2, arrastar de lado lá embaixo mostra branco e parece coluna
   vazia. Trilho de altura fixa, rolagem por coluna.
2. **Coluna de 260px, não 300.** Em 375px, 300 deixa 31px da próxima coluna
   aparecendo — lê como padding. 260 deixa ~75px, que lê como "tem mais coisa".
   É a única pista de que rola de lado: o Chrome do Android não mostra barra.
3. **O app proíbe zoom** (`maximum-scale=1`) e a base usa tipografia de 9,5px.
   Piso de 11px no card e no cabeçalho — quem lê está no sol, de luva.
4. **Alvos de toque.** Os chips tinham ~31px de altura. Passaram a 40px: cada
   erro de toque aqui TROCA o que está na tela.
5. **`overscroll-behavior`.** Sem isso, arrastar no topo dispara o
   pull-to-refresh do Android, que aqui é recarga completa com cache frio.
   Entrou em `html, body` junto com `overflow-x: hidden`.
6. **A posição volta.** Abrir um card na coluna 6 e voltar recaindo na coluna 1
   é o imposto clássico de kanban em celular — o roteador não restaura offset
   de container interno. Guardado em `sessionStorage`.
7. **Falha de rede não pode parecer "não tenho trabalho hoje".** Coluna vazia e
   consulta falhada tinham a mesma aparência. Agora o erro é explícito.
8. **`useChamadosRealtime()` existia com ZERO call sites** — `/chamados` tinha
   inlinado um canal próprio, e a Home ia abrir o terceiro na mesma tabela. O
   hook virou o canal único, com debounce de 1,2s: a policy entrega todo
   chamado interno a qualquer autenticado (537 do Notion + o fluxo diário), e
   sem agrupar o técnico refazia as consultas a cada edição de qualquer demanda
   da empresa. `chamado_compra` deliberadamente **não** entra no canal: ela não
   está na publicação do realtime, e inscrição em tabela fora da publicação não
   dá erro — conecta, fica viva e nunca dispara.
9. **O valor da compra não é buscado.** `chamado_compra_select` usa
   `pode_acessar_chamado()`, que devolve true quando `responsavel_id IS NULL` —
   ou seja, o `valor_estimado` de um pedido recém-aberto é legível por qualquer
   autenticado. Em vez de buscar e esconder no cliente (um spread de distância
   do vazamento), a Home não pede as colunas. **A policy continua larga e isso
   é questão para o Davi**, não conserto de tela.
10. **`dashboard-visitas` não foi renomeada.** Cinco arquivos a invalidam de
    fora; renomear não quebraria nada visivelmente, só deixaria a tela de
    entrada velha depois de aprovar, reprovar ou reagendar uma visita.
11. **As chaves passaram a carregar o usuário.** As três consultas de chamado
    da Home antiga tinham chave estática: ao trocar de conta, o React Query
    servia o dado do usuário anterior.
12. **A invariante "campo não tem equipe nem sprint" desceu para o modelo.**
    Estava na camada de render de `/chamados`; a primeira pessoa que ligasse um
    filtro de equipe sem o guard de natureza puxaria todo o campo, sem erro.

**Asserções**: `scripts/verificar-logica.cjs` foi de 34 para **75** — a tabela
de tradução é o artefato onde teste é trivialmente lucrativo, e a promessa
"nada some em silêncio" só é verdade se cada status cru de cada origem tiver
destino. Um caso por status por origem, mais exaustividade sobre as 8 colunas.
O carregador ganhou um esqueleto para o cliente do Supabase (`import.meta.env`
não existe em CommonJS).

**Removido de propósito, e reversível**
- **Os quatro tiles de métrica de visita.** Liam `visitasExibidas`, que já
  passara pelo filtro de status: com um status escolhido, três dos quatro
  ficavam obrigatoriamente em zero. E custavam 70px de uma tela que, com o
  banner de 187px, já abre o quadro mostrando um card e meio num aparelho de
  667px.
- **O dropdown de status.** Filtro de status sobre um quadro de status é
  redundante — e era ele que quebrava as métricas.
- **Os blocos "Seus chamados" e "Suas demandas"**, que eram duas listas
  separadas por tabela de origem. Viraram a fila única que foi pedida.

**Conclusão que o painel escreveu e eu registro sem ter agido sobre ela:** o
técnico típico tem 3 a 8 itens abertos, o que é uma lista, não um quadro. O
kanban é ferramenta de coordenação (SAC e admin). A visão padrão é lista para
todo mundo e o seletor existe para todos os perfis, como foi pedido — mas se o
técnico nunca usar o quadro, a resposta certa é tirar o botão dele, não
defender a simetria.

### U11 — Permissão por tela, editável pelo admin (2026-08-19)

Regra **R18**. Pedido: *"Crie um campo assim para o admin gerenciar as
permissões dos usuários... Coloque todas as telas do app e o esquema de check
para permissão"*, com um exemplo de outro sistema em anexo.

Até aqui quem abre cada tela estava escrito em código, espalhado por doze
`beforeLoad` que repetiam a mesma consulta e listavam cargos na mão. Mudar um
acesso exigia deploy.

**Migration** `20260819180000_u11_permissoes_tela.sql`: tabela `permissoes_tela`
(tela, cargo, permitido + quem mudou e quando), RLS de leitura aberta ao time e
escrita só de admin, e a RPC `salvar_permissoes(jsonb)` que grava a matriz
inteira de uma vez.

**Três decisões que valem mais que o código**

1. **O admin não entra na matriz.** Tem tudo por regra de sistema. Se fosse
   linha de tabela, um clique errado trancaria o próprio admin fora da tela de
   permissões, e só o SQL Editor destrancaria. Pela mesma razão, a guarda de
   `/gerencial/permissoes` NÃO passa pela matriz: ela olha o cargo direto.
2. **A semente reproduz o código de hoje, guarda por guarda** — inclusive onde
   o que existe hoje é discutível. `/clientes/migrar` funde cadastros
   duplicados e hoje qualquer um entra; entrou assim. Aplicar a migration não
   muda nada; toda mudança passa a ser ato explícito com nome e hora.
3. **Sem linha no banco vale o padrão do catálogo.** Banco fora do ar, consulta
   que falha ou tela recém-criada não podem trancar todo mundo para fora — o
   app degrada para o comportamento que sempre teve, e não para o vazio. É por
   isso que `useMatrizPermissoes` devolve `{}` em erro em vez de propagar.

**Ordem de publicação, e por que ela é frouxa aqui:** ao contrário da U7, dá
para publicar o código ANTES de rodar a migration. Sem a tabela, toda consulta
falha, cai no padrão do catálogo, e o app se comporta exatamente como antes. A
tela de permissões abre mostrando os padrões e só o Salvar falharia.

**Catálogo** em `src/lib/telas.ts` — 21 telas em 7 grupos. Fica no código
porque É o mapa de rotas: uma tela existe quando existe rota, o que é fato de
deploy. Ficam de fora as páginas de detalhe (`/chamados/$id` e afins), que
herdam de quem lista — o técnico chega no chamado dele pelos cards da Início
mesmo sem ver a lista.

**Asserção que impede o pior erro desta etapa:** `verificar-logica.cjs` lê o
INSERT da migration e compara com o catálogo em TS — mesmas telas, mesmos
padrões. Se alguém editar um e esquecer o outro, o app se comportaria de um
jeito antes da migration e de outro depois, e ninguém notaria. 87 → **101**
asserções.

**Fiação**: seis `beforeLoad` trocados por `guardaDeTela(chave)`; o de
`/gerencial` preservou os dois casos especiais que tinha (SAC entra em
`/gerencial/nova` sem entrar no painel; `usuarios` e `permissoes` têm guarda
própria de admin). O rodapé some com item cuja tela está bloqueada, e os
atalhos do painel gerencial também — atalho que leva a tela bloqueada é
armadilha. Enquanto a matriz carrega, nada some: `podeVer` devolve `undefined`
e o item fica, senão a barra pisca abas aparecendo e sumindo a cada carga.

### U12 — Desktop: quadro de borda a borda, roda do mouse, filtros em menus (2026-08-19)

Pedido: *"Altere o status 'Aberto' para 'Aguardando inicio'. Além disso, otimize
a versão desktop... o kanban ocupe da esquerda para direita da tela, o scroll do
mouse funcione, que não seja visivel essa barra de scroll. Una as opções de
filtro em botões com caixas que abrem para multi seleção."*

**Só código — nenhuma migration.**

**O rótulo, não o valor.** `aberto` continua sendo o que o banco grava: está no
`CHECK chamados_status_check`, em triggers, em funções e em policies. Trocar o
valor seria migration de risco alto para mudança de texto. Só
`chamadoStatusInfo().label` mudou — que é exatamente para isso que ele existe.

**Sangria até a borda.** `calc(50% - 50vw)` funciona sem o componente conhecer a
largura do container. A coluna deixou de ser fixa em 260px e virou
`clamp(300px, 22vw, 360px)`: num monitor, sete colunas espremidas com espaço
morto ao lado viraram sete colunas legíveis.

**Roda do mouse.** Trilho horizontal não responde à roda vertical, e a barra
agora está escondida — sem tradução, quem usa mouse fica sem saída. A conversão
só acontece quando a coluna sob o cursor não tem mais o que rolar na vertical,
senão a roda deixaria de ler a coluna, que é o gesto mais frequente. Exige
`passive: false`, e por isso não dá para usar o `onWheel` do React.

**Filtros em cinco menus** (Padrão · Vínculo multi · Período · Situação ·
Pessoa) no lugar de quinze chips em duas fileiras. O botão fechado já mostra a
escolha: filtro cujo estado só se descobre abrindo é filtro que a pessoa esquece
ligado e depois acha que o sistema perdeu dados.

**Layout**: container 1024 → 1280px; lista em grade de 2 colunas a partir de
1024px e 3 a partir de 1600px, porque card de 1280px com título de 14px é ruim
de ler; banner deixa de comer 28vh num monitor; entraram foco visível por
teclado e `prefers-reduced-motion`.

**Dois defeitos meus, achados na revisão antes de subir**

1. **A conta da sangria estava errada.** O padding era
   `max(24px, calc(50vw - 50% + 24px))` — a margem negativa já resolvia a
   posição, e somar a fórmula de volta empurrava a primeira coluna para **352px
   da borda** num monitor de 1920, que é exatamente o problema que a sangria
   existe para resolver. Virou constante de 24px, conferida em 1024, 1280, 1440
   e 1920.
2. **`overflow-x: hidden` em `html, body` quebraria os wizards.** `hidden`
   transforma o elemento em container de rolagem e anula todo `position: sticky`
   descendente — os cartões fixos de `TotemWizard` e `ElevadoresWizard`
   parariam de grudar. Trocado por `overflow-x: clip`, que contém o estouro sem
   criar container.

**Revisão encerrada a pedido, com 17 achados registrados.** A fase de refutação
não chegou a rodar, então os achados foram separados entre os que eu mesmo
verifiquei no código e os que seguem por confirmar. Estão em
**`docs/PENDENCIAS_TECNICAS.md`**, com arquivo, caminho de quebra e correção
mínima de cada um. O mais grave: o **menu de filtro é pintado atrás da
BottomNav** — `#root, main, header, nav { z-index: 1 }` faz do `<main>` um
contexto de empilhamento, então o `z-index: 60` do popover só compete lá dentro,
e no celular tocar na última opção navega para outra tela. A correção é portal
para o `body`; subir o z-index não resolve, porque o problema não é o valor.

### U13 — "Executado" e "concluído" viram a mesma coisa (2026-08-20)

Regra **R19**, ditada assim: *"EXECUTADO e CONCLUIDO é a mesma coisa!!"*.

**Migration** `20260820100000_u13_executado_vira_concluido.sql`. **Vai junto com
o deploy** — o app velho ainda escreve `executado`, que o CHECK novo recusa.

**O que se perderia, e por que não se perde.** `executado` era o portão da
conferência: o técnico entregava, o chamado ficava executado, e o gestor
conferia antes de fechar. Fundindo os dois, a fila "A conferir" deveria sumir
junto.

Ela não some, porque o portão nunca dependeu do status. Quem manda na
conferência é `faturamento_status`, e a U0 tomou essa decisão de propósito — o
comentário dela ainda está lá: *"Deliberadamente FORA do CHECK de status: o
ciclo de campo não pode depender do financeiro"*. A fila passa a ser
`natureza='campo' AND status='concluido' AND faturamento_status='a_analisar'`,
que é **mais fiel** que o estado era: um chamado sem nada a cobrar não deveria
estar na fila de conferência, e antes estava.

**O que muda de comportamento, dito com todas as letras:** quando o técnico
encerra o atendimento, o chamado já fica concluído. Some o estado intermediário
em que o trabalho está feito e o registro está aberto.

Cuidados da migration: os triggers são silenciados durante a conversão (senão
cada chamado ganharia um evento "executado → concluido" e cada responsável uma
notificação de "Chamado concluído" sobre trabalho entregue há semanas), e
`concluida_em` herda `finalizada_em` em vez de `now()` — carimbar hoje diria que
tudo foi concluído hoje.

O `notify_chamado` perdeu o aviso de "executado, confira" e ganhou um de
"concluído, aguardando análise de cobrança" para quem responde pelo financeiro.

### U14 — O quadro deixa de espelhar o vocabulário (2026-08-20)

Regra **R20**: *"Remova o status cancelado do KanBan na Home. Remova o status
agendado da visualização do Kanban."*

Cinco colunas no lugar de oito: **Aguardando início · Em andamento · Stand-by ·
Aguardando aprovação · Concluído**.

`COLUNAS` deixou de ser `STATUS_ORDEM` — e essa separação é o ponto. O
vocabulário é do domínio; o quadro é uma leitura dele. `colunaVisivel()` faz a
tradução: `agendado` cai em "Aguardando início" (com hora marcada ou sem, o
chamado continua esperando para começar — duas colunas diziam a mesma coisa, e
a hora segue no card), e `cancelado` não tem coluna, porque trabalho cancelado
não é fila de trabalho.

Nenhum dos dois some calado: o quadro imprime *"N cancelados — veja na lista, em
Encerrados"* no rodapé do trilho.

### Pendências da U12 fechadas (2026-08-20)

Nove dos doze itens de `docs/PENDENCIAS_TECNICAS.md` foram corrigidos, entre
eles o crítico:

- **P1** — o popover do filtro era pintado **atrás da BottomNav** porque
  `#root, main, header, nav { z-index: 1 }` faz do `<main>` um contexto de
  empilhamento; no celular, tocar na última opção navegava para outra tela.
  Resolvido com `createPortal` para o `body` — subir o z-index não resolveria,
  o problema nunca foi o valor. A mesma mudança fechou o **P3**: agora o menu
  vira para cima quando não cabe embaixo e limita a altura ao espaço da janela.
- **P2/P6** — a roda do mouse andava 3px por clique no Firefox (`deltaMode` em
  linhas, não pixels) e fazia a coisa errada com o cursor sobre o cabeçalho da
  coluna (`closest` não acha um irmão).
- **P4** — `prefers-reduced-motion` congelava os spinners de carregamento. Um
  spinner parado lê como "travou".
- **P5, P8, P10, P11, P12** — "Em aberto" nunca aparecia marcada; a barra de
  filtros se rearranjava a cada escolha; o aviso "Mostrando 60 de N" virava
  célula da grade; o foco por teclado deformava botões arredondados; `Esc`
  largava o foco no `body`.

Ficaram **P7** (vínculo implícito do preset) e **P9** (inércia do trackpad),
os dois ainda por confirmar.

### U15 — Reforma visual v2: paleta Supernova, sidebar e fundo com glow (2026-08-20)

Pedido: sidebar no lugar da barra inferior no desktop, paleta nova em tokens
W3C (quatro escalas nomeadas), logotipo novo, alternador de tema do Uiverse, e
fundo em degradê com glow por tema. **Só código — nenhuma migration.**

**Paleta.** `src/lib/paleta.ts` guarda as quatro escalas completas — Supernova
(primária), Shamrock (sucesso), Christine (aviso), Flush Mahogany (erro) — e a
regra de tema que vale para todas: tom 300–400 no escuro, 600–700 no claro.
A migração foi um sweep mecânico de 69 arquivos (14 pares de hex + 19 de rgba),
conferido por grep de resíduo: zero hex antigo sobrando. Azuis e violetas
(agendado, em andamento, pedido de compra) não estão nas escalas fornecidas e
ficaram como estavam, registrados no DESIGN_SYSTEM §2.

**Sidebar (≥1024px).** `SideNav.tsx`, 232px: logotipo, itens, alternador de
tema e cartão de perfil. A barra inferior continua no celular. As duas leem a
MESMA lista (`nav-itens.ts`) e a mesma matriz de permissões — antes de extrair,
cada uma teria a sua cópia e a primeira mudança de menu as faria divergir. A
troca desktop×celular é por CSS (`.so-desktop`/`.so-celular`), não por JS.
O deslocamento é a variável `--rail`; a sangria `.sangra-x` compensa
`var(--rail)/2`, com a conta verificada em 1024/1280/1440/1920.

**Fundo.** `GlowBackground.tsx` substitui os TRÊS fundos autenticados da v1
(constelação canvas na Início, datacenter SVG nas demais, claro próprio) por um
degradê com glow por tema. Os animados custavam bateria no celular do técnico.
Login e redefinição de senha mantiveram os fundos antigos — identidade própria,
trocar é decisão à parte.

**Logotipo.** `LogoPrever.tsx` é RECRIAÇÃO vetorial do escudo novo (o original
chegou como imagem) — se o vetor oficial existir, troca-se o conteúdo do
componente e todos os usos acompanham. Supernova 400 no escuro, 600 no claro.

**Toggle.** `ThemeToggle.tsx` adapta o Uiverse do Davi: pílula Light/Dark com
botão deslizante + sol/lua com crescente animado. O mockup de celular em volta
ficou de fora; o sol usa Supernova em vez do rosa-laranja original; virou
`<button role="switch">` de verdade em vez de checkbox escondido.

**DESIGN_SYSTEM.md** atualizado para v2: §1 (identidade + logotipo), §2.1 (as
quatro escalas com tabela completa e tom-chave), §5 (fundos glow), §5b
(navegação sidebar×barra). Os hexes v1 que apareciam em exemplos foram varridos
para os equivalentes v2.

### U16 — Ajustes do layout desktop e campo de busca (2026-08-20)

Pedidos pontuais depois de ver a v2 no ar:

**Alinhamento.** Faixa superior e barra de filtros ganharam a mesma `.sangra-x`
do quadro. Antes o quadro sangrava até a borda e os controles começavam onde o
`<main>` começa — os dois nunca se alinhavam. Agora título e filtros nascem na
coluna da primeira coluna do quadro, e a busca encosta na margem da última.

**Banner da fachada → cabeçalho da sidebar.** Saiu do topo da Home, onde comia
210px da dobra (o espaço onde o trabalho aparece), e virou o cabeçalho do menu:
sangra até as bordas da sidebar e escurece embaixo para o logotipo pousar sobre
ele. No **celular** o banner continua na Home, com a frase "Você tem X
atividades hoje" — lá não há sidebar para carregá-la.

**Logotipo oficial.** `public/logo-grupo-prever.png` é o arquivo entregue, sem
modificação. A recriação vetorial da U15 foi descartada.

**"Você tem X hoje" fora do desktop**, com o subtexto. A faixa superior abre
com um título simples e a busca à direita; o meio fica livre de propósito, para
o Davi definir o que entra.

**Campo de busca** (`CampoBusca.tsx`), adaptado do Uiverse de Gautammsharma.
Três desvios do original, e o porquê de cada um: a paleta verde virou a da marca
(verde é *sucesso* no nosso sistema — usá-lo numa busca diria algo que não é
verdade); a div borrada de sombra virou `box-shadow` no container (mesmo halo,
sem elemento extra nem `filter: blur`, que força camada de composição); e o tema
escuro ganhou tratamento próprio, porque o original é claro-only e a pílula
branca sobre preto fica estridente. No desktop mora na faixa superior; no
celular continua abrindo pela lupa, onde não há largura para os dois.

### U17 — Quadro de página única, gráficos da faixa superior e alinhamentos (2026-08-20)

Pedidos sobre o desenho anotado do Davi (quadrado vermelho e azul no print):

**Quadrado vermelho — filtros na margem do quadro.** A causa era uma briga de
CSS: `.barra-filtros` declarava as próprias margens de celular e, por vir
depois no arquivo, vencia a `.sangra-x` no desktop — os filtros nasciam na
margem do `<main>` e o quadro na da tela. As margens saíram da `.barra-filtros`;
a sangria manda nos dois breakpoints.

**Quadrado azul — busca desce para a barra de filtros.** A busca saiu da faixa
superior e mora no fim da barra, com os botões (alternador de visão) à esquerda
dela, encostada na margem direita do quadro.

**Quadro vira página única.** Reversão consciente da decisão da U10 (altura
fixa + rolagem por coluna): *"o kanban seja tudo uma página só — se o usuário
scrolla para baixo, a página toda desce"*. A coluna cresce até o conteúdo e
quem rola é a página. O handler de roda saiu inteiro — e com ele as pendências
P2, P6 e P9 ficaram **sem objeto** (a normalização de deltaMode do Firefox, a
delegação por coluna e a inércia do trackpad só existiam por causa dele). O
teto de 25 + "ver mais" por coluna continua: nada some.

**Gráficos da faixa superior** (`Graficos.tsx`, desktop):

1. *Entregas por semana* — semana atual + 4, semanas de segunda a domingo
   (mesma régua de `lib/periodos`, a do financeiro). Cada **pedaço arredondado
   é UM chamado** (referência Nixtio), na cor do status — vermelho quando o
   prazo estourou — e clicável: abre o chamado. Teto de 10 pedaços por semana
   com "+N". Entram as atividades em aberto com prazo.
2. *Meta do mês* — rosca com % das prioridades do mês concluídas. O mapeamento
   da reunião de alinhamento JÁ EXISTE no sistema: é o sprint `este_mes` dos
   chamados internos. A rosca é pessoal (conta o que é do usuário logado) e
   consulta o banco à parte de propósito: a Home poda encerrados com mais de
   7 dias, e uma meta mensal que esquece o que foi concluído no início do mês
   estaria sempre errada na última semana. Verde quando bate 100%.

Nenhuma migration.

### U18 — Painel superior completo da Início (2026-08-20)

Sobre o segundo desenho anotado do Davi (rosa, azul-claro, vermelho, verdes e
amarelo), com as três cartelas de dataviz anexadas.

**Cartelas** viraram `DATAVIZ` em `paleta.ts` — separadas das escalas de status
de propósito: gráfico fala de DADOS, chip fala de ESTADO. Misturar os
vocabulários faria o quadro e os gráficos parecerem discordar. Papéis: frio
(#547792/#1A3263), âmbar (#FAB95B/#E4B028), alerta (#E63946/#8B1E2D), azul
(#457B9D), vinho (#8B1E2D). Reserva registrada no comentário.

**Rosa — Prazos futuros.** Cada pedaço arredondado é UM chamado com o título
DENTRO (o "algo que indique qual task é"): pílula neutra com borda esquerda
colorida e texto truncado. A cor é pressão de tempo, não status — vermelho
atrasada, âmbar vence nesta semana, frio adiante — com legenda de três pontos
no cabeçalho. Clicar abre o chamado.

**Vermelho — Meta do mês** mudou para o meio, rosca minimalista em âmbar
(azul ao bater 100%), sem o parágrafo explicativo da versão anterior.

**Verdes — 4 indicadores** em tiles 2×2: Concluídas no mês e Faltam no mês
(numerador e resto da mesma consulta da meta — % na rosca, absolutos nos
tiles), Corretivas urgentes em aberto, e o quarto ficou por minha conta:
**Atrasadas em aberto** — é o número que decide o começo do dia de quem
coordena. Número neutro grande + ponto colorido da cartela; minimalista.

**Amarelo — Notificações recentes.** As 4 últimas, compactas, com ponto âmbar
nas não lidas e tempo relativo. Clicar marca como lida e abre o chamado ou a
visita. Realtime de graça: o `useNotificacoes` do sino já assina
`postgres_changes` e a tabela está na publicação desde junho — nenhum canal
novo foi criado.

**Azul-claro — o título desceu.** "Suas atividades" saiu do topo e virou o
cabeçalho da área de trabalho, logo acima dos filtros, como no desenho.

Nenhuma migration.

### U19 — Vidro sobre o Yellow Glow, avatares e header enxuto (2026-08-20)

Sobre o terceiro desenho anotado (dois ícones em vermelho) e as referências
Versa UI anexadas. **Nenhuma migration.**

**Fundo importado do claude.design.** O projeto `5e4850a6` ("Yellow Glow
Background") foi lido pelo MCP de design e traduzido de DC para React puro em
`GlowBackground.tsx`: palco oklch quente, duas manchas de luz derivando em 34s
com blur de 80px, grade de 40px mascarada e granulado em overlay. O tema claro
é derivação (o arquivo é escuro). A animação respeita `prefers-reduced-motion`
pela regra global.

**Header removido no desktop.** Os dois itens marcados — chip de perfil e sino
— saíram: o perfil já mora na sidebar e as notificações no painel da Início. O
header virou `.so-celular` e o conteúdo subiu (`--topo`: 76px no celular, 24px
no desktop). Consequência assumida: nas OUTRAS telas do desktop não há sino;
as notificações chegam pela Início.

**Vidro (v3).** A regra v1 "nunca glassy" foi invertida por decisão do Davi:
`card()` do ui.ts, cards de atividade, colunas do quadro, gráficos, sidebar,
popover de filtro e campo de busca viraram superfícies translúcidas com
`backdrop-filter: var(--vidro-blur)`. A variável desliga o desfoque no celular
— blur é caro na GPU de quem está em campo — e lá fica a superfície semiopaca.

**Cards ao estilo Versa.** A categoria (tipo) virou chip colorido
(`TIPO_CORES`), a visita ganhou chip azul de dataviz, e o rodapé do card tem a
**pilha de avatares dos participantes** (responsável + apoios, sobrepostos,
`AvatarPilha.tsx` — foto quando há, iniciais no degradê da marca quando não,
"+N" quando não cabem). Os apoios de todos os chamados vêm numa consulta única
(`chamado_apoios` inteira, tabela de centenas de linhas com leitura aberta) —
mais barato que um `.in()` com centenas de ids na URL.

`participantes` entrou no modelo de Atividade; a prop `responsavelNome` do
card morreu em favor do mapa completo de pessoas (nome + avatar).

### U20 — Header cumprido de verdade, sino na sidebar e criação rápida por IA (2026-08-20)

**O pedido descumprido tinha causa técnica, não esquecimento.** Na U19 o header
ganhou `.so-celular`, mas ele tem `display: flex` INLINE — e estilo inline
vence classe. O header continuou aparecendo no desktop. As classes de
visibilidade (`.so-desktop`/`.so-celular`) agora carregam `!important`, com o
porquê comentado no CSS: elas têm que ganhar de qualquer inline. Perfil e sino
agora existem SÓ no menu lateral, como pedido.

**Sino na sidebar** (`NotificacoesSidebar.tsx`): linha com badge de não lidas
acima do alternador de tema; o painel abre em portal AO LADO do rail (dentro,
os 232px cortariam a lista — mesma lição do P1). Lista completa, "marcar todas
lidas", clique abre o chamado/visita. Realtime herdado do hook do sino.

**A caixa de notificações do painel superior morreu** — o Davi não gostou — e
no lugar entrou a **criação rápida por IA** (`CriarRapido.tsx`), adaptada do
Uiverse (Cobp): pílula de texto + anexos + botão de envio que cresce do nada
quando há texto. O modo de voz do original ficou de fora (o pedido foi texto e
arquivo); o degradê roxo virou o da marca.

**A IA interpreta, não cria** (`chamado-rapido.functions.ts`, espelho do padrão
de contrato.functions): devolve natureza, tipo, título, descrição, prioridade,
equipe e cliente citado via json_schema (claude-sonnet-5 — triagem de um
parágrafo não precisa do modelo grande). Quem cria é o `abrirChamado()` de
sempre, no cliente — mesmos triggers, mesmas policies, nenhum segundo caminho
de escrita. O cliente citado vai para a descrição: casar nome livre com
cadastro é decisão humana. Anexos sobem como fotos do chamado criado, e a
navegação leva ao chamado para a pessoa conferir a interpretação.

Nenhuma migration.

### U21 — Demanda no tempo, KPIs limpos, cards vermelhos e kanban arrastável (2026-08-20)

**Números CH- fora dos cards.** O subtítulo saiu do card da Início e da lista
/chamados; o número segue indexado na busca — só saiu da vista.

**O gráfico virou "Demanda no tempo".** Últimas 4 semanas (concluídos por
semana) + próximas 4 (com prazo na semana). Minimalista por ordem expressa:
título, primeiro dia de cada semana e a quantidade — os textos por task, a
legenda e o subtítulo morreram. As cores contam a história com as cartelas:
o passado esfria do azul ao verde (feito), o futuro esquenta do vermelho
(semana atual) ao amarelo (adiante). Os concluídos vêm de consulta própria —
a Home poda encerrados com mais de 7 dias e as barras precisam de 4 semanas.

**Meta sem legenda; KPIs sem bolinha** — número grande, centralizado, e a cor
mora NELE.

**Card atrasado = fundo vermelho inteiro** (translúcido, para seguir vidro).

**Kanban arrastável.** Soltar um card noutra coluna muda o status. A divisão de
responsabilidade: a tela valida o vocabulário da natureza (interno não vira
"agendado" etc.); o BANCO faz o resto — o trigger `chamado_preencher` carimba
iniciada_em/concluida_em na transição, e a RLS pode recusar (técnico não
conclui chamado de campo), recusa que vira toast e refetch. Quem não arrasta,
e por quê: **visita** (o status dela é outro vocabulário — arrastar mentiria) e
**pedido de compra** (a coluna dele deriva da situação da compra, que anda pela
ficha e pela RPC de decisão). HTML5 DnD não dispara em toque: no celular o
quadro segue de leitura e mover é pela página do chamado.

Nenhuma migration.

### U22 — Redesign v4: minimalismo apple-like (2026-08-20)

Reforma sobre as diretrizes de minimalismo que o Davi colou. **Nenhuma
migration.** Publicado sem revisão adversarial a pedido ("não gaste créditos
revisando — progrida e suba").

- **Tipografia**: UMA família, a da plataforma (SF/Segoe/Roboto via
  `--fonte`), trocada em 56+ arquivos num sweep; peso 300 virou 400 (o thin do
  Montserrat não existe bem em SF); o webfont do Google saiu do `__root` — a
  página não baixa mais fonte nenhuma.
- **Fundo**: degradê de preto (escuro) e de tons de branco (claro), puros. O
  Yellow Glow (manchas/grade/granulado) saiu — fundo é silêncio, profundidade
  vem de sombra e vidro.
- **Superfícies**: `card()` virou NEO-MINIMAL — sólido, canto 18, sombra leve
  em duas camadas. `vidro()` novo, reservado aos PAINÉIS: os dois gráficos,
  sidebar e popovers. Racional dado ao Davi: vidro em tudo sobre fundo liso é
  ruído; em pontos escolhidos é hierarquia de material.
- **Card de atividade**: sólido, ponto de status no título no lugar da borda
  lateral colorida, chips sem borda (só tinta), atrasado segue vermelho
  (agora em tom mais contido).
- **Kanban**: as colunas perderam a caixa — cards flutuam no fundo, coluna é
  cabeçalho + pilha ("whitespace no lugar de divisores"). O alvo do arrasto é
  um banho dourado leve.
- **Hover em tudo** (`.elevavel`, `.hover-suave`, `.barra-demanda`,
  `.kpi-tile`, `.rosca-meta`): cards levantam 2px com sombra maior, barras do
  gráfico crescem e clareiam com tooltip nativo, número do KPI escala, rosca
  escala, itens de menu/notificação/opção ganham fundo — tudo atrás de
  `(hover:hover) and (pointer:fine)`, porque no toque hover é fantasma.

### U23 — Design v5→v7: o degradê da casa (2026-08-20)

Três iterações de cor guiadas pelo Davi, encerradas na v7:

- **v5/v5.1**: PRISMA (paleta nomeada) + faixa de prazo pintando o fundo dos
  cards (amarelo esta semana, azul adiante, vermelho atraso; corte no FIM da
  semana corrente, não "7 dias") + rampa majoritariamente amarela.
- **v6**: composição fixa do degradê — 20% azul · 40% amarelo · 20% laranja ·
  20% vermelho, terminando no vermelho dos botões. Montserrat em 4 pesos.
  Avatares sem foto em 4 degradês da rampa, por hash (estável por pessoa).
- **v7**: a faixa amarela ancorada nos TRÊS amarelos do botão da marca
  (SUPERNOVA 300/400/500, literais nas paradas). Tema claro muito mais claro,
  com o miolo amarelo travado em ≥3:1. Barras do gráfico invertidas (vermelho
  no passado, azul no futuro — a leitura dos cards). KPIs Bold 700 com glow na
  própria cor. Campo "Abrir chamado": único painel com o degradê no fundo,
  brilho fixo, hover que expande (não acende), canto por clip-path — camada
  com blur é promovida a GPU e escapa do overflow:hidden.
- **Auditoria (workflow, 19 agentes)**: 23 achados confirmados aplicados —
  inclusive uma edição minha que falhou em silêncio (KPI) e a barra da emenda
  renderizando verde (ganhou a COSTURA como parada do meio). Telas legadas com
  amarelos avulsos viraram P13.

### U24 — Clientes: base oficial, página nova e o mapa do município (2026-08-20)

O Davi entregou a planilha definitiva (192 clientes, CNPJ/CPF + endereço +
posto) e pediu: Clientes no menu lateral (admin, comercial e SAC), lista no
padrão de design e um mapa do município de São Paulo com um mini ícone por
cliente, nas cores do degradê.

**Banco (migration `20260820150000_u24_base_clientes.sql` — RODAR NO EDITOR):**
- Colunas novas: `cep`, `cidade`, `uf`, `posto_servico`.
- Os 192 casados por nome normalizado OU documento; casados atualizados e
  marcados ativos; ausentes inseridos; ativos fora da planilha rebaixados a
  inativo com auditoria em `clientes_rebaixados_u24` (padrão U8, reversível).
- Latitude/longitude no nível do CEP para TODOS os 192 (AwesomeAPI → Nominatim
  → ViaCEP+bairro; 171/171 CEPs resolvidos; o CEP 04802-000 veio do vizinho
  04802-120 porque "Socorro, São Paulo" no Nominatim é a CIDADE de Socorro).
  `COALESCE` preserva coordenada já apurada em campo.
- Permissões: `clientes*` sai do técnico (semente efetiva = U11 + U24; o
  verificador compõe as duas).

**App:**
- `mapa-sp.ts`: malha IBGE do município (1157→603 pontos, Douglas-Peucker) em
  SVG próprio — sem tile de terceiro; o traço do contorno percorre o degradê.
  `dentroDoMapa` é ponto-no-polígono de verdade: Osasco cai dentro da CAIXA e
  fora do contorno, e a primeira versão (caixa) deixaria pontos flutuando fora
  do desenho — asserção pegou antes do commit.
- `MapaClientes.tsx`: pontos na cor do degradê por hash do id (`corDoCliente`)
  — a MESMA cor do ponto do card na lista; tooltip próprio; clique navega;
  rodapé com "fora da capital" por cidade e contagem de sem-coordenada.
- `clientes.tsx` reescrita no v7: lista + mapa lado a lado no desktop (mapa
  sticky — é o índice visual da lista), filtro filtra os dois, busca inclui
  cidade e posto. Celular: mapa primeiro, volta por Gerencial.
- Menu lateral: item Clientes (admin/comercial/sac), `soDesktop` — a barra
  inferior do celular segue com 5 itens e o caminho móvel continua Gerencial.

Pendente de design (não bloqueia): `/clientes/$id`, `/clientes/novo` e
`/clientes/migrar` continuam no visual antigo — reforma na fila com as demais
telas legadas (P13).

### S1 — Blindagem de segurança (2026-08-20)

O sistema passou a guardar dado pessoal real (192 clientes, CNPJ e 9 CPF de
pessoa física), e a RLS deixou de ser detalhe. Auditoria em leque de 5 frentes,
23 achados confirmados por verificação adversarial.

**Modelo de ameaça que orienta tudo:** todo usuário fala DIRETO com o Postgres
usando a mesma chave pública. A RLS é o perímetro — "a tela não mostra" nunca
foi proteção.

- **Crítico:** `clientes` tinha `SELECT USING (true)`. Qualquer autenticado lia
  a base inteira. Agora gestor vê tudo; técnico vê só o cliente do chamado ou
  da visita dele (`pode_ver_cliente`).
- **Alto:** o SAC podia editar e apagar qualquer cliente — a etapa1 escreveu
  `is_gestor` pensando em admin+comercial e a U6a ampliou a função três dias
  depois, sem ninguém revisitar. Agora `pode_gerir_clientes`/`e_admin`, com o
  papel dito por extenso e lendo as DUAS fontes (user_roles + profiles.cargo).
- **Alto:** XSS armazenado no popup do mapa de visitas (nome de cliente cru em
  `innerHTML` do Leaflet, com a sessão no localStorage). Escapado.
- Buckets de foto viraram privados; apagar foto exige dono ou gestor. Escrita
  em chamado sem responsável passou a exigir vínculo (`pode_editar_chamado`).
  `funil_comercial` passou a exigir gestor, com a assinatura preservada.

**Migrations:** `20260820170000_s1_blindagem_rls.sql` + `..180000_s1b`.

**Três erros meus nesta etapa, e o que cada um ensinou:**
1. **Cadeia do inventário** — supus que as três tabelas tivessem `cliente_id`;
   só a primeira tem. O pior não foi o erro de SQL: era um `FOREACH` com
   `IF EXISTS (coluna)` que PULARIA `cliente_equipamentos` em silêncio,
   deixando-a aberta. Numa migration de segurança, pular calado é pior que
   falhar. Reescrito tabela a tabela, sem laço.
2. **REVOKE de coluna** — ferramenta errada no Supabase: todo logado é o mesmo
   role `authenticated`, então o REVOKE atinge o admin junto E quebra qualquer
   `select *`. Desfeito pela S1b.
3. **Cabeçalhos HTTP (CSP)** — derrubaram o app. Ver S10 nas pendências.

### S2 — App fora do ar: três causas, uma raiz (2026-08-20)

O app caiu depois da S1 e eu persegui dois suspeitos errados antes de achar o
certo. Vale registrar porque a raiz é de método.

- **Suspeito 1 (errado):** a CSP. Era real que `script-src 'self'` derrubava o
  SSR — o TanStack injeta o estado de hidratação num `<script>` inline —, mas
  não era a causa daquele momento. Revertida (S10).
- **Suspeito 2 (errado):** os REVOKE de coluna. Também reais, também não era.
- **Causa real:** eu tinha removido o `.env` do repositório "por higiene". O
  Lovable **builda a partir do repo**; sem ele, o Vite não acha
  `VITE_SUPABASE_*` e `client.ts` LANÇA ao criar o cliente. Explicava os dois
  sintomas que não fechavam: erro no desktop (throw dentro de rota) e tela
  preta no celular (throw antes de pintar).

**Por que demorei:** o `.env` local continuava no disco, então dev e build
passavam aqui. Eu testava um ambiente que tinha a variável e diagnosticava um
que não tinha. As três mudanças viajaram no mesmo commit; o que elas tinham em
comum era só a data.

**Regra que fica:** `.env` versionado é DE PROPÓSITO neste projeto (S11), com o
motivo escrito no `.gitignore` e travado por asserção nos dois sentidos — não
pode ser ignorado, e segredo de verdade não pode entrar nele.

### U25 — O mapa de clientes, em quatro versões (2026-08-20)

Cada versão foi rejeitada por um motivo diferente, e o caminho importa:

1. **Silhueta do município** — não era um mapa. Sem nada dentro, os pontos
   flutuavam sem referência.
2. **Leaflet com tiles** — virava mapa de verdade, mas trazia o desenho de
   outra casa para dentro do painel.
3. **94 distritos desenhados** — o meio-termo, a partir de um exemplo que o
   Davi mandou. Dá referência sem importar design de fora.
4. **47 distritos** — três rodadas de recorte pedidas por ele (sul rural, o
   contorno que desenhou na tela, e dois blocos por nome).

**Fonte:** OpenStreetMap via Overpass (`admin_level=9`). O IBGE não serve — a
API de malhas recusa `intrarregiao` para município e a de distrito dá 404.

**Regra de segurança do recorte:** cada rodada foi conferida contra os dados
ANTES de aplicar. Nas duas primeiras, só saiu distrito com zero clientes. Na
terceira o Davi destravou ("some um na contagem abaixo do mapa"), e dois
clientes passaram a contar no rodapé — BSGA (Penha) e Maria Domitila (Casa
Verde). A asserção foi REESCRITA para exigir esse conjunto exato, não relaxada.

**Correções de grafia conferidas, não adivinhadas:** "Pemba" → Penha;
"Jaguará" → Jaguara (sem acento na base; não é Jaguaré, que é outro distrito).

**Bug que valeu a lição:** o mapa não aparecia porque a cadeia de altura não
fechava em lugar nenhum — grid com `align-items: start`, card sem altura,
faixa pedindo `flex: 1`, svg pedindo `height: 100%`. Três camadas passando a
conta para cima. Resolvido com altura explícita.

### U26 — Margens de Clientes e sidebar recolhível (2026-08-20)

**Margens:** a causa não era padding. Clientes vivia presa ao teto de 1280px do
`<main>`, enquanto a Início usa `.sangra-x` nas linhas largas para escapar dele
e alcançar a régua da sidebar e a borda da janela. Clientes passou a usar a
MESMA classe — não uma imitação.

**Sidebar recolhível:** 232px → 72px. O estado mora em
`lib/sidebar-recolhida.ts`, fora do React (`useSyncExternalStore` +
localStorage), porque três consumidores independentes precisam do mesmo valor
sem prop-drilling. Recolher muda **uma** coisa: o `--rail` que o CSS lê. Todo o
layout reage sozinho porque já dependia dessa variável.

### U27/U28 — Prospecção e os três painéis (2026-08-21)

**U27 — Prospecção (R21–R23).** Prospecto saiu de `clientes`: tabela própria
(`prospeccoes`), porque o Sincronizar vai fazer upsert em `clientes` e
apagaria a prospecção junto. As PROPOSTAS não viraram tabela nova — já viviam
na visita desde a U8 (`proposta_*`). A visita já era autossuficiente (guarda
prédio, endereço, coordenada, contatos), então desfazer o vínculo não perdeu
nada. CHECK impede a visita apontar para cliente E prospecção (R23). O aceite
parou de escrever em `clientes` e passou a marcar a prospecção — a coluna
`situacao` passaria a ter dois donos, e o sync desfaria o que o app escrevesse.
Criar/consolidar cliente saíram, com a policy de INSERT derrubada (a trava real
não é a tela).

**U28 — Três painéis (R27).** Operacional, Comercial e Administrativo.

Decisões que valem registro:

- **Painel é PORTA, não substituto.** Números do estado + atalhos; nenhuma tela
  mudou de rota. Isso manteve o custo baixo e o risco perto de zero.
- **Chaves NOVAS, `gerencial` preservada.** `permissoes_tela.tela` é gravada no
  banco; renomear apagaria em silêncio toda permissão que o admin já
  configurou. `gerencial` passou a ser a *lista* de visitas — o que sempre foi
  de fato — e a porta virou `/painel/comercial`.
- **Base compartilhada** (`features/paineis/PainelBase.tsx`): três painéis com
  anatomia própria viram irmãos desiguais na primeira mudança de design.
- **Sem dinheiro na porta do Administrativo.** R13 barra o SAC de ver valores;
  um número grande na entrada vazaria por cima do que as telas de dentro
  respeitam. Os números de lá são de estrutura (gente, aprovação pendente).
- **A barra do celular tem 5 vagas, e isso passou a ser asserção.** Ao entrar o
  Operacional, a do SAC foi para 6. Clientes voltou a ser só-desktop nele —
  possível porque o Painel Operacional tem atalho para Clientes, então o
  caminho no celular continua existindo, com um toque a mais.

Pendente: o Sincronizar com o QAP (S9) segue sendo o que destrava clientes e
equipamentos de verdade; enquanto não existir, a base fica no que a U24 trouxe.

### U29 — A proposta comercial vira um tipo de chamado (R29, 2026-08-21)

**O que já funcionava, e por que ainda faltava.** A visita já aparecia no
Kanban e na lista de chamados — `atividades/modelo.ts` a traduzia. Mas era
cidadã de segunda classe: `numero: null`, `tipo: null`, sem prioridade e sem
equipe. Aparecia junto sem ser igual.

**A técnica é a da U7:** o chamado nasce com o MESMO id da visita. Os nove
satélites de visita (visita_blocos, visita_orcamentos, fotos_visita…)
continuam apontando para o mesmo uuid e nenhuma FK precisou ser reescrita.

**`visitas_tecnicas` não foi desmontada** — virou satélite 1:1 do chamado,
como `chamado_compra` (U9). O fluxo comercial inteiro (/visita/$id, wizards de
orçamento, geração da proposta) continua lendo dela e não mudou uma linha.
Mover as colunas seria a versão arriscada da mesma ideia, sem ganho.

**Vocabulário novo:** natureza `comercial` (o ciclo da proposta não é campo nem
interno — campo tem deslocamento e assinatura, interno tem sprint) e tipo
`proposta_comercial`.

**Trigger de sincronia:** sem ele a capa congelaria no estado da migração — a
visita andaria no funil e o Kanban mostraria a coluna de ontem. A tradução
status-do-funil → coluna é a MESMA de `colunaDaVisita()`; se discordassem, o
card mudaria de lugar ao recarregar a página.

**Segurança:** a capa não pode ser mais frouxa que o corpo. A visita sempre
teve policy estreita (técnico dono ou gestor); se o chamado herdasse a regra
geral — inclusive "responsável nulo é de todos" — a lista de chamados viraria
a porta dos fundos do funil comercial. A policy trata `natureza = 'comercial'`
à parte.

### Regras gravadas na mesma conversa

- **R28** — técnico de campo usa CELULAR; TI, SAC, Controle Patrimonial e
  Gestor usam DESKTOP. A elaborar, gravado para não se perder.
- **R30** — o WhatsApp identifica o remetente pelo nome do contato
  (`"Condomínio Apartamento Nome"`). Resolve a questão que estava em aberto;
  a integração fica para depois, por decisão do Davi.

### U30 — Três telas a menos: R31 e R32 (2026-08-21)

O Davi olhou o sistema depois da U29 e cortou redundância em três golpes:

**1. "APAGUE A PAGINA CHAMADOS" (R31).** Com a proposta dentro do quadro, a
Início e a lista `/chamados` respondiam a mesma pergunta com o mesmo modelo
(`features/atividades`) — e a Início melhor. A lista morreu; `/chamados` virou
**tronco**: o endereço exato redireciona para a Início, as oito filhas
continuam vivas. Os 12 botões "voltar" que apontavam para a lista foram
reapontados (o redirect os seguraria, mas botão que mente o destino é defeito).
A vaga que sobrou na barra do celular devolveu **Clientes** — que só tinha
saído porque a barra estava cheia.

**2. Indicadores de campo NA ENTRADA do Painel Operacional.** "Na tela
principal já deve mostrar todos os indicadores" — e melhores. O cálculo saiu
da tela para `features/paineis/indicadores.ts`, puro e com teste de unidade
real no verificador (o `carregar()` transpila TS — dados de laboratório, não
grep). Indicadores novos, cada um respondendo uma pergunta de gestão:
- **Saldo do mês** (entradas − saídas): a fila cresceu?
- **Dois relógios separados**: mediana até COMEÇAR ≠ mediana EXECUTANDO —
  distingue problema de agenda de problema de execução.
- **Backlog**: idade mediana (resiste a outlier), o mais antigo, encalhados
  há +30 dias.
- **Reincidência**: corretivas do mesmo cliente com <30 dias entre elas —
  conta PARES próximos, não clientes grandes. É o mais perto de "serviço mal
  feito" que dá para medir sem inspeção.
- % no prazo continua só entre quem TINHA prazo — número que se elogia
  sozinho é o pior indicador.
A proposta comercial fica FORA (é funil, não campo — dois relógios diferentes
no mesmo número). De brinde: `chamados.painel` ganhou a guarda de rota que a
chave da matriz prometia e nunca teve.

**3. "Visitas e propostas" É o Painel Comercial (R32).** O painel-índice
duplicava os números da lista e cobrava um clique a mais. `/gerencial` virou a
página do domínio (título novo, funil em cima) e `/painel/comercial` só
redireciona. Os botões que levavam ao domínio administrativo — Contratos,
Fechamentos, Usuários, Permissões, herança do Gerencial-monolito — saíram;
ficaram Prospecção, Mapa, Histórico e Clientes.

**Migração `20260821180000_u30_fusao_de_telas.sql`:** o acesso do SAC ao
painel comercial (U28) segue o painel para `gerencial`, e as linhas órfãs
(`chamados`, `chamados.indicadores`, `painel.comercial`) somem da matriz.
O verificador aprendeu que a semente efetiva também tem DELETE — sem isso a
paridade catálogo↔semente nunca mais fecharia.

367 asserções (30 novas), build ok.

### U31 — Export novo do Notion + etiqueta de cliente (2026-08-21)

O Davi exportou o quadro Administrativo de novo (2347 linhas, 14 colunas,
agora com **Cliente**) e pediu: importar as atividades de cinco pessoas e ver
a etiqueta de cliente no kanban.

**Ensaio antes de gravar.** Rodei o módulo de leitura contra o arquivo real e
achei três coisas que a versão anterior lia errado **em silêncio**:

1. **Datas em português** — "28 de abril de 2025 10:05". O `new Date()` do JS
   devolve Invalid Date; o importador gravava prazo nulo e a atividade entrava
   sem cor de faixa, sem urgência, no fim de qualquer ordenação. (E o parser
   americano tem de ficar por último: `new Date('12/03/2026')` é 3 de
   dezembro — dia e mês trocariam de lugar sem ninguém ver.)
2. **Três status novos** — "Aguardando terceiros", "Aguardando material",
   "Planejado". Sem mapa, os 15 primeiros caíam em "aberto": tarefas PARADAS
   esperando gente de fora apareceriam como trabalho disponível para hoje.
3. **A chave de reimportação colapsava.** `título+prazo` produzia 1883 chaves
   para 2099 linhas — **216 atividades seriam descartadas como falsas
   duplicatas**. O quadro repete títulos de propósito ("Verificar zonas"
   existe para vários prédios) e a maioria não tem prazo. Troquei por
   **criação + título**: 2097 chaves para 2099 linhas, e a data de criação não
   muda entre exports, que é a outra metade do requisito.

**Cliente: casar sem adivinhar.** Três vias — nome igual (893), apelido (967)
e contenção sem ambiguidade (88). O apelido decisivo veio do Davi: **"Prever"
no Notion é o cliente "Especializados" no QAP** — sozinho, 1143 atividades.
A contenção só vale com **um** candidato: "Mirant" está contido em dois
prédios diferentes, e escolher um seria pendurar trabalho no endereço errado.
Resultado: 1948 com vínculo real, 149 guardando só o nome.

**A coluna `cliente_origem_nome` (U31)** existe por causa desses 149: sem ela
a etiqueta sumiria justamente nas atividades cujo nome o Davi escreveu à mão.
O vínculo do QAP vence o texto quando existe — ele é o cliente de verdade.

**Pular quem não tem conta é decisão de produto.** 247 linhas de Maria Souza e
Rubia Cristina ficaram de fora. Importá-las sem responsável as jogaria na fila
de todo mundo — "chamado sem responsável é de todos" é regra viva aqui. Elas
entram no dia em que as duas tiverem conta, e a prévia diz isso com nome e
quantidade.

**A etiqueta virou chip.** Era texto secundário e sumia entre os chips
coloridos ao lado; no quadro, "de qual prédio é isto?" é a segunda pergunta
depois de "o que é isto?".

Resultado do ensaio: **2099 atividades importáveis, 100 em aberto** (Erik 37,
Davi 26, Gilleno 14, Nicholas 13, Vinicius 10). 441 asserções, build ok.

### U32 — Painel de propriedades e o calendário que estava vazio (2026-08-21)

**O painel (R33).** Clicar num cartão passou a deslizar um painel pela direita
com as propriedades editáveis: cliente, responsável, apoio, tipo, status,
prioridade, equipe, sprint, prazo, agendamento, título e descrição. Salva campo
a campo — cada um com o próprio selo de salvando/salvo/erro, e o erro traz o
código PRV-… do sistema de erros (U31), então RLS negando aparece como
`PRV-INI-PERM-42501` em vez de "não deu certo". Teto de 60% da tela por pedido
do Davi; piso de 340px porque 60% de um celular são 230px e nenhum campo seria
legível.

**Dois defeitos meus, pegos antes de publicar:**

1. Os subcomponentes de formulário estavam declarados **dentro** do componente
   pai. A cada render eles ganham identidade nova, o React desmonta e remonta —
   e o texto sendo digitado sumiria no meio da frase assim que qualquer consulta
   de fundo voltasse. Hoistados para o módulo, com asserção nos dois sentidos.
2. O campo de agendamento usava `toISOString().slice(0,16)`, que devolve **UTC**:
   a visita das 9h apareceria como 12h. Três horas de diferença que ninguém
   repara até alguém perder a hora.

**O calendário estava vazio por um motivo concreto (R34).** A consulta pedia
`chamados.tecnico_id` — coluna que deixou de existir na fusão U7, quando virou
`responsavel_id`. O PostgREST respondia **42703**, a consulta inteira falhava e
a lista voltava vazia: nenhum chamado jamais apareceu ali, só visitas. O erro
morria dentro do react-query. Confirmei contra o banco antes de afirmar — e com
o sistema de erros da U31 isso hoje apareceria como `PRV-CAL-ESQM-42703`.

**A segunda causa:** só entrava quem tinha `data_hora_agendada`. As 2100
atividades que vieram do Notion não têm hora marcada — o que elas têm é
**prazo**. Um calendário que ignora prazo mostra a agenda de campo e finge que
o resto do trabalho não tem data. Agora cada item entra pela data que de fato o
coloca num dia, e a célula distingue as duas (hora × "vence").

O filtro `or(...)` que junta os dois caminhos foi **testado contra o banco**,
com controle negativo para provar que o teste tinha dentes (coluna inventada →
400/42703; a consulta real → 200).

Grade em tela cheia (`100dvh`, não `vh` — a barra do navegador do celular
esconderia a última semana), título e pilha de avatares em cada item, e o
clique abre o mesmo painel da Início.

475 asserções, build ok.

### U33 — Painéis que respondem ao filtro, tabela e o painel redesenhado (2026-08-21)

**O problema real (R35).** Os painéis do topo da Início não respondiam aos
filtros do quadro — e não era só questão de passar outro array: metade deles
**consultava o banco por conta própria** (`useConcluidosPorSemana`,
`useMetaDoMes`), trazendo números prontos que filtro nenhum tem como recortar.
O resultado era um painel dizendo "42" enquanto o quadro logo abaixo, filtrado,
mostrava 6.

A saída foi inverter a direção: as contas passaram a sair das ATIVIDADES, e
quem monta o recorte é a Início. Para isso o modelo ganhou `encerradoEm` (a
data em que a atividade saiu da fila) — conta que já existia solta na Home para
podar encerrados velhos, duplicada, e que o gráfico precisava idêntica.

Duas decisões dentro disso:
- **O histórico entra** (`useHistoricoAmplo`): o quadro poda encerrados com
  mais de 7 dias, mas quatro semanas de barras e a meta do mês precisam de mais.
- **O filtro de PERÍODO não se aplica** ao painel. O gráfico já é um eixo de
  tempo; "hoje" deixaria uma barra em pé e sete zeradas.

**Dois defeitos meus, medidos antes de publicar:**

1. `useHistoricoAmplo` filtrava por `updated_at`. Mas a importação do Notion
   grava 2000 concluídas de uma vez, todas com `updated_at` = hoje — a consulta
   traria as 2000, passando do teto de linhas do PostgREST, que **trunca em
   silêncio**. Gráficos errados sem nenhum sinal de erro. Passou a filtrar pela
   data de encerramento, com `.limit()` explícito como rede.
2. `metaDoMes` contava pela etiqueta de sprint. Medido no export: **7
   atividades marcadas "este mês" tinham sido concluídas em junho e julho** —
   a meta comemoraria trabalho de dois meses atrás. Agora a etiqueta diz a
   intenção e a data diz o fato.

**A tabela (R36).** A visão de lista virou tabela de nove colunas, com
cabeçalho grudado, ordenação por coluna e rolagem contida no próprio envelope
(a página nunca rola de lado). "Apoio" é participantes menos o responsável;
"Equipe" fica vazia em campo, por invariante do modelo — e o traço diz isso
sem mentir.

**O painel redesenhado.** O Davi mandou um print: dez caixas cinzas idênticas,
rótulos de 9,5px. Um formulário trata todo campo como igualmente importante, e
eles não são. O título virou o cabeçalho (grande, editável no lugar); status,
tipo e prioridade viraram **etiquetas nas mesmas cores dos cards do quadro** —
cor como vocabulário compartilhado, não enfeite; rótulos foram para 11px e
valores para 14px com 44px de altura; e os campos foram agrupados em quatro
seções. Largura de 880px, ainda sob o teto de 60% da tela.

**O calendário (R37).** Saíram a hora e o "vence" de baixo do título (ficaram
no title do navegador), e a célula deixou de rolar: a linha cresce com o dia
mais cheio dela. Antes eram 42 áreas de rolagem independentes — item no fim de
uma delas era item que ninguém via.

533 asserções (58 novas, incluindo teste de unidade de `metaDoMes`,
`concluidosPorSemana` e `encerradoEm`), build ok.

### U34/U35 — Prospecção vira aba, campo com busca e sprint derivado (2026-08-21)

**Prospecção virou aba (R38).** A lista saiu de `/prospeccao` e virou
componente (`features/prospeccao/ListaProspeccao.tsx`), renderizado como a
segunda aba do Painel Comercial. A aba mora na URL — é o que mantém o link
antigo funcionando depois de a página deixar de existir. Mesmo padrão da R31 e
da R32: `/prospeccao` redireciona, a chave sai do catálogo e a U34 apaga as
linhas órfãs. **Nenhum acesso muda**: `prospeccao` e `gerencial` tinham
exatamente a mesma permissão ([tecnico=false, comercial=true, sac=true]), e há
asserção provando isso.

**Campo com busca (R39).** Um combobox de verdade — ARIA, setas, Enter, Esc,
fecha ao clicar fora — com dois cuidados que só aparecem quando quebram:
"começa-com" vem antes de "contém" (quem digita "vila" quer *Vila* Lagos no
topo, não *Alto da Vila*), e a escolha usa `mousedown`, porque o `blur` do
input dispara antes do `click` e levaria a seleção embora.

**O sprint sai do prazo (R40).** Sprint e prazo eram duas respostas para
"quando?", mantidas à mão — e por isso divergentes: tarefa com prazo para
amanhã marcada "mês que vem" não é planejamento, é esquecimento, e o quadro
por sprint passa a mentir sobre a semana.

O vocabulário precisou crescer: "Essa semana" e "Semana que vem" não existiam
nem no código nem no `CHECK` do banco. **A U35 tem que rodar antes do deploy**
— sem ela, toda troca de data voltaria com erro de constraint na cara do
usuário.

Três decisões dentro da regra:
- **O balde mais estreito ganha.** Uma data desta semana também é deste mês; a
  resposta útil é a que muda o que se faz hoje.
- **Vencido vai para "essa semana"**, não para "mês passado". O retrospectivo
  é para o que já foi; o que venceu e segue aberto é trabalho para agora.
- **Encerrado não deriva.** No importador, derivar num chamado concluído em
  2025 o jogaria em "essa semana" — verdadeiro para trabalho vivo, absurdo
  para arquivo.

E a partição cobrou um preço que eu quase deixei passar: `metaDoMes` e o preset
"Este mês" filtravam por `sprint === 'este_mes'`. Com a tarefa de quarta-feira
virando `essa_semana`, ela sairia da meta — o número despencaria sem nada ter
mudado no trabalho. Daí `SPRINTS_DO_MES`, com asserção nos quatro casos.

586 asserções (32 novas, incluindo teste de unidade de `sprintDoPrazo` em nove
datas), build ok.

### U36 — Serviço prestado por cliente (R41, 2026-08-22)

Propriedade nova em `clientes`, conjunto de dois valores: portaria remota e
monitoramento de alarmes. **Array e não coluna única** porque um condomínio
pode ter os dois — guardar um só forçaria escolha falsa no cadastro e sumiria
o cliente do filtro do outro serviço.

**Os 29 da lista foram casados por CNPJ**, e isso não é preciosismo: medido
antes de escrever, **quatro deles têm nome diferente na base do QAP** — "Villa
Lagos" é *Vila Lagos*, "Estoril" é *Estoril Sol*, "Manhattans Home" é
*Manhattans*, "Eurico Gaspar Dutra" é *Gaspar Dutra*. Casar por nome perderia
os quatro em silêncio. 28 casam por documento, 1 por nome (Las Vegas, que veio
sem CNPJ). A migration tem pré-voo listando quem não casar.

Na tela, **serviço é eixo independente da situação**: os dois filtros se
compõem, e a contagem de cada um respeita o outro — chip que promete 192 e
entrega 29 é chip que mente. O serviço aparece como etiqueta na linha e se
liga/desliga na página do cliente (sem isso a propriedade ficaria congelada
nos 29 da migration).

### Revisão adversarial da U33 — o que ela pegou (2026-08-22)

Rodei uma revisão de seis lentes com julgamento por três céticos cada. Ela
encontrou **um defeito crítico que eu tinha acabado de introduzir** e três
médios, além de um bug anterior.

**O crítico: os painéis do topo zeravam para todo mundo.** `paraPaineis`
chamava `aplicarLentes` trocando só `periodo: null` — mas o filtro que abre a
tela é `situacao: "abertos"`, e `aplicarLentes` corta `!emAberto` na primeira
linha. Como `encerradoEm` só existe em atividade encerrada, o conjunto que
chegava aos painéis **nunca continha um encerrado**: quatro barras do passado
em zero, rosca da meta em 0%, "Concluídas no mês" em 0 — no primeiro acesso,
sem ninguém tocar em nada. Antes da U33 esses números vinham de consulta
própria e mostravam a verdade; eu tinha trocado dado certo por dado zerado.

E o achado é mais afiado do que eu teria chegado sozinho: **nenhum valor de
`situacao` conserta**, porque o gráfico tem passado e futuro na mesma imagem —
o passado precisa dos encerrados, o futuro dos abertos. O mesmo vale para os
presets: sete dos oito exigem `emAberto`, e `meu_dia` é o padrão do técnico.

A saída foi `recorteDosPaineis`, que aplica só as dimensões de QUEM e O QUÊ
(pessoa, vínculo, busca) e nenhuma de QUANDO ou ESTADO. E a asserção que
faltava passou a existir: o teste percorre o **caminho completo**, de
`FILTROS_INICIAIS` até o número pintado — testar as peças isoladas não pegava
nada, porque cada peça estava certa e o erro morava na junção.

**O bug anterior: a proposta contava dobrado.** Desde a U29 toda visita tem um
chamado-capa com o mesmo id no banco, mas as Atividades saem com ids
diferentes (`vis-x` e `ch-x`) — nenhuma dedup os junta. A proposta aparecia
**duas vezes no quadro** e contava duas vezes na barra. A Home e o histórico
passaram a excluir `natureza = 'comercial'`: a proposta continua no Kanban
pela visita, que é a versão rica e que desde a U29 já traz o número CH-.

Os outros três, todos na tabela nova: o cabeçalho `sticky` não grudava
(`overflow-x: auto` com `overflow-y: visible` resolve para `auto` e cria um
contêiner de rolagem que nunca rola); a linha não era operável por teclado
(substituiu um `<button>`); e a coluna Prazo pintava vermelho-negrito sobre um
traço nas visitas, que não têm `prazoLimite` mas têm `prazoEstourado`.

624 asserções, build ok.

### U37 — Ordenar, tabela mais legível, calendário no design system (2026-08-22)

**R42.** Botão "Ordenar" na Início: Prazo, Cliente (novo) e Prioridade (a
sugestão — já existia pronta dentro de `ordenar()`, só faltava expor). A
escolha mora em `Filtros.ordenacao` (`null` = segue a ordem do padrão) e
**vence** `ordemDoPreset()`, mas se apaga ao trocar de padrão — cada padrão
já embute a ordem que faz sentido para ele, e deixar a escolha antiga vazar
faria a troca parecer quebrada (o padrão muda, a lista continua na ordem de
antes, sem motivo aparente).

**R43.** Três ajustes na tabela, pedidos depois de ver a tela no ar:
margens iguais às do quadro (`sangra-x`, a mesma classe que o Kanban já
usava — a tabela vivia presa na largura de leitura do `<main>`); a sigla
CH- saiu da vista do título mas não do tooltip; Responsável e Apoio ganharam
foto ao lado do nome. A foto usa `degradeAvatar(id)`, não `(nome)` — é o que
`AvatarPilha` já usa no resto do app, e hashear por nome faria a MESMA
pessoa ter cor diferente em cada tela.

**R44.** Os dois filtros do Calendário (Pessoa, Tipo) eram `<select>`
nativos — a caixa cinza padrão do navegador, que muda de aparência conforme
o sistema operacional e não segue o tema do app. Viraram `MenuFiltro`, o
mesmo componente que a Início usa em cinco filtros e agora em seis. De
brinde, o filtro de Tipo ganhou rótulo central (`TIPO_LABEL`) em vez de
mostrar `"corretiva"` cru — com fallback capitalizado para `"visita"`, que
não é um `ChamadoTipo` e não tem entrada no vocabulário central.

643 asserções (19 novas), build ok.

### U38 — O fluxo da proposta acaba no envio (R38, 2026-08-22)

O Davi mandou um print: um card de proposta com título repetindo o nome do
condomínio, uma etiqueta "Cliente" mostrando o MESMO nome do condomínio (que
não é cliente nenhum), "Normal" como prioridade e um subtítulo esquisito —
"Proposta com o cliente · com o cliente", repetido. Rastreei os quatro até a
raiz e todos vinham do MESMO lugar: o estado intermediário "aguardando a
resposta do cliente", que ele decidiu cortar de vez — "o restante acontece
somente fora do app".

**O que saiu:** os dois botões (ACEITOU/RECUSOU) e o formulário de motivo de
recusa na tela da visita. **O que mudou de sentido:** `colunaDaVisita()`
(atividades/modelo.ts) — proposta enviada, com ou sem resultado, já é
"concluído" na hora. Não sobrevive nenhum estado "com o cliente, aguardando".

**O que ficou, deliberadamente:** a RPC `registrar_resultado_proposta` e as
colunas `proposta_resultado`/`_em` continuam no banco — visitas de ANTES desta
mudança já têm resultado gravado, e apagar a leitura apagaria história real.
Os blocos que mostram "Proposta aceita"/"Proposta recusada" com data e motivo
continuam na tela, só não há mais botão que grave um resultado novo. O botão
"Gerar chamado de implantação" também ficou — só parou de depender do aceite
(que não existe mais como mecanismo ativo) e passou a ficar disponível assim
que a proposta é enviada, para o gestor acionar quando souber o desfecho por
fora.

**Dois defeitos que a raiz explicava sozinha, sem o Davi precisar apontar:**

1. **O título duplicava o nome do prédio** porque o trigger `sincronizar_
   chamado_da_visita` (U29) usava `COALESCE(titulo, nome_predio, 'Proposta
   comercial')` — quase toda visita tem um dos dois preenchido, então a capa
   quase sempre nascia com o nome do condomínio. Virou constante:
   **"Proposta Comercial"**, sempre, sem condição.
2. **A etiqueta "cliente" preferia `clientes.nome`** mesmo quando havia
   `nome_predio` — e para a maioria das visitas (prospecto, sem cliente
   vinculado) isso já caía em `nome_predio` mesmo, só que por acaso, não por
   regra. Agora `nome_predio` vem SEMPRE primeiro, mesmo para visita de
   cliente existente (R23) — o texto descreve o LOCAL, o vínculo comercial
   continua existindo em `cliente_id`, só não é o que aparece no card.

**Um bug que eu mesmo quase deixei passar:** `encerradoEm` (a data que
`concluidosPorSemana`/`metaDoMes` usam para contar) caía em
`proposta_resultado_em ?? created_at` — e `resultado_em` nunca é gravado para
uma proposta simplesmente enviada (só para aceite/recusa, que não existem
mais). Sem o remendo, TODA proposta enviada contaria na semana em que a
VISITA foi criada, não na semana em que foi enviada — plausível o bastante
para passar batido. Corrigido para `proposta_resultado_em ?? proposta_enviada_em
?? created_at`: o histórico (mais preciso, quando existe) vence; senão o
envio, que agora é o desfecho de verdade.

**A migration `U38`** reescreve o trigger (mesma lógica, título fixo, escuta
`proposta_enviada_em` também) e faz um **backfill**: chamados-capa que já
estão presos no estado antigo — aprovada, enviada, sem recusa — são virados
para concluído e o título corrigido na hora. É a visita exata do print.

670 asserções (33 novas), build ok.

### U39 — Paleta de status retificada + calendário: cor, fundo e um bug de filtro (2026-08-22)

**A paleta de status estava errada em três dos sete valores.** O Davi listou
os cinco nomes e cores que valem: Aguardando início=azul, Em andamento=
amarelo, Stand-by=laranja, Aguardando aprovação=azul claro, Concluído=verde.
Comparando com o código: "aberto" pintava de AMARELO (a cor de em andamento),
"em_andamento" pintava de AZUL (a cor de aguardando início) — as duas
literalmente trocadas —, "aguardando_aprovacao" usava PÊSSEGO (uma cor fora
da lista de cinco), e "concluido" usava um azul escuro. `PRISMA` não tinha
verde: formalizei o `#2DD2A5`/`#047862` que 17 arquivos diferentes já
declaravam à mão (cobrança, compra, contratos, inventário, checklist de
campo) em `PRISMA.verde` — era o verde de fato oficial da casa, só nunca
tinha sido posto no lugar central.

**O calendário: três problemas por trás de "achei um cinza muito claro".**

1. **O fundo era um véu translúcido de branco** (`rgba(255,255,255,0.03)`)
   sobre um fundo escuro — frágil por natureza, o resultado depende de
   exatamente o que está atrás. Virou cor sólida (`#101016`, o mesmo tom que
   `TabelaAtividades` já usa).

2. **Toda visita no calendário caía no cinza de fallback.** O código lia
   `chamadoStatusInfo(v.status)` para eventos de visita — mas a visita tem
   VOCABULÁRIO PRÓPRIO de status (pendente/aguardando_aprovação/aprovada/
   reprovada, de `visita-status.ts`), diferente do vocabulário do chamado.
   Nenhuma chave batia, então `chamadoStatusInfo` sempre devolvia o
   FALLBACK (`#9ca3af`, cinza) — e como boa parte do calendário é feita de
   visitas (propostas), isso sozinho já lavava a cor da tela inteira.
   Trocado para `getStatusInfo` de `visita-status.ts`.

3. **"Atrasado" só cobria metade dos casos.** A regra antiga só pintava
   vermelho quem tinha entrado pelo PRAZO (chamado interno sem hora
   marcada); uma visita ou chamado de campo com hora agendada já vencida
   continuava com a cor do status normal, mesmo estando igualmente atrasado
   no sentido comum da palavra. Generalizei: atrasado = data no passado E
   não chegou a um estado final (concluído/cancelado para chamado;
   aprovada/reprovada para visita).

**O bug do filtro — "seleciono pessoa + tipo e um deles some".** Confirmado
e reproduzido na leitura do código: `tiposPresentes` (as opções do filtro de
Tipo) nascia do array `eventos`, que JÁ estava filtrado por pessoa. Escolher
uma pessoa cujas atividades são todas do MESMO tipo reduz `tiposPresentes` a
1 item — e a condição que decidia se o BOTÃO aparecia
(`tiposPresentes.length > 1`) ficava falsa. O filtro de Pessoa literalmente
apagava o controle de Tipo da tela. Corrigido: as opções do seletor de Tipo
agora vêm de TODOS os eventos do mês (`todosEventos`), nunca do conjunto já
filtrado — o filtro de um eixo não pode fazer o CONTROLE do outro eixo
desaparecer.

687 asserções (17 novas), build ok.

### U40 — O painel de propriedades, 2ª revisão (R47, 2026-08-22)

Cinco pedidos, num painel só:

**Sigla fora do título.** Repete a R43 (a tabela da Início): o CH-... some da
vista, mas mora no `title=` do bloco do título — continua ali para quando
alguém precisa pedir o chamado por telefone.

**"De quem é" virou uma linha só.** Cliente, Responsável e Apoio são três
respostas para a mesma pergunta — separadas em três linhas empilhadas
pareciam três perguntas diferentes. Os três ganharam ícone/avatar ao lado do
nome: Cliente com `Building2` (o mesmo símbolo do resto do app), Responsável
e cada chip de Apoio com o AVATAR de verdade da pessoa. Isso pediu duas
extensões:

- `CampoComBusca` ganhou `iconeEsquerda` — um ícone/avatar que representa a
  escolha ATUAL, dentro do campo. O ícone some enquanto o campo está aberto
  (buscando), porque nesse momento o texto mostrado é o termo digitado, não
  a escolha.
- `PessoaComFoto` (o par foto+nome que a U33 tinha construído só para
  `TabelaAtividades`) foi extraído para `src/components/PessoaComFoto.tsx` —
  o painel precisava do mesmo par, e duas cópias divergiriam na primeira
  mudança de estilo (pior: cada cópia poderia hashear a cor por um campo
  diferente, quebrando "mesma pessoa, mesma cor em toda tela").

**Descrição virou o 2º campo, com ferramentas básicas.** Não é editor rico:
`src/lib/edicao-texto.ts` é Markdown em texto puro (`**negrito**`,
`- [ ] item`) — a descrição continua sendo lida como texto simples em toda
tela que já lê `descricao_problema` hoje, e nenhuma dependência nova entrou
no projeto. As duas funções puras (`envolverSelecao`, `prefixarLinhas`) saem
testadas por asserção, inclusive o caso mais fácil de errar: o cursor tem que
manter a MESMA posição relativa ao texto depois de o prefixo ser inserido —
sem isso, cada clique no botão jogaria o cursor para um lugar errado.

**Classificação: os 4 itens numa linha só.** Bastou baixar o piso da grade de
210px para 150px — com o piso antigo, 4 colunas não cabiam nos 880px do
painel e quebravam em duas linhas.

**Comentários — não era uma feature nova.** `chamado_eventos` já existia (a
tabela nasceu como `demanda_eventos` na U1, virou `chamado_eventos` na fusão
U7) com policy própria (`tipo='comentario'` e autor não pode ser forjado) e
gatilho de notificação. `useChamadoEventos`/`comentarChamado`
(`features/chamados/data.ts`) já existiam e já alimentavam a página de
detalhe interna. Faltava só o painel expor o que já estava construído — zero
migration nova. Mesma ordem (mais antigo → mais novo, campo de escrever no
fim) e mesmo filtro (`tipo === "comentario"`, escondendo o resto da linha do
tempo de eventos) que `DetalheInterno.tsx` já usava.

**Um erro que eu mesmo cometi e corrigi antes de publicar:** a primeira
versão escondia a sigla do título mas deixava, logo abaixo, uma segunda linha
mostrando o MESMO número — visível, não só no tooltip. Contradizia o próprio
comentário que eu tinha acabado de escrever no código. Pego relendo o próprio
diff antes do build.

715 asserções (44 novas), build ok.

**Revisão adversarial em segundo plano (2026-08-21).** 6 lentes independentes
(matemática do cursor, ícone do CampoComBusca, dados/RLS dos comentários,
regressão de layout, acessibilidade/celular, coerência com PRODUTO.md) sobre
o diff desta etapa, cada achado julgado por 3 céticos tentando refutar — 9
achados sobreviveram (1 alto, 6 médios, 2 baixos), todos corrigidos:

- **[alto]** `aplicar()` armava a seleção pendente mesmo quando o clique era
  idempotente (Checklist/Lista numa linha que já tinha o marcador). Como o
  valor não mudava, o React pulava o re-render (`Object.is` bail-out), o
  `useEffect` ligado a `[v]` nunca rodava, e a seleção ficava presa — puxando
  o cursor de volta pra um ponto velho na PRÓXIMA tecla digitada, embaralhando
  o texto em silêncio. Fix: só armar a seleção quando `r.valor !== v`.
- `prefixarLinhas` empilhava marcador em vez de trocar: "- item" + Checklist
  virava "- [ ] - item". O guard antigo comparava só com o prefixo EXATO que
  estava sendo aplicado; agora acha o marcador que a linha JÁ tem (checklist
  OU lista) e troca.
- Enter no campo de comentário não checava `enviar.isPending` (o botão já
  checava) — Enter duas vezes rápido gravava o mesmo comentário duas vezes.
- Os dois grids "na mesma linha" (De quem é, Classificação) usavam
  `auto-fit`/`minmax`, que reflow: numa faixa comum de largura de painel
  (~600–900px de janela) quebravam em 2+1 e 3+1 com um item órfão e espaço
  vazio ao lado — pior que a quebra balanceada de antes. Trocados por colunas
  FIXAS (3 e 4): nunca quebram, o que "mesma linha" pedia de verdade.
  `minmax(0, 1fr)`, não só `1fr` — sem o 0 um nome comprido estufaria a coluna.
- Botões da barra de ferramentas eram 30x30 — abaixo do alvo de toque mínimo
  de 44px que o resto do painel já documentava. Viraram 44x44.
- `Campo` envolve `children` num `<label>` implícito, associado ao PRIMEIRO
  elemento "labelable". Com 4 botões antes do textarea na Descrição, clicar
  no rótulo focava o botão "Negrito", não o campo de texto. Fix: `Campo`
  ganhou um `idAlvo?` opcional que, quando passado, vira `htmlFor` explícito
  (explícito sempre vence o implícito) — os outros ~15 usos de `Campo` no
  arquivo não passam `idAlvo` e continuam com a associação implícita de
  sempre, comportamento inalterado.
- `padEsquerda` do `CampoComBusca` reservava espaço do ícone olhando só se a
  PROP `iconeEsquerda` foi passada, não se ela de fato desenha algo para a
  escolha atual — sem cliente/responsável (`escolhida === null`), o
  placeholder ficava deslocado ~25px à toa. Agora olha `iconeEsquerda &&
  escolhida`.
- O aviso "No Notion estava como..." virou irmão solto de largura cheia
  depois que Cliente virou 1 de 3 colunas do grid — descolado da coluna que
  ele descreve. Mudou para dentro do próprio `<Campo titulo="Cliente">`.

766 asserções (11 novas cobrindo os achados), build ok.

### U41 — Vocabulário de tipos de chamado (R48, 2026-08-21)

Davi ditou a lista definitiva: Manutenção Corretiva, Manutenção Preventiva,
Operacional, Prospecção, Implantação, Melhoria. Duas mudanças reais por trás
de rótulos que pareciam só cosméticos:

**"Proposta comercial" → "Prospecção"** é uma renomeação de VALOR, não só de
rótulo — `chamado-status.ts` trocou `ChamadoTipo`, `TIPO_LABEL`, `TIPO_CORES`,
`tiposDaNatureza('comercial')` e o literal usado em
`atividades/modelo.ts:atividadeDoChamado`. No banco, a migration U41
(`20260822020000_u41_tipos_de_chamado.sql`) reescreve
`sincronizar_chamado_da_visita()` (o trigger que a U29/U38 já tinham editado)
para gravar `'prospeccao'` em vez de `'proposta_comercial'` nas visitas
NOVAS, e faz **backfill** de toda linha `natureza='comercial'` existente —
Davi foi explícito ("aplicado... para todas as demandas que são de propostas
comerciais"), não só as futuras. O CHECK continua aceitando o valor antigo
(`'proposta_comercial'`) por segurança histórica, mesmo que o backfill não
deva deixar nenhuma linha com ele.

**"Pedido de compra" sai só da SELEÇÃO.** `tiposDaNatureza('interno')` não
oferece mais `pedido_compra` na lista — mas o tipo continua no union, em
`TIPO_LABEL`/`TIPO_CORES`/`TIPOS`, no CHECK do banco (inalterado) e em TODO
lugar que já lia chamados de compra existentes: `chamado_compra` (ficha),
`ehCompra` em `DetalheInterno.tsx`/`atividades/modelo.ts`/`home/data.ts`, o
filtro do Painel de Chamados. A regra que guiou o que tocar e o que não: "não
apagar caminho de leitura que funciona só porque o caminho de escrita saiu" —
a mesma que a R38 já tinha estabelecido para `registrar_resultado_proposta`.
Dois lugares que CRIAM chamado novo precisavam mudar para não continuarem
oferecendo o tipo aposentado: o atalho de triagem em `chamados.novo.tsx`
("Pedido de compra" agora abre com `tipo: "operacional"`) e o classificador
de texto livre em `sugerirTipoChamado()`/`chamado-rapido.functions.ts` (a
função de criação rápida por IA — Etapa U20) — sem os dois, alguém ainda
criaria um chamado novo com o tipo que o seletor visual já não mostra mais.

"Manutenção Corretiva"/"Manutenção Preventiva" são só `TIPO_LABEL` — os
valores gravados continuam `corretiva`/`preventiva`.

**Documentado, não construído (R49):** Corretiva com diagnóstico+fotos, e
Preventiva associada ao condomínio (mapeamento de equipamento via QAP + um
cadastro de BLOCOS dentro do próprio sistema, reaproveitando o esquema de
categoria de blocos que o fluxo de orçamento já usa). Davi pediu para
registrar agora e construir depois — só foram assertion cabeçalhos aqui e em
PRODUTO.md, nenhum código novo.

### U42 — Zoom e pan no mapa de Clientes (R52, 2026-08-21)

"Adicione mecanismo de zoom no mapa, mecanismo de movimentar o mapa com
zoom, algo sistemicamente completo." A palavra que pesou foi "sistemicamente
completo": não bastava um scroll-to-zoom solto — o pedido pedia o conjunto
(zoom, pan, limite, atalho de teclado, botão) coerente entre si.

**A matemática é um módulo puro novo**, `src/features/clientes/mapa-zoom.ts`
— `Transform {x,y,k}`, `zoomEm` (zoom centrado num ponto, guarda ZOOM_MIN=1/
ZOOM_MAX=8), `deslocar` (pan), `limitarTransform` (não deixa arrastar o
conteúdo pra fora de vista — em k=1 não há folga nenhuma, x/y ficam travados
em 0), `distancia`/`pontoMedio` (pinça de dois dedos), `fatorDaRoda`
(exponencial, não degrau — o pinça de trackpad chega ao navegador como
`wheel` com `ctrlKey`, e um fator suave é o que faz isso parecer contínuo),
`paraPercentual` (converte um ponto de conteúdo em % pro balão de dica HTML,
que fica FORA do SVG e por isso não herda o `transform` do `<g>` interno).

**O viewBox do `<svg>` nunca muda** — quem se move é um `<g
transform="translate(x,y) scale(k)">` por dentro. Isso mantém
`svg.getScreenCTM()` como referência ESTÁVEL pra converter coordenadas de
tela em espaço de conteúdo, em vez de recalcular a relação a cada zoom.

**Ligação com o ponteiro**: Pointer Events (mouse+toque+caneta no mesmo
código) — 1 ponteiro arrasta, 2 dão pinça. Um clique vira "arrastou o mapa"
(não navega) quando a distância acumulada em pixels de TELA desde o
pointerdown passa de um limiar pequeno; abaixo disso, continua navegando
pra `/clientes/$id` como sempre. `requestAnimationFrame` coalesce as
atualizações de transform — o React não repinta mais vezes do que o
navegador consegue mostrar.

**Revisão adversarial em segundo plano** (6 lentes — matemática de
coordenadas, ciclo de vida de eventos, SSR/React, regressão, UX/mobile,
performance — cada achado julgado por 3 céticos). 9 achados sobreviveram,
todos corrigidos antes de publicar:

- **[crítico]** `setPointerCapture` chamado incondicionalmente em TODO
  pointerdown quebrava o clique-pra-navegar em qualquer Chrome/Edge/Chrome
  Android atual (desde a v135): com o ponteiro capturado, o Chromium passa a
  despachar o `click` no elemento que capturou (o `<svg>`), não no `<g>` do
  marcador — Firefox/Safari ainda ignoram isso pro cálculo do alvo, o que
  tornava fácil não perceber testando num desses dois. Fix: a captura só
  acontece quando o gesto de fato CRUZA o limiar de arrasto (dentro de
  `aoMoverPonteiro`), ou de imediato quando um 2º dedo confirma pinça (dois
  dedos simultâneos nunca são ambíguos com um clique). Um clique parado
  nunca captura, e o `click` nativo continua acertando o marcador certo.
- **[alto]** No celular, `touchAction:"none"` incondicional impedia rolar a
  PÁGINA tocando em qualquer parte do mapa — mesmo em k=1, onde arrastar não
  move nada (`limitarTransform` trava x=y=0 sem folga). Fix: `"pan-y"`
  enquanto o zoom está no mínimo (deixa o navegador rolar verticalmente com
  1 dedo, e a própria especificação de `touch-action` já desliga o
  pinça-zoom nativo quando algum `pan-*` é dado sozinho — o gesto de 2 dedos
  continua chegando inteiro nos handlers), trocando pra `"none"` só depois
  que a pessoa já deu zoom.
- **[médio]** Roda do mouse sem exigir Ctrl/Cmd sequestrava o scroll da
  LISTA de clientes ao lado — o mapa ocupa a coluna larga e (a partir de
  1024px) fixa (`position:sticky`), a maior parte da tela em qualquer
  desktop. Fix: exige `ctrlKey`/`metaKey` (o padrão de qualquer mapa/editor
  sério, e o que o navegador já sintetiza sozinho pro pinça de trackpad).
- **[médio]** `pinchRef` (a referência do gesto de pinça) ficava com o PAR
  de dedos errado quando um 3º dedo entrava no meio de uma pinça e um dos
  dois originais soltava — o próximo movimento calculava a variação de
  distância/centro contra um par obsoleto, produzindo um salto brusco de
  zoom/pan gravado de verdade no estado (não só um frame descartável). Fix:
  `recalcularPinch()` roda tanto ao formar a pinça quanto sempre que o Map
  de ponteiros volta a ter exatamente 2 depois de alguém soltar.
- **[médio]** O balão de dica (hover) ficava preso invisível depois de um
  arrasto que terminasse em ÁREA VAZIA (o caso comum — raro um arrasto
  terminar bem em cima de um marcador de 5,5px): a flag que suprime cliques
  pós-arrasto só zerava dentro do `onClick` do próprio marcador, então sem
  esse clique ela ficava `true` pra sempre, e nenhum hover seguinte reabria
  o balão. Fix: zera também no `pointerup`, mas ADIADA (`setTimeout(...,
  0)`) pra não correr antes do `click` síncrono que ainda precisa lê-la.
- **[médio]** `getScreenCTM()` era chamado a cada `pointermove` (até ~120Hz)
  pra converter coordenadas — mas a CTM do `<svg>` só depende da posição do
  PRÓPRIO elemento na página, que não muda durante um arrasto. Fix: cacheada
  uma vez no início do gesto, reusada até o fim dele.
- **[baixo, aceito como está]** Zoom por teclado (botões) existe; pan por
  teclado não existia. Fix: setas do teclado deslocam o mapa quando ele está
  focado (`tabIndex`), fechando a lacuna de acessibilidade.
- **[baixo/médio, performance]** O traço dos distritos e o halo dos rótulos
  recalculavam `1/k`/`2.4/k` a cada frame de zoom — escrita de atributo real
  em ~94 elementos à toa. Fix: `vector-effect="non-scaling-stroke"` (mantém
  a espessura constante NA TELA sem depender do zoom), mais simples e mais
  barato que o cálculo manual.

Não confirmado (achado descartado pelos céticos): o balão de dica não é
byte-idêntico à fórmula antiga em k=1/x=0/y=0 — a fórmula antiga já ignorava
a margem do viewBox (um desvio pré-existente de ~0,6%); a nova (`paraPercentual`)
corrige isso como efeito colateral, não é regressão.

811 asserções (45 novas — mapa-zoom.ts ganhou testes unitários próprios, e
cada achado corrigido virou uma trava estrutural no componente), build ok.

### U43 — Painel do chamado, 3ª revisão de design (R53, 2026-08-22)

"A caixa de descrição não me agradou" — o design herdado do R50 (a checklist
azul do Uiverse) e o resto da hierarquia visual do painel (rótulos em
cinza-secundário, título de 19px/600) não estavam à altura do Design System
v2. Quatro ajustes, todos em `PainelChamado.tsx`/`styles.css`/
`TextoComChecklist.tsx`:

1. **Rótulos de campo** (`useEstiloCampo().rotulo`) trocaram `textSecondary`
   por `textPrimary` — branco no escuro, quase-preto no claro. Não é
   `color: "#fff"` fixo: o anti-padrão §8 do design system já foi bug de
   produção aqui uma vez, então o token continua fazendo o trabalho de
   escolher a cor certa por tema.
2. **Título da atividade** no cabeçalho: 19px/600 → **22px/700** — o
   "Título de página" do design system (§3), o degrau mais alto de peso que
   o sistema carrega.
3. **Barra de ferramentas da Descrição**: os 4 botões (negrito, itálico,
   checklist, lista) ganharam a classe `.ferramenta-botao` — borda, fundo e
   hover dourado de verdade, lendo os tokens de tema direto no CSS (sem
   `isLight` em JS). Um divisor de 1px separa formatação de texto de
   formatação de linha — dois grupos, não quatro botões soltos.
4. **Checkbox da checklist**: a geometria SVG do Uiverse (R50) ficou, mas a
   cor trocou do azul original (`#4285f4`) para `var(--gold-primary)` — o
   único acento do sistema, resolvendo sozinho pros dois temas. Ganhou
   também um "pop" de escala (`scale(1.14)`, cubic-bezier com overshoot) além
   do traçado, anulado sob `prefers-reduced-motion`.
5. **A caixa de Descrição cresce com o texto** em vez de rolar por dentro:
   `useLayoutEffect` mede `scrollHeight` e aplica a altura ANTES da pintura
   (evita o flash de "cresceu um frame depois"), zerando pra `"auto"`
   primeiro — sem isso, uma caixa que ENCOLHEU (apagou um parágrafo) ainda
   leria a altura antiga, porque `scrollHeight` nunca é menor que a altura já
   aplicada no elemento. `resize: none` (arrastar brigaria com o auto-ajuste
   no próximo caractere) e `overflow: hidden` (sem isso a barra de rolagem
   nativa aparece por 1 frame antes do JS medir).

823 asserções (12 novas), build ok.

### U44 — Marcação de Monitoramento de Alarmes (R41, 2026-08-22)

Continuação da U36: o Davi mandou a planilha "clientes-monitoramento" (42
contas) pedindo a propriedade `monitoramento_alarmes` nesses clientes — o
mesmo `servicos_prestados` que a U36 já tinha criado e povoado com os 29 de
portaria remota.

**Por que só por documento, diferente da U36**: a planilha de portaria tinha
fantasia limpa; esta tem fantasia solta ("Residencia Francisco (Rua Lelis
Vieira, 201)", "RESIDENCIA PARASMO (Residencia Ricardo Parasmo)") — um
de-para por nome normalizado erraria fácil. Cada uma das 42 linhas foi
conferida à mão contra a planilha completa da base oficial (U24: nome,
documento e endereço de cada cliente) antes de entrar na migration:

- **30 casaram**, sempre pelo documento (CNPJ/CPF) já existente em
  `clientes.documento` — inclusive quando a planilha não trazia CNPJ
  nenhum na linha (nesse caso o endereço exato, rua + número, foi o que
  confirmou qual cliente da base era) ou trazia um placeholder óbvio ("0",
  "123123", 15 zeros).
- **2 pares de contas apontam pro MESMO cliente**: Páteo Klabin (contas
  0040 e 4051) e Ricardo Parasmo (9003 "Residencia Parasmo" e 8057 "Obra
  Ricardo Parasmo", mesmo CPF nas duas linhas da planilha — a pessoa tem
  duas propriedades monitoradas, mas o cadastro só tem UM registro de
  cliente). A lista de 30 tem cada documento uma vez só; o UPDATE por
  documento cobre as duas contas de qualquer forma.
- **9 ficaram de fora**, sem correspondente confiável (nem documento nem
  endereço exato bateram com nada na base): Residencia Beto, ALFALUX
  ALARME, Mãe Iliana, Ara Escritorio (Campo Verde), as 3 contas Ara
  Vartanian da Rua Lelis Vieira 222, Romma Serras, Residencia Adriana e
  Residencia Valmir. Documentados na própria migration para quem for
  investigar depois — podem ser clientes novos (fora da base da U24) ou
  cadastrados sob outro nome; decidir isso é conferência humana, não algo
  que este script deveria adivinhar.

**A asserção reproduz a conferência**: em vez de só travar a estrutura do
SQL, o verificador extrai os 30 documentos da migration E os documentos da
planilha oficial da U24 (mesmo parser regex que a U36 já usa) e confirma que
todo documento da U44 aparece na base — do jeito que a própria migration
confirmaria em produção, mas sem precisar rodar contra o banco de verdade.
Também confere que não há documento duplicado dentro da lista.

Nenhuma mudança de UI/tela: `SERVICO_ORDEM`, filtro, contagem, badges e o
toggle na ficha do cliente já foram construídos genericamente pela U36 —
esta migration só povoa dados.

831 asserções (8 novas), build ok.

### U45 — Uma atividade pode ter mais de um cliente + grupo de clientes (R54, 2026-08-22)

"Uma atividade pode ser para mais de um cliente" + "Grupo de clientes...
hoje temos Portaria Remota e Monitoramento de Alarmes."

**A decisão que definiu o escopo**: `chamados.cliente_id` é lido por meia
dúzia de sistemas que só conhecem UM cliente por chamado — cobrança
(`mensalidadesProjeto.ts`, `cobranca.functions.ts`), casamento por cliente
(`matching.ts`), filtro, cards da Início e do Calendário, relatório. Reescrever
tudo isso para multi-cliente não foi o que foi pedido, e arriscaria quebrar
cobrança de verdade sem necessidade. Em vez disso:

- **`cliente_id` continua exatamente como era** — o cliente PRINCIPAL. Todo
  sistema que já lê esse campo continua funcionando sem mudar uma linha.
- **`chamado_clientes` (tabela nova) é ADITIVA** — guarda só os clientes
  ALÉM do principal. Mesmo desenho de `chamado_apoios` (U1/U7): chave
  composta `(chamado_id, cliente_id)`, RLS por `pode_editar_chamado` (a
  MESMA função que já guarda `cliente_id` hoje — "quem pode adicionar um
  cliente extra" nunca diverge de "quem pode editar o chamado"). **Sem
  backfill**: não existia "cliente extra" antes deste recurso existir, então
  toda atividade começa com a lista vazia (só o principal, como sempre foi).

**A UI**: o campo Cliente, no painel (`PainelChamado.tsx`), trocou de
`CampoComBusca` de valor único para chips + busca — LITERALMENTE o mesmo
padrão que "Apoio" já usava para pessoas. A função que decide onde gravar
(`adicionarClienteChamado`, em `data.ts`) escolhe sozinha: se o slot
principal está livre, o cliente novo VIRA `cliente_id` (1 gravação); só
quando o principal já está ocupado é que vai para `chamado_clientes`. Ao
remover, o mesmo raciocínio ao contrário — remover o principal só limpa o
slot, **sem promover automaticamente** um extra a principal (ficar com
extras e sem principal é um estado válido; decidir QUAL extra vira principal
seria uma escolha silenciosa que ninguém pediu). `clientesDoChamadoIds`
(no painel) é sempre `[principal, ...extras]`, então a tela nunca precisa
saber de qual das duas tabelas cada cliente veio.

**Grupo de clientes**: não é uma entidade nova no banco. Davi foi explícito
— "os grupos... são os dois tipos de serviço prestados atualmente... hoje
temos Portaria Remota e Monitoramento de Alarmes... futuramente podemos
adicionar mais grupos" — então o grupo É a marcação `servicos_prestados`
(R41/U36). Um `<select>` no painel lista `SERVICO_ORDEM`; escolher um
serviço chama `adicionarGrupoDeClientes`, que filtra `clientes` por
`temServico(c, servico)` e adiciona todo mundo que ainda não está na
atividade — no máximo 1 UPDATE (o principal, se o slot estava livre) + 1
INSERT em lote para o resto, não N idas ao banco por cliente do grupo.
Quando `servicos_prestados` ganhar um 3º valor um dia, o seletor de grupo
cresce sozinho — nenhum código muda.

**Por que nenhuma promoção automática, nenhum trigger de sincronia**: a
primeira versão deste desenho cogitava um trigger em Postgres que
mantivesse `cliente_id` sempre sincronizado com `chamado_clientes`
(promovendo o próximo extra quando o principal fosse removido). Descartado:
cada operação (adicionar, remover, adicionar grupo) já é no máximo 2
gravações sequenciais e sem ambiguidade de qual tabela usar — um trigger
adicionaria uma segunda fonte de verdade escrevendo `cliente_id` por trás,
tornando mais difícil raciocinar sobre o que uma gravação do painel
realmente fez.

851 asserções (20 novas), build ok.

### U46 — Paginação da lista de Clientes + mapa alinhado com a lista (R55, 2026-08-22)

"A lista de clientes deve conter 10 itens por vez, adicione o numerador de
páginas no final com opção de passar para próxima, para última, e o número
da página específico... o mapa esteja alinhado com o fim da lista, e a
página esteja por completa alinhada e margeada."

**A paginação**: 10 por página, estado local (`paginaAtual`), fatiando a
lista JÁ FILTRADA. Três detalhes que valeram trava por asserção:

- **Trocar busca/filtro/serviço volta pra página 1** (`useEffect` nas três
  dependências). Sem isso, estar na página 4 e digitar uma busca que devolve
  8 resultados deixaria a tela EM BRANCO — a página 4 de uma lista de 8 não
  tem item nenhum, e nada na tela explicaria por quê.
- **`pagina` é `min(paginaAtual, totalPaginas)`**, não `paginaAtual` cru: se
  o total encolher entre um render e outro (um cliente inativado por outra
  aba, por exemplo), a fatia continua válida sem esperar o efeito rodar.
- **O MAPA continua recebendo `lista`, não `listaPaginada`.** Uma asserção
  marcada como CRÍTICO guarda isso: "simplificar" pra `listaPaginada` faria
  o mapa mostrar só 10 pontos em vez de todo o resultado filtrado — uma
  mudança de comportamento invisível numa revisão de diff, porque as duas
  variáveis têm nome parecido e o mapa continuaria "funcionando".

O numerador (`<Paginacao>`, no próprio arquivo da rota) segue o vocabulário
que a tela já tinha: a página atual usa `GRAD_PRIMARIA`, o MESMO gradiente
dourado de `chipFiltro(true)` logo acima na página — não uma paleta nova só
pra paginação. `numerosDePagina()` mostra todas até 7 páginas e, acima
disso, mantém primeira, última e a vizinhança da atual, com reticências no
meio. Os 4 botões de navegação têm `aria-label` e desabilitam nos extremos.

**O alinhamento**: `.clientes-duas-colunas` trocou `align-items: start` por
`stretch` no breakpoint de 1024px — as duas colunas dividem a mesma linha do
grid, então "stretch" faz as duas terminarem juntas. Isso tornou o
`position: sticky` do mapa **sem efeito** (ele existia justamente porque as
alturas divergiam: numa lista comprida, sobrava vazio ao lado do mapa) e ele
saiu. A altura da caixa do mapa virou a classe `.mapa-clientes-caixa`: `vh`
fixo no celular (lá não há lista na mesma linha do grid pra casar altura) e
`flex: 1` com piso de 480px a partir de 1024px.

Um detalhe que quase virou bug: o card do `MapaClientes` precisou ganhar
`height: "100%"` explícito. O `stretch` do grid dá ao card a altura de
LAYOUT certa, mas sem `height` própria definida ele não tem o que
distribuir para um filho com `flex: 1` — é exatamente a armadilha que o
comentário antigo do componente já descrevia ("flex:1 colapsa pra zero"),
só que um nível acima na árvore.

870 asserções (19 novas), build ok.

### U47 — Duplas de campo, programação e painel operacional (R56–R59, 2026-08-22)

Um lote grande, com uma peça nova no meio (duplas) que as outras três usam.

**A decisão de modelagem que definiu tudo**: `duplas` é uma tabela nova, mas
**não existe `chamados.dupla_id`**. A dupla de um chamado é DERIVADA do
responsável — se o responsável está numa dupla ativa, o chamado é dela. Três
razões: funciona retroativamente (todo chamado que já tem responsável já tem
dupla, sem reprocessar nada); não cria segunda fonte de verdade (com coluna
própria, trocar o responsável e esquecer da dupla deixaria o chamado mentindo
sobre quem foi); e é como a operação já funciona — a programação atribui o
TÉCNICO, e a dupla vem junto. A conta mora em `features/duplas/modelo.ts`,
pura e coberta por asserção.

**Uma pessoa em uma dupla ativa só.** Sem isso, "a dupla do responsável" teria
mais de uma resposta e o gráfico atribuiria a atividade a uma dupla escolhida
por sorte. Dois índices parciais cobrem "duas vezes na mesma coluna"; o
**trigger** cobre o caso cruzado (membro_a numa dupla e membro_b em outra),
que **índice nenhum pega** — é a única razão de ele existir. Desfazer uma
dupla a DESATIVA: o histórico do gráfico depende dela.

**Isto supera a R14** ("só o líder tem conta no app"). Agora todo técnico tem
usuário, e é dos usuários que as duplas são montadas.

**Programação (R57)** — título novo, "+" que abre chamado já de campo, switch
semanal/mensal e os dois filtros. Detalhes que valeram trava:
- **Os filtros valem para TUDO** — agenda, fila sem data e o número de carga
  embaixo de cada dia do seletor. São todos derivados de `abertas`, então
  filtrar na raiz cobre os três. Se a carga ignorasse o filtro, o número
  embaixo do dia prometeria atendimentos que a agenda daquele dia não mostra.
- **A grade do mês tem 42 células fixas** (6 linhas), não "as que couberem":
  um mês de 5 linhas e outro de 6 fariam a página inteira pular de altura ao
  trocar de mês, e a agenda embaixo andaria junto.
- **A agenda agrupa por DUPLA**, não por técnico. Duas linhas separadas
  ("Breno 3", "André 2") diriam 3 e 2 sobre um trabalho que as duas pessoas
  fizeram juntas — são 5 da dupla. Técnico fora de dupla continua com grupo
  próprio; ninguém some da agenda.
- `TIPOS_DEMANDA_CAMPO` (3 tipos) é **mais estrito** que
  `tiposDaNatureza('campo')` (4, com 'operacional') — proposital, e a asserção
  registra a diferença em vez de deixá-la parecer esquecimento.

**Painel operacional (R58)** — os 4 atalhos saíram (todos são item do menu
lateral; o painel repetia embaixo o que está sempre à esquerda).
`PainelBase` já escondia a seção com lista vazia, então não sobrou um "Ir
para" órfão — nenhuma mudança lá. Entrou o gráfico de linhas por dupla, 12
semanas no eixo X, contado pela **data programada** (é a semana em que o
trabalho caiu para a dupla; `created_at` mediria a entrada da demanda, que já
é o "fluxo do mês", e `concluida_em` deixaria de fora tudo por fazer). O
painel informa quantos atendimentos ficaram **fora de dupla** na janela — sem
isso o gráfico sumiria com parte do trabalho em silêncio. Sem dupla
cadastrada o gráfico nem aparece: moldura vazia não explica o próprio vazio,
e o card de cadastro logo acima é que diz o que fazer.

**R59 — o bug que o pedido do Davi revelou.** `inviteUserByEmail` faz DUAS
coisas (cria a conta E dispara o e-mail) e falha inteira se o envio falhar —
SMTP não configurado, cota estourada, domínio recusado. O cadastro ficava em
NADA: sem `auth.users`, sem `profiles`, sem linha em `convites`. O admin
preenchia o formulário, via um erro, e o técnico continuava inexistente para
o sistema — não dava para pô-lo numa dupla nem numa programação, que é
exatamente o que o Davi ia fazer em seguida. Agora o envio é a parte
OPCIONAL: se falhar, `createUser` cria a conta assim mesmo (o profile nasce
igual, pelo mesmo trigger `on_auth_user_created`, lendo os mesmos metadados),
a tela avisa que o convite não saiu em vez de anunciar um e-mail que nunca
chegou, e a pessoa entra depois por "esqueci minha senha". E-mail já
cadastrado virou mensagem própria, não uma segunda conta.

933 asserções (63 novas), build ok.

### U48 — PGRST201: embed de cliente ambíguo depois da U45 (2026-08-22)

Quebra de produção real, pega em campo pelo Davi minutos depois de ele rodar
a U45 no SQL Editor: a Início parou de carregar as atividades, com
`PRV-INI-APP-PGRST201` na tela.

**A causa**: `chamado_clientes` (a tabela de junção da U45) criou um SEGUNDO
caminho de `chamados` para `clientes` — a FK direta (`cliente_id`, o
principal) e o N:N pela junção. O PostgREST recusa embed ambíguo com
PGRST201 e derruba a consulta INTEIRA, não só o campo do cliente.

**A correção**: as três consultas que leem de `chamados` e embutem `clientes`
(`features/home/data.ts`, `features/chamados/data.ts`,
`routes/_authenticated/calendario.tsx`) ganharam a dica `clientes!cliente_id`.
A dica é o nome da COLUNA, não o da constraint — `chamados` nasceu como
`ordens_servico` e o rename de tabela não renomeia constraint, então a FK
real ainda se chama `ordens_servico_cliente_id_fkey`. Nenhuma migration nova:
correção só de cliente.

7 asserções travam as três consultas contra a regressão — inclusive contra
"esqueceram a dica na próxima consulta nova que ler de chamados".

940 asserções (7 novas), build ok.

### U49 — Início: Ordenar vira ícone, KPIs viram filtro, barra revisada (R60, 2026-08-22)

Quatro pedidos do Davi, todos na mesma tela e na mesma barra de filtros —
tratados juntos porque cada edição pisava na região de código da anterior.

**1. A lupa quebrada virou Ordenar.** No desktop, o botão de busca não fazia
NADA visível: o campo de busca já fica sempre montado logo abaixo dele (a
`div so-desktop` no fim da barra), então tocar na lupa só alternava um
estado que nenhuma tela lia. `MenuFiltro` ganhou uma variante ícone-só
(`icone?: LucideIcon` — mesma casca de 42×42 dos outros botões quadrados,
mesmo menu-portal por baixo) e a pílula de texto "Ordenar", que morava junto
dos outros filtros, virou esse ícone. A lupa não desapareceu — ficou
exclusiva do celular (`so-celular`), onde ela tem função de verdade.

**2. Os 4 quadrados de indicador viram filtro.** A garantia central: o
número escrito no quadrado e o tamanho da lista que o clique abre NUNCA
podem discordar. Isso significou extrair `atividadesDoKpi(chave,
atividades, agora)` em `metricas.ts` — a MESMA função que agora conta cada
tile em `PainelKpis` E que filtra a lista em `dashboard.tsx`. `metaDoMes`
ganhou um helper interno compartilhado (`doMesFiltro`) para não duplicar a
regra de "o que está no prato deste mês" em dois lugares que pudessem
divergir. Duas asserções marcadas CRÍTICO travam essa igualdade
diretamente: `metaDoMes(x).feitas === atividadesDoKpi('concluidas_mes',
x).length`, para qualquer conjunto.

A lista que abre lê de `paraPaineis` (a base ampla, com histórico, que os
próprios tiles já contam) — nunca de `filtradas` nem de `atividades` cru.
Compor com preset/prazo por cima quebraria a igualdade: a lista ficaria
menor que o número que a pessoa acabou de tocar, e é exatamente a mentira
que o comentário de `paraPaineis` já registra ter quase ido ao ar uma vez
(U33). `kpiSelecionado` é estado LOCAL, não entra em `Filtros`/
`sessionStorage` — é um drill-down temporário, não uma preferência.

**3. Situação saiu.** A Início sempre mostra o que está em aberto agora —
que já era o estado padrão quase o tempo todo, e todo preset já exigia
`a.emAberto` por conta própria.

**4. Período virou Prazo, e ganhou Equipe do lado.** "Prazo" reaproveita
`sprintDoPrazo` (a MESMA função que já decide o sprint de um chamado
interno) em vez de reimplementar limite de semana/mês com outra régua —
"essa semana" engole o vencido, herdando de graça a regra do R40 ("o que
venceu e segue aberto é trabalho para agora"). "Equipe" é novo, mesmo
departamento do cadastro de usuário (`lib/equipes.ts`); fora do interno
`a.equipe` é sempre null por invariante do modelo, então escolher uma
equipe naturalmente esconde campo/comercial — não é bug, é a própria
definição do campo.

984 asserções (44 novas), build ok.

### U50 — Clientes vira tela fixa a partir de 1024px (R61, 2026-08-22)

"Esta tela não deve ser 'scrollável', ajuste a margem superior, agrupe os
grupos de filtro e adapte a tela para uma tela fixa."

**Só desktop, de propósito.** `.clientes-tela-fixa` trava `height: calc(100dvh
- var(--topo) - 110px); overflow: hidden` a partir de 1024px — abaixo disso a
página continua crescendo e rolando como sempre. No celular, mapa + lista +
paginação empilhados (a ordem de sempre, mapa primeiro) não cabem juntos numa
tela sem rolar de jeito nenhum; travar altura lá só cortaria conteúdo sem
ganhar nada. Padrão diferente do Calendário (que usa `minHeight`, não
`height`, porque a grade dele CRESCE com o mês mais cheio) — aqui a lista já
vem paginada em 10 (R55), uma altura previsível, então um teto com rolagem
própria é o encaixe certo.

**Onde a rolagem realmente mora**: não na coluna da lista inteira — só na
região dos cartões (`.rolagem-fina`, `overflowY: auto`). A paginação fica
FORA dessa região, como irmã depois dela: sempre visível embaixo da lista,
sem precisar rolar até o numerador para trocar de página. `.clientes-duas-
colunas` ganhou `flex: 1; minHeight: 0` inline — o `minHeight: 0` é o que
importa: sem ele, um filho flex não encolhe abaixo do próprio conteúdo, e a
"rolagem própria" vazaria pra página inteira, exatamente o que o pedido
queria evitar. `align-content: stretch` entrou explícito no grid (R55) — o
padrão ("normal") já se comporta assim na prática quando a linha do grid tem
espaço sobrando, mas explícito não depende de ninguém lembrar do detalhe.

**Situação + Serviço viram um painel só.** Antes eram duas fileiras de chip
soltas, uma embaixo da outra, sem nada que dissesse que pertenciam juntas.
Agora moram dentro do MESMO cartão (`card(isLight)`), lendo como uma
pergunta composta ("quais clientes") com dois eixos, não dois filtros
desencontrados. Efeito colateral bom: o campo de busca, ao lado, virou
`alignItems: "stretch"` com o painel — as bordas dos dois casam na mesma
altura sem cálculo nenhum.

**A margem.** paddingTop/paddingBottom de 18/40 caíram para 8/8 — numa tela
com teto, sobra em cima é sobra que falta embaixo, no mapa.

994 asserções (10 novas), build ok.

### U51 — Mapa de Clientes: texto não seleciona, balão fecha ao sair do ponto (R62, 2026-08-22)

Dois bugs pegos em uso real, ambos no mesmo componente (`MapaClientes.tsx`),
consertados juntos.

**Seleção de texto ao arrastar.** O nome do bairro é `<text>` de verdade
(decisão da R51 — nítido em qualquer zoom, sobrevive à troca de tema). O
problema: arrastar o mapa é clique-e-segura-e-move, e é EXATAMENTE o gesto
que o navegador usa pra selecionar texto — então arrastar por cima de um
rótulo destacava a palavra em vez de só mover o mapa. A saída óbvia seria
"virar vetor" (converter a fonte em path), mas isso jogaria fora exatamente
o que a R51 tinha pedido (texto de verdade, não desenho). `user-select:
none` no `<svg>` inteiro resolve sem esse custo: o rótulo continua sendo
`<text>`, só que não-selecionável — o efeito prático que "virar vetor"
alcançaria, por um caminho mais simples e sem abrir mão de nitidez/acesso.

**Balão preso.** `onMouseLeave` só existia no `<svg>` inteiro (fecha o
balão ao sair do MAPA), não em cada ponto. Resultado: tirar o mouse de um
cliente para uma área vazia do mapa — sem sair do mapa em si — deixava o
nome do cliente errado preso na tela, porque nem o enter de outro ponto
(não havia outro por perto) nem o leave do svg (o mouse continuava dentro
dele) disparavam. Cada ponto ganhou o próprio `onMouseLeave`.

**O detalhe que evita um bug NOVO**: o handler não é um `setAlvo(null)` cru
— é `setAlvo((atual) => atual?.id === p.id ? null : atual)`. Motivo: em
pontos vizinhos/sobrepostos, a ordem de `mouseenter`/`mouseleave` entre
navegadores não é garantida — às vezes o `enter` do próximo ponto chega
ANTES do `leave` do anterior. Um `setAlvo(null)` incondicional, nesse caso,
apagaria o balão que o `enter` do vizinho *acabou* de abrir corretamente. O
check "isto ainda é sobre MIM?" faz o `leave` só valer quando é ele quem
está de fato ativo.

999 asserções (5 novas), build ok.

### U52 — Estrutura de blocos permanente do cliente (R63, 2026-08-22)

"Na página de cada cliente, nós vamos montar a estrutura de cada cliente de
acordo com os blocos de cada cliente... por enquanto eu quero que você
registre de maneira ordenada, lógica e estruturada essas informações, crie a
base para isso funcionar, crie os campos na página de cada cliente."

**A pesquisa decidiu o desenho antes de qualquer linha de código.** A
pergunta central era: existe uma estrutura permanente por-cliente já, ou é
tudo novo? Resposta: **já existe, e se chama `cliente_sistemas`** (Etapa 2,
o "inventário do cliente" — `docs/SISTEMA_OS.md` §4.2 já a descreve,
literalmente, como "um bloco do mundo real no cliente", com a MESMA
taxonomia de tipo do orçamento). O que faltava não era a tabela — era a
CONFIGURAÇÃO: hoje ela só guarda nome e descrição em texto livre, nunca o
código estruturado (`PED-2B-PORP-FAC-FAC-MOT-...-PR`) nem os campos que o
geram. Construir uma tabela paralela teria duplicado um conceito que já
existia e já estava conectado a chamados (`chamados.cliente_sistema_id`) e
ao checklist de preventiva (`montarChecklistPreventiva`, que já agrupa por
sistema/bloco desde a Etapa 6).

**Duas colunas, não vinte.** `codigo_bloco text` + `config_bloco jsonb` —
JSONB, não o padrão de `visita_blocos` (que tem `b1_tipo`, `b1_entrada`...
~20 colunas, porque nasceu de um wizard passo-a-passo). O precedente já
existe na própria `visita_blocos.alarme_config jsonb`. A vantagem aqui é
maior que lá: `config_bloco` segue o formato EXATO de `BlocoConfig` (a
interface TypeScript que `gerarCodigoBloco`/`gerarDescricaoBloco`, em
`src/lib/blocos.ts`, já esperam) — zero tradutor entre banco e código, ao
contrário do `codigoFromDbRow()` que `visita_blocos` precisa pra reconstruir
um `BlocoConfig` a partir de 20 colunas separadas.

**Sem backfill, de propósito.** Sistema cadastrado antes desta migration
fica com `config_bloco NULL` — "ainda não estruturado", nunca "estruturado
errado". A tela continua funcionando pra ele exatamente como antes; a
estrutura é uma camada opcional por cima do que já existia.

**Escopo explícito: só os 6 tipos que `gerarCodigoBloco` sabe montar sem
sub-wizard próprio** — PED, VEI, CFTV, AL, CER, CENT. ELV e TOT (kits de
elevador, totens) geram código por um caminho DIFERENTE no orçamento —
calculado direto nas mutações de `blocos.$cat.tsx` via regex
(`ELV-{n}KIT`/`TOT-{n}x{m}CAM`), nunca passando por `gerarCodigoBloco`.
Replicar `ElevadoresWizard`/`TotemWizard` na ficha do cliente é passo
futuro — ficam no modo simples (nome/descrição) por enquanto, e uma
asserção (`TIPOS_COM_ESTRUTURA`) trava esse limite explicitamente, pra não
virar esquecimento silencioso.

**O formulário é ÚNICO, não um wizard passo-a-passo.** O wizard do orçamento
(`blocos.$cat.tsx`) faz uma pergunta por tela porque constrói do zero, sem
nada ainda escolhido. Aqui é edição de um registro que já existe (ou nasce
com um padrão razoável de `configPadrao()`) — os campos relevantes aparecem
e desaparecem no MESMO formulário conforme a escolha (trocar "Porta" por
"Elevador" troca os campos abaixo na hora), seguindo EXATAMENTE a mesma
régua condicional de `barreiraSteps()` do wizard, só que sem trocar de
tela a cada resposta.

**A lógica pura foi para fora do componente** — `blocoCliente.ts`
(`configPadrao`, `barreiraCompleta`, `configValida`) — pelo motivo de
sempre neste projeto: testável sem montar React. A asserção mais importante
do lote não testa uma regra isolada, testa a PROMESSA do editor: toda
config que `configValida` aprova PRECISA gerar um `codigo_bloco` de
verdade — se um dia "válido" mentisse, o botão Salvar ficaria habilitado
pra gravar um bloco com buraco (`"PED-1B-PORP-undefined-FAC-PR"`), do jeito
que a validação existe pra impedir.

**A prévia ao vivo.** Código e descrição são recalculados a cada mudança de
campo (`useMemo` sobre `gerarCodigoBloco`/`gerarDescricaoBloco`), antes de
salvar — "bati tudo certo?" fica auditável na hora, não só depois de gravar.
`salvarConfigBloco` grava `codigo_bloco` E `descricao`, os DOIS derivados da
config — a `descricao` em texto livre é sobrescrita a partir do momento em
que o bloco vira estruturado, porque manter as duas (a estruturada e a
digitada à mão) divergindo é exatamente a ambiguidade que a estrutura existe
pra eliminar.

**O que fica para depois, fora do escopo desta rodada** (Davi foi explícito:
"por enquanto"): o técnico escolher o bloco ao abrir uma corretiva, e o
checklist de preventiva GERADO a partir desta estrutura (hoje o checklist já
agrupa por sistema, mas não lê `config_bloco` — só o nome).

1042 asserções (43 novas), build ok.

### U53 — Painel Comercial vira lista única (R64, 2026-08-22)

"Nessa tela tem 3 botões redundantes... Remova os 3! Deve ser uma coisa
única... desde as que têm visita técnica pendente até as que a proposta já
foi enviada (onde o ciclo se encerra). Tudo na mesma lista."

**O modelo primeiro.** O ciclo virou vocabulário executável em
`features/comercial/etapas.ts`: `etapaDaVisita()` deriva a etapa do que o
banco JÁ guarda — `visita_pendente` (pendente/em_andamento) →
`aguardando_aprovacao` (concluida/aguardando) → `falta_proposta` (aprovada
sem envio) → `enviada` (`proposta_enviada_em` preenchido, TERMINAL) — e o
chip de filtro, o chip de cada linha e o funil contam todos DESTA função:
não têm como discordar entre si. Duas regras não-óbvias, ambas travadas:

- **`proposta_enviada_em` vence o status.** Depois do envio o status
  continua "aprovada" no banco (nenhum fluxo o troca) — sem a precedência,
  toda proposta enviada leria "falta enviar" para sempre.
- **O funil é cumulativo.** A enviada conta como aprovada — funil é régua
  de progresso, não fotografia de estado; um estágio 2 menor que o 3 lê
  como erro de conta.

**O que saiu e por quê:**
- As duas ABAS. "Visitas e propostas" seria aba única (botão para lugar
  nenhum); "Prospecção" saiu da interface — `ListaProspeccao.tsx` e
  `features/prospeccao/data.ts` apagados (só esta tela os usava), a tabela
  `prospeccoes` intacta no banco, e o trabalho de prospecção continua nos
  chamados de natureza comercial, na Início. `/prospeccao` redireciona para
  o painel direto (o search `?aba=` deixou de existir).
- O botão "Histórico" — terceira porta para a mesma lista de visitas.
  `/historico` continua vivo por URL (a linha em telas.ts fica).
- **"Aceitas 0 · Recusadas 0" do funil.** O Davi confirmou o que a R38 já
  tinha decidido: o sistema NÃO mapeia o resultado no cliente. A coluna
  `proposta_resultado` existe no banco, mas nenhum fluxo a preenche desde a
  R38 — os dois estágios mostravam zero eternamente, fingindo um dado que
  não existe. O funil agora termina em Enviadas, e a nota diz isso com
  todas as letras. (A régua da memória segue: aprovação é interna, nunca
  "negócio fechado".)

**A manutenção geral** (o pedido de "respeitar tudo"):
- `.sangra-x` — era a única tela do domínio fora da régua de margem.
- Título 24px/letterSpacing 0.05em → 22/600/-0.01em (§3 do design system).
- `STATUS_CONFIG` tinha UMA cor por status — `#F8C811` como texto também no
  claro, ~2:1 de contraste (anti-padrão §8 nº 3, em produção). As etapas
  têm pares claro/escuro + véu 12%/borda 30% (§2.4), com ícone junto da cor.
- Os 3 cards de estatística (Pendentes/Em Andamento/Concluídas — zerados,
  porque contavam por status cru que quase nenhuma linha tem) viraram os
  chips de filtro com contagem por ETAPA, o padrão de Clientes: o mesmo
  número, só que clicável e verdadeiro.
- Cards da lista em `card(isLight)` (a superfície padrão de lib/ui) +
  `.elevavel`, cores hardcoded (#9ca3af) trocadas por tokens de tema, linha
  enviada mostra a DATA do envio na linha de meta.

1065 asserções (26 novas), build ok.

### U54 — Dashboard 100% dinâmico + o documento estrutural (R65, 2026-08-22)

"Tudo do dashboard deve ser dinâmico... crie este documento estrutural para
no futuro facilmente criarmos outros dashboards exatamente da mesma
estrutura. O que você adicionar no documento já agregue ao atual dashboard."

**O código primeiro, o documento como espelho** — regra que o próprio pedido
impôs: nada entra no `docs/DASHBOARD.md` que não esteja implementado e
travado por asserção. O documento é descrição, não aspiração.

**A generalização do drill-down.** R60 tinha dado clique aos 4 quadrados de
KPI com a garantia "quem conta é quem filtra". R65 estende o mesmo gesto às
duas outras peças do painel — cada BARRA da Demanda no tempo e a ROSCA da
meta — generalizando o estado para um tipo só:
`SelecaoPainel = {tipo:"kpi"} | {tipo:"semana"} | {tipo:"meta"}`. Um estado
único (não três soltos) é o que garante que nunca há duas peças ativas
brigando pela lista. `atividadesDaSelecao()` despacha para as mesmas funções
que desenham os números; `rotuloDaSelecao()` nomeia a faixa "Mostrando:".

**O que precisou sair da tela para virar puro**: o lado FUTURO das barras
era um acumulador inline no `GraficoDemanda` (`futuros[k]++`). Virou
`prazosPorSemana()` em `metricas.ts`, ao lado de `concluidosPorSemana()` —
e os dois predicados (concluída-na-semana / prazo-na-semana) são
compartilhados com `atividadesDaSemana()`, a função do clique. As asserções
CRÍTICO travam as três igualdades: barra do passado, barra do futuro e
rosca (`atividadesDaMeta().length === metaDoMes().total`).

**Alvo generoso**: o botão da barra é a COLUNA inteira (número + barra +
rótulo) — clicar numa barra de 3px de altura (semana zerada) não pode exigir
pontaria. A rosca virou o card inteiro, desabilitado quando não há meta no
mês (não há o que abrir). Ambos `<button aria-pressed>`, anel de ativo na
própria cor (barra: cor de texto da semana; rosca: dourado — o mesmo
vocabulário dos tiles).

**Movimento**: a ALTURA das barras anima
(`height .45s cubic-bezier(.22,1,.36,1)`) — declarada FORA do media de
hover, de propósito: mudar qualquer recorte (pessoa, equipe, busca, uma
seleção do painel) faz as barras ESCORREREM para o novo valor também no
toque, onde hover não existe. O detalhe de CSS que quase virou bug:
declarar `transition` de novo dentro do media de hover SOBRESCREVERIA a
lista inteira (transition não compõe) — a lista completa vive numa
declaração só, e `prefers-reduced-motion` reduz para box-shadow.

**O documento** (`docs/DASHBOARD.md`): fundo (as 4 camadas do Yellow Glow e
a regra "nenhum painel pinta fundo de página"), a régua (--rail/--topo/
sangra-x), superfícies (card()/vidro(), .textura só em área), a faixa de
painéis (composição, ALTURA=252, wrap), cor (ESPECTRO invertido nas barras/
ordem original na rosca, PRISMA nos KPIs, um-amarelo-só), tipografia e
espaçamentos canônicos, os 4 estados de toda peça (repouso/hover/ativo/
desabilitado), a INVARIANTE com a tabela peça→função, a semântica do
drill-down (local, toggle, zera na troca de base, substitui em vez de
compor), movimento, os dados (recorteDosPaineis: QUEM, nunca QUANDO) e o
checklist de 10 passos para o próximo dashboard.

1087 asserções (22 novas), build ok.

### U55 — Painel Operacional vira dashboard (R66, 2026-08-22)

"A partir do documento gerado [DASHBOARD.md], vamos alterar a página do
painel operacional. Os 4 KPIs devem ficar em 2 colunas de 2. E aí eu quero
que você una todos os indicadores de campo, o atual gráfico de linhas, forme
gráficos de bons insights e monte esse dashboard na parte superior da tela.
A tela deve listar os chamados técnicos, abaixo do dashboard."

**A prova de que a receita generaliza.** O `DASHBOARD.md` da U54 tinha uma
promessa embutida: "para que o PRÓXIMO dashboard nasça com exatamente a
mesma estrutura, sem arqueologia no código". Esta é a primeira vez que a
promessa é testada — e ela se sustentou sem precisar reabrir o documento:
`card(isLight)` + `.elevavel`, PRISMA nos KPIs, `<button aria-pressed>` com
anel na própria cor quando ativo, "Mostrando: … · limpar" acima da lista.
Nada disso é específico da Início.

**Os 4 KPIs saíram do `PainelBase`.** Antes, `numeros: NumeroPainel[]` ia
para o componente compartilhado (Operacional/Comercial/Administrativo) e
virava a fileira `.painel-numeros` (auto-fit, sem clique). Trocar ISSO por
um grid 2×2 clicável só para o Operacional exigiria uma prop nova no
componente dos três painéis, ou o Operacional passar a montar seu próprio
grid por fora. Escolhi a segunda: `numeros={[]}` (o `PainelBase` já esconde
a seção inteira quando a lista está vazia — não precisou tocar no
componente) e um grid bespoke dentro do próprio `painel.operacional.tsx`,
no mesmo espírito do `PainelKpis` da Início mas para `Chamado[]`, não
`Atividade[]`. Os dois domínios são tipos diferentes; extrair um componente
genérico agora seria abstração para um caso só — se o Administrativo pedir
o mesmo grid um dia, aí sim vale generalizar.

**A ordem do 2×2 não é a ordem antiga.** A fileira de 4-em-linha lia
"Abertos, Sem responsável, Prazo estourado, Urgentes". No grid 2×2 isso
deixaria vermelho (mais grave) ANTES de laranja (menos grave) na leitura de
cima para baixo — quebra a rampa de severidade que o `DASHBOARD.md` §5
documenta (azul→amarelo→laranja→vermelho). A ordem virou "Abertos, Sem
responsável, Urgentes, Prazo estourado": top-left é o mais frio, bottom-
right é o que arde — a MESMA leitura da Início, célula por célula.

**`chamadosDoKpi()` — a invariante chega no Painel Operacional.** Até aqui,
`calcularIndicadores()` calculava `abertos`/`atrasados`/`semResponsavel`/
`urgentes` com filtros escritos ali mesmo, sem nenhuma outra peça da tela
lendo o mesmo predicado — não havia o que discordar, porque não havia uma
segunda leitura. Agora existe: o clique no KPI precisa abrir exatamente a
mesma lista que o número anuncia. Em vez de escrever esse filtro de novo,
`chamadosDoKpi(chave, chamados, agora)` virou a ÚNICA implementação, e
`calcularIndicadores()` foi reescrita para CHAMÁ-LA — não para duplicá-la.
As asserções CRÍTICO comparam os 4 pares diretamente.

**Por que a lista abaixo tem um padrão, não "tudo".** `chamados` (natureza
campo) tem TODO histórico, aberto e fechado. Uma lista de "todos os
chamados de campo desde sempre" embaixo do dashboard seria uma segunda
central de histórico competindo com o Painel de chamados — e a pergunta que
esta tela responde é operacional ("o que precisa de mim agora"), não
arquivística. O padrão é `chamadosDoKpi("abertos", …)`, e como os outros 3
KPIs são subconjuntos de "abertos" por construção, clicar neles ESTREITA a
lista em vez de trocar de universo — nunca há um KPI cujo clique amplie a
lista para fora do que a tela já mostra. Um link "Ver todos os chamados →"
leva ao Painel de chamados para quem quer o histórico completo.

**Os gráficos que valeram a pena, e os que não.** Fluxo do mês (Entraram ×
Concluídos) e Reincidência (cliente × retornos) já eram pares
categoria→número — virar barra horizontal foi direto, mesmo vocabulário de
"Em aberto por técnico". Backlog ganhou uma conta NOVA
(`idadePorFaixa()`): em vez de só "idade típica" (mediana) e "mais antigo"
(máximo), um histograma de 4 faixas (0–7/8–15/16–30/31+ dias) mostra ONDE a
fila está concentrada — dois backlogs com a mesma mediana podem ter formas
opostas (uma cauda longa de 3 chamados muito velhos, ou 20 chamados
igualmente de 20 dias), e só o histograma distingue os dois casos.

Ritmo (até começar/executando) e Cumprimento de prazo **ficaram como
estavam** — o segundo já tinha barra de progresso, o primeiro é literalmente
2 números medianos sem uma distribuição barata para desenhar. "Forme
gráficos de bons insights" não é "troque todo número por um gráfico": um
gráfico de uma barra só não é mais insight que o número, é o número com
mais peso visual e menos densidade de informação por pixel.

**A ordem da lista** (`ordenarChamados`) não é a ordem de chegada
(`created_at DESC`, como a consulta devolve) — é atrasado primeiro (o mais
velho atraso na frente, por ser o que mais precisa de ação), depois próximo
do prazo, depois no prazo, e sem prazo por ÚLTIMO (não tem urgência para
anunciar, então não empurra quem tem).

**Um `agora` só por render.** `calcularIndicadores`, os 4 KPIs,
`idadePorFaixa` e `ordenarChamados` são chamados várias vezes no mesmo
componente; sem um `agora` compartilhado (`useMemo(() => new Date(),
[chamados])`), cada chamada pegaria seu próprio `new Date()` — e um chamado
no limite exato do prazo poderia, em teoria, contar de um jeito num quadrado
e de outro na lista. Baixíssima chance na prática, mas a garantia "quem
conta é quem filtra" perde força se ela só vale a maior parte do tempo.

1113 asserções (26 novas), build ok. TypeScript sem erro novo (os 85 erros
pré-existentes de `types.ts` desatualizado, em outros arquivos, seguem os
mesmos). Não verificado em navegador nesta rodada — sem ferramenta de
browser disponível na sessão; Davi, dá uma olhada na tela quando puder.

### U56 — O dashboard cabe no topo, e a lista é a tabela da Início (R67, 2026-08-22)

"A tela de painel operacional deve ter o dashboard todo na parte superior da
tela, ou seja os campos precisam ser menores, otimize o layout. A parte
superior da tela deve ser o dashboard, e a parte restante deve ser
visualização dos itens em lista das atividades. Inspire-se no layout da
página início."

**O que a U55 errou.** A U55 acertou o CONTEÚDO (2×2, gráficos no lugar de
números soltos, lista embaixo) e errou a ESTRUTURA: manteve o empilhamento
de cards de altura livre que a tela já tinha. Dez cards, cada um decidindo a
própria altura, davam um dashboard de umas três telas — e a lista, que era a
novidade, nascia fora de qualquer dobra. Ler o `DASHBOARD.md` e implementar
o vocabulário dele (cores, clique, invariante) sem implementar a **régua**
dele foi o furo: o §4 não é decoração, é o que faz um dashboard TERMINAR.

**A ALTURA única é a regra que faltava.** `const ALTURA = 216`, e todo
painel das duas faixas herda por um `PAINEL` compartilhado — não por
repetição. Um painel que declare a própria altura transforma a fileira numa
colagem, e foi exatamente o que a U55 tinha. 216 e não os 252 da Início
porque lá são quatro painéis numa faixa e aqui são sete em duas: 2×216 + gap
= 446px, o dashboard acabando dentro da primeira tela de um notebook.

**As três fusões que deram o espaço.** Encolher fonte não resolveria — o
problema era a CONTAGEM de caixas, não o tamanho delas:

1. **Fluxo do mês + Ritmo + Cumprimento de prazo → um painel.** Os três eram
   pares rótulo→número sem distribuição: seis micro-números num grid 3×2
   dizem o mesmo que três cards, num terço da altura. A barra de %-no-prazo
   sobreviveu, fina, no pé do painel — ela é a única das três que tinha uma
   peça gráfica de verdade.
2. **O card largo "Duplas de campo" morreu.** Ele existia para hospedar o
   botão "Cadastrar duplas" e uma frase de estado. O botão foi para o
   cabeçalho do gráfico de duplas (botão de manutenção pertence à peça que
   ele mantém) e a frase de estado virou o estado vazio DENTRO do gráfico.
   Uma faixa inteira de altura livre virou zero pixel.
3. **A rosca perdeu a legenda de baixo.** Arco + legenda empilhados pediam
   ~300px; arco + legenda LADO A LADO cabem em 216 com folga, e a legenda
   continua nomeando cada fatia (identidade nunca só pela cor, §9).

**Consequência de projeto que valeu registrar**: o gráfico de duplas não
some mais quando não há dupla cadastrada. Antes ele sumia e o card largo
acima explicava o que fazer; sem esse card, e numa faixa de altura única, um
painel que some desequilibra a fileira. Então o painel fica e o vazio se
explica dentro dele. A asserção da U47 que travava o comportamento antigo
foi REESCRITA para a regra nova — a regra de verdade nunca foi "o painel
some", era "moldura de gráfico vazia não pode ficar sem uma palavra sobre o
próprio vazio", e essa continua valendo.

**A lista é a tabela da Início — a MESMA, não uma irmã.** `TabelaAtividades`
já resolve nove colunas alinhadas, cabeçalho `sticky`, ordenação por coluna
e rolagem lateral no envelope (U33). Escrever uma lista de chamados própria
aqui — que foi o que a U55 fez, com linhas de dois andares — criaria a
segunda implementação da mesma tabela, e a segunda fica um passo atrás da
primeira na primeira mudança de coluna. Como ela fala `Atividade`, os
chamados passam por `atividadeDoChamado()`, o mesmo montador da Início:
status, cor e rótulo saem de um lugar só. O clique abre o `PainelChamado`
deslizante (também como na Início), que leva à página completa quando é
preciso — triagem sem sair do painel.

O `ctx` da montagem vai com `apoios`/`fichas` vazios de propósito: esta tela
não tem noção de "eu" (`souResponsavel`/`souApoio` não são lidos aqui), e
chamado de campo nunca é pedido de compra, que é o que a ficha decide. O
`apoiosDoChamado` real entra, porque a coluna "Apoio" da tabela o usa.

**O que NÃO mudou**: os quatro KPIs continuam clicáveis e continuam
filtrando a lista pela mesma função que os conta (`chamadosDoKpi`, a
invariante da R66); a faixa "Mostrando: … · limpar" continua anunciando o
recorte; `idadePorFaixa` e `ordenarChamados` seguem como estavam.

1126 asserções (13 novas, 3 reescritas), build ok, TypeScript sem erro novo.
Não verificado em navegador — sem ferramenta de browser na sessão.

### U57 — O degradê da casa nos gráficos SVG (R68, 2026-08-22)

"Aplique o mesmo gradiente que tem no gráfico de rosca e no gráfico de
barras da página INÍCIO... nos gráficos de linha, barra e rosca do painel
operacional. Remova o campo de backlog por idade e o campo de reincidência
30D... adicione um gráfico de barras... sobre chamados abertos por cliente...
Remova o título Painel Operacional, remova o subtítulo, suba o dashboard...
a lista deve começar no máximo na metade da tela. Quero ver o degradê
igualzinho o do início em tudo!"

**Por que o degradê não "atravessava" sozinho.** A Início pinta as barras
com `<div>` + `gradienteBarra()` (CSS) e a rosca com SVG escrito à mão. O
Painel Operacional é todo recharts, e recharts pinta em SVG: `fill` e
`stroke` de SVG **não aceitam `linear-gradient()`** — a peça tem de
referenciar um `<linearGradient>` por `url(#id)`. Ou seja, "o mesmo
gradiente" não era copiar uma string de CSS; era ter a rampa nos dois
idiomas.

Daí **`paradasBarra(i, isLight)`** em `paleta.ts`, ao lado de
`gradienteBarra`: devolve as paradas (`<stop>`) da peça *i*, com a MESMA
regra da emenda. Isso importa mais do que parece — a rampa tem uma costura
entre as amostras 1 e 2 onde interpolar em sRGB **passa pelo verde**, e
`gradienteBarra` já conserta isso inserindo a parada acromática `COSTURA` no
meio. Uma implementação SVG escrita à parte teria reintroduzido o bug em
silêncio, porque o verde só aparece no miolo de UMA peça em oito. Há
asserção travando que as duas funções concordam sobre quem cruza a emenda,
nos dois temas: SVG e CSS não podem discordar.

**Onde a rampa entrou, e onde NÃO entrou.** Entrou nos três tipos de
gráfico: fatia da rosca, barra deitada e traço de linha — cada peça no seu
passo, `ESPECTRO[i] → ESPECTRO[i+1]`, então a série lê como um degradê
contínuo, igual às barras da Início. Não entrou nos 4 KPIs, que ficam no
PRISMA: ali azul→amarelo→laranja→vermelho é escala de SEVERIDADE, não série
de dados, e trocar por rampa apagaria a amarração "vermelho aqui = os cards
vermelhos ali". Também não entrou em "Sem técnico"/"Sem cliente", que
seguem neutros — ausência de identidade não é mais uma identidade (§9).

Dois detalhes que o SVG cobra: o `<defs>` precisa de **prefixo de id por
gráfico** (dois `<defs>` com o mesmo id fazem o segundo gráfico herdar as
cores do primeiro, sem erro nenhum), e ponto/legenda de linha não levam
`url(#…)` de forma confiável — levam a cor sólida do passo, que é o início
do degradê daquela linha. A legenda da rosca leva o degradê de verdade, em
CSS, via `gradienteBarra`: legenda apontando para uma cor que não existe no
gráfico é pior que legenda nenhuma.

**Os dois painéis que saíram.** "Backlog por idade" e "Reincidência 30d"
deram lugar a **um** gráfico: chamados em aberto por cliente. `idadePorFaixa`
foi removida junto — ela tinha nascido na U55 para aquele painel e não tinha
outro consumidor. `reincidencia` FICOU no módulo puro, e a diferença é
proposital: ela é anterior, tem rationale próprio documentado e o módulo já
expõe indicadores que nenhuma tela desenha hoje (`idadeMediana`,
`encalhados`). Registrei isso no cabeçalho de `indicadores.ts` — o módulo é
a biblioteca de indicadores de campo, não o espelho do layout da vez.

`abertosPorCliente()` resolve o "somente os clientes que têm" **pela
estrutura**, não por filtro: o `Map` só ganha chave de cliente que apareceu,
então quem não tem chamado aberto não existe no resultado — sem precisar
cruzar com a lista de clientes. O balde `clienteId: null` fica, em neutro:
descartá-lo faria as barras somarem menos que "chamados em aberto", que é o
gráfico sumindo com trabalho em silêncio. Asserção CRÍTICO trava a soma
contra `chamadosDoKpi('abertos')`.

**O orçamento vertical virou número, e o teste refaz a conta.** Título e
subtítulo saíram (`PainelBase` ganhou `titulo` opcional, e encolhe o respiro
de cima junto — os outros dois painéis seguem com o deles). A altura das
faixas caiu de 216 para **168**. E o contrato "a lista começa no máximo na
metade da tela" deixou de ser prosa: a asserção soma `2×ALTURA + gap +
respiro + --topo` e exige ≤ 384 (metade de um notebook de 768). Foi ela que
pegou meu primeiro chute — 172 dava 388, quatro pixels acima. Uma regra de
layout que o verificador refaz é a única que não apodrece: subir a altura
dos painéis agora quebra o teste, em vez de quebrar a tela em silêncio.

**O `DASHBOARD.md` cresceu junto**, como manda a regra da U54 (nada entra no
documento sem estar implementado e travado): a seção de cor ganhou o caso
SVG, a da faixa ganhou "a ALTURA sai de um orçamento" e "título é opcional",
e o checklist ganhou o `paradasBarra` no passo 5.

1155 asserções (29 novas, 5 reescritas), build ok, TypeScript sem erro novo.
Não verificado em navegador — sem ferramenta de browser na sessão.

**CORREÇÃO, no mesmo dia (o Davi abriu a tela e não havia degradê nenhum).**
Duas armadilhas do SVG, as duas SEM erro de console — o pior tipo:

1. **`<defs>` embrulhado em componente próprio é descartado.** Eu tinha
   escrito `<DegradeEspectro/>`, um componente que devolvia o `<defs>`.
   Recharts filtra os filhos do gráfico por `isString(child.type)`
   (`isSvgElement`, em `util/ReactUtils`): só passa elemento SVG LITERAL. Um
   componente tem `type` de função → os quatro `<defs>` foram descartados em
   silêncio → todo `url(#id)` resolveu para nada → barra sem preenchimento,
   rosca sem anel, linha sem traço. A pista estava na própria tela: os
   PONTOS da linha apareciam e o traço não — e ponto usa cor sólida,
   enquanto traço usava `url()`.

2. **Linha toda no zero somiria mesmo depois do conserto.** Com o padrão
   `objectBoundingBox`, o SVG não desenha degradê sobre caixa de área nula, e
   uma linha achatada no zero tem altura zero. Como as duplas do Davi estão
   todas em zero nas 12 semanas, o traço continuaria invisível. As linhas
   passaram a `gradientUnits="userSpaceOnUse"`, medido na viewport do
   gráfico em vez da caixa da peça. Barra e fatia ficaram no padrão: caixa
   nula lá só acontece com valor zero, e aí não há o que pintar.

Confirmei os dois com um render de fato (`renderToStaticMarkup` dos três
gráficos, fora do app): `<defs>` literal → 2 `<linearGradient>` no SVG e os
`fill="url(#…)"` apontando para eles; `<defs>` em componente → **zero**
gradientes, reproduzindo o bug exatamente. Asserção de texto não pegaria
isso sozinha, então as novas asserções travam a FORMA do JSX (`<defs>`
literal, nenhum componente-embrulho, `userSpaceOnUse` na linha).

**Um terceiro defeito apareceu na mesma tela**: o ranking de técnicos
mostrava 3 nomes com 5 responsáveis na lista — recharts esconde rótulo de
categoria quando o painel é baixo. `interval={0}` no eixo resolve. Ranking
que omite nome em silêncio mente sobre quem está na lista.

`DASHBOARD.md` §5 ganhou as duas armadilhas por escrito: elas vão morder
o próximo gráfico em SVG do sistema, e nenhuma delas dá erro.

1161 asserções, build ok.

### U58 — "Abertos por cliente" ocupa as duas faixas (R69, 2026-08-22)

"O campo de abertos por cliente deve ocupar as duas linhas do dashboard,
reduza a largura do fila por status e fluxo e ritmo."

O dashboard virou **duas colunas**: as duas faixas empilhadas à esquerda, o
"Abertos por cliente" à direita ocupando a altura das duas. Foi a escolha
certa de painel para crescer — cada cliente é uma barra, então altura vira
informação direta: o teto subiu de 5 para **12 clientes**, com um teto
próprio (`TETO_BARRAS_ALTO`) em vez do das faixas de uma linha.

**A altura dele é DERIVADA, não digitada.** `ALTURA_DUPLA = ALTURA * 2 +
GAP`. Escrever 350 ali funcionaria hoje e se descolaria na primeira vez que
`ALTURA` ou o gap mudasse — e o sintoma seria sutil: o painel terminando
alguns pixels antes ou depois da faixa 2, que é exatamente o tipo de
desalinhamento que ninguém reporta e todo mundo sente. O gap virou constante
(`GAP`) pelo mesmo motivo: dois lugares digitando 14 são dois lugares para
esquecer um. Asserção CRÍTICO trava a derivação.

**O que quebra primeiro, quando falta largura.** A coluna esquerda tem base
700px — o mínimo em que a faixa 1 cabe numa linha (KPIs 244 + fila 210 +
fluxo 216 + 2 gaps = 698, conferido por asserção). Abaixo disso quem quebra
para baixo é o painel da direita, não as faixas: faixa quebrada viraria três
linhas à esquerda contra duas de altura à direita, e o painel alto pararia
no meio do nada. `minWidth: 0` na coluna esquerda mantém a promessa do
design system de a página nunca rolar de lado.

1170 asserções (9 novas, 2 reescritas), build ok.

### U59 — Importação retroativa das 227 OS de manutenção (R70, 2026-08-22)

"Importe todos os chamados contidos na lista do arquivo lista-OS-retroativo.
Como os chamados não têm título, coloque todos os títulos sendo o tipo de
demanda. Além disso, considere todos os itens 'Instalação' como
'Implantação'."

Entregue como migration
(`20260822070000_u59_importacao_os_retroativo.sql`), na convenção do
projeto: o Davi roda no SQL Editor da Lovable e lê os SELECTs do fim. Não
apliquei direto no banco — a chave de serviço está na pasta pai, mas gravar
227 linhas em produção sem ele ver o de→para primeiro é o tipo de coisa que
não se desfaz com Ctrl-Z. (A migration traz o `DELETE` de desfazer no rodapé,
mesmo assim.)

**O de→para.** Tipo: `Manutenção Corretiva`→`corretiva` (220),
`Manutenção Preventiva`→`preventiva` (3), `Instalação`→`implantacao` (4).
Título = o rótulo do próprio tipo, que é a regra 1 — e como a regra 2 manda
"Instalação" virar "Implantação", o rótulo das 4 é `Implantação`: a palavra
"Instalação" não sobrevive em nenhuma linha de dado (travado por asserção).

**O QUE EU ME RECUSEI A INVENTAR** — foi a maior parte do trabalho:

1. **prazo_limite fica NULO.** O trigger `chamado_preencher` calcula prazo de
   SLA a partir do `created_at` quando ele vem nulo. Deixá-lo rodar daria às
   227 um prazo que nunca existiu — e pior: `pctNoPrazo` conta exatamente
   quem tem prazo E conclusão, então o "Cumprimento de prazo" do painel
   passaria a ser dominado por 227 medições fabricadas. Por isso a migration
   DESLIGA esse trigger durante a carga.
2. **iniciada_em fica NULO.** O `duracao_horas` do arquivo é tempo de CICLO
   (abertura→fechamento), não esforço — o README do dataset avisa isso. Se eu
   usasse a abertura como início, "tempo até começar" viraria 0h nas 227 e
   apagaria um indicador que hoje diz a verdade.
3. **contrato_id fica NULO**: `contrato_vigente()` devolve o contrato de
   HOJE, e amarrá-lo a serviço fechado há três meses inventaria vínculo de
   cobrança.
4. **Casamento ambíguo não escolhe ninguém.** É a regra do importador do
   Notion, e vale para pessoa e cliente: dois perfis batendo com um primeiro
   nome → nenhum. Responsável errado é pior que responsável em branco, porque
   campo preenchido ninguém confere.

**Duas coisas que quase passaram batido, e que valem registro:**

- **O trigger de notificação.** `notify_chamado` dispara no INSERT sempre que
  há responsável. Sem desligá-lo, os quatro técnicos receberiam 227 sinos de
  "Novo chamado para você" por trabalho terminado meses atrás. Desligado
  também o de `chamado_apoios`, pelo mesmo motivo.
- **A numeração fora de ordem.** Minha primeira versão chamava
  `proximo_numero_chamado()` na lista de seleção com `ORDER BY data_abertura`.
  A função é VOLATILE, e o momento em que o Postgres avalia função volátil de
  target list em relação ao Sort **não é garantido** — a numeração poderia
  sair embaralhada em silêncio. Troquei por reserva em bloco: o contador
  avança uma vez pelo total e cada linha recebe `base + row_number()` na
  ordem de abertura. O contador é o mesmo do app, então o próximo chamado
  aberto na tela continua de onde a importação parou.

Aproveitei duas peças que já existiam em vez de reinventar: `resolver_tecnico()`
(U0), que olha os apelidos de `tecnico_aliases` antes do nome exato, e
`normalizar_texto()`, o gêmeo SQL do `normalizarChave` do app. Quando um nome
só casa por primeiro nome ("Breno" → "Breno Goes"), a migration **cadastra o
alias**, que é para isso que a tabela existe — a próxima importação acerta de
primeira.

Também tinha escrito `HAVING count(*) = 1` dentro de subconsulta escalar sem
`GROUP BY` para exigir casamento único: isso não é SQL válido (a coluna do
SELECT não estaria agrupada). Virou `CASE WHEN count(...) = 1 THEN
(array_agg(...))[1] END`.

1190 asserções (20 novas). Não executada — é o Davi quem roda.

### U60 — Clientes: lista que cabe, filtro no botão, bolinha no degradê (R71, 2026-08-22)

Cinco pedidos numa tanda só. Os três primeiros são o MESMO problema visto de
ângulos diferentes: **falta de altura**.

**De onde a altura veio.** O `<main>` (route.tsx) reserva `paddingBottom:
110` para a barra de navegação do celular — e essa barra é `.so-celular`,
que some a partir de 1024px. No desktop, portanto, toda página termina 110px
antes do fim da janela sem nada ocupando aquilo. `.clientes-tela-fixa` devolve
quase tudo com uma margem negativa e deixa 16px de respiro.

Cancelar isso no `<main>` seria mais limpo e eu não fiz de propósito: mexer
lá muda TODAS as telas de uma vez, e algumas podem depender daquele espaço.
A margem negativa fica contida nesta página, que é a que o Davi está olhando.

**A lista deixou de rolar.** `grid-template-rows: repeat(10, minmax(0, 1fr))`
divide a altura em dez faixas e cada cartão preenche a sua. O detalhe que faz
funcionar é o **`minmax(0, …)`**: `1fr` sozinho tem piso `auto`, então a
faixa nunca ficaria menor que o conteúdo natural do cartão e a lista voltaria
a estourar a coluna — a rolagem sumiria da lista e reapareceria na página.
As dez faixas existem mesmo com menos de dez resultados, e é isso que mantém
o cartão com a mesma altura em todas as páginas.

O cartão teve de encolher para caber: virou duas linhas. A terceira linha
(tipo do local e síndico) não foi descartada — foi **emendada no texto do
endereço**, que trunca com reticências. Jogar fora seria mais fácil e
apagaria dado que a ficha tem.

**Os filtros foram para trás de um botão redondo**, ao lado da busca (que
subiu para a linha do título). A faixa de chips ocupava altura permanente
para responder uma pergunta que quase sempre está em "Todos". O que esse
tipo de mudança sempre arrisca é esconder um recorte ativo — então o botão
**acende um ponto dourado** quando há filtro, e o painel aberto oferece
"Limpar filtros". Sem isso, "sumiu cliente da lista" viraria mistério.

**O mapa abre com zoom.** `vistaInicial()` entrou em `mapa-zoom.ts`, junto do
resto da matemática pura: ela compõe `zoomEm` (que centraliza) com
`limitarTransform` (que prende na moldura) — reimplementar a conta no
componente é como um mapa abre torto, ancorado no canto em vez do meio. O
"resetar" passou a mirar essa vista, e o `semAlteracao` (que desabilita o
botão) a comparar com ela: voltar para `IDENTIDADE` levaria a um zoom que a
tela nunca mostra sozinha.

**A bolinha.** Saíram o halo (círculo de r=13 em 22%) e o contorno
branco/escuro do ponto no mapa, e o `boxShadow` da bolinha da lista. O que
ficou é a bolinha no DEGRADÊ — e para isso `cores.ts` mudou de devolver a cor
pronta para devolver o **passo** da rampa: a peça i vai de `ESPECTRO[i]` a
`ESPECTRO[i+1]`, e sem o índice não dá para desenhar o par. O hash passou de
`% 9` para `% PECAS_ESPECTRO` (8) pelo mesmo motivo — a nona amostra é o fim
da última peça, não o começo de uma nona. Isso muda a cor de alguns clientes,
o que é esperado.

No mapa, os oito `<linearGradient>` saem de `paradasBarra` (o mesmo caminho
SVG dos gráficos, costura inclusa) e ficam **fora do `<g>` que recebe o
zoom** — `<defs>` não desenha nada, e o degradê de cada bolinha é medido na
caixa dela, então não escala junto com o mapa.

Quatro asserções da R55/R60 descreviam o comportamento antigo (rolagem da
lista, painel de filtro sempre visível, os 110px) e foram **reescritas para a
regra nova**, não afrouxadas: travar altura só no desktop, cartão único para
os dois eixos de filtro, e a lista cabendo em vez de rolando.

1216 asserções (30 novas, 4 reescritas), build ok, TypeScript sem erro novo.
Não verificado em navegador — sem ferramenta de browser na sessão.

### U61 — Reimportação: os marcos de campo chegaram (R72, 2026-08-22)

"Rodei a U59 no SQL Editor, porém quero fazer uma alteração na importação:
adicionei a coluna de chegada e saída, além disso, os nomes dos clientes
estão mais consistentes agora. Refaça a importação."

O arquivo novo traz exatamente os dois campos que a U59 teve de deixar em
branco por não existirem: **chegada** e **saída** do técnico. Aquela decisão
("não invento hora de início a partir da abertura, senão 'tempo até começar'
vira 0h nas 227 e apaga um indicador verdadeiro") acabou de se pagar — o dado
real chegou e entra sem precisar desfazer nada.

O mapeamento respeita os três relógios que o modelo já separava:
`chegada → iniciada_em`, `saida → finalizada_em`, `data_conclusao →
concluida_em/fechada_em`. Colapsar isso num campo só teria misturado tempo
de campo com tempo administrativo, que é a distinção que o módulo de
indicadores existe para manter.

**ATUALIZA EM LUGAR, não apaga e reimporta.** Antes de decidir, conferi que
`os_id` continua estável entre as duas versões do arquivo: mesma abertura,
mesma conclusão, mesma conta e mesmo tipo nas 227 — só 42 nomes de cliente
mudaram (a padronização que o README documenta). Com isso, casar por
`origem_id` é seguro, e apagar seria destrutivo à toa: daria números CH-
novos com buraco na sequência, trocaria os ids (quebrando qualquer link que
já aponte para eles) e perderia o histórico de eventos.

**A guarda do título.** O Davi avisou que vai renomear os chamados um por um.
Uma migration idempotente que reescrevesse `titulo` incondicionalmente
apagaria esse trabalho na próxima vez que rodasse. Então o UPDATE só reescreve
enquanto o título ainda for um dos três rótulos automáticos — mesma guarda na
descrição, que só é regravada se ainda começar com "Importação retroativa ".

**Os triggers de UPDATE, que a U59 não precisava desligar.** Aqui o UPDATE
toca `responsavel_id`, e `trg_notify_chamado_upd` dispara em
`UPDATE OF responsavel_id`: seriam 227 notificações "novo chamado para você"
mais 227 linhas de histórico, por uma correção de importação. Desligados
junto com os de INSERT.

**Validação que aborta.** Se algum marco vier fora de ordem (chegada antes da
abertura, saída antes da chegada), a migration levanta exceção e não altera
nada. Sem isso a duração ficaria negativa e `indicadores.ts` descartaria a
linha em silêncio (ele filtra `h >= 0`) — o painel mostraria uma mediana
calculada sobre menos linhas do que se pensa, sem nenhum aviso.

A conferência final imprime as duas **medianas** que o painel vai passar a
mostrar, para bater contra o README do dataset (resposta ~1,83h, execução
~0,48h): se baterem, os marcos entraram certos.

Uma ressalva que o próprio README levanta e que repassei ao Davi: em parte
das linhas `saida - chegada` dá poucos minutos, o que sugere apontamento em
lote e não visita real. O dado entra como está — é o da operação —, mas
"Executando" precisa ser lido com essa ressalva.

1234 asserções (18 novas). Não executada — é o Davi quem roda.

### U62 — As lentes da lista: o histórico ganhou onde ser visto (R73, 2026-08-22)

"Rodei, mas não vejo nenhum chamado no painel operacional."

**A importação estava certa; a tela é que não tinha como mostrá-la.** As 227
OS são todas `Fechada` na origem e entraram como `concluido`. A lista do
Painel Operacional monta a partir de `chamadosDoKpi("abertos", …)` — por
decisão explícita da R66, "o foco operacional desta tela; histórico fechado é
o Painel de chamados". Só que fui conferir o Painel de chamados e ele também
lista só `emAberto`; e a Início poda encerrado com mais de 7 dias
(`DIAS_ENCERRADO`). Ou seja: **o sistema inteiro não tinha uma tela que
mostrasse chamado encerrado.** A R66 apontou para uma porta que não existe.

Isso é o tipo de buraco que só aparece quando entra dado de um tipo que a
interface nunca teve. Antes da importação, todo chamado encerrado era recente
e ficava visível na Início pelos 7 dias; ninguém sentiu falta.

**A correção**: a lista ganhou três lentes — Em aberto (padrão), Concluídos,
Todos —, cada uma com contagem no chip, e as contagens saem da MESMA função
que monta a lista (`chamadosDaLente`), como manda a invariante do
`DASHBOARD.md`. Duas amarrações que evitam o número mentir:

- **Clicar num KPI devolve a lente para "Em aberto".** Os quatro contam só o
  que está aberto; deixar um KPI ativo sobre a lente "Concluídos" abriria uma
  lista que não corresponde ao número que a pessoa tocou.
- **Escolher uma lente limpa o KPI** — só uma peça filtra por vez, a mesma
  regra do drill-down da Início.

**A ordem do histórico é outra.** `ordenarChamados` ordena por urgência de
prazo, e encerrado não tem urgência — pior, os 227 importados não têm prazo
nenhum, então empatariam todos e a lista sairia na ordem em que o banco
devolveu. `ordenarHistorico` ordena pelo mais recente
(`finalizada_em ?? fechada_em ?? created_at`), que é a única pergunta que se
faz de um arquivo.

Duas asserções da R66 descreviam o `kpiAtivo ?? "abertos"` que deixou de
existir e foram reescritas para a garantia nova — o KPI continua abrindo
exatamente o que conta.

1246 asserções (13 novas, 2 reescritas), build ok, TypeScript sem erro novo.

### U63 — Roda do mouse no mapa e rótulos sem contorno (R74, 2026-08-22)

"Arrume o scroll do mouse no mapa da tela de clientes. Deve dar para dar zoom
com scroll ou botão. Além disso, remova o contorno dos nomes dos bairros."

**A exigência de Ctrl era certa e ficou obsoleta.** Ela veio de uma revisão
adversarial (2026-08-21) com uma razão concreta: o mapa ficava ao lado de uma
lista que ROLAVA, e sem a exigência rolar a lista viraria zoom no mapa sempre
que o cursor passasse por cima dele — a maior parte da tela. Duas mudanças
posteriores derrubaram essa premissa **sem que ninguém revisitasse o
handler**: a R60 travou a página numa tela fixa (`overflow: hidden`) e a R71
tirou a rolagem da lista (as 10 linhas cabem). No desktop não sobrou nada
para rolar atrás do mapa; a proteção continuava lá guardando um problema que
já não existia.

Abaixo de 1024px a exigência **continua**, e não por conservadorismo: lá a
tela fixa não vale, a página rola de verdade e o mapa fica empilhado sobre a
lista. Uma janela estreita de notebook tem roda e página rolando ao mesmo
tempo. O breakpoint virou constante (`TELA_FIXA`) com um comentário amarrando
ao da classe: se um mudar sem o outro, a roda vira zoom numa página que ainda
rola — e há asserção conferindo que os dois existem.

**O contorno do rótulo não era enfeite.** Os nomes de bairro eram
`fill="#ffffff"` com `stroke` escuro em `paintOrder="stroke"`, e o comentário
original explicava por quê: o halo é o que dá contraste no tema CLARO, onde o
distrito é quase branco. Tirar só o `stroke` deixaria o nome invisível lá —
exatamente o anti-padrão nº 3 do design system (tom claro como texto sobre
fundo claro). Então a cor passou a seguir o tema
(`rgba(0,0,0,0.42)` / `rgba(255,255,255,0.50)`), com alfa baixo de propósito:
o rótulo é referência de fundo e tem de ficar atrás dos pontos de cliente na
hierarquia de leitura.

**Uma regressão minha, da R71, consertada de passagem.** O `touch-action` do
SVG era `noZoomMinimo ? "pan-y" : "none"` — no zoom mínimo o dedo é da
página, senão é do mapa. Quando a R71 fez o mapa ABRIR com zoom,
`noZoomMinimo` virou `false` já na abertura: no celular, arrastar sobre o
mapa deixou de rolar a página desde o primeiro segundo, prendendo quem só
queria descer até a lista. A pergunta certa nunca foi "está no zoom mínimo?"
e sim "**já mexeu no mapa?**" — que é o `semAlteracao` que a R71 mesmo já
calculava para desabilitar o botão de restaurar.

Cinco asserções descreviam o mundo antigo (Ctrl obrigatório, dica citando
Ctrl, rótulo branco fixo, halo com non-scaling-stroke, touch por zoom mínimo)
e foram reescritas para a regra nova. Uma sexta falhou por motivo bobo — meu
comentário novo empurrou o `userSelect` para fora da janela de 2300
caracteres da regex; era falso alarme, e a janela foi alargada.

1249 asserções (2 novas, 6 reescritas), build ok, TypeScript sem erro novo.

### U64/U65 — Apoio pela dupla, quadro kanban e 30 chamados de teste (R75–R77, 2026-08-22)

Três pedidos numa sequência: o mecanismo de apoio automático, um lote de
teste para o dashboard, e o modo kanban.

**A decisão que definiu o mecanismo foi uma frase do pedido**: "se um dia eu
mudar a dupla do Breno para o Denner, **desse dia em diante** o apoio
automático vai ser o Denner". Isso decide entre gravar e derivar.

A U47 estabeleceu que a DUPLA de um chamado é derivada do responsável — não
existe `chamados.dupla_id`, de propósito, para funcionar retroativamente. O
caminho "óbvio" era seguir a mesma regra para o apoio. Seria errado: trocar a
dupla do Breno reescreveria o passado, e todo chamado que o Luan atendeu
passaria a dizer "Denner". As duas regras convivem porque respondem perguntas
diferentes — a dupla (derivada) responde "de quem é este trabalho hoje", e é
agrupamento de gráfico; o apoio (gravado) responde "quem foi neste chamado",
e é registro. Registro não muda quando o cadastro muda.

O gatilho lê a tabela `duplas` NO MOMENTO da atribuição, e é isso que dá o
"sempre dinâmico" sem tocar no histórico.

**`chamado_apoios.origem` precisou existir** por causa da troca de
responsável: passar de Breno para Lucas tem de tirar o Luan e pôr o Paulo.
Sem marcar quem entrou automaticamente, remover o Luan exigiria apagar TODOS
os apoios do chamado — levando junto quem alguém pôs à mão. A coluna separa
as duas origens, e o gatilho só mexe no que ele mesmo criou. Pelo mesmo
motivo, o `ON CONFLICT DO NOTHING` deixa o apoio manual vencer: se o gatilho
tomasse posse dele, o removeria na próxima troca.

**Sem backfill, de propósito.** Preencher o apoio dos chamados que já existem
usaria a dupla de hoje para trabalho de antes — exatamente o erro que a
decisão de gravar evita. O comando fica no rodapé da migration, comentado,
para quem quiser correr o risco conscientemente.

**O quadro.** As quatro colunas pedidas (Não agendados · Agendados ·
Atrasados · Concluídos) não são o campo `status`: "atrasado" não existe como
status (é `situacaoPrazo`) e "não agendado" é a ausência de
`data_hora_agendada`. Virou `colunaOperacional()`, pura, com duas
precedências que valem registro: **concluído é destino final** (o prazo pode
ter estourado no caminho, acabou é acabou) e **atrasado vence agendado** — um
chamado marcado para terça que venceu continua vencido, e deixar a data
escondê-lo é o oposto do que a coluna existe para denunciar. Há asserção de
PARTIÇÃO: as quatro colunas cobrem tudo, sem duplicar e sem perder ninguém
(fora cancelado, que o pedido tirou).

No quadro, lente e KPI não valem — os dois recortam subconjuntos de "em
aberto" e esvaziariam três das quatro colunas. Clicar num KPI volta para a
lista, que é onde drill-down faz sentido.

**Os 30 de teste não são aleatórios de verdade, e isso é o ponto.** Sorteio
daria um lote plausível e provavelmente sem nenhum prazo estourado, nenhum
urgente e nenhum sem responsável — e o dashboard continuaria sem mostrar o
que sabe mostrar. O lote é escolhido para CONTER os casos: 4 atrasados, 3
urgentes, 3 sem responsável, 8 sem agendamento, 4 concluídos, os quatro
tipos. Há asserção conferindo que as quatro colunas do quadro nascem todas
com item — quadro com coluna vazia não demonstra que funciona.

Nada de id escrito à mão: os técnicos saem de MEMBROS DE DUPLAS ATIVAS (para
o gatilho da U64 ter par e o apoio automático aparecer sozinho, mostrando o
mecanismo) e os clientes saem da própria tabela. A migration aborta com
mensagem útil se não houver dupla cadastrada, em vez de criar 30 chamados
órfãos.

Um deslize que a própria verificação pegou: eu tinha escrito "24 em aberto e
6 concluídos" no cabeçalho e no SELECT de conferência, mas as linhas dão 26 e
4. A asserção recontou a partir das VALUES e acusou. Os números da
conferência agora são derivados das linhas, não digitados de memória.

1302 asserções (53 novas, 1 reescrita), build ok, TypeScript sem erro novo.
As duas migrations não foram executadas — é o Davi quem roda, nesta ordem:
U64 (o mecanismo) e depois U65 (o lote).

### U66 — Painel Comercial: nome do lugar e envio pelo card (R78, 2026-08-22)

"O título de cada item deve ser o nome do condomínio/empresa, e se for
residência de pessoa física o título deve ser 'Residência' + o nome do
proprietário. Além disso, nas propostas que estão prontas para enviar,
adicione um botão no card de 'Proposta enviada'."

**O título era um `??` solto na tela** (`clientes?.nome ?? nome_sindico ??
nome_predio ?? titulo`), e virou `tituloDaVisita()` em `etapas.ts` — regra de
negócio, testável. Dois detalhes que só aparecem quando se escreve a função:

1. **`tipo_local` não estava na consulta.** Sem ele a regra da residência
   nunca dispararia, e o sintoma seria mudo: a lista continuaria mostrando os
   mesmos nomes de antes, sem erro nenhum. Há asserção guardando a coluna.
2. **Duplicação do prefixo.** Cliente cadastrado como "Residência Silva"
   viraria "Residência Residência Silva". O teste é sem acento e sem caixa,
   porque o cadastro tem "residencia", "Residência" e "RESIDÊNCIA".

A ordem das fontes também mudou de sentido: na residência o síndico É o
proprietário e vem cedo; num condomínio ele não é o nome do lugar e cai
depois do nome do prédio.

**O botão usa a RPC, não um UPDATE.** `registrar_envio_proposta` é quem
carimba a data e dispara a sincronização da capa do chamado (U38). Um update
direto daqui funcionaria hoje e divergiria da tela da visita na primeira
mudança de regra — dois caminhos de escrita para o mesmo fato é como um
deles fica para trás. O botão só aparece na etapa `falta_proposta`: antes não
há proposta aprovada para enviar, depois o ciclo já encerrou (R64).

1319 asserções (17 novas), build ok, TypeScript sem erro novo.

### U67 — Revisão de design: o modo claro em todas as telas (R79, 2026-08-23)

"Rode uma revisão completa do design do nosso sistema e aplique as alterações
necessárias. Nessa revisão, o principal tópico deverá ser o white mode.
Garanta que a revisão aplique em todas as páginas."

**Como foi feito.** 8 revisores em paralelo, um por grupo de telas, cada um
lendo os arquivos POR INTEIRO (não trecho) com o §8 do `DESIGN_SYSTEM.md`
como régua; cada achado passou por um **verificador adversarial** encarregado
de REFUTAR — abrir o arquivo, olhar a superfície real atrás daquela cor
quando `isLight` é verdadeiro, e derrubar o que fosse falso positivo (branco
sobre banner permanentemente escuro, `#F8C811` dentro de definição de
gradiente, par `{dark,light}` já correto). Sobraram **91 confirmados**.
Depois de aplicar, uma **terceira** rodada auditou o próprio diff procurando
o risco oposto: regressão no tema escuro.

**A RAIZ: 21 tokens sem par.** O `[data-theme="light"]` redefinia 14 de ~35.
`--input` seguia `rgba(255,255,255,0.06)` (borda branca sobre card branco:
invisível), `--popover` seguia `#161926` (o `SelectContent` abria escuro
sobre a página clara), `--muted` seguia `#11131D` (TabsList azul-marinho no
card branco), `--accent-foreground` seguia `#F8C811` (o anti-padrão nº 3),
`--border` seguia dourado 12% — e a regra global `* { border-color }`
espalhava isso por tudo.

Três dos oito revisores acharam essa mesma raiz sozinhos, cada um por um
consumidor diferente. É a assinatura de um defeito estrutural: o sintoma
aparece longe da causa, em arquivos que não têm nenhuma cor escrita.

Virou o **anti-padrão nº 9** do `DESIGN_SYSTEM.md` e uma asserção CRÍTICO que
compara os dois blocos token a token — a única exceção é `--radius`, que é
geometria. Com isso, 9 dos 91 achados foram fechados sem tocar no arquivo
onde apareciam, e os agentes que os pularam explicaram exatamente isso.

**Um corolário que precisou ser dito por escrito**: `--primary` é FUNDO
(o botão da marca, dourado vivo com texto quase-preto por cima) e continua
`#F8C811` nos dois temas; quem precisa de dourado como TEXTO usa
`--gold-primary`, que escurece para `#A06108`. Sem essa distinção, "escurecer
o dourado no claro" apagaria o botão da marca.

**O que a auditoria do diff pegou.** Seis dos oito lotes voltaram limpos —
nenhuma regressão no escuro, nenhum tema invertido, nenhum token quebrado,
nenhuma mudança fora de escopo. Os dois achados foram de contraste, e um
deles era uma **piora introduzida pela própria varredura**: o `StatusBadge`
saiu de `bg-muted/text-muted-foreground` (5,4:1 com o bloco novo) para
`PRISMA.neutro` (4,37:1). Corrigido na paleta, não no componente:
`PRISMA.neutro.light` escureceu de `#657585` para `#5a6172`, o mesmo valor do
`--muted-foreground`, o que conserta de uma vez os cinco chips que usam esse
par (cliente inativo, proposta em rascunho, chamado cancelado, tipo
operacional, prioridade baixa).

O outro: no `TotemWizard`, o dourado de texto caía sobre um véu do dourado
ESCURO (`rgba(160,97,8,0.15)`) — discreto sobre card preto, bege carregado
sobre branco, e o texto de 9px ficava em ~4,1:1. Em vez de inventar um quarto
tom de dourado, o véu no claro passou a ser o da casa
(`PRISMA.amarelo.bg`, do dourado vivo): o mesmo texto sobe para ~4,7:1.

**Os greps do §8 como medida.** Dourado fixo sem branch caiu de 21 para 11
ocorrências; branco fixo, de 5 para 4. Conferi as 15 restantes uma a uma:
todas são falsos positivos do grep — ramo `else` do escuro, dourado sobre
círculo permanentemente preto dentro do botão, tabela de remapeamento
claro/escuro, par `color`/`colorDark`, e dourado como FUNDO.

1332 asserções (13 novas), build ok, TypeScript nos mesmos 85 erros
pré-existentes (nenhum novo). 42 arquivos, +451/−216. Não verificado em
navegador — sem ferramenta de browser na sessão.

### U68 — O contexto viaja com o repo: CLAUDE.md + ONBOARDING.md (2026-08-24)

"Vou migrar todo o sistema para outro computador, e vou passar a usar outra
conta do Claude. Revise toda a arquitetura dos arquivos para eu fazer a
transição e continuar o projeto da melhor maneira possível."

**O diagnóstico da revisão**: o repo em si está pronto para viajar — nenhum
código referencia a pasta-mãe (`prever-importacao/`), os insumos históricos
já viraram migrations, o template da proposta mora em `public/templates/`, e
o `.env` versionado tem só chaves públicas (decisão antiga, documentada no
`.gitignore`). O buraco era outro: **o método de trabalho inteiro vivia na
memória local do assistente** — 17 arquivos de memória por conta/por máquina
que evaporam na troca de qualquer um dos dois. Não havia `CLAUDE.md`; o
`AGENTS.md` é só o boilerplate do Lovable.

**`CLAUDE.md` (novo, na raiz)** — o que uma sessão nova lê sozinha. Carrega
o que só a memória sabia: o ciclo R→implementação→asserções→build→U→push, a
regra das migrations manuais, as invariantes (quem conta é quem filtra;
ciclo comercial encerra no envio; dupla derivada × apoio gravado; paridade
de tokens de tema), as armadilhas que já morderam (PGRST201, rename leva
triggers, `<defs>` literal no recharts, função volátil vs ORDER BY, CSP), o
baseline de 85 erros do tsc e o mapa do repo. O resto é ponteiro para os
docs — o arquivo é índice + método, não enciclopédia.

**`ONBOARDING.md` (novo, na raiz)** — o checklist da transição: o que levar
(só o clone; a SERVICE key da pasta-mãe NUNCA entra no repo), como preparar
a máquina (npm install; bun.lock fica — é o build da Lovable), as três
sanidades antes de qualquer mudança, e o estado do projeto na entrega
(R79/U67, 1332 asserções). Inclui o aviso que teria poupado semanas nesta
máquina: **não pôr o repo em pasta sincronizada por nuvem** — o iCloud era a
causa do `tsc` "impossível".

**Uma correção de registro**: `docs/manual/desenvolvimento-e-verificacao.md`
afirmava que `tsc --noEmit` "nunca completa". Completava era na máquina
antiga com iCloud; hoje roda em segundos com ~85 erros pré-existentes
(types.ts do Supabase desatualizado). A nota foi reescrita com o baseline e
o critério real: não criar erro NOVO nos arquivos tocados.

**O que deliberadamente NÃO mudou**: os dois lockfiles (package-lock do dev
local, bun.lock do build da Lovable — apagar um "por higiene" é como o app
já caiu duas vezes com o .env); o `AGENTS.md` do Lovable; a pasta `android/`
(Capacitor versionado, builds ignorados). Higiene sem entender o porquê é o
anti-padrão número um deste repo.

1341 asserções (9 novas: existência e conteúdo-chave dos dois arquivos, e a
garantia de que a afirmação falsa sobre o tsc não volta), build ok.

### U69 — Dados do zero, pastas limpas e o plano de saída da Lovable (2026-08-24)

"Apague todas as atividades, todos os chamados. Quero começar a imputar os
dados do zero... hoje à noite eu vou migrar todo o sistema para um PC novo,
que não terá iCloud. Vamos tirar da Lovable, usar somente o Supabase...
organize as pastas... a empresa vai assinar o Claude para todos nós do T.I."

**A limpeza é migration, como sempre**
(`20260824110000_u69_limpeza_dados_operacionais.sql`) — eu não executo; o
Davi roda. Mas um wipe tem três decisões que valem registro:

1. **O financeiro derivado sai JUNTO, e sai ANTES.** `cobrancas.chamado_id`
   é `ON DELETE SET NULL`: apagar só os chamados deixaria cobrança órfã
   apontando para o nada — dinheiro sem origem na tela financeira. A ordem
   do arquivo (cobranças → fechamentos → chamados) é a diferença entre
   "banco limpo" e "banco com fantasmas".
2. **Visita entra na limpeza, mas numa seção COMENTÁVEL.** No vocabulário do
   app, visita É atividade ("todas as atividades" as inclui) — mas apagar
   visitas leva o funil comercial e as propostas geradas. A seção C existe
   destacada para essa decisão custar 5 segundos, não uma arqueologia. Os
   contratos não dependem dela (`origem_proposta_id` é SET NULL).
3. **As importações ficam PROIBIDAS de re-rodar.** U59/U61/U65 são
   idempotentes POR ORIGEM — a proteção que impedia duplicar vira, num banco
   limpo, o mecanismo que REIMPORTA tudo. O cabeçalho avisa em maiúsculas.

Os contadores também zeram: o próximo chamado nasce `CH-2026-0001`, que é o
"começar com o pé direito" literal. A conferência mostra os alvos zerados E
a fundação de pé (clientes, contratos, profiles, duplas, prospecções) — com
a instrução de PARAR e restaurar se a fundação vier zerada.

**As pastas.** A pasta-mãe (`prever-importacao/`) tinha ~35 itens soltos de
três eras: as planilhas-base, o gerador Python/JS da era "app de proposta"
(inclusive uma edge function `calcular` e migrations soltas pré-repo), os
prompts da Lovable e as importações. Virou `arquivo/` com cinco subpastas e
um README que diz o essencial: **o único item vivo é o repo** — nada no
`arquivo/` roda nem é referenciado. Sobraram na raiz só o `.env` (SERVICE
key, que NUNCA entra no repo) e o repo. O ninho de três níveis
(`app-prever/prever-importacao/prever-proposta`) não se desfaz nesta máquina
— mover o repo no meio da sessão quebraria a sessão — mas o `ONBOARDING.md`
prescreve a estrutura da máquina nova: `~/prever/{sistema,arquivo}`, fora de
qualquer pasta de nuvem.

**A saída da Lovable tem UM passo perigoso, e ele vem primeiro.** O
`ONBOARDING.md` §0 agora abre com a checagem de DONO do projeto Supabase:
se `lrepuyaootngrbotmvhn` não aparecer na conta da empresa em supabase.com,
o banco é gerenciado pela Lovable e **pode morrer com o cancelamento** —
dump + restauração em projeto próprio ANTES de cancelar. O resto é ordem:
hospedagem substituta primeiro (o build do nitro já sai para Cloudflare
Workers com `wrangler.json` gerado — caminho de menor atrito), variáveis no
painel, cancelar, e SÓ ENTÃO a faxina (AGENTS.md, `.lovable/`, e a
possibilidade de tirar o `.env` do versionamento — a razão de ele ser
versionado ERA a Lovable buildar do repo; as duas asserções sobre isso
invertem juntas, nunca antes).

**Obsidian e o Claude do T.I.**: `docs/` é Markdown puro — abre como vault
sem conversão. A fonte de verdade continua o repo (versionado, assertado); o
vault é espelho de leitura. E o `CLAUDE.md` vira o onboarding de TODAS as
contas novas do T.I., não só a do Davi.

1353 asserções (12 novas), build ok.

**CORREÇÃO, na primeira execução (2026-08-24).** A U69 abortou no SQL Editor:
`relation "public.contratos" does not exist` — a tabela se chama
`cliente_contratos`, e eu escrevi o nome de memória na conferência. Dois
fatos importam:

1. **Nada foi aplicado.** O erro veio na linha 83 (conferência), depois dos
   DELETEs — mas o arquivo inteiro é uma transação, e o abort desfez tudo.
   O `BEGIN/COMMIT` obrigatório das migrations existe exatamente para isto:
   a diferença entre "a conferência falhou" e "o banco ficou meio-apagado".
2. **A migration foi editada em vez de ganhar uma u69b** — exceção
   consciente à regra "nunca edite migration enviada": a regra protege banco
   JÁ MIGRADO da divergência com o repo, e aqui o banco não aplicou nada.
   Uma u69b deixaria a u69 quebrada para sempre no histórico.

A classe do erro virou asserção: **toda tabela `public.<x>` citada na U69
tem de ter nascido no histórico de migrations** (CREATE TABLE ou RENAME TO,
varrendo o diretório inteiro). Teste negativo confirmado: "contratos" não
está no histórico — a asserção teria abortado o commit antes do Davi ver o
erro no painel. 1354 asserções.

**A LOVABLE FICA (decisão do Davi, 2026-08-24).** A U69 tinha sido escrita
assumindo saída iminente, e os documentos mestres saíram enviesados: o
`ONBOARDING.md` abria com "§0 — ANTES DE CANCELAR A LOVABLE, o passo que não
tem volta", e o `CLAUDE.md` dizia deploy "em transição". Com a saída adiada,
isso deixou de ser contexto e virou **ruído perigoso**: fazia a migração de
máquina — que não toca em deploy, hospedagem nem banco — parecer um
procedimento de risco, e convidava alguém a "adiantar" a faxina (tirar o
`.env` do versionamento, remover `AGENTS.md`) enquanto a plataforma ainda
builda a partir deles. Tirar o `.env` do repo já derrubou o app duas vezes.

Reenquadrado: o `ONBOARDING` abre dizendo que a Lovable fica e que a
migração é só clonar o repo; o plano de saída desceu para a §6, **completo e
intacto**, rotulado "plano guardado, NÃO é para agora", com o passo perigoso
(confirmar o DONO do projeto Supabase) em primeiro lugar dentro dele. O
`CLAUDE.md` passou a afirmar a Lovable como estado atual e a avisar
explicitamente para não "arrumar" o que existe por causa dela.

A checagem de dono do banco ficou recomendada para **hoje mesmo**, mesmo sem
cancelar: são 2 minutos e responde se os dados da empresa dependem de uma
assinatura de terceiro. Três asserções mudaram de alvo junto — o que elas
guardam agora não é "a saída está em andamento", e sim que o plano continua
completo e na ordem certa para o dia em que for usado.

1355 asserções.

### U70 — O fim de linha vira regra do repo, não do computador (2026-08-25)

"Sobre o item 2, eu quero que você decida."

Primeira sessão do projeto em Windows. A migração de máquina passou nas três
sanidades, menos por uma asserção: a **U41**, do backfill da demanda
comercial, acusava `obtido=false` com o SQL **correto** — as linhas do
`UPDATE` estavam lá, idênticas às do Mac. A causa não era o SQL: o Git for
Windows instala com `core.autocrlf=true`, o checkout materializou o arquivo
com CRLF, e a asserção casa regex com `\n` sobre o fonte. São **86 asserções
que usam esse padrão**; naquele dia só uma quebrou, mas todas estavam
armadas.

O mesmo CRLF tinha um segundo efeito, pior porque silencioso: depois de todo
`vite build`, o `src/routeTree.gen.ts` aparecia modificado. `git diff`
mostrava zero mudança de conteúdo — era só fim de linha. Commitar aquilo
reescreveria o arquivo inteiro e poluiria o histórico com ruído.

**Por que `.gitattributes` e não `core.autocrlf=false`.** As duas resolvem.
A config resolve **a máquina de quem lembrou de rodar**; o arquivo viaja no
clone. Como a empresa vai assinar o Claude para o T.I. inteiro e cada um vai
clonar o repo num Windows, a config local só adiaria o mesmo dia perdido
para a próxima pessoa. O arquivo é a única forma que escala.

**O que a verificação pegou antes do commit.** Rodar `git add --renormalize`
antes de confiar na regra mostrou que `* text=auto eol=lf` sozinho converte
o `android/gradlew.bat` para LF — e script `.bat` em LF **não roda no
Windows**. Entrou a exceção `*.bat/*.cmd/*.ps1 text eol=crlf`. O efeito final
no `gradlew.bat` é só de armazenamento: o blob passa a ser LF, o checkout
devolve CRLF em qualquer plataforma, e o arquivo na árvore continua byte a
byte o que era. Os binários (o `.docx` da proposta, os 27 `.png`, o `.jar` do
Gradle) foram marcados `binary` explicitamente — `text=auto` até os detecta
sozinho, mas aqui um falso negativo corromperia o template da proposta.

**O que deliberadamente NÃO se fez**: reescrever os fins de linha do
histórico. O repo já armazenava LF em tudo (menos o `.bat`); a regra só
impede a regressão daqui para a frente.

Seis asserções novas guardam a regra — inclusive uma que checa a **causa** e
não o sintoma: se a migration da U41 voltar a ter CRLF no disco, ela denuncia
o fim de linha em vez de deixar a asserção do backfill falhar acusando um SQL
que está certo.

1361 asserções (6 novas), build ok, tsc no baseline de 85.

### U71 — Equipes revisadas, duas equipes na mesma atividade, e a palavra LOCAL (R80–R86, 2026-08-26)

"No campo de ABRIR CHAMADO na página INICIO, o campo que usa I.A para abertura
rápida de chamado, quando for mencionado por exemplo o 'Davi' no texto que o
usuário inserir, a atividade criada deve ser de responsabilidade do Davi… A
etiqueta de cliente na verdade seria uma etiqueta de LOCAL, este tempo todo
estávamos usando a palavra errada."

Sete regras de uma vez, mas com um eixo só: **a abertura rápida parou de
produzir texto e passou a produzir vínculo.** Até aqui a I.A. lia "portão do
Green Village travando, mandar o Erik" e devolvia seis campos fechados; o Erik
virava palavra dentro da descrição e o Green Village virava a linha "Cliente
citado: …" — as duas coisas visíveis para humano e invisíveis para o sistema.
O chamado nascia sem dono e sem lugar.

**A divisão que estrutura tudo: menção é da I.A., identidade é do código.**
O modelo devolve `"Nicholas"`, nunca um uuid. Quem transforma menção em vínculo
é `features/chamados/triagem.ts`, que é puro e testado com unidade real pelo
verificador. Não é purismo: as duas metades erram de jeitos diferentes. O
modelo é bom em ler "o Nicholas vai dar uma força" como apoio e péssimo em
garantir que existe **um** Nicholas com conta no app. Se o casamento de
identidade morasse no prompt, o erro sairia com cara de acerto.

**Primeiro nome ambíguo CALA.** O `indicePessoas()` do importador do Notion já
resolvia por primeiro nome, mas com uma regra que aqui seria perigosa: em
colisão, fica com o primeiro que indexou. Numa importação em lote revisada em
prévia aquilo é aceitável; aqui o texto vira atividade na hora. Com dois
Nicholas cadastrados, o índice devolve `null` — a mesma escolha que a contenção
de nome de prédio já fazia com "Mirant" ("Mirant Vila Madalena Residencial" E
"Studios": desistir é resposta honesta, chutar é resposta errada com cara de
certa). Nome completo continua resolvendo sempre.

Dois nomes num campo que pede um (`"Erik e Nicholas"`) é **outro** problema, e
tem outra resposta: vence o primeiro citado, que é o critério que o
`casarPessoa()` do importador já usava. Duas regras diferentes para o mesmo
sistema seria a incoerência de verdade.

**"Sempre que for o Nicholas ou o Erik participando, considere a equipe de
T.I." — escrito SEM os nomes.** A regra real por trás da frase é que a equipe
de quem entra na atividade entra junto; os dois nomes eram o exemplo, não a
regra. Implementada pela forma geral (`participante → profiles.equipe → equipe
da atividade`), ela vale para o próximo contratado sem tocar em código, e a
manutenção acontece onde deve: no cadastro. A contrapartida é honesta e está
registrada — **se o Nicholas não estiver como T.I. em /gerencial/usuarios, a
regra não dispara.**

**Uma invariante foi invertida de propósito.** `atividades/modelo.ts` zerava a
equipe fora do interno, com asserção CRÍTICA travando ("campo NÃO carrega
equipe"). Mas o exemplo que o Davi deu para pedir multi-equipe foi justamente
uma **proposta comercial** — técnico na visita, comercial na proposta. Ou seja,
é fora do interno que a segunda equipe aparece, e o zeramento escondia do
filtro exatamente o que ele quer ver. A asserção mudou de alvo junto, como as
três da U69. O **sprint** continua zerado fora do interno: aquilo é ritmo de
planejamento interno e não foi o que mudou — as duas metades da invariante
deixaram de andar juntas, e agora estão em asserções separadas.

**LOCAL: a palavra errada custou clareza, não código.** O conceito já existia
partido em dois — `clientes` (do QAP, R21) e `prospeccoes` (nosso, R22) — e o
`atividadeDaVisita` já chamava o prédio de LOCAL desde 2026-08-22, com o
comentário explicando por quê. O que faltava era o vínculo N:N saber falar as
duas línguas. `chamado_locais` substitui `chamado_clientes` e aceita três
formas, com `num_nonnulls(...) = 1` garantindo no BANCO que a linha aponta para
uma só — não na confiança da aplicação.

**O setor é etiqueta, não expansão.** A U45 expandia "grupo de clientes" em N
linhas. Uma etiqueta é melhor por dois motivos independentes: o card cabe (a
coluna tem 260px; oitenta chips não entram), e a lista passa a refletir o
cadastro de **hoje** em vez de congelar quem era do setor no dia do clique.

**Um furo de RLS que já existia foi fechado no caminho.** `pode_ver_cliente()`
é da S1 (2026-08-20) e nunca soube da `chamado_clientes` (U45, 2026-08-22):
técnico num chamado cujo cliente é EXTRA não enxergava o cliente, e o card
mostrava o local em branco — o sintoma exato que o comentário da S1 diz estar
evitando. Com a U71 o vínculo por tabela vira o caminho normal, então o
incômodo viraria defeito. A regra não mudou (se o chamado é visível, o local
dele também é); só o caminho cresceu. `pode_ver_prospeccao()` nasceu com a
mesma forma.

**Criar prospecção pelo app NÃO afrouxa a R21**, e vale registrar porque parece
que sim. A R21 tranca `clientes` porque aquela tabela é espelho do QAP e um
sync futuro faz upsert nela — cliente criado aqui seria apagado pelo ERP ou
duplicaria o cadastro oficial. `prospeccoes` nasceu na U27 pelo motivo oposto:
guardar o que é nosso e o QAP não conhece. `clientes` continua sem policy de
INSERT.

`achar_ou_criar_prospeccao()` é `SECURITY DEFINER` por necessidade, não por
conveniência: a leitura de prospecção é restrita de propósito, então a busca de
duplicata feita pelo cliente responderia "não existe" para um prédio que
existe, e cada chamado criaria outro registro do mesmo lugar. A função enxerga
a tabela para decidir e devolve só um uuid — não vaza listagem, endereço nem
contato, e quem chamou já sabia o nome porque foi ele quem digitou.

**O modelo da I.A. subiu de Sonnet 5 para Opus 5**, com `effort: "low"`. A
escolha do Sonnet foi feita quando a tarefa era classificar um parágrafo em
seis campos fechados; a U71 acrescentou extração de entidade e atribuição de
PAPEL — responsável × apoio —, que é exatamente onde um modelo sem raciocínio
troca os dois. Os outros três server functions de IA do repo sempre foram Opus.

**O que deliberadamente NÃO se fez.** O título perdeu o local por prompt E por
rede de segurança (`tituloSemLocal`), mas a rede é conservadora: só corta
quando o que sobra ainda descreve um trabalho — "Visita — Green Village" fica
inteiro, porque "Visita" sozinho é pior. E `chamados.cliente_id` não virou
N:N puro: cobrança, matching, relatório e o trigger do contrato continuam
lendo o principal sem saber que a lista existe. Reescrever aqueles leitores é
um projeto à parte, e forçá-lo aqui "para ficar completo" arriscaria quebrar
cobrança de verdade sem necessidade — o mesmo raciocínio que a U45 registrou.

1427 asserções (66 novas), build ok, tsc no baseline de 85. A migration
`20260826120000_u71_equipes_e_locais.sql` **precisa ser rodada** — sem ela o
CHECK antigo recusa "outras" e as duas tabelas novas não existem.

### U72 — O arrasto que grava, ordenar com direção, autosave e cor por hierarquia (R87–R91, 2026-08-26)

"No Kanban, quando o usuário segura e arrasta o card de uma atividade para
outra coluna de status, o status da atividade deve atualizar… Sempre que o
usuário clica em uma atividade e abre o menu da direita para esquerda, neste
menu, qualquer alteração que o usuário faça, deve ser salva em tempo real…
mantenha o efeito degradê em cada botão, mas aplique a cor de acordo com a
hierarquia."

**O arrasto já existia. O que faltava era ele gravar.** Três defeitos, e
nenhum deles aparecia como erro em lugar nenhum — o que explica por que
sobreviveram:

1. **A recusa da RLS era invisível.** Quando a policy de UPDATE barra pelo
   `USING`, o PostgREST **não devolve erro**: a linha não é encontrada, zero
   linhas são afetadas, e a resposta é 204 com `error === null`. O
   `atualizarChamado` só olhava `error`, então concluía sucesso, invalidava a
   query, e o refetch trazia o status antigo — o card voltava para a coluna de
   origem sem toast, sem log, sem nada. Do lado de quem usa: "arrastei e não
   aconteceu nada". A correção é um `.select("id")`: com ele, lista vazia volta
   a significar o que sempre significou.
2. **O card era um `<button>` dentro do wrapper arrastável.** Firefox e Safari
   não iniciam o arrasto do ancestral quando o gesto começa sobre um controle
   nativo. Virou `div role="button"` com Enter/Espaço à mão — o preço de
   continuar acessível sem o elemento nativo.
3. **Soltar um card agendado na própria coluna apagava o agendamento.** A
   guarda comparava o status CRU, mas `agendado` é desenhado em "Aguardando
   início" (`colunaVisivel`). Soltar onde ele já estava passava pela guarda e
   gravava `status='aberto'`.

Entrou também **atualização otimista**: o card anda antes da resposta e volta
se a gravação falhar. Sem isso ele ficava parado durante toda a ida e volta —
que se lê como "não funcionou", e leva a arrastar de novo.

**O que NÃO arrasta agora diz por quê.** A proposta comercial tem o status em
`visitas_tecnicas`, e a capa em `chamados` é escrita por trigger de mão única
(U41): gravar ali não moveria a visita e seria desfeito na próxima edição dela.
Antes o card simplesmente não respondia ao gesto; agora recusa com o motivo. O
mesmo para o pedido de compra, cuja coluna vem da ficha de compra.

**Ordenar: a direção não é um `.reverse()`.** Duas regras sobrevivem à
inversão. Vazio continua por último **nos dois sentidos** — invertendo cru,
"Prazo decrescente" abriria com dezenas de itens sem prazo no topo, e "sem
data" não é a maior data. E o desempate por data de criação não inverte: ele
existe para a ordem ser estável, não para ser um segundo eixo.

Uma coisa muda de propósito: **o bloco de atrasados só vem na frente no
crescente.** No decrescente seria contraditório — quem pede "vence por último
primeiro" não quer o mais vencido no topo.

Detalhe que quase passou: `desc` significa "inverte a direção NATURAL desta
chave", não "decrescente" em abstrato. `recentes` nasce decrescente (mais novo
primeiro) e é assim que os presets a chamam. Tratar `desc=false` como
"crescente" teria invertido o preset "Sem dono" em silêncio.

**Autosave: a trava é o foco.** Salvar durante a digitação cria uma corrida com
o próprio recarregamento — a gravação invalida a query, a query volta, e o
valor do servidor sobrescreve o que está sendo escrito naquele instante. É o
bug do campo que come letras. A regra que resolve os dois lados é uma só:
**enquanto o campo tem foco, o servidor nunca escreve nele**; sem foco, o campo
sempre espelha o servidor, que é o que faz o painel refletir a edição de outra
pessoa.

Efeito colateral bem-vindo: os botões da barra de formatação usam
`onMouseDown` + `preventDefault` justamente para não tirar o foco — então
aplicar negrito nunca salvava, porque a gravação dependia do blur. Agora salva.
E o **título ganhou selo de estado**: era o único campo do painel que gravava
sem dizer nada, inclusive quando falhava, e sem o clique que confirmava isso
ficaria pior.

**Cor: o dourado estava sendo gasto à toa.** O botão de escolha era o degradê
dourado para tudo — status, equipe e classificação com a mesma cor. Isso faz a
cor dizer só "está selecionado", que é o que a forma do botão já dizia. Agora
cada botão leva a cor da sua escala, com o mesmo degradê.

As cores **não são novas**: a hierarquia que o Davi descreveu ("Aguardando
Início em azul, Em andamento em amarelo, Stand By em laranja") é literalmente o
que `chamado-status.ts` já guardava desde a correção de 2026-08-22. O que
faltava era ela chegar ao botão.

Isso **muda o design system** (§6.4 e §11.5), que reservavam degradê em botão
para o dourado da marca — e as duas seções foram reescritas junto, com a razão.
A regra que sobrou é a que interessa: **dourado é ação, cor é escala.**

A tinta por cima do degradê sai de **contraste medido**, não de gosto: o
dourado pede quase-preto e o azul pede branco, e fixar um dos dois deixaria
metade dos botões ilegível. Uma asserção percorre toda cor que o sistema pode
jogar num botão e exige 4,5:1 contra o pé do degradê.

**O que deliberadamente NÃO se fez.** O quadro do Painel Operacional continua
sem arrasto: as colunas dele (`nao_agendado`, `agendado`, `atrasado`,
`concluido`) **não são status** — são a leitura de `data_hora_agendada` e
`prazo_limite`. Arrastar para "Atrasado" não tem status correspondente, e para
"Agendado" exigiria pedir uma data. Fazer o gesto funcionar ali significa
decidir o que cada coluna GRAVA, e isso é decisão de produto, não de
implementação. E `EQUIPE_CORES` não foi remapeado para o PRISMA, apesar de ser
a única tabela de cor do sistema com hexes fora dele: mexer nisso é redesenho,
e não foi o que se pediu.

1487 asserções (55 novas), build ok, tsc no baseline de 85. **Sem migration** —
tudo nesta entrada é aplicação.

### U73 — Filtro por setor no calendário, e um eixo só em Clientes (R92–R93, 2026-08-26)

"No calendário, adicione o filtro por setor, adicione também o filtro por tipo
de demanda. Em clientes, remova o filtro 'Situação', mantenha somente o filtro
'Serviço'. Remova a opção 'Todos', para exibir todos o usuário deve marcar
todas as opções de filtro."

**O filtro por tipo de demanda já existia — e ninguém via.** A condição era
`tiposPresentes.length > 1`: num mês com um tipo só, o botão sumia da barra.
A intenção original era não mostrar um seletor de uma opção; o efeito prático
foi um filtro invisível, que é como ele chegou pedido de novo. Passou a
aparecer sempre que há tipo, e o rótulo virou "Tipo de demanda", que é como o
resto do app chama esse campo (o painel do chamado usa exatamente essa
palavra).

**Setor tem duas fontes, e ignorar uma delas seria mentir.** Desde a U71 um
chamado chega a um setor por dois caminhos: a **etiqueta explícita**
(`chamado_locais.setor`, gravada quando alguém marca "todos os clientes de
Portaria Remota") e o **serviço prestado no local** (`servicos_prestados` do
cliente principal ou de qualquer cliente vinculado). Considerar só a etiqueta
esconderia todo chamado de um cliente de portaria que ninguém etiquetou;
considerar só o serviço perderia a atividade de setor inteiro, que
deliberadamente não tem cliente.

A visita entrou pelo `cliente_id`, que precisou ser acrescentado ao SELECT.
Visita de prospecção fica sem setor — e é correto: prédio que ainda não é
cliente não presta serviço nenhum.

A consulta de `chamado_locais` é **crua, sem embed**, e o comentário registra o
porquê: duas FKs chegando em tabelas diferentes é exatamente o PGRST201 que
derrubou a Início inteira quando a U45 subiu. Consulta simples e `Map` na mão é
mais chato de ler e não cai.

**Escolher setor esconde quem não tem setor** — atividade interna, prospecção,
cliente sem serviço marcado. É o que filtrar significa, mas surpreende num
calendário que costuma mostrar tudo. Em vez de inventar uma regra ("interno
sempre aparece"), a contagem ao lado passou a dizer quantos ficaram de fora.

**Clientes: o "Sem serviço" não é detalhe de implementação, é o que salva a
tela.** Tirar o "Todos" de um filtro de serviço parece inofensivo até olhar os
números: a marcação cobre **59 de 192 clientes** (29 na U36, 30 na U44). Sem
uma opção para "nenhum serviço registrado", os ~130 restantes sumiriam da lista
e ninguém teria como trazê-los de volta — o filtro estaria escondendo dois
terços da base por omissão. "Nenhum serviço" é um valor real do cadastro, e por
isso é marcável como os outros.

**As contagens deixaram de cruzar, e é isso que as torna honestas agora.** No
filtro antigo (escolha única em dois eixos), cruzar era o certo: "Ativos · 192"
ao lado de uma lista de 29 seria mentira. Num filtro de **união**, a conta
certa é a oposta: marcar mais só ACRESCENTA, então "Portaria · 29" continua
verdade qualquer que seja o resto da seleção, e cruzar faria o número encolher
enquanto a lista cresce.

O subtítulo da tela mudou junto: era "N ativos · M cadastrados", agora é
"N ativos · M na lista". Com múltipla escolha, anunciar o total do cadastro
enquanto a lista mostra um recorte é a mesma promessa não cumprida que as
contagens cruzadas evitavam.

**O que deliberadamente NÃO se fez.** "Setor" foi lido como **serviço
prestado**, não como equipe — é o vocabulário que o Davi vem usando desde a
U71 ("atalhos para agregar a um setor inteiro, por exemplo todos clientes de
portaria remota"), e equipe ele chama de equipe. Se a intenção era filtrar o
calendário por equipe, é um menu a mais e o dado já está a um campo de
distância no SELECT. E a etiqueta de situação continua no card de cliente: o
pedido foi tirar o FILTRO, não a informação.

1505 asserções (14 novas), build ok, tsc no baseline de 85. Sem migration.

### U74 — "Padrão" sai da tela, "Atrasados" vira balde de Prazo (R94, 2026-08-26)

"Remova esta caixa de filtros. Adicione a opção do filtro 'Atrasados' no
filtro de PRAZO." — apontando o print do menu "Padrão" aberto, com os oito
botões da R17.

**A leitura do pedido não foi literal.** "Remova esta caixa" poderia
significar só esconder o botão e deixar o mecanismo por baixo rodando
invisível — mas isso trocaria um filtro visível por um filtro FANTASMA: o
técnico continuaria abrindo em "Meu dia" sem nenhum controle na tela para ver
ou desligar isso, e SAC/Comercial/Admin perderiam "A conferir"/"Sem
responsável"/"Minha equipe" sem aviso. O pedido de mover especificamente
"Atrasados" — e só ele — para dentro de Prazo é o sinal de que a intenção era
maior: os outros sete não tinham voz para vir junto, porque ninguém pediu.

**Por que só Atrasados precisava de uma casa nova.** Os quatro baldes de
Prazo (Hoje/Essa semana/Semana que vem/Este mês) são todos sobre uma DATA.
Atrasados nunca foi isso — é "prazo estourado OU em andamento/stand-by parado
5+ dias", o mesmo que `alertas_chamados()` já notifica. Um chamado esquecido
em andamento SEM prazo formal registrado conta como atraso, e é por isso que
`dentroDoPrazo` faz dele a ÚNICA exceção que não exige `a.quando` — os outros
quatro baldes continuam excluindo quem não tem data (regra de sempre,
recoberta por asserção para não regredir sem querer).

**A cascata de dead code, e onde ela parou.** Remover o seletor tornou
inalcançáveis os outros seis presets (`tudo_meu`, `sprint_mes`, `stand_by`,
`a_conferir`, `sem_dono`, `minha_equipe`) — nenhum código ainda os selecionava.
Seguindo "se está certo que não é usado, apague por completo": saíram do
array `PRESETS`, `ORDEM_POR_CARGO` e `presetsDoCargo` (existiam só para
escalonar aquele catálogo por cargo, e um catálogo de 1 item não precisa de
escalonamento). Isso destampou mais uma camada: `ContextoLente.minhaEquipe`
ficou sem nenhum `Preset.aplica` para ler, e `useMinhaEquipe()` (o hook que
buscava a equipe do usuário) tinha o próprio docstring dizendo pra que
servia — "decide qual recorte do quadro ele abre" — ou seja, existia só para
alimentar o preset que acabou de sair. Foi embora também.

**Onde a cascata NÃO continuou, de propósito.** `Preset.foco` (as colunas que
um preset destaca no quadro) ficou no tipo mesmo sabendo que hoje só resolve
para `[]` (o "meu_dia" que sobrou nunca teve foco) — remover isso puxaria
`Quadro.tsx` para dentro do diff por um ganho cosmético de "menos um campo",
e esse arquivo não pedia para ser tocado. Nem toda cadeia de "isso ficou sem
uso" precisa ser puxada até o fim; o critério foi: código **inalcançável**
sai, valor que **sempre foi o mesmo caminho válido** (foco vazio) fica.

**"Meu dia" sobrevive, e não como escolha.** É o que o banner "Você tem X
hoje" aplica ao toque (R11) e o que o técnico abre por padrão — nenhum dos
dois passa por um seletor, então nenhum dos dois precisava do catálogo. Isso
significa que "Meu dia" deixou de ser uma ESCOLHA visível na tela e virou
comportamento embutido; "Limpar filtros" continua sendo a saída para quem
não quer aquele recorte.

**Uma decisão que reverti no caminho**: cheguei a fazer o menu de Prazo zerar
`ordenacao` ao trocar de valor, copiando o que o antigo seletor "Padrão"
fazia (cada preset embutia sua própria ordem, então trocar de preset
precisava limpar a escolha manual). Prazo nunca foi um combo de
filtro+ordem+vínculo como preset era — é só mais um eixo, igual Equipe e
Pessoa, nenhum dos quais mexe em `ordenacao`. Fazer Prazo ser a exceção seria
inventar um efeito colateral que ninguém pediu; desfiz antes de commitar.

1525 asserções (19 novas), build ok, tsc no baseline de 85. Sem migration.

### U75 — A Operacional vira Operacional Técnica, e o Gestor OS ganha um plano (R95, 2026-08-31)

"Eu quero que você entenda que ele é líder da equipe técnica, e que o sistema
dele é utilizado para gestão da parte da equipe técnica… Vamos começar alterando
a aba 'Operacional' do nosso sistema para 'Operacional Técnica', que será o
Painel que ele irá utilizar. Trace um plano completo, vamos aplicar todas as
funcionalidades presentes no sistema dele, em nosso sistema."

**O que a investigação encontrou, e que muda o tamanho do trabalho.** O Vinicius
mandou o documento mestre do Gestor OS dele — 11 seções, 20 telas, 20 modelos, em
produção desde 26/08. Lido contra o nosso código, **cerca de 60% já estava aqui**:
as etapas U2–U5 foram escritas em 18/08 exatamente para portar aquele sistema, a
partir do mapeamento do código real dele. Contrato por PDF+IA, cascata de
casamento de equipamento, valoração que nunca vira R$ 0, análise item a item,
conferência humana como única porta de cobrança, fechamento semanal/mensal com
CSV e PDF — tudo isso roda aqui, e vários arquivos dizem no cabeçalho "Portado
de ~/Documents/gestor-os".

Em dois pontos a nossa versão é melhor e não pode regredir na absorção:
determinístico primeiro com IA só no resíduo (mais barato, auditável, e funciona
sem chave de API), e a invariante "sem preço vira revisar" garantida por CHECK no
banco em vez de convenção de código.

**A lacuna real é o que ele construiu DEPOIS da nossa portabilidade**: programação
semanal em grade com hora e deslocamento, composição de equipe que muda por
semana, bloqueio de agenda cheia, plantão, escala de sobreaviso, implantação com
cronograma PDF e os dashboards. Varredura confirmou zero ocorrência de
"plantao"/"sobreaviso"/"deslocamento calculado"/"dia útil" no repo.

O plano completo, em sete fases, ficou registrado fora do repo (o arquivo de
plano da sessão). As três decisões que o Davi tomou e que o moldam: o Gestor OS
**roda até estarmos prontos** (migração única no fim, com data de corte — e
depende de o Vinicius congelar funcionalidade nova lá); a dupla **evolui para
equipe de campo** com composição semanal, em vez de nascer um segundo conceito
de turma; e a primeira fase é a **programação semanal completa**.

**Esta entrada entrega só a Fase 0**, que é pequena de propósito — o rename com
o recorte por equipe.

**O recorte era coincidência, e virou regra.** A tela lia `natureza='campo'` e
pronto; acertava porque todo chamado de campo nasce com `equipe: 'tecnica'`
(`chamados/data.ts`). Nada no banco garante isso. Agora o filtro é explícito, e é
o que faz este ser o painel do Vinicius em vez da fila de campo de todo mundo.

**A chave da tela não mudou, e é o detalhe que mais importa aqui.** `telas.ts`
avisa no próprio tipo que a chave é o que está gravado em `permissoes_tela` —
renomeá-la apagaria a permissão de cada papel de uma vez, e nada ligaria uma
coisa na outra. Mudou só o rótulo.

**O celular ganhou rótulo próprio.** "Operacional Técnica" tem 19 caracteres; a
barra inferior dá cinco vagas em `flex-1`, o que sobra ~50px a 10px de fonte —
o nome inteiro quebraria a barra em duas linhas. Entrou `labelCurto` no
`ItemNav`, que o `BottomNav` usa quando existe; o menu lateral e a matriz de
permissões seguem com o nome completo, onde há espaço. É a segunda vez que a
largura daquela barra dita produto (a primeira foi a vaga que devolveu Clientes),
e por isso virou campo em vez de gambiarra local.

**Uma decisão de escopo:** não construir permissão de tela por equipe. Hoje a
permissão é por cargo, e não existe nem leitura de `profiles.equipe` do usuário
logado. Fazer a Operacional Técnica ser "o painel dele" se resolve filtrando o
DADO; uma segunda dimensão de permissão (cargo × equipe) é arquitetura que
ninguém pediu ainda, e que fica para quando T.I. e Controle Patrimonial pedirem
painéis próprios.

1533 asserções (10 novas), build ok, tsc no baseline de 85. Sem migration.

## U76 — A equipe de campo ganha escala semanal (R96/R97)

Fase 1, Passo 1 da absorção do Gestor OS. É a fundação da programação semanal:
antes de conseguir montar a grade do Vinicius, o sistema precisa saber **quem
saiu com quem em cada semana** — e até aqui ele só sabia quem sai com quem hoje.

**O defeito que estava lá desde a U47, e ninguém tinha visto.** A equipe de uma
atividade era derivada do responsável lendo `duplas.membro_a/membro_b`, que não
têm eixo de tempo. Consequência: mover o Luan de equipe **reescrevia em silêncio
as 12 semanas** do gráfico do Painel Operacional Técnica. O passado mudava
sozinho toda vez que alguém mexia no cadastro. Pior, o cabeçalho de
`features/duplas/data.ts` prometia o contrário — "a dupla desfeita ainda explica
o histórico" — sem ter matéria-prima nenhuma para cumprir: desativar uma equipe
apagava a linha dela do gráfico inteiro, retroativamente.

A escala guarda o passado, e o passado para de mudar. É a asserção que resume a
migration: *lançar a escala de uma semana nova não muda um único ponto do
gráfico das semanas passadas*.

### O desenho

`duplas_escala_semanas` (as semanas DECIDIDAS) + `duplas_escala` (uma linha por
pessoa por semana). Duas tabelas, e não uma, porque **"semana não decidida" e
"equipe que não sai nesta semana" são respostas diferentes**: a primeira herda a
última semana lançada, a segunda fica vazia de propósito. Com uma tabela só,
ausência de linha significaria as duas coisas ao mesmo tempo — e esvaziar uma
equipe numa semana faria a herança ressuscitá-la na semana seguinte.

**A chave primária é `(semana, pessoa_id)`**, e ela substitui de uma vez os dois
índices parciais da U47 **e** o trigger do caso cruzado. O trigger existia porque
a composição morava em duas colunas (`membro_a` numa dupla, `membro_b` em outra —
índice nenhum pega isso); normalizando em uma linha por pessoa, o caso cruzado
deixa de existir. A regra também encolheu para o tamanho certo: "uma equipe por
pessoa **por semana**", não "para sempre".

**A herança olha só para trás** (`semana <= W`). Se aceitasse uma escala futura
para tapar um buraco no passado, lançar a escala de amanhã reescreveria o
gráfico de ontem — reconstruindo, com outro nome, exatamente o defeito acima.

**`COLLATE "C"` em `semana`, e `padStart(2,"0")` no TS.** O formato `AAAA-SNN`
tem largura fixa e ano ISO na frente, então ordem alfabética **é** ordem
cronológica, inclusive na virada (`2025-S52` < `2026-S01`). Sem o zero à
esquerda, `S9` > `S10` e a herança escolheria a semana errada — em silêncio.

**Marco zero `0001-S01`.** Uma semana sintética anterior a qualquer data real,
onde o backfill grava a composição do dia da migração. Assim **todo o passado
herda o que o gráfico já desenhava**: congela o que a tela dizia, em vez de
esvaziar 11 semanas de histórico. Na tela ela aparece como "escala de sempre" —
`rotuloReferencia()` a renderizaria como "semana 1 de 1", que não quer dizer nada.

### O apoio (R75) sobrevive, com data

A invariante do CLAUDE.md — **apoio é gravado, dupla é derivada** — não regrediu.
O que mudou é que a derivação virou função de *(pessoa, data)*:
`parceiro_da_dupla(uuid)` morreu e virou `parceiro_da_dupla(uuid, date)`, e o
gatilho passou a escutar `data_hora_agendada` além de `responsavel_id`. Sem isso
a escala semanal recriaria, por outro caminho, o erro que a U64 existe para
evitar: reagendar uma OS de uma semana para outra deixaria o apoio da semana
errada gravado.

Três comportamentos ficaram diferentes, de propósito: (1) reagendar uma OS
**aberta** entre semanas recalcula o apoio (mover de terça para quarta, não);
(2) corrigir a **data** de um chamado concluído nunca mexe no apoio, corrigir o
**responsável**, sim; (3) desfazer uma equipe apaga a escala das semanas
**futuras** — a semana em curso e as passadas ficam, porque já têm dias vividos.

**"Não sei" não autoriza DELETE.** Semana sem escala vigente faz o gatilho voltar
cedo em vez de apagar quem foi ao prédio. `null` é a resposta honesta para "antes
da primeira semana aberta", e quem consome não pode lê-lo como "ninguém".

### A migration prova antes de destruir

Ela é atômica e destrói tarde: `BEGIN` → tabelas novas → backfill → **pré-voo**
(alguém em duas duplas ativas? aborta nomeando as pessoas) → **portão** (a escala
nova reproduz a composição atual, nome por nome? se não, aborta **antes de
qualquer DROP**) → só então os DROPs da U47 → gatilhos → conferência → `COMMIT`.
Nos dois abortos nada foi alterado, e não sobra rastro.

O backfill semeia **uma vez só**: reexecução com escala já lançada é no-op —
senão as colunas inertes `membro_a/membro_b` reescreveriam o presente. E a §9.5
prova por contagem antes × depois que `chamado_apoios` ficou intacta: total,
`origem='dupla'` e `origem='manual'`.

**A ponte.** `trg_duplas_espelhar_na_escala` faz o pop-up antigo de cadastro
continuar funcionando depois da migration, espelhando na semana corrente — é o
que permite rodar o SQL **antes** de a tela nova subir, sem janela quebrada.
Quando uma semana já foi lançada pela porta nova, a ponte **recusa** aquela
semana em vez de sobrescrever a decisão. Ela some no Passo 2, junto com as
colunas.

Um buraco conhecido, dito de frente: agendar trabalho para uma semana e **depois**
lançar a escala dela não refaz o apoio já gravado — de propósito, para lançar
escala não sair reescrevendo chamados e tocando dezenas de sinos. A conferência
§9.6 lista os chamados **abertos** divergentes, e o conserto é
`SELECT public.reconciliar_apoios_abertos();` (nunca alcança concluído,
cancelado, nem apoio posto à mão).

### O que este commit NÃO faz, e por quê

**Nenhuma tela mudou.** O push publica pela Lovable no mesmo instante, e o Davi
roda a migration à mão depois — então código que LEIA `duplas_escala` não pode
subir antes. Por isso o `modelo.ts` cresceu de forma **aditiva**: o bloco antigo
(`membrosDaDupla`, `duplaDaPessoa`, `serieAtividadesPorDupla`) continua intacto e
é o que as telas usam hoje; o bloco novo exige a semana em toda função
(`duplaDaPessoaNaSemana`, `parceirosNaSemana`, `serieAtividadesPorEscala`) e
ainda não tem consumidor. Nomes diferentes de propósito: "quem estava com quem" e
"quem está com quem hoje" viraram perguntas diferentes, e confundi-las é
exatamente o defeito que a U76 conserta.

O Passo 2, depois de o Davi rodar o SQL: `DialogoDuplas` vira tela de escala com
seletor de semana e campo veículo, o painel troca a atribuição do gráfico,
`data.ts` lê as tabelas novas, e o bloco legado sai junto com a ponte e com
`membro_a/membro_b`.

### Duas armadilhas de regex desarmadas no verificador

Não são cosmética — as duas mentiriam em silêncio:

- `/ADD COLUMN[^;]{0,80}dupla_id/i` rodava sobre **todas** as migrations sem
  exigir a tabela. A U76 passa por um triz (a coluna nasce dentro do
  `CREATE TABLE`), mas a próxima migration que criar um `dupla_id` em qualquer
  tabela derrubaria a suíte inteira. Agora exige `ALTER TABLE public.chamados`.
- `DELETE FROM public\.(…|duplas|…)\b` **não** casa `duplas_escala`: `_` é word
  char, e o `\b` falha. Uma faxina futura poderia apagar a escala inteira sem o
  verificador reclamar. Os nomes longos entraram antes na alternância.

E as asserções que continuariam **verdes descrevendo um banco que não existe
mais** (os índices da U47, o trigger do caso cruzado, `parceiro_da_dupla` sem
data, o seed da U65) ganharam "arquivo histórico" no texto, com a afirmação
equivalente sobre o banco de hoje vivendo no bloco U76. Uma delas mudou de sinal:
*"série: dupla DESFEITA não vira linha do gráfico"* virou **"equipe desfeita
continua explicando o histórico — ela some do futuro pela ausência na escala, não
do gráfico do passado"**. Era a asserção que travava o comportamento contrário ao
que `data.ts` sempre prometeu; agora há com o quê cumprir a promessa.

1600 asserções (67 novas), build ok, tsc no baseline de 85.
**Migration `20260831180000_u76_escala_semanal_das_equipes.sql` — o Davi roda no
SQL Editor.** Rodar uma vez; ela pode abortar de propósito em dois pontos e,
quando aborta, nada foi alterado.

## U77 — A escala vira a única verdade (R98)

Fase 1, Passo 2 — e o fim do Passo 1. A U76 criou a escala semanal e deixou o
mundo antigo de pé ao lado dela: `duplas.membro_a/membro_b` como espelho
legado, uma ponte no banco para a tela velha continuar funcionando, e as
funções sem data ainda exportadas em `modelo.ts`. Esta entrada tira tudo isso.

**O Davi rodou a U76 em 31/08**, e é isso que destrava o passo: agora existe
escala no banco para as telas lerem.

### As funções sem data morreram

`membrosDaDupla(d)`, `duplaDaPessoa(pessoa, duplas)`,
`parceiroDaDupla(pessoa, duplas)`, `rotuloDaDupla(d, nomeDe)`,
`serieAtividadesPorDupla(...)` e `foraDeDupla(...)` saíram de
`src/features/duplas/modelo.ts`. Não foi limpeza: **enquanto elas existiam,
dava para perguntar "de quem é a equipe dessa pessoa" sem dizer QUANDO** — e
essa é a pergunta que resolvia um chamado de março pela composição de agosto.
A U76 consertou o dado; a U77 fecha a porta.

`erroDaDupla` encolheu para `{ nome }`. Composição não é mais cadastro.

Ficou uma asserção só para guardar isso, e ela testa ausência:
*"perguntar a equipe de alguém SEM dizer quando deixou de ser possível"* —
`[membrosDaDupla, duplaDaPessoa, serieAtividadesPorDupla, foraDeDupla].every(f => f === undefined)`.

### As telas

**`DialogoDuplas`** deixou de ser um formulário e virou duas coisas na mesma
janela, porque são decisões de prazos diferentes: o **cadastro** (nome e
veículo, vale até alguém mudar) e a **escala** (quem sai naquela semana, vale
para aquela semana). O seletor de semana no topo manda em tudo abaixo, e a tela
sempre diz de onde veio o que mostra — "escala desta semana" × "herdada de
2026-S32" × "escala de sempre". Escala herdada é escala que ninguém confirmou, e
o gestor precisa saber disso antes de confiar nela.

A composição virou lista de chips em vez de dois `<select>`: a equipe de campo
pode ter três, e a R96 já permitia isso no banco — era a tela que não sabia
dizer. Equipe vazia grava, e o botão assume: **"Não sai nesta semana"**.

**Mover alguém pergunta antes.** A RPC `escala_definir` vai com `_mover: false`
na primeira tentativa; o banco recusa nomeando a outra equipe, a tela mostra a
frase e só repete com `true` depois do "sim". Roubar membro em silêncio seria
pior que atritar — é a mesma doutrina do trigger da U47, agora com a pergunta
no lugar certo.

**`painel.operacional`**: o gráfico ganha uma `<Line>` por equipe que **teve
escala na janela** (`duplasNaJanela`), não por equipe ativa hoje, e cada
atividade cai na equipe da **semana dela**. É a correção que o cabeçalho de
`duplas/data.ts` prometia desde a R56 sem ter como cumprir.

**`chamados.programacao`**: o filtro virou "equipe de campo" e oferece as
equipes com composição na semana aberta; a agenda do dia agrupa pela equipe
**daquele dia** e itera a lista inteira de equipes, não só as ativas — abrir
junho mostra quem saiu em junho, equipe desfeita depois inclusive.

Um detalhe que quase passou: a régua de dias da programação vai de **domingo a
sábado** e atravessa a virada da semana ISO (segunda a domingo). Resolver todos
os chamados pela semana aberta na tela poria o domingo da régua na equipe
errada. Cada chamado é resolvido pela semana **dele**; só o que ainda não tem
data usa a semana aberta, porque não tem semana própria.

### `useEscala`: a escala inteira, de uma consulta

Parece exagero e não é — é uma linha por pessoa por semana decidida, ~520 por
ano com dez técnicos. Trazer tudo faz o gráfico das 12 semanas, o filtro da
programação e o pop-up saírem de **uma** consulta, resolvidos pelas funções
puras; qualquer recorte por semana viraria uma consulta por semana mostrada.

A escrita vai pela RPC `escala_definir`, nunca por INSERT/DELETE do cliente: a
**ordem** das três operações é o que faz a coisa funcionar (abrir depois do
delete não apaga nada; inserir antes de abrir faz a herança trazer de volta
quem acabou de sair). Uma asserção guarda isso pelos dois lados — a RPC está
lá, e não há `.insert()`/`.delete()` em `duplas_escala`.

### A migration, e por que ela pode esperar

A U77 arquiva `membro_a/membro_b` em `duplas_composicao_legada` (com os **nomes**,
não só os ids — era o último registro da composição das equipes DESFEITAS, que
a U76 não pôde incluir no backfill sem violar "uma pessoa por equipe por
semana"), derruba a ponte e dropa as colunas.

**Este deploy é seguro com ou sem ela rodada**, e isso foi construído de
propósito: o cliente parou de **nomear** `membro_a/membro_b` no SELECT, e
selecionar menos coluna nunca quebra. Duas asserções guardam essa propriedade.

O único efeito colateral conhecido da janela: a ponte dispara em
`AFTER INSERT OR UPDATE OF membro_a, membro_b`, e o INSERT dispara **sempre** —
mesmo com as colunas nulas. Como ela recusa quando a semana corrente já tem
escala lançada pela porta nova, cadastrar equipe nova numa semana já lançada
falha com uma mensagem clara até a U77 rodar. Barulhento, recuperável, e some
com ela.

**A U77 é o ponto sem volta do DESFAZER da U76** — o nível 1 dela depende das
colunas existirem. Por isso é migration separada, com um `RAISE` que recusa
rodar antes da U76 ou com a escala vazia, e com o aviso no cabeçalho: se a
escala ainda estiver em observação, não rode. Colunas paradas não custam nada.

O DROP das colunas é **sem CASCADE**, de propósito: se alguma view tiver passado
a depender delas, é melhor a migration abortar do que a dependência sumir sem
ninguém ver.

1607 asserções (as ~22 do caminho sem data saíram, 29 novas entraram), build
ok, tsc no baseline de 85.
**Migration `20260831210000_u77_fim_das_colunas_legadas.sql` — o Davi roda no
SQL Editor, depois do deploy.**

---

## U78 — A grade da programação e o bloqueio de agenda (Fase 1, Passo 1.2)

**R99/R100/R101.** Esta entrega é **só o alicerce**: a migration, o modelo puro e
as asserções. **Nenhuma tela foi tocada**, e nenhum arquivo existente importa
`src/features/programacao/modelo.ts` ainda — a grade, a faixa "agendado sem
horário" e o formulário com erro vêm no passo seguinte, sobre um chão já
provado.

### A decisão de modelagem, e por que ela não é conveniência

A atividade em campo virou um **satélite**: `public.agenda_campo`. O argumento é
CARDINALIDADE, e ele tem dois lados que se somam.

**1:N.** O retorno é 1:N por definição — foi terça, faltou peça, volta quinta.
Dois blocos, um chamado. Com atividade = chamado, "retorno" viraria valor novo em
`chamados.status` e encostaria em `STATUS_ORDEM`, `statusDaNatureza`,
`chamadoEmAberto`, as cores, o kanban da Início, `indicadores.ts` e
`situacaoPrazo` — sete lugares para dizer "segunda ida". Aqui é derivado da ordem
(`ordinalDoBloco`): zero coluna.

**N:0, e este é o lado que decidiu.** Fui conferir: `chamados.cliente_id` é
`NOT NULL REFERENCES public.clientes(id)` desde a etapa 3. Então "OS que veio de
fora do sistema" — serviço para quem não está na base de clientes — **não pode
existir como chamado**, por estrutura, não por preferência. Mas ocupa a equipe
igual, e uma grade que não a mostra mente sobre a semana. Nenhum desenho sem
tabela nova resolve isso.

### O que eu recusei

- **`chamados.duracao_prevista_min` + `deslocamento_min` (o desenho "sem
  satélite").** É mais barato de escrever — 10 arquivos contra 12, migration de
  ~400 linhas contra ~1400 — e ganha limpo no Passo 1.2 isolado. Perde em duas
  coisas que não são opinião: a OS sem cliente (acima), e o `EXCLUDE` teria de
  nascer em `public.chamados`, a tabela mais quente do sistema — `ACCESS
  EXCLUSIVE` mais um índice GiST inteiro sobre ela, e depois disso **toda carga
  futura** precisaria de `DROP CONSTRAINT`/`ADD CONSTRAINT`, num idioma
  (`ALTER TABLE … DISABLE TRIGGER`) que não sabe desligar constraint. Aqui o
  `EXCLUDE` nasce em tabela vazia e nenhuma carga em `chamados` é afetada.
- **A tabela genérica `blocos_tempo` com discriminador `especie`** (atividade /
  plantão / sobreaviso / implantação). Escrevi o CHECK de quatro ramos antes de
  recusar, e a recusa é contada: de 14 colunas, **uma** (`dia`) seria NOT NULL nas
  quatro espécies. Pior, é empírica: a escolha certa aqui — `(dia, inicio_min)`,
  que proíbe atravessar a meia-noite — é **fatal** para plantão noturno, que
  atravessa por definição. As duas espécies discordam sobre o que é uma unidade
  de tempo. O que a Fase 3 reusa é o núcleo aritmético do modelo puro (`Intervalo`,
  jornada, ocupação), não a linha do banco — o mesmo padrão que `FonteAtividade`
  já provou na Home.
- **Backfill de blocos.** `NÃO HÁ BACKFILL, DE PROPÓSITO` (a frase é da U64). A
  base de produção tem `12:00` significando duas coisas indistinguíveis por valor:
  "a programação não perguntou a hora" (`T12:00:00` literal em
  `chamados.programacao.tsx:251`) e "meio-dia mesmo" (novo-campo, PainelChamado).
  Qualquer backfill escolhe um significado e falsifica o outro, e chutar uma
  duração envenena o chip de ocupação no primeiro dia com um número inventado que
  tem cara de medição. Todo chamado com data e sem bloco cai na faixa **"agendado
  sem horário"**, e a contagem dela é a barra de progresso da mudança.
- **Uma coluna `sobreposicao_ok`** que tirasse a linha do `EXCLUDE`. Um booleano
  que qualquer escritor liga devolve a regra ao estado de promessa — que é
  exatamente o que o `btree_gist` foi comprado para evitar. A equipe que se divide
  numa emergência tem representação honesta e já construída: vira uma equipe de
  campo própria naquela semana, por `escala_definir`.
- **`retorno_de_id` em `chamados`** (o retorno como chamado-filho). O argumento a
  favor é forte e fica registrado: a segunda ida precisa de diagnóstico, peça,
  foto, assinatura e **cobrança** próprias, e todas essas moram no chamado
  (`os_pecas.os_id`, `os_fotos.os_id`, `cobrancas.os_id`, `assinatura_url`). O
  preço é três CH- para um problema, três relógios de SLA, e `chamadosDoKpi`
  contando 3 onde a operação tem 1 — um imposto permanente no módulo mais lido do
  repo. Ver o BURACO CONHECIDO abaixo.

### A armadilha, resolvida e provada

`chamados.data_hora_agendada` vira **espelho derivado**, mantido por gatilho:
o início do bloco **pendente** mais antigo; se todos foram cumpridos, o **último**.
O gêmeo puro é `espelhoDoChamado()`.

O medo registrado no plano ("reagendei e tocaram 30 sinos") estava **mal
endereçado**. `trg_notify_chamado_upd` é `OF status, responsavel_id` — o espelho
escreve UMA coluna e não é nenhuma das duas; e `notify_chamado` não emite nada
para `aberto → agendado`, nem quando disparado de propósito. O risco real é
`trg_chamado_apoio_dupla_upd` (U76), porque cada INSERT em `chamado_apoios`
dispara `trg_notify_chamado_apoio`. Ele é contido em quatro camadas:

1. a lista `AFTER UPDATE OF` do gatilho do satélite é curta — `dia, inicio_min,
   cumprido_em, cancelado_em, chamado_id`. Mexer na duração, no deslocamento ou na
   equipe **não chama** a função de espelho;
2. `IS DISTINCT FROM` no WHERE do UPDATE — `AFTER UPDATE OF` dispara pela
   presença da coluna no SET, mesmo com valor igual;
3. `status NOT IN ('concluido','cancelado')` no mesmo WHERE, que fecha de vez o
   desvio de `updated_at → encerradoEm` (`atividades/modelo.ts:489-491`);
4. a defesa interna da própria U76 (mesma semana ISO → volta cedo).

**O gatilho da U76 não é desligado nem alterado na sua tese** — a cascata "mudou
a semana do trabalho, recalcula o apoio" é a intenção declarada dela. A única
mudança é uma **guarda de quatro termos** para o caso que o espelho CRIA: cancelar
o último bloco escreve NULL, `dia_da_dupla` cairia no COALESCE para `created_at`
— outra semana — e o par mudaria sozinho, com sino, por um ato que só disse "não
sei mais quando". O corpo da U76 foi retranscrito LITERAL, o pré-voo prova que a
função viva é a da U76 **antes** de reescrevê-la, e um **portão** recusa o COMMIT
se a transcrição tiver perdido qualquer uma das quatro saídas cedo.

**Não há ciclo, e a ausência é por construção:** existe um único sentido de
escrita (`agenda_campo → chamados → chamado_apoios → notificacoes`). A aresta de
volta — a faixa "agendado sem horário" com um clique para dar horário — é RPC,
nunca gatilho. Uma linha da conferência prova que nenhum gatilho novo nasceu em
`public.chamados`.

### Dois fatos que circulavam errados, conferidos no repo

- **`chamados_update` NÃO tem trava de concluído/cancelado.** A U7 (:553-558)
  tinha; a **S1** (`20260820170000`, :414-424) fez DROP + CREATE com
  `USING/WITH CHECK pode_editar_chamado(id)`, sem a trava, e nenhuma migration
  posterior a repôs. Logo, a trava de encerrado do §3 não repete nada — ela
  **repõe** uma garantia que não existe mais, e o espelho é a razão: o gatilho é
  SECURITY DEFINER e passa por cima de qualquer policy de `chamados`.
- **A função do `btree_gist` chama-se `gbt_uuid_compress`**, não
  `gist_uuid_compress` (`gist_uuid_ops` é o nome da *opclass*). Um pré-voo escrito
  contra o nome errado abortaria SEMPRE, com o banco correto, dizendo que a
  extensão falta. O pré-voo aqui checa `pg_extension`.

### A tensão da U3, resolvida em vez de contornada

A U3 escolheu programação por DIA porque *"a grade não cabe na tela do celular,
que é onde o Vinicius trabalha"* (:686-688). O motivo continua verdadeiro. A
resposta não é ignorá-lo nem duplicar a tela: **o dia é a grade com uma coluna**.
`linhasDaGrade(duplas, semana, dias, …)` recebe `semana` e `dias` como parâmetros
SEPARADOS — a ocupação e a escala são sempre da semana (o chip do celular diz
"68% da semana"), e só as colunas mudam. A asserção CRÍTICA compara as duas
saídas por igualdade: se um dia divergirem, o verificador cai, e não existe "a
grade diz 6h e o card diz 5h30".

### Novidades de infraestrutura

- **`btree_gist`** — primeiro `CREATE EXTENSION` deste repo. Sem ele, "a equipe
  não está em dois lugares ao mesmo tempo" volta a ser gatilho plpgsql (com
  early-return, com search_path, apagável por `DISABLE TRIGGER`, sem atomicidade
  contra duas gravações simultâneas). O pré-voo aborta nomeando o obstáculo, e a
  alternativa por gatilho está escrita no rodapé — escolhê-la é decisão do Davi.
- ~~**A válvula `prever.lote`** dentro de `notify_chamado_apoio()`~~ — **CORTADA
  na revisão**, e o corte está registrado dentro da migration. Ela prendia uma
  bandeira à TRANSAÇÃO, e o cenário que o comentário nomeava ("mover cem blocos
  de sexta para segunda") são **N transações do PostgREST**: a válvula era
  inalcançável do único lugar que ela dizia servir. Não havia parâmetro de lote,
  não havia RPC companheira, e o cliente não emite `SET`. Com o corte, a U78
  deixa de reescrever à mão uma função viva da U7 — que é a operação de maior
  variância do arquivo. Se a Fase 2 precisar de lote, ele nasce como
  `agenda_campo_marcar_lote`, e aí a válvula tem consumidor.

### O que a verificação pegou

Três defeitos meus, achados pelas asserções antes de qualquer tela existir:
(a) eu esperava UM conflito onde a função devolvia DOIS — a expectativa estava
errada, não o código, e a asserção passou a afirmar a coisa mais forte ("devolve
todos, ordenados"); (b) as asserções negativas casavam o **comentário** que
explica por que a coisa não existe (`gist_uuid_compress`, `DISABLE TRIGGER`,
`sobreposicao_ok`) — a quinta vez que essa armadilha morde esta casa, e a correção
é rodar sobre o código com os `--` filtrados; (c) um `indexOf` sobre o arquivo
inteiro achava a **citação** do §1.3 (pré-voo) em vez do código do §7.1.

### BURACO CONHECIDO — a execução do retorno

`os_pecas.os_id`, `os_fotos.os_id`, `os_checklist`, `cobrancas.os_id`,
`diagnostico`, `servico_executado`, `pecas_texto`, `assinatura_nome` e
`assinatura_url` são todos do CHAMADO, não do bloco. Logo: **a segunda ida
despeja diagnóstico, peça e assinatura em cima da primeira.** O satélite resolve
o TEMPO do retorno e não resolve a EXECUÇÃO dele.

*Gatilho de revisão:* se o retorno precisar de assinatura ou cobrança próprias,
ou `os_pecas`/`os_fotos` ganham `agendamento_id`, ou a execução migra para o
bloco. Custo estimado da segunda saída: as três peças da U78.

*Segundo gatilho de revisão:* `agenda_campo.dupla_id` é a decisão com maior
chance de precisar voltar atrás. A U76 é categórica — não existe
`chamados.dupla_id`, a equipe é DERIVADA — e eu ponho a equipe numa linha nova.
A defesa é que não se declara `EXCLUDE (derivação_em_outra_tabela WITH =)`, e que
sem a coluna mover um bloco de semana o faria pular de linha na grade sozinho. Se
a divergência bloco × escala virar rotina, a saída não é afrouxar a constraint: é
`dupla_id` deixar de ser a equipe e passar a ser a PESSOA — e aí o `EXCLUDE` fica
sobre quem de fato não se divide. Custo estimado: a tabela, o espelho e o modelo
puro.

### A REVISÃO — o que mudou depois que cinco lentes leram isto

O texto acima descreve a PRIMEIRA versão. Ela foi refutada, corrigida e cobrada
de novo, e o que subiu é diferente em quatro pontos que valem ser lidos antes do
código:

1. **As quatro portas de escrita são concedidas só a `service_role`.** Aditiva
   tinha virado sinônimo de inofensiva, e não é: concedidas a `authenticated` no
   `COMMIT`, elas seriam, no dia 1 e sem uma linha de tela, um `/rest/v1/rpc` que
   apaga `data_hora_agendada` de chamado de campo. O `GRANT` que falta está no
   rodapé, endereçado à migration da TELA.
2. **`agenda_campo_marcar` autoriza ESTADO, não argumento.** O gate tem três
   camadas — `is_gestor` OU (pode editar o que SAI **e** o que ENTRA **e** está
   escalado naquela equipe naquela semana) —, lê a linha viva com `FOR UPDATE`
   antes de decidir, e recusa **mover bloco cumprido** (dia, hora, equipe,
   chamado; duração e deslocamento continuam corrigíveis, porque são medição).
3. **"Agendado" quer dizer bloco PENDENTE**, nas duas pontas: mover o último
   bloco para outro chamado devolve o de origem a `aberto`, e o retorno
   desmarcado não deixa mais o chamado agendado para sempre.
4. **O modelo puro acompanhou tudo isso** — `erroDeAutorizacao`, `erroDeMover`,
   `erroDaBaixa`, `erroDoDesagendamento`, `espelhoAposDesagendar`,
   `statusAposOsBlocos` — com as frases da RPC, palavra por palavra. E
   `espelhoConfere` ganhou os filtros do §9.0: sem eles, ela acusava **100% da
   base no dia 1**, e divergência que aparece para todo mundo é divergência que
   se aprende a ignorar.

**A lição que virou regra:** a rodada anterior fechou "160 asserções, 0 falharam"
enquanto **12 de 12 quebras de regra passavam verdes** — as asserções procuravam
o *token* dentro de um `IF` que alguém podia neutralizar. Asserção que não fica
vermelha é PIOR que asserção nenhuma, porque produz confiança. Desde então, regra
crítica só conta depois de **teste de mutação**: quebra-se de propósito, roda-se
o verificador, e ele TEM de acusar.

**O teste de mutação, em duas rodadas, e o que ele custou.** A primeira rodada
foram **94 mutações escritas a partir das REGRAS** (nunca a partir das
asserções), e **13 passaram VERDES**. As treze caíam em três famílias, e as três
merecem nome porque vão se repetir:

1. **A asserção acha o ECO da coisa, não a coisa.** Quatro asserções liam o
   arquivo `.sql` INTEIRO por substring e encontravam a frase num comentário ou
   noutra consulta. A demonstração mais dura: `data_hora_agendada IS DISTINCT
   FROM v_novo` também aparece na **linha 402 da conferência**, que cita o texto
   para procurá-lo no `prosrc` — *a linha que faz a prova do banco funcionar era
   a que cegava a prova do verificador.* Idem `dupla_id WITH =`, que a asserção
   do EXCLUDE achava num comentário explicativo (linha 413) enquanto o eixo real
   do índice estava apagado.
2. **O corpo nunca foi FATIADO.** `agenda_campo_espelhar` — o coração da R101, a
   coluna lida em doze arquivos — era a única função do §5/§6 sem fatia própria.
   Seis dos treze sobreviventes moravam dentro dela: os dois estágios, o
   `ORDER BY … DESC`, o fuso, o `IS DISTINCT FROM`.
3. **A fixture não discrimina.** Cinco regras eram exercitadas por dados em que
   as duas leituras possíveis CONCORDAM: "disponível" testado num bloco
   cancelado (onde lista vazia e zero minuto dão o mesmo), a jornada testada só
   em CRIAÇÃO (`id: null`, e o desconto do próprio bloco não tem o que
   descontar), `naoMostrados` esperando zero nas duas fixtures que existiam, e
   "emergencial" variando só a PRIORIDADE — nunca o TIPO, que é a metade da
   frase do Davi que ficava solta.

E um achado que mudou o **método**, não a lista: `eq()` compara por
`JSON.stringify`, e **`JSON.stringify(NaN)` e `JSON.stringify(Infinity)` são os
dois a string `"null"`**. A asserção que se chamava *"…e não divide por zero"*
era estruturalmente incapaz de ver uma divisão por zero. O `eq` do verificador
inteiro ganhou um marcador para não-finitos por causa disso — vale para todos os
blocos, não só a U78.

As treze foram tapadas lendo COMPORTAMENTO onde dá (o módulo puro) e, no SQL,
recortando o **comando** até o ponto e vírgula e comparando **listas de cláusulas
contra listas escritas à mão** — o WHERE do espelho, os dois estágios e os eixos
do EXCLUDE são conferidos inteiros, então cláusula que some fica vermelha e
cláusula que nasce também.

**A segunda rodada existe porque asserção escrita olhando a mutação não prova
nada.** Foram **27 mutações novas, independentes**, escritas a partir das regras
das regiões recém-cobertas — e **três sobreviveram**, todas gaps de verdade que a
primeira rodada não tinha tocado: o estágio 2 do espelho sem `cancelado_em` (o
chamado voltava para uma visita DESMARCADA), `disponivel` sem a metade
`comEscala` (a semana em que a equipe não existe era a que aparecia mais
convidativa) e `linhasDaGrade` abrindo linha por bloco cancelado (equipe cujo
único bloco foi desmarcado ganhava linha permanente). Tapadas também.

**O placar honesto, que substitui o "121 mutações, 121 pegas" que esta entrada
chegou a afirmar:** 121 pegas **nas regiões que a rodada escolheu fatiar**. Uma
bateria independente, montada depois e sem saber quais regiões eram essas, achou
**18 de 31 sobreviventes** — e a causa era uma só: o gatilho `agenda_campo_espelho()`
não tinha fatia nenhuma. Neutralizá-lo por inteiro devolvia `0 falharam`.

O número antigo não era mentira deliberada; era a armadilha de medir a cobertura
com o mesmo recorte que a produziu. Um teste de mutação que só quebra o que as
asserções já olham mede a si mesmo. Ficou registrado assim de propósito: o
projeto adotou a regra do teste de mutação neste mesmo dia, e o primeiro número
que ela produziu já precisava de correção.

**Depois de tapar:** o espelho ganhou o bloco que faltava — o gatilho fatiado com
as três chamadas comparadas contra lista escrita à mão, as listas `OF` literais
dos três `CREATE TRIGGER`, os dois estágios do trabalhador, e o §9.0 (o terceiro
gêmeo, que é o que o Davi lê às 23h) obrigado a calcular o mesmo que o gatilho.
Bateria própria: **15 de 15 pegas**, começando pela que motivou tudo.

**Terceira medição, e a que fecha o assunto.** Uma bateria independente — 173
quebras derivadas da LISTA DE PROMESSAS do Passo 1.2, montada sem olhar quais
regiões as asserções fatiavam — achou **42 sobreviventes**. Todos com a mesma
forma: as asserções cobriam a NARRATIVA (a regra interessante, o comentário bem
escrito) e pulavam a ESTRUTURA (os CHECKs, as FKs, os índices, os gatilhos, os
GRANT/REVOKE). E uma família inteira escapava por um motivo só, que agora está
escrito no topo do bloco:

> **Regex prova que a linha EXISTE. Não prova que ela está VIVA.**

Pôr `RETURN NEW;` logo depois do `BEGIN` mata a função inteira sem apagar uma
linha sequer — todo regex de conteúdo continua casando. É a terceira variação da
mesma família: a primeira foi o `-- REVOKE` (a regex casava a linha comentada),
a segunda foi o `[\s\S]{0,N}` atravessando o `;` até o comentário ao lado. A
defesa é **alcançabilidade**: prender a PRIMEIRA instrução executável de cada
função contra uma string escrita à mão.

A resposta foi trocar asserção-por-caso por **quatro CENSOS**, que é o desenho
certo para isto: uma lista derivada do arquivo comparada contra uma lista escrita
à mão. Some uma peça, o censo acusa; **nasce** uma peça sem ninguém pensar nela,
o censo também acusa — que é a metade que asserção-por-caso nunca cobre.

1. **Alcançabilidade** — a primeira instrução das dez funções plpgsql.
2. **Privilégio** — toda função chamável por RPC tem `REVOKE ... FROM PUBLIC, anon`
   na linha inteira e viva; e o conjunto que chega a `authenticated` é comparado
   contra `['duracao_texto', 'reconciliar_apoios_abertos']`. As quatro portas de
   escrita ficam de fora até a tela existir.
3. **Estrutura** — os três CHECKs e o EXCLUDE pelo nome, as quatro ações de FK
   (cada uma é decisão: CASCADE no chamado, RESTRICT na equipe, SET NULL em quem
   carimbou), os três índices, os cinco gatilhos.
4. **Gates como bloco** — o `IF … THEN … RAISE … END IF` inteiro contra string
   escrita à mão, porque um `IF false AND` enxertado derrota qualquer regex que
   só procure o `RAISE`.

Bateria própria contra os sobreviventes, rodada **isolada**: **30 de 30 pegas**.

**Uma correção ao relatório da auditoria, que vale registrar.** Ela reportou que
o verificador seria **não-determinístico** (40 execuções dando 1877/0, 1876/1,
1874/3…) e concluiu que `0 falharam` não era fato reproduzível. Medi sozinho: 50
execuções sequenciais e 24 concorrentes, todas idênticas. O não-determinismo era
**artefato de orquestração minha** — rodei o agente que MUTA arquivos em
paralelo com dois que liam o mesmo diretório, então as leituras pegavam a árvore
no meio de uma mutação. Agente que escreve no repositório roda sozinho, ou em
worktree próprio. Os 42 sobreviventes, esses, seguem válidos: interferência
deixa o verificador VERMELHO, não verde, então a contagem de sobreviventes é
conservadora.

1903 asserções verdes, `vite build` ok, `tsc` no baseline de 85 e zero erro nos
arquivos tocados. **Migration `20260901090000_u78_grade_da_programacao.sql` — o
Davi roda no SQL Editor. Ela é aditiva e INERTE: as quatro portas de escrita são
concedidas só a `service_role`, então não têm consumidor até a migration da tela
soltá-las — as quatro linhas prontas estão no rodapé.**
### A guarda que a U79 acrescentou depois da auditoria

A U79 nasceu como migration de PRIVILÉGIO — os quatro GRANT que a U78 deixou
prontos no rodapé. Uma lente adversarial apontou o buraco que isso deixava, e
ele é o mesmo da entrega inteira, entrando pela porta que ninguém trancou:

> A U79 diz, com todas as letras, "a tela não escreve
> `chamados.data_hora_agendada` por fora — esta é a condição dura, e ela é do
> CÓDIGO, não do banco". Correto. E é justamente por isso que ela era a
> migration errada para deixar a porta aberta.

`chamados_update` é `pode_editar_chamado(id)` e não há REVOKE de coluna em
`public.chamados`. A chave publishable está no `.env` versionado. Então um
`PATCH /rest/v1/chamados?id=eq.<campo>` com `data_hora_agendada` gravava a
coluna — e **nada nunca a recalcularia**, porque o espelho só roda por gatilho em
`agenda_campo`. A divergência ficaria de pé até alguém, por acaso, mexer num
bloco daquele chamado. O censo do verificador prova o código; não alcança um curl.

Entrou o §2b: um `BEFORE UPDATE OF data_hora_agendada` que recusa, para chamado
de CAMPO, qualquer valor que não seja o que os blocos dizem. É a consulta "quem
não casou" do §9.0 da U78 virando **estrutura** em vez de relatório.

**Por que não REVOKE de coluna:** é a cicatriz da S1b. `REVOKE UPDATE (coluna)`
é no-op quando existe `GRANT UPDATE` de tabela, e o conserto de verdade
(revogar a tabela e reconceder coluna a coluna) apodrece na primeira coluna nova
que alguém acrescentar a `chamados`. Uma guarda que se auto-valida não enumera
nada e não envelhece.

**Por que aqui e não na U78:** antes da tela não havia satélite com que comparar.
Rodada lá, a guarda teria recusado toda escrita na base legada — que é a base
inteira. Ela devolve cedo quando o valor não muda, então editar o título de um
chamado com data e sem bloco continua funcionando.

E a auditoria achou mais duas coisas na tela, as duas confirmadas no arquivo:

- **O celular ficava sem nada.** `.so-desktop` é `display:none` abaixo de 1024px,
  e a coluna do dia era `modo !== "grade"`: com `?modo=grade` no celular, a
  grade sumia e o dia sumia junto — entre a faixa e a fila não sobrava uma
  palavra. E é o link mais provável de chegar ao celular, porque é o que o
  gestor manda do desktop, que é a razão declarada de o estado ter ido para a
  URL. Agora o celular cai para o DIA, que é a doutrina da U3.
- **A coluna fixa da grade não grudava.** `overflow: hidden` **cria** scroll
  container, e `position: sticky` resolve contra o container mais próximo — a
  coluna se ancorava numa div cujo `scrollLeft` é sempre 0 e rolava para fora
  junto com o resto, escondendo o nome da equipe. `overflow: clip` recorta sem
  criar container.

E uma asserção da U78 passou a mentir com a chegada da U79: ela derivava de
`cod78` — só o arquivo da U78 — e continuaria verde afirmando "as quatro portas
ficam em service_role" depois de a U79 as abrir. Regra 4 da casa mordendo o
próprio autor. Agora ela olha os DOIS arquivos e exige que cada porta seja
aberta pela U79 e por ela só.

Teste de mutação das três correções, rodado isolado: **14 de 14 pegas**.

1980 asserções, build ok, tsc no baseline de 85.

### S2 — Apoio deixa de ser auto-serviço (2026-09-01)

**Escalada de privilégio, aberta desde a U7/S1 (agosto) e viva em produção até
hoje.** Não é funcionalidade: é um ciclo entre uma policy e a função que decide
quem edita chamado.

Ela não foi achada procurando. Apareceu na varredura adversarial do Passo 1.2
(a grade da programação): uma das lentes precisava saber o que
`pode_editar_chamado` realmente garante para julgar um gate novo, foi ler, e
esbarrou nisto de lado. O passo que a encontrou está parado; ela não podia
esperar por ele.

**O ciclo, nas três peças:**

1. `chamado_apoios_insert` (U7:642-644) tinha
   `WITH CHECK (pode_acessar_chamado(chamado_id) OR profile_id = auth.uid())`.
   O segundo termo diz, em português: qualquer autenticado pode se inscrever
   como apoio de **qualquer** chamado — inclusive de um que ele não pode ler.
2. `pode_editar_chamado` (S1:398-410) concedia edição a quem fosse apoio, sem
   perguntar **quem** o pôs lá.
3. `chamados_update` (S1:419-422) **é** `pode_editar_chamado(id)`.

Com a chave publishable que está no `.env` versionado e o login de qualquer
funcionário, são duas chamadas:

```
POST  /rest/v1/chamado_apoios      {"chamado_id":"<X>","profile_id":"<eu>"}
PATCH /rest/v1/chamados?id=eq.<X>  {...}
```

Os ids de chamado saem de `chamado_apoios_select`, que é `USING (true)` — não é
preciso adivinhar nada. Alcance honesto: exige **login**, então é escalada
interna, não porta para a internet. Mas torna a matriz de permissões decorativa
para quem abrir o DevTools.

**Por que fechar nos dois lados.** Tirar só o `OR profile_id = auth.uid()` da
policy não basta: sobra o caminho pelo `pode_acessar_chamado`, que inclui
`OR c.responsavel_id IS NULL` — a **fila aberta**, que é assim de propósito. Por
ela, alguém se inscreve como apoio de um chamado ainda sem dono (legítimo) e
continua com direito de edição **depois** que ele for atribuído a outra pessoa
(não legítimo). Então o remédio ataca o ciclo, não só a porta.

**A regra nova, em uma frase:** *ser apoio dá direito de editar quando alguém
com autoridade te pôs lá.* Isso pede saber **quem** pôs, e o banco não sabia —
daí a coluna `criado_por`, com `DEFAULT auth.uid()`. É a diferença entre esse
valor e `profile_id` que separa "me puseram aqui" de "eu me pus aqui". Nas
escritas do gatilho da escala, `auth.uid()` é o gestor que trocou o responsável
e nunca o apoiador, então elas seguem concedendo, como devem — e `origem='dupla'`
ganha passe explícito por segurança, porque é derivada de `duplas_escala` e
ninguém a forja.

**As linhas antigas continuam valendo**, e é deliberado: nascem com
`criado_por IS NULL`, e `NULL IS DISTINCT FROM profile_id` é TRUE. Não dá para
saber quais delas foram auto-inscrição, e trancar gente legítima para fora por
suspeita seria trocar um problema por outro pior. A porta fecha daqui para a
frente; o §4 lista as linhas mais suspeitas — apoio manual em quem não é
responsável nem abriu o chamado — para o Davi olhar com calma e apagar à mão se
alguma não fizer sentido.

O `DELETE` levou a mesma poda, por outro motivo: o `OR profile_id = auth.uid()`
ali deixava a pessoa **apagar o registro de que ela foi ao prédio**. Apoio é
registro de quem foi (R75) — quem esteve lá não se desconvida.

**Sobre as asserções.** As 15 novas foram submetidas a teste de mutação antes de
subir: reabri a auto-inscrição, reabri o ciclo, tirei o `DEFAULT auth.uid()` e
tirei o passe do gatilho, uma de cada vez, e conferi que **as quatro ficam
vermelhas**. Passou a ser o padrão daqui em diante, e a razão é o Passo 1.2: lá,
160 asserções diziam "0 falharam" enquanto 12 de 12 quebras de regra passavam
verdes. Asserção que não fica vermelha é pior que asserção nenhuma, porque
produz confiança.

Duas delas travam o buraco **nos arquivos históricos** (U7 e S1), e não na S2. É
de propósito: sem isso, a S2 pareceria zelo preventivo, e daqui a um ano ninguém
saberia dizer se o ciclo existiu mesmo. Ele existiu, e as asserções o provam.

1623 asserções (15 novas), build ok, tsc no baseline de 85.
**Migration `20260901120000_s2_apoio_nao_e_auto_servico.sql` — rodar assim que
puder.** Ela não apaga nada e a conferência prova isso pelo número.

### S3 — `criado_por` e `origem` deixam de ser do cliente (2026-09-01)

**A S2 fechou menos do que prometeu, e a S2 é minha.** Ela rodou em produção pela
manhã; isto conserta o que ela deixou aberto.

A S2 passou a decidir autorização lendo duas colunas da própria linha —
`AND (a.origem = 'dupla' OR a.criado_por IS DISTINCT FROM a.profile_id)` — e
apostou que `criado_por` seria preenchida pelo `DEFAULT auth.uid()`. **DEFAULT
vale para coluna AUSENTE do comando.** O GRANT de `chamado_apoios` é de TABELA
(veio da U1:427 e o rename da U7 o carregou), e GRANT de tabela alcança todas as
colunas — inclusive as duas que a S2 promoveu a regra de segurança. Não há
gatilho `BEFORE INSERT`, e a policy da S2 só olha `chamado_id`.

Então a escalada voltou custando **um campo JSON a mais**:

```
POST /rest/v1/chamado_apoios {"chamado_id":"<X>","profile_id":"<eu>","criado_por":null}
   → NULL IS DISTINCT FROM '<eu>' é TRUE, e pode_editar_chamado concede.
POST /rest/v1/chamado_apoios {"chamado_id":"<X>","profile_id":"<eu>","origem":"dupla"}
   → concede pelo outro ramo do OR.
```

Alcance menor que o do buraco original — a policy da S2 ainda exige
`pode_acessar_chamado(chamado_id)`, então não é mais "qualquer chamado". Mas a
fila aberta (`responsavel_id IS NULL`) é acessível a todos de propósito, e por
ela dá para virar apoio de um chamado sem dono e **manter a edição depois que
ele for atribuído a outra pessoa** — o caminho que a S2 diz ter fechado.

**A correção é privilégio de coluna, não mais um gatilho.** No Postgres, GRANT de
tabela cobre todas as colunas e não há como tirar uma; o caminho é revogar o
INSERT da tabela e conceder só as colunas que o cliente tem direito de escrever:

```sql
REVOKE INSERT ON public.chamado_apoios FROM authenticated;
GRANT  INSERT (chamado_id, profile_id) ON public.chamado_apoios TO authenticated;
```

Quem manda só os dois campos passa e os DEFAULTs valem; quem tenta mandar
`criado_por` ou `origem` leva `permission denied for column` **do próprio
Postgres, antes da policy**; e as funções SECURITY DEFINER (o gatilho da escala
da U64/U76 e `chamado_sincronizar_apoio`) rodam como a dona da tabela e passam por
cima, que é como elas já gravam `origem='dupla'` hoje. Não há GRANT de UPDATE
nesta tabela, então também não existe o caminho "insiro certo e corrijo depois" —
e a conferência prova isso em vez de confiar na memória.

Preferi privilégio a um `BEFORE INSERT` por um motivo: o gatilho teria de
distinguir "o gatilho da escala está escrevendo" de "o cliente está escrevendo",
e a única forma é uma flag de sessão — mais uma peça para alguém esquecer de
setar, e mais um jeito de a regra **falhar aberta**. Privilégio é declarativo,
mora no catálogo, e o §3 o confere lendo o catálogo (`has_column_privilege`) em
vez de casar texto.

**Uma asserção minha estava verde afirmando o que não conferia.** Ela dizia
*"origem=dupla é derivada, ninguém a forja"* enquanto `origem` era gravável pelo
cliente. Foi reescrita para afirmar só o que ela pode provar — que o ramo do OR
existe — e a afirmação forte mudou de lugar: quem garante que não se forja é o
privilégio de coluna, e é lá que a asserção CRÍTICO mora agora.

**O teste de mutação achou um defeito meu de novo, e é o mesmo de sempre.**
Comentar o `REVOKE` — o coração da S3 — deixava a suíte **verde**, porque a regex
não ancorava no início da linha e `-- REVOKE ...` contém `REVOKE ...`. Três
asserções foram ancoradas com `^` e a flag `m`; a da trava trocou
`[\s\S]{0,200}` por uma exigência de o `RAISE` vir colado no `THEN` (o
quantificador frouxo engolia um `false AND` injetado no meio, que desliga a
trava sem apagar nenhuma das duas pontas que a asserção olhava). Placar final:
**9 de 9 mutações pegas.**

Ficou de fora, de propósito, uma décima: afrouxar uma asserção do próprio
verificador. Isso nunca é pegável por ele mesmo — é meta, não lacuna.

**A lição, para a próxima vez que uma coluna virar regra:** quando uma coluna
passa a decidir autorização, ela deixa de ser dado e vira superfície de ataque. A
pergunta "quem pode escrever nela?" tem de ser respondida **na mesma migration**
que a promove, e respondida lendo o catálogo — não lendo a intenção de quem
escreveu o DEFAULT.

1638 asserções (15 novas), build ok, tsc no baseline de 85.
**Migration `20260901180000_s3_criado_por_nao_e_do_cliente.sql` — rodar assim que
puder, e depois da S2.** Ela não apaga nada e conta as linhas suspeitas da janela
entre as duas.

---

## U79 — A tela da grade, e o fim das duas verdades (Fase 1, Passo 1.2)

**R99/R100/R101/R102.** A U78 entregou o alicerce e **nenhuma tela**: a tabela
`public.agenda_campo`, o espelho por gatilho, quatro portas RPC concedidas só a
`service_role`, e 1898 linhas de lógica pura em
`src/features/programacao/modelo.ts` — **sem um único importador**. Esta entrega
liga a tela àquele chão e tira das três telas de campo a escrita direta de
`chamados.data_hora_agendada`.

**Arquivos:** 7 novos (a migration, `programacao/data.ts`, `GradeSemana.tsx`,
`ColunaDoDia.tsx`, `CelulaDaGrade.tsx`, `FormularioDoBloco.tsx`,
`FaixaSemHorario.tsx`, `AgendaDoChamado.tsx` — oito com este último, que nasceu
para o PainelChamado não crescer) e 10 alterados. `programacao/modelo.ts` ganhou
**duas** funções: `montarAutorizacao` (o construtor que a interface já prometia)
e `apoioValeComoVinculo` — a segunda pedida pelo teste de mutação, ver abaixo.
`routeTree.gen.ts` **não** mudou: a rota é a mesma, só os *search params* são
novos.

O religamento é a metade que importa mais. A grade é bonita; as duas verdades
eram o defeito.

### O ângulo: uma estrutura, duas projeções — e o que PROVA que são uma só

A tentação é escrever `<GradeSemanal>` e `<ListaDoDia>`. A recusa é estrutural, e
ela já estava escrita em `celulaDaGrade`: *"o átomo… tudo o mais neste arquivo é
composição disto — inclusive a grade da semana e a lista do celular, que é a
razão de o átomo existir"*.

Então **`linhasDaGrade` é chamada UMA vez, com os `dias` da SEMANA INTEIRA, nos
dois viewports**. O celular não chama o modelo com `[dia]`; ele faz
`linha.celulas.find(c => c.dia === diaEscolhido)`. Uma chamada, um
`LinhaDaGrade[]`, e o viewport escolhe quantas colunas do MESMO objeto viram
pixel.

Por que não `dias: [dia]` no celular, que seria o óbvio — e as duas razões são
medidas, não estéticas:

1. **`divergencias` e `ocultos` são reduzidos sobre `celulas`.** Com um dia só, o
   cabeçalho diria "1 divergência" ao lado de um chip de ocupação que é sempre da
   SEMANA. Dois escopos no mesmo cabeçalho é "quem conta é quem filtra" quebrado
   do jeito mais difícil de enxergar: cada número está certo sozinho.
2. **`blocosForaDaGrade` morreria.** Com um dia só, o guarda dos dois lados
   devolve `naoMostrados` = os blocos dos outros quatro dias, toda vez. A saída
   seria desligá-lo no celular — e um guarda que só vale num viewport não é
   guarda.

A asserção que prende isso tem um par positivo (a célula do celular é
*deep-equal* ao átomo) e um **par negativo**, que é o que dá dentes: com uma
divergência em OUTRO dia, `linhasDaGrade(…, [D], …).divergencias` é `0` e o da
semana é `1`, **enquanto `ocupacao` é idêntica nos dois**. A asserção documenta,
positivamente, exatamente por que a chamada é única.

### A costura entre os dois eixos de semana não foi costurada: foi REMOVIDA

A régua desta tela ia de **domingo** (`base.getDate() - base.getDay()`) e a escala
é **ISO** (segunda). O arquivo antigo assumia a contradição por escrito ("o
domingo da régua pertence à semana anterior") e a resolvia chamado por chamado.

Fui conferir antes de trocar, porque parecia que o problema era o ISO. Não era:
para um **domingo**, `inicioSemana` desloca −6 (a segunda anterior) e `semanaIso`
joga para a quinta **daquela mesma semana**. `referenciaSemanal(domingo)` e
`inicioSemana(domingo)` **sempre concordaram**. Quem criava o desencontro era a
régua Sunday-first. Trocada a régua, os dois eixos são um eixo, e o comentário de
148-152 virou histórico.

Efeito colateral que eu não esperava e que vale: numa semana normal (sem trabalho
no fim de semana) a grade tem 5 colunas em vez de 7, e no celular os botões da
régua passam de 43px para 60px — **a régua ISO é mais tocável que a antiga no
caso comum**.

A vista **mensal** continua domingo→sábado, e a assimetria ficou declarada no
arquivo: a régua semanal fala de SEMANA (por isso é ISO); o mensal fala de MÊS e
de DIA, não carrega chip de semana nenhum, e no Brasil um calendário se lê a
partir de domingo.

### A grade é a TERCEIRA LENTE do mesmo dia, e não uma tela nova

`"grade"` entrou como terceiro valor de `ModoDeVisao`, ao lado de `semanal` e
`mensal`, só a partir de 1024px. Sem rota nova, sem tela nova, nada para
reaprender — e o comentário que já estava lá ("trocar de modo é trocar a lente,
não a tela") continua verdadeiro com três.

A U3 escolheu programar por DIA *"porque a grade não cabe na tela do celular, que
é onde o Vinicius trabalha"*, e ele construiu a grade depois no sistema dele. Os
dois estão certos, e a única forma de os dois estarem certos ao mesmo tempo é a
grade e o dia serem o mesmo objeto.

### O que eu recusei

- **Filtrar os BLOCOS pelo tipo de demanda.** Era o caminho óbvio ("os filtros
  valem para tudo", que é a doutrina da R57) e ele **mente num número**: o chip de
  ocupação é um percentual sobre base fixa, e recortar os blocos faria uma equipe
  a 68% mostrar "20% da semana". Então o filtro de **equipe esconde LINHAS**
  (honesto: a linha é uma equipe inteira, e o chip das que ficam não muda) e o de
  **tipo esmaece CARTÕES** — o cartão continua desenhado e continua contando.
  Também é o que mantém `blocosForaDaGrade` em `{0,0}`: bloco removido da célula
  contaria como `naoMostrados`.
- **Colapsar a linha alheia numa barra sem cartões.** Para quem não é gestor,
  `chamados_select` não é aberta e `chamadoOculto` é verdadeiro na maioria dos
  cartões: a grade dele seria um muro de "Outro atendimento". A saída óbvia é
  colapsar — e **`blocosForaDaGrade` proíbe**, porque bloco não desenhado conta
  como `naoMostrados`. Ou o técnico come o muro, ou o guarda é afrouxado para
  "não mostrado numa linha que se diz detalhada", que é como um guarda morre.
  A saída foi: **a linha colapsada DESENHA os blocos**, como segmentos
  posicionados pela mesma janela, com o rótulo só no `title`. Todo bloco entra em
  `mostrados`, o guarda passa, e o técnico vê a FORMA do dia das outras equipes
  sem ler nada que não é dele. E o achado bom: essa barra é exatamente o eixo do
  desktop com `mostrarRotulos: false` — **o modo colapsado não é um componente
  novo**. O guarda que parecia obstáculo produziu a renderização certa.
- **Canal de realtime em `agenda_campo`.** A tabela **não foi adicionada à
  publicação** pela U78, e o repo já pagou por essa armadilha: *"uma inscrição em
  tabela fora da publicação não dá erro — ela conecta, fica viva e nunca dispara,
  que é pior do que não existir"*. O que entrou foi `useChamadosRealtime()` (que
  esta tela **não** usava), porque o ESPELHO escreve em `chamados` — e ficou
  escrito no arquivo o que ele **não** cobre: mover um bloco sem mudar o valor
  espelhado não dispara evento nenhum.
- **Update otimista no arrasto.** `classeDoErro('23P01')` é `conflito`, e o modelo
  diz o que fazer com ele: recarregar, porque o estado que a tela mostra já está
  velho. Um cartão que pousa e volta ensina o usuário a desconfiar do arrasto.
- **Backfill, de novo.** Nem um bloco semeado. Continua valendo a frase da U64.

### O religamento, escritor por escritor

**`chamados.programacao.tsx`** — a mutação `programar` (com o `T12:00:00`
sentinela, o `responsavel_id` que apagava o dono e o `status` decidido no
cliente) sumiu inteira. Saíram junto: `chaveDia` (cópia literal de `dataIso`), a
régua domingo→sábado, o `emAberto` cru, a `cargaPorDia` que contava **cabeças**,
e o `porGrupo` — que tinha um defeito vivo: o chamado cujo responsável saiu da
escala e não tem `cargo='tecnico'` **desaparecia em silêncio**, enquanto o
cabeçalho o contava ("3 atendimentos no dia" com "Nada programado neste dia"
logo abaixo). `linhasDaGrade` conserta isso com as linhas `orfas` e
`desconhecidas`.

**`chamados.novo-campo.tsx`** — virou duas etapas (`abrirChamado` sem data, e
`agenda_campo_marcar` depois). Os campos **ficaram** e ganharam companhia:
equipe, duração e deslocamento. A regressão real que eu me recusei a deixar
silenciosa: hoje, data preenchida com técnico vazio GRAVA a data; sem equipe não
há bloco, e a data seria perdida. Não travei o formulário (isso impediria alguém
de abrir chamado por ainda não saber a equipe) — a seção **declara** para onde o
chamado vai, numa linha embaixo do botão, e o toast confirma. E a ordem de falha
está dita: o chamado é criado ANTES do bloco, então quando `marcar` recusa a tela
**não navega** e **não** diz "falhou ao abrir chamado"; ela diz *"o chamado foi
aberto; o horário não entrou:"* com a frase da RPC, e o botão passa a chamar só
`marcar`.

A prévia "Já agendado para este técnico" trocou de fonte: ela consultava
`chamados` por responsável, mostrava um item por CHAMADO (não por bloco), não
enxergava OS de fora nem retorno, e era por PESSOA e não por equipe. Virou
`blocosDaEquipeNaSemana`.

**`PainelChamado.tsx`** — e aqui a resposta honesta é um **estreitamento**. Um
`datetime-local` não sabe representar N blocos: o espelho é o pendente mais
antigo (ou o último cumprido), e qualquer valor que o campo mostrasse esconderia
o outro. Pior: `marcar` sem `_id` **cria** bloco, então editar a data de um
chamado com bloco criaria um segundo — um retorno que ninguém pediu. Então: 0
blocos → criar; **1 bloco → continua editável ali mesmo** (é a fronteira que a
U78 escolheu preservar: é onde o técnico não-gestor remarca o próprio
atendimento); 2 ou mais → lista somente-leitura com o ordinal e "abrir na grade".
Em `sem_horario` mostra **só a data**, nunca a hora — 12:00 sentinela e 12:00 de
verdade são indistinguíveis por valor, e imprimir "12:00" ali seria a segunda
verdade aparecendo na interface.

**As duas portas de TIPO fecharam**, e é isso que transforma o religamento de
convenção em compilador: `NovoChamadoInput.data_hora_agendada` e o membro
`"data_hora_agendada"` do `Pick<>` de `ChamadoPatch`. Enquanto elas existiam,
qualquer tela futura reintroduzia o defeito com uma linha. Junto foi a derivação
de status de `abrirChamado` — que o §6.1 da U78 já declarava ter absorvido no
passo 8. **A derivação não sumiu; mudou de lado**, e agora existe num lugar só.

**Os cinco escritores COMERCIAIS não foram tocados.** Eles gravam
`visitas_tecnicas`, são do gatilho da U41, e a U78 os recusa estruturalmente.

### O erro no formulário, e o que ele engolia

`erroDoAgendamento` já devolvia a frase pronta, e `classeDoErro` já dizia se é
permissão, regra ou conflito. Faltava a tela. Agora o erro é uma caixa **dentro**
do formulário, com o rosto escolhido pelo SQLSTATE: 23P01 vermelho, 55000 laranja,
42501 com `EXPLICACAO.PERM` e o código `PRV-…`. Toast só para sucesso.

E o `EstadoCampo` do PainelChamado ganhou `codigo`. Ele fazia
`codigoDeErro(err, …)` e punha o RESULTADO no lugar da mensagem — **descartando
`err.message`**. Com as portas da agenda, a frase é o produto ("Esta equipe já
está em CH-0012 · Portão das 09:00 às 11:00 nesse dia."), e mostrar só
`PRV-INI-PERM-42501` é trocar a explicação pela etiqueta. Agora a mensagem é o
texto e o código é o complemento — para todos os campos do painel, de propósito.

### O que a verificação pegou

- **A conta do PostgREST, que eu tinha errado.** Meu primeiro `paramsDeMarcar`
  montava o corpo só com o que o patch produziu — inclusive para
  `_dupla`, `_dia`, `_inicio_min` e `_servico_min`, que **não têm DEFAULT** na
  assinatura da porta. Arrastar um cartão (que muda só `dia`) mandaria
  `{_id, _dia}`, e o PostgREST resolve a função pelo CONJUNTO de argumentos
  nomeados: não acharia candidato e responderia **PGRST202 antes de a função
  rodar**. Todo PATCH da tela falharia, com uma mensagem que não fala de agenda
  nenhuma. Os seis primeiros vão **sempre**, com `null` explícito onde o gesto
  não mexeu (que é o que o passo 1b lê como "não mexi"); os três com DEFAULT só
  entram quando o patch os produziu.
- **`_deslocamento_min` ausente, não zerado.** É o defeito mais avisado da U78 e
  agora ele tem asserção dos dois lados: com um patch que não o toca, a chave
  **não existe** no corpo; com 45 → 0, ela existe e vale zero.
- **Nove asserções antigas ficaram vermelhas, e ficar vermelhas foi o
  comportamento certo delas.** Elas afirmavam a EXISTÊNCIA de um cálculo dentro
  do `.tsx` (`const abertas = useMemo(() => emAberto.filter(…)`, `const porGrupo
  = useMemo`, `for (const d of duplas)`, `sub: "Sem equipe"`). Cada uma pinava um
  cálculo que hoje é um defeito. Elas migraram de "a tela calcula X" para "a tela
  DELEGA X", e as fixtures correspondentes foram para o bloco das funções puras —
  regex sobre `.tsx` prova que a linha existe, fixture prova que a regra está
  viva.
- **Um falso positivo meu, da família de sempre.** A asserção "o sentinela das
  12:00 morreu" ficou verde-invertida porque o **cabeçalho novo** cita
  literalmente o `new Date(...T12:00:00)` que a tela deixou de fazer. As
  asserções negativas passaram a rodar sobre o código sem linhas de comentário —
  é a mesma disciplina que o repo já tinha e que eu tinha esquecido de aplicar
  aos arquivos novos.
- **O censo dos exports × importadores** achou dois sem consumidor
  (`blocoPendente` e `CLASSE_DO_ERRO`) e os dois viraram asserção de verdade, não
  menção. É o censo cumprindo o GATILHO DE REVISÃO escrito no docblock de
  `CAMPO_FECHA_MIN` — e ela **é consumida**: é a última linha do eixo do dia.
- **A R100 já estava certa.** A tarefa mandava dar a ela a segunda isenção por
  escrito; fui conferir e a U78 já tinha feito. O texto que ainda diz "a única
  exceção" é o parágrafo que CONTA a correção, não a regra. Mudei a asserção de
  negativa (proibir a palavra) para positiva (as duas isenções estão lá, e
  `isentoDaJornada` concorda com as duas) — uma asserção que proíbe contar a
  história é uma asserção que apaga a história.
- **O censo dos escritores**, derivado por varredura do `src/` inteiro contra a
  lista escrita à mão dos cinco comerciais. Se alguém reintroduzir a escrita de
  campo, ele acusa **nomeando o arquivo**, antes do deploy.

### O teste de mutação: 25 quebras, e as DUAS que escaparam

Rodei 25 mutações deliberadas — comentar um GRANT, omitir um parâmetro sem
DEFAULT, mandar `?? 0` no deslocamento, chamar `linhasDaGrade` com um dia só,
tirar a união do sábado, repor a régua domingo-primeiro, reabrir a porta de tipo,
fazer nascer um escritor de campo, tirar a guarda do arrasto, trocar o `div
role="button"` por `<button>`, pôr um DDL escondido na migration, e por aí. **23
foram pegas de primeira. Duas escaparam, e as duas eram buracos de verdade.**

**A que escapou por preguiça de regex.** Desligar a pergunta do "feito" — trocar
`const ok = window.confirm(` por `const ok = true` — deixava tudo verde, porque a
asserção procurava `window.confirm(` solto **e há três `window.confirm` neste
arquivo** (feito, desmarcar, tirar da agenda). Ela passou a prender o BLOCO
inteiro contra string escrita à mão: a condição, a chamada e a **saída**
(`if (!ok) return;`). É a mesma família do `-- REVOKE` e do `[\s\S]{0,N}` que
atravessa o `;`, na quarta variação: **um regex que procura uma peça encontra a
peça do vizinho**.

**A que escapou porque a regra estava no lugar errado — e essa mudou o código.**
A terceira perna de `pode_editar_chamado` (o apoio que só vale quando é do
gatilho da escala, ou quando *alguém pôs* a pessoa) vivia como uma cláusula
`.filter()` dentro da consulta de `data.ts`. Trocar a condição inteira por `true`
— que é **literalmente reabrir o auto-serviço que a S2 fechou** — deixava o
verificador verde. Regra de autorização escondida numa cláusula de consulta é
regra que ninguém consegue exercitar sem banco.

Ela virou `apoioValeComoVinculo` no modelo puro, com os quatro casos como
fixture: `origem='dupla'` mesmo com `criado_por` sendo a própria pessoa → vale;
alguém pôs → vale; `criado_por` nulo (linha anterior à S2) → vale, porque
`null !== id` é o `IS DISTINCT FROM` fazendo o que a S2 escreveu; **a própria
pessoa se pondo → NÃO vale**. É a segunda função que este commit acrescenta ao
modelo puro, e a única que eu não tinha planejado: quem a pediu foi o teste de
mutação.

Depois das duas correções: **25 de 25**.

### O que ficou declarado e não resolvido

- **`_servico_min` não tem resposta honesta**, e o campo abre vazio. Varri o
  repositório: não existe duração de serviço em lugar nenhum. `useSla()` devolve
  PRAZO de atendimento, que é pergunta semanticamente outra — usá-lo faria uma
  corretiva urgente de 4h de SLA ocupar 4h de agenda. Os atalhos estão em ordem
  crescente e nenhum vem marcado: se alguém chutar, que chute para BAIXO, o que
  faz o dia parecer mais CHEIO — errar para o lado de recusar sobrecarga, nunca
  para o lado de inventar capacidade. O modo de falha previsível não é lixo, é
  **uniformidade**: todo mundo toca o primeiro atalho e em um mês
  `agenda_campo.servico_min` é 80% o mesmo valor, com cara de medição. A defesa
  que resta não é código — é a consulta-canário em `docs/manual/operacao-campo.md`,
  com o limiar escrito ao lado.
- **Dar "feito" pode reescrever o apoio.** Com dois blocos em semanas ISO
  diferentes, carimbar o primeiro faz o espelho andar (certo, é o estágio 1) e o
  gatilho da U76 reavalia o apoio contra a semana NOVA, apagando as linhas
  `origem='dupla'` da turma que JÁ FOI — com sino. É cardinalidade, está
  declarado no cabeçalho da U78, e **nada no cliente conserta**. O que a tela
  pôde fazer sem decidir nada foi **parar de ser silenciosa**: os dois lados são
  calculáveis com `espelhoDoChamado`, e quando a semana muda ela pergunta antes,
  dizendo os dois efeitos.
- **`telas.ts:67` continua com `tecnico: false`** para esta rota. Todo o ramo
  não-gestor de `erroDeAutorizacao` é inalcançável por ela hoje — é decisão de
  permissão, é do Davi, e não muda aqui. É também por isso que preservar a
  edição do bloco único **no PainelChamado** importa: é o único caminho por onde
  um técnico chega até a fronteira que a U78 desenhou.
- **Arrastar da FAIXA para dentro de uma célula não foi construído**, e foi
  cortado em vez de esquecido. O gesto do arrasto exprime (equipe, dia), e um
  chamado da faixa precisa ainda de DURAÇÃO — que só o formulário pergunta.
  Arrastá-lo abriria o mesmo formulário com dois campos a menos para digitar, e o
  preço seria uma união de tipos no `ref` do arrasto para economizar dois
  cliques. Se a migração da base mostrar que vale, é um `tipo: "chamado"` no
  `Arrastado` e um wrapper `draggable` na faixa; o comentário no arquivo diz
  isso, para a próxima pessoa não achar que foi descuido.
- **Sem realtime em `agenda_campo`** — ver P15 em `docs/PENDENCIAS_TECNICAS.md`.

1967 asserções (64 novas, 9 migradas), **25 de 25 mutações pegas**, build ok,
`tsc` no baseline de 85.
**Migration `20260902090000_u79_a_tela_da_grade.sql` — rodar DEPOIS da U78 e
ANTES do deploy.** Ela abre as quatro portas a `authenticated`, prova o
privilégio pelo catálogo e traz o DESFAZER. Depois de rodá-la, a **linha 209 da
conferência da U78 passa a dizer `>>> OLHAR <<<` com o valor 4** — é o certo, e é
bom que doa: quer dizer que a fronteira mudou.
