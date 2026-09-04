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

## U80 — O ciclo financeiro no cartão (Fase 1, Passo 1.3)

R103 (o selo), R104 (concluir com decisão de cobrança), R105 (compartilhar o
dia), R106 (retornos pendentes).

Esta entrega **lê** o motor financeiro que existe desde agosto (U2–U5, U7, U13).
Ela não reescreve `aprovar_chamado_financeiro`, `ajustar_item_cobranca`,
`marcar_chamado_faturado`, os fechamentos, `cobrancas_select`, `cobrancas_write`
nem `pode_ver_financeiro`. O censo da U80 no verificador prova isso pelo
ARQUIVO (as funções que a migration define contra uma lista escrita à mão) e as
linhas 105, 106 e 114 da conferência provam pelo CATÁLOGO.

### A premissa do briefing estava errada, e a correção mudou o desenho

O briefing dizia que hoje, para o SAC, um chamado COM cobrança lançada se
apresenta como se não tivesse nenhuma — em `DetalheCampo.tsx`, no bloco gateado
por `cobrancasOs.length > 0`. Fui conferir antes de construir: **aquele bloco
está DENTRO do card aberto por `{veFinanceiro && os.status === "concluido" &&
pecasOs.length > 0 && (`**, e o comentário logo acima diz textualmente "o SAC
(gestor sem valores, R13) também não vê este card". Para o SAC o card inteiro
não é pintado. Ele não vê "nenhuma cobrança"; ele não vê seção nenhuma. Isso é
**omissão limpa, não mentira**.

O que está vivo é o **mecanismo**, e ele é pior do que "erro engolido": não
existe erro. `cobrancas_select` é `USING (pode_ver_financeiro(auth.uid()))`
(U4:293), e **uma policy de SELECT filtra linhas — ela não levanta erro**. O SAC
recebe HTTP 200 com `[]`. O `if (error) return []` de `cobranca.ts:101` nem
chega a ser exercido, porque não há nada para tratar. Nenhum tratamento de erro
no cliente conserta isso: é a FORMA da RLS. `SECURITY DEFINER` não é preferência
de estilo — é a única construção que sabe separar "zero" de "não te deixam
contar".

A omissão vira mentira no instante em que uma superfície liberada ao SAC — a
grade, `telas.ts` `[false, true, true]` — for **obrigada a dizer alguma coisa
por cartão**. Era isso que o briefing tinha razão em temer, no lugar errado.

### Quantos bits a RPC compra, medido

`aprovar_chamado_financeiro` (corpo vivo em U13:112-114, e não em U7:689 como o
briefing dizia) escreve, na MESMA transação em que insere as linhas,
`faturamento_status = CASE WHEN v_itens = 0 THEN 'sem_cobranca' ELSE 'aprovada'
END`. Logo `aprovada ⇒ EXISTS(cobrancas)`. E `chamados.faturamento_status`
**não** é gateado por `pode_ver_financeiro`: mora em `chamados`, cuja
`chamados_select` começa por `is_gestor`, que **inclui o SAC** (U6a:58).

Fiz o censo do que o bit acrescenta ao que o SAC já lê:

| Estado | Derivável da coluna? | O que a RPC acrescenta |
|---|---|---|
| `a_analisar`, `em_conferencia` | sim (não há) | nada |
| `faturada` | sim (há) | nada |
| `aprovada` | sim (há) | o caso em que as cobranças foram CANCELADAS depois |
| `sem_cobranca` | sim (não há) | o avulso vinculado, que só a porta nova cria |

**Dois casos de borda, e a medida está escrita no código**: o parâmetro
`temLancamento` é lido em EXATAMENTE DUAS LINHAS de `seloDoCiclo`. Se o Davi
quiser cortar escopo, cortar a RPC custa esses dois casos e o resto da entrega
fica de pé — e a linha 108 da conferência diz, antes de instalar, se a função
tem algum usuário (quantas pessoas são gestor E não veem financeiro; se for 0,
ela não tem um único).

Construí mesmo assim por três razões que não são estética: o painel de conclusão
precisa da mesma resposta e discordaria da grade; ela é a fonte única dos dois
consumidores, matando a divergência que já existe entre `useCobrancasDoChamado`
(traz `cancelada` junto) e `consolidar()`/`montar_fechamento` (filtram); e ela
devolve **um booleano**, nunca uma contagem — `3` é "três peças faturáveis neste
atendimento", que é volume de serviço, e o cartão perguntou "já lançou?".

### O gate é `is_gestor`, e a escolha tem uma razão medida

`pode_acessar_chamado` (corpo vivo em S2:148-158) tem o ramo `c.responsavel_id
IS NULL`: **qualquer autenticado acessa chamado sem dono**. `chamados_select`
(U7:545) **não** tem esse ramo. Usar aquela régua faria a função responder sobre
chamados que quem perguntou não consegue LER — e, combinada com
`agenda_campo_select USING (true)` (decisão declarada da U78, porque sem ela o
chip de ocupação da equipe do técnico mostraria 40% onde há 90%), ela viraria um
oráculo que diz quais serviços dos colegas foram faturados, 150 por requisição.

Gate ÚNICO, e de propósito: duas camadas em que a de dentro é sempre verdadeira
para quem passou pela de fora é código morto num caminho de segurança — não
exercitado, e dando conforto falso. Quem não é gestor recebe **zero linhas**, o
`Map` do cliente nasce vazio, e a grade dele fica exatamente como era. A
degradação é silenciosa e CORRETA; um 42501 ali daria a ele uma faixa vermelha
no lugar da programação.

### Os índices: onde "impossível" deixa de ser adjetivo

Não existia UNIQUE nenhum em `cobrancas` — os quatro índices da U4:85-88 são
todos não-únicos. O que travava reaprovação era o `DELETE … WHERE chamado_id = _
AND status = 'aberta'` de U13:95, e ele é idempotente **de uma thread só**. Dois
cenários duplicavam:

1. **concorrência.** Em READ COMMITTED, T1 e T2 fazem DELETE (0 linhas cada, com
   snapshots diferentes), inserem 3 cada, e o cliente é cobrado duas vezes.
2. **reaprovar depois do fechamento.** O DELETE apaga só `'aberta'`; as
   `fechada`/`faturada` sobrevivem e um jogo novo entra ao lado. Nada em
   `aprovar_chamado_financeiro` olha `faturamento_status`. **A trava era de
   tela** (o botão exige `a_analisar`), não de motor.

`cobrancas_uma_por_peca_idx` e `cobrancas_avulsa_unica_por_chamado_idx`, os dois
parciais em `status <> 'cancelada'` — cancelar libera a peça para ser cobrada de
novo, que é o que a palavra quer dizer, e é o MESMO recorte de
`montar_fechamento` (U5:139) e de `consolidar()`. Reaprovação legítima continua
passando: DELETE e INSERT são da mesma transação, e as linhas apagadas já estão
mortas para o índice quando o INSERT chega.

**O preço, declarado:** `aprovar_chamado_financeiro`, que esta migration não
toca, passa a poder devolver 23505 onde antes duplicava em silêncio. É correção
trocando silêncio por barulho, e o barulho é feio — em inglês, para um
comercial, às 18h. Quem traduz é `aprovarCobranca()`, que não é motor; uma
chamada direta à RPC continua vendo o erro cru.

**E o pré-voo ABORTA** se a base já tiver a duplicata que os índices proíbem,
com a consulta de "quem não casou" dentro da mensagem. O padrão da casa para
constraint (`DO $$ … EXCEPTION … RAISE NOTICE`, U4:52-83) engoliria a falha — e
`RAISE NOTICE` é **invisível** no editor do Supabase: a migration terminaria
VERDE sem o índice, com a promessa inteira apoiada em nada. **Existe uma chance
real de a U80 abortar na primeira tentativa**, porque o cenário 2 está vivo
desde a U13 e é acionável pela UI. Digo isso antes de o Davi rodar: descobrir às
23h que a migration não passa é pior do que saber às 10h que ela pode não
passar. E cancelar é `UPDATE status='cancelada'`, **nunca DELETE** — um
fechamento pode já ter recolhido a linha.

### O estado em que o cartão se cala

`aprovada`/`faturada` **sem** lançamento vivo é o caso em que as duas verdades
discordam. Considerei os dois selos possíveis e recusei os dois: "Lançado"
afirma o que não existe; "nada a cobrar" afirma o contrário **e** entrega, por
inferência, que alguém CANCELOU uma cobrança já lançada — que é conversa
comercial com o cliente, e é exatamente o que a RPC se recusa a devolver. As
duas leituras mentem, em direções opostas.

Então `seloDoCiclo` devolve `null` e a divergência vai para `divergenciasDoCiclo`
— gêmeo de desenho de `blocosForaDaGrade`: um número que tem de ser zero, com
faixa quando não é, **gateada por `veFinanceiro`**, porque as duas conversas
possíveis são de quem vê valores. Para o SAC o cartão fica em silêncio, que é
omissão, igual à de um chamado ainda aberto.

### O que eu recusei construir

- **Lançar direto pelo cartão da grade.** O cartão mostra o selo e APONTA. A
  porta é uma RPC, não um INSERT do navegador — `lancarCobrancaAvulsa` não grava
  `chamado_id`, não grava `contrato_id`, não mexe em `faturamento_status`, e
  usada como está criaria uma cobrança que o selo nunca encontra.
- **Uma terceira via de nascimento de cobrança.** A U4:295-296 escreveu a
  fronteira: "escrita direta existe para lançamento avulso; a cobrança que vem
  de OS nasce só pela aprovação". A porta nova é a via do avulso VINCULADO, e
  ela **recusa** rodar num chamado que teve análise item a item: onde houve
  análise, a cobrança sai da conferência, com o valor do contrato. Sem essa
  linha, um gestor digitaria R$ 480 num chamado com seis peças analisadas e o
  contrato não teria opinião.
- **Reescrever a divisão das parcelas em SQL.** `parcelar()` divide em centavos
  com o resto na primeira, porque 3 × 33,33 em float dá 99,99 e o cliente paga a
  menos para sempre. O array vai no corpo e o servidor **confere que a soma
  fecha**: a divisão tem um dono só, e a invariante é conferida dos dois lados.
- **Um 5º balde em `classificarChamado`.** Ela está sob asserção CRÍTICA em dois
  pontos; "retorno pendente" é um predicado IRMÃO.
- **Um contador de ciclo no `CabecalhoDaLinha`.** Aquele cabeçalho é por
  EQUIPE/semana e o ciclo é por CHAMADO. O agregado vai na linha de resumo do
  dia, que é onde "quem conta é quem filtra" já está aplicado.
- **O selo dentro de `ItemDaGrade`.** `celulaDaGrade` é O ÁTOMO, e o átomo não
  pode mudar com quem olha — é a lição literal de `divergenciaDeEquipe`, que
  devolve `null` para o contador do cabeçalho não dar `[1,0,0,1]` para o gestor
  e `[3,1,0,1]` para o técnico. O selo é eixo ortogonal e fica do lado de fora,
  num `Map`. Bônus honesto: a entrega sai com uma linha apagada se virar
  poluição; um campo no átomo é para sempre.
- **Abrir o painel do ciclo pelo clique no cartão.** O clique continua sendo o
  gesto da AGENDA. Trocá-lo faria quem só queria mover meia hora cair numa
  decisão financeira. O ciclo entra por uma lista abaixo da grade, derivada dos
  MESMOS selos.

### Detalhes que só apareceram lendo o código

- **`notify_chamado` lê `NEW.faturamento_status`** no ramo `NEW.status =
  'concluido'` (U13:196-206) para decidir se dispara "Chamado a conferir" a todo
  admin/comercial. Por isso a porta faz **UM ÚNICO UPDATE**: em dois, o primeiro
  dispararia o aviso com o valor VELHO — um sino por atendimento encerrado, e um
  alerta de conferência para algo que acabou de ser decidido.
- **`trg_chamados_espelho_e_do_satelite` não dispara** no UPDATE da porta: ele é
  `BEFORE UPDATE OF data_hora_agendada` (U79:239-241), e a coluna não está no SET.
- **O comentário de `programacao/data.ts` estava errado** e afirmava que "o sac
  NÃO é gestor para a porta", transcrevendo `is_gestor` sem `sac`. É falso desde
  a U6a:51-66. Quem escrevesse um selo lendo aquele comentário erraria a régua na
  primeira linha. Corrigido.
- **O botão "Marcar faturada" nunca renderizou para ninguém.** A condição testava
  `c.status === "aberto" || c.status === "concluido"` contra um domínio que é
  `('aberta','fechada','faturada','cancelada')` (CHECK em U4:54-55) — gênero
  masculino em cima de valores femininos, e o `as any` da consulta impediu o
  `tsc` de ver. `marcar_chamado_faturado` está instalada, com REVOKE e GRANT
  corretos, sem chamador vivo desde a U7. Consertado.
- **O card de cobrança somava a `cancelada` junto** no "N cobrança(s) geradas ·
  R$ X". Um atendimento com uma cobrança de R$ 400 cancelada anunciava dinheiro
  que não existe. O recorte agora mora em UM lugar (`temLancamento`), e é o
  mesmo dos índices e do fechamento.
- **`useChamadosComBloco` passou a pedir `cumprido_em`** junto do `chamado_id` —
  a coluna a mais custa ZERO requisição e a MESMA resposta produz os dois Sets
  que "retorno pendente" precisa. Sem isso o predicado sairia dos blocos da
  SEMANA e responderia "nada à frente" para um retorno marcado daqui a três
  semanas, que é o defeito que o docblock daquela função já descreve.
- **`useBlocosDaGrade` passou a devolver `idsDeChamado`.** `blocos` é o SUPERSET
  (semana + irmãos de outras semanas, que o ordinal precisa); derivar a lista
  dali inflaria a pergunta com chamados que não têm um cartão sequer na tela.
- **O `as unknown as ChamadoParaGrade[]` morreu.** Aquela dupla asserção desliga
  o typechecker: `faturamento_status`, obrigatório desde esta entrega, chegaria
  como `undefined` sem o `tsc` nem o CENSO dizerem nada — e `undefined !== null`,
  então o selo cairia num ramo que ninguém escreveu. Virou
  `chamadosParaGrade()`, com asserção de que a string sumiu do route.

### O que a verificação pegou

- **Três falsos positivos de comentário, numa tarde.** O regex `RAISE NOTICE`
  casava com a frase da U80 que explica **por que ela aborta em vez de usar
  RAISE NOTICE**; o regex `prosrc` casava com a linha que diz que **nenhuma
  conferência procura substring em prosrc**; e o regex do botão morto casava com
  o comentário que **conta o conserto**. O filtro que o repo já tinha
  (`^\s*(//|\*|/\*)`) não pega o terceiro, porque a linha do meio de um bloco
  `{/* … */}` em JSX não começa por nenhum dos três. Passou a haver um
  `soCodigo80` que remove os blocos INTEIROS.
- **O censo das três listas da U79 ficou vermelho** quando a camada de dados
  ganhou duas RPCs que a U79 não concede. Excluí-las ali sem medi-las em lugar
  nenhum seria abrir um buraco no censo — então a exclusão é nominal e o censo
  da U80 prova que aquelas duas são exatamente as RPCs da camada que não são
  portas da agenda, e que as duas são concedidas pela U80. As duas listas se
  conferem uma à outra.
- **O censo dos escritores de `data_hora_agendada` acusou `modelo.ts`**, porque
  `chamadosParaGrade` copia a coluna da linha lida para o modelo de tela. Não é
  gravação. A isenção nova é apertada de propósito — a coluna aparecendo dos
  DOIS lados —, e uma gravação de verdade (`{ data_hora_agendada: iso }`)
  continua sendo pega.
- **O CENSO dos exports do modelo puro** acusou `SELOS_DO_CICLO` sem consumidor
  na primeira rodada. Ele tem consumidor agora: o censo dos seis selos.

**Quatro asserções de mutação**, cada uma escrita quebrando a regra e vendo o
verificador ficar vermelho antes de contar: (i) o item OCULTO não vaza cliente,
endereço nem descrição para o texto compartilhado — com CANÁRIO, porque um regex
procurando `ROTULO_DO_OCULTO` no fonte provaria que a linha existe e não que ela
está viva; (ii) `null` e `false` em `temLancamento` são estados diferentes;
(iii) o bloco de chamado ilegível devolve `null` e não "sem OS"; (iv)
`plantonista: null` não produz uma linha sequer.

**Dois censos de lista derivada contra lista escrita à mão:** os seis selos (o
`type`, a constante, o rótulo e a cor têm de ser a MESMA lista — um selo novo
sem palavra ou sem cor cai ali) e os cinco valores do CHECK de
`faturamento_status` da U7 contra os três que produzem selo. O segundo é o que
pegaria um valor novo no CHECK, e é o que pegou `em_conferencia` sendo o valor
que existia e que gate nenhum lia.

### O que fica declarado, e não foi consertado

Quatro defeitos apurados no caminho, todos em `docs/PENDENCIAS_TECNICAS.md`. O
mais grave muda o cálculo desta entrega inteira: **`chamado_eventos_select` é
`USING (true)`** (U7:586-587) e `aprovar_chamado_financeiro` grava
`'Cobrança aprovada: 3 item(ns), total 1.842,50'` ali (U13:116-120), pintado sem
gate nenhum em `DetalheCampo.tsx:1252-1278` (a pintura é a 1267 — a citação
original dizia 1205-1207, e a S4 a corrigiu: 1207 é outro bloco). **Hoje
qualquer autenticado — o SAC
e o técnico — lê o valor exato em reais que a R13 e a U6a existem para
esconder.** Não é da Fase 1 e não conserto aqui, mas não dá para argumentar que
"existe cobrança" é seguro *por ser menos que o valor* quando o valor já está
aberto ao lado. O argumento do bit tem de se sustentar sozinho, e ele se
sustenta (`aprovada ⇒ EXISTS`, e o SAC já lê `aprovada`) — mas a ordem de
prioridade do Davi provavelmente deveria mudar.

**Migration `20260903090000_u80_ciclo_financeiro_no_card.sql` — rodar DEPOIS da
U79.** Ela pode ABORTAR no pré-voo se a base já tiver duplicata; a mensagem traz
a consulta. Olhe a **linha 108** antes de decidir instalar (se ninguém é gestor
sem financeiro, a RPC de leitura não tem usuário) e a **linha 112** (o ponto
cego declarado: bloco que aconteceu e ninguém marcou "feito" não ganha selo, não
entra em retornos pendentes e não desenha cartão na semana aberta).

### As duas correções de DINHEIRO que a auditoria trouxe depois

Zero FATAL, dez GRAVE. Duas mexiam em dinheiro, e por isso entraram antes de
qualquer outra coisa — em dinheiro, "improvável" não conta.

**"1.500" virava R$ 1,50.** `Number(valor.replace(",", "."))` troca só a
PRIMEIRA vírgula. A tabela do que uma pessoa digita num campo de valor:

| digitado | resultado | o que acontecia |
|---|---|---|
| `1500` | 1500 | ok |
| `1500,00` | 1500 | ok |
| `1.500,00` | NaN | recusado — chato, mas seguro |
| `R$ 1500` | NaN | recusado — chato, mas seguro |
| **`1.500`** | **1.5** | **lançava R$ 1,50** |

O último é o mais provável de todos e era o **único que não era recusado**. Ele
atravessava a validação, atravessava `parcelar`, o servidor conferia que a soma
fecha (1,50 = 1,50) e gravava — subcobrando o cliente em 99,9% **com trilha de
auditoria completa dizendo que alguém decidiu aquilo**. Virou `reaisDigitados`,
função pura em `modelo.ts` com asserção sobre a tabela inteira: a vírgula manda,
e sem ela o ponto só é milhar quando vem seguido de três dígitos. De quebra, a
conversão saiu do componente, que é a regra 7 da casa.

**A competência caía no mês errado.** `timestamptz::date` usa o TimeZone da
SESSÃO, que no Supabase é UTC. Um atendimento encerrado às 21:30 de 31/08 em
Brasília é 00:30 de 01/09 em UTC: a cobrança nascia com competência do mês
SEGUINTE e entrava no fechamento errado.

E aqui está a parte que muda a natureza do conserto: **o defeito não é da U80.**
`aprovar_chamado_financeiro()` (U7:711) já fazia `COALESCE(...)::date` sem fuso,
e a U80 copiou a convenção. Ou seja, isto está vivo desde agosto. A U76
documentou a armadilha ("uma hora de diferença vira uma semana de erro"), a U78 e
a U79 a respeitaram, e aqui ela custa um MÊS em vez de uma semana.

Consertei os DOIS caminhos na mesma migration, e o motivo é que consertar só o
novo seria pior que o defeito: a mesma conta cairia em meses diferentes conforme
a porta por onde entrou, e ninguém entenderia olhando os dados. **Nenhuma linha
já gravada é reescrita** — um fechamento pode já ter recolhido aquela cobrança, e
mudar a competência de uma linha fechada alteraria um total que alguém conferiu e
possivelmente já cobrou.

**Os dois censos ficaram vermelhos, e estavam certos.** Eles acusaram
`aprovar_chamado_financeiro` aparecendo numa migration que se declarava "não
toca o motor". Era verdade quando foram escritos e deixou de ser quando eu
encostei no motor — então a lista mudou, com o porquê ao lado, em vez de o censo
ser afrouxado. É a diferença entre atualizar uma afirmação e silenciá-la.

**Teste de mutação das duas correções: 12 de 12 pegas** — e a última só depois de
apertar uma asserção que o `[sS]{0,200}` deixava passar: um `IF false`
injetado desligava a garantia do "revisar" com a suíte verde. Terceira aparição
da mesma família nesta semana.

2061 asserções, build ok, tsc em **83** — dois ABAIXO do baseline de 85, porque a
entrega fechou duas portas de tipo que estavam abertas.

### A U80 não rodou na primeira tentativa, e a causa é uma armadilha do lexer

`ERROR: 42601: syntax error at or near ".."`, apontando para a linha 95 — que
é um COMENTÁRIO. O comentário dizia, em prosa, que o padrão da casa para
constraint é `DO $` + `$ ... EXCEPTION WHEN check_violation`.

**O Postgres não pula comentários ao procurar o fim de um dollar-quote.** Fora
do bloco, `--` comenta até o fim da linha. DENTRO dele, o lexer procura apenas
o delimitador de fechamento — então aquele par de cifrões, escrito num
comentário dentro de um `DO` vivo, FECHOU o bloco ali. Todo o resto do corpo
virou SQL solto, e o erro foi cair nas reticências do próprio comentário.

É uma armadilha que só morde quem **escreve sobre migrations dentro de
migrations**, que é exatamente o estilo desta casa: os comentários daqui
explicam padrões, citam outras migrations e mostram trechos. Por isso ela
mereceu asserção em vez de cuidado.

**A varredura das 100+ migrations, e o falso positivo que ela quase produziu.**
A primeira versão do detector acusou 15 ocorrências — 14 delas no rodapé
DESFAZER de U76, U78 e S2, onde linhas como `-- AS $desfaz$` aparecem. Elas são
INOFENSIVAS: ali o código está comentado linha a linha, o lexer nunca entra em
modo dollar-quote, e a prova é que as três rodaram limpas em produção. Um
detector que não simula o lexer acusa catorze inocentes e esconde o único
culpado.

A versão que ficou simula o lexer de verdade (comentário de linha, comentário de
bloco, string com aspas duplicadas, e o modo dollar-quote onde nada disso vale),
e vem com três **pares negativos**: ela tem de ACUSAR o defeito real, e tem de
NÃO acusar o rodapé comentado nem um bloco normal. Sem esses três, um detector
quebrado passaria verde para sempre — que foi como a primeira versão quase
passou.

Mutação: reintroduzir o defeito exato deixa a suíte vermelha.

2065 asserções, build ok, tsc em 83.


## S4 — Auditoria de valor: quem consegue ler dinheiro, e isso bate com a R13

Série S (segurança), como a S1, a S2 e a S3. A pergunta foi uma só: **quem
consegue ler dinheiro neste sistema, e isso bate com o que a R13 promete?** A
R13 diz que o SAC é *gestor que não vê valores*, e a U6a materializou isso
separando duas réguas de propósito — `is_gestor()` = admin+comercial+sac
(operação) e `pode_ver_financeiro()` = admin+comercial (dinheiro).

Quatro leituras independentes varreram o repo (a linha do tempo, o censo de
policies, a matriz de papéis e a superfície de tela). Uma triagem cruzou os
achados contra o arquivo. **A régua `pode_ver_financeiro` está correta e
consistente em 100% das tabelas de REGISTRO de dinheiro** — `cobrancas` (u4:293),
`fechamentos` (u5:302), `cliente_contratos` (u2:267), `contrato_precos`
(u2:285), `contrato_cobertura_itens` (u2:276), `chamado_pecas_analise` (u7:631).
O motor financeiro da série U está certo. O que estava aberto era o que fica
**ao lado** dele: a narrativa e o catálogo.

### O que a S4 fecha, e é o menor conjunto possível

**1. A linha do tempo entregava o total em reais a todo autenticado.**
`chamado_eventos_select` era `FOR SELECT TO authenticated USING (true)`
(u7:586-587) — e a mesma migration, oito linhas acima, escreveu
`chamado_fotos_select` e `chamado_checklist_select` com
`pode_acessar_chamado(chamado_id)`. Não foi decisão: foi a peça que nasceu sem
ninguém pensar nela. E `aprovar_chamado_financeiro` gravava ali
`'Cobrança aprovada: N item(ns), total ' || to_char(v_total,'FM999G999G990D00')`
(u13:116-120).

O alcance real não é "o técnico vê o total do chamado dele". Pelo modelo de
ameaça desta casa — todo usuário fala direto com o Postgres com a MESMA chave
publishable, que está no `.env` versionado —
`GET /rest/v1/chamado_eventos?tipo=eq.cobranca_aprovada` devolvia os totais
aprovados da empresa inteira. A tela (`DetalheCampo.tsx:1267`, que pinta
`{ev.descricao ?? ev.tipo}` fora de qualquer `veFinanceiro`) era o caso menor.

**2. A U80 tinha apagado o gate de papel de `aprovar_chamado_financeiro`.**
Este é o mais grave, e foi pego antes de rodar. O cabeçalho da U80 afirma, na
linha 11, "Não reescreve `aprovar_chamado_financeiro`", e a linha 583 afirma "A
ÚNICA MUDANÇA DA U80 NESTE CORPO, e é esta linha: AT TIME ZONE". As duas são
falsas: o corpo de u80:562-605 é novo. Contra a U13 sumiram o gate
(`IF NOT public.pode_ver_financeiro(auth.uid()) THEN RAISE … 42501`), a trava
`status <> 'concluido'`, o `sem_cobranca` e o `concluida_em` — e entraram quatro
colunas que **não existem** em `chamado_pecas_analise` (`decisao`,
`valor_cobravel`, `descricao`, `id`; as reais são `resultado` e
`valor_calculado`, u3:150-165 mais os renames da u7).

Numa `SECURITY DEFINER` o `GRANT` tem de ser `authenticated` — o corpo é o
**único** lugar onde o papel pode ser checado. Sem o gate, qualquer técnico faz
`POST /rest/v1/rpc/aprovar_chamado_financeiro` e recebe
`RETURNS TABLE (itens integer, total numeric)`, além de gravar cobranças por
cima de `cobrancas_write`. É pior que o defeito 1, porque não depende de o
chamado ter tido evento. E corpo plpgsql não é resolvido no `CREATE`: a U80
aplica **verde** e a função quebra com 42703 na primeira aprovação
(`cobranca.ts:197`) — a fila de faturamento inteira morre com ela.

### Por que nada tinha pego isso, e as duas lições

A conferência da U80 lê o catálogo e diz, em u80:614-615, "privilégio não mora
no corpo da função, mora no catálogo — nenhuma linha aqui procura substring em
`prosrc`". Para GRANT/REVOKE, verdade inteira. **Para o gate de papel de uma
SECURITY DEFINER, é o oposto exato: o catálogo NÃO PODE enxergá-lo.** A linha
105 deu "ok" no ACL enquanto a régua que ele deveria proteger não estava mais
lá. A S4 lê `prosrc` uma vez, de propósito, e **ordenada** — não pergunta se o
gate aparece, pergunta se ele aparece ANTES da leitura que protege.

E a asserção `verificar-logica.cjs:8698` jurava, verde, que "o que ela muda é o
FUSO, nada mais — as duas garantias do motor continuam de pé", provando isso com
três regex de **presença**. Nenhuma perguntava o que SAIU. É a regra 4 em estado
puro: a asserção foi escrita a partir do corpo NOVO, listou o que o corpo novo
manteve, e chamou isso de "as duas garantias". Eram três. **Uma asserção verde
que diz uma falsidade é pior do que não ter asserção nenhuma** — ela foi
substituída por uma que diz a verdade sobre a U80 (que não pode ser editada,
CLAUDE.md:53) e aponta para a S4 como consequência.

### O falso-positivo que mudou o conserto

Duas leituras propuseram uma função nova (`pode_ler_chamado`) só para
acrescentar uma perna `OR natureza = 'interno'`, as duas citando
`chamados_select` como estando em u7:545-548, e as duas argumentando que sem ela
o feed de comentários dos chamados internos voltaria vazio, sem erro.

**Essa policy está morta.** `u29:181` a droppa e `u29:182-196` a recria, e o ramo
não-comercial da versão viva não tem `natureza = 'interno'`. Hoje o técnico já
não enxerga chamado interno de outra pessoa. A perna teria sido um
**afrouxamento** disfarçado de compatibilidade — daria linha do tempo de chamado
interno a quem não consegue nem abrir a capa. É a regra 2 aplicada a policy em
vez de a regex: *a linha existia no repo, mas não estava VIVA*.

Com a régua viva na mão, `pode_acessar_chamado` (s2:147-164) é **superconjunto**
de `chamados_select` no ramo não-comercial: ninguém que hoje abre um chamado
perde a linha do tempo dele. Resíduo declarado em comentário na migration: para
`natureza = 'comercial'`, `chamados_select` é mais estrita, então quem abriu um
comercial que não é seu passa a ler o evento sem abrir a capa. É muito menos que
`true`, e é o mesmo desvio que fotos e checklist já têm desde 19/08.

