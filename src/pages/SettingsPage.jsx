/**
 * SettingsPage - Configurações Unificadas (apenas Mentor)
 * VERSÃO 4.0 - Tab Compliance (Sistema Emocional v2), DebugBadge
 * 
 * CHANGELOG:
 * - 4.0: Tab Compliance (ComplianceConfigPage embedded), DebugBadge
 * - 3.0: Tab Tickers com UI hierárquica, filtro por bolsa, importar populares
 */
import { useState, useMemo } from 'react';
import { 
  Settings, TrendingUp, Building2, Landmark, DollarSign, Heart,
  Plus, Edit2, Trash2, X, Check, Loader2, AlertCircle, Shield,
  Database, RefreshCw, Zap, Search, Smile, BarChart3, Download,
  ChevronDown, Info
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useMasterData } from '../hooks/useMasterData';
import { useTrades } from '../hooks/useTrades';
import { runSeed, forceSeed, updateTickers } from '../utils/seedData';
import ComplianceConfigPage from './ComplianceConfigPage';
import DebugBadge from '../components/DebugBadge';

const TABS = [
  { id: 'setups', label: 'Setups', icon: TrendingUp, color: 'blue' },
  { id: 'exchanges', label: 'Bolsas', icon: Landmark, color: 'emerald' },
  { id: 'tickers', label: 'Tickers', icon: BarChart3, color: 'cyan' },
  { id: 'brokers', label: 'Corretoras', icon: Building2, color: 'purple' },
  { id: 'currencies', label: 'Moedas', icon: DollarSign, color: 'amber' },
  { id: 'emotions', label: 'Emoções', icon: Heart, color: 'rose' },
  { id: 'compliance', label: 'Compliance', icon: Shield, color: 'cyan' },
  { id: 'admin', label: 'Admin', icon: Database, color: 'slate' },
];

const EMOTION_CATEGORIES = [
  { value: 'positive', label: 'Positiva', color: 'emerald' },
  { value: 'neutral', label: 'Neutra', color: 'slate' },
  { value: 'negative', label: 'Negativa', color: 'red' },
];

const EMOJI_SUGGESTIONS = {
  positive: ['😎', '😌', '🎯', '💪', '✨', '🚀', '🔥', '👍', '😊', '🌟'],
  neutral: ['😐', '😶', '🤔', '😑', '🙂', '😏'],
  negative: ['😰', '😨', '🤑', '😴', '😤', '😱', '😡', '😢', '🥵', '🤯'],
};

/**
 * Tickers populares pré-definidos por exchange com specs de precificação.
 * P&L = (priceDiff / tickSize) * tickValue * quantity
 */
