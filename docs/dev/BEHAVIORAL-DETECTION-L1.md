# BEHAVIORAL-DETECTION-L1.md
## Design Detalhado — Camada 1: Regras Determinísticas
### Versão 1.0 — 16/03/2026

---

## 1. VISÃO GERAL

A Camada 1 implementa **regras determinísticas** — lógica pura sem IA — que identifica padrões comportamentais a partir de campos numéricos, temporais e estruturais dos trades e ordens. Custo zero de API. Execução em Cloud Functions ou client-side.

### 1.1 Princípios

1. **Cada regra produz um flag** — estrutura `{ code, severity, description, evidence }` adicionado ao array `behavioralFlags[]` no documento do trade.
2. **O sistema nunca acusa** — flags são visíveis apenas para o mentor, que decide a intervenção.
3. **Auto-calibração** — thresholds são relativos ao histórico do próprio aluno, não benchmarks absolutos (exceto regras binárias como "stop ausente").
4. **Composição** — múltiplos flags no mesmo trade elevam o Behavioral Risk Score composto.

### 1.2 Integração com Framework Evolutivo

| Stage | Flags Esperados | Calibração |
|-------|----------------|------------|
| Stage 1 (Caos) | Massivos — overtrading, sem stop, sizing errático | Thresholds relaxados (esperado) |
| Stage 2 (Reativo) | Moderados — inconsistência plano, revenge esporádico | Thresholds padrão |
| Stage 3 (Metódico) | Raros — regressões pontuais sob estresse | Thresholds apertados (qualquer flag é anomalia) |
| Stage 4-5 | Muito raros — refinamento (cortar winners, evitar setups) | Thresholds ultra-sensíveis |

O `stage` do aluno (do assessment/onboarding) modula os thresholds dinamicamente.

---

## 2. CATÁLOGO DE REGRAS

### 2.1 REGRAS TEMPORAIS

#### RULE-T01: Revenge Trading (Inter-trade Interval)

```
CODE: REVENGE_INTERVAL
SEVERITY: CRITICAL
TRIGGER: trade[n].openedAt - trade[n-1].closedAt < THRESHOLD
         AND trade[n-1].result < 0 (loss)
THRESHOLD: 120 segundos (2 min) — configurável por stage
EVIDENCE: {
  previousTradeId, previousResult, intervalSeconds,
  currentTradeDirection, previousTradeDirection
}
NOTA: Se direção inverteu E intervalo < threshold, severidade sobe para CRITICAL+
```

#### RULE-T02: Overtrading Intra-Sessão

```
CODE: OVERTRADING_SESSION
SEVERITY: HIGH
TRIGGER: count(trades nesta sessão) > mean(trades/sessão últimos 20 dias) + 2 * stddev
THRESHOLD: Z-score > 2.0
EVIDENCE: {
  sessionTradeCount, historicalMean, historicalStdDev, zScore
}
NOTA: "Sessão" = trades do mesmo dia para o mesmo plano
```

#### RULE-T03: Horário Anômalo

```
CODE: ANOMALOUS_HOUR
SEVERITY: MEDIUM
TRIGGER: trade.openedAt.hour fora do range [marketOpen - 30min, marketClose + 30min]
         OU trade.openedAt.hour fora do range habitual do aluno (percentil 5-95)
THRESHOLD: Configurável por mercado (ex: CME = 09:30-16:00 ET)
EVIDENCE: {
  tradeHour, marketRange, studentTypicalRange
}
```

#### RULE-T04: Clustering Temporal

```
CODE: TEMPORAL_CLUSTER
SEVERITY: HIGH
TRIGGER: count(trades em janela de 20 min) > 2.5 * média do aluno para mesma janela
THRESHOLD: 2.5× média pessoal
EVIDENCE: {
  windowTradeCount, windowMinutes, personalAverage
}
```

#### RULE-T05: Escalada Pré-Fechamento

```
CODE: PRE_CLOSE_ESCALATION
SEVERITY: MEDIUM
TRIGGER: (count OU sizing) em última hora do pregão > 1.5× média do aluno
         E dia = sexta-feira OU véspera de feriado
THRESHOLD: 1.5× média
EVIDENCE: {
  lastHourTradeCount, lastHourSizing, normalAverage, dayOfWeek
}
```

---

### 2.2 REGRAS DE SIZING

#### RULE-S01: Escalada Pós-Loss (Martingale Comportamental)

