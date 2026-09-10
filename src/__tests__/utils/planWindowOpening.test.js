/**
 * planWindowOpening.test.js — issue #432
 *
 * A ancora da janela do painel Financeiro. O defeito que estes testes travam foi
 * cometido e pego na tela: ancorar em `account.initialBalance` mostrou
 * "PL inicial: -R$ 673,67" ao lado de um card de plano dizendo R$ 99.546,96.
 * initialBalance e o deposito na CORRETORA; plan.pl e o capital ALOCADO ao plano.
 */

import { describe, it, expect } from 'vitest';
import {
  computePlanWindowOpening,
  resolveCycleInitialPl,
  findCycleClosure,
  earliestClosure,
} from '../../utils/planBalance.js';

const plano = { id: 'p1', pl: 100000 };
const trade = (date, result, planId = 'p1') => ({ planId, date, result });
const fechamento = (cycleStart, plInicial, status = 'CLOSED', planId = 'p1') => ({
  planId, cycleStart, status, cycleBaseline: { plInicial },
});

describe('resolveCycleInitialPl', () => {
  it('fechamento manda sobre plan.pl — plan.pl e o capital do ciclo CORRENTE', () => {
    expect(resolveCycleInitialPl(fechamento('2026-07-01', 42500), plano)).toBe(42500);
  });

  it('cai em snapshot.plStart nos closures pre-C3 (sem cycleBaseline)', () => {
    const antigo = { planId: 'p1', cycleStart: '2026-07-01', status: 'CLOSED', snapshot: { plStart: 41200 } };
    expect(resolveCycleInitialPl(antigo, plano)).toBe(41200);
  });

  it('sem fechamento e plan.pl — o ciclo aberto', () => {
    expect(resolveCycleInitialPl(null, plano)).toBe(100000);
  });

  it('plano sem pl vale zero, nao NaN', () => {
    expect(resolveCycleInitialPl(null, {})).toBe(0);
    expect(resolveCycleInitialPl(null, null)).toBe(0);
  });

  it('baseline zero ou negativo nao sequestra a leitura', () => {
    expect(resolveCycleInitialPl(fechamento('2026-07-01', 0), plano)).toBe(100000);
    expect(resolveCycleInitialPl(fechamento('2026-07-01', -5), plano)).toBe(100000);
  });
});

describe('findCycleClosure / earliestClosure', () => {
  const closures = [
    fechamento('2026-08-01', 42500),
    fechamento('2026-06-01', 40000),
    fechamento('2026-07-01', 41200),
    fechamento('2026-07-01', 999, 'CLOSED', 'outro-plano'),
  ];

  it('acha o fechamento do ciclo daquele plano', () => {
    expect(findCycleClosure(closures, 'p1', '2026-07-01').cycleBaseline.plInicial).toBe(41200);
  });

  it('nao confunde plano', () => {
    expect(findCycleClosure(closures, 'p2', '2026-07-01')).toBeNull();
  });

  it('aceita REOPENED — ciclo reaberto ainda tem baseline valido', () => {
    const reaberto = [fechamento('2026-07-01', 41200, 'REOPENED')];
    expect(findCycleClosure(reaberto, 'p1', '2026-07-01')).not.toBeNull();
  });

  it('ignora status desconhecido', () => {
    expect(findCycleClosure([fechamento('2026-07-01', 1, 'DRAFT')], 'p1', '2026-07-01')).toBeNull();
  });

  it('earliestClosure pega o mais antigo por cycleStart', () => {
    expect(earliestClosure(closures, 'p1').cycleStart).toBe('2026-06-01');
  });

  it('degradam para null com entrada vazia', () => {
    expect(findCycleClosure([], 'p1', '2026-07-01')).toBeNull();
    expect(findCycleClosure(null, 'p1', '2026-07-01')).toBeNull();
    expect(earliestClosure([], 'p1')).toBeNull();
  });
});

describe('computePlanWindowOpening', () => {
  it('janela == ciclo: abre no PL inicial daquele ciclo, sem prefixo', () => {
    const abertura = computePlanWindowOpening({
      plan: plano,
      trades: [trade('2026-07-10', -500)],
      closures: [fechamento('2026-07-01', 41200)],
      cycleStartISO: '2026-07-01',
      windowStartISO: '2026-07-01',
    });
    expect(abertura).toBe(41200);
  });

  it('ciclo aberto: abre em plan.pl', () => {
    const abertura = computePlanWindowOpening({
      plan: plano, trades: [], closures: [],
      cycleStartISO: '2026-09-01', windowStartISO: '2026-09-01',
    });
    expect(abertura).toBe(100000);
  });

  it('janela MENOR que o ciclo carrega o que o ciclo ja rendeu ate ali', () => {
    const abertura = computePlanWindowOpening({
      plan: plano,
      trades: [
        trade('2026-09-02', 300),   // dentro do ciclo, antes da janela → entra
        trade('2026-09-05', -100),  // dentro do ciclo, antes da janela → entra
        trade('2026-09-10', 999),   // dentro da janela → NAO entra na abertura
        trade('2026-08-20', 500),   // ciclo anterior → NAO entra
      ],
      closures: [],
      cycleStartISO: '2026-09-01',
      windowStartISO: '2026-09-10',
    });
    expect(abertura).toBe(100200);
  });

  it('ignora trades de outro plano no prefixo', () => {
    const abertura = computePlanWindowOpening({
      plan: plano,
      trades: [trade('2026-09-02', 300), trade('2026-09-02', 9999, 'outro')],
      closures: [],
      cycleStartISO: '2026-09-01',
      windowStartISO: '2026-09-10',
    });
    expect(abertura).toBe(100300);
  });

  it('"Todos os ciclos": ancora no capital com que o plano COMECOU', () => {
    const abertura = computePlanWindowOpening({
      plan: plano,
      trades: [trade('2026-07-10', 500)],
      closures: [fechamento('2026-08-01', 42500), fechamento('2026-06-01', 40000)],
      cycleStartISO: null,
      windowStartISO: null,
    });
    // 40.000 (mais antigo) e nao 100.000 — plan.pl ja incorporou todos os ajustes,
    // e soma-lo aos trades desde o inicio contaria duas vezes.
    expect(abertura).toBe(40000);
  });

  it('sem plano devolve null — o caller cai no caminho por conta', () => {
    expect(computePlanWindowOpening({ plan: null })).toBeNull();
    expect(computePlanWindowOpening({ plan: {} })).toBeNull();
  });

  it('janela anterior ao inicio do ciclo nao inventa prefixo negativo', () => {
    const abertura = computePlanWindowOpening({
      plan: plano, trades: [trade('2026-08-20', -700)], closures: [],
      cycleStartISO: '2026-09-01', windowStartISO: '2026-08-01',
    });
    expect(abertura).toBe(100000);
  });
});
