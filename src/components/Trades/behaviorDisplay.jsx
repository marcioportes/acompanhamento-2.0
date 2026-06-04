/**
 * behaviorDisplay — constantes e helpers de apresentação do BehaviorPanel (Fase 2 #301).
 * Keyado por CÓDIGO CANÔNICO da taxonomia (LOSS_CHASING, SUB_SIZING, ...), não pelos
 * códigos legados do shadow. Canibaliza labels/educacional do ShadowBehaviorPanel (#129).
 *
 * Cor por severidade (decisão Marcio): ALTA=red · MÉDIA=amber · BAIXA=orange · positivo=emerald.
 */
import React from 'react';
import { formatCurrencyDynamic } from '../../utils/currency';

// Estilo por severidade. Positivos (valence 'positive') sempre emerald, ignoram severity.
export const SEVERITY_STYLES = {
  HIGH: 'bg-red-500/20 text-red-300 border-red-500/30',
  MEDIUM: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  LOW: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  POSITIVE: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
};

export const SEVERITY_LABELS = { HIGH: 'Alta', MEDIUM: 'Média', LOW: 'Baixa' };

export const familyStyle = (family) =>
  family.valence === 'positive'
    ? SEVERITY_STYLES.POSITIVE
    : (SEVERITY_STYLES[family.severity] ?? SEVERITY_STYLES.LOW);

export const EMOTION_LABELS = {
  FEAR: 'Medo', REVENGE: 'Vingança', GREED: 'Ganância', ANXIETY: 'Ansiedade',
  IMPULSIVITY: 'Impulsividade', DISCIPLINE: 'Disciplina', PATIENCE: 'Paciência',
  PANIC: 'Pânico', FOMO: 'FOMO', HOPE: 'Esperança', DENIAL: 'Negação',
  CONFUSION: 'Confusão / Viés', AVOIDANCE: 'Evitação do plano',
};

// Nome PT por código canônico (17 códigos da taxonomia).
export const BEHAVIOR_LABELS = {
  TILT: 'Tilt / reatividade',
  LOSS_CHASING: 'Revenge trading',
  STOP_PANIC: 'Pânico no stop',
  HESITATION: 'Hesitação',
  GREED_CLUSTER: 'Cluster de ganância',
  AVERAGING_DOWN: 'Preço médio / Martingale',
  HOLD_ASYMMETRY: 'Assimetria de permanência',
  EARLY_EXIT: 'Saída antecipada',
  LATE_EXIT: 'Saída tardia',
  SUB_SIZING: 'Operação subdimensionada',
  CHASE_REENTRY: 'Reentrada perseguindo',
  FOMO_ENTRY: 'Entrada por FOMO',
  OVERTRADING: 'Overtrading',
  IMPULSE_CLUSTER: 'Cluster impulsivo',
  DIRECTION_FLIP: 'Virada de mão',
  CLEAN_EXECUTION: 'Execução limpa',
  TARGET_HIT: 'Alvo atingido',
};

export const BEHAVIOR_DESCRIPTIONS = {
  TILT: 'Reatividade emocional alta no período — regulação baixa após perdas.',
  LOSS_CHASING: 'Reentrada rápida após uma perda — tentativa de recuperar.',
  STOP_PANIC: 'Stop alargado seguido de saída manual rápida.',
  HESITATION: 'Múltiplas ordens canceladas antes de entrar — indecisão.',
  GREED_CLUSTER: 'Sequência de trades rápidos após ganhos — excesso de confiança.',
  AVERAGING_DOWN: 'Adição na mesma direção com preço piorando.',
  HOLD_ASYMMETRY: 'Trade perdedor mantido muito mais tempo que a média dos ganhadores.',
  EARLY_EXIT: 'Saída com lucro muito abaixo do alvo planejado.',
  LATE_EXIT: 'Saída atrasada após remoção do stop — segurou a perda.',
  SUB_SIZING: 'Risco real muito abaixo do RO planejado — se há medo do plano, ajuste o plano (não a operação).',
  CHASE_REENTRY: 'Entrada cancelada seguida de reentrada a preço pior — perseguição.',
  FOMO_ENTRY: 'Entrada tardia com ordem a mercado após hesitação.',
  OVERTRADING: 'Número de trades acima do limite na janela temporal.',
  IMPULSE_CLUSTER: 'Trades executados em sequência muito rápida, sem análise.',
  DIRECTION_FLIP: 'Virou a mão no mesmo instrumento após loss — viés/narrativa quebrada.',
  CLEAN_EXECUTION: 'Trade com stop presente, RR respeitado e sem padrões negativos.',
  TARGET_HIT: 'Saída no alvo planejado — paciência na execução.',
};

