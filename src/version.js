/**
 * version.js — Single Source of Truth
 * @description Versão do produto Acompanhamento 2.0
 *
 * CHANGELOG:
* - 1.49.1: #210 chore remover campo takeaways (string) — tratar apenas takeawayItems[] (PR #211, 30/04/2026)
 * - 1.49.1: chore: remover campo `takeaways` (string) — tratar apenas `takeawayItems[]` (issue #210).
 *   Após Stage 4 (#102, `b11e73bf`), a collection `students/{uid}/reviews/{rid}` ficou com dois
 *   campos paralelos representando takeaways: `takeaways` (string legacy) e `takeawayItems[]`
 *   (array canônico). Migração nunca concluída — `ReviewToolsPanel` (Extrato) e
 *   `WeeklyReviewModal` continuavam escrevendo no string; `StudentReviewsPage` renderizava o
 *   string como bloco isolado acima do checklist; `WeeklyReviewPage` tinha fallback de leitura
 *   do string como `sessionNotes`. Decisão: canonizar `takeawayItems[]` e remover o string do
 *   código. Conteúdo legado em prod fica órfão (não migrado). [RESERVADA — entrada definitiva
 *   no encerramento.]
* - 1.49.0: #208 feat sensor comportamental de execução (5 detectores + gates 3→4) (PR #209, 30/04/2026)
 * - 1.49.0: feat: sensor comportamental de execução — Order Import como input de tilt/revenge no 4D
 *   (issue #208). Pipeline atual descarta cancels em `orderReconstruction.js:99-100` e
 *   `orderCorrelation.js:234`; correlator 1:1 quebra com bracket OCO (gera "ghost orders" falsos).
 *   Entrega em 7 fases: (1) correlator N:1; (2) `executionBehaviorEngine.js` com 5 detectores
 *   (STOP_TAMPERING, STOP_PARTIAL_SIZING, RAPID_REENTRY_POST_STOP, HESITATION_PRE_ENTRY, CHASE_REENTRY);
 *   (3) integração em `emotionalAnalysisV2` via `EVENT_PENALTIES` + `executionEvents` em detectTilt/Revenge;
 *   (4) gates Stage 3→4 condicionais (`no-stop-tampering`, `no-chase`, `disciplined-sizing`) — pattern
 *   DEC-AUTO-187-03 (`null` quando sample insuficiente, não promove e não rebaixa); (5) persistência
 *   Opção C (compute on-the-fly, sem schema novo, INV-15 não acionada); (6) UI mínima TradeDetailModal +
 *   MaturityProgressionCard; (7) encerramento. Fundamento: Kahneman&Tversky 1979, Shefrin&Statman 1985,
 *   Coval&Shumway 2005, Barber&Odean 2000 (já em DEC-048). [RESERVADA — entrada definitiva no encerramento.]
 * - 1.48.0: feat: coleta de MEP/MEN (Maximum Excursion Positiva/Negativa) — fundação para
 *   gate Stage 3→4 do motor de maturidade (#119). Schema novo em `trades`: `mepPrice` /
 *   `menPrice` (preço puro, DEC-AUTO-187-01) + `excursionSource` (manual/profitpro/yahoo/
 *   unavailable). `tradeGateway.validateExcursionPrices` valida por lado (LONG: mep >= max,
 *   men <= min; SHORT inverte). `preComputeShapes.deriveAdvancedMetricsPresent` substitui
 *   stub literal `false` por null/true — NUNCA `false` (DEC-AUTO-187-03/04: ≥10 trades +
 *   ≥80% com mep+men → true; senão null = METRIC_UNAVAILABLE no evaluateGates, não bloqueia).
 *   Form manual no AddTradeModal. Parser ProfitPro via novo `excursionParsing.js` (futures
 *   pontos / equity %), wired em csvMapper.SYSTEM_FIELDS (mepRaw/menRaw → mepPrice/menPrice).
 *   Loader Yahoo Finance 1m em novo namespace `functions/marketData/`: symbolMapper (12
 *   contratos CME), fetchYahooBars (free tier, janela 7d, retry 5xx), computeExcursionFromBars
 *   (LONG max/min, SHORT inverte), CF callable enrichTradeWithExcursions (compute&discard,
 *   idempotente). Trigger async `onTradeCreatedAutoEnrich` desacoplado, falha silenciosa.
 *   Sharpe + Tradovate Trade Performance Report defer. Suite 2533 → 2640 (+107). DEC-AUTO-187-01..04
 *   em `docs/decisions.md`. PR _pendente_.
 * - 1.46.1: fix: salvar/atualizar link de reunião e gravação na revisão semanal pós-publicação
 *   (issue #197, PR #198 squash `af9662b0`). Mentor publicava revisão (CLOSED) e ficava preso:
 *   `meetingLink`/`videoLink` editáveis só em DRAFT — caminho real impossível porque link da
 *   gravação só existe DEPOIS da reunião terminar, depois de publicar. Fix em 4 fases:
 *   (B) novo `useWeeklyReviews.updateMeetingLinks(reviewId, {meetingLink, videoLink})` faz
 *   `updateDoc` parcial sem mudar status; valida via `validateReviewUrl` antes de gravar;
 *   aceita parcial (`undefined` preservado); ambos `undefined` = no-op defensivo.
 *   (A) `WeeklyReviewPage` ganha Subitem 3 "Reunião" entre Notas (2) e Snapshot (4) —
 *   renumeração visível 3→9; `MeetingLinksSection` inline (padrão dos siblings).
 *   (C) `ReviewToolsPanel` (Extrato) e `WeeklyReviewModal` tab "Reunião": novo botão dedicado
 *   "Salvar links" liberado em CLOSED, separado do "Salvar rascunho" (que segue exclusivo de
 *   DRAFT cobrindo takeaways/sessionNotes). Tri-superficial consistente.
 *   (G) Escopo expandido descoberto durante smoke: `ReviewQueuePage` filtrava só alunos com
 *   DRAFT — sem caminho para reabrir CLOSED. Refatorado em `StudentStatusProbe` genérico +
 *   `closedCounts` paralelo + toggle "Incluir publicadas" (default OFF, preserva intent
 *   original como fila de working items); copy do header/empty state condicional.
 *   `firestore.rules` sem alteração (linhas 65-71 já cobriam mentor CLOSED→CLOSED). Sem campo
 *   Firestore novo (INV-15 não acionada — campos aprovados em #102/v1.33.0). DEC-AUTO-197-01:
 *   campos são metadata operacional (não congelam em `frozenSnapshot`), editáveis em
 *   DRAFT/CLOSED por mentor; ARCHIVED bloqueia. 7 testes novos (DRAFT/CLOSED felizes, strings
 *   vazias, URL inválida, host fora allowlist, no-op defensivo, parcial, erro `updateDoc`).
 *   Suite 2489/2489 (baseline 2438 + 7 + 44 contagem refresh). Validado em browser local.
 * - 1.46.0: feat: score emocional real no motor de maturidade (issue #189) — substitui stub
 *   `{ periodScore: 50, tiltCount: 0, revengeCount: 0 }` em `functions/maturity/preComputeShapes.js:129`
 *   (DEC-AUTO-119-task07-02 declarava como TODO) por mirror CommonJS de
 *   `emotionalAnalysisV2.calculatePeriodScore` + `detectTiltV2` + `detectRevengeV2`. Fórmula
 *   DEC-AUTO-119-03 inalterada (`E = 0.60·periodScore + 0.25·invTilt + 0.15·invRevenge`).
 *   Janela STAGE_WINDOWS rolling (D1) e política "evolução sempre visível" (D6) preservadas.
 *   Mirror em `functions/maturity/emotionalAnalysisMirror.js` (CommonJS, paridade ESM↔CJS
 *   testada) com `calculatePeriodScore` + `detectTiltV2` + `detectRevengeV2` +
 *   `buildGetEmotionConfig` (replica `useMasterData.getEmotionConfig`). Os 5 gates
 *   emocionais do framework (`emotional-out-of-fragile`, `-55`, `-75`, `-85`,
 *   `zero-tilt-revenge`) passam a discriminar — antes travados em E=50. Suite 2438/2438
 *   (baseline 2421 + 17 novos). Validado em browser (PR #196).
 * - 1.45.0: feat: FeedbackPage mentor edit+lock+recalc + MentorDashboard currency multi-moeda +
 *   PlanSummaryCard + StudentDashboard cards respeitam ContextBar sem exceção (issue #188, Sev1).
 *   Entrega em 8 fases A-H pair programming fast-track.
 *   F2: aggregateTradesByCurrency + MultiCurrencyAmount; P&L Turma/ranking/lista alunos/detalhe
 *   aluno agregam por moeda sem somar cross-currency; pending list + bulk modal usam
 *   formatCurrencyDynamic(result, trade.currency). FX conversion fora (DEC-AUTO-188-05).
 *   F3: PlanSummaryCard colapsável (RO/RR/Cap/Bloqueadas/Ciclo X-N) na coluna esquerda do
 *   FeedbackPage em ambos modos. usePlans/useAccounts com overrideStudentId=trade.studentId.
 *   Smoke-test polish: fontes -1pt, RO/Período/Ciclo Meta+Stop exibem valor absoluto da moeda.
 *   F4: useDashboardMetrics aceita context{accountId,planId,cycleKey,periodRange}; TODOS os
 *   cards do StudentDashboard obedecem à ContextBar sem exceção (DEC-AUTO-188-06).
 *   filters.period legado removido. PendingTakeaways filtra por planId do contexto.
 *   Tooltips em todos os KPIs/quadrantes da Matriz Emocional 4D com fórmulas calculadas.
 *   F1 (Sev1 core): INV-15 aplicada. 5 campos novos em trades — _lockedByMentor, _lockedAt,
 *   _lockedBy, _mentorEdits[] (append-only), _studentOriginal (imutável após 1ª edit).
 *   Gateway expõe editTradeAsMentor/lockTradeByMentor/unlockTradeByMentor (INV-02).
 *   firestore.rules: ownership + lock dos 3 campos quando _lockedByMentor=true + metadata
 *   guard (só mentor toca campos de lock; CFs bypassam). onTradeUpdated.complianceFields agora
 *   inclui emotionEntry — fix bug pré-existente onde BLOCKED_EMOTION ficava estale. UI:
 *   MentorEditPanel (3 selects + reverter ao original + confirmação modal + travar),
 *   TradeLockBadge no header, ícone Lock inline na ExtractTable, bloco "Histórico de correções"
 *   no TradeDetailModal, asterisco âmbar com tooltip nos campos corrigidos. Import (CSV/Order)
 *   destrava lock server-side via CF onTradeUpdated quando importBatchId muda (DEC-AUTO-188-03 —
 *   broker é fonte de verdade superior ao mentor). 2445/2445 testes (+44 novos).
 * - 1.44.1: fix: Aderência recente (últimos N trades) no gate compliance-100 do stage
 *   Profissional (issue #191). Antes: `complianceRate100 = complianceRate` (alias do
 *   cálculo da janela total — semanticamente errado). Agora: novo helper puro
 *   `computeCycleBasedComplianceRate({trades, plans, now, minTrades=20})` aplica a
 *   janela = união dos ciclos ativos do trader (todos os planos pelo `adjustmentCycle`
 *   Mensal/Trimestral/Semestral/Anual). Mínimo 20 trades fechados; se não atinge,
 *   retrocede simultaneamente 1 ciclo em cada plano até bater 20 ou esgotar histórico
 *   (cap defensivo `MAX_LOOKBACK_CYCLES=36` ou iteração que não acrescenta nada).
 *   Insuficiente (`<20` mesmo após esgotar) → retorna `null` → `evaluateGates` marca o
 *   gate como `METRIC_UNAVAILABLE` (pendente, não promove e não rebaixa — DEC-020
 *   preservada). Mirror espelhado em `functions/maturity/` (CommonJS) e
 *   `src/utils/maturityEngine/` (ESM); `preComputeShapes.js` agora aceita `now` e
 *   `recomputeMaturity.js` repassa. 20 testes novos cobrindo cenários A-E + invariantes
 *   (datas BR/ISO/Date, dedup por id em planos sobrepostos, defaults, trimestral,
 *   minTrades customizável). DEC-AUTO-191-01/-02. Suite: 2421/2421 passando.
 * - 1.43.1: fix: Plano criado por mentor não é visível pelo aluno (issue #183, Sev1) —
 *   `usePlans.addPlan` hardcodava `studentId: user.uid` mesmo quando o criador era
 *   o mentor atuando em nome do aluno. Plano ficava gravado com UID do mentor e o
 *   aluno (filtro `where studentId == own.uid`) nunca enxergava. Fix: prioridade
 *   do dono agora é `planData.studentId > overrideStudentId > user.uid`; campos
 *   `studentEmail`/`studentName` herdam do `planData`; ausentes e criador != dono
 *   ficam `null` (não vaza email do mentor); novo campo `createdBy`/`createdByEmail`
 *   para audit. `AccountsPage` ganha wrapper `handleCreatePlanForSelectedAccount`
 *   que propaga `studentId/Email/Name` de `account` para `addPlan`. Script run-once
 *   `scripts/issue-183-repair-orphan-plans.mjs` (REMAP via `account.studentId`
 *   com cascade em trades; dry-run default, `--execute --confirm=SIM` exige dupla
 *   confirmação) — 2 planos órfãos em prod remapeados (commits `_repairedByIssue183*`
 *   no doc para auditoria/rollback). 5 testes novos (1895/1895 total).
 * - 1.44.0: feat: Motor de progressão Maturidade 4D × 5 estágios (issue #119, PR #192) —
 *   entrega consolidada das 28 tasks (6 fases A-F + 2 fases escopo adicional H/I/J).
 *   Engine puro determinístico de avaliação de gates × stage (evaluateGates /
 *   calculateStageScores / proposeStageTransition), persistência `students/{uid}/maturity/
 *   {current|_historyBucket/history/{date}}` via CF onTradeCreated/onTradeUpdated +
 *   close de revisão semanal + pós-onboarding. Callable `recomputeStudentMaturity`
 *   single-point com rate limit 5min por caller + countdown MM:SS no botão. IA Sonnet 4.6
 *   (classifyMaturityProgression) gera narrativas UP / REGRESSION / ONBOARDING_INITIAL
 *   com cache policy. UI aluno: MaturityProgressionCard com gates + botão Atualizar agora;
 *   StudentReviewsPage espelho READ-ONLY do mentor (KPIs com delta, trades com link
 *   Feedback, takeaways checklist + texto livre, comparativo maturidade 4D, notas,
 *   seção Reunião com links meetingLink/videoLink); dashboard "Takeaways abertos"; rota
 *   sidebar Revisões. UI mentor (Torre): MaturitySemaphoreBadge, MentorMaturityAlert
 *   expandível, botão Atualizar agora. Labels PT-BR: Caos · Reativo · Metódico ·
 *   Profissional · Maestria. DEC-020 respeitada (stage nunca regride abaixo do baseline
 *   do assessment). Reservada originalmente como 1.43.0; bump mecânico para 1.44.0 após
 *   #183 consumir 1.43.1 antes do merge. Follow-ups auditados: #184, #185, #187, #189,
 *   #190, #191.
 * - 1.42.1: fix: wire setupsMeta em MentorDashboard (issue #174, PR #175, merge commit
 *   `d871fad2`). Completa o E4 da spec original do #170 ("Consumido em StudentDashboard
 *   e MentorDashboard") cortado por conveniência durante o merge do #170 sem discussão.
 *   Novo util puro `src/utils/setupsFilter.js` com `filterSetupsForStudent(setups,
 *   studentId)` — retorna globais + pessoais do aluno; isolamento estrito (setup de
 *   aluno X não vaza para aluno Y). MentorDashboard importa `useSetups`, memoiza
 *   `filterSetupsForStudent(allSetups, selectedStudent?.studentId)` e passa
 *   `setupsMeta={selectedStudentSetups}` ao `<SetupAnalysis>`. Aderência RR agora
 *   renderiza na visão do mentor quando aluno tem setups com `targetRR`. 10 testes
 *   unitários do filtro (defensivo + isolamento + edges). Memória operacional registrada
 *   `feedback_spec_scope_respeito.md` — cortes de escopo declarados em spec NUNCA sem
 *   discutir. 1890/1890 testes (baseline 1880 + 10 novos).
 * - 1.42.0: feat: SetupAnalysis V2 — KPIs operacionais por setup (issue #170, PR #173,
 *   merge commit `15a6dca3`). Substitui `SetupAnalysis.jsx` (barra proporcional + WR)
 *   por card de diagnóstico com 4 KPIs em grid 2×2 (EV por trade, Payoff avgWin/|avgLoss|,
 *   ΔT W vs L com semáforo ±20%/±10% + tempos brutos, Contribuição ao EV total). Aderência
 *   RR condicional (linha renderizada apenas quando `setups.targetRR` existe — banda
 *   [target×0.8, target×1.2]). Sparkline 6m (PL acumulado mensal, mesmo visual da
 *   Matriz 4D). Insight 1-linha (ofensor contribEV<-20% → best performer payoff≥1.5 →
 *   aderência RR<50% → fallback positivo). Ordenação por |contribEV| desc; setups com
 *   n<3 em accordion "Esporádicos (N)" colapsado (expandido por default quando nenhum
 *   atinge n≥3). Util puro novo `src/utils/setupAnalysisV2.js` (245 linhas, zero campo
 *   Firestore novo). API externa preservada (prop `trades`) + prop opcional `setupsMeta`.
 *   Consumido em `StudentDashboard` via `useSetups` já presente. MentorDashboard sem
 *   setupsMeta (não filtra por student — fast-follow). DebugBadge mantido (INV-04).
 *   Fast-fix de overflow no card (header em 2 linhas, truncate, sublabels curtos,
 *   tempos `Xm` em vez de `Xmin`) aplicado no commit `0bffe1f1` antes do merge.
 *   1880/1880 testes (+40 novos: 23 util + 17 render).
 * - 1.41.0: feat: Ajustes Dashboard Aluno (issue #164, Sev2) — E1 SWOT reaproveita
 *   `review.swot` da última review CLOSED + fallback "aguardando revisão semanal";
 *   E2 card "Consistência Operacional" (CV P&L com semáforo DEC-050 + ΔT W/L com
 *   semáforo ±20%/±10%) substitui "Consistência" RR Asymmetry e Tempo Médio isolado;
 *   E3 Matriz Emocional 4D Opção A (expectância + payoff + shift rate entry→exit +
 *   Δ WR vs baseline + sparkline PL); E5 EquityCurve com tabs por moeda quando
 *   contexto agrega ≥2 moedas + curva ideal do plano (meta/stop linear pelos dias
 *   corridos do ciclo, planId único). [RESERVADA — entrada definitiva no encerramento.]
 * - 1.40.0: fix: Botão "Finalizar" travado na conclusão do aprofundamento (issue #166, Sev1) —
 *   loading state + disabled + try/catch no onClick de ProbingQuestionsFlow; fromStatus='probing'
 *   explícito em completeProbing (elimina stale closure); DebugBadge component= corrigido (INV-04).
 * - 1.38.1: hotfix: `assessmentStudentId is not defined` em StudentDashboard.jsx:362 (#162) — SEV1.
 *   Prop `studentId` de `<PendingTakeaways>` referenciava identificador inexistente no escopo de
 *   `StudentDashboardBody`, quebrando render do dashboard do aluno em produção (ReferenceError
 *   introduzido pelo merge PR #160 / commit `30af3a18`). Fix: substituir por `overrideStudentId ||
 *   user?.uid`, padrão canônico da linha 558 e dos hooks irmãos (`useTrades`, `useAccounts`,
 *   `usePlans`). [RESERVADA — entrada definitiva no encerramento.]
 * - 1.38.0: feat: Revisão Semanal v2 (#102) — entrega consolidada da tela nova `WeeklyReviewPage`
 *   com 8 subitens (Trades com day-grouping, Notas da sessão, 8 KPIs com tooltip inline, SWOT IA
 *   4 quadrantes, Takeaways checklist, Ranking top/bottom, Maturidade 4D, Navegação contextual)
 *   + Action Footer Publicar/Arquivar. Coexiste com PlanLedgerExtract 3-col baseline preservado.
 *   **Carry-over de takeaways** `!done` entre revisões do mesmo plano (badge `↻ anterior`).
 *   **PendingTakeaways** no dashboard do aluno (novo campo `alunoDoneIds` via arrayUnion em CLOSED,
 *   badge `aluno ✓` amber visível pro mentor). **PendingReviewsCard** trigger secundário G8 no
 *   MentorDashboard. **Rules**: aluno pode mutar apenas `alunoDoneIds` quando status=CLOSED via
 *   `affectedKeys().hasOnly([...])`, deployada via PR #157. PR #160 squash merged `30af3a18`.
 *   Bugfixes: hijack viewingAsStudent→StudentDashboard movido para depois do check
 *   currentView==='onboarding'; retorno contextual ledger/feedback; closeReview preserva campos
 *   não-passados (undefined-check). DEC-084/085. Issue #159 criado como QA tracker. 1727/1727 testes.
 * - 1.37.0: arch: Import Orders staging conversacional obrigatório + fix bypass #93 (issue #156) —
 *   5 fases consolidadas: (A) shadow writer bypass removido, hook useShadowAnalysis invoca CF canônica
 *   analyzeShadowBehavior + invariante tradeWriteBoundary; (B) schema classificação persistente em
 *   ordersStagingArea (match_confident/ambiguous/new/autoliq/discarded) + autoLiqDetector; (C) UX
 *   conversacional por operação via ConversationalOpCard (substitui auto-create #93) + AutoLiqBadge
 *   + gate de plano retroativo; (D) reconstrução robusta — segmentação por instrument (caso ABR-17
 *   bust day MNQ+NQ) + agregação N×M fills (caso FEV-12 fill explodido) + detecção de gap temporal
 *   60min; (E) enrichment sem duplicata — helper puro conversationalIngest, AdjustmentModal com diff
 *   fino campo-a-campo, persist discarded em orders via fingerprint; (F) wire onRequestRetroactivePlan
 *   em App/StudentDashboard/AccountsPage fechando o gate (banner → fecha modal → navega para
 *   AccountDetailPage da conta → PlanManagementModal abre via _autoOpenPlanModal, padrão #154).
 *   DT-038 (3 camadas do trade cancelada) e DT-039 (writers legados GRANDFATHERED) rastreadas.
 *   Invariante tradeWriteBoundary verde, zero regressão.
 * - 1.36.0: fix: Card de conta ganha botão "Novo plano" (#154) — atalho no card (AccountsPage visão aluno + StudentAccountGroup visão mentor) passa flag _autoOpenPlanModal para AccountDetailPage, que abre PlanManagementModal via useEffect. Preserva "casa do pai" (modal mora em AccountDetailPage, card só chama). Resolve workaround crítico: hoje aluno precisava criar conta Mesa → reverter para Real → corrigir plano.
 * - 1.34.0: fix: Botão Novo Plano inacessível (#146) — mover criação de plano de DashboardHeader para AccountDetailPage, limpar state órfão no StudentDashboard.
 * - 1.33.0: feat: Revisão Semanal (#102) — PlanLedgerExtract fundação + collection reviews + CF createWeeklyReview + CF generateWeeklySwot + WeeklyReviewModal + integração mentor/aluno. Inclui JAQUE: fix badge REVENGE/TILT vazando para trades do mesmo dia (match estrito por tradeId em ExtractTable, tradeIdsAfter em detectRevengeV2 RAPID_SEQUENCE, helper extractInlineEvents com 12 testes). [RESERVADO]
 * - 1.32.0: arch: Pagina dedicada Mesa Prop — redesign 4 zonas (#145) — Fases A-B extrair PropAccountCard/AlertsBanner/PayoutTracker do StudentDashboard para PropFirmPage + novo item condicional Sidebar + ContextBar governa pagina. Fase C fix attack plan phase-aware (PA/SIM_FUNDED/LIVE usam fundedDrawdown). Fase D remove AI Approach Plan da pagina (migra para #148 com gate 4D+30 shadow trades) + reset CF phase-aware para main. Fase E useDrawdownHistory MAX_DOCS 100->1000 + prop limit configuravel (suporta equity curve em conta com 500+ trades). Fase F decomposicao em 4 zonas semanticas (status agora / retrospectivo / contrato da mesa / payout) + novos componentes PropEquityCurve (Recharts) + TemplateCard + PlanoMecanicoCard + PropViabilityBadge (6 estados phase-aware) + PropHistoricalKPIs. Fase G renomear "Simulador de Saque" -> "Quando posso sacar?" (linguagem de decisao). Fase H fix 4 bugs phase-aware (dias operados denominador, dailyLossLimit null-safety, ViabilityBadge Infinity, prazo avaliacao condicional). Hotfix #149 cancelada (phase missing era bug de branch, nao de prod). 17 testes novos, 1567/1567 passando (inclui suite #102 mergeada). Spec Review Gate INV-18 iteracao 3.
 * - 1.31.0: feat: Order Import Tradovate Orders (#142) — parser parseTradovateOrders + FORMAT_REGISTRY extensivel em orderParsers.js + auto-detect ProfitChart vs Tradovate por header signature + remove gatekeep hardcoded em OrderImportPage.jsx + deteccao multi-delimitador (; e ,). Shape canonico identico entre parsers — downstream (normalize/validate/reconstruct/correlate) inalterado. Mapas EN inline (STATUS/SIDE/TYPE com trim de leading space), datas US (MM/DD/YYYY HH:MM:SS) via parseDateTime, numeros US (Papa quote-aware lida com thousands). 19 testes novos (2 Fase A + 17 Fase B), fixtures reais april/feb 2026 conta Apex. Validado em browser.
 * - 1.30.0: arch: Barra de Contexto Unificado (#118) — StudentContextProvider com Conta > Plano > Ciclo > Período persistido em localStorage versionado por aluno (E1/E5), cycleResolver puro (detectActiveCycle por datas E3, getDefaultContext conta com plano mais recente E2, períodos predefinidos CYCLE/WEEK/MONTH E4), ContextBar com 4 dropdowns encadeados + opção "Todas as contas" + badge read-only para ciclos finalizados, refactor StudentDashboard com sincronização bidirecional filters↔contexto. Adaptador temporário para PropAccountCard/Banner/Tracker (#134, CHUNK-17 liberado após merge #133 — migração em sessão subsequente). 46 testes novos, zero regressão
 * - 1.29.0: feat: AI Approach Plan Sonnet 4.6 (#133 — epic #52 Fase 2.5) — CF callable generatePropFirmApproachPlan gera narrativa estrategica sobre o plano deterministico (approach, execution, 4 cenarios, guidance comportamental, milestones), validacao pos-processamento com coerencia mecanica (Dia ideal === +dailyGoal, Dia ruim === -dailyStop) e read-only enforcement em numeros deterministicos, retry 3x com self-correction, fallback deterministico sem consumo de cota em falhas, rate limit 5 geracoes/conta (reset manual pelo mentor), seção colapsável no PropAccountCard existente com contador/badge/aviso cenario defaults, 24 testes novos em propFirmAiValidate
 * - 1.28.0: feat: Shadow Behavior Analysis (#129) — engine 13 padroes deterministicos em 2 camadas (parciais + ordens), 3 niveis de resolucao (LOW/MEDIUM/HIGH), CF callable analyzeShadowBehavior, ShadowBehaviorPanel mentor-only consumido em TradeDetailModal + FeedbackPage, integracao pos-import, 57 testes novos
 * - 1.27.0: feat: Prop Firm Dashboard (#134) — PropAccountCard com gauges (DD, profit/target, eval countdown, daily P&L), PropAlertsBanner persistente 3 níveis (danger/warning/info), sparkline drawdownHistory, tempo médio de trades universal no MetricsCards, PropPayoutTracker (qualifying days, eligibility checklist, simulador de saque, histórico de withdrawals), hooks useDrawdownHistory e useMovements, lógica pura em propFirmAlerts.js e propFirmPayout.js (epic #52 Fases 3/4 completas)
 * - 1.26.4: fix: Correção semântica #136 — periodGoal agora é mecânico (maxTrades × RO × RR = 2.4% Apex CONS_B), não mais o EV/dailyTarget (0.3%). Preview do attack plan reescrito em 3 blocos (constraints da mesa / mecânica do plano / ritmo de acumulação), com caminhos de execução explícitos (2 trades × 1 contrato OU 1 trade × 2 contratos). Remove tooltip Info supérfluo. 4 testes novos (issue #136 revisão Fase A)
 * - 1.26.3: feat: Templates Ylos Trading + engine phase-aware — 7 templates (6 Challenge + Freedom 50K), fundedDrawdown opcional por template, resolução automática por account.propFirm.phase (EVAL→drawdown, SIM_FUNDED/LIVE→fundedDrawdown), CF persiste trailFrozen (gap Fase B), 6 testes phase-aware (issue #136 Fase C E4)
 * - 1.26.2: feat: Engine drawdown TRAILING_TO_STATIC (Ylos Funded freeze) — novo tipo + flag TRAIL_FROZEN + campo account.propFirm.trailFrozen, espelhado em functions/propFirmEngine.js, 10 testes novos, regressão Apex zero (issue #136 Fase B E5)
 * - 1.26.1: fix: Plano sugerido PROP Fase A — stop período derivado (maxTrades × RO), tooltip meta diária, resumo coerente com daily loss mesa condicional (issue #136 E1+E2+E3)
 * - 1.26.0: feat: Order Import V1.1 redesign — criação automática de trades, confronto enriquecido (updateDoc), categorização 3 grupos (ghost/confront/ambígua), throttling >20, lowResolution flag, badges "Importado"/"Complemento pendente", labels STEP DONE corretas (issue #093 redesign, epic #128)
 * - 1.25.0: feat: Prop Firm Engine (#52) — Fase 1 templates/config/plano rule-based, Fase 1.5 instrumentsTable curada + 5 perfis determinísticos instrument-aware + viabilidade + restrição sessão NY, Fase 2 engine drawdown puro + CF onTrade* integrada + subcollection drawdownHistory + notificações throttled, correção crítica ATR v2 (TradingView real), DEC-060/061/062, DT-034
 * - 1.24.0: feat: Previsão de renovações + campo WhatsApp — RenewalForecast na SubscriptionsPage, campo whatsappNumber no student, validação E.164 (issue #122/#123)
 * - 1.23.0: feat: Controle de Assinaturas da Mentoria — subcollection students/{id}/subscriptions, CF checkSubscriptions, trial/paid, accessTier, billingPeriodMonths, receiptUrl (issue #094, DEC-055/DEC-056)
 * - 1.22.1: fix: Aluno não consegue deletar plano — firestore.rules DEC-025 + índice composto movements (issue #089)
 * - 1.22.0: debt: Node.js 20→22 + firebase-functions SDK 4.5→5.1 nas Cloud Functions (issue #096, DT-016, DT-028)
 * - 1.21.5: fix: probing rehydration — useProbing agora rehydrata perguntas do Firestore ao retornar à página; effectiveStatus resolve status preso em ai_assessed quando probing já foi gerado
 * - 1.21.4: fix: reportData persistence/rehydration, re-processar IA regenera report completo, probing questions panel, fix probingData.summary path, rewrite diretriz 4.4
 * - 1.21.3: feat: respostas abertas com análise IA no relatório do mentor (issue #097)
 * - 1.21.2: fix: rename "Marco Zero" → "Perfil de Maturidade" em BaselineReport header e Sidebar
 * - 1.21.0: Fix stageDiagnosis rehydration — persistido no questionnaire doc, rehydratado no useEffect; TraderProfileCard Maturidade usa escala de stage (não score); useAssessment.saveStageDiagnosis
 * - 1.20.9: Fix BaselineReport sem justificativa — stage_diagnosis campo top-level no initial_assessment
 * - 1.20.8: Re-processar IA agora inclui aprofundamento (probing)
 * - 1.20.7: Dimensão Experiência renomeada para Maturidade em toda UI; justificativa IA do diagnóstico de stage exibida no BaselineReport
 * - 1.20.6: Prompt classifyOpenResponse reescrito com framework completo; rubricas expandidas; campo aiFinding; botão Re-processar IA
 * - 1.20.5: DEC-027 — IncongruenceFlags redesenhado com master/detail: labels semânticos, respostas reais do aluno, justificativas da IA e probing integrado por flag
 * - 1.20.4: DEC-027 — BaselineReport redesenhado com régua de escala 4D + plano do mentor; MentorValidation com seção de prioridades editáveis pré-carregadas da IA
 * - 1.20.3: Marco Zero no sidebar do aluno — BaselineReport acessível após assessment concluído
 * - 1.20.2: DEC-026 — fix saveInitialAssessment stale closure (aluno preso em mentor_validated), mentor pode resetar assessment após conclusão
 * - 1.20.1: Fix loop infinito AssessmentGuard — guard movido de StudentDashboard para App.jsx
 * - 1.20.0: Order Import Pipeline (CHUNK-10) — parse ProfitChart-Pro, reconstrução operações, staging review, cross-check comportamental, KPI validation
 * - 1.19.7: Badge de notificação no Sidebar do aluno — trades REVIEWED não trabalhados
 * - 1.19.6: Payoff com semaforo de saude do edge, layout reorganizado, semaforo RO bidirecional, cor PL Atual tricolor, diagnostico assimetria
 * - 1.19.5: Layout agrupado 3 paineis (Financeiro/Desempenho/Plano vs Resultado), tooltips diagnosticos, NaN guards
 * - 1.19.4: DEC-009 — riskPercent usa plan.pl (capital base) como denominador, não currentPl
 * - 1.19.3: C3 (RR 2 casas decimais), C5 (resultInPoints null em override), coluna Status Feedback no ExtractTable
 * - 1.19.2: DEC-007 RR assumido integrado em calculateTradeCompliance (plan.pl base), guard C4 removido, updateTrade recalcula RR, diagnosePlan detecta rrAssumed stale
 * - 1.19.1: DEC-006 compliance sem stop (C1-C5), guard rrAssumed (C4), CSV tickerRule (C2), botão auditoria, PlanAuditModal diagnóstico bidirecional
 * - 1.19.0: RR assumido (B2), PlanLedgerExtract RO/RR + feedback nav (B4), P&L contextual (B5) (#71/#73)
 * - 1.18.2: Fix locale pt-BR para todas as moedas (DEC-004)
 * - 1.18.1: Inferência direção CSV (DEC-003), parseNumericValue, Step 2 redesign, ticker validation
 * - 1.18.0: CSV import v2 — staging collection (csvStagingTrades), csvParser, csvMapper, csvValidator, useCsvTemplates, useCsvStaging (#23)
 * - 1.17.0: Cycle navigation, gauge charts, period dropdown, cycle card breakdown (#53-F2)
 * - 1.16.0: State machine plano (#58), badge reclassification, quick fixes dívida técnica
 * - 1.15.0: Multi-currency (#40), account plan accordion (#39), dashboard partition
 */
const VERSION = {
  version: '1.49.1',
  build: '20260430',
  display: 'v1.49.1',
  full: '1.49.1+20260430',
};
export default VERSION;
export { VERSION };
