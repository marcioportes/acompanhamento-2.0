import React, { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';

/**
 * Gráfico de Curva de Patrimônio.
 * @param {Array} trades - Lista de trades filtrados.
 * @param {number} initialBalance - Soma dos saldos iniciais das contas selecionadas.
 */
const EquityCurve = ({ trades = [], initialBalance = 0 }) => {
  
  const data = useMemo(() => {
    // Ordena trades por data cronológica
    const sortedTrades = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    let currentEquity = initialBalance;
    
    // Ponto inicial (Data zero)
    const curve = [
      { date: 'Início', equity: initialBalance, pnl: 0 }
    ];

    sortedTrades.forEach(trade => {
      const result = Number(trade.result);
      currentEquity += result;
      // Formata data curta DD/MM
      const dateLabel = trade.date.split('-').slice(1).reverse().join('/');
      
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

  const formatCurrency = (val) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(val);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload;
      return (
        <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl text-xs">
          <p className="text-slate-400 mb-1">{point.fullDate || label}</p>
          <p className="text-white font-bold text-sm mb-1">
            Patrimônio: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(point.equity)}
          </p>
          {point.result !== undefined && (
            <p className={`${point.result >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              Trade: {point.result >= 0 ? '+' : ''}{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(point.result)}
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
          {isPositive ? '▲' : '▼'} Total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((data[data.length - 1]?.equity || 0) - initialBalance)}
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
            <YAxis stroke="#64748b" tick={{ fontSize: 10 }} tickFormatter={formatCurrency} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
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