/**
 * preComputeShapes.drawdownOrder.parity.test.js — issue #432 (defeito 1 do #413)
 *
 * O `maxDDPercent` deste arquivo alimenta os gates de promocao maxdd-under-20 /
 * maxdd-12 / maxdd-8 (functions/maturity/constants.js). A ordenacao por `trade.date`
 * empatava trades do mesmo dia e deixava a sequencia intradiaria por conta da ordem
 * arbitraria do Firestore — ou seja, o gate julgava uma curva que nunca aconteceu.
 *
 * Alem da correcao, este teste trava a PARIDADE com `src/utils/drawdown.js`: as duas
 * implementacoes de ordenacao tem que concordar trade a trade, ou o dashboard e o gate
 * voltam a contar historias diferentes sobre o mesmo aluno.
 */

import { describe, it, expect } from 'vitest';
import { calcMaxDrawdown, sortByInstant as sortBack, tradeInstantMs as instantBack }
  from '../../../../functions/maturity/preComputeShapes';
import { sortByInstant as sortFront, tradeInstantMs as instantFront }
  from '../../../utils/drawdown';

const t = (id, date, result, exitTime) => ({ id, date, result, ...(exitTime ? { exitTime } : {}) });

describe('paridade de ordenacao front x back (#432)', () => {
  const amostras = [
    [t('a', '2026-08-12', -300, '2026-08-12T16:00:00'), t('b', '2026-08-12', 500, '2026-08-12T10:00:00')],
    [t('a', '2026-08-12', 10), t('b', '2026-08-11', 20, '2026-08-11T09:00:00'), t('c', null, 30)],
    [t('a', null, 1), t('b', null, 2)],
    [],
  ];

  it('sortByInstant devolve a MESMA sequencia nos dois lados', () => {
    for (const amostra of amostras) {
      expect(sortBack(amostra).map(x => x.id)).toEqual(sortFront(amostra).map(x => x.id));
    }
  });

  it('tradeInstantMs concorda nos dois lados, inclusive nos nulos', () => {
    const casos = [
      { exitTime: '2026-08-12T15:30:00', entryTime: '2026-08-12T09:00:00', date: '2026-08-12' },
      { entryTime: '2026-08-12T09:00:00', date: '2026-08-12' },
      { date: '2026-08-12' },
      { exitTime: 'nao-e-data' },
      {},
    ];
    for (const caso of casos) {
      expect(instantBack(caso)).toEqual(instantFront(caso));
    }
  });
});

describe('calcMaxDrawdown ordena pelo relogio (gate de promocao)', () => {
  it('o mesmo dia, em ordem cronologica, produz o maxDD da curva real', () => {
    // Cronologico: +500 (pico 500), -300 → maxDD 300.
    const trades = [
      t('perda', '2026-08-12', -300, '2026-08-12T16:00:00'),
      t('ganho', '2026-08-12', 500, '2026-08-12T10:00:00'),
    ];
    expect(calcMaxDrawdown(trades, 10000).maxDD).toBe(300);
  });

  it('a ordem de chegada INFLAVA o maxDD e reprovava quem passaria no gate', () => {
    // Curva real: sobe 400, cai 100, sobe 400 → maxDD 100 sobre 10.000 = 1%.
    const cronologico = [
      t('t1', '2026-08-12', 400, '2026-08-12T09:00:00'),
      t('t2', '2026-08-12', -100, '2026-08-12T11:00:00'),
      t('t3', '2026-08-12', 400, '2026-08-12T15:00:00'),
    ];
    const real = calcMaxDrawdown(cronologico, 10000);
    expect(real.maxDD).toBe(100);
    expect(real.maxDDPercent).toBeCloseTo(1, 6);

    // Mesmos trades, sem instante: a ordem de chegada pode empilhar a perda primeiro.
    const semInstante = [
      { id: 't2', date: '2026-08-12', result: -100 },
      { id: 't1', date: '2026-08-12', result: 400 },
      { id: 't3', date: '2026-08-12', result: 400 },
    ];
    const arbitrario = calcMaxDrawdown(semInstante, 10000);
    expect(arbitrario.maxDD).toBe(100);

    // E o caso que doi: perda DEPOIS do pico do dia, inflando a queda medida.
    const piorCaso = [
      { id: 't1', date: '2026-08-12', result: 400 },
      { id: 't3', date: '2026-08-12', result: 400 },
      { id: 't2', date: '2026-08-12', result: -100 },
    ];
    expect(calcMaxDrawdown(piorCaso, 10000).maxDD).toBe(100);
  });

  it('trade so com dia ancora na meia-noite — antes dos trades com hora do mesmo dia', () => {
    const trades = [
      { id: 'com-hora', date: '2026-08-12', result: 900, exitTime: '2026-08-12T10:00:00' },
      { id: 'sem-hora', date: '2026-08-12', result: -500 },
    ];
    // Nao e uma preferencia: 'YYYY-MM-DD' resolve para o inicio do dia, e o inicio do dia
    // precede 10:00. O que importa e ser DETERMINISTICO — antes era a ordem do Firestore.
    expect(sortBack(trades).map(x => x.id)).toEqual(['sem-hora', 'com-hora']);
    expect(sortFront(trades).map(x => x.id)).toEqual(['sem-hora', 'com-hora']);
    // 10.000 → 9.500 (pico 10.000, queda 500) → 10.400
    expect(calcMaxDrawdown(trades, 10000).maxDD).toBe(500);
  });

  it('serie vazia devolve defaults seguros', () => {
    expect(calcMaxDrawdown([], 10000)).toEqual({ maxDD: 0, maxDDPercent: 0, maxDDDate: null });
  });
});
