/**
 * OrderImportPage.jsx
 * @version 2.0.0 (v1.20.0)
 * @description Wizard de importação de ordens — fluxo completo end-to-end.
 *
 * STATE MACHINE:
 *   UPLOAD → PREVIEW → PLAN_SELECT → STAGING (gravar)
 *   → STAGING_REVIEW (operações reconstruídas, aluno confirma)
 *   → INGESTING (staging → orders + delete staging)
 *   → DONE (cross-check + resultado)
 *
 * O aluno NÃO pode pular o STAGING_REVIEW — deve confirmar cada operação.
 *
 * @requires useOrderStaging, useCrossCheck
 */

import { useState, useCallback, useMemo } from 'react';
import { X, Upload, CheckCircle, AlertTriangle, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import DebugBadge from '../components/DebugBadge';
import OrderUploader from '../components/OrderImport/OrderUploader';
import OrderPreview from '../components/OrderImport/OrderPreview';
import OrderValidationReport from '../components/OrderImport/OrderValidationReport';
import OrderStagingReview from '../components/OrderImport/OrderStagingReview';
import OrderCorrelation from '../components/OrderImport/OrderCorrelation';
import CrossCheckDashboard from '../components/OrderImport/CrossCheckDashboard';

import { parseProfitChartPro, detectOrderFormat } from '../utils/orderParsers';
import { normalizeBatch } from '../utils/orderNormalizer';
import { validateBatch } from '../utils/orderValidation';
import { reconstructOperations, associateNonFilledOrders } from '../utils/orderReconstruction';
import { enrichOperationsWithStopAnalysis } from '../utils/stopMovementAnalysis';
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
  STAGING_WRITE: 'staging_write',
  STAGING_REVIEW: 'staging_review',
  INGESTING: 'ingesting',
  DONE: 'done',
};

const STEP_LABELS = {
  [STEPS.UPLOAD]: 'Upload',
  [STEPS.PREVIEW]: 'Preview',
  [STEPS.PLAN_SELECT]: 'Selecionar Plano',
  [STEPS.STAGING_WRITE]: 'Gravando staging...',
  [STEPS.STAGING_REVIEW]: 'Revisão de Operações',
  [STEPS.INGESTING]: 'Importando...',
  [STEPS.DONE]: 'Concluído',
};

/**
 * @param {Object} props
 * @param {Function} props.onClose
 * @param {Object[]} props.plans — planos do aluno
 * @param {Object[]} props.trades — trades do aluno (para correlação)
 * @param {Object} props.orderStaging — hook useOrderStaging
 * @param {Object} props.crossCheck — hook useCrossCheck (opcional)
 */
