# Issue #208 — feat: sensor comportamental de execução (Order Import → tilt/revenge no 4D)

> Plano completo (autoridade): `~/.claude/plans/noble-cooking-charm.md` (aprovado via ExitPlanMode em 29/04/2026).
> Branch: `feat/issue-208-execution-behavior-sensor`. Versão reservada: **v1.49.0**.
> Locks ativos: CHUNK-06 (Emotional, escrita), CHUNK-10 (Order Import, escrita). Leitura: CHUNK-04, CHUNK-09.

## Autorização

- [x] Plano aprovado via ExitPlanMode em 29/04/2026 (substitui mockup+memória padrão)
- [x] Memória de cálculo abaixo (5 detectores)
- [x] Mockup textual abaixo (Fase 6 — UI mínima)
- [x] Gate Pré-Código: liberado

## Context

Pipeline Order Import (CHUNK-10) hoje captura cancels mas descarta o sinal antes de chegar ao engine emocional V2 (CHUNK-06) ou aos gates do 4D (CHUNK-09). Dataset real SEM1 (3 trades + 10 ordens, 22/04/2026) confirma 3 eventos comportamentais não detectados. Issue #208 fecha o salto: extensão da fórmula `E = 0.60·periodScore + 0.25·invTilt + 0.15·invRevenge` (DEC-AUTO-119-03) com 5 eventos novos derivados de orders + trades.

## Spec

GitHub: https://github.com/marcioportes/acompanhamento-2.0/issues/208

## Memória de Cálculo

5 detectores em `executionBehaviorEngine.detectExecutionEvents({trades, orders, plans, window})` → `[{type, severity, tradeId?, orderIds[], timestamp, evidence, source}]`.

| Tipo | Trigger | Severity | Fonte | EVENT_PENALTY |
|------|---------|----------|-------|---------------|
| `STOP_TAMPERING` | stop modificado para mais largo durante vida do trade (`stopMovementAnalysis.movements[]` filtra type='WIDENED') | HIGH | Kahneman&Tversky 1979; Shefrin&Statman 1985 | 20 |
| `STOP_PARTIAL_SIZING` | `stopOrders[].qty < trade.qty` (cancel ou filled) | HIGH | Shefrin&Statman 1985; Odean 1998 | 10 |
| `RAPID_REENTRY_POST_STOP` | trade.entryTime - prevTrade.exitTime < 10min ∧ prevTrade fechou por stop ∧ mesmo side ∧ mesmo instrument | MEDIUM | Coval&Shumway 2005; Locke&Mann 2005 | 15 |
| `HESITATION_PRE_ENTRY` | order CANCELLED filterable por mesmo side+instrument seguido de FILLED em <30min | LOW | heurística (extrapolação) | 5 |
| `CHASE_REENTRY` | re-submit no mesmo side com preço pior antes do filled da entry final | LOW | Barber&Odean 2000 (agregado) | 10 |

**Inputs:**
- `trades` (collection `trades`): `{id, side, entry, exit, qty, entryTime, exitTime, planId, exitReason}`
- `orders` (collection `orders`): `{id, side, type, status, qty, price, stopPrice, submittedAt, filledAt, cancelledAt, instrument, correlatedTradeId, _events}`
- `plans` (opcional, para contexto): `{id, riskPerOperation, stopLoss}` — usado para sanity check

**Fórmula de integração (Fase 3):**
- `EVENT_PENALTIES` em `emotionalAnalysisV2.js:70-75` recebe os 5 novos.
- `calculatePeriodScore(trades, getEmotionConfig, behavioralEvents=[])` consome execution events junto com tilt/revenge events.
- `detectTiltV2(trades, getEmotionConfig, config, executionEvents=[])` — STOP_TAMPERING + STOP_PARTIAL_SIZING contam como tilt detectado.
- `detectRevengeV2(trades, getEmotionConfig, config, executionEvents=[])` — RAPID_REENTRY + CHASE_REENTRY contam como revenge detectado.

**Casos limites:**
- Sem orders correlacionadas (trade só tem dados de Performance) → 0 eventos detectáveis para esse trade. Não inflar.
- Trade legacy sem `orders.correlatedTradeId` populado → fora do escopo (cobertura nula).
- Janela de detecção < 30 trades com order data linked → métrica de gate retorna `null` (METRIC_UNAVAILABLE, padrão DEC-AUTO-187-03).
- Cancel sem fill subsequente → não emite evento (cancel pré-entry exige fill posterior para virar HESITATION).

**Exemplo numérico — fixture SEM1:**

| Trade | Detector ativado | Evidência |
|-------|------------------|-----------|
| T1 (LONG WINM26 20/04) | `STOP_PARTIAL_SIZING` | stop qty=1, entry qty=2 (ordem `…439492`) |
| T2 (SHORT WINM26 22/04) | `HESITATION_PRE_ENTRY` | cancel `…297106` 10:36 → entry `…359605` 10:55 (19min, mesmo side) |
| T3 (SHORT WINM26 22/04) | `RAPID_REENTRY_POST_STOP` | T2 stop bateu 11:00:52 → T3 entry 11:07:52 (7min < 10min, mesmo side, mesmo instrument) |

