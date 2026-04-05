/**
 * version.js — Single Source of Truth
 * @description Versão do produto Acompanhamento 2.0
 *
 * CHANGELOG:
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
  version: '1.23.0',
  build: '20260405',
  display: 'v1.23.0',
  full: '1.23.0+20260405',
};
export default VERSION;
export { VERSION };
