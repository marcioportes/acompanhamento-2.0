# BRIEF-ORDER-IMPORT.md
## Briefing de Sessão — Frente: Importação de Ordens
### Versão 2.0 — 17/03/2026 (Atualizado: Cross-check KPI + caso real)

---

## 1. CONTEXTO PARA A SESSÃO

Você está trabalhando no **Acompanhamento 2.0** — plataforma de mentoria de trading comportamental em React/Vite + Firebase/Firestore + Cloud Functions, deploy em Vercel.

Esta frente implementa a **importação de ordens brutas da corretora**. As ordens são o ato bruto — cancelamentos, modificações, market vs. limit, timestamps reais. São a base para detecção comportamental e **cross-check de KPIs inflados**.

**Caso real motivador:** Aluno opera 80+ trades/dia, NUNCA toma stop. Os KPIs do sistema mostram performance positiva (win rate alta) porque o aluno só fecha trades quando estão positivos e carrega indefinidamente os negativos — ou faz "averaging down" sem stop, gerando risco ilimitado oculto. O import de ordens permite cross-verificar: a ordem mostra que não há stop order associada, que há market orders de averaging, e que o tempo médio de trades negativos é 10× maior que o de positivos.

**Referência de padrão:** CHUNK-07 (CSV Import) usa staging collection. Esta frente segue o mesmo padrão.

---

## 2. CHUNK CHECK-OUT

| Chunk | Status | Permissão |
|-------|--------|-----------|
| **CHUNK-10 (Order Import)** | LOCKED | ✅ CRIAR arquivos listados |
| CHUNK-04 (Trade Ledger) | READ-ONLY | ⚠️ LER estrutura de `trades` e `addTrade`, NÃO MODIFICAR |
| CHUNK-07 (CSV Import) | READ-ONLY | ⚠️ LER como referência de padrão, NÃO MODIFICAR |
| Todos os demais | BLOQUEADO | ❌ NÃO TOCAR |

**Branch:** `feature/order-import`

---

## 3. CONCEITO: ORDENS vs. TRADES

| Aspecto | Trade (existente) | Ordem (novo) |
|---------|-------------------|--------------|
| **Fonte** | Registrado pelo aluno ou CSV | Exportado da corretora |
| **Editável** | Sim — viés do aluno | Não — imutável |
| **Granularidade** | Posição aberta→fechada | Ação individual |
| **Confiabilidade** | Sujeita a manipulação | Fato objetivo |
| **Uso principal** | Performance tracking | Cross-check + detecção comportamental |

### 3.1 Por Que Ordens São Críticas (Caso Real)

O aluno que opera 80+ trades/dia sem stop demonstra um padrão que os trades consolidados não revelam completamente:

1. **No nível de trades:** Win rate aparenta 75%+. Parece bom.
2. **No nível de ordens:** Zero stop orders emitidas. 100% market orders de saída. Tempo médio em trades perdedores: 47 minutos. Tempo médio em trades vencedores: 3 minutos. Múltiplas ordens de "averaging down" nos trades perdedores.
3. **O que isso significa:** O aluno está fazendo "mean reversion forçada" — segurando perdedores e adicionando posição até reverter. Funciona até o dia que não funciona, e o drawdown é catastrófico.

As ordens expõem esse padrão de forma inequívoca. Os trades consolidados escondem.

### 3.2 Tipos de Evento de Ordem

| Tipo | Significado Comportamental |
|------|---------------------------|
| `SUBMITTED` | Momento de decisão |
| `MODIFIED` | Evento emocional (ansiedade, hesitação) |
| `CANCELLED` | Medo, indecisão, ou gestão legítima |
| `FILLED` | Execução efetivada |
| `PARTIALLY_FILLED` | Contexto de liquidez |
| `REJECTED` | Sizing inválido, margem |
| `EXPIRED` | GTC/GTD não ativado |

### 3.3 Métricas Derivadas de Ordens (Cross-Check)

| Métrica | Cálculo | O Que Revela |
|---------|---------|-------------|
| **Stop Order Rate** | stop_orders / total_orders | % de trades com proteção real |
| **Modify Rate** | modified_orders / total_orders | Frequência de hesitação |
| **Cancel Rate** | cancelled_orders / total_orders | Frequência de indecisão |
| **Market Order %** | market_orders / (market + limit) | Impulsividade vs. planejamento |
| **Avg Hold Time (Win vs Loss)** | média(closedAt-openedAt) por resultado | Assimetria = carrying losers |
| **Averaging Down Count** | ordens adicionais na mesma direção após adverse move | Martingale oculto |
| **Ghost Order Rate** | ordens executadas sem trade registrado | Sub-registro intencional |
| **Order-to-Trade Ratio** | total_orders / total_trades | Hiperatividade operacional |

