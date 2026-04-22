/**
 * equityCurveIdeal.js
 * @description Curva ideal (meta + stop) do plano para overlay no EquityCurve.
 *              Trajetória linear pelos dias corridos do ciclo (não dias úteis).
 *              Continua extrapolando após meta — não congela.
 *
 * @see Issue #164 — E5 EquityCurve ampliado
 */

const MS_PER_DAY = 86400000;

const toUtcDate = (input) => {
  if (input instanceof Date) {
    if (isNaN(input.getTime())) return null;
    // Normaliza para meia-noite UTC do dia local — comparações ficam day-only.
    return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
  }
  if (typeof input === 'string') {
    const match = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    const y = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const d = parseInt(match[3], 10);
    const date = new Date(Date.UTC(y, m - 1, d));
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
};

const formatISO = (date) => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Gera série de pontos da curva ideal de meta e stop ao longo do ciclo.
 * Trajetória LINEAR pelos dias corridos: 1 ponto por dia entre startDate e endDate.
 * Continua extrapolando após meta — a curva real do componente decide se ultrapassa.
 *
 * @param {{ pl: number, cycleGoal: number, cycleStop: number }} plan
 * @param {{ startDate: string|Date, endDate: string|Date }} cycle
 * @returns {Array<{ date: string, goal: number, stop: number, dayIndex: number }>|null}
 */
export const generateIdealEquitySeries = (plan, cycle) => {
  if (!plan || !cycle) return null;

  const pl = Number(plan.pl);
  const cycleGoal = Number(plan.cycleGoal);
  const cycleStop = Number(plan.cycleStop);

  if (!isFinite(pl) || pl <= 0) return null;
  if (!isFinite(cycleGoal) || cycleGoal <= 0) return null;
  if (!isFinite(cycleStop) || cycleStop <= 0) return null;

  const startDate = toUtcDate(cycle.startDate);
  const endDate = toUtcDate(cycle.endDate);
  if (!startDate || !endDate) return null;
  if (startDate > endDate) return null;

  const totalDays = Math.round((endDate - startDate) / MS_PER_DAY);
  const goalPercent = cycleGoal / 100;
  const stopPercent = cycleStop / 100;

  // Caso single-day: cycle.start == cycle.end → 1 ponto que já reflete o alvo final
  // (o ciclo inteiro é "hoje", então o corredor "termina" no mesmo ponto que começa).
  if (totalDays === 0) {
    return [{
      date: formatISO(startDate),
      goal: pl * (1 + goalPercent),
      stop: pl * (1 - stopPercent),
      dayIndex: 0,
    }];
  }

  const points = [];
  for (let dayIndex = 0; dayIndex <= totalDays; dayIndex++) {
    const ratio = dayIndex / totalDays;
    const date = new Date(startDate.getTime() + dayIndex * MS_PER_DAY);
    points.push({
      date: formatISO(date),
      goal: pl * (1 + goalPercent * ratio),
      stop: pl * (1 - stopPercent * ratio),
      dayIndex,
    });
  }

  return points;
};

/**
 * Calcula posição relativa do PL real vs corredor ideal no momento atual.
 * Status por inclusão: equity == goal ou equity == stop é considerado 'inside'
 * (a meta é o teto do corredor; o stop é o piso).
 *
 * @param {number} currentEquity - PL acumulado real no momento (delta vs initialBalance)
 * @param {number} initialBalance - Saldo inicial usado como base do equity
 * @param {Array} idealSeries - Saída de generateIdealEquitySeries
 * @param {Date} [now=new Date()]
 * @returns {{ status: 'above'|'inside'|'below', percentVsGoal: number, percentVsStop: number }|null}
 */
export const calculateIdealStatus = (currentEquity, initialBalance, idealSeries, now = new Date()) => {
  if (!Array.isArray(idealSeries) || idealSeries.length === 0) return null;

  const todayUtc = toUtcDate(now);
  if (!todayUtc) return null;

  const startUtc = toUtcDate(idealSeries[0].date);
  const lastIdx = idealSeries.length - 1;
  const dayOffset = startUtc ? Math.round((todayUtc - startUtc) / MS_PER_DAY) : 0;
  const clampedIdx = Math.max(0, Math.min(lastIdx, dayOffset));
  const point = idealSeries[clampedIdx];

  const realEquity = (Number(initialBalance) || 0) + (Number(currentEquity) || 0);

  // Base para percentuais: pl reconstruído a partir do ponto 0 (goal == stop == pl no início)
  const pl = idealSeries[0].goal;
  const percentVsGoal = pl > 0 ? ((realEquity - point.goal) / pl) * 100 : 0;
  const percentVsStop = pl > 0 ? ((realEquity - point.stop) / pl) * 100 : 0;

  let status;
  if (realEquity > point.goal) status = 'above';
  else if (realEquity < point.stop) status = 'below';
  else status = 'inside';

  return { status, percentVsGoal, percentVsStop };
};
