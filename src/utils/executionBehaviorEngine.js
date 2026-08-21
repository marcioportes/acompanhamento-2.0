/**
 * executionBehaviorEngine.js
 * @version 1.0.0 (v1.49.0 — issue #208 Fase 2)
 * @description Sensor comportamental de execução. Lê trades + orders e emite
 *   eventos comportamentais auditáveis para alimentar engine emocional V2 e
 *   gates de maturidade.
 *
 * 5 DETECTORES:
 *   STOP_TAMPERING            — stop reemitido para mais largo durante vida do trade
 *   STOP_PARTIAL_SIZING       — soma stop qty < trade qty (sub-proteção)
 *   RAPID_REENTRY_POST_STOP   — entry mesmo side <10min após exit por stop (loss-chasing)
 *   HESITATION_PRE_ENTRY      — order CANCELLED mesmo side+instrument seguida de FILLED <30min
 *   CHASE_REENTRY             — re-submit mesmo side com preço pior antes do fill final
 *
 * INPUT:
 *   trades  — collection trades: {id, ticker, side, qty, entryTime, exitTime, ...}
 *   orders  — collection orders: {externalOrderId, side, type, status, qty,
 *             price, stopPrice, submittedAt, filledAt, cancelledAt, instrument,
 *             correlatedTradeId, isStopOrder}
 *   config  — { hesitationWindowMs, rapidReentryWindowMs } (optional, defaults)
 *
 * OUTPUT:
 *   [{ type, severity, tradeId?, orderIds[], timestamp, evidence, source, citation }]
 *
 * SOURCE flags:
 *   'literature' — base em paper citável (citation preenchido)
 *   'heuristic'  — extrapolação operacional sem paper direto
 *
 * EXPORTS:
 *   detectExecutionEvents({trades, orders, config})
 *   EVENT_TYPES, EVENT_SEVERITY (constantes)
 */

// ============================================
// CONSTANTS
// ============================================

export const EVENT_TYPES = Object.freeze({
  STOP_TAMPERING: 'STOP_TAMPERING',
  STOP_PARTIAL_SIZING: 'STOP_PARTIAL_SIZING',
  RISK_OVER_RO: 'RISK_OVER_RO',
  UNPROTECTED_SIZE: 'UNPROTECTED_SIZE',
  SIZING_DISCIPLINE: 'SIZING_DISCIPLINE',
  RAPID_REENTRY_POST_STOP: 'RAPID_REENTRY_POST_STOP',
  HESITATION_PRE_ENTRY: 'HESITATION_PRE_ENTRY',
  // #369 — ordens que não viraram posição, lidas pelo tempo até o trade vizinho
  RECONSIDERATION_PRE_ENTRY: 'RECONSIDERATION_PRE_ENTRY',
  ABORTED_ATTEMPT_POST_TRADE: 'ABORTED_ATTEMPT_POST_TRADE',
  CHASE_REENTRY: 'CHASE_REENTRY',
  STOP_BREAKEVEN_TOO_EARLY: 'STOP_BREAKEVEN_TOO_EARLY',
  STOP_HESITATION: 'STOP_HESITATION',
});

export const EVENT_SEVERITY = Object.freeze({
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
});

const DEFAULT_CONFIG = Object.freeze({
  hesitationWindowMs: 30 * 60 * 1000,        // 30 min
  triggerHesitationMs: 5 * 60 * 1000,        // ≤5min — hesitação de gatilho (#369)
  reconsiderationWindowMs: 2 * 60 * 60 * 1000, // 30min–2h — "pensei melhor" (#369)
  rapidReentryWindowMs: 10 * 60 * 1000,      // 10 min
  partialSizingTolerance: 0,                  // stop qty < trade qty (estrito)
  breakevenWindowMs: 5 * 60 * 1000,          // 5 min — janela "cedo demais" (#229)
  hesitationMinReissues: 2,                  // ≥2 stop reissues no-op para HESITATION (#229)
  breakevenTolerancePctFallback: 0.0005,     // 0.05% do entry quando ticker desconhecido (#229)
});

// Tolerâncias por prefixo de ticker (DEC-AUTO-229-01).
// 1 tick típico do instrumento. Match por prefixo, longest-first.
const INSTRUMENT_TOLERANCE = Object.freeze({
  WIN: 5,
  WDO: 0.5,
  IND: 5,
  MNQ: 0.25,
  MES: 0.25,
  NQ: 0.25,
  ES: 0.25,
});

const getInstrumentTolerance = (ticker, entryPrice, fallbackPct) => {
  if (typeof ticker === 'string' && ticker.length > 0) {
    const upper = ticker.toUpperCase();
    const sortedKeys = Object.keys(INSTRUMENT_TOLERANCE).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
      if (upper.startsWith(key)) return INSTRUMENT_TOLERANCE[key];
    }
  }
  const pct = fallbackPct ?? 0.0005;
  return Math.max(0.01, (entryPrice || 0) * pct);
};

// ============================================
// HELPERS
// ============================================

const toMs = (value) => {
  if (!value) return null;
  if (value.seconds != null) return value.seconds * 1000;
  if (typeof value.toMillis === 'function') return value.toMillis();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
};

/** Sufixo de fuso num ISO: 'Z' ou '+HH:MM' / '-HHMM'. */
const OFFSET_RE = /(Z|[+-]\d{2}:?\d{2})$/;

/**
 * Offset gravado no trade (#285/#292 — `entryTime`/`exitTime` são ISO+offset).
 * Devolve string tipo '-03:00', ou null quando o trade não carrega fuso.
 */
const tradeOffsetOf = (trade) => {
  for (const v of [trade?.entryTime, trade?.exitTime]) {
    if (typeof v !== 'string') continue;
    const m = v.match(OFFSET_RE);
    if (m) return m[1] === 'Z' ? '+00:00' : m[1];
  }
  return null;
};

