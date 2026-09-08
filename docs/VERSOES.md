# Versões do Prever — o que entrou em cada uma

> Uma linha por versão, o que mudou para quem usa, e a migration que ela
> exige. A versão mora em `package.json` (espelhada em `src/lib/versao.ts` e
> gravada em `VERSAO.txt` pelo pacote Windows); o verificador confere que as
> duas são iguais. Regra de casa (R229, Davi, 08/09/2026): "qualquer alteração
> que façamos será executada via versionamento do sistema, para preservar o
> banco de dados" — o banco muda só por migration numerada (U-série, rodada
> pelo Davi no SQL Editor), o servidor muda só por pacote
> (`npm run build:windows` → `atualizar.ps1`, ver `manual/hospedagem-windows.md`).

## v0.0.4 — 2026-09-08 (U121) · migrations **U119** (se ainda não rodou) e depois **U121** — rodar ANTES de subir o pacote

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
- **Banco:** a **U121** reescreve `mover_equipamento`. Exige a U119 — rode a
  U119 primeiro se ainda não rodou.

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
