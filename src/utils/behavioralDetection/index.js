/**
 * behavioralDetection — motor unificado de detecção comportamental (CHUNK-11 Fase 1)
 * @version 1.0.0 (Epic #298 Fase 1 — issue #301)
 *
 * `detectBehavior` é o ponto de entrada ÚNICO que REUSA os detectores existentes
 * (não reescreve) e emite código canônico + legado (dual-emit) sobre a taxonomia
 * unificada da Fase 0 (`src/constants/behavioralTaxonomy.js`).
 *
 * DARK: nada plugado em produção nesta fase. Construído atrás do baseline #299.
 *
 * Caminhos (espelham os 4 fluxos atuais):
 *   events     — wrap de `detectExecutionEvents` (#208). Dual-emit: preserva `type`,
 *                adiciona `legacyCode` + `canonicalCode`. Filtrar os 2 campos extras
 *                devolve o array idêntico ao de hoje → baseline #299 intacto (A4).
 *   byTrade    — wrap de `analyzeShadowBatch`/`analyzeShadowForTrade` (#129). ESM-only
 *                (sem mirror CJS; a maturidade server-side não consome shadow per-trade
 *                — DEC-AUTO-301-01). Cada pattern enriquecido com canonicalCode + family.
 *   aggregates — scoreInputs (emocional #189) + byFamily/gateInputs.
 *
 * byFamily — dedupe por (tradeId, family): execução, shadow E emocional que apontam
 * para a mesma família no mesmo trade COLAPSAM numa entrada (não contam 2x no gate).
 * Precedência DEC-074: maior resolutionLayer da taxonomia vence (HIGH>MEDIUM>LOW =
 * ordens>parciais>sequência); empate → fonte `events` (ordem bruta é o sinal mais forte).
 * gateInputs é o sinal de gate UNIFICADO (DEC-AUTO-301-03): inclui TILT/LOSS_CHASING
 * vindos do motor emocional (detectTiltV2/RevengeV2), que não têm evento/shadow próprio
 * mas a maturidade gata neles (evaluateMaturity tiltRevengeCount).
 *
 * Contrato de retorno:
 *   { events, byTrade, aggregates: { scoreInputs, byFamily, gateInputs }, meta }
 */

import { detectExecutionEvents } from '../executionBehaviorEngine';
import { analyzeShadowBatch } from '../shadowBehaviorAnalysis';
import {
  calculatePeriodScore,
  detectTiltV2,
  detectRevengeV2,
} from '../emotionalAnalysisV2';
import {
  resolveCanonical,
  getPattern,
  GATE_CODES,
} from '../../constants/behavioralTaxonomy';

export const BEHAVIORAL_DETECTION_VERSION = '1.0.0';

const RESOLUTION_RANK = { HIGH: 3, MEDIUM: 2, LOW: 1 };

/**
 * Enriquece um evento de execução com código canônico + legado, preservando o
 * objeto original intacto (dual-emit). `legacyCode` é o `type` de hoje;
 * `canonicalCode` resolve pela taxonomia (4 sobreposições colapsadas).
 */
const enrichEvent = (event) => ({
  ...event,
  legacyCode: event.type,
  canonicalCode: resolveCanonical(event.type),
});

/** Agrupa ordens planas por trade (correlatedTradeId) — entrada do shadow batch. */
const groupOrdersByTrade = (orders) => {
  const map = {};
  for (const o of orders) {
    const tid = o?.correlatedTradeId;
    if (!tid) continue;
    (map[tid] ??= []).push(o);
  }
  return map;
};

/**
 * Coleta detecções canônicas (events + shadow) numa lista achatada para o dedupe.
 * @returns {Array<{tradeId, canonicalCode, family, source, resolutionLayer}>}
 */
const collectDetections = (events, byTrade) => {
  const out = [];
  for (const e of events) {
    const p = e.canonicalCode ? getPattern(e.canonicalCode) : null;
    if (!p) continue;
    out.push({
      tradeId: e.tradeId ?? null, canonicalCode: e.canonicalCode,
      family: p.family, source: 'events', resolutionLayer: p.resolutionLayer,
    });
  }
  for (const [tradeId, shadow] of byTrade) {
    for (const pat of shadow.patterns) {
      const p = pat.canonicalCode ? getPattern(pat.canonicalCode) : null;
      if (!p) continue;
      out.push({
        tradeId, canonicalCode: pat.canonicalCode,
        family: p.family, source: 'shadow', resolutionLayer: p.resolutionLayer,
      });
    }
  }
  return out;
};

/** Vence a detecção de maior resolução; empate → fonte `events`. */
const winsOver = (cand, cur) => {
  const rc = RESOLUTION_RANK[cand.resolutionLayer] ?? 0;
  const rk = RESOLUTION_RANK[cur.resolutionLayer] ?? 0;
  if (rc !== rk) return rc > rk;
  return cand.source === 'events' && cur.source !== 'events';
};

