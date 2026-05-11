const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'acompanhamento-20' });
const db = admin.firestore();

const NAMES = ['Elza (mentoria)', 'Antonio Pina', 'Wagner Costa', 'Luiz S S', 'Matheus Rolim'];

(async () => {
  for (const name of NAMES) {
    const snap = await db.collection('students').where('name', '==', name).get();
    for (const d of snap.docs) {
      const data = d.data();
      let authExists = false;
      let authUid = null;
      if (data.email) {
        try {
          const u = await admin.auth().getUserByEmail(data.email);
          authExists = true;
          authUid = u.uid;
        } catch (e) {
          authExists = false;
        }
      }
      console.log(`\n${name}`);
      console.log(`  id=${d.id} (len=${d.id.length})`);
      console.log(`  email=${data.email ?? '(vazio)'}`);
      console.log(`  accessStatus=${data.accessStatus ?? 'undef'}`);
      console.log(`  status=${data.status ?? 'undef'}`);
      console.log(`  firstLoginAt=${data.firstLoginAt ? 'sim' : 'não'}`);
      console.log(`  createdBy=${data.createdBy ?? 'undef'}`);
      console.log(`  uid=${data.uid ?? 'undef'}`);
      console.log(`  Auth exists? ${authExists}  authUid=${authUid}  (match doc.id? ${authUid === d.id})`);
    }
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
