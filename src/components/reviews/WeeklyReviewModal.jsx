/**
 * WeeklyReviewModal
 * @version 1.0.0 (v1.33.0)
 * @description Modal principal da Revisão Semanal (#102 Fase C).
 *
 * Tabs: SWOT · Ranking · Takeaways · Reunião · Comparação.
 *
 * Guardrails:
 *   G2 — Empty states distintos: SWOT null ≠ SWOT aiUnavailable ≠ SWOT gerado.
 *   G3 — Comparação oculta quando customPeriod (apples-to-oranges).
 *   G4 — DebugBadge + grid-cols-1 md:grid-cols-2 no SWOT/Ranking.
 *   Re-gerar SWOT: confirmação explícita antes do CF call.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { doc, getDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  X, Loader2, Sparkles, AlertTriangle, CheckCircle2, RefreshCw,
  TrendingUp, TrendingDown, Archive, Lock, FileText, Video, GitCompare, Trash2, Save,
} from 'lucide-react';
import { useWeeklyReviews } from '../../hooks/useWeeklyReviews';
import { useAuth } from '../../contexts/AuthContext';
import { validateReviewUrl, validateTakeaways, MAX_TAKEAWAYS_LENGTH } from '../../utils/reviewUrlValidator';
import { buildClientSnapshot } from '../../utils/clientSnapshotBuilder';
import {
  recomputeAndReadMaturity,
  maybeDispatchMaturityAI,
} from '../../utils/closeReviewMaturityPipeline';
import DebugBadge from '../DebugBadge';

const filterTradesByRange = (trades, startISO, endISO) => {
  if (!Array.isArray(trades)) return [];
  return trades.filter(t => {
    const d = t.date || (t.entryTime ? t.entryTime.slice(0, 10) : null);
    if (!d) return false;
    return d >= startISO && d <= endISO;
  });
};

// Busca plan + trades do período e reconstrói snapshot — usado no publish de DRAFT.
// Quando studentId presente, congela também o snapshot de maturity (Fase E — issue #119 task 15).
//
// Task 21 (H2): aceita `preloadedMaturity` — quando caller já fez recompute+read
// via closeReviewMaturityPipeline, não relemos o doc (evita race com gravação do
// motor). Se ausente/undefined, cai no path antigo que lê direto do Firestore.
const rebuildSnapshot = async (review, studentId, preloadedMaturity) => {
  const planId = review?.frozenSnapshot?.planContext?.planId;
  if (!planId) return null;
  const planSnap = await getDoc(doc(db, 'plans', planId));
  if (!planSnap.exists()) return null;
  const plan = { id: planSnap.id, ...planSnap.data() };
  const tradesQ = query(collection(db, 'trades'), where('planId', '==', planId));
  const tradesSnap = await getDocs(tradesQ);
  const allTrades = tradesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const weekTrades = filterTradesByRange(allTrades, review.weekStart, review.weekEnd);

  let maturity = preloadedMaturity === undefined ? null : preloadedMaturity;
  if (preloadedMaturity === undefined) {
    try {
      if (studentId) {
        const maturitySnap = await getDoc(doc(db, 'students', studentId, 'maturity', 'current'));
        maturity = maturitySnap.exists() ? { id: maturitySnap.id, ...maturitySnap.data() } : null;
      }
    } catch (err) {
      console.warn('[rebuildSnapshot] maturity fetch failed (continuando sem maturitySnapshot):', err);
    }
  }

  return buildClientSnapshot({
    plan,
    trades: weekTrades,
    cycleKey: review.cycleKey ?? null,
    emotionalMetrics: null,
    maturity,
  });
};

const fmtMoney = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
};
const fmtPct = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  return `${n.toFixed(1)}%`;
};
const fmtNum = (v, digits = 2) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  return n.toFixed(digits);
};

const statusBadge = (status) => {
  switch (status) {
    case 'DRAFT':
      return { label: 'Rascunho', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
    case 'CLOSED':
      return { label: 'Publicada', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
    case 'ARCHIVED':
      return { label: 'Arquivada', cls: 'bg-slate-500/10 text-slate-400 border-slate-500/30' };
    default:
      return { label: status, cls: 'bg-slate-500/10 text-slate-400 border-slate-500/30' };
  }
};

const QuadrantCard = ({ title, items, icon: Icon, color }) => (
  <div className={`rounded-lg border p-3 bg-slate-900/40 ${color}`}>
    <div className="flex items-center gap-2 mb-2 text-xs font-semibold uppercase tracking-wide">
      <Icon className="w-3.5 h-3.5" />
      {title}
    </div>
    {items && items.length > 0 ? (
      <ul className="space-y-1.5 text-xs text-slate-300">
        {items.map((it, i) => (
          <li key={i} className="flex gap-1.5">
            <span className="text-slate-500 shrink-0">·</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    ) : (
      <div className="text-[11px] text-slate-500 italic">Sem itens</div>
    )}
  </div>
);

const TradeRankingRow = ({ t, positive }) => (
  <div className="flex items-center justify-between text-xs bg-slate-800/40 rounded px-2 py-1.5">
    <div className="flex-1 min-w-0">
      <div className="font-mono text-slate-300 truncate">
        {t.symbol} {t.side}
      </div>
      <div className="text-[10px] text-slate-500 truncate">
        {t.setup || '-'} · {t.emotionEntry || '-'} → {t.emotionExit || '-'}
      </div>
    </div>
    <div className={`font-mono font-bold ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
      {fmtMoney(t.pnl)}
    </div>
  </div>
);

const KpiRow = ({ label, current, previous, fmt = fmtNum, invertColors = false }) => {
  const hasPrev = previous != null;
  const delta = hasPrev ? Number(current) - Number(previous) : null;
  const up = delta != null && delta > 0;
  const down = delta != null && delta < 0;
  const good = invertColors ? down : up;
  const bad = invertColors ? up : down;
  return (
    <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-800/60">
      <span className="text-slate-400">{label}</span>
      <div className="flex items-center gap-3 font-mono">
        <span className="text-white">{fmt(current)}</span>
        {hasPrev && (
          <>
            <span className="text-slate-600">←</span>
            <span className="text-slate-500">{fmt(previous)}</span>
            <span className={`text-[10px] ${good ? 'text-emerald-400' : bad ? 'text-red-400' : 'text-slate-500'}`}>
              {delta === 0 ? '=' : `${up ? '+' : ''}${fmt(delta)}`}
            </span>
          </>
        )}
      </div>
    </div>
  );
};

// Aceita `review` como prop (fast path quando caller já tem live data) OU `reviewId`
// (modal escuta o doc via onSnapshot — usado quando caller não tem hook conectado).
const WeeklyReviewModal = ({ review: reviewProp = null, reviewId = null, studentId, previousReview = null, onClose }) => {
  const { generateSwot, closeReview, archiveReview, deleteReview, updateMeetingLinks, actionLoading, error } = useWeeklyReviews(studentId);
  const { isMentor } = useAuth();
  const mentor = typeof isMentor === 'function' ? isMentor() : Boolean(isMentor);

  // Self-listener quando reviewId é fornecido e não temos review prop.
  // Garante que SWOT gerado por CF + updates no doc reflitam imediatamente.
  const [selfReview, setSelfReview] = useState(null);
  useEffect(() => {
    if (reviewProp || !reviewId || !studentId) { setSelfReview(null); return undefined; }
    const unsub = onSnapshot(
      doc(db, 'students', studentId, 'reviews', reviewId),
      (snap) => { if (snap.exists()) setSelfReview({ id: snap.id, ...snap.data() }); },
      (err) => console.error('[WeeklyReviewModal] doc listener error', err)
    );
    return () => unsub();
  }, [reviewId, studentId, reviewProp]);

  const review = reviewProp || selfReview;

  const [tab, setTab] = useState('swot');
  const [takeaways, setTakeaways] = useState(review?.takeaways || '');
  const [meetingLink, setMeetingLink] = useState(review?.meetingLink || '');
  const [videoLink, setVideoLink] = useState(review?.videoLink || '');
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [liveSnapshot, setLiveSnapshot] = useState(null);
  const [liveRefreshing, setLiveRefreshing] = useState(false);

  const swot = review?.swot || null;
  const isDraft = review?.status === 'DRAFT';
  // Em DRAFT, se já recomputamos snapshot live, usa; senão, fallback no stored.
  // Em CLOSED/ARCHIVED, sempre usa o frozenSnapshot (foto congelada).
  const snapshot = (isDraft && liveSnapshot) ? liveSnapshot : (review?.frozenSnapshot || {});
  const isCustomPeriod = !!review?.customPeriod;

  useEffect(() => {
    setTakeaways(review?.takeaways || '');
    setMeetingLink(review?.meetingLink || '');
    setVideoLink(review?.videoLink || '');
  }, [review?.id, review?.takeaways, review?.meetingLink, review?.videoLink]);

  // DRAFT: recomputa snapshot live ao abrir e quando mentor pedir refresh.
  // CLOSED/ARCHIVED: nunca recomputa (frozenSnapshot é a foto definitiva).
  const refreshLiveSnapshot = useCallback(async () => {
    if (!isDraft || !review) return;
    setLiveRefreshing(true);
    try {
      const snap = await rebuildSnapshot(review, studentId);
      if (snap) setLiveSnapshot(snap);
    } catch (e) {
      console.error('[WeeklyReviewModal] refresh live snapshot failed', e);
    } finally {
      setLiveRefreshing(false);
    }
  }, [isDraft, review, studentId]);

  useEffect(() => {
    if (isDraft) refreshLiveSnapshot();
    else setLiveSnapshot(null);
  }, [review?.id, isDraft, refreshLiveSnapshot]);
  const canEdit = mentor && review?.status !== 'ARCHIVED';
  const canGenerateSwot = canEdit && review?.status === 'DRAFT';
  const canClose = canEdit && review?.status === 'DRAFT';
  const canArchive = canEdit && review?.status === 'CLOSED';
  const canDelete = mentor && review?.status !== 'ARCHIVED'; // rules bloqueiam ARCHIVED

  const takeawaysValidation = useMemo(() => validateTakeaways(takeaways), [takeaways]);
  const meetingLinkValidation = useMemo(() => validateReviewUrl(meetingLink), [meetingLink]);
  const videoLinkValidation = useMemo(() => validateReviewUrl(videoLink), [videoLink]);

  const badge = statusBadge(review?.status || 'DRAFT');

  const handleGenerateSwot = useCallback(async () => {
    if (swot && !confirmRegen) {
      setConfirmRegen(true);
      return;
    }
    setConfirmRegen(false);
    try {
      await generateSwot({ reviewId: review.id });
    } catch {
      // error já no hook
    }
  }, [swot, confirmRegen, generateSwot, review?.id]);

  const handleClose = useCallback(async () => {
    if (!canClose) return;
    if (!takeawaysValidation.valid || !meetingLinkValidation.valid || !videoLinkValidation.valid) return;
    try {
      // Task 21 (H2) — ordem estrita ANTES do freeze do maturitySnapshot:
      //   1. recompute engine via callable → snapshot fresh de maturity/current
      //   2. rebuild KPIs do período usando esse maturity pré-carregado
      //   3. dispatch narrativa IA se trigger UP/REGRESSION (fire-and-forget)
      //   4. closeReview com frozenSnapshot incluindo maturitySnapshot fresco
      // Engine/IA failures são tolerantes — publish não bloqueia.
      const { maturity: freshMaturity } = await recomputeAndReadMaturity({ studentId });
      const fresh = await rebuildSnapshot(review, studentId, freshMaturity).catch(() => null);
      maybeDispatchMaturityAI({
        studentId,
        maturity: freshMaturity,
        kpis: fresh?.kpis,
        windowSize: Array.isArray(fresh?.periodTrades) ? fresh.periodTrades.length : 0,
      });
      await closeReview(review.id, {
        takeaways, meetingLink, videoLink,
        frozenSnapshot: fresh || undefined,
      });
    } catch { /* already surfaced */ }
  }, [canClose, closeReview, review, studentId, takeaways, meetingLink, videoLink,
      takeawaysValidation, meetingLinkValidation, videoLinkValidation]);

  // Issue #197 — botão dedicado "Salvar links" funciona em DRAFT e CLOSED.
  // Não muda status, persiste só os 2 campos + updatedAt. ARCHIVED bloqueia via canEdit.
  const linksDirty = (meetingLink || '') !== (review?.meetingLink || '') ||
    (videoLink || '') !== (review?.videoLink || '');
  const handleSaveLinks = useCallback(async () => {
    if (!canEdit) return;
    if (!meetingLinkValidation.valid || !videoLinkValidation.valid) return;
    try {
      await updateMeetingLinks(review.id, { meetingLink, videoLink });
    } catch { /* error surfaced */ }
  }, [canEdit, updateMeetingLinks, review?.id, meetingLink, videoLink,
      meetingLinkValidation, videoLinkValidation]);

  const handleArchive = useCallback(async () => {
    if (!canArchive) return;
    try { await archiveReview(review.id); } catch { /* */ }
  }, [canArchive, archiveReview, review?.id]);

  const handleDelete = useCallback(async () => {
    if (!canDelete) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    try {
      await deleteReview(review.id);
      onClose?.();
    } catch { /* */ }
    setConfirmDelete(false);
  }, [canDelete, confirmDelete, deleteReview, review?.id, onClose]);

  const tabs = [
    { id: 'swot', label: 'SWOT', icon: Sparkles },
    { id: 'ranking', label: 'Ranking', icon: TrendingUp },
    { id: 'takeaways', label: 'Takeaways', icon: FileText },
    { id: 'meeting', label: 'Reunião', icon: Video },
    { id: 'comparison', label: 'Comparação', icon: GitCompare, disabled: isCustomPeriod || !previousReview },
  ];

  if (!review) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-4xl max-h-[90vh] bg-slate-900 rounded-xl border border-slate-800 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-base font-bold text-white">Revisão Semanal</h2>
              <span className={`text-[10px] px-2 py-0.5 rounded border ${badge.cls}`}>{badge.label}</span>
              {isCustomPeriod && (
                <span className="text-[10px] px-2 py-0.5 rounded border bg-amber-500/10 text-amber-400 border-amber-500/30">
                  Período custom
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              {review.weekStart} → {review.weekEnd}
              {review.periodKey && <span className="text-slate-600"> · {review.periodKey}</span>}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* DRAFT live banner — KPIs atualizam até Publicar; aí congelam */}
        {isDraft && (
          <div className="px-5 py-2 bg-amber-500/5 border-b border-amber-500/20 text-[11px] flex items-center justify-between">
            <span className="text-amber-400/90">
              ● Rascunho em atualização — indicadores congelam ao publicar.
            </span>
            <button
              onClick={refreshLiveSnapshot}
              disabled={liveRefreshing}
              className="text-amber-300 hover:text-amber-200 disabled:opacity-40 inline-flex items-center gap-1"
              title="Recomputar KPIs com trades atuais"
            >
              {liveRefreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Atualizar
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-800 px-3">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => !t.disabled && setTab(t.id)}
              disabled={t.disabled}
              className={`px-3 py-2 text-xs flex items-center gap-1.5 border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-emerald-400 text-emerald-300'
                  : t.disabled
                    ? 'border-transparent text-slate-600 cursor-not-allowed'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-5">
          {tab === 'swot' && (
            <div className="space-y-4">
              {swot == null && (
                <div className="text-center py-8">
                  <Sparkles className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-400 mb-4">SWOT ainda não foi gerado para esta revisão.</p>
                  {canGenerateSwot && (
                    <button
                      onClick={handleGenerateSwot}
                      disabled={actionLoading}
                      className="px-4 py-2 text-xs font-medium bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-lg hover:bg-emerald-500/30 disabled:opacity-40 inline-flex items-center gap-1.5"
                    >
                      {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      Gerar SWOT via IA
                    </button>
                  )}
                </div>
              )}

              {swot && swot.aiUnavailable && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 text-xs text-amber-300 flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  IA indisponível no momento — SWOT determinístico. Você pode regenerar quando a IA voltar.
                </div>
              )}
              {swot && !swot.aiUnavailable && (
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2 text-[11px] text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  SWOT gerado por {swot.modelVersion || 'IA'} (v{swot.promptVersion || '—'}) · geração #{swot.generationCount ?? 1}
                </div>
              )}

              {swot && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <QuadrantCard
                    title="Strengths"
                    items={swot.strengths}
                    icon={TrendingUp}
                    color="border-emerald-500/30"
                  />
                  <QuadrantCard
                    title="Weaknesses"
                    items={swot.weaknesses}
                    icon={TrendingDown}
                    color="border-red-500/30"
                  />
                  <QuadrantCard
                    title="Opportunities"
                    items={swot.opportunities}
                    icon={Sparkles}
                    color="border-sky-500/30"
                  />
                  <QuadrantCard
                    title="Threats"
                    items={swot.threats}
                    icon={AlertTriangle}
                    color="border-amber-500/30"
                  />
                </div>
              )}

              {swot && canGenerateSwot && (
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  {confirmRegen ? (
                    <>
                      <span className="text-[11px] text-amber-400">
                        Isso vai sobrescrever o SWOT atual (geração #{(swot.generationCount ?? 1)}). Continuar?
                      </span>
                      <button
                        onClick={() => setConfirmRegen(false)}
                        disabled={actionLoading}
                        className="px-3 py-1 text-[11px] text-slate-400 hover:text-white disabled:opacity-40"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleGenerateSwot}
                        disabled={actionLoading}
                        className="px-3 py-1 text-[11px] bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded hover:bg-amber-500/30 disabled:opacity-40"
                      >
                        {actionLoading ? <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> : null}
                        Sim, regenerar
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleGenerateSwot}
                      disabled={actionLoading}
                      className="px-3 py-1 text-[11px] text-emerald-400 hover:text-emerald-300 disabled:opacity-40 inline-flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" /> Regenerar SWOT
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === 'ranking' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-semibold text-emerald-400 uppercase mb-2 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" /> Top trades
                </div>
                <div className="space-y-1.5">
                  {(snapshot.topTrades || []).length === 0 && (
                    <div className="text-[11px] text-slate-500 italic">Sem vencedores no período</div>
                  )}
                  {(snapshot.topTrades || []).map((t, i) => (
                    <TradeRankingRow key={t.tradeId || i} t={t} positive />
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-red-400 uppercase mb-2 flex items-center gap-1.5">
                  <TrendingDown className="w-3.5 h-3.5" /> Bottom trades
                </div>
                <div className="space-y-1.5">
                  {(snapshot.bottomTrades || []).length === 0 && (
                    <div className="text-[11px] text-slate-500 italic">Sem perdedores no período</div>
                  )}
                  {(snapshot.bottomTrades || []).map((t, i) => (
                    <TradeRankingRow key={t.tradeId || i} t={t} positive={false} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'takeaways' && (
            <div>
              <label className="text-xs text-slate-400 mb-1 block">
                Notas da mentoria (markdown leve, máx {MAX_TAKEAWAYS_LENGTH} caracteres)
              </label>
              <textarea
                value={takeaways}
                onChange={(e) => setTakeaways(e.target.value)}
                disabled={!canEdit || actionLoading}
                rows={12}
                className="w-full input-dark font-mono text-xs"
                placeholder="Padrões observados, pontos de alavancagem, próximos passos..."
              />
              <div className="flex justify-between items-center mt-1 text-[11px]">
                <span className={takeawaysValidation.valid ? 'text-slate-500' : 'text-red-400'}>
                  {takeawaysValidation.error || `${takeaways.length}/${MAX_TAKEAWAYS_LENGTH}`}
                </span>
              </div>
            </div>
          )}

          {tab === 'meeting' && (
            <div className="space-y-3 max-w-lg">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Link da reunião (Zoom, Meet, Teams...)</label>
                <input
                  type="url"
                  value={meetingLink}
                  onChange={(e) => setMeetingLink(e.target.value)}
                  disabled={!canEdit || actionLoading}
                  className="w-full input-dark text-xs"
                  placeholder="https://zoom.us/j/..."
                />
                {meetingLinkValidation.error && (
                  <div className="text-[11px] text-red-400 mt-1">{meetingLinkValidation.error}</div>
                )}
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Link da gravação (Loom, YouTube, Drive, Vimeo)</label>
                <input
                  type="url"
                  value={videoLink}
                  onChange={(e) => setVideoLink(e.target.value)}
                  disabled={!canEdit || actionLoading}
                  className="w-full input-dark text-xs"
                  placeholder="https://loom.com/share/..."
                />
                {videoLinkValidation.error && (
                  <div className="text-[11px] text-red-400 mt-1">{videoLinkValidation.error}</div>
                )}
              </div>
              {/* Issue #197 — botão dedicado para atualizar links sem mudar status (DRAFT e CLOSED) */}
              {canEdit && (
                <div className="flex justify-end pt-1">
                  <button
                    onClick={handleSaveLinks}
                    disabled={!linksDirty || !meetingLinkValidation.valid || !videoLinkValidation.valid || actionLoading}
                    className="px-3 py-1.5 text-xs font-medium bg-slate-700/40 border border-slate-600 text-slate-300 rounded hover:bg-slate-700/60 disabled:opacity-40 inline-flex items-center gap-1.5"
                    title="Persistir links sem mudar status (funciona em DRAFT e CLOSED)"
                  >
                    {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    Salvar links
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === 'comparison' && !isCustomPeriod && previousReview && (
            <div className="space-y-1">
              <div className="text-[11px] text-slate-400 mb-2">
                Revisão anterior: {previousReview.periodKey} ({previousReview.weekStart} → {previousReview.weekEnd})
              </div>
              <KpiRow label="P&L" current={snapshot.kpis?.pl} previous={previousReview.frozenSnapshot?.kpis?.pl} fmt={fmtMoney} />
              <KpiRow label="Trades" current={snapshot.kpis?.trades} previous={previousReview.frozenSnapshot?.kpis?.trades} fmt={(v) => String(Number(v) || 0)} />
              <KpiRow label="Win Rate" current={snapshot.kpis?.wr} previous={previousReview.frozenSnapshot?.kpis?.wr} fmt={fmtPct} />
              <KpiRow label="Avg RR" current={snapshot.kpis?.avgRR} previous={previousReview.frozenSnapshot?.kpis?.avgRR} fmt={(v) => fmtNum(v, 2)} />
              <KpiRow label="Max Drawdown" current={snapshot.kpis?.maxDD} previous={previousReview.frozenSnapshot?.kpis?.maxDD} fmt={fmtMoney} invertColors />
              <KpiRow label="Compliance" current={snapshot.kpis?.compliance?.overall} previous={previousReview.frozenSnapshot?.kpis?.compliance?.overall} fmt={fmtPct} />
              <KpiRow label="Score emocional" current={snapshot.kpis?.emotional?.compositeScore} previous={previousReview.frozenSnapshot?.kpis?.emotional?.compositeScore} fmt={(v) => `${Number(v) || 0}/100`} />
            </div>
          )}

          {tab === 'comparison' && (isCustomPeriod || !previousReview) && (
            <div className="text-center py-8 text-xs text-slate-500">
              {isCustomPeriod
                ? 'Comparação indisponível em períodos customizados (G3).'
                : 'Primeira revisão deste plano — sem anterior para comparar.'}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800">
          <div className="text-[11px] text-slate-500">
            {error && <span className="text-red-400">{error}</span>}
          </div>
          <div className="flex items-center gap-2">
            {canDelete && (
              confirmDelete ? (
                <>
                  <span className="text-[11px] text-red-400">Apagar esta revisão?</span>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    disabled={actionLoading}
                    className="px-2.5 py-1 text-[11px] text-slate-400 hover:text-white disabled:opacity-40"
                  >
                    Não
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={actionLoading}
                    className="px-2.5 py-1 text-[11px] font-medium bg-red-500/20 border border-red-500/40 text-red-300 rounded hover:bg-red-500/30 disabled:opacity-40"
                  >
                    {actionLoading ? <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> : null}
                    Sim, apagar
                  </button>
                </>
              ) : (
                <button
                  onClick={handleDelete}
                  disabled={actionLoading}
                  className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 border border-transparent hover:border-red-500/30 hover:bg-red-500/10 rounded-lg inline-flex items-center gap-1.5 disabled:opacity-40"
                  title="Apagar esta revisão (irreversível)"
                >
                  <Trash2 className="w-3 h-3" /> Apagar
                </button>
              )
            )}
            {canClose && (
              <button
                onClick={handleClose}
                disabled={actionLoading || !takeawaysValidation.valid || !meetingLinkValidation.valid || !videoLinkValidation.valid}
                className="px-3 py-1.5 text-xs font-medium bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-lg hover:bg-emerald-500/30 disabled:opacity-40 inline-flex items-center gap-1.5"
              >
                {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lock className="w-3 h-3" />}
                Publicar (DRAFT → CLOSED)
              </button>
            )}
            {canArchive && (
              <button
                onClick={handleArchive}
                disabled={actionLoading}
                className="px-3 py-1.5 text-xs font-medium bg-slate-700/40 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700/60 disabled:opacity-40 inline-flex items-center gap-1.5"
              >
                {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Archive className="w-3 h-3" />}
                Arquivar
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
            >
              Fechar
            </button>
          </div>
        </div>

        <DebugBadge component="WeeklyReviewModal" />
      </div>
    </div>
  );
};

export default WeeklyReviewModal;
