#!/usr/bin/env node
/**
 * issue-366-cleanup-abandoned-batches.mjs — apaga as ordens de importações abandonadas.
 *
 * Até o #366 o wizard gravava em `orders` na Revisão de Operações, ANTES da decisão por
 * operação. Quem o aluno descartasse na tela seguinte — ou quem ele deixasse em
 * `pending`, ou o lote inteiro se ele fechasse o modal — já estava gravado, e o cliente
 * não apaga `orders` (`firestore.rules`: `allow delete: if false`). É esse passivo.
 *
 * USO:
 *   node scripts/issue-366-cleanup-abandoned-batches.mjs              # dry-run
 *   node scripts/issue-366-cleanup-abandoned-batches.mjs --yes        # aplica
 *   node scripts/issue-366-cleanup-abandoned-batches.mjs [studentId]  # escopa
 *
 * O log grava o doc INTEIRO de cada exclusão — é o caminho de restauração.
 *
 * CRITÉRIO (as duas condições, juntas):
 *   1. o batch não produziu NENHUM trade — nenhum doc em `trades` com
 *      `importBatchId == batchId`; e
 *   2. a ordem não está ligada a trade vivo (`correlatedTradeId` nulo ou apontando
 *      para trade que não existe mais).
 *
 * A segunda condição é o que protege o batch 100% enriquecimento: ele legitimamente
 * não cria trade nenhum, mas suas ordens apontam para trades vivos. Sem ela o script
 * apagaria a evidência de execução de operações que o aluno confirmou.
 *
 * RODAR DEPOIS do deploy do #366 — antes disso o app continua produzindo passivo novo.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { writeFileSync, mkdirSync, existsSync } = require('node:fs');
const { join, dirname } = require('node:path');
const { fileURLToPath } = require('node:url');
const admin = require('/home/mportes/projects/acompanhamento-2.0/functions/node_modules/firebase-admin');

const LOGS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'logs');
/** Log com o doc INTEIRO de cada exclusão — caminho de restauração. */
const gravarLog = (payload) => {
  if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });
  const path = join(LOGS_DIR, `issue-366-cleanup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(path, JSON.stringify(payload, null, 2));
  console.log(`\nlog: ${path}`);
};

admin.initializeApp({ projectId: 'acompanhamento-20' });
const db = admin.firestore();

const argv = process.argv.slice(2);
const APPLY = argv.includes('--yes');
const only = argv.find((a) => !a.startsWith('--')) || null;

const tradesSnap = await db.collection('trades').get();
// Guarda de credencial: `trades` vazia faria toda ordem parecer abandonada.
if (tradesSnap.empty) {
  console.error('ABORTADO — collection `trades` veio vazia. Credencial ou projeto errado?');
  process.exit(1);
}

const tradesVivos = new Set(tradesSnap.docs.map(d => d.id));
const batchesComTrade = new Set();
for (const d of tradesSnap.docs) {
  const b = d.data().importBatchId;
  if (b) batchesComTrade.add(b);
}

const snap = only
  ? await db.collection('orders').where('studentId', '==', only).get()
  : await db.collection('orders').get();

const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

const abandonadas = [];
const preservadas = { comTradeNoBatch: 0, ligadasATradeVivo: 0, semBatch: 0 };

for (const o of docs) {
  if (!o.batchId) { preservadas.semBatch++; continue; }
  if (batchesComTrade.has(o.batchId)) { preservadas.comTradeNoBatch++; continue; }
  if (o.correlatedTradeId && tradesVivos.has(o.correlatedTradeId)) {
    preservadas.ligadasATradeVivo++;
    continue;
  }
  abandonadas.push(o);
}

const porAluno = new Map();
const porBatch = new Map();
for (const o of abandonadas) {
  const sid = o.studentId || '—';
  porAluno.set(sid, (porAluno.get(sid) || 0) + 1);
  porBatch.set(o.batchId, (porBatch.get(o.batchId) || 0) + 1);
}

console.log(`orders lidas: ${docs.length}   trades vivos: ${tradesVivos.size}   batches com trade: ${batchesComTrade.size}\n`);
console.log(`ABANDONADAS (a deletar)        : ${abandonadas.length}`);
console.log(`preservadas — batch gerou trade: ${preservadas.comTradeNoBatch}`);
console.log(`preservadas — trade vivo       : ${preservadas.ligadasATradeVivo}`);
console.log(`preservadas — sem batchId      : ${preservadas.semBatch}\n`);
for (const [sid, n] of porAluno) console.log(`  aluno ${sid}: ${n}`);
console.log('');
for (const [b, n] of porBatch) console.log(`  batch ${b}: ${n}`);

if (!APPLY) {
  console.log('\nDRY-RUN — nada foi apagado. Repita com --yes para aplicar.');
  gravarLog({ applied: false, total: abandonadas.length, docs: abandonadas });
  process.exit(0);
}

console.log(`\napagando ${abandonadas.length} docs…`);
const BATCH = 400;
let apagados = 0;
for (let i = 0; i < abandonadas.length; i += BATCH) {
  const chunk = abandonadas.slice(i, i + BATCH);
  const batch = db.batch();
  for (const d of chunk) batch.delete(db.collection('orders').doc(d.id));
  await batch.commit();
  apagados += chunk.length;
  console.log(`  ${apagados}/${abandonadas.length}`);
}
console.log(`concluído — ${apagados} docs apagados`);
gravarLog({ applied: true, total: apagados, docs: abandonadas });
process.exit(0);
