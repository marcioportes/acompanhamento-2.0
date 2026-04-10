/**
 * PropFirmConfigPage
 * @description Configuração de templates de mesas proprietárias (prop firms)
 *
 * Catálogo de templates reutilizáveis (collection raiz propFirmTemplates).
 * Mentor configura uma vez, alunos selecionam ao criar conta tipo PROP.
 *
 * Suporta embedded mode (dentro do SettingsPage) e standalone.
 * Ref: issue #52, DEC-053
 */

import { useState } from 'react';
import {
  Trophy, Plus, Trash2, Edit3, Save, Loader2,
  AlertTriangle, CheckCircle, Upload, ChevronDown, ChevronUp
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePropFirmTemplates } from '../hooks/usePropFirmTemplates';
import {
  PROP_FIRM_LABELS,
  DRAWDOWN_TYPE_LABELS,
  DAILY_LOSS_ACTIONS,
  FEE_MODELS,
  DEFAULT_TEMPLATES,
  EMPTY_TEMPLATE
} from '../constants/propFirmDefaults';
import DebugBadge from '../components/DebugBadge';

const PropFirmConfigPage = ({ embedded = false }) => {
  const { isMentor } = useAuth();
  const {
    templates,
    loading,
    error,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    deleteAllTemplates,
    seedDefaults
  } = usePropFirmTemplates();

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [feedback, setFeedback] = useState(null);

  if (!isMentor()) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-slate-400">Acesso restrito ao mentor.</p>
      </div>
    );
  }

  const showFeedback = (msg, type = 'success') => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleSeedDefaults = async () => {
    if (templates.length > 0) {
      if (!window.confirm(`Já existem ${templates.length} templates. Seed vai sobrescrever os defaults. Continuar?`)) return;
    }
    setSeeding(true);
    try {
      await seedDefaults();
      showFeedback(`${DEFAULT_TEMPLATES.length} templates carregados`);
    } catch (err) {
      showFeedback(err.message, 'error');
    }
    setSeeding(false);
  };

  const handleStartEdit = (template) => {
    setEditingId(template.id);
    setEditForm({ ...template });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleSaveEdit = async () => {
    if (!editForm) return;
    setSaving(true);
    try {
      const { id, createdAt, updatedAt, ...data } = editForm;
      await updateTemplate(editingId, data);
      showFeedback('Template atualizado');
      handleCancelEdit();
    } catch (err) {
      showFeedback(err.message, 'error');
    }
    setSaving(false);
  };

  const handleDelete = async (templateId, templateName) => {
    if (!window.confirm(`Deletar template "${templateName}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await deleteTemplate(templateId);
      showFeedback('Template removido');
    } catch (err) {
      showFeedback(err.message, 'error');
    }
  };

  const handleAddCustom = async () => {
    setSaving(true);
    try {
      const id = await addTemplate({ ...EMPTY_TEMPLATE, name: 'Novo Template Custom' });
      setEditingId(id);
      setEditForm({ ...EMPTY_TEMPLATE, id, name: 'Novo Template Custom' });
      showFeedback('Template criado — edite os campos');
    } catch (err) {
      showFeedback(err.message, 'error');
    }
    setSaving(false);
  };

  // Agrupar por firma para exibição
  const grouped = {};
  for (const t of templates) {
    const firm = t.firm ?? 'CUSTOM';
    if (!grouped[firm]) grouped[firm] = [];
    grouped[firm].push(t);
  }

  const content = (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-purple-500/15 ring-1 ring-purple-500/20">
            <Trophy className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-display font-bold text-white">Templates de Mesas Proprietárias</h2>
            <p className="text-xs text-slate-500">{templates.length} templates configurados</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleAddCustom}
            disabled={saving}
            className="btn-secondary text-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Custom
          </button>
          <button
            onClick={handleSeedDefaults}
            disabled={seeding}
            className="btn-secondary text-sm flex items-center gap-1.5"
          >
            {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Seed Defaults
          </button>
          {templates.length > 0 && (
            <button
              onClick={async () => {
                if (!window.confirm(`Deletar todos os ${templates.length} templates? Esta ação não pode ser desfeita.`)) return;
                setClearing(true);
                try {
                  await deleteAllTemplates();
                  showFeedback(`${templates.length} templates removidos`);
                } catch (err) {
                  showFeedback(err.message, 'error');
                }
                setClearing(false);
              }}
              disabled={clearing}
              className="btn-secondary text-sm flex items-center gap-1.5 text-red-400 hover:text-red-300"
            >
              {clearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Limpar Todos
            </button>
          )}
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`p-3 rounded-xl flex items-center gap-2 text-sm ${
          feedback.type === 'error'
            ? 'bg-red-500/10 border border-red-500/30 text-red-400'
            : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
        }`}>
          {feedback.type === 'error'
            ? <AlertTriangle className="w-4 h-4" />
            : <CheckCircle className="w-4 h-4" />
          }
          {feedback.msg}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      )}

      {/* Empty state */}
      {!loading && templates.length === 0 && (
        <div className="text-center p-12 bg-slate-900/40 rounded-2xl border border-slate-800/40">
          <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-white font-medium mb-1">Nenhum template configurado</h3>
          <p className="text-sm text-slate-500 mb-4">
            Clique em "Seed Defaults" para carregar templates pré-configurados (Apex, MFF, Lucid).
          </p>
        </div>
      )}

      {/* Templates agrupados por firma */}
      {Object.entries(grouped).map(([firm, firmTemplates]) => (
        <div key={firm} className="bg-slate-900/60 backdrop-blur-sm border border-slate-800/60 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800/40">
            <h3 className="text-sm font-semibold text-purple-300">
              {PROP_FIRM_LABELS[firm] ?? firm}
              <span className="text-slate-500 font-normal ml-2">({firmTemplates.length} produtos)</span>
            </h3>
          </div>

          <div className="divide-y divide-slate-800/40">
            {firmTemplates.map(template => {
              const isEditing = editingId === template.id;
              const isExpanded = expandedId === template.id;

              return (
                <div key={template.id} className="px-5 py-3">
                  {/* Row header */}
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : template.id)}
                      className="flex items-center gap-2 text-left flex-1 min-w-0"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                      <span className="text-sm text-white font-medium truncate">{template.name}</span>
                      <span className="text-xs text-slate-500">
                        ${template.accountSize?.toLocaleString()} · {DRAWDOWN_TYPE_LABELS[template.drawdown?.type] ?? template.drawdown?.type}
                      </span>
                    </button>
                    <div className="flex items-center gap-1.5 ml-2">
                      <button
                        onClick={() => handleStartEdit(template)}
                        className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(template.id, template.name)}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Deletar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && !isEditing && (
                    <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs pl-6">
                      <div className="text-slate-500">DD máximo:</div>
                      <div className="text-slate-300">${template.drawdown?.maxAmount?.toLocaleString()}</div>
                      <div className="text-slate-500">Profit target:</div>
                      <div className="text-slate-300">${template.profitTarget?.toLocaleString() ?? '—'}</div>
                      <div className="text-slate-500">Daily loss:</div>
                      <div className="text-slate-300">{template.dailyLossLimit ? `$${template.dailyLossLimit.toLocaleString()} (${template.dailyLossAction === 'PAUSE_DAY' ? 'pausa dia' : 'falha conta'})` : '—'}</div>
                      <div className="text-slate-500">Eval prazo:</div>
                      <div className="text-slate-300">{template.evalTimeLimit ? `${template.evalTimeLimit} dias` : 'Sem limite'}</div>
                      <div className="text-slate-500">Min trading days:</div>
                      <div className="text-slate-300">{template.evalMinTradingDays ?? 0}</div>
                      <div className="text-slate-500">Consistency:</div>
                      <div className="text-slate-300">{template.consistency?.evalRule ? `${(template.consistency.evalRule * 100).toFixed(0)}%` : '—'}</div>
                      <div className="text-slate-500">Max contratos:</div>
                      <div className="text-slate-300">{template.contracts?.max ?? '—'}</div>
                      <div className="text-slate-500">Payout split:</div>
                      <div className="text-slate-300">{template.payout?.split ? `${(template.payout.split * 100).toFixed(0)}%` : '—'}</div>
                      <div className="text-slate-500">Fee model:</div>
                      <div className="text-slate-300">{template.feeModel === 'ONE_TIME' ? 'Pagamento único' : 'Recorrente'}</div>
                      <div className="text-slate-500">Bracket orders:</div>
                      <div className="text-slate-300">{template.bracketOrderRequired ? 'Obrigatório' : 'Não'}</div>
                      <div className="text-slate-500">Horário limite:</div>
                      <div className="text-slate-300">{template.tradingHours?.close ?? '—'} {template.tradingHours?.timezone ?? ''}</div>
                      {template.restrictedInstruments?.length > 0 && (
                        <>
                          <div className="text-amber-400/80">Restritos:</div>
                          <div className="text-amber-400/80">{template.restrictedInstruments.join(', ')}</div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Edit form (inline) */}
                  {isEditing && editForm && (
                    <div className="mt-3 pl-6 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-slate-500">Nome</label>
                          <input
                            type="text"
                            value={editForm.name ?? ''}
                            onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">Account Size ($)</label>
                          <input
                            type="number"
                            value={editForm.accountSize ?? 0}
                            onChange={(e) => setEditForm(prev => ({ ...prev, accountSize: parseInt(e.target.value) || 0 }))}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">DD Máximo ($)</label>
                          <input
                            type="number"
                            value={editForm.drawdown?.maxAmount ?? 0}
                            onChange={(e) => setEditForm(prev => ({
                              ...prev,
                              drawdown: { ...prev.drawdown, maxAmount: parseInt(e.target.value) || 0 }
                            }))}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">Tipo DD</label>
                          <select
                            value={editForm.drawdown?.type ?? 'TRAILING_EOD'}
                            onChange={(e) => setEditForm(prev => ({
                              ...prev,
                              drawdown: { ...prev.drawdown, type: e.target.value }
                            }))}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-sm"
                          >
                            {Object.entries(DRAWDOWN_TYPE_LABELS).map(([k, v]) => (
                              <option key={k} value={k}>{v}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">Profit Target ($)</label>
                          <input
                            type="number"
                            value={editForm.profitTarget ?? ''}
                            onChange={(e) => setEditForm(prev => ({ ...prev, profitTarget: parseInt(e.target.value) || null }))}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">Daily Loss Limit ($)</label>
                          <input
                            type="number"
                            value={editForm.dailyLossLimit ?? ''}
                            onChange={(e) => setEditForm(prev => ({ ...prev, dailyLossLimit: parseInt(e.target.value) || null }))}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">Eval Prazo (dias)</label>
                          <input
                            type="number"
                            value={editForm.evalTimeLimit ?? ''}
                            onChange={(e) => setEditForm(prev => ({ ...prev, evalTimeLimit: parseInt(e.target.value) || null }))}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">Max Contratos</label>
                          <input
                            type="number"
                            value={editForm.contracts?.max ?? 0}
                            onChange={(e) => setEditForm(prev => ({
                              ...prev,
                              contracts: { ...prev.contracts, max: parseInt(e.target.value) || 0 }
                            }))}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-2">
                        <button
                          onClick={handleSaveEdit}
                          disabled={saving}
                          className="btn-primary text-xs flex items-center gap-1.5"
                        >
                          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                          Salvar
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="btn-secondary text-xs"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-400">
          Erro: {error}
        </div>
      )}
    </div>
  );

  if (embedded) return content;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      {!embedded && <DebugBadge component="PropFirmConfigPage" />}
      <div className="max-w-4xl mx-auto">
        {content}
      </div>
    </div>
  );
};

export default PropFirmConfigPage;
