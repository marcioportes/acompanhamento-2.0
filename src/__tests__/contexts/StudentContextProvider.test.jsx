import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { StudentContextProvider } from '../../contexts/StudentContextProvider';
import { useStudentContext } from '../../hooks/useStudentContext';
import { PERIOD_KIND, CYCLE_STATUS } from '../../utils/cycleResolver';

const mockAccounts = [
  { id: 'a1', active: true, name: 'Conta Real', type: 'REAL' },
  { id: 'a2', active: true, name: 'Conta PROP', type: 'PROP' },
  { id: 'a3', active: false, name: 'Conta Inativa' }
];

const mockPlans = [
  { id: 'p1', accountId: 'a1', adjustmentCycle: 'Mensal', createdAt: '2026-01-01' },
  { id: 'p2', accountId: 'a1', adjustmentCycle: 'Mensal', createdAt: '2026-04-01' },
  { id: 'p3', accountId: 'a2', adjustmentCycle: 'Trimestral', createdAt: '2026-03-01' }
];

const wrap = (scopeStudentId = 's1', accounts = mockAccounts, plans = mockPlans) => ({
  wrapper: ({ children }) => (
    <StudentContextProvider scopeStudentId={scopeStudentId} accounts={accounts} plans={plans}>
      {children}
    </StudentContextProvider>
  )
});

