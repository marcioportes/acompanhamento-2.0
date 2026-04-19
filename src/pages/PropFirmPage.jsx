/**
 * PropFirmPage — Página dedicada "Mesa Prop" (redesign 4 zonas)
 * @version 2.0.0 (v1.32.0 — Fase F spec v2)
 * @description Redesenho em 4 zonas semânticas:
 *   Zona 1 — STATUS AGORA: PropAlertsBanner + PropAccountCard (gauges + alertas)
 *   Zona 2 — COMO CHEGUEI AQUI: PropEquityCurve + PropHistoricalKPIs
 *   Zona 3 — CONTRATO DA MESA: TemplateCard + PlanoMecanicoCard (grid 2 cols em md+)
 *   Zona 4 — PAYOUT: PropPayoutTracker
 *
 *   AI Approach Plan migrou para issue #148 (tela dedicada com gate 4D + 30 shadow trades).
 *
 * Ref: issue #145, CHUNK-02 + CHUNK-17, INV-17
 */

import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import StudentContextProvider from '../contexts/StudentContextProvider';
import { useStudentContext } from '../hooks/useStudentContext';
import { useAccounts } from '../hooks/useAccounts';
import { usePlans } from '../hooks/usePlans';
import { usePropFirmTemplates } from '../hooks/usePropFirmTemplates';
import { useDrawdownHistory } from '../hooks/useDrawdownHistory';
import { useMovements } from '../hooks/useMovements';
import { derivePropAlerts, getDangerAlerts } from '../utils/propFirmAlerts';
import { formatCurrencyDynamic } from '../utils/currency';
import { calculateAttackPlan } from '../utils/attackPlanCalculator';
import { DEFAULT_ATTACK_PROFILE } from '../constants/propFirmDefaults';
import ContextBar from '../components/ContextBar';
import PropAccountCard from '../components/dashboard/PropAccountCard';
import PropAlertsBanner from '../components/dashboard/PropAlertsBanner';
import PropPayoutTracker from '../components/dashboard/PropPayoutTracker';
import PropEquityCurve from '../components/dashboard/PropEquityCurve';
import PropHistoricalKPIs from '../components/dashboard/PropHistoricalKPIs';
import TemplateCard from '../components/dashboard/TemplateCard';
import PlanoMecanicoCard from '../components/dashboard/PlanoMecanicoCard';
import DebugBadge from '../components/DebugBadge';

const ZoneHeader = ({ number, title, subtitle }) => (
  <div className="flex items-baseline gap-2 pt-2">
    <span className="text-[10px] uppercase tracking-widest text-slate-600 font-bold">
      Zona {number}
    </span>
    <span className="text-xs text-slate-400">— {title}</span>
    {subtitle && <span className="text-[11px] text-slate-600 ml-auto">{subtitle}</span>}
  </div>
);

