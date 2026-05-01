#!/usr/bin/env node
/**
 * issue-210-cleanup-takeaways-field.mjs — run-once DELETE do campo legacy
 *
 * CONTEXTO (issue #210):
 *   Após Stage 4 (#102, b11e73bf), reviews ficaram com 2 campos paralelos
 *   representando takeaways: `takeaways` (string legacy) e `takeawayItems[]`
 *   (array canônico). PR #211 removeu todas as escritas/leituras do string
 *   no código. Conteúdo legado em prod fica órfão se não removido.
 *
 *   Marcio (30/04/2026): "Apaga os takeaway".
 *
 * ESTRATÉGIA: DELETE direto via FieldValue.delete().
 *   - collectionGroup('reviews') varre TODAS as subcollections
 *     `students/{uid}/reviews/{rid}`.
 *   - Para cada doc com `takeaways` !== undefined, batch update apagando
 *     o campo (não toca outros campos).
 *   - Batches de 400 (limite Firestore = 500, margem defensiva).
 *
 * MODO DRY-RUN (default):
 *   node scripts/issue-210-cleanup-takeaways-field.mjs
 *
 * MODO EXECUTE (requer dupla confirmação):
 *   node scripts/issue-210-cleanup-takeaways-field.mjs --execute --confirm=SIM
 *
 * PRÉ-REQUISITOS:
 *   Application Default Credentials ativas:
 *     gcloud auth application-default login
 *
 * LOG:
 *   scripts/logs/issue-210-{dryrun|execute}-<ISO8601>.json
 */

import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const LOGS_DIR = join(PROJECT_ROOT, 'scripts', 'logs');

const require = createRequire(import.meta.url);
const admin = require(join(PROJECT_ROOT, 'functions', 'node_modules', 'firebase-admin'));

const PROJECT_ID = 'acompanhamento-20';
const BATCH_SIZE = 400;

const args = process.argv.slice(2);
const EXECUTE = args.includes('--execute');
const CONFIRMED = args.includes('--confirm=SIM');

if (EXECUTE && !CONFIRMED) {
  console.error('\n❌ --execute requer --confirm=SIM (dupla confirmação obrigatória).\n');
  process.exit(1);
}

const MODE = EXECUTE ? 'execute' : 'dryrun';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: PROJECT_ID });
}
const db = admin.firestore();

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function writeLog(payload) {
  if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });
  const path = join(LOGS_DIR, `issue-210-${MODE}-${ts()}.json`);
  writeFileSync(path, JSON.stringify(payload, null, 2));
  return path;
}

async function main() {
  console.log(`\n🔧 issue-210 — DELETE campo takeaways (string) legacy [${MODE.toUpperCase()}]`);
  console.log(`   Projeto: ${PROJECT_ID}`);
  console.log(`   Alvo: students/{uid}/reviews/{rid}.takeaways (qualquer valor, inclusive null)\n`);

  // 1) Varrer collectionGroup('reviews')
  const allSnap = await db.collectionGroup('reviews').get();
  console.log(`   Total de reviews escaneadas: ${allSnap.size}`);

  // 2) Filtrar as que têm o campo
  const targets = [];
  for (const docSnap of allSnap.docs) {
    const data = docSnap.data();
    if ('takeaways' in data) {
      targets.push({
        path: docSnap.ref.path,
        id: docSnap.id,
        currentValue: data.takeaways,
        takeawaysType: typeof data.takeaways,
        hasTakeawayItems: Array.isArray(data.takeawayItems) && data.takeawayItems.length > 0,
      });
    }
  }

  console.log(`   Reviews com campo \`takeaways\` presente: ${targets.length}\n`);

  if (targets.length === 0) {
    console.log('✅ Nada a apagar — campo já ausente em todos os docs.\n');
    writeLog({ mode: MODE, totalScanned: allSnap.size, targets: [], updated: 0 });
    return;
  }

  // 3) Distribuição por tipo (info)
  const byType = {};
  let withItems = 0;
  for (const t of targets) {
    byType[t.takeawaysType] = (byType[t.takeawaysType] || 0) + 1;
    if (t.hasTakeawayItems) withItems += 1;
  }
  console.log('   Distribuição por tipo do campo:');
  for (const [type, count] of Object.entries(byType)) {
    console.log(`     ${type}: ${count}`);
  }
  console.log(`   Reviews com takeawayItems[] preenchido (perda zero ao apagar string): ${withItems}/${targets.length}\n`);

  // 4) Mostrar amostra (até 10)
  console.log('   Amostra (até 10):');
  for (const t of targets.slice(0, 10)) {
    const preview = t.takeawaysType === 'string'
      ? `"${(t.currentValue || '').slice(0, 60).replace(/\n/g, ' ')}${(t.currentValue || '').length > 60 ? '...' : ''}"`
      : String(t.currentValue);
    console.log(`     ${t.path}  →  ${t.takeawaysType.padEnd(6)} ${preview}`);
  }
  console.log();

  if (!EXECUTE) {
    console.log('🟡 DRY-RUN — nada gravado. Para executar:');
    console.log('     node scripts/issue-210-cleanup-takeaways-field.mjs --execute --confirm=SIM\n');
    const logPath = writeLog({ mode: MODE, totalScanned: allSnap.size, targets, updated: 0 });
    console.log(`📝 Log: ${logPath}\n`);
    return;
  }

  // 5) EXECUTE — apagar em batches
  console.log(`🔥 EXECUTE — apagando campo \`takeaways\` em ${targets.length} reviews (batches de ${BATCH_SIZE})...\n`);
  let updated = 0;
  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const slice = targets.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const t of slice) {
      batch.update(db.doc(t.path), {
        takeaways: admin.firestore.FieldValue.delete(),
      });
    }
    await batch.commit();
    updated += slice.length;
    console.log(`   batch ${Math.floor(i / BATCH_SIZE) + 1}: ${slice.length} docs apagados (total: ${updated}/${targets.length})`);
  }
  console.log(`\n✅ ${updated} reviews atualizados — campo \`takeaways\` removido.\n`);

  const logPath = writeLog({ mode: MODE, totalScanned: allSnap.size, targets, updated });
  console.log(`📝 Log: ${logPath}\n`);
}

main().catch((err) => {
  console.error('\n💥 erro:', err);
  process.exit(1);
});
