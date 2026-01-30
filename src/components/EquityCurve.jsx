import { useMemo } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { generateEquityCurve, formatCurrency, formatDate } from '../utils/calculations';

const EquityCurve = ({ trades, height = 300 }) => {
  const data = useMemo(() => {
    return generateEquityCurve(trades);
  }, [trades]);

  if (data.length < 2) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <TrendingUp className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-semibold text-white">Curva de Capital</h3>
        </div>
        <div className="flex items-center justify-center h-48 text-slate-500">
          Registre pelo menos 2 trades para ver a curva de capital
        </div>
      </div>
    );
  }

  const finalPL = data[data.length - 1]?.pl || 0;
  const isPositive = finalPL >= 0;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-800 border border-slate-700/50 rounded-lg p-3 shadow-xl">
          <p className="text-sm text-slate-400 mb-1">
            {formatDate(data.date)} • {data.ticker}
          </p>
          <p className={`text-lg font-bold ${data.pl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatCurrency(data.pl)}
          </p>
          {data.result !== 0 && (
            <p className={`text-xs ${data.result >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
              Trade: {formatCurrency(data.result)}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-semibold text-white">Curva de Capital</h3>
        </div>
        <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
          isPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
        }`}>
          {isPositive ? '+' : ''}{formatCurrency(finalPL)}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart 
          data={data} 
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorPL" x1="0" y1="0" x2="0" y2="1">
              <stop 
                offset="5%" 
                stopColor={isPositive ? "#10b981" : "#ef4444"} 
                stopOpacity={0.3}
              />
              <stop 
                offset="95%" 
                stopColor={isPositive ? "#10b981" : "#ef4444"} 
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="#334155" 
            vertical={false}
          />
          
          <XAxis 
            dataKey="date" 
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickLine={{ stroke: '#334155' }}
            axisLine={{ stroke: '#334155' }}
            tickFormatter={(value) => formatDate(value, 'dd/MM')}
          />
          
          <YAxis 
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickLine={{ stroke: '#334155' }}
            axisLine={{ stroke: '#334155' }}
            tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
            width={60}
          />
          
          <Tooltip content={<CustomTooltip />} />
          
          <ReferenceLine 
            y={0} 
            stroke="#64748b" 
            strokeDasharray="5 5"
            strokeWidth={1}
          />
          
          <Area
            type="monotone"
            dataKey="pl"
            stroke={isPositive ? "#10b981" : "#ef4444"}
            strokeWidth={2}
            fill="url(#colorPL)"
            dot={false}
            activeDot={{ 
              r: 6, 
              stroke: isPositive ? "#10b981" : "#ef4444",
              strokeWidth: 2,
              fill: '#1e293b'
            }}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Stats abaixo do gráfico */}
      <div className="flex items-center justify-around mt-4 pt-4 border-t border-slate-800/50">
        <div className="text-center">
          <p className="text-xs text-slate-500 mb-1">Início</p>
          <p className="text-sm font-semibold text-white">
            {formatDate(data[1]?.date)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-500 mb-1">Total Trades</p>
          <p className="text-sm font-semibold text-white">
            {trades.length}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-500 mb-1">Último</p>
          <p className="text-sm font-semibold text-white">
            {formatDate(data[data.length - 1]?.date)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default EquityCurve;
