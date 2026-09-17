# Issue #449 — fix: trade protegido é acusado de não ter stop — a proteção que executa não vira stopLoss

> **Branch:** `fix/issue-449-protecao-executada-sem-stoploss`
> **Aberto em:** 16/09/2026
> **Status:** 🟢 Autorizado
> **Versão reservada:** 1.92.2

## Autorização

- [x] Mockup — **não se aplica:** correção de regra, sem UI nova. A tela não muda de layout; muda o que ela afirma.
- [x] Memória de cálculo apresentada (16/09/2026), com o trade real rodado de ponta a ponta
- [x] Marcio autorizou (16/09/2026): *"não há necesside de medir nada, precisa resolver essa lambança"*
- [x] Gate Pré-Código liberado

## Context

A tela do trade afirma duas coisas opostas: **"Protegido o tempo todo"** no painel de ordens e **"Trade sem stop loss definido — risco não mensurado (win sem stop)"** na seção de comportamento.

As duas leituras estão corretas pelo próprio critério. O painel usa `protectiveLegsOf`, que enxerga a perna adversa pelo **preço enviado**. O compliance lê o campo `stopLoss` do trade, que está `null`.

O campo ficou nulo porque a proteção **foi executada** — ela mesma fechou a posição — e a função que alimenta `stopOrders` só percorre ordens **não executadas**. O trade é punido justamente por ter tido a proteção acionada.

## Spec

Ver issue body no GitHub: #449.

## Mockup

Não se aplica. Efeito visível: a violação `TRADE_SEM_STOP` desaparece do trade protegido, e o RR passa a ser calculado sobre o risco real em vez do risco assumido do plano.

## Memória de Cálculo

### Inputs

