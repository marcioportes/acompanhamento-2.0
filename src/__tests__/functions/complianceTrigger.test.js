/**
 * #388 — o gatilho de compliance não pode disparar sozinho.
 *
 * `tickerRule` é um MAPA. Comparado por identidade (`!==`), dois mapas desserializados
 * são sempre diferentes: `complianceChanged` virava sempre true, a CF regravava compliance
 * a cada escrita e a própria escrita disparava a CF de novo. Medido em produção: 1000+
 * invocações de `onTradeUpdated` em poucas horas, três na mesma fração de segundo, o
 * cliente recebendo um snapshot por volta — tela oscilando e rolagem voltando.
 */
import { describe, it, expect } from 'vitest';

const SCALAR = ['stopLoss', 'entry', 'exit', 'qty', 'side', 'emotionEntry'];
const OBJECTS = ['tickerRule'];
const fingerprint = (v) => (v === undefined ? null : JSON.stringify(v) ?? null);
const complianceChanged = (before, after) =>
  SCALAR.some(f => (before[f] ?? null) !== (after[f] ?? null)) ||
  OBJECTS.some(f => fingerprint(before[f]) !== fingerprint(after[f]));

const tickerRule = () => ({ tickSize: 5, tickValue: 1, pointValue: null });

describe('#388 — gatilho de compliance', () => {
  it('doc idêntico não dispara — era a origem do loop', () => {
    const before = { stopLoss: 173905, qty: 10, tickerRule: tickerRule() };
    const after = { stopLoss: 173905, qty: 10, tickerRule: tickerRule() };
    expect(complianceChanged(before, after)).toBe(false);
  });

  it('mudança real em tickerRule ainda dispara (motivo do #383)', () => {
    const before = { tickerRule: null };
    const after = { tickerRule: tickerRule() };
    expect(complianceChanged(before, after)).toBe(true);
  });

  it('mudança em campo escalar segue disparando', () => {
    expect(complianceChanged({ stopLoss: 1, tickerRule: tickerRule() }, { stopLoss: 2, tickerRule: tickerRule() })).toBe(true);
  });

  it('ausência nos dois lados não dispara', () => {
    expect(complianceChanged({}, {})).toBe(false);
  });
});
