/**
 * useStudents — issue #263 (caminho α)
 * @description Listener real-time da collection /students. Retorna a lista
 *   completa ordenada por nome. Usado por:
 *   - Acompanhamento (com filtro classifyStudent: só Alpha/Espelho ativos)
 *   - SubscriptionsPage aba "Alunos" (sem filtro: TODOS, incl. órfãos/fantasmas)
 *
 * Source: /students/{uid}
 */

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase';

export const useStudents = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'students'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setStudents(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { students, loading };
};
