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
| **U6** | **Ponte QAP fase 1** | relatório de movimentações para o Gilleno; conciliação de unidades por import; automação 9 | U3 |
| **U7** | **API QAP fase 2** | de-para de modelos; consulta de unidades/estoque; POST de movimentação com referência à OS | U6 + pedido ao dev (§8) |
| **U8** | **IA no WhatsApp** | leitura das mensagens SAC/portaria → sugestão de OS | núcleo estável + decisões §9 |

Paralelismo: U1 e U2 podem andar juntas (não se tocam); U3 depois de U2 para a
OS já nascer vinculada ao contrato. O desligamento do Notion acontece ao fim de
U1; o do SIGMA e do gestor-os, ao fim de U5 — quando o Vinicius fizer um ciclo
completo (programar → executar → conferir → fechar → enviar ao financeiro) só
no app.

## 11. Questões em aberto

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
