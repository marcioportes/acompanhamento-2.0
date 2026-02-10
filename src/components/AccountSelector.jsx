import { useState, useRef, useEffect } from 'react';
import { 
  Wallet, 
  ChevronDown, 
  CheckCircle,
  TrendingUp,
  TrendingDown,
  PlusCircle
} from 'lucide-react';

const AccountSelector = ({ 
  accounts, 
  selectedAccountId, 
  onSelect,
  onAddNew,
  label = 'Conta',
  required = false,
  error = null,
  compact = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Encontrar conta selecionada
  const selectedAccount = accounts.find(acc => acc.id === selectedAccountId);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Mapear tipo de conta para cores
  const getTypeColor = (type) => {
    switch (type) {
      case 'REAL': return 'emerald';
      case 'DEMO': return 'blue';
      case 'PROP': return 'purple';
      default: return 'slate';
    }
  };

  // Mapear moeda para símbolo
  const getCurrencySymbol = (currency) => {
    switch (currency) {
      case 'BRL': return 'R$';
      case 'USD': return '$';
      case 'EUR': return '€';
      default: return currency || 'R$';
    }
  };

  // Calcular variação
  const getVariation = (account) => {
    const initial = account.initialBalance || 0;
    const current = account.currentBalance || initial;
    const variation = current - initial;
    const percent = initial > 0 ? ((current - initial) / initial) * 100 : 0;
    return { variation, percent, isPositive: variation >= 0 };
  };

  if (compact) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
            selectedAccount
              ? 'bg-slate-800/50 text-white'
              : 'bg-slate-800/30 text-slate-400'
          } hover:bg-slate-700/50`}
        >
          <Wallet className="w-4 h-4" />
          <span className="text-sm">
            {selectedAccount?.name || 'Selecionar'}
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-slate-800 border border-slate-700/50 rounded-xl shadow-xl z-50 py-1 max-h-60 overflow-y-auto">
            {accounts.length === 0 ? (
              <div className="px-4 py-3 text-center text-slate-500 text-sm">
                Nenhuma conta disponível
              </div>
            ) : (
              accounts.map(account => {
                const { isPositive, percent } = getVariation(account);
                const color = getTypeColor(account.type);
                
                return (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => {
                      onSelect(account.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                      selectedAccountId === account.id
                        ? 'bg-blue-500/20 text-white'
                        : 'hover:bg-slate-700/50 text-slate-300'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      color === 'emerald' ? 'bg-emerald-500/20 text-emerald-400' :
                      color === 'blue' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-purple-500/20 text-purple-400'
                    }`}>
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{account.name}</span>
                        {account.active && (
                          <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{account.broker}</span>
                        <span className={isPositive ? 'text-emerald-400' : 'text-red-400'}>
                          {isPositive ? '+' : ''}{percent.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
            
            {onAddNew && (
              <>
                <div className="border-t border-slate-700/50 my-1" />
                <button
                  type="button"
                  onClick={() => {
                    onAddNew();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-blue-400 hover:bg-blue-500/10 transition-colors"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span className="text-sm">Nova Conta</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="input-group">
      {label && (
        <label className="input-label flex items-center gap-2">
          <Wallet className="w-4 h-4" />
          {label} {required && '*'}
        </label>
      )}
      
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
            error
              ? 'border-red-500/50 bg-red-500/5'
              : isOpen
                ? 'border-blue-500/50 bg-slate-800/80'
                : 'border-slate-700/50 bg-slate-800/50 hover:border-slate-600/50'
          }`}
        >
          {selectedAccount ? (
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                getTypeColor(selectedAccount.type) === 'emerald' ? 'bg-emerald-500/20 text-emerald-400' :
                getTypeColor(selectedAccount.type) === 'blue' ? 'bg-blue-500/20 text-blue-400' :
                'bg-purple-500/20 text-purple-400'
              }`}>
                <Wallet className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white">{selectedAccount.name}</span>
                  {selectedAccount.active && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/20 rounded text-xs text-emerald-400">
                      <CheckCircle className="w-3 h-3" />
                      Ativa
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500">{selectedAccount.broker}</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-400">
                    {getCurrencySymbol(selectedAccount.currency)}{' '}
                    {(selectedAccount.currentBalance || selectedAccount.initialBalance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <span className="text-slate-500">Selecione uma conta</span>
          )}
          
          <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700/50 rounded-xl shadow-xl z-50 py-2 max-h-72 overflow-y-auto">
            {accounts.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <Wallet className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                <p className="text-slate-500">Nenhuma conta disponível</p>
              </div>
            ) : (
              accounts.map(account => {
                const { variation, percent, isPositive } = getVariation(account);
                const color = getTypeColor(account.type);
                const isSelected = selectedAccountId === account.id;
                
                return (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => {
                      onSelect(account.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      isSelected
                        ? 'bg-blue-500/20'
                        : 'hover:bg-slate-700/50'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      color === 'emerald' ? 'bg-emerald-500/20 text-emerald-400' :
                      color === 'blue' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-purple-500/20 text-purple-400'
                    }`}>
                      <Wallet className="w-5 h-5" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white truncate">{account.name}</span>
                        {account.active && (
                          <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        )}
                        {isSelected && (
                          <CheckCircle className="w-4 h-4 text-blue-400 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <span>{account.broker}</span>
                        <span className="text-slate-600">•</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          color === 'emerald' ? 'bg-emerald-500/20 text-emerald-400' :
                          color === 'blue' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-purple-500/20 text-purple-400'
                        }`}>
                          {account.type === 'REAL' ? 'Real' : account.type === 'DEMO' ? 'Demo' : 'Prop'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="font-medium text-white">
                        {getCurrencySymbol(account.currency)}{' '}
                        {(account.currentBalance || account.initialBalance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <div className={`flex items-center justify-end gap-1 text-xs ${
                        isPositive ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {isPositive ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        <span>{isPositive ? '+' : ''}{percent.toFixed(1)}%</span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
            
            {onAddNew && (
              <>
                <div className="border-t border-slate-700/50 my-2" />
                <button
                  type="button"
                  onClick={() => {
                    onAddNew();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-blue-400 hover:bg-blue-500/10 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <PlusCircle className="w-5 h-5" />
                  </div>
                  <span className="font-medium">Adicionar Nova Conta</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
      
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
};

export default AccountSelector;
