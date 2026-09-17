# Issue #451 — fix: trade discutido é reescrito pelo servidor — a imutabilidade só existe contra o cliente

> **Branch:** `fix/issue-451-trade-discutido-imutavel`
> **Aberto em:** 17/09/2026
> **Status:** 🟢 Autorizado — modo autônomo
> **Versão reservada:** 1.92.3

## Autorização

- [x] Mockup — **não se aplica:** trava de escrita no servidor, sem UI nova.
- [x] Memória de cálculo apresentada (17/09/2026) — regra booleana + inventário medido na base
- [x] Marcio autorizou (17/09/2026): *"Ataca 451 em modo autônomo"*
- [x] Gate Pré-Código liberado

## Context

**Trade em `status: DISCUSSED` é imutável** — o registro do trade discutido é o registro da conversa que houve com o aluno. Hoje essa garantia existe **apenas contra o cliente**: `firestore.rules` torna terminal qualquer trade já `DISCUSSED`, mas toda função com admin SDK passa por fora das rules.

Duas funções reescrevem trade discutido sem olhar o status, e não são scripts esporádicos — são a rotina: editar `riskPerOperation`, `rrTarget`, `periodStop` ou `cycleStop` no plano dispara a cascata.

**239 dos 413 trades da base (58%) são `DISCUSSED`** e estão expostos.

## Spec

Ver issue body no GitHub: #451, mais o comentário "Como a regra é garantida" (desenho das 3 camadas).

## Mockup

Não se aplica. Efeito visível: a auditoria do plano passa a informar quantos trades foram preservados.

## Memória de Cálculo

### A regra

```
tradeEhImutavel(trade) = trade.status === 'DISCUSSED'
```

O critério é **só o status** (Marcio, 17/09/2026: *"Trades que estejam em ciclo fechado e não foram discutidos, podem ser alterados. Somente discussed é imutável."*). Ciclo fechado não entra — o seal do #259 no `firestore.rules` é outra coisa e fica como está.

### Inventário medido (17/09/2026)

| escrita | campos | gatilho |
|---|---|---|
| `recalculateCompliance` (`functions/index.js`) | `riskPercent`, `rrRatio`, `rrAssumed`, `compliance`, `redFlags` | cascata de `usePlans.updatePlan` nos 4 campos de risco + botão de auditoria |
| `recomputeBehaviorForStudent` (`functions/behavior/recomputeBehaviorProfiles.js`) | `behaviorProfile` (batch) | chamada pela cascata acima e outros caminhos |

Base: 413 trades — 239 `DISCUSSED`, 97 `CLOSED`, 57 `REVIEWED`, 19 `OPEN`, 1 `QUESTION`. Dos 162 em ciclo fechado, os 162 são `DISCUSSED` (a regra de ciclo não libera ninguém hoje).

### Casos limites

- **Transição para discutido:** `publishReview` faz `tx.update(d.ref, { status: 'DISCUSSED' })`. A trava barra escrita em quem **já está** discutido; a transição segue livre.
- **Exclusão:** cascatas (`deleteStudentData`, `deletePlanCascade`, `cascadeDeleteTradeRefs`) continuam apagando trade discutido. Imutável é sobre reescrever, não sobre apagar.
- **PL do plano:** `currentPl` é campo do plano, não do trade — segue recalculando normalmente.
- **Trade não discutido:** recalculado como hoje, inclusive dentro de ciclo fechado.
- **Doc sem campo `status`:** tratar como mutável (legado) — só `=== 'DISCUSSED'` trava.

## 3.1 Decisões Antecipadas (respostas do Marcio — aplicar sem novo gate)

