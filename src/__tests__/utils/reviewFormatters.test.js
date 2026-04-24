/**
 * reviewFormatters.test.js
 * @description Testes unitários dos helpers compartilhados extraídos de
 *              WeeklyReviewPage.jsx (issue #119 task 28).
 */

import { describe, it, expect } from 'vitest';
import {
  fmtMoney,
  fmtPct,
  fmtNum,
  fmtTime,
  fmtDateBR,
  deltaText,
  tradeDate,
  buildVisibleRows,
  getPreviousReview,
  statusBadge,
  DAY_GROUP_THRESHOLD,
} from '../../utils/reviewFormatters';

describe('reviewFormatters — formatadores', () => {
  it('fmtMoney formata USD em pt-BR', () => {
    expect(fmtMoney(1234.5, 'USD')).toContain('1.234,50');
  });
  it('fmtMoney retorna — para NaN/undefined', () => {
    expect(fmtMoney(undefined)).toBe('—');
    expect(fmtMoney(NaN)).toBe('—');
    expect(fmtMoney('abc')).toBe('—');
  });
  it('fmtPct adiciona 1 casa decimal e %', () => {
    expect(fmtPct(58.3)).toBe('58.3%');
    expect(fmtPct(undefined)).toBe('—');
    expect(fmtPct(NaN)).toBe('—');
  });
  it('fmtNum respeita digits', () => {
    expect(fmtNum(1.2345, 2)).toBe('1.23');
    expect(fmtNum(1.2345, 4)).toBe('1.2345');
    expect(fmtNum('x')).toBe('—');
  });
  it('fmtTime formata HH:MM BR', () => {
    // 2026-04-24T09:05:00-03:00 → 09:05
    expect(fmtTime('2026-04-24T09:05:00-03:00')).toMatch(/^\d{2}:\d{2}$/);
    expect(fmtTime(null)).toBe('');
    expect(fmtTime('')).toBe('');
  });
  it('fmtDateBR converte YYYY-MM-DD → DD/MM/YYYY', () => {
    expect(fmtDateBR('2026-04-24')).toBe('24/04/2026');
    expect(fmtDateBR('2026-12-01')).toBe('01/12/2026');
    expect(fmtDateBR(null)).toBe('—');
    expect(fmtDateBR('invalid')).toBe('invalid');
  });
});

describe('reviewFormatters — deltaText', () => {
  it('retorna null quando previous não é número finito', () => {
    expect(deltaText(10, undefined)).toBeNull();
    expect(deltaText(10, NaN)).toBeNull();
    expect(deltaText(10, 'abc')).toBeNull();
  });
  it('retorna "=" + slate quando igual', () => {
    const r = deltaText(5, 5);
    expect(r.text).toBe('=');
    expect(r.cls).toMatch(/slate/);
  });
  it('retorna sinal + verde quando subiu (default)', () => {
    const r = deltaText(10, 7, (d) => d.toFixed(1));
    expect(r.text).toBe('+3.0');
    expect(r.cls).toMatch(/emerald/);
  });
  it('retorna sinal + vermelho quando desceu (default)', () => {
    const r = deltaText(5, 7, (d) => d.toFixed(1));
    expect(r.text).toBe('-2.0');
    expect(r.cls).toMatch(/red/);
  });
  it('invertColors: subiu → vermelho (útil para CV onde menor = melhor)', () => {
    const r = deltaText(2, 1, (d) => d.toFixed(2), true);
    expect(r.text).toBe('+1.00');
    expect(r.cls).toMatch(/red/);
  });
  it('invertColors: desceu → verde', () => {
    const r = deltaText(1, 2, (d) => d.toFixed(2), true);
    expect(r.cls).toMatch(/emerald/);
  });
});

describe('reviewFormatters — tradeDate', () => {
  it('extrai data de entryTime ISO', () => {
    expect(tradeDate({ entryTime: '2026-04-24T09:05:00-03:00' })).toBe('2026-04-24');
  });
  it('usa campo date se entryTime ausente', () => {
    expect(tradeDate({ date: '2026-04-24' })).toBe('2026-04-24');
  });
  it('retorna null quando nada', () => {
    expect(tradeDate({})).toBeNull();
    expect(tradeDate(null)).toBeNull();
  });
});

