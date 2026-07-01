import { describe, it, expect } from 'vitest';
import { fmtTradePrefix } from '../../utils/reviewNotePrefix';

describe('fmtTradePrefix (#318)', () => {
  it('monta prefixo com data curta, símbolo e resultado positivo', () => {
    const p = fmtTradePrefix({ date: '2026-06-15', symbol: 'WINFUT', result: 320.5 });
    expect(p).toBe('[15/06 WINFUT +320.50] ');
  });

  it('resultado negativo mantém o sinal', () => {
    const p = fmtTradePrefix({ date: '2026-06-15', ticker: 'PETR4', result: -80 });
    expect(p).toBe('[15/06 PETR4 -80.00] ');
  });

  it('inclui hora quando entryTime tem timestamp', () => {
    const p = fmtTradePrefix({ entryTime: '2026-06-15T09:31:00', symbol: 'ES', result: 12 });
    expect(p).toBe('[15/06 09:31 ES +12.00] ');
  });

  it('deriva data de entryTime quando date ausente', () => {
    const p = fmtTradePrefix({ entryTime: '2026-06-15T09:31:00', ticker: 'NQ', result: 4 });
    expect(p).toBe('[15/06 09:31 NQ +4.00] ');
  });

  it('sem símbolo não deixa espaço duplo', () => {
    const p = fmtTradePrefix({ date: '2026-06-15', result: 5 });
    expect(p).toBe('[15/06 +5.00] ');
  });

  it('trade nulo → string vazia', () => {
    expect(fmtTradePrefix(null)).toBe('');
  });

  it('result não-numérico vira 0 (sem sinal +, pois não é > 0)', () => {
    const p = fmtTradePrefix({ date: '2026-06-15', symbol: 'X', result: undefined });
    expect(p).toBe('[15/06 X 0.00] ');
  });
});
