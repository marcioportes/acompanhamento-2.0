/**
 * useAiApproachPlan
 * @description Hook para orquestrar a chamada da CF `generatePropFirmApproachPlan`.
 *
 * Responsabilidades:
 * - Montar o contexto esperado pela CF ({firm, instrument, plan, dataSource, traderProfile}) a partir de account + template + dados opcionais
 * - Chamar a CF via httpsCallable
 * - Expor state (loading, error, result) + counter de gerações
 * - Detecção de dataSource: '4d_full' se trader4DProfile presente, 'indicators' se traderIndicators, senão 'defaults'
 *
 * Ref: issue #133, epic #52 Fase 2.5
 */

import { useState, useCallback, useMemo } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

const MAX_GENERATIONS = 5;

function resolveDataSource({ trader4DProfile, traderIndicators }) {
  // 4D basta para personalizar — indicadores são bônus (conta nova tem 0 trades, mas pode ter assessment)
  if (trader4DProfile) return '4d_full';
  if (traderIndicators) return 'indicators';
  return 'defaults';
}

function buildContext({ account, template, trader4DProfile, traderIndicators, phase = 'EVALUATION' }) {
  const propFirm = account?.propFirm ?? {};
  const plan = propFirm.suggestedPlan ?? {};

  const dataSource = resolveDataSource({ trader4DProfile, traderIndicators });

  const firm = {
    firmName: propFirm.firmName ?? template?.firm ?? 'Prop Firm',
    productName: propFirm.productName ?? template?.name ?? '',
    accountSize: template?.accountSize ?? account?.initialBalance ?? 0,
    drawdownMax: template?.drawdown?.maxAmount ?? 0,
    profitTarget: template?.profitTarget ?? 0,
    dailyLossLimit: template?.dailyLossLimit ?? 0,
    evalDays: template?.evalTimeLimit ?? 0,
    drawdownType: template?.drawdown?.type ?? 'UNKNOWN',
    consistencyRule: template?.consistency?.evalRule ?? null,
  };

  const instrumentSymbol = plan.instrument?.symbol ?? propFirm.instrumentSymbol ?? '';
  const pointValue = plan.instrument?.pointValue ?? 0;
  const atrDaily = plan.instrument?.avgDailyRange ?? 0;
  const nyRange = plan.nyRangePoints ?? 0;
  const nyRangePct = atrDaily > 0 ? Math.round((nyRange / atrDaily) * 100) : 0;
  const minViableStop = plan.instrument?.minViableStop ?? 0;

  const instrument = {
    symbol: instrumentSymbol,
    pointValue,
    atrDaily,
    nyRange,
    nyRangePct,
    minViableStop,
  };

  const roUSD = plan.roPerTrade ?? 0;
  const maxTradesPerDay = plan.maxTradesPerDay ?? 0;
  const rr = plan.rrMinimum ?? 2;
  const dailyStop = roUSD * maxTradesPerDay;
  const dailyGoal = dailyStop * rr;

  const cfPlan = {
    profileName: plan.profileName ?? plan.profile ?? 'personalizado',
    roUSD,
    roPct: plan.roPct ?? 0,
    stopPoints: plan.stopPoints ?? 0,
    stopUSD: plan.stopPerTrade ?? 0,
    targetPoints: plan.targetPoints ?? 0,
    targetUSD: plan.targetPerTrade ?? 0,
    rr,
    maxTradesPerDay,
    contracts: plan.sizing?.contracts ?? 1,
    lossesToBust: plan.lossesToBust ?? 0,
    dailyGoal,
    dailyStop,
    dailyTarget: plan.dailyTarget ?? 0,
    assumedWR: traderIndicators?.wr ?? 50,
    evPerTrade: plan.evPerTrade ?? 0,
    approvalPct: plan.approvalPct ?? 0,
    bustPct: plan.bustPct ?? 0,
    avgDaysToPass: plan.daysToTarget ?? 0,
  };

  return {
    firm,
    instrument,
    plan: cfPlan,
    dataSource,
    phase,
    traderProfile: trader4DProfile ?? traderIndicators ?? {},
  };
}

export function useAiApproachPlan({ account, template, trader4DProfile = null, traderIndicators = null, phase = 'EVALUATION' } = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const propFirm = account?.propFirm ?? {};
  const storedPlan = propFirm.aiApproachPlan ?? null;
  const generationCount = propFirm.aiGenerationCount ?? 0;
  const remaining = Math.max(0, MAX_GENERATIONS - generationCount);

  const context = useMemo(
    () => buildContext({ account, template, trader4DProfile, traderIndicators, phase }),
    [account, template, trader4DProfile, traderIndicators, phase]
  );

  const generate = useCallback(async () => {
    if (!account?.id) {
      setError(new Error('accountId ausente'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const call = httpsCallable(functions, 'generatePropFirmApproachPlan');
      const response = await call({ accountId: account.id, context });
      setResult(response.data);
      return response.data;
    } catch (err) {
      console.error('[useAiApproachPlan] CF error:', err);
      setError(err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [account?.id, context]);

  const activePlan = result?.plan ?? storedPlan ?? null;
  const aiUnavailable = result?.aiUnavailable ?? activePlan?.metadata?.aiUnavailable ?? false;
  const limitReached = remaining <= 0;

  return {
    generate,
    loading,
    error,
    plan: activePlan,
    aiUnavailable,
    generationCount,
    remaining,
    limitReached,
    dataSource: context.dataSource,
    MAX_GENERATIONS,
  };
}

export default useAiApproachPlan;
