# Issue #269 + #262 — refactor/feat: Revisão por backlog + SWOT customizável + SWOT sobre o rascunho

> Bloco consolidado (decisão do Marcio, 16/06/2026): junta #269 (redesign Revisão por backlog) +
> #262 (customização de SWOT por mentor, **metade-semanal**) + o bug "SWOT não pega todos os trades
> do rascunho". Versão reservada **1.76.0**. Branch `feat/issue-269-262-revisao-swot`.

## Autorização (OBRIGATÓRIA — sem isto é PROIBIDO iniciar desenvolvimento)

**Status atual do documento:**
- [x] Mockup apresentado (chat 16/06 — criação/Sessão/sliders #262)
- [x] Memória de cálculo apresentada (chat 16/06 — máquina de estados + input SWOT + exemplo §5.5)
- [x] Marcio autorizou (16/06/2026: "por plano, corrige o issue doc e segue", após review das decisões)
- [x] Gate Pré-Código liberado

> Revisão crítica das decisões (16/06): granularidade fechada **por plano** (não por aluno) — preserva
> single-currency (#289/#111); D7 revisado para ponteiro `plan.activeDraftReviewId` (transação client
> não faz query); input SWOT = draftReviewId ∪ includedTradeIds; migration usa periodTrades ∪ includedTradeIds.

## Context

Dois problemas no ritual de Revisão Semanal:
1. **SWOT não reflete o rascunho** — a SWOT roda sobre `review.frozenSnapshot`, que é (re)construído
   filtrando trades pela **semana ISO** (`weekStart`/`weekEnd`) em `NewReviewDialog.jsx:90` e
   `WeeklyReviewModal.rebuildSnapshot:58`. A curadoria do rascunho (`review.includedTradeIds`) é
   ignorada. Resultado: SWOT "acha que vem da semana", não do rascunho.
2. **Prompt da SWOT não é customizável** — `functions/reviews/prompt.js` é hardcoded; mentor não
   controla tom/foco/profundidade.

Objetivo: redesenhar a Revisão como **backlog de trades não-revisados** (#269) — o que elimina o
problema (1) por construção — e dar ao mentor controle do prompt da SWOT semanal (#262).

## Spec

- #269: GitHub issue body + spec detalhada em `Temp/spec-269.md` (664 linhas, reconciliada com #308).
- #262: GitHub issue body (metade-semanal apenas; metade-ciclo deferida — depende de #260 OPEN).

## Recorte do bloco

**ENTRA:**
- #269 completo: `trade.reviewState` (NONE/DRAFT/DISCUSSED) + `draftReviewId`, callables
  `createReviewDraft`/`publishReview`/`deleteReviewDraft`, migration retroativa (dry-run obrigatório),
  hook no `tradeGateway.createTrade`. SWOT passa a rodar sobre os trades do DRAFT.
- #262 metade-semanal: `functions/_shared/swotPromptBuilder.js` + `mentorConfig.swotStyle`
  (tom/foco/profundidade, global por mentor) + 3 sliders no MentorCockpit + callable
  `setMentorSwotStyle`. `generateWeeklySwot` consome o builder.
- Slot #308: exibir `trade.selfReview` (read-only) como contexto dentro da Sessão (spec §19).

**FORA (deferido):**
- #262 metade-ciclo (SWOT de Fechamento) — segue #260 (1B IA real, OPEN). Hoje o fechamento usa
  `swotHeuristics.js` (stub); `generateClosureSwot.js` não existe ainda.
- #260, feature flag de rollout (decisão: cutover direto com migration protegida por dry-run).

## Decisões (fechadas no gate, 16/06/2026)

- **🔴 Granularidade — POR PLANO** (não por aluno). `createReviewDraft(studentId, planId)` traz os
  `NONE` **daquele plano**. Preserva `planContext`, comparação vs revisão anterior do mesmo plano, e
  o invariante single-currency (#289/#111 — aluno com 2 planos em moedas diferentes não mistura SWOT).
  Índice Firestore: `trades` por `studentId ASC, planId ASC, reviewState ASC, entryTime DESC`.
- **D7 (revisado)** — `tradeGateway.createTrade` é client-side; transação Firestore no cliente **não
  faz query**. Solução: ponteiro denormalizado **`plan.activeDraftReviewId`** (string\|null), lido por
  ID na transação. Gateway decide `NONE` vs `DRAFT` + seta `draftReviewId`. As callables
  create/publish/delete mantêm o ponteiro.
- **D8** — migration com **dry-run obrigatório** + safeguard (não roda real sem dry-run recente).
- **D-UI** — mentor **pode pular** trades específicos ao criar o DRAFT (voltam a `NONE`).
- **#262** — `swotStyle` **global por mentor** (MVP), não por aluno.
- **Input da SWOT** — conjunto = `trades WHERE draftReviewId == reviewId` **∪** `review.includedTradeIds`
  (cobre o "Adicionar trade fora do backlog" — revisitar `DISCUSSED` antigo sem mudar `reviewState`).
- **Migration — fonte do `DISCUSSED`** = `frozenSnapshot.periodTrades[].tradeId` ∪ `includedTradeIds`
  de **todas** as reviews CLOSED/ARCHIVED (não só `includedTradeIds`, que é esparso).
- **Cutover** — direto, migration protegida por dry-run. Reavaliar feature flag (`VITE_NEW_REVIEW_FLOW`)
  na Fase C se a dry-run na massa de teste vier torta.

## Mockup
_(pendente — apresentar antes do código; base em `Temp/spec-269.md` §10)_

## Memória de Cálculo
_(pendente — base em `Temp/spec-269.md` §5 + exemplo numérico §5.5)_

## Phases
- A — schema + gateway: `trade.reviewState`/`draftReviewId` + `plan.activeDraftReviewId` (ponteiro) +
  hook `createTrade` (decide NONE/DRAFT por plano, em transação lendo o ponteiro) + rules + índices
- B — callables (por plano): `createReviewDraft(studentId, planId)` / `publishReview` /
  `deleteReviewDraft` — mantêm `plan.activeDraftReviewId`, bulk de `reviewState`, `sequenceNumber` no publish
- C — migration retroativa (dry-run + apply): `DISCUSSED` = periodTrades ∪ includedTradeIds de CLOSED/ARCHIVED
- D — UI Revisão: backlog por plano na criação, SWOT sobre (draftReviewId ∪ includedTradeIds), slot selfReview
- E — #262: `swotPromptBuilder` + `mentorConfig.swotStyle` + sliders MentorCockpit + `setMentorSwotStyle`

## Sessions
_(log linear)_
- A — `1144cbc2` — schema+gateway: `trade.reviewState`/`draftReviewId` + hook lendo `plan.activeDraftReviewId` + rules + índice (`planId,reviewState,entryTime`). 27 testes gateway.
- B — `0fd75dbb` — callables `createReviewDraft`/`publishReview`/`deleteReviewDraft` (por plano, ponteiro D7, `sequenceNumber`, transações) + helpers puros (+7 testes) + guard rules `activeDraftReviewId`.
- C — `35f640a9` — `migrateReviewStateBackfill` (D8 dry-run/apply, safeguard via `expectedChanges`, reconcilia trades+`sequenceNumber`+ponteiro) + `migrationLogic.js` puro (+8 testes). Fonte DISCUSSED = periodTrades ∪ top/bottom ∪ includedTradeIds.
- D — `94bb8b49` (cutover) + `a2ad4ff9` (selfReview) — UI por backlog: NewReviewDialog lista NONE por dia (skip), hook→callables, rebuildSnapshot sobre draftReviewId∪includedTradeIds (mata bug SWOT), header período+#seq, Descartar rascunho, PinToReviewButton+PlanLedgerExtract migrados. Slot Espelho read-only na Sessão (§19). +4 testes backlog. Mockup confirmado por Marcio.
- E — `b66b6289` — #262 SWOT customizável: `swotPromptBuilder.js` puro (tom/foco/profundidade, neutro=2, +7 testes) + callable `setMentorSwotStyle` (mentorConfig.swotStyle, campo novo em doc existente) + consumo no `generateWeeklySwot` + card de 3 sliders no ComplianceConfigPage. Metade-ciclo deferida (#260).

## Shared Deltas
- `src/version.js` — bump v1.76.0
- `docs/registry/versions.md` — marcar v1.76.0 consumida
- `docs/registry/chunks.md` — liberar CHUNK-04 / CHUNK-08 / CHUNK-16
- `CHANGELOG.md` — nova entrada `[1.76.0]`
- `docs/PROJECT.md` — versão + resumo
- `docs/firestore-schema.md` — `trade.reviewState`/`draftReviewId`, `mentorConfig.swotStyle`
- `docs/cloud-functions.md` — callables novas
- `docs/decisions.md` — DEC-AUTO-269-*

## Decisions
_(IDs — texto em docs/decisions.md)_

## Chunks
- CHUNK-03 (escrita) — campo `plan.activeDraftReviewId` (ponteiro denormalizado, D7)
- CHUNK-04 (escrita) — campo `reviewState`/`draftReviewId` + hook no gateway + migration
- CHUNK-08 (escrita) — callables de review + SWOT + builder de prompt
- CHUNK-16 (escrita) — sliders de `swotStyle` no MentorCockpit (#262)
- CHUNK-09 (leitura) — verificação D6 (4D não depende de `review.status`; já fechada negativa)

## Aprovação prévia exigida (INV-15)
- `trade.reviewState` + `trade.draftReviewId` (campos novos)
- `plan.activeDraftReviewId` (campo novo — ponteiro do DRAFT corrente por plano)
- collection/doc `mentorConfig` + `swotStyle` (estrutura nova)

---

## REDESENHO v2 — modelo normalizado (19/06/2026)

> Decisão do Marcio (19/06, após review do deploy v1.76.0): as Fases A–E criaram uma
> **gororoba de modelagem** — DOIS ciclos paralelos de "revisado" no trade
> (`status` OPEN/REVIEWED/QUESTION/CLOSED, já existente do CHUNK-08, **+** `reviewState`
> NONE/DRAFT/DISCUSSED, novo do #269) **+** `review.includedTradeIds` como pertencimento
> (array interno na revisão, com a FK `draftReviewId` sendo **apagada** no publish).
> Substituído por **FK única + ciclo único**. Refaz o miolo antes da migration rodar
> (sem dado de produção a proteger).

### Domínio (linguagem de produto)
Três coisas distintas que a v1 misturava:
1. **Reflexão do aluno (Espelho)** — `trade.selfReview`, parte da entrada do trade. Insumo.
2. **Revisão monolítica do mentor** — seu feedback operação por operação (`trade.mentorFeedback`
   + fio, CHUNK-08). É o que vira insumo da reunião.
3. **Revisão semanal** — a reunião; o *conjunto* dos trades que você revisou = a pauta.

### Modelo de dados
- **`trade.reviewId: string | null`** — FK para a revisão semanal. `null` = backlog
  ("ainda não revisei"). Imortal: setada uma vez, NUNCA apagada (nem no publish).
- **`trade.status`** — ciclo ÚNICO, ganha estado terminal `DISCUSSED`:
  `OPEN → REVIEWED ⇄ QUESTION → CLOSED → (publicação) → DISCUSSED` (terminal, imutável).
- **Morrem:** `trade.reviewState`, `trade.draftReviewId`, `review.includedTradeIds`
  (pertencimento = `trades WHERE reviewId == reviewId`).
- **Mantém:** `plan.activeDraftReviewId` (ponteiro da revisão aberta do plano — o gateway
  client-side lê por ID, sem query); `review.frozenSnapshot` (cópia congelada imortal dos
  dados do trade, sobrevive a edição/exclusão); takeaways / sessionNotes / swot / links.

### Atribuição do `review_id` (o gatilho)
- Carimbado na **primeira transição `OPEN → REVIEWED`** — seu primeiro feedback no trade,
  **individual OU em massa** (`bulkFeedback`). Único chokepoint. Idempotente: o trade quica
  REVIEWED ⇄ QUESTION e termina em CLOSED sem reatribuir.
- A revisão semanal aberta do plano é criada **sob demanda** no 1º feedback pós-última-reunião.
  Substitui o `createReviewDraft` manual + dialog/picker de backlog.
- Pertencimento = `review_id`; o estado do fio de feedback é irrelevante pra pauta (um trade
  `status=CLOSED` com `reviewId` no rascunho **aparece** na pauta).

### Publicação (reunião)
- Mentor publica → `review.status: DRAFT → CLOSED` + `sequenceNumber` + congela `frozenSnapshot`
  + limpa `plan.activeDraftReviewId`.
- TODOS os trades com `reviewId == review` viram **`status=DISCUSSED`** (força fios em
  REVIEWED/QUESTION/CLOSED ao terminal — a reunião ao vivo supera o fio assíncrono). `reviewId`
  NÃO é tocado (já está setado).

### Imutabilidade (resolve a escolha A/B sozinha)
- `status == 'DISCUSSED'` → trava (rules + `onTradeUpdated` + `submitTradeReview`). O cadeado mora
  no campo de lifecycle que JÁ existe — sem cache paralelo, sem `get()` na revisão.

### Callables revisadas
- `createReviewDraft` → vira `getOrCreateOpenReview(studentId, planId)` **interno**, disparado
  pelo feedback (não é mais ação de UI).
- `publishReview` → não escreve a *relação* nos trades (já têm `reviewId`); seta
  `status=DISCUSSED` + fecha a review.
- `deleteReviewDraft` → **ver Edge aberto abaixo.**
- `migrateReviewStateBackfill` → escreve `trade.reviewId` (+ `status=DISCUSSED` p/ CLOSED/ARCHIVED)
  a partir da mesma fonte legada (periodTrades ∪ includedTradeIds). Conflito → review mais recente.

### Limpeza acoplada (autorizada 19/06)
- Remover o vocabulário de status **morto** em `src/firebase.js` (`TRADE_STATUS`:
  PENDING_REVIEW/REVIEWED/IN_REVISION) que não bate com o vivo (`OPEN/REVIEWED/QUESTION/CLOSED`).

### Descartar revisão (RESOLVIDO 19/06 — opção a)
- **`deleteReviewDraft` / botão "Descartar rascunho" são REMOVIDOS.** No modelo auto-aberto,
  "descartar" perdeu propósito: a revisão é só o balaio dos trades que o mentor revisou. Não quer
  reunião agora → **não publica**; a revisão aberta espera. Sem limbo, sem re-ancoragem.

### Impacto (arquivos)
- `tradeGateway.createTrade` (nasce com `reviewId`), `addFeedbackComment` CF + `bulkFeedback`/
  `useTrades` (gatilho `review_id` no OPEN→REVIEWED), as 3 callables, `migrateReviewStateBackfill`
  + `migrationLogic`, `firestore.rules` (trava por `status=DISCUSSED`), `firestore.indexes`
  (`planId,reviewState,entryTime` → `planId,reviewId`), `reviewHelpers`, `NewReviewDialog`
  (some criação/picker), `WeeklyReviewPage` (workspace inalterado), `firebase.js` (limpeza),
  testes correlatos. Re-deploy de functions + rules + índices.
