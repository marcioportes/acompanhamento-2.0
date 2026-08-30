/**
 * #101 (29/08/2026) — "ainda saindo no alerta de regressão".
 *
 * Medido com o motor antigo ainda em produção: OITO alunos com regressão
 * detectada, todos pelo gatilho "métricas mapeiam para stage N-1".
 */
import { describe, it, expect } from 'vitest';
import { regressaoVigente } from '../../../utils/maturityEngine/regressionVisibility';

const doc = (extra = {}) => ({
  currentStage: 2, baselineStage: 2, gatesMet: 6, gatesTotal: 9,
  signalRegression: { detected: true, suggestedStage: 1, severity: 'LOW', reasons: ['métricas mapeiam para stage 1 (< 2)'] },
  ...extra,
});

describe('regressaoVigente', () => {
  it('esconde sugestão abaixo do baseline do assessment — DEC-020', () => {
    // Sael, Elza, Daniel, Sandra, João Victor: baseline 2, sugerido 1.
    const r = regressaoVigente(doc());
    expect(r.visivel).toBe(false);
    expect(r.motivo).toContain('DEC-020');
  });

  it('esconde acusação em aluno que nunca operou', () => {
    // João Victor: 0 trades, gates 0/9, e mesmo assim "regrediu".
    const r = regressaoVigente(doc({ gatesMet: 0, gatesTotal: 9 }));
    expect(r.visivel).toBe(false);
  });

  it('esconde no aluno promovido enquanto a régua nova não foi calculada', () => {
    // Wilson: promovido para 3 sobre baseline 2; sugerido 2 não fere a DEC-020,
    // mas a comparação usou as métricas do estágio anterior.
    const wilson = doc({
      currentStage: 3, baselineStage: 2,
      signalRegression: { detected: true, suggestedStage: 2, severity: 'LOW', reasons: [] },
    });
    const r = regressaoVigente(wilson);
    expect(r.visivel).toBe(false);
    expect(r.motivo).toContain('promovido');
  });

  it('volta a valer no promovido depois que o servidor recalcula', () => {
    const depois = doc({
      currentStage: 3, baselineStage: 2, stageSince: { toDate: () => new Date('2026-08-29') },
      signalRegression: { detected: true, suggestedStage: 2, severity: 'MED', reasons: [] },
    });
    expect(regressaoVigente(depois).visivel).toBe(true);
  });

  it('regressão legítima continua aparecendo', () => {
    // Estágio acima do baseline por promoção antiga, já remedido, caindo de 3 para 2.
    const legitima = doc({
      currentStage: 3, baselineStage: 3, stageSince: '2026-01-01',
      signalRegression: { detected: true, suggestedStage: 3, severity: 'HIGH', reasons: ['composite baixo'] },
    });
    expect(regressaoVigente(legitima).visivel).toBe(true);
  });

  it('sem sinal não há o que exibir', () => {
    expect(regressaoVigente({ signalRegression: { detected: false } }).visivel).toBe(false);
    expect(regressaoVigente(null).visivel).toBe(false);
  });
});

describe('o detector deixou de gerar sugestão abaixo do baseline', () => {
  it('métricas de stage 1 num aluno com baseline 2 não viram regressão', async () => {
    const { detectRegressionSignal } = await import('../../../utils/maturityEngine/detectRegressionSignal');
    const r = detectRegressionSignal({
      composite: 70, stageCurrent: 2, E: 70, F: 70,
      baseline: { emotional: 70, financial: 70 },
      metrics: { winRate: 0.4, payoff: 0.9, maxDDPercent: 20 },
      baselineStage: 2,
    });
    expect(r.reasons.join(' ')).not.toContain('mapeiam para stage');
  });

  it('sem baseline informado o piso é 1, e a regra antiga continua valendo', async () => {
    const { detectRegressionSignal } = await import('../../../utils/maturityEngine/detectRegressionSignal');
    const r = detectRegressionSignal({
      composite: 70, stageCurrent: 3, E: 70, F: 70,
      baseline: { emotional: 70, financial: 70 },
      metrics: { winRate: 0.4, payoff: 0.9, maxDDPercent: 20 },
    });
    expect(r.reasons.join(' ')).toContain('mapeiam para stage');
  });
});
