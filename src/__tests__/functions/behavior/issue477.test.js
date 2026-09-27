/**
 * #477 — o detector comportamental não crava medo.
 *
 * As três regras (Marcio, 27/09/2026):
 *   1. Hesitação só conta TENTATIVA de entrada (lado da entrada, perto do preço, pouco
 *      antes); cancelar e reenviar corrigido é ajuste; proteção sem posição nunca conta.
 *   2. Montagem de posição é aviso NEUTRO ("preço médio para trás/para frente"): sem
 *      emoção, não é violação, não alimenta gate nem score, não entra no confronto.
 *   3. Confronto emocional é hipótese: gravidade baixa não confronta; declaração positiva
 *      confirmada pela execução é confirmação.
 *
 * Caso real: 24/09/2026, WINV26, venda de 10 em duas pernas (+R$ 585), feito pelo Marcio
 * ao vivo, com stop. O perfil gravado dizia HESITATION (Medo) + AVERAGING_DOWN (Negação)
 * e "Você declarou 'Disciplinado', e há sinais de Medo na execução".
 *
 * Cliente (motor ESM + display) e CF (buildBehaviorProfile + shadow) concordam.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { montarDia, fakeDb, ALUNO } from '../../helpers/gravadoDoImport';
import { analyzeShadowForTrade } from '../../../utils/shadowBehaviorAnalysis';
import { detectExecutionEvents as esmEvents } from '../../../utils/executionBehaviorEngine';
import { emotionConfrontDisplay } from '../../../components/Trades/behaviorDisplay';
import { narrativeFor } from '../../../components/Trades/behaviorDisplay';
import { runRecompute477, candidato477 } from '../../../../scripts/lib/recomputeBehavior477.mjs';

const require = createRequire(import.meta.url);
const { buildBehaviorProfiles, computeEmotionConfront } = require('../../../../functions/behavior/buildBehaviorProfile.js');
const { analyzeShadowForTradeCF } = require('../../../../functions/shadow/shadowDetectors.js');
const { detectExecutionEvents: cjsEvents } = require('../../../../functions/maturity/executionBehaviorMirror.js');
const { buildGetEmotionConfig } = require('../../../../functions/maturity/emotionalAnalysisMirror.js');
const { isTradeImmutable, updateTradeIfMutable } = require('../../../../functions/_shared/tradeImmutability.js');

const POSITIVA = () => ({ analysisCategory: 'POSITIVE' });
const codigos = (patterns) => (patterns || []).map((p) => p.code).sort();

// ---------- 24/09/2026 — o caso real, pelo estado GRAVADO do import ----------

const dia2409 = () => {
  const { trades, orders } = montarDia('2026-09-24-ordens.csv', 'lote-2409');
  const ts = Object.entries(trades).map(([id, t]) => ({ id, ...t, emotionEntry: 'Disciplinado' }));
  return { trades: ts, orders: Object.values(orders) };
};

describe('#477 · 24/09/2026 — venda de 10 em duas pernas', () => {
  const { trades, orders } = dia2409();
  const t = trades[0];
  const perfil = buildBehaviorProfiles({ trades, orders, getEmotionConfig: POSITIVA }).get(t.id);

  it('as duas compras stop das 14:39 (lado oposto, ~4.000 pts, canceladas 44 min antes) NÃO são hesitação', () => {
    expect(trades).toHaveLength(1);
    expect(perfil.families.map((f) => f.canonicalCode)).not.toContain('HESITATION');
  });

  it('a segunda perna vira o aviso neutro "preço médio para trás" — sem emoção, sem severidade, sem gate', () => {
    const f = perfil.families.find((x) => x.canonicalCode === 'POSITION_BUILD_AGAINST');
    expect(f).toBeTruthy();
    expect(f.valence).toBe('neutral');
    expect(f.emotionMapping).toBeNull();
    expect(f.severity).toBeNull();
    expect(f.isGate).toBe(false);
    expect(f.evidence).toMatchObject({ side: 'SHORT', additions: 1, additionsWithOwnProtection: 1, firstLegProtected: true });
    expect(perfil.families.map((x) => x.canonicalCode)).not.toContain('AVERAGING_DOWN');
    expect(perfil.gateInputs).toEqual([]);
  });

  it('sem confronto de medo: "Disciplinado" CONFIRMADO — cada perna nasceu com proteção própria', () => {
    expect(perfil.emotionConfront.suggested).toBeNull();
    expect(perfil.emotionConfront.verdict).toBe('CONFIRMED');
    const c = emotionConfrontDisplay(perfil.emotionConfront, perfil.families);
    expect(c.tone).toBe('emerald');
    expect(c.text).toBe('Você declarou “Disciplinado” e a execução confirma — stop enviado junto com a entrada, e cada adição com proteção própria.');
    expect(c.text).not.toMatch(/medo/i);
  });

  it('o card do aviso diz o que houve, sem veredito', () => {
    const f = perfil.families.find((x) => x.canonicalCode === 'POSITION_BUILD_AGAINST');
    expect(narrativeFor(f)).toBe('Houve montagem de posição com preço médio para trás — 1 adição contra a posição, com proteção própria. Se foi leitura consciente ou erro, é conversa para ter com o mentor.');
  });

  it('cliente (shadow ESM) e CF (shadow CJS) dão os mesmos padrões', () => {
    const tradeOrders = orders.filter((o) => o.correlatedTradeId === t.id);
    const cf = analyzeShadowForTradeCF(t, [], tradeOrders);
    const cli = analyzeShadowForTrade(t, [], tradeOrders);
    const deOrdens = (ps) => codigos(ps.filter((p) => p.layer === 2));
    expect(deOrdens(cli.patterns)).toEqual(deOrdens(cf.patterns));
    expect(deOrdens(cf.patterns)).toEqual(['POSITION_BUILD_AGAINST']);
    expect(esmEvents({ trades: [t], orders: tradeOrders })).toEqual(cjsEvents({ trades: [t], orders: tradeOrders }));
  });

  it('perfil GRAVADO antes do #477 (HESITATION baixa + AVERAGING_DOWN) é lido sem medo e sem negação', () => {
    const antigo = {
      families: [
        { canonicalCode: 'HESITATION', family: 'HESITATION', severity: 'LOW', valence: 'negative', emotionMapping: 'FEAR', evidence: { cancelledOrdersCount: 2 } },
        { canonicalCode: 'AVERAGING_DOWN', family: 'AVERAGING_DOWN', severity: 'LOW', valence: 'negative', emotionMapping: 'DENIAL', evidence: { averagingCount: 1 } },
      ],
      emotionConfront: { declared: { name: 'Disciplinado', category: 'POSITIVE' }, suggested: { emotion: 'FEAR', code: 'HESITATION', severity: 'LOW' }, verdict: 'ATTENTION' },
    };
    expect(emotionConfrontDisplay(antigo.emotionConfront, antigo.families)).toBeNull();
    expect(emotionConfrontDisplay(antigo.emotionConfront)).toBeNull();
    expect(narrativeFor(antigo.families[1])).toMatch(/^Houve montagem de posição com preço médio para trás/);
  });
});

// ---------- regra 1 — hesitação ----------

const OFF = '-03:00';
const tradeLong = (over = {}) => ({
  id: 'H1', studentId: 'S1', ticker: 'WINV26', side: 'LONG', qty: 2, date: '2026-09-10',
  entry: 180000, exit: 180200, stopLoss: 179800, result: 80, setup: 'Rompimento',
  entryTime: `2026-09-10T10:05:00${OFF}`, exitTime: `2026-09-10T10:40:00${OFF}`,
  emotionEntry: 'Disciplinado', ...over,
});
const ord = (id, side, orderType, status, hora, extra = {}) => ({
  externalOrderId: id, instrument: 'WINV26', side, orderType, status, quantity: 2,
  submittedAt: `2026-09-10T${hora}${OFF}`, correlatedTradeId: 'H1', studentId: 'S1', ...extra,
});
const entradaFill = ord('E', 'BUY', 'LIMIT', 'FILLED', '10:04:58', {
  limitPrice: 180000, price: 180000, filledPrice: 180000, filledQuantity: 2, filledAt: `2026-09-10T10:05:00${OFF}`,
});
const stopDaEntrada = ord('S', 'SELL', 'STOP', 'CANCELLED', '10:05:01', {
  stopPrice: 179800, isStopOrder: true, cancelledAt: `2026-09-10T10:40:00${OFF}`,
});
const saida = ord('X', 'SELL', 'LIMIT', 'FILLED', '10:05:01', {
  limitPrice: 180200, filledPrice: 180200, filledQuantity: 2, filledAt: `2026-09-10T10:40:00${OFF}`,
});
const tentativa = (id, hora, cancel, preco) => ord(id, 'BUY', 'LIMIT', 'CANCELLED', hora, {
  limitPrice: preco, price: preco, cancelledAt: `2026-09-10T${cancel}${OFF}`,
});

const perfilDe = (trade, orders, cat = 'POSITIVE') =>
  buildBehaviorProfiles({ trades: [trade], orders, getEmotionConfig: () => ({ analysisCategory: cat }) }).get(trade.id);
const familia = (p, code) => p.families.find((f) => f.canonicalCode === code);

describe('#477 · regra 1 — hesitação só conta tentativa de entrada', () => {
  // Três compras limite perto do preço, canceladas nos 4 min antes da entrada.
  const tentativas = [
    tentativa('A1', '10:01:00', '10:01:30', 179990),
    tentativa('A2', '10:02:30', '10:03:00', 179995),
    tentativa('A3', '10:04:00', '10:04:20', 180005),
  ];

  it('tentativas reais (mesmo lado, perto do preço, pouco antes) seguem marcando hesitação', () => {
    const orders = [...tentativas, entradaFill, stopDaEntrada, saida];
    const cf = analyzeShadowForTradeCF(tradeLong(), [], orders);
    const cli = analyzeShadowForTrade(tradeLong(), [], orders);
    const h = cf.patterns.find((p) => p.code === 'HESITATION');
    expect(h.severity).toBe('MEDIUM');
    expect(h.evidence).toMatchObject({ cancelledOrdersCount: 3, hesitationMinutes: 4, adjustmentsIgnored: 0 });
    expect(cli.patterns.find((p) => p.code === 'HESITATION')).toEqual(h);
  });

  it('no perfil, a contagem do shadow vale sobre o evento por ordem (3 tentativas = MÉDIA) e o confronto é hipótese', () => {
    const p = perfilDe(tradeLong(), [...tentativas, entradaFill, stopDaEntrada, saida]);
    expect(familia(p, 'HESITATION').severity).toBe('MEDIUM');
    expect(p.emotionConfront.verdict).toBe('MISALIGNED');
    const c = emotionConfrontDisplay(p.emotionConfront, p.families);
    expect(c.tone).toBe('amber');
    expect(c.text).toBe('Você declarou “Disciplinado”, e a execução tem sinais que costumam acompanhar medo — 3 tentativas de entrada canceladas em 4 min. Confere com o que você sentiu?');
  });

  it('cancelar e reenviar com a quantidade corrigida é AJUSTE — não é hesitação (shadow e eventos)', () => {
    // Boleta de 1 contrato cancelada e reenviada com 2 em segundos, e de novo, até a
    // entrada (2 contratos). Cada cancelamento tem um reenvio corrigido logo em seguida.
    const orders = [
      { ...tentativa('Q1', '10:03:00', '10:03:20', 180000), quantity: 1 },
      { ...tentativa('Q2', '10:03:30', '10:03:50', 180000), quantity: 2 },
      { ...tentativa('Q3', '10:04:00', '10:04:50', 180000), quantity: 1 },
      entradaFill, stopDaEntrada, saida,
    ];
    const cf = analyzeShadowForTradeCF(tradeLong(), [], orders);
    expect(codigos(cf.patterns)).not.toContain('HESITATION');
    expect(codigos(analyzeShadowForTrade(tradeLong(), [], orders).patterns)).not.toContain('HESITATION');
    const eventos = cjsEvents({ trades: [tradeLong()], orders });
    expect(eventos.map((e) => e.type)).not.toContain('HESITATION_PRE_ENTRY');
    expect(esmEvents({ trades: [tradeLong()], orders })).toEqual(eventos);
    expect(familia(perfilDe(tradeLong(), orders), 'HESITATION')).toBeUndefined();
  });

  it('ordem de proteção (lado oposto) sem posição aberta nunca conta', () => {
    const protecoes = [
      ord('P1', 'SELL', 'STOP', 'CANCELLED', '10:01:00', { stopPrice: 179800, isStopOrder: true, cancelledAt: `2026-09-10T10:01:30${OFF}` }),
      ord('P2', 'SELL', 'STOP', 'CANCELLED', '10:02:00', { stopPrice: 179800, isStopOrder: true, cancelledAt: `2026-09-10T10:02:30${OFF}` }),
      ord('P3', 'SELL', 'STOP', 'CANCELLED', '10:03:00', { stopPrice: 179800, isStopOrder: true, cancelledAt: `2026-09-10T10:03:30${OFF}` }),
    ];
    const p = perfilDe(tradeLong(), [...protecoes, entradaFill, stopDaEntrada, saida]);
    expect(familia(p, 'HESITATION')).toBeUndefined();
  });

  it('longe do preço (outro setup) ou mais de 30 min antes não conta', () => {
    const orders = [
      tentativa('F1', '10:01:00', '10:01:30', 178500),  // 1.500 pts: mais que o stop e que 0,25%
      tentativa('F2', '10:02:00', '10:02:30', 181600),
      tentativa('V1', '09:20:00', '09:30:00', 180000),  // 35 min antes da entrada
      tentativa('V2', '09:25:00', '09:34:00', 180000),
      entradaFill, stopDaEntrada, saida,
    ];
    expect(codigos(analyzeShadowForTradeCF(tradeLong(), [], orders).patterns)).not.toContain('HESITATION');
    expect(codigos(analyzeShadowForTrade(tradeLong(), [], orders).patterns)).not.toContain('HESITATION');
  });
});

// ---------- regra 3 — confronto como hipótese ----------

describe('#477 · regra 3 — confronto emocional como hipótese', () => {
  const gec = (cat) => () => ({ analysisCategory: cat });
  const fam = (code, severity, emotion, extra = {}) => ({
    family: code, canonicalCode: code, severity, valence: 'negative', emotionMapping: emotion, isGate: false, ...extra,
  });

  it('padrão de gravidade BAIXA não gera confronto (nem sugestão)', () => {
    const r = computeEmotionConfront({ emotionEntry: 'Calmo' }, [fam('HESITATION', 'LOW', 'FEAR')], gec('POSITIVE'));
    expect(r.suggested).toBeNull();
    expect(r.verdict).toBe('ALIGNED');
    expect(emotionConfrontDisplay(r, [fam('HESITATION', 'LOW', 'FEAR')])).toBeNull();
  });

  it('sem declaração, BAIXA não vira convite a confrontar', () => {
    const r = computeEmotionConfront({ emotionEntry: null }, [fam('EARLY_EXIT', 'LOW', 'FEAR')], gec('POSITIVE'));
    expect(r).toEqual({ declared: null, suggested: null, verdict: 'NO_DECLARED' });
  });

  it('aviso neutro de montagem nunca é eleito emoção, mesmo gravado como AVERAGING_DOWN HIGH/DENIAL', () => {
    const r = computeEmotionConfront({ emotionEntry: 'Calmo' }, [fam('AVERAGING_DOWN', 'HIGH', 'DENIAL')], gec('POSITIVE'));
    expect(r.suggested).toBeNull();
  });

  it('confirmação exige toda leva protegida e nenhum gate', () => {
    const limpo = [];
    expect(computeEmotionConfront({ emotionEntry: 'Calmo' }, limpo, gec('POSITIVE'), { allProtected: true, hasGate: false }).verdict).toBe('CONFIRMED');
    expect(computeEmotionConfront({ emotionEntry: 'Calmo' }, limpo, gec('POSITIVE'), { allProtected: false, hasGate: false }).verdict).toBe('ALIGNED');
    expect(computeEmotionConfront({ emotionEntry: 'Calmo' }, limpo, gec('POSITIVE'), { allProtected: true, hasGate: true }).verdict).toBe('ALIGNED');
    expect(computeEmotionConfront({ emotionEntry: 'Ansioso' }, limpo, gec('NEGATIVE'), { allProtected: true, hasGate: false }).verdict).toBe('ALIGNED');
  });

  it('trade de uma perna com stop enviado junto: "Disciplinado" confirmado', () => {
    const p = perfilDe(tradeLong(), [entradaFill, stopDaEntrada, saida]);
    expect(p.emotionConfront.verdict).toBe('CONFIRMED');
    expect(emotionConfrontDisplay(p.emotionConfront, p.families).text)
      .toBe('Você declarou “Disciplinado” e a execução confirma — stop enviado junto com a entrada.');
  });

  it('entrada sem proteção enviada junto não confirma', () => {
    const stopTarde = { ...stopDaEntrada, submittedAt: `2026-09-10T10:20:00${OFF}` };
    const p = perfilDe(tradeLong(), [entradaFill, stopTarde, saida]);
    expect(p.emotionConfront.verdict).not.toBe('CONFIRMED');
  });
});

// ---------- dados existentes — recálculo com INV-30 ----------

describe('#477 · recálculo dos trades gravados (script)', () => {
  const montar = () => {
    const { trades, orders } = montarDia('2026-09-24-ordens.csv', 'lote-2409');
    const antigo = {
      version: '1.0.0', fingerprint: 'velho',
      families: [
        { canonicalCode: 'HESITATION', family: 'HESITATION', severity: 'LOW', valence: 'negative', emotionMapping: 'FEAR' },
        { canonicalCode: 'AVERAGING_DOWN', family: 'AVERAGING_DOWN', severity: 'LOW', valence: 'negative', emotionMapping: 'DENIAL' },
      ],
      emotionConfront: { declared: { name: 'Disciplinado', category: 'POSITIVE' }, suggested: { emotion: 'FEAR', code: 'HESITATION', severity: 'LOW' }, verdict: 'ATTENTION' },
    };
    const docs = {};
    for (const [id, t] of Object.entries(trades)) {
      docs[id] = { ...t, emotionEntry: 'Disciplinado', behaviorProfile: antigo };
      docs[`${id}-disc`] = { ...t, emotionEntry: 'Disciplinado', behaviorProfile: antigo, status: 'DISCUSSED' };
    }
    return fakeDb({ trades: docs, orders, plans: {}, emotions: { e1: { name: 'Disciplinado', analysisCategory: 'POSITIVE' } } });
  };
  const deps = {
    buildBehaviorProfiles, buildGetEmotionConfig, isTradeImmutable, updateTradeIfMutable,
    serverTimestamp: () => 'TS',
  };

  it('candidato = perfil com HESITATION, AVERAGING_DOWN ou confronto de gravidade baixa', () => {
    expect(candidato477({ behaviorProfile: { families: [{ canonicalCode: 'AVERAGING_DOWN' }] } })).toBe(true);
    expect(candidato477({ behaviorProfile: { families: [], emotionConfront: { suggested: { severity: 'LOW' } } } })).toBe(true);
    expect(candidato477({ behaviorProfile: { families: [{ canonicalCode: 'TILT' }] } })).toBe(false);
    expect(candidato477({})).toBe(false);
  });

  it('dry-run não escreve nada e lista o antes → depois', async () => {
    const db = montar();
    const r = await runRecompute477(db, { apply: false }, deps);
    expect(db.escritas).toEqual([]);
    const mudaria = r.linhas.find((l) => l.status === 'MUDARIA');
    expect(mudaria.antes).toMatch(/HESITATION/);
    expect(mudaria.depois).toMatch(/POSITION_BUILD_AGAINST/);
    expect(mudaria.depois).toMatch(/CONFIRMED/);
  });

  it('--apply grava só behaviorProfile, e o trade DISCUTIDO fica intocado (INV-30)', async () => {
    const db = montar();
    const r = await runRecompute477(db, { apply: true }, deps);
    expect(db.escritas).toHaveLength(1);
    expect(db.escritas[0].colecao).toBe('trades');
    expect(Object.keys(db.escritas[0].patch)).toEqual(['behaviorProfile']);
    expect(db.escritas[0].patch.behaviorProfile.computedBy).toBe('recalc-477');
    expect(db.escritas.map((e) => e.id)).not.toContain('T01-disc');
    expect(r.resumo.PRESERVADO).toBe(1);
    expect(r.resumo.ATUALIZADO).toBe(1);
    expect(db.dados.trades.get('T01-disc').behaviorProfile.fingerprint).toBe('velho');
    expect(ALUNO).toBe(db.dados.trades.get('T01').studentId);
  });
});
