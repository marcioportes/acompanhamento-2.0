# Firestore Schema — Collections

> Toda escrita em `trades` passa por `addTrade` (INV-02). Dados externos usam staging (INV-01). Criar collection/subcollection/campo novo exige INV-15 (aprovação com análise).

## Collections raiz

### `trades` (gateway único INV-02)
- **Escritor:** `addTrade` / `enrichTrade` / `editTradeAsMentor` / `lockTradeByMentor` / `unlockTradeByMentor` (`tradeGateway`)
- **CFs:** `onTradeCreated`, `onTradeUpdated`
- **Campo `_partials`:** array INLINE no documento (INV-12). **Não existe subcollection** `trades/{id}/partials`. Todo trade tem parciais (mínimo 1 ENTRY + 1 EXIT).
- **Lock comportamental do mentor (v1.45.0, INV-15):** 5 campos inline + metadata complementar — gateway grava; rules permitem só mentor tocar lock metadata; CFs admin SDK bypassam. Whitelist editável: `emotionEntry`, `emotionExit`, `setup` (campos factuais entry/exit/qty/result/stopLoss/side seguem fluxo normal).
  - `_lockedByMentor: boolean` — flag binária do lock.
  - `_lockedAt: Timestamp` — quando o lock foi aplicado.
  - `_lockedBy: { uid, email, name }` — autor do lock.
  - `_mentorEdits: array` (append-only) — cada entry `{ field, oldValue, newValue, editedAt, editedBy:{uid,email} }`. Preserva auditoria mesmo após unlock.
  - `_studentOriginal: { emotionEntry, emotionExit, setup, capturedAt }` — snapshot do que o aluno declarou. Gravado APENAS na 1ª edit do mentor; **imutável após** (não regrava em edits subsequentes).
  - `_unlockedAt: Timestamp` (opcional) — quando o lock foi removido.
  - `_unlockedBy: { uid, email, reason }` (opcional) — autor + motivo. Import preserva auditoria com `reason: 'import:<batchId>'` (DEC-AUTO-188-03 — broker > mentor; CF `onTradeUpdated` destrava server-side quando `importBatchId` muda).
