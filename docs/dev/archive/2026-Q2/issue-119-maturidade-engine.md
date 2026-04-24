# Issue #119 — feat: Motor de progressão Maturidade 4D × 5 estágios

**Título GitHub:** `feat: Maturidade — barra de evolucao por gate com progressao baseada em trades`
**Milestone:** v1.2.0 Mentor Cockpit
**Versão reservada:** v1.43.0
**Branch:** `feat/issue-119-maturidade-engine`
**Worktree:** `~/projects/issue-119`
**Chunks:** CHUNK-09 (escrita) · CHUNK-04/05/06/08 (leitura)
**Modo:** **AUTÔNOMO** (CC-Interface + CC-Coord + CC-Worker conforme §13 do PROJECT.md)
**Baseado em:** PROJECT.md v0.36.0

---

## §1 CONTEXTO

O "Modelo Portes" (framework 4D × 5 stages) tem hoje só os dois extremos:
- **Marco zero** — `students/{uid}/assessment/initial_assessment` estático com stage diagnosticado pela IA (DEC-019 a DEC-022)
- **Revisão Semanal v2** (#102 v1.38.0) — subitem "Maturidade 4D" pontual por semana

**Gap:** não existe evolução contínua entre baseline e revisão. A Matriz Emocional 4D (#164 E3) tem sparkline de P&L como proxy — é proxy, não motor de gates.

Este issue constrói o **motor** que calcula evolução Chaos → Mastery a partir de trades reais. Stages 2→3 exige 8/8 gates, 3→4 exige 10/10 (framework linhas 838-876). Regressão nunca é automática (DEC-020) — engine DETECTA e sinaliza, mentor/aluno veem.

### Diretriz de produto inegociável (Marcio, 23/04/2026)

**"O aluno precisa ver evolução, mesmo que negativa."**

Consequências:
- Engine NUNCA retorna `null` / `insufficient_data`. Sempre um número, mesmo com 5 trades (confidence LOW).
- Regressão é visível ao aluno no dashboard, não só ao mentor.
- Tom "espelho" — transparência total.

---

## §2 ACCEPTANCE CRITERIA

### Fase A — Engine puro (`src/utils/maturityEngine.js`)
- [ ] Funções puras exportadas: `evaluateMaturity`, `resolveWindow`, `computeEmotional`, `computeFinancial`, `computeOperational`, `computeMaturity`, `evaluateGates`, `proposeStageTransition`, `detectRegressionSignal`, `computeConfidence`
- [ ] Constantes exportadas: `STAGE_WINDOWS`, `GATES_BY_TRANSITION`, `STAGE_BASES`, `COMPOSITE_WEIGHTS`
- [ ] Zero Firestore, zero `fetch`, zero `Date.now()` direto (recebe `now` por parâmetro)
- [ ] Testes unitários por dimensão (≥3 cenários cada)
- [ ] Testes de integração por stage (5 cenários ponta-a-ponta)
- [ ] Testes de "evolução sempre visível" (5/15/50 trades → engine retorna número)
- [ ] Testes de regressão (aluno Stage 3 com métricas de Stage 2 → `signalRegression.detected=true`, `stage.current=3` inalterado)

### Fase B — Persistência + CF
- [ ] Subcollection `students/{uid}/maturity/current` (1 doc) e `students/{uid}/maturity/history` (1 doc/dia)
- [ ] CF `onTradeCreated` e `onTradeUpdated` recalcula apenas quando `status === 'CLOSED'`
- [ ] Hook `useMaturity(studentId)` com listener em tempo real em `current`
- [ ] Query util para `history` (últimos N dias)
- [ ] `firestore.rules` — aluno lê próprio, mentor lê alunos dele, só CF escreve
- [ ] Testes de CF (mock Firestore)

### Fase C — UI Aluno
- [ ] Card "Progressão de Maturidade" no StudentDashboard
- [ ] Barra horizontal com 5 marcos (CHAOS → REACTIVE → METHODICAL → PROFESSIONAL → MASTERY)
- [ ] Preenchimento parcial no stage atual pela proporção `gatesMet/gatesTotal`
- [ ] Tooltip por gate pendente (label + valor atual vs threshold)
- [ ] Marcador vermelho + mensagem quando `signalRegression.detected`
- [ ] Sugestão do stage "natural" atual quando há regressão ("atual: Stage 3 validado · sinal recente: Stage 2")
- [ ] Substitui sparkline do quadrante Maturidade da Matriz 4D E3 (consolidação — não duplicar)
- [ ] DebugBadge `component="MaturityProgressionCard"` (INV-04)

### Fase D — IA Sonnet 4.6
- [ ] CF callable `classifyMaturityProgression` em `functions/assessment/`
- [ ] Dispara apenas quando `proposedTransition.proposed === 'UP'` OU `signalRegression.detected`
- [ ] Input schema validado; output markdown 150-250 palavras + patternsDetected + nextStageGuidance
- [ ] Cache em `maturity/current.aiNarrative` até próximo trigger
- [ ] Fallback determinístico (sem consumo de cota) em caso de falha
- [ ] `secrets: ['ANTHROPIC_API_KEY']` declarado

### Fase E — Review snapshot
- [ ] `review.maturitySnapshot` populado no fechamento da WeeklyReviewPage (#102 status=CLOSED)
- [ ] Comparativo review N vs N-1 renderizado no WeeklyReviewPage com delta por gate
- [ ] Hook `useReviewMaturitySnapshot(reviewId, planId)`

### Fase F — Mentor
- [ ] Semáforo por aluno na MentorDashboard Torre de Controle
  - Verde: `proposedTransition.proposed === 'UP'` nos últimos 30 dias
  - Amarelo: `STAY` + gates estagnados > 30 dias
  - Vermelho: `signalRegression.detected`
- [ ] Card de alerta de regressão expandível mostrando gates perdidos

### Entrega final
- [ ] `src/version.js` 1.43.0 definitiva (entrada CHANGELOG fechada)
- [ ] `docs/PROJECT.md` §10 com entrada v1.43.0 + DEC-086 + §6.3 lock liberado (encerramento)
- [ ] PR único com `Closes #119`, baseado em `main`
- [ ] 0 regressões (baseline 1890 testes + novos)

---

## §3 ANÁLISE DE IMPACTO

### Collections afetadas
- **Leitura:** `trades` (cadeia principal), `plans` (initialBalance, pl, metas), `students/{uid}/assessment/initial_assessment` (baseline 4D + gates_met inicial)
- **Escrita:** `students/{uid}/maturity/{current|history}` (NOVA subcollection — INV-15 aprovada)

### Cloud Functions
- **Nova:** `classifyMaturityProgression` (callable, Sonnet 4.6) — Fase D
- **Modificadas:** `onTradeCreated` e `onTradeUpdated` — pipe de recálculo de maturity quando `status === 'CLOSED'`. **Respeitar INV-02 (gateway `addTrade`) e INV-03 (pipeline inquebrável)**.

### Hooks / Componentes
- **Novos:** `useMaturity`, `useReviewMaturitySnapshot`, `MaturityProgressionCard`, `MentorMaturityAlert`
- **Modificados:** `StudentDashboard` (insere card + remove/substitui sparkline Maturidade do E3), `WeeklyReviewPage` (snapshot + comparativo), `MentorDashboard` Torre (semáforo), `EmotionalMatrixCard` (quadrante Maturidade limpo)

### Side-effects
- Nenhum toque em PL, compliance ou emotional scoring — consumo read-only.
- CF `onTradeCreated`/`onTradeUpdated` ganha novo passo no pipeline, mas ele é isolado (falha em maturity NÃO bloqueia escrita de PL/compliance). **Vai precisar try/catch + log.**

### Blast radius / rollback
- Rollback da Fase A (engine puro): trivial, código puro.
- Rollback Fase B: remover CF novas, deletar subcollection via script admin.
- Rollback Fase C-F: revert da UI, dados ficam em Firestore sem UI consumidora.

### DebugBadge (INV-04)
- `MaturityProgressionCard` — obrigatório `component="MaturityProgressionCard"`
- `MentorMaturityAlert` — obrigatório `component="MentorMaturityAlert"`

### INV-17 Arquitetura de Informação
- **Nível:** card
- **Domínio:** Dashboard (aluno) + Mesa Mentor (mentor)
- **Duplicação:** substitui sparkline do quadrante Maturidade da Matriz Emocional 4D — consolidação, não adição
- **Budget:** Dashboard hoje tem 7 seções visíveis (KPIs, EquityCurve, Calendário, SWOT, Matriz 4D, Consistência Operacional, PendingTakeaways). Substituição mantém 7 seções (só troca conteúdo do quadrante Maturidade e adiciona card separado com detalhe de gates — +1 mas enxuto)

---

### §3.1 Decisões Antecipadas (INV-18 — fechadas em bloco com Marcio em 23/04/2026)

Estas decisões são **ground truth** do briefing. A Coord consulta este bloco em qualquer ambiguidade antes de escalar. Escalação humana só se aparecer ambiguidade **NÃO coberta** aqui (deve ser raro).

#### D1. Janela rolling por stage
```
STAGE_WINDOWS = {
  1: { minTrades: 20, minDays: 30, floorTrades: 5 },   // CHAOS
  2: { minTrades: 30, minDays: 45, floorTrades: 5 },   // REACTIVE
  3: { minTrades: 50, minDays: 60, floorTrades: 5 },   // METHODICAL
  4: { minTrades: 80, minDays: 90, floorTrades: 5 },   // PROFESSIONAL
  5: { minTrades: 100, minDays: 90, floorTrades: 5 },  // MASTERY
}
```
Regra: `W = trades` cronológicos onde `pega o maior entre (últimos N trades, últimos X dias)`. Piso absoluto de 5 trades — abaixo disso, engine entra em modo "sparse sample" com `baseline blend` (ver D7).

#### D2. Score composto (fixo nesta versão)
```
composite = 0.25·E + 0.25·F + 0.20·O + 0.30·M
```
Não configurável. Mentor config futuro.

#### D3. Fórmula por dimensão (E/F/O/M)

**E — Emocional (0-100):**
```
periodScore = emotionalAnalysisV2.calculatePeriodScore(W, getEmotionConfig).score  // 0-100
tiltRate    = totalTiltTrades / W.length                 // 0-1
revengeRate = revenge.count / W.length                   // 0-1

E = 0.60·periodScore
  + 0.25·normInverted(tiltRate, 0, 0.30)·100
  + 0.15·normInverted(revengeRate, 0, 0.20)·100
```

**F — Financial (0-100):**
```
expT   = evLeakage.evTheoretical  (fallback: stats.expectancy de calculateStats)
expR   = evLeakage.evReal          (fallback: stats.expectancy)
eScore = norm(expR / max(expT, ε), 0, 1.0)·100
payoff = calculatePayoff(stats).ratio ?? 0
pScore = norm(payoff, 0.8, 3.0)·100
cv     = calculateConsistencyCV(W)?.cv ?? 2.0
cvScore = normInverted(cv, 0.3, 2.0)·100
ddPct  = calculateMaxDrawdown(W, initialBalance).maxDDPercent
ddScore = normInverted(ddPct, 0, 25)·100  // 0%=100, 25%+=0

F = 0.30·eScore + 0.25·pScore + 0.20·cvScore + 0.25·ddScore
```

**O — Operational (0-100):**
```
complianceRate   = calculateComplianceRate(W).rate
strategyConsWks  = computeStrategyConsistencyWeeks(W, plans)  // helper novo, ver D8
stratScore       = norm(strategyConsWks, 0, 12)·100
journalRate      = W.filter(t => hasJournal(t)).length / W.length
jScore           = journalRate · 100
planAdherence    = W.filter(t => t.planId).length / W.length · 100

O = 0.40·complianceRate + 0.20·stratScore + 0.20·jScore + 0.20·planAdherence
```

**M — Maturidade (0-100):** emergente, NÃO medida isolada
```
stageBase   = STAGE_BASES[stageCurrent]   // {1:0, 2:20, 3:40, 4:60, 5:80}
gatesRatio  = gatesMet / gatesTotal
gateBoost   = 14·gatesRatio
selfAware   = computeSelfAwareness(baseline, {E, F, O})  // 0-100, ver D9

M = min(100, stageBase + gateBoost + 6·selfAware/100)
```

Helpers de normalização puros:
```
norm(x, min, max)         = clip01((x - min)/(max - min)) * 100
normInverted(x, min, max) = clip01(1 - (x - min)/(max - min)) * 100
clip01(v)                 = Math.max(0, Math.min(1, v))
```

#### D4. `hasJournal(t)` — decisão Marcio
```
hasJournal(t) = (t.notes?.trim().length ?? 0) >= 10 || !!t.emotionEntry
```
Notes ≥10 chars OU emotionEntry preenchido. Tom: "jornalizar" é qualquer gesto mínimo de reflexão.

#### D5. Maturidade como dimensão emergente (não independente)
Marcio afirmou "Maturidade é resultado das outras dimensões". Design reflete — M é `f(stageCurrent, gatesMet, selfAwareness)` onde todos componentes derivam de E/F/O + histórico. Maturidade nunca é medida isoladamente. Decision: DEC-086.

#### D6. "Evolução sempre visível" — política de confidence
| Amostra efetiva N | confidence | Comportamento |
|---|---|---|
| N ≥ floor+30 | HIGH | calcula tudo direto |
| floor ≤ N < floor+30 | MED | calcula tudo + flag no output |
| 5 ≤ N < floor | LOW | calcula com amostra parcial, pesos mantidos |
| N < 5 | LOW + `sparseSample:true` | blend baseline: `dim = α·trade_derived + (1-α)·baseline_dim`, α=N/5 |

`confidence` agregado do snapshot = `min(confidenceE, confidenceF, confidenceO, confidenceM)`.

Sub-métrica que não pode ser computada → **valor neutro do stage atual** (middle do range framework §5.3), flag `neutralFallback: <nome>`. **NUNCA zero, NUNCA null.**

#### D7. Detecção de regressão (DEC-020 respeitada)
```
signalRegression.detected = (
  composite < STAGE_BASES[stageCurrent] - 5
  OR (E < baselineE - 15 AND F < baselineF - 15)
  OR mapMetricsToStage({winRate, payoff, maxDD}) < stageCurrent
)
```
`stage.current` NUNCA muda sozinho pela engine. Engine só grava em `proposedTransition` + `signalRegression`.

Output shape:
```js
stage: {
  current: 3,
  signalNext: { gatesMet: 5, gatesTotal: 8, readyForReview: false },
  signalRegression: {
    detected: true,
    suggestedStage: 2,
    reasons: ['maxDD 15% > stage-3 ceiling 12%', 'payoff 1.1 < stage-3 floor 1.5'],
    severity: 'HIGH'  // LOW|MED|HIGH por número de violações
  }
}
```

#### D8. Helpers novos que a engine precisa (derivação in-place)

**`computeStrategyConsistencyWeeks(W, plans)`** — agrupa W por semana (segunda-feira, INV-06). Por semana, identifica setup dominante (>60% dos trades da semana). Conta run máximo de semanas consecutivas com mesmo dominante. Retorna número de semanas.

**`computeStrategyConsistencyMonths(W, plans)`** — análogo para meses.

**`mapMetricsToStage({winRate, payoff, maxDD})`** — classifica inputs contra tabela framework §5.3 (linhas 452-461). Lógica: para cada métrica, checa qual stage range ela se encaixa; retorna `min(stageWR, stagePayoff, stageDD)` (pior dos três).

**`computeSelfAwareness(baseline, currentDims)`** — `100 - mean(|baseline_i - current_i|)` para i em {emotional, financial, operational}. Trader que previu certo = alto self-awareness.

**`computeDailyReturns(trades, initialBalance)`** — agrupa trades por dia (YYYY-MM-DD), `r_dia = sum(PL do dia) / balance_inicio_dia`. Retorna `Array<{date, r}>`.

**`computeSharpe(dailyReturns, periodicity='annual', minDays=60)`** — se `dailyReturns.length < minDays`, retorna `null` (gate com fallback neutro). Senão `sharpe = mean(r)/std(r) * sqrt(252)`.

**`computeAnnualizedReturn(dailyReturns, minDays=60)`** — `(prod(1+r) - 1) * 252/dailyReturns.length` ou `null` se amostra insuficiente.

#### D9. Gates

**1 → 2 REACTIVE (6 gates — 3 framework + 3 produto):**
| id | label | dim | métrica | op | threshold | origem |
|---|---|---|---|---|---|---|
| `maxdd-under-20` | MaxDD < 20% | fin | maxDDPercent | <= | 20 | **framework §5.3** |
| `rule-compliance-80` | Compliance ≥ 80% | op | complianceRate | >= | 80 | **framework §5.3** |
| `emotional-out-of-fragile` | Emocional ≥ 30 | emo | E | >= | 30 | **framework §5.3** (piso Stage 2) |
| `basic-journal` | Journal em 50%+ dos trades | op | journalRate | >= | 0.50 | **regra de produto Espelho** |
| `stop-usage` | Stop em 80%+ dos trades | fin | stopUsageRate | >= | 0.80 | **regra de produto Espelho** |
| `plan-linked-trades` | Plan-linked ≥ 70% | op | planAdherence | >= | 70 | **regra de produto Espelho** |

**2 → 3 METHODICAL (8 gates — framework §9.2 literal):**
| id | label | dim | métrica | op | threshold |
|---|---|---|---|---|---|
| `emotional-55` | Emocional ≥ 55 | emo | E | >= | 55 |
| `financial-solid` | Financial ≥ 70 (SOLID) | fin | F | >= | 70 |
| `operational-65` | Operacional ≥ 65 | op | O | >= | 65 |
| `strategy-8-weeks` | 8 semanas sem trocar estratégia | op | strategyConsWks | >= | 8 |
| `journal-90` | Journal ≥ 90% | op | journalRate | >= | 0.90 |
| `compliance-95` | Compliance ≥ 95% | op | complianceRate | >= | 95 |
| `winrate-45` | Win rate ≥ 45% | fin | winRate | >= | 45 |
| `payoff-1_2` | Payoff ≥ 1.2 | fin | payoff | >= | 1.2 |

**3 → 4 PROFESSIONAL (10 gates — framework §9.2 literal):**
| id | label | dim | métrica | op | threshold |
|---|---|---|---|---|---|
| `emotional-75` | Emocional ≥ 75 | emo | E | >= | 75 |
| `financial-fortified` | Financial ≥ 85 (FORTIFIED) | fin | F | >= | 85 |
| `operational-80` | Operacional ≥ 80 | op | O | >= | 80 |
| `strategy-12-months` | 12 meses sem trocar estratégia | op | strategyConsMonths | >= | 12 |
| `advanced-metrics` | MFE/MAE/Sharpe rastreados | op | advancedMetricsPresent | == | true |
| `compliance-100` | Compliance = 100% nos últimos 100 | op | complianceRate100 | >= | 100 |
| `winrate-55` | Win rate ≥ 55% | fin | winRate | >= | 55 |
| `payoff-2` | Payoff ≥ 2.0 | fin | payoff | >= | 2.0 |
| `maxdd-5` | MaxDD ≤ 5% | fin | maxDDPercent | <= | 5 |
| `sharpe-1_2` | Sharpe mensal ≥ 1.2 | fin | monthlySharpe | >= | 1.2 |

**4 → 5 MASTERY (9 gates — propostos e aprovados):**
| id | label | dim | métrica | op | threshold |
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

Gate com métrica ausente (ex: sem compliance config para aluno novo) retorna `{ met: null, reason: 'METRIC_UNAVAILABLE' }`. UI mostra "aguardando dados" sem marcar met=false nem met=true.

#### D10. Schema Firestore (INV-15 aprovada)

**`students/{uid}/maturity/current`** (1 doc por aluno):
```js
{
  // estado do stage
  currentStage: 1|2|3|4|5,                // nunca muda pela engine (DEC-020)
  baselineStage: 1|2|3|4|5,               // do initial_assessment, imutável
  stageHistory: [{ stage, changedAt, changedBy: 'mentor'|'system-boot' }],  // audit trail

  // scores dimensionais (0-100)
  dimensionScores: { emotional, financial, operational, maturity, composite },

  // gates da transição atual (stage → stage+1)
  gates: [{ id, label, dim, metric, op, threshold, value, met: true|false|null, gap, reason? }],
  gatesMet: number,
  gatesTotal: number,
  gatesRatio: number,

  // transição proposta
  proposedTransition: {
    proposed: 'UP'|'STAY'|'DOWN_DETECTED',
    nextStage: 1..5,
    blockers: [gateId, ...],              // gates não-met
    confidence: 'HIGH'|'MED'|'LOW',
  },

  // regressão (DEC-020)
  signalRegression: {
    detected: boolean,
    suggestedStage: 1..5|null,
    reasons: [string, ...],
    severity: 'LOW'|'MED'|'HIGH'|null,
  },

  // meta
  windowSize: number,                      // trades efetivos no cálculo
  confidence: 'HIGH'|'MED'|'LOW',
  sparseSample: boolean,
  lastTradeId: string|null,
  computedAt: Timestamp,
  asOf: Timestamp,                         // referência temporal do cálculo
  engineVersion: string,                   // ex: "1.43.0-engine-a"

  // narrativa IA (Fase D)
  aiNarrative: string|null,                // markdown 150-250 palavras
  aiPatternsDetected: [string, ...],
  aiNextStageGuidance: string|null,
  aiGeneratedAt: Timestamp|null,
  aiTrigger: 'UP'|'REGRESSION'|null,
}
```

**`students/{uid}/maturity/history/{YYYY-MM-DD}`** (1 doc por dia por aluno):
```js
{
  date: 'YYYY-MM-DD',                     // = docId
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

DocId = `YYYY-MM-DD` facilita query range. Write é upsert: último cálculo do dia sobrescreve.

**`firestore.rules`:**
```
match /students/{uid}/maturity/{docId=**} {
  allow read: if request.auth != null && (
    request.auth.uid == uid ||
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'mentor'
  );
  allow write: if false;  // só CF
}
```

#### D11. Trigger CF
- `onTradeCreated` + `onTradeUpdated`: recalcula **apenas quando `status === 'CLOSED'`** (dropa IMPORTED, REVIEWED, QUESTION, OPEN).
- **Isolamento:** try/catch englobando o recálculo — falha em maturity NÃO propaga pro pipeline principal (PL/compliance escreve normal).
- Log de erro via `functions.logger.error` com `studentId, tradeId, error`.

#### D12. IA — `classifyMaturityProgression` (Fase D)

**Input schema:**
```js
{
  studentId: string,
  currentStage: 1..5,
  baselineStage: 1..5,
  scores: { emotional, financial, operational, maturity, composite },
  baselineScores: { emotional, financial, operational, maturity, composite },
  gates: [{ id, label, met, value, threshold, gap }],
  tradesSummary: {                    // agregados, NÃO trades brutos
    windowSize, winRate, payoff, expectancy, maxDDPercent, avgDuration,
    tiltCount, revengeCount, complianceRate, journalRate,
  },
  trigger: 'UP' | 'REGRESSION',
}
```

**Output schema:**
```js
{
  narrative: string,                   // markdown 150-250 palavras
  patternsDetected: [string, ...],     // 1-5 bullets
  nextStageGuidance: string,           // markdown 80-150 palavras
  confidence: 'HIGH'|'MED'|'LOW',
}
```

Modelo: Claude Sonnet 4.6 (`claude-sonnet-4-6`). Temperature 0.3. Max tokens 1500.
Dispara: apenas em `proposedTransition.proposed === 'UP'` OU `signalRegression.detected === true`.
Cache: em `maturity/current.aiNarrative*` até próximo trigger (invalidação implícita).
Fallback: se API falha, `aiNarrative = null` sem consumir cota, log do erro, UI mostra sem narrativa.

#### D13. UI Card (Fase C)

**Componente:** `MaturityProgressionCard`
**Localização no StudentDashboard:** após Matriz Emocional 4D, antes de PendingTakeaways.
**Substituição:** sparkline do quadrante Maturidade da Matriz 4D E3 é removida; quadrante Maturidade passa a mostrar apenas stage atual + mini-barra de gates (forma compacta).

**Layout card (desktop):**
```
┌──────────────────────────────────────────────────────────┐
│ Progressão de Maturidade                  confidence: MED│
├──────────────────────────────────────────────────────────┤
│  [▓▓▓▓▓▓▓▓▓▓][▓▓▓▓▓░░][░░░][░░░][░░░]                   │
│  CHAOS    REACTIVE  METHOD  PROF  MASTERY                │
│                                                          │
│  Stage atual: REACTIVE  ·  5/8 gates para METHODICAL    │
│                                                          │
│  Gates pendentes:                                        │
│   · Emocional ≥ 55 (você: 48, faltam 7)                 │
│   · Compliance ≥ 95% (você: 89%, faltam 6pp)            │
│   · Journal ≥ 90% (você: 76%, faltam 14pp)              │
│                                                          │
│  [vermelho quando signalRegression.detected:]            │
│  ⚠ Seus números recentes sugerem revisão                │
│     sinal recente: Stage 1 · maxDD 22% > teto 18%       │
│                                                          │
│  [markdown da narrativa IA, se presente]                 │
└──────────────────────────────────────────────────────────┘
```

**Cores (Tailwind):**
- Preenchimento da barra: stages passados emerald-500, atual amber-400, futuros gray-700
- Marcador regressão: red-500 border + red-300 text
- Tooltip por gate: dark slate

**Mobile:** barra mantida horizontal, lista de gates pendentes abaixo (colapsada por default mostrando só 2 com botão "ver todos").

#### D14. Sharpe em daytrade
Calculado sobre **retornos diários agregados** (não por trade).
```
r_dia = sum(PL do dia) / balance_inicio_dia
sharpe_anual = mean(r_dia) / std(r_dia) * sqrt(252)
```
Requer ≥ 60 dias operados. Abaixo disso, `sharpeAnnual = null` → gate correspondente retorna `{ met: null, reason: 'INSUFFICIENT_HISTORY' }`.

Quando CHUNK-15 Swing Trade entrar, fórmula permanece — só muda granularidade do input (retornos multi-dia ao invés de daily P&L). Engine ignora a distinção.

#### D15. Mentor — Semáforo Torre de Controle (Fase F)
Por aluno:
- 🟢 **Verde** — `proposedTransition.proposed === 'UP'` detectado nos últimos 30 dias
- 🟡 **Amarelo** — `proposed === 'STAY'` + `gatesRatio` sem mudança em > 30 dias (ler `history` pra comparar)
- 🔴 **Vermelho** — `signalRegression.detected === true` atualmente

Tooltip mostra: "X/Y gates · faltam Z" ou mensagem de regressão com blockers.
Card expandível: lista completa de gates + sugestão de stage natural.

#### D16. Componente `<DebugBadge>` (INV-04)
- `MaturityProgressionCard`: `<DebugBadge component="MaturityProgressionCard" />`
- `MentorMaturityAlert`: `<DebugBadge component="MentorMaturityAlert" />`

Props `embedded` false (não embedded).

#### D17. Testes — Vitest + jsdom

**Unitários por dimensão:** 3-5 cenários cada em `src/__tests__/utils/maturityEngine/`
**Integração por stage:** 5 cenários ponta-a-ponta (1 por stage)
**Política "evolução sempre visível":** cenários com 5/15/30/50/100 trades confirmando engine nunca retorna null
**Regressão:** aluno Stage 3 com métricas Stage 2 → `signalRegression.detected=true`, `stage.current=3`
**Gates:** cada gate com thresholdMet e thresholdNotMet cases
**Helpers:** `computeDailyReturns`, `computeSharpe`, `computeAnnualizedReturn`, `computeStrategyConsistencyWeeks` — testes independentes

**Fixtures:** sintéticas via builder (`makeTrade({ date, pl, emotion, compliance, setup, stopLoss, ... })`). Zero dependência de dados reais.

#### D18. DEC novo — DEC-086
"Motor de evolução Maturidade 4D × 5 estágios: engine puro + gates hardcoded + fórmulas e janela rolling fixas na v1.43.0. Maturidade é emergente (função de E/F/O + gates + self-awareness), nunca medida isolada. Regressão detectada mas nunca aplicada automaticamente. Evolução sempre visível (nunca null)."

#### D19. Granularidade de tasks (proposta preliminar — §4 apresenta ao Marcio antes de spawn)

Proposta de ~20 tasks distribuídas:

**Fase A — Engine puro (5 tasks):**
- A1: fixtures + helpers puros (`computeDailyReturns`, `computeSharpe`, `computeAnnualizedReturn`, `computeStrategyConsistencyWeeks`, `mapMetricsToStage`, `computeSelfAwareness`) + testes
- A2: `computeEmotional` + `computeFinancial` + testes
- A3: `computeOperational` + `computeMaturity` + testes
- A4: `evaluateGates` + `GATES_BY_TRANSITION` + testes por transição
- A5: `proposeStageTransition` + `detectRegressionSignal` + `evaluateMaturity` orquestrador + testes integração por stage

**Fase B — Persistência (4 tasks):**
- B1: schema + firestore.rules + testes mock rules
- B2: CF `onTradeCreated/onTradeUpdated` — recálculo com try/catch isolado + testes mock
- B3: hook `useMaturity(studentId)` + `useMaturityHistory(studentId, days)` + testes hook
- B4: script admin de backfill (para alunos existentes) — one-off

**Fase C — UI Aluno (3 tasks):**
- C1: `MaturityProgressionCard` componente + DebugBadge + testes render
- C2: Wire no StudentDashboard + remoção/simplificação do quadrante Maturidade da Matriz 4D E3 + testes integração
- C3: ajustes mobile + estados vazios/loading + testes visual

**Fase D — IA (2 tasks):**
- D1: CF `classifyMaturityProgression` + prompt engineering + fallback + testes com mock API
- D2: Wire da narrativa no card + cache + testes

**Fase E — Review (2 tasks):**
- E1: freeze de `maturitySnapshot` no fechamento WeeklyReviewPage + rules update
- E2: comparativo N vs N-1 no WeeklyReviewPage + hook + testes

**Fase F — Mentor (2 tasks):**
- F1: semáforo por aluno na Torre (MentorDashboard) + testes
- F2: card de alerta de regressão expandível + testes

**Fase G — Fechamento (2 tasks):**
- G1: atualizar `version.js` com CHANGELOG definitivo + PROJECT.md (CHANGELOG + DEC-086 + §6.3 unlock + §9 se aplicável)
- G2: validação browser + QA cross-context (aluno/mentor/override) + smoke test

Total: **20 tasks** · 1-5 commits cada · ~30-90min por task.

---

### §3.2 Decisões Autônomas (DEC-AUTO-119-NN)

> Preenchido pela **Coord** durante o loop autônomo quando ela resolver ambiguidade não coberta em §3.1. Ordem de fallback: §3.1 → PROJECT.md → padrão de código existente → menor blast radius.

#### DEC-AUTO-119-01 — Short-circuit em `computeSharpe` para retornos constantes (Worker, task 01)

**Contexto:** contrato do briefing dizia `std === 0 → null`. Em JS, `[0.01, 0.01, ..., 0.01]×60` produz `std ≈ 3e-18` (não-zero literal), gerando Sharpe ≈ 3e16 — espúrio.

**Decisão:** antes de computar mean/std, verificar se todos os `r` são estritamente iguais ao primeiro. Caso sim → `return null`. Preserva a intenção ("sem dispersão → Sharpe indefinido") sem hack de epsilon arbitrário, e não mascara casos legítimos de std tiny-but-não-zero.

**Blast radius:** zero — A2..A5 consomem `null` da mesma forma que já consumiriam quando N < minDays.

#### DEC-AUTO-119-02 — `void plans;` em `computeStrategyConsistencyWeeks` (Worker, task 01)

**Contexto:** briefing exige manter `plans` na assinatura para futura extensão. ESLint `no-unused-vars` dispararia.

**Decisão:** usar `void plans;` no corpo — sinaliza intenção, evita warning, mantém o nome do parâmetro conforme spec. Alternativas rejeitadas: `_plans` (viola a spec "mantenha na assinatura"); `eslint-disable-next-line` (não é padrão usado no projeto — `grep` não encontrou ocorrências em `src/utils/`).

#### DEC-AUTO-119-03 — Fórmulas E/F/O com helpers em escala 0-100 (Coord, abertura task 02)

**Contexto:** §3.1 D3 define `norm`/`normInverted` como retornando `× 100` (escala 0-100), mas as fórmulas de E, F, O escrevem `normInverted(..., a, b)·100` e `norm(..., a, b)·100` — essa multiplicação extra pela 100 daria escala 0-10000 e quebra o intent (E,F,O ∈ [0,100]).

**Decisão:** tratar o `·100` trailing nas fórmulas como erro de digitação do spec. Os helpers `norm`/`normInverted` retornam 0-100 conforme §3.1 D3, e o `·100` nos termos das fórmulas é **descartado**. Verificação: com essa interpretação, E = 0.60·(0-100) + 0.25·(0-100) + 0.15·(0-100) = 0-100 ✓.

**Blast radius:** zero — é a única interpretação que fecha a aritmética. Worker task 02 implementa direto sem re-ambiguar.

#### DEC-AUTO-119-04 — Clamp de `suggestedStage` em [1, stageCurrent-1] (Worker, task 05)

**Contexto:** `detectRegressionSignal` usa `suggestedStage = min(mappedStage, stageCurrent - 1)`. Em stage 1, `stageCurrent - 1 = 0` quebra a enum 1..5. Gatilho 3 só dispara se `mappedStage < stageCurrent`, então em stage 1 o gatilho 3 não dispara; mas gatilhos 1 e 2 podem disparar com stageCurrent=1 e caem no mesmo `min(1, 0) = 0`.

**Decisão:** clamp explícito `max(1, min(mappedStage, stageCurrent - 1))`. Semântica: "já está no stage mais baixo, não há regressão possível abaixo disso" — a regressão é sinalizada por `detected=true + reasons`, mas `suggestedStage` permanece 1 (sentinel que o consumer interpreta como "no piso").

**Blast radius:** zero — alternativa (`null` em stage 1) exige branching adicional nos consumers. `1` é consistente com o contrato do tipo (`1..5 | null`).

#### DEC-AUTO-119-05 — `firestore.rules` usa helpers existentes, não `users.role` (Worker, task 06)

**Contexto:** §3.1 D10 mostra o bloco de rules com check inline `get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'mentor'`, mas o codebase já tem helper `isMentor()` (email hardcoded do mentor único) e não existe schema `users.role`.

**Decisão:** manter consistência com blocos `assessment`, `emotionalProfile`, `reviews` que usam `isMentor()`. Seguir D10 literal exigiria migração de schema separada, fora de escopo. Final:

```
match /students/{studentId}/maturity/{docId=**} {
  allow read: if isAuthenticated() && (isOwner(studentId) || isMentor());
  allow write: if false;
}
```

**Blast radius:** zero — equivalência funcional ("mentor lê alunos dele" é o comportamento efetivo de `isMentor()` num sistema de mentor único).

#### DEC-AUTO-119-task06-01..04 (Worker, task 06) — não consolidadas

Decisões de implementação menor (posição do bloco em `firestore.rules`, regex de data permissiva, counts `number>=0` sem int estrito). Comentários em código já documentam; não reusáveis entre sessões.

#### DEC-AUTO-119-06 — Path `history` como sub-sub-collection literal com sentinel `_historyBucket` (Worker, task 07)

**Contexto:** §3.1 D10 descreve `students/{uid}/maturity/history/{YYYY-MM-DD}`. Firestore exige paths alternando col/doc; `maturity/history/{YYYY-MM-DD}` literal tem 5 segmentos, que interpretaria `{YYYY-MM-DD}` como nome de collection. Task 07 ofereceu três alternativas (recursiva literal, docId prefixado, subcollections irmãs).

**Decisão:** implementar como sub-sub-collection literal inserindo um doc-sentinel `_historyBucket` para preservar os segmentos `maturity/history/`:

```
students/{uid}/maturity/current                                ← doc direto
students/{uid}/maturity/_historyBucket/history/{YYYY-MM-DD}    ← sub-sub-collection
```

Usado em `recomputeMaturity.js`, `useMaturityHistory.js`. Consumers navegam com `.collection('maturity').doc('_historyBucket').collection('history')`. Doc `_historyBucket` em si nunca é lido/escrito; é container implícito para a subcollection.

**Blast radius:** zero — `firestore.rules` cobre via `{docId=**}` recursivo (DEC-AUTO-119-05). Escolha interna de persistência; UI/engine consomem shapes D10.

#### DEC-AUTO-119-07 — Stubs neutros em `functions/maturity/preComputeShapes.js` (Worker, task 07)

**Contexto:** orchestrator CF recebe shapes pré-computados (`stats`, `payoff`, `maxDrawdown`, `consistencyCV`, `complianceRate`, `evLeakage`, `emotionalAnalysis`, `advancedMetricsPresent`, `complianceRate100`). Nenhum dos utils correspondentes em `src/utils/` (`calculations.js`, `dashboardMetrics.js`, `emotionalAnalysisV2.js`) está mirrored em `functions/`. Fazer mirror completo agora seria CHUNK-06 escrita sem lock. Task spec permite "STUB com cálculo degradado + TODO mirror".

**Decisão:**
- Utils pequenos e puros (≤40 linhas) mirrored localmente em `functions/maturity/preComputeShapes.js` com logic idêntica à `src/`: `calcStats`, `calcPayoff`, `calcMaxDrawdown`, `calcConsistencyCV`, `calcComplianceRate`.
- Utils pesados/com dependência de config: stubs neutros — `emotionalAnalysis = { periodScore: 50, tiltCount: 0, revengeCount: 0 }`, `evLeakage = null`, `advancedMetricsPresent = false`, `complianceRate100 = complianceRate` (placeholder — variante "últimos 100 trades" idêntica ao total por ora).

**Blast radius:** baixo — dimensão E fica neutra (50) no CF até mirror dedicado do `emotionalAnalysisV2`. Gates `financial-fortified`/`compliance-100` (stage 3-4) podem falhar por stub em `advancedMetricsPresent`/`complianceRate100` — aceitável em v1; gate `METRIC_UNAVAILABLE` aparece como "pendente" sem bloquear a evolução visível.

**Follow-up:** issue separado para mirror completo de `emotionalAnalysisV2`/`calculateEVLeakage` em `functions/` quando houver prioridade.

#### DEC-AUTO-119-08 — Injeção opcional de `admin` em `runMaturityRecompute` para testabilidade (Worker, task 07)

**Contexto:** `runMaturityRecompute` usa `admin.firestore.FieldValue.serverTimestamp()` e `admin.firestore.Timestamp.fromDate()`. `firebase-admin` só está instalado em `functions/node_modules/`, não no root do projeto onde Vitest roda. `vi.mock('firebase-admin')` não intercepta `require()` confiavelmente (ESM vs CJS module graph).

**Decisão:** assinatura `runMaturityRecompute(db, { tradeId, trade, admin: adminOverride })` — param opcional `admin`. Em produção (`index.js`) omitido, cai no `require('firebase-admin')` lazy interno. Em teste, injeta-se um fake admin com as duas APIs necessárias. Extendido em task 09 (`recomputeForStudent`) e task 13 (`runClassify`).

**Blast radius:** zero — contrato preservado (CF não passa `admin`, comportamento idêntico). `buildMaturityPayloads` (pura) continua testável sem admin.

#### DEC-AUTO-119-09 — Auth simples no callable `classifyMaturityProgression` (Worker, task 13)

**Contexto:** §3.1 D12 não especifica política de auth para o callable. Opções: mentor-only, self-only, qualquer auth válida.

**Decisão:** aceitar qualquer `request.auth` válido. A restrição de leitura (aluno vê só próprio, mentor vê alunos dele) já está no `firestore.rules` (DEC-AUTO-119-05). O callable grava em `maturity/current` — leitura cross-student é bloqueada no client.

**Blast radius:** zero — ataque "aluno X gera narrativa para aluno Y" só queima cota, não vaza dado (leitura bloqueada). Se virar problema de custo, refinar para self-only no futuro.

#### DEC-AUTO-119-10 — `baselineScores` = `dimensionScores` atual como placeholder (Worker, task 14)

**Contexto:** `classifyMaturityProgression` exige `baselineScores` (schema D12). O doc `maturity/current` (D10) não persiste scores de baseline — apenas `baselineStage`. O lookup real seria em `students/{uid}/assessment/initial_assessment.dimensionScores`, para o qual não há hook exposto no StudentDashboard.

**Decisão:** passar `maturity.dimensionScores` (scores atuais) como placeholder para `baselineScores` no payload do callable. Isso mantém o validator satisfeito sem adicionar fetch extra ou refatorar a CF para tornar o campo opcional. Prompt Sonnet ainda recebe `baselineStage` correto (do doc), então a análise comparativa continua viável — só perde a granularidade "quanto cada dimensão evoluiu em pontos". Narrativa segue focada em trigger + stage + gates, que são fontes primárias.

**Blast radius:** baixo — a CF imprime os scores no prompt ("Scores de baseline ... Emocional: X"), mas Sonnet tipicamente foca em stage + gates + trigger para a narrativa. Refinar quando houver hook que exponha `initial_assessment.dimensionScores` ou quando engine persistir snapshot dos scores no momento do baseline.

**Follow-up:** issue separado se for priorizado.

---

## §4 SESSÕES

### Sessão — 23/04/2026 — Abertura (CC-Interface)

Marcio invocou "atacar issue 119 no modo autônomo". Protocolo §13 iniciado.

**Fase 1 Setup NO MAIN (§13.8):**
- Verificado PROJECT.md v0.35.0 (INV-14)
- Verificado `gh issue view 119`
- Chunks validados em §6.3 — CHUNK-09 AVAILABLE, 04/05/06/08 AVAILABLE
- Lock CHUNK-09 registrado em §6.3 do PROJECT.md
- PROJECT.md bump 0.35.0 → 0.36.0 + entrada de histórico
- `src/version.js` bump 1.42.1 → 1.43.0 reservada + entrada CHANGELOG inline `[RESERVADA]`
- Commit main: `487cd9a0` — `docs: registrar lock CHUNK-09 + reservar v1.43.0 para issue-119`
- Worktree criado: `~/projects/issue-119` em branch `feat/issue-119-maturidade-engine`

**Fase 2 Desambiguação (§13.8 passos 9-16):**
Marcio corrigiu 3 vezes meu entendimento do protocolo §13 antes da desambiguação do issue:
1. Topologia dos atores (Coord/Worker falam comigo, não com ele direto)
2. Canal de sinalização humana (email → Marcio acorda CC-Interface)
3. Lifecycle (CC-Interface não morre; fica vivo em idle toda a issue)

Depois do remapping correto, desambiguação do issue em bloco único com Plan agent (fórmulas) + Explorer agent (inputs) correndo em paralelo. Marcio validou/ajustou 7 pontos:
1. `hasJournal(t)` = notes ≥10 OU emotionEntry ✔
2. Maturidade como resultado emergente das outras ✔
3. Gates 1→2 — Plan alucinou citações de linha; revisei com origem explícita (3 framework + 3 regra de produto), aprovado ✔
4. Gates 4→5 — 9 gates propostos, aprovado ✔
5. Sharpe em daytrade via retornos diários agregados ✔
6. Regressão visível ao aluno tom "espelho" (opção c) ✔
7. INV-15 aprovada com análise de custo (~$0.60/mês em 1k alunos) ✔

**Próximo passo:** apresentar plano de 20 tasks para aprovação → spawn Coord via `cc-spawn-coord.sh` + `cc-worktree-start.sh` + `cc-dispatch-task.sh FIRST`.

### Sessão — 23/04/2026 — Loop autônomo (CC-Coord + CC-Worker)

Plano de 20 tasks (§3.1 D19) executado sequencialmente:

- **Fase A — Engine puro (tasks 01-05):** fixtures + helpers puros, dimensões E/F/O/M, `evaluateGates`, `proposeStageTransition`, `detectRegressionSignal`, orquestrador `evaluateMaturity`. 
- **Fase B — Persistência (tasks 06-09):** `firestore.rules` + schema validator, CF `onTradeCreated`/`onTradeUpdated` com recálculo isolado via try/catch, hooks `useMaturity`/`useMaturityHistory`, script admin `backfillMaturity.js`.
- **Fase C — UI aluno (tasks 10-12):** `MaturityProgressionCard` + wire StudentDashboard + simplificação quadrante E3 Matriz 4D + gates colapsáveis mobile.
- **Fase D — IA (tasks 13-14):** CF callable `classifyMaturityProgression` Sonnet 4.6 + wire narrativa com trigger UP/REGRESSION + cache.
- **Fase E — Review (tasks 15-16):** freeze `maturitySnapshot` no close + `MaturityComparisonSection` N vs N-1.
- **Fase F — Mentor (tasks 17-18):** `MaturitySemaphoreBadge` na Torre + `MentorMaturityAlert` card expandível.
- **Fase G — Fechamento (tasks 19-20):** artefatos de encerramento (esta task 19) + validação browser/QA (task 20).

**10 decisões autônomas canonicalizadas** (§3.2 DEC-AUTO-119-01..10). Cada uma resolveu ambiguidade não coberta em §3.1 pela ordem `spec → PROJECT.md → padrão do projeto → menor blast radius`.

**Testes:** baseline 1890 → 2252 (+362), zero regressão.

### Sessão — 23/04/2026 — Encerramento task 19 (CC-Worker)

Artefatos finais de documentação:
- §5 atualizado com deltas paste-ready para integrador aplicar no main pós-merge (`src/version.js` §5.1 + `docs/PROJECT.md` §5.2 actions a-e)
- §3.2 consolidado: 10 DEC-AUTO-119 em ordem numérica clean (01..10), duplicatas removidas
- §4 Sessões atualizado com resumo do loop autônomo + entrada desta task
- Sanity check: `npm test -- --run` = 2252/2252 passed

**Nenhum shared file foi tocado no worktree** (CLAUDE.md §4). Deltas para `src/version.js` e `docs/PROJECT.md` ficam documentados em §5 para aplicação pelo integrador.

---

## §5 DELTAS EM SHARED FILES (para integrador aplicar no main pós-merge)

> Shared files `src/version.js` e `docs/PROJECT.md` **NÃO** são editados no worktree (CLAUDE.md §4 — "locks e edições em shared files são feitos e commitados no main ANTES da criação do worktree"). Integrador aplica diretamente no `main` **após o merge do PR**.
>
> `firestore.rules` e `functions/index.js` foram editados na própria branch como parte do código do PR (tasks 06, 07, 13) — **não** são tocados nesta etapa.

### §5.1 `src/version.js` — finalizar entrada v1.43.0

**Action:** substituir a entrada atual (com `[RESERVADA — entrada definitiva no encerramento.]` na última linha) pelo texto definitivo abaixo. O bloco da constante `VERSION` já está correto (`1.43.0` / `20260423`) — nada a mexer nele.

**Buscar e substituir** o parágrafo atual da v1.43.0 no `CHANGELOG` (linhas ~6-17 de `src/version.js`) pelo bloco:

```js
 * - 1.43.0: feat: Motor de progressão Maturidade 4D × 5 estágios (issue #119, modo autônomo, 20 tasks).
 *   Engine puro em `src/utils/maturityEngine/` (11 módulos: helpers, fixtures, constants,
 *   computeEmotional, computeFinancial, computeOperational, computeMaturity, evaluateGates,
 *   proposeStageTransition, detectRegressionSignal, evaluateMaturity, maturityDocSchema).
 *   Persistência `students/{uid}/maturity/current` (doc) + `maturity/_historyBucket/history/{YYYY-MM-DD}`
 *   (sub-sub-collection — DEC-AUTO-119-06). CF `onTradeCreated`/`onTradeUpdated` com recálculo
 *   isolado (try/catch — INV-03). Script admin `functions/maturity/backfillMaturity.js` CLI com
 *   dry-run/concurrency/per-student-id. Hooks `useMaturity` + `useMaturityHistory` +
 *   `useMentorMaturityOverview` (collectionGroup) + `useReviewMaturitySnapshot`. UI: card
 *   `MaturityProgressionCard` no StudentDashboard com 5 stages colapsáveis mobile, substitui
 *   sparkline Maturidade do quadrante E3 da Matriz 4D (consolidação, INV-17). CF callable
 *   `classifyMaturityProgression` Sonnet 4.6 (temp 0.3, max 1500) em UP/REGRESSION com fallback
 *   silencioso. Review snapshot: freeze `maturitySnapshot` no close da WeeklyReviewPage +
 *   comparativo N vs N-1 via `MaturityComparisonSection` (scoreDeltas + gateDeltas). Mentor:
 *   semáforo 🟢🟡🔴 por aluno via `MaturitySemaphoreBadge` na Torre + `MentorMaturityAlert`
 *   card expandível de regressões. Janela rolling por stage (20/30/50/80/100 trades, piso 5),
 *   composite 0.25·E + 0.25·F + 0.20·O + 0.30·M, DEC-020 respeitada (engine detecta regressão
 *   mas NUNCA rebaixa automaticamente). 33 gates totais distribuídos nas 4 transições (6+8+10+9),
 *   8 delas do framework §5.3/§9.2 literal. Regressão visível ao aluno tom "espelho" (diretriz
 *   inegociável Marcio 23/04/2026). Evolução sempre visível — engine NUNCA retorna null;
 *   amostra < 5 trades → blend com baseline + confidence LOW. DEC-086 registrada. 10 decisões
 *   autônomas (DEC-AUTO-119-01..10). Follow-ups: mirror completo de `emotionalAnalysisV2` +
 *   `calculateEVLeakage` em `functions/maturity/preComputeShapes.js` (DEC-AUTO-119-07), rules
 *   live tests via `@firebase/rules-unit-testing` (task 06), `baselineScores` fetch via
 *   `initial_assessment` (DEC-AUTO-119-10). 2252 testes verdes (baseline 1890 + 362 novos).
```

### §5.2 `docs/PROJECT.md` — entradas de encerramento

#### Action (a) — header: bump `0.36.0 → 0.37.0`

**Linha 4** substituir:
```markdown
> **Versão:** 0.36.0
```
Por:
```markdown
> **Versão:** 0.37.0
```

**Linha 5** substituir a "Última atualização" atual (que cobre `v0.36.0: Abertura #119 ...`) por:
```markdown
> **Última atualização:** 23/04/2026 — v0.37.0: Encerramento #119 v1.43.0. Motor de progressão Maturidade 4D × 5 estágios entregue em modo autônomo via 20 tasks (A1-A5 engine puro + B1-B4 persistência/CF/hooks/backfill + C1-C3 UI aluno + D1-D2 IA Sonnet 4.6 + E1-E2 review snapshot/comparativo + F1-F2 mentor semáforo/alert + G1-G2 closure). 362 testes novos (total 2252). DEC-086 registrada. 10 decisões autônomas (DEC-AUTO-119-01..10). Lock CHUNK-09 liberado. Baseado em v0.36.0.
```

(A antiga linha "Última atualização" vira "Última atualização (histórica)" — mesmo padrão das linhas subsequentes.)

#### Action (b) — tabela §1 Histórico de versões do documento

Adicionar **abaixo da linha `| 0.36.0 | 23/04/2026 | Abertura #119 ... |`** (atualmente na linha 84 do arquivo):

```markdown
| 0.37.0 | 23/04/2026 | Encerramento #119 v1.43.0 Motor de progressão Maturidade 4D | Motor de evolução 4D × 5 stages entregue em modo autônomo (20 tasks). Engine puro em `src/utils/maturityEngine/` (11 módulos) + persistência `students/{uid}/maturity/current` (doc) + `maturity/_historyBucket/history/{YYYY-MM-DD}` (sub-sub-collection, DEC-AUTO-119-06) via CF `onTradeCreated`/`onTradeUpdated` com recálculo isolado (try/catch, INV-03) + script admin `functions/maturity/backfillMaturity.js` + 4 hooks (`useMaturity`, `useMaturityHistory`, `useMentorMaturityOverview` via collectionGroup, `useReviewMaturitySnapshot`). UI aluno: `MaturityProgressionCard` no StudentDashboard com gates colapsáveis mobile, substitui sparkline Maturidade do quadrante E3 da Matriz 4D (consolidação INV-17). CF callable `classifyMaturityProgression` Sonnet 4.6 (temp 0.3, max 1500) em UP/REGRESSION com fallback silencioso. Review: freeze `maturitySnapshot` no close da WeeklyReviewPage + `MaturityComparisonSection` N vs N-1 (scoreDeltas + gateDeltas). Mentor: `MaturitySemaphoreBadge` 🟢🟡🔴 na Torre + `MentorMaturityAlert` card expandível de regressões. Janela rolling por stage (20/30/50/80/100 trades, piso 5), composite 0.25·E+0.25·F+0.20·O+0.30·M, 33 gates nas 4 transições (6+8+10+9), 8 literais do framework §5.3/§9.2. **Evolução sempre visível — engine NUNCA retorna null**; amostra < 5 trades → blend com baseline + confidence LOW. **DEC-020 respeitada** (engine detecta regressão, nunca rebaixa automaticamente). Regressão visível ao aluno tom "espelho" (diretriz inegociável Marcio 23/04/2026). 362 testes novos (total 2252). 10 decisões autônomas canonicalizadas em §3.2 do control file (DEC-AUTO-119-01..10). DEC-086 registrada. Follow-ups: (i) mirror completo de `emotionalAnalysisV2` + `calculateEVLeakage` em `functions/maturity/preComputeShapes.js` (DEC-AUTO-119-07); (ii) rules live tests via `@firebase/rules-unit-testing` (task 06); (iii) `baselineScores` fetch via `initial_assessment.dimensionScores` em `classifyMaturityProgression` payload (DEC-AUTO-119-10). Lock CHUNK-09 liberado (AVAILABLE). |
```

#### Action (c) — §7 Decision Log: adicionar DEC-086

**Abaixo da linha do DEC-085** (atualmente linha 922 — `| DEC-085 | **Carry-over de takeaways ...` ) acrescentar:

```markdown
| DEC-086 | **Motor de evolução Maturidade 4D × 5 stages** — engine puro + gates hardcoded + fórmulas e janela rolling fixas na v1.43.0. Maturidade é dimensão **emergente** (função de E/F/O + gates_met_history + self-awareness), nunca medida isolada. Regressão detectada mas nunca aplicada automaticamente (DEC-020 respeitada — `stage.current` só muda por ação manual de mentor/system-boot, registrada em `stageHistory[]`). **Evolução sempre visível** — engine NUNCA retorna null; amostra < 5 trades → blend com baseline + `confidence: 'LOW'` + `sparseSample: true`. 33 gates distribuídos nas 4 transições (6+8+10+9), dos quais 8 literais do framework `trader_evolution_framework.md` §5.3/§9.2 (os outros 25 são regras de produto Espelho ou propostas aprovadas). Regressão visível ao aluno no `MaturityProgressionCard`, tom "espelho" (diretriz inegociável Marcio 23/04/2026 — opção c em review). Composite `0.25·E + 0.25·F + 0.20·O + 0.30·M` fixo nesta versão (mentor config futuro). Janelas rolling por stage: 20/30/50/80/100 trades, piso absoluto 5. Persistência: `students/{uid}/maturity/current` (1 doc, snapshot corrente) + `maturity/_historyBucket/history/{YYYY-MM-DD}` (1 doc/dia, via sub-sub-collection — DEC-AUTO-119-06). Recálculo via CF `onTradeCreated`/`onTradeUpdated` isolado por try/catch (INV-03); script admin `backfillMaturity.js` para backfill de alunos existentes. IA (Sonnet 4.6, temp 0.3, max 1500) dispara só em transição UP ou regressão detectada — fallback silencioso sem consumir cota. 10 decisões autônomas canonicalizadas em `docs/dev/issues/issue-119-maturidade-engine.md` §3.2 (DEC-AUTO-119-01..10). | #119 | 23/04/2026 |
```

#### Action (d) — §6.3 Registry de Chunks: liberar lock CHUNK-09

Na sub-seção **"Locks ativos:"** (atualmente linhas 795-798), **remover integralmente** a linha:

```markdown
| CHUNK-09 | #119 | `feat/issue-119-maturidade-engine` | 23/04/2026 | Modo autônomo (CC-Interface + Coord + Worker) — escopo 6 fases (A engine puro + B persistência CF + C UI aluno + D IA Sonnet 4.6 + E review snapshot + F mentor Torre) |
```

Após a remoção, se a tabela ficar vazia (apenas o cabeçalho), manter o cabeçalho + uma linha com `| — | — | — | — | nenhum lock ativo |` **ou** deixar apenas o cabeçalho (padrão observado nas entradas históricas 0.10.2 e 0.22.1).

A **tabela principal** (linha 785) já registra `CHUNK-09 | ... | AVAILABLE` — não requer alteração (`AVAILABLE` é o estado steady-state; só a entrada em "Locks ativos" precisa ser removida).

#### Action (e) — §10 CHANGELOG: entrada v1.43.0 (Keep a Changelog)

**No topo da seção §10** (linha 984+), **antes da entrada `[meta-infra v0.35.0]`** (linha 989), inserir:

```markdown
### [1.43.0] - 23/04/2026

**Issue:** #119 (feat: Motor de progressão Maturidade 4D × 5 estágios)
**Modo:** Autônomo (CC-Interface + CC-Coord + CC-Worker — §13 protocolo)
**PR:** (a preencher quando mergeado)

#### Adicionado

- **Engine puro `src/utils/maturityEngine/`** (11 módulos): `helpers.js`, `fixtures.js`, `constants.js` (`STAGE_WINDOWS`, `STAGE_BASES`, `COMPOSITE_WEIGHTS`, `GATES_BY_TRANSITION`), `computeEmotional.js`, `computeFinancial.js`, `computeOperational.js`, `computeMaturity.js`, `evaluateGates.js`, `proposeStageTransition.js`, `detectRegressionSignal.js`, `evaluateMaturity.js` (orquestrador), `maturityDocSchema.js` (validator). Puro — zero Firestore, zero `fetch`, zero `Date.now()` direto.
- **Persistência Firestore**: `students/{uid}/maturity/current` (1 doc snapshot corrente) + `students/{uid}/maturity/_historyBucket/history/{YYYY-MM-DD}` (sub-sub-collection com sentinel `_historyBucket`, DEC-AUTO-119-06). Shape completo em §3.1 D10 do control file.
- **CF `onTradeCreated` / `onTradeUpdated`**: passo novo de recálculo maturity **isolado em try/catch** (INV-03) — falha em maturity NÃO bloqueia PL/compliance/emotional scoring. Recálculo apenas quando `status === 'CLOSED'` (ignora IMPORTED/REVIEWED/QUESTION/OPEN).
- **CF callable `classifyMaturityProgression`** (Sonnet 4.6, `claude-sonnet-4-6`, temp 0.3, max_tokens 1500, secrets `ANTHROPIC_API_KEY`). Dispara **apenas** em `proposedTransition.proposed === 'UP'` OU `signalRegression.detected === true`. Cache em `maturity/current.aiNarrative*` até próximo trigger. Fallback determinístico silencioso (sem consumo de cota) em caso de falha.
- **Script admin `functions/maturity/backfillMaturity.js`** (CLI): dry-run por default, `--concurrency`, `--student-id`, logs estruturados. Para backfill de alunos existentes no boot.
- **4 hooks novos**: `useMaturity(studentId)` (listener em `current`), `useMaturityHistory(studentId, days)` (query range em `_historyBucket/history`), `useMentorMaturityOverview(mentorId)` (collectionGroup query), `useReviewMaturitySnapshot(reviewId, planId)`.
- **UI aluno — `MaturityProgressionCard`**: 5 stages em barra horizontal, preenchimento parcial no stage atual (`gatesMet/gatesTotal`), tooltip por gate pendente, marcador vermelho + mensagem tom "espelho" quando `signalRegression.detected`, narrativa IA em markdown, mobile com gates colapsáveis default (lista vira accordion). DebugBadge `component="MaturityProgressionCard"` (INV-04). Wired no `StudentDashboard` após Matriz Emocional 4D.
- **Consolidação INV-17**: sparkline Maturidade do quadrante E3 da Matriz Emocional 4D removida; quadrante agora mostra apenas stage atual + mini-barra de gates (forma compacta). Evita duplicação.
- **Review snapshot**: `review.maturitySnapshot` populado no fechamento da `WeeklyReviewPage` (#102 status=CLOSED). `MaturityComparisonSection` renderiza comparativo revisão N vs N-1 (scoreDeltas por dimensão + gateDeltas ganhos/perdidos + stage transitions).
- **Mentor — Torre de Controle**: `MaturitySemaphoreBadge` 🟢🟡🔴 por aluno na lista (`activeView === 'students'`). Verde = `proposedTransition.proposed === 'UP'` nos últimos 30 dias; Amarelo = `STAY` + gates estagnados > 30 dias (lê `history`); Vermelho = `signalRegression.detected`. Tooltip com "X/Y gates · faltam Z" ou mensagem de regressão.
- **Mentor — Overview**: `MentorMaturityAlert` card expandível na `activeView === 'overview'` com lista de regressões ordenadas por severity (HIGH/MED/LOW), blockers por aluno, link para drill-down. DebugBadge `component="MentorMaturityAlert"`.
- **`firestore.rules`**: bloco novo `match /students/{uid}/maturity/{docId=**}` — aluno lê próprio, mentor lê alunos dele (via helper `isMentor()`), só CF escreve. Ver DEC-AUTO-119-05.

#### Parâmetros fixos (DEC-086)

- **Composite:** `0.25·E + 0.25·F + 0.20·O + 0.30·M` (não configurável nesta versão)
- **Janela rolling por stage:** `{1: 20t/30d, 2: 30t/45d, 3: 50t/60d, 4: 80t/90d, 5: 100t/90d}` — piso absoluto 5 trades
- **Política de confidence:** HIGH (N ≥ floor+30), MED (floor ≤ N < floor+30), LOW (5 ≤ N < floor), LOW+`sparseSample` (N < 5 → blend com baseline)
- **33 gates totais:** 6 em 1→2 (3 framework §5.3 + 3 regras de produto) · 8 em 2→3 (framework §9.2 literal) · 10 em 3→4 (framework §9.2 literal) · 9 em 4→5 (propostos e aprovados)
- **DEC-020 respeitada:** `stage.current` NUNCA muda pela engine. Apenas `proposedTransition` e `signalRegression` — `stageHistory[]` é audit trail para mudanças manuais.
- **Evolução sempre visível:** engine NUNCA retorna null. Submetrica indisponível → valor neutro do stage atual + flag `neutralFallback`.

#### Testes

- **362 testes novos** (baseline 1890 + 362 = **2252/2252 passing**, zero regressão).
- Engine puro: unitários por dimensão (≥3 cenários cada), integração por stage (5 cenários ponta-a-ponta), política "evolução sempre visível" (5/15/30/50/100 trades), regressão (aluno Stage 3 com métricas Stage 2 → `signalRegression.detected=true`, `stage.current=3` inalterado), gates (thresholdMet e thresholdNotMet cases), helpers (`computeDailyReturns`, `computeSharpe`, `computeAnnualizedReturn`, `computeStrategyConsistencyWeeks`).
- Persistência/CF: mock Firestore + mock admin injection (DEC-AUTO-119-08).
- Hooks + UI: render cenários + estados vazios/loading + mobile collapse + IA narrativa states + trigger logic.
- Review: freeze + comparativo N vs N-1.
- Mentor: semáforo derivado + alert card com ordenação por severity.

#### Decisões autônomas (DEC-AUTO-119-01..10)

Canonicalizadas em `docs/dev/issues/issue-119-maturidade-engine.md` §3.2. Resumo:

1. **Short-circuit em `computeSharpe` para retornos constantes** (task 01)
2. **`void plans;` em `computeStrategyConsistencyWeeks`** para preservar assinatura spec (task 01)
3. **Fórmulas E/F/O com helpers em escala 0-100** (descarta `·100` trailing da spec, erro de digitação — task 02)
4. **Clamp de `suggestedStage` em [1, stageCurrent-1]** (task 05)
5. **`firestore.rules` usa helpers existentes `isMentor()`/`isOwner()`** em vez de `users.role` inline (task 06)
6. **Path `history` como sub-sub-collection com sentinel `_historyBucket`** (task 07)
7. **Stubs neutros em `preComputeShapes.js`** para `emotionalAnalysisV2` e `calculateEVLeakage` (task 07) — **follow-up**: mirror completo
8. **`admin` injetável em `runMaturityRecompute`** para testabilidade (task 07)
9. **Auth simples no callable `classifyMaturityProgression`** — qualquer `request.auth` válido (restrição real no `firestore.rules`) (task 13)
10. **`baselineScores` = `dimensionScores` atual como placeholder** no payload do callable (task 14) — **follow-up**: fetch via `initial_assessment.dimensionScores`

#### Follow-ups para próxima sessão

- Mirror completo de `emotionalAnalysisV2` + `calculateEVLeakage` em `functions/maturity/preComputeShapes.js` (hoje são stubs neutros — DEC-AUTO-119-07). Dimensão E no CF fica neutra (50) até esse mirror.
- Rules live tests via `@firebase/rules-unit-testing` em vez de apenas asserts grep-based sobre `firestore.rules` (task 06).
- `baselineScores` do callable `classifyMaturityProgression` puxado de `students/{uid}/assessment/initial_assessment.dimensionScores` em vez de placeholder (DEC-AUTO-119-10).

#### Shared files

- `src/version.js` bump `1.42.1 → 1.43.0` (reservada na abertura no commit main `487cd9a0`; entrada CHANGELOG definitiva aplicada neste encerramento).
- `docs/PROJECT.md` v0.36.0 → v0.37.0 (encerramento + DEC-086 + §6.3 unlock CHUNK-09 + §10 entrada definitiva).
- `firestore.rules`: bloco novo `match /students/{uid}/maturity/{docId=**}` (task 06, na branch).
- `functions/index.js`: export `classifyMaturityProgression` + wiring do passo maturity em `onTradeCreated`/`onTradeUpdated` via try/catch isolado (tasks 07 e 13, na branch).

#### Invariantes respeitadas

- **INV-02** (Gateway `addTrade` — leitura apenas)
- **INV-03** (Pipeline de side-effects inquebrável — recálculo de maturity é ramo isolado com try/catch; nunca propaga falha para PL/compliance/emotional)
- **INV-04** (DebugBadge em `MaturityProgressionCard` e `MentorMaturityAlert`)
- **INV-06** (Datas BR, semana começa segunda — em `computeStrategyConsistencyWeeks`)
- **INV-15** (Subcollection `students/{uid}/maturity/*` aprovada com análise de custo ~$0.60/mês em 1k alunos)
- **INV-17** (Card em Dashboard aluno + Mesa Mentor; sparkline removida do E3 — consolidação, não duplicação)
- **INV-18** (Spec Review Gate — 7 decisões antecipadas fechadas via bloco único com Marcio antes do spawn)
- **INV-27 + CLAIMS + validator** em todas as 20 tasks do modo autônomo.
```

#### Action (f) — §9 Dívidas Técnicas: (skip)

Os 3 follow-ups (mirror `emotionalAnalysisV2`, rules live tests, `baselineScores` fetch) estão documentados como **follow-ups em DEC-AUTO-119-07/10** e no CHANGELOG v1.43.0 acima. Não precisam virar DT-XXX formais nesta entrega — são refinamentos de escopo previamente aceitos, não passivo técnico descoberto. **Skip desta action.**

### §5.3 Arquivos da branch (já commitados, para referência do integrador)

- `firestore.rules` — bloco `match /students/{uid}/maturity/{docId=**}` (task 06, commit `eb1be726`)
- `functions/index.js` — export `classifyMaturityProgression` + wiring maturity em `onTradeCreated`/`onTradeUpdated` (tasks 07 e 13)
- `functions/maturity/*` — mirror CJS do engine, orchestrator `recomputeMaturity`, `preComputeShapes`, `backfillMaturity`, `runClassify`
- `src/utils/maturityEngine/*` — 11 módulos ESM puros
- `src/utils/maturitySemaphore.js` + `maturityDelta.js` + `maturityAITrigger.js`
- `src/hooks/useMaturity.js` + `useMaturityHistory.js` + `useMentorMaturityOverview.js` + `useReviewMaturitySnapshot.js`
- `src/components/MaturityProgressionCard.jsx` + `MaturitySemaphoreBadge.jsx` + `MentorMaturityAlert.jsx` + `MaturityComparisonSection.jsx`
- `src/pages/StudentDashboard.jsx` — wire do card (task 11); simplificação quadrante E3 Matriz 4D (task 11)
- `src/pages/WeeklyReviewPage.jsx` — freeze snapshot + comparativo (tasks 15, 16)
- `src/pages/MentorDashboard.jsx` — semáforo na lista + alert no overview (tasks 17, 18)
- Testes em `src/__tests__/*` (362 novos)

### §5.4 Arquivos NÃO tocados

`src/App.jsx`, `package.json`, `src/contexts/StudentContextProvider.jsx`, `src/utils/compliance.js`, `src/hooks/useComplianceRules.js` — apenas leitura do engine/CF. Não requerem delta.

---

## §6 CHUNKS

| Chunk | Modo | Motivo |
|-------|------|--------|
| CHUNK-09 | escrita | Novo domínio `students/{uid}/maturity/*` + componentes UI + CF + hook |
| CHUNK-04 | leitura | Trades como fonte primária do engine |
| CHUNK-05 | leitura | Compliance stats (`calculateComplianceRate`, `useComplianceRules`) |
| CHUNK-06 | leitura | Score emocional (`emotionalAnalysisV2.*`, `useEmotionalProfile`) |
| CHUNK-08 | leitura | Review history para `maturitySnapshot` (Fase E) |

### Status de lock

**Lock CHUNK-09 será liberado no merge do PR** — o integrador aplica o delta §5.2 Action (d) ao `docs/PROJECT.md` do main, removendo a linha da tabela "Locks ativos" da §6.3. A linha do registry principal (CHUNK-09 → AVAILABLE como status steady-state) já está correta e não requer alteração.
