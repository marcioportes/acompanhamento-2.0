# Issue 183 — fix: Plano criado por mentor não é visível pelo aluno
> **Branch:** `fix/issue-183-plan-studentid-override`
> **Milestone:** v1.43.1 (patch / fast-track Sev1)
> **Aberto em:** 24/04/2026
> **Status:** 🔵 Em andamento
> **Versão entregue:** —

---

## 1. CONTEXTO

Plano criado pelo mentor (via `AccountsPage` ou `StudentDashboard` em view-as-student) fica gravado com `studentId = mentor.uid` porque `usePlans.addPlan` (linha 141) ignora `overrideStudentId` e usa o `user` do `useAuth()`. Aluno filtra `where studentId == user.uid` → não encontra. Sev1 — bloqueante em prod.

Escopo completo no body: https://github.com/marcioportes/acompanhamento-2.0/issues/183

## 2. ACCEPTANCE CRITERIA

- [ ] `addPlan` respeita `overrideStudentId` do closure do hook
- [ ] `AccountsPage` passa studentId inferido do account selecionado
- [ ] `StudentDashboard` em view-as-student cria plano com `studentId = aluno` (coberto por teste)
- [ ] Script `issue-183-clean-orphan-plans.mjs` em dry-run lista órfãos sem escrever
- [ ] Script `--execute --confirm=SIM` faz cascade delete (movements → trades → plans)
- [ ] Log JSON persistido em `scripts/logs/`
- [ ] DebugBadge INV-04 preservado
- [ ] Baseline de testes sem regressão

## 3. ANÁLISE DE IMPACTO

| Aspecto | Detalhe |
|---------|---------|
| Collections tocadas | `plans` (delete via script), `trades` (cascade), `movements` (cascade) |
| Cloud Functions afetadas | Nenhuma — fix client-side + script admin-SDK |
| Hooks/listeners afetados | `usePlans` (addPlan); consumers: `AccountsPage`, `StudentDashboard` |
| Side-effects | Zero em runtime (fix forward). Script: delete cascata em dados órfãos |
| Blast radius | Baixo no código (fix pontual). Moderado no script (opera em prod via admin SDK) |
| Rollback | Código: revert commit. Dados deletados: sem rollback — daí dry-run obrigatório |

## 4. SESSÕES

### Sessão — 24/04/2026

**O que foi feito:**
- (em andamento)

**Decisões tomadas:**

| ID | Decisão | Justificativa |
|----|---------|---------------|
| DEC-AUTO-183-01 | Delete puro dos planos órfãos (sem remap) | Remap via `account.studentId` é heurística; mentor pode ter plano em conta própria/teste. Delete + recriar manual é mais seguro |
| DEC-AUTO-183-02 | Critério de órfão = `studentEmail == MENTOR_EMAIL` | Mentor é identificado por email fixo (`src/firebase.js:30`). Campo `studentEmail` é gravado pelo `addPlan` — filtro trivial |

**Arquivos tocados:**
- `src/hooks/usePlans.js` — aceita `overrideStudentId` em addPlan
- `src/pages/AccountsPage.jsx` — propaga studentId do account
- `src/hooks/__tests__/usePlans.addPlan.test.js` — teste novo
- `scripts/issue-183-clean-orphan-plans.mjs` — script run-once
- `src/version.js` — bump 1.43.0 → 1.43.1 (no Gate Pré-Entrega)
- `CHANGELOG.md` — entrada 1.43.1 (no Gate Pré-Entrega)

**Testes:**
- (a preencher)

**Commits:**
- `9d3a7e7c docs: lock CHUNK-03 + reservar v1.43.1 para issue-183` (no main)

**Pendências para próxima sessão:**
- Nenhuma

## 5. ENCERRAMENTO

**Status:** Em andamento

**Checklist final:**
- [ ] Acceptance criteria atendidos
- [ ] Testes passando
- [ ] Script validado em dry-run e output apresentado ao Marcio
- [ ] Script executado após autorização explícita
- [ ] PROJECT.md atualizado (DEC, CHANGELOG)
- [ ] PR aberto com `Closes #183`
- [ ] PR mergeado
- [ ] Issue fechado no GitHub
- [ ] Branch deletada
- [ ] Lock CHUNK-03 liberado em `docs/registry/chunks.md`
- [ ] Worktree removido

## 6. CHUNKS

| Chunk | Modo | Motivo |
|-------|------|--------|
| CHUNK-03 Plans | escrita | Fix em `src/hooks/usePlans.js` + `src/pages/AccountsPage.jsx` + script de cleanup |

## 7. SHARED DELTAS (aplicar no main no encerramento)

- `src/version.js` — bump 1.43.0 → 1.43.1 + entrada CHANGELOG
- `CHANGELOG.md` (raiz) — nova entrada `[1.43.1] - 24/04/2026`
- `docs/registry/versions.md` — marcar 1.43.1 consumida
- `docs/registry/chunks.md` — liberar lock CHUNK-03 da linha #183
- `docs/decisions.md` — adicionar DEC-AUTO-183-01, DEC-AUTO-183-02 (1 linha cada)
