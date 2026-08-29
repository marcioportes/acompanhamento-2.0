/**
 * promoteStudentStage — o ato de promover, que só o mentor executa.
 *
 * #376 (23/08/2026). Regra de Marcio: *"avisa da promoção tanto para o aluno quanto
 * para mim, e eu faço a promoção avisando o aluno."* O motor sinaliza; quem promove é
 * o mentor. Nada aqui roda automático.
 *
 * O cliente NÃO é autoridade: a prontidão é revalidada aqui contra
 * `students/{uid}/maturity/current`, com a mesma regra do front
 * (`promotionReadiness`, espelhado). Se o aluno deixou de estar pronto entre a tela e
 * o clique, a promoção é recusada.
 *
 * Escrita: `currentStage` (campo existente) e uma entrada em `stageHistory` (array já
 * declarado no schema, até aqui sempre vazio) registrando de onde veio, para onde foi,
 * quando e quem promoveu. Nenhuma collection ou campo novo — INV-15 preservada.
 *
 * O estágio promovido SOBREVIVE ao recompute: `recomputeMaturity` calcula
 * `stageCurrent = max(gravado, baseline)` (DEC-020), então o valor novo é o que passa
 * a valer daí em diante.
 */

const { isReadyForPromotion, nextStageOf } = require('./promotionReadiness');

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {object} admin  firebase-admin (para FieldValue)
 * @param {{ studentId: string, promotedByEmail: string }} params
 * @returns {Promise<{ ok: true, fromStage: number, toStage: number }>}
 */
async function promoteStudentStage(db, admin, { studentId, promotedByEmail }) {
  if (!studentId) {
    return { ok: false, reason: 'studentId ausente' };
  }

  const ref = db.collection('students').doc(studentId).collection('maturity').doc('current');
  const snap = await ref.get();
  if (!snap.exists) {
    return { ok: false, reason: 'aluno sem maturidade calculada' };
  }

  const maturity = snap.data();
  if (!isReadyForPromotion(maturity)) {
    // Estado mudou entre a tela e o clique — recusa em vez de promover no escuro.
    return {
      ok: false,
      reason: 'aluno não está pronto para promoção',
      gatesMet: maturity.gatesMet ?? 0,
      gatesTotal: maturity.gatesTotal ?? 0,
    };
  }

  const fromStage = maturity.currentStage;
  const toStage = nextStageOf(maturity);
  if (!Number.isFinite(toStage) || toStage <= fromStage) {
    return { ok: false, reason: 'estágio de destino inválido' };
  }

  const entrada = {
    fromStage,
    toStage,
    promotedAt: new Date().toISOString(),
    promotedBy: promotedByEmail ?? null,
    gatesMet: maturity.gatesMet ?? null,
    gatesTotal: maturity.gatesTotal ?? null,
  };

  await ref.set(
    {
      currentStage: toStage,
      stageHistory: admin.firestore.FieldValue.arrayUnion(entrada),
      // #101 — a proposta foi CONSUMIDA. Sem limpar, `isReadyForPromotion` continua
      // verdadeiro (proposta 'UP' + blockers vazios + gates 9/9, todos calculados
      // para o estágio ANTIGO) e o card "pronto para promoção" fica na tela do
      // mentor depois de ele ter promovido — foi o que Marcio viu.
      proposedTransition: null,
      // PROMOÇÃO ZERA TUDO (Marcio, 29/08): "é como se ele começasse de novo".
      // `stageSince` é a data em que a vida nova começa; o recompute abaixo mede
      // gates, métricas e regressão SÓ com trades a partir daqui. Sem essa marca,
      // o motor comparava as métricas do estágio antigo com a régua do novo e
      // acusava regressão em toda promoção.
      stageSince: admin.firestore.FieldValue.serverTimestamp(),
      signalRegression: null,
    },
    { merge: true },
  );

  // Gates e proposta precisam ser recalculados contra o estágio NOVO. Falha aqui
  // não desfaz a promoção: o estágio já mudou, e o próximo trade recalcula.
  try {
    const { recomputeForStudent } = require('./recomputeMaturity');
    await recomputeForStudent(db, studentId, { admin });
  } catch (e) {
    console.error('[promoteStudentStage] recompute pós-promoção falhou:', e?.message ?? e);
  }

  return { ok: true, fromStage, toStage };
}

module.exports = { promoteStudentStage };
