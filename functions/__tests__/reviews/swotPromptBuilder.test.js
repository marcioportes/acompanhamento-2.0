/**
 * swotPromptBuilder.test.js — Issue #262 (metade-semanal)
 *
 * Cobre o builder puro de estilo da SWOT (tom/foco/profundidade).
 */

import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  SWOT_STYLE_DEFAULT, clampSwotStyle, buildStyleDirectives, buildStyledSystemPrompt,
} = require('../../_shared/swotPromptBuilder');

describe('clampSwotStyle', () => {
  it('defaults para neutro quando ausente/ inválido', () => {
    expect(clampSwotStyle(undefined)).toEqual(SWOT_STYLE_DEFAULT);
    expect(clampSwotStyle({ tone: 9, focus: 0, depth: 'x' })).toEqual({ tone: 2, focus: 2, depth: 2 });
  });
  it('preserva valores válidos 1..3', () => {
    expect(clampSwotStyle({ tone: 1, focus: 3, depth: 2 })).toEqual({ tone: 1, focus: 3, depth: 2 });
  });
});

describe('buildStyleDirectives', () => {
  it('estilo neutro → nenhuma diretiva', () => {
    expect(buildStyleDirectives(SWOT_STYLE_DEFAULT)).toEqual([]);
    expect(buildStyleDirectives(undefined)).toEqual([]);
  });
  it('um eixo não-neutro → uma diretiva', () => {
    const d = buildStyleDirectives({ tone: 1, focus: 2, depth: 2 });
    expect(d).toHaveLength(1);
    expect(d[0]).toMatch(/^TOM:/);
  });
  it('três eixos não-neutros → três diretivas, na ordem tone→focus→depth', () => {
    const d = buildStyleDirectives({ tone: 3, focus: 1, depth: 3 });
    expect(d).toHaveLength(3);
    expect(d[0]).toMatch(/^TOM:/);
    expect(d[1]).toMatch(/^FOCO:/);
    expect(d[2]).toMatch(/^PROFUNDIDADE:/);
  });
});

describe('buildStyledSystemPrompt', () => {
  const BASE = 'PROMPT BASE';
  it('neutro → retorna o base intacto', () => {
    expect(buildStyledSystemPrompt(BASE, SWOT_STYLE_DEFAULT)).toBe(BASE);
  });
  it('com estilo → anexa bloco de estilo após o base', () => {
    const out = buildStyledSystemPrompt(BASE, { tone: 1, focus: 2, depth: 2 });
    expect(out.startsWith(BASE)).toBe(true);
    expect(out).toMatch(/ESTILO DEFINIDO PELO MENTOR/);
    expect(out).toMatch(/TOM: direto/);
  });
});