| dado | caminho | uso |
|---|---|---|
| lado da operação | `operation.side` (LONG/SHORT) | define o lado da perna protetiva |
| entrada média | `operation.avgEntryPrice` | referência para "adverso" |
| pernas executadas | `operation.exitOrders[]` | onde mora a proteção acionada |
| preço enviado | `order.stopPrice ?? order.limitPrice ?? order.price` | **classifica** a perna e vira o `stopLoss` |
| preço executado | `order.filledPrice` | mede o resultado; **não** vira `stopLoss` |
| instante de envio | `order.submittedAt` | proteção nasce com a posição (#369) |

Nada novo é lido e nada novo é gravado: `stopLoss` já existe no trade.

### Fórmula

Mantém-se o classificador atual (`protecaoDoBracket`), aplicado agora também às pernas executadas da operação:

```
ehProtecao(ordem, op) =
      ordem.side == (op.side == LONG ? SELL : BUY)
  ∧   nasceuComAPosicao(ordem, op)                  // submittedAt >= entryTime − 60s
  ∧   precoEnviado(ordem) adverso à entrada         // LONG: < avgEntry | SHORT: > avgEntry

stopLoss(op) = precoEnviado(última perna protetiva)  // stopPrice ?? limitPrice ?? price
```

A perna protetiva executada **continua** em `exitOrders` — ela é as duas coisas ao mesmo tempo, e as duas leituras precisam seguir verdadeiras. Ela passa a aparecer **também** em `stopOrders`, com `hasStopProtection = true` e `stopExecuted = true`.

### Casos limites

- **Proteção cancelada** (comportamento atual): segue entrando pelo laço de não executadas. Nada muda.
- **Saída no alvo** (preço favorável): não é proteção, não vira `stopLoss`. O alvo cancelado continua em `cancelledOrders`.
- **Saída manual sem bracket:** não há perna adversa; `stopLoss` segue nulo e a regra do stop implícito do compliance continua valendo (loss → sem violação; win → violação legítima).
- **Proteção parcial** (perna menor que a posição): classifica igual; o risco medido é o da perna.
- **Ordem enviada antes da entrada existir:** não é bracket (#369), não classifica.
- **Entradas e saídas comuns não podem cair em `cancelledOrders`** — por isso a segunda passada é separada do laço atual, e só acrescenta a `stopOrders`.

### Exemplo numérico — trade `X71EpvSJpLJoyEacXB4B` (09/09/2026, WINV26)

SHORT 5, entrada 188.380, saída 188.355, +25 pts, +R$ 25. Bracket com três pernas:

| ordem | preço enviado | classificação | desfecho |
|---|---|---|---|
| SELL 5 | 188.380 | entrada | executada 11:22 |
| BUY 5 | **188.505** | proteção (adversa: acima da entrada do short) | **executada** 11:36 a 188.355 |
| BUY 5 | 187.880 | alvo (favorável) | cancelada |

| | hoje | com a regra |
|---|---|---|
| `stopOrders` da operação | vazio | 1 perna (a executada) |
| `hasStopProtection` | false | true |
| `stopExecuted` | false | true |
| `trade.stopLoss` | `null` | **188.505** |
| red flag `TRADE_SEM_STOP` | emitida | não emitida |
| risco do trade | assumido: R$ 252 (teto do plano) | real: 125 pts = **R$ 125** |
| RR exibido | 0,10x | 0,20x (segue abaixo do mínimo 2,00x, pelo motivo certo) |

## Phases

- **A1** — segunda passada em `associateNonFilledOrders` (ou helper próprio) classificando pernas executadas; `stopLoss` passa a usar o preço enviado em `mapOperationToTradeData`. Testes sintéticos.
- **A2** — teste com massa real: a fixture `set-0911-inversao.csv` já contém as três ordens desse trade (09/09, 11:17→11:36).
- **A3** — regressão: `associateNonFilledOrders` (stops e canceladas), `orderTradeCreation`, detectores que leem `stopOrders`; suíte completa.

## Sessions

- 16/09 — A1+A2: `ehProtecaoAdversa` (definição única), segunda passada sobre pernas executadas, `stopLoss` pelo preço enviado, 11 testes com a massa real de 09/09.
- 17/09 — A3: CI reprovou o que passava aqui. Correção de fuso no laço de associação + 1 teste que trava o comportamento em qualquer máquina.

## Achado durante a entrega — o instante da ordem era lido no fuso do processo

A CI reprovou 7 testes que passavam na minha máquina. Não era teste frouxo: `TZ=UTC` reproduz local, e uma das falhas mostrava a perna de **outro trade** do dia sendo escolhida como proteção (`expected 187485 to be 188505`).

**Causa:** `associateNonFilledOrders` casava `new Date(order.submittedAt)` — instante **ingênuo**, lido no fuso do processo — com `op.entryTime`, que carrega offset desde o #292. Em BRT casa; em UTC dá três horas de defasagem, e a ordem cai na operação errada ou fica fora da janela de tolerância.

É o mesmo defeito que o #375 já tinha corrigido do lado dos detectores (`orderMs` + `tradeOffsetOf` em `executionBehaviorEngine`), e que continuava vivo no lado do import.

**Correção:** `offsetDasOperacoes(operations)` lê o fuso do lote e `instanteDaOrdem(valor, offset)` resolve o instante da ordem nesse fuso. Aplicado nos dois pontos: o `orderTs` que escolhe a operação e a checagem "nasceu com a posição".

**Por que estava latente:** o import roda no navegador do aluno, em America/Sao_Paulo, onde os dois lados casam por coincidência. A CI roda em UTC — e Cloud Function também.

O teste `lote em outro fuso (#375)` usa America/New_York justamente para reprovar em qualquer máquina, e não só onde o fuso do processo difere.

## Shared Deltas

- `src/version.js`: 1.92.2 (já reservada no main)
- `docs/registry/versions.md`: marcar 1.92.2 consumida
- `docs/registry/chunks.md`: liberar CHUNK-10
- `CHANGELOG.md`: entrada `[1.92.2]`
- `docs/PROJECT.md`: bump + parágrafo de encerramento **e linha na tabela de histórico**

## Decisions

## Chunks

- CHUNK-10 (escrita) — `orderReconstruction`, `orderTradeCreation`
- CHUNK-05 (leitura) — regra de red flag do compliance (não muda)
- CHUNK-04 (leitura) — criação do trade
