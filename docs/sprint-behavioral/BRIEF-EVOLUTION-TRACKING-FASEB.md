# BRIEF-EVOLUTION-TRACKING.md
## Briefing de Sessão — Frente: Evolution Tracking (CHUNK-09 Fase B)
### Versão 1.0 — 22/03/2026

---

## 1. CONTEXTO

Esta frente implementa o **acompanhamento evolutivo 4D do aluno** após o marco zero (Fase A).
Inclui: reviews mensais 3 camadas, tradeScoreMapper (métricas→scores), gates de progressão,
mentor journal, timeline longitudinal.

**Pré-requisito:** Fase A mergeada e funcional. Pelo menos 1 aluno com assessment completo.
Os dados de trades começam a ser lidos após 30 dias de operação dentro do sistema.

**Referências:**
- `BRIEF-STUDENT-ONBOARDING-v3.md` seções 4.4 a 4.8 (estruturas Firestore)
- `BRIEF-STUDENT-ONBOARDING-v3.md` seção 4.5 (mapeamento métricas → scores)
- `BRIEF-STUDENT-ONBOARDING-v3.md` seções DEC-017 a DEC-020 (decisões)
- `trader_evolution_framework.md` Partes 5 e 7 (stages e progressão)

---

## 2. CHUNK CHECK-OUT

| Chunk | Status | Permissão |
|-------|--------|-----------|
| **CHUNK-09 Fase B** | A LOCKAR | ✅ CRIAR arquivos listados |
| CHUNK-04 (Trade Ledger) | READ-ONLY | ⚠️ LER trades para calcular métricas mensais, NÃO MODIFICAR |
| CHUNK-05 (Compliance) | READ-ONLY | ⚠️ LER compliance fields dos trades, NÃO MODIFICAR |
| CHUNK-06 (Emotional System) | READ-ONLY | ⚠️ LER emotional fields/TILT/REVENGE, NÃO MODIFICAR |
| CHUNK-09 Fase A | READ-ONLY | ⚠️ LER assessment/initial_assessment para baseline, NÃO MODIFICAR |
| Todos os demais | BLOQUEADO | ❌ NÃO TOCAR |

**Branch:** `feature/student-onboarding` (continuação da Fase A)

---

## 3. FIRESTORE — ESTRUTURAS NOVAS

### 3.1 Review Mensal (DEC-017, DEC-018)

```javascript
// students/{studentId}/assessment/ongoing_tracking/monthly_reviews/{YYYY-MM}
{
  period: "2026-04",
  reviewDate: Timestamp,
  reviewedBy: string,

  // Camada 1: scores automáticos dos trades do período
  trades_scores: {
    emotional: {
      recognition: number, regulation: number, locus: number,
      score: number,
      metrics_used: {
        emotionVariety: number,       // Shannon entropy
        tiltFrequency: number,
        revengeFrequency: number,
        postLossAvgInterval: number,  // minutos
        sizingAfterLoss: string       // "increases" | "maintains" | "reduces"
      }
    },
    financial: {
      discipline: number, loss_management: number, profit_taking: number,
      score: number,
      metrics_used: {
        stopUsageRate: number,
        avgRiskPercent: number,
        maxDrawdown: number,
        payoff: number,
        winRate: number,
        evLeakage: number
      }
    },
    operational: {
      decision_mode: number, timeframe: number, strategy_fit: number, tracking: number,
      emotion_control: number,  // herdado de emotional.score
      score: number,
      metrics_used: {
        complianceRate: number,
        journalCompletionRate: number,
        tradingHoursCompliance: number
      }
    },
    experience: {
      stage: number,
      gates_met: number, gates_total: number,
      score: number,
      gates_detail: [{ id: string, met: boolean, value: number, threshold: number }]
    },
    composite: number,
    tradesAnalyzed: number,
    periodStart: Timestamp,
    periodEnd: Timestamp
  },

  // Camada 2: delta do mentor (DEC-018 — delta, não absoluto)
  mentor_deltas: {
    emotional: { delta: number, notes: string },
    financial: { delta: number, notes: string },
    operational: { delta: number, notes: string },
    experience: { delta: number, notes: string }
  },

  // Camada 3: scores finais blendados (DEC-017 — pesos variáveis)
  final_scores: {
    emotional: {
      score_trades: number,
      score_mentor_abs: number,    // clamp(score_trades + delta, 0, 100)
      score_final: number,         // (score_trades × 0.30) + (score_mentor_abs × 0.70)
      weight_trades: 0.30,
      weight_mentor: 0.70
    },
    financial: {
      score_trades: number,
      score_mentor_abs: number,
      score_final: number,
      weight_trades: 0.70,
      weight_mentor: 0.30
    },
    operational: {
      score_trades: number,
      score_mentor_abs: number,
      score_final: number,
      weight_trades: 0.50,
      weight_mentor: 0.50
    },
    experience: {
      score_trades: number,
      score_mentor_abs: number,
      score_final: number,
      weight_trades: 0.80,
      weight_mentor: 0.20
    },
    composite: number,
    composite_label: string
  },

  delta_vs_previous: { emotional: number, financial: number, operational: number, experience: number, composite: number },
  delta_vs_baseline: { emotional: number, financial: number, operational: number, experience: number, composite: number },
  dimension_notes: { emotional: string, financial: string, operational: string, experience: string },
  milestones: [string],
  blockers: [string],
  action_plan: string
}
```

