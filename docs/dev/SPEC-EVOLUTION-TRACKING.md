# SPEC-EVOLUTION-TRACKING.md
## Especificação: Acompanhamento Evolutivo 4D
### Versão 1.0 — 20/03/2026

---

## 1. VISÃO GERAL

O sistema de acompanhamento evolutivo opera em 3 camadas:

1. **Score automático (score_trades):** Derivado das métricas reais dos trades no período, calculado por CF ou client-side
2. **Delta do mentor (mentor_delta):** Ajuste empírico por dimensão aplicado sobre score_trades
3. **Score final (score_final):** score_trades + mentor_delta, clampado em [0, 100]

O mentor não atribui score absoluto — ele calibra sobre o que o sistema já calculou. Isso reduz carga cognitiva (o mentor reage ao dado, não cria do zero) e preserva auditabilidade (sempre se sabe quanto veio dos trades e quanto veio do sentimento).

---

## 2. MODELO DE PONDERAÇÃO POR DIMENSÃO

Os pesos de score_trades vs score_mentor variam por dimensão conforme a confiabilidade das métricas automáticas:

| Dimensão | Peso score_trades | Peso score_mentor | Justificativa |
|---|---|---|---|
| **Financeiro** | 0.70 | 0.30 | Métricas diretas: stop rate, drawdown, RO%, payoff |
| **Operacional** | 0.50 | 0.50 | Proxies parciais: aderência ao plano, frequência, journal |
| **Emocional** | 0.30 | 0.70 | Proxies indiretos: TILT/revenge, entropy, padrões pós-loss |
| **Experiência** | 0.80 | 0.20 | Gates objetivos: métricas cumpridas vs exigidas |

**Fórmula por dimensão:**

```
score_blended = (score_trades × peso_trades) + (score_mentor_abs × peso_mentor)

onde:
  score_mentor_abs = clamp(score_trades + mentor_delta, 0, 100)
  
score_final = clamp(score_blended, 0, 100)
```

**Nota:** O mentor_delta é aplicado sobre score_trades para gerar score_mentor_abs, depois os dois são blendados com os pesos da dimensão. Isso significa que se score_trades=60 e mentor_delta=+10 na dimensão emocional:
- score_mentor_abs = 70
- score_final = (60 × 0.30) + (70 × 0.70) = 18 + 49 = 67

O delta do mentor tem mais influência no emocional (peso 0.70) e menos no financeiro (peso 0.30), refletindo a confiabilidade relativa das métricas automáticas.

---

## 3. MAPEAMENTO: MÉTRICAS DE TRADES → SCORES 4D

### 3.1 Financeiro (score_trades — alta confiabilidade)

```javascript
financial_trades = {
  discipline: calcFromMetrics({
    stopUsageRate,      // % de trades com stop → 100%=95, 80-99%=72, 50-80%=40, <50%=18, 0%=5
    avgRiskPercent,     // RO% médio vs plano → dentro=85, ±20%=65, ±50%=40, >50%=20
    positionSizeConsistency  // desvio padrão do sizing → baixo=80, médio=55, alto=25
  }),
  loss_management: calcFromMetrics({
    maxDrawdown,        // <5%=85, 5-10%=70, 10-15%=50, 15-25%=30, >25%=10
    avgLoser,           // vs RO$ do plano → dentro=80, 1.5x=55, 2x=30, >2x=10
    maxConsecutiveLosses // <3=85, 3-4=65, 5-6=45, >6=25
  }),
  profit_taking: calcFromMetrics({
    payoff,             // avgWin/avgLoss → >2.0=85, 1.5-2.0=70, 1.0-1.5=50, <1.0=25
    winRate,            // contextual: >60% com payoff>1.5=90, alto WR com payoff<1=40
    evLeakage           // <10%=85, 10-25%=65, 25-50%=40, >50%=20
  }),
  score: (discipline × 0.40) + (loss_management × 0.40) + (profit_taking × 0.20)
}
```

### 3.2 Operacional (score_trades — confiabilidade média)