```
CODE: MARTINGALE_ESCALATION
SEVERITY: CRITICAL
TRIGGER: trade[n].quantity > trade[n-1].quantity * 1.5
         AND trade[n-1].result < 0
         AND trade[n-2].result < 0 (opcional — 2+ losses em sequência amplifica)
THRESHOLD: Aumento > 50% na quantidade
EVIDENCE: {
  currentQuantity, previousQuantity, percentIncrease,
  lossStreak, previousResults[]
}
NOTA: Se aumento > 100% e loss streak > 2, severity = CRITICAL+
```

#### RULE-S02: Sizing Excede Plano

```
CODE: SIZING_VIOLATION
SEVERITY: HIGH
TRIGGER: riskPerTrade(trade) > plan.maxRiskPerTrade * 1.5
         WHERE riskPerTrade = quantity * (entry - stopLoss) / accountBalance
THRESHOLD: Risco efetivo > 150% do planejado
EVIDENCE: {
  effectiveRisk, plannedMaxRisk, ratio, quantity, stopDistance
}
NOTA: Se stop ausente, riskPerTrade é calculado com loss efetivo ou ATR como proxy
```

#### RULE-S03: Redução Pós-Win (Informativo)

```
CODE: WIN_REDUCTION
SEVERITY: LOW (informativo)
TRIGGER: trade[n].quantity < trade[n-1].quantity * 0.7
         AND últimos 3 trades = todos win
THRESHOLD: Redução > 30% após win streak
EVIDENCE: {
  currentQuantity, previousQuantity, percentReduction, winStreak
}
NOTA: Pode indicar medo de "devolver" lucro. Flag educativo, não de alerta.
```

---

### 2.3 REGRAS DE GESTÃO DE RISCO

#### RULE-R01: Stop Ausente Recorrente

```
CODE: MISSING_STOP_PATTERN
SEVERITY: HIGH
TRIGGER: count(trades sem stop no período) / total(trades no período) > 0.20
THRESHOLD: > 20% dos trades no período (últimos 20 trades)
EVIDENCE: {
  tradesWithoutStop, totalTrades, percentage, period
}
NOTA: Distinto do flag individual de compliance (DEC-006).
      Este detecta o PADRÃO, não a instância.
```

#### RULE-R02: Stop Movido Contra (Stop Override)

```
CODE: STOP_OVERRIDE
SEVERITY: CRITICAL
TRIGGER: |trade.exitPrice - trade.entry| > |trade.stopLoss - trade.entry| * 1.1
         AND trade.result < 0
         (ou seja, a perda efetiva excedeu o stop declarado em > 10%)
THRESHOLD: Loss efetivo > 110% do stop declarado
EVIDENCE: {
  declaredStop, effectiveExit, declaredLoss, effectiveLoss, overridePercentage
}
NOTA: A violação mais grave no framework Douglas — incapacidade de aceitar perda definida
```

#### RULE-R03: RR Efetivo Deteriorado

```
CODE: RR_DETERIORATION
SEVERITY: HIGH
TRIGGER: avgWinner(últimos 20) / avgLoser(últimos 20) < plan.targetRR * 0.6
THRESHOLD: RR efetivo < 60% do target
EVIDENCE: {
  effectiveRR, targetRR, ratio, avgWinner, avgLoser, period
}
```

#### RULE-R04: Breakeven Compulsivo

```
CODE: COMPULSIVE_BREAKEVEN
SEVERITY: MEDIUM
TRIGGER: count(exits em BE ± 2 ticks) / total(trades) > mean + 2σ
         (comparado ao próprio aluno)
THRESHOLD: Z-score > 2.0 na frequência de BEs
EVIDENCE: {
  breakevenCount, totalTrades, percentage, historicalMean, zScore
}
```

#### RULE-R05: Cortar Winners Sistematicamente

```
CODE: CUTTING_WINNERS
SEVERITY: HIGH
TRIGGER: count(winners fechados antes de target) / count(winners) > 0.40
         WHERE "antes de target" = exitPrice < 80% do caminho entry→target
THRESHOLD: > 40% dos winners cortados cedo
EVIDENCE: {
  cutWinners, totalWinners, percentage, avgCutPoint
}
```

---

### 2.4 REGRAS EMOCIONAIS CRUZADAS

#### RULE-E01: Dissociação Emocional

```
CODE: EMOTIONAL_DISSOCIATION
SEVERITY: MEDIUM
TRIGGER: trade.result < 0 (loss significativo, > 1% conta)
         AND trade.emotionExit IN ['Tranquilo', 'Confiante', 'Neutro']
         AND trade.emotionEntry IN ['Confiante', 'Focado']
EVIDENCE: {
  result, emotionEntry, emotionExit, lossPercentage
}
NOTA: Não está processando a perda. Investigar se padrão se repete.
```

