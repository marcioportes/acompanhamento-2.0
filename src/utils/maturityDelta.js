/**
 * maturityDelta
 * @description Compara dois snapshots congelados de maturidade
 *              (frozenSnapshot.maturitySnapshot de duas reviews CLOSED/ARCHIVED
 *              do MESMO plano). Issue #119 task 16 / Fase E2.
 *
 * Pure function — zero I/O, zero Firestore. Opera sobre o shape congelado
 * em `clientSnapshotBuilder.freezeMaturity` (task 15): cópia rasa do doc
 * `students/{uid}/maturity/current` sem timestamps voláteis + `frozenAt` ISO.
 *
 * Contract dos inputs:
 *   - current  → maturitySnapshot da review N  (pode ser null quando a review
 *                foi fechada antes de task 15 ou o motor nunca rodou).
 *   - previous → maturitySnapshot da review N-1 (null quando é a primeira
 *                review CLOSED do plano).
 *
 * Returns shape idempotente (sempre as mesmas chaves) — consumers podem
 * destructurar sem guards extras. `hasData=false` sinaliza que current é
 * ausente e a seção deve ser ocultada ("primeiro CLOSED" é hasData=true,
 * previous=null, stageChange=null).
 */

const DIM_KEYS = ['emotional', 'financial', 'operational', 'maturity', 'composite'];

const emptyShape = () => ({
  scoreDeltas: { emotional: null, financial: null, operational: null, maturity: null, composite: null },
  stageChange: null,
  currentStage: null,
  previousStage: null,
  gateDeltas: [],
  hasData: false,
});

/**
 * computeMaturityDelta
 * @param {Object|null} current  Snapshot da review N.
 * @param {Object|null} previous Snapshot da review N-1, ou null se for primeira.
 * @returns {{
 *   scoreDeltas: { emotional, financial, operational, maturity, composite },
 *   stageChange: 'UP' | 'DOWN' | 'SAME' | null,
 *   currentStage: number | null,
 *   previousStage: number | null,
 *   gateDeltas: Array<{
 *     id, label, previousMet, currentMet, previousValue, currentValue,
 *     valueDelta, change
 *   }>,
 *   hasData: boolean,
 * }}
 */
export function computeMaturityDelta(current, previous) {
  if (!current || typeof current !== 'object') return emptyShape();

  const scoreDeltas = { emotional: null, financial: null, operational: null, maturity: null, composite: null };
  for (const k of DIM_KEYS) {
    const curr = current.dimensionScores?.[k];
    const prev = previous?.dimensionScores?.[k];
    if (typeof curr === 'number' && typeof prev === 'number') {
      scoreDeltas[k] = curr - prev;
    }
  }

  const currentStage = current.currentStage ?? null;
  const previousStage = previous?.currentStage ?? null;
  let stageChange = null;
  if (currentStage != null && previousStage != null) {
    if (currentStage > previousStage) stageChange = 'UP';
    else if (currentStage < previousStage) stageChange = 'DOWN';
    else stageChange = 'SAME';
  }

  const currGates = Array.isArray(current.gates) ? current.gates : [];
  const prevGates = Array.isArray(previous?.gates) ? previous.gates : [];
  const prevMap = new Map(prevGates.map((g) => [g.id, g]));
  const seen = new Set();
  const gateDeltas = [];

  for (const g of currGates) {
    const prev = prevMap.get(g.id);
    seen.add(g.id);
    const cM = g.met;
    const pM = prev?.met ?? null;
    let change;
    if (!prev) change = 'NEW';
    else if (pM !== true && cM === true) change = 'GAINED';
    else if (pM === true && cM !== true) change = 'LOST';
    else if (pM === true && cM === true) change = 'STAGNANT_MET';
    else change = 'STAGNANT_UNMET';

    const cVal = typeof g.value === 'number' ? g.value : null;
    const pVal = typeof prev?.value === 'number' ? prev.value : null;
    const valueDelta = (cVal != null && pVal != null) ? cVal - pVal : null;

    gateDeltas.push({
      id: g.id,
      label: g.label,
      previousMet: prev?.met ?? null,
      currentMet: g.met,
      previousValue: pVal,
      currentValue: cVal,
      valueDelta,
      change,
    });
  }

  // Gates que existiam em previous mas sumiram em current (troca de stage
  // muda o conjunto de gates avaliados — ex.: após promoção, gates do stage
  // antigo saem e entram os do novo).
  for (const g of prevGates) {
    if (seen.has(g.id)) continue;
    gateDeltas.push({
      id: g.id,
      label: g.label,
      previousMet: g.met,
      currentMet: null,
      previousValue: typeof g.value === 'number' ? g.value : null,
      currentValue: null,
      valueDelta: null,
      change: 'REMOVED',
    });
  }

  return {
    scoreDeltas,
    stageChange,
    currentStage,
    previousStage,
    gateDeltas,
    hasData: true,
  };
}

export default computeMaturityDelta;
