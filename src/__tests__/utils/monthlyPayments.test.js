/**
 * Tests: aggregatePaymentsForMonth — issue #250
 */

import { describe, it, expect } from 'vitest';
import { aggregatePaymentsForMonth } from '../../utils/monthlyPayments';

// Produção grava T12:00:00Z (DEC equivalente ao addSubscription para evitar TZ shift em BR).
const mkPayment = (date, amount, opts = {}) => ({
  date: new Date(`${date}T12:00:00Z`),
  amount,
  currency: opts.currency ?? 'BRL',
  studentId: opts.studentId ?? 'sX',
  ...opts,
});

describe('aggregatePaymentsForMonth', () => {
  it('filtra pagamentos do mês alvo (year + month 0-indexed)', () => {
    const payments = [
      mkPayment('2026-04-15', 1000), // abril → fora
      mkPayment('2026-05-03', 1200), // maio
      mkPayment('2026-05-28', 800), // maio
      mkPayment('2026-06-01', 500), // junho → fora
    ];
    const r = aggregatePaymentsForMonth(payments, 2026, 4); // mês 4 = maio
    expect(r.count).toBe(2);
    expect(r.total).toBe(2000);
  });

  it('ordena por data desc', () => {
    const payments = [
      mkPayment('2026-05-01', 100, { id: 'a' }),
      mkPayment('2026-05-15', 200, { id: 'b' }),
      mkPayment('2026-05-10', 300, { id: 'c' }),
    ];
    const r = aggregatePaymentsForMonth(payments, 2026, 4);
    expect(r.list.map((p) => p.id)).toEqual(['b', 'c', 'a']);
  });

  it('enriquece com studentName quando map fornecido', () => {
    const payments = [mkPayment('2026-05-10', 100, { studentId: 'uid-joao' })];
    const map = new Map([['uid-joao', 'João Silva']]);
    const r = aggregatePaymentsForMonth(payments, 2026, 4, map);
    expect(r.list[0].studentName).toBe('João Silva');
  });

  it('fallback para studentId quando map não tem entry', () => {
    const payments = [mkPayment('2026-05-10', 100, { studentId: 'uid-x' })];
    const r = aggregatePaymentsForMonth(payments, 2026, 4, new Map());
    expect(r.list[0].studentName).toBe('uid-x');
  });

  it('soma só BRL (outras moedas ignoradas no total)', () => {
    const payments = [
      mkPayment('2026-05-10', 1000), // BRL
      mkPayment('2026-05-12', 500, { currency: 'USD' }),
      mkPayment('2026-05-15', 200), // BRL
    ];
    const r = aggregatePaymentsForMonth(payments, 2026, 4);
    expect(r.count).toBe(3); // count inclui todos
    expect(r.total).toBe(1200); // total só BRL
  });

  it('lida com Timestamp do Firestore (val.toDate())', () => {
    const fakeTimestamp = { toDate: () => new Date('2026-05-10T12:00:00Z') };
    const payments = [{ date: fakeTimestamp, amount: 500, currency: 'BRL', studentId: 's' }];
    const r = aggregatePaymentsForMonth(payments, 2026, 4);
    expect(r.count).toBe(1);
    expect(r.total).toBe(500);
  });

  it('mês vazio retorna zeros', () => {
    const r = aggregatePaymentsForMonth([], 2026, 4);
    expect(r).toEqual({ total: 0, count: 0, list: [] });
  });

  it('payments null/undefined → zeros', () => {
    expect(aggregatePaymentsForMonth(null, 2026, 4)).toEqual({ total: 0, count: 0, list: [] });
    expect(aggregatePaymentsForMonth(undefined, 2026, 4)).toEqual({ total: 0, count: 0, list: [] });
  });

  it('amount inválido (string vazia, NaN) → trata como 0', () => {
    const payments = [
      mkPayment('2026-05-10', 1000),
      { date: new Date('2026-05-12T12:00:00Z'), amount: 'abc', currency: 'BRL', studentId: 's' },
      { date: new Date('2026-05-13T12:00:00Z'), amount: null, currency: 'BRL', studentId: 's' },
    ];
    const r = aggregatePaymentsForMonth(payments, 2026, 4);
    expect(r.count).toBe(3);
    expect(r.total).toBe(1000);
  });

  it('payment sem date → ignora', () => {
    const payments = [
      mkPayment('2026-05-10', 100),
      { amount: 500, currency: 'BRL', studentId: 's' }, // sem date
    ];
    const r = aggregatePaymentsForMonth(payments, 2026, 4);
    expect(r.count).toBe(1);
  });
});
