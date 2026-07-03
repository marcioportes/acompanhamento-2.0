/**
 * rebuildReviewSnapshot
 * @description Reconstrói o snapshot da revisão semanal a partir do Firestore (plan + trades
 *              ancorados via reviewId + maturity/current + janela do ciclo). Compute client-side
 *              (mentor trusted — ver clientSnapshotBuilder.js:7-9) via buildClientSnapshot.
 *
 * Origem: extração de WeeklyReviewPage.jsx (#331) para reuso no ReviewToolsPanel (Extrato),
 * que precisa do mesmo snapshot para gerar SWOT em DRAFT (frozenSnapshot ainda null).
 *
 * planId: lê `review.planId` (presente no doc DRAFT desde openReview) com fallback ao
 * `frozenSnapshot.planContext.planId` (revisões antigas). Conjunto = trades WHERE
 * reviewId === review.id (#269 v2 — FK carimbada no 1º feedback do mentor).
 *
 * @param {Object} review — doc da revisão ({ id, planId, cycleKey, frozenSnapshot? })
 * @param {Object} [opts]
 * @param {string} [opts.studentId] — para congelar maturity/current no snapshot
 * @returns {Promise<Object|null>} frozenSnapshot montado, ou null se plano ausente
 */

import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { buildClientSnapshot } from './clientSnapshotBuilder';
import { resolveCycle } from './cycleResolver';

export const rebuildReviewSnapshot = async (review, { studentId = null } = {}) => {
  const planId = review?.planId || review?.frozenSnapshot?.planContext?.planId;
  if (!planId) return null;
  const planSnap = await getDoc(doc(db, 'plans', planId));
  if (!planSnap.exists()) return null;
  const plan = { id: planSnap.id, ...planSnap.data() };
  const tradesQ = query(collection(db, 'trades'), where('planId', '==', planId));
  const tradesSnap = await getDocs(tradesQ);
  const allTrades = tradesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  // #269 v2 — conjunto da revisão = trades ancorados nela (reviewId === review.id).
  const draftTrades = allTrades.filter((t) => t.reviewId === review.id);
  const extraTrades = [];

  // Fetch defensivo de maturity/current para o comparativo N vs N-1.
  let maturity = null;
  try {
    if (studentId) {
      const matSnap = await getDoc(doc(db, 'students', studentId, 'maturity', 'current'));
      maturity = matSnap.exists() ? { id: matSnap.id, ...matSnap.data() } : null;
    }
  } catch (err) {
    console.warn('[rebuildReviewSnapshot] maturity fetch failed:', err?.message || err);
  }

  // CV normalizado per-ciclo (issue #235 F3.1) usa janela do CICLO, não da semana.
  const cycleRange = resolveCycle(review.cycleKey, plan);
  const toIso = (d) =>
    d instanceof Date && !Number.isNaN(d.getTime())
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      : null;

  return buildClientSnapshot({
    plan,
    trades: draftTrades,
    extraTrades,
    cycleKey: review.cycleKey || null,
    cycleStart: cycleRange ? toIso(cycleRange.start) : null,
    cycleEnd: cycleRange ? toIso(cycleRange.end) : null,
    emotionalMetrics: null,
    maturity,
  });
};
