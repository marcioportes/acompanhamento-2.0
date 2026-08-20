#!/usr/bin/env node
/**
 * issue-363-cleanup-orphan-refs.mjs — apaga o passivo de referências a trades que não existem mais.
 *
 * A cascata do `onTradeDeleted` (#363 fase A/B) impede órfão NOVO, mas não alcança o que já
 * ficou para trás. Medição em produção 19/08/2026: 5.129 notificações órfãs (89% da collection,
 * todas não lidas), 26 ordens e 1 entrada de drawdownHistory.
 *
 * USO:
 *   node scripts/issue-363-cleanup-orphan-refs.mjs           # dry-run
 *   node scripts/issue-363-cleanup-orphan-refs.mjs --yes     # aplica
 *
 * O log grava o doc INTEIRO de cada exclusão — é o caminho de restauração.
 *
 * ESCOPO (espelha a cascata; o que ela não apaga, o script não apaga):
 *   `movements.tradeId`, `orders.correlatedTradeId`, `notifications.tradeId` apontando para
 *   trade inexistente. `drawdownHistory` fica fora (append-only, #52) e as referências em
 *   `reviews` também (dentro do `frozenSnapshot`, congelado — DEC-AUTO-363-04).
 *
 * SEGURANÇA:
 *   - o conjunto de trades vivos é lido UMA vez, antes de qualquer decisão
 *   - doc sem o campo de vínculo, ou com vínculo vazio, nunca é tocado: ausência de ponteiro
 *     não é ponteiro morto
 *   - aborta se a leitura de `trades` vier vazia (proteção contra credencial/projeto errado,
 *     em que TUDO pareceria órfão)
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { writeFileSync, mkdirSync, existsSync } = require('node:fs');
const { join, dirname } = require('node:path');
const { fileURLToPath } = require('node:url');
const admin = require('/home/mportes/projects/acompanhamento-2.0/functions/node_modules/firebase-admin');

const LOGS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'logs');
const gravarLog = (payload) => {
  if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });
  const path = join(LOGS_DIR, `issue-363-cleanup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(path, JSON.stringify(payload, null, 2));
  console.log(`\nlog: ${path}`);
};

admin.initializeApp({ projectId: 'acompanhamento-20' });
const db = admin.firestore();

const APPLY = process.argv.slice(2).includes('--yes');

/** Mesmos alvos e mesmos campos da cascata — uma definição só do que "aponta para o trade". */
const ALVOS = [
  { collection: 'movements', field: 'tradeId' },
  { collection: 'orders', field: 'correlatedTradeId' },
  { collection: 'notifications', field: 'tradeId' },
];

const tradesSnap = await db.collection('trades').get();
const vivos = new Set(tradesSnap.docs.map((d) => d.id));
if (vivos.size === 0) {
  console.error('ABORTADO: nenhum trade lido. Credencial ou projeto errado — tudo pareceria órfão.');
  process.exit(1);
}
console.log(`trades vivos: ${vivos.size}\n`);

const porAlvo = {};
const paraDeletar = [];

for (const { collection, field } of ALVOS) {
  const snap = await db.collection(collection).get();
  const orfaos = [];
  for (const d of snap.docs) {
    const data = d.data();
    const ponteiro = data[field];
    // Sem ponteiro não há órfão: o doc simplesmente não fala sobre trade nenhum.
    if (typeof ponteiro !== 'string' || ponteiro === '') continue;
    if (vivos.has(ponteiro)) continue;
    orfaos.push({ collection, id: d.id, data });
  }
  porAlvo[collection] = { total: snap.size, comPonteiro: snap.docs.filter((d) => {
    const v = d.data()[field];
    return typeof v === 'string' && v !== '';
  }).length, orfaos: orfaos.length };
  paraDeletar.push(...orfaos);
  console.log(
    `${collection.padEnd(14)} total=${String(porAlvo[collection].total).padStart(6)}  ` +
    `com ponteiro=${String(porAlvo[collection].comPonteiro).padStart(6)}  ` +
    `ÓRFÃOS=${String(orfaos.length).padStart(6)}`
  );
}

console.log(`\nTOTAL a apagar: ${paraDeletar.length}`);

if (!APPLY) {
  console.log('\nDRY-RUN — nada foi apagado. Repita com --yes para aplicar.');
  gravarLog({ applied: false, resumo: porAlvo, total: paraDeletar.length, docs: paraDeletar });
  process.exit(0);
}

console.log(`\napagando ${paraDeletar.length} docs…`);
const BATCH = 400;
let apagados = 0;
for (let i = 0; i < paraDeletar.length; i += BATCH) {
  const chunk = paraDeletar.slice(i, i + BATCH);
  const batch = db.batch();
  for (const d of chunk) batch.delete(db.collection(d.collection).doc(d.id));
  await batch.commit();
  apagados += chunk.length;
  console.log(`  ${apagados}/${paraDeletar.length}`);
}
console.log(`concluído — ${apagados} docs apagados`);
gravarLog({ applied: true, resumo: porAlvo, total: apagados, docs: paraDeletar });
process.exit(0);
