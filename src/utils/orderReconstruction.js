/**
 * orderReconstruction.js
 * @version 1.1.0 (v1.37.0 — issue #156 Fase D)
 * @description Reconstrói operações (trades) a partir de ordens individuais.
 *   Usa algoritmo de net position: agrupa ordens por instrumento, acumula posição,
 *   e quando net position volta a zero → operação completa.
 *
 * ALGORITMO:
 *   0. Agregar fills N×M (mesmo externalOrderId) via aggregateFills
 *   1. Filtrar ordens FILLED, ordenar cronologicamente por filledAt/submittedAt
 *   2. Para cada instrumento, manter net position (BUY soma, SELL subtrai)
 *   3. Quando net position = 0 → operação completa (entradas + saídas agrupadas)
 *   4. Gap temporal > GAP_THRESHOLD_MS entre ops do mesmo instrumento → flag
 *      hasPriorGap=true na operação seguinte
 *   5. Associar stop orders e canceladas ao intervalo temporal da operação
 *
 * GROUND TRUTH: Validado contra 5 operações reais (19/03/2026, WINJ26)
 * ISSUE #156 Fase D: segmentação por ticker explícita + N×M + gap temporal
 *
 * EXPORTS:
 *   reconstructOperations(orders, opts?) → ReconstructedOperation[]
 *   calculateOperationResult(operation) → { resultPoints, avgEntry, avgExit }
 *   associateNonFilledOrders(operations, allOrders) → operations (mutated)
 *   DEFAULT_GAP_THRESHOLD_MS
 */

import { aggregateFills } from './orderFillAggregator';
import { naiveIsoToOffset } from './tradeTimezone';

// Threshold padrão para considerar gap temporal entre operações do mesmo
// instrumento. 60 minutos cobre janela de almoço, pausas longas intraday
// e qualquer carry-over para o dia seguinte (sessões normais duram >>60min
// só em day trade contínuo). Configurável via opts.gapThresholdMs.
export const DEFAULT_GAP_THRESHOLD_MS = 60 * 60 * 1000;

// ============================================
// HELPERS
// ============================================

/**
 * Instante efetivo da ordem como ISO+offset (#292). Prioriza filledAt, fallback
 * submittedAt. Aplica o fuso do lote ao horário naive da corretora — sem isto,
 * `new Date(naive)` interpretaria no fuso do ambiente (ambíguo). Já com offset/Z
 * (ex.: corretora exporta UTC) passa direto; sem tz mantém o comportamento legado.
 * @returns {string|null}
 */
const getEffectiveIso = (order, tz) => {
  const ts = order.filledAt || order.submittedAt;
  if (!ts) return null;
  return naiveIsoToOffset(ts, tz);
};

/**
 * Calcula preço médio ponderado de um conjunto de ordens.
 * @param {Object[]} orders — ordens com filledPrice e filledQuantity/quantity
 * @returns {number}
 */
const weightedAvgPrice = (orders) => {
  let totalValue = 0;
  let totalQty = 0;
  for (const o of orders) {
    const price = o.filledPrice ?? o.avgFillPrice ?? o.price ?? 0;
    const qty = o.filledQuantity ?? o.quantity ?? 0;
    if (price > 0 && qty > 0) {
      totalValue += price * qty;
      totalQty += qty;
    }
  }
  return totalQty > 0 ? Math.round((totalValue / totalQty) * 1000) / 1000 : 0;
};

/**
 * Determina o side da operação a partir da primeira ordem (abertura).
 * BUY first → LONG, SELL first → SHORT
 */
const operationSide = (firstOrder) => {
  return firstOrder.side === 'BUY' ? 'LONG' : 'SHORT';
};

// ============================================
// MAIN: RECONSTRUCT OPERATIONS
// ============================================

/**
 * Reconstrói operações a partir de ordens FILLED.
 *
 * @param {Object[]} orders — todas as ordens (qualquer status)
 * @param {Object} [opts]
 * @param {number} [opts.gapThresholdMs] — gap em ms para flag hasPriorGap (default 60min)
 * @returns {Object[]} ReconstructedOperation[]
 */
