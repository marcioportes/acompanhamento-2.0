/**
 * seedTestExtract.js
 * @version 2.0.0 (v1.17.0)
 * @description Script para criar dados de teste que cobrem TODOS os cenários
 *   de badge e extrato emocional.
 *
 *   - Cria conta no Firebase Auth (login funcional)
 *   - Vincula ao mentor logado (mentorId automático)
 *   - 10 planos, ~35 trades cobrindo todos os estados da state machine
 *
 * CENÁRIOS COBERTOS:
 *   1. IN_PROGRESS — trades dentro dos limites
 *   2. GOAL_DISCIPLINED — meta batida, parou
 *   3. POST_GOAL_GAIN — meta + continuou positivo
 *   4. POST_GOAL_LOSS — meta + devolveu parcial
 *   5. GOAL_TO_STOP — catástrofe: meta → stop
 *   6. STOP_HIT — stop atingido, parou
 *   7. STOP_WORSENED — stop violado, piorou
 *   8. LOSS_TO_GOAL — stop → recuperou
 *   9. TILT + REVENGE + Compliance violations
 *   10. MULTI-CICLO — trades em Jan/Fev/Mar
 *
 * USO (via SettingsPage > Admin):
 *   1. Clicar "Criar Dados de Teste" — cria tudo
 *   2. View As → "Aluno Teste Extrato"
 *   3. Abrir extrato de cada plano para validar
 *   4. Clicar "Limpar Dados de Teste" quando terminar
 *
 * LOGIN DIRETO (opcional):
 *   Email: teste.extrato@ficticio.com
 *   Senha: Teste@123
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  deleteUser,
} from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase';

// ============================================
// CONSTANTES
// ============================================

const TEST_EMAIL = 'teste.extrato@ficticio.com';
const TEST_PASSWORD = 'Teste@123';
const TEST_NAME = 'Aluno Teste Extrato';
const TEST_ACCOUNT_ID = 'test-extract-account-001';
const TEST_ACCOUNT_ID_2 = 'test-extract-account-002';

const PLAN_IDS = {
  IN_PROGRESS: 'test-plan-in-progress',
  GOAL_DISCIPLINED: 'test-plan-goal-disciplined',
  POST_GOAL_GAIN: 'test-plan-post-goal-gain',
  POST_GOAL_LOSS: 'test-plan-post-goal-loss',
  GOAL_TO_STOP: 'test-plan-goal-to-stop',
  STOP_HIT: 'test-plan-stop-hit',
  STOP_WORSENED: 'test-plan-stop-worsened',
  LOSS_TO_GOAL: 'test-plan-loss-to-goal',
  TILT_REVENGE: 'test-plan-tilt-revenge',
  MULTI_CYCLE: 'test-plan-multi-cycle',
};

// ============================================
// HELPERS
// ============================================

const toTimestamp = (dateStr) => Timestamp.fromDate(new Date(dateStr + 'T12:00:00'));

const makePlan = (id, name, accountId, studentId) => ({
  name,
  accountId,
  active: true,
  operationPeriod: 'Diário',
  adjustmentCycle: 'Mensal',
  pl: 20000,
  periodGoal: 2,
  periodStop: 2,
  cycleGoal: 8,
  cycleStop: 6,
  rrTarget: 2,
  maxContracts: 5,
  maxTradesPerDay: 5,
  riskPerOperation: 0.4,
  studentId,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

let tradeCounter = 0;

const makeTrade = ({
  date, time, ticker = 'WINFUT', side = 'LONG',
  result, planId, accountId = TEST_ACCOUNT_ID, studentId,
  emotionEntry = 'Disciplinado', emotionExit = 'Disciplinado',
  stopLoss, riskPercent, rrRatio,
  roStatus = 'CONFORME', rrStatus = 'CONFORME',
  redFlags = [],
}) => {
  tradeCounter++;
  const id = `test-trade-${String(tradeCounter).padStart(4, '0')}`;
  const entryTime = `${date}T${time || '10:00'}:00`;

  return {
    _id: id,
    date,
    entryTime,
    exitTime: entryTime,
    duration: 15,
    ticker,
    exchange: 'B3',
    side,
    entry: 128000,
    exit: 128000 + (result / 0.2) * (side === 'LONG' ? 1 : -1),
    qty: 1,
    stopLoss: stopLoss ?? (side === 'LONG' ? 127900 : 128100),
    result,
    resultInPoints: result / 0.2,
    resultCalculated: result,
    resultPercent: (result / 20000) * 100,
    emotionEntry,
    emotionExit,
    compliance: { roStatus, rrStatus },
    redFlags,
    riskPercent: riskPercent ?? 0.1,
    rrRatio: rrRatio ?? 2.0,
    status: 'OPEN',
    planId,
    accountId,
    currency: 'BRL',
    studentId,
    studentEmail: TEST_EMAIL,
    studentName: TEST_NAME,
    hasPartials: false,
    partialsCount: 0,
    _partials: [],
    createdAt: toTimestamp(date),
    updatedAt: toTimestamp(date),
  };
};

// ============================================
// CENÁRIOS
// ============================================

const buildAllTrades = (studentId) => {
  tradeCounter = 0;
  const trades = [];
  const t = (overrides) => makeTrade({ ...overrides, studentId });

  // 1. IN_PROGRESS — positivo mas abaixo da meta (400)
  trades.push(t({ date: '2026-03-03', time: '10:00', result: 100, planId: PLAN_IDS.IN_PROGRESS, emotionEntry: 'Focado', emotionExit: 'Disciplinado' }));
  trades.push(t({ date: '2026-03-03', time: '10:30', result: 80, planId: PLAN_IDS.IN_PROGRESS, emotionEntry: 'Confiante', emotionExit: 'Confiante' }));
  trades.push(t({ date: '2026-03-03', time: '11:00', result: -30, planId: PLAN_IDS.IN_PROGRESS, emotionEntry: 'Cauteloso', emotionExit: 'Neutro' }));

  // 2. GOAL_DISCIPLINED — total 450 >= 400
  trades.push(t({ date: '2026-03-03', time: '10:00', result: 150, planId: PLAN_IDS.GOAL_DISCIPLINED, emotionEntry: 'Disciplinado', emotionExit: 'Confiante' }));
  trades.push(t({ date: '2026-03-03', time: '10:30', result: 120, planId: PLAN_IDS.GOAL_DISCIPLINED, emotionEntry: 'Focado', emotionExit: 'Focado' }));
  trades.push(t({ date: '2026-03-03', time: '11:00', result: 180, planId: PLAN_IDS.GOAL_DISCIPLINED, emotionEntry: 'Confiante', emotionExit: 'Disciplinado' }));

  // 3. POST_GOAL_GAIN — meta + overtrading, ainda positivo
  trades.push(t({ date: '2026-03-03', time: '10:00', result: 500, planId: PLAN_IDS.POST_GOAL_GAIN, emotionEntry: 'Confiante', emotionExit: 'Eufórico' }));
  trades.push(t({ date: '2026-03-03', time: '11:00', result: 100, planId: PLAN_IDS.POST_GOAL_GAIN, emotionEntry: 'Eufórico', emotionExit: 'Ganância' }));
  trades.push(t({ date: '2026-03-03', time: '11:30', result: -50, planId: PLAN_IDS.POST_GOAL_GAIN, emotionEntry: 'Ganância', emotionExit: 'Frustrado' }));

  // 4. POST_GOAL_LOSS — meta + devolveu (total 50, abaixo da meta)
  trades.push(t({ date: '2026-03-03', time: '10:00', result: 500, planId: PLAN_IDS.POST_GOAL_LOSS, emotionEntry: 'Confiante', emotionExit: 'Eufórico' }));
  trades.push(t({ date: '2026-03-03', time: '11:00', result: -200, planId: PLAN_IDS.POST_GOAL_LOSS, emotionEntry: 'Eufórico', emotionExit: 'Frustrado' }));
  trades.push(t({ date: '2026-03-03', time: '11:30', result: -250, planId: PLAN_IDS.POST_GOAL_LOSS, emotionEntry: 'Revenge', emotionExit: 'Frustrado' }));

  // 5. GOAL_TO_STOP — meta → catástrofe (total -450)
  trades.push(t({ date: '2026-03-03', time: '10:00', result: 450, planId: PLAN_IDS.GOAL_TO_STOP, emotionEntry: 'Confiante', emotionExit: 'Eufórico' }));
  trades.push(t({ date: '2026-03-03', time: '11:00', result: -400, planId: PLAN_IDS.GOAL_TO_STOP, emotionEntry: 'Eufórico', emotionExit: 'Frustrado' }));
  trades.push(t({ date: '2026-03-03', time: '11:30', result: -300, planId: PLAN_IDS.GOAL_TO_STOP, emotionEntry: 'Revenge', emotionExit: 'Medo' }));
  trades.push(t({ date: '2026-03-03', time: '12:00', result: -200, planId: PLAN_IDS.GOAL_TO_STOP, emotionEntry: 'Impulsivo', emotionExit: 'Medo' }));

  // 6. STOP_HIT — total -450 <= -400
  trades.push(t({ date: '2026-03-03', time: '10:00', result: -200, planId: PLAN_IDS.STOP_HIT, emotionEntry: 'Ansioso', emotionExit: 'Frustrado' }));
  trades.push(t({ date: '2026-03-03', time: '10:30', result: -150, planId: PLAN_IDS.STOP_HIT, emotionEntry: 'FOMO', emotionExit: 'Frustrado' }));
  trades.push(t({ date: '2026-03-03', time: '11:00', result: -100, planId: PLAN_IDS.STOP_HIT, emotionEntry: 'Hesitante', emotionExit: 'Medo' }));

  // 7. STOP_WORSENED — piorou após stop (total -700)
  trades.push(t({ date: '2026-03-03', time: '10:00', result: -450, planId: PLAN_IDS.STOP_WORSENED, emotionEntry: 'Ansioso', emotionExit: 'Frustrado' }));
  trades.push(t({ date: '2026-03-03', time: '11:00', result: -150, planId: PLAN_IDS.STOP_WORSENED, emotionEntry: 'Revenge', emotionExit: 'Medo' }));
  trades.push(t({ date: '2026-03-03', time: '11:30', result: -100, planId: PLAN_IDS.STOP_WORSENED, emotionEntry: 'Impulsivo', emotionExit: 'Medo' }));

  // 8. LOSS_TO_GOAL — stop → recuperou (total +100)
  trades.push(t({ date: '2026-03-03', time: '10:00', result: -450, planId: PLAN_IDS.LOSS_TO_GOAL, emotionEntry: 'Ansioso', emotionExit: 'Frustrado' }));
  trades.push(t({ date: '2026-03-03', time: '11:00', result: 300, planId: PLAN_IDS.LOSS_TO_GOAL, emotionEntry: 'Focado', emotionExit: 'Confiante' }));
  trades.push(t({ date: '2026-03-03', time: '11:30', result: 250, planId: PLAN_IDS.LOSS_TO_GOAL, emotionEntry: 'Disciplinado', emotionExit: 'Disciplinado' }));

  // 9. TILT + REVENGE + Compliance
  // Dia 1: TILT — 3 trades negativos consecutivos
  trades.push(t({ date: '2026-03-03', time: '10:00', result: -80, planId: PLAN_IDS.TILT_REVENGE, emotionEntry: 'FOMO', emotionExit: 'Frustrado' }));
  trades.push(t({ date: '2026-03-03', time: '10:15', result: -60, planId: PLAN_IDS.TILT_REVENGE, emotionEntry: 'Frustrado', emotionExit: 'Ansioso' }));
  trades.push(t({ date: '2026-03-03', time: '10:30', result: -40, planId: PLAN_IDS.TILT_REVENGE, emotionEntry: 'Ansioso', emotionExit: 'Medo' }));
  // Dia 2: REVENGE
  trades.push(t({ date: '2026-03-04', time: '10:00', result: -100, planId: PLAN_IDS.TILT_REVENGE, emotionEntry: 'Frustrado', emotionExit: 'Revenge' }));
  trades.push(t({ date: '2026-03-04', time: '10:05', result: -200, planId: PLAN_IDS.TILT_REVENGE, emotionEntry: 'Revenge', emotionExit: 'Medo' }));
  // Dia 3: Compliance violations
  trades.push(t({
    date: '2026-03-05', time: '10:00', result: 50, planId: PLAN_IDS.TILT_REVENGE,
    emotionEntry: 'Impulsivo', emotionExit: 'Neutro',
    stopLoss: null, riskPercent: 2.5, rrRatio: 0.8,
    roStatus: 'FORA_DO_PLANO', rrStatus: 'NAO_CONFORME',
    redFlags: [{ type: 'TRADE_SEM_STOP' }, { type: 'RISCO_ACIMA_PERMITIDO' }, { type: 'RR_ABAIXO_MINIMO' }],
  }));

  // 10. MULTI-CICLO — Jan + Fev + Mar
  trades.push(t({ date: '2026-01-15', time: '10:00', result: 200, planId: PLAN_IDS.MULTI_CYCLE, emotionEntry: 'Focado', emotionExit: 'Confiante' }));
  trades.push(t({ date: '2026-01-20', time: '10:00', result: 300, planId: PLAN_IDS.MULTI_CYCLE, emotionEntry: 'Disciplinado', emotionExit: 'Disciplinado' }));
  trades.push(t({ date: '2026-02-10', time: '10:00', result: -150, planId: PLAN_IDS.MULTI_CYCLE, emotionEntry: 'Ansioso', emotionExit: 'Frustrado' }));
  trades.push(t({ date: '2026-02-15', time: '10:00', result: 400, planId: PLAN_IDS.MULTI_CYCLE, emotionEntry: 'Confiante', emotionExit: 'Disciplinado' }));
  trades.push(t({ date: '2026-02-20', time: '10:00', result: 100, planId: PLAN_IDS.MULTI_CYCLE, emotionEntry: 'Paciente', emotionExit: 'Focado' }));
  trades.push(t({ date: '2026-03-05', time: '10:00', result: 250, planId: PLAN_IDS.MULTI_CYCLE, emotionEntry: 'Disciplinado', emotionExit: 'Confiante' }));

  return trades;
};

// ============================================
// PUBLIC API
// ============================================

/**
 * Cria dados de teste completos.
 * @param {string} mentorId - UID do mentor logado (passado pela SettingsPage)
 */
