# Issue #375 — fix: proteção cancelada pelo OCO lida como "sem stop"

## Autorização (OBRIGATÓRIA — sem isto é PROIBIDO iniciar desenvolvimento)

**Status atual do documento:**
- [x] Mockup apresentado
- [x] Memória de cálculo apresentada
- [ ] Marcio autorizou (data + frase)
- [ ] Gate Pré-Código liberado

## Context

Trade WINV26 LONG 10 de 21/08/2026 (entradas 174.050 e 174.010 às 11:25, saída 174.290 às 11:27, +R$ 520) tinha proteção: duas pernas SELL 173.755 de 5 contratos, canceladas às 11:27:51 pelo OCO quando a saída no alvo executou. O painel exibiu "Sem stop", o motor emitiu `UNPROTECTED_SIZE` HIGH (que trava progressão de estágio) e o confronto emocional imprimiu a palavra `null` na tela.

Três leituras diferentes das mesmas duas ordens, nenhuma correta. O objetivo é uma definição única de proteção — a que o #242/#359/#371 já fixaram — aplicada em todos os pontos que a leem.

## Spec

Ver issue body no GitHub: #375.

## Mockup

### Painel "Ordens da Corretora" — o trade de referência

Hoje:

```
Ordens da Corretora  6     🛡️✗ Sem stop
Cancel   SELL  173755  5  CANCELLED  21/08, 11:27:51
Entrada  BUY   174050  5  FILLED     21/08, 11:25:15
Cancel   SELL  173755  5  CANCELLED  21/08, 11:27:51
Entrada  BUY   174010  5  FILLED     21/08, 11:25:18
Saída    SELL  174290  5  FILLED     21/08, 11:27:51
Saída    SELL  174290  5  FILLED     21/08, 11:27:51
```

Proposto:

```
Ordens da Corretora  6     🛡️✓ Stop
Entrada  BUY   174050  5  FILLED     21/08, 11:25:15
Entrada  BUY   174010  5  FILLED     21/08, 11:25:18
Stop     SELL  173755  5  CANCELADA NO ALVO  21/08, 11:27:51
Stop     SELL  173755  5  CANCELADA NO ALVO  21/08, 11:27:51
Saída    SELL  174290  5  FILLED     21/08, 11:25:51
Saída    SELL  174290  5  FILLED     21/08, 11:27:51
```

Três estados de linha de proteção, visualmente distintos:

| Estado | Rótulo | Quando | Leitura |
|--------|--------|--------|---------|
| viva/executada | `Stop` | FILLED, ou ainda aberta | protegeu |
| cancelada no fim | `Stop · cancelada no alvo` | `cancelledAt >= exitTime − 2s` | desfecho normal do OCO — protegeu até o fim |
| retirada antes | `Stop · retirada` (âmbar) | `cancelledAt < exitTime − 2s` e sem substituta viva | **sinal comportamental** — ficou descoberto com posição aberta |

Badge do cabeçalho: `Stop` quando existe proteção em qualquer um dos três estados; `Sem stop` só quando não há nenhuma. "Stop implícito" (loss sem stop formal) permanece como está.

O terceiro estado é ganho novo: hoje "proteção retirada com posição viva" e "proteção cancelada pelo OCO no alvo" aparecem idênticas como `Cancel`, e são fatos opostos.

### Confronto emocional

Hoje, com família dominante de gate: *"Você declarou 'Calmo', mas a execução sugere **null**."*

Proposto: família de gate (`emotionMapping: null`) **não** participa do confronto emocional — o confronto é declarado × emoção detectada, e gate não tem emoção. A dominante passa a ser a primeira família negativa **com** emoção; não havendo nenhuma, o veredicto cai para o ramo "execução saiu limpa" que já existe. Gate continua aparecendo inteiro na lista de padrões e no bloqueio de estágio, que é o canal dele.

## Memória de Cálculo

### Inputs

- `orders` (collection): `side`, `status`, `stopPrice`, `limitPrice`, `price`, `filledPrice`, `quantity`, `submittedAt`, `cancelledAt`, `filledAt`, `isStopOrder`, `externalOrderId`, `correlatedTradeId`
- `trades`: `side`, `qty`, `entry`, `exitTime`
- constante existente `OCO_TOLERANCE_MS = 2000` (`executionBehaviorEngine.js:221`)

### É proteção? (definição única, já vigente no motor)

