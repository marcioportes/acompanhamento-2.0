#!/usr/bin/env node
/**
 * issue-351-cleanup-orders.mjs — limpeza de docs de `orders` inalcançáveis ou duplicados.
 *
 * `ingestBatch` não deduplica: reimportar o mesmo arquivo cria cópias. E `onTradeDeleted`
 * não desliga as ordens do trade apagado, então elas ficam apontando para um id morto.
 * Nenhum dos dois é limpável pelo app — `firestore.rules` tem `allow delete: if false`
 * em `/orders`.
 *
 * USO:
 *   node scripts/issue-351-cleanup-orders.mjs              # dry-run
 *   node scripts/issue-351-cleanup-orders.mjs --yes        # aplica
 *   node scripts/issue-351-cleanup-orders.mjs [studentId]  # escopa
 *
 * O log grava o doc INTEIRO de cada exclusão — é o caminho de restauração.
 *
 * Regras (nesta ordem):
 *   R1 — `correlatedTradeId` aponta para trade que não existe mais → deletar.
 *        Trade apagado não desliga suas ordens (onTradeDeleted não toca em `orders`),
 *        e o vínculo é o único caminho de leitura: sem trade vivo o doc é inalcançável.
 *   R2 — órfã cujo fingerprint já existe numa order ligada a trade VIVO → deletar (cópia redundante).
 *   R3 — órfãs duplicadas entre si (mesmo fingerprint) → manter a mais antiga, deletar o resto.
 *
 * Fingerprint: planId|instrument|side|status|timestamp|qty
 *
 * USO:
 *   node scripts/issue-353-cleanup-orphan-orders-dryrun.mjs [studentId]
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
  const path = join(LOGS_DIR, `issue-351-cleanup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(path, JSON.stringify(payload, null, 2));
  console.log(`\nlog: ${path}`);
};
admin.initializeApp({ projectId: 'acompanhamento-20' });
const db = admin.firestore();

const argv = process.argv.slice(2);
const APPLY = argv.includes('--yes');
const only = argv.find((a) => !a.startsWith('--')) || null;

const fp = (o) => [o.planId, (o.instrument||'').toUpperCase(), o.side, o.status,
  o.filledAt || o.submittedAt || '', o.filledQuantity ?? o.quantity ?? ''].join('|');

const vivos = new Set((await db.collection('trades').get()).docs.map(d => d.id));
const snap = only
  ? await db.collection('orders').where('studentId','==',only).get()
  : await db.collection('orders').get();

const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
const r1 = [], r2 = [], r3 = [], ambiguos = [];

// R2 também precisa da guarda de batch: só é redundante se veio de OUTRO batch.
const vivasPorFpBatch = new Map();
for (const o of docs) {
  if (o.correlatedTradeId && vivos.has(o.correlatedTradeId)) {
    const k = fp(o);
    if (!vivasPorFpBatch.has(k)) vivasPorFpBatch.set(k, new Set());
    vivasPorFpBatch.get(k).add(o.batchId || '—');
  }
}

const orfasPorFp = new Map();
for (const o of docs) {
  if (o.correlatedTradeId && !vivos.has(o.correlatedTradeId)) { r1.push(o); continue; }
  if (o.correlatedTradeId) continue;
  const batchesVivos = vivasPorFpBatch.get(fp(o));
  if (batchesVivos && [...batchesVivos].some(b => b !== (o.batchId || '—'))) { r2.push(o); continue; }
  const k = fp(o);
  if (!orfasPorFp.has(k)) orfasPorFp.set(k, []);
  orfasPorFp.get(k).push(o);
}
// R3 só colapsa cópias vindas de BATCHES DIFERENTES — isso é reimportação.
// Duas orders idênticas DENTRO do mesmo batch são ordens reais distintas da corretora
// (mesmo instante, mesma qty) e nunca podem ser tratadas como duplicata: `orders` não
// guarda `externalOrderId`, então o fingerprint sozinho não as distingue.
for (const [, list] of orfasPorFp) {
  if (list.length < 2) continue;
  const porBatch = new Map();
  for (const o of list) {
    const b = o.batchId || '—';
    if (!porBatch.has(b)) porBatch.set(b, []);
    porBatch.get(b).push(o);
  }
  if (porBatch.size < 2) continue;               // tudo do mesmo batch → não mexe
  const tamanhos = [...porBatch.values()].map(v => v.length);
  if (new Set(tamanhos).size > 1) { ambiguos.push(...list); continue; }  // contagens divergem → não arrisca
  const batches = [...porBatch.keys()].sort();
  for (const b of batches.slice(1)) r3.push(...porBatch.get(b));
}

// R4 — duplicata ligada ao MESMO trade vivo, vinda de batches diferentes.
// É o caso que aparece quando se reimporta um arquivo de ordens sem apagar o trade:
// as cópias novas correlacionam no mesmo trade e o motor comportamental conta duas vezes.
const r4 = [];
const vivasPorChave = new Map();
for (const o of docs) {
  if (!o.correlatedTradeId || !vivos.has(o.correlatedTradeId)) continue;
  const k = `${o.correlatedTradeId}|${fp(o)}`;
  if (!vivasPorChave.has(k)) vivasPorChave.set(k, []);
  vivasPorChave.get(k).push(o);
}
for (const [, list] of vivasPorChave) {
  if (list.length < 2) continue;
  const porBatch = new Map();
  for (const o of list) {
    const b = o.batchId || '—';
    if (!porBatch.has(b)) porBatch.set(b, []);
    porBatch.get(b).push(o);
  }
  if (porBatch.size < 2) continue;
  const tamanhos = [...porBatch.values()].map(v => v.length);
  if (new Set(tamanhos).size > 1) { ambiguos.push(...list); continue; }
  for (const b of [...porBatch.keys()].sort().slice(1)) r4.push(...porBatch.get(b));
}

const porAluno = new Map();
for (const [rule, list] of [['R1',r1],['R2',r2],['R3',r3],['R4',r4]])
  for (const o of list) {
    const k = o.studentId || '—';
    if (!porAluno.has(k)) porAluno.set(k, { R1:0, R2:0, R3:0, R4:0 });
    porAluno.get(k)[rule]++;
  }

console.log(`orders lidas: ${docs.length}   trades vivos: ${vivos.size}\n`);
console.log(`R1 vínculo para trade apagado : ${r1.length}`);
console.log(`R2 órfã redundante (já existe): ${r2.length}`);
console.log(`R3 órfã duplicada entre si    : ${r3.length}`);
console.log(`R4 duplicata no MESMO trade   : ${r4.length}`);
console.log(`AMBÍGUO — não tocar           : ${ambiguos.length}`);
console.log(`TOTAL a deletar               : ${r1.length + r2.length + r3.length + r4.length}`);
console.log(`SOBREVIVEM                    : ${docs.length - (r1.length+r2.length+r3.length+r4.length)}\n`);
for (const [sid, c] of porAluno) console.log(`  ${sid}  R1=${c.R1} R2=${c.R2} R3=${c.R3} R4=${c.R4}`);

const paraDeletar = [...r1, ...r2, ...r3, ...r4];

if (!APPLY) {
  console.log('\nDRY-RUN — nada foi apagado. Repita com --yes para aplicar.');
  gravarLog({ applied: false, total: paraDeletar.length, docs: paraDeletar });
  process.exit(0);
}

console.log(`\napagando ${paraDeletar.length} docs…`);
const BATCH = 400;
let apagados = 0;
for (let i = 0; i < paraDeletar.length; i += BATCH) {
  const chunk = paraDeletar.slice(i, i + BATCH);
  const batch = db.batch();
  for (const d of chunk) batch.delete(db.collection('orders').doc(d.id));
  await batch.commit();
  apagados += chunk.length;
  console.log(`  ${apagados}/${paraDeletar.length}`);
}
console.log(`concluído — ${apagados} docs apagados`);
gravarLog({ applied: true, total: apagados, docs: paraDeletar });
process.exit(0);