### "Quem usa isto hoje, e para quê" — respondido, não suposto

Fechar demais quebra trabalho legítimo, e em silêncio: policy de SELECT **filtra
linhas**, não levanta erro; o feed volta vazio e a tela desenha "Ninguém comentou
ainda." para uma conversa cheia. Então a varredura veio antes da policy: existe
**um único SELECT** de `chamado_eventos` em todo o `src/` (`data.ts:337-341`) e
ele é sempre `.eq("chamado_id", <um id>)`, com três chamadores que partem de um
chamado já aberto. Nenhum feed agregado. `supabase/functions/` não toca a tabela.
Nenhuma tela quebra — e o lado do app não muda em uma linha, o que é o resultado
certo: um gate em `DetalheCampo.tsx:1267` seria teatro, porque o `curl` continua
mostrando o que a tela esconde.

### O que a S4 recusou fazer, e cada recusa tem motivo

- **`equipamentos.custo`/`markup` e `servicos.preco_unitario_mensal`**, abertos
  em `USING (true)` desde junho, por onde qualquer autenticado reproduz a tabela
  de preço e a margem da empresa. Aqui **não há policy errada: há R12 contra
  R13.** A R12 manda o técnico montar o orçamento na visita, e
  `BlocoItensEditor.tsx:168-178` faz `custo × markup` em quatro telas do fluxo
  dele. Fechar quebra a R12; não fechar deixa a R13 literalmente falsa. É
  chamada de produto do Davi — P22, com o mapa de impacto pronto.
- **O SAC lê o orçamento da visita** por deriva do `is_gestor` (a etapa0:313 diz
  "admin/comercial" e a U6a ampliou a função três dias depois). A deriva é real e
  está documentada contra si mesma, mas as três tabelas do trio **não têm coluna
  de dinheiro** — o R$ daquela tela é calculado no navegador a partir de
  `equipamentos` — e fechá-las quebraria `inventario.ts` e `checklist.ts` para o
  SAC sem esconder um real. É sintoma de P22. Registrado como P23.
- **`unidades_select`**, que a S1 §2.3 achou ter fechado e não fechou (ela dropou
  `cliente_equipamento_unidades_select`, um nome que não existia). É segurança
  física/LGPD, não R13, e antes precisa do `pg_policies` real. P24.
- **A coluna `chamado_eventos.financeiro`**, com `DEFAULT true` invertido para
  que um escritor futuro nasça escondido. O desenho é bom e o argumento do
  "escritor que ainda não nasceu" é o certo — mas o custo dela depende de um
  número que ninguém mediu, e **o §3 da migration É essa medição**: a U69:57 fez
  `DELETE FROM public.chamados` e `chamado_eventos` sai por CASCADE. Se o resíduo
  voltar zero, a coluna guardaria conjunto vazio ao preço de recriar cinco
  funções. Se voltar linha, ela vira a S5 e é obrigatória. E o invariante que ela
  protegeria é melhor servido pelo censo de escritores, que falha no CI em vez de
  esconder uma linha em produção.
- **O P19** (o `DELETE` incondicional come a cobrança avulsa vinculada). Aqui
  apareceu algo novo: **o conserto de uma linha que o P19 propõe é
  insuficiente.** Estreitar o `DELETE` para `chamado_peca_id IS NOT NULL` salva o
  dinheiro, mas o `v_itens = 0` seguinte crava `sem_cobranca` — trocaria "o
  dinheiro some e a linha do tempo confirma que não havia dinheiro" por "o
  dinheiro fica e o status mente". O conserto certo mexe também na decisão de
  `faturamento_status`, e isso é motor, não auditoria.

### O que a verificação pegou

Três censos, e cada um pega o que asserção-por-caso não pegaria:

- **Censo de COLUNA** — as colunas vivas de `chamado_pecas_analise` derivadas do
  DDL da U3 mais os `RENAME COLUMN` da U7, cruzadas com o que o corpo referencia.
  É a asserção que teria pego a U80 sozinha, e ela vem com **par negativo**:
  apontada para o corpo da U80, tem de acusar as quatro fantasmas. Sem o par, um
  extrator quebrado devolveria lista vazia e passaria verde para sempre.
- **Censo de ESCRITOR** — o corpo VIVO de cada função (última definição no repo,
  descontados os `DROP FUNCTION`) que insere na linha do tempo, contra uma lista
  de cinco escrita à mão; mais o invariante de que nenhum insert vivo carrega
  cifra. Um sexto escritor acusa sozinho.
- **Censo de POLICY PERMISSIVA** — replay de `CREATE`/`DROP POLICY` ciente de
  `RENAME TO` e `DROP TABLE`, contra a lista das 22 que ficam abertas com o
  motivo escrito ao lado. Sem o `RENAME TO`, quatro fantasmas (`os_sla_select` e
  companhia) aparecem vivas em tabelas que não existem mais. Uma policy nova e
  frouxa entra na lista sozinha, e fica vermelha sem ninguém lembrar de escrever
  asserção para ela.

**A quarta variação da cicatriz da regra 2, e ela apareceu escrevendo isto.** A
negativa "não sobrou `USING (true)` na S4" ficava vermelha com a migration
CORRETA — porque o `COMMENT ON POLICY` e a linha 302 da conferência **citam**
`USING (true)` para dizer o que era, e as duas citações moram dentro de uma
**string SQL**, que o filtro de linhas de comentário não alcança. As três
anteriores eram `-- REVOKE`, o quantificador frouxo atravessando o `;`, e o
`RETURN` posto depois do `BEGIN`. Esta é: *o comentário que explica o defeito,
escrito dentro de uma string*. A medida passou a ser o STATEMENT (`USING (true);`,
com o terminador), não a substring.

**Teste de mutação: 18 de 18 pegas.** Entre elas, as duas que mutam o próprio
censo — tirar o `RENAME COLUMN` do extrator de coluna e o `RENAME TO` do censo de
policy — e a que afrouxa a asserção nova sobre a U80 para "o gate está lá".

2091 asserções, build ok, tsc em 83 (baseline).

### A ordem de execução, e ela importa

**U76 → U79 → U80 → S4, na mesma sessão, sem clicar em "Aprovar cobrança" no
meio.** A janela entre a U80 e a S4 é o único momento em que a função fica sem
gate *e* quebrada. A S4 é `CREATE OR REPLACE` na mesma assinatura `(uuid)`, então
ela sobrescreve — e o §0 dela **aborta** se a U80 ainda não rodou, porque na
ordem errada o conserto é sobrescrito pelo defeito meia hora depois. A U80 não
foi editada (CLAUDE.md:53).

### As duas perguntas para o Davi

1. **R12 ou R13?** O técnico monta orçamento na visita e vê preço de venda
   (implementado, quatro telas), ou o técnico não vê valores (escrito)? Uma das
   duas precisa ser reescrita em `PRODUTO.md`; hoje elas se contradizem e o
   código escolheu sozinho. Sem essa resposta, P22 e P23 não têm conserto — têm
   palpite.
2. `SELECT policyname, qual FROM pg_policies WHERE tablename='cliente_equipamento_unidades';`
   — decide se P24 é conserto ou se o repo é que está desatualizado.

### A segunda travada da U80, e a raiz que as duas compartilham

`ERROR: 42601: syntax error at end of input`, apontando para a linha 431 — que
está correta. A linha era:

```sql
IF v_n > CASE WHEN v_tipo = instalacao THEN 60 ELSE 12 END THEN
```

**O plpgsql delimita a condição de um IF procurando a palavra `THEN` no nível
zero de parênteses.** Um `CASE` nu põe um `THEN` nesse nível: a condição é
cortada em `v_tipo = instalacao`, o resto do corpo derrapa, e o erro sai lá na
frente — no fim da entrada. Os parênteses em volta do CASE não são estilo; são o
que faz o comando existir.

**A raiz que as duas travadas compartilham, e que é mais importante que
qualquer uma delas:** neste repositório **o SQL nunca é analisado por um parser
antes de o Davi colar no editor**. O verificador lê TEXTO. O `vite build` não
compila SQL. Não há Postgres local. Então erro de sintaxe só aparece na
produção, com ele parado esperando — foi o que aconteceu duas vezes hoje, com a
mesma migration.

As duas asserções novas **não substituem um parser**, e vale ser honesto sobre
isso: elas cobrem as armadilhas CONHECIDAS. Cada nova que morder vira mais uma
linha ali. O conserto de verdade seria um `postgres` de teste no laço, e isso
não existe aqui hoje.

Cada detector veio com **pares negativos** — ele tem de achar o defeito E poupar
a forma correta. É a lição do detector de dollar-quote, cuja primeira versão
acusou catorze inocentes (os rodapés DESFAZER, comentados linha a linha) e por
pouco não escondeu o único culpado.

Mutação: reintroduzir cada uma das duas armadilhas deixa a suíte vermelha. 2/2.

2095 asserções, build ok, tsc em 83.

### A S4 e o erro que ela quase deixou passar — no meu §4b

A auditoria de valor achou o que foi buscar (o total em reais legível por
qualquer login na linha do tempo) e, de quebra, **dois defeitos BLOQUEANTES no
§4b que eu mesmo tinha escrito na U80**:

1. **O corpo foi copiado da U7, não da U13.** A U13 é a versão viva, e ela tinha
   evoluído. Minha reescrita teria revertido, em silêncio: o gate
   `pode_ver_financeiro` (qualquer autenticado passaria a aprovar cobrança e a
   receber `total numeric` de volta), a trava `status <> concluido`, o
   `sem_cobranca` quando não há item, o `concluida_em` no COALESCE, e o
   `nao_identificado` na checagem de revisão.
2. **Colunas que não existem.** A U7 lia `a.decisao` e `a.valor_cobravel`; a
   U13 lê `a.resultado` e `a.valor_calculado` e junta `chamado_pecas`. Seria
   `42703` na primeira aprovação, com a fila de faturamento parada.

**E a asserção que eu escrevi para guardar a promessa "a única mudança é o
fuso" checava a PRESENÇA de três coisas.** Presença nunca detecta o que foi
APAGADO — e o que estava sendo apagado era o gate de papel. É a quarta variação
desta semana da mesma família ("regex prova que a linha existe"), e a mais cara:
as três anteriores deixavam passar código morto; esta deixava passar código VIVO
E ERRADO num caminho de dinheiro.

**A forma certa quando uma migration reescreve função de outra é um DIFF:**
extrair os dois corpos, normalizar, e exigir que a diferença seja exatamente a
esperada. Assim o que SAI sem querer acusa junto com o que ENTRA sem querer.
Está aplicado nos dois lugares — no §4b da U80 (uma mudança: o fuso) e no corpo
da S4 (duas: o fuso e o evento sem a cifra).

**Sobre editar a U80 em vez de consertar pela S4.** O CLAUDE.md diz "nunca edite
migration já enviada — faça outra", e o agente que desenhou a S4 leu isso ao pé
da letra, construindo um plano inteiro em cima disso. A regra existe porque
editar uma migration que JÁ RODOU não muda o banco — a alteração fica invisível.
A U80 abortou duas vezes por erro de sintaxe e nunca aplicou nada (é tudo uma
transação): o banco jamais a viu. Mandar uma segunda migration para consertar
função definida por uma migration quebrada que nunca rodou seria absurdo. O
corte é **rodada**, não "enviada", e a redação da regra foi afiada.

**A S4, revisada.** Ela fecha na fonte (o evento novo não carrega cifra) e
estreita a policy de `chamado_eventos_select` de `USING (true)` para
`pode_acessar_chamado` — a mesma régua que `chamado_fotos` e
`chamado_checklist` já usam desde 19/08. Não reescreve `descricao` de linha
antiga, e isso é decisão: seria destruir registro de auditoria. Em vez disso ela
MEDE o resíduo e põe o número na frente do Davi.

Mutação sobre as promessas da S4: **8 de 8**. O único "sobrevivente" era mutação
inválida — a âncora casou uma linha de COMENTÁRIO que citava o gate, e a função
ficou intacta. Terceira vez que isso acontece nesta semana; conferir se a
mutação atingiu o alvo virou parte do procedimento.

2104 asserções, build ok, tsc em 83.


## U81 — O apoio que já foi é registro (R107/R108 — Fase 1, Passo 1.4)

O defeito estava DECLARADO desde a U78, no cabeçalho, na seção "O QUE AINDA
ESPERA UMA FRASE DO DAVI", e a frase chegou em 02/09. O defeito, verificado no
código antes de qualquer linha ser escrita:

Um chamado com dois blocos em semanas ISO diferentes — a visita de terça e o
retorno da quinta da semana seguinte. Carimbar o primeiro como cumprido faz o
espelho andar para o segundo (CORRETO: é o estágio 1 de `agenda_campo_espelhar`,
U78:851-902). Isso muda `chamados.data_hora_agendada`, o que acorda
`trg_chamado_apoio_dupla_upd` (U76:1129-1131), que vê `v_mudou_semana = true` e
chama `chamado_sincronizar_apoio` — que APAGA as linhas `origem='dupla'` da turma
que JÁ FOI (U76:1030-1033) e grava a turma da semana nova.

**Marcar a visita como feita apagava o registro de quem a fez.** E de forma
completamente muda: o sino é `AFTER INSERT` (u7:502-503),
`trg_chamado_evento_upd` é `OF status, responsavel_id, sprint` e a tabela não tem
`updated_at`. Nada gerava sino, linha de tempo ou rastro. Na variante pior —
responsável sem turma na semana nova, ou `responsavel_id` nulo — `v_alvo` vinha
vazio, `NOT (profile_id = ANY('{}'))` era TRUE para todo mundo, e o DELETE varria
TODAS as linhas `'dupla'` do chamado.

### As duas saídas, e por que a barata venceu

A U78 já tinha nomeado as duas: **congelar** (o apoio do chamado para de ser
reescrito quando existe bloco cumprido) e **pendurar no bloco** (cada bloco
guarda quem foi nele, que é o que permite contar por visita). A segunda responde
a frase do Davi literalmente. Escolhi a primeira, e o argumento não é custo.

**O argumento é que pendurar no bloco constrói a máquina de contar em cima de um
sensor que ela mesma prova quebrado.** Um apoio pendurado no bloco ainda precisa
de alguém que AFIRME que a visita aconteceu. A U78:1566-1568 diz que duas mãos
preencheriam `cumprido_em` — a RPC e `executarChamado` no app, "que ao iniciar o
atendimento marca os blocos abertos até hoje". **Fui conferir: a segunda mão não
existe.** `executarChamado` (`src/features/chamados/data.ts:281-293`) escreve só
`status` e carimbos em `chamados`; um grep por `cumprido_em` em `src/` devolve
leituras e UMA escrita, `useCumprirBloco`, a partir de um botão. E a U80 já
mediu o rombo: a conferência 112 conta blocos pendentes com dia passado há mais
de 7 dias — aconteceu, ninguém marcou feito.

Sem esse carimbo, apoio-por-bloco conta INTENÇÕES AGENDADAS, não visitas. Um
ranking de "visitas por técnico" construído assim subcontaria justamente o
técnico que não clica, e publicá-lo puniria omissão administrativa com aparência
de improdutividade — destruindo a disciplina do carimbo, que é o pré-requisito
das DUAS saídas. A ordem certa é: **(1) parar de apagar; (2) construir a segunda
mão do carimbo; (3) só então a cardinalidade por visita.** Está escrito como
portão de sequenciamento: a conferência 110 da U81 repete a 112 da U80, e
enquanto esse número não estiver perto de zero não se constrói tabela nova. A
próxima entrega desta linha não é a tabela — é a segunda mão do carimbo.

**A "opção 1-forte" que eu também recusei**, e ela é sedutora porque cabe em 12
linhas: proteger por RE-DERIVAÇÃO, um `NOT EXISTS` contra
`escala_da_semana(referencia_semanal(bloco.dia))` dentro do próprio DELETE. Sem
tabela, sem coluna, sem backfill. Recusada por um motivo só, e ele é fatal:
`escala_definir` (U76:601-663) **não recusa semana passada**, e
`escala_semana_vigente` é `max(semana) <= W` (U76:415-420) — logo abrir uma
semana INTERMEDIÁRIA também muda a resposta de W. O conjunto protegido mudaria
retroativamente: reescrever a S36 hoje faria alguém deixar de estar protegido
amanhã, e a próxima sincronização o apagaria. Um congelamento que descongela
sozinho. E derivar "quem foi" da escala é literalmente o que a U64 proibiu em
prosa (:11-26) e o que o CLAUDE.md chama de invariante não-regressível.

### Congelar por MARCA e não por GUARDA — é o coração do desenho

A saída óbvia ("não rode `sincronizar` quando existir bloco cumprido") é
*stateless*: ela re-deriva a decisão a cada chamada, e o botão **"Tirar o
feito"** (`agenda_campo_cumprir(id, false)`) a desfaz com um clique — a história
volta a ser apagável. A MARCA é monotônica: `congelado_em` só vai de NULL para
um instante, e nada da máquina o devolve, inclusive tirar o "feito". É o que
"registro é registro" quer dizer em DDL, e o verificador prova por **censo**
(tudo que a migration faz com a palavra `congelado_em`, derivado do arquivo,
contra uma lista escrita à mão) que `= NULL` não aparece em lugar nenhum.

E porque a proteção é propriedade da **linha** e não guarda no **caminho**, ela
vale igualmente para os dois chamadores — inclusive para
`reconciliar_apoios_abertos`, que chama a função DIRETO e pula o gatilho (o
problema exato que obrigou a U78 a duplicar a guarda em §7.1 e §7.2). A
ferramenta manual do Davi não foi tocada e ficou **estritamente mais segura**:
reconcilia a parte viva e não alcança mais a parte histórica.

**BEFORE, e não é estética.** Na mesma linha de `agenda_campo`, `cumprido_em`
acorda também `trg_agenda_campo_espelho_upd` (AFTER), que move o espelho, que
acorda o gatilho do apoio, que chama o DELETE. Se o congelamento fosse AFTER,
quem chega primeiro seria decidido pela ORDEM ALFABÉTICA DO NOME do gatilho — e
um rename futuro reabriria o defeito em silêncio, sem uma linha de diff que o
denuncie. Todo BEFORE de linha roda antes de todo AFTER de linha: estrutura, não
convenção. E os vizinhos BEFORE são inertes: `trg_agenda_campo_valida` é
`OF chamado_id, dia, inicio_min` e não acorda num UPDATE de `cumprido_em`.

### O que a entrega custa em superfície: quase nada, e é o ponto

Uma coluna anulável, um gatilho, **uma linha** no DELETE. Zero policy, zero
GRANT, zero INSERT, zero DELETE, zero sino novo. `congelado_em` nasce
inescrevível pelo cliente **sem uma linha minha**: a S3 revogou INSERT da tabela
e devolveu POR COLUNA, e coluna nova não entra em grant por coluna; UPDATE nunca
existiu ali. As conferências 102 e 103 provam isso pelo catálogo em vez de
afirmar. As seis funções/policies de autorização que leem apoio
(`pode_editar_chamado`, `pode_acessar_chamado`, `chamados_select`,
`pode_ver_cliente`, `pode_ver_prospeccao`, `chamado_compra_select`) não mudam uma
vírgula — é a diferença mais cara entre congelar e pendurar no bloco, onde cada
uma delas ganharia um salto a mais em caminho quente de RLS avaliado por linha.

**A conta dos sinos é invariante, e isso é demonstrável em vez de medido.**
Dentro de `chamado_sincronizar_apoio`, o DELETE remove linhas com
`profile_id` fora de `v_alvo` e o INSERT tenta inserir exatamente `v_alvo` com
`ON CONFLICT DO NOTHING`: os dois conjuntos são disjuntos por construção.
Estreitar o DELETE não pode mudar o `ROW_COUNT` do INSERT, e o sino é
`AFTER INSERT FOR EACH ROW`. O único sino que muda é de VERDADE: hoje o parceiro
da quinta recebe "Você entrou como apoio" enquanto quem foi na terça acaba de ser
apagado.

### A propriedade que ninguém tinha reivindicado

`congelado_em` é gravado com `now()`, que no Postgres é o timestamp da
**transação**. Cada carimbo de "feito" é uma transação. Logo as linhas congeladas
na ida de terça carregam um instante e as da quinta carregam outro, e agrupar por
esse valor devolve **as turmas em ordem de ida** — de graça, com uma coluna. É o
`idasDoApoio` do modelo puro. Não é a resposta completa (a PK
`(chamado_id, profile_id)` continua colapsando quem foi nas duas idas na
primeira, e o valor não diz de QUAL bloco), e o JSDoc diz as três coisas que ela
não sabe. Mas é per-visita legível na tela sem construir nada.

### O que me recusei a inventar no backfill

O backfill é um `UPDATE` de uma coluna que acabou de nascer: zero INSERT, zero
DELETE, zero `DISABLE TRIGGER` (não há gatilho a desligar — o sino é de INSERT, e
um DISABLE ali seria teatro; gatilho desligado que alguém esquece de religar é
cicatriz conhecida da casa). A prova de que nada sumiu é mais forte do que
"copiou e a contagem bate": **não houve cópia**, e a conferência 105 mostra
total/dupla/manual contra a foto do §1.

Seis recusas, escritas por extenso na migration. A mais importante:
**reconstruir a turma que o defeito já apagou.** Para os chamados que já
sofreram, as linhas não existem — o DELETE não deixou sino, evento nem
`updated_at`. Derivá-las de `escala_da_semana` seria inventar, porque
`escala_definir` não recusa semana passada: a composição de hoje pode não ser a
que vigorava quando o apoio foi escrito. Não escrevo uma linha. Elas ficam
perdidas, e a conferência 109 conta onde isso pode ter acontecido, para o Davi
olhar com olho humano. As outras cinco: não congelar chamado sem bloco cumprido;
não congelar `origem='manual'`; não congelar quando a semana do espelho não casa
com a de nenhum bloco cumprido; não tratar o conjunto da conferência 112 da U80
("provavelmente aconteceu") como se fosse "aconteceu"; e não usar
`agenda_campo.criado_por` como "quem foi" — é quem arrastou o cartão, e o portão
deixa gestor puro passar, tipicamente o SAC, que não esteve no prédio.

### O preço, dito na frente: o registro CONCEDE ACESSO (R108)

Linha `origem='dupla'` concede `pode_editar_chamado` e `pode_acessar_chamado`
pela terceira perna da S2. Congelar significa que, num chamado de bloco ÚNICO já
cumprido, **trocar o responsável passa a ACUMULAR**: as duas turmas ficam com
acesso ao chamado, ao cliente, ao local, às fotos, ao checklist e ao pedido de
compra. A promessa da U76 ("apoio segue o responsável") continua inteira no que
ela prometia — a turma nova É atribuída —, mas o descarte da antiga era efeito
colateral, e o efeito colateral acaba aqui. A troca é deliberada: **prefiro
guardar um registro a mais a apagar o registro de quem esteve no prédio.** A
saída é humana e o X do chip fica aberto — não há GRANT de UPDATE nesta tabela,
então corrigir é remover e pôr outro, e fechar o X seria trancar a porta com o
erro dentro.

E os outros dois piores casos, em `PENDENCIAS_TECNICAS.md`: (1) a visita que
ninguém carimba não congela nunca, e para ela o defeito continua 100% vivo — a
proteção pende de um clique opcional, e se o número da conferência 110 crescer a
U81 é decoração; (2) congelo o que estiver lá, inclusive um palpite de escala
HERDADA (o buraco que a U76 §8.4 descreve), e o promovo a registro
permanentemente. Considerei recusar o congelamento quando a escala da semana é
herdada, e recusei a recusa: sem congelar, as linhas ficam desprotegidas e são
apagadas — troca de um problema pelo problema original.

### A asserção que ficou VERDE MENTINDO

`verificar-logica.cjs:8139` prendia o `window.confirm` que a U78 pôs na tela
antes de carimbar "feito", e o nome dela dizia "…e apaga quem JÁ FOI". A
estrutura sobreviveu inteira à U81, então a asserção **continuaria passando** —
carimbando como verdadeira uma afirmação que a entrega acabou de tornar falsa.
Asserção verde mentindo é pior que asserção vermelha: a segunda alguém conserta.
Foi reescrita para prender três coisas: a estrutura (o motivo de perguntar
continua existindo — a data anda), o TEXTO NOVO, e a **trava no banco** que torna
o texto novo verdadeiro. Trocar uma promessa por outra só vale se a asserção
provar a promessa nova onde ela mora de verdade, que é o SQL.

A asserção `:7341` (a U78 declarando "o apoio pendurar no BLOCO e não no
chamado") continua verde e **correta**: ela lê o arquivo da U78, que não foi
editado — migration que já rodou não se edita. A declaração da U78 continua sendo
a descrição fiel do que a U78 fez. E `:2400-2401` (o campo "Apoio" na grade de 3
colunas do PainelChamado) também continua verde: o chip mudou de forma por
dentro, o `<AvatarCirculo id={id} nome={nomeDe(id)}` que ela prende continua lá.

### O que a verificação pegou

**19 mutações aplicadas, 19 vermelhas.** Duas delas merecem registro:

1. **Uma mutação foi ABORTADA por não atingir o alvo** — apagar o
   `ON CONFLICT DO NOTHING` casava DUAS vezes no arquivo, porque o DESFAZER
   comentado repete o corpo inteiro. Refeita com âncora de duas linhas sem o
   `--`, ficou vermelha. É a quarta vez nesta semana que a conferência de alvo
   evita um "sobrevivente" falso — e a primeira em que a causa foi o DESFAZER, e
   não um comentário de prosa.
2. **Uma mutação achou uma asserção MINHA passando VAZIA.** A checagem de ordem
   do DESFAZER comparava `indexOf(DROP COLUMN) > indexOf(CREATE OR REPLACE …)`, e
   a segunda string estava escrita `…(uuid)` onde o arquivo diz
   `…(_chamado uuid)`. `indexOf` devolvia -1, qualquer posição era maior que -1,
   e a asserção passava sem tocar em nada. Corrigida para provar que as DUAS
   posições existem antes de compará-las. **Comparar índices sem provar que os
   dois existem é o mesmo erro de checar presença quando o risco é deleção** — a
   regra 2 do método ganhou uma quinta variação.

A asserção crítica do corpo é um **DIFF** contra o corpo vivo da U76 recortado do
arquivo, com a única mudança esperada escrita à mão — porque quando uma migration
reescreve função de outra o risco é DELEÇÃO, e regex de presença não vê deleção.
As mutações que apagam a guarda de "não sei ≠ ninguém", o `ON CONFLICT` e o
filtro `origem='dupla'` confirmam que ele pega remoção. Há ainda dois **censos**:
os chamadores de `chamado_sincronizar_apoio`, derivados do diretório de
migrations contra uma lista escrita à mão (a U81 não pode virar um terceiro), e o
censo de monotonicidade acima.

Uma armadilha da própria casa quase mordeu de novo: a asserção "a U81 não desliga
gatilho nenhum" ficou vermelha na primeira execução porque o **cabeçalho da
migration FALA de `DISABLE TRIGGER`** para explicar por que não usa um. Grep acha
comentário — sexto falso positivo desta família no arquivo. O filtro de linhas
que começam com `--` virou parte da asserção.

### A rodada de refutação — três lentes, e o que ela derrubou

Três lentes independentes (perda de registro, regressão, produção+sintaxe) leram
o que estava construído. **Duas delas chegaram sozinhas ao mesmo GRAVE, por
caminhos diferentes** — e ele era estrutural, não cosmético.

**1) A trava fechava METADE do buraco.** O gatilho só congela quando a semana do
bloco carimbado bate com a semana do espelho. Carimbar o RETORNO antes da IDA
(nada ordena os carimbos; há um botão por bloco) produzia: o carimbo do retorno
não congela nada — certo, porque ali o apoio gravado ainda é o da ida, e congelar
carimbaria a turma errada; depois, o carimbo da ida congela a turma da ida e faz
o espelho pular para o retorno pelo estágio 2, o que faz `chamado_sincronizar_apoio`
gravar a turma DELE **viva**. E o gatilho nunca mais dispara para aquele bloco,
porque `cumprido_em` só transiciona de NULL uma vez. **A turma que esteve no
prédio na quinta ficava alcançável pelo DELETE para sempre — o defeito original
inteiro, dentro da entrega feita para fechá-lo.**

A correção é a **segunda metade da trava**, no INSERT: a linha nasce congelada
quando a semana para a qual está sendo escrita já tem visita afirmada. O instante
gravado é o `cumprido_em` DAQUELE bloco e não `now()`, porque no fluxo fora de
ordem as duas turmas são escritas na MESMA transação — com `now()` elas cairiam
no mesmo instante e colapsariam duas idas em uma, cegando `idasDoApoio`
justamente no caso que ela existe para descrever. Por simetria, o gatilho também
passou a gravar `NEW.cumprido_em` (hoje o mesmo valor, `u78:1614`, mas agora os
dois caminhos são demonstravelmente o mesmo instante).

**O DIFF pegou a mudança na hora**, e é o argumento a favor dele: a asserção
falhou vermelha no instante em que o corpo mudou, e a mudança esperada passou a
ser escrita à mão em DUAS partes. Presença nunca teria acusado nada.

