#!/bin/sh
# harness-index — gera .harness/INDEX.md, o nó raiz de navegação do harness.
# Índice é DERIVADO, nunca redigido: um recurso por linha, ordenado por caminho,
# com a descrição extraída do próprio arquivo (frontmatter `description:`,
# primeiro título `# `, ou primeira linha).
#
# Adaptação ao Prever OS: entram também as skills de .claude/skills/; ficam de fora
# a cópia local do padrão (docs/padrao-projeto/, clone fora do git) e os dados da
# carga do QAP (docs/importacao/), que não são documentação.
#
# Uso:
#   sh scripts/harness-index.sh          # (re)gera .harness/INDEX.md
#   sh scripts/harness-index.sh --check  # falha se o índice divergiu (CI e gate)
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
MODE=${1:-write}
OUT="$ROOT/.harness/INDEX.md"
TMP="${TMPDIR:-/tmp}/harness-index.$$"
trap 'rm -f "$TMP"' EXIT

describe() { # extrai descrição de uma linha do arquivo
  case "$1" in
    *.json) awk -F'"' '/"\$comment"/ {print $4; exit}' "$1" ;;
    *) awk '
        /^description:/ {sub(/^description:[ \t]*/, ""); print; done = 1; exit}
        /^# /           {sub(/^# /, ""); print; done = 1; exit}
        NR == 1         {line = $0}
        END             {if (!done && line != "") print line}
      ' "$1" ;;
  esac
}

{
  printf '# Índice — Prever OS\n\n'
  printf '> Gerado por `scripts/harness-index.sh` — não editar à mão.\n'
  printf '> Nó raiz da navegação: um recurso por linha, ordenado por caminho.\n'
  printf '> Arestas entre recursos usam referências tipadas por ID estável\n'
  printf '> (R# de docs/PRODUTO.md, U#, P#, ADR-####, nome de skill) dentro dos próprios arquivos.\n\n'
  {
    printf '%s\n' "AGENTS.md" "README.md" "DESIGN_SYSTEM.md" "ONBOARDING.md"
    (cd "$ROOT" && find .harness .claude/skills docs -type f \( -name '*.md' -o -name '*.yaml' -o -name '*.json' \) \
       ! -name 'INDEX.md' ! -path 'docs/padrao-projeto/*' ! -path 'docs/importacao/*')
  } | LC_ALL=C sort | while IFS= read -r f; do
    printf -- '- `%s` — %s\n' "$f" "$(describe "$ROOT/$f")"
  done
} > "$TMP"

if [ "$MODE" = "--check" ]; then
  if ! cmp -s "$TMP" "$OUT"; then
    echo "DIVERGENTE: .harness/INDEX.md (rode sh scripts/harness-index.sh)" >&2
    exit 1
  fi
  echo "índice em sincronia"
else
  mv "$TMP" "$OUT"
  trap - EXIT
  echo "gerado: .harness/INDEX.md"
fi
