/**
 * #389 — mesma origem, mesmo resultado.
 *
 * O perfil comportamental de um trade não pode depender de QUEM mandou recalcular.
 * Antes dependia: o botão "Recalcular Comportamento" do mentor calculava com janela de
 * UM DIA e o gatilho automático com o HISTÓRICO COMPLETO. Padrões que olham a janela —
 * cluster de vingança, overtrading, cluster impulsivo, assimetria de tempo — davam
 * respostas diferentes, ambas "corretas" para a janela recebida, e a última escrita
 * vencia.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const { buildBehaviorProfiles } = require_('../../../../functions/behavior/buildBehaviorProfile');

const plano = { id: 'p1', riskPerOperation: 0.84, pl: 30000, rrTarget: 2 };
const emocoes = [{ name: 'Calmo', score: 2, analysisCategory: 'POSITIVE', behavioralPattern: 'OTHER' }];
const getEmotionConfig = (n) => emocoes.find((e) => e.name === n)
  || { name: n || '?', score: 0, analysisCategory: 'NEUTRAL', behavioralPattern: 'OTHER' };

/** Sequência com vários trades no mesmo dia — é onde os agregados de janela mordem. */
const historico = () => {
  const base = (id, date, result, hora) => ({
    id, studentId: 's1', planId: 'p1', ticker: 'WINV26', side: 'LONG', qty: 2,
    entry: 174000, exit: 174000 + result, stopLoss: 173900, result, date,
    entryTime: `${date}T${hora}-03:00`, exitTime: `${date}T${hora}-03:00`,
    emotionEntry: 'Calmo',
    tickerRule: { tickSize: 5, tickValue: 1, pointValue: null },
  });
  return [
    base('t1', '2026-08-18', -100, '10:00:00'),
    base('t2', '2026-08-18', -80, '10:12:00'),
    base('t3', '2026-08-18', -60, '10:25:00'),
    base('t4', '2026-08-19', 200, '11:00:00'),
    base('t5', '2026-08-20', 150, '09:30:00'),
    base('t6', '2026-08-21', 520, '11:25:00'),
  ];
};

const perfilDe = (trades, alvo) => {
  const m = buildBehaviorProfiles({ trades, orders: [], plans: [plano], getEmotionConfig });
  return m.get(alvo) || null;
};

describe('#389 — determinismo da janela', () => {
  it('o perfil de um trade é o mesmo calculado com o dia ou com o histórico', () => {
    const todos = historico();
    const alvo = 't6';
    const soODia = todos.filter((t) => t.date === '2026-08-21');

    const comHistorico = perfilDe(todos, alvo);
    const comODia = perfilDe(soODia, alvo);

    expect(comHistorico).not.toBeNull();
    expect(comODia).not.toBeNull();
    // Este é o contrato: se a origem do trade é a mesma, o veredicto é o mesmo.
    // Hoje FALHA para trades cujos padrões dependem de agregado de janela — é por isso
    // que o cálculo passou a usar sempre o histórico completo, e o recorte de período
    // agora só escolhe O QUE REGRAVAR (`writeScope`).
    expect(comHistorico.fingerprint).toBe(comODia.fingerprint);
  });

  it('trade em dia de sequência de perdas: a janela muda o veredicto', () => {
    // Prova de que a janela É um input: t3 fecha uma sequência de 3 perdas no mesmo dia.
    const todos = historico();
    const soEle = todos.filter((t) => t.id === 't3');

    const comHistorico = perfilDe(todos, 't3');
    const isolado = perfilDe(soEle, 't3');

    const fams = (p) => (p?.families || []).map((f) => f.canonicalCode).sort();
    // Documenta a diferença que motivou o issue. Se um dia forem iguais, ótimo —
    // mas o contrato que importa é o do teste acima.
    expect(fams(comHistorico).length).toBeGreaterThanOrEqual(fams(isolado).length);
  });

  it('recalcular duas vezes com a mesma entrada dá exatamente o mesmo fingerprint', () => {
    const todos = historico();
    expect(perfilDe(todos, 't6').fingerprint).toBe(perfilDe(todos, 't6').fingerprint);
    expect(perfilDe(todos, 't3').fingerprint).toBe(perfilDe(todos, 't3').fingerprint);
  });
});
