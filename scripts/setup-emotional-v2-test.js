/**
 * scripts/setup-emotional-v2-test.js
 * @version 1.0.0 (Fase 1.4.0)
 * @description Setup + massa de teste para validar Sistema Emocional v2
 * 
 * O QUE FAZ:
 *   1. Verifica se emoções no Firestore têm campos v2
 *   2. Cria student/account/plan/trades de teste
 *   3. Trades cobrem: dia bom, deterioração, TILT, REVENGE, FOMO, Ganância
 * 
 * EXECUÇÃO:
 *   node scripts/setup-emotional-v2-test.js                  # dry-run
 *   node scripts/setup-emotional-v2-test.js --commit         # aplica
 *   node scripts/setup-emotional-v2-test.js --commit --clean # limpa antes de criar
 *   node scripts/setup-emotional-v2-test.js --clean-only     # só limpa
 * 
 * PRÉ-REQUISITO: serviceAccountKey.json na raiz
 */

const admin = require('firebase-admin');

const DRY_RUN = !process.argv.includes('--commit') && !process.argv.includes('--clean-only');
const CLEAN = process.argv.includes('--clean') || process.argv.includes('--clean-only');
const CLEAN_ONLY = process.argv.includes('--clean-only');

if (!admin.apps.length) {
  try {
    const sa = require('../serviceAccountKey.json');
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  } catch { admin.initializeApp(); }
}
const db = admin.firestore();

// ── Config ────────────────────────────────────────────────────────
const CFG = {
  studentId: 'TEST_STUDENT_EMOTIONAL_V2',
  studentEmail: 'teste.emocional@test.com',
  studentName: 'Aluno Teste Emocional',
  mentorEmail: 'marcio.portes@me.com',
  accountId: 'TEST_ACCOUNT_EMOTIONAL_V2',
  planId: 'TEST_PLAN_EMOTIONAL_V2',
};

// ── Helpers ───────────────────────────────────────────────────────
function makeDate(daysAgo, h = 10, m = 0) {
  const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(h, m, 0, 0); return d;
}
const isoD = (d) => d.toISOString().split('T')[0];
const isoT = (d) => d.toISOString();

// ══════════════════════════════════════════════════════════════════
// VERIFICAR MIGRAÇÃO
// ══════════════════════════════════════════════════════════════════
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
      console.log(`  ❌ ${d.name} — faltam campos v2 (score/analysisCategory/behavioralPattern)`);
    }
  });
  console.log(`  Resultado: ${ok} OK, ${missing} faltando`);
  if (missing > 0) {
    console.log('\n  ⚠️  Execute migrate-emotions.js --commit primeiro!');
    return false;
  }
  console.log('  ✅ Todas emoções migradas.');
  return true;
}

// ══════════════════════════════════════════════════════════════════
// LIMPAR
// ══════════════════════════════════════════════════════════════════
async function clean() {
  console.log('\n═══ LIMPEZA ═══\n');
  
  // Trades
  const tSnap = await db.collection('trades').where('studentId', '==', CFG.studentId).get();
  if (!tSnap.empty) {
    const b = db.batch();
    tSnap.forEach(d => b.delete(d.ref));
    await b.commit();
    console.log(`  🗑️  ${tSnap.size} trades removidos`);
  } else { console.log('  Nenhum trade de teste.'); }

  // Notifications
  const nSnap = await db.collection('notifications').where('studentId', '==', CFG.studentId).get();
  if (!nSnap.empty) {
    const b = db.batch();
    nSnap.forEach(d => b.delete(d.ref));
    await b.commit();
    console.log(`  🗑️  ${nSnap.size} notifications removidas`);
  }

  // Docs fixos
  for (const [col, id] of [['students', CFG.studentId], ['accounts', CFG.accountId], ['plans', CFG.planId]]) {
    const ref = db.collection(col).doc(id);
    if ((await ref.get()).exists) { await ref.delete(); console.log(`  🗑️  ${col}/${id}`); }
  }
  
  // emotionalProfile subcollection
  const epSnap = await db.collection('students').doc(CFG.studentId).collection('emotionalProfile').get();
  if (!epSnap.empty) {
    const b = db.batch();
    epSnap.forEach(d => b.delete(d.ref));
    await b.commit();
    console.log(`  🗑️  ${epSnap.size} emotionalProfile docs removidos`);
  }

  console.log('  ✅ Limpeza concluída.');
}

// ══════════════════════════════════════════════════════════════════
// CRIAR MASSA DE TESTE
// ══════════════════════════════════════════════════════════════════

