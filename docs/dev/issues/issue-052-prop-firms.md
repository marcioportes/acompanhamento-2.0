# Issue #52 — epic: Gestão de Contas em Mesas Proprietárias (Prop Firms)

- **Estado:** OPEN
- **Milestone:** v1.1.0 - Espelho Self-Service
- **Labels:** type:feature, Sev2, epic:core-finance, module:account
- **Criado:** 01/03/2026
- **Atualizado:** 03/04/2026
- **Revisão:** v2.0 — incorpora mudanças Apex março 2026

---

## Contexto

Muitos alunos operam em mesas proprietárias (prop firms). Cada mesa tem regras próprias de drawdown, profit target, consistência e payout. O sistema atual trata todas as contas como genéricas — não há mecanismo para monitorar compliance com as regras da mesa, calcular drawdown trailing/EOD, ou alertar quando o trader está próximo de violar limites.

## Pesquisa: Regras das Principais Mesas

> **Nota (03/04/2026):** A Apex reformulou regras significativamente em março 2026. O comparativo abaixo reflete as regras atualizadas. Seção "Changelog de Regras" no final documenta os deltas.

### Comparativo de Drawdown

| Parâmetro | Apex (Mar 2026) | MFF (MyFundedFutures) | Lucid |
|-----------|-----------------|----------------------|-------|
| Tipo Drawdown (Eval) | **Dois produtos: EOD Trailing DD e Intraday Trailing DD** | Trailing intraday (Rapid) / EOD trailing (Starter/Core/Scale) | EOD trailing |
| Tipo Drawdown (Funded) | Trailing até safety net, depois estático | EOD trailing, trava em balance+$100 | EOD trailing, trava em Initial Trail Balance |
| Max DD 50K | $2,500 | $2,000 (Core/Scale) / $2,500 (Starter) | $2,000 (4%) |
| Daily Loss Limit | **Apenas contas EOD: $1,000 (50K) / $1,500 (100K). Pausa o dia, não falha a conta** | $1,200 (Starter) / Não tem (Core/Scale) | 20% do profit target (LucidPro) / Não tem (LucidFlex) |
| Profit Target 50K | $3,000 | $3,000 | $2,500 |
| Safety Net / Lock | Balance + DD + $100 (ex: $52,600) | Balance + $100 | Initial Trail Balance (varia) |
| Consistency Rule | **50% (flexibilizada de 30%)** | 50% (eval) / 40% por ciclo payout | 50% (eval) / 35% por ciclo (Pro) / Não (Flex) |
| MAE Rule | **Eliminada** | Não especificado | Não especificado |
| RR Máximo | **Eliminado (era 5:1)** | Não especificado | Não especificado |
| Stop Loss Obrigatório | **Bracket orders obrigatório (plataforma rejeita sem SL+TP)** | Não explícito | Não explícito |
| Contract Scaling | 50% até safety net | Varia por plano | Dinâmico por profit |
| Horário Limite | 4:59 PM ET | 4:10 PM EST | 4:45 PM EST |
| Payout Split | 100% até $25K, depois 90% | 80/20 (sim) → 90/10 (live) | 90/10 |
| Min Payout | $500 | $250-$1,000 | $500 |
| Min Trading Days (Eval) | **0 (pode passar no 1º dia)** | 5 (payout cycle) | 5 (Pro) / 8 (Direct) |
| Min Payout Days (PA) | 8 dias com **5 qualifying days ($100-$300 net profit/dia)** | 5 (payout cycle) | 5 (Pro) / 8 (Direct) |
| Time Limit (Eval) | **30 dias corridos, sem extensão** | Sem limite | Sem limite |
| Fee Model | **Pagamento único (one-time)** | Mensalidade recorrente | Mensalidade recorrente |
| DCA | **Proibido em Performance Accounts** | Permitido | Permitido |
| Metais | **Suspensos (GC, SI, MGC, HG, PL, PA) sem data de retorno** | Disponíveis | Disponíveis |
| Payout Denial Process | **Eliminado: sem video reviews, sem chart screenshots** | Padrão | Padrão |

### Tipos de Drawdown — Modelo Mental

**1. Trailing Intraday (mais restritivo)**
- Trail acompanha **pico de equity em tempo real** (incluindo unrealized P&L)
- Se abriu trade, subiu $600 e fechou +$100, o trail já subiu $600
- Usado: Apex Intraday DD (eval), MFF (Rapid)

**2. EOD Trailing (intermediário)**
- Trail atualiza apenas no **fechamento do dia** baseado no closing balance
- Intraday pode oscilar livremente sem impacto
- Usado: **Apex EOD DD (eval, novo)**, MFF (Core/Scale/Pro funded), Lucid (todos)
- **Apex EOD:** daily loss limit ativo ($1,000 no 50K) — pausa o dia, não elimina

