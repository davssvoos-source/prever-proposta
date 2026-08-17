# Sistema de Ordens de Serviço — Prever

Documento de arquitetura e plano de execução da expansão do app Prever
Proposta: de ferramenta de orçamentos para o sistema de Ordem de Serviço da
área de tecnologia da Prever — chamados corretivos, manutenção preventiva e
implantação de sistemas, sobre um cadastro real de clientes e seus
equipamentos instalados.

Escrito em 2026-08-15 a partir de um mapeamento completo do app atual
(52 migrations, todas as rotas, papéis, catálogo e infraestrutura). As seções
de modelo de dados citam tabelas e colunas reais do código de hoje.

---

## 1. Visão

Hoje o app cobre **pré-venda**: visita técnica → orçamento por blocos →
aprovação → proposta comercial (.docx). A expansão cobre o **pós-venda**, com
o mesmo time e a mesma base:

```
                    HOJE                           EXPANSÃO
┌──────────────────────────────────┐  ┌─────────────────────────────────────┐
│ Visita técnica → Orçamento →     │  │ Cliente cadastrado + inventário     │
│ Aprovação → Proposta (.docx)     │─→│ (as-built) → OS de implantação →    │
│                                  │  │ chamados corretivos → preventivas → │
│                                  │  │ relatórios (PDF por OS + gerencial) │
└──────────────────────────────────┘  └─────────────────────────────────────┘
```

O elo entre os dois mundos: **uma proposta aprovada gera a OS de implantação,
e a implantação concluída alimenta o inventário do cliente** — que passa a ser
a base dos chamados corretivos e preventivos dali em diante.

## 2. Decisões de produto já tomadas

Definidas com o Davi em 2026-08-15:

| Tema | Decisão |
|---|---|
| Acesso | **Só equipe interna.** SAC (gestor) abre chamados; técnicos executam. Clientes não entram no sistema. |
| Cadastro de clientes | **Manual no app**, cliente a cliente. Equipamentos registrados aos poucos pelos técnicos em campo (ex.: primeira ida a cada cliente). |
| Corretiva | Tem **prioridade e prazo (SLA)** que precisam ser controlados. |
| Preventiva | **Avulsa** — agendada manualmente pelo gestor, sem recorrência automática. |
| Implantação | **Nasce da proposta aprovada** no próprio app, herdando os equipamentos do orçamento. |
| Execução | Fotos **antes/depois** + **assinatura do cliente** na tela do técnico. |
| Relatório | **PDF por OS** (padrão visual Prever) + dashboard gerencial. |
| Peças/estoque | **Fica no ERP** — movimentação de peças para clientes continua sendo feita lá. Integração com o ERP é fase futura; por ora a OS registra as peças usadas como texto para constar no relatório. |

## 3. Conceitos do domínio

- **Cliente** — condomínio/empresa/residência atendida pela Prever. Registro
  mestre com endereço, contatos (síndico/zelador) e situação do contrato.
  Hoje esses dados vivem **embutidos em cada visita** (`visitas_tecnicas`
  tem `nome_predio`, `endereco`, contatos etc.) e a tabela `clientes`
  existente é rasa e descartável (uma linha nova por visita, sem endereço nem
  deduplicação). A expansão promove `clientes` a registro mestre.
- **Sistema instalado** — um "bloco" do mundo real no cliente: eclusa de
  pedestres, eclusa veicular, CFTV, alarme, cerca, elevadores, totem, central.
  Reaproveita a taxonomia `TipoBloco` já existente (PED/VEI/CFTV/AL/CER/ELV/TOT/CENT).
- **Equipamento instalado (as-built)** — inventário por sistema instalado,
  referenciando o catálogo `equipamentos` (códigos EQ*/ALM_*). Deriva do
  orçamento aprovado (`visita_blocos` + `visita_bloco_itens`) e é atualizado
  em campo pelos técnicos.
- **Ordem de Serviço (OS)** — unidade de trabalho com três tipos:
  **corretiva** (chamado), **preventiva** (revisão avulsa com checklist) e
  **implantação** (instalação do escopo de uma proposta aprovada).
- **Execução** — registro do atendimento: diagnóstico, serviço executado,
  peças (texto), fotos antes/depois, assinatura do cliente, relatório PDF.

## 4. Modelo de dados

