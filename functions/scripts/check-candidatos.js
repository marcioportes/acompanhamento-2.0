const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'acompanhamento-20' });
const db = admin.firestore();

(async () => {
  const studentsSnap = await db.collection('students').get();
  const sansAuth = [];
  for (const docSnap of studentsSnap.docs) {
    const id = docSnap.id;
    if (!id.startsWith('student_')) continue; // só os sem Auth
    const s = docSnap.data();
    const subsSnap = await docSnap.ref.collection('subscriptions').get();
    const subs = subsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    sansAuth.push({
      id,
      name: s.name ?? '(sem nome)',
      email: s.email ?? null,
      subs: subs.map(sub => ({ plan: sub.plan, status: sub.status, type: sub.type })),
    });
  }
  console.log(`\n== ALUNOS SEM AUTH (id=student_*): ${sansAuth.length} ==\n`);
  for (const s of sansAuth) {
    const subStr = s.subs.length === 0 ? '(SEM SUBS)' : s.subs.map(x => `${x.plan}/${x.type}/${x.status}`).join(' | ');
    const elig = s.subs.some(x => (x.plan === 'alpha' || x.plan === 'self_service') && (x.status === 'active' || x.status === 'trial'));
    console.log(`${elig ? '✅' : '❌'}  ${s.name.padEnd(30)} ${(s.email ?? '(sem email)').padEnd(35)} → ${subStr}`);
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
