/**
 * tradeTimezone.test.js — issue #285
 *
 * Cobre helpers do seletor de fuso do AddTradeModal:
 *  - isUSDST: regras de transição (2º domingo março, 1º domingo novembro).
 *  - getOffset: BRT fixo, ET/CT com DST.
 *  - isCMEFutureTicker / defaultTzForTicker: detecção CME → ET; resto → BRT.
 *  - combineDateTimeWithTz: ISO+offset com DST correto pela DATA do trade.
 *  - toBrasiliaDisplay: equivalente em Brasília a partir de qualquer offset.
 */

import { describe, it, expect } from 'vitest';
import {
  isUSDST,
  getOffset,
  isCMEFutureTicker,
  defaultTzForTicker,
  combineDateTimeWithTz,
  toBrasiliaDisplay,
  TIMEZONES,
} from '../../utils/tradeTimezone';

describe('isUSDST', () => {
  it('verão (maio, julho) → true', () => {
    expect(isUSDST('2026-05-27')).toBe(true);
    expect(isUSDST('2026-07-15')).toBe(true);
  });

  it('inverno (jan, dez) → false', () => {
    expect(isUSDST('2026-01-15')).toBe(false);
    expect(isUSDST('2026-12-25')).toBe(false);
  });

  it('início do DST: 2º domingo de março 2026 = dia 8', () => {
    expect(isUSDST('2026-03-07')).toBe(false); // sábado, ainda EST
    expect(isUSDST('2026-03-08')).toBe(true);  // 2º domingo, vira EDT
    expect(isUSDST('2026-03-09')).toBe(true);
  });

  it('fim do DST: 1º domingo de novembro 2026 = dia 1', () => {
    expect(isUSDST('2026-10-31')).toBe(true);  // último dia EDT
    expect(isUSDST('2026-11-01')).toBe(false); // 1º domingo, vira EST
    expect(isUSDST('2026-11-15')).toBe(false);
  });

  it('entrada inválida → false', () => {
    expect(isUSDST(null)).toBe(false);
    expect(isUSDST('')).toBe(false);
    expect(isUSDST('lixo')).toBe(false);
  });
});

describe('getOffset', () => {
  it('Brasília fixo -03:00 (sem DST)', () => {
    expect(getOffset('2026-07-15', TIMEZONES.BRT.id)).toBe('-03:00');
    expect(getOffset('2026-12-25', TIMEZONES.BRT.id)).toBe('-03:00');
  });

  it('ET: -04:00 no verão (EDT), -05:00 no inverno (EST)', () => {
    expect(getOffset('2026-05-27', TIMEZONES.ET.id)).toBe('-04:00');
    expect(getOffset('2026-12-25', TIMEZONES.ET.id)).toBe('-05:00');
  });

  it('CT: -05:00 no verão (CDT), -06:00 no inverno (CST)', () => {
    expect(getOffset('2026-05-27', TIMEZONES.CT.id)).toBe('-05:00');
    expect(getOffset('2026-12-25', TIMEZONES.CT.id)).toBe('-06:00');
  });

  it('tz desconhecido → fallback BRT', () => {
    expect(getOffset('2026-05-27', 'Europe/London')).toBe('-03:00');
  });

  it('switch DST captura corretamente pelo lado da data', () => {
    // 2026-03-07 sábado: ainda EST
    expect(getOffset('2026-03-07', TIMEZONES.ET.id)).toBe('-05:00');
    // 2026-03-08 domingo: vira EDT
    expect(getOffset('2026-03-08', TIMEZONES.ET.id)).toBe('-04:00');
  });
});

