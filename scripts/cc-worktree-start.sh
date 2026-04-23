#!/usr/bin/env bash
# cc-worktree-start.sh — infraestrutura 3-tier do Protocolo Autônomo §13
#
# Refactor v2 (issue #169 Fase C) — cobre o spawn 3-tier (Interface + Coord +
# Worker) previsto em §13.8. Mantém compatibilidade com a v1 (2-tier coord+worker).
#
# USO
# ---
#   cd ~/projects/issue-NNN              # PRÉ-CONDIÇÃO DURA (§13.8 passo 8c)
#   ./<repo>/scripts/cc-worktree-start.sh <issue> <branch> \
#       [COORD_SESSION_ID] [INTERFACE_SESSION_ID]
#
# Exemplos:
#   ./scripts/cc-worktree-start.sh 156 arch/issue-156-xxx
#   ./scripts/cc-worktree-start.sh 170 feature/issue-170-xxx abc-123-coord
#   ./scripts/cc-worktree-start.sh 170 feature/issue-170-xxx abc-123-coord def-456-iface
#
# EFEITO
# ------
#   1. Pré-condição: aborta se cwd ≠ ~/projects/issue-<NNN> (INV-26 / §13.8 passo 8b)
#   2. Cria worktree se não existir (idempotente)
#   3. Cria TODOS os dirs de §13.7: inbox, outbox, processed, coord-inbox,
#      locks, notify-scratch, log
#   4. Grava .coord-id + .coord-dir + .interface-id (quando passado) e aplica
#      chmod 444 neles — READ-ONLY depois (INV-26 + amendments v0.25.0/v0.26.0)
#   5. Lança listener polling em tmux session 'cc-<NNN>' (detached)
#
# INV-26
# ------
# `.coord-id` e `.coord-dir` (e `.interface-id`) ficam READ-ONLY para todos os
# atores após gravados. Única exceção: Protocolo de Recovery §13.15 (nova
# Interface pode sobrescrever manualmente).

set -euo pipefail

