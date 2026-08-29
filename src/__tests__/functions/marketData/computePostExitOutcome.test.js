/**
 * #101 (29/08/2026) — o apontador pós-saída.
 *
 * Marcio: "o sistema só assume que quando o aluno sai antecipado ele está perdendo
 * o alvo, mas ele também pode estar protegendo o loss... é preciso ter um apontador
 * para registrar se o trade daria stop ou gain depois da saída antecipada, como o
 * sistema faz quando registra o MEN/MEP".
 */
import { describe, it, expect } from 'vitest';
import { computePostExitOutcome, precoAlvoDoPlano } from '../../../../functions/marketData/computePostExitOutcome';

const barra = (t, h, l) => ({ t, h, l });

describe('precoAlvoDoPlano', () => {
  it('deriva o alvo do risco do trade e do rrTarget do plano', () => {
    // Entrada 100, stop 90 → risco 10. Alvo 2R = 120.
    expect(precoAlvoDoPlano({ entry: 100, stopLoss: 90, side: 'LONG' }, { rrTarget: 2 })).toBe(120);
  });

  it('no vendido o alvo desce', () => {
    expect(precoAlvoDoPlano({ entry: 100, stopLoss: 110, side: 'SHORT' }, { rrTarget: 2 })).toBe(80);
  });

  it('sem stop declarado não há risco, e sem risco não há alvo', () => {
    expect(precoAlvoDoPlano({ entry: 100, side: 'LONG' }, { rrTarget: 2 })).toBeNull();
  });

  it('stop na entrada não vira alvo infinito', () => {
    expect(precoAlvoDoPlano({ entry: 100, stopLoss: 100, side: 'LONG' }, { rrTarget: 2 })).toBeNull();
  });

  it('plano sem alvo declarado não inventa um', () => {
    expect(precoAlvoDoPlano({ entry: 100, stopLoss: 90, side: 'LONG' }, {})).toBeNull();
  });
});

describe('computePostExitOutcome', () => {
  const comprado = { side: 'LONG', stopPrice: 90, targetPrice: 120 };

  it('SAÍDA PROTETORA: o preço voltou e bateu o stop', () => {
    const r = computePostExitOutcome({ ...comprado, bars: [barra(1, 105, 99), barra(2, 101, 89)] });
    expect(r.outcome).toBe('STOP');
    expect(r.touchedAtMs).toBe(2000);
  });

  it('CORTE DE LUCRO: o preço seguiu e bateu o alvo', () => {
    const r = computePostExitOutcome({ ...comprado, bars: [barra(1, 110, 105), barra(2, 121, 115)] });
    expect(r.outcome).toBe('ALVO');
  });

  it('vale o que veio PRIMEIRO, não o que veio depois', () => {
    // Bateu o stop no minuto 1 e o alvo no minuto 3: a saída protegeu.
    const r = computePostExitOutcome({ ...comprado, bars: [barra(1, 95, 89), barra(2, 110, 100), barra(3, 125, 118)] });
    expect(r.outcome).toBe('STOP');
  });

  it('barra que tocou os dois é AMBOS — a ordem dentro do minuto é desconhecida', () => {
    // Inventar sequência dentro da barra seria a "falsa análise" que o #402 tirou daqui.
    const r = computePostExitOutcome({ ...comprado, bars: [barra(1, 125, 85)] });
    expect(r.outcome).toBe('AMBOS');
  });

  it('nem alvo nem stop até o fim do pregão', () => {
    const r = computePostExitOutcome({ ...comprado, bars: [barra(1, 110, 95), barra(2, 112, 99)] });
    expect(r.outcome).toBe('NENHUM');
    expect(r.touchedAtMs).toBeNull();
  });

  it('no vendido os lados se invertem', () => {
    const vendido = { side: 'SHORT', stopPrice: 110, targetPrice: 80 };
    expect(computePostExitOutcome({ ...vendido, bars: [barra(1, 111, 105)] }).outcome).toBe('STOP');
    expect(computePostExitOutcome({ ...vendido, bars: [barra(1, 95, 79)] }).outcome).toBe('ALVO');
  });

  it('sem barras não afirma nada', () => {
    expect(computePostExitOutcome({ ...comprado, bars: [] }).outcome).toBe('NENHUM');
    expect(computePostExitOutcome({ ...comprado, bars: null }).outcome).toBe('NENHUM');
  });

  it('barra corrompida é ignorada, não derruba a leitura', () => {
    const r = computePostExitOutcome({ ...comprado, bars: [{ t: 1, h: null, l: null }, barra(2, 121, 115)] });
    expect(r.outcome).toBe('ALVO');
  });
});