---

## 4. ESCOPO — O QUE FAZER

### 4.1 Firestore: Novas Collections

**Staging Collection:**
```javascript
// ordersStagingArea/{batchId}
{
  studentId: string,
  planId: string,
  uploadedAt: Timestamp,
  uploadedBy: string,
  sourceFormat: string,           // "tradovate" | "ninjatrader" | "generic"
  fileName: string,
  status: "pending" | "validated" | "ingested" | "error",
  rawOrderCount: number,
  validOrderCount: number,
  validationErrors: array,
  orders: array<RawOrder>
}
```

**Collection Final:**
```javascript
// orders/{orderId}
{
  studentId: string,
  planId: string,
  batchId: string,
  instrument: string,
  orderType: "MARKET" | "LIMIT" | "STOP" | "STOP_LIMIT",
  side: "BUY" | "SELL",
  quantity: number,
  price: number,                  // para limit/stop
  filledPrice: number,
  filledQuantity: number,
  status: "SUBMITTED" | "MODIFIED" | "CANCELLED" | "FILLED" | "PARTIALLY_FILLED" | "REJECTED" | "EXPIRED",
  submittedAt: Timestamp,
  filledAt: Timestamp,
  cancelledAt: Timestamp,
  modifications: array<{
    field: string,
    oldValue: any,
    newValue: any,
    modifiedAt: Timestamp
  }>,
  correlatedTradeId: string | null,
  correlationConfidence: number,
  isStopOrder: boolean,           // flag para cross-check rápido
  importedAt: Timestamp,
  sourceFormat: string
}
```

**Cross-Check Summary (por período):**
```javascript
// orderAnalysis/{studentId}__{periodKey}
{
  studentId: string,
  planId: string,
  period: "2026-W12",
  periodType: "week",
  ordersAnalyzed: number,
  tradesInPeriod: number,
  
  crossCheckMetrics: {
    stopOrderRate: number,            // 0.0 a 1.0
    modifyRate: number,
    cancelRate: number,
    marketOrderPct: number,
    avgHoldTimeWin: number,           // minutos
    avgHoldTimeLoss: number,          // minutos
    holdTimeAsymmetry: number,        // ratio loss/win (>3 = red flag)
    averagingDownCount: number,
    ghostOrderCount: number,
    orderToTradeRatio: number
  },
  
  kpiValidation: {
    reportedWinRate: number,          // do trade ledger
    adjustedWinRate: number,          // corrigido por ordens (inclui ghost orders)
    winRateDelta: number,
    stopUsageRate: number,
    kpiInflationFlag: boolean,        // true se delta > 10% ou stopUsage < 20%
    kpiInflationSeverity: "NONE" | "MODERATE" | "SEVERE"
  },
  
  alerts: array<{
    type: string,
    message: string,
    severity: string
  }>,
  
  generatedAt: Timestamp
}
```

### 4.2 Componentes React

| Componente | Responsabilidade |
|------------|-----------------|
| `src/pages/OrderImportPage.jsx` | Página principal |
| `src/components/OrderImport/OrderUploader.jsx` | Upload + detecção formato |
| `src/components/OrderImport/OrderPreview.jsx` | Preview antes de ingerir |
| `src/components/OrderImport/OrderValidationReport.jsx` | Erros e warnings |
| `src/components/OrderImport/OrderCorrelation.jsx` | Correlação ordem↔trade |
| `src/components/OrderImport/CrossCheckDashboard.jsx` | Métricas de cross-check para mentor |
| `src/components/OrderImport/KPIValidationCard.jsx` | Card de validação de KPI |

### 4.3 Utils

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/utils/orderParsers.js` | Parsers por formato de corretora |
| `src/utils/orderValidation.js` | Pipeline de validação (3 camadas) |
| `src/utils/orderCorrelation.js` | Correlação ordem↔trade |
| `src/utils/orderNormalizer.js` | Normalização para schema unificado |
| `src/utils/orderCrossCheck.js` | Cálculo de métricas de cross-check |
| `src/utils/kpiValidation.js` | Validação de KPIs contra ordens reais |

### 4.4 Hooks

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/hooks/useOrders.js` | CRUD de ordens |
| `src/hooks/useOrderImport.js` | Fluxo de importação |
| `src/hooks/useCrossCheck.js` | Métricas de cross-check |

### 4.5 Testes

