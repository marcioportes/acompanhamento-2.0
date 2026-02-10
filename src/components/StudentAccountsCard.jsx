import { useState } from 'react';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  ChevronDown, 
  ChevronUp,
  CheckCircle,
  Eye
} from 'lucide-react';

const StudentAccountsCard = ({ 
  studentName,
  studentEmail,
  accounts,
  onViewAccount,
  defaultExpanded = false
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Calcular totais do aluno
  const totals = accounts.reduce((acc, account) => {
    const initial = account.initialBalance || 0;
    const current = account.currentBalance || initial;
    return {
      totalInitial: acc.totalInitial + initial,
      totalCurrent: acc.totalCurrent + current
    };
  }, { totalInitial: 0, totalCurrent: 0 });

  const variation = totals.totalCurrent - totals.totalInitial;
  const variationPercent = totals.totalInitial > 0 
    ? (variation / totals.totalInitial) * 100 
    : 0;
  const isPositive = variation >= 0;

  // Encontrar conta ativa
  const activeAccount = accounts.find(acc => acc.active);

  // Mapear tipo de conta para cores
  const getTypeStyles = (type) => {
    switch (type) {
      case 'REAL': return 'bg-emerald-500/20 text-emerald-400';
      case 'DEMO': return 'bg-blue-500/20 text-blue-400';
      case 'PROP': return 'bg-purple-500/20 text-purple-400';
      default: return 'bg-slate-500/20 text-slate-400';
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

  if (accounts.length === 0) {
    return (
      <div className="glass-card p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-800/50 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <p className="font-medium text-white">{studentName}</p>
            <p className="text-xs text-slate-500">Sem contas cadastradas</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      {/* Header - Sempre visível */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            isPositive ? 'bg-emerald-500/20' : 'bg-red-500/20'
          }`}>
            <Wallet className={`w-6 h-6 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`} />
          </div>
          <div className="text-left">
            <p className="font-medium text-white">{studentName}</p>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>{accounts.length} conta{accounts.length > 1 ? 's' : ''}</span>
              {activeAccount && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle className="w-3 h-3" />
                    {activeAccount.name}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Totais */}
          <div className="text-right">
            <p className="font-semibold text-white">
              R$ {totals.totalCurrent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <div className={`flex items-center justify-end gap-1 text-sm ${
              isPositive ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {isPositive ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <span>{isPositive ? '+' : ''}{variationPercent.toFixed(2)}%</span>
            </div>
          </div>

          {/* Toggle */}
          <div className="p-2 rounded-lg bg-slate-800/50">
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </div>
        </div>
      </button>

      {/* Contas expandidas */}
      {isExpanded && (
        <div className="border-t border-slate-800/50">
          {accounts.map((account, index) => {
            const initial = account.initialBalance || 0;
            const current = account.currentBalance || initial;
            const accVariation = current - initial;
            const accPercent = initial > 0 ? (accVariation / initial) * 100 : 0;
            const accIsPositive = accVariation >= 0;

            return (
              <div
                key={account.id}
                className={`p-4 flex items-center justify-between ${
                  index !== accounts.length - 1 ? 'border-b border-slate-800/30' : ''
                } ${account.active ? 'bg-emerald-500/5' : ''} hover:bg-slate-800/30 transition-colors`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getTypeStyles(account.type)}`}>
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{account.name}</span>
                      {account.active && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/20 rounded text-xs text-emerald-400">
                          <CheckCircle className="w-3 h-3" />
                          Ativa
                        </span>
                      )}
                      <span className={`text-xs px-1.5 py-0.5 rounded ${getTypeStyles(account.type)}`}>
                        {account.type === 'REAL' ? 'Real' : account.type === 'DEMO' ? 'Demo' : 'Prop'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500">{account.broker}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-medium text-white">
                      {getCurrencySymbol(account.currency)} {current.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <div className={`flex items-center justify-end gap-1 text-xs ${
                      accIsPositive ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {accIsPositive ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      <span>
                        {accIsPositive ? '+' : ''}{getCurrencySymbol(account.currency)} {Math.abs(accVariation).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        {' '}({accIsPositive ? '+' : ''}{accPercent.toFixed(1)}%)
                      </span>
                    </div>
                  </div>

                  {onViewAccount && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewAccount(account);
                      }}
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
                      title="Ver detalhes"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StudentAccountsCard;