# ─── Argumentos ─────────────────────────────────────────────────────────────
if [ $# -lt 2 ]; then
  cat >&2 <<USAGE
Uso: $0 <issue-number> <branch-name> [COORD_SESSION_ID] [INTERFACE_SESSION_ID]

Pré-condição: cwd DEVE ser ~/projects/issue-<issue-number> (§13.8 passo 8b)

Ex:
  cd ~/projects/issue-170
  <repo>/scripts/cc-worktree-start.sh 170 feature/issue-170-xxx
  <repo>/scripts/cc-worktree-start.sh 170 feature/issue-170-xxx abc-coord def-iface
USAGE
  exit 1
fi

ISSUE="$1"
BRANCH="$2"
COORD_SESSION_ID="${3:-}"
INTERFACE_SESSION_ID="${4:-}"
WORKTREE="$HOME/projects/issue-${ISSUE}"
SESSION="cc-${ISSUE}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
MAILBOX="$WORKTREE/.cc-mailbox"

# ─── PRÉ-CONDIÇÃO DURA (§13.8 passo 8b / bug cross-worktree v0.26.0) ────────
CURRENT_CWD="$(readlink -f "$(pwd)")"
EXPECTED_CWD="$(readlink -f "$WORKTREE" 2>/dev/null || echo "$WORKTREE")"

# Se worktree ainda não existe, a pré-condição é relaxada — Interface rodando
# de qualquer lugar pode criar. Quando existe, CWD obrigatoriamente = worktree.
if [ -d "$WORKTREE" ] && [ "$CURRENT_CWD" != "$EXPECTED_CWD" ]; then
  cat >&2 <<ERR
[start] ERRO: Pré-condição §13.8 violada.
         cwd atual:    $CURRENT_CWD
         cwd esperado: $EXPECTED_CWD

Invocar o script fora do worktree ativa o bug cross-worktree (rodada #164):
o session_id que a CC-Interface capturar fica em project-scope errado e o
listener falha silenciosamente ao fazer --resume.

Corrija com:
  cd $WORKTREE
  $0 $ISSUE $BRANCH ${COORD_SESSION_ID:-}${INTERFACE_SESSION_ID:+ $INTERFACE_SESSION_ID}
ERR
  exit 2
fi

# ─── 1. Worktree (idempotente) ──────────────────────────────────────────────
if [ ! -d "$WORKTREE" ]; then
  echo "[start] git worktree add $WORKTREE -b $BRANCH"
  (cd "$REPO" && git worktree add "$WORKTREE" -b "$BRANCH")
else
  echo "[start] Worktree já existe: $WORKTREE"
fi

# ─── 2. Mailbox dirs (todos de §13.7) ───────────────────────────────────────
for sub in inbox outbox processed coord-inbox locks notify-scratch log; do
  mkdir -p "$MAILBOX/$sub"
done
echo "[start] Mailbox pronto em $MAILBOX (§13.7 completo)"

# ─── 3. Session IDs READ-ONLY (INV-26 + amendments) ─────────────────────────
# Helper: grava arquivo e aplica chmod 444 (só Interface de Recovery pode sobrescrever)
write_ro() {
  local path="$1" value="$2"
  if [ -f "$path" ]; then
    # Se já existe e é RO, a gravação nova aborta — comportamento esperado
    # (INV-26: ninguém sobrescreve após bootstrap).
    if [ ! -w "$path" ]; then
      local existing
      existing="$(cat "$path")"
      if [ "$existing" != "$value" ]; then
        echo "[start] AVISO: $path já existe READ-ONLY com valor diferente." >&2
        echo "[start]   existente: $existing" >&2
        echo "[start]   passado:   $value" >&2
        echo "[start]   Mantendo existente (INV-26). Para recovery, use §13.15." >&2
      fi
      return 0
    fi
  fi
  printf '%s' "$value" > "$path"
  chmod 444 "$path"
}

# .coord-dir — absoluto, resolve symlinks
write_ro "$MAILBOX/.coord-dir" "$EXPECTED_CWD"

if [ -n "$COORD_SESSION_ID" ]; then
  write_ro "$MAILBOX/.coord-id" "$COORD_SESSION_ID"
  echo "[start] .coord-id gravado ($COORD_SESSION_ID) — READ-ONLY"
else
  # Arquivo vazio aceitável (listener 2-tier backwards-compat)
  if [ ! -f "$MAILBOX/.coord-id" ]; then
    : > "$MAILBOX/.coord-id"
    chmod 444 "$MAILBOX/.coord-id"
  fi
  echo "[start] .coord-id ausente — modo 2-tier (listener sem notificação ao coord)"
fi

if [ -n "$INTERFACE_SESSION_ID" ]; then
  write_ro "$MAILBOX/.interface-id" "$INTERFACE_SESSION_ID"
  echo "[start] .interface-id gravado ($INTERFACE_SESSION_ID) — READ-ONLY"
fi

echo "[start] .coord-dir = $EXPECTED_CWD (READ-ONLY)"

# ─── 4. Listener tmux (idempotente) ─────────────────────────────────────────
if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "[start] Tmux session '$SESSION' já ativa — reutilizando"
else
  LISTENER_SCRIPT="$MAILBOX/listener.sh"
  cat > "$LISTENER_SCRIPT" <<'EOF'
#!/usr/bin/env bash
# Listener polling para CC mailbox do worktree atual (§13.8 Fase 4).
# Respeita INV-25 (outbox antes de resume) + INV-26 (.coord-id/.coord-dir READ-ONLY).
set -u

MAILBOX="$(dirname "$0")"
INBOX="$MAILBOX/inbox"
OUTBOX="$MAILBOX/outbox"
PROCESSED="$MAILBOX/processed"
LOCKS="$MAILBOX/locks"
LOGDIR="$MAILBOX/log"
WORKTREE="$(cd "$MAILBOX/.." && pwd)"

COORD_ID="$(cat "$MAILBOX/.coord-id" 2>/dev/null || true)"
COORD_DIR="$(cat "$MAILBOX/.coord-dir" 2>/dev/null || true)"

cd "$WORKTREE"
echo "[listener] cwd=$WORKTREE — polling $INBOX a cada 2s"
if [ -n "$COORD_ID" ]; then
  echo "[listener] Coord session: $COORD_ID"
  echo "[listener] Coord cwd:     $COORD_DIR"
else
  echo "[listener] Sem COORD_SESSION_ID — modo 2-tier, sem notificação ao coord"
fi

while true; do
  # Re-lê a cada iteração — permite recovery §13.15 atualizar arquivos
  COORD_ID="$(cat "$MAILBOX/.coord-id" 2>/dev/null || true)"
  COORD_DIR="$(cat "$MAILBOX/.coord-dir" 2>/dev/null || true)"

  TASK=$(ls -1 "$INBOX"/*.md 2>/dev/null | head -n1 || true)
  if [ -n "$TASK" ] && [ -f "$TASK" ]; then
    NAME=$(basename "$TASK" .md)
    echo "[listener] Nova task: $NAME"
    PROMPT="$(cat "$TASK")"

    # Executa worker headless no cwd do worktree — stdout+stderr combinados
    claude -p "$PROMPT" > "$OUTBOX/${NAME}-result.log" 2>&1
    EXIT_CODE=$?

    # INV-25: persiste outbox ANTES de mover o inbox ou notificar o coord
    mv "$TASK" "$PROCESSED/"
    echo "[listener] Concluído ($EXIT_CODE): $NAME → outbox/${NAME}-result.log"
    printf '%s %s exit=%s\n' "$(date -Iseconds)" "$NAME" "$EXIT_CODE" >> "$LOGDIR/listener.log"

    # Notifica coord via --resume (§13.8 passo 26). flock evita colisão entre
    # várias tasks rápidas.
    if [ -n "$COORD_ID" ] && [ -n "$COORD_DIR" ] && [ -d "$COORD_DIR" ]; then
      ISSUE_NUM=$(basename "$WORKTREE" | sed 's/^issue-//')
      REPORT="$OUTBOX/${NAME}-report.md"
      MSG="TASK_DELIVERED issue=${ISSUE_NUM} name=${NAME} worktree=${WORKTREE} result_log=${OUTBOX}/${NAME}-result.log report=${REPORT}"
      echo "[listener] Notificando coord: $MSG"
      (
        cd "$COORD_DIR" && \
        flock -w 30 "$LOCKS/coord.lock" \
          claude --resume "$COORD_ID" --permission-mode auto -p "$MSG" \
          > "$OUTBOX/${NAME}-coord-response.log" 2>&1
      ) &
      echo "[listener] Notificação em background (PID $!)"
    else
      if [ -n "$COORD_ID" ]; then
        echo "[listener] ERRO: COORD_ID presente mas COORD_DIR inválido ('$COORD_DIR')"
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

cat <<SUMMARY
[start] Pronto.
  Worktree:   $WORKTREE
  Mailbox:    $MAILBOX
  Tmux:       $SESSION
  Coord:      ${COORD_SESSION_ID:-(ausente)}
  Interface:  ${INTERFACE_SESSION_ID:-(ausente)}

Despache a primeira task escrevendo em:
  $MAILBOX/inbox/01-<nome>.md

Template do briefing com CLAIMS obrigatório:
  ~/cc-mailbox/templates/worker-briefing.md
SUMMARY
