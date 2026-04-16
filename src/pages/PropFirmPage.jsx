/**
 * PropFirmPage — Página dedicada "Mesa Prop"
 * @version 1.0.0 (v1.32.0)
 * @description Extraída do StudentDashboard (issue #145, epic #144).
 *   Renderiza PropAlertsBanner, PropAccountCard (com AI Approach Plan),
 *   PropPayoutTracker. ContextBar no topo governa conta selecionada.
 *
 * Padrão: wrapper externo com StudentContextProvider (igual StudentDashboard).
 *
 * Ref: issue #145, CHUNK-02 + CHUNK-17
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
import { useAssessment } from '../hooks/useAssessment';
import { derivePropAlerts, getDangerAlerts } from '../utils/propFirmAlerts';
import { formatCurrencyDynamic } from '../utils/currency';
import ContextBar from '../components/ContextBar';
import PropAccountCard from '../components/dashboard/PropAccountCard';
import PropAlertsBanner from '../components/dashboard/PropAlertsBanner';
import PropPayoutTracker from '../components/dashboard/PropPayoutTracker';
import DebugBadge from '../components/DebugBadge';

// ============================================
// Body (inside StudentContextProvider)
// ============================================

const PropFirmPageBody = ({ viewAs }) => {
  const { user } = useAuth();
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

  // Assessment 4D (para AI Approach Plan)
  const assessmentStudentId = overrideStudentId || user?.uid || null;
  const { initialAssessment } = useAssessment(assessmentStudentId);

  // Derived data — safe to compute even when selectedAccount is null (returns defaults)
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
  const distanceToDD = propFirm?.distanceToDD
    ?? (drawdownMax > 0 ? (currentBalance - (propFirm?.currentDrawdownThreshold ?? (accountSize - drawdownMax))) / drawdownMax : 1);

  const alerts = useMemo(() => {
    if (!selectedAccount) return [];
    return derivePropAlerts({
      flags: propFirm?.flags ?? [],
      distanceToDD,
      isDayPaused: propFirm?.isDayPaused ?? false,
      dailyPnL: propFirm?.dailyPnL ?? 0,
      currentBalance,
      currentDrawdownThreshold: propFirm?.currentDrawdownThreshold ?? (accountSize - drawdownMax),
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
       propTemplate, accountSize, drawdownMax]);

  const dangerAlerts = getDangerAlerts(alerts);

  // Trader 4D profile (para AI Approach Plan)
  const trader4DProfile = useMemo(() => {
    if (!initialAssessment) return null;
    const sd = initialAssessment.stage_diagnosis ?? initialAssessment.stageDiagnosis;
    const emotionalScore = initialAssessment.emotional?.score ?? null;
    const riskScore = initialAssessment.financial?.score ?? null;
    const disciplineScore = initialAssessment.operational?.fit_score ?? initialAssessment.operational?.score ?? null;
    const techScore = initialAssessment.experience?.score ?? initialAssessment.experience?.fit_score ?? null;
    if (techScore == null && emotionalScore == null && disciplineScore == null && riskScore == null) return null;
    return { stage: sd?.stage ?? null, stageName: sd?.stageName ?? sd?.name ?? null,
      compositeScore: initialAssessment.composite_score ?? null, compositeLabel: initialAssessment.composite_label ?? null,
      techScore, emotionalScore, disciplineScore, riskScore };
  }, [initialAssessment]);

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

  return (
    <div className="p-6 space-y-4">
      <ContextBar accounts={accounts} plans={plans} />

      <PropAlertsBanner
        dangerAlerts={dangerAlerts}
        firmName={propFirm?.firmName}
        productName={propFirm?.productName}
      />

      <PropAccountCard
        account={selectedAccount}
        template={propTemplate}
        drawdownHistory={drawdownHistory}
        trader4DProfile={trader4DProfile}
        traderIndicators={null}
        onUpdatePhase={async (newPhase) => {
          try {
            await updateAccount(selectedAccount.id, {
              propFirm: { phase: newPhase, phaseStartDate: new Date().toISOString() },
            });
          } catch (err) {
            alert('Erro ao alterar fase: ' + err.message);
          }
        }}
      />

      <PropPayoutTracker
        account={selectedAccount}
        template={propTemplate}
        drawdownHistory={drawdownHistory}
        movements={propMovements}
      />

      <DebugBadge component="PropFirmPage" />
    </div>
  );
};

// ============================================
// Wrapper (StudentContextProvider)
// ============================================

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