#### RULE-E02: Alexitimia Operacional (Monotonia Emocional)

```
CODE: EMOTIONAL_MONOTONE
SEVERITY: MEDIUM
TRIGGER: Shannon entropy das últimas 20 emoções de entrada < 1.0
         OU frequência da emoção mais comum > 85%
THRESHOLD: Entropy < 1.0 ou dominância > 85%
EVIDENCE: {
  entropyScore, dominantEmotion, dominantFrequency, emotionDistribution
}
CÁLCULO ENTROPY:
  H = -Σ p(x) * log2(p(x)) para cada emoção
  Com 7 emoções possíveis, max entropy ≈ 2.81. Abaixo de 1.0 = muito baixa variedade.
```

#### RULE-E03: Deriva Emocional Intra-Sessão

```
CODE: EMOTIONAL_DRIFT
SEVERITY: HIGH
TRIGGER: emoção_entry_mapeada_numericamente decai monotonicamente ao longo de 3+ trades no dia
         (mapeamento: Eufórico=3, Confiante=2, Focado=1, Neutro=0, Ansioso=-1, Frustrado=-2, Desesperado=-3)
THRESHOLD: Decaimento monotônico em 3+ trades consecutivos
EVIDENCE: {
  emotionSequence[], numericSequence[], sessionDate
}
```

#### RULE-E04: Reforço Inverso

```
CODE: INVERSE_REINFORCEMENT
SEVERITY: MEDIUM
TRIGGER: trade.emotionEntry IN ['Ansioso', 'Frustrado', 'Desesperado']
         AND trade.result > 0
         AND trade.emotionExit IN ['Eufórico', 'Confiante']
EVIDENCE: {
  emotionEntry, emotionExit, result
}
NOTA: Emoção negativa sendo "premiada" pelo resultado → reforça ciclo disfuncional
```

---

### 2.5 REGRAS DE ORDENS (Requer CHUNK-10: Order Import)

#### RULE-O01: Ordens Canceladas em Excesso

```
CODE: EXCESSIVE_CANCELLATIONS
SEVERITY: MEDIUM
TRIGGER: count(ordens canceladas) / count(ordens total) > 0.30 no dia
THRESHOLD: > 30% de cancelamentos
EVIDENCE: {
  cancelledOrders, totalOrders, percentage, timestamps[]
}
NOTA: Indica hesitação, medo, indecisão. Não é necessariamente ruim se < 15%.
```

#### RULE-O02: Modificação de Ordem Pré-Execução

```
CODE: ORDER_MODIFICATION
SEVERITY: MEDIUM
TRIGGER: count(modificações na mesma ordem) > 2
THRESHOLD: 3+ modificações em uma única ordem
EVIDENCE: {
  orderId, modificationsCount, modifications[]{field, oldValue, newValue, timestamp}
}
NOTA: Cada modificação é um evento emocional. Alta frequência = alta ansiedade.
```

#### RULE-O03: Discrepância Narrativa × Execução

```
CODE: NARRATIVE_EXECUTION_MISMATCH
SEVERITY: HIGH
TRIGGER: trade.notes contém "pullback" ou "retração"
         AND ordem correspondente é MARKET (não LIMIT)
         AND order.timestamp corresponde a período de momentum (não pullback)
THRESHOLD: Qualquer ocorrência (requer correlação ordem↔trade)
EVIDENCE: {
  tradeNotes, orderType, orderTimestamp, marketContext
}
NOTA: Requer correlação temporal entre ordem e trade registrado.
      Fase inicial: detectar apenas orderType MARKET com narrativa de entrada planejada.
```

#### RULE-O04: Market Order Predominante

```
CODE: MARKET_ORDER_DOMINANCE
SEVERITY: MEDIUM
TRIGGER: count(market orders) / count(total orders) > 0.70
         E aluno declara estilo como Systematic ou estilo com limit orders
THRESHOLD: > 70% market orders
EVIDENCE: {
  marketOrders, totalOrders, percentage, declaredStyle
}
NOTA: Indica FOMO ou urgência emocional se declarou ser sistemático.
```

#### RULE-O05: Slippage Anômalo

```
CODE: ANOMALOUS_SLIPPAGE
SEVERITY: LOW
TRIGGER: avgSlippage(últimas 20 ordens) > 2× avgSlippage(benchmark do instrumento)
THRESHOLD: 2× o slippage médio esperado
EVIDENCE: {
  avgSlippage, benchmarkSlippage, ratio, instrument
}
```

#### RULE-O06: Ordem Fantasma (Ordem sem Trade)

