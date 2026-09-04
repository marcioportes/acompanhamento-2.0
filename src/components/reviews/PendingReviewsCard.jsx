/**
 * PendingReviewsCard
 * @version 1.0.0 (v1.33.0) — Fase D, trigger secundário G8
 * @description Card no MentorDashboard com contagem de rascunhos (DRAFT) abertos
 *              cross-student. Trigger secundário da Fila de Revisão — o primário
 *              é o item de sidebar "Revisões".
 *
 * Não renderiza quando não há rascunhos (zero-state silencioso). Click leva
 * à Fila de Revisão.
 */

import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { FileText, ChevronRight } from 'lucide-react';

/**
 * Um listener por aluno — mentor tipicamente tem ~10 alunos, custo aceitável.
 * Evita índice novo (collectionGroup reviews status+weekStart em COLLECTION_GROUP
 * scope). Usa o índice COLLECTION já existente.
 */
const StudentDraftProbe = ({ studentId, onCount }) => {
  useEffect(() => {
    if (!studentId) return undefined;
    const q = query(
      collection(db, 'students', studentId, 'reviews'),
      where('status', '==', 'DRAFT')
    );
    const unsub = onSnapshot(
      q,
      (snap) => onCount(studentId, snap.size),
      () => onCount(studentId, 0)
    );
    return () => unsub();
  }, [studentId, onCount]);
  return null;
};

const PendingReviewsCard = ({ students = [], onOpenReviewQueue }) => {
  const [counts, setCounts] = useState({});

  const handleCount = (studentId, n) => {
    setCounts(prev => ({ ...prev, [studentId]: n }));
  };

  // Filtra só alunos com studentId válido — getUniqueStudents retorna o shape
  // {email, name, studentId}. Sem studentId não há como subscribe no Firestore.
  const validStudents = students.filter(s => s.studentId);
  const studentsWithDraft = validStudents.filter(s => (counts[s.studentId] || 0) > 0);
  const total = studentsWithDraft.reduce((sum, s) => sum + (counts[s.studentId] || 0), 0);

  const probes = validStudents.map(s => (
    <StudentDraftProbe key={s.studentId} studentId={s.studentId} onCount={handleCount} />
  ));

  // Zero-state silencioso: se nenhum aluno tem DRAFT, só mantém os probes vivos
  // (para reagir a novo rascunho em tempo real) e não renderiza o card.
  if (studentsWithDraft.length === 0) return <>{probes}</>;

  return (
    <>
      {probes}
      <button
        onClick={onOpenReviewQueue}
        className="glass-card w-full p-4 mb-8 flex items-center gap-3 hover:bg-slate-800/40 transition text-left"
      >
        <div className="p-2 bg-amber-500/10 rounded-lg shrink-0">
          <FileText className="w-5 h-5 text-amber-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">Revisões pendentes</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-medium">
              {total} {total === 1 ? 'rascunho' : 'rascunhos'}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {studentsWithDraft.length === 1
              ? `${studentsWithDraft[0].name || studentsWithDraft[0].email} · ${counts[studentsWithDraft[0].studentId]} rascunho(s) para publicar`
              : `${studentsWithDraft.length} alunos com rascunhos — abrir Fila de Revisão para continuar`}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
      </button>
    </>
  );
};

export default PendingReviewsCard;
