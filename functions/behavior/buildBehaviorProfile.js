/**
 * buildBehaviorProfile — funde o motor unificado `detectBehavior` (events + agregados
 * + gateInputs, via mirror CJS) com o shadow per-trade (`analyzeShadowForTradeCF`) num
 * snapshot `behaviorProfile` por trade. CHUNK-11 Fase 2 (issue #301).
 *
 * Por que fundir aqui: o mirror CJS NÃO espelha `byTrade` (shadow é ESM-only,
 * DEC-AUTO-301-01) — então o detalhe shadow per-trade vem de `analyzeShadowForTradeCF`
 * (reusado de analyzeShadowBehavior.js, não re-portado — evita AP-08). A precedência
 * por família (DEC-074) é aplicada reusando `dedupeByFamily` do mirror, por trade.
 *
 * Função PURA: não escreve no Firestore. O caller (recomputeForStudent / backfill)
 * decide o que gravar comparando `fingerprint` (idempotência) e adiciona
 * `computedAt`/`computedBy`.
 *
 * @version 1.0.0 (DEC-AUTO-301-04 — campo inline `trade.behaviorProfile`)
 */

const crypto = require('crypto');
const {
  detectBehavior,
  dedupeByFamily,
  BEHAVIORAL_DETECTION_VERSION,
} = require('../maturity/behavioralDetectionMirror');
const { resolveCanonical, getPattern } = require('../maturity/behavioralTaxonomyMirror');
const { analyzeShadowForTradeCF, SHADOW_VERSION } = require('../shadow/shadowDetectors');

const PROFILE_VERSION = '1.0.0';
const SEVERITY_RANK = { HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 };

/** Agrupa um array por uma chave derivada (retorna Map). */
const groupBy = (arr, keyFn) => {
  const m = new Map();
  for (const item of arr) {
    const k = keyFn(item);
    if (k == null) continue;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(item);
  }
  return m;
};

/**
 * Fingerprint estável do conteúdo semântico (exclui computedAt/computedBy, que sempre
 * mudam). Mesmo conteúdo → mesmo hash → caller pula write redundante (anti-loop/custo).
 *
 * A `evidence` entra no hash: ela É conteúdo — é o que o painel exibe ao aluno (valor do
 * risco, RO, pernas, quantidade descoberta). Ficou de fora até 19/08/2026 e isso escondeu
 * uma correção real: depois do fix de duplicatas, um trade manteve as mesmas famílias mas
 * a evidência caiu de R$ 1.359 para R$ 453 de risco — como só famílias/severidade/fonte
 * entravam no hash, o recompute considerou "sem mudança" e o número errado ficou no doc.
 */
const behaviorFingerprint = (profile) => {
  const canonical = {
    f: (profile.families || [])
      .map((x) => [x.family, x.canonicalCode, x.severity, x.source, JSON.stringify(x.evidence ?? null)])
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)),
    g: [...(profile.gateInputs || [])].sort(),
    s: profile.scoreContribution || {},
    r: profile.resolution || null,
    e: profile.emotionConfront
      ? [profile.emotionConfront.verdict, profile.emotionConfront.declared?.category ?? null, profile.emotionConfront.suggested?.code ?? null]
      : null,
  };
  return crypto.createHash('sha1').update(JSON.stringify(canonical)).digest('hex');
};

/** Ordena famílias para exibição: negativos por severidade desc, positivos por último. */
const byDisplayOrder = (a, b) => {
  const va = a.valence === 'positive' ? 1 : 0;
  const vb = b.valence === 'positive' ? 1 : 0;
  if (va !== vb) return va - vb; // negativos primeiro
  return (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0);
};

/**
 * Família negativa dominante (maior severidade; empate → a que trava gate).
 *
 * @param {boolean} [comEmocao] — quando true, só concorrem famílias que carregam emoção.
 *   Usado pelo confronto emocional (#375): padrão de gate sem emoção associada não pode
 *   ser eleito "a emoção do trade" — foi o que fez o card dizer "a execução sugere null".
 */
const dominantNegativeFamily = (families, comEmocao = false) => {
  let best = null;
  for (const f of families) {
    if (f.valence === 'positive') continue;
    if (comEmocao && !f.emotionMapping) continue;
    if (!best) { best = f; continue; }
    const d = (SEVERITY_RANK[f.severity] ?? 0) - (SEVERITY_RANK[best.severity] ?? 0);
    if (d > 0 || (d === 0 && f.isGate && !best.isGate)) best = f;
  }
  return best;
};

/**
 * Confronto emocional — matriz aprovada (categoria da emoção declarada × severidade do
 * padrão dominante). Veredicto: ALIGNED | ATTENTION | MISALIGNED | NO_DECLARED.
 * 'CLEAN' = sem padrão negativo. Categoria declarada vem de getEmotionConfig.analysisCategory.
 */
