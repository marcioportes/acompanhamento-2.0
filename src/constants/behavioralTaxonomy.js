/**
 * behavioralTaxonomy.js — SSoT da taxonomia comportamental unificada (CHUNK-11)
 * @version 1.0.0 (Epic #298 Fase 0 — issue #299)
 *
 * Fonte de verdade ÚNICA dos padrões comportamentais (opinião). Reconcilia os
 * 7 eventos de execução (#208) + 15 padrões shadow (#129) + tilt/revenge (#189)
 * numa lista canônica, colapsando as 4 sobreposições. Compliance (fato, INV-21)
 * NÃO entra aqui.
 *
 * Pesos/dimensões DERIVAM de `docs/dev/behavioral-weight-map.md` (aprovado), que
 * por sua vez deriva de `docs/dev/trader_evolution_framework.md`.
 *
 * Paridade obrigatória com o mirror CJS `functions/maturity/behavioralTaxonomyMirror.js`
 * (teste `src/__tests__/constants/behavioralTaxonomy.parity.test.js`).
 *
 * Campos de cada padrão:
 *   code            — código canônico (chave)
 *   family          — família p/ dedupe/agregação (códigos sinônimos compartilham)
 *   valence         — 'negative' | 'positive'
 *   dimensao        — dimensões 4D que informa: subconjunto de ['E','F','O']
 *   viesFramework   — viés nomeado + seção do framework
 *   severityDefault — 'HIGH' | 'MEDIUM' | 'LOW' | null (positivos)
 *   emotionMapping  — emoção associada (mantém vocabulário de #129)
 *   resolutionLayer — 'LOW' | 'MEDIUM' | 'HIGH' (DEC-074: ordens>parciais>sequência)
 *   requires        — dados necessários: 'trades' | 'orders' | 'plan'
 *   feedsScore      — entra no score emocional/4D
 *   feedsGates      — entra em gate de transição de estágio
 */

export const DIMENSIONS = Object.freeze({ E: 'emotional', F: 'financial', O: 'operational' });
export const SEVERITY = Object.freeze({ HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' });
export const RESOLUTION = Object.freeze({ HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' });

const P = (o) => Object.freeze(o);

export const BEHAVIORAL_PATTERNS = Object.freeze({
  // ---- Emocional (já pesavam) ----
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
  // ---- Financeiro (novos: greed/disposition/martingale) ----
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
  // ---- Operacional (novos: triggers/sistema) ----
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
  // ---- Positivos (reforço) ----
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

/**
 * Códigos legados (motores antigos) → código canônico. Permite dual-emit durante
 * a transição (Fases 1–6): EVENT_PENALTIES, switches de UI e gates por string
 * literal continuam resolvendo. Códigos já canônicos mapeiam para si mesmos.
 */
export const LEGACY_CODE_ALIAS = Object.freeze({
  // execução (#208)
  STOP_TAMPERING: 'STOP_PANIC',
  STOP_BREAKEVEN_TOO_EARLY: 'STOP_PANIC',
  STOP_HESITATION: 'HESITATION',
  HESITATION_PRE_ENTRY: 'HESITATION',
  RAPID_REENTRY_POST_STOP: 'LOSS_CHASING',
  STOP_PARTIAL_SIZING: 'SUB_SIZING',
  CHASE_REENTRY: 'CHASE_REENTRY',
  // shadow (#129)
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
  // emocional (#189)
  TILT_DETECTED: 'TILT',
  REVENGE_DETECTED: 'LOSS_CHASING',
});

/** Resolve um código (legado ou canônico) para o canônico. null se desconhecido. */
export function resolveCanonical(code) {
  if (!code) return null;
  if (BEHAVIORAL_PATTERNS[code]) return code;
  return LEGACY_CODE_ALIAS[code] || null;
}

/** Retorna a definição canônica de um código (legado ou canônico). null se desconhecido. */
export function getPattern(code) {
  const canonical = resolveCanonical(code);
  return canonical ? BEHAVIORAL_PATTERNS[canonical] : null;
}

/** Lista de códigos canônicos que pesam no score. */
export const SCORING_CODES = Object.freeze(
  Object.values(BEHAVIORAL_PATTERNS).filter((p) => p.feedsScore).map((p) => p.code),
);

/** Lista de códigos canônicos que pesam em gates. */
export const GATE_CODES = Object.freeze(
  Object.values(BEHAVIORAL_PATTERNS).filter((p) => p.feedsGates).map((p) => p.code),
);

export default BEHAVIORAL_PATTERNS;
