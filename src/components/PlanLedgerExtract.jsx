/**
 * PlanLedgerExtract
 * @version 5.0.0 (v1.19.0)
 * @description Extrato Ledger emocional — orquestrador.
 *   v5.0.0: RO/RR no header, RR assumido no grid, navegação feedback (B4 — Issue #71/#73).
 *   v4.0.0: Navegação entre ciclos, ExtractCycleCard com gauges, click-to-filter.
 *   v3.0.0: Integra planStateMachine, seletor temporal, sub-componentes extraídos.
 *   v2.0.0: Multi-moeda via currency prop.
 *   v1.1.0: Compliance events (RO/RR/NO_STOP).
 *
 * ARQUITETURA:
 *   PlanLedgerExtract (orquestrador)
 *     ├─ ExtractPeriodSelector (seletor temporal + navegação ciclos)
 *     ├─ ExtractCycleCard (barra progresso + breakdown por período — lateral)
 *     ├─ ExtractSummary (resumo com estado + separação pré/pós + RO/RR do plano)
 *     └─ ExtractTable (tabela com RO/RR/Emoção + RR assumido + feedback nav)
 *
 * USAGE:
 *   <PlanLedgerExtract plan={plan} trades={planTrades} onClose={fn} currency="USD" onNavigateToFeedback={fn} />
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { X, ScrollText, FileCheck2, ArrowLeftCircle } from 'lucide-react';
import { useMasterData } from '../hooks/useMasterData';
import { useEmotionalProfile } from '../hooks/useEmotionalProfile';
import { useComplianceRules } from '../hooks/useComplianceRules';
import { useWeeklyReviews } from '../hooks/useWeeklyReviews';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrencyDynamic } from '../utils/currency';
import { computePlanState, getAvailableCycles, getCycleStartDate, getCycleEndDate } from '../utils/planStateMachine';
import { buildTableRows } from '../utils/extractTableRows';
import { computeExtractSummaryMetrics } from '../utils/extractSummaryMetrics';
import DebugBadge from './DebugBadge';
import NewReviewDialog from './reviews/NewReviewDialog';
import ReviewToolsPanel from './reviews/ReviewToolsPanel';

// Sub-componentes
import ExtractPeriodSelector from './extract/ExtractPeriodSelector';
import ExtractCycleCard from './extract/ExtractCycleCard';
import ExtractSummary from './extract/ExtractSummary';
import ExtractTable from './extract/ExtractTable';

const PlanLedgerExtract = ({ plan, trades, onClose, currency = 'BRL', onNavigateToFeedback = null, embedded = false, initialReviewId = null }) => {
  const { getEmotionConfig } = useMasterData();
  const { detectionConfig, statusThresholds } = useComplianceRules();
  const { isMentor } = useAuth();
  const mentor = typeof isMentor === 'function' ? isMentor() : Boolean(isMentor);
  const emotional = useEmotionalProfile({ trades, detectionConfig, statusThresholds });
  const studentIdForReviews = plan?.studentId || null;
  const { createReview, reviews: allReviews } = useWeeklyReviews(studentIdForReviews);

  // Seletor temporal: null = ciclo inteiro, string = periodKey
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [newReviewOpen, setNewReviewOpen] = useState(false);
  // activeReviewId: revisão sendo visualizada no painel (mode='review' deriva disso)
  const [activeReviewId, setActiveReviewId] = useState(initialReviewId);
  useEffect(() => { setActiveReviewId(initialReviewId); }, [initialReviewId]);

  const mode = activeReviewId ? 'review' : 'live';

  // Reviews do plano atual em ordem desc por weekStart
  const planReviews = useMemo(
    () => (allReviews || []).filter(r => r.frozenSnapshot?.planContext?.planId === plan?.id),
    [allReviews, plan?.id]
  );

  const activeReview = useMemo(
    () => planReviews.find(r => r.id === activeReviewId) || null,
    [planReviews, activeReviewId]
  );

  const previousReview = useMemo(() => {
    if (!activeReview) return null;
    return planReviews.find(
      r => r.id !== activeReview.id && r.weekStart < activeReview.weekStart
    ) || null;
  }, [planReviews, activeReview]);

  // Qualquer DRAFT aberto desse plano (unicidade per-plano: 1 rascunho por vez).
  const openDraft = useMemo(() => {
    return planReviews.find(r => r.status === 'DRAFT') || null;
  }, [planReviews]);

  // Handler do botão "Nova Revisão" / "Continuar rascunho":
  // se já existe QUALQUER DRAFT do plano, ativa mode='review' nele.
  // Senão, abre dialog de período → on created, ativa mode='review' no novo.
  const handleNewOrOpenReview = useCallback(() => {
    if (openDraft) {
      setActiveReviewId(openDraft.id);
    } else {
      setNewReviewOpen(true);
    }
  }, [openDraft]);

  const handleBackToLive = useCallback(() => setActiveReviewId(null), []);

  // Currency formatter parcial
  const fmt = useCallback((v) => formatCurrencyDynamic(v, currency), [currency]);

  // ==================== CYCLE NAVIGATION ====================

  const adjustmentCycle = plan?.adjustmentCycle || 'Mensal';

  const availableCycles = useMemo(() => {
    if (!trades || trades.length === 0) return [];
    return getAvailableCycles(trades, adjustmentCycle);
  }, [trades, adjustmentCycle]);

  // Ciclo selecionado (default = ciclo atual)
  const [selectedCycleKey, setSelectedCycleKey] = useState(() => {
    if (!trades || trades.length === 0) return null;
    const now = new Date();
    const currentCycleStart = getCycleStartDate(adjustmentCycle, now);
    const currentKey = `${currentCycleStart.getFullYear()}-${String(currentCycleStart.getMonth() + 1).padStart(2, '0')}-${String(currentCycleStart.getDate()).padStart(2, '0')}`;
    // Se o ciclo atual tem trades, usar ele. Senão, usar o último com trades.
    const cycles = getAvailableCycles(trades, adjustmentCycle);
    const hasCurrent = cycles.some(c => c.key === currentKey);
    if (hasCurrent) return currentKey;
    return cycles.length > 0 ? cycles[cycles.length - 1].key : null;
  });

  const handleSelectCycle = useCallback((cycleKey) => {
    setSelectedCycleKey(cycleKey);
    setSelectedPeriod(null); // Reset período ao trocar ciclo
  }, []);

  // Resolver start/end do ciclo selecionado
  const selectedCycleRange = useMemo(() => {
    if (!selectedCycleKey) return null;
    const d = new Date(selectedCycleKey + 'T12:00:00');
    return {
      start: getCycleStartDate(adjustmentCycle, d),
      end: getCycleEndDate(adjustmentCycle, d),
    };
  }, [selectedCycleKey, adjustmentCycle]);

  // ==================== STATE MACHINE ====================

  const planState = useMemo(() => {
    if (!plan || !trades || trades.length === 0) return null;

    const options = selectedCycleRange
      ? { targetCycle: selectedCycleRange, targetDate: selectedCycleRange.start }
      : {};

    return computePlanState(trades, {
      pl: Number(plan.pl) || 0,
      periodGoal: Number(plan.periodGoal) || 0,
      periodStop: Number(plan.periodStop) || 0,
      cycleGoal: Number(plan.cycleGoal) || 0,
      cycleStop: Number(plan.cycleStop) || 0,
      operationPeriod: plan.operationPeriod || 'Diário',
      adjustmentCycle: adjustmentCycle,
    }, options);
  }, [plan, trades, selectedCycleRange, adjustmentCycle]);

  // ==================== DADOS DERIVADOS ====================

  const currentPeriodState = useMemo(() => {
    if (!planState) return null;
    if (selectedPeriod === null) return null;
    return planState.cycleState.periods.get(selectedPeriod) || null;
  }, [planState, selectedPeriod]);

  // Rows para a tabela + saldo anterior (carry-over entre períodos).
  // R2 #102: cada row expõe dois acumulados — cumPnL (ciclo) e periodCumPnL (período).
  const { tableRows, carryOver } = useMemo(
    () => buildTableRows(planState, selectedPeriod),
    [planState, selectedPeriod]
  );

  // R3 #102: métricas agregadas do recorte visível (Trades / WR).
  // Em mode='review' CLOSED/ARCHIVED, usa KPIs congelados do frozenSnapshot.
  // Em DRAFT, KPIs live (ReviewToolsPanel já expõe aviso de congelamento ao publicar).
  const summaryMetrics = useMemo(() => {
    const frozen = activeReview?.status !== 'DRAFT' && activeReview?.frozenSnapshot?.kpis;
    if (frozen) {
      const k = activeReview.frozenSnapshot.kpis;
      return {
        tradesCount: Number(k.trades) || 0,
        winCount: Math.round(((Number(k.wr) || 0) / 100) * (Number(k.trades) || 0)),
        winRate: Number(k.wr) || 0,
      };
    }
    return computeExtractSummaryMetrics(tableRows);
  }, [activeReview, tableRows]);

  // Dados emocionais para o summary
  const emotionalData = useMemo(() => {
    if (!emotional.isReady) return null;
    return {
      score: emotional.metrics?.score ?? null,
      statusLabel: emotional.status?.label || '-'
    };
  }, [emotional]);

  // Eventos emocionais para matching inline na tabela.
  // tradeIds carrega os ids dos trades que pertencem à instância — previne
  // bleed do badge REVENGE/TILT para trades do mesmo dia fora da sequência.
  const emotionalEvents = useMemo(() => {
    if (!emotional.isReady || !emotional.alerts) return [];
    return emotional.alerts
      .filter(a => ['TILT_DETECTED', 'REVENGE_DETECTED', 'STATUS_CRITICAL'].includes(a.type))
      .map(a => {
        const tradeIds = [];
        if (a.type === 'TILT_DETECTED' && Array.isArray(a.details?.trades)) {
          for (const t of a.details.trades) if (t?.id) tradeIds.push(t.id);
        } else if (a.type === 'REVENGE_DETECTED') {
          if (a.details?.type === 'RAPID_SEQUENCE') {
            if (Array.isArray(a.details.tradeIdsAfter)) tradeIds.push(...a.details.tradeIdsAfter);
          } else if (a.details?.trade?.id) {
            tradeIds.push(a.details.trade.id);
          }
        }
        return {
          type: a.type,
          date: a.timestamp?.split?.('T')?.[0] || '',
          tradeIds: tradeIds.length > 0 ? tradeIds : null,
          message: a.message,
        };
      });
  }, [emotional]);

  // ==================== RENDER ====================

  if (!plan) return null;

  const startPL = Number(plan.pl) || 0;
  const isCycleView = selectedPeriod === null;

  // B4: Info de risco do plano para ExtractSummary e ExtractTable
  const planRiskInfo = useMemo(() => ({
    pl: startPL,
    riskPerOperation: Number(plan.riskPerOperation) || 0,
    rrTarget: Number(plan.rrTarget) || 0,
  }), [startPL, plan.riskPerOperation, plan.rrTarget]);

  // B4: Handler de navegação para feedback — fecha o modal e navega
  const handleNavigateToFeedback = useCallback((trade) => {
    if (onNavigateToFeedback) {
      onClose(); // Fecha o extrato
      onNavigateToFeedback(trade);
    }
  }, [onClose, onNavigateToFeedback]);

  const outerClass = embedded
    ? "h-full"
    : "fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4";
  const innerClass = embedded
    ? "w-full h-screen flex flex-col bg-slate-900"
    : "bg-slate-900 border border-slate-800 w-full max-w-7xl h-[90vh] rounded-xl flex flex-col shadow-2xl ring-1 ring-white/10";

  return (
    <div className={outerClass}>
      <div className={innerClass}>

        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${mode === 'review' ? 'bg-emerald-600/20' : 'bg-purple-600/20'}`}>
              <ScrollText className={`w-5 h-5 ${mode === 'review' ? 'text-emerald-400' : 'text-purple-400'}`} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {mode === 'review' ? 'Revisão: ' : 'Extrato do Plano: '}{plan.name}
              </h2>
              <p className="text-xs text-slate-400">
                {mode === 'review' && activeReview
                  ? `${activeReview.status === 'DRAFT' ? 'Rascunho em preparação' : 'Snapshot congelado'} · ${activeReview.weekStart} → ${activeReview.weekEnd} · ${activeReview.periodKey}`
                  : `${plan.operationPeriod || 'Diário'} · ${plan.adjustmentCycle || 'Mensal'} · ${fmt(startPL)}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {mentor && mode === 'review' && (
              <button
                onClick={handleBackToLive}
                className="px-3 py-1.5 text-xs font-medium bg-slate-700/40 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700/60 flex items-center gap-1.5"
                title="Voltar ao extrato live do plano"
              >
                <ArrowLeftCircle className="w-3.5 h-3.5" />
                Voltar ao live
              </button>
            )}
            {mentor && mode === 'live' && (
              <button
                onClick={handleNewOrOpenReview}
                className="px-3 py-1.5 text-xs font-medium bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-lg hover:bg-emerald-500/30 flex items-center gap-1.5"
                title={openDraft ? `Rascunho aberto (${openDraft.periodKey}) — continuar` : 'Criar nova revisão semanal'}
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                {openDraft ? 'Continuar rascunho' : 'Nova Revisão'}
              </button>
            )}
            {mentor && mode === 'live' && planReviews.length > 0 && (
              <select
                onChange={(e) => { if (e.target.value) setActiveReviewId(e.target.value); e.target.value = ''; }}
                defaultValue=""
                className="text-xs bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-2 py-1.5 hover:border-slate-600"
                title="Abrir revisão existente deste plano"
              >
                <option value="" disabled>Abrir revisão…</option>
                {planReviews.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.status === 'DRAFT' ? '○ ' : r.status === 'CLOSED' ? '● ' : '■ '}
                    {r.periodKey} · {r.weekStart.slice(5)}→{r.weekEnd.slice(5)}
                  </option>
                ))}
              </select>
            )}
            <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Period Selector + Cycle Navigation */}
        {planState && (
          <div className="px-5 py-3 border-b border-slate-800 bg-slate-800/30">
            <ExtractPeriodSelector
              availablePeriods={planState.availablePeriods}
              selectedPeriod={selectedPeriod}
              onSelectPeriod={setSelectedPeriod}
              operationPeriod={plan.operationPeriod || 'Diário'}
              currentPeriodKey={planState.currentPeriodKey}
              availableCycles={availableCycles}
              selectedCycleKey={selectedCycleKey}
              onSelectCycle={handleSelectCycle}
            />
          </div>
        )}

        {/* Main content: Cycle Card (lateral) + Summary + Table */}
        <div className="flex-1 flex overflow-hidden">

          {/* Cycle Card — lateral esquerda */}
          {planState && (
            <div className="w-72 min-w-[288px] border-r border-slate-800/50 bg-slate-900/50 overflow-y-auto hidden lg:flex lg:flex-col">
              <ExtractCycleCard
                planState={planState}
                startPL={startPL}
                fmt={fmt}
                selectedPeriod={selectedPeriod}
                onSelectPeriod={setSelectedPeriod}
                operationPeriod={plan.operationPeriod || 'Diário'}
              />
            </div>
          )}

          {/* Conteúdo principal */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <ExtractSummary
              periodState={currentPeriodState}
              startPL={startPL}
              fmt={fmt}
              emotionalData={emotionalData}
              isCycleView={isCycleView}
              cycleSummary={planState?.cycleState?.summary || null}
              cycleStatus={planState?.cycleState?.status || 'IN_PROGRESS'}
              planRiskInfo={planRiskInfo}
              summaryMetrics={summaryMetrics}
            />

            <ExtractTable
              rows={tableRows}
              fmt={fmt}
              getEmotionConfig={getEmotionConfig}
              carryOver={carryOver}
              emotionalEvents={emotionalEvents}
              planRiskInfo={planRiskInfo}
              onNavigateToFeedback={onNavigateToFeedback ? handleNavigateToFeedback : null}
            />
          </div>

          {/* Painel lateral direito — só em mode='review' (Opção 1 / Fase C) */}
          {mode === 'review' && activeReview && (
            <ReviewToolsPanel
              reviewId={activeReview.id}
              studentId={studentIdForReviews}
              review={activeReview}
              previousReview={previousReview}
              onClose={handleBackToLive}
            />
          )}
        </div>

      </div>
      <DebugBadge component="PlanLedgerExtract" />

      {newReviewOpen && mentor && (
        <NewReviewDialog
          plan={plan}
          allTrades={trades}
          cycleKey={selectedCycleKey}
          emotionalMetrics={emotional.metrics}
          existingReviews={planReviews}
          createReview={createReview}
          onCreated={(reviewId) => setActiveReviewId(reviewId)}
          onClose={() => setNewReviewOpen(false)}
        />
      )}
    </div>
  );
};

export default PlanLedgerExtract;