const OrderImportPage = ({ onClose, plans = [], trades = [], orderStaging, crossCheck }) => {
  // State machine
  const [step, setStep] = useState(STEPS.UPLOAD);

  // Parse state
  const [parseResult, setParseResult] = useState(null);
  const [parsedOrders, setParsedOrders] = useState([]);
  const [validationResult, setValidationResult] = useState(null);
  const [parseErrors, setParseErrors] = useState([]);

  // Plan selection
  const [selectedPlanId, setSelectedPlanId] = useState('');

  // Staging + reconstruction
  const [batchId, setBatchId] = useState(null);
  const [reconstructedOps, setReconstructedOps] = useState([]);

  // Ingest results
  const [correlationResult, setCorrelationResult] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);

  // UI
  const [progress, setProgress] = useState('');
  const [error, setError] = useState(null);
  const [ingesting, setIngesting] = useState(false);

  // ============================================
  // STEP 1: UPLOAD → PARSE
  // ============================================
  const handleParsed = useCallback((result) => {
    setError(null);

    if (!result.text) return;

    // Detect format
    const lines = result.text.replace(/\r\n/g, '\n').split('\n');
    const headerLine = lines.find(l => (l.match(/;/g) || []).length >= 10);
    const headers = headerLine ? headerLine.split(';').map(h => h.trim()) : [];
    const detection = detectOrderFormat(headers);

    setParseResult({ ...result, format: detection.format, confidence: detection.confidence });

    // Parse
    let parsed;
    if (detection.format === 'profitchart_pro') {
      parsed = parseProfitChartPro(result.text);
    } else {
      parsed = { orders: [], meta: {}, errors: [{ row: 0, message: 'Formato não reconhecido. Use o mapeamento manual.' }] };
    }

    setParseErrors(parsed.errors || []);

    // Normalize + dedup
    const { orders: normalized } = normalizeBatch(parsed.orders);

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
  // STEP 3: PLAN SELECT → STAGING + RECONSTRUCTION
  // ============================================
  const handlePlanConfirm = useCallback(async () => {
    if (!selectedPlanId || !orderStaging) return;

    setStep(STEPS.STAGING_WRITE);
    setError(null);

    try {
      // 1. Write to staging
      setProgress('Gravando ordens em staging...');
      const newBatchId = await orderStaging.addStagingBatch(parsedOrders, {
        planId: selectedPlanId,
        sourceFormat: parseResult?.format || 'generic',
        fileName: parseResult?.fileName || null,
      });
      setBatchId(newBatchId);

      // 2. Reconstruct operations (client-side, from parsed orders)
      setProgress('Reconstruindo operações...');
      const ops = reconstructOperations(parsedOrders);

      // 3. Associate non-filled orders (stops, cancellations)
      associateNonFilledOrders(ops, parsedOrders);

      // 4. Analyze stop movements
      enrichOperationsWithStopAnalysis(ops);

      setReconstructedOps(ops);
      setStep(STEPS.STAGING_REVIEW);
      setProgress('');

    } catch (err) {
      console.error('[OrderImportPage] Staging error:', err);
      setError(err.message);
      setStep(STEPS.PLAN_SELECT);
      setProgress('');
    }
  }, [selectedPlanId, parsedOrders, parseResult, orderStaging]);

  // ============================================
  // STEP 4: STAGING REVIEW → INGEST
  // ============================================
  const handleStagingConfirm = useCallback(async ({ operations, observations }) => {
    if (!batchId || !orderStaging) return;

    setIngesting(true);
    setError(null);

    try {
      // 1. Ingest (staging → orders + delete staging)
      setProgress('Ingerindo ordens...');
      await orderStaging.ingestBatch(batchId, {});

      // 2. Correlate with trades
      setProgress('Correlacionando com trades...');
      const planTrades = trades.filter(t => t.planId === selectedPlanId);
      const { correlations, stats: corrStats } = correlateOrders(parsedOrders, planTrades);
      setCorrelationResult({ correlations, stats: corrStats });

      // 3. Cross-check
      setProgress('Calculando cross-check...');
      if (crossCheck && planTrades.length > 0) {
        const crossCheckMetrics = calculateCrossCheckMetrics(parsedOrders, planTrades, correlations);
        const winningTrades = planTrades.filter(t => (Number(t.result) || 0) > 0);
        const winRate = planTrades.length > 0 ? winningTrades.length / planTrades.length : 0;
        const kpiResult = validateKPIs(crossCheckMetrics, { winRate, totalTrades: planTrades.length });

        const now = new Date();
        const weekNum = Math.ceil((now.getDate() - now.getDay() + 1) / 7);
        const period = `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;

        try {
          await crossCheck.runCrossCheck(parsedOrders, planTrades, selectedPlanId, period);
        } catch (ccErr) {
          console.warn('[OrderImportPage] Cross-check persist failed (non-blocking):', ccErr);
        }

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
      setProgress('');
    } catch (err) {
      console.error('[OrderImportPage] Ingest error:', err);
      setError(err.message);
      // Stay on STAGING_REVIEW so aluno can retry
      setStep(STEPS.STAGING_REVIEW);
      setProgress('');
    } finally {
      setIngesting(false);
    }
  }, [batchId, parsedOrders, selectedPlanId, trades, orderStaging, crossCheck]);

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">

        {/* ─── Header ─── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/50 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-blue-400" />
              Importar Ordens da Corretora
            </h2>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Etapa: {STEP_LABELS[step] || step}
              {parseResult && ` • ${parseResult.format === 'profitchart_pro' ? 'ProfitChart-Pro' : 'Genérico'}`}
              {parseResult?.confidence > 0 && ` (${(parseResult.confidence * 100).toFixed(0)}%)`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ─── Content ─── */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* Error banner */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <span className="text-xs text-red-300">{error}</span>
            </div>
          )}

          {/* ── UPLOAD ── */}
          {step === STEPS.UPLOAD && (
            <OrderUploader onParsed={handleParsed} />
          )}

          {/* ── PREVIEW ── */}
          {step === STEPS.PREVIEW && (
            <>
              {parseResult && (
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {parseResult.format === 'profitchart_pro' ? 'ProfitChart-Pro' : 'Genérico'}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {parsedOrders.length} ordens válidas
                  </span>
                </div>
              )}

              <OrderValidationReport validationResult={validationResult} parseErrors={parseErrors} />

              <OrderPreview
                orders={parsedOrders}
                onConfirm={handlePreviewConfirm}
                onCancel={() => {
                  setStep(STEPS.UPLOAD);
                  setParseResult(null);
                  setParsedOrders([]);
                  setValidationResult(null);
                  setParseErrors([]);
                }}
              />
            </>
          )}

          {/* ── PLAN SELECT ── */}
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
                    {plan.pl != null && (
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
                  <ArrowLeft className="w-3.5 h-3.5" /> Voltar
                </button>
                <button
                  onClick={handlePlanConfirm}
                  disabled={!selectedPlanId}
                  className="flex items-center gap-1 px-4 py-2 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Analisar Operações <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* ── STAGING WRITE (loading) ── */}
          {step === STEPS.STAGING_WRITE && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
              <span className="text-sm text-slate-400">{progress}</span>
            </div>
          )}

          {/* ── STAGING REVIEW ── */}
          {step === STEPS.STAGING_REVIEW && (
            <OrderStagingReview
              operations={reconstructedOps}
              onConfirm={handleStagingConfirm}
              onBack={() => setStep(STEPS.PLAN_SELECT)}
              loading={ingesting}
            />
          )}

          {/* ── INGESTING (loading) ── */}
          {step === STEPS.INGESTING && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
              <span className="text-sm text-slate-400">{progress}</span>
            </div>
          )}

          {/* ── DONE ── */}
          {step === STEPS.DONE && (
            <div className="space-y-6">
              <div className="flex flex-col items-center gap-2 py-4">
                <CheckCircle className="w-10 h-10 text-emerald-400" />
                <p className="text-sm font-semibold text-white">
                  {parsedOrders.length} ordens importadas com sucesso
                </p>
                <p className="text-xs text-slate-400">
                  {reconstructedOps.length} operações reconstruídas
                </p>
              </div>

              {correlationResult && (
                <OrderCorrelation
                  correlations={correlationResult.correlations}
                  stats={correlationResult.stats}
                />
              )}

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