### 3.2 Progression Log (DEC-019, DEC-020)

```javascript
// students/{studentId}/assessment/ongoing_tracking/progression_log/{timestamp}
{
  timestamp: Timestamp,
  action: "PROMOTE" | "HOLD" | "OVERRIDE_PROMOTE" | "OVERRIDE_HOLD" | "REGRESSION_WARNING" | "REGRESSION",
  fromStage: number,
  toStage: number | null,
  mentor: string,
  eligibility: {
    gates_met: number,
    gates_total: number,
    sustained_months: number,
    required_months: number,
    eligible: boolean
  },
  justification: string,
  hold_reason: string | null,
  hold_action_plan: string | null,
  override_gates_missing: [string] | null,
  override_justification: string | null
}
```

### 3.3 Mentor Journal

```javascript
// students/{studentId}/assessment/ongoing_tracking/mentor_journal/{timestamp}
{
  timestamp: Timestamp,
  mentor: string,
  type: "observation" | "intervention" | "concern" | "milestone",
  dimension: "emotional" | "financial" | "operational" | "experience" | "general",
  linkedTradeId: string | null,
  linkedPlanId: string | null,
  text: string,
  tags: [string],
  visibleToStudent: boolean
}
```

---

## 4. SCORING MENSAL — FÓRMULAS

### 4.1 Blending (DEC-017)

```
score_mentor_abs = clamp(score_trades + mentor_delta, 0, 100)
score_final = clamp((score_trades × peso_trades) + (score_mentor_abs × peso_mentor), 0, 100)
```

**Pesos por dimensão:**

| Dimensão | peso_trades | peso_mentor | Justificativa |
|---|---|---|---|
| Financeiro | 0.70 | 0.30 | Métricas diretas: stop rate, drawdown, RO%, payoff |
| Operacional | 0.50 | 0.50 | Proxies parciais: aderência ao plano, frequência, journal |
| Emocional | 0.30 | 0.70 | Proxies indiretos: TILT/revenge, entropy, padrões pós-loss |
| Experiência | 0.80 | 0.20 | Gates objetivos: métricas cumpridas vs exigidas |

**Nota sobre clamp:** Delta original preservado para auditoria mesmo se score estourar.

### 4.2 Mapeamento Métricas → Scores (tradeScoreMapper.js)

**Financeiro (alta confiabilidade):**
```
discipline = f(stopUsageRate, avgRiskPercent vs plano, positionSizeConsistency)
loss_management = f(maxDrawdown, avgLoser vs RO$, maxConsecutiveLosses)
profit_taking = f(payoff, winRate contextual, evLeakage)
score = (discipline × 0.40) + (loss_management × 0.40) + (profit_taking × 0.20)
```

**Operacional (confiabilidade média):**
```
decision_mode = f(complianceRate, entryQuality)
timeframe = f(tradingHoursCompliance, avgHoldTime vs timeframe)
strategy_fit = f(tickerConcentration, strategyConsistency)
tracking = f(journalCompletionRate, feedbackEngagement)
emotion_control = emotionalScore (herdado)
score = (decision_mode × 0.25) + (timeframe × 0.20) + (strategy_fit × 0.20) + (tracking × 0.15) + (emotion_control × 0.20)
```

**Emocional (confiabilidade baixa — proxies indiretos):**
```
recognition = f(emotionVariety/Shannon entropy, emotionAccuracy vs resultado)
regulation = f(tiltFrequency, revengeFrequency, postLossInterval)
locus = f(stopComplianceTrend, sizingAfterLoss)
score = (recognition + regulation + locus) / 3
```

**Experiência (alta confiabilidade via gates):**
```
score = stageBase + (gates_met / gates_total) × 20
```

