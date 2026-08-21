/**
 * orderAttributionOrphans.test.js — v1.83.17
 *
 * Ordem que não virou posição pertence ao trade vizinho, não ao lixo.
 *
 * Cenário do Marcio (20/08/2026): trade às 10h; às 11h30 monta um set de ordens e
 * desmonta; ao meio-dia monta de novo e executa. O set das 11h30 é a hesitação do
 * trade das 12h — e antes disto era descartado na reconstrução, porque
 * `associateNonFilledOrders` só olhava ordens DENTRO do intervalo de uma operação.
 *
 * Regra completa de atribuição:
 *   1. dentro de uma operação        → daquela operação
 *   2. no vão, com trade à frente    → próxima operação (pré-entrada)
 *   3. no vão, sem trade à frente    → última operação do dia (tentativa posterior)
 *   4. sem operação nenhuma no dia   → morre (INV-29)
 */

import { describe, it, expect } from 'vitest';
import { associateNonFilledOrders } from '../../utils/orderReconstruction';

const DIA = '2026-08-20';
const hora = (h, m = 0) => `${DIA}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;

const operacao = (id, entradaH, entradaM, saidaH, saidaM, instrument = 'WINV26') => ({
  operationId: id,
  instrument,
  entryTime: hora(entradaH, entradaM),
  exitTime: hora(saidaH, saidaM),
  entryOrders: [],
  exitOrders: [],
  stopOrders: [],
  cancelledOrders: [],
});

const cancelada = (h, m, over = {}) => ({
  externalOrderId: `CL-${h}${m}`,
  instrument: 'WINV26',
  side: 'BUY',
  quantity: 5,
  status: 'CANCELLED',
  submittedAt: hora(h, m),
  cancelledAt: hora(h, m + 2),
  isStopOrder: false,
  ...over,
});

describe('associateNonFilledOrders — ordens que não viraram posição', () => {
  it('cenário real: set das 11h30 vira hesitação do trade das 12h', () => {
    const ops = [
      operacao('OP-10h', 10, 0, 10, 20),
      operacao('OP-12h', 12, 0, 12, 30),
    ];
    const orfa = cancelada(11, 30);

    associateNonFilledOrders(ops, [orfa]);

    expect(ops[1].cancelledOrders.map(o => o.externalOrderId)).toEqual(['CL-1130']);
    expect(ops[0].cancelledOrders).toHaveLength(0);
  });

  it('sem trade à frente, a tentativa vai para o último trade do dia', () => {
    const ops = [operacao('OP-10h', 10, 0, 10, 20)];
    const orfa = cancelada(11, 30);

    associateNonFilledOrders(ops, [orfa]);

    expect(ops[0].cancelledOrders.map(o => o.externalOrderId)).toEqual(['CL-1130']);
  });

  it('a operação seguinte tem prioridade sobre a anterior', () => {
    // Entre dois trades, a ordem pertence ao que veio DEPOIS: é o que ela antecipou.
    const ops = [
      operacao('OP-10h', 10, 0, 10, 20),
      operacao('OP-12h', 12, 0, 12, 30),
    ];

    associateNonFilledOrders(ops, [cancelada(11, 0)]);

    expect(ops[1].cancelledOrders).toHaveLength(1);
    expect(ops[0].cancelledOrders).toHaveLength(0);
  });

  it('ordem dentro do intervalo de uma operação continua indo para ela', () => {
    const ops = [operacao('OP-10h', 10, 0, 10, 20), operacao('OP-12h', 12, 0, 12, 30)];

    associateNonFilledOrders(ops, [cancelada(10, 10)]);

    expect(ops[0].cancelledOrders).toHaveLength(1);
    expect(ops[1].cancelledOrders).toHaveLength(0);
  });

  it('a mais de 2h de qualquer trade a ordem não é aderente — e morre pela INV-29', () => {
    // Marcio, 21/08: a janela de 2h é o critério de aderência. Cancelar às 13h com
    // trades às 10h e às 16h não diz nada sobre nenhum dos dois — reportar seria
    // fabricar evidência.
    const ops = [operacao('OP-10h', 10, 0, 10, 20), operacao('OP-16h', 16, 0, 16, 30)];

    associateNonFilledOrders(ops, [cancelada(13, 0)]);

    expect(ops[0].cancelledOrders).toHaveLength(0);
    expect(ops[1].cancelledOrders).toHaveLength(0);
  });

  it('não atravessa o dia', () => {
    const ops = [{
      ...operacao('OP-dia-seguinte', 9, 0, 9, 30),
      entryTime: '2026-08-21T09:00:00',
      exitTime: '2026-08-21T09:30:00',
    }];

    associateNonFilledOrders(ops, [cancelada(23, 30)]);

    expect(ops[0].cancelledOrders).toHaveLength(0);
  });

  it('prefere operação do MESMO instrumento antes de cair no último trade do dia', () => {
    const ops = [
      operacao('OP-WDO', 11, 50, 12, 10, 'WDOV26'),
      operacao('OP-WIN', 12, 30, 12, 50, 'WINV26'),
    ];

    associateNonFilledOrders(ops, [cancelada(11, 30)]);

    expect(ops[1].cancelledOrders).toHaveLength(1);
    expect(ops[0].cancelledOrders).toHaveLength(0);
  });

  it('stop cancelado órfão entra como stopOrder da operação atribuída', () => {
    const ops = [operacao('OP-12h', 12, 0, 12, 30)];
    const stop = cancelada(11, 30, { isStopOrder: true, externalOrderId: 'CL-STOP' });

    associateNonFilledOrders(ops, [stop]);

    expect(ops[0].stopOrders.map(o => o.externalOrderId)).toEqual(['CL-STOP']);
    expect(ops[0].hasStopProtection).toBe(true);
  });

  it('sem operação nenhuma, nada é atribuído', () => {
    const ops = [];
    expect(() => associateNonFilledOrders(ops, [cancelada(11, 30)])).not.toThrow();
    expect(ops).toEqual([]);
  });
});
