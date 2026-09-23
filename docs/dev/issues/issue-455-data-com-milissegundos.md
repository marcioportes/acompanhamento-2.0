# Issue 455 — fix: import de ordens grava o trade invertido e datado de 1970

> **Branch:** `fix/issue-455-data-com-milissegundos`
> **Aberto em:** 23/09/2026
> **Status:** 🔵 Em andamento
> **Versão reservada:** 1.92.4

## Autorização

- [x] Mockup — **não se aplica** (fix de parser/pipeline, sem UI nova)
- [x] Memória de cálculo — abaixo (regra condicional do `stopLoss`)
- [x] Marcio autorizou — 23/09/2026: *"resolve o problema da data, o stop deve ser informado mesmo, se não tem jeito."*
- [x] Gate Pré-Código liberado

## Context

O ProfitChart-Pro passou a exportar timestamps com milissegundos entre 16 e 22/09/2026
(`09_ordens.csv` sem, `ordens_18-22.csv` e `2309o.csv` com). `parseDateTime` não aceita
`.mmm`, devolve `null`, e sem instante a reconstrução cai na ordem das linhas do arquivo —
que o ProfitChart escreve em ordem decrescente de criação. Resultado: trade **invertido**
(SHORT em vez de LONG) e datado de **01/01/1970**.

Caso real WINV26 23/09/2026: LONG 5 @ 189.370 → 189.870 virou SHORT 189.870 → 189.370.

## Spec

Ver issue body no GitHub: #455.

## Memória de Cálculo — quando `trade.stopLoss` é preenchido

**Inputs:** `operation.stopOrders[]` (de `orderReconstruction`), campos `stopPrice`,
`limitPrice`, `price`, `stopSemantic` (de `stopSemantic.js`), `operation.hasStopProtection`.

**Regra hoje** (`orderTradeCreation.js:197`): `hasStopProtection && stopOrders.length > 0`
→ grava `lastStop.stopPrice ?? limitPrice ?? price`. Não consulta `stopSemantic`.

**Regra nova:** a perna precisa ser proteção **real**. Perna classificada `STOP_GAIN`
(LONG com `stopPrice ≥` entrada, ou SHORT com `stopPrice ≤` entrada) não vira `stopLoss`.
Sem perna `STOP_LOSS`, `stopLoss` fica `null` — **o aluno informa** (decisão de Marcio,
23/09/2026). O sistema não inventa e não usa um stop de ganho como se fosse risco.

**Exemplo numérico (caso real):** LONG 189.370, perna SELL `STOP_LIMIT` gatilho 189.390.
189.390 ≥ 189.370 → `STOP_GAIN` → `stopLoss: null`.
Hoje grava 189.390 → `Math.abs(189370 − 189390)` = 20 pts → risco R$ 20 e **RR 25,0**,
contra risco mínimo comprovável de 220 pts (R$ 220) e RR ≤ 2,27.

**Caso limite:** operação com perna `STOP_LOSS` *e* perna `STOP_GAIN` (bracket com trailing
registrado em duas ordens) → usa a `STOP_LOSS`, ignora a `STOP_GAIN`.

**Por que o stop inicial não é recuperável:** o gatilho 189.390 não vigorou durante a
operação — dispararia na queda (estava acima do preço na criação) e dispararia na alta
(o preço foi a 189.880). É estado final de alteração in-place, e o export traz só o evento
terminal. Cruzando com a MEN de −220 dá para cravar o **teto** (< 189.150), não o valor.

## Phases

- A1 — `parseDateTime` aceita milissegundos (trunca ao segundo)
- A2 — parser reporta erro quando timestamp existe e não parseia
- A3 — validação: ordem FILLED sem instante vira **erro**, não warning
- A4 — `reconstructOperations` descarta fill sem instante em vez de assumir `_ts: 0`
- B1 — `orderTradeCreation` respeita `stopSemantic`: `STOP_GAIN` não vira `stopLoss`
- C1 — testes com massa real (`set-2309-milissegundos.csv`)

## Sessions

- `task 01 [abertura] commit d9d2fc53 ok`
- `task 02 [A1-A4 data + B1 stop] ok — 4.896 testes raiz + 309 functions, TZ=UTC, build ok`

## Shared Deltas

- `src/version.js` — bump v1.92.4 (já commitado no main na abertura)
- `docs/registry/versions.md` — marcar 1.92.4 consumida
- `docs/registry/chunks.md` — liberar CHUNK-10
- `CHANGELOG.md` — nova entrada `[1.92.4] - 23/09/2026`
- `docs/PROJECT.md` — encerramento
- `docs/decisions.md` — DEC-455-01, DEC-455-02

## Decisions

- DEC-455-01 — ISO truncado ao segundo (milissegundos descartados)
- DEC-455-02 — `STOP_GAIN` não vira `stopLoss`; sem proteção real o aluno informa

## Chunks

- CHUNK-10 Order Import (escrita) — `orderParsers`, `csvMapper`, `orderValidation`, `orderReconstruction`, `orderTradeCreation`
- CHUNK-04 Trade Ledger (leitura)
- CHUNK-05 Compliance (leitura)