export const reconstructOperations = (orders, opts = {}) => {
  if (!orders?.length) return [];

  const gapThresholdMs = typeof opts.gapThresholdMs === 'number'
    ? opts.gapThresholdMs
    : DEFAULT_GAP_THRESHOLD_MS;
  const tz = opts.timezone || null; // fuso do lote (#292) — null = legado naive

  // Step 0: Agregar fills N×M do mesmo externalOrderId numa ordem lógica única
  const aggregated = aggregateFills(orders);

  // Step 1: Separar FILLED das demais. _iso = instante absoluto (ISO+offset no
  // fuso do lote); _ts = ms derivado dele (ordenação/gap/duração consistentes).
  const filledOrders = aggregated
    .filter(o => o.status === 'FILLED' || o.status === 'PARTIALLY_FILLED')
    .map(o => {
      const iso = getEffectiveIso(o, tz);
      return { ...o, _iso: iso, _ts: iso ? new Date(iso).getTime() : 0 };
    })
    .sort((a, b) => a._ts - b._ts);

  if (!filledOrders.length) return [];

  // Step 2: Segmentar por instrumento — cada ticker tem pipeline próprio de net
  // position. Previne contaminação entre tickers num bust day.
  const byInstrument = {};
  for (const order of filledOrders) {
    const key = (order.instrument || 'UNKNOWN').toUpperCase();
    if (!byInstrument[key]) byInstrument[key] = [];
    byInstrument[key].push(order);
  }

  const operations = [];
  let opCounter = 0;

  // Step 3: Para cada instrumento, reconstruir operações por net position
  for (const [instrument, instrumentOrders] of Object.entries(byInstrument)) {
    let netPosition = 0;
    let currentEntries = [];
    let currentExits = [];
    let openingSide = null; // side da primeira ordem (define LONG/SHORT)
    let lastOpExitTs = null; // exitTime da última op fechada neste instrumento (para gap)
    let pendingGap = false; // gap detectado antes da operação atual

    /**
     * Uma perna da ordem que vira a mão. Herda preço, instante e identidade do
     * MESMO fill — só a quantidade muda. `_perna` deixa o rastro do papel: a que
     * FECHA é a que leva o vínculo com o trade (#446, decisão de Marcio 16/09).
     */
    const pernaDe = (order, quantidade, papel) => ({
      ...order,
      filledQuantity: quantidade,
      quantity: quantidade,
      _perna: papel,
    });

    const processar = (order) => {
      const qty = order.filledQuantity ?? order.quantity ?? 0;
      if (qty === 0) return;

      const delta = order.side === 'BUY' ? qty : -qty;

      if (netPosition === 0) {
        // Nova operação — detecta gap contra a última op fechada deste instrumento
        if (lastOpExitTs != null && order._ts - lastOpExitTs > gapThresholdMs) {
          pendingGap = true;
        }
        openingSide = order.side;
        currentEntries = [order];
        currentExits = [];
        netPosition = delta;
      } else {
        // Posição aberta — determinar se é entrada adicional ou saída
        const isEntry = (openingSide === 'BUY' && order.side === 'BUY') ||
                        (openingSide === 'SELL' && order.side === 'SELL');

        if (isEntry) {
          currentEntries.push(order);
        } else {
          currentExits.push(order);
        }
        netPosition += delta;
      }

      // Net position zerou → operação completa
      if (netPosition === 0 && currentEntries.length > 0) {
        opCounter++;
        const side = operationSide(currentEntries[0]);
        const avgEntry = weightedAvgPrice(currentEntries);
        const avgExit = weightedAvgPrice(currentExits);

        const totalQty = currentEntries.reduce((sum, o) => sum + (o.filledQuantity ?? o.quantity ?? 0), 0);

        const resultPoints = side === 'LONG'
          ? Math.round((avgExit - avgEntry) * 1000) / 1000
          : Math.round((avgEntry - avgExit) * 1000) / 1000;

        const entryTime = currentEntries[0]._ts;
        const exitTime = currentExits.length > 0 ? currentExits[currentExits.length - 1]._ts : entryTime;
        const durationMs = exitTime - entryTime;
        const durationStr = formatDuration(durationMs);

        // Instantes absolutos (ISO+offset) para gravar no trade (#292).
        const entryIso = currentEntries[0]._iso;
        const exitIso = currentExits.length > 0
          ? currentExits[currentExits.length - 1]._iso
          : entryIso;

        operations.push({
          operationId: `OP-${String(opCounter).padStart(3, '0')}`,
          instrument,
          side,
          entryOrders: currentEntries.map(stripInternal),
          exitOrders: currentExits.map(stripInternal),
          stopOrders: [],       // preenchido em associateNonFilledOrders
          cancelledOrders: [],  // preenchido em associateNonFilledOrders
          totalQty,
          avgEntryPrice: avgEntry,
          avgExitPrice: avgExit,
          resultPoints,
          entryTime: entryIso || new Date(entryTime).toISOString(),
          exitTime: exitIso || new Date(exitTime).toISOString(),
          duration: durationStr,
          durationMs,
          hasStopProtection: false,   // preenchido em associateNonFilledOrders
          stopExecuted: false,        // preenchido em associateNonFilledOrders
          stopMovements: [],          // preenchido em stopMovementAnalysis
          hasPriorGap: pendingGap,    // Fase D: gap temporal antes desta op
        });

        // Reset — mantém lastOpExitTs para detectar gap na próxima
        lastOpExitTs = exitTime;
        pendingGap = false;
        currentEntries = [];
        currentExits = [];
        openingSide = null;
      }
    };

    for (const order of instrumentOrders) {
      const qty = order.filledQuantity ?? order.quantity ?? 0;
      if (qty === 0) continue;

      const delta = order.side === 'BUY' ? qty : -qty;

      // #446 — a ordem que VIRA A MÃO: compra 10 com o mercado vendido em 5. Ela
      // zera a venda e abre a compra no mesmo instante, e por isso não é uma
      // ordem só para a reconstrução — são duas pernas.
      //
      // Sem partir, netPosition ia de −5 para +5 sem passar por zero: a operação
      // não fechava ali e a saída seguinte era lida como SEGUNDA ENTRADA. O dia
      // 09/09/2026 saía com 3 operações no lugar de 4, o trade de +500 pts sumia
      // dentro do anterior, e no lugar dos dois nascia um de +230 pts com preço
      // médio de duas compras que nunca estiveram na mesma posição.
      const atravessaZero = netPosition !== 0
        && Math.sign(delta) !== Math.sign(netPosition)
        && Math.abs(delta) > Math.abs(netPosition);

      if (atravessaZero) {
        const qFecha = Math.abs(netPosition);
        processar(pernaDe(order, qFecha, 'fecha'));
        processar(pernaDe(order, qty - qFecha, 'abre'));
      } else {
        processar(order);
      }
    }

    // Operação incompleta (posição aberta no final)
    if (netPosition !== 0 && currentEntries.length > 0) {
      opCounter++;
      const side = operationSide(currentEntries[0]);
      const avgEntry = weightedAvgPrice(currentEntries);
      const totalQty = currentEntries.reduce((sum, o) => sum + (o.filledQuantity ?? o.quantity ?? 0), 0);

      operations.push({
        operationId: `OP-${String(opCounter).padStart(3, '0')}`,
        instrument,
        side,
        entryOrders: currentEntries.map(stripInternal),
        exitOrders: currentExits.map(stripInternal),
        stopOrders: [],
        cancelledOrders: [],
        totalQty,
        avgEntryPrice: avgEntry,
        avgExitPrice: currentExits.length > 0 ? weightedAvgPrice(currentExits) : 0,
        resultPoints: null, // posição aberta — sem resultado
        entryTime: new Date(currentEntries[0]._ts).toISOString(),
        exitTime: null,
        duration: null,
        durationMs: null,
        hasStopProtection: false,
        stopExecuted: false,
        stopMovements: [],
        // #347 — `autoObservation` removido (ver nota em stopMovementAnalysis). A posição aberta
        // já é sinalizada por `_isOpen` + `resultPoints: null`, que é o que a UI consome.
        hasPriorGap: pendingGap,
        _isOpen: true,
      });
    }
  }

  // Step 4: Ordenar operações cronologicamente
  operations.sort((a, b) => new Date(a.entryTime).getTime() - new Date(b.entryTime).getTime());

  // Re-numerar após sort
  operations.forEach((op, i) => {
    op.operationId = `OP-${String(i + 1).padStart(3, '0')}`;
  });

  return operations;
};

