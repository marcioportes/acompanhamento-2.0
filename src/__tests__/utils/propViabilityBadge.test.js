import { describe, it, expect } from 'vitest';
import { classifyViability, VIABILITY_STATES } from '../../utils/propViabilityBadge';

const base = {
  mode: 'execution',
  incompatible: false,
  constraintsViolated: [],
  roPerTrade: 300,
  maxTradesPerDay: 2,
  dailyLossLimit: 2000,
  lossesToBust: 8,
  evPerTrade: 150,
  sessionRestricted: false,
  recommendedSessions: ['ny', 'london', 'asia'],
  stopPoints: 20,
  instrument: { minViableStop: 10 },
  evalBusinessDays: 30,
};

describe('classifyViability', () => {
  it('null plan → ERRO gray', () => {
    const r = classifyViability(null);
    expect(r.state).toBe(VIABILITY_STATES.ERRO);
    expect(r.color).toBe('gray');
  });

  it('mode:error → ERRO', () => {
    const r = classifyViability({ mode: 'error', constraintsViolated: ['instrument_not_found'] });
    expect(r.state).toBe(VIABILITY_STATES.ERRO);
  });

  it('CONFORTAVEL: stopPct<0.60, lossesToBust>=5, EV>0', () => {
    const r = classifyViability(base, 'EVALUATION');
    expect(r.state).toBe(VIABILITY_STATES.CONFORTAVEL);
    expect(r.color).toBe('green');
    expect(r.text).toMatch(/30% do daily loss/);
    expect(r.text).toMatch(/30 dias/);
  });

  it('APERTADO: stopPct entre 60-90%', () => {
    const r = classifyViability({ ...base, roPerTrade: 700, maxTradesPerDay: 2 }, 'EVALUATION');
    // stop = 1400 / 2000 = 70%
    expect(r.state).toBe(VIABILITY_STATES.APERTADO);
    expect(r.color).toBe('amber');
  });

  it('APERTADO fallback: lossesToBust<=2 ou EV<0', () => {
    const r = classifyViability({ ...base, lossesToBust: 2 }, 'EVALUATION');
    expect(r.state).toBe(VIABILITY_STATES.APERTADO);
  });

  it('RESTRITO: sessionRestricted com sessões alternativas', () => {
    const r = classifyViability({
      ...base, sessionRestricted: true, recommendedSessions: ['london', 'asia'],
    });
    expect(r.state).toBe(VIABILITY_STATES.RESTRITO);
    expect(r.color).toBe('orange');
    expect(r.text).toMatch(/London\/Asia/);
  });

  it('STOP_RUIDO: incompatible + stop_below_min_viable + microSuggestion', () => {
    const r = classifyViability({
      ...base,
      incompatible: true,
      constraintsViolated: ['stop_below_min_viable'],
      stopPoints: 5,
      instrument: { minViableStop: 10 },
      microSuggestion: 'MNQ',
    });
    expect(r.state).toBe(VIABILITY_STATES.STOP_RUIDO);
    expect(r.color).toBe('red');
    expect(r.text).toMatch(/MNQ/);
  });

  it('RESTRICAO_HARD: ro_exceeds_daily_loss', () => {
    const r = classifyViability({
      ...base,
      incompatible: true,
      constraintsViolated: ['ro_exceeds_daily_loss'],
      inviabilityReason: 'RO $5000 excede daily loss $2000',
    });
    expect(r.state).toBe(VIABILITY_STATES.RESTRICAO_HARD);
    expect(r.color).toBe('red');
    expect(r.text).toMatch(/excede daily loss/);
  });

  it('RESTRICAO_HARD: stop_exceeds_ny_range', () => {
    const r = classifyViability({
      ...base,
      incompatible: true,
      constraintsViolated: ['stop_exceeds_ny_range'],
      inviabilityReason: 'stop 80% do range NY excede limite 75%',
    });
    expect(r.state).toBe(VIABILITY_STATES.RESTRICAO_HARD);
  });

  it('phase SIM_FUNDED muda sufixo de texto', () => {
    const r = classifyViability(base, 'SIM_FUNDED');
    expect(r.text).toMatch(/preservar capital fundado/);
  });

  it('phase PA muda sufixo', () => {
    const r = classifyViability(base, 'PA');
    expect(r.text).toMatch(/sem deadline/);
  });

  it('Bug fix (#145 Fase H): dailyLossLimit null (Apex PA) não gera NaN/Infinity — usa métrica alternativa', () => {
    const r = classifyViability({
      ...base,
      dailyLossLimit: null,
      drawdownMax: 1000,
      roPerTrade: 150,
      maxTradesPerDay: 1,
      lossesToBust: 6,
      evPerTrade: 100,
    }, 'PA');
    expect([VIABILITY_STATES.CONFORTAVEL, VIABILITY_STATES.APERTADO]).toContain(r.state);
    expect(r.text).not.toMatch(/NaN|Infinity|% do daily loss/);
    expect(r.text).toMatch(/DD de/);
    expect(r.text).toMatch(/margem 6 perdas/);
    expect(r.text).toMatch(/sem deadline/); // phase PA sufixo
  });

  it('Bug fix (#145 Fase H): dailyLossLimit 0 também trata como sem limite', () => {
    const r = classifyViability({
      ...base,
      dailyLossLimit: 0,
      drawdownMax: 1000,
      roPerTrade: 150,
      maxTradesPerDay: 1,
    }, 'SIM_FUNDED');
    expect(r.text).not.toMatch(/% do daily loss/);
    expect(r.text).toMatch(/preservar capital fundado/);
  });
});
