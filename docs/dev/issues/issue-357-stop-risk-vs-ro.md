# Issue #357 — fix: STOP_PANIC acusa pânico em operação dentro do risco

## Autorização (OBRIGATÓRIA — sem isto é PROIBIDO iniciar desenvolvimento)

**Status atual do documento:**
- [x] Mockup apresentado — 3 estados do `BehaviorPanel` no corpo do issue
- [x] Memória de cálculo apresentada — fórmula + exemplo numérico validado contra produção
- [x] Marcio autorizou — 19/08/2026: "ganância está correto, ataca o #357"
- [x] Gate Pré-Código liberado (A–F)
- [ ] **Gate humano separado — G (recompute histórico):** escrita em massa em produção, exige dry-run + aprovação

## Context

`STOP_PANIC / HIGH` disparou num trade que ficou a metade do RO durante toda a operação (risco real R$ 127,01 contra RO de R$ 252,00), contradizendo a emoção declarada ("Calmo") e travando progressão de estágio. Três causas somadas: pernas paralelas de brackets distintos lidas como movimento de stop; premissa de que mover stop é sinal por si só; e `CLEAN_EXECUTION` decidido antes da fusão das fontes, sem ver as detecções de events.

Regra nova definida por Marcio: alerta é **valor financeiro do risco > RO do plano**, composto por perna. Mais um detector de **cobertura** — contrato aberto sem stop é alerta alto (cisne negro).

## Spec

Ver issue body no GitHub: #357 — inclui memória de cálculo e mockup dos 3 estados.

## Cadeia de mapeamento (levantada antes de codar)

```
executionBehaviorEngine (ESM)  →  EVENT_TYPES.*
   espelho CJS: functions/maturity/executionBehaviorMirror.js
                     ↓  LEGACY_CODE_ALIAS
behavioralTaxonomy (ESM: src/constants/behavioralTaxonomy.js)
   espelho CJS: functions/maturity/behavioralTaxonomyMirror.js
                     ↓  canonicalCode + valence + emotionMapping + feedsGates
buildBehaviorProfile  →  funde events + shadow  →  trade.behaviorProfile
                     ↓
BehaviorPanel + behaviorDisplay (labels/copy)  ·  behaviorWeights (gates/score)
```

Hoje: `STOP_TAMPERING → STOP_PANIC` e `STOP_PARTIAL_SIZING → SUB_SIZING`. O segundo já é semanticamente errado — cobertura parcial de stop não é subdimensionamento (`SUB_SIZING` = "risco real muito abaixo do RO").

**Inputs já disponíveis, nada novo em persistência (INV-15 não se aplica):** `trade.planRoPct` e `trade.planPl` são anexados ao trade por `buildBehaviorProfile:145-149` antes do `detectBehavior`; `trade.tickerRule`, `orders.stopPrice`, `orders.isStopOrder`, `orders.quantity` já existem.

## Phases

- **A** — taxonomia: 3 famílias novas (`RISK_OVER_RO` negativa/gate/Ganância, `UNPROTECTED_SIZE` negativa/gate, `SIZING_DISCIPLINE` positiva/Disciplina) nos dois espelhos
- **B** — `detectStopTampering` → `detectRiskOverRo`: gatilho vira risco financeiro vs RO, composição por perna; pernas vivas em paralelo nunca comparadas como movimento
- **C** — `detectPartialSizing` → `detectUnprotectedSize`: passa a cobrir o caso de **zero stops** (hoje `if (!stops.length) return []` deixa passar posição totalmente descoberta) e remapeia para `UNPROTECTED_SIZE`
- **D** — `SIZING_DISCIPLINE`: aumento de posição com risco final dentro do RO
- **E** — reconciliação em `buildBehaviorProfile`: `CLEAN_EXECUTION` cai se sobrar família negativa após a fusão
- **F** — marcação de posição descoberta no `PlanLedgerExtract`
- **G** — recompute do `behaviorProfile` histórico + destrave de gates (**gate humano**)
- **T** — testes nos dois lados (ESM + mirror CJS), com o trade real de 18/08 como fixture

## Sessions

_(1 linha por task)_

## Shared Deltas

- `src/version.js` — bump v1.83.9
- `docs/registry/versions.md` — marcar v1.83.9 consumida
- `docs/registry/chunks.md` — liberar CHUNK-11
- `CHANGELOG.md` — nova entrada `[1.83.9]`
- `docs/PROJECT.md` — bump + parágrafo de encerramento
- **Deploy de CF obrigatório** — `functions/` muda (mirrors + buildBehaviorProfile)

## Decisions

- DEC-AUTO-357-01 — gatilho de alerta de stop vira valor financeiro vs RO; movimento de preço deixa de ser sinal
- DEC-AUTO-357-02 — composição por perna (cada entrada pode trazer OCO próprio)
- DEC-AUTO-357-03 — `RISK_OVER_RO` mapeia para Ganância, não Pânico (indisciplina de risco ≠ pânico)
- DEC-AUTO-357-04 — `CLEAN_EXECUTION` reavaliado pós-fusão, não dentro do detector shadow

## Chunks

| Chunk | Modo | Motivo |
|-------|------|--------|
| CHUNK-11 | escrita | detectores, taxonomia, espelhos, buildBehaviorProfile |
| CHUNK-04 | leitura | consome `trade.qty`, `_partials`, `tickerRule`; não altera |
