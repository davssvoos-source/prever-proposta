# Estado atual do projeto — leia isto primeiro

> **Para que serve.** Este arquivo é a memória do projeto que viaja com o
> repositório. Numa máquina nova (ou numa sessão nova do assistente, que
> começa sem memória local) ele responde em cinco minutos: onde estamos, o
> que está pendente, o que o Davi já decidiu e o que ele ainda vai mandar.
> **Atualize-o no fim de cada entrega** — é o passo 7 do ciclo de trabalho em
> `CLAUDE.md`. Se ele discordar do código ou de `docs/PRODUTO.md`, eles
> ganham — e isto aqui se corrige.

Última atualização: **2026-09-08** · última regra: **R210** · último diário:
**U116** · verificador: **3.078 asserções, 0 falharam** · `tsc`: baseline
**57** · migrations rodadas até a **U100**; **pendentes: U106** (apaga a linha
`mapa` da matriz) **e U109** (o patrimônio do QAP: duas tabelas, a tela nova
entra na matriz, a tela "Catálogo" sai). A **U110** (os 4.241 equipamentos do
QAP) **já existe** — a extração rodou em 07/09/2026.

---

## 1. O sistema em um parágrafo

**Prever Proposta** é o sistema interno do Grupo Prever (segurança
eletrônica: portaria remota, monitoramento, controle de acesso). Nasceu como
ferramenta de orçamento/proposta comercial e virou o sistema de **atividades**
da empresa: chamados técnicos de campo (a dupla vai ao cliente), atividades
internas das outras equipes (T.I., controle patrimonial, comercial),
propostas comerciais, clientes e seus equipamentos, contratos, cobrança e
painéis. Substitui o Notion e o Gestor OS. React + TypeScript + TanStack
Start, Supabase (Postgres com RLS), deploy automático pela Lovable a cada push
em `main`. O usuário que dita as regras é o **Davi**; o gestor da equipe
técnica de campo é o **Vinicius**.

## 2. A ordem de leitura

1. `CLAUDE.md` — o método (ciclo de trabalho, migrations, invariantes,
   armadilhas). Cinco minutos.
2. **Este arquivo** — onde estamos. As três skills em `.claude/skills/`
   carregam sozinhas quando a tarefa pede: **organizador** (toda sessão:
   rituais, documentos mestre, sumários), **designer** (interface), **banco**
   (migrations). Cada documento mestre tem um **sumário gerado** no topo —
   navegue por ele, não leia de ponta a ponta.
3. `docs/CONTEXTO_OPERACAO_TECNICA.md` — a operação técnica ditada pelo Davi:
   quem é quem, as três atividades da técnica, a validação do gestor.
4. `docs/CONTEXTO_ESTRUTURA_ATIVIDADES.md` — a estrutura das atividades
   ditada pelo Davi: os tipos de demanda, a matriz de campos, as decisões
   D1–D9 (várias já revistas — ler as notas).
5. `docs/PLANO_V0.1.md` — o plano por fases e as perguntas Q1–Q23 com as
   respostas anotadas.
6. `docs/PRODUTO.md` — TODAS as regras (R1–R173). Não se lê de ponta a ponta:
   consulta-se pela regra citada no código.
7. `docs/manual/README.md` — o manual por segmento; ler o do segmento em que
   se vai trabalhar. Para interface, a **skill de designer**
   (`.claude/skills/designer/SKILL.md`) é o método, e o
   `DESIGN_SYSTEM.md` é a fonte dos tokens.
8. `docs/PLANO_UNIFICACAO.md` — o diário (U1–U100). É onde está o PORQUÊ de
   cada decisão técnica; ler a entrada citada quando um trecho de código
   parecer estranho.

## 3. Onde estamos (04/09/2026)

**Fases do plano** (`PLANO_V0.1.md` §6): A (dashboard da Operacional
Técnica) e B (o "+") entregues na U93; o núcleo da H (a estrutura das
atividades, R137–R150) na U96. Pendentes: **B2** (a Início do técnico no
celular), **C** (a validação do gestor — agora com a forma decidida, R155),
**D** (a ficha do cliente como centro), **E** (APIs e QAP), **F** (preventiva
por sistema), **G** (o corte do Gestor OS), **H.1–H.6**.

