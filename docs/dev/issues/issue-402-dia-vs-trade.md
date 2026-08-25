# Issue #402 — fix: separar o fato atômico (trade) do fato do dia

## Autorização

- [x] Mockup apresentado — plano aprovado em 25/08/2026 (mockup ASCII dos três estados: card do dia, painel do trade A limpo, painel do trade B com aviso de abertura)
- [x] Memória de cálculo apresentada — §Memória de Cálculo abaixo
- [x] Marcio autorizou — 25/08/2026, aprovação do plano em plan mode + respostas de escopo ("Resultado líquido do dia", "Dia é dono + marca de abertura")
- [x] Gate Pré-Código liberado

## Context

O card de um trade de −R$ 250 (primeira operação do dia, contra um limite diário de ~R$ 501) acusou violação de stop diário. A causa é `getDailyLoss` somar o dia inteiro sem corte temporal — e o importador ter gravado o segundo trade antes do primeiro. A acusação depende de ordem de escrita em lote.

Sob isso há um problema estrutural: `LOSS_DIARIO_EXCEDIDO` é o único fato **agregado** guardado num container **atômico** (`trade.redFlags[]`). Objetivo: três fatos, três donos, três superfícies — o que é da operação fica na operação, o que é do dia fica no dia, e aluno e mentor veem os mesmos números.

## Spec

Issue body no GitHub: #402. Plano completo com mockup: `~/.claude/plans/moonlit-waddling-parasol.md`.

## Mockup

Ver plano aprovado. Três estados, com os dados reais de 25/08:

1. **Card do dia** (`DayResultCard`, idêntico para aluno e mentor) — `−R$ 515,00 · 2 trades · folga R$ 0 de R$ 501 · Ultrapassado por R$ 14 · 0 operações após o stop`. Declara, não acusa: **nunca renderiza chip de violação**.
2. **Painel do trade A (10:51)** — bloco "ESTA OPERAÇÃO" sem violação nenhuma; R:R em dinheiro sem múltiplo âmbar, sem `· mínimo 2,00x`, com a nota de que o stop informado coincide com a saída; bloco "O DIA (25/08)" com o contexto em texto neutro.
3. **Painel do trade B (11:34)** — bloco "ESTA OPERAÇÃO" com aviso factual: *"quando esta operação abriu, restavam R$ 251,00 de folga e o plano autoriza R$ 252,00 por operação"*.

## Memória de Cálculo

### Inputs

| Campo | Origem | Default / ausente |
|---|---|---|
| `trade.result` | `trades/{id}.result` (number, R$) | `0` |
| `trade.entryTime` | `trades/{id}.entryTime` (ISO, com ou sem offset) | cai para `trade.date` ao meio-dia |
| `trade.date` | `trades/{id}.date` (`'YYYY-MM-DD'`) | sem isso o trade não entra em período nenhum |
| `trade.createdAt` / `trade.id` | desempate determinístico | — |
| `trade.exchange` / `trade.ticker` | resolução de fuso do `entryTime` naive | `defaultTzForExchange` → `defaultTzForTicker` → `null` |
| `plan.pl` | `plans/{id}.pl` (capital base, DEC-009) | `plan.currentPl` → `0` (aborta) |
| `plan.riskPerOperation` | `plans/{id}.riskPerOperation` (%) | `0` → sem `roVal`, sem autorização avaliável |
| `plan.periodStop` | `plans/{id}.periodStop` (%) | `0` → sem `stopValue`, período não avaliado |
| `plan.periodGoal` | `plans/{id}.periodGoal` (%) | idem |
| `plan.operationPeriod` | `'Diário'` \| `'Semanal'` | `'Diário'` |

### Fórmula

