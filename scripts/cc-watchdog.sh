#!/usr/bin/env bash
# cc-watchdog.sh — per-worktree watchdog para Protocolo Autônomo §13
# Detecta 3 classes de stall e toma ação automática limitada (retry 1×)
# ou escala humano via email (cc-notify-email.py).
#
# Uso:
#   cc-watchdog.sh <issue-num> <branch>
# Lançado por cc-worktree-start.sh via nohup. PID em .cc-mailbox/.watchdog-pid.
#
# Opt-out:
#   CC_WATCHDOG_DISABLE=1       — não roda (start.sh respeita isso)
#   CC_WATCHDOG_ONESHOT=1       — roda 1 iteração e sai (para testes)
#   CC_WATCHDOG_INTERVAL=N      — override do intervalo (default 90s)
#   CC_WATCHDOG_T_RESUME=N      — override T_RESUME_MAX em minutos (default 5)
#   CC_WATCHDOG_T_WORKER=N      — override T_WORKER_MAX em minutos (default 60)
#   EMAIL_DRY_RUN=1             — cc-notify-email.py imprime mas não envia

set -uo pipefail

# ── args ─────────────────────────────────────────────────────────────────
if [[ $# -lt 2 ]]; then
  echo "Uso: $0 <issue-num> <branch>" >&2
  exit 2
fi
ISSUE="$1"
BRANCH="$2"

WORKTREE="$HOME/projects/issue-$ISSUE"
MAILBOX="$WORKTREE/.cc-mailbox"
LOG="$MAILBOX/log/watchdog.log"
PIDFILE="$MAILBOX/.watchdog-pid"
REPO="$HOME/projects/acompanhamento-2.0"
START_SCRIPT="$REPO/scripts/cc-worktree-start.sh"
NOTIFY="$HOME/cc-mailbox/bin/cc-notify-email.py"

INTERVAL="${CC_WATCHDOG_INTERVAL:-90}"
T_RESUME_SEC=$(( ${CC_WATCHDOG_T_RESUME:-5} * 60 ))
T_WORKER_SEC=$(( ${CC_WATCHDOG_T_WORKER:-60} * 60 ))

# ── precondições ─────────────────────────────────────────────────────────
if [[ ! -d "$MAILBOX" ]]; then
  echo "[watchdog] ERRO: mailbox não existe em $MAILBOX" >&2
  exit 2
fi
if [[ ! -x "$NOTIFY" ]]; then
  echo "[watchdog] WARN: cc-notify-email.py não executável em $NOTIFY — emails serão descartados" >&2
fi

mkdir -p "$(dirname "$LOG")"
echo $$ > "$PIDFILE"

# ── cleanup trap ─────────────────────────────────────────────────────────
cleanup() {
  log_event INFO stop "watchdog encerrando (pid=$$)"
  rm -f "$PIDFILE"
}
trap cleanup TERM INT EXIT

# ── logging 1-line estruturado ───────────────────────────────────────────
log_event() {
  local level="$1" tag="$2" msg="$3"
  printf '%s %-5s tag=%s %s\n' "$(date -Iseconds)" "$level" "$tag" "$msg" >> "$LOG"
}

# ── helpers ──────────────────────────────────────────────────────────────
# TTL do rate limit do notifier para emails do watchdog (override por tipo).
# 1h — curto o suficiente pra não perder eventos distintos do mesmo stall,
# longo o suficiente pra barrar looping caso um detector dispare em rajada.
WATCHDOG_EMAIL_TTL_SECONDS=3600

# Dispara email via cc-notify-email.py com payload JSON.
# O tipo deve ser um dos WATCHDOG_* definidos no VALID_TYPES do notifier.
# Cada tipo tem seu próprio slot de rate limit (independente entre classes).
send_email() {
  local type="$1" title="$2" resumo="$3" detalhe="${4:-}" ttl="${5:-$WATCHDOG_EMAIL_TTL_SECONDS}"
  if [[ ! -x "$NOTIFY" ]]; then
    log_event ERROR email "notify não disponível — skipping type=$type"
    return 1
  fi
  local json
  json=$(python3 -c '
import json,sys
print(json.dumps({
    "issue": sys.argv[1],
    "type": sys.argv[2],
    "title": sys.argv[3],
    "resumo": sys.argv[4],
    "detalhe": sys.argv[5],
    "ttl_seconds": int(sys.argv[6]),
}))' "$ISSUE" "$type" "$title" "$resumo" "$detalhe" "$ttl")
  echo "$json" | "$NOTIFY" > "$MAILBOX/log/watchdog-email-$(date +%s).log" 2>&1 || true
  log_event INFO email "sent type=$type title=$title"
}

# Extrai N (número da task) do nome do arquivo "NN-slug.log"
extract_task_num() {
  basename "$1" | grep -oE '^[0-9]+' || echo ""
}

# Retorna 0 se o padrão de erro está no arquivo
has_api_error() {
  local file="$1"
  [[ -f "$file" ]] || return 1
  grep -qiE 'API Error|socket|ECONNRESET|Overloaded|hit your limit|rate_limit|closed unexpectedly' "$file"
}

# Retorna 0 se o erro é especificamente de quota esgotada (sub-caso de has_api_error)
has_quota_error() {
  local file="$1"
  [[ -f "$file" ]] || return 1
  grep -qiE 'hit your limit|rate_limit|quota' "$file"
}

# Parseia horário de reset da quota do log; imprime epoch em stdout (vazio se falhar).
# Formatos aceitos (GNU date): "resets 4:20pm", "resets 16:20", "resets 4:20 pm"
parse_quota_reset_epoch() {
  local file="$1"
  [[ -f "$file" ]] || return 1
  local raw hhmm epoch now
  raw=$(grep -oiE 'resets[[:space:]]+[0-9]{1,2}:[0-9]{2}[[:space:]]*[ap]?\.?m?\.?' "$file" | head -1)
  [[ -z "$raw" ]] && return 1
  hhmm=$(printf '%s' "$raw" | sed -E 's/^resets[[:space:]]+//i; s/\.//g')
  epoch=$(date -d "$hhmm today" +%s 2>/dev/null) || return 1
  [[ -z "$epoch" ]] && return 1
  now=$(date +%s)
  if (( epoch < now )); then
    epoch=$(date -d "$hhmm tomorrow" +%s 2>/dev/null) || return 1
  fi
  printf '%s' "$epoch"
}

# Última task que tem coord-response.log (maior N cujo *-coord-response.log existe)
latest_responded_task() {
  ls "$MAILBOX/outbox/"*-coord-response.log 2>/dev/null \
    | while read -r f; do extract_task_num "$f"; done \
    | sort -n | tail -1
}

# Dispara um claude --resume para a task N (usado pelo retry imediato transitório
# e pelo retry agendado pós-reset de quota). Grava stdout+stderr em retry_log.
# Args: n coord_id retry_log note
do_resume_retry() {
  local n="$1" coord_id="$2" retry_log="$3" note="$4"
  (
    cd "$WORKTREE" || exit 2
    flock -w 30 "$MAILBOX/locks/coord.lock" \
      timeout 300 claude --resume "$coord_id" --permission-mode auto \
        -p "TASK_DELIVERED N=$n ($note)" \
      > "$retry_log" 2>&1
  )
}

# ── detector CLASSE 1 — resume da Coord falhou ───────────────────────────
# Sintoma: último coord-response.log tem API error + existe N-report.md
# + não existe inbox/(N+1)-*.md + flag <N>-retry.done ausente
# Sub-casos:
#  - TRANSITÓRIO (socket/Overloaded/ECONNRESET/closed unexpectedly): retry imediato
#  - QUOTA (hit your limit/rate_limit/quota): agenda retry para o horário de reset,
#    preserva budget (não grava retry.done), emite 2 emails — detecção + resultado
check_class1() {
  local n
  n=$(latest_responded_task)
  [[ -z "$n" ]] && return 0

  local response_file="$MAILBOX/outbox/${n}-"*"-coord-response.log"
  # glob pode expandir pra múltiplos; pega o mais recente
  response_file=$(ls -t $response_file 2>/dev/null | head -1)
  [[ -f "$response_file" ]] || return 0

  # já consumiu retry ou já tem retry agendado? nada a fazer aqui
  [[ -f "$MAILBOX/outbox/${n}-retry.done" ]] && return 0
  [[ -f "$MAILBOX/outbox/${n}-quota-retry-at" ]] && return 0

  # o coord-response precisa ter erro conhecido
  has_api_error "$response_file" || return 0

  # precisa existir report da task (worker entregou)
  if ! ls "$MAILBOX/outbox/${n}-report.md" >/dev/null 2>&1 && \
     ! ls "$MAILBOX/outbox/${n}"*"-report.md" >/dev/null 2>&1; then
    # Worker não entregou — não é Classe 1, pode ser Classe 2
    return 0
  fi

  # não pode existir inbox próximo já despachado
  local next=$((10#$n + 1))
  local next_padded
  next_padded=$(printf '%02d' "$next")
  if ls "$MAILBOX/inbox/${next_padded}-"*.md >/dev/null 2>&1; then
    return 0  # Coord já despachou próxima, não é stall
  fi

  # idade do coord-response
  local age
  age=$(( $(date +%s) - $(stat -c %Y "$response_file") ))
  if (( age < T_RESUME_SEC )); then
    # Muito recente, dá tempo pro listener tentar naturalmente
    return 0
  fi

  # === STALL CLASSE 1 CONFIRMADO ===
  # coord-id é pré-requisito para qualquer ação (retry imediato ou agendado)
  local coord_id
  coord_id=$(cat "$MAILBOX/.coord-id" 2>/dev/null || echo "")
  if [[ -z "$coord_id" ]]; then
    log_event ERROR class_1 ".coord-id vazio — escalando humano"
    touch "$MAILBOX/outbox/${n}-retry.done"  # evita re-entrar no próximo iter
    send_email WATCHDOG_CLASS_1_TRANSIENT \
      "#$ISSUE stall Classe 1 (sem coord-id)" \
      "Coord falhou no --resume da task $n mas .coord-id está vazio; watchdog não pode retryar." \
      "response_file=$response_file"
    return 1
  fi

  # ── sub-caso QUOTA ──────────────────────────────────────────────────────
  if has_quota_error "$response_file"; then
    local reset_epoch
    reset_epoch=$(parse_quota_reset_epoch "$response_file") || reset_epoch=""
    if [[ -n "$reset_epoch" ]]; then
      local reset_iso
      reset_iso=$(date -d "@$reset_epoch" '+%Y-%m-%d %H:%M %Z')
      echo "$reset_epoch" > "$MAILBOX/outbox/${n}-quota-retry-at"
      log_event WARN class_1_quota "stall quota task=$n reset=$reset_iso epoch=$reset_epoch"
      send_email WATCHDOG_CLASS_1B_QUOTA_SCHEDULED \
        "#$ISSUE [QUOTA] task $n caiu — retry agendado $reset_iso" \
        "Coord falhou no --resume da task $n por quota esgotada. Watchdog parseou o horário de reset ($reset_iso) e agendou retry automático. Um segundo email sairá quando o retry ocorrer (sucesso ou falha)." \
        "response_file=$response_file reset_epoch=$reset_epoch"
    else
      log_event ERROR class_1_quota "stall quota task=$n — horário não parseável"
      touch "$MAILBOX/outbox/${n}-retry.done"  # queima budget, requer intervenção manual
      send_email WATCHDOG_CLASS_1B_QUOTA_UNPARSEABLE \
        "#$ISSUE [QUOTA] task $n caiu — horário ilegível" \
        "Coord falhou no --resume da task $n por quota, mas o watchdog não conseguiu parsear o horário de reset no log. Intervenção manual necessária." \
        "response_file=$response_file"
    fi
    return 0
  fi

  # ── sub-caso TRANSITÓRIO ────────────────────────────────────────────────
  log_event WARN class_1 "stall transiente task=$n age=${age}s file=$(basename "$response_file")"
  touch "$MAILBOX/outbox/${n}-retry.done"

  local retry_log="$MAILBOX/outbox/${n}-retry-$(date +%s).log"
  log_event INFO class_1 "retry task=$n via flock+resume"
  do_resume_retry "$n" "$coord_id" "$retry_log" "watchdog retry — erro transitório anterior"
  local rc=$?

  if [[ $rc -eq 0 ]] && ! has_api_error "$retry_log"; then
    log_event INFO class_1 "retry task=$n SUCCESS"
  else
    log_event ERROR class_1 "retry task=$n FAILED rc=$rc"
    send_email WATCHDOG_CLASS_1_TRANSIENT \
      "#$ISSUE stall Classe 1 — retry falhou task $n" \
      "Watchdog detectou API error transitório no coord-response da task $n e tentou retry automático, mas o retry também falhou (rc=$rc)." \
      "response_file=$response_file retry_log=$retry_log coord_id=$coord_id"
  fi
}

# ── detector CLASSE 1b — retry agendado por quota ────────────────────────
# Varre outbox/*-quota-retry-at. Se a hora chegou: dispara retry, consome budget
# (retry.done), remove o marcador, e emite email de resultado (INFO ou FAIL).
check_class1_pending_retry() {
  shopt -s nullglob
  local f
  for f in "$MAILBOX/outbox/"*-quota-retry-at; do
    local n
    n=$(basename "$f" | sed 's/-quota-retry-at$//')
    [[ -z "$n" ]] && continue

    # budget já consumido por outro caminho? limpa marcador e segue
    if [[ -f "$MAILBOX/outbox/${n}-retry.done" ]]; then
      rm -f "$f"
      continue
    fi

    local epoch now
    epoch=$(head -1 "$f" 2>/dev/null)
    [[ -z "$epoch" ]] && continue
    now=$(date +%s)
    (( now < epoch )) && continue  # ainda não é hora

    # === hora de retryar ===
    local coord_id
    coord_id=$(cat "$MAILBOX/.coord-id" 2>/dev/null || echo "")
    if [[ -z "$coord_id" ]]; then
      log_event ERROR class_1_quota ".coord-id vazio no retry agendado task=$n"
      send_email WATCHDOG_CLASS_1B_QUOTA_RESULT \
        "#$ISSUE [QUOTA] task $n retry abortado — sem coord-id" \
        "Chegou o horário do retry agendado da task $n, mas .coord-id está vazio. Marcador preservado para intervenção manual." \
        "marker=$f"
      continue  # preserva marcador, humano decide
    fi

    local retry_log="$MAILBOX/outbox/${n}-retry-$(date +%s).log"
    log_event INFO class_1_quota "retry agendado disparando task=$n"
    touch "$MAILBOX/outbox/${n}-retry.done"
    do_resume_retry "$n" "$coord_id" "$retry_log" "watchdog retry — quota resetou"
    local rc=$?
    rm -f "$f"

    if [[ $rc -eq 0 ]] && ! has_api_error "$retry_log"; then
      log_event INFO class_1_quota "retry agendado task=$n SUCCESS"
      send_email WATCHDOG_CLASS_1B_QUOTA_RESULT \
        "#$ISSUE [QUOTA] [INFO] task $n retry OK" \
        "Watchdog disparou o retry agendado da task $n após reset de quota e a Coord foi acordada com sucesso. Loop retomado." \
        "retry_log=$retry_log"
    else
      log_event ERROR class_1_quota "retry agendado task=$n FAILED rc=$rc"
      send_email WATCHDOG_CLASS_1B_QUOTA_RESULT \
        "#$ISSUE [QUOTA] task $n retry FALHOU rc=$rc" \
        "Watchdog disparou o retry agendado da task $n após reset de quota, mas o retry também falhou (rc=$rc). Intervenção manual." \
        "retry_log=$retry_log coord_id=$coord_id"
    fi
  done
  shopt -u nullglob
}

# ── detector CLASSE 2 — worker travado ───────────────────────────────────
# Sintoma: inbox/N-*.md há > T_WORKER_MAX min, outbox/N-result.log ausente ou size 0
check_class2() {
  shopt -s nullglob
  local found=0
  for inbox in "$MAILBOX/inbox/"*.md; do
    local n
    n=$(extract_task_num "$inbox")
    [[ -z "$n" ]] && continue

    # já alertamos?
    [[ -f "$MAILBOX/outbox/${n}-stall.notified" ]] && continue

    # idade da task no inbox
    local age
    age=$(( $(date +%s) - $(stat -c %Y "$inbox") ))
    (( age < T_WORKER_SEC )) && continue

    # result.log existe e tem tamanho?
    # IMPORTANTE: com nullglob ativo, um glob sem match vira string vazia e
    # `ls` sem args listaria o diretório corrente — por isso usamos array.
    local -a result_matches=( "$MAILBOX/outbox/${n}"*-result.log )
    local result="${result_matches[0]:-}"
    if [[ -n "$result" && -f "$result" && -s "$result" ]]; then
      continue  # worker entregou
    fi

    # === STALL CLASSE 2 CONFIRMADO ===
    log_event WARN class_2 "worker stall task=$n age=${age}s"
    touch "$MAILBOX/outbox/${n}-stall.notified"
    send_email WATCHDOG_CLASS_2_WORKER_STALL \
      "#$ISSUE worker task $n travado >$(( age / 60 ))min" \
      "Task $n despachada há $(( age / 60 ))min, sem result.log ou result.log vazio. Worker possivelmente em loop, OOM ou rate-limit silencioso." \
      "inbox=$inbox result=$result"
    found=1
  done
  shopt -u nullglob
  return $found
}

# ── detector CLASSE 3 — tmux morto ───────────────────────────────────────
check_class3() {
  local session="cc-$ISSUE"

  if ! tmux has-session -t "$session" 2>/dev/null; then
    log_event WARN class_3 "tmux session $session morta — tentando relaunch"

    # precondição: start.sh existe e é idempotente
    if [[ ! -x "$START_SCRIPT" ]]; then
      log_event ERROR class_3 "start.sh não encontrado em $START_SCRIPT"
      send_email WATCHDOG_CLASS_3_RELAUNCH \
        "#$ISSUE tmux morto + start.sh ausente" \
        "Tmux $session morreu e watchdog não encontra cc-worktree-start.sh para relaunch." \
        "expected=$START_SCRIPT"
      return 1
    fi

    # coord-id pode estar atual; start.sh com mesmo ID é idempotente
    local coord_id
    coord_id=$(cat "$MAILBOX/.coord-id" 2>/dev/null || echo "")
    if [[ -z "$coord_id" ]]; then
      log_event ERROR class_3 "sem coord-id, não pode relaunch"
      send_email WATCHDOG_CLASS_3_RELAUNCH \
        "#$ISSUE tmux morto + sem coord-id" \
        "Tmux $session morreu e .coord-id está vazio; watchdog não pode relaunch start.sh." ""
      return 1
    fi

    (
      cd "$WORKTREE" || exit 2
      "$START_SCRIPT" "$ISSUE" "$WORKTREE" "$coord_id" \
        >> "$MAILBOX/log/watchdog-relaunch.log" 2>&1
    )
    local rc=$?
    if [[ $rc -eq 0 ]] && tmux has-session -t "$session" 2>/dev/null; then
      log_event INFO class_3 "tmux $session relançado OK"
      send_email WATCHDOG_CLASS_3_RELAUNCH \
        "#$ISSUE [INFO] tmux relançado automaticamente" \
        "Watchdog detectou que tmux $session morreu e relançou via cc-worktree-start.sh com sucesso. Loop retomado." \
        "coord_id=$coord_id"
    else
      log_event ERROR class_3 "relaunch falhou rc=$rc"
      send_email WATCHDOG_CLASS_3_RELAUNCH \
        "#$ISSUE tmux morto — relaunch falhou" \
        "Tmux $session morreu e o relaunch via start.sh falhou (rc=$rc). Intervenção manual necessária." \
        "log=$MAILBOX/log/watchdog-relaunch.log"
    fi
    return 0
  fi

  # tmux vivo; checa se listener está de fato rodando.
  # Rate limit: delegado ao notifier via WATCHDOG_EMAIL_TTL_SECONDS (1h).
  # A flag local .listener-missing.notified foi removida — o notifier já cobre.
  if ! pgrep -fa "$MAILBOX/listener.sh" >/dev/null 2>&1; then
    log_event WARN class_3 "tmux vivo mas listener.sh não encontrado em pgrep"
    send_email WATCHDOG_CLASS_3_LISTENER_MISSING \
      "#$ISSUE listener.sh ausente mas tmux vivo" \
      "Tmux cc-$ISSUE está vivo mas pgrep não encontra listener.sh. Possível travamento silencioso." ""
  fi
}

# ── main loop ────────────────────────────────────────────────────────────
log_event INFO start "watchdog iniciando (pid=$$ issue=$ISSUE branch=$BRANCH interval=${INTERVAL}s t_resume=${T_RESUME_SEC}s t_worker=${T_WORKER_SEC}s)"

# Sinal humano de início do monitoramento (INV-28 / §13.10). TTL 24h — um email
# por dia por branch, evita spam se watchdog for relançado (crash, restart, etc).
send_email \
  "WATCHDOG_SESSION_START" \
  "watchdog on — monitoramento iniciado para issue #$ISSUE" \
  "Watchdog §13 iniciado no worktree $WORKTREE (branch $BRANCH, pid=$$). Monitoramento das 3 classes de stall ativo (intervalo ${INTERVAL}s, T_RESUME ${T_RESUME_SEC}s, T_WORKER ${T_WORKER_SEC}s). Próximo email automático apenas em gate humano ou stall detectado." \
  "Log contínuo em $LOG. PID em $PIDFILE. Para parar manualmente: kill -TERM \$(cat $PIDFILE)." \
  "86400" || log_event WARN start "email WATCHDOG_SESSION_START falhou (notify retornou erro; segue monitoramento)"

iter=0
while true; do
  # auto-self-kill se worktree/mailbox sumir (ex: git worktree remove)
  if [[ ! -d "$MAILBOX" ]]; then
    log_event INFO stop "mailbox sumiu — auto-exit"
    exit 0
  fi

  # heartbeat a cada 10 iterações (~15min)
  if (( iter % 10 == 0 )); then
    pending_quota=$(ls "$MAILBOX/outbox/"*-quota-retry-at 2>/dev/null | wc -l)
    log_event INFO heartbeat "iter=$iter tmux=$(tmux has-session -t cc-$ISSUE 2>/dev/null && echo alive || echo dead) pending_quota=$pending_quota"
  fi

  # ordem importa: class 3 primeiro (infra), depois retry agendado de quota
  # (pode disparar antes do detector de novo stall), depois class 1, class 2.
  check_class3 || true
  check_class1_pending_retry || true
  check_class1 || true
  check_class2 || true

  # oneshot para testes
  if [[ "${CC_WATCHDOG_ONESHOT:-0}" == "1" ]]; then
    log_event INFO stop "oneshot — exit"
    exit 0
  fi

  iter=$((iter + 1))
  sleep "$INTERVAL"
done
