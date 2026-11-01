/**
 * #495 — trade que entregou o alvo do plano não é subdimensionado.
 * Caso real: MNQ 01/11/2026, RO US$ 200, RR 2:1 (alvo US$ 400), risco US$ 112, +US$ 402,50.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { render, screen } from '@testing-library/react';
import BehaviorPanel from '../../../components/Trades/BehaviorPanel';
import { confrontVigente } from '../../../components/Trades/behaviorDisplay';
import { detectUndersizedTrade } from '../../../utils/shadowBehaviorAnalysis';
import { familiaVigente } from '../../../constants/behavioralTaxonomy';
import { aggregateBehaviorWeights } from '../../../utils/maturityEngine/behaviorWeights';
import { familiasDeRisco } from '../../../utils/mentorRiskRadar';
import { dominantNegativeSeverity } from '../../../utils/tradeReviewConfront';

const require = createRequire(import.meta.url);
const taxonomiaCf = require('../../../../functions/maturity/behavioralTaxonomyMirror.js');
const pesosCf = require('../../../../functions/maturity/behaviorWeights.js');
const { analyzeShadowForTradeCF } = require('../../../../functions/shadow/shadowDetectors.js');

// PL 25.000: RO 0,8% = US$ 200; risco usado 0,448% = US$ 112.
const operacao = (result, extra = {}) => ({
  id: 'T1', studentId: 'S1', date: '2026-11-01', ticker: 'MNQ', side: 'SHORT',
  riskPercent: 0.448, planRoPct: 0.8, planPl: 25000, planRrTarget: 2, result, ...extra,
});

const familiaGravada = (actualGain, evidence = {}, extra = {}) => ({
  family: 'SUB_SIZING', canonicalCode: 'SUB_SIZING', severity: 'LOW', source: 'shadow',
  resolutionLayer: 'LOW', emotionMapping: 'AVOIDANCE', valence: 'negative', isGate: true, confidence: 0.9,
  evidence: {
    scenario: 'WIN_RR_HIT', planRrTarget: 2, utilizationPct: 56, planRoAmount: 200, actualRiskAmount: 112,
    expectedGainAtPlanRR: 400, actualGain, planRsDelivered: Math.round((actualGain / 200) * 100) / 100,
    rrLocalAchieved: Math.round((actualGain / 112) * 100) / 100, ...evidence,
  },
  ...extra,
});

const tradeGravado = (actualGain) => ({
  id: 'T1', currency: 'USD',
  behaviorProfile: {
    version: '1.0.0', families: [familiaGravada(actualGain)], gateInputs: ['SUB_SIZING'],
    scoreContribution: { tilt: false, revenge: false },
  },
});

const subsizingCf = (trade) => (analyzeShadowForTradeCF(trade, [], null)?.patterns || [])
  .find((p) => p.code === 'UNDERSIZED_TRADE') ?? null;

describe('detector — o alvo do plano decide', () => {
  it.each([
    ['cliente', (t) => detectUndersizedTrade(t, [])],
    ['Cloud Function', subsizingCf],
  ])('%s: US$ 402,50 e exatamente US$ 400 não disparam; US$ 399 dispara', (_n, detecta) => {
    expect(detecta(operacao(402.5))).toBeNull();
    expect(detecta(operacao(400))).toBeNull();
    expect(detecta(operacao(399))).not.toBeNull();
  });

  it('ganho entre 1 stop e o alvo continua, com o dado que permite dizer a verdade', () => {
    const r = detectUndersizedTrade(operacao(224), []);
    expect(r.evidence.scenario).toBe('WIN_RR_HIT');
    expect(r.evidence.planRsDelivered).toBe(1.12);
    expect(r.evidence.rGapVsPlan).toBe(176);
  });

  it('sem PL não há alvo em dinheiro: a flag continua', () => {
    expect(detectUndersizedTrade(operacao(402.5, { planPl: null }), [])).not.toBeNull();
  });

  it('loss subdimensionado continua', () => {
    expect(detectUndersizedTrade(operacao(-50), []).evidence.scenario).toBe('LOSS_BE');
  });
});

describe('leitura de perfil já gravado', () => {
  it('familiaVigente: alvo entregue sai; abaixo do alvo, sem evidência e outros padrões ficam', () => {
    for (const fn of [familiaVigente, taxonomiaCf.familiaVigente]) {
      expect(fn(familiaGravada(402.5))).toBe(false);
      expect(fn(familiaGravada(400))).toBe(false);
      expect(fn(familiaGravada(224))).toBe(true);
      expect(fn({ canonicalCode: 'SUB_SIZING', evidence: { utilizationPct: 40 } })).toBe(true);
      expect(fn({ canonicalCode: 'SUB_SIZING', evidence: null })).toBe(true);
      expect(fn({ canonicalCode: 'LOSS_CHASING', evidence: { actualGain: 9, expectedGainAtPlanRR: 1 } })).toBe(true);
    }
  });

  it.each([
    ['cliente', aggregateBehaviorWeights],
    ['Cloud Function', pesosCf.aggregateBehaviorWeights],
  ])('%s: não trava, não penaliza, mas o trade segue na janela', (_n, agrega) => {
    const r = agrega([tradeGravado(402.5)]);
    expect(r.gateCounts.sizing).toBe(0);
    expect(r.violationTrades).toBe(0);
    expect(r.byDimension).toEqual({ E: 0, F: 0, O: 0 });
    expect(r.withProfile).toBe(1);
    expect(agrega([tradeGravado(224)]).gateCounts.sizing).toBe(1);
  });

  it('radar do mentor e veredicto da revisão não veem o padrão', () => {
    expect(familiasDeRisco(tradeGravado(402.5))).toEqual([]);
    expect(familiasDeRisco(tradeGravado(224))).toHaveLength(1);
    expect(dominantNegativeSeverity([familiaGravada(402.5)])).toBe('CLEAN');
    expect(dominantNegativeSeverity([familiaGravada(224)])).toBe('LOW');
  });

  it('confronto emocional gravado não sustenta sugestão vinda do padrão que saiu', () => {
    const confront = {
      declared: { name: 'Confiante', category: 'POSITIVE' },
      suggested: { emotion: 'AVOIDANCE', code: 'SUB_SIZING', severity: 'MEDIUM' },
      verdict: 'ATTENTION',
    };
    const fora = confrontVigente(confront, [familiaGravada(402.5, {}, { severity: 'MEDIUM' })]);
    expect(fora.suggested).toBeNull();
    const fica = confrontVigente(confront, [familiaGravada(224, {}, { severity: 'MEDIUM' })]);
    expect(fica.suggested?.code).toBe('SUB_SIZING');
  });
});

describe('painel', () => {
  it('US$ 402,50: sem card e sem trava de estágio', () => {
    render(<BehaviorPanel trade={tradeGravado(402.5)} embedded />);
    expect(screen.queryByText('⚠ Operação subdimensionada')).not.toBeInTheDocument();
    expect(screen.queryByText('Trava progressão de estágio')).not.toBeInTheDocument();
    expect(screen.queryByText(/Alvo do plano não atingido/)).not.toBeInTheDocument();
  });

  it('US$ 224 (1,12R): não diz "menos de um stop cheio"', () => {
    render(<BehaviorPanel trade={tradeGravado(224)} embedded />);
    expect(screen.getByText('RR de 2:1 cumprido. Stop do plano coberto, alvo não atingido.')).toBeInTheDocument();
    expect(screen.getByText(/cobre um stop cheio do plano, mas fica abaixo do alvo planejado/)).toBeInTheDocument();
    expect(screen.queryByText(/menos de um stop cheio/)).not.toBeInTheDocument();
    expect(screen.queryByText(/não cobrem o stop/)).not.toBeInTheDocument();
    expect(screen.getByText('Trava progressão de estágio')).toBeInTheDocument();
  });

  it('caso que originou o #278 (0,96R): a denúncia continua', () => {
    const t = tradeGravado(120);
    t.behaviorProfile.families[0] = familiaGravada(120, {
      planRoAmount: 125, actualRiskAmount: 60, expectedGainAtPlanRR: 250, planRsDelivered: 0.96, rrLocalAchieved: 2, utilizationPct: 48,
    });
    render(<BehaviorPanel trade={t} embedded />);
    expect(screen.getByText('RR de 2:1 cumprido. Alvo do plano não atingido.')).toBeInTheDocument();
    expect(screen.getByText(/menos de um stop cheio do plano e abaixo do alvo planejado/)).toBeInTheDocument();
    expect(screen.getByText(/trades assim não cobrem o stop/)).toBeInTheDocument();
  });
});
