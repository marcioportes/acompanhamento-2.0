# Issue #432 — fix: card Financeiro e card de plano leem a janela da ContextBar

## Autorização (OBRIGATÓRIA — sem isto é PROIBIDO iniciar desenvolvimento)

**Status atual do documento:**
- [x] Mockup apresentado — 09/09/2026
- [x] Memória de cálculo apresentada — 09/09/2026
- [x] Marcio autorizou — 09/09/2026: autorizou pela foto do dashboard ("Eu estou como
      mentor, entrei no dashboard do aluno e não mudou nada!"), depois estendeu o escopo
      duas vezes: "arruma o drawdown também" e "arruma o gate também".
- [x] Gate Pré-Código liberado

## Context

A ContextBar (Conta → Plano → Ciclo → Período) define uma janela. O painel **Financeiro** só a obedece pela metade: o tile **Saldo** é `Σ account.currentBalance` — o saldo de agora, cego a ciclo e período — enquanto o tile **P&L** vem de `filteredTrades`, que respeita a janela. Selecionar março mostra o resultado de março ao lado do saldo de hoje, e o **PL inicial** da janela não aparece em lugar nenhum.

`windowOpeningBalance` já é calculado no mesmo hook (`useDashboardMetrics.js:150`) desde o #267 e hoje só alimenta a EquityCurve.

## Spec

Ver issue body no GitHub: #432.

## Mockup

### Painel Financeiro — hoje (moeda única)

```
┌─ FINANCEIRO ───────────────────────────── (i) ┐
│                                               │
│  Saldo                    P&L do ciclo        │
│  R$ 45.740,00             +R$ 3.300,00        │
│                           Expect: +R$ 24,50…  │
│                                               │
│  Drawdown                 Profit factor       │
│  -0,0%                    1,84                │
│  Max: -2,1% (R$ 980,00)   Conformidade: 87%   │
└───────────────────────────────────────────────┘
```

Com o **ciclo de julho** selecionado, `R$ 45.740,00` é o saldo de **hoje** (agosto). O resultado ao lado é o de julho. Os dois números não pertencem ao mesmo período.

### Painel Financeiro — proposto (opção A, mantém o 2x2)

```
┌─ FINANCEIRO ───────────────────────────── (i) ┐
│                                               │
│  Saldo em 31/07           Resultado do ciclo  │
│  R$ 44.500,00             +R$ 3.300,00        │
│  abertura R$ 41.200,00    Expect: +R$ 24,50…  │
│                                               │
│  Drawdown                 Profit factor       │
│  -0,0%                    1,84                │
│  Max: -2,1% (R$ 980,00)   Conformidade: 87%   │
└───────────────────────────────────────────────┘
```

- **Tile 1** — número grande = saldo ao FIM da janela (`abertura + resultado`); legenda embaixo = **PL inicial** da janela. Rótulo carrega a data de fim da janela; quando a janela é o ciclo aberto até hoje, o rótulo é `Saldo` e o número converge com o saldo atual da conta.
- **Tile 2** — inalterado, exceto o rótulo, que passa a dizer `Resultado` em vez de `P&L` (`plContext.label` já produz o sufixo contextual).
- Drawdown e Profit factor **não mudam** neste issue (drawdown → #413).
- Layout permanece 2x2: nenhum tile novo, só uma legenda a mais no tile 1. Evita esticar o painel vizinho (Assimetria de Risco divide `auto-rows-fr` — DEC-387).

### Opção B (descartada, registrada)

Três tiles explícitos (`PL inicial` | `Resultado` | `Saldo`) numa linha própria, virando 2x3. Lê mais direto, mas cresce o painel e arrasta a altura do vizinho pelo `auto-rows-fr`. Fica registrada caso Marcio prefira a leitura explícita ao custo do layout.

### Multi-moeda (`dominantCurrency === null`)

Uma linha por moeda dentro de cada tile, como hoje. O tile 1 passa a mostrar `saldo` grande e `abertura` pequena **por moeda**.

### Card de plano (`PlanCardGrid`)

Sem mudança visual. O bloco `Saldo do Plano (PL)` e as duas barras de progresso passam a refletir o **ciclo selecionado na barra** em vez do ciclo aberto. Quando o ciclo selecionado é `Todos os ciclos`, mantém o comportamento de hoje (ciclo aberto), porque somar todos os trades dupla-conta o que já rolou para `plan.pl` (contrato C2 do #259).

## Memória de Cálculo

### Inputs

| Nome | Origem | Tipo | Default |
|------|--------|------|---------|
| `windowOpeningBalance` | `useDashboardMetrics.js:150` → `computeOpeningBalance({ windowStart, initialBalance, trades, closures })` | number | `aggregatedInitialBalance` quando a janela é "todo o histórico" |
| `aggregatedInitialBalance` | Σ `account.initialBalance` de `accountsInScope` | number | `0` |
| `stats.totalPL` | `calculateStats(filteredTrades).totalPL` (`utils/calculations.js:49`) | number | `0` |
| `plContext.label` | `useDashboardMetrics.js:298` | string | `'P&L Total'` |
| `balancesByCurrency` | `aggregateBalancesByCurrency(accountsInScope)` (`utils/currency.js:127`) | `Map<currency, {initial, current, pnl, count}>` | `Map` vazio |
| `context.periodRange.{start,end,kind}` | ContextBar via `StudentContextProvider` | Date / string | `null` |

Nenhum campo novo. Nenhuma escrita. Nenhuma collection nova (INV-15 / AP-06 não se aplicam).

### Fórmula

```
plInicialDaJanela = windowOpeningBalance
                  = Σ account.initialBalance
                  + Σ trade.result   (trade.date < janela.start)
                  + Σ ajusteNaoTrade (closure.cycleEnd < janela.start, status CLOSED)

resultadoDaJanela = stats.totalPL          // já filtrado por janela + plano + filtros granulares
saldoAoFimDaJanela = plInicialDaJanela + resultadoDaJanela
```

`ajusteNaoTrade(closure) = rollPL(closure) − closure.cycleBaseline.plFinal` (`openingBalance.js:50`) — captura aporte/saque manual do ritual de fechamento (#259 Step6Adjust), que não é trade.

**Por que `saldo` é derivado e não lido de `account.currentBalance`:** `currentBalance` é um escalar sem dimensão temporal. Para qualquer janela que não termine hoje ele é a resposta de outra pergunta. A identidade `abertura + resultado = fechamento` é o que faz os três números do card fecharem entre si.

### Multi-moeda

`computeOpeningBalance` recebe `initialBalance` escalar. Para `dominantCurrency === null`, chamar uma vez **por moeda**, com o `initial` daquele grupo e os trades das contas daquela moeda:

```
para cada [moeda, grupo] de balancesByCurrency:
  abertura(moeda) = computeOpeningBalance({
      windowStart, initialBalance: grupo.initial,
      trades: scopedTradesForCarry filtrados pelas contas da moeda,
      closures: closuresInScope filtrados pelas contas da moeda })
  resultado(moeda) = Σ trade.result dos filteredTrades daquela moeda
```

Sem conversão cambial em nenhum ponto — moedas nunca se somam (#289).

### Casos limites

| Caso | Comportamento |
|------|---------------|
| Janela = "Todos os ciclos" (`periodRange` nulo) | `windowStart = null` → abertura = aporte inicial. Rótulo do tile 1 volta a `Saldo`; converge com `currentBalance`. |
| Janela sem nenhum trade | `resultado = 0`, `saldo = abertura`. Card mostra os dois iguais — correto, não é estado de erro. |
| Conta sem `initialBalance` | `Number(undefined) || 0` → `0`. Já é o contrato de `computeOpeningBalance:92`. |
| Múltiplas contas no escopo | Forward-sum agrega naturalmente (é soma). |
| Fechamento sem `cycleBaseline.plFinal` | `closureAdjustmentDelta` devolve 0 → termo some, fórmula degrada para "aporte + Σ trades". |
| Filtro granular ativo (ticker/setup/emoção) | `resultado` encolhe mas `abertura` NÃO — abertura é patrimonial, não é recorte de amostra. `saldo` derivado deixa de ser patrimônio real. **Decidir:** ocultar o tile 1 ou marcar como recorte quando `filters` ≠ all. |
| Ciclo selecionado ≠ ciclo aberto no `PlanCardGrid` | `plan.pl` é o PL do ciclo ABERTO (imutável, contrato C1). Para ciclo passado a abertura vem de `closure.cycleBaseline.plInicial`, não de `plan.pl`. |

### Exemplo numérico

Conta com aporte **R$ 40.000,00**, plano mensal, dois ciclos.

**Ciclo de julho** (`windowStart = 2026-07-01`):
- trades antes de 01/07: **+R$ 1.200,00**
- nenhum fechamento anterior → ajustes = 0
- `abertura = 40.000 + 1.200 + 0 = 41.200,00`
- resultado de julho = **+R$ 3.300,00**
- `saldo em 31/07 = 41.200 + 3.300 = 44.500,00`

Fechamento de julho com **saque manual de R$ 2.000,00** → `rollPL = 42.500`, `plFinal = 44.500`, `ajuste = −2.000`.

**Ciclo de agosto** (`windowStart = 2026-08-01`):
- trades antes de 01/08: `1.200 + 3.300 = 4.500`
- ajustes: `−2.000`
- `abertura = 40.000 + 4.500 − 2.000 = 42.500,00`
- resultado de agosto = **+R$ 3.240,00**
- `saldo em 31/08 = 45.740,00` — igual ao `currentBalance` da conta, porque agosto é o ciclo aberto.

**O bug, no mesmo exemplo:** com julho selecionado, o card hoje mostra `Saldo R$ 45.740,00` (agosto) ao lado de `P&L +R$ 3.300,00` (julho). Depois do fix mostra `Saldo em 31/07 R$ 44.500,00 · abertura R$ 41.200,00` ao lado de `Resultado +R$ 3.300,00` — e `41.200 + 3.300 = 44.500` fecha.

## Phases

- A1 — testes de `windowOpeningBalance` por moeda + identidade `abertura + resultado = saldo` (INV-05, testes antes da UI)
- A2 — `useDashboardMetrics` expõe `openingByCurrency` e `windowEndBalance`
- A3 — `MetricsCards` painel Financeiro consome a janela (opção A do mockup)
- B1 — `PlanCardGrid` respeita `cycleKey` da ContextBar
- B2 — verificação em app real (AP-08: build verde não basta)
- C1 — `src/utils/drawdown.js` + 15 testes (ordenação por instante, peak-to-trough, janela)
- C2 — hook e `MetricsCards` consomem a SSoT; `fmtDrawdownPct` mata o `-0.0%`
- C3 — `calcMaxDrawdown` do backend ordena por instante + teste de paridade front/back

## Sessions

_(vazio — aguardando autorização)_

## Shared Deltas

- `src/version.js` — bump v1.90.3 _(já reservado no main, commit `51ede5e9`)_
- `docs/registry/versions.md` — marcar 1.90.3 consumida no encerramento
- `docs/registry/chunks.md` — liberar CHUNK-02 / CHUNK-03 no encerramento
- `CHANGELOG.md` — entrada v1.90.3 no encerramento

## Decisions

_(vazio — DEC-432-NN a registrar conforme surgirem)_

## Chunks

- CHUNK-02 (escrita) — `StudentDashboard`, `MetricsCards`, `useDashboardMetrics`
- CHUNK-03 (escrita) — `PlanCardGrid`
- CHUNK-13 (leitura) — `ContextBar`, `useStudentContext`
