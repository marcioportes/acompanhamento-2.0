# Issue #273 — feat: Mesa Zero7 Tesouraria (CHUNK-17, primeira mesa BR/BRL)

## Autorização

- [x] **Mockup apresentado** — abaixo, 3 cenários textuais
- [x] **Memória de cálculo apresentada** — 8 planos + regra 50% + saldos inaptos + drawdown STATIC
- [x] **Marcio autorizou** — 12/05/2026 via aprovação do plano `/home/mportes/.claude/plans/eager-beaming-plum.md` (ExitPlanMode "Approved") + "segue direto"
- [x] **Gate Pré-Código liberado**

## Context

Adicionar **Zero7 Tesouraria** (zero7.com.br) como 6ª firma do portfólio CHUNK-17. Primeira mesa **brasileira** (B3) em **BRL** no Espelho. Drivers: marketing + eventual parceria institucional.

Hoje: 5 firmas US (APEX/MFF/Lucid/Tradeify/Ylos), 33 templates USD. Análise de regressão revelou arquitetura 90% pronta para multi-currency. Custo real ~3 dias.

## Spec

Ver issue body no GitHub: **#273**. Plano completo: `/home/mportes/.claude/plans/eager-beaming-plum.md`.

## Mockup

### M1 — Criação de conta Zero7 (`AddAccountModal`)

```
┌─ Nova conta ─────────────────────────────────────────┐
│ Tipo: [PROP ▾]                                       │
│ Firma: [Zero7 Tesouraria ▾]   ← entrada nova         │
│ Produto: [TRAINEE ▾]                                 │
│         (TRAINEE/JÚNIOR/PLENO/SÊNIOR/EXPERT/MASTER   │
│          + BIT 8 / BIT 16 — 8 opções)                │
│ Saldo inicial: R$ 0,00       ← auto, accountSize=0   │
│ Moeda: BRL                   ← auto via template     │
│                                                       │
│ Resumo do plano selecionado:                         │
│   Meta: R$ 997    DD diário: R$ 247                  │
│   DD total: R$ 997   Contratos: 8                    │
│   Profit split: 90%   Prazo aval.: 60 dias           │
│                                                       │
│           [Cancelar]  [Criar conta]                  │
└──────────────────────────────────────────────────────┘
```

### M2 — `PropAccountCard` (Zero7, dia que dispara consistência 50%)

```
┌─ Zero7 Tesouraria · TRAINEE · Avaliação ─────────────┐
│ Saldo: R$ 510,00   |   Profit: R$ 510 / R$ 997 (51%) │
│ DD diário: R$ 0 / R$ 247                              │
│ DD total: R$ 510 acima do floor (-R$ 997)            │
│                                                       │
│ [████████████░░░░░░░] 51% do target                  │
│ [░░░░░░░░░░░░░░░░░░░]  0% do DD diário               │
│                                                       │
│ ⚠ CONSISTENCY_VIOLATION                              │
│   Dia ultrapassou 50% da meta (R$ 510 > R$ 498,50).  │
│   Conta desclassificada na avaliação Zero7.          │
│                                                       │
│ Fase: [Avaliação ▾]                                   │
│ Prazo: 47 dias restantes                              │
└──────────────────────────────────────────────────────┘
```

### M3 — `PropPayoutTracker` (Zero7 Incubadora, 4 saques)

```
┌─ Quando posso sacar? ─────────────────────────────────┐
│ Próxima janela: 20/05/2026 (8 dias)                  │
│   Calendário fixo: dias 10, 20, 30                   │
│                                                       │
│ Saldo disponível: R$ 1.842,50                         │
│   ↳ 2 trades descartados (saldo inapto):              │
│     WIN +5pt (mín 10pt), BIT +800pt (mín 1000pt)     │
│                                                       │
│ Split: 90% (R$ 1.658,25 ao trader)                   │
│                                                       │
│ Saques nesta fase: ████████░░ 3 de 4                 │
│   Próximo saque: 4 de 4 — último permitido           │
│   Após o limite, lucros migram para margem            │
│                                                       │
│ Histórico:                                            │
│   10/04/2026 — R$ 800   |  20/04/2026 — R$ 1.200    │
│   30/04/2026 — R$ 950                                 │
└──────────────────────────────────────────────────────┘
```

## Memória de Cálculo

### 1) Drawdown STATIC com `accountSize = 0`

**Modelo Zero7:** "saldo positivo soma ao limite de perda total". Equivalente semântico ao tipo `STATIC` existente com saldo inicial zero.