const TRADES = [
  // DIA -5: Bom (score alto)
  { ticker:'WIN1', side:'LONG',  qty:1,  result: 250, emotionEntry:'Disciplinado', emotionExit:'Calmo',       setup:'Tendência', daysAgo:5, h:9,  m:30 },
  { ticker:'WIN1', side:'SHORT', qty:1,  result: 200, emotionEntry:'Calmo',        emotionExit:'Confiante',   setup:'Reversão',  daysAgo:5, h:10, m:45 },
  { ticker:'WDO1', side:'LONG',  qty:5,  result: 150, emotionEntry:'Confiante',    emotionExit:'Disciplinado',setup:'Breakout',  daysAgo:5, h:14, m:0  },
  // DIA -4: Mix
  { ticker:'WIN1', side:'LONG',  qty:1,  result:-50,  emotionEntry:'Neutro',       emotionExit:'Aliviado',    setup:'Tendência', daysAgo:4, h:9,  m:15 },
  { ticker:'WIN1', side:'SHORT', qty:1,  result: 200, emotionEntry:'Calmo',        emotionExit:'Disciplinado',setup:'Scalp',     daysAgo:4, h:11, m:30 },
  // DIA -3: Deterioração
  { ticker:'WIN1', side:'LONG',  qty:1,  result:-200, emotionEntry:'Ansioso',      emotionExit:'Frustrado',   setup:'Tendência', daysAgo:3, h:9,  m:45 },
  { ticker:'WIN1', side:'LONG',  qty:1,  result:-200, emotionEntry:'Frustrado',    emotionExit:'Raiva',       setup:'Tendência', daysAgo:3, h:10, m:20 },
  { ticker:'WDO1', side:'SHORT', qty:5,  result:-200, emotionEntry:'Medo',         emotionExit:'Esgotado',    setup:'Reversão',  daysAgo:3, h:14, m:30 },
  // DIA -2: TILT (3 trades negativos consecutivos <60min, emoção NEGATIVE)
  { ticker:'WIN1', side:'LONG',  qty:1,  result:-200, emotionEntry:'Frustrado',    emotionExit:'Raiva',       setup:'Scalp',     daysAgo:2, h:10, m:0  },
  { ticker:'WIN1', side:'SHORT', qty:1,  result:-100, emotionEntry:'Raiva',        emotionExit:'Frustrado',   setup:'Scalp',     daysAgo:2, h:10, m:15 },
  { ticker:'WIN1', side:'LONG',  qty:1,  result:-100, emotionEntry:'Raiva',        emotionExit:'Esgotado',    setup:'Scalp',     daysAgo:2, h:10, m:30 },
  // DIA -1: REVENGE (qty 3x, 10min após loss) + FOMO
  { ticker:'WIN1', side:'LONG',  qty:1,  result:-200, emotionEntry:'Ansioso',      emotionExit:'Frustrado',   setup:'Tendência', daysAgo:1, h:9,  m:30 },
  { ticker:'WIN1', side:'SHORT', qty:3,  result:-300, emotionEntry:'Revanche',     emotionExit:'Raiva',       setup:'Scalp',     daysAgo:1, h:9,  m:40 },
  { ticker:'WDO1', side:'LONG',  qty:10, result: 200, emotionEntry:'FOMO',         emotionExit:'Eufórico',    setup:'Breakout',  daysAgo:1, h:14, m:0  },
  // DIA 0: Ganância (CRITICAL — deve disparar alerta na CF)
  { ticker:'WIN1', side:'LONG',  qty:2,  result:-400, emotionEntry:'Ganância',     emotionExit:'Frustrado',   setup:'Tendência', daysAgo:0, h:10, m:0  },
];

