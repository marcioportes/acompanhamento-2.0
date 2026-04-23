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

_(vazio na abertura)_

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

---

## §5 DELTAS EM SHARED FILES (para PR final)

### `src/version.js` — v1.43.0 definitiva
- Entrada CHANGELOG inline com texto final (remover marca `[RESERVADA]`)
- VERSION com dados finais

### `docs/PROJECT.md` — no encerramento
- Bump minor para nova versão do doc (0.37.0+)
- Entrada na tabela de histórico (encerramento)
- §7 Decision Log: **DEC-086** (conteúdo em D18)
- §9 Dívidas Técnicas: registrar DT nova se MFE/MAE virar lacuna persistente
- §10 CHANGELOG: entrada v1.43.0 definitiva (replace da RESERVADA)
- §6.3 Locks ativos: remover CHUNK-09 (liberar)

### `functions/index.js`
- Export `classifyMaturityProgression` (Fase D)
- Triggers `onTradeCreated`/`onTradeUpdated` ganham passo maturity (Fase B) — verificar se já existem e fazer append do try/catch isolado

### `firestore.rules`
- Bloco novo `match /students/{uid}/maturity/{docId=**}` conforme D10

### Nenhum toque em: `src/App.jsx`, `package.json`, `src/contexts/StudentContextProvider.jsx`, `src/utils/compliance.js`, `src/hooks/useComplianceRules.js` — só leitura.

---

## §6 CHUNKS

| Chunk | Modo | Motivo |
|-------|------|--------|
| CHUNK-09 | escrita | Novo domínio `students/{uid}/maturity/*` + componentes UI + CF + hook |
| CHUNK-04 | leitura | Trades como fonte primária do engine |
| CHUNK-05 | leitura | Compliance stats (`calculateComplianceRate`, `useComplianceRules`) |
| CHUNK-06 | leitura | Score emocional (`emotionalAnalysisV2.*`, `useEmotionalProfile`) |
| CHUNK-08 | leitura | Review history para `maturitySnapshot` (Fase E) |
