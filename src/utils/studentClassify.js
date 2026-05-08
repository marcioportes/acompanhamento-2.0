/**
 * studentClassify
 * @description Classifica student em um dos 5 buckets visuais usados na tela
 *              de Alunos (#263) — derivado do mockup #237 mas operando sobre
 *              o modelo real (`students/{uid}` + subcollection `subscriptions/`).
 */

const ENDED_STATUSES = new Set(['cancelled', 'expired']);

/**
 * Buckets:
 *   - 'alpha'   → student.accessTier === 'alpha'
 *   - 'espelho' → student.accessTier === 'self_service'
 *   - 'vip'     → tem alguma sub `type='vip'` não-encerrada (vitalício)
 *   - 'ex'      → tem histórico de subs, todas encerradas
 *   - 'lead'    → nunca teve sub
 *
 * Precedência: tier explícito > VIP ativo > histórico.
 *
 * @param {Object} student
 * @param {Array}  subs   subscriptions do aluno (já filtradas por studentId)
 * @returns {'alpha'|'espelho'|'vip'|'ex'|'lead'}
 */
export const classifyStudent = (student, subs) => {
  const tier = student?.accessTier;
  if (tier === 'alpha') return 'alpha';
  if (tier === 'self_service') return 'espelho';

  const list = Array.isArray(subs) ? subs : [];
  const hasActiveVip = list.some(
    (s) => s?.type === 'vip' && !ENDED_STATUSES.has(s?.status),
  );
  if (hasActiveVip) return 'vip';

  if (!list.length) return 'lead';
  return 'ex';
};

/**
 * Sub vence em ≤7 dias (não inclui VIP, encerradas ou sem data).
 * @param {Object} sub
 * @param {Date}   [now=new Date()]
 * @returns {boolean}
 */
export const isExpiringSoon = (sub, now = new Date()) => {
  if (!sub) return false;
  if (sub.type === 'vip') return false;
  if (ENDED_STATUSES.has(sub.status)) return false;
  const date = sub.type === 'trial' ? sub.trialEndsAt : sub.renewalDate;
  if (!date) return false;
  const target = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(target.getTime())) return false;
  const days = (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return days >= 0 && days <= 7;
};

export const TIER_CONFIG = {
  alpha:   { label: 'Alpha',   pill: 'bg-purple-500/15  text-purple-300  border border-purple-500/30',  dot: 'bg-purple-400' },
  espelho: { label: 'Espelho', pill: 'bg-cyan-500/15    text-cyan-300    border border-cyan-500/30',    dot: 'bg-cyan-400' },
  vip:     { label: 'VIP',     pill: 'bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30', dot: 'bg-fuchsia-400' },
  lead:    { label: 'Lead',    pill: 'bg-amber-500/15   text-amber-300   border border-amber-500/30',   dot: 'bg-amber-400' },
  ex:      { label: 'Ex',      pill: 'bg-slate-500/15   text-slate-300   border border-slate-500/30',   dot: 'bg-slate-400' },
};