describe('StudentContextProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe('inicialização default (E2)', () => {
    it('seta default para conta + plano mais recente quando localStorage vazio', () => {
      const { result } = renderHook(() => useStudentContext(), wrap());
      expect(result.current.accountId).toBe('a1');
      expect(result.current.planId).toBe('p2'); // mais recente
      expect(result.current.cycleKey).not.toBeNull();
    });

    it('persiste no localStorage', () => {
      renderHook(() => useStudentContext(), wrap());
      const raw = window.localStorage.getItem('studentContext_v1_s1');
      expect(raw).not.toBeNull();
      const stored = JSON.parse(raw);
      expect(stored.accountId).toBe('a1');
    });

    it('recupera localStorage existente em remount', () => {
      window.localStorage.setItem(
        'studentContext_v1_s1',
        JSON.stringify({ accountId: 'a2', planId: 'p3', cycleKey: '2026-Q2', period: null, updatedAt: '2026-04-15T00:00:00Z' })
      );
      const { result } = renderHook(() => useStudentContext(), wrap());
      expect(result.current.accountId).toBe('a2');
      expect(result.current.planId).toBe('p3');
    });

    it('reseta default quando conta persistida não existe mais', () => {
      window.localStorage.setItem(
        'studentContext_v1_s1',
        JSON.stringify({ accountId: 'inexistente', planId: 'p1', cycleKey: null, period: null, updatedAt: '2026-04-15T00:00:00Z' })
      );
      const { result } = renderHook(() => useStudentContext(), wrap());
      expect(result.current.accountId).toBe('a1');
    });
  });

  describe('rescope por aluno (E5)', () => {
    it('localStorage keys separados por scopeStudentId', () => {
      renderHook(() => useStudentContext(), wrap('aluno-A'));
      renderHook(() => useStudentContext(), wrap('aluno-B'));
      expect(window.localStorage.getItem('studentContext_v1_aluno-A')).not.toBeNull();
      expect(window.localStorage.getItem('studentContext_v1_aluno-B')).not.toBeNull();
    });

    it('mentor olhando dois alunos diferentes não vaza estado', () => {
      const { result: r1 } = renderHook(() => useStudentContext(), wrap('aluno-A'));
      act(() => r1.current.setAccount('a2'));
      expect(r1.current.accountId).toBe('a2');

      const { result: r2 } = renderHook(() => useStudentContext(), wrap('aluno-B'));
      expect(r2.current.accountId).toBe('a1');
    });
  });

  describe('encadeamento reativo', () => {
    it('setAccount reseta plano para default da conta + ciclo ativo + período CYCLE', () => {
      const { result } = renderHook(() => useStudentContext(), wrap());
      act(() => result.current.setAccount('a2'));
      expect(result.current.accountId).toBe('a2');
      expect(result.current.planId).toBe('p3');
      expect(result.current.period.kind).toBe(PERIOD_KIND.CYCLE);
    });

    it('setAccount com conta sem plano mantém planId null', () => {
      const plans = [{ id: 'p1', accountId: 'a1', adjustmentCycle: 'Mensal', createdAt: '2026-01-01' }];
      const { result } = renderHook(() => useStudentContext(), wrap('s1', mockAccounts, plans));
      act(() => result.current.setAccount('a2'));
      expect(result.current.accountId).toBe('a2');
      expect(result.current.planId).toBeNull();
      expect(result.current.cycleKey).toBeNull();
    });

    it('setPlan reseta ciclo para ativo', () => {
      const { result } = renderHook(() => useStudentContext(), wrap());
      const cycleBefore = result.current.cycleKey;
      act(() => result.current.setPlan('p1'));
      expect(result.current.planId).toBe('p1');
      expect(result.current.cycleKey).toBe(cycleBefore); // mesmo plano de ciclo Mensal → mesmo cycleKey pelo now
    });

    // #164 review: overlay do EquityCurve sumia ao trocar plano porque o
    // cycleKey anterior (de outro tipo de ciclo) não era invalidado. Troca de
    // Mensal (p1) para Trimestral (p3) deve resetar cycleKey para o ciclo ativo
    // do plano novo — não carregar o cycleKey mensal do anterior.
    it('setPlan entre planos com cicloType diferente reseta cycleKey para o ciclo ativo do plano novo', () => {
      const { result } = renderHook(() => useStudentContext(), wrap());
      act(() => result.current.setPlan('p1')); // Mensal
      const cycleMensal = result.current.cycleKey;
      expect(cycleMensal).toMatch(/^\d{4}-\d{2}$/);

      act(() => result.current.setPlan('p3')); // Trimestral
      expect(result.current.planId).toBe('p3');
      expect(result.current.cycleKey).not.toBe(cycleMensal);
      expect(result.current.cycleKey).toMatch(/^\d{4}-Q[1-4]$/);
    });

    it('setCycleKey mantém plano mas recalcula período', () => {
      const { result } = renderHook(() => useStudentContext(), wrap());
      act(() => result.current.setCycleKey('2026-01'));
      expect(result.current.cycleKey).toBe('2026-01');
      expect(result.current.period.kind).toBe(PERIOD_KIND.CYCLE);
      expect(result.current.period.start).toBe('2026-01-01');
      expect(result.current.period.end).toBe('2026-01-31');
    });

    it('setPeriodKind muda recorte sem tocar em conta/plano/ciclo', () => {
      const { result } = renderHook(() => useStudentContext(), wrap());
      const { accountId, planId, cycleKey } = result.current;
      act(() => result.current.setPeriodKind(PERIOD_KIND.WEEK));
      expect(result.current.accountId).toBe(accountId);
      expect(result.current.planId).toBe(planId);
      expect(result.current.cycleKey).toBe(cycleKey);
      expect(result.current.period.kind).toBe(PERIOD_KIND.WEEK);
    });
  });

  describe('ciclo anterior (read-only)', () => {
    it('isReadOnlyCycle=false para ciclo ativo', () => {
      const { result } = renderHook(() => useStudentContext(), wrap());
      expect(result.current.isReadOnlyCycle).toBe(false);
    });

    it('isReadOnlyCycle=true quando ciclo selecionado já passou', () => {
      const { result } = renderHook(() => useStudentContext(), wrap());
      // Seleciona ciclo muito antigo
      act(() => result.current.setCycleKey('2020-01'));
      expect(result.current.selectedCycle.status).toBe(CYCLE_STATUS.FINALIZED);
      expect(result.current.isReadOnlyCycle).toBe(true);
    });
  });

  describe('objetos resolvidos', () => {
    it('selectedAccount reflete accountId', () => {
      const { result } = renderHook(() => useStudentContext(), wrap());
      expect(result.current.selectedAccount.id).toBe('a1');
      expect(result.current.selectedAccount.name).toBe('Conta Real');
    });

    it('selectedPlan reflete planId', () => {
      const { result } = renderHook(() => useStudentContext(), wrap());
      expect(result.current.selectedPlan.id).toBe('p2');
    });

    it('selectedCycle é null quando plano ausente', () => {
      const { result } = renderHook(() => useStudentContext(), wrap('s1', [{ id: 'aX', active: true }], []));
      expect(result.current.selectedPlan).toBeNull();
      expect(result.current.selectedCycle).toBeNull();
    });
  });

  describe('guards', () => {
    it('useStudentContext fora do provider lança erro', () => {
      // Silencia o console.error do React
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => renderHook(() => useStudentContext())).toThrow(/deve ser usado dentro/i);
      spy.mockRestore();
    });
  });
});
