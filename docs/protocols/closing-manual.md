# Protocolo §4.3 — Encerramento Manual (Recovery)

> **Quando usar:** apenas se `scripts/cc-close-issue.sh NNN` falhar. Logar motivo no PR.
> Cópia do §4.3 5a-5d original (pré-#199) preservada como caminho de recuperação.

---

## Pré-condições

- PR para #NNN mergeado em main
- Issue #NNN com state=CLOSED no GitHub
- cwd no repo root, branch `main` com pull recente

## Sequência (não pular passos)

### 0a. Gate de Cloud Functions deploy (issues #225/#233)

Se o squash do PR tocou `functions/`, rodar `firebase deploy --only functions` antes de prosseguir. Recovery manual não usa o marker `.cf-deployed-${PR}` — o operador é o próprio juiz da paridade prod↔main. Esquecer este passo = casos #211/#210/#221 (CF mergeada fora de prod).

> **Diferença do flow normal (`cc-close-issue.sh`):** desde #233 o script auto-deploya. Recovery manual é por definição operador-dirigido, então o deploy fica explícito aqui.

### 1. Atualizar `docs/dev/issues/issue-NNN-*.md`
Resumo do que foi feito, decisões DEC-xxx, arquivos tocados, comandos git executados, testes rodados, pendências.

### 2. Atualizar shared docs

- `docs/PROJECT.md` — nova entrada na tabela de versões (formato Fase 2 do plano #199)
- `CHANGELOG.md` — entrada ≤8 linhas formato Fase 2
- `src/version.js` — linha CHANGELOG inline + bump constante (se PR_TYPE toca produto: fix, feat, debt, arch — não para refactor/docs)
- `docs/registry/versions.md` — marcar versão consumida com `(PR #NNN squash <sha>)`
- `docs/registry/chunks.md` — liberar locks da sessão
- `docs/decisions.md` — append DECs aprovadas

### 2.6. Cross-check anti-órfã DEC (issue #225)

Antes do `git rm` do control doc: para cada `DEC-AUTO-NNN-XX` mencionada em PR body, issue body ou `CHANGELOG.md`, conferir que existe linha correspondente em `docs/decisions.md`. Append manual no formato `- **DEC-AUTO-NNN-XX** (DD/MM/YYYY): <texto>.` se faltar. Sem isso a SSoT canônica de decisões fica corrompida (caso histórico: #221 → DECs órfãs detectadas em #225).

### 3. Commit deltas + push

```bash
git add docs/PROJECT.md CHANGELOG.md src/version.js docs/registry/ docs/decisions.md
git rm docs/dev/issues/issue-NNN-*.md
git commit -m "docs: encerramento #NNN vX.Y.Z — <resumo>"
git push origin main
```

### 4. Liberar locks de chunks
Já feito no passo 2. Confirmar `docs/registry/chunks.md` não tem mais linha do issue.

### 5. Encerrar infra autônoma + remover worktree

Ordem obrigatória (cada etapa cobre um resíduo distinto — pular qualquer uma deixa zumbi):

**5a.** Matar dev servers em background (cache `.vite` recria diretório se vite estiver vivo durante o `rm -rf`):
```bash
pkill -9 -f vite || true
```

**5b.** Encerrar listener tmux + watchdog + remover worktree via script canônico:
```bash
./scripts/cc-worktree-stop.sh NNN
```
O script faz, nesta ordem: (i) lê `.cc-mailbox/.watchdog-pid` e mata o watchdog (issue #178); (ii) `tmux kill-session -t cc-NNN`; (iii) `git worktree remove`. **Sempre rodar este script — não fazer `git worktree remove` manual**, senão tmux + watchdog ficam órfãos no host.

**5c.** Remover diretório físico residual (`git worktree remove` desregistra do git mas pode deixar arquivos):
```bash
rm -rf ~/projects/issue-NNN
```

**5d.** Verificação obrigatória (todos devem passar):
```bash
ls ~/projects/                                          # issue-NNN NÃO deve aparecer
git worktree list                                       # apenas main
tmux ls 2>&1 | grep -v "cc-NNN"                         # nenhuma sessão cc-NNN
pgrep -f "cc-watchdog.*NNN"                             # vazio
```
Se `issue-NNN` ainda aparecer no `ls`, o `rm -rf` não foi executado — executar agora. Se `cc-NNN` aparecer no `tmux ls` ou watchdog ainda no `ps`, o script 5b não rodou ou falhou — investigar antes de prosseguir.

### 6. Branch local

```bash
git branch -D fix/issue-NNN-* feat/issue-NNN-* debt/issue-NNN-* refactor/issue-NNN-* 2>/dev/null
```

---

## §4.4 Verificação Crítica (mantida)

**Regra absoluta: toda afirmação verificável exige verificação prévia. Sem exceção.**

Aplica-se a QUALQUER conclusão sobre o estado do projeto, incluindo:
- Fluxo de dados, origem de campos, estrutura de collections
- Estado de branches, PRs, merges, deploys
- Existência ou ausência de arquivos, funções, componentes, campos
- Interpretação de outputs de terminal (git, npm, firebase, logs)
- Interpretação de screenshots, erros, stack traces
- Estado de features (implementado, pendente, quebrado)
- Compatibilidade entre componentes, hooks, CFs

**Protocolo obrigatório (nesta ordem):**
1. Classificar: "estou prestes a afirmar algo verificável?" → Se sim, PARAR
2. Identificar a fonte de verdade (código, remote, Firestore, output direto)
3. Verificar com `grep` + `view` + `bash`, ou solicitar ao Marcio o comando de verificação
4. Cruzar com contexto existente (issue files, instruções de integração, PROJECT.md)
5. Só então concluir

**Se o Marcio colar um output de terminal, screenshot, ou log:**
- Tratar como dado bruto, não como fato confirmado
- Cruzar com pelo menos uma fonte adicional antes de afirmar
- Se houver ambiguidade, dizer "preciso confirmar — pode rodar `<comando>`?" em vez de assumir

**Nunca inferir. Se não verificou, não afirma.** Se está incerto, diz "preciso verificar" e verifica. Não existe output trivial — todo dado verificável passa pelo protocolo.
