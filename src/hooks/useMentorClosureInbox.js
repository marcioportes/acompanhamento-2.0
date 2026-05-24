/**
 * useMentorClosureInbox.js — inbox de closures do mentor.
 *
 * Dois modos:
 *  - 'pending' (default): janela 7d após selo, sem mentor.closingCommentAt.
 *    "no comment" explícito (issue #280): mentor marca processado mesmo sem texto;
 *    closingCommentAt é o sinal de "mentor olhou", não o conteúdo do comentário.
 *    Janela 7d expira via filtro: closures com closedAt < now-7d saem.
 *  - 'all': todos closures CLOSED (sem janela, sem filtro de processamento).
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo).
 *
 * Tone do semáforo (urgência, só faz sentido em 'pending'):
 *   ≤2d  → red    (vencendo)
 *   3-5d → amber  (atenção)
 *   6-7d → emerald (folga)
 *
 * @param {{ mode?: 'pending' | 'all' }} [opts]
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

export function useMentorClosureInbox({ mode = 'pending', enabled = true } = {}) {
  const [closures, setClosures] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) {
      // Callers que não são mentor (ex.: Sidebar do aluno) podem desligar a
      // assinatura — evita firebase calls em jsdom/tests sem mock e respeita
      // rules de leitura (aluno não vê closures de outros).
      setClosures([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    // 'pending': subscribe à janela 7d; 'all': todos CLOSED
    let q;
    if (mode === 'all') {
      q = query(
        collection(db, 'cycleClosures'),
        where('status', '==', 'CLOSED'),
      );
    } else {
      const sevenDaysAgo = Timestamp.fromDate(new Date(Date.now() - WINDOW_DAYS * MS_PER_DAY));
      q = query(
        collection(db, 'cycleClosures'),
        where('status', '==', 'CLOSED'),
        where('closedAt', '>=', sevenDaysAgo),
      );
    }
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
  }, [mode, enabled]);

  const inbox = useMemo(() => {
    const now = Date.now();
    return closures
      .map((c) => {
        const closedAt = c.closedAt?.toDate ? c.closedAt.toDate() : c.closedAt ? new Date(c.closedAt) : null;
        if (!closedAt) return null;

        // Issue #280: filtra por closingCommentAt (timestamp setado pela CF sempre que
        // mentor processa, com ou sem texto). closingComment vira null no fluxo "no comment".
        const closingProcessed = !!c.mentor?.closingCommentAt;
        if (mode === 'pending' && closingProcessed) return null;

        const elapsedMs = now - closedAt.getTime();
        const daysRemaining = Math.max(0, Math.ceil((WINDOW_DAYS * MS_PER_DAY - elapsedMs) / MS_PER_DAY));
        // No 'pending', closures fora da janela 7d somem (já fora do query, defensivo); 'all' mantém.
        if (mode === 'pending' && daysRemaining === 0) return null;

        const behavioral = c.behavioralSummary || null;
        const isCritical = !!behavioral?.critical;
        // R2: items críticos sobem para tone 'red' independente da janela — sinalizam blow-up risk
        const tone = isCritical ? 'red' : (mode === 'pending' ? urgencyTone(daysRemaining) : 'slate');

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
          isCritical,
          closeMode: c.closeMode || 'self',
          summary: {
            tps,
            resultPercent,
            tradesCount,
            promotionEligible,
            regression,
            behavioral,
          },
          _raw: c,        // doc completo pra MentorClosureView usar
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        // Críticos sempre no topo
        if (a.isCritical && !b.isCritical) return -1;
        if (!a.isCritical && b.isCritical) return 1;
        return mode === 'pending'
          ? a.daysRemaining - b.daysRemaining        // mais urgentes primeiro
          : b.closedAt - a.closedAt;                 // mais recentes primeiro
      });
  }, [closures, mode]);

  // pendingCount sempre conta closures dentro da janela 7d sem comentário
  // (mesmo em modo 'all'), para o badge do menu manter o significado de "pendente".
  const pendingCount = useMemo(() => {
    if (mode === 'pending') return inbox.length;
    const now = Date.now();
    return closures.reduce((n, c) => {
      const closedAt = c.closedAt?.toDate ? c.closedAt.toDate() : c.closedAt ? new Date(c.closedAt) : null;
      if (!closedAt) return n;
      // Issue #280: timestamp como sinal de "mentor processou" (vide inbox useMemo acima).
      const processed = !!c.mentor?.closingCommentAt;
      if (processed) return n;
      const elapsedMs = now - closedAt.getTime();
      if (elapsedMs >= WINDOW_DAYS * MS_PER_DAY) return n;
      return n + 1;
    }, 0);
  }, [inbox, closures, mode]);

  return { inbox, pendingCount, loading };
}

export default useMentorClosureInbox;