// ============================================
// ASSOCIATE NON-FILLED ORDERS
// ============================================

/**
 * Aderência: distância máxima entre a ordem que não virou posição e o trade vizinho
 * (v1.83.17, #369). Vale nos dois sentidos — antes da entrada e depois da saída.
 */
export const ORPHAN_ATTRIBUTION_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 horas

const mesmoDia = (aMs, bMs) => {
  const a = new Date(aMs);
  const b = new Date(bMs);
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
};

/**
 * Operação a que pertence uma ordem que não caiu dentro de nenhuma (v1.83.17).
 *
 * O set de ordens montado e desmontado entre dois trades não é lixo: é o que veio ANTES
 * da entrada seguinte (hesitação, ou reconsideração se demorou) — e, quando não há
 * entrada seguinte, é a tentativa que veio DEPOIS do último trade do dia (ansiedade).
 * Até a v1.83.16 essas ordens eram descartadas aqui, antes de qualquer gravação.
 *
 * Prioridade: próxima operação do mesmo instrumento → operação anterior do mesmo
 * instrumento → última operação do dia (qualquer instrumento).
 *
 * A janela de 2h é o critério de ADERÊNCIA, e vale nos dois sentidos: ordem que ficou a
 * mais de 2h de qualquer trade não pertence àquele momento operacional — cancelar às 9h e
 * entrar às 16h não é hesitação daquela entrada, nem tentativa posterior daquele trade.
 * Sem trade aderente a ordem morre (INV-29), em vez de virar evidência forçada.
 */
