/**
 * csvParser.test.js
 * @version 1.0.0 (v1.18.0)
 */

import { describe, it, expect } from 'vitest';
import { parseCSVString, detectDelimiter } from '../../utils/csvParser';

describe('detectDelimiter', () => {
  it('detecta ponto-e-vírgula (padrão BR)', () => {
    expect(detectDelimiter('Ativo;C/V;Preço\nWINFUT;C;128000')).toBe(';');
  });

  it('detecta vírgula', () => {
    expect(detectDelimiter('Ticker,Side,Price\nWINFUT,LONG,128000')).toBe(',');
  });

  it('detecta tab', () => {
    expect(detectDelimiter('Ticker\tSide\tPrice\nWINFUT\tLONG\t128000')).toBe('\t');
  });

  it('retorna vírgula para texto vazio', () => {
    expect(detectDelimiter('')).toBe(',');
    expect(detectDelimiter(null)).toBe(',');
  });

  it('prioriza ; sobre , quando iguais em contagem', () => {
    // "a;b,c" tem 1 de cada — ; vence por estar primeiro no sort
    const text = 'a;b;c\n1;2;3';
    expect(detectDelimiter(text)).toBe(';');
  });
});

describe('parseCSVString', () => {
  it('parse CSV com ponto-e-vírgula', () => {
    const csv = 'Ativo;C/V;Preço\nWINFUT;C;128000\nWINFUT;V;128100';
    const result = parseCSVString(csv);
    expect(result.headers).toEqual(['Ativo', 'C/V', 'Preço']);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]['Ativo']).toBe('WINFUT');
    expect(result.rows[0]['C/V']).toBe('C');
    expect(result.delimiter).toBe(';');
    expect(result.rowCount).toBe(2);
  });

  it('parse CSV com vírgula', () => {
    const csv = 'Ticker,Side,Price\nWINFUT,LONG,128000';
    const result = parseCSVString(csv);
    expect(result.headers).toEqual(['Ticker', 'Side', 'Price']);
    expect(result.rows).toHaveLength(1);
  });

  it('ignora linhas vazias', () => {
    const csv = 'A;B\n1;2\n\n3;4\n\n';
    const result = parseCSVString(csv, ';');
    expect(result.rowCount).toBe(2);
  });

  it('trim nos headers', () => {
    const csv = ' Ativo ; Preço \n WINFUT ; 128000';
    const result = parseCSVString(csv, ';');
    expect(result.headers).toEqual(['Ativo', 'Preço']);
  });

  it('retorna vazio para texto vazio', () => {
    const result = parseCSVString('');
    expect(result.headers).toEqual([]);
    expect(result.rows).toEqual([]);
    expect(result.rowCount).toBe(0);
  });

  it('lida com quotes no CSV', () => {
    const csv = 'Nome;Valor\n"Ativo, especial";128000';
    const result = parseCSVString(csv, ';');
    expect(result.rows[0]['Nome']).toBe('Ativo, especial');
  });

  it('aceita delimiter forçado', () => {
    const csv = 'A|B\n1|2';
    const result = parseCSVString(csv, '|');
    expect(result.headers).toEqual(['A', 'B']);
    expect(result.rows).toHaveLength(1);
  });
});