```
CODE: GHOST_ORDER
SEVERITY: LOW (informativo, alto volume analítico)
TRIGGER: Ordem executada parcial ou totalmente mas sem trade correspondente registrado
THRESHOLD: Qualquer ocorrência
EVIDENCE: {
  orderId, executedQuantity, matchedTradeId (null)
}
NOTA: Pode indicar: (a) aluno "escondendo" trades, (b) erro de registro, (c) trades não logados.
      Alta quantidade = possível sub-registro intencional de trades ruins.
```

---

## 3. BEHAVIORAL RISK SCORE — COMPOSIÇÃO

### 3.1 Severity Weights

| Severity | Peso | Descrição |
|----------|------|-----------|
| CRITICAL | 10 | Padrão destrutivo ativo — requer intervenção imediata |
| CRITICAL+ | 15 | Combinação de fatores críticos — risco de ruin |
| HIGH | 6 | Padrão preocupante — endereçar na próxima revisão |
| MEDIUM | 3 | Sinal a monitorar — pode indicar início de padrão |
| LOW | 1 | Informativo — contexto para o mentor |

### 3.2 Score por Trade

```
tradeRiskScore = Σ (flag.severity_weight) para cada flag no trade
```

| Score | Classificação | Cor Sugerida |
|-------|--------------|--------------|
| 0 | CLEAN | Verde |
| 1-5 | WATCHFUL | Amarelo |
| 6-14 | CONCERNING | Laranja |
| 15+ | CRITICAL | Vermelho |

### 3.3 Score por Período (Rolling)

```
periodRiskScore = Σ (tradeRiskScore) / count(trades no período)
```

Normalizado para 0-100. Alimenta o Behavioral Trend Report do mentor.

### 3.4 Trend Detection

```
Se periodRiskScore[semana atual] > periodRiskScore[semana anterior] * 1.3:
  → ALERT: "Tendência de deterioração comportamental"

Se periodRiskScore se mantém > 10 por 3+ semanas consecutivas:
  → ALERT: "Padrão comportamental persistente — intervenção recomendada"
```

---

## 4. ESTRUTURA FIRESTORE

### 4.1 Flags no Documento do Trade

```javascript
// Dentro de trades/{tradeId}
{
  // ... campos existentes ...
  behavioralFlags: [
    {
      code: "REVENGE_INTERVAL",
      severity: "CRITICAL",
      weight: 10,
      description: "Trade aberto 45s após loss anterior",
      evidence: {
        previousTradeId: "abc123",
        previousResult: -150.00,
        intervalSeconds: 45,
        currentDirection: "LONG",
        previousDirection: "SHORT"
      },
      detectedAt: Timestamp,
      ruleVersion: "1.0"
    }
  ],
  behavioralRiskScore: 10,  // soma dos weights
  behavioralRiskLevel: "CRITICAL"  // classificação derivada
}
```

### 4.2 Análise por Período (Nova Collection)

```javascript
// behavioralAnalysis/{studentId}__{periodKey}
// periodKey = "2026-W12" (semana) ou "2026-03" (mês)
{
  studentId: "xxx",
  period: "2026-W12",
  periodType: "week",
  tradesAnalyzed: 15,
  flagCounts: {
    CRITICAL: 2,
    HIGH: 3,
    MEDIUM: 5,
    LOW: 1
  },
  topFlags: ["REVENGE_INTERVAL", "SIZING_VIOLATION", "EMOTIONAL_MONOTONE"],
  riskScore: 45.2,  // normalizado 0-100
  riskLevel: "CONCERNING",
  trend: "DETERIORATING",  // vs período anterior
  trendDelta: +12.3,
  alerts: [
    {
      type: "TREND_ALERT",
      message: "Risk score subiu 37% em relação à semana anterior",
      severity: "HIGH"
    }
  ],
  generatedAt: Timestamp,
  engineVersion: "1.0"
}
```

### 4.3 Firestore Rules (Delta)

```javascript
// Em MERGE-INSTRUCTIONS — para Marcio aplicar
match /behavioralAnalysis/{docId} {
  allow read: if isMentor() || (isAuthenticated() && resource.data.studentId == request.auth.uid);
  allow write: if false;  // Somente Cloud Functions escrevem
}

// behavioralFlags[] dentro de trades — escrito pela CF, read pelo mentor
// Não requer rule change se CF usa admin SDK
```

---

## 5. IMPLEMENTAÇÃO

