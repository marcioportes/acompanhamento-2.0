/**
 * #101 — "o que dói e o que funciona" na ficha do aluno.
 *
 * Referência negativa medida em 29/08: a Análise por Setup escondia atrás de
 * "Esporádicos" todo setup com menos de 3 trades. Na ficha do próprio Marcio isso
 * ocultava os TRÊS melhores (Ponto de Reação +1.021 em 2/2, Rompimento +630 em
 * 2/2, Continuidade +320) e deixava visíveis os dois que perdiam.
 */
import { describe, it, expect } from 'vitest';
import {
  agruparImpacto, extremos, diagnosticoDoAluno, fraseParaOFeedback, chaveSetup, chaveEmocao,
  prescricoes,
  alcanceDoAlvo,
  episodios,
  contaPrincipal,
} from '../../utils/studentDiagnosis';

const planos = new Map([
  ['p1', { id: 'p1', pl: 30000, riskPerOperation: 1 }],    // RO R$300
  ['pUSD', { id: 'pUSD', pl: 50000, riskPerOperation: 0.75 }], // RO US$375
]);

const t = (setup, result, extra = {}) => ({
  id: `${setup}-${result}-${Math.abs(result)}${extra.emotionEntry ?? ''}`,
  setup, result, planId: 'p1', currency: 'BRL', ...extra,
});

describe('chaves', () => {
  it('setup sem declaração não vira grupo anônimo', () => {
    expect(chaveSetup({ setup: '  4-Barras ' })).toBe('4-Barras');
    expect(chaveSetup({})).toBe('Sem setup');
  });

  it('a emoção que conta é a de ENTRADA — é a que descreve a decisão', () => {
    expect(chaveEmocao({ emotionEntry: 'ansiedade', emotion: 'euforia' })).toBe('Ansiedade');
    expect(chaveEmocao({ emotion: 'medo' })).toBe('Medo');
    expect(chaveEmocao({})).toBe('Não informada');
  });
});

describe('agruparImpacto', () => {
  it('mede em R quando o plano declara risco', () => {
    const [g] = agruparImpacto([t('4-Barras', 600)], chaveSetup, planos);
    expect(g.r).toBe(2);        // 600 / 300
    expect(g.rPorTrade).toBe(2);
  });

  it('soma contas de moedas diferentes em R, e recusa somar dinheiro', () => {
    const g = agruparImpacto([
      t('4-Barras', 600, { planId: 'p1', currency: 'BRL' }),
      t('4-Barras', -375, { planId: 'pUSD', currency: 'USD' }),
    ], chaveSetup, planos)[0];
    expect(g.r).toBe(1);          // +2R e −1R
    expect(g.moedaUnica).toBeNull(); // dinheiro não é exibível aqui
  });

  it('ordena da maior dor para a maior força', () => {
    const gs = agruparImpacto([
      t('Bom', 900), t('Ruim', -600), t('Neutro', 0),
    ], chaveSetup, planos);
    expect(gs.map((g) => g.chave)).toEqual(['Ruim', 'Neutro', 'Bom']);
  });

  it('conta acerto por trade, não por dinheiro', () => {
    const [g] = agruparImpacto([t('X', 100), t('X', 100), t('X', -1000)], chaveSetup, planos);
    expect(g.wr).toBe(67);
    expect(g.n).toBe(3);
  });

  it('sem plano, cai para dinheiro em vez de sumir', () => {
    const [g] = agruparImpacto([t('X', -500, { planId: 'inexistente' })], chaveSetup, planos);
    expect(g.comR).toBe(0);
    expect(g.pl).toBe(-500);
  });
});

