# Issue #351 — fix: correlação de ordens perde fill no meio da operação

## Autorização (OBRIGATÓRIA — sem isto é PROIBIDO iniciar desenvolvimento)

**Status atual do documento:**
- [x] Mockup apresentado — cenário de lógica em linguagem natural (INV-18, ramo "lógica"); nenhuma superfície de UI muda
- [x] Memória de cálculo apresentada — score de containment (seção própria abaixo)
- [x] Marcio autorizou — 18/08/2026: "cria o issue com fix + testes + backfill" → "ataca o #351"
- [x] Gate Pré-Código liberado (A e B)
- [ ] **Gate humano pendente — C (backfill):** apply só após Marcio ver o resultado do dry-run

## Context

Ordem executada no meio de uma operação (aumento de posição ou parcial de saída) é ingerida em
`orders` com `correlatedTradeId: null` e fica invisível no painel de ordens do trade e no sensor
comportamental de execução. A causa é `correlateOrders` medir **distância às pontas** do trade
(±5 min de `entryTime` ou `exitTime`) em vez de **pertencimento ao intervalo**.

Reproduzido sobre importação real de 18/08/2026 (WINV26, operação de +R$ 521,00): a compra de 3
contratos executada às 14:46:17 fica a 47min46s da abertura e 28min31s do fechamento — fora da
janela nas duas pontas. É a única ghost do arquivo (9 de 10 fills casam).

Os números do trade (`_partials`, `qty`, `entry`, `result`) estão corretos: vêm da operação
reconstruída, não das correlações. O que se perde é rastreabilidade da ordem e leitura
comportamental — justamente do comportamento (piramidar) que mais interessa observar.

## Spec

Ver issue body no GitHub: #351. _(Link, não duplicar.)_

## Mockup

Fix de lógica — nenhuma tela nova, nenhum campo novo, nenhuma mudança de layout. O que muda é o
que **passa a** aparecer em telas já existentes: a ordem do aumento de posição volta a listar no
painel de ordens do trade e a alimentar `ExecutionPatternsPanel` / sensor comportamental.

Cenário de referência (o caso do 18/08, WINV26 LONG, trade 13:58:31 → 15:14:48):

| Ordem | Executada | Hoje | Depois |
|---|---|---|---|
| C 5 @ 169.760 | 13:58:31 | `entry` (ponta) | `entry` (ponta) — inalterado |
| **C 3 @ 169.945** | **14:46:17** | **ghost** | **`entry` (dentro da operação)** |
| V 5 @ 170.155 | 15:14:48 | `exit` (ponta) | `exit` (ponta) — inalterado |
| V 3 @ 170.155 | 15:14:48 | `exit` (ponta) | `exit` (ponta) — inalterado |

`stats.orphanFills` do batch cai de 1 para 0.

## Memória de Cálculo

Único número arbitrado no fix é o score de containment. Declarado aqui porque ele define quem
ganha quando duas regras de correlação disputam a mesma ordem.

**Inputs**
- `order.filledAt ?? order.submittedAt` → `orderTs` (via `toWallMs`, hora-de-parede, `orderCorrelation.js:57`)
- `trade.entryTime ?? trade.openedAt` → `tradeEntryTs` (mesma conversão)
- `trade.exitTime ?? trade.closedAt` → `tradeExitTs` (mesma conversão)
- `order.side` ∈ {BUY, SELL}; `trade.side` ∈ {LONG, SHORT}
- `CORRELATION_WINDOW_MS` = 300.000 ms (5 min) — inalterado por este issue

**Fórmula vigente (match de ponta, `:368-371`)** — mantida sem alteração:
```
delta      = |orderTs − tradePontaTs|            (ponta ∈ {entry, exit})
timeScore  = 1 − delta / window                  aplicável só se delta < window
sScore     = sideOk ? 1.0 : 0.3
score      = timeScore × 0.6 + sScore × 0.4
```
Piso do score de ponta com `sideOk = true`: `delta → window⁻` ⇒ `timeScore → 0⁺` ⇒
**`score → 0.4⁺`**. Com `sideOk = false`: `score → 0.12⁺`.

**Fórmula nova (containment)** — constante, sem componente temporal:
```
aplicável se: tradeEntryTs ∧ tradeExitTs ∧ tradeEntryTs < orderTs < tradeExitTs
role  = isSideCompatibleForRole(order.side, trade.side, 'entry') ? 'entry' : 'exit'
score = 0.55
```

**Escolha do 0.55 — corrigindo o valor anunciado no issue body.** O corpo do #351 justifica 0.55
como "abaixo do piso das pontas (0.6)". O piso real é **0.4**, não 0.6 — a conta que produz 0.6
esquece que `timeScore` tende a zero na borda da janela. Mantenho **0.55** assim mesmo, e a
justificativa correta é outra: containment perde para qualquer ponta com `sideOk = true` e
`delta < 0.25 × window` (75 s), e ganha de pontas mais distantes que isso. Isso é o comportamento
desejado — um fill a 4 min de uma ponta e simultaneamente dentro do intervalo do trade é melhor
descrito como "dentro da operação" do que como "quase na ponta". O valor só arbitra desempate;
não altera nenhum match que hoje já ocorre com ponta próxima.

Faixas resultantes:
```
ponta sideOk, delta < 75s      → score > 0.55   → ponta vence
ponta sideOk, delta ≥ 75s      → score ≤ 0.55   → containment vence
ponta side incompatível        → score < 0.4    → containment vence
sem containment aplicável      → comportamento idêntico ao atual
```

