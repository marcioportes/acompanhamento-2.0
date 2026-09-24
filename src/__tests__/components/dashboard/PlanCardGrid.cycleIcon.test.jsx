/**
 * #460 — o ícone do card mede o CICLO; a etiqueta do canto é do período, rotulada.
 * Caso real: meta diária R$ 1.019 nunca batida em setembro, meta do ciclo (10%) batida.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render } from '@testing-library/react';
import PlanCardGrid from '../../../components/dashboard/PlanCardGrid';

const PLAN = {
  id: 'p1', name: 'Ago-Plano', accountId: 'a1', active: true,
  pl: 30426, periodGoal: 3.35, periodStop: 1.67, cycleGoal: 10, cycleStop: 5,
  operationPeriod: 'Diário', adjustmentCycle: 'Mensal', riskPerOperation: 0.84, rrTarget: 2,
};
const ACCOUNTS = [{ id: 'a1', name: 'Conta', currency: 'BRL' }];
const trade = (date, result) => ({ id: `${date}-${result}`, planId: 'p1', date, entryTime: `${date}T10:00:00`, result });

const renderCard = (trades) => render(
  <PlanCardGrid
    availablePlans={[PLAN]} accounts={ACCOUNTS} trades={trades} selectedPlanId={null}
    onSelectPlan={() => {}} onOpenLedger={() => {}} onEditPlan={() => {}}
    onDeletePlan={() => {}} onCreatePlan={() => {}}
  />,
);

beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-09-24T15:00:00')); });
afterAll(() => { vi.useRealTimers(); });

describe('#460 — PlanCardGrid', () => {
  it('meta do ciclo batida sem nenhum dia na meta diária → troféu', () => {
    const trades = [
      trade('2026-09-08', 500), trade('2026-09-09', 525), trade('2026-09-10', 500),
      trade('2026-09-14', 500), trade('2026-09-16', 500), trade('2026-09-18', 500),
      trade('2026-09-24', 585),
    ];
    const { container } = renderCard(trades);
    // O ícone do card é o único svg w-5; troféu = amarelo (getCycleSentiment).
    expect(container.querySelector('svg.w-5').getAttribute('class')).toContain('text-yellow-400');
  });

  it('stop diário hoje → etiqueta diz "Hoje:"; o ícone segue o mês', () => {
    const trades = [trade('2026-09-08', 900), trade('2026-09-24', -600)];
    const { container } = renderCard(trades);
    expect(container.textContent).toContain('Hoje: Stop Atingido');
    // mês +300: carinha verde, não caveira
    expect(container.querySelector('svg.w-5').getAttribute('class')).toContain('text-emerald-400');
  });

  it('sem trade hoje → nenhuma etiqueta de período (ontem não é "hoje")', () => {
    const { container } = renderCard([trade('2026-09-22', -600)]);
    expect(container.textContent).not.toMatch(/Hoje:/);
    expect(container.textContent).not.toMatch(/Stop Atingido/);
  });
});
