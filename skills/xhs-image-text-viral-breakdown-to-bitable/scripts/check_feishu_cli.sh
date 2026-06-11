#!/usr/bin/env bash
set -euo pipefail

if command -v lark-cli >/dev/null 2>&1; then
  echo "lark-cli"
  exit 0
fi

if command -v feishu >/dev/null 2>&1; then
  echo "feishu"
  exit 0
fi

if command -v lark >/dev/null 2>&1; then
  echo "lark"
  exit 0
fi

if [ -d "$HOME/.lark-cli" ] || [ -d "$HOME/Library/Application Support/lark-cli" ]; then
  echo "npx -y @larksuite/cli"
  exit 0
fi

if command -v npx >/dev/null 2>&1; then
  echo "npx -y @larksuite/cli"
  exit 0
fi

echo "missing"
exit 1