**3. Estático (menos restritivo)**
- Drawdown fixo, não sobe nunca
- Usado: Apex 100K Static

**4. Trailing com Lock (híbrido)**
- Trailing até atingir safety net, depois para de subir e vira estático
- Usado: Apex (PA), MFF (funded), Lucid (funded)

---

## Arquitetura Proposta

### Modelo de Dados — `propFirmRules` (templates)

Templates reutilizáveis para cada mesa. Configurados uma vez pelo mentor/admin.

```jsx
{
  id: string,
  name: string,                     // "Apex EOD 50K", "Apex Intraday 50K", "MFF Core 50K"
  firm: string,                     // "APEX" | "MFF" | "LUCID" | "CUSTOM"
  accountSize: number,              // 50000

  // Drawdown
  drawdown: {
    type: "TRAILING_INTRADAY" | "TRAILING_EOD" | "STATIC" | "TRAILING_WITH_LOCK",
    maxAmount: number,              // 2500 (Apex 50K)
    lockAt: number | null,          // Safety net: balance onde trail para. Ex: 52600 (Apex)
    lockFormula: string | null,     // "BALANCE + DD + 100" | "BALANCE + 100"
  },

  // Limites diários
  dailyLossLimit: number | null,    // 1000 (Apex EOD 50K) | null (Apex Intraday, MFF Core)
  dailyLossType: "FIXED" | "PERCENT_PROFIT" | null,
  dailyLossAction: "PAUSE_DAY" | "FAIL_ACCOUNT" | null,  // NOVO: Apex EOD pausa, não falha

  // Profit Target (evaluation)
  profitTarget: number | null,      // 3000

  // Evaluation limits
  evalTimeLimit: number | null,     // NOVO: 30 (Apex: 30 dias corridos) | null (sem limite)
  evalMinTradingDays: number,       // NOVO: 0 (Apex) | 5 (MFF) | 5 (Lucid Pro)

  // Consistência
  consistency: {
    evalRule: number | null,        // 0.50 (Apex/MFF) = nenhum dia > 50% do profit target
    fundedRule: number | null,      // 0.40 (MFF) = nenhum dia > 40% do profit do ciclo
    // maeRule REMOVIDO — Apex eliminou a MAE rule de 30%
  },

  // Contract limits
  contracts: {
    max: number,                    // 10
    scalingRule: string | null,     // "50_PERCENT_UNTIL_SAFETY_NET" | "DYNAMIC_BY_PROFIT"
    scalingThreshold: number | null,
  },

  // Operacional
  tradingHours: {
    close: string,                  // "16:59" (Apex) | "16:10" (MFF) | "16:45" (Lucid)
    timezone: string,               // "America/New_York"
  },

  // Payout
  payout: {
    minAmount: number,              // 500
    minTradingDays: number,         // 8 (Apex PA)
    qualifyingDays: {               // NOVO: Apex requer dias qualificantes
      count: number | null,         // 5 (Apex PA) | null (sem requisito)
      minProfit: number | null,     // 100 (Apex: $100-$300 net profit/dia)
      maxProfit: number | null,     // 300
    },
    split: number,                  // 0.90 (90% trader)
    firstTierAmount: number | null, // 25000 (Apex: 100% até 25K)
    firstTierSplit: number | null,  // 1.00
  },

  // Flags especiais
  bracketOrderRequired: boolean,    // RENOMEADO: true (Apex — plataforma rejeita sem SL+TP)
  // maxRiskRewardRatio REMOVIDO — Apex eliminou a regra 5:1
  newsTrading: boolean,             // false (MFF) / true (Apex, Lucid)
  dcaAllowed: boolean,              // NOVO: false (Apex PA) | true (outros)
  restrictedInstruments: string[],  // NOVO: ["GC","SI","MGC","HG","PL","PA"] (Apex) | [] (outros)

  // Fee model (informativo, não afeta engine)
  feeModel: "ONE_TIME" | "RECURRING",  // NOVO: Apex one-time, MFF/Lucid recurring

  // Fases da conta
  phases: ["EVALUATION", "SIM_FUNDED", "LIVE"],

  createdAt: timestamp,
  updatedAt: timestamp,
}
```

### Extensão do Modelo `accounts` existente

