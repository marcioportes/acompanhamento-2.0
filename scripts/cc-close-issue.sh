#!/usr/bin/env bash
# cc-close-issue.sh — orquestrador determinístico do §4.3 Encerramento (issue #199).
#
# Uso:
#   scripts/cc-close-issue.sh <issue_num>             # encerramento normal
#   scripts/cc-close-issue.sh <issue_num> --dry-run   # mostra etapas sem executar
#
# Etapas (aborta no primeiro erro):
#   0. Pré-checks (cwd=main, PR mergeado, issue CLOSED no GitHub)
#   1. Sync main
#   2. Snapshot defensivo do issue body → .archive-snapshots/issue-NNN.json
#   3. Aplicar deltas curtos (formato Fase 2 do plano #199):
#      - docs/PROJECT.md: nova linha na tabela | versão | issue/PR | resumo | data |
#      - CHANGELOG.md: nova entrada ≤8 linhas
#      - src/version.js: linha CHANGELOG inline + bump constante (se for tipo de produto)
#      - docs/registry/versions.md: marcar consumida
#      - docs/registry/chunks.md: liberar locks da sessão
#      - docs/decisions.md: append DECs aprovadas (de .deccs-NNN.md opcional no worktree)
#   4. Deletar control doc local (docs/dev/issues/issue-NNN-*.md)
#   5. Confirmar com user antes de commit + push
#   6. Encerrar infra: pkill vite + cc-worktree-stop.sh + rm -rf
#   7. Verificações finais (ls/tmux/ps)
#   8. Deletar branch local
#
# Recovery manual: docs/protocols/closing-manual.md (cópia do §4.3 5a-5d original).

set -euo pipefail

