/**
 * EquityCurve
 * @version 3.0.0 (v1.41.0)
 * @description Gráfico de Curva de Patrimônio com moeda dinâmica.
 *
 * CHANGELOG:
 * - 3.0.0: E5 (issue #164) — tabs por moeda quando ≥2 moedas distintas no contexto;
 *          overlay de curva ideal (meta + stop) quando ciclo único é selecionado.
 * - 2.0.0: Multi-moeda via prop `currency`, fix ordenação (entryTime como desempate)
 * - 1.0.0: Versão original
 */

import React, { useMemo, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Line, ComposedChart
} from 'recharts';
import { formatCurrencyDynamic, formatCurrencyCompact, resolveCurrency } from '../utils/currency';
import DebugBadge from './DebugBadge';

/**
 * Ordena trades de forma determinística: data ASC, hora ASC, fallback por índice.
 */
const sortTradesDeterministic = (trades) => {
  const indexed = trades.map((t, i) => ({ ...t, _origIdx: i }));
  return indexed.sort((a, b) => {
    const dateA = a.date || '';
    const dateB = b.date || '';
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    const timeA = a.entryTime || a.createdAt?.seconds?.toString() || '';
    const timeB = b.entryTime || b.createdAt?.seconds?.toString() || '';
    if (timeA !== timeB) return timeA.localeCompare(timeB);
    return a._origIdx - b._origIdx;
  });
};

/** Constrói curva acumulativa por trade. Saída inclui ponto inicial 'Início'. */
const buildEquityCurve = (trades, initialBalance) => {
  const sortedTrades = sortTradesDeterministic(trades);
  let currentEquity = initialBalance;

  const curve = [
    { date: 'Início', fullDate: null, equity: initialBalance, pnl: 0 },
  ];

  sortedTrades.forEach(trade => {
    const result = Number(trade.result) || 0;
    currentEquity += result;
    const dateLabel = trade.date ? trade.date.split('-').slice(1).reverse().join('/') : '?';
    curve.push({
      id: trade.id,
      date: dateLabel,
      fullDate: trade.date,
      equity: currentEquity,
      result,
      ticker: trade.ticker,
    });
  });

  return curve;
};

