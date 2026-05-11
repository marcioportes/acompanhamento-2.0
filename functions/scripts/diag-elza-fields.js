const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'acompanhamento-20' });
const db = admin.firestore();
(async () => {
  const doc = await db.collection('students').doc('irPFfXJw6Bca8rJ15mXtUKSJ3KS2').get();
  console.log('\n== Campos completos do doc novo da Elza ==\n');
  console.log(JSON.stringify(doc.data(), null, 2));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