```
stopValue           = pl × periodStop / 100
goalValue           = pl × periodGoal / 100
roValue             = pl × riskPerOperation / 100
maxAuthorizedTrades = floor(stopValue / roValue)

rows                = trades do período ordenados por compareTradesChrono
cumBefore(N)        = Σ result das linhas com índice < N          // LÍQUIDO
cumAfter(N)         = cumBefore(N) + result(N)
budgetBefore(N)     = stopValue + cumBefore(N)                    // cushionPolicy 'net'
                    | stopValue + min(cumBefore(N), 0)            // cushionPolicy 'floor'

authorization(N)    = APOS_STOP    se cumBefore(N) <= -stopValue
                    | SEM_FOLGA    se 0 < budgetBefore(N) < roValue
                    | AUTORIZADA   caso contrário

net                 = Σ result                                    // resultado do dia
gains               = Σ result onde result > 0                    // só exibição
losses              = Σ |result| onde result < 0                  // só exibição
closedBeyondStop    = net <= -stopValue
tradesAfterStop     = #{ N : cumBefore(N) <= -stopValue }
```

**Ordem cronológica** (`compareTradesChrono`): `date` → instante do `entryTime` → `createdAt` → `id`. O instante resolve por: offset explícito (`source:'offset'`) → naive convertido por `naiveIsoToOffset` com fuso de `tzFromStoredIso(exitTime)` ?? `defaultTzForExchange(exchange)` ?? `defaultTzForTicker(ticker)` (`source:'inferred'`) → `date` ao meio-dia local (`source:'date'`). Quando o período tem `count > 1` e alguma linha tem `source === 'date'`, `ordering.reliable = false` e a UI declara que a ordem foi inferida em vez de afirmar um "2º trade".

**Baseline**: o período nasce com `cumBefore = 0` e orçamento cheio (`stopValue`). Não há carry-over entre dias — `periodStop` é por período, `cycleStop` é outro nível e não entra aqui.

### Casos limites

| Cenário | Comportamento |
|---|---|
| `pl <= 0` ou plano ausente | `buildPeriodState` devolve estado com valores `null`; nenhuma autorização avaliada; card do dia mostra só o líquido |
| `periodStop = 0` | sem `stopValue`; `closedBeyondStop` e `authorization` ficam `null` |
| `riskPerOperation = 0` | `roValue = null`; `SEM_FOLGA` nunca dispara; `APOS_STOP` ainda funciona |
| `roValue > stopValue` | `maxAuthorizedTrades = 0` → issue `PERIOD_STOP_BELOW_RO` no `planMechanicsCheck`; toda operação nasce `SEM_FOLGA` |
| zero trades no dia | `net = 0`, `count = 0`, `rows = []`, `closedBeyondStop = false` |
| trade sem `entryTime` | instante por `date` ao meio-dia; `ordering.reliable = false` se houver mais de um trade |
| dois trades no mesmo instante | desempate por `createdAt`, depois por `id` — determinístico e total |
| `operationPeriod = 'Semanal'` | `getPeriodKey` bucketiza por segunda ISO; a mesma fórmula vale sem alteração |
| múltiplos planos no mesmo dia | `buildPeriodIndex` é por plano; o card do dia recebe o plano do contexto selecionado |

### Exemplo numérico — o incidente de 25/08

`pl = 30.000` · `riskPerOperation = 0,84%` · `periodStop = 1,67%`

```
stopValue           = 30000 × 1,67/100 = R$ 501,00
roValue             = 30000 × 0,84/100 = R$ 252,00
maxAuthorizedTrades = floor(501 / 252)  = 1
```

| # | trade | instante | result | cumBefore | budgetBefore | authorization |
|---|---|---|---|---|---|---|
| 0 | A | 10:51 | −250 | 0 | 501,00 | `AUTORIZADA` (501 ≥ 252) |
| 1 | B | 11:34 | −265 | −250 | 251,00 | `SEM_FOLGA` (0 < 251 < 252) |

```
net              = −515,00      gains = 0      losses = 515,00
closedBeyondStop = −515 <= −501 → true   (ultrapassou por R$ 14,00)
tradesAfterStop  = 0            (nenhum cumBefore <= −501)
```

**Trade A fica limpo.** O dia estourou; nenhuma operação individual violou nada. A margem de R$ 14 vem de o plano autorizar 1,988 operações — defeito do plano, capturado por `planMechanicsCheck`, não do aluno.

