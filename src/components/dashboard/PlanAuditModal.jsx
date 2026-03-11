/**
 * PlanAuditModal
 * @version 1.0.0 (v1.19.1)
 * @description Modal de auditoria bidirecional do plano.
 *   Ida: PL do plano ← soma dos trades
 *   Volta: Compliance dos trades ← parâmetros do plano (RO%, RR)
 * 
 * Fluxo: Abrir → Diagnosticar (leitura) → Saudável | Divergente → Corrigir (escrita)
 */

import { useState } from 'react';
import {
  ShieldCheck, AlertTriangle, CheckCircle2, ArrowRight,
  RefreshCw, X, ChevronDown, ChevronUp, Loader2
} from 'lucide-react';
import { formatCurrencyDynamic } from '../../utils/currency';
import DebugBadge from '../DebugBadge';

const STATES = {
  IDLE: 'idle',
  DIAGNOSING: 'diagnosing',
  HEALTHY: 'healthy',
  DIVERGENT: 'divergent',
  FIXING: 'fixing',
  FIXED: 'fixed',
};

const Spinner = ({ message }) => (
  <div className="flex flex-col items-center justify-center py-8 gap-3">
    <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
    {message && <p className="text-xs text-slate-500">{message}</p>}
  </div>
);

const PLComparison = ({ pl, currency }) => {
  const diff = pl.calculated - pl.current;
  return (
    <div className={`rounded-xl border p-4 ${pl.divergent ? 'border-amber-500/40 bg-amber-500/5' : 'border-emerald-500/30 bg-emerald-500/5'}`}>
      <div className="flex items-center gap-2 mb-3">
        {pl.divergent ? (
          <AlertTriangle className="w-4 h-4 text-amber-400" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        )}
        <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
          PL do Plano {pl.divergent ? '— Divergente' : '— Confere'}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <span className="text-[10px] text-slate-500 uppercase block mb-0.5">PL Atual</span>
          <span className={`text-lg font-mono font-bold ${pl.divergent ? 'text-amber-400' : 'text-slate-300'}`}>
            {formatCurrencyDynamic(pl.current, currency)}
          </span>
        </div>
        <ArrowRight className="w-4 h-4 text-slate-600" />
        <div className="flex-1">
          <span className="text-[10px] text-slate-500 uppercase block mb-0.5">PL Calculado (Trades)</span>
          <span className="text-lg font-mono font-bold text-emerald-400">
            {formatCurrencyDynamic(pl.calculated, currency)}
          </span>
        </div>
      </div>
      {pl.divergent && (
        <div className="mt-2 text-xs text-amber-400/80 font-mono">
          Diferença: {diff > 0 ? '+' : ''}{formatCurrencyDynamic(diff, currency)}
        </div>
      )}
    </div>
  );
};