const attributeOrphanOrder = (operations, orderTs, instrument, windowMs) => {
  const alvo = (instrument || '').toUpperCase();
  const aderente = (ts) => Math.abs(ts - orderTs) <= windowMs && mesmoDia(ts, orderTs);

  let proxima = null;
  let anterior = null;
  let ultimaDoDia = null;

  for (const op of operations) {
    const entrada = new Date(op.entryTime).getTime();
    if (!entrada) continue;
    const saida = op.exitTime ? new Date(op.exitTime).getTime() : entrada;
    const mesmoInstrumento = (op.instrument || '').toUpperCase() === alvo;

    if (mesmoInstrumento && entrada > orderTs && aderente(entrada)) {
      if (!proxima || entrada < new Date(proxima.entryTime).getTime()) proxima = op;
    }
    if (mesmoInstrumento && saida < orderTs && aderente(saida)) {
      if (!anterior || saida > new Date(anterior.exitTime || anterior.entryTime).getTime()) anterior = op;
    }
    if (aderente(entrada) || aderente(saida)) {
      if (!ultimaDoDia || entrada > new Date(ultimaDoDia.entryTime).getTime()) ultimaDoDia = op;
    }
  }

  return proxima || anterior || ultimaDoDia;
};

/**
 * Associa ordens não-FILLED (CANCELLED, stops) às operações reconstruídas.
 * Usa janela temporal: ordem associada à operação cujo intervalo [entryTime, exitTime] contém
 * o submittedAt da ordem. Tolerância de 60s antes da entrada e 60s após a saída.
 *
 * A ordem que não cai dentro de nenhuma operação é atribuída ao trade vizinho
 * (v1.83.17) — ver `attributeOrphanOrder`.
 *
 * @param {Object[]} operations — output de reconstructOperations (mutated in place)
 * @param {Object[]} allOrders — todas as ordens (incluindo CANCELLED, stops)
 * @param {Object} [opts]
 * @param {number} [opts.orphanWindowMs] — janela de atribuição do órfão
 * @returns {Object[]} operations (mesma referência, mutated)
 */
/**
 * A ordem é a perna de proteção do bracket desta operação?
 *
 * DEFINIÇÃO ÚNICA (#449). O mesmo critério que `protectiveLegsOf` usa no painel e
 * nos detectores: lado oposto à posição, nascida COM ela (#369), e com o preço
 * **ENVIADO** adverso à entrada — abaixo dela num LONG, acima num SHORT. Preço
 * favorável é alvo, não proteção.
 *
 * O preço que classifica é o enviado (`stopPrice ?? limitPrice ?? price`), nunca o
 * executado: o limite com folga que garante preenchimento não é onde a proteção
 * estava. É a mesma distinção `_price` × `_riskPrice` do #371.
 *
 * @param {Object} op — operação reconstruída
 * @param {Object} order — ordem candidata
 * @param {number} toleranceMs — folga para "nasceu com a posição"
 * @returns {boolean}
 */
/** Sufixo de fuso num ISO: 'Z' ou '+HH:MM' / '-HHMM'. */
const OFFSET_RE = /(Z|[+-]\d{2}:?\d{2})$/;

