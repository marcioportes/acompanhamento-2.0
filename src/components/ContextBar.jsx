/**
 * ContextBar.jsx
 * @description Barra persistente do Dashboard-Aluno com seletores encadeados
 *              Conta → Plano → Ciclo → Período (DEC-047, issue #118).
 *              Consome StudentContextProvider. Dispara actions encadeadas.
 */

import { useMemo, useState, useRef, useEffect } from 'react';
import { ChevronDown, Lock, Calendar, Briefcase, Target, Clock } from 'lucide-react';
import DebugBadge from './DebugBadge';
import useStudentContext from '../hooks/useStudentContext';
import { PERIOD_KIND, getCycleKey } from '../utils/cycleResolver';

const PERIOD_LABELS = {
  [PERIOD_KIND.CYCLE]: 'Ciclo completo',
  [PERIOD_KIND.WEEK]: 'Semana atual',
  [PERIOD_KIND.MONTH]: 'Mês atual'
};

// ============================================
// DROPDOWN GENÉRICO
// ============================================

const Dropdown = ({ icon: Icon, label, value, options, onChange, disabled = false, placeholder = 'Selecionar' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors
          ${disabled
            ? 'bg-slate-900/40 border-slate-800/40 text-slate-600 cursor-not-allowed'
            : 'bg-slate-800/60 border-slate-700/40 text-white hover:bg-slate-800/80'}
        `}
      >
        {Icon && <Icon className="w-4 h-4 text-slate-400" />}
        <div className="flex flex-col items-start min-w-0">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
          <span className="text-xs font-medium truncate max-w-[160px]">
            {selectedOption?.label || <span className="text-slate-500">{placeholder}</span>}
          </span>
        </div>
        <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && options.length > 0 && (
        <div className="absolute top-full left-0 mt-1 min-w-full w-64 bg-slate-800 border border-slate-700/50 rounded-xl shadow-2xl z-50 py-1 max-h-72 overflow-y-auto">
          {options.map(opt => (
            <button
              key={opt.value ?? '__null__'}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`
                w-full text-left px-3 py-2 text-sm transition-colors
                ${opt.value === value
                  ? 'bg-slate-700/60 text-white'
                  : 'text-slate-300 hover:bg-slate-700/40 hover:text-white'}
              `}
            >
              <div className="font-medium">{opt.label}</div>
              {opt.sublabel && <div className="text-xs text-slate-500 mt-0.5">{opt.sublabel}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================
// CONTEXT BAR
// ============================================

const ContextBar = ({ accounts = [], plans = [], trades = [], embedded = false }) => {
  const {
    accountId, planId, cycleKey,
    selectedPlan, selectedCycle, isReadOnlyCycle,
    period,
    setAccount, setPlan, setCycleKey, setPeriodKind
  } = useStudentContext();

  // ============================================
  // OPÇÕES DOS DROPDOWNS
  // ============================================

  const accountOptions = useMemo(() => {
    const active = (accounts || []).filter(a => a.active !== false);
    const optAll = {
      value: null,
      label: 'Todas as contas',
      sublabel: active.length > 0 ? `${active.length} ativa${active.length > 1 ? 's' : ''}` : null
    };
    const list = active.map(a => ({
      value: a.id,
      label: a.name || a.id,
      sublabel: a.type ? `${a.type}${a.currency ? ` · ${a.currency}` : ''}` : null
    }));
    return [optAll, ...list];
  }, [accounts]);

  // Quando "Todas as contas" (accountId=null) está ativo, listar todos os planos
  // ativos de todas as contas — permite highlight do plano sem forçar troca de
  // conta. Sublabel ganha o nome da conta para diferenciar.
  const planOptions = useMemo(() => {
    const accountsById = new Map((accounts || []).map(a => [a.id, a]));
    const matches = accountId
      ? (plans || []).filter(p => p.accountId === accountId)
      : (plans || []).filter(p => p.active !== false);
    if (matches.length === 0) return [];
    const optNone = {
      value: null,
      label: accountId ? 'Nenhum plano' : 'Todos os planos',
      sublabel: accountId ? 'Sem plano selecionado' : `${matches.length} disponível${matches.length > 1 ? 'is' : ''}`
    };
    const list = matches.map(p => {
      const acc = accountsById.get(p.accountId);
      const accTag = !accountId && acc ? `${acc.name || acc.id}` : null;
      const cycleTag = p.adjustmentCycle ? `Ciclo ${p.adjustmentCycle}` : null;
      const rrTag = p.rrTarget ? `RR ${p.rrTarget}` : null;
      const sublabel = [accTag, cycleTag, rrTag].filter(Boolean).join(' · ') || null;
      return {
        value: p.id,
        label: p.name || `Plano ${String(p.id).slice(0, 6)}`,
        sublabel,
      };
    });
    return [optNone, ...list];
  }, [plans, accounts, accountId]);

  // Ciclos disponíveis: gera chaves dos últimos 12 meses/4 trimestres a partir dos trades + atual
  const cycleOptions = useMemo(() => {
    if (!selectedPlan) return [];
    const adjustmentCycle = selectedPlan.adjustmentCycle || 'Mensal';
    const keys = new Set();
    // Atual
    keys.add(getCycleKey(adjustmentCycle, new Date()));
    // Dos trades do plano
    const planTrades = (trades || []).filter(t => t.planId === selectedPlan.id);
    for (const t of planTrades) {
      if (!t.date) continue;
      const d = new Date(t.date);
      const k = getCycleKey(adjustmentCycle, d);
      if (k) keys.add(k);
    }
    return Array.from(keys)
      .sort((a, b) => b.localeCompare(a)) // DESC (mais recente primeiro)
      .map(k => ({
        value: k,
        label: k,
        sublabel: k === getCycleKey(adjustmentCycle, new Date()) ? 'Atual' : null
      }));
  }, [selectedPlan, trades]);

  const periodOptions = useMemo(() => [
    { value: PERIOD_KIND.CYCLE, label: PERIOD_LABELS[PERIOD_KIND.CYCLE] },
    { value: PERIOD_KIND.MONTH, label: PERIOD_LABELS[PERIOD_KIND.MONTH] },
    { value: PERIOD_KIND.WEEK, label: PERIOD_LABELS[PERIOD_KIND.WEEK] }
  ], []);

  // ============================================
  // RENDER
  // ============================================

  return (
    // relative + z-40 no wrapper: o backdrop-blur-sm abaixo cria um stacking
    // context, e precisamos que ele fique acima dos glass-cards que vêm
    // depois (tambem sao stacking contexts via backdrop-blur-xl). Sem isso,
    // os dropdowns abrem "por baixo" dos cards de plano.
    <div className="w-full relative z-40">
      {!embedded && <DebugBadge component="ContextBar" embedded />}

      <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-900/60 backdrop-blur-sm rounded-xl border border-slate-800/60">
        <Dropdown
          icon={Briefcase}
          label="Conta"
          value={accountId}
          options={accountOptions}
          onChange={setAccount}
          placeholder="Sem conta"
        />
        <span className="text-slate-600">›</span>

        <Dropdown
          icon={Target}
          label="Plano"
          value={planId}
          options={planOptions}
          onChange={setPlan}
          disabled={planOptions.length === 0}
          placeholder={accountId ? 'Nenhum plano' : 'Todos os planos'}
        />
        <span className="text-slate-600">›</span>

        <Dropdown
          icon={Calendar}
          label="Ciclo"
          value={cycleKey}
          options={cycleOptions}
          onChange={setCycleKey}
          disabled={!planId}
          placeholder={planId ? 'Sem ciclos' : 'Escolha plano'}
        />
        <span className="text-slate-600">›</span>

        <Dropdown
          icon={Clock}
          label="Período"
          value={period?.kind || PERIOD_KIND.CYCLE}
          options={periodOptions}
          onChange={setPeriodKind}
          disabled={!cycleKey}
          placeholder="—"
        />

        {isReadOnlyCycle && (
          <span className="ml-auto flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
            <Lock className="w-3 h-3" />
            Ciclo finalizado (somente leitura)
          </span>
        )}
      </div>
    </div>
  );
};

export default ContextBar;
