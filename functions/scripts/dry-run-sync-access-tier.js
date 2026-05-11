// Dry-run local da lógica de syncAccessTier — usa Application Default
// Credentials. NÃO escreve. Imprime detalhes das subs pra auditoria.

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'acompanhamento-20' });
const db = admin.firestore();

const SUSPECT_NAMES = [
  'German Hartenstein', 'Gizele', 'João Paulo Silva', 'Jurandyr',
  'Rafael Cerqueira "Sael"', 'Renato', 'Rodrigo Caio', 'Wilson Fu', 'Yoaquim',
];

(async () => {
  const counts = { updated: 0, alreadyOk: 0, total: 0, byTier: {} };
  const changes = [];
  const suspectDetails = [];

  const studentsSnap = await db.collection('students').get();

  for (const docSnap of studentsSnap.docs) {
    counts.total += 1;
    const student = docSnap.data();

    const subsSnap = await docSnap.ref.collection('subscriptions').get();
    const allSubs = subsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (SUSPECT_NAMES.includes(student.name)) {
      suspectDetails.push({
        name: student.name,
        accessTier: student.accessTier ?? null,
        subs: allSubs.map((s) => ({
          id: s.id,
          plan: s.plan,
          type: s.type,
          status: s.status,
          renewalDate: s.renewalDate?.toDate?.()?.toISOString?.() ?? null,
          trialEndsAt: s.trialEndsAt?.toDate?.()?.toISOString?.() ?? null,
        })),
      });
    }

    const activeSubs = allSubs.filter((s) =>
      s.type !== 'vip' &&
      s.status !== 'cancelled' &&
      s.status !== 'expired'
    );

    const mainSub = activeSubs.sort((a, b) => {
      const da = (a.renewalDate?.toDate?.() ?? a.trialEndsAt?.toDate?.() ?? new Date(0)).getTime();
      const dbb = (b.renewalDate?.toDate?.() ?? b.trialEndsAt?.toDate?.() ?? new Date(0)).getTime();
      return dbb - da;
    })[0];

    const expected = mainSub ? (mainSub.plan ?? 'none') : 'none';
    const current = student.accessTier ?? null;
    counts.byTier[expected] = (counts.byTier[expected] ?? 0) + 1;

    if (current === expected) {
      counts.alreadyOk += 1;
      continue;
    }

    counts.updated += 1;
    changes.push({
      id: docSnap.id,
      name: student.name ?? '(sem nome)',
      from: current ?? '(sem accessTier)',
      to: expected,
    });
  }

  console.log('\n== Counts ==');
  console.log(counts);
  console.log('\n== TODAS AS 15 MUDANÇAS (de → para) ==');
  for (const c of changes) {
    console.log(`  - ${c.name.padEnd(30)} ${String(c.from).padEnd(15)} → ${c.to}   [id=${c.id}]`);
  }
  console.log('\n== DETALHE dos suspeitos (sub status/type/dates) ==');
  for (const s of suspectDetails) {
    console.log(`\n${s.name}  (accessTier=${s.accessTier})`);
    if (!s.subs.length) {
      console.log('  → SEM SUBS na subcollection');
      continue;
    }
    s.subs.forEach((sub) => {
      console.log(`  - id=${sub.id} plan=${sub.plan} type=${sub.type} status=${sub.status} renewal=${sub.renewalDate} trialEnds=${sub.trialEndsAt}`);
    });
  }
  process.exit(0);
})().catch((err) => {
  console.error('Erro:', err);
  process.exit(1);
});
