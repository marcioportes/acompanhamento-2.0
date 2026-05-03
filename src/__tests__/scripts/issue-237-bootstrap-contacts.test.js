/**
 * issue-237-bootstrap-contacts.test.js — issue #237 F2
 *
 * Cobre a lógica pura do bootstrap (parser de Vencimento, parser de linha,
 * agregação processRows) + orquestração runBootstrap com stubs.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  parseUSDate,
  parseVencimento,
  parsePlanilhaRow,
  processRows,
  chunkBatch,
  findDuplicate,
  runBootstrap,
} from '../../../scripts/issue-237-bootstrap-contacts.mjs';

describe('parseUSDate', () => {
  it('MM/DD/YY válido', () => {
    const d = parseUSDate('5/30/26');
    expect(d).toBeInstanceOf(Date);
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(4); // May
    expect(d.getUTCDate()).toBe(30);
  });

  it('formato com mês/dia 1-dígito', () => {
    const d = parseUSDate('3/3/26');
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(2); // March
    expect(d.getUTCDate()).toBe(3);
  });

  it('input inválido → null', () => {
    expect(parseUSDate(null)).toBeNull();
    expect(parseUSDate('')).toBeNull();
    expect(parseUSDate('VIP')).toBeNull();
    expect(parseUSDate('30/5/26')).toBeNull(); // dia 30 não vale como mês
    expect(parseUSDate('13/1/26')).toBeNull(); // mês 13 inválido
    expect(parseUSDate('5/32/26')).toBeNull(); // dia 32 inválido
  });

  it('detecta data inválida (e.g., 2/30/26 não existe)', () => {
    expect(parseUSDate('2/30/26')).toBeNull();
  });
});

describe('parseVencimento', () => {
  it('data MM/DD/YY → import alpha com endsAt', () => {
    const r = parseVencimento('5/30/26');
    expect(r.action).toBe('import');
    expect(r.status).toBe('alpha');
    expect(r.subscription.type).toBe('alpha');
    expect(r.subscription.endsAt).toBeInstanceOf(Date);
    expect(r.subscription.isVIP).toBe(false);
  });

  it('VIP / vip / Vip → import alpha endsAt=null isVIP=true (case-insensitive)', () => {
    for (const variant of ['VIP', 'vip', 'Vip']) {
      const r = parseVencimento(variant);
      expect(r.action).toBe('import');
      expect(r.subscription.endsAt).toBeNull();
      expect(r.subscription.isVIP).toBe(true);
    }
  });

  it('Cancelado / cancelado → skip com reason', () => {
    expect(parseVencimento('Cancelado').action).toBe('skip');
    expect(parseVencimento('Cancelado').reason).toBe('cancelado');
    expect(parseVencimento('cancelado').reason).toBe('cancelado');
  });

  it('null/empty/whitespace → import alpha sem prazo (Daniel Barbosa case)', () => {
    for (const v of [null, '', '   ']) {
      const r = parseVencimento(v);
      expect(r.action).toBe('import');
      expect(r.subscription.endsAt).toBeNull();
      expect(r.subscription.isVIP).toBe(false);
    }
  });

  it('valor não-reconhecido → skip parse_fail', () => {
    expect(parseVencimento('foo').action).toBe('skip');
    expect(parseVencimento('foo').reason).toBe('parse_fail');
  });
});

describe('parsePlanilhaRow', () => {
  it('linha completa BR → import com payload normalizado', () => {
    const r = parsePlanilhaRow({
      numeros: '5521997118900',
      nomes: 'Bruno Albuquerque',
      Vencimento: '3/3/26',
    });
    expect(r.action).toBe('import');
    expect(r.payload.nome).toBe('Bruno Albuquerque');
    expect(r.payload.nameNormalized).toBe('bruno albuquerque');
    expect(r.payload.celular).toBe('+5521997118900');
    expect(r.payload.countryCode).toBe('BR');
    expect(r.payload.email).toBeNull();
    expect(r.payload.status).toBe('alpha');
    expect(r.payload.subscription.type).toBe('alpha');
    expect(r.payload.subscription.endsAt).toBeInstanceOf(Date);
    expect(r.payload.subscription.isVIP).toBe(false);
    expect(r.payload.studentUid).toBeNull();
    expect(r.payload.source).toBe('planilha-bootstrap');
    expect(r.sourceMeta.rawNumeros).toBe('5521997118900');
    expect(r.sourceMeta.rawVencimento).toBe('3/3/26');
  });

  it('VIP → isVIP=true, endsAt=null', () => {
    const r = parsePlanilhaRow({
      numeros: '5511991377588',
      nomes: 'Carlos Y. Mentoria',
      Vencimento: 'VIP',
    });
    expect(r.action).toBe('import');
    expect(r.payload.subscription.isVIP).toBe(true);
    expect(r.payload.subscription.endsAt).toBeNull();
  });

  it('Cancelado → skip cancelado', () => {
    const r = parsePlanilhaRow({
      numeros: '5515991982025',
      nomes: 'Naldo',
      Vencimento: 'Cancelado',
    });
    expect(r.action).toBe('skip');
    expect(r.reason).toBe('cancelado');
  });

  it('Vencimento null (Daniel Barbosa) → import alpha sem endsAt', () => {
    const r = parsePlanilhaRow({
      numeros: '5521964236257',
      nomes: 'Daniel Barbosa',
      Vencimento: null,
    });
    expect(r.action).toBe('import');
    expect(r.payload.subscription.endsAt).toBeNull();
    expect(r.payload.subscription.isVIP).toBe(false);
  });

  it('nome vazio → skip', () => {
    expect(parsePlanilhaRow({ numeros: '5521964236257', nomes: '', Vencimento: 'VIP' }).reason).toBe('nome_vazio');
    expect(parsePlanilhaRow({ numeros: '5521964236257', nomes: null, Vencimento: 'VIP' }).reason).toBe('nome_vazio');
  });

  it('celular vazio → skip', () => {
    expect(parsePlanilhaRow({ numeros: '', nomes: 'Foo', Vencimento: 'VIP' }).reason).toBe('celular_vazio');
    expect(parsePlanilhaRow({ numeros: null, nomes: 'Foo', Vencimento: 'VIP' }).reason).toBe('celular_vazio');
  });

  it('US phone (Florida) com Cancelado → skip cancelado', () => {
    const r = parsePlanilhaRow({
      numeros: '17542446143',
      nomes: '+1 (754) 244-6143',
      Vencimento: 'Cancelado',
    });
    expect(r.action).toBe('skip');
    expect(r.reason).toBe('cancelado');
  });
});

describe('processRows — agregação', () => {
  it('amostra real da planilha (10 linhas) → contagens corretas', () => {
    const rows = [
      { numeros: '5521997118900', nomes: 'Bruno Albuquerque', Vencimento: '3/3/26' },
      { numeros: '5511991377588', nomes: 'Carlos Y. Mentoria', Vencimento: 'VIP' },
      { numeros: '5521964236257', nomes: 'Daniel Barbosa', Vencimento: null },
      { numeros: '5515991982025', nomes: 'Naldo', Vencimento: 'Cancelado' },
      { numeros: '17542446143', nomes: '+1 (754) 244-6143', Vencimento: 'Cancelado' },
      { numeros: '554699171141', nomes: 'JL', Vencimento: '2/21/26' },
      { numeros: '5511965810220', nomes: 'Nono Investidor', Vencimento: 'vip' },
      { numeros: '554391134321', nomes: 'Felipe Guida ', Vencimento: '5/30/26' },
      { numeros: '', nomes: 'fantasma', Vencimento: 'VIP' },
      { numeros: '5521991046176', nomes: 'Jurandyr', Vencimento: '4/1/26' },
    ];
    const { toImport, skipped } = processRows(rows);
    expect(toImport).toHaveLength(7);
    expect(skipped).toHaveLength(3);

    const reasons = skipped.map((s) => s.reason).sort();
    expect(reasons).toEqual(['cancelado', 'cancelado', 'celular_vazio']);

    // VIP detectado em ambos casings
    const vips = toImport.filter((i) => i.payload.subscription.isVIP);
    expect(vips).toHaveLength(2);

    // Vencimento null preservado como alpha sem endsAt
    const daniel = toImport.find((i) => i.payload.nome === 'Daniel Barbosa');
    expect(daniel.payload.subscription.endsAt).toBeNull();
    expect(daniel.payload.subscription.isVIP).toBe(false);

    // Trailing space no nome bruto vira normalizado limpo
    const felipe = toImport.find((i) => i.payload.nameNormalized === 'felipe guida');
    expect(felipe).toBeDefined();
    expect(felipe.payload.nome).toBe('Felipe Guida');
  });

  it('rows vazio/null → resultado vazio', () => {
    expect(processRows([])).toEqual({ toImport: [], skipped: [] });
    expect(processRows(null)).toEqual({ toImport: [], skipped: [] });
  });
});

describe('chunkBatch', () => {
  it('quebra correta', () => {
    expect(chunkBatch([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunkBatch([], 5)).toEqual([]);
  });

  it('valida args', () => {
    expect(() => chunkBatch('not-array', 5)).toThrow();
    expect(() => chunkBatch([], 0)).toThrow();
  });
});

// ── Stubs Firestore para findDuplicate / runBootstrap ─────────

function makeStubDb({ existingByName = {}, existingByCelular = {}, existingByEmail = {} } = {}) {
  const writes = [];
  const docMock = (_id) => ({});
  return {
    _writes: writes,
    collection(_name) {
      const lookup = (field, val) => {
        if (field === 'nameNormalized' && existingByName[val]) {
          return { empty: false, docs: [{ id: existingByName[val], data: () => ({ id: existingByName[val] }) }] };
        }
        if (field === 'celular' && existingByCelular[val]) {
          return { empty: false, docs: [{ id: existingByCelular[val], data: () => ({ id: existingByCelular[val] }) }] };
        }
        if (field === 'email' && existingByEmail[val]) {
          return { empty: false, docs: [{ id: existingByEmail[val], data: () => ({ id: existingByEmail[val] }) }] };
        }
        return { empty: true, docs: [] };
      };
      return {
        where(field, _op, val) {
          return {
            limit() {
              return {
                async get() {
                  return lookup(field, val);
                },
              };
            },
          };
        },
        doc(id) {
          return { _id: id ?? `auto-${writes.length}`, ...docMock(id) };
        },
      };
    },
    batch() {
      const ops = [];
      const self = this;
      return {
        set(docRef, data) {
          ops.push({ docRef, data });
        },
        async commit() {
          for (const op of ops) self._writes.push(op);
        },
      };
    },
  };
}

describe('findDuplicate', () => {
  it('hit em nameNormalized', async () => {
    const db = makeStubDb({ existingByName: { 'bruno albuquerque': 'docA' } });
    const r = await findDuplicate(db, { nameNormalized: 'bruno albuquerque', celular: '+5521000000000', email: null });
    expect(r).not.toBeNull();
    expect(r.id).toBe('docA');
  });

  it('hit em celular quando nome novo', async () => {
    const db = makeStubDb({ existingByCelular: { '+5521997118900': 'docB' } });
    const r = await findDuplicate(db, { nameNormalized: 'novo nome', celular: '+5521997118900', email: null });
    expect(r.id).toBe('docB');
  });

  it('miss → null', async () => {
    const db = makeStubDb();
    const r = await findDuplicate(db, { nameNormalized: 'inexistente', celular: '+5521000000001', email: null });
    expect(r).toBeNull();
  });

  it('email null não dispara query (não cria match falso)', async () => {
    const db = makeStubDb({ existingByEmail: { '': 'falso' } });
    const r = await findDuplicate(db, { nameNormalized: 'a', celular: '+5521000000002', email: null });
    expect(r).toBeNull();
  });
});

describe('runBootstrap — orquestração', () => {
  const sampleRows = [
    { numeros: '5521997118900', nomes: 'Bruno Albuquerque', Vencimento: '3/3/26' },
    { numeros: '5515991982025', nomes: 'Naldo', Vencimento: 'Cancelado' },
    { numeros: '5521964236257', nomes: 'Daniel Barbosa', Vencimento: null },
  ];

  it('dryrun não escreve', async () => {
    const db = makeStubDb();
    const summary = await runBootstrap({
      db,
      readSheet: () => sampleRows,
      filePath: '/fake/test.xlsx',
      mode: 'dryrun',
      timestamp: { now: () => 'NOW' },
    });
    expect(summary.mode).toBe('dryrun');
    expect(summary.rows_count).toBe(3);
    expect(summary.parsed_import).toBe(2);
    expect(summary.parsed_skip).toBe(1);
    expect(summary.new_count).toBe(2);
    expect(summary.wrote).toBe(0);
    expect(db._writes).toHaveLength(0);
  });

  it('execute escreve toWrite com payload + sourceMeta + audit', async () => {
    const db = makeStubDb();
    const summary = await runBootstrap({
      db,
      readSheet: () => sampleRows,
      filePath: '/fake/Mentoria_Ativa_2404.xlsx',
      mode: 'execute',
      timestamp: { now: () => 'TS' },
      timestampFromDate: (d) => ({ _ts: d.toISOString() }),
    });
    expect(summary.wrote).toBe(2);
    expect(db._writes).toHaveLength(2);
    const bruno = db._writes.find((w) => w.data.nome === 'Bruno Albuquerque');
    expect(bruno.data.celular).toBe('+5521997118900');
    expect(bruno.data.subscription.type).toBe('alpha');
    expect(bruno.data.subscription.endsAt).toEqual({ _ts: expect.any(String) });
    expect(bruno.data.sourceMeta.sheetFile).toBe('Mentoria_Ativa_2404.xlsx');
    expect(bruno.data.sourceMeta.rawNumeros).toBe('5521997118900');
    expect(bruno.data.sourceMeta.rawVencimento).toBe('3/3/26');
    expect(bruno.data.createdAt).toBe('TS');

    const daniel = db._writes.find((w) => w.data.nome === 'Daniel Barbosa');
    expect(daniel.data.subscription.endsAt).toBeNull();
  });

  it('idempotência: re-run com triplo match existente → 0 writes', async () => {
    const db = makeStubDb({
      existingByName: { 'bruno albuquerque': 'old1', 'daniel barbosa': 'old2' },
    });
    const summary = await runBootstrap({
      db,
      readSheet: () => sampleRows,
      filePath: '/fake/test.xlsx',
      mode: 'execute',
      timestamp: { now: () => 'TS' },
    });
    expect(summary.duplicates_count).toBe(2);
    expect(summary.new_count).toBe(0);
    expect(summary.wrote).toBe(0);
    expect(db._writes).toHaveLength(0);
  });

  it('skipped_detail no log preserva nome+numeros+vencimento crus', async () => {
    const db = makeStubDb();
    const summary = await runBootstrap({
      db,
      readSheet: () => sampleRows,
      filePath: '/fake/test.xlsx',
      mode: 'dryrun',
      timestamp: { now: () => 'TS' },
    });
    expect(summary.skipped_detail).toEqual([
      { reason: 'cancelado', nome: 'Naldo', numeros: '5515991982025', vencimento: 'Cancelado' },
    ]);
  });

  it('args obrigatórios validados', async () => {
    await expect(runBootstrap({})).rejects.toThrow(/db obrigatório/);
    await expect(runBootstrap({ db: {} })).rejects.toThrow(/readSheet/);
    await expect(runBootstrap({ db: {}, readSheet: () => [] })).rejects.toThrow(/filePath/);
  });
});
