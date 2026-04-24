/**
 * useRecomputeStudentMaturity.js
 * @description Hook para disparar a CF callable `recomputeStudentMaturity`.
 *              Permite aluno (próprio) ou mentor forçar recálculo de maturidade
 *              sem depender de um trade novo. Rate limit 1×/hora por caller.
 * @see Issue #119 task 20 (H1)
 */

import { useState, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

export const useRecomputeStudentMaturity = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [throttled, setThrottled] = useState(false);
  const [nextAllowedAt, setNextAllowedAt] = useState(null);
  const [lastResult, setLastResult] = useState(null);

  const recompute = useCallback(async (studentId) => {
    if (!studentId || typeof studentId !== 'string') {
      const err = new Error('studentId é obrigatório');
      setError(err);
      throw err;
    }

    setLoading(true);
    setError(null);
    setThrottled(false);
    setNextAllowedAt(null);

    try {
      const cf = httpsCallable(functions, 'recomputeStudentMaturity');
      const { data } = await cf({ studentId });

      if (data?.throttled) {
        setThrottled(true);
        setNextAllowedAt(data.nextAllowedAt ?? null);
        setLastResult(data);
        return data;
      }

      setLastResult(data);
      return data;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { recompute, loading, error, throttled, nextAllowedAt, lastResult };
};

export default useRecomputeStudentMaturity;
