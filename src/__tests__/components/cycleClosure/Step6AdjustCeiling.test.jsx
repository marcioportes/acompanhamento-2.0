/**
 * Step6AdjustCeiling.test.jsx — issue #480
 *
 * O gate de capital do Passo 6. Caso real: plano de 25.645,60 fecha setembro em
 * −287,80 (equity 25.357,80). Antes, o aviso de "capital maior que o equity" aparecia
 * sozinho em todo ciclo negativo e não havia como aportar no plano.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const PLAN = {
  id: 'p1', accountId: 'a1', active: true,
  pl: 25645.6, riskPerOperation: 0.5, rrTarget: 2, cycleGoal: 10, cycleStop: 10,
};
const SNAPSHOT = { plEnd: 25357.8, resultPercent: -1.1, stopBreach: null };

const tradesMock = { trades: [] };
vi.mock('../../../hooks/useTrades', () => ({ useTrades: () => ({ trades: tradesMock.trades, loading: false }) }));
const accountsMock = { accounts: [] };
vi.mock('../../../hooks/useAccounts', () => ({ useAccounts: () => ({ accounts: accountsMock.accounts, loading: false }) }));
const plansMock = { plans: [PLAN] };
vi.mock('../../../hooks/usePlans', () => ({ usePlans: () => ({ plans: plansMock.plans, loading: false }) }));

import Step6Adjust from '../../../components/cycleClosure/steps/Step6Adjust';

const AVISO = 'Capital alocado maior que o máximo alocável';

const renderStep = (forward = {}) => {
  const onBlockSeal = vi.fn();
  const utils = render(
    <Step6Adjust
      studentId="s1" planId="p1"
      cycleStart="2026-09-01" cycleEnd="2026-09-30"
      metrics={{ maxDrawdown: { percent: 0.02 }, ruleAdherenceRate: 0.9 }}
      snapshot={SNAPSHOT}
      patterns={{ eventCounts: {} }}
      forward={forward}
      maturityRegression={[]}
      onChange={vi.fn()}
      onBlockSeal={onBlockSeal}
    />,
  );
  return { ...utils, onBlockSeal };
};
const ajuste = (newPl) => ({ planAdjustment: { changed: true, newPl, decisionSource: 'manual_edit' } });

describe('#480 · Step6Adjust — teto do capital', () => {
  beforeEach(() => {
    plansMock.plans = [PLAN];
    tradesMock.trades = [];
    accountsMock.accounts = [{ id: 'a1', currency: 'BRL', currentBalance: 25357.8 }];
  });

  it('ciclo negativo sem decisão não bloqueia: o PL rola pro equity do ciclo', () => {
    const { onBlockSeal } = renderStep();
    expect(screen.queryByText(AVISO)).toBeNull();
    expect(onBlockSeal).toHaveBeenLastCalledWith(false);
  });

  it('"manter" em ciclo negativo também não bloqueia', () => {
    const { onBlockSeal } = renderStep({
      planAdjustment: { changed: false, newPl: 25645.6, decisionSource: 'kept' },
    });
    expect(screen.queryByText(AVISO)).toBeNull();
    expect(onBlockSeal).toHaveBeenLastCalledWith(false);
  });

  it('subir pra 60k sem saldo na conta bloqueia e aponta o aporte', () => {
    const { container, onBlockSeal } = renderStep(ajuste(60000));
    expect(screen.getByText(AVISO)).toBeTruthy();
    expect(container.textContent).toContain('R$ 60.000,00');
    expect(container.textContent).toContain('R$ 25.357,80');
    expect(container.textContent).toContain('lance o aporte na conta');
    expect(onBlockSeal).toHaveBeenLastCalledWith(true);
  });

  it('com o aporte lançado na conta, 60k passa', () => {
    accountsMock.accounts = [{ id: 'a1', currency: 'BRL', currentBalance: 60000 }];
    const { onBlockSeal } = renderStep(ajuste(60000));
    expect(screen.queryByText(AVISO)).toBeNull();
    expect(onBlockSeal).toHaveBeenLastCalledWith(false);
  });

  it('o campo de edição anuncia o saldo livre da conta como máximo', () => {
    accountsMock.accounts = [{ id: 'a1', currency: 'BRL', currentBalance: 60000 }];
    const { container } = renderStep();
    fireEvent.click(screen.getByText('Editar manualmente'));
    expect(container.textContent).toContain('máx R$ 60.000,00');
  });

  it('PL de outro plano ativo da mesma conta não é lastro', () => {
    accountsMock.accounts = [{ id: 'a1', currency: 'BRL', currentBalance: 60000 }];
    plansMock.plans = [PLAN, { id: 'p2', accountId: 'a1', active: true, pl: 20000 }];
    const { onBlockSeal } = renderStep(ajuste(60000));
    expect(screen.getByText(AVISO)).toBeTruthy();
    expect(onBlockSeal).toHaveBeenLastCalledWith(true);
  });

  it('lucro de trade posterior ao ciclo não vira lastro', () => {
    accountsMock.accounts = [{ id: 'a1', currency: 'BRL', currentBalance: 60000 }];
    tradesMock.trades = [{ id: 't1', planId: 'p1', date: '2026-10-01', result: 1500 }];
    const { container, onBlockSeal } = renderStep(ajuste(60000));
    expect(screen.getByText(AVISO)).toBeTruthy();
    expect(container.textContent).toContain('R$ 58.500,00');
    expect(onBlockSeal).toHaveBeenLastCalledWith(true);
  });

  it('sem conta carregada, o teto é o equity do ciclo', () => {
    accountsMock.accounts = [];
    const { onBlockSeal } = renderStep(ajuste(25357.8));
    expect(screen.queryByText(AVISO)).toBeNull();
    expect(onBlockSeal).toHaveBeenLastCalledWith(false);
  });
});
