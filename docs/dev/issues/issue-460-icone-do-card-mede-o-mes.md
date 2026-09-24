# Issue #460 — fix: o ícone do card do plano mede o dia, não o mês

## Autorização
- [x] Mockup: não se aplica. Não há tela nova; o card troca a fonte do ícone e o texto da etiqueta.
- [x] Memória de cálculo: abaixo; trivial, com o caso real no issue.
- [x] Marcio autorizou em 24/09/2026: *"sim, fast track"*.
- [x] Gate Pré-Código liberado

## Context
O card mostra o mês (saldo, barra do ciclo), mas o ícone vinha do estado do dia. No caso real, a meta do ciclo foi batida (+R$ 3.505 contra meta de R$ 3.043), a meta diária nunca foi, e o card não mostrava. A etiqueta do canto rotulava o último dia operado como se fosse hoje.

## Spec
Ver #460.

## Memória de Cálculo
- Ícone: `getCycleSentiment(cyclePnL, cycleGoalVal, cycleStopVal)`, com os mesmos valores da barra do ciclo. Regra: `≥ meta → Trophy`; `≤ −stop → Skull`; senão pelo sinal (Smile/Frown/Meh). Meta ou stop zerado não dispara troféu nem caveira.
- Etiqueta: `classifyPeriodBadge` do período só se `currentPeriodIsLive`, com prefixo `Hoje:` (Diário) ou `Semana:` (Semanal). `IN_PROGRESS` segue oculto.
- `currentPeriodIsLive`: Diário → existe período com a data de hoje; Semanal → existe semana que contém hoje.

## Phases
- A1 — `getCycleSentiment` + `currentPeriodIsLive` na state machine
- A2 — card usa os dois
- A3 — testes (state machine + render do card)

## Sessions
- `task 01 [icone-ciclo] interativa`

## Shared Deltas
- `src/version.js` — v1.92.6
- `CHANGELOG.md` — entrada v1.92.6
- `docs/registry/chunks.md` / `versions.md` — liberar CHUNK-02 e CHUNK-03; consumir 1.92.6

## Decisions
- DEC-460-01 — o ícone usa o acumulado atual do ciclo, o mesmo da barra, e não o estado "meta já foi batida" da state machine, que é pegajoso. Assim ícone e barra nunca discordam.

## Chunks
CHUNK-02 (escrita), CHUNK-03 (escrita)
