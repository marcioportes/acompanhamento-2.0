/**
 * closeReviewMaturityPipeline.test.js — issue #119 task 21 (H2).
 *
 * Cobre:
 *  - recompute happy path → doc lido e retornado
 *  - recompute throttled → continua e lê doc
 *  - recompute exception → continua silencioso (log)
 *  - shouldGenerateAI=false (cache hit) → IA NÃO é chamada
 *  - trigger UP + cache vazio → IA é chamada
 *  - trigger REGRESSION + cache vazio → IA é chamada, detected=true preservado
 *  - buildClassifyInput com kpis completo → tradesSummary mapeado
 *  - freeze integridade: gates array completo (met/value/threshold/gap) preservado
 *    após passagem recompute→read→buildClientSnapshot
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ===== Mocks =====
const mockRecompute = vi.fn();
const mockClassify = vi.fn();
const mockGetDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: (_db, ...path) => ({ _path: path.join('/') }),
  getDoc: (...args) => mockGetDoc(...args),
}));
vi.mock('firebase/functions', () => ({
  httpsCallable: (_fn, name) => {
    if (name === 'recomputeStudentMaturity') return mockRecompute;
    if (name === 'classifyMaturityProgression') return mockClassify;
    return vi.fn();
  },
}));
vi.mock('../../firebase', () => ({ db: {}, functions: {} }));

import {
  buildClassifyInput,
  recomputeAndReadMaturity,
  maybeDispatchMaturityAI,
} from '../../utils/closeReviewMaturityPipeline';
import { buildClientSnapshot } from '../../utils/clientSnapshotBuilder';

describe('closeReviewMaturityPipeline', () => {
  beforeEach(() => {
    mockRecompute.mockReset();
    mockClassify.mockReset();
    mockGetDoc.mockReset();
  });

  // =========================================================================
  // recomputeAndReadMaturity
  // =========================================================================

  describe('recomputeAndReadMaturity', () => {
    const mockMaturity = {
      currentStage: 3,
      baselineStage: 2,
      dimensionScores: { emotional: 70, financial: 65, operational: 72, maturity: 69 },
      gates: [
        { id: 'g1', label: 'Stop respect ≥ 80%', dim: 'operational', metric: 'stopRate',
          op: '>=', threshold: 0.8, value: 0.85, met: true, gap: null, reason: null },
        { id: 'g2', label: 'RR ≥ 1.5', dim: 'financial', metric: 'avgRR',
          op: '>=', threshold: 1.5, value: 1.2, met: false, gap: 0.3, reason: null },
      ],
      gatesMet: 1,
      gatesTotal: 2,
      gatesRatio: 0.5,
      proposedTransition: { proposed: null, score: 0.5, reasons: [] },
      signalRegression: { detected: false, suggestedStage: null, reasons: [], severity: null },
    };

    it('happy path: callable OK + doc existe → retorna maturity', async () => {
      mockRecompute.mockResolvedValueOnce({ data: { success: true } });
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: 'current',
        data: () => mockMaturity,
      });

      const res = await recomputeAndReadMaturity({ studentId: 'stu-1' });

      expect(mockRecompute).toHaveBeenCalledWith({ studentId: 'stu-1' });
      expect(res.throttled).toBe(false);
      expect(res.maturity.currentStage).toBe(3);
      expect(res.maturity.gates).toHaveLength(2);
    });

    it('throttled: throttled=true, ainda lê doc', async () => {
      mockRecompute.mockResolvedValueOnce({ data: { throttled: true, nextAllowedAt: null } });
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: 'current',
        data: () => mockMaturity,
      });

      const res = await recomputeAndReadMaturity({ studentId: 'stu-1' });

      expect(res.throttled).toBe(true);
      expect(res.maturity).not.toBeNull();
    });

    it('callable exception → loga e continua, lê doc atual', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockRecompute.mockRejectedValueOnce(new Error('network'));
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: 'current',
        data: () => mockMaturity,
      });

      const res = await recomputeAndReadMaturity({ studentId: 'stu-1' });

      expect(res.maturity).not.toBeNull();
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('doc não existe → maturity=null', async () => {
      mockRecompute.mockResolvedValueOnce({ data: { success: true } });
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });

      const res = await recomputeAndReadMaturity({ studentId: 'stu-1' });

      expect(res.maturity).toBeNull();
    });

    it('studentId ausente → no-op, retorna null', async () => {
      const res = await recomputeAndReadMaturity({ studentId: null });
      expect(res.maturity).toBeNull();
      expect(mockRecompute).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // buildClassifyInput
  // =========================================================================

  describe('buildClassifyInput', () => {
    const baseMaturity = {
      currentStage: 3,
      baselineStage: 2,
      dimensionScores: { emotional: 70, financial: 65, operational: 72, maturity: 69 },
      gates: [
        { id: 'g1', met: true, value: 0.85, threshold: 0.8, gap: null },
      ],
    };
    const baseKpis = {
      wr: 58.3,
      payoff: 1.42,
      evPerTrade: 28.5,
      avgHoldTimeMin: 45,
      emotional: { tiltCount: 1, revengeCount: 0 },
      compliance: { overall: 82 },
    };

    it('mapeia kpis para tradesSummary com winRate/payoff/expectancy', () => {
      const input = buildClassifyInput(baseMaturity, baseKpis, 'UP', 12, 'stu-1');
      expect(input.studentId).toBe('stu-1');
      expect(input.currentStage).toBe(3);
      expect(input.trigger).toBe('UP');
      expect(input.tradesSummary.windowSize).toBe(12);
      expect(input.tradesSummary.winRate).toBe(58.3);
      expect(input.tradesSummary.payoff).toBe(1.42);
      expect(input.tradesSummary.expectancy).toBe(28.5);
      expect(input.tradesSummary.tiltCount).toBe(1);
      expect(input.tradesSummary.complianceRate).toBeCloseTo(0.82, 2);
    });

    it('kpis ausentes → nulls em tradesSummary (não quebra)', () => {
      const input = buildClassifyInput(baseMaturity, null, 'REGRESSION', 0, 'stu-1');
      expect(input.tradesSummary.winRate).toBeNull();
      expect(input.tradesSummary.payoff).toBeNull();
      expect(input.tradesSummary.tiltCount).toBe(0);
    });

    it('studentId ou trigger ausente → null', () => {
      expect(buildClassifyInput(baseMaturity, baseKpis, 'UP', 5, null)).toBeNull();
      expect(buildClassifyInput(baseMaturity, baseKpis, null, 5, 'stu-1')).toBeNull();
      expect(buildClassifyInput(null, baseKpis, 'UP', 5, 'stu-1')).toBeNull();
    });

    it('gates array é passado intacto para a CF', () => {
      const input = buildClassifyInput(baseMaturity, baseKpis, 'UP', 1, 'stu-1');
      expect(input.gates).toEqual(baseMaturity.gates);
    });
  });

  // =========================================================================
  // maybeDispatchMaturityAI
  // =========================================================================

  describe('maybeDispatchMaturityAI', () => {
    it('trigger UP + cache vazio → dispara IA (returns true)', async () => {
      const maturity = {
        currentStage: 3, baselineStage: 2,
        dimensionScores: { emotional: 70 },
        gates: [],
        proposedTransition: { proposed: 'UP' },
        signalRegression: { detected: false },
      };
      mockClassify.mockResolvedValueOnce({ data: { narrative: 'x' } });

      const dispatched = maybeDispatchMaturityAI({
        studentId: 'stu-1',
        maturity,
        kpis: { wr: 60 },
        windowSize: 10,
      });

      expect(dispatched).toBe(true);
      // Espera o microtask para garantir que foi chamado
      await new Promise((r) => setTimeout(r, 0));
      expect(mockClassify).toHaveBeenCalledTimes(1);
      expect(mockClassify.mock.calls[0][0].trigger).toBe('UP');
    });

    it('trigger REGRESSION + cache vazio → dispara IA com detected=true', async () => {
      const maturity = {
        currentStage: 3, baselineStage: 2,
        dimensionScores: {}, gates: [],
        proposedTransition: { proposed: null },
        signalRegression: { detected: true, suggestedStage: 2, reasons: ['dd-spike'], severity: 'HIGH' },
      };
      mockClassify.mockResolvedValueOnce({ data: { narrative: 'y' } });

      const dispatched = maybeDispatchMaturityAI({
        studentId: 'stu-1', maturity, kpis: {}, windowSize: 5,
      });

      expect(dispatched).toBe(true);
      await new Promise((r) => setTimeout(r, 0));
      expect(mockClassify.mock.calls[0][0].trigger).toBe('REGRESSION');
    });

    it('cache hit (trigger igual ao aiTrigger gravado + aiNarrative presente) → NÃO dispara', () => {
      const maturity = {
        currentStage: 3,
        dimensionScores: {}, gates: [],
        proposedTransition: { proposed: 'UP' },
        signalRegression: { detected: false },
        aiTrigger: 'UP',
        aiNarrative: { headline: 'cached' },
      };

      const dispatched = maybeDispatchMaturityAI({
        studentId: 'stu-1', maturity, kpis: {}, windowSize: 1,
      });

      expect(dispatched).toBe(false);
      expect(mockClassify).not.toHaveBeenCalled();
    });

    it('sem trigger (estado estável) → NÃO dispara', () => {
      const maturity = {
        currentStage: 3, baselineStage: 3,
        dimensionScores: {}, gates: [],
        proposedTransition: { proposed: null },
        signalRegression: { detected: false },
      };

      const dispatched = maybeDispatchMaturityAI({
        studentId: 'stu-1', maturity, kpis: {}, windowSize: 1,
      });

      expect(dispatched).toBe(false);
      expect(mockClassify).not.toHaveBeenCalled();
    });

    it('maturity null → NÃO dispara', () => {
      const dispatched = maybeDispatchMaturityAI({
        studentId: 'stu-1', maturity: null, kpis: {}, windowSize: 0,
      });
      expect(dispatched).toBe(false);
    });

    it('falha no callable é silenciosa (não re-throw)', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const maturity = {
        currentStage: 3, baselineStage: 2,
        dimensionScores: {}, gates: [],
        proposedTransition: { proposed: 'UP' },
        signalRegression: { detected: false },
      };
      mockClassify.mockRejectedValueOnce(new Error('api-down'));

      const dispatched = maybeDispatchMaturityAI({
        studentId: 'stu-1', maturity, kpis: {}, windowSize: 1,
      });
      expect(dispatched).toBe(true);
      // Espera tick para o catch disparar
      await new Promise((r) => setTimeout(r, 0));
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  // =========================================================================
  // Integridade do freeze: gates completos sobrevivem → frozenSnapshot
  // =========================================================================

  describe('freeze integridade — gates array completo sobrevive no maturitySnapshot', () => {
    const plan = {
      id: 'plan-1', accountId: 'acc-1',
      pl: 1000, riskPerOperation: 100, rrTarget: 2,
      name: 'Plano teste', active: true,
    };
    const mkTrade = (o) => ({
      id: 't1', status: 'CLOSED', result: 50, date: '2026-04-20',
      entryTime: '2026-04-20T10:00:00Z', exitTime: '2026-04-20T11:00:00Z',
      stopLoss: 99, rrPlanned: 2, riskPercent: 1.0, ...o,
    });

    it('gates com {met, value, threshold, gap} preservados após freezeMaturity', () => {
      const maturityFromEngine = {
        currentStage: 3,
        baselineStage: 2,
        dimensionScores: { emotional: 70, financial: 65, operational: 72, maturity: 69 },
        gates: [
          { id: 'g1', label: 'Stop respect', dim: 'operational', metric: 'stopRate',
            op: '>=', threshold: 0.8, value: 0.85, met: true, gap: null, reason: null },
          { id: 'g2', label: 'RR alvo', dim: 'financial', metric: 'avgRR',
            op: '>=', threshold: 1.5, value: 1.2, met: false, gap: 0.3, reason: null },
          { id: 'g3', label: 'Journal rate', dim: 'emotional', metric: 'journalRate',
            op: '>=', threshold: 0.7, value: null, met: null, gap: null, reason: 'METRIC_UNAVAILABLE' },
        ],
        gatesMet: 1,
        gatesTotal: 3,
        gatesRatio: 0.333,
        proposedTransition: { proposed: null, score: 0.4, reasons: [] },
        signalRegression: { detected: false, suggestedStage: null, reasons: [], severity: null },
        windowSize: 12,
        confidence: 'MED',
        sparseSample: false,
        engineVersion: 'v1',
        computedAt: { seconds: 1745000000, nanoseconds: 0 },
        asOf: { seconds: 1745000000, nanoseconds: 0 },
      };

      const snap = buildClientSnapshot({
        plan,
        trades: [mkTrade({ result: 100 })],
        maturity: maturityFromEngine,
      });

      // maturitySnapshot existe
      expect(snap.maturitySnapshot).not.toBeNull();
      const m = snap.maturitySnapshot;

      // Timestamps voláteis removidos, frozenAt adicionado
      expect(m.computedAt).toBeUndefined();
      expect(m.asOf).toBeUndefined();
      expect(typeof m.frozenAt).toBe('string');

      // Gates completos: array, cada item com schema completo
      expect(Array.isArray(m.gates)).toBe(true);
      expect(m.gates).toHaveLength(3);
      expect(m.gates[0]).toEqual({
        id: 'g1', label: 'Stop respect', dim: 'operational', metric: 'stopRate',
        op: '>=', threshold: 0.8, value: 0.85, met: true, gap: null, reason: null,
      });
      expect(m.gates[1].met).toBe(false);
      expect(m.gates[1].gap).toBe(0.3);
      expect(m.gates[2].reason).toBe('METRIC_UNAVAILABLE');
      expect(m.gates[2].met).toBeNull();

      // Totais preservados
      expect(m.gatesMet).toBe(1);
      expect(m.gatesTotal).toBe(3);
      expect(m.gatesRatio).toBeCloseTo(0.333, 3);

      // Transition/regression preservados
      expect(m.proposedTransition).toEqual(maturityFromEngine.proposedTransition);
      expect(m.signalRegression).toEqual(maturityFromEngine.signalRegression);
    });

    it('signalRegression.detected=true sobrevive no freeze (caso REGRESSION)', () => {
      const maturity = {
        currentStage: 3, baselineStage: 2,
        dimensionScores: { emotional: 40, financial: 50, operational: 55, maturity: 48 },
        gates: [{ id: 'g1', met: false, value: 0.5, threshold: 0.8, gap: 0.3, label: 'x', dim: 'o', metric: 'y', op: '>=', reason: null }],
        gatesMet: 0, gatesTotal: 1, gatesRatio: 0,
        proposedTransition: { proposed: null, score: 0.1, reasons: [] },
        signalRegression: { detected: true, suggestedStage: 2, reasons: ['dd-spike'], severity: 'HIGH' },
        windowSize: 8, confidence: 'HIGH', sparseSample: false, engineVersion: 'v1',
      };

      const snap = buildClientSnapshot({
        plan, trades: [mkTrade({ result: -30 })], maturity,
      });

      expect(snap.maturitySnapshot.signalRegression.detected).toBe(true);
      expect(snap.maturitySnapshot.signalRegression.suggestedStage).toBe(2);
      expect(snap.maturitySnapshot.signalRegression.severity).toBe('HIGH');
    });
  });
});
