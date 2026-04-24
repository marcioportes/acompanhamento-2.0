/**
 * StudentReviewsPage
 * @description Tela somente-leitura onde o aluno vê suas revisões semanais
 *              já publicadas (CLOSED + ARCHIVED). Issue #119 task 25 (J1) + task 28.
 *
 *              Seções do detalhe (espelho READ-ONLY do WeeklyReviewPage mentor):
 *              1. KPIs congelados (`ReviewKpiGrid`) com delta vs revisão anterior
 *              2. Trades revisados (`ReviewTradesSection`) com link por linha para FeedbackPage
 *              3. Takeaways (abertos + fechados) — aluno pode marcar "feito por mim"
 *              4. Comparativo maturidade 4D (`MaturityComparisonSection`)
 *              5. Notas do mentor
 *
 *              Sem Action Footer Publicar/Arquivar, sem edit de takeaways,
 *              sem PinToReviewButton.
 */

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, CheckSquare, Square, Lock } from 'lucide-react';
import DebugBadge from '../components/DebugBadge';
import MaturityComparisonSection from '../components/reviews/MaturityComparisonSection';
import ReviewKpiGrid from '../components/reviews/ReviewKpiGrid';
import ReviewTradesSection from '../components/reviews/ReviewTradesSection';
import { useAuth } from '../contexts/AuthContext';
import { useWeeklyReviews } from '../hooks/useWeeklyReviews';
import { useReviewMaturitySnapshot } from '../hooks/useReviewMaturitySnapshot';
import { fmtDateBR, statusBadge, getPreviousReview } from '../utils/reviewFormatters';

const getPlanIdFromReview = (review) =>
  review?.planId || review?.frozenSnapshot?.planContext?.planId || null;

const getCurrencyFromReview = (review) =>
  review?.frozenSnapshot?.currency
  || review?.frozenSnapshot?.planContext?.currency
  || 'USD';

const TakeawayRow = ({ item, mentorDone, alunoDone, onToggle, disabled }) => (
  <li className="flex items-start gap-2 py-1.5">
    <button
      type="button"
      onClick={() => onToggle(item.id, !alunoDone)}
      disabled={disabled}
      aria-label={alunoDone ? 'Desmarcar como feito por mim' : 'Marcar como feito por mim'}
      aria-pressed={alunoDone}
      className="shrink-0 mt-0.5 text-slate-300 hover:text-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {alunoDone
        ? <CheckSquare className="w-4 h-4 text-emerald-400" />
        : <Square className="w-4 h-4" />}
    </button>
    <div className="flex-1 min-w-0">
      <div className={`text-sm ${alunoDone ? 'text-slate-400 line-through' : 'text-slate-200'}`}>
        {item.text}
      </div>
      {mentorDone && (
        <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-emerald-400/80">
          <Lock className="w-3 h-3" /> encerrado pelo mentor
        </div>
      )}
    </div>
  </li>
);