export const seedTestExtract = async (mentorId) => {
  console.log('🚀 Iniciando seed de teste para extrato/badges...');

  try {
    // Salvar auth state atual para restaurar depois
    const currentUser = auth.currentUser;

    // 1. Criar conta Auth
    let studentUid;
    try {
      const cred = await createUserWithEmailAndPassword(auth, TEST_EMAIL, TEST_PASSWORD);
      studentUid = cred.user.uid;
      console.log('✅ Auth account criada:', studentUid);
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        // Já existe — fazer login para pegar o uid
        const cred = await signInWithEmailAndPassword(auth, TEST_EMAIL, TEST_PASSWORD);
        studentUid = cred.user.uid;
        console.log('ℹ️ Auth account já existe, uid:', studentUid);
      } else {
        throw err;
      }
    }

    // Restaurar sessão do mentor
    if (currentUser && currentUser.email !== TEST_EMAIL) {
      // Firebase Auth mantém a sessão mais recente — o mentor vai precisar relogar
      // Mas como estamos no mesmo browser, vamos usar signIn do mentor de volta
      console.log('⚠️ Sessão Auth mudou para o aluno teste. Recarregue a página para restaurar sua sessão de mentor.');
    }

    // 2. Criar user doc
    await setDoc(doc(db, 'users', studentUid), {
      uid: studentUid,
      email: TEST_EMAIL,
      name: TEST_NAME,
      role: 'student',
      mentorId: mentorId || null,
      active: true,
      activated: true,
      createdAt: serverTimestamp(),
    });
    console.log('✅ User doc criado, mentorId:', mentorId);

    // 3. Contas
    await setDoc(doc(db, 'accounts', TEST_ACCOUNT_ID), {
      name: 'Clear — Teste Extrato (BRL)',
      type: 'REAL', currency: 'BRL',
      initialBalance: 20000, currentBalance: 20000,
      exchange: 'B3', broker: 'Clear Corretora',
      studentId: studentUid, createdAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'accounts', TEST_ACCOUNT_ID_2), {
      name: 'IB — Teste Extrato (USD)',
      type: 'PROP', currency: 'USD',
      initialBalance: 5000, currentBalance: 5000,
      exchange: 'CME', broker: 'Interactive Brokers',
      studentId: studentUid, createdAt: serverTimestamp(),
    });
    console.log('✅ 2 contas criadas');

    // 4. Planos
    const planEntries = [
      [PLAN_IDS.IN_PROGRESS, 'Cenário 1: In Progress'],
      [PLAN_IDS.GOAL_DISCIPLINED, 'Cenário 2: Meta Disciplinada'],
      [PLAN_IDS.POST_GOAL_GAIN, 'Cenário 3: Pós-Meta (Gain)'],
      [PLAN_IDS.POST_GOAL_LOSS, 'Cenário 4: Devolveu Meta'],
      [PLAN_IDS.GOAL_TO_STOP, 'Cenário 5: Catástrofe'],
      [PLAN_IDS.STOP_HIT, 'Cenário 6: Stop Atingido'],
      [PLAN_IDS.STOP_WORSENED, 'Cenário 7: Stop Violado'],
      [PLAN_IDS.LOSS_TO_GOAL, 'Cenário 8: Recuperação'],
      [PLAN_IDS.TILT_REVENGE, 'Cenário 9: TILT + Compliance'],
      [PLAN_IDS.MULTI_CYCLE, 'Cenário 10: Multi-Ciclo'],
    ];
    for (const [id, name] of planEntries) {
      await setDoc(doc(db, 'plans', id), makePlan(id, name, TEST_ACCOUNT_ID, studentUid));
    }
    console.log(`✅ ${planEntries.length} planos criados`);

    // 5. Trades
    const trades = buildAllTrades(studentUid);
    for (const trade of trades) {
      const { _id, ...data } = trade;
      await setDoc(doc(db, 'trades', _id), data);
    }
    console.log(`✅ ${trades.length} trades criados`);

    const msg = `Seed completo! ${trades.length} trades, 10 planos. Email: ${TEST_EMAIL} / Senha: ${TEST_PASSWORD}. ⚠️ Recarregue a página para restaurar sessão do mentor.`;
    console.log('\n✅ ' + msg);
    return { success: true, message: msg };

  } catch (error) {
    console.error('❌ Erro no seed:', error);
    return { success: false, message: error.message };
  }
};

