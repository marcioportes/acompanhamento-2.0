/**
 * planCoverage.js
 * @version 1.0.0 (v1.37.0 — issue #156 Fase C)
 * @description Detecção de gap de cobertura de plano para operações importadas.
 *   Uma operação está em "gap" quando não existe plano ativo na mesma conta
 *   cuja janela temporal cubra a data da operação.
 *
 * Critério de cobertura (conservador):
 *   - plan.accountId === accountId (mesma conta)
 *   - plan.active !== false (plano não arquivado)
 *   - plan.createdAt <= opDate (plano existia no momento da operação)
 *
 * Sem `createdAt`, o plano é considerado cobrindo qualquer data (fail-open, para
 * não gerar falso-positivo em dados legados). `plan.closedAt` também é respeitado:
 * se existir e opDate > closedAt → não cobre.
 *
 * Uso:
 *   const { hasCoverageGap, gapOperations } = detectCoverageGap({
 *     operations, plans, accountId
 *   });
 */

/**
 * Converte valor para timestamp (ms). Aceita:
 *   - Date
 *   - string ISO (`2026-02-12T14:41:30` / `2026-02-12`)
 *   - Firestore Timestamp (`{ seconds, toDate }`)
 *   - número (ms)
 * @returns {number|null} — ms desde epoch, null se inparseável
 */
function toMs(value) {
  if (value == null) return null;
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? null : t;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const t = Date.parse(value);
    return Number.isNaN(t) ? null : t;
  }
  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') {
      try {
        const d = value.toDate();
        return d instanceof Date && !Number.isNaN(d.getTime()) ? d.getTime() : null;
      } catch {
        return null;
      }
    }
    if (typeof value.seconds === 'number') return value.seconds * 1000;
  }
  return null;
}

/**
 * Extrai a data canônica de uma operação reconstruída — prioriza entrada da
 * primeira ordem (entryTime é o momento em que a operação nasce no mercado).
 *
 * @param {Object} op
 * @returns {number|null}
 */
export function getOperationDateMs(op) {
  if (!op) return null;
  const candidates = [
    op.entryTime,
    op.entryOrders?.[0]?.filledAt,
    op.entryOrders?.[0]?.submittedAt,
    op.exitTime,
    op.date,
  ];
  for (const c of candidates) {
    const ms = toMs(c);
    if (ms != null) return ms;
  }
  return null;
}

/**
 * Verifica se um plano cobre uma data específica.
 *
 * @param {Object} plan
 * @param {number} opMs — timestamp ms da operação
 * @param {string|null} accountId
 * @returns {boolean}
 */
export function planCoversDate(plan, opMs, accountId = null) {
  if (!plan || opMs == null) return false;
  if (plan.active === false) return false;
  if (accountId && plan.accountId && plan.accountId !== accountId) return false;

  const createdMs = toMs(plan.createdAt);
  if (createdMs != null && opMs < createdMs) return false;

  const closedMs = toMs(plan.closedAt);
  if (closedMs != null && opMs > closedMs) return false;

  return true;
}

/**
 * Detecta operações sem plano cobrindo sua data.
 *
 * @param {Object} params
 * @param {Object[]} params.operations — operações reconstruídas
 * @param {Object[]} params.plans — planos candidatos (da conta ou do aluno)
 * @param {string|null} [params.accountId] — se fornecido, filtra planos por conta
 * @returns {{
 *   hasCoverageGap: boolean,
 *   gapOperations: Array<{ operation: Object, opMs: number|null, reason: string }>,
 * }}
 */
export function detectCoverageGap({ operations = [], plans = [], accountId = null } = {}) {
  const gapOperations = [];

  for (const op of operations) {
    if (op?._isOpen) continue;

    const opMs = getOperationDateMs(op);
    if (opMs == null) {
      // Sem data identificável — não classificamos como gap (fail-open).
      continue;
    }

    const covered = plans.some(p => planCoversDate(p, opMs, accountId));
    if (!covered) {
      gapOperations.push({
        operation: op,
        opMs,
        reason: plans.length === 0
          ? 'Nenhum plano cadastrado para a conta'
          : 'Data anterior ao plano mais antigo da conta',
      });
    }
  }

  return {
    hasCoverageGap: gapOperations.length > 0,
    gapOperations,
  };
}

export default detectCoverageGap;
