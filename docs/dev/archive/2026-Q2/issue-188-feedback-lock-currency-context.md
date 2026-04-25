# Issue #188 — fix: FeedbackPage mentor edit+lock+recalc + currency multi-moeda + PlanSummaryCard + ContextBar respect total

## Autorização

- [x] Mockup apresentado (sessão 24/04/2026, resposta do modelo pré-`go`)
- [x] Memória de cálculo apresentada (mesma sessão)
- [x] Marcio autorizou — 24/04/2026 "tudo junto - go"
- [x] Gate Pré-Código liberado

## Context

Issue agrupa 4 frentes Sev1 no domínio de feedback/dashboard:

- **F1** — Mentor comenta no trade mas não consegue corrigir emoção/setup do aluno; sem lock, sem recalc. Mentor vira "mensageiro ignorado".
- **F2** — `MentorDashboard` formata todos os valores como BRL (hardcode no default do helper + agregação somando USD+BRL como mesma moeda).
- **F3** — `FeedbackPage` não tem resumo do plano; mentor precisa sair da tela para consultar contexto do plano.
- **F4** — `useDashboardMetrics` não consome `periodRange`/`cycleKey` da ContextBar; vários cards do `StudentDashboard` ignoram o filtro contextual.

Pair programming fast-track, tudo num PR. Branch `fix/issue-188-feedback-lock-currency-context`. Target v1.45.0.

## Spec

