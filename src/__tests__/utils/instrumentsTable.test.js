import { describe, it, expect } from 'vitest';
import {
  INSTRUMENTS_TABLE,
  SESSION_PROFILES,
  DAILY_PROFILES,
  STOP_PERCENT_OF_ATR,
  getInstrument,
  getSessionRange,
  isInstrumentAllowed,
  getRestrictedInstrumentsForFirm,
  getAllowedInstrumentsForFirm,
  suggestMicroAlternative,
  getRecommendedStop
} from '../../constants/instrumentsTable';

// ============================================
// INSTRUMENTS_TABLE — sanidade dos dados
// ============================================
describe('INSTRUMENTS_TABLE — sanidade', () => {
  it('contém pelo menos os instrumentos top esperados', () => {
    const symbols = INSTRUMENTS_TABLE.map(i => i.symbol);
    expect(symbols).toContain('ES');
    expect(symbols).toContain('NQ');
    expect(symbols).toContain('YM');
    expect(symbols).toContain('RTY');
    expect(symbols).toContain('CL');
    expect(symbols).toContain('GC');
  });

  it('todo instrumento tem campos obrigatórios', () => {
    for (const inst of INSTRUMENTS_TABLE) {
      expect(inst).toHaveProperty('symbol');
      expect(inst).toHaveProperty('name');
      expect(inst).toHaveProperty('exchange');
      expect(inst).toHaveProperty('type');
      expect(inst).toHaveProperty('pointValue');
      expect(inst).toHaveProperty('avgDailyRange');
      expect(inst).toHaveProperty('minStopPoints');
      expect(inst).toHaveProperty('availability');
      expect(typeof inst.pointValue).toBe('number');
      expect(typeof inst.avgDailyRange).toBe('number');
      expect(typeof inst.minStopPoints).toBe('number');
      expect(inst.minStopPoints).toBeGreaterThan(0);
    }
  });

  it('availability tem todas as 4 mesas', () => {
    for (const inst of INSTRUMENTS_TABLE) {
      expect(inst.availability).toHaveProperty('apex');
      expect(inst.availability).toHaveProperty('mff');
      expect(inst.availability).toHaveProperty('lucid');
      expect(inst.availability).toHaveProperty('tradeify');
    }
  });

  it('Apex restringe metals (GC, SI, HG)', () => {
    const gc = INSTRUMENTS_TABLE.find(i => i.symbol === 'GC');
    const si = INSTRUMENTS_TABLE.find(i => i.symbol === 'SI');
    const hg = INSTRUMENTS_TABLE.find(i => i.symbol === 'HG');
    expect(gc.availability.apex).toBe(false);
    expect(si.availability.apex).toBe(false);
    expect(hg.availability.apex).toBe(false);
  });

  it('Equity index micros estão definidos no full', () => {
    expect(INSTRUMENTS_TABLE.find(i => i.symbol === 'ES').micro).toBe('MES');
    expect(INSTRUMENTS_TABLE.find(i => i.symbol === 'NQ').micro).toBe('MNQ');
    expect(INSTRUMENTS_TABLE.find(i => i.symbol === 'YM').micro).toBe('MYM');
    expect(INSTRUMENTS_TABLE.find(i => i.symbol === 'RTY').micro).toBe('M2K');
  });
});

// ============================================
// SESSION_PROFILES
// ============================================
describe('SESSION_PROFILES', () => {
  it('soma das % das sessões = 100%', () => {
    const total = SESSION_PROFILES.asia.rangePct + SESSION_PROFILES.london.rangePct + SESSION_PROFILES.ny.rangePct;
    expect(total).toBeCloseTo(1.0, 2);
  });

  it('NY tem maior range (60%)', () => {
    expect(SESSION_PROFILES.ny.rangePct).toBe(0.60);
    expect(SESSION_PROFILES.ny.rangePct).toBeGreaterThan(SESSION_PROFILES.london.rangePct);
    expect(SESSION_PROFILES.ny.rangePct).toBeGreaterThan(SESSION_PROFILES.asia.rangePct);
  });

  it('NY tem maior direcionalidade', () => {
    expect(SESSION_PROFILES.ny.directionalPct).toBeGreaterThan(SESSION_PROFILES.asia.directionalPct);
  });
});

// ============================================
// DAILY_PROFILES
// ============================================
describe('DAILY_PROFILES', () => {
  it('contém os 4 profiles esperados', () => {
    expect(DAILY_PROFILES.ASIA_REVERSAL).toBeDefined();
    expect(DAILY_PROFILES.LONDON_REVERSAL).toBeDefined();
    expect(DAILY_PROFILES.NY_REVERSAL).toBeDefined();
    expect(DAILY_PROFILES.INVALIDATION).toBeDefined();
  });

  it('INVALIDATION é o único que nem conservador nem agressivo opera', () => {
    expect(DAILY_PROFILES.INVALIDATION.conservative).toBe(false);
    expect(DAILY_PROFILES.INVALIDATION.aggressive).toBe(false);
  });

  it('NY_REVERSAL é apenas para agressivo', () => {
    expect(DAILY_PROFILES.NY_REVERSAL.conservative).toBe(false);
    expect(DAILY_PROFILES.NY_REVERSAL.aggressive).toBe(true);
  });
});

