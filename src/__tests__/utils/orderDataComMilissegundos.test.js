/**
 * orderDataComMilissegundos.test.js
 * @version 1.0.0 (v1.92.4 — issue #455)
 *
 * O ProfitChart-Pro passou a exportar timestamps com milissegundos entre 16 e
 * 22/09/2026. `parseDateTime` não aceitava `.mmm`, devolvia `null`, e sem instante
 * `reconstructOperations` ordenava os fills pela ordem das linhas do arquivo — que o
 * ProfitChart escreve em ordem DECRESCENTE de criação. O trade nascia invertido e
 * datado de 01/01/1970.
 *
 * GROUND TRUTH: export real de 23/09/2026 (`2309o.csv`), conta 1000319383.
 * WINV26 LONG 5 @ 189.370 (10:58:06) → 189.870 (11:07:36), +500 pts = R$ 500.
 * A tela de decisão mostrou SHORT 189.870 → 189.370, `01/01/1970 00:00`.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseDateTime } from '../../utils/csvMapper';
import { parseProfitChartPro } from '../../utils/orderParsers';
import { validateBatch } from '../../utils/orderValidation';
import { reconstructOperations, associateNonFilledOrders } from '../../utils/orderReconstruction';
import { enrichOperationsWithStopSemantic } from '../../utils/stopSemantic';
import { mapOperationToTradeData } from '../../utils/orderTradeCreation';
import { calculateRiskReward } from '../../utils/tradeCalculations';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, '../fixtures/profit-orders');
const TZ = 'America/Sao_Paulo';

const csvReal = () => readFileSync(resolve(fixturesDir, 'set-2309-milissegundos.csv'), 'utf-8');

describe('#455 · parseDateTime aceita milissegundos', () => {
  it('parseia DD/MM/YYYY HH:mm:ss.mmm truncando ao segundo', () => {
    expect(parseDateTime('23/09/2026 10:58:06.975', 'DD/MM/YYYY')).toBe('2026-09-23T10:58:06');
  });

  it('aceita vírgula como separador decimal', () => {
    expect(parseDateTime('23/09/2026 11:07:36,787', 'DD/MM/YYYY')).toBe('2026-09-23T11:07:36');
  });

  it('não quebra o formato sem milissegundos', () => {
    expect(parseDateTime('23/09/2026 10:58:06', 'DD/MM/YYYY')).toBe('2026-09-23T10:58:06');
    expect(parseDateTime('23/09/2026 10:58', 'DD/MM/YYYY')).toBe('2026-09-23T10:58:00');
  });

  it('aceita milissegundos também no formato US', () => {
    expect(parseDateTime('09/23/2026 10:58:06.975', 'MM/DD/YYYY')).toBe('2026-09-23T10:58:06');
  });

  it('segue recusando o que não é data', () => {
    expect(parseDateTime('23/09/2026 10:58:06.9755', 'DD/MM/YYYY')).toBeNull();
    expect(parseDateTime('ontem de manhã', 'DD/MM/YYYY')).toBeNull();
  });
});

describe('#455 · massa real — os timestamps chegam ao parser', () => {
  const { orders, errors } = parseProfitChartPro(csvReal());

  it('as 3 ordens do bracket são lidas sem erro', () => {
    expect(orders).toHaveLength(3);
    expect(errors).toHaveLength(0);
  });

  it('nenhuma ordem sai sem instante de submissão', () => {
    expect(orders.every(o => o.submittedAt !== null)).toBe(true);
  });

  it('a entrada é a compra de 10:58:03, executada 10:58:06', () => {
    const entrada = orders.find(o => o.side === 'BUY');
    expect(entrada.submittedAt).toBe('2026-09-23T10:58:03');
    expect(entrada.filledAt).toBe('2026-09-23T10:58:06');
    expect(entrada.filledPrice).toBe(189370);
  });
});

describe('#455 · massa real — a operação deixa de nascer invertida', () => {
  const { orders } = parseProfitChartPro(csvReal());
  const ops = associateNonFilledOrders(reconstructOperations(orders, { timezone: TZ }), orders);
  const op = ops[0];

  it('reconstrói uma operação só', () => {
    expect(ops).toHaveLength(1);
  });

  it('é LONG — a compra abre a posição, não a venda', () => {
    expect(op.side).toBe('LONG');
  });

  it('entra a 189.370 e sai a 189.870 (não o contrário)', () => {
    expect(op.avgEntryPrice).toBe(189370);
    expect(op.avgExitPrice).toBe(189870);
  });

  it('acontece em 23/09/2026, não em 01/01/1970', () => {
    expect(op.entryTime.startsWith('2026-09-23T10:58:06')).toBe(true);
    expect(op.exitTime.startsWith('2026-09-23T11:07:36')).toBe(true);
  });

  it('resultado +500 pontos', () => {
    expect(op.resultPoints).toBe(500);
  });
});

describe('#455 · massa real — o stop de ganho não vira stopLoss', () => {
  const { orders } = parseProfitChartPro(csvReal());
  const ops = associateNonFilledOrders(reconstructOperations(orders, { timezone: TZ }), orders);
  enrichOperationsWithStopSemantic(ops);
  const op = ops[0];
  const trade = mapOperationToTradeData(op, 'PLAN_TESTE', null, { pointValue: 0.20, tickSize: 5 });

  it('a perna de 189.390 é classificada STOP_GAIN num LONG de 189.370', () => {
    expect(op.stopOrders.map(s => s.stopSemantic)).toContain('STOP_GAIN');
    expect(op.hasRealStopLoss).toBe(false);
  });

  it('o trade nasce sem stopLoss — o aluno informa', () => {
    expect(trade.stopLoss).toBeNull();
  });

  it('não produz RR fantasma de 25:1', () => {
    expect(calculateRiskReward({
      side: trade.side, entry: trade.entry, stopLoss: trade.stopLoss, takeProfit: trade.exit,
    })).toBeNull();
  });

  it('o trade sai com lado e preços corretos', () => {
    expect(trade.side).toBe('LONG');
    expect(trade.entry).toBe('189370');
    expect(trade.exit).toBe('189870');
  });
});

describe('#455 · data ilegível deixa de falhar em silêncio', () => {
  const comDataQuebrada = csvReal().replace('23/09/2026 10:58:03.171', '23-09-2026T10h58');

  it('o parser acusa a data em vez de devolver errors vazio', () => {
    const { errors } = parseProfitChartPro(comDataQuebrada);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => /formato não reconhecido/.test(e.message))).toBe(true);
  });

  it('quebrar só a Criação não invalida a ordem — o fill ainda tem instante', () => {
    const { orders } = parseProfitChartPro(comDataQuebrada);
    const { validOrders } = validateBatch(orders);
    const entrada = validOrders.find(o => o.side === 'BUY' && o.status === 'FILLED');
    expect(entrada).toBeTruthy();
    expect(entrada.filledAt).toBe('2026-09-23T10:58:06');
  });

  it('fill sem nenhum instante é ERRO de validação, não warning', () => {
    const { validOrders, invalidOrders } = validateBatch([{
      externalOrderId: 'SEM-INSTANTE', instrument: 'WINV26', side: 'BUY', status: 'FILLED',
      orderType: 'LIMIT', quantity: 5, filledQuantity: 5, filledPrice: 189370, limitPrice: 189370,
      submittedAt: null, filledAt: null,
    }]);
    expect(validOrders).toHaveLength(0);
    expect(invalidOrders).toHaveLength(1);
    expect(invalidOrders[0].errors.some(e => /timestamp/i.test(e))).toBe(true);
  });

  it('fill sem instante não entra na reconstrução — nada é inferido da ordem do arquivo', () => {
    const semInstante = [
      { externalOrderId: 'A', instrument: 'WINV26', side: 'SELL', status: 'FILLED', quantity: 5, filledQuantity: 5, filledPrice: 189870, submittedAt: null, filledAt: null },
      { externalOrderId: 'B', instrument: 'WINV26', side: 'BUY', status: 'FILLED', quantity: 5, filledQuantity: 5, filledPrice: 189370, submittedAt: null, filledAt: null },
    ];
    expect(reconstructOperations(semInstante, { timezone: TZ })).toHaveLength(0);
  });
});
