#!/bin/sh
# docs-lint — gate das regras anti-obesidade da documentação viva (docs/conventions.md).
# POSIX sh + awk, sem dependências. Contagem em CARACTERES (bytes de continuação UTF-8 descartados).
#
# Regras (falham o gate):
#   R1  linhas ≤ 120 caracteres fora de frontmatter, bloco de código, tabela e linhas com link;
#       arquivos em LEGACY só avisam até serem reescritos — remova cada um da lista ao normalizá-lo.
#   R2  coluna Status de docs/REQUIREMENTS.md: 1 linha, ≤ 140 caracteres.
#   R3  todo ADR (exceto o template) tem "- **Data:**" e "- **Status:**" e está indexado em docs/ARCHITECTURE.md.
#   R4  todo docs/requirements/<m>.md está em docs/REQUIREMENTS.md; todo docs/state/<m>.md tem seu requirements/<m>.md.
#   R5  docs/state/*.md sem data (dd/mm/AAAA, AAAA-MM-DD) fora de "## Pendências" — estado ≠ história.
#
# Adaptação ao Prever OS: os documentos mestre anteriores ao padrão estão em LEGACY (avisam, não
# falham) até serem normalizados; a cópia local do padrão (docs/padrao-projeto/) e os dados da
# carga (docs/importacao/) ficam fora; as skills de .claude/skills/ entram.
#
# Uso: sh scripts/docs-lint.sh [raiz]   (padrão: raiz deste checkout; sai 1 em qualquer erro, avisos não falham)
set -u
ROOT=${1:-$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)}
cd "$ROOT" || exit 1
fail=0; warn=0
err()  { echo "ERRO  $1"; fail=1; }
note() { echo "aviso $1"; warn=$((warn+1)); }

# Arquivos ou prefixos ainda não normalizados (projeto existente). DOCS_LINT_LEGACY no ambiente
# substitui a lista (vazio = tudo é verificado). Remova um item ao normalizar o arquivo.
LEGACY_PADRAO="docs/PRODUTO.md docs/PLANO_UNIFICACAO.md docs/ESTADO_ATUAL.md docs/DECISOES_PENDENTES.md
docs/PENDENCIAS_TECNICAS.md docs/PLANO_V0.1.md docs/VERSOES.md docs/DASHBOARD.md docs/SISTEMA_OS.md
docs/REGRAS_BLOCOS.md docs/REVISAO_2026-09-03.md docs/REVISAO_TIPOGRAFIA_2026-09-15.md docs/CONTEXTO_
docs/manual/ .claude/skills/organizador/ .claude/skills/designer/ .claude/skills/banco/"
LEGACY=${DOCS_LINT_LEGACY-"$LEGACY_PADRAO"}
is_legacy() {
  for l in $LEGACY; do case "$1" in "$l"*) return 0;; esac; done
  return 1
}
is_excluded() {
  case "$1" in docs/padrao-projeto/*|docs/importacao/*) return 0;; esac
  return 1
}

CHARS='s=$0; gsub("[\200-\277]","",s)'

# R1 — comprimento de linha
long_lines() {
  awk "BEGIN{fm=0;fence=0}
    NR==1 && /^---$/ {fm=1; next}  fm && /^---$/ {fm=0; next}  fm {next}
    /^\`\`\`/ {fence=!fence; next}  fence {next}  /^\|/ {next}  /\]\(|https?:\/\// {next}
    { $CHARS; if (length(s) > 120) c++ }  END {print c+0}" "$1"
}
for f in AGENTS.md README.md docs/*.md docs/*/*.md .harness/agents/*.md .claude/skills/*/SKILL.md; do
  [ -f "$f" ] || continue
  is_excluded "$f" && continue
  n=$(long_lines "$f")
  [ "$n" -eq 0 ] && continue
  if is_legacy "$f"; then note "R1 $f: $n linha(s) > 120 (legado — normalizar ao reescrever)"
  else err "R1 $f: $n linha(s) > 120 caracteres"; fi
done

# R2 — células Status (linhas de módulo começam com "| [")
if [ -f docs/REQUIREMENTS.md ]; then
  awk -F'|' '/^\| \[/ {m=$2; gsub(/^ +| +$/,"",m); s=$4; gsub(/^ +| +$/,"",s); gsub("[\200-\277]","",s);
    if (length(s) > 140) print m ": " length(s)}' docs/REQUIREMENTS.md > "${TMPDIR:-/tmp}/docs-lint.$$"
  while IFS= read -r l; do err "R2 Status > 140 caracteres em $l"; done < "${TMPDIR:-/tmp}/docs-lint.$$"
  rm -f "${TMPDIR:-/tmp}/docs-lint.$$"
fi

# R3 — ADRs
for f in docs/decisions/ADR-*.md; do
  [ -f "$f" ] || continue
  case "$f" in *ADR-0000-*) continue;; esac
  id=$(basename "$f" | cut -d- -f1-2)
  grep -q '^- \*\*Data:\*\*' "$f"   || err "R3 $f sem cabeçalho Data"
  grep -q '^- \*\*Status:\*\*' "$f" || err "R3 $f sem cabeçalho Status"
  grep -q "\[$id\](decisions/$(basename "$f"))" docs/ARCHITECTURE.md 2>/dev/null \
    || err "R3 $id não indexado em docs/ARCHITECTURE.md"
done

# R4 — índice e par requisito/estado
for f in docs/requirements/*.md; do
  [ -f "$f" ] || continue
  case "$f" in */_template.md) continue;; esac
  grep -q "(requirements/$(basename "$f"))" docs/REQUIREMENTS.md 2>/dev/null \
    || err "R4 $f fora do índice docs/REQUIREMENTS.md"
done
for f in docs/state/*.md; do
  [ -f "$f" ] || continue
  case "$f" in */_template.md) continue;; esac
  [ -f "docs/requirements/$(basename "$f")" ] || err "R4 $f sem docs/requirements/$(basename "$f") correspondente"
done

# R5 — estado ≠ história (tokens entre crases são identificadores e não contam)
for f in docs/state/*.md; do
  [ -f "$f" ] || continue
  case "$f" in */_template.md) continue;; esac
  n=$(awk '/^## Pendências/{p=1} !p' "$f" | sed 's/`[^`]*`//g' \
      | grep -cE '(^|[^0-9])[0-3][0-9]/[01][0-9]/20[0-9]{2}([^0-9]|$)|(^|[^0-9])20[0-9]{2}-[01][0-9]-[0-3][0-9]([^0-9]|$)')
  [ "$n" -gt 0 ] && err "R5 $f: $n marcador(es) temporal(is) fora de Pendências"
done

if [ "$fail" -ne 0 ]; then echo "docs-lint: FALHOU ($warn aviso(s) de legado)"; exit 1; fi
echo "docs-lint: ok ($warn aviso(s) de legado)"