const POPULAR_TICKERS = {
  B3: [
    { symbol: 'WINFUT', name: 'Mini Índice Bovespa', tickSize: 5, tickValue: 1, minLot: 1 },
    { symbol: 'WDOFUT', name: 'Mini Dólar', tickSize: 0.5, tickValue: 10, minLot: 1 },
    { symbol: 'INDFUT', name: 'Índice Bovespa Cheio', tickSize: 5, tickValue: 5, minLot: 5 },
    { symbol: 'DOLFUT', name: 'Dólar Cheio', tickSize: 0.5, tickValue: 50, minLot: 5 },
    { symbol: 'PETR4', name: 'Petrobras PN', tickSize: 0.01, tickValue: 0.01, minLot: 100 },
    { symbol: 'VALE3', name: 'Vale ON', tickSize: 0.01, tickValue: 0.01, minLot: 100 },
    { symbol: 'ITUB4', name: 'Itaú Unibanco PN', tickSize: 0.01, tickValue: 0.01, minLot: 100 },
    { symbol: 'BBDC4', name: 'Bradesco PN', tickSize: 0.01, tickValue: 0.01, minLot: 100 },
    { symbol: 'BBAS3', name: 'Banco do Brasil ON', tickSize: 0.01, tickValue: 0.01, minLot: 100 },
    { symbol: 'ABEV3', name: 'Ambev ON', tickSize: 0.01, tickValue: 0.01, minLot: 100 },
    { symbol: 'MGLU3', name: 'Magazine Luiza ON', tickSize: 0.01, tickValue: 0.01, minLot: 100 },
    { symbol: 'RENT3', name: 'Localiza ON', tickSize: 0.01, tickValue: 0.01, minLot: 100 },
    { symbol: 'WEGE3', name: 'WEG ON', tickSize: 0.01, tickValue: 0.01, minLot: 100 },
    { symbol: 'B3SA3', name: 'B3 ON', tickSize: 0.01, tickValue: 0.01, minLot: 100 },
  ],
  CME: [
    { symbol: 'ES', name: 'E-mini S&P 500', tickSize: 0.25, tickValue: 12.50, minLot: 1 },
    { symbol: 'NQ', name: 'E-mini Nasdaq 100', tickSize: 0.25, tickValue: 5.00, minLot: 1 },
    { symbol: 'MES', name: 'Micro E-mini S&P 500', tickSize: 0.25, tickValue: 1.25, minLot: 1 },
    { symbol: 'MNQ', name: 'Micro E-mini Nasdaq 100', tickSize: 0.25, tickValue: 0.50, minLot: 1 },
    { symbol: 'YM', name: 'E-mini Dow Jones', tickSize: 1, tickValue: 5.00, minLot: 1 },
    { symbol: 'MYM', name: 'Micro E-mini Dow Jones', tickSize: 1, tickValue: 0.50, minLot: 1 },
    { symbol: 'RTY', name: 'E-mini Russell 2000', tickSize: 0.10, tickValue: 5.00, minLot: 1 },
    { symbol: 'CL', name: 'Crude Oil WTI', tickSize: 0.01, tickValue: 10.00, minLot: 1 },
    { symbol: 'MCL', name: 'Micro Crude Oil WTI', tickSize: 0.01, tickValue: 1.00, minLot: 1 },
    { symbol: 'GC', name: 'Gold', tickSize: 0.10, tickValue: 10.00, minLot: 1 },
    { symbol: 'MGC', name: 'Micro Gold', tickSize: 0.10, tickValue: 1.00, minLot: 1 },
    { symbol: 'SI', name: 'Silver', tickSize: 0.005, tickValue: 25.00, minLot: 1 },
    { symbol: 'ZB', name: 'U.S. Treasury Bond', tickSize: 0.03125, tickValue: 31.25, minLot: 1 },
    { symbol: 'ZN', name: '10-Year T-Note', tickSize: 0.015625, tickValue: 15.625, minLot: 1 },
    { symbol: 'NG', name: 'Natural Gas', tickSize: 0.001, tickValue: 10.00, minLot: 1 },
    { symbol: '6E', name: 'Euro FX', tickSize: 0.00005, tickValue: 6.25, minLot: 1 },
  ],
  NYSE: [
    { symbol: 'SPY', name: 'SPDR S&P 500 ETF', tickSize: 0.01, tickValue: 0.01, minLot: 1 },
    { symbol: 'QQQ', name: 'Invesco QQQ Trust', tickSize: 0.01, tickValue: 0.01, minLot: 1 },
    { symbol: 'AAPL', name: 'Apple Inc.', tickSize: 0.01, tickValue: 0.01, minLot: 1 },
    { symbol: 'MSFT', name: 'Microsoft Corp.', tickSize: 0.01, tickValue: 0.01, minLot: 1 },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', tickSize: 0.01, tickValue: 0.01, minLot: 1 },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', tickSize: 0.01, tickValue: 0.01, minLot: 1 },
    { symbol: 'TSLA', name: 'Tesla Inc.', tickSize: 0.01, tickValue: 0.01, minLot: 1 },
    { symbol: 'META', name: 'Meta Platforms Inc.', tickSize: 0.01, tickValue: 0.01, minLot: 1 },
  ],
  NASDAQ: [
    { symbol: 'GOOGL', name: 'Alphabet Inc.', tickSize: 0.01, tickValue: 0.01, minLot: 1 },
    { symbol: 'GOOG', name: 'Alphabet Inc. Class C', tickSize: 0.01, tickValue: 0.01, minLot: 1 },
    { symbol: 'AMD', name: 'Advanced Micro Devices', tickSize: 0.01, tickValue: 0.01, minLot: 1 },
    { symbol: 'INTC', name: 'Intel Corp.', tickSize: 0.01, tickValue: 0.01, minLot: 1 },
  ],
};


