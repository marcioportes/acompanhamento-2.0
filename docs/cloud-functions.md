# Cloud Functions

> CFs são a cadeia de side-effects inquebrável (INV-03). Mudança em um elo exige análise de impacto em todos os elos downstream.

## Triggers de `trades`

| Function | Trigger | Responsabilidade |
|----------|---------|-----------------|
| `onTradeCreated` | `trades` onCreate | Atualiza PL do plano + compliance stats + emotional scoring. **Debt crítico:** dispara em trades `IMPORTED`, corrompendo PL. |
| `onTradeUpdated` | `trades` onUpdate | Recalcula PL, compliance, maturity (v1.43.0). **#269 v2:** na 1ª transição `OPEN→REVIEWED` ancora `trade.reviewId` (`getOrCreateOpenReview`) — **único chokepoint** da relação trade↔revisão semanal. **Filtro matriz:** só ancora se o aluno está no escopo da Revisão (`studentInReviewScope` = bucket `{alpha, trial-alpha}`); fora disso pula. |
| `onTradeDeleted` | `trades` onDelete | Reverte PL + recalcula compliance. |

## Hard seal de trades (CHUNK-04, #259, v1.64.0)

- **Server-side (`firestore.rules`):** `isTradeDateNotSealed(planId, tradeDate)` consulta `plan.lastClosedCycleEnd` cache; bloqueia `create/update/delete` em trades cuja data está em ciclo fechado.
- **Client-side (`tradeGateway.createTrade`):** `findSealingRange(plan, date)` + `isTradeBeforeLastClosedCycle` (C5) — cobre CSV import e criação manual com mensagem rica de erro antes do roundtrip.
- **CF mirror (`sealCheckMirror.js`):** mesma lógica em CJS pra reuso por CFs admin SDK (que bypassam rules).

## Callables (via API Claude — Sonnet 4.6)

| Function | Uso | Secret |
|----------|-----|--------|
| `classifyOpenResponse` | Classifica respostas abertas do onboarding | `ANTHROPIC_API_KEY` |
| `generateProbingQuestions` | Gera 3-5 perguntas de sondagem adaptativa | `ANTHROPIC_API_KEY` |
| `analyzeProbingResponse` | Analisa respostas do probing | `ANTHROPIC_API_KEY` |
| `generateAssessmentReport` | Relatório completo pré-mentor | `ANTHROPIC_API_KEY` |
| `classifyMaturityProgression` | Narrativa de progressão de maturidade (UP/regressão) | `ANTHROPIC_API_KEY` |
| `analyzeShadowBehavior` | 15 padrões comportamentais em segundo plano | `ANTHROPIC_API_KEY` |

## Callables — Ritual de Fechamento de Ciclo (CHUNK-04/16, #259, v1.64.0)

| Function | Uso | Notas |
|----------|-----|-------|
| `closeCycle` | Cria doc imutável em `cycleClosures/{planId}_{cycleKey}` + atualiza plano (pl, lastClosedCycleEnd, sealedCycleRanges arrayUnion, currentCycleNumber+1, lastCycleClosureId) | Transação atômica. Gate de equity: `effectivePL ≤ cycleBaseline.plFinal + 0.1`. Gera `behavioralSummary` server-side com flag `critical` e `denialFlag` (C3). Permissão: aluno só fecha o próprio; mentor pode demonstrar. |
| `reopenCycle` | Deleta o closure doc + restaura plano via `preClosePlanSnapshot` (pl, RO, RR, 4 metas) + remove range do `sealedCycleRanges` + decrementa `currentCycleNumber` + recua `lastCycleClosureId` | **Gate de cadeia (#259):** só aceita reabrir o último closure (`plan.lastCycleClosureId === closureId`). Closures pre-C3 sem `preClosePlanSnapshot` logam warning e mantêm plan como está (DT). |
| `setMentorClosureComment` | Mentor escreve `closure.mentor.closingComment` + `closingCommentAt`. Comment vazio = "no comment" (item sai do inbox). | Janela operacional de 7d pós-close. |
| `deleteAccountCascade` | Apaga conta em 7 estágios: movements → trades → orders → cycleClosures → plans → account (em batches). | Resolve órfãos que ficavam por rules `allow delete: if false` no client. |
| `deletePlanCascade` | Apaga plano + trades/orders/movements/cycleClosures **+ reviews** (`students/{uid}/reviews` por `planId`, #269 v2) vinculados. | Cascade de reviews evita revisões órfãs de plano morto. `deleteAccountCascade` idem para todos os planos da conta. |

## Callables — Revisão semanal v2 (CHUNK-04/08/16, #269/#262, v1.76.0)

| Function | Uso | Notas |
|----------|-----|-------|
| `getOrCreateOpenReview` | **Interno** (chamado por `onTradeUpdated`): retorna a revisão DRAFT aberta do plano, criando-a sob demanda. Idempotente via `plan.activeDraftReviewId` (transação no doc do plano). | Substitui o antigo `createReviewDraft` manual. Carrega carry-over de takeaways abertos. |
| `publishReview` | DRAFT→CLOSED: `sequenceNumber`, congela `frozenSnapshot`, marca **todos** os membros (`reviewId==id`) `status=DISCUSSED`, limpa `plan.activeDraftReviewId`. | Não toca `reviewId` (já setado). Mentor-only. |
| `setMentorSwotStyle` | Grava `mentorConfig/{uid}.swotStyle` (tom/foco/profundidade) — #262. | Consumido por `generateWeeklySwot` via `swotPromptBuilder`. |
| `migrateReviewStateBackfill` | Migração retroativa (dry-run + safeguard D8 `expectedChanges`): preenche `trade.reviewId` (+`status=DISCUSSED` p/ reviews fechadas), provisiona rascunho vigente p/ órfãos-com-feedback, reconcilia `sequenceNumber`/ponteiros. Pula aluno fora de escopo. | One-time #269. Idempotente; blinda `DISCUSSED` contra re-run. |
| `deleteStudent` | Hard delete LGPD-like do aluno: subcollections recursivas de `students/{sid}/*` + top-level por `studentId` (trades, orders, notifications, plans, csvStaging, csvStagingTrades, accounts, crossCheck, **cycleClosures**) + **movements por accountId** (DEP/WTD/INITIAL_BALANCE/ADJUSTMENT só têm accountId) **e por studentId** (TRADE_RESULT órfão) + **Storage** `trades/{tradeId}/` best-effort + doc + Auth user. Cascata em `functions/students/deleteStudentData.js` (testável). | Mentor-only. `timeoutSeconds: 300` (#309). Storage best-effort não aborta (DEC-AUTO-309-01). |

## Schedule

| Function | Schedule | Responsabilidade |
|----------|----------|-----------------|
| `checkSubscriptions` | `0 8 * * *` (08h BRT) | Detecta vencimentos, marca overdue, expira trials, sincroniza accessTier (DEC-055/056) |

## Regras

- **Secrets:** toda CF com Claude API declara `secrets: ['ANTHROPIC_API_KEY']`.
- **Runtime:** Node.js 22.x (migrado de 20 em v1.22.0 — DT-016/028 resolvidos).
- **SDK:** firebase-functions ≥5.1.0 (era 4.9.0; atualizado em v1.22.0).
- **Pipeline:** `trades → onTradeCreated/Updated → (PL, compliance, emotional, maturity, mentor alerts)`. Qualquer mudança = análise de impacto em todos os downstream.
