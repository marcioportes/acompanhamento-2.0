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
import { makeOrderKey, makeOrderDocId } from '../utils/orderKey';

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
   *
   * Schema de classificação (issue #156 Fase B) — campos opcionais, retrocompatíveis:
   *   - classification: 'match_confident' | 'ambiguous' | 'new' | 'autoliq' | 'discarded' | null
   *   - userDecision: 'pending' | 'confirmed' | 'adjusted' | 'discarded' (default 'pending')
   *   - userDecisionAt: timestamp | null (null enquanto pending)
   *   - userAdjustments: map | null (preenchido só se o aluno ajustou manualmente)
   *   - matchCandidates: Array<{ tradeId, score }> (vazio quando não há candidatos)
   *   - isAutoLiq: boolean (derivado de classification === 'autoliq')
   *
   * No write inicial (STAGING_WRITE), classificação não existe ainda — default pending/null.
   * A classificação é atualizada após reconstrução/categorização (Fase C).
   *
   * Preserva também `origin` e `text` das ordens (quando presentes) para permitir
   * re-classificação a partir do staging sem depender do CSV original.
   *
   * @param {Object[]} orders — ordens normalizadas (output do normalizer) com campos opcionais de classificação
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

    // Dono do lote é o aluno, não quem opera a tela. Em view-as o hook gravava o UID
    // do mentor: o lote sumia do dashboard do aluno e a dedup nunca casava (#366).
    const ownerId = overrideStudentId ?? user.uid;
    const isViewAs = !!overrideStudentId && overrideStudentId !== user.uid;

    for (let i = 0; i < orders.length; i += BATCH_SIZE) {
      const chunk = orders.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);

      for (const order of chunk) {
        const ref = doc(collection(db, STAGING_COLLECTION));
        const classification = order.classification ?? null;
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
          // Campo bruto Tradovate `Text` (AutoLiq/multibracket/...) — preservado para
          // re-classificação a partir do staging.
          origin: order.origin ?? null,
          text: order.text ?? null,

          // Metadados
          importBatchId: batchId,
          planId: meta.planId ?? null,
          sourceFormat: meta.sourceFormat ?? 'generic',
          fileName: meta.fileName ?? null,
          // Fuso dos horários do arquivo (#366). Sem ele a retomada de um lote não
          // consegue refazer reconstructOperations, e repedir na retomada deixaria o
          // aluno reconfirmar fuso diferente do original — a regressão que #285/#292
          // fecharam ao tornar o fuso explícito por lote.
          importTimezone: meta.importTimezone ?? null,

          // Schema de classificação persistida (issue #156 Fase B)
          classification,
          userDecision: order.userDecision ?? 'pending',
          userDecisionAt: order.userDecisionAt ?? null,
          userAdjustments: order.userAdjustments ?? null,
          matchCandidates: Array.isArray(order.matchCandidates) ? order.matchCandidates : [],
          isAutoLiq: typeof order.isAutoLiq === 'boolean' ? order.isAutoLiq : classification === 'autoliq',

          // Controle
          studentId: ownerId,
          studentEmail: isViewAs ? null : user.email,
          studentName: isViewAs ? null : (user.displayName || user.email.split('@')[0]),
          createdAt: now,
        });
      }

      await batch.commit();
      written += chunk.length;
      console.log(`[useOrderStaging] Batch write: ${written}/${orders.length}`);
    }

    console.log(`[useOrderStaging] Batch ${batchId}: ${written} ordens em staging`);
    return batchId;
  }, [user, overrideStudentId]);

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
  /**
   * Ingere ordens do staging para a collection `orders` final.
   *
   * @param {string} batchId
   * @param {Object} correlations - { [stagingOrderId]: { tradeId, confidence } }
   * @param {string[]|null} confirmedOrderKeys - chaves das ordens confirmadas pelo usuário
   *   (#93; a partir do #366 vêm da DECISÃO por operação, não da tela de revisão).
   *   Format: "eid:<externalOrderId>" ou "comp:<instrument>|<side>|<submittedAt>|<quantity>|<filledAt>".
   *   Se null, ingere todas (backward compatible).
   *   Ordens fora dessa lista são DELETADAS do staging sem ingerir (Opção B).
   * @param {Object} [options]
   * @param {Set<string>} [options.existingKeys] - chaves já presentes em `orders` (#366).
   *   A ordem é pulada e removida do staging: toda escrita vira `create` puro, porque
   *   `set(merge)` sobre doc existente é *update* e `firestore.rules` nega.
   * @returns {Promise<{ success: number, excluded: number, skipped: number, failed: Array, alreadyIngested?: boolean }>}
   */
  const ingestBatch = useCallback(async (batchId, correlations = {}, confirmedOrderKeys = null, options = {}) => {
    if (!user) throw new Error('Autenticação necessária');

    const existingKeys = options?.existingKeys ?? null;

    // Query direta — não depende do listener que pode não ter atualizado ainda
    const q = query(
      collection(db, STAGING_COLLECTION),
      where('importBatchId', '==', batchId)
    );
    const snapshot = await getDocs(q);

    // Batch já ingerido (retry após falha na criação de trades): o staging está vazio
    // porque a ingestão anterior concluiu. Lançar aqui matava o retry — as ordens já
    // estavam gravadas e o aluno não tinha caminho de volta (#366).
    if (snapshot.empty) {
      return { success: 0, excluded: 0, skipped: 0, failed: [], alreadyIngested: true };
    }

    const batchOrders = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    // Set de chaves confirmadas para lookup O(1) — null = ingerir todas.
    // makeOrderKey vem de src/utils/orderKey.js (single source of truth — issue #93).
    const confirmedSet = confirmedOrderKeys ? new Set(confirmedOrderKeys) : null;

    const success = [];
    const excluded = [];
    const skipped = [];
    const failed = [];
    // Cada ordem confirmada gera DUAS operações no batch (set em `orders` + delete do
    // staging). O teto do Firestore é 500 por writeBatch: 450 estourava em silêncio
    // qualquer lote com mais de 250 ordens (#366).
    const BATCH_SIZE = 200;

    for (let i = 0; i < batchOrders.length; i += BATCH_SIZE) {
      const chunk = batchOrders.slice(i, i + BATCH_SIZE);
      const writeBatchRef = writeBatch(db);

      for (const stagingOrder of chunk) {
        try {
          const orderKey = makeOrderKey(stagingOrder);
          const isConfirmed = confirmedSet === null || confirmedSet.has(orderKey);
          // #366 — ordem que já está em `orders`: pular. `set(merge)` sobre doc
          // existente é *update* para as rules (`allow update: if false`) e derruba o
          // writeBatch inteiro — foi o que travou a reimportação em produção. Pulando,
          // toda escrita vira `create` puro e a idempotência do #362 se mantém.
          const alreadyInOrders = !!existingKeys && existingKeys.has(orderKey);

          if (isConfirmed && !alreadyInOrders) {
            // Ingere para `orders` + remove do staging (mesma transação).
            // Correlação por chave canônica (#366) com fallback para o id de staging,
            // que é como o pipeline antigo montava o mapa.
            const correlation = correlations[orderKey] || correlations[stagingOrder.id] || {};

            // #362 — id DETERMINÍSTICO derivado da identidade da ordem. Antes era
            // `doc(collection(...))` (id automático) e o payload nem guardava o
            // `externalOrderId`: sem chave natural, reimportar o mesmo arquivo criava
            // um conjunto novo de docs a cada vez. Em produção a mesma perna de stop
            // apareceu em 3 batches e a limpeza de 19/08 apagou 154 documentos.
            // Com id previsível, reimportar sobrescreve o MESMO doc.
            const docId = makeOrderDocId(stagingOrder, stagingOrder.studentId);
            const orderRef = docId
              ? doc(db, ORDERS_COLLECTION, docId)
              : doc(collection(db, ORDERS_COLLECTION));   // sem studentId: comportamento antigo

            const payload = {
              studentId: stagingOrder.studentId,
              planId: stagingOrder.planId,
              batchId,
              // Chave única da corretora — é o que torna a ingestão idempotente e o que
              // permite auditar a ordem de volta no extrato do broker.
              externalOrderId: stagingOrder.externalOrderId ?? null,
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
              isStopOrder: stagingOrder.isStopOrder || false,
              importedAt: serverTimestamp(),
              sourceFormat: stagingOrder.sourceFormat,
            };

            // Correlação só entra quando existe. Numa reimportação a correlação nova
            // costuma vir vazia (o trade já existia e a operação não recorrelaciona),
            // e escrever `null` por cima apagaria o vínculo que a CF do #351 fase D ou
            // o backfill já haviam estabelecido — devolvendo a ordem ao estado órfão.
            if (correlation.tradeId) {
              payload.correlatedTradeId = correlation.tradeId;
              payload.correlationConfidence = correlation.confidence || 0;
            }

            // merge: preserva campos gravados server-side (correlatedTradeId da CF,
            // userDecision) que não fazem parte do payload de importação.
            writeBatchRef.set(orderRef, payload, { merge: true });

            writeBatchRef.delete(doc(db, STAGING_COLLECTION, stagingOrder.id));
            success.push(stagingOrder.id);
          } else {
            // Não confirmada, ou já presente em `orders`: sai do staging sem ingerir.
            // Nos dois casos deixar no staging só criaria rascunho preso (Opção B).
            writeBatchRef.delete(doc(db, STAGING_COLLECTION, stagingOrder.id));
            (alreadyInOrders && isConfirmed ? skipped : excluded).push(stagingOrder.id);
          }
        } catch (err) {
          failed.push({ id: stagingOrder.id, error: err.message });
        }
      }

      await writeBatchRef.commit();
    }

    console.log(`[useOrderStaging] Ingest batch ${batchId}: ${success.length} ingeridas, ${excluded.length} excluídas, ${skipped.length} já existentes, ${failed.length} falhas`);
    return { success: success.length, excluded: excluded.length, skipped: skipped.length, failed };
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
          importTimezone: order.importTimezone ?? null,
          studentId: order.studentId ?? null,
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
