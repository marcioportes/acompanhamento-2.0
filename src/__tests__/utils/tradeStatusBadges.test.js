/**
 * tradeStatusBadges.test.js
 * @description Testes das helpers puras de TradeStatusBadges (issue #93 Fase 4).
 *   Cobre as duas funções que decidem quando mostrar cada badge:
 *   - isImported: trade.source === 'order_import'
 *   - needsComplement: falta emoção entrada (com fallback legado) OU setup
 */

import { describe, it, expect } from 'vitest';
import { isImported, needsComplement } from '../../components/TradeStatusBadges';

describe('isImported', () => {
  it('retorna true quando source === "order_import"', () => {
    expect(isImported({ source: 'order_import' })).toBe(true);
  });

  it('retorna false quando source é undefined (trade manual)', () => {
    expect(isImported({ setup: 'PRICE_ACTION' })).toBe(false);
  });

  it('retorna false quando source é null', () => {
    expect(isImported({ source: null })).toBe(false);
  });

  it('retorna false quando source é outro valor (ex: csv_import)', () => {
    expect(isImported({ source: 'csv_import' })).toBe(false);
  });

  it('retorna false para trade null/undefined', () => {
    expect(isImported(null)).toBe(false);
    expect(isImported(undefined)).toBe(false);
  });
});

describe('needsComplement', () => {
  describe('critério emotionEntry / emotion (fallback legado)', () => {
    it('marca pendente quando não tem emotionEntry nem emotion e setup existe', () => {
      expect(needsComplement({ setup: 'BREAKOUT' })).toBe(true);
    });

    it('NÃO marca pendente quando tem emotionEntry novo e setup', () => {
      expect(needsComplement({ emotionEntry: 'CALMO', setup: 'BREAKOUT' })).toBe(false);
    });

    it('NÃO marca pendente quando só tem emotion legado e setup (fallback preserva trades antigos)', () => {
      expect(needsComplement({ emotion: 'CALMO', setup: 'BREAKOUT' })).toBe(false);
    });

    it('marca pendente quando emotion é string vazia (falsy) e setup existe', () => {
      expect(needsComplement({ emotion: '', emotionEntry: '', setup: 'BREAKOUT' })).toBe(true);
    });
  });

  describe('critério setup', () => {
    it('marca pendente quando tem emoção mas não tem setup', () => {
      expect(needsComplement({ emotionEntry: 'CALMO' })).toBe(true);
    });

    it('marca pendente quando tem emoção mas setup é null', () => {
      expect(needsComplement({ emotionEntry: 'CALMO', setup: null })).toBe(true);
    });

    it('marca pendente quando setup é string vazia (falsy)', () => {
      expect(needsComplement({ emotionEntry: 'CALMO', setup: '' })).toBe(true);
    });
  });

  describe('combinações', () => {
    it('marca pendente quando faltam ambos (trade recém-importado)', () => {
      expect(needsComplement({ source: 'order_import' })).toBe(true);
    });

    it('NÃO marca pendente quando ambos preenchidos', () => {
      expect(needsComplement({
        emotionEntry: 'FOCADO',
        setup: 'PULLBACK',
        source: 'order_import',
      })).toBe(false);
    });

    it('trade importado preenchido pelo aluno → só "Importado", sem "Pendente"', () => {
      const trade = {
        source: 'order_import',
        emotionEntry: 'CALMO',
        emotionExit: 'CALMO',
        setup: 'BREAKOUT',
      };
      expect(isImported(trade)).toBe(true);
      expect(needsComplement(trade)).toBe(false);
    });

    it('trade manual recém-criado sem preencher → só "Pendente", sem "Importado"', () => {
      const trade = { ticker: 'WINJ26', side: 'LONG' };
      expect(isImported(trade)).toBe(false);
      expect(needsComplement(trade)).toBe(true);
    });
  });

  describe('emotionExit NÃO entra no critério', () => {
    it('trade sem emotionExit mas com emotionEntry e setup → NÃO pendente', () => {
      expect(needsComplement({
        emotionEntry: 'CALMO',
        setup: 'PULLBACK',
        emotionExit: null,
      })).toBe(false);
    });

    it('trade com apenas emotionExit preenchido → pendente (exit não conta)', () => {
      expect(needsComplement({ emotionExit: 'CALMO' })).toBe(true);
    });
  });

  describe('defensivo', () => {
    it('trade null → false', () => {
      expect(needsComplement(null)).toBe(false);
    });

    it('trade undefined → false', () => {
      expect(needsComplement(undefined)).toBe(false);
    });
  });
});
