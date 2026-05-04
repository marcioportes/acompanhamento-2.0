/**
 * stopSemantic.js
 * @version 1.0.0 (v1.55.2 — issue #242)
 * @description Distingue stop loss real de stop de ganho (trail/scale-out)
 *   em ordens de bracket OCO LIMIT vindas da Clear DayTrade / ProfitChart-Pro.
 *
 * Contexto do bug: o parser (`orderParsers.js`) classifica `isStopOrder` apenas
 * pelo `Tipo de Ordem` (STOP/STOP_LIMIT). Bracket OCO LIMIT da Clear emite o
 * stop como `Limite` com `Preço Stop` preenchido — o parser passou a ignorar
 * essas ordens em #208 para evitar que entries SuperDOM virassem stops, mas
 * com isso perdeu também os legs de bracket OCO. Ver AUDIT em
 * `docs/dev/AUDIT-parser-comparison-20260504.md`.
 *
 * Esta função roda APÓS `reconstructOperations` + `associateNonFilledOrders`,
 * quando o `side` da operação e o `entryOrders[0].limitPrice` (limite original
 * da primeira entrada, preservado por `normalizeOrder`) já estão disponíveis.
 * Marca `stopSemantic` em cada ordem da operação que tenha `stopPrice != null`
 * e adiciona `hasRealStopLoss` na operação.
 *
 * Critério (DEC-AUTO-242-01 — referência = LIMITE original, não avgFillPrice):
 *
 *   side oposto à posição + Preço Stop relativo ao limite da entrada:
 *     LONG  + Preço Stop < entryRef  → STOP_LOSS  (proteção contra queda)
 *     LONG  + Preço Stop >= entryRef → STOP_GAIN  (trail / breakeven plus)
 *     SHORT + Preço Stop > entryRef  → STOP_LOSS  (proteção contra alta)
 *     SHORT + Preço Stop <= entryRef → STOP_GAIN
 *
 *   side igual à posição → null (entry SuperDOM com stop anexado, não proteção)
 *
 * EXPORTS:
 *   STOP_SEMANTIC                          — enum { STOP_LOSS, STOP_GAIN }
 *   classifyStopSemantic(input)            — fn pura
 *   enrichOperationsWithStopSemantic(ops)  — mutating, retorna mesma ref
 */

export const STOP_SEMANTIC = Object.freeze({
  STOP_LOSS: 'STOP_LOSS',
  STOP_GAIN: 'STOP_GAIN',
});

/**
 * Lado oposto. BUY ↔ SELL.
 * @param {string} side
 * @returns {string|null}
 */
const oppositeSide = (side) => {
  if (side === 'BUY') return 'SELL';
  if (side === 'SELL') return 'BUY';
  return null;
};

/**
 * Mapeia `op.side` (LONG/SHORT) para o `order.side` esperado em ordens de
 * proteção (oposto à posição).
 *
 *   LONG  → SELL (proteção fecha vendendo)
 *   SHORT → BUY  (proteção fecha comprando)
 */
const protectionOrderSide = (opSide) => {
  if (opSide === 'LONG') return 'SELL';
  if (opSide === 'SHORT') return 'BUY';
  return null;
};

/**
 * Classifica uma única ordem como STOP_LOSS, STOP_GAIN, ou null.
 *
 * Função pura — sem side effects. Recebe primitivos para facilitar teste.
 *
 * @param {Object} input
 * @param {string} input.orderSide     — 'BUY' | 'SELL'
 * @param {number|null} input.orderStopPrice — `Preço Stop` da ordem
 * @param {string} input.opSide        — 'LONG' | 'SHORT'
 * @param {number|null} input.entryLimitPrice — limite da primeira entrada
 *   (`op.entryOrders[0].limitPrice`). NÃO usar `price`/`filledPrice`/
 *   `avgFillPrice` — slippage não muda intenção de proteção (DEC-AUTO-242-01).
 *   `normalizeOrder` move o `Preço` original (Limite) para `limitPrice` e
 *   sobrescreve `price` com a fill price.
 * @returns {'STOP_LOSS' | 'STOP_GAIN' | null}
 */