/**
 * Offset do lote, lido da primeira operação que carrega fuso (#292). Um lote é de
 * um fuso só, então uma amostra basta. `null` = lote legado, tudo naive.
 */
const offsetDasOperacoes = (operations) => {
  for (const op of operations || []) {
    if (typeof op?.entryTime !== 'string') continue;
    const m = op.entryTime.match(OFFSET_RE);
    if (m) return m[1] === 'Z' ? '+00:00' : m[1];
  }
  return null;
};

/**
 * Instante da ordem resolvido NO FUSO DA OPERAÇÃO (#375, reaplicado no #449).
 *
 * `orders` guarda instante ingênuo (`"2026-09-09T11:22:02"`), enquanto a operação
 * guarda ISO+offset desde o #292. `new Date()` lê string sem offset no fuso DO
 * PROCESSO: no navegador do aluno dá America/Sao_Paulo e casa; na CI e em Cloud
 * Function, que rodam em UTC, a mesma ordem vira 11:22:02Z contra uma operação em
 * 14:22:02Z — três horas de defasagem, e a perna de proteção do trade certo passa a
 * ser lida como ordem de outro trade.
 */
const instanteDaOrdem = (valor, offset) => {
  if (!valor) return null;
  const iso = (typeof valor === 'string' && offset && !OFFSET_RE.test(valor))
    ? `${valor}${offset}`
    : valor;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? null : ms;
};

const ehProtecaoAdversa = (op, order, toleranceMs, offsetLote = null) => {
  const entradaOp = parseFloat(op?.avgEntryPrice ?? NaN);
  const precoEnviado = parseFloat(order?.stopPrice ?? order?.limitPrice ?? order?.price ?? NaN);
  if (!Number.isFinite(entradaOp) || !Number.isFinite(precoEnviado)) return false;

  const ladoOposto = op.side === 'LONG' ? 'SELL' : 'BUY';
  if (order.side !== ladoOposto) return false;

  const entradaTs = new Date(op.entryTime).getTime();
  const enviadaTs = instanteDaOrdem(order.submittedAt || order.filledAt || order.cancelledAt, offsetLote);
  const nasceuComAPosicao = Number.isFinite(entradaTs) && Number.isFinite(enviadaTs)
    && enviadaTs >= entradaTs - toleranceMs;
  if (!nasceuComAPosicao) return false;

  return op.side === 'LONG' ? precoEnviado < entradaOp : precoEnviado > entradaOp;
};

