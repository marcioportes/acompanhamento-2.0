import { describe, it, expect, vi, beforeEach } from 'vitest';

import cfModule from '../../../../functions/assessment/classifyMaturityProgression.js';

const runClassify = cfModule._runClassify;

function makeFakeAdmin({ setImpl } = {}) {
  const setSpy = vi.fn(setImpl ?? (async () => undefined));
  const firestore = () => ({
    collection: () => ({
      doc: () => ({
        collection: () => ({
          doc: () => ({ set: setSpy }),
        }),
      }),
    }),
  });
  firestore.FieldValue = { serverTimestamp: () => '__timestamp__' };
  return { admin: { firestore }, setSpy };
}

function makeFakeClient(createImpl) {
  const createSpy = vi.fn(createImpl);
  return { client: { messages: { create: createSpy } }, createSpy };
}

function claudeTextResponse(text) {
  return { content: [{ type: 'text', text }] };
}

function validClaudePayload(overrides = {}) {
  return JSON.stringify({
    narrative:
      'Evolução consistente em relação ao baseline de Chaos: o score emocional saltou de 30 para 60, o que traduz em menor frequência de entradas impulsivas. O sistema operacional mostra regras mais estáveis, com compliance rate em 85% e ausência de tilts e revenge trades no período. Ainda há gap em stop usage (85% contra target de 90%), ponto que limita o avanço para Methodical — é onde vale a concentração nas próximas semanas. Mantenha o journaling em 90% e a disciplina de sizing atual.',
    patternsDetected: [
      'Sem tilts ou revenge trades na janela — regulação emocional consolidada',
      'Stop usage abaixo do target (85% vs 90%) ainda bloqueia próximo stage',
    ],
    nextStageGuidance:
      'Foco em fechar o gap de stop usage: toda ordem entra com stop definido no ticket antes da execução. Reavalie setups em que o stop costuma ser pulado e documente no journal.',
    confidence: 'HIGH',
    ...overrides,
  });
}

function buildRequest(overrides = {}) {
  return {
    auth: { uid: 'student-1' },
    data: {
      studentId: 'student-1',
      currentStage: 2,
      baselineStage: 1,
      scores: {
        emotional: 60,
        financial: 55,
        operational: 50,
        maturity: 50,
        composite: 54,
      },
      baselineScores: {
        emotional: 30,
        financial: 25,
        operational: 20,
      },
      gates: [
        { id: 'wr-45', label: 'Win rate ≥ 45%', met: true, value: 48, threshold: 45 },
        { id: 'stop-90', label: 'Stop usage ≥ 90%', met: false, value: 85, threshold: 90 },
      ],
      tradesSummary: {
        windowSize: 50,
        winRate: 48,
        payoff: 1.2,
        expectancy: 0.05,
        maxDDPercent: 12,
        avgDuration: '25m',
        tiltCount: 0,
        revengeCount: 0,
        complianceRate: 85,
        journalRate: 0.9,
      },
      trigger: 'UP',
      ...overrides,
    },
  };
}

