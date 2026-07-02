# Issue #327 — feat: fila "trades a refletir"

> Follow-up (2) do #325. Marcio escolheu **2b** (fila + contador).

## Autorização
- [x] Escolha de produto de Marcio: "2b" (01/07/2026)
- [x] Gate Pré-Código liberado

## Context
Só o registro manual dispara reflexão (#313). Importados/pulados ficam sem `selfReview` e sem forma de refletir depois. Objetivo: forçar o hábito. Aluno carrega a responsabilidade ([[feedback_aluno_responsabilidade]] — apresenta e cobra, sem rastrear "fez X").

## Spec
Ver issue body #327.

## Phases
- A (2a base) — `TradeDetailModal` aceita `onSubmitReview`; `<TradeReviewSection>` (linha 465) editável com gate `!isMentor && onSubmitReview && result != null` (já refletido → read-only; aberto → null). Reverte a decisão read-only do #308 pro próprio aluno.
- B (wire) — `onSubmitReview` no TradeDetailModal do StudentDashboard (supresso em View-As) e TradesJournal (journal do próprio aluno).
- C (fila) — novo `PendingReflections` (espelha `PendingTakeaways`), card no StudentDashboard perto do PendingTakeaways; suprimido em View-As; abre trade via `setViewingTrade`.
- D (testes) — PendingReflections (9), TradeDetailModal gate (4).

## Memória de cálculo (contador)
N = `trades.filter(t => t.result != null && !t.selfReview)`, escopo uid + planId da ContextBar quando definido. `result 0` (breakeven) conta; `result null` (aberto) não. N=0 → card oculto.

## Shared Deltas
- MAIN (commit `e70892fa`, pushed): lock CHUNK-02+04 (#327) + reserva v1.82.0.

## Decisions
- Sem campo/collection novo. Escreve `trade.selfReview` via `submitTradeReview` (gateway #308). INV-15 não dispara. Sem CF → sem deploy.

## Chunks
CHUNK-02 (Student), CHUNK-04 (Trade Ledger).
