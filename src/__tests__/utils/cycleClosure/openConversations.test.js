import { describe, it, expect } from 'vitest';
import { listOpenConversations, fmtDayMonth } from '../../../utils/cycleClosure/openConversations';

const scope = { planId: 'p1', cycleStart: '2026-10-01', cycleEnd: '2026-10-31' };
const t = (id, date, status, planId = 'p1') => ({ id, date, status, planId, ticker: 'WINZ26' });

describe('#497 — listOpenConversations', () => {
  it('pega Revisado e Dúvida do ciclo, do mais recente para o mais antigo', () => {
    const out = listOpenConversations([
      t('a', '2026-10-28', 'REVIEWED'),
      t('b', '2026-10-30', 'REVIEWED'),
      t('c', '2026-10-29', 'QUESTION'),
    ], scope);
    expect(out.map((x) => x.id)).toEqual(['b', 'c', 'a']);
  });
  it('deixa de fora OPEN, CLOSED e DISCUSSED', () => {
    const out = listOpenConversations([
      t('a', '2026-10-10', 'OPEN'), t('b', '2026-10-10', 'CLOSED'), t('c', '2026-10-10', 'DISCUSSED'),
    ], scope);
    expect(out).toEqual([]);
  });
  it('respeita as bordas do ciclo e o plano', () => {
    const out = listOpenConversations([
      t('in1', '2026-10-01', 'REVIEWED'), t('in2', '2026-10-31', 'REVIEWED'),
      t('out1', '2026-09-30', 'REVIEWED'), t('out2', '2026-11-01', 'REVIEWED'),
      t('outro', '2026-10-15', 'REVIEWED', 'p2'),
    ], scope);
    expect(out.map((x) => x.id).sort()).toEqual(['in1', 'in2']);
  });
  it('entrada inválida devolve lista vazia', () => {
    expect(listOpenConversations(null, scope)).toEqual([]);
    expect(listOpenConversations([t('a', '2026-10-10', 'REVIEWED')], {})).toEqual([]);
    expect(listOpenConversations([null, { id: 'x', planId: 'p1', status: 'REVIEWED' }], scope)).toEqual([]);
  });
  it('fmtDayMonth formata DD/MM', () => {
    expect(fmtDayMonth('2026-10-30')).toBe('30/10');
    expect(fmtDayMonth(null)).toBe('—');
  });
});
