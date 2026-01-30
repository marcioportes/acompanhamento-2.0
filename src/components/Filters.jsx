import { useState } from 'react';
import { 
  Filter, 
  Calendar, 
  X, 
  Search,
  ChevronDown,
  ChevronUp,
  RotateCcw
} from 'lucide-react';
import { SETUPS, EMOTIONS, EXCHANGES } from '../firebase';

const Filters = ({ 
  filters, 
  onFilterChange, 
  onReset,
  showSearch = true,
  compact = false 
}) => {
  const [isExpanded, setIsExpanded] = useState(!compact);

  const periods = [
    { value: 'all', label: 'Todo período' },
    { value: 'today', label: 'Hoje' },
    { value: 'week', label: 'Esta semana' },
    { value: 'month', label: 'Este mês' },
    { value: '3months', label: '3 meses' },
    { value: 'year', label: 'Este ano' },
    { value: 'custom', label: 'Customizado' },
  ];

  const results = [
    { value: 'all', label: 'Todos' },
    { value: 'wins', label: 'Apenas Wins' },
    { value: 'losses', label: 'Apenas Losses' },
  ];

  const handleChange = (key, value) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const hasActiveFilters = () => {
    return (
      filters.period !== 'all' ||
      filters.setup !== 'all' ||
      filters.emotion !== 'all' ||
      filters.exchange !== 'all' ||
      filters.result !== 'all' ||
      filters.search?.trim() ||
      filters.startDate ||
      filters.endDate
    );
  };

  return (
    <div className="glass-card p-4">
      {/* Header com toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Filter className="w-5 h-5 text-blue-400" />
          <span className="font-medium text-white">Filtros</span>
          {hasActiveFilters() && (
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {hasActiveFilters() && (
            <button
              onClick={onReset}
              className="flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Limpar
            </button>
          )}
          
          {compact && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      {showSearch && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por ticker, notas..."
            value={filters.search || ''}
            onChange={(e) => handleChange('search', e.target.value)}
            className="w-full pl-10 pr-10"
          />
          {filters.search && (
            <button
              onClick={() => handleChange('search', '')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Filtros expandidos */}
      {isExpanded && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Período */}
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Período</label>
            <select
              value={filters.period || 'all'}
              onChange={(e) => handleChange('period', e.target.value)}
              className="w-full text-sm py-2"
            >
              {periods.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Datas customizadas */}
          {filters.period === 'custom' && (
            <>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Data Início</label>
                <input
                  type="date"
                  value={filters.startDate || ''}
                  onChange={(e) => handleChange('startDate', e.target.value)}
                  className="w-full text-sm py-2"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Data Fim</label>
                <input
                  type="date"
                  value={filters.endDate || ''}
                  onChange={(e) => handleChange('endDate', e.target.value)}
                  className="w-full text-sm py-2"
                />
              </div>
            </>
          )}

          {/* Setup */}
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Setup</label>
            <select
              value={filters.setup || 'all'}
              onChange={(e) => handleChange('setup', e.target.value)}
              className="w-full text-sm py-2"
            >
              <option value="all">Todos</option>
              {SETUPS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Emoção */}
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Emoção</label>
            <select
              value={filters.emotion || 'all'}
              onChange={(e) => handleChange('emotion', e.target.value)}
              className="w-full text-sm py-2"
            >
              <option value="all">Todas</option>
              {EMOTIONS.map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>

          {/* Bolsa */}
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Bolsa</label>
            <select
              value={filters.exchange || 'all'}
              onChange={(e) => handleChange('exchange', e.target.value)}
              className="w-full text-sm py-2"
            >
              <option value="all">Todas</option>
              {EXCHANGES.map(ex => (
                <option key={ex} value={ex}>{ex}</option>
              ))}
            </select>
          </div>

          {/* Resultado */}
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Resultado</label>
            <select
              value={filters.result || 'all'}
              onChange={(e) => handleChange('result', e.target.value)}
              className="w-full text-sm py-2"
            >
              {results.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

export default Filters;
