# Estado atual do projeto — leia isto primeiro

> **Para que serve.** Este arquivo é a memória do projeto que viaja com o
> repositório. Numa máquina nova (ou numa sessão nova do assistente, que
> começa sem memória local) ele responde em cinco minutos: onde estamos, o
> que está pendente, o que o Davi já decidiu e o que ele ainda vai mandar.
> **Atualize-o no fim de cada entrega** — é o passo 7 do ciclo de trabalho em
> `CLAUDE.md`. Se ele discordar do código ou de `docs/PRODUTO.md`, eles
> ganham — e isto aqui se corrige.

Última atualização: **2026-09-15** · última regra: **R304** · último diário:
**U154** · verificador: **3.577 asserções, 0 falharam** · `tsc`: **0** (o
baseline de 57 erros foi a ZERO na U138).

Banco — **Pendentes: U153 e U154**, nesta ordem.
**U153** (`20261010090000_u153_todos_os_chamados_sai.sql`) — apaga a chave
`chamados.painel` da matriz (R301: a tela "Todos os chamados" saiu; a rota
redireciona para a Operacional). Inofensiva se demorar: sobra uma linha órfã.
**U154** (`20261011090000_u154_o_cargo_gestor.sql`) — o cargo **GESTOR** (R304):
enum, os dois CHECKs, `salvar_permissoes`, `handle_new_user`, `is_gestor`,
`pode_ver_financeiro` e a semente da quinta coluna. Aborta se a U153 não tiver
rodado. **Depois dela**, o Davi troca o cargo do Vinicius para Gestor na aba
Usuários — a migration não faz isso (não sabe o e-mail de ninguém). Sem a U154
ninguém consegue RECEBER o cargo (o CHECK recusa); nada quebra.

**U150 e U152 RODADAS em 15/09/2026** (conferido no banco: `chamados.retornos`,
`agenda_campo.resultado`, `apoio_automatico(uuid, timestamptz)` existem). Rodadas
em 13/09: U131, U132, U134 e **U136**; em 14/09: U137, U139, **U142**, **U143**,
**U144** e **U147**.

**Servidor: v0.0.7** (192.168.10.182:5555 · grupoprever.ddns.net:5555). O último
pacote gerado é a **v1.0.1** (`dist-windows/Prever-1.0.1.zip`); a **v1.0.2** foi
para o `main` (a Lovable publica) e o pacote Windows dela sai quando o Davi pedir
— o que entrou em cada versão está em `docs/VERSOES.md`.

**A v1.0.2 PODE subir antes de rodar as migrations.** Sem a U153 sobra uma linha
órfã na matriz; sem a U154 o cargo gestor não existe no banco — o app já o aceita
nos tipos e na matriz, e nada quebra. A fila "Aguardando retorno" da Gestão
Técnica lê `chamados.retornos` (U150, rodada).

### A revisão sistêmica (15/09/2026) — v1.0.2: o que está de pé e o que espera o Davi

**O contexto.** O app entrou em **uso oficial** em 15/09/2026 (servidor da
empresa + DDNS; a Lovable só para ver rápido). O Davi abriu *"uma série de
alterações […] uma revisão detalhada e sistêmica de tudo o que temos hoje"* e
ditou seis frentes (R298–R303) e, no meio delas, o cargo Gestor (R304). Tudo o
que não depende dele está de pé; o que depende está listado abaixo.

**O que está de pé** (medido no navegador a 1366×768, dev server):
- **Gestão Técnica** (`/gestao-tecnica`): h1 22/700 no gutter de 24; pílula
  Fechamentos 40/raio 11 e os dois quadrados 42/raio 12 alinhados pelo centro;
  o dashboard (`DashboardOperacional`) na largura da coluna; os rótulos de seção
  12/700 `.16em`; o calendário do plantão SEM rolagem lateral (`scrollWidth` =
  `clientWidth` = 1074) — antes estourava. `/sobreaviso?mes=&dia=&visao=`
  chega em `/gestao-tecnica` com a mesma busca.
- **Operacional Técnica**: abre no quadro por dia (Seg–Sáb), HOJE em `#F8C811`
  com `aria-current="date"`, os outros dias em texto primário; sem o "Ver todos";
  `prever-operacional-{visao,eixo,lente}` gravados; o botão de ações 26×26 a 9px
  da borda direita e 10 da base do card; o pop-up abre no `<body>` com z 200 e
  três itens (Re-agendar · Desmarcar — desabilitado quando o chamado não tem
  data · Cancelar em vermelho); o passo de cancelar exige motivo (botão
  desabilitado vazio); Escape fecha. **Um defeito medido e corrigido:** o React
  esvazia `e.currentTarget` ao fim do handler e o pop-up recebia âncora `null`
  (`.closest` de null no console) — a âncora é capturada antes do updater.
- **Administrativo** e **Comercial**: implementados por dois agentes em paralelo,
  cada um revisado por um cético e corrigido (ver U153 no diário). O ticket
  médio NÃO entrou: o valor da proposta não é gravado em coluna nenhuma.

**O que espera o Davi:**
1. Rodar **U153** e **U154**, nesta ordem, e trocar o cargo do **Vinicius** para
   Gestor na aba Usuários (R304).
2. **Ticket médio** (R302): qual valor é o ticket — mensal recorrente,
   implantação, por forma de pagamento? Precisa de coluna nova + gravação na hora
   de gerar a proposta; até lá o dashboard tem quatro KPIs.
3. Os **dados do passado** das propostas (ele disse que vai passar à mão):
   entram como linhas de `visitas_tecnicas` com `proposta_enviada_em` e
   `servicos_propostos`, por migration.
4. **Convites pendentes que já entraram** (P75): marcar como aceito quando o
   GoTrue disser "already registered"? Decisão de produto.
5. **`SITE_URL` no servidor Windows** (P76): sem ela, o e-mail de convite (e o
   Reenviar) leva à Lovable. Conferir com o T.I. antes de tirar a Lovable.
6. **Quem é avisado** (P73): as listas de destinatários do banco não conhecem o
   gestor — importa no dia em que o Vinicius deixar de ser Admin.
7. **A frente V (R303)** — a auditoria de tipografia das oito páginas está em
   `docs/REVISAO_TIPOGRAFIA_2026-09-15.md` (66 desvios alta/média, por página, com
   o trecho literal e o pino que quebra). A §3 do DS foi corrigida. **Aplicar é
   leva própria** — muda hierarquia visível e dezenas de pinos; decidir se entra
   inteira, por página, ou só o mecânico (pesos 300/500 fora da escala, hex fora
   de paleta.ts, tamanhos quebrados).
8. **A hospedagem** — a orientação para validar com o T.I.: sair da Lovable é
   fácil (`ONBOARDING.md` §6; o passo zero é confirmar que o projeto Supabase é
   da empresa, em supabase.com). Sair do **Supabase** NÃO é "tirar uma
   hospedagem": o app depende de auth (38 arquivos), 31 RPCs, 2 buckets, realtime
   (6 arquivos), 3 Edge Functions e pg_cron (9 migrations). O caminho que preserva
   o código é **auto-hospedar o Supabase** (Docker) no servidor da empresa;
   reescrever para Postgres puro são meses. **Backup**: no Supabase gerido, o plano
   Pro tem PITR; auto-hospedado, `pg_dump` diário + WAL pelo T.I. — os dois
   caminhos precisam de teste de RESTAURAÇÃO, não só de cópia.

### A leva do Vinicius (14/09/2026) — o que está de pé e o que ainda é só regra

Ler isto antes de prometer qualquer coisa a alguém.

