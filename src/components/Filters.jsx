import { Search, X } from 'lucide-react';
import { useMasterData } from '../hooks/useMasterData';

const Filters = ({ filters = {}, onFilterChange, onReset, tickers = [] }) => {
  const { setups, exchanges, emotions } = useMasterData();
  
  const handleChange = (key, value) => {
    if (onFilterChange) {
      onFilterChange({ ...filters, [key]: value });
    }
  };

  const hasActiveFilters = 
    (filters?.period || 'all') !== 'all' || 
    (filters?.ticker || 'all') !== 'all' ||
    (filters?.setup || 'all') !== 'all' || 
    (filters?.emotion || 'all') !== 'all' || 
    (filters?.exchange || 'all') !== 'all' || 
    (filters?.result || 'all') !== 'all' ||
    (filters?.search || '') !== '';

  return (
    <div className="glass-card p-4 space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          placeholder="Buscar por ticker, notas, setup..."
          value={filters?.search || ''}
          onChange={(e) => handleChange('search', e.target.value)}
          className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Período</label>
          <select value={filters?.period || 'all'} onChange={(e) => handleChange('period', e.target.value)} className="input-filter">
            <option value="all">Todo período</option>
            <option value="today">Hoje</option>
            <option value="week">Esta Semana</option>
            <option value="month">Este Mês</option>
            <option value="year">Este Ano</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Ativo</label>
          <select value={filters?.ticker || 'all'} onChange={(e) => handleChange('ticker', e.target.value)} className="input-filter uppercase">
            <option value="all">Todos</option>
            {tickers.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Setup</label>
          <select value={filters?.setup || 'all'} onChange={(e) => handleChange('setup', e.target.value)} className="input-filter">
            <option value="all">Todos</option>
            {setups.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Emoção</label>
          <select value={filters?.emotion || 'all'} onChange={(e) => handleChange('emotion', e.target.value)} className="input-filter">
            <option value="all">Todas</option>
            {emotions.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Bolsa</label>
          <select value={filters?.exchange || 'all'} onChange={(e) => handleChange('exchange', e.target.value)} className="input-filter">
            <option value="all">Todas</option>
            {exchanges.map(ex => <option key={ex.id} value={ex.code}>{ex.code}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Resultado</label>
          <select value={filters?.result || 'all'} onChange={(e) => handleChange('result', e.target.value)} className="input-filter">
            <option value="all">Todos</option>
            <option value="wins">Wins (Gain)</option>
            <option value="losses">Losses (Loss)</option>
          </select>
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex justify-end border-t border-slate-800 pt-3">
          <button onClick={onReset} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
            <X className="w-3 h-3" /> Limpar Filtros
          </button>
        </div>
      )}

      <style>{`
        .input-filter {
          width: 100%; background-color: rgb(30 41 59); border: 1px solid rgb(51 65 85);
          border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; color: white;
          outline: none; transition: all 0.2s;
        }
        .input-filter:focus { border-color: rgb(59 130 246); }
      `}</style>
    </div>
  );
};

export default Filters;