**NOTA:** As funções `f()` acima precisam ser definidas com precisão na implementação. Cada `f()` mapeia uma ou mais métricas brutas para um score 0-100. A sessão de implementação deve propor as curvas de mapeamento (linear, step, sigmoid) para aprovação do Marcio ANTES de codificar.

### 4.3 Gates de Progressão (DEC-019)

Hardcoded em `progressionGates.js`. Avaliação híbrida: CF calcula elegibilidade, mentor confirma/veta.

**Stage 1 → 2 (Fundamentals):** minMonths=1
- G2-01: journalCompletionRate ≥ 80%
- G2-02: stopUsageRate ≥ 70%
- G2-03: emotionRegistrationRate ≥ 70%
- G2-04: maxConsecutiveLosses ≤ 6
- G2-05: respeita limite diário do plano

**Stage 2 → 3 (Consistency):** minMonths=3, sustainedPeriod=2 meses
- G3-01: winRate ≥ 45%
- G3-02: stopUsageRate ≥ 90%
- G3-03: maxDrawdown ≤ 10%
- G3-04: emotionalScore ≥ 55
- G3-05: complianceRate ≥ 80%
- G3-06: payoff ≥ 1.0
- G3-07: tiltFrequency ≤ 2/mês
- G3-08: mesma estratégia no período

**Stage 3 → 4 (Proficiency):** minMonths=6, sustainedPeriod=3 meses
- G4-01: winRate ≥ 50%
- G4-02: payoff ≥ 1.5
- G4-03: maxDrawdown ≤ 8%
- G4-04: emotionalScore ≥ 65 (LEARNER+)
- G4-05: evLeakage ≤ 25%
- G4-06: zero TILT
- G4-07: zero REVENGE
- G4-08: stopUsageRate ≥ 98%

**Stage 4 → 5 (Mastery):** minMonths=12, sustainedPeriod=6 meses
- G5-01: compositeScore ≥ 80 (Professional)
- G5-02: ≥ 80% meses positivos no ano
- G5-03: Sharpe ≥ 1.0
- G5-04: emotionalScore ≥ 80 (SAGE)
- G5-05: ≥ 90% trades sem intervenção do mentor

### 4.4 Regressão (DEC-020)

- 2 meses falhando gates do stage anterior → `REGRESSION_WARNING`
- 3 meses → `REGRESSION_ELIGIBLE`
- **Nunca automática** — mentor decide com justificativa

---

## 5. COMPONENTES REACT A CRIAR

| Componente | Responsabilidade |
|---|---|
| `MonthlyReviewForm.jsx` | Formulário 3 camadas: scores automáticos pré-calculados, inputs de delta por dimensão, notes. Mentor vê score_trades e aplica delta. |
| `TraderEvolutionTimeline.jsx` | Gráfico 4D (Recharts): 4 linhas + composite. Baseline → reviews mensais. Marcadores de eventos (milestones, regressions). |
| `ProgressionGateStatus.jsx` | Visualização gates cumpridos/faltantes por stage. Barra de progresso + lista de gates com status. |
| `PromotionDecisionModal.jsx` | Interface mentor: PROMOTE / HOLD / OVERRIDE_PROMOTE / OVERRIDE_HOLD com justificativa. Snapshot de elegibilidade. |
| `MentorJournalEntry.jsx` | Entrada de nota livre: tipo (observation/intervention/concern/milestone), dimensão, texto, tags, visibilidade. |
| `MentorJournalList.jsx` | Timeline de notas por aluno, filtrável por dimensão/tipo. Ordem cronológica reversa. |

---

## 6. UTILS A CRIAR

| Util | Responsabilidade |
|---|---|
| `tradeScoreMapper.js` | Mapeamento métricas brutas dos trades → scores 4D por dimensão. Funções `f()` da seção 4.2. |
| `evolutionCalculator.js` | Blending score_trades + mentor_delta com pesos variáveis. Clamp [0, 100]. Preserva delta original. |
| `progressionGates.js` | Definição hardcoded dos gates por stage. Avaliador de elegibilidade. Lógica de regressão (warning/eligible). |

---

## 7. HOOKS A CRIAR

| Hook | Responsabilidade |
|---|---|
| `useMonthlyReview.js` | Gestão de reviews mensais: carregar histórico, criar novo, calcular deltas vs previous/baseline. |
| `useEvolutionTimeline.js` | Série temporal de scores (baseline + reviews) para gráfico 4D. |
| `useProgressionGates.js` | Estado dos gates do aluno + elegibilidade + regression status. |
| `useMentorJournal.js` | CRUD do journal livre do mentor. Filtros por tipo/dimensão. |

---

## 8. CLOUD FUNCTIONS A CRIAR

