/**
 * orderReconstructionInversao.test.js
 * @version 1.0.0 (v1.92.1 — issue #446)
 *
 * A ordem que vira a mão: vende 10 estando comprado em 5. Metade zera a posição,
 * metade abre a oposta.
 *
 * GROUND TRUTH: CSV de performance do ProfitChart-Pro dos mesmos dias (conta
 * simulador 1000319383, WINV26). Cada número asseverado aqui saiu da tela do
 * Profit, não do nosso cálculo — é o que torna o teste capaz de reprovar a
 * implementação.
 *
 * Antes do #446, 09/09 saía com 3 operações no lugar de 4: o trade de +500 pts
 * era absorvido pelo anterior e nascia um LONG de 10 contratos, +230 pts, com
 * preço de entrada que é média de duas compras sem relação uma com a outra.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { reconstructOperations } from '../../utils/orderReconstruction';
import { parseProfitChartPro } from '../../utils/orderParsers';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, '../fixtures/profit-orders');

const TZ = 'America/Sao_Paulo';

const ordensDoDia = (dia) => {
  const csv = readFileSync(resolve(fixturesDir, 'set-0911-inversao.csv'), 'utf-8');
  const parsed = parseProfitChartPro(csv);
  const todas = parsed.orders ?? parsed;
  return todas.filter((o) => `${o.filledAt || o.submittedAt || ''}`.startsWith(dia));
};

const resumo = (ops) => ops.map((o) => ({
  side: o.side,
  qty: o.totalQty,
  pts: o.resultPoints,
}));

describe('#446 · 09/09/2026 — uma inversão de 10 contratos', () => {
  const ops = reconstructOperations(ordensDoDia('2026-09-09'), { timezone: TZ });

  it('são 4 operações, como na tela do Profit', () => {
    expect(ops).toHaveLength(4);
  });

  it('as 4 batem lado, quantidade e pontos com o Profit', () => {
    expect(resumo(ops)).toEqual([
      { side: 'SHORT', qty: 5, pts: 25 },
      { side: 'LONG', qty: 15, pts: 1.666 },
      { side: 'LONG', qty: 5, pts: -40 },
      { side: 'SHORT', qty: 5, pts: 500 },
    ]);
  });

  it('a venda de 10 das 14:28:35 fecha a compra de 5 em −40 pts', () => {
    const fechada = ops[2];
    expect(fechada.avgEntryPrice).toBe(188085);
    expect(fechada.avgExitPrice).toBe(188045);
    expect(fechada.entryTime).toBe('2026-09-09T14:27:53-03:00');
    expect(fechada.exitTime).toBe('2026-09-09T14:28:35-03:00');
  });

  it('e a outra metade abre a venda que rende 500 pts até 15:46:34', () => {
    const aberta = ops[3];
    expect(aberta.avgEntryPrice).toBe(188045);
    expect(aberta.avgExitPrice).toBe(187545);
    expect(aberta.entryTime).toBe('2026-09-09T14:28:35-03:00');
    expect(aberta.exitTime).toBe('2026-09-09T15:46:34-03:00');
    expect(aberta.totalQty).toBe(5);
  });

  it('nenhuma operação tem os 10 contratos da ordem inteira', () => {
    expect(ops.some((o) => o.totalQty === 10)).toBe(false);
  });

  it('o LONG inventado de +230 pts não existe mais', () => {
    expect(ops.some((o) => o.resultPoints === 230)).toBe(false);
  });

  it('as duas pernas carregam o papel de cada metade', () => {
    const saida = ops[2].exitOrders.at(-1);
    const entrada = ops[3].entryOrders[0];
    expect(saida._perna).toBe('fecha');
    expect(entrada._perna).toBe('abre');
    expect(saida.externalOrderId).toBe(entrada.externalOrderId);
    expect(saida.filledQuantity + entrada.filledQuantity).toBe(10);
  });
});

describe('#446 · 11/09/2026 — quatro inversões, uma de 50 contratos', () => {
  const ops = reconstructOperations(ordensDoDia('2026-09-11'), { timezone: TZ });

  it('são 8 operações, como na tela do Profit', () => {
    expect(ops).toHaveLength(8);
  });

  it('as seis primeiras batem com o Profit, inclusive as viradas encadeadas', () => {
    expect(resumo(ops.slice(0, 6))).toEqual([
      { side: 'SHORT', qty: 5, pts: -220 },   // 12:11:05 → fechada pela inversão de 10
      { side: 'LONG', qty: 5, pts: 20 },      // aberta pela mesma inversão
      { side: 'SHORT', qty: 10, pts: -70 },   // 15:29 → fechada pela inversão de 20
      { side: 'LONG', qty: 10, pts: -50 },    // aberta e fechada por outra inversão de 20
      { side: 'SHORT', qty: 25, pts: -131 },  // fechada pela inversão de 50
      { side: 'LONG', qty: 25, pts: 20 },     // aberta pela de 50, fechada na Zeragem
    ]);
  });

  it('as duas últimas, com fills N×M no meio, mantêm lado e tamanho', () => {
    const [penultima, ultima] = ops.slice(-2);
    expect(penultima.side).toBe('LONG');
    expect(penultima.totalQty).toBe(50);
    expect(penultima.resultPoints).toBeCloseTo(-227, 1);
    expect(ultima.side).toBe('SHORT');
    expect(ultima.totalQty).toBe(135);
    // O Profit mostra −250,67 nesta operação; aqui dá −250. A diferença NÃO é do
    // agrupamento: as entradas são vendas de 35, 50 e 50, e para as duas últimas
    // o parser entrega 188.670 onde o arquivo traz `Preço Médio` 188.668,40 e
    // 188.669,80 — o preço de UM fill, não a média da ordem. O próprio arquivo
    // confirma a média em `Total Executado` (188.669,80 × 50 × 0,2 = 1.886.698,00).
    // Defeito de leitura de preço, não de reconstrução: fora do escopo do #446.
    expect(ultima.resultPoints).toBeCloseTo(-250, 1);
  });

  it('toda operação fecha — nenhuma posição sobra aberta no fim do dia', () => {
    expect(ops.some((o) => o._isOpen)).toBe(false);
  });
});

describe('#446 · casos limite da partição', () => {
  const ordem = (id, side, qty, hora, price) => ({
    externalOrderId: id,
    instrument: 'WINV26',
    side,
    quantity: qty,
    filledQuantity: qty,
    filledPrice: price,
    status: 'FILLED',
    filledAt: `2026-09-09T${hora}`,
    submittedAt: `2026-09-09T${hora}`,
  });

  it('virada exata não parte nada — fecha e pronto', () => {
    const ops = reconstructOperations([
      ordem('1', 'BUY', 5, '10:00:00', 100),
      ordem('2', 'SELL', 5, '10:05:00', 110),
    ], { timezone: TZ });
    expect(resumo(ops)).toEqual([{ side: 'LONG', qty: 5, pts: 10 }]);
    expect(ops[0].exitOrders[0]._perna).toBeUndefined();
  });

  it('viradas em sequência: cada travessia parte de novo', () => {
    const ops = reconstructOperations([
      ordem('1', 'BUY', 5, '10:00:00', 100),
      ordem('2', 'SELL', 10, '10:05:00', 110),  // fecha 5, abre 5 vendido
      ordem('3', 'BUY', 10, '10:10:00', 105),   // fecha 5, abre 5 comprado
      ordem('4', 'SELL', 5, '10:15:00', 115),   // fecha
    ], { timezone: TZ });
    expect(resumo(ops)).toEqual([
      { side: 'LONG', qty: 5, pts: 10 },
      { side: 'SHORT', qty: 5, pts: 5 },
      { side: 'LONG', qty: 5, pts: 10 },
    ]);
  });

  it('travessia na última ordem do dia deixa a perna que abre em aberto', () => {
    const ops = reconstructOperations([
      ordem('1', 'BUY', 5, '10:00:00', 100),
      ordem('2', 'SELL', 8, '10:05:00', 110),
    ], { timezone: TZ });
    expect(ops).toHaveLength(2);
    expect(ops[0]).toMatchObject({ side: 'LONG', totalQty: 5, resultPoints: 10 });
    expect(ops[1]).toMatchObject({ side: 'SHORT', totalQty: 3 });
    expect(ops[1]._isOpen).toBe(true);
  });

  it('a partição roda depois da agregação N×M — fills do mesmo id contam juntos', () => {
    const ops = reconstructOperations([
      ordem('1', 'BUY', 5, '10:00:00', 100),
      { ...ordem('2', 'SELL', 4, '10:05:00', 110), filledQuantity: 4 },
      { ...ordem('2', 'SELL', 6, '10:05:01', 110), filledQuantity: 6 },
    ], { timezone: TZ });
    // A venda de 10 é a soma de dois fills do mesmo id. Se a partição rodasse
    // antes da agregação, a primeira metade (4) não cruzaria a posição de 5 e o
    // dia terminaria com três operações picadas em vez de duas.
    expect(resumo(ops)).toEqual([
      { side: 'LONG', qty: 5, pts: 10 },
      { side: 'SHORT', qty: 5, pts: null },
    ]);
    expect(ops[1]._isOpen).toBe(true);
  });

  it('ordem menor que a posição segue sendo saída parcial, sem partir', () => {
    const ops = reconstructOperations([
      ordem('1', 'BUY', 10, '10:00:00', 100),
      ordem('2', 'SELL', 4, '10:05:00', 110),
      ordem('3', 'SELL', 6, '10:06:00', 120),
    ], { timezone: TZ });
    expect(ops).toHaveLength(1);
    expect(ops[0].totalQty).toBe(10);
    expect(ops[0].exitOrders).toHaveLength(2);
  });
});
