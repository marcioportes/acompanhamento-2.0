/**
 * stopPendencia475.test.js — issue #475
 *
 * Trade protegido pelas ordens, mas sem stop inicial comprovável (stop arrastado para o
 * ganho, só de ganho, proteção parcial) → pendência STOP_INICIAL_A_INFORMAR, não a
 * violação TRADE_SEM_STOP. O caso real: 24/09/2026, WINV26, venda de 10 em duas pernas —
 * o painel de ordens dizia "Protegido o tempo todo" e a violação dizia "Trade sem stop".
 *
 * Ordens e trade vêm do export real (fixture do #463), gravados como o import grava.
 * Roda igual em TZ=UTC e TZ=America/Sao_Paulo.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { montarDia, fakeDb } from '../helpers/gravadoDoImport';
import { positionWasProtected, protectionTimeline } from '../../utils/executionBehaviorEngine';
import { stopFlagOf, STOP_A_INFORMAR_MESSAGE } from '../../utils/stopFlag';
import { generateComplianceRedFlags, RED_FLAG_TYPES, redFlagLabel } from '../../utils/compliance';
import {
  effectiveRedFlags, hasEffectiveRedFlags, pendingRedFlags,
} from '../../utils/violationFilter';
import { calculateComplianceRate } from '../../utils/dashboardMetrics';
import { computeCycleBasedComplianceRate } from '../../utils/maturityEngine/computeCycleBasedComplianceRate';
import { flagsHoje } from '../../utils/mentorRiskRadar';
import { runStopFlagRefresh, formatarRelatorio } from '../../../scripts/lib/stopPendencia475.mjs';

const { refreshStopFlag } = require('../../../functions/trades/refreshStopFlag');
const { isStopFlag } = require('../../../functions/shared/stopFlag');
const serverRate = require('../../../functions/maturity/computeCycleBasedComplianceRate');
const serverVf = require('../../../functions/maturity/violationFilter');

const NOW = '2026-09-26T12:00:00.000Z';
const dia = montarDia('2026-09-24-ordens.csv', 'batch-2409');
const alvoId = Object.keys(dia.trades).find((id) => dia.trades[id].entryTime.startsWith('2026-09-24T15:52:21'));
const alvo = { ...dia.trades[alvoId], id: alvoId };
const ordens = Object.values(dia.orders).filter((o) => o.correlatedTradeId === alvoId);
const noStop = (result) => ({
  type: 'TRADE_SEM_STOP',
  message: result > 0 ? 'Trade sem stop loss definido — risco não mensurado (win sem stop)' : 'Trade sem stop loss definido',
  timestamp: NOW,
});
const PENDENCIA = { type: 'STOP_INICIAL_A_INFORMAR', message: STOP_A_INFORMAR_MESSAGE, timestamp: NOW };
const semRisco = { riskPercent: null, compliance: { roStatus: 'CONFORME' } };

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(NOW)); });
afterEach(() => vi.useRealTimers());

describe('#475 · 24/09/2026 — protegido, stop inicial não comprovável', () => {
  it('o fixture é o trade do issue: SHORT 10, sem stopLoss, em ganho', () => {
    expect(alvo.side).toBe('SHORT');
    expect(alvo.qty).toBe(10);
    expect(alvo.stopLoss ?? null).toBeNull();
    expect(alvo.result).toBeGreaterThan(0);
  });

  it('as ordens mostram proteção — a mesma leitura do painel ("Protegido o tempo todo")', () => {
    expect(positionWasProtected(alvo, ordens)).toBe(true);
    expect(protectionTimeline(alvo, ordens).windows).toEqual([]);
  });

  it('→ pendência, não violação', () => {
    const flags = generateComplianceRedFlags(alvo, {}, semRisco, { protegido: positionWasProtected(alvo, ordens) });
    expect(flags).toEqual([PENDENCIA]);
    expect(PENDENCIA.message).toBe('Stop movido durante a operação — informe o stop inicial');
    expect(RED_FLAG_TYPES.STOP_A_INFORMAR).toBe('STOP_INICIAL_A_INFORMAR');
    expect(redFlagLabel('STOP_INICIAL_A_INFORMAR')).toBe('Stop inicial a informar');
  });

  it('servidor, no fechamento do lote: TRADE_SEM_STOP gravado vira pendência (mesma regra)', async () => {
    const trades = { ...dia.trades, [alvoId]: { ...dia.trades[alvoId], redFlags: [noStop(1)], hasRedFlags: true } };
    const db = fakeDb({ trades, orders: dia.orders });
    const r = await refreshStopFlag(db, alvoId);
    expect(r.status).toBe('ATUALIZADO');
    expect(db.escritas).toEqual([{ colecao: 'trades', id: alvoId, patch: { redFlags: [PENDENCIA], hasRedFlags: false } }]);
  });

  it('aluno informa o stop inicial → nenhum aviso; o risco volta a ser medido', () => {
    const informado = { ...alvo, stopLoss: 185400 };
    expect(generateComplianceRedFlags(informado, {}, semRisco, { protegido: true })).toEqual([]);
  });
});

describe('#475 · os outros casos ficam como estavam', () => {
  it('mesmo trade sem nenhuma proteção nas ordens (só entradas e saídas no ganho) → violação', () => {
    const semProtecao = ordens.filter((o) => o.side === 'SELL');
    expect(positionWasProtected(alvo, semProtecao)).toBe(false);
    expect(generateComplianceRedFlags(alvo, {}, semRisco, { protegido: false })).toEqual([noStop(1)]);
  });

  it('trade manual (sem ordens) → violação, texto de sempre', () => {
    const manual = { id: 'M1', side: 'LONG', entry: 100, stopLoss: null, result: 50 };
    expect(positionWasProtected(manual, [])).toBe(false);
    expect(generateComplianceRedFlags(manual, {}, semRisco)).toEqual([noStop(50)]);
    expect(generateComplianceRedFlags({ ...manual, result: 0 }, {}, semRisco)).toEqual([noStop(0)]);
  });

  it('loss sem stop → stop implícito, sem aviso, com ou sem proteção', () => {
    expect(stopFlagOf({ ...alvo, result: -200 }, true)).toBeNull();
    expect(stopFlagOf({ ...alvo, result: -200 }, false)).toBeNull();
  });
});

describe('#475 · pendência não é violação em nenhum contador', () => {
  const mk = (id, redFlags) => ({ id, date: '2026-09-24', redFlags });
  const comPendencia = mk('P', [PENDENCIA]);
  const comViolacao = mk('V', [noStop(1)]);

  it('violationFilter (cliente e servidor): fora de effectiveRedFlags, dentro de pendingRedFlags', () => {
    for (const vf of [{ effectiveRedFlags, hasEffectiveRedFlags, pendingRedFlags }, serverVf]) {
      expect(vf.effectiveRedFlags(comPendencia)).toEqual([]);
      expect(vf.hasEffectiveRedFlags(comPendencia)).toBe(false);
      expect(vf.pendingRedFlags(comPendencia)).toEqual([PENDENCIA]);
      expect(vf.hasEffectiveRedFlags(comViolacao)).toBe(true);
    }
  });

  it('taxa de conformidade do dashboard: pendência é conforme', () => {
    expect(calculateComplianceRate([comPendencia, comViolacao])).toEqual({ rate: 50, compliant: 1, total: 2, violations: 1 });
  });

  it('conformidade por ciclo (gates de maturidade), cliente e servidor', () => {
    const trades = Array.from({ length: 20 }, (_, i) => mk(`T${i}`, i < 10 ? [PENDENCIA] : []));
    const plans = [{ id: 'p', adjustmentCycle: 'Mensal' }];
    const args = { trades, plans, now: new Date('2026-09-26T12:00:00Z') };
    expect(computeCycleBasedComplianceRate(args)).toBe(100);
    expect(serverRate.computeCycleBasedComplianceRate(args)).toBe(100);
  });

  it('Torre: flags de hoje não contam a pendência', () => {
    expect(flagsHoje([comPendencia, comViolacao])).toBe(1);
  });
});

describe('#475 · recálculo dos trades já gravados (script, dry-run por padrão)', () => {
  const trades = {
    ...dia.trades,
    [alvoId]: { ...dia.trades[alvoId], redFlags: [noStop(1)] },
    DISC: { ...dia.trades[alvoId], status: 'DISCUSSED', redFlags: [noStop(1)] },
  };

  it('dry-run: aponta o 24/09, preserva o discutido, zero escritas', async () => {
    const db = fakeDb({ trades, orders: dia.orders });
    const r = await runStopFlagRefresh(db, { student: 'aluno-1' }, { refreshStopFlag, isStopFlag });
    const l = r.linhas.find((x) => x.tradeId === alvoId);
    expect(l).toMatchObject({ status: 'MUDARIA', antes: 'TRADE_SEM_STOP', depois: 'STOP_INICIAL_A_INFORMAR' });
    expect(r.linhas.find((x) => x.tradeId === 'DISC').status).toBe('PRESERVADO');
    expect(db.escritas).toHaveLength(0);
    const txt = formatarRelatorio(r);
    expect(txt).toContain('DRY-RUN');
    expect(txt).toContain('24/09/2026');
  });

  it('--apply grava só redFlags/hasRedFlags do trade não discutido', async () => {
    const db = fakeDb({ trades, orders: dia.orders });
    await runStopFlagRefresh(db, { student: 'aluno-1', apply: true }, { refreshStopFlag, isStopFlag });
    expect(db.escritas).toEqual([{ colecao: 'trades', id: alvoId, patch: { redFlags: [PENDENCIA], hasRedFlags: false } }]);
  });
});
