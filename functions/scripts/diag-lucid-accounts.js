const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'acompanhamento-20' });
const db = admin.firestore();

(async () => {
  console.log('== Contas PROP usando templates Lucid (lucid-*) ==\n');

  // accounts é collection raiz com campo studentId (não subcollection)
  const accountsSnap = await db.collection('accounts').get();
  const lucidAccounts = [];
  let totalProp = 0;

  for (const acc of accountsSnap.docs) {
    const data = acc.data();
    if (data.type !== 'PROP') continue;
    totalProp += 1;
    const templateId = data.propFirm?.templateId;
    if (typeof templateId === 'string' && templateId.startsWith('lucid-')) {
      lucidAccounts.push({
        id: acc.id,
        path: acc.ref.path,
        templateId,
        firm: data.propFirm?.firm ?? null,
        phase: data.propFirm?.phase ?? null,
        name: data.name ?? null,
        studentId: data.studentId ?? null,
        createdBy: data.createdBy ?? null,
        balance: data.currentBalance ?? data.initialBalance ?? null,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? data.createdAt ?? null,
      });
    }
  }

  console.log(`Total contas PROP: ${totalProp}`);
  console.log(`Contas Lucid: ${lucidAccounts.length}\n`);

  if (lucidAccounts.length === 0) {
    console.log('Nenhuma conta Lucid em prod. Seed Defaults é 100% seguro.');
    process.exit(0);
  }

  for (const a of lucidAccounts) {
    console.log(`  accountId=${a.id}`);
    console.log(`  name="${a.name}"`);
    console.log(`  templateId=${a.templateId}`);
    console.log(`  phase=${a.phase}`);
    console.log(`  studentId=${a.studentId}`);
    console.log(`  createdBy=${a.createdBy}`);
    console.log(`  balance=${a.balance}`);
    console.log(`  createdAt=${a.createdAt}\n`);
  }

  // Resolve nomes dos alunos
  const studentIds = [...new Set(lucidAccounts.map(a => a.studentId).filter(Boolean))];
  console.log(`-- Alunos donos das contas (${studentIds.length}) --`);
  for (const uid of studentIds) {
    const sdoc = await db.collection('students').doc(uid).get();
    if (sdoc.exists) {
      const d = sdoc.data();
      console.log(`  ${uid}: ${d.name} <${d.email}> · accessStatus=${d.accessStatus ?? '—'} · tier=${d.tier ?? '—'}`);
    } else {
      console.log(`  ${uid}: (student doc não encontrado)`);
    }
  }
})();