const verdictFor = (declaredCategory, detSeverity) => {
  if (!declaredCategory) return 'NO_DECLARED';
  switch (declaredCategory) {
    case 'POSITIVE':
      if (detSeverity === 'CLEAN') return 'ALIGNED';
      if (detSeverity === 'LOW') return 'ATTENTION';
      return 'MISALIGNED'; // MEDIUM/HIGH
    case 'NEUTRAL':
      if (detSeverity === 'CLEAN' || detSeverity === 'LOW') return 'ALIGNED';
      if (detSeverity === 'MEDIUM') return 'ATTENTION';
      return 'MISALIGNED'; // HIGH
    case 'NEGATIVE':
      return detSeverity === 'HIGH' ? 'ATTENTION' : 'ALIGNED'; // clean=regulou, low/med=consciente
    case 'CRITICAL':
      return detSeverity === 'CLEAN' ? 'ATTENTION' : 'ALIGNED'; // consciente (alto risco)
    default:
      return 'ALIGNED';
  }
};

const computeEmotionConfront = (trade, families, getEmotionConfig) => {
  // #375 — o confronto é sobre EMOÇÃO: só participa padrão que carrega uma. Gate sem
  // emoção continua inteiro na lista de padrões e no bloqueio de estágio, que é o canal
  // dele. A severidade que calibra o veredicto também sai daí, senão um gate mudo
  // continuaria endurecendo um confronto do qual não participa.
  const dom = dominantNegativeFamily(families, true);
  const detSeverity = dom ? dom.severity : 'CLEAN';
  const suggested = (dom && dom.emotionMapping)
    ? { emotion: dom.emotionMapping, code: dom.canonicalCode, severity: dom.severity }
    : null;
  const entryName = trade.emotionEntry || null;
  if (!entryName) return { declared: null, suggested, verdict: 'NO_DECLARED' };
  const cfg = typeof getEmotionConfig === 'function' ? getEmotionConfig(entryName) : null;
  const category = (cfg && cfg.analysisCategory) || 'NEUTRAL';
  return { declared: { name: entryName, category }, suggested, verdict: verdictFor(category, detSeverity) };
};

/**
 * @param {Object} params
 * @param {Object[]} params.trades       — trades do aluno (já carregados)
 * @param {Object[]} params.orders       — ordens planas do aluno (correlatedTradeId)
 * @param {Object[]} [params.plans]      — planos do aluno (p/ planRoPct/planRrTarget — UNDERSIZED/TARGET_HIT)
 * @param {Function} [params.getEmotionConfig] — name → emotion config (p/ tilt/revenge)
 * @param {Object[]} [params.complianceEvents]
 * @returns {Map<string, Object>} tradeId → behaviorProfile (sem computedAt/computedBy)
 */