```javascript
operational_trades = {
  decision_mode: calcFromMetrics({
    complianceRate,     // % trades compliant com regras do plano → >90%=85, 70-90%=65, <70%=35
    entryQuality        // % trades com setup documentado (tem HTF/LTF) → >80%=80, 50-80%=55, <50%=25
  }),
  timeframe: calcFromMetrics({
    tradingHoursCompliance, // % trades dentro do horário do plano → >95%=88, 80-95%=65, <80%=35
    avgHoldTime             // consistência com timeframe declarado → dentro=80, 2x=50, >3x=25
  }),
  strategy_fit: calcFromMetrics({
    tickerConcentration,    // opera nos tickers do plano? → >90%=85, 70-90%=60, <70%=30
    strategyConsistency     // variação de setup types → baixa=80, média=50, alta=20
  }),
  tracking: calcFromMetrics({
    journalCompletionRate,  // % trades com emoção registrada → >90%=85, 70-90%=60, <70%=25
    feedbackEngagement      // responde feedback do mentor? → sempre=80, parcial=50, nunca=15
  }),
  emotion_control: emotionalScore,  // herdado (igual ao assessment inicial)
  score: (decision_mode × 0.25) + (timeframe × 0.20) + (strategy_fit × 0.20) + 
         (tracking × 0.15) + (emotion_control × 0.20)
}
```

### 3.3 Emocional (score_trades — confiabilidade baixa, proxies indiretos)

```javascript
emotional_trades = {
  recognition: calcFromMetrics({
    emotionVariety,         // Shannon entropy das emoções registradas → alta=75, média=50, baixa=25
    emotionAccuracy         // correlação emoção registrada vs resultado → alta=80, baixa=35
    // proxy: quem registra sempre "confiante" em dias ruins não reconhece
  }),
  regulation: calcFromMetrics({
    tiltFrequency,          // episódios de TILT no período → 0=85, 1=65, 2-3=40, >3=20
    revengeFrequency,       // episódios de REVENGE → 0=85, 1=60, 2+=30
    postLossInterval        // tempo médio entre loss e próximo trade → >30min=80, 10-30=55, <10=25
  }),
  locus: calcFromMetrics({
    stopComplianceTrend,    // tendência de stop compliance ao longo do período → melhora=75, estável=55, piora=30
    // proxy: quem melhora compliance demonstra agency; quem piora pode estar externalizando
    sizingAfterLoss         // tamanho do trade após loss → reduz=80, mantém=55, aumenta=15
  }),
  score: (recognition + regulation + locus) / 3
}
```

### 3.4 Experiência (score_trades — alta confiabilidade via gates)

```javascript
experience_trades = {
  // Calculado automaticamente via progressionGates.js
  stage: currentStage,
  gates_met: countGatesMet(trades, currentStage),
  gates_total: getGatesForStage(currentStage + 1),
  score: stageBase + (gates_met / gates_total) × 20
}
```

---

## 4. GATES DE PROGRESSÃO

### 4.1 Definição dos Gates

Gates são definidos em `progressionGates.js` (hardcoded, versionados com o código). Cada stage tem um conjunto de gates que devem ser cumpridos para elegibilidade ao próximo stage. As métricas são extraídas automaticamente dos trades.

