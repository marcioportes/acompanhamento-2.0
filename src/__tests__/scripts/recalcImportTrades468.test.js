/**
 * recalcImportTrades468.test.js — issue #468 (épico #462, Fase 5)
 *
 * O recálculo dos trades já gravados pelo import, contra Firestore EM MEMÓRIA. As ordens
 * vêm dos exports reais do ProfitChart-Pro (fixtures do #463), gravadas como o
 * `ingestBatch` grava em `orders`: com offset (#464), sem `origin`, com `batchId` e
 * `correlatedTradeId`.
 *
 * Roda igual em TZ=UTC e TZ=America/Sao_Paulo.
 */

import { describe, it, expect } from 'vitest';
import { montarDia, fakeDb, ALUNO } from '../helpers/gravadoDoImport';
import {
  runRecalc, proporRecalculo, stopOrigin, riscoEmReais, formatarRelatorio, CATEGORIA,
} from '../../../scripts/lib/recalcImportTrades.mjs';

const BATCH = 'batch-2409';

// ---------- 24/09/2026 — o caso do épico ----------

describe('#468 · 24/09/2026 — trade gravado com o stop cancelado 44 min antes', () => {
  const dia = montarDia('2026-09-24-ordens.csv', BATCH);
  const alvoId = Object.keys(dia.trades).find(id => dia.trades[id].entryTime.startsWith('2026-09-24T15:52:21'));
  // Estado gravado pelo import antigo: stop 188.720 (ordem cancelada 44 min antes).
  const trades = { ...dia.trades, [alvoId]: { ...dia.trades[alvoId], stopLoss: 188720 } };

  it('o fixture reproduz o trade: SHORT 10, médio 185.185, risco antigo R$ 7.070', () => {
    const t = trades[alvoId];
    expect(t.side).toBe('SHORT');
    expect(t.qty).toBe(10);
    expect(t.entry).toBe(185185);
    expect(riscoEmReais(t)).toBe(7070);
  });

  it('o 188.720 é preço de ordem ligada ao trade → stop do import', () => {
    const ligadas = Object.values(dia.orders).filter(o => o.correlatedTradeId === alvoId);
    expect(ligadas.some(o => o.stopPrice === 188720)).toBe(true);
    expect(stopOrigin(trades[alvoId], ligadas)).toBe('import');
  });

  it('dry-run: proposta stop 188.720 → sem stop, risco R$ 7.070 → ∅, ZERO escritas', async () => {
    const db = fakeDb({ trades, orders: dia.orders });
    const r = await runRecalc(db, { student: ALUNO });
    const l = r.linhas.find(x => x.tradeId === alvoId);
    expect(l.categoria).toBe(CATEGORIA.RECALCULADO);
    expect(l.mudancas).toEqual({ stopLoss: { antes: 188720, depois: null } });
    expect(l.patch).toEqual({ stopLoss: null });
    expect(l.riscoAntes).toBe(7070);
    expect(l.riscoDepois).toBeNull();
    expect(db.escritas).toHaveLength(0);
    // Os outros trades do dia já estão com a regra nova: inalterados.
    for (const x of r.linhas.filter(x => x.tradeId !== alvoId)) expect(x.categoria).toBe(CATEGORIA.INALTERADO);
    expect(r.resumo.recalculado).toBe(1);
    expect(formatarRelatorio(r)).toContain('DRY-RUN');
    expect(formatarRelatorio(r)).toContain('24/09/2026');
  });

  it('--apply grava SÓ o stopLoss, pelo helper de imutabilidade', async () => {
    const db = fakeDb({ trades, orders: dia.orders });
    const r = await runRecalc(db, { student: ALUNO, apply: true });
    expect(db.escritas).toEqual([{ colecao: 'trades', id: alvoId, patch: { stopLoss: null } }]);
    expect(r.escritos).toEqual([alvoId]);
    expect(db.dados.trades.get(alvoId).stopLoss).toBeNull();
    expect(db.dados.orders.size).toBe(Object.keys(dia.orders).length); // orders intactas
  });

  it('--trade escopa a um trade só', async () => {
    const db = fakeDb({ trades, orders: dia.orders });
    const r = await runRecalc(db, { trade: alvoId });
    expect(r.linhas.map(l => l.tradeId)).toEqual([alvoId]);
  });

  it('discutido: listado como preservado, nada escrito mesmo com --apply', async () => {
    const db = fakeDb({ trades: { ...trades, [alvoId]: { ...trades[alvoId], status: 'DISCUSSED' } }, orders: dia.orders });
    const r = await runRecalc(db, { student: ALUNO, apply: true, includeAmbiguous: true });
    expect(r.linhas.find(l => l.tradeId === alvoId).categoria).toBe(CATEGORIA.DISCUTIDO);
    expect(db.escritas).toHaveLength(0);
    expect(r.resumo.preservado_discutido).toBe(1);
  });

  it('discutido ENTRE o dry-run e a escrita: o helper relê o doc e preserva', async () => {
    const db = fakeDb({ trades, orders: dia.orders });
    const colecao = db.collection;
    // A varredura lê por `where` (OPEN); a releitura do helper (`doc().get`) vê DISCUSSED.
    db.collection = (nome) => {
      const c = colecao(nome);
      if (nome !== 'trades') return c;
      return {
        ...c,
        doc: (id) => {
          const r = c.doc(id);
          return { ...r, get: async () => { const s = await r.get(); const d = s.data(); return { ...s, data: () => ({ ...d, status: 'DISCUSSED' }) }; } };
        },
      };
    };
    const r = await runRecalc(db, { student: ALUNO, apply: true });
    expect(r.linhas.find(l => l.tradeId === alvoId).categoria).toBe(CATEGORIA.RECALCULADO);
    expect(db.escritas).toHaveLength(0);
    expect(r.preservadosNaEscrita).toEqual([alvoId]);
  });

  it('orders purgadas → "sem ordens para recalcular"', async () => {
    const semOrdens = Object.fromEntries(Object.entries(dia.orders).filter(([, o]) => o.correlatedTradeId !== alvoId));
    const db = fakeDb({ trades, orders: semOrdens });
    const r = await runRecalc(db, { student: ALUNO });
    expect(r.linhas.find(l => l.tradeId === alvoId).categoria).toBe(CATEGORIA.SEM_ORDENS);
  });

  it('behaviorProfile é refeito para o aluno afetado, só no --apply com escrita', async () => {
    const chamadas = [];
    const recomputeBehaviorForStudent = async (_db, _admin, uid) => { chamadas.push(uid); return { written: 1, preserved: 0 }; };
    await runRecalc(fakeDb({ trades, orders: dia.orders }), { student: ALUNO }, { recomputeBehaviorForStudent });
    expect(chamadas).toEqual([]);
    await runRecalc(fakeDb({ trades, orders: dia.orders }), { student: ALUNO, apply: true }, { recomputeBehaviorForStudent });
    expect(chamadas).toEqual([ALUNO]);
  });
});

