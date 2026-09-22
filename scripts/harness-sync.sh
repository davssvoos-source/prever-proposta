#!/bin/sh
# harness-sync — regenera os adaptadores por ferramenta a partir da fonte
# canônica (AGENTS.md + .harness/). POSIX, sem dependências.
#
# Adaptação ao Prever OS (ADR-0001): as skills vivem em .claude/skills/ como
# diretório real — não há symlink (este Git Bash no Windows copia em vez de linkar,
# e a Lovable clona o repositório para publicar).
#
# Uso:
#   sh scripts/harness-sync.sh          # (re)gera adaptadores
#   sh scripts/harness-sync.sh --check  # falha se algum adaptador divergiu (CI e gate)
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
MODE=${1:-write}
STATUS=0

emit() { # emit <caminho-relativo> <conteúdo>
  path="$ROOT/$1"; content="$2"
  if [ "$MODE" = "--check" ]; then
    if [ ! -f "$path" ] || [ "$(cat "$path")" != "$content" ]; then
      echo "DIVERGENTE: $1 (rode sh scripts/harness-sync.sh)" >&2; STATUS=1
    fi
  else
    mkdir -p "$(dirname "$path")"
    printf '%s\n' "$content" > "$path"
    echo "gerado: $1"
  fi
}

GUIA="Siga AGENTS.md na raiz do repositório (cápsula de contexto, fonte canônica).
Comandos e gates: .harness/harness.yaml. Documentação viva pelos índices
docs/ESTADO_ATUAL.md, docs/REQUIREMENTS.md e docs/ARCHITECTURE.md — nunca leia
docs/ por inteiro. Regras de produto: docs/PRODUTO.md (R-série, cite pelo número).
Não edite arquivos gerados; rode scripts/harness-sync.sh após alterar a fonte."

# --- Claude Code: CLAUDE.md importa a fonte -------------------------------
emit "CLAUDE.md" "@AGENTS.md"

# --- Cursor: regra sempre ativa apontando para a fonte --------------------
emit ".cursor/rules/harness.mdc" "---
description: Pattern Harness — fonte canônica de instruções do Prever OS
alwaysApply: true
---
$GUIA"

# --- Gemini CLI ------------------------------------------------------------
emit ".gemini/GEMINI.md" "$GUIA"

# --- Antigravity (.agent/rules, regra sempre ativa) ------------------------
emit ".agent/rules/harness.md" "---
trigger: always_on
---
$GUIA"

# --- GitHub Copilot -------------------------------------------------------
emit ".github/copilot-instructions.md" "$GUIA"

# --- MCP: projeção para Claude Code (.mcp.json na raiz) -------------------
emit ".mcp.json" "$(cat "$ROOT/.harness/mcp/servers.json")"

[ "$MODE" = "--check" ] && [ "$STATUS" -eq 0 ] && echo "adaptadores em sincronia"
exit "$STATUS"
