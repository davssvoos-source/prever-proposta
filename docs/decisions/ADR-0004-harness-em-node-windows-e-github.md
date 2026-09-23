# ADR-0004 — O harness roda em Node, no Windows e no Linux; o CI é o GitHub

- **Data:** 2026-09-23
- **Status:** Aceito (substitui o item 4 do ADR-0001)

## Contexto

O Pattern Harness foi escrito para Linux (sh POSIX, awk, find, Python 3 + PyYAML) e para o
Bitbucket (`bitbucket-pipelines.yml`). O Prever OS é desenvolvido no Windows, roda num Windows
Server e vive no GitHub. A adoção (ADR-0001, U156) manteve os scripts do padrão com muletas: o
`sh` do Git for Windows, um `py3.sh` para achar o Python certo (o `python3` do PATH é o atalho
da Microsoft Store) e um teste que precisou de `encoding='utf-8'` porque o `subprocess`
decodificava em cp1252. Funcionava nesta máquina — e só nela: sem Git Bash ou sem Python
instalado, "pronto" não roda. O Davi, 23/09/2026: *"esse pattern foi elaborado para Linux
Ubuntu e repositório Bitbucket, adapte para Windows, com repositório Github"*.

## Decisão

- **O harness fala a língua da stack: Node.** `harness-gates.cjs`, `harness-sync.cjs`,
  `harness-index.cjs` e `docs-lint.cjs` substituem o `.py` e os `.sh`; os testes do executor e
  do lint rodam com `node --test` (`scripts/tests/*.test.cjs`). A única dependência é `js-yaml`
  (devDependency, já vinha transitivamente), para recusar YAML malformado e chave duplicada.
- **O contrato do padrão não muda**: manifesto `version: 1`, seis verbos, `${commands.x}` com
  detecção de referência desconhecida, cíclica ou malformada, gates `{name, run, required}` com
  nomes únicos, saída 0/1/2; docs-lint R1–R5 com as mesmas mensagens; adaptadores e índice com
  o mesmo conteúdo. Os testes foram portados 1:1 e provam a equivalência.
- **Cada gate roda no shell da plataforma** (`shell: true`: cmd.exe no Windows, sh no Linux).
  Por isso todo `run:` do manifesto é neutro de shell — `node …`, `npx …`, `npm …`; nada de
  `true`, `test -f`, `[ ]`. Comando não encontrado é 127 no sh; o cmd.exe devolve 1 e não o
  distingue de falha comum — o que o contrato exige, gate obrigatório falhar, vale nos dois.
- **O CI é GitHub Actions em matriz `windows-latest` × `ubuntu-latest`**, Node 24 e `npm ci`,
  rodando o MESMO executor; a execução anterior da mesma branch é cancelada. Existe um modelo
  de pull request (`.github/pull_request_template.md`) com o checklist da skill `entrega`.
- `.gitattributes` continua forçando LF; os `--check` normalizam CRLF antes de comparar.

## Alternativas consideradas

- Manter sh + Python com muletas (ADR-0001, item 4): dois runtimes a mais num repositório Node
  e a armadilha do `python3` da Store. Descartada.
- WSL no Windows: não existe no servidor nem no runner `windows-latest`. Descartada.
- CI só no Linux: a produção é Windows; o executor precisa provar que roda lá. Descartada.
- Parser YAML próprio: o manifesto é simples, mas o contrato exige recusar YAML malformado e
  chave duplicada — reinventar isso é risco sem ganho.

## Consequências

- `node scripts/harness-gates.cjs` é a definição de pronto em qualquer máquina com Node —
  PowerShell, cmd, bash, CI. Sem `pip`, sem `sh`, sem `py -3`.
- Os scripts divergem do template do padrão; o contrato (o que cada um valida e imprime) é o
  mesmo, e os testes são a prova. Quem atualizar o padrão da casa compara contratos, não código.
- Minutos de CI: o runner Windows conta em dobro no GitHub; a matriz roda só em push no `main`
  e em pull request.