/**
 * Instante de uma ordem, resolvido NO FUSO DO TRADE (#375).
 *
 * `orders` guarda instante ingênuo — `"2026-08-21T11:27:51"`, sem fuso — enquanto
 * `trades` guarda com offset explícito desde o #285/#292. `new Date()` lê string sem
 * offset no fuso DO PROCESSO: no browser dá America/Sao_Paulo e bate; na Cloud
 * Function, que roda em UTC, a mesma ordem vira 11:27:51Z contra um trade em
 * 14:27:51Z. Três horas de defasagem entre a ordem e o trade dela.
 *
 * O efeito medido em produção: `liveStopsAt` descarta toda perna de proteção como se
 * tivesse sido cancelada 3h antes da saída, e TODO trade com ordem correlacionada
 * saía com `UNPROTECTED_SIZE` HIGH e cobertura zero — o gate travando progressão de
 * estágio em posição integralmente protegida. `detectStopBreakevenTooEarly`, pelo
 * mesmo desvio invertido, nunca dispara.
 *
 * Aplicado a TODO instante de ordem: comparação ordem×ordem segue consistente (o
 * deslocamento seria uniforme) e ordem×trade passa a ser correta.
 */
const orderMs = (value, offset) => {
  if (typeof value === 'string' && offset && value && !OFFSET_RE.test(value)) {
    return toMs(`${value}${offset}`);
  }
  return toMs(value);
};

/**
 * Instante de uma ordem no fuso do trade — versão pública, para quem lê ordem fora do
 * motor (o painel). Existe para que ninguém reimplemente o parse e reintroduza o desvio
 * de 3h: aconteceu uma vez dentro deste mesmo issue.
 */
export const orderInstantMs = (trade, value) => orderMs(value, tradeOffsetOf(trade));

const sameInstrument = (a, b) => {
  const ax = (a || '').toUpperCase();
  const bx = (b || '').toUpperCase();
  return ax !== '' && ax === bx;
};

/** Side da ordem ↔ side do trade (apenas direção, ignora entry/exit). */
const orderSideMatchesTradeSide = (orderSide, tradeSide) => {
  if (!orderSide || !tradeSide) return false;
  return (orderSide === 'BUY' && tradeSide === 'LONG') ||
         (orderSide === 'SELL' && tradeSide === 'SHORT');
};


/** Determina se o preço da nova ordem é "pior" que o anterior (chase). */
const isPriceWorse = (orderSide, prevPrice, currPrice) => {
  if (!orderSide || !prevPrice || !currPrice) return false;
  if (orderSide === 'BUY') return currPrice > prevPrice;    // pagar mais caro
  if (orderSide === 'SELL') return currPrice < prevPrice;   // vender mais barato
  return false;
};

const ordersForTrade = (orders, tradeId) =>
  orders.filter(o => o.correlatedTradeId === tradeId);

/**
 * Trade fechou em loss? Esse é o gatilho comportamental do RAPID_REENTRY:
 * loss-chasing acontece após perda realizada, independente de como (stop
 * disparou OU fechamento manual em loss via ordem limite). Aderente a
 * Coval&Shumway 2005, que mede loss-chasing operacional, não execução literal.
 */
const tradeClosedInLoss = (trade) =>
  typeof trade?.result === 'number' && trade.result < 0;


// ============================================
// RISCO FINANCEIRO vs RO (#357)
// ============================================

/**
 * Valor de 1 ponto em R$ para o instrumento do trade. Mesma conversão de
 * `calculateFromPartials` (tradeCalculations.js) — tickValue por tick, dividido
 * pelo tamanho do tick, dá o valor por ponto.
 */
const pointValueOf = (trade) => {
  const tr = trade?.tickerRule;
  if (!tr) return null;
  if (tr.tickSize && tr.tickValue) return tr.tickValue / tr.tickSize;
  return tr.pointValue ?? null;
};

/**
 * RO (Risco Operacional) do plano em R$. Mesma fórmula de dashboardMetrics.js:243.
 * `planRoPct`/`planPl` são anexados ao trade por buildBehaviorProfile antes do motor.
 */
const roAmountOf = (trade) => {
  const pct = Number(trade?.planRoPct);
  const pl = Number(trade?.planPl);
  if (!Number.isFinite(pct) || !Number.isFinite(pl) || pct <= 0 || pl <= 0) return null;
  return (pct / 100) * pl;
};

/**
 * Risco financeiro dos stops, composto POR PERNA (DEC-AUTO-357-02).
 *
 * Cada entrada pode trazer seu próprio OCO, então stops coexistem — cada um
 * protege a própria quantidade. Somar `distância × qtd × valorDoPonto` de cada
 * perna dá o prejuízo real caso todas disparassem. Medir em pontos (o que o
 * detector antigo fazia) confunde gestão com descontrole: depois de piramidar,
 * um stop "mais longe em pontos" pode representar risco igual ou menor.
 *
 * Âncora da distância: preço médio de entrada do trade — é contra ele que o
 * risco agregado se realiza.
 *
 * @returns {{ total: number, legs: Array }|null} null quando falta baseline.
 */
const stopRiskBreakdown = (trade, stops) => {
  const pv = pointValueOf(trade);
  const entry = parseFloat(trade?.entry);
  if (!Number.isFinite(pv) || pv <= 0 || !Number.isFinite(entry) || entry <= 0) return null;
  if (!stops.length) return null;

  const legs = [];
  for (const s of stops) {
    const price = s._riskPrice ?? s._price ?? s.stopPrice ?? s.price ?? null;
    const qty = Number(s.quantity ?? s.qty ?? 0);
    if (price == null || !Number.isFinite(qty) || qty <= 0) continue;
    // Só distância ADVERSA vira risco. Stop acima da entrada num LONG (trail) trava
    // lucro — contribui zero, não risco negativo nem positivo.
    const adverse = trade.side === 'LONG' ? entry - Number(price) : Number(price) - entry;
    const distance = adverse > 0 ? adverse : 0;
    legs.push({
      stopPrice: Number(price),
      qty,
      distancePoints: Math.round(distance * 100) / 100,
      riskAmount: Math.round(distance * pv * qty * 100) / 100,
    });
  }
  if (!legs.length) return null;
  const total = Math.round(legs.reduce((acc, l) => acc + l.riskAmount, 0) * 100) / 100;
  return { total, legs };
};

/**
 * Stops VIGENTES — os que ainda protegiam a posição no fim da operação.
 *
 * Um stop cancelado bem antes da saída foi **substituído** (cancela e reemite); somá-lo
 * junto com o substituto contaria o mesmo risco duas vezes. Já num bracket OCO as pernas
 * são canceladas no instante da saída, porque a perna de limite executou — essas contam,
 * e são justamente as que compõem o risco por perna.
 *
 * Critério: sobrevive quem não tem cancelamento (executado ou ainda ativo) ou quem foi
 * cancelado a partir da saída, dentro da tolerância de OCO.
 */
