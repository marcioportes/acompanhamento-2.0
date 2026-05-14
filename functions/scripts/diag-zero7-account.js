const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'acompanhamento-20' });
const db = admin.firestore();

(async () => {
  // Busca contas com nome zero7 OU templateId zero7- OU currency BRL prop
  const accs = await db.collection('accounts').get();
  const found = [];
  for (const d of accs.docs) {
    const a = d.data();
    const nameZero = /zero7/i.test(a.name ?? '');
    const templateZero = (a.propFirm?.templateId ?? '').startsWith('zero7-');
    if (nameZero || templateZero) {
      found.push({ id: d.id, ...a });
    }
  }
  console.log(`Encontradas: ${found.length}\n`);
  for (const a of found) {
    console.log(`accountId: ${a.id}`);
    console.log(`  name: ${a.name}`);
    console.log(`  type: ${a.type}`);
    console.log(`  currency: ${a.currency}`);
    console.log(`  initialBalance: ${a.initialBalance}`);
    console.log(`  currentBalance: ${a.currentBalance}`);
    console.log(`  studentId: ${a.studentId}`);
    console.log(`  propFirm.templateId: ${a.propFirm?.templateId}`);
    console.log(`  propFirm.phase: ${a.propFirm?.phase}`);
    console.log(`  createdAt: ${a.createdAt?.toDate?.()?.toISOString?.() ?? a.createdAt}`);
    console.log();

    // Planos vinculados
    const plansSnap = await db.collection('plans').where('accountId', '==', a.id).get();
    console.log(`  Plans (${plansSnap.size}):`);
    for (const p of plansSnap.docs) {
      const plan = p.data();
      console.log(`    planId: ${p.id}`);
      console.log(`      name: ${plan.name}`);
      console.log(`      currency: ${plan.currency}`);
      console.log(`      pl: ${plan.pl}`);
      console.log(`      periodStop: ${plan.periodStop} · periodGoal: ${plan.periodGoal}`);
      console.log(`      cycleStop: ${plan.cycleStop} · cycleGoal: ${plan.cycleGoal}`);
    }
    console.log();
  }
})();