**O que foi entregue em 03–04/09/2026**, uma linha por leva:

| Leva | O quê |
|---|---|
| U93 | dashboard da Operacional Técnica (R125) e o "+" (R126) |
| U94 | Administrativo com abas (R131), contratos na ficha (R132), calendário mensal/semanal (R133) |
| U95 | mapa de aparelhos (R134), tela da atividade com seletores e editor (R135) |
| U96 | cards da Início com a cor só na borda (R136); a estrutura das atividades (R137–R150); migration U96 |
| U97 | mais de um cliente por atividade (R151), arrastar no calendário muda o prazo (R152), card da semana enxuto (R153), tema claro v10 (R154) |
| U97b–U99 | as respostas do Davi às Q1–Q22 viram R155–R172; migration U99 (limpeza, catálogo, `data_agendada`) |
| U100 | portaria autônoma e presencial como grupos de clientes (R173); migration U100; este arquivo |
| U100b | a U100 rodou: os quatro grupos liberados (P58); o fallback da ordem de deploy da U96 saiu (P60); `data_agendada` já é lida; revisão do dia |
| U101 | o sistema como ferramenta de trabalho (R174): painel da Início recolhível (R175), avatar sem glow (R176), etiqueta sólida (R177) — e a **skill de designer** em `.claude/skills/designer/` |
| U102 | as skills **organizador** e **banco**; `scripts/sumario.cjs` e os sumários gerados em oito documentos mestre; passo 8 do ciclo |
| U103 | a Início revista pelo Davi: margem de cima (R178), colunas na largura da tela (R179), concluída fica sem filtro (R180), ordem das colunas por arrasto (R181), ordenação escrita (R182) |
| U104 | o Configurador rápido revisto pelo Davi: toda a informação no cabeçalho em botões discretos (R183), Problema + Diagnóstico com a barra 1→2 (R184), comentários e linha do tempo abaixo (R185); a escala CINZA nasce em `paleta.ts` (R186 — o resto do sistema na U108) |
| U105 | o Calendário revisto pelo Davi: card com fundo na cor do status (R187), rostos sem anel (R188), meses seguintes ao rolar até +3 (R189), dica expandida ao passar o mouse (R190), sem botão "Hoje" (R191) |
| U106 | o Mapa sai — /mapa redireciona, botão fora do Comercial, chave fora do catálogo, migration U106 apaga a linha (R192); o Administrativo vira duas colunas Usuários | Permissões com as APIs por botão (R193) |
| U107 | a Nova Visita Técnica numa tela só — três colunas (Local · Contatos e serviços · Agendamento), design system no lugar da paleta local, todas as regras da proposta preservadas (R194) |
| U108 | o cinza neutro no sistema inteiro — 29 hexes azulados varridos em cem arquivos, texto na mesma luminância, duas asserções travam a volta (R186 aplicada); tipografia estratégica — títulos de página 700, valor de campo 400, rótulo pequeno 600, só {100, 400, 600, 700} (R195) |
| U109 | o patrimônio do QAP: `catalogo_equipamentos` + `equipamentos_patrimonio` com RLS, o módulo puro de importação, a tela "Equipamentos cadastrados" (`/equipamentos`), o bloco de equipamentos na ficha do cliente e a saída da tela "Catálogo" (R196–R199) |
| U110 | os **4.241 equipamentos do QAP** importados: retrato cru versionado, 429 variações de catálogo, chave `qap:<id>` (idempotente), vínculo de local feito no SQL contra a base viva e a relação dos 40 locais fora da base (R196–R199) |
| U111 | sistemas instalados = **blocos** criados no app + **equipamentos do QAP vinculados** (fila com seleção em lote, mover/desvincular dentro do bloco, mesmo cliente conferido no dado); a **ficha do cliente v2** — cabeçalho de página, duas colunas, configuração em duas colunas (R200–R201) |
| U112 | os blocos são **nomeados direto** na ficha (sem a estrutura por perguntas, que fica no orçamento; nomes do Paineiras sugeridos por tipo) e a ficha vira **uma página só** — sem modo de configuração, três cards que editam no lugar (R202–R203) |
| U113 | a tela Administrativo ganha **cancelar convite** na lista de Convites Pendentes — muda só o status em `convites`, não toca na conta já criada pelo envio (R204) |
| U114 | a ficha do cliente **preenche a largura** (`.pagina-larga`, R205); o vínculo equipamento → bloco é **por arrasto** em dois painéis, Blocos com sub-itens | Sem bloco (R206, lógica pura em `vinculo.ts`); botões **WhatsApp / copiar e-mail / copiar endereço** nos cards (R207) |
| U115 | os painéis Blocos e Sem bloco **rolam por dentro** (teto min(64vh, 720px), mesma altura no desktop, só a lista rola) — a página não cresce com os equipamentos (R208) |
| U116 | a ficha em **três colunas de desktop** (`.ficha-grid`: identidade \| local \| atividades, com a forma do conteúdo — Atividades é a coluna alta de cards, rolando por dentro) (R209); o **serviço prestado vira item do card O local** e a linha Coordenadas sai (R210) |

