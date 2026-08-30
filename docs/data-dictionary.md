# Dicionário de dados — campos reais das collections

> Gerado de PRODUÇÃO por `scripts/gerar-dicionario-dados.mjs` em 30/08/2026.
> Regenerar antes de escrever qualquer regra que dependa de um campo.
>
> **A taxa de preenchimento é parte do contrato.** Campo que existe no schema e
> está vazio na base não sustenta regra: prescrever sobre ele é adivinhação com
> cara de análise.

### `trades` — 381 documentos

| campo | tipo | preenchido | exemplo |
|---|---|---|---|
| `behaviorProfile` | map | 381/381 (100%) |  |
| `entryTime` | string | 380/381 (100%) | 2026-04-27T15:05:00 |
| `ticker` | string | 380/381 (100%) | WINM26 |
| `side` | string | 380/381 (100%) | LONG |
| `entry` | number | 380/381 (100%) | 193605 |
| `exit` | number | 380/381 (100%) | 193370 |
| `qty` | number | 380/381 (100%) | 2 |
| `planId` | string | 380/381 (100%) | anhL0doKRm6Bg19nDQkv |
| `date` | string | 380/381 (100%) | 2026-04-27 |
| `duration` | number | 380/381 (100%) | 50 |
| `result` | number | 380/381 (100%) | -94 |
| `resultPercent` | number | 380/381 (100%) | -0.12138116267658375 |
| `studentEmail` | string | 380/381 (100%) | rafael_perilo@hotmail.com |
| `studentName` | string | 380/381 (100%) | Rafael Pirilo |
| `studentId` | string | 380/381 (100%) | GWYzCCHHZEML0ThpZZUxzt8bldy2 |
| `accountId` | string | 380/381 (100%) | MZZeyX7BoxfyszTaT2qD |
| `hasRedFlags` | boolean | 380/381 (100%) | false |
| `createdAt` | timestamp | 380/381 (100%) |  |
| `redFlags` | array | 380/381 (100%) |  |
| `feedbackDate` | string/timestamp | 380/381 (100%) | 2026-04-28T21:32:47.330Z |
| `mentorFeedback` | string | 380/381 (100%) | Não há problema em mudar o t |
| `feedbackHistory` | array | 380/381 (100%) |  |
| `status` | string | 380/381 (100%) | DISCUSSED |
| `updatedAt` | timestamp | 380/381 (100%) |  |
| `exitTime` | string | 378/381 (99%) | 2026-04-27T15:55:00 |
| `emotionEntry` | string | 377/381 (99%) | Calmo |
| `emotionExit` | string | 376/381 (99%) | Frustrado |
| `compliance` | map | 376/381 (99%) |  |
| `setup` | string | 372/381 (98%) | 4-Barras |
| `rrAssumed` | boolean | 369/381 (97%) | false |
| `tickerRule` | map | 367/381 (96%) |  |
| `hasPartials` | boolean | 367/381 (96%) | true |
| `resultCalculated` | number | 367/381 (96%) | -94 |
| `resultEdited` | boolean | 367/381 (96%) | false |
| `partialsCount` | number | 367/381 (96%) | 2 |
| `exchange` | string | 358/381 (94%) | B3 |
| `_partials` | array | 353/381 (93%) |  |
| `currency` | string | 334/381 (88%) | BRL |
| `entryDate` | string | 324/381 (85%) | 2026-04-27 |
| `exitDate` | string | 324/381 (85%) | 2026-04-27 |
| `htfUrl` | string | 324/381 (85%) | https://firebasestorage.goog |
| `resultInPoints` | number | 323/381 (85%) | -235 |
| `ltfUrl` | string | 323/381 (85%) | https://firebasestorage.goog |
| `riskPercent` | number | 323/381 (85%) | 0.3916242407072567 |
| `notes` | string | 320/381 (84%) | Barra 2 no HTF de 60min. Cis |
| `reviewId` | string | 320/381 (84%) | 2026-W18-1779822417265 |
| `stopLoss` | number | 282/381 (74%) | 193370 |
| `rrRatio` | number | 258/381 (68%) | 1.8461538461538463 |
| `selfReview` | map | 97/381 (25%) ⚠ raro |  |
| `importSource` | string | 94/381 (25%) ⚠ raro | csv |
| `importBatchId` | string | 94/381 (25%) ⚠ raro | csv_1774531083601_u2kg3r |
| `shadowBehavior` | map | 91/381 (24%) ⚠ raro |  |
| `totalQty` | number | 74/381 (19%) ⚠ raro | 2 |
| `avgEntry` | number | 74/381 (19%) ⚠ raro | 184675 |
| `avgExit` | number | 74/381 (19%) ⚠ raro | 185075 |
| `excursionSource` | string | 59/381 (15%) ⚠ raro | manual |
| `mentorClassificationFlags` | array | 56/381 (15%) ⚠ raro |  |
| `mentorClassifiedAt` | timestamp | 56/381 (15%) ⚠ raro |  |
| `mentorClassification` | string | 56/381 (15%) ⚠ raro | tecnico |
| `mentorClassifiedBy` | map | 56/381 (15%) ⚠ raro |  |
| `mepPrice` | number | 55/381 (14%) ⚠ raro | 5063.5 |
| `menPrice` | number | 54/381 (14%) ⚠ raro | 5071.5 |
| `resultOverride` | number | 50/381 (13%) ⚠ raro | -23 |
| `_mentorEdits` | array | 34/381 (9%) ⚠ raro |  |
| `_studentOriginal` | map | 34/381 (9%) ⚠ raro |  |
| `_lockedByMentor` | boolean | 34/381 (9%) ⚠ raro | true |
| `_lockedAt` | timestamp | 34/381 (9%) ⚠ raro |  |
| `_lockedBy` | map | 34/381 (9%) ⚠ raro |  |
| `mentorClassificationReason` | string | 32/381 (8%) ⚠ raro | PERFEITO. |
| `mepRaw` | string | 29/381 (8%) ⚠ raro | 5.5 |
| `menRaw` | string | 28/381 (7%) ⚠ raro | 2.5 |
| `mentorClearedViolations` | array | 21/381 (6%) ⚠ raro |  |
| `enrichedAt` | timestamp | 20/381 (5%) ⚠ raro |  |
| `_enrichmentSnapshot` | map | 20/381 (5%) ⚠ raro |  |
| `enrichedByImport` | boolean | 20/381 (5%) ⚠ raro | true |
| `source` | string | 13/381 (3%) ⚠ raro | order_import |
| `operationId` | string | 13/381 (3%) ⚠ raro | OP-002 |
| `lowResolution` | boolean | 13/381 (3%) ⚠ raro | false |
| `_migratedFrom` | string | 5/381 (1%) ⚠ raro | PENDING_REVIEW |
| `_migratedAt` | timestamp | 5/381 (1%) ⚠ raro |  |