describe('extremos — o defeito que motivou tudo isto', () => {
  it('NÃO esconde setup vencedor com amostra pequena', () => {
    // O caso real: 2 trades, 2 ganhos, o melhor da ficha.
    const gs = agruparImpacto([
      t('4-Barras', -400), t('4-Barras', -400), t('4-Barras', 100),
      t('Ponto de Reação', 700), t('Ponto de Reação', 321),
    ], chaveSetup, planos);
    const { dor, forca } = extremos(gs);
    expect(dor.chave).toBe('4-Barras');
    expect(forca.chave).toBe('Ponto de Reação');
    expect(forca.n).toBe(2); // amostra pequena, e ainda assim é a força
  });

  it('sem nada negativo, não inventa dor', () => {
    const { dor, forca } = extremos(agruparImpacto([t('X', 300)], chaveSetup, planos));
    expect(dor).toBeNull();
    expect(forca.chave).toBe('X');
  });

  it('sem nada positivo, não inventa força', () => {
    const { dor, forca } = extremos(agruparImpacto([t('X', -300)], chaveSetup, planos));
    expect(forca).toBeNull();
    expect(dor.chave).toBe('X');
  });

  it('lista vazia devolve os dois nulos', () => {
    expect(extremos([])).toEqual({ dor: null, forca: null });
  });
});

describe('diagnosticoDoAluno + fraseParaOFeedback', () => {
  const trades = [
    t('4-Barras', -400, { emotionEntry: 'Ansiedade' }),
    t('4-Barras', -400, { emotionEntry: 'Ansiedade' }),
    t('Ponto de Reação', 700, { emotionEntry: 'Confiança' }),
    t('Ponto de Reação', 321, { emotionEntry: 'Confiança' }),
  ];

  it('separa setup e emoção', () => {
    const d = diagnosticoDoAluno(trades, planos);
    expect(d.setups.dor.chave).toBe('4-Barras');
    expect(d.setups.forca.chave).toBe('Ponto de Reação');
    expect(d.emocoes.dor.chave).toBe('Ansiedade');
    expect(d.emocoes.forca.chave).toBe('Confiança');
  });

  it('a frase cita os dois lados com os números que a sustentam', () => {
    const frase = fraseParaOFeedback(diagnosticoDoAluno(trades, planos));
    expect(frase).toContain('4-Barras');
    expect(frase).toContain('Ponto de Reação');
    expect(frase).toContain('Ansiedade');
    expect(frase).toContain('Confiança');
    expect(frase).toContain('0% de acerto');
  });

  it('emoção não declarada vira cobrança de registro, não análise', () => {
    const frase = fraseParaOFeedback(diagnosticoDoAluno([t('X', -500)], planos));
    expect(frase).toContain('sem emoção declarada');
  });

  it('sem trade não há frase', () => {
    expect(fraseParaOFeedback(diagnosticoDoAluno([], planos))).toBeNull();
  });
});

