/**
 * drawdown.test.js — issues #413 (defeitos 1-3) e #432.
 *
 * O teste que importa é o da ORDENAÇÃO: dois trades no MESMO dia, um ganho e uma perda,
 * produzem drawdowns diferentes conforme a ordem — e a ordem certa é a do relógio, não
 * a que o Firestore devolveu.
 */

import { describe, it, expect } from 'vitest';
import { computeDrawdown, sortByInstant, tradeInstantMs } from '../../utils/drawdown.js';

const t = (date, result, extra = {}) => ({ date, result, ...extra });

describe('tradeInstantMs', () => {
  it('prefere exitTime, depois entryTime, depois date', () => {
    expect(tradeInstantMs({ exitTime: '2026-08-12T15:30:00', entryTime: '2026-08-12T09:00:00', date: '2026-08-12' }))
      .toBe(new Date('2026-08-12T15:30:00').getTime());
    expect(tradeInstantMs({ entryTime: '2026-08-12T09:00:00', date: '2026-08-12' }))
      .toBe(new Date('2026-08-12T09:00:00').getTime());
    expect(tradeInstantMs({ date: '2026-08-12' })).toBe(new Date('2026-08-12').getTime());
  });

  it('devolve null quando nao ha instante nenhum', () => {
    expect(tradeInstantMs({})).toBeNull();
    expect(tradeInstantMs(null)).toBeNull();
    expect(tradeInstantMs({ exitTime: 'nao-e-data' })).toBeNull();
  });
});

describe('sortByInstant', () => {
  it('desempata trades do MESMO dia pelo horario (defeito 1 do #413)', () => {
    // Ordem de chegada arbitraria (Firestore): perda antes do ganho.
    const trades = [
      t('2026-08-12', -300, { id: 'tarde', exitTime: '2026-08-12T16:00:00' }),
      t('2026-08-12', 500, { id: 'cedo', exitTime: '2026-08-12T10:00:00' }),
    ];
    expect(sortByInstant(trades).map(x => x.id)).toEqual(['cedo', 'tarde']);
  });

  it('empurra trades sem instante para o fim, em ordem estavel', () => {
    const trades = [
      t(null, 10, { id: 'orfao-1' }),
      t('2026-08-12', 20, { id: 'com-data' }),
      t(null, 30, { id: 'orfao-2' }),
    ];
    expect(sortByInstant(trades).map(x => x.id)).toEqual(['com-data', 'orfao-1', 'orfao-2']);
  });

  it('nao muta o array recebido', () => {
    const trades = [t('2026-08-12', 1, { id: 'b', exitTime: '2026-08-12T16:00:00' }), t('2026-08-11', 2, { id: 'a' })];
    const copia = [...trades];
    sortByInstant(trades);
    expect(trades).toEqual(copia);
  });
});

describe('computeDrawdown — ordenacao (defeito 1)', () => {
  it('a ordem do relogio muda o resultado: ganho-depois-perda nao e perda-depois-ganho', () => {
    const cedoGanho = t('2026-08-12', 500, { exitTime: '2026-08-12T10:00:00' });
    const tardePerda = t('2026-08-12', -300, { exitTime: '2026-08-12T16:00:00' });

    // Cronologico: sobe para 10.500 (pico), cai para 10.200 → DD de 300 sobre o pico.
    const certo = computeDrawdown({ trades: [tardePerda, cedoGanho], openingBalance: 10000 });
    expect(certo.peak).toBe(10500);
    expect(certo.max.value).toBe(300);
    expect(certo.max.percent).toBeCloseTo(300 / 10500 * 100, 6);

    // Se a ordem fosse a de chegada, o pico nunca teria existido e o DD seria 300 sobre
    // 10.000 — numero diferente para o mesmo dia. E o que o card mostrava.
    const errado = computeDrawdown({
      trades: [{ ...tardePerda, exitTime: null, entryTime: null }, { ...cedoGanho, exitTime: null, entryTime: null }],
      openingBalance: 10000,
    });
    expect(errado.max.value).toBe(300);
    expect(errado.max.percent).toBeCloseTo(3, 6);
    expect(errado.max.percent).not.toBeCloseTo(certo.max.percent, 6);
  });
});

