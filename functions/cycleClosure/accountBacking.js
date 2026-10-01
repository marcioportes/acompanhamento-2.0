/**
 * accountBacking.js — issue #480
 *
 * Lê da base o que o teto de capital do fechamento precisa saber sobre a conta do plano:
 * saldo, PL já alocado nos outros planos ativos e resultado dos trades posteriores ao ciclo.
 * A conta é derivada do plano gravado — nunca do payload do cliente.
 *
 * Roda FORA da transaction do closeCycle: são leituras largas (todos os trades do plano)
 * e travá-las disputaria com a gravação de trade. `closeCycle` confere dentro da
 * transaction que a conta do plano não mudou.
 */

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {{planId:string, cycleEnd:string}} args — cycleEnd em 'YYYY-MM-DD'
 * @returns {Promise<{accountId:string, accountBalance:number|null, otherPlansPl:number, postCycleResult:number}|null>}
 *   null quando o plano não tem conta ou a conta não existe (teto cai no equity do ciclo).
 */
async function readAccountBacking(db, { planId, cycleEnd }) {
  const planSnap = await db.collection('plans').doc(planId).get();
  const accountId = planSnap.exists ? planSnap.data().accountId : null;
  if (!accountId) return null;

  const [accountSnap, siblingsSnap, tradesSnap] = await Promise.all([
    db.collection('accounts').doc(accountId).get(),
    db.collection('plans').where('accountId', '==', accountId).select('pl', 'active').get(),
    db.collection('trades').where('planId', '==', planId).select('date', 'result').get(),
  ]);
  if (!accountSnap.exists) return null;

  const account = accountSnap.data();
  const rawBalance = account.currentBalance ?? account.initialBalance;
  const accountBalance = typeof rawBalance === 'number' && Number.isFinite(rawBalance) ? rawBalance : null;

  let otherPlansPl = 0;
  siblingsSnap.forEach((doc) => {
    const p = doc.data();
    if (doc.id !== planId && p.active) otherPlansPl += Number(p.pl) || 0;
  });

  let postCycleResult = 0;
  tradesSnap.forEach((doc) => {
    const t = doc.data();
    if (typeof t.date === 'string' && t.date.slice(0, 10) > cycleEnd) {
      postCycleResult += Number(t.result) || 0;
    }
  });

  return { accountId, accountBalance, otherPlansPl, postCycleResult };
}

module.exports = { readAccountBacking };