describe('prescricoes — o que mudar e o que preservar', () => {
  const base = (extra = {}) => ({
    date: '2026-08-24', entryTime: '2026-08-24T10:00:00-03:00', exitTime: '2026-08-24T10:20:00-03:00',
    setup: '4-Barras', emotionEntry: 'Calmo', stopLoss: 100, takeProfit: 200, planId: 'p1',
    currency: 'BRL', result: 300, ...extra,
  });
  const idz = (arr) => arr.map((t, i) => ({ ...t, id: `t${i}` }));
  const tipos = (ps) => ps.map((p) => p.tipo);
  const acha = (ps, trecho) => ps.find((p) => p.mudanca.includes(trecho));

  // O ALVO ESTÁ NO PLANO (Marcio, 29/08), não no trade. `plan.rrTarget` existe nos
  // 28 planos da base; `trade.takeProfit` em nenhum dos 381 — e nunca precisou.
  const comAlvo = new Map([['p1', { id: 'p1', pl: 30000, riskPerOperation: 1, rrTarget: 2 }]]);
  // entry 100 / stop 90 → risco 10 por contrato; qty 1. Ganho 10 = 1R, ganho 30 = 3R.
  const trade = (result, extra = {}) => ({
    date: '2026-08-24', entryTime: '2026-08-24T10:00:00-03:00', exitTime: '2026-08-24T10:20:00-03:00',
    setup: 'X', emotionEntry: 'Calmo', planId: 'p1', currency: 'BRL',
    entry: 100, stopLoss: 90, qty: 1, result, ...extra,
  });

  it('cobra a saída antecipada quando o ganho não chega ao alvo do plano', () => {
    const ps = prescricoes(idz([trade(10), trade(10), trade(10), trade(30)]), comAlvo);
    const p = acha(ps, 'Levar o ganho até o alvo do plano (2R)');
    expect(p.tipo).toBe('operacional');
    expect(p.evidencia).toContain('3 de 4 ganhos ficaram abaixo do alvo');
  });

  it('não cobra quando a maioria dos ganhos chega ao alvo', () => {
    const ps = prescricoes(idz([trade(30), trade(30), trade(30), trade(10)]), comAlvo);
    expect(acha(ps, 'Levar o ganho')).toBeUndefined();
  });

  it('não cobra com menos de 4 ganhos — amostra não sustenta a conversa', () => {
    const ps = prescricoes(idz([trade(10), trade(10), trade(10)]), comAlvo);
    expect(acha(ps, 'Levar o ganho')).toBeUndefined();
  });

  it('perda não entra na conta do alvo — não existe perda que alcance alvo positivo', () => {
    const r = alcanceDoAlvo(idz([trade(30), trade(30), trade(30), trade(30), trade(-10), trade(-10)]), comAlvo);
    expect(r.vencedores).toBe(4);
    expect(r.pctAtingiu).toBe(100);
  });

  it('sem plano com alvo, não há o que medir', () => {
    expect(alcanceDoAlvo(idz([trade(30)]), new Map())).toBeNull();
  });

  it('cobra stop a partir de 20% dos trades sem ele', () => {
    const ps = prescricoes(idz([base({ stopLoss: null }), base(), base(), base()]), planos);
    expect(acha(ps, 'Declarar o stop').evidencia).toContain('1 de 4');
  });

  it('suspende o setup que drena, com amostra que sustenta a conversa', () => {
    const ruins = idz([
      base({ setup: 'Tendência', result: -300 }),
      base({ setup: 'Tendência', result: -300 }),
      base({ setup: 'Tendência', result: -300 }),
      base({ setup: 'Ponto', result: 900 }),
    ]);
    const p = acha(prescricoes(ruins, planos), 'Suspender Tendência');
    expect(p.evidencia).toContain('3 trades, 0% de acerto');
  });

  it('não suspende setup com amostra de 2 — vira observação, não veredicto', () => {
    const ps = prescricoes(idz([
      base({ setup: 'Tendência', result: -300 }), base({ setup: 'Tendência', result: -300 }),
      base({ setup: 'Ponto', result: 900 }), base({ setup: 'Ponto', result: 900 }),
    ]), planos);
    expect(acha(ps, 'Suspender')).toBeUndefined();
  });

  it('fecha a porta do estado emocional que não entrega', () => {
    const ps = prescricoes(idz([
      base({ emotionEntry: 'Ansioso', result: -300 }),
      base({ emotionEntry: 'Ansioso', result: -300 }),
      base({ emotionEntry: 'Ansioso', result: -300 }),
      base({ emotionEntry: 'Calmo', result: 900 }),
    ]), planos);
    const p = acha(ps, 'Não abrir operação em estado "Ansioso"');
    expect(p.tipo).toBe('emocional');
    expect(p.comoDizer).toContain('não operar nela');
  });

  it('vira regra de parada quando há 3 perdas seguidas no dia', () => {
    const seq = idz([
      base({ result: -100, entryTime: '2026-08-24T10:00:00-03:00' }),
      base({ result: -100, entryTime: '2026-08-24T11:00:00-03:00' }),
      base({ result: -100, entryTime: '2026-08-24T12:00:00-03:00' }),
    ]);
    expect(acha(prescricoes(seq, planos), 'Parar o dia').evidencia).toContain('1 dia');
  });

  it('perdas em dias diferentes não viram sequência', () => {
    const espalhado = idz([
      base({ result: -100, date: '2026-08-24' }),
      base({ result: -100, date: '2026-08-25' }),
      base({ result: -100, date: '2026-08-26' }),
    ]);
    expect(acha(prescricoes(espalhado, planos), 'Parar o dia')).toBeUndefined();
  });

  it('reconhece quem corta a perda rápido e deixa o ganho correr', () => {
    // Medido na base: Rafael segura o vencedor 74min contra 23min do perdedor.
    // É o inverso do efeito disposição, e ninguém dizia ao aluno que ele já faz.
    const oito = idz([
      ...new Array(4).fill(0).map(() => base({ result: 300, exitTime: '2026-08-24T11:14:00-03:00' })),
      ...new Array(4).fill(0).map(() => base({ result: -100, exitTime: '2026-08-24T10:23:00-03:00' })),
    ]);
    const p = acha(prescricoes(oito, planos), 'assimetria de tempo');
    expect(p.tipo).toBe('preservar');
    expect(p.evidencia).toMatch(/vencedor dura \d+min contra \d+min/);
  });

  it('não elogia assimetria com amostra insuficiente', () => {
    const poucos = idz([base({ result: 300 }), base({ result: -100 })]);
    expect(acha(prescricoes(poucos, planos), 'assimetria de tempo')).toBeUndefined();
  });

  it('a ordem é operacional, depois emocional, depois preservar', () => {
    const ps = prescricoes(idz([
      base({ setup: 'Tendência', result: -300, emotionEntry: 'Ansioso', takeProfit: null }),
      base({ setup: 'Tendência', result: -300, emotionEntry: 'Ansioso', takeProfit: null }),
      base({ setup: 'Tendência', result: -300, emotionEntry: 'Ansioso', takeProfit: null }),
      base({ setup: 'Ponto', result: 900, takeProfit: null }),
    ]), planos);
    const ordem = tipos(ps);
    expect(ordem.indexOf('operacional')).toBeLessThan(ordem.indexOf('emocional'));
    expect(ordem.lastIndexOf('emocional')).toBeLessThan(ordem.indexOf('preservar'));
  });

  it('sem trade não há prescrição', () => {
    expect(prescricoes([], planos)).toEqual([]);
  });

  it('toda prescrição carrega evidência e como dizer — nenhuma frase solta', () => {
    const ps = prescricoes(idz([
      base({ result: -300, takeProfit: null, stopLoss: null, emotionEntry: 'Ansioso' }),
      base({ result: -300, takeProfit: null, stopLoss: null, emotionEntry: 'Ansioso' }),
      base({ result: -300, takeProfit: null, stopLoss: null, emotionEntry: 'Ansioso' }),
    ]), planos);
    expect(ps.length).toBeGreaterThan(0);
    for (const p of ps) {
      expect(p.mudanca).toBeTruthy();
      expect(p.evidencia).toBeTruthy();
      expect(p.comoDizer).toBeTruthy();
    }
  });
});

