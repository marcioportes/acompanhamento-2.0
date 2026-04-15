/**
 * validate.js — Validação pós-processamento da resposta da IA para generatePropFirmApproachPlan.
 *
 * Pura função — sem dependências de firebase. Testável via Vitest em
 * `src/__tests__/utils/propFirmAiValidate.test.js`.
 *
 * Executa 7 grupos de validação:
 *   1. Shape: campos obrigatórios presentes no JSON retornado
 *   2. Read-only: números determinísticos ecoados corretamente (stopPoints, targetPoints, roUSD, maxTradesPerDay, contracts)
 *   3. Constraints da mesa: RO ≤ dailyLossLimit, dailyExposure ≤ dailyLossLimit
 *   4. Viabilidade técnica: stopPoints ≥ minViableStop, stop/nyRange ≤ 75%
 *   5. Coerência mecânica: scenarios "Dia ideal" === +dailyGoal, "Dia ruim" === -dailyStop
 *   6. Cenários: 4 cenários nomeados corretamente
 *   7. Metadata: promptVersion e dataSource válidos
 *
 * Tolerância numérica: ±$1 para arredondamentos da IA ao ecoar valores.
 *
 * @version 1.0
 * @since issue #133
 */

const MONEY_TOLERANCE = 1; // USD — tolera arredondamento da IA
const POINTS_TOLERANCE = 0.01; // pontos

const REQUIRED_SCENARIO_NAMES = ['Dia ideal', 'Dia médio', 'Dia ruim', 'Sequência de losses'];

/**
 * @param {object} aiPlan — resposta parseada da IA
 * @param {object} constraints — contexto determinístico
 * @param {object} constraints.plan — { roUSD, stopPoints, targetPoints, maxTradesPerDay, contracts, dailyGoal, dailyStop }
 * @param {object} constraints.firm — { dailyLossLimit }
 * @param {object} constraints.instrument — { nyRange, minViableStop }
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateAIPlan(aiPlan, constraints) {
  const errors = [];
  const { plan, firm, instrument } = constraints;

  // ── 1. SHAPE ─────────────────────────────────────────────────
  if (!aiPlan || typeof aiPlan !== 'object') {
    return { valid: false, errors: ['aiPlan não é um objeto'] };
  }
  const requiredTop = ['approach', 'executionPlan', 'scenarios', 'behavioralGuidance', 'milestones', 'metadata'];
  for (const key of requiredTop) {
    if (!aiPlan[key]) errors.push(`Campo obrigatório ausente: ${key}`);
  }
  if (errors.length > 0) return { valid: false, errors };

  const { executionPlan, scenarios, metadata } = aiPlan;

  // ── 2. READ-ONLY (números determinísticos ecoados) ──────────
  const readOnlyChecks = [
    { field: 'roUSD', expected: plan.roUSD, tol: MONEY_TOLERANCE },
    { field: 'stopPoints', expected: plan.stopPoints, tol: POINTS_TOLERANCE },
    { field: 'targetPoints', expected: plan.targetPoints, tol: POINTS_TOLERANCE },
    { field: 'maxTradesPerDay', expected: plan.maxTradesPerDay, tol: 0 },
    { field: 'contracts', expected: plan.contracts, tol: 0 },
  ];
  for (const { field, expected, tol } of readOnlyChecks) {
    const actual = executionPlan[field];
    if (typeof actual !== 'number') {
      errors.push(`executionPlan.${field} ausente ou não-numérico`);
      continue;
    }
    if (Math.abs(actual - expected) > tol) {
      errors.push(`executionPlan.${field} alterado: esperado ${expected}, recebido ${actual} (IA não pode modificar números determinísticos)`);
    }
  }

  // ── 3. CONSTRAINTS DA MESA ───────────────────────────────────
  if (typeof executionPlan.roUSD === 'number' && executionPlan.roUSD > firm.dailyLossLimit) {
    errors.push(`RO $${executionPlan.roUSD} excede dailyLossLimit $${firm.dailyLossLimit}`);
  }
  const dailyExposure = (executionPlan.roUSD || 0) * (executionPlan.maxTradesPerDay || 0);
  if (dailyExposure > firm.dailyLossLimit + MONEY_TOLERANCE) {
    errors.push(`Exposição diária $${dailyExposure} excede dailyLossLimit $${firm.dailyLossLimit}`);
  }

  // ── 4. VIABILIDADE TÉCNICA ───────────────────────────────────
  if (typeof executionPlan.stopPoints === 'number') {
    if (instrument.minViableStop != null && executionPlan.stopPoints < instrument.minViableStop) {
      errors.push(`Stop ${executionPlan.stopPoints}pts abaixo do mínimo ${instrument.minViableStop}pts`);
    }
    if (instrument.nyRange > 0) {
      const stopNyPct = (executionPlan.stopPoints / instrument.nyRange) * 100;
      if (stopNyPct > 75) {
        errors.push(`Stop ${stopNyPct.toFixed(1)}% do range NY — excede 75%`);
      }
    }
  }

  // ── 5. COERÊNCIA MECÂNICA ────────────────────────────────────
  if (!Array.isArray(scenarios) || scenarios.length < 4) {
    errors.push(`scenarios deve ser array com 4 entradas (recebido: ${Array.isArray(scenarios) ? scenarios.length : typeof scenarios})`);
  } else {
    const ideal = scenarios.find((s) => s.name === 'Dia ideal');
    const ruim = scenarios.find((s) => s.name === 'Dia ruim');
    if (ideal && typeof ideal.result === 'number') {
      if (Math.abs(ideal.result - plan.dailyGoal) > MONEY_TOLERANCE) {
        errors.push(`Cenário "Dia ideal" result ${ideal.result} !== dailyGoal ${plan.dailyGoal} (coerência mecânica)`);
      }
    } else if (ideal) {
      errors.push(`Cenário "Dia ideal" sem result numérico`);
    }
    if (ruim && typeof ruim.result === 'number') {
      if (Math.abs(ruim.result - -plan.dailyStop) > MONEY_TOLERANCE) {
        errors.push(`Cenário "Dia ruim" result ${ruim.result} !== -dailyStop ${-plan.dailyStop} (coerência mecânica)`);
      }
    } else if (ruim) {
      errors.push(`Cenário "Dia ruim" sem result numérico`);
    }
  }

  // ── 6. NOMES DE CENÁRIOS ─────────────────────────────────────
  if (Array.isArray(scenarios)) {
    const names = scenarios.map((s) => s.name);
    for (const required of REQUIRED_SCENARIO_NAMES) {
      if (!names.includes(required)) {
        errors.push(`Cenário "${required}" ausente`);
      }
    }
  }

  // ── 7. METADATA ──────────────────────────────────────────────
  if (!metadata || typeof metadata !== 'object') {
    errors.push('metadata ausente');
  } else {
    const validSources = ['4d_full', 'indicators', 'defaults'];
    if (metadata.dataSource && !validSources.includes(metadata.dataSource)) {
      errors.push(`metadata.dataSource inválido: "${metadata.dataSource}" (esperado: ${validSources.join('|')})`);
    }
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

/**
 * Monta um plano determinístico fallback (sem IA) — usado quando API indisponível
 * ou quando validação falha após N retries.
 * @param {object} constraints — mesmo shape de validateAIPlan
 * @param {string} reason — motivo do fallback
 * @returns {object}
 */
