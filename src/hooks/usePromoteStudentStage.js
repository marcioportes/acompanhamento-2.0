/**
 * usePromoteStudentStage.js
 * @description Hook para a CF callable `promoteStudentStage` — o ato de promover um
 *              aluno de estágio. Mentor-only; o servidor revalida a prontidão.
 * @see Issue #376 — "avisa da promoção tanto para o aluno quanto para mim, e eu faço
 *      a promoção avisando o aluno" (Marcio, 23/08/2026).
 */

import { useState, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

export const usePromoteStudentStage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastResult, setLastResult] = useState(null);

  const promote = useCallback(async (studentId) => {
    if (!studentId || typeof studentId !== 'string') {
      const err = new Error('studentId é obrigatório');
      setError(err);
      throw err;
    }

    setLoading(true);
    setError(null);

    try {
      const cf = httpsCallable(functions, 'promoteStudentStage');
      const { data } = await cf({ studentId });
      setLastResult(data);
      return data;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { promote, loading, error, lastResult };
};

export default usePromoteStudentStage;