describe('prescrição emocional exige magnitude, não só sinal', () => {
  const t2 = (emo, r, id) => ({
    id, date: '2026-08-24', entryTime: `2026-08-24T1${id}:00:00-03:00`, exitTime: `2026-08-24T1${id}:30:00-03:00`,
    setup: 'X', emotionEntry: emo, stopLoss: 1, takeProfit: 2, planId: 'p1', currency: 'BRL', result: r,
  });

  it('estado com prejuízo irrisório não vira regra', () => {
    // Wilson, base real: "Neutro" com 4 trades, 25% e −0,3R aparecia ao lado de
    // "Ansioso" com −3,8R e 0% de acerto.
    const ps = prescricoes([t2('Neutro', -30, 1), t2('Neutro', -30, 2), t2('Neutro', -30, 3), t2('Neutro', 300, 4)], planos);
    expect(ps.find((p) => p.mudanca.includes('Não abrir'))).toBeUndefined();
  });

  it('estado que custa um risco inteiro vira regra', () => {
    const ps = prescricoes([t2('Ansioso', -300, 1), t2('Ansioso', -300, 2), t2('Ansioso', -300, 3)], planos);
    expect(ps.find((p) => p.mudanca.includes('Não abrir operação em estado "Ansioso"'))).toBeTruthy();
  });
});