```javascript
// progressionGates.js
export const STAGE_GATES = {
  // Stage 1 → 2: Fundamentos
  2: {
    label: "Fundamentals",
    minMonths: 1,
    gates: [
      { id: "G2-01", metric: "journalCompletionRate", operator: ">=", value: 0.80, 
        label: "Journal >80% preenchido", dimension: "operational" },
      { id: "G2-02", metric: "stopUsageRate", operator: ">=", value: 0.70, 
        label: "Stop em >70% dos trades", dimension: "financial" },
      { id: "G2-03", metric: "emotionRegistrationRate", operator: ">=", value: 0.70, 
        label: "Emoção registrada >70%", dimension: "emotional" },
      { id: "G2-04", metric: "maxConsecutiveLosses", operator: "<=", value: 6, 
        label: "Max losses consecutivos ≤6", dimension: "financial" },
      { id: "G2-05", metric: "dailyTradeLimit", operator: "<=", value: "plan.maxDailyTrades", 
        label: "Respeita limite diário do plano", dimension: "operational" },
    ]
  },
  
  // Stage 2 → 3: Consistência
  3: {
    label: "Consistency",
    minMonths: 3,
    sustainedPeriod: 2,  // meses consecutivos cumprindo gates
    gates: [
      { id: "G3-01", metric: "winRate", operator: ">=", value: 0.45, 
        label: "Win rate ≥45%", dimension: "financial" },
      { id: "G3-02", metric: "stopUsageRate", operator: ">=", value: 0.90, 
        label: "Stop em >90% dos trades", dimension: "financial" },
      { id: "G3-03", metric: "maxDrawdown", operator: "<=", value: 0.10, 
        label: "Drawdown máximo ≤10%", dimension: "financial" },
      { id: "G3-04", metric: "emotionalScore", operator: ">=", value: 55, 
        label: "Score emocional ≥55", dimension: "emotional" },
      { id: "G3-05", metric: "complianceRate", operator: ">=", value: 0.80, 
        label: "Compliance >80%", dimension: "operational" },
      { id: "G3-06", metric: "payoff", operator: ">=", value: 1.0, 
        label: "Payoff ≥1.0", dimension: "financial" },
      { id: "G3-07", metric: "tiltFrequency", operator: "<=", value: 2, 
        label: "Máximo 2 episódios TILT/mês", dimension: "emotional" },
      { id: "G3-08", metric: "strategyChanges", operator: "<=", value: 0, 
        label: "Mesma estratégia no período", dimension: "operational" },
    ]
  },
  
  // Stage 3 → 4: Proficiência
  4: {
    label: "Proficiency",
    minMonths: 6,
    sustainedPeriod: 3,
    gates: [
      { id: "G4-01", metric: "winRate", operator: ">=", value: 0.50, 
        label: "Win rate ≥50%", dimension: "financial" },
      { id: "G4-02", metric: "payoff", operator: ">=", value: 1.5, 
        label: "Payoff ≥1.5", dimension: "financial" },
      { id: "G4-03", metric: "maxDrawdown", operator: "<=", value: 0.08, 
        label: "Drawdown máximo ≤8%", dimension: "financial" },
      { id: "G4-04", metric: "emotionalScore", operator: ">=", value: 65, 
        label: "Score emocional ≥65 (LEARNER+)", dimension: "emotional" },
      { id: "G4-05", metric: "evLeakage", operator: "<=", value: 0.25, 
        label: "EV Leakage ≤25%", dimension: "financial" },
      { id: "G4-06", metric: "tiltFrequency", operator: "==", value: 0, 
        label: "Zero episódios TILT", dimension: "emotional" },
      { id: "G4-07", metric: "revengeFrequency", operator: "==", value: 0, 
        label: "Zero episódios REVENGE", dimension: "emotional" },
      { id: "G4-08", metric: "stopUsageRate", operator: ">=", value: 0.98, 
        label: "Stop em >98% dos trades", dimension: "financial" },
    ]
  },
  
  // Stage 4 → 5: Maestria
  5: {
    label: "Mastery",
    minMonths: 12,
    sustainedPeriod: 6,
    gates: [
      { id: "G5-01", metric: "compositeScore", operator: ">=", value: 80, 
        label: "Composite ≥80 (Professional)", dimension: "composite" },
      { id: "G5-02", metric: "positiveMonths", operator: ">=", value: 0.80, 
        label: "≥80% meses positivos no ano", dimension: "financial" },
      { id: "G5-03", metric: "sharpeRatio", operator: ">=", value: 1.0, 
        label: "Sharpe ≥1.0", dimension: "financial" },
      { id: "G5-04", metric: "emotionalScore", operator: ">=", value: 80, 
        label: "Score emocional ≥80 (SAGE)", dimension: "emotional" },
      { id: "G5-05", metric: "mentorIndependence", operator: ">=", value: 0.90, 
        label: "≥90% trades sem intervenção do mentor", dimension: "operational" },
    ]
  }
};
```

### 4.2 Avaliação Híbrida

```
1. CF mensal (ou on-demand) calcula gates_met para o stage atual
2. Se gates_met == gates_total E sustainedPeriod cumprido:
   → Status: ELIGIBLE (elegível para promoção)
   → Notificação ao mentor
3. Mentor revisa e decide:
   → PROMOTE: aluno avança de stage, registro com justificativa
   → HOLD: aluno permanece, mentor registra motivo e plano de ação
   → OVERRIDE_PROMOTE: mentor promove mesmo sem todos os gates (ex: 7/8, o faltante é borderline)
   → OVERRIDE_HOLD: mentor retém mesmo com todos os gates (ex: suspeita de gaming, contexto externo)
4. Decisão registrada em progression_log com timestamp, mentor, ação, justificativa
```

