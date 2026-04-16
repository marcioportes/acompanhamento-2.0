/**
 * PropAiApproachPlanSection
 * @description Seção colapsável dentro do PropAccountCard que exibe o "Plano de Approach com IA"
 *   gerado pela CF `generatePropFirmApproachPlan` (Sonnet 4.6). Complementa o plano determinístico
 *   com narrativa estratégica, cenários e guidance comportamental.
 *
 * Features:
 * - Botão "Gerar Plano com IA" com loading state
 * - Indicador de cota restante (X/5 gerações)
 * - Renderização da narrativa estruturada (approach, execução, cenários, guidance, milestones)
 * - Badge "Plano determinístico" quando aiUnavailable
 * - Aviso explícito quando dataSource === 'defaults' (incentiva completar 4D)
 * - Erro handling (quota esgotada, falha de rede)
 *
 * Ref: issue #133, epic #52 Fase 2.5
 */

import { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, AlertCircle, Loader2, CheckCircle2, XCircle, MinusCircle } from 'lucide-react';
import { useAiApproachPlan } from '../../hooks/useAiApproachPlan';
import { formatCurrencyDynamic } from '../../utils/currency';

const SCENARIO_ICONS = {
  'Dia ideal': CheckCircle2,
  'Dia médio': MinusCircle,
  'Dia ruim': XCircle,
  'Sequência de losses': AlertCircle,
};

const SCENARIO_COLORS = {
  'Dia ideal': 'text-emerald-400',
  'Dia médio': 'text-slate-400',
  'Dia ruim': 'text-red-400',
  'Sequência de losses': 'text-amber-400',
};

function Section({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-700/40 rounded bg-slate-800/30">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-700/20 transition-colors"
      >
        <span className="text-[11px] font-medium text-slate-300 uppercase tracking-wider">{title}</span>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
      </button>
      {open && <div className="px-3 pb-3 text-[12px] text-slate-300 space-y-2">{children}</div>}
    </div>
  );
}

