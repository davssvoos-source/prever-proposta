# Estado atual do projeto — leia isto primeiro

> **Para que serve.** Este arquivo é a memória do projeto que viaja com o
> repositório. Numa máquina nova (ou numa sessão nova do assistente, que
> começa sem memória local) ele responde em cinco minutos: onde estamos, o
> que está pendente, o que o Davi já decidiu e o que ele ainda vai mandar.
> **Atualize-o no fim de cada entrega** — é o passo 7 do ciclo de trabalho em
> `CLAUDE.md`. Se ele discordar do código ou de `docs/PRODUTO.md`, eles
> ganham — e isto aqui se corrige.

Última atualização: **2026-09-11** · última regra: **R257** · último diário:
**U129** · verificador: **3.272 asserções, 0 falharam** · `tsc`: baseline
**57** · migrations rodadas até a **U129** (U127 e U129 em 11/09/2026) ·
**nenhuma migration pendente** · **versão no servidor: v0.0.7**
(192.168.10.182); **esta entrega é a v0.0.11**, e ela sobe de uma vez o que a
v0.0.8, a v0.0.9 e a v0.0.10 já tinham entregue — o que entrou em cada versão
está em `docs/VERSOES.md`. Fim de entrega:
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
9. `docs/VERSOES.md` — o que entrou em cada versão instalada no servidor
   (R229): a versão é o que muda no servidor; a migration é o que muda no
   banco; os dois andam juntos.

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

## 4. Banco: migrations

O repo **nunca aplica** migration: o Davi roda à mão no SQL Editor do
Supabase, na ordem dos nomes de arquivo (`supabase/migrations/`). Cada uma é
idempotente e termina com uma conferência obtido × esperado × veredito.

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
- **R211–R217** — a estrutura entra em O local; a coluna Atividades usa o
  **card da Início** (borda pelo prazo); **Problema/Diagnóstico só na
  corretiva** (os outros tipos têm Descrição); a **Proposta Comercial expande
  no "+"** (o formulário da visita é componente, a rota é casca); o **chat de
  menções** na Início: botão fixo, menções de comentário e de descrição, a
  atividade abre no meio da tela, "Responder aqui" vira comentário com menção
  (decisão a rever se o Davi quiser), reações por emoji (lista fechada, tabela
  própria). Pendência: **rodar a U117**.
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
   próximo passo**: destrava B2 (Início do técnico), C (validação, R155/R162),
   H.1 (mini-calendário e a visita que trava a agenda, R172), a tela da data
   agendada (R168), a proposta em duas atividades (R170) e a revisão da lista
   de tipos do chamado de campo (`TIPOS_DA_NATUREZA.campo`, R156).
2. **A relação tipo de atividade → impacto operacional**, para automatizar
   (hoje é escolha de quem cria, R142/R169).
3. **Os documentos exportados do ERP com os equipamentos por cliente** (Fase
   H.5) — depois vem a API do QAP (R160: diária + botão Sincronizar; contato:
   Lopes, desenvolvedor do QAP ERP; só quando o sistema estiver redondo). Em
   08/09/2026 ele repetiu: o botão de forçar sincronismo com o QAP fica "para
   mais pra frente" (P63). E, à noite, a R237: equipamento entra no cliente
   **só pelo QAP** — o **mecanismo dos removidos** no Administrativo › Catálogo
   (a lista e o checklist) ele "estrutura em breve".
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
