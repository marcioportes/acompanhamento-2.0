#!/usr/bin/env bash
# cc-worktree-start.sh — cria worktree + mailbox + lança listener em tmux
#
# Uso: ./scripts/cc-worktree-start.sh <issue-number> <branch-name>
# Ex:  ./scripts/cc-worktree-start.sh 154 fix/issue-154-botao-criar-plano
#
# Efeito:
#   - Cria worktree em ~/projects/issue-<NNN>
#   - Cria estrutura .cc-mailbox/{inbox,outbox,processed}
#   - Lança listener polling em tmux session 'cc-<NNN>' (detached)
#
# Listener:
#   - Polling de 2s em inbox/
#   - Arquivo .md novo → claude -p "<conteúdo>" no worktree
#   - Resultado → outbox/<nome>-result.log
#   - Prompt → processed/<nome>.md

set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Uso: $0 <issue-number> <branch-name>" >&2
  exit 1
fi

ISSUE="$1"
BRANCH="$2"
WORKTREE="$HOME/projects/issue-${ISSUE}"
SESSION="cc-${ISSUE}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"

# 1. Worktree
if [ ! -d "$WORKTREE" ]; then
  echo "[start] git worktree add $WORKTREE -b $BRANCH"
  cd "$REPO"
  git worktree add "$WORKTREE" -b "$BRANCH"
else
  echo "[start] Worktree já existe: $WORKTREE"
fi

# 2. Mailbox dirs
mkdir -p "$WORKTREE/.cc-mailbox/inbox"
mkdir -p "$WORKTREE/.cc-mailbox/outbox"
mkdir -p "$WORKTREE/.cc-mailbox/processed"
echo "[start] Mailbox pronto em $WORKTREE/.cc-mailbox/"

# 3. Listener em tmux (idempotente)
if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "[start] Tmux session '$SESSION' já ativa — reutilizando"
else
  LISTENER_SCRIPT="$WORKTREE/.cc-mailbox/listener.sh"
  cat > "$LISTENER_SCRIPT" <<'EOF'
#!/usr/bin/env bash
# Listener polling para CC mailbox do worktree atual.
set -u

INBOX="$(dirname "$0")/inbox"
OUTBOX="$(dirname "$0")/outbox"
PROCESSED="$(dirname "$0")/processed"
WORKTREE="$(cd "$(dirname "$0")/.." && pwd)"

cd "$WORKTREE"
echo "[listener] cwd=$WORKTREE — polling $INBOX a cada 2s"

while true; do
  # Pega o primeiro .md em ordem alfabética
  TASK=$(ls -1 "$INBOX"/*.md 2>/dev/null | head -n1 || true)
  if [ -n "$TASK" ] && [ -f "$TASK" ]; then
    NAME=$(basename "$TASK" .md)
    echo "[listener] Nova task: $NAME"
    PROMPT="$(cat "$TASK")"
    # Executa claude -p headless no cwd atual (worktree)
    claude -p "$PROMPT" > "$OUTBOX/${NAME}-result.log" 2>&1
    mv "$TASK" "$PROCESSED/"
    echo "[listener] Concluído: $NAME → outbox/${NAME}-result.log"
  fi
  sleep 2
done
EOF
  chmod +x "$LISTENER_SCRIPT"
  tmux new-session -d -s "$SESSION" "bash '$LISTENER_SCRIPT'"
  echo "[start] Listener lançado em tmux session '$SESSION'"
  echo "[start] Acompanhe com: tmux attach -t $SESSION  (ctrl+b d para destacar)"
fi

echo "[start] Pronto. Escreva prompt em: $WORKTREE/.cc-mailbox/inbox/<nome>.md"
