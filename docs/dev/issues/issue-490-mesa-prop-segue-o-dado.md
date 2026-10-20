# Issue #490 — fix: aba Mesa Prop contradiz o dado

## Autorização

- [x] Mockup apresentado (20/10/2026)
- [x] Memória de cálculo apresentada (20/10/2026)
- [x] Marcio autorizou (20/10/2026 — "sim")
- [x] Gate Pré-Código liberado

## Context

A aba Mesa Prop lê `accounts/{id}/drawdownHistory`, que é append-only. Snapshot de trade apagado continua lá, e o saldo de cada snapshot carrega o efeito de trades que já não existem. Tudo da Zona 2 (curva, KPIs) e parte da Zona 1 (dias operados) sai desse histórico cru. O melhor dia da Zona 1 vem de `propFirm.bestDayProfit`, que nenhuma CF grava. A calculadora do plano inventa prazo e daily loss quando a mesa não tem e apresenta como regra.

Caso real: Lucid Flex 25K (`wTn7ifowLFDytprlqpxA`), 5 snapshots, 3 trades vivos.

## Spec

Issue #490 no GitHub. Decisões do Marcio (20/10): filtrar na leitura; regra que a mesa não tem aparece como sugestão nossa.

## Achados da leitura (mudam o escopo)

- **Item 10 (P&L dia):** já removido no #145 (`PropAccountCard.jsx`, comentário "P&L dia removido"). Nada a fazer. `dailyPnL` segue só no alerta de daily loss atingido, que depende de `isDayPaused` — correto.
- **Item 11 (timeout do plano IA):** `PropAiApproachPlanSection` não é importado por nenhuma tela (o plano IA migrou para o #148). Componente órfão, bug sem caminho de usuário. Fora do escopo.

## Mockup

Zona 1 (PropAccountCard):
```
Drawdown utilizado                                    0,0%
Margem: US$ 1.053,50 — acima do pico; o limite sobe no fechamento do dia
...
Prazo da avaliação        Dias operados
Sem prazo                 1 de 8 mínimos
Consistency: OK — melhor dia US$ 53,50 / limite US$ 625,00 (50%)
```

Zona 2:
```
Equity curve                                         +US$ 53,50
 eixo X = data (DD/MM), um ponto por trade vivo, começa no saldo inicial
 eixo Y com rótulo inteiro ("US$ 25,1 mil")
 rodapé: 3 trades · 20/10/2026 → 20/10/2026

KPIs retrospectivos
DIAS OPERADOS  1 / 8 mín.   MELHOR DIA US$ 53,50   PIOR DIA US$ 53,50 (verde se ≥ 0)   CONSISTENCY 9% do teto
```

Zona 3 (Plano mecânico, Lucid sem instrumento):
```
Instrumento                  —
Stop                         —   (selecione um instrumento)
Target                       —
Daily target (ritmo sugerido) US$ 60,00
⚠ Plano consome 120% do limite diário sugerido (a mesa não tem daily loss), com 21 dias úteis de ritmo sugerido (a mesa não tem prazo)
```

## Memória de Cálculo

**Histórico vivo** — `liveDrawdownHistory(history, trades, accountSize)`, pura, um SSoT para os quatro consumidores (card, curva, KPIs, payout):
- Entrada: snapshots (`drawdownHistory`, ordem de `createdAt`) e trades vivos do aluno (`useTrades`), filtrados por `accountId`.
- Snapshot entra só se `snapshot.tradeId` ∈ trades vivos. Edições (`{tradeId}-edit-{ts}`) carregam o mesmo `tradeId` → **um ponto por trade** (deduplica).
- Ordem: `trade.entryTime` (ou `date`), desempate pela ordem do snapshot.
- `balance` = `accountSize` + soma acumulada de `trade.result` (valor atual do trade, não o do snapshot).
- `dailyPnL` = soma acumulada do dia.
- Dias: `{date, pnl}` com o pnl final do dia. `bestDay` = max, `worstDay` = min, `tradingDays` = nº de datas.

Exemplo Lucid: snapshots de 02/10 (`gTo0…`, `3uOF…`) caem; 20/10 = −16,25 / +11,25 / +58,50 → saldos 24.983,75 / 24.995,00 / 25.053,50; dia 20/10 = +53,50; tradingDays 1; melhor = pior = 53,50; consistency 53,50 / 625 = 9%.

Casos limite: sem trades → histórico vazio (curva mostra o estado vazio atual). Snapshot sem `tradeId` (legado) → descartado. Trade vivo sem snapshot → não entra (o motor da conta não o processou; mantém paridade com o saldo da conta).

**Drawdown utilizado** = `max(0, drawdownMax − (saldo − limite)) / drawdownMax`. Margem acima de `drawdownMax` exibe a nota "acima do pico".

**Sugestão vs regra** — `buildMesaConstraints` e `calculateAttackPlan` passam a devolver `dailyLossSuggested = (template.dailyLossLimit ausente)` e `evalDeadlineSuggested = (template.evalTimeLimit ausente)`. Valores não mudam (25% do DD; 30 dias → 21 úteis). Muda só o texto do badge e o rótulo da linha.

## Phases

- A — `liveDrawdownHistory` + testes; PropFirmPage passa o histórico vivo a todos os consumidores; card usa melhor dia derivado (itens 1–3)
- B — flags de sugestão nas duas calculadoras + texto do badge e do card (itens 4–5)
- C — exibição: gauge DD, prazo/dias mínimos, plano sem instrumento, cor do pior dia, eixos da curva (itens 6–9)

## Sessions
- `A+B+C [mesa-prop-segue-o-dado] commit 2fea7df1 ok` — suíte 5516 passed (TZ=UTC); lint sem regressão (5 erros pré-existentes no main: hooks condicionais do PropAccountCard e aspas da PropFirmPage)

## Shared Deltas

- `src/version.js` — aplicar v1.92.20
- `docs/registry/versions.md` — v1.92.20 consumida
- `docs/registry/chunks.md` — liberar CHUNK-17
- `CHANGELOG.md` — entrada `[1.92.20] - DD/10/2026`

## Decisions

## Chunks

- CHUNK-17 (escrita) — Prop Firm Engine (aba Mesa Prop, calculadoras do plano)