| regra | o quê | estado |
|---|---|---|
| R281 | o checklist não clica na linha de baixo | **no ar** (U141) |
| R282 | corretiva com dois textos (Problema · Solução) | ditada |
| R283 | o campo tem três tipos; vistoria vira interna | **no ar** (U146) |
| R284 | o campo não tem prazo; a prioridade orienta a data, e "atrasado" é a DATA MARCADA vencida | **no ar** (U147 no banco, U151 na tela) |
| R285 | a equipe vale do instante da troca; líder + N ajudantes | **no ar** (U142 + U145) |
| R286 | o retorno é a MESMA atividade, com "Retornado Nx" na etiqueta | **no ar** (U150 rodada em 15/09) — a fila "Aguardando retorno" está na Gestão Técnica (R300); o botão "Retorno" no card do técnico ainda não |
| R287 | duração estimada ao abrir o chamado | ditada |
| R288 | indisponível recusa; deslocamento ocupa a agenda | ditada |
| R289 | mapa de calor por equipe (por técnico quando solo) | ditada |
| R290 | 1x a 12x é da manutenção; obra segue em 60x | **já era assim** — a regra confirma e amarra os três lugares |
| R291 | quem lança escolhe o mês da cobrança | ditada |
| R292 | preventiva: uma atividade, roteiro de todos os blocos | ditada |
| R293 | baixa de equipamento gera UMA atividade para o Gilleno | ditada |
| R294 | operacional cria atividade, não executa chamado de campo | **no ar** (U144) |
| R295 | o quadro do Painel Operacional por estado/status/equipe/dia, e o card com a data que o estado pede | **no ar** (U148) — os três botões viraram o botão de ações do card (R301) |
| R296 | a barra do Operacional na régua da Início: indicadores recolhíveis, poucos controles, e ordem na lista | **no ar** (U149) |
| R297 | na abertura pergunta-se QUEM (a equipe sai); o apoio vem da LIDERANÇA, plural, com foto | **no ar** (U152 rodada em 15/09) |
| R298 | Administrativo: sem textos e sem KPIs, pílulas na régua, convites compactos com Reenviar | **no ar** (U153) |
| R299 | "Sobreaviso" → GESTÃO TÉCNICA: dashboard, Equipes e Fechamentos moram lá; a chave `sobreaviso` fica; `/sobreaviso` redireciona com a busca | **no ar** (U153) |
| R300 | na Gestão Técnica, indicadores → fila de decisão (retorno · cobrança) → plantão recolhível; o calendário cabe na tela | **no ar** (U153) |
| R301 | Operacional = a fila: quadro por dia como padrão, preferências no navegador, hoje dourado, botão de ações no card; "Todos os chamados" saiu | **no ar** (U153) — **falta rodar a U153** (a linha órfã da matriz) |
| R302 | Comercial: dashboard (período · serviço · funil · KPIs), filtro de Tipo de serviço, sem Clientes | **no ar** (U153) — o KPI **ticket médio** espera uma coluna e a decisão do Davi (qual valor) |
| R303 | títulos, tamanhos, cores e famílias das páginas principais numa escala só | **no ar** (U153) — ver a seção da revisão sistêmica |
| R304 | o cargo GESTOR (hoje o Vinicius): gestor, vê valores, não administra | tela **no ar** (U154) — **falta rodar a U154** e trocar o cargo do Vinicius na aba Usuários |

Fim de entrega:
`node scripts/fechar-entrega.cjs --versao X --regra Rn --diario Un`.
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
   - e `docs/CONTEXTO_VIATURAS.md` — o controle das viaturas por etiqueta
     NFC ditado pelo Davi (13/09/2026): o trecho como unidade, o km nas duas
     pontas, a folha do gestor, a chegada por localização (etapa 3).
5. `docs/PLANO_V0.1.md` — o plano por fases e as perguntas Q1–Q23 com as
   respostas anotadas.
6. `docs/PRODUTO.md` — TODAS as regras (R1–R304). Não se lê de ponta a ponta:
   consulta-se pela regra citada no código. O número cresce a cada entrega —
   navegue pelo **sumário do topo**, não por este contador.
7. `docs/manual/README.md` — o manual por segmento; ler o do segmento em que
   se vai trabalhar. Para interface, a **skill de designer**
   (`.claude/skills/designer/SKILL.md`) é o método, e o
   `DESIGN_SYSTEM.md` é a fonte dos tokens.
8. `docs/PLANO_UNIFICACAO.md` — o diário (U1–U100). É onde está o PORQUÊ de
   cada decisão técnica; ler a entrada citada quando um trecho de código
   parecer estranho.
9. `docs/VERSOES.md` — o que entrou em cada versão instalada no servidor
   (R229): a versão é o que muda no servidor; a migration é o que muda no
   banco; os dois andam juntos.

## 3. Onde estamos (15/09/2026)

