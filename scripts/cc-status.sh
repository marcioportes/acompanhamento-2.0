#!/usr/bin/env bash
# cc-status.sh — visão humana dos processos em looping autônomo §13
# Varre ~/projects/issue-* e imprime status agregado por issue.
# Uso: cc-status.sh [issue-num]   — sem arg = todas as issues; com arg = detalhe de uma
set -euo pipefail

NOW=$(date +%s)
FILTER_ISSUE="${1:-}"

# ── helpers ─────────────────────────────────────────────────────────────────
human_age() {
  local secs=$1
  if (( secs < 60 )); then echo "${secs}s"
  elif (( secs < 3600 )); then echo "$((secs/60))min"
  elif (( secs < 86400 )); then echo "$((secs/3600))h$((secs%3600/60))min"
  else echo "$((secs/86400))d$((secs%86400/3600))h"
  fi
}

pad() { printf "%-${1}s" "$2"; }

color() {
  local c=$1 ; shift
  case "$c" in
    green)  printf '\033[32m%s\033[0m' "$*" ;;
    yellow) printf '\033[33m%s\033[0m' "$*" ;;
    red)    printf '\033[31m%s\033[0m' "$*" ;;
    dim)    printf '\033[2m%s\033[0m'  "$*" ;;
    bold)   printf '\033[1m%s\033[0m'  "$*" ;;
    *)      printf '%s' "$*" ;;
  esac
}

