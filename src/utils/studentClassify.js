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
 *              NÃO aparece na tela — Acompanhamento é Alpha/Espelho/Trial.
 *              VIP também sai. Aluno em ritual sem sub Alpha/Espelho atribuída
 *              fica fora; mentor deve criar a sub na aba Assinaturas primeiro.
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
 * @param {Object} _student  (mantido por compatibilidade; bucket "aguardando-plano" removido)
 * @param {Array}  subs
 * @returns {'alpha'|'espelho'|'trial-alpha'|'trial-espelho'|null}
 *   null = fora desta tela — VIP ativo OU sem sub Alpha/Espelho/Trial atribuída.
 *
 * DEC-AUTO-263-06 REVOGADA (2026-05-09): aluno sem email NÃO é mais
 * filtrado aqui. Domínio fechou "WhatsApp-only não existe", então aluno
 * sem email com sub Alpha/Espelho ativa/trial é Candidato a registro —
 * Acompanhamento é o lugar primário do registro (mentor cadastra email
 * no ritual via drawer).
 *
 * DEC-AUTO-263-22 (2026-05-11): bucket "aguardando-plano" REMOVIDO. Domínio
 * fechou que aluno só aparece em Acompanhamento se tem sub Alpha/Espelho/Trial.
 * Cadastro de sub inicial é responsabilidade da aba Assinaturas — não dá pra
 * forçar a tela a aceitar aluno sem sub atribuída.
 */
export const classifyStudent = (_student, subs) => {
  const list = Array.isArray(subs) ? subs : [];

  // VIP ativo bloqueia a tela (some).
  const hasActiveVip = list.some(
    (s) => s?.type === 'vip' && !ENDED_STATUSES.has(s?.status),
  );
  if (hasActiveVip) return null;

  const main = findActiveSub(list);
  if (!main) return null;

  if (main.type === 'trial') {
    return main.plan === 'self_service' ? 'trial-espelho' : 'trial-alpha';
  }
  return main.plan === 'self_service' ? 'espelho' : 'alpha';
};

/**
 * Bucket agregado pro chip de filtro: trial-* viram 'trial'.
 */
export const tierGroup = (bucket) => {
  if (bucket === 'trial-alpha' || bucket === 'trial-espelho') return 'trial';
  return bucket;
};

/**
 * Estado de acesso à plataforma — DEC-AUTO-263-07.
 * Ortogonal ao bucket (Alpha/Espelho/Trial vem da sub; accessStatus vem do
 * ritual de convite + 1º login).
 *
 * Lê o campo `student.accessStatus` quando presente. Faz fallback derivado
 * dos campos legados pra cobrir docs ainda não tocados pelo backfill.
 *
 * @param {Object} student
 * @returns {'none'|'pending'|'active'}
 */
export const getAccessStatus = (student) => {
  const explicit = student?.accessStatus;
  if (explicit === 'none' || explicit === 'pending' || explicit === 'active') return explicit;
  if (student?.firstLoginAt) return 'active';
  if (student?.status === 'pending') return 'pending';
  return 'none';
};

/**
 * Heurística pra detectar se aluno NÃO tem Auth user vinculado — DEC-AUTO-263-14
 * (refinado 2026-05-11).
 *
 * Doc id segue 3 padrões em prod:
 *  - Pseudo-id `student_${ts}_${rand}` — gerado por `createInlineStudent` da
 *    SubscriptionsPage. Aluno SEM Auth.
 *  - Auto-id Firestore (20 chars alfanuméricos) — doc legado criado antes do
 *    callable `createStudent` existir, ou doc criado por flow antigo sem Auth.
 *    Aluno SEM Auth (confirmado por inspeção em prod com `getUserByEmail`).
 *  - Firebase Auth UID (28 chars). Aluno JÁ tem Auth, passou pelo callable.
 *
 * Auth UID Firebase: tipicamente 28 chars alfanuméricos. Auto-id Firestore: 20.
 * Heurística do tamanho é determinística pra docs criados pelos 2 fluxos.
 *
 * @param {Object} student
 * @returns {boolean}
 */
export const lacksAuthUser = (student) => {
  const id = String(student?.id ?? student?.uid ?? '');
  if (id.startsWith('student_')) return true;
  // Auth UID Firebase tem 28 chars; auto-id Firestore tem 20.
  // Tudo abaixo de 28 = doc legado sem Auth.
  if (id.length < 28) return true;
  return false;
};

export const ACCESS_STATUS_CONFIG = {
  none:    { label: 'sem acesso',          pill: 'bg-slate-500/15 text-slate-400 border border-slate-500/30' },
  pending: { label: 'aguardando 1º login', pill: 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30' },
  active:  { label: 'ativo',               pill: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' },
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
  alpha:              { label: 'Alpha',             pill: 'bg-purple-500/15 text-purple-300 border border-purple-500/30', dot: 'bg-purple-400' },
  espelho:            { label: 'Espelho',           pill: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30',       dot: 'bg-cyan-400' },
  'trial-alpha':      { label: 'Trial · Alpha',     pill: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',    dot: 'bg-amber-400' },
  'trial-espelho':    { label: 'Trial · Espelho',   pill: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',    dot: 'bg-amber-400' },
};