**Fases do plano** (`PLANO_V0.1.md` §6): A (dashboard da Operacional
Técnica) e B (o "+") entregues na U93; o núcleo da H (a estrutura das
atividades, R137–R150) na U96. A **B2** (a Início do técnico no celular) saiu
na **U132** — o que resta dela são os quatro fluxos abrindo a partir do card,
e eles dependem da estrutura que o Davi vai ditar (§7.1). Pendentes:
**C** (a validação do gestor — agora com a forma decidida, R155),
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
| U117 | a **estrutura dentro de O local** (R211); a coluna Atividades da ficha usa o **card da Início** (R212); **Problema/Diagnóstico só na corretiva** (R213); a **Proposta Comercial expande no "+"** (R214, o formulário da visita virou componente); o **chat de menções** na Início — botão fixo, painel, atividade no meio da tela, responder aqui, reações (R215–R217); migration U117 |
| U118 | na ficha, **visitas, chamados e atividades numa lista só** (R218) e as **colunas alinhadas embaixo** (R219); o **pacote para Windows Server** — `npm run build:windows`, `Instalar-Prever.exe` com porta configurável, serviço WinSW, manual `hospedagem-windows.md` (R220); revisão: inventário da skill, P61/P62, ONBOARDING §6 |
| U119 | a **v0.0.2**: **todos veem todas as atividades** (R221); o **chat como conversa 9:16** com recado para todos e resposta pelo `#Código` (R222–R223); o **editor de uma área** (R224); a coluna **Agendado**, "Re-agendado Nx" e o aviso das 08h (R225); **equipamentos removidos/instalados pela atividade** (R226); etiquetas empilhadas (R227); página da atividade larga (R228); **versão 0.0.2**, `VERSOES.md` e o banner local (R229); migration **U119** |
| U120 | a **v0.0.3**: o sistema é o **Prever OS** (R230); o plantão sai da abertura de chamado (R231); **prazo × agendar** num controle só (R232); no quadro **a coluna inteira aceita o card** (R233); a **tela da atividade redesenhada para desktop** — quatro faixas, margem de verdade, os textos mandando (R234); a **rosca do progresso** pelo checklist (R235); **equipamentos por arrasto** em dois painéis (R236). Sem migration nova |
| U121 | a **v0.0.4**: a tela da atividade na estrutura **aprovada sobre o mockup** — documento à esquerda, ficha de 340px à direita, propriedades em linhas rótulo \| valor, ficha acompanhando a rolagem (R234); o **pop-up da Início mostra a mesma tela** num diálogo de 1600px (R238); equipamento **entra no cliente só pelo QAP** — painéis Blocos do cliente \| Sem bloco, botão remover, nada de "Fora do cliente" (R237). Migration **U121** (`mover_equipamento` exige item do cliente; exige a U119) |
| U122 | a **revisão geral da tela da atividade** (R239): o pop-up deixa de ser cortado pelo menu (diálogo e folha lateral em **z-70**); **uma régua de margem** para o sistema inteiro (`--gutter`, 16/24px) — Início, atividade e ficha do cliente no mesmo prumo, com a meia barra de rolagem descontada (`--barra`); **um scroll só** (a ficha não é mais sticky, os painéis não rolam por dentro); **Equipamentos recolhido** por padrão, com o botão que expande na extremidade direita; escala de espaçamento 8/12/16/24; barra de topo no diálogo. Sem migration nova |
| U123 | a **v0.0.5**: o chat virou **conversa** (R240) — o título da atividade mora dentro do campo colorido, e a resposta enviada pelo chat fica no chat, no mesmo campo da mensagem respondida, como uma caixa separada (foto, nome, hora). Ordena pelo último instante da conversa. Migration **U123** (`chamado_eventos.responde_a` + `respostas_do_chat`) |
| U124 | a **v0.0.6**: a **proposta comercial volta a nascer** — prédio sem cadastro entra como **prospecção** e não como cliente (R21/R22: o INSERT em `clientes` estava sem policy desde a U27, e toda visita de prédio novo morria na RLS); o **admin faz visita técnica** e entra na lista única de responsáveis (R241); a colisão de cache `tecnicos-ativos` foi separada. Migration **U124** (`achar_ou_criar_prospeccao_do_local`) |
| U125 | a **v0.0.7**: a **capa do chamado nasce ANTES da visita** — o gatilho da U29/U38 era AFTER INSERT e a FK `visitas_e_chamado` é conferida antes dele, então **nenhuma visita podia ser criada desde 21/08** (a terceira camada do mesmo caminho, depois da P44 e da U124); a capa passa a registrar o **local** em `chamado_locais` (cliente ou prospecção); e o **endereço vale sem o mapa** (R242): a frase deixa de ser vermelha, diz que o endereço está salvo, e o campo pede a cidade. Migration **U125** |
| U126 | a **v0.0.8**: a tela da atividade **fala menos e mostra maior** (R243) — saem seis textos que explicavam o que a tela já mostra, os micro-rótulos de seção sobem 10 → 12px num lugar só (`rotuloDeSecao`), o número da rosca encolhe e os botões de Status/Tipo/Impacto ficam 36px; e eles **voltam a funcionar dentro do pop-up** (a lista ia para o `<body>`, que um diálogo modal deixa inerte). De brinde: `corDaMencao` passou a responder pelo relógio que recebe. Sem migration |
| U127 | a **v0.0.9**: a revisão sistêmica — o perfil **OPERACIONAL** (R244: Início, Calendário, Clientes e Perfil; vê tudo, não é gestor; para o Nicholas e o Erik), o **chat que não perde mensagem** (R245: a resposta que menciona alguém era engolida no chat dele; Backspace vazio, barra de rolagem e placeholder da caixa; o **`#`** lista as atividades recentes, só o nome), a **Início inteira** (R246: todas as abertas + as 300 encerradas mais recentes, coluna Concluído em ordem de conclusão FIXA, rótulo da ordem à esquerda do botão), a **tela de campo no desktop** (R247: a grade documento \| ficha, embutida no pop-up — P66 parte 1), e as **ferramentas da IA** (`scripts/lib/editar.cjs`, `scripts/fechar-entrega.cjs`, pino permanente de versão). Migration **U127** (enum, dois CHECKs, `salvar_permissoes`, `handle_new_user`, semente) |
| U128 | a **v0.0.10**: a **próxima atividade virou card** (R248 — o banner saiu do topo do desktop e é o primeiro card da coluna Agendado, que ganhou ordem fixa pelo dia marcado; realce só de cor e contraste, etiqueta A SEGUIR/ATRASADA na vaga do chip de status; no celular o banner fica), **"Responder aqui" foca a caixa** do chat (R249), a **busca acha pelo nome do prédio** (R250 — inclusive setor e prospecção), **filtro por Tipo de Demanda** (R251) e o **Painel Comercial em duas visões** (R252 — quadro por etapa do ciclo, linha e card no MESMO componente, sem arrasto porque a etapa é derivada). Sem migration nova |
| U129 | a **v0.0.11**: o **Sobreaviso reestruturado** — a semana virou a unidade da tela (R253: uma linha por semana com o seletor do plantonista, par Semana \| Mês, grade de 8 colunas) e o calendário ganhou a **barra** (R254: faixa amarela fosca por trecho contíguo, clicar seleciona e Delete apaga, modo "Remover dia" com pré-visualização, "+" para o segundo plantonista, troca que NÃO acumula pela RPC nova, e só a **equipe técnica** é escalada). Três defeitos consertados no caminho: buraco × sobra, o clique na última coluna que teletransportava a semana, e as setas mudas do celular. Migration **U129** |
| U130 | **as correções pedidas antes do executável** (sem versão nova: o Davi disse que pediria o executável no fim). **R255** — quem não edita a atividade vê o botão **"Entrar como apoio"**, e o apoio que a pessoa se dá NÃO vira permissão (o gêmeo `podeEditar` do cliente voltou a falar a língua do `pode_editar_chamado` do banco); **R256** — as setinhas do campo de horas só no dia clicado (MEDIDO: `appearance: none` não volta no foco; a alavanca é a opacidade, e o `padding-left: 13px` paga a largura reservada); **R257** — no card da Início, o prazo é o ícone e o número, sem "faltam"/"em atraso" (fora do card a palavra fica); **R258** — o convite do chat na linha do texto (os 3px eram do `[data-bloco]`) e o foco na caixa ao abrir; **R259** — a Proposta Comercial fala menos (cinco textos fora, "Cliente" virou **LOCAL**, nome do campo em tinta primária e a nota em opacidade menor, barra de rolagem nossa) e a **revisão de margem** que o Davi mandou fazer depois achou 9px de desalinho entre as colunas e 11px que vinham do `<p>` do navegador; **R260** — Proposta Comercial nasce com responsável da **equipe** Comercial. De quebra: o comentário da R256 fechava duas vezes e derrubava a folha inteira no `vite dev` (anti-padrões nº 11 e 12). Sem migration nova |
| U131 | **R261** — a **Demanda no tempo** conta a semana INTEIRA: concluída entra na semana em que foi concluída, aberta entra na do prazo. A assimetria da R65 (passado = entregas, futuro = prazos) abria um buraco na semana CORRENTE, que é desenhada pelo lado do futuro: concluir uma atividade hoje a tirava do gráfico e não a punha em barra nenhuma até a virada da semana. Uma conta só (`demandaPorSemana`), a faixa anuncia "Atividades da semana de DD/MM" e a dica decompõe o número. **R262** — a **data de conclusão** vira campo corrigível na ficha das duas telas de atividade (na de campo, só a gestão), e a correção entra na **linha do tempo** por GATILHO — "de → para", com quem fez. Escreve em `concluida_em` e não em `finalizada_em`/`fechada_em`, que é de onde sai a competência da cobrança. O par relógio↔instante mudou de `features/plantao` para `lib/periodos`. Migration **U131 (rodada em 13/09)** |
| U132 | **o app do técnico de campo, primeira etapa.** **R263** — o cargo TÉCNICO é quem trabalha na rua, pelo celular, e tem TRÊS telas: uma **Início própria** (`InicioDoTecnico`: "Bom dia, Breno. Você tem 3 atividades hoje" com o número SEMPRE dele, a faixa de sobreaviso quando é o plantonista, o interruptor **Minhas \| Equipe** e os cards em Hoje · A seguir da mais próxima para a mais distante; o "+" é só o plantão), a **Agenda** com o mesmo interruptor (fecha o vazamento dos chamados de toda a empresa no calendário dele) e o **Perfil** com "Meu sobreaviso". **R264** — no banco, o técnico lê só o que não é interno (campo + capa da proposta) e TODAS as da equipe; `pode_acessar_chamado` com o mesmo recorte. **R265** — o Sobreaviso é do **cargo** técnico (revisa a R254; o operacional não entra; Gilleno vira SAC). Ficam para o Davi: para onde o APK aponta, o push, e a urgência fora do horário → plantonista. Migration **U132 (rodada em 13/09)** |
| U133 | **as viaturas — o documento mestre e as regras (R266–R273).** O Davi abriu o controle da viatura usada pelo técnico (etiqueta NFC num suporte em cada carro; bipar para iniciar e para encerrar, km nas duas pontas; só o cargo técnico registra). Mockup publicado ANTES do código e cinco respostas dele viraram regra: cada **trecho** é uma viagem, km fora de ordem **passa com aviso**, atividade **opcional** (o cliente dela é o destino), cadastro e **folha** na aba Viaturas do Administrativo, tempo de deslocamento por trecho, e a **chegada por localização** (2 minutos no raio → SUGERE encerrar) como etapa 3. A decisão técnica: a etiqueta guarda um **endereço** — funciona hoje pelo Chrome, e o APK abre direto quando registrar o App Link. Contexto em `docs/CONTEXTO_VIATURAS.md` (D1–D11, Q24–Q27). **Sem migration** — a implementação é a U134 |
| U134 | **as viaturas, construídas** (R266–R274). Migration com as três tabelas, os índices únicos parciais e as três portas; o modelo puro (`features/viaturas/modelo.ts`: estado da tela, km, duração, permanência, folha, chegada — 150 m, 2 minutos, máquina de estados); a **tela da etiqueta** `/viatura/$codigo` (livre → iniciar · minha → encerrar · de outro → assumir) e a lista `/viatura`; a **faixa** na Início do técnico, que vira "Você chegou a X?" quando o GPS diz (só com viagem aberta e a página visível; a posição não é gravada); a **aba Viaturas** do Administrativo (cadastro, sede ajustável, folha com correção de km na linha). A `Atividade` ganhou `clienteId`. **R274**: os destinos são TODAS as atividades do dia mais a sede; abastecimento fica no QAP. Migration **U134 (rodada em 13/09, depois da U132)** |
| U135 | **a revisão de margem das telas novas** (R275), com o Davi já tendo rodado as três migrations. O **chip de estado das viaturas** passou a ser a `etiqueta()` do design system — o que eu tinha inventado media **4,45:1** no tema claro, abaixo do piso de 4,5 (agora 4,99 a 5,71); a **aba Viaturas** ganhou grade própria (`.viaturas-colunas`, 360px de formulário \| o resto) porque a do painel de usuários deixava o cadastro com 669px de sobra e a folha rolando dentro de 427px; os **dois km viraram uma coluna** ("100.431 → 100.500") e os cabeçalhos encurtaram; os espaçamentos voltaram para a **régua da R239** (10 e 14 não existem). De quebra, o placeholder do km na tela do carro que está com outro técnico mostrava "0". **Teste funcional pendente** — exige o login do Davi, e o fluxo do técnico exige conta de técnico. Sem migration nova |
| U136 | **o km sai das viaturas** (R276). Horas depois de a U134 entrar no ar e de registrarmos a primeira viagem de verdade, o Davi tirou a quilometragem do sistema — "já é controlado no ERP" —, e o que a viagem responde passou a ser **com quem estava o carro, quando e para onde**. Saíram seis funções puras, o campo da tela, três colunas da folha, um KPI, quatro colunas do banco e um CHECK; **bipar virou um toque**. As três portas mudaram de assinatura, então a migration as DERRUBA pela assinatura exata antes de recriar (duas vivas seriam uma sobrecarga que o PostgREST escolheria sozinho). A correção da gestão mudou de assunto: agora ela **encerra a viagem deixada aberta**, com rastro. Revoga a R268; muda o "assumir" da R269 e a folha da R272. Migration **U136 (rodada em 13/09, na segunda tentativa)** |
| U138 | **a primeira leva da revisão completa** (R277–R280). A tela de entrada **deixa de cadastrar**: conta nasce por convite (R59), e a **U137** troca as 28 policies de `USING (true)` pelo crachá `eh_do_time` — conta ativa e aprovada; o censo de policies frouxas do verificador **ficou vazio**, e desativar usuário deixou de ser cosmético. O **baseline do `tsc` foi de 57 a ZERO**: 53 dos 57 eram quatro colunas faltando no `types.ts`, e os 4 que sobraram eram defeito de verdade. **R278**: a S1 fechou os buckets em 20/08 e duas telas seguiram gravando URL morta em `foto_fachada_url` — 24 dias de dado ruim; nasceu `lib/foto-storage.ts` e as linhas velhas voltam a mostrar a foto sem migration. **R279**: o TOTAL MENSAL da proposta somava "Sob consulta" como zero e o .docx saía com número menor do que a proposta vale. O gerador de sumários estava cego havia 34 entregas (U103–U136 fora do mapa, e o `--check` verde por cima). O manifesto do APK ganhou localização e NFC; o App Link espera o domínio (**R280**: o sistema sai da Lovable). Migration **U137 (rodada em 14/09)** |
| U140 | **os cinco itens que não dependiam do Davi**, tirados do painel da revisão. **P20**: analisar a cobrança FECHAVA o caminho de aprovar — o chamado saía da fila do financeiro com dinheiro dentro; virou `podeDecidirCobranca` e a migration **U139** destravou a porta do banco (a U80 já media esses presos e chamava-os de "invisíveis para toda a operação", mas só consertou a contagem). **R155**: a fila de validação do gestor ganha faixa na Início — o sinal existia e ninguém lia; o primeiro desenho contava sobre o recorte filtrado e sumia no preset padrão. **Cobranças na ficha do cliente**, atrás do mesmo portão dos Contratos. **S10**: os quatro cabeçalhos baratos entram, e o caminho foi finalmente exercitado antes de publicar (função pura + o build node-server levantado localmente); a CSP e os assets ficam para a R280. **O motor de orçamento entra no verificador**: as fórmulas da planilha viram prova (switch, fontes, nobreak, baterias, zonas do alarme, canais da guarita). Migration **U139 (rodada em 14/09)** || U141 | **o checklist parou de clicar na linha de baixo** (R281). O disco amarelo do hover media **49×49 numa caixa de 19×19**, e `opacity: 0` não tira um elemento do teste de ponteiro: cada item reivindicava 49px num passo de ~22px, e **dez dos dezenove pixels da caixa visível pertenciam ao item de baixo**. No editor não parava no hover — o `mouseDown` alternava o bloco errado. O disco saiu (a R174 já proibia brilho decorativo); no dedo a linha cresce para 40px. Sem migration |
| U142 | **a equipe passa a valer do INSTANTE da troca** (R285). A composição virou faixa `[entrou, saiu)` em `equipe_membros`; duas regras viraram garantia declarativa pelo btree_gist (uma pessoa numa equipe só; uma equipe com um líder só), e é a primeira delas que produz o pop-up de mover. O backfill **não inventa líder** — `duplas_escala.ordem` é "só exibição", e promovê-la inventaria dado que ninguém digitou. Migration **U142 (rodada em 14/09)** |
| U143 | **a conferência que a U142 não conseguiu imprimir**, e as nove decisões da leva do Vinicius (R286–R294). O portão da U142 usava uma pessoa REAL, já backfillada, e colidia com a composição de verdade — o erro era a prova de que a regra funciona. Quase "consertei" o `0001-01-01` do backfill: é o **marco zero** que a U76 criou de propósito, e apagá-lo faria um chamado com data retroativa perder a equipe em silêncio. Migration **U143 (rodada em 14/09)** |
| U144 | **criar atividade deixa de ser a mesma chave de abrir chamado** (R294). O pop-up da Início sempre criou `natureza: interno`, mas era travado por `chamados.novo` — e quem não tinha a chave recebia a tela do técnico ("o chamado chega a você pela programação"). Para o OPERACIONAL isso é porta trancada com a placa errada, e foi o que o Erik encontrou. Nasceu `atividades.nova`; o operacional saiu de `CARGOS_DE_CAMPO`. Migration **U144 (rodada em 14/09)** |
| U145 | **a tela das equipes perde o eixo da semana** (R285). Saíram o seletor, a herança e o modo "Escalar"; entraram dois gestos diretos e o líder. Medir a tela achou um **técnico desativado (Denner) ocupando vaga** — a tela resolvia nome pela mesma lista que usa para oferecer, e quem saiu da empresa não resolve por lá. Sem migration |
| U146 | **o técnico de campo fica com três tipos** (R283). `operacional` saiu do campo (era oferecida e nunca virava demanda de dupla) e `vistoria` mudou de natureza — virou atividade INTERNA do gestor, que é onde a validação dele é registrada (R156). Medido antes: zero chamados de campo com esses tipos, logo sem migration |
| U147 | **o campo perde o prazo automático** (R284) e a escala por semana vira uma VISTA. Os dois ramos do SLA saíram do gatilho; o prazo da obra fica, porque é espelho de uma data que alguém marcou. E a ponta solta da R285: **sete telas** ainda liam `duplas_escala`, congelada desde a U142 — `useEscala()` passou a materializar a forma a partir de `equipe_membros`, e nenhuma das sete mudou uma linha. Migration **U147 (rodada em 14/09)** |
| U150 | **o retorno é a MESMA atividade** (R286)
| U151 | **a auditoria de início de sessão, e o que ela achou.**
| U152 | **na abertura pergunta-se QUEM** (R297). O campo "Equipe de campo" saiu — ela passou a ser sempre a do responsável —, e Responsável + Apoio ficaram lado a lado, com foto na lista e no escolhido. O apoio é PLURAL e só vem quando o responsável é o **LÍDER**, o que **revisa a R285** (que dizia "o líder não é condição"). A metade que quase ficou de fora é o BANCO: quem escreve apoio é o gatilho, e com só a tela mudada ela mostraria campo vazio e o banco gravaria a equipe meio segundo depois. **Medido:** nenhuma das três equipes tem líder nomeado hoje (o backfill da U142 trouxe todos como ajudante), então o apoio não nasce para ninguém até alguém nomear — e a tela diz isso, com o conserto junto. Migration **U152 (pendente)** | TRÊS defeitos na U150 **antes** de o Davi rodar: o CHECK novo travava o botão "tire o feito" da grade (e a U78 manda justamente por ele), a porta carimbava a ida mais NOVA em vez da mais antiga (um retorno marcado para quinta virava "aconteceu"), e o portão provava o cancelamento por um caminho que o app não tem — era esse disfarce que escondia o primeiro. E a **segunda metade da R284**, que ninguém tinha implementado: "atrasado" no campo virou a DATA MARCADA vencida. Enquanto saía do prazo, a coluna "Atrasados" ficou presa em ZERO depois da U147. Sem migration nova | — a decisão que o Davi me pediu para tomar. Quase nada precisou nascer: `agenda_campo` já é uma linha por IDA desde a U78, e faltava só COMO a ida terminou. O contador é espelho recontado por gatilho, e ida cancelada não conta. Dois defeitos meus achados antes de rodar: `COALESCE(NEW.x, OLD.x)` estoura no ramo de DELETE (`NEW` é record não atribuído, não nulo), e os dois CENSOS acusaram a função por carimbar `cumprido_em` fora das portas da U78 — ela passou a delegar. Migration **U150 (pendente)** |
| U149 | **a barra do Operacional vira a barra da Início** (R296). A régua saiu MEDIDA na tela ao lado — pílula 40/raio 11, botão quadrado 42/raio 12 —, e o Operacional tinha 28px ao lado de pílulas de ~26: dois pisos na mesma linha, que é o que o Davi descreveu. Os quatro botões de eixo viraram UMA pílula com menu e o alternador virou UM botão com o destino. Nasceu a ORDEM da lista (`ordenarCampo`), que a tela nunca teve — e que a R284 tornou urgente, porque `ordenarChamados` pesa por prazo e o campo não tem mais prazo. Sem migration |
| U148 | **o quadro do Painel Operacional ganha eixo** (R295): estado (o padrão da R76), status, equipe e dia da semana, com a conta em `colunasDoQuadro` — lógica pura, a tela só pinta. O card passou a dizer tipo de demanda, equipe e a data que o ESTADO pede, com RÓTULO ("Agendado"/"Começou"/"Feito"), porque "14/09 08:00" sozinho não distingue "vai começar" de "começou". **Medindo no navegador**: a mesma fila contava 1 card num eixo e 3 no outro — só o eixo de estado excluía cancelado. Passou a ser regra única, travada por asserção de TOTAL, não de coluna. Sem migration |

