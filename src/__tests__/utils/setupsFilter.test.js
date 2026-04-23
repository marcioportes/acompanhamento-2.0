/**
 * setupsFilter.test.js — issue #174
 *
 * Testa `filterSetupsForStudent(setups, studentId)` — util puro usado no
 * MentorDashboard para isolar setups por aluno selecionado.
 *
 * Regra: retorna globals + setups pessoais do studentId passado. Setups de
 * OUTROS alunos NUNCA vazam.
 */
import { describe, it, expect } from 'vitest';
import { filterSetupsForStudent } from '../../utils/setupsFilter';

const base = [
  { id: 's1', name: 'Breakout', isGlobal: true, targetRR: 2.0 },
  { id: 's2', name: 'Pullback', isGlobal: false, studentId: 'aluno-A', targetRR: 1.5 },
  { id: 's3', name: 'Reversal', isGlobal: false, studentId: 'aluno-B', targetRR: 3.0 },
  { id: 's4', name: 'Scalp', isGlobal: true },
  { id: 's5', name: 'Custom X', isGlobal: false, studentId: 'aluno-A' },
];

describe('filterSetupsForStudent — defensivo', () => {
  it('retorna [] quando setups é null/undefined/não-array', () => {
    expect(filterSetupsForStudent(null, 'aluno-A')).toEqual([]);
    expect(filterSetupsForStudent(undefined, 'aluno-A')).toEqual([]);
    expect(filterSetupsForStudent({}, 'aluno-A')).toEqual([]);
  });

  it('retorna apenas globals quando studentId ausente/null', () => {
    const out = filterSetupsForStudent(base, null);
    expect(out.map(s => s.id).sort()).toEqual(['s1', 's4']);
  });

  it('retorna apenas globals quando studentId vazio', () => {
    const out = filterSetupsForStudent(base, '');
    expect(out.map(s => s.id).sort()).toEqual(['s1', 's4']);
  });
});

describe('filterSetupsForStudent — isolamento', () => {
  it('retorna globals + pessoais do aluno A quando studentId = aluno-A', () => {
    const out = filterSetupsForStudent(base, 'aluno-A');
    expect(out.map(s => s.id).sort()).toEqual(['s1', 's2', 's4', 's5']);
  });

  it('setup de aluno-B NÃO aparece quando filtra para aluno-A (isolamento estrito)', () => {
    const out = filterSetupsForStudent(base, 'aluno-A');
    const ids = out.map(s => s.id);
    expect(ids).not.toContain('s3');
  });

  it('setup de aluno-A NÃO aparece quando filtra para aluno-B', () => {
    const out = filterSetupsForStudent(base, 'aluno-B');
    const ids = out.map(s => s.id);
    expect(ids).not.toContain('s2');
    expect(ids).not.toContain('s5');
    expect(ids.sort()).toEqual(['s1', 's3', 's4']);
  });

  it('preserva targetRR e demais campos dos setups selecionados', () => {
    const out = filterSetupsForStudent(base, 'aluno-A');
    const pullback = out.find(s => s.id === 's2');
    expect(pullback.targetRR).toBe(1.5);
    expect(pullback.name).toBe('Pullback');
  });
});

describe('filterSetupsForStudent — edges', () => {
  it('setups sem isGlobal explícito e sem studentId são tratados como não-globais', () => {
    const setups = [{ id: 'x', name: 'Órfão' }]; // sem isGlobal, sem studentId
    expect(filterSetupsForStudent(setups, 'aluno-A')).toEqual([]);
  });

  it('setup com isGlobal=false E studentId do aluno é incluído', () => {
    const setups = [{ id: 'y', isGlobal: false, studentId: 'aluno-A', name: 'X' }];
    expect(filterSetupsForStudent(setups, 'aluno-A')).toHaveLength(1);
  });

  it('não modifica o array original (pureza)', () => {
    const snapshot = JSON.parse(JSON.stringify(base));
    filterSetupsForStudent(base, 'aluno-A');
    expect(base).toEqual(snapshot);
  });
});
