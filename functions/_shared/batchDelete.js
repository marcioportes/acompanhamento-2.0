/**
 * batchDelete.js (server / CJS) — deleção em lotes respeitando o limite do Firestore.
 *
 * Extraído de `accounts/deletePlanCascade.js` (issue #363) para que as duas cascatas de
 * deleção — a do plano e a do trade — usem o MESMO helper. Duas implementações do mesmo
 * loop era como as três cascatas do sistema acabaram com coberturas divergentes.
 *
 * O limite duro do Firestore é 500 operações por batch; 400 deixa margem para o caso em
 * que o chamador já colocou algo no batch.
 */

const BATCH_LIMIT = 400;

async function deleteDocsInBatches(db, docRefs) {
  if (docRefs.length === 0) return 0;
  let deleted = 0;
  for (let i = 0; i < docRefs.length; i += BATCH_LIMIT) {
    const slice = docRefs.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    slice.forEach((ref) => batch.delete(ref));
    await batch.commit();
    deleted += slice.length;
  }
  return deleted;
}

module.exports = { deleteDocsInBatches, BATCH_LIMIT };