- **D1** — critério é só `status === 'DISCUSSED'`. Ciclo fechado **não** entra.
- **D2** — a transição para `DISCUSSED` (publishReview) continua permitida.
- **D3** — exclusões em cascata continuam permitidas; a trava é de update, não de delete.
- **D4** — recálculo de PL do plano não muda.
- **D5** — a cerca **estende `src/__tests__/invariants/tradeWriteBoundary.test.js`** (o arquivo já existe e cobre só `src/` com padrões do SDK do cliente); não criar mecanismo novo. Whitelist explícita: helper + `publishReview` + cascatas de exclusão.
- **D6** — as duas funções reportam quantos trades preservaram, no retorno e no log.
- **D7** — suíte roda também em `TZ=UTC` antes do PR (lição do #449: a CI roda em UTC e a suíte local em BRT esconde defeito).
- **D8** — **nenhum backfill, nenhuma migração de dados.** Não tocar em trade existente.
- **D9** — sem campo novo no Firestore (INV-15 não é acionada).

## Phases

- **01-helper** — `functions/_shared/tradeImmutability.js`: predicado + duas variantes de escrita guardada (avulsa, que lê o doc; e com doc já lido, para batch/transação). Testes unitários: barra update em `DISCUSSED`, permite nos demais status, permite a transição para `DISCUSSED`, trata doc sem `status`.
- **02-aplicar** — `recalculateCompliance` e `recomputeBehaviorForStudent` passam pelo helper, pulam os discutidos e devolvem/logam `preservados`. Testes cobrindo os dois caminhos com massa mista.
- **03-rotear** — (DEC-AUTO-451-09) demais escritas vivas do servidor em `trades` passam pelo helper; transição para `DISCUSSED` livre; scripts avulsos intocados.
- **04-cerca** — estender `tradeWriteBoundary.test.js` para varrer `functions/**` com padrões do admin SDK (`db.collection('trades')` + `.update(`/`.set(`/`.delete(`, `batch.update`, `tx.update`), com whitelist. O teste deve **reprovar** se alguém remover a guarda.
- **05-entrega** — suíte completa em `TZ=UTC` **e** no fuso local, lint nos arquivos tocados, build. Report com as duas contagens.

## Sessions

- 01-helper — ok · `772c3d72` · functions 286 verdes · STOP-01 falso positivo de parse, aceita pelo Marcio (DEC-AUTO-451-01)
- 02-aplicar — ok · `343dedad` · raiz 4847 passed / 1 skipped · functions 292 · validator OK (DEC-AUTO-451-04..08)
- 03-rotear — ok · `f6ffee96` · raiz 4853 passed / 1 skipped (também TZ=UTC) · functions 309 · validator OK (DEC-AUTO-451-10..14) · inventário `.cc-mailbox/outbox/03-rotear-inventario.md`
- 04-cerca — ok · `ca9e0a26` · raiz 4875 passed / 1 skipped · functions 309 · validator OK (DEC-AUTO-451-15) · cerca verificada pelo coord com arquivo-sonda: suíte reprovou apontando `__cerca_probe.js:2`, sonda removida
- 05-entrega — verificação completa OK, sem commit (nada a corrigir) · validator exit 1 em `files_match` = artefato do briefing (task sem commit → `files_touched: []` vs commit da task 04); gate enviado ao Marcio · reverificado pelo coord: `TZ=UTC` functions 309 verdes, raiz 4875 verdes / 1 pulado, build ok em 14.69s, cerca 28 verdes
- 05-entrega — **ACEITA** pelo Marcio em 17/09/2026 (`coord-inbox/human-response-05.md`), loop encerrado 5/5 (DEC-AUTO-451-17)
- **Pendente (coord/Marcio, no main):** PR + shared deltas — 1.92.3, CHANGELOG, PROJECT.md, INV-30, liberar CHUNK-04
- **Achado fora de escopo:** `ci.yml:41` roda só `npm run test:run` (suíte raiz) — os testes em `functions/__tests__/**` não rodam na CI. A cerca roda (mora em `src/`), mas os testes de functions desta issue não. Candidato a DT.

## Shared Deltas

- `src/version.js`: 1.92.3 (já reservada no main)
- `docs/registry/versions.md`: marcar 1.92.3 consumida
- `docs/registry/chunks.md`: liberar CHUNK-04
- `CHANGELOG.md`: entrada `[1.92.3]`
- `docs/PROJECT.md`: bump + parágrafo de encerramento **e linha na tabela de histórico**
- `docs/invariants.md`: avaliar se a trava vira invariante própria (proposta: sim — INV-30)

## Decisions

### 3.2 Decisões Autônomas

- DEC-AUTO-451-01: task 01 aceita apesar do exit 1 `tests_match` | Justificativa: result.log em prosa sem `N passed`; verificação externa (CC-Interface) confirmou functions 286 verdes e `git show --name-only 772c3d72` = files_touched. Aceite do Marcio em `coord-inbox/human-response-01.md`. Regra nova: todo briefing exige a linha literal `Tests  N passed | M skipped (T)` no report e a saída integral do vitest no result.log.
- DEC-AUTO-451-02: guarda de behaviorProfile em `recomputeBehaviorProfiles` (escritor do batch), cobrindo os 4 chamadores | Justificativa: guardar só `recomputeBehaviorForStudent` deixaria recomputeMaturity/analyzeShadowBehavior reescrevendo discutido (AP-02). Discutido continua no cálculo; só a gravação pula. Aprovado pelo Marcio (human-response-01).
- DEC-AUTO-451-03: contagem de preservados exibida em `usePlans.auditPlan` + `PlanAuditModal` (texto, sem componente novo) | Justificativa: efeito visível previsto em §Mockup; aprovado (human-response-01).
- DEC-AUTO-451-04: laço de compliance extraído para `functions/trades/recalculateTradesCompliance.js` (deps injetadas); teste em `functions/__tests__/trades/` | Justificativa: callable em index.js não é testável; testar módulo real, não réplica.
- DEC-AUTO-451-05: `recomputeBehaviorProfiles` só commita lote com ao menos uma escrita | Justificativa: evita commit vazio quando o lote é todo discutido.
- DEC-AUTO-451-06: `preserved` do behaviorProfile conta só discutidos que seriam regravados (fingerprint mudou e dentro do `writeScope`) | Justificativa: preservado = escrita evitada, não trade discutido existente.
- DEC-AUTO-451-07: log final de `recalculateCompliance` movido para após o recompute de behavior, com as duas contagens | Justificativa: uma linha de auditoria.
- DEC-AUTO-451-08: diagnóstico da auditoria exclui discutidos de `divergentTrades`, testado via `usePlans` real; `diagnosePlan.test.js` (réplica) intocado | Justificativa: sem isso a auditoria nunca fica saudável.
- DEC-AUTO-451-09: fase 03 dividida — **03-rotear** (demais writers vivos do servidor passam pelo helper) + **04-cerca** + **05-entrega** | Justificativa: spec do issue (camada 1: "toda escrita do servidor em `trades`" passa pelo helper; whitelist da cerca = helper + publishReview + cascatas de exclusão). O inventário de 17/09 listava só 2 writers; a varredura do coord achou outros vivos (`addFeedbackComment`, `closeTrade`, `onTradeCreated`, `onTradeUpdated` ×5, `enrichTradeWithExcursions`). Scripts avulsos/migrações ficam em lista GRANDFATHERED explícita da cerca (padrão do `tradeWriteBoundary.test.js`; D8 proíbe migração, spec declara que script com credencial está fora do alcance).
- DEC-AUTO-451-10: helper ganha `updateIfMutable(ref, docSnapOrData, patch, label)` (doc já lido, sem batch/tx, loga a preservação) | Justificativa: evita `if` duplicado nos chamadores (AP-02) e leitura extra.
- DEC-AUTO-451-11: `addFeedbackComment` e `closeTrade` em trade discutido passam a devolver `failed-precondition` sem escrever nem notificar | Justificativa: ambos reescreviam discutido (comentário sem `newStatus`; DISCUSSED→CLOSED); sucesso silencioso mentiria sobre o comentário. Espelha `firestore.rules`, que já tornava DISCUSSED terminal no cliente; fluxo principal de UI usa `useTrades` (cliente), não essas callables.
- DEC-AUTO-451-12: INV-03 verificada — evento de transição do `publishReview` só muda `status`/`updatedAt`; `onTradeUpdated` sai antes dos blocos de escrita; `reviewId`/`_pendingReviewNote` só rodam na entrada em REVIEWED. Teste cobre a transição sem escrita.
- DEC-AUTO-451-13: `runEnrichment` monta o patch e escreve num único ponto guardado; discutido → `{ok:false, skipped:true, preserved:true}` (busca Yahoo ainda ocorre antes da guarda — custo aceito, caso raro).
- DEC-AUTO-451-14: logs "Compliance recalculado"/"Lock destravado" só quando a escrita ocorreu; testes carregam `index.js` real com Firestore em memória (mutação helper→update cru reprova 4 testes).
- DEC-AUTO-451-15: contexto de trade da cerca inclui arquivo que importa `_shared/tradeImmutability` ou mora em `functions/trades/` | Justificativa: `recalculateTradesCompliance.js` recebe docs por injeção e não cita `collection('trades')` — a escrita crua escapava do detector. Teste extra cobre remoção simultânea da guarda e do import.
- DEC-AUTO-451-17: task 05 aceita apesar do exit 1 em `files_match` | Justificativa: artefato do briefing — task de verificação sem commit próprio nunca casa `files_touched: []` contra os arquivos do commit apontado. Verificação externa independente (CC-Interface) confirmou `TZ=UTC` functions 309 e raiz 4875/1 pulado, CLAIMS das 3 tasks com commit batendo, e **prova de mordida da cerca** com violador plantado (`functions/trades/__probe451.js` → reprovou apontando `trades/__probe451.js:4`, removido, 28 verdes). Lição p/ o template: task sem commit precisa de regra própria no validator (`files_touched: []` + `commit_hash` do HEAD herdado não é divergência). Numeração 16 não usada.

## Chunks

- CHUNK-04 (escrita) — trava de imutabilidade no servidor
- CHUNK-05 (leitura) — compliance
- CHUNK-11 (leitura) — behaviorProfile
