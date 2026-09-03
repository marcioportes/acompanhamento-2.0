/**
 * adjustExplainers.test.js — issue #418
 *
 * Guarda dois riscos: (1) uma leitura sair de faixa de nota em vez do dado —
 * o defeito que o #416 encontrou nos hints do TPS; (2) jargão de motor vazar
 * para a tela do aluno.
 */

import { describe, it, expect } from 'vitest';
import {
  EXPLAINERS,
  DECISION_LABELS,
  buildKellyReading,
  buildMcReading,
  buildAdviceCopy,
  formatRiskPct,
} from '../../../utils/cycleClosure/adjustExplainers';

const ADVISOR_RULES = [
  'pause_restructure', 'insufficient_sample', 'scale_up',
  'scale_down', 'regression', 'observe',
];
const KELLY_REASONS = ['no_plan', 'no_trades', 'insufficient_sample', 'zero_variance'];

describe('EXPLAINERS — catálogo', () => {
  it('Kelly e Monte Carlo têm os três campos preenchidos', () => {
    for (const key of ['kelly', 'monteCarlo']) {
      const e = EXPLAINERS[key];
      expect(e.friendlyLabel.length).toBeGreaterThan(10);
      expect(e.technicalLabel.length).toBeGreaterThan(1);
      for (const field of ['whatIs', 'whyExists', 'soWhat']) {
        expect(e[field].length).toBeGreaterThan(40);
      }
    }
  });

  it('o rótulo de tela é a pergunta do aluno; o termo técnico fica subordinado', () => {
    expect(EXPLAINERS.kelly.friendlyLabel).not.toMatch(/Kelly/);
    expect(EXPLAINERS.monteCarlo.friendlyLabel).not.toMatch(/Monte Carlo/i);
    expect(EXPLAINERS.kelly.technicalLabel).toMatch(/Kelly/);
  });

  it('nenhum jargão de motor no catálogo', () => {
    const blob = JSON.stringify(EXPLAINERS);
    for (const term of ['Sample', 'sample', 'edge', 'size', 'heurística v', 'Expectancy', 'p10', 'p90', 'bootstrap']) {
      expect(blob).not.toContain(term);
    }
  });
});

describe('buildKellyReading', () => {
  it('cobre os 4 reason do kellyCalculator sem cair no default', () => {
    for (const reason of KELLY_REASONS) {
      const r = buildKellyReading({ reason, sampleSize: 4 }, 0.84);
      expect(r.tone).toBe('unavailable');
      expect(r.headline).toMatch(/Ainda não dá pra calcular/);
      expect(r.headline).not.toMatch(/undefined|NaN/);
    }
  });

  it('amostra insuficiente diz quantos trades faltam, sem falar em "sample"', () => {
    const r = buildKellyReading({ reason: 'insufficient_sample', sampleSize: 7 }, 0.84);
    expect(r.headline).toContain('7 trades');
    expect(r.headline).toContain('10');
    expect(r.headline).not.toMatch(/sample/i);
  });

  it('Kelly acima do risco atual → leitura de folga', () => {
    const r = buildKellyReading({ reason: null, kellySafe: 0.024, sampleSize: 20 }, 0.84);
    expect(r.tone).toBe('positive');
    expect(r.headline).toContain('2.4%');
    expect(r.headline).toContain('0.84%');
    expect(r.headline).toMatch(/folga/i);
  });

  it('Kelly abaixo do risco atual → leitura oposta, não a mesma frase', () => {
    const folga = buildKellyReading({ reason: null, kellySafe: 0.024, sampleSize: 20 }, 0.84);
    const aperto = buildKellyReading({ reason: null, kellySafe: 0.004, sampleSize: 20 }, 0.84);
    expect(aperto.tone).toBe('caution');
    expect(aperto.headline).not.toBe(folga.headline);
    expect(aperto.headline).toMatch(/abaixo/);
  });

  it('Kelly colado no risco atual não manda mexer em nada', () => {
    const r = buildKellyReading({ reason: null, kellySafe: 0.0088, sampleSize: 20 }, 0.84);
    expect(r.tone).toBe('neutral');
  });

  it('risco atual ausente ou zero não produz divisão nem NaN', () => {
    for (const risk of [undefined, null, 0, NaN]) {
      const r = buildKellyReading({ reason: null, kellySafe: 0.02 }, risk);
      expect(r.tone).toBe('unavailable');
      expect(r.headline).not.toMatch(/NaN|Infinity|undefined/);
    }
  });
});

