/**
 * Helpers para previsão de renovações — issue #122
 */

/**
 * Agrupa subscriptions ativas paid por mês de vencimento, limitado a um horizonte.
 * @param {Array} subscriptions - lista enriquecida (com studentName, endDate, amount, status, type)
 * @param {Date} [now] - data de referência (para testes)
 * @param {number} [maxMonths=6] - horizonte máximo em meses a partir de now
 * @returns {Array<{ monthKey: string, label: string, totalAmount: number, students: Array }>}
 */
export const groupRenewalsByMonth = (subscriptions, now = new Date(), maxMonths = 6) => {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  // Limite do horizonte
  const horizon = new Date(today);
  horizon.setMonth(horizon.getMonth() + maxMonths);
  horizon.setDate(0); // último dia do mês anterior ao limite
  horizon.setHours(23, 59, 59, 999);
  // Ajuste: ir ao fim do mês do horizonte
  const horizonEnd = new Date(today);
  horizonEnd.setMonth(horizonEnd.getMonth() + maxMonths + 1, 0);
  horizonEnd.setHours(23, 59, 59, 999);

  // Filtrar: active ou overdue + paid + endDate existe
  // Active com endDate no passado = receita pendente (CF ainda não marcou overdue)
  // Overdue = receita em atraso
  // Ambos com endDate no passado → alocados no mês corrente
  const eligible = subscriptions.filter(sub => {
    if (sub.status !== 'active' && sub.status !== 'overdue') return false;
    if (sub.type === 'trial' || sub.type === 'vip') return false;
    if (!sub.endDate) return false;
    const end = new Date(sub.endDate);
    end.setHours(0, 0, 0, 0);
    // Passado: sempre elegível (vai para mês corrente)
    if (end < today) return true;
    // Futuro: dentro do horizonte
    return end <= horizonEnd;
  });

  // monthKey do mês corrente (para realocar overdue)
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  // Agrupar por mês/ano
  const groups = {};
  for (const sub of eligible) {
    const d = new Date(sub.endDate);
    d.setHours(0, 0, 0, 0);

    // endDate no passado (overdue ou active pendente) → alocar no mês corrente
    const isOverduePast = d < today;
    const targetDate = isOverduePast ? today : d;
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

    if (!groups[monthKey]) {
      const label = targetDate.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('. de ', '/').replace(' de ', '/');
      groups[monthKey] = { monthKey, label, totalAmount: 0, students: [] };
    }

    groups[monthKey].totalAmount += sub.amount ?? 0;
    groups[monthKey].students.push({
      name: sub.studentName ?? sub.studentId ?? '—',
      endDate: sub.endDate,
      amount: sub.amount ?? 0,
      overdue: isOverduePast,
    });
  }

  return Object.values(groups).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
};

/**
 * Formata data em DD/MM/YYYY usando UTC para evitar shift de fuso (INV-06).
 */
export const formatDateBR = (date) => {
  if (!date) return '—';
  const d = new Date(date);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Formata valor em BRL.
 */
export const formatBRL = (value) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value);
};
