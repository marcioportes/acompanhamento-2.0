/**
 * Tests: Follow-up filter logic — issue #243
 *
 * Filtro: subs.filter(s => s.inFollowUp === true)
 * Toggle: { inFollowUp: !sub.inFollowUp } — undefined → true → false → true
 * Default: undefined em docs antigos = não está em follow-up
 */

import { describe, it, expect } from 'vitest';

const filterFollowUp = (subs) => subs.filter((s) => s.inFollowUp === true);

const toggleFollowUp = (sub) => ({ inFollowUp: !sub.inFollowUp });

describe('Follow-up filter', () => {
  it('mostra só assinaturas com inFollowUp === true', () => {
    const subs = [
      { id: 'a', inFollowUp: true },
      { id: 'b', inFollowUp: false },
      { id: 'c' }, // legacy: campo ausente
      { id: 'd', inFollowUp: true },
    ];
    const result = filterFollowUp(subs);
    expect(result.map((s) => s.id)).toEqual(['a', 'd']);
  });

  it('retorna array vazio quando nenhum está em follow-up', () => {
    const subs = [{ id: 'a' }, { id: 'b', inFollowUp: false }];
    expect(filterFollowUp(subs)).toEqual([]);
  });

  it('trata `undefined` como não em follow-up (não filtra)', () => {
    const subs = [{ id: 'legacy' }];
    expect(filterFollowUp(subs)).toEqual([]);
  });
});

describe('Follow-up toggle', () => {
  it('undefined → true (primeiro clique em doc legado)', () => {
    expect(toggleFollowUp({ inFollowUp: undefined })).toEqual({ inFollowUp: true });
  });

  it('false → true', () => {
    expect(toggleFollowUp({ inFollowUp: false })).toEqual({ inFollowUp: true });
  });

  it('true → false', () => {
    expect(toggleFollowUp({ inFollowUp: true })).toEqual({ inFollowUp: false });
  });
});

describe('Follow-up counter', () => {
  it('conta apenas docs com inFollowUp === true', () => {
    const subs = [
      { inFollowUp: true },
      { inFollowUp: true },
      { inFollowUp: false },
      {}, // legacy
      { inFollowUp: true },
    ];
    expect(subs.filter((s) => s.inFollowUp === true).length).toBe(3);
  });
});
