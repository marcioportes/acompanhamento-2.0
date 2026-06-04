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

const num = (v) => (v == null ? null : (typeof v === 'number' ? v : Number(v)));

/**
 * Narrativa semântica por código canônico — tece os números da evidência numa frase
 * que o aluno entende, em vez de despejar os campos técnicos crus no card. Retorna null
 * quando faltam campos esperados → o card cai na descrição (também prosa). Os campos
 * crus seguem disponíveis no accordion "evidência técnica".
 */
export const BEHAVIOR_NARRATIVE = {
  HOLD_ASYMMETRY: (e) => {
    const d = num(e.tradeDurationMinutes); const a = num(e.avgWinDurationMinutes); const r = num(e.ratio);
    if (d == null || a == null) return null;
    return `Você segurou este trade por ${d} min — ${r ? `${r}× ` : ''}muito mais que a média de ${a} min dos seus trades vencedores. Segurar o perdedor e cortar o vencedor cedo é o avesso do que o plano pede.`;
  },
  LOSS_CHASING: (e, c) => {
    const i = num(e.intervalMinutes); const pl = num(e.previousLoss);
    if (i == null) return null;
    return `Você reentrou ${i} min depois ${pl != null ? `de um stop de ${fmt(pl, c)}` : 'de uma perda'}. Reentrada quente logo após o stop costuma ser tentativa de recuperar, não uma leitura nova do mercado.`;
  },
  OVERTRADING: (e) => {
    const n = num(e.tradesInWindow); const t = num(e.threshold);
    if (n == null) return null;
    return `Foram ${n} trades na janela${t != null ? ` (acima do limite de ${t})` : ''}. Volume alto em pouco tempo dilui a seletividade e costuma vir da ansiedade de estar no mercado.`;
  },
  IMPULSE_CLUSTER: (e) => {
    const n = num(e.clusterCount);
    if (n == null) return null;
    return `${n} trades em sequência muito rápida, sem espaço para análise entre um e outro — execução no impulso.`;
  },
  DIRECTION_FLIP: (e, c) => {
    const i = num(e.intervalMinutes);
    if (e.previousSide == null || e.currentSide == null) return null;
    return `${i != null ? `${i} min depois ` : 'Logo após '}de um ${e.previousSide}${e.previousResult != null ? ` que deu ${fmt(num(e.previousResult), c)}` : ''}, você virou para ${e.currentSide} no mesmo ${e.instrument || 'ativo'}. Virar a mão logo após o loss costuma ser narrativa quebrada, não sinal.`;
  },
  EARLY_EXIT: (e) => {
    const pct = num(e.rrAchievedPct); const ar = num(e.actualRR); const pr = num(e.planRR);
    if (pct == null && ar == null) return null;
    return `Você saiu com ${pct != null ? `${pct}% do alvo` : 'lucro abaixo do alvo'}${ar != null && pr != null ? ` (RR ${ar} contra ${pr} do plano)` : ''}. Cortar o vencedor cedo encolhe o R que precisa pagar os stops.`;
  },
  HESITATION: (e) => {
    const n = num(e.cancelledOrdersCount);
    if (n == null) return null;
    return `${n} ordens canceladas antes de você entrar — indecisão na execução. Hesitar no gatilho costuma trocar o trade do plano por um pior.`;
  },
  TARGET_HIT: (e) =>
    `Você saiu no alvo planejado${e.planRR ? ` (${e.planRR}:1)` : ''}. Paciência na execução — o trade foi até onde o plano mandou.`,
  CLEAN_EXECUTION: () =>
    'Stop no lugar, RR respeitado e nenhum padrão negativo. É exatamente assim que o plano espera que você opere.',
};

export const narrativeFor = (family) => {
  const builder = BEHAVIOR_NARRATIVE[family.canonicalCode];
  if (builder) {
    const out = builder(family.evidence || {}, family.currency);
    if (out) return out;
  }
  return BEHAVIOR_DESCRIPTIONS[family.canonicalCode] ?? '';
};

// Confronto emocional: estilo + copy por veredicto (matriz aprovada). Tom espelho, não acusação.
export const CONFRONT_TONE_STYLES = {
  red: 'bg-red-500/10 border-red-500/40 text-red-200',
  amber: 'bg-amber-500/10 border-amber-500/30 text-amber-200',
  emerald: 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300/90',
};

const emo = (code) => EMOTION_LABELS[code] ?? code;

/** Retorna {tone, text} para o banner do confronto, ou null quando não há o que dizer. */
export const emotionConfrontDisplay = (confront) => {
  if (!confront) return null;
  const { verdict, declared, suggested } = confront;
  const dec = declared?.name;
  const sug = suggested ? emo(suggested.emotion) : null;

  switch (verdict) {
    case 'MISALIGNED':
      return { tone: 'red', text: `Você declarou “${dec}”, mas a execução sugere ${sug}. Vale revisitar o que você sentiu de fato na entrada.` };
    case 'ATTENTION':
      if (declared?.category === 'NEGATIVE') {
        return { tone: 'amber', text: `Você declarou “${dec}” e a execução foi de ${sug} — emoção reconhecida, mas não contida.` };
      }
      if (!suggested) {
        return { tone: 'amber', text: `Você declarou “${dec}”, mas a execução saiu limpa — vale confirmar a intensidade.` };
      }
      return { tone: 'amber', text: `Você declarou “${dec}”, e há sinais de ${sug} na execução.` };
    case 'ALIGNED':
      if (declared?.category === 'NEGATIVE' && !suggested) {
        return { tone: 'emerald', text: `Você declarou “${dec}” mas executou limpo — boa regulação emocional.` };
      }
      if ((declared?.category === 'NEGATIVE' || declared?.category === 'CRITICAL') && suggested) {
        return { tone: 'emerald', text: `Você declarou “${dec}” e a execução confirma — consciência emocional presente.` };
      }
      return null; // positiva/neutra + limpo = ideal, sem ruído
    case 'NO_DECLARED':
      // só vale nudge se há emoção detectada para confrontar
      return suggested
        ? { tone: 'amber', text: `A execução sugere ${sug}, mas a emoção da entrada não foi declarada. Declare para ativar o confronto.` }
        : null;
    default:
      return null;
  }
};

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
