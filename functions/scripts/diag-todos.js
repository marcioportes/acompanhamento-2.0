const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'acompanhamento-20' });
const db = admin.firestore();
(async () => {
  const snap = await db.collection('students').get();
  console.log('\n== Candidatos (sem 1º login + sub Alpha/Espelho active/trial) — checagem Auth real ==\n');
  console.log('id_len | hasAuth | id | name | email');
  for (const d of snap.docs) {
    const data = d.data();
    if (data.accessStatus === 'active' || data.firstLoginAt) continue;
    const subsSnap = await d.ref.collection('subscriptions').get();
    const subs = subsSnap.docs.map(x => x.data());
    const elig = subs.some(s =>
      (s.plan === 'alpha' || s.plan === 'self_service') &&
      (s.status === 'active' || s.status === 'trial')
    );
    if (!elig) continue;
    let auth = false;
    if (data.email) {
      try { await admin.auth().getUserByEmail(data.email); auth = true; } catch {}
    }
    console.log(`${String(d.id.length).padStart(2)}    | ${auth ? '✅' : '❌'}     | ${d.id} | ${data.name} | ${data.email ?? '(vazio)'}`);
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
