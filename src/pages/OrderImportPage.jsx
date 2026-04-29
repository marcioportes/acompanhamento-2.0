/**
 * OrderImportPage.jsx
 * @version 3.0.0 (v1.37.0 — issue #156 Fase C)
 * @description Wizard de importação de ordens — fluxo conversacional por operação.
 *
 * STATE MACHINE:
 *   UPLOAD → PREVIEW → PLAN_SELECT → STAGING_WRITE
 *   → STAGING_REVIEW (reconstrução, aluno confirma o staging cru)
 *   → CONVERSATIONAL_REVIEW (classificação + decisão por operação)
 *   → INGESTING (cria/enrich/descarta conforme decisão)
 *   → DONE
 *
 * Fase C (#156): remove auto-create do #93 — cada operação precisa de decisão
 * explícita (confirm / adjust / discard) antes de virar trade.
 *
 * Gate plano retroativo: se há operações em períodos sem plano vigente, o submit
 * fica bloqueado até o aluno criar plano cobrindo o período (via AccountDetailPage).
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
import ConversationalReview from '../components/OrderImport/ConversationalReview';

import { detectOrderFormat } from '../utils/orderParsers';
import { normalizeBatch } from '../utils/orderNormalizer';
import { validateBatch } from '../utils/orderValidation';
import { reconstructOperations, associateNonFilledOrders } from '../utils/orderReconstruction';
import { enrichOperationsWithStopAnalysis } from '../utils/stopMovementAnalysis';
import { correlateOrders } from '../utils/orderCorrelation';
import { categorizeConfirmedOps, CLASSIFICATION } from '../utils/orderTradeCreation';
import { createTradesBatch } from '../utils/orderTradeBatch';
import { compareOperationWithTrade } from '../utils/orderTradeComparison';
import { enrichTrade } from '../utils/tradeGateway';
import { makeOrderKey } from '../utils/orderKey';
import { detectCoverageGap } from '../utils/planCoverage';
import {
  routeConversationalDecisions,
  enrichConversationalBatch,
  operationOrderFingerprints,
  orderMatchFingerprint,
} from '../utils/conversationalIngest';
import { useShadowAnalysis } from '../hooks/useShadowAnalysis';
import {
  collection, query, where, getDocs, writeBatch, doc, serverTimestamp,
} from 'firebase/firestore';
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
  CONVERSATIONAL_REVIEW: 'conversational_review',
  INGESTING: 'ingesting',
  DONE: 'done',
};

const STEP_LABELS = {
  [STEPS.UPLOAD]: 'Upload',
  [STEPS.PREVIEW]: 'Preview',
  [STEPS.PLAN_SELECT]: 'Selecionar Plano',
  [STEPS.STAGING_WRITE]: 'Gravando staging...',
  [STEPS.STAGING_REVIEW]: 'Revisão de Operações',
  [STEPS.CONVERSATIONAL_REVIEW]: 'Decisão por Operação',
  [STEPS.INGESTING]: 'Importando...',
  [STEPS.DONE]: 'Concluído',
};

/**
 * Marca os docs de `orders` correspondentes a operações descartadas com
 * `userDecision: 'discarded'` + `userDecisionAt: serverTimestamp()`. As ordens
 * foram ingeridas no passo anterior (handleStagingConfirm); esta função só
 * atualiza os docs existentes para preservar a decisão do aluno em auditoria.
 *
 * Match: `batchId` + fingerprint instrument|side|filledAt|quantity
 * (ver `orderMatchFingerprint`). `orders` docs não carregam `externalOrderId`
 * atualmente; o fingerprint composto é suficiente para o propósito de
 * marcação — colisões dentro do mesmo batch são improváveis (mesmo ticker,
 * mesmo lado, mesmo filledAt exato, mesmo qty).
 */
async function persistDiscardedOrders({ batchId, discardedItems }) {
  if (!batchId || !discardedItems?.length) return { updated: 0 };

  // Reúne fingerprints de todas as ordens (entry+exit+stop) das ops descartadas.
  const discardedFps = new Set();
  for (const item of discardedItems) {
    const fps = operationOrderFingerprints(item.operation);
    for (const fp of fps) discardedFps.add(fp);
  }
  if (discardedFps.size === 0) return { updated: 0 };

  const q = query(collection(db, 'orders'), where('batchId', '==', batchId));
  const snap = await getDocs(q);
  if (snap.empty) return { updated: 0 };

  const BATCH_SIZE = 450;
  let updated = 0;
  const matchingDocs = snap.docs.filter(d => discardedFps.has(orderMatchFingerprint(d.data())));

  for (let i = 0; i < matchingDocs.length; i += BATCH_SIZE) {
    const chunk = matchingDocs.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    for (const d of chunk) {
      batch.update(doc(db, 'orders', d.id), {
        userDecision: 'discarded',
        userDecisionAt: serverTimestamp(),
      });
    }
    await batch.commit();
    updated += chunk.length;
  }

  return { updated };
}