const TradesDiagnostic = ({ trades, currency, expanded, onToggle }) => {
  const allGood = trades.divergent === 0;
  return (
    <div className={`rounded-xl border p-4 ${allGood ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/40 bg-amber-500/5'}`}>
      <div className="flex items-center justify-between cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-2">
          {allGood ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          )}
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Compliance dos Trades
            {allGood
              ? ' — Todos atualizados'
              : ` — ${trades.divergent} de ${trades.total} desatualizados`}
          </span>
        </div>
        {!allGood && (
          expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />
        )}
      </div>

      {!allGood && expanded && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-[50px_70px_1fr_80px_80px] gap-2 text-[10px] text-slate-500 uppercase font-bold px-2">
            <span>Data</span>
            <span>Ativo</span>
            <span>Motivo</span>
            <span>RO Atual</span>
            <span>RO Novo</span>
          </div>
          {trades.details.map((t, idx) => (
            <div
              key={t.id || idx}
              className="grid grid-cols-[50px_70px_1fr_80px_80px] gap-2 items-center text-xs px-2 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/30"
            >
              <span className="text-slate-400 font-mono">{t.date}</span>
              <span className="text-slate-300 font-bold">{t.ticker}</span>
              <span className="text-amber-400/80">{t.reason}</span>
              <span className="text-red-400 font-mono line-through">{t.oldRisk}</span>
              <span className="text-emerald-400 font-mono">{t.newRisk}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const PlanAuditModal = ({
  isOpen,
  onClose,
  planName,
  currency = 'BRL',
  onDiagnose,
  onFix,
}) => {
  const [state, setState] = useState(STATES.IDLE);
  const [data, setData] = useState(null);
  const [expanded, setExpanded] = useState(true);
  const [progressMsg, setProgressMsg] = useState('');

  if (!isOpen) return null;

  const hasDivergence = data && (data.pl.divergent || data.trades.divergent > 0);

  const handleDiagnose = async () => {
    setState(STATES.DIAGNOSING);
    setProgressMsg('Analisando trades e compliance...');
    try {
      const result = await onDiagnose();
      setData(result);
      setState(result.pl.divergent || result.trades.divergent > 0
        ? STATES.DIVERGENT
        : STATES.HEALTHY
      );
    } catch (err) {
      console.error('[PlanAuditModal] Erro diagnóstico:', err);
      setState(STATES.IDLE);
      setData(null);
    }
  };

  const handleFix = async () => {
    setState(STATES.FIXING);
    setProgressMsg('Corrigindo divergências...');
    try {
      const report = await onFix();
      // Re-diagnose to show updated state
      setData({
        pl: { current: report.newPl, calculated: report.newPl, divergent: false },
        trades: { total: data?.trades?.total ?? 0, divergent: 0, details: [] },
      });
      setState(STATES.FIXED);
    } catch (err) {
      console.error('[PlanAuditModal] Erro correção:', err);
      setState(STATES.DIVERGENT); // volta ao estado divergente
    }
  };

  const handleClose = () => {
    setState(STATES.IDLE);
    setData(null);
    setProgressMsg('');
    setExpanded(true);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50"
        onClick={handleClose}
      />
      {/* Modal */}
      <div className="fixed inset-4 md:inset-8 lg:inset-12 z-[51] flex items-center justify-center pointer-events-none">
        <div className="glass-card w-full max-w-lg pointer-events-auto flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                state === STATES.HEALTHY || state === STATES.FIXED
                  ? 'bg-emerald-500/15 border border-emerald-500/30'
                  : state === STATES.DIVERGENT
                  ? 'bg-amber-500/15 border border-amber-500/30'
                  : 'bg-slate-700/50 border border-slate-600/30'
              }`}>
                <ShieldCheck className={`w-5 h-5 ${
                  state === STATES.HEALTHY || state === STATES.FIXED
                    ? 'text-emerald-400'
                    : state === STATES.DIVERGENT
                    ? 'text-amber-400'
                    : 'text-slate-400'
                }`} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-200">Auditoria & Saúde</h3>
                <p className="text-xs text-slate-500">{planName}</p>
              </div>
            </div>
            <button onClick={handleClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
            {state === STATES.IDLE && (
              <div className="text-center py-6">
                <ShieldCheck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-400 mb-1">Verificar integridade do plano</p>
                <p className="text-xs text-slate-600">Compara PL e compliance contra os trades registrados</p>
              </div>
            )}

            {(state === STATES.DIAGNOSING || state === STATES.FIXING) && (
              <Spinner message={progressMsg} />
            )}

            {state === STATES.HEALTHY && data && (
              <>
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <p className="text-sm text-emerald-300">Plano saudável. PL e compliance conferem.</p>
                </div>
                <PLComparison pl={data.pl} currency={currency} />
                <TradesDiagnostic trades={data.trades} currency={currency} expanded={expanded} onToggle={() => setExpanded(!expanded)} />
              </>
            )}

            {state === STATES.FIXED && data && (
              <>
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <p className="text-sm text-emerald-300">Divergências corrigidas. Plano saudável.</p>
                </div>
                <PLComparison pl={data.pl} currency={currency} />
                <TradesDiagnostic trades={data.trades} currency={currency} expanded={expanded} onToggle={() => setExpanded(!expanded)} />
              </>
            )}

            {state === STATES.DIVERGENT && data && (
              <>
                <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-amber-300">Divergências encontradas</p>
                    <p className="text-xs text-amber-400/60 mt-0.5">
                      {data.pl.divergent && data.trades.divergent > 0
                        ? 'PL e compliance desatualizados'
                        : data.pl.divergent
                        ? 'PL do plano divergente'
                        : `${data.trades.divergent} trade(s) com compliance desatualizado`}
                    </p>
                  </div>
                </div>
                <PLComparison pl={data.pl} currency={currency} />
                <TradesDiagnostic trades={data.trades} currency={currency} expanded={expanded} onToggle={() => setExpanded(!expanded)} />
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-700/50">
            {state === STATES.IDLE && (
              <>
                <button onClick={handleClose} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-slate-300 hover:bg-slate-700/50 transition-colors">
                  Cancelar
                </button>
                <button onClick={handleDiagnose} className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  Diagnosticar
                </button>
              </>
            )}

            {(state === STATES.HEALTHY || state === STATES.FIXED) && (
              <button onClick={handleClose} className="px-4 py-2 rounded-xl text-sm font-bold text-emerald-400 hover:bg-emerald-500/10 transition-colors">
                Fechar
              </button>
            )}

            {state === STATES.DIVERGENT && (
              <>
                <button onClick={handleClose} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-slate-300 hover:bg-slate-700/50 transition-colors">
                  Ignorar
                </button>
                <button onClick={handleFix} className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-amber-600 hover:bg-amber-500 transition-colors flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Corrigir Divergências
                </button>
              </>
            )}
          </div>

          <DebugBadge component="PlanAuditModal" />
        </div>
      </div>
    </>
  );
};

export default PlanAuditModal;
