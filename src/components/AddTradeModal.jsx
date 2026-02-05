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
import { useAccounts } from '../hooks/useAccounts';
import { useMasterData } from '../hooks/useMasterData';

// Sides são fixos (não vem do Firestore)
const SIDES = ['LONG', 'SHORT'];

/**
 * AddTradeModal (Fixed Layout Version)
 * Usa useMasterData para buscar setups, emotions, exchanges do Firestore
 */
const AddTradeModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  editTrade = null,
  loading = false 
}) => {
  const { accounts, loading: accountsLoading } = useAccounts();
  const { 
    setups, 
    emotions, 
    exchanges, 
    tickers: masterTickers,
    loading: masterLoading 
  } = useMasterData(); 
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    ticker: '',
    exchange: '',
    side: 'LONG',
    entry: '',
    exit: '',
    qty: '',
    setup: '',
    emotion: '',
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
  const [activeAssetRule, setActiveAssetRule] = useState(null);

  const htfInputRef = useRef(null);
  const ltfInputRef = useRef(null);
  const accountDropdownRef = useRef(null);

  // --- EFEITOS (Lógica de Negócio) ---

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

  // Inicialização - definir defaults quando dados carregam
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
      // Defaults baseados nos dados do Firestore
      const defaultExchange = exchanges.length > 0 ? exchanges[0].code : 'B3';
      const defaultSetup = setups.length > 0 ? setups[0].name : '';
      const defaultEmotion = emotions.length > 0 ? emotions.find(e => e.category === 'neutral')?.name || emotions[0].name : '';
      
      setFormData(prev => ({
        date: new Date().toISOString().split('T')[0],
        ticker: '',
        exchange: defaultExchange,
        side: 'LONG',
        entry: '',
        exit: '',
        qty: '',
        setup: defaultSetup,
        emotion: defaultEmotion,
        notes: '',
        accountId: prev.accountId && accounts.find(acc => acc.id === prev.accountId) 
          ? prev.accountId 
          : (accounts.find(acc => acc.active)?.id || accounts[0]?.id || ''),
      }));
      setHtfFile(null);
      setLtfFile(null);
      setHtfPreview(null);
      setLtfPreview(null);
      setActiveAssetRule(null);
    }
    setErrors({});
  }, [editTrade, isOpen, accounts, exchanges, setups, emotions]); 

  // Regra de Ativo (WINFUT vs Ações)
  useEffect(() => {
    if (!formData.ticker) {
      setActiveAssetRule(null);
      return;
    }
    const userInput = formData.ticker.toUpperCase();
    const tickers = masterTickers || [];
    const rule = tickers.find(t => t.symbol === userInput) || 
                 tickers.find(t => userInput.startsWith(t.symbol));

    if (rule) {
      setActiveAssetRule(rule);
      if (rule.exchange) setFormData(prev => ({ ...prev, exchange: rule.exchange }));
    } else {
      setActiveAssetRule(null);
    }
  }, [formData.ticker, masterTickers]);

  // Cálculo de P&L
  useEffect(() => {
    const { entry, exit, qty, side } = formData;
    if (entry && exit && qty) {
      const entryNum = parseFloat(entry);
      const exitNum = parseFloat(exit);
      const qtyNum = parseFloat(qty);
      
      if (!isNaN(entryNum) && !isNaN(exitNum) && !isNaN(qtyNum)) {
        let rawDiff = side === 'LONG' ? exitNum - entryNum : entryNum - exitNum;
        let result;
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

  // --- HANDLERS ---

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
  };

  const handleAccountSelect = (accountId) => {
    setFormData(prev => ({ ...prev, accountId }));
    setShowAccountDropdown(false);
    if (errors.accountId) setErrors(prev => ({ ...prev, accountId: null }));
  };

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/jpg', 'image/webp'].includes(file.type)) {
      setErrors(prev => ({ ...prev, [type]: 'Apenas imagens JPG, PNG ou WebP' }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, [type]: 'Imagem muito grande (máximo 5MB)' }));
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      if (type === 'htf') { setHtfFile(file); setHtfPreview(reader.result); } 
      else { setLtfFile(file); setLtfPreview(reader.result); }
    };
    reader.readAsDataURL(file);
    setErrors(prev => ({ ...prev, [type]: null }));
  };

  const removeImage = (type) => {
    if (type === 'htf') { setHtfFile(null); setHtfPreview(null); if (htfInputRef.current) htfInputRef.current.value = ''; } 
    else { setLtfFile(null); setLtfPreview(null); if (ltfInputRef.current) ltfInputRef.current.value = ''; }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.date) newErrors.date = 'Data é obrigatória';
    if (!formData.ticker.trim()) newErrors.ticker = 'Ticker é obrigatório';
    if (!formData.entry || isNaN(parseFloat(formData.entry))) newErrors.entry = 'Preço inválido';
    if (!formData.exit || isNaN(parseFloat(formData.exit))) newErrors.exit = 'Preço inválido';
    if (!formData.accountId) newErrors.accountId = 'Selecione uma conta';
    if (!formData.setup) newErrors.setup = 'Selecione um setup';

    const qtyNum = parseFloat(formData.qty);
    if (!formData.qty || isNaN(qtyNum) || qtyNum <= 0) {
      newErrors.qty = 'Quantidade inválida';
    } else if (activeAssetRule) {
      const minLot = activeAssetRule.minLot || activeAssetRule.contractSize || 1;
      if (qtyNum % minLot !== 0) {
        newErrors.qty = `Quantidade deve ser múltipla de ${minLot}`;
      }
    }

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
    const payload = { ...formData, result: previewResult };
    try {
      await onSubmit(payload, htfFile, ltfFile);
      onClose();
    } catch (err) {
      setErrors({ submit: err.message });
    }
  };

  // UI Helpers
  const selectedAccount = accounts.find(acc => acc.id === formData.accountId);
  const getCurrencySymbol = (currency) => currency === 'USD' ? '$' : currency === 'EUR' ? '€' : 'R$';

  if (!isOpen) return null;

  // Loading state
  if (masterLoading || accountsLoading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 flex items-center gap-4">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          <span className="text-white">Carregando...</span>
        </div>
      </div>
    );
  }

  // Se não tem contas, mostrar mensagem
  if (accounts.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white mb-2">Nenhuma conta encontrada</h3>
          <p className="text-slate-400 mb-4">Você precisa criar uma conta antes de registrar trades.</p>
          <button onClick={onClose} className="btn-primary">Fechar</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        {/* Container Principal: Flex Column para forçar Footer no final */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
          
          {/* 1. HEADER (Fixo) */}
          <div className="flex items-center justify-between p-6 border-b border-slate-800 flex-none bg-slate-900 z-10">
            <h2 className="text-xl font-display font-bold text-white">
              {editTrade ? 'Editar Trade' : 'Novo Trade'}
            </h2>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 2. BODY (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
            
            {/* O form envolve apenas os inputs, mas é conectado ao botão via ID */}
            <form id="trade-form" onSubmit={handleSubmit} className="space-y-6">
              
              {errors.submit && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 text-red-400 text-sm">
                  <AlertCircle className="w-5 h-5" /> {errors.submit}
                </div>
              )}

              {/* SELEÇÃO DE CONTA */}
              <div className="relative" ref={accountDropdownRef}>
                <label className="text-xs text-slate-500 mb-1.5 block font-medium">Conta *</label>
                <button
                  type="button"
                  onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                    errors.accountId ? 'border-red-500/50 bg-red-500/5' : 'border-slate-700/50 bg-slate-800/50'
                  }`}
                >
                  {selectedAccount ? (
                    <span className="text-white font-medium flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-slate-400"/> {selectedAccount.name}
                    </span>
                  ) : <span className="text-slate-500">Selecione...</span>}
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>
                
                {showAccountDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                    {accounts.map(acc => (
                      <button key={acc.id} type="button" onClick={() => handleAccountSelect(acc.id)} className="w-full text-left px-4 py-3 hover:bg-slate-700 text-sm text-white border-b border-slate-700/50 last:border-0">
                        {acc.name} <span className="text-xs text-slate-500 ml-2">({acc.broker || acc.brokerName})</span>
                      </button>
                    ))}
                  </div>
                )}
                {errors.accountId && <span className="text-xs text-red-400 block mt-1">{errors.accountId}</span>}
              </div>

              {/* INPUTS GRID */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Data *</label>
                  <input type="date" name="date" value={formData.date} onChange={handleChange} className="input-dark w-full" />
                </div>

                <div className="relative">
                  <label className="input-label">Ticker *</label>
                  <input 
                    type="text" name="ticker" value={formData.ticker} onChange={handleChange} 
                    className={`input-dark w-full uppercase ${errors.ticker ? 'border-red-500' : ''}`}
                    placeholder="WINFUT" list="tickers-list" autoComplete="off"
                  />
                  <datalist id="tickers-list">
                    {(masterTickers || []).map(t => <option key={t.id} value={t.symbol}>{t.name}</option>)}
                  </datalist>
                  {activeAssetRule && (
                    <div className="absolute right-0 top-0 mt-8 mr-2 text-[10px] text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-500/20">
                      Lote Mín: {activeAssetRule.minLot || 1}
                    </div>
                  )}
                  {errors.ticker && <span className="text-xs text-red-400 block mt-1">{errors.ticker}</span>}
                </div>

                <div>
                  <label className="input-label">Bolsa</label>
                  <select name="exchange" value={formData.exchange} onChange={handleChange} className="input-dark w-full">
                    {exchanges.map(ex => <option key={ex.id} value={ex.code}>{ex.code} - {ex.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="input-label">Lado</label>
                  <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                    {SIDES.map(side => (
                      <button
                        key={side} type="button"
                        onClick={() => setFormData(prev => ({ ...prev, side }))}
                        className={`flex-1 py-2 text-xs font-medium rounded transition-all ${
                          formData.side === side
                            ? side === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {side}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="input-label">Entrada *</label>
                  <input type="number" name="entry" step="any" value={formData.entry} onChange={handleChange} className={`input-dark w-full ${errors.entry ? 'border-red-500' : ''}`} placeholder="0.00" />
                  {errors.entry && <span className="text-xs text-red-400 block mt-1">{errors.entry}</span>}
                </div>

                <div>
                  <label className="input-label">Saída *</label>
                  <input type="number" name="exit" step="any" value={formData.exit} onChange={handleChange} className={`input-dark w-full ${errors.exit ? 'border-red-500' : ''}`} placeholder="0.00" />
                  {errors.exit && <span className="text-xs text-red-400 block mt-1">{errors.exit}</span>}
                </div>

                <div>
                  <label className="input-label">Quantidade *</label>
                  <input 
                    type="number" name="qty" value={formData.qty} onChange={handleChange} 
                    className={`input-dark w-full ${errors.qty ? 'border-red-500' : ''}`}
                    step={activeAssetRule ? (activeAssetRule.minLot || 1) : 1}
                  />
                  {errors.qty && <span className="text-xs text-red-400 block mt-1">{errors.qty}</span>}
                </div>

                <div>
                  <label className="input-label">Resultado (Est.)</label>
                  <div className={`input-dark w-full flex items-center justify-center font-mono font-bold ${
                    previewResult >= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'
                  }`}>
                    {previewResult !== null 
                      ? `${previewResult >= 0 ? '+' : ''}${selectedAccount ? getCurrencySymbol(selectedAccount.currency) : 'R$'} ${previewResult.toFixed(2)}` 
                      : '---'}
                  </div>
                </div>

                <div>
                  <label className="input-label">Setup *</label>
                  <select name="setup" value={formData.setup} onChange={handleChange} className={`input-dark w-full ${errors.setup ? 'border-red-500' : ''}`}>
                    <option value="">Selecione...</option>
                    {setups.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                  {errors.setup && <span className="text-xs text-red-400 block mt-1">{errors.setup}</span>}
                </div>

                <div>
                  <label className="input-label">Emoção</label>
                  <select name="emotion" value={formData.emotion} onChange={handleChange} className="input-dark w-full">
                    <option value="">Selecione...</option>
                    {emotions.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="input-label">Observações</label>
                <textarea name="notes" rows="2" value={formData.notes} onChange={handleChange} className="input-dark w-full resize-none" placeholder="Racional do trade..." />
              </div>

              {/* Imagens */}
              <div className="grid grid-cols-2 gap-4">
                 {['htf', 'ltf'].map(type => (
                   <div key={type}>
                     <label className="input-label mb-2 uppercase">{type} Image *</label>
                     {(type === 'htf' ? htfPreview : ltfPreview) ? (
                       <div className="relative group h-24 rounded-lg overflow-hidden border border-slate-700">
                         <img src={type === 'htf' ? htfPreview : ltfPreview} className="w-full h-full object-cover" alt={type} />
                         <button type="button" onClick={() => removeImage(type)} className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"><X/></button>
                       </div>
                     ) : (
                       <label className={`flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-slate-800 ${errors[type] ? 'border-red-500/50 bg-red-500/5' : 'border-slate-700'}`}>
                         <Upload className="w-5 h-5 text-slate-500" />
                         <span className="text-[10px] text-slate-500 mt-1">Upload</span>
                         <input ref={type === 'htf' ? htfInputRef : ltfInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, type)} />
                       </label>
                     )}
                     {errors[type] && <span className="text-[10px] text-red-400 block mt-1">{errors[type]}</span>}
                   </div>
                 ))}
              </div>
            </form>
          </div>

          {/* 3. FOOTER (Fixo e Visível) */}
          <div className="flex-none p-4 border-t border-slate-800 bg-slate-900 flex justify-end gap-3 z-20 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="trade-form"
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg shadow-blue-900/20 disabled:opacity-50 transition-all flex items-center"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editTrade ? 'Salvar Alterações' : 'Registrar Trade'}
            </button>
          </div>

        </div>
      </div>

      <style>{`
        .input-label { display: block; font-size: 0.75rem; color: rgb(148 163 184); margin-bottom: 0.25rem; font-weight: 500; }
        .input-dark { background: rgb(15 23 42); border: 1px solid rgb(51 65 85); padding: 0.5rem; border-radius: 0.5rem; color: white; outline: none; transition: border-color 0.2s; font-size: 0.875rem; }
        .input-dark:focus { border-color: rgb(37 99 235); }
      `}</style>
    </>
  );
};

export default AddTradeModal;
