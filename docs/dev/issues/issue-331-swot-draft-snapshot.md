# Issue #331 — fix: SWOT quebra com HTTP 400 na revisão DRAFT (frozenSnapshot null)

## Autorização
- [x] Mockup: N/A — sem UI nova (botão "Gerar SWOT" já existe); pura correção de regressão. Exceção implícita (bug fix).
- [x] Memória de cálculo: N/A — reusa `buildClientSnapshot` existente, sem fórmula nova.
- [x] Marcio autorizou: "resolve" (03/07/2026).
- [x] Gate Pré-Código liberado.

## Context
`generateWeeklySwot` retorna HTTP 400 (`failed-precondition`) ao gerar SWOT em revisão DRAFT.
Regressão do redesign v2 (#269): a revisão nasce DRAFT com `frozenSnapshot: null` (congela só no
publish), mas o botão fica habilitado em DRAFT e a CF exige `frozenSnapshot`. Objetivo: SWOT
funcional em DRAFT reusando o snapshot montado no cliente.

## Spec
Ver issue body: #331.

## Abordagem — B (client passa snapshot)
A (montar server-side) descartada: contraria `clientSnapshotBuilder.js:7-9` (engine
compliance/emotional client-only por design). B espelha `publishReview`, que já recebe
`frozenSnapshot` do cliente. Decisão técnica autônoma (DEC-AUTO-331-01).

## Phases
1. **CF** `generateWeeklySwot`: aceita `data.snapshot` opcional; `snapshot = data.snapshot ||
   review.frozenSnapshot`; planId de `snapshot?.planContext?.planId`; usa `snapshot` no
   prompt/fallback. 400 só se ambos ausentes.
2. **Hook** `useWeeklyReviews.generateSwot({ reviewId, snapshot })` — repassa snapshot à CF.
3. **Surfaces** (3): `WeeklyReviewModal`, `WeeklyReviewPage`, `ReviewToolsPanel` — `handleGenerateSwot`
   monta snapshot via builder e passa. Corrigir `rebuild*` que lê `planId` de
   `frozenSnapshot.planContext` (null em DRAFT) → ler `review.planId`. `ReviewToolsPanel` não tem
   builder hoje → adicionar (ou reusar helper).
4. **Testes**: CF (snapshot presente/ausente/fallback) + surfaces (passa snapshot no click).

## Shared Deltas
version.js (1.82.2 + CHANGELOG), versions.md (reserva), registry/chunks.md (lock CHUNK-04+08) —
editados no MAIN na abertura.

## Decisions
DEC-AUTO-331-01 — abordagem B (client passa snapshot); A rejeitada por contrariar client-trust arch.

## Chunks
CHUNK-04 (ESCRITA — review lifecycle), CHUNK-08 (ESCRITA — SWOT mentor tooling).
