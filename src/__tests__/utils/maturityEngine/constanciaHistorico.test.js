/**
 * #376 — constância de estratégia é fato HISTÓRICO, não da janela.
 *
 * O gate pede 8 semanas com o mesmo setup dominante. A métrica era calculada sobre a
 * janela rolante — `max(últimos N trades, últimos N dias)` — que no stage 2 cobre no
 * máximo 45 dias, ou 6,4 semanas. O teto da medida ficava ABAIXO do gate: impossível por
 * construção, e pior para quem opera mais, porque menos semanas cabem na janela.
 *
 * Nenhum aluno da base passou esse gate desde a abertura da mentoria.
 */
import { describe, it, expect } from 'vitest';
import { computeStrategyConsistencyWeeks, computeStrategyConsistencyMonths, resolveWindow } from '../../../utils/maturityEngine/helpers';

/** Gera N semanas de trades com o mesmo setup, 5 por semana. */
const historico = (semanas, setup = 'Continuidade') => {
  const out = [];
  const inicio = new Date('2026-01-05T00:00:00Z');   // segunda-feira
  for (let w = 0; w < semanas; w++) {
    for (let d = 0; d < 5; d++) {
      const dia = new Date(inicio.getTime() + ((w * 7 + d) * 86400000));
      out.push({
        id: `t${w}-${d}`, studentId: 'S1', setup, result: 10,
        date: dia.toISOString().slice(0, 10),
        entryTime: `${dia.toISOString().slice(0, 10)}T10:00:00-03:00`,
        exitTime: `${dia.toISOString().slice(0, 10)}T10:30:00-03:00`,
      });
    }
  }
  return out;
};

describe('#376 — constância medida no histórico', () => {
  it('12 semanas de constância são 12, não o teto da janela', () => {
    const trades = historico(12);
    expect(computeStrategyConsistencyWeeks(trades, [])).toBe(12);
  });

  it('a janela rolante NÃO consegue enxergar 8 semanas no stage 2 — o gate era impossível', () => {
    const trades = historico(12);
    const { window: W } = resolveWindow(trades, 2, new Date('2026-03-30T00:00:00Z'));
    const naJanela = computeStrategyConsistencyWeeks(W, []);
    const noHistorico = computeStrategyConsistencyWeeks(trades, []);
    expect(naJanela).toBeLessThan(8);        // teto da janela
    expect(noHistorico).toBeGreaterThanOrEqual(8);
  });

  it('quanto MAIS ativo o aluno, menos semanas cabiam na janela — a régua punia atividade', () => {
    const poucoAtivo = historico(12).filter((_, i) => i % 5 === 0);   // 1 trade/semana
    const muitoAtivo = historico(12);                                  // 5 trades/semana
    const agora = new Date('2026-03-30T00:00:00Z');
    const janelaPouco = computeStrategyConsistencyWeeks(resolveWindow(poucoAtivo, 2, agora).window, []);
    const janelaMuito = computeStrategyConsistencyWeeks(resolveWindow(muitoAtivo, 2, agora).window, []);
    expect(janelaPouco).toBeGreaterThan(janelaMuito);
    // No histórico, os dois têm a mesma constância — que é o que a frase da tela promete.
    expect(computeStrategyConsistencyWeeks(poucoAtivo, [])).toBe(computeStrategyConsistencyWeeks(muitoAtivo, []));
  });

  it('trocar de setup no meio quebra a sequência, como deve', () => {
    const trades = [...historico(4, 'Continuidade'), ...historico(4, 'Reversão').map((t, i) => ({
      ...t, id: `x${i}`,
      date: new Date(new Date(t.date).getTime() + 28 * 86400000).toISOString().slice(0, 10),
    }))];
    expect(computeStrategyConsistencyWeeks(trades, [])).toBeLessThan(8);
  });
});

/**
 * #376 — a sequência precisa ser vizinha no calendário.
 *
 * Achado do review: `sortedWeeks` só tem as semanas COM trade, e o run contava
 * adjacência nessa lista esparsa. Enquanto a janela era de 45 dias isso ficava
 * estruturalmente limitado; sobre o histórico completo (#396) virou ilimitado —
 * rajadas espalhadas por dois anos passavam no gate de constância.
 */
describe('#376 — buraco de calendário quebra a sequência', () => {
  const t = (iso, setup = 'Rompimento') => ({ date: iso, setup });
  const JAN = ['2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26'];
  const JUL = ['2026-07-06', '2026-07-13', '2026-07-20', '2026-07-27'];

  it('4 semanas em janeiro + 4 em julho não valem 8 seguidas', () => {
    const n = computeStrategyConsistencyWeeks([...JAN, ...JUL].map((d) => t(d)), []);
    expect(n).toBe(4);
  });

  it('8 semanas realmente contíguas valem 8', () => {
    const seguidas = ['2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26',
      '2026-02-02', '2026-02-09', '2026-02-16', '2026-02-23'];
    expect(computeStrategyConsistencyWeeks(seguidas.map((d) => t(d)), [])).toBe(8);
  });

  it('uma semana sem operar não apaga a constância (tolerância de 1)', () => {
    const pulaUma = ['2026-01-05', '2026-01-12', '2026-01-26', '2026-02-02'];
    expect(computeStrategyConsistencyWeeks(pulaUma.map((d) => t(d)), [])).toBe(4);
  });

  it('duas semanas seguidas de ausência quebram', () => {
    const pulaDuas = ['2026-01-05', '2026-01-12', '2026-02-02', '2026-02-09'];
    expect(computeStrategyConsistencyWeeks(pulaDuas.map((d) => t(d)), [])).toBe(2);
  });

  it('meses: janeiro + julho não valem 2 consecutivos', () => {
    const trades = [...JAN, ...JUL].map((d) => t(d));
    expect(computeStrategyConsistencyMonths(trades, [])).toBe(1);
  });
});