describe('classifyMaturityProgression', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('rejeita request sem auth com HttpsError unauthenticated', async () => {
    const { admin, setSpy } = makeFakeAdmin();
    const { client, createSpy } = makeFakeClient();

    await expect(
      runClassify({ auth: null, data: buildRequest().data }, { adminOverride: admin, clientOverride: client })
    ).rejects.toMatchObject({ code: 'unauthenticated' });

    expect(createSpy).not.toHaveBeenCalled();
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('rejeita input sem studentId com HttpsError invalid-argument', async () => {
    const { admin } = makeFakeAdmin();
    const { client, createSpy } = makeFakeClient();
    const req = buildRequest();
    delete req.data.studentId;

    await expect(runClassify(req, { adminOverride: admin, clientOverride: client })).rejects.toMatchObject({
      code: 'invalid-argument',
    });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('rejeita trigger fora do enum com HttpsError invalid-argument', async () => {
    const { admin } = makeFakeAdmin();
    const { client, createSpy } = makeFakeClient();

    await expect(
      runClassify(buildRequest({ trigger: 'DOWN' }), { adminOverride: admin, clientOverride: client })
    ).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('rejeita currentStage fora do range 1..5', async () => {
    const { admin } = makeFakeAdmin();
    const { client } = makeFakeClient();

    await expect(
      runClassify(buildRequest({ currentStage: 7 }), { adminOverride: admin, clientOverride: client })
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('happy path UP: parsea JSON, grava em maturity/current, retorna narrative', async () => {
    const { admin, setSpy } = makeFakeAdmin();
    const { client } = makeFakeClient(async () =>
      claudeTextResponse('```json\n' + validClaudePayload() + '\n```')
    );

    const result = await runClassify(buildRequest(), { adminOverride: admin, clientOverride: client });

    expect(result.narrative).toContain('Evolução');
    expect(result.patternsDetected.length).toBeGreaterThanOrEqual(1);
    expect(result.nextStageGuidance).toContain('stop');
    expect(result.confidence).toBe('HIGH');
    expect(result.error).toBeNull();
    expect(setSpy).toHaveBeenCalledTimes(1);

    const [doc, opts] = setSpy.mock.calls[0];
    expect(doc.aiNarrative).toBe(result.narrative);
    expect(doc.aiPatternsDetected).toEqual(result.patternsDetected);
    expect(doc.aiNextStageGuidance).toBe(result.nextStageGuidance);
    expect(doc.aiTrigger).toBe('UP');
    expect(doc.aiGeneratedAt).toBe('__timestamp__');
    expect(opts).toEqual({ merge: true });
  });

  it('happy path REGRESSION: retorno válido e aiTrigger=REGRESSION no doc', async () => {
    const { admin, setSpy } = makeFakeAdmin();
    const payload = validClaudePayload({
      narrative:
        'Sinal de regressão: o emocional recuou de 60 para 42 na janela atual, com dois tilts e um revenge trade — padrão observado no baseline Chaos começa a reaparecer. O operacional aguenta (compliance em 80%), mas a frequência de operações sem journal subiu para 30%. Tom de alerta, não de derrota: regredir é parte da jornada e você identificou cedo.',
      patternsDetected: [
        'Dois tilts e um revenge trade após 4 semanas sem incidentes',
        'Journal rate caiu de 90% para 70% — sinal precoce de fadiga',
      ],
      confidence: 'MED',
    });
    const { client } = makeFakeClient(async () => claudeTextResponse(payload));

    const result = await runClassify(buildRequest({ trigger: 'REGRESSION' }), {
      adminOverride: admin,
      clientOverride: client,
    });

    expect(result.error).toBeNull();
    expect(result.confidence).toBe('MED');
    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(setSpy.mock.calls[0][0].aiTrigger).toBe('REGRESSION');
  });

  it('API fail (timeout): retorna narrative=null + error e ainda grava metadata', async () => {
    const { admin, setSpy } = makeFakeAdmin();
    const { client } = makeFakeClient(async () => {
      throw new Error('network timeout');
    });

    const result = await runClassify(buildRequest(), { adminOverride: admin, clientOverride: client });

    expect(result.narrative).toBeNull();
    expect(result.patternsDetected).toEqual([]);
    expect(result.nextStageGuidance).toBeNull();
    expect(result.confidence).toBe('LOW');
    expect(result.error).toBe('network timeout');
    expect(setSpy).toHaveBeenCalledTimes(1);

    const doc = setSpy.mock.calls[0][0];
    expect(doc.aiNarrative).toBeNull();
    expect(doc.aiGeneratedAt).toBe('__timestamp__');
    expect(doc.aiTrigger).toBe('UP');
  });

  it('output sem bloco JSON: fallback silencioso', async () => {
    const { admin, setSpy } = makeFakeAdmin();
    const { client } = makeFakeClient(async () =>
      claudeTextResponse('Não consegui gerar análise agora.')
    );

    const result = await runClassify(buildRequest(), { adminOverride: admin, clientOverride: client });

    expect(result.narrative).toBeNull();
    expect(result.confidence).toBe('LOW');
    expect(result.error).toMatch(/JSON/i);
    expect(setSpy).toHaveBeenCalledTimes(1);
  });

  it('narrative < 50 chars: validação falha e cai em fallback', async () => {
    const { admin, setSpy } = makeFakeAdmin();
    const payload = JSON.stringify({
      narrative: 'curto',
      patternsDetected: ['x'],
      nextStageGuidance: 'guidance lorem ipsum padrão mínimo aceitável',
      confidence: 'MED',
    });
    const { client } = makeFakeClient(async () => claudeTextResponse(payload));

    const result = await runClassify(buildRequest(), { adminOverride: admin, clientOverride: client });

    expect(result.narrative).toBeNull();
    expect(result.error).toMatch(/narrative/i);
    expect(setSpy).toHaveBeenCalledTimes(1);
  });

  it('confidence desconhecido é normalizado para MED', async () => {
    const { admin } = makeFakeAdmin();
    const payload = validClaudePayload({ confidence: 'VERY_HIGH_LOL' });
    const { client } = makeFakeClient(async () => claudeTextResponse(payload));

    const result = await runClassify(buildRequest(), { adminOverride: admin, clientOverride: client });

    expect(result.confidence).toBe('MED');
    expect(result.error).toBeNull();
  });

  it('firestore write fail: handler não propaga e retorna resultado ao caller', async () => {
    const { admin, setSpy } = makeFakeAdmin({
      setImpl: async () => {
        throw new Error('firestore offline');
      },
    });
    const { client } = makeFakeClient(async () =>
      claudeTextResponse('```json\n' + validClaudePayload() + '\n```')
    );

    const result = await runClassify(buildRequest(), { adminOverride: admin, clientOverride: client });

    expect(result.narrative).toContain('Evolução');
    expect(result.error).toBeNull();
    expect(setSpy).toHaveBeenCalledTimes(1);
  });
});