# ── scan worktrees ──────────────────────────────────────────────────────────
shopt -s nullglob
WORKTREES=(~/projects/issue-*)
[[ ${#WORKTREES[@]} -eq 0 ]] && { echo "(nenhuma sessão autônoma ativa em ~/projects/)"; exit 0; }

print_header() {
  printf "\n%s\n" "$(color bold "═══ Sessões autônomas §13 — $(date '+%H:%M:%S %d/%m') ═══")"
  printf "%s\n\n" "$(color dim "$(pad 11 Issue) $(pad 8 Status) $(pad 8 Tasks) $(pad 10 Última) $(pad 12 Duração) Health")"
}

print_row() {
  local issue=$1 status=$2 tasks=$3 last=$4 dur=$5 health=$6 health_color=$7
  printf "%s  %s %s %s %s  %s\n" \
    "$(pad 9 "$issue")" \
    "$(pad 8 "$status")" \
    "$(pad 7 "$tasks")" \
    "$(pad 10 "$last")" \
    "$(pad 11 "$dur")" \
    "$(color "$health_color" "$health")"
}

summarize_issue() {
  local wt=$1
  local issue=$(basename "$wt" | sed 's/issue-//')
  local mb="$wt/.cc-mailbox"
  [[ -d "$mb" ]] || return

  [[ -n "$FILTER_ISSUE" && "$issue" != "$FILTER_ISSUE" ]] && return

  # pega estado do filesystem
  local tasks_done=0 task_inprogress="" last_event_age_sec=9999999 last_event_ts=0
  local has_finished=no has_stall=no health_color=green health="rolando"
  local coord_id="?" tmux_state="?" branch="?"

  [[ -f "$mb/.coord-id" ]] && coord_id=$(cat "$mb/.coord-id" 2>/dev/null | head -c 8)

  if command -v tmux >/dev/null && tmux has-session -t "cc-$issue" 2>/dev/null; then
    tmux_state="alive"
  else
    tmux_state="morto"
  fi

  if [[ -d "$wt/.git" || -f "$wt/.git" ]]; then
    branch=$(git -C "$wt" symbolic-ref --short HEAD 2>/dev/null || echo "detached")
  fi

  # conta tasks concluídas (report.md)
  tasks_done=$(ls "$mb/outbox/"*-report.md 2>/dev/null | wc -l)

  # task em andamento = último inbox sem report correspondente
  for inbox in "$mb/inbox/"*.md; do
    [[ -e "$inbox" ]] || continue
    local n=$(basename "$inbox" | grep -oE '^[0-9]+' || true)
    [[ -z "$n" ]] && continue
    if [[ ! -f "$mb/outbox/${n}-report.md" ]]; then
      task_inprogress=$(basename "$inbox" .md | sed 's/^[0-9]*-//')
    fi
  done

  # último evento (mtime mais recente em inbox/outbox/coord-inbox)
  local last_file
  last_file=$(find "$mb/inbox" "$mb/outbox" "$mb/coord-inbox" -maxdepth 1 -type f -not -name '.*' -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1)
  if [[ -n "$last_file" ]]; then
    last_event_ts=$(echo "$last_file" | awk '{print $1}' | cut -d. -f1)
    last_event_age_sec=$((NOW - last_event_ts))
  fi

  # duração total da sessão (primeiro evento → agora)
  local first_ts
  first_ts=$(find "$mb/inbox" "$mb/outbox" -maxdepth 1 -type f -printf '%T@\n' 2>/dev/null | sort -n | head -1 | cut -d. -f1)
  local total_dur="?"
  [[ -n "$first_ts" ]] && total_dur=$(human_age $((NOW - first_ts)))

  # emails enviados desta issue
  local last_email=""
  if [[ -f "$HOME/cc-mailbox/log/emails.log" ]]; then
    last_email=$(grep "issue=$issue" "$HOME/cc-mailbox/log/emails.log" 2>/dev/null | tail -1 || true)
  fi
  [[ "$last_email" =~ type=FINISHED ]] && has_finished=yes

  # detecta stall: último evento > 20min E não há FINISHED
  if [[ "$has_finished" == "no" ]] && (( last_event_age_sec > 1200 )); then
    has_stall=yes
  fi

  # detecta API error no último coord-response
  local last_response
  last_response=$(ls -t "$mb/outbox/"*-coord-response.log 2>/dev/null | head -1 || true)
  local has_api_error=no
  if [[ -n "$last_response" ]]; then
    if grep -qiE 'API Error|socket|overloaded|limit|ECONNRESET' "$last_response" 2>/dev/null; then
      has_api_error=yes
    fi
  fi

  # health
  if [[ "$has_finished" == "yes" ]]; then
    health="entregue"; health_color=green
    task_inprogress="—"
  elif [[ "$has_api_error" == "yes" && "$has_stall" == "yes" ]]; then
    health="STALL (API error)"; health_color=red
  elif [[ "$has_stall" == "yes" ]]; then
    health="STALL ($(human_age $last_event_age_sec))"; health_color=red
  elif [[ "$tmux_state" == "morto" ]]; then
    health="tmux morto"; health_color=red
  elif (( last_event_age_sec > 600 )); then
    health="lento ($(human_age $last_event_age_sec))"; health_color=yellow
  else
    health="rolando"; health_color=green
  fi

  [[ -z "$task_inprogress" ]] && task_inprogress="—"

  local last_label
  if [[ "$last_event_age_sec" -eq 9999999 ]]; then
    last_label="nunca"
  else
    last_label=$(human_age "$last_event_age_sec")
  fi

  # modo resumo (sem arg)
  if [[ -z "$FILTER_ISSUE" ]]; then
    print_row "#$issue" "$tmux_state" "$tasks_done" "$last_label" "$total_dur" "$health" "$health_color"
    return
  fi

  # modo detalhe
  printf "\n%s\n" "$(color bold "═══ #$issue — detalhe ═══")"
  printf "  Worktree:      %s\n" "$wt"
  printf "  Branch:        %s\n" "$branch"
  printf "  Coord ID:      %s...\n" "$coord_id"
  printf "  Tmux:          %s (cc-%s)\n" "$tmux_state" "$issue"
  printf "  Tasks:         %s entregues\n" "$tasks_done"
  printf "  Em execução:   %s\n" "$task_inprogress"
  printf "  Último evento: %s atrás\n" "$last_label"
  printf "  Duração total: %s\n" "$total_dur"
  printf "  Status:        %s\n" "$(color "$health_color" "$health")"

  # últimas 5 entregas
  printf "\n%s\n" "$(color bold "Histórico (última 5 tasks):")"
  ls -t "$mb/outbox/"*-report.md 2>/dev/null | head -5 | while read -r rpt; do
    local n=$(basename "$rpt" | grep -oE '^[0-9]+' || echo "?")
    local rpt_ts=$(stat -c %Y "$rpt")
    local rpt_age=$(human_age $((NOW - rpt_ts)))
    local slug=$(ls "$mb/outbox/${n}-"*-result.log 2>/dev/null | head -1 | xargs basename 2>/dev/null | sed 's/-result\.log$//;s/^[0-9]*-//' || echo "?")
    printf "  %s  task %s  %-40s %s atrás\n" "$(color green "✓")" "$n" "$slug" "$rpt_age"
  done

  # email recente
  if [[ -n "$last_email" ]]; then
    printf "\n%s\n" "$(color bold "Último email:")"
    printf "  %s\n" "$last_email"
  fi

  # api error detalhado
  if [[ "$has_api_error" == "yes" ]]; then
    printf "\n%s\n" "$(color red "⚠ Erro no último coord-response:")"
    printf "  Arquivo: %s\n" "$last_response"
    printf "  Conteúdo: %s\n" "$(cat "$last_response" | tr -d '\n' | head -c 120)"
  fi

  printf "\n"
}

# ── main ────────────────────────────────────────────────────────────────────
if [[ -z "$FILTER_ISSUE" ]]; then
  print_header
fi

for wt in "${WORKTREES[@]}"; do
  summarize_issue "$wt"
done

if [[ -z "$FILTER_ISSUE" ]]; then
  printf "\n%s\n" "$(color dim "Detalhe de uma issue: cc-status.sh <num>")"
fi
