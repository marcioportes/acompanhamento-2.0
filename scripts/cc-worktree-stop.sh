#!/usr/bin/env bash
# cc-worktree-stop.sh — mata listener tmux + remove worktree (parte de §4.3)
#
# Uso: ./scripts/cc-worktree-stop.sh <issue-number>
# Ex:  ./scripts/cc-worktree-stop.sh 154

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Uso: $0 <issue-number>" >&2
  exit 1
fi

ISSUE="$1"
WORKTREE="$HOME/projects/issue-${ISSUE}"
SESSION="cc-${ISSUE}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"

# 1a. Mata watchdog (se PID registrado) — issue #178
WATCHDOG_PIDFILE="$WORKTREE/.cc-mailbox/.watchdog-pid"
if [ -f "$WATCHDOG_PIDFILE" ]; then
  WPID=$(cat "$WATCHDOG_PIDFILE" 2>/dev/null || echo "")
  if [ -n "$WPID" ] && kill -0 "$WPID" 2>/dev/null; then
    kill -TERM "$WPID" 2>/dev/null || true
    echo "[stop] Watchdog PID $WPID terminado"
  fi
  rm -f "$WATCHDOG_PIDFILE"
fi

# 1b. Mata tmux session (se existir)
if tmux has-session -t "$SESSION" 2>/dev/null; then
  tmux kill-session -t "$SESSION"
  echo "[stop] Tmux session '$SESSION' encerrada"
else
  echo "[stop] Nenhuma tmux session '$SESSION' ativa"
fi

# 2. Remove worktree (idempotente; erra se houver mudanças não commitadas)
if [ -d "$WORKTREE" ]; then
  cd "$REPO"
  if git worktree remove "$WORKTREE" 2>/dev/null; then
    echo "[stop] Worktree removido: $WORKTREE"
  else
    echo "[stop] AVISO: worktree tem mudanças pendentes. Commite/stash antes de remover."
    echo "       Ou force: git worktree remove --force $WORKTREE"
    exit 1
  fi
else
  echo "[stop] Nenhum worktree em $WORKTREE"
fi