Convenções: enums Postgres novos (hoje só `app_role` existe — sem colisão);
todas as tabelas novas com RLS desde o primeiro dia; FKs de verdade
(corrigindo o padrão atual de `cod_eq` texto sem FK).

### 4.1 `clientes` (promover a registro mestre)

A tabela existe; ganha colunas e muda de semântica (deixa de ser escopada por
`owner_id` — vira registro corporativo, leitura para todos os autenticados,
escrita para gestores).

```
clientes
├─ id, nome (nome do condomínio/empresa), tipo_local, tipo_empreendimento
├─ endereco, complemento, latitude, longitude          ← migram de visitas_tecnicas
├─ nome_sindico, telefone_sindico, email_sindico       ← idem
├─ nome_zelador, telefone_zelador, email_zelador       ← idem
├─ foto_fachada_url
├─ qtd_apartamentos, qtd_acessos (visão geral da estrutura)
├─ situacao enum: prospecto | ativo | inativo
├─ observacoes, created_at/by
```

- `visitas_tecnicas.cliente_id` (FK que já existe, hoje quase sempre NULL)
  passa a ser o vínculo real; a tela de nova visita ganha **seletor de
  cliente existente** em vez do INSERT cego atual (gerencial.nova.tsx cria
  1 cliente descartável por visita — comportamento a remover).
- **Backfill assistido**: tela de migração que agrupa as visitas existentes
  por endereço/nome do prédio e sugere a criação dos clientes, com revisão
  humana (sem dedup automática cega).

### 4.2 Inventário (as-built)

```
cliente_sistemas                          cliente_equipamentos
├─ id, cliente_id FK                      ├─ id, cliente_sistema_id FK
├─ tipo enum (PED|VEI|CFTV|AL|CER|        ├─ equipamento_id FK → equipamentos.id
│            ELV|TOT|CENT)                ├─ cod_eq (snapshot do código)
├─ nome ("Eclusa Social", "Garagem")      ├─ qtd
├─ descricao                              ├─ estado enum: ativo | substituido | removido
├─ origem_visita_bloco_id FK null         ├─ origem enum: implantacao | campo | manual
├─ ativo                                  ├─ instalado_em, observacao
```

- **Derivação automática**: quando uma OS de implantação é concluída (ou, para
  projetos antigos, sob demanda a partir de uma visita aprovada), cada
  `visita_bloco` vira um `cliente_sistema` e cada item não-removido e não-SV*
  de `visita_bloco_itens` vira um `cliente_equipamento`. A lógica de agregação
  e nomeação já existe pronta em `gerarProposta.ts` (qtdPorCode, TIPOS_NOMES).
- **Registro em campo**: qualquer OS permite ao técnico adicionar/ajustar
  equipamentos do inventário (origem `campo`), cobrindo os clientes antigos
  que nunca passaram pelo app.
- Serviços SV* (I.As, mensalidades) do orçamento aprovado ficam anotados no
  cliente como serviços contratados (campo/tabela leve — detalhe na Etapa 2).

### 4.3 Ordens de Serviço

```
ordens_servico
├─ id, numero text UNIQUE ("OS-2026-0001", sequence por ano)
├─ tipo enum: corretiva | preventiva | implantacao
├─ cliente_id FK NOT NULL
├─ cliente_sistema_id FK null (sistema afetado)
├─ visita_id FK null (origem, quando implantação)
├─ titulo, descricao_problema
├─ prioridade enum: baixa | normal | alta | urgente
├─ prazo_limite timestamptz (calculado da tabela de SLA, editável)
├─ status enum: aberta | agendada | em_atendimento | executada | fechada | cancelada
├─ tecnico_id FK, data_hora_agendada
├─ iniciada_em, finalizada_em
├─ diagnostico, servico_executado, pecas_texto (livre — ERP cuida do estoque)
├─ assinatura_nome, assinatura_url (imagem do canvas, bucket privado)
├─ aberto_por, fechado_por, fechada_em, motivo_cancelamento
└─ created_at

os_fotos: os_id, etapa enum(antes|depois|outra), url, storage_path, legenda, created_by
os_eventos: os_id, tipo, descricao, user_id, created_at   ← timeline/auditoria
os_sla: prioridade PK, horas_prazo                        ← seeds a confirmar (§10)
os_checklist_templates: tipo_sistema, item, ordem         ← preventiva (Etapa 6)
os_checklist: os_id, item, concluido, observacao
```