### `plans` — 28 documentos

| campo | tipo | preenchido | exemplo |
|---|---|---|---|
| `name` | string | 28/28 (100%) | Day Trade |
| `description` | string | 28/28 (100%) | Day Trade |
| `accountId` | string | 28/28 (100%) | U3tDb7PDgO1UU5IgK0wU |
| `pl` | number | 28/28 (100%) | 100000 |
| `plPercent` | number | 28/28 (100%) | 0 |
| `rrTarget` | number | 28/28 (100%) | 2 |
| `adjustmentCycle` | string | 28/28 (100%) | Mensal |
| `cycleGoal` | number | 28/28 (100%) | 20 |
| `cycleStop` | number | 28/28 (100%) | 10 |
| `operationPeriod` | string | 28/28 (100%) | Diário |
| `periodGoal` | number | 28/28 (100%) | 1 |
| `periodStop` | number | 28/28 (100%) | 0.5 |
| `studentId` | string | 28/28 (100%) | 68vITe7SiugidhDU70dEYnSQgQ63 |
| `studentEmail` | string | 28/28 (100%) | gizele@bahrpapeis.com.br |
| `studentName` | string | 28/28 (100%) | Gizele Bahr |
| `active` | boolean | 28/28 (100%) | true |
| `createdAt` | timestamp | 28/28 (100%) |  |
| `riskPerOperation` | number | 28/28 (100%) | 0.5 |
| `updatedAt` | timestamp | 28/28 (100%) |  |
| `currentPl` | number | 20/28 (71%) | 100000 |
| `type` | string | 16/28 (57%) | Day Trade |
| `createdBy` | string | 12/28 (43%) | obuqcM55HVYPhPpRv2iDnNOZyhm1 |
| `createdByEmail` | string | 12/28 (43%) | wagnercosta.ag@gmail.com |
| `lastEditedByEmail` | string | 9/28 (32%) | marcio.portes@me.com |
| `lastEditedBy` | string | 9/28 (32%) | mentor |
| `lastEditedAt` | timestamp | 9/28 (32%) |  |
| `editHistory` | array | 9/28 (32%) |  |
| `activeDraftReviewId` | string | 9/28 (32%) | VAyaTsClzjIQ7Rc0yNyd |
| `lastClosedCycleEnd` | string | 6/28 (21%) ⚠ raro | 2026-06-30 |
| `lastCycleClosureId` | string | 6/28 (21%) ⚠ raro | 9xyjjDSbw5AFshjFaxK2_2026-06 |
| `sealedCycleRanges` | array | 6/28 (21%) ⚠ raro |  |
| `currentCycleNumber` | number | 6/28 (21%) ⚠ raro | 3 |
| `_repairedByIssue183At` | timestamp | 1/28 (4%) ⚠ raro |  |
| `_repairedByIssue183PreviousStudentEmail` | string | 1/28 (4%) ⚠ raro | marcio.portes@me.com |
| `_repairedByIssue183PreviousStudentId` | string | 1/28 (4%) ⚠ raro | VVoAP2196TZuvLlDbmTWK75VlAm1 |