## 4. Banco: migrations

O repo **nunca aplica** migration: o Davi roda à mão no SQL Editor do
Supabase, na ordem dos nomes de arquivo (`supabase/migrations/`). Cada uma é
idempotente e termina com uma conferência obtido × esperado × veredito.

- **Rodadas até a U100** (confirmado pelo Davi em 04/09/2026).
- **Pendente: U106** (`20260917090000_u106_mapa_sai.sql`) — um DELETE
  idempotente da chave `mapa` em `permissoes_tela`, com conferência e
  DESFAZER. Independe das anteriores e da ordem de deploy; até rodar, a linha
  órfã fica no banco sem ninguém ler.
- **Pendente: U109** (`20260918090000_u109_patrimonio_do_qap.sql`) — cria
  `catalogo_equipamentos` e `equipamentos_patrimonio` (com RLS), põe a tela
  `equipamentos` na matriz e apaga a chave `admin`. Até rodar, a tela
  "Equipamentos cadastrados" mostra o aviso de que a estrutura não existe (o
  42P01 é tratado) e o bloco de equipamentos da ficha do cliente não aparece.
- **Pendente: U110** (`20260919090000_u110_equipamentos_do_qap.sql`, 533 KB) —
  os 4.241 equipamentos e as 429 variações de catálogo. **Rodar DEPOIS da
  U109.** Idempotente (variação por `chave`, item por `chave_importacao`
  `qap:<id>`); os dois UPDATEs de vínculo só preenchem o que está nulo, então
  rodar de novo não desfaz correção feita à mão. A última consulta dela
  imprime a relação dos locais que não casaram com a base. Para regerar:
  `node scripts/gerar-migration-equipamentos.cjs` (lê
  `docs/importacao/qap-equipamentos.json`, o retrato cru do QAP).
  A **U109 já rodou** em 07/09/2026 (dez itens de conferência ok). A primeira
  tentativa da U110 abortou em **42P10** — índice parcial exige o predicado
  repetido no `ON CONFLICT` — e está corrigida; nada foi aplicado por ela.
- **O mecanismo da regra 5** (o push publica antes da migration rodar): uma
  coluna ou valor novo que dependa de CHECK nasce em duas listas — a que o app
  RENDERIZA e a que ele OFERECE para gravar (`TIPOS_SISTEMA_NAO_OFERECIDOS`
  em `inventario.ts`, `SERVICOS_NAO_OFERECIDOS` em `clientes/data.ts`,
  `NAO_OFERECIDOS` em `chamado-status.ts`). Hoje as três estão vazias; a
  próxima migration que trouxer um valor novo usa uma delas até o Davi rodar.
- A próxima migration provável é a **limpeza de schema** (P56: a coluna morta
  `chamados.sprint` e o gatilho que a preenche — exige reescrever o gatilho da
  linha do tempo, por isso não entrou de carona) e o que os fluxos da área
  técnica pedirem.

## 5. Decisões recentes que mudam o rumo (04/09/2026)

Todas em `PRODUTO.md`, com a frase do Davi. As que reorganizam o trabalho:

- **R155** — a validação do executado é uma **atividade do Vinicius**, com
  card na Início dele; a proposta comercial passa do técnico para o Davi
  depois da visita (card na Início dele).
