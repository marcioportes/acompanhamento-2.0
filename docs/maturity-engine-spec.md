# Maturity Engine — Spec Técnica

> SSoT para fórmulas, gates, schema e decisões antecipadas do motor de progressão Maturidade 4D × 5 estágios.
> Migrado de `docs/dev/archive/2026-Q2/issue-119-maturidade-engine.md` (refactor #199).
> **Implementação:** `src/utils/maturityEngine/` + `functions/maturity/`. Versão atual: 1.46.0 (com mirror CommonJS de emotional, #189).

---

## Diretriz inegociável

**"O aluno precisa ver evolução, mesmo que negativa."** (Marcio, 23/04/2026)

Consequências:
- Engine NUNCA retorna `null` / `insufficient_data`. Sempre um número, mesmo com 5 trades (confidence LOW).
- Regressão é visível ao aluno no dashboard, não só ao mentor.
- Tom "espelho" — transparência total.

`stage.current` NUNCA muda sozinho pela engine (DEC-020). Engine grava em `proposedTransition` + `signalRegression`; promoção/regressão é decisão do mentor/aluno.

---

## D1. Janela rolling por stage

```
STAGE_WINDOWS = {
  1: { minTrades: 20, minDays: 30, floorTrades: 5 },   // CHAOS
  2: { minTrades: 30, minDays: 45, floorTrades: 5 },   // REACTIVE
  3: { minTrades: 50, minDays: 60, floorTrades: 5 },   // METHODICAL
  4: { minTrades: 80, minDays: 90, floorTrades: 5 },   // PROFESSIONAL
  5: { minTrades: 100, minDays: 90, floorTrades: 5 },  // MASTERY
}
```

Regra: `W = trades` cronológicos onde `pega o maior entre (últimos N trades, últimos X dias)`. Piso absoluto de 5 trades — abaixo disso, modo "sparse sample" com baseline blend (D6).

## D2. Score composto

```
composite = 0.25·E + 0.25·F + 0.20·O + 0.30·M
```

Fixo nesta versão. Mentor config futuro.

## D3. Fórmulas por dimensão (E/F/O/M)

### E — Emocional (0-100)

```
periodScore = emotionalAnalysisV2.calculatePeriodScore(W, getEmotionConfig).score   // 0-100
tiltRate    = totalTiltTrades / W.length                                            // 0-1
revengeRate = revenge.count / W.length                                              // 0-1

E = 0.60·periodScore
  + 0.25·normInverted(tiltRate, 0, 0.30)·100
  + 0.15·normInverted(revengeRate, 0, 0.20)·100
```

**v1.46.0 (#189):** `periodScore` agora vem do mirror CommonJS `functions/maturity/emotionalAnalysisMirror.js` (paridade ESM↔CJS testada). Antes era stub fixo `{50,0,0}`.

### F — Financial (0-100)

```
expT   = evLeakage.evTheoretical (fallback: stats.expectancy)
expR   = evLeakage.evReal        (fallback: stats.expectancy)
eScore = norm(expR / max(expT, ε), 0, 1.0)·100
payoff = calculatePayoff(stats).ratio ?? 0
pScore = norm(payoff, 0.8, 3.0)·100
cv     = calculateConsistencyCV(W)?.cv ?? 2.0
cvScore = normInverted(cv, 0.3, 2.0)·100
ddPct   = calculateMaxDrawdown(W, initialBalance).maxDDPercent
ddScore = normInverted(ddPct, 0, 25)·100   // 0%=100, 25%+=0

F = 0.30·eScore + 0.25·pScore + 0.20·cvScore + 0.25·ddScore
```

### O — Operational (0-100)

```
complianceRate  = calculateComplianceRate(W).rate
strategyConsWks = computeStrategyConsistencyWeeks(W, plans)   // helper D8
stratScore      = norm(strategyConsWks, 0, 12)·100
journalRate     = W.filter(t => hasJournal(t)).length / W.length
jScore          = journalRate · 100
planAdherence   = W.filter(t => t.planId).length / W.length · 100

O = 0.40·complianceRate + 0.20·stratScore + 0.20·jScore + 0.20·planAdherence
```

### M — Maturidade (0-100, emergente)

```
stageBase  = STAGE_BASES[stageCurrent]   // {1:0, 2:20, 3:40, 4:60, 5:80}
gatesRatio = gatesMet / gatesTotal
gateBoost  = 14·gatesRatio
selfAware  = computeSelfAwareness(baseline, {E, F, O})   // 0-100, D9

M = min(100, stageBase + gateBoost + 6·selfAware/100)
```

DEC-086: Maturidade é função emergente, NÃO medida isoladamente. Reflete `stageCurrent + gatesMet + selfAwareness`.

### Helpers de normalização (puros)

```
norm(x, min, max)         = clip01((x - min)/(max - min)) * 100
normInverted(x, min, max) = clip01(1 - (x - min)/(max - min)) * 100
clip01(v)                 = Math.max(0, Math.min(1, v))
```

## D4. `hasJournal(t)`

```
hasJournal(t) = (t.notes?.trim().length ?? 0) >= 10 || !!t.emotionEntry
```

Notes ≥10 chars OU `emotionEntry` preenchido. Tom: "jornalizar" é qualquer gesto mínimo de reflexão.

## D6. Política "evolução sempre visível"

| Amostra efetiva N | confidence | Comportamento |
|---|---|---|
| N ≥ floor+30 | HIGH | calcula tudo direto |
| floor ≤ N < floor+30 | MED | calcula tudo + flag no output |
| 5 ≤ N < floor | LOW | calcula com amostra parcial, pesos mantidos |
| N < 5 | LOW + `sparseSample:true` | blend baseline: `dim = α·trade_derived + (1-α)·baseline_dim`, α=N/5 |

`confidence` agregado = `min(confidenceE, confidenceF, confidenceO, confidenceM)`.
Sub-métrica que não pode ser computada → **valor neutro do stage atual**, flag `neutralFallback: <nome>`. **NUNCA zero, NUNCA null.**

## D7. Detecção de regressão

```
signalRegression.detected = (
  composite < STAGE_BASES[stageCurrent] - 5
  OR (E < baselineE - 15 AND F < baselineF - 15)
  OR mapMetricsToStage({winRate, payoff, maxDD}) < stageCurrent
)
```

Output:
```js
stage: {
  current: 3,
  signalNext: { gatesMet: 5, gatesTotal: 8, readyForReview: false },
  signalRegression: {
    detected: true,
    suggestedStage: 2,
    reasons: ['maxDD 15% > stage-3 ceiling 12%', 'payoff 1.1 < stage-3 floor 1.5'],
    severity: 'HIGH'   // LOW|MED|HIGH por número de violações
  }
}
```

## D8. Helpers derivados

| Helper | Função |
|---|---|
| `computeStrategyConsistencyWeeks(W, plans)` | Agrupa por semana (segunda, INV-06); setup dominante >60%; conta run máximo de semanas consecutivas com mesmo dominante |
| `computeStrategyConsistencyMonths(W, plans)` | Análogo para meses |
| `mapMetricsToStage({winRate, payoff, maxDD})` | Classifica vs framework §5.3 (linhas 452-461); retorna `min(stageWR, stagePayoff, stageDD)` |
| `computeSelfAwareness(baseline, currentDims)` | `100 - mean(|baseline_i - current_i|)` para i ∈ {E,F,O} |
| `computeDailyReturns(trades, initialBalance)` | Agrupa por dia; `r_dia = sum(PL do dia) / balance_inicio_dia` |
| `computeSharpe(dailyReturns, periodicity, minDays=60)` | `mean(r)/std(r) * sqrt(252)`; retorna `null` se `dailyReturns.length < minDays` |
| `computeAnnualizedReturn(dailyReturns, minDays=60)` | `(prod(1+r) - 1) * 252/length`; `null` se insuficiente |

## D9. Gates por transição

### 1 → 2 REACTIVE (6 gates — 3 framework + 3 produto)

| id | label | dim | métrica | op | thr | origem |
|---|---|---|---|---|---|---|
| `maxdd-under-20` | MaxDD < 20% | fin | maxDDPercent | <= | 20 | framework §5.3 |
| `rule-compliance-80` | Compliance ≥ 80% | op | complianceRate | >= | 80 | framework §5.3 |
| `emotional-out-of-fragile` | Emocional ≥ 30 | emo | E | >= | 30 | framework §5.3 |
| `basic-journal` | Journal em 50%+ | op | journalRate | >= | 0.50 | regra Espelho |
| `stop-usage` | Stop em 80%+ | fin | stopUsageRate | >= | 0.80 | regra Espelho |
| `plan-linked-trades` | Plan-linked ≥ 70% | op | planAdherence | >= | 70 | regra Espelho |

### 2 → 3 METHODICAL (8 gates — framework §9.2 literal)

| id | label | dim | métrica | op | thr |
|---|---|---|---|---|---|
| `emotional-55` | Emocional ≥ 55 | emo | E | >= | 55 |
| `financial-solid` | Financial ≥ 70 | fin | F | >= | 70 |
| `operational-65` | Operacional ≥ 65 | op | O | >= | 65 |
| `strategy-8-weeks` | 8 semanas s/ trocar estratégia | op | strategyConsWks | >= | 8 |
| `journal-90` | Journal ≥ 90% | op | journalRate | >= | 0.90 |
| `compliance-95` | Compliance ≥ 95% | op | complianceRate | >= | 95 |
| `winrate-45` | Win rate ≥ 45% | fin | winRate | >= | 45 |
| `payoff-1_2` | Payoff ≥ 1.2 | fin | payoff | >= | 1.2 |

### 3 → 4 PROFESSIONAL (10 gates — framework §9.2 literal)

| id | label | dim | métrica | op | thr |
|---|---|---|---|---|---|
| `emotional-75` | Emocional ≥ 75 | emo | E | >= | 75 |
| `financial-fortified` | Financial ≥ 85 | fin | F | >= | 85 |
| `operational-80` | Operacional ≥ 80 | op | O | >= | 80 |
| `strategy-12-months` | 12 meses s/ trocar estratégia | op | strategyConsMonths | >= | 12 |
| `advanced-metrics` | MFE/MAE/Sharpe rastreados | op | advancedMetricsPresent | == | true |
| `compliance-100` | Compliance = 100% últimos 100 | op | complianceRate100 | >= | 100 |
| `winrate-55` | Win rate ≥ 55% | fin | winRate | >= | 55 |
| `payoff-2` | Payoff ≥ 2.0 | fin | payoff | >= | 2.0 |
| `maxdd-5` | MaxDD ≤ 5% | fin | maxDDPercent | <= | 5 |
| `sharpe-1_2` | Sharpe mensal ≥ 1.2 | fin | monthlySharpe | >= | 1.2 |

**v1.44.1 (#191):** `compliance-100` agora calcula sobre janela = união dos ciclos ativos do trader (todos os planos por `adjustmentCycle`). Mínimo 20 trades; insuficiente → `null` → gate fica `METRIC_UNAVAILABLE` (não promove e não rebaixa, DEC-AUTO-191-01/-02).

### 4 → 5 MASTERY (9 gates — propostos e aprovados)

| id | label | dim | métrica | op | thr |
|---|---|---|---|---|---|
| `emotional-85` | Emocional ≥ 85 (SAGE) | emo | E | >= | 85 |
| `financial-90` | Financial ≥ 90 | fin | F | >= | 90 |
| `payoff-2_5` | Payoff ≥ 2.5 | fin | payoff | >= | 2.5 |
| `winrate-55-stable` | Win rate ≥ 55% em 100+ trades | fin | winRate | >= | 55 |
| `maxdd-3` | MaxDD ≤ 3% | fin | maxDDPercent | <= | 3 |
| `cv-low` | CV consistência < 0.5 | fin | cv | < | 0.5 |
| `zero-tilt-revenge` | Zero tilt/revenge 90 dias | emo | tiltRevengeCount | == | 0 |
| `annual-return-15` | Retorno anualizado ≥ 15% | fin | annualizedReturn | >= | 15 |
| `sharpe-1_5` | Sharpe anual ≥ 1.5 | fin | annualSharpe | >= | 1.5 |

Gate com métrica ausente → `{ met: null, reason: 'METRIC_UNAVAILABLE' }`. UI mostra "aguardando dados" sem marcar met=false nem met=true.

## D10. Schema Firestore (INV-15 aprovada)

### `students/{uid}/maturity/current` (1 doc/aluno)

```js
{
  currentStage: 1|2|3|4|5,                // nunca muda pela engine (DEC-020)
  baselineStage: 1|2|3|4|5,               // do initial_assessment, imutável
  stageHistory: [{ stage, changedAt, changedBy: 'mentor'|'system-boot' }],

  dimensionScores: { emotional, financial, operational, maturity, composite },

  gates: [{ id, label, dim, metric, op, threshold, value, met: true|false|null, gap, reason? }],
  gatesMet: number,
  gatesTotal: number,
  gatesRatio: number,

  proposedTransition: {
    proposed: 'UP'|'STAY'|'DOWN_DETECTED',
    nextStage: 1..5,
    blockers: [gateId, ...],
    confidence: 'HIGH'|'MED'|'LOW',
  },

  signalRegression: {
    detected: boolean,
    suggestedStage: 1..5|null,
    reasons: [string, ...],
    severity: 'LOW'|'MED'|'HIGH'|null,
  },

  windowSize: number,
  confidence: 'HIGH'|'MED'|'LOW',
  sparseSample: boolean,
  lastTradeId: string|null,
  computedAt: Timestamp,
  asOf: Timestamp,
  engineVersion: string,                  // ex: "1.43.0-engine-a"

  aiNarrative: string|null,               // markdown 150-250 palavras
  aiPatternsDetected: [string, ...],
  aiNextStageGuidance: string|null,
  aiGeneratedAt: Timestamp|null,
  aiTrigger: 'UP'|'REGRESSION'|null,
}
```

### `students/{uid}/maturity/_historyBucket/history/{YYYY-MM-DD}` (1 doc/dia)

```js
{
  date: 'YYYY-MM-DD',                    // = docId
  dimensionScores: { emotional, financial, operational, maturity, composite },
  currentStage: 1..5,
  gatesMet: number,
  gatesTotal: number,
  confidence: 'HIGH'|'MED'|'LOW',
  tradesInDay: number,
  computedAt: Timestamp,
  engineVersion: string,
}
```

DocId = `YYYY-MM-DD` facilita query range. Write é upsert.

### `firestore.rules`

```
match /students/{uid}/maturity/{docId=**} {
  allow read: if request.auth != null && (
    request.auth.uid == uid ||
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'mentor'
  );
  allow write: if false;   // só CF
}
```

## D11. Trigger CF

- `onTradeCreated` + `onTradeUpdated`: recalcula **apenas quando `status === 'CLOSED'`** (dropa IMPORTED, REVIEWED, QUESTION, OPEN).
- **Isolamento:** try/catch englobando o recálculo — falha em maturity NÃO propaga (PL/compliance escreve normal).
- Log via `functions.logger.error` com `studentId, tradeId, error`.

## D12. IA — `classifyMaturityProgression` (Sonnet 4.6)

**Input schema:**
```js
{
  studentId, currentStage, baselineStage,
  scores: { emotional, financial, operational, maturity, composite },
  baselineScores: {...},
  gates: [{ id, label, met, value, threshold, gap }],
  tradesSummary: {
    windowSize, winRate, payoff, expectancy, maxDDPercent, avgDuration,
    tiltCount, revengeCount, complianceRate, journalRate,
  },
  trigger: 'UP' | 'REGRESSION',
}
```

**Output schema:**
```js
{
  narrative: string,                  // markdown 150-250 palavras
  patternsDetected: [string, ...],    // 1-5 bullets
  nextStageGuidance: string,          // markdown 80-150 palavras
  confidence: 'HIGH'|'MED'|'LOW',
}
```

- Modelo: `claude-sonnet-4-6`. Temperature 0.3. Max tokens 1500.
- Dispara: `proposedTransition.proposed === 'UP'` OU `signalRegression.detected === true`.
- Cache em `maturity/current.aiNarrative*` até próximo trigger.
- Fallback: API falha → `aiNarrative = null` sem consumir cota; UI mostra sem narrativa.

## D14. Sharpe em daytrade

Calculado sobre **retornos diários agregados** (não por trade):

```
r_dia        = sum(PL do dia) / balance_inicio_dia
sharpe_anual = mean(r_dia) / std(r_dia) * sqrt(252)
```

Requer ≥ 60 dias operados. Abaixo, `sharpeAnnual = null` → gate `{ met: null, reason: 'INSUFFICIENT_HISTORY' }`.

CHUNK-15 Swing Trade: fórmula permanece, granularidade do input muda (retornos multi-dia).

## D15. Mentor — Semáforo Torre

Por aluno:
- 🟢 **Verde** — `proposedTransition.proposed === 'UP'` nos últimos 30 dias
- 🟡 **Amarelo** — `proposed === 'STAY'` + `gatesRatio` sem mudança em > 30 dias (lê `_historyBucket/history`)
- 🔴 **Vermelho** — `signalRegression.detected === true` atualmente

Tooltip: "X/Y gates · faltam Z" ou regressão com blockers.
Card expandível: gates completos + sugestão de stage natural.

---

## Decisões consolidadas

- **DEC-019..022** — Diagnóstico inicial 4D pela IA (assessment, baseline imutável, stage por escala 1-5, ground truth do briefing).
- **DEC-020** — `stage.current` NUNCA muda automaticamente. Engine só sinaliza.
- **DEC-027** — IncongruenceFlags master/detail com probing IA.
- **DEC-086** — Motor de evolução Maturidade 4D × 5 estágios: engine puro + gates hardcoded + fórmulas e janela rolling fixas na v1.43.0. Maturidade é emergente, nunca medida isoladamente. Regressão detectada mas nunca aplicada automaticamente. Evolução sempre visível.
- **DEC-AUTO-119-01..-07** + **DEC-AUTO-191-01/-02** — Detalhes do schema, persistência, gates específicos. Ver `docs/decisions.md`.

## Referência externa

- Framework completo: `docs/dev/trader_evolution_framework.md` (1287 linhas, ground truth do "Modelo Portes").
- Implementação ESM: `src/utils/maturityEngine/`
- Mirror CommonJS para CF: `functions/maturity/`

## Follow-ups documentados (issues posteriores)

- `calculatePeriodScore([])=100` paridade ESM × D6=50 — só `computeEmotionalAnalysisShape` aplica D6
- Aluno legado sem `emotionEntry` em todos trades pega E≈60 via consistency bonus em UNKNOWN/UNKNOWN
- Cache em memória runtime do CF para collection `emotions` (otimização futura)
