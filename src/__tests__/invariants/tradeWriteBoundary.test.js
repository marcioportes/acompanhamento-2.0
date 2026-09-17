/**
 * tradeWriteBoundary.test.js — cerca de escrita em `trades`, cliente e servidor.
 *
 * Cliente — Invariante INV-02 auditável (issue #156).
 * Escaneia `src/` em busca de escrita direta na collection `trades` via
 * primitivas Firestore (addDoc/updateDoc/setDoc/deleteDoc/doc-ref) e falha
 * se encontrar em arquivo fora da whitelist.
 *
 * Whitelist:
 *  - APPROVED: `src/utils/tradeGateway.js` — único gateway oficial (INV-02).
 *  - GRANDFATHERED: writers legados aprovados antes da issue #156. Representam
 *    dívida técnica conhecida — novos writers NÃO podem ser adicionados aqui
 *    sem gate de aprovação. A lista existe apenas para preservar baseline
 *    verde enquanto a migração para gateway é planejada.
 *
 * Objetivo: impedir reintroduzir bypass tipo shadow writer do OrderImportPage
 * (removido na Fase A). Qualquer arquivo novo tocando `trades` direto
 * fará este teste falhar.
 *
 * Servidor — trade DISCUSSED é imutável (issue #451).
 * No cliente quem barra a escrita no trade discutido são as firestore.rules; o admin SDK
 * das Cloud Functions passa por cima delas. Por isso toda escrita de update/set em trade
 * dentro de `functions/` passa por `functions/_shared/tradeImmutability.js`, e esta cerca
 * varre `functions/**` atrás de `.update(`/`.set(` crus em ref de trade fora da whitelist.
 * Remover a guarda de um writer já roteado reprova a suíte (testes de mutação abaixo).
 * Exclusão (`.delete(`) não é cercada — cascata de delete é legítima.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, '../..');

const APPROVED = ['utils/tradeGateway.js'];
const GRANDFATHERED = [
  'hooks/useTrades.js',
  'hooks/useAccounts.js',
  'hooks/usePlans.js',
  'utils/seedTestExtract.js',
];
const WHITELIST = new Set([...APPROVED, ...GRANDFATHERED]);

const WRITE_PATTERNS = [
  /addDoc\s*\(\s*collection\s*\(\s*db\s*,\s*['"]trades['"]/,
  /\bdoc\s*\(\s*db\s*,\s*['"]trades['"]/,
];

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      out.push(...walk(full));
    } else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function findTradeWriters() {
  const writers = [];
  for (const file of walk(SRC_DIR)) {
    const content = fs.readFileSync(file, 'utf8');
    if (WRITE_PATTERNS.some((p) => p.test(content))) {
      const rel = path.relative(SRC_DIR, file).replace(/\\/g, '/');
      writers.push(rel);
    }
  }
  return writers;
}

describe('INV-02 — Trade Write Boundary (issue #156)', () => {
  it('nenhum arquivo fora da whitelist escreve direto em trades', () => {
    const writers = findTradeWriters();
    const violators = writers.filter((w) => !WHITELIST.has(w));
    expect(violators).toEqual([]);
  });

  it('tradeGateway.js aparece como writer aprovado (sanity)', () => {
    const writers = findTradeWriters();
    expect(writers).toContain('utils/tradeGateway.js');
  });

  it('detecta padrão addDoc(collection(db, "trades"), ...) em fixture', () => {
    const fixture = `await addDoc(collection(db, 'trades'), { foo: 'bar' });`;
    expect(WRITE_PATTERNS.some((p) => p.test(fixture))).toBe(true);
  });

  it('detecta padrão doc(db, "trades", id) em fixture', () => {
    const fixture = `const ref = doc(db, 'trades', tradeId); await updateDoc(ref, {});`;
    expect(WRITE_PATTERNS.some((p) => p.test(fixture))).toBe(true);
  });

  it('não detecta leitura em collection(db, "trades") com query', () => {
    const fixture = `const q = query(collection(db, 'trades'), where('planId', '==', id));`;
    expect(WRITE_PATTERNS.some((p) => p.test(fixture))).toBe(false);
  });

  it('não detecta escrita em OUTRAS collections (orders, plans, etc)', () => {
    const fixtures = [
      `await addDoc(collection(db, 'orders'), {});`,
      `await updateDoc(doc(db, 'plans', id), {});`,
      `await setDoc(doc(db, 'movements', id), {});`,
    ];
    for (const f of fixtures) {
      expect(WRITE_PATTERNS.some((p) => p.test(f))).toBe(false);
    }
  });
});

// ─── Servidor (functions/**) — issue #451 ───────────────────────────────────

const SERVER_DIR = path.resolve(__dirname, '../../../functions');

// Único lugar que escreve update em trade sem checar status na linha: ele É a checagem.
const SERVER_APPROVED = ['_shared/tradeImmutability.js'];
// Transição PARA DISCUSSED (D2): o trade ainda não é discutido quando a revisão publica.
const SERVER_TRANSITION = ['reviews/publishReview.js'];
// Cascatas de exclusão (D3): só `.delete`, que a cerca não pega — listadas para documentar
// que o trade é tocado ali de propósito.
const SERVER_CASCADE_DELETE = [
  'accounts/deleteAccountCascade.js',
  'accounts/deletePlanCascade.js',
  'students/deleteStudentData.js',
  'trades/cascadeDeleteTradeRefs.js',
];
// Scripts avulsos / migrações (classe D/E do inventário da task 03). Mesma regra do
// GRANDFATHERED do cliente: dívida conhecida — novos NÃO entram aqui sem gate de aprovação.
const SERVER_GRANDFATHERED = [
  'setup-emotional-v2-test.js', // script de setup de massa: cria trades novos (batch.set)
  'migrate-trade-status.js', // migração one-shot de status legado
  'reviews/migrateReviewStateBackfill.js', // callable de migração dryRun/apply
];
const SERVER_WHITELIST = new Set([
  ...SERVER_APPROVED,
  ...SERVER_TRANSITION,
  ...SERVER_CASCADE_DELETE,
  ...SERVER_GRANDFATHERED,
]);

// Arquivo de contexto de trade — aí os nomes de ref abaixo são ref de trade: lê `trades`, é
// trigger de trade, importa o helper (writer roteado que recebe docs por injeção) ou mora em
// `functions/trades/`.
const TRADE_CONTEXT = /collection\(\s*['"]trades['"]\s*\)|document\(\s*['"]trades\/|_shared\/tradeImmutability/;
const isTradeContext = (content, rel = '') => rel.startsWith('trades/') || TRADE_CONTEXT.test(content);
const TRADE_REF_NAMES = [
  'tradeRef', 'tradeDoc.ref', 'tradeSnap.ref', 'snap.ref',
  'change.after.ref', 'change.before.ref', 'doc.ref', 'd.ref',
];
const WRITERS = '(?:batch|tx|t|transaction)';
const INLINE_TRADE_DOC = /collection\(\s*['"]trades['"]\s*\)\s*\.doc\([^)]*\)\s*\.(?:update|set)\s*\(/g;
const WRITER_INLINE_TRADE = new RegExp(`\\b${WRITERS}\\s*\\.(?:update|set)\\s*\\(\\s*(?:\\w+\\.)?collection\\(\\s*['"]trades['"]`, 'g');
// `const ref = db.collection('trades').doc(id)` → `ref` vira nome de ref de trade no arquivo.
const TRADE_REF_ALIAS = /(?:const|let|var)\s+(\w+)\s*=\s*(?:\w+\.)?collection\(\s*['"]trades['"]\s*\)\s*\.doc\(/g;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Escritas cruas (update/set) em trade no conteúdo; `.delete` e chamadas ao helper não contam. */
function detectServerTradeWrites(content, rel) {
  const patterns = [INLINE_TRADE_DOC, WRITER_INLINE_TRADE];
  if (isTradeContext(content, rel)) {
    const aliases = [...content.matchAll(TRADE_REF_ALIAS)].map((m) => m[1]);
    const refs = [...new Set([...TRADE_REF_NAMES, ...aliases])].map(escapeRe).join('|');
    patterns.push(new RegExp(`(?<![\\w.])(?:${refs})\\s*\\.(?:update|set)\\s*\\(`, 'g'));
    patterns.push(new RegExp(`\\b${WRITERS}\\s*\\.(?:update|set)\\s*\\(\\s*(?:${refs})\\b`, 'g'));
  }
  const hits = [];
  for (const p of patterns) {
    for (const m of content.matchAll(p)) {
      hits.push({ line: content.slice(0, m.index).split('\n').length, match: m[0] });
    }
  }
  return hits;
}

