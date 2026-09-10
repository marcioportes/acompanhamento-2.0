/**
 * windowBalance.test.js — issue #432
 *
 * O contrato sob teste é a identidade `abertura + resultado = saldo ao fim da janela`
 * e a recusa em somar moedas. O cenário numérico é o mesmo da memória de cálculo do
 * doc de controle (docs/dev/issues/issue-432-janela-do-card-financeiro.md).
 */

import { describe, it, expect } from 'vitest';
import { buildWindowBalances, totalsForSingleCurrency, pctOverOpening } from '../../utils/windowBalance.js';

const acc = (id, initialBalance, currency = 'BRL') => ({ id, initialBalance, currency });
const trade = (accountId, date, result) => ({ accountId, date, result });

/** Fechamento CLOSED com saque/aporte manual: rollPL != plFinal → ajuste não-trade. */
const closure = (accountId, cycleEnd, plInicial, saldoFinal, newPl = null) => ({
  accountId,
  status: 'CLOSED',
  cycleEnd,
  cycleBaseline: { plInicial, saldoFinal, plFinal: plInicial + saldoFinal },
  ...(newPl != null ? { forward: { planAdjustment: { changed: true, newPl } } } : {}),
});

describe('buildWindowBalances', () => {
  it('abre no aporte quando a janela é todo o histórico', () => {
    const b = buildWindowBalances({
      accounts: [acc('a1', 40000)],
      windowStart: null,
      tradesForCarry: [trade('a1', '2026-07-10', 1200)],
      windowTrades: [trade('a1', '2026-07-10', 1200)],
    });
    expect(b.get('BRL').opening).toBe(40000);
    expect(b.get('BRL').result).toBe(1200);
    expect(b.get('BRL').end).toBe(41200);
  });

  it('carrega os trades anteriores à janela para dentro da abertura', () => {
    const b = buildWindowBalances({
      accounts: [acc('a1', 40000)],
      windowStart: '2026-07-01',
      tradesForCarry: [
        trade('a1', '2026-06-15', 1200),  // antes da janela → vira abertura
        trade('a1', '2026-07-20', 3300),  // dentro → é resultado, não abertura
      ],
      windowTrades: [trade('a1', '2026-07-20', 3300)],
    });
    const brl = b.get('BRL');
    expect(brl.opening).toBe(41200);
    expect(brl.result).toBe(3300);
    expect(brl.end).toBe(44500);
  });

  it('desconta saque manual de fechamento anterior (ajuste nao-trade #259)', () => {
    // Julho fechou com plFinal 44.500 e saque manual para 42.500 → ajuste -2.000.
    const b = buildWindowBalances({
      accounts: [acc('a1', 40000)],
      windowStart: '2026-08-01',
      tradesForCarry: [
        trade('a1', '2026-06-15', 1200),
        trade('a1', '2026-07-20', 3300),
        trade('a1', '2026-08-12', 3240),
      ],
      windowTrades: [trade('a1', '2026-08-12', 3240)],
      closures: [closure('a1', '2026-07-31', 41200, 3300, 42500)],
    });
    const brl = b.get('BRL');
    expect(brl.opening).toBe(42500);   // 40.000 + 4.500 - 2.000
    expect(brl.result).toBe(3240);
    expect(brl.end).toBe(45740);
  });

  it('ignora fechamento cujo ciclo termina DENTRO ou DEPOIS da janela', () => {
    const b = buildWindowBalances({
      accounts: [acc('a1', 40000)],
      windowStart: '2026-07-01',
      tradesForCarry: [],
      windowTrades: [],
      closures: [closure('a1', '2026-07-31', 41200, 3300, 42500)],
    });
    expect(b.get('BRL').opening).toBe(40000);
  });

  it('o percentual do total NAO e a soma dos percentuais das moedas', () => {
    const b = buildWindowBalances({
      accounts: [acc('a1', 10000), acc('a2', 90000)],
      windowStart: null,
      windowTrades: [trade('a1', '2026-08-05', 1000)],
    });
    // Uma so entrada (mesma moeda): 1.000 sobre 100.000 = 1%, e nao 10%.
    expect(totalsForSingleCurrency(b).pctOfOpening).toBeCloseTo(1, 6);
  });

  it('a identidade abertura + resultado = fim vale em toda entrada', () => {
    const b = buildWindowBalances({
      accounts: [acc('a1', 40000), acc('a2', 10000), acc('a3', 5000, 'USD')],
      windowStart: '2026-08-01',
      tradesForCarry: [trade('a1', '2026-07-01', 500), trade('a3', '2026-07-01', 90)],
      windowTrades: [trade('a1', '2026-08-05', 300), trade('a3', '2026-08-06', -40)],
    });
    for (const entry of b.values()) {
      expect(entry.end).toBe(entry.opening + entry.result);
    }
  });

  it('nao soma moedas diferentes — uma entrada por moeda', () => {
    const b = buildWindowBalances({
      accounts: [acc('a1', 40000, 'BRL'), acc('a2', 5000, 'USD')],
      windowStart: '2026-08-01',
      tradesForCarry: [trade('a1', '2026-07-01', 1000), trade('a2', '2026-07-01', 200)],
      windowTrades: [trade('a1', '2026-08-05', 300), trade('a2', '2026-08-05', 50)],
    });
    expect(b.size).toBe(2);
    expect(b.get('BRL')).toMatchObject({ opening: 41000, result: 300, end: 41300 });
    expect(b.get('USD')).toMatchObject({ opening: 5200, result: 50, end: 5250 });
  });

  it('agrega multiplas contas da MESMA moeda numa entrada só', () => {
    const b = buildWindowBalances({
      accounts: [acc('a1', 40000), acc('a2', 10000)],
      windowStart: '2026-08-01',
      tradesForCarry: [trade('a1', '2026-07-01', 500), trade('a2', '2026-07-02', 250)],
      windowTrades: [trade('a1', '2026-08-05', 300), trade('a2', '2026-08-06', -100)],
    });
    expect(b.size).toBe(1);
    expect(b.get('BRL')).toMatchObject({ opening: 50750, result: 200, end: 50950, accountCount: 2 });
  });

  it('janela sem trades: saldo do fim = abertura (nao e estado de erro)', () => {
    const b = buildWindowBalances({
      accounts: [acc('a1', 40000)],
      windowStart: '2026-08-01',
      tradesForCarry: [trade('a1', '2026-07-01', 1200)],
      windowTrades: [],
    });
    expect(b.get('BRL')).toMatchObject({ opening: 41200, result: 0, end: 41200 });
  });

  it('conta sem initialBalance conta como zero, nao como NaN', () => {
    const b = buildWindowBalances({
      accounts: [{ id: 'a1', currency: 'BRL' }],
      windowStart: '2026-08-01',
      tradesForCarry: [],
      windowTrades: [trade('a1', '2026-08-05', 300)],
    });
    expect(b.get('BRL')).toMatchObject({ opening: 0, result: 300, end: 300 });
  });

  it('ignora trades de contas fora do escopo', () => {
    const b = buildWindowBalances({
      accounts: [acc('a1', 40000)],
      windowStart: '2026-08-01',
      tradesForCarry: [trade('forasteira', '2026-07-01', 9999)],
      windowTrades: [trade('forasteira', '2026-08-05', 9999)],
    });
    expect(b.get('BRL')).toMatchObject({ opening: 40000, result: 0, end: 40000 });
  });

  it('escopo vazio devolve Map vazio', () => {
    expect(buildWindowBalances({ accounts: [] }).size).toBe(0);
    expect(buildWindowBalances({}).size).toBe(0);
  });
});