const ReviewDetail = ({
  review,
  allReviews,
  studentId,
  onToggleAlunoDone,
  onNavigateToFeedback,
  actionLoading,
}) => {
  const planId = getPlanIdFromReview(review);
  const currency = getCurrencyFromReview(review);
  const previousReview = useMemo(
    () => getPreviousReview(allReviews || [], review, planId),
    [allReviews, review, planId],
  );

  const {
    current: maturityCurrent,
    previous: maturityPrevious,
    loading: maturityLoading,
    error: maturityError,
  } = useReviewMaturitySnapshot(studentId, review, planId);

  const items = Array.isArray(review.takeawayItems) ? review.takeawayItems : [];
  const alunoIds = Array.isArray(review.alunoDoneIds) ? review.alunoDoneIds : [];
  const hasFrozenSnapshot = Boolean(review?.frozenSnapshot?.maturitySnapshot);
  const sessionNotes = typeof review?.sessionNotes === 'string' ? review.sessionNotes : '';
  const kpis = review?.frozenSnapshot?.kpis;
  const prevKpis = previousReview?.frozenSnapshot?.kpis;
  const periodTrades = review?.frozenSnapshot?.periodTrades;

  return (
    <div className="px-4 pb-4 pt-1 border-t border-slate-800/60 space-y-4">
      {/* 1 — KPIs congelados com delta vs revisão anterior */}
      <section>
        <h3 className="text-sm font-semibold text-slate-200 mb-2">
          Indicadores congelados
          {previousReview && (
            <span className="ml-2 text-[11px] font-normal text-slate-500">
              vs revisão de {fmtDateBR(previousReview.weekStart)}
            </span>
          )}
          {!previousReview && (
            <span className="ml-2 text-[11px] font-normal text-slate-500">primeira revisão</span>
          )}
        </h3>
        <ReviewKpiGrid kpis={kpis} prevKpis={prevKpis} currency={currency} />
      </section>

      {/* 2 — Trades revisados com link para FeedbackPage */}
      <section>
        <h3 className="text-sm font-semibold text-slate-200 mb-2">Trades revisados</h3>
        <ReviewTradesSection
          trades={periodTrades}
          currency={currency}
          weekStart={review.weekStart}
          weekEnd={review.weekEnd}
          onNavigateToFeedback={onNavigateToFeedback}
        />
      </section>

      {/* 3 — Takeaways */}
      <section>
        <h3 className="text-sm font-semibold text-slate-200 mb-2">Takeaways</h3>
        {items.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhum takeaway nesta revisão.</p>
        ) : (
          <ul className="divide-y divide-slate-800/50">
            {items.map((it) => (
              <TakeawayRow
                key={it.id}
                item={it}
                mentorDone={Boolean(it.done)}
                alunoDone={Boolean(it.done) || alunoIds.includes(it.id)}
                onToggle={(itemId, markDone) => onToggleAlunoDone(review.id, itemId, markDone)}
                disabled={actionLoading || Boolean(it.done)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* 4 — Comparativo maturidade 4D */}
      <section>
        <h3 className="text-sm font-semibold text-slate-200 mb-2">Comparativo de maturidade</h3>
        {hasFrozenSnapshot ? (
          <MaturityComparisonSection
            current={maturityCurrent}
            previous={maturityPrevious}
            loading={maturityLoading}
            error={maturityError}
            embedded
          />
        ) : (
          <p className="text-xs text-slate-500">Comparativo indisponível.</p>
        )}
      </section>

      {/* 5 — Notas do mentor */}
      <section>
        <h3 className="text-sm font-semibold text-slate-200 mb-2">Notas do mentor</h3>
        {sessionNotes ? (
          <p className="text-sm text-slate-300 whitespace-pre-wrap bg-slate-900/40 border border-slate-800/60 rounded p-3">
            {sessionNotes}
          </p>
        ) : (
          <p className="text-xs text-slate-500">Sem notas desta sessão.</p>
        )}
      </section>
    </div>
  );
};

const ReviewListItem = ({
  review,
  allReviews,
  expanded,
  onToggleExpand,
  studentId,
  onToggleAlunoDone,
  onNavigateToFeedback,
  actionLoading,
}) => {
  const badge = statusBadge(review.status);
  const items = Array.isArray(review.takeawayItems) ? review.takeawayItems : [];
  const alunoIds = Array.isArray(review.alunoDoneIds) ? review.alunoDoneIds : [];
  const total = items.length;
  const closedCount = items.filter((it) => Boolean(it.done) || alunoIds.includes(it.id)).length;
  const openCount = total - closedCount;

  return (
    <li
      className="bg-slate-900/40 border border-slate-800/60 rounded-lg overflow-hidden"
      data-testid={`review-item-${review.id}`}
    >
      <button
        type="button"
        onClick={() => onToggleExpand(review.id)}
        aria-expanded={expanded}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-900/60"
      >
        <span className="shrink-0 text-slate-500">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-white">
            {fmtDateBR(review.weekStart)} – {fmtDateBR(review.weekEnd)}
          </span>
          <span className="block text-[11px] text-slate-500 mt-0.5">
            {total} takeaway{total === 1 ? '' : 's'} · {openCount} em aberto · {closedCount} encerrado{closedCount === 1 ? '' : 's'}
          </span>
        </span>
        <span className={`text-[11px] px-2 py-0.5 rounded ${badge.cls}`}>
          {badge.label}
        </span>
      </button>
      {expanded && (
        <ReviewDetail
          review={review}
          allReviews={allReviews}
          studentId={studentId}
          onToggleAlunoDone={onToggleAlunoDone}
          onNavigateToFeedback={onNavigateToFeedback}
          actionLoading={actionLoading}
        />
      )}
    </li>
  );
};

const StudentReviewsPage = ({ onNavigateToFeedback = null } = {}) => {
  const { user, isMentor } = useAuth();
  const mentor = typeof isMentor === 'function' ? isMentor() : Boolean(isMentor);
  const studentId = user?.uid || null;
  const {
    reviews,
    isLoading,
    error,
    actionLoading,
    toggleAlunoDone,
  } = useWeeklyReviews(studentId);
  const [expandedId, setExpandedId] = useState(null);

  const sorted = useMemo(() => {
    const list = Array.isArray(reviews) ? [...reviews] : [];
    list.sort((a, b) => String(b.weekStart || '').localeCompare(String(a.weekStart || '')));
    return list;
  }, [reviews]);

  const handleToggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  if (mentor) {
    return (
      <div className="min-h-screen bg-slate-950 py-6">
        <div className="max-w-[720px] mx-auto px-6">
          <h1 className="text-xl font-semibold text-white mb-2">Minhas revisões</h1>
          <p className="text-sm text-slate-400">
            Esta tela é do aluno. Mentor use a Fila de Revisão.
          </p>
        </div>
        <DebugBadge component="StudentReviewsPage" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 py-6">
      <div className="max-w-[720px] mx-auto px-6">
        <header className="mb-4">
          <h1 className="text-xl font-semibold text-white">Minhas revisões</h1>
          <p className="text-xs text-slate-500 mt-1">
            Revisões semanais publicadas pelo seu mentor.
          </p>
        </header>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-slate-400 py-8">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando revisões…
          </div>
        )}

        {!isLoading && error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 text-red-300 text-sm p-3">
            Não foi possível carregar suas revisões. {error}
          </div>
        )}

        {!isLoading && !error && sorted.length === 0 && (
          <div className="rounded-lg border border-slate-800/60 bg-slate-900/40 text-sm text-slate-400 p-4">
            Você ainda não tem revisões publicadas.
          </div>
        )}

        {!isLoading && !error && sorted.length > 0 && (
          <ul className="space-y-3">
            {sorted.map((rv) => (
              <ReviewListItem
                key={rv.id}
                review={rv}
                allReviews={sorted}
                expanded={expandedId === rv.id}
                onToggleExpand={handleToggleExpand}
                studentId={studentId}
                onToggleAlunoDone={toggleAlunoDone}
                onNavigateToFeedback={onNavigateToFeedback}
                actionLoading={actionLoading}
              />
            ))}
          </ul>
        )}
      </div>
      <DebugBadge component="StudentReviewsPage" />
    </div>
  );
};

export default StudentReviewsPage;