### 4.3 Regressão

Gates não são one-way. Se um aluno em Stage 3 passa 2 meses consecutivos sem cumprir gates do Stage 2:
- Sistema gera alerta: `REGRESSION_WARNING`
- Se 3 meses: `REGRESSION_ELIGIBLE` (elegível para rebaixamento)
- Mentor decide: rebaixar, manter com plano de ação, ou ignorar (com justificativa)
- Regressão nunca é automática — sempre passa pelo mentor

---

## 5. FIRESTORE: ESTRUTURAS DE ACOMPANHAMENTO

### 5.1 Review Mensal (reescrito)

```javascript
// students/{studentId}/assessment/ongoing_tracking/monthly_reviews/{YYYY-MM}
{
  period: "2026-04",                      // mês de referência
  reviewDate: Timestamp,                  // quando o mentor fez o review
  reviewedBy: string,                     // mentor

  // Camada 1: scores automáticos (calculados pela CF/client a partir dos trades do período)
  trades_scores: {
    emotional: {
      recognition: 58, regulation: 62, locus: 55,
      score: 58,
      metrics_used: {                     // auditoria: quais métricas geraram o score
        emotionVariety: 0.72,             // Shannon entropy
        tiltFrequency: 1,
        revengeFrequency: 0,
        postLossAvgInterval: 22,          // minutos
        sizingAfterLoss: "maintains"
      }
    },
    financial: {
      discipline: 74, loss_management: 68, profit_taking: 61,
      score: 69,
      metrics_used: {
        stopUsageRate: 0.85,
        avgRiskPercent: 1.2,              // vs plano
        maxDrawdown: 0.07,
        payoff: 1.4,
        winRate: 0.52,
        evLeakage: 0.18
      }
    },
    operational: {
      decision_mode: 72, timeframe: 78, strategy_fit: 70, tracking: 65,
      emotion_control: 58,               // herdado de emotional.score acima
      score: 69,
      metrics_used: {
        complianceRate: 0.82,
        journalCompletionRate: 0.78,
        tradingHoursCompliance: 0.91
      }
    },
    experience: {
      stage: 2,
      gates_met: 5, gates_total: 8,
      score: 32.5,                        // 20 + (5/8 × 20)
      gates_detail: [                     // quais gates cumpridos/faltantes
        { id: "G3-01", met: true, value: 0.52 },
        { id: "G3-02", met: true, value: 0.92 },
        { id: "G3-03", met: true, value: 0.07 },
        { id: "G3-04", met: true, value: 58 },
        { id: "G3-05", met: true, value: 0.82 },
        { id: "G3-06", met: false, value: 0.9, threshold: 1.0 },
        { id: "G3-07", met: false, value: 3, threshold: 2 },
        { id: "G3-08", met: false, value: 1, threshold: 0 }
      ]
    },
    composite: 55.8,
    tradesAnalyzed: 147,                  // total de trades no período
    periodStart: Timestamp,
    periodEnd: Timestamp
  },

  // Camada 2: delta do mentor (empírico)
  mentor_deltas: {
    emotional: { delta: +5, notes: "Aluno demonstrou progresso real em reconhecimento após sessão de coaching na semana 3" },
    financial: { delta: 0, notes: "Métricas refletem a realidade, sem ajuste" },
    operational: { delta: -3, notes: "Journal preenchido mas superficial — não captura insight real" },
    experience: { delta: 0, notes: "" }
  },

  // Camada 3: scores finais (blendados)
  final_scores: {
    emotional: {
      score_trades: 58,
      score_mentor_abs: 63,              // 58 + 5 = 63
      score_final: 62,                   // (58 × 0.30) + (63 × 0.70) = 17.4 + 44.1 = 61.5 → 62
      weight_trades: 0.30,
      weight_mentor: 0.70
    },
    financial: {
      score_trades: 69,
      score_mentor_abs: 69,              // 69 + 0 = 69
      score_final: 69,                   // (69 × 0.70) + (69 × 0.30) = 69
      weight_trades: 0.70,
      weight_mentor: 0.30
    },
    operational: {
      score_trades: 69,
      score_mentor_abs: 66,              // 69 + (-3) = 66
      score_final: 68,                   // (69 × 0.50) + (66 × 0.50) = 34.5 + 33 = 67.5 → 68
      weight_trades: 0.50,
      weight_mentor: 0.50
    },
    experience: {
      score_trades: 32.5,
      score_mentor_abs: 32.5,            // 32.5 + 0 = 32.5
      score_final: 33,                   // (32.5 × 0.80) + (32.5 × 0.20) = 32.5 → 33
      weight_trades: 0.80,
      weight_mentor: 0.20
    },
    composite: 53.2,                     // (E×0.25)+(F×0.25)+(O×0.20)+(X×0.30)
    composite_label: "DEVELOPING TRADER"
  },

  // Deltas vs assessment anterior (último review ou baseline se primeiro review)
  delta_vs_previous: {
    emotional: +4,
    financial: +5,
    operational: -1,
    experience: +5.5,
    composite: +3.2
  },

  // Deltas vs baseline (assessment inicial — fixo)
  delta_vs_baseline: {
    emotional: +0,
    financial: +5,
    operational: -1,
    experience: +5.5,
    composite: -2.2
  },

  // Notas estruturadas por dimensão
  dimension_notes: {
    emotional: "Progresso em reconhecimento mas regulação ainda frágil. Episódio de TILT na semana 2 após sequência de 4 losses.",
    financial: "Stop discipline melhorando consistentemente. Drawdown controlado. Payoff ainda abaixo de 1.0 — ansiedade de saída.",
    operational: "Aderência ao plano boa. Journal precisa de mais profundidade — entradas genéricas como 'confiante' não ajudam.",
    experience: "3 gates faltando para Stage 3. Payoff e TILT são os bloqueios principais."
  },

  // Milestones e blockers
  milestones: ["Stop usage >85% pela primeira vez", "Zero revenge no período"],
  blockers: ["Payoff <1.0", "TILT frequency >2"],
  action_plan: "Foco nas próximas 4 semanas: (1) trailing stop em 50% dos trades para melhorar payoff, (2) pausa obrigatória de 30min após 2 losses consecutivos"
}
```

