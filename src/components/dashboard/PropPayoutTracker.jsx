/**
 * PropPayoutTracker
 * @version 1.0.0 (v1.27.0)
 * @description Painel de payout tracking para contas PROP.
 *   Qualifying days tracker, eligibility checklist, simulador de saque,
 *   histórico de withdrawals.
 *
 * Ref: issue #134 Fase D, epic #52
 */

import { useState, useMemo } from 'react';
import { DollarSign, CheckCircle, XCircle, Calculator, History, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrencyDynamic } from '../../utils/currency';
import {
  calculateQualifyingDays,
  calculatePayoutEligibility,
  simulateWithdrawal,
  getWithdrawalHistory,
} from '../../utils/propFirmPayout';
import DebugBadge from '../DebugBadge';

// ============================================
// EligibilityCheck — item do checklist
// ============================================

const EligibilityCheck = ({ check }) => {
  const Icon = check.met ? CheckCircle : XCircle;
  const color = check.met ? 'text-emerald-400' : 'text-red-400';
  return (
    <div className="flex items-center gap-2 py-1">
      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${color}`} />
      <span className="text-[11px] text-slate-300">{check.rule}</span>
      <span className="text-[10px] text-slate-600 ml-auto">{check.detail}</span>
    </div>
  );
};

// ============================================
// WithdrawalSimulator — simulador de saque
// ============================================

const WithdrawalSimulator = ({ account, template, eligibility, totalWithdrawn, currency }) => {
  const [amount, setAmount] = useState('');
  const propFirm = account?.propFirm;
  const accountSize = template?.accountSize ?? account?.initialBalance ?? 0;
  const drawdownMax = template?.drawdown?.maxAmount ?? 0;
  const currentBalance = account?.currentBalance ?? accountSize;

  const simulation = useMemo(() => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) return null;

    return simulateWithdrawal({
      withdrawalAmount: numAmount,
      currentBalance,
      currentDrawdownThreshold: propFirm?.currentDrawdownThreshold ?? (accountSize - drawdownMax),
      accountSize,
      drawdownMax,
      isLocked: (propFirm?.lockLevel ?? null) !== null || (propFirm?.trailFrozen ?? false),
      payoutSplit: eligibility.payoutSplit,
      firstTierAmount: eligibility.firstTierAmount,
      firstTierSplit: eligibility.firstTierSplit,
      totalWithdrawn,
    });
  }, [amount, currentBalance, propFirm, accountSize, drawdownMax, eligibility, totalWithdrawn]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Calculator className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">Simulador de Saque</span>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`Max: ${formatCurrencyDynamic(eligibility.availableForWithdrawal, currency)}`}
            className="w-full pl-7 pr-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded text-sm text-white font-mono placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none"
            min="0"
            step="100"
          />
        </div>
        {eligibility.availableForWithdrawal > 0 && (
          <button
            onClick={() => setAmount(eligibility.availableForWithdrawal.toFixed(0))}
            className="px-2 py-2 text-[10px] text-blue-400 border border-blue-500/30 rounded hover:bg-blue-500/10 transition-colors"
          >
            MAX
          </button>
        )}
      </div>

      {simulation && (
        <div className={`rounded border p-3 space-y-2 ${simulation.valid ? 'border-slate-700/50 bg-slate-800/30' : 'border-red-500/30 bg-red-500/5'}`}>
          {simulation.valid ? (
            <>
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div>
                  <p className="text-slate-600 mb-0.5">Você recebe</p>
                  <p className="text-emerald-400 font-bold font-mono">{formatCurrencyDynamic(simulation.traderReceives, currency)}</p>
                  <p className="text-[10px] text-slate-600">split {(simulation.effectiveSplit * 100).toFixed(0)}%</p>
                </div>
                <div>
                  <p className="text-slate-600 mb-0.5">Mesa retém</p>
                  <p className="text-slate-400 font-mono">{formatCurrencyDynamic(simulation.firmKeeps, currency)}</p>
                </div>
              </div>
              <div className="border-t border-slate-700/50 pt-2 grid grid-cols-2 gap-3 text-[11px]">
                <div>
                  <p className="text-slate-600 mb-0.5">Novo saldo</p>
                  <p className="text-white font-mono">{formatCurrencyDynamic(simulation.newBalance, currency)}</p>
                </div>
                <div>
                  <p className="text-slate-600 mb-0.5">Novo threshold DD</p>
                  <p className={`font-mono ${simulation.newDistanceToDD < 0.20 ? 'text-red-400' : simulation.newDistanceToDD < 0.40 ? 'text-amber-400' : 'text-white'}`}>
                    {formatCurrencyDynamic(simulation.newThreshold, currency)}
                  </p>
                  <p className="text-[10px] text-slate-600">
                    margem: {(simulation.newDistanceToDD * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-[11px] text-red-400">{simulation.reason}</p>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================
// PropPayoutTracker — componente principal
// ============================================

const PropPayoutTracker = ({ account, template, drawdownHistory, movements }) => {
  const [expanded, setExpanded] = useState(false);
  const propFirm = account?.propFirm;
  const currency = account?.currency ?? 'USD';

  if (!propFirm || account?.type !== 'PROP') return null;

  const phase = propFirm.phase ?? 'EVALUATION';
  const isFundedPhase = phase === 'SIM_FUNDED' || phase === 'LIVE';

  const accountSize = template?.accountSize ?? account.initialBalance ?? 0;
  const currentBalance = account.currentBalance ?? accountSize;

  // Qualifying days
  const qualifyingResult = useMemo(() => {
    return calculateQualifyingDays(
      drawdownHistory ?? [],
      template?.payout?.qualifyingDays
    );
  }, [drawdownHistory, template?.payout?.qualifyingDays]);

  // Withdrawal history (from movements)
  const { withdrawals, totalWithdrawn } = useMemo(() => {
    return getWithdrawalHistory(movements);
  }, [movements]);

  // Eligibility
  const eligibility = useMemo(() => {
    return calculatePayoutEligibility({
      template,
      propFirm,
      currentBalance,
      accountSize,
      qualifyingResult,
    });
  }, [template, propFirm, currentBalance, accountSize, qualifyingResult]);

  // Header summary
  const headerColor = eligibility.eligible
    ? 'border-emerald-500/30'
    : isFundedPhase
      ? 'border-amber-500/30'
      : 'border-slate-700/50';

  return (
    <div className={`glass-card border ${headerColor} overflow-hidden`}>
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-3 flex items-center justify-between hover:bg-slate-800/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <DollarSign className={`w-4 h-4 ${eligibility.eligible ? 'text-emerald-400' : 'text-slate-500'}`} />
          <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Payout</span>
          {eligibility.eligible ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              Elegível
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/50 text-slate-500 border border-slate-700/50">
              {!isFundedPhase ? 'Requer fase Funded' : `${eligibility.checks.filter(c => c.met).length}/${eligibility.checks.length} critérios`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {totalWithdrawn > 0 && (
            <span className="text-[10px] text-slate-500">
              {withdrawals.length} saque{withdrawals.length !== 1 ? 's' : ''} · {formatCurrencyDynamic(totalWithdrawn, currency)}
            </span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </div>
      </button>

      {/* Body — expandable */}
      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-slate-700/50">

          {/* Eligibility checklist */}
          <div className="pt-3">
            <div className="space-y-0.5">
              {eligibility.checks.map((check, i) => (
                <EligibilityCheck key={i} check={check} />
              ))}
            </div>
          </div>

          {/* Qualifying days detail */}
          {qualifyingResult.requiredDays !== null && (
            <div className="pt-2 border-t border-slate-700/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-slate-500">Qualifying Days</span>
                <span className={`text-[11px] font-medium ${qualifyingResult.met ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {qualifyingResult.qualifyingDays}/{qualifyingResult.requiredDays}
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${qualifyingResult.met ? 'bg-emerald-400' : 'bg-amber-400'}`}
                  style={{ width: `${Math.min(100, (qualifyingResult.qualifyingDays / qualifyingResult.requiredDays) * 100)}%` }}
                />
              </div>
              {template?.payout?.qualifyingDays?.minProfit && (
                <p className="text-[10px] text-slate-600 mt-1">
                  Critério: profit entre ${template.payout.qualifyingDays.minProfit}
                  {template.payout.qualifyingDays.maxProfit ? ` e $${template.payout.qualifyingDays.maxProfit}` : '+'} por dia
                </p>
              )}
            </div>
          )}

          {/* Simulator */}
          <div className="pt-2 border-t border-slate-700/50">
            <WithdrawalSimulator
              account={account}
              template={template}
              eligibility={eligibility}
              totalWithdrawn={totalWithdrawn}
              currency={currency}
            />
          </div>

          {/* Withdrawal history */}
          {withdrawals.length > 0 && (
            <div className="pt-2 border-t border-slate-700/50">
              <div className="flex items-center gap-2 mb-2">
                <History className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">Saques realizados</span>
              </div>
              <div className="space-y-1">
                {withdrawals.slice(0, 10).map((w) => (
                  <div key={w.id} className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">{w.date?.split('-').reverse().join('/')}</span>
                    <span className="text-slate-500">{w.description}</span>
                    <span className="text-red-400 font-mono">-{formatCurrencyDynamic(w.amount, currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <DebugBadge component="PropPayoutTracker" embedded />
    </div>
  );
};

export default PropPayoutTracker;
