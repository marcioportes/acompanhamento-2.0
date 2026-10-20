/**
 * #492 — o confronto não chama de "limpa" a execução que saiu do plano.
 *
 * Caso real (WINZ26, 20/10/2026): declarou Ganância, sem stop, único padrão "Modelo não
 * declarado" (sem emoção). A tela dizia "a execução saiu limpa" acima de "Violações (1)".
 */
import { describe, it, expect } from 'vitest';
import { emotionConfrontDisplay } from '../../../components/Trades/behaviorDisplay';

const modeloNaoDeclarado = [{
  family: 'UNDECLARED_MODEL', canonicalCode: 'UNDECLARED_MODEL', severity: 'MEDIUM',
  emotionMapping: null, valence: 'negative', isGate: false, evidence: { setup: 'Indefinido' },
}];
const ganancia = { declared: { name: 'Ganância', category: 'CRITICAL' }, suggested: null, verdict: 'ATTENTION' };

describe('#492 — violação de plano no confronto emocional', () => {
  it('emoção crítica + sem stop: cita a violação e pergunta, não diz "limpa"', () => {
    const out = emotionConfrontDisplay(ganancia, modeloNaoDeclarado, [{ type: 'TRADE_SEM_STOP' }]);
    expect(out).toEqual({
      tone: 'amber',
      text: 'Você declarou “Ganância”, e a execução saiu do plano: sem stop declarado. Confere se foi essa emoção que conduziu a operação?',
    });
  });

  it('várias violações entram todas no fato', () => {
    const out = emotionConfrontDisplay(ganancia, modeloNaoDeclarado, ['TRADE_SEM_STOP', { type: 'RISCO_ACIMA_PERMITIDO' }]);
    expect(out.text).toContain('saiu do plano: sem stop declarado, risco acima do autorizado.');
  });

  it('emoção negativa + violação não vira "boa regulação emocional"', () => {
    const out = emotionConfrontDisplay(
      { declared: { name: 'Ansiedade', category: 'NEGATIVE' }, suggested: null, verdict: 'ALIGNED' },
      modeloNaoDeclarado, [{ type: 'TRADE_SEM_STOP' }],
    );
    expect(out.text).not.toMatch(/limpo|regulação/);
    expect(out.text).toContain('saiu do plano: sem stop declarado');
  });

  it('emoção positiva + violação: banner aparece (antes era silêncio de "ideal")', () => {
    const out = emotionConfrontDisplay(
      { declared: { name: 'Confiança', category: 'POSITIVE' }, suggested: null, verdict: 'ALIGNED' },
      [], [{ type: 'RISCO_ACIMA_PERMITIDO' }],
    );
    expect(out.text).toBe('Você declarou “Confiança”, mas a execução saiu do plano: risco acima do autorizado — vale revisitar o que você sentiu de fato na entrada.');
  });

  it('sem violação, segue o texto de antes ("limpa" só quando é limpa)', () => {
    expect(emotionConfrontDisplay(ganancia, modeloNaoDeclarado, []).text)
      .toBe('Você declarou “Ganância”, mas a execução saiu limpa — vale confirmar a intensidade.');
    expect(emotionConfrontDisplay(ganancia, modeloNaoDeclarado).text).toMatch(/saiu limpa/);
  });

  it('sem emoção declarada, violação sozinha não gera banner', () => {
    expect(emotionConfrontDisplay(
      { declared: null, suggested: null, verdict: 'NO_DECLARED' }, [], [{ type: 'TRADE_SEM_STOP' }],
    )).toBeNull();
  });

  it('com padrão que sugere emoção, a hipótese continua sendo a manchete', () => {
    const fam = [{ canonicalCode: 'HESITATION', severity: 'HIGH', emotionMapping: 'FEAR', valence: 'negative', evidence: {} }];
    const out = emotionConfrontDisplay(
      { declared: { name: 'Confiança', category: 'POSITIVE' }, suggested: null, verdict: 'MISALIGNED' },
      fam, [{ type: 'TRADE_SEM_STOP' }],
    );
    expect(out.text).not.toContain('saiu do plano: sem stop');
  });
});
