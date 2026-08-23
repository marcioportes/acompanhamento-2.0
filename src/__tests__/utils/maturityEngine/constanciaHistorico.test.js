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
import { computeStrategyConsistencyWeeks, resolveWindow } from '../../../utils/maturityEngine/helpers';

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