- **R156** — a área técnica tem só **corretiva, preventiva e implantação**;
  "Operacional" é das outras equipes; **vistoria = validação** (a R112 será
  reescrita com os fluxos).
- **R157** — regime de equipamento é o do **contrato do condomínio**; exceções
  no contrato; nada por equipamento.
- **R161** — "A cobrar este mês" é só o que **falta faturar**.
- **R162** — o técnico dá baixa; o gestor **valida** — dois estados.
- **R163** — o técnico de campo **não abre chamado** (por enquanto); o "+" dele
  é a porta do plantão.
- **R168** — a atividade interna tem **data agendada** além do prazo e o
  quadro ganha a coluna **"Agendados"** (coluna do banco pronta na U99; a tela
  vem com os fluxos).
- **R169** — a **preventiva TEM impacto operacional** (D1 revista).
- **R170** — Visita Técnica e Proposta Comercial são **duas atividades** no
  mesmo fluxo (D5 revista): a visita feita gera a proposta para o Davi.
- **R172** — a visita comercial **trava a agenda** do técnico (Fase H.1).
- **R173** — **Portaria Autônoma** e **Portaria Presencial** são grupos de
  clientes, ao lado de Portaria Remota e Monitoramento.
- **R174** — **o sistema é ferramenta de trabalho: brilho é exceção.** É o
  princípio que governa decisão de interface daqui em diante; R175 (painel
  recolhível), R176 (avatar sem glow) e R177 (etiqueta sólida) são as
  primeiras consequências. A **skill de designer**
  (`.claude/skills/designer/`) carrega este princípio junto com o método.
- **R183–R185** — o **Configurador rápido** inverteu a hierarquia: o cabeçalho
  é a informação (botões discretos), o corpo é o **registro** (Problema →
  Diagnóstico com a barra 1→2 → comentários → linha do tempo).
- **R186** — **o fundo é só cinza**, sem azul. A escala `CINZA` está em
  `paleta.ts`; a **U108** aplicou ao sistema inteiro (superfícies e texto, na
  mesma luminância).
- **R187–R191** — o **Calendário**: card tingido pela cor do status, rostos sem
  anel, meses seguintes ao rolar (+3), dica expandida no hover, sem "Hoje".
- **R192–R193** — a tela **/mapa saiu** (redirect; migration U106 pendente) e
  o **Administrativo** virou duas colunas, Usuários | Permissões, com as APIs
  por botão.
- **R194** — a **Nova Visita Técnica** é uma tela só, em três colunas, no
  design system; as regras da proposta (R147, R21/R22, residência, R114, R170)
  continuam.
- **R195** — **tipografia estratégica**: quatro pesos com função (100, 400,
  600, 700); título de página 700; valor de campo 400; rótulo pequeno 600.
- **R196–R199** — o **patrimônio do QAP**: sete campos (o "Tipo de Categoria"
  é o nome do equipamento), identificação opcional, o catálogo é a tela
  **Equipamentos cadastrados** (a tela "Catálogo" saiu) e local casa **exato**
  ou vira relatório. O vínculo de cada item com o **bloco** do condomínio é o
  passo seguinte. A importação (U110) já está pronta: **4.241 itens, 429
  variações**; 40 locais do QAP não estão na base e esperam decisão do Davi
  (nossos próprios locais, pessoas por primeiro nome, e clientes a conferir —
  ver `docs/importacao/locais-desconhecidos.md`).
- **R200–R201** — **sistema instalado é um bloco** criado no app; o equipamento
  do QAP é **vinculado** ao bloco (fila "Equipamentos a vincular", em lote); a
  **ficha do cliente v2** em cabeçalho + duas colunas. Pendência de decisão:
  a escrita do vínculo é de gestor com vínculo ativo — se o Vinicius for
  técnico no cadastro, ele não vincula.
- **R202–R203** — em cliente que já é nosso **o bloco é só nomeado** (o
  Paineiras: eclusa de pedestres, porta de carga/descarga, eclusa veicular,
  porta do armário de encomendas, CFTV, cerca elétrica, totem, central de
  portaria remota) e recebe os equipamentos do QAP — a estrutura por
  perguntas ficou no orçamento, o editor da R63 saiu da ficha; e a ficha é
  **uma página só**, sem modo de configuração: os cards O local, Contatos e
  Estrutura editam no lugar.