```
entryRef  = limitPrice da 1ª ordem de entrada (fallback price → filledPrice → trade.entry)
oposto    = LONG ? SELL : BUY
preço     = stopPrice ?? limitPrice ?? price

proteção  = isStopOrder
          || (side === oposto && (LONG ? preço < entryRef : preço > entryRef))
```

Vale em qualquer `status`, CANCELLED incluído. É exatamente `protectiveLegsOf` (`executionBehaviorEngine.js:264`); o painel passa a consumir a mesma regra em vez da sua própria.

### Estado da proteção

```
refTs = trade.exitTime
cancelada no alvo  se cancelledAt >= refTs − OCO_TOLERANCE_MS
retirada           se cancelledAt <  refTs − OCO_TOLERANCE_MS
viva/executada     se cancelledAt == null
```

Mesma expressão de `liveStopsAt` (:223) — o painel ganha o rótulo, o motor já usava para cobertura.

### Identidade de ordem no dedup

Hoje (`protectiveLegsOf:299`): `side|preço|qtd|submittedAt`. Duas pernas irmãs de entrada escalonada colidem quando a corretora as cria no mesmo segundo.

Proposto: `makeOrderKey(order)` (`orderKey.js:23`), a SSoT já usada por staging, ingest e confirmação — `eid:<externalOrderId>` quando existe, composto `instrument|side|submittedAt|quantity|filledAt` como fallback. Perna irmã tem `ClOrdID` distinto; cópia de reimportação tem o mesmo. Preserva a proteção anti-duplicata do #362 sem apagar proteção real.

Nota: desde o #362 o doc em `orders` já tem id derivado dessa mesma chave, então duplicata de reimportação não chega mais ao Firestore. O dedup em memória cobre docs anteriores àquele fix.

### Cobertura (`detectUnprotectedSize`)

Inalterada na fórmula: `uncovered = trade.qty − min(Σ qty das pernas vivas, trade.qty)`. Muda só a entrada — as duas pernas voltam a existir.

Exemplo numérico, o trade de referência:

| | hoje | com o fix |
|---|---|---|
| pernas de proteção | 2 encontradas → 1 após dedup | 2 |
| `coveredQty` | 5 | 10 |
| `uncoveredQty` | 5 | 0 |
| evento | `UNPROTECTED_SIZE` HIGH (trava estágio) | nenhum |
| confronto | "execução sugere null" | sem confronto (declarada positiva + limpo) |
| badge do painel | Sem stop | Stop |

### Casos limites

- **ordem sem `externalOrderId`** (parser genérico, docs pré-#362) → fallback composto do `makeOrderKey`
- **`trade.exitTime` ausente** (trade aberto) → sem `refTs`; proteção cancelada conta como retirada só se houver ordem posterior; na dúvida, não emitir
- **proteção parcial legítima** (5 cobertos de 8) → `UNPROTECTED_SIZE` continua emitindo, que é o cenário de referência do #357
- **perna substituída** (cancela 173.755 e cria 173.900 no mesmo instante) → `retirada` só quando não há substituta viva na janela
- **trade sem ordens correlacionadas** → painel não renderiza e detector retorna vazio (comportamento atual, mantido)

## Phases

- A1 — probe: confirmar em produção se as duas pernas do trade de referência têm `submittedAt` idêntico e `externalOrderId` distinto
- A2 — `protectiveLegsOf`: dedup por `makeOrderKey`; testes com perna irmã e com cópia de reimportação
- A3 — paridade `functions/maturity/executionBehaviorMirror.js`
- B1 — `TradeOrdersPanel`: role de proteção pela definição única + três estados + badge
- B2 — confronto emocional: família de gate fora do confronto, zero `null` na copy (front + `functions/behavior/buildBehaviorProfile.js`)
- C1 — recompute dos `behaviorProfile` afetados (gates falsos gravados seguem travando estágio)

## Sessions

## Shared Deltas

- `docs/PROJECT.md` — bump + registro do fix
- `src/version.js` — bump v1.83.20
- `docs/registry/versions.md` — marcar v1.83.20 consumida
- `docs/registry/chunks.md` — liberar CHUNK-10 e CHUNK-11
- `CHANGELOG.md` — nova entrada `[1.83.20] - 21/08/2026`

## Decisions

## Chunks

- CHUNK-10 (escrita) — `TradeOrdersPanel`, leitura de ordens no painel
- CHUNK-11 (escrita) — `protectiveLegsOf`, `detectUnprotectedSize`, confronto emocional, espelho em `functions/`
