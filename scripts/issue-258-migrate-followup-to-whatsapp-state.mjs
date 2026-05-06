/**
 * Migração one-shot — issue #258
 *
 * Mapeia o campo legado `inFollowUp` (boolean) para o novo `whatsappState`:
 *   - inFollowUp === true       → whatsappState = 'talking'
 *   - inFollowUp === false/null → não toca (default 'none')
 *
 * Não apaga `inFollowUp` (mantém auditoria); novo UI ignora o campo legado.
 *
 * Uso:
 *   node scripts/issue-258-migrate-followup-to-whatsapp-state.mjs               # dry-run
 *   node scripts/issue-258-migrate-followup-to-whatsapp-state.mjs --execute --confirm=SIM
 */

import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const PROJECT_ID = 'acompanhamento-20';

function parseArgs(argv) {
  const out = { execute: false, confirmed: false };
  for (const a of argv.slice(2)) {
    if (a === '--execute') out.execute = true;
    else if (a === '--confirm=SIM') out.confirmed = true;
  }
  return out;
}

function initAdmin() {
  const require = createRequire(import.meta.url);
  const admin = require(join(PROJECT_ROOT, 'functions', 'node_modules', 'firebase-admin'));
  if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID });
  return admin;
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.execute && !opts.confirmed) {
    console.error('\n❌ --execute requer --confirm=SIM\n');
    process.exit(1);
  }
  const mode = opts.execute ? 'execute' : 'dryrun';
  console.log(`\n🔧 issue-258 — migrate inFollowUp → whatsappState [${mode.toUpperCase()}]`);
  console.log(`   Projeto: ${PROJECT_ID}\n`);

  const admin = initAdmin();
  const db = admin.firestore();

  const snap = await db.collectionGroup('subscriptions').get();
  console.log(`   subscriptions lidas: ${snap.size}`);

  let toMigrate = 0;
  let alreadySet = 0;
  let untouched = 0;
  const targets = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    const segments = doc.ref.path.split('/');
    const studentId = segments[1];
    const hasNewState = typeof data.whatsappState === 'string';
    if (data.inFollowUp === true) {
      if (hasNewState) {
        alreadySet++;
      } else {
        toMigrate++;
        targets.push({ studentId, subId: doc.id, ref: doc.ref });
      }
    } else {
      untouched++;
    }
  }

  console.log(`   inFollowUp=true sem whatsappState: ${toMigrate}`);
  console.log(`   inFollowUp=true já com whatsappState: ${alreadySet}`);
  console.log(`   sem inFollowUp ou =false:           ${untouched}\n`);

  if (toMigrate === 0) {
    console.log('   ✓ Nada para migrar.\n');
    return;
  }

  if (mode === 'dryrun') {
    console.log('   [dry-run] alvos:');
    for (const t of targets) console.log(`     - ${t.studentId}/${t.subId}`);
    console.log('\n   Para executar: --execute --confirm=SIM\n');
    return;
  }

  console.log('   Executando…');
  const batch = db.batch();
  for (const t of targets) {
    batch.update(t.ref, { whatsappState: 'talking' });
  }
  await batch.commit();
  console.log(`   ✓ ${toMigrate} subscriptions atualizadas para whatsappState='talking'\n`);
}

main().catch((err) => {
  console.error('\n❌ Erro:', err);
  process.exit(1);
});
