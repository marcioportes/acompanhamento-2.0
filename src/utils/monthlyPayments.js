/**
 * monthlyPayments — issue #250
 * @description Agrega pagamentos de um mês específico a partir do collection group `payments`.
 *
 * Path origem: students/{uid}/subscriptions/{subId}/payments/{pid}
 * Schema: { date: Timestamp|Date, amount: number, currency: 'BRL'|..., studentId derivado do path }
 */

const toDate = (val) => {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val.toDate === 'function') return val.toDate();
  return new Date(val);
};

/**
 * Agrega pagamentos de um mês.
 *
 * @param {Array} payments — lista de payment docs com `date`, `amount`, `currency`, `studentId`
 * @param {number} year — ano do mês alvo
 * @param {number} month — mês 0-indexed (0=jan, 4=mai)
 * @param {Map<string,string>} studentsMap — map studentId → nome (opcional)
 * @returns {{ total: number, count: number, list: Array }}
 *   - total: soma de `amount` em BRL (outras moedas não somam — warning fica fora desta função)
 *   - count: quantidade de pagamentos no mês
 *   - list: pagamentos do mês ordenados por data desc, enriquecidos com `studentName` e `dateObj`
 */
export const aggregatePaymentsForMonth = (payments, year, month, studentsMap = new Map()) => {
  if (!Array.isArray(payments)) return { total: 0, count: 0, list: [] };

  const filtered = payments
    .map((p) => ({ ...p, dateObj: toDate(p.date) }))
    .filter((p) => p.dateObj && p.dateObj.getFullYear() === year && p.dateObj.getMonth() === month);

  filtered.sort((a, b) => b.dateObj - a.dateObj);

  const enriched = filtered.map((p) => ({
    ...p,
    studentName: studentsMap.get(p.studentId) ?? p.studentId,
  }));

  const total = enriched.reduce((sum, p) => {
    const cur = p.currency ?? 'BRL';
    return cur === 'BRL' ? sum + (Number(p.amount) || 0) : sum;
  }, 0);

  return { total, count: enriched.length, list: enriched };
};
