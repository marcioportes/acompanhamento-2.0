/**
 * csvMapperExcursion.test.js — issue #187 Fase 3
 * @description Integração de MEP/MEN no csvMapper.buildTradeFromRow.
 * Verifica que o mapping CSV → trade aplica conversão pts/% → preço corretamente,
 * marca excursionSource e omite os campos `mepRaw`/`menRaw` do output final.
 */

import { describe, it, expect } from 'vitest';
import { buildTradeFromRow } from '../../utils/csvMapper';

const baseMapping = {
  ticker: 'Ativo',
  side: 'Lado',
  buyPrice: 'Preço Compra',
  sellPrice: 'Preço Venda',
  qty: 'Qtd Compra',
  entryTime: 'Abertura',
  exitTime: 'Fechamento',
  mepRaw: 'MEP',
  menRaw: 'MEN',
};

const baseValueMap = {
  side: { 'C': 'LONG', 'V': 'SHORT' },
};

describe('csvMapper — MEP/MEN integration (issue #187 Fase 3)', () => {
  it('amostra real WINM26 trade 1 (CSV ProfitPro fornecido por Marcio)', () => {
    const row = {
      'Ativo': 'WINM26',
      'Lado': 'C',
      'Preço Compra': '194235,00',
      'Preço Venda': '194105,00',
      'Qtd Compra': '2',
      'Abertura': '24/04/2026 10:42:50',
      'Fechamento': '24/04/2026 10:43:36',
      'MEP': '10,00',
      'MEN': '-180,00',
    };

    const { trade, errors } = buildTradeFromRow(row, baseMapping, baseValueMap);

    expect(errors).toEqual([]);
    expect(trade.ticker).toBe('WINM26');
    expect(trade.side).toBe('LONG');
    expect(trade.entry).toBe(194235);
    expect(trade.exit).toBe(194105);
    expect(trade.mepPrice).toBe(194245);
    expect(trade.menPrice).toBe(194055);
    expect(trade.excursionSource).toBe('profitpro');
    expect(trade.mepRaw).toBeUndefined();
    expect(trade.menRaw).toBeUndefined();
  });

  it('SHORT em ação (equity, %)', () => {
    const row = {
      'Ativo': 'PETR4',
      'Lado': 'V',
      'Preço Compra': '30,00',
      'Preço Venda': '32,00',
      'Qtd Compra': '100',
      'Abertura': '15/03/2026 10:00:00',
      'Fechamento': '15/03/2026 14:30:00',
      'MEP': '5',
      'MEN': '-2',
    };

    const { trade, errors } = buildTradeFromRow(row, baseMapping, baseValueMap);

    expect(errors).toEqual([]);
    expect(trade.side).toBe('SHORT');
    // SHORT entry = sellPrice (32), exit = buyPrice (30)
    expect(trade.entry).toBe(32);
    expect(trade.exit).toBe(30);
    // SHORT equity: mepPrice = entry × (1 - 5/100) = 30.4
    expect(trade.mepPrice).toBe(30.4);
    // menPrice = entry × (1 + 2/100) = 32.64
    expect(trade.menPrice).toBe(32.64);
  });

  it('omite campos quando MEP/MEN ausentes na linha', () => {
    const row = {
      'Ativo': 'WINM26',
      'Lado': 'C',
      'Preço Compra': '194000,00',
      'Preço Venda': '194100,00',
      'Qtd Compra': '1',
      'Abertura': '15/03/2026 10:00:00',
      'Fechamento': '15/03/2026 10:05:00',
      // MEP/MEN não preenchidos
    };

    const { trade } = buildTradeFromRow(row, baseMapping, baseValueMap);
    expect(trade.mepPrice).toBeUndefined();
    expect(trade.menPrice).toBeUndefined();
    expect(trade.excursionSource).toBeUndefined();
  });

  it('processa só MEP quando MEN ausente', () => {
    const row = {
      'Ativo': 'WINM26',
      'Lado': 'C',
      'Preço Compra': '194000,00',
      'Preço Venda': '194100,00',
      'Qtd Compra': '1',
      'Abertura': '15/03/2026 10:00:00',
      'Fechamento': '15/03/2026 10:05:00',
      'MEP': '50,00',
      // MEN vazio
    };

    const { trade } = buildTradeFromRow(row, baseMapping, baseValueMap);
    expect(trade.mepPrice).toBe(194050);
    expect(trade.menPrice).toBeUndefined();
    expect(trade.excursionSource).toBe('profitpro');
  });

  it('respeita defaults.excursionSource (ex: import via outro broker)', () => {
    const row = {
      'Ativo': 'MNQH6',
      'Lado': 'C',
      'Preço Compra': '20000',
      'Preço Venda': '20010',
      'Qtd Compra': '1',
      'Abertura': '15/03/2026 10:00:00',
      'Fechamento': '15/03/2026 10:05:00',
      'MEP': '15',
      'MEN': '-5',
    };

    const { trade } = buildTradeFromRow(row, baseMapping, baseValueMap, { excursionSource: 'manual' });
    expect(trade.excursionSource).toBe('manual');
    expect(trade.mepPrice).toBe(20015);
    expect(trade.menPrice).toBe(19995);
  });

  it('preserva mappings existentes sem MEP/MEN (regressão)', () => {
    const row = {
      'Ativo': 'WINM26',
      'Lado': 'C',
      'Preço Compra': '194000',
      'Preço Venda': '194100',
      'Qtd Compra': '1',
      'Abertura': '15/03/2026 10:00:00',
      'Fechamento': '15/03/2026 10:05:00',
    };
    const mappingNoExcursion = {
      ticker: 'Ativo',
      side: 'Lado',
      buyPrice: 'Preço Compra',
      sellPrice: 'Preço Venda',
      qty: 'Qtd Compra',
      entryTime: 'Abertura',
      exitTime: 'Fechamento',
    };

    const { trade, errors } = buildTradeFromRow(row, mappingNoExcursion, baseValueMap);
    expect(errors).toEqual([]);
    expect(trade.ticker).toBe('WINM26');
    expect(trade.side).toBe('LONG');
    expect(trade).not.toHaveProperty('mepPrice');
    expect(trade).not.toHaveProperty('menPrice');
    expect(trade).not.toHaveProperty('mepRaw');
    expect(trade).not.toHaveProperty('menRaw');
  });
});
