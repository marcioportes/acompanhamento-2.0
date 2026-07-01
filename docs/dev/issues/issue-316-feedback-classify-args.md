# Issue #316 — fix: mentor não consegue dar feedback (classifyStudent com args trocados)

> HOTFIX de regressão em prod. Mockup/memória de cálculo dispensados (bugfix, autorização "go" do Marcio em 01/07/2026).

## Autorização
- [x] Exceção mockup/memória — bugfix, não há UI/cálculo novo
- [x] Marcio autorizou — "go, segue com o hotfix por cima do #315" (01/07/2026)
- [x] Gate Pré-Código liberado

## Context
Regressão da #269 (v1.76.0): todo mentor recebe `Feedback disponível apenas para alunos Alpha ou Trial-Alpha` ao tentar dar feedback, **para qualquer aluno**. Causa: o gate `assertStudentInReviewScope` (`useTrades.js:46`) chama a versão FRONT de `classifyStudent`, cuja assinatura é `(_student, subs)`, com **1 argumento só** (padrão copiado do backend, que é `(subs)`). As subs caem em `_student`; `subs` fica `undefined` → sempre retorna `null` → gate bloqueia todos. Afeta `addFeedbackComment` (:481) e `addBulkFeedback` (:556).

## Spec
Ver issue body no GitHub: #316.

## Phases
- A1 — Fix da chamada em `useTrades.js:46` (passar subs como 2º arg).
- A2 — Trazer `useTrades.test.js` (untracked, coverage da #269) pro commit.
- A3 — Teste de regressão `useTrades.reviewScope.test.js` com `classifyStudent` REAL (validado: fica vermelho sem o fix).
- A4 — Bump `version.js` → 1.77.1.

## Shared Deltas
- MAIN (commit `907e8a0d`): lock CHUNK-04+08 (#316) em `registry/chunks.md` + reserva v1.77.1 em `registry/versions.md`.
- `version.js` do main permanece 1.78.0 (ponteiro reserva #315); bump 1.77.1 vive só neste branch.

## Decisions
- Nenhuma DEC nova. Bug puramente mecânico (args).

## Chunks
CHUNK-08 (Mentor Feedback), CHUNK-04 (Trade Ledger). Co-lock com #315 — coordenar ordem de merge.
