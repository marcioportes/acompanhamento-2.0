/**
 * onboardingMaturityPipeline.test.js — issue #119 task 22 (H3).
 *
 * Cobre:
 *  - recompute happy path → doc lido e retornado
 *  - recompute throttled → continua e lê doc
 *  - recompute exception → continua silencioso (log)
 *  - IA fire-and-forget com trigger ONBOARDING_INITIAL
 *  - IA tolera falha de callable (não relança)
 *  - buildOnboardingClassifyInput com maturity válido → tradesSummary zerado
 *  - runOnboardingMaturityPipeline orquestra recompute + IA
 *  - pipeline tolerante: recompute falha (throttled/exception) → IA ainda é chamada
 *  - pipeline tolerante: IA falha → maturity ainda foi gravado pelo recompute
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
  ONBOARDING_INITIAL_TRIGGER,
  buildOnboardingClassifyInput,
  recomputeAndReadMaturityForOnboarding,
  dispatchOnboardingMaturityAI,
  runOnboardingMaturityPipeline,
} from '../../utils/onboardingMaturityPipeline';

describe('onboardingMaturityPipeline', () => {
  beforeEach(() => {
    mockRecompute.mockReset();
    mockClassify.mockReset();
    mockGetDoc.mockReset();
  });

  const mockMaturity = {
    currentStage: 2,
    baselineStage: 2,
    dimensionScores: { emotional: 45, financial: 40, operational: 50, maturity: 45 },
    gates: [
      { id: 'g1', label: 'Win rate ≥ 45%', dim: 'financial', metric: 'wr',
        op: '>=', threshold: 45, value: null, met: null, gap: null, reason: 'SPARSE_SAMPLE' },
    ],
    gatesMet: 0,
    gatesTotal: 1,
    gatesRatio: 0,
    proposedTransition: { proposed: null, score: 0, reasons: [] },
    signalRegression: { detected: false, suggestedStage: null, reasons: [], severity: null },
  };

  // ===========================================================================
  // recomputeAndReadMaturityForOnboarding
  // ===========================================================================

  describe('recomputeAndReadMaturityForOnboarding', () => {
    it('happy path: callable OK + doc existe → retorna maturity', async () => {
      mockRecompute.mockResolvedValueOnce({ data: { success: true } });
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: 'current',
        data: () => mockMaturity,
      });

      const res = await recomputeAndReadMaturityForOnboarding({ studentId: 'stu-1' });

      expect(mockRecompute).toHaveBeenCalledWith({ studentId: 'stu-1' });
      expect(res.throttled).toBe(false);
      expect(res.maturity.currentStage).toBe(2);
      expect(res.maturity.baselineStage).toBe(2);
    });

    it('throttled: throttled=true, ainda lê doc', async () => {
      mockRecompute.mockResolvedValueOnce({ data: { throttled: true, nextAllowedAt: null } });
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: 'current',
        data: () => mockMaturity,
      });

      const res = await recomputeAndReadMaturityForOnboarding({ studentId: 'stu-1' });

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

      const res = await recomputeAndReadMaturityForOnboarding({ studentId: 'stu-1' });

      expect(res.maturity).not.toBeNull();
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('doc não existe (motor ainda não rodou) → maturity=null', async () => {
      mockRecompute.mockResolvedValueOnce({ data: { success: true } });
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });

      const res = await recomputeAndReadMaturityForOnboarding({ studentId: 'stu-1' });

      expect(res.maturity).toBeNull();
    });

    it('studentId ausente → no-op, retorna null', async () => {
      const res = await recomputeAndReadMaturityForOnboarding({ studentId: null });
      expect(res.maturity).toBeNull();
      expect(mockRecompute).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // buildOnboardingClassifyInput
  // ===========================================================================

  describe('buildOnboardingClassifyInput', () => {
    it('maturity válido → tradesSummary zerado + trigger ONBOARDING_INITIAL', () => {
      const input = buildOnboardingClassifyInput(mockMaturity, 'stu-1');
      expect(input.studentId).toBe('stu-1');
      expect(input.currentStage).toBe(2);
      expect(input.baselineStage).toBe(2);
      expect(input.trigger).toBe('ONBOARDING_INITIAL');
      expect(input.trigger).toBe(ONBOARDING_INITIAL_TRIGGER);
      expect(input.tradesSummary.windowSize).toBe(0);
      expect(input.tradesSummary.winRate).toBeNull();
      expect(input.tradesSummary.payoff).toBeNull();
      expect(input.tradesSummary.tiltCount).toBe(0);
      expect(input.tradesSummary.revengeCount).toBe(0);
      expect(input.gates).toBe(mockMaturity.gates);
    });

    it('baselineStage ausente → fallback para currentStage', () => {
      const maturity = { ...mockMaturity, baselineStage: undefined };
      const input = buildOnboardingClassifyInput(maturity, 'stu-1');
      expect(input.baselineStage).toBe(2);
    });

    it('scores iguais em current e baseline (marco zero — ainda sem trades)', () => {
      const input = buildOnboardingClassifyInput(mockMaturity, 'stu-1');
      expect(input.scores).toEqual(input.baselineScores);
    });

    it('maturity ou studentId ausente → null', () => {
      expect(buildOnboardingClassifyInput(null, 'stu-1')).toBeNull();
      expect(buildOnboardingClassifyInput(mockMaturity, null)).toBeNull();
      expect(buildOnboardingClassifyInput(mockMaturity, '')).toBeNull();
    });

    it('gates ausente → default array vazio', () => {
      const maturity = { ...mockMaturity, gates: undefined };
      const input = buildOnboardingClassifyInput(maturity, 'stu-1');
      expect(input.gates).toEqual([]);
    });
  });

  // ===========================================================================
  // dispatchOnboardingMaturityAI
  // ===========================================================================

  describe('dispatchOnboardingMaturityAI', () => {
    it('maturity válido → dispara IA com trigger ONBOARDING_INITIAL', async () => {
      mockClassify.mockResolvedValueOnce({ data: { narrative: 'welcome' } });

      const dispatched = dispatchOnboardingMaturityAI({
        studentId: 'stu-1',
        maturity: mockMaturity,
      });

      expect(dispatched).toBe(true);
      // espera o microtask para que o .then() execute
      await new Promise((r) => setTimeout(r, 0));
      expect(mockClassify).toHaveBeenCalledTimes(1);
      const arg = mockClassify.mock.calls[0][0];
      expect(arg.trigger).toBe('ONBOARDING_INITIAL');
      expect(arg.studentId).toBe('stu-1');
      expect(arg.currentStage).toBe(2);
    });

    it('dispara independentemente de shouldGenerateAI (bypassa cache policy)', async () => {
      // Mesmo com aiTrigger já cacheado, o onboarding force-dispatcha.
      // Este é o comportamento by-design — welcome narrative é marco zero.
      const maturityComCache = {
        ...mockMaturity,
        aiTrigger: 'UP',
        aiNarrative: { headline: 'antigo' },
      };
      mockClassify.mockResolvedValueOnce({ data: { narrative: 'welcome' } });

      const dispatched = dispatchOnboardingMaturityAI({
        studentId: 'stu-1',
        maturity: maturityComCache,
      });

      expect(dispatched).toBe(true);
      await new Promise((r) => setTimeout(r, 0));
      expect(mockClassify).toHaveBeenCalledTimes(1);
      expect(mockClassify.mock.calls[0][0].trigger).toBe('ONBOARDING_INITIAL');
    });

    it('maturity null → NÃO dispara', () => {
      const dispatched = dispatchOnboardingMaturityAI({
        studentId: 'stu-1',
        maturity: null,
      });
      expect(dispatched).toBe(false);
      expect(mockClassify).not.toHaveBeenCalled();
    });

    it('studentId ausente → NÃO dispara', () => {
      const dispatched = dispatchOnboardingMaturityAI({
        studentId: null,
        maturity: mockMaturity,
      });
      expect(dispatched).toBe(false);
    });

    it('falha no callable é silenciosa (não re-throw)', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockClassify.mockRejectedValueOnce(new Error('api-down'));

      const dispatched = dispatchOnboardingMaturityAI({
        studentId: 'stu-1',
        maturity: mockMaturity,
      });

      expect(dispatched).toBe(true);
      await new Promise((r) => setTimeout(r, 0));
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  // ===========================================================================
  // runOnboardingMaturityPipeline (orquestrador)
  // ===========================================================================

  describe('runOnboardingMaturityPipeline', () => {
    it('happy path: recompute OK + doc existe → IA dispatched', async () => {
      mockRecompute.mockResolvedValueOnce({ data: { success: true } });
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: 'current',
        data: () => mockMaturity,
      });
      mockClassify.mockResolvedValueOnce({ data: { narrative: 'welcome' } });

      const res = await runOnboardingMaturityPipeline({ studentId: 'stu-1' });

      expect(res.throttled).toBe(false);
      expect(res.maturity).not.toBeNull();
      expect(res.aiDispatched).toBe(true);
      expect(mockRecompute).toHaveBeenCalledTimes(1);
      await new Promise((r) => setTimeout(r, 0));
      expect(mockClassify).toHaveBeenCalledTimes(1);
      expect(mockClassify.mock.calls[0][0].trigger).toBe('ONBOARDING_INITIAL');
    });

    it('recompute throttled → pipeline tolera, IA ainda dispara', async () => {
      mockRecompute.mockResolvedValueOnce({ data: { throttled: true } });
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: 'current',
        data: () => mockMaturity,
      });
      mockClassify.mockResolvedValueOnce({ data: { narrative: 'welcome' } });

      const res = await runOnboardingMaturityPipeline({ studentId: 'stu-1' });

      expect(res.throttled).toBe(true);
      expect(res.maturity).not.toBeNull();
      expect(res.aiDispatched).toBe(true);
    });

    it('recompute exception → pipeline tolera, onboarding completa mesmo assim', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockRecompute.mockRejectedValueOnce(new Error('network'));
      // doc ainda existe (de recompute anterior)
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: 'current',
        data: () => mockMaturity,
      });
      mockClassify.mockResolvedValueOnce({ data: { narrative: 'welcome' } });

      const res = await runOnboardingMaturityPipeline({ studentId: 'stu-1' });

      expect(res.maturity).not.toBeNull();
      expect(res.aiDispatched).toBe(true);
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('recompute falha + doc inexistente → maturity=null, IA NÃO dispara', async () => {
      mockRecompute.mockResolvedValueOnce({ data: { success: true } });
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });

      const res = await runOnboardingMaturityPipeline({ studentId: 'stu-1' });

      expect(res.maturity).toBeNull();
      expect(res.aiDispatched).toBe(false);
      expect(mockClassify).not.toHaveBeenCalled();
    });

    it('IA falha → snapshot ainda foi gravado pelo recompute', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockRecompute.mockResolvedValueOnce({ data: { success: true } });
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: 'current',
        data: () => mockMaturity,
      });
      mockClassify.mockRejectedValueOnce(new Error('api-down'));

      const res = await runOnboardingMaturityPipeline({ studentId: 'stu-1' });

      // Pipeline retornou OK; o recompute rodou, o doc está lá.
      expect(res.maturity).not.toBeNull();
      expect(res.aiDispatched).toBe(true); // dispatch foi iniciado (promise criada)
      await new Promise((r) => setTimeout(r, 0));
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('studentId ausente → pipeline é no-op', async () => {
      const res = await runOnboardingMaturityPipeline({ studentId: null });
      expect(res.maturity).toBeNull();
      expect(res.aiDispatched).toBe(false);
      expect(mockRecompute).not.toHaveBeenCalled();
      expect(mockClassify).not.toHaveBeenCalled();
    });
  });
});
