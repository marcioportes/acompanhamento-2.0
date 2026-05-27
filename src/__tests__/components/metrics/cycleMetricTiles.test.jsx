/**
 * cycleMetricTiles.test.jsx — issue #282
 * SSoT de apresentação de métricas de ciclo: content fns puras (faixas + estados insuficientes).
 */
import { describe, it, expect } from 'vitest';
import {
  sharpeContent, cvContent, mepContent, menContent,
  expectancyContent, winRateContent, payoffContent,
  profitFactorContent, drawdownContent, adherenceContent,
  buildSharpeTooltip, buildCvTooltip,
} from '../../../components/metrics/cycleMetricTiles';

describe('cycleMetricTiles — consistência', () => {
  it('sharpeContent: valor formatado + banda por faixa', () => {
    expect(sharpeContent({ value: 2.3, source: 'BCB' }).value).toBe('2.30');
    expect(sharpeContent({ value: 2.3 }).bandLabel).toBe('Excepcional');
    expect(sharpeContent({ value: 1.6 }).bandLabel).toBe('Bom');
    expect(sharpeContent({ value: 1.1 }).bandLabel).toBe('OK');
    expect(sharpeContent({ value: 0.3 }).bandLabel).toBe('Fraco');
    expect(sharpeContent({ value: -0.5 }).bandLabel).toBe('Negativo');
  });

  it('sharpeContent: estados insuficientes', () => {
    expect(sharpeContent({ value: null, insufficientReason: 'no_pl_start' }).value).toMatch(/saldo inicial/);
    expect(sharpeContent({ value: null, insufficientReason: 'min_days' }, { minDays: 5 }).value).toMatch(/≥5 dias/);
    expect(sharpeContent(null).value).toBe('-');
  });

  it('cvContent: faixa "No plano" e label de insuficiência', () => {
    expect(cvContent({ value: 0.59 }).bandLabel).toBe('No plano');
    expect(cvContent({ value: 1.8 }).bandLabel).toBe('Errático');
    expect(cvContent({ value: null, label: 'Insuficiente · ≥5 dias' }).value).toMatch(/Insuficiente/);
  });

  it('mep/menContent: % formatado com sinal e aviso de cobertura', () => {
    expect(mepContent({ avgMEP: 1.2 }).value).toBe('+1.2%');
    expect(menContent({ avgMEN: -0.4 }).value).toBe('-0.4%');
    expect(mepContent({ avgMEP: null, insufficientReason: 'no_excursion_data' }).value).toMatch(/Sem dado MEP\/MEN/);
  });

  it('tooltips didáticos contêm a explicação-âncora', () => {
    expect(buildSharpeTooltip({ value: 2.3, daysWithTrade: 16 }, 'ABR/2026')).toMatch(/Selic/);
    expect(buildCvTooltip({ value: 0.59 }, { rrTarget: 2 })).toMatch(/RR 2\.0/);
  });
});

describe('cycleMetricTiles — performance (técnico + tooltip)', () => {
  it('expectancyContent: faixas', () => {
    expect(expectancyContent(1.01)).toMatchObject({ value: '+1.01R', bandLabel: 'Excelente' });
    expect(expectancyContent(0.3).bandLabel).toBe('Bom');
    expect(expectancyContent(0.1).bandLabel).toBe('Frágil');
    expect(expectancyContent(-0.2)).toMatchObject({ value: '-0.20R', bandLabel: 'Negativo' });
    expect(expectancyContent(null).value).toBe('—');
  });

  it('winRateContent: % + caption', () => {
    const r = winRateContent(0.677, 21, 31);
    expect(r.value).toBe('67.7%');
    expect(r.caption).toBe('21 de 31 trades');
    expect(winRateContent(0.35).theme.text).toMatch(/orange/);
  });

  it('payoffContent: razão + caption; sem perdas → traço', () => {
    const r = payoffContent(1.8, -0.9);
    expect(r.value).toBe('2.00');
    expect(r.bandLabel).toBe('Robusto');
    expect(r.caption).toBe('1.80R / -0.90R');
    expect(payoffContent(1.8, 0).value).toBe('—');
  });

  it('profitFactorContent: faixas', () => {
    expect(profitFactorContent(4.15)).toMatchObject({ value: '4.15', bandLabel: 'Sólido' });
    expect(profitFactorContent(1.2).bandLabel).toBe('No positivo');
    expect(profitFactorContent(0.8).bandLabel).toBe('No negativo');
  });

  it('drawdownContent: % absoluto + caption R$', () => {
    const r = drawdownContent(-0.005, -96);
    expect(r.value).toBe('0.5%');
    expect(r.theme.text).toMatch(/emerald/);
    expect(drawdownContent(-0.25).theme.text).toMatch(/red/);
  });

  it('adherenceContent: faixas + caption', () => {
    expect(adherenceContent(1.0, 0).caption).toBe('sem violações');
    expect(adherenceContent(1.0).theme.text).toMatch(/emerald/);
    expect(adherenceContent(0.7, 3)).toMatchObject({ caption: '3 tipos de violação' });
    expect(adherenceContent(0.7).theme.text).toMatch(/red/);
  });
});
