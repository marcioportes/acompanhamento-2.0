/**
 * Confronto emocional — matriz aprovada (categoria da emoção declarada × severidade do
 * padrão dominante). CHUNK-11 Fase 2 (#301). Testa a matriz exaustivamente via famílias
 * sintéticas (severidade controlada — HIGH é difícil de plantar com trade real).
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { computeEmotionConfront } = require('../../../../functions/behavior/buildBehaviorProfile.js');

// família negativa sintética com severidade dada
const neg = (severity, { emotion = 'REVENGE', code = 'LOSS_CHASING', gate = true } = {}) => ({
  family: code, canonicalCode: code, severity, valence: 'negative', emotionMapping: emotion, isGate: gate,
});
const positive = { family: 'CLEAN_EXECUTION', canonicalCode: 'CLEAN_EXECUTION', severity: null, valence: 'positive', emotionMapping: 'DISCIPLINE', isGate: false };

// getEmotionConfig fake: mapeia nome → categoria
const gec = (category) => () => ({ analysisCategory: category });
const trade = (emo) => ({ id: 'T', emotionEntry: emo });

const verdict = (declaredCat, families, emo = 'X') =>
  computeEmotionConfront(trade(emo), families, gec(declaredCat)).verdict;

describe('computeEmotionConfront — matriz', () => {
  it('POSITIVA: limpo→ALIGNED, baixo→ATTENTION, médio/alto→MISALIGNED', () => {
    expect(verdict('POSITIVE', [positive])).toBe('ALIGNED');
    expect(verdict('POSITIVE', [neg('LOW')])).toBe('ATTENTION');
    expect(verdict('POSITIVE', [neg('MEDIUM')])).toBe('MISALIGNED');
    expect(verdict('POSITIVE', [neg('HIGH')])).toBe('MISALIGNED');
  });

  it('NEUTRA: limpo/baixo→ALIGNED, médio→ATTENTION, alto→MISALIGNED', () => {
    expect(verdict('NEUTRAL', [positive])).toBe('ALIGNED');
    expect(verdict('NEUTRAL', [neg('LOW')])).toBe('ALIGNED');
    expect(verdict('NEUTRAL', [neg('MEDIUM')])).toBe('ATTENTION');
    expect(verdict('NEUTRAL', [neg('HIGH')])).toBe('MISALIGNED');
  });

  it('NEGATIVA: limpo/baixo/médio→ALIGNED (regulou/consciente), alto→ATTENTION', () => {
    expect(verdict('NEGATIVE', [positive])).toBe('ALIGNED');      // regulou
    expect(verdict('NEGATIVE', [neg('LOW')])).toBe('ALIGNED');    // consciente
    expect(verdict('NEGATIVE', [neg('MEDIUM')])).toBe('ALIGNED'); // consciente
    expect(verdict('NEGATIVE', [neg('HIGH')])).toBe('ATTENTION'); // consciente mas não conteve
  });

  it('CRÍTICA: limpo→ATTENTION (verificar), negativo→ALIGNED (consciente)', () => {
    expect(verdict('CRITICAL', [positive])).toBe('ATTENTION');
    expect(verdict('CRITICAL', [neg('HIGH')])).toBe('ALIGNED');
  });

  it('sem emoção declarada → NO_DECLARED (mas ainda sugere a detectada)', () => {
    const r = computeEmotionConfront(trade(null), [neg('HIGH')], gec('POSITIVE'));
    expect(r.verdict).toBe('NO_DECLARED');
    expect(r.declared).toBeNull();
    expect(r.suggested).toEqual({ emotion: 'REVENGE', code: 'LOSS_CHASING', severity: 'HIGH' });
  });

  it('emoção sugerida = família negativa DOMINANTE (maior severidade)', () => {
    const fams = [neg('LOW', { emotion: 'IMPULSIVITY', code: 'OVERTRADING' }), neg('HIGH', { emotion: 'REVENGE', code: 'LOSS_CHASING' })];
    const r = computeEmotionConfront(trade('Confiante'), fams, gec('POSITIVE'));
    expect(r.suggested.code).toBe('LOSS_CHASING'); // HIGH vence LOW
    expect(r.verdict).toBe('MISALIGNED');
  });

  it('trade limpo (só positivo) → suggested null', () => {
    const r = computeEmotionConfront(trade('Calmo'), [positive], gec('POSITIVE'));
    expect(r.suggested).toBeNull();
    expect(r.verdict).toBe('ALIGNED');
  });
});
