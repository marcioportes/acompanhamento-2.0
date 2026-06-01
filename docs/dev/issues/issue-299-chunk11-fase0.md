# Issue #299 — feat: CHUNK-11 Fase 0 (baseline + taxonomia + mapa de pesos)

## Autorização
- [x] Plano do épico aprovado (sessão 01/06, arquivo valiant-doodling-sunrise)
- [ ] **Mapa de pesos (`behavioral-weight-map.md`) aprovado por Marcio** ← gate desta fase
- [x] Gate Pré-Código liberado (groundwork, zero mudança de produção)

## Context
Fundação do motor unificado (Epic #298): rede de segurança (snapshot dos score/gates atuais) + SSoT de taxonomia + mapa de pesos derivado do `trader_evolution_framework.md`. Nada plugado em produção nesta fase.

## Spec
Ver #299 + Epic #298. Plano: valiant-doodling-sunrise.

## Phases (desta issue)
- A1 — `docs/dev/behavioral-weight-map.md` (memória de cálculo, derivada do framework) → **aprovação Marcio**
- A2 — `src/constants/behavioralTaxonomy.js` + mirror `functions/maturity/behavioralTaxonomyMirror.js` (encoda o mapa aprovado)
- A3 — `behavioralBaseline.snapshot.test.js` (congela score/tilt/revenge/gates atuais sobre massa Elza)
- A4 — `npm test` + build verdes; paridade taxonomia ESM≡CJS

## Sessions
- (a preencher)

## Shared Deltas
- src/version.js — v1.72.0 (reservada no main)
- docs/registry/versions.md — consumir v1.72.0 (encerramento)
- docs/registry/chunks.md — liberar CHUNK-11 (encerramento)
- CHANGELOG.md — entrada [1.72.0]

## Chunks
- CHUNK-11 (escrita)