### `accounts` — 28 documentos

| campo | tipo | preenchido | exemplo |
|---|---|---|---|
| `name` | string | 28/28 (100%) | Zero7 |
| `broker` | string | 28/28 (100%) | Zero 7 |
| `currency` | string | 28/28 (100%) | BRL |
| `type` | string | 28/28 (100%) | PROP |
| `isReal` | boolean | 28/28 (100%) | true |
| `initialBalance` | number | 28/28 (100%) | 1997 |
| `studentId` | string | 28/28 (100%) | TXNrE2gXlSgJsb3i2VvSvgsU9H52 |
| `studentEmail` | string | 28/28 (100%) | rafa.cerque@gmail.com |
| `studentName` | string | 28/28 (100%) | Rafael Cerqueira "Sael" |
| `active` | boolean | 28/28 (100%) | true |
| `createdAt` | timestamp/string | 28/28 (100%) | 2026-05-28 |
| `currentBalance` | number | 28/28 (100%) | 4012 |
| `updatedAt` | timestamp | 28/28 (100%) |  |
| `brokerName` | string | 15/28 (54%) | Apex Trader Funding |
| `propFirm` | map | 3/28 (11%) ⚠ raro |  |

### `reviews (collectionGroup)` — 32 documentos

| campo | tipo | preenchido | exemplo |
|---|---|---|---|
| `studentId` | string | 32/32 (100%) | 41DhjbwvLNeTZzxTqCILVNITRdL2 |
| `planId` | string | 32/32 (100%) | BWzYZ1pewZPkEs7vs5lj |
| `weekStart` | string | 32/32 (100%) | 2026-08-12 |
| `createdBy` | string | 32/32 (100%) | system:feedback |
| `createdAt` | timestamp | 32/32 (100%) |  |
| `weekEnd` | string | 32/32 (100%) | 2026-08-20 |
| `status` | string | 32/32 (100%) | CLOSED |
| `sessionNotes` | string | 24/32 (75%) | [19/08 14:18 MNQ -314.00] Op |
| `frozenSnapshot` | map | 24/32 (75%) |  |
| `source` | string | 23/32 (72%) | backlog |
| `sequenceNumber` | number | 23/32 (72%) | 8 |
| `closedAt` | timestamp | 23/32 (72%) |  |
| `swot` | map | 21/32 (66%) |  |
| `takeawayItems` | array | 19/32 (59%) |  |
| `periodStart` | string | 16/32 (50%) | 2026-08-12 |
| `periodEnd` | string | 16/32 (50%) | 2026-08-20 |
| `updatedAt` | timestamp | 11/32 (34%) |  |
| `videoLink` | string | 10/32 (31%) | https://www.youtube.com/live |
| `periodKey` | string | 9/32 (28%) ⚠ raro | 2026-W16 |
| `includedTradeIds` | array | 9/32 (28%) ⚠ raro |  |
| `cycleKey` | string | 6/32 (19%) ⚠ raro | 2026-04-01 |
| `alunoDoneIds` | array | 6/32 (19%) ⚠ raro |  |
| `meetingLink` | string | 3/32 (9%) ⚠ raro | https://us02web.zoom.us/j/89 |
| `archivedAt` | timestamp | 1/32 (3%) ⚠ raro |  |
| `customPeriod` | — | 0/32 (0%) ⚠ **sempre vazio** |  |

