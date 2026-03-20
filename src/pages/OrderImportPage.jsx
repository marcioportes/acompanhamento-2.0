/**
 * OrderImportPage.jsx
 * @version 1.0.0 (v1.20.0)
 * @description Página/modal principal de importação de ordens.
 *   State machine: UPLOAD → PREVIEW → IMPORTING → DONE
 *   Acessível pelo aluno (importa) e mentor (visualiza cross-check).
 *
 * FLOW:
 *   1. Upload CSV → parse + detect format
 *   2. Validate → show errors/warnings
 *   3. Preview → allow row exclusion
 *   4. Select plan → staging
 *   5. Ingest → orders collection + delete staging
 *   6. Correlate + cross-check → orderAnalysis
 *
 * @requires useOrderStaging, useOrders, useCrossCheck
 */

import { useState, useCallback, useMemo } from 'react';
import { X, Upload, CheckCircle, AlertTriangle, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import DebugBadge from '../components/DebugBadge';
import OrderUploader from '../components/OrderImport/OrderUploader';
import OrderPreview from '../components/OrderImport/OrderPreview';
import OrderValidationReport from '../components/OrderImport/OrderValidationReport';
import OrderCorrelation from '../components/OrderImport/OrderCorrelation';
import CrossCheckDashboard from '../components/OrderImport/CrossCheckDashboard';

import { parseTradovate, parseGeneric } from '../utils/orderParsers';
import { normalizeBatch } from '../utils/orderNormalizer';
import { validateBatch } from '../utils/orderValidation';
import { correlateOrders } from '../utils/orderCorrelation';
import { calculateCrossCheckMetrics } from '../utils/orderCrossCheck';
import { validateKPIs } from '../utils/kpiValidation';

// ============================================
// STEPS
// ============================================
const STEPS = {
  UPLOAD: 'upload',
  PREVIEW: 'preview',
  PLAN_SELECT: 'plan_select',
  IMPORTING: 'importing',
  CORRELATING: 'correlating',
  DONE: 'done',
};

/**
 * @param {Object} props
 * @param {Function} props.onClose — fecha o modal/página
 * @param {Object[]} props.plans — planos do aluno (com id, name, pl, riskPerOperation, rrTarget)
 * @param {Object[]} props.trades — trades do aluno (para correlação)
 * @param {Object} props.orderStaging — hook useOrderStaging
 * @param {Object} props.crossCheck — hook useCrossCheck
 */
const OrderImportPage = ({ onClose, plans = [], trades = [], orderStaging, crossCheck }) => {
  const [step, setStep] = useState(STEPS.UPLOAD);
  const [parseResult, setParseResult] = useState(null);
  const [parsedOrders, setParsedOrders] = useState([]);
  const [validationResult, setValidationResult] = useState(null);
  const [parseErrors, setParseErrors] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [importProgress, setImportProgress] = useState('');
  const [correlationResult, setCorrelationResult] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState(null);

  // ============================================
  // STEP 1: UPLOAD + PARSE
  // ============================================
  const handleParsed = useCallback((result) => {
    setParseResult(result);
    setError(null);

    // Parse according to detected format
    let parsed;
    if (result.format === 'tradovate') {
      parsed = parseTradovate(result.rows, result.headers);
    } else {
      // For generic, use mapped headers as column mapping
      parsed = parseGeneric(result.rows, result.mappedHeaders);
    }

    setParseErrors(parsed.errors);

    // Normalize + deduplicate
    const { orders: normalized, dedupStats } = normalizeBatch(parsed.orders);

    // Validate
    const validation = validateBatch(normalized);
    setValidationResult(validation);
    setParsedOrders(validation.validOrders);

    if (validation.validOrders.length > 0) {
      setStep(STEPS.PREVIEW);
    }
  }, []);

  // ============================================
  // STEP 2: PREVIEW → PLAN SELECT
  // ============================================
  const handlePreviewConfirm = useCallback((activeOrders) => {
    setParsedOrders(activeOrders);
    setStep(STEPS.PLAN_SELECT);
  }, []);

  // ============================================
  // STEP 3: PLAN SELECT → IMPORT
  // ============================================
  const handleImport = useCallback(async () => {
    if (!selectedPlanId) return;
    if (!orderStaging) return;

    setStep(STEPS.IMPORTING);
    setError(null);

    try {
      // 1. Staging
      setImportProgress('Gravando em staging...');
      const batchId = await orderStaging.addStagingBatch(parsedOrders, {
        planId: selectedPlanId,
        sourceFormat: parseResult?.format || 'generic',
        fileName: parseResult?.fileName || null,
      });

      // 2. Correlate with trades
      setImportProgress('Correlacionando com trades...');
      const planTrades = trades.filter(t => t.planId === selectedPlanId);
      const { correlations, stats: corrStats } = correlateOrders(parsedOrders, planTrades);
      setCorrelationResult({ correlations, stats: corrStats });

      // Build correlation map for ingestion
      // Map staging order index → correlation result
      // Since staging orders are in same order as parsedOrders, we can use index
      // But we need staging doc IDs — which we don't have yet until listener fires
      // Solution: ingest with correlation data embedded

      // 3. Ingest (staging → orders + delete staging)
      setImportProgress('Ingerindo ordens...');
      // Wait for staging listener to update
      await new Promise(resolve => setTimeout(resolve, 1500));

      await orderStaging.ingestBatch(batchId, {});

      // 4. Cross-check
      setStep(STEPS.CORRELATING);
      setImportProgress('Calculando cross-check...');

      // Generate period key (current week)
      const now = new Date();
      const weekNum = Math.ceil((now.getDate() - now.getDay() + 1) / 7);
      const period = `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;

      if (crossCheck) {
        const crossCheckMetrics = calculateCrossCheckMetrics(parsedOrders, planTrades, correlations);
        const winningTrades = planTrades.filter(t => (Number(t.result) || 0) > 0);
        const winRate = planTrades.length > 0 ? winningTrades.length / planTrades.length : 0;
        const kpiResult = validateKPIs(crossCheckMetrics, { winRate, totalTrades: planTrades.length });

        const analysisId = await crossCheck.runCrossCheck(
          parsedOrders, planTrades, selectedPlanId, period
        );

        setAnalysisResult({
          crossCheckMetrics,
          kpiValidation: kpiResult,
          alerts: kpiResult.alerts,
          ordersAnalyzed: parsedOrders.length,
          tradesInPeriod: planTrades.length,
          period,
        });
      }

      setStep(STEPS.DONE);
      setImportProgress('');

    } catch (err) {
      console.error('[OrderImportPage] Import error:', err);
      setError(err.message);
      setStep(STEPS.PREVIEW);
      setImportProgress('');
    }
  }, [selectedPlanId, parsedOrders, parseResult, trades, orderStaging, crossCheck]);

  // ============================================
  // STEP LABEL
  // ============================================
  const stepLabel = useMemo(() => {
    switch (step) {
      case STEPS.UPLOAD: return 'Upload';
      case STEPS.PREVIEW: return 'Preview';
      case STEPS.PLAN_SELECT: return 'Selecionar Plano';
      case STEPS.IMPORTING: return 'Importando';
      case STEPS.CORRELATING: return 'Analisando';
      case STEPS.DONE: return 'Concluído';
      default: return '';
    }
  }, [step]);

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/50">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-blue-400" />
              Importar Ordens da Corretora
            </h2>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Etapa: {stepLabel}
              {parseResult && ` • ${parseResult.format === 'tradovate' ? 'Tradovate' : 'Genérico'} detectado`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <span className="text-xs text-red-300">{error}</span>
            </div>
          )}

          {/* STEP: UPLOAD */}
          {step === STEPS.UPLOAD && (
            <OrderUploader onParsed={handleParsed} />
          )}

          {/* STEP: PREVIEW */}
          {step === STEPS.PREVIEW && (
            <>
              {/* Format badge */}
              {parseResult && (
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {parseResult.format === 'tradovate' ? 'Tradovate' : 'Genérico'}
                    {parseResult.confidence > 0 && ` (${(parseResult.confidence * 100).toFixed(0)}%)`}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {parseResult.rowCount} linhas no CSV
                  </span>
                </div>
              )}

              <OrderValidationReport
                validationResult={validationResult}
                parseErrors={parseErrors}
              />

              <OrderPreview
                orders={parsedOrders}
                onConfirm={handlePreviewConfirm}
                onCancel={() => {
                  setStep(STEPS.UPLOAD);
                  setParseResult(null);
                  setParsedOrders([]);
                }}
              />
            </>
          )}

          {/* STEP: PLAN SELECT */}
          {step === STEPS.PLAN_SELECT && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Selecione o plano ao qual estas {parsedOrders.length} ordens pertencem:
              </p>

              <div className="space-y-2">
                {plans.map(plan => (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                      selectedPlanId === plan.id
                        ? 'border-blue-500/50 bg-blue-500/10 text-white'
                        : 'border-slate-700/50 bg-slate-800/30 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <span className="text-sm font-medium">{plan.name || plan.id}</span>
                    {plan.pl && (
                      <span className="text-xs text-slate-500 ml-2">
                        Capital: {Number(plan.pl).toLocaleString('pt-BR')}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {plans.length === 0 && (
                <p className="text-xs text-amber-400">
                  Nenhum plano encontrado. Crie um plano antes de importar ordens.
                </p>
              )}

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setStep(STEPS.PREVIEW)}
                  className="flex items-center gap-1 px-3 py-2 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Voltar
                </button>
                <button
                  onClick={handleImport}
                  disabled={!selectedPlanId}
                  className="flex items-center gap-1 px-4 py-2 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Importar e Analisar
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP: IMPORTING / CORRELATING */}
          {(step === STEPS.IMPORTING || step === STEPS.CORRELATING) && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
              <span className="text-sm text-slate-400">{importProgress}</span>
            </div>
          )}

          {/* STEP: DONE */}
          {step === STEPS.DONE && (
            <div className="space-y-6">
              <div className="flex flex-col items-center gap-2 py-4">
                <CheckCircle className="w-10 h-10 text-emerald-400" />
                <p className="text-sm font-semibold text-white">
                  {parsedOrders.length} ordens importadas com sucesso
                </p>
              </div>

              {/* Correlation results */}
              {correlationResult && (
                <OrderCorrelation
                  correlations={correlationResult.correlations}
                  stats={correlationResult.stats}
                />
              )}

              {/* Cross-check results */}
              {analysisResult && (
                <CrossCheckDashboard analysis={analysisResult} />
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-xs bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <DebugBadge component="OrderImportPage" />
    </div>
  );
};

export default OrderImportPage;
