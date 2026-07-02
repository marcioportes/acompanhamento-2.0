# Issue #329 — feat: colapso na fila "trades a refletir"

> Follow-up do #327. Polish de UX.

## Autorização
- [x] Pedido direto de Marcio (02/07/2026): colapso quando há muitos trades pendentes
- [x] Gate Pré-Código liberado

## Context
Com import em lote, `PendingReflections` (#327) pode listar dezenas de trades sem `selfReview` — aluno pode não ter tido tempo ou decidir não refletir. Lista longa inunda o dashboard.

## Spec
- Card colapsável: header (Eye + título + contador + chevron) sempre visível; clique recolhe/expande.
- Default colapsado quando `pending.length > 8`; poucos → expandido. Toggle do usuário sobrepõe (`userToggled`).
- Corpo expandido com `max-h-72 overflow-y-auto` (não empurra a página).
- **Sem** ação de "dispensar"/rastreio de "não vou refletir" ([[feedback_aluno_responsabilidade]]) — contador segue cobrando.

## Decisions
- Estado só de UI (`useState`, sem persistência). Sem campo/collection/CF.

## Shared Deltas
- MAIN (commit `08ffec68`, pushed): lock CHUNK-02 (#329) + reserva v1.82.1.

## Chunks
CHUNK-02 (Student).
