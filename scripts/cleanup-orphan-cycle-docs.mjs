#!/usr/bin/env node
/**
 * cleanup-orphan-cycle-docs.mjs — purga de docs órfãos pós #259
 *
 * CONTEXTO:
 *   `useAccounts.deleteAccount` antigo só deletava movements + plans + trades
 *   (e tradicionalmente pelo caminho `studentEmail`, com risco de não cobrir
 *   todos). Cycle closures, orders e qualquer trade não-coberto ficaram com
 *   accountId/planId apontando pra docs já deletados — órfãos no banco.
 *
 *   Sucessor já corrigiu o handler. Esse script limpa o passivo.
 *
 * CRITÉRIO DE ÓRFÃO:
 *   trade.accountId NOT IN aliveAccountIds  OR  trade.planId NOT IN alivePlanIds
 *   order.planId    NOT IN alivePlanIds
 *   cycleClosure.accountId/planId fora dos vivos
 *   movement.accountId NOT IN aliveAccountIds
 *
 * MODO DRY-RUN (default):
 *   node scripts/cleanup-orphan-cycle-docs.mjs
 *
 * MODO EXECUTE (requer dupla confirmação):
 *   node scripts/cleanup-orphan-cycle-docs.mjs --execute --confirm=SIM
 *
 * PRÉ-REQUISITOS:
 *   gcloud auth application-default login
 *
 * LOG:
 *   scripts/logs/cleanup-orphans-{dryrun|execute}-<ISO8601>.json
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

const args = process.argv.slice(2);
const EXECUTE = args.includes('--execute');
const CONFIRMED = args.includes('--confirm=SIM');
const MODE = EXECUTE ? (CONFIRMED ? 'execute' : 'execute-needs-confirm') : 'dryrun';

if (MODE === 'execute-needs-confirm') {
  console.error('ERRO: --execute exige também --confirm=SIM');
  process.exit(1);
}

admin.initializeApp({ projectId: 'acompanhamento-20' });
const db = admin.firestore();

const log = { mode: MODE, startedAt: new Date().toISOString(), counts: {}, orphans: {} };

async function loadAlive() {
  const [accountsSnap, plansSnap] = await Promise.all([
    db.collection('accounts').get(),
    db.collection('plans').get(),
  ]);
  return {
    aliveAccountIds: new Set(accountsSnap.docs.map((d) => d.id)),
    alivePlanIds:    new Set(plansSnap.docs.map((d) => d.id)),
  };
}

async function collectOrphans({ aliveAccountIds, alivePlanIds }) {
  const tradesSnap    = await db.collection('trades').get();
  const ordersSnap    = await db.collection('orders').get();
  const closuresSnap  = await db.collection('cycleClosures').get();
  const movementsSnap = await db.collection('movements').get();

  const orphanTrades = tradesSnap.docs.filter((d) => {
    const x = d.data();
    const acctDead = x.accountId && !aliveAccountIds.has(x.accountId);
    const planDead = x.planId && !alivePlanIds.has(x.planId);
    return acctDead || planDead;
  });

  const orphanOrders = ordersSnap.docs.filter((d) => {
    const x = d.data();
    return x.planId && !alivePlanIds.has(x.planId);
  });

  const orphanClosures = closuresSnap.docs.filter((d) => {
    const x = d.data();
    const acctDead = x.accountId && !aliveAccountIds.has(x.accountId);
    const planDead = x.planId && !alivePlanIds.has(x.planId);
    return acctDead || planDead;
  });

  const orphanMovements = movementsSnap.docs.filter((d) => {
    const x = d.data();
    return x.accountId && !aliveAccountIds.has(x.accountId);
  });

  return {
    orphanTrades, orphanOrders, orphanClosures, orphanMovements,
    totalDocs: {
      trades: tradesSnap.size,
      orders: ordersSnap.size,
      cycleClosures: closuresSnap.size,
      movements: movementsSnap.size,
    },
  };
}

function summarizeByAccountId(docs) {
  const map = new Map();
  for (const d of docs) {
    const k = d.data().accountId || '(sem accountId)';
    map.set(k, (map.get(k) || 0) + 1);
  }
  return Object.fromEntries(map);
}

function summarizeByPlanId(docs) {
  const map = new Map();
  for (const d of docs) {
    const k = d.data().planId || '(sem planId)';
    map.set(k, (map.get(k) || 0) + 1);
  }
  return Object.fromEntries(map);
}

async function deleteInBatches(refs) {
  if (refs.length === 0) return 0;
  const BATCH_SIZE = 450;
  let deleted = 0;
  for (let i = 0; i < refs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = refs.slice(i, i + BATCH_SIZE);
    for (const ref of chunk) batch.delete(ref);
    await batch.commit();
    deleted += chunk.length;
  }
  return deleted;
}

async function main() {
  console.log(`[cleanup-orphans] modo=${MODE}, iniciando...`);
  const { aliveAccountIds, alivePlanIds } = await loadAlive();
  log.counts = { aliveAccounts: aliveAccountIds.size, alivePlans: alivePlanIds.size };
  console.log(`[cleanup-orphans] alive: ${aliveAccountIds.size} accounts, ${alivePlanIds.size} plans`);

  const { orphanTrades, orphanOrders, orphanClosures, orphanMovements, totalDocs } =
    await collectOrphans({ aliveAccountIds, alivePlanIds });

  log.counts.totals = totalDocs;
  log.orphans = {
    trades:        { count: orphanTrades.length,    byAccountId: summarizeByAccountId(orphanTrades),    byPlanId: summarizeByPlanId(orphanTrades) },
    orders:        { count: orphanOrders.length,    byPlanId: summarizeByPlanId(orphanOrders) },
    cycleClosures: { count: orphanClosures.length,  byAccountId: summarizeByAccountId(orphanClosures) },
    movements:     { count: orphanMovements.length, byAccountId: summarizeByAccountId(orphanMovements) },
  };

  console.log('[cleanup-orphans] órfãos detectados:');
  console.log(`  - trades:        ${orphanTrades.length}/${totalDocs.trades}`);
  console.log(`  - orders:        ${orphanOrders.length}/${totalDocs.orders}`);
  console.log(`  - cycleClosures: ${orphanClosures.length}/${totalDocs.cycleClosures}`);
  console.log(`  - movements:     ${orphanMovements.length}/${totalDocs.movements}`);

  if (MODE === 'execute') {
    console.log('[cleanup-orphans] modo execute — apagando...');
    const deletedTrades    = await deleteInBatches(orphanTrades.map((d) => d.ref));
    const deletedOrders    = await deleteInBatches(orphanOrders.map((d) => d.ref));
    const deletedClosures  = await deleteInBatches(orphanClosures.map((d) => d.ref));
    const deletedMovements = await deleteInBatches(orphanMovements.map((d) => d.ref));
    log.deleted = { trades: deletedTrades, orders: deletedOrders, cycleClosures: deletedClosures, movements: deletedMovements };
    console.log(`[cleanup-orphans] apagados: ${deletedTrades + deletedOrders + deletedClosures + deletedMovements}`);
  } else {
    console.log('[cleanup-orphans] dry-run — nada apagado.');
  }

  log.finishedAt = new Date().toISOString();

  if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });
  const logPath = join(LOGS_DIR, `cleanup-orphans-${MODE}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(logPath, JSON.stringify(log, null, 2));
  console.log(`[cleanup-orphans] log salvo em ${logPath}`);
}

main().catch((err) => {
  console.error('[cleanup-orphans] erro fatal:', err);
  process.exit(1);
});
