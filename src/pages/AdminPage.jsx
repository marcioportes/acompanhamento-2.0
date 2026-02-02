/**
 * Página de Administração - Apenas para Mentor
 * Permite rodar seed e outras tarefas administrativas
 */

import { useState } from 'react';
import { 
  Database, 
  RefreshCw, 
  Check, 
  AlertCircle, 
  Loader2,
  Shield,
  Zap
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { runSeed, forceSeed, updateTickers } from '../utils/seedData';

const AdminPage = () => {
  const { user, isMentor } = useAuth();
  const [loading, setLoading] = useState(null);
  const [result, setResult] = useState(null);

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

  const handleRunSeed = async () => {
    setLoading('seed');
    setResult(null);
    try {
      const res = await runSeed();
      setResult(res);
    } catch (err) {
      setResult({ success: false, message: err.message });
    } finally {
      setLoading(null);
    }
  };

  const handleForceSeed = async () => {
    if (!window.confirm('Isso vai sobrescrever dados existentes. Continuar?')) return;
    
    setLoading('force');
    setResult(null);
    try {
      const res = await forceSeed();
      setResult(res);
    } catch (err) {
      setResult({ success: false, message: err.message });
    } finally {
      setLoading(null);
    }
  };

  const handleUpdateTickers = async () => {
    setLoading('tickers');
    setResult(null);
    try {
      const res = await updateTickers();
      setResult(res);
    } catch (err) {
      setResult({ success: false, message: err.message });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-display font-bold text-white flex items-center gap-3">
            <Database className="w-8 h-8 text-blue-400" />
            Administração
          </h1>
          <p className="text-slate-400 mt-1">
            Ferramentas administrativas do sistema
          </p>
        </div>

        {/* Result */}
        {result && (
          <div className={`mb-6 p-4 rounded-xl border ${
            result.success 
              ? 'bg-emerald-500/10 border-emerald-500/30' 
              : 'bg-red-500/10 border-red-500/30'
          }`}>
            <div className="flex items-center gap-3">
              {result.success ? (
                <Check className="w-5 h-5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-400" />
              )}
              <span className={result.success ? 'text-emerald-400' : 'text-red-400'}>
                {result.message}
              </span>
            </div>
          </div>
        )}

        {/* Cards */}
        <div className="space-y-4">
          {/* Seed Inicial */}
          <div className="glass-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">
                  Seed Inicial
                </h3>
                <p className="text-sm text-slate-400">
                  Popula dados iniciais (moedas, corretoras, tickers, setups, emoções).
                  Só executa se o banco estiver vazio.
                </p>
              </div>
              <button
                onClick={handleRunSeed}
                disabled={loading !== null}
                className="btn-primary py-2 px-4"
              >
                {loading === 'seed' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Database className="w-4 h-4 mr-2" />
                    Executar
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Forçar Seed */}
          <div className="glass-card p-6 border-yellow-500/30">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-yellow-400 mb-1">
                  Forçar Seed
                </h3>
                <p className="text-sm text-slate-400">
                  Força a execução do seed mesmo com dados existentes.
                  <span className="text-yellow-400"> Cuidado: pode sobrescrever dados!</span>
                </p>
              </div>
              <button
                onClick={handleForceSeed}
                disabled={loading !== null}
                className="btn-secondary py-2 px-4 border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
              >
                {loading === 'force' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Forçar
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Atualizar Tickers */}
          <div className="glass-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">
                  Atualizar Tickers
                </h3>
                <p className="text-sm text-slate-400">
                  Atualiza apenas os tickers com as especificações corretas de tick
                  (WINFUT, ES, NQ, etc).
                </p>
              </div>
              <button
                onClick={handleUpdateTickers}
                disabled={loading !== null}
                className="btn-primary py-2 px-4"
              >
                {loading === 'tickers' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Atualizar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="mt-8 p-4 bg-slate-800/50 rounded-xl">
          <p className="text-sm text-slate-400">
            <strong className="text-white">Logado como:</strong> {user?.email}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
