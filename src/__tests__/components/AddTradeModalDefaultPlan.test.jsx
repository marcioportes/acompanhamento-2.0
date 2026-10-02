/**
 * Issue #484 — o formulário de novo trade abre no plano que está na tela.
 *
 * Antes pré-selecionava `plans[0]` (o mais recente) e ainda carregava o plano da abertura
 * anterior. Estes testes travam: o plano inicial é o `defaultPlanId` de quem abre o modal;
 * sem default e com mais de um plano, o campo abre vazio e o submit é barrado.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AddTradeModal from '../../components/AddTradeModal';

const mockMasterData = {
  setups: [{ id: 's1', name: 'Fibo 61,8' }],
  emotions: [{ id: 'e1', name: 'Neutro', category: 'neutral' }],
  exchanges: [{ id: 'x1', code: 'B3' }],
  tickers: [],
  loading: false,
};

vi.mock('../../hooks/useMasterData', () => ({
  useMasterData: () => mockMasterData,
}));

vi.mock('../../hooks/useAccounts', () => ({
  useAccounts: () => ({
    accounts: [{ id: 'acc-prop', currency: 'USD' }, { id: 'acc-demo', currency: 'BRL' }],
    loading: false,
  }),
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));

// Ordem do usePlans: mais recente primeiro.
const plans = [
  { id: 'lucid', name: 'Plano Lucid Flex 25K', accountId: 'acc-prop', currency: 'USD' },
  { id: 'demo', name: 'PL-Demo ao-vivo', accountId: 'acc-demo', currency: 'BRL' },
];

const modal = (props = {}) => (
  <AddTradeModal
    isOpen={true}
    onClose={() => {}}
    onSubmit={vi.fn()}
    plans={plans}
    loading={false}
    {...props}
  />
);

// Botão do campo "Plano *" — "Selecione..." aparece em outros campos do formulário.
const planField = () => screen.getByText('Plano *').parentElement.querySelector('button');

describe('AddTradeModal — plano inicial do trade novo (#484)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('abre no plano recebido da barra de contexto, não no mais recente', () => {
    render(modal({ defaultPlanId: 'demo' }));
    expect(screen.getByText('PL-Demo ao-vivo')).toBeTruthy();
    expect(screen.queryByText('Plano Lucid Flex 25K')).toBeNull();
  });

  it('sem plano na tela e com mais de um plano: abre vazio', () => {
    render(modal({ defaultPlanId: '' }));
    expect(planField().textContent).toBe('Selecione...');
  });

  it('sem prop de contexto (uso fora do dashboard) também não chuta o mais recente', () => {
    render(modal());
    expect(planField().textContent).toBe('Selecione...');
  });

  it('sem prop de contexto e plano único: pré-seleciona', () => {
    render(modal({ plans: [plans[1]] }));
    expect(screen.getByText('PL-Demo ao-vivo')).toBeTruthy();
  });

  it('reabrir depois de trocar a barra de contexto usa o plano novo, não o da abertura anterior', () => {
    const { rerender } = render(modal({ defaultPlanId: 'lucid' }));
    expect(screen.getByText('Plano Lucid Flex 25K')).toBeTruthy();

    rerender(modal({ isOpen: false, defaultPlanId: 'lucid' }));
    rerender(modal({ isOpen: true, defaultPlanId: 'demo' }));

    expect(screen.getByText('PL-Demo ao-vivo')).toBeTruthy();
    expect(screen.queryByText('Plano Lucid Flex 25K')).toBeNull();
  });

  it('a escolha manual do aluno não é sobrescrita por re-render do pai', () => {
    const { rerender } = render(modal({ defaultPlanId: 'demo' }));

    fireEvent.click(screen.getByText('PL-Demo ao-vivo'));
    fireEvent.click(screen.getByText('Plano Lucid Flex 25K'));
    expect(screen.getByText('Plano Lucid Flex 25K')).toBeTruthy();

    rerender(modal({ defaultPlanId: 'demo', plans: [...plans] }));

    expect(screen.getByText('Plano Lucid Flex 25K')).toBeTruthy();
    expect(screen.queryByText('PL-Demo ao-vivo')).toBeNull();
  });
});
