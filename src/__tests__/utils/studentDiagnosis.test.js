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

  it('cobra alvo quando quase nada tem alvo declarado — 0 de 381 na base real', () => {
    const ps = prescricoes(idz([base({ takeProfit: null }), base({ takeProfit: null }), base({ takeProfit: null })]), planos);
    const p = acha(ps, 'Declarar o alvo');
    expect(p.evidencia).toContain('nenhum dos 3');
    expect(p.tipo).toBe('operacional');
  });

  it('não cobra alvo quando o aluno declara', () => {
    const ps = prescricoes(idz([base(), base(), base()]), planos);
    expect(acha(ps, 'Declarar o alvo')).toBeUndefined();
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
