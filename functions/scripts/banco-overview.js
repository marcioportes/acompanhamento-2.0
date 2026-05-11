const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'acompanhamento-20' });
const db = admin.firestore();

const ENDED = new Set(['cancelled', 'expired']);

(async () => {
  const studentsSnap = await db.collection('students').get();
  const all = [];
  for (const docSnap of studentsSnap.docs) {
    const id = docSnap.id;
    const s = docSnap.data();
    const subsSnap = await docSnap.ref.collection('subscriptions').get();
    const subs = subsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    all.push({ id, ...s, _subs: subs });
  }

  const lacksAuth = (s) => s.id.startsWith('student_');
  const hasActiveAlphaEspelhoOrTrial = (s) => s._subs.some(
    (sub) => (sub.plan === 'alpha' || sub.plan === 'self_service')
      && (sub.status === 'active' || sub.status === 'trial')
  );
  const hasActiveSub = (s) => s._subs.some(sub => !ENDED.has(sub.status));
  const hasActiveVip = (s) => s._subs.some(sub => sub.type === 'vip' && !ENDED.has(sub.status));

  const candidatos = all.filter(s => lacksAuth(s) && hasActiveAlphaEspelhoOrTrial(s));
  const convidados = all.filter(s => !lacksAuth(s) && (s.accessStatus === 'pending' || (!s.accessStatus && (s.status === 'pending' || !s.firstLoginAt))) && hasActiveSub(s) && !hasActiveVip(s));
  const ativos = all.filter(s => !lacksAuth(s) && (s.accessStatus === 'active' || s.firstLoginAt) && !s.loginBlocked && hasActiveSub(s) && !hasActiveVip(s));
  const bloqueados = all.filter(s => s.loginBlocked);
  const vips = all.filter(s => hasActiveVip(s));
  const semSubAtiva = all.filter(s => !hasActiveSub(s));

  console.log(`\n== Quebra de ${all.length} alunos ==\n`);
  console.log(`Candidatos (sem Auth + sub Alpha/Espelho active/trial): ${candidatos.length}`);
  candidatos.forEach(s => console.log(`  - ${s.name ?? '(sem nome)'} | email=${s.email ?? '(vazio)'} | id=${s.id}`));
  console.log(`\nConvidados (com Auth, sem 1º login, sub ativa): ${convidados.length}`);
  convidados.forEach(s => console.log(`  - ${s.name ?? '(sem nome)'} | accessStatus=${s.accessStatus ?? 'undef'} | firstLogin=${s.firstLoginAt ? 'sim' : 'não'}`));
  console.log(`\nAtivos (1º login feito, não bloqueado): ${ativos.length}`);
  console.log(`\nBloqueados: ${bloqueados.length}`);
  console.log(`\nVIP ativo (não aparece em Acompanhamento): ${vips.length}`);
  console.log(`\nSem sub ativa (cancelled/expired only ou nenhuma): ${semSubAtiva.length}`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
