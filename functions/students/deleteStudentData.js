/**
 * deleteStudentData.js — cascata de hard-delete de um aluno (issue #309)
 *
 * Extraído de `deleteStudent` (functions/index.js, DEC-AUTO-263-08) pra ficar
 * testável sem emulador (fake-db). Apaga, por `sid`:
 *   1. Subcollections recursivas de /students/{sid}/* (qualquer subcoll futura entra).
 *   2. Top-level por studentId: trades, orders, notifications, plans, csvStaging,
 *      csvStagingTrades, accounts, crossCheck, cycleClosures.
 *   3. movements por accountId (DEP/WTD/INITIAL_BALANCE/ADJUSTMENT só têm accountId;
 *      coletados ANTES de apagar accounts) + por studentId (belt-and-suspenders pra
 *      TRADE_RESULT órfão cujo account já foi deletado avulso).
 *   4. Storage best-effort: trades/{tradeId}/ (screenshots HTF/LTF). DEC-AUTO-309-01.
 *   5. Doc /students/{sid}.
 * Auth user e fallback-by-email continuam em index.js (admin.auth, fora desta cascata).
 *
 * Não toca shared files / rules. CHUNK-02 (escrita).
 */

const TOP_LEVEL_COLLECTIONS = [
  'trades',
  'orders',
  'notifications',
  'plans',
  'csvStaging',
  'csvStagingTrades',
  'accounts',
  'crossCheck',
  'cycleClosures',
];

const FIRESTORE_IN_LIMIT = 10; // chunk de valores por query `in` (consistente com deleteAccountCascade)

// Apaga recursivamente uma collection (e subcollections) em batches.
const deleteCollectionRecursive = async (db, collRef, batchSize = 100) => {
  let snapshot = await collRef.limit(batchSize).get();
  let count = 0;
  while (!snapshot.empty) {
    for (const d of snapshot.docs) {
      const subColls = await d.ref.listCollections();
      for (const sc of subColls) {
        count += await deleteCollectionRecursive(db, sc, batchSize);
      }
    }
    const batch = db.batch();
    snapshot.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    count += snapshot.size;
    snapshot = await collRef.limit(batchSize).get();
  }
  return count;
};

// Apaga em batch todos os docs de uma coleção top-level com `studentId == sid`.
const deleteByStudentIdQuery = async (db, collName, sid, batchSize = 100) => {
  let count = 0;
  while (true) {
    const snap = await db.collection(collName).where('studentId', '==', sid).limit(batchSize).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    count += snap.size;
    if (snap.size < batchSize) break;
  }
  return count;
};

// Apaga `movements where accountId in [accountIds]` — chunks de 10, batches de 100.
const deleteMovementsByAccountIds = async (db, accountIds, batchSize = 100) => {
  let count = 0;
  for (let i = 0; i < accountIds.length; i += FIRESTORE_IN_LIMIT) {
    const chunk = accountIds.slice(i, i + FIRESTORE_IN_LIMIT);
    while (true) {
      const snap = await db
        .collection('movements')
        .where('accountId', 'in', chunk)
        .limit(batchSize)
        .get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      count += snap.size;
      if (snap.size < batchSize) break;
    }
  }
  return count;
};

// Best-effort: apaga objetos trades/{tradeId}/ do bucket. Falha nunca aborta. DEC-AUTO-309-01.
const deleteTradeStorage = async (bucket, tradeIds) => {
  if (!bucket || !tradeIds.length) return 0;
  let cleaned = 0;
  for (const tradeId of tradeIds) {
    try {
      await bucket.deleteFiles({ prefix: `trades/${tradeId}/` });
      cleaned += 1;
    } catch (e) {
      console.warn(`[deleteStudentData] Storage cleanup trades/${tradeId}/:`, e.message);
    }
  }
  return cleaned;
};

/**
 * Executa a cascata para um único aluno.
 * @param {object} args
 * @param {FirebaseFirestore.Firestore} args.db
 * @param {object|null} args.bucket  bucket do Admin Storage (best-effort; pode ser null)
 * @param {string} args.sid          studentId
 * @returns {Promise<object>} counts por coleção (pra log)
 */
const deleteStudentData = async ({ db, bucket, sid }) => {
  const studentRef = db.collection('students').doc(sid);
  const counts = {};

  // 0. Coletar ids ANTES de apagar accounts/trades.
  const accountsSnap = await db.collection('accounts').where('studentId', '==', sid).get();
  const accountIds = accountsSnap.docs.map((d) => d.id);
  const tradesSnap = await db.collection('trades').where('studentId', '==', sid).get();
  const tradeIds = tradesSnap.docs.map((d) => d.id);

  // 1. Subcollections recursivas.
  const subColls = await studentRef.listCollections();
  for (const sc of subColls) {
    counts[`sub:${sc.id}`] = await deleteCollectionRecursive(db, sc);
  }

  // 2. Top-level por studentId (inclui cycleClosures).
  for (const coll of TOP_LEVEL_COLLECTIONS) {
    const n = await deleteByStudentIdQuery(db, coll, sid);
    if (n > 0) counts[`top:${coll}`] = n;
  }

  // 3. movements: por accountId (cobre depósito/saque/initial/adjustment sem studentId)
  //    + belt-and-suspenders por studentId (captura TRADE_RESULT órfão cujo account
  //    já foi deletado avulso e portanto não está em accountIds).
  const movementsByAccount = await deleteMovementsByAccountIds(db, accountIds);
  const movementsByStudent = await deleteByStudentIdQuery(db, 'movements', sid);
  const movementsDeleted = movementsByAccount + movementsByStudent;
  if (movementsDeleted > 0) counts['movements'] = movementsDeleted;

  // 4. Storage best-effort.
  const storageCleaned = await deleteTradeStorage(bucket, tradeIds);
  if (storageCleaned > 0) counts['storage:trades'] = storageCleaned;

  // 5. Doc principal.
  await studentRef.delete();
  counts['students'] = 1;

  return counts;
};

module.exports = {
  deleteStudentData,
  deleteCollectionRecursive,
  deleteByStudentIdQuery,
  deleteMovementsByAccountIds,
  deleteTradeStorage,
  TOP_LEVEL_COLLECTIONS,
};
