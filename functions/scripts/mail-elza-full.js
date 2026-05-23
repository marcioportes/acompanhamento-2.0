const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'acompanhamento-20' });
const db = admin.firestore();
(async () => {
  const snap = await db.collection('mail').where('to', '==', 'elza.echude@gmail.com').get();
  console.log(`\n== /mail docs pra elza.echude@gmail.com: ${snap.size} ==\n`);
  for (const d of snap.docs) {
    console.log(`\n--- doc id: ${d.id} ---`);
    console.log(JSON.stringify(d.data(), null, 2));
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