const OCO_TOLERANCE_MS = 2000;

const liveStopsAt = (trade, stops) => {
  const refTs = toMs(trade?.exitTime)
    ?? stops.reduce((mx, o) => Math.max(mx, o._cancelTs ?? o._ts ?? 0), 0);
  if (!refTs) return stops;
  return stops.filter(o => o._cancelTs == null || o._cancelTs >= refTs - OCO_TOLERANCE_MS);
};

/**
 * Preço de referência da entrada — o LIMITE original da primeira entrada, não o
 * preço executado. Slippage não muda intenção de proteção (DEC-AUTO-242-01).
 */
const entryRefOf = (trade, orders) => {
  const wanted = trade.side === 'LONG' ? 'BUY' : 'SELL';
  const off = tradeOffsetOf(trade);
  const first = ordersForTrade(orders, trade.id)
    .filter(o => o.side === wanted && o.isStopOrder !== true)
    .map(o => ({ o, ts: orderMs(o.filledAt, off) ?? orderMs(o.submittedAt, off) ?? 0 }))
    .sort((a, b) => a.ts - b.ts)[0];
  // Preferência: limite original > preço > preço executado (DEC-AUTO-242-01 prefere
  // o limite, mas sem ele a fill é melhor referência que nenhuma).
  const lim = first ? (first.o.limitPrice ?? first.o.price ?? first.o.filledPrice ?? null) : null;
  const ref = lim != null ? parseFloat(lim) : parseFloat(trade.entry);
  return Number.isFinite(ref) && ref > 0 ? ref : null;
};

/**
 * Pernas de PROTEÇÃO da posição — o que efetivamente segura a perda.
 *
 * Não basta `isStopOrder`: o parser marca isso pelo `Tipo de Ordem`, e o bracket OCO
 * da Clear/ProfitChart emite a perna de proteção como **Limite** com `Preço Stop`
 * vazio (#242). Nos trades de 18/08/2026 das 10:57 e 12:06, toda a proteção estava
 * em ordens LIMIT abaixo da entrada — contá-las como "sem stop" acusava falta de
 * proteção em posição protegida.
 *
 * Critério (extensão de classifyStopSemantic para quando não há `Preço Stop`):
 * ordem do lado OPOSTO à posição, com preço ADVERSO à entrada — abaixo dela num
 * LONG, acima num SHORT. Preço favorável é alvo, não proteção.
 *
 * Deduplica cópias: `orders` não guarda `externalOrderId` e a reimportação cria
 * docs repetidos (medido em produção: a mesma ordem em 3 batches). Sem isso o
 * risco e a cobertura são multiplicados pelo número de importações.
 */
/**
 * Janela abaixo da qual uma proteção que sai e outra que entra são a MESMA proteção,
 * trocada de lugar — não exposição (Marcio, 21/08/2026: 20s é o tempo real de trocar
 * uma ordem na plataforma). Acima disso a posição ficou nua de verdade.
 */
export const REPLACEMENT_TOLERANCE_MS = 20000;

