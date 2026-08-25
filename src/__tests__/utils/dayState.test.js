/**
 * #402 — motor do período: o que é do dia, e o que cada operação decidiu.
 *
 * Fixture central: o incidente real de 25/08/2026. Plano Ago-Plano
 * (pl 30.000, RO 0,84% = R$ 252, stop 1,67% = R$ 501), dois trades passados
 * FORA DE ORDEM ao array — que é exatamente como o importador os gravou.
 */
import { describe, it, expect } from 'vitest';
import { buildPeriodState, buildPeriodIndex, authorizationFor, AUTHORIZATION } from '../../utils/dayState';

const PLANO = {
  pl: 30000,
  riskPerOperation: 0.84,
  periodStop: 1.67,
  periodGoal: 3.35,
  rrTarget: 2,
  operationPeriod: 'Diário',
};

const A = {
  id: 'cUG60nG3TOcrC7d2Euwb',
  date: '2026-08-25',
  entryTime: '2026-08-25T10:51:01',
  exchange: 'B3',
  result: -250,
  qty: 5,
  createdAt: { seconds: 1787678452 },
};
const B = {
  id: 'TIvs3Vh4sEKUc1HYEd7p',
  date: '2026-08-25',
  entryTime: '2026-08-25T11:34:02-03:00',
  exchange: 'B3',
  result: -265,
  qty: 5,
  createdAt: { seconds: 1787678449 }, // gravado 3s ANTES de A
};

const trade = (id, hora, result, extra = {}) => ({
  id,
  date: '2026-08-25',
  entryTime: `2026-08-25T${hora}-03:00`,
  exchange: 'B3',
  result,
  qty: 1,
  ...extra,
});

describe('buildPeriodState — o incidente de 25/08', () => {
  // Passado fora de ordem de propósito.
  const ps = buildPeriodState([B, A], PLANO);

  it('deriva os valores do plano', () => {
    expect(ps.stopValue).toBeCloseTo(501, 2);
    expect(ps.roValue).toBeCloseTo(252, 2);
    expect(ps.goalValue).toBeCloseTo(1005, 2);
    expect(ps.maxAuthorizedTrades).toBe(1);
  });

  it('resultado do dia é o LÍQUIDO', () => {
    expect(ps.net).toBe(-515);
    expect(ps.gains).toBe(0);
    expect(ps.losses).toBe(515);
    expect(ps.count).toBe(2);
    expect(ps.qty).toBe(10);
  });

  it('ordena por instante, não pela ordem de escrita', () => {
    expect(ps.rows.map((r) => r.tradeId)).toEqual([A.id, B.id]);
  });

  it('o trade das 10:51 fica LIMPO — tinha o limite inteiro disponível', () => {
    const linha = ps.rows[0];
    expect(linha.cumBefore).toBe(0);
    expect(linha.budgetBefore).toBeCloseTo(501, 2);
    expect(linha.authorization).toBe(AUTHORIZATION.AUTHORIZED);
  });

  it('o trade das 11:34 abriu sem folga — R$ 251 para um RO de R$ 252', () => {
    const linha = ps.rows[1];
    expect(linha.cumBefore).toBe(-250);
    expect(linha.budgetBefore).toBeCloseTo(251, 2);
    expect(linha.authorization).toBe(AUTHORIZATION.NO_ROOM);
  });

  it('o dia é que estourou — e ninguém abriu depois do stop', () => {
    expect(ps.closedBeyondStop).toBe(true);
    expect(ps.beyondStopBy).toBeCloseTo(14, 2);
    expect(ps.tradesAfterStop).toBe(0);
    expect(ps.stopHitIndex).toBe(1); // o stop foi cruzado NO segundo trade
  });

  it('nenhuma operação é APOS_STOP', () => {
    expect(ps.rows.some((r) => r.authorization === AUTHORIZATION.AFTER_STOP)).toBe(false);
  });

  it('a ordem é confiável mesmo com naive + offset misturados no dia', () => {
    // reason 'mixed_offsets': o instante resolve, mas o motor declara a mistura
    expect(ps.ordering.reliable).toBe(false);
    expect(ps.ordering.reason).toBe('mixed_offsets');
  });
});