describe('episodios — o que sobrou do Perfil Emocional', () => {
  const comFamilia = (data, code, severity = 'HIGH', extra = {}) => ({
    id: `${data}-${code}`, date: data, entryTime: `${data}T10:00:00-03:00`, result: -300,
    planId: 'p1', behaviorProfile: { families: [{ canonicalCode: code, severity }] }, ...extra,
  });

  it('vira linha com data, o que aconteceu e quanto custou o dia', () => {
    const e = episodios([comFamilia('2026-08-26', 'TILT')], planos);
    expect(e).toHaveLength(1);
    expect(e[0].data).toBe('2026-08-26');
    expect(e[0].marcas).toContain('perdeu o controle depois de uma perda');
    expect(e[0].r).toBe(-1); // −300 num RO de 300
  });

  it('junta várias marcas do mesmo dia numa linha só', () => {
    const e = episodios([
      comFamilia('2026-08-26', 'TILT'),
      comFamilia('2026-08-26', 'LOSS_CHASING'),
    ], planos);
    expect(e).toHaveLength(1);
    expect(e[0].marcas).toHaveLength(2);
    expect(e[0].trades).toBe(2);
  });

  it('sequência de perdas do dia entra mesmo sem detector comportamental', () => {
    const semProfile = (h) => ({
      id: `t${h}`, date: '2026-08-24', entryTime: `2026-08-24T1${h}:00:00-03:00`, result: -100, planId: 'p1',
    });
    const e = episodios([semProfile(0), semProfile(1), semProfile(2)], planos);
    expect(e[0].marcas).toContain('3 perdas seguidas');
  });

  it('padrão liberado pelo mentor não vira episódio', () => {
    const t = comFamilia('2026-08-26', 'TILT');
    const e = episodios([{ ...t, mentorClearedViolations: [`TILT:${t.id}`] }], planos);
    expect(e).toEqual([]);
  });

  it('família positiva não vira episódio', () => {
    expect(episodios([comFamilia('2026-08-26', 'TARGET_HIT', 'NONE')], planos)).toEqual([]);
  });

  it('mais recente primeiro — é a ordem em que o mentor lê', () => {
    const e = episodios([
      comFamilia('2026-08-20', 'TILT'),
      comFamilia('2026-08-26', 'DIRECTION_FLIP'),
    ], planos);
    expect(e.map((x) => x.data)).toEqual(['2026-08-26', '2026-08-20']);
  });

  it('sem trade não há episódio', () => {
    expect(episodios([], planos)).toEqual([]);
  });
});

describe('contaPrincipal — onde o aluno de fato opera', () => {
  const t = (planId, date) => ({ id: `${planId}-${date}`, planId, date, result: 100 });

  it('escolhe a conta de MAIOR VOLUME, não a do último trade', () => {
    // Daniel, base real: o último trade dele foi numa conta com 1 trade, enquanto
    // a principal tinha 6. Pela regra antiga a ficha media 1 de 7.
    const c = contaPrincipal([
      t('grande', '2026-07-01'), t('grande', '2026-07-02'), t('grande', '2026-07-03'),
      t('pequena', '2026-08-30'),
    ]);
    expect(c.planId).toBe('grande');
    expect(c.trades).toBe(3);
    expect(c.fora).toBe(1);
  });

  it('empate no volume decide pelo mais recente', () => {
    const c = contaPrincipal([t('velha', '2026-01-01'), t('nova', '2026-08-30')]);
    expect(c.planId).toBe('nova');
  });

  it('declara quantos trades ficaram fora da medida', () => {
    const c = contaPrincipal([t('a', '2026-08-01'), t('a', '2026-08-02'), t('b', '2026-08-03')]);
    expect(c.fora).toBe(1);
  });

  it('uma conta só não deixa nada de fora', () => {
    expect(contaPrincipal([t('a', '2026-08-01'), t('a', '2026-08-02')]).fora).toBe(0);
  });

  it('trade sem plano não cria conta fantasma', () => {
    expect(contaPrincipal([{ id: 'x', date: '2026-08-01', result: 10 }])).toBeNull();
  });

  it('sem trade não há conta', () => {
    expect(contaPrincipal([])).toBeNull();
  });
});