// ---------- stop digitado pelo aluno ----------

describe('#468 · stop do aluno nunca é sobrescrito', () => {
  const dia = montarDia('2026-09-24-ordens.csv', BATCH);
  const alvoId = Object.keys(dia.trades).find(id => dia.trades[id].entryTime.startsWith('2026-09-24T15:52:21'));
  const ligadas = Object.values(dia.orders).filter(o => o.correlatedTradeId === alvoId);
  const lote = Object.entries(dia.orders).map(([id, o]) => ({ id, ...o }));
  const ligadasComId = lote.filter(o => o.correlatedTradeId === alvoId);

  it('trade criado pelo import com stop que não é preço de ordem nenhuma → ambíguo, fora do --apply', async () => {
    const trades = { ...dia.trades, [alvoId]: { ...dia.trades[alvoId], stopLoss: 185400 } };
    expect(stopOrigin(trades[alvoId], ligadas)).toBe('ambiguo');
    const db = fakeDb({ trades, orders: dia.orders });
    const r = await runRecalc(db, { student: ALUNO, apply: true });
    const l = r.linhas.find(x => x.tradeId === alvoId);
    expect(l.categoria).toBe(CATEGORIA.AMBIGUO);
    expect(l.motivos.join(' ')).toMatch(/não bate com nenhum preço/);
    expect(db.escritas).toHaveLength(0);
  });

  it('...e entra com --include-ambiguous', async () => {
    const trades = { ...dia.trades, [alvoId]: { ...dia.trades[alvoId], stopLoss: 185400 } };
    const db = fakeDb({ trades, orders: dia.orders });
    await runRecalc(db, { student: ALUNO, apply: true, includeAmbiguous: true });
    expect(db.escritas).toEqual([{ colecao: 'trades', id: alvoId, patch: { stopLoss: null } }]);
  });

  it('stopLossSource "student" → preservado, mesmo sendo preço de ordem', () => {
    const t = { ...dia.trades[alvoId], id: alvoId, stopLoss: 188720, stopLossSource: 'student' };
    const p = proporRecalculo(t, ligadasComId, lote);
    expect(p.categoria).toBe(CATEGORIA.STOP_DO_ALUNO);
    expect(p.patch).toBeNull();
  });

  it('trade manual enriquecido: stop igual ao do snapshot (o aluno já tinha) → do aluno', () => {
    const { source, importSource, ...manual } = dia.trades[alvoId];
    const t = { ...manual, id: alvoId, stopLoss: 188720, enrichedByImport: true, _enrichmentSnapshot: { stopLoss: 188720 } };
    expect(stopOrigin(t, ligadas)).toBe('student');
    expect(proporRecalculo(t, ligadasComId, lote).categoria).toBe(CATEGORIA.STOP_DO_ALUNO);
  });

  it('trade manual enriquecido: import pré-#371 sobrescreveu o vazio do snapshot com preço de ordem → do import', () => {
    const { source, importSource, ...manual } = dia.trades[alvoId];
    const t = { ...manual, id: alvoId, stopLoss: 188720, enrichedByImport: true, _enrichmentSnapshot: { stopLoss: null } };
    expect(stopOrigin(t, ligadas)).toBe('import');
    expect(proporRecalculo(t, ligadasComId, lote).patch).toEqual({ stopLoss: null });
  });

  it('trade manual, sem import nenhum: o stop é do aluno', () => {
    const { source, importSource, ...manual } = dia.trades[alvoId];
    expect(stopOrigin({ ...manual, stopLoss: 188720 }, ligadas)).toBe('student');
  });
});

