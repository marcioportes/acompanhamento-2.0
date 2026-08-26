/** #402 — Fase 0b: qual é o risco REAL de ordenação. Read-only. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('/home/mportes/projects/acompanhamento-2.0/functions/node_modules/firebase-admin');
admin.initializeApp({ projectId: 'acompanhamento-20' });
const db = admin.firestore();
const HAS_TZ = /(?:Z|[+-]\d{2}:?\d{2})$/;
const kind = (t) => !t.entryTime ? 'ausente' : (HAS_TZ.test(String(t.entryTime)) ? 'offset' : 'naive');

const trades = (await db.collection('trades').get()).docs.map(d => ({ id: d.id, ...d.data() }));
const porDia = {};
for (const t of trades) (porDia[`${t.studentId}|${t.date}`] = porDia[`${t.studentId}|${t.date}`] || []).push(t);
const multi = Object.entries(porDia).filter(([, g]) => g.length > 1);

let homogeneo = 0, misturado = 0, comAusente = 0, exchMisto = 0;
const exemplos = [];
for (const [k, g] of multi) {
  const kinds = new Set(g.map(kind));
  const exchs = new Set(g.map(t => `${t.exchange || '?'}/${(t.ticker || '').slice(0, 3)}`));
  if (kinds.has('ausente')) { comAusente++; continue; }
  if (kinds.size > 1) {
    misturado++;
    if (exemplos.length < 6) exemplos.push(`${k} → ${g.map(t => `${kind(t)}:${t.entryTime}`).join(' | ')}`);
  } else {
    homogeneo++;
    if (exchs.size > 1) exchMisto++;
  }
}
console.log('dias com >1 trade:', multi.length);
console.log('  homogêneos (todos offset OU todos naive):', homogeneo, '→ ordem intradiária PRESERVADA');
console.log('    desses, com exchange/ticker misto:', exchMisto, '→ fuso inferido pode divergir entre linhas');
console.log('  MISTURADOS (naive + offset no mesmo dia):', misturado, '→ risco real de ordem errada');
console.log('  com algum entryTime ausente:', comAusente);
if (exemplos.length) { console.log('\nexemplos de dia misturado:'); exemplos.forEach(e => console.log(' ', e)); }

// quantos dias misturados de fato INVERTEM se comparados como string vs instante
console.log('\n=== dias onde string-sort ≠ instante-sort ===');
let divergem = 0;
const OFF = { 'America/Sao_Paulo': -3 };
const msNaive = (iso, offH = -3) => { const [d, t] = String(iso).split('T'); return Date.parse(`${d}T${t}${offH < 0 ? '-' : '+'}${String(Math.abs(offH)).padStart(2, '0')}:00`); };
for (const [k, g] of multi) {
  if (g.some(t => kind(t) === 'ausente')) continue;
  const porString = [...g].sort((a, b) => String(a.entryTime).localeCompare(String(b.entryTime))).map(t => t.id);
  const porInstante = [...g].sort((a, b) => (kind(a) === 'offset' ? Date.parse(a.entryTime) : msNaive(a.entryTime)) - (kind(b) === 'offset' ? Date.parse(b.entryTime) : msNaive(b.entryTime))).map(t => t.id);
  if (porString.join() !== porInstante.join()) { divergem++; if (divergem <= 4) console.log(' ', k); }
}
console.log('total que divergem:', divergem);
process.exit(0);