- **Floor da conta:** `balance_floor = accountSize - drawdown.maxAmount = 0 - 997 = -997`
- **Equity atual:** `balance = sum(trades.netPL)`
- **Conta busted se:** `balance < balance_floor`
- **DD distance:** `(balance - balance_floor) / drawdown.maxAmount`

Quando aluno ganha R$ 300, está a `(300 - (-997)) / 997 = 130%` do floor — naturalmente afastado, igual ao modelo "saldo positivo soma ao buffer".

**Exemplo TRAINEE:**
- Trade 1 WIN +20pt = +R$ 4 → balance R$ 4, distance 100.4%
- Trade 2 WDO -5pt = -R$ 25 → balance -R$ 21, distance 97.9%
- Sequência -R$ 997 cumulativos → balance -R$ 997 = floor → BUST.

### 2) Regra de consistência 50%

**Fonte:** Zero7 regulamento `/regulamento/`. Aplicação **dual** dependendo da fase:

#### Fase EVALUATION
```
para cada dia D na janela [phaseStartDate, today]:
  dailyPL = sum(trades.netPL where day == D)
  if dailyPL > profitTarget * 0.50:
    flag CONSISTENCY_VIOLATION (account fail)
```

**Exemplo TRAINEE (profitTarget R$ 997):**
- Dia 1: P&L R$ 510 → 510 > 997 × 0.50 = 498.50 → **DESCLASSIFICA** (510 > 498.50)
- Dia 2: P&L R$ 400 → 400 ≤ 498.50 → OK

#### Fase SIM_FUNDED
```
totalCyclePL = sum(trades.netPL no ciclo de payout)
inflatedDays = [D for D in days where dailyPL >= 0.50 * totalCyclePL]
eligibleWithdrawal = totalCyclePL - sum(dailyPL[inflatedDays])
```

**Exemplo Incubadora ciclo R$ 3.000:**
- Dia 5: P&L R$ 1.800 → 1800 ≥ 3000 × 0.50 = 1500 → **descartado**
- eligibleWithdrawal = 3000 − 1800 = R$ 1.200 (× 90% split = R$ 1.080)

### 3) Filtro de saldos inaptos (Zero7-específico)

**Thresholds por instrumento (Incubadora apenas):**
- WIN: |netPoints| ≥ 10
- WDO: |netPoints| ≥ 0,5
- BIT: |netPoints| ≥ 1000

```
filterIneligibleTrades(trades, filter):
  return trades.filter(t =>
    !filter[t.instrument] || Math.abs(t.netPoints) >= filter[t.instrument]
  )
```

**Exemplo:** trade WIN +5pt → 5 < 10 → descartado do payout. Trade WIN +20pt → 20 ≥ 10 → considerado.

### 4) Payout fixed-days

**Calendário Zero7:** dias 10, 20, 30 de cada mês.
```
isPayoutWindowOpen(today, fixedDays=[10,20,30]):
  dom = today.getDate()
  nextDay = min(d for d in fixedDays if d >= dom) or fixedDays[0]+nextMonth
  return { open: dom in fixedDays, nextDay }
```

### 5) Limite de 4 saques na Incubadora

```
withdrawalsThisPhase = movements.filter(m =>
  m.type === 'WITHDRAWAL' &&
  m.accountId === account.id &&
  m.phase === 'SIM_FUNDED'
).length

remaining = template.payout.maxWithdrawalsByPhase[phase] - withdrawalsThisPhase
```

UI: badge "Saque X de 4". Quando `remaining === 0`: "Limite atingido — próximos lucros migram para margem".

### 6) Tabela completa dos 8 planos Zero7

| Plano | Meta | DD diário | DD total | Contratos | Split | Preço |
|---|---|---|---|---|---|---|
| TRAINEE | R$ 997 | R$ 247 | R$ 997 | 8 | 90% | R$ 226,80 |
| JÚNIOR | R$ 1.997 | R$ 497 | R$ 1.997 | 16 | 90% | R$ 330,80 |
| PLENO | R$ 4.997 | R$ 1.247 | R$ 4.997 | 40 | 90% | R$ 500,10 |
| SÊNIOR | R$ 9.997 | R$ 2.497 | R$ 9.997 | 80 | 90% | R$ 830,10 |
| EXPERT | R$ 14.997 | R$ 3.747 | R$ 14.997 | 120 | 80% | R$ 1.766,80 |
| MASTER | R$ 19.997 | R$ 4.997 | R$ 19.997 | 160 | 80% | R$ 2.158,80 |
| BIT 8 | R$ 997 | R$ 247 | R$ 997 | 8 (BIT) | 90% | R$ 226,80 |
| BIT 16 | R$ 1.997 | R$ 497 | R$ 1.997 | 16 (BIT) | 90% | R$ 330,80 |

