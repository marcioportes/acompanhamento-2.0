# Issue #301 — feat: CHUNK-11 Fase 1 (motor unificado dark/compat)

## Autorização
- [x] Plano do épico aprovado (valiant-doodling-sunrise); Fase 0 mergeada (PR #300)
- [x] Gate Pré-Código liberado (dark — nada plugado em produção)

## Context
Constrói `detectBehavior` (motor único) reusando os detectores existentes, emitindo código canônico + legado (dual-emit). Deve reproduzir os 4 caminhos atuais e passar o baseline (#299) + paridade ESM≡CJS. Zero consumidor novo em produção.

## Spec
Ver #301 + Epic #298. Taxonomia: `src/constants/behavioralTaxonomy.js` (Fase 0).

## Phases (desta issue)
- A1 — `src/utils/behavioralDetection/index.js`: `detectBehavior` — caminho `events` (wrap `detectExecutionEvents` → canônico+legacyCode), guardado pelo baseline #299
- A2 — `byTrade` (wrap `analyzeShadowForTrade`) + `aggregates` (scoreInputs/gateInputs/byFamily)
- A3 — mirror CJS `functions/maturity/behavioralDetectionMirror.js` + teste de paridade
- A4 — baseline #299 inalterado; suíte + build verdes; nada plugado

## Sessions
- `A1 [events dual-emit] commit 64488685 ok` — wrap detectExecutionEvents, baseline #299 intacto (5 testes)
- `A2 [byTrade+aggregates] commit 3c52320f ok` — shadow ESM-only + scoreInputs/byFamily/gateInputs; dedupeByFamily puro testado (13 testes)
- `A3 [mirror CJS + paridade] commit d988536e ok` — behavioralDetectionMirror (events+scoreInputs+dedupe); paridade ESM≡CJS (6 testes)
- `A4 [verificação] ok` — suíte 3378/3378, build verde, baseline #299 intacto, motor dark (zero consumidor de produção)

## Shared Deltas
- src/version.js — v1.73.0 (reservada no main)
- docs/registry/versions.md — consumir v1.73.0 (encerramento)
- docs/registry/chunks.md — liberar CHUNK-11 (encerramento)
- CHANGELOG.md — entrada [1.73.0]

## Decisions
- DEC-AUTO-301-01 — shadow (byTrade) é ESM-only; sem mirror CJS (maturidade server-side não consome shadow per-trade). Paridade ESM≡CJS cobre só a superfície compartilhada (events + scoreInputs). Aprovado por Marcio 01/06/2026.
- DEC-AUTO-301-02 — byFamily colapsa por (tradeId, family); precedência DEC-074 (maior resolutionLayer; empate→events). Confirmado por Marcio 01/06/2026.

## Chunks
- CHUNK-11 (escrita)
