/**
 * useOrderStaging.js
 * @version 1.0.0 (v1.20.0)
 * @description Hook para gerenciar ordens em staging (collection ordersStagingArea).
 *   Ordens importadas ficam aqui até serem "ingeridas" — momento em que
 *   são gravadas na collection `orders` e deletadas do staging.
 *
 * PADRÃO: Segue useCsvStaging.js (CHUNK-07) — staging isolada, sem CF observando.
 *
 * PRINCÍPIO: ordersStagingArea é 100% isolada de orders/trades/CFs.
 *
 * EXPORTS (via hook):
 *   stagingBatches, loading, error
 *   addStagingBatch(orders, meta) → Promise<string> (batchId)
 *   deleteStagingBatch(batchId) → Promise<number>
 *   ingestBatch(batchId) → Promise<{ success, failed }>
 *
 * @firestore ordersStagingArea — docs por ordem individual (como csvStagingTrades)
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, deleteDoc, doc, getDocs,
  writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

const STAGING_COLLECTION = 'ordersStagingArea';
const ORDERS_COLLECTION = 'orders';

/**
 * @param {string|null} overrideStudentId - UID do aluno (para mentor view-as-student)
 */
const useOrderStaging = (overrideStudentId = null) => {
  const { user, isMentor } = useAuth();
  const [stagingOrders, setStagingOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ============================================
  // LISTENER
  // ============================================
  useEffect(() => {
    if (!user) {
      setStagingOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const targetId = overrideStudentId ?? user.uid;
    let q;

    if (isMentor() && !overrideStudentId) {
      q = query(collection(db, STAGING_COLLECTION), orderBy('createdAt', 'desc'));
    } else {
      q = query(
        collection(db, STAGING_COLLECTION),
        where('studentId', '==', targetId),
        orderBy('createdAt', 'desc')
      );
    }

    let fallbackUnsub = null;

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setStagingOrders(data);
        setLoading(false);
      },
      (err) => {
        console.error('[useOrderStaging] Listener error:', err);
        const fallbackQ = overrideStudentId || !isMentor()
          ? query(collection(db, STAGING_COLLECTION), where('studentId', '==', targetId))
          : query(collection(db, STAGING_COLLECTION));

        fallbackUnsub = onSnapshot(
          fallbackQ,
          (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            data.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
            setStagingOrders(data);
            setLoading(false);
          },
          (fallbackErr) => {
            console.error('[useOrderStaging] Fallback error:', fallbackErr);
            setStagingOrders([]);
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
  // ADD STAGING BATCH
  // ============================================
  /**
   * Grava ordens normalizadas em staging.
   * @param {Object[]} orders — ordens normalizadas (output do normalizer)
   * @param {Object} meta — { planId, sourceFormat, fileName }
   * @returns {Promise<string>} batchId
   */
  const addStagingBatch = useCallback(async (orders, meta = {}) => {
    if (!user) throw new Error('Autenticação necessária');
    if (!orders?.length) throw new Error('Nenhuma ordem para importar');

    const batchId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = serverTimestamp();
    const BATCH_SIZE = 450;
    let written = 0;

    for (let i = 0; i < orders.length; i += BATCH_SIZE) {
      const chunk = orders.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);

      for (const order of chunk) {
        const ref = doc(collection(db, STAGING_COLLECTION));
        batch.set(ref, {
          // Dados da ordem
          externalOrderId: order.externalOrderId ?? null,
          instrument: order.instrument ?? null,
          orderType: order.orderType ?? null,
          side: order.side ?? null,
          quantity: order.quantity ?? null,
          price: order.price ?? null,
          limitPrice: order.limitPrice ?? null,
          stopPrice: order.stopPrice ?? null,
          filledPrice: order.filledPrice ?? null,
          filledQuantity: order.filledQuantity ?? null,
          status: order.status ?? null,
          submittedAt: order.submittedAt ?? null,
          filledAt: order.filledAt ?? null,
          cancelledAt: order.cancelledAt ?? null,
          modifications: order.modifications ?? [],
          isStopOrder: order.isStopOrder ?? false,

          // Metadados
          importBatchId: batchId,
          planId: meta.planId ?? null,
          sourceFormat: meta.sourceFormat ?? 'generic',
          fileName: meta.fileName ?? null,

          // Controle
          studentId: user.uid,
          studentEmail: user.email,
          studentName: user.displayName || user.email.split('@')[0],
          createdAt: now,
        });
      }

      await batch.commit();
      written += chunk.length;
      console.log(`[useOrderStaging] Batch write: ${written}/${orders.length}`);
    }

    console.log(`[useOrderStaging] Batch ${batchId}: ${written} ordens em staging`);
    return batchId;
  }, [user]);

  // ============================================
  // DELETE STAGING BATCH
  // ============================================
  /**
   * Remove todas as ordens de um batch do staging.
   * @param {string} batchId
   * @returns {Promise<number>}
   */
  const deleteStagingBatch = useCallback(async (batchId) => {
    if (!user) throw new Error('Autenticação necessária');

    const batchOrders = stagingOrders.filter(o => o.importBatchId === batchId);
    if (batchOrders.length === 0) return 0;

    const BATCH_SIZE = 450;
    let deleted = 0;

    for (let i = 0; i < batchOrders.length; i += BATCH_SIZE) {
      const chunk = batchOrders.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      chunk.forEach(o => batch.delete(doc(db, STAGING_COLLECTION, o.id)));
      await batch.commit();
      deleted += chunk.length;
    }

    console.log(`[useOrderStaging] Batch ${batchId}: ${deleted} ordens deletadas do staging`);
    return deleted;
  }, [user, stagingOrders]);

  // ============================================
  // INGEST BATCH — staging → orders collection
  // ============================================
  /**
   * Move ordens do staging para a collection `orders` final.
   * Após ingestão, deleta do staging.
   * Faz query direta ao Firestore (não depende do listener).
   *
   * @param {string} batchId
   * @param {Object} correlations — { [stagingOrderId]: { tradeId, confidence, matchType } }
   * @returns {Promise<{ success: number, failed: Array<{ id: string, error: string }> }>}
   */
  const ingestBatch = useCallback(async (batchId, correlations = {}) => {
    if (!user) throw new Error('Autenticação necessária');

    // Query direta — não depende do listener que pode não ter atualizado ainda
    const q = query(
      collection(db, STAGING_COLLECTION),
      where('importBatchId', '==', batchId)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) throw new Error('Batch não encontrado no staging');

    const batchOrders = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    const success = [];
    const failed = [];
    const BATCH_SIZE = 450;

    for (let i = 0; i < batchOrders.length; i += BATCH_SIZE) {
      const chunk = batchOrders.slice(i, i + BATCH_SIZE);
      const writeBatchRef = writeBatch(db);

      for (const stagingOrder of chunk) {
        try {
          const correlation = correlations[stagingOrder.id] || {};
          const orderRef = doc(collection(db, ORDERS_COLLECTION));

          writeBatchRef.set(orderRef, {
            studentId: stagingOrder.studentId,
            planId: stagingOrder.planId,
            batchId,
            instrument: stagingOrder.instrument,
            orderType: stagingOrder.orderType,
            side: stagingOrder.side,
            quantity: stagingOrder.quantity,
            price: stagingOrder.price,
            limitPrice: stagingOrder.limitPrice,
            stopPrice: stagingOrder.stopPrice,
            filledPrice: stagingOrder.filledPrice,
            filledQuantity: stagingOrder.filledQuantity,
            status: stagingOrder.status,
            submittedAt: stagingOrder.submittedAt,
            filledAt: stagingOrder.filledAt,
            cancelledAt: stagingOrder.cancelledAt,
            modifications: stagingOrder.modifications || [],
            correlatedTradeId: correlation.tradeId || null,
            correlationConfidence: correlation.confidence || 0,
            isStopOrder: stagingOrder.isStopOrder || false,
            importedAt: serverTimestamp(),
            sourceFormat: stagingOrder.sourceFormat,
          });

          // Delete from staging in same batch
          writeBatchRef.delete(doc(db, STAGING_COLLECTION, stagingOrder.id));
          success.push(stagingOrder.id);
        } catch (err) {
          failed.push({ id: stagingOrder.id, error: err.message });
        }
      }

      await writeBatchRef.commit();
    }

    console.log(`[useOrderStaging] Ingest batch ${batchId}: ${success.length} ok, ${failed.length} failed`);
    return { success: success.length, failed };
  }, [user]);

  // ============================================
  // HELPERS
  // ============================================

  /** Agrupa staging por importBatchId */
  const getBatches = useMemo(() => {
    const map = {};
    for (const order of stagingOrders) {
      const bId = order.importBatchId ?? 'unknown';
      if (!map[bId]) {
        map[bId] = {
          batchId: bId,
          planId: order.planId,
          sourceFormat: order.sourceFormat,
          fileName: order.fileName,
          orders: [],
          totalCount: 0,
          createdAt: order.createdAt,
        };
      }
      map[bId].orders.push(order);
      map[bId].totalCount++;
    }
    return Object.values(map);
  }, [stagingOrders]);

  return {
    stagingOrders,
    stagingBatches: getBatches,
    loading,
    error,
    totalCount: stagingOrders.length,
    addStagingBatch,
    deleteStagingBatch,
    ingestBatch,
  };
};

export default useOrderStaging;
