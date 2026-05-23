// ============================================
// propFirmConsistency — regras de consistência por mesa
// ============================================
// Regra "maxDayPercentOfTarget" (Zero7):
//   - EVALUATION: se algum dia tem dailyPL > profitTarget * rule,
//     a conta é desclassificada (CONSISTENCY_VIOLATION).
//     Ex.: TRAINEE rule=0.50, profitTarget=R$997 → dia >R$498,50 reprova.
//
//   - SIM_FUNDED / LIVE: dias com dailyPL >= cyclePL * rule são marcados como
//     "inflados" e descartados do cálculo do prêmio (eligibleWithdrawal).
//     Ex.: rule=0.50, cyclePL=R$3000 → dia que rendeu R$1800 (>=R$1500) é
//     descartado; eligibleWithdrawal = 3000 − 1800 = R$1200.
//
// Função pura sem efeitos colaterais. Mirror CJS em functions/propFirmEngine.js
// na Fase 3 (mantém DT-034 — sync manual).
//
// Issue #273 — Zero7 Tesouraria.

/**
 * Agrupa P&L por dia (YYYY-MM-DD).
 * Lê de trade.tradeDate (preferencial), com fallback para trade.exitDate ou closedAt.
 *
 * @param {Array<Object>} trades
 * @returns {Array<{ date: string, pl: number }>}
 */
