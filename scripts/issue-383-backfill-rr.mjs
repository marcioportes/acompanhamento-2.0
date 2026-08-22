/**
 * #383 — backfill do escalar rrRatio + compliance, usando a SSoT.
 * Dry-run por padrão; --yes aplica. Só toca o que diverge.
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const admin = require(ROOT+'/functions/node_modules/firebase-admin');
const { realizedRR } = require(ROOT+'/functions/shared/realizedRR');
admin.initializeApp({ projectId: 'acompanhamento-20' });
const db = admin.firestore();
const APPLY = process.argv.includes('--yes');

const num=(v)=>{ if(v===null||v===undefined||v==='') return null; const n=Number(v); return Number.isFinite(n)?n:null; };

const plans = {};
(await db.collection('plans').get()).docs.forEach(d => { plans[d.id] = d.data(); });
const trades=(await db.collection('trades').get()).docs.map(d=>({id:d.id,...d.data()}));

const mudancas=[];
for (const t of trades) {
  const plan = t.planId ? plans[t.planId] : null;
  if (!plan) continue;
  if (t.stopLoss == null) continue;          // sem stop: RR assumido, fora deste backfill
  const der = realizedRR(t);
  if (der == null) continue;
  const grav = num(t.rrRatio);
  const ganho = Number(t.result) > 0;

  // Regra: onde já existe valor, torná-lo verdadeiro; onde não existe, não inventar.
  //   ganho                    → compliance produz o realizado: grava a geometria
  //   loss com valor gravado   → corrige o valor (loss que tomou o stop cheio é -1, e -1
  //                              já estava certo em vários; os errados eram -0,2 / -0,66)
  //   loss sem valor           → não toca: criar entrada nova mudaria as médias do
  //                              dashboard, o que não é o pedido
  if (!ganho && grav == null) continue;
  const alvo = der;
  if (grav != null && Math.abs(grav - alvo) <= 0.005) continue;

  const rrTarget = num(plan.rrTarget);
  // Conformidade de RR só se avalia em ganho (DEC-006/007) — loss de 1R é o risco planejado.
  const rrStatus = (ganho && rrTarget && rrTarget > 0 && alvo < rrTarget)
    ? 'NAO_CONFORME' : 'CONFORME';
  mudancas.push({ id:t.id, ticker:t.ticker, ganho, de:grav, para:alvo, statusDe:t.compliance?.rrStatus ?? null, statusPara:rrStatus });
  if (APPLY) {
    await db.doc('trades/'+t.id).set({
      rrRatio: alvo, rrAssumed: false,
      compliance: { ...(t.compliance||{}), rrStatus },
    }, { merge: true });
  }
}
console.log(`trades: ${trades.length} · divergentes corrigidos: ${mudancas.length}`);
for (const m of mudancas) console.log(' ', m.ticker.padEnd(8), String(m.de).padStart(6), '→', String(m.para).padStart(6), '·', m.statusDe, '→', m.statusPara);
console.log(APPLY ? '\nAPLICADO' : '\nDRY-RUN — nada escrito. Repita com --yes.');
writeFileSync(join(ROOT,'scripts','logs','issue-383-backfill-rr.json'), JSON.stringify(mudancas,null,1));
process.exit(0);
