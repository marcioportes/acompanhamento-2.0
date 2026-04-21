#!/usr/bin/env bash
# cc-worktree-start.sh — cria worktree + mailbox + lança listener em tmux
#
# Uso: ./scripts/cc-worktree-start.sh <issue-number> <branch-name> [coord-session-id]
# Ex:  ./scripts/cc-worktree-start.sh 154 fix/issue-154-botao-criar-plano
#      ./scripts/cc-worktree-start.sh 156 arch/... 3fcd4a52-bb4c-49fc-af80-5d71d081158c
#
# Efeito:
#   - Cria worktree em ~/projects/issue-<NNN>
#   - Cria estrutura .cc-mailbox/{inbox,outbox,processed}
#   - Lança listener polling em tmux session 'cc-<NNN>' (detached)
#   - Se COORD_SESSION_ID passado, listener notifica coordenador via
#     `claude --resume <id> -p "TASK_DELIVERED ..."` após cada task
#
# Listener:
#   - Polling de 2s em inbox/
#   - Arquivo .md novo → claude -p "<conteúdo>" no worktree
#   - Resultado → outbox/<nome>-result.log
#   - Prompt → processed/<nome>.md
#   - (opcional) Notifica coordenador via --resume se COORD_SESSION_ID setado

set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Uso: $0 <issue-number> <branch-name> [coord-session-id]" >&2
  exit 1
fi

ISSUE="$1"
BRANCH="$2"
COORD_SESSION_ID="${3:-}"
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
  # Grava COORD_SESSION_ID em arquivo (evita escape hell no heredoc)
  echo "$COORD_SESSION_ID" > "$WORKTREE/.cc-mailbox/.coord-id"
  cat > "$LISTENER_SCRIPT" <<'EOF'
#!/usr/bin/env bash
# Listener polling para CC mailbox do worktree atual.
# Se .cc-mailbox/.coord-id estiver setado, notifica coordenador via
# `claude --resume <id> -p "TASK_DELIVERED ..."` após cada task.
set -u

MAILBOX="$(dirname "$0")"
INBOX="$MAILBOX/inbox"
OUTBOX="$MAILBOX/outbox"
PROCESSED="$MAILBOX/processed"
WORKTREE="$(cd "$MAILBOX/.." && pwd)"
COORD_ID_FILE="$MAILBOX/.coord-id"
COORD_ID="$(cat "$COORD_ID_FILE" 2>/dev/null || true)"

cd "$WORKTREE"
echo "[listener] cwd=$WORKTREE — polling $INBOX a cada 2s"
if [ -n "$COORD_ID" ]; then
  echo "[listener] Coordenador: $COORD_ID (notificação via --resume ativa)"
else
  echo "[listener] Sem COORD_SESSION_ID — sem notificação automática ao coordenador"
fi

while true; do
  # Re-lê coord ID a cada iteração — permite que coord atualize o arquivo após boot do listener
  COORD_ID="$(cat "$COORD_ID_FILE" 2>/dev/null || true)"

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

    # Notifica coordenador via --resume (se configurado)
    if [ -n "$COORD_ID" ]; then
      COORD_DIR="$(cat "$MAILBOX/.coord-dir" 2>/dev/null || true)"
      ISSUE_NUM=$(basename "$WORKTREE" | sed 's/^issue-//')
      MSG="TASK_DELIVERED issue=${ISSUE_NUM} name=${NAME} worktree=${WORKTREE} result_log=${OUTBOX}/${NAME}-result.log report=${OUTBOX}/${NAME%-*}-report.md"
      echo "[listener] Notificando coordenador: $MSG"
      if [ -n "$COORD_DIR" ] && [ -d "$COORD_DIR" ]; then
        (cd "$COORD_DIR" && claude --resume "$COORD_ID" -p "$MSG" > "$OUTBOX/${NAME}-coord-response.log" 2>&1) &
        echo "[listener] Notificação disparada em background (PID $!) — coord dir: $COORD_DIR"
      else
        echo "[listener] ERRO: .coord-dir ausente ou inválido ('$COORD_DIR')"
      fi
    fi
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
