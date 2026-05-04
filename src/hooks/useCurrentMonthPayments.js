/**
 * useCurrentMonthPayments — issue #250
 * @description Listener real-time do collection group `payments`, agrega o mês corrente.
 *
 * Source: students/{uid}/subscriptions/{subId}/payments/{pid}
 * Mês corrente = `new Date()` na timezone do browser (assume mentor em BR).
 */

import { useState, useEffect, useMemo } from 'react';
import { collectionGroup, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { aggregatePaymentsForMonth } from '../utils/monthlyPayments';

export const useCurrentMonthPayments = (studentsMap) => {
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

  const summary = useMemo(() => {
    const now = new Date();
    return aggregatePaymentsForMonth(payments, now.getFullYear(), now.getMonth(), studentsMap);
  }, [payments, studentsMap]);

  return summary;
};
