/**
 * usePayments — issue #252 (sucessor de useCurrentMonthPayments do #250)
 * @description Listener real-time do collection group `payments`. Retorna a
 *   lista bruta enriched com `studentId` (derivado do path); a agregação por
 *   mês é responsabilidade do caller via `aggregatePaymentsForMonth`.
 *
 * Source: students/{uid}/subscriptions/{subId}/payments/{pid}
 */

import { useState, useEffect } from 'react';
import { collectionGroup, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

export const usePayments = () => {
  const { user, isMentor } = useAuth();
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    if (!user || !isMentor()) {
      setPayments([]);
      return;
    }
    const q = query(collectionGroup(db, 'payments'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => {
        const segments = d.ref.path.split('/');
        return { id: d.id, studentId: segments[1], ...d.data() };
      });
      setPayments(data);
    });
    return () => unsubscribe();
  }, [user, isMentor]);

  return payments;
};