/**
 * Dobra o sinal EMOCIONAL (detectTiltV2/detectRevengeV2) em detecções canônicas.
 * TILT e a revenge emocional (→ LOSS_CHASING) só vêm do motor emocional — não há
 * evento de execução nem pattern shadow que resolva para elas — então sem isto o
 * gateInputs nunca poderia conter TILT, embora a maturidade gate nesse sinal
 * (evaluateMaturity tiltRevengeCount). DEC-AUTO-301-03: gateInputs é sinal de gate
 * UNIFICADO (execução + shadow + emocional). resolutionLayer vem da taxonomia
 * (emocional é resolução baixa; ordens/shadow da mesma família vencem no dedupe).
 *
 * @param {object|null} scoreInputs
 * @returns {Array<{tradeId, canonicalCode, family, source, resolutionLayer}>}
 */
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

/**
 * Colapsa detecções por (tradeId, family) e deriva gateInputs. Função pura,
 * exportada para teste determinístico da precedência DEC-074 (a integração com
 * os detectores reais raramente produz colisão cross-engine).
 *
 * @param {Array<{tradeId, canonicalCode, family, source, resolutionLayer}>} detections
 * @returns {{ byFamily: Map, gateInputs: string[] }}
 */
export const dedupeByFamily = (detections) => {
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
  // gate-ness é propriedade da FAMÍLIA (cabeça da família), não do código canônico:
  // p.ex. shadow detecta IMPULSE_CLUSTER (gate=false) cuja família OVERTRADING é gate.
  // Como o dedupe colapsa por família, o gate cruza por família. GATE_CODES são todas
  // cabeças de família (code===family), então a interseção por família é exata.
  const detectedFamilies = new Set([...best.values()].map((d) => d.family));
  const gateInputs = GATE_CODES.filter((c) => detectedFamilies.has(c));
  return { byFamily, gateInputs };
};

/**
 * Motor unificado de detecção comportamental (dark).
 *
 * @param {object}   params
 * @param {Array}    [params.trades=[]]              - trades do período
 * @param {Array}    [params.orders=[]]              - ordens planas (caminho events + fallback shadow)
 * @param {object}   [params.ordersByTradeId]        - mapa tradeId→orders[] (shadow); derivado de `orders` se ausente
 * @param {Function} [params.getEmotionConfig]       - lookup de config de emoção; ausente → scoreInputs null
 * @param {Array}    [params.complianceEvents=[]]    - eventos de compliance (fato) p/ periodScore
 * @param {object}   [params.config={}]              - overrides do caminho events
 * @returns {{ events: Array, byTrade: Map, aggregates: object, meta: object }}
 */
export const detectBehavior = ({
  trades = [],
  orders = [],
  ordersByTradeId,
  getEmotionConfig,
  complianceEvents = [],
  config = {},
} = {}) => {
  // --- events (A1) — wrap dual-emit ---
  const rawEvents = detectExecutionEvents({ trades, orders, config });
  const events = rawEvents.map(enrichEvent);

  // --- byTrade (A2) — wrap shadow, enriquecido com canonicalCode + family ---
  const ordersMap = ordersByTradeId ?? groupOrdersByTrade(orders);
  const rawByTrade = analyzeShadowBatch(trades, ordersMap);
  const byTrade = new Map();
  for (const [tradeId, shadow] of rawByTrade) {
    byTrade.set(tradeId, {
      ...shadow,
      patterns: shadow.patterns.map((p) => ({
        ...p,
        canonicalCode: resolveCanonical(p.code),
        family: getPattern(p.code)?.family ?? null,
      })),
    });
  }

  // --- aggregates (A2) ---
  // scoreInputs: só com getEmotionConfig (não inventa config emocional).
  let scoreInputs = null;
  if (typeof getEmotionConfig === 'function') {
    scoreInputs = {
      periodScore: calculatePeriodScore(trades, getEmotionConfig, complianceEvents),
      tilt: detectTiltV2(trades, getEmotionConfig, undefined, rawEvents),
      revenge: detectRevengeV2(trades, getEmotionConfig, undefined, rawEvents),
    };
  }

  // byFamily + gateInputs: dedupe por (tradeId, family) com precedência DEC-074.
  // Sinal de gate UNIFICADO: execução (events) + shadow (byTrade) + emocional (scoreInputs).
  const { byFamily, gateInputs } = dedupeByFamily([
    ...collectDetections(events, byTrade),
    ...emotionalDetections(scoreInputs),
  ]);

  return {
    events,
    byTrade,
    aggregates: { scoreInputs, byFamily, gateInputs },
    meta: { version: BEHAVIORAL_DETECTION_VERSION, baselineCompatible: true },
  };
};

export default detectBehavior;
