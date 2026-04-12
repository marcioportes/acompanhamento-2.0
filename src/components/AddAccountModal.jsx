import { useState, useEffect, useMemo } from 'react';
import {
  X,
  Loader2,
  AlertCircle,
  Wallet,
  Building2,
  Coins,
  Tag,
  DollarSign,
  Trophy,
  Info
} from 'lucide-react';
import DebugBadge from './DebugBadge';
import { ACCOUNT_TYPES } from '../firebase';
import { useMasterData } from '../hooks/useMasterData';
import { usePropFirmTemplates } from '../hooks/usePropFirmTemplates';
import {
  PROP_FIRM_LABELS,
  PROP_FIRM_PHASES,
  PROP_FIRM_PHASE_LABELS,
  ATTACK_PROFILES,
  DEFAULT_ATTACK_PROFILE,
  normalizeAttackProfile,
  DEFAULT_TEMPLATES_ENRICHED,
  getTemplatesByFirm as groupByFirm
} from '../constants/propFirmDefaults';
import { calculateAttackPlan } from '../utils/attackPlanCalculator';

const AddAccountModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  editAccount = null,
  loading = false 
}) => {
  const { brokers, currencies, loading: masterDataLoading } = useMasterData();
  const { templates: firestoreTemplates } = usePropFirmTemplates();

  // Fallback: se Firestore está vazio, usar DEFAULT_TEMPLATES_ENRICHED (com restrictedInstruments derivado)
  const allTemplates = useMemo(
    () => firestoreTemplates.length > 0 ? firestoreTemplates : DEFAULT_TEMPLATES_ENRICHED,
    [firestoreTemplates]
  );

  const [formData, setFormData] = useState({
    name: '',
    broker: '',
    type: 'REAL',
    initialBalance: '',
    currency: 'BRL',
  });

  // Prop firm state (separado para clareza)
  const [propFirmData, setPropFirmData] = useState({
    selectedFirm: '',
    selectedTemplateId: '',
    phase: PROP_FIRM_PHASES.EVALUATION,
    attackProfile: DEFAULT_ATTACK_PROFILE
  });

  const [errors, setErrors] = useState({});

  // Templates agrupados por firma
  const firmGroups = useMemo(() => groupByFirm(allTemplates), [allTemplates]);
  const firmList = useMemo(() => Object.keys(firmGroups), [firmGroups]);
  const productsForFirm = useMemo(
    () => firmGroups[propFirmData.selectedFirm] ?? [],
    [firmGroups, propFirmData.selectedFirm]
  );
  const selectedTemplate = useMemo(
    () => allTemplates.find(t => t.id === propFirmData.selectedTemplateId) ?? null,
    [allTemplates, propFirmData.selectedTemplateId]
  );

  // Plano de ataque calculado (sem 4D/indicadores na criação — usa defaults)
  const attackPlan = useMemo(() => {
    if (!selectedTemplate) return null;
    try {
      return calculateAttackPlan(
        selectedTemplate,
        null,
        null,
        propFirmData.attackProfile,
        propFirmData.phase
      );
    } catch {
      return null;
    }
  }, [selectedTemplate, propFirmData.attackProfile, propFirmData.phase]);

  // Auto-fill currency (USD), balance (accountSize) e nome quando template selecionado
  useEffect(() => {
    if (selectedTemplate && formData.type === 'PROP') {
      setFormData(prev => ({
        ...prev,
        currency: 'USD',
        initialBalance: selectedTemplate.accountSize?.toString() ?? prev.initialBalance,
        name: prev.name || selectedTemplate.name
      }));
    }
  }, [selectedTemplate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Preencher dados para edição
  useEffect(() => {
    if (editAccount) {
      setFormData({
        name: editAccount.name || '',
        broker: editAccount.broker || '',
        type: editAccount.type || 'REAL',
        initialBalance: editAccount.initialBalance?.toString() || '',
        currency: editAccount.currency || 'BRL',
      });
      if (editAccount.propFirm) {
        setPropFirmData({
          selectedFirm: editAccount.propFirm.firmName || '',
          selectedTemplateId: editAccount.propFirm.templateId || '',
          phase: editAccount.propFirm.phase || PROP_FIRM_PHASES.EVALUATION,
          attackProfile: normalizeAttackProfile(editAccount.propFirm.suggestedPlan?.profile)
        });
      }
    } else {
      setFormData({
        name: '',
        broker: '',
        type: 'REAL',
        initialBalance: '',
        currency: 'BRL',
      });
      setPropFirmData({
        selectedFirm: '',
        selectedTemplateId: '',
        phase: PROP_FIRM_PHASES.EVALUATION,
        attackProfile: DEFAULT_ATTACK_PROFILE
      });
    }
    setErrors({});
  }, [editAccount, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Limpar erro do campo
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Nome da conta é obrigatório';
    }
    
    if (!formData.broker.trim()) {
      newErrors.broker = 'Corretora é obrigatória';
    }
    
    if (!formData.initialBalance || isNaN(parseFloat(formData.initialBalance))) {
      newErrors.initialBalance = 'Saldo inicial inválido';
    } else if (parseFloat(formData.initialBalance) < 0) {
      newErrors.initialBalance = 'Saldo não pode ser negativo';
    }

    // Validação prop firm
    if (formData.type === 'PROP' && !propFirmData.selectedTemplateId) {
      newErrors.propFirm = 'Selecione a mesa e o produto';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      const accountData = {
        ...formData,
        initialBalance: parseFloat(formData.initialBalance),
      };

      // Montar propFirm se tipo PROP
      if (formData.type === 'PROP' && selectedTemplate) {
        const evalDays = selectedTemplate.evalTimeLimit;
        accountData.propFirm = {
          templateId: selectedTemplate.id,
          firmName: selectedTemplate.firm,
          productName: selectedTemplate.name,
          phase: propFirmData.phase,
          drawdownMax: selectedTemplate.drawdown?.maxAmount ?? 0,
          evalDeadline: evalDays
            ? new Date(Date.now() + evalDays * 24 * 60 * 60 * 1000).toISOString()
            : null,
          suggestedPlan: attackPlan
        };
      }

      await onSubmit(accountData, editAccount?.id);
      onClose();
    } catch (err) {
      setErrors({ submit: err.message });
    }
  };

  if (!isOpen) return null;

  // Mapear tipo de conta para labels e cores
  const accountTypeConfig = {
    'REAL': { 
      label: 'Conta Real', 
      description: 'Dinheiro real em corretora',
      color: 'emerald',
      icon: '💰'
    },
    'DEMO': { 
      label: 'Conta Demo', 
      description: 'Conta de simulação/prática',
      color: 'blue',
      icon: '🎮'
    },
    'PROP': { 
      label: 'Prop Firm', 
      description: 'Mesa proprietária',
      color: 'purple',
      icon: '🏢'
    }
  };

  // Moedas disponíveis (fallback se masterData não carregar)
  const availableCurrencies = currencies.length > 0 
    ? currencies 
    : [
        { code: 'BRL', name: 'Real Brasileiro', symbol: 'R$' },
        { code: 'USD', name: 'Dólar Americano', symbol: '$' },
        { code: 'EUR', name: 'Euro', symbol: '€' }
      ];

  // Corretoras disponíveis (fallback se masterData não carregar)
  const availableBrokers = brokers.length > 0
    ? brokers
    : [
        { name: 'XP Investimentos' },
        { name: 'Clear Corretora' },
        { name: 'Rico Investimentos' },
        { name: 'BTG Pactual' },
        { name: 'Interactive Brokers' },
        { name: 'TD Ameritrade' },
        { name: 'Apex Trader Funding' },
        { name: 'Topstep' },
        { name: 'FTMO' },
        { name: 'Outra' }
      ];

  return (
    <>
      {/* Backdrop */}
      <div 
        className="modal-backdrop"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="modal-content w-full max-w-lg max-h-[90vh] overflow-hidden">
        <div className="glass-card">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-800/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-display font-bold text-white">
                  {editAccount ? 'Editar Conta' : 'Nova Conta'}
                </h2>
                <p className="text-sm text-slate-500">
                  {editAccount ? 'Atualize os dados da conta' : 'Adicione uma nova conta de trading'}
                </p>
              </div>
            </div>
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

            {/* Nome da Conta */}
            <div className="input-group mb-4">
              <label className="input-label flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Nome da Conta *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Ex: Conta Principal, Swing Trading..."
                className={errors.name ? 'ring-2 ring-red-500/50' : ''}
              />
              {errors.name && <span className="text-xs text-red-400">{errors.name}</span>}
            </div>

            {/* Tipo de Conta */}
            <div className="input-group mb-4">
              <label className="input-label">Tipo de Conta *</label>
              <div className="grid grid-cols-3 gap-3">
                {ACCOUNT_TYPES.map(type => {
                  const config = accountTypeConfig[type];
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, type }))}
                      className={`p-4 rounded-xl border transition-all ${
                        formData.type === type
                          ? config.color === 'emerald'
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                            : config.color === 'blue'
                              ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                              : 'bg-purple-500/20 border-purple-500/50 text-purple-400'
                          : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-700/50'
                      }`}
                    >
                      <div className="text-2xl mb-1">{config.icon}</div>
                      <div className="text-sm font-medium">{config.label}</div>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {accountTypeConfig[formData.type]?.description}
              </p>
            </div>

            {/* Prop Firm — seletor condicional (#52) */}
            {console.log('[AddAccountModal] formData.type:', formData.type, '| isPROP:', formData.type === 'PROP', '| firmList:', firmList)}
            {formData.type === 'PROP' && (
              <div className="mb-4 p-4 bg-purple-500/5 border border-purple-500/20 rounded-xl space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-medium text-purple-300">Configuração da Mesa</span>
                </div>

                {/* Firma */}
                <div className="input-group">
                  <label className="input-label text-xs">Mesa Proprietária *</label>
                  <select
                    value={propFirmData.selectedFirm}
                    onChange={(e) => setPropFirmData(prev => ({
                      ...prev,
                      selectedFirm: e.target.value,
                      selectedTemplateId: ''
                    }))}
                    className={errors.propFirm ? 'ring-2 ring-red-500/50' : ''}
                  >
                    <option value="">Selecione a mesa</option>
                    {firmList.map(firm => (
                      <option key={firm} value={firm}>
                        {PROP_FIRM_LABELS[firm] ?? firm}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Produto */}
                {propFirmData.selectedFirm && (
                  <div className="input-group">
                    <label className="input-label text-xs">Produto *</label>
                    <select
                      value={propFirmData.selectedTemplateId}
                      onChange={(e) => setPropFirmData(prev => ({
                        ...prev,
                        selectedTemplateId: e.target.value
                      }))}
                    >
                      <option value="">Selecione o produto</option>
                      {productsForFirm.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Fase */}
                <div className="input-group">
                  <label className="input-label text-xs">Fase da Conta</label>
                  <select
                    value={propFirmData.phase}
                    onChange={(e) => setPropFirmData(prev => ({ ...prev, phase: e.target.value }))}
                  >
                    {Object.entries(PROP_FIRM_PHASE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                {/* Perfil do plano de ataque (5 perfis) */}
                {selectedTemplate && (
                  <div className="input-group">
                    <label className="input-label text-xs">Perfil do Plano de Ataque</label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {Object.values(ATTACK_PROFILES).map((p) => {
                        const selected = propFirmData.attackProfile === p.code;
                        const isCons = p.family === 'conservative';
                        return (
                          <button
                            key={p.code}
                            type="button"
                            onClick={() => setPropFirmData(prev => ({ ...prev, attackProfile: p.code }))}
                            title={`${p.name} — ${p.description}\nRO: ${(p.roPct * 100).toFixed(0)}% do DD · ${p.maxTradesPerDay} trade(s)/dia\n${p.idealFor}`}
                            className={`p-1.5 rounded-md border text-[10px] font-semibold transition-all ${
                              selected
                                ? (isCons ? 'bg-blue-500/20 border-blue-500/60 text-blue-200' : 'bg-orange-500/20 border-orange-500/60 text-orange-200')
                                : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-700/50'
                            }`}
                          >
                            <div>{(p.roPct * 100).toFixed(0)}%</div>
                            <div className="text-[9px] opacity-70 mt-0.5">{p.code}</div>
                            {p.recommended && <div className="text-[8px] text-emerald-400 mt-0.5">★</div>}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {ATTACK_PROFILES[propFirmData.attackProfile]?.description ?? ''}
                    </p>
                  </div>
                )}

                {/* Preview do plano de ataque (3 blocos semanticamente separados — issue #136 revisão)
                    BLOCO 1: Constraints da mesa (hard limits imutáveis)
                    BLOCO 2: Mecânica do plano (meta/stop derivados do RO × RR, caminhos de execução)
                    BLOCO 3: Ritmo de acumulação (EV estatístico, NUNCA meta operacional) */}
                {attackPlan && attackPlan.mode === 'abstract' && (() => {
                  const ro = attackPlan.roPerTrade ?? 0;
                  const maxT = attackPlan.maxTradesPerDay ?? 0;
                  const rr = attackPlan.rrMinimum ?? 2;
                  const dailyStop = ro * maxT;
                  const dailyGoal = dailyStop * rr;
                  const roPctOfDD = attackPlan.drawdownMax > 0
                    ? Math.round((ro / attackPlan.drawdownMax) * 100)
                    : null;
                  return (
                    <div className="p-3 bg-slate-800/50 rounded-lg space-y-3">
                      {/* BLOCO 1 — Constraints da mesa */}
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                          Constraints da mesa
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          <div className="text-slate-500">DD total:</div>
                          <div className="text-slate-300">${attackPlan.drawdownMax?.toLocaleString() ?? '—'}</div>
                          <div className="text-slate-500">Profit target:</div>
                          <div className="text-slate-300">${attackPlan.profitTarget?.toLocaleString() ?? '—'}</div>
                          {attackPlan.evalBusinessDays > 0 && (
                            <>
                              <div className="text-slate-500">Prazo eval:</div>
                              <div className="text-slate-300">{attackPlan.evalBusinessDays} dias úteis</div>
                            </>
                          )}
                          {attackPlan.dailyLossLimit > 0 && (
                            <>
                              <div className="text-slate-500">Daily loss:</div>
                              <div className="text-slate-300">${attackPlan.dailyLossLimit?.toLocaleString()} <span className="text-slate-600">(hard limit)</span></div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* BLOCO 2 — Mecânica do plano */}
                      <div className="pt-2 border-t border-slate-700/50">
                        <div className="text-[10px] uppercase tracking-wider text-blue-400 font-bold mb-1.5">
                          Mecânica do plano
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          <div className="text-slate-500">RO por trade:</div>
                          <div className="text-slate-300">
                            ${ro.toLocaleString()}
                            {roPctOfDD !== null && <span className="text-slate-600"> ({roPctOfDD}% do DD)</span>}
                          </div>
                          <div className="text-slate-500">RR por trade:</div>
                          <div className="text-slate-300">{rr}:1</div>
                          <div className="text-slate-500">Max trades/dia:</div>
                          <div className="text-slate-300">{maxT}</div>
                          <div className="text-red-400/70">Stop operacional:</div>
                          <div className="text-red-400 font-mono">-${dailyStop.toLocaleString()}/dia</div>
                          <div className="text-emerald-400/70">Meta operacional:</div>
                          <div className="text-emerald-400 font-mono">${dailyGoal.toLocaleString()}/dia</div>
                        </div>
                        {maxT > 1 && (
                          <div className="mt-2 text-[10px] text-slate-500 leading-snug">
                            Execução: {maxT} trades de 1 contrato <span className="text-slate-400">OU</span> 1 trade de {maxT} contratos — mesma distância em pontos. <span className="text-amber-400/80">Não reduzir stop/target para "compensar" mais contratos.</span>
                          </div>
                        )}
                        <div className="mt-1 text-[10px] text-slate-500 italic">
                          Stops em pontos a definir conforme instrumento.
                        </div>
                      </div>

                      {/* BLOCO 3 — Ritmo de acumulação (contexto, NÃO meta) */}
                      {attackPlan.dailyTarget > 0 && (
                        <div className="pt-2 border-t border-slate-700/50">
                          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">
                            Ritmo de acumulação (contexto, não meta)
                          </div>
                          <div className="text-xs text-slate-400">
                            EV esperado: <span className="font-mono">${attackPlan.dailyTarget?.toLocaleString()}/dia</span> — média estatística para acumular o profit target em {attackPlan.evalBusinessDays ?? '—'} dias úteis. <span className="text-slate-500">Não é o alvo do dia.</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Template info */}
                {selectedTemplate && (
                  <div className="text-xs text-slate-500 space-y-0.5">
                    <div>DD máx: ${selectedTemplate.drawdown?.maxAmount?.toLocaleString()} ({selectedTemplate.drawdown?.type})</div>
                    <div>Target: ${selectedTemplate.profitTarget?.toLocaleString()}</div>
                    {selectedTemplate.evalTimeLimit && <div>Prazo eval: {selectedTemplate.evalTimeLimit} dias corridos</div>}
                    {selectedTemplate.dailyLossLimit && <div>Daily loss: ${selectedTemplate.dailyLossLimit?.toLocaleString()}</div>}
                    {selectedTemplate.restrictedInstruments?.length > 0 && (
                      <div className="text-amber-400/80">⚠ Instrumentos restritos: {selectedTemplate.restrictedInstruments.join(', ')}</div>
                    )}
                  </div>
                )}

                {errors.propFirm && <span className="text-xs text-red-400">{errors.propFirm}</span>}
              </div>
            )}

            {/* Corretora */}
            <div className="input-group mb-4">
              <label className="input-label flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Corretora *
              </label>
              <select
                name="broker"
                value={formData.broker}
                onChange={handleChange}
                className={errors.broker ? 'ring-2 ring-red-500/50' : ''}
              >
                <option value="">Selecione a corretora</option>
                {availableBrokers.map((broker, index) => (
                  <option key={broker.id || index} value={broker.name}>
                    {broker.name}
                  </option>
                ))}
              </select>
              {errors.broker && <span className="text-xs text-red-400">{errors.broker}</span>}
            </div>

            {/* Grid: Saldo Inicial e Moeda */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* Saldo Inicial */}
              <div className="input-group">
                <label className="input-label flex items-center gap-2">
                  <Coins className="w-4 h-4" />
                  Saldo Inicial *
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="number"
                    name="initialBalance"
                    value={formData.initialBalance}
                    onChange={handleChange}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className={`pl-10 ${errors.initialBalance ? 'ring-2 ring-red-500/50' : ''}`}
                  />
                </div>
                {errors.initialBalance && <span className="text-xs text-red-400">{errors.initialBalance}</span>}
              </div>

              {/* Moeda */}
              <div className="input-group">
                <label className="input-label">Moeda *</label>
                <select
                  name="currency"
                  value={formData.currency}
                  onChange={handleChange}
                >
                  {availableCurrencies.map(currency => (
                    <option key={currency.code} value={currency.code}>
                      {currency.symbol} - {currency.code}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Info sobre edição */}
            {editAccount && (
              <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <p className="text-sm text-blue-300">
                  💡 O saldo atual ({formData.currency === 'BRL' ? 'R$' : formData.currency === 'USD' ? '$' : '€'} {editAccount.currentBalance?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0.00'}) é calculado automaticamente baseado nos trades e movimentações.
                </p>
              </div>
            )}

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
                disabled={loading || masterDataLoading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Salvando...
                  </>
                ) : editAccount ? (
                  'Salvar Alterações'
                ) : (
                  'Criar Conta'
                )}
              </button>
            </div>
          </form>
        </div>
        <DebugBadge component="AddAccountModal" />
      </div>
    </>
  );
};

export default AddAccountModal;