export function aggregateDailyPL(trades) {
  if (!Array.isArray(trades) || trades.length === 0) return [];

  const map = {};
  for (const t of trades) {
    const day = t.tradeDate
      || (typeof t.exitDate === 'string' ? t.exitDate.slice(0, 10) : null)
      || (typeof t.closedAt === 'string' ? t.closedAt.slice(0, 10) : null);
    if (!day) continue;
    const pl = Number(t.netPL ?? t.result ?? t.pl ?? 0);
    if (!Number.isFinite(pl)) continue;
    map[day] = (map[day] ?? 0) + pl;
  }
  return Object.entries(map)
    .map(([date, pl]) => ({ date, pl }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Aplica a regra de consistência de % máxima por dia.
 *
 * @param {Object} args
 * @param {Array<Object>} args.trades — trades da janela (avaliação ou ciclo de payout)
 * @param {Object} args.template — template da mesa (precisa de consistency.maxDayPercentOfTarget)
 * @param {string} args.phase — EVALUATION | SIM_FUNDED | LIVE
 * @param {number} args.profitTarget — meta de aprovação (usado em EVALUATION)
 *
 * @returns {Object} resultado:
 *   - applicable: boolean — regra existe no template
 *   - phase: string — fase processada
 *   - violated: boolean — apenas para EVALUATION (desclassificação)
 *   - violatingDay: { date, pl } | null — dia que disparou (EVALUATION)
 *   - limit: number — threshold absoluto calculado (profitTarget*rule ou cyclePL*rule)
 *   - cyclePL: number — soma de daily PL (SIM_FUNDED/LIVE)
 *   - inflatedDays: Array<{ date, pl }> — dias descartados (SIM_FUNDED/LIVE)
 *   - eligiblePL: number — cyclePL − sum(inflatedDays.pl) (SIM_FUNDED/LIVE)
 *   - rule: number — valor do template (0..1)
 */
export function checkMaxDayPercentOfTarget({ trades, template, phase, profitTarget }) {
  const rule = template?.consistency?.maxDayPercentOfTarget;
  const result = {
    applicable: false,
    phase: phase ?? null,
    violated: false,
    violatingDay: null,
    limit: 0,
    cyclePL: 0,
    inflatedDays: [],
    eligiblePL: 0,
    rule: rule ?? null
  };

  if (typeof rule !== 'number' || rule <= 0 || rule >= 1) {
    return result;
  }
  result.applicable = true;

  const daily = aggregateDailyPL(trades);

  if (phase === 'EVALUATION') {
    const target = Number(profitTarget);
    if (!Number.isFinite(target) || target <= 0) {
      return result;
    }
    const limit = target * rule;
    const violatingDay = daily.find(d => d.pl > limit) ?? null;
    return {
      ...result,
      violated: !!violatingDay,
      violatingDay,
      limit
    };
  }

  if (phase === 'SIM_FUNDED' || phase === 'LIVE') {
    const cyclePL = daily.reduce((sum, d) => sum + d.pl, 0);
    if (cyclePL <= 0) {
      return { ...result, cyclePL, limit: 0, eligiblePL: cyclePL };
    }
    const limit = cyclePL * rule;
    const inflatedDays = daily.filter(d => d.pl >= limit && d.pl > 0);
    const inflatedSum = inflatedDays.reduce((s, d) => s + d.pl, 0);
    return {
      ...result,
      cyclePL,
      limit,
      inflatedDays,
      eligiblePL: cyclePL - inflatedSum
    };
  }

  return result;
}

/**
 * Filtra trades cujo |netPoints| < threshold do instrumento (saldos inaptos da Zero7).
 * Aplicado antes do cálculo de prêmio na Incubadora.
 *
 * @param {Array<Object>} trades
 * @param {Object} filter — mapa { SYMBOL: minPoints }, ex.: { WIN: 10, WDO: 0.5, BIT: 1000 }
 *
 * @returns {{ eligible: Array, ineligible: Array }}
 */
export function filterIneligibleTrades(trades, filter) {
  if (!Array.isArray(trades)) return { eligible: [], ineligible: [] };
  if (!filter || typeof filter !== 'object') return { eligible: trades, ineligible: [] };

  const eligible = [];
  const ineligible = [];
  for (const t of trades) {
    const symbol = (t.instrument ?? t.symbol ?? '').toUpperCase();
    const min = filter[symbol];
    if (typeof min !== 'number' || min <= 0) {
      eligible.push(t);
      continue;
    }
    const points = Math.abs(Number(t.netPoints ?? t.points ?? 0));
    if (points >= min) {
      eligible.push(t);
    } else {
      ineligible.push(t);
    }
  }
  return { eligible, ineligible };
}

/**
 * Conta saques de uma fase específica para checar limite (ex.: Zero7 SIM_FUNDED max 4).
 *
 * @param {Array<Object>} movements — array de movements com { type, phase, accountId }
 * @param {string} accountId
 * @param {string} phase
 *
 * @returns {number}
 */
export function countWithdrawalsInPhase(movements, accountId, phase) {
  if (!Array.isArray(movements)) return 0;
  return movements.filter(m =>
    m
    && (m.type === 'WITHDRAWAL' || m.type === 'withdrawal')
    && (!accountId || m.accountId === accountId)
    && m.phase === phase
  ).length;
}

/**
 * Checa se o limite de saques foi atingido para uma fase.
 *
 * @param {Object} args
 * @param {Array<Object>} args.movements
 * @param {string} args.accountId
 * @param {string} args.phase
 * @param {Object} args.template — precisa de payout.maxWithdrawalsByPhase
 *
 * @returns {{ used: number, max: number | null, remaining: number | null, limitReached: boolean }}
 */
export function checkWithdrawalLimit({ movements, accountId, phase, template }) {
  const max = template?.payout?.maxWithdrawalsByPhase?.[phase] ?? null;
  const used = countWithdrawalsInPhase(movements, accountId, phase);
  if (max === null || max === undefined) {
    return { used, max: null, remaining: null, limitReached: false };
  }
  const remaining = Math.max(0, max - used);
  return { used, max, remaining, limitReached: used >= max };
}

/**
 * Verifica se o dia atual está dentro de uma janela de payout fixed-days.
 *
 * @param {Date|string} today
 * @param {Array<number>} fixedDays — ex.: [10, 20, 30]
 *
 * @returns {{ open: boolean, nextDay: string, dayOfMonth: number }}
 */
export function isPayoutWindowOpen(today, fixedDays) {
  if (!Array.isArray(fixedDays) || fixedDays.length === 0) {
    return { open: false, nextDay: null, dayOfMonth: null };
  }
  const date = today instanceof Date ? today : new Date(today);
  if (Number.isNaN(date.getTime())) {
    return { open: false, nextDay: null, dayOfMonth: null };
  }

  const dom = date.getDate();
  const sortedDays = [...fixedDays].sort((a, b) => a - b);
  const open = sortedDays.includes(dom);

  // próxima janela: primeiro dia >= hoje no mês atual; senão, primeiro dia do mês seguinte
  let nextDay;
  const upcoming = sortedDays.find(d => d >= dom);
  if (upcoming) {
    const next = new Date(date.getFullYear(), date.getMonth(), upcoming);
    nextDay = next.toISOString().slice(0, 10);
  } else {
    const next = new Date(date.getFullYear(), date.getMonth() + 1, sortedDays[0]);
    nextDay = next.toISOString().slice(0, 10);
  }
  return { open, nextDay, dayOfMonth: dom };
}
