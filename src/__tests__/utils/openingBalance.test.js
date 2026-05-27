/**
 * openingBalance.test.js
 * @description Testes do saldo de abertura com carry-over entre ciclos (bug 2 — issue #267).
 *
 * Cobre:
 *  - todo histórico (janela null) → aporte inicial.
 *  - ciclo único fechado → patrimônio de fechamento do ciclo anterior.
 *  - sub-período (semana/mês) → abertura do ciclo + Σ trades do ciclo antes do período.
 *  - ciclo aberto / múltiplos ciclos não fechados (gap sum).
 *  - ajuste não-trade (aporte/saque do ritual de fechamento) via rollPL.
 *  - exemplo numérico canônico dos 23k (memória de cálculo).
 */

import { describe, it, expect } from 'vitest';
import {
  computeOpeningBalance,
  rollPL,
  closureAdjustmentDelta,
  toISODay,
} from '../../utils/openingBalance.js';

// Helpers de fixture
const trade = (date, result) => ({ date, result });
const closedClosure = (cycleStart, cycleEnd, plInicial, saldoFinal, adjustment = null) => ({
  status: 'CLOSED',
  cycleStart,
  cycleEnd,
  cycleBaseline: { plInicial, saldoFinal, plFinal: plInicial + saldoFinal },
  forward: adjustment != null ? { planAdjustment: { changed: true, newPl: adjustment } } : null,
});

describe('toISODay', () => {
  it('normaliza Date para YYYY-MM-DD local', () => {
    expect(toISODay(new Date(2026, 3, 1))).toBe('2026-04-01');
  });
  it('extrai YYYY-MM-DD de string ISO com hora', () => {
    expect(toISODay('2026-04-01T13:30:00Z')).toBe('2026-04-01');
  });
  it('retorna null para entrada inválida', () => {
    expect(toISODay(null)).toBe(null);
    expect(toISODay('lixo')).toBe(null);
  });
});

describe('rollPL', () => {
  it('usa plFinal quando não há ajuste', () => {
    expect(rollPL(closedClosure('2026-03-01', '2026-03-31', 21000, 2000))).toBe(23000);
  });
  it('prioriza ajuste explícito do aluno (newPl > 0)', () => {
    expect(rollPL(closedClosure('2026-03-01', '2026-03-31', 21000, 2000, 18000))).toBe(18000);
  });
  it('fallback pre-C3 reconstrói do snapshot (plStart + result)', () => {
    const c = { status: 'CLOSED', snapshot: { plStart: 10000, result: 500 } };
    expect(rollPL(c)).toBe(10500);
  });
});

describe('closureAdjustmentDelta', () => {
  it('zero quando não há ajuste', () => {
    expect(closureAdjustmentDelta(closedClosure('2026-03-01', '2026-03-31', 21000, 2000))).toBe(0);
  });
  it('saque manual no fechamento gera delta negativo', () => {
    // plFinal natural 23000, aluno sacou para 18000 → delta -5000
    expect(closureAdjustmentDelta(closedClosure('2026-03-01', '2026-03-31', 21000, 2000, 18000))).toBe(-5000);
  });
});

