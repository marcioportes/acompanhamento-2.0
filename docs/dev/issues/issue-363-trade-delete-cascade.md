# Issue #363 — fix: onTradeDeleted não limpa nada (cascata completa de deleção do trade)

> Template enxuto (R4). Rationale mora em `docs/decisions.md`.

## Autorização

- [x] Mockup apresentado — contrato da cascata (backend/CF, sem UI nova). Ver seção Mockup.
- [x] Memória de cálculo apresentada — queries, ordem, limites de batch e casos limites. Ver seção Memória.
- [x] Marcio autorizou — 19/08/2026: _"toca a fase A e não pergunta mais, termina"_
- [x] Gate Pré-Código liberado

**Decisão de produto já tomada (19/08/2026, Marcio):** _"apaga tudo que é relacionado ao trade. Ponto!"_
Registrada no issue (#363 comment) → vira DEC-AUTO-363-01. A cascata **deleta**, não desvincula.

## Context

Apagar um trade deixa vivo tudo que apontava para ele. Medido em produção 19/08: 5.129 notificações
órfãs (89% da collection, todas não lidas), 26 ordens órfãs, 10 referências em reviews, 1 em
drawdownHistory. Só `movements` está limpo — é a única dependência que o `deleteTrade` do cliente
sabe apagar.

A limpeza está no lugar errado: mora no `deleteTrade` (`src/hooks/useTrades.js:429`), que é cliente e
não alcança `/orders` (`firestore.rules:322` — `allow delete: if false`). Existem três caminhos de
deleção com coberturas divergentes (`deleteTrade`, `deletePlanCascade`, `deleteStudentData`), nenhum
completo. O `onTradeDeleted` é o único ponto por onde toda deleção passa — e é o que não limpa nada.

## Spec

Ver issue body no GitHub: #363 (+ comentário com a decisão de produto).

## Mockup — contrato da cascata

Backend puro. Novo módulo `functions/trades/cascadeDeleteTradeRefs.js`, chamado de `onTradeDeleted`
como etapa 3 (depois de reverter PL e recalcular PropFirm, que já existem e devem rodar primeiro:
dependem do `trade.result` e não do que está sendo apagado).

```
cascadeDeleteTradeRefs(db, { tradeId, trade }) → {
  skipped:       false,
  movements:     <n apagados>,
  orders:        <n apagados>,
  notifications: <n apagados>,
  reviewRefs:    <n reviews tocadas>,
  storageFiles:  <n objetos apagados>,
  errors:        [ '<alvo>: <mensagem>' ]     // parcial nunca aborta o resto
}
```

Log único por deleção, no padrão do `onTradeCreated` etapa 7:
`[onTradeDeleted] Cascata do trade {id}: mov=N orders=N notif=N reviews=N storage=N`

Isolamento (INV-03): cada alvo em `try/catch` próprio. Falhar ao apagar imagem no Storage não pode
impedir a limpeza das notificações. O erro entra em `errors[]` e aparece no log — nunca silencioso.

## Memória de cálculo

**Inputs — o que aponta para o trade e por onde se acha:**

| Alvo | Query | Volume medido |
|---|---|---|
| `movements` | `where('tradeId','==',tradeId)` | 329 total, 0 órfãos |
| `orders` | `where('correlatedTradeId','==',tradeId)` | 65 com ponteiro, 26 órfãos |
| `notifications` | `where('tradeId','==',tradeId)` | 5.788 com ponteiro, 5.129 órfãos |
| `students/{studentId}/reviews` | `frozenSnapshot.trades[]` contém o id — **ver ponto aberto** | 64, 10 órfãos |
| Storage | prefixo `trades/{tradeId}/` | não medido |

**Ordem de execução:** movements → orders → notifications → reviews → Storage. Do mais barato e
mais seguro para o mais caro. Storage por último porque é o único irreversível fora do Firestore.

**Limites:** `deleteDocsInBatches` com `BATCH_LIMIT = 400` (limite duro do Firestore é 500), reusando
o helper de `functions/accounts/deletePlanCascade.js` — não criar um segundo. Notificações são o
volume real: um trade com centenas de notificações consome vários batches, e o backfill do passivo
histórico NÃO roda dentro do trigger (ver Phases).

**Casos limites:**
- trade sem `planId`/`result` — as etapas 1 e 2 já são condicionais hoje, cascata roda igual
- trade sem `studentId` — pula reviews, registra em `errors[]`
- trade sem ordens (registro manual) — query vazia, `orders: 0`, sem erro
- Storage sem prefixo (trade sem imagem) — `getFiles` vazio, não é erro
- deleção em massa (`deletePlanCascade` apaga N trades) — cada delete dispara o trigger; o
  `deletePlanCascade` já apaga `movements` e `orders` por `planId`, então a cascata vai encontrar
  query vazia. Idempotente por construção: apagar o que já não existe é no-op.

**Bug lateral do Storage:** `TradesJournal.jsx:247` chama `deleteTrade(trade.id, trade.htfUrl,
trade.ltfUrl)` e a função é `async (tradeId) => {...}` — os dois URLs são descartados em silêncio
desde sempre. Com a cascata server-side por prefixo, a assinatura do cliente deixa de importar:
remove-se os argumentos mortos da chamada.

## Ponto aberto (precisa de decisão antes da fase C)

As 10 referências em `reviews` vivem dentro de `frozenSnapshot`, que é **congelado por contrato**
(#259 — snapshot/restore, PL imutável). "Apagar tudo" e "snapshot é imutável" colidem aqui: remover
o trade do snapshot reescreve o que a revisão publicada dizia na época.

Três saídas: (a) apagar do array mesmo assim — cumpre a decisão ao pé da letra; (b) deixar o
snapshot intacto e aceitar que ele é registro histórico, não ponteiro vivo; (c) apagar só em review
`DRAFT` (ainda não publicada) e preservar em `DISCUSSED`/publicada.

Fases A e B não dependem disso e podem começar.

## Review da fase A (code-review high, 19/08/2026)

Corrigidos no branch:
- contagem parcial em `deleteDocsInBatches` — falha no meio da paginação reportava 0 apagados
  enquanto milhares já tinham saído do banco; o log do trigger é a única evidência da deleção
- `useTrades.deleteTrade` deixa de apagar `movements` no cliente. Apagá-los ANTES do trade
  corrompia o saldo quando o delete era negado (ciclo selado #259): movements sumiam,
  `onMovementDeleted` estornava o `currentBalance`, o delete estourava permission-denied e o
  trade seguia vivo sem o movement. A cascata server-side cobre o alvo (DEC-AUTO-363-02)
- `deleteAccountCascade` migrado para `_shared/batchDelete` — era a terceira cópia do mesmo loop

Em aberto (precisam de decisão):
- **Notificação de alerta do mentor apagada por ação do aluno.** `firestore.rules:303` só deixa
  mentor apagar `/notifications`; a cascata roda com admin SDK a partir de um delete que o aluno
  pode disparar. Um `EMOTIONAL_ALERT` CRITICAL sobre o próprio comportamento some junto com o
  trade. Contra-argumento: o trade — evidência primária — já ia junto de qualquer forma, e a
  notificação órfã é ponteiro morto. Se virar problema, é escopo de imutabilidade (#184), não desta
  cascata.
- **Dead-letter de falha da cascata.** Sem retry possível (etapas 1 e 2 do trigger não são
  idempotentes: reexecutar estornaria PL em dobro) e sem o doc do trade, uma falha transitória vira
  órfão permanente até a fase D. Gravar `{tradeId, targets, errors}` numa collection própria exige
  aprovação INV-15 — não feito.

## Phases

- A — cascata no `onTradeDeleted`: movements + orders + notifications (o volume e o dano) — **FEITA**
- B — Storage `trades/{tradeId}/` + limpeza dos argumentos mortos no `deleteTrade`/`TradesJournal`
- C — referências em reviews (bloqueada pelo ponto aberto acima)
- D — script de backfill do passivo histórico: 5.129 notificações + 26 ordens já órfãs hoje. Fora do
  trigger — one-shot em `scripts/`, no padrão do `issue-351-cleanup-orders.mjs`

## Sessions

- `fase A [cascade-scalar-refs] commit d43bf9fa ok` — 9 testes novos, 225 verdes em functions
- `fase A [review-fixes] ok` — 3 achados do review corrigidos, +3 testes

## Shared Deltas

- `src/version.js` — bump v1.83.14
- `docs/registry/versions.md` — marcar 1.83.14 consumida
- `docs/registry/chunks.md` — liberar CHUNK-04 e CHUNK-10
- `CHANGELOG.md` — entrada `[1.83.14]`
- `docs/PROJECT.md` — parágrafo de encerramento
- `docs/cloud-functions.md` — `onTradeDeleted` ganha etapa 3 (cascata)

## Decisions

- DEC-AUTO-363-01 — apagar, não desvincular (decisão de produto de Marcio)
- DEC-AUTO-363-02 — cascata mora no `onTradeDeleted`, não no `deleteTrade` do cliente
- DEC-AUTO-363-03 — _(pendente: frozenSnapshot das reviews)_

## Chunks

- CHUNK-04 (escrita) — `onTradeDeleted`, `useTrades.deleteTrade`
- CHUNK-10 (escrita) — deleção dos docs de `orders` do trade
- CHUNK-16 — **sem lock**: escreve na collection `notifications` via cascata server-side, sem tocar
  nenhum arquivo do domínio do chunk (`MentorDashboard`, `MentorClosuresInbox`,
  `useMentorClosureInbox`). Lock de #101 preservado.