## 4. Banco: migrations

O repo **nunca aplica** migration: o Davi roda à mão no SQL Editor do
Supabase, na ordem dos nomes de arquivo (`supabase/migrations/`). Cada uma é
idempotente e termina com uma conferência obtido × esperado × veredito.

- **U150** (`20261008090000_u150_o_retorno_e_a_mesma_atividade.sql`,
  **PENDENTE**) — o RETORNO (R286). `agenda_campo` ganha `resultado`
  (`resolvido` | `retorno`) e `resultado_nota`; `chamados.retornos` nasce como
  ESPELHO recontado por gatilho — nunca somado à mão —, e a porta
  `chamado_registrar_retorno(uuid, text)` carimba a ida **pela porta da U78**
  e escreve na linha do tempo no MESMO ato. Ida cancelada não conta. Nenhuma
  tabela nova: `agenda_campo` já é uma linha por IDA desde a U78, e o que
  faltava era só como a ida terminou. **A faixa "Retornos pendentes" e o botão
  "Retorno" no card só sobem depois que esta rodar** — botão que chama coluna
  inexistente é botão quebrado.
- **U147** (`20261007090000_u147_o_campo_nao_tem_prazo.sql`, rodada em
  14/09/2026) — tira do gatilho `chamado_preencher()` os dois ramos que davam prazo de SLA
  ao chamado de campo (R284). O prazo da IMPLANTAÇÃO fica: é o espelho de
  `implantacao_fim`, uma data que alguém marcou (R120). O pré-voo ABORTA se o
  corpo vivo não for o da U89 — substituir uma versão não lida levaria o
  espelho junto. Não apaga prazo nenhum que já exista.
