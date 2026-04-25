# Protocolo §4.3 — Encerramento de Sessão

> **Regra absoluta:** todo encerramento via `./scripts/cc-close-issue.sh NNN`. Manual é exceção registrada com motivo no PR.
> Refactor #199 (25/04/2026): GitHub (issue + PR) é SSoT do detalhe; docs locais são índice mínimo.

---

## Pré-condições

- PR para #NNN mergeado em main
- Issue #NNN com state=CLOSED no GitHub (auto via `Closes #NNN` no PR body)
- cwd no repo root (`acompanhamento-2.0`), branch `main` com pull recente

## Execução

```bash
./scripts/cc-close-issue.sh NNN              # encerramento normal
./scripts/cc-close-issue.sh NNN --dry-run    # mostra etapas sem executar
```

O script orquestra 8 etapas e aborta no primeiro erro:

1. **Pré-checks** — `gh pr list` confirma PR mergeado com `Closes #NNN`; `gh issue view` confirma state=CLOSED.
2. **Sync main** — `git pull --rebase origin main`.
3. **Snapshot defensivo** — `gh issue view + gh pr view --json` para `.archive-snapshots/issue-NNN.json` (resiliência a edição/perda de issue body).
4. **Deltas curtos** (formato Fase 2 — GitHub é SSoT do detalhe):
   - `docs/PROJECT.md`: nova linha na tabela `| Versão | Issue/PR | Resumo | Data |`.
   - `CHANGELOG.md`: entrada ≤8 linhas (`## [X.Y.Z] - DD/MM/YYYY · #NNN · PR #PPP` + tipo + bullet de DECs/testes/files).
   - `src/version.js`: linha CHANGELOG inline + bump constante. Pulado se `PR_TYPE ∈ {refactor, docs}` (não toca código de produto).
   - `docs/registry/versions.md`: marca versão consumida com sha do squash.
   - `docs/registry/chunks.md`: remove linhas dos locks da sessão.
   - `docs/decisions.md`: append do `.deccs-NNN.md` opcional (DECs aprovadas durante a sessão).
5. **Delete control doc** — `git rm docs/dev/issues/issue-NNN-*.md` (não arquiva — Fase 2.4 do refactor #199).
6. **Confirmação humana** — script mostra `git status --short` e pergunta antes de commit + push para main.
7. **Encerrar infra** — `pkill -9 -f vite` + `cc-worktree-stop.sh NNN` + `rm -rf ~/projects/issue-NNN`.
8. **Verificações + branch local** — `ls ~/projects/`, `git worktree list`, `tmux ls`, `pgrep cc-watchdog` devem passar; `git branch -D *issue-NNN-*`.

## Recovery manual

Se `cc-close-issue.sh` falhar, ler `docs/protocols/closing-manual.md` e logar motivo no PR body. Após executar manual, abrir issue `type:debt` para corrigir o script.

## Stop hook

Hook em `~/.claude/settings.json` detecta encerramento incompleto (PR mergeado <30 min + worktree órfão || vite vivo || control doc não arquivado) e bloqueia turno seguinte com mensagem orientando rodar o script. Solução não-disciplinar para improviso recorrente (#199).

---

## §4.4 Verificação Crítica

**Regra absoluta: toda afirmação verificável exige verificação prévia. Sem exceção.**

Aplica-se a QUALQUER conclusão sobre o estado do projeto: fluxo de dados, origem de campos, estado de branches/PRs/merges, existência de arquivos/funções/componentes, interpretação de outputs de terminal e screenshots, estado de features, compatibilidade entre componentes/hooks/CFs.

**Protocolo obrigatório (nesta ordem):**
1. Classificar: "estou prestes a afirmar algo verificável?" → Se sim, PARAR
2. Identificar a fonte de verdade (código, remote, Firestore, output direto)
3. Verificar com `grep` + `view` + `bash`, ou solicitar ao Marcio o comando
4. Cruzar com contexto existente (issue files, PROJECT.md)
5. Só então concluir

**Se o Marcio colar um output de terminal, screenshot, ou log:**
- Tratar como dado bruto, não como fato confirmado
- Cruzar com pelo menos uma fonte adicional antes de afirmar
- Se houver ambiguidade, dizer "preciso confirmar — pode rodar `<comando>`?" em vez de assumir

**Nunca inferir. Se não verificou, não afirma.** Se está incerto, diz "preciso verificar" e verifica.
