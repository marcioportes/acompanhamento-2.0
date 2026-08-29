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
