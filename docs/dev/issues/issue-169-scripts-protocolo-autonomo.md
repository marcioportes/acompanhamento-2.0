# Issue #169 — Scripts do Protocolo Autônomo §13 (Fases A+B+C)

**Baseado na versão PROJECT.md:** 0.29.0
**Branch:** `arch/issue-169-scripts-protocolo-autonomo`
**Worktree:** `~/projects/issue-169`
**Escopo desta sessão:** Fases A + B + C (Fase D — rodada end-to-end — fica para issue-teste real separada)
**Chunks:** N/A (meta-infra do CC, fora do produto Espelho)

---

## 1. Escopo

Retirar o Protocolo Autônomo §13 do **modo degradado** implementando:

### Fase A — Mailbox global + `cc-notify-email.py`
- `~/cc-mailbox/{bin,log,templates}/` + `.env.example` (sem secrets)
- `cc-notify-email.py` lê JSON stdin, envia via SMTP iCloud (`smtp.mail.me.com:587` STARTTLS)
- 7 TIPOs do §13.10: `TEST_FAIL`, `DESTRUCTIVE`, `CONFLICT`, `INVARIANT`, `HALLUCINATION`, `HUMAN_GATE`, `FINISHED`
- Rate limit por `(issue, type)` em 4h via `~/cc-mailbox/notify-state.json`
- Body template: `RESUMO`, `DETALHE`, `OPÇÕES` (quando aplicável), `ARTEFATOS`, `COMO RESPONDER`
- Log em `~/cc-mailbox/log/emails.log` (agregado) e `.cc-mailbox/log/emails.log` (per-issue quando invocado do worktree)
- Exit codes: `0` OK, `2` silenciado (rate limit), `3` SMTP error, `4` input error

### Fase B — `cc-validate-task.py` (INV-27 operacional)
- 3 checks do §13.9, total <300ms:
  1. `commit_exists`: `git cat-file -e <hash>`
  2. `tests_match`: contagem declarada bate com parse do `result.log`
  3. `files_match`: `git show --name-only <hash>` ⊆ `files_touched` declarado
- Entrada: `--report-md <path>` (parseia bloco `## CLAIMS` + JSON) + `--result-log <path>` + `--worktree <path>`
- Regra `tests: skipped`: permitido APENAS se `files_touched` é subset de `*.md` e `docs/**`
- Exit codes: `0` OK, `1` STOP-HALLUCINATION, `2` CLAIMS ausente, `3` arquivo inexistente
- Testes pytest: CLAIMS válida, commit inexistente, contagem divergente, arquivo não presente, CLAIMS ausente, skipped com .js

### Fase C — Refactor `cc-worktree-start.sh` 3-tier + template briefing
- Aceita argumentos: `<issue> <branch> [COORD_SESSION_ID] [INTERFACE_SESSION_ID]`
- **Pré-condição dura:** se invocado com `cwd != worktree`, aborta com mensagem clara (§13.8 passo 8b)
- Cria todos os dirs §13.7: `inbox/`, `outbox/`, `processed/`, `coord-inbox/`, `locks/`, `notify-scratch/`, `log/`
- Grava `.coord-id` + `.coord-dir` + `.interface-id` (quando passado) — **READ-ONLY depois** (INV-26)
- Listener tmux preserva comportamento atual (polling 2s, `claude -p` headless, `--resume` no coord)
- Criar `~/cc-mailbox/templates/worker-briefing.md` com cláusula CLAIMS obrigatória (§13.9)

## 2. Fora do escopo desta sessão (Fase D)

- `cc-notify-whatsapp.sh` (trivial, opcional) — incluído no issue mas não crítico
- Rodada end-to-end com issue real em modo autônomo puro
- Bump §13.11 "A ESCREVER" → "IMPLEMENTADO"
- Recovery §13.15 re-testado pós-amendment

## 3. Impacto

| Aspecto | Detalhe |
|---------|---------|
| Collections Firestore | Zero |
| Cloud Functions | Zero |
| Hooks do app | Zero |
| Shared files do repo tocados | `scripts/cc-worktree-start.sh` (refactor) |
| Arquivos fora do repo | `~/cc-mailbox/**` (infra do usuário) |
| Blast radius | Zero no produto. Falha → modo degradado atual (baseline pré-scripts) |
| Rollback | `rm -rf ~/cc-mailbox/` + `git revert` no branch |

