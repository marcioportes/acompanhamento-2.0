/**
 * useCsvStaging
 * @version 1.2.0 (v1.55.1 — issue #240)
 * @description Hook para gerenciar trades em staging (collection csvStagingTrades).
 *   Trades importados via CSV ficam aqui até serem "ativados" — momento em que
 *   são passados para addTrade (useTrades) e deletados do staging.
 *
 * CHANGELOG:
 * - 1.2.0: issue #240 — activateTrade/activateBatch aceitam options com
 *   `existingTrades` + `updateTradeFn`. (a) Duplicatas detectadas via
 *   `checkDuplication` (critério do Order Import); (b) quando duplicado e o CSV
 *   traz mepPrice/menPrice/excursionSource ausentes no trade existente, faz
 *   **auto-enrich silencioso** (nunca sobrescreve) reportado em `enriched[]`;
 *   senão, `skipped[]` puro. Fecha gap onde `csv_import` criava trades duplicados
 *   sobre `order_import` ou manual e onde MEP/MEN do CSV se perdiam.
 * - 1.1.0: C2 (v1.19.1) — activateTrade busca tickerRule do master data (tickers collection)
 *   quando staging não possui tickerRule, usando exchange+symbol lookup.
 *
 * PRINCÍPIO: csvStagingTrades é 100% isolada de trades/movements/CFs.
 *   Nenhuma Cloud Function observa esta collection.
 *   Nenhum listener de useTrades vê estes documentos.
 *
 * EXPORTS (via hook):
 *   stagingTrades, loading, error
 *   addStagingBatch(trades, meta) → Promise<string> (batchId)
 *   updateStagingTrade(tradeId, updates) → Promise<void>
 *   deleteStagingTrade(tradeId) → Promise<void>
 *   deleteStagingBatch(batchId) → Promise<number> (count deleted)
 *   activateTrade(stagingTrade, addTradeFn) → Promise<string> (new trade id)
 *   activateBatch(tradeIds, addTradeFn, onProgress) → Promise<{ success, failed }>
 *
 * @firestore csvStagingTrades — sem index composto necessário (queries simples por studentId)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, getDocs,
  writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { checkDuplication } from '../utils/orderTradeCreation';
import { validateExcursionPrices } from '../utils/tradeGateway';
import { computeExcursionEnrichmentPatch } from '../utils/csvEnrichmentPatch';

const COLLECTION = 'csvStagingTrades';

/**
 * @param {string|null} overrideStudentId - UID do aluno (para mentor view-as-student)
 */