| Arquivo | Cobertura |
|---------|-----------|
| `src/__tests__/utils/orderParsers.test.js` | Parsing de cada formato |
| `src/__tests__/utils/orderValidation.test.js` | Pipeline de validação |
| `src/__tests__/utils/orderCorrelation.test.js` | Correlação |
| `src/__tests__/utils/orderCrossCheck.test.js` | Métricas cross-check |
| `src/__tests__/utils/kpiValidation.test.js` | Validação de KPIs |

---

## 5. ESCOPO — O QUE NÃO FAZER

❌ NÃO modificar nenhum arquivo fora dos listados acima
❌ NÃO tocar em `App.jsx`, `functions/index.js`, `firestore.rules`, `version.js`, `CHANGELOG.md`
❌ NÃO modificar collection `trades` (correlação é read-only)
❌ NÃO modificar CSV Import (CHUNK-07)
❌ NÃO implementar detecção comportamental (CHUNK-11)
❌ NÃO escrever direto em `orders` sem staging (invariante)
❌ Ordens são IMUTÁVEIS após importação

---

## 6. REGRAS DE NEGÓCIO

### 6.1 Pipeline

```
Upload → Formato → Parse → Validação → Preview → Staging → Ingestão → Correlação → Cross-Check
```

### 6.2 Correlação Ordem↔Trade

```
Para cada ordem FILLED:
  1. Buscar trades do mesmo aluno/plano/instrumento
  2. Filtrar timestamp: |ordem.filledAt - trade.openedAt| < 5 min
  3. Filtrar side e quantity (±10%)
  4. Match único → confidence 1.0
  5. Múltiplos → melhor match, confidence 0.7-0.9
  6. Nenhum → ghost order (correlatedTradeId = null)
```

### 6.3 Cross-Check KPI

Após ingestão, calcular automaticamente:

```javascript
// Regra de KPI Inflation
if (stopOrderRate < 0.20 && reportedWinRate > 0.60) {
  kpiInflationFlag = true;
  severity = stopOrderRate === 0 ? "SEVERE" : "MODERATE";
  alert("KPI inflation detectado: win rate {reportedWinRate}% com {stopOrderRate}% stop usage");
}

// Regra de Hold Time Asymmetry
if (avgHoldTimeLoss / avgHoldTimeWin > 3.0) {
  alert("Aluno segura perdedores {ratio}× mais que vencedores — carregando risco");
}

// Regra de Averaging Down
if (averagingDownCount > 0 && stopOrderRate < 0.50) {
  alert("Averaging down detectado sem stop — risco de ruin");
}
```

### 6.4 Formato Tradovate (Prioridade)

Campos esperados: Order ID, Account, Contract, B/S, Qty, Order Type, Limit Price, Stop Price, Fill Price, Status, Date/Time, Fill Date/Time.

Detecção automática de preamble. Parser genérico como fallback.

---

## 7. REQUISITOS TÉCNICOS

- React + Vite, Firebase/Firestore, Vitest + jsdom
- DebugBadge obrigatório
- Datas formato brasileiro
- Testes obrigatórios
- Staging invariant
- Git: commit messages em linha única

---

## 8. ENTREGÁVEIS

1. ZIP com paths project-relative
2. MERGE-INSTRUCTIONS-order-import.md
3. CONTINUITY-session-YYYYMMDD.md
4. Testes passando

```powershell
Expand-Archive -Path "Temp\order-import.zip" -DestinationPath "." -Force
```

---

## 9. ACCEPTANCE CRITERIA

- [ ] Upload com detecção automática de formato
- [ ] Parser Tradovate + formato genérico
- [ ] Validação 3 camadas
- [ ] Preview com exclusão de linhas
- [ ] Staging `ordersStagingArea`
- [ ] Collection `orders` com schema unificado
- [ ] Campo `isStopOrder` para cross-check rápido
- [ ] Correlação ordem↔trade com confidence
- [ ] Cross-check metrics calculados automaticamente pós-ingestão
- [ ] KPI validation com flags de inflation
- [ ] Hold time asymmetry detection
- [ ] Averaging down detection
- [ ] Ghost order detection
- [ ] CrossCheckDashboard para o mentor
- [ ] KPIValidationCard
- [ ] Imutabilidade + deduplicação
- [ ] DebugBadge em toda tela
- [ ] Testes para parsers, validação, correlação, cross-check, KPI validation
- [ ] Nenhum arquivo fora do escopo modificado
- [ ] MERGE-INSTRUCTIONS completo

---

*Briefing Version 2.0 — 17/03/2026*
*Chunk: CHUNK-10 (Order Import Pipeline)*
*Branch: feature/order-import*
*Motivação: caso real de KPI inflation por ausência de stop em 80+ trades/dia*
