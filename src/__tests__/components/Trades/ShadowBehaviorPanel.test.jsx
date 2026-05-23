/**
 * Issue #278 — testes da renderização especializada de UNDERSIZED_TRADE
 * em ShadowBehaviorPanel (sentença-chave por scenario + bloco educacional
 * + accordion técnico). Cobre fallback amounts=null e regressão de outros patterns.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import ShadowBehaviorPanel from '../../../components/Trades/ShadowBehaviorPanel';

const baseTrade = {
  id: 'T1',
  ticker: 'WINM26',
  currency: 'USD',
  shadowBehavior: {
    version: '0.1',
    resolution: 'LOW',
    patterns: [],
    orderCount: 0
  }
};

const undersizedPattern = (scenario, extra = {}) => ({
  code: 'UNDERSIZED_TRADE',
  severity: 'HIGH',
  confidence: 0.9,
  emotionMapping: 'FEAR',
  layer: 1,
  evidence: {
    actualRiskPct: 0.16,
    planRoPct: 0.25,
    ratio: 0.64,
    utilizationPct: 64,
    planRoAmount: 195.31,
    actualRiskAmount: 125,
    expectedGainAtPlanRR: 390.62,
    actualGain: 60,
    planRsDelivered: 0.31,
    rGapVsPlan: 330.62,
    hiddenRrInflation: 1.56,
    rrLocalAchieved: 0.48,
    planRrTarget: 2,
    scenario,
    ...extra
  }
});

describe('ShadowBehaviorPanel — UNDERSIZED_TRADE', () => {
  it('não renderiza quando isMentor=false', () => {
    const trade = {
      ...baseTrade,
      shadowBehavior: { ...baseTrade.shadowBehavior, patterns: [undersizedPattern('WIN_RR_HIT')] }
    };
    const { container } = render(<ShadowBehaviorPanel trade={trade} isMentor={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('WIN_RR_HIT: sentença-chave com RR do plano cumprido', () => {
    const pattern = undersizedPattern('WIN_RR_HIT', {
      rrLocalAchieved: 2.4,
      planRsDelivered: 0.31,
      actualGain: 60,
      actualRiskAmount: 25,
      planRoAmount: 39.06,
      expectedGainAtPlanRR: 78.12
    });
    const trade = { ...baseTrade, shadowBehavior: { ...baseTrade.shadowBehavior, patterns: [pattern] } };
    render(<ShadowBehaviorPanel trade={trade} isMentor={true} />);
    expect(screen.getByText(/RR de 2:1 cumprido\. Alvo do plano não atingido\./)).toBeInTheDocument();
    expect(screen.getByText(/Sua estatística \(Payoff\/PF\/EV\) lê este trade como \+2\.4R/)).toBeInTheDocument();
    expect(screen.getByText(/Em Rs do plano são \+0\.31R/)).toBeInTheDocument();
  });

  it('WIN_RR_MISS: sentença-chave subdimensionado + abaixo do alvo do trade', () => {
    const pattern = undersizedPattern('WIN_RR_MISS', {
      rrLocalAchieved: 1.2,
      planRsDelivered: 0.4,
      actualGain: 50,
      actualRiskAmount: 40,
      planRoAmount: 80,
      expectedGainAtPlanRR: 160,
      planRrTarget: 2
    });
    const trade = { ...baseTrade, shadowBehavior: { ...baseTrade.shadowBehavior, patterns: [pattern] } };
    render(<ShadowBehaviorPanel trade={trade} isMentor={true} />);
    expect(screen.getByText(/Operação subdimensionada e abaixo do alvo do trade\./)).toBeInTheDocument();
    expect(screen.getByText(/Duplo problema: subdimensionado \+ saída antes do RR\./)).toBeInTheDocument();
  });

  it('LOSS_BE: sentença-chave loss + paragrafos sem ganho', () => {
    const pattern = undersizedPattern('LOSS_BE', {
      actualGain: -30,
      rrLocalAchieved: null,
      planRsDelivered: null,
      rGapVsPlan: null
    });
    const trade = { ...baseTrade, shadowBehavior: { ...baseTrade.shadowBehavior, patterns: [pattern] } };
    render(<ShadowBehaviorPanel trade={trade} isMentor={true} />);
    expect(screen.getByText(/Operação subdimensionada e tomada em loss\./)).toBeInTheDocument();
    expect(screen.getByText(/Operar subdimensionado pode parecer prudente/)).toBeInTheDocument();
  });

  it('LOSS_BE: expandir mostra accordion "Evidência técnica" com null como — (sem literal "null")', async () => {
    const pattern = undersizedPattern('LOSS_BE', {
      actualGain: -30,
      rrLocalAchieved: null,
      planRsDelivered: null,
      rGapVsPlan: null
    });
    const trade = { ...baseTrade, shadowBehavior: { ...baseTrade.shadowBehavior, patterns: [pattern] } };
    render(<ShadowBehaviorPanel trade={trade} isMentor={true} />);
    const card = screen.getByText(/Operação subdimensionada e tomada em loss/).closest('.cursor-pointer');
    fireEvent.click(card);
    expect(await screen.findByText(/Evidência técnica/i)).toBeInTheDocument();
    expect(screen.queryByText('null')).not.toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('Fallback amounts=null: sentença reduzida com utilizationPct + sem parágrafo educacional', () => {
    const pattern = undersizedPattern('WIN_RR_HIT', {
      planRoAmount: null,
      actualRiskAmount: null,
      expectedGainAtPlanRR: null,
      planRsDelivered: null
    });
    const trade = { ...baseTrade, shadowBehavior: { ...baseTrade.shadowBehavior, patterns: [pattern] } };
    render(<ShadowBehaviorPanel trade={trade} isMentor={true} />);
    expect(screen.getByText(/Você utilizou 64% do RO contratado\./)).toBeInTheDocument();
    expect(screen.queryByText(/Sua estatística \(Payoff\/PF\/EV\)/)).not.toBeInTheDocument();
  });

  it('Currency BRL renderiza valores em R$', () => {
    const pattern = undersizedPattern('WIN_RR_HIT', {
      actualRiskAmount: 100,
      planRoAmount: 156,
      actualGain: 240,
      expectedGainAtPlanRR: 312
    });
    const trade = { ...baseTrade, currency: 'BRL', shadowBehavior: { ...baseTrade.shadowBehavior, patterns: [pattern] } };
    render(<ShadowBehaviorPanel trade={trade} isMentor={true} />);
    const para = screen.getByText(/Você arriscou/);
    expect(para.textContent).toMatch(/R\$/);
  });

  it('Regressão: outros patterns continuam usando render genérico (descrição literal)', () => {
    const pattern = {
      code: 'HOLD_ASYMMETRY',
      severity: 'MEDIUM',
      confidence: 0.8,
      emotionMapping: 'HOPE',
      layer: 1,
      evidence: { loserHoldMinutes: 120, avgWinnerHoldMinutes: 30 }
    };
    const trade = { ...baseTrade, shadowBehavior: { ...baseTrade.shadowBehavior, patterns: [pattern] } };
    render(<ShadowBehaviorPanel trade={trade} isMentor={true} />);
    expect(screen.getByText(/Trade perdedor mantido muito mais tempo/)).toBeInTheDocument();
    expect(screen.queryByText(/Operação subdimensionada/)).not.toBeInTheDocument();
  });
});
