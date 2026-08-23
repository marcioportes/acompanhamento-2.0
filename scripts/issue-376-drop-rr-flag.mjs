/**
 * #376 — remove o red flag RR_ABAIXO_MINIMO dos trades já gravados.
 *
 * Marcio, 23/08: "sair abaixo do alvo não é violação de plano, é comportamento."
 * O código parou de emitir o flag, mas `trade.redFlags` é snapshot no doc — sem este
 * backfill os 106 trades antigos seguem acusados, e os gates de compliance e de
 * ruleViolationRate continuam travados pelo critério revogado.
 *
 * Escopo deliberadamente cirúrgico: NÃO reprocessa as outras regras (risco, sem stop,
 * loss diário). Só apaga o tipo revogado — é exatamente o que o código novo produziria
 * para esses mesmos trades, sem carregar o risco de reavaliar plano atual sobre trade
 * antigo.
 *
 * USO:  node scripts/issue-376-drop-rr-flag.mjs          # dry-run
 *       node scripts/issue-376-drop-rr-flag.mjs --yes    # aplica
 */
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const admin = require(ROOT + '/functions/node_modules/firebase-admin');
admin.initializeApp({ projectId: 'acompanhamento-20' });
const db = admin.firestore();
const APPLY = process.argv.includes('--yes');
const ALVO = 'RR_ABAIXO_MINIMO';

const names = {};
for (const d of (await db.collection('students').get()).docs) names[d.id] = d.data().name;
const trades = (await db.collection('trades').get()).docs.map((d) => ({ id: d.id, ...d.data() }));

const mudancas = [];
const porAluno = {};
for (const t of trades) {
  const flags = t.redFlags || [];
  const restantes = flags.filter((f) => (f.type || f) !== ALVO);
  if (restantes.length === flags.length) continue;
  const k = t.studentId || '—';
  porAluno[k] = (porAluno[k] || 0) + 1;
  mudancas.push({
    id: t.id, studentId: k, aluno: names[k] || k, ticker: t.ticker,
    entryTime: t.entryTime, de: flags.length, para: restantes.length,
    ficaLimpo: restantes.length === 0,
  });
  if (APPLY) await db.doc('trades/' + t.id).set({ redFlags: restantes }, { merge: true });
}

const limpos = mudancas.filter((m) => m.ficaLimpo).length;
console.log(`${trades.length} trades · ${mudancas.length} perdem o flag ${ALVO} · ${limpos} ficam SEM nenhuma violação`);
console.log('\npor aluno:');
for (const [k, n] of Object.entries(porAluno).sort((a, b) => b[1] - a[1]))
  console.log(`  ${String(names[k] || k).slice(0, 22).padEnd(24)} ${String(n).padStart(4)}`);
console.log(APPLY ? '\nAPLICADO' : '\nDRY-RUN — nada escrito. Repita com --yes.');

const LOGS = join(ROOT, 'scripts', 'logs');
if (!existsSync(LOGS)) mkdirSync(LOGS, { recursive: true });
writeFileSync(join(LOGS, 'issue-376-drop-rr-flag.json'), JSON.stringify({ applied: APPLY, mudancas }, null, 1));
process.exit(0);
