/**
 * csvParser.js
 * @version 3.0.0 (v1.18.0)
 * @description CSV validation pipeline profissional em 2 camadas:
 *   Camada 1 — Structural: encoding, BOM, linhas pré-header, delimitador, arquivo vazio
 *   Camada 2 — Schema: header válido, consistência de colunas, linhas vazias/duplicadas
 *   (Camada 3 — Domain: já implementada em csvValidator.js)
 *
 * Suporta CSVs de: Clear, ProfitChart, TradingView, Tradovate, APEX, MFF, Lucid, Rithmic
 *
 * CHANGELOG:
 * - 3.0.0: Pipeline de validação em camadas. Detecção de pré-header com feedback ao usuário.
 *          Encoding fallback (UTF-8 → Latin-1). Schema validation pós-parse.
 * - 1.0.0: Versão inicial
 *
 * EXPORTS:
 *   parseCSV(file, options) → Promise<ParseResult>
 *   parseCSVString(text, delimiter) → ParseResult
 *   detectDelimiter(text) → string
 *   detectPreamble(text) → PreambleResult
 *   validateStructure(text) → StructuralResult
 *   validateSchema(headers, rows) → SchemaResult
 */

import Papa from 'papaparse';

// ============================================
// CAMADA 1 — STRUCTURAL VALIDATION
// ============================================

/**
 * Detecta o delimiter mais provável analisando linhas com conteúdo tabular.
 * Ignora linhas que parecem pré-header (sem delimitadores repetidos).
 * @param {string} text
 * @returns {string}
 */
export const detectDelimiter = (text) => {
  if (!text) return ',';

  const lines = text.split('\n');
  const candidates = lines.slice(0, 20).filter(l => l.trim().length > 0);
  const delimiters = [';', ',', '\t', '|'];
  const scores = {};

  for (const delim of delimiters) {
    const pattern = delim === '|' ? /\|/g : new RegExp(delim.replace(/[.*+?^${}()[\]\\]/g, '\\$&'), 'g');
    const maxCount = Math.max(...candidates.map(line => (line.match(pattern) || []).length), 0);
    scores[delim] = maxCount;
  }

  // Prioridade BR: ; > , > \t > |
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return sorted[0][1] > 0 ? sorted[0][0] : ',';
};

/**
 * Detecta linhas pré-header no CSV.
 * Retorna informações para o UI mostrar ao usuário (não remove silenciosamente).
 *
 * Heurística: uma linha de header/dados tem 3+ ocorrências de algum delimitador comum.
 * Linhas pré-header (ex: "Conta: 17375163") não têm delimitadores repetidos.
 *
 * @param {string} text
 * @returns {{ hasPreamble: boolean, preambleLines: string[], headerLineIndex: number, cleanedText: string }}
 */
export const detectPreamble = (text) => {
  if (!text) return { hasPreamble: false, preambleLines: [], headerLineIndex: 0, cleanedText: text };

  const lines = text.split('\n');
  const delimiters = [';', ',', '\t', '|'];

  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const line = lines[i].trim();
    if (!line) continue;

    for (const delim of delimiters) {
      const pattern = delim === '|' ? /\|/g : new RegExp(delim.replace(/[.*+?^${}()[\]\\]/g, '\\$&'), 'g');
      const count = (line.match(pattern) || []).length;
      if (count >= 3) {
        if (i === 0) {
          return { hasPreamble: false, preambleLines: [], headerLineIndex: 0, cleanedText: text };
        }
        return {
          hasPreamble: true,
          preambleLines: lines.slice(0, i).filter(l => l.trim().length > 0),
          headerLineIndex: i,
          cleanedText: lines.slice(i).join('\n'),
        };
      }
    }
  }

  return { hasPreamble: false, preambleLines: [], headerLineIndex: 0, cleanedText: text };
};

/**
 * Validação estrutural completa do texto CSV.
 * @param {string} text
 * @returns {{ valid: boolean, errors: string[], warnings: string[], preamble: Object, delimiter: string }}
 */
