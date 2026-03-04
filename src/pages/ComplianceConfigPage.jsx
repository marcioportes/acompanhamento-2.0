/**
 * ComplianceConfigPage
 * @version 1.0.0 (Fase 1.3.2)
 * @description Configuração de regras de compliance emocional pelo mentor
 * 
 * SEÇÕES:
 * - Detecção de TILT (consecutiveTrades, maxInterval, requireNegativeResult)
 * - Detecção de REVENGE (tradesInWindow, windowMinutes, qtyMultiplier)
 * - Overtrading (maxTradesPerDay, warningThreshold)
 * - Thresholds de Status do Aluno (HEALTHY/ATTENTION/WARNING/CRITICAL)
 * - Notificações
 * 
 * FIRESTORE: mentorConfig/{mentorId} (documento único)
 */

import { useState, useEffect } from 'react';
import {
  Settings, Shield, Zap, BarChart3, Bell,
  Save, RotateCcw, CheckCircle, AlertTriangle,
  Activity, Target, Clock, TrendingDown, Loader2
} from 'lucide-react';
import { useComplianceRules } from '../hooks/useComplianceRules';
import DebugBadge from '../components/DebugBadge';

// ============================================
// SUB-COMPONENTS
// ============================================

const SectionCard = ({ icon: Icon, title, description, children, accentColor = 'blue' }) => (
  <div className="relative bg-slate-900/60 backdrop-blur-sm border border-slate-800/60 rounded-2xl overflow-hidden">
    {/* Accent line top */}
    <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-${accentColor}-500/80 to-transparent`} />
    
    <div className="p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 rounded-xl bg-${accentColor}-500/15 ring-1 ring-${accentColor}-500/20`}>
          <Icon className={`w-5 h-5 text-${accentColor}-400`} />
        </div>
        <div>
          <h3 className="font-semibold text-white text-[15px]">{title}</h3>
          {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
        </div>
      </div>
      {children}
    </div>
  </div>
);

const FieldRow = ({ label, description, children }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-slate-800/40 last:border-0">
    <div className="flex-1 min-w-0 pr-4">
      <span className="text-sm text-slate-300">{label}</span>
      {description && <p className="text-[11px] text-slate-500 mt-0.5">{description}</p>}
    </div>
    <div className="flex-shrink-0">
      {children}
    </div>
  </div>
);

const Toggle = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    onClick={() => !disabled && onChange(!checked)}
    className={`
      relative w-11 h-6 rounded-full transition-colors duration-200 
      ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      ${checked ? 'bg-blue-600' : 'bg-slate-700'}
    `}
  >
    <div className={`
      absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm 
      transition-transform duration-200
      ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}
    `} />
  </button>
);

