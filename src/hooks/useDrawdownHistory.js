/**
 * useDrawdownHistory
 * @description Leitura da subcollection accounts/{id}/drawdownHistory.
 *   Query condicional: só dispara se accountId é fornecido.
 *   Ordenado por createdAt desc, limit 100 docs mais recentes.
 *   Retorna array ordenado cronologicamente (asc) para sparkline.
 *
 * Ref: issue #134 Fase C, epic #52
 */

import { useState, useEffect } from 'react';
import {
  collection, query, orderBy, limit, onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';

const MAX_DOCS = 100;

/**
 * @param {string|null} accountId - ID da conta PROP (null = não carrega)
 * @returns {{ history: Array, loading: boolean }}
 */
export function useDrawdownHistory(accountId) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!accountId) {
      setHistory([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const colRef = collection(db, 'accounts', accountId, 'drawdownHistory');
    const q = query(colRef, orderBy('createdAt', 'desc'), limit(MAX_DOCS));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data(),
        }));
        // Reverse to chronological order (asc) for sparkline
        docs.reverse();
        setHistory(docs);
        setLoading(false);
      },
      (err) => {
        console.error('[useDrawdownHistory] Error:', err);
        setHistory([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [accountId]);

  return { history, loading };
}