- **Perfil comportamental consolidado (`behaviorProfile`, Fase 2 #301, INV-15 / DEC-AUTO-301-04):** campo INLINE (snapshot do motor `detectBehavior`) — `{ version, engineMeta, families[], gateInputs[], scoreContribution, computedAt, computedBy, resolution, orderCount, fingerprint }`. Escrita só por CFs (admin SDK) no recompute on-create/on-update + backfill; `fingerprint` evita write redundante (fora do guard de `onTradeUpdated` → não re-dispara). **Read mentor + aluno** (educativo). Supersede a renderização de `shadowBehavior`/execution patterns na UI; `shadowBehavior` segue escrito 1 ciclo (transição). Compliance (`redFlags`) permanece campo separado.
- **Espelho / auto-revisão (`selfReview`, #308, v1.75.0):** campo INLINE (não subcollection, DEC-AUTO-308-01) — `{ wouldRepeat: boolean, answers: { [questionId]: string }, createdAt, createdBy }`. Escrito pelo aluno dono via gateway `submitTradeReview` (INV-02). Rules: gravável só pelo dono, **isento do seal #259** (delta só `selfReview`+`updatedAt`), **imutável após** `status=DISCUSSED` (#269 v2). Quadrante e confronto declarado × detectado são derivados em display-time (não persistidos).
- **Revisão semanal — FK única (`reviewId` + `status`, #269 v2, v1.76.0):** modelo normalizado que substitui o efêmero `reviewState`/`draftReviewId`/`review.includedTradeIds` (todos REMOVIDOS).
  - `reviewId: string | null` — FK **imortal** para a revisão semanal (`students/{uid}/reviews/{id}`). `null` = backlog ("ainda não revisado"). Carimbada **uma vez** na 1ª transição `OPEN→REVIEWED` (1º feedback do mentor, individual ou bulk), via trigger `onTradeUpdated → getOrCreateOpenReview`. Nunca apagada (nem no publish). Pertencimento da pauta = `trades WHERE reviewId == id`.
  - `status` ganha terminal **`DISCUSSED`** (`OPEN → REVIEWED ⇄ QUESTION → CLOSED → (publicação) → DISCUSSED`). Imutável após DISCUSSED (rules + `onTradeUpdated` + `submitTradeReview`). A publicação (`publishReview`) força todos os membros a `DISCUSSED`.
  - **Filtro matriz (#269):** `reviewId` só é ancorado para aluno no escopo da Revisão = bucket `{alpha, trial-alpha}` (`classifyStudent` sobre subscriptions; `functions/_shared/studentClassify.js`). Espelho/VIP/sem-sub não geram revisão; `onTradeUpdated` pula a ancoragem e `useTrades` bloqueia o feedback do mentor.
- **Consumers:** `StudentDashboard`, `TradingCalendar`, `AccountStatement`, `FeedbackPage`, `PlanLedgerExtract`, `MentorDashboard`.

### `plans`
- Ciclos, `currentCycle`, state machine (IN_PROGRESS → GOAL_HIT/STOP_HIT → POST_GOAL/POST_STOP)
- **Escritor:** `updatePlan` (CHUNK-03) — strip do campo `pl` antes de gravar (C1 #259: PL imutável pós-criação)
- **Contratos C1-C5 #259** (1.64.0):
  - `pl` é capital alocado IMUTÁVEL após criação; única rota de mudança é `closeCycle` CF
  - **Sem `currentPl` persistido** — saldo derivado on-the-fly via `planBalance.computeCurrentPl(plan, trades) = pl + Σ trades_date > lastClosedCycleEnd` (C2). Campo legado pode aparecer em docs antigos (DT-AUTO-259-B); audit button reconstrói via filtro C2
  - `lastClosedCycleEnd` (ISO YYYY-MM-DD) — cache otimista pra hard seal; rules consultam pra bloquear writes
  - `sealedCycleRanges[]` — fonte canônica do hard seal (array de `{closureId, cycleStart, cycleEnd}`)
  - `lastCycleClosureId` — head da cadeia de closures; `reopenCycle` só aceita closure que bate com este campo
  - `currentCycleNumber` — incrementado a cada `closeCycle`; decrementado a cada `reopenCycle`

### `cycleClosures` (CHUNK-04/16, #259, v1.64.0)
- Documento imutável do ritual de fechamento — captura de aprendizado por ciclo.
- **ID determinístico:** `{planId}_{cycleKey}` (ex.: `abc_2026-04` mensal, `abc_2026-Q1` trimestral). Idempotência: re-criar = HttpsError('already-exists').
- **Escritor:** `closeCycle` CF (admin SDK bypassa rules). Rules: `allow read: isMentor() OR isOwner(studentId); allow write: false`.
- **Schema (schemaVersion=3):**
  - **Identidade:** `planId`, `studentId`, `accountId`, `cycleKey`, `cycleNumber`, `cycleStart`, `cycleEnd`
  - **Status:** `status: 'CLOSED'`, `closedAt`, `closedBy:{uid,email,role}`, `closeMode: 'self'|'demonstrated'|'co_edited'`
  - **Contrato C3:** `cycleBaseline:{plInicial, saldoFinal, plFinal}` (ground truth — lido na transaction do servidor)
  - **Contrato C4:** `preClosePlanSnapshot:{pl, riskPerOperation, rrTarget, cycleGoal, cycleStop, periodGoal, periodStop}` (foto pré-close pra reabertura restaurar)
  - **10 seções A-J:** `snapshot`, `metrics` (TPS/R/Kelly), `patterns` (eventCounts/correlation/stopBreach/dayBreakdown/executionEvents/unifiedErrors), `aar` (Q1-Q4 + attributions/denialFlag), `maturity` (gates/promotionEligible/regression), `swot` (strengths/weaknesses/opportunities/threats), `mentor` (closingComment/pendingFeedbackCount), `forward` (planAdjustment/aiSuggestion/kelly/mcSimulation/behavioralCommitments/nextReviewDate), `notes`
  - **Sinal crítico:** `behavioralSummary:{critical, denialFlag, severity, triggeredRule, notifyMentor, tilt/revenge/stopTampering counts, stopBreachIndex, pnlPctOfStop, ...}` — usado pelo mentor inbox pra priorizar
  - **Reopen:** `originalSnapshot`, `reopenedAt`, `reopenedBy`, `reopenReason` (nulos no close normal)
- **Composite indexes:** `(studentId, status)` pra queue do dashboard + `(status, closedAt)` pra inbox do mentor (janela 7d).

### `accounts`
- `currency`, `balance`, `broker`, `propFirm` (CHUNK-17)

### `emotions`
- Scoring -4..+3 normalizado 0-100, detecção TILT/REVENGE (CHUNK-06, `emotionalAnalysisV2`)

### `csvStagingTrades` (staging — INV-01)
- Parser CSV escreve aqui, **nunca** dispara CFs diretamente. Ingestão via `addTrade` após validação (CHUNK-07).

### `orders` (staging de ordens brutas)
- Parse ProfitChart-Pro, cross-check (CHUNK-10, `tradeGateway`)

### `reviews` (`students/{uid}/reviews/{id}`)
- Evento persistido (DEC-045) com `maturitySnapshot` congelado no fechamento (v1.43.0)
- Campos `meetingLink`/`videoLink` são **metadata operacional** (DEC-AUTO-197-01, v1.46.1) — editáveis por mentor em DRAFT e CLOSED via `useWeeklyReviews.updateMeetingLinks`. Não fazem parte do `frozenSnapshot`. ARCHIVED bloqueia.
- **#269 v2 (v1.76.0):** pertencimento = `trades WHERE reviewId == id` (acabou `includedTradeIds`). A revisão DRAFT **nasce sob demanda** no 1º feedback (`getOrCreateOpenReview`, idempotente via ponteiro `plan.activeDraftReviewId`); `source` ∈ `backlog`|`backfill`. `publishReview`: DRAFT→CLOSED + `sequenceNumber` + `frozenSnapshot` + marca membros `status=DISCUSSED` + limpa o ponteiro. Não há mais ação de UI "criar/descartar rascunho". Cascade: `deletePlanCascade`/`deleteAccountCascade` apagam as reviews do plano.
- **`plan.activeDraftReviewId: string | null`** (CHUNK-03, #269): ponteiro denormalizado da revisão DRAFT vigente do plano — lido por ID na transação do gateway (client não faz query). Setado em `getOrCreateOpenReview`, limpo no `publishReview`.
- **`mentorConfig/{mentorUid}.swotStyle`** (#262, v1.76.0): estilo do prompt da SWOT semanal (tom/foco/profundidade, neutro=2), global por mentor. Escrito por `setMentorSwotStyle`; consumido por `generateWeeklySwot` via `swotPromptBuilder`.

## Subcollections

### `students/{uid}/assessment/`
- `questionnaire`, `probing`, `initial_assessment` (CHUNK-09)
- Baseline 4D + stage diagnosticado pela IA (DEC-019..022)

### `students/{uid}/subscriptions/`
- `type`, `status`, `accessTier`, `payments` subcollection (DEC-055/056)
- Entidade dependente — nunca existe sem aluno. Queries mentor via `collectionGroup('subscriptions')`.

### `students/{uid}/maturity/` (v1.43.0)
- `current` — snapshot vivo recalculado por `onTradeCreated/Updated`
- `_historyBucket/history/{date}` — pontos temporais (DEC-AUTO-119-06)
- Campos: `dimensionScores`, `stageCurrent`, `gates`, `signalRegression`, `proposedTransition`, `aiNarrative`, `aiTrigger`

## Rules

- Default: `auth != null` (DEC-025)
- `students/{uid}/subscriptions/`: leitura só pelo próprio aluno + mentor
- `trades`: escrita só por `addTrade` (verificado via invariant `tradeWriteBoundary`)
