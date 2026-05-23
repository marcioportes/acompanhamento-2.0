const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'acompanhamento-20' });
const db = admin.firestore();
(async () => {
  // Doc antigo (auto-id 20 chars)
  const oldDoc = await db.collection('students').doc('8meEuIrQf13uNkt2pPa7').get();
  console.log(`\nDoc antigo /students/8meEuIrQf13uNkt2pPa7: ${oldDoc.exists ? 'EXISTE' : 'apagado'}`);
  if (oldDoc.exists) {
    console.log(`  email=${oldDoc.data().email} subs:`);
    const subs = await oldDoc.ref.collection('subscriptions').get();
    subs.forEach(s => console.log(`    - ${s.id} plan=${s.data().plan} status=${s.data().status}`));
  }

  // Doc novo (Auth UID 28 chars)
  const newDoc = await db.collection('students').doc('irPFfXJw6Bca8rJ15mXtUKSJ3KS2').get();
  console.log(`\nDoc novo /students/irPFfXJw6Bca8rJ15mXtUKSJ3KS2: ${newDoc.exists ? 'EXISTE' : 'NÃO existe'}`);
  if (newDoc.exists) {
    console.log(`  email=${newDoc.data().email} promotedFrom=${newDoc.data().promotedFrom} accessStatus=${newDoc.data().accessStatus}`);
    const subs = await newDoc.ref.collection('subscriptions').get();
    console.log(`  subs:`);
    subs.forEach(s => console.log(`    - ${s.id} plan=${s.data().plan} status=${s.data().status}`));
  }

  // Pesquisar por email no Firestore
  const byEmail = await db.collection('students').where('email', '==', 'elza.echude@gmail.com').get();
  console.log(`\nDocs com email elza.echude@gmail.com: ${byEmail.size}`);
  byEmail.forEach(d => console.log(`  - id=${d.id}`));

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
