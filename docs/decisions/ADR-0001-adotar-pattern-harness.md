# ADR-0001 — Adotar o Pattern Harness no Prever OS

- **Data:** 2026-09-22
- **Status:** Aceito

## Contexto

O Prever OS já tinha uma arquitetura de documentação viva madura (regras R-série, diário
U-série, retrato, pendências, manual, 3.5k asserções), mas toda a configuração dos agentes
morava num `CLAUDE.md` de 14 KB — específico de uma ferramenta — e não havia índice por
módulo nem definição mecânica de "pronto". A T.I. do Grupo Prever padronizou o **Pattern
Harness** (Bitbucket `preverti/pattern`) para todos os projetos com agentes de IA. O Davi
pediu, em 22/09/2026: "Aplique o padrão estruturado […] a IA deve atualizar a
documentação conforme o projeto, principalmente o arquivo README.md".

## Decisão

Adotar o padrão com **quatro adaptações declaradas**, porque a casa já tinha decisões que o
padrão genérico não previa:

1. **`AGENTS.md` é a cápsula** e `CLAUDE.md` vira `@AGENTS.md` (adaptador gerado). O bloco
   `LOVABLE:BEGIN/END` no topo de `AGENTS.md` é da Lovable e fica intocado enquanto ela
   publicar de `main`.
2. **O identificador `R#` é GLOBAL**, não local ao módulo. O catálogo é `docs/PRODUTO.md`,
   com 305 regras citadas por número em código, diário, verificador e manual; um esquema
   `<modulo>:R#` brigaria com milhares de referências. `docs/requirements/<modulo>.md` lista
   as regras que governam o módulo e aponta para o catálogo.
3. **Skills vivem em `.claude/skills/`** (o local do padrão aberto Agent Skills), sem
   symlink: a casa já tinha três skills lá e este Git Bash no Windows copia em vez de
   linkar. `.harness/` fica com manifesto, papéis, MCP e índice.
4. **O executor roda no Windows**: `harness-gates.py` usa o `sh` do Git quando `/bin/sh`
   não existe, e os gates com Python chamam `scripts/py3.sh` (que acha `python3`, `py -3`
   ou `python`). O CI é GitHub Actions, porque o repositório está no GitHub.

Os documentos que já existiam continuam sendo a fonte (ADR-0002); o verificador da casa é
o gate de testes (ADR-0003).

## Alternativas consideradas

- Manter `CLAUDE.md` como fonte e gerar `AGENTS.md` dele: inverte o padrão da casa e
  deixa as outras ferramentas lendo um adaptador. Descartada.
- Fatiar `PRODUTO.md` em requisitos EARS por módulo com `R#` local: reescreveria 305
  regras ditadas pelo Davi e quebraria as referências. Descartada — mapear, não reescrever.
- Symlink `.claude/skills → .harness/skills`: não funciona neste Windows e a Lovable clona
  o repositório para buildar. Descartada.

## Consequências

- Qualquer ferramenta (Claude Code, Cursor, Gemini, Copilot, Antigravity) lê a mesma
  cápsula; `scripts/harness-sync.sh --check` acusa adaptador divergente.
- "Pronto" deixa de ser sensação: `python3 scripts/harness-gates.py` (Windows: `py -3`).
- Custo: rodar `harness-sync.sh` e `harness-index.sh` após alterar a fonte, e manter o
  `state/<modulo>.md` no presente a cada entrega.
- Os documentos mestre anteriores estão em `LEGACY` do `docs-lint.sh` até serem
  normalizados (linhas > 120 só avisam).