const SettingsPage = () => {
  const { user, isMentor } = useAuth();
  const { trades } = useTrades();
  const { 
    setups, exchanges, brokers, currencies, emotions, tickers, loading,
    addSetup, updateSetup, deleteSetup,
    addExchange, updateExchange, deleteExchange,
    addBroker, updateBroker, deleteBroker,
    addCurrency, updateCurrency, deleteCurrency,
    addEmotion, updateEmotion, deleteEmotion,
    addTicker, updateTicker, deleteTicker, importTickers,
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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // State específico de Tickers
  const [tickerExchangeFilter, setTickerExchangeFilter] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importSelection, setImportSelection] = useState({});
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

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

  // ==================== DATA LOGIC ====================

  const checkUsage = (type, item) => {
    if (!trades) return 0;
    switch (type) {
      case 'setups': return trades.filter(t => t.setup === item.name).length;
      case 'exchanges': return trades.filter(t => t.exchange === item.code).length;
      case 'emotions': return trades.filter(t => 
        t.emotion === item.name || t.emotionEntry === item.name || t.emotionExit === item.name
      ).length;
      case 'tickers': return trades.filter(t => t.ticker === item.symbol).length;
      default: return 0;
    }
  };

  const getTabData = () => {
    let data = [];
    switch (activeTab) {
      case 'setups': data = setups; break;
      case 'exchanges': data = exchanges; break;
      case 'tickers': 
        data = tickers;
        if (tickerExchangeFilter) {
          data = data.filter(t => t.exchange === tickerExchangeFilter);
        }
        break;
      case 'brokers': data = brokers; break;
      case 'currencies': data = currencies; break;
      case 'emotions': data = emotions; break;
      default: return [];
    }
    if (!searchTerm) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(item => 
      (item.name || '').toLowerCase().includes(term) ||
      (item.code || '').toLowerCase().includes(term) ||
      (item.symbol || '').toLowerCase().includes(term)
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
      case 'tickers': return [
        { key: 'symbol', label: 'Símbolo *', type: 'text', placeholder: 'Ex: WINFUT' },
        { key: 'name', label: 'Nome *', type: 'text', placeholder: 'Ex: Mini Índice Bovespa' },
        { key: 'exchange', label: 'Bolsa *', type: 'exchangeSelect' },
        { key: 'tickSize', label: 'Tick Size', type: 'number', placeholder: 'Ex: 5' },
        { key: 'tickValue', label: 'Tick Value (R$/US$)', type: 'number', placeholder: 'Ex: 1.00' },
        { key: 'minLot', label: 'Lote Mínimo', type: 'number', placeholder: 'Ex: 1' },
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
        { key: 'emoji', label: 'Emoji *', type: 'emoji', placeholder: '😎' },
        { key: 'category', label: 'Categoria *', type: 'select', options: EMOTION_CATEGORIES },
      ];
      default: return [];
    }
  };

  // ==================== HANDLERS ====================

  const openModal = (item = null) => {
    setEditingItem(item);
    if (item) {
      setFormData({ ...item });
    } else {
      const defaults = {};
      if (activeTab === 'tickers') {
        defaults.exchange = tickerExchangeFilter || (exchanges[0]?.code || '');
        defaults.minLot = '1';
      }
      setFormData(defaults);
    }
    setError(null);
    setShowEmojiPicker(false);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    const fields = getFormFields();
    for (const f of fields.filter(f => f.label.includes('*'))) {
      const value = formData[f.key];
      if (typeof value === 'string' && !value.trim()) {
        setError(`Campo "${f.label.replace(' *', '')}" é obrigatório`);
        return;
      }
      if (value === undefined || value === null || value === '') {
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
        tickers: { add: addTicker, update: updateTicker },
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
      alert(`Não é possível excluir: "${item.name || item.symbol || item.code}" está sendo usado em ${usage} trade(s).`);
      return;
    }
    let confirmMsg = `Excluir "${item.name || item.symbol || item.code}"?`;
    if (activeTab === 'exchanges') {
      const linkedTickers = tickers.filter(t => t.exchange === item.code);
      if (linkedTickers.length > 0) {
        confirmMsg = `Excluir a bolsa "${item.code}"?\n\nATENÇÃO: ${linkedTickers.length} ticker(s) vinculado(s) serão desativados:\n${linkedTickers.map(t => t.symbol).join(', ')}`;
      }
    }
    if (!window.confirm(confirmMsg)) return;
    try {
      const actions = {
        setups: deleteSetup, exchanges: deleteExchange, tickers: deleteTicker,
        brokers: deleteBroker, currencies: deleteCurrency, emotions: deleteEmotion,
      };
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

  // ==================== IMPORT POPULARES ====================

  const openImportModal = () => {
    const exchangeCode = tickerExchangeFilter || (exchanges[0]?.code || 'B3');
    const available = POPULAR_TICKERS[exchangeCode] || [];
    const selection = {};
    available.forEach(t => {
      const exists = tickers.find(existing => 
        existing.symbol.toUpperCase() === t.symbol.toUpperCase() && 
        existing.exchange === exchangeCode
      );
      selection[t.symbol] = !exists;
    });
    setImportSelection(selection);
    setImportResult(null);
    setShowImportModal(true);
  };

  const handleImport = async () => {
    const exchangeCode = tickerExchangeFilter || (exchanges[0]?.code || 'B3');
    const available = POPULAR_TICKERS[exchangeCode] || [];
    const toImport = available
      .filter(t => importSelection[t.symbol])
      .map(t => ({ ...t, exchange: exchangeCode }));
    if (toImport.length === 0) {
      setImportResult({ success: false, message: 'Nenhum ticker selecionado' });
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const result = await importTickers(toImport);
      setImportResult({ 
        success: true, 
        message: `${result.imported} ticker(s) importado(s), ${result.skipped} já existente(s).` 
      });
      setTimeout(() => setShowImportModal(false), 2000);
    } catch (err) {
      setImportResult({ success: false, message: err.message });
    } finally {
      setImporting(false);
    }
  };

  const toggleImportSelection = (symbol) => {
    setImportSelection(prev => ({ ...prev, [symbol]: !prev[symbol] }));
  };

  const toggleAllImport = (selectAll) => {
    const exchangeCode = tickerExchangeFilter || (exchanges[0]?.code || 'B3');
    const available = POPULAR_TICKERS[exchangeCode] || [];
    const selection = {};
    available.forEach(t => { selection[t.symbol] = selectAll; });
    setImportSelection(selection);
  };


  // ==================== RENDER ITEM ====================

  const renderItem = (item) => {
    switch (activeTab) {
      case 'setups':
        return (
          <div className="flex-1">
            <p className="font-medium text-white">{item.name}</p>
            {item.description && <p className="text-sm text-slate-500 truncate">{item.description}</p>}
          </div>
        );
      case 'exchanges': {
        const tickerCount = tickers.filter(t => t.exchange === item.code).length;
        return (
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <p className="font-medium text-white">{item.code}</p>
              <span className="text-slate-500">-</span>
              <p className="text-slate-400">{item.name}</p>
            </div>
            <div className="flex items-center gap-3 mt-1">
              {item.country && <span className="text-xs text-slate-500">{item.country}</span>}
              {tickerCount > 0 && (
                <span className="text-xs text-cyan-400/70 bg-cyan-500/10 px-2 py-0.5 rounded">
                  {tickerCount} ticker{tickerCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        );
      }
      case 'tickers':
        return (
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <span className="font-mono font-bold text-white text-sm bg-slate-800 px-2 py-0.5 rounded">
                {item.symbol}
              </span>
              <p className="text-slate-400 text-sm">{item.name}</p>
              <span className="text-xs text-cyan-400/60 bg-cyan-500/10 px-1.5 py-0.5 rounded">
                {item.exchange}
              </span>
            </div>
            {item.tickSize && (
              <div className="flex items-center gap-4 mt-1.5">
                <span className="text-[11px] text-slate-500">
                  Tick: <span className="text-slate-400">{item.tickSize}</span>
                </span>
                <span className="text-[11px] text-slate-500">
                  Valor: <span className="text-emerald-400">{item.exchange === 'B3' ? 'R$' : '$'}{item.tickValue}</span>
                </span>
                <span className="text-[11px] text-slate-500">
                  Lote Mín: <span className="text-slate-400">{item.minLot || 1}</span>
                </span>
                {item.tickSize && item.tickValue && (
                  <span className="text-[11px] text-amber-400/60" title="Valor de 1 ponto inteiro">
                    1pt = {item.exchange === 'B3' ? 'R$' : '$'}{((1 / item.tickSize) * item.tickValue).toFixed(2)}
                  </span>
                )}
              </div>
            )}
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
      case 'emotions': {
        const cat = EMOTION_CATEGORIES.find(c => c.value === item.category);
        return (
          <div className="flex items-center gap-3 flex-1">
            <span className="text-3xl leading-none" title={item.name}>
              {item.emoji || '❓'}
            </span>
            <div className="flex-1">
              <p className="font-medium text-white">{item.name}</p>
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold mt-1 bg-${cat?.color || 'slate'}-500/20 text-${cat?.color || 'slate'}-400`}>
                {cat?.label || 'N/A'}
              </span>
            </div>
          </div>
        );
      }
      default:
        return <p className="text-white flex-1">{item.name || item.code || item.symbol}</p>;
    }
  };

  // ==================== COMPUTED ====================

  const tabData = getTabData();
  const activeTabConfig = TABS.find(t => t.id === activeTab);
  const suggestedEmojis = formData.category ? EMOJI_SUGGESTIONS[formData.category] || [] : [];
  const importExchangeCode = tickerExchangeFilter || (exchanges[0]?.code || 'B3');
  const importAvailable = POPULAR_TICKERS[importExchangeCode] || [];
  const importSelectedCount = Object.values(importSelection).filter(Boolean).length;


  // ==================== JSX RENDER ====================

  return (
    <div className="min-h-screen p-6 lg:p-8">
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
            onClick={() => { setActiveTab(tab.id); setSearchTerm(''); setTickerExchangeFilter(''); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? `bg-${tab.color}-500/20 text-${tab.color}-400 border border-${tab.color}-500/30`
                : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-white border border-transparent'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.id === 'tickers' && tickers.length > 0 && (
              <span className="text-xs bg-slate-700/50 px-1.5 py-0.5 rounded-full ml-1">{tickers.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ====== COMPLIANCE CONFIG ====== */}
      {activeTab === 'compliance' ? (
        <ComplianceConfigPage embedded={true} />
      ) : activeTab === 'admin' ? (
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
        /* ====== CRUD PANEL ====== */
        <div className="glass-card">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border-b border-slate-800 gap-3">
            <div className="flex items-center gap-4 flex-wrap">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <activeTabConfig.icon className={`w-5 h-5 text-${activeTabConfig.color}-400`} />
                {activeTabConfig.label}
                <span className="text-sm font-normal text-slate-500">({tabData.length})</span>
              </h2>
              {/* Filtro de Exchange (tab tickers) */}
              {activeTab === 'tickers' && exchanges.length > 0 && (
                <div className="relative">
                  <select
                    value={tickerExchangeFilter}
                    onChange={(e) => setTickerExchangeFilter(e.target.value)}
                    className="bg-slate-800/80 border border-slate-700 rounded-lg pl-3 pr-8 py-1.5 text-sm text-white focus:border-cyan-500 outline-none appearance-none cursor-pointer"
                  >
                    <option value="">Todas as Bolsas</option>
                    {exchanges.map(ex => (
                      <option key={ex.id} value={ex.code}>{ex.code} - {ex.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                </div>
              )}
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input type="text" placeholder="Buscar..." value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-slate-800/50 border border-slate-700 rounded-lg pl-9 pr-4 py-1.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 outline-none w-48"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              {activeTab === 'tickers' && (
                <button onClick={openImportModal} 
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-xl transition-all">
                  <Download className="w-4 h-4" />
                  Importar Populares
                </button>
              )}
              <button onClick={() => openModal()} className="btn-primary py-2 px-4">
                <Plus className="w-4 h-4 mr-2" />Adicionar
              </button>
            </div>
          </div>

          {/* Info banner tickers vazios */}
          {activeTab === 'tickers' && tabData.length === 0 && !searchTerm && (
            <div className="m-4 p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-xl flex items-start gap-3">
              <Info className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-cyan-300 font-medium">Nenhum ticker cadastrado{tickerExchangeFilter ? ` para ${tickerExchangeFilter}` : ''}</p>
                <p className="text-xs text-slate-400 mt-1">
                  Use "Importar Populares" para adicionar contratos com specs de precificação, ou adicione manualmente.
                </p>
              </div>
            </div>
          )}

          {/* List */}
          <div className="max-h-[500px] overflow-y-auto">
            {loading ? (
              <div className="text-center py-12"><Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" /></div>
            ) : tabData.length === 0 && (searchTerm || activeTab !== 'tickers') ? (
              <div className="text-center py-12 text-slate-500">{searchTerm ? 'Nenhum resultado' : 'Nenhum item'}</div>
            ) : tabData.length > 0 ? (
              <div className="divide-y divide-slate-800">
                {tabData.map(item => {
                  const usage = checkUsage(activeTab, item);
                  return (
                    <div key={item.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-800/50 transition-colors group">
                      {renderItem(item)}
                      <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                        {usage > 0 && (
                          <span className="text-xs text-slate-600">{usage} trade{usage > 1 ? 's' : ''}</span>
                        )}
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openModal(item)} className="p-2 hover:bg-blue-500/20 rounded-lg text-blue-400" title="Editar">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(item)} 
                            className={`p-2 rounded-lg ${usage > 0 ? 'text-slate-600 cursor-not-allowed' : 'hover:bg-red-500/20 text-red-400'}`}
                            title={usage > 0 ? 'Em uso' : 'Excluir'} disabled={usage > 0}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      )}


      {/* ====== MODAL CRUD (genérico) ====== */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-800 flex-shrink-0">
              <h3 className="text-lg font-bold text-white">
                {editingItem ? 'Editar' : 'Novo'} {activeTab === 'tickers' ? 'Ticker' : activeTabConfig.label.slice(0, -1)}
              </h3>
              <button onClick={() => setIsModalOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-white" /></button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span className="text-sm text-red-400">{error}</span>
                </div>
              )}
              
              {getFormFields().map(field => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-slate-400 mb-2">{field.label}</label>
                  
                  {field.type === 'exchangeSelect' ? (
                    <select 
                      value={formData[field.key] || ''} 
                      onChange={(e) => setFormData({...formData, [field.key]: e.target.value})} 
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-cyan-500 outline-none"
                    >
                      <option value="">Selecione a bolsa...</option>
                      {exchanges.map(ex => (
                        <option key={ex.id} value={ex.code}>{ex.code} - {ex.name}</option>
                      ))}
                    </select>
                  ) : field.type === 'emoji' ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <input 
                          type="text" 
                          value={formData[field.key] || ''} 
                          onChange={(e) => setFormData({...formData, [field.key]: e.target.value})} 
                          placeholder={field.placeholder}
                          maxLength={2}
                          className="w-20 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-center text-3xl focus:border-rose-500 outline-none"
                        />
                        <div className="flex-1 bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 flex items-center gap-3">
                          <span className="text-2xl">{formData[field.key] || '❓'}</span>
                          <span className="text-white font-medium">{formData.name || 'Preview'}</span>
                        </div>
                      </div>
                      {suggestedEmojis.length > 0 && (
                        <div>
                          <p className="text-xs text-slate-500 mb-2">Sugestões:</p>
                          <div className="flex flex-wrap gap-2">
                            {suggestedEmojis.map((emoji, idx) => (
                              <button key={idx} type="button"
                                onClick={() => setFormData({...formData, [field.key]: emoji})}
                                className="w-10 h-10 flex items-center justify-center text-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-rose-500/50 rounded-lg transition-all"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : field.type === 'textarea' ? (
                    <textarea value={formData[field.key] || ''} onChange={(e) => setFormData({...formData, [field.key]: e.target.value})} placeholder={field.placeholder} rows={3} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-blue-500 outline-none resize-none" />
                  ) : field.type === 'select' ? (
                    <select value={formData[field.key] || ''} onChange={(e) => setFormData({...formData, [field.key]: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none">
                      <option value="">Selecione...</option>
                      {field.options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  ) : field.type === 'number' ? (
                    <input type="number" step="any" value={formData[field.key] || ''} onChange={(e) => setFormData({...formData, [field.key]: e.target.value})} placeholder={field.placeholder} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-blue-500 outline-none" />
                  ) : (
                    <input type={field.type} value={formData[field.key] || ''} onChange={(e) => setFormData({...formData, [field.key]: e.target.value})} placeholder={field.placeholder} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-blue-500 outline-none" />
                  )}
                </div>
              ))}

              {/* Info de precificação para tickers */}
              {activeTab === 'tickers' && formData.tickSize && formData.tickValue && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
                  <p className="text-xs text-slate-500 mb-1">Preview de cálculo:</p>
                  <p className="text-sm text-slate-300">
                    1 tick = <span className="text-emerald-400 font-medium">{formData.exchange === 'B3' ? 'R$' : '$'}{parseFloat(formData.tickValue || 0).toFixed(2)}</span>
                    {' '}| 1 ponto = <span className="text-amber-400 font-medium">
                      {formData.exchange === 'B3' ? 'R$' : '$'}{((1 / parseFloat(formData.tickSize || 1)) * parseFloat(formData.tickValue || 0)).toFixed(2)}
                    </span>
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 p-5 border-t border-slate-800 flex-shrink-0">
              <button onClick={() => setIsModalOpen(false)} className="btn-secondary flex-1" disabled={saving}>Cancelar</button>
              <button onClick={handleSave} className="btn-primary flex-1 flex items-center justify-center gap-2" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {editingItem ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== MODAL IMPORTAR POPULARES ====== */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-800 flex-shrink-0">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Download className="w-5 h-5 text-cyan-400" />
                  Importar Tickers - {importExchangeCode}
                </h3>
                <p className="text-xs text-slate-500 mt-1">Selecione os tickers para importar com specs de precificação</p>
              </div>
              <button onClick={() => setShowImportModal(false)}><X className="w-5 h-5 text-slate-400 hover:text-white" /></button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Controles */}
              <div className="sticky top-0 bg-slate-900 px-5 py-3 border-b border-slate-800/50 flex items-center justify-between">
                <span className="text-sm text-slate-400">{importSelectedCount} de {importAvailable.length} selecionados</span>
                <div className="flex gap-2">
                  <button onClick={() => toggleAllImport(true)} className="text-xs text-cyan-400 hover:text-cyan-300 px-2 py-1 bg-cyan-500/10 rounded">
                    Selecionar Todos
                  </button>
                  <button onClick={() => toggleAllImport(false)} className="text-xs text-slate-400 hover:text-slate-300 px-2 py-1 bg-slate-800 rounded">
                    Limpar
                  </button>
                </div>
              </div>

              {/* Lista de tickers */}
              <div className="divide-y divide-slate-800/50">
                {importAvailable.map(ticker => {
                  const exists = tickers.find(existing => 
                    existing.symbol.toUpperCase() === ticker.symbol.toUpperCase() && 
                    existing.exchange === importExchangeCode
                  );
                  const isSelected = importSelection[ticker.symbol];
                  return (
                    <div 
                      key={ticker.symbol} 
                      onClick={() => !exists && toggleImportSelection(ticker.symbol)}
                      className={`px-5 py-3 flex items-center gap-4 transition-colors ${
                        exists 
                          ? 'opacity-40 cursor-not-allowed' 
                          : 'cursor-pointer hover:bg-slate-800/50'
                      }`}
                    >
                      {/* Checkbox */}
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        exists ? 'border-slate-600 bg-slate-700' :
                        isSelected ? 'border-cyan-500 bg-cyan-500' : 'border-slate-600'
                      }`}>
                        {(isSelected || exists) && <Check className="w-3 h-3 text-white" />}
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white text-sm">{ticker.symbol}</span>
                          <span className="text-slate-400 text-sm truncate">{ticker.name}</span>
                          {exists && <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">já existe</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[11px] text-slate-500">Tick: {ticker.tickSize}</span>
                          <span className="text-[11px] text-emerald-400/70">Val: {importExchangeCode === 'B3' ? 'R$' : '$'}{ticker.tickValue}</span>
                          <span className="text-[11px] text-slate-500">Lote: {ticker.minLot}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {importAvailable.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  Nenhum ticker popular disponível para {importExchangeCode}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 p-5 border-t border-slate-800">
              {importResult && (
                <div className={`mb-3 p-3 rounded-xl text-sm flex items-center gap-2 ${
                  importResult.success ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'
                }`}>
                  {importResult.success ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {importResult.message}
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setShowImportModal(false)} className="btn-secondary flex-1" disabled={importing}>Cancelar</button>
                <button onClick={handleImport} disabled={importing || importSelectedCount === 0} 
                  className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Importar ({importSelectedCount})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <DebugBadge component="SettingsPage" />
    </div>
  );
};

export default SettingsPage;
