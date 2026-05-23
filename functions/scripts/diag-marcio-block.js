const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'acompanhamento-20' });
const db = admin.firestore();
(async () => {
  const snap = await db.collection('students').where('email', '==', 'marcio.portes@icloud.com').get();
  console.log(`\n== Doc Firestore: ${snap.size} ==`);
  for (const d of snap.docs) {
    const data = d.data();
    console.log(`id=${d.id}`);
    console.log(`  loginBlocked=${data.loginBlocked}`);
    console.log(`  loginBlockedAt=${data.loginBlockedAt}`);
    console.log(`  loginBlockedBy=${data.loginBlockedBy}`);
    console.log(`  loginBlockedReason=${data.loginBlockedReason}`);
  }
  try {
    const user = await admin.auth().getUserByEmail('marcio.portes@icloud.com');
    console.log(`\n== Auth ==`);
    console.log(`  uid=${user.uid}`);
    console.log(`  disabled=${user.disabled}`);
    console.log(`  email=${user.email}`);
    console.log(`  emailVerified=${user.emailVerified}`);
  } catch (e) {
    console.log(`Auth: ${e.code}`);
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