Output esperado: 3 eventos com `severity` e `source` corretos, demais eventos (STOP_TAMPERING, CHASE_REENTRY) ausentes neste dataset.

## Mockup (Fase 6)

### TradeDetailModal — seção "Padrões de execução detectados" (read-only)

Após "Histórico de correções (N)" (#188), nova seção colapsável:

```
┌─ Padrões de execução · 2 detectados ───────────────┐
│                                                     │
│ [HIGH] Stop dimensionado para meio lote             │
│   Stop qty=1 enquanto entrada/alvo qty=2             │
│   Fonte: Shefrin & Statman 1985 (disposition)        │
│   Ordem: NLGC...439492                               │
│                                                     │
│ [LOW] Hesitação pré-entrada                          │
│   Ordem cancelada 19min antes da entrada efetiva     │
│   Fonte: heurística operacional                      │
│   Ordens: NLGC...297106 → NLGC...359605              │
└─────────────────────────────────────────────────────┘
```

- Severity badge colorido (HIGH=red, MEDIUM=amber, LOW=slate)
- Tooltip com timestamps + ordens envolvidas + paper completo
- Vazio: seção não renderiza

### MaturityProgressionCard — gates novos (Fase 4)

Os 3 gates (`no-stop-tampering`, `no-chase`, `disciplined-sizing`) aparecem automaticamente em Stage 3→4 — UI já é dirigida por `constants.js`. Sem código novo, só tooltip do gate cita o paper:

```
Gate: Sem stop tampering
Status: ✓ atendido (0 eventos em 87 trades)
Fonte: Kahneman & Tversky (1979) — loss aversion
       Shefrin & Statman (1985) — disposition effect
```

## Phases

- 1 — Fix correlator N:1 (`orderCorrelation.js`) → resolve "ghost orders" falsos
- 2 — Sensor comportamental (`executionBehaviorEngine.js` + mirror) — 5 detectores + testes (fixture SEM1)
- 3 — Integração `emotionalAnalysisV2` (`EVENT_PENALTIES` + `executionEvents` em detectTilt/Revenge + mirror)
- 4 — Gates Stage 3→4 condicionais (constants.js + evaluateMaturity.js + mirror)
- 5 — Persistência: Opção C (compute on-the-fly, sem schema novo) — INV-15 não acionada
- 6 — UI mínima (TradeDetailModal seção + MaturityProgressionCard tooltip)
- 7 — Encerramento (DEC-AUTO-208-01..03 + CHANGELOG + version bump v1.49.0)

## Sessions

_(preencher conforme execução)_

## Shared Deltas

- `src/version.js` — finalizar entrada v1.49.0 (encerramento)
- `docs/registry/versions.md` — marcar v1.49.0 consumida (encerramento)
- `docs/registry/chunks.md` — liberar CHUNK-06 + CHUNK-10 (encerramento)
- `CHANGELOG.md` — nova entrada `[1.49.0] - DD/MM/2026 · #208 · PR #XXX`
- `docs/decisions.md` — DEC-AUTO-208-01 (taxonomia eventos), DEC-AUTO-208-02 (Opção C persistência), DEC-AUTO-208-03 (gates condicionais)
- `docs/firestore-schema.md` — sem mudança (Opção C: compute on-the-fly)

## Decisions

- DEC-AUTO-208-01 — taxonomia dos 5 eventos + fontes literárias declaradas
- DEC-AUTO-208-02 — persistência Opção C (compute on-the-fly em `recomputeMaturity`, sem campo Firestore novo)
- DEC-AUTO-208-03 — gates Stage 3→4 condicionais (`null`/METRIC_UNAVAILABLE quando <30 trades com order data, padrão DEC-AUTO-187-03)
- DEC-AUTO-208-04 (eventual) — pesos `EVENT_PENALTIES` (5/10/15/10/20) calibração inicial heurística, validação empírica obrigatória 90 dias

## Chunks

- CHUNK-06 (Emotional Analysis) — escrita: `EVENT_PENALTIES` + parâmetro `executionEvents` em detectTilt/Revenge + mirror
- CHUNK-10 (Order Import) — escrita: correlator N:1 + sensor `executionBehaviorEngine.js`
- CHUNK-04 (Trade Ledger) — leitura: trades como input do sensor
- CHUNK-09 (Maturity) — escrita greenfield em gates novos: 3 entradas em `GATES_BY_TRANSITION['3-4']` + métricas em `evaluateMaturity.js`

## Riscos declarados

- `HESITATION_PRE_ENTRY` é heurística sem paper direto — calibração via taxa em produção
- Janelas (10min/30min) são heurísticas — calibrar empiricamente
- `EVENT_PENALTIES` não derivam de literatura — design, ajustar conforme dados reais
- Gates novos ficam pendentes (`null`) até evidência empírica de calibração — não promovem, não rebaixam (DEC-020 preservada)
