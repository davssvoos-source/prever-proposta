# Versões do Prever — o que entrou em cada uma

> Uma linha por versão, o que mudou para quem usa, e a migration que ela
> exige. A versão mora em `package.json` (espelhada em `src/lib/versao.ts` e
> gravada em `VERSAO.txt` pelo pacote Windows); o verificador confere que as
> duas são iguais. Regra de casa (R229, Davi, 08/09/2026): "qualquer alteração
> que façamos será executada via versionamento do sistema, para preservar o
> banco de dados" — o banco muda só por migration numerada (U-série, rodada
> pelo Davi no SQL Editor), o servidor muda só por pacote
> (`npm run build:windows` → `atualizar.ps1`, ver `manual/hospedagem-windows.md`).

## v0.0.11 — 2026-09-11 (U129) · migrations **U127 e U129 já rodadas** (11/09/2026)

> Este pacote sobe de uma vez tudo o que o servidor não tinha: ele está na
> v0.0.7, e a v0.0.8, a v0.0.9 e a v0.0.10 foram entregues e não instaladas.
> As duas migrations que faltavam (U127 e U129) foram rodadas em 11/09/2026.

- **O Sobreaviso é montado por SEMANA** (R253): a faixa "A escala" tem uma linha
  por semana com o seletor do plantonista, e o par **Semana | Mês** troca o
  período. Escolher um nome lança os oito dias com as pontas certas (6 h na
  segunda de entrada, 14 nos úteis, 24 no fim de semana e no feriado, 8 na
  segunda de saída). O PDF continua sendo o do mês.
- **O calendário do plantão ganhou a BARRA** (R254): a faixa amarela fosca
  mostra de quando até quando cada um está de sobreaviso. Clicar seleciona a
  barra e **Delete** apaga; o botão **"Remover dia"** tira um dia só, com
  pré-visualização ao passar o cursor. Tirar um dia do meio parte a barra em
  duas, cada metade com as pontas arredondadas.
- **Trocar o plantonista TROCA, não soma** (R254): as horas saem de quem estava
  e vão para quem entrou, numa transação só. Quem sai mantém a madrugada da
  segunda que pertence à semana anterior.
- **Mais de um plantonista na mesma semana**: o **"+"** à direita da linha.
- **Só a equipe técnica** aparece no seletor (o campo Equipe do cadastro, não o
  cargo). Quem tem horas antigas continua na grade, esmaecido.
- **As margens da tela voltaram para a régua do sistema** — o conteúdo nascia
  colado na barra lateral e a grade ficava 24 px à direita do resto.
- **Banco:** a **U129** cria `sobreaviso_trocar_plantonista`. Já rodada.

## v0.0.10 — 2026-09-10 (U128) · sem migration nova · **a U127 (v0.0.9) continua pendente**

- **A próxima atividade agora é um card do quadro** (R248): no desktop, o
  banner "A seguir" saiu de cima dos filtros e virou o primeiro card da coluna
  **Agendado**, com etiqueta e anel próprios (ou **ATRASADA**, em vermelho). A
  coluna ganhou ordem fixa: o dia marcado mais próximo em cima, seja qual for a
  ordem escolhida no botão. No celular o banner continua.
- **"Responder aqui" põe o cursor na caixa** do chat (R249).
- **A busca da Início acha pelo nome do prédio** (R250) — inclusive quando ele
  entra na atividade como setor ou prospecção, e não como cliente.
- **Filtro por Tipo de Demanda** na barra da Início (R251), valendo na lista,
  no quadro e nos painéis do topo.
- **O Painel Comercial tem lista e quadro** (R252): uma coluna por etapa do
  ciclo (visita pendente → aguardando revisão → aprovada → proposta enviada,
  mais cancelada). O botão fica no fim da barra de etapas e a escolha é
  lembrada. Não se arrasta card: cada transição tem porta própria.
- **Banco:** nada novo. A **U127** (do pacote v0.0.9) **ainda precisa ser
  rodada** — é ela que cria o cargo OPERACIONAL.

## v0.0.9 — 2026-09-10 (U127) · migration **U127** — rodar ANTES de subir o pacote

- **O perfil OPERACIONAL** (R244): um quinto cargo, para o Nicholas e o Erik.
  Abre Início, Calendário, Clientes e Perfil; vê todas as atividades de todos;
  pode ser responsável por visita e chamado de campo; não é gestor. Aparece na
  tela de Usuários, no convite e na matriz de Permissões.
- **O chat não perde mensagem** (R245): a resposta que alguém manda pelo chat
  aparece no chat de quem respondeu E no de quem foi respondido — antes ela
  sumia do segundo. A caixa de texto não quebra mais no Backspace vazio, não
  mostra barra de rolagem, e o "Escreva para todos…" nasce no lugar do texto.
  **Teclar `#`** abre a lista das atividades recentes (só o nome); escolher uma
  arma a resposta para ela.
