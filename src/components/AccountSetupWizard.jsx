/**
 * AccountSetupWizard - Wizard para configuração inicial do aluno
 * 
 * Fluxo:
 * 1. Criar Conta (nome, corretora, tipo, moeda, saldo inicial)
 * 2. Criar Plano de Trading (PL, ciclo, período, metas, stops)
 * 3. Confirmação
 */

import { useState, useMemo } from 'react';
import { 
  Wallet, 
  ChevronRight, 
  ChevronLeft,
  Check,
  Loader2,
  AlertCircle,
  Building2,
  DollarSign,
  Target,
  Shield,
  HelpCircle,
  Calendar,
  TrendingUp,
  ShieldCheck,
  FlaskConical,
  Trophy,
  Search
} from 'lucide-react';
import { useAccounts } from '../hooks/useAccounts';
import { usePlans } from '../hooks/usePlans';
import { useMasterData } from '../hooks/useMasterData';

// Opções de ciclo e período
const ADJUSTMENT_CYCLES = ['Semanal', 'Mensal', 'Trimestral', 'Anual'];
const OPERATION_PERIODS = ['Diário', 'Semanal', 'Mensal'];
const PLAN_DESCRIPTIONS = ['Day Trade', 'Swing Trade', 'Position', 'Opções', 'Scalping'];

// Componente de Tooltip
const Tooltip = ({ text }) => (
  <div className="group relative inline-block ml-1">
    <HelpCircle className="w-4 h-4 text-slate-500 cursor-help" />
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-xs text-slate-300 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
      {text}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
    </div>
  </div>
);

