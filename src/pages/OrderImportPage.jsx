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
import CreationResultPanel from '../components/OrderImport/CreationResultPanel';
import MatchedOperationsPanel from '../components/OrderImport/MatchedOperationsPanel';

import { parseProfitChartPro, detectOrderFormat } from '../utils/orderParsers';
import { normalizeBatch } from '../utils/orderNormalizer';
import { validateBatch } from '../utils/orderValidation';
import { reconstructOperations, associateNonFilledOrders } from '../utils/orderReconstruction';
import { enrichOperationsWithStopAnalysis } from '../utils/stopMovementAnalysis';
import { correlateOrders } from '../utils/orderCorrelation';
import { categorizeConfirmedOps } from '../utils/orderTradeCreation';
import { createTradesBatch } from '../utils/orderTradeBatch';
import { prepareConfrontBatch } from '../utils/orderTradeComparison';
import { createTrade } from '../utils/tradeGateway';
import { makeOrderKey } from '../utils/orderKey';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

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
const OrderImportPage = ({ onClose, plans = [], trades = [], orderStaging, crossCheck, userContext, deleteTrade }) => {
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

  // Modo Criação (V1.1a — issue #93 redesign): summary completo da importação
  const [importSummary, setImportSummary] = useState(null);

  // Modo Confronto (V1.1b — issue #93)
  const [confrontData, setConfrontData] = useState(null);

  // Operações ambíguas (correlacionam com 2+ trades) — Fase 5 vai criar painel
  const [ambiguousData, setAmbiguousData] = useState(null);

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

    // Validação de formato — bloqueio explícito quando não é arquivo de ordens
    if (detection.format !== 'profitchart_pro') {
      const headerHint = headers.length > 0
        ? ` Cabeçalho detectado: "${headers.slice(0, 5).join(', ')}${headers.length > 5 ? '...' : ''}"`
        : '';
      setError(
        `Este arquivo NÃO é um CSV de ordens reconhecido (formato esperado: ProfitChart-Pro). ` +
        `Confira se você não está subindo um arquivo de performance/trades por engano.${headerHint}`
      );
      setParseErrors([]);
      setValidationResult(null);
      setParsedOrders([]);
      return;
    }

    // Parse
    const parsed = parseProfitChartPro(result.text);
    setParseErrors(parsed.errors || []);

    // Normalize + dedup
    const { orders: normalized } = normalizeBatch(parsed.orders);

    // Validate
    const validation = validateBatch(normalized);
    setValidationResult(validation);
    setParsedOrders(validation.validOrders);

    if (validation.validOrders.length > 0) {
      setStep(STEPS.PREVIEW);
    } else {
      // Parser reconheceu o formato mas não extraiu nenhuma ordem válida
      const reason = parsed.errors?.length > 0
        ? `${parsed.errors.length} erros de parse + 0 ordens válidas após validação`
        : '0 ordens válidas após validação';
      setError(`Arquivo reconhecido como ProfitChart-Pro mas sem ordens importáveis. ${reason}.`);
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
  const handleStagingConfirm = useCallback(async ({ operations: confirmedOps, observations, confirmedOrderKeys }) => {
    if (!batchId || !orderStaging) return;

    setIngesting(true);
    setError(null);

    try {
      // Filtrar ordens cruas pelo mesmo critério canônico usado em ingestBatch.
      // confirmedOrderKeys vem do OrderStagingReview e contém TODAS as ordens
      // (entry/exit/stop/cancelled) das operações que o aluno confirmou.
      // Operações desmarcadas são descartadas do fluxo inteiro — issue #93.
      const confirmedSet = new Set(confirmedOrderKeys || []);
      const confirmedOrders = parsedOrders.filter(o => confirmedSet.has(makeOrderKey(o)));

      // 1. Ingest filtrado: apenas ordens das operações confirmadas vão para `orders`.
      //    As ordens não-confirmadas são DELETADAS do staging (Opção B — issue #93).
      setProgress('Ingerindo ordens das operações confirmadas...');
      await orderStaging.ingestBatch(batchId, {}, confirmedOrderKeys);

      // 2. Correlate with trades — apenas ordens confirmadas
      setProgress('Correlacionando com trades...');
      const planTrades = trades.filter(t => t.planId === selectedPlanId);
      const { correlations, stats: corrStats } = correlateOrders(confirmedOrders, planTrades);
      setCorrelationResult({ correlations, stats: corrStats });

      // 3. Cross-check (persistido para a Revisão Semanal #102 — não exibido ao aluno)
      //    Usa apenas ordens confirmadas — métricas comportamentais refletem só o subset validado.
      if (crossCheck && planTrades.length > 0 && confirmedOrders.length > 0) {
        setProgress('Calculando cross-check...');
        const now = new Date();
        const weekNum = Math.ceil((now.getDate() - now.getDay() + 1) / 7);
        const period = `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
        try {
          await crossCheck.runCrossCheck(confirmedOrders, planTrades, selectedPlanId, period);
        } catch (ccErr) {
          console.warn('[OrderImportPage] Cross-check persist failed (non-blocking):', ccErr);
        }
      }

      // 4. Categorizar ops em toCreate / toConfront / ambiguous (issue #93 redesign — Fase 2)
      //    Resolve o bug de ops mistas em limbo: critério baseado em correlação por op,
      //    não em filledOrders.every() do código antigo.
      setProgress('Categorizando operações...');
      const { toCreate, toConfront, ambiguous } = categorizeConfirmedOps(confirmedOps, correlations);

      // 5. Resolver tickerRules dos instrumentos a criar (futuros precisam para cálculo correto)
      const instrumentsToCreate = [...new Set(toCreate.map(op => (op.instrument || '').toUpperCase()))];
      const tickerRuleMap = {};
      for (const symbol of instrumentsToCreate) {
        try {
          const tickerSnap = await getDocs(
            query(collection(db, 'tickers'), where('symbol', '==', symbol))
          );
          if (!tickerSnap.empty) {
            const tickerDoc = tickerSnap.docs[0].data();
            if (tickerDoc.tickSize && tickerDoc.tickValue) {
              tickerRuleMap[symbol] = {
                tickSize: tickerDoc.tickSize,
                tickValue: tickerDoc.tickValue,
                pointValue: tickerDoc.pointValue ?? null,
              };
            }
          }
        } catch (err) {
          console.warn(`[OrderImportPage] tickerRule não encontrado para ${symbol}:`, err.message);
        }
      }

      // 6. Criação automática (V1.1a redesign): sem painel intermediário, sem clique extra.
      //    Throttling: batch > 20 → sequencial; ≤ 20 → paralelo (Promise.allSettled).
      //    Deduplicação verificada antes de cada createTrade pelo helper.
      const lowResolution = !!parseResult?.lowResolution;
      const batchResult = await createTradesBatch({
        toCreate,
        planId: selectedPlanId,
        importBatchId: batchId,
        tickerRuleMap,
        lowResolution,
        existingTrades: planTrades,
        userContext,
        onProgress: (_current, _total, message) => setProgress(message),
      });

      // 7. Persistir summary completo para o STEP DONE (Fase 4 vai consumir nas labels)
      setImportSummary({
        ordersConfirmed: confirmedOrders.length,
        opsConfirmed: confirmedOps.length,
        toCreateCount: toCreate.length,
        tradesCreated: batchResult.created,
        tradesDuplicates: batchResult.duplicates.length,
        tradesFailed: batchResult.failed,
        toConfrontCount: toConfront.length,
        ambiguousCount: ambiguous.length,
        lowResolution,
      });

      // 8. Modo Confronto (V1.1b — Fase 5 vai refatorar para enriquecimento)
      //    Por enquanto continua usando prepareConfrontBatch antigo + MatchedOperationsPanel.
      if (toConfront.length > 0) {
        setProgress('Comparando operações com trades do diário...');
        const confront = prepareConfrontBatch(confirmedOps, correlations, planTrades);
        if (confront.divergent.length > 0 || confront.converged.length > 0) {
          setConfrontData(confront);
        }
      }

      // 9. Persistir ambíguas (Fase 5 cria o painel de decisão manual)
      if (ambiguous.length > 0) {
        setAmbiguousData(ambiguous);
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
  }, [batchId, parsedOrders, parseResult, selectedPlanId, trades, orderStaging, crossCheck, userContext]);

  // ============================================
  // MODO CONFRONTO: aceitar ou atualizar trade a partir de operação (V1.1b)
  // ============================================

  /** "Aceitar como está" — dismissal client-side, sem write no Firestore */
  const handleAcceptMatched = useCallback(async (_item) => {
    // A correlatedTradeId já foi setada durante ingestBatch.
    // Não há ação no Firestore — o aluno apenas confirmou que o trade do diário permanece.
    return { success: true };
  }, []);

  /** "Atualizar com corretora" — DELETE + CREATE via pipeline limpo */
  const handleUpdateMatched = useCallback(async (item) => {
    if (!userContext?.uid || !deleteTrade) {
      return { success: false, error: 'Contexto de usuário ou deleteTrade indisponível' };
    }

    const { trade, operation } = item;

    try {
      // 1. Resolver tickerRule do master data para cálculo correto de futuros
      let tickerRule = null;
      const symbol = (operation.instrument || '').toUpperCase();
      try {
        const tickerSnap = await getDocs(
          query(collection(db, 'tickers'), where('symbol', '==', symbol))
        );
        if (!tickerSnap.empty) {
          const tickerDoc = tickerSnap.docs[0].data();
          if (tickerDoc.tickSize && tickerDoc.tickValue) {
            tickerRule = {
              tickSize: tickerDoc.tickSize,
              tickValue: tickerDoc.tickValue,
              pointValue: tickerDoc.pointValue ?? null,
            };
          }
        }
      } catch (err) {
        console.warn(`[OrderImportPage] tickerRule não encontrado para ${symbol}:`, err.message);
      }

      // 2. Construir _partials das ordens reconstruídas (INV-12)
      const partials = [];
      let seq = 1;
      for (const entry of (operation.entryOrders || [])) {
        partials.push({
          type: 'ENTRY',
          price: parseFloat(entry.filledPrice ?? entry.price) || 0,
          qty: parseFloat(entry.filledQuantity ?? entry.quantity) || 0,
          dateTime: entry.filledAt || entry.submittedAt || null,
          seq: seq++,
        });
      }
      for (const exit of (operation.exitOrders || [])) {
        partials.push({
          type: 'EXIT',
          price: parseFloat(exit.filledPrice ?? exit.price) || 0,
          qty: parseFloat(exit.filledQuantity ?? exit.quantity) || 0,
          dateTime: exit.filledAt || exit.submittedAt || null,
          seq: seq++,
        });
      }

      // Stop loss do último stop order (se existir)
      let stopLoss = null;
      if (operation.hasStopProtection && operation.stopOrders?.length > 0) {
        const lastStop = operation.stopOrders[operation.stopOrders.length - 1];
        stopLoss = parseFloat(lastStop.stopPrice ?? lastStop.price) || null;
      }

      // 3. Montar tradeData preservando campos comportamentais do trade original
      //    (emotionEntry, emotionExit, setup, mentorFeedback, feedbackHistory — o aluno
      //    já preencheu esses campos no trade original e eles devem ser preservados)
      const tradeData = {
        planId: trade.planId,
        ticker: (operation.instrument || '').toUpperCase(),
        side: operation.side,
        entry: String(operation.avgEntryPrice ?? 0),
        exit: String(operation.avgExitPrice ?? 0),
        qty: String(operation.totalQty ?? 0),
        entryTime: operation.entryTime || null,
        exitTime: operation.exitTime || null,
        stopLoss,
        // Preservar campos comportamentais do trade original
        emotionEntry: trade.emotionEntry ?? null,
        emotionExit: trade.emotionExit ?? null,
        setup: trade.setup ?? null,
        // Rastreabilidade — origem é order_import (vs o trade original)
        source: 'order_import',
        importSource: 'order_import',
        importBatchId: batchId,
        confrontedFrom: trade.id, // rastreia que este trade substitui o anterior
        tickerRule,
        _partials: partials,
      };

      // 4. DELETE do trade antigo (CF onTradeDeleted reverte PL via FieldValue.increment)
      await deleteTrade(trade.id);

      // 5. CREATE novo via pipeline limpo (CF onTradeCreated recalcula PL)
      const newTrade = await createTrade(tradeData, userContext);

      console.log(`[OrderImportPage] Modo Confronto: trade ${trade.id} substituído por ${newTrade.id}`);
      return { success: true, oldTradeId: trade.id, newTradeId: newTrade.id };
    } catch (err) {
      console.error('[OrderImportPage] Erro no DELETE+CREATE:', err);
      return { success: false, error: err.message };
    }
  }, [userContext, deleteTrade, batchId]);

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

              {/* Modo Criação (V1.1a redesign): trades criados automaticamente após confirmação */}
              {importSummary && (
                <CreationResultPanel
                  summary={{
                    created: importSummary.tradesCreated,
                    duplicates: importSummary.tradesDuplicates,
                    failed: importSummary.tradesFailed,
                  }}
                />
              )}

              {/* Modo Confronto: operações correlacionadas com divergências (V1.1b) */}
              {confrontData && (
                <MatchedOperationsPanel
                  confrontData={confrontData}
                  onAccept={handleAcceptMatched}
                  onUpdate={handleUpdateMatched}
                />
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
