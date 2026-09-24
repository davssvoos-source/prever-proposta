# O que depende do Davi — a lista única

> **Para que serve.** Tudo o que está parado esperando uma decisão, um gesto ou
> um dado do Davi, num lugar só. Antes deste arquivo (22/09/2026) a lista estava
> espalhada por quatro documentos — `ESTADO_ATUAL.md` §6 e §7, a seção da revisão
> sistêmica, `PENDENCIAS_TECNICAS.md` e `PLANO_V0.1.md` §4 —, e ninguém conseguia
> responder "o que falta de mim?" sem ler os quatro.
>
> **Como funciona.** Cada item diz o que é, **o que acontece enquanto ele não
> decide** (porque quase tudo tem um custo silencioso de esperar) e onde está o
> detalhe. Quando um item fecha, ele sai daqui e vira regra em `PRODUTO.md`.
> Os detalhes técnicos continuam em `PENDENCIAS_TECNICAS.md`; aqui fica só o que
> precisa da cabeça do Davi.
>
> **23/09/2026 — a resposta.** O Davi respondeu item a item (*"Atualização:
> versão 1.0.3"*). O que fechou virou as regras **R306–R322** e está na
> v1.0.3; o que ficou está abaixo. Fechados: G1 (U155 rodada), G2 (Vinicius é
> Gestor), G4 (v1.0.2 no ar), D1 (R306), D2 (R307/R308), D3 (R309, Opção C),
> D4 (R310), D5 (R311), D6 (R312), M2 (R317) e a parte ditada da M1 (R313–R316).

---

## 1. Gestos rápidos — minutos, e destravam gente parada

| # | O quê | Enquanto não fizer |
|---|---|---|
| **G3** | **Conferir a variável `SITE_URL`** no serviço do servidor Windows (com o T.I.) — *"vamos deixar em aberto pois ainda preciso discutir com o T.I"* | O e-mail de convite leva o convidado para o endereço da **Lovable**, não para o servidor da empresa. Detalhe: P76. |
| **G5** | **Rodar as três migrations da v1.0.3** no SQL Editor, nesta ordem: `20261013090000_u158_ticket_medio_da_proposta.sql`, `20261014090000_u159_avisos_so_para_o_administrador.sql`, `20261015090000_u160_todos_leem_todos_os_clientes.sql` | Sem a **U158** o ticket médio não grava (o PDF sai, o valor não fica). Sem a **U159** comercial e SAC continuam recebendo os avisos automáticos. Sem a **U160** quem não é gestor nem operacional continua vendo a lista de clientes podada. |
| **G6** | **Instalar a v1.0.3 no servidor** (`dist-windows/Prever-1.0.3.zip`) — DEPOIS de rodar as três migrations | O servidor fica na v1.0.2: nada do dia 23/09 chega a quem usa pelo endereço da empresa. |
| **G7** | **Testar a tela do técnico no celular** com um usuário TÉCNICO da Equipe Técnica (*"Eu quero começar a testar a tela deles"*) — pelo endereço do servidor, depois do G6 | Os três fluxos (R313–R316) foram construídos sem sessão de técnico aberta; o que estiver fora do lugar só aparece no seu teste. |

---

## 2. Decisões de produto — eu implemento depois que você decidir

### D7 · Q13 — três telas legadas *(você pediu os links)*

Os endereços seguem o padrão abaixo. O `<id>` é o de qualquer visita técnica —
abra uma no Painel Comercial e copie o trecho da barra de endereço depois de
`/visita/`:

| Tela | Endereço |
|---|---|
| Projeto (a tela antiga do projeto) | `http://192.168.10.182:5555/projeto/<id>` |
| Visita pendente (o formulário antigo) | `http://192.168.10.182:5555/visita/<id>/pendente` |
| Editar visita (gerencial) | `http://192.168.10.182:5555/gerencial/visita/<id>/editar` |

*Enquanto não decide:* as três continuam no ar, sem link em lugar nenhum. Diga
"ficam" ou "saem" — sair é uma leva pequena (rota vira redirect, tela some da
matriz de permissões).

---

## 3. O que você disse que vai mandar

| # | O quê | O que destrava |
|---|---|---|
| **M1b** | **O conteúdo dos checklists da preventiva, por tipo de bloco** (Controle de Acesso de Pedestres, CFTV, Alarme, Totem de Monitoramento, Cerca Elétrica…) — *"Deveremos criar as regras ainda"* (R315) | O mecanismo já monta um roteiro por bloco do cliente; hoje ele usa os modelos de agosto. Com o seu conteúdo, cada tipo de bloco ganha o checklist certo (é uma migration de dados, sem tela nova). |
| **M3** | **Os documentos do ERP com equipamentos por cliente** | Fase H.5. Depois vem a API do QAP (contato: Lopes). |
| **M4** | **Os dados do passado das propostas** *(R302)* | Entram por migration, e o dashboard do Comercial passa a mostrar histórico de verdade — inclusive o ticket médio (R306) das antigas, se você tiver os valores. |

---

## 4. Infraestrutura — para validar com o T.I.

### I1 · Sair da Lovable

**É fácil e está documentado** (`ONBOARDING.md` §6). O passo zero é confirmar,
em supabase.com, que o projeto Supabase está na conta da **empresa** e não numa
conta pessoal ou da Lovable. São dois minutos e é o único ponto que pode
surpreender.

### I2 · Sair do Supabase — cuidado com a expectativa

Não é "trocar de hospedagem". O app depende do Supabase em seis frentes: login
em 38 arquivos, 31 funções de banco, 2 áreas de arquivos, atualização em tempo
real em 6 telas, 3 funções de servidor e 9 tarefas agendadas.

**O caminho que preserva o código é auto-hospedar o Supabase** no servidor da
empresa, via Docker. Reescrever para um Postgres comum são meses de trabalho.

### I3 · Backup — o assunto que você chamou de emergencial

Hoje o backup é o que o Supabase dá no plano atual. As duas opções:

- **Supabase gerido**, plano Pro: recuperação para qualquer ponto no tempo.
- **Auto-hospedado**: cópia diária mais o registro contínuo, feitos pelo T.I.

**Os dois exigem teste de restauração, não só de cópia.** Backup que nunca foi
restaurado é uma pasta grande, não um backup.

---

## 5. O que fechou em 23/09/2026 (para não perder o rastro)

| Era | Virou |
|---|---|
| G1 rodar a U155 | rodada em 23/09 |
| G2 trocar o cargo do Vinicius | Gestor desde 23/09 (`PRODUTO.md` §2.1) |
| G4 instalar a v1.0.2 | no ar na empresa desde 23/09 |
| D1 ticket médio | **R306** — os dois valores, separados |
| D2 técnico + operacional na mesma atividade | **R307** (apoio de qualquer cargo, formato por participante) e **R308** (só agenda com técnico) |
| D3 tipografia | **R309** — Opção C, tudo numa entrega (a leva seguinte à 1.0.3) |
| D4 convites aceitos | **R310** |
| D5 texto da cobrança (Q8) | **R311** |
| D6 avisos automáticos | **R312** — só o administrador |
| M1 fluxos do técnico | **R313–R316** (falta o conteúdo dos checklists: M1b) |
| M2 impacto por tipo | **R317** — manual por enquanto |
| os seis pedidos de tela | **R318–R322** |

---

## 6. Onde cada coisa mora

| Documento | O que tem |
|---|---|
| **Este arquivo** | tudo o que depende de você |
| `ESTADO_ATUAL.md` | o retrato: onde estamos, o que está no ar, o que falta rodar |
| `PRODUTO.md` | todas as regras (R1 a R322), com as suas frases |
| `PENDENCIAS_TECNICAS.md` | dívida técnica (P-série) — não precisa de você |
| `REVISAO_TIPOGRAFIA_2026-09-15.md` | os 66 desvios da frente V (R309 manda aplicar todos) |
| `VERSOES.md` | o que entrou em cada versão instalada |
| `PLANO_UNIFICACAO.md` | o diário: o porquê de cada decisão técnica |

---

> **Versão em Word.** `docs/Decisoes-Pendentes-Prever.docx` foi escrita em
> 22/09/2026, ANTES da sua resposta — ela ainda lista o que já fechou. Quando
> quiser a lista nova em Word, peça; ela é refeita com
> `node scripts/gerar-docx-decisoes.cjs` depois de atualizar o roteiro do script.