- **A Início mostra tudo** (R246): todas as atividades em aberto e as 300
  concluídas mais recentes — a poda de sete dias saiu. No Kanban, a coluna
  Concluído fica em ordem de conclusão (a mais recente no topo), fixa, seja
  qual for a ordem escolhida no botão; e o texto da ordem ("Prazo (crescente)")
  passou para a esquerda do botão.
- **A tela do chamado de campo no desktop** (R247): a mesma grade da atividade
  interna — o trabalho à esquerda, a ficha (status, cliente, técnico, agenda,
  ações) à direita. No celular a ficha vem primeiro. O pop-up da Início mostra
  a mesma tela.
- **Banco:** a **U127** cria o cargo nos cinco lugares que enumeram cargos
  (enum, dois CHECKs, `salvar_permissoes`, `handle_new_user`) e semeia a
  matriz de telas do operacional. Sem ela, a tela de Usuários não consegue
  gravar o cargo novo (o CHECK recusa) — rodar ANTES do pacote.

## v0.0.8 — 2026-09-10 (U126) · sem migration

- **Os botões de Status, Tipo e Impacto voltam a funcionar no pop-up** da
  atividade: a lista deles era desenhada fora da janela, e uma janela modal
  deixa inerte tudo o que está fora dela — clicar numa opção não escolhia nada
  e ainda fechava o pop-up.
- **A tela da atividade fala menos** (R243): saíram o número repetido, a linha
  "aberta há Nd por Fulano", as duas dicas do checklist, a legenda da barra do
  editor, a frase do prazo e a linha de origem da rosca. O que elas ensinavam
  ficou no `title` dos botões, e o que era informação (tipo, quem abriu e
  quando, "Re-agendado 2x") continua na ficha.
- **Os títulos de seção crescem 20%** (PROBLEMA DETECTADO, FICHA, COMENTÁRIOS…)
  e o número dentro da rosca diminui; os botões de escolha ficam mais baixos.

## v0.0.7 — 2026-09-09 (U125) · migration **U125** — rodar ANTES de subir o pacote

- **Agendar visita técnica volta a funcionar** — era o erro "violates foreign
  key constraint visitas_e_chamado". A visita é satélite de um chamado (a capa
  que aparece no quadro), e a capa estava sendo criada tarde demais: o banco
  conferia o vínculo antes de ela existir. Desde 21/08 nenhuma visita podia ser
  criada pelo sistema; os três erros do caminho (situação, cliente, chave)
  estavam empilhados, cada um escondendo o seguinte.
- **A proposta aparece com o lugar** no quadro da Início: a capa passa a
  registrar o local — cliente da base ou prospecção.
- **O endereço vale sem o mapa** (R242): quando o botão de localizar não acha o
  ponto, o sistema diz que **o endereço está salvo** e explica o que ajuda a
  achar, em recado e não em vermelho. O campo passou a pedir "Rua, número,
  bairro, **cidade**" — era a cidade que faltava para o mapa achar.
- **Banco:** a **U125** troca a hora em que a capa nasce (gatilho BEFORE
  INSERT) e registra o local. Sem ela, criar visita continua falhando.

## v0.0.6 — 2026-09-09 (U124) · migration **U124** — rodar ANTES de subir o pacote

- **A proposta comercial volta a nascer** (R21/R22): a visita de um prédio que
  ainda não é cliente registra uma **prospecção** — com endereço, contatos e
  coordenada — em vez de tentar cadastrar um cliente. Era isto que derrubava a
  criação com "new row violates row-level security policy for table clientes":
  desde agosto o app não pode criar cliente (cliente vem do QAP), e a tela
  ainda tentava. Proposta comercial não faz de um condomínio nosso cliente.
- **O admin faz visita técnica** (R241): usuários de cargo admin aparecem na
  lista de responsáveis ao agendar, junto dos técnicos — e a mesma lista vale
  na programação, no painel Operacional, nas duplas e no chamado de campo.
- **Banco:** a **U124** cria `achar_ou_criar_prospeccao_do_local`. Sem ela a
  tela avisa que o prédio novo precisa da migration — e não volta a tentar
  criar cliente.

## v0.0.5 — 2026-09-09 (U123) · migration **U123** — rodar ANTES de subir o pacote

- **O chat virou conversa** (R240): cada mensagem é um campo na cor do prazo com
  o **título da atividade dentro dele**, e a **resposta que você manda pelo chat
  fica no chat**, no mesmo campo da mensagem que respondeu, como uma caixa de
  mensagem separada (com foto, nome e hora de quem falou). O campo que recebe
  resposta vai para o fim da lista.
- Antes, responder pelo chat mandava o recado para os comentários da atividade e
  a mensagem desaparecia da sua tela — ela aparecia só para a outra pessoa.
- **Banco:** a **U123** acrescenta a ligação `responde_a` em `chamado_eventos` e
  a leitura `respostas_do_chat`. Sem ela o chat avisa e a resposta continua indo
  para os comentários da atividade, só não volta para o chat.

