const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'acompanhamento-20' });
const db = admin.firestore();
(async () => {
  // Buscar doc no Firestore
  const snap = await db.collection('students').where('email', '==', 'marcio.portes@icloud.com').get();
  console.log(`\n== Doc Firestore: ${snap.size} encontrados ==`);
  for (const d of snap.docs) {
    const data = d.data();
    console.log(`  id=${d.id}`);
    console.log(`  name=${data.name}`);
    console.log(`  email=${data.email}`);
    console.log(`  firstLoginAt=${data.firstLoginAt}`);
    const subs = await d.ref.collection('subscriptions').get();
    console.log(`  subscriptions: ${subs.size}`);
    let totalPays = 0;
    for (const s of subs.docs) {
      const ps = await s.ref.collection('payments').get();
      totalPays += ps.size;
      console.log(`    sub ${s.id} (plan=${s.data().plan} status=${s.data().status}): ${ps.size} payments`);
    }
    console.log(`  total payments: ${totalPays}`);
    // assessment?
    const ass = await d.ref.collection('assessment').get();
    console.log(`  assessment docs: ${ass.size}`);
    // trades (top-level por studentId)
    const trades = await db.collection('trades').where('studentId', '==', d.id).limit(1).get();
    const tradesCount = await db.collection('trades').where('studentId', '==', d.id).count().get();
    console.log(`  trades (top-level): ${tradesCount.data().count}`);
  }
  // Auth user
  console.log('\n== Auth user ==');
  try {
    const user = await admin.auth().getUserByEmail('marcio.portes@icloud.com');
    console.log(`  uid=${user.uid} disabled=${user.disabled} customClaims=${JSON.stringify(user.customClaims)}`);
  } catch (e) {
    console.log(`  ${e.code}: ${e.message}`);
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
