import { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Upload, 
  Image, 
  Loader2, 
  AlertCircle,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { SETUPS, EMOTIONS, EXCHANGES, SIDES } from '../firebase';

const AddTradeModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  editTrade = null,
  loading = false 
}) => {
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
  });
  
  const [htfFile, setHtfFile] = useState(null);
  const [ltfFile, setLtfFile] = useState(null);
  const [htfPreview, setHtfPreview] = useState(null);
  const [ltfPreview, setLtfPreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [previewResult, setPreviewResult] = useState(null);

  const htfInputRef = useRef(null);
  const ltfInputRef = useRef(null);

  // Preencher dados para edição
  useEffect(() => {
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
      });
      if (editTrade.htfUrl) setHtfPreview(editTrade.htfUrl);
      if (editTrade.ltfUrl) setLtfPreview(editTrade.ltfUrl);
    } else {
      // Reset form
      setFormData({
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
      });
      setHtfFile(null);
      setLtfFile(null);
      setHtfPreview(null);
      setLtfPreview(null);
    }
    setErrors({});
  }, [editTrade, isOpen]);

  // Calcular preview do resultado
  useEffect(() => {
    const { entry, exit, qty, side } = formData;
    if (entry && exit && qty) {
      const entryNum = parseFloat(entry);
      const exitNum = parseFloat(exit);
      const qtyNum = parseFloat(qty);
      
      if (!isNaN(entryNum) && !isNaN(exitNum) && !isNaN(qtyNum)) {
        let result;
        if (side === 'LONG') {
          result = (exitNum - entryNum) * qtyNum;
        } else {
          result = (entryNum - exitNum) * qtyNum;
        }
        setPreviewResult(result);
      }
    } else {
      setPreviewResult(null);
    }
  }, [formData.entry, formData.exit, formData.qty, formData.side]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Limpar erro do campo
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validar tipo
    if (!['image/jpeg', 'image/png', 'image/jpg', 'image/webp'].includes(file.type)) {
      setErrors(prev => ({ 
        ...prev, 
        [type]: 'Apenas imagens JPG, PNG ou WebP são aceitas' 
      }));
      return;
    }

    // Validar tamanho (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ 
        ...prev, 
        [type]: 'Imagem muito grande (máximo 5MB)' 
      }));
      return;
    }

    // Criar preview
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

    // Limpar erro
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
    if (!formData.entry || isNaN(parseFloat(formData.entry))) {
      newErrors.entry = 'Preço de entrada inválido';
    }
    if (!formData.exit || isNaN(parseFloat(formData.exit))) {
      newErrors.exit = 'Preço de saída inválido';
    }
    if (!formData.qty || isNaN(parseFloat(formData.qty)) || parseFloat(formData.qty) <= 0) {
      newErrors.qty = 'Quantidade inválida';
    }

    // Imagens são obrigatórias apenas para novos trades
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

    try {
      await onSubmit(formData, htfFile, ltfFile);
      onClose();
    } catch (err) {
      setErrors({ submit: err.message });
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

              {/* Ticker */}
              <div className="input-group">
                <label className="input-label">Ticker *</label>
                <input
                  type="text"
                  name="ticker"
                  value={formData.ticker}
                  onChange={handleChange}
                  placeholder="Ex: PETR4, AAPL"
                  className={`uppercase ${errors.ticker ? 'ring-2 ring-red-500/50' : ''}`}
                />
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
                    ? `${previewResult >= 0 ? '+' : ''}R$ ${previewResult.toFixed(2)}`
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
