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
