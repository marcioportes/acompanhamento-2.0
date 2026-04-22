/**
 * EquityCurve
 * @version 3.2.0 (v1.41.0)
 * @description Gráfico de Curva de Patrimônio com moeda dinâmica.
 *
 * CHANGELOG:
 * - 3.2.0: #164 review — toggle manual para a curva ideal do plano (persiste no
 *          localStorage). Quando desligado, mantém comportamento legado (sem overlay).
 * - 3.1.0: #164 review — tabs de moeda removidas (contexto resolve a moeda dominante;
 *          aluno não precisa trocar aba). Props `currencies` e `accounts` retiradas.
 * - 3.0.0: E5 (issue #164) — overlay de curva ideal (meta + stop) quando ciclo único
 *          é selecionado.
 * - 2.0.0: Multi-moeda via prop `currency`, fix ordenação (entryTime como desempate)
 * - 1.0.0: Versão original
 */

import React, { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Line, ComposedChart
} from 'recharts';
import { Eye, EyeOff } from 'lucide-react';
import { formatCurrencyDynamic, formatCurrencyCompact } from '../utils/currency';
import useLocalStorage from '../hooks/useLocalStorage';
import DebugBadge from './DebugBadge';

const IDEAL_TOGGLE_LS_KEY = 'equityCurve.showIdeal.v1';

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

const SingleCurrencyChart = ({ trades, initialBalance, currency, idealSeries, idealStatus, hideTitle = false, onToggleIdeal, showIdeal }) => {
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
            {onToggleIdeal && (
              <button
                type="button"
                onClick={onToggleIdeal}
                title={showIdeal ? 'Ocultar curva ideal do plano' : 'Mostrar curva ideal do plano'}
                aria-pressed={showIdeal}
                className={`text-[11px] font-medium px-2 py-1 rounded border flex items-center gap-1 transition-colors ${
                  showIdeal
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                    : 'bg-slate-800/60 border-slate-700/40 text-slate-400 hover:text-slate-200'
                }`}
              >
                {showIdeal ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                Curva ideal
              </button>
            )}
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
 * A moeda exibida é a `currency` recebida via prop — o consumidor (ex: StudentDashboard)
 * resolve a moeda dominante pelo contexto (conta/plano/ciclo) e a repassa. Quando há
 * múltiplas moedas agregadas no contexto, o agregador escolhe a dominante; a separação
 * por moeda vive nos cards de métrica, não no gráfico.
 *
 * @param {Array}  trades         - Lista de trades filtrados.
 * @param {number} initialBalance - Soma dos saldos iniciais.
 * @param {string} currency       - Código da moeda exibida. Default: 'BRL'.
 * @param {Array}  [idealSeries]  - Saída de generateIdealEquitySeries ou null.
 * @param {Object} [idealStatus]  - Saída de calculateIdealStatus ou null.
 */
const EquityCurve = ({
  trades = [],
  initialBalance = 0,
  currency = 'BRL',
  idealSeries = null,
  idealStatus = null,
}) => {
  const [showIdeal, setShowIdeal] = useLocalStorage(IDEAL_TOGGLE_LS_KEY, true);
  const hasIdealAvailable = Array.isArray(idealSeries) && idealSeries.length > 0;
  const effectiveIdealSeries = hasIdealAvailable && showIdeal ? idealSeries : null;
  const effectiveIdealStatus = hasIdealAvailable && showIdeal ? idealStatus : null;

  return (
    <>
      <SingleCurrencyChart
        trades={trades}
        initialBalance={initialBalance}
        currency={currency}
        idealSeries={effectiveIdealSeries}
        idealStatus={effectiveIdealStatus}
        onToggleIdeal={hasIdealAvailable ? () => setShowIdeal(!showIdeal) : null}
        showIdeal={showIdeal}
      />
      <DebugBadge component="EquityCurve" embedded />
    </>
  );
};

export default EquityCurve;
