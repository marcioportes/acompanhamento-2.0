/**
 * planCoverage.test.js
 * @description Gate "período sem plano vigente" — operações fora da janela
 *   temporal dos planos da conta viram gap e bloqueiam o submit da
 *   ConversationalReview (issue #156 Fase C).
 */

import { describe, it, expect } from 'vitest';
import {
  detectCoverageGap,
  planCoversDate,
  getOperationDateMs,
} from '../../utils/planCoverage';

const plan = (overrides = {}) => ({
  id: 'plan-1',
  accountId: 'acc-1',
  active: true,
  createdAt: '2026-02-01T00:00:00Z',
  ...overrides,
});

const op = (overrides = {}) => ({
  operationId: 'op-1',
  instrument: 'MNQH6',
  side: 'LONG',
  totalQty: 1,
  entryTime: '2026-02-10T14:00:00Z',
  ...overrides,
});

describe('planCoverage — getOperationDateMs', () => {
  it('extrai ms de entryTime', () => {
    const ms = getOperationDateMs(op({ entryTime: '2026-02-10T14:00:00Z' }));
    expect(ms).toBe(Date.parse('2026-02-10T14:00:00Z'));
  });

  it('fallback para entryOrders[0].filledAt quando entryTime ausente', () => {
    const ms = getOperationDateMs({
      operationId: 'x',
      entryOrders: [{ filledAt: '2026-01-05T10:00:00Z' }],
    });
    expect(ms).toBe(Date.parse('2026-01-05T10:00:00Z'));
  });

  it('retorna null quando nenhuma data é parseável', () => {
    const ms = getOperationDateMs({ operationId: 'x', entryTime: null });
    expect(ms).toBeNull();
  });
});

describe('planCoverage — planCoversDate', () => {
  it('cobre quando plano é ativo e opDate >= createdAt', () => {
    const p = plan({ createdAt: '2026-01-01T00:00:00Z' });
    const opMs = Date.parse('2026-02-10T14:00:00Z');
    expect(planCoversDate(p, opMs)).toBe(true);
  });

  it('NÃO cobre quando opDate < createdAt (antes do plano existir)', () => {
    const p = plan({ createdAt: '2026-03-01T00:00:00Z' });
    const opMs = Date.parse('2026-02-10T14:00:00Z');
    expect(planCoversDate(p, opMs)).toBe(false);
  });

  it('NÃO cobre quando plano é inactive (active: false)', () => {
    const p = plan({ active: false });
    const opMs = Date.parse('2026-02-10T14:00:00Z');
    expect(planCoversDate(p, opMs)).toBe(false);
  });

  it('NÃO cobre quando accountId não bate', () => {
    const p = plan({ accountId: 'acc-other' });
    const opMs = Date.parse('2026-02-10T14:00:00Z');
    expect(planCoversDate(p, opMs, 'acc-1')).toBe(false);
  });

  it('respeita closedAt — op após fechamento não é coberta', () => {
    const p = plan({
      createdAt: '2026-01-01T00:00:00Z',
      closedAt: '2026-02-01T00:00:00Z',
    });
    const opMs = Date.parse('2026-02-10T14:00:00Z');
    expect(planCoversDate(p, opMs)).toBe(false);
  });

  it('sem createdAt — assume fail-open (cobre qualquer data)', () => {
    const p = plan({ createdAt: null });
    const opMs = Date.parse('2026-01-01T00:00:00Z');
    expect(planCoversDate(p, opMs)).toBe(true);
  });
});

describe('planCoverage — detectCoverageGap', () => {
  it('sem gap quando todas as ops caem dentro da janela do único plano', () => {
    const result = detectCoverageGap({
      operations: [op({ entryTime: '2026-02-10T14:00:00Z' })],
      plans: [plan({ createdAt: '2026-02-01T00:00:00Z' })],
      accountId: 'acc-1',
    });
    expect(result.hasCoverageGap).toBe(false);
    expect(result.gapOperations).toEqual([]);
  });

  it('gap quando op é anterior ao único plano da conta', () => {
    const result = detectCoverageGap({
      operations: [op({ entryTime: '2026-01-10T14:00:00Z' })],
      plans: [plan({ createdAt: '2026-02-01T00:00:00Z' })],
      accountId: 'acc-1',
    });
    expect(result.hasCoverageGap).toBe(true);
    expect(result.gapOperations).toHaveLength(1);
    expect(result.gapOperations[0].reason).toMatch(/Data anterior/);
  });

  it('gap quando conta não tem plano algum', () => {
    const result = detectCoverageGap({
      operations: [op()],
      plans: [],
      accountId: 'acc-1',
    });
    expect(result.hasCoverageGap).toBe(true);
    expect(result.gapOperations[0].reason).toMatch(/Nenhum plano/);
  });

  it('múltiplos planos: op coberta por pelo menos um plano → sem gap', () => {
    const result = detectCoverageGap({
      operations: [op({ entryTime: '2026-02-10T14:00:00Z' })],
      plans: [
        plan({ id: 'p1', createdAt: '2026-03-01T00:00:00Z' }),
        plan({ id: 'p2', createdAt: '2026-01-01T00:00:00Z' }),
      ],
      accountId: 'acc-1',
    });
    expect(result.hasCoverageGap).toBe(false);
  });

  it('ignora operações abertas (_isOpen)', () => {
    const result = detectCoverageGap({
      operations: [{ ...op(), _isOpen: true }],
      plans: [],
      accountId: 'acc-1',
    });
    expect(result.hasCoverageGap).toBe(false);
  });

  it('op sem data → fail-open (não flaga gap)', () => {
    const result = detectCoverageGap({
      operations: [{ operationId: 'x', entryTime: null }],
      plans: [],
      accountId: 'acc-1',
    });
    expect(result.hasCoverageGap).toBe(false);
  });

  it('mistura: 2 cobertas + 1 gap → hasCoverageGap true + apenas a gap no array', () => {
    const result = detectCoverageGap({
      operations: [
        op({ operationId: 'a', entryTime: '2026-02-10T14:00:00Z' }),
        op({ operationId: 'b', entryTime: '2026-01-10T14:00:00Z' }),
        op({ operationId: 'c', entryTime: '2026-02-15T14:00:00Z' }),
      ],
      plans: [plan({ createdAt: '2026-02-01T00:00:00Z' })],
      accountId: 'acc-1',
    });
    expect(result.hasCoverageGap).toBe(true);
    expect(result.gapOperations).toHaveLength(1);
    expect(result.gapOperations[0].operation.operationId).toBe('b');
  });
});
