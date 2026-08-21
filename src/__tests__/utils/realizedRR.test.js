/**
 * #381 — R:R realizado derivado, no lugar do escalar gravado.
 *
 * Caso real (WINV26 LONG 10, 21/08/2026): entrada 174.030, stop 173.905, saída 174.290.
 * Risco 125 pts, alvo 2:1 em 174.280, saída 10 pts ALÉM do alvo → R:R 2,08.
 * O card acusava "saída antecipada com 21% do alvo (RR 0.42)" ao lado de "alvo atingido
 * (2:1)", no mesmo trade — e a saída antecipada ainda virava a emoção dominante do
 * confronto. O 0,42 é o que a fórmula de compliance produz sem `tickerRule`: converte
 * R$ 520 em 52 pontos em vez de 260.
 */
import { describe, it, expect } from 'vitest';
import {
  realizedRR, planRrTargetOf, detectEarlyExit, detectTargetHit,
} from '../../utils/shadowBehaviorAnalysis';

const tradeReal = (over = {}) => ({
  id: 'T1', ticker: 'WINV26', side: 'LONG', qty: 10,
  entry: 174030, exit: 174290, stopLoss: 173905, result: 520,
  tickerRule: { tickSize: 5, tickValue: 1, pointValue: null },
  planRrTarget: 2,
  ...over,
});

describe('#381 — R:R realizado', () => {
  it('deriva da geometria de preço, não do escalar gravado', () => {
    // rrRatio velho no documento não contamina mais o resultado.
    expect(realizedRR(tradeReal({ rrRatio: 0.42 }))).toBe(2.08);
  });

  it('independe de tickerRule — foi a ausência dele que produziu o 0,42', () => {
    expect(realizedRR(tradeReal({ tickerRule: null }))).toBe(2.08);
    expect(realizedRR(tradeReal({ tickerRule: undefined, result: undefined }))).toBe(2.08);
  });

  it('SHORT conta na direção certa', () => {
    const t = tradeReal({ side: 'SHORT', entry: 174030, exit: 173780, stopLoss: 174155 });
    expect(realizedRR(t)).toBe(2); // ganhou 250, arriscou 125
  });

  it('stop na entrada não é R:R infinito — é ausência de razão', () => {
    expect(realizedRR(tradeReal({ stopLoss: 174030 }))).toBeNull();
  });

  it('sem stop informado não afirma nada', () => {
    expect(realizedRR(tradeReal({ stopLoss: null }))).toBeNull();
  });

  it('alvo do plano vem de planRrTarget — planRR nunca existiu no modelo', () => {
    expect(planRrTargetOf({ planRrTarget: 3 })).toBe(3);
    expect(planRrTargetOf({ planRrTarget: 1.5 })).toBe(1.5);
    expect(planRrTargetOf({})).toBe(2);
  });
});

describe('#381 — a contradição do card', () => {
  it('trade que atingiu o alvo NÃO emite saída antecipada', () => {
    const t = tradeReal({ rrRatio: 0.42 });
    expect(detectEarlyExit(t, [])).toBeNull();
  });

  it('e continua emitindo alvo atingido', () => {
    const t = tradeReal({ rrRatio: 0.42 });
    const hit = detectTargetHit(t, []);
    expect(hit).not.toBeNull();
    expect(hit.code).toBe('TARGET_HIT');
  });

  it('os dois nunca coexistem — mesma régua, resultados excludentes', () => {
    const cenarios = [
      tradeReal(),                                   // no alvo
      tradeReal({ exit: 174080 }),                   // saiu cedo (0,4)
      tradeReal({ exit: 174500 }),                   // deixou correr
      tradeReal({ side: 'SHORT', exit: 173780, stopLoss: 174155 }),
    ];
    for (const t of cenarios) {
      const cedo = detectEarlyExit(t, []);
      const alvo = detectTargetHit(t, []);
      expect(!!(cedo && alvo)).toBe(false);
    }
  });

  it('saída realmente antecipada continua sendo acusada', () => {
    const t = tradeReal({ exit: 174080, result: 100 }); // 50 pts de 250 → RR 0,4
    const cedo = detectEarlyExit(t, []);
    expect(cedo).not.toBeNull();
    expect(cedo.evidence.actualRR).toBe(0.4);
    expect(cedo.evidence.planRR).toBe(2);
    expect(cedo.evidence.rrAchievedPct).toBe(20);
  });
});
