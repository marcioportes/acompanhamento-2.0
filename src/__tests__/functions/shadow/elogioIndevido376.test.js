/**
 * #376 — padrão positivo não é concedido a trade que quebrou o plano.
 *
 * Caso real (WINV26, 20/08/2026, +R$ 610): o aluno tomou R$ 495 de risco contra os
 * R$ 252 que o plano autoriza — e o card exibia, no mesmo lugar da violação:
 *   "Condução de sizing — o risco continuou dentro do RO"
 *   "Execução limpa — é exatamente assim que o plano espera que você opere"
 *
 * Marcio: *"mesmo com setup indefinido, o sistema ajusta como execução alinhada se o
 * Financeiro não tenha sido violado"*. Elogio por AUSÊNCIA de sinal negativo, em vez de
 * presença de sinal positivo.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { analyzeShadowForTradeCF } = require('../../../../functions/shadow/shadowDetectors.js');
const { detectExecutionEvents } = require('../../../../functions/maturity/executionBehaviorMirror.js');

const base = {
  id: 't1', ticker: 'WINV26', side: 'LONG', date: '2026-08-20',
  entry: 171842.5, exit: 172147.5, stopLoss: 171595, qty: 10, result: 610,
  setup: 'Rompimento',
};
const codigos = (t) => analyzeShadowForTradeCF(t, [], []).patterns.map((p) => p.code);

describe('CLEAN_EXECUTION — presença de sinal bom, não ausência de sinal ruim', () => {
  it('trade limpo com setup declarado → recebe o selo', () => {
    expect(codigos(base)).toContain('CLEAN_EXECUTION');
  });

  it('o trade real de +R$ 610, que estourou o RO → perde o selo', () => {
    const real = {
      ...base,
      compliance: { roStatus: 'FORA_DO_PLANO', rrStatus: 'NAO_CONFORME' },
      redFlags: [{ type: 'RISCO_ACIMA_PERMITIDO' }, { type: 'RR_ABAIXO_MINIMO' }],
    };
    expect(codigos(real)).not.toContain('CLEAN_EXECUTION');
  });

  it('red flag vigente qualquer → perde o selo', () => {
    expect(codigos({ ...base, redFlags: [{ type: 'RISCO_ACIMA_PERMITIDO' }] })).not.toContain('CLEAN_EXECUTION');
  });

  it('violação REVOGADA (R:R abaixo do alvo) NÃO tira o selo — não é mais violação', () => {
    expect(codigos({ ...base, redFlags: [{ type: 'RR_ABAIXO_MINIMO' }] })).toContain('CLEAN_EXECUTION');
  });

  it('violação limpa pelo mentor não tira o selo', () => {
    const t = {
      ...base,
      redFlags: [{ type: 'RISCO_ACIMA_PERMITIDO' }],
      mentorClearedViolations: ['RISCO_ACIMA_PERMITIDO'],
    };
    expect(codigos(t)).toContain('CLEAN_EXECUTION');
  });
});

describe('UNDECLARED_MODEL — acertar sem saber por quê não é execução limpa', () => {
  for (const setup of ['Indefinido', 'indefinido', '', '  ', 'N/A', '-']) {
    it(`setup ${JSON.stringify(setup)} → emite UNDECLARED_MODEL e bloqueia o elogio`, () => {
      const c = codigos({ ...base, setup });
      expect(c).toContain('UNDECLARED_MODEL');
      expect(c).not.toContain('CLEAN_EXECUTION');
    });
  }

  it('setup declarado de verdade não emite nada disso', () => {
    expect(codigos(base)).not.toContain('UNDECLARED_MODEL');
  });
});

describe('SIZING_DISCIPLINE — não elogia condução em trade que estourou o RO', () => {
  const comAumento = {
    ...base,
    planId: 'p1',
    _partials: [
      { type: 'ENTRY', price: 171915, qty: 5, dateTime: '2026-08-20T11:46:45', seq: 1 },
      { type: 'ENTRY', price: 171770, qty: 5, dateTime: '2026-08-20T11:47:30', seq: 2 },
    ],
  };

  it('trade com violação de RO → nenhum SIZING_DISCIPLINE', () => {
    const eventos = detectExecutionEvents(
      { ...comAumento, compliance: { roStatus: 'FORA_DO_PLANO' }, redFlags: [{ type: 'RISCO_ACIMA_PERMITIDO' }] },
      [],
      { riskPerOperation: 0.84, pl: 30000 },
    );
    expect(eventos.map((e) => e.type)).not.toContain('SIZING_DISCIPLINE');
  });
});
