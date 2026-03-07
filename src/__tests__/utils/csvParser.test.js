/**
 * csvParser.test.js
 * @version 3.0.0 (v1.18.0)
 * Testes para pipeline de validação CSV em 2 camadas.
 */

import { describe, it, expect } from 'vitest';
import {
  parseCSVString, detectDelimiter, detectPreamble,
  validateStructure, validateSchema,
} from '../../utils/csvParser';

// ============================================
// detectDelimiter
// ============================================

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

  it('ignora linhas pré-header ao detectar delimiter', () => {
    const csv = 'Conta: 17375163\nTitular: Marcio\n\nAtivo;Lado;Preço;Qtd\nWINFUT;C;128000;1';
    expect(detectDelimiter(csv)).toBe(';');
  });
});

// ============================================
// detectPreamble
// ============================================

describe('detectPreamble', () => {
  it('CSV sem pré-header retorna hasPreamble=false', () => {
    const csv = 'Ativo;Lado;Preço;Qtd\nWINFUT;C;128000;1';
    const result = detectPreamble(csv);
    expect(result.hasPreamble).toBe(false);
    expect(result.headerLineIndex).toBe(0);
  });

  it('detecta cabeçalho institucional Clear (5 linhas)', () => {
    const csv = [
      'Conta: 17375163',
      'Titular: Marcio R. Portes',
      'Data Inicial: 06/03/2026',
      'Data Final: 07/03/2026',
      '',
      'Ativo;Abertura;Fechamento;Tempo;Qtd Compra;Qtd Venda;Lado;Preço Compra',
      'WINJ26;06/03/2026 09:28;06/03/2026 09:31;2min;1;1;C;182640',
    ].join('\n');
    const result = detectPreamble(csv);
    expect(result.hasPreamble).toBe(true);
    expect(result.preambleLines).toHaveLength(4); // 4 linhas com conteúdo (vazia é filtrada)
    expect(result.headerLineIndex).toBe(5);
    expect(result.cleanedText.startsWith('Ativo;')).toBe(true);
  });

  it('detecta uma linha pré-header', () => {
    const csv = 'Relatório de Operações\nAtivo;Lado;Preço;Qtd\nWINFUT;C;128000;1';
    const result = detectPreamble(csv);
    expect(result.hasPreamble).toBe(true);
    expect(result.preambleLines).toHaveLength(1);
    expect(result.headerLineIndex).toBe(1);
  });

  it('texto vazio retorna hasPreamble=false', () => {
    expect(detectPreamble('').hasPreamble).toBe(false);
    expect(detectPreamble(null).hasPreamble).toBe(false);
  });

  it('CSV com vírgula como delimitador detecta pré-header', () => {
    const csv = 'Report Generated: 2026-03-06\nTicker,Side,Price,Qty\nWINFUT,LONG,128000,1';
    const result = detectPreamble(csv);
    expect(result.hasPreamble).toBe(true);
    expect(result.headerLineIndex).toBe(1);
  });
});

// ============================================
// validateStructure (Camada 1)
// ============================================

describe('validateStructure', () => {
  it('CSV válido passa', () => {
    const csv = 'Ativo;Lado;Preço;Qtd\nWINFUT;C;128000;1';
    const result = validateStructure(csv);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('arquivo vazio falha', () => {
    expect(validateStructure('').valid).toBe(false);
    expect(validateStructure('   ').valid).toBe(false);
    expect(validateStructure(null).valid).toBe(false);
  });

  it('remove BOM e avisa', () => {
    const csv = '\uFEFFAtivo;Lado;Preço;Qtd\nWINFUT;C;128000;1';
    const result = validateStructure(csv);
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.includes('BOM'))).toBe(true);
  });

  it('rejeita arquivo binário', () => {
    const binary = '\x00\x01\x02\x03\x04\x05\x06\x07\x08\x0E\x0F some text';
    const result = validateStructure(binary);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('binário');
  });

  it('detecta pré-header e gera warning', () => {
    const csv = 'Conta: 123\nAtivo;Lado;Preço;Qtd\nWINFUT;C;128000;1';
    const result = validateStructure(csv);
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.includes('institucional'))).toBe(true);
    expect(result.preamble.hasPreamble).toBe(true);
  });

  it('falha com apenas 1 linha', () => {
    const csv = 'Ativo;Lado;Preço;Qtd';
    const result = validateStructure(csv);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('pelo menos');
  });
});

// ============================================
// validateSchema (Camada 2)
// ============================================

describe('validateSchema', () => {
  it('headers válidos passam', () => {
    const headers = ['Ativo', 'Lado', 'Preço Compra', 'Quantidade'];
    const rows = [{ Ativo: 'WINFUT', Lado: 'C', 'Preço Compra': '128000', Quantidade: '1' }];
    const result = validateSchema(headers, rows);
    expect(result.valid).toBe(true);
  });

  it('sem headers falha', () => {
    expect(validateSchema([], []).valid).toBe(false);
    expect(validateSchema(null, []).valid).toBe(false);
  });

  it('menos de 3 colunas falha', () => {
    const result = validateSchema(['A', 'B'], []);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('3 colunas');
  });

  it('headers numéricos = dados, não cabeçalho', () => {
    const result = validateSchema(['128000', '128100', '1', '2026'], []);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('dados, não nomes');
  });

  it('headers com datas = dados, não cabeçalho', () => {
    const result = validateSchema(['03/03/2026', '10:30', '128000', '1'], []);
    expect(result.valid).toBe(false);
  });

  it('mix de texto e número com maioria texto = válido', () => {
    const result = validateSchema(['Ativo', 'Lado', 'Preço', '123'], []);
    expect(result.valid).toBe(true);
  });

  it('detecta headers duplicados', () => {
    const result = validateSchema(['Ativo', 'Preço', 'Preço', 'Qtd'], []);
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.includes('duplicados'))).toBe(true);
  });

  it('detecta headers vazios', () => {
    const result = validateSchema(['Ativo', '', 'Preço', 'Qtd'], []);
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.includes('sem nome'))).toBe(true);
  });

  it('detecta linhas completamente vazias', () => {
    const headers = ['A', 'B', 'C'];
    const rows = [
      { A: 'x', B: 'y', C: 'z' },
      { A: '', B: '', C: '' },
    ];
    const result = validateSchema(headers, rows);
    expect(result.warnings.some(w => w.includes('vazia'))).toBe(true);
  });

  it('headers reais de corretora BR passam', () => {
    const result = validateSchema(
      ['Ativo', 'Abertura', 'Fechamento', 'Lado', 'Preço Compra', 'Preço Venda', 'Qtd', 'Res. Operação'],
      []
    );
    expect(result.valid).toBe(true);
  });

  it('headers Tradovate passam', () => {
    const result = validateSchema(
      ['orderId', 'Account', 'Order ID', 'B/S', 'Contract', 'Product', 'avgPrice', 'filledQty', 'Fill Time'],
      []
    );
    expect(result.valid).toBe(true);
  });
});

// ============================================
// parseCSVString (mantém retrocompat)
// ============================================

describe('parseCSVString', () => {
  it('parse CSV com ponto-e-vírgula', () => {
    const csv = 'Ativo;C/V;Preço\nWINFUT;C;128000\nWINFUT;V;128100';
    const result = parseCSVString(csv);
    expect(result.headers).toEqual(['Ativo', 'C/V', 'Preço']);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]['Ativo']).toBe('WINFUT');
    expect(result.delimiter).toBe(';');
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