### 5.1 Arquivos a Criar

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/utils/behavioralRules.js` | Catálogo de regras — funções puras |
| `src/utils/behavioralScoring.js` | Cálculo de score composto |
| `src/utils/behavioralStats.js` | Funções estatísticas (z-score, entropy, rolling averages) |
| `functions/analyzeBehavior.js` | Cloud Function — trigger ou callable |
| `src/__tests__/utils/behavioralRules.test.js` | Testes unitários para cada regra |
| `src/__tests__/utils/behavioralScoring.test.js` | Testes de scoring |

### 5.2 Trigger de Análise

**Opção A — onTradeCreated/Updated (real-time):**
- Pro: Flag aparece imediatamente após o trade ser registrado
- Con: Latência no registro do trade; regras que precisam de contexto (últimos N trades) requerem reads adicionais
- Recomendado para: RULE-T01 (revenge), RULE-S01 (martingale), RULE-S02 (sizing violation)

**Opção B — Callable pelo Mentor (on-demand):**
- Pro: Análise completa com contexto; sem custo idle
- Con: Não é real-time; mentor precisa pedir
- Recomendado para: Análise de período, trend detection, score aggregado

**Opção C — Scheduled (batch diário/semanal):**
- Pro: Análise consolidada automática
- Con: Delay de até 24h; custo de scheduled function
- Recomendado para: Geração de `behavioralAnalysis` docs, alertas de tendência

**Recomendação:** Híbrido A + C. Flags individuais em real-time no `onTradeCreated`. Score agregado e trends em batch noturno.

### 5.3 Dependência de Ordens

As regras RULE-O* (seção 2.5) só podem ser implementadas **após CHUNK-10 (Order Import)** estar mergeado. O design da Camada 1 já as inclui para que o schema esteja preparado, mas a implementação inicial inclui apenas RULE-T*, RULE-S*, RULE-R* e RULE-E*.

**Fase 1 (sem ordens):** 15 regras (T01-T05, S01-S03, R01-R05, E01-E04)
**Fase 2 (com ordens):** +6 regras (O01-O06)

---

## 6. TESTES REQUERIDOS

Cada regra deve ter no mínimo:
1. **Teste positivo:** cenário que dispara a regra → flag gerado corretamente
2. **Teste negativo:** cenário dentro do normal → nenhum flag
3. **Teste de borda:** cenário no threshold exato → comportamento definido

```javascript
// Exemplo: RULE-T01
describe('REVENGE_INTERVAL', () => {
  it('should flag trade opened < 120s after loss', () => {
    const trades = [
      { closedAt: ts('10:00:00'), result: -100 },
      { openedAt: ts('10:01:30'), result: 50 }  // 90s depois
    ];
    const flags = analyzeRevenge(trades[1], trades[0]);
    expect(flags).toContainEqual(expect.objectContaining({
      code: 'REVENGE_INTERVAL',
      severity: 'CRITICAL'
    }));
  });

  it('should NOT flag trade opened > 120s after loss', () => {
    const trades = [
      { closedAt: ts('10:00:00'), result: -100 },
      { openedAt: ts('10:05:00'), result: 50 }  // 5min depois
    ];
    const flags = analyzeRevenge(trades[1], trades[0]);
    expect(flags).toEqual([]);
  });

  it('should NOT flag trade after win regardless of interval', () => {
    const trades = [
      { closedAt: ts('10:00:00'), result: 100 },  // WIN
      { openedAt: ts('10:00:30'), result: 50 }
    ];
    const flags = analyzeRevenge(trades[1], trades[0]);
    expect(flags).toEqual([]);
  });
});
```

---

## 7. UX DO MENTOR

### 7.1 Indicador Visual no ExtractTable

Cada trade no ledger exibe um ícone de risco:
- 🟢 CLEAN (0)
- 🟡 WATCHFUL (1-5)
- 🟠 CONCERNING (6-14)
- 🔴 CRITICAL (15+)

Clicar no ícone expande os flags daquele trade.

### 7.2 Painel de Alertas Comportamentais

Novo componente no MentorDashboard:
- Top 5 flags mais frequentes por aluno
- Tendência do risk score (gráfico sparkline)
- Alunos com score > threshold definido pelo mentor
- Link direto para o trade flagged no ledger

### 7.3 Relatório de Período

Exportável (futuro: PDF). Conteúdo:
- Risk score médio do período
- Flags por categoria (temporal, sizing, risco, emocional, ordens)
- Comparação com período anterior
- Recomendações automáticas (baseadas em combinações de flags)

---

*Design Version 1.0 — 16/03/2026*
*Dependências: CHUNK-04 (trades), CHUNK-05 (compliance), CHUNK-06 (emotional), CHUNK-10 (orders — fase 2)*
*Chunk alvo: CHUNK-11 (Behavioral Detection Engine)*
