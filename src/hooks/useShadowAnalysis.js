/**
 * useShadowAnalysis.js
 * @description Hook para disparar a CF callable `analyzeShadowBehavior`.
 *              Mentor-only. Analisa trades do aluno em um periodo.
 * @see Issue #129 — Shadow Trade + Padroes Comportamentais
 */

import { useState, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

export const useShadowAnalysis = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastResult, setLastResult] = useState(null);

  const analyze = useCallback(async ({ studentId, dateFrom = null, dateTo = null }) => {
    if (!studentId) {
      const err = new Error('studentId é obrigatório');
      setError(err);
      throw err;
    }

    setLoading(true);
    setError(null);

    try {
      const cf = httpsCallable(functions, 'analyzeShadowBehavior');
      const { data } = await cf({ studentId, dateFrom, dateTo });
      setLastResult(data);
      return data;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { analyze, loading, error, lastResult };
};