export const associateNonFilledOrders = (operations, allOrders, opts = {}) => {
  const TOLERANCE_MS = 60 * 1000; // 60 segundos
  const orphanWindowMs = opts.orphanWindowMs ?? ORPHAN_ATTRIBUTION_WINDOW_MS;
  // #449 — as ordens vêm naive e as operações com offset: sem resolver as duas no
  // mesmo fuso, a associação erra de trade fora de America/Sao_Paulo.
  const offsetLote = offsetDasOperacoes(operations);

  const nonFilled = allOrders.filter(o =>
    o.status === 'CANCELLED' || o.status === 'REJECTED' || o.status === 'EXPIRED' ||
    (o.isStopOrder && o.status !== 'FILLED') // stop orders canceladas
  );

  for (const order of nonFilled) {
    const orderTs = instanteDaOrdem(order.submittedAt || order.cancelledAt, offsetLote);
    if (!orderTs) continue;

    // Encontrar operação cujo intervalo contém o timestamp desta ordem
    let bestOp = null;
    let bestDistance = Infinity;

    for (const op of operations) {
      const opStart = new Date(op.entryTime).getTime() - TOLERANCE_MS;
      const opEnd = op.exitTime ? new Date(op.exitTime).getTime() + TOLERANCE_MS : opStart + (30 * 60 * 1000);

      if (orderTs >= opStart && orderTs <= opEnd) {
        // Dentro do intervalo — medir distância ao centro para desempate
        const center = (opStart + opEnd) / 2;
        const dist = Math.abs(orderTs - center);
        if (dist < bestDistance) {
          bestDistance = dist;
          bestOp = op;
        }
      }
    }

    // Fora de qualquer operação: pertence ao trade vizinho, não ao lixo (v1.83.17).
    if (!bestOp) bestOp = attributeOrphanOrder(operations, orderTs, order.instrument, orphanWindowMs);
    if (!bestOp) continue;

    // #371 — mesma definição de proteção do detector (protectiveLegsOf, #359):
    // esta corretora emite a perna de proteção do bracket como LIMITE com Preço Stop
    // vazio (DEC-AUTO-242-01), então o que a identifica é o LADO — adversa à entrada.
    // Antes só `isStopOrder` contava aqui, e a operação ficava `hasStopProtection:false`
    // enquanto o detector via proteção: a mesma ordem lida de dois jeitos no mesmo
    // sistema, e foi essa divergência que fez o import apagar o stop do aluno.
    const protecaoDoBracket = !order.isStopOrder
      && ehProtecaoAdversa(bestOp, order, TOLERANCE_MS, offsetLote);

    // Classificar a ordem
    if (order.isStopOrder || protecaoDoBracket) {
      bestOp.stopOrders.push(stripInternal(order));
      bestOp.hasStopProtection = true;
      // Stop executado = stop order que foi FILLED
      if (order.status === 'FILLED') {
        bestOp.stopExecuted = true;
      }
    } else {
      bestOp.cancelledOrders.push(stripInternal(order));
    }
  }

  // #449 — a proteção que FOI ACIONADA também é proteção.
  //
  // O laço acima só enxerga ordem não executada, então a perna de bracket que fecha
  // a posição — o desfecho normal de quem opera com stop — nunca chegava a
  // `stopOrders`: a operação saía com `hasStopProtection: false`, o trade nascia sem
  // `stopLoss` e o compliance acusava "trade sem stop" JUSTAMENTE no trade protegido.
  // No caso real de 09/09/2026 (WINV26 SHORT 5), a compra enviada a 188.505, acima da
  // entrada de 188.380, executou a 188.355 e fechou a posição: proteção acionada,
  // registrada como ausência de proteção.
  //
  // A perna continua em `exitOrders` — ela é as duas coisas, e as duas leituras
  // precisam seguir verdadeiras. Aqui ela só passa a constar TAMBÉM em `stopOrders`.
  for (const op of operations) {
    for (const order of op.exitOrders || []) {
      if (!(order.isStopOrder || ehProtecaoAdversa(op, order, TOLERANCE_MS, offsetLote))) continue;
      op.stopOrders.push(order);
      op.hasStopProtection = true;
      if (order.status === 'FILLED' || order.status === 'PARTIALLY_FILLED') {
        op.stopExecuted = true;
      }
    }
  }

  // Detectar stop executado via saída com origin=Zeragem
  for (const op of operations) {
    if (!op.stopExecuted) {
      const hasZeragem = op.exitOrders.some(o => (o.origin || '').toLowerCase() === 'zeragem');
      if (hasZeragem) {
        op.stopExecuted = true;
      }
    }
  }

  return operations;
};

// ============================================
// CALCULATE OPERATION RESULT
// ============================================

/**
 * Recalcula resultado de uma operação (utility para verificação).
 * @param {Object} operation
 * @returns {{ resultPoints: number, avgEntry: number, avgExit: number }}
 */
export const calculateOperationResult = (operation) => {
  const avgEntry = weightedAvgPrice(operation.entryOrders);
  const avgExit = weightedAvgPrice(operation.exitOrders);

  const resultPoints = operation.side === 'LONG'
    ? Math.round((avgExit - avgEntry) * 1000) / 1000
    : Math.round((avgEntry - avgExit) * 1000) / 1000;

  return { resultPoints, avgEntry, avgExit };
};

// ============================================
// HELPERS (internal)
// ============================================

/**
 * Remove campos internos (_ts, _raw, etc) de uma ordem para serialização limpa.
 */
const stripInternal = (order) => {
  const { _ts, _raw, _dedupKey, _rowIndex, _validationWarnings, ...clean } = order;
  return { ...clean, _rowIndex };
};

/**
 * Formata duração em ms para string legível.
 */
const formatDuration = (ms) => {
  if (!ms || ms <= 0) return '0s';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h${minutes > 0 ? String(minutes).padStart(2, '0') + 'min' : ''}${seconds > 0 ? String(seconds).padStart(2, '0') + 's' : ''}`;
  if (minutes > 0) return `${minutes}min${seconds > 0 ? String(seconds).padStart(2, '0') + 's' : ''}`;
  return `${seconds}s`;
};
