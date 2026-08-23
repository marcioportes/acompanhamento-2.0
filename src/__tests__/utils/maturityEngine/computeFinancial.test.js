/**
 * #376 — dimensão Financeira mede CONDUTA de risco, não performance.
 *
 * Regra do Marcio (23/08/2026): *"eficiência, payoff, consistência e drawdown são
 * indicadores de performance, não de maturidade. Se um aluno teve drawdown de 100%
 * respeitando o limite de sua perda, usou o modelo, parou o ciclo e se manteve
 * disciplinado — como pode ser penalizado?"*
 *
 * O teste anterior exercitava a fórmula antiga (eScore/pScore/cvScore/ddScore), que
 * deixou de existir. Este exercita a nova, e o primeiro caso é literalmente o exemplo
 * que originou a mudança.
 */
import { describe, it, expect } from 'vitest';
import {
  computeFinancial,
  scoreRiscoPorOperacao,
  scoreQuedaContraLimite,
  scoreProtecao,
} from '../../../utils/maturityEngine/computeFinancial';

const trade = ({ ro = 'CONFORME', stop = true } = {}) => ({
  compliance: { roStatus: ro },
  stopLoss: stop ? 100 : null,
  result: -10,
});
const nTrades = (n, opts) => Array.from({ length: n }, () => trade(opts));

describe('computeFinancial — conduta de risco (#376)', () => {
  it('o caso do Marcio: queda de 100% DENTRO do limite que o aluno definiu → nota cheia', () => {
    const out = computeFinancial({
      trades: nTrades(10),
      plans: [{ cycleStop: 100 }],
      maxDrawdown: { maxDDPercent: 100 },
    });
    expect(out.score).toBe(100);
    expect(out.breakdown.ddScore).toBe(100);
  });

  it('quanto da folga o aluno consumiu é performance — 1% e 99% do limite pontuam igual', () => {
    const base = { trades: nTrades(10), plans: [{ cycleStop: 10 }] };
    const pouco = computeFinancial({ ...base, maxDrawdown: { maxDDPercent: 0.1 } });
    const quase = computeFinancial({ ...base, maxDrawdown: { maxDDPercent: 9.9 } });
    expect(pouco.score).toBe(quase.score);
  });

  it('estouro decai proporcionalmente e zera ao dobro do limite', () => {
    const base = { trades: nTrades(10), plans: [{ cycleStop: 10 }] };
    const noLimite = computeFinancial({ ...base, maxDrawdown: { maxDDPercent: 10 } });
    const meio = computeFinancial({ ...base, maxDrawdown: { maxDDPercent: 15 } });
    const dobro = computeFinancial({ ...base, maxDrawdown: { maxDDPercent: 20 } });
    const muito = computeFinancial({ ...base, maxDrawdown: { maxDDPercent: 60 } });
    expect(noLimite.breakdown.ddScore).toBe(100);
    expect(meio.breakdown.ddScore).toBeCloseTo(50, 5);
    expect(dobro.breakdown.ddScore).toBe(0);
    expect(muito.breakdown.ddScore).toBe(0); // não vira negativo
  });

  it('o limite é o DO ALUNO, não uma régua fixa: mesma queda, planos diferentes', () => {
    const queda = { maxDDPercent: 20 };
    const conservador = computeFinancial({ trades: nTrades(10), plans: [{ cycleStop: 10 }], maxDrawdown: queda });
    const arrojado = computeFinancial({ trades: nTrades(10), plans: [{ cycleStop: 30 }], maxDrawdown: queda });
    expect(conservador.breakdown.ddScore).toBe(0);
    expect(arrojado.breakdown.ddScore).toBe(100);
  });

  it('risco por operação: fração dos trades dentro do RO autorizado', () => {
    expect(scoreRiscoPorOperacao(nTrades(4))).toBe(100);
    expect(scoreRiscoPorOperacao([...nTrades(2), ...nTrades(2, { ro: 'FORA_DO_PLANO' })])).toBe(50);
    expect(scoreRiscoPorOperacao(nTrades(3, { ro: 'FORA_DO_PLANO' }))).toBe(0);
  });

  it('proteção: fração dos trades que nasceram com stop definido', () => {
    expect(scoreProtecao(nTrades(5))).toBe(100);
    expect(scoreProtecao([...nTrades(1), ...nTrades(3, { stop: false })])).toBe(25);
  });

  it('performance NÃO entra: payoff e expectativa não mudam a nota', () => {
    const base = { trades: nTrades(10), plans: [{ cycleStop: 10 }], maxDrawdown: { maxDDPercent: 5 } };
    const semPerf = computeFinancial(base);
    const comPerf = computeFinancial({
      ...base,
      stats: { expectancy: -999, payoffRatio: 0.1 },
      payoff: { ratio: 0.1 },
      consistencyCV: { cv: 9 },
      evLeakage: { evTheoretical: 100, evReal: -100 },
    });
    expect(comPerf.score).toBe(semPerf.score);
  });

  describe('ausência de dado vira componente neutro + flag, nunca zero', () => {
    it('janela vazia → 50, LOW', () => {
      const out = computeFinancial({ trades: [], plans: [{ cycleStop: 10 }] });
      expect(out.score).toBe(50);
      expect(out.confidence).toBe('LOW');
      expect(out.neutralFallback).toBe('financial:empty-window');
    });

    it('sem roStatus em nenhum trade → roScore neutro com flag', () => {
      const out = computeFinancial({
        trades: [{ stopLoss: 100 }, { stopLoss: 100 }],
        plans: [{ cycleStop: 10 }],
        maxDrawdown: { maxDDPercent: 5 },
      });
      expect(out.breakdown.roScore).toBe(50);
      expect(out.neutralFallback).toContain('financial:roScore');
    });

    it('sem drawdown calculável → ddScore neutro com flag', () => {
      const out = computeFinancial({ trades: nTrades(5), plans: [{ cycleStop: 10 }], maxDrawdown: null });
      expect(out.breakdown.ddScore).toBe(50);
      expect(out.neutralFallback).toContain('financial:ddScore');
    });

    it('plano sem cycleStop cai na régua de segurança, não em gate impossível', () => {
      // Mesma lição do `initialBalance` neste issue: sem denominador o gate nunca passa.
      const out = scoreQuedaContraLimite({ maxDDPercent: 10 }, [{}]);
      expect(out).toBe(100); // 10% contra a régua de 25%
    });
  });

  describe('confiança pelo tamanho da amostra', () => {
    it('40 trades → HIGH', () => {
      expect(computeFinancial({ trades: nTrades(40), plans: [{ cycleStop: 10 }], maxDrawdown: { maxDDPercent: 5 } }).confidence).toBe('HIGH');
    });
    it('10 trades → MED', () => {
      expect(computeFinancial({ trades: nTrades(10), plans: [{ cycleStop: 10 }], maxDrawdown: { maxDDPercent: 5 } }).confidence).toBe('MED');
    });
    it('3 trades → LOW', () => {
      expect(computeFinancial({ trades: nTrades(3), plans: [{ cycleStop: 10 }], maxDrawdown: { maxDDPercent: 5 } }).confidence).toBe('LOW');
    });
  });
});
