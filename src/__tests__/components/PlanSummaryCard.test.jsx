/**
 * PlanSummaryCard.test.jsx — F3 issue #188.
 * Cobre fallback (plan null), render colapsado/expandido, plano inativo,
 * blockedEmotions vazio, currency via getPlanCurrency.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PlanSummaryCard from '../../components/PlanSummaryCard';

const basePlan = {
  id: 'plan-abc',
  name: 'MNQ Conservador',
  pl: 10000,
  // currentPl removido — campo legado pós-C2 #259 (saldo derivado via trades)
  riskPerOperation: 0.5,
  rrTarget: 1.5,
  blockedEmotions: ['FOMO', 'REVENGE'],
  adjustmentCycle: 'Mensal',
  operationPeriod: 'Diário',
  periodGoal: 0.5,
  periodStop: 1.5,
  cycleGoal: 5,
  cycleStop: 10,
  status: 'IN_PROGRESS',
  accountId: 'acc-usd',
  active: true,
};

// Trades simulando saldo +350 sobre o pl base (preserva os asserts de 3.5%
// que antes vinham do campo persistido currentPl: 10350).
const baseTrades = [
  { id: 't1', planId: 'plan-abc', date: '2026-05-15', result: 350 },
];

const usdAccount = { id: 'acc-usd', currency: 'USD' };

describe('PlanSummaryCard', () => {
  it('renderiza fallback quando plan é null', () => {
    render(<PlanSummaryCard plan={null} accounts={[]} />);
    expect(screen.getByText(/plano deletado|não encontrado/i)).toBeTruthy();
  });

  it('renderiza seção colapsada com nome, moeda, RO/RR/Cap, bloqueadas e ciclo', () => {
    render(<PlanSummaryCard plan={basePlan} accounts={[usdAccount]} />);
    expect(screen.getByText('MNQ Conservador')).toBeTruthy();
    expect(screen.getByText('USD')).toBeTruthy();
    expect(screen.getByText(/RO 0\.5%/)).toBeTruthy();
    expect(screen.getByText(/RR 1\.5/)).toBeTruthy();
    expect(screen.getByText(/Bloqueadas:/)).toBeTruthy();
    expect(screen.getByText(/FOMO, REVENGE/)).toBeTruthy();
    expect(screen.getByText(/Ciclo mensal/)).toBeTruthy();
  });

  it('omite linha Bloqueadas quando blockedEmotions vazio', () => {
    render(<PlanSummaryCard plan={{ ...basePlan, blockedEmotions: [] }} accounts={[usdAccount]} />);
    expect(screen.queryByText(/Bloqueadas:/)).toBeNull();
  });

  it('omite linha Bloqueadas quando blockedEmotions ausente', () => {
    const { blockedEmotions, ...planSemBloqueadas } = basePlan;
    render(<PlanSummaryCard plan={planSemBloqueadas} accounts={[usdAccount]} />);
    expect(screen.queryByText(/Bloqueadas:/)).toBeNull();
  });

  it('renderiza badge "arquivado" quando plan.active === false', () => {
    render(<PlanSummaryCard plan={{ ...basePlan, active: false }} accounts={[usdAccount]} />);
    expect(screen.getByText(/arquivado/i)).toBeTruthy();
  });

  it('expande e colapsa ao clicar no header', () => {
    render(<PlanSummaryCard plan={basePlan} accounts={[usdAccount]} trades={baseTrades} />);
    // Colapsado por default — PL atual só aparece na seção expandida
    expect(screen.queryByText(/PL atual/)).toBeNull();
    fireEvent.click(screen.getByText('MNQ Conservador').closest('button'));
    expect(screen.getByText(/PL atual/)).toBeTruthy();
    expect(screen.getByText(/3\.5%/)).toBeTruthy();
  });

  it('suporta defaultExpanded', () => {
    render(<PlanSummaryCard plan={basePlan} accounts={[usdAccount]} trades={baseTrades} defaultExpanded />);
    expect(screen.getByText(/PL atual/)).toBeTruthy();
    expect(screen.getByText(/Período \(Diário\)/)).toBeTruthy();
    expect(screen.getByText(/Ciclo \(mensal\)/)).toBeTruthy();
  });

  it('cai para BRL quando accounts não resolve a conta', () => {
    render(<PlanSummaryCard plan={basePlan} accounts={[]} />);
    expect(screen.getByText('BRL')).toBeTruthy();
  });

  it('omite seção de período quando periodGoal e periodStop ausentes', () => {
    const { periodGoal, periodStop, ...plan } = basePlan;
    render(<PlanSummaryCard plan={plan} accounts={[usdAccount]} defaultExpanded />);
    expect(screen.queryByText(/Período \(/)).toBeNull();
  });

  it('omite seção de ciclo quando cycleGoal e cycleStop ausentes', () => {
    const { cycleGoal, cycleStop, ...plan } = basePlan;
    render(<PlanSummaryCard plan={plan} accounts={[usdAccount]} defaultExpanded />);
    expect(screen.queryByText(/Ciclo \(mensal\)$/)).toBeNull();
  });

  it('omite "PL atual" quando plan.pl ausente', () => {
    // Contrato C2 #259: saldo é derivado on-the-fly (pl + Σ trades). "PL atual"
    // só some quando o lastro (plan.pl) some — o campo legado plan.currentPl
    // não é mais determinante.
    // eslint-disable-next-line no-unused-vars
    const { pl, ...plan } = basePlan;
    render(<PlanSummaryCard plan={plan} accounts={[usdAccount]} trades={[]} defaultExpanded />);
    expect(screen.queryByText(/PL atual/)).toBeNull();
  });
});
