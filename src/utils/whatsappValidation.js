/**
 * Validação de número WhatsApp — issue #123
 * Se o usuário digitar sem código de país, assume +55 (Brasil).
 * Armazena sempre no formato E.164 completo: +5511999887766
 * @param {*} value - valor a validar
 * @returns {{ valid: boolean, sanitized?: string, formatted?: string, error?: string }}
 */
export const validateWhatsappNumber = (value) => {
  if (value === undefined || value === null || value === '') return { valid: true, sanitized: '', formatted: '' };
  if (typeof value !== 'string') return { valid: false, error: 'Deve ser texto' };

  // Remove espaços, hifens, parênteses (formatação)
  let sanitized = value.replace(/[\s\-().]/g, '');

  // Permitir apenas dígitos e opcionalmente + no início
  if (!/^\+?\d+$/.test(sanitized)) {
    return { valid: false, error: 'Apenas dígitos e + no início' };
  }

  // Auto-prefixo +55 se não tem código de país
  // Sem +: assume BR. Com +: respeita o que o usuário digitou.
  if (!sanitized.startsWith('+')) {
    const digits = sanitized;
    // 10-11 dígitos sem + = número BR (DDD + número)
    if (digits.length >= 10 && digits.length <= 11) {
      sanitized = '+55' + digits;
    } else if (digits.length >= 12) {
      // 12+ dígitos sem + = provavelmente já inclui código do país
      sanitized = '+' + digits;
    } else {
      return { valid: false, error: 'Mínimo 10 dígitos (DDD + número)' };
    }
  }

  // Validação E.164: + seguido de 10-15 dígitos
  const digits = sanitized.replace(/\+/, '');
  if (digits.length < 10) {
    return { valid: false, error: 'Mínimo 10 dígitos (DDD + número)' };
  }
  if (digits.length > 15) {
    return { valid: false, error: 'Máximo 15 dígitos' };
  }

  return { valid: true, sanitized, formatted: formatWhatsappDisplay(sanitized) };
};

/**
 * Formata número E.164 para exibição legível.
 * +5511999887766 → +55 (11) 99988-7766
 * Outros países: agrupa em blocos genéricos.
 */
export const formatWhatsappDisplay = (e164) => {
  if (!e164 || !e164.startsWith('+')) return e164 ?? '';

  // BR: +55 DD NNNNN-NNNN ou +55 DD NNNN-NNNN
  const brMatch = e164.match(/^\+55(\d{2})(\d{4,5})(\d{4})$/);
  if (brMatch) {
    return `+55 (${brMatch[1]}) ${brMatch[2]}-${brMatch[3]}`;
  }

  // Genérico: +CC restante em blocos de 4
  const cc = e164.slice(0, e164.length <= 13 ? 2 : 3); // +X ou +XX ou +XXX
  const rest = e164.slice(cc.length);
  const blocks = rest.match(/.{1,4}/g) ?? [];
  return `${cc} ${blocks.join(' ')}`;
};
