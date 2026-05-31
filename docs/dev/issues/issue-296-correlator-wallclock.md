# Issue #296 — fix: correlator tz-cego (import de ordens pede plano retroativo / duplica)

## Autorização
- [x] Mockup — N/A (sem UI; lógica de correlação)
- [x] Memória de cálculo — N/A (sem fórmula nova; comparação de tempo wall-clock)
- [x] Marcio autorizou — 31/05/2026 "resolve o bug"
- [x] Gate Pré-Código liberado

## Context
Orders.csv de trades já existentes (criados via Performance.csv) dispara "Criar plano retroativo" + duplica. Correlator compara naive (ordem) vs absoluto (trade c/ offset desde #285/#292); janela 5min; trades em ET ficam 1h fora → não casam → toCreate → gate.

## Spec
Ver #296. Fix = comparar wall-clock vs wall-clock no correlator.

## Phases
- A1 — helper `toWallMs` em orderCorrelation.js (extrai YYYY-MM-DDTHH:MM:SS, parseia UTC; fallback toMs)
- A2 — aplicar em correlateOrder / correlateOrders / correlateCancelledOrders (só comparações de tempo)
- A3 — teste de regressão (fixture Elza ou sintético): 59/59 com trades ET
- A4 — suite correlator verde + build

## Sessions
- (a preencher)

## Shared Deltas
- src/version.js — v1.71.1 (reservada no main)
- docs/registry/versions.md — consumir v1.71.1 (encerramento)
- docs/registry/chunks.md — liberar CHUNK-10 (encerramento)
- CHANGELOG.md — entrada [1.71.1] (encerramento)

## Decisions
- (nenhuma DEC-AUTO prevista)

## Chunks
- CHUNK-10 (escrita) — orderCorrelation.js
