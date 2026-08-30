/**
 * #101 (29/08/2026) — "acabamos de promover o Wilson e a torre tá dizendo pra rever".
 *
 * Regra de domínio de Marcio: **uma vez promovido, tudo é zerado — é como se ele
 * começasse de novo.** Não é carência nem amortecimento: o motor passa a medir o
 * aluno só pelos trades a partir da promoção.
 *
 * Sem isso, o gatilho 3 de `detectRegressionSignal` — que compara as métricas com
 * o estágio ATUAL — acusava regressão em TODA promoção, porque o estágio subia e
 * os dados continuavam os mesmos. Estado real do Wilson: currentStage 3, gates
 * 6/14, "métricas mapeiam para stage 2 (< 3)".
 */
import { describe, it, expect } from 'vitest';
import { tradesDoEstagioAtual as corte } from '../../../../functions/maturity/recomputeMaturity';

const trades = [
  { id: 'velho1', date: '2026-06-01', result: -100 },
  { id: 'velho2', date: '2026-07-15', result: -200 },
  { id: 'novo1', date: '2026-08-29', result: 300 },
  { id: 'novo2', date: '2026-08-30', result: 150 },
];

describe('corte da janela na promoção', () => {
  it('depois de promovido, o motor vê só a vida nova', () => {
    expect(corte(trades, '2026-08-29').map((t) => t.id)).toEqual(['novo1', 'novo2']);
  });

  it('o dia da promoção entra — a vida nova começa nele', () => {
    expect(corte(trades, '2026-08-29').some((t) => t.id === 'novo1')).toBe(true);
  });

  it('aluno nunca promovido é medido pelo histórico inteiro', () => {
    expect(corte(trades, null)).toHaveLength(4);
  });

  it('promovido hoje, sem trade novo, começa com janela vazia — e isso é correto', () => {
    // Gates 0/N e confiança baixa descrevem a verdade: não há evidência ainda.
    // O erro era o contrário — herdar a evidência do estágio anterior e chamá-la
    // de regressão.
    expect(corte(trades, '2026-09-01')).toEqual([]);
  });

  it('trade sem data não entra na janela nova por acidente', () => {
    const comLixo = [...trades, { id: 'semData', result: 999 }];
    expect(corte(comLixo, '2026-08-29').map((t) => t.id)).toEqual(['novo1', 'novo2']);
  });

  it('aceita Timestamp do Firestore, Date e string — é assim que a data chega', () => {
    const dia = new Date('2026-08-29T12:00:00Z');
    expect(corte(trades, { toDate: () => dia })).toHaveLength(2);
    expect(corte(trades, dia)).toHaveLength(2);
    expect(corte(trades, '2026-08-29')).toHaveLength(2);
  });

  it('entrada inválida não zera a janela por acidente', () => {
    expect(corte(trades, undefined)).toHaveLength(4);
    expect(corte(null, '2026-08-29')).toEqual([]);
  });
});
