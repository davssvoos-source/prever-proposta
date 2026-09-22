#!/bin/sh
# py3 — acha um Python 3 e repassa os argumentos. Linux/CI: python3. Windows: o
# `python3` do PATH costuma ser o atalho da Microsoft Store (que só abre a loja),
# então testa de verdade antes de usar e cai para `py -3` e `python`.
set -u
for c in python3 python; do
  if command -v "$c" >/dev/null 2>&1 && "$c" -c "import sys; sys.exit(0 if sys.version_info[0] == 3 else 1)" >/dev/null 2>&1; then
    exec "$c" "$@"
  fi
done
if command -v py >/dev/null 2>&1; then exec py -3 "$@"; fi
echo "py3.sh: nenhum Python 3 encontrado (python3, py -3, python)" >&2
exit 127
