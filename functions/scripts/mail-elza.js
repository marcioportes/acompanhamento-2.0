const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'acompanhamento-20' });
const db = admin.firestore();
(async () => {
  const snap = await db.collection('mail').where('to', '==', 'elza.echude@gmail.com').get();
  console.log(`\n== Emails enviados pra elza.echude@gmail.com em /mail: ${snap.size} ==\n`);
  for (const d of snap.docs) {
    const data = d.data();
    const created = data.delivery?.startTime?.toDate?.() ?? data.delivery?.endTime?.toDate?.();
    console.log(`  id=${d.id}`);
    console.log(`  subject=${data.message?.subject}`);
    console.log(`  delivery.state=${data.delivery?.state}`);
    console.log(`  delivery.startTime=${data.delivery?.startTime?.toDate?.()?.toISOString?.()}`);
    console.log(`  delivery.endTime=${data.delivery?.endTime?.toDate?.()?.toISOString?.()}`);
    console.log(`  delivery.error=${data.delivery?.error}`);
    console.log('');
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
