/**
 * EquityCurve
 * @version 2.0.0 (v1.15.0)
 * @description Gráfico de Curva de Patrimônio com moeda dinâmica.
 * 
 * CHANGELOG:
 * - 2.0.0: Multi-moeda via prop `currency`, fix ordenação (entryTime como desempate)
 * - 1.0.0: Versão original
 * 
 * FIX v2.0.0 — Ordenação:
 * O bug anterior: trades no mesmo dia (mesma string YYYY-MM-DD) ficavam em ordem
 * indeterminada pois new Date('2026-03-03') === new Date('2026-03-03').
 * Isso gerava "vales fantasma" e "picos inexistentes" na curva.
 * 
 * Solução: ordenar por (date ASC, entryTime ASC, createdAt ASC) para desempate
 * determinístico. Se nenhum campo de hora existir, usa índice original como tiebreaker.
 */

import React, { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { formatCurrencyDynamic, formatCurrencyCompact } from '../utils/currency';

/**
 * Ordena trades de forma determinística: data ASC, hora ASC, fallback por índice.
 * Resolve o bug de trades no mesmo dia aparecendo em ordem aleatória.
 */
const sortTradesDeterministic = (trades) => {
  // Preserva índice original como último tiebreaker
  const indexed = trades.map((t, i) => ({ ...t, _origIdx: i }));

  return indexed.sort((a, b) => {
    // 1. Data (string YYYY-MM-DD) — comparação lexicográfica é segura
    const dateA = a.date || '';
    const dateB = b.date || '';
    if (dateA !== dateB) return dateA.localeCompare(dateB);

    // 2. Hora de entrada (ISO ou HH:MM) — desempate intra-dia
    const timeA = a.entryTime || a.createdAt?.seconds?.toString() || '';
    const timeB = b.entryTime || b.createdAt?.seconds?.toString() || '';
    if (timeA !== timeB) return timeA.localeCompare(timeB);

    // 3. Fallback: índice original (estabilidade do sort)
    return a._origIdx - b._origIdx;
  });
};

/**
 * Gráfico de Curva de Patrimônio.
 * @param {Array} trades - Lista de trades filtrados.
 * @param {number} initialBalance - Soma dos saldos iniciais das contas selecionadas.
 * @param {string} currency - Código de moeda ('BRL', 'USD', 'EUR'). Default: 'BRL'.
 */
const EquityCurve = ({ trades = [], initialBalance = 0, currency = 'BRL' }) => {
  
  const data = useMemo(() => {
    const sortedTrades = sortTradesDeterministic(trades);
    
    let currentEquity = initialBalance;
    
    // Ponto inicial (Data zero)
    const curve = [
      { date: 'Início', equity: initialBalance, pnl: 0 }
    ];

    sortedTrades.forEach(trade => {
      const result = Number(trade.result) || 0;
      currentEquity += result;
      // Formata data curta DD/MM
      const dateLabel = trade.date ? trade.date.split('-').slice(1).reverse().join('/') : '?';
      
      curve.push({
        id: trade.id,
        date: dateLabel,
        fullDate: trade.date,
        equity: currentEquity,
        result: result,
        ticker: trade.ticker
      });
    });

    return curve;
  }, [trades, initialBalance]);

  // Formatadores com moeda dinâmica
  const fmtAxis = (val) => formatCurrencyCompact(val, currency);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload;
      return (
        <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl text-xs">
          <p className="text-slate-400 mb-1">{point.fullDate || label}</p>
          <p className="text-white font-bold text-sm mb-1">
            Patrimônio: {formatCurrencyDynamic(point.equity, currency)}
          </p>
          {point.result !== undefined && point.result !== 0 && (
            <p className={`${point.result >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              Trade: {point.result >= 0 ? '+' : ''}{formatCurrencyDynamic(point.result, currency)}
              {point.ticker && <span className="text-slate-500 ml-1">({point.ticker})</span>}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  if (trades.length === 0 && initialBalance === 0) {
    return <div className="h-full flex items-center justify-center text-slate-500"><p>Sem dados para exibir.</p></div>;
  }

  const isPositive = (data[data.length - 1]?.equity || 0) >= initialBalance;
  const strokeColor = isPositive ? '#10b981' : '#ef4444';
  const fillColor = isPositive ? 'url(#colorUp)' : 'url(#colorDown)';

  return (
    <div className="w-full h-full min-h-[300px] flex flex-col">
      <div className="flex justify-between items-center px-6 pt-4 mb-2">
        <h3 className="font-bold text-white text-sm">Curva de Patrimônio</h3>
        <span className={`text-xs font-mono px-2 py-1 rounded ${isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
          {isPositive ? '▲' : '▼'} Total: {formatCurrencyDynamic((data[data.length - 1]?.equity || 0) - initialBalance, currency)}
        </span>
      </div>
      
      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
            <Area type="monotone" dataKey="equity" stroke={strokeColor} strokeWidth={2} fillOpacity={1} fill={fillColor} animationDuration={1000} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default EquityCurve;
