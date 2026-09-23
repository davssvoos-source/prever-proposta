# Convenções

O que se repetia em toda entrega e virou ferramenta ou regra (Davi, 10/09/2026: "garanta
que o desenvolvimento contínuo […] economize esforço e ganhe eficiência no trabalho da
I.A."), mais as armadilhas que já morderam. Uma regra tem uma morada principal; os outros
documentos apontam para ela.

## As ferramentas da IA

- **Patch de código: `scripts/lib/editar.cjs`.** `abrir(arquivo)` → `troca` (exatamente
  UMA ocorrência) / `trocaTodas` / `antesDe` / `depoisDe` / `entre` / `anexa` → `lote(...)`
  grava TODOS ou NENHUM, listando cada marcador que não casou. O rascunho `.cjs` é escrito
  pelo Write no scratchpad — nunca heredoc do Bash nem `node -e` (comem barra invertida);
  nunca crase dentro de template literal (use arquivo `.txt` + inserção, ou concatenação).
- **Fim de entrega: `node scripts/fechar-entrega.cjs --versao X --regra Rn --diario Un`.**
  Sobe a versão nas duas fontes, atualiza o cabeçalho do ESTADO, regenera os sumários,
  roda o verificador e — só com 0 falharam — grava o número. Antes dele vem a prosa.
- **`soCodigo(texto, "js"|"sql")` antes de procurar construção de código.** Quatro
  asserções leram a PROSA que explica o defeito e concluíram que ele continuava lá.
- **Pino descreve ARQUIVO, nunca estado do banco.** "A migration existe / o código faz X"
  fica verde para sempre; "o ESTADO aponta a U tal como pendente" fica vermelho no dia em
  que o Davi roda a migration. Ao reapontar um pino, escreva o motivo ao lado.
- **Teste o caminho inteiro, não a camada.** Três defeitos empilhados no mesmo caminho
  (CHECK → RLS → FK; U84, U124, U125) — cada um escondia o seguinte.
- **MEDIR no navegador antes de dizer pronto** (U120, U122, U126): margem, largura,
  `getBoundingClientRect`. Um pino de CSS prova que a regra está escrita, não que a tela
  obedece. O app exige login e a IA não digita senha: sem sessão aberta, medir é do Davi.
- **Regex tolera a quebra de linha do markdown** (`\s+`): já foi a causa de quatro falsos
  vermelhos. E rodar o verificador com agente editando arquivo dá contagem torta.
- **Comando de gate é neutro de shell** (ADR-0004): o executor roda cada `run:` no shell da
  plataforma — cmd.exe no Windows, sh no Linux. `node …`, `npx …`, `npm …` valem nos dois;
  `true`, `test -f`, `[ ]` e `$VAR` não. Se precisa de lógica, escreva um `.cjs`.

## Armadilhas que já morderam (não redescubra)

- **PGRST201**: embed ambíguo depois de junção N:N — use a dica `tabela!coluna` (nome da
  COLUNA, não da constraint; rename de tabela não renomeia constraint).
- **Rename de tabela leva os triggers**, mas NÃO reescreve o corpo deles; `DISABLE TRIGGER
  USER` antes de mexer em dados históricos (e desligue notificações em cargas).
- **Recharts descarta `<defs>` embrulhado em componente** — escreva `<defs>{...}</defs>`
  direto no gráfico; linha toda no zero precisa `gradientUnits="userSpaceOnUse"`.
- **Funções voláteis em SELECT com ORDER BY** não garantem ordem — reserve em bloco.
- **CSP `script-src 'self'` derruba o SSR** (S10) — só Report-Only até validar local.
- **Constante de estilo em nível de módulo não enxerga tema** — vire função `(isLight)`.
- **Portal dentro de diálogo modal** (R243): menu por portal no `<body>` fica INERTE dentro
  de um Dialog do Radix — alvo é `closest('[role=dialog]')`, e a conta de
  `position: fixed` desconta `clientLeft/clientTop` do container transformado.
- **`e.currentTarget` fica null no updater funcional do React** — capture antes.
- **O plugin do TanStack Router reescreve `createFileRoute("…")`** pelo nome do arquivo
  assim que ele nasce com o dev server rodando.
- **O zip do pacote Windows sai incompleto com o dev server rodando** — pare antes.
- **O `tsc` foi de 85 a ZERO (U138)**, e a lição da U84 é que
  baseline de erro de tipo é onde defeito de PRODUÇÃO se esconde: 53 dos 57 últimos erros
  vinham de quatro colunas faltando em `types.ts`, e os quatro que sobraram eram defeito real
  (as escritas de `situacao=prospecto` que o CHECK recusa desde a U27). O baseline de tipos é
  ZERO; erro novo é erro seu.

## Concisão da documentação (gate `docs-lint`)

- Linhas de prosa ≤ 120 caracteres nos documentos novos do padrão; os documentos mestre
  anteriores estão em `LEGACY_PADRAO` (topo de `scripts/docs-lint.cjs`) e só avisam.
- Status de índice: uma linha, ≤ 140 caracteres. State descreve o presente; a história
  está no diário e no git. Data em state só em Pendências.
- Uma regra tem uma morada: R-série em PRODUTO, ferramenta aqui, receita de painel em
  `DASHBOARD.md`, token em `DESIGN_SYSTEM.md`. Não registre personas nem listas genéricas.

## Admissão de skills

Uma skill se justifica por procedimento recorrente, ordem com custo real de falha ou
conhecimento operacional que o código não revela. Procedimento inteiramente mecânico vira
script e gate; preferência de estilo vira convenção; fato ou decisão vira regra ou ADR.
