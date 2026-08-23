/**
 * Regressões achadas pela revisão de código de 23/08, sobre os commits do próprio dia.
 * Oito achados; seis viraram teste aqui. Cinco eram meus, dois já estavam em produção.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const { analyzeShadowForTradeCF } = require_('../../../../functions/shadow/shadowDetectors');
const { buildBehaviorProfiles } = require_('../../../../functions/behavior/buildBehaviorProfile');

const cods = (t, o, adj = []) => (analyzeShadowForTradeCF(t, adj, o)?.patterns || []).map((p) => p.code);
const pat = (t, o, code, adj = []) => (analyzeShadowForTradeCF(t, adj, o)?.patterns || []).find((p) => p.code === code);

const trade = (over = {}) => ({
  id: 'T1', studentId: 'S1', side: 'LONG', qty: 10, entry: 174000, exit: 173800,
  result: -200, date: '2026-08-21',
  entryTime: '2026-08-21T10:00:00-03:00', exitTime: '2026-08-21T10:32:00-03:00', ...over,
});
const entrada = { side: 'BUY', status: 'FILLED', isStopOrder: false, filledPrice: 174000,
  filledAt: '2026-08-21T10:00:00', submittedAt: '2026-08-21T10:00:00' };
const stop = (preco, nasce, morre, status = 'CANCELLED') => ({
  side: 'SELL', isStopOrder: true, status, stopPrice: preco,
  submittedAt: `2026-08-21T${nasce}`, cancelledAt: morre ? `2026-08-21T${morre}` : null });

describe('#396.1 — severidade tem de chegar ao gate do trade', () => {
  it('trade que NUNCA protegeu trava progressão', () => {
    // O fix do #394 fazia `travaProgressao(codigo, undefined)` → não trava, para TODO
    // UNPROTECTED_SIZE. Um trade sem stop nenhum saía com gateInputs vazio: o oposto.
    const t = trade({ tickerRule: { tickSize: 5, tickValue: 1 }, planId: 'P1' });
    const orders = [{ ...entrada, correlatedTradeId: 'T1', instrument: 'WINV26', filledQuantity: 10, quantity: 10 }];
    const p = buildBehaviorProfiles({
      trades: [{ ...t, ticker: 'WINV26' }], orders,
      plans: [{ id: 'P1', riskPerOperation: 1, pl: 30000, rrTarget: 2 }],
      getEmotionConfig: () => ({ analysisCategory: 'NEUTRAL' }),
    }).get('T1');
    expect(p.families.find((f) => f.canonicalCode === 'UNPROTECTED_SIZE').severity).toBe('HIGH');
    expect(p.gateInputs).toContain('UNPROTECTED_SIZE');
  });
});

describe('#396.5 — ordem sem instante não vira hesitação', () => {
  it('cancelada sem data não conta como cancelada antes da entrada', () => {
    // `orderInstantMs` devolve null e `null < n` coage para `0 < n` → true.
    const semData = [{ status: 'CANCELLED', side: 'SELL', isStopOrder: false },
      { status: 'CANCELLED', side: 'SELL', isStopOrder: false }, entrada];
    expect(cods(trade(), semData)).not.toContain('HESITATION');
  });
});

describe('#396.2/3 — pânico no stop', () => {
  it('afastar a proteção e sair conta', () => {
    const p = pat(trade(), [entrada, stop(173900, '10:01:00', '10:29:00'), stop(173700, '10:29:30', '10:32:00')], 'STOP_PANIC');
    expect(p?.evidence.motivo).toBe('afastou');
  });

  it('APERTAR a proteção (trailing) não é pânico', () => {
    expect(cods(trade(), [entrada, stop(173700, '10:01:00', '10:29:00'), stop(173900, '10:29:30', '10:32:00')]))
      .not.toContain('STOP_PANIC');
  });

  it('bracket cancelado no alvo não é pânico', () => {
    const t = trade({ result: 520, exit: 174290 });
    expect(cods(t, [entrada, stop(173900, '10:01:00', '10:32:00')])).not.toContain('STOP_PANIC');
  });

  it('remover a proteção e sair em 2min conta — o detector não pode nascer inerte', () => {
    const p = pat(trade(), [entrada, stop(173900, '10:01:00', '10:30:00')], 'STOP_PANIC');
    expect(p?.evidence.motivo).toBe('removeu');
  });
});

describe('#396.4 — saída tardia', () => {
  it('cancelou e segurou a perda 40min conta', () => {
    const t = trade({ exitTime: '2026-08-21T11:00:00-03:00' });
    expect(cods(t, [entrada, stop(173900, '10:01:00', '10:20:00')])).toContain('LATE_EXIT');
  });

  it('trailing stop (cancela e recoloca) NÃO é saída tardia', () => {
    const t = trade({ exitTime: '2026-08-21T11:00:00-03:00' });
    const orders = [entrada, stop(173900, '10:01:00', '10:20:00'), stop(173850, '10:20:10', null, 'WORKING')];
    expect(cods(t, orders)).not.toContain('LATE_EXIT');
  });

  it('trade que saiu PELO stop não é saída tardia', () => {
    const t = trade({ exitTime: '2026-08-21T11:00:00-03:00' });
    const orders = [entrada, stop(173900, '10:01:00', '10:20:00'),
      { side: 'SELL', isStopOrder: true, status: 'FILLED', stopPrice: 173800, submittedAt: '2026-08-21T10:20:10', filledAt: '2026-08-21T11:00:00' }];
    expect(cods(t, orders)).not.toContain('LATE_EXIT');
  });
});

describe('#396.6 — cluster de ganância inclui o trade que abriu a sequência', () => {
  it('vencedor segurado 15min + duas entradas rápidas = cluster de 3', () => {
    const g = (id, ent, sai) => ({ id, studentId: 'S1', side: 'LONG', qty: 2, date: '2026-08-21',
      result: 200, entryTime: `2026-08-21T${ent}-03:00`, exitTime: `2026-08-21T${sai}-03:00` });
    const p = pat(g('T1', '10:20:00', '10:22:00'), [], 'GREED_CLUSTER',
      [g('T2', '10:00:00', '10:15:00'), g('T3', '10:16:00', '10:18:00')]);
    expect(p?.evidence.rapidTradesInWindow).toBe(3);
  });
});

describe('#396.7/8 — higiene', () => {
  it('version.full concorda com version', async () => {
    const { default: VERSION } = await import('../../../version.js');
    expect(VERSION.full.startsWith(VERSION.version)).toBe(true);
    expect(VERSION.display).toBe(`v${VERSION.version}`);
  });
});