describe('pctOfOpening — retorno sobre o capital da janela', () => {
  it('e resultado / PL inicial, a mesma conta do fechamento de ciclo', () => {
    const b = buildWindowBalances({
      accounts: [acc('a1', 40000)],
      windowStart: '2026-08-01',
      tradesForCarry: [trade('a1', '2026-07-01', 2500)],   // abertura 42.500
      windowTrades: [trade('a1', '2026-08-12', 1275)],
    });
    expect(b.get('BRL').opening).toBe(42500);
    expect(b.get('BRL').pctOfOpening).toBeCloseTo(3, 6);   // 1.275 / 42.500
  });

  it('prejuizo da percentual negativo', () => {
    const b = buildWindowBalances({
      accounts: [acc('a1', 10000)],
      windowStart: null,
      windowTrades: [trade('a1', '2026-08-12', -250)],
    });
    expect(b.get('BRL').pctOfOpening).toBeCloseTo(-2.5, 6);
  });

  it('sem capital o percentual e null, nao zero — 0% afirmaria que nao rendeu', () => {
    const b = buildWindowBalances({
      accounts: [{ id: 'a1', currency: 'BRL' }],
      windowStart: null,
      windowTrades: [trade('a1', '2026-08-12', 300)],
    });
    expect(b.get('BRL').pctOfOpening).toBeNull();
  });

  it('cada moeda tem seu proprio denominador', () => {
    const b = buildWindowBalances({
      accounts: [acc('a1', 10000, 'BRL'), acc('a2', 5000, 'USD')],
      windowStart: null,
      windowTrades: [trade('a1', '2026-08-05', 500), trade('a2', '2026-08-05', 500)],
    });
    expect(b.get('BRL').pctOfOpening).toBeCloseTo(5, 6);
    expect(b.get('USD').pctOfOpening).toBeCloseTo(10, 6);
  });
});

describe('pctOverOpening', () => {
  it('descreve o numerador que recebe — util quando o tile mostra a amostra', () => {
    expect(pctOverOpening(1275, 42500)).toBeCloseTo(3, 6);
    expect(pctOverOpening(-250, 10000)).toBeCloseTo(-2.5, 6);
  });

  it('null para base ausente, zero, negativa ou numerador invalido', () => {
    expect(pctOverOpening(100, 0)).toBeNull();
    expect(pctOverOpening(100, -5)).toBeNull();
    expect(pctOverOpening(100, undefined)).toBeNull();
    expect(pctOverOpening(undefined, 1000)).toBeNull();
    expect(pctOverOpening(NaN, 1000)).toBeNull();
  });
});

describe('totalsForSingleCurrency', () => {
  it('soma as entradas quando ha uma moeda so', () => {
    const b = buildWindowBalances({
      accounts: [acc('a1', 40000), acc('a2', 10000)],
      windowStart: '2026-08-01',
      tradesForCarry: [trade('a1', '2026-07-01', 500)],
      windowTrades: [trade('a1', '2026-08-05', 300)],
    });
    expect(totalsForSingleCurrency(b)).toEqual({
      opening: 50500, result: 300, end: 50800, pctOfOpening: (300 / 50500) * 100,
    });
  });

  it('devolve zeros para Map vazio', () => {
    expect(totalsForSingleCurrency(new Map())).toEqual({ opening: 0, result: 0, end: 0, pctOfOpening: null });
    expect(totalsForSingleCurrency(undefined)).toEqual({ opening: 0, result: 0, end: 0, pctOfOpening: null });
  });
});
