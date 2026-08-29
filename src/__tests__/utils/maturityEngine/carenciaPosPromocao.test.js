/**
 * #101 (29/08/2026) — "acabamos de promover o Wilson e a torre tá dizendo pra rever".
 *
 * O gatilho 3 do detector compara as métricas com o ESTÁGIO ATUAL. Promover sobe o
 * estágio sem mudar uma linha dos dados, então toda promoção produzia, no recompute
 * seguinte, "métricas mapeiam para stage N-1 (< N)" — um alerta mandando o mentor
 * desfazer o que acabara de fazer.
 *
 * Estado real do Wilson quando Marcio reclamou: currentStage 3, gates 6/14,
 * signalRegression detected com "métricas mapeiam para stage 2 (< 3)".
 */
import { describe, it, expect } from 'vitest';
import { detectRegressionSignal } from '../../../utils/maturityEngine/detectRegressionSignal';

// Reproduz o caso do Wilson: métricas de stage 2, aluno promovido para 3.
const wilson = {
  composite: 55,
  stageCurrent: 3,
  E: 60,
  F: 58,
  baseline: { emotional: 60, financial: 60 },
  metrics: { winRate: 0.5, payoff: 1.4, maxDDPercent: 8 },
};

describe('carência pós-promoção', () => {
  it('sem carência, a promoção vira regressão — o defeito', () => {
    const r = detectRegressionSignal(wilson);
    expect(r.detected).toBe(true);
    expect(r.reasons.join(' ')).toContain('mapeiam para stage');
  });

  it('em carência, nenhuma regressão é emitida', () => {
    const r = detectRegressionSignal({ ...wilson, emCarencia: true });
    expect(r.detected).toBe(false);
    expect(r.suggestedStage).toBeNull();
  });

  it('a carência DIZ por que não avaliou — silêncio sem motivo é pior', () => {
    const r = detectRegressionSignal({ ...wilson, emCarencia: true });
    expect(r.reasons[0]).toContain('carência pós-promoção');
  });

  it('passada a carência, a regressão volta a valer', () => {
    const r = detectRegressionSignal({ ...wilson, emCarencia: false });
    expect(r.detected).toBe(true);
  });

  it('aluno cujas métricas sustentam o estágio não regride, com ou sem carência', () => {
    // Mesmas métricas do Wilson, mas no estágio que elas de fato sustentam.
    const coerente = { ...wilson, stageCurrent: 1, composite: 75, E: 78, F: 76 };
    expect(detectRegressionSignal(coerente).detected).toBe(false);
    expect(detectRegressionSignal({ ...coerente, emCarencia: true }).detected).toBe(false);
  });
});
