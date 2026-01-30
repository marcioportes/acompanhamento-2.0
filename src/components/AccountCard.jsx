import { useState } from 'react';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  MoreVertical,
  Edit,
  Trash2,
  CheckCircle,
  Circle,
  Building2,
  Coins,
  Calendar
} from 'lucide-react';
import { formatCurrency, formatPercent, formatDate } from '../utils/calculations';

const AccountCard = ({ 
  account, 
  onEdit, 
  onDelete, 
  onSetActive,
  showStudent = false,
  compact = false
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  // Calcular variação do saldo
  const initialBalance = account.initialBalance || 0;
  const currentBalance = account.currentBalance || initialBalance;
  const variation = currentBalance - initialBalance;
  const variationPercent = initialBalance > 0 
    ? ((currentBalance - initialBalance) / initialBalance) * 100 
    : 0;
  const isPositive = variation >= 0;

  // Mapear tipo de conta para labels
  const accountTypeLabels = {
    'REAL': { label: 'Real', color: 'emerald' },
    'DEMO': { label: 'Demo', color: 'blue' },
    'PROP': { label: 'Prop Firm', color: 'purple' }
  };

  const typeInfo = accountTypeLabels[account.type] || accountTypeLabels['REAL'];

  // Mapear moeda para símbolo
  const currencySymbols = {
    'BRL': 'R$',
    'USD': '$',
    'EUR': '€'
  };
  const currencySymbol = currencySymbols[account.currency] || 'R$';

  const handleDelete = () => {
    if (window.confirm(`Tem certeza que deseja excluir a conta "${account.name}"?`)) {
      onDelete?.(account);
    }
    setMenuOpen(false);
  };

  const handleSetActive = () => {
    onSetActive?.(account);
    setMenuOpen(false);
  };

  if (compact) {
    return (
      <div 
        className={`glass-card p-4 cursor-pointer transition-all duration-300 hover:scale-[1.02] ${
          account.active 
            ? 'ring-2 ring-emerald-500/50 bg-emerald-500/5' 
            : 'hover:bg-slate-800/30'
        }`}
        onClick={() => onSetActive?.(account)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              account.active 
                ? 'bg-emerald-500/20 text-emerald-400' 
                : 'bg-slate-800/50 text-slate-400'
            }`}>
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">{account.name}</span>
                {account.active && (
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                )}
              </div>
              <span className="text-xs text-slate-500">{account.broker}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="font-semibold text-white">
              {currencySymbol} {currentBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className={`text-xs ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositive ? '+' : ''}{variationPercent.toFixed(2)}%
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`glass-card overflow-hidden transition-all duration-300 hover:scale-[1.01] ${
        account.active 
          ? 'ring-2 ring-emerald-500/50' 
          : ''
      }`}
    >
      {/* Header com gradiente baseado no tipo */}
      <div className={`relative px-6 py-4 bg-gradient-to-r ${
        typeInfo.color === 'emerald' 
          ? 'from-emerald-500/20 to-teal-500/10' 
          : typeInfo.color === 'blue'
            ? 'from-blue-500/20 to-cyan-500/10'
            : 'from-purple-500/20 to-pink-500/10'
      }`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              typeInfo.color === 'emerald' 
                ? 'bg-emerald-500/20 text-emerald-400' 
                : typeInfo.color === 'blue'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-purple-500/20 text-purple-400'
            }`}>
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-white text-lg">
                  {account.name}
                </h3>
                {account.active && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 rounded-full">
                    <CheckCircle className="w-3 h-3 text-emerald-400" />
                    <span className="text-xs font-medium text-emerald-400">Ativa</span>
                  </span>
                )}
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                typeInfo.color === 'emerald' 
                  ? 'bg-emerald-500/20 text-emerald-400' 
                  : typeInfo.color === 'blue'
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-purple-500/20 text-purple-400'
              }`}>
                {typeInfo.label}
              </span>
            </div>
          </div>

          {/* Menu de ações */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            
            {menuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-700/50 rounded-lg shadow-xl z-20 py-1 min-w-[160px]">
                  {!account.active && (
                    <button
                      onClick={handleSetActive}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Definir como Ativa
                    </button>
                  )}
                  {onEdit && (
                    <button
                      onClick={() => {
                        onEdit(account);
                        setMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700/50 transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                      Editar
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={handleDelete}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Excluir
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-6">
        {/* Saldo atual */}
        <div className="mb-6">
          <p className="text-sm text-slate-500 mb-1">Saldo Atual</p>
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

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-slate-800/30 rounded-xl p-3">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <Coins className="w-4 h-4" />
              <span className="text-xs">Saldo Inicial</span>
            </div>
            <p className="text-white font-medium">
              {currencySymbol} {initialBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          
          <div className="bg-slate-800/30 rounded-xl p-3">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              {isPositive ? (
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-400" />
              )}
              <span className="text-xs">Variação</span>
            </div>
            <p className={`font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositive ? '+' : ''}{currencySymbol} {Math.abs(variation).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Detalhes adicionais */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800/50">
          <div className="flex items-center gap-2 text-slate-500">
            <Building2 className="w-4 h-4" />
            <span className="text-sm">{account.broker || 'Não informada'}</span>
          </div>
          
          {showStudent && account.studentName && (
            <span className="text-sm text-slate-400">
              {account.studentName}
            </span>
          )}
          
          {account.createdAt && (
            <div className="flex items-center gap-2 text-slate-500">
              <Calendar className="w-4 h-4" />
              <span className="text-xs">
                {account.createdAt?.toDate 
                  ? formatDate(account.createdAt.toDate(), 'dd/MM/yyyy')
                  : formatDate(account.createdAt, 'dd/MM/yyyy')
                }
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountCard;
