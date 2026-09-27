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
const {
  resolveCanonical, getPattern, valenciaVigente, severidadeVigente,
} = require('../maturity/behavioralTaxonomyMirror');
const { analyzeShadowForTradeCF, SHADOW_VERSION } = require('../shadow/shadowDetectors');
const {
  isConfrontable, confrontVerdictFor, confirmsDeclared, CONFRONT_VERDICT,
} = require('../shared/emotionConfront');
const { positionBuildOf } = require('../shared/positionBuild');

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

/** Ordena famílias para exibição: negativos por severidade desc, avisos neutros (#477), positivos por último. */
const VALENCE_ORDER = { negative: 0, neutral: 1, positive: 2 };
const byDisplayOrder = (a, b) => {
  const va = VALENCE_ORDER[a.valence] ?? 0;
  const vb = VALENCE_ORDER[b.valence] ?? 0;
  if (va !== vb) return va - vb;
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
    // #477 — valência VIGENTE: aviso neutro de montagem de posição não é negativo.
    const v = valenciaVigente(f);
    if (v === 'positive' || v === 'neutral') continue;
    if (comEmocao && !f.emotionMapping) continue;
    if (!best) { best = f; continue; }
    const d = (SEVERITY_RANK[f.severity] ?? 0) - (SEVERITY_RANK[best.severity] ?? 0);
    if (d > 0 || (d === 0 && f.isGate && !best.isGate)) best = f;
  }
  return best;
};

/**
 * Confronto emocional — emoção declarada na entrada × emoção que a execução sugere.
 * Veredicto: ALIGNED | ATTENTION | MISALIGNED | NO_DECLARED | CONFIRMED (#477).
 * Matriz e regras em `shared/emotionConfront` (espelhadas no cliente, que as reaplica na
 * leitura de perfis antigos).
 *
 * #477 — o confronto é HIPÓTESE, não sentença:
 *   - só participa padrão NEGATIVO, com emoção, de gravidade MÉDIA ou ALTA. Padrão de
 *     gravidade baixa não sustenta dizer ao aluno que ele sentiu outra coisa;
 *   - declaração positiva que a execução confirma (toda leva de entrada nasceu com
 *     proteção própria, nada confrontável, nenhum gate) vira CONFIRMED.
 *
 * @param {Object} [execution] — { allProtected?: boolean, hasGate?: boolean }
 */
const computeEmotionConfront = (trade, families, getEmotionConfig, execution = null) => {
  // #375 — só participa padrão que carrega emoção; gate sem emoção fica no canal dele.
  const candidatas = (families || []).filter((f) => isConfrontable(
    valenciaVigente(f) || 'negative', f.emotionMapping, severidadeVigente(f.canonicalCode, f.severity),
  ));
  const dom = dominantNegativeFamily(candidatas, true);
  const detSeverity = dom ? severidadeVigente(dom.canonicalCode, dom.severity) : 'CLEAN';
  const suggested = dom
    ? { emotion: dom.emotionMapping, code: dom.canonicalCode, severity: detSeverity }
    : null;
  const entryName = trade.emotionEntry || null;
  if (!entryName) return { declared: null, suggested, verdict: CONFRONT_VERDICT.NO_DECLARED };
  const cfg = typeof getEmotionConfig === 'function' ? getEmotionConfig(entryName) : null;
  const category = (cfg && cfg.analysisCategory) || 'NEUTRAL';
  let verdict = confrontVerdictFor(category, detSeverity);
  if (verdict === CONFRONT_VERDICT.ALIGNED && confirmsDeclared(category, detSeverity, execution)) {
    verdict = CONFRONT_VERDICT.CONFIRMED;
  }
  return { declared: { name: entryName, category }, suggested, verdict };
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
      // #477 — exceção: HESITATION. O motor de eventos emite UM evento por ordem cancelada
      // (sempre BAIXA); o shadow é quem CONTA as tentativas e gradua a severidade (2 BAIXA,
      // 3 MÉDIA, 4+ ALTA). Com o evento por cima, 3 tentativas reais em 4 min ficavam BAIXA
      // e a evidência dizia só o intervalo de uma ordem. As duas leituras usam a mesma
      // regra de tentativa (`shared/entryAttempts`), então o agregado é o retrato do trade.
      if (!evidenceByCode[canonical] || canonical === 'HESITATION') {
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
      emotionConfront: computeEmotionConfront(trade, reconciled, getEmotionConfig, {
        // #477 — a execução confirma a declaração positiva? Toda leva nasceu protegida.
        allProtected: tradeOrders ? (positionBuildOf(trade, tradeOrders)?.allProtected === true) : false,
        hasGate: gateInputs.length > 0,
      }),
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