- **R204** — a tela Administrativo ganha **cancelar convite** na lista de
  Convites Pendentes; só muda o status em `convites`, não mexe na conta (já
  criada no envio, R59) nem no profile.
- **R205–R207** — a ficha do cliente é de **desktop**: preenche a largura da
  janela (a coluna dos sistemas cresce, a identidade tem teto); o vínculo é
  **por arrasto** — Blocos (com sub-itens) | Sem bloco, arrastar vincula,
  arrastar de volta desvincula, marcar vários e arrastar leva todos, seletor
  como caminho sem arrasto; contatos com botões de WhatsApp e copiar e-mail,
  endereço com copiar. **R208:** os dois painéis rolam por dentro, com teto de
  altura — a página não cresce com a quantidade de equipamentos.
- **R209–R210** — a ficha em **três colunas de desktop** (identidade | local |
  atividades), cada uma com a forma do conteúdo; Atividades é a coluna ALTA de
  cards, rolando por dentro. O **serviço prestado** é item do card O local
  (edição pelo lápis, grava com o card); a linha Coordenadas saiu.

## 6. Perguntas em aberto

Das 23 perguntas do plano, ficam duas:

- **Q8** — o texto padrão da cobrança sugerida e o `tipo_servico` padrão.
  Adiada pelo Davi: "preciso do Vinicius para entender melhor isso".
- **Q13** — as três telas legadas (`/projeto/$id`, `/visita/$id/pendente`,
  `/gerencial/visita/$id/editar`): o Davi quer vê-las antes de decidir. Os
  endereços estão anotados na Q13 de `REVISAO_2026-09-03.md`.

## 7. O que o Davi disse que vai mandar (cobrar dele)

1. **A estrutura dos fluxos de cada tipo de demanda da área técnica** —
   corretiva, preventiva, implantação: campos de cada um e o caminho. **É o
   próximo passo**: destrava B2 (Início do técnico), C (validação, R155/R162),
   H.1 (mini-calendário e a visita que trava a agenda, R172), a tela da data
   agendada (R168), a proposta em duas atividades (R170) e a revisão da lista
   de tipos do chamado de campo (`TIPOS_DA_NATUREZA.campo`, R156).
2. **A relação tipo de atividade → impacto operacional**, para automatizar
   (hoje é escolha de quem cria, R142/R169).
3. **Os documentos exportados do ERP com os equipamentos por cliente** (Fase
   H.5) — depois vem a API do QAP (R160: diária + botão Sincronizar; contato:
   Lopes, desenvolvedor do QAP ERP; só quando o sistema estiver redondo).
4. **A leitura da proposta aprovada (PDF) pela IA** para criar as atividades
   da implantação (R148, H.6).

## 8. Quem é quem (resumo — o completo está em `CONTEXTO_OPERACAO_TECNICA.md` §1)

| Pessoa | Papel | Cargo no app |
|---|---|---|
| Davi | dono do produto; dita as regras; aprova e envia propostas | admin |
| Vinicius | gestor da equipe técnica de campo; valida o executado e lança cobrança | admin |
| Rubia | supervisora do atendimento da Portaria Remota; abre e gerencia chamados (R158) | sac |
| Erik, Nicholas | T.I. | tecnico (equipe T.I.) |
| Gilleno | Controle Patrimonial (opera o QAP ERP) | tecnico (equipe Controle Patrimonial) |
| Breno e os líderes das duplas | técnicos de campo | tecnico |
| Lopes | desenvolvedor do QAP ERP (externo) — a integração, quando chegar a hora | — |

## 9. Como começar uma sessão

```bash
node scripts/verificar-logica.cjs        # tem de terminar "0 falharam"
npx vite build                           # tem de completar
npx tsc --noEmit | grep -c "error TS"    # baseline 57; não crie novos
```

Depois: `git status` limpo e `main` igual a `origin/main`; ler a §4 (há
migration pendente?) e a §7 (o que cobrar do Davi). Quando o Davi disser
"inicie a sessão", a resposta é o resumo destas seções, não um relatório.
