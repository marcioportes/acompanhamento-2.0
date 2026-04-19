/**
 * reviewUrlValidator
 * @description Valida meetingLink/videoLink da revisão semanal (issue #102).
 *   Regex https + allowlist leve de hosts comuns de mentoria.
 *   Retorna {valid, error?} — mensagem pronta para exibir no input.
 */

const ALLOWED_HOSTS = [
  'zoom.us',
  'us02web.zoom.us',
  'us04web.zoom.us',
  'us05web.zoom.us',
  'us06web.zoom.us',
  'meet.google.com',
  'teams.microsoft.com',
  'teams.live.com',
  'loom.com',
  'www.loom.com',
  'youtube.com',
  'www.youtube.com',
  'youtu.be',
  'drive.google.com',
  'vimeo.com',
  'www.vimeo.com',
];

const URL_REGEX = /^https:\/\//i;

export const MAX_TAKEAWAYS_LENGTH = 5000;

/**
 * @param {string|null|undefined} url
 * @returns {{ valid: boolean, error: string|null }}
 */
export const validateReviewUrl = (url) => {
  if (url == null || url === '') return { valid: true, error: null };
  if (typeof url !== 'string') return { valid: false, error: 'URL inválida' };
  const trimmed = url.trim();
  if (!trimmed) return { valid: true, error: null };
  if (!URL_REGEX.test(trimmed)) return { valid: false, error: 'URL deve começar com https://' };
  let parsed;
  try { parsed = new URL(trimmed); }
  catch { return { valid: false, error: 'URL mal formada' }; }
  const host = parsed.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.includes(host)) {
    return { valid: false, error: `Host não permitido (${host}). Aceitos: zoom.us, meet.google.com, loom.com, teams.microsoft.com, youtube.com, drive.google.com, vimeo.com` };
  }
  return { valid: true, error: null };
};

export const validateTakeaways = (text) => {
  if (text == null || text === '') return { valid: true, error: null };
  if (typeof text !== 'string') return { valid: false, error: 'Takeaways inválido' };
  if (text.length > MAX_TAKEAWAYS_LENGTH) {
    return { valid: false, error: `Máximo ${MAX_TAKEAWAYS_LENGTH} caracteres (atual: ${text.length})` };
  }
  return { valid: true, error: null };
};

export const ALLOWED_URL_HOSTS = ALLOWED_HOSTS;
