/**
 * studentClassify.js (server / CJS) — porta canônica de src/utils/studentClassify.js.
 *
 * Define o "tier" do aluno pela SUBSCRIPTION ativa (não pelo campo denormalizado accessTier):
 *   'alpha' | 'espelho' | 'trial-alpha' | 'trial-espelho' | null (VIP ativo OU sem sub).
 *
 * Escopo da Revisão (#269): só track Alpha entra → {alpha, trial-alpha}. Espelho (pago ou
 * trial), VIP e sem-sub ficam fora. É o "filtro matriz": feedback/revisão só pra quem está
 * na dupla. Mantém PARIDADE com o cliente — qualquer mudança aqui replica lá e vice-versa.
 */

const ENDED_STATUSES = new Set(['cancelled', 'expired']);

const subDate = (sub) => {
  const raw = sub?.type === 'trial' ? sub?.trialEndsAt : sub?.renewalDate;
  if (!raw) return 0;
  const d = raw && typeof raw.toDate === 'function' ? raw.toDate() : (raw instanceof Date ? raw : new Date(raw));
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
};

/** Bucket canônico do aluno a partir das subscriptions. */
const classifyStudent = (subs) => {
  const list = Array.isArray(subs) ? subs : [];
  if (list.some((s) => s?.type === 'vip' && !ENDED_STATUSES.has(s?.status))) return null;
  const active = list.filter((s) => s && !ENDED_STATUSES.has(s.status));
  if (!active.length) return null;
  const main = [...active].sort((a, b) => subDate(b) - subDate(a))[0];
  if (main.type === 'trial') return main.plan === 'self_service' ? 'trial-espelho' : 'trial-alpha';
  return main.plan === 'self_service' ? 'espelho' : 'alpha';
};

const REVIEW_SCOPE_BUCKETS = new Set(['alpha', 'trial-alpha']);

/** Bucket entra na Revisão? (track Alpha: alpha pago ou trial de alpha). */
const inReviewScope = (bucket) => REVIEW_SCOPE_BUCKETS.has(bucket);

/** Lê as subscriptions do aluno e diz se ele está no escopo da Revisão. */
async function studentInReviewScope(db, studentId) {
  if (!studentId) return false;
  const subsSnap = await db.collection('students').doc(studentId).collection('subscriptions').get();
  return inReviewScope(classifyStudent(subsSnap.docs.map((d) => d.data())));
}

module.exports = {
  ENDED_STATUSES,
  classifyStudent,
  inReviewScope,
  REVIEW_SCOPE_BUCKETS,
  studentInReviewScope,
};
