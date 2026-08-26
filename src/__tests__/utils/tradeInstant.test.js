/**
 * #402 — SSoT de instante e ordem cronológica do trade.
 *
 * O caso que originou: o importador gravou o trade das 11:34 ANTES do das 10:51,
 * e todo consumidor que ordenava por `createdAt` (analyzePlanCompliance,
 * computeStopBreach) passou a caminhar o dia em ordem de importação. Somado a
 * isso, 222 dos 364 trades da base têm `entryTime` naive (sem offset), então
 * comparar as strings direto mistura representações incompatíveis.
 */
import { describe, it, expect } from 'vitest';
import {
  tradeInstantInfo,
  tradeInstantMs,
  compareTradesChrono,
  sortTradesChrono,
} from '../../utils/tradeInstant';

const ms = (iso) => Date.parse(iso);

describe('tradeInstantInfo — resolução do instante', () => {
  it('ISO com offset explícito passa direto', () => {
    const info = tradeInstantInfo({ entryTime: '2026-08-25T11:34:02-03:00', date: '2026-08-25' });
    expect(info.source).toBe('offset');
    expect(info.ms).toBe(ms('2026-08-25T11:34:02-03:00'));
    expect(info.tz).toBe('America/Sao_Paulo');
  });

  it('ISO com Z é offset, não naive', () => {
    const info = tradeInstantInfo({ entryTime: '2026-08-25T14:34:02Z', date: '2026-08-25' });
    expect(info.source).toBe('offset');
    expect(info.ms).toBe(ms('2026-08-25T14:34:02Z'));
  });

  it('naive + exchange B3 → Brasília', () => {
    const info = tradeInstantInfo({ entryTime: '2026-08-25T10:51:01', date: '2026-08-25', exchange: 'B3' });
    expect(info.source).toBe('inferred');
    expect(info.tz).toBe('America/Sao_Paulo');
    expect(info.ms).toBe(ms('2026-08-25T10:51:01-03:00'));
  });

  it('naive + exchange US → Eastern, com DST da data do trade', () => {
    const verao = tradeInstantInfo({ entryTime: '2026-07-15T09:30:00', date: '2026-07-15', exchange: 'NYSE' });
    expect(verao.tz).toBe('America/New_York');
    expect(verao.ms).toBe(ms('2026-07-15T09:30:00-04:00'));

    const inverno = tradeInstantInfo({ entryTime: '2026-01-15T09:30:00', date: '2026-01-15', exchange: 'NYSE' });
    expect(inverno.ms).toBe(ms('2026-01-15T09:30:00-05:00'));
  });

  it('naive sem exchange usa o ticker (futuro CME → ET)', () => {
    const info = tradeInstantInfo({ entryTime: '2026-07-15T09:30:00', date: '2026-07-15', ticker: 'MNQU26' });
    expect(info.tz).toBe('America/New_York');
  });

  it('naive herda o fuso do exitTime quando ele tem offset', () => {
    const info = tradeInstantInfo({
      entryTime: '2026-07-15T09:30:00',
      exitTime: '2026-07-15T10:00:00-05:00',
      date: '2026-07-15',
      exchange: 'B3', // seria BRT; o exitTime tem prioridade
    });
    expect(info.tz).toBe('America/Chicago');
    expect(info.ms).toBe(ms('2026-07-15T09:30:00-05:00'));
  });

  it('sem entryTime cai para a data ao meio-dia — nunca cruza fronteira de dia', () => {
    const info = tradeInstantInfo({ date: '2026-08-25', exchange: 'B3' });
    expect(info.source).toBe('date');
    expect(info.ms).toBe(ms('2026-08-25T12:00:00-03:00'));
  });

  it('sem entryTime e sem date → none', () => {
    const info = tradeInstantInfo({});
    expect(info.source).toBe('none');
    expect(info.ms).toBeNull();
  });

  it('entryTime malformado não explode — cai para a data', () => {
    const info = tradeInstantInfo({ entryTime: 'nao-e-data', date: '2026-08-25', exchange: 'B3' });
    expect(info.source).toBe('date');
    expect(info.ms).toBe(ms('2026-08-25T12:00:00-03:00'));
  });

  it('tradeInstantMs devolve só o número', () => {
    expect(tradeInstantMs({ entryTime: '2026-08-25T11:34:02-03:00' })).toBe(ms('2026-08-25T11:34:02-03:00'));
    expect(tradeInstantMs({})).toBeNull();
  });

  it('aceita o campo exitTime por parâmetro', () => {
    const t = { entryTime: '2026-08-25T10:51:01-03:00', exitTime: '2026-08-25T11:01:20-03:00' };
    expect(tradeInstantMs(t, 'exitTime')).toBe(ms('2026-08-25T11:01:20-03:00'));
  });
});