### Regressão direta do D2 (soma só perdas)

`+1.000 · −600 · −400` com `stopValue = 501`: hoje o servidor calcula `1.000` (só perdas) e acusa. Com `net = 0`, `closedBeyondStop = false` — **sem violação**.

## Medição (F0 — 25/08/2026, read-only)

**`LOSS_DIARIO_EXCEDIDO`**: 34 trades de 364 (8 alunos); 7 em `DISCUSSED` (imutáveis — só a revogação em leitura resolve); **7 trades cujo único flag vivo é esse** → viram compliant.

Delta de `complianceRate` ao revogar (4 alunos afetados, todos para cima):

| aluno | trades | antes | depois | delta |
|---|---|---|---|---|
| German Hartenstein | 49 | 49,0% | 55,1% | **+6,1pp** |
| Rafael Cerqueira "Sael" | 34 | 44,1% | 50,0% | **+5,9pp** |
| Marcio Portes | 19 | 78,9% | 84,2% | **+5,3pp** |
| Wilson Fu | 36 | 75,0% | 77,8% | **+2,8pp** |

Nenhum cruza `rule-compliance-80` (≥60) para cima nesta passagem — German fica em 55,1%. Reconferir após o recompute real da Fase 2.

**`entryTime`**: 141 com offset, **222 naive**, 1 ausente. Mas o risco de ordenação é muito menor do que o volume sugere: dos **75 dias com mais de um trade, 74 são homogêneos** (todos offset ou todos naive) — o fuso inferido é o mesmo para todas as linhas, então a ordem intradiária **está preservada**. Apenas **1 dia é misturado** (`VXLMNLg7…|2026-08-20`) e **1 dia** tem string-sort ≠ instante-sort (`41Dhjbwv…|2026-08-17`).

Consequência de projeto: `ordering.reliable = false` é rede de segurança, não estado comum. E o fuso deve ser inferido **por trade**, não por dia — 10 dias homogêneos têm exchange/ticker misto entre linhas.

## Phases

- F0 — medição read-only: contar `LOSS_DIARIO_EXCEDIDO` na base (trades/alunos/`DISCUSSED`) e trades com `entryTime` naive
- F1 — `tradeInstant` + `dayState` (ESM + espelho CJS) + `computePeriodState` delega + trocar os sorts por `compareTradesChrono`
- F2 — deletar `getDailyLoss` e o bloco `1252-1266`; revogar `LOSS_DIARIO_EXCEDIDO`; recomputar maturidade e reportar delta de gates
- F3 — `shouldEvaluateRR` exportado + `rrBreakdown` consumindo; `dayMetricTiles` + `DayResultCard`; `BehaviorPanel` em duas seções; deletar o bloco inline do `StudentDashboard`
- F4 — `planMechanicsCheck` + fiação em `PlanManagementModal` / `PlanSummaryCard` / `PlanoMecanicoCard`

## Sessions

- `F0 [medicao] read-only ok` — 34 flags/364 trades, 7 viram compliant; 74/75 dias homogêneos
- `F1a [tradeInstant] commit 3c2bc799 ok` — SSoT de instante + espelho CJS, 40 testes
- `F1b [dayState] commit 7695fceb ok` — motor do período + espelho CJS, 47 testes; validado contra a base real
- `F1c [ordenacao] ok` — 5 sorts ad-hoc trocados por compareTradesChrono; suíte completa verde (4007 testes)
- `F2 [revogacao] ok` — getDailyLoss e o bloco emissor deletados; LOSS_DIARIO_EXCEDIDO em REVOKED nos 2 espelhos
- `F3 [ui] ok` — shouldEvaluateRR exportado + rrBreakdown consumindo; dayMetricTiles + DayResultCard; BehaviorPanel em 2 seções; bloco inline do StudentDashboard deletado; card montado nos 2 layouts da FeedbackPage
- `F4 [coerencia] ok` — planMechanicsCheck + fiação no PlanManagementModal, 18 testes

## Shared Deltas

