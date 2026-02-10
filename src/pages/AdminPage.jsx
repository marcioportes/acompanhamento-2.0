import { useState } from 'react';
import { 
  Database, 
  Shield, 
  Settings, 
  List
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { runSeed, forceSeed, updateTickers } from '../utils/seedData';
import TickerManager from './admin/TickerManager'; // Certifique-se de criar a pasta admin

const AdminPage = () => {
  const { user, isMentor } = useAuth();
  const [activeTab, setActiveTab] = useState('tickers');
  
  // States para as ferramentas de sistema (Seed)
  const [sysLoading, setSysLoading] = useState(null);
  const [sysResult, setSysResult] = useState(null);

  // Apenas mentor pode acessar
  if (!isMentor()) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Acesso Negado</h1>
          <p className="text-slate-400">Apenas o mentor pode acessar esta página.</p>
        </div>
      </div>
    );
  }

  // Wrappers para as funções de seed existentes
  const handleSystemAction = async (actionType, actionFn) => {
    if (actionType === 'force' && !window.confirm('Cuidado! Isso pode sobrescrever dados. Continuar?')) return;
    
    setSysLoading(actionType);
    setSysResult(null);
    try {
      const res = await actionFn();
      setSysResult(res);
    } catch (err) {
      setSysResult({ success: false, message: err.message });
    } finally {
      setSysLoading(null);
    }
  };

  return (
    <div className="min-h-screen p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-white flex items-center gap-3">
              <Settings className="w-8 h-8 text-blue-400" />
              Administração
            </h1>
            <p className="text-slate-400 mt-1">
              Configurações globais e master data
            </p>
          </div>
          <div className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs text-blue-400">
             Mentor: {user.email}
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="flex border-b border-slate-800 mb-8">
          <button
            onClick={() => setActiveTab('tickers')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'tickers'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            <List className="w-4 h-4" />
            Ativos & Lotes
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'system'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            <Database className="w-4 h-4" />
            Sistema & Seeds
          </button>
        </div>

        {/* Conteúdo da Aba */}
        <div className="min-h-[400px]">
          
          {/* ABA 1: GERENCIADOR DE TICKERS */}
          {activeTab === 'tickers' && (
            <TickerManager />
          )}

          {/* ABA 2: SISTEMA (ANTIGO ADMIN) */}
          {activeTab === 'system' && (
             <div className="space-y-6">
                {sysResult && (
                  <div className={`p-4 rounded-xl border ${sysResult.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                    {sysResult.message}
                  </div>
                )}
                
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Seed Normal */}
                  <div className="glass-card p-6">
                    <h3 className="text-lg font-bold text-white mb-2">Seed Inicial</h3>
                    <p className="text-sm text-slate-400 mb-4">Popula dados básicos se o banco estiver vazio.</p>
                    <button 
                      onClick={() => handleSystemAction('seed', runSeed)}
                      disabled={sysLoading !== null}
                      className="btn-secondary w-full"
                    >
                      {sysLoading === 'seed' ? 'Executando...' : 'Executar Seed'}
                    </button>
                  </div>

                  {/* Seed Forçado */}
                  <div className="glass-card p-6 border-red-500/20">
                    <h3 className="text-lg font-bold text-red-400 mb-2">Forçar Reset</h3>
                    <p className="text-sm text-slate-400 mb-4">Sobrescreve dados mestres. Use com cuidado.</p>
                    <button 
                      onClick={() => handleSystemAction('force', forceSeed)}
                      disabled={sysLoading !== null}
                      className="btn-primary bg-red-600 hover:bg-red-700 w-full border-none"
                    >
                      {sysLoading === 'force' ? 'Resetando...' : 'Forçar Reset'}
                    </button>
                  </div>
                </div>
             </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default AdminPage;