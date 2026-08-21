#!/usr/bin/env node
/**
 * purge-orphan-orders.mjs — ordem só existe atrelada a trade vivo (v1.83.16).
 *
 * Regra de produto (Marcio, 20/08/2026): sem trade vivo, a ordem não existe. Vale para o
 * import (o que casa com trade ou cria trade fica, o resto morre) e para o banco todo.
 *
 * Usa a MESMA função da Cloud Function (`functions/orders/purgeOrphanOrders.js`) — um
 * critério só, testado num lugar só. Substitui o `issue-366-cleanup-abandoned-batches.mjs`,
 * cujo critério era mais estreito (só lote sem nenhum trade) e deixava para trás as ordens
 * de operações recusadas dentro de lotes bons.
 *
 * USO:
 *   node scripts/purge-orphan-orders.mjs              # dry-run
 *   node scripts/purge-orphan-orders.mjs --yes        # aplica
 *   node scripts/purge-orphan-orders.mjs [studentId]  # escopa a um aluno
 *
 * O log grava o doc INTEIRO de cada exclusão — é o caminho de restauração.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { writeFileSync, mkdirSync, existsSync } = require('node:fs');
const { join, dirname } = require('node:path');
const { fileURLToPath } = require('node:url');
// Resolução relativa ao próprio script: funciona no main e em qualquer worktree.
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const admin = require(join(RAIZ, 'functions/node_modules/firebase-admin'));
const { purgeOrphanOrders } = require(join(RAIZ, 'functions/orders/purgeOrphanOrders.js'));

const LOGS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'logs');
const gravarLog = (payload) => {
  if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });
  const path = join(LOGS_DIR, `purge-orphan-orders-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(path, JSON.stringify(payload, null, 2));
  console.log(`\nlog: ${path}`);
};

admin.initializeApp({ projectId: 'acompanhamento-20' });
const db = admin.firestore();

const argv = process.argv.slice(2);
const APPLY = argv.includes('--yes');
const studentId = argv.find((a) => !a.startsWith('--')) || null;

// Snapshot ANTES: o dry-run precisa devolver o doc inteiro, e depois de apagado não há
// de onde tirá-lo.
const snap = studentId
  ? await db.collection('orders').where('studentId', '==', studentId).get()
  : await db.collection('orders').get();
const porId = new Map(snap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));

const r = await purgeOrphanOrders(db, { studentId, dryRun: !APPLY });
const docs = r.ids.map((id) => porId.get(id)).filter(Boolean);

console.log(`\norders no escopo : ${porId.size}`);
console.log(`sem trade vivo   : ${r.deleted}${APPLY ? ' (apagadas)' : ' (dry-run)'}`);
console.log(`preservadas      : ${r.kept}`);

const porAluno = new Map();
for (const d of docs) porAluno.set(d.studentId || '—', (porAluno.get(d.studentId || '—') || 0) + 1);
for (const [sid, n] of porAluno) console.log(`  aluno ${sid}: ${n}`);

if (!APPLY) console.log('\nDRY-RUN — nada foi apagado. Repita com --yes para aplicar.');
gravarLog({ applied: APPLY, total: r.deleted, kept: r.kept, docs });
process.exit(0);
