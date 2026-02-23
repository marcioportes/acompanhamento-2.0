/**
 * scripts/setup-emotional-v2-test.js
 * @version 1.1.0 (Fase 1.4.0)
 * @description Setup + massa de teste para validar Sistema Emocional v2
 *   Compatível com ESM (package.json "type": "module")
 * 
 * EXECUÇÃO:
 *   node scripts/setup-emotional-v2-test.js                  # dry-run
 *   node scripts/setup-emotional-v2-test.js --commit         # aplica
 *   node scripts/setup-emotional-v2-test.js --commit --clean # limpa antes de criar
 *   node scripts/setup-emotional-v2-test.js --clean-only     # só limpa
 * 
 * PRÉ-REQUISITO: serviceAccountKey.json na raiz do projeto
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DRY_RUN = !process.argv.includes('--commit') && !process.argv.includes('--clean-only');
const CLEAN = process.argv.includes('--clean') || process.argv.includes('--clean-only');
const CLEAN_ONLY = process.argv.includes('--clean-only');

let app;
try {
  const saPath = resolve(__dirname, 'serviceAccountKey.json');
  const sa = JSON.parse(readFileSync(saPath, 'utf8'));
  app = initializeApp({ credential: cert(sa) });
} catch (e) {
  console.error('❌ serviceAccountKey.json não encontrado na raiz do projeto.');
  console.error('   Coloque em: <raiz>\\serviceAccountKey.json');
  console.error('   Download: Firebase Console → Project Settings → Service Accounts → Generate New Private Key');
  process.exit(1);
}
const db = getFirestore(app);

const CFG = {
  studentId: 'TEST_STUDENT_EMOTIONAL_V2',
  studentEmail: 'teste.emocional@test.com',
  studentName: 'Aluno Teste Emocional',
  mentorEmail: 'marcio.portes@me.com',
  accountId: 'TEST_ACCOUNT_EMOTIONAL_V2',
  planId: 'TEST_PLAN_EMOTIONAL_V2',
};

function makeDate(daysAgo, h = 10, m = 0) {
  const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(h, m, 0, 0); return d;
}
const isoD = (d) => d.toISOString().split('T')[0];
const isoT = (d) => d.toISOString();
const ts = () => FieldValue.serverTimestamp();

async function checkMigration() {
  console.log('\n═══ VERIFICAÇÃO: Emoções v2 ═══\n');
  const snap = await db.collection('emotions').get();
  let ok = 0, missing = 0;
  snap.forEach(doc => {
    const d = doc.data();
    if (d.score !== undefined && d.analysisCategory && d.behavioralPattern) {
      ok++;
    } else {
      missing++;
      console.log(`  ❌ ${d.name} — faltam campos v2`);
    }
  });
  console.log(`  Resultado: ${ok} OK, ${missing} faltando`);
  if (missing > 0) { console.log('\n  ⚠️  Execute migrate-emotions.js --commit primeiro!'); return false; }
  console.log('  ✅ Todas emoções migradas.');
  return true;
}

async function clean() {
  console.log('\n═══ LIMPEZA ═══\n');
  const tSnap = await db.collection('trades').where('studentId', '==', CFG.studentId).get();
  if (!tSnap.empty) { const b = db.batch(); tSnap.forEach(d => b.delete(d.ref)); await b.commit(); console.log(`  🗑️  ${tSnap.size} trades removidos`); }
  else { console.log('  Nenhum trade de teste.'); }

  const nSnap = await db.collection('notifications').where('studentId', '==', CFG.studentId).get();
  if (!nSnap.empty) { const b = db.batch(); nSnap.forEach(d => b.delete(d.ref)); await b.commit(); console.log(`  🗑️  ${nSnap.size} notifications removidas`); }

  for (const [col, id] of [['students', CFG.studentId], ['accounts', CFG.accountId], ['plans', CFG.planId]]) {
    const ref = db.collection(col).doc(id);
    if ((await ref.get()).exists) { await ref.delete(); console.log(`  🗑️  ${col}/${id}`); }
  }

  const epSnap = await db.collection('students').doc(CFG.studentId).collection('emotionalProfile').get();
  if (!epSnap.empty) { const b = db.batch(); epSnap.forEach(d => b.delete(d.ref)); await b.commit(); console.log(`  🗑️  ${epSnap.size} emotionalProfile docs removidos`); }
  console.log('  ✅ Limpeza concluída.');
}

const TRADES = [
  { ticker:'WIN1', side:'LONG',  qty:1,  result: 250, emotionEntry:'Disciplinado', emotionExit:'Calmo',       setup:'Tendência', daysAgo:5, h:9,  m:30 },
  { ticker:'WIN1', side:'SHORT', qty:1,  result: 200, emotionEntry:'Calmo',        emotionExit:'Confiante',   setup:'Reversão',  daysAgo:5, h:10, m:45 },
  { ticker:'WDO1', side:'LONG',  qty:5,  result: 150, emotionEntry:'Confiante',    emotionExit:'Disciplinado',setup:'Breakout',  daysAgo:5, h:14, m:0  },
  { ticker:'WIN1', side:'LONG',  qty:1,  result:-50,  emotionEntry:'Neutro',       emotionExit:'Aliviado',    setup:'Tendência', daysAgo:4, h:9,  m:15 },
  { ticker:'WIN1', side:'SHORT', qty:1,  result: 200, emotionEntry:'Calmo',        emotionExit:'Disciplinado',setup:'Scalp',     daysAgo:4, h:11, m:30 },
  { ticker:'WIN1', side:'LONG',  qty:1,  result:-200, emotionEntry:'Ansioso',      emotionExit:'Frustrado',   setup:'Tendência', daysAgo:3, h:9,  m:45 },
  { ticker:'WIN1', side:'LONG',  qty:1,  result:-200, emotionEntry:'Frustrado',    emotionExit:'Raiva',       setup:'Tendência', daysAgo:3, h:10, m:20 },
  { ticker:'WDO1', side:'SHORT', qty:5,  result:-200, emotionEntry:'Medo',         emotionExit:'Esgotado',    setup:'Reversão',  daysAgo:3, h:14, m:30 },
  { ticker:'WIN1', side:'LONG',  qty:1,  result:-200, emotionEntry:'Frustrado',    emotionExit:'Raiva',       setup:'Scalp',     daysAgo:2, h:10, m:0  },
  { ticker:'WIN1', side:'SHORT', qty:1,  result:-100, emotionEntry:'Raiva',        emotionExit:'Frustrado',   setup:'Scalp',     daysAgo:2, h:10, m:15 },
  { ticker:'WIN1', side:'LONG',  qty:1,  result:-100, emotionEntry:'Raiva',        emotionExit:'Esgotado',    setup:'Scalp',     daysAgo:2, h:10, m:30 },
  { ticker:'WIN1', side:'LONG',  qty:1,  result:-200, emotionEntry:'Ansioso',      emotionExit:'Frustrado',   setup:'Tendência', daysAgo:1, h:9,  m:30 },
  { ticker:'WIN1', side:'SHORT', qty:3,  result:-300, emotionEntry:'Revanche',     emotionExit:'Raiva',       setup:'Scalp',     daysAgo:1, h:9,  m:40 },
  { ticker:'WDO1', side:'LONG',  qty:10, result: 200, emotionEntry:'FOMO',         emotionExit:'Eufórico',    setup:'Breakout',  daysAgo:1, h:14, m:0  },
  { ticker:'WIN1', side:'LONG',  qty:2,  result:-400, emotionEntry:'Ganância',     emotionExit:'Frustrado',   setup:'Tendência', daysAgo:0, h:10, m:0  },
];

async function createTestData() {
  console.log('\n═══ CRIANDO MASSA DE TESTE ═══\n');

  await db.collection('students').doc(CFG.studentId).set({
    uid: CFG.studentId, email: CFG.studentEmail, name: CFG.studentName,
    status: 'active', createdAt: ts(), createdBy: CFG.mentorEmail, firstLoginAt: ts()
  });
  console.log('  ✅ Student criado');

  await db.collection('accounts').doc(CFG.accountId).set({
    name: 'Conta Teste Emocional', type: 'DEMO', isReal: false, broker: 'Teste',
    currency: 'BRL', initialBalance: 10000, currentBalance: 10000,
    studentId: CFG.studentId, studentEmail: CFG.studentEmail, createdAt: ts()
  });
  console.log('  ✅ Account criada');

  await db.collection('plans').doc(CFG.planId).set({
    name: 'Plano Teste Emocional', accountId: CFG.accountId,
    studentId: CFG.studentId, studentEmail: CFG.studentEmail,
    pl: 10000, currentPl: 10000, goalPercent: 5, stopPercent: 3,
    riskPerOperation: 2, rrTarget: 2, active: true, operationPeriod: 'weekly', createdAt: ts()
  });
  console.log('  ✅ Plan criado');

  const batch = db.batch();
  let pl = 0;
  const emojiMap = { Disciplinado:'💪', Calmo:'😌', Revanche:'🔴', FOMO:'😱', Ganância:'🤑', Frustrado:'😤', Raiva:'😡', Ansioso:'😰', Medo:'😨', Confiante:'😎', Neutro:'😐' };

  TRADES.forEach((t, i) => {
    const entry = makeDate(t.daysAgo, t.h, t.m);
    const exit = new Date(entry.getTime() + 15 * 60000);
    pl += t.result;

    batch.set(db.collection('trades').doc(), {
      studentId: CFG.studentId, studentEmail: CFG.studentEmail, studentName: CFG.studentName,
      accountId: CFG.accountId, planId: CFG.planId,
      ticker: t.ticker, side: t.side, qty: t.qty,
      entry: 130000, exit: 130000 + t.result, stopLoss: 129500, takeProfit: 130500,
      result: t.result, emotionEntry: t.emotionEntry, emotionExit: t.emotionExit,
      setup: t.setup, date: isoD(entry), entryTime: isoT(entry), exitTime: isoT(exit),
      status: 'OPEN', feedbackHistory: [], redFlags: [], hasRedFlags: false,
      compliance: { roStatus: 'CONFORME', rrStatus: 'CONFORME' }, createdAt: ts()
    });

    console.log(`  ${String(i+1).padStart(2)}. D-${t.daysAgo} ${String(t.h).padStart(2,'0')}:${String(t.m).padStart(2,'0')} ${t.ticker.padEnd(5)} ${(t.result>=0?'+':'')+String(t.result).padStart(5)} ${emojiMap[t.emotionEntry]||'📊'} ${t.emotionEntry} → ${t.emotionExit}`);
  });

  await batch.commit();
  console.log(`\n  ✅ ${TRADES.length} trades criados. PL: R$ ${pl}`);

  await db.collection('accounts').doc(CFG.accountId).update({ currentBalance: 10000 + pl });
  await db.collection('plans').doc(CFG.planId).update({ currentPl: 10000 + pl });
  console.log(`  ✅ Saldo atualizado: R$ ${10000 + pl}`);
}

function printReport() {
  console.log('\n═══ COMO TESTAR ═══\n');
  console.log('1. Confirmar useMasterData patched:');
  console.log('   Select-String -Path "src\\hooks\\useMasterData.js" -Pattern "getEmotionConfig"');
  console.log('');
  console.log('2. npm run dev → MentorDashboard → "Alunos"');
  console.log('   → "Aluno Teste Emocional" com card emocional');
  console.log('');
  console.log('3. Clicar → EmotionalProfileDetail completo');
  console.log('');
  console.log('Limpar: node scripts/setup-emotional-v2-test.js --clean-only');
}

async function main() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(' Setup Emocional V2 — Massa de Teste');
  console.log(` Modo: ${DRY_RUN ? 'DRY-RUN (--commit para aplicar)' : CLEAN_ONLY ? 'CLEAN-ONLY' : 'COMMIT'}`);
  console.log(`${'═'.repeat(60)}`);

  if (DRY_RUN) {
    await checkMigration();
    console.log('\n  Trades que seriam criados:\n');
    const emojiMap = { Disciplinado:'💪', Calmo:'😌', Revanche:'🔴', FOMO:'😱', Ganância:'🤑', Frustrado:'😤', Raiva:'😡' };
    TRADES.forEach((t, i) => console.log(`  ${String(i+1).padStart(2)}. D-${t.daysAgo} ${t.ticker.padEnd(5)} ${(t.result>=0?'+':'')+String(t.result).padStart(5)} ${emojiMap[t.emotionEntry]||'📊'} ${t.emotionEntry}`));
    printReport();
    process.exit(0);
  }
  if (CLEAN_ONLY) { await clean(); process.exit(0); }

  if (!(await checkMigration())) { console.log('\n❌ Abortando.'); process.exit(1); }
  if (CLEAN) await clean();
  await createTestData();
  printReport();
  console.log('\n✅ Concluído!\n');
  process.exit(0);
}

main().catch(err => { console.error('ERRO:', err); process.exit(1); });
