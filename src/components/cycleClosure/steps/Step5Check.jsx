/**
 * Step5Check.jsx — Etapa 5: Onde você está no mapa de evolução
 *
 * R2.B11 (#259): redesign para acolher o aluno em vez de despejar acrônimos.
 *
 *  - 3 estados visuais por gate: ✓ atendido / ✗ falta / ⊘ aguardando dados
 *  - Cards expansíveis com `whatIs` (o que é) e `howTo` (como atingir)
 *  - Agrupamento por dimensão (Emocional / Financeiro / Operacional)
 *  - Resumo no topo: atendidos / faltam / aguardando
 *  - Próxima fronteira: top 3 gates faltantes
 *
 * Read-only display. Mentor vê atalho pra override discricionário (A7 — futura fase).
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useToast } from '../../../contexts/ToastContext';
import {
  Award, ShieldAlert, Check, X, Clock,
  ChevronDown, ChevronRight,
  Heart, TrendingUp, Settings,
} from 'lucide-react';
import useMaturity from '../../../hooks/useMaturity';
import { GATES_BY_TRANSITION } from '../../../utils/maturityEngine/constants';

const STAGE_NAMES_PT = ['Caos', 'Reativo', 'Metódico', 'Profissional', 'Maestria'];
const STAGE_PITCH = {
  1: 'Estágio inicial — o foco é parar de queimar capital. Disciplina mínima sobre quase tudo.',
  2: 'Estágio reativo — começa a haver regra, mas ela ainda cede sob pressão. Fortalecer rotina.',
  3: 'Estágio metódico — regras são compromisso. Próximo nível requer métricas avançadas e estabilidade.',
  4: 'Estágio profissional — execução sem ruído, métricas de elite. Maestria depende de consistência longa.',
  5: 'Estágio mestre — não há transição. Manter padrão e mentorar.',
};

const DIM_META = {
  emo: { label: 'Emocional',   icon: Heart,      color: 'amber',   bg: 'bg-amber-500/5',   border: 'border-amber-500/20',   accent: 'text-amber-300' },
  fin: { label: 'Financeiro',  icon: TrendingUp, color: 'emerald', bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', accent: 'text-emerald-300' },
  op:  { label: 'Operacional', icon: Settings,   color: 'sky',     bg: 'bg-sky-500/5',     border: 'border-sky-500/20',     accent: 'text-sky-300' },
};

function formatValue(value, unit) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'sim' : 'não';
  if (typeof value !== 'number') return String(value);
  if (unit === '%') {
    // metric tipo 0..100 (winRate vem em pp já) ou 0..1 (journalRate decimal)
    const v = value <= 1 && value >= 0 ? value * 100 : value;
    return `${v.toFixed(1)}%`;
  }
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2);
}

function formatThreshold(threshold, unit) {
  if (threshold === null || threshold === undefined) return '—';
  if (typeof threshold === 'boolean') return threshold ? 'sim' : 'não';
  if (typeof threshold !== 'number') return String(threshold);
  if (unit === '%') {
    const v = threshold <= 1 && threshold >= 0 ? threshold * 100 : threshold;
    return `${v.toFixed(0)}%`;
  }
  if (Number.isInteger(threshold)) return String(threshold);
  return threshold.toFixed(1);
}

function GateCard({ gate, expanded, onToggle }) {
  // gate vem com shape:
  //   { id, label, dim, metric, op, threshold, value, met, gap, reason,
  //     friendlyLabel, unit, whatIs, howTo }
  const dimMeta = DIM_META[gate.dim] || DIM_META.op;
  const isUnavailable = gate.met === null || gate.reason === 'METRIC_UNAVAILABLE';
  const passed = gate.met === true;
  const failed = gate.met === false;

  const statusCfg = isUnavailable
    ? { Icon: Clock,  cls: 'text-slate-500', label: 'aguardando dados', tone: 'bg-slate-700/30 border-slate-700/40' }
    : passed
      ? { Icon: Check, cls: 'text-emerald-400', label: 'atendido', tone: 'bg-emerald-500/10 border-emerald-500/30' }
      : { Icon: X,     cls: 'text-red-400',     label: 'falta',    tone: 'bg-red-500/10 border-red-500/30' };

  const valueStr = formatValue(gate.value, gate.unit);
  const thresholdStr = formatThreshold(gate.threshold, gate.unit);
  const opSymbol = gate.op === '>=' ? '≥' : gate.op === '<=' ? '≤' : gate.op === '<' ? '<' : gate.op === '>' ? '>' : '=';

  const StatusIcon = statusCfg.Icon;

  return (
    <div className={`rounded-lg border ${statusCfg.tone} transition`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-start gap-3 p-3 text-left hover:bg-slate-800/20 transition rounded-lg"
      >
        <StatusIcon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${statusCfg.cls}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-100 leading-snug">
            {gate.friendlyLabel || gate.label}
          </p>
          {!isUnavailable && (
            <p className="text-[11px] text-slate-400 mt-0.5 mono">
              atual: <span className={passed ? 'text-emerald-300' : 'text-red-300'}>{valueStr}</span>
              <span className="text-slate-600 mx-1">·</span>
              alvo: {opSymbol} {thresholdStr}
              {gate.usedCycleData && (
                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 font-normal">
                  este ciclo
                </span>
              )}
            </p>
          )}
          {isUnavailable && (
            <p className="text-[11px] text-slate-500 mt-0.5 italic">
              importar dados de ordens (CSV completo) ou completar autoavaliação 4D pra avaliar este critério
            </p>
          )}
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0 mt-1" /> : <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0 mt-1" />}
      </button>
      {expanded && (gate.whatIs || gate.howTo) && (
        <div className="px-3 pb-3 pt-1 border-t border-slate-700/30 space-y-2 ml-7">
          {gate.whatIs && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">O que é</p>
              <p className="text-xs text-slate-300 leading-relaxed">{gate.whatIs}</p>
            </div>
          )}
          {gate.howTo && !passed && (
            <div>
              <p className={`text-[10px] uppercase tracking-wider mb-0.5 ${dimMeta.accent}`}>Como atingir</p>
              <p className="text-xs text-slate-300 leading-relaxed">{gate.howTo}</p>
            </div>
          )}
          {passed && gate.howTo && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-emerald-400 mb-0.5">Mantenha</p>
              <p className="text-xs text-slate-300 leading-relaxed">{gate.howTo}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DimSection({ dimKey, gates, expandedIds, onToggle }) {
  const meta = DIM_META[dimKey];
  if (!gates.length) return null;
  const Icon = meta.icon;
  const metCount = gates.filter((g) => g.met === true).length;
  const unavCount = gates.filter((g) => g.met === null).length;
  return (
    <section className={`rounded-xl ${meta.bg} border ${meta.border} p-4`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${meta.accent}`} />
        <h4 className={`text-sm font-semibold ${meta.accent}`}>{meta.label}</h4>
        <span className="text-[11px] text-slate-500 ml-auto">
          {metCount} de {gates.length} atendidos{unavCount > 0 ? ` · ${unavCount} aguardando` : ''}
        </span>
      </div>
      <div className="space-y-2">
        {gates.map((g) => (
          <GateCard
            key={g.id}
            gate={g}
            expanded={expandedIds.has(g.id)}
            onToggle={() => onToggle(g.id)}
          />
        ))}
      </div>
    </section>
  );
}

function ScoreBar({ label, value, deltaFromPrior }) {
  if (typeof value !== 'number') {
    return (
      <div className="bg-slate-800/30 rounded-lg p-3">
        <p className="text-[11px] text-slate-500">{label}</p>
        <p className="text-slate-500 italic text-xs mt-1">aguarda dados</p>
      </div>
    );
  }
  const delta = typeof deltaFromPrior === 'number' ? deltaFromPrior : null;
  const arrow = delta == null ? '' : delta > 0 ? '↑' : delta < 0 ? '↓' : '=';
  const arrowCls = delta == null ? 'text-slate-500' : delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-slate-500';
  return (
    <div className="bg-slate-800/30 rounded-lg p-3">
      <p className="text-[11px] text-slate-500 mb-1">{label}</p>
      <div className="flex items-baseline justify-between">
        <p className="text-xl font-bold text-slate-100 mono">{Math.round(value)}</p>
        {delta != null && (
          <span className={`text-xs ${arrowCls}`}>
            {arrow} {Math.abs(delta).toFixed(1)} pts
          </span>
        )}
      </div>
      <div className="gauge-bar mt-2">
        <div className="gauge-fill bg-gradient-to-r from-amber-500 to-emerald-500" style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

// Catálogo indexado por id pra hidratar gates de docs antigos do Firestore
// (snapshots gerados antes do R2.B11 não têm friendlyLabel/whatIs/howTo/unit).
const CATALOG_BY_ID = (() => {
  const map = new Map();
  for (const list of Object.values(GATES_BY_TRANSITION)) {
    for (const g of list) map.set(g.id, g);
  }
  return map;
})();

// Métricas calculáveis a partir dos dados DO CICLO (passados pelo Wizard).
// Gates desses metrics são reavaliados no client com dados frescos, sobrescrevendo
// o valor do doc cacheado (que pode olhar janela histórica).
function buildCycleMetrics({ metrics, snapshot, patterns }) {
  if (!metrics && !snapshot && !patterns) return null;
  const out = {};
  if (typeof metrics?.winRate === 'number') out.winRate = metrics.winRate * 100;          // catálogo em pp
  if (typeof metrics?.profitFactor === 'number' && typeof metrics?.avgLossR === 'number' && metrics.avgLossR !== 0) {
    out.payoff = metrics.avgWinR / Math.abs(metrics.avgLossR);
  } else if (typeof metrics?.profitFactor === 'number') {
    out.payoff = metrics.profitFactor;
  }
  if (typeof metrics?.ruleAdherenceRate === 'number') out.complianceRate = metrics.ruleAdherenceRate * 100;
  // maxDDPercent: snapshot.stopBreach pode ter info melhor; cycle metric vem de metrics.maxDrawdown.percent (decimal)
  if (typeof metrics?.maxDrawdown?.percent === 'number') out.maxDDPercent = Math.abs(metrics.maxDrawdown.percent) * 100;
  // Eventos comportamentais — gates de execução (#208)
  const c = patterns?.eventCounts || {};
  if (typeof c.stopTampering === 'number') out.stopTamperingCount = c.stopTampering;
  if (typeof c.chaseReentry === 'number')   out.chaseCount = c.chaseReentry;
  if (typeof c.partialSizing === 'number')  out.partialStopCount = c.partialSizing;
  return out;
}

function applyOperator(op, value, threshold) {
  if (op === '>=') return value >= threshold;
  if (op === '<=') return value <= threshold;
  if (op === '<')  return value < threshold;
  if (op === '>')  return value > threshold;
  if (op === '==') return value === threshold;
  return false;
}

export default function Step5Check({ studentId, role = 'student', metrics, snapshot, patterns, onMaturity }) {
  const toast = useToast();
  const { maturity, loading } = useMaturity(studentId);
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  const cycleMetrics = useMemo(
    () => buildCycleMetrics({ metrics, snapshot, patterns }),
    [metrics, snapshot, patterns],
  );

  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Normaliza o array de gates: hidrata com metadata estática do catálogo
  // (snapshots antigos não têm friendlyLabel/whatIs/howTo/unit) e sobrescreve
  // valores de métricas calculáveis a partir do ciclo atual quando disponíveis
  // (winRate, maxDDPercent, payoff, complianceRate, stopTamperingCount, etc).
  const gateList = useMemo(() => {
    const raw = maturity?.gates;
    if (!Array.isArray(raw)) return [];
    const cycleM = cycleMetrics || {};
    return raw.map((g) => {
      const meta = CATALOG_BY_ID.get(g.id) || {};
      let value = g.value;
      let met = g.met;
      let gap = g.gap;
      let reason = g.reason;
      let usedCycleData = false;

      // Se temos dado do ciclo pra essa métrica, reavalia
      const cycleValue = cycleM[g.metric];
      if (cycleValue !== undefined && cycleValue !== null && Number.isFinite(cycleValue)) {
        value = cycleValue;
        met = applyOperator(g.op, cycleValue, g.threshold);
        gap = met ? 0 : (g.op === '<=' || g.op === '<' ? cycleValue - g.threshold : g.threshold - cycleValue);
        reason = null;
        usedCycleData = true;
      }

      return {
        id:       g.id,
        label:    g.label || meta.label,
        friendlyLabel: g.friendlyLabel || meta.friendlyLabel || g.label,
        dim:      g.dim || meta.dim,
        metric:   g.metric,
        op:       g.op || meta.op,
        threshold: g.threshold !== undefined ? g.threshold : meta.threshold,
        unit:     g.unit || meta.unit || '',
        whatIs:   g.whatIs || meta.whatIs || null,
        howTo:    g.howTo  || meta.howTo  || null,
        value,
        met,
        gap,
        reason,
        usedCycleData,
      };
    });
  }, [maturity, cycleMetrics]);

  const promotionEligible = maturity?.proposedTransition === 'PROMOTE';
  // `regression` precisa ser estável entre renders quando o array não existe;
  // `[]` literal em cada render quebraria a dep de useEffect e geraria loop.
  const regression = useMemo(
    () => (Array.isArray(maturity?.regression) ? maturity.regression : []),
    [maturity?.regression],
  );

  useEffect(() => {
    if (maturity) {
      onMaturity?.({
        scores: maturity.scores || null,
        deltaFromPrior: maturity.deltaFromPrior || null,
        currentStage: maturity.currentStage,
        stageGates: maturity.gates || {},
        promotionEligible,
        regression,
        mentorOverride: null,
      });
    }
  }, [maturity, promotionEligible, regression, onMaturity]);

  // Agrupamento por dimensão preservando ordem original do catálogo
  const groupedGates = useMemo(() => {
    const out = { emo: [], fin: [], op: [] };
    for (const g of gateList) {
      if (out[g.dim]) out[g.dim].push(g);
      else out.op.push(g);
    }
    return out;
  }, [gateList]);

  // Resumo agregado
  const summary = useMemo(() => {
    const total = gateList.length;
    const passed = gateList.filter((g) => g.met === true).length;
    const failed = gateList.filter((g) => g.met === false).length;
    const unavailable = gateList.filter((g) => g.met === null).length;
    return { total, passed, failed, unavailable };
  }, [gateList]);

  // Top 3 gates faltantes — prioriza maior gap (mais perto de passar)
  const topGapGates = useMemo(() => {
    return gateList
      .filter((g) => g.met === false && typeof g.gap === 'number')
      .sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap))
      .slice(0, 3);
  }, [gateList]);

  if (loading) {
    return <div className="glass-card p-8 text-center text-slate-400">Carregando snapshot de maturidade...</div>;
  }

  if (!maturity) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-slate-300 font-semibold mb-2">Snapshot de maturidade indisponível</p>
        <p className="text-sm text-slate-500">
          O motor de maturidade ainda não rodou pra este aluno. O ritual continua, mas a etapa de avaliação fica vazia.
        </p>
      </div>
    );
  }

  const stage = maturity.currentStage;
  const stageLabel = stage ? `Estágio ${stage} — ${STAGE_NAMES_PT[stage - 1] || '—'}` : 'Estágio indefinido';
  const nextStageLabel = stage && stage < 5 ? `Estágio ${stage + 1} — ${STAGE_NAMES_PT[stage] || '—'}` : null;
  const composite = maturity?.scores?.composite;

  return (
    <div className="glass-card p-8 space-y-6">
      <div>
        <h3 className="text-xl font-bold mb-1 flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-400" />
          Onde você está no mapa de evolução
        </h3>
        <p className="text-sm text-slate-400">
          Mapa de 4 dimensões (emocional, financeira, operacional, experiência) e a checklist do que falta pra evoluir.
          Clique em cada item pra ver o que ele significa e o que fazer.
        </p>
      </div>

      <div className="bg-gradient-to-r from-amber-500/5 to-purple-500/5 border border-purple-500/20 rounded-xl p-4">
        <div className="flex items-baseline justify-between mb-1">
          <p className="font-semibold text-slate-100">{stageLabel}</p>
          {typeof composite === 'number' && (
            <p className="text-sm text-slate-400 mono">{composite.toFixed(1)} / 100</p>
          )}
        </div>
        <p className="text-xs text-slate-400">{STAGE_PITCH[stage] || ''}</p>
        {regression.length > 0 && (
          <p className="text-xs text-red-300 mt-2 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" /> Regressão detectada: {regression.join(', ')}
          </p>
        )}
      </div>

      <div className="grid grid-cols-4 gap-3">
        <ScoreBar label="Emocional"   value={maturity?.scores?.emotional}   deltaFromPrior={maturity?.deltaFromPrior?.emotional} />
        <ScoreBar label="Financeiro"  value={maturity?.scores?.financial}   deltaFromPrior={maturity?.deltaFromPrior?.financial} />
        <ScoreBar label="Operacional" value={maturity?.scores?.operational} deltaFromPrior={maturity?.deltaFromPrior?.operational} />
        <ScoreBar label="Experiência" value={maturity?.scores?.experience}  deltaFromPrior={maturity?.deltaFromPrior?.experience} />
      </div>

      {gateList.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
            <h4 className="text-sm font-semibold text-slate-300">
              O que falta pra evoluir{nextStageLabel ? <> pro <span className="text-slate-100">{nextStageLabel}</span></> : ''}
            </h4>
            <p className="text-xs text-slate-500">
              <span className="text-emerald-400 font-semibold">{summary.passed}</span> atendidos
              <span className="text-slate-600 mx-1">·</span>
              <span className="text-red-400 font-semibold">{summary.failed}</span> faltam
              {summary.unavailable > 0 && (
                <>
                  <span className="text-slate-600 mx-1">·</span>
                  <span className="text-slate-400 font-semibold">{summary.unavailable}</span> aguardando dados
                </>
              )}
            </p>
          </div>

          <div className="space-y-3">
            <DimSection dimKey="emo" gates={groupedGates.emo} expandedIds={expandedIds} onToggle={toggleExpand} />
            <DimSection dimKey="fin" gates={groupedGates.fin} expandedIds={expandedIds} onToggle={toggleExpand} />
            <DimSection dimKey="op"  gates={groupedGates.op}  expandedIds={expandedIds} onToggle={toggleExpand} />
          </div>
        </section>
      )}

      {topGapGates.length > 0 && (
        <section className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/40">
          <h4 className="text-sm font-semibold text-slate-200 mb-2">
            🎯 Foco pro próximo ciclo
          </h4>
          <p className="text-xs text-slate-500 mb-3">
            Os 3 critérios mais perto de passar. Atacar esses primeiro acelera a evolução.
          </p>
          <ul className="space-y-1.5">
            {topGapGates.map((g) => (
              <li key={g.id} className="text-sm text-slate-300 flex items-start gap-2">
                <span className="text-slate-600">→</span>
                <span className="flex-1">{g.friendlyLabel || g.label}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {promotionEligible ? (
        <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-xl p-4">
          <p className="text-sm font-semibold text-emerald-300 mb-1">✨ Pronto para promoção</p>
          <p className="text-xs text-slate-300">
            Todos os requisitos atendidos. Promoção registrada no fechamento.
          </p>
        </div>
      ) : (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
          <p className="text-sm font-medium text-slate-300 mb-1">
            Ainda faltam requisitos
          </p>
          <p className="text-xs text-slate-500">
            Promoção é automática quando todos os critérios verdes acima estiverem atendidos. Sem pressa — consistência é o caminho.
          </p>
          {role === 'mentor' && (
            <button
              type="button"
              className="btn-secondary text-xs mt-3"
              onClick={() => toast.info('A7 — fluxo de override de stage virá em fase posterior.', { duration: 4000 })}
            >
              🛡 Override discricionário (mentor)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
