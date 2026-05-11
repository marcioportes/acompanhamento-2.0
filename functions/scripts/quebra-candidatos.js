const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'acompanhamento-20' });
const db = admin.firestore();

(async () => {
  const studentsSnap = await db.collection('students').get();
  const alpha = [];
  const espelho = [];
  for (const docSnap of studentsSnap.docs) {
    const id = docSnap.id;
    const s = docSnap.data();
    const firstLogin = s.firstLoginAt ? true : false;
    const accessStatus = s.accessStatus;
    // não fez 1º login (getAccessStatus !== 'active' simplificado)
    const isActiveByLogin = accessStatus === 'active' || firstLogin;
    if (isActiveByLogin) continue;
    const subsSnap = await docSnap.ref.collection('subscriptions').get();
    const subs = subsSnap.docs.map(d => d.data());
    const elig = subs.find(sub =>
      (sub.plan === 'alpha' || sub.plan === 'self_service') &&
      (sub.status === 'active' || sub.status === 'trial')
    );
    if (!elig) continue;
    const entry = {
      name: s.name ?? '(sem nome)',
      email: s.email ?? '(vazio)',
      noAuth: id.startsWith('student_'),
      subStatus: elig.status,
      subType: elig.type,
    };
    if (elig.plan === 'alpha') alpha.push(entry);
    else espelho.push(entry);
  }
  console.log(`\n== Candidatos: ${alpha.length + espelho.length} total ==\n`);
  console.log(`ALPHA: ${alpha.length}`);
  alpha.forEach(s => console.log(`  - ${s.name.padEnd(28)} | ${s.subStatus}/${s.subType} | email=${s.email} | semAuth=${s.noAuth}`));
  console.log(`\nESPELHO: ${espelho.length}`);
  espelho.forEach(s => console.log(`  - ${s.name.padEnd(28)} | ${s.subStatus}/${s.subType} | email=${s.email} | semAuth=${s.noAuth}`));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
