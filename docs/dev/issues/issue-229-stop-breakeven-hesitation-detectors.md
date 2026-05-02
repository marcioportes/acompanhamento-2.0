# Issue #229 — feat: detectar stop em breakeven prematuro + hesitação em stop pós-entrada

## Autorização

- [x] Mockup apresentado — exceção: detectores invisíveis ao aluno; UI já existe (ShadowBehaviorPanel + ExecutionPatternsPanel) e só ganha 2 linhas de copy. Marcio autorizou em sessão `01/05/2026 22:xx` ("Abra issue e ataque isso imediatamente").
- [x] Memória de cálculo apresentada — body do issue #229 detalha fórmula, tolerance, exemplos numéricos, edge cases.
- [x] Marcio autorizou — "Abra issue e ataque isso imediatamente." (sessão `01/05/2026 22:xx`, modo auto).
- [x] Gate Pré-Código liberado.

## Context

Sensor comportamental #208 cobre 5 padrões mas tem 2 gaps confirmados no código:
1. `STOP_TAMPERING` só dispara em WIDENED (`executionBehaviorEngine.js:137` `isStopWidened`) — TIGHTENED até breakeven é silencioso.
2. Reissue com mesmo preço é explicitamente ignorado (`executionBehaviorEngine.js:136` `if (prev._price === curr._price) continue;`).

Marcio (mentor) define o sintoma operacional: levar stop pra zero cedo demais é medo de perder, gatilho clássico de chasing pós-stop; reissue sem mudar preço é hesitação visível em audit-trail. Confirmado empiricamente em CSVs reais (FEV-Orders 12/02/2026: 3 stops Sell @25177.75 25177.75 25199.25 — 1 reissue no-op + 1 trail).

## Spec

Ver issue body: #229.

## Mockup

UI mínima — só copy nos painéis existentes:

```
ShadowBehaviorPanel (mentor-only)
  ⚠ Stop levado pra zero cedo
     Δt 2.3min após entry · runup 16% do alvo
     Possível medo de perder

ExecutionPatternsPanel
  • STOP_HESITATION — 3 reissues de stop sem mudar preço (143800)
```

## Memória de Cálculo

Detalhada no issue body (#229) — 2 detectores, tolerance por prefix, exemplos numéricos, edge cases. Resumo:

- `STOP_BREAKEVEN_TOO_EARLY`: stop reissue com `|stopPrice - entry| <= tolerance` E (`Δt < 5min` OU `runUpPct < 0.5 * targetPct`). Severity HIGH. Penalty 12. Entra em `TILT_EXEC_TYPES`.
- `STOP_HESITATION`: ≥2 reissues com preço idêntico (≤ 1 tick). Severity LOW. Penalty 5. Não entra em TILT.
- Tolerance: WIN=5, WDO=0.5, IND=5, MNQ/NQ/MES/ES=0.25, fallback `max(0.01, 0.0005·entry)`.

## Phases

- **F1** — Engine: detectores `detectStopBreakevenTooEarly` + `detectStopHesitation` em `executionBehaviorEngine.js` + helper `getInstrumentTolerance` + 18 unit tests.
- **F2** — Wiring: `EVENT_PENALTIES`, `TILT_EXEC_TYPES`, mirror CJS em `functions/maturity/executionBehaviorMirror.js` + 3 mirror tests + 1 fixture real.
- **F3** — UI: copy nos painéis Shadow + Execution.
- **F4** — Encerramento: CHANGELOG, suite, PR.

## Sessions

- `f1 [engine] commit pending`
- `f2 [wiring+mirror] commit pending`
- `f3 [ui] commit pending`
- `f4 [encerramento] commit pending`

## Shared Deltas

Já aplicados no MAIN (commit `3a261d16`):
- `src/version.js` — entrada 1.53.0 RESERVADA.
- `docs/registry/versions.md` — linha 1.53.0 reservada.
- `docs/registry/chunks.md` — CHUNK-06 + CHUNK-11 lock.

A aplicar no encerramento:
- `CHANGELOG.md` — nova entrada `[1.53.0] - 01/05/2026`.
- `docs/registry/versions.md` — marcar 1.53.0 consumida + PR sha.
- `docs/registry/chunks.md` — liberar CHUNK-06 + CHUNK-11.

## Decisions

- DEC-AUTO-229-01 — tolerance por prefix B3/CME + fallback `max(0.01, 0.05%·entry)`.
- DEC-AUTO-229-02 — disjunção tempo OU runup pra `STOP_BREAKEVEN_TOO_EARLY` (conservador).
- DEC-AUTO-229-03 — `STOP_HESITATION` NÃO entra em `TILT_EXEC_TYPES` (sinal sutil; só rebate em periodScore).

## Chunks

- CHUNK-06 Emotional (escrita) — `EVENT_PENALTIES` + wiring `TILT_EXEC_TYPES`.
- CHUNK-11 Behavioral Detection (escrita) — `executionBehaviorEngine.js` + mirror.
