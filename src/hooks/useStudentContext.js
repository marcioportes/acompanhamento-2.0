/**
 * useStudentContext.js
 * @description Hook consumidor do StudentContextProvider.
 *              Use em qualquer view do Dashboard-Aluno para ler conta/plano/ciclo/período
 *              e disparar setAccount/setPlan/setCycleKey/setPeriodKind.
 *
 * @see Issue #118 — Barra de Contexto Unificado
 */

import { useContext } from 'react';
import { StudentContext } from '../contexts/StudentContextProvider.jsx';

export const useStudentContext = () => {
  const ctx = useContext(StudentContext);
  if (ctx === null) {
    throw new Error('useStudentContext deve ser usado dentro de <StudentContextProvider>');
  }
  return ctx;
};

export default useStudentContext;