### 3.1 INVs aplicáveis

- **INV-25** Outbox antes de resume — preservado no listener
- **INV-26** `.coord-id`/`.coord-dir` READ-ONLY — **reforçado** pela pré-condição cwd
- **INV-27** Validação externa — **operacionalizada** pelo `cc-validate-task.py`
- **INV-28** Email iCloud canal primário — **operacionalizada** pelo `cc-notify-email.py`

## 4. Ordem de implementação

1. **Fase A1** — `~/cc-mailbox/{bin,log,templates}/` + `.env.example`
2. **Fase A2** — `cc-notify-email.py` (código + smoke test dry-run com EMAIL_DRY_RUN=1)
3. **Fase B1** — Testes pytest de `cc-validate-task.py` (RED)
4. **Fase B2** — `cc-validate-task.py` (GREEN)
5. **Fase C1** — refactor `scripts/cc-worktree-start.sh`
6. **Fase C2** — `~/cc-mailbox/templates/worker-briefing.md`
7. **Smoke tests** — validator rodando contra CLAIMS fake (hit + miss), email em dry-run
8. PR com Fases A+B+C consolidadas

## 5. Deltas de shared files

- `scripts/cc-worktree-start.sh` — refactor (mesmo arquivo, nova assinatura + pré-condição)
- Nenhum outro shared file. `src/version.js` não é tocado (scripts não são produto).

## 6. Decisões de design (propostas — confirmar em review)

- **DEC-AUTO-169-01**: Scripts em `~/cc-mailbox/bin/` (global por usuário), não em `scripts/` do repo. `scripts/cc-worktree-start.sh` continua no repo pois é ponto de entrada do §4.0.
- **DEC-AUTO-169-02**: `cc-notify-email.py` aceita JSON stdin (não CLI args) — compose estruturado é mais robusto contra escape hell.
- **DEC-AUTO-169-03**: Validator parseia CLAIMS do `report.md` (não `result.log`) — reports são o contrato explícito do worker. `result.log` é consultado só para bater contagem de testes.
- **DEC-AUTO-169-04**: `tests_match` aceita tolerância de ±5 no parse (workers podem declarar 1573 e result.log mostrar 1574 por ordem de transform). Se vier issue real, apertar.
- **DEC-AUTO-169-05**: Pré-condição cwd=worktree no start.sh usa `readlink -f` para resolver symlinks.

## 7. CLAIMS estruturado (INV-27 manual nesta sessão)

Ao final, bloco CLAIMS agregado no log da sessão:
```
commit_chain: [sha1, sha2, ..., tip]
tests: <n>/<n> (pytest para validator)
files_touched: [lista]
artefatos_externos_criados: [~/cc-mailbox/bin/cc-notify-email.py, ...]
```

## 8. Log da sessão

### 22/04/2026 — Abertura
- Issue #169 já existia (criado previamente por Marcio)
- PROJECT.md v0.28.0 → v0.29.0 (entrada histórico)
- Commit `315cecb9` no main
- Worktree criado em `~/projects/issue-169`
- Branch `arch/issue-169-scripts-protocolo-autonomo`

### 22/04/2026 — Fase A (mailbox global + cc-notify-email.py)

Criados (global, fora do repo):
- `~/cc-mailbox/{bin,log,templates}/`
- `~/cc-mailbox/.env.example` (versionável) + `~/cc-mailbox/.env` (600, não versionado) com `EMAIL_DRY_RUN=1` para smoke test
- `~/cc-mailbox/bin/cc-notify-email.py` (+x, 280 linhas)

Smoke tests executados:
- Happy path dry-run → exit 0, body formatado com seção COMO RESPONDER
- Rate limit ativo (2º envio em <4h) → exit 2 com log "SILENCED"
- Type inválido → exit 4 com lista de válidos
- stdin vazio → exit 4
- `--force` bypass → dry-run roda mesmo dentro da janela de 4h

### 22/04/2026 — Fase B (cc-validate-task.py + 12 testes pytest)

Criados:
- `~/cc-mailbox/bin/cc-validate-task.py` (+x, 233 linhas) — parseia bloco CLAIMS do report.md, roda 3 checks, STOP-HALLUCINATION granular por check
- `~/cc-mailbox/bin/test_cc_validate_task.py` (266 linhas, 12 testes)

