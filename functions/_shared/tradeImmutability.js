/**
 * tradeImmutability.js (server / CJS) — trade discutido é imutável, também no servidor.
 *
 * A imutabilidade do trade `DISCUSSED` só existia contra o cliente (firestore.rules); o
 * admin SDK passa por cima das rules, e recálculos em cascata (compliance, behaviorProfile)
 * reescreviam o trade depois de discutido (issue #451). A regra mora aqui, num único
 * lugar, e toda escrita server-side de update em `trades` passa por ela.
 *
 * Escopo: só update. A transição PARA `DISCUSSED` é livre — o critério olha o status
 * ATUAL do doc, não o patch. Exclusão em cascata não passa por aqui.
 */

/** Só `status === 'DISCUSSED'` trava. Doc sem status (legado) é mutável. */
function isTradeImmutable(tradeData) {
  return tradeData?.status === 'DISCUSSED';
}

/** Aceita DocumentSnapshot (`.data()`) ou objeto plano. Snapshot inexistente → null. */
function readData(docSnapOrData) {
  if (docSnapOrData && typeof docSnapOrData.data === 'function') {
    if (docSnapOrData.exists === false) return null;
    return docSnapOrData.data() ?? null;
  }
  return docSnapOrData ?? null;
}

/**
 * Variante avulsa: lê o doc e só escreve se ele existe e não é discutido.
 * @returns {Promise<{written: boolean, preserved: boolean}>}
 */
async function updateTradeIfMutable(docRef, patch) {
  const snap = await docRef.get();
  if (!snap.exists) return { written: false, preserved: false };
  if (isTradeImmutable(snap.data())) return { written: false, preserved: true };
  await docRef.update(patch);
  return { written: true, preserved: false };
}

/**
 * Variante com doc já lido, para WriteBatch ou Transaction (ambos expõem `.update(ref, patch)`).
 * Discutido → não enfileira. Doc inexistente → não enfileira (update falharia no commit).
 * @returns {{written: boolean, preserved: boolean}}
 */
function guardedUpdate(writer, docSnapOrData, ref, patch) {
  const data = readData(docSnapOrData);
  if (data === null) return { written: false, preserved: false };
  if (isTradeImmutable(data)) return { written: false, preserved: true };
  writer.update(ref, patch);
  return { written: true, preserved: false };
}

module.exports = { isTradeImmutable, updateTradeIfMutable, guardedUpdate };