const formatBRDate = (iso) => {
  if (!iso || typeof iso !== 'string') return iso || '';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

/**
 * Mescla curva real (por trade) e curva ideal (1 ponto/dia).
 * Retorna pontos ordenados por fullDate; cada ponto pode ter equity (real) e/ou goal/stop (ideal).
 */
const mergeRealAndIdeal = (realCurve, idealSeries) => {
  if (!Array.isArray(idealSeries) || idealSeries.length === 0) {
    return realCurve;
  }

  // Indexa por fullDate (YYYY-MM-DD). 'Início' (fullDate null) é mantido sem overlay.
  const map = new Map();
  realCurve.forEach((p, idx) => {
    const key = p.fullDate || `__init_${idx}`;
    if (!map.has(key)) map.set(key, { ...p, _origIdx: idx });
    else {
      // Mais de um trade no mesmo dia: mantém o último equity (final do dia)
      const prev = map.get(key);
      map.set(key, { ...prev, ...p, _origIdx: prev._origIdx });
    }
  });

  idealSeries.forEach((p) => {
    const existing = map.get(p.date);
    if (existing) {
      map.set(p.date, { ...existing, goal: p.goal, stop: p.stop });
    } else {
      map.set(p.date, {
        date: formatBRDate(p.date).slice(0, 5), // DD/MM
        fullDate: p.date,
        goal: p.goal,
        stop: p.stop,
        _origIdx: Number.MAX_SAFE_INTEGER, // ideal-only points vão para o fim na ordenação
      });
    }
  });

  // Ordena: 'Início' primeiro (fullDate null), depois por fullDate ASC, e em empate pelo _origIdx.
  return Array.from(map.values()).sort((a, b) => {
    if (!a.fullDate && b.fullDate) return -1;
    if (a.fullDate && !b.fullDate) return 1;
    if (a.fullDate !== b.fullDate) return (a.fullDate || '').localeCompare(b.fullDate || '');
    return (a._origIdx || 0) - (b._origIdx || 0);
  });
};

const StatusBadge = ({ status, percentVsGoal, percentVsStop }) => {
  if (!status) return null;

  let label;
  let cls;
  if (status === 'above') {
    label = `+${Math.abs(percentVsGoal).toFixed(1)}% acima da meta`;
    cls = 'bg-emerald-500/10 text-emerald-400';
  } else if (status === 'below') {
    label = `${percentVsStop.toFixed(1)}% abaixo do stop`;
    cls = 'bg-red-500/10 text-red-400';
  } else {
    label = 'Dentro do corredor ideal';
    cls = 'bg-slate-700/40 text-slate-300';
  }
  return (
    <span className={`text-xs font-mono px-2 py-1 rounded ${cls}`}>{label}</span>
  );
};

const SingleCurrencyChart = ({ trades, initialBalance, currency, idealSeries, idealStatus, hideTitle = false }) => {
  const realCurve = useMemo(() => buildEquityCurve(trades, initialBalance), [trades, initialBalance]);
  const data = useMemo(() => mergeRealAndIdeal(realCurve, idealSeries), [realCurve, idealSeries]);

  const fmtAxis = (val) => formatCurrencyCompact(val, currency);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload;
      return (
        <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl text-xs">
          <p className="text-slate-400 mb-1">{point.fullDate ? formatBRDate(point.fullDate) : (label || '—')}</p>
          {point.equity !== undefined && (
            <p className="text-white font-bold text-sm mb-1">
              Patrimônio: {formatCurrencyDynamic(point.equity, currency)}
            </p>
          )}
          {point.result !== undefined && point.result !== 0 && (
            <p className={`${point.result >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              Trade: {point.result >= 0 ? '+' : ''}{formatCurrencyDynamic(point.result, currency)}
              {point.ticker && <span className="text-slate-500 ml-1">({point.ticker})</span>}
            </p>
          )}
          {point.goal !== undefined && (
            <p className="text-emerald-300/80">Meta ideal: {formatCurrencyDynamic(point.goal, currency)}</p>
          )}
          {point.stop !== undefined && (
            <p className="text-red-300/80">Stop ideal: {formatCurrencyDynamic(point.stop, currency)}</p>
          )}
        </div>
      );
    }
    return null;
  };

  if (trades.length === 0 && initialBalance === 0 && !idealSeries) {
    return <div className="h-full flex items-center justify-center text-slate-500"><p>Sem dados para exibir.</p></div>;
  }

  // Último ponto com equity definido (ideal-only points não têm equity)
  const lastEquityPoint = [...data].reverse().find(p => typeof p.equity === 'number') || { equity: initialBalance };
  const isPositive = (lastEquityPoint.equity || 0) >= initialBalance;
  const strokeColor = isPositive ? '#10b981' : '#ef4444';
  const fillColor = isPositive ? 'url(#colorUp)' : 'url(#colorDown)';
  const ChartComponent = idealSeries ? ComposedChart : AreaChart;

  return (
    <div className="w-full h-full min-h-[300px] flex flex-col">
      {!hideTitle && (
        <div className="flex justify-between items-center px-6 pt-4 mb-2">
          <h3 className="font-bold text-white text-sm">Curva de Patrimônio</h3>
          <div className="flex gap-2 items-center">
            {idealStatus && (
              <StatusBadge {...idealStatus} />
            )}
            <span className={`text-xs font-mono px-2 py-1 rounded ${isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
              {isPositive ? '▲' : '▼'} Total: {formatCurrencyDynamic((lastEquityPoint.equity || 0) - initialBalance, currency)}
            </span>
          </div>
        </div>
      )}

      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ChartComponent data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorUp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorDown" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={30} />
            <YAxis stroke="#64748b" tick={{ fontSize: 10 }} tickFormatter={fmtAxis} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={initialBalance} stroke="#475569" strokeDasharray="3 3" />
            <Area type="monotone" dataKey="equity" stroke={strokeColor} strokeWidth={2} fillOpacity={1} fill={fillColor} animationDuration={1000} connectNulls />
            {idealSeries && (
              <>
                <Line type="monotone" dataKey="goal" stroke="#10b981" strokeWidth={1.5} strokeDasharray="6 4" dot={false} isAnimationActive={false} connectNulls />
                <Line type="monotone" dataKey="stop" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="6 4" dot={false} isAnimationActive={false} connectNulls />
              </>
            )}
          </ChartComponent>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

/**
 * Gráfico de Curva de Patrimônio.
 *
 * Modos de operação:
 *  - Single-currency (default): comportamento legado, uma curva única.
 *  - Multi-currency (currencies.size ≥ 2): renderiza tabs por moeda, cada tab com sua série e eixo Y.
 *  - Curva ideal: overlay de meta/stop linear pelos dias do ciclo (apenas single-currency, plano único).
 *
 * @param {Array}  trades         - Lista de trades filtrados.
 * @param {number} initialBalance - Soma dos saldos iniciais (single-mode).
 * @param {string} currency       - Código de moeda (single-mode). Default: 'BRL'.
 * @param {Map}    [currencies]   - balancesByCurrency. Se size ≥ 2, ativa tabs.
 * @param {Array}  [accounts]     - Contas (necessárias para mapear trade.accountId → currency em modo tabs).
 * @param {Array}  [idealSeries]  - Saída de generateIdealEquitySeries ou null.
 * @param {Object} [idealStatus]  - Saída de calculateIdealStatus ou null.
 */
const EquityCurve = ({
  trades = [],
  initialBalance = 0,
  currency = 'BRL',
  currencies = null,
  accounts = null,
  idealSeries = null,
  idealStatus = null,
}) => {
  // Detecta modo tabs: pelo menos 2 moedas distintas no contexto agregado
  const tabsMode = currencies instanceof Map && currencies.size >= 2;

  // Monta mapa accountId → currency para filtragem por aba
  const accountCurrencyMap = useMemo(() => {
    if (!tabsMode || !Array.isArray(accounts)) return null;
    const map = new Map();
    accounts.forEach(acc => {
      if (acc && acc.id) map.set(acc.id, resolveCurrency(acc.currency));
    });
    return map;
  }, [tabsMode, accounts]);

  // Agrupa trades por moeda (tabs mode)
  const tradesByCurrency = useMemo(() => {
    if (!tabsMode || !accountCurrencyMap) return null;
    const grouped = new Map();
    trades.forEach(t => {
      const cur = accountCurrencyMap.get(t.accountId) || 'BRL';
      if (!grouped.has(cur)) grouped.set(cur, []);
      grouped.get(cur).push(t);
    });
    return grouped;
  }, [tabsMode, trades, accountCurrencyMap]);

  // Default tab = moeda com mais trades (desempate: ordem alfabética)
  const tabKeys = useMemo(() => {
    if (!tabsMode) return [];
    return Array.from(currencies.keys()).sort();
  }, [tabsMode, currencies]);

  const defaultTab = useMemo(() => {
    if (!tabsMode || tabKeys.length === 0) return null;
    let best = tabKeys[0];
    let bestCount = tradesByCurrency?.get(best)?.length || 0;
    tabKeys.forEach(k => {
      const c = tradesByCurrency?.get(k)?.length || 0;
      if (c > bestCount) {
        best = k;
        bestCount = c;
      }
    });
    return best;
  }, [tabsMode, tabKeys, tradesByCurrency]);

  const [activeTab, setActiveTab] = useState(defaultTab);
  const currentTab = activeTab && tabKeys.includes(activeTab) ? activeTab : defaultTab;

  if (tabsMode) {
    const tabBalance = currencies.get(currentTab);
    const tabTrades = tradesByCurrency.get(currentTab) || [];
    const tabInitial = tabBalance?.initial ?? 0;

    return (
      <div className="w-full h-full min-h-[300px] flex flex-col">
        <div className="flex justify-between items-center px-6 pt-4 mb-2">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-white text-sm">Curva de Patrimônio</h3>
            <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1" role="tablist">
              {tabKeys.map(k => {
                const isActive = k === currentTab;
                return (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(k)}
                    className={`text-xs font-mono px-2 py-0.5 rounded transition ${isActive ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    {k}
                  </button>
                );
              })}
            </div>
          </div>
          <span className={`text-xs font-mono px-2 py-1 rounded ${(tabBalance?.pnl ?? 0) >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
            {(tabBalance?.pnl ?? 0) >= 0 ? '▲' : '▼'} Total: {formatCurrencyDynamic(tabBalance?.pnl ?? 0, currentTab)}
          </span>
        </div>

        <SingleCurrencyChart
          trades={tabTrades}
          initialBalance={tabInitial}
          currency={currentTab}
          idealSeries={null}
          idealStatus={null}
          hideTitle
        />
        <DebugBadge component="EquityCurve" embedded />
      </div>
    );
  }

  return (
    <>
      <SingleCurrencyChart
        trades={trades}
        initialBalance={initialBalance}
        currency={currency}
        idealSeries={idealSeries}
        idealStatus={idealStatus}
      />
      <DebugBadge component="EquityCurve" embedded />
    </>
  );
};

export default EquityCurve;