describe('buildMcReading', () => {
  const mc = { reason: null, nSims: 1000, pLoss: 0.38, p50: 410, samplePoolSize: 100 };

  it('probabilidade de perda é a manchete, em cenários e em percentual', () => {
    const r = buildMcReading(mc, { p50Pct: 1.3 });
    expect(r.headline).toContain('380');
    expect(r.headline).toContain('1000');
    expect(r.headline).toContain('38%');
  });

  it('pool pequeno qualifica o número em vez de deixá-lo mandar sozinho', () => {
    const r = buildMcReading({ ...mc, samplePoolSize: 20 }, { p50Pct: 1.3 });
    expect(r.note).toMatch(/20 trades/);
    expect(r.note).toMatch(/Amostra pequena/);
  });

  it('pool grande não carrega a ressalva de amostra', () => {
    const r = buildMcReading(mc, { p50Pct: 1.3 });
    expect(r.note || '').not.toMatch(/Amostra pequena/);
  });

  it('sem capital base a mediana sai em moeda, nunca como NaN%', () => {
    const r = buildMcReading(mc, { p50Pct: null, formatCurrency: (v) => `R$ ${v.toFixed(2)}` });
    expect(r.note).toContain('R$ 410.00');
    expect(r.note).not.toMatch(/NaN|Infinity/);
    expect(r.note).not.toMatch(/% do capital/);
  });

  it('projeção sem pLoss (draft antigo) cai na faixa em vez de sumir da tela', () => {
    const { pLoss, ...semPLoss } = mc;
    const r = buildMcReading(semPLoss, { p50Pct: 1.3 });
    expect(r.tone).toBe('neutral');
    expect(r.headline).toContain('+1.3%');
    expect(r.headline).not.toMatch(/vermelho/);
  });

  it('tom acompanha a probabilidade de perda', () => {
    expect(buildMcReading({ ...mc, pLoss: 0.62 }, {}).tone).toBe('caution');
    expect(buildMcReading({ ...mc, pLoss: 0.20 }, {}).tone).toBe('positive');
    expect(buildMcReading({ ...mc, pLoss: 0.40 }, {}).tone).toBe('neutral');
  });

  it('pool vazio → leitura de indisponível, sem número inventado', () => {
    const r = buildMcReading({ reason: 'empty_pool', nSims: 1000 }, {});
    expect(r.tone).toBe('unavailable');
    expect(r.headline).not.toMatch(/\d+ dos/);
  });
});

describe('buildAdviceCopy', () => {
  it('os 6 triggeredRule têm cópia própria', () => {
    const headlines = ADVISOR_RULES.map((rule) => buildAdviceCopy({ triggeredRule: rule }, 0.84).headline);
    expect(new Set(headlines).size).toBe(ADVISOR_RULES.length);
    for (const h of headlines) expect(h.length).toBeGreaterThan(10);
  });

  it('nenhuma cópia carrega jargão do rationale do advisor', () => {
    for (const rule of ADVISOR_RULES) {
      const { headline, body } = buildAdviceCopy({ triggeredRule: rule, newRiskPerOp: 1.05 }, 0.84);
      const blob = `${headline} ${body}`;
      for (const term of ['Sample', 'edge', 'size', 'Expectancy', 'heurística', 'blow-up', 'trigger']) {
        expect(blob).not.toContain(term);
      }
    }
  });

  it('escalar cita os dois números — o vigente e o novo', () => {
    const up = buildAdviceCopy({ triggeredRule: 'scale_up', newRiskPerOp: 1.05 }, 0.84);
    expect(up.headline).toContain('0.84%');
    expect(up.headline).toContain('1.05%');
    const down = buildAdviceCopy({ triggeredRule: 'scale_down', newRiskPerOp: 0.63 }, 0.84);
    expect(down.headline).toContain('0.63%');
  });

  it('sem os números a manchete degrada em vez de imprimir undefined', () => {
    const r = buildAdviceCopy({ triggeredRule: 'scale_up' }, undefined);
    expect(r.headline).not.toMatch(/undefined|NaN|null/);
  });

  it('regra desconhecida cai no manter, nunca em tela vazia', () => {
    const r = buildAdviceCopy({ triggeredRule: 'regra_que_nao_existe' }, 0.84);
    expect(r.headline.length).toBeGreaterThan(10);
  });
});

describe('DECISION_LABELS', () => {
  it('cobre os três decisionSource que o wizard grava', () => {
    for (const key of ['suggestion_accepted', 'manual_edit', 'kept']) {
      expect(DECISION_LABELS[key]).toMatch(/^você /);
    }
  });
});

describe('buildAdviceCopy — riscos na língua do aluno', () => {
  it('nenhum risco carrega jargão do advisor', () => {
    for (const rule of ADVISOR_RULES) {
      for (const r of buildAdviceCopy({ triggeredRule: rule }, 0.84).risks) {
        for (const term of ['Sample', 'n ≥', 'size', 'DD', 'blow-up', 'Regressão em']) {
          expect(r).not.toContain(term);
        }
      }
    }
  });

  it('pausa lista riscos; manter sem trigger não inventa nenhum', () => {
    expect(buildAdviceCopy({ triggeredRule: 'pause_restructure' }, 0.84).risks.length).toBe(3);
    expect(buildAdviceCopy({ triggeredRule: 'observe' }, 0.84).risks).toEqual([]);
  });
});

describe('formatRiskPct', () => {
  it('abaixo de 0,1% mostra duas casas — 0.0% mandaria parar de operar', () => {
    expect(formatRiskPct(0.0285)).toBe('0.03%');
    expect(formatRiskPct(0.84)).toBe('0.8%');
    expect(formatRiskPct(2.44)).toBe('2.4%');
    expect(formatRiskPct(0)).toBe('0.0%');
    expect(formatRiskPct(null)).toBe('—');
  });
});