describe('computeDrawdown — semantica peak-to-trough (defeito 2)', () => {
  it('quem subiu 10% e caiu 8% NAO tem drawdown zero', () => {
    const dd = computeDrawdown({
      trades: [
        t('2026-08-01', 1000, { exitTime: '2026-08-01T10:00:00' }),  // 10.000 → 11.000
        t('2026-08-02', -880, { exitTime: '2026-08-02T10:00:00' }),  // → 10.120
      ],
      openingBalance: 10000,
    });
    expect(dd.peak).toBe(11000);
    expect(dd.current.value).toBe(880);
    expect(dd.current.percent).toBeCloseTo(880 / 11000 * 100, 6); // 8%
    expect(dd.current.percent).toBeGreaterThan(0);
  });

  it('o percentual e relativo ao PICO, nao ao aporte', () => {
    const dd = computeDrawdown({
      trades: [
        t('2026-08-01', 40000, { exitTime: '2026-08-01T10:00:00' }), // 10.000 → 50.000
        t('2026-08-02', -1000, { exitTime: '2026-08-02T10:00:00' }), // → 49.000
      ],
      openingBalance: 10000,
    });
    expect(dd.max.percent).toBeCloseTo(2, 6);       // 1.000 / 50.000
    expect(dd.max.percent).not.toBeCloseTo(10, 6);  // e nao 1.000 / 10.000
  });

  it('recuperacao total zera o drawdown CORRENTE mas preserva o MAXIMO', () => {
    const dd = computeDrawdown({
      trades: [
        t('2026-08-01', 1000, { exitTime: '2026-08-01T10:00:00' }),
        t('2026-08-02', -500, { exitTime: '2026-08-02T10:00:00' }),
        t('2026-08-03', 700, { exitTime: '2026-08-03T10:00:00' }),
      ],
      openingBalance: 10000,
    });
    expect(dd.current.value).toBe(0);
    expect(dd.current.percent).toBe(0);
    expect(dd.max.value).toBe(500);
    expect(dd.max.date).toBe('2026-08-02');
  });

  it('serie so de perdas: pico e a abertura', () => {
    const dd = computeDrawdown({
      trades: [t('2026-08-01', -200, { exitTime: '2026-08-01T10:00:00' })],
      openingBalance: 10000,
    });
    expect(dd.peak).toBe(10000);
    expect(dd.current.value).toBe(200);
    expect(dd.current.percent).toBeCloseTo(2, 6);
  });
});

describe('computeDrawdown — janela (#432)', () => {
  it('abre na abertura da JANELA, nao no aporte original', () => {
    const trades = [t('2026-08-05', -500, { exitTime: '2026-08-05T10:00:00' })];
    const janela = computeDrawdown({ trades, openingBalance: 42500 });
    expect(janela.peak).toBe(42500);
    expect(janela.current.percent).toBeCloseTo(500 / 42500 * 100, 6);
  });
});

describe('computeDrawdown — limites', () => {
  it('sem trades: tudo zero, pico na abertura', () => {
    const dd = computeDrawdown({ trades: [], openingBalance: 10000 });
    expect(dd).toMatchObject({ peak: 10000, equityFinal: 10000 });
    expect(dd.current).toEqual({ value: 0, percent: 0 });
    expect(dd.max).toEqual({ value: 0, percent: 0, date: null });
  });

  it('abertura zero nao divide por zero', () => {
    const dd = computeDrawdown({
      trades: [t('2026-08-01', -100, { exitTime: '2026-08-01T10:00:00' })],
      openingBalance: 0,
    });
    expect(dd.current.percent).toBe(0);
    expect(Number.isFinite(dd.current.percent)).toBe(true);
  });

  it('parametros ausentes degradam para zero, nao para NaN', () => {
    const dd = computeDrawdown({});
    expect(dd.current.value).toBe(0);
    expect(Number.isNaN(dd.max.percent)).toBe(false);
  });

  it('result nao numerico conta como zero', () => {
    const dd = computeDrawdown({
      trades: [t('2026-08-01', undefined, { exitTime: '2026-08-01T10:00:00' })],
      openingBalance: 10000,
    });
    expect(dd.equityFinal).toBe(10000);
  });
});
