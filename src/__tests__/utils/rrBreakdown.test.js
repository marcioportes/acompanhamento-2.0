/**
 * rrBreakdown.test.js — issue #373
 *
 * O painel dizia "RR 1.2x abaixo do mínimo (2x)" — múltiplo abstrato, sem dizer de
 * quanto dinheiro se tratava nem contra o quê estava sendo medido.
 *
 * Decisão de Marcio (21/08/2026): mostrar os dois RRs em dinheiro, mantendo a violação
 * no risco TOMADO — que é o que aconteceu com o dinheiro dele. O RR contra o RO do
 * plano entra como referência: o que o trade teria sido dentro do sizing correto.
 *
 * Caso real (WINV26 LONG 10, 20/08/2026, +R$ 610):
 *   arriscou R$ 495 para ganhar R$ 610  → 1,23x   (viola: mínimo 2x)
 *   RO do plano é R$ 252                → 2,42x   (dentro)
 * As duas violações da tela têm a mesma causa: posição dobrada sem encurtar o stop.
 */

import { describe, it, expect } from 'vitest';
import { rrBreakdown } from '../../utils/rrBreakdown';

const trade = {
  entry: 171842.5,
  stopLoss: 171595,
  qty: 10,
  result: 610,
  currency: 'BRL',
  tickerRule: { tickSize: 5, tickValue: 1 },   // R$ 0,20 por ponto
};

const plan = { pl: 30000, riskPerOperation: 0.84, rrTarget: 2 };

describe('rrBreakdown — o caso real de 20/08', () => {
  const r = rrBreakdown(trade, plan);

  it('mede o risco que o aluno realmente tomou', () => {
    expect(r.riskAmount).toBe(495);
    expect(r.riskPercent).toBeCloseTo(1.65, 2);
  });

  it('mede o RO que o plano autoriza', () => {
    expect(r.roAmount).toBe(252);
  });

  it('RR do risco tomado é o que governa a conformidade', () => {
    expect(r.rrTaken).toBeCloseTo(1.23, 2);
    expect(r.meetsTarget).toBe(false);
  });

  it('RR contra o plano entra como referência, e conta outra história', () => {
    expect(r.rrVsPlan).toBeCloseTo(2.42, 2);
    expect(r.meetsTargetVsPlan).toBe(true);
  });

  it('carrega resultado e moeda para a exibição', () => {
    expect(r.resultAmount).toBe(610);
    expect(r.currency).toBe('BRL');
  });
});

describe('rrBreakdown — bordas', () => {
  it('sem stop informado não inventa risco tomado', () => {
    const r = rrBreakdown({ ...trade, stopLoss: null }, plan);

    expect(r.riskAmount).toBeNull();
    expect(r.rrTaken).toBeNull();
    // O RO do plano continua conhecido: é dado do plano, não do trade.
    expect(r.roAmount).toBe(252);
    expect(r.rrVsPlan).toBeCloseTo(2.42, 2);
  });

  it('sem plano devolve só o lado do trade', () => {
    const r = rrBreakdown(trade, null);

    expect(r.riskAmount).toBe(495);
    expect(r.roAmount).toBeNull();
    expect(r.rrVsPlan).toBeNull();
  });

  it('trade perdedor mostra o múltiplo, mas sem veredicto contra o alvo (#402)', () => {
    // Até o #402 isto travava `meetsTarget: false` — o painel reprovava uma perda
    // com stop respeitado contra um alvo que o aluno nunca declarou, enquanto o
    // motor (compliance.js) classificava o mesmo trade como CONFORME.
    const r = rrBreakdown({ ...trade, result: -495 }, plan);

    expect(r.rrTaken).toBe(-1);
    expect(r.rrEvaluable).toBe(false);
    expect(r.meetsTarget).toBeNull();
  });

  it('perda COM alvo declarado continua sendo julgada', () => {
    const r = rrBreakdown({ ...trade, result: -495, takeProfit: 172500 }, plan);

    expect(r.rrEvaluable).toBe(true);
    expect(r.meetsTarget).toBe(false);
  });

  it('stop na entrada (risco zero) não divide por zero', () => {
    const r = rrBreakdown({ ...trade, stopLoss: trade.entry }, plan);

    expect(r.riskAmount).toBe(0);
    expect(r.rrTaken).toBeNull();
  });

  it('sem tickerRule cai em 1 por ponto, sem quebrar', () => {
    const r = rrBreakdown({ ...trade, tickerRule: null }, plan);

    expect(r.riskAmount).toBe(2475);
  });

  it('trade sem resultado ainda informa o risco', () => {
    const r = rrBreakdown({ ...trade, result: null }, plan);

    expect(r.riskAmount).toBe(495);
    expect(r.rrTaken).toBeNull();
  });
});
