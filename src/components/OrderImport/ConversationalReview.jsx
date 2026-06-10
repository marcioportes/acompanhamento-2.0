/**
 * ConversationalReview.jsx
 * @version 1.0.0 (v1.37.0 — issue #156 Fase C)
 * @description Tela de revisão conversacional — consome a fila de operações
 *   classificadas (match_confident / ambiguous / new / autoliq) e expõe um
 *   ConversationalOpCard por operação.
 *
 * Bloqueia avanço até que TODAS as operações tenham decisão do aluno
 * (userDecision !== 'pending'). Descartar é decisão válida (não-op downstream).
 *
 * Gate de cobertura de plano: quando `coverageGap.hasCoverageGap === true`, o
 * botão de avançar fica desabilitado e um banner amarelo aponta para o fluxo
 * de criação de plano retroativo (via flag _autoOpenPlanModal do AccountDetailPage).
 */

import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, AlertTriangle, CheckCircle, Loader2, CheckCheck } from 'lucide-react';
import DebugBadge from '../DebugBadge';
import ConversationalOpCard from './ConversationalOpCard';
import AdjustmentModal from './AdjustmentModal';
import { CLASSIFICATION } from '../../utils/orderTradeCreation';

const CLASSIFICATION_LABEL = {
  [CLASSIFICATION.MATCH_CONFIDENT]: 'Hipótese clara',
  [CLASSIFICATION.AMBIGUOUS]: 'Ambígua',
  [CLASSIFICATION.NEW]: 'Nova',
  [CLASSIFICATION.AUTOLIQ]: 'AutoLiq',
};

/**
 * @param {Object} props
 * @param {Array} props.queue — operações pendentes. Cada item = { operation, classification, matchCandidates, tradeId?, userDecision, ... }
 * @param {Map<string, Object>} [props.tradesById]
 * @param {Map<string, Object[]>} [props.tradesByDate] — YYYY-MM-DD → trades do dia na conta (para pick em `new`)
 * @param {{ hasCoverageGap: boolean, gapOperations: Array }} [props.coverageGap]
 * @param {Function} props.onDecide — (opIndex, payload) => void. payload = { decision: 'confirmed'|'discarded'|'adjusted', tradeId?, adjustments? }
 * @param {Function} props.onBack
 * @param {Function} props.onSubmit — chamado quando todas ops têm decisão
 * @param {Function} [props.onCreateRetroactivePlan] — navega para AccountDetailPage com _autoOpenPlanModal
 * @param {boolean} [props.loading]
 */