function buildFallbackPlan(constraints, reason) {
  const { plan } = constraints;
  return {
    approach: {
      summary: 'Plano determinístico (IA indisponível). Todos os números foram calculados pelo motor matemático do Espelho.',
      profileOverride: null,
      sessionRecommendation: {
        primary: 'ny',
        secondary: 'london',
        avoid: null,
        reasoning: 'Recomendação padrão: sessão NY como primária (60% do range diário).',
      },
      dailyProfiles: {
        recommended: ['LONDON_REVERSAL'],
        avoid: ['INVALIDATION'],
        reasoning: 'Padrão conservador: Reversão 01:00 oferece maior clareza.',
      },
    },
    executionPlan: {
      stopPoints: plan.stopPoints,
      targetPoints: plan.targetPoints,
      maxTradesPerDay: plan.maxTradesPerDay,
      roUSD: plan.roUSD,
      contracts: plan.contracts,
      tradingStyle: 'day trade',
      entryStrategy: 'Seguir o plano mecânico com disciplina.',
      exitStrategy: 'Target fixo no preço calculado; stop obrigatório.',
      pathRecommendation: `Path A: ${plan.maxTradesPerDay} trades × 1 contrato, ou Path B: 1 trade × ${plan.contracts || plan.maxTradesPerDay} contratos.`,
    },
    scenarios: [
      { name: 'Dia ideal', description: `Trader atingiu todos os ${plan.maxTradesPerDay} targets.`, trades: plan.maxTradesPerDay, result: plan.dailyGoal, cumulative: 'Acumulado positivo no alvo do dia.' },
      { name: 'Dia médio', description: '1 win + 1 loss parciais.', trades: 2, result: (plan.targetPoints && plan.stopPoints) ? 0 : 0, cumulative: 'Próximo do breakeven no dia.' },
      { name: 'Dia ruim', description: 'Trader acionou todos os stops.', trades: plan.maxTradesPerDay, result: -plan.dailyStop, cumulative: 'Bateu dailyStop; parar.' },
      { name: 'Sequência de losses', description: 'Após 2 losses seguidos, parar o dia e revisar plano.', trades: 2, result: -(plan.roUSD || 0) * 2, cumulative: 'Proteção comportamental.' },
    ],
    behavioralGuidance: {
      preSession: 'Revisar plano, marcar níveis-chave, definir bias do dia.',
      duringSession: 'Executar apenas setups do plano. Zero improviso.',
      afterLoss: 'Respirar. Revisar se foi plano ou emoção. Se for 2º loss, encerrar o dia.',
      afterWin: 'Proteger o ganho. Não aumentar size.',
      deadlineManagement: 'Não tentar recuperar dias ruins com size maior.',
      personalWarnings: ['Plano determinístico puro — complete o assessment 4D para orientações personalizadas.'],
    },
    milestones: [],
    metadata: {
      model: 'deterministic',
      promptVersion: '1.1',
      dataSource: 'defaults',
      generatedAt: new Date().toISOString(),
      aiUnavailable: true,
      fallbackReason: reason,
    },
  };
}

module.exports = {
  validateAIPlan,
  buildFallbackPlan,
  MONEY_TOLERANCE,
  POINTS_TOLERANCE,
  REQUIRED_SCENARIO_NAMES,
};
