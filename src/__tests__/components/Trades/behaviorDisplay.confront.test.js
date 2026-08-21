/**
 * #375 — o confronto emocional nunca imprime "null".
 *
 * Caso real (trade WINV26 de 21/08/2026): "Você declarou 'Calmo', mas a execução sugere
 * null." O padrão dominante era `UNPROTECTED_SIZE`, que é gate e não carrega emoção; o
 * sistema o elegeu como "a emoção do trade" e interpolou o vazio no texto.
 */
import { describe, it, expect } from 'vitest';
import { emotionConfrontDisplay } from '../../../components/Trades/behaviorDisplay';

const semNull = (out) => {
  if (!out) return;
  expect(out.text).not.toMatch(/null|undefined/);
};

describe('#375 — confronto emocional sem "null"', () => {
  it('perfil legado com suggested.emotion null não imprime a palavra null', () => {
    const out = emotionConfrontDisplay({
      declared: { name: 'Calmo', category: 'POSITIVE' },
      suggested: { emotion: null, code: 'UNPROTECTED_SIZE', severity: 'HIGH' },
      verdict: 'MISALIGNED',
    });
    expect(out).toBeTruthy();
    semNull(out);
    expect(out.text).toContain('Calmo');
  });

  it('sugestão com emoção de verdade segue nomeando a emoção', () => {
    const out = emotionConfrontDisplay({
      declared: { name: 'Confiante', category: 'POSITIVE' },
      suggested: { emotion: 'HOPE', code: 'UNPROTECTED_SIZE', severity: 'HIGH' },
      verdict: 'MISALIGNED',
    });
    expect(out.text).toContain('Esperança');
    semNull(out);
  });

  it.each(['MISALIGNED', 'ATTENTION', 'ALIGNED', 'NO_DECLARED'])(
    'veredicto %s com sugestão vazia nunca vaza null',
    (verdict) => {
      for (const category of ['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'CRITICAL']) {
        semNull(emotionConfrontDisplay({
          declared: { name: 'Calmo', category },
          suggested: { emotion: null, code: 'UNPROTECTED_SIZE', severity: 'HIGH' },
          verdict,
        }));
        semNull(emotionConfrontDisplay({
          declared: { name: 'Calmo', category }, suggested: null, verdict,
        }));
      }
    },
  );
});
