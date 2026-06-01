// behavioralTaxonomyMirror.js — mirror CJS de src/constants/behavioralTaxonomy.js
// (CHUNK-11 Epic #298 Fase 0 / issue #299).
//
// Paridade OBRIGATÓRIA com o source ESM: qualquer mudança aqui exige refletir
// `src/constants/behavioralTaxonomy.js` e vice-versa. Teste de paridade em
// `src/__tests__/constants/behavioralTaxonomy.parity.test.js`.
//
// Consumido server-side (maturity/CF) onde ESM não pode ser importado.

const DIMENSIONS = Object.freeze({ E: 'emotional', F: 'financial', O: 'operational' });
const SEVERITY = Object.freeze({ HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' });
const RESOLUTION = Object.freeze({ HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' });

const P = (o) => Object.freeze(o);

const BEHAVIORAL_PATTERNS = Object.freeze({
  TILT: P({
    code: 'TILT', family: 'TILT', valence: 'negative', dimensao: ['E'],
    viesFramework: 'Reatividade / regulação baixa (§2.3-2; §7.1 emo)',
    severityDefault: SEVERITY.HIGH, emotionMapping: 'ANXIETY',
    resolutionLayer: RESOLUTION.LOW, requires: ['trades'], feedsScore: true, feedsGates: true,
  }),
  LOSS_CHASING: P({
    code: 'LOSS_CHASING', family: 'LOSS_CHASING', valence: 'negative', dimensao: ['E'],
    viesFramework: 'Revenge trading (§2.2 Q5)',
    severityDefault: SEVERITY.HIGH, emotionMapping: 'REVENGE',
    resolutionLayer: RESOLUTION.MEDIUM, requires: ['trades'], feedsScore: true, feedsGates: true,
  }),
  STOP_PANIC: P({
    code: 'STOP_PANIC', family: 'STOP_PANIC', valence: 'negative', dimensao: ['E'],
    viesFramework: 'Loss aversion / disposition (§2.2; §7.1)',
    severityDefault: SEVERITY.HIGH, emotionMapping: 'PANIC',
    resolutionLayer: RESOLUTION.HIGH, requires: ['orders'], feedsScore: true, feedsGates: true,
  }),
  HESITATION: P({
    code: 'HESITATION', family: 'HESITATION', valence: 'negative', dimensao: ['E'],
    viesFramework: 'Indecisão / regulação (§2.3)',
    severityDefault: SEVERITY.LOW, emotionMapping: 'FEAR',
    resolutionLayer: RESOLUTION.HIGH, requires: ['orders'], feedsScore: true, feedsGates: false,
  }),
  GREED_CLUSTER: P({
    code: 'GREED_CLUSTER', family: 'GREED_CLUSTER', valence: 'negative', dimensao: ['F'],
    viesFramework: 'Profit-taking / greed (§3; §7.1 fin)',
    severityDefault: SEVERITY.MEDIUM, emotionMapping: 'GREED',
    resolutionLayer: RESOLUTION.LOW, requires: ['trades'], feedsScore: true, feedsGates: false,
  }),
  AVERAGING_DOWN: P({
    code: 'AVERAGING_DOWN', family: 'AVERAGING_DOWN', valence: 'negative', dimensao: ['E', 'F'],
    viesFramework: 'Martingale escalation / denial (§3 Bloco C; blow-up §6.2)',
    severityDefault: SEVERITY.HIGH, emotionMapping: 'DENIAL',
    resolutionLayer: RESOLUTION.HIGH, requires: ['orders'], feedsScore: true, feedsGates: false,
  }),
  HOLD_ASYMMETRY: P({
    code: 'HOLD_ASYMMETRY', family: 'HOLD_ASYMMETRY', valence: 'negative', dimensao: ['E', 'F'],
    viesFramework: 'Disposition effect (§2.2 Q4)',
    severityDefault: SEVERITY.MEDIUM, emotionMapping: 'FEAR',
    resolutionLayer: RESOLUTION.LOW, requires: ['trades'], feedsScore: true, feedsGates: false,
  }),
  EARLY_EXIT: P({
    code: 'EARLY_EXIT', family: 'EARLY_EXIT', valence: 'negative', dimensao: ['E', 'F'],
    viesFramework: 'Disposition / fear (§2.2 Q4)',
    severityDefault: SEVERITY.MEDIUM, emotionMapping: 'FEAR',
    resolutionLayer: RESOLUTION.MEDIUM, requires: ['orders'], feedsScore: true, feedsGates: false,
  }),
  LATE_EXIT: P({
    code: 'LATE_EXIT', family: 'LATE_EXIT', valence: 'negative', dimensao: ['E', 'F'],
    viesFramework: 'Hope / loss aversion (§7.1)',
    severityDefault: SEVERITY.MEDIUM, emotionMapping: 'HOPE',
    resolutionLayer: RESOLUTION.MEDIUM, requires: ['orders'], feedsScore: true, feedsGates: false,
  }),
  SUB_SIZING: P({
    code: 'SUB_SIZING', family: 'SUB_SIZING', valence: 'negative', dimensao: ['E', 'F'],
    viesFramework: 'Avoidance / subdimensionar (§2.2; UNDERSIZED #129)',
    severityDefault: SEVERITY.MEDIUM, emotionMapping: 'AVOIDANCE',
    resolutionLayer: RESOLUTION.HIGH, requires: ['orders', 'plan'], feedsScore: true, feedsGates: true,
  }),
  CHASE_REENTRY: P({
    code: 'CHASE_REENTRY', family: 'CHASE_REENTRY', valence: 'negative', dimensao: ['E', 'O'],
    viesFramework: 'Overconfidence / FOMO (§2.2 Q6)',
    severityDefault: SEVERITY.MEDIUM, emotionMapping: 'FOMO',
    resolutionLayer: RESOLUTION.HIGH, requires: ['orders'], feedsScore: true, feedsGates: true,
  }),
  FOMO_ENTRY: P({
    code: 'FOMO_ENTRY', family: 'FOMO_ENTRY', valence: 'negative', dimensao: ['E', 'O'],
    viesFramework: 'FOMO trigger (§3 Bloco C)',
    severityDefault: SEVERITY.MEDIUM, emotionMapping: 'FOMO',
    resolutionLayer: RESOLUTION.HIGH, requires: ['orders'], feedsScore: true, feedsGates: false,
  }),
  OVERTRADING: P({
    code: 'OVERTRADING', family: 'OVERTRADING', valence: 'negative', dimensao: ['E', 'O'],
    viesFramework: 'Anxiety / rule violations (§5.3)',
    severityDefault: SEVERITY.MEDIUM, emotionMapping: 'ANXIETY',
    resolutionLayer: RESOLUTION.LOW, requires: ['trades'], feedsScore: true, feedsGates: true,
  }),
  IMPULSE_CLUSTER: P({
    code: 'IMPULSE_CLUSTER', family: 'OVERTRADING', valence: 'negative', dimensao: ['E', 'O'],
    viesFramework: 'Impulsividade (§5.3) — sub-sinal de OVERTRADING',
    severityDefault: SEVERITY.MEDIUM, emotionMapping: 'IMPULSIVITY',
    resolutionLayer: RESOLUTION.LOW, requires: ['trades'], feedsScore: true, feedsGates: false,
  }),
  DIRECTION_FLIP: P({
    code: 'DIRECTION_FLIP', family: 'DIRECTION_FLIP', valence: 'negative', dimensao: ['O'],
    viesFramework: 'Confusion / falta de sistema (§4)',
    severityDefault: SEVERITY.LOW, emotionMapping: 'CONFUSION',
    resolutionLayer: RESOLUTION.LOW, requires: ['trades'], feedsScore: true, feedsGates: false,
  }),
  CLEAN_EXECUTION: P({
    code: 'CLEAN_EXECUTION', family: 'CLEAN_EXECUTION', valence: 'positive', dimensao: ['E'],
    viesFramework: 'Disciplina — perfil SAGE (§2.4)',
    severityDefault: null, emotionMapping: 'DISCIPLINE',
    resolutionLayer: RESOLUTION.LOW, requires: ['trades'], feedsScore: true, feedsGates: false,
  }),
  TARGET_HIT: P({
    code: 'TARGET_HIT', family: 'TARGET_HIT', valence: 'positive', dimensao: ['E', 'O'],
    viesFramework: 'Paciência / adesão ao plano (§5)',
    severityDefault: null, emotionMapping: 'PATIENCE',
    resolutionLayer: RESOLUTION.LOW, requires: ['trades', 'plan'], feedsScore: true, feedsGates: false,
  }),
});

const LEGACY_CODE_ALIAS = Object.freeze({
  STOP_TAMPERING: 'STOP_PANIC',
  STOP_BREAKEVEN_TOO_EARLY: 'STOP_PANIC',
  STOP_HESITATION: 'HESITATION',
  HESITATION_PRE_ENTRY: 'HESITATION',
  RAPID_REENTRY_POST_STOP: 'LOSS_CHASING',
  STOP_PARTIAL_SIZING: 'SUB_SIZING',
  CHASE_REENTRY: 'CHASE_REENTRY',
  REVENGE_CLUSTER: 'LOSS_CHASING',
  UNDERSIZED_TRADE: 'SUB_SIZING',
  GREED_CLUSTER: 'GREED_CLUSTER',
  HOLD_ASYMMETRY: 'HOLD_ASYMMETRY',
  OVERTRADING: 'OVERTRADING',
  IMPULSE_CLUSTER: 'IMPULSE_CLUSTER',
  DIRECTION_FLIP: 'DIRECTION_FLIP',
  HESITATION: 'HESITATION',
  STOP_PANIC: 'STOP_PANIC',
  FOMO_ENTRY: 'FOMO_ENTRY',
  EARLY_EXIT: 'EARLY_EXIT',
  LATE_EXIT: 'LATE_EXIT',
  AVERAGING_DOWN: 'AVERAGING_DOWN',
  CLEAN_EXECUTION: 'CLEAN_EXECUTION',
  TARGET_HIT: 'TARGET_HIT',
  TILT_DETECTED: 'TILT',
  REVENGE_DETECTED: 'LOSS_CHASING',
});

function resolveCanonical(code) {
  if (!code) return null;
  if (BEHAVIORAL_PATTERNS[code]) return code;
  return LEGACY_CODE_ALIAS[code] || null;
}

function getPattern(code) {
  const canonical = resolveCanonical(code);
  return canonical ? BEHAVIORAL_PATTERNS[canonical] : null;
}

const SCORING_CODES = Object.freeze(
  Object.values(BEHAVIORAL_PATTERNS).filter((p) => p.feedsScore).map((p) => p.code),
);
const GATE_CODES = Object.freeze(
  Object.values(BEHAVIORAL_PATTERNS).filter((p) => p.feedsGates).map((p) => p.code),
);

module.exports = {
  DIMENSIONS, SEVERITY, RESOLUTION,
  BEHAVIORAL_PATTERNS, LEGACY_CODE_ALIAS,
  resolveCanonical, getPattern, SCORING_CODES, GATE_CODES,
};
