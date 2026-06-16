# Issue #269 + #262 — refactor/feat: Revisão por backlog + SWOT customizável + SWOT sobre o rascunho

> Bloco consolidado (decisão do Marcio, 16/06/2026): junta #269 (redesign Revisão por backlog) +
> #262 (customização de SWOT por mentor, **metade-semanal**) + o bug "SWOT não pega todos os trades
> do rascunho". Versão reservada **1.76.0**. Branch `feat/issue-269-262-revisao-swot`.

## Autorização (OBRIGATÓRIA — sem isto é PROIBIDO iniciar desenvolvimento)

**Status atual do documento:**
- [ ] Mockup apresentado (ou exceção autorizada por Marcio)
- [ ] Memória de cálculo apresentada (ou exceção autorizada por Marcio)
- [ ] Marcio autorizou (data + frase)
- [ ] Gate Pré-Código liberado

> Escopo já autorizado por Marcio em conversa (16/06): "quero o 269, 262 e os trades do rascunho
> sejam tratados na swot da revisão". Falta o gate de mockup/memória + "autorizado" para tocar código.

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

## Decisões assumidas (técnicas — confirmar no gate)

- **D7** — checagem "aluno tem DRAFT ativo?" no **gateway, em transação** (não pre-check no front).
- **D8** — migration com **dry-run obrigatório** + safeguard (não roda real sem dry-run recente).
- **D-UI** — mentor **pode pular** trades específicos ao criar o DRAFT (voltam a `NONE`).
- **#262** — `swotStyle` **global por mentor** (MVP), não por aluno.

## Mockup
_(pendente — apresentar antes do código; base em `Temp/spec-269.md` §10)_

## Memória de Cálculo
_(pendente — base em `Temp/spec-269.md` §5 + exemplo numérico §5.5)_

## Phases
_(a definir no gate — esboço)_
- A — schema + gateway: `trade.reviewState`/`draftReviewId` + hook `createTrade` + rules + índices
- B — callables: `createReviewDraft` / `publishReview` / `deleteReviewDraft`
- C — migration retroativa (dry-run + apply)
- D — UI Revisão: backlog na criação, SWOT sobre DRAFT, slot selfReview
- E — #262: `swotPromptBuilder` + `mentorConfig.swotStyle` + sliders MentorCockpit + `setMentorSwotStyle`

## Sessions
_(log linear)_

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
- CHUNK-04 (escrita) — campo `reviewState`/`draftReviewId` + hook no gateway + migration
- CHUNK-08 (escrita) — callables de review + SWOT + builder de prompt
- CHUNK-16 (escrita) — sliders de `swotStyle` no MentorCockpit (#262)
- CHUNK-09 (leitura) — verificação D6 (4D não depende de `review.status`; já fechada negativa)

## Aprovação prévia exigida (INV-15)
- `trade.reviewState` + `trade.draftReviewId` (campos novos)
- collection/doc `mentorConfig` + `swotStyle` (estrutura nova)