### 5.2 Progression Log

```javascript
// students/{studentId}/assessment/ongoing_tracking/progression_log/{timestamp}
{
  timestamp: Timestamp,
  action: "PROMOTE" | "HOLD" | "OVERRIDE_PROMOTE" | "OVERRIDE_HOLD" | "REGRESSION_WARNING" | "REGRESSION",
  fromStage: 2,
  toStage: 3,                            // null se HOLD
  mentor: string,
  
  // Snapshot no momento da decisão
  eligibility: {
    gates_met: 8,
    gates_total: 8,
    sustained_months: 2,
    required_months: 2,
    eligible: true
  },
  
  justification: "Todos os gates cumpridos por 2 meses consecutivos. Aluno demonstra consistência.",
  
  // Para HOLD ou OVERRIDE_HOLD
  hold_reason: null,                     // "Payoff borderline, quero ver mais 1 mês"
  hold_action_plan: null,                // "Foco em trailing stop para melhorar payoff"
  
  // Para OVERRIDE (promover sem todos os gates, ou reter com todos)
  override_gates_missing: null,          // ["G3-06"] se OVERRIDE_PROMOTE
  override_justification: null           // "Payoff = 0.95 vs threshold 1.0 — borderline, tendência positiva"
}
```

### 5.3 Mentor Journal (notas livres entre reviews)

```javascript
// students/{studentId}/assessment/ongoing_tracking/mentor_journal/{timestamp}
{
  timestamp: Timestamp,
  mentor: string,
  type: "observation" | "intervention" | "concern" | "milestone",
  dimension: "emotional" | "financial" | "operational" | "experience" | "general",
  
  // Vínculo opcional com trade específico
  linkedTradeId: null,                   // ID do trade que motivou a nota (opcional)
  linkedPlanId: null,                    // ID do plano (opcional)
  
  text: "Aluno enviou mensagem fora do horário preocupado com drawdown de 6%. Boa consciência de risco mas tom ansioso — monitorar nas próximas sessões.",
  
  // Tags para busca
  tags: ["anxiety", "drawdown", "risk-awareness"],
  
  // Visibilidade
  visibleToStudent: false                // mentor decide se aluno pode ver
}
```

---

## 6. TIMELINE 4D — VISUALIZAÇÃO

A série temporal para o gráfico de evolução é construída a partir de:

