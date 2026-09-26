#!/usr/bin/env node
/**
 * issue-468-recalc-import-trades.mjs — recalcula os trades JÁ GRAVADOS pelo import de
 * ordens com as regras corrigidas do épico #462 (Fase 5).
 *
 * DRY-RUN POR PADRÃO: lê, compara e imprime. Só grava com --apply, e só o que o Marcio
 * revisou no dry-run. A regra mora em `scripts/lib/recalcImportTrades.mjs` (testada);
 * a reconstrução é a MESMA do import (`src/utils/orderReconstruction` et al.).
 *
 * USO:
 *   node scripts/issue-468-recalc-import-trades.mjs                         # dry-run, todos
 *   node scripts/issue-468-recalc-import-trades.mjs --student <uid>         # um aluno
 *   node scripts/issue-468-recalc-import-trades.mjs --trade <tradeId>       # um trade
 *   node scripts/issue-468-recalc-import-trades.mjs --since 2026-09-01      # a partir da data
 *   node scripts/issue-468-recalc-import-trades.mjs --out /caminho/rel.json # JSON do relatório
 *   node scripts/issue-468-recalc-import-trades.mjs --apply                 # grava os "recalculado"
 *   node scripts/issue-468-recalc-import-trades.mjs --apply --include-ambiguous
 *
 * PRÉ-REQUISITO: gcloud auth application-default login
 * LOG padrão: scripts/logs/issue-468-recalc-<ISO8601>.json
 *
 * EFEITOS DO --apply: update em `trades` (só campos existentes) → `onTradeUpdated`
 * recalcula compliance/riskPercent/rrRatio/redFlags, maturidade e prop firm; depois o
 * script refaz `behaviorProfile` dos alunos afetados (mesma função da CF).
 */

import { register, createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// `src/utils` é escrito para o Vite: imports relativos sem extensão ('./orderInstant').
// O Node puro não resolve isso — este hook tenta de novo com '.js'. Só para relativos.
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  try { return await next(specifier, context); }
  catch (e) {
    if (e && e.code === 'ERR_MODULE_NOT_FOUND' && /^\\.{1,2}\\//.test(specifier) && !/\\.[cm]?js$/.test(specifier)) {
      return next(specifier + '.js', context);
    }
    throw e;
  }
}`));

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const AJUDA = `Uso: node scripts/issue-468-recalc-import-trades.mjs [--student <uid>] [--trade <id>]
  [--since YYYY-MM-DD] [--out <arquivo.json>] [--apply] [--include-ambiguous]
Sem --apply é dry-run: nada é escrito.`;

export function parseArgs(argv) {
  const opts = { apply: false, includeAmbiguous: false, student: null, trade: null, since: null, out: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const valor = () => {
      const v = argv[++i];
      if (!v || v.startsWith('--')) throw new Error(`${a} exige um valor`);
      return v;
    };
    if (a === '--apply') opts.apply = true;
    else if (a === '--include-ambiguous') opts.includeAmbiguous = true;
    else if (a === '--student') opts.student = valor();
    else if (a === '--trade') opts.trade = valor();
    else if (a === '--since') opts.since = valor();
    else if (a === '--out') opts.out = valor();
    else if (a === '--help' || a === '-h') opts.help = true;
    else throw new Error(`argumento desconhecido: ${a}`);
  }
  if (opts.since && !/^\d{4}-\d{2}-\d{2}$/.test(opts.since)) throw new Error('--since exige YYYY-MM-DD');
  if (opts.includeAmbiguous && !opts.apply) throw new Error('--include-ambiguous só faz sentido com --apply');
  return opts;
}

async function main() {
  let opts;
  try { opts = parseArgs(process.argv.slice(2)); }
  catch (e) { console.error(e.message); console.error(AJUDA); process.exit(2); }
  if (opts.help) { console.log(AJUDA); process.exit(0); }

  // Carrega a regra DEPOIS do hook de resolução.
  const core = await import('./lib/recalcImportTrades.mjs');
  if (process.env.RECALC_468_SMOKE === '1') {
    // Verificação de carga (sem Firestore): o grafo de imports resolve no Node puro.
    console.log('módulos carregados:', Object.keys(core).length);
    process.exit(0);
  }

  const require = createRequire(import.meta.url);
  const admin = require(join(ROOT, 'functions', 'node_modules', 'firebase-admin'));
  const { recomputeBehaviorForStudent } = require(join(ROOT, 'functions', 'behavior', 'recomputeBehaviorProfiles.js'));
  admin.initializeApp({ projectId: 'acompanhamento-20' });
  const db = admin.firestore();

  console.log(`${opts.apply ? 'APLICANDO' : 'DRY-RUN'} — escopo: ${opts.trade ? `trade ${opts.trade}` : opts.student ? `aluno ${opts.student}` : 'todos'}${opts.since ? `, desde ${opts.since}` : ''}`);

  const r = await core.runRecalc(db, opts, {
    admin,
    recomputeBehaviorForStudent,
    // `onTradeUpdated` recalcula compliance de forma assíncrona; o behaviorProfile vem depois.
    aguardar: () => new Promise(ok => setTimeout(ok, 15000)),
    log: (m) => console.log(m),
  });

  console.log(core.formatarRelatorio(r, opts));

  const destino = opts.out
    ? resolve(opts.out)
    : join(ROOT, 'scripts', 'logs', `issue-468-recalc-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, JSON.stringify({
    geradoEm: new Date().toISOString(),
    modo: opts.apply ? 'apply' : 'dry-run',
    opcoes: opts,
    regras: core.REGRAS,
    resumo: r.resumo,
    escritos: r.escritos,
    preservadosNaEscrita: r.preservadosNaEscrita,
    trades: r.linhas,
  }, null, 1));
  console.log(`relatório: ${destino}`);
  process.exit(0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
