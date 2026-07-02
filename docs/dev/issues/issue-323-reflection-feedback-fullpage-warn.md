# Issue #323 — fix: reflexão do aluno no feedback (full-page + aviso ao mentor)

> Fast-track. Regressão/gap do #315. Sem mockup (comportamento conhecido + aviso simples).

## Autorização
- [x] Bugfix + aviso — Marcio: "se o aluno não tiver feito a reflexão quero ser avisado... é grave, forçar o hábito" (01/07/2026)
- [x] Gate Pré-Código liberado

## Context
O #315 pôs a reflexão do aluno no feedback só no branch `embedded` (bug de layout, igual #320) e, quando ausente, só um texto cinza passivo. Marcio quer: nos dois layouts + **aviso âmbar** pro mentor cobrar a reflexão quando o aluno não fez (hábito é parte do processo).

## Spec
Ver issue body no GitHub: #323.

## Phases
- A1 — `components/reviews/StudentReflectionPanel` (DRY): selfReview → `TradeReviewSection` read-only; ausente + mentor → alerta âmbar; ausente + não-mentor → null.
- A2 — usar nos dois layouts da FeedbackPage (embedded + full-page); remover inline do #315; limpar imports órfãos (TradeReviewSection, ClipboardCheck).
- A3 — teste do componente (3 ramos).

## Shared Deltas
- MAIN (commit `0b65e32e`, pushed): lock CHUNK-08 (#323) + reserva v1.80.1.

## Chunks
CHUNK-08 (Mentor Feedback). Regressão de #315.
