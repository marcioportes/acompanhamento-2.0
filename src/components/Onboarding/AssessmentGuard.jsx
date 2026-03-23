/**
 * AssessmentGuard.jsx
 * 
 * Guard que redireciona o aluno para o assessment quando requiresAssessment === true
 * e o assessment não está completo (onboardingStatus !== 'active').
 * 
 * DEC-023: Mentor marca flag → aluno redirecionado até completar.
 * 
 * Uso no StudentDashboard:
 *   <AssessmentGuard studentId={studentId}>
 *     <StudentDashboard ... />
 *   </AssessmentGuard>
 * 
 * Ou como check no início do StudentDashboard:
 *   const shouldRedirect = useAssessmentGuard(studentId);
 *   if (shouldRedirect) return <Navigate to={`/onboarding/${studentId}`} />;
 * 
 * @version 1.0.0 — CHUNK-09 Fase A
 */

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Hook que verifica se o aluno deve ser redirecionado para o assessment.
 * 
 * @param {string} studentId
 * @returns {{ shouldRedirect: boolean, loading: boolean, onboardingStatus: string|null }}
 */
export function useAssessmentGuard(studentId) {
  const [state, setState] = useState({
    shouldRedirect: false,
    loading: true,
    onboardingStatus: null,
  });

  useEffect(() => {
    if (!studentId) {
      setState({ shouldRedirect: false, loading: false, onboardingStatus: null });
      return;
    }

    const studentRef = doc(db, 'students', studentId);
    const unsubscribe = onSnapshot(studentRef, (snap) => {
      if (!snap.exists()) {
        setState({ shouldRedirect: false, loading: false, onboardingStatus: null });
        return;
      }

      const data = snap.data();
      const requiresAssessment = data.requiresAssessment === true;
      const status = data.onboardingStatus || null;
      const isComplete = status === 'active' || status === 'mentor_validated';

      setState({
        shouldRedirect: requiresAssessment && !isComplete,
        loading: false,
        onboardingStatus: status,
      });
    }, (err) => {
      console.error('AssessmentGuard listener error:', err);
      setState({ shouldRedirect: false, loading: false, onboardingStatus: null });
    });

    return () => unsubscribe();
  }, [studentId]);

  return state;
}
