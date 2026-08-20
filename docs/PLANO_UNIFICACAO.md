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
