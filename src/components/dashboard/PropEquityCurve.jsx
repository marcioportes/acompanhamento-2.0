/**
 * PropEquityCurve — Zona 2 da PropFirmPage: curva de equity da conta PROP
 * @description Recharts LineChart. Fonte: histórico vivo (`liveDrawdownHistory`, #490) —
 *   um ponto por trade que ainda existe, saldo refeito dos resultados atuais. Começa no
 *   tamanho da conta. Eixo X em data (DD/MM, INV-06).
 *   Marca linha horizontal do drawdownThreshold atual e do accountSize inicial.
 *
 * Ref: issue #145 Fase F, spec v2 §4.2; issue #490
 */

import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { formatCurrencyDynamic, formatCurrencyCompact } from '../../utils/currency';
import DebugBadge from '../DebugBadge';

// 'YYYY-MM-DD' → 'DD/MM' (INV-06)
const shortDateBR = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');
const fullDateBR = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');

const PropEquityCurve = ({ drawdownHistory, accountSize, drawdownThreshold, currency = 'USD' }) => {
  const data = useMemo(() => {
    if (!drawdownHistory || drawdownHistory.length === 0) return [];
    const points = drawdownHistory
      .filter(d => typeof d.balance === 'number')
      .map((d, i) => ({ idx: i + 1, balance: d.balance, date: d.date ?? null }));
    if (typeof accountSize === 'number' && points.length > 0) {
      points.unshift({ idx: 0, balance: accountSize, date: null });
    }
    return points;
  }, [drawdownHistory, accountSize]);

  if (data.length === 0) {
    return (
      <div className="glass-card border border-slate-700/50 p-4 pb-6">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">Equity curve</h3>
        </div>
        <div className="text-xs text-slate-500 py-8 text-center">
          Sem histórico de drawdown ainda. Curva aparece após o primeiro trade registrado.
        </div>
        <DebugBadge component="PropEquityCurve" embedded />
      </div>
    );
  }

  const first = data[0].balance;
  const last = data[data.length - 1].balance;
  const delta = last - (accountSize ?? first);
  const deltaPositive = delta >= 0;
  const trades = data.filter(d => d.date);
  const dateByIdx = new Map(data.map(d => [d.idx, d.date]));
  const firstDate = trades[0]?.date;
  const lastDate = trades[trades.length - 1]?.date;

  return (
    <div className="glass-card border border-slate-700/50 p-4 pb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className={`w-4 h-4 ${deltaPositive ? 'text-emerald-400' : 'text-red-400'}`} />
          <h3 className="text-sm font-bold text-white">Equity curve</h3>
        </div>
        <span className={`text-xs font-medium ${deltaPositive ? 'text-emerald-300' : 'text-red-300'}`}>
          {deltaPositive ? '+' : ''}{formatCurrencyDynamic(delta, currency)}
        </span>
      </div>

      <div style={{ width: '100%', height: 180 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
            <XAxis
              dataKey="idx"
              tick={{ fill: '#64748b', fontSize: 10 }}
              axisLine={{ stroke: '#334155' }}
              tickFormatter={(idx) => (idx === 0 ? 'Início' : shortDateBR(dateByIdx.get(idx)))}
            />
            <YAxis
              width={72}
              tick={{ fill: '#64748b', fontSize: 10 }}
              axisLine={{ stroke: '#334155' }}
              tickFormatter={(v) => formatCurrencyCompact(v, currency)}
              domain={['dataMin - 500', 'dataMax + 500']}
            />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, fontSize: 12 }}
              labelStyle={{ color: '#94a3b8' }}
              formatter={(value) => [formatCurrencyDynamic(value, currency), 'Saldo']}
              labelFormatter={(idx) => (idx === 0 ? 'Saldo inicial' : `Trade #${idx} · ${fullDateBR(dateByIdx.get(idx))}`)}
            />
            {typeof accountSize === 'number' && (
              <ReferenceLine y={accountSize} stroke="#64748b" strokeDasharray="4 2" label={{ value: 'Inicial', fill: '#64748b', fontSize: 10, position: 'right' }} />
            )}
            {typeof drawdownThreshold === 'number' && (
              <ReferenceLine y={drawdownThreshold} stroke="#ef4444" strokeDasharray="4 2" label={{ value: 'DD threshold', fill: '#ef4444', fontSize: 10, position: 'right' }} />
            )}
            <Line
              type="monotone"
              dataKey="balance"
              stroke={deltaPositive ? '#10b981' : '#ef4444'}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex justify-between text-[10px] text-slate-500 mt-1">
        <span>{trades.length} {trades.length === 1 ? 'trade' : 'trades'}</span>
        {firstDate && lastDate && (
          <span>{fullDateBR(firstDate)} → {fullDateBR(lastDate)}</span>
        )}
      </div>
      <DebugBadge component="PropEquityCurve" embedded />
    </div>
  );
};

export default PropEquityCurve;