const buildBehaviorProfiles = ({
  trades = [],
  orders = [],
  plans = [],
  getEmotionConfig,
  complianceEvents = [],
} = {}) => {
  const profiles = new Map();
  if (!Array.isArray(trades) || trades.length === 0) return profiles;

  // Enriquece cada trade com campos do plano que os detectores shadow exigem
  // (UNDERSIZED_TRADE/TARGET_HIT leem planRoPct/planRrTarget/planPl) — paridade com
  // o callable analyzeShadowBehavior:411-418. Clona p/ não mutar o input do caller.
  const plansById = {};
  for (const p of plans || []) if (p && p.id) plansById[p.id] = p;
  const enriched = trades.map((t) => {
    if (!t || !t.planId || !plansById[t.planId]) return t;
    const plan = plansById[t.planId];
    return {
      ...t,
      planRoPct: plan.riskPerOperation ?? null,
      planPl: plan.pl ?? plan.currentPl ?? null,
      planRrTarget: plan.rrTarget ?? 2,
    };
  });

  // 1. Passada student-level do motor: events (per-trade, dual-emit) + agregados emocionais.
  const engine = detectBehavior({ trades: enriched, orders, getEmotionConfig, complianceEvents });
  const eventsByTrade = groupBy(engine.events || [], (e) => e.tradeId);
  const scoreInputs = engine.aggregates?.scoreInputs || null;

  // 2. ordersByTradeId p/ o shadow per-trade (mesmo critério do analyzeShadowBehavior).
  const ordersByTradeId = {};
  for (const o of orders) {
    const tid = o && o.correlatedTradeId;
    if (!tid) continue;
    if (!ordersByTradeId[tid]) ordersByTradeId[tid] = [];
    ordersByTradeId[tid].push(o);
  }

  // 3. Fusão por trade.
  for (const trade of enriched) {
    if (!trade || !trade.id) continue;

    const adjacent = enriched.filter(
      (t) => t.id !== trade.id && t.studentId === trade.studentId && t.date === trade.date,
    );
    const tradeOrders = ordersByTradeId[trade.id] || null;
    const shadow = analyzeShadowForTradeCF(trade, adjacent, tradeOrders); // {patterns,resolution,orderCount,...}

    // Monta detecções deste trade (events + shadow) + guarda evidência por código canônico.
    const detections = [];
    const evidenceByCode = {}; // canonicalCode → { evidence, confidence, severity, source }

    for (const e of eventsByTrade.get(trade.id) || []) {
      const canonical = e.canonicalCode || resolveCanonical(e.type);
      const p = canonical ? getPattern(canonical) : null;
      if (!p) continue;
      detections.push({
        tradeId: trade.id, canonicalCode: canonical, family: p.family,
        source: 'events', resolutionLayer: p.resolutionLayer,
        // #394/#396 — a severidade PRECISA viajar até o dedupe. Sem ela,
        // `travaProgressao(codigo, undefined)` responde "não trava" para TODO
        // UNPROTECTED_SIZE, inclusive o grave: um trade que nunca colocou stop saía com
        // `gateInputs: []`. Era o oposto do que o #394 pedia.
        severity: e.severity ?? p.severityDefault ?? null,
      });
      evidenceByCode[canonical] = { evidence: e.evidence ?? null, confidence: e.confidence ?? null, severity: e.severity ?? null, source: 'events' };
    }

    for (const sp of (shadow && shadow.patterns) || []) {
      const canonical = resolveCanonical(sp.code);
      const p = canonical ? getPattern(canonical) : null;
      if (!p) continue;
      detections.push({
        tradeId: trade.id, canonicalCode: canonical, family: p.family,
        source: 'shadow', resolutionLayer: p.resolutionLayer,
        severity: sp.severity ?? p.severityDefault ?? null,
      });
      // shadow só sobrescreve evidência se o código ainda não veio de events (events > shadow, DEC-074).
      if (!evidenceByCode[canonical]) {
        evidenceByCode[canonical] = { evidence: sp.evidence ?? null, confidence: sp.confidence ?? null, severity: sp.severity ?? null, source: 'shadow' };
      }
    }

    // Colapsa por família com precedência DEC-074 (reusa o algoritmo do motor) + gateInputs do trade.
    const { byFamily, gateInputs } = dedupeByFamily(detections);

    const families = [];
    for (const [family, dets] of byFamily.entries()) {
      const det = dets[0]; // 1 por (tradeId, family) — todas as detecções têm o mesmo tradeId aqui
      const pattern = getPattern(det.canonicalCode);
      const ev = evidenceByCode[det.canonicalCode] || {};
      families.push({
        family,
        canonicalCode: det.canonicalCode,
        severity: ev.severity ?? pattern?.severityDefault ?? null,
        source: det.source,
        resolutionLayer: det.resolutionLayer,
        // #375 — a emoção pode ser DERIVADA do que aconteceu no trade, não fixa no
        // padrão. `UNPROTECTED_SIZE` é o caso: retirar a proteção e segurar é Esperança,
        // retirar e ainda aumentar é Negação, e nunca ter protegido não é emoção nenhuma
        // — é processo. O detector devolve isso na evidência; o padrão é o fallback.
        emotionMapping: ev.evidence?.emotionMapping ?? pattern?.emotionMapping ?? null,
        valence: pattern?.valence ?? (pattern?.severityDefault == null ? 'positive' : 'negative'),
        isGate: gateInputs.includes(family),
        confidence: ev.confidence ?? null,
        evidence: ev.evidence ?? null,
      });
    }
    // #357 — reconciliação pós-fusão. `detectCleanExecution` (shadowDetectors.js:170)
    // decide "execução limpa" olhando só os padrões do PRÓPRIO shadow: ele não enxerga
    // as detecções de `events`, que chegam aqui por outro caminho. Resultado observado
    // em produção: o painel exibia "Execução limpa · 90%" ao lado de "Pânico no stop ·
    // Alta · gate", no mesmo trade. O dedup por família não resolve — são famílias
    // distintas, ambas sobrevivem por desenho. A premissa do detector ("eu vejo tudo")
    // só pode ser verificada DEPOIS do merge, que é aqui.
    const hasNegative = families.some((f) => f.valence === 'negative');
    const reconciled = hasNegative
      ? families.filter((f) => f.canonicalCode !== 'CLEAN_EXECUTION')
      : families;
    reconciled.sort(byDisplayOrder);

    const profile = {
      version: PROFILE_VERSION,
      engineMeta: {
        detectionVersion: BEHAVIORAL_DETECTION_VERSION,
        shadowVersion: SHADOW_VERSION,
        baselineCompatible: engine.meta?.baselineCompatible ?? true,
      },
      families: reconciled,
      gateInputs, // famílias-gate detectadas NESTE trade (subset de GATE_CODES)
      scoreContribution: { // sinal emocional do período (contexto; tilt/revenge não são por-trade)
        tilt: !!(scoreInputs && scoreInputs.tilt && scoreInputs.tilt.detected),
        revenge: !!(scoreInputs && scoreInputs.revenge && scoreInputs.revenge.detected),
      },
      resolution: (shadow && shadow.resolution) || 'LOW',
      orderCount: (shadow && shadow.orderCount) || 0,
      // Confronto emocional: emoção declarada na entrada × emoção que a execução sugere.
      emotionConfront: computeEmotionConfront(trade, reconciled, getEmotionConfig),
    };
    profile.fingerprint = behaviorFingerprint(profile);
    profiles.set(trade.id, profile);
  }

  return profiles;
};

module.exports = {
  buildBehaviorProfiles,
  behaviorFingerprint,
  computeEmotionConfront,
  PROFILE_VERSION,
};