function PlanView({ plan, currency }) {
  if (!plan) return null;
  const { approach, executionPlan, scenarios = [], behavioralGuidance, milestones = [] } = plan;

  return (
    <div className="space-y-2">
      {/* Summary */}
      <div className="p-3 rounded bg-slate-800/40 border border-slate-700/40">
        <p className="text-[12px] text-slate-200 leading-relaxed">{approach?.summary}</p>
        {approach?.profileOverride && (
          <p className="mt-2 text-[11px] text-amber-400 flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{approach.profileOverride}</span>
          </p>
        )}
      </div>

      {/* Approach (sessões + profiles) */}
      <Section title="Approach — sessões & profiles" defaultOpen={false}>
        {approach?.sessionRecommendation && (
          <div>
            <p><span className="text-slate-500">Primária:</span> <span className="text-white uppercase">{approach.sessionRecommendation.primary}</span>{approach.sessionRecommendation.secondary && <> · <span className="text-slate-500">secundária:</span> <span className="text-white uppercase">{approach.sessionRecommendation.secondary}</span></>}{approach.sessionRecommendation.avoid && <> · <span className="text-slate-500">evitar:</span> <span className="text-red-400 uppercase">{approach.sessionRecommendation.avoid}</span></>}</p>
            {approach.sessionRecommendation.reasoning && <p className="mt-1 text-slate-400 italic">{approach.sessionRecommendation.reasoning}</p>}
          </div>
        )}
        {approach?.dailyProfiles && (
          <div className="pt-2 border-t border-slate-700/40">
            <p><span className="text-slate-500">Recomendados:</span> <span className="text-emerald-400">{(approach.dailyProfiles.recommended ?? []).join(', ') || '—'}</span></p>
            {(approach.dailyProfiles.avoid ?? []).length > 0 && <p><span className="text-slate-500">Evitar:</span> <span className="text-red-400">{approach.dailyProfiles.avoid.join(', ')}</span></p>}
            {approach.dailyProfiles.reasoning && <p className="mt-1 text-slate-400 italic">{approach.dailyProfiles.reasoning}</p>}
          </div>
        )}
      </Section>

      {/* Execution plan */}
      <Section title="Plano de execução">
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          <p><span className="text-slate-500">Estilo:</span> <span className="text-white">{executionPlan?.tradingStyle ?? '—'}</span></p>
          <p><span className="text-slate-500">RR:</span> <span className="text-white">1:{plan?.executionPlan?.targetPoints && plan?.executionPlan?.stopPoints ? (executionPlan.targetPoints / executionPlan.stopPoints).toFixed(1) : '—'}</span></p>
          <p><span className="text-slate-500">Stop:</span> <span className="text-white font-mono">{executionPlan?.stopPoints}pts</span></p>
          <p><span className="text-slate-500">Target:</span> <span className="text-white font-mono">{executionPlan?.targetPoints}pts</span></p>
          <p><span className="text-slate-500">RO:</span> <span className="text-white font-mono">{formatCurrencyDynamic(executionPlan?.roUSD ?? 0, currency)}</span></p>
          <p><span className="text-slate-500">Max trades/dia:</span> <span className="text-white font-mono">{executionPlan?.maxTradesPerDay}</span></p>
        </div>
        {executionPlan?.entryStrategy && <p className="pt-1 border-t border-slate-700/40"><span className="text-slate-500">Entrada:</span> {executionPlan.entryStrategy}</p>}
        {executionPlan?.exitStrategy && <p><span className="text-slate-500">Saída:</span> {executionPlan.exitStrategy}</p>}
        {executionPlan?.pathRecommendation && <p className="text-amber-300/80 italic">{executionPlan.pathRecommendation}</p>}
      </Section>

      {/* Scenarios */}
      <Section title="Cenários de dia" defaultOpen>
        <div className="space-y-1.5">
          {scenarios.map((s, i) => {
            const Icon = SCENARIO_ICONS[s.name] ?? MinusCircle;
            const color = SCENARIO_COLORS[s.name] ?? 'text-slate-400';
            return (
              <div key={i} className="flex items-start gap-2 p-2 rounded bg-slate-800/40">
                <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${color}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={`font-medium ${color}`}>{s.name}</p>
                    <p className={`font-mono text-[11px] ${s.result >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {s.result >= 0 ? '+' : ''}{formatCurrencyDynamic(s.result, currency)}
                    </p>
                  </div>
                  <p className="text-slate-400 text-[11px] mt-0.5">{s.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Behavioral guidance */}
      {behavioralGuidance && (
        <Section title="Guidance comportamental">
          {behavioralGuidance.preSession && <p><span className="text-slate-500">Pré-sessão:</span> {behavioralGuidance.preSession}</p>}
          {behavioralGuidance.duringSession && <p><span className="text-slate-500">Durante:</span> {behavioralGuidance.duringSession}</p>}
          {behavioralGuidance.afterLoss && <p><span className="text-slate-500">Após loss:</span> {behavioralGuidance.afterLoss}</p>}
          {behavioralGuidance.afterWin && <p><span className="text-slate-500">Após win:</span> {behavioralGuidance.afterWin}</p>}
          {behavioralGuidance.deadlineManagement && <p><span className="text-slate-500">Prazo:</span> {behavioralGuidance.deadlineManagement}</p>}
          {(behavioralGuidance.personalWarnings ?? []).length > 0 && (
            <div className="pt-1 border-t border-slate-700/40">
              {behavioralGuidance.personalWarnings.map((w, i) => (
                <p key={i} className="text-amber-400 flex items-start gap-1.5"><AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />{w}</p>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Milestones */}
      {milestones.length > 0 && (
        <Section title="Milestones">
          {milestones.map((m, i) => (
            <p key={i} className="flex items-baseline gap-2">
              <span className="text-slate-500 font-mono">D{m.day}</span>
              <span className="text-emerald-400 font-mono">{formatCurrencyDynamic(m.targetBalance, currency)}</span>
              <span className="text-slate-400">{m.description}</span>
            </p>
          ))}
        </Section>
      )}
    </div>
  );
}

const PropAiApproachPlanSection = ({ account, template, trader4DProfile, traderIndicators, phase = 'EVALUATION' }) => {
  const [open, setOpen] = useState(false);
  const {
    generate,
    loading,
    error,
    plan,
    aiUnavailable,
    generationCount,
    remaining,
    limitReached,
    dataSource,
    MAX_GENERATIONS,
  } = useAiApproachPlan({ account, template, trader4DProfile, traderIndicators, phase });

  const currency = account?.currency ?? 'USD';
  const hasPlan = Boolean(plan);
  const isDefaultsScenario = dataSource === 'defaults';

  return (
    <div className="border-t border-slate-700/50 pt-3">
      {/* Header colapsável */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="text-[12px] font-medium text-slate-200">Plano de Approach com IA</span>
          {hasPlan && !aiUnavailable && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30">IA</span>
          )}
          {aiUnavailable && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700/50 text-slate-400 border border-slate-600/40">determinístico</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 font-mono">{generationCount}/{MAX_GENERATIONS}</span>
          {open ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </div>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Aviso cenário defaults */}
          {isDefaultsScenario && !hasPlan && (
            <div className="p-2 rounded border border-amber-500/30 bg-amber-500/10 text-[11px] text-amber-300 flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>Sem assessment 4D ou histórico de trades, a IA não gera plano personalizado. Complete seu assessment para desbloquear a narrativa estratégica.</span>
            </div>
          )}

          {/* Loading state prominente — CF pode levar 30-60s */}
          {loading && (
            <div className="p-4 rounded border border-purple-500/40 bg-purple-500/10 flex items-start gap-3 animate-pulse">
              <Loader2 className="w-5 h-5 text-purple-300 animate-spin flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-purple-200">Gerando plano com IA…</p>
                <p className="text-[11px] text-purple-300/70 mt-1">Claude Sonnet 4.6 está analisando seu perfil + a mesa. Pode levar 30–60 segundos (a IA valida coerência mecânica e refaz se necessário).</p>
              </div>
            </div>
          )}

          {/* Controles */}
          {!hasPlan && !loading && (
            <button
              type="button"
              onClick={generate}
              disabled={limitReached}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded border border-purple-500/40 bg-purple-500/10 text-purple-200 text-[12px] font-medium hover:bg-purple-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-4 h-4" />
              {isDefaultsScenario ? 'Gerar plano determinístico' : 'Gerar plano com IA'}
            </button>
          )}

          {hasPlan && !loading && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">
                {aiUnavailable ? 'Plano determinístico (IA indisponível)' : `Plano gerado via IA — ${remaining} geração${remaining === 1 ? '' : 'ões'} restante${remaining === 1 ? '' : 's'}`}
              </span>
              <button
                type="button"
                onClick={generate}
                disabled={limitReached}
                className="px-2 py-1 rounded border border-slate-600/50 text-slate-300 text-[10px] hover:bg-slate-700/40 disabled:opacity-50"
              >
                {limitReached ? 'Limite atingido' : 'Regenerar'}
              </button>
            </div>
          )}

          {/* Erro */}
          {error && (
            <div className="p-2 rounded border border-red-500/30 bg-red-500/10 text-[11px] text-red-300 flex items-start gap-2">
              <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{error.message ?? 'Erro ao gerar plano.'}</span>
            </div>
          )}

          {/* Plano */}
          {hasPlan && <PlanView plan={plan} currency={currency} />}
        </div>
      )}
    </div>
  );
};

export default PropAiApproachPlanSection;
