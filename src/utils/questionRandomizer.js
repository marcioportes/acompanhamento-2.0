/**
 * questionRandomizer.js
 * 
 * Randomização de alternativas com persistência (DEC-015, Opção B preferida).
 * 
 * Fluxo:
 * 1. Primeira renderização: gera ordem aleatória com crypto.getRandomValues / Math.random
 * 2. Salva optionOrder no Firestore imediatamente
 * 3. Se aluno retomar (mesmo device ou outro): usa ordem salva
 * 
 * Fallback offline: mulberry32 PRNG com seed determinística (sessionId + questionId)
 * NÃO usar: options.sort(() => Math.random() - 0.5) — produz distribuição enviesada
 * 
 * @version 1.0.0 — CHUNK-09 Fase A
 */

// ============================================================
// FISHER-YATES SHUFFLE (Knuth)
// ============================================================

/**
 * Fisher-Yates (Knuth) shuffle — uniforme, in-place, O(n).
 * Usa crypto.getRandomValues quando disponível, Math.random como fallback.
 * 
 * @param {Array} array - Array a embaralhar (MUTAÇÃO — clonar antes se necessário)
 * @returns {Array} O mesmo array, embaralhado
 */
function fisherYatesShuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Gera inteiro aleatório em [0, max) com distribuição uniforme.
 */
function secureRandomInt(max) {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] % max;
  }
  return Math.floor(Math.random() * max);
}

// ============================================================
// MULBERRY32 PRNG (Fallback offline — seed determinística)
// ============================================================

/**
 * Mulberry32 PRNG — produz sequência determinística dado um seed.
 * Usado apenas como fallback quando persistência não está disponível.
 * 
 * @param {number} seed - Seed inteiro
 * @returns {Function} Função que retorna float [0, 1) a cada chamada
 */
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Hash simples de string para inteiro (djb2).
 * Usado para gerar seed a partir de sessionId + questionId.
 */
function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Fisher-Yates shuffle com PRNG seeded (determinístico).
 * 
 * @param {Array} array - Array a embaralhar (MUTAÇÃO)
 * @param {string} seed - Seed string (ex: sessionId + questionId)
 * @returns {Array} Array embaralhado de forma determinística
 */
function seededShuffle(array, seed) {
  const rng = mulberry32(hashString(seed));
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Gera ordem randomizada de option IDs para uma pergunta.
 * 
 * Se existir optionOrder salvo (do Firestore), retorna ele.
 * Se não, gera nova ordem e retorna (chamador deve persistir no Firestore).
 * 
 * @param {Array<string>} optionIds - IDs das opções na ordem original
 * @param {Array<string>|null} savedOrder - Ordem salva previamente (do Firestore)
 * @returns {{ order: Array<string>, isNew: boolean }}
 *   - order: IDs na ordem para apresentação
 *   - isNew: true se a ordem foi gerada agora (precisa persistir)
 */
export function getOptionOrder(optionIds, savedOrder = null) {
  // Se já existe ordem salva, validar e usar
  if (savedOrder && Array.isArray(savedOrder) && savedOrder.length === optionIds.length) {
    // Validação: savedOrder deve conter exatamente os mesmos IDs
    const savedSet = new Set(savedOrder);
    const originalSet = new Set(optionIds);
    const isValid =
      savedSet.size === originalSet.size &&
      [...savedSet].every((id) => originalSet.has(id));

    if (isValid) {
      return { order: savedOrder, isNew: false };
    }
    // Se inválida (perguntas mudaram?), regenerar
  }

  // Gerar nova ordem
  const shuffled = fisherYatesShuffle([...optionIds]);
  return { order: shuffled, isNew: true };
}

/**
 * Gera ordem determinística (fallback offline).
 * Mesma seed = mesma ordem, independente de device/sessão.
 * 
 * @param {Array<string>} optionIds
 * @param {string} sessionId - ID da sessão de assessment
 * @param {string} questionId - ID da pergunta
 * @returns {Array<string>} IDs na ordem determinística
 */
export function getSeededOptionOrder(optionIds, sessionId, questionId) {
  const seed = `${sessionId}:${questionId}`;
  return seededShuffle([...optionIds], seed);
}

/**
 * Valida que uma optionOrder contém exatamente os IDs esperados.
 * 
 * @param {Array<string>} optionOrder - Ordem a validar
 * @param {Array<string>} expectedIds - IDs esperados
 * @returns {boolean}
 */
export function isValidOptionOrder(optionOrder, expectedIds) {
  if (!Array.isArray(optionOrder) || optionOrder.length !== expectedIds.length) {
    return false;
  }
  const orderSet = new Set(optionOrder);
  const expectedSet = new Set(expectedIds);
  return (
    orderSet.size === expectedSet.size &&
    [...orderSet].every((id) => expectedSet.has(id))
  );
}

// Export internals for testing
export { fisherYatesShuffle, seededShuffle, mulberry32, hashString };