describe('invariância à ordem de entrada', () => {
  it('qualquer permutação produz exatamente o mesmo estado', () => {
    const base = JSON.stringify(buildPeriodState([A, B], PLANO));
    expect(JSON.stringify(buildPeriodState([B, A], PLANO))).toBe(base);
  });

  it('vale com mais linhas', () => {
    const t = [trade('a', '09:00:00', -100), trade('b', '10:00:00', 50), trade('c', '11:00:00', -80)];
    const esperado = JSON.stringify(buildPeriodState(t, PLANO));
    const permutacoes = [[0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
    for (const p of permutacoes) {
      expect(JSON.stringify(buildPeriodState(p.map((i) => t[i]), PLANO))).toBe(esperado);
    }
  });
});

describe('líquido, não soma de perdas (regressão do defeito de origem)', () => {
  it('dia lucrativo NÃO estoura o stop, mesmo com perdas somando acima dele', () => {
    // O servidor antigo somava só as perdas: 1.000 > 501 → acusava.
    const t = [trade('a', '09:00:00', 1000), trade('b', '10:00:00', -600), trade('c', '11:00:00', -300)];
    const ps = buildPeriodState(t, PLANO);
    expect(ps.losses).toBe(900); // o bruto continua exposto, mas não governa
    expect(ps.net).toBe(100);
    expect(ps.closedBeyondStop).toBe(false);
    expect(ps.rows.every((r) => r.authorization === AUTHORIZATION.AUTHORIZED)).toBe(true);
  });

  it('dia empatado no zero não estoura nada', () => {
    const t = [trade('a', '09:00:00', 1000), trade('b', '10:00:00', -600), trade('c', '11:00:00', -400)];
    const ps = buildPeriodState(t, PLANO);
    expect(ps.net).toBe(0);
    expect(ps.closedBeyondStop).toBe(false);
  });

  it('ganho da manhã estende o orçamento (cushionPolicy net, default)', () => {
    const t = [trade('a', '09:00:00', 1000), trade('b', '10:00:00', -100)];
    const ps = buildPeriodState(t, PLANO);
    expect(ps.rows[1].budgetBefore).toBeCloseTo(1501, 2); // 501 + 1000
  });

  it('cushionPolicy floor ignora o ganho para efeito de orçamento', () => {
    const t = [trade('a', '09:00:00', 1000), trade('b', '10:00:00', -100)];
    const ps = buildPeriodState(t, PLANO, { cushionPolicy: 'floor' });
    expect(ps.rows[1].budgetBefore).toBeCloseTo(501, 2); // 501 + min(1000, 0)
  });
});

describe('APOS_STOP — a única violação atômica de verdade', () => {
  it('marca CADA operação aberta depois do orçamento fechado', () => {
    const t = [
      trade('a', '09:00:00', -300),
      trade('b', '10:00:00', -250), // aqui o acumulado passa de -501
      trade('c', '11:00:00', -100), // abriu com cumBefore -550
      trade('d', '12:00:00', 40), //  abriu com cumBefore -650
    ];
    const ps = buildPeriodState(t, PLANO);
    expect(ps.rows.map((r) => r.authorization)).toEqual([
      AUTHORIZATION.AUTHORIZED, // folga 501 >= RO 252
      AUTHORIZATION.NO_ROOM, //    folga 201 < RO 252, mas o stop ainda não fechou
      AUTHORIZATION.AFTER_STOP, // cumBefore -550 <= -501
      AUTHORIZATION.AFTER_STOP, // cumBefore -650
    ]);
    expect(ps.tradesAfterStop).toBe(2);
    expect(ps.stopHitIndex).toBe(1);
  });

  it('APOS_STOP tem precedência sobre SEM_FOLGA', () => {
    const t = [trade('a', '09:00:00', -600), trade('b', '10:00:00', -10)];
    const ps = buildPeriodState(t, PLANO);
    expect(ps.rows[1].authorization).toBe(AUTHORIZATION.AFTER_STOP);
  });
});

describe('meta do período', () => {
  it('registra quando a meta é atingida', () => {
    const t = [trade('a', '09:00:00', 600), trade('b', '10:00:00', 500)];
    const ps = buildPeriodState(t, PLANO);
    expect(ps.goalHitIndex).toBe(1);
    expect(ps.reachedGoal).toBe(true);
  });

  it('não inventa meta quando não chegou lá', () => {
    const ps = buildPeriodState([trade('a', '09:00:00', 100)], PLANO);
    expect(ps.goalHitIndex).toBeNull();
    expect(ps.reachedGoal).toBe(false);
  });
});

describe('casos limites', () => {
  it('dia sem trades', () => {
    const ps = buildPeriodState([], PLANO);
    expect(ps.net).toBe(0);
    expect(ps.count).toBe(0);
    expect(ps.rows).toEqual([]);
    expect(ps.closedBeyondStop).toBe(false);
    expect(ps.ordering.reliable).toBe(true);
  });

  it('plano ausente: mede o dia, não julga autorização', () => {
    const ps = buildPeriodState([A, B], null);
    expect(ps.net).toBe(-515);
    expect(ps.stopValue).toBeNull();
    expect(ps.roValue).toBeNull();
    expect(ps.closedBeyondStop).toBeNull();
    expect(ps.rows.every((r) => r.authorization === null)).toBe(true);
  });

  it('pl <= 0 é o mesmo que plano ausente para efeito de limiar', () => {
    const ps = buildPeriodState([A], { ...PLANO, pl: 0 });
    expect(ps.stopValue).toBeNull();
    expect(ps.net).toBe(-250);
  });

  it('periodStop = 0: sem stop, mas o RO ainda existe', () => {
    const ps = buildPeriodState([A], { ...PLANO, periodStop: 0 });
    expect(ps.stopValue).toBeNull();
    expect(ps.roValue).toBeCloseTo(252, 2);
    expect(ps.closedBeyondStop).toBeNull();
    expect(ps.rows[0].authorization).toBeNull();
  });

  it('riskPerOperation = 0: SEM_FOLGA nunca dispara, APOS_STOP ainda funciona', () => {
    const semRo = { ...PLANO, riskPerOperation: 0 };
    const ps = buildPeriodState([trade('a', '09:00:00', -600), trade('b', '10:00:00', -10)], semRo);
    expect(ps.roValue).toBeNull();
    expect(ps.maxAuthorizedTrades).toBeNull();
    expect(ps.rows[0].authorization).toBe(AUTHORIZATION.AUTHORIZED);
    expect(ps.rows[1].authorization).toBe(AUTHORIZATION.AFTER_STOP);
  });

  it('RO maior que o stop: plano não autoriza nenhuma operação', () => {
    const incoerente = { ...PLANO, riskPerOperation: 2.0 }; // R$ 600 > R$ 501
    const ps = buildPeriodState([trade('a', '09:00:00', -50)], incoerente);
    expect(ps.maxAuthorizedTrades).toBe(0);
    expect(ps.rows[0].authorization).toBe(AUTHORIZATION.NO_ROOM);
  });

  it('result ausente conta como zero', () => {
    const ps = buildPeriodState([{ id: 'x', date: '2026-08-25', entryTime: '2026-08-25T09:00:00-03:00' }], PLANO);
    expect(ps.net).toBe(0);
    expect(ps.count).toBe(1);
  });

  it('trade sem entryTime derruba a confiança na ordem', () => {
    const semHora = { id: 'z', date: '2026-08-25', result: -10 };
    const ps = buildPeriodState([trade('a', '09:00:00', -10), semHora], PLANO);
    expect(ps.ordering.reliable).toBe(false);
    expect(ps.ordering.reason).toBe('missing_entry_time');
  });

  it('entrada inválida não explode', () => {
    expect(buildPeriodState(null, PLANO).count).toBe(0);
    expect(buildPeriodState(undefined, undefined).net).toBe(0);
  });
});

describe('buildPeriodIndex + authorizationFor', () => {
  const outroDia = trade('d', '09:00:00', -100, { id: 'd', date: '2026-08-26', entryTime: '2026-08-26T09:00:00-03:00' });

  it('separa por dia quando operationPeriod é Diário', () => {
    const idx = buildPeriodIndex([A, B, outroDia], PLANO);
    expect([...idx.keys()].sort()).toEqual(['2026-08-25', '2026-08-26']);
    expect(idx.get('2026-08-25').net).toBe(-515);
    expect(idx.get('2026-08-26').net).toBe(-100);
  });

  it('agrupa a semana quando operationPeriod é Semanal', () => {
    const idx = buildPeriodIndex([A, B, outroDia], { ...PLANO, operationPeriod: 'Semanal' });
    expect(idx.size).toBe(1);
    expect([...idx.values()][0].net).toBe(-615);
  });

  it('authorizationFor devolve a linha do trade', () => {
    const ps = buildPeriodState([B, A], PLANO);
    expect(authorizationFor(A, ps).authorization).toBe(AUTHORIZATION.AUTHORIZED);
    expect(authorizationFor(B, ps).authorization).toBe(AUTHORIZATION.NO_ROOM);
    expect(authorizationFor({ id: 'inexistente' }, ps)).toBeNull();
  });
});