export const validateStructure = (text) => {
  const errors = [];
  const warnings = [];

  if (!text || !text.trim()) {
    return {
      valid: false, errors: ['Arquivo vazio.'], warnings: [],
      preamble: { hasPreamble: false, preambleLines: [], headerLineIndex: 0, cleanedText: '' },
      delimiter: ',',
    };
  }

  // BOM detection
  let cleanText = text;
  if (text.charCodeAt(0) === 0xFEFF) {
    cleanText = text.slice(1);
    warnings.push('BOM (Byte Order Mark) removido do início do arquivo.');
  }

  // Caracteres binários
  const binaryChars = cleanText.slice(0, 500).match(/[\x00-\x08\x0E-\x1F]/g);
  if (binaryChars && binaryChars.length > 5) {
    return {
      valid: false, errors: ['Arquivo parece ser binário, não um CSV de texto.'], warnings: [],
      preamble: { hasPreamble: false, preambleLines: [], headerLineIndex: 0, cleanedText: '' },
      delimiter: ',',
    };
  }

  // Detectar pré-header
  const preamble = detectPreamble(cleanText);
  if (preamble.hasPreamble) {
    warnings.push(
      `${preamble.preambleLines.length} linha(s) de cabeçalho institucional antes dos dados: ` +
      `"${preamble.preambleLines[0]}"` +
      (preamble.preambleLines.length > 1 ? ` (+${preamble.preambleLines.length - 1} mais)` : '') +
      '. Essas linhas serão ignoradas.'
    );
  }

  // Delimiter
  const delimiter = detectDelimiter(preamble.cleanedText);

  // Mínimo 2 linhas (header + 1 dado)
  const contentLines = preamble.cleanedText.split('\n').filter(l => l.trim().length > 0);
  if (contentLines.length < 2) {
    errors.push('CSV precisa ter pelo menos uma linha de cabeçalho e uma linha de dados.');
  }

  return { valid: errors.length === 0, errors, warnings, preamble, delimiter };
};

// ============================================
// CAMADA 2 — SCHEMA VALIDATION
// ============================================

/**
 * Valida headers e consistência do schema pós-parse.
 * @param {string[]} headers
 * @param {Object[]} rows
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export const validateSchema = (headers, rows) => {
  const errors = [];
  const warnings = [];

  if (!headers || headers.length === 0) {
    errors.push('Nenhuma coluna detectada no CSV.');
    return { valid: false, errors, warnings };
  }

  if (headers.length < 3) {
    errors.push(`Apenas ${headers.length} coluna(s) detectada(s). Um CSV de trades precisa de pelo menos 3 colunas.`);
  }

  // Headers não devem ser dados
  const numericPattern = /^-?\d+([.,]\d+)?$/;
  const datePattern = /^\d{1,4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,4}/;
  const timePattern = /^\d{1,2}:\d{2}/;

  let suspiciousHeaders = 0;
  const emptyHeaders = [];
  const duplicateHeaders = new Set();
  const seenHeaders = new Set();

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].trim();

    if (!h) {
      emptyHeaders.push(i + 1);
      suspiciousHeaders++;
      continue;
    }

    if (numericPattern.test(h) || datePattern.test(h) || timePattern.test(h)) {
      suspiciousHeaders++;
    }

    const normalized = h.toLowerCase();
    if (seenHeaders.has(normalized)) {
      duplicateHeaders.add(h);
    }
    seenHeaders.add(normalized);
  }

  if (headers.length > 0 && (suspiciousHeaders / headers.length) > 0.5) {
    errors.push(
      'A primeira linha parece conter dados, não nomes de colunas. ' +
      'Verifique se o CSV tem um cabeçalho (ex: Ativo;Lado;Preço Compra;Quantidade;Data).'
    );
  }

  if (emptyHeaders.length > 0) {
    warnings.push(`Coluna(s) sem nome na posição: ${emptyHeaders.join(', ')}.`);
  }

  if (duplicateHeaders.size > 0) {
    warnings.push(`Colunas com nomes duplicados: ${[...duplicateHeaders].join(', ')}.`);
  }

  // Consistência de colunas
  if (rows.length > 0) {
    const expectedCols = headers.length;
    let inconsistentRows = 0;

    for (let i = 0; i < Math.min(rows.length, 100); i++) {
      if (Object.keys(rows[i]).length !== expectedCols) {
        inconsistentRows++;
      }
    }

    if (inconsistentRows > 0) {
      warnings.push(
        `${inconsistentRows} linha(s) com número de colunas diferente do header (esperado: ${expectedCols}).`
      );
    }

    // Linhas completamente vazias
    let emptyRows = 0;
    for (const row of rows) {
      if (Object.values(row).every(v => !v || String(v).trim() === '')) {
        emptyRows++;
      }
    }
    if (emptyRows > 0) {
      warnings.push(`${emptyRows} linha(s) completamente vazia(s).`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
};

// ============================================
// PARSE PRINCIPAL
// ============================================

/**
 * Parse completo de um arquivo CSV com pipeline de validação.
 *
 * @param {File} file
 * @param {Object} [options] - { delimiter?, encoding? }
 * @returns {Promise<{
 *   headers: string[], rows: Object[], delimiter: string, rowCount: number,
 *   errors: Array, warnings: string[], skippedLines: number, preambleLines: string[]
 * }>}
 */
