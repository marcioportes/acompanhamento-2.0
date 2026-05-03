/**
 * useContacts — issue #237 F4
 *
 * Hook real-time para `contacts/` collection (SSoT de pessoas).
 * Mentor-only — rules barram aluno (exceto leitura do próprio doc).
 */

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

const toDate = (val) => {
  if (!val) return null;
  if (typeof val.toDate === 'function') return val.toDate();
  if (val instanceof Date) return val;
  return new Date(val);
};

export function useContacts() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'contacts'), orderBy('nameNormalized', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            subscription: data.subscription
              ? {
                  ...data.subscription,
                  since: toDate(data.subscription.since),
                  endsAt: toDate(data.subscription.endsAt),
                }
              : null,
            createdAt: toDate(data.createdAt),
            updatedAt: toDate(data.updatedAt),
          };
        });
        setContacts(list);
        setLoading(false);
      },
      (err) => {
        console.error('[useContacts] erro:', err);
        setError(err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  return { contacts, loading, error };
}
