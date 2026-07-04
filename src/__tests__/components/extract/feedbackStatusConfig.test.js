/**
 * feedbackStatusConfig.test.js (#333)
 * @description Trava a regressão: trade em status terminal DISCUSSED (revisado +
 *   discutido numa revisão semanal publicada, #269 v2) NUNCA pode ser rotulado
 *   como "Pendente" na coluna Status do extrato. Antes do #333 o switch não
 *   tratava DISCUSSED e ele caía no default → "Pendente".
 */

import { describe, it, expect } from 'vitest';
import { getFeedbackStatusConfig } from '../../../components/extract/ExtractTable';

describe('getFeedbackStatusConfig (#333)', () => {
  it('DISCUSSED → "Discutido" (índigo), jamais "Pendente"', () => {
    const cfg = getFeedbackStatusConfig('DISCUSSED');
    expect(cfg.label).toBe('Discutido');
    expect(cfg.label).not.toBe('Pendente');
    expect(cfg.color).toContain('indigo');
  });

  it('OPEN → "Pendente"', () => {
    expect(getFeedbackStatusConfig('OPEN').label).toBe('Pendente');
  });

  it('REVIEWED → "Revisado"', () => {
    expect(getFeedbackStatusConfig('REVIEWED').label).toBe('Revisado');
  });

  it('QUESTION → "Dúvida"', () => {
    expect(getFeedbackStatusConfig('QUESTION').label).toBe('Dúvida');
  });

  it('CLOSED → "Fechado" com cor própria (roxo), distinta de Pendente', () => {
    const closed = getFeedbackStatusConfig('CLOSED');
    const pending = getFeedbackStatusConfig('OPEN');
    expect(closed.label).toBe('Fechado');
    expect(closed.color).toContain('purple');
    expect(closed.color).not.toBe(pending.color);
  });

  it('status desconhecido → fallback "Pendente" (comportamento preservado)', () => {
    expect(getFeedbackStatusConfig('FOO_BAR').label).toBe('Pendente');
    expect(getFeedbackStatusConfig(undefined).label).toBe('Pendente');
  });
});
