# Attack Plan — Tabela Determinística para Código
## Referência para `calculateAttackPlan` instrument-aware
> **Versão:** 2.0
> **Data:** 07/04/2026
> **Complementa:** instruments-table-prop-firms.md v1.0 (specs + session profiles)

---

## 1. PERFIS DE ATAQUE (EVAL)

> Lógica invertida: quanto mais arrisca, menos opera. Disciplina forçada pelo sizing.
> RO = percentual do drawdown. RR fixo 1:2.

```javascript
export const ATTACK_PROFILES = {
  CONSERVATIVE_A: {
    name: 'Conservador Leve',
    code: 'CONS_A',
    roPct: 0.10,        // 10% do drawdown
    rr: 2,
    maxTradesPerDay: 2,
    description: 'Scalp com margem. Máxima resiliência.',
    idealFor: 'Stage 1-2, emocional baixo, sem histórico consistente',
    minWR: 0.40,        // WR mínimo para ser viável (aprovação > 50%)
  },
  CONSERVATIVE_B: {
    name: 'Conservador Sweet Spot',
    code: 'CONS_B',
    roPct: 0.15,        // 15% do drawdown
    rr: 2,
    maxTradesPerDay: 2,
    description: 'Day trade clássico. Melhor relação aprovação/bust/tempo.',
    idealFor: 'Stage 2-3, WR >= 45%',
    minWR: 0.45,
    recommended: true,  // default sugerido
  },
  CONSERVATIVE_C: {
    name: 'Conservador Firme',
    code: 'CONS_C',
    roPct: 0.20,        // 20% do drawdown
    rr: 2,
    maxTradesPerDay: 2,
    description: 'Swing intraday. Mais rápido mas exige disciplina.',
    idealFor: 'Stage 3+, WR >= 50%',
    minWR: 0.50,
  },
  AGGRESSIVE_A: {
    name: 'Agressivo',
    code: 'AGRES_A',
    roPct: 0.25,        // 25% do drawdown
    rr: 2,
    maxTradesPerDay: 1,
    description: 'Swing com convicção. 1 trade/dia — o melhor setup.',
    idealFor: 'Stage 3-4, WR >= 55%, disciplina comprovada',
    minWR: 0.55,
  },
  AGGRESSIVE_B: {
    name: 'Agressivo Máximo',
    code: 'AGRES_B',
    roPct: 0.30,        // 30% do drawdown
    rr: 2,
    maxTradesPerDay: 1,
    description: 'Trade de convicção máxima. Sem margem para erro.',
    idealFor: 'Stage 4+, WR >= 55%, controle emocional alto',
    minWR: 0.55,
  },
};
```

## 2. FÓRMULA DE CÁLCULO

```javascript
/**
 * calculateAttackPlan(account, profile, instrument)
 *
 * Inputs:
 *   account.drawdownMax       - ex: $1.000
 *   account.profitTarget      - ex: $1.500
 *   account.dailyLossLimit    - ex: $500
 *   account.evalDays          - ex: 21 (dias úteis)
 *   profile                   - ATTACK_PROFILES[key]
 *   instrument                - da instrumentsTable (pointValue, avgDailyRange, micro, etc.)
 *
 * Outputs:
 *   roUSD           = drawdownMax × profile.roPct
 *   stopPoints      = roUSD / instrument.pointValue
 *   targetPoints    = stopPoints × profile.rr
 *   stopNyPct       = stopPoints / (instrument.avgDailyRange × 0.60) × 100
 *   maxTradesPerDay = profile.maxTradesPerDay
 *   lossesToBust    = floor(drawdownMax / roUSD)
 *   dailyTarget     = profitTarget / evalDays
 *   winUSD          = roUSD × profile.rr
 *   evPerTrade      = (WR × winUSD) - ((1 - WR) × roUSD)   // WR do aluno ou 0.50 default
 *
 * Viabilidade:
 *   Se stopPoints < minViableStop[instrument.type] → INVIÁVEL, sugerir micro
 *   Se stopNyPct > 75% → INVIÁVEL, stop maior que o range da sessão
 *   Se roUSD > dailyLossLimit → INVIÁVEL
 *   Se roUSD × maxTradesPerDay > dailyLossLimit → reduzir maxTrades
 */
```

## 3. VIABILIDADE — STOP MÍNIMO POR TIPO

```javascript
export const MIN_VIABLE_STOP = {
  equity_index: 15,   // pontos — abaixo disso é ruído no MNQ/MES
  energy: 0.10,       // pontos — CL/MCL
  metals: 3,          // pontos — GC/MGC
  currency: 0.0003,   // pontos — 6E/6B/6J
  agriculture: 3,     // pontos — ZC/ZW/ZS
  crypto: 500,        // pontos — MBT
};

export const MAX_STOP_NY_PCT = 75; // stop > 75% do range NY = inviável
export const MIN_STOP_NY_PCT = 5;  // stop < 5% do range NY = ruído puro
```

## 4. PROBABILIDADES DE APROVAÇÃO (21 dias úteis, RR 1:2, 200k simulações)

### Apex EOD 25K (DD $1.000, Target $1.500)