**Casos limites**
- `exitTime` ausente (trade aberto) → containment não se aplica; só pontas, como hoje.
- `orderTs` exatamente igual a `entryTs` ou `exitTs` → containment **não** se aplica (comparação
  estrita); a ponta já casa com `delta = 0`, score 1.0.
- Trade sem componente de hora → `window` vira `CORRELATION_WINDOW_DAY_MS` e a ponta cobre o dia
  inteiro; containment é redundante mas inofensivo (score menor).
- Trades sobrepostos do mesmo instrumento → risco de o fill do meio apontar para trade diferente
  do das pontas, promovendo a operação a `ambiguous` em `categorizeConfirmedOps`. Coberto por
  teste (fase T, caso 5). Ambiguidade é resolvida pelo aluno na UI — não é escrita silenciosa.

**Exemplo numérico (caso do 18/08)**
```
trade T3: entryTs = 13:58:31, exitTs = 15:14:48, side LONG
ordem   : orderTs = 14:46:17, side BUY

ponta entry: delta = 2.866 s ≥ 300 s  → não aplicável
ponta exit : delta = 1.711 s ≥ 300 s  → não aplicável
containment: 13:58:31 < 14:46:17 < 15:14:48 ✓
             isSideCompatibleForRole(BUY, LONG, 'entry') = true → role 'entry'
             score = 0.55, confidence = 0.55
resultado  : tradeId = T3, role = 'entry'   (hoje: ghost)
```

## Phases

- A — branch de containment em `correlateOrders` (`src/utils/orderCorrelation.js`) + `details`
  próprio para o caso ("dentro da operação"), distinto do `delta: 0s` das pontas
- T — testes em `src/__tests__/utils/orderCorrelation.test.js` (5 casos do issue body) +
  integração em `src/__tests__/utils/orderImportIntegration.test.js`
- C1 — `scripts/issue-351-backfill-dryrun.mjs` — conta órfãos, quantos passam a correlacionar,
  distribuição por aluno/plano. **Não escreve.** ✅ rodado 18/08/2026
- C2 — `scripts/issue-351-backfill-apply.mjs` — escrito e validado em modo seguro (sem `--yes`
  não escreve). **Bloqueado no gate humano** — aguarda decisão sobre o achado do dry-run
- D — `functions/orders/linkOrdersToCreatedTrade.js` + wire em `onTradeCreated`: liga as ordens do
  batch ao trade que o próprio import cria (escopo adicionado 18/08/2026 a partir do achado de C1;
  server-side porque `firestore.rules:321` proíbe update de `/orders` pelo cliente)

## Sessions

- `task 01 [A+T] commit 51276ce8 ok — branch de containment + 6 testes unitários (4 falham sem o fix) + 3 de integração com recorte do CSV real; 3597 verdes, lint sem erro novo`
- `task 02 [C1] dry-run rodado em produção (READ-ONLY) — ver achado abaixo`
- `task 03 [D] commit 3f5290f1 ok — CF linkOrdersToCreatedTrade + wire em onTradeCreated; 9 testes novos, 212 verdes em functions`

### Achado do dry-run (18/08/2026) — o backfill é maior que o #351

Resultado sobre 782 docs de `orders` em produção:

| Métrica | Valor |
|---|---|
| Fills órfãos (`correlatedTradeId: null`) | 473 |
| Passariam a correlacionar | **198** |
| · por contenção no intervalo (regra nova do #351) | **4** |
| · por proximidade de ponta (regra que **já existia**) | **194** |
| Seguem órfãos | 275 (273 deles em plano sem nenhum trade) |

**194 dos 198 casam com `delta: 0s` — pela regra de ponta que já existia antes deste
issue.** Se a regra antiga os resolve, eles nunca foram um problema de janela: estavam
órfãos porque **o trade não existia no instante em que a correlação rodou**.

Causa: em `OrderImportPage.handleStagingConfirm` a correlação (passo 1) e o `ingestBatch`
(passo 3) rodam contra os trades que existem naquele momento. Operações classificadas como
`new` só viram trade depois, em `createTradesBatch` (`handleConversationalConfirm`), e
**nada volta para ligar as ordens ao trade recém-criado**. Ou seja: todo trade criado pelo
próprio Order Import nasce com 100% das suas ordens órfãs.

Isso é bug distinto do #351 e **não está no escopo deste issue** — o fix aqui é a regra de
correlação; o backfill corrige o passivo dos dois casos porque é a mesma mecânica. O fix
forward (ligar as ordens ao trade criado pelo import) precisa de issue próprio, senão os
órfãos voltam a ser gerados a cada importação.

## Shared Deltas

- `src/version.js` — bump v1.83.5
- `docs/registry/versions.md` — marcar v1.83.5 consumida
- `docs/registry/chunks.md` — liberar CHUNK-10
- `CHANGELOG.md` — nova entrada `[1.83.5] - DD/08/2026`
- `docs/PROJECT.md` — bump + parágrafo de encerramento
- `docs/cloud-functions.md` — registrar `linkOrdersToCreatedTrade` como etapa 7 de `onTradeCreated`
- **Deploy de CF obrigatório pós-merge** (`firebase deploy --only functions:onTradeCreated`)

## Decisions

_(IDs conforme forem tomadas — texto em `docs/decisions.md`)_

## Chunks

| Chunk | Modo | Motivo |
|-------|------|--------|
| CHUNK-10 | escrita | `orderCorrelation.js` + backfill na collection `orders` |
| CHUNK-11 | leitura | consome `correlatedTradeId`; comportamento muda por consequência, código não é tocado |