```jsx
// Campos adicionais em accounts
{
  // ... campos existentes (name, broker, type, currency, etc.)

  // Prop firm (opcional — só para contas PROP)
  propFirm: {
    ruleId: string,                 // Ref para propFirmRules
    firm: string,                   // "APEX" | "MFF" | "LUCID"
    phase: "EVALUATION" | "SIM_FUNDED" | "LIVE",

    // Tracking de drawdown
    peakBalance: number,            // Maior balance atingido (para trailing)
    currentDrawdownThreshold: number, // Limite atual de liquidação
    isLocked: boolean,              // Safety net atingido, trail parou

    // Tracking de evaluation
    profitTarget: number,           // Meta de profit
    currentProfit: number,          // Profit acumulado
    tradingDays: number,            // Dias tradados
    bestDayProfit: number,          // Maior dia (para consistency check)
    evalStartDate: timestamp,       // NOVO: início da eval (para calcular deadline 30 dias)
    evalDeadline: timestamp | null, // NOVO: data limite (evalStartDate + evalTimeLimit)
    dailyPnL: number,              // NOVO: P&L do dia corrente (para daily loss limit)
    isDayPaused: boolean,           // NOVO: true quando daily loss limit atingido

    // Tracking de payout cycle
    payoutCycleStart: timestamp,
    payoutCycleProfitDays: number,  // Dias lucrativos no ciclo
    payoutCycleProfit: number,      // Profit do ciclo
    payoutCycleBestDay: number,     // Maior dia do ciclo
    qualifyingDaysCount: number,    // NOVO: dias com profit entre min-max qualifying
  }
}
```

### Dashboard de Conta Prop

Card no StudentDashboard para contas tipo PROP:

```
+--------------------------------------------------+
| Apex EOD 50K Evaluation                          |
|                                                  |
| Profit: $1,850 / $3,000 target  ########  62%   |
| DD Threshold: $48,350 (EOD trailing)             |
| Warning: Distance to DD: $1,850                  |
|                                                  |
| Daily P&L: -$420 / -$1,000 limit  [ACTIVE]      |
| Consistency: OK Best day $920 (31% < 50%)        |
| Eval Deadline: 18 dias restantes                 |
| Contracts: 4/10 max                              |
|                                                  |
| [Gauge: DD utilizado / DD máximo]                |
| [Gauge: Profit / Target]                         |
| [Gauge: Dias restantes eval]                     |
+--------------------------------------------------+
```

---

## Faseamento

### Fase 1: Templates e Configuração (1 sessão)
- [ ] Coleção `propFirmRules` com templates pré-configurados:
  - Apex EOD 50K / 100K / 150K / 250K / 300K
  - Apex Intraday 50K / 100K / 150K / 250K / 300K
  - MFF Starter / Core / Scale 50K-150K
  - Lucid Pro / Flex 50K-100K
- [ ] Tela de configuração de regras da mesa (mentor configura)
- [ ] Extensão do modelo `accounts` com campos `propFirm`
- [ ] Seletor de mesa ao criar conta tipo PROP (dois níveis: firma → produto)
- [ ] Fase da conta: EVALUATION → SIM_FUNDED → LIVE (transição manual)
- [ ] Validação de instrumentos restritos ao registrar trade (metais suspensos Apex)

### Fase 2: Cálculo de Drawdown em Tempo Real (1.5 sessão)
- [ ] Engine de drawdown que implementa os 4 tipos (trailing intraday, EOD, static, trailing+lock)
- [ ] Atualização do `peakBalance` e `currentDrawdownThreshold` a cada trade
- [ ] Detecção de lock (safety net atingido → trail para)
- [ ] **Daily loss limit com ação PAUSE_DAY (Apex EOD)** — flag `isDayPaused`
- [ ] **Countdown de eval deadline (30 dias corridos Apex)**
- [ ] Red flag quando distance to DD < 20%
- [ ] Red flag quando consistency rule violada (50% do profit target)
- [ ] Red flag quando eval deadline < 7 dias e profit target não atingido
- [ ] Cloud Function: `onTradeCreated` e `onTradeUpdated` recalculam drawdown da conta prop

### Fase 3: Dashboard e Alertas (1 sessão)
- [ ] Card de conta prop no StudentDashboard com gauges
- [ ] **Gauge de countdown da evaluation (dias restantes)**
- [ ] **Indicador de daily P&L vs daily loss limit (contas EOD)**
- [ ] Alerta ao mentor quando aluno está a <25% do drawdown
- [ ] Alerta quando consistency rule prestes a ser violada
- [ ] Tracking de trading days e payout eligibility
- [ ] Histórico de drawdown (sparkline da evolução do threshold)

### Fase 4: Payout Tracking (0.5 sessão)
- [ ] Ciclo de payout com tracking de dias lucrativos
- [ ] **Qualifying days tracker (Apex: 5 dias com $100-$300 net profit)**
- [ ] Cálculo de payout eligibility (min days, qualifying days, min amount, consistency)
- [ ] Simulador: "Se eu sacar X, meu novo threshold será Y"
- [ ] Registro de payouts realizados

