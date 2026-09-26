/**
 * orderProtecaoExecutada.test.js
 * @version 1.0.0 (v1.92.2 — issue #449)
 *
 * A proteção que FOI ACIONADA também é proteção.
 *
 * Antes do #449, a perna de bracket que fechava a posição nunca chegava a
 * `stopOrders` — o laço de associação só percorre ordem não executada. A operação
 * saía com `hasStopProtection: false`, o trade nascia com `stopLoss: null` e o
 * compliance emitia `TRADE_SEM_STOP` no trade protegido, além de calcular o RR
 * sobre o risco máximo do plano em vez do risco real.
 *
 * GROUND TRUTH: trade `X71EpvSJpLJoyEacXB4B` em produção (WINV26 SHORT 5,
 * 09/09/2026, +25 pts) e as três ordens dele no extrato da corretora.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { reconstructOperations, associateNonFilledOrders } from '../../utils/orderReconstruction';
import { mapOperationToTradeData } from '../../utils/orderTradeCreation';
import { parseProfitChartPro } from '../../utils/orderParsers';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, '../fixtures/profit-orders');
const TZ = 'America/Sao_Paulo';

const opsDoDia = (dia) => {
  const csv = readFileSync(resolve(fixturesDir, 'set-0911-inversao.csv'), 'utf-8');
  const parsed = parseProfitChartPro(csv);
  const todas = (parsed.orders ?? parsed)
    .filter((o) => `${o.filledAt || o.submittedAt || ''}`.startsWith(dia));
  const ops = reconstructOperations(todas, { timezone: TZ });
  return associateNonFilledOrders(ops, todas);
};

describe('#449 · massa real — a proteção fechou a posição e virou stopLoss', () => {
  const ops = opsDoDia('2026-09-09');
  const short = ops.find((o) => o.side === 'SHORT' && o.avgEntryPrice === 188380);

  it('a operação existe e é a do trade de +25 pts', () => {
    expect(short).toBeTruthy();
    expect(short.avgExitPrice).toBe(188355);
    expect(short.resultPoints).toBe(25);
  });

  it('a perna executada a 188.355, enviada a 188.505, conta como proteção', () => {
    expect(short.hasStopProtection).toBe(true);
    expect(short.stopExecuted).toBe(true);
    expect(short.stopOrders).toHaveLength(1);
    const perna = short.stopOrders[0];
    expect(perna.price).toBe(188505);
    expect(perna.filledPrice).toBe(188355);
  });

  it('a mesma perna continua sendo a saída da operação', () => {
    expect(short.exitOrders.some((o) => o.filledPrice === 188355)).toBe(true);
  });

  it('o alvo cancelado a 187.880 não vira proteção', () => {
    expect(short.stopOrders.some((o) => o.price === 187880)).toBe(false);
    expect(short.cancelledOrders.some((o) => o.price === 187880)).toBe(true);
  });

  it('o trade nasce com stopLoss do preço ENVIADO, não do executado', () => {
    const trade = mapOperationToTradeData(short, 'plano-x');
    expect(trade.stopLoss).toBe(188505);
    expect(trade.side).toBe('SHORT');
    expect(trade.entry).toBe('188380');
  });

  it('risco real: 125 pontos entre entrada e proteção, não o teto do plano', () => {
    const trade = mapOperationToTradeData(short, 'plano-x');
    expect(parseFloat(trade.stopLoss) - parseFloat(trade.entry)).toBe(125);
  });
});

describe('#449 · casos limite', () => {
  const ordem = (id, side, qty, hora, price, extra = {}) => ({
    externalOrderId: id,
    instrument: 'WINV26',
    side,
    quantity: qty,
    filledQuantity: extra.status === 'CANCELLED' ? null : qty,
    price,
    limitPrice: price,
    filledPrice: extra.status === 'CANCELLED' ? null : (extra.filledPrice ?? price),
    status: 'FILLED',
    submittedAt: `2026-09-09T${hora}`,
    filledAt: `2026-09-09T${hora}`,
    isStopOrder: false,
    ...extra,
  });

  const montar = (orders) => associateNonFilledOrders(
    reconstructOperations(orders, { timezone: TZ }), orders,
  );

  // #466 — a perna do bracket é ENVIADA junto com a entrada (±60s) e executa depois.
  it('LONG protegido por venda abaixo da entrada, executada → stopLoss', () => {
    const ops = montar([
      ordem('1', 'BUY', 5, '10:00:00', 100000),
      { ...ordem('2', 'SELL', 5, '10:10:00', 99500, { filledPrice: 99600 }), submittedAt: '2026-09-09T10:00:00' },
    ]);
    expect(ops[0].hasStopProtection).toBe(true);
    expect(ops[0].stopExecuted).toBe(true);
    // #468 (DEC-468-01) — LIMITE sem gatilho que executou vale pela execução: o limite
    // traz a folga do bracket, a execução é o gatilho.
    expect(mapOperationToTradeData(ops[0], 'p').stopLoss).toBe(99600);
  });

  // #466 — venda enviada 10 min depois da entrada não nasceu com a perna: é saída, não o
  // stop inicial. Continua lida como proteção da vida da posição (`stopOrders`), mas o
  // trade não ganha stop por ela.
  it('venda adversa enviada 10 min depois da entrada não vira stopLoss', () => {
    const ops = montar([
      ordem('1', 'BUY', 5, '10:00:00', 100000),
      ordem('2', 'SELL', 5, '10:10:00', 99500, { filledPrice: 99600 }),
    ]);
    expect(mapOperationToTradeData(ops[0], 'p').stopLoss).toBeNull();
  });

  it('saída no alvo (preço favorável) não é proteção — stopLoss segue nulo', () => {
    const ops = montar([
      ordem('1', 'BUY', 5, '10:00:00', 100000),
      ordem('2', 'SELL', 5, '10:10:00', 100500),
    ]);
    expect(ops[0].hasStopProtection).toBe(false);
    expect(mapOperationToTradeData(ops[0], 'p').stopLoss).toBeNull();
  });

  it('ordem enviada ANTES da entrada existir não é bracket (#369)', () => {
    const ops = montar([
      ordem('1', 'BUY', 5, '10:00:00', 100000),
      { ...ordem('2', 'SELL', 5, '10:10:00', 99500), submittedAt: '2026-09-09T09:50:00' },
    ]);
    expect(ops[0].hasStopProtection).toBe(false);
  });

  it('proteção cancelada segue funcionando como antes', () => {
    const ops = montar([
      ordem('1', 'BUY', 5, '10:00:00', 100000),
      ordem('2', 'SELL', 5, '10:00:01', 99500, { status: 'CANCELLED', cancelledAt: '2026-09-09T10:10:00' }),
      ordem('3', 'SELL', 5, '10:10:00', 100500),
    ]);
    expect(ops[0].hasStopProtection).toBe(true);
    expect(ops[0].stopExecuted).toBe(false);
    expect(mapOperationToTradeData(ops[0], 'p').stopLoss).toBe(99500);
  });

  it('a perna protetiva não é contada duas vezes em stopOrders', () => {
    const ops = montar([
      ordem('1', 'SELL', 5, '10:00:00', 100000),
      ordem('2', 'BUY', 5, '10:10:00', 100500),
    ]);
    expect(ops[0].stopOrders).toHaveLength(1);
  });

  // A ordem vem NAIVE e a operação vem com offset. Se o instante da ordem for lido no
  // fuso do processo em vez do fuso do lote, a defasagem joga a perna para fora da
  // janela de tolerância e a proteção some — foi o que reprovou a CI (UTC) enquanto
  // passava aqui (BRT). Lote em Nova York difere do fuso local o bastante para
  // reprovar a regressão em qualquer máquina.
  it('lote em outro fuso: a proteção é reconhecida igual (#375)', () => {
    const orders = [
      ordem('1', 'BUY', 5, '10:00:00', 100000),
      { ...ordem('2', 'SELL', 5, '10:10:00', 99500, { filledPrice: 99600 }), submittedAt: '2026-09-09T10:00:00' },
    ];
    const ops = associateNonFilledOrders(
      reconstructOperations(orders, { timezone: 'America/New_York' }), orders,
    );
    expect(ops[0].entryTime).toMatch(/-0[45]:00$/);
    expect(ops[0].hasStopProtection).toBe(true);
    expect(ops[0].stopExecuted).toBe(true);
    expect(mapOperationToTradeData(ops[0], 'p').stopLoss).toBe(99600) // #468 — execução, não o limite com folga;
  });
});