- **U144** (`20261006090000_u144_atividade_nao_e_chamado_de_campo.sql`, rodada
  em 14/09/2026) — semeia a chave `atividades.nova` em `permissoes_tela`
  (R294). `ON CONFLICT DO NOTHING`: escolha do Davi na matriz vence a semente.
- **U143** (`20261005090000_u143_conferencia_da_u142.sql`, rodada em
  14/09/2026) — **não muda schema**: imprime a conferência que a U142 não
  conseguiu mostrar e roda o portão corrigido (só com gente fora de equipe).
  O `entrou_em = 0001-01-01` das linhas do backfill é o **marco zero** da U76
  e é ESPERADO: sem ele, um chamado com data retroativa perderia a equipe.
- **U142** (`20261004090000_u142_equipe_por_instante.sql`, rodada em
  14/09/2026) — `equipe_membros` com faixa `entrou_em`/`saiu_em`, as duas
  restrições de exclusão (uma pessoa numa equipe só; um líder por equipe), o
  backfill da composição e as portas de escrita (R285). O portão dela falhou
  por usar uma pessoa real e foi DESARMADO depois; as provas estão na U143.- **U139** (`20261003090000_u139_analisado_volta_a_ser_decidivel.sql`, rodada
  em 14/09/2026) — o chamado ANALISADO volta a ser decidível (P20). Reemite
  `concluir_chamado_com_cobranca` com o corpo da U80 byte a byte e UMA linha
  trocada: o gate passa de `<> 'a_analisar'` para
  `NOT IN ('a_analisar', 'em_conferencia')`. A trava da duplicata continua
  inteira — o que ela protege são os três estados DECIDIDOS. A outra porta,
  `aprovar_chamado_financeiro`, nunca olhou o `faturamento_status` e já
  aceitava; o que faltava era a tela deixar chegar até lá.

