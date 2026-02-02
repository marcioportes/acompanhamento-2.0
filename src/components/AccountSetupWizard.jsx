/**
 * AccountSetupWizard - Wizard para configuração inicial do aluno
 * 
 * Fluxo:
 * 1. Criar Conta (nome, corretora, tipo, moeda, saldo inicial)
 * 2. Criar Plano (setup default + regras de risco)
 * 
 * O wizard aparece quando aluno não possui conta
 */

import { useState, useEffect } from 'react';
import { 
  Wallet, 
  TrendingUp, 
  ChevronRight, 
  ChevronLeft,
  Check,
  Loader2,
  AlertCircle,
  Building2,
  DollarSign,
  Target,
  Shield,
  Settings
} from 'lucide-react';
import { useAccounts } from '../hooks/useAccounts';
import { usePlans } from '../hooks/usePlans';
import { useMasterData } from '../hooks/useMasterData';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

const AccountSetupWizard = ({ onComplete }) => {
  const { user } = useAuth();
  const { addAccount } = useAccounts();
  const { addPlan } = usePlans();
  const { currencies, brokers, loading: masterLoading } = useMasterData();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [defaultSetup, setDefaultSetup] = useState(null);
  
  // Dados do formulário
  const [accountData, setAccountData] = useState({
    name: '',
    brokerId: '',
    brokerName: '',
    currencyCode: 'BRL',
    type: 'DEMO',
    initialBalance: ''
  });
  
  const [planData, setPlanData] = useState({
    maxRiskPercent: 2,
    minRiskReward: 2,
    maxDailyLossPercent: 5,
    targetPercent: 10
  });

  // Buscar setup default
  useEffect(() => {
    const fetchDefaultSetup = async () => {
      try {
        const setupsQuery = query(
          collection(db, 'setups'),
          where('isDefault', '==', true),
          where('isGlobal', '==', true)
        );
        const snapshot = await getDocs(setupsQuery);
        
        if (!snapshot.empty) {
          const setup = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
          setDefaultSetup(setup);
        } else {
          // Se não tiver default, pegar o primeiro setup global
          const allSetupsQuery = query(
            collection(db, 'setups'),
            where('isGlobal', '==', true)
          );
          const allSnapshot = await getDocs(allSetupsQuery);
          if (!allSnapshot.empty) {
            const setup = { id: allSnapshot.docs[0].id, ...allSnapshot.docs[0].data() };
            setDefaultSetup(setup);
          }
        }
      } catch (err) {
        console.error('Erro ao buscar setup default:', err);
      }
    };
    
    fetchDefaultSetup();
  }, []);

  const handleAccountChange = (field, value) => {
    setAccountData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Se mudou o broker, salvar também o nome
      if (field === 'brokerId') {
        const broker = brokers.find(b => b.id === value);
        updated.brokerName = broker?.name || '';
      }
      
      return updated;
    });
  };

  const handlePlanChange = (field, value) => {
    setPlanData(prev => ({ ...prev, [field]: parseFloat(value) || 0 }));
  };

  const validateStep1 = () => {
    if (!accountData.name.trim()) {
      setError('Informe um nome para a conta');
      return false;
    }
    if (!accountData.brokerId) {
      setError('Selecione uma corretora');
      return false;
    }
    if (!accountData.initialBalance || parseFloat(accountData.initialBalance) <= 0) {
      setError('Informe o saldo inicial');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (planData.maxRiskPercent <= 0 || planData.maxRiskPercent > 100) {
      setError('Risco máximo deve ser entre 0,1% e 100%');
      return false;
    }
    if (planData.minRiskReward < 0.5) {
      setError('R:R mínimo deve ser pelo menos 0,5');
      return false;
    }
    return true;
  };

  const nextStep = () => {
    setError(null);
    
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    
    setStep(prev => prev + 1);
  };

  const prevStep = () => {
    setError(null);
    setStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    
    try {
      // 1. Criar conta
      const currency = currencies.find(c => c.code === accountData.currencyCode);
      
      const accountId = await addAccount({
        name: accountData.name,
        brokerId: accountData.brokerId,
        brokerName: accountData.brokerName,
        currencyId: currency?.id || accountData.currencyCode,
        currencyCode: accountData.currencyCode,
        currencySymbol: currency?.symbol || 'R$',
        type: accountData.type,
        initialBalance: parseFloat(accountData.initialBalance),
        active: true
      });
      
      console.log('Conta criada:', accountId);
      
      // 2. Criar plano com setup default
      if (defaultSetup) {
        await addPlan({
          setupId: defaultSetup.id,
          setupName: defaultSetup.name,
          accountId: accountId,
          maxRiskPercent: planData.maxRiskPercent,
          minRiskReward: planData.minRiskReward,
          maxDailyLossPercent: planData.maxDailyLossPercent,
          targetPercent: planData.targetPercent,
          blockedEmotions: ['Revenge', 'FOMO', 'Overtrading'], // Padrão
          active: true
        });
        
        console.log('Plano criado com setup:', defaultSetup.name);
      }
      
      // 3. Callback de conclusão
      if (onComplete) {
        onComplete(accountId);
      }
      
    } catch (err) {
      console.error('Erro ao criar conta/plano:', err);
      setError('Erro ao configurar conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (masterLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <Wallet className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-display font-bold text-white mb-2">
          Bem-vindo ao Journal! 🎉
        </h1>
        <p className="text-slate-400">
          Vamos configurar sua conta de trading em poucos passos
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-4 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
              s < step ? 'bg-emerald-500 text-white' :
              s === step ? 'bg-blue-500 text-white' :
              'bg-slate-700 text-slate-400'
            }`}>
              {s < step ? <Check className="w-5 h-5" /> : s}
            </div>
            {s < 3 && (
              <div className={`w-12 h-1 mx-2 rounded ${
                s < step ? 'bg-emerald-500' : 'bg-slate-700'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Labels */}
      <div className="flex justify-between mb-8 px-4">
        <span className={`text-sm ${step >= 1 ? 'text-blue-400' : 'text-slate-500'}`}>Conta</span>
        <span className={`text-sm ${step >= 2 ? 'text-blue-400' : 'text-slate-500'}`}>Plano</span>
        <span className={`text-sm ${step >= 3 ? 'text-blue-400' : 'text-slate-500'}`}>Confirmar</span>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <span className="text-red-400 text-sm">{error}</span>
        </div>
      )}

      {/* Step 1: Criar Conta */}
      {step === 1 && (
        <div className="glass-card p-6 space-y-6">
          <div className="flex items-center gap-3 mb-4">
            <Building2 className="w-6 h-6 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Dados da Conta</h2>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Nome da Conta *
            </label>
            <input
              type="text"
              value={accountData.name}
              onChange={(e) => handleAccountChange('name', e.target.value)}
              placeholder="Ex: Conta Demo Apex"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Corretora *
            </label>
            <select
              value={accountData.brokerId}
              onChange={(e) => handleAccountChange('brokerId', e.target.value)}
              className="w-full"
            >
              <option value="">Selecione...</option>
              {brokers.map(broker => (
                <option key={broker.id} value={broker.id}>
                  {broker.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Tipo de Conta
              </label>
              <select
                value={accountData.type}
                onChange={(e) => handleAccountChange('type', e.target.value)}
                className="w-full"
              >
                <option value="DEMO">Demo</option>
                <option value="PROP">Mesa Proprietária</option>
                <option value="REAL">Conta Real</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Moeda
              </label>
              <select
                value={accountData.currencyCode}
                onChange={(e) => handleAccountChange('currencyCode', e.target.value)}
                className="w-full"
              >
                {currencies.map(curr => (
                  <option key={curr.code} value={curr.code}>
                    {curr.symbol} {curr.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              <DollarSign className="w-4 h-4 inline mr-1" />
              Saldo Inicial *
            </label>
            <input
              type="number"
              value={accountData.initialBalance}
              onChange={(e) => handleAccountChange('initialBalance', e.target.value)}
              placeholder="Ex: 50000"
              min="0"
              step="0.01"
              className="w-full"
            />
            <p className="text-xs text-slate-500 mt-1">
              Este valor será registrado como depósito inicial
            </p>
          </div>
        </div>
      )}

      {/* Step 2: Configurar Plano */}
      {step === 2 && (
        <div className="glass-card p-6 space-y-6">
          <div className="flex items-center gap-3 mb-4">
            <Target className="w-6 h-6 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Regras de Risco</h2>
          </div>

          {defaultSetup && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-4">
              <p className="text-sm text-blue-400">
                <TrendingUp className="w-4 h-4 inline mr-2" />
                Setup: <strong>{defaultSetup.name}</strong>
              </p>
              <p className="text-xs text-slate-500 mt-1">{defaultSetup.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                <Shield className="w-4 h-4 inline mr-1" />
                Risco Máximo por Trade (%)
              </label>
              <input
                type="number"
                value={planData.maxRiskPercent}
                onChange={(e) => handlePlanChange('maxRiskPercent', e.target.value)}
                min="0.1"
                max="100"
                step="0.1"
                className="w-full"
              />
              <p className="text-xs text-slate-500 mt-1">
                % máximo do saldo em risco por operação
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                R:R Mínimo
              </label>
              <input
                type="number"
                value={planData.minRiskReward}
                onChange={(e) => handlePlanChange('minRiskReward', e.target.value)}
                min="0.5"
                step="0.5"
                className="w-full"
              />
              <p className="text-xs text-slate-500 mt-1">
                Risk:Reward mínimo aceitável
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Loss Diário Máximo (%)
              </label>
              <input
                type="number"
                value={planData.maxDailyLossPercent}
                onChange={(e) => handlePlanChange('maxDailyLossPercent', e.target.value)}
                min="1"
                max="100"
                step="0.5"
                className="w-full"
              />
              <p className="text-xs text-slate-500 mt-1">
                Parar de operar ao atingir este %
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Meta Mensal (%)
              </label>
              <input
                type="number"
                value={planData.targetPercent}
                onChange={(e) => handlePlanChange('targetPercent', e.target.value)}
                min="1"
                step="1"
                className="w-full"
              />
              <p className="text-xs text-slate-500 mt-1">
                Objetivo de rentabilidade
              </p>
            </div>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
            <p className="text-sm text-yellow-400">
              <AlertCircle className="w-4 h-4 inline mr-2" />
              Emoções bloqueadas: Revenge, FOMO, Overtrading
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Trades com essas emoções gerarão alertas automáticos
            </p>
          </div>
        </div>
      )}

      {/* Step 3: Confirmação */}
      {step === 3 && (
        <div className="glass-card p-6 space-y-6">
          <div className="flex items-center gap-3 mb-4">
            <Check className="w-6 h-6 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Confirmar Configuração</h2>
          </div>

          <div className="space-y-4">
            <div className="bg-slate-800/50 rounded-xl p-4">
              <h3 className="text-sm font-medium text-slate-400 mb-3">Conta</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-slate-500">Nome:</span>
                <span className="text-white">{accountData.name}</span>
                <span className="text-slate-500">Corretora:</span>
                <span className="text-white">{accountData.brokerName}</span>
                <span className="text-slate-500">Tipo:</span>
                <span className="text-white">{accountData.type}</span>
                <span className="text-slate-500">Saldo Inicial:</span>
                <span className="text-emerald-400">
                  {currencies.find(c => c.code === accountData.currencyCode)?.symbol || '$'}
                  {parseFloat(accountData.initialBalance).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="bg-slate-800/50 rounded-xl p-4">
              <h3 className="text-sm font-medium text-slate-400 mb-3">Plano de Trading</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-slate-500">Setup:</span>
                <span className="text-white">{defaultSetup?.name || 'Padrão'}</span>
                <span className="text-slate-500">Risco Máximo:</span>
                <span className="text-white">{planData.maxRiskPercent}%</span>
                <span className="text-slate-500">R:R Mínimo:</span>
                <span className="text-white">{planData.minRiskReward}</span>
                <span className="text-slate-500">Loss Diário:</span>
                <span className="text-white">{planData.maxDailyLossPercent}%</span>
                <span className="text-slate-500">Meta:</span>
                <span className="text-white">{planData.targetPercent}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        {step > 1 ? (
          <button
            onClick={prevStep}
            className="btn-secondary flex items-center gap-2"
            disabled={loading}
          >
            <ChevronLeft className="w-5 h-5" />
            Voltar
          </button>
        ) : (
          <div />
        )}

        {step < 3 ? (
          <button
            onClick={nextStep}
            className="btn-primary flex items-center gap-2"
          >
            Próximo
            <ChevronRight className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            className="btn-primary flex items-center gap-2"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                Criar Conta
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default AccountSetupWizard;
