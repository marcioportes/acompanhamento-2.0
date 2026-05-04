/**
 * csvEnrichmentPatch.test.js
 * @description Issue #240 — auto-enrich silencioso de MEP/MEN do CSV de
 *   performance em trades existentes (criados por order_import ou manual).
 *   Regra forte: NUNCA sobrescrever campo já preenchido no trade existente.
 */

import { describe, it, expect } from 'vitest';
import { computeExcursionEnrichmentPatch } from '../../utils/csvEnrichmentPatch';

const tradeData = (overrides = {}) => ({
  ticker: 'WINJ26',
  side: 'LONG',
  entry: '120000',
  exit: '120500',
  qty: '2',
  mepPrice: 120800,
  menPrice: 119500,
  excursionSource: 'profitpro',
  ...overrides,
});

const existing = (overrides = {}) => ({
  id: 'trade-001',
  ticker: 'WINJ26',
  side: 'LONG',
  entry: 120000,
  exit: 120500,
  qty: 2,
  source: 'order_import',
  importBatchId: 'batch-A',
  // mepPrice/menPrice/excursionSource ausentes por default
  ...overrides,
});

describe('computeExcursionEnrichmentPatch', () => {
  it('preenche mepPrice + menPrice + excursionSource quando trade existente NÃO tem', () => {
    const result = computeExcursionEnrichmentPatch(tradeData(), existing());
    expect(result).not.toBeNull();
    expect(result.patch).toEqual({
      mepPrice: 120800,
      menPrice: 119500,
      excursionSource: 'profitpro',
    });
    expect(result.fields).toEqual(['mepPrice', 'menPrice', 'excursionSource']);
  });

  it('NÃO sobrescreve mepPrice já presente no trade existente', () => {
    const result = computeExcursionEnrichmentPatch(
      tradeData(),
      existing({ mepPrice: 121000 }),
    );
    expect(result.patch).not.toHaveProperty('mepPrice');
    expect(result.patch.menPrice).toBe(119500);
    expect(result.fields).not.toContain('mepPrice');
  });

  it('NÃO sobrescreve menPrice já presente no trade existente', () => {
    const result = computeExcursionEnrichmentPatch(
      tradeData(),
      existing({ menPrice: 119000 }),
    );
    expect(result.patch.mepPrice).toBe(120800);
    expect(result.patch).not.toHaveProperty('menPrice');
  });

  it('NÃO sobrescreve excursionSource já presente (manual ganha)', () => {
    const result = computeExcursionEnrichmentPatch(
      tradeData({ excursionSource: 'profitpro' }),
      existing({ excursionSource: 'manual' }),
    );
    expect(result.patch.excursionSource).toBeUndefined();
  });

  it('retorna null quando o CSV não traz nenhum campo de excursão', () => {
    const result = computeExcursionEnrichmentPatch(
      tradeData({ mepPrice: null, menPrice: null, excursionSource: null }),
      existing(),
    );
    expect(result).toBeNull();
  });

  it('retorna null quando trade existente já tem todos os campos preenchidos', () => {
    const result = computeExcursionEnrichmentPatch(
      tradeData(),
      existing({
        mepPrice: 121000,
        menPrice: 119000,
        excursionSource: 'manual',
      }),
    );
    expect(result).toBeNull();
  });

  it('preenche só mepPrice quando menPrice e excursionSource já existem', () => {
    const result = computeExcursionEnrichmentPatch(
      tradeData({ menPrice: null }),
      existing({ menPrice: 119000, excursionSource: 'manual' }),
    );
    expect(result.patch).toEqual({ mepPrice: 120800 });
    expect(result.fields).toEqual(['mepPrice']);
  });

  it('marca excursionSource quando faltava e mepPrice/menPrice entraram no patch', () => {
    // CSV não trouxe excursionSource explícito, mas trouxe mepPrice — origem é profitpro.
    const result = computeExcursionEnrichmentPatch(
      tradeData({ excursionSource: null }),
      existing(),
    );
    expect(result.patch.excursionSource).toBe('profitpro');
    expect(result.fields).toContain('excursionSource');
  });

  it('respeita excursionSource explícito do CSV (yahoo) quando trade existente vazio', () => {
    const result = computeExcursionEnrichmentPatch(
      tradeData({ excursionSource: 'yahoo' }),
      existing(),
    );
    expect(result.patch.excursionSource).toBe('yahoo');
  });

  it('retorna null com tradeData null', () => {
    expect(computeExcursionEnrichmentPatch(null, existing())).toBeNull();
  });

  it('retorna null com existingTrade null', () => {
    expect(computeExcursionEnrichmentPatch(tradeData(), null)).toBeNull();
  });

  it('campo string vazio é tratado como ausente no trade existente', () => {
    const result = computeExcursionEnrichmentPatch(
      tradeData(),
      existing({ mepPrice: '', menPrice: '' }),
    );
    expect(result.patch.mepPrice).toBe(120800);
    expect(result.patch.menPrice).toBe(119500);
  });

  it('valor zero é VÁLIDO no trade existente — não é sobrescrito', () => {
    // Defensivo: 0 é valor possível em mepPrice/menPrice (cenário improvável mas válido).
    // null/undefined/'' = ausente; 0 = preenchido.
    const result = computeExcursionEnrichmentPatch(
      tradeData(),
      existing({ mepPrice: 0 }),
    );
    expect(result.patch).not.toHaveProperty('mepPrice');
    expect(result.patch.menPrice).toBe(119500);
  });
});
