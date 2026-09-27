#!/usr/bin/env node
/**
 * issue-477-recompute-comportamento.mjs — recalcula o `behaviorProfile` dos trades já
 * gravados com as regras do #477 (hesitação = só tentativa de entrada; montagem de posição
 * = aviso neutro; confronto emocional como hipótese).
 *
 * DRY-RUN POR PADRÃO: lê, calcula e imprime antes → depois. Só grava com --apply.
 * Escreve apenas `behaviorProfile` (campo existente, INV-15), pelo helper de imutabilidade:
 * trade discutido é intocado (INV-30). A escrita não reabre `onTradeUpdated`.
 *
 * PRÉ-REQUISITO: as Cloud Functions do #477 publicadas ANTES do --apply — senão o próximo
 * gatilho do aluno recalcularia com o motor antigo e desfaria a correção.
 *
 * USO:
 *   node scripts/issue-477-recompute-comportamento.mjs                     # dry-run, candidatos
 *   node scripts/issue-477-recompute-comportamento.mjs --student <uid>     # um aluno
 *   node scripts/issue-477-recompute-comportamento.mjs --trade <tradeId>   # um trade
 *   node scripts/issue-477-recompute-comportamento.mjs --all               # todo trade que mudou
 *   node scripts/issue-477-recompute-comportamento.mjs --apply             # grava
 *
 * PRÉ-REQUISITO: gcloud auth application-default login
 */
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runRecompute477, formatarRelatorio477 } from './lib/recomputeBehavior477.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function parseArgs(argv) {
  const opts = { apply: false, student: null, trade: null, all: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const valor = () => {
      const v = argv[++i];
      if (!v || v.startsWith('--')) throw new Error(`${a} exige um valor`);
      return v;
    };
    if (a === '--apply') opts.apply = true;
    else if (a === '--all') opts.all = true;
    else if (a === '--student') opts.student = valor();
    else if (a === '--trade') opts.trade = valor();
    else throw new Error(`argumento desconhecido: ${a}`);
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const require = createRequire(import.meta.url);
  const admin = require(join(ROOT, 'functions', 'node_modules', 'firebase-admin'));
  const { buildBehaviorProfiles } = require(join(ROOT, 'functions', 'behavior', 'buildBehaviorProfile.js'));
  const { buildGetEmotionConfig } = require(join(ROOT, 'functions', 'maturity', 'emotionalAnalysisMirror.js'));
  const { isTradeImmutable, updateTradeIfMutable } = require(join(ROOT, 'functions', '_shared', 'tradeImmutability.js'));
  admin.initializeApp({ projectId: 'acompanhamento-20' });
  const db = admin.firestore();
  const escopo = opts.trade ? `trade ${opts.trade}` : opts.student ? `aluno ${opts.student}` : (opts.all ? 'todos' : 'candidatos');
  console.log(`${opts.apply ? 'APLICANDO' : 'DRY-RUN'} — escopo: ${escopo}`);
  const r = await runRecompute477(db, opts, {
    buildBehaviorProfiles,
    buildGetEmotionConfig,
    isTradeImmutable,
    updateTradeIfMutable,
    serverTimestamp: () => admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log(formatarRelatorio477(r, opts));
  process.exit(0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