Ciclo de vida (espelha o padrão de `visita-status.ts` — arquivo único
`os-status.ts` com buckets, cores e helpers, e um `osRouteFor`):

```
aberta ──(técnico+data)──► agendada ──(técnico inicia)──► em_atendimento
                                                              │
cancelada ◄──(gestor, com motivo)                    (técnico conclui c/
                                                      fotos+assinatura)
                                                              ▼
                     fechada ◄──(gestor confere)──── executada
```

### 4.4 Notificações

A tabela `notificacoes` ganha coluna `os_id` (análoga a `visita_id`) e novos
tipos: `os_atribuida`, `os_executada` (→ gestores), `os_fechada` (→ técnico),
`os_prazo_estourando`.

> **Obrigatório por causa de um bug real do app atual:** a policy de INSERT de
> `notificacoes` só permite `user_id = auth.uid()` — os inserts client-side
> para outros usuários (pre-envio → admins, aprovação → técnico) **falham em
> silêncio hoje**. Toda notificação de OS nasce como **trigger SECURITY
> DEFINER** (molde: `notify_visita_atribuida`) ou server function com
> `supabaseAdmin`. Nunca insert client-side para terceiros.

### 4.5 Papéis e RLS

Reaproveita os três papéis existentes — `admin`, `comercial`, `tecnico` — sem
criar papel novo: **gestor SAC = admin | comercial** (o app já colapsa os dois
como "gestor" em `useUserCargo`).

| Tabela | SELECT | INSERT/UPDATE | DELETE |
|---|---|---|---|
| `clientes`, `cliente_sistemas`, `cliente_equipamentos` | todos autenticados | gestor; técnico atualiza inventário via OS | admin |
| `ordens_servico` | técnico: as suas; gestor: todas | gestor abre/edita; técnico atualiza a sua (campos de execução) | admin |
| `os_fotos`, `os_eventos`, `os_checklist` | quem vê a OS | quem executa/gere a OS | admin |

Pré-requisito de segurança (Etapa 0): hoje **qualquer usuário consegue se
auto-promover a admin** — `perfil.tsx` grava `profiles.cargo` de um input de
texto livre e a policy `profiles_update` não restringe colunas, sendo
`profiles.cargo` a fonte checada pela maioria dos guards e RLS. Fechar antes
de apoiar qualquer RLS de OS em cargo.

## 5. Fluxos por persona

### 5.1 Gestor (SAC) — abertura de chamado corretivo

1. `Gerencial → Chamados → FAB "Abrir chamado"` (mesmo padrão do FAB de nova visita).
2. Wizard curto: **cliente** (busca no cadastro) → **sistema afetado**
   (lista os `cliente_sistemas`; opcional) → **problema** (título + descrição
   + prioridade — prazo-limite preenchido pela tabela de SLA, editável) →
   **técnico e agenda** (com a checagem de conflito de horário que a tela de
   nova visita já faz).
3. OS nasce `aberta` (sem técnico/data) ou `agendada`; técnico é notificado
   (trigger). Aparece no calendário e no dashboard.

### 5.2 Técnico — execução

1. Aba **Chamados** (novo item na BottomNav do técnico, que hoje tem só 3
   itens): lista das suas OS por status/data, com prioridade visível
   (chip + prazo). Card "Próximo chamado" no Início, ao lado de "Próxima visita".
2. No detalhe da OS (`/os/$id`, tela única com CTAs por status, padrão
   `visita.$id.tsx`): **SlideToStart** inicia o atendimento (`em_atendimento`,
   `iniciada_em`).
3. Registro da execução: diagnóstico, serviço executado, peças usadas (texto),
   **fotos antes/depois** (bucket privado novo `fotos-os`, signed URL),
   checklist quando preventiva/implantação, e ajustes de inventário
   ("substituí a leitora X por Y" → atualiza `cliente_equipamentos`).
4. **Assinatura do cliente**: canvas na tela do celular, nome de quem assinou;
   imagem vai para o storage e entra no PDF.
5. Concluir → `executada`; gestores notificados.

### 5.3 Gestor — conferência e fechamento

1. Painel de OS `executadas` aguardando conferência.
2. Gestor revisa (fotos, texto, assinatura), gera/baixa o **relatório PDF** e
   fecha (`fechada`). Reabrir volta para `em_atendimento` com evento na timeline.

