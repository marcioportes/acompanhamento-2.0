# Issue #176 — Scripts de orquestração §13

**Baseado na versão PROJECT.md:** 0.34.0
**Branch:** `arch/issue-176-scripts-orquestracao-protocolo`
**Worktree:** `~/projects/issue-176`
**Chunks:** N/A (meta-infra fora do produto — mesmo padrão do #169)
**Sem bump em `src/version.js`** (scripts fora do produto)

## 1. Escopo

Fecha os gaps do §13.8 passos 8b (spawn da Coord) e 8d (dispatch da primeira task) identificados no review pós-#169.

### Componentes

1. **`~/cc-mailbox/templates/coord-briefing.md`** — template canônico
   Placeholders: `{{issue_num}}`, `{{issue_title}}`, `{{branch}}`, `{{worktree_path}}`, `{{control_file_path}}`
   Cobre:
   - Identidade (CC-Coord do issue, escopo do worktree)
   - Ciclo de vida: **sempre morrer após cada turno** (Modelo A §13.12 bug 2)
   - Wake-up via `TASK_DELIVERED N=<n>`:
     1. Ler `outbox/<N>-result.log` ANTES do `<N>-report.md` (token budget §13.13)
     2. Relê control file `docs/dev/issues/issue-NNN-*.md`
     3. Roda `cc-validate-task.py --report-md ... --result-log ... --worktree <path>`
     4. Se validator FAIL → STOP-HALLUCINATION: grava `outbox/STOP-<N>.log` + invoca `cc-notify-email.py` (type=HALLUCINATION) + morre
     5. Se OK → decide próxima:
        - Há próxima task no plano → escreve `inbox/<N+1>-<slug>.md` usando template `worker-briefing.md`
        - Fim do plano → email `FINISHED` + morre
   - Wake-up via `DISPATCH_TASK <slug>` (primeira task): escreve `inbox/<N>-<slug>.md` + morre
   - Wake-up via `HUMAN_GATE_RESOLVED ref=<path>`: lê resposta humana, ajusta plano, despacha próxima ou aplica correção, morre
   - Resolução de ambiguidades: spec → PROJECT.md → padrão do projeto → menor blast radius. Registra em `§3.2 Decisões Autônomas` (DEC-AUTO-NNN-XX)
   - Tipos de gate humano (§13.10): TEST_FAIL, DESTRUCTIVE, CONFLICT, INVARIANT, HUMAN_GATE

2. **`~/cc-mailbox/bin/cc-spawn-coord.sh`** — wrapper §13.8 passo 8b
   Uso: `cd ~/projects/issue-NNN && cc-spawn-coord.sh <issue-num> <branch>`
   Efeito:
   - Pré-condição dura: `readlink -f pwd == ~/projects/issue-<NNN>` (aborta exit 2 se diverge)
   - Lê control file `docs/dev/issues/issue-<NNN>-*.md` pra extrair `{{issue_title}}`
   - Renderiza `coord-briefing.md` com placeholders preenchidos
   - Invoca `claude --permission-mode auto --output-format json -p "<briefing renderizado>" > /tmp/coord-spawn-NNN.json`
   - Extrai `session_id` do JSON, valida formato UUID
   - Imprime no stdout `COORD_SESSION_ID=<id>` (parsable via `cut -d= -f2`)
   - Exit codes: 0 OK, 2 precondição, 3 spawn falhou, 4 JSON malformado

3. **`~/cc-mailbox/bin/cc-dispatch-task.sh`** — wrapper §13.8 passos 8d / 36
   Uso: `cc-dispatch-task.sh <issue-num> <slug|FIRST>`
   Efeito:
   - Lê `~/projects/issue-<NNN>/.cc-mailbox/.coord-id` (aborta exit 4 se vazio)
   - Usa `flock -w 30 ~/projects/issue-<NNN>/.cc-mailbox/locks/coord.lock`
   - `cd` pro coord-dir (de `.coord-dir`)
   - `claude --resume <coord-id> --permission-mode auto -p "DISPATCH_TASK <slug>"` (ou `FIRST` como slug especial)
   - Exit codes: 0 OK, 2 lock timeout, 3 resume error, 4 .coord-id ausente

### Smoke test

Worktree sintético `issue-998` (análogo ao `issue-999` do #169):
1. Rodar `cc-worktree-start.sh` (do branch refactorado)
2. Rodar `cc-spawn-coord.sh 998 dry-run/...` → valida session_id retornado, `/tmp/coord-spawn-998.json` populado
3. Rodar `cc-dispatch-task.sh 998 FIRST` com briefing trivial (ex: "escreva inbox/01-smoke.md com um prompt fake de 1 linha")
4. Verificar que `inbox/01-*.md` foi criado pela Coord
5. Matar tmux + limpar worktree sintético

Custo estimado de tokens: <5k (coord spawn + 1 dispatch).

### Atualização de documentação

- `docs/PROJECT.md` §13.11: 3 entradas novas marcadas IMPLEMENTADO
- Bump 0.34.0 → 0.35.0 no encerramento

## 2. Fora do escopo

- **Rodada end-to-end real (Fase D)** — depende desta issue + issue-teste simples
- **Re-teste Recovery §13.15** — deixar para Fase D
- **`cc-notify-whatsapp.sh`** — opcional, não bloqueia

## 3. Impacto

| Aspecto | Detalhe |
|---------|---------|
| Collections Firestore | Zero |
| CFs | Zero |
| Hooks do app | Zero |
| Shared files do repo | Apenas `docs/PROJECT.md` (histórico + §13.11) |
| Arquivos fora do repo | `~/cc-mailbox/templates/coord-briefing.md` + 2 scripts |
| Blast radius | Zero no produto |
| Rollback | `rm -f ~/cc-mailbox/bin/cc-spawn-coord.sh ~/cc-mailbox/bin/cc-dispatch-task.sh ~/cc-mailbox/templates/coord-briefing.md` |

## 4. Ordem de implementação

1. `coord-briefing.md` (template canônico)
2. `cc-spawn-coord.sh` + unit test via bash (precondição + render)
3. `cc-dispatch-task.sh` + unit test via bash (precondição + flock)
4. Smoke test end-to-end em worktree sintético `issue-998`
5. Bump PROJECT.md §13.11 + entrada histórico v0.35.0 encerramento
6. PR com `Closes #176`

## 5. CLAIMS consolidado (a preencher no encerramento)

Template:
```
commit_chain: [...]
files_touched (repo): docs/PROJECT.md, docs/dev/issues/issue-176-*.md
files_created (outside repo): ~/cc-mailbox/templates/coord-briefing.md, bin/cc-spawn-coord.sh, bin/cc-dispatch-task.sh
smoke_test: worktree-998 spawn OK + dispatch OK + inbox/01 criado
```

## 6. Log da sessão

### 23/04/2026 — Abertura
- Issue #176 criada
- PROJECT.md v0.33.0 → v0.34.0 (entrada histórico)
- Commit `4cf38070` no main
- Worktree criado em `~/projects/issue-176`
- Control file (este) criado

### Próximo: Fase 1 (coord-briefing.md template)
