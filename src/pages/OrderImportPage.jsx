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

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { X, Upload, CheckCircle, AlertTriangle, ArrowLeft, ArrowRight, Loader2, FileClock } from 'lucide-react';
import DebugBadge from '../components/DebugBadge';
import OrderUploader from '../components/OrderImport/OrderUploader';
import OrderPreview from '../components/OrderImport/OrderPreview';
import OrderValidationReport from '../components/OrderImport/OrderValidationReport';
import OrderStagingReview from '../components/OrderImport/OrderStagingReview';
import OrderCorrelation from '../components/OrderImport/OrderCorrelation';
import CreationResultPanel from '../components/OrderImport/CreationResultPanel';
import MatchedOperationsPanel from '../components/OrderImport/MatchedOperationsPanel';
import ConversationalReview from '../components/OrderImport/ConversationalReview';

import { TIMEZONES, TIMEZONE_LIST } from '../utils/tradeTimezone';
import { detectOrderFormat } from '../utils/orderParsers';
import { normalizeBatch } from '../utils/orderNormalizer';
import { validateBatch } from '../utils/orderValidation';
import { reconstructOperations, associateNonFilledOrders } from '../utils/orderReconstruction';
import { enrichOperationsWithStopAnalysis } from '../utils/stopMovementAnalysis';
import { enrichOperationsWithStopSemantic } from '../utils/stopSemantic';
import { correlateOrders, correlateCancelledOrders } from '../utils/orderCorrelation';
import { categorizeConfirmedOps, CLASSIFICATION } from '../utils/orderTradeCreation';
import { createTradesBatch } from '../utils/orderTradeBatch';
import { compareOperationWithTrade } from '../utils/orderTradeComparison';
import { enrichTrade } from '../utils/tradeGateway';
import { makeOrderKey } from '../utils/orderKey';
import { detectCoverageGap } from '../utils/planCoverage';
import { enrichConversationalBatch } from '../utils/conversationalIngest';
import { persistImportDecisions, stagingDocsToOrders, orderTradeLinks } from '../utils/orderImportPipeline';
import { indexExistingOrders, detectAlreadyImported } from '../utils/orderDedup';
import { useShadowAnalysis } from '../hooks/useShadowAnalysis';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { useConfirmDialog } from '../components/ConfirmDialog';

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
  existingOrders = [],
  ordersLoading = false,
  studentId = null,
  resumeBatch = null,
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
  // Fuso do lote (#292): em que fuso estão os horários das ordens do arquivo.
  // Começa em BRANCO — o aluno é obrigado a eleger antes de analisar (sem sticky
  // silencioso, que metia ET de import anterior). Aplicado na reconstrução → ISO+offset.
  const [importTimezone, setImportTimezone] = useState('');

  // Staging + reconstruction
  const [batchId, setBatchId] = useState(null);
  const [reconstructedOps, setReconstructedOps] = useState([]);

  // Conversational queue (Fase C) — operações classificadas com decisão do aluno
  const [conversationalQueue, setConversationalQueue] = useState([]);
  const [coverageGap, setCoverageGap] = useState({ hasCoverageGap: false, gapOperations: [] });
  const [gapResolution, setGapResolution] = useState(null); // null | 'accepted' | 'discarded'

  // Material da correlação, calculado na revisão e consumido no passo final (#366)
  const [stagedCorrelations, setStagedCorrelations] = useState(null);
  // Marca que a ingestão do lote já concluiu: um retry após falha na criação de
  // trades não pode reingerir (nem morrer tentando).
  const ingestedBatchRef = useRef(null);

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

  // Confirmações inline (nunca window.confirm) — #366
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

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

  // Índice do que já está em `orders` — porta de entrada do import (#366). Bi-chave e
  // escopado por aluno; ver orderDedup.js. Alimenta o aviso de duplicata no preview e
  // o skip da ingestão, que é o que mantém toda escrita como `create`.
  const existingOrderIndex = useMemo(
    () => indexExistingOrders(existingOrders, studentId),
    [existingOrders, studentId],
  );
  const existingOrderKeys = useMemo(
    () => new Set(existingOrderIndex.keys()),
    [existingOrderIndex],
  );
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
    // lowResolution vem do parser e era descartado no set acima — o badge de baixa
    // resolução nunca aparecia e o flag chegava sempre `false` na criação (#366).
    setParseResult({
      ...result,
      format: detection.format,
      confidence: detection.confidence,
      lowResolution: !!parsed.lowResolution,
    });

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

  // Ordens do arquivo que já estão em `orders` (#366). Enquanto a lista do dashboard
  // carrega não há resposta: acusar "nenhuma duplicata" contra lista vazia seria pior
  // que não acusar nada — `useOrders` roda sempre pelo fallback, sem índice.
  const duplicateIndexes = useMemo(() => {
    if (ordersLoading || parsedOrders.length === 0) return null;
    return detectAlreadyImported(parsedOrders, existingOrderIndex).duplicateIndexes;
  }, [ordersLoading, parsedOrders, existingOrderIndex]);

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
    if (!selectedPlanId || !orderStaging || !importTimezone) return;

    setStep(STEPS.STAGING_WRITE);
    setError(null);

    try {
      // Voltar da revisão e reconfirmar criava um segundo lote e abandonava o
      // primeiro no staging — ghost que ninguém via nem limpava (#366).
      if (batchId) {
        setProgress('Descartando o rascunho anterior...');
        try {
          await orderStaging.deleteStagingBatch(batchId);
        } catch (delErr) {
          console.warn('[OrderImportPage] Falha ao descartar lote anterior:', delErr.message);
        }
      }

      setProgress('Gravando ordens em staging...');
      const newBatchId = await orderStaging.addStagingBatch(parsedOrders, {
        planId: selectedPlanId,
        sourceFormat: parseResult?.format || 'generic',
        fileName: parseResult?.fileName || null,
        // Sem o fuso persistido, retomar o lote não consegue refazer a reconstrução.
        importTimezone,
      });
      setBatchId(newBatchId);

      setProgress('Reconstruindo operações...');
      const ops = reconstructOperations(parsedOrders, { timezone: importTimezone });
      associateNonFilledOrders(ops, parsedOrders);
      enrichOperationsWithStopSemantic(ops);
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
  }, [selectedPlanId, parsedOrders, parseResult, orderStaging, importTimezone, batchId]);

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

      // 1. Correlate ANTES de ingerir — issue #208: o pipeline anterior chamava
      //    ingestBatch(batchId, {}, ...) e gravava todas as orders com
      //    correlatedTradeId=null, deixando o sensor comportamental cego.
      //    Agora correlacionamos primeiro (FILLED + CANCELLED) e passamos o
      //    mapping pra ingestBatch.
      setProgress('Correlacionando com trades...');
      const { correlations, stats: corrStats } = correlateOrders(confirmedOrders, planTrades);
      const cancelledCorrs = correlateCancelledOrders(
        confirmedOrders.filter(o => o.status === 'CANCELLED' || o.status === 'REJECTED' || o.status === 'EXPIRED'),
        planTrades,
      );
      setCorrelationResult({ correlations, stats: corrStats });

      // 2. Guardar o material do passo final. NADA é gravado aqui (#366): a ingestão
      //    para `orders` acontece depois da decisão por operação, junto com a criação
      //    dos trades. Antes o lote inteiro era ingerido nesta linha, e o que o aluno
      //    descartasse na tela seguinte já estava gravado sem caminho de volta —
      //    `orders` não aceita delete do cliente.
      setStagedCorrelations({ correlations, cancelledCorrs, confirmedOrders, confirmedOrderKeys });

      // 3. Categorização → 4 classes (Fase B).
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
      setGapResolution(null);

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
  }, [batchId, parsedOrders, plans, accountId, planTrades, orderStaging]);

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

  // Aceitar as operações do gap NO plano existente: confirma-as (serão criadas sob
  // selectedPlanId, mesmo com data anterior ao início do plano) e marca o gap resolvido.
  const handleAcceptGapInPlan = useCallback(() => {
    const gapOps = new Set(coverageGap.gapOperations.map(g => g.operation));
    setConversationalQueue(prev => prev.map(item =>
      gapOps.has(item.operation) && (!item.userDecision || item.userDecision === 'pending')
        ? { ...item, userDecision: 'confirmed', userDecisionAt: new Date().toISOString() }
        : item
    ));
    setGapResolution('accepted');
  }, [coverageGap]);

  // Descartar as operações do gap: marca-as como discarded (não serão criadas).
  const handleDiscardGap = useCallback(() => {
    const gapOps = new Set(coverageGap.gapOperations.map(g => g.operation));
    setConversationalQueue(prev => prev.map(item =>
      gapOps.has(item.operation)
        ? { ...item, userDecision: 'discarded', userDecisionAt: new Date().toISOString() }
        : item
    ));
    setGapResolution('discarded');
  }, [coverageGap]);

  // ============================================
  // STEP 6: INGESTING — processa decisões do aluno
  // ============================================
  const handleConversationalSubmit = useCallback(async () => {
    if (coverageGap.hasCoverageGap && gapResolution == null) return; // Gate: só bloqueia gap não resolvido

    // Operação sem decisão não vira trade nem ordem — some. Antes isso acontecia em
    // silêncio: `pending` não entra em bucket nenhum no roteamento (#366).
    const pendingCount = conversationalQueue.filter(i => i.userDecision === 'pending').length;
    if (pendingCount > 0) {
      const seguir = await confirm({
        title: 'Operações sem decisão',
        body: `${pendingCount} ${pendingCount === 1 ? 'operação continua' : 'operações continuam'} sem decisão. `
          + 'As ordens delas não serão importadas e nenhum trade será criado a partir delas.',
        confirmLabel: 'Continuar assim mesmo',
        cancelLabel: 'Voltar e decidir',
        tone: 'warning',
      });
      if (!seguir) return;
    }

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

      // Gravação na ordem obrigatória: ordens confirmadas → trades → enriquecimento.
      // A ordem é contrato (ver persistImportDecisions): linkOrdersToCreatedTrade roda
      // dentro de onTradeCreated e desiste se não achar as ordens do batch (#351).
      const autoCorrs = [
        ...(stagedCorrelations?.correlations || []),
        ...(stagedCorrelations?.cancelledCorrs || []),
      ];
      const { batchResult, enrichResult, toEnrich } = await persistImportDecisions({
        queue: conversationalQueue,
        autoCorrelations: autoCorrs,
        existingKeys: existingOrderKeys,
        alreadyIngested: !batchId || !orderStaging || ingestedBatchRef.current === batchId,
        ingestFn: async (correlations, orderKeys, options) => {
          setProgress('Gravando as ordens das operações confirmadas...');
          const r = await orderStaging.ingestBatch(batchId, correlations, orderKeys, options);
          ingestedBatchRef.current = batchId;
          console.log('[OrderImportPage] Ingest pós-decisão:', r);
          return r;
        },
        createFn: (toCreateOps) => {
          setProgress('Criando trades a partir das decisões...');
          return createTradesBatch({
            toCreate: toCreateOps,
            planId: selectedPlanId,
            importBatchId: batchId,
            tickerRuleMap,
            lowResolution,
            existingTrades: planTrades,
            userContext,
            onProgress: (_current, _total, message) => setProgress(message),
          });
        },
        enrichFn: (toEnrich) => {
          setProgress('Enriquecendo trades existentes com dados da corretora...');
          return enrichConversationalBatch({
            toEnrich,
            userContext,
            tickerRuleMap,
            importBatchId: batchId,
            enrichTradeFn: enrichTrade,
          });
        },
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

      // Operação descartada não precisa de marcação: suas ordens nunca chegaram em
      // `orders` (#366). Antes a ingestão acontecia na tela anterior e a marcação de
      // descarte era um update — negado pelas rules e engolido por try/catch, o que
      // deixava o ghost gravado e sem rastro nenhum da decisão do aluno.

      // 3. Cross-check (persistido — não exibido ao aluno). Confronta o extrato contra
      //    os trades que JÁ existiam quando o import começou; os criados agora não
      //    entram, porque `correlateOrders` exige `entryTime` e o retorno de
      //    createTradesBatch não o carrega. Semântica declarada, não acidental.
      const confirmedOrders = stagedCorrelations?.confirmedOrders || [];
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

      // Summary para STEP DONE.
      const byClass = {
        new: conversationalQueue.filter(i => i.classification === CLASSIFICATION.NEW).length,
        match_confident: conversationalQueue.filter(i => i.classification === CLASSIFICATION.MATCH_CONFIDENT).length,
        ambiguous: conversationalQueue.filter(i => i.classification === CLASSIFICATION.AMBIGUOUS).length,
        autoliq: conversationalQueue.filter(i => i.classification === CLASSIFICATION.AUTOLIQ).length,
      };
      const discardedCount = conversationalQueue.filter(i => i.userDecision === 'discarded').length;
      const pendingDiscardedCount = conversationalQueue.filter(i => i.userDecision === 'pending').length;

      setImportSummary({
        ordersConfirmed: null, // substituído pelo confirmedItems.length abaixo
        opsConfirmed: confirmedItems.length,
        tradesCreated: batchResult.created,
        tradesDuplicates: batchResult.duplicates.length,
        tradesFailed: batchResult.failed,
        enrichedCount: enrichResult.enriched.length,
        enrichFailed: enrichResult.failed,
        discardedCount,
        pendingDiscardedCount,
        byClass,
        lowResolution,
      });

      // Fecha o lote: ordem que não ficou atrelada a nenhum trade vivo é apagada
      // (v1.83.16). Regra: ordem sem trade não existe. Server-side porque
      // `firestore.rules` tem `allow delete: if false` em /orders — foi assim que
      // importações abandonadas deixaram centenas de ordens presas em produção.
      // Roda DEPOIS da criação dos trades: a correlação acontece em onTradeCreated.
      if (batchId) {
        try {
          setProgress('Limpando ordens que não viraram trade...');
          const finalize = httpsCallable(functions, 'finalizeOrderImport');
          // O vínculo vai explícito: o servidor não tem como deduzir o trade de uma
          // ordem que nunca executou (stop cancelado), e sem trade ela seria apagada.
          const links = orderTradeLinks(conversationalQueue, batchResult.created);
          const { data: purge } = await finalize({ batchId, links });
          console.log(`[OrderImportPage] Lote fechado: ${purge?.linked ?? 0} ordens ligadas, ${purge?.deleted ?? 0} sem trade apagadas`);
        } catch (purgeErr) {
          // Não bloqueia o import: a varredura diária pega o que sobrar.
          console.warn('[OrderImportPage] Falha ao fechar o lote:', purgeErr.message);
        }
      }

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
    gapResolution,
    conversationalQueue,
    parseResult,
    planTrades,
    selectedPlanId,
    batchId,
    userContext,
    tradesById,
    analyzeShadow,
    orderStaging,
    crossCheck,
    stagedCorrelations,
    existingOrderKeys,
    confirm,
  ]);

  // Lotes que ficaram para trás — o daqui de dentro (batchId) não conta.
  const rascunhosPendentes = useMemo(
    () => (orderStaging?.stagingBatches || []).filter(b => b.batchId !== batchId),
    [orderStaging, batchId],
  );

  const handleDescartarRascunho = useCallback(async (alvo) => {
    const ok = await confirm({
      title: 'Descartar o rascunho anterior?',
      body: 'As ordens daquela importação inacabada serão removidas. Nada delas foi gravado.',
      confirmLabel: 'Descartar',
      cancelLabel: 'Manter',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await orderStaging.deleteStagingBatch(alvo);
    } catch (err) {
      console.warn('[OrderImportPage] Falha ao descartar rascunho anterior:', err.message);
    }
  }, [confirm, orderStaging]);

  // ============================================
  // RETOMADA de lote pendente (#366)
  // ============================================
  // O rascunho guarda tudo que o parser produziu, menos `_rowIndex` — que é o join da
  // correlação. stagingDocsToOrders reatribui; sem isso cada operação já confrontada
  // voltaria como trade novo. O fuso vem do próprio lote (importTimezone), porque
  // repedir abriria espaço para o aluno reconfirmar um fuso diferente do original.
  const resumedRef = useRef(null);
  useEffect(() => {
    if (!resumeBatch || resumedRef.current === resumeBatch.batchId) return;
    resumedRef.current = resumeBatch.batchId;

    const orders = stagingDocsToOrders(resumeBatch.orders || []);
    if (orders.length === 0) return;

    setParsedOrders(orders);
    setParseResult({
      fileName: resumeBatch.fileName || null,
      format: resumeBatch.sourceFormat || 'generic',
      confidence: 1,
      lowResolution: false,
      resumed: true,
    });
    setSelectedPlanId(resumeBatch.planId || '');
    setBatchId(resumeBatch.batchId);

    if (!resumeBatch.importTimezone) {
      // Lote gravado antes do #366: o fuso não foi persistido e não dá para adivinhar.
      setImportTimezone('');
      setStep(STEPS.PLAN_SELECT);
      setError('Este rascunho é anterior ao registro de fuso. Confirme o fuso dos horários do arquivo para continuar.');
      return;
    }

    setImportTimezone(resumeBatch.importTimezone);
    const ops = reconstructOperations(orders, { timezone: resumeBatch.importTimezone });
    associateNonFilledOrders(ops, orders);
    enrichOperationsWithStopSemantic(ops);
    enrichOperationsWithStopAnalysis(ops);
    setReconstructedOps(ops);
    setStep(STEPS.STAGING_REVIEW);
  }, [resumeBatch]);

  // ============================================
  // SAÍDA — o rascunho não pode sobreviver ao fechamento (#366)
  // ============================================
  // Enquanto o lote está em staging ele é reversível: a collection é isolada e o
  // cliente pode apagar. Depois da ingestão não é mais — `orders` não aceita delete —
  // e por isso o X fica travado durante a gravação em vez de "cancelável".
  const temRascunhoVivo = !!batchId && step !== STEPS.DONE && ingestedBatchRef.current !== batchId;
  const gravando = step === STEPS.STAGING_WRITE || step === STEPS.INGESTING;

  const handleRequestClose = useCallback(async () => {
    if (gravando) return;

    if (temRascunhoVivo && orderStaging) {
      const total = (orderStaging.stagingOrders || []).filter(o => o.importBatchId === batchId).length;
      const descartar = await confirm({
        title: 'Descartar esta importação?',
        body: total > 0
          ? `As ${total} ordens do rascunho serão removidas. O arquivo continua no seu computador — dá para importar de novo depois.`
          : 'O rascunho desta importação será removido.',
        confirmLabel: 'Descartar',
        cancelLabel: 'Continuar importando',
        tone: 'danger',
      });
      if (!descartar) return;

      try {
        await orderStaging.deleteStagingBatch(batchId);
      } catch (err) {
        console.warn('[OrderImportPage] Falha ao descartar rascunho:', err.message);
      }
    }

    onClose();
  }, [gravando, temRascunhoVivo, orderStaging, batchId, confirm, onClose]);

  // Refresh e fechar aba não passam por onClose — sem isto o rascunho fica órfão.
  useEffect(() => {
    if (!temRascunhoVivo && !gravando) return;
    const aviso = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, [temRascunhoVivo, gravando]);

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
            onClick={handleRequestClose}
            disabled={gravando}
            title={gravando ? 'Gravando — aguarde terminar' : 'Fechar'}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {confirmDialog}

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
            <>
              {/* Rascunho de uma importação anterior (#366): antes ele ficava preso no
                  staging sem tela nenhuma que o mostrasse. */}
              {rascunhosPendentes.length > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <FileClock className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-xs text-amber-200">
                      Você tem uma importação não finalizada
                      {rascunhosPendentes[0].fileName ? ` (${rascunhosPendentes[0].fileName})` : ''}
                      {' '}com {rascunhosPendentes[0].totalCount} {rascunhosPendentes[0].totalCount === 1 ? 'ordem' : 'ordens'}.
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Nada dela foi importado ainda. Feche esta janela para retomá-la pelo
                      card do painel, ou descarte para começar do zero.
                    </p>
                    <button
                      onClick={() => handleDescartarRascunho(rascunhosPendentes[0].batchId)}
                      className="text-[11px] text-red-300 hover:text-red-200 underline underline-offset-2"
                    >
                      Descartar rascunho anterior
                    </button>
                  </div>
                </div>
              )}
              <OrderUploader onParsed={handleParsed} />
            </>
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
                  {ordersLoading && (
                    <span className="text-[10px] text-slate-500">
                      · conferindo o que já foi importado...
                    </span>
                  )}
                </div>
              )}

              <OrderValidationReport validationResult={validationResult} parseErrors={parseErrors} />

              <OrderPreview
                orders={parsedOrders}
                duplicateIndexes={duplicateIndexes}
                loading={ordersLoading}
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

              {/* Fuso do lote (#292): em que fuso estão os horários das ordens */}
              <div className="panel p-3">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Fuso dos horários do arquivo
                </label>
                <select
                  value={importTimezone}
                  onChange={(e) => setImportTimezone(e.target.value)}
                  className={`w-full bg-slate-800/80 border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 appearance-none cursor-pointer ${importTimezone ? 'border-slate-700/50' : 'border-amber-500/50'}`}
                >
                  <option value="" disabled>Selecione o fuso…</option>
                  {TIMEZONE_LIST.map(tz => (
                    <option key={tz.id} value={tz.id}>{tz.label}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Corretora US (ex.: Tradovate) normalmente exporta em ET; corretora BR em Brasília.
                </p>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setStep(STEPS.PREVIEW)}
                  className="flex items-center gap-1 px-3 py-2 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Voltar
                </button>
                <button
                  onClick={handlePlanConfirm}
                  disabled={!selectedPlanId || !importTimezone}
                  title={!importTimezone ? 'Eleja o fuso dos horários do arquivo antes de analisar' : ''}
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
              gapResolution={gapResolution}
              onDecide={handleDecide}
              onBack={() => setStep(STEPS.STAGING_REVIEW)}
              onSubmit={handleConversationalSubmit}
              onCreateRetroactivePlan={onRequestRetroactivePlan ? handleRetroactivePlan : null}
              onAcceptGapInPlan={handleAcceptGapInPlan}
              onDiscardGap={handleDiscardGap}
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
                  onClick={handleRequestClose}
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
