#!/usr/bin/env node
/**
 * issue-475-stop-pendencia.mjs — troca `TRADE_SEM_STOP` por `STOP_INICIAL_A_INFORMAR` nos
 * trades já gravados que as ordens mostram protegidos (#475).
 *
 * DRY-RUN POR PADRÃO: lê, avalia e imprime. Só grava com --apply. Escreve apenas
 * `redFlags`/`hasRedFlags` (campos existentes, INV-15), pelo helper de imutabilidade:
 * trade discutido é intocado (INV-30). A escrita não reabre `onTradeUpdated`.
 *
 * USO:
 *   node scripts/issue-475-stop-pendencia.mjs                     # dry-run, todos
 *   node scripts/issue-475-stop-pendencia.mjs --student <uid>     # um aluno
 *   node scripts/issue-475-stop-pendencia.mjs --trade <tradeId>   # um trade
 *   node scripts/issue-475-stop-pendencia.mjs --apply             # grava
 *
 * PRÉ-REQUISITO: gcloud auth application-default login
 */
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runStopFlagRefresh, formatarRelatorio } from './lib/stopPendencia475.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function parseArgs(argv) {
  const opts = { apply: false, student: null, trade: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const valor = () => {
      const v = argv[++i];
      if (!v || v.startsWith('--')) throw new Error(`${a} exige um valor`);
      return v;
    };
    if (a === '--apply') opts.apply = true;
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
  const { refreshStopFlag } = require(join(ROOT, 'functions', 'trades', 'refreshStopFlag.js'));
  const { isStopFlag } = require(join(ROOT, 'functions', 'shared', 'stopFlag.js'));
  admin.initializeApp({ projectId: 'acompanhamento-20' });
  const db = admin.firestore();
  console.log(`${opts.apply ? 'APLICANDO' : 'DRY-RUN'} — escopo: ${opts.trade ? `trade ${opts.trade}` : opts.student ? `aluno ${opts.student}` : 'todos'}`);
  const r = await runStopFlagRefresh(db, opts, { refreshStopFlag, isStopFlag });
  console.log(formatarRelatorio(r, opts));
  process.exit(0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
