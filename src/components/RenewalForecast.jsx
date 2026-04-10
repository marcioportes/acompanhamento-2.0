/**
 * RenewalForecast — issue #122
 * @description Fluxo de caixa: 12 meses na horizontal com seletor de mês/ano inicial.
 *   Clica no mês para expandir detalhe dos alunos embaixo.
 */

import { useMemo, useState } from 'react';
import { TrendingUp, User } from 'lucide-react';
import { groupRenewalsByMonth, formatBRL, formatDateBR } from '../utils/renewalForecast';
import DebugBadge from './DebugBadge';

const MONTHS_COUNT = 12;

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

/** Gera array de 12 meses a partir de startMonth/startYear */
const buildMonthSlots = (startMonth, startYear) => {
  const slots = [];
  for (let i = 0; i < MONTHS_COUNT; i++) {
    const d = new Date(startYear, startMonth + i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    slots.push({ monthKey, label, year });
  }
  return slots;
};

const RenewalForecast = ({ subscriptions, embedded = false }) => {
  const now = new Date();
  const [startMonth, setStartMonth] = useState(now.getMonth());
  const [startYear, setStartYear] = useState(now.getFullYear());
  const [expandedMonth, setExpandedMonth] = useState(null);

  // Horizonte máximo: quantos meses do startDate até o fim dos slots
  const maxMonthsFromNow = useMemo(() => {
    const endSlot = new Date(startYear, startMonth + MONTHS_COUNT, 0);
    const diffMs = endSlot - now;
    return Math.max(Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30)), MONTHS_COUNT);
  }, [startMonth, startYear]);

  const forecast = useMemo(
    () => groupRenewalsByMonth(subscriptions ?? [], now, maxMonthsFromNow),
    [subscriptions, maxMonthsFromNow]
  );

  const forecastMap = useMemo(() => {
    const map = {};
    for (const g of forecast) map[g.monthKey] = g;
    return map;
  }, [forecast]);

  const slots = useMemo(
    () => buildMonthSlots(startMonth, startYear),
    [startMonth, startYear]
  );

  // Totais: próximos 3, 6 meses (a partir do startMonth) e total visível (12)
  const total3Months = useMemo(
    () => slots.slice(0, 3).reduce((sum, s) => sum + (forecastMap[s.monthKey]?.totalAmount ?? 0), 0),
    [slots, forecastMap]
  );
  const total6Months = useMemo(
    () => slots.slice(0, 6).reduce((sum, s) => sum + (forecastMap[s.monthKey]?.totalAmount ?? 0), 0),
    [slots, forecastMap]
  );
  const totalVisible = useMemo(
    () => slots.reduce((sum, s) => sum + (forecastMap[s.monthKey]?.totalAmount ?? 0), 0),
    [slots, forecastMap]
  );

  const expanded = expandedMonth ? forecastMap[expandedMonth] : null;

  // Anos para o dropdown: atual -1 até +5 (janela de 7 anos, cobre qualquer cenário razoável)
  const baseYear = now.getFullYear();
  const yearOptions = Array.from({ length: 7 }, (_, i) => baseYear - 1 + i);

  return (
    <div className="glass-card mb-8 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Fluxo de caixa previsto</p>
            <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
              <span>3 meses: <span className="text-slate-300 font-medium">{formatBRL(total3Months)}</span></span>
              <span className="text-slate-700">·</span>
              <span>6 meses: <span className="text-slate-300 font-medium">{formatBRL(total6Months)}</span></span>
              <span className="text-slate-700">·</span>
              <span>Total visível: <span className="text-violet-300 font-medium">{formatBRL(totalVisible)}</span></span>
            </div>
          </div>
        </div>

        {/* Seletor mês/ano inicial */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Início:</span>
          <select
            value={startMonth}
            onChange={(e) => { setStartMonth(Number(e.target.value)); setExpandedMonth(null); }}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:border-violet-500 focus:outline-none"
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={i} value={i}>{name}</option>
            ))}
          </select>
          <select
            value={startYear}
            onChange={(e) => { setStartYear(Number(e.target.value)); setExpandedMonth(null); }}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:border-violet-500 focus:outline-none"
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 12 meses na horizontal */}
      <div className="grid grid-cols-6 lg:grid-cols-12 gap-1.5">
        {slots.map((slot) => {
          const data = forecastMap[slot.monthKey];
          const hasData = !!data;
          const isActive = expandedMonth === slot.monthKey;
          const overdueStudents = data?.students.filter(s => s.overdue) ?? [];
          const scheduledStudents = data?.students.filter(s => !s.overdue) ?? [];
          const overdueAmount = overdueStudents.reduce((s, st) => s + st.amount, 0);
          const scheduledAmount = scheduledStudents.reduce((s, st) => s + st.amount, 0);
          const hasOverdue = overdueStudents.length > 0;
          const hasScheduled = scheduledStudents.length > 0;

          return (
            <button
              key={slot.monthKey}
              onClick={() => hasData && setExpandedMonth(isActive ? null : slot.monthKey)}
              className={`flex flex-col items-center py-2 px-1 rounded-lg border transition-colors ${
                isActive
                  ? hasOverdue && !hasScheduled ? 'bg-red-500/10 border-red-500/40' : 'bg-violet-500/15 border-violet-500/40'
                  : hasOverdue && !hasScheduled
                    ? 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10 hover:border-red-500/30 cursor-pointer'
                    : hasData
                      ? 'bg-slate-800/30 border-slate-700/30 hover:bg-slate-800/50 hover:border-slate-600/40 cursor-pointer'
                      : 'bg-slate-800/10 border-slate-800/20 cursor-default opacity-50'
              }`}
              disabled={!hasData}
            >
              <span className={`text-[10px] uppercase tracking-wide ${isActive ? 'text-violet-300' : 'text-slate-500'}`}>
                {slot.label}
              </span>
              {hasData ? (
                <>
                  {hasScheduled && (
                    <span className={`text-xs font-bold mt-0.5 ${isActive ? 'text-violet-300' : 'text-white'}`}>
                      {formatBRL(scheduledAmount)}
                    </span>
                  )}
                  {hasOverdue && (
                    <span className="text-xs font-bold text-red-400 mt-0.5">
                      {formatBRL(overdueAmount)}
                    </span>
                  )}
                  <span className="text-[9px] text-slate-500 flex items-center gap-0.5 mt-0.5">
                    <User className="w-2 h-2" />{data.students.length}
                  </span>
                </>
              ) : (
                <span className="text-xs font-bold mt-0.5 text-slate-600">—</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Detalhe expandido embaixo */}
      {expanded && (() => {
        const overdue = expanded.students.filter(s => s.overdue);
        const scheduled = expanded.students.filter(s => !s.overdue);
        const overdueTotal = overdue.reduce((sum, s) => sum + s.amount, 0);
        const scheduledTotal = scheduled.reduce((sum, s) => sum + s.amount, 0);

        return (
          <div className="mt-3 pt-3 border-t border-slate-800/50 max-w-md">
            {overdue.map((s, i) => (
              <div key={`o-${i}`} className="grid grid-cols-[1fr_auto_auto] gap-x-3 text-xs py-0.5 items-center">
                <span className="text-red-400 truncate">{s.name}</span>
                <span className="text-red-400/50 text-[11px]">venceu {formatDateBR(s.endDate)}</span>
                <span className="text-red-400 font-medium text-right">{formatBRL(s.amount)}</span>
              </div>
            ))}
            {scheduled.map((s, i) => (
              <div key={`s-${i}`} className="grid grid-cols-[1fr_auto_auto] gap-x-3 text-xs py-0.5 items-center">
                <span className="text-slate-300 truncate">{s.name}</span>
                <span className="text-slate-500 text-[11px]">{formatDateBR(s.endDate)}</span>
                <span className="text-white font-medium text-right">{formatBRL(s.amount)}</span>
              </div>
            ))}
          </div>
        );
      })()}

      {!embedded && <DebugBadge component="RenewalForecast" />}
    </div>
  );
};

export default RenewalForecast;