| Perfil | RO | Trd/d | WR 30% | WR 35% | WR 40% | WR 45% | WR 50% | WR 55% | WR 60% |
|--------|-----|-------|--------|--------|--------|--------|--------|--------|--------|
| CONS A | $100 | 2 | ☠️ 4.6% | 15.4% | 35.6% | 60.5% | **81.6%** | 93.8% | 98.6% |
| CONS B | $150 | 2 | ☠️ 14.6% | 33.3% | 56.9% | 78.0% | **91.2%** | 97.3% | 99.3% |
| CONS C | $200 | 2 | ☠️ 20.2% | 39.4% | 60.8% | 78.4% | **89.5%** | 95.2% | 97.9% |
| AGRES A | $250 | 1 | ☠️ 22.6% | 37.2% | 53.2% | 68.5% | **80.7%** | 89.3% | 94.5% |
| AGRES B | $300 | 1 | ☠️ 28.1% | 43.1% | 58.4% | 72.3% | **83.0%** | 90.4% | 95.0% |

### Bust rate por perfil (WR 50%)

| Perfil | Bust | Losses p/ bust | Dias médios |
|--------|------|----------------|-------------|
| CONS A | 0.7% | 10 | 12.5 |
| CONS B | 3.4% | 6 | 9.1 |
| CONS C | 8.8% | 5 | 7.3 |
| AGRES A | 13.2% | 4 | 8.8 |
| AGRES B | 13.1% | 3 | 7.6 |

### Breakeven

WR mínimo para EV positivo com RR 1:2 = **33.3%**. Abaixo disso cada trade tem EV negativo — a conta morre matematicamente.

### EV por trade (WR 50%)

| Perfil | EV/trade |
|--------|----------|
| CONS A | +$50 |
| CONS B | +$75 |
| CONS C | +$100 |
| AGRES A | +$125 |
| AGRES B | +$150 |

## 5. TABELA EM PONTOS — MNQ (1 contrato, $2/pt)

| Perfil | RO USD | Stop pts | Target pts | Stop/NY% | Estilo |
|--------|--------|----------|------------|----------|--------|
| CONS A | $100 | 50 pts | 100 pts | 20.8% | Scalp/Day trade |
| CONS B | $150 | 75 pts | 150 pts | 31.2% | Day trade |
| CONS C | $200 | 100 pts | 200 pts | 41.7% | Swing intraday |
| AGRES A | $250 | 125 pts | 250 pts | 52.1% | Swing+ |
| AGRES B | $300 | 150 pts | 300 pts | 62.5% | Convicção |

## 6. MATRIZ DE COMPATIBILIDADE — Instrumento × Conta (perfil CONS B)

| Instrumento | 25K | 50K | 100K | 150K | 250K | 300K |
|-------------|-----|-----|------|------|------|------|
| MNQ ($2/pt) | ✅ 75pts | ⚠️ largo | ⚠️ largo | ❌ | ❌ | ❌ |
| MES ($5/pt) | ⚠️ largo | ⚠️ largo | ⚠️ largo | ⚠️ largo | ⚠️ largo | ⚠️ largo |
| MYM ($0.5/pt) | ⚠️ largo | ⚠️ largo | ⚠️ largo | ⚠️ largo | ⚠️ largo | ⚠️ largo |
| NQ ($20/pt) | ❌→MNQ | ✅ 19pts | ✅ 22pts | ✅ 38pts | ✅ 49pts | ✅ 56pts |
| ES ($50/pt) | ❌→MES | ❌→MES | ❌→MES | ✅ 15pts | ✅ 20pts | ✅ 22pts |
| YM ($5/pt) | ✅ 30pts | ✅ 75pts | ✅ 90pts | ✅ 150pts | ⚠️ largo | ⚠️ largo |
| RTY ($50/pt) | ❌→M2K | ❌→M2K | ❌→M2K | ⚠️ largo | ⚠️ largo | ⚠️ largo |
| CL ($1000/pt) | ❌→MCL | ❌→MCL | ❌→MCL | ❌→MCL | ❌→MCL | ✅ 1pt |
| GC ($100/pt) | ❌→MGC | ✅ 4pts | ✅ 4pts | ✅ 8pts | ✅ 10pts | ✅ 11pts |
| MGC ($10/pt) | ✅ 15pts | ⚠️ largo | ❌ | ❌ | ❌ | ❌ |

**Regra:** contas pequenas = micros. Contas grandes = full-size. A transição natural é:
- 25K: MNQ, MYM, MGC
- 50K-100K: NQ, YM, GC abrem
- 150K+: ES, NQ, GC confortáveis

## 7. REFERÊNCIA DE STOP POR ESTILO OPERACIONAL

| Estilo | Stop/NY% | MNQ (pts) | Observação |
|--------|----------|-----------|------------|
| Scalp apertado | 6-10% | 15-25 | Entrada cirúrgica obrigatória |
| Scalp normal | 12-21% | 30-50 | Margem para pullback moderado |
| Day trade | 21-33% | 50-80 | Segura swing intraday |
| Swing intraday | 33-50% | 80-120 | Posição de convicção |
| Convicção máxima | 50-70% | 120-170 | 1 trade/dia, sem margem |

## 8. SCALING COM 2 CONTRATOS

Com 2 contratos MNQ ($4/pt efetivo), stops em pontos caem pela metade:

| Perfil | 1 ctr Stop | 2 ctrs Stop | 2 ctrs viável? |
|--------|-----------|-------------|----------------|
| CONS A | 50 pts | 25 pts | ⚠️ Apertado |
| CONS B | 75 pts | 37 pts | ✅ Scalp normal |
| CONS C | 100 pts | 50 pts | ✅ Day trade |
| AGRES A | 125 pts | 62 pts | ✅ Day trade |
| AGRES B | 150 pts | 75 pts | ✅ Day trade |

**Regra:** 2 contratos dobra ganho/ponto mas corta stop pela metade. Só viável se stop resultante > minViableStop.