```
Ponto 0: initial_assessment (marco zero)
Ponto 1: monthly_reviews/2026-04 (primeiro review)
Ponto 2: monthly_reviews/2026-05
...
Ponto N: monthly_reviews/YYYY-MM (review mais recente)
```

Cada ponto tem `final_scores.{dimensional}.score_final` para as 4 dimensões + composite.

**Query para timeline:**
```javascript
// Busca todos os reviews ordenados por período
const reviews = await getDocs(
  query(
    collection(db, `students/${studentId}/assessment/ongoing_tracking/monthly_reviews`),
    orderBy('period', 'asc')
  )
);

// Monta série temporal
const timeline = [
  { period: 'baseline', ...initialAssessment.scores },
  ...reviews.map(r => ({ period: r.period, ...r.final_scores }))
];
```

**Componente:** `TraderEvolutionTimeline.jsx` — gráfico de linha 4D (Recharts ou d3) com:
- 4 linhas coloridas (emocional, financeiro, operacional, experiência) + composite pontilhada
- Eixo X: meses desde baseline
- Eixo Y: 0-100
- Tooltips com score_trades vs score_final (mostra influência do mentor)
- Marcadores de eventos: promoção de stage, TILT episodes, intervenções do mentor
- Faixas horizontais coloridas: FRAGILE (<50), DEVELOPING (50-64), LEARNER (65-84), SAGE (85+)

---

## 7. DECISÕES REGISTRADAS

| ID | Data | Decisão | Justificativa |
|----|------|---------|---------------|
| DEC-017 | 20/03/2026 | Scoring mensal 3 camadas: score_trades + mentor_delta + score_final com pesos variáveis por dimensão | Confiabilidade das métricas automáticas varia por dimensão; mentor calibra mais no emocional, menos no financeiro |
| DEC-018 | 20/03/2026 | Mentor aplica delta (não score absoluto) no review mensal | Reduz carga cognitiva — mentor reage ao dado calculado, não cria do zero. Preserva auditabilidade |
| DEC-019 | 20/03/2026 | Gates hardcoded em progressionGates.js, avaliação híbrida (automático + mentor confirma/veta) | Gates versionados com o código para consistência; mentor tem poder de override para ambos os lados |
| DEC-020 | 20/03/2026 | Regressão de stage nunca automática — sempre via mentor com justificativa | Evita penalização injusta por meses atípicos; mentor contextualiza antes de rebaixar |

---

## 8. IMPACTO NO CHUNK-09

Esta especificação adiciona ao escopo do CHUNK-09:

**Novos componentes:**
- `TraderEvolutionTimeline.jsx` — gráfico de evolução 4D
- `MonthlyReviewForm.jsx` — reformulado com 3 camadas (trades_scores pré-calculados, delta inputs, notes por dimensão)
- `ProgressionGateStatus.jsx` — visualização de gates cumpridos/faltantes por stage
- `PromotionDecisionModal.jsx` — interface para mentor promover/reter com justificativa
- `MentorJournalEntry.jsx` — entrada de nota livre

**Novos utils:**
- `progressionGates.js` — definição de gates por stage + avaliador
- `tradeScoreMapper.js` — mapeamento métricas de trades → scores 4D por dimensão
- `evolutionCalculator.js` — blending score_trades + mentor_delta com pesos

**Novas CFs:**
- `calculateMonthlyScores` (callable ou scheduled) — extrai métricas do período e calcula score_trades 4D
- `evaluateProgression` (callable) — avalia elegibilidade de promoção contra gates

**Novos hooks:**
- `useEvolutionTimeline.js` — série temporal de scores para gráfico
- `useProgressionGates.js` — estado dos gates do aluno
- `useMentorJournal.js` — CRUD do journal livre do mentor

**Firestore (novos docs/subcollections):**
- `students/{id}/assessment/ongoing_tracking/monthly_reviews/{YYYY-MM}` — review mensal (reescrito, 3 camadas)
- `students/{id}/assessment/ongoing_tracking/progression_log/{timestamp}` — log de promoções/retenções
- `students/{id}/assessment/ongoing_tracking/mentor_journal/{timestamp}` — notas livres do mentor

---

*Spec Version 1.0 — 20/03/2026*
*Depende de: BRIEF-STUDENT-ONBOARDING-v3.md (v3.1), trader_evolution_framework.md*
*Decisões: DEC-017 a DEC-020*
