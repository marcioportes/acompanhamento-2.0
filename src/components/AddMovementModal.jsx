import { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Loader2, 
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  Wallet,
  ChevronDown,
  CheckCircle,
  Calendar,
  FileText,
  DollarSign
} from 'lucide-react';
import { MOVEMENT_TYPES } from '../firebase';
import { useAccounts } from '../hooks/useAccounts';

const AddMovementModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  preselectedAccountId = null,
  loading = false 
}) => {
  const { accounts, loading: accountsLoading } = useAccounts();
  
  const [formData, setFormData] = useState({
    type: 'DEPOSIT',
    amount: '',
    accountId: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
  });
  
  const [errors, setErrors] = useState({});
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);

  const accountDropdownRef = useRef(null);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(event.target)) {
        setShowAccountDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset form quando abre ou muda conta pré-selecionada
  useEffect(() => {
    if (isOpen) {
      const activeAccount = accounts.find(acc => acc.active);
      setFormData({
        type: 'DEPOSIT',
        amount: '',
        accountId: preselectedAccountId || activeAccount?.id || '',
        date: new Date().toISOString().split('T')[0],
        description: '',
      });
      setErrors({});
    }
  }, [isOpen, preselectedAccountId, accounts]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleTypeSelect = (type) => {
    setFormData(prev => ({ ...prev, type }));
  };

  const handleAccountSelect = (accountId) => {
    setFormData(prev => ({ ...prev, accountId }));
    setShowAccountDropdown(false);
    if (errors.accountId) {
      setErrors(prev => ({ ...prev, accountId: null }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.amount || isNaN(parseFloat(formData.amount)) || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Valor deve ser maior que zero';
    }

    if (!formData.accountId) {
      newErrors.accountId = 'Selecione uma conta';
    }

    if (!formData.date) {
      newErrors.date = 'Data é obrigatória';
    }

    // Validar se saque não excede saldo (opcional, pode remover se quiser permitir saldo negativo)
    if (formData.type === 'WITHDRAWAL' && formData.accountId) {
      const account = accounts.find(acc => acc.id === formData.accountId);
      if (account) {
        const currentBalance = account.currentBalance || account.initialBalance || 0;
        const withdrawAmount = parseFloat(formData.amount) || 0;
        if (withdrawAmount > currentBalance) {
          newErrors.amount = `Saldo insuficiente (disponível: R$ ${currentBalance.toFixed(2)})`;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validate()) return;

    try {
      const movementData = {
        ...formData,
        amount: parseFloat(formData.amount),
      };
      
      await onSubmit(movementData);
      onClose();
    } catch (err) {
      setErrors({ submit: err.message });
    }
  };

  // Encontrar conta selecionada
  const selectedAccount = accounts.find(acc => acc.id === formData.accountId);

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

  if (!isOpen) return null;

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
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                formData.type === 'DEPOSIT'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {formData.type === 'DEPOSIT' ? (
                  <ArrowDownCircle className="w-5 h-5" />
                ) : (
                  <ArrowUpCircle className="w-5 h-5" />
                )}
              </div>
              <div>
                <h2 className="text-xl font-display font-bold text-white">
                  Nova Movimentação
                </h2>
                <p className="text-sm text-slate-500">
                  Registre um depósito ou saque
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
          <form onSubmit={handleSubmit} className="p-6">
            {errors.submit && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-400">{errors.submit}</p>
              </div>
            )}

            {/* Tipo de Movimentação */}
            <div className="mb-6">
              <label className="input-label">Tipo de Movimentação *</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleTypeSelect('DEPOSIT')}
                  className={`p-4 rounded-xl border transition-all flex items-center gap-3 ${
                    formData.type === 'DEPOSIT'
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                      : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-700/50'
                  }`}
                >
                  <ArrowDownCircle className="w-6 h-6" />
                  <div className="text-left">
                    <div className="font-medium">Depósito</div>
                    <div className="text-xs opacity-70">Entrada de capital</div>
                  </div>
                </button>
                
                <button
                  type="button"
                  onClick={() => handleTypeSelect('WITHDRAWAL')}
                  className={`p-4 rounded-xl border transition-all flex items-center gap-3 ${
                    formData.type === 'WITHDRAWAL'
                      ? 'bg-red-500/20 border-red-500/50 text-red-400'
                      : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-700/50'
                  }`}
                >
                  <ArrowUpCircle className="w-6 h-6" />
                  <div className="text-left">
                    <div className="font-medium">Saque</div>
                    <div className="text-xs opacity-70">Retirada de capital</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Seletor de Conta */}
            <div className="mb-4">
              <label className="input-label flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                Conta *
              </label>
              
              <div className="relative" ref={accountDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                    errors.accountId
                      ? 'border-red-500/50 bg-red-500/5'
                      : showAccountDropdown
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
                            <CheckCircle className="w-4 h-4 text-emerald-400" />
                          )}
                        </div>
                        <div className="text-sm text-slate-500">
                          Saldo: {getCurrencySymbol(selectedAccount.currency)}{' '}
                          {(selectedAccount.currentBalance || selectedAccount.initialBalance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-500">Selecione uma conta</span>
                  )}
                  
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${showAccountDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showAccountDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700/50 rounded-xl shadow-xl z-50 py-2 max-h-60 overflow-y-auto">
                    {accountsLoading ? (
                      <div className="px-4 py-3 text-center text-slate-500 text-sm">
                        Carregando contas...
                      </div>
                    ) : accounts.length === 0 ? (
                      <div className="px-4 py-6 text-center">
                        <Wallet className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                        <p className="text-slate-500 text-sm">Nenhuma conta cadastrada</p>
                      </div>
                    ) : (
                      accounts.map(account => {
                        const color = getTypeColor(account.type);
                        const isSelected = formData.accountId === account.id;
                        
                        return (
                          <button
                            key={account.id}
                            type="button"
                            onClick={() => handleAccountSelect(account.id)}
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
                              </div>
                              <div className="text-sm text-slate-500">
                                {account.broker}
                              </div>
                            </div>
                            
                            <div className="text-right">
                              <p className="font-medium text-white text-sm">
                                {getCurrencySymbol(account.currency)}{' '}
                                {(account.currentBalance || account.initialBalance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
              {errors.accountId && <span className="text-xs text-red-400 mt-1">{errors.accountId}</span>}
            </div>

            {/* Valor e Data */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* Valor */}
              <div className="input-group">
                <label className="input-label flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Valor *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    {selectedAccount ? getCurrencySymbol(selectedAccount.currency) : 'R$'}
                  </span>
                  <input
                    type="number"
                    name="amount"
                    value={formData.amount}
                    onChange={handleChange}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className={`pl-10 ${errors.amount ? 'ring-2 ring-red-500/50' : ''}`}
                  />
                </div>
                {errors.amount && <span className="text-xs text-red-400">{errors.amount}</span>}
              </div>

              {/* Data */}
              <div className="input-group">
                <label className="input-label flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Data *
                </label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  className={errors.date ? 'ring-2 ring-red-500/50' : ''}
                />
                {errors.date && <span className="text-xs text-red-400">{errors.date}</span>}
              </div>
            </div>

            {/* Descrição */}
            <div className="input-group mb-6">
              <label className="input-label flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Descrição (opcional)
              </label>
              <input
                type="text"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Ex: Aporte mensal, Retirada de lucros..."
              />
            </div>

            {/* Preview do resultado */}
            {selectedAccount && formData.amount && (
              <div className={`mb-6 p-4 rounded-xl border ${
                formData.type === 'DEPOSIT'
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Saldo após movimentação:</span>
                  <span className={`font-semibold ${
                    formData.type === 'DEPOSIT' ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {getCurrencySymbol(selectedAccount.currency)}{' '}
                    {(
                      (selectedAccount.currentBalance || selectedAccount.initialBalance || 0) +
                      (formData.type === 'DEPOSIT' ? 1 : -1) * (parseFloat(formData.amount) || 0)
                    ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
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
                className={`btn-primary ${
                  formData.type === 'DEPOSIT'
                    ? 'bg-emerald-500 hover:bg-emerald-600'
                    : 'bg-red-500 hover:bg-red-600'
                }`}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Salvando...
                  </>
                ) : (
                  <>
                    {formData.type === 'DEPOSIT' ? (
                      <ArrowDownCircle className="w-4 h-4 mr-2" />
                    ) : (
                      <ArrowUpCircle className="w-4 h-4 mr-2" />
                    )}
                    Registrar {formData.type === 'DEPOSIT' ? 'Depósito' : 'Saque'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default AddMovementModal;
