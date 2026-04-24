#!/usr/bin/env bash
# archive-issue.sh — move arquivo de controle de issue fechada para docs/dev/archive/YYYY-QQ/
#
# Uso:
#   scripts/archive-issue.sh <issue_num>       # arquiva 1 issue (após PR mergeado)
#   scripts/archive-issue.sh --all-closed      # arquiva todos os issues CLOSED no GitHub
#
# Integra-se ao protocolo §4.3 (Encerramento) — rodar como último passo após merge.
# Quarter = Q1 (Jan-Mar), Q2 (Abr-Jun), Q3 (Jul-Set), Q4 (Out-Dez) baseado no mês atual.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
ISSUES_DIR="$REPO_ROOT/docs/dev/issues"
ARCHIVE_ROOT="$REPO_ROOT/docs/dev/archive"

# Determina quarter atual (YYYY-QN)
year=$(date +%Y)
month=$(date +%m | sed 's/^0*//')
if   [ "$month" -le 3 ];  then quarter="Q1"
elif [ "$month" -le 6 ];  then quarter="Q2"
elif [ "$month" -le 9 ];  then quarter="Q3"
else quarter="Q4"
fi
DEST_DIR="$ARCHIVE_ROOT/$year-$quarter"
mkdir -p "$DEST_DIR"

archive_one() {
  local num="$1"
  local padded num_stripped
  # Normaliza: "119" ou "0119" → "119"
  num_stripped=$(echo "$num" | sed 's/^0*//')
  # Tenta match com zero-padding comum (089) e sem (119)
  local match=""
  for prefix in "$num_stripped" "0$num_stripped" "00$num_stripped"; do
    match=$(find "$ISSUES_DIR" -maxdepth 1 -type f -name "issue-${prefix}-*.md" | head -1)
    [ -n "$match" ] && break
  done
  if [ -z "$match" ]; then
    echo "[skip] issue-$num: arquivo não encontrado em $ISSUES_DIR/"
    return 0
  fi
  local base
  base=$(basename "$match")
  if [ -e "$DEST_DIR/$base" ]; then
    echo "[skip] $base: já existe em $DEST_DIR/"
    return 0
  fi
  git mv "$match" "$DEST_DIR/$base"
  echo "[ok]   $base → $DEST_DIR/"
}

if [ "${1:-}" = "--all-closed" ]; then
  # Descobre issues fechadas via gh CLI e arquiva cada uma
  for f in "$ISSUES_DIR"/issue-*.md; do
    [ -e "$f" ] || continue
    base=$(basename "$f")
    num=$(echo "$base" | sed -E 's/^issue-0*([0-9]+)-.*/\1/')
    state=$(gh issue view "$num" --json state -q .state 2>/dev/null || echo "UNKNOWN")
    if [ "$state" = "CLOSED" ]; then
      archive_one "$num"
    else
      echo "[skip] issue-$num: state=$state"
    fi
  done
elif [ -n "${1:-}" ]; then
  archive_one "$1"
else
  echo "uso: $0 <issue_num> | --all-closed"
  exit 1
fi
