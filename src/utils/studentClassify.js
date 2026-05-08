/**
 * studentClassify
 * @description Classifica student pela sub ATIVA mais recente em um dos 4
 *              buckets internos (3 visuais — Trial agrega 2 subtipos):
 *
 *                'alpha'           → paid, plan=alpha
 *                'espelho'         → paid, plan=self_service
 *                'trial-alpha'     → trial, plan=alpha
 *                'trial-espelho'   → trial, plan=self_service
 *                null              → não cabe na gestão (filtrar fora)
 *
 *              Quem não tem sub ativa (todas cancelled/expired ou nenhuma)
 *              NÃO aparece na tela. VIP também sai (gestão é Alpha/Espelho/Trial).
 *
 *              Critério de "sub principal": status NÃO ∈ {cancelled, expired}.
 *              Em caso de múltiplas, ganha a de `renewalDate` mais futura.
 */

const ENDED_STATUSES = new Set(['cancelled', 'expired']);

const subDate = (sub) => {
  const raw = sub?.type === 'trial' ? sub?.trialEndsAt : sub?.renewalDate;
  if (!raw) return 0;
  const d = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
};

/**
 * Sub ativa mais recente, OU null se não houver.
 * @param {Array} subs
 * @returns {Object|null}
 */
export const findActiveSub = (subs) => {
  if (!Array.isArray(subs)) return null;
  const active = subs.filter((s) => s && !ENDED_STATUSES.has(s.status));
  if (!active.length) return null;
  return [...active].sort((a, b) => subDate(b) - subDate(a))[0];
};

/**
 * @param {Object} student
 * @param {Array}  subs
 * @returns {'alpha'|'espelho'|'trial-alpha'|'trial-espelho'|null}
 */
export const classifyStudent = (student, subs) => {
  const main = findActiveSub(subs);
  if (!main) return null;
  if (main.type === 'vip') return null;     // VIP fora da gestão por ora.

  if (main.type === 'trial') {
    return main.plan === 'self_service' ? 'trial-espelho' : 'trial-alpha';
  }
  // type='paid' (ou ausente — default trata como paid)
  return main.plan === 'self_service' ? 'espelho' : 'alpha';
};

/**
 * Bucket agregado pro chip de filtro: trial-* viram 'trial'.
 */
export const tierGroup = (bucket) => {
  if (bucket === 'trial-alpha' || bucket === 'trial-espelho') return 'trial';
  return bucket;
};

export const isExpiringSoon = (sub, now = new Date()) => {
  if (!sub) return false;
  if (sub.type === 'vip') return false;
  if (ENDED_STATUSES.has(sub.status)) return false;
  const ms = subDate(sub) - now.getTime();
  if (ms <= 0) return false;
  const days = ms / 86_400_000;
  return days <= 7;
};

export const TIER_CONFIG = {
  alpha:           { label: 'Alpha',           pill: 'bg-purple-500/15 text-purple-300 border border-purple-500/30', dot: 'bg-purple-400' },
  espelho:         { label: 'Espelho',         pill: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30',       dot: 'bg-cyan-400' },
  'trial-alpha':   { label: 'Trial · Alpha',   pill: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',    dot: 'bg-amber-400' },
  'trial-espelho': { label: 'Trial · Espelho', pill: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',    dot: 'bg-amber-400' },
};
