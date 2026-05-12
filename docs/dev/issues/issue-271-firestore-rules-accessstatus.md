# Issue #271 — fix: regra Firestore bloqueia activateStudent — accessStatus fora da allowlist

## Autorização

- [x] Mockup — exceção (fix de regra/auth, sem UI nova)
- [x] Memória de cálculo — exceção (sem fórmula, mudança de allowlist + idempotência)
- [x] Marcio autorizou — "siga" (12/05/2026, após diagnóstico apresentado em chat)
- [x] Gate Pré-Código liberado

## Context

Continuação do #270 (v1.61.2). Hotfix reordenou `getAccessStatus` priorizando `firstLoginAt`, mas o sintoma persistiu em prod porque os docs estão com `firstLoginAt: null` mesmo após login real.

Causa raiz real: a regra do Firestore em `firestore.rules:42-47` permite ao aluno (`isOwner`) atualizar apenas `['status', 'firstLoginAt', 'onboardingStatus']`. `AuthContext.activateStudent` tenta escrever 3 campos incluindo `accessStatus: 'active'` — fora da allowlist. Regra rejeita o update inteiro; o `catch` faz `console.error` e engole. Nada é gravado.

Regressão silenciosa do DEC-AUTO-263-07 — campo `accessStatus` adicionado no cliente sem propagar para a regra.

## Spec

Ver issue body no GitHub: #271.

## Phases

- A1 — `firestore.rules` adicionar `'accessStatus'` na allowlist (linha 45)
- A2 — `AuthContext.activateStudent` guard idempotente (`accessStatus !== 'active'` em vez de `status === 'pending'`) nos dois callers
- A3 — teste de regressão (mock do `updateDoc` confirmando os 3 campos enviados)
- B1 — `functions/scripts/sync-access-from-auth.js` (backfill via service account)
- C1 — bump v1.61.3 + CHANGELOG
- D1 — PR + merge + deploy rules + run backfill em prod

## Sessions

_(preencher conforme avança)_

## Shared Deltas

- `src/version.js` — bump v1.61.3
- `docs/registry/versions.md` — marcar v1.61.3 consumida (no encerramento)
- `docs/registry/chunks.md` — liberar CHUNK-01 + CHUNK-02 (no encerramento)
- `CHANGELOG.md` — nova entrada `[1.61.3] - 12/05/2026 · #271`

## Decisions

- DEC-AUTO-271-01 — allowlist do `isOwner` em `firestore.rules` inclui `accessStatus` (propaga DEC-AUTO-263-07 para a regra)
- DEC-AUTO-271-02 — `activateStudent` idempotente baseado em `accessStatus !== 'active'` (não em `status === 'pending'`)

## Chunks

- CHUNK-01 (Auth) — ESCRITA: `firestore.rules` + `AuthContext.activateStudent`
- CHUNK-02 (Student) — ESCRITA: data shape via rules + backfill em `/students`
