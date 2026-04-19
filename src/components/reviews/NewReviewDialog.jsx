/**
 * NewReviewDialog
 * @version 1.0.0 (v1.33.0)
 * @description Modal do mentor para criar uma nova revisão semanal (issue #102, Fase C.3).
 *
 * Fluxo:
 *   1. Mentor escolhe período (ISO week atual default, ajustável livre G3)
 *   2. Dialog computa snapshot client-side via buildClientSnapshot
 *   3. Chama useWeeklyReviews.createReview → retorna reviewId
 *   4. Parent abre WeeklyReviewModal em DRAFT com o reviewId
 *
 * G1: acesso gated pelo caller (mentor-only). Este componente assume mentor.
 * G3: customPeriod marcado no snapshot — UI downstream hide comparação.
 */

import { useState, useMemo, useCallback } from 'react';
import { X, Calendar, AlertTriangle, Loader2 } from 'lucide-react';
import {
  getISOWeekKey,
  getISOWeekRange,
} from '../../utils/weeklyReviewSnapshot';
import { buildClientSnapshot } from '../../utils/clientSnapshotBuilder';
import DebugBadge from '../DebugBadge';

const todayISO = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
};

const filterTradesByRange = (trades, startISO, endISO) => {
  if (!Array.isArray(trades)) return [];
  return trades.filter(t => {
    const d = t.date || (t.entryTime ? t.entryTime.slice(0, 10) : null);
    if (!d) return false;
    return d >= startISO && d <= endISO;
  });
};

const NewReviewDialog = ({
  plan,
  allTrades,
  cycleKey,
  emotionalMetrics,
  createReview,          // (payload) => {reviewId, status}
  onCreated,             // (reviewId) => void — parent abre WeeklyReviewModal
  onClose,
}) => {
  const [mode, setMode] = useState('iso');  // 'iso' | 'custom'
  const [customStart, setCustomStart] = useState(todayISO());
  const [customEnd, setCustomEnd] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const today = useMemo(() => new Date(), []);
  const isoRange = useMemo(() => getISOWeekRange(today), [today]);
  const isoKey = useMemo(() => getISOWeekKey(today), [today]);

  const periodInfo = useMemo(() => {
    if (mode === 'iso') {
      return {
        weekStart: isoRange.weekStart,
        weekEnd: isoRange.weekEnd,
        periodKey: isoKey,
        customPeriod: null,
        isCustom: false,
      };
    }
    const valid = customStart && customEnd && customStart <= customEnd;
    return {
      weekStart: valid ? customStart : isoRange.weekStart,
      weekEnd: valid ? customEnd : isoRange.weekEnd,
      periodKey: `CUSTOM-${Date.now()}`,
      customPeriod: valid ? { start: customStart, end: customEnd } : null,
      isCustom: true,
      valid,
    };
  }, [mode, isoRange, isoKey, customStart, customEnd]);

  const previewTrades = useMemo(
    () => filterTradesByRange(allTrades, periodInfo.weekStart, periodInfo.weekEnd),
    [allTrades, periodInfo.weekStart, periodInfo.weekEnd]
  );

  const canSubmit = mode === 'iso' || periodInfo.valid;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const snapshot = buildClientSnapshot({
        plan,
        trades: previewTrades,
        cycleKey,
        emotionalMetrics,
      });
      const payload = {
        studentId: plan.studentId,
        planId: plan.id,
        weekStart: periodInfo.weekStart,
        weekEnd: periodInfo.weekEnd,
        periodKey: periodInfo.periodKey,
        customPeriod: periodInfo.customPeriod,
        cycleKey,
        snapshot,
      };
      const res = await createReview(payload);
      if (!res?.reviewId) throw new Error('CF não retornou reviewId');
      onCreated?.(res.reviewId);
      onClose?.();
    } catch (e) {
      console.error('[NewReviewDialog] create failed', e);
      setError(e.message || 'Falha ao criar revisão');
    } finally {
      setBusy(false);
    }
  }, [canSubmit, plan, previewTrades, cycleKey, emotionalMetrics, periodInfo, createReview, onCreated, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 rounded-xl border border-slate-800 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Nova Revisão Semanal</h3>
          </div>
          <button onClick={onClose} disabled={busy} className="text-slate-500 hover:text-slate-300 disabled:opacity-40">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="text-xs text-slate-400">Plano: <span className="text-white font-medium">{plan?.name || plan?.id}</span></div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode('iso')}
              disabled={busy}
              className={`px-3 py-2 text-xs rounded-lg border transition-colors ${
                mode === 'iso'
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
              }`}
            >
              Semana ISO atual
              <div className="text-[10px] text-slate-500 mt-1">{isoKey}</div>
            </button>
            <button
              onClick={() => setMode('custom')}
              disabled={busy}
              className={`px-3 py-2 text-xs rounded-lg border transition-colors ${
                mode === 'custom'
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                  : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
              }`}
            >
              Período personalizado
              <div className="text-[10px] text-slate-500 mt-1">G3</div>
            </button>
          </div>

          {mode === 'iso' && (
            <div className="text-xs text-slate-400 bg-slate-800/40 rounded-lg px-3 py-2">
              De <span className="text-white font-mono">{isoRange.weekStart}</span> até{' '}
              <span className="text-white font-mono">{isoRange.weekEnd}</span>
            </div>
          )}

          {mode === 'custom' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <label className="text-slate-400 w-10">Início</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  disabled={busy}
                  className="flex-1 input-dark"
                />
              </div>
              <div className="flex items-center gap-2 text-xs">
                <label className="text-slate-400 w-10">Fim</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  disabled={busy}
                  className="flex-1 input-dark"
                />
              </div>
              {!periodInfo.valid && (
                <div className="text-[11px] text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Início precisa ser anterior ou igual ao fim.
                </div>
              )}
              <div className="text-[11px] text-amber-400/80 bg-amber-500/5 rounded px-2 py-1 border border-amber-500/20">
                G3: comparação com revisão anterior ficará oculta em períodos customizados.
              </div>
            </div>
          )}

          <div className="bg-slate-800/30 rounded-lg px-3 py-2 text-xs">
            <div className="text-slate-400">Trades no período selecionado:</div>
            <div className="text-white font-mono text-sm">{previewTrades.length}</div>
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-800">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-white disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || busy}
            className="px-3 py-1.5 text-xs font-medium bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-lg hover:bg-emerald-500/30 disabled:opacity-40 flex items-center gap-1.5"
          >
            {busy && <Loader2 className="w-3 h-3 animate-spin" />}
            Criar revisão DRAFT
          </button>
        </div>
        <DebugBadge component="NewReviewDialog" />
      </div>
    </div>
  );
};

export default NewReviewDialog;
