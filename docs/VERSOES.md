# Versões do Prever — o que entrou em cada uma

> Uma linha por versão, o que mudou para quem usa, e a migration que ela
> exige. A versão mora em `package.json` (espelhada em `src/lib/versao.ts` e
> gravada em `VERSAO.txt` pelo pacote Windows); o verificador confere que as
> duas são iguais. Regra de casa (R229, Davi, 08/09/2026): "qualquer alteração
> que façamos será executada via versionamento do sistema, para preservar o
> banco de dados" — o banco muda só por migration numerada (U-série, rodada
> pelo Davi no SQL Editor), o servidor muda só por pacote
> (`npm run build:windows` → `atualizar.ps1`, ver `manual/hospedagem-windows.md`).

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
