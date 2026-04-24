/**
 * useMaturity
 * @description Listener real-time do snapshot de maturidade do aluno em
 *              `students/{studentId}/maturity/current`. Retorna `null` enquanto
 *              carrega ou quando o doc ainda não existe (motor nunca rodou).
 *
 * Ref: issue #119 task 08 (Fase B — hooks de consumo).
 *      Schema do doc em `src/utils/maturityEngine/maturityDocSchema.js` (D10 §3.1).
 *
 * @param {string|null} studentId - UID do aluno. Null/undefined → não dispara listener.
 * @returns {{ maturity: Object|null, loading: boolean, error: Error|null }}
 */

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export function useMaturity(studentId) {
  const [maturity, setMaturity] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!studentId) {
      setMaturity(null);
      setLoading(false);
      setError(null);
      return undefined;
    }

    setLoading(true);
    setError(null);

    const ref = doc(db, 'students', studentId, 'maturity', 'current');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setMaturity(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setLoading(false);
      },
      (err) => {
        console.error('[useMaturity] Error:', err);
        setError(err instanceof Error ? err : new Error(err?.message ?? 'Erro ao carregar maturidade'));
        setMaturity(null);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [studentId]);

  return { maturity, loading, error };
}

export default useMaturity;