describe('isCMEFutureTicker', () => {
  it('reconhece micros e cheios CME', () => {
    expect(isCMEFutureTicker('NQ')).toBe(true);
    expect(isCMEFutureTicker('MNQH6')).toBe(true);
    expect(isCMEFutureTicker('ES')).toBe(true);
    expect(isCMEFutureTicker('MES')).toBe(true);
    expect(isCMEFutureTicker('GC')).toBe(true);
    expect(isCMEFutureTicker('CL')).toBe(true);
  });

  it('B3 e desconhecidos → false', () => {
    expect(isCMEFutureTicker('WINFUT')).toBe(false);
    expect(isCMEFutureTicker('WDOFUT')).toBe(false);
    expect(isCMEFutureTicker('PETR4')).toBe(false);
    expect(isCMEFutureTicker('')).toBe(false);
    expect(isCMEFutureTicker(null)).toBe(false);
  });
});

describe('defaultTzForTicker', () => {
  it('CME → ET', () => {
    expect(defaultTzForTicker('NQ')).toBe(TIMEZONES.ET.id);
    expect(defaultTzForTicker('mnqh6')).toBe(TIMEZONES.ET.id); // case-insensitive
  });

  it('B3 e resto → BRT', () => {
    expect(defaultTzForTicker('WINFUT')).toBe(TIMEZONES.BRT.id);
    expect(defaultTzForTicker('PETR4')).toBe(TIMEZONES.BRT.id);
    expect(defaultTzForTicker('')).toBe(TIMEZONES.BRT.id);
  });
});

describe('combineDateTimeWithTz', () => {
  it('NQ 16:23 ET em maio → ISO com -04:00 (EDT)', () => {
    expect(combineDateTimeWithTz('2026-05-27', '16:23', TIMEZONES.ET.id))
      .toBe('2026-05-27T16:23:00-04:00');
  });

  it('NQ 16:23 ET em dezembro → ISO com -05:00 (EST)', () => {
    expect(combineDateTimeWithTz('2026-12-15', '16:23', TIMEZONES.ET.id))
      .toBe('2026-12-15T16:23:00-05:00');
  });

  it('Brasília 09:30 → ISO com -03:00 fixo', () => {
    expect(combineDateTimeWithTz('2026-05-27', '09:30', TIMEZONES.BRT.id))
      .toBe('2026-05-27T09:30:00-03:00');
  });

  it('preserva segundos quando fornecidos', () => {
    expect(combineDateTimeWithTz('2026-05-27', '16:23:45', TIMEZONES.BRT.id))
      .toBe('2026-05-27T16:23:45-03:00');
  });

  it('inputs incompletos → null', () => {
    expect(combineDateTimeWithTz('', '16:23', TIMEZONES.ET.id)).toBe(null);
    expect(combineDateTimeWithTz('2026-05-27', '', TIMEZONES.ET.id)).toBe(null);
    expect(combineDateTimeWithTz('2026-05-27', '16:23', '')).toBe(null);
  });
});

describe('toBrasiliaDisplay', () => {
  it('NQ 16:23 ET (EDT, -04) → 17:23 BRT (gap = 1h)', () => {
    expect(toBrasiliaDisplay('2026-05-27T16:23:00-04:00')).toBe('17:23');
  });

  it('NQ 16:23 ET (EST, -05) → 18:23 BRT (gap = 2h)', () => {
    expect(toBrasiliaDisplay('2026-12-15T16:23:00-05:00')).toBe('18:23');
  });

  it('Brasília 16:23 → 16:23 (mesmo fuso)', () => {
    expect(toBrasiliaDisplay('2026-05-27T16:23:00-03:00')).toBe('16:23');
  });

  it('CT 16:23 (CDT, -05) → 18:23 BRT', () => {
    expect(toBrasiliaDisplay('2026-05-27T16:23:00-05:00')).toBe('18:23');
  });

  it('atravessa meia-noite corretamente (ET 22:30 EDT → 23:30 BRT)', () => {
    expect(toBrasiliaDisplay('2026-05-27T22:30:00-04:00')).toBe('23:30');
  });

  it('inválido → string vazia', () => {
    expect(toBrasiliaDisplay(null)).toBe('');
    expect(toBrasiliaDisplay('')).toBe('');
    expect(toBrasiliaDisplay('lixo')).toBe('');
  });
});