- `src/version.js` — bump 1.83.32 (já reservada no main, commit `a89ae042`)
- `docs/registry/versions.md` — marcar 1.83.32 consumida
- `docs/registry/chunks.md` — liberar CHUNK-05 / CHUNK-02 / CHUNK-04 / CHUNK-03
- `CHANGELOG.md` — nova entrada `[1.83.32] - 25/08/2026`
- `docs/decisions.md` — DEC-AUTO-402-*
- `docs/PROJECT.md` — bump + histórico

## Decisions

_(IDs — texto em `docs/decisions.md`)_
- DEC-AUTO-402-01 — resultado do período é LÍQUIDO; `Σ|negativos|` sai do produto
- DEC-AUTO-402-02 — `periodStop` governa AUTORIZAÇÃO PARA ABRIR; "fechou além do stop" é fato do período, de nenhuma operação
- DEC-AUTO-402-03 — `SEM_FOLGA` é aviso, não violação (o plano pode ser o incoerente)
- DEC-AUTO-402-04 — `cushionPolicy: 'net'` como default: ganho anterior estende o orçamento de risco do período
- DEC-AUTO-402-05 — `LOSS_DIARIO_EXCEDIDO` revogado em leitura (precedente #376), sem backfill
- DEC-AUTO-402-06 — `shouldEvaluateRR` vira predicado exportado; o painel não julga o que o motor absteve
- DEC-AUTO-402-07 — estado do período é DERIVADO, nunca persistido (sem campo/collection nova, INV-15 não se aplica)
- DEC-AUTO-402-08 — `computePeriodState` NÃO delega para `dayState` (desvio do plano; ver §Desvios)

## Desvios do plano aprovado

**`computePeriodState` não passou a delegar para `dayState`.** O plano previa "um motor, dois idiomas". Contra o código real a troca é ruim: `computePeriodState(trades, goalVal, stopVal)` recebe trades **já ordenados** e limiares prontos, e carrega uma máquina de estados (`POST_GOAL`/`POST_STOP`) que o `dayState` não modela. Delegar deduplicaria ~5 linhas de caminhamento em troca de uma tradução de shape e um acoplamento novo entre módulos com consumidores distintos (extrato, cards de plano, fechamento de ciclo). O bug real daquele arquivo era a **ordenação**, a montante — essa foi corrigida. A unificação fica no follow-up, se algum dia pagar.

## Follow-up (não entra)

- Unificar os ~12 agregadores de dia/período sobre `dayState`
- Unificar as 3 cópias de `complianceRate` (`dashboardMetrics.js:100`, `useDashboardMetrics.js:226`, `preComputeShapes.js:139`)
- **Ambiguidade de vocabulário de R:R**: com `takeProfit` declarado, `compliance` calcula o R:R PLANEJADO (`|alvo − entrada| / risco`) e `rrBreakdown` calcula o REALIZADO em dinheiro (`resultado / risco`). Uma perda com alvo de 2R dá 2,00x num e −1,00x no outro — os dois certos, medindo coisas diferentes, com o mesmo nome na tela. Anterior ao #402; exposto pelos testes de coerência
- Reemitir enforcement de servidor como `TRADE_APOS_STOP_DIARIO` via reconciliação de período inteiro (corte temporal sozinho troca falso positivo por falso negativo quando a escrita chega fora de ordem)
- Código morto confirmado: `PlanProgress.jsx` (sem importador), `usePlans.validateTradeAgainstPlan` (zero chamadores, 3ª semântica de `periodStop`), `cycleMetrics.topErrors` (lê `compliance.violations[]`, que nenhum writer produz), `planLedger.js:62-63`

## Chunks

- CHUNK-05 (escrita) — compliance: red flags, `getDailyLoss`, `violationFilter`
- CHUNK-02 (escrita) — `StudentDashboard`: bloco do dia
- CHUNK-04 (escrita) — `BehaviorPanel`, `rrBreakdown`, `compliance.js`
- CHUNK-03 (escrita) — `planMechanicsCheck`, modais de plano