const NumberInput = ({ value, onChange, min, max, step = 1, suffix, disabled, width = 'w-20' }) => (
  <div className="flex items-center gap-1.5">
    <input
      type="number"
      value={value}
      onChange={(e) => {
        const v = step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
        if (!isNaN(v)) onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v)));
      }}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className={`${width} bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 
                  text-white text-sm font-mono text-center
                  focus:border-blue-500 focus:outline-none disabled:opacity-50
                  [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
    />
    {suffix && <span className="text-xs text-slate-500">{suffix}</span>}
  </div>
);

const StatusBar = ({ label, emoji, color, value, onChange }) => (
  <div className="flex items-center gap-3 py-2">
    <span className="text-lg">{emoji}</span>
    <span className={`text-sm font-medium w-24 ${color}`}>{label}</span>
    <span className="text-xs text-slate-500">Score ≥</span>
    <NumberInput value={value} onChange={onChange} min={0} max={100} width="w-16" />
  </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

const ComplianceConfigPage = ({ embedded = false }) => {
  const {
    config, save, reset, loading, saving, error, lastSaved, defaults, isMentor
  } = useComplianceRules();

  // Local state para edição (não salva a cada keystroke)
  const [form, setForm] = useState(config);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync form quando config carrega do Firestore
  useEffect(() => {
    setForm(config);
    setHasChanges(false);
  }, [config]);

  // Helpers para atualizar form
  const updateField = (section, field, value) => {
    setForm(prev => ({
      ...prev,
      [section]: { ...prev[section], [field]: value }
    }));
    setHasChanges(true);
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    try {
      await save(form);
      setHasChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      // error is set by hook
    }
  };

  const handleReset = async () => {
    if (window.confirm('Restaurar todas as configurações para os valores padrão?')) {
      await reset();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (!isMentor) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        <p>Apenas mentores podem acessar configurações.</p>
      </div>
    );
  }

  return (
    <div className={embedded ? '' : 'min-h-screen p-6 lg:p-8 max-w-4xl mx-auto'}>
      {/* Header — apenas standalone */}
      {!embedded && (
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                <Settings className="w-6 h-6 text-slate-400" />
                Configurações de Compliance
              </h1>
              <p className="text-slate-400 mt-1 text-sm">
                Defina as regras de detecção comportamental e thresholds de status dos alunos
              </p>
            </div>
            {lastSaved && (
              <span className="text-[11px] text-slate-600">
                Salvo: {new Date(lastSaved?.seconds ? lastSaved.seconds * 1000 : lastSaved).toLocaleString('pt-BR')}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="space-y-5">

        {/* ==================== TILT ==================== */}
        <SectionCard
          icon={Zap}
          title="Detecção de TILT"
          description="Sequência de trades com emoção negativa após resultados ruins"
          accentColor="amber"
        >
          <div className="space-y-0">
            <FieldRow label="Habilitado">
              <Toggle
                checked={form.tilt.enabled}
                onChange={(v) => updateField('tilt', 'enabled', v)}
              />
            </FieldRow>
            <FieldRow
              label="Trades consecutivos"
              description="Mínimo de trades na sequência para detectar TILT"
            >
              <NumberInput
                value={form.tilt.consecutiveTrades}
                onChange={(v) => updateField('tilt', 'consecutiveTrades', v)}
                min={2} max={10}
                disabled={!form.tilt.enabled}
              />
            </FieldRow>
            <FieldRow
              label="Intervalo máximo"
              description="Tempo máximo entre trades para considerar mesma sequência"
            >
              <NumberInput
                value={form.tilt.maxIntervalMinutes}
                onChange={(v) => updateField('tilt', 'maxIntervalMinutes', v)}
                min={5} max={240}
                suffix="min"
                disabled={!form.tilt.enabled}
              />
            </FieldRow>
            <FieldRow label="Apenas trades com loss">
              <Toggle
                checked={form.tilt.requireNegativeResult}
                onChange={(v) => updateField('tilt', 'requireNegativeResult', v)}
                disabled={!form.tilt.enabled}
              />
            </FieldRow>
          </div>
        </SectionCard>

        {/* ==================== REVENGE ==================== */}
        <SectionCard
          icon={TrendingDown}
          title="Detecção de REVENGE"
          description="Operações impulsivas tentando recuperar losses rapidamente"
          accentColor="red"
        >
          <div className="space-y-0">
            <FieldRow label="Habilitado">
              <Toggle
                checked={form.revenge.enabled}
                onChange={(v) => updateField('revenge', 'enabled', v)}
              />
            </FieldRow>
            <FieldRow
              label="Trades na janela"
              description="Quantidade de trades rápidos que indica revenge"
            >
              <NumberInput
                value={form.revenge.tradesInWindow}
                onChange={(v) => updateField('revenge', 'tradesInWindow', v)}
                min={2} max={10}
                disabled={!form.revenge.enabled}
              />
            </FieldRow>
            <FieldRow
              label="Janela de tempo"
              description="Intervalo para considerar trades como sequência rápida"
            >
              <NumberInput
                value={form.revenge.windowMinutes}
                onChange={(v) => updateField('revenge', 'windowMinutes', v)}
                min={5} max={120}
                suffix="min"
                disabled={!form.revenge.enabled}
              />
            </FieldRow>
            <FieldRow
              label="Multiplicador de posição"
              description="Aumento de qty em relação à média que indica revenge"
            >
              <NumberInput
                value={form.revenge.qtyMultiplier}
                onChange={(v) => updateField('revenge', 'qtyMultiplier', v)}
                min={1.1} max={5} step={0.1}
                suffix="x"
                disabled={!form.revenge.enabled}
              />
            </FieldRow>
            <FieldRow label="Apenas após loss">
              <Toggle
                checked={form.revenge.afterLossOnly}
                onChange={(v) => updateField('revenge', 'afterLossOnly', v)}
                disabled={!form.revenge.enabled}
              />
            </FieldRow>
          </div>
        </SectionCard>

        {/* ==================== OVERTRADING ==================== */}
        <SectionCard
          icon={Activity}
          title="Detecção de Overtrading"
          description="Limite de operações diárias para evitar excesso"
          accentColor="purple"
        >
          <div className="space-y-0">
            <FieldRow label="Habilitado">
              <Toggle
                checked={form.overtrading.enabled}
                onChange={(v) => updateField('overtrading', 'enabled', v)}
              />
            </FieldRow>
            <FieldRow
              label="Máximo de trades/dia"
              description="Limite absoluto de operações por dia"
            >
              <NumberInput
                value={form.overtrading.maxTradesPerDay}
                onChange={(v) => updateField('overtrading', 'maxTradesPerDay', v)}
                min={1} max={50}
                disabled={!form.overtrading.enabled}
              />
            </FieldRow>
            <FieldRow
              label="Threshold de alerta"
              description="Porcentagem do limite para gerar warning"
            >
              <NumberInput
                value={Math.round(form.overtrading.warningThreshold * 100)}
                onChange={(v) => updateField('overtrading', 'warningThreshold', v / 100)}
                min={50} max={100}
                suffix="%"
                disabled={!form.overtrading.enabled}
              />
            </FieldRow>
          </div>
        </SectionCard>

        {/* ==================== STATUS THRESHOLDS ==================== */}
        <SectionCard
          icon={Target}
          title="Thresholds de Status"
          description="Faixas de score que determinam o status emocional do aluno"
          accentColor="emerald"
        >
          <div className="bg-slate-800/30 rounded-xl p-4 space-y-1">
            <StatusBar
              emoji="🟢" label="Saudável" color="text-emerald-400"
              value={form.studentStatus.healthyMinScore}
              onChange={(v) => updateField('studentStatus', 'healthyMinScore', v)}
            />
            <StatusBar
              emoji="🟡" label="Atenção" color="text-yellow-400"
              value={form.studentStatus.attentionMinScore}
              onChange={(v) => updateField('studentStatus', 'attentionMinScore', v)}
            />
            <StatusBar
              emoji="🟠" label="Alerta" color="text-orange-400"
              value={form.studentStatus.warningMinScore}
              onChange={(v) => updateField('studentStatus', 'warningMinScore', v)}
            />
            <div className="flex items-center gap-3 py-2">
              <span className="text-lg">🔴</span>
              <span className="text-sm font-medium w-24 text-red-400">Crítico</span>
              <span className="text-xs text-slate-500">Score &lt; {form.studentStatus.warningMinScore}</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-600 mt-2">
            O status CRITICAL é automático para scores abaixo do threshold de Alerta
          </p>
        </SectionCard>

        {/* ==================== NOTIFICAÇÕES ==================== */}
        <SectionCard
          icon={Bell}
          title="Notificações"
          description="Quando você quer ser alertado sobre seus alunos"
          accentColor="blue"
        >
          <div className="space-y-0">
            <FieldRow label="Aluno atingiu status CRITICAL">
              <Toggle
                checked={form.notifications.notifyOnCritical}
                onChange={(v) => updateField('notifications', 'notifyOnCritical', v)}
              />
            </FieldRow>
            <FieldRow label="TILT detectado">
              <Toggle
                checked={form.notifications.notifyOnTilt}
                onChange={(v) => updateField('notifications', 'notifyOnTilt', v)}
              />
            </FieldRow>
            <FieldRow label="REVENGE detectado">
              <Toggle
                checked={form.notifications.notifyOnRevenge}
                onChange={(v) => updateField('notifications', 'notifyOnRevenge', v)}
              />
            </FieldRow>
            <FieldRow label="Resumo diário">
              <Toggle
                checked={form.notifications.notifyDailyDigest}
                onChange={(v) => updateField('notifications', 'notifyDailyDigest', v)}
              />
            </FieldRow>
          </div>
        </SectionCard>

      </div>

      {/* ==================== FOOTER ACTIONS ==================== */}
      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={handleReset}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-400 
                     hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Restaurar Padrão
        </button>

        <div className="flex items-center gap-3">
          {error && (
            <span className="text-xs text-red-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {error}
            </span>
          )}
          {saveSuccess && (
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Configurações salvas
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={`
              flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-all
              ${hasChanges
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }
            `}
          >
            {saving
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Save className="w-4 h-4" />
            }
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      </div>

      {!embedded && <DebugBadge component="ComplianceConfigPage" />}
    </div>
  );
};

export default ComplianceConfigPage;
