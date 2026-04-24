/**
 * useMentorMaturityOverview
 * @description Batch listener de `maturity/current` de todos os alunos via
 *              `collectionGroup('maturity')` — single subscription em vez de N
 *              listeners paralelos. Usado na MentorDashboard (Torre de
 *              Controle) para pintar o semáforo de maturidade ao lado do nome
 *              de cada aluno.
 *
 * Ref: issue #119 task 17 — Fase F (Mentor).
 *      Rules DEC-AUTO-119-05 permitem read em `students/{uid}/maturity/{docId=**}`
 *      para mentor autenticado.
 *
 * @param {boolean} enabled - se false, não dispara listener (default: true)
 * @returns {{ map: Map<string, Object>, loading: boolean, error: Error|null }}
 *   map: chave = studentId (uid), valor = doc com { id, ...data }
 */

import { useState, useEffect } from 'react';
import { collectionGroup, query, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export function useMentorMaturityOverview(enabled = true) {
  const [map, setMap] = useState(() => new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) {
      setMap(new Map());
      setLoading(false);
      setError(null);
      return undefined;
    }

    setLoading(true);
    setError(null);

    const q = query(collectionGroup(db, 'maturity'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = new Map();
        for (const d of snap.docs) {
          if (d.id !== 'current') continue;
          const parentId = d.ref.parent.parent?.id;
          if (!parentId) continue;
          next.set(parentId, { id: d.id, ...d.data() });
        }
        setMap(next);
        setLoading(false);
      },
      (err) => {
        console.error('[useMentorMaturityOverview] Error:', err);
        setError(err instanceof Error ? err : new Error(err?.message ?? 'Erro ao carregar overview de maturidade'));
        setMap(new Map());
        setLoading(false);
      }
    );

    return () => unsub();
  }, [enabled]);

  return { map, loading, error };
}

export default useMentorMaturityOverview;
