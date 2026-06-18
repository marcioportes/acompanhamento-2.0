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
import { doc, onSnapshot } from 'firebase/firestore';
import { PinIcon, X, Loader2, CheckCircle2 } from 'lucide-react';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useWeeklyReviews } from '../../hooks/useWeeklyReviews';
import { isTradeAlreadyReviewed, isTradeInDraft, getDraftTradeNote } from '../../utils/reviewHelpers';

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

const PinToReviewButton = ({ trade }) => {
  const { isMentor } = useAuth();
  const mentor = typeof isMentor === 'function' ? isMentor() : Boolean(isMentor);

  const [plan, setPlan] = useState(null);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(null);
  const [error, setError] = useState(null);

  const planId = trade?.planId;
  const studentIdForReviews = plan?.studentId || null;

  // Carrega plan via onSnapshot quando trade.planId existe
  useEffect(() => {
    if (!planId) { setPlan(null); return undefined; }
    const unsubPlan = onSnapshot(doc(db, 'plans', planId), (snap) => {
      if (snap.exists()) setPlan({ id: snap.id, ...snap.data() });
      else setPlan(null);
    });
    return () => { unsubPlan(); };
  }, [planId]);

  const { reviews, createReviewDraft, appendSessionNotes, addIncludedTrade, actionLoading } = useWeeklyReviews(studentIdForReviews);

  // Qualquer DRAFT aberto desse plano — unicidade per-plano (1 rascunho por vez).
  // #269: rascunhos por backlog têm planId direto no doc; legados, via frozenSnapshot.
  const existingDraft = useMemo(() => {
    if (!plan?.id) return null;
    return (reviews || []).find(r =>
      r.status === 'DRAFT' &&
      (r.planId === plan.id || r.frozenSnapshot?.planContext?.planId === plan.id)
    ) || null;
  }, [reviews, plan?.id]);

  // B: trade já revisado em CLOSED/ARCHIVED → ocultar botão (não é candidato).
  const tradeAlreadyReviewed = useMemo(
    () => isTradeAlreadyReviewed(trade?.id, reviews),
    [trade?.id, reviews]
  );

  // C: trade já está no rascunho aberto → "Continuar Rascunho".
  const tradeAlreadyInDraft = useMemo(
    () => isTradeInDraft(trade?.id, existingDraft),
    [trade?.id, existingDraft]
  );

  const prefix = useMemo(() => fmtTradePrefix(trade), [trade]);

  useEffect(() => {
    if (!open) return;
    if (note) return;
    if (tradeAlreadyInDraft) {
      const existingNote = getDraftTradeNote(trade?.id, existingDraft);
      setNote(existingNote || prefix);
    } else {
      setNote(prefix);
    }
  }, [open, prefix, note, tradeAlreadyInDraft, existingDraft, trade?.id]);

  const handlePin = useCallback(async () => {
    if (!mentor || !plan) return;
    // Nota é OPCIONAL — se vazia (ou só o prefixo), apenas inclui o trade na revisão.
    // Se preenchida, inclui o trade + anota takeaway.
    const trimmed = note.trim();
    const hasNote = trimmed.length > 0 && trimmed !== prefix.trim();

    setBusy(true);
    setError(null);
    try {
      let reviewId = existingDraft?.id;
      if (!reviewId) {
        // #269: cria rascunho por BACKLOG (absorve os NONE do plano + seta o ponteiro).
        const res = await createReviewDraft(plan.id, { cycleKey: null });
        if (!res?.reviewId) throw new Error('CF não retornou reviewId');
        reviewId = res.reviewId;
        await new Promise(r => setTimeout(r, 350));
      }
      // 1) Inclui explicitamente o tradeId (cobre o caso de revisitar trade fora do backlog).
      if (trade?.id) {
        try { await addIncludedTrade(reviewId, trade.id); } catch { /* best-effort */ }
      }
      // 2) Se mentor escreveu nota: anexa em sessionNotes (Notas da Sessão).
      if (hasNote) {
        try { await appendSessionNotes(reviewId, note); } catch { /* */ }
        setFlash('Trade pinado + nota da sessão');
      } else {
        setFlash('Trade incluído no rascunho');
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
  }, [mentor, plan, note, prefix, existingDraft, createReviewDraft, appendSessionNotes, addIncludedTrade, trade?.id]);

  if (!mentor) return null;
  if (!planId) return null;
  if (tradeAlreadyReviewed) return null;

  const label = tradeAlreadyInDraft ? 'Continuar Rascunho' : 'Incluir no Rascunho';

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(v => !v)}
        disabled={!plan}
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
              {label}
            </div>
            <button onClick={() => setOpen(false)} disabled={busy} className="text-slate-500 hover:text-slate-300">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {tradeAlreadyInDraft ? (
            <div className="text-[11px] text-emerald-400/90 bg-emerald-500/5 border border-emerald-500/20 rounded px-2 py-1.5 mb-2">
              Trade já incluído no rascunho aberto. Edite a nota abaixo ou apenas confirme.
            </div>
          ) : existingDraft ? (
            <div className="text-[11px] text-emerald-400/90 bg-emerald-500/5 border border-emerald-500/20 rounded px-2 py-1.5 mb-2">
              Rascunho aberto deste plano. O trade será incluído nele.
            </div>
          ) : (
            <div className="text-[11px] text-amber-400/90 bg-amber-500/5 border border-amber-500/20 rounded px-2 py-1.5 mb-2">
              Nenhum rascunho aberto. Um será criado automaticamente, absorvendo os trades pendentes do plano.
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
              title={note.trim() && note.trim() !== prefix.trim() ? 'Incluir o trade e anotar em Notas da Sessão' : 'Apenas incluir o trade na revisão (sem nota)'}
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
