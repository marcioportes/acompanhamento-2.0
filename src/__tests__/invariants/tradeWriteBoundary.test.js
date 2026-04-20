/**
 * tradeWriteBoundary.test.js — Invariante INV-02 auditável (issue #156).
 *
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
