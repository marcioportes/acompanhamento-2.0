/**
 * SettingsPage - Configurações Unificadas (apenas Mentor)
 */
import { useState } from 'react';
import { 
  Settings, TrendingUp, Building2, Landmark, DollarSign, Heart,
  Plus, Edit2, Trash2, X, Check, Loader2, AlertCircle, Shield,
  Database, RefreshCw, Zap, Search, AlertTriangle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useMasterData } from '../hooks/useMasterData';
import { useTrades } from '../hooks/useTrades';
import { runSeed, forceSeed, updateTickers } from '../utils/seedData';

const TABS = [
  { id: 'setups', label: 'Setups', icon: TrendingUp, color: 'blue' },
  { id: 'exchanges', label: 'Bolsas', icon: Landmark, color: 'emerald' },
  { id: 'brokers', label: 'Corretoras', icon: Building2, color: 'purple' },
  { id: 'currencies', label: 'Moedas', icon: DollarSign, color: 'amber' },
  { id: 'emotions', label: 'Emoções', icon: Heart, color: 'rose' },
  { id: 'admin', label: 'Admin', icon: Database, color: 'slate' },
];

const EMOTION_CATEGORIES = [
  { value: 'positive', label: 'Positiva', color: 'emerald' },
  { value: 'neutral', label: 'Neutra', color: 'slate' },
  { value: 'negative', label: 'Negativa', color: 'red' },
];

