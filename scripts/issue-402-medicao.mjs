/**
 * #402 — Fase 0: medição read-only antes de revogar LOSS_DIARIO_EXCEDIDO.
 * Sem esse número o delta de gates da Fase 2 não é reportável (protocolo #376).
 * NÃO ESCREVE NADA.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ROOT = '/home/mportes/projects/acompanhamento-2.0';
const admin = require(ROOT + '/functions/node_modules/firebase-admin');
admin.initializeApp({ projectId: 'acompanhamento-20' });
const db = admin.firestore();

const HAS_TZ = /(?:Z|[+-]\d{2}:?\d{2})$/;
const trades = (await db.collection('trades').get()).docs.map(d => ({ id: d.id, ...d.data() }));

// --- LOSS_DIARIO_EXCEDIDO ---
const comFlag = trades.filter(t => (t.redFlags || []).some(f => (f.type || f) === 'LOSS_DIARIO_EXCEDIDO'));
const alunos = new Set(comFlag.map(t => t.studentId));
const discussed = comFlag.filter(t => t.status === 'DISCUSSED');
// trades cujo ÚNICO flag efetivo é o revogando (viram compliant ao revogar)
const REVOKED = new Set(['RR_ABAIXO_MINIMO']);
const soEsse = comFlag.filter(t => {
  const cleared = new Set(t.mentorClearedViolations || []);
  const vivos = (t.redFlags || []).filter(f => {
    const ty = f.type || f;
    return !REVOKED.has(ty) && !cleared.has(ty);
  }).map(f => f.type || f);
  return vivos.length > 0 && vivos.every(ty => ty === 'LOSS_DIARIO_EXCEDIDO');
});

console.log('=== LOSS_DIARIO_EXCEDIDO ===');
console.log('trades na base:            ', trades.length);
console.log('com o flag:               ', comFlag.length);
console.log('  alunos distintos:       ', alunos.size);
console.log('  status DISCUSSED:       ', discussed.length, '(imutáveis — só leitura resolve)');
console.log('  cujo ÚNICO flag é esse: ', soEsse.length, '→ viram compliant ao revogar');

// --- impacto por aluno no complianceRate ---
console.log('\n=== impacto no complianceRate, por aluno ===');
const porAluno = {};
for (const t of trades) {
  const k = t.studentId || '(sem aluno)';
  porAluno[k] = porAluno[k] || { nome: t.studentName || k, total: 0, comFlagQualquer: 0, soLossDiario: 0 };
  const p = porAluno[k];
  p.total++;
  const cleared = new Set(t.mentorClearedViolations || []);
  const vivos = (t.redFlags || []).filter(f => {
    const ty = f.type || f;
    return !REVOKED.has(ty) && !cleared.has(ty);
  }).map(f => f.type || f);
  if (vivos.length > 0) p.comFlagQualquer++;
  if (vivos.length > 0 && vivos.every(ty => ty === 'LOSS_DIARIO_EXCEDIDO')) p.soLossDiario++;
}
const pct = (n, d) => d > 0 ? ((n / d) * 100) : null;
for (const [, p] of Object.entries(porAluno).sort((a, b) => b[1].total - a[1].total)) {
  if (p.total === 0) continue;
  const antes = pct(p.total - p.comFlagQualquer, p.total);
  const depois = pct(p.total - (p.comFlagQualquer - p.soLossDiario), p.total);
  const delta = depois - antes;
  const marca = delta > 0 ? `  <<< +${delta.toFixed(1)}pp` : '';
  console.log(`${String(p.nome).padEnd(24)} ${String(p.total).padStart(4)} trades | complianceRate ${antes.toFixed(1)}% -> ${depois.toFixed(1)}%${marca}`);
}

// --- entryTime naive (extensão do D8) ---
console.log('\n=== entryTime ===');
let comOffset = 0, naive = 0, ausente = 0;
const naivePorAluno = {};
for (const t of trades) {
  if (!t.entryTime || typeof t.entryTime !== 'string') { ausente++; continue; }
  if (HAS_TZ.test(t.entryTime)) comOffset++;
  else {
    naive++;
    const k = t.studentName || t.studentId;
    naivePorAluno[k] = (naivePorAluno[k] || 0) + 1;
  }
}
console.log('com offset explícito:', comOffset);
console.log('naive (sem fuso):    ', naive, naive ? '→ ordem intradiária inferida' : '');
console.log('ausente:             ', ausente);
if (naive) console.log('  por aluno:', JSON.stringify(naivePorAluno));

// --- dias com mais de um trade e ordem não confiável ---
const porDia = {};
for (const t of trades) {
  const k = `${t.studentId}|${t.date}`;
  (porDia[k] = porDia[k] || []).push(t);
}
const multi = Object.values(porDia).filter(g => g.length > 1);
const arriscados = multi.filter(g => g.some(t => !t.entryTime || !HAS_TZ.test(String(t.entryTime))));
console.log('\ndias com >1 trade:', multi.length, '| desses, com algum entryTime não confiável:', arriscados.length);
process.exit(0);
