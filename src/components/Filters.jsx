import { Search, Filter, X, Wallet, ShieldCheck, FlaskConical } from 'lucide-react';
import { useMasterData } from '../hooks/useMasterData';

/**
 * Helpers para retrocompatibilidade type/isReal
 */
const isRealAccount = (acc) => {
  if (acc.type) return acc.type === 'REAL' || acc.type === 'PROP';
  return acc.isReal === true;
};

const isDemoAccount = (acc) => {
  if (acc.type) return acc.type === 'DEMO';
  return acc.isReal === false || acc.isReal === undefined;
};

const Filters = ({ filters, onFilterChange, onReset, tickers = [], accounts = [] }) => {
  // Buscar dados mestres do Firestore
  const { setups, exchanges, emotions, loading: masterLoading } = useMasterData();
  
  const handleChange = (key, value) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const hasActiveFilters = 
    filters.period !== 'all' || 
    filters.ticker !== 'all' ||
    filters.setup !== 'all' || 
    filters.emotion !== 'all' || 
    filters.exchange !== 'all' || 
    filters.result !== 'all' ||
    filters.search !== '' ||
    (filters.accountId && filters.accountId !== 'all_real' && filters.accountId !== 'all_demo');

  // Separação de contas usando lógica híbrida
  const realAccounts = accounts.filter(isRealAccount);
  const demoAccounts = accounts.filter(isDemoAccount);

  // Determinar se está em modo demo baseado no filtro atual
  const isCurrentFilterDemo = () => {
    if (filters.accountId === 'all_demo') return true;
    if (filters.accountId === 'all_real') return false;
    const selectedAcc = accounts.find(a => a.id === filters.accountId);
    return selectedAcc ? isDemoAccount(selectedAcc) : true;
  };

  return (
    <div className="glass-card p-4 space-y-4">
      
      {/* 1. Barra de Busca e Filtro de Conta (Linha Principal) */}
      <div className="flex flex-col md:flex-row gap-4">
        
        {/* SELETOR DE CONTA (HIERÁRQUICO) */}
        <div className="w-full md:w-1/3 relative">
          <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 z-10" />
          <select
            value={filters.accountId || 'all_demo'}
            onChange={(e) => handleChange('accountId', e.target.value)}
            className={`w-full bg-slate-800 border rounded-xl pl-10 pr-4 py-2.5 text-white appearance-none outline-none focus:ring-2 focus:ring-blue-500/50 font-medium ${
              isCurrentFilterDemo()
                ? 'border-yellow-500/30 focus:border-yellow-500' 
                : 'border-emerald-500/30 focus:border-emerald-500'
            }`}
          >
            <optgroup label="Visão Agregada">
              <option value="all_real">💰 Todas as Reais ({realAccounts.length})</option>
              <option value="all_demo">🧪 Todas as Demo ({demoAccounts.length})</option>
            </optgroup>
            
            {realAccounts.length > 0 && (
              <optgroup label="Contas Reais">
                {realAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.type === 'PROP' ? '🏆' : '🛡️'} {acc.name}
                  </option>
                ))}
              </optgroup>
            )}

            {demoAccounts.length > 0 && (
              <optgroup label="Contas Demo/Simulado">
                {demoAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>🧪 {acc.name}</option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        {/* BUSCA TEXTUAL */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por ticker, notas, setup..."
            value={filters.search || ''}
            onChange={(e) => handleChange('search', e.target.value)}
            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
          />
        </div>
      </div>

      {/* 2. Grid de Filtros Secundários */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Período</label>
          <select value={filters.period || 'all'} onChange={(e) => handleChange('period', e.target.value)} className="input-filter">
            <option value="all">Todo período</option>
            <option value="today">Hoje</option>
            <option value="week">Esta Semana</option>
            <option value="month">Este Mês</option>
            <option value="year">Este Ano</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Ativo</label>
          <select value={filters.ticker || 'all'} onChange={(e) => handleChange('ticker', e.target.value)} className="input-filter uppercase">
            <option value="all">Todos</option>
            {tickers.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Setup</label>
          <select value={filters.setup || 'all'} onChange={(e) => handleChange('setup', e.target.value)} className="input-filter">
            <option value="all">Todos</option>
            {setups.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Emoção</label>
          <select value={filters.emotion || 'all'} onChange={(e) => handleChange('emotion', e.target.value)} className="input-filter">
            <option value="all">Todas</option>
            {emotions.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Bolsa</label>
          <select value={filters.exchange || 'all'} onChange={(e) => handleChange('exchange', e.target.value)} className="input-filter">
            <option value="all">Todas</option>
            {exchanges.map(ex => <option key={ex.id} value={ex.code}>{ex.code}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Resultado</label>
          <select value={filters.result || 'all'} onChange={(e) => handleChange('result', e.target.value)} className="input-filter">
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
