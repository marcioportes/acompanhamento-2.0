/**
 * NewReviewDialog
 * @version 2.0.0 (#269 — Revisão por backlog)
 * @description Modal do mentor para criar uma revisão a partir do BACKLOG do plano.
 *
 * Fluxo (#269):
 *   1. Sem picker de período. Dialog lista os trades reviewState='NONE' do plano,
 *      agrupados por dia. Mentor pode destildar trades para deixar para a próxima.
 *   2. Chama useWeeklyReviews.createReviewDraft(planId, { skipTradeIds, cycleKey }).
 *      A callable absorve em bulk os NONE (menos os pulados), seta o ponteiro
 *      plan.activeDraftReviewId e cria o doc DRAFT.
 *   3. Parent abre a Sessão (WeeklyReviewPage) em DRAFT com o reviewId.
 *
 * Unicidade por plano: se já há um DRAFT aberto, reabre o existente (1 rascunho/plano).
 *
 * G1: acesso gated pelo caller (mentor-only). Este componente assume mentor.
 */

import { useState, useMemo, useCallback } from 'react';
import { X, ClipboardList, Loader2 } from 'lucide-react';
import { groupBacklogByDay } from '../../utils/reviewHelpers';
import DebugBadge from '../DebugBadge';

const fmtDayBR = (iso) => {
  if (!iso || iso === 'sem-data') return 'Sem data';
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
};

const fmtMoney = (v) => {
  const n = Number(v) || 0;
  const s = n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n > 0 ? `+${s}` : s;
};

const NewReviewDialog = ({
  plan,
  allTrades,
  cycleKey,
  existingReviews = [],   // reviews do plano (para detectar DRAFT aberto)
  createReviewDraft,      // (planId, { skipTradeIds, cycleKey }) => { reviewId, draftedCount, existing }
  onCreated,              // (reviewId) => void — parent abre a Sessão
  onClose,
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // Set de tradeIds que o mentor optou por PULAR (ficam NONE para a próxima revisão).
  const [skipped, setSkipped] = useState(() => new Set());

  // Backlog do plano (reviewState='NONE'), agrupado por dia.
  const groups = useMemo(
    () => groupBacklogByDay((allTrades || []).filter(t => t.planId === plan?.id)),
    [allTrades, plan?.id]
  );
  const totalPending = useMemo(
    () => groups.reduce((acc, g) => acc + g.trades.length, 0),
    [groups]
  );
  const firstDay = groups.length ? groups[groups.length - 1].day : null;
  const selectedCount = totalPending - skipped.size;

  // DRAFT aberto desse plano (unicidade per-plano — 1 rascunho por vez).
  const existingDraft = useMemo(
    () => (existingReviews || []).find(r => r.status === 'DRAFT') || null,
    [existingReviews]
  );

  const toggleSkip = useCallback((tradeId) => {
    setSkipped(prev => {
      const next = new Set(prev);
      if (next.has(tradeId)) next.delete(tradeId); else next.add(tradeId);
      return next;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    // Já existe rascunho aberto → reabre em vez de duplicar.
    if (existingDraft) {
      onCreated?.(existingDraft.id);
      onClose?.();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await createReviewDraft(plan.id, {
        skipTradeIds: [...skipped],
        cycleKey: cycleKey || null,
      });
      if (!res?.reviewId) throw new Error('CF não retornou reviewId');
      onCreated?.(res.reviewId);
      onClose?.();
    } catch (e) {
      console.error('[NewReviewDialog] createReviewDraft failed', e);
      setError(e.message || 'Falha ao criar rascunho');
    } finally {
      setBusy(false);
    }
  }, [existingDraft, createReviewDraft, plan?.id, skipped, cycleKey, onCreated, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 rounded-xl border border-slate-800 shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Nova Revisão</h3>
          </div>
          <button onClick={onClose} disabled={busy} className="text-slate-500 hover:text-slate-300 disabled:opacity-40">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto">
          <div className="text-xs text-slate-400">
            Plano: <span className="text-white font-medium">{plan?.name || plan?.id}</span>
          </div>

          {existingDraft ? (
            <div className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
              Já existe um rascunho aberto deste plano. Regra: 1 rascunho por plano. Clicando abaixo,
              você reabre o existente. Para começar outro, publique ou descarte o atual primeiro.
            </div>
          ) : totalPending === 0 ? (
            <div className="text-xs text-slate-400 bg-slate-800/40 rounded-lg px-3 py-3 text-center">
              Nenhum trade pendente de revisão neste plano. Um rascunho vazio será criado e absorverá
              automaticamente os próximos trades.
            </div>
          ) : (
            <>
              <div className="text-xs text-slate-300">
                Pendentes{firstDay ? <> desde <span className="text-white font-medium">{fmtDayBR(firstDay)}</span></> : null}:
                {' '}<span className="text-white font-semibold">{selectedCount}</span>
                {skipped.size > 0 && <span className="text-slate-500"> · {skipped.size} pulado(s)</span>}
              </div>

              <div className="space-y-2">
                {groups.map((g) => (
                  <div key={g.day} className="rounded-lg border border-slate-800 bg-slate-800/30">
                    <div className="px-3 py-1.5 text-[11px] text-slate-400 border-b border-slate-800 flex items-center justify-between">
                      <span>{fmtDayBR(g.day)}</span>
                      <span className="text-slate-600">{g.trades.length} trade(s)</span>
                    </div>
                    <ul className="divide-y divide-slate-800/60">
                      {g.trades.map((t) => {
                        const skip = skipped.has(t.id);
                        const result = Number(t.result) || 0;
                        return (
                          <li key={t.id} className="flex items-center gap-2 px-3 py-1.5">
                            <input
                              type="checkbox"
                              checked={!skip}
                              onChange={() => toggleSkip(t.id)}
                              disabled={busy}
                              className="accent-emerald-500 shrink-0"
                              title={skip ? 'Pular — fica para a próxima revisão' : 'Incluir nesta revisão'}
                            />
                            <span className={`text-xs flex-1 truncate ${skip ? 'text-slate-600 line-through' : 'text-slate-200'}`}>
                              {(t.symbol || t.ticker || '—')} {t.side === 'SHORT' ? 'V' : 'C'} {Number(t.qty) || 0}
                            </span>
                            <span className={`text-xs font-mono ${skip ? 'text-slate-600' : result > 0 ? 'text-emerald-400' : result < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                              {fmtMoney(t.result)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          )}

          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-800 shrink-0">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-white disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={busy}
            className="px-3 py-1.5 text-xs font-medium bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-lg hover:bg-emerald-500/30 disabled:opacity-40 flex items-center gap-1.5"
          >
            {busy && <Loader2 className="w-3 h-3 animate-spin" />}
            {existingDraft ? 'Abrir rascunho existente' : 'Criar rascunho →'}
          </button>
        </div>
        <DebugBadge component="NewReviewDialog" />
      </div>
    </div>
  );
};

export default NewReviewDialog;
