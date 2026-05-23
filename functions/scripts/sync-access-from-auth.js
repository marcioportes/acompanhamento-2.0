/**
 * sync-access-from-auth.js
 * @description Backfill manual de /students após fix do firestore.rules (#271).
 *
 * Para cada doc com `accessStatus !== 'active'` cujo email tem Auth user e
 * `metadata.lastSignInTime`, escreve no doc:
 *   { status: 'active', accessStatus: 'active', firstLoginAt: lastSignInTime }
 *
 * Cenário coberto: alunos cuja escrita do AuthContext.activateStudent falhou
 * silenciosamente entre DEC-AUTO-263-07 e #271 (regra do Firestore rejeitava
 * accessStatus). Sem o backfill, esses só voltam ao state correto na próxima
 * vez que reabrirem a app (onAuthStateChanged dispara activateStudent — que
 * agora passa pela regra).
 *
 * Idempotente: docs já active são pulados.
 *
 * Modos:
 *   `node sync-access-from-auth.js`            → dry-run, lista o que faria
 *   `node sync-access-from-auth.js --apply`    → aplica as escritas
 *
 * Service account: usar credentials default do gcloud (ADC) ou
 * GOOGLE_APPLICATION_CREDENTIALS apontando para chave JSON.
 */

const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'acompanhamento-20' });
const db = admin.firestore();
const auth = admin.auth();

const APPLY = process.argv.includes('--apply');

(async () => {
  const mode = APPLY ? 'APPLY (write)' : 'DRY-RUN (no write)';
  console.log(`\n== sync-access-from-auth — ${mode} ==\n`);

  const snap = await db.collection('students').get();
  const counts = {
    total: snap.size,
    skipped_active: 0,
    skipped_no_email: 0,
    skipped_no_auth: 0,
    skipped_never_signed_in: 0,
    candidate: 0,
    applied: 0,
    errors: 0,
  };
  const candidates = [];

  for (const docSnap of snap.docs) {
    const data = docSnap.data();

    if (data.accessStatus === 'active') {
      counts.skipped_active += 1;
      continue;
    }
    if (!data.email) {
      counts.skipped_no_email += 1;
      continue;
    }

    let user;
    try {
      user = await auth.getUserByEmail(data.email);
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        counts.skipped_no_auth += 1;
        continue;
      }
      console.error(`[${docSnap.id}] erro getUserByEmail:`, e.code || e.message);
      counts.errors += 1;
      continue;
    }

    const lastSignInISO = user.metadata?.lastSignInTime;
    if (!lastSignInISO) {
      counts.skipped_never_signed_in += 1;
      continue;
    }

    // Preserva firstLoginAt quando já set (não sobrescreve timestamp histórico).
    // Para legados pré-DEC-AUTO-263-07 com firstLoginAt populado, atualiza
    // apenas status + accessStatus. Para os realmente quebrados pelo bug do
    // #271 (firstLoginAt:null porque escrita do AuthContext falhava), escreve
    // firstLoginAt = lastSignInTime do Firebase Auth.
    const update = {
      status: 'active',
      accessStatus: 'active',
    };
    if (!data.firstLoginAt) {
      update.firstLoginAt = admin.firestore.Timestamp.fromDate(new Date(lastSignInISO));
    }

    counts.candidate += 1;
    candidates.push({
      id: docSnap.id,
      name: data.name,
      email: data.email,
      curStatus: data.status ?? '(undef)',
      curAccess: data.accessStatus ?? '(undef)',
      curFirstLogin: data.firstLoginAt ? 'set' : 'null',
      action: data.firstLoginAt
        ? 'accessStatus=active (preserva firstLoginAt)'
        : `accessStatus=active + firstLoginAt=${lastSignInISO}`,
    });

    if (APPLY) {
      try {
        await docSnap.ref.update(update);
        counts.applied += 1;
      } catch (e) {
        console.error(`[${docSnap.id}] erro update:`, e.message);
        counts.errors += 1;
      }
    }
  }

  console.log('\n--- candidatos ---');
  candidates.forEach((c) => {
    console.log(
      `  ${c.id.slice(0, 8)}… | ${c.name ?? '(sem nome)'} | ${c.email}\n` +
      `    estado: status=${c.curStatus} accessStatus=${c.curAccess} firstLoginAt=${c.curFirstLogin}\n` +
      `    ação:   ${c.action}`,
    );
  });

  console.log('\n--- contagens ---');
  Object.entries(counts).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

  if (!APPLY && counts.candidate > 0) {
    console.log('\nDry-run completo. Para aplicar: node sync-access-from-auth.js --apply');
  }

  process.exit(counts.errors > 0 ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