/**
 * @param {Object} props
 * @param {Function} props.onClose
 * @param {Object[]} props.plans — planos do aluno
 * @param {Object[]} props.trades — trades do aluno (para correlação)
 * @param {Object} props.orderStaging — hook useOrderStaging
 * @param {Object} props.crossCheck — hook useCrossCheck (opcional)
 * @param {Function} [props.onRequestRetroactivePlan] — ({ accountId }) => void. Chamado
 *   quando o aluno clica em "Criar plano retroativo" no banner de gap. Implementação
 *   esperada: navegar para AccountDetailPage com `_autoOpenPlanModal: true` (padrão #154).
 *   Se ausente, o botão do banner não aparece.
 */
const OrderImportPage = ({
  onClose,
  plans = [],
  trades = [],
  orderStaging,
  crossCheck,
  userContext,
  onRequestRetroactivePlan,
}) => {
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

  // Conversational queue (Fase C) — operações classificadas com decisão do aluno
  const [conversationalQueue, setConversationalQueue] = useState([]);
  const [coverageGap, setCoverageGap] = useState({ hasCoverageGap: false, gapOperations: [] });

  // Ingest results
  const [correlationResult, setCorrelationResult] = useState(null);
  const [importSummary, setImportSummary] = useState(null);
  const [confrontData, setConfrontData] = useState(null);

  // UI
  const [progress, setProgress] = useState('');
  const [error, setError] = useState(null);
  const [ingesting, setIngesting] = useState(false);

  // Shadow Behavior Analysis — CF canônica (issue #156 Fase A)
  const { analyze: analyzeShadow } = useShadowAnalysis();

  // Derivar conta do plano selecionado (para gate de plano retroativo + lookup)
  const selectedPlan = useMemo(
    () => plans.find(p => p.id === selectedPlanId) || null,
    [plans, selectedPlanId]
  );
  const accountId = selectedPlan?.accountId || null;

  // Lookup auxiliar: trades indexados por id e agrupados por data (para `new` picker)
  const planTrades = useMemo(
    () => trades.filter(t => t.planId === selectedPlanId),
    [trades, selectedPlanId]
  );
  const tradesById = useMemo(() => new Map(planTrades.map(t => [t.id, t])), [planTrades]);
  const tradesByDate = useMemo(() => {
    const map = new Map();
    for (const t of planTrades) {
      const d = (t.entryTime || t.date || '').slice(0, 10);
      if (!d) continue;
      if (!map.has(d)) map.set(d, []);
      map.get(d).push(t);
    }
    return map;
  }, [planTrades]);

  // ============================================
  // STEP 1: UPLOAD → PARSE
  // ============================================
  const handleParsed = useCallback((result) => {
    setError(null);

    if (!result.text) return;

    // Detect format — tenta múltiplos delimitadores (ProfitChart usa ';', Tradovate usa ',')
    const lines = result.text.replace(/\r\n/g, '\n').split('\n');
    const DELIMITERS = [';', ','];
    let headers = [];
    for (const delim of DELIMITERS) {
      const re = new RegExp(delim === ';' ? ';' : ',', 'g');
      const candidate = lines.find(l => (l.match(re) || []).length >= 10);
      if (candidate) {
        const tokens = candidate.split(delim).map(h => h.trim());
        if (tokens.length > headers.length) headers = tokens;
      }
    }
    const detection = detectOrderFormat(headers);

    setParseResult({ ...result, format: detection.format, confidence: detection.confidence });

    if (!detection.parser) {
      const headerHint = headers.length > 0
        ? ` Cabeçalho detectado: "${headers.slice(0, 5).join(', ')}${headers.length > 5 ? '...' : ''}"`
        : '';
      setError(
        `Este arquivo NÃO é um CSV de ordens reconhecido. Formatos suportados: ProfitChart-Pro, Tradovate. ` +
        `Confira se você não está subindo um arquivo de performance/trades por engano.${headerHint}`
      );
      setParseErrors([]);
      setValidationResult(null);
      setParsedOrders([]);
      return;
    }

    const parsed = detection.parser(result.text);
    setParseErrors(parsed.errors || []);

    const { orders: normalized } = normalizeBatch(parsed.orders);
    const validation = validateBatch(normalized);
    setValidationResult(validation);
    setParsedOrders(validation.validOrders);

    if (validation.validOrders.length > 0) {
      setStep(STEPS.PREVIEW);
    } else {
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
      setProgress('Gravando ordens em staging...');
      const newBatchId = await orderStaging.addStagingBatch(parsedOrders, {
        planId: selectedPlanId,
        sourceFormat: parseResult?.format || 'generic',
        fileName: parseResult?.fileName || null,
      });
      setBatchId(newBatchId);

      setProgress('Reconstruindo operações...');
      const ops = reconstructOperations(parsedOrders);
      associateNonFilledOrders(ops, parsedOrders);
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
  // STEP 4: STAGING REVIEW → CATEGORIZE → CONVERSATIONAL REVIEW
  // ============================================
  const handleStagingConfirm = useCallback(async ({ operations: confirmedOps, confirmedOrderKeys }) => {
    if (!batchId || !orderStaging) return;

    setIngesting(true);
    setError(null);

    try {
      // Filtrar ordens cruas pelo mesmo critério canônico usado em ingestBatch.
      const confirmedSet = new Set(confirmedOrderKeys || []);
      const confirmedOrders = parsedOrders.filter(o => confirmedSet.has(makeOrderKey(o)));

      // 1. Ingest (staging → orders, deleta o resto) — mantido intacto.
      setProgress('Ingerindo ordens das operações confirmadas...');
      await orderStaging.ingestBatch(batchId, {}, confirmedOrderKeys);

      // 2. Correlate com trades do plano.
      setProgress('Correlacionando com trades...');
      const { correlations, stats: corrStats } = correlateOrders(confirmedOrders, planTrades);
      setCorrelationResult({ correlations, stats: corrStats });

      // 3. Cross-check (persistido — não exibido ao aluno).
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

      // 4. Categorização → 4 classes (Fase B).
      setProgress('Classificando operações...');
      const { toCreate, toConfront, ambiguous, autoliq } =
        categorizeConfirmedOps(confirmedOps, correlations);

      // 5. Monta fila unificada — cada item carrega sua classificação persistida.
      const queue = [
        ...toCreate.map(op => ({
          operation: op,
          classification: CLASSIFICATION.NEW,
          matchCandidates: op.matchCandidates || [],
          userDecision: 'pending',
        })),
        ...toConfront.map(({ operation, tradeId, matchCandidates }) => ({
          operation,
          classification: CLASSIFICATION.MATCH_CONFIDENT,
          tradeId,
          matchCandidates: matchCandidates || [],
          userDecision: 'pending',
        })),
        ...ambiguous.map(({ operation, tradeIds, matchCandidates }) => ({
          operation,
          classification: CLASSIFICATION.AMBIGUOUS,
          tradeIds,
          matchCandidates: matchCandidates || [],
          userDecision: 'pending',
        })),
        ...autoliq.map(({ operation, tradeIds, matchCandidates }) => ({
          operation,
          classification: CLASSIFICATION.AUTOLIQ,
          tradeIds,
          matchCandidates: matchCandidates || [],
          userDecision: 'pending',
        })),
      ];

      // 6. Gate de cobertura: SÓ operações NOVAS (toCreate) precisam de plano
      // cobrindo a data. Operações MATCH_CONFIDENT/AMBIGUOUS/AUTOLIQ já casaram
      // com trades existentes e portanto já estavam cobertas no momento em que
      // o trade foi criado — não exigir plano retroativo nelas.
      const gap = detectCoverageGap({
        operations: toCreate,
        plans,
        accountId,
      });
      setCoverageGap(gap);

      setConversationalQueue(queue);
      setStep(STEPS.CONVERSATIONAL_REVIEW);
      setProgress('');
    } catch (err) {
      console.error('[OrderImportPage] Classification error:', err);
      setError(err.message);
      setStep(STEPS.STAGING_REVIEW);
      setProgress('');
    } finally {
      setIngesting(false);
    }
  }, [batchId, parsedOrders, selectedPlanId, plans, accountId, planTrades, orderStaging, crossCheck]);

  // ============================================
  // STEP 5: CONVERSATIONAL REVIEW — handlers
  // ============================================
  const handleDecide = useCallback((index, payload) => {
    setConversationalQueue(prev => {
      const next = [...prev];
      const current = next[index];
      if (!current) return prev;
      next[index] = {
        ...current,
        userDecision: payload.decision,
        userDecisionAt: payload.decision === 'pending' ? null : new Date().toISOString(),
        tradeId: payload.tradeId ?? current.tradeId,
        userAdjustments: payload.adjustments ?? null,
        promotedFrom: payload.promotedFrom ?? current.promotedFrom ?? null,
      };
      return next;
    });
  }, []);

  const handleRetroactivePlan = useCallback(() => {
    if (onRequestRetroactivePlan && accountId) {
      onRequestRetroactivePlan({ accountId });
    }
  }, [onRequestRetroactivePlan, accountId]);

  // ============================================
  // STEP 6: INGESTING — processa decisões do aluno
  // ============================================
  const handleConversationalSubmit = useCallback(async () => {
    if (coverageGap.hasCoverageGap) return; // Gate duro

    setStep(STEPS.INGESTING);
    setIngesting(true);
    setError(null);

    try {
      // Resolver tickerRules dos instrumentos de todas as ops confirmadas.
      const confirmedItems = conversationalQueue.filter(
        i => i.userDecision === 'confirmed' || i.userDecision === 'adjusted'
      );
      const instruments = [...new Set(
        confirmedItems.map(i => (i.operation.instrument || '').toUpperCase())
      )];
      const tickerRuleMap = {};
      for (const symbol of instruments) {
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

      const lowResolution = !!parseResult?.lowResolution;

      // Roteia decisões em buckets (helper puro — ver conversationalIngest.js).
      const { toEnrich, toCreate: toCreateOps, discarded } =
        routeConversationalDecisions(conversationalQueue);

      // Criação via gateway (INV-02) com throttling.
      setProgress('Criando trades a partir das decisões...');
      const batchResult = await createTradesBatch({
        toCreate: toCreateOps,
        planId: selectedPlanId,
        importBatchId: batchId,
        tickerRuleMap,
        lowResolution,
        existingTrades: planTrades,
        userContext,
        onProgress: (_current, _total, message) => setProgress(message),
      });

      // Enriquecimento real — chama tradeGateway.enrichTrade por item.
      setProgress('Enriquecendo trades existentes com dados da corretora...');
      const enrichResult = await enrichConversationalBatch({
        toEnrich,
        userContext,
        tickerRuleMap,
        importBatchId: batchId,
        enrichTradeFn: enrichTrade,
      });

      // Painel de confronto: mostra o que foi enriquecido (before vs after)
      // para auditoria visual. Classifica entre divergent (ajustes reais no patch)
      // e converged (patch idempotente — nada mudou).
      const divergent = [];
      const converged = [];
      for (const entry of enrichResult.enriched) {
        const trade = tradesById.get(entry.tradeId);
        const item = toEnrich.find(i => i.tradeId === entry.tradeId);
        if (!trade || !item) continue;
        const comparison = compareOperationWithTrade(item.operation, trade);
        if (comparison.hasDivergences) {
          divergent.push({ operation: item.operation, trade, comparison });
        } else {
          converged.push({ operation: item.operation, trade });
        }
      }
      if (divergent.length > 0 || converged.length > 0 || enrichResult.failed.length > 0) {
        setConfrontData({ divergent, converged });
      }

      // Persist userDecision: 'discarded' nos docs de `orders` correspondentes.
      // A operação teve suas ordens ingeridas no step anterior (handleStagingConfirm);
      // aqui marcamos as ordens como descartadas para auditoria downstream.
      if (discarded.length > 0 && batchId) {
        try {
          setProgress('Registrando decisões de descarte...');
          await persistDiscardedOrders({ batchId, discardedItems: discarded });
        } catch (discErr) {
          console.warn('[OrderImportPage] Persist discarded failed (non-blocking):', discErr.message);
        }
      }

      // Summary para STEP DONE.
      const byClass = {
        new: conversationalQueue.filter(i => i.classification === CLASSIFICATION.NEW).length,
        match_confident: conversationalQueue.filter(i => i.classification === CLASSIFICATION.MATCH_CONFIDENT).length,
        ambiguous: conversationalQueue.filter(i => i.classification === CLASSIFICATION.AMBIGUOUS).length,
        autoliq: conversationalQueue.filter(i => i.classification === CLASSIFICATION.AUTOLIQ).length,
      };
      const discardedCount = conversationalQueue.filter(i => i.userDecision === 'discarded').length;

      setImportSummary({
        ordersConfirmed: null, // substituído pelo confirmedItems.length abaixo
        opsConfirmed: confirmedItems.length,
        tradesCreated: batchResult.created,
        tradesDuplicates: batchResult.duplicates.length,
        tradesFailed: batchResult.failed,
        enrichedCount: enrichResult.enriched.length,
        enrichFailed: enrichResult.failed,
        discardedCount,
        byClass,
        lowResolution,
      });

      // Shadow Behavior Analysis (pós-import) — CF canônica.
      if (userContext?.uid) {
        try {
          setProgress('Analisando comportamento...');
          const dates = confirmedItems
            .map(i => (i.operation.entryTime || i.operation.entryOrders?.[0]?.filledAt || '').split('T')[0])
            .filter(Boolean)
            .sort();
          const dateFrom = dates[0] || null;
          const dateTo = dates[dates.length - 1] || null;
          const result = await analyzeShadow({ studentId: userContext.uid, dateFrom, dateTo });
          console.log(`[OrderImportPage] Shadow: ${result?.analyzed ?? 0}/${result?.total ?? 0}`);
        } catch (shadowErr) {
          console.warn('[OrderImportPage] Shadow behavior analysis failed:', shadowErr.message);
        }
      }

      setStep(STEPS.DONE);
      setProgress('');
    } catch (err) {
      console.error('[OrderImportPage] Ingest error:', err);
      setError(err.message);
      setStep(STEPS.CONVERSATIONAL_REVIEW);
      setProgress('');
    } finally {
      setIngesting(false);
    }
  }, [
    coverageGap.hasCoverageGap,
    conversationalQueue,
    parseResult,
    planTrades,
    selectedPlanId,
    batchId,
    userContext,
    tradesById,
    analyzeShadow,
  ]);

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

          {/* ── CONVERSATIONAL REVIEW (Fase C) ── */}
          {step === STEPS.CONVERSATIONAL_REVIEW && (
            <ConversationalReview
              queue={conversationalQueue}
              tradesById={tradesById}
              tradesByDate={tradesByDate}
              coverageGap={coverageGap}
              onDecide={handleDecide}
              onBack={() => setStep(STEPS.STAGING_REVIEW)}
              onSubmit={handleConversationalSubmit}
              onCreateRetroactivePlan={onRequestRetroactivePlan ? handleRetroactivePlan : null}
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
                {importSummary ? (
                  <>
                    <p className="text-sm font-semibold text-white">
                      {importSummary.opsConfirmed} operaç{importSummary.opsConfirmed === 1 ? 'ão' : 'ões'} processada{importSummary.opsConfirmed === 1 ? '' : 's'}
                    </p>
                    <p className="text-xs text-slate-400 text-center max-w-md">
                      {importSummary.tradesCreated?.length > 0 && (
                        <>{importSummary.tradesCreated.length} trade{importSummary.tradesCreated.length > 1 ? 's' : ''} criado{importSummary.tradesCreated.length > 1 ? 's' : ''}</>
                      )}
                      {importSummary.enrichedCount > 0 && (
                        <>{importSummary.tradesCreated?.length > 0 ? ' · ' : ''}{importSummary.enrichedCount} enriquecido{importSummary.enrichedCount === 1 ? '' : 's'}</>
                      )}
                      {importSummary.discardedCount > 0 && (
                        <> · {importSummary.discardedCount} descartada{importSummary.discardedCount === 1 ? '' : 's'}</>
                      )}
                      {importSummary.tradesDuplicates > 0 && (
                        <> · {importSummary.tradesDuplicates} duplicata{importSummary.tradesDuplicates > 1 ? 's' : ''} ignorada{importSummary.tradesDuplicates > 1 ? 's' : ''}</>
                      )}
                      {importSummary.tradesFailed?.length > 0 && (
                        <> · <span className="text-red-400">{importSummary.tradesFailed.length} falha{importSummary.tradesFailed.length > 1 ? 's' : ''}</span></>
                      )}
                      {importSummary.lowResolution && (
                        <> · <span className="text-amber-400/80" title="CSV exportado sem segundos — padrões comportamentais dependentes de granularidade fina ficam inconclusive">baixa resolução</span></>
                      )}
                    </p>
                  </>
                ) : (
                  <p className="text-sm font-semibold text-white">
                    Importação concluída
                  </p>
                )}
              </div>

              {correlationResult && (
                <OrderCorrelation
                  correlations={correlationResult.correlations}
                  stats={correlationResult.stats}
                />
              )}

              {importSummary && (
                <CreationResultPanel
                  summary={{
                    created: importSummary.tradesCreated || [],
                    duplicates: importSummary.tradesDuplicates || 0,
                    failed: importSummary.tradesFailed || [],
                  }}
                />
              )}

              {confrontData && (
                <MatchedOperationsPanel confrontData={confrontData} />
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
