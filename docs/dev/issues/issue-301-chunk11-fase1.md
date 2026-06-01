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
- (a preencher)

## Shared Deltas
- src/version.js — v1.73.0 (reservada no main)
- docs/registry/versions.md — consumir v1.73.0 (encerramento)
- docs/registry/chunks.md — liberar CHUNK-11 (encerramento)
- CHANGELOG.md — entrada [1.73.0]

## Chunks
- CHUNK-11 (escrita)