const isServerViolator = (rel, content) =>
  detectServerTradeWrites(content, rel).length > 0 && !SERVER_WHITELIST.has(rel);

function findServerTradeWriters() {
  const writers = {};
  for (const file of walk(SERVER_DIR)) {
    if (!file.endsWith('.js')) continue;
    const rel = path.relative(SERVER_DIR, file).replace(/\\/g, '/');
    const hits = detectServerTradeWrites(fs.readFileSync(file, 'utf8'), rel);
    if (hits.length > 0) writers[rel] = hits;
  }
  return writers;
}

const readServer = (rel) => fs.readFileSync(path.join(SERVER_DIR, rel), 'utf8');

describe('#451 — Trade Write Boundary no servidor (functions/**)', () => {
  it('nenhum arquivo fora da whitelist escreve update/set cru em trades', () => {
    const writers = findServerTradeWriters();
    const violators = Object.entries(writers)
      .filter(([rel]) => !SERVER_WHITELIST.has(rel))
      .map(([rel, hits]) => `${rel}:${hits.map((h) => h.line).join(',')}`);
    expect(violators).toEqual([]);
  });

  it('detector enxerga as escritas cruas conhecidas da whitelist (sanity)', () => {
    const writers = findServerTradeWriters();
    expect(Object.keys(writers)).toEqual(
      expect.arrayContaining(['reviews/publishReview.js', 'migrate-trade-status.js', 'setup-emotional-v2-test.js']),
    );
  });

  it('toda entrada da whitelist existe em disco', () => {
    for (const rel of SERVER_WHITELIST) {
      expect(fs.existsSync(path.join(SERVER_DIR, rel)), rel).toBe(true);
    }
  });

  describe('fixtures positivas', () => {
    const cases = [
      `await db.collection('trades').doc(id).update({})`,
      `const tradeRef = db.collection('trades').doc(id);\nawait tradeRef.update({ x: 1 })`,
      `exports.f = functions.firestore.document('trades/{tradeId}').onUpdate(async (change) => {\n  await change.after.ref.update({});\n});`,
      `batch.update(db.collection('trades').doc(id), {})`,
      `const snap = await db.collection('trades').doc(id).get();\ntx.update(tradeRef, {})`,
      `const ref = db.collection('trades').doc(id);\nbatch.update(ref, {})`,
      `await db.collection('trades')\n  .doc(id)\n  .set({}, { merge: true })`,
    ];
    for (const fixture of cases) {
      it(`detecta: ${fixture.replace(/\s+/g, ' ')}`, () => {
        expect(detectServerTradeWrites(fixture).length).toBeGreaterThan(0);
      });
    }
  });

  describe('fixtures negativas', () => {
    const ctx = `const q = db.collection('trades');\n`;
    const cases = [
      `${ctx}await updateIfMutable(change.after.ref, change.after, {}, 'onTradeUpdated')`,
      `${ctx}guardedUpdate(batch, snap, tradeRef, {})`,
      `await db.collection('students').doc(id).update({})`,
      `${ctx}batch.update(docSnap.ref, { accessStatus: 'x' })`,
      `${ctx}batch.delete(tradeRef); batch.delete(db.collection('trades').doc(id)); await doc.ref.delete()`,
      `const snap = await db.collection('trades').where('planId', '==', id).get()`,
      `await doc.ref.update({})`, // arquivo sem contexto de trades (ex.: orders)
    ];
    for (const fixture of cases) {
      it(`não detecta: ${fixture.replace(/\s+/g, ' ')}`, () => {
        expect(detectServerTradeWrites(fixture)).toEqual([]);
      });
    }
  });

  describe('mutação real — remover a guarda de um writer roteado reprova', () => {
    const mutations = [
      {
        rel: 'trades/recalculateTradesCompliance.js',
        from: `updateIfMutable(doc.ref, doc, updateData, 'recalculateCompliance')`,
        to: 'doc.ref.update(updateData)',
      },
      {
        rel: 'index.js', // bloco de compliance do onTradeUpdated
        from: 'const complianceWrite = await updateIfMutable(change.after.ref, change.after, {',
        to: 'const complianceWrite = await change.after.ref.update({',
      },
      {
        rel: 'behavior/recomputeBehaviorProfiles.js',
        from: 'guardedUpdate(batch, tradeById.get(tradeId), ref, {',
        to: 'batch.update(ref, {',
      },
      {
        rel: 'marketData/enrichTradeWithExcursions.js',
        from: `updateIfMutable(tradeRef, snap, patch, 'runEnrichment')`,
        to: 'tradeRef.update(patch)',
      },
    ];
    for (const { rel, from, to } of mutations) {
      it(rel, () => {
        const original = readServer(rel);
        expect(original).toContain(from);
        expect(isServerViolator(rel, original)).toBe(false);
        const mutated = original.replace(from, to); // só em memória
        expect(isServerViolator(rel, mutated)).toBe(true);
      });
    }

    it('trades/recalculateTradesCompliance.js sem guarda E sem import do helper', () => {
      const rel = 'trades/recalculateTradesCompliance.js';
      const mutated = readServer(rel)
        .replace(/^const \{[^}]*\} = require\('\.\.\/_shared\/tradeImmutability'\);$/m, '')
        .replace(`updateIfMutable(doc.ref, doc, updateData, 'recalculateCompliance')`, 'doc.ref.update(updateData)');
      expect(mutated).not.toContain('tradeImmutability');
      expect(isServerViolator(rel, mutated)).toBe(true);
    });
  });
});
