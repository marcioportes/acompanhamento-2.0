/**
 * version.js — Single Source of Truth
 * @description Versão do produto Acompanhamento 2.0
 *
 * CHANGELOG:
 * - 1.42.1: fix: wire setupsMeta em MentorDashboard (issue #174 — E4 out-of-scope de #170) —
 *   MentorDashboard passa a importar `useSetups` e filtrar por `s.isGlobal || s.studentId ===
 *   selectedStudent?.uid` antes de passar `setupsMeta` ao `<SetupAnalysis>`. Completa o E4
 *   da spec original do #170 ("Consumido em StudentDashboard e MentorDashboard") que foi
 *   cortado por conveniência durante o merge do #170 sem discussão com o Marcio. Aderência
 *   RR agora renderiza corretamente na visão do mentor quando o aluno tem setups com
 *   `targetRR`. Teste mínimo garante isolamento por aluno. [RESERVADA — entrada definitiva
 *   no encerramento.]
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
  version: '1.42.1',
  build: '20260423',
  display: 'v1.42.1',
  full: '1.42.1+20260423',
};
export default VERSION;
export { VERSION };