const SettingsPage = () => {
  const { user, isMentor } = useAuth();
  const { trades } = useTrades();
  const { 
    setups, exchanges, brokers, currencies, emotions, loading,
    addSetup, updateSetup, deleteSetup,
    addExchange, updateExchange, deleteExchange,
    addBroker, updateBroker, deleteBroker,
    addCurrency, updateCurrency, deleteCurrency,
    addEmotion, updateEmotion, deleteEmotion
  } = useMasterData();

  const [activeTab, setActiveTab] = useState('setups');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [adminLoading, setAdminLoading] = useState(null);
  const [adminResult, setAdminResult] = useState(null);

  if (!isMentor()) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Acesso Negado</h1>
          <p className="text-slate-400">Apenas o mentor pode acessar.</p>
        </div>
      </div>
    );
  }

  const checkUsage = (type, item) => {
    switch (type) {
      case 'setups': return trades.filter(t => t.setup === item.name).length;
      case 'exchanges': return trades.filter(t => t.exchange === item.code).length;
      case 'emotions': return trades.filter(t => t.emotion === item.name).length;
      default: return 0;
    }
  };

  const getTabData = () => {
    let data = [];
    switch (activeTab) {
      case 'setups': data = setups; break;
      case 'exchanges': data = exchanges; break;
      case 'brokers': data = brokers; break;
      case 'currencies': data = currencies; break;
      case 'emotions': data = emotions; break;
      default: return [];
    }
    if (!searchTerm) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(item => 
      (item.name || '').toLowerCase().includes(term) ||
      (item.code || '').toLowerCase().includes(term)
    );
  };

  const getFormFields = () => {
    switch (activeTab) {
      case 'setups': return [
        { key: 'name', label: 'Nome *', type: 'text', placeholder: 'Ex: Fractal' },
        { key: 'description', label: 'Descrição', type: 'textarea', placeholder: 'Descrição...' },
      ];
      case 'exchanges': return [
        { key: 'code', label: 'Código *', type: 'text', placeholder: 'Ex: B3' },
        { key: 'name', label: 'Nome *', type: 'text', placeholder: 'Ex: Brasil Bolsa Balcão' },
        { key: 'country', label: 'País', type: 'text', placeholder: 'BR' },
      ];
      case 'brokers': return [
        { key: 'name', label: 'Nome *', type: 'text', placeholder: 'Ex: XP' },
        { key: 'country', label: 'País', type: 'text', placeholder: 'BR' },
      ];
      case 'currencies': return [
        { key: 'code', label: 'Código *', type: 'text', placeholder: 'BRL' },
        { key: 'name', label: 'Nome *', type: 'text', placeholder: 'Real' },
        { key: 'symbol', label: 'Símbolo *', type: 'text', placeholder: 'R$' },
      ];
      case 'emotions': return [
        { key: 'name', label: 'Nome *', type: 'text', placeholder: 'Disciplinado' },
        { key: 'category', label: 'Categoria *', type: 'select', options: EMOTION_CATEGORIES },
      ];
      default: return [];
    }
  };

  const openModal = (item = null) => {
    setEditingItem(item);
    setFormData(item ? { ...item } : {});
    setError(null);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    const fields = getFormFields();
    for (const f of fields.filter(f => f.label.includes('*'))) {
      if (!formData[f.key]?.trim()) {
        setError(`Campo "${f.label.replace(' *', '')}" é obrigatório`);
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      const actions = {
        setups: { add: addSetup, update: updateSetup },
        exchanges: { add: addExchange, update: updateExchange },
        brokers: { add: addBroker, update: updateBroker },
        currencies: { add: addCurrency, update: updateCurrency },
        emotions: { add: addEmotion, update: updateEmotion },
      };
      if (editingItem) await actions[activeTab].update(editingItem.id, formData);
      else await actions[activeTab].add(formData);
      setIsModalOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    const usage = checkUsage(activeTab, item);
    if (usage > 0) {
      alert(`Não é possível excluir: "${item.name || item.code}" está sendo usado em ${usage} trades.`);
      return;
    }
    if (!window.confirm(`Excluir "${item.name || item.code}"?`)) return;
    try {
      const actions = { setups: deleteSetup, exchanges: deleteExchange, brokers: deleteBroker, currencies: deleteCurrency, emotions: deleteEmotion };
      await actions[activeTab](item.id);
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  };

  const handleAdminAction = async (action) => {
    if (action === 'force' && !window.confirm('Sobrescrever dados existentes?')) return;
    setAdminLoading(action);
    setAdminResult(null);
    try {
      const actions = { seed: runSeed, force: forceSeed, tickers: updateTickers };
      const res = await actions[action]();
      setAdminResult(res);
    } catch (err) {
      setAdminResult({ success: false, message: err.message });
    } finally {
      setAdminLoading(null);
    }
  };

  const renderItem = (item) => {
    const usage = checkUsage(activeTab, item);
    switch (activeTab) {
      case 'setups':
        return (
          <div className="flex-1">
            <p className="font-medium text-white">{item.name}</p>
            {item.description && <p className="text-sm text-slate-500 truncate">{item.description}</p>}
          </div>
        );
      case 'exchanges':
        return (
          <div className="flex-1">
            <p className="font-medium text-white">{item.code} <span className="text-slate-500 font-normal">- {item.name}</span></p>
            {item.country && <p className="text-sm text-slate-500">{item.country}</p>}
          </div>
        );
      case 'brokers':
        return (
          <div className="flex-1">
            <p className="font-medium text-white">{item.name}</p>
            {item.country && <p className="text-sm text-slate-500">{item.country}</p>}
          </div>
        );
      case 'currencies':
        return (
          <div className="flex-1">
            <p className="font-medium text-white">{item.symbol} {item.code}</p>
            <p className="text-sm text-slate-500">{item.name}</p>
          </div>
        );
      case 'emotions':
        const cat = EMOTION_CATEGORIES.find(c => c.value === item.category);
        return (
          <div className="flex items-center gap-3 flex-1">
            <span className={`px-2 py-0.5 rounded text-xs font-bold bg-${cat?.color || 'slate'}-500/20 text-${cat?.color || 'slate'}-400`}>
              {cat?.label || 'N/A'}
            </span>
            <p className="font-medium text-white">{item.name}</p>
          </div>
        );
      default:
        return <p className="text-white flex-1">{item.name || item.code}</p>;
    }
  };

  const tabData = getTabData();
  const activeTabConfig = TABS.find(t => t.id === activeTab);

  return (
    <div className="min-h-screen p-6 lg:p-8 animate-in fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Settings className="w-8 h-8 text-blue-400" />
            Configurações
          </h1>
          <p className="text-slate-400 mt-1">Gerencie os dados mestres do sistema</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSearchTerm(''); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? `bg-${tab.color}-500/20 text-${tab.color}-400 border border-${tab.color}-500/30`
                : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-white border border-transparent'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'admin' ? (
        /* Admin Panel */
        <div className="max-w-2xl space-y-4">
          {adminResult && (
            <div className={`p-4 rounded-xl border ${adminResult.success ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
              <div className="flex items-center gap-3">
                {adminResult.success ? <Check className="w-5 h-5 text-emerald-400" /> : <AlertCircle className="w-5 h-5 text-red-400" />}
                <span className={adminResult.success ? 'text-emerald-400' : 'text-red-400'}>{adminResult.message}</span>
              </div>
            </div>
          )}

          <div className="glass-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">Seed Inicial</h3>
                <p className="text-sm text-slate-400">Popula dados iniciais (só se vazio)</p>
              </div>
              <button onClick={() => handleAdminAction('seed')} disabled={adminLoading} className="btn-primary py-2 px-4">
                {adminLoading === 'seed' ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Database className="w-4 h-4 mr-2" />Executar</>}
              </button>
            </div>
          </div>

          <div className="glass-card p-6 border-yellow-500/30">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-yellow-400 mb-1">Forçar Seed</h3>
                <p className="text-sm text-slate-400">Sobrescreve dados existentes</p>
              </div>
              <button onClick={() => handleAdminAction('force')} disabled={adminLoading} className="btn-secondary py-2 px-4 border-yellow-500/50 text-yellow-400">
                {adminLoading === 'force' ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Zap className="w-4 h-4 mr-2" />Forçar</>}
              </button>
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">Atualizar Tickers</h3>
                <p className="text-sm text-slate-400">Atualiza specs de tickers (WINFUT, ES, etc)</p>
              </div>
              <button onClick={() => handleAdminAction('tickers')} disabled={adminLoading} className="btn-primary py-2 px-4">
                {adminLoading === 'tickers' ? <Loader2 className="w-5 h-5 animate-spin" /> : <><RefreshCw className="w-4 h-4 mr-2" />Atualizar</>}
              </button>
            </div>
          </div>

          <div className="p-4 bg-slate-800/50 rounded-xl">
            <p className="text-sm text-slate-400"><strong className="text-white">Logado:</strong> {user?.email}</p>
          </div>
        </div>
      ) : (
        /* CRUD Panel */
        <div className="glass-card">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-800">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <activeTabConfig.icon className={`w-5 h-5 text-${activeTabConfig.color}-400`} />
                {activeTabConfig.label}
                <span className="text-sm font-normal text-slate-500">({tabData.length})</span>
              </h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-slate-800/50 border border-slate-700 rounded-lg pl-9 pr-4 py-1.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 outline-none w-48"
                />
              </div>
            </div>
            <button onClick={() => openModal()} className="btn-primary py-2 px-4">
              <Plus className="w-4 h-4 mr-2" />Adicionar
            </button>
          </div>

          {/* List */}
          <div className="max-h-[500px] overflow-y-auto">
            {loading ? (
              <div className="text-center py-12"><Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" /></div>
            ) : tabData.length === 0 ? (
              <div className="text-center py-12 text-slate-500">{searchTerm ? 'Nenhum resultado' : 'Nenhum item'}</div>
            ) : (
              <div className="divide-y divide-slate-800">
                {tabData.map(item => {
                  const usage = checkUsage(activeTab, item);
                  return (
                    <div key={item.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-800/50 transition-colors group">
                      {renderItem(item)}
                      {usage > 0 && (
                        <span className="text-xs text-slate-600 mr-4">{usage} trades</span>
                      )}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openModal(item)} className="p-2 hover:bg-blue-500/20 rounded-lg text-blue-400" title="Editar">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(item)} 
                          className={`p-2 rounded-lg ${usage > 0 ? 'text-slate-600 cursor-not-allowed' : 'hover:bg-red-500/20 text-red-400'}`}
                          title={usage > 0 ? 'Em uso' : 'Excluir'}
                          disabled={usage > 0}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">
                {editingItem ? 'Editar' : 'Novo'} {activeTabConfig.label.slice(0, -1)}
              </h3>
              <button onClick={() => setIsModalOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-white" /></button>
            </div>

            <div className="p-5 space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-red-400">{error}</span>
                </div>
              )}
              {getFormFields().map(field => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-slate-400 mb-2">{field.label}</label>
                  {field.type === 'textarea' ? (
                    <textarea value={formData[field.key] || ''} onChange={(e) => setFormData({...formData, [field.key]: e.target.value})} placeholder={field.placeholder} rows={3} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-blue-500 outline-none resize-none" />
                  ) : field.type === 'select' ? (
                    <select value={formData[field.key] || ''} onChange={(e) => setFormData({...formData, [field.key]: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none">
                      <option value="">Selecione...</option>
                      {field.options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  ) : (
                    <input type={field.type} value={formData[field.key] || ''} onChange={(e) => setFormData({...formData, [field.key]: e.target.value})} placeholder={field.placeholder} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-blue-500 outline-none" />
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3 p-5 border-t border-slate-800">
              <button onClick={() => setIsModalOpen(false)} className="btn-secondary flex-1" disabled={saving}>Cancelar</button>
              <button onClick={handleSave} className="btn-primary flex-1 flex items-center justify-center gap-2" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {editingItem ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