// ============================================
// getInstrument
// ============================================
describe('getInstrument', () => {
  it('busca direta por full size symbol', () => {
    const nq = getInstrument('NQ');
    expect(nq).not.toBeNull();
    expect(nq.symbol).toBe('NQ');
    expect(nq.pointValue).toBe(20.00);
    expect(nq.isMicro).toBe(false);
    expect(nq.parentSymbol).toBeNull();
  });

  it('busca como micro (MNQ → encontra NQ pai)', () => {
    const mnq = getInstrument('MNQ');
    expect(mnq).not.toBeNull();
    expect(mnq.symbol).toBe('MNQ');
    expect(mnq.pointValue).toBe(2.00);
    expect(mnq.isMicro).toBe(true);
    expect(mnq.parentSymbol).toBe('NQ');
    expect(mnq.name).toContain('Micro');
  });

  it('case insensitive', () => {
    expect(getInstrument('nq')?.symbol).toBe('NQ');
    expect(getInstrument('mnq')?.symbol).toBe('MNQ');
  });

  it('retorna null para símbolo não mapeado', () => {
    expect(getInstrument('XYZ')).toBeNull();
    expect(getInstrument('')).toBeNull();
    expect(getInstrument(null)).toBeNull();
  });

  it('micro herda ATR e minStopPoints do pai', () => {
    const nq = getInstrument('NQ');
    const mnq = getInstrument('MNQ');
    expect(mnq.avgDailyRange).toBe(nq.avgDailyRange);
    expect(mnq.minStopPoints).toBe(nq.minStopPoints);
  });

  it('full e micro têm pointValue diferentes', () => {
    const nq = getInstrument('NQ');
    const mnq = getInstrument('MNQ');
    expect(nq.pointValue).toBe(20.00);
    expect(mnq.pointValue).toBe(2.00);
    expect(nq.pointValue).toBe(mnq.pointValue * 10);
  });
});

// ============================================
// getSessionRange
// ============================================
describe('getSessionRange', () => {
  it('NQ NY = ATR(400) × 0.60 = 240 pts', () => {
    const range = getSessionRange('NQ', 'ny');
    expect(range.rangePoints).toBe(240);
    expect(range.rangeUSD).toBe(240 * 20); // $4800
    expect(range.sessionName).toBe('New York');
  });

  it('ES London = ATR(55) × 0.23 ≈ 12.65 pts', () => {
    const range = getSessionRange('ES', 'london');
    expect(range.rangePoints).toBeCloseTo(12.65, 2);
    expect(range.rangeUSD).toBeCloseTo(632.5, 1);
  });

  it('MNQ herda mesmo ATR de NQ', () => {
    const nqNY = getSessionRange('NQ', 'ny');
    const mnqNY = getSessionRange('MNQ', 'ny');
    expect(mnqNY.rangePoints).toBe(nqNY.rangePoints);
    // Mas USD diferente
    expect(mnqNY.rangeUSD).toBe(nqNY.rangePoints * 2); // pointValue 2 vs 20
  });

  it('retorna null para sessão inválida', () => {
    expect(getSessionRange('NQ', 'invalid')).toBeNull();
  });

  it('retorna null para instrumento inválido', () => {
    expect(getSessionRange('XYZ', 'ny')).toBeNull();
  });

  it('inclui directionalPct e hours', () => {
    const range = getSessionRange('NQ', 'ny');
    expect(range.directionalPct).toBe(0.86);
    expect(range.hours).toContain('EST');
  });
});

// ============================================
// isInstrumentAllowed
// ============================================
describe('isInstrumentAllowed', () => {
  it('NQ é permitido em todas as mesas', () => {
    expect(isInstrumentAllowed('NQ', 'apex')).toBe(true);
    expect(isInstrumentAllowed('NQ', 'mff')).toBe(true);
    expect(isInstrumentAllowed('NQ', 'lucid')).toBe(true);
    expect(isInstrumentAllowed('NQ', 'tradeify')).toBe(true);
  });

  it('GC NÃO é permitido na Apex (suspenso)', () => {
    expect(isInstrumentAllowed('GC', 'apex')).toBe(false);
    expect(isInstrumentAllowed('GC', 'mff')).toBe(true);
  });

  it('MGC NÃO é permitido na Apex (mesma restrição do parent GC)', () => {
    expect(isInstrumentAllowed('MGC', 'apex')).toBe(false);
  });

  it('Case insensitive em firm', () => {
    expect(isInstrumentAllowed('NQ', 'APEX')).toBe(true);
    expect(isInstrumentAllowed('NQ', 'Apex')).toBe(true);
  });

  it('retorna false para instrumento não mapeado', () => {
    expect(isInstrumentAllowed('XYZ', 'apex')).toBe(false);
  });
});

