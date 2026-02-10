/**
 * PlanManagementModal
 * @version 5.1.0 (Hotfix Wizard)
 * @description Wizard com navegação blindada e prevenção de submit acidental.
 * * CHANGE LOG 5.1.0:
 * - FIX: Prevenção de 'Enter' submetendo o form nas etapas 1 e 2.
 * - FIX: Validação numérica robusta (check de isNaN).
 * - UI: Feedback visual de erro melhorado.
 */

import { useState, useEffect, useMemo } from 'react';
import { 
  X, Target, ShieldAlert, Wallet, 
  TrendingUp, ArrowRight, ArrowLeft, Save, Loader2, AlertCircle
} from 'lucide-react';
import { useAccounts } from '../hooks/useAccounts';
import { usePlans } from '../hooks/usePlans';
import { formatCurrency } from '../utils/calculations';

const PLAN_TYPES = ['Day Trade', 'Swing Trade', 'Position', 'Opções', 'Crypto Spot', 'Forex'];
const CYCLES = ['Semanal', 'Mensal', 'Trimestral', 'Anual'];
const PERIODS = ['Diário', 'Semanal', 'Mensal'];
const TOTAL_STEPS = 3;

const PlanManagementModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  editingPlan = null, 
  isSubmitting = false 
}) => {
  const { accounts } = useAccounts();
  const { getAvailablePl } = usePlans();
  
  // Controle do Wizard
  const [currentStep, setCurrentStep] = useState(1);

  // Estado do Formulário
  const [formData, setFormData] = useState({
    name: '',
    type: 'Day Trade',
    accountId: '',
    pl: '', 
    adjustmentCycle: 'Mensal',
    cycleGoal: 10.0,
    cycleStop: 10.0,
    operationPeriod: 'Diário',
    periodGoal: 1.0,
    periodStop: 1.0,
    riskPerOperation: 1.0,
    rrTarget: 2.0,
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState(false);

  // Reset ao abrir
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      if (editingPlan) {
        setFormData({
          name: editingPlan.name || '',
          type: editingPlan.type || editingPlan.description || 'Day Trade',
          accountId: editingPlan.accountId || '',
          pl: editingPlan.pl || '',
          adjustmentCycle: editingPlan.adjustmentCycle || 'Mensal',
          cycleGoal: editingPlan.cycleGoal || 10.0,
          cycleStop: editingPlan.cycleStop || 10.0,
          operationPeriod: editingPlan.operationPeriod || 'Diário',
          periodGoal: editingPlan.periodGoal || 1.0,
          periodStop: editingPlan.periodStop || 1.0,
          riskPerOperation: editingPlan.riskPerOperation || 1.0,
          rrTarget: editingPlan.rrTarget || 2.0,
        });
      } else {
        setFormData({
          name: '',
          type: 'Day Trade',
          accountId: accounts.length > 0 ? accounts[0].id : '',
          pl: '',
          adjustmentCycle: 'Mensal',
          cycleGoal: 10.0,
          cycleStop: 10.0,
          operationPeriod: 'Diário',
          periodGoal: 1.0,
          periodStop: 1.0,
          riskPerOperation: 1.0,
          rrTarget: 2.0,
        });
      }
      setErrors({});
      setTouched(false);
    }
  }, [isOpen, editingPlan, accounts]);

  const selectedAccount = useMemo(() => 
    accounts.find(a => a.id === formData.accountId), 
    [accounts, formData.accountId]
  );

  const availableCapital = useMemo(() => {
    if (!selectedAccount) return 0;
    const currentPlanPl = editingPlan && editingPlan.accountId === selectedAccount.id ? (editingPlan.pl || 0) : 0;
    const freePl = getAvailablePl(selectedAccount.id, selectedAccount.currentBalance);
    return freePl + currentPlanPl;
  }, [selectedAccount, getAvailablePl, editingPlan]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    let val = value;
    if (type === 'number') {
        val = parseFloat(value);
        if (isNaN(val)) val = ''; // Permite limpar o campo sem quebrar
    }
    setFormData(prev => ({ ...prev, [name]: val }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
  };

  const validateStep = (step) => {
    const newErrors = {};
    let isValid = true;

    // Helper de validação numérica
    const isInvalidNum = (val) => val === '' || val === null || isNaN(Number(val)) || Number(val) <= 0;

    // Etapa 1: Capital
    if (step === 1) {
      if (!formData.name.trim()) newErrors.name = 'Nome é obrigatório';
      if (!formData.accountId) newErrors.accountId = 'Selecione uma conta';
      
      const plValue = Number(formData.pl);
      if (isInvalidNum(formData.pl)) {
        newErrors.pl = 'Capital inválido';
      } else if (plValue > availableCapital + 0.1) {
         newErrors.pl = `Saldo insuficiente (Disp: ${formatCurrency(availableCapital)})`;
      }
    }

    // Etapa 2: Metas
    if (step === 2) {
      if (isInvalidNum(formData.cycleGoal)) newErrors.cycleGoal = 'Inválido';
      if (isInvalidNum(formData.cycleStop)) newErrors.cycleStop = 'Inválido';
      if (isInvalidNum(formData.periodGoal)) newErrors.periodGoal = 'Inválido';
      if (isInvalidNum(formData.periodStop)) newErrors.periodStop = 'Inválido';
      
      // Validação Lógica (apenas se os números forem válidos)
      if (!isInvalidNum(formData.periodStop) && !isInvalidNum(formData.cycleStop)) {
          if (Number(formData.periodStop) > Number(formData.cycleStop)) {
            newErrors.periodStop = 'Stop do período > Stop do ciclo!';
          }
      }
    }

    // Etapa 3: Risco
    if (step === 3) {
      if (isInvalidNum(formData.riskPerOperation)) newErrors.riskPerOperation = 'Inválido';
      if (Number(formData.rrTarget) < 1) newErrors.rrTarget = 'Mínimo 1:1';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      isValid = false;
    }
    return isValid;
  };

  const handleNext = (e) => {
    if(e) e.preventDefault(); // Prevenir submit se chamado via botão
    setTouched(true);
    if (validateStep(currentStep)) {
      setTouched(false);
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
  };

  // Handler de Teclado (Enter)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
        e.preventDefault(); // Sempre previne o submit padrão do form
        if (currentStep < TOTAL_STEPS) {
            handleNext();
        } else {
            // Se estiver na última etapa, dispara o submit manual
            handleSubmit(e);
        }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    
    // Validação Final Hard
    if (validateStep(3)) {
      const payload = { ...formData, description: formData.type };
      onSubmit(payload);
    }
  };

  const calcValue = (percent) => {
    const pl = parseFloat(formData.pl) || 0;
    return (pl * (parseFloat(percent) || 0)) / 100;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* HEADER */}
        <div className="flex-none p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 backdrop-blur rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Target className="w-6 h-6 text-blue-500" />
              {editingPlan ? 'Editar Plano' : 'Novo Plano'}
            </h2>
            <p className="text-sm text-slate-400">Passo {currentStep} de {TOTAL_STEPS}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-full">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* PROGRESS BAR */}
        <div className="w-full bg-slate-800 h-1">
          <div className="bg-blue-600 h-1 transition-all duration-500 ease-out" style={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }} />
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* onKeyDown no form para capturar Enter globalmente neste contexto */}
          <form id="wizard-form" onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-6">
            
            {/* ETAPA 1 */}
            {currentStep === 1 && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="input-label">Nome do Plano</label>
                    <input type="text" name="name" value={formData.name} onChange={handleChange} className={`input-dark w-full ${errors.name ? 'border-red-500' : ''}`} placeholder="Ex: Alavancagem WINFUT" autoFocus />
                    {errors.name && <span className="error-msg">{errors.name}</span>}
                  </div>

                  <div>
                    <label className="input-label">Tipo</label>
                    <select name="type" value={formData.type} onChange={handleChange} className="input-dark w-full">
                      {PLAN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="input-label">Conta Vinculada</label>
                    <select name="accountId" value={formData.accountId} onChange={handleChange} className={`input-dark w-full ${errors.accountId ? 'border-red-500' : ''}`} disabled={!!editingPlan}>
                      {accounts.map(acc => (<option key={acc.id} value={acc.id}>{acc.name} ({acc.isReal ? 'Real' : 'Demo'})</option>))}
                    </select>
                  </div>

                  <div className="col-span-2 bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                    <label className="input-label flex justify-between mb-2">
                      <span className="flex items-center gap-2"><Wallet className="w-4 h-4 text-emerald-400"/> Capital Alocado (PL)</span>
                      <span className="text-xs text-emerald-400 font-mono">Disponível: {formatCurrency(availableCapital)}</span>
                    </label>
                    
                    <div className={`flex items-stretch rounded-lg overflow-hidden border ${errors.pl ? 'border-red-500' : 'border-slate-600'}`}>
                      <div className="bg-slate-700/50 px-4 flex items-center justify-center border-r border-slate-600">
                        <span className="text-slate-300 font-bold">R$</span>
                      </div>
                      <input type="number" name="pl" value={formData.pl} onChange={handleChange} className="flex-1 bg-slate-900 text-white p-3 outline-none font-bold text-lg" placeholder="0.00" />
                    </div>
                    {errors.pl && <span className="error-msg mt-2">{errors.pl}</span>}

                    {selectedAccount && formData.pl > 0 && formData.pl <= availableCapital && (
                      <div className="mt-3">
                        <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                          <span>Alocação</span>
                          <span>{((formData.pl / selectedAccount.currentBalance) * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-emerald-500 h-full" style={{ width: `${Math.min(((formData.pl / selectedAccount.currentBalance) * 100), 100)}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ETAPA 2 */}
            {currentStep === 2 && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/50">
                    <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wider mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Ciclo de Ajuste (Macro)</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="input-label">Duração</label>
                        <select name="adjustmentCycle" value={formData.adjustmentCycle} onChange={handleChange} className="input-dark w-full">{CYCLES.map(c => <option key={c} value={c}>{c}</option>)}</select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                         <div><label className="input-label text-emerald-400">Meta (%)</label><input type="number" name="cycleGoal" value={formData.cycleGoal} onChange={handleChange} className={`input-dark w-full text-emerald-400 font-bold ${errors.cycleGoal ? 'border-red-500' : ''}`} /></div>
                         <div><label className="input-label text-red-400">Stop (%)</label><input type="number" name="cycleStop" value={formData.cycleStop} onChange={handleChange} className={`input-dark w-full text-red-400 font-bold ${errors.cycleStop ? 'border-red-500' : ''}`} /></div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/50">
                    <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Target className="w-4 h-4" /> Período Operacional (Micro)</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="input-label">Frequência</label>
                        <select name="operationPeriod" value={formData.operationPeriod} onChange={handleChange} className="input-dark w-full">{PERIODS.map(p => <option key={p} value={p}>{p}</option>)}</select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                         <div><label className="input-label text-emerald-400">Meta (%)</label><input type="number" name="periodGoal" value={formData.periodGoal} onChange={handleChange} className={`input-dark w-full text-emerald-400 font-bold ${errors.periodGoal ? 'border-red-500' : ''}`} /></div>
                         <div><label className="input-label text-red-400">Stop (%)</label><input type="number" name="periodStop" value={formData.periodStop} onChange={handleChange} className={`input-dark w-full text-red-400 font-bold ${errors.periodStop ? 'border-red-500' : ''}`} /></div>
                      </div>
                      {errors.periodStop && <span className="error-msg text-red-400">{errors.periodStop}</span>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ETAPA 3 */}
            {currentStep === 3 && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-start gap-3">
                   <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                   <div><h4 className="text-sm font-bold text-amber-400 mb-1">Gestão de Risco</h4><p className="text-xs text-amber-200/70">Limites sagrados de proteção de capital.</p></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="input-label">Risco Máx. / Trade (%)</label>
                    <div className="flex items-center gap-3"><input type="number" name="riskPerOperation" step="0.1" value={formData.riskPerOperation} onChange={handleChange} className={`input-dark w-full text-xl text-center font-bold text-white ${errors.riskPerOperation ? 'border-red-500' : ''}`} /></div>
                  </div>
                  <div>
                    <label className="input-label">Risco/Retorno (1:X)</label>
                    <div className="flex items-center gap-3"><div className="bg-slate-800 px-3 py-2 rounded-lg border border-slate-700 text-slate-400 font-bold">1</div><span className="text-slate-500">:</span><input type="number" name="rrTarget" step="0.1" value={formData.rrTarget} onChange={handleChange} className={`input-dark w-full text-xl text-center font-bold text-blue-400 ${errors.rrTarget ? 'border-red-500' : ''}`} /></div>
                  </div>
                </div>
                <div className="mt-8 pt-6 border-t border-slate-800">
                  <h4 className="text-xs uppercase tracking-widest text-slate-500 mb-4 font-bold">Resumo</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm bg-slate-800/30 p-4 rounded-lg">
                    <div className="flex justify-between"><span className="text-slate-400">Capital:</span><span className="text-white font-mono font-bold">{formatCurrency(formData.pl)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Stop Ciclo:</span><span className="text-red-400 font-mono font-bold">-{formatCurrency(calcValue(formData.cycleStop))}</span></div>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* FOOTER */}
        <div className="flex-none p-4 border-t border-slate-800 bg-slate-900/50 backdrop-blur flex justify-between items-center rounded-b-2xl">
          {currentStep > 1 ? (
            <button type="button" onClick={handleBack} className="px-4 py-2 text-slate-400 hover:text-white flex items-center gap-2 text-sm font-medium transition-colors"><ArrowLeft className="w-4 h-4" /> Voltar</button>
          ) : <div />}

          {currentStep < TOTAL_STEPS ? (
            <button type="button" onClick={handleNext} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-lg flex items-center gap-2 text-sm font-bold transition-all">Próximo <ArrowRight className="w-4 h-4" /></button>
          ) : (
            <button type="submit" form="wizard-form" disabled={isSubmitting} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-lg flex items-center gap-2 text-sm font-bold transition-all disabled:opacity-50">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {editingPlan ? 'Salvar' : 'Criar'}
            </button>
          )}
        </div>
      </div>
      <style>{`
        .input-label { display: block; font-size: 0.75rem; color: rgb(148 163 184); margin-bottom: 0.35rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
        .input-dark { background: rgb(15 23 42); border: 1px solid rgb(51 65 85); padding: 0.6rem; border-radius: 0.5rem; color: white; outline: none; transition: all 0.2s; font-size: 0.9rem; }
        .input-dark:focus { border-color: rgb(59 130 246); box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1); }
        .error-msg { font-size: 0.75rem; color: rgb(248 113 113); margin-top: 0.25rem; display: block; }
      `}</style>
    </div>
  );
};

export default PlanManagementModal;