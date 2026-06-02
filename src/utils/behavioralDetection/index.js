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
 *   byTrade    — wrap de `analyzeShadowForTrade` (#129). ESM-only (sem mirror CJS;
 *                a maturidade server-side não consome shadow per-trade — DEC-AUTO-301). [A2]
 *   aggregates — scoreInputs (emocional #189) + byFamily/gateInputs (dedupe por
 *                família com precedência DEC-074: ordens > parciais > sequência). [A2]
 *
 * Contrato de retorno:
 *   { events, byTrade, aggregates: { scoreInputs, byFamily, gateInputs }, meta }
 */

import { detectExecutionEvents } from '../executionBehaviorEngine';
import { resolveCanonical } from '../../constants/behavioralTaxonomy';

export const BEHAVIORAL_DETECTION_VERSION = '1.0.0';

/**
 * Enriquece um evento de execução com código canônico + legado, preservando o
 * objeto original intacto (dual-emit). `legacyCode` é o `type` de hoje;
 * `canonicalCode` resolve pela taxonomia (4 sobreposições colapsadas).
 *
 * @param {object} event - evento cru de `detectExecutionEvents`
 * @returns {object} evento + { legacyCode, canonicalCode }
 */
const enrichEvent = (event) => ({
  ...event,
  legacyCode: event.type,
  canonicalCode: resolveCanonical(event.type),
});

/**
 * Motor unificado de detecção comportamental (dark).
 *
 * @param {object}   params
 * @param {Array}    [params.trades=[]]   - trades do período
 * @param {Array}    [params.orders=[]]   - ordens de execução (para o caminho events)
 * @param {object}   [params.config={}]   - overrides de config dos detectores
 * @returns {{ events: Array, byTrade: Map, aggregates: object, meta: object }}
 */
export const detectBehavior = ({ trades = [], orders = [], config = {} } = {}) => {
  // --- Caminho events (A1) — wrap dual-emit de detectExecutionEvents ---
  const rawEvents = detectExecutionEvents({ trades, orders, config });
  const events = rawEvents.map(enrichEvent);

  // --- byTrade (A2) / aggregates (A2): placeholders desta fase ---
  const byTrade = new Map();
  const aggregates = {
    scoreInputs: null,
    byFamily: new Map(),
    gateInputs: [],
  };

  return {
    events,
    byTrade,
    aggregates,
    meta: { version: BEHAVIORAL_DETECTION_VERSION, baselineCompatible: true },
  };
};

export default detectBehavior;
