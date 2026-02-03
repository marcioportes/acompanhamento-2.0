import { useState, useEffect, useRef } from 'react';
import { 
  X, Upload, Image, Loader2, AlertCircle, 
  TrendingUp, TrendingDown, Wallet, ChevronDown, CheckCircle 
} from 'lucide-react';
import { SETUPS, EMOTIONS, EXCHANGES, SIDES } from '../firebase';
import { useAccounts } from '../hooks/useAccounts';
import { useMasterData } from '../hooks/useMasterData';

/**
 * Modal de Criação e Edição de Trades.
 * * @component
 * @param {boolean} isOpen - Controla a visibilidade do modal.
 * @param {function} onClose - Função para fechar o modal.
 * @param {function} onSubmit - Função assíncrona que recebe o payload e os arquivos de imagem.
 * @param {object} [editTrade] - Objeto do trade se estiver em modo de edição (null se novo).
 * @param {boolean} loading - Estado de carregamento do processo de salvamento.
 */
const AddTradeModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  editTrade = null,
  loading = false 
}) => {
  // --- HOOKS E CONTEXTOS ---
  const { accounts } = useAccounts(); // Dados das contas para o dropdown
  const { tickers: masterTickers } = useMasterData(); // Master Data para validação de regras
  
  // --- ESTADO LOCAL ---
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
  
  // Estados de Imagem e Preview
  const [htfFile, setHtfFile] = useState(null);
  const [ltfFile, setLtfFile] = useState(null);
  const [htfPreview, setHtfPreview] = useState(null);
  const [ltfPreview, setLtfPreview] = useState(null);
  
  // Estados de Controle de UI
  const [errors, setErrors] = useState({});
  const [previewResult, setPreviewResult] = useState(null);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  
  /** * @type {object|null} activeAssetRule
   * Armazena a regra de negócio do ativo identificado (ex: minLot, tickSize).
   * Essencial para validação de integridade.
   */
  const [activeAssetRule, setActiveAssetRule] = useState(null);

  // Refs para manipulação direta do DOM (limpeza de inputs de arquivo)
  const htfInputRef = useRef(null);
  const ltfInputRef = useRef(null);
  const accountDropdownRef = useRef(null);

  // --- EFEITOS COLATERAIS (Side Effects) ---

  /**
   * Effect: Click Outside Listener
   * Fecha o dropdown de contas se o usuário clicar fora dele.
   */
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(event.target)) {
        setShowAccountDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * Effect: Inicialização e Reset
   * Popula o formulário se for edição ou reseta se for novo trade.
   * Garante integridade ao abrir o modal.
   */
  useEffect(() => {
    if (!isOpen) return;
    
    if (editTrade) {
      // Modo Edição: Popula com dados existentes
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
      // Novo Trade: Reseta e tenta selecionar conta ativa padrão
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
        // Tenta manter conta selecionada anteriormente ou pega a primeira ativa
        accountId: prev.accountId && accounts.find(acc => acc.id === prev.accountId) 
          ? prev.accountId 
          : (accounts.find(acc => acc.active)?.id || ''),
      }));
      // Limpeza de imagens
      setHtfFile(null);
      setLtfFile(null);
      setHtfPreview(null);
      setLtfPreview(null);
      setActiveAssetRule(null);
    }
    setErrors({});
  }, [editTrade, isOpen, accounts]); // Adicionado accounts para garantir sincronia

  /**
   * Effect: Detecção de Regra de Ativo (Engine de Validação)
   * Monitora o input de Ticker e busca correspondência no Master Data.
   */
  useEffect(() => {
    if (!formData.ticker) {
      setActiveAssetRule(null);
      return;
    }

    const userInput = formData.ticker.toUpperCase();
    
    // Busca exata ou por prefixo (ex: WINFUT busca WIN)
    const rule = masterTickers.find(t => t.symbol === userInput) || 
                 masterTickers.find(t => userInput.startsWith(t.symbol));

    if (rule) {
      setActiveAssetRule(rule);
      // Aplica a bolsa do ativo automaticamente se disponível
      if (rule.exchange) {
        setFormData(prev => ({ ...prev, exchange: rule.exchange }));
      }
      // Limpa erro de ticker se o usuário corrigiu
      if (errors.ticker) setErrors(prev => ({...prev, ticker: null}));
    } else {
      setActiveAssetRule(null);
    }
  }, [formData.ticker, masterTickers]);

  /**
   * Effect: Cálculo de P&L Estimado (Preview Result)
   * Calcula o resultado financeiro em tempo real baseado no input.
   * Suporta lógica de Ticks (Futuros) e Lógica Simples (Ações/Cripto).
   */
  useEffect(() => {
    const { entry, exit, qty, side } = formData;
    
    // Guard Clause: Só calcula se tiver todos os números
    if (entry && exit && qty) {
      const entryNum = parseFloat(entry);
      const exitNum = parseFloat(exit);
      const qtyNum = parseFloat(qty);
      
      if (!isNaN(entryNum) && !isNaN(exitNum) && !isNaN(qtyNum)) {
        let rawDiff = side === 'LONG' ? exitNum - entryNum : entryNum - exitNum;
        let result;

        // REGRA DE NEGÓCIO: Cálculo por Tick vs Cálculo Linear
        if (activeAssetRule && activeAssetRule.tickSize && activeAssetRule.tickValue) {
           // Ex: (100 pts / 5 pts) * R$ 1,00 * 1 ctr = R$ 20,00
           const ticks = rawDiff / activeAssetRule.tickSize;
           result = ticks * activeAssetRule.tickValue * qtyNum;
        } else {
           // Ex: (R$ 10,50 - R$ 10,00) * 100 ações = R$ 50,00
           result = rawDiff * qtyNum;
        }
        setPreviewResult(result);
      }
    } else {
      setPreviewResult(null);
    }
  }, [formData.entry, formData.exit, formData.qty, formData.side, activeAssetRule]);

  // --- HANDLERS (Manipuladores de Eventos) ---

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

    // Validação de Tipo
    if (!['image/jpeg', 'image/png', 'image/jpg', 'image/webp'].includes(file.type)) {
      setErrors(prev => ({ ...prev, [type]: 'Formato inválido. Use JPG, PNG ou WebP.' }));
      return;
    }
    // Validação de Tamanho (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, [type]: 'Imagem muito grande (máximo 5MB).' }));
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

  // --- VALIDAÇÃO DE DADOS (Core Logic) ---

  const validate = () => {
    const newErrors = {};
    
    // Campos Obrigatórios Básicos
    if (!formData.date) newErrors.date = 'Data é obrigatória';
    if (!formData.ticker.trim()) newErrors.ticker = 'Ticker é obrigatório';
    if (!formData.entry || isNaN(parseFloat(formData.entry))) newErrors.entry = 'Preço inválido';
    if (!formData.exit || isNaN(parseFloat(formData.exit))) newErrors.exit = 'Preço inválido';
    if (!formData.accountId) newErrors.accountId = 'Selecione uma conta';

    // VALIDAÇÃO DE LOTE (Correção Solicitada)
    const qtyNum = parseFloat(formData.qty);
    if (!formData.qty || isNaN(qtyNum) || qtyNum <= 0) {
      newErrors.qty = 'Quantidade inválida';
    } else if (activeAssetRule) {
      // Normaliza minLot ou contractSize (Legacy Support)
      const minLot = activeAssetRule.minLot || activeAssetRule.contractSize || 1;
      
      // Verifica resto da divisão para garantir multiplicidade
      if (qtyNum % minLot !== 0) {
        newErrors.qty = `Quantidade inválida. Deve ser múltiplo de ${minLot} para este ativo.`;
      }
    }

    // Imagens obrigatórias apenas na criação
    if (!editTrade) {
      if (!htfFile && !htfPreview) newErrors.htf = 'Imagem HTF é obrigatória';
      if (!ltfFile && !ltfPreview) newErrors.ltf = 'Imagem LTF é obrigatória';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Bloqueia envio se validação falhar
    if (!validate()) return; 

    // Payload final com resultado calculado
    const payload = { ...formData, result: previewResult };

    try {
      await onSubmit(payload, htfFile, ltfFile);
      onClose();
    } catch (err) {
      setErrors({ submit: err.message });
    }
  };

  // --- HELPERS DE RENDERIZAÇÃO ---
  const selectedAccount = accounts.find(acc => acc.id === formData.accountId);
  const getCurrencySymbol = (acc) => {
    if (!acc) return 'R$';
    switch (acc.currency) {
      case 'USD': return '$';
      case 'EUR': return '€';
      default: return 'R$';
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="glass-card flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-800/50 flex-shrink-0">
            <h2 className="text-xl font-display font-bold text-white">
              {editTrade ? 'Editar Trade' : 'Novo Trade'}
            </h2>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Scrollable */}
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1">
            {errors.submit && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <p className="text-sm text-red-400">{errors.submit}</p>
              </div>
            )}

            {/* Account Selector (Custom Dropdown) */}
            <div className="mb-6 relative" ref={accountDropdownRef}>
              <label className="input-label">Conta *</label>
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
                ) : <span className="text-slate-500">Selecione uma conta...</span>}
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>
              
              {showAccountDropdown && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                  {accounts.map(acc => (
                    <button key={acc.id} type="button" onClick={() => handleAccountSelect(acc.id)} className="w-full text-left px-4 py-3 hover:bg-slate-700 text-sm text-white border-b border-slate-700/50 last:border-0">
                      {acc.name} <span className="text-xs text-slate-500 ml-2">({acc.broker})</span>
                    </button>
                  ))}
                </div>
              )}
              {errors.accountId && <span className="text-xs text-red-400 mt-1">{errors.accountId}</span>}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* Date Input */}
              <div className="input-group">
                <label className="input-label">Data</label>
                <input type="date" name="date" value={formData.date} onChange={handleChange} />
              </div>

              {/* Ticker Input com Datalist e Validação Visual */}
              <div className="input-group relative">
                <label className="input-label">Ticker *</label>
                <input 
                  type="text" name="ticker" value={formData.ticker} onChange={handleChange} 
                  className={`uppercase ${errors.ticker ? 'ring-2 ring-red-500/50' : ''}`}
                  placeholder="PETR4, WIN..." list="tickers-list" autoComplete="off"
                />
                <datalist id="tickers-list">
                  {masterTickers.map(t => <option key={t.id} value={t.symbol}>{t.name}</option>)}
                </datalist>

                {/* Badge de Regra Ativa (Feedback UX) */}
                {activeAssetRule && (
                  <div className="absolute right-0 top-0 mt-8 mr-2 text-[10px] text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-500/20 pointer-events-none">
                    Lote Mín: {activeAssetRule.minLot || activeAssetRule.contractSize || 1}
                  </div>
                )}
                {errors.ticker && <span className="text-xs text-red-400">{errors.ticker}</span>}
              </div>

              <div className="input-group">
                <label className="input-label">Bolsa</label>
                <select name="exchange" value={formData.exchange} onChange={handleChange}>
                  {EXCHANGES.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">Lado</label>
                <div className="flex bg-slate-800/50 rounded-xl p-1 border border-slate-700/50">
                  {SIDES.map(side => (
                    <button
                      key={side} type="button"
                      onClick={() => setFormData(prev => ({ ...prev, side }))}
                      className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
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

              <div className="input-group">
                <label className="input-label">Entrada</label>
                <input type="number" name="entry" value={formData.entry} onChange={handleChange} placeholder="0.00" step="any" />
              </div>

              <div className="input-group">
                <label className="input-label">Saída</label>
                <input type="number" name="exit" value={formData.exit} onChange={handleChange} placeholder="0.00" step="any" />
              </div>

              {/* Input de Quantidade com Step Inteligente */}
              <div className="input-group">
                <label className="input-label">Quantidade *</label>
                <input 
                  type="number" name="qty" value={formData.qty} onChange={handleChange} 
                  placeholder={activeAssetRule ? `Múltiplos de ${activeAssetRule.minLot || 1}` : "100"}
                  // UI UX: Step inteligente baseado no lote
                  step={activeAssetRule ? (activeAssetRule.minLot || activeAssetRule.contractSize || 1) : 1}
                  className={errors.qty ? 'ring-2 ring-red-500/50 border-red-500' : ''}
                />
                {errors.qty && <span className="text-xs text-red-400 mt-1 block">{errors.qty}</span>}
              </div>

              <div className="input-group">
                <label className="input-label">Resultado Estimado</label>
                <div className={`py-3 px-4 rounded-xl border font-mono font-bold text-center ${
                  previewResult === null ? 'bg-slate-800/50 border-slate-700/50 text-slate-500'
                  : previewResult >= 0 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
                }`}>
                  {previewResult !== null 
                    ? `${previewResult >= 0 ? '+' : ''}${getCurrencySymbol(selectedAccount)} ${previewResult.toFixed(2)}` 
                    : '---'}
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Setup</label>
                <select name="setup" value={formData.setup} onChange={handleChange}>
                  {SETUPS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">Emoção</label>
                <select name="emotion" value={formData.emotion} onChange={handleChange}>
                  {EMOTIONS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            </div>

            {/* Seção de Imagens (HTF/LTF) */}
            <div className="grid grid-cols-2 gap-4 mt-6">
               {['htf', 'ltf'].map(type => (
                 <div key={type} className="input-group">
                   <label className="input-label text-xs uppercase text-slate-500 mb-2 block">{type} Image *</label>
                   {(type === 'htf' ? htfPreview : ltfPreview) ? (
                     <div className="relative group rounded-xl overflow-hidden border border-slate-700 h-32">
                       <img src={type === 'htf' ? htfPreview : ltfPreview} className="w-full h-full object-cover" />
                       <button type="button" onClick={() => removeImage(type)} className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                         <X />
                       </button>
                     </div>
                   ) : (
                     <label className={`flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-xl cursor-pointer hover:bg-slate-800/50 transition-colors ${errors[type] ? 'border-red-500/50 bg-red-500/5' : 'border-slate-700'}`}>
                       <Upload className="w-6 h-6 text-slate-500 mb-2" />
                       <span className="text-xs text-slate-500">Upload {type.toUpperCase()}</span>
                       <input ref={type === 'htf' ? htfInputRef : ltfInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, type)} />
                     </label>
                   )}
                   {errors[type] && <span className="text-xs text-red-400 mt-1">{errors[type]}</span>}
                 </div>
               ))}
            </div>

            {/* Footer com Ações */}
            <div className="flex items-center justify-end gap-3 pt-6 mt-6 border-t border-slate-800/50">
              <button type="button" onClick={onClose} className="btn-secondary" disabled={loading}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editTrade ? 'Salvar Alterações' : 'Registrar Trade'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default AddTradeModal;