const PropFirmPageBody = ({ viewAs }) => {
  const overrideStudentId = viewAs?.uid || null;
  const studentCtx = useStudentContext();
  const { accounts, updateAccount } = useAccounts(overrideStudentId);
  const { plans } = usePlans(overrideStudentId);
  const { getTemplateById } = usePropFirmTemplates();

  // Conta prop selecionada via contexto — fallback para primeira PROP
  const selectedAccount = useMemo(() => {
    if (studentCtx?.selectedAccount?.type === 'PROP') return studentCtx.selectedAccount;
    return accounts.find(a => a.type === 'PROP') || null;
  }, [studentCtx?.selectedAccount, accounts]);

  const propAccountId = selectedAccount?.id || null;
  const { history: drawdownHistory } = useDrawdownHistory(propAccountId);
  const { movements: propMovements } = useMovements(propAccountId);

  // Derived data
  const propFirm = selectedAccount?.propFirm ?? null;
  const propTemplate = useMemo(() => {
    if (!propFirm?.templateId) return null;
    return getTemplateById(propFirm.templateId);
  }, [propFirm?.templateId, getTemplateById]);

  const accountSize = propTemplate?.accountSize ?? selectedAccount?.initialBalance ?? 0;
  const drawdownMax = propTemplate?.drawdown?.maxAmount ?? 0;
  const currentBalance = selectedAccount?.currentBalance ?? accountSize;
  const currentProfit = currentBalance - accountSize;
  const profitTarget = propTemplate?.profitTarget ?? 0;
  const drawdownThreshold = propFirm?.currentDrawdownThreshold ?? (accountSize - drawdownMax);
  const distanceToDD = propFirm?.distanceToDD
    ?? (drawdownMax > 0 ? (currentBalance - drawdownThreshold) / drawdownMax : 1);
  const phase = propFirm?.phase ?? 'EVALUATION';

  const alerts = useMemo(() => {
    if (!selectedAccount) return [];
    return derivePropAlerts({
      flags: propFirm?.flags ?? [],
      distanceToDD,
      isDayPaused: propFirm?.isDayPaused ?? false,
      dailyPnL: propFirm?.dailyPnL ?? 0,
      currentBalance,
      currentDrawdownThreshold: drawdownThreshold,
      currentProfit,
      profitTarget,
      profitRatio: profitTarget > 0 ? Math.max(0, currentProfit / profitTarget) : 0,
      evalDaysRemaining: null,
      bestDayProfit: propFirm?.bestDayProfit ?? 0,
      consistencyRule: propTemplate?.consistency?.evalRule ?? null,
      consistencyThreshold: propTemplate?.consistency?.evalRule && profitTarget > 0
        ? profitTarget * propTemplate.consistency.evalRule : null,
      lockLevel: propFirm?.lockLevel ?? null,
      trailFrozen: propFirm?.trailFrozen ?? false,
      currency: selectedAccount.currency ?? 'USD',
      fmt: formatCurrencyDynamic,
    });
  }, [selectedAccount, propFirm, distanceToDD, currentBalance, currentProfit, profitTarget,
       propTemplate, drawdownThreshold]);

  const dangerAlerts = getDangerAlerts(alerts);

  // Plano mecânico read-only para Zona 3
  const attackPlan = useMemo(() => {
    if (!propTemplate) return null;
    const profile = propFirm?.suggestedPlan?.profile ?? DEFAULT_ATTACK_PROFILE;
    const instrument = propFirm?.suggestedPlan?.instrument?.symbol ?? null;
    try {
      return calculateAttackPlan(propTemplate, null, null, profile, phase, instrument);
    } catch {
      return null;
    }
  }, [propTemplate, propFirm?.suggestedPlan, phase]);

  // Early return AFTER all hooks
  if (!selectedAccount) {
    return (
      <div className="p-6">
        <ContextBar accounts={accounts} plans={plans} />
        <div className="mt-8 text-center text-slate-500">
          Nenhuma conta PROP encontrada. Crie uma conta tipo "Mesa Proprietária" na página de Contas.
        </div>
        <DebugBadge component="PropFirmPage" />
      </div>
    );
  }

  const currency = selectedAccount.currency ?? 'USD';

  const handleUpdatePhase = async (newPhase) => {
    try {
      await updateAccount(selectedAccount.id, {
        propFirm: { phase: newPhase, phaseStartDate: new Date().toISOString() },
      });
    } catch (err) {
      alert('Erro ao alterar fase: ' + err.message);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <ContextBar accounts={accounts} plans={plans} />

      {/* Zona 1 — STATUS AGORA */}
      <section className="space-y-3">
        <ZoneHeader number={1} title="Status agora" subtitle="onde estou neste momento" />
        <PropAlertsBanner
          dangerAlerts={dangerAlerts}
          firmName={propFirm?.firmName}
          productName={propFirm?.productName}
        />
        <PropAccountCard
          account={selectedAccount}
          template={propTemplate}
          drawdownHistory={drawdownHistory}
          onUpdatePhase={handleUpdatePhase}
        />
      </section>

      {/* Zona 2 — COMO CHEGUEI AQUI */}
      <section className="space-y-3">
        <ZoneHeader number={2} title="Como cheguei aqui" subtitle="retrospectivo da conta" />
        <PropEquityCurve
          drawdownHistory={drawdownHistory}
          accountSize={accountSize}
          drawdownThreshold={drawdownThreshold}
          currency={currency}
        />
        <PropHistoricalKPIs
          drawdownHistory={drawdownHistory}
          evalTimeLimit={propTemplate?.evalTimeLimit ?? null}
          profitTarget={profitTarget}
          consistencyRule={propTemplate?.consistency?.evalRule ?? null}
          phase={phase}
          currency={currency}
        />
      </section>

      {/* Zona 3 — CONTRATO DA MESA (grid 2 cols em md+) */}
      <section className="space-y-3">
        <ZoneHeader number={3} title="Contrato da mesa + plano mecânico" subtitle="regras e execução" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TemplateCard template={propTemplate} phase={phase} currency={currency} />
          <PlanoMecanicoCard plan={attackPlan} phase={phase} currency={currency} />
        </div>
      </section>

      {/* Zona 4 — PAYOUT */}
      <section className="space-y-3">
        <ZoneHeader number={4} title="Payout" subtitle="quando posso sacar" />
        <PropPayoutTracker
          account={selectedAccount}
          template={propTemplate}
          drawdownHistory={drawdownHistory}
          movements={propMovements}
        />
      </section>

      <DebugBadge component="PropFirmPage" />
    </div>
  );
};

const PropFirmPage = (props) => {
  const { user } = useAuth();
  const overrideStudentId = props.viewAs?.uid || null;
  const scopeStudentId = overrideStudentId || user?.uid || 'anon';

  const { accounts } = useAccounts(overrideStudentId);
  const { plans } = usePlans(overrideStudentId);

  return (
    <StudentContextProvider
      key={scopeStudentId}
      scopeStudentId={scopeStudentId}
      accounts={accounts}
      plans={plans}
    >
      <PropFirmPageBody {...props} />
    </StudentContextProvider>
  );
};

export default PropFirmPage;