/**
 * Remove todos os dados de teste.
 */
export const cleanupTestExtract = async () => {
  console.log('🧹 Removendo dados de teste...');

  try {
    // Encontrar uid do aluno teste
    const usersQuery = query(collection(db, 'users'), where('email', '==', TEST_EMAIL));
    const usersSnap = await getDocs(usersQuery);
    const studentUid = usersSnap.docs[0]?.id;

    if (studentUid) {
      // Deletar trades
      const tradesQuery = query(collection(db, 'trades'), where('studentId', '==', studentUid));
      const tradesSnap = await getDocs(tradesQuery);
      for (const d of tradesSnap.docs) await deleteDoc(d.ref);
      console.log(`   Trades: ${tradesSnap.size}`);

      // Deletar movements
      const movQuery = query(collection(db, 'movements'), where('accountId', 'in', [TEST_ACCOUNT_ID, TEST_ACCOUNT_ID_2]));
      const movSnap = await getDocs(movQuery);
      for (const d of movSnap.docs) await deleteDoc(d.ref);

      // Deletar user doc
      await deleteDoc(doc(db, 'users', studentUid));
    }

    // Deletar planos
    for (const planId of Object.values(PLAN_IDS)) {
      try { await deleteDoc(doc(db, 'plans', planId)); } catch {}
    }

    // Deletar contas
    try { await deleteDoc(doc(db, 'accounts', TEST_ACCOUNT_ID)); } catch {}
    try { await deleteDoc(doc(db, 'accounts', TEST_ACCOUNT_ID_2)); } catch {}

    // Deletar Auth account (precisa estar logado como o teste)
    try {
      const cred = await signInWithEmailAndPassword(auth, TEST_EMAIL, TEST_PASSWORD);
      await deleteUser(cred.user);
      console.log('   Auth account deletada');
    } catch (err) {
      console.log('   Auth account: não encontrada ou já deletada');
    }

    const msg = 'Cleanup completo! ⚠️ Recarregue a página para restaurar sessão do mentor.';
    console.log('\n✅ ' + msg);
    return { success: true, message: msg };

  } catch (error) {
    console.error('❌ Erro no cleanup:', error);
    return { success: false, message: error.message };
  }
};