const fmt = (value, currency) => (value == null ? '—' : formatCurrencyDynamic(value, currency || 'USD'));

const UNDERSIZED_KEY_SENTENCE = (scenario, planRrTarget) => {
  switch (scenario) {
    case 'WIN_RR_HIT': return `RR de ${planRrTarget}:1 cumprido. Alvo do plano não atingido.`;
    case 'WIN_RR_MISS': return 'Operação subdimensionada e abaixo do alvo do trade.';
    case 'LOSS_BE': return 'Operação subdimensionada e tomada em loss.';
    default: return '';
  }
};

/** Bloco educacional do SUB_SIZING (preservado do ShadowBehaviorPanel — R-local vs R-plano). */
export const UndersizedEducational = ({ scenario, evidence, currency }) => {
  const {
    actualRiskAmount, utilizationPct, planRoAmount, actualGain,
    expectedGainAtPlanRR, rrLocalAchieved, planRsDelivered, planRrTarget,
  } = evidence;

  if (scenario === 'WIN_RR_HIT') {
    return (
      <div className="text-xs text-zinc-400 mt-2 leading-relaxed space-y-2">
        <p>Você arriscou {fmt(actualRiskAmount, currency)} ({utilizationPct}% do RO contratado de {fmt(planRoAmount, currency)}) e atingiu {fmt(actualGain, currency)} — menos de um stop cheio do plano e abaixo do alvo planejado de {fmt(expectedGainAtPlanRR, currency)}.</p>
        <p>Sua estatística (Payoff/PF/EV) lê este trade como +{rrLocalAchieved}R. Em Rs do plano são +{planRsDelivered}R. Quando vier um loss de RO cheio (−1R do plano), trades assim não cobrem o stop.</p>
        <p>Se o RO contratado parece grande, ajuste o plano. Subdimensionar esconde o desalinhamento e adia o acerto de contas.</p>
      </div>
    );
  }
  if (scenario === 'WIN_RR_MISS') {
    const localTarget = actualRiskAmount != null && planRrTarget != null ? actualRiskAmount * planRrTarget : null;
    return (
      <div className="text-xs text-zinc-400 mt-2 leading-relaxed space-y-2">
        <p>Você arriscou {fmt(actualRiskAmount, currency)} ({utilizationPct}% do RO contratado de {fmt(planRoAmount, currency)}) e saiu com {fmt(actualGain, currency)} — abaixo do alvo do próprio trade ({fmt(localTarget, currency)}) e muito abaixo do alvo do plano ({fmt(expectedGainAtPlanRR, currency)}).</p>
        <p>Duplo problema: subdimensionado + saída antes do RR. Sua estatística mede Rs locais (stop usado), não Rs do plano — o trade entra como ganho parcial mas em Rs do plano entregou só +{planRsDelivered}R.</p>
        <p>Se o RO contratado parece grande, ajuste o plano em vez de operar abaixo dele.</p>
      </div>
    );
  }
  return (
    <div className="text-xs text-zinc-400 mt-2 leading-relaxed space-y-2">
      <p>Você arriscou {fmt(actualRiskAmount, currency)} ({utilizationPct}% do RO contratado de {fmt(planRoAmount, currency)}) e tomou loss.</p>
      <p>Operar subdimensionado pode parecer prudente, mas distorce sua estatística cumulativa (Payoff/PF/EV) ao tratar Rs pequenos como equivalentes a Rs cheios do plano.</p>
    </div>
  );
};

/** Corpo do card de SUB_SIZING (evidência rica). Recebe `evidence` direto da família. */
export const UndersizedBody = ({ evidence = {}, currency, expanded }) => {
  const { scenario, planRrTarget, utilizationPct } = evidence;
  const hasAmounts = evidence.planRoAmount != null;
  const keySentence = UNDERSIZED_KEY_SENTENCE(scenario, planRrTarget);
  return (
    <>
      {hasAmounts ? (
        <p className="text-sm font-medium text-zinc-100 mt-2">{keySentence}</p>
      ) : (
        <p className="text-sm font-medium text-zinc-100 mt-2">Você utilizou {utilizationPct}% do RO contratado. {keySentence}</p>
      )}
      {hasAmounts && <UndersizedEducational scenario={scenario} evidence={evidence} currency={currency} />}
      {expanded && (
        <div className="mt-3 pt-2 border-t border-white/10">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Evidência técnica</p>
          <div className="grid grid-cols-2 gap-1">
            {Object.entries(evidence).map(([key, value]) => (
              <div key={key} className="text-xs">
                <span className="text-zinc-500">{key}: </span>
                <span className="text-zinc-300">{value == null ? '—' : (Array.isArray(value) ? `${value.length} items` : String(value))}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};
