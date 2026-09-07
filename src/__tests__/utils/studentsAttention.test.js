/**
 * studentsAttention.test.js — issue #430
 * @description O badge do menu e a aba "Precisam Atenção" leem daqui. O teste
 *              fixa o que as duas superfícies passam a compartilhar: a regra
 *              inteira (prejuízo, win rate, profit factor) e o filtro de
 *              assinatura ativa do #402.
 */

import { describe, it, expect } from 'vitest';
import { studentsNeedingAttention } from '../../utils/studentsAttention';

const trade = (result) => ({ result, pl: result, status: 'REVIEWED' });

// 5 trades, 1 win → win rate 20%, P&L negativo: entra pelos dois critérios.
const emApuros = [trade(10), trade(-30), trade(-30), trade(-30), trade(-30)];
// P&L positivo e win rate alto: não entra.
const bem = [trade(50), trade(50), trade(50), trade(50), trade(-10)];

describe('studentsNeedingAttention', () => {
  it('a regra é a de identifyStudentsNeedingAttention, não só win rate', () => {
    // Prejuízo com 1 trade só: a regra ad-hoc que existia no App.jsx exigia
    // 5 trades e ignorava este aluno; o badge dizia 2 e a aba dizia 6.
    const r = studentsNeedingAttention({ 'a@x.com': [trade(-500)] }, new Set());
    expect(r).toHaveLength(1);
    expect(r[0].reasons).toContain('Prejuízo');
  });

  it('filtra por assinatura ativa (#402)', () => {
    const grouped = { 'ativo@x.com': emApuros, 'saiu@x.com': emApuros };
    const r = studentsNeedingAttention(grouped, new Set(['ativo@x.com']));
    expect(r.map((s) => s.email)).toEqual(['ativo@x.com']);
  });

  it('email compara sem depender de caixa', () => {
    const r = studentsNeedingAttention({ 'Ativo@X.com': emApuros }, new Set(['ativo@x.com']));
    expect(r).toHaveLength(1);
  });

  it('set vazio não esconde ninguém — assinaturas ainda carregando', () => {
    const r = studentsNeedingAttention({ 'a@x.com': emApuros }, new Set());
    expect(r).toHaveLength(1);
  });

  it('aluno saudável fica fora', () => {
    expect(studentsNeedingAttention({ 'ok@x.com': bem }, new Set())).toHaveLength(0);
  });

  it('entrada vazia devolve lista vazia', () => {
    expect(studentsNeedingAttention({}, new Set())).toEqual([]);
    expect(studentsNeedingAttention(null, undefined)).toEqual([]);
  });
});