# ---------- args ----------
if [ $# -lt 1 ]; then
  echo "uso: $0 <issue_num> [--dry-run]" >&2
  exit 1
fi
ISSUE="$1"
DRY_RUN=false
[ "${2:-}" = "--dry-run" ] && DRY_RUN=true

REPO="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
WORKTREE="$HOME/projects/issue-${ISSUE}"
SNAPSHOT_DIR="$REPO/.archive-snapshots"
TODAY=$(date +%d/%m/%Y)
TODAY_BUILD=$(date +%Y%m%d)

run() {
  if $DRY_RUN; then
    echo "  [dry-run] $*"
  else
    eval "$@"
  fi
}

abort() {
  echo "[abort] $*" >&2
  exit 1
}

# ---------- 0. Pré-checks ----------
echo "[0/8] Pré-checks…"

[ "$(pwd)" = "$REPO" ] || abort "execute do repo root: $REPO"

CURR_BRANCH=$(git rev-parse --abbrev-ref HEAD)
[ "$CURR_BRANCH" = "main" ] || abort "cwd não está em main (atual: $CURR_BRANCH). Saia do worktree antes."

PR=$(gh pr list --state merged --search "Closes #${ISSUE}" --json number --limit 1 --jq '.[0].number' 2>/dev/null)
[ -n "$PR" ] || abort "PR mergeado para #${ISSUE} não encontrado (procurei por 'Closes #${ISSUE}' no body)"

ISSUE_STATE=$(gh issue view "$ISSUE" --json state --jq .state 2>/dev/null || echo "")
[ "$ISSUE_STATE" = "CLOSED" ] || abort "Issue #${ISSUE} state=$ISSUE_STATE (esperado CLOSED)"

PR_TITLE=$(gh pr view "$PR" --json title --jq .title)
PR_SHA=$(gh pr view "$PR" --json mergeCommit --jq .mergeCommit.oid)
PR_TYPE=$(echo "$PR_TITLE" | sed -nE 's/^([a-z]+).*/\1/p')   # fix|feat|debt|refactor|arch
[ -n "$PR_TYPE" ] || abort "não consegui detectar tipo do PR (título: $PR_TITLE)"

# Resumo curto: tira "type: " do começo, normaliza espaços, ≤80 chars
PR_SUMMARY=$(echo "$PR_TITLE" | sed -E 's/^[a-z]+(\([^)]+\))?:\s*//' | head -c 80)

# Versão reservada para esse issue
VER_LINE=$(grep -E "^\| .* \| #${ISSUE} \|" "$REPO/docs/registry/versions.md" | head -1 || true)
if [ -z "$VER_LINE" ]; then
  echo "  [info] sem reserva em registry/versions.md (refactor sem bump de produto)"
  VER=""
else
  VER=$(echo "$VER_LINE" | awk -F'|' '{print $2}' | tr -d ' ')
fi

echo "  PR #${PR} (sha ${PR_SHA:0:8}) tipo=${PR_TYPE} ver=${VER:-none}"
echo "  resumo: ${PR_SUMMARY}"

# ---------- 1. Sync main ----------
echo "[1/8] Sync main…"
run "git pull --rebase origin main"

# ---------- 2. Snapshot defensivo ----------
echo "[2/8] Snapshot do issue body → .archive-snapshots/issue-${ISSUE}.json"
run "mkdir -p '$SNAPSHOT_DIR'"
run "gh issue view ${ISSUE} --json number,title,body,state,closedAt,labels > '$SNAPSHOT_DIR/issue-${ISSUE}.json'"
run "gh pr view ${PR} --json number,title,body,state,mergedAt,mergeCommit >> '$SNAPSHOT_DIR/issue-${ISSUE}.json'"

# ---------- 3. Deltas curtos ----------
echo "[3/8] Aplicando deltas (formato Fase 2)…"

# 3a. PROJECT.md — nova linha na tabela de versões
# (formato espera tabela existente; se não existir, mostra warning)
if [ -n "$VER" ] && grep -qE "^\| Versão \| Issue/PR \|" "$REPO/docs/PROJECT.md" 2>/dev/null; then
  NEW_ROW="| ${VER} | #${ISSUE}/#${PR} | ${PR_TYPE}: ${PR_SUMMARY} | ${TODAY} |"
  if $DRY_RUN; then
    echo "  [dry-run] PROJECT.md ← inserir após cabeçalho da tabela:"
    echo "    ${NEW_ROW}"
  else
    # Insere após a linha "|---|---|---|---|" da tabela
    awk -v row="$NEW_ROW" '
      /^\| Versão \| Issue\/PR \|/ { print; in_table=1; next }
      in_table && /^\|[-]+\|/ { print; print row; in_table=0; next }
      { print }
    ' "$REPO/docs/PROJECT.md" > "$REPO/docs/PROJECT.md.tmp" && mv "$REPO/docs/PROJECT.md.tmp" "$REPO/docs/PROJECT.md"
  fi
else
  echo "  [warn] PROJECT.md sem tabela | Versão | Issue/PR | … | (formato antigo). Edite manualmente."
fi

# 3b. CHANGELOG.md — nova entrada ≤8 linhas (formato Fase 2)
if [ -n "$VER" ]; then
  CHANGELOG_BLOCK=$(cat <<EOF
## [${VER}] - ${TODAY} · #${ISSUE} · PR #${PR}

**${PR_TYPE}:** ${PR_SUMMARY}

- _(decisões/testes/files — ajustar antes do commit)_
EOF
)
  if $DRY_RUN; then
    echo "  [dry-run] CHANGELOG.md ← inserir bloco após '---':"
    echo "$CHANGELOG_BLOCK" | sed 's/^/    /'
  else
    # Insere após a primeira linha "---" (encerra o cabeçalho do CHANGELOG)
    awk -v block="$CHANGELOG_BLOCK" '
      !done && /^---$/ { print; print ""; print block; print ""; done=1; next }
      { print }
    ' "$REPO/CHANGELOG.md" > "$REPO/CHANGELOG.md.tmp" && mv "$REPO/CHANGELOG.md.tmp" "$REPO/CHANGELOG.md"
  fi
fi

# 3c. src/version.js — linha CHANGELOG + bump (só para tipos que tocam produto)
TOUCHES_PRODUCT=true
[ "$PR_TYPE" = "refactor" ] || [ "$PR_TYPE" = "docs" ] && TOUCHES_PRODUCT=false

if [ -n "$VER" ] && $TOUCHES_PRODUCT; then
  VERSION_LINE=" * - ${VER}: #${ISSUE} ${PR_TYPE} ${PR_SUMMARY} (PR #${PR}, ${TODAY})"
  if $DRY_RUN; then
    echo "  [dry-run] src/version.js ← inserir após 'CHANGELOG':"
    echo "    ${VERSION_LINE}"
    echo "  [dry-run] src/version.js ← bump constante para '${VER}', build '${TODAY_BUILD}'"
  else
    # Insere linha após "* CHANGELOG"
    sed -i "/^ \* CHANGELOG/a ${VERSION_LINE}" "$REPO/src/version.js"
    # Bump da constante VERSION
    sed -i -E "s/version: '[^']+'/version: '${VER}'/" "$REPO/src/version.js"
    sed -i -E "s/build: '[^']+'/build: '${TODAY_BUILD}'/" "$REPO/src/version.js"
    sed -i -E "s/display: '[^']+'/display: 'v${VER}'/" "$REPO/src/version.js"
    sed -i -E "s/full: '[^']+'/full: '${VER}+${TODAY_BUILD}'/" "$REPO/src/version.js"
  fi
elif [ -n "$VER" ]; then
  echo "  [skip] version.js bump (PR_TYPE=${PR_TYPE} não toca código de produto)"
fi

# 3d. registry/versions.md — marcar consumida
# Delimitador `~` evita conflito com `|` literal das colunas da tabela e com
# `[^|]` no regex. Bug histórico (issue #212): usar `s|...|` com `[^|]` quebra
# parser GNU sed — delimitador dentro da char class é tratado como fim do
# pattern e o regex degenerado casa todas as linhas do arquivo.
if [ -n "$VER" ]; then
  CONSUMED_NOTE="consumida (PR #${PR} squash \`${PR_SHA:0:8}\`)"
  if $DRY_RUN; then
    echo "  [dry-run] registry/versions.md ← marcar v${VER} como '${CONSUMED_NOTE}'"
  else
    sed -i -E "s~^(\| ${VER} \| #${ISSUE} \| [^|]+ \| [^|]+ \|) [^|]+ \|\$~\1 ${CONSUMED_NOTE} |~" "$REPO/docs/registry/versions.md"
  fi
fi

# 3e. registry/chunks.md — liberar locks da sessão
LOCK_LINES=$(grep -E "^\| CHUNK-[A-Z0-9]+ \| #${ISSUE} \|" "$REPO/docs/registry/chunks.md" || true)
if [ -n "$LOCK_LINES" ]; then
  if $DRY_RUN; then
    echo "  [dry-run] registry/chunks.md ← remover linhas:"
    echo "$LOCK_LINES" | sed 's/^/    /'
  else
    grep -vE "^\| CHUNK-[A-Z0-9]+ \| #${ISSUE} \|" "$REPO/docs/registry/chunks.md" > "$REPO/docs/registry/chunks.md.tmp"
    mv "$REPO/docs/registry/chunks.md.tmp" "$REPO/docs/registry/chunks.md"
  fi
fi

# 3f. decisions.md — append de DECs (opcional via .deccs-NNN.md)
DECCS_FILE="$REPO/.deccs-${ISSUE}.md"
if [ -f "$DECCS_FILE" ]; then
  if $DRY_RUN; then
    echo "  [dry-run] decisions.md ← append de $(wc -l < "$DECCS_FILE") linha(s) de $DECCS_FILE"
  else
    cat "$DECCS_FILE" >> "$REPO/docs/decisions.md"
    rm -f "$DECCS_FILE"
  fi
fi

# ---------- 4. Deletar control doc ----------
echo "[4/8] Deletando control doc local…"
CONTROL_DOC=$(find "$REPO/docs/dev/issues" -maxdepth 1 -type f -name "issue-${ISSUE}-*.md" | head -1)
if [ -n "$CONTROL_DOC" ]; then
  run "git rm '$CONTROL_DOC'"
else
  echo "  [skip] nenhum control doc em docs/dev/issues/issue-${ISSUE}-*.md"
fi

# ---------- 5. Pause + confirmação ----------
echo
echo "[5/8] Revise os deltas (git diff). Pronto para commit + push?"
if ! $DRY_RUN; then
  git status --short
  echo
  read -p "Commit '${PR_TYPE}: encerramento #${ISSUE}' + push para main? [y/N] " ANSWER
  [ "$ANSWER" = "y" ] || [ "$ANSWER" = "Y" ] || abort "abortado pelo user antes do commit"
  git add -A
  git commit -m "docs: encerramento #${ISSUE} ${VER:+v${VER}} — ${PR_SUMMARY}

Mergeado via PR #${PR} squash \`${PR_SHA:0:8}\`. Detalhe completo no PR body.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
  git push origin main
fi

# ---------- 6. Encerrar infra ----------
echo "[6/8] Encerrando infra (vite + tmux + watchdog + worktree)…"
run "pkill -9 -f vite || true"
if [ -d "$WORKTREE" ]; then
  run "$REPO/scripts/cc-worktree-stop.sh ${ISSUE}"
  run "rm -rf '$WORKTREE'"
else
  echo "  [skip] sem worktree em $WORKTREE"
fi

# ---------- 7. Verificações finais ----------
echo "[7/8] Verificações finais…"
RESIDUE=()
[ -d "$WORKTREE" ] && RESIDUE+=("dir $WORKTREE ainda existe")
git worktree list 2>/dev/null | grep -q "issue-${ISSUE}" && RESIDUE+=("worktree no registro git")
tmux ls 2>&1 | grep -q "cc-${ISSUE}" && RESIDUE+=("tmux session cc-${ISSUE} viva")
pgrep -f "cc-watchdog.*${ISSUE}" >/dev/null && RESIDUE+=("watchdog vivo")
if [ ${#RESIDUE[@]} -gt 0 ]; then
  printf '  [fail] %s\n' "${RESIDUE[@]}" >&2
  abort "verificações falharam — investigar antes de marcar como concluído"
fi
echo "  [ok] zero resíduo"

# ---------- 8. Branch local ----------
echo "[8/8] Removendo branch local…"
LOCAL_BRANCHES=$(git branch --list "*issue-${ISSUE}-*" "*/issue-${ISSUE}-*" 2>/dev/null | sed 's/^[* ]*//')
if [ -n "$LOCAL_BRANCHES" ]; then
  for b in $LOCAL_BRANCHES; do
    run "git branch -D '$b'"
  done
else
  echo "  [skip] nenhuma branch local issue-${ISSUE}-*"
fi

echo
echo "Encerramento #${ISSUE} ${VER:+v${VER}} completo."
$DRY_RUN && echo "(dry-run — nada foi modificado)"
