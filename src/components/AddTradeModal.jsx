import { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Upload, 
  Loader2, 
  AlertCircle,
  Wallet,
  ChevronDown,
  ArrowRight,
  Calendar as CalendarIcon,
  Clock as ClockIcon,
  Plus,
  Trash2,
  Layers
} from 'lucide-react';
import { useAccounts } from '../hooks/useAccounts';
import { useMasterData } from '../hooks/useMasterData';
import { calculateFromPartials } from '../utils/tradeCalculations';

const SIDES = ['LONG', 'SHORT'];

/**
 * AddTradeModal
 * @see version.js para versão do produto
 * @description Modal de criação/edição de trade com suporte a parciais
 * 
 * CHANGELOG (produto):
 * - 1.6.0: Modo Parciais — toggle Simples/Parciais com grid editável
 * - 1.5.0: Plan-centric ledger (sem mudança no modal)
 * - 1.4.0: Brasil Pro Format - máscaras DD/MM/AAAA e HH:MM
 */
const AddTradeModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  editTrade = null,
  loading = false,
  plans = []
}) => {
  const { accounts, loading: accountsLoading } = useAccounts();
  const { 
    setups, 
    emotions, 
    exchanges, 
    tickers: masterTickers,
    loading: masterLoading 
  } = useMasterData(); 

  // --- ESTADOS ---
  // formData armazena os dados puros (ISO) para envio ao Backend
  const [formData, setFormData] = useState({
    entryDate: new Date().toISOString().split('T')[0],
    entryTime: '',
    exitDate: new Date().toISOString().split('T')[0],
    exitTime: '',
    ticker: '',
    exchange: '',
    side: 'LONG',
    entry: '',
    exit: '',
    qty: '',
    setup: '',
    emotionEntry: '',
    emotionExit: '',
    notes: '',
    planId: '',
  });

  // maskedInputs armazena o que o usuário VÊ (Formato BR)
  const [maskedInputs, setMaskedInputs] = useState({
    entryDate: '', // DD/MM/AAAA
    entryTime: '', // HH:MM
    exitDate: '',
    exitTime: ''
  });
  
  const [htfFile, setHtfFile] = useState(null);
  const [ltfFile, setLtfFile] = useState(null);
  const [htfPreview, setHtfPreview] = useState(null);
  const [ltfPreview, setLtfPreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [previewResult, setPreviewResult] = useState(null);
  const [durationPreview, setDurationPreview] = useState(null);
  const [showPlanDropdown, setShowPlanDropdown] = useState(false);
  const [activeAssetRule, setActiveAssetRule] = useState(null);

  // --- SISTEMA DE PARCIAIS (SEMPRE ATIVO) ---
  const [partials, setPartials] = useState([]);
  const [resultOverride, setResultOverride] = useState(null); // null = usar calculado

  // Refs para inputs ocultos e uploads
  const htfInputRef = useRef(null);
  const ltfInputRef = useRef(null);
  const planDropdownRef = useRef(null);
  
  // Refs para os Pickers Nativos Ocultos
  const entryDatePickerRef = useRef(null);
  const entryTimePickerRef = useRef(null);
  const exitDatePickerRef = useRef(null);
  const exitTimePickerRef = useRef(null);

  // --- HELPERS DE FORMATAÇÃO ---
  
  // ISO (YYYY-MM-DD) -> BR (DD/MM/AAAA)
  const isoToBr = (isoDate) => {
    if (!isoDate) return '';
    const [y, m, d] = isoDate.split('-');
    return `${d}/${m}/${y}`;
  };

  // BR (DD/MM/AAAA) -> ISO (YYYY-MM-DD)
  const brToIso = (brDate) => {
    if (!brDate || brDate.length !== 10) return '';
    const [d, m, y] = brDate.split('/');
    return `${y}-${m}-${d}`;
  };

  // Máscara de Data (DD/MM/AAAA)
  const maskDate = (value) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '$1/$2')
      .replace(/(\d{2})(\d)/, '$1/$2')
      .replace(/(\d{4})\d+?$/, '$1');
  };

  // Máscara de Hora (HH:MM)
  const maskTime = (value) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '$1:$2')
      .replace(/(\d{2})\d+?$/, '$1');
  };

  // --- EFEITOS ---

  // Inicialização: Carrega dados e preenche as máscaras visuais
  useEffect(() => {
    if (!isOpen) return;
    
    if (editTrade) {
      // Extração de dados existentes
      const eDate = editTrade.entryTime ? editTrade.entryTime.split('T')[0] : editTrade.date;
      const eTime = editTrade.entryTime ? editTrade.entryTime.split('T')[1]?.substring(0,5) : '09:00';
      const xDate = editTrade.exitTime ? editTrade.exitTime.split('T')[0] : eDate;
      const xTime = editTrade.exitTime ? editTrade.exitTime.split('T')[1]?.substring(0,5) : '';

      setFormData({
        entryDate: eDate, entryTime: eTime,
        exitDate: xDate, exitTime: xTime,
        ticker: editTrade.ticker, exchange: editTrade.exchange, side: editTrade.side,
        entry: editTrade.entry.toString(), exit: editTrade.exit.toString(), qty: editTrade.qty.toString(),
        setup: editTrade.setup,
        emotionEntry: editTrade.emotionEntry || editTrade.emotion || '',
        emotionExit: editTrade.emotionExit || editTrade.emotion || '',
        notes: editTrade.notes || '',
        planId: editTrade.planId || '',
      });
      
      // Sincroniza visual
      setMaskedInputs({
        entryDate: isoToBr(eDate),
        entryTime: eTime,
        exitDate: isoToBr(xDate),
        exitTime: xTime
      });

      if (editTrade.htfUrl) setHtfPreview(editTrade.htfUrl);
      if (editTrade.ltfUrl) setLtfPreview(editTrade.ltfUrl);
      
      // Parciais: carregar existentes ou criar a partir de entry/exit
      if (editTrade._partials && editTrade._partials.length > 0) {
        setPartials(editTrade._partials);
      } else {
        // Retrocompat: trade simples → converter para parciais
        setPartials([
          { type: 'ENTRY', price: editTrade.entry?.toString() || '', qty: editTrade.qty?.toString() || '', dateTime: editTrade.entryTime || '', seq: 1 },
          { type: 'EXIT', price: editTrade.exit?.toString() || '', qty: editTrade.qty?.toString() || '', dateTime: editTrade.exitTime || '', seq: 2 }
        ]);
      }
      // Resultado editado?
      setResultOverride(editTrade.resultEdited ? editTrade.result?.toString() : null);
    } else {
      // Novo Trade
      const now = new Date();
      const todayIso = now.toISOString().split('T')[0];
      const currentHour = String(now.getHours()).padStart(2, '0');
      const currentMin = String(now.getMinutes()).padStart(2, '0');
      const timeNow = `${currentHour}:${currentMin}`;
      
      const defaultExchange = exchanges.length > 0 ? exchanges[0].code : 'B3';
      const defaultSetup = setups.length > 0 ? setups[0].name : '';
      const defaultEmotion = emotions.length > 0 ? emotions.find(e => e.category === 'neutral')?.name || emotions[0].name : '';
      
      setFormData(prev => ({
        entryDate: todayIso, entryTime: timeNow,
        exitDate: todayIso, exitTime: '',
        ticker: '', exchange: defaultExchange, side: 'LONG', entry: '', exit: '', qty: '',
        setup: defaultSetup, emotionEntry: defaultEmotion, emotionExit: defaultEmotion,
        notes: '',
        planId: prev.planId && plans.find(p => p.id === prev.planId) ? prev.planId : (plans[0]?.id || ''),
      }));

      // Sincroniza visual
      setMaskedInputs({
        entryDate: isoToBr(todayIso),
        entryTime: timeNow,
        exitDate: isoToBr(todayIso),
        exitTime: ''
      });

      setHtfFile(null); setLtfFile(null); setHtfPreview(null); setLtfPreview(null); setActiveAssetRule(null);
      setResultOverride(null);
      // Parciais: 1 ENTRY + 1 EXIT default
      setPartials([
        { type: 'ENTRY', price: '', qty: '', dateTime: '', seq: 1 },
        { type: 'EXIT', price: '', qty: '', dateTime: '', seq: 2 }
      ]);
    }
    setErrors({});
  }, [editTrade, isOpen, plans, exchanges, setups, emotions]); 

  // Recálculo de P&L quando parciais mudam
  useEffect(() => {
    if (partials.length === 0) return;
    
    const validPartials = partials.filter(p => p.price && p.qty && parseFloat(p.price) > 0 && parseFloat(p.qty) > 0);
    if (validPartials.length === 0) { setPreviewResult(null); return; }
    
    const calc = calculateFromPartials({
      side: formData.side,
      partials: validPartials,
      tickerRule: activeAssetRule ? {
        tickSize: activeAssetRule.tickSize,
        tickValue: activeAssetRule.tickValue,
        pointValue: activeAssetRule.pointValue
      } : null
    });
    
    setPreviewResult(calc.result);
    setResultOverride(null); // Reset override quando parciais mudam
    if (calc.avgEntry > 0) setFormData(prev => ({ ...prev, entry: calc.avgEntry.toString(), exit: calc.avgExit.toString(), qty: calc.realizedQty.toString() }));
  }, [partials, formData.side, activeAssetRule]);

  // Regra de Ativo
  useEffect(() => {
    if (!formData.ticker) { setActiveAssetRule(null); return; }
    const userInput = formData.ticker.toUpperCase();
    const tickers = masterTickers || [];
    const rule = tickers.find(t => t.symbol === userInput) || tickers.find(t => userInput.startsWith(t.symbol));
    if (rule) {
      setActiveAssetRule(rule);
      if (rule.exchange) setFormData(prev => ({ ...prev, exchange: rule.exchange }));
    } else { setActiveAssetRule(null); }
  }, [formData.ticker, masterTickers]);

  // P&L
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
        } else { result = rawDiff * qtyNum; }
        setPreviewResult(result);
      }
    } else { setPreviewResult(null); }
  }, [formData.entry, formData.exit, formData.qty, formData.side, activeAssetRule]);

  // Duração (Calculada com base no formData ISO, que é sempre válido)
  useEffect(() => {
    if (formData.entryDate && formData.entryTime && formData.exitDate && formData.exitTime) {
      const start = new Date(`${formData.entryDate}T${formData.entryTime}`);
      const end = new Date(`${formData.exitDate}T${formData.exitTime}`);
      const diffMs = end - start;
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 0) setDurationPreview("Erro: Saída < Entrada");
      else if (diffMins < 60) setDurationPreview(`${diffMins} min`);
      else if (diffMins < 1440) { 
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        setDurationPreview(`${hours}h ${mins}m`);
      } else { 
        const days = Math.floor(diffMins / 1440);
        const hours = Math.floor((diffMins % 1440) / 60);
        setDurationPreview(`${days}d ${hours}h`);
      }
    } else { setDurationPreview(null); }
  }, [formData.entryDate, formData.entryTime, formData.exitDate, formData.exitTime]);

  // --- HANDLERS ESPECIAIS DE DATA/HORA ---

  // 1. Digitação Manual com Máscara
  const handleMaskChange = (e) => {
    const { name, value } = e.target;
    let maskedValue = value;
    
    // Aplica máscara dependendo do campo
    if (name.includes('Date')) maskedValue = maskDate(value);
    if (name.includes('Time')) maskedValue = maskTime(value);

    setMaskedInputs(prev => ({ ...prev, [name]: maskedValue }));

    // Se estiver completo e válido, atualiza o formData (ISO)
    if (name.includes('Date') && maskedValue.length === 10) {
      const iso = brToIso(maskedValue);
      setFormData(prev => {
        const newState = { ...prev, [name]: iso };
        // Automação: Day Trade (copia para saída se vazio ou igual)
        if (name === 'entryDate' && (prev.entryDate === prev.exitDate || !prev.exitDate)) {
           newState.exitDate = iso;
           setMaskedInputs(m => ({ ...m, exitDate: maskedValue }));
        }
        return newState;
      });
      if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
    } 
    else if (name.includes('Time') && maskedValue.length === 5) {
      setFormData(prev => ({ ...prev, [name]: maskedValue }));
      if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  // 2. Seleção via Picker Nativo (Oculto)
  const handleNativePickerChange = (e, fieldName) => {
    const val = e.target.value; // Vem sempre ISO (YYYY-MM-DD) ou HH:MM do browser
    if (!val) return;

    setFormData(prev => {
      const newState = { ...prev, [fieldName]: val };
      if (fieldName === 'entryDate') {
         newState.exitDate = val; // Auto-sync para Day Trade
      }
      return newState;
    });

    // Atualiza a máscara visual
    if (fieldName.includes('Date')) {
       setMaskedInputs(prev => ({ ...prev, [fieldName]: isoToBr(val), ...(fieldName === 'entryDate' ? { exitDate: isoToBr(val) } : {}) }));
    } else {
       setMaskedInputs(prev => ({ ...prev, [fieldName]: val }));
    }
    
    if (errors[fieldName]) setErrors(prev => ({ ...prev, [fieldName]: null }));
  };

  const triggerPicker = (ref) => {
    if (ref.current) {
      try {
        ref.current.showPicker(); // Moderno
      } catch (e) {
        ref.current.focus(); // Fallback
      }
    }
  };

  // --- HANDLERS GERAIS ---

  const filteredTickers = (masterTickers || []).filter(t => !formData.exchange || t.exchange === formData.exchange);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
  };

  const handlePlanSelect = (planId) => {
    setFormData(prev => ({ ...prev, planId }));
    setShowPlanDropdown(false);
    if (errors[planId]) setErrors(prev => ({ ...prev, planId: null }));
  };

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/jpg', 'image/webp'].includes(file.type)) {
      setErrors(prev => ({ ...prev, [type]: 'Apenas imagens JPG, PNG ou WebP' }));
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

  // --- HANDLERS DE PARCIAIS ---

  const addPartialRow = () => {
    setPartials(prev => [...prev, { type: 'ENTRY', price: '', qty: '', dateTime: '', seq: prev.length + 1 }]);
  };

  const updatePartialRow = (index, field, value) => {
    setPartials(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const removePartialRow = (index) => {
    if (partials.length <= 2) return; // Mínimo 1E + 1S
    setPartials(prev => prev.filter((_, i) => i !== index).map((p, i) => ({ ...p, seq: i + 1 })));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.ticker.trim()) newErrors.ticker = 'Ticker é obrigatório';
    if (!formData.planId) newErrors.planId = 'Selecione um plano';
    if (!formData.setup) newErrors.setup = 'Selecione um setup';
    
    // Validar parciais (sempre)
    const validPartials = partials.filter(p => p.price && p.qty);
    if (validPartials.length === 0) newErrors.partials = 'Preencha ao menos 1 entrada e 1 saída';
    const entries = validPartials.filter(p => p.type === 'ENTRY');
    const exits = validPartials.filter(p => p.type === 'EXIT');
    if (entries.length === 0) newErrors.partials = 'Adicione ao menos 1 entrada';
    const totalEntryQty = entries.reduce((s, p) => s + (parseFloat(p.qty) || 0), 0);
    const totalExitQty = exits.reduce((s, p) => s + (parseFloat(p.qty) || 0), 0);
    if (totalExitQty > totalEntryQty) newErrors.partials = 'Qtd de saída excede entrada';
    
    // Validar horários das parciais
    partials.forEach((p, i) => {
      if (p.price && parseFloat(p.price) <= 0) newErrors[`partial_${i}_price`] = 'Preço inválido';
      if (p.qty && parseFloat(p.qty) <= 0) newErrors[`partial_${i}_qty`] = 'Qtd inválida';
      if (!p.dateTime) newErrors[`partial_${i}_dateTime`] = 'Horário obrigatório';
    });
    
    if (!editTrade) {
      if (!htfFile && !htfPreview) newErrors.htf = 'Imagem HTF é obrigatória';
      if (!ltfFile && !ltfPreview) newErrors.ltf = 'Imagem LTF é obrigatória';
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) console.warn('[MODAL] Erros de validação:', newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const validPartials = partials.filter(p => p.price && p.qty).map((p, i) => ({
      seq: i + 1,
      type: p.type,
      price: parseFloat(p.price),
      qty: parseFloat(p.qty),
      dateTime: p.dateTime || new Date().toISOString()
    }));

    // Derivar entryTime/exitTime das parciais
    const entries = validPartials.filter(p => p.type === 'ENTRY').sort((a, b) => (a.dateTime || '').localeCompare(b.dateTime || ''));
    const exits = validPartials.filter(p => p.type === 'EXIT').sort((a, b) => (a.dateTime || '').localeCompare(b.dateTime || ''));
    const entryTimeISO = entries[0]?.dateTime || new Date().toISOString();
    const exitTimeISO = exits.length > 0 ? exits[exits.length - 1]?.dateTime : null;
    
    const payload = { 
      ...formData,
      entryTime: entryTimeISO,
      exitTime: exitTimeISO,
      date: entryTimeISO.split('T')[0],
      tickerRule: activeAssetRule ? {
        tickSize: activeAssetRule.tickSize,
        tickValue: activeAssetRule.tickValue,
        pointValue: activeAssetRule.pointValue
      } : null,
      hasPartials: validPartials.length > 0,
      _partials: validPartials,
      resultOverride: resultOverride
    };

    console.log('[MODAL] Enviando payload:', payload);

    try {
      await onSubmit(payload, htfFile, ltfFile);
      onClose();
    } catch (err) {
      console.error(err);
      setErrors({ submit: err.message });
    }
  };

  const selectedPlan = plans.find(p => p.id === formData.planId);
  const selectedAccount = selectedPlan ? accounts.find(acc => acc.id === selectedPlan.accountId) : null;
  const getCurrencySymbol = (currency) => currency === 'USD' ? '$' : currency === 'EUR' ? '€' : 'R$';

  if (!isOpen) return null;
  if (masterLoading || accountsLoading) return <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" /></div>;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl my-8 shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* HEADER */}
        <div className="flex-none flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900 z-30">
          <div>
            <h2 className="text-xl font-bold text-white">{editTrade ? 'Editar Trade' : 'Novo Trade'}</h2>
            <p className="text-sm text-slate-500 mt-0.5">{selectedPlan ? `Plano: ${selectedPlan.name}` : 'Selecione um plano'}</p>
          </div>
          <button onClick={onClose} disabled={loading} className="text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 z-10">
          <form id="trade-form" onSubmit={handleSubmit} className="space-y-6">
            
            {errors.submit && <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-lg flex gap-3 text-red-400"><AlertCircle className="w-5 h-5"/><div><h4 className="font-bold">Erro ao Salvar</h4><p className="text-xs">{errors.submit}</p></div></div>}
            
            {/* PLANO */}
            <div className="relative" ref={planDropdownRef}>
              <label className="input-label">Plano *</label>
              <button type="button" onClick={() => setShowPlanDropdown(!showPlanDropdown)} className={`input-dark w-full flex justify-between ${errors.planId ? 'border-red-500' : ''}`}>
                <div className="flex items-center gap-3"><Wallet className="w-4 h-4 text-blue-400"/><span>{selectedPlan ? selectedPlan.name : 'Selecione...'}</span></div>
                <ChevronDown className="w-4 h-4 text-slate-500"/>
              </button>
              {showPlanDropdown && (
                <div className="absolute top-full w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                  {plans.map(p => <button key={p.id} type="button" onClick={() => handlePlanSelect(p.id)} className="w-full text-left px-4 py-3 hover:bg-slate-700 text-sm text-white border-b border-slate-700/50">{p.name}</button>)}
                </div>
              )}
            </div>

            {/* DADOS DO TRADE */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="input-label">Bolsa</label>
                <select name="exchange" value={formData.exchange} onChange={(e) => { setFormData(prev => ({ ...prev, exchange: e.target.value, ticker: '' })); setActiveAssetRule(null); }} className="input-dark w-full">{exchanges.map(ex => <option key={ex.id} value={ex.code}>{ex.code}</option>)}</select>
              </div>

              <div className="relative">
                <label className="input-label">Ticker *</label>
                <input type="text" name="ticker" value={formData.ticker} onChange={handleChange} className={`input-dark w-full uppercase ${errors.ticker ? 'border-red-500' : ''}`} list="tickers-list" autoComplete="off"/>
                <datalist id="tickers-list">{filteredTickers.map(t => <option key={t.id} value={t.symbol}>{t.name}</option>)}</datalist>
                {activeAssetRule && <div className="absolute right-2 top-8 text-[10px] text-emerald-400 bg-emerald-900/30 px-2 rounded">Min: {activeAssetRule.minLot}</div>}
              </div>

              <div>
                <label className="input-label">Lado</label>
                <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">{SIDES.map(side => (<button key={side} type="button" onClick={() => setFormData(prev => ({ ...prev, side }))} className={`flex-1 py-2 text-xs font-medium rounded ${formData.side === side ? (side === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400') : 'text-slate-400 hover:text-white'}`}>{side}</button>))}</div>
              </div>

              <div><label className="input-label">Quantidade *</label><input type="number" name="qty" value={formData.qty} onChange={handleChange} className="input-dark w-full" step={activeAssetRule?.minLot || 1} disabled placeholder="Calculado das parciais" /></div>

              {/* GRID DE PARCIAIS (SEMPRE VISÍVEL) */}
              <div className="md:col-span-2">
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-3 space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" /> Parciais
                    </span>
                    <button type="button" onClick={addPartialRow} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                      <Plus className="w-3 h-3" /> Adicionar
                    </button>
                  </div>
                  
                  {/* Header */}
                  <div className="grid grid-cols-[70px_1fr_80px_140px_28px] gap-2 text-[10px] text-slate-500 uppercase tracking-wider px-1">
                    <span>Ponta</span>
                    <span>Preço</span>
                    <span>Qtd</span>
                    <span>Horário</span>
                    <span></span>
                  </div>
                  
                  {/* Rows */}
                  {partials.map((p, i) => (
                    <div key={i} className="grid grid-cols-[70px_1fr_80px_140px_28px] gap-2 items-center">
                      <select
                        value={p.type}
                        onChange={(e) => updatePartialRow(i, 'type', e.target.value)}
                        className={`input-dark text-xs py-1.5 ${p.type === 'ENTRY' ? 'text-emerald-400' : 'text-red-400'}`}
                      >
                        <option value="ENTRY">Entrada</option>
                        <option value="EXIT">Saída</option>
                      </select>
                      <input
                        type="number"
                        step="any"
                        value={p.price}
                        onChange={(e) => updatePartialRow(i, 'price', e.target.value)}
                        placeholder="Preço"
                        className={`input-dark text-xs py-1.5 ${errors[`partial_${i}_price`] ? 'border-red-500' : ''}`}
                      />
                      <input
                        type="number"
                        value={p.qty}
                        onChange={(e) => updatePartialRow(i, 'qty', e.target.value)}
                        placeholder="Qtd"
                        step={activeAssetRule?.minLot || 1}
                        className={`input-dark text-xs py-1.5 ${errors[`partial_${i}_qty`] ? 'border-red-500' : ''}`}
                      />
                      <input
                        type="datetime-local"
                        value={p.dateTime ? p.dateTime.slice(0, 16) : ''}
                        onChange={(e) => updatePartialRow(i, 'dateTime', e.target.value ? `${e.target.value}:00` : '')}
                        className={`input-dark text-xs py-1.5 ${errors[`partial_${i}_dateTime`] ? 'border-red-500' : ''}`}
                      />
                      <button
                        type="button"
                        onClick={() => removePartialRow(i)}
                        disabled={partials.length <= 2}
                        className={`p-1 transition-colors ${partials.length <= 2 ? 'text-slate-700 cursor-not-allowed' : 'text-slate-500 hover:text-red-400'}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  
                  {errors.partials && (
                    <div className="flex items-center gap-1 text-xs text-red-400 mt-1">
                      <AlertCircle className="w-3 h-3" /> {errors.partials}
                    </div>
                  )}
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="input-label flex items-center gap-2">
                  Resultado (P&L)
                  {resultOverride != null && (
                    <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded">Editado</span>
                  )}
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="any"
                    value={resultOverride != null ? resultOverride : (previewResult != null ? previewResult : '')}
                    onChange={(e) => setResultOverride(e.target.value !== '' ? e.target.value : null)}
                    placeholder="---"
                    className={`input-dark w-full font-mono font-bold text-center ${
                      (resultOverride != null ? parseFloat(resultOverride) : previewResult) >= 0 
                        ? 'text-emerald-400 bg-emerald-500/10' 
                        : 'text-red-400 bg-red-500/10'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const val = resultOverride != null ? parseFloat(resultOverride) : previewResult;
                      if (val != null) setResultOverride(Math.round(val).toString());
                    }}
                    disabled={previewResult == null && resultOverride == null}
                    title="Arredondar para inteiro"
                    className="input-dark px-3 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors text-xs font-mono disabled:opacity-30"
                  >
                    ≈
                  </button>
                  {resultOverride != null && (
                    <button
                      type="button"
                      onClick={() => setResultOverride(null)}
                      title="Restaurar valor calculado"
                      className="input-dark px-3 text-slate-400 hover:text-amber-400 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {previewResult != null && resultOverride != null && (
                  <div className="text-[10px] text-slate-500 mt-1">
                    Calculado: {selectedAccount ? getCurrencySymbol(selectedAccount.currency) : 'R$'} {previewResult.toFixed(2)}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className="input-label">Setup *</label><select name="setup" value={formData.setup} onChange={handleChange} className={`input-dark w-full ${errors.setup ? 'border-red-500' : ''}`}><option value="">Selecione...</option>{setups.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select></div>
              <div><label className="input-label">Emoção Entrada</label><select name="emotionEntry" value={formData.emotionEntry} onChange={handleChange} className="input-dark w-full"><option value="">Selecione...</option>{emotions.map(e => <option key={e.id} value={e.name}>{e.emoji} {e.name}</option>)}</select></div>
              <div><label className="input-label">Emoção Saída</label><select name="emotionExit" value={formData.emotionExit} onChange={handleChange} className="input-dark w-full"><option value="">Selecione...</option>{emotions.map(e => <option key={e.id} value={e.name}>{e.emoji} {e.name}</option>)}</select></div>
            </div>

            <div><label className="input-label">Observações</label><textarea name="notes" rows="2" value={formData.notes} onChange={handleChange} className="input-dark w-full resize-none" placeholder="Racional do trade..." /></div>

            <div className="grid grid-cols-2 gap-4">
               {['htf', 'ltf'].map(type => (
                 <div key={type}>
                   <label className="input-label mb-2 uppercase flex items-center gap-1">{type} Image <span className="text-red-400">*</span></label>
                   {(type === 'htf' ? htfPreview : ltfPreview) ? (
                     <div className="relative group h-24 rounded-lg overflow-hidden border border-slate-700"><img src={type === 'htf' ? htfPreview : ltfPreview} className="w-full h-full object-cover" /><button type="button" onClick={() => removeImage(type)} className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white"><X/></button></div>
                   ) : (
                     <label className={`flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-slate-800 ${errors[type] ? 'border-red-500/50 bg-red-500/5' : 'border-slate-700'}`}><Upload className={`w-5 h-5 ${errors[type] ? 'text-red-400' : 'text-slate-500'}`} /><input ref={type === 'htf' ? htfInputRef : ltfInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, type)} /></label>
                   )}
                   {errors[type] && <span className="text-[10px] text-red-400 mt-1 block">{errors[type]}</span>}
                 </div>
               ))}
            </div>

          </form>
        </div>

        {/* FOOTER */}
        <div className="flex-none p-4 border-t border-slate-800 bg-slate-900 flex justify-end gap-3 z-20">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg">Cancelar</button>
          <button type="submit" form="trade-form" className="px-6 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {editTrade ? 'Salvar Alterações' : 'Registrar Trade'}
          </button>
        </div>

      </div>
      <style>{`.input-label { font-size: 0.75rem; color: #94a3b8; margin-bottom: 0.25rem; font-weight: 500; display: block; } .input-dark { background: #0f172a; border: 1px solid #334155; padding: 0.5rem; border-radius: 0.5rem; color: white; outline: none; font-size: 0.875rem; } .input-dark:focus { border-color: #2563eb; } .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border-width: 0; }`}</style>
    </div>
  );
};

export default AddTradeModal;