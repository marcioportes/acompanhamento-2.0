/**
 * csvParser.js
 * @version 1.0.0 (v1.18.0)
 * @description Parse de CSV com detecção automática de delimiter e encoding.
 *   Usa Papaparse para robustez (lida com quotes, escapes, encoding BR).
 *
 * EXPORTS:
 *   parseCSV(file) → Promise<{ headers, rows, delimiter, rowCount, errors }>
 *   parseCSVString(text, delimiter) → { headers, rows, delimiter, rowCount, errors }
 *   detectDelimiter(text) → string
 */

import Papa from 'papaparse';

/**
 * Detecta o delimiter mais provável em um texto CSV.
 * Prioridade: ; (padrão BR) > , > \t > |
 * @param {string} text - Primeiras linhas do CSV
 * @returns {string} Delimiter detectado
 */
export const detectDelimiter = (text) => {
  if (!text) return ',';
  const firstLines = text.split('\n').slice(0, 5).join('\n');
  const counts = {
    ';': (firstLines.match(/;/g) || []).length,
    ',': (firstLines.match(/,/g) || []).length,
    '\t': (firstLines.match(/\t/g) || []).length,
    '|': (firstLines.match(/\|/g) || []).length,
  };
  // Desempate: prioridade BR (ponto e vírgula)
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0][1] > 0 ? sorted[0][0] : ',';
};

/**
 * Parse de um arquivo CSV (File object).
 * @param {File} file - Arquivo CSV
 * @param {Object} [options] - { delimiter?, encoding? }
 * @returns {Promise<{ headers: string[], rows: Object[], delimiter: string, rowCount: number, errors: Array }>}
 */
export const parseCSV = (file, options = {}) => {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('Arquivo não fornecido'));

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: options.delimiter || '', // vazio = auto-detect
      encoding: options.encoding || 'UTF-8',
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        const headers = results.meta.fields || [];
        const rows = results.data || [];
        const errors = (results.errors || []).map(e => ({
          row: e.row,
          type: e.type,
          code: e.code,
          message: e.message,
        }));

        resolve({
          headers,
          rows,
          delimiter: results.meta.delimiter,
          rowCount: rows.length,
          errors,
        });
      },
      error: (err) => reject(new Error(`Erro ao parsear CSV: ${err.message}`)),
    });
  });
};

/**
 * Parse de uma string CSV (para testes ou preview).
 * @param {string} text - Conteúdo CSV como string
 * @param {string} [delimiter] - Delimiter (auto-detect se não fornecido)
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
