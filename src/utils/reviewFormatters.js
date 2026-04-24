/**
 * reviewFormatters
 * @description Helpers puros compartilhados entre WeeklyReviewPage (mentor) e
 *              StudentReviewsPage (aluno). Formatação BR (INV-06) e lógica de
 *              delta/agrupamento de trades.
 *
 * Origem: extração de WeeklyReviewPage.jsx (issue #119 task 28) para permitir
 * reuso read-only pelo aluno sem duplicação (AP-02/AP-03).
 */

// ============================================
// Formatadores — BR (INV-06)
// ============================================

export const fmtMoney = (v, currency = 'USD') => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(n);
};

export const fmtPct = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(1)}%`;
};

export const fmtNum = (v, digits = 2) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(digits);
};

export const fmtTime = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

export const fmtDateBR = (iso) => {
  if (!iso || typeof iso !== 'string') return '—';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
};

// ============================================
// Delta KPI (current vs previous)
// ============================================

export const deltaText = (curr, prev, fmt = (v) => String(v), invertColors = false) => {
  const c = Number(curr);
  const p = Number(prev);
  if (!Number.isFinite(p)) return null;
  const d = c - p;
  if (d === 0) return { text: '=', cls: 'text-slate-500' };
  const up = d > 0;
  const good = invertColors ? !up : up;
  const sign = up ? '+' : '';
  return {
    text: `${sign}${fmt(d)}`,
    cls: good ? 'text-emerald-400' : 'text-red-400',
  };
};

// ============================================
// Trades: extração de data + agrupamento por dia
// ============================================

export const tradeDate = (t) => {
  if (!t) return null;
  if (t.entryTime && typeof t.entryTime === 'string') return t.entryTime.slice(0, 10);
  if (t.date) return t.date;
  return null;
};

export const DAY_GROUP_THRESHOLD = 2;

/**
 * Constrói lista de rows visíveis para a tabela de trades:
 * - Dia com count > 2 colapsado → 1 row-resumo única (daySummary). Click expande.
 * - Dia com count > 2 expandido → row-resumo + todas as trades do dia.
 * - Dia com count ≤ 2 → trades renderizadas flat, sem resumo.
 */
export const buildVisibleRows = (trades, expandedDays) => {
  if (!Array.isArray(trades) || trades.length === 0) return [];
  const days = new Map();
  for (const t of trades) {
    const d = tradeDate(t);
    if (!d) continue;
    if (!days.has(d)) days.set(d, []);
    days.get(d).push(t);
  }
  const sortedDates = Array.from(days.keys()).sort((a, b) => b.localeCompare(a));
  const result = [];
  for (const date of sortedDates) {
    const dayTrades = days.get(date).sort((a, b) =>
      (a.entryTime || '').localeCompare(b.entryTime || '')
    );
    const count = dayTrades.length;
    const pl = dayTrades.reduce((s, t) => s + (Number(t.pnl) || 0), 0);
    const wins = dayTrades.filter((t) => Number(t.pnl) > 0).length;
    const wr = count > 0 ? Math.round((wins / count) * 100) : 0;
    if (count > DAY_GROUP_THRESHOLD) {
      const isExpanded = expandedDays.has(date);
      result.push({ type: 'daySummary', date, count, pl, wins, wr, expanded: isExpanded });
      if (isExpanded) {
        for (const t of dayTrades) result.push({ type: 'trade', data: t });
      }
    } else {
      for (const t of dayTrades) result.push({ type: 'trade', data: t });
    }
  }
  return result;
};

// ============================================
// Revisão anterior do mesmo plano
// ============================================

/**
 * Retorna a revisão anterior (mais recente anterior em weekStart) do MESMO plano.
 * - allReviews: lista de reviews (do hook useWeeklyReviews ou onSnapshot dedicado).
 *   Assume ordenada por weekStart desc, mas a função faz busca linear independente.
 * - currentReview: review atual (id + weekStart + planId/frozenSnapshot.planContext.planId).
 * - planId (opcional): override do planId. Se omitido, extraído do currentReview.
 *
 * Retorna null se não houver revisão anterior do mesmo plano.
 */
export const getPreviousReview = (allReviews, currentReview, planId = null) => {
  if (!currentReview || !Array.isArray(allReviews)) return null;
  const pid = planId
    || currentReview?.planId
    || currentReview?.frozenSnapshot?.planContext?.planId;
  if (!pid) return null;
  return (
    allReviews.find((r) =>
      r.id !== currentReview.id
      && (r.planId === pid || r.frozenSnapshot?.planContext?.planId === pid)
      && r.weekStart < currentReview.weekStart
    ) || null
  );
};

// ============================================
// Status badge (reuso CLOSED/ARCHIVED/DRAFT)
// ============================================

export const statusBadge = (status) => {
  switch (status) {
    case 'DRAFT': return { label: 'aberta', cls: 'bg-amber-500/15 text-amber-400' };
    case 'CLOSED': return { label: 'publicada', cls: 'bg-emerald-500/15 text-emerald-400' };
    case 'ARCHIVED': return { label: 'arquivada', cls: 'bg-slate-500/15 text-slate-400' };
    default: return { label: status || '—', cls: 'bg-slate-500/15 text-slate-400' };
  }
};
