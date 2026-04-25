/**
 * ReviewQueuePage
 * @version 2.0.0 (v1.33.0)
 * @description Fila de Revisão (issue #102, Fase C/D — sidebar dedicada ao mentor).
 *
 * Fluxo:
 *   1. Lista alunos ativos com contagem de revisões por status (DRAFT/CLOSED/ARCHIVED).
 *   2. Expand de aluno carrega reviews dele via onSnapshot (subcollection).
 *   3. Click em revisão navega para o extrato do plano em mode='review'
 *      (via onOpenReviewInLedger — prop injetada do App).
 */

import { useEffect, useState, useMemo, useCallback } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { ClipboardCheck, ChevronDown, ChevronRight, Clock, CheckCircle2, Archive, Loader2, Search, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
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

// Probe invisível — subscribe à contagem de revisões do aluno em determinado status.
// Permite ao pai filtrar a lista por DRAFT (default) ou DRAFT+CLOSED (toggle issue #197).
const StudentStatusProbe = ({ studentId, status, onCount }) => {
  useEffect(() => {
    if (!studentId) return undefined;
    const q = query(
      collection(db, 'students', studentId, 'reviews'),
      where('status', '==', status),
    );
    const unsub = onSnapshot(q, (snap) => onCount(studentId, status, snap.size));
    return () => unsub();
  }, [studentId, status, onCount]);
  return null;
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

const ReviewQueuePage = ({ onOpenReviewInLedger = null, onOpenWeeklyReview = null }) => {
  const { isMentor } = useAuth();
  const mentor = typeof isMentor === 'function' ? isMentor() : Boolean(isMentor);

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [search, setSearch] = useState('');
  // Contagens por aluno — usadas para filtrar quem aparece na fila.
  // draftCounts: rascunhos abertos (default da fila).
  // closedCounts: revisões publicadas (issue #197 — toggle "Incluir publicadas").
  const [draftCounts, setDraftCounts] = useState({});
  const [closedCounts, setClosedCounts] = useState({});
  const [includePublished, setIncludePublished] = useState(false);
  // Flag para saber se ao menos 1 probe já respondeu (evita "sem rascunhos" flashing).
  const [probesReady, setProbesReady] = useState(false);
  const handleStatusCount = useCallback((studentId, status, count) => {
    const setter = status === 'DRAFT' ? setDraftCounts
      : status === 'CLOSED' ? setClosedCounts
      : null;
    if (!setter) return;
    setter(prev => {
      if (prev[studentId] === count) return prev;
      return { ...prev, [studentId]: count };
    });
    setProbesReady(true);
  }, []);

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

  // Filtro: por padrão, só alunos com DRAFT. Com includePublished, soma quem tem CLOSED.
  // Issue #197 — sem o toggle, mentor que publicou tudo fica sem acesso para atualizar
  // link de reunião/gravação após CLOSED.
  const studentsToShow = useMemo(
    () => students.filter(s => {
      const draft = draftCounts[s.id] || 0;
      const closed = closedCounts[s.id] || 0;
      return draft > 0 || (includePublished && closed > 0);
    }),
    [students, draftCounts, closedCounts, includePublished]
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Probes invisíveis — 1 por aluno por status. Alimentam draftCounts/closedCounts. */}
      {students.map(s => (
        <StudentStatusProbe key={`probe-d-${s.id}`} studentId={s.id} status="DRAFT" onCount={handleStatusCount} />
      ))}
      {includePublished && students.map(s => (
        <StudentStatusProbe key={`probe-c-${s.id}`} studentId={s.id} status="CLOSED" onCount={handleStatusCount} />
      ))}

      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 bg-emerald-500/10 rounded-lg">
          <ClipboardCheck className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white">Fila de Revisão</h1>
          <p className="text-xs text-slate-400">
            {includePublished
              ? 'Alunos com rascunho aberto ou revisões publicadas. Atualize links de reunião/gravação direto na revisão.'
              : 'Apenas alunos com rascunho aberto. Crie novas revisões a partir do extrato do plano.'}
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none whitespace-nowrap">
          <input
            type="checkbox"
            checked={includePublished}
            onChange={(e) => setIncludePublished(e.target.checked)}
            className="w-3.5 h-3.5 accent-emerald-500"
          />
          Incluir publicadas
        </label>
      </div>

      {!loading && studentsToShow.length > 0 && (
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

      {!loading && students.length > 0 && !probesReady && (
        <div className="text-xs text-slate-500 flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" /> Verificando rascunhos...
        </div>
      )}

      {!loading && students.length > 0 && probesReady && studentsToShow.length === 0 && (
        <div className="text-xs text-slate-500 italic py-6 text-center">
          {includePublished
            ? 'Nenhum aluno tem rascunho ou revisão publicada no momento.'
            : 'Nenhum aluno tem rascunho aberto no momento.'}
          <div className="text-[11px] mt-1">
            {includePublished
              ? 'Crie um pelo extrato do plano ({\'>\'} "Nova Revisão" ou pin de trade no feedback).'
              : <>Crie um pelo extrato do plano ({'>'} "Nova Revisão" ou pin de trade no feedback) ou marque <em>Incluir publicadas</em> acima para revisitar revisões já publicadas.</>}
          </div>
        </div>
      )}

      {!loading && probesReady && studentsToShow.length > 0 && (() => {
        const term = search.trim().toLowerCase();
        const filtered = term
          ? studentsToShow.filter(s =>
              (s.name || '').toLowerCase().includes(term) ||
              (s.email || '').toLowerCase().includes(term)
            )
          : studentsToShow;
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
                onOpenReview={(student, review) => {
                  // Entry point da tela nova (Stage 1): Fila > aluno > rascunho → WeeklyReviewPage.
                  // Fallback para PlanLedgerExtract 3-col (baseline) se o handler novo não existe.
                  if (onOpenWeeklyReview) {
                    onOpenWeeklyReview({ studentId: student.id, reviewId: review.id });
                    return;
                  }
                  const planId = review.planId || review.frozenSnapshot?.planContext?.planId;
                  if (onOpenReviewInLedger && planId) {
                    onOpenReviewInLedger({ planId, reviewId: review.id });
                  }
                }}
              />
            ))}
          </div>
        );
      })()}

      <DebugBadge component="ReviewQueuePage" />
    </div>
  );
};

export default ReviewQueuePage;
