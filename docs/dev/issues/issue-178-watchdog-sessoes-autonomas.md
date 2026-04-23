# Issue #178 — feat: cc-watchdog.sh — detecta stall em sessões autônomas §13

**Milestone:** — (meta-infra)
**Branch:** `arch/issue-178-watchdog-sessoes-autonomas`
**Worktree:** `~/projects/issue-178`
**Chunks:** nenhum (meta-infra, precedente #169/#176)
**Modo:** interativo (implementação direta pela CC-Interface)
**Baseado em:** PROJECT.md v0.37.0

---

## §1 CONTEXTO

Durante a primeira rodada real do modo autônomo §13 (issue #119, 23/04/2026), o loop travou **duas vezes em silêncio** por erros transitórios:

1. **07:29 — Task 05 (orchestrator Fase A):** worker entregou commit `2e9b01cc`. Listener invocou `claude --resume <coord-id> -p "TASK_DELIVERED N=05"`. Bateu `API Error: The socket connection was closed unexpectedly`. Coord nunca acordou. Loop parado ~46min até humano notar.
2. **12:32 — Task 14 (wire narrativa IA):** worker bateu `529 Overloaded`, exit=1. Coord tentou acordar, bateu `You've hit your limit · resets 4:20pm`. Loop parado ~4h até quota resetar.

Em ambos os casos, o humano só descobriu por acaso (conversando com CC-Interface). Sem watchdog, o modo autônomo **não cumpre a promessa de "Marcio dorme, loop progride"**.

## §2 ACCEPTANCE CRITERIA

### Watchdog
- [ ] `~/cc-mailbox/bin/cc-watchdog.sh` (bash, ~250 linhas)
- [ ] Detecta 3 classes de stall (ver §3.1)
- [ ] Retry 1× por (issue, task) via flag persistente `.retry.done`
- [ ] Email via `cc-notify-email.py` (já existente)
- [ ] Self-exit limpo se `.cc-mailbox/` sumir

### Integração
- [ ] `cc-worktree-start.sh` lança watchdog via `nohup` após listener, grava PID
- [ ] `cc-worktree-stop.sh` ganha bloco para matar watchdog via PID antes de encerrar tmux
- [ ] Opt-out via env `CC_WATCHDOG_DISABLE=1`

### Validação
- [ ] Smoke manual em worktree sintético `issue-996`: forçar erro em coord-response.log → watchdog detecta e dispara retry em ≤3 ciclos
- [ ] Smoke: forçar worker stall → watchdog emite email Classe 2
- [ ] Smoke: kill tmux `cc-996` → watchdog relança

### Entrega
- [ ] PROJECT.md §11 entrada de encerramento + §13.11 adicionando `cc-watchdog.sh` como IMPLEMENTADO
- [ ] PR único com `Closes #178`

## §3 ANÁLISE DE IMPACTO

### §3.1 Decisões antecipadas

**Classes de stall:**

| # | Sintoma | Ação |
|---|---|---|
| 1 | Último `*-coord-response.log` tem `API Error\|socket\|ECONNRESET\|Overloaded\|hit your limit` + existe `N-report.md` + não existe `inbox/(N+1)-*.md` | Retry 1× via `flock + claude --resume -p "TASK_DELIVERED N=<N> (watchdog retry)"`. Flag `outbox/<N>-retry.done`. Fail → email HUMAN_GATE |
| 2 | `inbox/N-*.md` há > T_WORKER_MAX min + `outbox/N-result.log` ausente ou size 0 | Email HUMAN_GATE com título "Worker task N travado >Xmin". Não mata. Flag `outbox/<N>-stall.notified` |
| 3 | `tmux has-session -t cc-NNN` falso OU `pgrep -f "$MAILBOX/listener.sh"` vazio | `cc-worktree-start.sh <NNN> <branch>` idempotente relança; email HUMAN_GATE INFO |

**Thresholds:**
- `WATCHDOG_INTERVAL=90s` (loop interno puro bash, zero API call)
- `T_RESUME_MAX=5min` (resume típico <30s, margem 10×)
- `T_WORKER_MAX=60min` (P99 observado #119 ~18min excepto task 08 anômala; 60min dá folga)

**Lifecycle:** `nohup bash ~/cc-mailbox/bin/cc-watchdog.sh <issue> <branch> &` lançado após listener pelo `cc-worktree-start.sh`. PID em `.cc-mailbox/.watchdog-pid`. `trap 'rm -f "$PIDFILE"; exit 0' TERM INT EXIT`. A cada iteração checa `[ -d "$MAILBOX" ] || exit 0` (auto-self-kill se worktree sumir).

**Concorrência:** reaproveita `.cc-mailbox/locks/coord.lock` via `flock -w 30` (mesmo contrato do listener e `cc-dispatch-task.sh`). Pior caso 2 wake-ups da Coord em paralelo; Coord idempotente (§13.8 passo 31).

**Heartbeat da Coord:** rejeitado para MVP (Coord vive em surtos, heartbeat fica naturalmente stale entre wake-ups; não distingue "travada" de "entre tasks"). Registrado como fast-follow.

**Tipo de email:** `HUMAN_GATE` genérico para Classes 1 (retry failed) e 2 (worker stall). Classe 3 (tmux relançado) usa `HUMAN_GATE` também com título prefixado `[INFO]`.

**Relaunch automático Classe 3:** aprovado (`cc-worktree-start.sh` é idempotente; barato e seguro). Se tmux não parar de cair, o email agrupado vira sinal de causa-raiz externa.

**Logging:** `.cc-mailbox/log/watchdog.log` formato 1-line ISO-8601 + level + class + ação. Heartbeat a cada 10 iterações (15min).

### §3.2 Decisões Autônomas

_(vazio — modo interativo; decisões ficam no código)_

## §4 SESSÕES

### Sessão — 23/04/2026 — Abertura + implementação (interativo)

CC-Interface implementa direto. Motivação: meta-infra pequena (~250 linhas), implementação mais rápida em modo interativo que despachando nova sessão autônoma.

## §5 DELTAS EM SHARED FILES (para PR)

### `docs/PROJECT.md` — encerramento
- Nova entrada na tabela de histórico §1 (encerramento #178 v0.XX.0)
- §13.11 adicionar `cc-watchdog.sh` e `cc-status.sh` como IMPLEMENTADO

### `scripts/cc-worktree-start.sh`
- Bloco após lançamento do listener: `nohup bash "$HOME/cc-mailbox/bin/cc-watchdog.sh" "$ISSUE" "$BRANCH" > "$MAILBOX/log/watchdog.stdout" 2>&1 & ; echo $! > "$MAILBOX/.watchdog-pid" ; disown`
- Opt-out: `[[ "${CC_WATCHDOG_DISABLE:-}" == "1" ]] || <launch>`

### `scripts/cc-worktree-stop.sh`
- Se não existir, criar; se existir, adicionar bloco que mata watchdog via `.watchdog-pid` antes de `tmux kill-session`

### Nenhum toque em: produto Espelho (src/, functions/, firestore.rules)

## §6 CHUNKS

Nenhum — meta-infra em `~/cc-mailbox/` e `scripts/` não tem chunk lock (precedente #169/#176).