---

## Considerações Técnicas

**Drawdown Trailing Intraday:** Requer que o sistema acompanhe unrealized P&L. Como o Espelho registra trades **fechados**, o trailing intraday seria baseado no peak do trade (entry → melhor preço antes de fechar). Para 100% de precisão seria necessário integração com a plataforma (Rithmic/Tradovate), mas para mentoria, calcular baseado nos trades registrados já oferece valor.

**EOD Trailing:** Mais simples — calcula baseado no closing balance do dia (soma dos trades fechados). Perfeito para o modelo atual de registro pós-trade. Com as novas contas EOD da Apex, esse tipo ganha importância — é a opção menos restritiva que a Apex agora oferece explicitamente como produto.

**Daily Loss Limit (Apex EOD):** Semântica diferente das outras mesas — não falha a conta, apenas pausa o dia. O sistema precisa de um campo `isDayPaused` que reseta a cada novo dia de trading. A Cloud Function `onTradeCreated` verifica se a soma dos trades do dia excede o limite e seta a flag.

**Eval Deadline (Apex):** 30 dias corridos a partir da criação da conta. O sistema calcula `evalDeadline = evalStartDate + 30 dias` e exibe countdown no dashboard. Red flag quando restam < 7 dias e profit target não atingido.

**Bracket Orders (Apex):** A plataforma já rejeita ordens sem SL+TP, então o Espelho não precisa enforçar — mas deve alertar se o trade registrado não tem stop (pode indicar registro manual incorreto).

**Instrumentos Restritos:** Lista de tickers suspensos armazenada no template. Ao registrar trade, o sistema verifica se o ticker está na lista e exibe warning (não bloqueia — o aluno pode ter operado antes da suspensão).

**Templates reutilizáveis:** O mentor configura uma vez as regras de cada mesa. Quando o aluno cria conta, seleciona "Apex EOD 50K" e as regras são aplicadas automaticamente. Se a mesa mudar regras, o mentor atualiza o template. O campo `firm: "CUSTOM"` permite configuração livre para mesas não mapeadas.

**Escalabilidade:** Novas mesas podem ser adicionadas como templates sem código.

---

## Changelog de Regras (rastreabilidade)

| Data | Firma | Mudança | Impacto no modelo |
|------|-------|---------|-------------------|
| Mar/2026 | Apex | Dois tipos de conta explícitos: EOD DD e Intraday DD | Templates separados por tipo de DD |
| Mar/2026 | Apex | Fee model → pagamento único | Campo `feeModel` adicionado |
| Mar/2026 | Apex | MAE Rule 30% eliminada | Campo `consistency.maeRule` removido |
| Mar/2026 | Apex | RR 5:1 eliminado | Campo `maxRiskRewardRatio` removido |
| Mar/2026 | Apex | Consistency flexibilizada para 50% | `consistency.evalRule` atualizado |
| Mar/2026 | Apex | Daily loss limit em contas EOD ($1,000/50K) | Campos `dailyLossAction`, `isDayPaused` adicionados |
| Mar/2026 | Apex | Min trading days eval → 0 | Campo `evalMinTradingDays` adicionado |
| Mar/2026 | Apex | Eval time limit → 30 dias | Campos `evalTimeLimit`, `evalDeadline` adicionados |
| Mar/2026 | Apex | Bracket orders obrigatório | Campo `bracketOrderRequired` (renomeado de `stopLossRequired`) |
| Mar/2026 | Apex | DCA proibido em PA | Campo `dcaAllowed` adicionado |
| Mar/2026 | Apex | Metais suspensos | Campo `restrictedInstruments` adicionado |
| Mar/2026 | Apex | Payout: 5 qualifying days ($100-$300) | Sub-objeto `payout.qualifyingDays` adicionado |
| Mar/2026 | Apex | Video reviews/screenshots eliminados | Simplifica tracking (sem impacto no modelo) |

## Estimativa Total

~4 sessões (Fase 1: 1, Fase 2: 1.5, Fase 3: 1, Fase 4: 0.5)

## Chunks Necessários

| Chunk | Modo | Motivo |
|-------|------|--------|
| CHUNK-02 | escrita | StudentDashboard — card de conta prop |
| CHUNK-04 | leitura | trades — validação de instrumentos restritos no registro |
| CHUNK-13 | leitura | Context Bar — conta prop precisa ser selecionável |
| CHUNK-NEW | escrita | PropFirmEngine — nova engine de drawdown + templates (propor criação) |
