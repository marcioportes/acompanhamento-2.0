/**
 * TemplateCard — Zona 3 da PropFirmPage: regras da mesa
 * @description Exibe o contrato do template PROP: firm, product, DD type/amount,
 *   profit target, daily loss limit, consistency rule, eval deadline.
 *   Read-only. Zero lógica de negócio.
 *
 * Ref: issue #145 Fase F, spec v2 §4.1
 */

import { Shield } from 'lucide-react';
import { DRAWDOWN_TYPE_LABELS, PROP_FIRM_PHASE_LABELS } from '../../constants/propFirmDefaults';
import { formatCurrencyDynamic } from '../../utils/currency';

const Row = ({ label, value, muted = false }) => (
  <div className="flex items-baseline justify-between text-xs py-1 border-b border-slate-800/50 last:border-b-0">
    <span className="text-slate-500">{label}</span>
    <span className={muted ? 'text-slate-400' : 'text-white font-medium'}>{value}</span>
  </div>
);

const TemplateCard = ({ template, phase = 'EVALUATION', currency = 'USD' }) => {
  if (!template) {
    return (
      <div className="glass-card border border-slate-700/50 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-bold text-white">Contrato da mesa</h3>
        </div>
        <div className="text-xs text-slate-500">Template não configurado para esta conta.</div>
      </div>
    );
  }

  const fmt = (v) => formatCurrencyDynamic(v, currency);
  const ddType = template.drawdown?.type ? (DRAWDOWN_TYPE_LABELS[template.drawdown.type] ?? template.drawdown.type) : '—';
  const ddAmount = template.drawdown?.maxAmount ?? 0;
  const fundedDd = template.fundedDrawdown?.maxAmount ?? null;
  const consistencyPct = template.consistency?.evalRule ? Math.round(template.consistency.evalRule * 100) : null;
  const hasDailyLoss = template.dailyLossLimit != null && template.dailyLossLimit > 0;
  const isEvaluation = phase === 'EVALUATION';

  return (
    <div className="glass-card border border-slate-700/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-bold text-white">Contrato da mesa</h3>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-slate-500">
          {PROP_FIRM_PHASE_LABELS[phase] ?? phase}
        </span>
      </div>

      <div className="space-y-0">
        <Row label="Firma" value={template.firmName ?? '—'} />
        <Row label="Produto" value={template.productName ?? template.name ?? '—'} />
        <Row label="Tamanho da conta" value={fmt(template.accountSize ?? 0)} />
        <Row label="Drawdown" value={`${fmt(ddAmount)} · ${ddType}`} />
        {fundedDd !== null && (
          <Row label="DD fundado" value={fmt(fundedDd)} muted={phase === 'EVALUATION'} />
        )}
        <Row label="Profit target" value={isEvaluation ? fmt(template.profitTarget ?? 0) : '—'} muted={!isEvaluation} />
        <Row
          label="Daily loss limit"
          value={hasDailyLoss ? fmt(template.dailyLossLimit) : 'N/A (apenas Total Loss)'}
          muted={!hasDailyLoss}
        />
        {consistencyPct !== null && isEvaluation && (
          <Row label="Consistency (melhor dia)" value={`≤ ${consistencyPct}% do profit`} />
        )}
        {isEvaluation && template.evalTimeLimit && (
          <Row label="Prazo avaliação" value={`${template.evalTimeLimit} dias úteis`} />
        )}
      </div>
    </div>
  );
};

export default TemplateCard;
