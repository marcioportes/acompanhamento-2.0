/**
 * paths.test.js — issue #144 Fase A1.
 *
 * O endereço é o novo contrato de navegação: se um path muda de forma silenciosa,
 * link compartilhado quebra e o "voltar" vai para o lugar errado. Aqui travamos
 * a porta de cada papel e o escape de parâmetro — email como identificador de
 * aluno tem `@` e `.`, e um dia terá `+`.
 */
import { describe, it, expect } from 'vitest';
import { MENTOR_PATHS, STUDENT_PATHS, SHARED_PATHS, homePath } from '../../routes/paths';

describe('paths — a porta de cada papel', () => {
  it('mentor entra pela Torre', () => {
    expect(homePath(true)).toBe('/torre');
  });

  it('aluno entra pelo painel', () => {
    expect(homePath(false)).toBe('/painel');
  });
});

describe('paths — parâmetros', () => {
  it('escapa email usado como identificador de aluno', () => {
    expect(MENTOR_PATHS.aluno('a+b@ex.com')).toBe('/alunos/a%2Bb%40ex.com');
  });

  it('monta o extrato do plano sob o aluno', () => {
    expect(MENTOR_PATHS.alunoPlano('u1', 'p9')).toBe('/alunos/u1/plano/p9');
  });

  it('monta a revisão semanal sob o aluno', () => {
    expect(MENTOR_PATHS.alunoRevisao('u1', 'r7')).toBe('/alunos/u1/revisao/r7');
  });

  it('o extrato do aluno não passa pelo /alunos', () => {
    expect(STUDENT_PATHS.plano('p9')).toBe('/plano/p9');
  });

  it('o feedback do trade tem o mesmo endereço para os dois papéis', () => {
    expect(SHARED_PATHS.trade('t1')).toBe('/trades/t1');
  });
});