export const protectiveLegsOf = (trade, orders) => {
  const entryRef = entryRefOf(trade, orders);
  if (entryRef == null || !trade.side) return [];
  const opposite = trade.side === 'LONG' ? 'SELL' : 'BUY';
  const off = tradeOffsetOf(trade);

  const legs = ordersForTrade(orders, trade.id)
    .filter(o => o.side === opposite)
    .map(o => ({
      ...o,
      _ts: orderMs(o.submittedAt, off) ?? orderMs(o.cancelledAt, off) ?? orderMs(o.filledAt, off),
      _cancelTs: orderMs(o.cancelledAt, off),
      _isRealStop: o.isStopOrder === true || o.stopPrice != null,
      _price: parseFloat(o.stopPrice ?? o.limitPrice ?? o.price ?? NaN),
      // #371 — o preço que CLASSIFICA a perna (alvo vs proteção) é o enviado; o que
      // MEDE o risco é o executado, quando houve execução. O limite com folga que
      // garante preenchimento não é onde a proteção estava: no caso real de 20/08 a
      // ordem saiu com limite 170.280 e executou a 170.130, e o detector cobrava 400
      // pontos de risco onde houve 250 — alerta HIGH travando progressão de estágio.
      _riskPrice: parseFloat(
        ((o.status === 'FILLED' || o.status === 'PARTIALLY_FILLED') && o.filledPrice != null)
          ? o.filledPrice
          : (o.stopPrice ?? o.limitPrice ?? o.price ?? NaN),
      ),
    }))
    .filter(o => Number.isFinite(o._price))
    // Ordem de stop de verdade protege em qualquer preço: acima da entrada num LONG
    // ela é trail/breakeven, que limita a perda a zero ou lucro — proteção melhor,
    // não ausência dela. Já uma LIMITE pura só é a perna de proteção do OCO quando
    // está do lado adverso; do lado favorável é alvo.
    .filter(o => o._isRealStop
      || (trade.side === 'LONG' ? o._price < entryRef : o._price > entryRef));

  const seen = new Set();
  return legs
    .filter((o) => {
      const key = `${o.side}|${o._price}|${o.quantity ?? o.qty}|${o.submittedAt}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (a._ts ?? 0) - (b._ts ?? 0));
};

/** Compat: mantém o nome usado pelos detectores. */
const stopOrdersOf = (trade, orders) => protectiveLegsOf(trade, orders);

/**
 * LINHA DO TEMPO DA PROTEÇÃO (#375).
 *
 * Substitui a foto única no instante da saída. A regra de negócio (Marcio, 21/08/2026):
 * cancelar o stop NÃO é o problema — o problema é a posição ficar sem stop enquanto está
 * aberta. Cancelar e recriar é condução de posição: o sistema mostra, não acusa.
 *
 * Dois degraus caminhando no tempo, ambos derivados das ordens:
 *   aberto(t)  = entradas executadas até t − saídas executadas até t
 *   coberto(t) = Σ qty das pernas de proteção vivas em t
 * Exposição é todo intervalo com `aberto(t) > coberto(t)`. Janela ≤ REPLACEMENT_TOLERANCE_MS
 * é troca de ordem, não exposição.
 *
 * O cancelamento no alvo cai fora sozinho: a perna morre no mesmo instante em que a
 * posição zera, e com zero contrato aberto não há o que expor. Sem regra especial.
 *
 * @returns {{
 *   windows: Array<{startTs:number, endTs:number|null, durationMs:number, contracts:number}>,
 *   totalNakedMs: number, positionMs: number, nakedRatio: number|null,
 *   neverProtected: boolean, addedWhileNaked: boolean,
 *   legs: Array<Object>, replacements: Array<Object>,
 * }}
 */
export const protectionTimeline = (trade, orders) => {
  const vazio = {
    windows: [], totalNakedMs: 0, positionMs: 0, nakedRatio: null,
    neverProtected: false, addedWhileNaked: false, legs: [], replacements: [],
  };
  const tradeQty = Number(trade?.qty ?? 0);
  if (!Number.isFinite(tradeQty) || tradeQty <= 0) return vazio;

  const all = ordersForTrade(orders, trade.id);
  if (!all.length) return vazio;

  const off = tradeOffsetOf(trade);
  const legs = protectiveLegsOf(trade, orders);
  const entradaSide = trade.side === 'LONG' ? 'BUY' : 'SELL';
  const legIds = new Set(legs.map(l => l.externalOrderId).filter(Boolean));

  // Fills de entrada e de saída — proteção não conta como fluxo de posição.
  const fills = all
    .filter(o => (o.status === 'FILLED' || o.status === 'PARTIALLY_FILLED')
      && !(o.externalOrderId && legIds.has(o.externalOrderId)))
    .map(o => ({
      ts: orderMs(o.filledAt, off) ?? orderMs(o.submittedAt, off),
      qty: Number(o.filledQuantity ?? o.quantity ?? 0),
      entrada: o.side === entradaSide,
    }))
    .filter(f => f.ts != null && Number.isFinite(f.qty) && f.qty > 0);

  // Sem fill de entrada nas ordens correlacionadas (fixture esparsa, import parcial), a
  // posição é o que o trade declara, do entryTime ao exitTime. Não invento precisão que
  // o dado não tem — só não deixo de medir por falta dela.
  const abreTs = toMs(trade.entryTime);
  const fechaTs = toMs(trade.exitTime);
  const entradas = fills.filter(f => f.entrada);
  if (!entradas.length) {
    if (abreTs == null) return vazio;
    fills.length = 0;
    fills.push({ ts: abreTs, qty: tradeQty, entrada: true });
    if (fechaTs != null) fills.push({ ts: fechaTs, qty: tradeQty, entrada: false });
  }

  const inicioPos = Math.min(...fills.filter(f => f.entrada).map(f => f.ts));
  const fimPos = fechaTs ?? Math.max(...fills.map(f => f.ts));

  // Eventos: +qty na entrada, −qty na saída, ±cobertura por perna.
  const eventos = [];
  for (const f of fills) eventos.push({ ts: f.ts, dAberto: f.entrada ? f.qty : -f.qty, dCoberto: 0 });
  for (const l of legs) {
    const qty = Number(l.quantity ?? l.qty ?? 0);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    // Perna sem instante utilizável cobre a posição inteira: ela existe, e onde não dá
    // para situá-la no tempo o benefício da dúvida é do aluno — subestimar exposição é
    // preferível a inventá-la.
    // A cobertura começa quando a ordem foi ENVIADA. Sem `submittedAt` não dá para
    // saber quando ela passou a valer — e uma proteção que executou existia antes de
    // executar. Nesse caso ela cobre desde a abertura da posição: onde o dado não
    // informa, o benefício da dúvida é do aluno.
    const inicio = orderMs(l.submittedAt, off) ?? inicioPos;
    const fillTs = (l.status === 'FILLED' || l.status === 'PARTIALLY_FILLED')
      ? (orderMs(l.filledAt, off) ?? orderMs(l.submittedAt, off))
      : null;
    const fim = l._cancelTs ?? fillTs ?? null;
    eventos.push({ ts: inicio, dAberto: 0, dCoberto: qty });
    if (fim != null) eventos.push({ ts: fim, dAberto: 0, dCoberto: -qty });
    // Proteção que EXECUTA é saída: fecha posição no mesmo instante em que deixa de
    // cobrir. Sem isto o stop disparado viraria uma janela nua até o fim do trade.
    if (fillTs != null) {
      const executada = Number(l.filledQuantity ?? l.quantity ?? qty);
      eventos.push({ ts: fillTs, dAberto: -executada, dCoberto: 0 });
    }
  }
  eventos.sort((a, b) => a.ts - b.ts);

  // Varre os instantes de mudança acumulando os dois degraus. Cada trecho entre dois
  // instantes tem um nível de exposição próprio; trechos vizinhos com o MESMO nível se
  // fundem. Assim "2 contratos nus por 29s" e "1 contrato nu por 30min" continuam sendo
  // dois fatos distintos, em vez de virarem um borrão com o pior número dos dois.
  const instantes = [];
  {
    let aberto = 0;
    let coberto = 0;
    for (let i = 0; i < eventos.length; i += 1) {
      const ts = eventos[i].ts;
      aberto += eventos[i].dAberto;
      coberto += eventos[i].dCoberto;
      while (i + 1 < eventos.length && eventos[i + 1].ts === ts) {
        i += 1;
        aberto += eventos[i].dAberto;
        coberto += eventos[i].dCoberto;
      }
      const nu = Math.max(0, Math.round((aberto - Math.min(coberto, aberto)) * 100) / 100);
      instantes.push({ ts, nu });
    }
  }

  const brutas = [];
  for (let k = 0; k < instantes.length; k += 1) {
    const { ts, nu } = instantes[k];
    if (nu <= 0) continue;
    const fimTrecho = k + 1 < instantes.length ? instantes[k + 1].ts : fimPos;
    if (fimTrecho <= ts) continue;
    const anterior = brutas[brutas.length - 1];
    if (anterior && anterior.contracts === nu && anterior.endTs === ts) {
      anterior.endTs = fimTrecho;
      anterior.durationMs = fimTrecho - anterior.startTs;
    } else {
      brutas.push({ startTs: ts, endTs: fimTrecho, durationMs: fimTrecho - ts, contracts: nu });
    }
  }

  // Troca de ordem não é exposição.
  const windows = brutas.filter(w => w.durationMs > REPLACEMENT_TOLERANCE_MS);
  const totalNakedMs = windows.reduce((acc, w) => acc + w.durationMs, 0);
  const positionMs = Math.max(0, fimPos - inicioPos);

  // Substituições: perna que morre e outra que nasce dentro da tolerância.
  const replacements = [];
  const entryRef = entryRefOf(trade, orders);
  for (const morta of legs) {
    if (morta._cancelTs == null) continue;
    const nova = legs.find(l => l !== morta && l._ts != null
      && l._ts >= morta._cancelTs - REPLACEMENT_TOLERANCE_MS
      && l._ts <= morta._cancelTs + REPLACEMENT_TOLERANCE_MS);
    if (!nova) continue;
    const antes = Math.abs(morta._price - entryRef);
    const depois = Math.abs(nova._price - entryRef);
    replacements.push({
      fromOrderId: morta.externalOrderId ?? null,
      toOrderId: nova.externalOrderId ?? null,
      fromPrice: morta._price,
      toPrice: nova._price,
      ts: morta._cancelTs,
      direction: depois < antes ? 'TIGHTENED' : (depois > antes ? 'WIDENED' : 'UNCHANGED'),
    });
  }

  // Aumentou a posição estando nu? (denota Negação, não Esperança — ver taxonomia)
  const addedWhileNaked = windows.some(w => fills.some(f =>
    f.entrada && f.ts > w.startTs && (w.endTs == null || f.ts <= w.endTs)));

  return {
    windows,
    totalNakedMs,
    positionMs,
    nakedRatio: positionMs > 0 ? Math.round((totalNakedMs / positionMs) * 100) / 100 : null,
    neverProtected: legs.length === 0,
    addedWhileNaked,
    legs,
    replacements,
  };
};

// ============================================
// DETECTORS
// ============================================

/**
 * RISK_OVER_RO — o valor financeiro do stop excede o RO do plano (#357).
 *
 * SUBSTITUI o antigo STOP_TAMPERING, que emitia sempre que um stop aparecia mais
 * longe que o anterior. Aquilo era incompatível com condução normal de operação:
 * abrir com OCO fixa, ajustar stop e alvo pela formação dos candles, aumentar
 * posição, olhar o médio e reajustar. Nesse fluxo o stop se move várias vezes e
 * quase sempre "para longe" em preço absoluto, porque o médio andou.
 *
 * Pior: comparava pares consecutivos assumindo que stops em sequência são versões
 * do MESMO stop. Com entrada escalonada cada incremento traz seu próprio bracket,
 * e stops que coexistem viravam "movimento" inventado — foi o falso positivo que
 * originou este issue (WINV26 18/08/2026: dois stops vivos, nenhum movido, e o
 * risco real ficou em R$ 127,01 contra um RO de R$ 252,00).
 *
 * O gatilho agora é financeiro: soma do risco por perna > RO. Mover o stop não é
 * sinal por si só; estourar o risco declarado no plano é.
 *
 * Fonte: risco declarado no plano do próprio aluno (RO), não literatura.
 */
const detectRiskOverRo = (trade, orders) => {
  const ro = roAmountOf(trade);
  if (ro == null) return [];

  const stops = liveStopsAt(trade, stopOrdersOf(trade, orders));
  const breakdown = stopRiskBreakdown(trade, stops);
  if (!breakdown) return [];
  if (breakdown.total <= ro) return [];

  return [{
    type: EVENT_TYPES.RISK_OVER_RO,
    severity: EVENT_SEVERITY.HIGH,
    tradeId: trade.id,
    orderIds: stops.map(o => o.externalOrderId).filter(Boolean),
    timestamp: stops[stops.length - 1]?.submittedAt ?? null,
    evidence: {
      riskAmount: breakdown.total,
      roAmount: Math.round(ro * 100) / 100,
      excessAmount: Math.round((breakdown.total - ro) * 100) / 100,
      legs: breakdown.legs,
      maxDistancePoints: Math.round((ro / (pointValueOf(trade) * Number(trade.qty || 0))) * 100) / 100 || null,
    },
    source: 'plan',
    citation: 'RO declarado no plano vigente',
  }];
};

/**
 * SIZING_DISCIPLINE — positivo (#357). Aumentou a posição (2+ entradas) e o risco
 * financeiro final continuou dentro do RO. É o oposto do RISK_OVER_RO e existe para
 * reconhecer explicitamente boa condução, não apenas deixar de punir.
 */
const detectSizingDiscipline = (trade, orders) => {
  const ro = roAmountOf(trade);
  if (ro == null) return [];

  const entries = (trade._partials || []).filter(pp => pp.type === 'ENTRY');
  if (entries.length < 2) return [];   // sem aumento de posição não há o que reconhecer

  const stops = liveStopsAt(trade, stopOrdersOf(trade, orders));
  const breakdown = stopRiskBreakdown(trade, stops);
  if (!breakdown) return [];
  if (breakdown.total > ro) return [];

  // Cobertura completa é pré-requisito: risco baixo por falta de stop não é disciplina.
  const coveredQty = stops.reduce((acc, o) => acc + Number(o.quantity ?? o.qty ?? 0), 0);
  if (!(coveredQty >= Number(trade.qty || 0))) return [];

  return [{
    type: EVENT_TYPES.SIZING_DISCIPLINE,
    severity: null,
    tradeId: trade.id,
    orderIds: stops.map(o => o.externalOrderId).filter(Boolean),
    timestamp: trade.exitTime ?? trade.entryTime ?? null,
    evidence: {
      entryCount: entries.length,
      riskAmount: breakdown.total,
      roAmount: Math.round(ro * 100) / 100,
      legs: breakdown.legs,
    },
    source: 'plan',
    citation: 'RO declarado no plano vigente',
  }];
};

/**
 * UNPROTECTED_SIZE — contratos abertos sem ordem de stop cobrindo (#357).
 *
 * SUBSTITUI o antigo STOP_PARTIAL_SIZING, que tinha dois defeitos: mapeava para
 * SUB_SIZING (família de "risco muito ABAIXO do RO" — semântica oposta) e, pior,
 * saía com `if (!stops.length) return []` — ou seja, posição **totalmente
 * descoberta** não emitia nada. O caso mais grave era o único não coberto.
 *
 * Cenário de referência (Marcio, 19/08/2026): 5 contratos com stop e TP, entram
 * mais 3 com saída ajustada, mas sem stop para os 3 novos. Cisne branco fecha no
 * alvo; cisne negro quebra a conta.
 *
 * Fonte: Shefrin & Statman 1985; Odean 1998.
 */
const detectUnprotectedSize = (trade, orders) => {
  const tradeQty = Number(trade?.qty ?? 0);
  if (!Number.isFinite(tradeQty) || tradeQty <= 0) return [];

  const all = ordersForTrade(orders, trade.id);
  if (!all.length) return [];   // sem ordens correlacionadas não há resolução p/ afirmar

  // #375 — a medida é TEMPO NU, não foto no instante da saída. Cancelar o stop não é o
  // fato; ficar sem stop com posição aberta é. Cancelar e recriar é condução: a janela
  // curta entre uma ordem e outra não conta (REPLACEMENT_TOLERANCE_MS).
  const tl = protectionTimeline(trade, orders);
  if (!tl.windows.length) return [];

  const maior = tl.windows.reduce((a, w) => (w.durationMs > a.durationMs ? w : a), tl.windows[0]);
  const uncoveredQty = maior.contracts;
  const coveredQty = Math.max(0, Math.round((tradeQty - uncoveredQty) * 100) / 100);

  // "Ficar sem stop até o disparo da saída" — a frase de Marcio — é o caso grave: a
  // posição chegou ao fim descoberta. Exposição que o aluno FECHOU recolocando proteção
  // é informativa, não sentença; só vira grave se tomou a maior parte da posição.
  const fimPosTs = toMs(trade.exitTime);
  const nuAteASaida = fimPosTs != null && tl.windows.some(w =>
    w.endTs != null && w.endTs >= fimPosTs - REPLACEMENT_TOLERANCE_MS);
  const proporcaoAlta = tl.nakedRatio != null && tl.nakedRatio >= 0.5;
  const severity = (tl.neverProtected || nuAteASaida || proporcaoAlta)
    ? EVENT_SEVERITY.HIGH
    : EVENT_SEVERITY.MEDIUM;

  // #375 — a emoção sai do que a janela revela, não é fixa no padrão:
  //   nunca protegeu                     → nenhuma (é processo, negligência; gate puro)
  //   retirou e não recolocou            → HOPE   ("não quero ser stopado, quero estar certo")
  //   retirou e ainda aumentou a posição → DENIAL ("não estou errado, vou aumentar")
  // Vingança seria reação a prejuízo já consumado — aqui o prejuízo ainda não foi aceito,
  // e é para não aceitá-lo que a proteção sai (Marcio, 21/08/2026).
  const emotionMapping = tl.neverProtected
    ? null
    : (tl.addedWhileNaked ? 'DENIAL' : 'HOPE');

  return [{
    type: EVENT_TYPES.UNPROTECTED_SIZE,
    severity,
    tradeId: trade.id,
    orderIds: tl.legs.map(s => s.externalOrderId).filter(Boolean),
    timestamp: trade.entryTime ?? null,
    evidence: {
      tradeQty,
      coveredQty,
      uncoveredQty,
      hasAnyStop: !tl.neverProtected,
      neverProtected: tl.neverProtected,
      ratio: Math.round((coveredQty / tradeQty) * 100) / 100,
      // Janela de exposição — o que a leitura antiga não sabia dizer.
      nakedMs: tl.totalNakedMs,
      nakedSeconds: Math.round(tl.totalNakedMs / 1000),
      nakedRatio: tl.nakedRatio,
      windowCount: tl.windows.length,
      longestWindowMs: maior.durationMs,
      positionMs: tl.positionMs,
      addedWhileNaked: tl.addedWhileNaked,
      replacements: tl.replacements.length,
      emotionMapping,
    },
    source: 'literature',
    citation: 'Shefrin & Statman (1985); Odean (1998)',
  }];
};

/**
 * RAPID_REENTRY_POST_STOP — entry mesmo side <10min após exit em LOSS,
 * mesmo instrument. Loss-chasing operacional independente de stop literal.
 * Fonte: Coval & Shumway 2005; Locke & Mann 2005.
 */
const detectRapidReentry = (trades, _orders, config) => {
  const sorted = [...trades]
    .map(t => ({ ...t, _entry: toMs(t.entryTime), _exit: toMs(t.exitTime) }))
    .filter(t => t._entry != null)
    .sort((a, b) => a._entry - b._entry);

  const events = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (!prev._exit) continue;
    if (curr.side !== prev.side) continue;
    if (!sameInstrument(curr.ticker, prev.ticker)) continue;
    const gap = curr._entry - prev._exit;
    if (gap <= 0 || gap >= config.rapidReentryWindowMs) continue;
    if (!tradeClosedInLoss(prev)) continue;

    events.push({
      type: EVENT_TYPES.RAPID_REENTRY_POST_STOP,
      severity: EVENT_SEVERITY.MEDIUM,
      tradeId: curr.id,
      orderIds: [],
      timestamp: curr.entryTime ?? null,
      evidence: {
        prevTradeId: prev.id,
        prevResult: prev.result,
        gapMs: gap,
        gapMinutes: Math.round((gap / 60000) * 10) / 10,
        side: curr.side,
        instrument: curr.ticker,
      },
      source: 'literature',
      citation: 'Coval & Shumway (2005); Locke & Mann (2005)',
    });
  }
  return events;
};

/**
 * HESITATION_PRE_ENTRY — order CANCELLED mesmo side+instrument seguida de
 * FILLED do mesmo side em <30min, sem fill da própria cancel.
 * Fonte: heurística operacional (extrapolação de literatura, sem paper direto).
 */
const detectHesitation = (trade, orders, config) => {
  const tradeOrders = ordersForTrade(orders, trade.id);
  if (!tradeOrders.length) return [];

  const entryFill = tradeOrders.find(o =>
    !o.isStopOrder &&
    (o.status === 'FILLED' || o.status === 'PARTIALLY_FILLED') &&
    orderSideMatchesTradeSide(o.side, trade.side)
  );
  if (!entryFill) return [];
  const off = tradeOffsetOf(trade);
  const entryTs = orderMs(entryFill.filledAt, off) ?? orderMs(entryFill.submittedAt, off);
  if (!entryTs) return [];

  const cancelled = tradeOrders.filter(o =>
    o.status === 'CANCELLED' &&
    !o.isStopOrder &&
    orderSideMatchesTradeSide(o.side, trade.side) &&
    sameInstrument(o.instrument, trade.ticker)
  );
  if (!cancelled.length) return [];

  const events = [];
  for (const c of cancelled) {
    const cancelTs = orderMs(c.cancelledAt, off) ?? orderMs(c.submittedAt, off);
    if (!cancelTs) continue;
    const gap = entryTs - cancelTs;
    if (gap <= 0) continue;

    // #369 — o tempo entre desmontar e entrar muda o que aconteceu. Meia hora depois
    // não é indecisão: é decisão. Por isso a faixa longa não pontua como falha —
    // penalizá-la ensinaria a entrar rápido, que é o oposto do objetivo.
    if (gap >= config.hesitationWindowMs) {
      if (gap >= config.reconsiderationWindowMs) continue;
      events.push({
        type: EVENT_TYPES.RECONSIDERATION_PRE_ENTRY,
        severity: EVENT_SEVERITY.LOW,
        tradeId: trade.id,
        orderIds: [c.externalOrderId, entryFill.externalOrderId].filter(Boolean),
        timestamp: c.cancelledAt ?? null,
        evidence: {
          cancelledAt: c.cancelledAt ?? null,
          filledAt: entryFill.filledAt ?? null,
          gapMs: gap,
          gapMinutes: Math.round((gap / 60000) * 10) / 10,
          side: trade.side,
          instrument: trade.ticker,
          pattern: 'RECONSIDERATION',
        },
        source: 'heuristic',
        citation: null,
      });
      continue;
    }

    events.push({
      type: EVENT_TYPES.HESITATION_PRE_ENTRY,
      severity: EVENT_SEVERITY.LOW,
      tradeId: trade.id,
      orderIds: [c.externalOrderId, entryFill.externalOrderId].filter(Boolean),
      timestamp: c.cancelledAt ?? null,
      evidence: {
        cancelledAt: c.cancelledAt ?? null,
        filledAt: entryFill.filledAt ?? null,
        gapMs: gap,
        gapMinutes: Math.round((gap / 60000) * 10) / 10,
        side: trade.side,
        instrument: trade.ticker,
        pattern: gap <= config.triggerHesitationMs ? 'TRIGGER' : 'HESITATION',
      },
      source: 'heuristic',
      citation: null,
    });
  }
  return events;
};

/**
 * ABORTED_ATTEMPT_POST_TRADE — ordem montada e desmontada DEPOIS do trade fechar,
 * sem virar posição (#369).
 *
 * É a tentativa que não se converteu: o trader voltou ao book, montou, e recuou. Depois
 * de prejuízo, o sinal é mais forte — é ansiedade de recuperar, contida na última hora.
 * Depois de ganho, é informativo.
 *
 * Fonte: heurística operacional (pedido de Marcio, 20/08/2026).
 */
const detectAbortedAttempt = (trade, orders) => {
  const off = tradeOffsetOf(trade);
  const exitTs = toMs(trade.exitTime) ?? toMs(trade.closedAt);
  if (!exitTs) return [];

  const cancelled = ordersForTrade(orders, trade.id).filter(o =>
    o.status === 'CANCELLED' &&
    !o.isStopOrder &&
    sameInstrument(o.instrument, trade.ticker)
  );
  if (!cancelled.length) return [];

  const afterLoss = typeof trade.result === 'number' && trade.result < 0;
  const events = [];

  for (const c of cancelled) {
    const submittedTs = orderMs(c.submittedAt, off) ?? orderMs(c.cancelledAt, off);
    if (!submittedTs || submittedTs <= exitTs) continue;

    const gap = submittedTs - exitTs;
    events.push({
      type: EVENT_TYPES.ABORTED_ATTEMPT_POST_TRADE,
      severity: afterLoss ? EVENT_SEVERITY.MEDIUM : EVENT_SEVERITY.LOW,
      tradeId: trade.id,
      orderIds: [c.externalOrderId].filter(Boolean),
      timestamp: c.cancelledAt ?? c.submittedAt ?? null,
      evidence: {
        submittedAt: c.submittedAt ?? null,
        cancelledAt: c.cancelledAt ?? null,
        tradeExitTime: trade.exitTime ?? null,
        gapMs: gap,
        gapMinutes: Math.round((gap / 60000) * 10) / 10,
        qty: c.quantity ?? null,
        side: c.side ?? null,
        instrument: trade.ticker,
        afterLoss,
      },
      source: 'heuristic',
      citation: null,
    });
  }
  return events;
};

/**
 * CHASE_REENTRY — re-submit no mesmo side com preço pior antes do fill final.
 * Detecta na sequência de orders correlacionadas ao trade: cancelled-then-resubmitted
 * com preço pior (BUY mais caro / SELL mais barato).
 * Fonte: Barber & Odean 2000 (overtrading agregado).
 */
const detectChaseReentry = (trade, orders) => {
  const off = tradeOffsetOf(trade);
  const tradeOrders = ordersForTrade(orders, trade.id)
    .filter(o => !o.isStopOrder && orderSideMatchesTradeSide(o.side, trade.side))
    .map(o => ({ ...o, _ts: orderMs(o.submittedAt, off) ?? orderMs(o.filledAt, off) ?? orderMs(o.cancelledAt, off) }))
    .filter(o => o._ts != null)
    .sort((a, b) => a._ts - b._ts);

  if (tradeOrders.length < 2) return [];

  const events = [];
  for (let i = 1; i < tradeOrders.length; i++) {
    const prev = tradeOrders[i - 1];
    const curr = tradeOrders[i];
    if (prev.status !== 'CANCELLED') continue;
    if (curr.status !== 'FILLED' && curr.status !== 'PARTIALLY_FILLED' && curr.status !== 'WORKING') continue;
    const prevPrice = prev.price ?? null;
    const currPrice = curr.filledPrice ?? curr.price ?? null;
    if (!isPriceWorse(curr.side, prevPrice, currPrice)) continue;

    events.push({
      type: EVENT_TYPES.CHASE_REENTRY,
      severity: EVENT_SEVERITY.LOW,
      tradeId: trade.id,
      orderIds: [prev.externalOrderId, curr.externalOrderId].filter(Boolean),
      timestamp: curr.submittedAt ?? curr.filledAt ?? null,
      evidence: {
        side: curr.side,
        prevPrice,
        currPrice,
        worseBy: Math.round(Math.abs(currPrice - prevPrice) * 100) / 100,
      },
      source: 'heuristic',
      citation: 'Barber & Odean (2000) — agregado',
    });
  }
  return events;
};

/**
 * STOP_BREAKEVEN_TOO_EARLY — stop reissue movido para ≤ tolerância da entry,
 * dentro de janela curta após o entry. Loss aversion + regret aversion: medo
 * de perder o que ainda nem virou lucro.
 * Fonte: Kahneman & Tversky 1979; Heisler 1994.
 */
const detectStopBreakevenTooEarly = (trade, orders, config) => {
  const entryPrice = trade?.entry ?? trade?.entryPrice ?? null;
  const entryTs = toMs(trade?.entryTime);
  if (!entryPrice || !entryTs) return [];

  const off = tradeOffsetOf(trade);
  const stops = ordersForTrade(orders, trade.id)
    .filter(o => o.isStopOrder === true)
    .map(o => ({
      ...o,
      _ts: orderMs(o.submittedAt, off) ?? orderMs(o.cancelledAt, off) ?? orderMs(o.filledAt, off),
      _price: o.stopPrice ?? o.price ?? null,
    }))
    .filter(o => o._ts != null && o._price != null)
    .sort((a, b) => a._ts - b._ts);

  if (stops.length < 2) return [];

  const tolerance = getInstrumentTolerance(trade.ticker, entryPrice, config.breakevenTolerancePctFallback);
  const events = [];

  for (let i = 1; i < stops.length; i++) {
    const prev = stops[i - 1];
    const curr = stops[i];
    if (prev._price === curr._price) continue;
    if (Math.abs(curr._price - entryPrice) > tolerance) continue;
    const dt = curr._ts - entryTs;
    if (dt < 0 || dt >= config.breakevenWindowMs) continue;

    events.push({
      type: EVENT_TYPES.STOP_BREAKEVEN_TOO_EARLY,
      severity: EVENT_SEVERITY.HIGH,
      tradeId: trade.id,
      orderIds: [prev.externalOrderId, curr.externalOrderId].filter(Boolean),
      timestamp: curr.submittedAt ?? null,
      evidence: {
        from: prev._price,
        to: curr._price,
        entry: entryPrice,
        deltaToEntry: Math.round((curr._price - entryPrice) * 10000) / 10000,
        msSinceEntry: dt,
        minutesSinceEntry: Math.round((dt / 60000) * 10) / 10,
        side: trade.side,
        ticker: trade.ticker,
        tolerance,
      },
      source: 'literature',
      citation: 'Kahneman & Tversky (1979); Heisler (1994)',
    });
  }
  return events;
};

/**
 * STOP_HESITATION — ≥N reissues de stop com preço idêntico (≤ tolerância).
 * Cancelar e re-emitir o stop sem mudar nada = trader "mexendo" sem decidir.
 * Hoje detectStopTampering ignora reissues no-op (linha 136); este detector
 * caça exatamente esse sinal.
 * Fonte: heurística operacional (Heisler 1994; Locke & Mann 2005 como suporte).
 */
const detectStopHesitation = (trade, orders, config) => {
  const entryPrice = trade?.entry ?? trade?.entryPrice ?? null;
  const off = tradeOffsetOf(trade);
  const stops = ordersForTrade(orders, trade.id)
    .filter(o => o.isStopOrder === true)
    .map(o => ({
      ...o,
      _ts: orderMs(o.submittedAt, off) ?? orderMs(o.cancelledAt, off) ?? orderMs(o.filledAt, off),
      _price: o.stopPrice ?? o.price ?? null,
    }))
    .filter(o => o._ts != null && o._price != null)
    .sort((a, b) => a._ts - b._ts);

  if (stops.length < 1 + config.hesitationMinReissues) return [];

  const tolerance = getInstrumentTolerance(trade.ticker, entryPrice, config.breakevenTolerancePctFallback);
  let noOpReissues = 0;
  const involvedOrderIds = new Set();

  for (let i = 1; i < stops.length; i++) {
    const prev = stops[i - 1];
    const curr = stops[i];
    if (Math.abs(prev._price - curr._price) > tolerance) continue;
    noOpReissues += 1;
    if (prev.externalOrderId) involvedOrderIds.add(prev.externalOrderId);
    if (curr.externalOrderId) involvedOrderIds.add(curr.externalOrderId);
  }

  if (noOpReissues < config.hesitationMinReissues) return [];

  return [{
    type: EVENT_TYPES.STOP_HESITATION,
    severity: EVENT_SEVERITY.LOW,
    tradeId: trade.id,
    orderIds: [...involvedOrderIds],
    timestamp: stops[stops.length - 1].submittedAt ?? null,
    evidence: {
      stopCount: stops.length,
      noOpReissues,
      stopPrice: stops[0]._price,
      ticker: trade.ticker,
      tolerance,
    },
    source: 'heuristic',
    citation: 'Heisler (1994); Locke & Mann (2005)',
  }];
};

// ============================================
// PUBLIC API
// ============================================

/**
 * Detecta eventos comportamentais de execução.
 *
 * @param {{trades: Object[], orders: Object[], config?: Object}} input
 * @returns {Array<{type, severity, tradeId?, orderIds, timestamp, evidence, source, citation}>}
 */
export const detectExecutionEvents = ({ trades = [], orders = [], config = {} } = {}) => {
  if (!trades.length || !orders.length) return [];

  const cfg = { ...DEFAULT_CONFIG, ...config };
  const events = [];

  for (const trade of trades) {
    if (!trade?.id) continue;
    // #357 — o gatilho de alerta de stop é financeiro (risco vs RO), não movimento
    // de preço. detectStopTampering/detectPartialSizing foram substituídos.
    events.push(...detectRiskOverRo(trade, orders));
    events.push(...detectUnprotectedSize(trade, orders));
    events.push(...detectSizingDiscipline(trade, orders));
    events.push(...detectHesitation(trade, orders, cfg));
    events.push(...detectAbortedAttempt(trade, orders));
    events.push(...detectChaseReentry(trade, orders));
    events.push(...detectStopBreakevenTooEarly(trade, orders, cfg));
    events.push(...detectStopHesitation(trade, orders, cfg));
  }

  events.push(...detectRapidReentry(trades, orders, cfg));

  events.sort((a, b) => {
    const ta = toMs(a.timestamp) ?? 0;
    const tb = toMs(b.timestamp) ?? 0;
    return ta - tb;
  });

  return events;
};