/** opMs (ms) → data BR DD/MM/YYYY HH:MM (INV-06). null → rótulo neutro. */
const formatGapDate = (ms) => {
  if (ms == null) return 'sem data';
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const ConversationalReview = ({
  queue = [],
  tradesById,
  tradesByDate,
  coverageGap = { hasCoverageGap: false, gapOperations: [] },
  gapResolution = null,           // null | 'accepted' | 'discarded'
  onDecide,
  onBack,
  onSubmit,
  onCreateRetroactivePlan,
  onAcceptGapInPlan,
  onDiscardGap,
  loading = false,
}) => {
  const totals = useMemo(() => {
    const byClass = { match_confident: 0, ambiguous: 0, new: 0, autoliq: 0 };
    let pending = 0;
    let confirmed = 0;
    let discarded = 0;
    for (const item of queue) {
      if (item.classification && byClass[item.classification] != null) {
        byClass[item.classification] += 1;
      }
      if (!item.userDecision || item.userDecision === 'pending') pending += 1;
      else if (item.userDecision === 'confirmed' || item.userDecision === 'adjusted') confirmed += 1;
      else if (item.userDecision === 'discarded') discarded += 1;
    }
    return {
      total: queue.length,
      byClass,
      pending,
      confirmed,
      discarded,
    };
  }, [queue]);

  const allDecided = queue.length > 0 && totals.pending === 0;
  // Gap resolvido = não há gap OU o usuário já decidiu (aceitar no plano / descartar).
  const gapResolved = !coverageGap.hasCoverageGap || gapResolution != null;
  const canSubmit = allDecided && gapResolved && !loading;

  // Aceitar tudo pendente com defaults sensatos:
  //  - MATCH_CONFIDENT → confirma com tradeId correlacionado
  //  - AMBIGUOUS       → confirma com candidato de maior score
  //  - NEW             → confirma (cria novo trade)
  //  - AUTOLIQ         → confirma como trade real
  // Aluno pode reverter individualmente depois.
  const handleAcceptAllPending = () => {
    queue.forEach((item, idx) => {
      if (item.userDecision && item.userDecision !== 'pending') return;

      let payload;
      if (item.classification === CLASSIFICATION.MATCH_CONFIDENT && item.tradeId) {
        payload = { decision: 'confirmed', tradeId: item.tradeId };
      } else if (item.classification === CLASSIFICATION.AMBIGUOUS && item.matchCandidates?.length) {
        const best = [...item.matchCandidates].sort((a, b) => b.score - a.score)[0];
        payload = { decision: 'confirmed', tradeId: best.tradeId };
      } else {
        // NEW e AUTOLIQ — confirmar sem tradeId (cria novo)
        payload = { decision: 'confirmed' };
      }
      onDecide(idx, payload);
    });
  };

  // AdjustmentModal state — aberto quando aluno clica "Ajustar" em match_confident
  const [adjustingIdx, setAdjustingIdx] = useState(null);
  const adjustingItem = adjustingIdx != null ? queue[adjustingIdx] : null;
  const adjustingTrade = adjustingItem && adjustingItem.tradeId && tradesById?.get
    ? tradesById.get(adjustingItem.tradeId) ?? null
    : null;

  const getDayCandidates = (op) => {
    if (!tradesByDate) return [];
    const dateKey = (op?.entryTime || op?.entryOrders?.[0]?.filledAt || '').slice(0, 10);
    if (!dateKey) return [];
    return tradesByDate.get(dateKey) || [];
  };

  return (
    <div className="space-y-4" data-testid="conversational-review">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="px-2 py-1 rounded bg-slate-800 text-slate-300">
          {totals.total} operaç{totals.total === 1 ? 'ão' : 'ões'}
        </span>
        {totals.byClass.match_confident > 0 && (
          <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-300">
            {totals.byClass.match_confident} clara{totals.byClass.match_confident === 1 ? '' : 's'}
          </span>
        )}
        {totals.byClass.ambiguous > 0 && (
          <span className="px-2 py-1 rounded bg-amber-500/10 text-amber-300">
            {totals.byClass.ambiguous} ambígua{totals.byClass.ambiguous === 1 ? '' : 's'}
          </span>
        )}
        {totals.byClass.new > 0 && (
          <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-300">
            {totals.byClass.new} nova{totals.byClass.new === 1 ? '' : 's'}
          </span>
        )}
        {totals.byClass.autoliq > 0 && (
          <span className="px-2 py-1 rounded bg-red-500/10 text-red-300">
            {totals.byClass.autoliq} AutoLiq
          </span>
        )}
        <span className="ml-auto text-slate-500">
          {totals.confirmed} confirmada{totals.confirmed === 1 ? '' : 's'} · {totals.discarded} descartada{totals.discarded === 1 ? '' : 's'} · {totals.pending} pendente{totals.pending === 1 ? '' : 's'}
        </span>
        {totals.pending > 0 && (
          <button
            type="button"
            onClick={handleAcceptAllPending}
            className="flex items-center gap-1 px-2.5 py-1 text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded transition-colors"
            title="Confirma todas as pendentes com defaults: hipótese clara → match; ambígua → maior score; nova/autoliq → cria. Dá pra reverter cada uma depois."
            data-testid="accept-all-pending"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Aceitar todas ({totals.pending})
          </button>
        )}
      </div>

      {/* Coverage gap banner */}
      {coverageGap.hasCoverageGap && (
        <div
          className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30"
          data-testid="coverage-gap-banner"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs text-amber-200">
              <p className="font-medium">
                {coverageGap.gapOperations.length} operaç{coverageGap.gapOperations.length === 1 ? 'ão' : 'ões'} em período sem plano vigente
                {gapResolution === 'accepted' && ' — aceitas no plano atual.'}
                {gapResolution === 'discarded' && ' — descartadas.'}
              </p>
              {gapResolution == null && (
                <p className="mt-1 text-amber-300/80">
                  Têm data anterior ao plano existente. Escolha o que fazer com elas:
                </p>
              )}
              <ul className="mt-2 space-y-0.5" data-testid="coverage-gap-list">
                {coverageGap.gapOperations.map((g, i) => (
                  <li key={i} className="flex items-center gap-2 text-amber-100/90">
                    <span className="font-mono">{formatGapDate(g.opMs)}</span>
                    <span className="text-amber-300/60">·</span>
                    <span className="font-mono">{(g.operation?.instrument || '—').toUpperCase()}</span>
                    <span className="text-amber-300/60">— {g.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {gapResolution == null && (
            <div className="flex flex-wrap gap-2 mt-3 justify-end">
              {onDiscardGap && (
                <button
                  type="button"
                  onClick={onDiscardGap}
                  data-testid="gap-discard"
                  className="px-3 py-1.5 text-xs font-medium bg-red-500/15 hover:bg-red-500/25 text-red-200 border border-red-500/40 rounded-lg transition-colors"
                >
                  Descartar estas
                </button>
              )}
              {onAcceptGapInPlan && (
                <button
                  type="button"
                  onClick={onAcceptGapInPlan}
                  data-testid="gap-accept"
                  className="px-3 py-1.5 text-xs font-medium bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border border-emerald-500/40 rounded-lg transition-colors"
                >
                  Aceitar no plano atual
                </button>
              )}
              {onCreateRetroactivePlan && (
                <button
                  type="button"
                  onClick={onCreateRetroactivePlan}
                  className="px-3 py-1.5 text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded-lg transition-colors"
                >
                  Criar plano retroativo
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Cards */}
      <div className="space-y-2">
        {queue.map((item, idx) => {
          const discarded = item.userDecision === 'discarded';
          const confirmed = item.userDecision === 'confirmed' || item.userDecision === 'adjusted';

          if (confirmed || discarded) {
            return (
              <div
                key={item.operation.operationId || idx}
                className={`glass-card p-3 flex items-center gap-2 border-slate-700/40 ${
                  discarded ? 'opacity-50' : ''
                }`}
                data-testid={`decided-row-${item.userDecision}`}
              >
                <CheckCircle className={`w-4 h-4 shrink-0 ${discarded ? 'text-slate-500' : 'text-emerald-400'}`} />
                <span className="text-[11px] font-mono text-slate-300">{item.operation.instrument}</span>
                <span className="text-[10px] text-slate-500">{item.operation.side}</span>
                <span className="text-[10px] text-slate-500">{item.operation.totalQty}×</span>
                <span className="text-[10px] text-slate-600 ml-2">
                  {CLASSIFICATION_LABEL[item.classification] || item.classification}
                </span>
                <span className={`ml-auto text-[10px] ${discarded ? 'text-slate-500' : 'text-emerald-400'}`}>
                  {discarded ? 'Descartada' : 'Confirmada'}
                </span>
                <button
                  type="button"
                  onClick={() => onDecide(idx, { decision: 'pending' })}
                  className="text-[10px] text-slate-500 hover:text-slate-300 underline ml-2"
                >
                  Reverter
                </button>
              </div>
            );
          }

          return (
            <ConversationalOpCard
              key={item.operation.operationId || idx}
              operation={item.operation}
              matchCandidates={item.matchCandidates}
              tradeId={item.tradeId}
              tradesById={tradesById}
              dayCandidates={getDayCandidates(item.operation)}
              onConfirm={(payload) => onDecide(idx, payload)}
              onAdjust={() => setAdjustingIdx(idx)}
              onDiscard={() => onDecide(idx, { decision: 'discarded' })}
              onPointToExisting={({ tradeId }) => onDecide(idx, { decision: 'confirmed', tradeId, promotedFrom: 'new' })}
            />
          );
        })}
      </div>

      {/* Adjustment modal — fino */}
      {adjustingItem && (
        <AdjustmentModal
          operation={adjustingItem.operation}
          trade={adjustingTrade}
          onConfirm={({ finalFields }) => {
            onDecide(adjustingIdx, {
              decision: 'adjusted',
              tradeId: adjustingItem.tradeId,
              adjustments: finalFields,
            });
            setAdjustingIdx(null);
          }}
          onCancel={() => setAdjustingIdx(null)}
        />
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-800/50">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 px-3 py-2 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar
        </button>

        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="flex items-center gap-2 px-4 py-2 text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title={
            coverageGap.hasCoverageGap && !gapResolved
              ? 'Resolva as operações sem plano (descartar / aceitar no plano / criar plano retroativo)'
              : !allDecided
                ? `Decida as ${totals.pending} operações pendentes antes de avançar`
                : 'Processar decisões'
          }
          data-testid="submit-decisions"
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              Processar {totals.confirmed > 0 ? `${totals.confirmed} ` : ''}decisõ{totals.confirmed === 1 ? 'es' : 'es'}
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>

      <DebugBadge component="ConversationalReview" />
    </div>
  );
};

export default ConversationalReview;