export function classifyStopSemantic({ orderSide, orderStopPrice, opSide, entryLimitPrice } = {}) {
  // Defensivo: sem campos críticos, não classifica.
  if (orderStopPrice == null || !Number.isFinite(orderStopPrice)) return null;
  if (entryLimitPrice == null || !Number.isFinite(entryLimitPrice)) return null;
  if (!opSide || !orderSide) return null;

  // Side da ordem precisa ser oposto ao da posição. Mesmo lado = entry
  // SuperDOM com stop anexado, não proteção da posição aberta.
  const expected = protectionOrderSide(opSide);
  if (orderSide !== expected) return null;

  if (opSide === 'LONG') {
    // Stop loss = preço abaixo da entrada; trail/ganho = acima ou igual.
    return orderStopPrice < entryLimitPrice ? STOP_SEMANTIC.STOP_LOSS : STOP_SEMANTIC.STOP_GAIN;
  }
  if (opSide === 'SHORT') {
    // Stop loss = preço acima da entrada; trail/ganho = abaixo ou igual.
    return orderStopPrice > entryLimitPrice ? STOP_SEMANTIC.STOP_LOSS : STOP_SEMANTIC.STOP_GAIN;
  }
  return null;
}

/**
 * Coleta todas as ordens da operação em um único array (sem duplicar refs).
 * `entryOrders`, `exitOrders`, `stopOrders`, `cancelledOrders` podem todos
 * conter ordens com `stopPrice != null`.
 */
function collectAllOperationOrders(op) {
  const all = [];
  if (Array.isArray(op.entryOrders)) all.push(...op.entryOrders);
  if (Array.isArray(op.exitOrders)) all.push(...op.exitOrders);
  if (Array.isArray(op.stopOrders)) all.push(...op.stopOrders);
  if (Array.isArray(op.cancelledOrders)) all.push(...op.cancelledOrders);
  return all;
}

/**
 * Para cada operação reconstruída, marca `stopSemantic` em cada ordem com
 * `stopPrice != null` e seta `op.hasRealStopLoss` quando ≥ 1 ordem do bracket
 * tem `stopSemantic === 'STOP_LOSS'`.
 *
 * Mutação in-place — segue padrão de `associateNonFilledOrders` /
 * `enrichOperationsWithStopAnalysis`. Retorna a mesma referência.
 *
 * Operações abertas (`_isOpen=true`) não são processadas (sem `entryOrders[0]`
 * ou sem fechamento → análise de proteção não aplica).
 *
 * @param {Object[]} operations — output de `associateNonFilledOrders`
 * @returns {Object[]} operations (mesma ref, mutated)
 */
export function enrichOperationsWithStopSemantic(operations) {
  if (!operations?.length) return operations;

  for (const op of operations) {
    op.hasRealStopLoss = false;
    if (!op.entryOrders?.length) continue;

    // DEC-AUTO-242-01: referência é o LIMITE da entrada, não a fill price
    // (slippage não muda intenção de proteção). `normalizeOrder` move o
    // `Preço` original para `limitPrice` e sobrescreve `price` com fill —
    // por isso preferimos `limitPrice` quando disponível. Fallback para
    // `price` cobre shapes de teste e ordens sem normalização prévia.
    const firstEntry = op.entryOrders[0];
    const entryRefRaw = firstEntry.limitPrice != null ? firstEntry.limitPrice : firstEntry.price;
    const entryRef = parseFloat(entryRefRaw);
    if (!Number.isFinite(entryRef)) continue;

    const all = collectAllOperationOrders(op);
    for (const order of all) {
      if (order.stopPrice == null) continue;
      const semantic = classifyStopSemantic({
        orderSide: order.side,
        orderStopPrice: parseFloat(order.stopPrice),
        opSide: op.side,
        entryLimitPrice: entryRef,
      });
      order.stopSemantic = semantic;
      if (semantic === STOP_SEMANTIC.STOP_LOSS) {
        op.hasRealStopLoss = true;
      }
    }
  }

  return operations;
}

export default enrichOperationsWithStopSemantic;
