import { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Upload, 
  Image, 
  Loader2, 
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Wallet,
  ChevronDown,
  CheckCircle
} from 'lucide-react';
import { SETUPS, EMOTIONS, EXCHANGES, SIDES } from '../firebase';
import { useAccounts } from '../hooks/useAccounts';
import { useMasterData } from '../hooks/useMasterData';

const AddTradeModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  editTrade = null,
  loading = false 
}) => {
  const { accounts, loading: accountsLoading } = useAccounts();
  const { tickers: masterTickers } = useMasterData(); 
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    ticker: '',
    exchange: 'B3',
    side: 'LONG',
    entry: '',
    exit: '',
    qty: '',
    setup: 'Rompimento',
    emotion: 'Disciplinado',
    notes: '',
    accountId: '',
  });
  
  const [htfFile, setHtfFile] = useState(null);
  const [ltfFile, setLtfFile] = useState(null);
  const [htfPreview, setHtfPreview] = useState(null);
  const [ltfPreview, setLtfPreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [previewResult, setPreviewResult] = useState(null);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  
  // Regra ativa para cálculo de Ticks (ex: WINFUT, ES)
  const [activeAssetRule, setActiveAssetRule] = useState(null);

  const htfInputRef = useRef(null);
  const ltfInputRef = useRef(null);
  const accountDropdownRef = useRef(null);

  // Fechar dropdown de conta ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(event.target)) {
        setShowAccountDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Inicialização: Preencher dados para edição ou resetar para novo trade
  useEffect(() => {
    if (!isOpen) return;
    
    if (editTrade) {
      setFormData({
        date: editTrade.date,
        ticker: editTrade.ticker,
        exchange: editTrade.exchange,
        side: editTrade.side,
        entry: editTrade.entry.toString(),
        exit: editTrade.exit.toString(),
        qty: editTrade.qty.toString(),
        setup: editTrade.setup,
        emotion: editTrade.emotion,
        notes: editTrade.notes || '',
        accountId: editTrade.accountId || '',
      });
      if (editTrade.htfUrl) setHtfPreview(editTrade.htfUrl);
      if (editTrade.ltfUrl) setLtfPreview(editTrade.ltfUrl);
    } else {
      setFormData(prev => ({
        date: new Date().toISOString().split('T')[0],
        ticker: '',
        exchange: 'B3',
        side: 'LONG',
        entry: '',
        exit: '',
        qty: '',
        setup: 'Rompimento',
        emotion: 'Disciplinado',
        notes: '',
        accountId: prev.accountId && accounts.find(acc => acc.id === prev.accountId) 
          ? prev.accountId 
          : (accounts.find(acc => acc.active)?.id || ''),
      }));
      setHtfFile(null);
      setLtfFile(null);
      setHtfPreview(null);
      setLtfPreview(null);
      setActiveAssetRule(null);
    }
    setErrors({});
  }, [editTrade, isOpen]); 

  // Selecionar conta ativa por padrão se não houver seleção
  useEffect(() => {
    if (!formData.accountId && accounts.length > 0 && isOpen) {
      const activeAccount = accounts.find(acc => acc.active);
      if (activeAccount) {
        setFormData(prev => ({ ...prev, accountId: activeAccount.id }));
      }
    }
    // Se a conta selecionada não existe mais (foi deletada), reseta
    if (formData.accountId && accounts.length > 0 && !accounts.find(acc => acc.id === formData.accountId)) {
      const activeAccount = accounts.find(acc => acc.active);
      setFormData(prev => ({ ...prev, accountId: activeAccount?.id || '' }));
    }
  }, [accounts, isOpen]);

  // Detectar regra do ativo automaticamente (WINFUT, ES, etc)
  useEffect(() => {
    if (!formData.ticker) {
      setActiveAssetRule(null);
      return;
    }

    const userInput = formData.ticker.toUpperCase();
    const rule = masterTickers.find(t => 
      t.symbol === userInput || userInput.startsWith(t.symbol)
    );

    if (rule) {
      setActiveAssetRule(rule);
      if (rule.exchange) {
        setFormData(prev => ({ ...prev, exchange: rule.exchange }));
      }
    } else {
      setActiveAssetRule(null);
    }
  }, [formData.ticker, masterTickers]);

  // Calcular preview do resultado em tempo real
  useEffect(() => {
    const { entry, exit, qty, side } = formData;
    if (entry && exit && qty) {
      const entryNum = parseFloat(entry);
      const exitNum = parseFloat(exit);
      const qtyNum = parseFloat(qty);
      
      if (!isNaN(entryNum) && !isNaN(exitNum) && !isNaN(qtyNum)) {
        let rawDiff;
        if (side === 'LONG') {
          rawDiff = exitNum - entryNum;
        } else {
          rawDiff = entryNum - exitNum;
        }

        let result;
        // Lógica Híbrida: Se tem regra de tick (ex: WINFUT), usa ela. Se não, cálculo simples.
        if (activeAssetRule && activeAssetRule.tickSize && activeAssetRule.tickValue) {
           const ticks = rawDiff / activeAssetRule.tickSize;
           result = ticks * activeAssetRule.tickValue * qtyNum;
        } else {
           result = rawDiff * qtyNum;
        }

        setPreviewResult(result);
      }
    } else {
      setPreviewResult(null);
    }
  }, [formData.entry, formData.exit, formData.qty, formData.side, activeAssetRule]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleAccountSelect = (accountId) => {
    setFormData(prev => ({ ...prev, accountId }));
    setShowAccountDropdown(false);
    if (errors.accountId) {
      setErrors(prev => ({ ...prev, accountId: null }));
    }
  };

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/jpg', 'image/webp'].includes(file.type)) {
      setErrors(prev => ({ ...prev, [type]: 'Apenas imagens JPG, PNG ou WebP são aceitas' }));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, [type]: 'Imagem muito grande (máximo 5MB)' }));
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (type === 'htf') {
        setHtfFile(file);
        setHtfPreview(reader.result);
      } else {
        setLtfFile(file);
        setLtfPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
    setErrors(prev => ({ ...prev, [type]: null }));
  };

  const removeImage = (type) => {
    if (type === 'htf') {
      setHtfFile(null);
      setHtfPreview(null);
      if (htfInputRef.current) htfInputRef.current.value = '';
    } else {
      setLtfFile(null);
      setLtfPreview(null);
      if (ltfInputRef.current) ltfInputRef.current.value = '';
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.date) newErrors.date = 'Data é obrigatória';
    if (!formData.ticker.trim()) newErrors.ticker = 'Ticker é obrigatório';
    if (!formData.entry || isNaN(parseFloat(formData.entry))) newErrors.entry = 'Preço inválido';
    if (!formData.exit || isNaN(parseFloat(formData.exit))) newErrors.exit = 'Preço inválido';
    if (!formData.qty || isNaN(parseFloat(formData.qty)) || parseFloat(formData.qty) <= 0) newErrors.qty = 'Quantidade inválida';
    if (!formData.accountId) newErrors.accountId = 'Selecione uma conta';

    if (!editTrade) {
      if (!htfFile && !htfPreview) newErrors.htf = 'Imagem HTF é obrigatória';
      if (!ltfFile && !ltfPreview) newErrors.ltf = 'Imagem LTF é obrigatória';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    // Injeta o resultado calculado (que já considera os ticks)
    const payload = {
        ...formData,
        result: previewResult
    };

    try {
      await onSubmit(payload, htfFile, ltfFile);
      onClose();
    } catch (err) {
      setErrors({ submit: err.message });
    }
  };

  // Helpers de UI
  const selectedAccount = accounts.find(acc => acc.id === formData.accountId);

  const getTypeColor = (type) => {
    switch (type) {
      case 'REAL': return 'emerald';
      case 'DEMO': return 'blue';
      case 'PROP': return 'purple';
      default: return 'slate';
    }
  };

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
      <div className="modal-backdrop" onClick={onClose} />
      
      {/* Modal */}
      <div className="modal-content w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="glass-card">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-800/50">
            <h2 className="text-xl font-display font-bold text-white">
              {editTrade ? 'Editar Trade' : 'Novo Trade'}
            </h2>
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

            {/* Seletor de Conta Customizado */}
            <div className="mb-6">
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
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <span>{selectedAccount.broker}</span>
                          <span>•</span>
                          <span>
                            {getCurrencySymbol(selectedAccount.currency)}{' '}
                            {(selectedAccount.currentBalance || selectedAccount.initialBalance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
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
                        <p className="text-slate-600 text-xs mt-1">Crie uma conta primeiro</p>
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
                              <div className="flex items-center gap-2 text-sm text-slate-500">
                                <span>{account.broker}</span>
                                <span>•</span>
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

            {/* Grid de campos */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* Data */}
              <div className="input-group">
                <label className="input-label">Data *</label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  className={errors.date ? 'ring-2 ring-red-500/50' : ''}
                />
                {errors.date && <span className="text-xs text-red-400">{errors.date}</span>}
              </div>

              {/* Ticker (MODIFICADO: Com Datalist e Feedback de Regra) */}
              <div className="input-group relative">
                <label className="input-label">Ticker *</label>
                <input
                  type="text"
                  name="ticker"
                  value={formData.ticker}
                  onChange={handleChange}
                  placeholder="Ex: WINFUT, ES, AAPL"
                  className={`uppercase ${errors.ticker ? 'ring-2 ring-red-500/50' : ''}`}
                  list="tickers-list"
                />
                <datalist id="tickers-list">
                  {masterTickers.map(t => (
                    <option key={t.id} value={t.symbol}>{t.name}</option>
                  ))}
                </datalist>

                {/* Feedback Visual da Regra Ativa */}
                {activeAssetRule && (
                   <div className="absolute right-0 top-0 mt-8 mr-3 text-xs text-emerald-400 flex items-center gap-1 pointer-events-none bg-emerald-900/20 px-2 py-0.5 rounded">
                     <CheckCircle className="w-3 h-3"/> 
                     Tick: {activeAssetRule.tickSize} = {selectedAccount ? getCurrencySymbol(selectedAccount.currency) : '$'}{activeAssetRule.tickValue}
                   </div>
                )}

                {errors.ticker && <span className="text-xs text-red-400">{errors.ticker}</span>}
              </div>

              {/* Bolsa */}
              <div className="input-group">
                <label className="input-label">Bolsa</label>
                <select
                  name="exchange"
                  value={formData.exchange}
                  onChange={handleChange}
                >
                  {EXCHANGES.map(ex => (
                    <option key={ex} value={ex}>{ex}</option>
                  ))}
                </select>
              </div>

              {/* Lado */}
              <div className="input-group">
                <label className="input-label">Lado</label>
                <div className="flex gap-2">
                  {SIDES.map(side => (
                    <button
                      key={side}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, side }))}
                      className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
                        formData.side === side
                          ? side === 'LONG'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                            : 'bg-red-500/20 text-red-400 border border-red-500/50'
                          : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-700/50'
                      }`}
                    >
                      {side === 'LONG' ? (
                        <TrendingUp className="w-4 h-4 inline mr-2" />
                      ) : (
                        <TrendingDown className="w-4 h-4 inline mr-2" />
                      )}
                      {side}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preço de Entrada */}
              <div className="input-group">
                <label className="input-label">Preço de Entrada *</label>
                <input
                  type="number"
                  name="entry"
                  value={formData.entry}
                  onChange={handleChange}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className={errors.entry ? 'ring-2 ring-red-500/50' : ''}
                />
                {errors.entry && <span className="text-xs text-red-400">{errors.entry}</span>}
              </div>

              {/* Preço de Saída */}
              <div className="input-group">
                <label className="input-label">Preço de Saída *</label>
                <input
                  type="number"
                  name="exit"
                  value={formData.exit}
                  onChange={handleChange}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className={errors.exit ? 'ring-2 ring-red-500/50' : ''}
                />
                {errors.exit && <span className="text-xs text-red-400">{errors.exit}</span>}
              </div>

              {/* Quantidade */}
              <div className="input-group">
                <label className="input-label">Quantidade *</label>
                <input
                  type="number"
                  name="qty"
                  value={formData.qty}
                  onChange={handleChange}
                  placeholder="100"
                  min="1"
                  className={errors.qty ? 'ring-2 ring-red-500/50' : ''}
                />
                {errors.qty && <span className="text-xs text-red-400">{errors.qty}</span>}
              </div>

              {/* Preview do resultado */}
              <div className="input-group">
                <label className="input-label">Resultado Estimado</label>
                <div className={`py-3 px-4 rounded-xl border font-semibold text-center ${
                  previewResult === null
                    ? 'bg-slate-800/50 border-slate-700/50 text-slate-500'
                    : previewResult >= 0
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-red-500/10 border-red-500/30 text-red-400'
                }`}>
                  {previewResult !== null
                    ? `${previewResult >= 0 ? '+' : ''}${selectedAccount ? getCurrencySymbol(selectedAccount.currency) : 'R$'} ${previewResult.toFixed(2)}`
                    : 'Preencha os valores'
                  }
                </div>
              </div>

              {/* Setup */}
              <div className="input-group">
                <label className="input-label">Setup</label>
                <select
                  name="setup"
                  value={formData.setup}
                  onChange={handleChange}
                >
                  {SETUPS.map(setup => (
                    <option key={setup} value={setup}>{setup}</option>
                  ))}
                </select>
              </div>

              {/* Estado Emocional */}
              <div className="input-group">
                <label className="input-label">Estado Emocional</label>
                <select
                  name="emotion"
                  value={formData.emotion}
                  onChange={handleChange}
                >
                  {EMOTIONS.map(emotion => (
                    <option key={emotion} value={emotion}>{emotion}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Observações */}
            <div className="input-group mb-6">
              <label className="input-label">Observações</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Descreva o racional da operação, o que funcionou ou não..."
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Upload de Imagens */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* HTF */}
              <div className="input-group">
                <label className="input-label flex items-center gap-2">
                  <Image className="w-4 h-4" />
                  Gráfico HTF (Higher Time Frame) *
                </label>
                
                {htfPreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-slate-700/50">
                    <img 
                      src={htfPreview} 
                      alt="HTF Preview" 
                      className="w-full h-40 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage('htf')}
                      className="absolute top-2 right-2 p-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className={`flex flex-col items-center justify-center h-40 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                    errors.htf 
                      ? 'border-red-500/50 bg-red-500/5' 
                      : 'border-slate-700/50 hover:border-blue-500/50 hover:bg-blue-500/5'
                  }`}>
                    <Upload className="w-8 h-8 text-slate-500 mb-2" />
                    <span className="text-sm text-slate-500">Clique para upload</span>
                    <span className="text-xs text-slate-600 mt-1">JPG, PNG até 5MB</span>
                    <input
                      ref={htfInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/jpg,image/webp"
                      onChange={(e) => handleFileChange(e, 'htf')}
                      className="hidden"
                    />
                  </label>
                )}
                {errors.htf && <span className="text-xs text-red-400">{errors.htf}</span>}
              </div>

              {/* LTF */}
              <div className="input-group">
                <label className="input-label flex items-center gap-2">
                  <Image className="w-4 h-4" />
                  Gráfico LTF (Lower Time Frame) *
                </label>
                
                {ltfPreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-slate-700/50">
                    <img 
                      src={ltfPreview} 
                      alt="LTF Preview" 
                      className="w-full h-40 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage('ltf')}
                      className="absolute top-2 right-2 p-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className={`flex flex-col items-center justify-center h-40 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                    errors.ltf 
                      ? 'border-red-500/50 bg-red-500/5' 
                      : 'border-slate-700/50 hover:border-blue-500/50 hover:bg-blue-500/5'
                  }`}>
                    <Upload className="w-8 h-8 text-slate-500 mb-2" />
                    <span className="text-sm text-slate-500">Clique para upload</span>
                    <span className="text-xs text-slate-600 mt-1">JPG, PNG até 5MB</span>
                    <input
                      ref={ltfInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/jpg,image/webp"
                      onChange={(e) => handleFileChange(e, 'ltf')}
                      className="hidden"
                    />
                  </label>
                )}
                {errors.ltf && <span className="text-xs text-red-400">{errors.ltf}</span>}
              </div>
            </div>

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
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Salvando...
                  </>
                ) : editTrade ? (
                  'Salvar Alterações'
                ) : (
                  'Registrar Trade'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default AddTradeModal;