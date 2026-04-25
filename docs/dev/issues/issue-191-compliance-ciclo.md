# Issue #191 — fix: aderência recente (últimos N trades) no gate compliance-100 do stage Profissional

## Autorização (OBRIGATÓRIA)

- [x] Mockup dispensado — issue simples sem UI nova; anuência explícita do Marcio em 24/04/2026
- [x] Memória de cálculo apresentada e aprovada em 24/04/2026
- [x] Marcio autorizou — 24/04/2026 (capturado em sessão #815a1e1a; decisões 1–6 batidas no chat)
- [x] Gate Pré-Código liberado

## Context

O gate `compliance-100` (`>= 100`) governa a transição Metódico → Profissional (3→4) no motor de maturidade #119. Hoje, `complianceRate100` é apenas alias de `complianceRate` (linha ~126 de `functions/maturity/preComputeShapes.js`) — ou seja, o mesmo cálculo da janela padrão é reusado. Consequência: o gate aprova/reprova com base no histórico inteiro do trader, não na **aderência recente** que o nome promete. Furo é semântico (fórmula filtra a janela errada); dados existem.

## Spec

Ver issue body no GitHub: #191.

## Memória de Cálculo

### Inputs

- `trades` — coleção raiz `trades`. Filtros upstream: `studentId == aluno`, `status == 'CLOSED'`. Campos consumidos: `date` (string ISO `YYYY-MM-DD` ou BR `DD/MM/YYYY`), `hasRedFlags` (bool) e/ou `redFlags` (array).
- `plans` — coleção raiz `plans`. Filtros upstream: `studentId == aluno`. Campos consumidos: `id`, `adjustmentCycle` (`'Mensal'|'Trimestral'|'Semestral'|'Anual'` — default `'Mensal'`).
- `now` — `Date` (referência temporal para detectar ciclo ativo).
- Compliance por trade já avaliado pela camada CHUNK-05 e gravado em `hasRedFlags`/`redFlags`. Esta função apenas consome.

### Janela (decisões 1-3 aprovadas)

1. **Ciclo ativo de cada plano** = ciclo do `adjustmentCycle` que contém `now`. Construído via `getCycleStartDate`/`getCycleEndDate` (mesma derivação por datas usada em `cycleResolver.detectActiveCycle` e `planStateMachine`).
2. **Janela inicial** = união dos ranges `[cycleStart, cycleEnd]` de todos os planos do aluno.
3. **Trades qualificados** = trades CLOSED cujo `date` cai em algum range da união.
4. **Mínimo: 20 trades fechados** na janela.
5. **Fallback (volume baixo)**: se `< 20` trades, retroceder UM ciclo (mesmo `adjustmentCycle`) em CADA plano simultaneamente, recalcular união, recoletar trades. Repetir até atingir 20 ou esgotar histórico.
6. **Esgotamento**: iteração de retrocesso que não acrescenta nenhum trade novo (todos os planos sem trades naquele ciclo histórico). Cap mecânico defensivo: `MAX_LOOKBACK_CYCLES = 36`.
7. **Trader sem ciclo ativo**: se nenhum plano tem trades no ciclo que contém `now` (todos os planos só têm histórico passado), o passo 5 cobre — o primeiro retrocesso já pega o último ciclo encerrado.

### Estado "insuficiente" (decisão 4)

- Janela `< 20` mesmo após esgotar histórico → retornar `null`.
- Em `evaluateGates`, `complianceRate100 === null` cai em `met: null`, `reason: 'METRIC_UNAVAILABLE'` (vide `evaluateGates.js`):
  - **Não promove**: gate fica pendente, `gatesMet < gatesTotal` → `proposeStageTransition` não emite UP.
  - **Não rebaixa**: `detectRegressionSignal` não consome este campo (verificado).
  - DEC-020 preservada (stage não regride abaixo de baseline).

### Fórmula

Sobre os trades da janela final:

```
withFlags = trades.filter(t => t.hasRedFlags || (t.redFlags?.length > 0)).length
compliant = trades.length - withFlags
rate = (compliant / trades.length) * 100      // 0–100
```

Idêntica ao `calcComplianceRate` atual; o que muda é exclusivamente a **janela** sobre a qual se calcula.

### Threshold (decisão 5)

`>= 100` (gate compliance-100). Inalterado.

### Casos limites

- `trades` vazio → `null`.
- `plans` vazio → `null` (sem ciclo definível).
- Plano sem `adjustmentCycle` → default `'Mensal'`.
- Trade com `date` inválido → ignorado silenciosamente.
- Múltiplos planos com ciclos sobrepostos → união (trade contado uma vez por id).
- Plano arquivado/encerrado: tratado como qualquer outro plano (ciclo derivado das datas, não do status).

### Exemplo numérico (cenário B da memória aprovada)

Trader com 1 plano `Mensal`, `now = 2026-04-24`. Ciclo ativo: `2026-04-01..2026-04-30`. Trades CLOSED em abril: 12 (3 com `hasRedFlags`).

- Janela inicial: 12 trades. `< 20` → retroceder.
- Ciclo anterior: `2026-03-01..2026-03-31`. Trades em março: 18 (1 com flag).
- União: 30 trades, 4 com flag.
- `compliant = 26`; `rate = 26/30 * 100 = 86.67`.
- Gate `>= 100`: **não promove** (86.67 < 100). Estado: avaliado, abaixo do alvo.

### Cenários de teste (A–E)

- **A — Janela inicial suficiente, 100% aderente**: 1 plano `Mensal`, ciclo ativo com 25 trades, 0 com flag → `rate = 100` (gate met).
- **B — Janela inicial < 20, fallback completa**: como exemplo numérico acima → `rate = 86.67` (gate não met).
- **C — Histórico esgotado < 20**: 1 plano `Mensal`, total 8 trades em todo o histórico → `null` (gate pendente).
- **D — Múltiplos planos, ciclo ativo cobre 20**: 2 planos `Mensal`, união do ciclo atual = 22 trades, 1 com flag → `rate = 95.45`.
- **E — Trader sem trades no ciclo atual, último ciclo encerrado cobre**: 1 plano `Mensal`, ciclo atual vazio, ciclo anterior 24 trades, 0 flags → `rate = 100`.

## Phases

- F1 — Helper puro `computeCycleBasedComplianceRate` em `functions/maturity/` (CommonJS) e mirror em `src/utils/maturityEngine/` (ESM)
- F2 — Wire em `preComputeShapes.js` (functions): substituir alias linha 126 + receber `now`
- F3 — Repassar `now` em `recomputeMaturity.js`
- F4 — Testes unitários A–E em ambos os mirrors + smoke de `evaluateGates` consumindo `null`
- F5 — Bump 1.44.0 → 1.44.1 + entrada `CHANGELOG.md`

## Sessions

_(preenchido durante execução — 1 linha por task)_

## Shared Deltas

- `src/version.js` — bump 1.44.0 → 1.44.1
- `docs/registry/versions.md` — marcar 1.44.1 consumida (no encerramento §4.3)
- `docs/registry/chunks.md` — liberar CHUNK-09 (no encerramento §4.3)
- `CHANGELOG.md` — nova entrada `[1.44.1] - 24/04/2026`
- `docs/PROJECT.md` — bump versão (no encerramento §4.3)

## Decisions

- DEC-AUTO-191-01 — Janela = união de ciclos ativos por plano + fallback retroativo simultâneo
- DEC-AUTO-191-02 — Estado insuficiente = `null` (mapeia para `METRIC_UNAVAILABLE` no gate)

## Chunks

- CHUNK-09 (escrita) — alteração do motor de maturidade (preComputeShapes + helper novo)
