/**
 * PinToReviewButton
 * @version 1.0.0 (v1.33.0)
 * @description Anotar um ponto da revisão do trade na Revisão Semanal do plano (#102).
 *
 * UX: mentor está no FeedbackPage de um trade, identifica algo que precisa
 * conversar com o aluno na revisão. Click aqui → popover → texto pré-prefixado
 * com metadados do trade → Anotar. Se não houver DRAFT para a semana ISO do
 * trade, cria uma antes de anotar (pergunta explícita).
 *
 * G1: mentor-only. Hide para aluno.
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { PinIcon, X, Loader2, CheckCircle2 } from 'lucide-react';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useWeeklyReviews } from '../../hooks/useWeeklyReviews';
import { getISOWeekKey, getISOWeekRange } from '../../utils/weeklyReviewSnapshot';
import { buildClientSnapshot } from '../../utils/clientSnapshotBuilder';

const fmtTradePrefix = (trade) => {
  if (!trade) return '';
  const date = trade.date || (trade.entryTime ? trade.entryTime.slice(0, 10) : '');
  const [y, m, d] = (date || '').split('-');
  const shortDate = y && m && d ? `${d}/${m}` : (date || '?');
  const time = trade.entryTime ? trade.entryTime.slice(11, 16) : '';
  const symbol = trade.symbol || trade.ticker || '';
  const result = Number(trade.result) || 0;
  const resultStr = result > 0 ? `+${result.toFixed(2)}` : result.toFixed(2);
  return `[${shortDate}${time ? ' ' + time : ''} ${symbol} ${resultStr}] `;
};

const filterTradesByISO = (trades, weekStart, weekEnd) => {
  if (!Array.isArray(trades)) return [];
  return trades.filter(t => {
    const d = t.date || (t.entryTime ? t.entryTime.slice(0, 10) : null);
    if (!d) return false;
    return d >= weekStart && d <= weekEnd;
  });
};

const PinToReviewButton = ({ trade }) => {
  const { isMentor } = useAuth();
  const mentor = typeof isMentor === 'function' ? isMentor() : Boolean(isMentor);

  const [plan, setPlan] = useState(null);
  const [planTrades, setPlanTrades] = useState([]);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(null);
  const [error, setError] = useState(null);

  const planId = trade?.planId;
  const studentIdForReviews = plan?.studentId || null;

  // Carrega plan e planTrades via onSnapshot quando trade.planId existe
  useEffect(() => {
    if (!planId) { setPlan(null); setPlanTrades([]); return undefined; }
    const unsubPlan = onSnapshot(doc(db, 'plans', planId), (snap) => {
      if (snap.exists()) setPlan({ id: snap.id, ...snap.data() });
      else setPlan(null);
    });
    const tradesQ = query(collection(db, 'trades'), where('planId', '==', planId));
    const unsubTrades = onSnapshot(tradesQ, (snap) => {
      setPlanTrades(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubPlan(); unsubTrades(); };
  }, [planId]);

  const { reviews, createReview, appendTakeaway, addIncludedTrade, actionLoading } = useWeeklyReviews(studentIdForReviews);

  // Semana ISO de HOJE (quando o mentor está conduzindo a revisão).
  // Revisão é uma por semana. Mentor pode estar revisando trade antigo — o ponto
  // vai pro rascunho da semana atual, não da semana do trade (o prefixo do texto
  // já carrega a data do trade original).
  const todayISO = useMemo(() => {
    const today = new Date();
    return { key: getISOWeekKey(today), range: getISOWeekRange(today) };
  }, []);

  // Qualquer DRAFT aberto desse plano — unicidade per-plano (1 rascunho por vez).
  // Se existe (independente de janela ISO/custom), pin anota nele.
  const existingDraft = useMemo(() => {
    if (!plan?.id) return null;
    return (reviews || []).find(r =>
      r.status === 'DRAFT' &&
      r.frozenSnapshot?.planContext?.planId === plan.id
    ) || null;
  }, [reviews, plan?.id]);

  const prefix = useMemo(() => fmtTradePrefix(trade), [trade]);

  useEffect(() => {
    if (open && !note) setNote(prefix);
  }, [open, prefix, note]);

  const handlePin = useCallback(async () => {
    if (!mentor || !plan || !todayISO) return;
    // Nota é OPCIONAL — se vazia (ou só o prefixo), apenas inclui o trade na revisão.
    // Se preenchida, inclui o trade + anota takeaway.
    const trimmed = note.trim();
    const hasNote = trimmed.length > 0 && trimmed !== prefix.trim();

    setBusy(true);
    setError(null);
    try {
      let reviewId = existingDraft?.id;
      if (!reviewId) {
        // Cria um DRAFT da semana ISO atual com snapshot computado
        const weekTrades = filterTradesByISO(planTrades, todayISO.range.weekStart, todayISO.range.weekEnd);
        const snapshot = buildClientSnapshot({
          plan,
          trades: weekTrades,
          cycleKey: null,
          emotionalMetrics: null,
        });
        const res = await createReview({
          studentId: plan.studentId,
          planId: plan.id,
          weekStart: todayISO.range.weekStart,
          weekEnd: todayISO.range.weekEnd,
          periodKey: todayISO.key,
          customPeriod: null,
          cycleKey: null,
          snapshot,
        });
        if (!res?.reviewId) throw new Error('CF não retornou reviewId');
        reviewId = res.reviewId;
        await new Promise(r => setTimeout(r, 350));
      }
      // 1) SEMPRE inclui o tradeId no set explícito (Stage 2.5).
      if (trade?.id) {
        try { await addIncludedTrade(reviewId, trade.id); } catch { /* best-effort */ }
      }
      // 2) Append da nota em takeaways SÓ se mentor escreveu algo (Stage 4 troca para checklist).
      if (hasNote) {
        await appendTakeaway(reviewId, note);
        setFlash(`Trade pinado + anotação em ${todayISO.key}`);
      } else {
        setFlash(`Trade incluído em ${todayISO.key}`);
      }
      setNote('');
      setOpen(false);
      setTimeout(() => setFlash(null), 2500);
    } catch (e) {
      console.error('[PinToReviewButton]', e);
      setError(e.message || 'Falha ao incluir trade');
    } finally {
      setBusy(false);
    }
  }, [mentor, plan, todayISO, note, prefix, existingDraft, planTrades, createReview, appendTakeaway, addIncludedTrade, trade?.id]);

  if (!mentor) return null;
  if (!planId) return null;

  const draftLabel = existingDraft?.periodKey
    ? existingDraft.periodKey
    : (todayISO?.key || 'semana');
  const label = existingDraft
    ? `Incluir na revisão ${draftLabel}`
    : `Criar rascunho ${todayISO?.key || 'semana'} + incluir`;

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(v => !v)}
        disabled={!plan || !todayISO}
        className="px-3 py-1.5 text-xs font-medium bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 rounded-lg hover:bg-emerald-500/25 disabled:opacity-40 inline-flex items-center gap-1.5"
        title="Anotar ponto para conversar na Revisão Semanal"
      >
        <PinIcon className="w-3.5 h-3.5" />
        {label}
      </button>

      {flash && !open && (
        <div className="absolute right-0 top-full mt-2 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-lg px-3 py-1.5 text-xs flex items-center gap-1.5 whitespace-nowrap">
          <CheckCircle2 className="w-3 h-3" /> {flash}
        </div>
      )}

      {open && (
        <div className="absolute right-0 top-full mt-2 z-20 w-96 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-white flex items-center gap-1.5">
              <PinIcon className="w-3 h-3 text-emerald-400" />
              {existingDraft ? `Incluir trade em ${draftLabel}` : `Criar rascunho ${todayISO?.key} + incluir trade`}
            </div>
            <button onClick={() => setOpen(false)} disabled={busy} className="text-slate-500 hover:text-slate-300">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {existingDraft ? (
            <div className="text-[11px] text-emerald-400/90 bg-emerald-500/5 border border-emerald-500/20 rounded px-2 py-1.5 mb-2">
              Anotando no rascunho aberto: {existingDraft.periodKey} ({existingDraft.weekStart} → {existingDraft.weekEnd}). 1 rascunho por plano — publique ou apague antes de abrir outro.
            </div>
          ) : (
            <div className="text-[11px] text-amber-400/90 bg-amber-500/5 border border-amber-500/20 rounded px-2 py-1.5 mb-2">
              Nenhum rascunho aberto deste plano. Ao anotar, um rascunho será criado automaticamente com snapshot dos trades em {todayISO?.range.weekStart} → {todayISO?.range.weekEnd}.
            </div>
          )}

          <label className="text-[10px] text-slate-500 block mb-1">
            Nota (opcional — se vazio, só inclui o trade):
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={busy}
            rows={4}
            className="w-full input-dark text-xs font-mono"
            placeholder={`${prefix}Ponto para conversar (opcional)...`}
          />

          {error && (
            <div className="text-[11px] text-red-400 mt-1">{error}</div>
          )}

          <div className="flex items-center justify-end gap-2 mt-3">
            <button
              onClick={() => { setOpen(false); setNote(''); setError(null); }}
              disabled={busy}
              className="px-2.5 py-1 text-[11px] text-slate-400 hover:text-white disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              onClick={handlePin}
              disabled={busy || actionLoading}
              className="px-3 py-1 text-[11px] font-medium bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded hover:bg-emerald-500/30 disabled:opacity-40 inline-flex items-center gap-1"
              title={note.trim() && note.trim() !== prefix.trim() ? 'Incluir o trade e anotar o takeaway' : 'Apenas incluir o trade na revisão (sem nota)'}
            >
              {busy && <Loader2 className="w-3 h-3 animate-spin" />}
              {note.trim() && note.trim() !== prefix.trim() ? 'Incluir + anotar' : 'Incluir'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PinToReviewButton;
