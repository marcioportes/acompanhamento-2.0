/**
 * orderInstant.test.js — SSoT do instante de ordem no cliente (#464, épico #462 F1).
 *
 * Roda igual em TZ=UTC e TZ=America/Sao_Paulo: toda asserção é sobre instante absoluto
 * (`toISOString`) ou relógio de parede, nunca sobre o fuso do processo.
 */
import { describe, it, expect } from 'vitest';
import {
  offsetOf,
  tradeOffsetOf,
  instantAtOffsetMs,
  orderInstantMs,
  wallClockMs,
  stripBatchOffset,
} from '../../utils/orderInstant';

const iso = (ms) => new Date(ms).toISOString();

describe('#464 · offsetOf / tradeOffsetOf', () => {
  it('normaliza Z e offset sem dois-pontos', () => {
    expect(offsetOf('2026-08-21T14:27:51Z')).toBe('+00:00');
    expect(offsetOf('2026-07-15T09:30:00-0400')).toBe('-04:00');
    expect(offsetOf('2026-08-21T11:27:51-03:00')).toBe('-03:00');
  });

  it('ingênuo, data pura e não-string não têm offset', () => {
    expect(offsetOf('2026-08-21T11:27:51')).toBeNull();
    expect(offsetOf('2026-08-21')).toBeNull();
    expect(offsetOf(null)).toBeNull();
    expect(offsetOf({ seconds: 1 })).toBeNull();
  });

  it('trade: entryTime com offset primeiro, depois exitTime', () => {
    expect(tradeOffsetOf({ entryTime: '2026-08-21T11:00:00', exitTime: '2026-08-21T12:00:00-05:00' })).toBe('-05:00');
    expect(tradeOffsetOf({ entryTime: '2026-08-21T11:00:00-03:00', exitTime: '2026-08-21T12:00:00-05:00' })).toBe('-03:00');
    expect(tradeOffsetOf({})).toBeNull();
    expect(tradeOffsetOf(null)).toBeNull();
  });
});

describe('#464 · instantAtOffsetMs — o núcleo', () => {
  it('ingênuo recebe o offset informado', () => {
    expect(iso(instantAtOffsetMs('2026-09-09T11:22:02', '-03:00'))).toBe('2026-09-09T14:22:02.000Z');
  });

  it('valor com offset próprio ignora o informado — o leitor aceita as duas formas', () => {
    expect(iso(instantAtOffsetMs('2026-09-09T11:22:02-03:00', '-05:00'))).toBe('2026-09-09T14:22:02.000Z');
    expect(iso(instantAtOffsetMs('2026-09-09T14:22:02Z', '-03:00'))).toBe('2026-09-09T14:22:02.000Z');
  });

  it('milissegundos do export (#455) passam', () => {
    expect(iso(instantAtOffsetMs('2026-09-23T10:58:06.975', '-03:00'))).toBe('2026-09-23T13:58:06.975Z');
  });

  it('Timestamp, toMillis e Date', () => {
    expect(instantAtOffsetMs({ seconds: 100 }, '-03:00')).toBe(100000);
    expect(instantAtOffsetMs({ toMillis: () => 5 }, '-03:00')).toBe(5);
    expect(instantAtOffsetMs(new Date('2026-09-09T14:22:02Z'), '-03:00')).toBe(Date.parse('2026-09-09T14:22:02Z'));
  });

  it('sem instante → null (nunca 0, nunca NaN)', () => {
    expect(instantAtOffsetMs(null, '-03:00')).toBeNull();
    expect(instantAtOffsetMs('', '-03:00')).toBeNull();
    expect(instantAtOffsetMs('nao-e-data', '-03:00')).toBeNull();
  });

  it('orderInstantMs = núcleo com o offset do trade', () => {
    const trade = { entryTime: '2026-08-21T11:25:15-04:00' };
    expect(iso(orderInstantMs(trade, '2026-08-21T11:27:51'))).toBe('2026-08-21T15:27:51.000Z');
  });
});

describe('#464 · wallClockMs — junção pelo relógio de parede (#296)', () => {
  it('ingênuo e com offset do mesmo relógio dão o MESMO valor', () => {
    expect(wallClockMs('2026-09-09T11:22:02')).toBe(wallClockMs('2026-09-09T11:22:02-03:00'));
    expect(wallClockMs('2026-09-09T11:22:02-04:00')).toBe(Date.parse('2026-09-09T11:22:02Z'));
  });

  it('fração de segundo é descartada, como no correlator desde o #296', () => {
    expect(wallClockMs('2026-09-23T10:58:06.975')).toBe(Date.parse('2026-09-23T10:58:06Z'));
  });

  it('sem hora cai no núcleo', () => {
    expect(wallClockMs({ seconds: 3 })).toBe(3000);
    expect(wallClockMs(null)).toBeNull();
  });
});

describe('#464 · stripBatchOffset — chave de ordem estável', () => {
  it('tira o offset numérico que o gravador passou a pôr', () => {
    expect(stripBatchOffset('2026-09-09T11:22:02-03:00')).toBe('2026-09-09T11:22:02');
    expect(stripBatchOffset('2026-09-09T11:22:02+0100')).toBe('2026-09-09T11:22:02');
  });

  it('não mexe no que já estava nas chaves gravadas: ingênuo, Z, data pura', () => {
    expect(stripBatchOffset('2026-09-09T11:22:02')).toBe('2026-09-09T11:22:02');
    expect(stripBatchOffset('2026-04-08T10:00:00Z')).toBe('2026-04-08T10:00:00Z');
    expect(stripBatchOffset('2026-09-10')).toBe('2026-09-10');
    expect(stripBatchOffset('2026-09-09T11:22')).toBe('2026-09-09T11:22');
    expect(stripBatchOffset(null)).toBeNull();
  });
});
