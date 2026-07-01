# Issue #318 — feat: anotar ponto pra Revisão (Notas da Sessão) direto do trade

> Fast-track. Restore de comportamento conhecido (PinToReviewButton, removido no #269 v2). Mockup dispensado — referência é o componente antigo; autorização "faça um fast-track disso" (Marcio, 01/07/2026).

## Autorização
- [x] Exceção mockup/memória — restore de comportamento existente; sem cálculo novo
- [x] Marcio autorizou — "faça um fast-track disso" (01/07/2026)
- [x] Gate Pré-Código liberado

## Context
O #269 v2 Fase 6 (commit `49617c32`, v1.76.0) removeu o `PinToReviewButton`. Junto foi embora a capacidade de, a partir do trade em feedback, anexar um ponto a conversar nas Notas da Sessão (`sessionNotes`) da revisão. Marcio usa isso ao revisar trades. Este issue restaura só essa parte (append em sessionNotes) — NÃO o pin/picker/inclusão de trade (que o #269 automatizou de propósito).

## Spec
Ver issue body no GitHub: #318.

## Phases
- A1 — `useWeeklyReviews.appendSessionNote(reviewId, text)`: read-modify-write (getDoc → append `\n` → updateDoc). Não sobrescreve.
- A2 — helper puro `utils/reviewNotePrefix.fmtTradePrefix(trade)` (restore do antigo).
- A3 — `components/reviews/AddReviewNoteButton.jsx` (mentor-only): acha DRAFT aberto do `trade.planId`; se existe → popover append; senão → desabilitado ("após o 1º feedback"). NÃO cria revisão no cliente.
- A4 — wire na FeedbackPage (linha de ações do mentor).
- A5 — testes: `reviewNotePrefix` + `appendSessionNote` (append preserva prévio, no-op vazio, trim, error).

## Shared Deltas
- MAIN (commit `91d12502`, pushed): lock CHUNK-08 (#318) + reserva v1.79.0.
- `version.js` → 1.79.0 neste branch (main fica na sua reserva vigente).

## Decisions
- DEC autônoma: client-only, sem novo CF; gated em DRAFT existente pra evitar rascunho duplicado (bug do hotfix `14cca576`). Append em sessionNotes (fiel ao `appendSessionNotes` antigo), não takeaway.

## Chunks
CHUNK-08 (Mentor Feedback) — co-lock com #315. CHUNK-04 (leitura).