const useCsvStaging = (overrideStudentId = null) => {
  const { user, isMentor } = useAuth();
  const [stagingTrades, setStagingTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ============================================
  // LISTENER
  // ============================================
  useEffect(() => {
    if (!user) {
      setStagingTrades([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const targetId = overrideStudentId ?? user.uid;
    let q;

    if (isMentor() && !overrideStudentId) {
      // Mentor sem override: vê todos os staging trades
      q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
    } else {
      // Aluno ou mentor com override: filtra por studentId
      q = query(
        collection(db, COLLECTION),
        where('studentId', '==', targetId),
        orderBy('createdAt', 'desc')
      );
    }

    let fallbackUnsub = null;

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setStagingTrades(data);
        setLoading(false);
      },
      (err) => {
        console.error('[useCsvStaging] Listener error:', err);
        // Fallback sem orderBy (index pode não existir)
        const fallbackQ = overrideStudentId || !isMentor()
          ? query(collection(db, COLLECTION), where('studentId', '==', targetId))
          : query(collection(db, COLLECTION));

        fallbackUnsub = onSnapshot(
          fallbackQ,
          (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            data.sort((a, b) => {
              const aTime = a.createdAt?.seconds ?? 0;
              const bTime = b.createdAt?.seconds ?? 0;
              return bTime - aTime;
            });
            setStagingTrades(data);
            setLoading(false);
          },
          (fallbackErr) => {
            console.error('[useCsvStaging] Fallback error:', fallbackErr);
            setStagingTrades([]);
            setLoading(false);
            setError(fallbackErr.message);
          }
        );
      }
    );

    return () => {
      unsub();
      if (fallbackUnsub) fallbackUnsub();
    };
  }, [user, isMentor, overrideStudentId]);

  // ============================================
  // ADD BATCH — grava trades parseados em staging
  // ============================================
  /**
   * @param {Object[]} trades - Array de trades mapeados (output do csvMapper)
   * @param {Object} meta - { planId, importTemplateName, importSource }
   * @returns {Promise<string>} importBatchId
   */
  const addStagingBatch = useCallback(async (trades, meta = {}) => {
    if (!user) throw new Error('Autenticação necessária');
    if (!trades?.length) throw new Error('Nenhum trade para importar');

    const batchId = `csv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = serverTimestamp();

    // Firestore writeBatch max = 500 docs
    const BATCH_SIZE = 450;
    let written = 0;

    for (let i = 0; i < trades.length; i += BATCH_SIZE) {
      const chunk = trades.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);

      for (const trade of chunk) {
        const ref = doc(collection(db, COLLECTION));
        const hasRequiredFields = !!(trade.emotionEntry && trade.emotionExit && trade.setup);

        batch.set(ref, {
          // Dados do CSV (parseados pelo csvMapper)
          ticker: trade.ticker ?? null,
          side: trade.side ?? null,
          entry: trade.entry ?? null,
          exit: trade.exit ?? null,
          qty: trade.qty ?? null,
          entryTime: trade.entryTime ?? null,
          exitTime: trade.exitTime ?? null,
          result: trade.result ?? null,
          resultOverride: trade.resultOverride ?? null,
          stopLoss: trade.stopLoss ?? null,
          exchange: trade.exchange ?? null,
          directionInferred: trade.directionInferred ?? false,

          // Issue #187 — MEP/MEN convertidos pelo csvMapper de pts/% para preço.
          // Persistir no staging para sobreviver ao ciclo staging → activate → trade.
          mepPrice: trade.mepPrice ?? null,
          menPrice: trade.menPrice ?? null,
          excursionSource: trade.excursionSource ?? null,

          // Complemento do aluno (preenchido depois)
          emotionEntry: trade.emotionEntry ?? null,
          emotionExit: trade.emotionExit ?? null,
          setup: trade.setup ?? null,

          // Mapeamento
          planId: meta.planId ?? null,

          // Metadados de importação
          importBatchId: batchId,
          importSource: meta.importSource ?? 'csv',
          importTemplateName: meta.importTemplateName ?? null,

          // Controle
          studentId: user.uid,
          studentEmail: user.email,
          studentName: user.displayName || user.email.split('@')[0],
          isComplete: hasRequiredFields,
          createdAt: now,
          updatedAt: now,
        });
      }

      await batch.commit();
      written += chunk.length;
      console.log(`[useCsvStaging] Batch write: ${written}/${trades.length}`);
    }

    console.log(`[useCsvStaging] Batch ${batchId}: ${written} trades gravados em staging`);
    return batchId;
  }, [user]);

  // ============================================
  // UPDATE — complementa dados de um trade em staging
  // ============================================
  /**
   * @param {string} tradeId - ID do documento em csvStagingTrades
   * @param {Object} updates - Campos a atualizar (emotionEntry, emotionExit, setup, stopLoss, etc)
   */
  const updateStagingTrade = useCallback(async (tradeId, updates) => {
    if (!user) throw new Error('Autenticação necessária');

    const ref = doc(db, COLLECTION, tradeId);

    // Recalcular isComplete
    // Precisa merge com dados existentes para checar completude
    const current = stagingTrades.find(t => t.id === tradeId);
    const merged = { ...current, ...updates };
    const isComplete = !!(merged.emotionEntry && merged.emotionExit && merged.setup);

    await updateDoc(ref, {
      ...updates,
      isComplete,
      updatedAt: serverTimestamp(),
    });

    console.log(`[useCsvStaging] Trade ${tradeId} atualizado, isComplete=${isComplete}`);
  }, [user, stagingTrades]);

  // ============================================
  // DELETE — remove trade individual do staging
  // ============================================
  const deleteStagingTrade = useCallback(async (tradeId) => {
    if (!user) throw new Error('Autenticação necessária');
    await deleteDoc(doc(db, COLLECTION, tradeId));
    console.log(`[useCsvStaging] Trade ${tradeId} deletado do staging`);
  }, [user]);

  // ============================================
  // DELETE BATCH — remove todos os trades de um batch
  // ============================================
  /**
   * @param {string} batchId - importBatchId
   * @returns {Promise<number>} Quantidade deletada
   */
  const deleteStagingBatch = useCallback(async (batchId) => {
    if (!user) throw new Error('Autenticação necessária');

    // Usar trades já em memória (do listener) em vez de query
    // Isso evita necessidade de índice composto e satisfaz security rules
    // (deleteDoc individual usa get, não list)
    const batchTrades = stagingTrades.filter(t => t.importBatchId === batchId);

    if (batchTrades.length === 0) return 0;

    const BATCH_SIZE = 450;
    let deleted = 0;

    for (let i = 0; i < batchTrades.length; i += BATCH_SIZE) {
      const chunk = batchTrades.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      chunk.forEach(t => batch.delete(doc(db, COLLECTION, t.id)));
      await batch.commit();
      deleted += chunk.length;
    }

    console.log(`[useCsvStaging] Batch ${batchId}: ${deleted} trades deletados do staging`);
    return deleted;
  }, [user, stagingTrades]);

  // ============================================
  // ACTIVATE — move trade do staging para trades via addTrade
  // ============================================
  /**
   * Ativa um trade: chama addTrade (de useTrades) com os dados do staging,
   * depois deleta o documento de staging.
   *
   * Issue #240 — quando `existingTrades` é fornecido, aplica o mesmo
   * `checkDuplication` usado pelo Order Import (ticker + side + entryTime ±5min
   * + qty). Se duplicado:
   *
   *   - Se `updateTradeFn` foi injetada e o CSV traz mepPrice/menPrice que o
   *     trade existente NÃO tem, **enriquece** o trade existente (auto-enrich
   *     silencioso, conservador — nunca sobrescreve). Retorna
   *     `{ enriched: true, matchedTradeId, fields }`.
   *   - Caso contrário, apenas pula e retorna `{ skipped: true, matchedTradeId, reason }`.
   *
   *   Em ambos os casos o doc de staging é removido. Caller contabiliza ambos
   *   os status no resumo final.
   *
   * @param {Object} stagingTrade - Documento completo de csvStagingTrades (com id)
   * @param {Function} addTradeFn - Referência a addTrade de useTrades
   * @param {Object} [options]
   * @param {Object[]} [options.existingTrades=[]] - Trades existentes do plano para dedup
   * @param {Function} [options.updateTradeFn] - Referência a updateTrade de useTrades.
   *   Quando fornecida, habilita auto-enrich de MEP/MEN em duplicatas.
   * @returns {Promise<
   *   string |
   *   { skipped: true, matchedTradeId: string, reason: string } |
   *   { enriched: true, matchedTradeId: string, fields: string[] }
   * >}
   */
  const activateTrade = useCallback(async (stagingTrade, addTradeFn, options = {}) => {
    if (!user) throw new Error('Autenticação necessária');
    if (!stagingTrade?.planId) throw new Error('Trade sem plano associado');
    if (!addTradeFn) throw new Error('addTrade function não fornecida');

    // Compat: 3º arg como Array continua funcionando (callers antigos).
    const { existingTrades = [], updateTradeFn = null } = Array.isArray(options)
      ? { existingTrades: options }
      : options;

    // C2 (v1.19.1): Buscar tickerRule do master data se não presente no staging
    let tickerRule = stagingTrade.tickerRule ?? null;
    if (!tickerRule && stagingTrade.ticker && stagingTrade.exchange) {
      try {
        const tickerSnap = await getDocs(
          query(
            collection(db, 'tickers'),
            where('symbol', '==', stagingTrade.ticker),
            where('exchange', '==', stagingTrade.exchange)
          )
        );
        if (!tickerSnap.empty) {
          const tickerDoc = tickerSnap.docs[0].data();
          if (tickerDoc.tickSize && tickerDoc.tickValue) {
            tickerRule = {
              tickSize: tickerDoc.tickSize,
              tickValue: tickerDoc.tickValue,
              pointValue: tickerDoc.pointValue ?? null,
            };
            console.log(`[useCsvStaging] tickerRule resolvido via master data: ${stagingTrade.ticker}@${stagingTrade.exchange}`, tickerRule);
          }
        }
      } catch (err) {
        console.warn(`[useCsvStaging] Falha ao buscar tickerRule: ${err.message}`);
      }
    }

    // Montar tradeData no formato que addTrade espera
    // INV-12: Todo trade tem _partials — construir a partir de entry/exit do CSV
    const _partials = [
      { type: 'ENTRY', price: parseFloat(stagingTrade.entry), qty: parseFloat(stagingTrade.qty), dateTime: stagingTrade.entryTime, seq: 1 },
      { type: 'EXIT', price: parseFloat(stagingTrade.exit), qty: parseFloat(stagingTrade.qty), dateTime: stagingTrade.exitTime ?? null, seq: 2 }
    ];

    const tradeData = {
      planId: stagingTrade.planId,
      ticker: stagingTrade.ticker,
      exchange: stagingTrade.exchange ?? null,
      side: stagingTrade.side,
      entry: stagingTrade.entry,
      exit: stagingTrade.exit,
      qty: stagingTrade.qty,
      entryTime: stagingTrade.entryTime,
      exitTime: stagingTrade.exitTime ?? null,
      stopLoss: stagingTrade.stopLoss ?? null,
      emotionEntry: stagingTrade.emotionEntry,
      emotionExit: stagingTrade.emotionExit,
      setup: stagingTrade.setup,
      // Se CSV trouxe resultado, passar como override
      resultOverride: stagingTrade.resultOverride ?? stagingTrade.result ?? null,
      // Issue #187 — MEP/MEN persistidos no staging propagam para o trade final.
      mepPrice: stagingTrade.mepPrice ?? null,
      menPrice: stagingTrade.menPrice ?? null,
      excursionSource: stagingTrade.excursionSource ?? null,
      // Metadados de origem
      importSource: stagingTrade.importSource ?? 'csv',
      importBatchId: stagingTrade.importBatchId ?? null,
      // C2: tickerRule resolvido (staging ou master data lookup)
      tickerRule,
      // INV-12: Parciais são campo no documento — todo trade tem parciais
      _partials,
    };

    // Issue #240 — dedup contra trades existentes do plano (manual + order_import + csv).
    // Critério reusado de orderTradeCreation.checkDuplication (ticker+side+entryTime±5min+qty).
    if (existingTrades?.length) {
      const dup = checkDuplication(tradeData, existingTrades);
      if (dup.isDuplicate) {
        const matchedTrade = existingTrades.find(t => t.id === dup.matchedTradeId);

        // Tentativa de auto-enrich silencioso (apenas campos vazios — nunca sobrescreve).
        // Hoje carrega só mepPrice/menPrice/excursionSource (issue #187 + #240).
        if (matchedTrade && updateTradeFn) {
          const enrich = computeExcursionEnrichmentPatch(tradeData, matchedTrade);
          if (enrich) {
            // Validar antes de gravar — entry/exit do trade existente são fonte da verdade.
            try {
              validateExcursionPrices({
                side: matchedTrade.side,
                entry: parseFloat(matchedTrade.entry),
                exit: parseFloat(matchedTrade.exit),
                mepPrice: enrich.patch.mepPrice ?? matchedTrade.mepPrice ?? null,
                menPrice: enrich.patch.menPrice ?? matchedTrade.menPrice ?? null,
              });
              await updateTradeFn(matchedTrade.id, enrich.patch);
              await deleteDoc(doc(db, COLLECTION, stagingTrade.id));
              console.log(`[useCsvStaging] Trade ${stagingTrade.id} duplicata de ${matchedTrade.id} — enriquecido (${enrich.fields.join(', ')}) e removido do staging`);
              return { enriched: true, matchedTradeId: matchedTrade.id, fields: enrich.fields };
            } catch (enrichErr) {
              console.warn(`[useCsvStaging] Enrichment falhou para ${matchedTrade.id} (${enrichErr.message}) — caindo em skipped`);
              // Não falha o batch — degrada para skipped puro.
            }
          }
        }

        await deleteDoc(doc(db, COLLECTION, stagingTrade.id));
        console.log(`[useCsvStaging] Trade ${stagingTrade.id} duplicata de ${dup.matchedTradeId} — pulado e removido do staging`);
        return { skipped: true, matchedTradeId: dup.matchedTradeId, reason: dup.reason };
      }
    }

    // Chamar addTrade legado — ele resolve planId→accountId, calcula result,
    // cria movement, aciona CFs (compliance, PL update)
    const newTrade = await addTradeFn(tradeData, null, null);

    // Sucesso — deletar do staging
    await deleteDoc(doc(db, COLLECTION, stagingTrade.id));
    console.log(`[useCsvStaging] Trade ativado: staging ${stagingTrade.id} → trades ${newTrade.id}`);

    return newTrade.id;
  }, [user]);

  // ============================================
  // ACTIVATE BATCH — ativa múltiplos trades sequencialmente
  // ============================================
  /**
   * @param {string[]} tradeIds - IDs dos trades em staging para ativar
   * @param {Function} addTradeFn - Referência a addTrade de useTrades
   * @param {Function} [onProgress] - Callback (current, total, lastResult)
   * @param {Object | Object[]} [optionsOrTrades] - Object com `{ existingTrades, updateTradeFn }`,
   *   ou Array (legacy) que será interpretado como `existingTrades`.
   * @returns {Promise<{
   *   success: string[],
   *   failed: { id: string, error: string }[],
   *   skipped: { id: string, matchedTradeId: string, reason: string }[],
   *   enriched: { id: string, matchedTradeId: string, fields: string[] }[],
   * }>}
   */
  const activateBatch = useCallback(async (tradeIds, addTradeFn, onProgress, optionsOrTrades = {}) => {
    if (!user) throw new Error('Autenticação necessária');
    if (!addTradeFn) throw new Error('addTrade function não fornecida');

    const options = Array.isArray(optionsOrTrades)
      ? { existingTrades: optionsOrTrades }
      : optionsOrTrades;

    const success = [];
    const failed = [];
    const skipped = [];
    const enriched = [];

    for (let i = 0; i < tradeIds.length; i++) {
      const stagingId = tradeIds[i];
      const stagingTrade = stagingTrades.find(t => t.id === stagingId);

      if (!stagingTrade) {
        failed.push({ id: stagingId, error: 'Trade não encontrado no staging' });
        continue;
      }

      if (!stagingTrade.isComplete) {
        failed.push({ id: stagingId, error: 'Trade incompleto (falta emotionEntry, emotionExit ou setup)' });
        continue;
      }

      try {
        const result = await activateTrade(stagingTrade, addTradeFn, options);
        if (result && typeof result === 'object') {
          if (result.enriched) {
            enriched.push({ id: stagingId, matchedTradeId: result.matchedTradeId, fields: result.fields });
          } else if (result.skipped) {
            skipped.push({ id: stagingId, matchedTradeId: result.matchedTradeId, reason: result.reason });
          } else {
            success.push(result);
          }
        } else {
          success.push(result);
        }
      } catch (err) {
        console.error(`[useCsvStaging] Falha ao ativar ${stagingId}:`, err);
        failed.push({ id: stagingId, error: err.message });
      }

      if (onProgress) {
        onProgress(i + 1, tradeIds.length, {
          success: success.length,
          failed: failed.length,
          skipped: skipped.length,
          enriched: enriched.length,
        });
      }
    }

    console.log(`[useCsvStaging] Batch activate: ${success.length} ok, ${enriched.length} enriquecidos, ${skipped.length} duplicatas ignoradas, ${failed.length} falhas`);
    return { success, failed, skipped, enriched };
  }, [user, stagingTrades, activateTrade]);

  // ============================================
  // HELPERS
  // ============================================

  /** Agrupa trades por importBatchId */
  const getBatches = useCallback(() => {
    const map = {};
    for (const trade of stagingTrades) {
      const bId = trade.importBatchId ?? 'unknown';
      if (!map[bId]) {
        map[bId] = {
          batchId: bId,
          templateName: trade.importTemplateName ?? '',
          planId: trade.planId,
          trades: [],
          completeCount: 0,
          totalCount: 0,
          createdAt: trade.createdAt,
        };
      }
      map[bId].trades.push(trade);
      map[bId].totalCount++;
      if (trade.isComplete) map[bId].completeCount++;
    }
    return Object.values(map);
  }, [stagingTrades]);

  /** Conta trades pendentes (não completos) */
  const pendingCount = stagingTrades.filter(t => !t.isComplete).length;
  /** Conta trades prontos para ativar */
  const readyCount = stagingTrades.filter(t => t.isComplete).length;

  return {
    stagingTrades,
    loading,
    error,
    pendingCount,
    readyCount,
    addStagingBatch,
    updateStagingTrade,
    deleteStagingTrade,
    deleteStagingBatch,
    activateTrade,
    activateBatch,
    getBatches,
  };
};

export default useCsvStaging;