- **U137** (`20261002090000_u137_so_o_time_le.sql`, rodada em 14/09/2026) — SÓ QUEM É
  DO TIME LÊ (R277). Nasce `eh_do_time(uid)` — conta ATIVA e APROVADA, o
  predicado que a casa já escrevia à mão em 17 migrations — e as **28**
  policies de leitura que respondiam `USING (true)` passam a exigi-lo.
  `profiles` ganha a exceção `OR id = auth.uid()`, senão a tela "Aguardando
  aprovação" fica sem o que ler. Liga a RLS de `chamado_contadores` (a única
  tabela viva sem perímetro) e derruba a policy zumbi
  `"Tecnico or admin update visitas"`, que anulava o aperto da U6c.
  **Por que ela importa:** até a U137, qualquer pessoa que clicasse "Criar
  conta" na tela de entrada virava `authenticated` e a API respondia — a tela
  barrava, o banco não. O código já foi publicado com a porta fechada (R277),
  mas a janela só fecha quando esta rodar. **Leia o item 9 da conferência**:
  ele lista quem perderia leitura agora (deve ser só quem não é do time).
  Nove itens de conferência; portão em transação própria que termina em
  ROLLBACK, com o trabalho já commitado antes (cicatriz da U136).
  **Conferida em 14/09/2026 com a sessão do Davi**, e o retrato ficou limpo:
  as 23 tabelas reguardadas respondem sem erro para quem é do time; dos 15
  perfis do banco, os ÚNICOS quatro que o crachá recusa são os que já
  estavam com `ativo = false` de propósito (Caio, Denner, Maria e uma conta
  antiga do próprio Davi); **nenhum perfil está `pendente_aprovacao`**, e o
  Gilleno — que virou SAC em 13/09 — passa. Ou seja: ninguém do time perdeu
  nada, e quatro contas desativadas deixaram de ler o banco inteiro.

- **U136** (`20261001090000_u136_viaturas_sem_km.sql`, rodada em 13/09/2026 —
  na SEGUNDA tentativa; ver a cicatriz abaixo) — o KM sai
  das viaturas (R276). Derruba as três portas pela assinatura EXATA (elas
  mudaram de argumentos; `CREATE OR REPLACE` criaria uma sobrecarga, e o
  PostgREST escolhe sobrecarga pelo nome dos argumentos que o cliente manda),
  apaga `km_saida`, `km_chegada`, `aviso_saida` e `aviso_chegada` de
  `viagens_viatura` com o CHECK que as amarrava, e recria as três portas sem
  km — mesmo gate (técnico inicia/encerra, gestão corrige), "assumir" encerra
  a do colega no INSTANTE do bipe, e corrigir só carimba "gestor" quando é ela
  que está fechando a viagem. Dez itens de conferência; portão em transação
  própria que termina em ROLLBACK.
  **A cicatriz:** a primeira versão deste arquivo não tinha `BEGIN;`/`COMMIT;`
  em volta do trabalho. Como o SQL Editor roda o script inteiro numa
  transação, o `ROLLBACK;` do portão desfazia **tudo** — ela rodava, não dava
  erro, imprimia a conferência, e o banco continuava igual. O Davi rodou duas
  vezes antes de o defeito aparecer. Hoje há asserção varrendo todas as
  migrations (`ROLLBACK;` sem `COMMIT;` antes = falha) e a cicatriz está em
  `docs/manual/banco-e-migrations.md` e na skill do banco. Lição de método:
  **conferir pelo BANCO que um objeto novo existe, nunca pelo "rodou sem
  erro"** — quem desmascarou foi a porta velha ainda respondendo com a frase
  do corpo dela.

- **U134** (`20260930090000_u134_viaturas.sql`, rodada em 13/09/2026) — as
  VIATURAS (R266–R274): `locais_de_referencia` (a sede, semeada com o centro da
  rua no OSM; `ON CONFLICT DO NOTHING` preserva o ajuste fino feito na aba),
  `viaturas` (placa, apelido, código da etiqueta, ativa) e `viagens_viatura`
  (um TRECHO por linha; km rodado e duração calculados na leitura; dois avisos de
  km fora de ordem). As duas invariantes da R269 são índices únicos PARCIAIS
  (uma viagem aberta por viatura e por técnico). Três portas SECURITY DEFINER —
  iniciar (com "assumir", que fecha a do colega como `assumida`), encerrar (só
  quem iniciou) e corrigir (só a gestão, com `corrigida_por/em`) — e NENHUMA
  policy de escrita em viagens pela tabela. Pré-voo exige `eh_tecnico` (U132) e
  `is_gestor`. Portão numa transação que termina em ROLLBACK. Dez itens de
  conferência; o último conta as viaturas cadastradas. **Sem ela** a tela da
  etiqueta e a aba dizem que precisam da migration.
- **U132** (`20260929090000_u132_o_tecnico_le_so_campo.sql`, rodada em 13/09/2026) — a
  primeira LEITURA recortada por cargo deste banco (R264): `eh_tecnico(uid)`
  (STABLE SECURITY DEFINER, como `is_gestor`), `chamados_select` vira
  `NOT eh_tecnico(auth.uid()) OR natureza <> 'interno'` — o cargo TÉCNICO lê
  campo e a capa da proposta, nunca a atividade interna das outras equipes; todo
  mundo mais continua na R221 —, e `pode_acessar_chamado()` ganha o mesmo
  recorte (senão ele veria o chat de uma atividade cuja linha não lê). Visitas
  continuam abertas. E a chave `sobreaviso` da matriz FECHA para o técnico
  (R263: três telas). Pré-voo exige a policy da U119 e `permissoes_tela` (U11).
  Nove itens de conferência — o último lista quem tem cargo técnico hoje, para
  você conferir a lista. A tarefa que é DELE (responsável, autor ou apoio)
  entra seja de que natureza for — sem essa exceção o aviso de uma interna
  atribuída a ele abriria uma página vazia. O DESFAZER volta a R221 inteira.
  **Antes de rodar:** trocar o cargo do Gilleno para SAC. **Sem ela** a Início
  nova do técnico funciona, mas ele ainda lê a atividade interna dos outros E a
  grade /sobreaviso continua abrindo para ele pela URL (a linha da U86 na matriz
  diz true; o catálogo do código só vale quando não há linha no banco).
- **U131** (`20260928090000_u131_data_de_conclusao_corrigida.sql`, rodada em
  13/09/2026)
  — o gatilho **`chamado_registrar_evento`** (da U7) passa a olhar também
  `concluida_em` e ganha um quarto ramo: corrigir a data de uma atividade que
  **já estava e continua concluída** escreve uma linha na timeline —
  "Data de conclusão: 10/01/2026 15:00 → 12/01/2026 09:30" — com `auth.uid()` e
  no fuso de São Paulo (R262). O recorte por status é o que evita linha dupla:
  concluir e reabrir já têm o evento de status. O gatilho volta com o MESMO
  NOME, porque a ordem de disparo em `chamados` é alfabética e está registrada
  na U82. Não toca em `finalizada_em`/`fechada_em` (a competência da cobrança
  sai delas). O portão insere um chamado, corrige, reabre, conclui de novo e
  confere que só a correção gerou linha — tudo numa transação que termina em
  **ROLLBACK**, então não sobra nada nem nas tabelas que os outros gatilhos
  tocam. Oito itens de conferência; o DESFAZER recria o gatilho sem a coluna.
  **Sem ela a tela funciona**: a data é corrigida e a linha do tempo apenas não
  registra.