**2) O app pedia uma coluna que o banco ainda não tem.** `useChamadoApoios`
nomeava `congelado_em` no `select` e fazia `throw` no erro. Push em `main`
publica na hora; a migration o Davi roda à mão, depois. Nessa janela o PostgREST
devolve 42703 para a consulta INTEIRA, e o `throw` apagaria a lista de apoio de
TODO chamado, derrubaria a perna de apoio do `podeEditar` em `DetalheInterno` e
dispararia um toast vermelho a cada abertura — por uma coluna que só pinta uma
borda. É a mesma lição da U76 ("código que leia a tabela nova não pode subir
antes"), por outro caminho.

A correção foi `select("*")`: vem o que existir, e o `?? null` do mapa lê a
ausência como "atual" — que é exatamente o que o banco sabe responder enquanto a
U81 não rodou. **Vale igual no sentido inverso**, e é por isso que ela é melhor
do que separar o commit: o DESFAZER derruba a coluna com o front publicado ainda
pedindo-a, e a mesma linha protege os dois lados. Separar o commit teria
protegido só esta subida.

### O que a refutação pediu e eu NÃO fiz

Uma lente pediu para filtrar as linhas congeladas fora do calendário e do "Meu
dia", com o argumento correto de que o atendimento tem UMA data e ela andou para
o retorno — quem foi na terça aparece na quinta. **Recusado**, porque o remédio é
pior que a doença: no caso COMUM (uma visita só), a linha também fica congelada e
a data do chamado é a do dia em que a pessoa foi. O filtro apagaria da tela de
histórico exatamente o registro que a U81 existe para guardar, para ganhar
precisão no caso raro. Fica declarado em R107 e some quando o apoio morar no
bloco. **Auditor propõe; quem decide mede a população dos dois lados.**

### O resto da rodada

- A conferência 109 era cega ao caso que dizia contar: `NOT EXISTS` por CHAMADO
  em vez de por SEMANA tirava da conta o chamado com a ida apagada e o retorno
  congelado — sobrava a população benigna. Passou a ser por semana.
- Três conferências novas: **115** mede o que a reconciliação não alcança mais
  (o preço do R108, medido em vez de afirmado); **116** dimensiona o P26 (quantos
  chamados foram congelados sobre escala HERDADA, isto é, palpite virando
  registro); **117** é a 110 sem os blocos de OS externa, que não têm apoio a
  proteger e embaçam o número que libera a próxima entrega.
- O cabeçalho afirmava que a reconciliação ficara "ESTRITAMENTE MAIS SEGURA".
  **Era falso na população para a qual ela foi construída** — ela passa a
  acrescentar sem remover e devolve "corrigido" assim mesmo. A afirmação virou a
  declaração do preço.
- A foto do §1 rodava ANTES do pré-voo e liam `chamado_apoios`/`notificacoes`:
  num banco sem esses pressupostos o Davi receberia o erro cru que o pré-voo
  existe para substituir. Foi para depois, e `notificacoes` entrou na lista.
- `especieDoApoio` ignorava `origem`, que o SQL declara ser parte do significado
  da coluna. Passou a lê-la: apoio manual nunca é "registro".
- O `confirm` do carimbo prometia "os dois times" chapado; a entrada da turma do
  retorno é condicional à escala existir. O texto passou a dizer isso — é o
  aviso que aparece no instante do gesto irreversível.
- `invalidar()` não invalidava `["chamado-apoios", id]`: o `confirm` prometia uma
  lista que a tela não recarregava.
- O DESFAZER não restaurava o `COMMENT` da função, deixando a única documentação
  viva dela descrevendo uma cláusula que não existiria mais.

2136 asserções, build ok, tsc em 83.

## U82 — A segunda mão do carimbo (R109/R110/R111 — Fase 1, Passo 1.5)

### O defeito que esta entrega fecha

A U78 escreveu, na linha 1566-1568 do próprio arquivo, que `cumprido_em` teria
**duas mãos**: o clique no cartão da grade e *"`executarChamado` no app, que ao
iniciar o atendimento marca os blocos abertos até hoje"*. **A segunda nunca foi
construída.** Conferido no fonte, não na memória: `executarChamado`
(`src/features/chamados/data.ts:281-293`) escreve `status`, `finalizada_em`,
`concluida_em` e `fechada_em` em `chamados`, e nada mais; a **única** escrita de
`cumprido_em` no `src/` inteiro era o botão de `FormularioDoBloco.tsx:633`.

Consequência: toda a proteção da U81 — o registro de quem esteve no prédio —
pendia de **um clique opcional, de uma mão só**. O atendimento que aconteceu e
ninguém carimbou continuava desprotegido, e o P25 registrou isso como ALTO.

E a decisão do Davi (04/09) expôs um segundo defeito, este **vivo**: *"posso
acabar fazendo algo antes da data agendada por diversos motivos e o sistema não
deve barrar isso"*. Marcar hoje um bloco de dia FUTURO deixava o bloco **preso**
e gravava um dia **falso** — imóvel (`modelo.ts`, `erroDeMover`), não
desmarcável (`u78:1522-1525`), ocupando a janela futura da equipe para sempre (o
`EXCLUDE` é `WHERE (cancelado_em IS NULL)`, sem `cumprido_em` — `u78:653-664`) e
fazendo o congelamento da U81 comparar a **semana errada** (`u81:330-333`).

### O teorema que decidiu o desenho

A saída óbvia era um gatilho no encerramento. **Ela é mecanicamente impossível
de fazer com honestidade**, e a prova não é de gosto:

- Em **BEFORE**, `agenda_campo_espelhar` leria o status ANTIGO, passaria no gate
  de `u78:895` e emitiria `UPDATE public.chamados` **na própria linha em
  atualização** → `09000 triggered_data_change_violation`, e **intermitente**:
  um bloco passa, dois estouram.
- Em **AFTER**, o status já é terminal: o espelho casa **zero linhas**,
  `data_hora_agendada` congela no primeiro pendente, o gate de semana da U81
  (`u81:330-333`) devolve cedo para todo bloco de outra semana ISO, e
  `chamado_apoio_da_dupla` volta cedo em encerrado sem troca de dono
  (`u78:1825`). **Afirmar N visitas por gatilho grava UMA turma e perde as
  demais** — o defeito que a U81 existe para fechar, renascendo dentro da
  correção.
- E `dia` é impossível nos dois: pôr `dia` no SET acorda
  `trg_agenda_campo_valida` (`u78:786`), que num chamado já encerrado devolve
  `42501` a quem não é gestor (`u78:774-776`). **O técnico deixaria de conseguir
  concluir o próprio chamado.**

Logo: **a afirmação tem de morar antes do status, e antes do status só o app
chega.** O simétrico também é verdade: o app nunca alcança todos os caminhos —
`decidir_pedido_compra` (`u9:139-151`) e `sincronizar_chamado_da_visita`
(`u38:68-86`) escrevem status sem passar por uma linha de TypeScript.

### A divisão, que é o desenho inteiro

Não é "os dois afirmam". É **dividir por aquilo que cada lado pode dizer sem
mentir**:

- **O APP AFIRMA** (`agenda_campo_afirmar`, §2). É o único lugar onde há um
  humano, o dia é corrigível e o espelho anda semana a semana. Ela é chamada com
  o chamado **ainda aberto**, nos três encerramentos do `DetalheCampo` e no topo
  do `disparar()` do `PainelDoCiclo`.
- **O GATILHO NÃO AFIRMA NADA — ELE SÓ SOLTA** (`chamado_solta_agenda`, §3). No
  encerramento, desmarca o que ainda era **plano futuro** (`dia > hoje`, e tudo
  no cancelamento). Não precisa de evidência porque não afirma nada.

**Por que a costura não é um terceiro modo de falhar — três provas:**

1. **Os conjuntos são disjuntos por construção.** Os dois escritores filtram
   `cancelado_em IS NULL AND cumprido_em IS NULL`. O que o humano afirmou já tem
   `cumprido_em` e o gatilho pula; o que ele desmarcou já tem `cancelado_em` e o
   gatilho pula. Não há corrida, não há sobrescrita, e **não há ordem a provar
   entre eles**.
2. **O gatilho nunca contradiz o humano.** Ele só age sobre bloco sem resposta, e
   a única coisa que escreve ("este plano não vai acontecer") é mais fraca do que
   qualquer afirmação.
3. **Toda escrita do gatilho é REVERSÍVEL** (`agenda_campo_marcar` ressuscita
   bloco desmarcado, `u78:1399`), e toda escrita irreversível passa por mão
   humana ou pelo backfill medido. `congelado_em` não volta (`u81:293-297`).
   Pôr a irreversibilidade só do lado do humano é a propriedade que nenhum dos
   dois desenhos sozinhos tem.

**Bônus que só o híbrido ganha:** a pergunta "um gatilho `SECURITY DEFINER` abre
porta?" **evapora**. Um gatilho que não afirma não concede nada, e o caminho de
gate mais fraco (`decidir_pedido_compra` → `pode_acessar_chamado`, que é
`pode_editar_chamado` **OR `responsavel_id IS NULL`**, `s2:159-162`) deixa de
importar.

### As decisões, uma a uma

| Pergunta | Decisão | Razão |
|---|---|---|
| Feito **antes** do dia marcado | O bloco **vem para hoje** e é carimbado, no mesmo UPDATE. Padrão da tela: mover. | O dia marcado é **provadamente falso**. Deixá-lo trava a janela futura no `EXCLUDE`, imobiliza o bloco, o torna não-desmarcável e faz o congelamento escolher a semana errada. Só passa porque o chamado ainda está ABERTO na hora da chamada. |
| Feito **depois** (atrasado) | O bloco **fica onde está**. | Assimetria justificada: um dia passado é **possível** — nada foi provado falso, e o plano é a melhor prova que existe. Mover destruiria um dia plausível para escrever "hoje", que é seguramente errado. |
| Colisão do `EXCLUDE` ao mover | Ensaio geral (todas as colisões antes de qualquer escrita) → `23P01` com a frase que **nomeia** o conflitante. Nada escrito, chamado **não** encerrado, as duas saídas no mesmo painel. | O `EXCLUDE` não é política: a mesma equipe não esteve em dois prédios ao mesmo tempo. Mas conflito de agenda não pode barrar um encerramento — por isso a afirmação vem **antes**. |
| Jornada ao mover para hoje | **Não é checada.** | Jornada é política de **planejamento** (`u78:600-604`). O dia em que a equipe trabalhou 9h trabalhou 9h; a ocupação passa de 100% e é honesto. |
| Bloco de **hoje** mais tarde, chamado concluído às 10h | Tratamento idêntico: a pessoa é perguntada. Sem resposta, o gatilho **não** desmarca e **não** afirma. | Nem "aconteceu" nem "não vai acontecer" é derivável. O único ato honesto da máquina é **não decidir**. |
| Cancelamento do chamado | Desmarca **todos** os pendentes, de qualquer dia. Afirma **zero**. | Cancelar diz que o trabalho não será feito; não diz nada sobre visita alguma. Quem foi e depois o chamado caiu afirma **antes**, na mesma tela. |
| Reabertura | **Não desfaz nada — e também não conserta o espelho.** | Coerente com a U81: desafirmar não desacontece. Assimetria **declarada** com `chamado_preencher` (`u7:328-330`), que limpa `concluida_em`/`fechada_em`: os carimbos do chamado são derivados do status e re-deriváveis; uma visita é um evento no mundo. E o bloco desmarcado **ressuscita** por `agenda_campo_marcar`, que de quebra recalcula o espelho pelo caminho normal. O ramo que consertava o espelho aqui dentro foi retirado — ver "o que a TERCEIRA rodada achou". |
| Backfill | **ADIADO. A U82 é só o caminho vivo.** | Ver abaixo. |

### O BACKFILL FOI CORTADO — e o corte é a entrega

A U82 tinha, até a última rodada, um **§4** com três passadas (afirmar o passado
dos concluídos com laudo, soltar o plano dos encerrados, destravar os blocos
presos) e **dois `ALTER TABLE ... DISABLE TRIGGER`**. Saiu inteiro: a migration
foi de **951 para 847 linhas** e deixou de escrever **uma única linha de dado** —
ela cria duas funções e um gatilho, e mais nada.

**As duas razões, e nenhuma delas é sobre a qualidade da ideia:**

1. **É onde moravam TODOS os defeitos.** Três rodadas de refutação acharam quatro
   FATAIS. Os quatro estavam no §4 ou no ramo de reabertura que uma rodada
   acrescentou ao §3. O caminho vivo — a porta e o soltador — passou limpo nas
   três rodadas, nas duas primeiras e na de produção.
2. **Ele não tinha NÚMERO.** As conferências da U81 foram pedidas e não vieram.
   Escrever uma carga contra `public.chamados` e `public.chamado_apoios` — as
   duas tabelas mais quentes do sistema — sem saber quantas linhas ela alcança é
   escrever às cegas. **Medir antes de escrever é o método da casa**, e é o que
   esta entrega resolveu não abrir exceção para si mesma.

**A medição virou arquivo:** `supabase/migrations/_medir_antes_da_carga_u82.sql`.
Seis SELECTs, **leitura pura**, que rodam a qualquer hora. Ele carrega os cortes
que a refutação achou (o corte de evidência, e o corte de atribuição **duplo**),
para a carga futura não os reescrever pior. A dívida está no **P40**.

**O `DISABLE TRIGGER` foi RECUSADO, e a recusa está escrita no cabeçalho** para
a carga futura não a re-litigar. Duas razões independentes:

- **A cicatriz.** A U81 declarou por escrito que "gatilho desligado que alguém
  esquece de religar" é padrão ruim da casa (U59/U61). Note a circularidade que
  isso criava: a conferência 128 existia para provar que os dois voltaram
  ligados — uma conferência inteira dedicada a um risco que o próprio arquivo
  tinha acabado de criar. Cortado o DISABLE, a 128 virou **censo**: se um deles
  vier desligado, alguém esqueceu, aqui ou em outra carga.
- **A escalada de lock.** `DISABLE TRIGGER` pede `ShareRowExclusive`. As duas
  primeiras passadas já tinham feito a transação segurar `RowExclusive` sobre
  `public.chamados` (a cascata do espelho abre a relação para `UPDATE` mesmo
  casando zero linhas), e o `ALTER` estava na linha 727 de 951. Pedir o modo mais
  forte **depois** é escalada de lock: risco de deadlock, com toda escrita de
  chamado do app pendurada atrás — e a migration morrendo no meio, depois de
  duas passadas feitas, com um erro que não explica nada.

**O que a carga futura já sabe, e não precisa redescobrir:** o corte de evidência
(`diagnostico` **E** `servico_executado`, que `executarChamado` e
`concluir_chamado_com_cobranca` exigem e o arrasto do quadro não); a recusa de
`finalizada_em` como corte (só `executarChamado` a escreve); e que o corte de
atribuição precisa das **duas** cláusulas — "há um único pendente?" **e** "o
laudo ainda não tem dono?", porque ida carimbada à mão + retorno pendente dá um
pendente e afirmar o retorno é promover "provavelmente" a "aconteceu", em massa
e congelando (R108).

### O que a verificação pegou

- **Três censos vivos acusaram sozinhos**, e é para isso que eles existem: o das
  três listas de portas (a quinta porta nasceu), o dos exports do modelo puro
  sem consumidor, e o das funções que escrevem na linha do tempo (o soltador é a
  sexta). Nenhum foi escrito nesta entrega — os três já estavam lá.
- O censo das portas cobrava do arquivo da **U78** um GRANT que nasce na **U82**.
  A saída não foi afrouxar: a lista das quatro portas da U78 virou constante à
  mão **pinada** à do modelo puro (`PORTAS_DA_U78 ∪ {agenda_campo_afirmar} ===
  PORTAS_DA_AGENDA`), e o lado "GRANT" do censo passou a ler os **dois**
  arquivos. Uma porta nova que ninguém conceder continua caindo ali.
- A asserção da U81 que dizia *"a segunda mão do carimbo continua NÃO
  existindo"* passou a dizer outra coisa: `chamados/data.ts` continua sem tocar
  em bloco — **por mérito**, porque a segunda mão nasceu em `programacao/`.
- O `window.confirm` do detector de seção **casou o comentário** que explica por
  que a seção não usa um. Sexto falso positivo da mesma família; o filtro de
  linhas `//` foi de volta.
- A asserção de `clock_timestamp()` contava ocorrências **no arquivo**, onde o
  `COMMENT` também cita a função — uma âncora que casa comentário é um
  sobrevivente falso esperando acontecer. Passou a contar no **corpo vivo**, e a
  exigir exatamente 1 atribuição e 2 usos (os dois ramos do laço).
- Doze mutações rodadas (seis no SQL, seis no TypeScript): pôr `cumprido_em` no
  SET do soltador, trocar `AFTER` por `BEFORE`, apagar o `ORDER BY` do laço,
  trocar `clock_timestamp()` por `now()`, desligar a guarda da transição com
  `IF false`, apagar o texto da conferência 121; e do outro lado marcar o
  passado como `diaFalso`, soltar o bloco de HOJE no encerramento, fazer a
  resposta nascer marcada, ler o fuso do navegador, pôr a afirmação DEPOIS do
  `executarChamado` e desligar a antecipação do 42501. **As doze foram pegas.**

### O que a TERCEIRA rodada achou, e a lição que ficou

A segunda rodada de refutação consertou os MENORES da primeira **acrescentando
mecanismo** — e um desses acréscimos virou o FATAL da terceira. Vale escrever a
lição antes dos achados, porque ela é a parte reaproveitável:

> **PREFIRA APAGAR A ACRESCENTAR.** Um MENOR que só se conserta com maquinaria
> nova é uma **dívida**, não um conserto.

**O ramo de REABERTURA (FATAL).** Para consertar o espelho podre depois de
reabrir (um MENOR, e um MENOR de um defeito **pré-existente**), a rodada anterior
pôs um `PERFORM agenda_campo_espelhar(NEW.id)` no soltador. Aquela função escreve
`chamados.data_hora_agendada`, coluna que está na lista `OF` de
`trg_chamado_apoio_dupla_upd` (`u76:1129`). Com o chamado já reaberto o status
não é mais terminal, `chamado_apoio_da_dupla` não volta cedo (`u78:1825`), e se a
semana mudar roda `chamado_sincronizar_apoio`: **DELETE** das linhas
`origem='dupla'` vivas (a lista inteira quando `responsavel_id` é NULL), **INSERT
da turma nova JÁ CONGELADA** (a semana do espelho novo é a da última visita
afirmada, então `max(cumprido_em)` não é NULL) e **um sino por linha**. O gatilho
que o cabeçalho jura que "não afirma nada" passava a congelar, apagar e tocar
sino — por efeito colateral de um clique em "Reabrir", e nada disso é reversível.
**Retirado.** O espelho podre é P35, pré-existente, e a saída (rearrastar o bloco
na grade) já existe. De quebra, isso devolve a verdade à frase "conjuntos
DISJUNTOS" que justifica a indiferença de ordem entre os gatilhos.

**A conferência 121 era CEGA a isso**, e a cegueira é de família: ela media
`prosrc !~ 'cumprido_em\s*='`, e a escrita não estava no **texto** da função —
estava no **NOME que ela chamava**. Ganhou o termo que faltava: *o soltador não
delega escrita a ninguém*, medido como "não tem `PERFORM`".

**A PRÉ-TRAVA foi ESTREITADA e depois APAGADA (GRAVE, duas rodadas).** Na
primeira versão ela congelava sempre que a semana do dia ATUAL casava a do
espelho — e esse dia é justamente o que o gesto está movendo **porque ele é
provadamente falso**: congelava a turma da semana do plano como "esteve no
prédio", irreversível, e congelava **de graça** em chamado terminal, onde não
existe DELETE a barrar. Estreitada para "chamado não terminal E sem
responsável", a rodada seguinte mostrou que ela tinha sido **estreitada pelo lado
errado**: `v_alvo` fica vazio por dois caminhos, e esse é o quase morto — tirar o
responsável já dispara o sincronizar e já apaga as linhas naquele instante. O
caminho comum é responsável presente com turma vazia na semana, e cobri-lo
exigiria saber **em que semana o espelho vai repousar**, o que a pré-trava não
pode saber: ela roda ANTES do movimento, e com outro bloco pendente o espelho vai
para o próximo pendente, não para o dia efetivo. Acertar o predicado seria
reconstruir `agenda_campo_espelhar` dentro da porta — a maquinaria pela qual o
ramo de reabertura tinha acabado de ser cortado.

Foi apagada, e o resíduo está no **P41**. O argumento que decide: **não é
regressão** — o caminho de dois passos da grade (arrastar, depois carimbar)
sempre teve o mesmo comportamento, porque o arrasto move o espelho igual. A U82
não piora nada; ela só não conserta isto. **Mecanismo cuja condição de disparo
ninguém consegue avaliar no instante em que ela roda é pior do que a ausência
dele**, e a ausência agora está presa por asserção para não voltar sem que
alguém releia o argumento.

**MOVER E CARIMBAR VIRARAM DOIS STATEMENTS (GRAVE, e é o achado mais importante
das três rodadas).** Num `UPDATE` só (`SET dia = …, cumprido_em = …`) o bloco
deixa de ser pendente **no mesmo instante** em que muda de dia: quando o AFTER do
espelho roda, o estágio 1 já não o vê e salta para o próximo pendente. O espelho
**nunca repousa na semana em que a visita foi afirmada** — e como a turma de
apoio só é escrita quando o espelho repousa numa semana, a turma de quem esteve
no prédio não era escrita por caminho nenhum. Na variante de semanas diferentes
era pior: a turma antiga era **apagada** e substituída por quem ainda não foi.
Separando os dois `UPDATE`, o espelho passa pela semana nova com o bloco ainda
pendente (o sincronizar grava a turma certa) e só então o carimbo acorda o BEFORE
da U81, que a congela. É exatamente o que o caminho de dois passos sempre fez, e
que a porta atômica tinha perdido ao fazer tudo de uma vez. **A correção é uma
divisão de statement — nenhuma maquinaria nova.**

E a asserção que guardava isso tinha um fixture que **escapava por acaso** (os
dois blocos caíam na mesma semana ISO), afirmando como provado exatamente o que o
código não fazia. É a regra 2 outra vez, na variante mais traiçoeira: o teste
passa pelo motivo errado.

**A guarda de dia era de um lado só (GRAVE).** Ela recusava `> v_hoje` e deixava
o **passado inteiro** aberto — e é no passado que moram as escalas antigas. Com
`dia` numa semana de um ano atrás, a turma daquela semana nasce **congelada** pelo
INSERT de `u81:461-469` (a semana passou a ter visita afirmada): gente que nunca
esteve no prédio com acesso permanente. Agora a porta é o gêmeo literal de
`diaAfirmado` — **exatamente duas datas**, o dia do bloco ou HOJE.

**A cortesia derrubava o encerramento (GRAVE).** `PORTA_INEXISTENTE` era uma lista
de **exceções**: tudo o que não fosse PGRST202/42883 subia como `throw`, inclusive
queda de rede (o postgrest-js devolve `code: ''`). Cenário: técnico no prédio, 3G
ruim, assinatura **já gravada**, `executarChamado` nunca roda, chamado em
`em_andamento` e um toast dizendo "Failed to fetch". A lista virou **positiva**:
`RECUSAS_DA_PORTA = ["42501","55000","23P01"]` — só o que a porta **fala** tem
voto. Todo o resto degrada como `portaMuda` e o chamado encerra igual.

**O 23P01 aparecia sem as duas saídas (GRAVE).** As duas saídas moram **dentro**
de `ConfirmacaoDasVisitas`, ao lado dos botões que as executam, e só renderizam
com o prop `erro`. `PainelDoCiclo` não o passava: o gestor via a frase vermelha
com a saída desenhada quinze pixels acima e ninguém apontando.

**A recusa antecipada perdia o SQLSTATE (GRAVE).** `erroDaAfirmacao` devolvia só a
frase, e os três consumidores chutavam um código — `new Error` (código `null` →
rosto "desconhecido") ou `"42501"` fixo. A recusa de **natureza** é `55000` na
porta (regra: "dá para corrigir aqui"), e saía antecipada como permissão
("escudo: o gesto não vai acontecer"). A mesma frase, duas caras, conforme quem a
dissesse. Agora ela devolve `{ frase, code }`.

**A tela prometia o contrário da máquina no cancelamento (GRAVE).** A caixa de
perguntas é renderizada também no fluxo de **cancelar**, e dizia "o que ficar sem
resposta e já tiver dia passado continua pendente". No cancelamento é falso: o
soltador é `NEW.status = 'cancelado' OR a.dia > v_hoje` — **todo** pendente cai,
de qualquer dia. O gestor lia aquilo, deixava sem resposta, e o bloco de ontem
sumia do chip para sempre. **A assimetria (P39) não foi reaberta: corrigiu-se o
TEXTO**, que é onde estava o defeito.

### O que eu recusei

- **Afirmar por gatilho** — mecanicamente impossível de fazer com honestidade
  (o teorema acima).
- **Guarda de data em qualquer forma.** A data escolhe o padrão do dia; nunca
  nega um gesto. A conferência 122 lê isso do **catálogo** — e ela deixou de ser
  meia-tautologia: medir a ausência de `current_date` (uma expressão que esta
  função nunca usaria) não prova nada, então o terceiro termo mede a **forma
  real** que uma guarda teria aqui: uma comparação de ordem entre o dia de um
  bloco e o relógio.
- **`ALTER TABLE ... DISABLE TRIGGER`**, em qualquer carga — cicatriz da casa e
  escalada de lock. Se uma carga futura precisar impedir uma cascata, ela impede
  pelo **predicado**.
- **Consertar o espelho na reabertura** — o FATAL acima. Vira P35.
- **Construir maquinaria nova para fechar MENOR.** A regra desta rodada, e ela
  nasceu do estrago da anterior.
- **Corrigir a hora** — o DIA é o que a semana ISO, a ocupação e o espelho leem.
- **Checar jornada** na afirmação.
- **Backfillar chamado sem laudo** — o arrasto é ausência de gesto com outra
  roupa (medido na linha 5 de `_medir_antes_da_carga_u82.sql`).
- **Backfillar coisa nenhuma nesta entrega** — sem número, não se escreve carga.
- **Desafirmar na reabertura.**
- **Reconstruir as turmas das semanas que ninguém gravou** — exigiria mover o
  espelho de um chamado encerrado e chamar `chamado_sincronizar_apoio`, cujo
  DELETE reabriria o defeito da U81 dentro da correção.
- **Recalcular o espelho do encerrado** — vira P35.
- **Reescrever `agenda_campo_cumprir`.** O botão da grade continua sendo o que
  sempre foi; a correção de dia é da porta nova, onde há uma pergunta.

### A objeção que eu não sei responder bem

Os cinco caminhos que não perguntam continuam existindo, e o chip só funciona se
alguém abrir o chamado. **Se o lado ENCERRADO da conferência 130 não cair em três
semanas, este desenho falhou** — e a resposta seguinte não é voltar ao gatilho
que afirma (ele continua impossível), é **levar a pergunta ao arrasto do quadro e
ao seletor de status**, que é onde ela falta. A 130 é a primeira coisa a olhar
depois da migration.

### A ordem de execução (não é sugestão)

1. `node scripts/verificar-logica.cjs` → **0 falharam**.
2. `npx vite build`; `npx tsc --noEmit` → baseline **83**, sem erro novo.
3. **O Davi roda a U82 no SQL Editor.** Ela é curta e não escreve dado nenhum, e
   por isso a ordem ficou mais fácil do que era: a tabela de veredito tem de vir
   com **125 = `0 / 0`**, **126 = `0`**, **129 = `0`**, **133 = `0 total / 0
   dupla`** — os quatro dizem a mesma coisa por caminhos diferentes: esta
   migration criou funções e não tocou em dado. E **118-124 e 128** provam que a
   porta, o soltador e as cinco vizinhas estão como o arquivo diz.
4. **Só então o push.** Se o push vier antes, nada quebra: `PGRST202` degrada, o
   encerramento acontece igual e o toast diz a verdade — e agora **qualquer**
   falha da porta degrada assim, não só "ela não existe".
5. **Depois, e só depois:** rodar `supabase/migrations/_medir_antes_da_carga_u82.sql`
   (leitura pura, qualquer hora) e mandar os seis números. **A carga retroativa é
   escrita a partir deles**, como entrega separada (P40). A **linha 4** é a que
   decide o tamanho do problema.

2229 asserções, build ok, tsc em 83. Migration de 951 → 847 linhas.

## U83 — Vistoria é um tipo, e o domínio de tipos para de ser copiado (R112)

Davi, 02/09, escolhendo explicitamente entre alternativas: **o tipo novo se
chama `vistoria`, rótulo "Vistoria"**. É a atividade que o Vinicius tem na
programação dele e que não tinha lugar no vocabulário — ir ao cliente só para
olhar. Hoje ela cai em `corretiva` (o default de campo de `chamado_preencher`,
u7:296-297) ou em `operacional`, e some do relatório de manutenção como se
fosse conserto.

**O nome é metade da decisão.** "Visita técnica" JÁ SIGNIFICA a visita
comercial neste sistema — `visitas_tecnicas`, `/gerencial`, tipo `prospeccao`,
o trigger `sincronizar_chamado_da_visita`. Reusar as duas palavras seria a
quarta colisão de vocabulário do projeto e a pior: as outras três (equipe,
modalidade, bloco) moram em telas diferentes; estas duas dividiriam a MESMA
lista de tipos, no mesmo seletor. O verificador recusa qualquer rótulo de
`vistoria` que contenha a palavra "visita" — a decisão virou trava.

E uma armadilha confirmada, dita para o próximo leitor não repetir: o plano do
projeto dizia *"e então `vistoria` cobre"*, como se o tipo já existisse. **Não
existia.** Os tipos de campo eram quatro.

### A entrega não é o tipo. É a desduplicação que o tipo tornou necessária.

O censo do repositório encontrou o domínio "tipos de chamado de CAMPO" copiado
à mão em **quatro lugares fora de `chamado-status.ts`**, todos com
`as ChamadoTipo[]` — que desliga o compilador:

| Onde | O que era |
|---|---|
| `chamados.novo-campo.tsx:319` | `(["corretiva",…] as ChamadoTipo[]).map` — o seletor de abrir chamado |
| `chamados.painel.tsx:172` | `const tiposCampo: ChamadoTipo[] = […]` — as séries do gráfico |
| `chamados.painel.tsx:212` | outra cópia da mesma lista — as opções do filtro |
| `chamado-rapido.functions.ts:42` e `:68` | o union e o `enum` do schema da IA |

Acrescentar `vistoria` só em `tiposDaNatureza` **não alcançaria nenhum deles**.
O tipo novo ficaria invisível nas quatro telas, **sem um único erro** — e num
dos quatro o silêncio era pior que invisibilidade: o fallback de
`chamados.painel.tsx:187` joga em `"corretiva"` todo tipo que não esteja na
lista, então cada vistoria engordaria a barra vermelha do gráfico de
manutenções. Um número errado que ninguém tem como perceber olhando.

**O que o censo trouxe e o grep de `'corretiva'` não teria trazido:**
`chamados.painel.tsx:212` não era uma cópia, eram **três** — os quatro de
campo, e depois `melhoria` e `pedido_compra` colados um a um. E `TIPOS` era uma
**oitava** lista, escrita à mão em paralelo ao union, capaz de divergir dele em
silêncio; virou `Object.keys(TIPO_LABEL)`, que é `Record<ChamadoTipo, …>` e
portanto exaustivo por compilador.

### O desenho: RENDERIZAR e OFERECER passaram a ser duas listas

Até aqui eram a mesma coisa, e é por isso que a entrega precisava de dois
commits. `TIPOS_DA_NATUREZA` (novo, exportado) é o que o sistema sabe
**renderizar**; `tiposDaNatureza()` continua sendo o que ele **oferece**, e
agora é derivado: a mesma lista menos `NAO_OFERECIDOS`.

`NAO_OFERECIDOS` não é mecanismo novo — é o padrão que a U41 já tinha criado em
prosa para `pedido_compra` ("sai da SELEÇÃO, não do vocabulário"), agora escrito
como uma lista em vez de como um `if`. Ele tem duas entradas, e cada uma diz por
quê. **A segunda é a linha do commit B.**

### A ordem de deploy INVERTEU, e é a única razão de haver dois commits

Nos casos anteriores o perigo era o código LER coluna que ainda não existe — a
migration ia na frente. Aqui o código passaria a **ESCREVER um valor que o
CHECK ainda recusa (23514)** na janela entre o push (que a Lovable publica
sozinha) e a rodada da migration (que o Davi faz à mão). A janela tem o tamanho
do tempo dele.

- **COMMIT A (este):** a migration; o suporte a renderizar `vistoria`; a
  desduplicação inteira; `vistoria` em `TIPOS_DEMANDA_CAMPO` (filtro, não
  escrita); as asserções; os docs. **Nada que ofereça `vistoria` para escrita.**
- **COMMIT B (depois que o Davi rodar):** apagar **uma linha** — a entrada
  `"vistoria"` na lista `NAO_OFERECIDOS`, em `src/lib/chamado-status.ts`.

Apagar aquela linha liga, de uma vez: o seletor de novo chamado de campo, o
seletor de tipo do `PainelChamado`, o diálogo de nova atividade, o `enum` do
schema da IA **e a linha de descrição de vistoria no prompt dela**. Os cinco
derivam da mesma função. Fazer o prompt derivar do mesmo filtro
(`TIPO_IA_DESCRICAO` × `TIPOS_IA`) foi trabalho deliberado: sem ele o commit B
seriam duas edições, e "duas" é onde a segunda é esquecida.

A asserção que guarda isso é barulhenta de propósito — ela afirma
`[renderizável=true, oferecido em campo/interno/comercial=false]` e o texto dela
diz que o commit B tem de virá-la. Uma trava que some sozinha não é trava.

### As quatro perguntas de produto

**1. `vistoria` entra em `TIPOS_DEMANDA_CAMPO`? Sim.** Li o comentário antes de
decidir, e ele é o argumento: a lista é mais estreita que os tipos de campo
porque `operacional` "não é uma demanda que se PROGRAMA para uma dupla". O
critério nunca foi "é manutenção?" — foi "ocupa uma janela de uma equipe?". A
vistoria do Vinicius ocupa. É também o que a distingue de `operacional`:
operacional se encaixa entre duas coisas, a vistoria é o compromisso.

A lista passou a ser **derivada por exclusão** (`campo` menos `operacional`), e
essa escolha tem consequência dita por escrito: o padrão para um tipo de campo
novo passa a ser *"sim, é programável"*, e quem quiser a exceção seguinte tem
de nomeá-la. É o padrão certo — `operacional` é o caso raro.

E ela pode entrar **já no commit A** porque alimenta um `<option>` de filtro, o
que foi verificado e não suposto: o "+" da programação navega para
`/chamados/novo-campo` **sem levar `tipo` na busca** (há asserção sobre isso).
Se levasse, o filtro seria um caminho de escrita disfarçado.

**2. Que cor? `PRISMA.laranja`, e a escolha foi medida.** Semântica: a rampa de
`TIPO_CORES` vai do que se antecipa (amarelo) ao que quebrou (vermelho), e o
laranja é literalmente o passo entre os dois — que é o que uma vistoria é: ir
olhar porque **ainda não se sabe** se quebrou.

Sobraram três cores livres no PRISMA, e as três colidem em algum lugar; a
escolha foi por onde a colisão dói menos:

- `verde` é o "terminado com sucesso" da casa inteira (cobrança, compra,
  contratos, inventário, checklist). Um tipo verde ao lado de um status verde
  diria que o chamado acabou. Fora.
- `azul` é STATUS `aberto` **e** `agendado` **e** PRIORIDADE `normal` — ou seja,
  o **estado de repouso** de uma vistoria. Seriam três chips azuis em fila no
  caso mais comum. É o pior lugar possível para uma colisão. Fora.
- `laranja` é STATUS `stand_by` (esperar material não é o que trava uma
  vistoria) e PRIORIDADE `alta` (não é o padrão). Colide **fora** do repouso, e
  não dentro dele. Escolhido.

Há asserção nova de que nenhuma cor de `TIPO_CORES` se repete entre tipos.

**3. A IA passa a poder classificar como vistoria? Sim — mas só no commit B**, e
com a descrição pronta desde já. O risco real não é a IA usar o tipo novo; é ela
chutar entre as **três que mandam alguém ao prédio**. Então o corte está escrito
por nome, nos dois sentidos: *"se há defeito relatado esperando conserto, é
corretiva, não vistoria"* e *"se é roteiro de manutenção programada de um
sistema que já é nosso, é preventiva"*. `TIPO_IA_DESCRICAO` é
`Record<ChamadoTipo, string>`: um tipo novo no vocabulário não compila sem que
alguém diga à IA como reconhecê-lo.

**4. `vistoria` tem SLA/prazo diferente? NÃO, e está dito por escrito.** O prazo
do campo é calculado em `chamado_preencher` (u7:301-306, e o recálculo por
escalada de prioridade em u7:333-338) lendo `chamado_sla` — que é indexada por
**prioridade** e só por ela. O tipo não entra no cálculo em lugar nenhum. Uma
vistoria `normal` tem exatamente o mesmo prazo de uma corretiva `normal`, e essa
é a resposta certa: a vistoria não é mais nem menos urgente por ser vistoria, é
urgente pelo que a motivou. Há asserção que varre as migrations procurando
qualquer leitura de `chamado_sla` filtrada por `tipo` e exige lista vazia — "não
muda" virou algo que fica vermelho se um dia mudar.

### O que esta entrega NÃO faz, e por quê

**A palavra "vistoria" continua classificando como `preventiva`.** Ela é
palavra-chave de `sugerir_tipo_chamado` desde a U1 (u1:63) e do gêmeo em TS. Com
o R112 isso passou a ser uma resposta errada em português, e mesmo assim fica:

1. mexer no gêmeo TS é **escrita** — `importar-notion.ts:364` grava direto o que
   ele devolve, e devolver `vistoria` antes de a U83 rodar é o 23514 que o
   desenho de dois commits existe para evitar;
2. os dois lados precisam concordar palavra por palavra (convenção "trigger
   espelha função do app" do manual de banco) — mudam juntos ou não mudam;
3. **o estrago está medido e é pequeno:** `chamado_preencher` só consulta a
   função quando `natureza <> 'campo'`; no campo o default é `'corretiva'`,
   fixo. A vistoria do Vinicius é atividade de campo — nunca passa por ali. O
   que sobra é um chamado *interno* intitulado "vistoria" nascendo preventiva,
   como sempre nasceu.

Dívida declarada no próprio código, com as três razões e o caminho de saída
(regra 8: se só se conserta com maquinaria, declare). Duas asserções a prendem:
o comportamento atual, e o fato de nenhuma migration depois da U7 redefinir a
função — se alguém "consertar" um lado, o outro fica vermelho.

**`tipo_servico` não foi tocado, e isso é decisão.** `chamado_preencher` tem uma
**enumeração por exclusão** (`CASE WHEN tipo = 'implantacao' THEN 'instalacao'
ELSE 'manutencao'`), e ela alcança o tipo novo: uma vistoria nasce
`manutencao`. Está certo — `tipo_servico` tem dois valores e eles são as duas
seções do PDF de fechamento; vistoria não é obra. Um terceiro valor seria
maquinaria nova para um detalhe já resolvido. A asserção prende que continuam
sendo **dois**, para que um terceiro não apareça mudando a resposta em silêncio.

**Sem backfill.** Não existe critério: nada no banco distingue hoje uma vistoria
de uma corretiva mal classificada, e adivinhar por palavra do título
reescreveria histórico com um chute. A conferência 105 da migration conta
`tipo = 'vistoria'` e espera **zero** — é ao mesmo tempo a prova de que o commit
A não grava nada e o pré-voo do DESFAZER.

### A peça que fica: a asserção de CENSO

É a metade da entrega que sobrevive a ela. Uma varredura de todo `.ts`/`.tsx` de
`src/` atrás de **qualquer lista literal entre colchetes com dois ou mais tipos
de campo**, com `chamado-status.ts` como único endereço autorizado. Deriva do
arquivo; não afirma caso a caso os quatro que eu conheço.

As três cicatrizes que ela respeita: linhas de comentário são retiradas antes
(regra 2 — grep acha comentário, e isso já rendeu 5+ falsos positivos aqui); o
regex usa `[^\]]` para parar no primeiro `]`, senão atravessaria o arquivo e
juntaria dois tipos que nunca estiveram na mesma lista; e o corte é em **dois**
tipos, não um, porque `tipo === "corretiva"` é predicado legítimo
(reincidência, emergencial, KPI de corretiva urgente) e não enumeração.

Oito pares negativos, todos **constantes escritas à mão** (regra 4): a linha
exata que a U83 apagou, a forma anotada, a lista quebrada em várias linhas, o
`enum` de schema sem anotação nenhuma, e os quatro que ela **não** pode acusar —
o predicado de um tipo só, a lista de outro domínio que tem uma palavra em
comum, a cópia escrita dentro de um comentário, e o regex atravessando o `]`.

E o **censo do outro lado**: a última migration que reescreve
`chamados_tipo_check` (por timestamp, que é a ordem em que o Davi as roda) tem
de aceitar exatamente o union do TS mais `proposta_comercial`, que é legado da
U41. Um tipo acrescentado de um lado só é 23514 em produção, ou um valor que o
banco aceita e a tela não sabe pintar — nenhum compilador cruza esses dois
arquivos, e agora o verificador cruza.

### A migration

`20260906090000_u83_vistoria.sql` — DDL pura, uma constraint. Pré-voo que
**aborta** se o CHECK vivo não for o da U41 (os oito valores conferidos um a um:
reescrever por cima de uma versão que eu não li é apagar a correção de outra
pessoa sem que ninguém veja) e se existir alguma linha com tipo fora da lista
nova (o `ADD CONSTRAINT` valida a tabela inteira, e o 23514 dele aponta para a
constraint, não para a linha).

A conferência 101 não faz `LIKE '%vistoria%'`: ela extrai do catálogo **a lista
inteira** de literais e compara com a string esperada completa — presença do
valor novo não veria a remoção de um antigo (regra 2). A 106 confere
`convalidated`, porque uma constraint `NOT VALID` passaria por todas as outras
sem proteger uma linha sequer. A 107 confere que `chamado_sla` continua sem
coluna de tipo — a resposta "o SLA não muda" fica vermelha se um dia mudar.

### O que a rodada de refutação achou — e o defeito VIVO que ela desenterrou

**A conferência 101 diria `>>> OLHAR <<<` numa execução PERFEITA (GRAVE).** O
`string_agg(… ORDER BY …)` devolve os nove valores ordenados, e
`proposta_comercial` vem ANTES de `prospeccao` (divergem na quarta letra, e
`p` < `s`). A string esperada tinha as duas trocadas. É o pior modo de falhar,
porque ensina a ignorar a única coluna que o Davi lê. Pior: **a asserção do
verificador tinha copiado a mesma string errada** — ela comparava o arquivo
consigo mesmo e portanto CERTIFICAVA o defeito. Agora o SQL declara
`COLLATE "C"` e o verificador **deriva** a ordem com `sort()`, que é a mesma
regra: os dois lados param de coincidir por acaso.

**O pré-voo era cego a ADIÇÃO e se desligava na segunda rodada (GRAVE).** Eram
oito `position(…) = 0` dentro do `ELSE` de "já tem vistoria?". Só detectavam
REMOÇÃO — se uma migration futura acrescentasse um nono valor ao CHECK, o §3 o
APAGARIA em silêncio, e o próximo INSERT daquele tipo seria 23514 em produção.
E o guarda estava desligado exatamente na segunda rodada, que é onde esse caso é
mais provável. Virou comparação de CONJUNTO (`@>` pega remoção, `<@` pega
adição), fora de qualquer `ELSE`, com `v_vals IS NULL` explícito — sem ele
`NOT (NULL AND …)` é NULL e o guarda passaria MUDO, que é a mesma família do
`position(…) >= 0` que nunca é falso.

### O GÊMEO DO CLASSIFICADOR — dois meses de divergência, e a asserção que a mantinha verde

O censo do domínio de tipos desenterrou um defeito **vivo em produção desde a
R48**, e ele não é do escopo original desta entrega: é da mesma regra de
produto, "qual tipo o sistema escolhe quando ninguém escolhe".

`sugerir_tipo_chamado` existe em dois exemplares — o do banco (u6c:48, renomeado
por u7:282; o RENAME preserva o corpo) e o gêmeo TS. Os seis ramos eram
idênticos. A R48/U41 trocou o ramo de compra do lado do TS para `operacional`
**e o lado do banco ficou como estava — e é ele que grava.**

O caminho, do clique ao registro: chamado interno, a pessoa escreve "Comprar
cabo de rede" e não toca no seletor → a tela mostra **Operacional** → o app
grava `tipo = NULL` → `chamado_preencher` chama o gêmeo do banco → devolve
**`pedido_compra`** → o gatilho da U9 cria a ficha de compra. O registro nasce
com um tipo que a R48 aposentou, e com uma ficha vazia que a tela nem sabe
oferecer para preencher, porque o mini-formulário de compra depende do gêmeo TS
ter dito `pedido_compra` — e ele nunca mais diz.

**A asserção que devia pegar isso ficava verde, e ficava verde POR CAUSA do
defeito.** Ela media "nenhuma migration depois da U7 redefine
`sugerir_tipo_chamado`" — presença de definição, onde o risco é divergência de
resposta. Enquanto ninguém consertasse o lado atrasado, ela passava. É a regra 2
na forma mais cara até agora: não é que a asserção não viu o defeito, é que a
existência do defeito era a condição para ela passar.

A correção é uma linha no corpo do banco, e a prova mudou de natureza: a
conferência 110 da migration exercita os **seis ramos** contra o catálogo, o
verificador exercita os mesmos seis contra o gêmeo TS, e um **DIFF** exige que o
corpo novo seja o de u6c com exatamente uma mudança. Acordo de VALOR, dos dois
lados, em vez de presença de qualquer coisa.

A palavra `vistoria` **continua no ramo de `preventiva`** e isso é decisão: ela
está ali desde a u6c como palavra-chave ("vistoria de rotina" é preventiva), e o
tipo novo se ESCOLHE no seletor, não se adivinha por texto. Mover a palavra
faria todo chamado que a menciona mudar de tipo sozinho.

### O commit B (02/09) — a oferta ligada

A U83 rodou e o commit B saiu: **uma linha apagada** de `NAO_OFERECIDOS` em
`src/lib/chamado-status.ts`. Ela ligou, de uma vez, o seletor de chamado novo de
campo, o seletor de tipo do `PainelChamado`, o diálogo de nova atividade, o enum
do schema da IA e a linha de descrição dela no prompt — todos derivam da mesma
função, que é o que a desduplicação comprou.

**As quatro asserções que o commit A deixou armadas viraram**, e é isso que elas
existiam para fazer. A que dizia "vistoria é renderizável e NÃO é oferecida em
natureza nenhuma" passou a afirmar a forma final: oferecida em CAMPO e só lá.
A que verificava a presença da linha no gate virou um **par negativo** — se
alguém repuser `"vistoria"` naquela lista, o tipo some de todos os seletores sem
nenhum outro sinal, e agora isso fica vermelho.

O comentário que explicava o mecanismo **ficou no código**, sem o `vistoria`:
ele vale para o próximo tipo, e comentário que some junto com o uso é
conhecimento que se perde. A regra, em uma frase: *renderizar é aditivo e
inofensivo; oferecer é o que grava*. Migration e renderização sobem juntas; a
entrada em `NAO_OFERECIDOS` sai depois, sozinha, quando o CHECK já aceita o
valor. É o que fecha a janela de 23514 entre o push (que publica na hora) e a
migration (rodada à mão).

## U84 — A coordenada conferida (R114 — Fase 2, Passo 2.1)

Esta entrega **encolheu deliberadamente** entre o desenho e o commit. O desenho
original era a estimativa de deslocamento calculada; ela **saiu inteira** e
virou entrega própria (`docs/PENDENCIAS_TECNICAS.md`, P46). Fica o que funciona
hoje, vale sozinho, e conserta defeito vivo.

**Por que a estimativa saiu.** Dois fatos, os dois verificados:

1. `ORS_API_KEY` nunca existiu fora do código — não estava no `.env`, não estava
   na documentação, e o Davi nunca foi solicitado a criá-la. A estimativa
   **não podia funcionar em produção**, nem com defeito nem sem, e portanto não
   podia ser exercitada de verdade por ninguém.
2. Três rodadas de refutação acharam FATAIS dentro de portões verdes, e os dois
   últimos eram do mesmo tipo: o piso da adoção usava o fim do **dia** onde a
   origem usava o bloco **anterior**, e `diaCarregado` comparava o dia pedido com
   ele mesmo. Código inerte com defeito conhecido acorda no dia em que alguém
   puser a chave, semanas depois, quando ninguém lembra — então ele não fica
   dormente: **sai do repositório** e o que se aprendeu fica escrito.

**O que ficou (três peças independentes)**

- **A conferência do mapa.** As quatro telas que geocodificam passam a IMPRIMIR
  o bairro/cidade/UF que o serviço devolveu, e a APAGAR essa conferência (e a
  coordenada) quando o endereço é editado depois. Resolve um defeito vivo:
  coordenada caindo na cidade errada, em silêncio, permanente no cadastro.
- **A janela segue o campo.** `FormularioDoBloco` avisa o invólucro quando o dia
  muda de semana, e o invólucro refaz a consulta. Conserta uma cegueira
  **PRÉ-EXISTENTE**: `blocosDoDia` alimenta `erroDoAgendamento`, e trocar de
  semana fazia a checagem de conflito e a soma da jornada rodarem sobre uma
  lista que não continha o dia — formulário **mais permissivo que a porta**.
- **O gatilho da coordenada (a migration).** Trocar o endereço zera a coordenada,
  para ela não sobreviver ao endereço que a produziu.

**O que foi APAGADO — e o saldo da entrega é negativo em abuso de terceiro**

Havia **quatro** cópias de Nominatim, todas no navegador, nenhuma com
User-Agent (o navegador **proíbe** o cabeçalho — cumprir a política era
literalmente impossível de onde elas estavam). Sobrou **uma**, no servidor
(`src/lib/geocodificar.functions.ts`), com User-Agent, consulta estruturada,
`addressdetails=1` e o freio de `src/lib/ritmo.ts`. Saíram junto: o `useEffect`
de `visita.$id.tsx`, que geocodificava a cada abertura da ficha e **jogava o
resultado fora**; os **dois `onBlur`** (um Tab pelo formulário gastava
requisição); e o `", São Paulo, Brasil"` grudado no endereço pelo
`/gerencial/nova`, que reancorava na capital endereços de Bertioga e Porto
Seguro — a mesma classe de erro que esta entrega existe para não cometer, já
dentro do repositório. Essa consolidação também tirou **5 erros** de `tsc` de
`visita.$id.tsx`.

Também morreu o `as unknown as ChamadoParaGrade[]` de `AgendaDoChamado.tsx`:
gêmeo do que a U80 matou no route, ele sobreviveu porque a asserção da U80 só
olhava para o outro arquivo — presença provada num lugar, ausência não provada
no outro. Com ele, uma coluna que a consulta não traga chega `undefined` em vez
de `null`, e o formulário muda de comportamento conforme a **porta** por onde
foi aberto.

**A migration ia ABORTAR, e isso foi pego antes do Davi colar.** O portão do §3
inseria `situacao = 'prospecto'` em duas linhas descartáveis. A U27 (u27:213-218)
apagou esse valor do CHECK assim que nenhum prospecto sobrou: a constraint viva é
`CHECK (situacao IN ('ativo','inativo'))`. O INSERT violaria
`clientes_situacao_check`, a transação inteira voltaria atrás, e **o gatilho
nunca seria instalado** — com uma mensagem do Postgres que não nomeia a U84 nem
diz o que fazer. Corrigido **apagando** a coluna do INSERT: `situacao` é
`NOT NULL DEFAULT 'ativo'`, aceito pelas duas versões do CHECK que já existiram.
A conferência 7 da migration passou a **imprimir o CHECK vivo** — não mais como
pergunta aberta, e sim como retrato de qual versão do CHECK está de pé na base.

**E o `'prospecto'` tinha DOIS escritores, não um — o `tsc` caiu de 83 para 59.**
A primeira leitura culpou só `criarCliente` do `/gerencial/nova` (todo prédio
novo batia em `23514`, e como é a mesma mutação, a criação da VISITA caía junto).
O segundo era pior e não estava declarado: `consolidarGrupo` levava
`situacaoSugerida` ao `patch`, e no ramo de `UPDATE` **fora do `preservar`** —
`/clientes/migrar` morria com o CHECK apertado, ou rebaixava um cliente oficial e
ativo com o frouxo. Os dois foram **apagados** (não é escolha de produto: a U27
fechou o valor com argumento, e `SITUACAO_LABEL['prospecto']` é `undefined` em
qualquer tela que o renderize), e `situacaoSugerida` foi deletada junto.

**A lição é sobre o baseline, e é a melhor desta rodada.** Os dois defeitos
estavam dentro dos 83 erros de `tsc` que a casa carregava como "pré-existentes,
do `types.ts` do Supabase". O baseline foi de 83 a 78 com a consolidação do
Nominatim (5 erros de `visita.$id.tsx`), e de 78 a **59** quando os dois
`'prospecto'` saíram — **dezenove** erros, quase um quarto do baseline, eram
consequência de dois bugs de produção, e o compilador apontava o dedo desde
sempre. O critério "não criar erro novo" é barato e por isso sobreviveu; o que
ele não faz é olhar para os que já estão lá. **Baseline de erro de tipo é onde
defeito de produção se esconde**, e uma queda no número é sinal para reler a
lista inteira. Está escrito em `docs/manual/desenvolvimento-e-verificacao.md`.

**A rodada de limpeza que veio depois do corte.** O corte mediu identificadores
e caminhos; prosa não é identificador, e sobrou uma camada de comentários
descrevendo a estimativa **no presente** — inclusive um motivo inventado
(`cliente_sem_coordenada`) que não existe em lugar nenhum do repositório, que é
a mesma classe de defeito que a casa já pagou com a citação inventada do
`COMMENT ON COLUMN`. Foram apagados, e `NOMES_MORTOS` passou a cobrir também
**afirmações em prosa**, não só identificadores e caminhos. Saiu junto a consulta
ESTRUTURADA de `geocodificar.functions.ts` (`street`/`city`/`state`/`postalcode`)
— ela nunca teve um preenchedor, o ramo era inalcançável, e **uma asserção verde
a prendia viva**, que reprovaria a deleção correta: regra 10 dentro do
verificador.

**E a instrução de recuperação era FALSA, com uma cópia indo para o catálogo do
banco de produção.** Cinco lugares (o §2 da migration, o `COMMENT ON TRIGGER`, a
perna 4, a R114 e o manual) diziam *"salve de novo sem tocar no endereço e ela
volta"*. Não volta: o `onSuccess` desmonta o `ClienteForm`, o formulário reabre
lendo `inicial?.latitude` — que agora é `null` — e salvar remanda esse mesmo
`NULL`. O caminho que funciona é **clicar em "Localizar no mapa" de novo e
salvar**: o endereço já está gravado, a perna 1 é falsa, e a coordenada
sobrevive. Comentário de catálogo que descreve mecanismo ausente é pior que
comentário nenhum — ele ensina o próximo leitor a confiar numa proteção que não
existe.

**A R114 se contradizia dentro dela mesma**, e isso mandava o próximo leitor
apagar um conserto desta rodada. O item (1) dizia "editar o endereço apaga a
coordenada nas quatro telas"; o item (2), vinte linhas abaixo, dizia "quem zera é
o banco, **e só o banco**". As duas camadas não são a mesma regra escrita duas
vezes: são **escopos diferentes**. O app limpa o estado do FORMULÁRIO, antes de
gravar, para a pessoa ver e poder relocalizar — inclusive em cadastro novo, que é
um `INSERT`, onde um `BEFORE UPDATE` não alcança nada. O banco cobre todo caminho
de escrita que o formulário não é.

**PENDENTE — nada bloqueia o deploy desta entrega.** Não há chave a configurar,
não há coluna nova, não há RPC nova. `CAMPOS_BLOCO` não mudou e a consulta de
chamados não mudou. A migration pode rodar antes ou depois do push, e sozinha ela
já melhora o sistema de hoje.

**Uma mudança de comportamento visível, e o Davi precisa saber antes.** Trocar a
data dentro do formulário agora **navega a grade** para aquela semana (só quando
a semana muda). É o preço do conserto — a consulta precisa seguir o campo — e
está no manual.


## U85 — O calendário de feriados (R115 — Fase 3, Passo 1)

**Esta entrega não tem migration, não tem tela e não tem consumidor
obrigatório.** É `src/lib/feriados.ts`, puro, e sobe sozinho, hoje, sem
janela. Ela é dependência de **duas** coisas independentes: o sobreaviso (U86,
para saber se um dia pede 14h ou 24h) e o **cronograma de implantação por dia
útil da Fase 4**, que ainda não existe. A Fase 4 depende DELE e não do
sobreaviso, e é por isso que ele é entrega separada em vez de um arquivo dentro
de `features/sobreaviso/`.

Antes desta rodada não havia **nada** de feriado ou dia útil no repositório —
zero ocorrências em `src/` e em `supabase/`. Então esta entrega escolhe o
vocabulário que o projeto vai carregar, e foi por isso que ela virou regra
numerada em vez de utilitário.

**A decisão que decide o resto: feriado e ponto facultativo não colapsam num
booleano.** O caso que resolve a discussão é uma data só: **04/06/2026** é
feriado *municipal* em São Paulo capital e ponto facultativo *federal*. Um campo
teria de escolher, e o lado que ele erraria é o dia em que Interlagos fecha.
`diaEspecial()` devolve uma **lista**, e no 04/06 ela tem dois itens com
normas diferentes. Carnaval é o espelho: fecha meia cidade e não é feriado. O
que se perde por não achatar é nada; o que se perde por achatar é
irrecuperável, porque o dado já nasce sem o segundo eixo.

A **projeção** ("isto conta como dia útil?") é política, não factual, e mora
numa função só. Feriado não conta; facultativo conta; expediente parcial conta —
a Prever é privada. Se um dia o sobreaviso e o cronograma precisarem de
respostas diferentes, é `ehDiaUtil` que se desdobra, e nada mais muda.

**O computus.** Meeus/Jones/Butcher, e a asserção dele **não** compara o
resultado com ele mesmo (regra 9): a fixture são 24 Páscoas conferidas em
efeméride, escritas à mão (regra 4), incluindo os quatro extremos reais —
1818-03-22 e 2285-03-22 (o mais cedo possível) e 1943-04-25 e 2038-04-25 (o mais
tarde). Mais duas propriedades independentes varridas em 818 anos: toda Páscoa é
domingo, e toda Páscoa cai em [22/03, 25/04] — **e os dois extremos são
efetivamente atingidos**, senão uma implementação que devolvesse sempre 01/04
passaria nas duas primeiras.

**Até que ano ele responde, e o que acontece quando errar.** Tabela chumbada
morre: no primeiro ano não cadastrado todo dia vira útil, em massa e em silêncio.
Algoritmo puro **mente**: em 2020 a Lei mun. 17.341 antecipou Corpus Christi e a
Consciência Negra para 20 e 21 de maio, e nenhum algoritmo derivado da Páscoa
sabe disso. Ficou o par — algoritmo + tabela de exceções datada + a constante
`ANO_CONFERIDO_ATE`. No ano em que a lei mudar o módulo **não avisa**; não há
como. O que se fez foi tornar a divergência barata e **visível**:
`conferido(ano)`, a barra do mês e o **aviso impresso no PDF**.

**O que eu NÃO pus na tabela de exceções, e por quê.** As "pontes" (o facultativo
de segunda ou sexta colada a um feriado) que a Prefeitura decreta ano a ano.
Duas razões, nesta ordem: (1) elas **não mudam uma resposta** deste módulo —
ponte é ponto facultativo, e facultativo conta como dia útil para empresa
privada, então `ehDiaUtil`, `ehFeriado` e a cobertura do sobreaviso devolvem
o mesmo número com ou sem elas; o ganho seria um nome num tooltip. (2) Cada uma
exige citar um decreto anual específico, e escrever a citação sem ter o decreto
na mão é **inventar fonte** — que é exatamente a classe de defeito que a U84
passou uma entrega arrancando do catálogo do banco. O mecanismo está pronto;
falta o decreto, e ele entra quando alguém o tiver aberto.

**Regra 8 aplicada:** o módulo **importa** `dataIso` de `periodos.ts` em vez
de reescrever a conversão. É a mesma conta, e `features/programacao/modelo.ts`
já argumenta em prosa contra reafirmar conta existente. O verificador prende as
duas metades: que o import existe e que não há `function dataIso` aqui.

Uma sutileza que custou nada e evita um bug de fuso: **toda data é construída ao
meio-dia**. O Brasil aboliu o horário de verão em 2019, mas o módulo responde
desde 1583 e em São Paulo o relógio pulava de 23:59:59 para 01:00:00 — a
meia-noite **não existia** em várias datas de outubro. Ao meio-dia, nenhum
deslocamento de ±1h atravessa a fronteira do dia.

## U86 — O sobreaviso: a grade pessoa × dias do mês (R116 — Fase 3, Passo 2)

**ORDEM DE DEPLOY: MIGRATION PRIMEIRO, PUSH DEPOIS.** A regra 5 da casa
(*push publica na hora, migration roda à mão depois*) **inverte** aqui, porque o
código passa a nomear `public.sobreaviso` e duas RPCs que não existem: subir o
código antes abre `/sobreaviso` com **PGRST205** para todo mundo. E a entrega
irmã do mesmo dia, a U85, é o contrário — .ts puro, sem migration, sem janela.
**Duas ordens opostas no mesmo dia, num repo em que o Davi roda o SQL à mão, é a
receita para a metade errada subir primeiro.** Por isso são duas entradas e dois
commits.

### A escolha que estrutura tudo: uma linha por (dia, pessoa)

A alternativa séria era **um mês por linha, com um vetor de 31 posições**. Ela
tem uma virtude — "uma linha, uma transação" — e essa virtude **é falsa no caso
principal**. A unidade de *decisão* é a semana; a de *relatório* é a competência;
e a semana padrão tem **oito dias de calendário**. Medi: **12 das 52 segundas de
2026** têm o oitavo dia no mês seguinte, e não é acidente de 2026 — todo mês
contém exatamente uma segunda nos seus últimos sete dias, então são 12 por ano,
para sempre. O **vetor mensal precisaria de duas linhas e duas transações em 23%
das aplicações do gesto mais usado da tela**. Um desenho cuja vantagem central
desaparece no caso principal não é um desenho.

O **dia** é a única unidade que é subconjunto tanto da semana quanto do mês. Com
ele, "quem estava de sobreaviso em 14/03?", "quanto a Fabiana fez em 2027?" e
"qual dia ficou descoberto?" são SQL comum — sem decodificador, sem view, sem
domínio sobre array. E `dia date` torna **30 de fevereiro inexprimível**, coisa
que um vetor de 31 posições não faz.

O **intervalo** `(dia, inicio_min, fim_min)` também foi recusado, e não por
mim: a U78 já o recusou por ser fatal para plantão que atravessa a meia-noite
(`PLANO_UNIFICACAO.md:5033`). O preço está declarado em P48: o escalar não sabe
a **hora** do handover.

**Célula vazia é ausência de linha.** `CHECK (horas > 0 AND horas <= 24)`, e
zerar é DELETE. Isso mata a tricotomia 0 / NULL / ausente antes que ela exista:
um `horas = 0` gravado seria *vazio* para a tela e *preenchido* para o teste de
colisão do gesto em massa — divergência silenciosa exatamente no lugar mais caro.
Conferi que a semana padrão **nunca** emite zero: nas 416 células de 2026 o
mínimo é 6.

### O gesto destrutivo, e o achado que ele produziu

**Nenhuma das três respostas do enunciado acerta a segunda de virada.** Mesma
pessoa em duas semanas seguidas: ela já tem 8h de madrugada da semana anterior e
a nova quer pôr 6h de noite. Sobrescrever perde 8h; "só vazio" perde 6h;
perguntar sempre pergunta onde a resposta é óbvia e **treina todo mundo a clicar
"sim" sem ler**, que é como o gesto vira silencioso. O certo é **somar até o
teto**: 8 + 6 = 14 = a cobertura daquela segunda. Daí as quatro ações nomeadas
(`inserir` / `igual` / `somar` / `trocar`), e a invariante que as
sustenta: `horas + absorve = coberturaDoDia(dia)` nas duas pontas.

Foi preciso um **quinto ramo escondido dentro de `igual`**: "já é a soma". Sem
ele, reaplicar uma semana já somada cairia em `trocar` e o sistema pediria
confirmação **para não fazer nada** — que é a mesma doença por outro caminho.
Com ele, reaplicar as 52 semanas de 2026 devolve 416 `igual` e zero escritas.

A confirmação **nomeia o que se perde**: os oito dias, com o *antes*, o *depois*
e a ação de cada um. Não existe "tem certeza?" nesta tela, e há asserção para
isso. E **quem decide se escreve é o banco**, na mesma função e no mesmo
instantâneo em que escreveria — a prévia e a escrita saem do mesmo `SELECT`, e
por isso não podem discordar. Limpar é **assimétrico** de propósito: nunca tem
caminho livre, porque limpar sempre perde.

### O que o portão prova, e o caminho que ele NÃO podia deixar de fora

Seis provas dentro da transação, com uma pessoa real e datas de 1900 (que são
apagadas no fim, com a ausência provada). A que mais importa é a **prova 5**: o
teto de 24h é exercitado **pelo UPDATE direto**, que é o caminho da R90 ("tudo
salva sozinho", a cada digitação) — provar o teto só pela porta do array seria
provar a porta que quase ninguém usa, e um portão que passa provando o caminho
errado é a pior asserção que existe.

### Duas listas de gente: não

O plano previa um fork ("ou criamos `funcionarios`, ou aceitamos
perfis-fantasma"), e a premissa dele caiu: `docs/PRODUTO.md` diz com todas as
letras que **todo técnico tem usuário** desde 2026-08-22, superando a R14. Não
existe tabela `funcionarios`, `profiles.id` referencia `auth.users`, e a
migration `20260628063033` já registra a doutrina no comentário da coluna
`ativo`: *"reutilizando profiles em vez de criar perfis"*. Uma segunda lista de
pessoas seria a **quinta** colisão de vocabulário deste projeto e a mais cara.

O recorte de quem entra na grade não tem **um literal de cargo**. O CHECK vivo é
`cargo IS NULL OR cargo IN ('admin','comercial','sac','tecnico')` — filtrar por
"tecnico" tiraria o coordenador que atende às 2h. Os eixos são `ativo` e
`status`, e a comparação é `!== 'pendente_aprovacao'` e **não**
`=== 'ativo'`: excluir *o valor que se quer excluir* sobrevive a um status
novo; a outra forma esvaziaria a grade no dia em que alguém criasse "férias".

### O que o verificador ganhou de permanente, e o que ele achou

Nasceu um detector de **defeito de classe**: nenhuma RPC pode comparar um nome
de coluna do próprio `RETURNS TABLE` sem qualificar. Em PL/pgSQL, com o
`plpgsql.variable_conflict = error` padrão, isso é **42702 em execução** — não
na leitura —, e o repositório tem mais de vinte RPCs com `RETURNS TABLE` sem
nada que pegasse isso. O detector filtra comentário antes de medir, apaga as duas
formas legítimas de nome nu (lista de colunas do INSERT e alvo de `SET`),
honra `#variable_conflict use_column` e tem par negativo.

**Ele já nasceu com um achado, e é grave:** `public.montar_fechamento` (U5)
declara `fechamento_id` no `RETURNS TABLE` e depois o usa **nu duas vezes**
contra `public.cobrancas`, que tem coluna com esse nome. Quem chama é o botão
de montar fechamento (`features/financeiro/fechamentos.ts:88`). **Não
consertei nesta rodada**, de propósito: a U5 já rodou (o repo nunca edita
migration aplicada), o conserto é uma migration nova sobre a função mais cara do
financeiro, e ela não pode ser exercitada aqui. Está em **P50**, com o remédio
escrito. A asserção é um **censo** — a ocorrência conhecida está declarada e
contada; uma nova, ou o conserto de metade das duas, acende.

Duas asserções da própria casa também foram consertadas no caminho, as duas por
**regra 2** (regex casa comentário): o leitor da semente de `permissoes_tela`
não filtrava comentário e estava apagando da semente uma chave inserida pela
migration, porque o rodapé DESFAZER traz um `DELETE FROM permissoes_tela`
**comentado**; e a primeira versão do detector novo aceitava só letras no
delimitador dollar-quote (`$u80a$` tem dígito), media o corpo da função errada
e **acusava inocente**.

### O que NÃO entrou, e por quê

O **`atendimentos_plantao`** (hora, cliente, plantonista, remoto/presencial,
vínculo com chamado, selos de cobrança) não foi construído — é entrega própria,
com tela e integração financeira próprias. E o sobreaviso **fica de pé sem ele,
e fica melhor sozinho**: entrega quem está de plantão em cada dia, o mês fechado
por pessoa e a cobertura conferida dia a dia — e a faixa de cobertura valida o
plano inteiro **sem um único atendimento registrado**, porque 14/24 é derivado do
calendário e não da soma que o app fez. A dependência é na direção contrária: o
atendimento vai precisar saber quem estava de sobreaviso naquela hora, e é esta
tabela que responde, com **uma linha**.

Também **não** entraram, e ficam registradas para ninguém as repropor: uma
`CREATE VIEW` (o repositório não tem nenhuma), um `CREATE DOMAIN` (idem),
`security_invoker` (idem) e a codificação em array. Um `CHECK (horas > 0 AND
horas <= 24)` aparece em `pg_get_constraintdef` na conferência, legível na
tela do Davi; um domínio aparece em `contypid` e obriga quem confere a saber
onde procurar.

### A pergunta que volta para o Davi

Uma só, e ela **não bloqueia**: **o SAC pode editar a escala?** `is_gestor()`
o inclui, e eu reusei em vez de criar um quarto predicado de papel. A favor: o
sobreaviso existe *para* o SAC, e uma escala que ele não pode corrigir fica velha
exatamente quando importa. Contra: é decisão de pessoal. O default que subiu é
`is_gestor`. Se a resposta for "SAC fora", o lugar é um quarto valor no par de
listas que já existe, não um predicado novo.

---

### Rodada de correção da U85/U86 — o que a auditoria derrubou antes de a migration rodar

Nada disto tinha subido: a migration não rodou e o código não foi commitado. São
correções sobre o desenho, e as três primeiras são as que mudam decisão.

**1. A célula da grade gravava número errado, em silêncio.** Era um `<input>`
CONTROLADO pelo dado do servidor, sem estado local: digitar `24` gravava **2**, o
React devolvia a caixa ao valor do servidor, o `4` era digitado numa caixa vazia
e gravava **4**. O gestor queria 24, o banco ficava com 4, e ninguém era avisado.
Em célula preenchida era pior. Todo outro input numérico do repositório usa
estado local; esta tela era a exceção, e o conserto foi adotar o padrão da casa:
`src/features/sobreaviso/CelulaHoras.tsx`, rascunho local, grava no blur e no
Enter, `Escape` desfaz, e o **clamp ficou visível** (99 deixa 24 escrito na
caixa). A asserção que prende isso **executa o componente** e digita as duas
teclas — uma regex procurando `useState` não veria o defeito, porque o defeito é
de comportamento.

**2. A tela não distinguia "ninguém escalado" de "a consulta falhou".** O único
tratamento era `?? []`. Uma falha produzia a grade completa, com todos os nomes,
dizendo "total do mês 0 h / dias descobertos 31" — e o botão de PDF, **sem
guarda**, exportava isso em A4 paisagem com a faixa dourada. O PDF circula por
e-mail e **sobrevive à tela**. Agora há estado de erro e de carregamento antes de
qualquer projeção, o `PGRST205` é traduzido em "a migration U86 não foi rodada",
e o botão de PDF **não existe** nesses dois estados — não é `disabled`, é
ausência. **É a regra 5 deixando de ser propriedade do comentário da migration e
passando a ser propriedade do código.**

**3. A escala era legível por qualquer um que conseguisse logar.** A policy de
leitura nasceu `USING (true)`, copiando `duplas_escala`. O argumento a favor da
leitura ampla continua de pé — se o técnico não vê as horas dos colegas a faixa
de cobertura mente para ele —, mas `true` não é "todo mundo que trabalha aqui": é
todo mundo que consegue logar, o que inclui o **convite pendente** e o
**ex-funcionário**, os dois grupos que a *tela* já excluía e a *fronteira* não.
A folha de plantão diz quem estava trabalhando às duas da manhã, todo dia — é
informação de pessoal. A policy passou a exigir linha **ativa e aprovada** em
`profiles`, e o mesmo teste entrou nos gates das duas RPCs, que são
`SECURITY DEFINER` e não passam pela RLS. Não é um quarto predicado: é o teste de
dois eixos que `pessoasDaGrade()` já fazia, movido para onde ele vale.

**E a metade que NÃO é desta entrega, com o alcance medido:** `is_gestor()` não
olha `ativo`. Um ex-funcionário com login vivo é gestor para o sistema **inteiro**
— 27 arquivos de migration, 110 ocorrências vivas, 40 `CREATE POLICY`. Mudar a
função de passagem seria trocar dezenas de policies de uma vez, em telas que
ninguém exercitou nesta rodada. Está em **P51**, com as duas saídas e o número na
frente, para o Davi decidir.

**4. O piso de `conferido()` desceu de 2007 para 2025.** `conferido()` afirma um
**ato humano** — alguém abriu o decreto —, não a existência de uma norma. Ancorado
no ano da Lei 14.485, ele avalizava vinte anos dos quais treze ninguém olhou,
**2021 inclusive**, e 2021 teve antecipação municipal de feriados em São Paulo que
não está em `EXCECOES`. A asserção do verificador copiava a constante do módulo
(regra 9 no formato clássico); agora ela deriva de uma lista escrita à mão dos
anos presos contra decreto, e **recusa** um piso que avalize ano sem asserção.

**5. O campo `ate` do calendário saiu inteiro.** Ele carregava um número sem
carregar a **direção**, e os dois casos vivos têm direções opostas: 24/12 e 31/12
têm expediente **até** as 14h; a Quarta-feira de Cinzas tem expediente **a partir**
das 14h. Com um campo só, um dos dois sai invertido — e saía. Nenhum consumidor
calculava com ele e a hora já vive em `norma`, com a direção escrita. Regra 8: o
campo saiu, e a contradição ficou irrepresentável. Se a Fase 4 precisar da hora
como dado, o campo tem de nascer com a direção, e só depois de existir o
consumidor.

**6. Os menores que também eram reais.** `?mes=2026-13` derrubava a tela inteira
(regex apertado para `01..12`); a borracha apagava o **mês** enquanto a varinha
ao lado gravava a **semana**, e em novembro/2026 seis dos oito dias ficavam fora
do alcance do desfazer; o PDF perdia a **meia-risca** (jsPDF descarta calado tudo
acima de U+00FF — **P52**, e o defeito está vivo hoje nos outros três PDFs);
`diasEspeciais()` devolvia o array **do cache** por referência; o ramo
`soPadrao = false` era código morto documentando um botão inexistente e foi
apagado; e a confirmação do gesto em massa agora **diz** quando a escala mudou
entre a prévia e a gravação — post-hoc e declarado como tal, porque a trava
otimista é mecanismo novo e a regra 8 manda o contrário enquanto o segundo gestor
não apareceu.

## U87 — O atendimento de plantão (R117 — Fase 3, Passo 3 e último)

**A ordem de deploy INVERTE: esta migration PRIMEIRO, o push DEPOIS.** É a
regra 5 da casa — a ordem é propriedade do CÓDIGO, e não do gosto de quem
entrega. O cliente NOMEIA objeto que não existe: `from("atendimentos_plantao")`,
`rpc("plantao_salvar")` e `rpc("plantao_apagar")` estão em
`src/features/plantao/data.ts`. Subir o push antes abre o painel com **PGRST205**
para todo mundo. E não é a dança de dois commits da U83: nenhum valor novo entra
em CHECK de tabela que já existe — o que é **consequência** de a marca ser
satélite, e não coincidência. As duas metades (o registro e o gancho do texto do
dia) vão num commit só, com uma ordem só.

### O fato que não tinha casa

`às 02:30 de 30/08 o Igor atendeu a Padaria X, remoto, e isto foi o que ele fez`.
A escala (U86) guarda o **plano** — quem *deveria* estar —, e na segunda de
virada nem isso: `plantaoDoDia` devolve dois nomes e nada no dado diz quem cobre
qual metade, porque a convenção de `semanaPadrao` **não é gravada** (`origem`
sequer chega a `plantaoDoDia`). O chamado, quando existe, guarda **o quê** —
nunca a que horas se atendeu, nunca que aquilo foi plantão.

### A pergunta que decidiu o desenho, e o teste de forma que saiu dela

Havia dois desenhos na mesa e eles respondiam a perguntas diferentes. Um
perguntava *"onde este trabalho mora no sistema?"* e respondia "num chamado";
o outro perguntava *"que fato não tem casa hoje?"*. Só o segundo responde ao que
foi pedido — mas o **teste de forma** do primeiro foi adotado, porque ele
generaliza o que a casa já vinha fazendo por instinto, e virou a R117:

> **valor num CHECK** quando a coisa responde a MESMA pergunta com resposta nova
> (`vistoria`, R112) · **função pura** quando ela já está gravada noutras
> colunas (`emergencial`, R99) · **satélite** quando ela traz perguntas que a
> tabela não faz.

É esse teste que recusa `natureza='plantao'` e `tipo='plantao'` sem depender de
gosto. E ele recusa também o desenho do "um chamado por telefonema atendido",
por cinco custos medidos: 480 linhas/ano na tabela mais quente (537 chamados
importados); kanban, numeração CH-, SLA, Painel Operacional (R95) e fila de
conferência herdados; a tela do técnico exige **assinatura** para concluir
(`DetalheCampo.tsx:345`) — o objeto não serve para o caso; o cliente que o
plantonista não enxerga (`pode_ver_cliente`, u71:333-370) iria para dentro do
**título**; e às 2h da manhã seriam três textos obrigatórios.

**E o argumento que sustentava aquele desenho é FALSO, medido.** Diziam que um
chamado nascido `concluido` não dispararia o aviso ao financeiro. O ramo que
manda *"aguarda sua conferência"* é `NEW.status = 'executado'` (u7:415-422), e
`'executado'` está **proibido pelo CHECK desde a U13** (u13:60-63): é código
morto. A fila do financeiro é derivada em consulta, por `aConferir`
(`atividades/modelo.ts:485-486`), e funciona igual. Foi a única vez nesta rodada
em que o desenho perdedor perdeu por um fato do repositório, e não por
preferência.

**Uma correção de proveniência, e ela é a regra 9 acontecendo duas vezes.** Os
dois desenhos apoiavam o "pior caso" numa frase de `PENDENCIAS_TECNICAS.md`
(P19) que diz que *"a linha 107 da conferência da U80 conta as cobranças presas
a chamado que não vieram de peça"*. É falso: `u80:105-108` é o **pré-voo** e
conta duplicatas; a **conferência 107** (`u80:694`) diz "nenhuma duplicata viva
sobrou". Nenhuma conferência da U80 mede a população de avulso vinculado; a mais
próxima é a **111** (`u80:731`), e ela conta outra coisa. A frase do P19 foi
reescrita nesta entrega para apontar o arame certo e dizer que ele mede outra
coisa — em vez de inventar um número.

### As seis decisões

**1. Plantonista GRAVADO, não derivado.** `plantonista_id NOT NULL REFERENCES
profiles(id) ON DELETE RESTRICT`. Mesma doutrina de "apoio é gravado, dupla é
derivada" (U47 × U64, U81). **Custo declarado:** escala e registro podem divergir
e nenhuma TELA avisa. O aviso é o que a porta devolve no ato — e nada mais. Sem
tela de divergência, sem selo, sem tabela de reconciliação (regra 8).

**O enxerto que responde ao custo, e ele veio do desenho perdedor.** A porta
devolve, junto com a linha gravada, **as horas de sobreaviso desta pessoa
naquele dia** e **as horas do dia inteiro** — dois números, nenhum booleano. Um
`escalado boolean` sozinho colapsaria "furou a escala" com "não há escala
nenhuma lançada", que é acusação sobre o trabalho de outro. Com os dois números,
`avisoDaEscala` tem **três** estados, e o portão prova os três.

**2. Quem escreve.** A tabela é **só-leitura no navegador por privilégio** —
`REVOKE ALL … FROM PUBLIC, anon, authenticated`, `GRANT SELECT` —, o desenho de
`agenda_campo` (u78:805-834) com o argumento dele: *"não escrevi um GRANT" não é
o mesmo que "não há GRANT"*. Toda escrita passa por `plantao_salvar` /
`plantao_apagar`, gate em duas metades: **vínculo** (`ativo` e não
`pendente_aprovacao`, ao lado de `is_gestor` porque ela não olha `ativo` — P51)
e **procuração** (`_plantonista = auth.uid()` OU `is_gestor`). Qualquer pessoa
da casa registra **para si**; lançar por outro é de quem responde pela operação.
Um gate de gestor impediria a única pessoa que estava lá; um gate aberto deixaria
qualquer um lançar em nome de outro.

**O gate inteiro sob `IF v_eu IS NOT NULL`**, e sem isso o PORTÃO não roda:
`auth.uid()` é NULL na migration, e uma porta que começasse por
`IF NOT EXISTS (… WHERE p.id = auth.uid())` levantaria 42501 **contra si mesma**.
É o idioma de u86:326-331, e foi por perdê-lo que um dos desenhos tinha quatro
portões que abortavam.

**Leitura:** vínculo **e** (dono da linha **ou** gestor). **Não**
`pode_acessar_chamado`: o ramo `responsavel_id IS NULL` daquela função não tem
filtro de status (s2:152-155), e um plantão pendurado em chamado da fila aberta
ficaria legível por qualquer autenticado ativo. É a mesma recusa da U80 §3.

**3. O vínculo com chamado é opcional, e o atendimento NUNCA cria chamado.**
Ligar o chamado amanhã **é correção**, e passa pela mesma porta com `_id`
preenchido — não há segunda porta. `chamados` não ganha coluna: a pergunta
reversa sai de um índice parcial. Nenhum evento em `chamado_eventos`.
**Cobrança: nenhuma**, e a razão está escrita — pelo caminho do chamado arma o
P19; por uma coluna nova em `cobrancas` nenhum dos dois índices únicos da U80 a
cobre (u80:152-154, :171-176); e os dois se apoiam num `montar_fechamento` que
hoje levanta 42702 (P50). O cliente é `cliente_id` **XOR** `cliente_informado`,
com `num_nonnulls(...) = 1` — o idioma vivo de `chamado_locais_uma_forma`
(u71:156-157). **Custo load-bearing:** enquanto for texto, o atendimento não é
cobrável, porque `cobrancas.cliente_id` é NOT NULL (u4:29).

**4. remoto × presencial não muda NADA além do rótulo e do filtro**, e isso está
no `COMMENT ON COLUMN`, na R117 e no `TIPO_NOTA` do modelo puro — nos três
lugares onde a próxima pessoa vai procurar antes de supor que muda.

**5. A hora que atravessa a meia-noite.** `hora timestamptz` é o fato; `dia date`
é a projeção, escrita por gatilho BEFORE **incondicional**. Não pode ser
`GENERATED` nem índice funcional: `AT TIME ZONE` é STABLE. **02:30 de domingo é
o plantão de DOMINGO** — a madrugada pertence ao próprio dia de calendário, que
é o que `coberturaDoDia` já diz ao descontar o expediente *daquele* dia. **Não
existe** `dia_do_sobreaviso`: gravar a frase humana criaria as duas datas que
divergiriam no primeiro dia `curto`.

**O gatilho lê o relógio de parede UMA VEZ.** `v_local := date_trunc('minute',
NEW.hora AT TIME ZONE 'America/Sao_Paulo')`, e daí saem `hora` **e** `dia`. Duas
leituras poderiam divergir; uma não pode. E truncar em UTC seria errado de um
jeito que só apareceria no portão: em 1900 o fuso de São Paulo é LMT
(**-03:06:28**, com segundos), e o minuto local não sairia redondo.

**A tela NÃO calcula o `dia`.** Ela mostra o que voltou do servidor. Calcular no
aparelho daria uma segunda resposta, no fuso do celular, e as duas divergiriam
justamente na madrugada.

**6. O gancho do "compartilhar o dia", preenchido.** `textoDoPlantonista` em
`sobreaviso/modelo.ts`, e o rótulo passou a **`Plantonista de hoje:`**. É do
**DIA**: `textoDoDia` é texto de um dia, e "o plantonista da semana" não tem
resposta única — `segundaDaSemana('2026-08-24')` devolve a própria segunda,
enquanto a semana operacional dela começou às 18:00 de 17/08. Quatro decisões:
mês não carregado → `null`; ninguém escalado → `null`; **cobertura curta** → a
frase da escala furada **sem nome**; caso normal → os nomes **ordenados por
nome**, nunca `quem[0]` (que na virada é quem **sai**).

A terceira é onde divergi dos dois desenhos: um imprimia o nome com ressalva, o
outro calava. Nomear responde *"chame o Bruno"* a quem pergunta *"quem eu chamo
hoje à noite"* num dia em que as 8h do Bruno são a madrugada que já passou;
calar perde a informação de que a escala está furada. Só a terceira forma é
verdadeira.

### O que a verificação pegou

**O compilador pegou uma colisão de nome que teria sido um defeito vivo.**
`chamados.programacao.tsx` já tinha uma constante local `gradeDoMes` — a régua do
modo mensal. Importar `gradeDoMes` do sobreaviso sem apelido fazia a chamada
resolver para um `useMemo` de células de calendário. Entrou com apelido
(`gradeDoSobreaviso`), e há asserção impedindo a volta. É a lição da U84 outra
vez: o `tsc` estava dizendo, e o número 59 é onde isso se esconde.

**A asserção do gancho foi virada, e virada em duas direções.** A que existia
casava `/Plantonista/` e **ficaria verde com o rótulo trocado** — que é
exatamente o que esta entrega fez. Agora ela mede o rótulo palavra por palavra e
prova, com DIFF, que o `plantonista: null` **saiu** da tela (regra 2: presença
não detecta deleção).

**O censo da P51 acendeu sozinho**, como foi desenhado para acender: +1 arquivo,
+11 ocorrências de `is_gestor`, +1 policy. Cada uma delas vem acompanhada do
teste de dois eixos escrito ao lado, e o número foi atualizado com o motivo.

**O comentário de `telas.ts:61` estava errado**, e foi corrigido com asserção:
ele afirmava `sobreaviso_select USING (true)`, e a policy viva é o teste de dois
eixos. Importa porque é esse comentário que alguém copia ao escrever a policy da
próxima tela.

### O portão, e o que ele recusou provar

Oito provas de **comportamento** dentro da transação: a virada da meia-noite
(com o par que mostra que o caso **atinge o alvo** — em UTC a data é outra), a
madrugada de domingo, a truncagem ao minuto **junto com** o duplo toque que ela
torna visível **e** o par negativo (descrição diferente no mesmo minuto passa),
o XOR do cliente pelos dois caminhos (a porta e o CHECK), tipo e descrição, os
**três** estados da escala, a correção pelo mesmo `id`, e o apagar idempotente.

**Nenhuma prova depende do relógio.** Não há `now()` construindo caso: uma prova
que comparasse `now() - interval '30 minutes'` com a data corrente de Brasília
abortaria a migration entre 00:00 e 00:30, que é falha por hora do dia.

**E não há prova de `alterado_em` monotônico, de propósito.** Ela é
**inassertável** aqui: `now()` é `transaction_timestamp()`, constante dentro da
transação, e um INSERT seguido de UPDATE no mesmo `BEGIN` grava o **mesmo**
instante. Uma asserção de "avançou" abortaria num banco perfeitamente sadio. Um
dos desenhos a trazia, e ela sozinha teria matado a migration inteira. A recusa
está **escrita** na migration, e não só ausente — e há asserção medindo que ela
está escrita.

**O pré-voo exige DUAS pessoas**, e a exigência é do portão: o terceiro estado do
aviso da escala ("o dia tem escala, e não é sua") precisa de uma segunda pessoa
escalada. Com uma só, esse ramo nunca rodaria — e ramo não exercitado dentro de
um portão é conforto falso.

### O que NÃO entrou, e por quê

**Não há rota nova, nem chave em `permissoes_tela`.** A porta é a **terceira
opção do "+" da Início** (R91), que já existe no celular de propósito — zero item
novo na barra (R7). `telas.ts` diz que "uma tela existe quando existe rota", e
uma chave sem rota seria órfã nos dois sentidos da asserção que compara catálogo
e semente. Por isso esta migration **não** entra em `ARQUIVOS_SEMENTE`, e a
decisão é **medida** (conferência 217 no banco, asserção no verificador) em vez
de ficar como omissão.

**Não há híbrido.** A costura óbvia seria "grava o satélite e, se o usuário
quiser, cria o chamado na mesma porta". Isso é um terceiro modo de falhar: a
porta passaria a ter dois caminhos de escrita com invariantes diferentes, e a
metade que quase nunca é exercitada é a que quebra às 2h da manhã — que é
exatamente a forma do P50, vivo hoje em `montar_fechamento`.

**Não há lápide** quando um atendimento é apagado (P53), **não há relatório
mensal de plantão**, e **não há tela de listagem própria** — a lista mora dentro
do painel, é dos últimos atendimentos e é por **recência**, não por dia, porque
o cliente não sabe o `dia` e calculá-lo seria a segunda verdade que a decisão 5
existe para não ter.

## U88 — Os dois consertos de dinheiro (R118/R119 — pré-requisito da Fase 4)

Esta entrega vem **antes** da Fase 4 porque a metade financeira dela (cobrança
disparada na conclusão da implantação) senta em cima de duas dívidas ALTO que
foram confirmadas **vivas** por medição, não por memória.

**Arquivos:** `supabase/migrations/20260910090000_u88_consertos_de_dinheiro.sql`,
`scripts/verificar-logica.cjs`, `docs/PRODUTO.md` (R118/R119),
`docs/manual/financeiro.md`, `docs/PENDENCIAS_TECNICAS.md`.
**Nenhum arquivo de `src/` mudou** — e isso é o argumento da ordem de deploy, não
uma economia.

### P50 — o botão de montar fechamento estava morto desde 18/08

`montar_fechamento` (U5) declarava `fechamento_id` como coluna do `RETURNS TABLE`
e usava o nome **nu** duas vezes contra `public.cobrancas`, que tem coluna com
esse nome. Com o `plpgsql.variable_conflict = error` padrão isso é **42702 em
EXECUÇÃO** — não na leitura, e não no `CREATE`.

**A função inteira morria, não um ramo:** as duas linhas estão no caminho comum,
depois do `IF` semanal × mensal. E o erro estoura **depois** do INSERT em
`fechamentos` — como a RPC é uma instrução só, tudo volta e **nenhum rastro fica
no banco**. É por isso que a tabela vazia não distinguia "ninguém usou" de "todo
mundo tentou e falhou", e é por isso que ninguém relatou em três semanas.
Achado pelo detector de classe que nasceu na U86, não por relato.

**Qualificar, e não renomear.** A U87 escolheu nomear diferente para tornar a
classe *inexprimível*, e o argumento continua correto — mas ele é **grátis no
nascimento** de uma função e caro depois. `fechamentos.ts:95` lê
`(l as any)?.fechamento_id` e `fechamentos.tsx:76` usa o valor em
`navigate({ params: { id: r.id } })`: os dois lados passam por `as any`, então
renomear **não geraria erro de compilação** — o `tsc` ficaria no baseline e o
usuário cairia em `/fechamentos/undefined` depois de montar o fechamento com
sucesso. Compra-se contrato intacto e deploy de um passo; paga-se a classe
continuar exprimível ali, com o censo do verificador como guarda. Preço escrito.

**E não foi `#variable_conflict use_column`**, que resolveria tudo numa linha: o
detector da U86 dá `continue` em quem declara a diretiva. Ela esvaziaria o censo
por **isenção**, não por conserto, e tiraria a função da vigilância para sempre.
Regra 10 na versão em que o defeito é o próprio conserto.

**Censo, com o número na frente.** O detector foi rodado literal sobre as 108
migrations. Denominador declarado: **15** declarações `RETURNS TABLE`, das quais
**13** em `LANGUAGE plpgsql` (única onde a classe existe) e 2 em `LANGUAGE sql`
(imunes); 2 das 13 declaram a diretiva e são absolvidas. **Acusada: exatamente
uma.** Não há segunda função com a forma, e nada virou dívida nova.

**A armadilha que fica escrita: `ON CONFLICT (tipo, referencia)`.** É a MESMA
forma — `referencia` também é parâmetro OUT — e **não é defeito**: a lista de
inferência de índice não é expressão, o parser guarda o nome em `IndexElem` e o
resolve direto contra a relação, sem passar pelo hook de variável do plpgsql.
Qualificá-la **não compila**, e `ON CONSTRAINT` não serve porque
`fechamentos_unico` é `CREATE UNIQUE INDEX`, não constraint. Quem for consertar
por simetria mata o upsert que torna a função idempotente. Está dito no corpo da
função, no cabeçalho da migration, na conferência 104 e no verificador.

### P19 — o DELETE comia a cobrança avulsa vinculada

O discriminador **já existia na linha**: `chamado_peca_id`. Censo de todos os
escritores de `public.cobrancas` no repositório — os cinco INSERTs de aprovação
selecionam `p.id` (PK, nunca nula); `concluir_chamado_com_cobranca` grava NULL
literal com `chamado_id` preenchido; `lancarCobrancaAvulsa` nem manda
`chamado_id`. Logo `chamado_id NOT NULL AND chamado_peca_id IS NULL` é
**assinatura de origem**, e não heurística. **A premissa de que a origem das
linhas existentes seria indecidível é falsa** — e por isso não há dívida
retroativa. Melhor: a U80 já cravou esse recorte em índice único vivo
(`cobrancas_avulsa_unica_por_chamado_idx`), com o COMMENT nomeando a forma.

**Recusadas, medidas:** `fechamento_id IS NULL` é ciclo de vida e não
proveniência (e discordaria de um índice vivo); a ausência de análise é
propriedade do CHAMADO e não da LINHA; `criada_por` é o mesmo usuário nos dois
casos. As três recusas ficaram escritas no cabeçalho da migration.

**Uma linha era insuficiente, e a S4 já tinha dito.** Com o DELETE estreitado,
`v_itens = 0` cravaria `sem_cobranca` com dinheiro vivo na tabela e gravaria
"nada a cobrar" na linha do tempo. São **três edições**: o predicado do DELETE, a
decisão de `faturamento_status` (que passa a contar o que EXISTE vivo) e o texto
do evento.

**O recorte de "viva", declarado:** a decisão de status usa `<> 'cancelada'`
(existência ao longo da vida do atendimento — é o mesmo recorte de
`montar_fechamento` e dos dois índices da U80), e o `v_total` fica em
`= 'aberta'` (saldo agora). **Duas perguntas diferentes, dois recortes, ambos
corretos** — escrito para não ser "limpado" depois.

**Efeito colateral declarado:** `v_total` já somava DEPOIS do DELETE. Hoje ele
excluía a avulsa porque ela tinha sido apagada; com o DELETE estreitado ele passa
a incluí-la, **sem que esta migration toque naquela linha**. O número que a tela
pinta muda sozinho, e muda para melhor.

**O P19 não era prospectivo.** A U80 está no ar desde 03/09 e produz exatamente a
forma que o DELETE comia. A disjunção do passo 6 dela é de mão única: recusa
`lancar` sobre chamado analisado, mas nada impede APROVAR sobre chamado lançado.
Alcançável hoje por uma **aba desatualizada** de um segundo gestor — a trava que
esconde o botão é de tela, e nada em `aprovar_chamado_financeiro` olhava
`faturamento_status`.

### A ordem de deploy, e ela é o inverso da intuitiva

**Uma migration, uma transação, zero push.** As duas funções são
`CREATE OR REPLACE` com a mesma assinatura e os mesmos nomes de coluna: PostgREST
não precisa de recarga e nenhum arquivo de `src/` muda. **A ausência de push é
comprada com a preservação dos nomes.**

**Os dois não podem viajar separados, e a razão é composição.**
`montar_fechamento` recolhe carimbando `fechamento_id` mas **deixa
`status = 'aberta'`** — quem muda para 'fechada' é `fechar_periodo`. Logo uma
parcela recolhida para um fechamento **aberto** continuava casando com o DELETE,
que a apagaria de **dentro** do período; e `fechamentos.total` foi gravado na
montagem e só é recalculado em `fechar_periodo`. A lista pinta o total
armazenado e o PDF soma as linhas: os dois discordariam em silêncio.
**Hoje o 42702 era, sem querer, a trava que segurava o P19** — consertar o P50
sozinho destravaria exatamente isso. O portão prova a composição (prova 5).

**Nenhuma das duas tem chamador dentro do banco** — sem trigger, sem cron, sem
`PERFORM` em migration alguma. Por isso a análise de ordem se esgota no `src/`.

### O portão, e por que ele é o mais perigoso da casa

Ele **chama** as duas funções. Provar que o 42702 morreu por leitura de texto não
prova nada: o `CREATE OR REPLACE` aplica verde com a função tão quebrada quanto
antes, porque o plpgsql só resolve a expressão na primeira execução.

**`montar_fechamento` não é read-only** — ela dá UPDATE em `public.cobrancas`. Um
portão com data-base do mês corrente **re-arquivaria a produção inteira** dentro
de um fechamento de teste. Por isso todas as janelas são de **1900**, o portão
**afirma** que recolheu exatamente 1 linha (provando que não pegou mais nada), e
o pré-voo **aborta** se já existir qualquer linha anterior a 1990.

**E ele personifica, senão fica verde POR CAUSA do defeito.** As duas funções
começam por `pode_ver_financeiro(auth.uid())`, e no SQL Editor não há JWT:
`auth.uid()` é NULL e a chamada morreria em **42501 antes** de tocar nas linhas
ambíguas. Um portão que só verificasse "não levantou 42702" passaria com a função
intacta no defeito. A personificação é feita com `set_config(..., true)` e
**conferida** — se não pegar, a migration aborta em vez de "pular" as provas. A
saída da U87 (curto-circuito no gate) não servia: o gate da U5 é contrato vivo e
não se afrouxa uma trava de papel para o teste rodar.

**Sete provas:** montar de verdade (o INSERT do upsert), montar de novo (o ramo
`DO UPDATE`, que é a única prova de que o `ON CONFLICT` não é ambíguo), o P19
pelos **dois lados** (a avulsa sobrevive **e** o rascunho continua sendo apagado
e reprecificado por 200,00 em vez do 1998,00 velho), o buraco que a S4 anunciou
(avulsa viva e zero peças → `aprovada`, e o evento **não** diz "nada a cobrar"),
o **par negativo** (chamado sem nada continua virando `sem_cobranca` com a frase
exata — sem ele, apagar o carimbo deixaria as outras provas verdes), e a
composição.

### As réguas, e a cicatriz que as impôs

**A U80 §4b reescreveu `aprovar_chamado_financeiro` a partir do corpo ERRADO** —
copiou a U7 em vez da U13 viva — e teria revertido em silêncio o gate de papel,
os nomes de coluna, a trava de status e o `sem_cobranca`. A asserção que
guardava a promessa checava **presença** de três coisas, e **presença nunca
detecta deleção**.

As duas asserções centrais desta entrega são **DIFFs**: o corpo novo tem de ser
igual ao corpo **vivo** (a S4 para uma, a U5 para a outra) com as mudanças
**escritas à mão** no verificador, e nada mais. Cada âncora do diff **conta** —
uma troca que não casa viraria no-op silencioso e faria o "esperado" ser o corpo
antigo. E o pré-voo confere os literais contra `pg_proc.prosrc`, no **banco**: o
repositório é evidência do que foi escrito, não do que foi aplicado.

**O censo passou a modelar VITALIDADE.** O repositório nunca edita migration
aplicada, então o corpo quebrado da U5 fica no arquivo para sempre. Sem o filtro,
o censo mediria texto morto e nunca mais poderia ficar vazio — ou seria "ajustado
à mão", que é pior. Agora há **três** asserções: o censo vivo (vazio), o censo
**bruto** (que ainda acusa o cadáver da U5, provando que o detector não emudeceu)
e a premissa do filtro (a U88 é a última a definir a função). O par negativo do
filtro é constante escrita à mão. **Alcance declarado:** ele não modela
`DROP FUNCTION` — hoje isso não produz falso negativo, e vira dívida no dia em
que produzir.

### Bateria de mutação

14 mutações, cada uma provando que atingiu o alvo (conta a âncora): **14 pegas.**
Duas escaparam na primeira rodada e as duas eram a **mesma** classe — asserção
casando a MENSAGEM do `RAISE` enquanto a mutação desligava o `IF` (`IF false
THEN`). Regra 2 em estado puro: regex não vê guarda desligada. As asserções
foram reescritas para casar a **condição**, e mais três guardas do pré-voo e do
portão foram endurecidas do mesmo jeito antes de alguém pedir.

Os três detectores de sintaxe também foram exercitados contra este arquivo: o
delimitador de dollar-quote em comentário de bloco vivo (pego, nas duas formas),
o `CASE` nu em condição de `IF` (pego) e o de **42702** (pego, tanto por
desqualificar uma referência quanto por trocar o conserto pela diretiva).

### O que NÃO entrou, e por quê

**`marcar_chamado_faturado` fica como está**, e a decisão foi para o CATÁLOGO
(`COMMENT ON FUNCTION`), não só para um comentário de arquivo. Ela tem a mesma
forma incondicional, mas **não é destrutiva** — muda status, não apaga linha — e
varrer tudo é o comportamento desejado: um avulso vinculado que ficasse "aberta"
depois de o chamado ser faturado seria dinheiro esquecido, o defeito oposto e
pior. Sem essa linha escrita, ficaria a assimetria não declarada de o DELETE
distinguir origem e o UPDATE não.

**Não se acrescentou `AND fechamento_id IS NULL` ao DELETE.** Isso trocaria uma
corrupção silenciosa por um 23505 duro na reaprovação de um chamado cujo período
já foi montado — talvez seja o certo, e é **decisão de produto**, não conserto de
defeito. Fica como P55.

**Não se reescreveu `concluir_chamado_com_cobranca`.** A disjunção dela é de mão
única, e a trava certa para esse par é no motor de aprovação — uma segunda recusa
na outra porta cobriria metade do par.

### Números

`node scripts/verificar-logica.cjs` → **2530 passaram, 0 falharam** (eram 2500).
`npx vite build` → completa. `npx tsc --noEmit` → **59**, o baseline, sem erro
novo. **O repositório NUNCA aplica migration: o Davi roda à mão.**


### A PRIMEIRA EXECUÇÃO ABORTOU, E O ERRO FOI MEU (03/09)

O Davi rodou, e o banco devolveu:

```
ERROR: 42702: column reference "referencia" is ambiguous
DETAIL: It could refer to either a PL/pgSQL variable or a table column.
QUERY: INSERT INTO public.fechamentos (tipo, referencia, inicio, fim, created_by)
```

**Um terceiro 42702 na mesma função** — e num lugar que este arquivo afirmava,
por escrito e com ênfase, ser imune.

#### O que a versão anterior dizia, e por que era pior que um erro comum

O cabeçalho tinha um parágrafo inteiro sob "O QUE ESTA MIGRATION **NÃO** FAZ"
explicando que `ON CONFLICT (tipo, referencia)` não pode levantar 42702, porque
*"a lista de inferência de índice do ON CONFLICT NÃO É EXPRESSÃO: o parser
guarda o nome em `IndexElem.name` e o resolve direto contra a relação alvo, sem
passar pelo hook de variável do plpgsql"*. E o parágrafo ainda instruía o
próximo leitor a **não** mexer ali.

Três coisas erradas de uma vez:

1. **O mecanismo é o oposto.** Em `resolve_unique_index_expr`, um elemento de
   inferência que é nome simples é embrulhado num `ColumnRef` construído na hora
   e passado por `transformExpr` — que é exatamente onde o plpgsql injeta a
   resolução de variável. A lista **passa** pelo hook.
2. **A citação de `IndexElem.name` dava peso de fonte a uma frase inventada.**
   Detalhe interno preciso é o que faz um argumento errado parecer verificado.
3. **O detector da U86 TINHA ACUSADO essa linha** — `montar_fechamento ::
   referencia x1` — e este arquivo a listou entre "QUATRO FALSOS POSITIVOS
   FICAM REGISTRADOS PARA NINGUÉM CONSERTÁ-LOS". A ferramenta apontou o defeito
   que derrubou a execução, e o cabeçalho a anulou.

O terceiro é o caro. Um detector sem argumento ao lado faz alguém ir olhar; um
detector com um argumento errado ao lado faz todo mundo **parar** de olhar.

**A regra que fica: ferramenta que acusa só é absolvida por PROVA EXECUTADA,
nunca por raciocínio sobre o interior do motor. Sem execução possível, a
acusação vira dívida declarada — não absolvição.**

#### O portão fez exatamente o que tinha de fazer

O 42702 estourou na PROVA 1, dentro da transação, e **nada foi commitado**. O
banco do Davi ficou idêntico ao que era. O cabeçalho antigo terminava aquele
mesmo parágrafo com *"se o ON CONFLICT fosse ambíguo, esta migration ABORTA e
nada é commitado"* — essa parte estava certa, e foi ela que segurou o estrago.

Vale reter o contraste: **um portão que lesse o texto das funções teria dado
COMMIT com a função tão quebrada quanto antes**, porque o plpgsql só resolve a
expressão na primeira EXECUÇÃO daquela instrução. Foi o portão que chamou a
função de verdade — duas vezes, de propósito — que descobriu.

#### O conserto: eliminar a referência, não qualificá-la

Depois de errar sobre o parser, o conserto não podia depender de acertar sobre o
parser na segunda tentativa. Então nada foi qualificado:

- **§3a** promove o índice `fechamentos_unico` (u5:60) a **constraint de mesmo
  nome**, com `ADD CONSTRAINT … UNIQUE USING INDEX`, que **adota** o índice
  existente em vez de construir outro;
- o upsert passa a dizer `ON CONFLICT ON CONSTRAINT fechamentos_unico`. Ali não
  há `ColumnRef` nenhum — é um identificador procurado em `pg_constraint`. A
  ambiguidade fica **inexprimível**, e não apenas evitada, que é o critério que
  a U87 estabeleceu.

**A lista de colunas-alvo do INSERT continua citando `referencia`, e está
certa assim**: ela é resolvida por `checkInsertTargets` contra a relação alvo,
sem passar pelo transformador de expressões. Foi por eliminação que o culpado
ficou identificado — e o arquivo agora avisa, na própria linha, para ninguém
"consertar por simetria".

**Três saídas recusadas:** `ON CONFLICT (tipo, (fechamentos.referencia))`
(talvez funcione, e "talvez" é o que não serve aqui); `#variable_conflict
use_column` (isenta a função do detector da U86 para sempre — troca conserto por
cegueira); renomear o parâmetro OUT (é contrato com `fechamentos.ts:95`, lido
por `as any`, e o tsc não acusaria).

#### O censo que faltava

Se a afirmação estava errada, ela podia estar protegendo **outras** funções
mortas do mesmo jeito. Varredura das 108 migrations, **89 funções plpgsql**,
cruzando as colunas citadas como nome simples em lista de inferência de
`ON CONFLICT` contra os nomes de variável em escopo (parâmetro, OUT de
`RETURNS TABLE`, `DECLARE`): **acusada exatamente uma**, `montar_fechamento ::
referencia`. Não há segunda.

O censo virou asserção permanente, medida sobre a **definição viva** de cada
função — a primeira versão dela media todo o texto do repositório e acusava a
própria u5, que é o arquivo histórico que esta migration substitui. Censo que
acusa o passado para sempre é censo que se aprende a ignorar.

#### E a bateria de mutação mordeu a regra 2 outra vez

A asserção nova do §3a prendia a **frase** das mensagens de aborto. A mutação
trocou `IF NOT v_uniq THEN` por `IF false THEN` — guarda desligada, frase
intacta, verificador **verde**. É a regra 2 do diário, escrita por mim, aplicada
contra mim: *presença nunca detecta uma guarda DESLIGADA; prenda o `IF`, não o
vocabulário.* Corrigido, mais o `esperado` da conferência 114, que passou a ser
**derivado** das colunas do índice da U5 em vez de digitado.

### A SEGUNDA EXECUÇÃO CHEGOU ATÉ A ÚLTIMA LINHA (03/09)

```
ERROR: 42725: operator is not unique: "char" || unknown
LINE 1345: (SELECT c.contype || ' / ' || i.relname || ' / ' ||
HINT: Could not choose a best candidate operator.
```

A linha 1345 é a **conferência 114** — a última do arquivo, escrita na rodada
anterior justamente para provar o conserto do ON CONFLICT.

#### O que este aborto PROVA, e é muita coisa

O erro está no SELECT final. Tudo que vem antes dele **rodou**:

- o pré-voo aceitou o terreno;
- as duas funções foram reescritas;
- o **§3a promoveu o índice a constraint** — `ADD CONSTRAINT … UNIQUE USING
  INDEX` funcionou;
- **`montar_fechamento` RODOU**: o `ON CONFLICT ON CONSTRAINT` resolveu o 42702
  da rodada anterior, e as provas 1 e 1b (ramo do INSERT e ramo do DO UPDATE)
  passaram;
- **as sete provas do PORTÃO passaram**, inclusive a 5, que é a composição dos
  dois consertos: o dinheiro não sumiu de dentro de um fechamento montado;
- a limpeza do portão devolveu a base ao estado de antes.

Ou seja: **a entrega funciona. O que estava quebrado era o relatório dela.**
E, de novo, a transação inteira voltou — o banco ficou idêntico.

#### O defeito

`pg_constraint.contype` é do tipo interno `"char"` (um byte). Concatená-lo com
um literal deixa o Postgres com mais de um caminho de conversão possível, e ele
se recusa a escolher. Erro de **tipo**, não de sintaxe nem de resolução de nome
— e nenhum dos checadores que existiam enxerga tipo.

Corrigido com `::text` em cada operando. E a 114 deixou de comparar
`pg_get_constraintdef`: o deparse é uma RENDERIZAÇÃO que muda entre versões do
Postgres (`NULLS DISTINCT` entrou na 15), e comparar a string bruta diria
`>>> OLHAR <<<` numa execução perfeita — é a lição da conferência 203 da U87.
As colunas agora saem de `conkey`, com `WITH ORDINALITY` para preservar a ordem.

#### Dois detectores novos, e um deles calibrado por EXECUÇÃO

**A) Coluna de catálogo do tipo `"char"` concatenada sem `::text`.** Varredura
das 108 migrations: zero, depois do conserto. Provado por mutação — tirar o
`::text` da 114 deixa a asserção vermelha.

**B) `RAISE` com mais marcadores `%` do que argumentos** ("too few parameters
specified for RAISE"), que também só aparece em execução e, numa migration,
estoura depois de metade do trabalho feito. Zero.

O detector A nasceu ESTRITO, acusando `name` além de `"char"` — e apontou três
linhas da **U87**: `c.conname || '='`, `a.attname || '='`, `i.relname || '='`.
Mas a U87 **rodou no banco do Davi** com as 19 conferências `ok`, essas três
incluídas. Logo `name || unknown` resolve e `"char" || unknown` não.

**A lista de tipos perigosos foi calibrada por duas execuções reais, e não pelo
meu raciocínio sobre o motor.** Depois de errar duas vezes seguidas raciocinando
sobre o parser sem poder executar, é a única calibragem que vale.


### Números, depois das três rodadas

`node scripts/verificar-logica.cjs` → **2595 passaram, 0 falharam**.
`npx vite build` → completa. `npx tsc --noEmit` → **59**, o baseline.
**Bateria de mutação: 9 mortas, 0 sobreviventes, 0 inválidas.**

Os **seis** checadores estáticos, todos limpos: dollar-quote dentro de bloco
vivo; `CASE` nu dentro de `IF`; 42702 por parâmetro OUT de `RETURNS TABLE`;
42702 por lista de inferência do `ON CONFLICT` (nasceu na rodada 2); 42725 por
coluna `"char"` concatenada sem `::text` (nasceu na rodada 3); e `RAISE` com
mais `%` do que argumentos (idem).

**Nenhum arquivo de `src/` mudou em nenhuma das três rodadas — o "zero push"
continua de pé.**

**O placar honesto desta entrega: três tentativas, e as duas primeiras caíram
por erro meu.** A primeira num mecanismo do parser que eu afirmei sem poder
verificar, contra um detector que já tinha acusado a linha certa. A segunda num
tipo de catálogo, dentro do SELECT que eu tinha escrito para provar o conserto
da primeira. As duas abortaram inteiras, sem tocar no banco — que é o que o
desenho promete e cumpriu. E as duas viraram detector.

---

## U89 — A implantação ganha período, e sai do SLA que nunca foi dela (R120 — Fase 4, passo 1 de 2)

**Arquivos:** `supabase/migrations/20260911090000_u89_implantacao_com_periodo.sql`,
`src/features/implantacao/{modelo,data,pdf}.ts`,
`src/features/implantacao/CronogramaObra.tsx`,
`src/features/chamados/DetalheCampo.tsx` (duas linhas: o import e o card),
`scripts/verificar-logica.cjs`, `docs/PRODUTO.md` (R120),
`docs/manual/operacao-campo.md`.

**Ordem de deploy: MIGRATION PRIMEIRO, PUSH DEPOIS.** O código nomeia a tabela
`implantacao_cronograma` e as duas colunas novas. Mas o estrago de inverter a
ordem foi **desenhado para ficar contido** — ver "a consulta própria", abaixo.

### O achado: toda implantação nascia atrasada, em produção

Isto não era funcionalidade faltando. Era defeito **vivo**, encontrado enquanto
se levantava a Fase 4.

`chamado_preencher()` (u7:301-306) aplica o SLA a todo chamado de campo, sem
exceção de tipo. `chamado_sla` diz, desde etapa3:30-35: urgente 4h, alta 24h,
**normal 72h**, baixa NULL. Uma implantação `normal` recebia prazo de 72 horas
contadas da abertura e, do quarto dia em diante, era "estourada".

O estrago não ficava na cor do card:

- entrava no KPI "Prazo estourado" (`indicadores.ts:145`) e no total de
  `atrasados` (linha 217) — o número que responde "a operação está em dia?";
- caía na coluna "Atrasados" do painel (linha 348), onde ficava para sempre;
- e, ao concluir, contava como **descumprimento permanente** em `pctNoPrazo`
  (linhas 168-170, 226), porque lá o filtro é `finalizada_em && prazo_limite` e
  a obra tem os dois.

O repositório já sabia que implantação é outra coisa — u7:310 decide
`tipo_servico := 'instalacao'` só para ela. O SLA não foi avisado.

### A correção é um ESPELHO, e a escolha foi econômica

Duas saídas: **isentar** (prazo sempre NULL) ou **espelhar** (o prazo da obra é
o fim previsto do período). Isentar era mais barato e mentiria por omissão —
uma obra 40 dias atrasada apareceria como "sem prazo".

Com o espelho, **as sete máquinas de prazo que já existem passam a funcionar
para obra sem que nenhuma delas mude uma linha**: KPI, coluna, `pctNoPrazo`,
alerta de véspera de `alertas_chamados()` (u7:876), cor do card, ordenação da
R66. Nenhuma sabe que implantação existe, e nenhuma precisa saber.

A isenção sobrevive dentro do espelho como o caso de borda certo: obra **sem**
período fica sem prazo, e aí "sem prazo" é a verdade.

### A armadilha que teria matado a entrega em silêncio

**Todo gatilho de UPDATE em `public.chamados` é `UPDATE OF <colunas>`** — e o
`trg_chamado_preencher_upd` (u7:349) escutava `status, prioridade` **apenas**.

Escrever `implantacao_fim` **não acordaria o gatilho**. A função estaria
perfeita, a coluna populada, o cronograma na tela — e `prazo_limite`
continuaria NULL para sempre. Verde em toda leitura, morto em execução. O §4
recria o gatilho com a coluna na lista, e a conferência 304 lê a **lista do
gatilho vivo**, não a existência dele.

**O mesmo fato paga um dividendo:** como nenhum gatilho escuta `prazo_limite`,
o UPDATE de limpeza do §5 não acorda nada — nem o sino, nem a linha do tempo,
nem o apoio, nem o espelho da agenda, nem a ficha de compra. **Não há
`DISABLE TRIGGER` nesta migration**, e não é coragem: é a lista de colunas.
Um censo no verificador varre as 108 migrations e prende esse fato, porque o
gatilho que alguém criar amanhã sem cláusula `OF` torna a dispensa falsa — e o
sintoma seria o sino de todo mundo tocando numa carga que ninguém associou à
causa.

### A sexta colisão de vocabulário, evitada por uma palavra

O plano chamava as quatro divisões de "etapas". A palavra já está ocupada:
`chamado_fotos.etapa` com CHECK `('antes','depois','outra')` (etapa3:203,
213-214, renomeada pela u7:572), mais dois `RETURNS TABLE (etapa text, …)`
(u8:180, s1:247). "Etapa" ali significa **momento da foto**.

A coluna chama-se `fase`, e a palavra foi verificada **livre** — zero
ocorrências como coluna, como CHECK e como campo de TypeScript. Foi a colisão
mais barata de evitar que este projeto já teve. As anteriores: "equipe"
(departamento × turma de campo), "modalidade" (natureza do contrato × tipo da
atividade), "visita técnica" (resolvida na U83 criando `vistoria`) e
"operacional" (aba × tipo de chamado).

### A consulta própria — ordem de deploy resolvida por desenho

`features/chamados/data.ts` monta o SELECT **nomeando cada coluna à mão**
(`CAMPOS`, linha 76). Acrescentar `implantacao_inicio, implantacao_fim` ali
amarraria o sistema inteiro a esta migration: enquanto ela não rodasse, o
PostgREST devolveria **42703 para a consulta toda** — que é o detalhe do
chamado, a lista, a Início e o painel. Uma coluna inexistente derrubaria telas
que nada têm a ver com obra.

O período é lido por `usePeriodoDaObra`, consulta própria do card. A mesma
falha fica **contida**: o card mostra o erro e o resto do app continua de pé.
É a regra 6 do diário aplicada pelo lado do desenho — ordem de deploy é
propriedade do código, e código que limita o próprio estrago não depende de
ninguém lembrar da ordem.

### O que as lentes acharam, e não era o conserto

**O PORTÃO queimaria dois números de OS, para sempre.**
`proximo_numero_chamado()` **não é sequência**: faz
`INSERT … ON CONFLICT DO UPDATE SET ultimo = ultimo + 1` em
`chamado_contadores` (u7:228-230). Os dois chamados de teste do portão avançam
o contador duas vezes, o DELETE do fim os apaga — e o **COMMIT persiste o
incremento**. As duas próximas OS de verdade nasceriam com um buraco na
numeração (CH-2026-0247 pulando para CH-2026-0250), e número de OS é o que a
operação lê em voz alta no telefone. Pior: o `ON CONFLICT DO UPDATE` **tranca a
linha do ano até o COMMIT**, então enquanto a migration rodasse ninguém
conseguiria abrir chamado.

O conserto foi por **subtração**: o portão escreve `numero` à mão, e
`chamado_preencher` só chama o contador quando o número chega vazio. Zero
maquinaria de restauração. O passo 8 do portão confere que o contador não
andou.

**Uma medição morta.** O portão capturava a contagem de notificações antes e
depois e **nunca comparava** — parecia verificação e não era. Agora o gesto
medido é o do §5 (prazo\_limite sozinho, com valor real, não NULL sobre NULL) e
a diferença é afirmada.

**Uma conferência que ficaria verde por nada.** A 303 usava `position`, que
acha a primeira ocorrência e para. A isenção precisa existir **duas** vezes —
INSERT e UPDATE —, e uma migration que esquecesse a segunda passaria verde
enquanto o defeito voltava pelo caminho que ninguém olhou. Agora ela **conta**.

**Um DELETE largo demais.** A limpeza do portão apagava notificações por janela
de tempo (`created_at >= now() - interval '1 minute'`), o que levaria junto
notificação de gente de verdade que chegasse no mesmo minuto. Agora é pelos
dois ids.

**Uma afirmação falsa num comentário.** O corte de semana em `semanasDoMes`
usa "o dia da semana andou para trás", e o comentário dizia que `=== 0`
quebraria quando o período começasse num domingo. **Não quebraria** — a guarda
`anterior >= 0` já cobre o primeiro dia, e para dias consecutivos as duas
condições são idênticas. A bateria de mutação trocou uma pela outra e o
verificador ficou verde, como tinha de ficar. O comentário foi corrigido para
dizer a verdade (a diferença só aparece com entrada **não** consecutiva, e é
por isso que `<= anterior` é a escolha certa para uma função exportada), e uma
asserção com mês montado à mão passou a exercitar esse caso.

**Quatro números meus errados nas asserções.** As expectativas de dias úteis
foram escritas à mão e três delas estavam erradas — novembro/2026 tem **três**
feriados nacionais (Finados, Proclamação, Consciência Negra) e eu contei como
se tivesse um. O módulo estava certo; as asserções é que mentiam. Ficaram
corrigidas e a origem de cada número está anotada.

### Verificação

`2580 verificações passaram, 0 falharam` · `npx vite build` completa ·
`npx tsc --noEmit` em **59** (baseline mantido) · os três checadores de sintaxe
plpgsql limpos (dollar-quote, `CASE` nu em `IF`, ambiguidade 42702) ·
**bateria de mutação: 12 mortas, 0 sobreviventes, 0 inválidas**.

---

## U90 — A conferência decide a cobrança (R121 — Fase 4, passo 2 e último)

**Arquivos:** `src/features/chamados/DetalheCampo.tsx`,
`scripts/verificar-logica.cjs`, `docs/PRODUTO.md` (R121),
`docs/manual/operacao-campo.md`, `docs/PLANO_UNIFICACAO.md`.
**NENHUMA MIGRATION.** A porta que faltava já existia desde a U80 — o que
faltava era chamá-la de onde o chamado é fechado.

### O levantamento mudou o que esta fase era

O plano dizia: *"Cobrança disparada na conclusão: parcelada (usa `parcelar()`
que já existe) ou como acréscimo mensal ao contrato — soma no `valor_mensal` de
`cliente_contratos` dali em diante. Vínculo trava lançamento duplicado."*

Três itens, três vereditos medidos:

| Item do plano | Veredito |
|---|---|
| Parcelada, usando `parcelar()` | **Já existia** — U80, modo `lancar` |
| Vínculo trava lançamento duplicado | **Já existia**, em duas camadas |
| Acréscimo mensal ao `valor_mensal` | **Não pode funcionar** |

**A parcelada já estava pronta.** `concluir_chamado_com_cobranca` recebe as
parcelas, confere que a soma fecha, aplica o teto (60 instalação / 12
manutenção) e insere uma cobrança por mês — com a aritmética de mês feita em
SQL, porque `d.setMonth(d.getMonth() + 1)` sobre 31/01 cai em **março** e a
competência de fevereiro fica sem linha.

**A trava também.** A recusa `já tem N lançamento(s), não lanço em cima` mais o
índice único parcial `cobrancas_avulsa_unica_por_chamado_idx`.

### O acréscimo mensal não cobraria nada, e isso é um achado

`valor_mensal` aparece em **cinco lugares** do `src/`, e os cinco são exibição
ou edição: o card do cliente, a lista de contratos, a tela do contrato, a
criação e o tipo. **Nenhum fatura a partir dele.**

E não existe geração recorrente: varredura de `INSERT INTO public.cobrancas` em
todas as migrations — todos vêm de um gesto humano explícito (aprovação da
conferência, conclusão com lançamento, avulso pela tela de fechamentos). Não há
`pg_cron`, não há job.

Somar R$ 300 no `valor_mensal` produziria **zero cobranças, para sempre** — e
sobrescreveria o valor que veio do PDF do contrato, num campo sem histórico que
a extração por IA pode reescrever por cima depois. Seria uma tela que parece
cuidar do dinheiro e não cobra nada.

**Decisão do Davi (03/09): "Parcelar, e só."** O acréscimo permanente sai do
plano. Ele só passa a significar dinheiro quando existir um motor de mensalidade
recorrente, e isso é entrega própria — não um passo desta fase. Fica registrado
em R121 com o motivo, para ninguém o repropor lendo o plano velho.

### O buraco que sobrou, e esse era meu

`concluirChamado` — o que o botão *Conferir e fechar* chamava — é um UPDATE
puro: status (que já era `concluido` desde `executarChamado`), os carimbos e
`fechado_por`. **Ele não tocava em `faturamento_status`.**

E a caixa de conferência só aparece enquanto `faturamento_status = 'a_analisar'`.
Logo **o botão não fechava nada**: o chamado ficava na fila até alguém agir pelo
cartão de cobrança. Quem encerrasse pela página do chamado nunca era perguntado
sobre o dinheiro.

**Decisão do Davi: corrigir para TODO chamado de campo**, e não só implantação.

### O que foi feito, e o que NÃO foi tocado

O `fechar` passa a rotear: **campo → a RPC que decide; qualquer outra natureza →
`concluirChamado`, como antes.**

**Essa guarda é a lição da U82, e ela já custou caro uma vez.**
`chamados/$id.tsx:37` manda tudo que não é `interno` para o `DetalheCampo`,
COMERCIAL incluído — e a U82 tornou chamado comercial impossível de encerrar por
exatamente este caminho. A RPC é de ciclo de campo (tipo de serviço, parcelas,
competência); o comercial continua pelo caminho antigo.

**O técnico não é afetado**: o botão dele é `executarChamado`, outro gesto. **O
SAC não é afetado**: ele é gestor (`is_gestor` inclui `sac`, desde a U6a) e passa
o gate da porta, mas não vê valores (R13) — para ele a seção de dinheiro não
existe e o botão dispara `conferir_depois`, que é a mesma escrita de antes.

**A conta é importada, não recriada.** `parcelar` e `erroDoLancamento` vêm dos
mesmos módulos que o painel da programação usa. O que se repete é só o JSX.

### O que as lentes e a mutação acharam

**A condição que decide LANÇAR estava escrita DUAS vezes** — uma no `onClick`,
outra no rótulo do botão. Se uma ganhasse um termo que a outra não ganhasse, o
botão anunciaria *"Conferir e fechar"* e lançaria uma cobrança. Consertado por
construção: um `const vaiLancar`, usado nos dois lugares. A divergência ficou
inexprimível em vez de vigiada.

**E a bateria pegou a asserção mais importante em falso.** A que guarda a lição
da U82 procurava a string `os?.natureza === "campo"` em qualquer lugar do
arquivo — e ela também aparece em `podeDecidirValor`. A mutação trocou o `if` do
roteamento por `if (true)`, o comercial passou a ir para a RPC de ciclo de campo,
**e o verificador ficou verde**. A âncora foi reescrita para prender o `if`
JUNTO com a chamada que ele guarda. É a regra 1 do diário — *a mutação tem de
provar que atingiu o alvo* —, e foi a terceira vez nesta semana que o alvo era o
ramo e a âncora pegou o vocabulário.

### Números

`node scripts/verificar-logica.cjs` → **2604 passaram, 0 falharam**.
`npx vite build` → completa. `npx tsc --noEmit` → **59**, o baseline.
**Bateria de mutação: 8 mortas, 0 sobreviventes, 0 inválidas.**
Sem migration: nada a rodar à mão, e o push publica.

---

## U91 — O painel do plantão (R122 — Fase 5, primeira metade)

**Arquivos:** `src/features/plantao/painel.ts` (novo, puro),
`src/features/plantao/PainelDoPlantao.tsx` (novo),
`src/features/plantao/data.ts` (uma consulta),
`src/routes/_authenticated/sobreaviso.tsx` (duas linhas),
`scripts/verificar-logica.cjs`, `docs/PRODUTO.md` (R122),
`docs/manual/operacao-campo.md`.
**NENHUMA MIGRATION** e nenhuma permissão nova: as duas tabelas existem (U86 e
U87) e a tela já é de gestor.

### O levantamento, de novo, mudou o alvo

A Fase 5 pede "dashboards de atendimento e plantão". Medido antes de escrever:
o **painel de atendimento já existe** — `painel.operacional.tsx` tem os quatro
KPIs, rankings em barra deitada, linha e rosca, tudo saindo de
`features/paineis/indicadores.ts`.

O que **não existia em lugar nenhum** era o plantão num painel: zero ocorrências
de `atendimentos_plantao` em qualquer rota de painel. A entrega é essa metade.

### Onde ele mora, e por que não é tela nova

Na tela do **sobreaviso**, embaixo da grade. A escala é o plano e o atendimento
é o registro; separá-los obrigaria a comparar de memória. As colunas de dia são
as mesmas dos dois lados — o mesmo `diasDoMes` gera a grade e a série —, e por
isso dá para ler "teve chamada num dia que estava descoberto" sem sair do lugar.

Rota nova exigiria chave em `permissoes_tela`, migration e uma decisão de
acesso. Nada disso é necessário para responder a pergunta.

### O que ele NÃO reinventa

A pergunta "esta pessoa estava na escala?" já tinha resposta, e ela tem **três**
estados: `avisoDaEscala` distingue `ok`, `fora` e `sem_escala`, com a razão
escrita na U87 — colapsar os dois últimos acusaria o plantonista de furar uma
escala que ninguém lançou.

O painel **chama aquela função e conta os vereditos dela**. Um contador próprio
seria a segunda resposta para a mesma pergunta, e as duas discordariam no dia em
que a doutrina mudasse num lugar só.

As faixas do dia também não são números novos: 8 e 18 são as bordas do
expediente que o sobreaviso já declara (`HORAS_EXPEDIENTE`, `HORAS_MADRUGADA`).

### A divergência deliberada com `horaCurta`

`horaCurta` formata no fuso **do aparelho**, e está certa: a lista é lida pelo
próprio plantonista, no mesmo aparelho em que digitou, e fuso fixo faria a lista
e o campo de edição mostrarem horas diferentes no mesmo cartão.

Um painel **classifica**, e a classificação não pode depender de onde está quem
abriu a tela. `horaEmSaoPaulo` lê `America/Sao_Paulo`, o mesmo fuso em que o
gatilho projeta o `dia`. A divergência está escrita nos dois arquivos, para não
ser "unificada" depois por quem só vir as duas funções lado a lado.

### O que a bateria de mutação achou — três sobreviventes, três lições

**1. O fuso não podia ser testado por valor.** Removi
`timeZone: "America/Sao_Paulo"` e **tudo ficou verde**: o verificador roda na
máquina do Davi, que ESTÁ em São Paulo. Nenhum teste de valor pega isso aqui —
o ambiente é o próprio fuso. O alvo passou a ser preso no TEXTO, que é o que
existe, com a limitação escrita ao lado da asserção.

**2. O colapso dos três estados sobreviveu ao censo inteiro.** A lei de
conservação (`naEscala + fora + semEscala === total`) **não pega** o colapso:
com `semEscala` sempre zero e `fora` absorvendo, a soma continua fechando. Leis
de conservação cobrem classes, e esta classe passa por baixo delas. Precisou de
uma asserção de contagem POR ESTADO, com fixture dos três.

**3. Um mutante equivalente.** Trocar o `: null` de `horaEmSaoPaulo` por `0` não
quebrou nada — `formatToParts` sempre devolve dígitos, e o ramo é inalcançável.
Não é buraco de teste: é guarda defensiva. Ficou no código com a razão escrita
(se um dia chegar, `0` viraria meia-noite e o painel inventaria um horário), e a
mutação saiu da bateria com o motivo anotado.

### O censo

60 conjuntos, e em cada um: as quatro partições de KPI fecham exatas (tipo,
chamado, faixa, escala), a série cobre os 31 dias sem perder nem duplicar
atendimento, os rankings somam o total, e **a ordem não muda quando a entrada é
embaralhada**.

### Números

`node scripts/verificar-logica.cjs` → **2624 passaram, 0 falharam**.
`npx vite build` → completa. `npx tsc --noEmit` → **59**, o baseline.
**Bateria de mutação: 11 mortas, 0 sobreviventes.**

---

## U92 — O corte por tipo e o plantão na ficha (R123 — Fase 5 fechada)

**Arquivos:** `src/features/paineis/indicadores.ts` (uma função pura),
`src/routes/_authenticated/painel.operacional.tsx`,
`src/routes/_authenticated/clientes.$id.tsx`,
`src/features/plantao/data.ts` (uma consulta), `scripts/verificar-logica.cjs`,
`docs/PRODUTO.md` (R123), `docs/manual/operacao-campo.md`.
**Sem migration.**

### O que a medição encontrou

Restavam dois itens da Fase 5 no plano: "rankings por cliente / modalidade" e
"busca por cliente com histórico completo". Medidos antes de escrever:

| Item | Estado |
|---|---|
| Ranking por cliente | **Já existia** — "Abertos por cliente", painel operacional |
| Busca de cliente | **Já existia** — `clientes.tsx`, com filtro e paginação |
| Histórico do cliente | Existia, mas **sem o plantão** |
| Ranking por modalidade | **Não existia** — a rosca mostra "Fila por status" |

Dois buracos pequenos, os dois reais.

### "Modalidade" não entra na interface

O plano pede "por modalidade", e a palavra é armadilha:
`cliente_contratos.modalidade` já é locação/manutenção/comodato/venda. A decisão
da Fase 1 fechou essa colisão dizendo que a modalidade da atividade **é o
`chamados.tipo`**. O rótulo da tela diz **tipo**, e uma asserção prende a
ausência da outra palavra — trazê-la de volta reabriria a colisão em silêncio.

### Por que não nasceu painel novo

As duas faixas do dashboard têm altura contratada (`ALTURA`, `ALTURA_DUPLA`), e
o verificador trava a conta que faz a lista abrir acima da metade da tela. Um
quarto card na faixa 1 quebraria isso na primeira largura intermediária.

A rosca já respondia exatamente esta pergunta — "como a fila EM ABERTO se
divide" — só que por um eixo. Dar-lhe o segundo custou dois botões e **zero
pixel de layout**. E os dois cortes saem de `abertosDeCampo`, a mesma base dos
KPIs: o número no miolo da rosca não muda quando o eixo muda, e a asserção de
conservação prende isso em 40 conjuntos.

### O plantão que sumira do histórico

A ficha do cliente mostrava contratos, chamados e visitas. `atendimentos_plantao`
nasceu na U87 com `cliente_id` e **nunca chegou lá**: zero ocorrências de
"plantão" no arquivo inteiro. Um cliente atendido às 3h da manhã não tinha esse
fato na própria ficha.

**Duas decisões de recorte, as duas para não mentir:**

1. **Fechada por `isGerente`.** A policy é "dono OU gestor". Aberta, a seção
   mostraria ao técnico só os atendimentos DELE com cara de histórico inteiro
   do cliente — lista parcial disfarçada de completa é pior que seção ausente.
   É o mesmo desenho de Contratos, fechado por quem enxerga valores.
2. **Só o cliente cadastrado.** `cliente_informado` é texto livre; casar por
   nome traria o atendimento de uma padaria homônima para a ficha de outra.
   Mostrar o histórico do vizinho é pior que mostrar de menos.

E os três estados de leitura de novo separados — erro, carregando, vazio —, com
o erro avaliado ANTES do vazio. É a lição da U86, agora presa por asserção de
POSIÇÃO e não de presença.

### Números

`node scripts/verificar-logica.cjs` → **2636 passaram, 0 falharam**.
`npx vite build` → completa. `npx tsc --noEmit` → **59**, o baseline.
**Bateria de mutação: 8 mortas, 0 sobreviventes.**

Com isto a **Fase 5 está fechada**. Resta a Fase 2 pela metade (a estimativa de
rota espera a `ORS_API_KEY`) e a Fase 6 (migração do Gestor OS com data de
corte), que depende do export do Vinicius.

## U93 — O contexto do Davi, o plano da v0.1, e a Operacional Técnica do Vinicius (R124–R130)

**Arquivos:** `docs/CONTEXTO_OPERACAO_TECNICA.md` (novo), `docs/PLANO_V0.1.md`
(novo), `docs/PRODUTO.md` (R124–R130 + nota no §6), `CLAUDE.md` (mapa),
`docs/manual/operacao-campo.md`, `src/features/paineis/indicadores.ts`,
`src/features/implantacao/modelo.ts`, `src/features/implantacao/data.ts`,
`src/features/chamados/cobranca.ts`, `src/features/chamados/abertura.ts` (novo),
`src/features/chamados/FormularioChamadoTecnico.tsx` (novo, extraído),
`src/features/chamados/NovoChamadoTecnicoDialog.tsx` (novo),
`src/routes/_authenticated/chamados.novo-campo.tsx` (virou moldura),
`src/routes/_authenticated/painel.operacional.tsx`, `scripts/verificar-logica.cjs`.
**Sem migration.**

### Dois passos para trás, primeiro

O Davi pediu para recuar antes de avançar: a união com o sistema do Vinicius
tinha sido feita a partir de um documento escrito pelo **Claude dele**, e aquele
documento trazia a leitura dele — não a do Davi. Esta entrada começa, então, por
escrever a leitura do Davi num lugar só: `CONTEXTO_OPERACAO_TECNICA.md`. Quem é
quem (o Vinicius é GESTOR, não só técnico; as atividades dele são demandas
gerais na Início), as três atividades do técnico de campo com fluxo próprio, a
página do cliente como centro (cadastro e equipamentos do QAP, sistemas à mão,
contrato por upload, cobranças extras), as integrações no Administrativo com o
QAP **só lido**, e a atividade de validação que nasce quando o técnico conclui.

O §8 daquele documento lista o que a leitura de fora errou. Dois pontos mudam
regra escrita: o app **não escreve no QAP** (o §6 do PRODUTO previa o contrário
— ganhou uma nota, R129), e os **equipamentos vêm do QAP**, não do técnico em
campo (a decisão de 15/08 dizia o oposto; R128). Um terceiro ponto ficou como
pergunta em vez de virar regra: a **vistoria** — a R112 a descreveu como "ir ao
cliente só para olhar", o Davi a descreveu como "validar o trabalho dos
técnicos". Não reescrevi a R112 por conta própria: é a Q2 do plano.

### O plano, e por que ele substitui o anterior

O plano da absorção do Gestor OS (U75) ficou fora do repo, e era um plano de
portar telas. `PLANO_V0.1.md` é outro tipo de plano: a **definição de pronto** é
"um mês inteiro da equipe técnica passa só pelo app", e as fases saem das
prioridades que o Davi ditou (A: o dashboard; B: o "+"; C: a validação do
gestor; D: a ficha do cliente; E: APIs e QAP; F: preventiva por sistema; G: o
corte do Gestor OS). O §2 é um inventário do que JÁ EXISTE — porque o risco
real deste projeto, a U92 mostrou, é reconstruir o que está pronto lendo um
plano antigo. E o §4 são dez perguntas para o Davi, cada uma com a hipótese
que esta entrega assumiu para não travar.

### Fase A — o dashboard

**O que saiu e para onde foi.** "Fluxo e ritmo" e "Em aberto por técnico"
saíram da tela. Os números deles continuam em `indicadores.ts` — o verificador
passou a prender exatamente isso: a asserção nova calcula `saidasMes`,
`horasAteComecar` e `horasDeExecucao` num lote e confere que a biblioteca ainda
responde. É a mesma história de backlog e reincidência na R68: a biblioteca é
maior que a tela, de propósito.

**O orçamento de largura virou constante e asserção.** A R69 tinha travado
"244 + 210 + 216 + 28 ≤ 700" como número. Com três colunas, a conta mudou de
natureza: as três têm de caber em **1134px** (1366 de viewport com a sidebar
aberta), e a coluna do meio tem de ter EXATAMENTE a largura que a faixa 1 pede,
senão a faixa quebra por dentro e as alturas descolam dos painéis altos. Então
`BASE_MEIO` é DERIVADA (`LARGURA_KPIS + LARGURA_FILA + LARGURA_TILES + 2·GAP` =
590), e a asserção lê as seis constantes e refaz as duas contas — 590, e
236 + 590 + 262 + 28 = 1116 ≤ 1134.

**Três decisões nos painéis novos:**

1. **"A cobrar este mês" não existe para o SAC.** Não é um campo cinza nem um
   zero: é ausência. A consulta nem dispara sem `veFinanceiro` — e a hook nova
   (`useCobrancasDaCompetencia`) deixa o erro SUBIR, ao contrário das irmãs do
   mesmo arquivo, porque quem chegou a chamá-la pode ler a tabela, e "[]" viraria
   "R$ 0,00" diante de uma consulta que falhou. Erro, carregando e valor são
   três telas, com o erro primeiro (lição da U86).
2. **"Aguardando conferência" é o quinto recorte de `chamadosDoKpi`, fora do
   2×2.** Ele não é subconjunto de "em aberto" — são chamados CONCLUÍDOS — e por
   isso não entra em `KPI_OPERACIONAL_ORDEM` (a asserção antiga dos quatro
   continua verde). Mas o número e a lista saem da mesma função, que é a
   invariante da casa. E a lista dele ordena por HISTÓRICO, não por urgência de
   prazo: prazo não tem urgência depois de encerrado. Conta `a_analisar` E
   `em_conferencia`, porque o cartão da grade já conta os dois como pendentes e
   a conferência 113 da U80 mostrou o segundo como o chamado parado há dias.
   A regra do campo ausente é estrita: linha sem `faturamento_status` não conta
   — "não sei" nunca vira "sim".
3. **A barra da implantação tem duas medidas que não se misturam.** O
   preenchimento é o REAL (fases com `concluida_em` — a escrita é do gestor,
   R120); a marca fina é o PLANO (dias úteis decorridos, pelo mesmo
   `contarDiasUteis` do cronograma). Uma barra que somasse as duas diria "60%"
   sem ninguém saber se a obra andou ou se o mês passou. Sem cronograma, pinta o
   plano e o rótulo diz "% do período" — é plano, e diz que é. Sem período, diz
   "sem período" e não inventa. Antes do início o plano é 0 (não null — null é
   "não há período"); depois do fim é 100 e `atrasada` diz o resto. O período e
   as fases vêm de uma consulta PRÓPRIA (`useObrasEmAndamento`), pela regra de
   deploy da U89: se ela falhar, falha o progresso — a lista de obras continua,
   com "—" e o motivo no rodapé.

**Uma correção de vocabulário na tela.** O painel de conferência chama-se
"Aguardando conferência" e não "Ordens de serviço aguardando conferência", como
o Davi escreveu: o tile tem 128px, e "ordem de serviço" é o nome do SIGMA — no
app a coisa se chama chamado desde a U7.

### Fase B — o "+", e o formulário que virou um só

O Davi pediu um "+" que abre chamado técnico com equipe ou técnico solo,
cliente, problema ou sistema, e agendamento. `/chamados/novo-campo` já fazia
tudo isso em 626 linhas. Copiar para um pop-up criaria o segundo caminho de
escrita; navegar para a página perderia a tela. Então **o corpo do formulário
virou componente** (`FormularioChamadoTecnico`), a rota virou moldura de página
(guarda, cabeçalho, destino) e o pop-up virou moldura de diálogo (a mesma do
`DialogoDuplas`). Quem chama decide para onde ir ao terminar: a página navega,
o pop-up abre o painel lateral (R33). As asserções da U79 e da U83 que liam a
rota passaram a ler o componente — o formulário mudou de arquivo, não de
conteúdo.

**O que o formulário ganhou (R126), e onde mora a regra.** Três funções puras
em `abertura.ts`, assertadas pelo `carregar()`:
- `responsavelProposto` — técnico vence; sem técnico, o PRIMEIRO da escala da
  equipe; sem os dois, ninguém. A escala já chega ordenada por `ordem`, então
  "primeiro" é quem o gestor pôs primeiro (o líder, R14), não sorteio. É o que
  faz o chamado contar para a equipe no gráfico e receber o apoio automático.
  A tela DIZ a proposta antes de gravar.
- `sugerirTitulo` — "Tipo — Sistema", senão "Tipo — Cliente". O que a pessoa lê
  no placeholder é exatamente o que o banco recebe se ela não digitar.
- `rotuloDoSistema` / `secaoDoProblema` / `podeCriarSistema` — "problema se for
  manutenção, sistema se for implantação": a seção existe em todo tipo, mas a
  pergunta muda; e só a implantação oferece CRIAR o sistema do cliente ali,
  porque só nela o sistema ainda não existe. O sistema nasce ANTES do chamado
  (para o chamado já apontar para ele), e a asserção compara as posições das
  duas chamadas no fonte.

**O que eu recusei.** Não criei `situacao = em_implantacao` no sistema do
cliente: `cliente_sistemas.ativo` é booleano e o CHECK está no banco — é
migration, e é a Fase D (a preventiva "vazio = todos ativos" incluiria um
sistema ainda não instalado; está registrado lá). Também não fiz o "+" ser
permissão nova: ele obedece `chamados.novo`, a chave que a página já tinha.

### O que a verificação pegou

- O primeiro `moedaCurta` compararia "R$ 850,00" com espaço comum, e o ICU
  do Node emite espaço INSEPARÁVEL depois do "R$". A asserção normaliza —
  senão passaria numa máquina e falharia noutra.
- O caso de teste do progresso caía em 7 de setembro (feriado nacional) e o
  número esperado estava errado por um dia útil. O período do teste mudou para
  14–25/09, sem feriado — e a lição é a de sempre: dia útil não é dia corrido,
  e o `feriados.ts` está certo mesmo quando o teste está errado.
- Duas asserções antigas precisaram mudar de alvo, não de regra: "quatro
  gráficos com prefixo próprio" virou três (o `op-tec` saiu com o ranking), e
  "dois rankings do mesmo componente" virou um.

### A ordem de deploy

Zero migration; o push pode ir a qualquer hora. As colunas que o painel de obras
lê (`implantacao_inicio/fim`, `implantacao_cronograma`) são da U89, já rodada.

### Números

`node scripts/verificar-logica.cjs` → **2676 passaram, 0 falharam** (40 novas;
sete antigas mudaram de alvo com a R125/R126 — nenhuma regra foi afrouxada).
`npx vite build` → completa. `npx tsc --noEmit` → **59**, o baseline.
Última regra: **R130**. Sem migration a rodar.

## U94 — A revisão completa: o Administrativo com conteúdo, os contratos na ficha, o calendário semanal (R131–R133)

**Arquivos:** `docs/REVISAO_2026-09-03.md` (novo), `docs/PRODUTO.md`
(R131–R133), `src/features/administrativo/{Usuarios,Permissoes,Integracoes}.tsx`
(novos — os dois primeiros extraídos das rotas), `src/lib/integracoes.functions.ts`
(novo), `src/routes/_authenticated/painel.administrativo.tsx` (reescrito),
`gerencial.usuarios.tsx` e `gerencial.permissoes.tsx` (viraram redirect),
`contratos.tsx` (virou tronco), `contratos.novo.tsx`, `contratos.$id.tsx`,
`clientes.$id.tsx`, `calendario.tsx` (a visão semanal), `historico.tsx` e
`mapa.tsx` e `calendario.tsx` (ganharam guarda), `novo.tsx` (ganhou cabeçalho), `src/lib/telas.ts`,
`src/styles.css`, `scripts/verificar-logica.cjs`, o manual.
**Migration:** `20260912090000_u94_administrativo_absorve_usuarios_e_permissoes.sql`
— apaga da matriz as duas chaves que deixaram de ter tela. Ordem de deploy
indiferente: linha órfã não bloqueia nada.

### A revisão, antes do código

O Davi pediu uma revisão completa "agora que você sabe mais sobre os nossos
processos", e deu quatro exemplos do que queria: Contratos fora do
Administrativo, o Administrativo "melhor desenvolvido" com usuários e
permissões dentro dele e um botão de APIs, o Catálogo mantido, e o Calendário
com visão semanal para o Vinicius gerir o dia.

Um agente varreu as trinta e poucas rotas em paralelo enquanto eu lia a fundo
as que iam mudar. O resultado está em `docs/REVISAO_2026-09-03.md`: uma tabela
tela a tela com veredito (fica / mudou hoje / decidir / matar), oito achados
transversais e sete perguntas novas (Q11–Q17). Dois achados eram defeito de
segurança pequeno e sem custo de decisão — chaves de permissão que existiam na
matriz mas que nenhuma guarda lia (`historico`, `mapa`, `calendario`) — e foram corrigidos
aqui. Os outros mudam comportamento de alguém (o técnico na triagem, valores
na visita, legado a matar) e ficaram como pergunta: **fazer a matriz valer
onde ela já era "sim" para todos não muda o acesso de ninguém; fazê-la valer
onde ela nega ao técnico muda — e essa é decisão do Davi.**

### R131 — o Administrativo passa a TER o conteúdo

A página era uma porta com cinco atalhos. Virou três abas — Usuários,
Permissões, APIs — com o conteúdo morando nela. Os dois corpos (1026 e 283
linhas) foram **extraídos** das rotas para `features/administrativo/`, com
exatamente a mesma lógica: as mesmas consultas, as mesmas mutações e as mesmas
invalidações que fazem o usuário novo aparecer na hora nas listas que montam
equipe e responsável. As asserções da U29 que liam a rota passaram a ler o
componente — mudou o arquivo, não a regra. As rotas antigas redirecionam para
a aba (`?aba=`), e a aba mora na URL pelo mesmo motivo da prospecção na R38.

**A aba APIs diz a verdade, e só ela.** Uma server function devolve, para
cada integração, SE a chave está no servidor — um booleano. Nunca o valor: a
única coisa que a tela ganha em saber é "está ligado?", para o admin não
descobrir a chave que falta pelo erro de produção. O QAP entra como
**planejado**, com o que falta (Q7) — listá-lo é o que faz a aba ser o lugar
certo quando o conector da Fase E existir. Não há campo de chave: um campo sem
lugar seguro para gravar seria promessa.

**O que saiu da matriz saiu por migration.** As chaves `gerencial.usuarios` e
`gerencial.permissoes` deixaram de ter tela; ficar no catálogo seria chave sem
rota (o que o próprio catálogo chama de órfã), e ficar no banco seria lixo. A
U94 apaga as seis linhas — o mesmo gesto da U34 com `prospeccao` — e a lista de
arquivos que o verificador usa para montar a semente efetiva ganhou o arquivo.
Nenhum acesso muda: as duas eram negadas aos três papéis e do admin por regra
de sistema, e o admin continua entrando pelo painel.

**O Catálogo continua sendo tela** (decisão do Davi), com a chave `admin`
renomeada para o que ela é. Fechamentos idem: tem trabalho demais para virar
aba, e continua como atalho — sem número de dinheiro na porta (R13, a
asserção da U28 continua verde).

### R132 — a lista de contratos morre, o tronco fica

Contrato é atributo do cliente. A lista `/contratos` duplicava a seção
Contratos da ficha e obrigava a escolher o cliente de novo numa lista de cento
e noventa. Morreu como `/chamados` morreu na R31: o tronco fica, o exato
redireciona para Clientes, e as filhas (`/novo`, `/$id`) entram pelo Outlet —
com a guarda `contratos` ainda valendo para elas, porque contrato é dado
financeiro e a RLS já barra, mas mandar o técnico para uma tela vazia seria
pior que não mostrar a tela.

Três costuras pequenas fecharam o caminho: o botão Novo da ficha manda
`?cliente=` e o cadastro nasce com o cliente preenchido; voltar e excluir no
detalhe levam à ficha do cliente (`contrato.cliente_id`), e não a uma lista
que não existe.

### R133 — o calendário ganha a semana

A mensal já existia e é boa para varrer o mês — pouco por dia, de propósito.
O Vinicius precisa do contrário: **gerir o dia**, e isso pede hora, tipo,
cliente, status, número e quem toca, em cada item. A semanal mostra isso em
sete colunas, **segunda a domingo** — a semana ISO, a mesma da programação e
dos fechamentos, não a semana de domingo do calendário de parede.

**As duas visões leem a mesma lista e passam pelos mesmos filtros.** O que
muda é a JANELA consultada: o mês, ou exatamente os sete dias — uma semana
pode cruzar dois meses, então a semanal não pode depender da consulta do mês.
A chave da consulta carrega as duas pontas da janela, e é isso que impede mês
e semana de se contaminarem no cache. `Evento` ganhou quatro campos (rótulo
de status, rótulo de tipo, cliente, número) calculados no mesmo `useMemo` que
já calculava a cor — a mensal não os mostra, a semanal sim.

**A visão é preferência, não pergunta do momento.** Fica no `localStorage`,
como a lista/quadro da Início (`CHAVE_VISAO`), e quem escolheu a semanal
reabre na semanal. Sem rolagem por coluna — a página rola, uma vez só —, e no
celular a semana vira uma lista de dias (classe `.cal-semana`, uma coluna
abaixo de 1024px). Toda a grade mensal continua byte a byte onde estava: as
dezoito asserções da U12–U55 que a leem seguem verdes.

### O que eu recusei

- **Não gateei a triagem.** A chave `chamados.novo` nega ao técnico e a rota
  não lê a chave — mas a R25 diz que qualquer usuário abre chamado. Fazer a
  matriz valer ali muda o que o técnico consegue fazer, e é o Davi quem
  decide (Q11). Fiz valer só onde ela já dizia "sim" para todos.
- **Não construí o conector do QAP na aba APIs.** Sem documentação e sem
  credencial (Q7), a aba lista e diz o que falta. Um formulário de chave sem
  Vault por trás seria pior que a ausência.
- **Não apaguei `projeto.$id` nem `visita.$id.pendente`.** São legado claro,
  mas a tabela `projetos` pode ter dado que alguém ainda consulta (Q13).

### O que a verificação pegou

- A primeira versão do script de ajustes nem chegou a rodar: um escape de
  crase fora de string, e o Node recusou o arquivo inteiro — o que é o
  comportamento certo, e a razão de todo patch deste projeto ser ancorado e
  abortar em vez de aplicar pela metade.
- O `tsc` apontou uma comparação impossível no calendário
  (`cargo === "comercial"` contra um tipo que não a inclui). Ela já existia
  antes desta entrega e está no baseline de 59 — `useUserCargo` devolve "admin"
  para o comercial. Fica registrada; não é desta rodada.

### Números

`node scripts/verificar-logica.cjs` → **2702 passaram, 0 falharam** (26 novas,
entre elas o CENSO que acusa a próxima chave de permissão sem guarda).
`npx vite build` → completa. `npx tsc --noEmit` → **59**, o baseline (o
`cargo === "comercial"` do calendário já estava nele).
Última regra: **R133**. **Migration a rodar: U94** (apaga as duas chaves
órfãs; ordem de deploy indiferente).

## U95 — A tela da atividade: o seletor que abre a lista, o editor de blocos com menção, o autor que apaga (R134/R135)

**Arquivos:** `src/lib/texto-rico.ts` (novo — a lógica pura),
`src/components/SeletorDeOpcao.tsx` (novo), `src/components/EditorDeDescricao.tsx`
(novo), `src/components/TextoComChecklist.tsx` (leitura rica),
`src/features/chamados/DetalheInterno.tsx` (duas colunas),
`src/features/chamados/PainelChamado.tsx` (os mesmos componentes),
`src/features/chamados/data.ts` (`excluirComentario`), `src/styles.css`,
`docs/PRODUTO.md` (R134/R135), `docs/PLANO_V0.1.md` (Fase B2), o manual,
`scripts/verificar-logica.cjs`.
**Migration:** `20260913090000_u95_mencoes_e_comentario_do_autor.sql` —
aditiva: sem ela a menção é texto e o botão de apagar recusa; com ela os dois
funcionam. Ordem de deploy indiferente.

### O que o Davi pediu, e o que era antes

O print da página "Croqui demonstrativo para projeto de Portaria Remota"
mostrava, no computador, seis status em fila, sete equipes em fila, seis tipos
em fila — vinte botões coloridos para dizer três coisas —, um `<select>` nativo
para o responsável, a descrição em texto só de leitura e nenhum rosto. O
pedido foi em cinco frases: cada propriedade vira UMA opção que abre a lista;
a maior caixa é o texto; as ferramentas do texto têm UI própria (caixa de
marcar, não "[ ]"); dá para mencionar gente, e menção avisa; comentário se
apaga por quem escreveu; responsável e apoio com o rosto.

E antes disso, o mapa de aparelhos (R134): quem não é da técnica usa o
computador; o técnico de campo usa o celular e tem uma Início própria — "Bom
dia, você tem X chamados hoje" e os cards. Registrado como regra e como a
Fase B2 do plano; não foi construído nesta entrega, que é sobre a tela do
computador.

### As decisões

**O texto continua Markdown puro, e isso é a decisão central.** A tentação era
um editor rico "de verdade" (HTML ou JSON). Ele quebraria de uma vez as telas
que leem `descricao_problema` cru (DetalheCampo, a prévia da importação, o PDF)
e trocaria um formato que qualquer pessoa reconhece por um que só o editor
lê. O que o Davi pediu é apresentação: que a caixa de marcar seja uma caixa e
não "[ ]". Então `texto-rico.ts` lê o texto em BLOCOS (uma linha = um bloco) e
o editor desenha cada bloco com a UI certa — só a linha em edição é um textarea
cru; as outras são pintadas ricas, e clicar numa delas a põe em edição. É o
"live preview" do Obsidian, sem dependência nova.

**A menção é um token com nome e id.** `@[Nome](user:id)`: o nome para o texto
continuar legível onde é mostrado cru (as três telas que leem a descrição
passam a pintá-lo como chip, mas o PDF e a prévia mostram o token — legível);
o id porque é ele que avisa. Casar por nome traria homônimo e quebraria quando
alguém mudasse o cadastro.

**Quem avisa é o banco, e avisa uma vez.** O editor grava a cada 700 ms parado.
Um gatilho ingênuo no UPDATE da descrição tocaria o sino a cada tecla depois
da menção. O gatilho da U95 compara as menções de ANTES e de DEPOIS e avisa só
as novas (`EXCEPT`). No comentário, o gatilho que já existia ("Novo
comentário") passou a PULAR quem foi mencionado — a pessoa recebe o aviso mais
específico, e não os dois. E `mencoes_em()` em SQL usa a MESMA forma de uuid do
TypeScript; a asserção compara as duas strings, porque divergir aqui é sino que
não toca sem ninguém notar.

**Só o autor apaga, e só comentário.** A policy diz `tipo = 'comentario' AND
user_id = auth.uid()`. Gestor não apaga fala alheia — o pedido foi "por quem
escreveu", e abrir mais que isso pede pedido explícito. E `excluirComentario`
trata ZERO linhas afetadas como recusa: sem a migration rodada, o DELETE não
apaga nada, e "apaguei" sem apagar seria a mentira que a policy produziria em
silêncio.

**Um seletor, dois lugares.** `SeletorDeOpcao` é o `botaoSelecao` da R87
(pintado pela cor da coisa escolhida) que abre um `listbox` em portal, com a
mecânica de posicionamento do MenuFiltro. A página e o painel usam o mesmo; a
`Escolha` do painel só trocou o miolo — as asserções que a cercam (peça de
módulo, patch por campo) seguem verdes. O `<select>` nativo que sobrou no
painel é um só: o atalho "+ setor", que é ação, não propriedade.

**Duas colunas no desktop, uma no celular** (`.detalhe-grid`). O técnico de
campo não vive nesta tela — o fluxo dele é o do chamado de campo —, mas a
classe empilha porque a página é da atividade interna e o gestor também abre
no celular.

### O que eu recusei

- **Não construí a Início do técnico.** É regra (R134) e fase (B2) — a entrega
  de hoje é a tela do computador, e uma Início de celular merece o desenho
  próprio, não um corte da atual.
- **Não dei ao gestor o poder de apagar comentário alheio.** Pedido explícito
  ou nada.
- **Não troquei o formato do texto.** Ver acima.
- **Não coloquei a menção em portal.** A lista de pessoas abre embaixo da
  própria linha, no fluxo — dentro de um painel deslizante e de um textarea que
  cresce, um popover fixo perseguindo o cursor é o tipo de coisa que descola.

### O que a verificação pegou

- A asserção da barra de ferramentas pedia `width: 44, height: 44,` com
  vírgula, e o editor nasceu com `}` depois do 44. Ganhou um `flexShrink: 0` —
  que ele precisava mesmo — e a vírgula veio junto.
- O primeiro CSS da lista de sugestão usava um token que não existe
  (`--vidro-bg`). Virou `--bg-elevated`, que tem par nos dois temas
  (anti-padrão nº 9).
- Três asserções antigas descreviam o que mudou de propósito (a fileira de
  chips da R87, a barra de ferramentas dentro do painel, o `TextoComChecklist`
  editável na página) e passaram a descrever o novo — mudou o alvo, não a
  regra.

### Números

`node scripts/verificar-logica.cjs` → **2730 passaram, 0 falharam** (28 novas,
entre elas a paridade da regex de menção entre o SQL e o TypeScript).
`npx vite build` → completa. `npx tsc --noEmit` → **57** — o baseline CAIU de
59: a reescrita da página tirou dois erros antigos, um deles `sp === "atrasada"`,
uma comparação com um valor que `situacaoPrazo` nunca devolveu (o certo é
`estourado`) — ou seja, a cor de atraso do prazo na página interna nunca acendia.
Última regra: **R135**. **Migration a rodar: U95** (aditiva; sem ela a menção não
avisa e apagar comentário recusa).

## U96 — A borda em degradê da Início: a cor estratégica sai do fundo (R136)

Davi, depois de rodar a U95, olhando a página Início: "quero uma alteracao no
design dos cards da pagina INICIO do sistema, os cards devem ter o fundo
escuro no tema escuro e claro no tema claro, com SOMENTE a borda na cor
estrategica (vermelho, amarelo, azul ou verde), e as bordas deverao ser da cor
mais clara para a mais escura em degrade, alem de ter um glow levissimo no
contorno das atividades." Depois confirmou a régua, sem eu perguntar:
"vermelho para atividades atrasadas, azul para atividades no prazo para depois
dessa semana, amarelo para prazo essa semana, verde para concluidas." É a
R136, e o alvo é um só: `CardAtividade.tsx` — o card que `Quadro.tsx` desenha
por status na Início; `Quadro.tsx` em si não tem estilo de card próprio, só
empilha o componente, então mexer num arquivo bastou.

**O que saiu.** Desde 2026-08-20 o card respondia "quando vence?" com um véu
de cor no FUNDO inteiro — amarelo, azul ou vermelho translúcido sobre a
superfície. Saiu por completo. O fundo volta a ser `card(isLight)` puro:
`#141416` no escuro, branco no claro — o mesmo de qualquer outro card do
sistema.

**O que entrou.** A cor estratégica — a mesma informação de antes, prazo —
mora só na BORDA agora, e não é mais um tom sólido: é um degradê de três
paradas (clara → a cor pura → escura), no mesmo ângulo do degradê da marca
(135deg, `GRAD_PRIMARIA`). Não existe gradiente em `border` em CSS puro — o
jeito é o truque de duas camadas de `background` (uma sólida em padding-box,
o degradê em border-box, com `border: 1.5px solid transparent`), que é o que
`CardAtividade` monta agora quando há cor. Por fora, um glow: `box-shadow` com
blur largo na MESMA cor, reaproveitando o `.bg` que a `cor()` de `paleta.ts`
já calcula (14% de alfa) — não precisou de um número novo, e o próprio blur
já dilui isso a ponto de ficar "levíssimo", como pedido.

**A quarta cor veio de graça.** O Davi pediu quatro — vermelho, amarelo, azul,
verde —, e o código só tinha três (`faixaPrazo`: atraso/esta-semana/adiante).
O verde não foi invenção: é o mesmo tom que `PRISMA.verde` já documenta como
"o tom oficial da casa para terminado com sucesso", o mesmo que
`chamadoStatusInfo('concluido').color` usa na bolinha de status e no
cabeçalho da coluna Concluído do próprio quadro (era só ligar os pontos). O
card ganhou um quarto estado — `corEstrategicaDe`, local em
`CardAtividade.tsx` — que só olha `a.coluna === "concluido"` quando NÃO há
faixa de prazo: prazo sempre vence conclusão, as duas cores nunca competem
pelo mesmo card. `faixaPrazo()` em si **não mudou uma linha** — ela é sobre
"quando vence", tem os próprios testes, e só é consumida aqui; misturar
conclusão nela teria corrompido o que o nome já promete a quem a lê noutro
lugar do código (não achei outro consumidor hoje, mas o nome pararia de dizer
a verdade amanhã).

**`misturar`/`degradeDeBorda`, novas em `paleta.ts`.** Clarear ou escurecer
UMA cor por mistura com branco/preto — sem precisar de uma rampa tonal
inteira por cor, porque o azul da PRISMA não tem uma (a nota do arquivo já
explica: "fora da identidade"). É lógica pura, com teste de verdade via
`carregar()` — a aritmética pinada em três pesos (0, 1 e o cinza médio exato
de preto↔branco a 0.5) e o formato do degradê pinado por composição (as
mesmas duas chamadas a `misturar`, na mesma ordem).

**O chip perdeu o disfarce.** `chipStyle` tinha um `sobreFaixa` que trocava o
fundo colorido do chip por cinza translúcido quando o card por baixo também
era colorido — para o chip não desaparecer dentro do próprio fundo. Sem fundo
colorido, a razão de existir sumiu: o parâmetro saiu inteiro (não só ficou sem
uso), e os quatro chips do card (status, tipo, prioridade, compra) voltam a
usar a cor própria sempre, como já faziam antes de 20/08.

**O DESIGN_SYSTEM.md acompanhou, porque vai ser exportado.** Davi, na
sequência: "Atualize o arquivo .md do Design System […] quero seja mencionado
o estilo dos cards que criamos, onde somente as bordas reagem as cores
hierarquicas, com degrade no contorno, glow out bem fraco […] Vou exporta-lo
para outro sistema." Como o documento se declara autossuficiente ("sem
depender do código original"), a §6.12 nova traz a receita inteira — as duas
camadas de `background`, o porquê delas, a fórmula de `misturar` e os oito
valores já resolvidos (clara/escura por cor e por tema) para quem não tiver a
função. A §11.3 deixou de se chamar "cor de fundo do card" e passou a dizer a
semântica com o quarto estado; a linha "sombra colorida" da §11.4 virou "glow
de contorno"; o checklist da §10 ganhou o item. A asserção de regra 7 cobra
os valores resolvidos no documento — se `misturar` mudar de peso, o documento
exportado ficaria mentindo, e é isso que ela impede.

**Visto antes de mexer no código.** Gerei um preview estático fora do app —
carregando o `paleta.ts` de verdade com a mesma técnica do `carregar()` do
verificador, só que num script descartável — para olhar os cinco estados (as
quatro cores e o neutro) nos dois temas antes de considerar pronto. O degradê
e o glow aparecem, discretos, exatamente como pedido.

### O que eu recusei

- **Não toquei em `Quadro.tsx` nem no cabeçalho das colunas.** O pedido foi
  sobre os cards, não sobre a bolinha e o rótulo de cada coluna — que já eram
  coloridos e não fazem parte desta mudança.
- **Não criei uma quinta cor.** O Davi listou quatro; "cancelado" e qualquer
  outro estado sem prazo e sem conclusão continuam na borda neutra de sempre,
  como já ficavam sem faixa antes da R136.
- **Não usei `color-mix()` do CSS.** Resolveria o mesmo problema com menos
  código, mas é uma função que este repositório ainda não usa em lugar
  nenhum; `misturar` é aritmética simples, testável de verdade por
  `carregar()`, sem depender de o navegador entender uma sintaxe nova.

### O que a verificação pegou

Nada no código — as 15 asserções novas sobre `paleta.ts` e `CardAtividade.tsx`
passaram de primeira. A única que falhou na primeira rodada foi a própria
"regra 7" (o documento existe): eu ainda não tinha escrito ESTA entrada do
diário quando rodei a primeira vez — o verificador cobra a própria disciplina
do processo, não só o código.

### Números

`node scripts/verificar-logica.cjs` → **2747 passaram, 0 falharam** (17
novas, a última cobrando o DESIGN_SYSTEM exportável). `npx vite build` →
completa. `npx tsc --noEmit` → **57**, sem mudança
(R136 é CSS e uma função pura, nenhum tipo novo em jogo). Última regra:
**R136**. Sem migration — R136 não toca o banco.

## U96 — A estrutura das atividades: seis tipos, duas perguntas, equipe das pessoas, impacto, grupos, fachada (R137–R150)

O Davi mandou um documento inteiro — "Documento IMPORTANTE sobre a estrutura
das atividades" — e encerrou com "Estruture e protagonize tudo […] Caso não
restem dúvidas, pode fazer o push, eu confio no seu trabalho". O texto está
transcrito na íntegra em `docs/CONTEXTO_ESTRUTURA_ATIVIDADES.md`, e é para lá
que vão as decisões (D1–D9) e as perguntas (Q18–Q22). Aqui fica o raciocínio
da implementação.

**O que o documento muda de fundamento.** Até hoje a estrutura de uma atividade
saía da `natureza` (campo · interno · comercial) — quem decidia campos era o
modo de execução. O Davi virou o eixo: quem decide é **o tipo de demanda e o
responsável**, e a natureza vira consequência (responsável da Técnica → campo;
Proposta Comercial → o fluxo da visita; o resto → interno). Não reescrevi a
coluna `natureza` nem o que a lê — ela continua sendo a resposta a "como se
executa", que ainda é útil para RLS, ciclo de status e telas. O que mudou é
quem a PREENCHE: o pop-up, a partir das duas perguntas.

**Seis tipos, um endereço.** A lista dos seis (`TIPOS_DE_DEMANDA`) mora em
`chamado-status.ts`, e só lá — a regra da U83. Ela quase nasceu dentro do
diálogo: o censo do verificador pegou a cópia na primeira rodada (duas listas
literais com tipos de campo em `NovaAtividadeDialog.tsx`) e o corte foi uma
importação. É exatamente o que aquele censo existe para fazer.

**Equipe deixou de ser campo (R139) — e a coluna ficou.** A etiqueta sai das
PESSOAS (responsável e apoios, pelo cadastro), em `equipesDePessoas`, e é
derivada na leitura pelo modelo com um mapa pessoa → equipe no contexto. Mas
`chamados.equipe` é NOT NULL e é lida pela Operacional Técnica e por policies
— então ela continua sendo ESCRITA, com a equipe do responsável, em toda
criação e em toda troca de responsável. Ninguém a escolhe; ela acompanha. A
alternativa (derrubar a coluna) mexeria em RLS de carona numa entrega que já
era grande. O filtro "Equipe" da Início passou a casar com `a.equipes`, em
qualquer natureza — antes só o interno tinha equipe e o filtro escondia campo
e comercial por definição. `chamado_equipes` deixou de ser lida e escrita; a
"equipe do assunto" que a IA classificava (R82) saiu do prompt e do schema.

**O pedido de compra saiu por inteiro (R140), sem destruir dado.** O tipo saiu
do union, do rótulo, da cor, do CHECK e de toda tela; `compra.ts` foi apagado;
a tradução da ficha em coluna do quadro (onze asserções) morreu. Os chamados
que eram pedido de compra viram `operacional` na migration — é o que a R48 já
mandava abrir no lugar dele desde agosto —, com os gatilhos de usuário
desligados durante o remap (a lição de sempre: dado histórico com gatilho
ligado rende sinos). A tabela `chamado_compra` fica como arquivo, a RPC perde
o EXECUTE de `authenticated`, o job de "pedido parado" é desagendado. Apagar
a tabela é a Q21. O DESFAZER é possível justamente porque quem tinha ficha ERA
pedido de compra — a ficha é o rastro que faz o remap ser reversível.

**Sprint saiu como campo, ficou como cálculo (R141).** O seletor saiu das três
telas e do patch; `Atividade.sprint` passou a ser `sprintDoPrazo(prazo)` no
interno — a meta do mês (`metricas.ts`) continua funcionando e fica mais
verdadeira, porque a etiqueta envelhecida do Notion deixou de contar. A coluna
`chamados.sprint` está morta (P56); o gatilho ainda a preenche com um valor que
ninguém lê, e derrubá-la é leva de limpeza de schema.

**Impacto operacional (R142) é coluna nova, e o interno já não tinha
prioridade.** O modelo zerava a prioridade no interno desde a U7 — o card
nunca a mostrou. Então a troca foi limpa: `impacto_operacional` nasce para o
interno, com a mesma rampa de cores da prioridade (é a mesma pergunta com
outro vocabulário) e `prioridadeRank` vira uma régua só para quem ordena. Só
corretiva e operacional o têm. A preventiva ficou SEM por decisão minha (D1):
a lista de campos dela cita impacto, a frase de fechamento do Davi diz que ela
não tem "por isso não tem o campo" — a frase tem a razão junto, e a lista da
preventiva repete a da operacional item a item, com "comentários" duas vezes.
Está na Q19.

**Grupos de clientes (R143) sobre o mecanismo que já existia.** A R85 já tinha a
etiqueta de setor em `chamado_locais` e a R54 já dizia que grupo é marcação de
serviço. O que faltava: os grupos na MESMA lista do cliente (o "+ setor" à
parte morreu), o checklist automático na descrição (`grupos.ts`, puro:
alfabético, idempotente, não duplica linha já marcada) e a CONTAGEM por
cliente — a ficha lia só `cliente_id`, então uma atividade de "Clientes de
Portaria Remota" não aparecia em nenhum cliente. `useChamadosDoCliente` passou
a fazer duas consultas (PostgREST não faz subquery): os ids de `chamado_locais`
onde o cliente é local extra ou onde o setor casa com `servicos_prestados`
dele, e depois `cliente_id.eq OR id.in`. A linha diz "pelo grupo de clientes
ou como local extra" para a pessoa não estranhar.

**A ordem de deploy virou código (regra 5).** O push publica na hora; a
migration o Davi roda depois. Pedir `impacto_operacional` antes de a coluna
existir é 42703 e a Início inteira fica em branco. Então toda leitura de
`chamados` passa por `comFallbackDaU96`: tenta com as colunas novas, repete
sem elas em 42703. O INSERT do pop-up faz o mesmo; o UPDATE dos dois campos
novos explica "a migration U96 precisa ser rodada" em vez do inglês do driver.
Depois da migration o segundo caminho nunca mais roda. É o desenho da U81
(`*` em `chamado_apoios`), com lista explícita porque a Início não pode
carregar a descrição de setecentos chamados para ler um impacto.

**O calendário (R145) ganhou uma terceira perna.** Concluído entra pela data
de conclusão; em aberto entra pela hora agendada quando há, senão pelo prazo
(D6 — o Davi disse "prazo", e a hora agendada é o compromisso da dupla; para o
interno, que não tem hora, o efeito é literalmente o pedido). A consulta tem
três `and(...)` no `or`, e `quando` prefere a conclusão. A célula diz
"concluído".

**A proposta (R147) e a implantação (R148).** O rótulo do tipo voltou a
"Proposta Comercial" (a R48 o chamava "Prospecção"; o valor `prospeccao` não
mudou). As quatro etapas ganharam o vocabulário do Davi em `etapas.ts`. O
título do card é "Proposta Comercial" — e "Visita Técnica" para o técnico
responsável pela visita (D5): um registro, dois papéis, decidido por quem olha;
a alternativa seria um segundo registro por proposta, mais cards para a mesma
coisa. Ao escolher um cliente como Local, a foto da fachada do cliente vem
junto COMO ARQUIVO (`baixarFachadaComoArquivo`) e segue pelo mesmo upload da
foto tirada na hora — sem segundo formato. A implantação ganhou `proposta_id`
(FK para a visita com proposta enviada) no pop-up e na página; a leitura do
PDF pela IA é lembrete registrado.

**A ficha do cliente (R146).** Os seis campos de síndico e zelador existiam
desde a Etapa 1 — faltava chamar o telefone de WhatsApp e fazê-lo abrir o
WhatsApp. `foto_fachada_url` era coluna órfã: passou a guardar o CAMINHO no
bucket privado `clientes-fachadas` (URL assinada com cache de uma semana;
valores antigos com `http` continuam valendo). A ficha virou duas colunas na
mesma `.detalhe-grid` da página da atividade; o card da lista recebe a foto
como camada absoluta pela direita, com máscara para a esquerda e classe
`.pronta` no `onLoad` — sem ela não há transição, há salto. O histórico da
ficha deixou de cortar em 8 em silêncio: teto declarado, "ver todas".

**O pop-up (R138).** Pequeno enquanto pergunta, largo quando responde. Três
corpos: proposta → botão para o fluxo da visita; técnico → o
`FormularioChamadoTecnico` da R126, que ganhou `tipoInicial`/`tecnicoInicial`
para não perguntar de novo o que acabou de ser respondido; o resto → a
estrutura do tipo, na mesma `.detalhe-grid` (texto à esquerda, propriedades à
direita). O plantão (R117) continua entrando por aqui, como modo à parte.

### O que eu recusei

- **Não reabri `data_hora_agendada` para o interno.** O Davi lista "Data
  Agendada (opcional)" em toda atividade; a coluna é espelho da agenda de
  campo (R101) e a U78 gastou uma migration inteira para fechar as duas
  verdades. Ficou a Q18 (uma coluna própria, se ele quiser) e a P57.
- **Não apaguei `chamado_compra` nem `chamado_equipes`.** Histórico. Q21/P55.
- **Não construí o mini-calendário do técnico na proposta.** Ele lê a agenda
  por dupla e a escala da semana, e a pergunta "a visita comercial vira bloco
  na programação do Vinicius?" muda o desenho (Q22). É a H.1 do plano.
- **Não inventei uma quinta cor de impacto nem um impacto para a preventiva.**
- **Não toquei na estrutura do técnico de campo.** O Davi vai ditá-la; o
  lembrete está guardado.

### O que a verificação pegou

- O censo da U83 pegou a lista dos seis tipos escrita dentro do diálogo (e uma
  segunda, de quatro tipos de campo). Virou `TIPOS_DE_DEMANDA` no arquivo
  autorizado e `tiposDaNatureza("campo")`.
- O censo de `NovoChamadoInput` pegou dois parâmetros de uma função que eu
  tinha posto logo depois da interface (`equipeDaPessoa`), lidos como chaves
  da interface. A função mudou de lugar; o censo continua estreito, como deve.
- O censo de gatilhos AFTER UPDATE de `chamados` enxergou o DROP do gatilho
  da ficha de compra na migration nova e cobrou a lista — seis, não sete.
- O censo banco × código do CHECK de tipo passou a apontar para a U96 e cobrou
  dela o que cobrava da U83: pré-voo que aborta, conferência da lista inteira
  com `COLLATE "C"`, `convalidated`, veredito em SELECT. A migration ganhou os
  quatro; as asserções sobre o DESENHO da U83 passaram a ler a U83 por nome.
- Vinte e oito asserções descreviam o que mudou de propósito (compra, sprint,
  equipe como campo, "Prospecção", "Proposta enviada", o `<select>` "+ setor")
  e passaram a descrever o novo — mudou o alvo, não a regra.

### Números

`node scripts/verificar-logica.cjs` → **2800 passaram, 0 falharam** (50 novas
nesta entrega — a lógica pura de grupos, impacto e equipes das pessoas; o
fallback da ordem de deploy; as três pernas do calendário; as telas; a
migration; os documentos — mais 28 repontadas). `npx vite build` → completa.
`npx tsc --noEmit` → **57**, sem mudança: os quatro arquivos com erro são os do
baseline (visita.$id, DetalheCampo, calendario, cobranca.functions), nenhum dos
vinte e cinco tocados. Última regra: **R150**. **Migration a rodar: U96**
(`20260914090000_u96_estrutura_das_atividades.sql`) — sem ela, impacto e
proposta não gravam (a tela avisa), a fachada não sobe (o bucket não existe),
pedido_compra continua no CHECK e a ficha antiga continua com os gatilhos; as
leituras têm fallback e nenhuma tela cai. Um arquivo apagado: `compra.ts`.
Nada verificado no navegador autenticado (o login pede senha, que eu não
digito); o que se vê nesta entrega está preso por asserção estrutural, tipo e
build — e o Davi vai ver ao abrir.