describe('computeOpeningBalance', () => {
  it('todo histórico (janela null) → aporte inicial', () => {
    const opening = computeOpeningBalance({
      windowStart: null,
      initialBalance: 20000,
      trades: [trade('2026-02-10', 1000), trade('2026-03-10', 2000)],
      closures: [],
    });
    expect(opening).toBe(20000);
  });

  it('exemplo canônico: abril abre em 23.000 (fechamento de março), não no aporte 20.000', () => {
    // aporte 20k; Fev +1k→21k; Mar +2k→23k; abril deve abrir em 23k.
    const trades = [
      trade('2026-02-10', 600), trade('2026-02-20', 400), // Fev = +1000
      trade('2026-03-05', 1500), trade('2026-03-25', 500), // Mar = +2000
      trade('2026-04-03', -500), trade('2026-04-15', 1500), // abril (dentro da janela)
    ];
    const closures = [
      closedClosure('2026-02-01', '2026-02-28', 20000, 1000),
      closedClosure('2026-03-01', '2026-03-31', 21000, 2000),
    ];
    const opening = computeOpeningBalance({
      windowStart: '2026-04-01',
      initialBalance: 20000,
      trades,
      closures,
    });
    expect(opening).toBe(23000);
  });

  it('sub-período: semana 2 de abril abre em 23.000 + Σ trades de abril antes da semana', () => {
    const trades = [
      trade('2026-02-10', 1000),
      trade('2026-03-10', 2000),
      trade('2026-04-03', -500), // semana 1 de abril
      trade('2026-04-15', 1500), // semana 3 (dentro da janela, não conta)
    ];
    const closures = [
      closedClosure('2026-02-01', '2026-02-28', 20000, 1000),
      closedClosure('2026-03-01', '2026-03-31', 21000, 2000),
    ];
    // janela = a partir de 2026-04-13 (semana 3) → abertura = 23000 + (-500)
    const opening = computeOpeningBalance({
      windowStart: '2026-04-13',
      initialBalance: 20000,
      trades,
      closures,
    });
    expect(opening).toBe(22500);
  });

  it('ciclo aberto sem fechamentos prévios → aporte + Σ trades antes da janela', () => {
    const trades = [trade('2026-04-05', 300), trade('2026-05-02', -200)];
    const opening = computeOpeningBalance({
      windowStart: '2026-05-01',
      initialBalance: 20000,
      trades,
      closures: [],
    });
    expect(opening).toBe(20300); // só os trades de abril contam
  });

  it('múltiplos ciclos não fechados: maio abre somando trades de abril (gap)', () => {
    // Fev+Mar fechados (chegam a 23k). Abril NÃO fechado. Viewing maio → abre em 23k + Σ abril.
    // O plFinal da closure NÃO é somado (só ajuste não-trade); o ganho histórico vem dos trades.
    const trades = [
      trade('2026-02-15', 1000), // fevereiro
      trade('2026-03-10', 2000), // março
      trade('2026-04-08', 800),  // abril não fechado → entra no carry de maio
      trade('2026-04-22', -300),
      trade('2026-05-05', 100),  // maio (janela) → não conta
    ];
    const closures = [closedClosure('2026-03-01', '2026-03-31', 21000, 2000)];
    const opening = computeOpeningBalance({
      windowStart: '2026-05-01',
      initialBalance: 20000,
      trades,
      closures,
    });
    expect(opening).toBe(23500); // 20000 + 1000 + 2000 + 800 - 300
  });

  it('captura saque manual aplicado no fechamento (ajuste não-trade)', () => {
    // Mar fecha natural em 23k mas aluno saca para 18k. Abril abre em 18k.
    const trades = [trade('2026-03-10', 2000), trade('2026-04-03', 500)];
    const closures = [closedClosure('2026-03-01', '2026-03-31', 21000, 2000, 18000)];
    const opening = computeOpeningBalance({
      windowStart: '2026-04-01',
      initialBalance: 21000, // aporte já refletindo fevereiro fechado
      trades,
      closures,
    });
    // base 21000 + Σ trades < abril (2000) + ajuste (18000 - 23000 = -5000) = 18000
    expect(opening).toBe(18000);
  });

  it('ignora closures REOPENED (não selados)', () => {
    const reopened = { ...closedClosure('2026-03-01', '2026-03-31', 21000, 2000, 18000), status: 'REOPENED' };
    const opening = computeOpeningBalance({
      windowStart: '2026-04-01',
      initialBalance: 20000,
      trades: [trade('2026-03-10', 2000)],
      closures: [reopened],
    });
    expect(opening).toBe(22000); // sem ajuste do reopened: 20000 + 2000
  });

  it('trade exatamente no início da janela NÃO entra na abertura (vai pra curva)', () => {
    const opening = computeOpeningBalance({
      windowStart: '2026-04-01',
      initialBalance: 20000,
      trades: [trade('2026-04-01', 999)],
      closures: [],
    });
    expect(opening).toBe(20000);
  });
});
