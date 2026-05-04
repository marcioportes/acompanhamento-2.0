/**
 * Tests: Follow-up filter logic — issue #243 + #246
 *
 * Filtro 3 estados (#246): 'all' | 'on' | 'off'
 *   on  = inFollowUp === true
 *   off = inFollowUp !== true (inclui false e undefined legacy)
 * Toggle (#243): { inFollowUp: !sub.inFollowUp } — undefined → true → false → true
 */

import { describe, it, expect } from 'vitest';

const filterFollowUp = (subs) => subs.filter((s) => s.inFollowUp === true);

const filterByFollowUp = (subs, mode) => {
  if (mode === 'on') return subs.filter((s) => s.inFollowUp === true);
  if (mode === 'off') return subs.filter((s) => s.inFollowUp !== true);
  return subs;
};

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

describe('Follow-up segment filter (#246)', () => {
  const subs = [
    { id: 'a', inFollowUp: true },
    { id: 'b', inFollowUp: false },
    { id: 'c' }, // legacy
    { id: 'd', inFollowUp: true },
    { id: 'e', inFollowUp: false },
  ];

  it("'all' não filtra (mostra todos)", () => {
    expect(filterByFollowUp(subs, 'all').map((s) => s.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it("'on' mostra só inFollowUp === true", () => {
    expect(filterByFollowUp(subs, 'on').map((s) => s.id)).toEqual(['a', 'd']);
  });

  it("'off' mostra inFollowUp !== true (inclui false E legacy undefined)", () => {
    expect(filterByFollowUp(subs, 'off').map((s) => s.id)).toEqual(['b', 'c', 'e']);
  });

  it('on + off === all (sem leak)', () => {
    const onCount = filterByFollowUp(subs, 'on').length;
    const offCount = filterByFollowUp(subs, 'off').length;
    expect(onCount + offCount).toBe(subs.length);
  });
});
