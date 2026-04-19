/**
 * useDrawdownHistory
 * @description Leitura da subcollection accounts/{id}/drawdownHistory.
 *   Query condicional: só dispara se accountId é fornecido.
 *   Ordenado por createdAt desc, limit configurável (default DEFAULT_LIMIT).
 *   Retorna array ordenado cronologicamente (asc) para plotagem.
 *
 * Ref: issue #134 Fase C (criação), issue #145 Fase E (limit 100→1000 para equity curve)
 */

import { useState, useEffect } from 'react';
import {
  collection, query, orderBy, limit, onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';

export const DEFAULT_LIMIT = 1000;

/**
 * @param {string|null} accountId - ID da conta PROP (null = não carrega)
 * @param {object} [options]
 * @param {number} [options.limit=DEFAULT_LIMIT] - Max docs carregados (override p/ sparkline/card pequeno)
 * @returns {{ history: Array, loading: boolean }}
 */
export function useDrawdownHistory(accountId, options = {}) {
  const maxDocs = options.limit ?? DEFAULT_LIMIT;
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
    const q = query(colRef, orderBy('createdAt', 'desc'), limit(maxDocs));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data(),
        }));
        // Reverse to chronological order (asc) for plotting
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
  }, [accountId, maxDocs]);

  return { history, loading };
}
