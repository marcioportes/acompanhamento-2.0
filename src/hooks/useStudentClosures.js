/**
 * useStudentClosures.js — timeline de capítulos do aluno (cycleClosures).
 *
 * Lista cycleClosures (status CLOSED ou REOPENED) do aluno, ordenado desc
 * por cycleEnd (mais recente primeiro). Usado pelo card "Capítulo N" no perfil.
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo) — A9.
 */

import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

export function useStudentClosures(studentId) {
  const [closures, setClosures] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!studentId) {
      setClosures([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const q = query(
      collection(db, 'cycleClosures'),
      where('studentId', '==', studentId),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // Ordena desc por cycleEnd (mais recente primeiro)
        list.sort((a, b) => (b.cycleEnd || '').localeCompare(a.cycleEnd || ''));
        setClosures(list);
        setLoading(false);
      },
      (err) => {
        console.error('[useStudentClosures] erro:', err);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [studentId]);

  return { closures, loading };
}

export default useStudentClosures;