// ============================================
// getRestrictedInstrumentsForFirm
// ============================================
describe('getRestrictedInstrumentsForFirm', () => {
  it('Apex restringe GC, SI, HG e seus micros', () => {
    const apexRestricted = getRestrictedInstrumentsForFirm('apex');
    expect(apexRestricted).toContain('GC');
    expect(apexRestricted).toContain('MGC');
    expect(apexRestricted).toContain('SI');
    expect(apexRestricted).toContain('HG');
  });

  it('MFF tem poucas restrições (HG)', () => {
    const mffRestricted = getRestrictedInstrumentsForFirm('mff');
    expect(mffRestricted).toContain('HG');
    expect(mffRestricted).not.toContain('GC');
    expect(mffRestricted).not.toContain('NQ');
  });

  it('case insensitive', () => {
    expect(getRestrictedInstrumentsForFirm('APEX')).toEqual(getRestrictedInstrumentsForFirm('apex'));
  });

  it('retorna array vazio para mesa inexistente', () => {
    // mesas inexistentes não têm availability definida → instrumentos têm undefined
    // → undefined !== false → não restringidos
    expect(getRestrictedInstrumentsForFirm('xyz')).toEqual([]);
  });
});

// ============================================
// getAllowedInstrumentsForFirm
// ============================================
describe('getAllowedInstrumentsForFirm', () => {
  it('Apex tem instrumentos permitidos incluindo full e micros', () => {
    const allowed = getAllowedInstrumentsForFirm('apex');
    const symbols = allowed.map(i => i.symbol);
    expect(symbols).toContain('NQ');
    expect(symbols).toContain('MNQ');
    expect(symbols).toContain('ES');
    expect(symbols).toContain('MES');
  });

  it('Apex NÃO inclui GC nem MGC (suspensos)', () => {
    const symbols = getAllowedInstrumentsForFirm('apex').map(i => i.symbol);
    expect(symbols).not.toContain('GC');
    expect(symbols).not.toContain('MGC');
  });

  it('cada item tem isMicro flag e pointValue correto', () => {
    const allowed = getAllowedInstrumentsForFirm('apex');
    const nq = allowed.find(i => i.symbol === 'NQ');
    const mnq = allowed.find(i => i.symbol === 'MNQ');
    expect(nq.isMicro).toBe(false);
    expect(nq.pointValue).toBe(20);
    expect(mnq.isMicro).toBe(true);
    expect(mnq.pointValue).toBe(2);
    expect(mnq.parentSymbol).toBe('NQ');
  });
});

// ============================================
// suggestMicroAlternative
// ============================================
describe('suggestMicroAlternative', () => {
  it('NQ → MNQ', () => {
    const micro = suggestMicroAlternative('NQ');
    expect(micro).not.toBeNull();
    expect(micro.symbol).toBe('MNQ');
    expect(micro.isMicro).toBe(true);
  });

  it('ES → MES', () => {
    expect(suggestMicroAlternative('ES').symbol).toBe('MES');
  });

  it('retorna null se já é micro', () => {
    expect(suggestMicroAlternative('MNQ')).toBeNull();
  });

  it('retorna null se não tem micro variant', () => {
    expect(suggestMicroAlternative('NG')).toBeNull(); // NG não tem micro
    expect(suggestMicroAlternative('SI')).toBeNull(); // SI não tem micro
  });

  it('retorna null para símbolo inválido', () => {
    expect(suggestMicroAlternative('XYZ')).toBeNull();
  });
});

// ============================================
// getRecommendedStop
// ============================================
describe('getRecommendedStop', () => {
  it('NQ: ATR 400 × 5% = 20pts (igual ao minStop)', () => {
    const nq = getInstrument('NQ');
    const stop = getRecommendedStop(nq);
    expect(stop.stopPoints).toBe(20);
    expect(stop.stopUSD).toBe(400); // 20 × $20
  });

  it('MNQ: mesmo stopPoints, mas USD diferente', () => {
    const mnq = getInstrument('MNQ');
    const stop = getRecommendedStop(mnq);
    expect(stop.stopPoints).toBe(20);
    expect(stop.stopUSD).toBe(40); // 20 × $2
  });

  it('ES: ATR 55 × 5% = 2.75 → minStop 4 prevalece', () => {
    const es = getInstrument('ES');
    const stop = getRecommendedStop(es);
    expect(stop.stopPoints).toBe(4);
    expect(stop.stopUSD).toBe(200); // 4 × $50
    expect(stop.source).toBe('min'); // minStop prevaleceu
  });

  it('YM: ATR 420 × 5% = 21 → maior que minStop 25? Não, 21 < 25, então minStop 25', () => {
    const ym = getInstrument('YM');
    const stop = getRecommendedStop(ym);
    expect(stop.stopPoints).toBe(25); // minStop prevalece
    expect(stop.stopUSD).toBe(125); // 25 × $5
    expect(stop.source).toBe('min');
  });

  it('source = "atr" quando ATR × 5% > minStop', () => {
    // NQ: ATR 400, ATR×5% = 20, minStop = 20 → empate, atr ganha (>=)
    const nq = getInstrument('NQ');
    expect(getRecommendedStop(nq).source).toBe('atr');
  });

  it('retorna null para instrument null', () => {
    expect(getRecommendedStop(null)).toBeNull();
  });
});
