import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  ArrowRight,
  CheckCircle,
  Plus
} from 'lucide-react';

const AccountSummaryWidget = ({ 
  account,
  onViewAll,
  onAddAccount,
  className = ''
}) => {
  // Se não tem conta
  if (!account) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800/50 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-slate-500" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Conta de Trading</h3>
              <p className="text-xs text-slate-500">Nenhuma conta ativa</p>
            </div>
          </div>
        </div>

        <div className="text-center py-6">
          <p className="text-slate-500 mb-4">
            Configure uma conta para acompanhar seu capital
          </p>
          {onAddAccount && (
            <button onClick={onAddAccount} className="btn-primary">
              <Plus className="w-4 h-4 mr-2" />
              Criar Conta
            </button>
          )}
        </div>
      </div>
    );
  }

  // Cálculos
  const initialBalance = account.initialBalance || 0;
  const currentBalance = account.currentBalance || initialBalance;
  const variation = currentBalance - initialBalance;
  const variationPercent = initialBalance > 0 
    ? (variation / initialBalance) * 100 
    : 0;
  const isPositive = variation >= 0;

  // Mapear moeda para símbolo
  const currencySymbols = {
    'BRL': 'R$',
    'USD': '$',
    'EUR': '€'
  };
  const currencySymbol = currencySymbols[account.currency] || 'R$';

  // Mapear tipo para label
  const typeLabels = {
    'REAL': 'Real',
    'DEMO': 'Demo',
    'PROP': 'Prop Firm'
  };

  return (
    <div className={`glass-card overflow-hidden ${className}`}>
      {/* Header com gradiente */}
      <div className={`p-6 bg-gradient-to-r ${
        isPositive 
          ? 'from-emerald-500/20 to-teal-500/10' 
          : 'from-red-500/20 to-orange-500/10'
      }`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              isPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
            }`}>
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-white">{account.name}</h3>
                <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 rounded-full">
                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                  <span className="text-xs font-medium text-emerald-400">Ativa</span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span>{account.broker}</span>
                <span className="text-slate-600">•</span>
                <span>{typeLabels[account.type] || account.type}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Saldo Atual */}
        <div className="mt-6">
          <p className="text-sm text-slate-400 mb-1">Saldo Atual</p>
          <div className="flex items-end gap-3">
            <p className="text-3xl font-display font-bold text-white">
              {currencySymbol} {currentBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${
              isPositive 
                ? 'bg-emerald-500/20 text-emerald-400' 
                : 'bg-red-500/20 text-red-400'
            }`}>
              {isPositive ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <span className="text-sm font-semibold">
                {isPositive ? '+' : ''}{variationPercent.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="p-6">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-slate-800/30 rounded-xl p-3">
            <p className="text-xs text-slate-500 mb-1">Capital Inicial</p>
            <p className="font-medium text-white">
              {currencySymbol} {initialBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-slate-800/30 rounded-xl p-3">
            <p className="text-xs text-slate-500 mb-1">Variação</p>
            <p className={`font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositive ? '+' : ''}{currencySymbol} {Math.abs(variation).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Link para ver todas */}
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-xl transition-colors"
          >
            Ver todas as contas
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default AccountSummaryWidget;
