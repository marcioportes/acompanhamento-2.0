/**
 * src/utils/maturityEngine/fixtures.js
 *
 * Builder sintético para testes do motor de maturidade (issue #119).
 * Zero dependência de dados reais; counter determinístico via resetFixtureCounter().
 */

let _counter = 0;

export function resetFixtureCounter() {
  _counter = 0;
}

function nextId() {
  _counter += 1;
  return `trade-${_counter.toString().padStart(6, '0')}`;
}

function ensureWeekday(isoDate) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d.toISOString().slice(0, 10);
}

function advanceWeekday(isoDate) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  do {
    d.setUTCDate(d.getUTCDate() + 1);
  } while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return d.toISOString().slice(0, 10);
}

const TRADE_DEFAULTS = {
  date: '2026-01-15',
  pl: 100,
  setup: 'rompimento',
  status: 'CLOSED',
  stopLoss: 95,
  emotionEntry: 'neutro',
  emotionExit: 'neutro',
  notes: '',
  planId: 'plan-default',
  symbol: 'WIN',
};

/**
 * Gera um trade sintético com defaults razoáveis. Merge raso sobre overrides.
 */
export function makeTrade(overrides = {}) {
  return {
    id: nextId(),
    ...TRADE_DEFAULTS,
    ...overrides,
  };
}

function plFromPattern(pattern, i) {
  if (typeof pattern === 'function') return pattern(i);
  switch (pattern) {
    case 'positive':
      return 50 + (i % 5) * 10;
    case 'negative':
      return -50 - (i % 5) * 10;
    case 'mixed':
      return i % 2 === 0 ? 80 : -60;
    case 'flat':
      return 0;
    default:
      throw new Error(`Unknown plPattern: ${pattern}`);
  }
}

function setupFromSpec(spec, i) {
  return typeof spec === 'function' ? spec(i) : spec;
}

/**
 * Gera `count` trades em dias úteis consecutivos a partir de `startDate`.
 * - plPattern: 'positive' | 'negative' | 'mixed' | 'flat' | (i)=>number
 * - setup:     string | (i)=>string
 * Qualquer outro campo sobrescreve o default.
 */
export function makeTradeSeries({
  count,
  startDate = '2026-01-01',
  plPattern = 'positive',
  setup = 'rompimento',
  ...overrides
} = {}) {
  if (typeof count !== 'number' || count < 0 || !Number.isInteger(count)) {
    throw new Error(`makeTradeSeries requires a non-negative integer count (got ${count})`);
  }
  const trades = [];
  let currentDate = ensureWeekday(startDate);
  for (let i = 0; i < count; i += 1) {
    trades.push(
      makeTrade({
        ...overrides,
        date: currentDate,
        pl: plFromPattern(plPattern, i),
        setup: setupFromSpec(setup, i),
      })
    );
    if (i < count - 1) currentDate = advanceWeekday(currentDate);
  }
  return trades;
}

/**
 * Baseline 4D sintético. Merge raso sobre overrides.
 */
export function makeBaselineScores(overrides = {}) {
  return {
    emotional: 50,
    financial: 50,
    operational: 50,
    ...overrides,
  };
}