const AccountSetupWizard = ({ onComplete }) => {
  const { addAccount } = useAccounts();
  const { addPlan } = usePlans();
  const { brokers } = useMasterData();
  
  // Lista de corretoras do Firestore
  const brokerNames = useMemo(() => brokers.map(b => b.name).sort(), [brokers]);
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showBrokerSuggestions, setShowBrokerSuggestions] = useState(false);
  const [createdAccountId, setCreatedAccountId] = useState(null);
  
  // Dados da Conta
  const [accountData, setAccountData] = useState({
    name: '',
    broker: '',
    currency: 'BRL',
    type: 'DEMO',
    initialBalance: ''
  });
  
  // Dados do Plano
  const [planData, setPlanData] = useState({
    name: '',
    description: 'Day Trade',
    pl: '',
    riskPerOperation: 2,
    rrTarget: 2,
    adjustmentCycle: 'Mensal',
    cycleGoal: 10,
    cycleStop: 5,
    operationPeriod: 'Diário',
    periodGoal: 2,
    periodStop: 2
  });

  // Filtro de corretoras
  const filteredBrokers = useMemo(() => {
    if (!accountData.broker) return brokerNames.slice(0, 5);
    return brokerNames.filter(b => 
      b.toLowerCase().includes(accountData.broker.toLowerCase())
    ).slice(0, 8);
  }, [accountData.broker, brokerNames]);

  // Cálculo do % do PL em relação ao saldo
  const plPercent = useMemo(() => {
    const balance = parseFloat(accountData.initialBalance) || 0;
    const pl = parseFloat(planData.pl) || 0;
    if (balance === 0) return 0;
    return ((pl / balance) * 100).toFixed(1);
  }, [accountData.initialBalance, planData.pl]);

  // Validação do PL
  const isPlValid = useMemo(() => {
    const balance = parseFloat(accountData.initialBalance) || 0;
    const pl = parseFloat(planData.pl) || 0;
    return pl > 0 && pl <= balance;
  }, [accountData.initialBalance, planData.pl]);

  const validateStep1 = () => {
    if (!accountData.name.trim()) {
      setError('Informe o nome da conta');
      return false;
    }
    if (!accountData.broker.trim()) {
      setError('Informe a corretora');
      return false;
    }
    if (!accountData.initialBalance || parseFloat(accountData.initialBalance) <= 0) {
      setError('Informe o saldo inicial');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!planData.name.trim()) {
      setError('Informe o nome do plano');
      return false;
    }
    if (!planData.pl || parseFloat(planData.pl) <= 0) {
      setError('Informe o Patrimônio Líquido (PL) do plano');
      return false;
    }
    if (!isPlValid) {
      setError('O PL não pode ser maior que o saldo da conta');
      return false;
    }
    return true;
  };

  const handleCreateAccount = async () => {
    if (!validateStep1()) return;
    
    setError(null);
    setLoading(true);
    
    try {
      const isRealDerived = accountData.type === 'REAL' || accountData.type === 'PROP';
      
      const accountId = await addAccount({
        name: accountData.name.trim(),
        broker: accountData.broker.trim(),
        brokerName: accountData.broker.trim(),
        currency: accountData.currency,
        type: accountData.type,
        isReal: isRealDerived,
        initialBalance: parseFloat(accountData.initialBalance)
      });
      
      setCreatedAccountId(accountId);
      
      // Pre-fill PL com o saldo da conta
      if (!planData.pl) {
        setPlanData(prev => ({ ...prev, pl: accountData.initialBalance }));
      }
      
      setStep(2);
    } catch (err) {
      console.error('Erro ao criar conta:', err);
      setError('Erro ao criar conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = async () => {
    if (!validateStep2()) return;
    
    setError(null);
    setLoading(true);
    
    try {
      await addPlan({
        name: planData.name.trim(),
        description: planData.description,
        accountId: createdAccountId,
        pl: parseFloat(planData.pl),
        plPercent: parseFloat(plPercent),
        riskPerOperation: parseFloat(planData.riskPerOperation),
        rrTarget: parseFloat(planData.rrTarget),
        adjustmentCycle: planData.adjustmentCycle,
        cycleGoal: parseFloat(planData.cycleGoal),
        cycleStop: parseFloat(planData.cycleStop),
        operationPeriod: planData.operationPeriod,
        periodGoal: parseFloat(planData.periodGoal),
        periodStop: parseFloat(planData.periodStop)
      });
      
      setStep(3);
    } catch (err) {
      console.error('Erro ao criar plano:', err);
      setError('Erro ao criar plano. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    if (onComplete) onComplete(createdAccountId);
  };

  const getCurrencySymbol = () => {
    const symbols = { BRL: 'R$', USD: '$', EUR: '€' };
    return symbols[accountData.currency] || 'R$';
  };

  const formatCurrency = (value) => {
    const num = parseFloat(value) || 0;
    return `${getCurrencySymbol()} ${num.toLocaleString('pt-BR')}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Wallet className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-display font-bold text-white mb-2">
            Bem-vindo ao Journal! 🎉
          </h1>
          <p className="text-slate-400">
            Configure sua conta e plano de trading
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
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
                <div className={`w-8 h-1 mx-1 rounded ${s < step ? 'bg-emerald-500' : 'bg-slate-700'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span className="text-red-400 text-sm">{error}</span>
          </div>
        )}

        {/* Step 1: Conta */}
        {step === 1 && (
          <div className="glass-card p-6 space-y-5">
            <div className="flex items-center gap-3 mb-4">
              <Building2 className="w-6 h-6 text-blue-400" />
              <h2 className="text-lg font-semibold text-white">Dados da Conta</h2>
            </div>

            {/* Tipo */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-3">Tipo de Conta</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'DEMO', icon: FlaskConical, label: 'Demo', color: 'yellow' },
                  { id: 'REAL', icon: ShieldCheck, label: 'Real', color: 'emerald' },
                  { id: 'PROP', icon: Trophy, label: 'Mesa', color: 'purple' }
                ].map(type => (
                  <div 
                    key={type.id}
                    onClick={() => setAccountData({...accountData, type: type.id})}
                    className={`cursor-pointer border rounded-xl p-3 flex flex-col items-center gap-2 transition-all ${
                      accountData.type === type.id 
                        ? `bg-${type.color}-500/10 border-${type.color}-500/50 text-white` 
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    <type.icon className={`w-6 h-6 ${accountData.type === type.id ? `text-${type.color}-400` : 'text-slate-500'}`} />
                    <span className="text-xs font-bold uppercase">{type.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Nome */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Nome da Conta *</label>
              <input
                type="text"
                value={accountData.name}
                onChange={(e) => setAccountData({...accountData, name: e.target.value})}
                placeholder="Ex: Conta Principal, FTMO Challenge"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-blue-500 outline-none"
              />
            </div>

            {/* Corretora */}
            <div className="relative">
              <label className="block text-sm font-medium text-slate-400 mb-2">Corretora *</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={accountData.broker}
                  onChange={(e) => {
                    setAccountData({...accountData, broker: e.target.value});
                    setShowBrokerSuggestions(true);
                  }}
                  onFocus={() => setShowBrokerSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowBrokerSuggestions(false), 200)}
                  placeholder="Digite para buscar..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                />
              </div>
              {showBrokerSuggestions && filteredBrokers.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 max-h-40 overflow-y-auto">
                  {filteredBrokers.map(broker => (
                    <button
                      key={broker}
                      type="button"
                      className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2"
                      onClick={() => {
                        setAccountData({...accountData, broker});
                        setShowBrokerSuggestions(false);
                      }}
                    >
                      <Search className="w-3 h-3 opacity-50" /> {broker}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Moeda e Saldo */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Moeda</label>
                <select
                  value={accountData.currency}
                  onChange={(e) => setAccountData({...accountData, currency: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none"
                >
                  <option value="BRL">BRL (R$)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  <DollarSign className="w-4 h-4 inline mr-1" />
                  Saldo Inicial *
                </label>
                <input
                  type="number"
                  value={accountData.initialBalance}
                  onChange={(e) => setAccountData({...accountData, initialBalance: e.target.value})}
                  placeholder="10000"
                  min="0"
                  step="0.01"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Plano */}
        {step === 2 && (
          <div className="glass-card p-6 space-y-5">
            <div className="flex items-center gap-3 mb-4">
              <Target className="w-6 h-6 text-emerald-400" />
              <h2 className="text-lg font-semibold text-white">Plano de Trading</h2>
            </div>

            {/* Nome e Descrição */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Nome do Plano *</label>
                <input
                  type="text"
                  value={planData.name}
                  onChange={(e) => setPlanData({...planData, name: e.target.value})}
                  placeholder="Ex: Plano Conservador"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Tipo de Operação</label>
                <select
                  value={planData.description}
                  onChange={(e) => setPlanData({...planData, description: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none"
                >
                  {PLAN_DESCRIPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            {/* PL */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center">
                Patrimônio Líquido (PL) *
                <Tooltip text="Capital alocado para este plano. Deve ser menor ou igual ao saldo da conta." />
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={planData.pl}
                  onChange={(e) => setPlanData({...planData, pl: e.target.value})}
                  placeholder={accountData.initialBalance}
                  min="0"
                  max={accountData.initialBalance}
                  step="0.01"
                  className={`w-full bg-slate-800 border rounded-xl px-4 py-3 text-white placeholder-slate-500 outline-none ${
                    planData.pl && !isPlValid ? 'border-red-500' : 'border-slate-700 focus:border-blue-500'
                  }`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">
                  <span className={`font-bold ${isPlValid ? 'text-emerald-400' : 'text-red-400'}`}>
                    {plPercent}%
                  </span>
                  <span className="text-slate-500 ml-1">do saldo</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Saldo disponível: {formatCurrency(accountData.initialBalance)}
              </p>
            </div>

            {/* Risco */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center">
                  <Shield className="w-4 h-4 mr-1" />
                  Risco Operacional (%)
                  <Tooltip text="Máximo de perda permitido por operação, em % do PL" />
                </label>
                <input
                  type="number"
                  value={planData.riskPerOperation}
                  onChange={(e) => setPlanData({...planData, riskPerOperation: e.target.value})}
                  min="0.1"
                  max="100"
                  step="0.1"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  R:R Mínimo
                  <Tooltip text="Risk/Reward mínimo aceitável para entrar em operações" />
                </label>
                <input
                  type="number"
                  value={planData.rrTarget}
                  onChange={(e) => setPlanData({...planData, rrTarget: e.target.value})}
                  min="0.5"
                  step="0.5"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Ciclo de Ajuste */}
            <div className="p-4 bg-slate-800/50 rounded-xl space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-400" />
                Ciclo de Ajuste do PL
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Ciclo</label>
                  <select
                    value={planData.adjustmentCycle}
                    onChange={(e) => setPlanData({...planData, adjustmentCycle: e.target.value})}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    {ADJUSTMENT_CYCLES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Meta (%)</label>
                  <input
                    type="number"
                    value={planData.cycleGoal}
                    onChange={(e) => setPlanData({...planData, cycleGoal: e.target.value})}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Stop (%)</label>
                  <input
                    type="number"
                    value={planData.cycleStop}
                    onChange={(e) => setPlanData({...planData, cycleStop: e.target.value})}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>
            </div>

            {/* Período de Operação */}
            <div className="p-4 bg-slate-800/50 rounded-xl space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-purple-400" />
                Período de Operação
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Período</label>
                  <select
                    value={planData.operationPeriod}
                    onChange={(e) => setPlanData({...planData, operationPeriod: e.target.value})}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    {OPERATION_PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Meta (%)</label>
                  <input
                    type="number"
                    value={planData.periodGoal}
                    onChange={(e) => setPlanData({...planData, periodGoal: e.target.value})}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Stop (%)</label>
                  <input
                    type="number"
                    value={planData.periodStop}
                    onChange={(e) => setPlanData({...planData, periodStop: e.target.value})}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Confirmação */}
        {step === 3 && (
          <div className="glass-card p-6 space-y-6">
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Tudo Pronto! 🚀</h2>
              <p className="text-slate-400">Sua conta e plano foram configurados com sucesso.</p>
            </div>

            {/* Resumo */}
            <div className="space-y-4">
              <div className="bg-slate-800/50 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-slate-400 mb-3">Conta</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-slate-500">Nome:</span>
                  <span className="text-white">{accountData.name}</span>
                  <span className="text-slate-500">Corretora:</span>
                  <span className="text-white">{accountData.broker}</span>
                  <span className="text-slate-500">Saldo:</span>
                  <span className="text-emerald-400">{formatCurrency(accountData.initialBalance)}</span>
                </div>
              </div>

              <div className="bg-slate-800/50 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-slate-400 mb-3">Plano: {planData.name}</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-slate-500">Tipo:</span>
                  <span className="text-white">{planData.description}</span>
                  <span className="text-slate-500">PL:</span>
                  <span className="text-white">{formatCurrency(planData.pl)} ({plPercent}%)</span>
                  <span className="text-slate-500">Risco/Op:</span>
                  <span className="text-white">{planData.riskPerOperation}%</span>
                  <span className="text-slate-500">R:R Mínimo:</span>
                  <span className="text-white">{planData.rrTarget}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          {step > 1 && step < 3 ? (
            <button
              onClick={() => { setError(null); setStep(step - 1); }}
              className="btn-secondary flex items-center gap-2"
              disabled={loading}
            >
              <ChevronLeft className="w-5 h-5" />
              Voltar
            </button>
          ) : (
            <div />
          )}

          {step === 1 && (
            <button
              onClick={handleCreateAccount}
              className="btn-primary flex items-center gap-2 ml-auto"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Próximo'}
              {!loading && <ChevronRight className="w-5 h-5" />}
            </button>
          )}

          {step === 2 && (
            <button
              onClick={handleCreatePlan}
              className="btn-primary flex items-center gap-2"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Criar Plano'}
              {!loading && <Check className="w-5 h-5" />}
            </button>
          )}

          {step === 3 && (
            <button
              onClick={handleComplete}
              className="btn-primary flex items-center gap-2 ml-auto"
            >
              Começar a Operar
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountSetupWizard;