describe('compareTradesChrono — o par real do incidente 25/08', () => {
  // Gravados fora de ordem pelo importador: B tem createdAt ANTERIOR a A.
  const A = {
    id: 'cUG60nG3TOcrC7d2Euwb',
    date: '2026-08-25',
    entryTime: '2026-08-25T10:51:01', // naive
    exchange: 'B3',
    result: -250,
    createdAt: { seconds: 1787678452 },
  };
  const B = {
    id: 'TIvs3Vh4sEKUc1HYEd7p',
    date: '2026-08-25',
    entryTime: '2026-08-25T11:34:02-03:00', // com offset
    exchange: 'B3',
    result: -265,
    createdAt: { seconds: 1787678449 }, // 3s ANTES de A
  };

  it('A (10:51) vem antes de B (11:34), apesar do createdAt invertido', () => {
    expect(compareTradesChrono(A, B)).toBeLessThan(0);
    expect(compareTradesChrono(B, A)).toBeGreaterThan(0);
  });

  it('offset misturado com naive resolve pelo instante, não pela string', () => {
    // localeCompare colocaria o naive depois do com-offset em alguns pares;
    // o instante é o que decide.
    expect(sortTradesChrono([B, A]).map((t) => t.id)).toEqual([A.id, B.id]);
    expect(sortTradesChrono([A, B]).map((t) => t.id)).toEqual([A.id, B.id]);
  });

  it('data manda sobre hora', () => {
    const ontem = { ...A, date: '2026-08-24' };
    expect(compareTradesChrono(ontem, B)).toBeLessThan(0);
  });

  it('empate no instante desempata por createdAt', () => {
    const x = { id: 'x', date: '2026-08-25', entryTime: '2026-08-25T10:00:00-03:00', createdAt: { seconds: 200 } };
    const y = { id: 'y', date: '2026-08-25', entryTime: '2026-08-25T10:00:00-03:00', createdAt: { seconds: 100 } };
    expect(compareTradesChrono(x, y)).toBeGreaterThan(0);
  });

  it('empate total desempata por id — ordem determinística', () => {
    const x = { id: 'aaa', date: '2026-08-25', entryTime: '2026-08-25T10:00:00-03:00' };
    const y = { id: 'bbb', date: '2026-08-25', entryTime: '2026-08-25T10:00:00-03:00' };
    expect(compareTradesChrono(x, y)).toBeLessThan(0);
    expect(compareTradesChrono(y, x)).toBeGreaterThan(0);
    expect(compareTradesChrono(x, x)).toBe(0);
  });

  it('trade sem instante vai para o fim, não para o começo', () => {
    const semNada = { id: 'z' };
    expect(compareTradesChrono(A, semNada)).toBeLessThan(0);
    expect(compareTradesChrono(semNada, A)).toBeGreaterThan(0);
  });
});

describe('sortTradesChrono', () => {
  it('não muta o array de entrada', () => {
    const entrada = [
      { id: 'b', date: '2026-08-25', entryTime: '2026-08-25T11:00:00-03:00' },
      { id: 'a', date: '2026-08-25', entryTime: '2026-08-25T10:00:00-03:00' },
    ];
    const copia = [...entrada];
    sortTradesChrono(entrada);
    expect(entrada.map((t) => t.id)).toEqual(copia.map((t) => t.id));
  });

  it('é invariante à ordem de entrada — qualquer permutação dá o mesmo resultado', () => {
    const t = (id, hora) => ({ id, date: '2026-08-25', entryTime: `2026-08-25T${hora}-03:00` });
    const trades = [t('a', '09:00:00'), t('b', '10:00:00'), t('c', '11:00:00')];
    const esperado = ['a', 'b', 'c'];
    const permutacoes = [
      [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
    ];
    for (const p of permutacoes) {
      expect(sortTradesChrono(p.map((i) => trades[i])).map((x) => x.id)).toEqual(esperado);
    }
  });

  it('lida com entrada vazia ou inválida', () => {
    expect(sortTradesChrono([])).toEqual([]);
    expect(sortTradesChrono(null)).toEqual([]);
    expect(sortTradesChrono(undefined)).toEqual([]);
  });
});
