# Issue #362 — fix: ingestBatch não deduplica

## Autorização

- [x] Mockup — N/A (não há superfície de UI; mudança é no caminho de escrita)
- [x] Memória de cálculo — N/A (não há fórmula; a decisão é de chave e id)
- [x] Marcio autorizou — 19/08/2026: "aprovado, ataca o #362" (inclui INV-15)
- [x] Gate Pré-Código liberado

## Context

Reimportar o mesmo arquivo de ordens criava cópias em `orders`. `ingestBatch` gravava com id automático e descartava o `externalOrderId` — a chave única da corretora que o parser lê e o staging usa. Sem chave natural nem id previsível, não havia como reconhecer ordem já ingerida. A limpeza de 19/08 apagou 154 docs nascidos assim.

## Spec

Ver issue body: #362.

## Decisões

- **DEC-AUTO-362-01 — id determinístico com escopo de aluno.** `makeOrderDocId(order, studentId)` = `sanitize(studentId)_sanitize(makeOrderKey(order))`. O prefixo evita colisão entre alunos que operam na mesma corretora e podem receber o mesmo `ClOrdID`. Reusa `makeOrderKey`, que já é a chave canônica dos 3 consumidores do pipeline (#93) — não inventa critério paralelo.
- **DEC-AUTO-362-02 — `set` com `merge: true`.** Preserva campos gravados server-side que não fazem parte do payload de importação: `correlatedTradeId` da CF do #351 fase D, `userDecision` do fluxo conversacional, `correlationBackfilledBy` do backfill.
- **DEC-AUTO-362-03 — correlação só entra no payload quando existe.** Numa reimportação a correlação nova costuma vir vazia, e escrever `null` por cima devolveria a ordem ao estado órfão — exatamente o passivo que o #351 acabou de resolver.
- **DEC-AUTO-362-04 — fallback para id automático quando não há `studentId`.** Mantém o comportamento antigo em vez de falhar; o doc nasce sem idempotência, que é o estado anterior.

## Phases

- A — `makeOrderDocId` + `sanitizeIdPart` em `src/utils/orderKey.js` (SSoT de chave)
- B — `ingestBatch` usa id determinístico, grava `externalOrderId`, `set` com merge
- T — testes de idempotência (4 dos 5 falham contra o código antigo)

## Shared Deltas

- `src/version.js` — bump v1.83.13
- `docs/registry/versions.md` — marcar consumida
- `docs/registry/chunks.md` — liberar CHUNK-10
- `CHANGELOG.md` — entrada `[1.83.13]`
- `docs/PROJECT.md` — bump + encerramento
- `docs/firestore-schema.md` — campo `externalOrderId` em `orders` + estratégia de id (INV-15)

## Chunks

| Chunk | Modo | Motivo |
|-------|------|--------|
| CHUNK-10 | escrita | `useOrderStaging.ingestBatch`, `orderKey`, collection `orders` |
