import { useState, useEffect } from 'react';
import { 
  X, 
  Loader2, 
  AlertCircle,
  Wallet,
  Building2,
  Coins,
  Tag,
  DollarSign
} from 'lucide-react';
import { ACCOUNT_TYPES } from '../firebase';
import { useMasterData } from '../hooks/useMasterData';

const AddAccountModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  editAccount = null,
  loading = false 
}) => {
  const { brokers, currencies, loading: masterDataLoading } = useMasterData();
  
  const [formData, setFormData] = useState({
    name: '',
    broker: '',
    type: 'REAL',
    initialBalance: '',
    currency: 'BRL',
  });
  
  const [errors, setErrors] = useState({});

  // Preencher dados para edição
  useEffect(() => {
    if (editAccount) {
      setFormData({
        name: editAccount.name || '',
        broker: editAccount.broker || '',
        type: editAccount.type || 'REAL',
        initialBalance: editAccount.initialBalance?.toString() || '',
        currency: editAccount.currency || 'BRL',
      });
    } else {
      // Reset form
      setFormData({
        name: '',
        broker: '',
        type: 'REAL',
        initialBalance: '',
        currency: 'BRL',
      });
    }
    setErrors({});
  }, [editAccount, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Limpar erro do campo
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Nome da conta é obrigatório';
    }
    
    if (!formData.broker.trim()) {
      newErrors.broker = 'Corretora é obrigatória';
    }
    
    if (!formData.initialBalance || isNaN(parseFloat(formData.initialBalance))) {
      newErrors.initialBalance = 'Saldo inicial inválido';
    } else if (parseFloat(formData.initialBalance) < 0) {
      newErrors.initialBalance = 'Saldo não pode ser negativo';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validate()) return;

    try {
      const accountData = {
        ...formData,
        initialBalance: parseFloat(formData.initialBalance),
      };
      
      await onSubmit(accountData, editAccount?.id);
      onClose();
    } catch (err) {
      setErrors({ submit: err.message });
    }
  };

  if (!isOpen) return null;

  // Mapear tipo de conta para labels e cores
  const accountTypeConfig = {
    'REAL': { 
      label: 'Conta Real', 
      description: 'Dinheiro real em corretora',
      color: 'emerald',
      icon: '💰'
    },
    'DEMO': { 
      label: 'Conta Demo', 
      description: 'Conta de simulação/prática',
      color: 'blue',
      icon: '🎮'
    },
    'PROP': { 
      label: 'Prop Firm', 
      description: 'Mesa proprietária',
      color: 'purple',
      icon: '🏢'
    }
  };

  // Moedas disponíveis (fallback se masterData não carregar)
  const availableCurrencies = currencies.length > 0 
    ? currencies 
    : [
        { code: 'BRL', name: 'Real Brasileiro', symbol: 'R$' },
        { code: 'USD', name: 'Dólar Americano', symbol: '$' },
        { code: 'EUR', name: 'Euro', symbol: '€' }
      ];

  // Corretoras disponíveis (fallback se masterData não carregar)
  const availableBrokers = brokers.length > 0
    ? brokers
    : [
        { name: 'XP Investimentos' },
        { name: 'Clear Corretora' },
        { name: 'Rico Investimentos' },
        { name: 'BTG Pactual' },
        { name: 'Interactive Brokers' },
        { name: 'TD Ameritrade' },
        { name: 'Apex Trader Funding' },
        { name: 'Topstep' },
        { name: 'FTMO' },
        { name: 'Outra' }
      ];

  return (
    <>
      {/* Backdrop */}
      <div 
        className="modal-backdrop"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="modal-content w-full max-w-lg max-h-[90vh] overflow-hidden">
        <div className="glass-card">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-800/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-display font-bold text-white">
                  {editAccount ? 'Editar Conta' : 'Nova Conta'}
                </h2>
                <p className="text-sm text-slate-500">
                  {editAccount ? 'Atualize os dados da conta' : 'Adicione uma nova conta de trading'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
            {errors.submit && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-400">{errors.submit}</p>
              </div>
            )}

            {/* Nome da Conta */}
            <div className="input-group mb-4">
              <label className="input-label flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Nome da Conta *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Ex: Conta Principal, Swing Trading..."
                className={errors.name ? 'ring-2 ring-red-500/50' : ''}
              />
              {errors.name && <span className="text-xs text-red-400">{errors.name}</span>}
            </div>

            {/* Tipo de Conta */}
            <div className="input-group mb-4">
              <label className="input-label">Tipo de Conta *</label>
              <div className="grid grid-cols-3 gap-3">
                {ACCOUNT_TYPES.map(type => {
                  const config = accountTypeConfig[type];
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, type }))}
                      className={`p-4 rounded-xl border transition-all ${
                        formData.type === type
                          ? config.color === 'emerald'
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                            : config.color === 'blue'
                              ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                              : 'bg-purple-500/20 border-purple-500/50 text-purple-400'
                          : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-700/50'
                      }`}
                    >
                      <div className="text-2xl mb-1">{config.icon}</div>
                      <div className="text-sm font-medium">{config.label}</div>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {accountTypeConfig[formData.type]?.description}
              </p>
            </div>

            {/* Corretora */}
            <div className="input-group mb-4">
              <label className="input-label flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Corretora *
              </label>
              <select
                name="broker"
                value={formData.broker}
                onChange={handleChange}
                className={errors.broker ? 'ring-2 ring-red-500/50' : ''}
              >
                <option value="">Selecione a corretora</option>
                {availableBrokers.map((broker, index) => (
                  <option key={broker.id || index} value={broker.name}>
                    {broker.name}
                  </option>
                ))}
              </select>
              {errors.broker && <span className="text-xs text-red-400">{errors.broker}</span>}
            </div>

            {/* Grid: Saldo Inicial e Moeda */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* Saldo Inicial */}
              <div className="input-group">
                <label className="input-label flex items-center gap-2">
                  <Coins className="w-4 h-4" />
                  Saldo Inicial *
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="number"
                    name="initialBalance"
                    value={formData.initialBalance}
                    onChange={handleChange}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className={`pl-10 ${errors.initialBalance ? 'ring-2 ring-red-500/50' : ''}`}
                  />
                </div>
                {errors.initialBalance && <span className="text-xs text-red-400">{errors.initialBalance}</span>}
              </div>

              {/* Moeda */}
              <div className="input-group">
                <label className="input-label">Moeda *</label>
                <select
                  name="currency"
                  value={formData.currency}
                  onChange={handleChange}
                >
                  {availableCurrencies.map(currency => (
                    <option key={currency.code} value={currency.code}>
                      {currency.symbol} - {currency.code}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Info sobre edição */}
            {editAccount && (
              <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <p className="text-sm text-blue-300">
                  💡 O saldo atual ({formData.currency === 'BRL' ? 'R$' : formData.currency === 'USD' ? '$' : '€'} {editAccount.currentBalance?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0.00'}) é calculado automaticamente baseado nos trades e movimentações.
                </p>
              </div>
            )}

            {/* Botões */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/50">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading || masterDataLoading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Salvando...
                  </>
                ) : editAccount ? (
                  'Salvar Alterações'
                ) : (
                  'Criar Conta'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default AddAccountModal;
