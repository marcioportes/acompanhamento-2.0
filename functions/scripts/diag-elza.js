const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'acompanhamento-20' });
const db = admin.firestore();

(async () => {
  // 1. Encontrar Elza no Firestore
  const snap = await db.collection('students').where('email', '==', 'elza.echude@gmail.com').get();
  console.log('\n== Docs Firestore com email elza.echude@gmail.com ==');
  for (const d of snap.docs) {
    const data = d.data();
    console.log(`  id=${d.id}`);
    console.log(`  name=${data.name}`);
    console.log(`  email=${data.email}`);
    console.log(`  status=${data.status}`);
    console.log(`  accessStatus=${data.accessStatus}`);
    console.log(`  firstLoginAt=${data.firstLoginAt}`);
    console.log(`  promotedFrom=${data.promotedFrom}`);
  }

  // 2. Buscar por nome (caso email tenha sido digitado diferente)
  const byName = await db.collection('students').where('name', '==', 'Elza (mentoria)').get();
  console.log(`\n== Docs com name='Elza (mentoria)': ${byName.size} ==`);
  for (const d of byName.docs) {
    const data = d.data();
    console.log(`  id=${d.id} email=${data.email}`);
  }

  // 3. Tentar achar Auth user pelo email
  console.log('\n== Auth user lookup ==');
  try {
    const user = await admin.auth().getUserByEmail('elza.echude@gmail.com');
    console.log(`  ✅ Auth user encontrado: uid=${user.uid} email=${user.email} disabled=${user.disabled}`);
  } catch (e) {
    console.log(`  ❌ Auth user NÃO encontrado: ${e.code} ${e.message}`);
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