- **U129** (`20260927090000_u129_v011_trocar_plantonista.sql`, rodada em
  11/09/2026) — a RPC **`sobreaviso_trocar_plantonista`** (R254): tira a semana
  de quem sai por **subtração** (nunca por DELETE cego, que levaria junto a
  ponta que pertence à semana vizinha) e lança para quem entra pelo MESMO CASE
  de quatro ações da U86, tudo numa transação só. Repete o gate de duas metades
  (`is_gestor` mais ativo/não pendente), porque SECURITY DEFINER não passa pela
  RLS. Não altera as duas funções da U86 nem a tabela. O portão monta o caso que
  derruba a composição ingênua — a mesma pessoa emendando duas semanas — e
  confere que a madrugada da semana anterior sobrevive. Nove itens de
  conferência; desfazer é um DROP FUNCTION.
- **U127** (`20260926090000_u127_v009_perfil_operacional.sql`, rodada em
  11/09/2026) — o cargo **operacional** (R244) nos
  cinco lugares que enumeram cargos: o enum `app_role` (ADD VALUE fora da
  transação, como a U6a), o CHECK de `profiles.cargo`, o CHECK de
  `permissoes_tela.cargo`, o `WHERE` de `salvar_permissoes` e a lista de
  `handle_new_user`; e a semente da matriz (17 linhas: dashboard, calendario,
  clientes e perfil em `true`, o resto em `false`, `ON CONFLICT DO NOTHING`).
  Pré-voo exige `permissoes_tela` e `salvar_permissoes` (U11) e
  `handle_new_user` (U6a). NÃO toca em `is_gestor` (operacional vê, não manda)
  nem em `sync_user_role_from_cargo` (P69). Sem ela, a tela de Usuários não
  conseguia gravar o cargo (o CHECK antigo recusava). Oito itens de
  conferência; o DESFAZER começa tirando as pessoas do cargo.
- **U125** (`20260925090000_u125_v007_capa_da_visita_antes.sql`, rodada em
  09/09/2026) — o
  gatilho **`trg_capa_da_visita`** (BEFORE INSERT) cria a capa do chamado antes
  de a linha da visita entrar, que é o que a FK `visitas_e_chamado` exige; o
  `trg_sincronizar_chamado_da_visita` fica só no UPDATE; e
  **`registrar_local_da_visita`** grava o local em `chamado_locais` (cliente ou
  prospecção) no nascimento, com backfill das visitas antigas sem local.
  Pré-voo exige `chamado_locais` (U71), a função da U29/U38 e a FK.
  Rodou antes do pacote v0.0.7; sem ela, criar visita falhava na chave
  estrangeira. Seis itens de conferência (um deles lê o TIPO
  do gatilho: before × after).
- **U124** (`20260924090000_u124_v006_prospeccao_do_local.sql`, rodada em
  09/09/2026) — a
  função **`achar_ou_criar_prospeccao_do_local(text, text, jsonb)`** (SECURITY
  DEFINER), que registra como **prospecção** o prédio da visita que ainda não é
  cliente, com endereço, contatos e coordenada (R21/R22). Acha pelo nome
  normalizado e só preenche o que está vazio. Pré-voo exige `prospeccoes` (U27)
  e `normalizar_texto` (U71). Rodou antes do pacote v0.0.6; sem ela a
  tela avisava que o prédio novo precisava da U124 (regra 5) e não voltava a
  tentar criar cliente. Seis itens de conferência; desfazer é largar a
  função (as prospecções criadas ficam, são o registro do funil).
- **U123** (`20260923090000_u123_v005_resposta_do_chat.sql`, rodada em
  09/09/2026) — a
  ligação **`responde_a`** em `chamado_eventos` (FK para o próprio comentário,
  `ON DELETE SET NULL`, índice parcial e um gatilho que exige a MESMA
  atividade) e a leitura **`respostas_do_chat(uuid[])`** (SECURITY INVOKER),
  que é o que faz a resposta enviada pelo chat voltar para o chat (R240).
  Pré-voo exige `chamado_eventos` e `minhas_mencoes` (U117/U119). Rodou antes do pacote
  v0.0.5; até ela rodar, o app se defendia (regra 5): o chat
  avisa que as respostas precisam da U123 e `comentarChamado` reenvia o
  comentário sem a ligação, então a resposta continua chegando na atividade.
  Sete itens de conferência; desfazer é largar a coluna (ela é ligação, não
  conteúdo).
- **Rodadas até a U121** — a **U119** e a **U121** em 08/09/2026 à noite
  (Davi: "Eu rodei as migrations"); a U117 mais cedo no mesmo dia ("tudo OK").