| CF | Tipo | O que faz | Leituras |
|---|---|---|---|
| `calculateMonthlyScores` | callable | Extrai métricas do período dos trades → calcula score_trades 4D | `trades` (CHUNK-04), compliance fields (CHUNK-05), emotional fields (CHUNK-06) |
| `evaluateProgression` | callable | Avalia elegibilidade contra gates do stage atual | monthly_reviews, progression_log, progressionGates.js |

**NOTA CRÍTICA:** `calculateMonthlyScores` faz queries de leitura sobre trades/compliance/emotional — **não escreve nada** nessas collections. O resultado é gravado exclusivamente em `monthly_reviews`.

---

## 9. DEPENDÊNCIAS DE LEITURA (READ-ONLY)

| Chunk | O que lê | Métricas extraídas |
|---|---|---|
| CHUNK-04 (Trades) | `trades` collection | winRate, avgWinner, avgLoser, drawdown, holdTime, frequency, tickerConcentration |
| CHUNK-05 (Compliance) | Compliance fields nos trades | stopUsageRate, complianceRate, riskPercent vs plano |
| CHUNK-06 (Emotional) | Emotional fields + TILT/REVENGE | emotionVariety (Shannon entropy), tiltFrequency, revengeFrequency, postLossInterval, sizingAfterLoss |
| CHUNK-09 Fase A | `initial_assessment` | Baseline scores para cálculo de delta_vs_baseline |

---

## 10. ESCOPO — O QUE NÃO FAZER

❌ NÃO modificar nenhum arquivo da Fase A
❌ NÃO modificar `trades`, `plans`, `accounts`, `emotions`
❌ NÃO alterar CFs existentes (`onTradeCreated`, `onTradeUpdated`)
❌ NÃO alterar hooks existentes (`useTrades`, `usePlans`, etc.)
❌ Shared files via MERGE-INSTRUCTIONS apenas

---

## 11. TESTES OBRIGATÓRIOS

- `tradeScoreMapper.test.js` — Mapeamento métricas → scores por dimensão, edge cases (zero trades, trades sem stop, etc.)
- `evolutionCalculator.test.js` — Blending com pesos variáveis, clamp, preservação delta, null handling
- `progressionGates.test.js` — Gates por stage, elegibilidade, sustainedPeriod, regression warning/eligible

---

## 12. ACCEPTANCE CRITERIA

- [ ] CF calculateMonthlyScores funcional (extrai métricas reais dos trades)
- [ ] CF evaluateProgression funcional (avalia gates)
- [ ] tradeScoreMapper: métricas → scores 4D com curvas de mapeamento aprovadas pelo Marcio
- [ ] evolutionCalculator: blending com clamp [0, 100] e preservação delta
- [ ] Gates hardcoded em progressionGates.js (4 transições de stage)
- [ ] MonthlyReviewForm: 3 camadas (scores automáticos + delta + notes)
- [ ] Pesos variáveis por dimensão: Fin 0.70/0.30, Ope 0.50/0.50, Emo 0.30/0.70, Exp 0.80/0.20
- [ ] TraderEvolutionTimeline: gráfico Recharts 4D baseline → reviews
- [ ] ProgressionGateStatus: gates cumpridos/faltantes visual
- [ ] PromotionDecisionModal: PROMOTE/HOLD/OVERRIDE + justificativa
- [ ] Regressão nunca automática — alerta + decisão mentor
- [ ] MentorJournalEntry + MentorJournalList funcionais
- [ ] Progression log: registro de promoções/retenções
- [ ] DebugBadge em todos os componentes
- [ ] Testes para tradeScoreMapper, evolutionCalculator, progressionGates
- [ ] Nenhum arquivo fora do escopo modificado
- [ ] MERGE-INSTRUCTIONS completo
- [ ] Zero impacto no sistema em produção

---

## DECISÕES APLICÁVEIS

| ID | Decisão |
|----|---------|
| DEC-017 | Scoring mensal 3 camadas com pesos variáveis por dimensão |
| DEC-018 | Mentor aplica delta (não absoluto) |
| DEC-019 | Gates hardcoded, avaliação híbrida (CF + mentor) |
| DEC-020 | Regressão nunca automática |
| DEC-021 | Stage diagnosticado por IA (Fase A — referência) |
| DEC-022 | Marco zero tábula rasa (Fase A — referência para delta_vs_baseline) |

---

*Briefing Version 1.0 — 22/03/2026*
*Chunk: CHUNK-09 Fase B (Evolution Tracking)*
*Branch: feature/student-onboarding (continuação)*
*Escopo: Reviews mensais + tradeScoreMapper + gates de progressão + mentor journal + timeline*
