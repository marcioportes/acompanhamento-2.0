#!/usr/bin/env node
/**
 * issue-351-backfill-apply.mjs — apply do backfill de correlação de ordens órfãs (#351).
 *
 * ESCREVE em `orders`. Rodar SOMENTE após `issue-351-backfill-dryrun.mjs` e aprovação
 * explícita do resultado. Reusa `correlateOrders` de `src/utils/orderCorrelation.js` — a
 * mesma função do dry-run e do import em runtime.
 *
 * Conservador por construção:
 *   - só toca docs com `correlatedTradeId` ausente/null — nunca sobrescreve correlação existente
 *   - só docs FILLED/PARTIALLY_FILLED
 *   - grava apenas `correlatedTradeId` + `correlationConfidence` + marca de auditoria
 *
 * USO:
 *   node scripts/issue-351-backfill-apply.mjs --yes                    # todos os alunos
 *   node scripts/issue-351-backfill-apply.mjs --yes --student <id>     # escopa a um aluno
 *
 * Sem `--yes` o script não escreve nada (comporta-se como dry-run e avisa).
 *
 * PRÉ-REQUISITOS:
 *   gcloud auth application-default login
 *
 * LOG (inclui o valor anterior de cada doc — base para rollback manual):
 *   scripts/logs/issue-351-backfill-apply-<ISO8601>.json
 */

import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { correlateOrders } from '../src/utils/orderCorrelation.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const LOGS_DIR = join(PROJECT_ROOT, 'scripts', 'logs');

const require = createRequire(import.meta.url);
const admin = require(join(PROJECT_ROOT, 'functions', 'node_modules', 'firebase-admin'));

const args = process.argv.slice(2);
const CONFIRMED = args.includes('--yes');
const studentIdx = args.indexOf('--student');
const onlyStudentId = studentIdx >= 0 ? args[studentIdx + 1] : null;

admin.initializeApp({ projectId: 'acompanhamento-20' });
const db = admin.firestore();

const BATCH_SIZE = 400;

const isFilledOrphan = (o) =>
  (o.status === 'FILLED' || o.status === 'PARTIALLY_FILLED') && !o.correlatedTradeId;

const toCorrelatable = (doc) => {
  const d = doc.data();
  return {
    _rowIndex: doc.id,
    instrument: d.instrument,
    side: d.side,
    status: d.status,
    quantity: d.quantity,
    filledQuantity: d.filledQuantity,
    filledPrice: d.filledPrice,
    submittedAt: d.submittedAt,
    filledAt: d.filledAt,
  };
};

async function main() {
  if (!CONFIRMED) {
    console.log('[351-apply] SEM --yes: nada será escrito. Rode o dry-run primeiro e revise o resultado.');
  }
  console.log(`[351-apply] iniciando${onlyStudentId ? ` — aluno ${onlyStudentId}` : ' — todos os alunos'}`);

  const ordersSnap = onlyStudentId
    ? await db.collection('orders').where('studentId', '==', onlyStudentId).get()
    : await db.collection('orders').get();

  const orphans = ordersSnap.docs.filter((d) => isFilledOrphan(d.data()));
  console.log(`[351-apply] ${ordersSnap.size} orders lidas · ${orphans.length} fills órfãos`);

  const byPlan = new Map();
  for (const doc of orphans) {
    const planId = doc.data().planId;
    if (!planId) continue;
    if (!byPlan.has(planId)) byPlan.set(planId, []);
    byPlan.get(planId).push(doc);
  }

  const updates = [];
  for (const [planId, docs] of byPlan) {
    const snap = await db.collection('trades').where('planId', '==', planId).get();
    const trades = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (!trades.length) continue;

    const { correlations } = correlateOrders(docs.map(toCorrelatable), trades);
    const byDocId = new Map(correlations.map((c) => [c.orderIndex, c]));

    for (const doc of docs) {
      const corr = byDocId.get(doc.id);
      if (!corr?.tradeId) continue;
      updates.push({
        orderId: doc.id,
        studentId: doc.data().studentId || null,
        planId,
        before: { correlatedTradeId: doc.data().correlatedTradeId ?? null, correlationConfidence: doc.data().correlationConfidence ?? null },
        after: { correlatedTradeId: corr.tradeId, correlationConfidence: corr.confidence },
        role: corr.role,
        details: corr.details,
      });
    }
  }

  console.log(`[351-apply] ${updates.length} docs a atualizar`);

  if (!CONFIRMED) {
    console.log('[351-apply] modo seguro — nenhuma escrita executada. Repita com --yes para aplicar.');
    return { applied: false, count: updates.length, updates };
  }

  let written = 0;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const chunk = updates.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const u of chunk) {
      batch.update(db.collection('orders').doc(u.orderId), {
        correlatedTradeId: u.after.correlatedTradeId,
        correlationConfidence: u.after.correlationConfidence,
        correlationBackfilledBy: 'issue-351',
        correlationBackfilledAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    written += chunk.length;
    console.log(`[351-apply] ${written}/${updates.length}`);
  }

  console.log(`[351-apply] concluído — ${written} docs atualizados`);
  return { applied: true, count: written, updates };
}

main()
  .then((result) => {
    if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const path = join(LOGS_DIR, `issue-351-backfill-apply-${stamp}.json`);
    writeFileSync(path, JSON.stringify(result, null, 2));
    console.log(`\n[351-apply] log: ${path}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('[351-apply] ERRO:', err);
    process.exit(1);
  });