### 5.4 Preventiva (avulsa)

Gestor abre OS tipo `preventiva` escolhendo cliente + sistemas a revisar; o
sistema monta o **checklist** a partir dos templates por tipo de sistema
(ex.: CFTV → limpar lentes, conferir gravação/HD, testar acesso remoto…).
Execução idêntica à corretiva, com o checklist no lugar do diagnóstico.

### 5.5 Implantação (a partir da proposta aprovada)

1. Na visita **aprovada**, botão **"Gerar OS de Implantação"** (na tela de
   detalhe ou na de Formas de Pagamento).
2. Cria 1 OS tipo `implantacao` vinculada à visita, com checklist gerado dos
   blocos e seus itens (cada bloco = seção do checklist).
3. Ao fechar a OS: **as-built gerado automaticamente** — cria/atualiza o
   cliente (se ainda não existir), os `cliente_sistemas` e os
   `cliente_equipamentos` a partir do escopo aprovado.

### 5.6 Relatórios

- **PDF por OS**: template `.docx` no padrão visual Prever (mesmo pipeline
  docxtemplater da proposta): dados do cliente e da OS, diagnóstico/serviço,
  peças, fotos antes/depois, assinatura, datas e técnico. Nome:
  `OS-2026-0001-Cliente.docx`.
- **Dashboard gerencial de OS**: abertas por status/prioridade, estouro de
  SLA, tempo médio de atendimento, chamados por cliente e por técnico,
  fechadas no mês. Reaproveita os padrões de stat-tiles e dataviz do
  dashboard atual.

## 6. Telas — novas e alteradas

| Rota | Quem | O quê |
|---|---|---|
| `/clientes` | gestor (técnico lê) | lista/busca de clientes, FAB novo cliente |
| `/clientes/$id` | gestor (técnico lê) | dados, sistemas/inventário, histórico de OS e visitas |
| `/os` | todos | lista de chamados (técnico: os seus), filtros por status/tipo/prioridade |
| `/os/$id` | todos | detalhe única com CTAs por status (execução do técnico acontece aqui) |
| `/gerencial/os/nova` | gestor | wizard de abertura de chamado |
| `gerencial.tsx` | gestor | ganha acessos a Chamados e Clientes (tabs ou botões no topo, padrão "Usuários") |
| `BottomNav` | técnico | novo item **Chamados** (o slot `/historico` está órfão hoje e pode ceder o lugar) |
| `dashboard.tsx` | todos | card "Próximo chamado", stat-tiles de OS |
| `calendario.tsx` | todos | OS agendadas junto com visitas (cores/formas distintas) |
| `gerencial.nova.tsx` | gestor | passa a selecionar cliente existente (ou criar) em vez de inserir cliente descartável |
| `visita.$id.tsx` / pagamento | gestor | botão "Gerar OS de Implantação" quando aprovada |

Padrões reaproveitados na íntegra: tela-única-por-status + `xxxRouteFor`,
SlideToStart, wizard com stepper, FAB dourado, chips de status (cor + ícone +
rótulo), realtime channel + invalidateQueries, design system (DESIGN_SYSTEM.md).

## 7. Infraestrutura e integrações

- **Storage**: bucket novo privado `fotos-os` (+ assinaturas). Atenção:
  buckets não nascem em migration — criação manual no dashboard Lovable, com
  policies versionadas em migration.
- **Migrations**: o canal real é o **SQL Editor da Lovable** (aplicação
  manual). Toda migration de OS: idempotente, com SELECT de verificação no
  fim, e `src/integrations/supabase/types.ts` regenerado (já está defasado
  hoje — colunas de julho faltando).
- **Realtime**: `ordens_servico` entra na publication `supabase_realtime`
  (padrão das visitas) para dashboard e notificações in-app.
- **Push com app fechado (limitação real)**: o app Android é um WebView do
  site publicado, **sem** FCM/push — notificação só chega com o app aberto.
  Para chamado urgente alcançar o técnico: FCM (rebuild do shell + Play
  Store) ou aviso por canal externo (WhatsApp/e-mail via edge function).
  Decisão em aberto (§10) — tratada como etapa própria.
- **Offline**: WebView remoto = sem conectividade, sem app. Subsolo/áreas sem
  sinal são limitação aceita nesta fase (registrar e seguir).
