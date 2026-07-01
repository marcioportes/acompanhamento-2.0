# Issue #320 — fix: botão 'Anotar ponto pra revisão' faltando no layout full-page

> Fast-track. Regressão de layout do #318. Sem mockup/memória (placement fix).

## Autorização
- [x] Bugfix de placement — Marcio reportou "não vejo nada no feedback dela" (01/07/2026)
- [x] Gate Pré-Código liberado

## Context
O #318 adicionou `AddReviewNoteButton` só no branch `embedded` da FeedbackPage. O layout full-page (standalone, `return` ~805) tem seu próprio bloco `{userIsMentor && (...)}` no header, que ficou sem o botão. O `PinToReviewButton` original aparecia nos dois layouts. Mentor no full-page não via nada.

## Spec
Ver issue body no GitHub: #320.

## Phases
- A1 — `<AddReviewNoteButton trade={trade} />` no bloco de mentor do layout full-page (após 'Recalcular Comportamento'). Import já existe (do #318).

## Shared Deltas
- MAIN (commit `4f9dcc86`, pushed): lock CHUNK-08 (#320) + reserva v1.79.1.

## Decisions
- Sem teste dedicado de FeedbackPage (componente pesado; a lógica do AddReviewNoteButton já é testada no #318). Placement validado por build.

## Chunks
CHUNK-08 — co-lock com #315.