### `subscriptions (collectionGroup)` — 63 documentos

| campo | tipo | preenchido | exemplo |
|---|---|---|---|
| `type` | string | 63/63 (100%) | paid |
| `plan` | string | 63/63 (100%) | self_service |
| `startDate` | timestamp | 63/63 (100%) |  |
| `createdAt` | timestamp | 63/63 (100%) |  |
| `status` | string | 63/63 (100%) | cancelled |
| `updatedAt` | timestamp | 63/63 (100%) |  |
| `endDate` | timestamp | 50/63 (79%) |  |
| `renewalDate` | timestamp | 50/63 (79%) |  |
| `amount` | number | 49/63 (78%) | 1200 |
| `currency` | string | 49/63 (78%) | BRL |
| `gracePeriodDays` | number | 49/63 (78%) | 5 |
| `billingPeriodMonths` | number | 49/63 (78%) | 3 |
| `lastPaymentDate` | timestamp | 48/63 (76%) |  |
| `notes` | string | 47/63 (75%) | Backfill onetime #237 |
| `whatsappState` | string | 29/63 (46%) | talking |
| `inFollowUp` | boolean | 28/63 (44%) | false |
| `receiptUrl` | string | 9/63 (14%) ⚠ raro | https://firebasestorage.goog |
| `trialEndsAt` | timestamp | 2/63 (3%) ⚠ raro |  |

---

## Projeções (shape DIFERENTE do documento de origem)

`review.frozenSnapshot.periodTrades` **não é o trade**: é a projeção de
`weeklyReviewSnapshot.projectTrade`, com nomes próprios e campos ausentes.
Alimentar um motor com ela sem adaptar faz o trade ser descartado em silêncio.

### `frozenSnapshot.periodTrades` — 193 documentos

| campo | tipo | preenchido | exemplo |
|---|---|---|---|
| `tradeId` | string | 193/193 (100%) | E7afRxmMA1DX5nIdyPJM |
| `symbol` | string | 193/193 (100%) | MNQ |
| `side` | string | 193/193 (100%) | SHORT |
| `pnl` | number | 193/193 (100%) | -300 |
| `qty` | number | 193/193 (100%) | 2 |
| `entryTime` | string | 193/193 (100%) | 2026-08-12T09:57:00-04:00 |
| `closeTime` | string | 193/193 (100%) | 2026-08-12T10:24:00-04:00 |
| `emotionEntry` | string | 190/193 (98%) | Confiante |
| `emotionExit` | string | 189/193 (98%) | Neutro |
| `setup` | string | 185/193 (96%) | 4-Barras |
| `entry` | number | 185/193 (96%) | 29864.75 |
| `stopLoss` | number | 155/193 (80%) | 29954.25 |
| `selfReview` | map | 66/193 (34%) |  |
| `excursionSource` | string | 34/193 (18%) ⚠ raro | yahoo |
| `mepPrice` | number | 31/193 (16%) ⚠ raro | 29848.25 |
| `menPrice` | number | 30/193 (16%) ⚠ raro | 29937 |