- **ERP (futuro)**: ponto de integração previsto — quando chegar, `pecas_texto`
  dá lugar a uma tabela `os_pecas` conciliável com a movimentação do ERP.
- **I.A**: relatório da OS pode ganhar resumo automático reaproveitando o
  molde de `gerarResumosProposta` (structured output + fallback determinístico).

## 8. Pré-requisitos de saneamento (Etapa 0 — ✅ implementada)

Encontrados no mapeamento e **obrigatórios** para a expansão não herdar as
fraquezas atuais. Implementados em 2026-08-15 pela migration
`20260815140000_etapa0_saneamento.sql` + ajustes no app (ver §11).

1. **Segurança de cargo**: remover a edição livre de `cargo` no perfil e
   restringir a policy `profiles_update` por coluna (brecha de auto-promoção
   a admin confirmada).
2. **Fonte única de papel**: padronizar `user_roles`/`has_role` × `profiles.cargo`
   (hoje metade dos guards usa um, metade o outro) — decidir e sincronizar.
3. **Notificações**: substituir os inserts client-side quebrados (pre-envio,
   aprovação) por triggers SECURITY DEFINER — sem duplicar com os triggers já
   existentes.
4. **Status legados**: normalizar `aprovado`→`aprovada` e mapear `concluida`
   (linhas antigas caem fora dos buckets e sujariam relatórios).
5. **`fetchTecnicos`**: filtrar `cargo='tecnico'` (hoje lista qualquer perfil
   ativo, inclusive admins).
6. **RLS permissiva**: `visita_blocos`/`visita_bloco_itens`/`visita_orcamentos`
   aceitam qualquer autenticado (`USING true`) — endurecer junto com as
   tabelas novas.
7. **types.ts** regenerado e disciplina de migration (verificação no banco
   vivo — lição das 4 tentativas do EQ302).

## 9. Etapas de execução

Cada etapa é entregável e utilizável sozinha; a ordem prioriza o chamado
corretivo (dor principal do SAC) sobre os fluxos derivados.

| # | Etapa | Entrega | Depende de |
|---|---|---|---|
| **0** ✅ | **Saneamento e fundações** | itens do §8 (ver §11) | — |
| **1** ✅ | **Cadastro de Clientes** | tabela promovida + telas `/clientes` + seletor na nova visita + consolidação assistida (ver §12) | 0 |
| **2** | **Inventário (as-built)** | `cliente_sistemas`/`cliente_equipamentos` + telas no cliente + derivação de visita aprovada + edição em campo | 1 |
| **3** | **Chamados corretivos ponta a ponta** | `ordens_servico` + abertura SAC + execução do técnico (fotos, assinatura, peças-texto) + conferência/fechamento + notificações in-app + BottomNav/dashboard/calendário | 1 (2 recomendada) |
| **4** | **Relatório PDF da OS** | template .docx Prever + fotos + assinatura embutidas | 3 |
| **5** | **Dashboard gerencial de OS** | stat-tiles, SLA, tempos, por cliente/técnico | 3 |
| **6** | **Preventiva + Implantação** | checklists por tipo de sistema; "Gerar OS de Implantação" na proposta aprovada; as-built automático no fechamento | 2, 3 |
| **7** | **Alcance de notificação** | push FCM **ou** WhatsApp/e-mail para chamados urgentes (decisão §10) | 3 |
| **8** | **Integração ERP (futuro)** | peças da OS conciliadas com o ERP | 3, definição do ERP |

Cada etapa começa com sua(s) migration(s) — idempotentes, aplicadas por você
no SQL Editor — e termina com `tsc` limpo e teste do fluxo no app.

## 10. Questões em aberto

Respostas necessárias antes (ou durante) as etapas correspondentes:

1. **SLA por prioridade** (Etapa 3): proposta inicial — urgente 4h, alta 24h,
   normal 72h, baixa livre/agendável. Valem esses prazos? Contam horas
   corridas ou úteis?
2. **Numeração da OS** (Etapa 3): proposta `OS-2026-0001` (sequência anual).
   Existe padrão atual da Prever (ex.: do ERP) a seguir?
3. **Conferência do gestor** (Etapa 3): fechamento sempre passa pelo gestor
   (como desenhado) ou OS de preventiva pode fechar direto pelo técnico?
4. **Checklists de preventiva** (Etapa 6): quais itens por tipo de sistema?
   (Posso propor uma primeira versão para vocês ajustarem.)
