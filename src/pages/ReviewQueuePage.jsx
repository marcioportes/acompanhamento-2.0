/**
 * ReviewQueuePage
 * @version 1.0.0 (v1.33.0)
 * @description Fila de Revisão (issue #102, Fase C/D — sidebar dedicada ao mentor).
 *
 * Fluxo:
 *   1. Lista alunos ativos com contagem de revisões por status (DRAFT/CLOSED/ARCHIVED).
 *   2. Expand de aluno carrega reviews dele via onSnapshot (subcollection).
 *   3. Click em revisão abre WeeklyReviewModal.
 */

import { useEffect, useState, useMemo } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { ClipboardCheck, ChevronDown, ChevronRight, Clock, CheckCircle2, Archive, Loader2, Search, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import WeeklyReviewModal from '../components/reviews/WeeklyReviewModal';
import DebugBadge from '../components/DebugBadge';

const statusColor = {
  DRAFT: 'text-amber-400',
  CLOSED: 'text-emerald-400',
  ARCHIVED: 'text-slate-500',
};
const statusLabel = {
  DRAFT: 'Rascunho',
  CLOSED: 'Publicada',
  ARCHIVED: 'Arquivada',
};

const StudentRow = ({ student, expanded, onToggle, onOpenReview }) => {
  const [reviews, setReviews] = useState([]);
  const [plansById, setPlansById] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!expanded || !student?.id) return undefined;
    setLoading(true);
    const q = query(
      collection(db, 'students', student.id, 'reviews'),
      orderBy('weekStart', 'desc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [expanded, student?.id]);

  // Mapa planId → plan (para mostrar nome do plano em cada revisão, já que um aluno
  // pode ter múltiplos planos e cada um tem seu rascunho — per-plano é por design).
  useEffect(() => {
    if (!expanded || !student?.id) return undefined;
    const q = query(collection(db, 'plans'), where('studentId', '==', student.id));
    const unsub = onSnapshot(q, (snap) => {
      const map = {};
      for (const d of snap.docs) map[d.id] = { id: d.id, ...d.data() };
      setPlansById(map);
    });
    return () => unsub();
  }, [expanded, student?.id]);

  const counts = useMemo(() => {
    const c = { DRAFT: 0, CLOSED: 0, ARCHIVED: 0 };
    for (const r of reviews) if (c[r.status] != null) c[r.status] += 1;
    return c;
  }, [reviews]);

  return (
    <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/40">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/40"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
          <span className="text-sm font-medium text-white">{student.name || student.email}</span>
        </div>
        {expanded && (
          <div className="flex items-center gap-3 text-xs">
            {counts.DRAFT > 0 && <span className="text-amber-400">{counts.DRAFT} rascunho</span>}
            {counts.CLOSED > 0 && <span className="text-emerald-400">{counts.CLOSED} publicada</span>}
            {counts.ARCHIVED > 0 && <span className="text-slate-500">{counts.ARCHIVED} arquivada</span>}
          </div>
        )}
      </button>

      {expanded && (
        <div className="border-t border-slate-800 px-4 py-2">
          {loading && (
            <div className="py-3 flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="w-3 h-3 animate-spin" /> Carregando revisões...
            </div>
          )}
          {!loading && reviews.length === 0 && (
            <div className="py-3 text-xs text-slate-500 italic">Nenhuma revisão ainda.</div>
          )}
          {!loading && reviews.length > 0 && (
            <div className="divide-y divide-slate-800/60">
              {reviews.map(r => {
                const planId = r.planId || r.frozenSnapshot?.planContext?.planId;
                const planName = plansById[planId]?.name || planId || '—';
                return (
                  <button
                    key={r.id}
                    onClick={() => onOpenReview(student, r)}
                    className="w-full flex items-center justify-between py-2 text-xs hover:bg-slate-800/30 px-1 rounded"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {r.status === 'DRAFT' && <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                      {r.status === 'CLOSED' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                      {r.status === 'ARCHIVED' && <Archive className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                      <span className="text-emerald-300 font-medium truncate max-w-[200px]" title={planName}>{planName}</span>
                      <span className="text-slate-600">·</span>
                      <span className="font-mono text-slate-400">{r.periodKey}</span>
                      <span className="text-slate-500 hidden md:inline">{r.weekStart} → {r.weekEnd}</span>
                    </div>
                    <span className={statusColor[r.status] || 'text-slate-400'}>{statusLabel[r.status] || r.status}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ReviewQueuePage = () => {
  const { isMentor } = useAuth();
  const mentor = typeof isMentor === 'function' ? isMentor() : Boolean(isMentor);

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  // Guarda IDs — modal escuta o doc via onSnapshot pra refletir updates (SWOT, etc).
  const [openReview, setOpenReview] = useState(null); // { studentId, reviewId }
  const [search, setSearch] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'students'));
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(s => s.status !== 'inactive')
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setStudents(items);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (!mentor) {
    return (
      <div className="p-6 text-sm text-slate-400">
        Página restrita ao mentor.
        <DebugBadge component="ReviewQueuePage" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 bg-emerald-500/10 rounded-lg">
          <ClipboardCheck className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Fila de Revisão</h1>
          <p className="text-xs text-slate-400">Revisões semanais por aluno · crie novas revisões a partir do extrato do plano.</p>
        </div>
      </div>

      {!loading && students.length > 0 && (
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar aluno por nome ou email..."
            className="w-full pl-9 pr-9 py-2 text-xs bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {loading && (
        <div className="text-xs text-slate-500 flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" /> Carregando alunos...
        </div>
      )}

      {!loading && students.length === 0 && (
        <div className="text-xs text-slate-500 italic">Nenhum aluno ativo.</div>
      )}

      {!loading && students.length > 0 && (() => {
        const term = search.trim().toLowerCase();
        const filtered = term
          ? students.filter(s =>
              (s.name || '').toLowerCase().includes(term) ||
              (s.email || '').toLowerCase().includes(term)
            )
          : students;
        if (filtered.length === 0) {
          return <div className="text-xs text-slate-500 italic">Nenhum aluno para "{search}".</div>;
        }
        return (
          <div className="space-y-2">
            {filtered.map(s => (
              <StudentRow
                key={s.id}
                student={s}
                expanded={expandedId === s.id}
                onToggle={() => setExpandedId(prev => prev === s.id ? null : s.id)}
                onOpenReview={(student, review) => setOpenReview({ studentId: student.id, reviewId: review.id })}
              />
            ))}
          </div>
        );
      })()}

      {openReview && (
        <WeeklyReviewModal
          reviewId={openReview.reviewId}
          studentId={openReview.studentId}
          previousReview={null}
          onClose={() => setOpenReview(null)}
        />
      )}

      <DebugBadge component="ReviewQueuePage" />
    </div>
  );
};

export default ReviewQueuePage;
