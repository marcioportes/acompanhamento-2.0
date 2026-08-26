/**
 * #402 — margem de manejo. Plano de trade não é contrato de precisão de centavo:
 * slippage, granularidade de tick e ajuste de posição são execução, não
 * indisciplina. 2% para cima ou para baixo não vira barreira.
 */
import { describe, it, expect } from 'vitest';
import {
  MANAGEMENT_TOLERANCE,
  exceedsLimit,
  fallsShortOf,
  withinTolerance,
  authorizedCount,
} from '../../utils/planTolerance';

describe('a margem é 2%', () => {
  it('constante única', () => {
    expect(MANAGEMENT_TOLERANCE).toBe(0.02);
  });
});

describe('exceedsLimit — estourou um MÁXIMO?', () => {
  it('no limite exato não estoura', () => {
    expect(exceedsLimit(252, 252)).toBe(false);
  });

  it('2% acima ainda é manejo', () => {
    expect(exceedsLimit(257, 252)).toBe(false); // 252 × 1,02 = 257,04
  });

  it('além da margem é violação', () => {
    expect(exceedsLimit(258, 252)).toBe(true);
  });

  it('o caso real: R$ 265 contra RO de R$ 252 segue violação (5,2% acima)', () => {
    expect(exceedsLimit(265, 252)).toBe(true);
  });

  it('o dia: R$ 515 contra stop de R$ 501 segue estourado (2,8% acima)', () => {
    expect(exceedsLimit(515, 501)).toBe(true);
  });

  it('R$ 510 contra R$ 501 fica dentro (1,8%)', () => {
    expect(exceedsLimit(510, 501)).toBe(false);
  });

  it('sem limite utilizável não afirma nada', () => {
    expect(exceedsLimit(100, null)).toBe(false);
    expect(exceedsLimit(100, 0)).toBe(false);
    expect(exceedsLimit(null, 100)).toBe(false);
    expect(exceedsLimit('', 100)).toBe(false);
  });

  it('aceita string (vem de formulário)', () => {
    expect(exceedsLimit('258', '252')).toBe(true);
  });
});

describe('fallsShortOf — ficou aquém de um MÍNIMO?', () => {
  it('o caso que obrigou: R$ 251 de folga para um RO de R$ 252', () => {
    // 252 × 0,98 = 246,96 — R$ 251 está acima, logo NÃO impede.
    expect(fallsShortOf(251, 252)).toBe(false);
  });

  it('além da margem impede', () => {
    expect(fallsShortOf(246, 252)).toBe(true);
  });

  it('exatamente no limite não impede', () => {
    expect(fallsShortOf(252, 252)).toBe(false);
  });

  it('orçamento zerado impede', () => {
    expect(fallsShortOf(0, 252)).toBe(true);
  });
});

describe('withinTolerance — está em torno do alvo?', () => {
  it('1,99 operações É 2', () => {
    expect(withinTolerance(1.99, 2)).toBe(true);
  });

  it('2,94 está na borda de 3', () => {
    expect(withinTolerance(2.94, 3)).toBe(true); // |2,94−3|/3 = 2%
  });

  it('2,25 não é 2 nem 3', () => {
    expect(withinTolerance(2.25, 2)).toBe(false);
    expect(withinTolerance(2.25, 3)).toBe(false);
  });

  it('0,50 não é 1', () => {
    expect(withinTolerance(0.5, 1)).toBe(false);
  });

  it('alvo zero não divide por zero', () => {
    expect(withinTolerance(1, 0)).toBe(false);
  });
});

describe('authorizedCount — quantas operações o período comporta', () => {
  it('o Ago-Plano autoriza 2, não 1 — 1,99 é 2', () => {
    // floor(501/252) = 1 era o que fazia a segunda operação nascer sem autorização
    expect(authorizedCount(501, 252)).toBe(2);
  });

  it('múltiplo exato', () => {
    expect(authorizedCount(504, 252)).toBe(2);
    expect(authorizedCount(252, 252)).toBe(1);
  });

  it('fora da margem trunca para baixo', () => {
    expect(authorizedCount(567, 252)).toBe(2); // 2,25 → 2
  });

  it('RO maior que o stop não autoriza nenhuma', () => {
    expect(authorizedCount(501, 600)).toBe(0);
  });

  it('mas 0,99 do RO É uma operação', () => {
    expect(authorizedCount(250, 252)).toBe(1);
  });

  it('entradas inválidas', () => {
    expect(authorizedCount(null, 252)).toBeNull();
    expect(authorizedCount(501, 0)).toBeNull();
  });
});
