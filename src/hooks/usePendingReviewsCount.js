/**
 * usePendingReviewsCount — rascunhos de revisão abertos, por aluno (issue #144, B2)
 *
 * Extraído do `PendingReviewsCard`, que morreu quando a faixa "Minhas Pendências"
 * da Torre passou a ser a lista única das três caixas do mentor. A contagem
 * continua sendo um listener por aluno: o mentor tem ~10, e a alternativa seria
 * um índice novo de collection group (`status` + `weekStart`) para uma tela só.
 *
 * Devolve `{ total, porAluno, alunosComRascunho }` — quem exibe decide o texto.
 */
import { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';

export const usePendingReviewsCount = (students = []) => {
  const [porAluno, setPorAluno] = useState({});

  // Só aluno com studentId dá para assinar; `getUniqueStudents` devolve o id
  // quando o trade tem, e alunos legados podem não ter.
  const ids = useMemo(
    () => students.filter((s) => s?.studentId).map((s) => s.studentId).sort().join('|'),
    [students],
  );

  useEffect(() => {
    if (!ids) {
      setPorAluno({});
      return undefined;
    }
    const unsubs = ids.split('|').map((studentId) => {
      const q = query(collection(db, 'students', studentId, 'reviews'), where('status', '==', 'DRAFT'));
      return onSnapshot(
        q,
        (snap) => setPorAluno((prev) => ({ ...prev, [studentId]: snap.size })),
        () => setPorAluno((prev) => ({ ...prev, [studentId]: 0 })),
      );
    });
    return () => unsubs.forEach((u) => u());
  }, [ids]);

  const alunosComRascunho = students.filter((s) => (porAluno[s?.studentId] || 0) > 0);
  const total = alunosComRascunho.reduce((soma, s) => soma + (porAluno[s.studentId] || 0), 0);

  return { total, porAluno, alunosComRascunho };
};

export default usePendingReviewsCount;
