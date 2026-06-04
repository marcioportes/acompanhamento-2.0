/**
 * behavioralDetectionMirror — espelho CJS de `src/utils/behavioralDetection` (CHUNK-11 Fase 1).
 * @version 1.0.0 (Epic #298 Fase 1 — issue #301)
 *
 * Espelha a SUPERFÍCIE que a maturidade server-side realmente usa: `events`
 * (dual-emit) + `aggregates.scoreInputs` (emocional) + `byFamily`/`gateInputs`
 * derivados de events. NÃO espelha `byTrade` (shadow): os 15 detectores shadow
 * só existem em ESM e a maturidade server-side (preComputeShapes/evaluateMaturity)
 * não consome shadow per-trade — DEC-AUTO-301-01. Reescrevê-los em CJS seria
 * redesign + risco de divergência (AP-08). `byTrade` vem SEMPRE vazio aqui.
 *
 * Paridade ESM≡CJS (teste): compara `events` + `scoreInputs` (superfície
 * compartilhada) + `dedupeByFamily` (algoritmo puro). `byTrade` fica de fora por
 * ser ESM-only (intencional, documentado).
 *
 * REUSA os mirrors CJS da Fase 0 — não reescreve detector nenhum.
 */

const { detectExecutionEvents } = require('./executionBehaviorMirror');
const {
  calculatePeriodScore,
  detectTiltV2,
  detectRevengeV2,
} = require('./emotionalAnalysisMirror');
const { resolveCanonical, getPattern, GATE_CODES } = require('./behavioralTaxonomyMirror');

const BEHAVIORAL_DETECTION_VERSION = '1.0.0';

const RESOLUTION_RANK = { HIGH: 3, MEDIUM: 2, LOW: 1 };

const enrichEvent = (event) => ({
  ...event,
  legacyCode: event.type,
  canonicalCode: resolveCanonical(event.type),
});

const collectDetections = (events) => {
  const out = [];
  for (const e of events) {
    const p = e.canonicalCode ? getPattern(e.canonicalCode) : null;
    if (!p) continue;
    out.push({
      tradeId: e.tradeId ?? null, canonicalCode: e.canonicalCode,
      family: p.family, source: 'events', resolutionLayer: p.resolutionLayer,
    });
  }
  return out;
};

const winsOver = (cand, cur) => {
  const rc = RESOLUTION_RANK[cand.resolutionLayer] ?? 0;
  const rk = RESOLUTION_RANK[cur.resolutionLayer] ?? 0;
  if (rc !== rk) return rc > rk;
  return cand.source === 'events' && cur.source !== 'events';
};

/** Dobra o sinal emocional (TILT/LOSS_CHASING) em detecções — paridade com ESM. DEC-AUTO-301-03. */
const emotionalDetections = (scoreInputs) => {
  if (!scoreInputs) return [];
  const out = [];
  const add = (canonicalCode, detected) => {
    if (!detected) return;
    const p = getPattern(canonicalCode);
    if (!p) return;
    out.push({
      tradeId: null, canonicalCode, family: p.family,
      source: 'emotional', resolutionLayer: p.resolutionLayer,
    });
  };
  add('TILT', scoreInputs.tilt?.detected);
  add('LOSS_CHASING', scoreInputs.revenge?.detected);
  return out;
};

/** Colapsa detecções por (tradeId, family) + deriva gateInputs. Paridade com ESM. */
const dedupeByFamily = (detections) => {
  const best = new Map();
  for (const d of detections) {
    const key = `${d.tradeId}|${d.family}`;
    const cur = best.get(key);
    if (!cur || winsOver(d, cur)) best.set(key, d);
  }
  const byFamily = new Map();
  for (const d of best.values()) {
    if (!byFamily.has(d.family)) byFamily.set(d.family, []);
    byFamily.get(d.family).push({
      tradeId: d.tradeId, canonicalCode: d.canonicalCode,
      source: d.source, resolutionLayer: d.resolutionLayer,
    });
  }
  // gate-ness é propriedade da FAMÍLIA (cabeça), não do código canônico (ver ESM).
  const detectedFamilies = new Set([...best.values()].map((d) => d.family));
  const gateInputs = GATE_CODES.filter((c) => detectedFamilies.has(c));
  return { byFamily, gateInputs };
};

/**
 * Motor unificado (mirror CJS, dark). byTrade SEMPRE vazio (shadow ESM-only).
 */
const detectBehavior = ({
  trades = [],
  orders = [],
  getEmotionConfig,
  complianceEvents = [],
  config = {},
} = {}) => {
  const rawEvents = detectExecutionEvents({ trades, orders, config });
  const events = rawEvents.map(enrichEvent);

  let scoreInputs = null;
  if (typeof getEmotionConfig === 'function') {
    scoreInputs = {
      periodScore: calculatePeriodScore(trades, getEmotionConfig, complianceEvents),
      tilt: detectTiltV2(trades, getEmotionConfig, undefined, rawEvents),
      revenge: detectRevengeV2(trades, getEmotionConfig, undefined, rawEvents),
    };
  }

  const { byFamily, gateInputs } = dedupeByFamily([
    ...collectDetections(events),
    ...emotionalDetections(scoreInputs),
  ]);

  return {
    events,
    byTrade: new Map(), // shadow ESM-only — DEC-AUTO-301-01
    aggregates: { scoreInputs, byFamily, gateInputs },
    meta: { version: BEHAVIORAL_DETECTION_VERSION, baselineCompatible: true, shadowMirrored: false },
  };
};

module.exports = {
  detectBehavior,
  dedupeByFamily,
  BEHAVIORAL_DETECTION_VERSION,
};