async function createTestData() {
  console.log('\n═══ CRIANDO MASSA DE TESTE ═══\n');

  // Student
  await db.collection('students').doc(CFG.studentId).set({
    uid: CFG.studentId, email: CFG.studentEmail, name: CFG.studentName,
    status: 'active', createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: CFG.mentorEmail, firstLoginAt: admin.firestore.FieldValue.serverTimestamp()
  });
  console.log('  ✅ Student criado');

  // Account
  await db.collection('accounts').doc(CFG.accountId).set({
    name: 'Conta Teste Emocional', type: 'DEMO', isReal: false, broker: 'Teste',
    currency: 'BRL', initialBalance: 10000, currentBalance: 10000,
    studentId: CFG.studentId, studentEmail: CFG.studentEmail,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  console.log('  ✅ Account criada');

  // Plan
  await db.collection('plans').doc(CFG.planId).set({
    name: 'Plano Teste Emocional', accountId: CFG.accountId,
    studentId: CFG.studentId, studentEmail: CFG.studentEmail,
    pl: 10000, currentPl: 10000, goalPercent: 5, stopPercent: 3,
    riskPerOperation: 2, rrTarget: 2, active: true, operationPeriod: 'weekly',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  console.log('  ✅ Plan criado');

  // Trades
  const batch = db.batch();
  let pl = 0;
  TRADES.forEach((t, i) => {
    const entry = makeDate(t.daysAgo, t.h, t.m);
    const exit = new Date(entry.getTime() + 15 * 60000);
    pl += t.result;

    const ref = db.collection('trades').doc();
    batch.set(ref, {
      studentId: CFG.studentId, studentEmail: CFG.studentEmail, studentName: CFG.studentName,
      accountId: CFG.accountId, planId: CFG.planId,
      ticker: t.ticker, side: t.side, qty: t.qty,
      entry: 130000, exit: 130000 + t.result, stopLoss: 129500, takeProfit: 130500,
      result: t.result, emotionEntry: t.emotionEntry, emotionExit: t.emotionExit,
      setup: t.setup, date: isoD(entry), entryTime: isoT(entry), exitTime: isoT(exit),
      status: 'OPEN', feedbackHistory: [], redFlags: [], hasRedFlags: false,
      compliance: { roStatus: 'CONFORME', rrStatus: 'CONFORME' },
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const emoji = { 'Disciplinado':'💪','Calmo':'😌','Revanche':'🔴','FOMO':'😱','Ganância':'🤑','Frustrado':'😤','Raiva':'😡' }[t.emotionEntry] || '📊';
    console.log(`  ${String(i+1).padStart(2)}. D-${t.daysAgo} ${String(t.h).padStart(2,'0')}:${String(t.m).padStart(2,'0')} ${t.ticker.padEnd(5)} ${(t.result>=0?'+':'')+String(t.result).padStart(5)} ${emoji} ${t.emotionEntry} → ${t.emotionExit}`);
  });

  await batch.commit();
  console.log(`\n  ✅ ${TRADES.length} trades criados. PL total: R$ ${pl}`);

  // Atualizar saldo
  await db.collection('accounts').doc(CFG.accountId).update({ currentBalance: 10000 + pl });
  await db.collection('plans').doc(CFG.planId).update({ currentPl: 10000 + pl });
  console.log(`  ✅ Saldo/PL atualizados: R$ ${10000 + pl}`);
}

// ══════════════════════════════════════════════════════════════════
// RELATÓRIO
// ══════════════════════════════════════════════════════════════════
function printReport() {
  console.log('\n═══ COMO TESTAR ═══\n');
  console.log('1. MentorDashboard → Aba "Alunos"');
  console.log('   → "Aluno Teste Emocional" deve mostrar StudentEmotionalCard abaixo do nome');
  console.log('   → Score gauge (vermelho/laranja — score baixo por TILT+REVENGE)');
  console.log('   → Status: WARNING ou CRITICAL');
  console.log('   → Badges de TILT e REVENGE visíveis');
  console.log('   → Barra distribuição: mais vermelho que verde');
  console.log('');
  console.log('2. Clicar no aluno → vista individual');
  console.log('   → EmotionalProfileDetail aparece após gráficos');
  console.log('   → Score gauge grande + "Piorando" trend');
  console.log('   → Distribuição: NEGATIVE e CRITICAL dominantes');
  console.log('   → Top emoções: Frustrado, Raiva no topo');
  console.log('   → Timeline: alertas de TILT, REVENGE, STATUS_CRITICAL');
  console.log('   → Evolução diária: linha descendente dia -5 → dia 0');
  console.log('');
  console.log('3. Verificar Console → sem erros de hook/undefined');
  console.log('');
  console.log('4. DebugBadge → v1.8.0 no canto do MentorDashboard');
  console.log('');
  console.log('Para limpar depois:');
  console.log('  node scripts/setup-emotional-v2-test.js --clean-only');
}

// ══════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════
async function main() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(' Setup Emocional V2 — Massa de Teste');
  console.log(` Modo: ${DRY_RUN ? 'DRY-RUN (use --commit para aplicar)' : CLEAN_ONLY ? 'CLEAN-ONLY' : 'COMMIT'}`);
  console.log(`${'═'.repeat(60)}`);

  if (DRY_RUN) {
    console.log('\n⚠️  DRY-RUN: nada será alterado. Use --commit para aplicar.\n');
    const ok = await checkMigration();
    if (ok) {
      console.log('\n  Migração OK. Trades que seriam criados:\n');
      TRADES.forEach((t, i) => {
        console.log(`  ${String(i+1).padStart(2)}. D-${t.daysAgo} ${t.ticker.padEnd(5)} ${(t.result>=0?'+':'')+String(t.result).padStart(5)} ${t.emotionEntry} → ${t.emotionExit}`);
      });
    }
    printReport();
    process.exit(0);
  }

  if (CLEAN_ONLY) {
    await clean();
    process.exit(0);
  }

  // 1. Verificar migração
  const migrationOk = await checkMigration();
  if (!migrationOk) {
    console.log('\n❌ Abortando. Execute migrate-emotions.js --commit primeiro.');
    process.exit(1);
  }

  // 2. Limpar se pedido
  if (CLEAN) await clean();

  // 3. Criar dados
  await createTestData();

  // 4. Relatório
  printReport();

  console.log('\n✅ Setup concluído!\n');
  process.exit(0);
}

main().catch(err => { console.error('ERRO:', err); process.exit(1); });