## v0.0.4 — 2026-09-08 (U121–U122) · migrations **U119** e **U121** — rodadas em 08/09/2026, nada a fazer no banco

- **A tela da atividade na estrutura aprovada** (R234): documento à esquerda
  — título, textos ocupando a faixa inteira (Problema e Solução lado a lado no
  monitor grande), equipamentos, conversa — e a **ficha** à direita, que
  acompanha a rolagem: a rosca do progresso e as propriedades uma por linha
  (Status, Tipo, Impacto, Quando, Responsável, Apoio, Equipes, Proposta,
  Cliente). A etiqueta de status saiu do título.
- **O pop-up da Início mostra a mesma tela** (R238): o card do quadro e a
  menção do chat abrem a atividade inteira num diálogo largo; um botão leva à
  página. A folha lateral de consulta fica só no Calendário e no Operacional.
- **Equipamento entra no cliente só pelo QAP** (R237): os painéis viraram
  **Blocos do cliente** e **Sem bloco**; arrastar para um bloco = instalado
  ali; **remover** é um botão em cada item. O "Fora do cliente" da v0.0.3
  saiu, e o banco (U121) recusa instalar item que não seja do cliente.
- **O pop-up não é mais cortado pelo menu** (R239): um diálogo cobre a janela
  inteira e escurece o resto — antes o menu lateral pintava por cima dele.
- **Uma régua de margem para o sistema inteiro** (R239): a Início, a tela da
  atividade e a ficha do cliente começam no mesmo prumo (24px do menu no
  desktop, 16 no celular), e o espaçamento por dentro segue uma escala só.
- **Um scroll só** (R239): acabou a rolagem dentro da rolagem — a ficha das
  propriedades e os painéis de equipamento rolam com a página.
- **Equipamentos vem recolhido** (R239), com o botão que abre na ponta direita
  e um resumo do que tem dentro.
- **Banco:** a **U121** reescreve `mover_equipamento` e exige a U119. As duas
  rodaram em 08/09/2026 — este pacote não pede nada do banco.

## v0.0.3 — 2026-09-08 (U120) · migration **U119** (a mesma da v0.0.2; rode antes se ainda não rodou)

- **O sistema chama-se Prever OS** (R230): no título da aba e na tela de login,
  com a versão embaixo.
- **A tela da atividade virou um posto de trabalho de desktop** (R234): quatro
  faixas (cabeçalho · propriedades · textos + contexto · equipamentos e
  conversa), margem lateral de verdade (40/56px, iguais dos dois lados), os
  dois textos ocupando a maior parte da tela e lado a lado a partir de 1700px.
- **Rosca de progresso** no canto superior direito (R235): conta o checklist da
  Descrição (da Solução, na corretiva); sem checklist é 0%, concluída é 100%.
- **Equipamentos por arrasto** (R236): dois painéis — o patrimônio do cliente
  por bloco e o que está fora dele.
- **No quadro, a coluna inteira aceita o card** (R233): soltar na faixa da
  coluna vizinha basta, sem subir até onde ela tem card.
- **Prazo × Agendar num controle só** (R232); o botão do plantão saiu da tela
  de abrir chamado (R231).
- Nenhuma mudança de banco nesta versão.

## v0.0.2 — 2026-09-08 (U119) · migration **U119** (rodar ANTES de subir o pacote)

- **Todos veem todas as atividades** (R221): a Início do técnico deixa de
  mostrar só o que é dele; a lente "Meu dia" continua para quem quiser.
- **Chat da Início como conversa** (R222–R223): 9:16, avatar + título +
  data/hora + conteúdo na cor do prazo, responder/reagir só em comentário,
  recado para todos, resposta pelo `#Código`, selo vermelho, alça para
  arrastar, recolher e restaurar a posição, campo fixo embaixo.
- **Editor de texto novo** (R224): uma área só, checklist/lista em várias
  linhas de uma vez, negrito sem perder a seleção, menção mostra só o nome.
- **Toda atividade pode ser agendada** (R225): coluna "Agendado" no quadro,
  agendada não tem prazo, "Re-agendado Nx", aviso às 08h.
- **Equipamentos removidos e instalados pela atividade** (R226), quando o
  cliente é único; o patrimônio (QAP) reflete.
- **Etiquetas do card empilhadas** Cliente → Tipo → Risco (R227); **tela da
  atividade na largura do desktop** (R228).
- **Imagens locais** (R229): o banner escuro não carregava no servidor.
- Versão visível sob o logotipo; este arquivo nasce.

## v0.0.1 — 2026-09-08 (U118) · migrations até a **U117**

- O primeiro pacote instalado no servidor Windows da empresa
  (`Instalar-Prever.exe`, porta configurável, serviço "Prever — Sistema").
  Chegou com o `package.json` em `1.0.0`; o número foi acertado para
  `0.0.2` na versão seguinte — este é o ponto zero da contagem.
- Tudo o que existia até a R220 (ver `PRODUTO.md`).
