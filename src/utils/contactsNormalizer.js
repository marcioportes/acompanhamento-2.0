/**
 * contactsNormalizer.js — issue #237 F1
 *
 * Normalizadores puros para os 3 campos do triplo match (nome OR celular OR email).
 * Saída usada como índice de query no Firestore (`nameNormalized`, `celular`, `email`).
 *
 * Funções puras: zero I/O.
 */

// Tabela de DDI suportados — ordem por especificidade (mais longo primeiro).
// Mantém apenas o que aparece na planilha base ou é razoavelmente provável.
// minLen/maxLen contam o DDI + DDD + número (todos os dígitos).
const DDI_TABLE = [
  { code: '351', country: 'PT', minLen: 12, maxLen: 13 },
  { code: '55', country: 'BR', minLen: 12, maxLen: 13 }, // 55 + DDD(2) + 8/9
  { code: '49', country: 'DE', minLen: 12, maxLen: 14 },
  { code: '44', country: 'UK', minLen: 12, maxLen: 13 },
  { code: '1', country: 'US', minLen: 11, maxLen: 11 }, // 1 + 10 dígitos
];

/**
 * Normaliza o nome para uso como índice de dedup.
 * - Trim
 * - Lowercase
 * - Remove diacríticos (`Cecília` → `cecilia`)
 * - Colapsa espaços internos
 *
 * @param {unknown} raw
 * @returns {string|null} string normalizada ou null se vazio.
 */
export function normalizeName(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s.length === 0) return null;
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Normaliza o telefone para E.164 (`+55XXXXXXXXXXX`).
 * Aceita qualquer formato de entrada (concatenado da planilha, com separadores da UI).
 * Detecta DDI por prefixo na tabela acima (mais longo primeiro).
 *
 * @param {unknown} raw
 * @returns {{ e164: string, countryCode: string }|null}
 *   `null` se vazio. `countryCode='UNKNOWN'` se DDI não casar com a tabela
 *   (preserva os dígitos crus em E.164 — caller decide se aceita).
 */
export function normalizePhone(raw) {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 0) return null;

  for (const d of DDI_TABLE) {
    if (
      digits.startsWith(d.code) &&
      digits.length >= d.minLen &&
      digits.length <= d.maxLen
    ) {
      return { e164: '+' + digits, countryCode: d.country };
    }
  }

  return { e164: '+' + digits, countryCode: 'UNKNOWN' };
}

/**
 * Normaliza email — trim + lowercase. Retorna `null` se vazio.
 *
 * @param {unknown} raw
 * @returns {string|null}
 */
export function normalizeEmail(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (s.length === 0) return null;
  return s;
}

/**
 * Aplica os 3 normalizadores em bloco. Útil pra montar payload de
 * `contacts/{id}` consistente entre bootstrap, gateway e UI.
 *
 * @param {{ nome?: unknown, celular?: unknown, email?: unknown }} input
 * @returns {{ nome: string|null, nameNormalized: string|null, celular: string|null, countryCode: string|null, email: string|null }}
 */
export function normalizeContactInput({ nome, celular, email } = {}) {
  const nameNormalized = normalizeName(nome);
  const phone = normalizePhone(celular);
  return {
    nome: nome == null ? null : String(nome).trim() || null,
    nameNormalized,
    celular: phone ? phone.e164 : null,
    countryCode: phone ? phone.countryCode : null,
    email: normalizeEmail(email),
  };
}