5. **Implantação** (Etapa 6): 1 OS por projeto (com checklist por bloco, como
   desenhado) ou 1 OS por sistema/bloco para dividir entre técnicos?
6. **Chamado urgente com app fechado** (Etapa 7): FCM/push nativo (requer
   rebuild do app Android e Play Store) ou aviso por WhatsApp/e-mail?
7. **Clientes históricos** (Etapa 1): quantos clientes ativos aproximadamente,
   e quem faz a revisão do backfill? (Define o tamanho da tela de migração.)
8. **Técnico pode abrir OS?** (Etapa 3): desenhado como só-gestor; técnico em
   campo que identifica problema novo abre chamado ou reporta ao SAC?

---

## 11. Registro da Etapa 0 (2026-08-15)

Implementada em `supabase/migrations/20260815140000_etapa0_saneamento.sql`
(rodar no SQL Editor da Lovable) + mudanças no app.

**Papéis — decisão: `user_roles` é a fonte de verdade; `profiles.cargo` é
espelho sincronizado.** Escolha motivada por segurança: `user_roles` tem
escrita restrita a admin (`user_roles_admin_all`), então o usuário não
consegue se conceder papel; `profiles.cargo` continua existindo porque é o
que quase todo o app lê, e um trigger o mantém em sincronia. Assim nada no
front precisou ser reescrito.

- `trg_guard_profiles_privilegios` (BEFORE UPDATE em `profiles`): só admin
  altera `cargo`, `status` e `ativo`. Contexto de servidor (`auth.uid()`
  nulo) segue liberado, para não quebrar triggers e server functions.
- `trg_sync_user_role`: `profiles.cargo` → `user_roles` a cada mudança.
  Efeito colateral positivo: a aprovação de usuário (que gravava só o cargo)
  passa a criar o papel corretamente.
- `handle_new_user` reescrita: o banco define o estado inicial — convidado por
  admin (cargo nos metadados) entra `ativo` com papel; auto-cadastro entra
  `pendente_aprovacao` **sem papel** (antes, todo usuário novo ganhava
  `comercial` automaticamente).
- Backfill com salvaguarda: se a reconciliação fosse deixar o sistema sem
  administrador ativo, a migration aborta sem alterar nada.
- App: removida a edição livre de cargo no perfil (agora só leitura) e o
  cadastro deixou de enviar `cargo`/`status`.

**Notificações** — `notify_visita_status` (SECURITY DEFINER) substitui
`notify_visita_aprovada` e cobre os três eventos: `aguardando_aprovacao` →
gestores, `aprovada` e `reprovada` → técnico. Os inserts client-side de
`pre-envio.tsx` e `visita.$id.tsx` foram removidos (eram bloqueados pela RLS
e falhavam em silêncio; mantê-los junto com o trigger geraria duplicidade).

**Status legados** — `aprovado`/`reprovado` normalizados para o feminino que o
app entende. O SELECT de verificação lista os status distintos em uso.

**RLS** — `visita_orcamentos`, `visita_blocos`, `visita_bloco_itens` e
`fotos_visita` deixaram de aceitar qualquer autenticado: agora exigem ser o
técnico responsável pela visita ou um gestor, via as funções novas
`is_gestor(uuid)` e `pode_acessar_visita(uuid)` (SECURITY DEFINER, para não
recursar na RLS de `visitas_tecnicas`). Essas duas funções são a base das
policies das tabelas de OS nas etapas seguintes.

**Técnicos** — a seleção de técnico responsável (tela de nova visita e
`VisitaForm`) passou a listar só perfis com cargo `tecnico`; antes oferecia
qualquer usuário ativo, inclusive admins.

**Fora do escopo, por decisão:** os enums de OS (`os_tipo`, `os_status`,
`os_prioridade`) e o `src/lib/os-status.ts` foram adiados para a etapa que
cria as tabelas de OS — enum sem tabela não é verificável pelo SELECT de
conferência e tende a divergir. `types.ts` continua defasado: regenerar pela
Lovable quando as tabelas de OS existirem.

---

## 12. Registro da Etapa 1 (2026-08-17)

Implementada em `supabase/migrations/20260817120000_etapa1_clientes.sql` +
telas novas. `clientes` deixou de ser uma linha descartável por visita.

