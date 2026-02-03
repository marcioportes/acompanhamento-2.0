import React, { useState, useEffect } from 'react';
import { 
  collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, updateDoc, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  Trash2, Plus, RefreshCw, Edit2, X, AlertTriangle, HelpCircle, Save 
} from 'lucide-react';

/**
 * Componente de Tooltip para explicar regras de negócio ao passar o mouse.
 */
const Tooltip = ({ text }) => (
  <div className="group relative inline-block ml-1">
    <HelpCircle className="w-3 h-3 text-slate-500 cursor-help hover:text-blue-400 transition-colors" />
    <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 border border-slate-700 text-white text-xs rounded-lg w-48 text-center shadow-xl z-50 pointer-events-none">
      {text}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
    </div>
  </div>
);

/**
 * Gerenciador de Ativos (Master Data) em Layout de Tabela.
 * Foco em densidade de informação e agilidade de cadastro.
 */
const TickerManager = () => {
  // --- ESTADOS ---
  const [tickers, setTickers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Dados Auxiliares
  const [exchanges, setExchanges] = useState([]);
  const [currencies, setCurrencies] = useState([]);

  // Formulário
  const [formData, setFormData] = useState({ 
    id: null,
    symbol: '', 
    name: '',
    description: '',
    exchange: '',
    currency: '',
    minLot: 1,    // Campo unificado de regra
    tickSize: '',
    tickValue: '',
    pointValue: '', 
    active: true
  });

  const tickersCollection = collection(db, 'tickers');

  // --- DATA FETCHING ---
  const fetchData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const tQuery = query(tickersCollection, orderBy('symbol'));
      const tSnap = await getDocs(tQuery);
      
      const mapped = tSnap.docs.map(d => {
        const data = d.data();
        return { 
          ...data, 
          id: d.id,
          // Normalização: Garante que minLot exista visualmente
          minLot: data.minLot || data.contractSize || 1 
        };
      });

      setTickers(mapped);

      // Carrega auxiliares
      const [exSnap, curSnap] = await Promise.all([
        getDocs(collection(db, 'exchanges')),
        getDocs(collection(db, 'currencies'))
      ]);
      setExchanges(exSnap.docs.map(d => d.data()));
      setCurrencies(curSnap.docs.map(d => d.data()));

    } catch (err) {
      console.error(err);
      setErrorMsg("Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // --- REGRAS DE NEGÓCIO ---

  // Auto-Cálculo de Point Value
  useEffect(() => {
    const size = parseFloat(formData.tickSize);
    const value = parseFloat(formData.tickValue);

    if (!isNaN(size) && size > 0 && !isNaN(value) && value >= 0) {
      const calculated = value / size;
      setFormData(prev => ({ ...prev, pointValue: parseFloat(calculated.toFixed(5)) }));
    } else {
      // Se apagar os valores, reseta o calculado
      if(formData.pointValue !== '') setFormData(prev => ({ ...prev, pointValue: '' }));
    }
  }, [formData.tickSize, formData.tickValue]);

  // --- HANDLERS ---

  const handleEdit = (ticker) => {
    setErrorMsg(null);
    setFormData({
      id: ticker.id,
      symbol: ticker.symbol,
      name: ticker.name || '',
      description: ticker.description || '',
      exchange: ticker.exchange || 'B3',
      currency: ticker.currency || 'BRL',
      minLot: ticker.minLot,
      tickSize: ticker.tickSize || '',
      tickValue: ticker.tickValue || '',
      pointValue: ticker.pointValue || '',
      active: ticker.active !== undefined ? ticker.active : true
    });
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = () => {
    setErrorMsg(null);
    setFormData({ 
      id: null, symbol: '', name: '', description: '', exchange: '', currency: '', 
      minLot: 1, tickSize: '', tickValue: '', pointValue: '', active: true 
    });
    setIsEditing(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.symbol) return;
    
    // Validação
    if (formData.minLot < 1) {
      setErrorMsg("Lote Mínimo deve ser pelo menos 1.");
      return;
    }

    const payload = {
      symbol: formData.symbol.toUpperCase().trim(),
      name: formData.name,
      exchange: formData.exchange,
      currency: formData.currency,
      minLot: Number(formData.minLot),
      contractSize: Number(formData.minLot), // Mantém compatibilidade legado
      tickSize: Number(formData.tickSize),
      tickValue: Number(formData.tickValue),
      pointValue: Number(formData.pointValue),
      active: formData.active,
      updatedAt: serverTimestamp()
    };

    try {
      if (isEditing && formData.id) {
        await updateDoc(doc(db, 'tickers', formData.id), payload);
      } else {
        payload.createdAt = serverTimestamp();
        await addDoc(tickersCollection, payload);
      }
      handleCancel();
      fetchData();
    } catch (err) {
      console.error(err);
      setErrorMsg("Erro ao salvar.");
    }
  };

  const handleDelete = async (id) => {
    if(!window.confirm("Excluir este ativo?")) return;
    try {
      await deleteDoc(doc(db, 'tickers', id));
      setTickers(prev => prev.filter(t => t.id !== id));
    } catch (err) { alert("Erro ao excluir."); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Gerenciar Ativos (Master Data)</h3>
        <button onClick={fetchData} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg flex items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4" /> {errorMsg}
        </div>
      )}

      {/* --- ÁREA DE FORMULÁRIO (Topo) --- */}
      <div className={`glass-card p-6 border transition-colors ${isEditing ? 'border-blue-500/30 bg-blue-500/5' : 'border-slate-700/50'}`}>
        <div className="flex items-center justify-between mb-4">
          <h4 className={`text-sm font-bold flex items-center gap-2 ${isEditing ? 'text-blue-400' : 'text-slate-300'}`}>
            {isEditing ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />} 
            {isEditing ? `Editando: ${formData.symbol}` : 'Adicionar Novo Ativo'}
          </h4>
          {isEditing && (
             <button onClick={handleCancel} className="text-xs text-slate-400 hover:text-white flex items-center gap-1">
               <X className="w-3 h-3" /> Cancelar
             </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="col-span-1">
            <label className="text-xs text-slate-500 mb-1 block">Símbolo *</label>
            <input 
              className="input-dark uppercase" placeholder="WINFUT" required 
              value={formData.symbol} onChange={e => setFormData({...formData, symbol: e.target.value})}
              disabled={isEditing}
            />
          </div>
          <div className="col-span-1">
            <label className="text-xs text-slate-500 mb-1 block">Nome</label>
            <input 
              className="input-dark" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} 
            />
          </div>
          <div className="col-span-1">
            <label className="text-xs text-slate-500 mb-1 block">Bolsa</label>
            <select className="input-dark" value={formData.exchange} onChange={e => setFormData({...formData, exchange: e.target.value})}>
              <option value="">Selecione...</option>
              {exchanges.map(ex => <option key={ex.code} value={ex.code}>{ex.code}</option>)}
              {!exchanges.length && <option value="B3">B3</option>}
            </select>
          </div>
          <div className="col-span-1">
            <label className="text-xs text-slate-500 mb-1 block">Moeda</label>
            <select className="input-dark" value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value})}>
               <option value="">Selecione...</option>
               {currencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
               {!currencies.length && <option value="BRL">BRL</option>}
            </select>
          </div>

          {/* Dados Quantitativos */}
          <div className="col-span-1">
             <label className="text-xs text-emerald-400 font-bold mb-1 flex items-center">
               Lote Mín. <Tooltip text="Menor quantidade permitida. O sistema bloqueia frações deste número." />
             </label>
             <input 
               type="number" min="1" className="input-dark border-emerald-500/30 text-emerald-400" required
               value={formData.minLot} onChange={e => setFormData({...formData, minLot: e.target.value})}
             />
          </div>
          <div className="col-span-1">
             <label className="text-xs text-slate-500 mb-1 flex items-center">
               Tick Size <Tooltip text="Variação mínima de preço na tela (ex: 5.0 para Índice)." />
             </label>
             <input 
               type="number" step="0.0001" className="input-dark" required
               value={formData.tickSize} onChange={e => setFormData({...formData, tickSize: e.target.value})}
             />
          </div>
          <div className="col-span-1">
             <label className="text-xs text-slate-500 mb-1 flex items-center">
               Tick Value <Tooltip text="Valor financeiro de 1 Tick para 1 Contrato." />
             </label>
             <input 
               type="number" step="0.01" className="input-dark" required
               value={formData.tickValue} onChange={e => setFormData({...formData, tickValue: e.target.value})}
             />
          </div>
          <div className="col-span-1">
             <label className="text-xs text-blue-400 font-bold mb-1 flex items-center">
               Point Value <Tooltip text="Calculado Auto: TickValue / TickSize" />
             </label>
             <input 
               className="input-dark bg-slate-800/50 text-slate-400 cursor-not-allowed" readOnly
               value={formData.pointValue}
             />
          </div>

          <div className="col-span-2 md:col-span-6 flex justify-end gap-3 mt-4">
             {isEditing && <button type="button" onClick={handleCancel} className="btn-secondary">Cancelar</button>}
             <button type="submit" className={`btn-primary ${isEditing ? 'bg-blue-600' : 'bg-emerald-600'}`}>
               {isEditing ? <><Save className="w-4 h-4 mr-2"/> Salvar Alterações</> : <><Plus className="w-4 h-4 mr-2"/> Cadastrar</>}
             </button>
          </div>
        </form>
      </div>

      {/* --- ÁREA DE TABELA (Listagem) --- */}
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/30">
        <table className="w-full text-left text-sm text-slate-400">
          <thead className="bg-slate-900 text-slate-200 uppercase text-xs">
            <tr>
              <th className="p-4">Ativo</th>
              <th className="p-4 hidden md:table-cell">Bolsa</th>
              <th className="p-4 text-center">Lote Mín.</th>
              <th className="p-4">Tick Rule (Size | Val)</th>
              <th className="p-4 hidden md:table-cell">Point Val</th>
              <th className="p-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {tickers.map(t => (
              <tr key={t.id} className="hover:bg-slate-800/50 transition-colors group">
                <td className="p-4 font-bold text-white">
                  {t.symbol}
                  <div className="text-xs text-slate-500 font-normal">{t.name}</div>
                </td>
                <td className="p-4 hidden md:table-cell">
                  <span className="bg-slate-800 px-2 py-1 rounded text-xs border border-slate-700">{t.exchange}</span>
                </td>
                <td className="p-4 text-center">
                  <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                    {t.minLot}
                  </span>
                </td>
                <td className="p-4 text-xs font-mono">
                  {t.tickSize} pts <span className="text-slate-600 mx-1">|</span> R$ {t.tickValue}
                </td>
                <td className="p-4 hidden md:table-cell text-xs font-mono text-blue-300">
                  R$ {Number(t.pointValue).toFixed(2)}
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(t)} className="p-2 hover:bg-blue-500/20 text-blue-400 rounded transition-colors" title="Editar">
                      <Edit2 className="w-4 h-4"/>
                    </button>
                    <button onClick={() => handleDelete(t.id)} className="p-2 hover:bg-red-500/20 text-red-400 rounded transition-colors" title="Excluir">
                      <Trash2 className="w-4 h-4"/>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && tickers.length === 0 && (
              <tr><td colSpan="6" className="p-8 text-center text-slate-500">Nenhum ativo cadastrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      
      <style>{`
        .input-dark { width: 100%; background: rgb(15 23 42); border: 1px solid rgb(51 65 85); padding: 0.5rem; border-radius: 0.5rem; color: white; outline: none; }
        .input-dark:focus { border-color: rgb(59 130 246); box-shadow: 0 0 0 1px rgb(59 130 246); }
        .btn-primary { display: inline-flex; align-items: center; padding: 0.5rem 1rem; border-radius: 0.5rem; color: white; font-weight: 500; transition: all 0.2s; }
        .btn-secondary { padding: 0.5rem 1rem; border-radius: 0.5rem; background: rgb(30 41 59); color: rgb(203 213 225); font-size: 0.875rem; }
        .btn-secondary:hover { background: rgb(51 65 85); }
      `}</style>
    </div>
  );
};

export default TickerManager;