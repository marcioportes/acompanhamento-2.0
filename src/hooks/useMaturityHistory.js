/**
 * useMaturityHistory
 * @description Query real-time dos últimos `days` registros diários de maturidade.
 *              Path canônico (DEC-AUTO-119-06):
 *              `students/{studentId}/maturity/_historyBucket/history/{YYYY-MM-DD}`.
 *              Retorna docs em ordem cronológica asc (prontos para plotagem).
 *
 * Ref: issue #119 task 08 (Fase B — hooks de consumo).
 *
 * @param {string|null} studentId - UID do aluno. Null/undefined → não dispara listener.
 * @param {number} [days=90] - Janela em dias. Cutoff = hoje (UTC) - days.
 * @returns {{ history: Array, loading: boolean, error: Error|null }}
 */

import { useState, useEffect, useMemo } from 'react';
import {
  collection, query, where, orderBy, limit, onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';

export function useMaturityHistory(studentId, days = 90) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const cutoffDate = useMemo(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - days);
    return d.toISOString().slice(0, 10);
  }, [days]);

  useEffect(() => {
    if (!studentId) {
      setHistory([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    setLoading(true);
    setError(null);

    const colRef = collection(
      db, 'students', studentId, 'maturity', '_historyBucket', 'history'
    );
    const q = query(
      colRef,
      where('date', '>=', cutoffDate),
      orderBy('date', 'asc'),
      limit(400)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('[useMaturityHistory] Error:', err);
        setError(err instanceof Error ? err : new Error(err?.message ?? 'Erro ao carregar histórico de maturidade'));
        setHistory([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [studentId, cutoffDate]);

  return { history, loading, error };
}

export default useMaturityHistory;
