/**
 * tradeReport — seleção e agregação do Relatório do Mês (#414)
 */
import { describe, it, expect } from 'vitest';
import {
  mentorMessages,
  hasMentorFeedback,
  shiftMonth,
  monthLabel,
  currentMonthKey,
  buildMonthReport,
  monthsWithFeedback,
} from '../../utils/tradeReport';

const trade = (over = {}) => ({
  id: 't1', date: '2026-08-27', entryTime: '2026-08-27T15:05:00-03:00',
  ticker: 'WINM26', side: 'LONG', qty: 2, result: -94, currency: 'BRL',
  ...over,
});

describe('mentorMessages — conciliação legado × histórico', () => {
  it('trade legado (só mentorFeedback) devolve uma mensagem', () => {
    const msgs = mentorMessages(trade({ mentorFeedback: 'entrou antes do fechamento' }));
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe('entrou antes do fechamento');
  });

  it('não duplica quando o legado já está no histórico', () => {
    const msgs = mentorMessages(trade({
      mentorFeedback: 'mesma coisa',
      feedbackHistory: [{ id: 'a', authorRole: 'mentor', content: 'mesma coisa', createdAt: '2026-08-28T10:00:00Z' }],
    }));
    expect(msgs).toHaveLength(1);
  });

  it('soma legado + histórico quando são conteúdos diferentes', () => {
    const msgs = mentorMessages(trade({
      mentorFeedback: 'primeiro',
      feedbackHistory: [{ id: 'a', authorRole: 'mentor', content: 'segundo', createdAt: '2026-08-28T10:00:00Z' }],
    }));
    expect(msgs.map((m) => m.content)).toEqual(['primeiro', 'segundo']);
  });

  it('ignora mensagem do aluno', () => {
    const msgs = mentorMessages(trade({
      feedbackHistory: [
        { id: 'a', authorRole: 'student', content: 'não entendi', createdAt: '2026-08-28T10:00:00Z' },
        { id: 'b', authorRole: 'mentor', content: 'explico', createdAt: '2026-08-28T11:00:00Z' },
      ],
    }));
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe('explico');
  });

  it('mentorFeedback vazio ou só espaço não conta como feedback', () => {
    expect(hasMentorFeedback(trade({ mentorFeedback: '' }))).toBe(false);
    expect(hasMentorFeedback(trade({ mentorFeedback: '   ' }))).toBe(false);
    expect(hasMentorFeedback(trade({ mentorFeedback: null, feedbackHistory: [] }))).toBe(false);
    expect(hasMentorFeedback(trade())).toBe(false);
  });

  it('ordena por createdAt e aceita timestamp Firestore', () => {
    const msgs = mentorMessages(trade({
      feedbackHistory: [
        { id: 'b', authorRole: 'mentor', content: 'depois', createdAt: { seconds: 2000 } },
        { id: 'a', authorRole: 'mentor', content: 'antes', createdAt: { seconds: 1000 } },
      ],
    }));
    expect(msgs.map((m) => m.content)).toEqual(['antes', 'depois']);
  });
});

describe('navegação de mês', () => {
  it('anda pra trás e pra frente virando o ano', () => {
    expect(shiftMonth('2026-08', -1)).toBe('2026-07');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });

  it('rotula em português', () => {
    expect(monthLabel('2026-08')).toBe('agosto / 2026');
    expect(monthLabel('2026-03')).toBe('março / 2026');
  });

  it('mês corrente é local, não UTC', () => {
    // 01/01 às 00:30 em Brasília ainda é 01/01 — não pode virar dezembro
    expect(currentMonthKey(new Date(2026, 0, 1, 0, 30))).toBe('2026-01');
    expect(currentMonthKey(new Date(2026, 7, 31, 23, 30))).toBe('2026-08');
  });
});

describe('buildMonthReport', () => {
  const base = [
    trade({ id: 'a', date: '2026-08-27', entryTime: '2026-08-27T15:05:00-03:00', result: -94, mentorFeedback: 'ok' }),
    trade({ id: 'b', date: '2026-08-22', result: 210, mentorFeedback: 'bem executado' }),
    trade({ id: 'c', date: '2026-08-20', result: -500 }),                                   // sem feedback
    trade({ id: 'd', date: '2026-07-31', result: 1000, mentorFeedback: 'mês anterior' }),   // outro mês
  ];

  it('só entra trade do mês E com feedback', () => {
    const r = buildMonthReport(base, '2026-08');
    expect(r.trades.map((t) => t.id)).toEqual(['a', 'b']);
    expect(r.count).toBe(2);
  });

  it('ordena do mais recente pro mais antigo, desempatando por entryTime', () => {
    const r = buildMonthReport([
      trade({ id: 'manha', date: '2026-08-27', entryTime: '2026-08-27T09:00:00-03:00', mentorFeedback: 'x' }),
      trade({ id: 'tarde', date: '2026-08-27', entryTime: '2026-08-27T15:05:00-03:00', mentorFeedback: 'y' }),
    ], '2026-08');
    expect(r.trades.map((t) => t.id)).toEqual(['tarde', 'manha']);
  });

  it('NUNCA soma moedas diferentes — um total por moeda', () => {
    const r = buildMonthReport([
      trade({ id: 'brl', date: '2026-08-10', result: -340, currency: 'BRL', mentorFeedback: 'x' }),
      trade({ id: 'usd', date: '2026-08-11', result: 128, currency: 'USD', mentorFeedback: 'y' }),
      trade({ id: 'usd2', date: '2026-08-12', result: 72, currency: 'USD', mentorFeedback: 'z' }),
    ], '2026-08');
    const by = Object.fromEntries(r.totals.map((t) => [t.currency, t]));
    expect(Object.keys(by).sort()).toEqual(['BRL', 'USD']);
    expect(by.BRL.totalPL).toBe(-340);
    expect(by.USD.totalPL).toBe(200);
    expect(by.USD.count).toBe(2);
  });

  it('não confunde 2026-08 com 2026-08 de outro ano nem com dia solto', () => {
    const r = buildMonthReport([
      trade({ id: 'certo', date: '2026-08-01', mentorFeedback: 'x' }),
      trade({ id: 'outroAno', date: '2025-08-01', mentorFeedback: 'x' }),
    ], '2026-08');
    expect(r.trades.map((t) => t.id)).toEqual(['certo']);
  });

  it('mês vazio devolve estrutura vazia, não quebra', () => {
    const r = buildMonthReport(base, '2026-02');
    expect(r.count).toBe(0);
    expect(r.totals).toEqual([]);
  });

  it('lista ausente ou nula não quebra', () => {
    expect(buildMonthReport(null, '2026-08').count).toBe(0);
    expect(buildMonthReport(undefined, '2026-08').trades).toEqual([]);
  });
});

describe('monthsWithFeedback', () => {
  it('lista meses com feedback, do mais recente pro mais antigo, sem repetir', () => {
    const months = monthsWithFeedback([
      trade({ date: '2026-08-27', mentorFeedback: 'x' }),
      trade({ date: '2026-08-02', mentorFeedback: 'y' }),
      trade({ date: '2026-05-10', mentorFeedback: 'z' }),
      trade({ date: '2026-07-10' }), // sem feedback — não conta
    ]);
    expect(months).toEqual(['2026-08', '2026-05']);
  });
});
