/**
 * useMentorClosureInbox.js — inbox de closures pendentes de comentário pelo mentor.
 *
 * Subscription a cycleClosures CLOSED nos últimos 7 dias sem mentor.closingComment.
 * "no comment" automático: closures com closedAt < now-7d saem do inbox via filtro
 * client-side (não precisa job/trigger).
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo).
 *
 * Tone do semáforo (urgência):
 *   ≤2d  → red    (vencendo)
 *   3-5d → amber  (atenção)
 *   6-7d → emerald (folga)
 *
 * @returns {{ inbox, pendingCount, loading }}
 */

import { useEffect, useMemo, useState } from 'react';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

const WINDOW_DAYS = 7;
const MS_PER_DAY = 86400000;

/**
 * @returns {'red'|'amber'|'emerald'}
 */
function urgencyTone(daysRemaining) {
  if (daysRemaining <= 2) return 'red';
  if (daysRemaining <= 5) return 'amber';
  return 'emerald';
}

export function useMentorClosureInbox() {
  const [closures, setClosures] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // Subscription a closures CLOSED dos últimos 7 dias
    const sevenDaysAgo = Timestamp.fromDate(new Date(Date.now() - WINDOW_DAYS * MS_PER_DAY));
    const q = query(
      collection(db, 'cycleClosures'),
      where('status', '==', 'CLOSED'),
      where('closedAt', '>=', sevenDaysAgo),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setClosures(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('[useMentorClosureInbox] erro:', err);
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  const inbox = useMemo(() => {
    const now = Date.now();
    return closures
      .map((c) => {
        const closedAt = c.closedAt?.toDate ? c.closedAt.toDate() : c.closedAt ? new Date(c.closedAt) : null;
        if (!closedAt) return null;

        const closingCommented = !!(c.mentor?.closingComment && c.mentor.closingComment.trim().length > 0);
        if (closingCommented) return null;

        const elapsedMs = now - closedAt.getTime();
        const daysRemaining = Math.max(0, Math.ceil((WINDOW_DAYS * MS_PER_DAY - elapsedMs) / MS_PER_DAY));
        if (daysRemaining === 0) return null;     // expirou — sai do inbox

        const tone = urgencyTone(daysRemaining);

        // Resumo das métricas-chave pra UI
        const tps = c.metrics?.tradingPerformanceScore ?? null;
        const resultPercent = c.snapshot?.resultPercent ?? null;
        const tradesCount = c.snapshot?.tradesCount ?? null;
        const promotionEligible = c.maturity?.promotionEligible === true;
        const regression = Array.isArray(c.maturity?.regression) ? c.maturity.regression : [];

        return {
          id: c.id,
          closureId: c.id,
          studentId: c.studentId,
          planId: c.planId,
          cycleKey: c.cycleKey,
          cycleStart: c.cycleStart,
          cycleEnd: c.cycleEnd,
          closedAt,
          daysRemaining,
          tone,
          closeMode: c.closeMode || 'self',
          summary: {
            tps,
            resultPercent,
            tradesCount,
            promotionEligible,
            regression,
          },
          _raw: c,        // doc completo pra MentorClosureView usar
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.daysRemaining - b.daysRemaining);   // mais urgentes primeiro
  }, [closures]);

  return { inbox, pendingCount: inbox.length, loading };
}

export default useMentorClosureInbox;