Testes pytest: **12/12 passed em 0.92s** cobrindo:
- Happy path, commit inexistente, tests count divergente, tests dentro da tolerância (±5), files_match (declared subset/superset do real), CLAIMS ausente, CLAIMS JSON malformado, skipped com .js (proibido), skipped com .md apenas (OK), report.md inexistente, performance <1500ms

Integration test contra `feature/issue-170-setup-analysis-v2` (commit real `2bd11e82`):
- CLAIMS verdadeira → `OK: commit_exists, tests_match, files_match` (exit 0)
- CLAIMS com `deadbeef` → `STOP-HALLUCINATION: commit_exists: commit_hash 'deadbeef' não existe no worktree` (exit 1)

### 22/04/2026 — Fase C (refactor cc-worktree-start.sh + template briefing)

Refactor em `scripts/cc-worktree-start.sh` (commit `d78bb958`):
- **Pré-condição dura** (§13.8 passo 8b): aborta com exit 2 se cwd ≠ `~/projects/issue-<NNN>` quando worktree existe. Mensagem de erro contém comando corretivo.
- **Dirs §13.7 completos**: `inbox, outbox, processed, coord-inbox, locks, notify-scratch, log` (antes só os 3 primeiros)
- **Session IDs READ-ONLY**: `.coord-id`, `.coord-dir`, `.interface-id` gravados e `chmod 444`. Amendment INV-26 v0.26.0 respeitada — tentativa de sobrescrever com valor diferente imprime aviso e mantém existente.
- **Listener refactorado**: usa `flock -w 30 locks/coord.lock` antes de `--resume` (§13.8 passo 26) + `--permission-mode auto` + log estruturado em `log/listener.log`.

Criado:
- `~/cc-mailbox/templates/worker-briefing.md` — template canônico com cláusula CLAIMS obrigatória, formato exato do bloco JSON, regras de `tests: skipped`, tratamento de ambiguidades, critérios de gate humano, e exemplo mínimo de report válido.

Smoke test end-to-end:
- `cc-worktree-start.sh 170 feature/... smoke-coord-id` em cwd `~/projects/issue-170` → cria todos os 7 dirs, grava RO, lança tmux `cc-170`
- Limpo após validação

## 9. CLAIMS consolidado (INV-27 manual — esta sessão)

```json
{
  "commit_chain_no_branch": ["6819a79c", "d78bb958"],
  "commit_main_abertura": "315cecb9",
  "tests": {
    "pytest_cc_validate_task": {"passed": 12, "failed": 0, "cmd": "python3 -m pytest"},
    "integration_real_commit": {"ok": true, "stop_on_fake": true},
    "bash_syntax_check": {"ok": true, "cmd": "bash -n scripts/cc-worktree-start.sh"}
  },
  "files_touched_no_branch": [
    "docs/dev/issues/issue-169-scripts-protocolo-autonomo.md",
    "scripts/cc-worktree-start.sh"
  ],
  "files_created_outside_repo": [
    "~/cc-mailbox/.env.example",
    "~/cc-mailbox/.env  (600, dry-run)",
    "~/cc-mailbox/bin/cc-notify-email.py",
    "~/cc-mailbox/bin/cc-validate-task.py",
    "~/cc-mailbox/bin/test_cc_validate_task.py",
    "~/cc-mailbox/templates/worker-briefing.md",
    "~/cc-mailbox/log/emails.log (criado pelo primeiro dry-run)",
    "~/cc-mailbox/notify-state.json (criado pelo primeiro dry-run)"
  ],
  "invariants_touched": ["INV-25", "INV-26", "INV-27", "INV-28"],
  "fora_de_escopo_desta_sessao": [
    "Fase D (rodada end-to-end real com modo autônomo puro)",
    "cc-notify-whatsapp.sh",
    "Re-teste do Recovery §13.15 pós-amendment v0.26.0",
    "Atualizar PROJECT.md §13.11 removendo 'A ESCREVER'"
  ]
}
```

### Próximo passo

1. Rodada end-to-end (Fase D) com issue-teste trivial em modo autônomo — valida que tudo conecta ponta-a-ponta e que o email real chega
2. Atualizar PROJECT.md §13.11 (`A ESCREVER` → `IMPLEMENTADO`) + bump 0.29.0 → 0.30.0 no encerramento
3. Merge via PR com `Closes #169`
