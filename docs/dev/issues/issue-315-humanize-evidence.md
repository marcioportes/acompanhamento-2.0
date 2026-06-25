# Issue #315 — feat: Evidência técnica do BehaviorPanel visível só pro mentor

> Template enxuto (R4). Fast-track autorizado por Marcio (25/06/2026).

## Autorização

**Status atual do documento:**
- [x] Mockup — N/A (esconde elemento existente; sem UI nova)
- [x] Memória de cálculo — N/A (sem fórmula)
- [x] Marcio autorizou — 25/06/2026 "rebaixa pra opção 1, ajusta o escopo da issue, só mentor vê"
- [x] Gate Pré-Código liberado

## Context

O accordion "Evidência técnica" do `BehaviorPanel` despeja campos crus do schema do
motor (`intervalMinutes`, `actualRR: 0.11538…`, `hiddenRrInflation`). Painel colapsado,
atrás da narrativa que já é humanizada. Avaliação de ROI (25/06): humanizar o universo
de campos é over-engineering com cauda de manutenção num epic ativo (CHUNK-11).
**Decisão:** evidência crua vira mentor-only; aluno fica só com a narrativa.

## Spec
Ver issue body no GitHub: #315.

## Mockup
N/A — esconde bloco existente do aluno. Sem layout novo.

## Memória de Cálculo
N/A.

## Phases
- A1 — Testes (INV-05): aluno NÃO vê "Evidência técnica" ao expandir; mentor vê
- A2 — `BehaviorPanel.jsx`: gate do bloco atrás de `isMentor`; `UndersizedBody` recebe e gateia `isMentor`; atualizar comentário de cabeçalho

## Sessions
- _(a preencher)_

## Shared Deltas
- `src/version.js` — bump v1.78.0 (reservado no main)
- `docs/registry/versions.md` — marcar v1.78.0 consumida (no encerramento)
- `docs/registry/chunks.md` — liberar CHUNK-11 (no encerramento)
- `CHANGELOG.md` — nova entrada `[1.78.0] - 25/06/2026`

## Decisions
- _(a preencher se houver DEC-AUTO)_

## Chunks
- CHUNK-11 (escrita) — display do `trade.behaviorProfile`