describe('reviewFormatters — buildVisibleRows', () => {
  it('retorna [] para input vazio', () => {
    expect(buildVisibleRows([], new Set())).toEqual([]);
    expect(buildVisibleRows(null, new Set())).toEqual([]);
  });
  it('dias com ≤ DAY_GROUP_THRESHOLD trades → flat', () => {
    expect(DAY_GROUP_THRESHOLD).toBe(2);
    const trades = [
      { entryTime: '2026-04-24T09:00:00-03:00', pnl: 10 },
      { entryTime: '2026-04-24T10:00:00-03:00', pnl: -5 },
    ];
    const rows = buildVisibleRows(trades, new Set());
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.type === 'trade')).toBe(true);
  });
  it('dias > threshold colapsam em daySummary por default', () => {
    const trades = [
      { entryTime: '2026-04-24T09:00:00-03:00', pnl: 10 },
      { entryTime: '2026-04-24T10:00:00-03:00', pnl: -5 },
      { entryTime: '2026-04-24T11:00:00-03:00', pnl: 20 },
    ];
    const rows = buildVisibleRows(trades, new Set());
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('daySummary');
    expect(rows[0].count).toBe(3);
    expect(rows[0].pl).toBe(25);
    expect(rows[0].expanded).toBe(false);
  });
  it('dia expandido → resumo + trades', () => {
    const trades = [
      { entryTime: '2026-04-24T09:00:00-03:00', pnl: 10 },
      { entryTime: '2026-04-24T10:00:00-03:00', pnl: -5 },
      { entryTime: '2026-04-24T11:00:00-03:00', pnl: 20 },
    ];
    const rows = buildVisibleRows(trades, new Set(['2026-04-24']));
    expect(rows).toHaveLength(4);
    expect(rows[0].type).toBe('daySummary');
    expect(rows[0].expanded).toBe(true);
    expect(rows.slice(1).every((r) => r.type === 'trade')).toBe(true);
  });
  it('múltiplos dias ordenados desc', () => {
    const trades = [
      { entryTime: '2026-04-22T09:00:00-03:00', pnl: 10 },
      { entryTime: '2026-04-24T09:00:00-03:00', pnl: 20 },
    ];
    const rows = buildVisibleRows(trades, new Set());
    expect(rows[0].data.entryTime).toMatch(/2026-04-24/);
    expect(rows[1].data.entryTime).toMatch(/2026-04-22/);
  });
});

describe('reviewFormatters — getPreviousReview', () => {
  const r1 = { id: 'r1', weekStart: '2026-04-01', planId: 'plan-A' };
  const r2 = { id: 'r2', weekStart: '2026-04-08', planId: 'plan-A' };
  const r3 = { id: 'r3', weekStart: '2026-04-15', planId: 'plan-A' };
  const r4 = { id: 'r4', weekStart: '2026-04-08', planId: 'plan-B' };
  const all = [r3, r2, r1, r4]; // ordem desc típica

  it('retorna null se currentReview não informado', () => {
    expect(getPreviousReview(all, null)).toBeNull();
  });
  it('retorna null se planId não derivável', () => {
    expect(getPreviousReview(all, { id: 'x', weekStart: '2026-04-10' })).toBeNull();
  });
  it('retorna review imediatamente anterior do mesmo plano', () => {
    const prev = getPreviousReview(all, r3);
    expect(prev?.id).toBe('r2');
  });
  it('ignora reviews de outros planos', () => {
    const prev = getPreviousReview(all, r2); // plan-A, weekStart 04-08
    expect(prev?.id).toBe('r1'); // r4 é plan-B mesmo weekStart 04-08, mas não bate planId
  });
  it('retorna null quando é a primeira revisão do plano', () => {
    const prev = getPreviousReview(all, r1);
    expect(prev).toBeNull();
  });
  it('lê planId de frozenSnapshot.planContext.planId quando top-level ausente', () => {
    const current = { id: 'rx', weekStart: '2026-04-22', frozenSnapshot: { planContext: { planId: 'plan-A' } } };
    const prev = getPreviousReview(all, current);
    expect(prev?.id).toBe('r3');
  });
  it('aceita planId override explícito', () => {
    const current = { id: 'rx', weekStart: '2026-04-22' };
    const prev = getPreviousReview(all, current, 'plan-A');
    expect(prev?.id).toBe('r3');
  });
});

describe('reviewFormatters — statusBadge', () => {
  it('mapeia os 3 estados', () => {
    expect(statusBadge('DRAFT').label).toBe('aberta');
    expect(statusBadge('CLOSED').label).toBe('publicada');
    expect(statusBadge('ARCHIVED').label).toBe('arquivada');
  });
  it('fallback para status desconhecido', () => {
    expect(statusBadge('WEIRD').label).toBe('WEIRD');
    expect(statusBadge(null).label).toBe('—');
  });
});
