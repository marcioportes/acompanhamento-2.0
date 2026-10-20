import { describe, it, expect } from 'vitest';
import { reviewSwotGate } from '../../utils/reviewSwotGate';

const SWOT = { strengths: ['x'], weaknesses: [], opportunities: [], threats: [] };

describe('reviewSwotGate (#487)', () => {
  it('rascunho sem SWOT: gera, não publica', () => {
    expect(reviewSwotGate({ status: 'DRAFT', swot: null }))
      .toEqual({ canGenerate: true, canRegenerate: false, canPublish: false });
  });

  it('rascunho com SWOT: regenera e publica', () => {
    expect(reviewSwotGate({ status: 'DRAFT', swot: SWOT }))
      .toEqual({ canGenerate: false, canRegenerate: true, canPublish: true });
  });

  it('publicada sem SWOT: gera uma vez, não publica de novo', () => {
    expect(reviewSwotGate({ status: 'CLOSED' }))
      .toEqual({ canGenerate: true, canRegenerate: false, canPublish: false });
  });

  it('publicada com SWOT: nada — o aluno já viu', () => {
    expect(reviewSwotGate({ status: 'CLOSED', swot: SWOT }))
      .toEqual({ canGenerate: false, canRegenerate: false, canPublish: false });
  });

  it('arquivada: nada, com ou sem SWOT', () => {
    const off = { canGenerate: false, canRegenerate: false, canPublish: false };
    expect(reviewSwotGate({ status: 'ARCHIVED' })).toEqual(off);
    expect(reviewSwotGate({ status: 'ARCHIVED', swot: SWOT })).toEqual(off);
  });

  it('sem revisão: nada', () => {
    expect(reviewSwotGate(null))
      .toEqual({ canGenerate: false, canRegenerate: false, canPublish: false });
  });
});
