# Issue #305 — feat: CHUNK-11 Fase 2 (pesos do framework no 4D + gates + clearing)

## Autorização
- [x] Épico #298 aprovado; mapa de pesos `docs/dev/behavioral-weight-map.md` APROVADO (01/06/2026)
- [x] Desenho da implementação aprovado por Marcio (04/06/2026)

## Context
Pós-#301 o `behaviorProfile` é display-only — não pesa no 4D/gates. Hoje só E consome findings (EVENT_PENALTIES ad-hoc); F e O não. Liga os pesos do framework + `ruleViolationRate` gates + clearing estendido. **Promoção via competência (base) + modulação rolling + gates** (não punitivo cego).

## Spec
`docs/dev/behavioral-weight-map.md` (binding) + `trader_evolution_framework.md` §5/§9. Decisões aprovadas no mapa (NÃO re-litigar): F/O pesam; positivos bônus; faixas §5.3 viram gates. Números calibram aqui sobre baseline #299.

## Phases
- A — `scoreWeight`/`dimensions` na taxonomia (`behavioralTaxonomy.js` + mirror) + helper puro de agregação `behaviorProfile.families` → penalidade/bônus por dimensão + `ruleViolationRate` (cap por dimensão/janela; respeita clearing). Testado.
- B — wire em `computeEmotional`/`computeFinancial`/`computeOperational` (subtrai penalidade capada; E migra) + `ruleViolationRate` em `evaluateMaturity` + gates novos (1→2 ≤0.30 · 2→3 ≤0.15 · 3→4 ≤0.05 · 4→5 ≤0.01); counts==0 leem `gateInputs`.
- C — clearing estendido: chave `canonicalCode:tradeId` (espelha `effectiveEmotionalEventsForPeriod`) + UI BehaviorPanel.
- D — re-baseline snapshot #299 + calibração dos números.

## Sessions
- `A commit 20843798 ok` — helper behaviorWeights (agregação→penalidade/bônus/rate), ESM+CJS+paridade, 8 testes
- `B1 commit dd352c80 ok` — modulação F/O + métrica ruleViolationRate em evaluateMaturity; baseline intacta (vida nova)
- `B2 commit af8846ed ok` — 4 gates de ruleViolationRate + re-baseline (gatesTotal +1/transição); maturidade 327/327
- `C commit 7d742bfd ok` — clearing estendido na UI (FamilyCard dispensar/restaurar, chave canonicalCode:tradeId)
- `D commit f8b33733 ok` — calibração rate-normalized (count-absoluto saturava); números no behavioral-weight-map; 329/329
- **E (migração do Emocional) NÃO entrou** — deferido pra issue própria (fast-follow): maior blast-radius (CHUNK-06/display emocional). E já penaliza comportamento hoje via EVENT_PENALTIES ad-hoc; sem double-count com o novo. Ver DEC-AUTO-305-02.

## Shared Deltas
- src/version.js — v1.74.0 (reservada no main)
- registry/versions.md + chunks.md — consumir/liberar no encerramento
- CHANGELOG.md — entrada [1.74.0]
- behavioral-weight-map.md — atualizar com números calibrados (Fase D)

## Decisions
- (a registrar: escala A/M/B final; estratégia de cap; chave de clearing comportamental)

## Chunks
- CHUNK-09 (escrita) · CHUNK-11 (escrita) · CHUNK-06 (escrita) · CHUNK-08 (escrita) · CHUNK-04 (escrita) · CHUNK-03 (leitura)
