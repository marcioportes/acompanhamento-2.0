# Issue #337 — fix: TPS fator Consistência real + composição sem duplicar tiles

## Autorização
- [x] Mockup: N/A — sem UI nova; enxugar cards existentes + trocar fonte de um número.
- [x] Memória de cálculo: apresentada no chat + abaixo. Aprovada por Marcio ("ok", 03/07/2026).
- [x] Marcio autorizou: "ok" após ver a memória.
- [x] Gate Pré-Código liberado.

## Context
Na etapa 1 do Fechamento de Ciclo (`Step1Read.jsx`), a "Nota geral do ciclo" (TPS) tem o fator
"Consistência semanal" **chumbado em 0,70** (`Step1Read.jsx:166`, TODO A5.x) — mostra número real
que não mede nada e infla o score de todo aluno. Além disso a composição (5 cards) reimprime os
tiles do bloco "Performance" logo acima. Objetivo: consistência real + composição sem duplicar.

## Spec
Ver issue body: #337.

## Memória de Cálculo
**Fator Consistência do TPS** (peso 0,15 → 15 pts).

- **Input:** `consistency.cvNormalized.value` de `useCycleConsistency` (já calculado em Step1Read:115,
  mesma SSoT do tile "CV norm."). `null` quando insuficiente (`insufficientReason`: min_days /
  no_target_rr / breakeven_plan / zero_obs_mean).
- **Mapa CV→norm 0..1** (CV centrado em ~1,0 = "no plano"; maior = mais errático):
  `consistencyNorm = clamp01((2.0 - value) / 1.0)`
  - value ≤ 1,0 → 1,0 (no plano ou mais suave = crédito total; "<0,5 suspeito" é flag de dado, não punição)
  - value = 1,5 → 0,5
  - value ≥ 2,0 → 0
  - Constante 2,0 = fronteira "muito errático" já existente em `cvTheme` (cycleMetricTiles). Sem número mágico novo.
- **Renormalização (mudança em computeTPS):** fator ausente (CV null) não recebe 0,70 fantasma
  nem 0 injusto — o TPS passa a `score = 100 * Σ(norm·peso presentes) / Σ(pesos presentes)`.
  PF e Aderência seguem obrigatórios (sem eles → score null, gate atual mantido).
- **Baseline:** nenhum (score derivado, sem estado inicial).
- **Casos limite:** ciclo curto (CV null) → renormaliza sobre 4 fatores; zero trades → early return já existe.

## Composição (UI)
Os 5 `TPSComponentCard` param de exibir `rawValue` (que já está no tile de Performance acima) —
mostram só `ptsGot/ptsMax` + barra de preenchimento (contribuição/peso). Vira "por que a nota".

## Phases
1. `tradingPerformanceScore.js` — renormalização por pesos presentes + helper de mapa CV (`cvToConsistencyNorm`).
2. `Step1Read.jsx` — feed `consistency.cvNormalized` no lugar do 0,70; enxugar cards.
3. Testes `computeTPS` (renormalização, missing) + mapa CV.

## Shared Deltas
version.js (1.82.5 + CHANGELOG), versions.md (reserva), registry/chunks.md (lock CHUNK-05) — no MAIN.

## Decisions
DEC-AUTO-337-01 — fator Consistência do TPS = CV normalizado (SSoT única) via `clamp01((2-value)/1)`;
placeholder 0,70 eliminado. DEC-AUTO-337-02 — TPS renormaliza sobre pesos presentes em vez de dar 0 a fator missing.

## Chunks
CHUNK-05 (ESCRITA — cálculo de scores).