// ---------- #455 — trade invertido e datado de 1970 ----------

describe('#468 · 23/09/2026 — trade gravado invertido e em 1970 (#455)', () => {
  const dia = montarDia('2026-09-23-ordens.csv', 'batch-2309');
  const alvoId = Object.keys(dia.trades).find(id => dia.trades[id].entryTime.startsWith('2026-09-23T10:58:06'));
  const certo = dia.trades[alvoId];
  // Como o import antigo gravou: SHORT, entrada/saída trocadas, 1970, sem stop.
  const invertido = {
    ...certo,
    side: 'SHORT',
    entry: certo.exit,
    exit: certo.entry,
    entryTime: '1970-01-01T00:00:00.000Z',
    exitTime: '1970-01-01T00:00:00.000Z',
    date: '1970-01-01',
    duration: 0,
    stopLoss: null,
    _partials: [
      { type: 'ENTRY', price: certo.exit, qty: certo.qty, dateTime: null, seq: 1 },
      { type: 'EXIT', price: certo.entry, qty: certo.qty, dateTime: null, seq: 2 },
    ],
  };

  it('o fixture reproduz o caso: LONG 5, 189.370 → 189.870', () => {
    expect(certo.side).toBe('LONG');
    expect(certo.entry).toBe(189370);
    expect(certo.exit).toBe(189870);
  });

  it('corrige lado, preços, horários e data — resultado igual, então aplicável', async () => {
    const db = fakeDb({ trades: { ...dia.trades, [alvoId]: invertido }, orders: dia.orders });
    const r = await runRecalc(db, { student: ALUNO, since: '2026-09-20' }); // 1970 entra no --since
    const l = r.linhas.find(x => x.tradeId === alvoId);
    expect(l.categoria).toBe(CATEGORIA.RECALCULADO);
    expect(l.mudancas.side).toEqual({ antes: 'SHORT', depois: 'LONG' });
    expect(l.mudancas.entry).toEqual({ antes: 189870, depois: 189370 });
    expect(l.mudancas.exit).toEqual({ antes: 189370, depois: 189870 });
    expect(l.mudancas.date).toEqual({ antes: '1970-01-01', depois: '2026-09-23' });
    expect(l.patch.entryTime).toMatch(/^2026-09-23T10:58:06(\.\d+)?-03:00$/);
    expect(l.patch.exitTime).toMatch(/^2026-09-23T11:07:36/);
    expect(l.patch.duration).toBe(9);
    expect(l.patch).not.toHaveProperty('result'); // resultado não muda
    expect(l.patch._partials.map(p => [p.type, p.price])).toEqual([['ENTRY', 189370], ['EXIT', 189870]]);
    expect(db.escritas).toHaveLength(0);
  });

  it('--apply: só campos que o trade já tem (INV-15)', async () => {
    const trades = { ...dia.trades, [alvoId]: invertido };
    const db = fakeDb({ trades, orders: dia.orders });
    await runRecalc(db, { trade: alvoId, apply: true });
    expect(db.escritas).toHaveLength(1);
    const campos = Object.keys(db.escritas[0].patch);
    const permitidos = new Set([...Object.keys(invertido), 'resultPercent', 'resultInPoints', 'hasPartials', 'partialsCount']);
    for (const c of campos) expect(permitidos.has(c) || c in certo).toBe(true);
    expect(campos).not.toContain('stopLossSource');
    expect(campos).not.toContain('updatedAt');
    expect(db.dados.trades.get(alvoId).side).toBe('LONG');
  });

  it('ordens gravadas SEM instante (o que o parser do #455 produziu) → bloqueado, reimportar', async () => {
    const semInstante = Object.fromEntries(Object.entries(dia.orders).map(([id, o]) => [id,
      o.correlatedTradeId === alvoId ? { ...o, submittedAt: null, filledAt: null, cancelledAt: null } : o]));
    const db = fakeDb({ trades: { ...dia.trades, [alvoId]: invertido }, orders: semInstante });
    const r = await runRecalc(db, { trade: alvoId, apply: true, includeAmbiguous: true });
    const l = r.linhas[0];
    expect(l.categoria).toBe(CATEGORIA.BLOQUEADO);
    expect(l.motivos[0]).toMatch(/sem instante/);
    expect(db.escritas).toHaveLength(0);
  });

  it('parciais editadas pelo aluno (outros preços) → ambíguo', () => {
    const lote = Object.entries(dia.orders).map(([id, o]) => ({ id, ...o }));
    const t = { ...invertido, id: alvoId, _partials: [
      { type: 'ENTRY', price: 189800, qty: 5, seq: 1 }, { type: 'EXIT', price: 189300, qty: 5, seq: 2 },
    ] };
    const p = proporRecalculo(t, lote.filter(o => o.correlatedTradeId === alvoId), lote);
    expect(p.categoria).toBe(CATEGORIA.AMBIGUO);
  });

  it('resultado que mudaria → bloqueado (saldo em movements)', () => {
    const lote = Object.entries(dia.orders).map(([id, o]) => ({ id, ...o }));
    const t = { ...invertido, id: alvoId, result: 123 };
    const p = proporRecalculo(t, lote.filter(o => o.correlatedTradeId === alvoId), lote);
    expect(p.categoria).toBe(CATEGORIA.BLOQUEADO);
    expect(p.motivos[0]).toMatch(/resultado mudaria/);
  });
});

// ---------- #449 — TRADE_SEM_STOP falso ----------

describe('#468 · stop vazio gravado pelo import antigo quando havia proteção comprovada (#449)', () => {
  it('04/05/2026: stop null → stop das pernas (origem import), risco passa a existir', async () => {
    const dia = montarDia('2026-05-04-ordens.csv', 'batch-0405');
    const [id, t] = Object.entries(dia.trades).find(([, x]) => x.entryTime.startsWith('2026-05-04T11:32:03'));
    expect(t.stopLoss).toBe(190130);
    const db = fakeDb({ trades: { ...dia.trades, [id]: { ...t, stopLoss: null } }, orders: dia.orders });
    const r = await runRecalc(db, { trade: id });
    const l = r.linhas[0];
    expect(l.categoria).toBe(CATEGORIA.RECALCULADO);
    expect(l.patch).toEqual({ stopLoss: 190130 });
    expect(l.riscoAntes).toBeNull();
    expect(l.riscoDepois).toBeGreaterThan(0);
  });
});
