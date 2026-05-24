/**
 * usePlanClosures.js — closures de um plano específico.
 *
 * Subscribe a `cycleClosures where planId == X`. Single where → não precisa
 * composite index. Retorna lista com TODOS os closures (CLOSED + REOPENED se
 * houver), pra que callers escolham status conforme uso.
 *
 * Usado por componentes que precisam consultar baseline histórico de um ciclo
 * específico (ex.: PlanLedgerExtract pra puxar PL(0) histórico).
 *
 * Issue #259 (1A — Ritual de Fechamento de Ciclo).
 */

import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export function usePlanClosures(planId) {
  const [closures, setClosures] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!planId) {
      setClosures([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const q = query(
      collection(db, 'cycleClosures'),
      where('planId', '==', planId),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setClosures(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('[usePlanClosures] erro:', err);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [planId]);

  return { closures, loading };
}

export default usePlanClosures;