Todos: `evalTimeLimit: 60` dias, `dailyLossAction: PAUSE_DAY`, `consistency.maxDayPercentOfTarget: 0.50`, `payout.scheduleType: FIXED_DAYS`, `payout.fixedDays: [10,20,30]`, `payout.maxWithdrawalsByPhase: { SIM_FUNDED: 4 }`, `payout.ineligibleTradeFilter: { WIN: 10, WDO: 0.5, BIT: 1000 }`, `accountSize: 0`, `currency: 'BRL'`.

### 7) Instrumentos B3 (`instrumentsTable.js`)

| Symbol | Exchange | Type | tickSize | tickValue | pointValue | Sessão |
|---|---|---|---|---|---|---|
| WIN | B3 | equity_index | 5 pt | R$ 1,00 | R$ 0,20 | 09:00-17:55 BRT |
| WDO | B3 | fx | 0,5 pt | R$ 5,00 | R$ 10,00 | 09:00-17:55 BRT |
| BIT | B3 | crypto | 5 USD | confirmar | confirmar | 09:00-17:55 BRT |

### 8) Sharpe multi-currency (Fase 3)

**Bug latente atual:** `computeCycleSharpe` usa Selic (BRL) como rfr para trades USD.

**Fix:**
```
currencyRiskFreeRate = {
  'BRL': getSelicForDate(date),  // já existe
  'USD': SOFR_PLACEHOLDER         // DT-Zero7-03 (defer fetch real)
}
rfr_for_trade = currencyRiskFreeRate[trade.currency] ?? Selic
```

## Phases

- **A1** — Schema base: campos novos em `propFirmDefaults.js` (currency, consistency.maxDayPercentOfTarget, payout.scheduleType/fixedDays/maxWithdrawalsByPhase/ineligibleTradeFilter)
- **A2** — 8 templates Zero7 em `propFirmDefaults.js`
- **A3** — Instrumentos B3 (WIN/WDO/BIT) em `instrumentsTable.js`
- **A4** — accountSize=0 no engine + payout minBalance defensivo + teste positivo
- **A5** — Fallback `?? template.currency` em PropAccountCard/PropPayoutTracker/PropFirmPage
- **A6** — AddAccountModal usa `selectedTemplate.currency`
- **B1** — `propFirmConsistency.js` (novo) + testes
- **B2** — Flag CONSISTENCY_VIOLATION em `propFirmAlerts.js`
- **B3** — `isPayoutWindowOpen` + branch FIXED_DAYS em `propFirmPayout.js`
- **B4** — Contador 4 saques + UI no PropPayoutTracker
- **B5** — `filterIneligibleTrades` + nota informativa
- **B6** — Símbolos `$` hardcoded → dinâmicos
- **C1** — `currencyRiskFreeRate` em `computeCycleSharpe.js`
- **C2** — Mirror CJS em `functions/propFirmEngine.js`
- **C3** — Helper `getPhaseLabelByFirm` + aplicação
- **C4** — `attackPlanCalculator.js` branch B3 vs CME
- **C5** — Dropdown currency em `PropFirmConfigPage`

## Sessions

_(log linear — preenchido durante)_

## Shared Deltas

- `src/version.js` — bump v1.62.0 (já reservada em 12/05/2026)
- `docs/registry/versions.md` — marcar v1.62.0 consumida no encerramento
- `docs/registry/chunks.md` — liberar CHUNK-17
- `CHANGELOG.md` — nova entrada `[1.62.0] - DD/MM/2026`
- `docs/decisions.md` — DEC-AUTO-273-01..04
- `docs/tech-debt.md` — DT-Zero7-01..04

## Decisions

- DEC-AUTO-273-01 — STATIC drawdown com `accountSize: 0` = modelo Zero7 (sem tipo novo)
- DEC-AUTO-273-02 — Carreira Zero7 = estado de conta (templateId trocado pelo aluno)
- DEC-AUTO-273-03 — Regra 50% em módulo próprio (`propFirmConsistency.js`)
- DEC-AUTO-273-04 — `currencyRiskFreeRate` resolve bug Selic vs USD (SOFR placeholder)

## Chunks

- **CHUNK-17 (Prop Firm Engine) — ESCRITA** — catálogo + engine + UI da nova mesa
