# Issue #242 — fix: parser ProfitChart-Pro confunde stop loss com saída comum (bracket OCO LIMIT)

## Autorização

- [x] Mockup — N/A (backend, sem UI nova; exceção implícita)
- [x] Memória de cálculo — abaixo
- [x] Marcio autorizou (atalho do trigger autônomo): "atacar #242 em modo autônomo" (04/05/2026)
- [ ] Gate Pré-Código — após plano de tasks aprovado

## Context

Parser `orderParsers.js:312` classifica `isStopOrder` apenas com base em `Tipo de Ordem`. Bracket OCO da Clear emite stops como `Limite` com `Preço Stop` preenchido — viram saídas comuns. AUDIT em `docs/dev/AUDIT-parser-comparison-20260504.md` (commit `126329a5`).

## Spec

`gh issue view 242` — body já contém escopo, critério de aceite e tabela regression.

## Memória de Cálculo

### Fonte do bug

`isStopOrder` é decidido **no parsing isolado** (`orderParsers.js:312`), antes de saber em qual operação a ordem vai cair. Sem contexto da posição, não dá para distinguir:

- entry SuperDOM com `Preço Stop` (lado igual à posição em construção) → NÃO é stop
- leg de bracket OCO com `Preço Stop` (lado oposto à posição aberta) → É stop

### Decisão semântica (depende do `side` da operação)

```
Para cada ordem com Preço Stop != null associada à operação:

  if order.side === oposto(operation.side):
      // É proteção da posição aberta
      // Referência = LIMITE da entrada original (op.entryOrders[0].price), NÃO avgFillPrice.
      // Justificativa: stop é configurado no momento da entrada, baseado no preço-alvo
      // que o trader pretendia entrar — não no preço de execução real (slippage não muda
      // a intenção de proteção). Confirmado contra fórmula RR=(target-entry_lim)/
      // (entry_lim-stop_trig) usada na reconstrução manual de referência.
      entryRef = op.entryOrders[0].price  // primeira ordem de entrada, campo `price` (Preço)
      if operation.side === 'LONG':
          if order.precoStop < entryRef:  → STOP_LOSS
          else:                            → STOP_GAIN
      else:  // SHORT
          if order.precoStop > entryRef:  → STOP_LOSS
          else:                            → STOP_GAIN
  else:
      // Mesmo lado — é entry SuperDOM com stop anexado, não proteção
      stopSemantic = null
      isStopOrder = false
```

**DEC-AUTO-242-01:** referência = `entryOrders[0].price` (limite da primeira ordem de entrada). Scale-in com múltiplas entradas usa a primeira. Refinamento (média ponderada de limites) fica para issue posterior se aparecer caso real.

### Campos derivados (in-memory, sem schema novo no Firestore)

Por ordem (dentro da operação reconstruída, em `entryOrders`/`exitOrders`/`stopOrders`/`cancelledOrders`):
- `stopSemantic`: `'STOP_LOSS' | 'STOP_GAIN' | null`

Por operação (em `ReconstructedOperation`):
- `hasRealStopLoss`: `boolean` — true se ≥ 1 ordem do bracket tem `stopSemantic === 'STOP_LOSS'`

### Inputs/onde leio

- `op.side` — output de `reconstructOperations` (já existe, linha 158)
- `op.avgEntryPrice` — output de `reconstructOperations` (já existe, linha 159)
- `order.stopPrice` — output de `parseProfitChartPro` (já existe, linha 333)
- `order.side` — `'BUY' | 'SELL'` — output do parser (linha 327)

### Pipeline atual vs novo

```
ATUAL:
  detectOrderFormat → parser → normalize → validate
  → reconstructOperations → associateNonFilledOrders → enrichOperationsWithStopAnalysis

NOVO (insere uma função entre):
  reconstructOperations → associateNonFilledOrders
  → enrichOperationsWithStopSemantic   ← NOVO
  → enrichOperationsWithStopAnalysis
```

Justificativa: `associateNonFilledOrders` só roda sobre CANCELLED/REJECTED/EXPIRED. A saída do trade #1 (Limite com `Preço Stop`, FILLED) está em `exitOrders[]` e nunca passa por lá. Função nova percorre **todas** as ordens da operação (entries + exits + cancelled + stops).

### Pré-requisito de compatibilidade com #208

`executionBehaviorEngine.detectStopTampering` e `detectPartialSizing` filtram ordens hoje por `o.isStopOrder`. Se passarmos a marcar como `isStopOrder=true` ordens de bracket OCO LIMIT que ANTES eram consideradas "saídas comuns" no engine, dois cenários a verificar:

