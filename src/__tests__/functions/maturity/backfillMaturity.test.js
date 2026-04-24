import { describe, it, expect } from 'vitest';
import {
  parseArgs,
  listStudentIds,
  runConcurrent,
} from '../../../../functions/maturity/backfillMaturity';

function makeDocSnap(exists, id) {
  return { exists, id };
}

function makeStudentsDb({ allIds = [], singleExists = true } = {}) {
  return {
    collection(name) {
      if (name !== 'students') throw new Error(`unexpected collection: ${name}`);
      return {
        doc: (docId) => ({
          get: async () => ({ exists: singleExists, id: docId }),
        }),
        get: async () => ({
          docs: allIds.map((id) => makeDocSnap(true, id)),
        }),
      };
    },
  };
}

describe('backfillMaturity.parseArgs', () => {
  it('default → dryRun=false, studentId=null, concurrency=5', () => {
    const r = parseArgs(['node', 'script']);
    expect(r).toEqual({ dryRun: false, studentId: null, concurrency: 5 });
  });

  it('--dry-run flag', () => {
    const r = parseArgs(['node', 'script', '--dry-run']);
    expect(r).toEqual({ dryRun: true, studentId: null, concurrency: 5 });
  });

  it('--student-id=<id> e --concurrency=<N>', () => {
    const r = parseArgs(['node', 'script', '--student-id=abc', '--concurrency=3']);
    expect(r).toEqual({ dryRun: false, studentId: 'abc', concurrency: 3 });
  });

  it('--concurrency=<inválido> → mantém default 5', () => {
    const r = parseArgs(['node', 'script', '--concurrency=foo']);
    expect(r.concurrency).toBe(5);
  });

  it('--concurrency=0 → mantém default 5 (N deve ser > 0)', () => {
    const r = parseArgs(['node', 'script', '--concurrency=0']);
    expect(r.concurrency).toBe(5);
  });

  it('args desconhecidos são ignorados', () => {
    const r = parseArgs(['node', 'script', '--foo=bar', '--dry-run']);
    expect(r).toEqual({ dryRun: true, studentId: null, concurrency: 5 });
  });
});

describe('backfillMaturity.listStudentIds', () => {
  it('filterStudentId com doc existente → retorna [id]', async () => {
    const db = makeStudentsDb({ singleExists: true });
    const r = await listStudentIds(db, 'single');
    expect(r).toEqual(['single']);
  });

  it('filterStudentId com doc ausente → retorna []', async () => {
    const db = makeStudentsDb({ singleExists: false });
    const r = await listStudentIds(db, 'missing');
    expect(r).toEqual([]);
  });

  it('sem filter → lista todos os IDs da collection', async () => {
    const db = makeStudentsDb({ allIds: ['a', 'b', 'c'] });
    const r = await listStudentIds(db, null);
    expect(r).toEqual(['a', 'b', 'c']);
  });
});

describe('backfillMaturity.runConcurrent', () => {
  it('preserva ordem dos resultados mesmo com concorrência', async () => {
    const r = await runConcurrent([1, 2, 3, 4], 2, async (x) => x * 10);
    expect(r).toEqual([10, 20, 30, 40]);
  });

  it('concurrency=1 → execução sequencial', async () => {
    const order = [];
    const handler = async (x) => {
      order.push(x);
      return x;
    };
    await runConcurrent(['a', 'b', 'c'], 1, handler);
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('items vazio → retorna []', async () => {
    const r = await runConcurrent([], 5, async (x) => x);
    expect(r).toEqual([]);
  });

  it('concurrency > items.length → roda OK, sem travar', async () => {
    const r = await runConcurrent([1, 2], 10, async (x) => x + 100);
    expect(r).toEqual([101, 102]);
  });

  it('concurrency=0 → clampado para >=1 (não trava)', async () => {
    const r = await runConcurrent([1, 2], 0, async (x) => x);
    expect(r).toEqual([1, 2]);
  });
});