**Tabela promovida a registro mestre.** Ganhou endereço (com coordenadas),
contatos de síndico e zelador, `nome_predio`, `tipo_local`, quantidade de
unidades e de acessos, observações, `situacao` (prospecto / ativo / inativo) e
`created_by`. `owner_id` deixou de ser obrigatório: o cadastro é da empresa,
não de um usuário. RLS nova: todos os autenticados leem (o técnico precisa dos
dados do cliente em campo), gestor cadastra e edita, admin exclui.

**Backfill em duas partes, por segurança.** A migration faz só o que é
inequívoco: cada cadastro antigo sem endereço que é referenciado por
exatamente uma visita herda os dados daquela visita, e a situação vira `ativo`
se a visita foi aprovada. A consolidação de duplicados — o caso ambíguo — é
assistida na tela `/clientes/migrar`: as visitas são agrupadas por prédio, o
gestor revisa nome, endereço, contatos e contagem de visitas, e um clique cria
(ou reaproveita) um cliente, aponta todas as visitas do grupo para ele e
descarta os cadastros que ficaram sem uso. Nada é fundido automaticamente.

**Telas.** `/clientes` (busca por nome, endereço ou síndico; filtros por
situação; aviso quando há cadastros a consolidar), `/clientes/novo`,
`/clientes/$id` (ficha com dados, contatos, observações e histórico de visitas
clicável) e `/clientes/migrar`. Cadastro e edição são restritos a gestores
tanto na interface quanto na RLS. Entrada pelo Painel Gerencial, ao lado de
Usuários.

**Nova visita.** O passo "Local e Cliente" começa por um seletor de cliente:
escolher um cadastro existente preenche prédio, tipo, endereço, coordenadas e
contatos; deixar em branco cria um cadastro completo (com endereço) a partir
dos dados da visita, em vez da linha só com o nome do síndico que o app criava
antes.

**Correções vindas da revisão adversarial** (vale registrar porque viram regra
para as etapas seguintes):

- `min(uuid)` **não existe** no PostgreSQL do Supabase (só no 18+). Como o SQL
  Editor roda o script numa transação, o erro desfaria a migration inteira —
  e o app já não envia `owner_id`, então o rollback quebraria a criação de
  clientes em produção. Trocado por `(array_agg(id))[1]`.
- A FK de `owner_id` continuava `ON DELETE CASCADE`: excluir um usuário no
  dashboard apagaria os clientes dele e órfanaria as visitas. Agora é
  `SET NULL`, coerente com o cadastro ser da empresa.
- `DELETE` em `clientes` era restrito a admin, mas a tela de consolidação é
  liberada a gestores — a RLS filtraria o delete **em silêncio** (PostgREST
  devolve 204 sem erro) e os duplicados voltariam no aviso para sempre. A
  policy virou `is_gestor` e o erro do delete passou a ser propagado.
- A chave de agrupamento usava só o nome do prédio: "Edifício Central" em
  endereços diferentes cairia no mesmo grupo, e a consolidação fundiria dois
  condomínios sem desfazer. Agora a chave é nome **e** endereço — separar
  demais é recuperável, fundir não.
- Um cadastro compartilhado por dois grupos era renomeado a cada consolidação,
  levando as visitas do outro grupo. Só serve de destino um cadastro cujas
  visitas estejam todas no grupo; sem candidato limpo, cria-se um novo.
- Cadastros vazios (sem endereço e sem visita) não apareciam em lugar nenhum e
  mantinham o aviso aceso: ganharam a seção "Cadastros vazios" com descarte.
- Sem vínculo de cliente, o submit da nova visita procura um cadastro
  equivalente antes de criar — "Desvincular" não gera mais duplicata.
- Cliente vinculado com dados editados na visita: caixa "Atualizar o cadastro
  do cliente com os dados desta visita" (marcada por padrão, aparece só quando
  há divergência), para a OS não ler contato velho na ficha.

**Dívidas conhecidas, não bloqueantes:** `consolidarGrupo` faz três chamadas
sem transação (uma RPC `SECURITY DEFINER` resolveria consolidação, repontamento
e limpeza atomicamente); as listagens não paginam (limite implícito de 1000
linhas do PostgREST); e `types.ts` continua defasado.

**Pendente para a Etapa 2:** a ficha do cliente ainda não mostra inventário de
equipamentos nem ordens de serviço — as duas seções entram nas etapas 2 e 3,
nesta mesma tela.
