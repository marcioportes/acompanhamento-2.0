/**
 * cleanupOrphans.js — utilitário dev pra detectar e limpar trades/orders/closures
 * cujo `accountId` (ou `planId` indireto) aponta pra docs que não existem mais.
 *
 * Causa típica: contas deletadas com o `deleteAccount` antigo que não fazia
 * cascade completo (trades por studentEmail só, orders e cycleClosures não eram
 * tocadas). Sucessor já corrigiu o handler — esse util limpa o passivo.
 *
 * Exposto em `window.__cleanup` quando `import.meta.env.DEV` (Vite). Em produção,
 * o módulo é importável mas não está no window — protege contra execução acidental.
 *
 * Uso (DevTools console, logado como mentor ou aluno):
 *
 *   await window.__cleanup.findOrphans()       // relatório read-only
 *   await window.__cleanup.deleteOrphans()     // pede confirm e apaga
 *
 * Issue #259 fast-follow.
 */

import { collection, doc, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';

/**
 * Carrega o set de accountIds e planIds ATUAIS no Firestore filtrando pelo
 * studentId do usuário autenticado. Mentor enxerga tudo (sem filtro).
 */
async function loadAliveSets({ userUid, isMentor }) {
  const accountsSnap = isMentor
    ? await getDocs(collection(db, 'accounts'))
    : await getDocs(query(collection(db, 'accounts'), where('studentId', '==', userUid)));
  const aliveAccountIds = new Set(accountsSnap.docs.map((d) => d.id));

  const plansSnap = isMentor
    ? await getDocs(collection(db, 'plans'))
    : await getDocs(query(collection(db, 'plans'), where('studentId', '==', userUid)));
  const alivePlanIds = new Set(plansSnap.docs.map((d) => d.id));

  return { aliveAccountIds, alivePlanIds };
}

/**
 * Coleta trades/orders/cycleClosures órfãos.
 *
 * Critério de órfão:
 *   - trade.accountId NÃO está em aliveAccountIds, OU
 *   - trade.planId NÃO está em alivePlanIds   (planos podem ter sumido)
 *
 * Mesmo critério pra orders (planId) e cycleClosures (accountId/planId).
 */
async function collectOrphans({ user, isMentor }) {
  if (!user?.uid) throw new Error('Usuário não autenticado.');
  const userUid = user.uid;
  const userEmail = user.email;

  const { aliveAccountIds, alivePlanIds } = await loadAliveSets({ userUid, isMentor });

  // TRADES — duplo query pra cobrir studentId E studentEmail (histórico)
  const tradeDocMap = new Map();
  if (isMentor) {
    const snap = await getDocs(collection(db, 'trades'));
    for (const d of snap.docs) tradeDocMap.set(d.id, d);
  } else {
    if (userUid) {
      const s1 = await getDocs(query(collection(db, 'trades'), where('studentId', '==', userUid)));
      for (const d of s1.docs) tradeDocMap.set(d.id, d);
    }
    if (userEmail) {
      const s2 = await getDocs(query(collection(db, 'trades'), where('studentEmail', '==', userEmail)));
      for (const d of s2.docs) tradeDocMap.set(d.id, d);
    }
  }
  const orphanTrades = [...tradeDocMap.values()].filter((d) => {
    const data = d.data();
    const acctDead = data.accountId && !aliveAccountIds.has(data.accountId);
    const planDead = data.planId && !alivePlanIds.has(data.planId);
    return acctDead || planDead;
  });

  // ORDERS — query por studentId (orders não têm accountId direto)
  const orderDocMap = new Map();
  if (isMentor) {
    const snap = await getDocs(collection(db, 'orders'));
    for (const d of snap.docs) orderDocMap.set(d.id, d);
  } else if (userUid) {
    const s = await getDocs(query(collection(db, 'orders'), where('studentId', '==', userUid)));
    for (const d of s.docs) orderDocMap.set(d.id, d);
  }
  const orphanOrders = [...orderDocMap.values()].filter((d) => {
    const data = d.data();
    return data.planId && !alivePlanIds.has(data.planId);
  });

  // CYCLE CLOSURES — accountId direto no doc
  const closureDocMap = new Map();
  if (isMentor) {
    const snap = await getDocs(collection(db, 'cycleClosures'));
    for (const d of snap.docs) closureDocMap.set(d.id, d);
  } else if (userUid) {
    const s = await getDocs(query(collection(db, 'cycleClosures'), where('studentId', '==', userUid)));
    for (const d of s.docs) closureDocMap.set(d.id, d);
  }
  const orphanClosures = [...closureDocMap.values()].filter((d) => {
    const data = d.data();
    const acctDead = data.accountId && !aliveAccountIds.has(data.accountId);
    const planDead = data.planId && !alivePlanIds.has(data.planId);
    return acctDead || planDead;
  });

  // MOVEMENTS — accountId direto
  const movementDocMap = new Map();
  if (isMentor) {
    const snap = await getDocs(collection(db, 'movements'));
    for (const d of snap.docs) movementDocMap.set(d.id, d);
  } else if (userUid) {
    const s = await getDocs(query(collection(db, 'movements'), where('studentId', '==', userUid)));
    for (const d of s.docs) movementDocMap.set(d.id, d);
  }
  const orphanMovements = [...movementDocMap.values()].filter((d) => {
    const data = d.data();
    return data.accountId && !aliveAccountIds.has(data.accountId);
  });

  return { orphanTrades, orphanOrders, orphanClosures, orphanMovements, aliveAccountIds, alivePlanIds };
}

function summarizeByAccountId(docs) {
  const map = new Map();
  for (const d of docs) {
    const acct = d.data().accountId || '(sem accountId)';
    map.set(acct, (map.get(acct) || 0) + 1);
  }
  return Object.fromEntries(map);
}

/**
 * Detecta órfãos e imprime relatório (não deleta nada).
 */
export async function findOrphans() {
  const user = auth.currentUser;
  if (!user) {
    console.warn('[cleanupOrphans] Faça login antes.');
    return null;
  }
  // Detecção crude de mentor — checa email do mentor único do projeto. Em prod
  // poderia ler de claims, mas pra util de dev isso basta.
  const isMentor = user.email === 'portes.marcio@gmail.com' || /mentor/i.test(user.email || '');

  console.log(`[cleanupOrphans] Autenticado como ${user.email} (${isMentor ? 'mentor' : 'aluno'}). Buscando órfãos...`);
  const { orphanTrades, orphanOrders, orphanClosures, orphanMovements, aliveAccountIds, alivePlanIds } =
    await collectOrphans({ user, isMentor });

  const report = {
    aliveAccounts: aliveAccountIds.size,
    alivePlans: alivePlanIds.size,
    orphans: {
      trades:        orphanTrades.length,
      orders:        orphanOrders.length,
      cycleClosures: orphanClosures.length,
      movements:     orphanMovements.length,
    },
    tradesByDeadAccountId:    summarizeByAccountId(orphanTrades),
    movementsByDeadAccountId: summarizeByAccountId(orphanMovements),
    closuresByDeadAccountId:  summarizeByAccountId(orphanClosures),
  };
  console.log('[cleanupOrphans] Relatório:', report);
  return report;
}

/**
 * Limpa órfãos. Mostra relatório, pede confirm e apaga.
 */
export async function deleteOrphans({ skipConfirm = false } = {}) {
  const user = auth.currentUser;
  if (!user) {
    console.warn('[cleanupOrphans] Faça login antes.');
    return null;
  }
  const isMentor = user.email === 'portes.marcio@gmail.com' || /mentor/i.test(user.email || '');

  const { orphanTrades, orphanOrders, orphanClosures, orphanMovements } = await collectOrphans({ user, isMentor });
  const total = orphanTrades.length + orphanOrders.length + orphanClosures.length + orphanMovements.length;

  if (total === 0) {
    console.log('[cleanupOrphans] Nada pra limpar — banco está consistente.');
    return { deleted: 0 };
  }

  const summary = `${orphanTrades.length} trades · ${orphanOrders.length} orders · ${orphanClosures.length} closures · ${orphanMovements.length} movements`;
  if (!skipConfirm && !window.confirm(`Apagar ${total} docs órfãos?\n\n${summary}`)) {
    console.log('[cleanupOrphans] Cancelado pelo usuário.');
    return { deleted: 0, cancelled: true };
  }

  console.log(`[cleanupOrphans] Apagando ${total} docs...`);

  const deleteAll = async (docs, collectionName) =>
    Promise.all(docs.map((d) => deleteDoc(doc(db, collectionName, d.id))));

  await Promise.all([
    deleteAll(orphanTrades,    'trades'),
    deleteAll(orphanOrders,    'orders'),
    deleteAll(orphanClosures,  'cycleClosures'),
    deleteAll(orphanMovements, 'movements'),
  ]);

  console.log(`[cleanupOrphans] ${total} docs apagados.`);
  return {
    deleted: total,
    breakdown: {
      trades:        orphanTrades.length,
      orders:        orphanOrders.length,
      cycleClosures: orphanClosures.length,
      movements:     orphanMovements.length,
    },
  };
}

/**
 * Expõe em window.__cleanup quando rodando em dev (Vite). Em build de produção
 * o `import.meta.env.DEV` é false e o util não é exposto.
 */
export function installCleanupUtils() {
  if (typeof window === 'undefined') return;
  if (!import.meta.env?.DEV) return;
  window.__cleanup = { findOrphans, deleteOrphans };
  console.log('[cleanupOrphans] window.__cleanup pronto. Comandos: findOrphans(), deleteOrphans()');
}