export const parseCSV = (file, options = {}) => {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('Arquivo não fornecido'));

    const tryParse = (encoding) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const rawText = e.target.result;

        // === CAMADA 1: Structural ===
        const structural = validateStructure(rawText);
        if (!structural.valid) {
          return reject(new Error(structural.errors.join(' ')));
        }

        const allWarnings = [...structural.warnings];

        // === PARSE com Papaparse ===
        Papa.parse(structural.preamble.cleanedText, {
          header: true,
          skipEmptyLines: true,
          delimiter: options.delimiter || structural.delimiter,
          transformHeader: (header) => header.trim(),
          complete: (results) => {
            const headers = results.meta.fields || [];
            const rows = results.data || [];
            const parseErrors = (results.errors || []).map(err => ({
              row: err.row,
              type: err.type,
              code: err.code,
              message: err.message,
            }));

            // === CAMADA 2: Schema ===
            const schema = validateSchema(headers, rows);
            if (!schema.valid) {
              return reject(new Error(schema.errors.join(' ')));
            }
            allWarnings.push(...schema.warnings);

            resolve({
              headers,
              rows,
              delimiter: results.meta.delimiter,
              rowCount: rows.length,
              errors: parseErrors,
              warnings: allWarnings,
              skippedLines: structural.preamble.headerLineIndex,
              preambleLines: structural.preamble.preambleLines,
            });
          },
          error: (err) => reject(new Error(`Erro ao parsear CSV: ${err.message}`)),
        });
      };

      reader.onerror = () => {
        if (encoding === 'UTF-8') {
          tryParse('ISO-8859-1');
        } else {
          reject(new Error('Erro ao ler arquivo. Verifique o encoding.'));
        }
      };

      reader.readAsText(file, encoding);
    };

    tryParse(options.encoding || 'UTF-8');
  });
};

/**
 * Parse de uma string CSV (para testes ou preview).
 * @param {string} text
 * @param {string} [delimiter]
 * @returns {{ headers: string[], rows: Object[], delimiter: string, rowCount: number, errors: Array }}
 */
export const parseCSVString = (text, delimiter) => {
  if (!text || !text.trim()) {
    return { headers: [], rows: [], delimiter: ',', rowCount: 0, errors: [] };
  }

  const effectiveDelimiter = delimiter || detectDelimiter(text);

  const results = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    delimiter: effectiveDelimiter,
    transformHeader: (header) => header.trim(),
  });

  return {
    headers: results.meta.fields || [],
    rows: results.data || [],
    delimiter: results.meta.delimiter,
    rowCount: (results.data || []).length,
    errors: (results.errors || []).map(e => ({
      row: e.row,
      type: e.type,
      code: e.code,
      message: e.message,
    })),
  };
};