Ver body de [#188](https://github.com/marcioportes/acompanhamento-2.0/issues/188). Chunks + escopo travado também lá.

## Mockup

### F1 — Mentor edita + lock + recalc

**Estado A (trade aberto, sem lock, visão mentor):**
```
[TradeInfoCard read-only]
  Setup: Pullback   Em.Entrada: FOMO   Em.Saída: Regret

[▸ Editar campos do aluno (mentor)]   ← colapsado, glass-amber border
```

**Estado B (expande "Editar"):**
```
┌ Correção pedagógica (só mentor) ──────────────┐
│ Emoção entrada: [Calmo ▼]   (era: FOMO)      │
│ Emoção saída:   [Firme ▼]   (era: Regret)    │
│ Setup:          [Pullback ▼] (era: Breakout) │
│ ⚠ Travar = imutável. Nem você nem aluno      │
│   editam depois. Import (CSV/broker)         │
│   pode destravar.                            │
│ [Cancelar] [Reverter ao original]            │
│                       [Confirmar e travar →] │
└───────────────────────────────────────────────┘
```

**Modal confirmação:**
```
Você vai alterar:
  Em.Entrada: FOMO → Calmo
  Setup:      Breakout → Pullback
Após confirmar, ninguém edita esses 3 campos.
[Voltar] [Confirmar e travar]
```

**Estado C (pós-lock, visão aluno):**
```
🔒 Travado pelo mentor em 24/04/2026
Setup: Pullback*   Em.Entrada: Calmo*   Em.Saída: Firme*
       ↑tooltip "era Breakout, corrigido pelo mentor"
```

**ExtractTable/PlanLedgerExtract:** badge âmbar `🔒 corrigido` ao lado do ticker na linha do trade locked.

**TradeDetailModal:** bloco "Histórico de correções" no rodapé listando cada `_mentorEdits` entry.

### F2 — Currency multi-moeda no MentorDashboard

**Card P&L Turma:**
```
ANTES                          DEPOIS
┌──────────────────┐          ┌──────────────────┐
│ R$ 45.320,00 ↑   │          │ BRL  R$ 32.100 ↑ │
│ (mistura BRL+USD)│          │ USD  +$ 2.450 ↑  │
│                  │          │ EUR  —           │
└──────────────────┘          │ 12 alunos · 247  │
                              └──────────────────┘
```

**Lista "Aguardando feedback":**
```
ES LONG · 24/04 · joao@ · Pullback    +US$ 340,00   [Dar feedback]
WIN SHORT · 24/04 · maria@ · Rompto   -R$ 180,00    [Dar feedback]
```

**Ranking aluno:** stack por moeda no card individual.

### F3 — PlanSummaryCard no FeedbackPage

**Colapsado (default):**
```
┌ Plano · "MNQ Conservador" · USD ────────────[+]┐
│ 🎯 RO 0,5% · RR 1,5 · Cap US$ 10.000           │
│ 🚫 Bloqueadas: FOMO, Revanche                   │
│ 📅 Ciclo mensal: dia 24 de 30 (24/04)          │
└─────────────────────────────────────────────────┘
```

**Expandido:**
```
┌ Plano · "MNQ Conservador" · USD ────────────[−]┐
│ 🎯 RO 0,5% · RR 1,5 · Cap US$ 10.000           │
│ 🚫 Bloqueadas: FOMO, Revanche                   │
│ 📅 Ciclo mensal: dia 24 de 30 (24/04)          │
│ ─────────────────────────────────────────────  │
│ Período (Diário): Meta +0,5% · Stop -1,5%      │
│ Ciclo  (Mensal):  Meta +5%   · Stop -10%       │
│ PL atual: US$ 10.350 (+3,5% no ciclo)          │
│ [Ver extrato completo →]                        │
└─────────────────────────────────────────────────┘
```

**Posição:** coluna esquerda de `FeedbackPage`, entre `TradeInfoCard` e `ShadowBehaviorPanel`. Embedded mode idem.

### F4 — TODOS os cards do StudentDashboard respeitam ContextBar

**Contrato:** `ContextBar = {accountId, planId, cycleKey, periodRange}` → todos os cards renderizam **só** trades dentro de `[accountId ∩ planId ∩ periodRange]`. Sem override. Sem badge "vitalício". `filters.period` legado removido da UI + hook.

**Cards afetados (inventário auditado):**

| # | Card | Antes | Depois |
|---|---|---|---|
| 1 | `MetricsCards` (totalPL, WR, MaxDD, EV, payoff, complianceRate, CV, durationDelta, plContext) | usa `filters.period` legado | usa `context.periodRange`+`context.cycleKey` |
| 2 | `EquityCurve` | recebe `filteredTrades` global | recebe filtrado; baseline = `plan.pl` (se ciclo) |
| 3 | `TradingCalendar` | dias globais | só dias do ciclo/período |
| 4 | Daily trades inline | herda calendário | herda |
| 5 | `SetupAnalysis` | recebe `filteredTrades` | herda |
| 6 | `EmotionAnalysis` | recebe `filteredTrades` | herda |
| 7 | `SwotAnalysis` | filtra por `accountPlanIds` | adiciona filtro `cycleKey` |
| 8 | `PendingTakeaways` | só `studentId` | adiciona `planId`+`cycleKey` |
| 9 | `PlanCardGrid` | render todos | destaca `planId` ativo (já faz) |
| 10 | `Filters` legado | dropdown period | UI removida |

## Memória de Cálculo

### F1

**Inputs:** `trade.{emotionEntry, emotionExit, setup}`, `plan.blockedEmotions[]`, `mentorContext.{uid, email, name}`.

**Mutações no doc trade (write atômico):**
```
trade._lockedByMentor = true
trade._lockedAt = serverTimestamp()
trade._lockedBy = { uid, email, name }
trade._mentorEdits.push({ field, oldValue, newValue, editedAt, editedBy:{uid,email} })
trade._studentOriginal = { emotionEntry, emotionExit, setup }  // gravado no 1º edit, imutável
trade.<field> = newValue                                        // só nos 3 whitelisted
```

**Recalc downstream:**
- `onTradeUpdated` (`functions/index.js:1025`): adicionar `emotionEntry` ao array `complianceFields` (fix bug pré-existente) → `calculateTradeCompliance` roda → flag `BLOCKED_EMOTION` recalcula: `plan.blockedEmotions.includes(newEmotion)` ? flag : remove.
- `setup` editado: flag compliance não muda (setup não está em `calculateTradeCompliance`); `SetupAnalysis` recalcula client-side via memoization (zero write).
- `emotionExit` editado: zero write; emotional V2 recalcula client-side reativo.

**Baseline pré-issue:**
- `onTradeUpdated.complianceFields` não inclui `emotionEntry` → flag `BLOCKED_EMOTION` fica estale quando emoção muda.
- Lock não existe → mentor comenta mas não corrige.

**Limites:**
- Lock protege só os 3 campos comportamentais. Campos factuais (entry/exit/qty/result) seguem fluxo normal.
- Import (CSV/Order) que mexe em qualquer campo do trade destrava (`_lockedByMentor → false`); preserva `_mentorEdits[]` e `_studentOriginal` (auditoria).
- Admin pode destravar manualmente (campo livre pós-v1).
- Trade em ciclo finalizado: `weeklyReviewSnapshot` não é reescrito (integridade histórica).

**Exemplo numérico:**
```
T0 (aluno cria): emotionEntry='FOMO', setup='Breakout', emotionExit='Regret'
  plan.blockedEmotions=['FOMO','REVENGE']
  → redFlags=['BLOCKED_EMOTION:FOMO']

T1 (mentor edita+trava): emotionEntry FOMO→Calmo; setup Breakout→Pullback
  _mentorEdits=[
    {field:'emotionEntry', oldValue:'FOMO', newValue:'Calmo', editedAt:24/04, editedBy:maria@},
    {field:'setup',         oldValue:'Breakout', newValue:'Pullback', editedAt:24/04, editedBy:maria@}
  ]
  _studentOriginal={emotionEntry:'FOMO', emotionExit:'Regret', setup:'Breakout'}
  _lockedByMentor=true, _lockedAt=24/04 14:36, _lockedBy=maria
  → CF roda: 'Calmo' ∉ blockedEmotions → redFlags=[]

T2 (aluno reimporta CSV): trade.result 340→355
  → _lockedByMentor=false; _mentorEdits/_studentOriginal preservados
  Mentor vê sinal "trade destravado por import; reanalisar?"
```

### F2

**Inputs:** `trades[]` onde cada trade tem `result: number` + `currency: string`.

**Agregação:**
```js
totalsByCurrency = trades.reduce((acc, t) => {
  const cur = t.currency || 'BRL';
  acc[cur] = (acc[cur] || 0) + (t.result || 0);
  return acc;
}, {});
// render: cada par (cur, sum) vira linha com formatCurrency(sum, cur)
```

**Limites:**
- Trade legacy sem `currency` → fallback BRL.
- Single-currency turma → colapsa para linha única.
- FX conversion fora (decisão F2-6).

**Exemplo:**
```
trades = [
  {result:+1500, currency:'BRL'}, {result:-200, currency:'BRL'}, {result:+800, currency:'BRL'},
  {result:+300, currency:'USD'}, {result:-50, currency:'USD'},
]
totalsByCurrency = { BRL: 2100, USD: 250 }
Render: "BRL +R$ 2.100,00 / USD +US$ 250,00"
```

**Pontos de aplicação** (5): `MentorDashboard.jsx:292, 339, 421, 467, 574`.

### F3

**Inputs:** `plan` (via `usePlans` resolvendo `trade.planId`), `accounts` (para `getPlanCurrency`), `today`.

**Derivações:**
| Saída | Fórmula | Origem |
|---|---|---|
| `currency` | `getPlanCurrency(plan, accounts)` | `src/utils/currency.js` |
| `cycle.startDate`/`endDate` | `computePlanState(plan, today).cycleStart/cycleEnd` | `src/utils/planStateMachine.js:284` |
| `cycle.dayX` | `floor((today - cycleStart) / 86400000) + 1` | derivado |
| `cycle.dayN` | `floor((cycleEnd - cycleStart) / 86400000) + 1` | derivado |
| `cycle.pctOfPL` | `(currentPl - pl) / pl × 100` | derivado |

**Limites:**
- Plano deletado: render fallback `Plano deletado · ID NNN`.
- Plano inativo (`active === false`): badge âmbar `arquivado`.
- `blockedEmotions` vazio: linha "🚫" suprimida.

**Exemplo:**
```
plan = {name:'MNQ Conservador', pl:10000, currentPl:10350, riskPerOperation:0.5,
        rrTarget:1.5, blockedEmotions:['FOMO','REVENGE'], adjustmentCycle:'Mensal',
        periodGoal:0.5, periodStop:1.5, cycleGoal:5, cycleStop:10, status:'IN_PROGRESS'}
today = 2026-04-24; cycleStart = 2026-04-01; cycleEnd = 2026-04-30
cycle.dayX = 24; cycle.dayN = 30; cycle.pctOfPL = (10350-10000)/10000*100 = +3,5%
```

### F4

**Refator em `useDashboardMetrics`:**
```js
useDashboardMetrics({
  accounts, trades, plans,
  context: { accountId, planId, cycleKey, periodRange: {start, end} | null },
  filters: { ticker, setup, emotion, search },  // SEM period (legado removido)
  accountTypeFilter,
})
```

**Filtragem central:**
```js
filteredTrades = trades.filter(t => {
  if (context.accountId && t.accountId !== context.accountId) return false;
  if (context.planId    && t.planId    !== context.planId)    return false;
  if (context.periodRange) {
    const d = parseTradeDate(t.date);
    if (d < context.periodRange.start) return false;
    if (d > context.periodRange.end)   return false;
  }
  return matchesGranularFilters(t, filters);
});
```

**Métricas derivadas (sobre `filteredTrades`):**
| Métrica | Fórmula |
|---|---|
| totalPL | `Σ t.result` |
| winRate | `wins / total` |
| MaxDD | peak-to-trough da série cumulativa |
| Payoff | `avgWin / |avgLoss|` |
| EV | `Σ result / count` |
| consistencyCV | `std(dailyPL) / |mean(dailyPL)|` |
| durationDelta | `mean(durationW) − mean(durationL)` |
| complianceRate | `compliantCount / count` |
| EquityCurve baseline | `plan.pl` se cycleKey, senão `account.initialBalance` |

**Baseline pré-issue:** hook ignora `periodRange`/`cycleKey`. `filters.period` legado ainda vivo.

**Limites:**
- `context.accountId == null` (Todas as contas): `periodRange=null`, `cycleKey=null`, janela = ALL.
- Trade na borda do ciclo (`date === cycleEnd`): comparação inclui borda (`end` às 23:59:59.999).
- Timezone: `trade.date` é ISO `YYYY-MM-DD`; parse com offset 0.

**Critério de aceite:**
1. Unit test `useDashboardMetrics`: fixture 3 ciclos × 50 trades; assert `cycleKey=C2` retorna só os 30 trades de C2.
2. Invariante novo `src/__tests__/invariants/contextBarRespect.test.js`: para cada card consumidor, assert `props.trades ⊆ filteredTrades(context)`.
3. Checklist visual Gate Pré-Entrega: trocar ContextBar entre ciclos, verificar números em todos os cards.

**Exemplo:**
```
Aluno com 3 ciclos mesma conta+plano:
  C1 jan: 50 trades, ΣPL=+5000, MaxDD=-800
  C2 fev: 30 trades, ΣPL=-1200, MaxDD=-2500
  C3 mar: 40 trades, ΣPL=+3500, MaxDD=-1100
ContextBar=C2: filteredTrades=30, totalPL=-1200, MaxDD=-2500
ContextBar="Todas": filteredTrades=120, totalPL=+7300
```

## Phases

- A — F2 Currency multi-moeda (isolada, baixo risco; abre caminho)
- B — F3 PlanSummaryCard (componente novo, baixo risco)
- C — F4 ContextBar respect: refator `useDashboardMetrics` + auditoria 10 cards + remoção `filters.period` legado + testes invariante
- D — F1a Schema + gateway + rules (INV-15): 5 campos novos em trades, `editTradeAsMentor`/`lockTradeByMentor`, rules de lock
- E — F1b CF `onTradeUpdated.complianceFields` inclui `emotionEntry` (fix bug pré-existente)
- F — F1c UI FeedbackPage mentor edit panel + confirmação + badges lock em ExtractTable/TradeDetailModal
- G — F1d Import destrava: CSV/OrderImport resetam `_lockedByMentor` preservando auditoria
- H — Gate Pré-Entrega: build + suite completa + verificação manual das 4 frentes

## Sessions

- 25/04/2026 — Fase A — F2 currency multi-moeda MentorDashboard — `aggregateTradesByCurrency` + `MultiCurrencyAmount.jsx` + 7 refactors em `MentorDashboard.jsx` (P&L Turma stack, ranking, lista, detalhe, pending list, bulk modal) — commit `6b9a2472`
- 25/04/2026 — Fase B — F3 `PlanSummaryCard.jsx` colapsável + integração FeedbackPage embedded+standalone via `usePlans/useAccounts` com `overrideStudentId` — commit `7fe7628a`
- 25/04/2026 — Fase C — F4 `useDashboardMetrics` v2.1.0 aceita `context{accountId,planId,cycleKey,periodRange}` + filtragem central por janela; `filters.period` removido; `Filters.jsx` 6→5 col; `PendingTakeaways` recebe `planId` — commit `9cc19e07`
- 25/04/2026 — Fase D — F1a schema 5 campos + `tradeGateway.MENTOR_EDITABLE_FIELDS` + 3 novas funções gateway + `firestore.rules` ownership+lock+metadata guard — commit `3ee61d49`
- 25/04/2026 — Fase E — F1b CF `onTradeUpdated.complianceFields` inclui `emotionEntry`; reconstrução de redFlags filtra/recompila `BLOCKED_EMOTION` — commit `ef80725f`
- 25/04/2026 — Fase F — F1c UI `MentorEditPanel` + `TradeLockBadge` + asterisco campos editados + ícone `Lock` na ExtractTable + bloco "Histórico de correções" no TradeDetailModal — commit `2797d490`
- 25/04/2026 — Fase G — F1d server-side unlock por import via CF `onTradeUpdated` quando `importBatchId` muda (admin SDK bypassa rules; preserva `_mentorEdits`/`_studentOriginal`) — commit `591ca8bf`
- 25/04/2026 — Fase H — Gate Pré-Entrega: bump v1.45.0 + CHANGELOG + suite 2445/2445 + lint baseline pre-existente — commit `e2465233`
- 25/04/2026 — Smoke-test polish — `PlanSummaryCard` fontes -1pt + valores absolutos da moeda em RO/Período/Ciclo Meta+Stop; tooltips com fórmulas calculadas em todos os KPIs/quadrantes da Matriz Emocional 4D — commit `9bc3d235`
- 25/04/2026 — Merge `origin/main` resolvido em `CHANGELOG.md` + `src/version.js` (HEAD vence — entrada definitiva v1.45.0 + preserva v1.44.1 do #191) — merge commit `f90df662`

## Shared Deltas (aplicados na Abertura)

- `docs/registry/chunks.md` — 8 locks ativos para este issue (commit `a9e9a90f`)
- `docs/registry/versions.md` — v1.45.0 reservada (commit `a9e9a90f`)
- `src/version.js` — entrada CHANGELOG v1.45.0 `[RESERVADA]` (commit `a9e9a90f`)

## Shared Deltas (consumados no Encerramento)

- `src/version.js` — `version: '1.45.0'` + `build: '20260425'` + resumo final consolidado (commit `e2465233` na branch; squash `a7b89c89` no main via PR #195)
- `CHANGELOG.md` — entrada definitiva `[1.45.0] - 25/04/2026` (commit `e2465233` na branch; squash `a7b89c89` no main)
- `docs/registry/versions.md` — v1.45.0 marcada `consumida (PR #195 squash a7b89c89)`
- `docs/registry/chunks.md` — 8 locks liberados (CHUNK-02/03/04/05/06/08/13/16)
- `docs/decisions.md` — DEC-AUTO-188-01..07 consolidadas
- `docs/dev/archive/2026-Q2/` — este doc movido via `scripts/archive-issue.sh 188`

## Decisions

- DEC-AUTO-188-01 — Schema do lock comportamental: 5 campos inline no doc trade (`_lockedByMentor`, `_lockedAt`, `_lockedBy`, `_mentorEdits[]`, `_studentOriginal`); array append-only para histórico; sem subcollection (INV-12 consistency).
- DEC-AUTO-188-02 — Escopo do lock limitado a 3 campos comportamentais (`emotionEntry`, `emotionExit`, `setup`); campos factuais seguem fluxo normal.
- DEC-AUTO-188-03 — Import (CSV/Order) destrava lock inteiro preservando auditoria; broker é fonte de verdade superior ao mentor e ao aluno.
- DEC-AUTO-188-04 — Admin pode destravar lock manualmente (sem UI dedicada v1; campo editável direto no Firestore).
- DEC-AUTO-188-05 — Agregação multi-moeda via stack vertical no MentorDashboard; FX conversion fora de escopo.
- DEC-AUTO-188-06 — ContextBar é SoT única de janela temporal no StudentDashboard; `filters.period` legado removido sem override vitalício.
- DEC-AUTO-188-07 — `onTradeUpdated.complianceFields` passa a incluir `emotionEntry` (fix bug pré-existente entra junto).

## Chunks

- CHUNK-08 (escrita) — F1 edit+lock + F3 PlanSummaryCard no FeedbackPage
- CHUNK-04 (escrita) — F1 gateway + 5 campos novos em trades (INV-15)
- CHUNK-05 (escrita) — F1 CF complianceFields emotionEntry
- CHUNK-06 (escrita) — F1 emoções editáveis
- CHUNK-03 (escrita) — F3 PlanSummaryCard lê plan schema
- CHUNK-16 (escrita) — F2 currency multi-moeda
- CHUNK-13 (escrita) — F4 useDashboardMetrics aceita context
- CHUNK-02 (escrita) — F4 StudentDashboard respeita ContextBar sem exceção