1. **STOP_TAMPERING** olha eventos MODIFY em ordens stop. Bracket OCO LIMIT raramente é modificado (mais comum em STOP_LIMIT explícito). Risco baixo de regressão, mas testes da issue #208 precisam continuar verdes.
2. **PARTIAL_SIZING** olha tamanho da ordem stop vs tamanho da posição. Como agora `isStopOrder=true` para legs OCO, a função vai começar a olhar essas ordens. Comportamento esperado é alinhamento (stop deveria proteger a posição inteira).

Critério: rodar suite completa e validar que `__tests__/utils/executionBehaviorEngine.test.js` continua verde sem ajuste de fixtures.

### Exemplo numérico (CSV `040526-ORDER.csv`)

Referência = `entryOrders[0].price` (limite original).

| # | side op | entryRef (limite) | ordem c/ Preço Stop | Preço Stop | comparação | `stopSemantic` |
|---|---------|-------------------|---------------------|-----------|-----------|---------------|
| 1 | LONG  | 190.500 | saída exec SELL @ 190.365 | 190.515 | 190.515 > 190.500 | **STOP_GAIN** |
| 2 | LONG  | 190.565 | saída exec SELL @ 189.980 | 190.130 | 190.130 < 190.565 | **STOP_LOSS** |
| 3 | LONG  | 190.370 | saída exec SELL @ 189.970 | 190.120 | 190.120 < 190.370 | **STOP_LOSS** |
| 4 | SHORT | 189.645 | alvo cancelado BUY @ 189.960 | 189.810 | 189.810 > 189.645 | **STOP_LOSS** |

`hasRealStopLoss` por operação:
- Op #1 → false (única ordem com Preço Stop é STOP_GAIN)
- Op #2/#3/#4 → true

Bate com tabela do issue critério de aceite. ✓

## Phases (proposta)

- **Task 01** — `stopSemantic` + `hasRealStopLoss` no pipeline + testes unitários (helper puro `enrichOperationsWithStopSemantic`)
- **Task 02** — Fixture CSV `040526-ORDER.csv` em `src/__tests__/fixtures/` + teste de regressão integrando parser + reconstrução + classificação semântica
- **Task 03** — Validação que `executionBehaviorEngine` não regrediu (suite full); ajustes de fixture se necessário

## Sessions

_(log linear)_

## Shared Deltas (no main, no encerramento)

- `src/version.js` — bump v1.55.2 (já no main, commit `c64b97b3`)
- `docs/registry/chunks.md` — lock CHUNK-10 (já no main)
- `docs/registry/versions.md` — v1.55.2 reservada (já no main)
- `CHANGELOG.md` — entrada `[1.55.2] - 04/05/2026`
- `docs/decisions.md` — DEC-AUTO-242-XX

## §3.1 Decisões Antecipadas

_(nenhuma pendente — todas as ambiguidades resolvidas na memória de cálculo via DEC-AUTO; aguarda confirmação de Marcio em §13.8 Fase 2)_

## §3.2 Decisões Autônomas

- **DEC-AUTO-242-01** (04/05/2026): `stopSemantic` compara `Preço Stop` contra `entryOrders[0].price` (limite original da primeira entrada), NÃO `avgFillPrice`. Justificativa: stop é configurado no momento da entrada baseado no preço-alvo planejado; slippage não muda intenção de proteção. Confirmado contra fórmula RR=(target-entry_lim)/(entry_lim-stop_trig) usada na reconstrução manual. Bate exatamente com a tabela de critério de aceite do issue.
- **DEC-AUTO-242-02** (04/05/2026): Função nova `enrichOperationsWithStopSemantic(operations)` posicionada entre `associateNonFilledOrders` e `enrichOperationsWithStopAnalysis`. Não toca pipeline existente. Percorre todas as ordens (entries+exits+cancelled+stops) — `associateNonFilledOrders` só cobre não-FILLED, então não consegue marcar saídas FILLED com `Preço Stop` (caso trade #1).
- **DEC-AUTO-242-03** (04/05/2026): Campos derivados ficam **in-memory** no shape de `ReconstructedOperation` — sem schema novo na collection `trades` (INV-15 não acionada). `hasRealStopLoss` é consumido em runtime pelo `executionBehaviorEngine` e issues posteriores (NO_STOP_LOSS_AT_ENTRY).

## Chunks

- CHUNK-10 (escrita) — `orderReconstruction.js`, novo helper `stopSemantic`
- CHUNK-04 (leitura) — usa `op.avgEntryPrice` / `op.side` (sem schema novo na collection `trades`)
- CHUNK-05 (leitura) — vai consumir `hasRealStopLoss` em ciclo seguinte (issue posterior)