- **U121** (`20260922090000_u121_v004_equipamento_so_pelo_qap.sql`, rodada em
  08/09/2026)
  — reescreve `mover_equipamento` (R237): nos dois movimentos o item tem de
  ser **do cliente da atividade** (senão RAISE "Equipamento entra no cliente
  só pelo QAP"); a instalação só troca o bloco (nunca escreve `cliente_id`) e
  recusa o mesmo bloco. Pré-voo exige a U119 — **rodar a U119 antes, depois a
  U121**, e só então subir o pacote v0.0.4 — foi o que aconteceu. Enquanto a
  U121 não rodou, a tela já se defendia (não oferece nada de fora do cliente);
  ela é a trava no BANCO, para nenhum caminho fora da tela instalar o que não
  veio do QAP. Conferência obtido × esperado × veredito no fim.
- **U119** (`20260921090000_u119_v002_visibilidade_chat_agenda_equipamentos.sql`,
  rodada em 08/09/2026)
  — a v0.0.2 inteira, em quatro seções: (§1) `chamados_select` e
  `visitas_select` viram `USING (true)` e `pode_acessar_chamado()` vira
  "logado e existe" (R221); (§2) `mensagens_chat` (o recado para todos, com
  realtime), `minhas_mencoes` v2 por DROP+CREATE (status/prazo/agenda/
  respondida, origens diagnóstico e solução) e o gatilho de menção nesses dois
  campos (R222–R223); (§3) `chamados.reagendamentos` + gatilho, a função
  `notificar_agendadas_de_hoje()` e o job `agenda-de-hoje` às 11:00 UTC
  (R225); (§4) `situacao`/`retirado_*` no patrimônio, `equipamento_movimentos`
  e as cinco RPCs (R226). Pré-voo exige a U117. Rodou antes de o pacote
  subir — e, até rodar, o app se defendia (regra 5): a Início e o painel liam
  `reagendamentos` à parte, o chat avisava, os equipamentos da atividade
  ficavam vazios. Vinte itens de conferência.
- **U117** (`20260920090000_u117_reacoes_e_minhas_mencoes.sql`, rodada em
  08/09/2026) — `chamado_reacoes` e a v1 de `minhas_mencoes()`.
- **U106** (`20260917090000_u106_mapa_sai.sql`, rodada em 07/09/2026) — o
  DELETE idempotente da chave `mapa` em `permissoes_tela`.
- **U109** (`20260918090000_u109_patrimonio_do_qap.sql`, rodada em 07/09/2026,
  dez itens de conferência ok) — `catalogo_equipamentos` e
  `equipamentos_patrimonio` (com RLS), a tela `equipamentos` na matriz, a chave
  `admin` apagada.
- **U110** (`20260919090000_u110_equipamentos_do_qap.sql`, 533 KB, rodada em
  08/09/2026) — os 4.241 equipamentos e as 429 variações de catálogo.
  Idempotente (variação por `chave`, item por `chave_importacao` `qap:<id>`);
  os dois UPDATEs de vínculo só preenchem o que está nulo, então rodar de novo
  não desfaz correção feita à mão. A última consulta dela imprime a relação
  dos locais que não casaram com a base. Para regerar: `node
  scripts/gerar-migration-equipamentos.cjs` (lê
  `docs/importacao/qap-equipamentos.json`, o retrato cru do QAP). A primeira
  tentativa abortou em **42P10** — índice parcial exige o predicado repetido
  no `ON CONFLICT` — e foi corrigida no lugar antes de rodar (cicatriz na
  skill do banco).
- **Hospedagem (R220, U118):** além da Lovable (push em `main` publica), existe
  o pacote para **Windows Server** — `npm run build:windows` → `dist-windows/`
  com `Instalar-Prever.exe` (porta configurável, serviço "Prever — Sistema").
  Manual: `docs/manual/hospedagem-windows.md`. O que ainda depende do Davi para
  sair da Lovable está em P61.
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

## 5. Decisões recentes que mudam o rumo (14/09/2026)

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
  quadro ganha a coluna **"Agendados"** (coluna do banco na U99; **tela
  entregue**: o campo e a coluna na U119/R225, e o calendário lendo
  `data_agendada` na U140 — a P57 fechada).
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
- **R192–R193** — a tela **/mapa saiu** (redirect; a migration U106 rodou em
  07/09/2026) e
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
- **R211–R217** — a estrutura entra em O local; a coluna Atividades usa o
  **card da Início** (borda pelo prazo); **Problema/Diagnóstico só na
  corretiva** (os outros tipos têm Descrição); a **Proposta Comercial expande
  no "+"** (o formulário da visita é componente, a rota é casca); o **chat de
  menções** na Início: botão fixo, menções de comentário e de descrição, a
  atividade abre no meio da tela, "Responder aqui" vira comentário com menção
  (decisão a rever se o Davi quiser), reações por emoji (lista fechada, tabela
  própria). A migration U117 rodou em 08/09/2026.
- **R218–R220** — na ficha, visitas técnicas entram na **mesma lista** das
  atividades (o card Histórico de visitas saiu) e as colunas terminam na mesma
  linha; o sistema ganhou o **pacote para Windows Server** (`npm run
  build:windows`): instalador `.exe` com porta configurável, serviço do
  Windows, firewall, `config.env` — a Lovable pode coexistir até o Davi
  desligá-la (`ONBOARDING.md` §6, P61).

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
   próximo passo**: destrava C (validação, R155/R162) — a B2 (Início do
   técnico) foi entregue na U132, e o que resta dela são os fluxos —,
   H.1 (mini-calendário e a visita que trava a agenda, R172), a tela da data
   agendada (R168) e a proposta em duas atividades (R170). **A revisão da
   lista de tipos do campo JÁ FOI FEITA** (R283/U146, 14/09/2026): corretiva,
   preventiva e implantação — a vistoria virou atividade interna do gestor, o
   que era a consequência que a R156 deixava em aberto. E parte dos fluxos já
   está ditada: R282 (a corretiva com dois textos), R284 (o campo sem prazo),
   R286 (o retorno na mesma atividade), R292 (a preventiva por blocos) — o que
   falta dele são os campos de cada um, e a IMPLANTAÇÃO inteira, que ele disse
   que vamos falar "em breve".
2. **A relação tipo de atividade → impacto operacional**, para automatizar
   (hoje é escolha de quem cria, R142/R169).
3. **Os documentos exportados do ERP com os equipamentos por cliente** (Fase
   H.5) — depois vem a API do QAP (R160: diária + botão Sincronizar; contato:
   Lopes, desenvolvedor do QAP ERP; só quando o sistema estiver redondo). Em
   08/09/2026 ele repetiu: o botão de forçar sincronismo com o QAP fica "para
   mais pra frente" (P63). E, à noite, a R237: equipamento entra no cliente
   **só pelo QAP**. O **mecanismo dos removidos** foi DITADO em 14/09 na
   **R293**: a baixa gera UMA atividade interna para o Gilleno por atendimento,
   com a lista do que saiu e o título "Movimentação de equipamentos no QAP".
   Falta implementar — não falta mais decidir.
4. **A leitura da proposta aprovada (PDF) pela IA** para criar as atividades
   da implantação (R148, H.6).
5. **Para onde o app Android aponta** (12/09/2026) — proposto: continuar na
   Lovable (HTTPS); o servidor Windows é HTTP interno e o 4G não chega nele.
   Os celulares terão chip de dados ou só Wi-Fi?
6. **Push com o app fechado** — proposto: nesta semana a urgência é card mais
   aviso in-app; o toque no celular (FCM) vem depois e exige uma conta Firebase
   que só ele cria. Esta máquina não compila o APK (sem SDK, Java 8).
7. **O que define "urgência fora do horário"** e se o plantonista vira o
   responsável automaticamente — proposto: chamado de campo urgente/emergencial
   criado fora de 08–18h ou em fim de semana/feriado vai para o plantonista da
   semana e o avisa. Quem abre à noite é a Rubia?
8. ~~**Trocar o cargo do Gilleno para SAC**~~ **FEITO** (13/09/2026, antes da
   U132). Conferido no perfil dele (`estoque@grupoprever.com.br`): ativo, e
   cargo `sac`.
9. **A lista das viaturas** — placa e apelido de cada carro (13/09/2026: "Ok
   eu passo"). **Parcial:** ele cadastrou a **VTR 253** (Gol preto, FPX3C86) e
   a sede em 13/09; faltam os outros carros. A aba Viaturas do Administrativo
   JÁ EXISTE (U134): ele cadastra
   lá, copia o endereço que a aba mostra e grava nas etiquetas NFC (NTAG213,
   app NFC Tools). Depois, ajustar a coordenada da sede na mesma aba (a
   semeada é o centro da rua). Q24–Q27 respondidas em 13/09 — ver
   `docs/CONTEXTO_VIATURAS.md` §6.

## 8. Quem é quem (resumo — o completo está em `CONTEXTO_OPERACAO_TECNICA.md` §1)

| Pessoa | Papel | Cargo no app |
|---|---|---|
| Davi | dono do produto; dita as regras; aprova e envia propostas | admin |
| Vinicius | gestor da equipe técnica de campo; valida o executado e lança cobrança | admin |
| Rubia | supervisora do atendimento da Portaria Remota; abre e gerencia chamados (R158) | sac |
| Erik, Nicholas | T.I. | operacional (R244) |
| Gilleno | Controle Patrimonial (opera o QAP ERP) | sac (R265 — trocado em 13/09/2026) |
| Breno e os líderes das duplas | técnicos de campo | tecnico |
| Lopes | desenvolvedor do QAP ERP (externo) — a integração, quando chegar a hora | — |

## 9. Como começar uma sessão

```bash
node scripts/verificar-logica.cjs        # tem de terminar "0 falharam"
npx vite build                           # tem de completar
npx tsc --noEmit | grep -c "error TS"    # tem de dar ZERO (U138)
```

Depois: `git status` limpo e `main` igual a `origin/main`; ler a §4 (há
migration pendente?) e a §7 (o que cobrar do Davi). Quando o Davi disser
"inicie a sessão", a resposta é o resumo destas seções, não um relatório.
