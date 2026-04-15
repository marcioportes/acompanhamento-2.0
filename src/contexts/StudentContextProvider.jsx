/**
 * StudentContextProvider.jsx
 * @description Provider do contexto unificado do Dashboard-Aluno (DEC-047).
 *              Governa Conta → Plano → Ciclo → Período com encadeamento reativo
 *              + persistência em localStorage versionada por aluno (E1, E5).
 *
 * @see Issue #118 — Barra de Contexto Unificado
 */

import { createContext, useCallback, useEffect, useMemo, useRef } from 'react';
import useLocalStorage from '../hooks/useLocalStorage.js';
import {
  detectActiveCycle,
  resolveCycle,
  getDefaultContext,
  getDefaultPlanForAccount,
  getPeriodRange,
  parseCycleKey,
  PERIOD_KIND,
  CYCLE_STATUS
} from '../utils/cycleResolver.js';

export const StudentContext = createContext(null);

const LS_KEY_PREFIX = 'studentContext_v1';

const toISODate = (d) => {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date)) return null;
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const isoDateToRange = (iso) => {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Provider. Recebe `scopeStudentId` para isolar o state por aluno
 * (suporte a modo viewAs do mentor — E5). Use `<Provider key={scopeStudentId}>`
 * para forçar remount + reload do localStorage ao trocar de aluno.
 *
 * @param {Object} props
 * @param {string} props.scopeStudentId - UID do aluno (ou do mentor em modo self)
 * @param {Array} props.accounts - accounts carregados (DataContext)
 * @param {Array} props.plans - plans carregados
 * @param {React.ReactNode} props.children
 */
export const StudentContextProvider = ({ scopeStudentId, accounts = [], plans = [], children }) => {
  const lsKey = `${LS_KEY_PREFIX}_${scopeStudentId || 'anon'}`;
  const [persisted, setPersisted] = useLocalStorage(lsKey, null);

  // Ref para evitar reinicialização em re-renders (só na primeira carga de dados válidos)
  const initializedRef = useRef(false);

  // Inicializa default se nunca persistido OU se persistido aponta para conta/plano inexistentes
  useEffect(() => {
    if (!accounts || accounts.length === 0) return;
    if (initializedRef.current) return;

    const persistedAccountExists = persisted?.accountId && accounts.some(a => a.id === persisted.accountId);
    const persistedPlanValid = !persisted?.planId || plans.some(p => p.id === persisted.planId);

    if (!persisted || !persistedAccountExists || !persistedPlanValid) {
      const defaultCtx = getDefaultContext(accounts, plans, new Date());
      setPersisted(defaultCtx);
    }

    initializedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts.length, plans.length]);

  const state = persisted || {
    accountId: null,
    planId: null,
    cycleKey: null,
    period: null,
    updatedAt: null
  };

  // ============================================
  // OBJETOS RESOLVIDOS (convenience derivations)
  // ============================================

  const selectedAccount = useMemo(
    () => accounts.find(a => a.id === state.accountId) || null,
    [accounts, state.accountId]
  );

  const selectedPlan = useMemo(
    () => plans.find(p => p.id === state.planId) || null,
    [plans, state.planId]
  );

  const selectedCycle = useMemo(() => {
    if (!selectedPlan || !state.cycleKey) return null;
    return resolveCycle(state.cycleKey, selectedPlan, new Date());
  }, [selectedPlan, state.cycleKey]);

  const isReadOnlyCycle = selectedCycle?.status === CYCLE_STATUS.FINALIZED;

  const periodRange = useMemo(() => {
    if (!state.period) return null;
    return {
      kind: state.period.kind,
      start: isoDateToRange(state.period.start),
      end: isoDateToRange(state.period.end)
    };
  }, [state.period]);

  // ============================================
  // ACTIONS ENCADEADAS
  // ============================================

  const setAccount = useCallback((accountId) => {
    const now = new Date();
    if (!accountId) {
      setPersisted({ accountId: null, planId: null, cycleKey: null, period: null, updatedAt: now.toISOString() });
      return;
    }

    const defaultPlan = getDefaultPlanForAccount(plans, accountId);
    if (!defaultPlan) {
      setPersisted({
        accountId,
        planId: null,
        cycleKey: null,
        period: null,
        updatedAt: now.toISOString()
      });
      return;
    }

    const cycle = detectActiveCycle(defaultPlan, now);
    const period = cycle ? getPeriodRange(cycle, PERIOD_KIND.CYCLE, now) : null;

    setPersisted({
      accountId,
      planId: defaultPlan.id,
      cycleKey: cycle?.cycleKey ?? null,
      period: period
        ? { kind: period.kind, start: toISODate(period.start), end: toISODate(period.end) }
        : null,
      updatedAt: now.toISOString()
    });
  }, [plans, setPersisted]);

  const setPlan = useCallback((planId) => {
    const now = new Date();
    const plan = plans.find(p => p.id === planId);
    if (!plan) {
      setPersisted({ ...state, planId, cycleKey: null, period: null, updatedAt: now.toISOString() });
      return;
    }
    const cycle = detectActiveCycle(plan, now);
    const period = cycle ? getPeriodRange(cycle, PERIOD_KIND.CYCLE, now) : null;
    setPersisted({
      ...state,
      planId,
      cycleKey: cycle?.cycleKey ?? null,
      period: period
        ? { kind: period.kind, start: toISODate(period.start), end: toISODate(period.end) }
        : null,
      updatedAt: now.toISOString()
    });
  }, [plans, state, setPersisted]);

  const setCycleKey = useCallback((cycleKey) => {
    const now = new Date();
    if (!selectedPlan || !cycleKey) {
      setPersisted({ ...state, cycleKey, period: null, updatedAt: now.toISOString() });
      return;
    }
    const cycle = resolveCycle(cycleKey, selectedPlan, now);
    const period = cycle ? getPeriodRange(cycle, PERIOD_KIND.CYCLE, now) : null;
    setPersisted({
      ...state,
      cycleKey,
      period: period
        ? { kind: period.kind, start: toISODate(period.start), end: toISODate(period.end) }
        : null,
      updatedAt: now.toISOString()
    });
  }, [selectedPlan, state, setPersisted]);

  const setPeriodKind = useCallback((kind) => {
    const now = new Date();
    if (!selectedCycle) {
      setPersisted({ ...state, period: { kind, start: null, end: null }, updatedAt: now.toISOString() });
      return;
    }
    const range = getPeriodRange(selectedCycle, kind, now);
    setPersisted({
      ...state,
      period: range
        ? { kind: range.kind, start: toISODate(range.start), end: toISODate(range.end) }
        : null,
      updatedAt: now.toISOString()
    });
  }, [selectedCycle, state, setPersisted]);

  // ============================================
  // VALUE
  // ============================================

  const value = useMemo(() => ({
    // state
    accountId: state.accountId,
    planId: state.planId,
    cycleKey: state.cycleKey,
    period: state.period,
    periodRange,
    // objetos resolvidos
    selectedAccount,
    selectedPlan,
    selectedCycle,
    isReadOnlyCycle,
    // actions
    setAccount,
    setPlan,
    setCycleKey,
    setPeriodKind,
    // metadata
    scopeStudentId: scopeStudentId || null
  }), [
    state.accountId, state.planId, state.cycleKey, state.period,
    periodRange, selectedAccount, selectedPlan, selectedCycle, isReadOnlyCycle,
    setAccount, setPlan, setCycleKey, setPeriodKind, scopeStudentId
  ]);

  return (
    <StudentContext.Provider value={value}>
      {children}
    </StudentContext.Provider>
  );
};

export default StudentContextProvider;
