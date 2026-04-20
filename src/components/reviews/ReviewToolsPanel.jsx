/**
 * ReviewToolsPanel
 * @version 1.0.0 (v1.33.0)
 * @description Painel lateral (3ª coluna do PlanLedgerExtract em mode='review').
 *
 * Seções colapsáveis: SWOT · Takeaways · Reunião · Comparação.
 * Footer: Publicar · Arquivar · Apagar.
 * Self-listener no doc review via onSnapshot — SWOT/takeaways atualizam live.
 *
 * Guardrails Fase C:
 *   G2 — empty state distinto SWOT null vs aiUnavailable
 *   G3 — Comparação oculta quando customPeriod
 *   G4 — DebugBadge + grid responsivo
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { doc, getDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  Loader2, Sparkles, AlertTriangle, CheckCircle2, RefreshCw,
  TrendingUp, TrendingDown, Archive, Lock, FileText, Video, GitCompare, Trash2,
  ChevronDown, ChevronRight, Save,
} from 'lucide-react';
import { useWeeklyReviews } from '../../hooks/useWeeklyReviews';
import { useAuth } from '../../contexts/AuthContext';
import { validateReviewUrl, validateTakeaways, MAX_TAKEAWAYS_LENGTH } from '../../utils/reviewUrlValidator';
import { buildClientSnapshot } from '../../utils/clientSnapshotBuilder';

const filterTradesByRange = (trades, startISO, endISO) => {
  if (!Array.isArray(trades)) return [];
  return trades.filter(t => {
    const d = t.date || (t.entryTime ? t.entryTime.slice(0, 10) : null);
    if (!d) return false;
    return d >= startISO && d <= endISO;
  });
};

const rebuildSnapshot = async (review) => {
  const planId = review?.frozenSnapshot?.planContext?.planId;
  if (!planId) return null;
  const planSnap = await getDoc(doc(db, 'plans', planId));
  if (!planSnap.exists()) return null;
  const plan = { id: planSnap.id, ...planSnap.data() };
  const tradesQ = query(collection(db, 'trades'), where('planId', '==', planId));
  const tradesSnap = await getDocs(tradesQ);
  const allTrades = tradesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const weekTrades = filterTradesByRange(allTrades, review.weekStart, review.weekEnd);
  return buildClientSnapshot({
    plan,
    trades: weekTrades,
    cycleKey: review.cycleKey || null,
    emotionalMetrics: null,
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
    case 'DRAFT': return { label: 'Rascunho', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
    case 'CLOSED': return { label: 'Publicada', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
    case 'ARCHIVED': return { label: 'Arquivada', cls: 'bg-slate-500/10 text-slate-400 border-slate-500/30' };
    default: return { label: status, cls: 'bg-slate-500/10 text-slate-400 border-slate-500/30' };
  }
};

// Seção colapsável com header clicável
const Section = ({ title, icon: Icon, defaultOpen = true, badge = null, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-800/60">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-800/30"
      >
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <Icon className="w-3.5 h-3.5" />
          {title}
        </div>
        {badge}
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
};

const QuadrantCard = ({ title, items, icon: Icon, color }) => (
  <div className={`rounded-lg border p-2.5 bg-slate-900/40 ${color}`}>
    <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-semibold uppercase tracking-wide">
      <Icon className="w-3 h-3" />
      {title}
    </div>
    {items && items.length > 0 ? (
      <ul className="space-y-1 text-[11px] text-slate-300">
        {items.map((it, i) => (
          <li key={i} className="flex gap-1">
            <span className="text-slate-500 shrink-0">·</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    ) : (
      <div className="text-[10px] text-slate-500 italic">Sem itens</div>
    )}
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
    <div className="flex items-center justify-between text-[11px] py-1 border-b border-slate-800/40">
      <span className="text-slate-400">{label}</span>
      <div className="flex items-center gap-2 font-mono">
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

const ReviewToolsPanel = ({
  reviewId,
  studentId,
  review: reviewProp = null,  // fast-path se caller já tem live data
  previousReview = null,
  onClose,
}) => {
  const { generateSwot, closeReview, archiveReview, deleteReview, saveDraftFields, actionLoading, error } = useWeeklyReviews(studentId);
  const { isMentor } = useAuth();
  const mentor = typeof isMentor === 'function' ? isMentor() : Boolean(isMentor);

  // Self-listener no doc (garante SWOT/takeaways atualizarem live).
  const [selfReview, setSelfReview] = useState(null);
  useEffect(() => {
    if (reviewProp || !reviewId || !studentId) { setSelfReview(null); return undefined; }
    const unsub = onSnapshot(
      doc(db, 'students', studentId, 'reviews', reviewId),
      (snap) => { if (snap.exists()) setSelfReview({ id: snap.id, ...snap.data() }); },
      (err) => console.error('[ReviewToolsPanel] doc listener error', err)
    );
    return () => unsub();
  }, [reviewId, studentId, reviewProp]);

  const review = reviewProp || selfReview;

  const [takeaways, setTakeaways] = useState(review?.takeaways || '');
  const [meetingLink, setMeetingLink] = useState(review?.meetingLink || '');
  const [videoLink, setVideoLink] = useState(review?.videoLink || '');
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setTakeaways(review?.takeaways || '');
    setMeetingLink(review?.meetingLink || '');
    setVideoLink(review?.videoLink || '');
  }, [review?.id, review?.takeaways, review?.meetingLink, review?.videoLink]);

  const swot = review?.swot || null;
  const isDraft = review?.status === 'DRAFT';
  const isCustomPeriod = !!review?.customPeriod;
  const canEdit = mentor && review?.status !== 'ARCHIVED';
  const canGenerateSwot = canEdit && isDraft;
  const canClose = canEdit && isDraft;
  const canArchive = canEdit && review?.status === 'CLOSED';
  const canDelete = mentor && review?.status !== 'ARCHIVED';

  const takeawaysValidation = useMemo(() => validateTakeaways(takeaways), [takeaways]);
  const meetingLinkValidation = useMemo(() => validateReviewUrl(meetingLink), [meetingLink]);
  const videoLinkValidation = useMemo(() => validateReviewUrl(videoLink), [videoLink]);

  const badge = statusBadge(review?.status || 'DRAFT');

  const handleGenerateSwot = useCallback(async () => {
    if (swot && !confirmRegen) { setConfirmRegen(true); return; }
    setConfirmRegen(false);
    try { await generateSwot({ reviewId: review.id }); } catch { /* */ }
  }, [swot, confirmRegen, generateSwot, review?.id]);

  const handlePublish = useCallback(async () => {
    if (!canClose) return;
    if (!takeawaysValidation.valid || !meetingLinkValidation.valid || !videoLinkValidation.valid) return;
    try {
      const fresh = await rebuildSnapshot(review).catch(() => null);
      await closeReview(review.id, {
        takeaways, meetingLink, videoLink,
        frozenSnapshot: fresh || undefined,
      });
    } catch { /* */ }
  }, [canClose, closeReview, review, takeaways, meetingLink, videoLink,
      takeawaysValidation, meetingLinkValidation, videoLinkValidation]);

  // Salvar SEM publicar — persiste as edições de takeaways/links no DRAFT.
  // Resolve perda de estado no baseline: mentor digita na extrato, muda de plano,
  // volta e o texto estava lá. Só habilita em DRAFT.
  const handleSaveDraft = useCallback(async () => {
    if (!canEdit || !isDraft) return;
    if (!takeawaysValidation.valid || !meetingLinkValidation.valid || !videoLinkValidation.valid) return;
    try {
      await saveDraftFields(review.id, { takeaways, meetingLink, videoLink });
    } catch { /* error surfaced */ }
  }, [canEdit, isDraft, saveDraftFields, review?.id, takeaways, meetingLink, videoLink,
      takeawaysValidation, meetingLinkValidation, videoLinkValidation]);

  const draftDirty = isDraft && (
    (takeaways || '') !== (review?.takeaways || '') ||
    (meetingLink || '') !== (review?.meetingLink || '') ||
    (videoLink || '') !== (review?.videoLink || '')
  );

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

  if (!review) {
    return (
      <div className="w-96 border-l border-slate-800 bg-slate-900/40 flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="w-96 border-l border-slate-800 bg-slate-900/50 flex flex-col overflow-hidden">
      {/* Header compacto da revisão */}
      <div className="px-3 py-3 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-[10px] px-2 py-0.5 rounded border ${badge.cls} shrink-0`}>{badge.label}</span>
          <span className="text-[11px] text-slate-400 font-mono truncate">{review.periodKey}</span>
          {isCustomPeriod && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 shrink-0">
              custom
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* SWOT */}
        <Section title="SWOT" icon={Sparkles}>
          {swot == null && (
            <div className="text-center py-3">
              <p className="text-[11px] text-slate-400 mb-2">SWOT ainda não gerado.</p>
              {canGenerateSwot && (
                <button
                  onClick={handleGenerateSwot}
                  disabled={actionLoading}
                  className="px-3 py-1 text-[11px] font-medium bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-lg hover:bg-emerald-500/30 disabled:opacity-40 inline-flex items-center gap-1"
                >
                  {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  Gerar SWOT via IA
                </button>
              )}
            </div>
          )}

          {swot && swot.aiUnavailable && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1.5 text-[10px] text-amber-300 flex items-center gap-1.5 mb-2">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              IA indisponível — SWOT determinístico.
            </div>
          )}
          {swot && !swot.aiUnavailable && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded px-2 py-1 text-[10px] text-emerald-400 mb-2">
              {swot.modelVersion} · v{swot.promptVersion} · #{swot.generationCount ?? 1}
            </div>
          )}

          {swot && (
            <div className="grid grid-cols-1 gap-2">
              <QuadrantCard title="Strengths" items={swot.strengths} icon={TrendingUp} color="border-emerald-500/30" />
              <QuadrantCard title="Weaknesses" items={swot.weaknesses} icon={TrendingDown} color="border-red-500/30" />
              <QuadrantCard title="Opportunities" items={swot.opportunities} icon={Sparkles} color="border-sky-500/30" />
              <QuadrantCard title="Threats" items={swot.threats} icon={AlertTriangle} color="border-amber-500/30" />
            </div>
          )}

          {swot && canGenerateSwot && (
            <div className="flex items-center justify-end gap-1 pt-2 mt-2 border-t border-slate-800">
              {confirmRegen ? (
                <>
                  <span className="text-[10px] text-amber-400 mr-1">Sobrescrever geração #{swot.generationCount ?? 1}?</span>
                  <button onClick={() => setConfirmRegen(false)} disabled={actionLoading} className="px-2 py-0.5 text-[10px] text-slate-400 hover:text-white disabled:opacity-40">Não</button>
                  <button onClick={handleGenerateSwot} disabled={actionLoading} className="px-2 py-0.5 text-[10px] bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded hover:bg-amber-500/30 disabled:opacity-40">
                    {actionLoading ? <Loader2 className="w-2.5 h-2.5 animate-spin inline" /> : 'Sim'}
                  </button>
                </>
              ) : (
                <button onClick={handleGenerateSwot} disabled={actionLoading} className="px-2 py-0.5 text-[10px] text-emerald-400 hover:text-emerald-300 disabled:opacity-40 inline-flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> Regenerar
                </button>
              )}
            </div>
          )}
        </Section>

        {/* Takeaways */}
        <Section title="Takeaways" icon={FileText} badge={
          <span className="text-[10px] text-slate-500">{takeaways.length}/{MAX_TAKEAWAYS_LENGTH}</span>
        }>
          <textarea
            value={takeaways}
            onChange={(e) => setTakeaways(e.target.value)}
            disabled={!canEdit || actionLoading}
            rows={8}
            className="w-full input-dark font-mono text-[11px]"
            placeholder="Pontos, padrões observados..."
          />
          {!takeawaysValidation.valid && (
            <div className="text-[10px] text-red-400 mt-1">{takeawaysValidation.error}</div>
          )}
        </Section>

        {/* Reunião */}
        <Section title="Reunião" icon={Video} defaultOpen={false}>
          <div className="space-y-2">
            <div>
              <label className="text-[10px] text-slate-400 block mb-0.5">Link reunião</label>
              <input
                type="url"
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                disabled={!canEdit || actionLoading}
                className="w-full input-dark text-[11px]"
                placeholder="https://zoom.us/j/..."
              />
              {meetingLinkValidation.error && <div className="text-[10px] text-red-400 mt-0.5">{meetingLinkValidation.error}</div>}
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-0.5">Link gravação</label>
              <input
                type="url"
                value={videoLink}
                onChange={(e) => setVideoLink(e.target.value)}
                disabled={!canEdit || actionLoading}
                className="w-full input-dark text-[11px]"
                placeholder="https://loom.com/share/..."
              />
              {videoLinkValidation.error && <div className="text-[10px] text-red-400 mt-0.5">{videoLinkValidation.error}</div>}
            </div>
          </div>
        </Section>

        {/* Comparação */}
        <Section title="Comparação vs anterior" icon={GitCompare} defaultOpen={false}>
          {isCustomPeriod ? (
            <div className="text-[10px] text-slate-500 italic py-2">Indisponível em períodos customizados (G3).</div>
          ) : !previousReview ? (
            <div className="text-[10px] text-slate-500 italic py-2">Primeira revisão — sem anterior.</div>
          ) : (
            <div>
              <div className="text-[10px] text-slate-500 mb-1">
                {previousReview.periodKey} ({previousReview.weekStart} → {previousReview.weekEnd})
              </div>
              <KpiRow label="P&L" current={review.frozenSnapshot?.kpis?.pl} previous={previousReview.frozenSnapshot?.kpis?.pl} fmt={fmtMoney} />
              <KpiRow label="Trades" current={review.frozenSnapshot?.kpis?.trades} previous={previousReview.frozenSnapshot?.kpis?.trades} fmt={(v) => String(Number(v) || 0)} />
              <KpiRow label="WR" current={review.frozenSnapshot?.kpis?.wr} previous={previousReview.frozenSnapshot?.kpis?.wr} fmt={fmtPct} />
              <KpiRow label="avgRR" current={review.frozenSnapshot?.kpis?.avgRR} previous={previousReview.frozenSnapshot?.kpis?.avgRR} fmt={(v) => fmtNum(v, 2)} />
              <KpiRow label="maxDD" current={review.frozenSnapshot?.kpis?.maxDD} previous={previousReview.frozenSnapshot?.kpis?.maxDD} fmt={fmtMoney} invertColors />
              <KpiRow label="Compliance" current={review.frozenSnapshot?.kpis?.compliance?.overall} previous={previousReview.frozenSnapshot?.kpis?.compliance?.overall} fmt={fmtPct} />
              <KpiRow label="Emocional" current={review.frozenSnapshot?.kpis?.emotional?.compositeScore} previous={previousReview.frozenSnapshot?.kpis?.emotional?.compositeScore} fmt={(v) => `${Number(v) || 0}/100`} />
            </div>
          )}
        </Section>
      </div>

      {/* Footer — Salvar rascunho / Publicar / Arquivar / Apagar */}
      <div className="px-3 py-2 border-t border-slate-800 bg-slate-900/80 shrink-0">
        {error && <div className="text-[10px] text-red-400 mb-1.5">{error}</div>}
        <div className="flex items-center gap-1.5 flex-wrap">
          {canEdit && isDraft && (
            <button
              onClick={handleSaveDraft}
              disabled={actionLoading || !draftDirty || !takeawaysValidation.valid || !meetingLinkValidation.valid || !videoLinkValidation.valid}
              className="px-2 py-1.5 text-[11px] font-medium bg-slate-700/40 border border-slate-600 text-slate-300 rounded hover:bg-slate-700/60 disabled:opacity-40 inline-flex items-center justify-center gap-1"
              title="Salvar edições sem publicar"
            >
              {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Salvar{draftDirty ? ' •' : ''}
            </button>
          )}
          {canClose && (
            <button
              onClick={handlePublish}
              disabled={actionLoading || !takeawaysValidation.valid || !meetingLinkValidation.valid || !videoLinkValidation.valid}
              className="flex-1 px-2 py-1.5 text-[11px] font-medium bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded hover:bg-emerald-500/30 disabled:opacity-40 inline-flex items-center justify-center gap-1"
            >
              {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lock className="w-3 h-3" />}
              Publicar
            </button>
          )}
          {canArchive && (
            <button
              onClick={handleArchive}
              disabled={actionLoading}
              className="flex-1 px-2 py-1.5 text-[11px] font-medium bg-slate-700/40 border border-slate-600 text-slate-300 rounded hover:bg-slate-700/60 disabled:opacity-40 inline-flex items-center justify-center gap-1"
            >
              {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Archive className="w-3 h-3" />}
              Arquivar
            </button>
          )}
          {canDelete && (
            confirmDelete ? (
              <>
                <button onClick={() => setConfirmDelete(false)} disabled={actionLoading} className="px-2 py-1 text-[10px] text-slate-400 hover:text-white disabled:opacity-40">Não</button>
                <button onClick={handleDelete} disabled={actionLoading} className="px-2 py-1 text-[10px] font-medium bg-red-500/20 border border-red-500/40 text-red-300 rounded hover:bg-red-500/30 disabled:opacity-40">
                  {actionLoading ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Apagar?'}
                </button>
              </>
            ) : (
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="px-2 py-1.5 text-[10px] text-red-400 hover:text-red-300 border border-transparent hover:border-red-500/30 hover:bg-red-500/10 rounded inline-flex items-center gap-1 disabled:opacity-40"
                title="Apagar revisão"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default ReviewToolsPanel;
