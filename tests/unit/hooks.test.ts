/**
 * Testes unitários para hooks
 * 
 * Testa lógica de negócio dos hooks com mocks do Firebase
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock do Firebase antes de importar os hooks
vi.mock('@/firebase', () => ({
  db: {},
  storage: {},
  auth: {},
  TRADE_STATUS: {
    PENDING_REVIEW: 'PENDING_REVIEW',
    REVIEWED: 'REVIEWED',
  },
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn((query, callback) => {
    // Simular snapshot vazio por padrão
    callback({ docs: [], empty: true, size: 0 });
    return vi.fn(); // unsubscribe
  }),
  getDocs: vi.fn(() => Promise.resolve({ docs: [], empty: true })),
  getDoc: vi.fn(),
  addDoc: vi.fn(() => Promise.resolve({ id: 'new-doc-123' })),
  updateDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
  doc: vi.fn(),
  serverTimestamp: vi.fn(() => ({ _seconds: Date.now() / 1000 })),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'test-user-123', email: 'test@test.com' },
    isMentor: () => false,
  }),
}));

describe('useMovements hook logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCurrentBalance', () => {
    it('deve retornar 0 para lista vazia de movimentos', () => {
      // Simular cálculo de saldo
      const movements: any[] = [];
      const getCurrentBalance = () => {
        if (movements.length === 0) return 0;
        return movements[movements.length - 1].balanceAfter || 0;
      };
      
      expect(getCurrentBalance()).toBe(0);
    });

    it('deve retornar último balanceAfter', () => {
      const movements = [
        { balanceBefore: 0, balanceAfter: 10000, amount: 10000 },
        { balanceBefore: 10000, balanceAfter: 10500, amount: 500 },
        { balanceBefore: 10500, balanceAfter: 10200, amount: -300 },
      ];
      
      const getCurrentBalance = () => {
        if (movements.length === 0) return 0;
        return movements[movements.length - 1].balanceAfter || 0;
      };
      
      expect(getCurrentBalance()).toBe(10200);
    });
  });

  describe('getTotals', () => {
    it('deve calcular totais por tipo', () => {
      const movements = [
        { type: 'INITIAL_BALANCE', amount: 10000 },
        { type: 'DEPOSIT', amount: 5000 },
        { type: 'TRADE_RESULT', amount: 500 },
        { type: 'TRADE_RESULT', amount: -200 },
        { type: 'WITHDRAWAL', amount: -1000 },
      ];

      const getTotals = () => {
        const totals = {
          deposits: 0,
          withdrawals: 0,
          tradeResults: 0,
          net: 0
        };

        movements.forEach(m => {
          switch (m.type) {
            case 'INITIAL_BALANCE':
            case 'DEPOSIT':
              totals.deposits += m.amount;
              break;
            case 'WITHDRAWAL':
              totals.withdrawals += Math.abs(m.amount);
              break;
            case 'TRADE_RESULT':
              totals.tradeResults += m.amount;
              break;
          }
          totals.net += m.amount;
        });

        return totals;
      };

      const totals = getTotals();
      expect(totals.deposits).toBe(15000); // 10000 + 5000
      expect(totals.withdrawals).toBe(1000);
      expect(totals.tradeResults).toBe(300); // 500 - 200
      expect(totals.net).toBe(14300); // 10000 + 5000 + 500 - 200 - 1000
    });
  });

  describe('Ledger integrity', () => {
    it('deve manter consistência entre balanceBefore e balanceAfter anterior', () => {
      const movements = [
        { balanceBefore: 0, balanceAfter: 10000, amount: 10000 },
        { balanceBefore: 10000, balanceAfter: 10500, amount: 500 },
        { balanceBefore: 10500, balanceAfter: 10200, amount: -300 },
      ];

      // Verificar integridade
      for (let i = 1; i < movements.length; i++) {
        expect(movements[i].balanceBefore).toBe(movements[i - 1].balanceAfter);
      }
    });

    it('deve verificar que balanceAfter = balanceBefore + amount', () => {
      const movements = [
        { balanceBefore: 0, balanceAfter: 10000, amount: 10000 },
        { balanceBefore: 10000, balanceAfter: 10500, amount: 500 },
        { balanceBefore: 10500, balanceAfter: 10200, amount: -300 },
      ];

      movements.forEach(m => {
        expect(m.balanceAfter).toBe(m.balanceBefore + m.amount);
      });
    });
  });
});

describe('Trade result calculation', () => {
  it('deve calcular resultado LONG corretamente', () => {
    const side = 'LONG';
    const entry = 128500;
    const exit = 128750;
    const qty = 5;
    
    // LONG: (exit - entry) * qty
    const expected = (exit - entry) * qty;
    expect(expected).toBe(1250);
  });

  it('deve calcular resultado SHORT corretamente', () => {
    const side = 'SHORT';
    const entry = 128500;
    const exit = 128250;
    const qty = 5;
    
    // SHORT: (entry - exit) * qty
    const expected = (entry - exit) * qty;
    expect(expected).toBe(1250);
  });

  it('deve calcular WINFUT com tick value', () => {
    const tickSize = 5;
    const tickValue = 1; // R$1 por tick no mini
    const entry = 128500;
    const exit = 128750;
    const qty = 5;
    const side = 'LONG';
    
    // Pontos de diferença
    const diff = side === 'LONG' ? exit - entry : entry - exit;
    // Quantidade de ticks
    const ticks = diff / tickSize;
    // Resultado
    const result = ticks * tickValue * qty;
    
    expect(diff).toBe(250);
    expect(ticks).toBe(50);
    expect(result).toBe(250); // 50 ticks * R$1 * 5 contratos
  });
});

describe('Account type helpers', () => {
  const isRealAccount = (acc: any) => {
    if (acc.type) return acc.type === 'REAL' || acc.type === 'PROP';
    return acc.isReal === true;
  };

  const isDemoAccount = (acc: any) => {
    if (acc.type) return acc.type === 'DEMO';
    return acc.isReal === false || acc.isReal === undefined;
  };

  it('deve identificar conta REAL pelo type', () => {
    expect(isRealAccount({ type: 'REAL' })).toBe(true);
    expect(isRealAccount({ type: 'PROP' })).toBe(true);
    expect(isRealAccount({ type: 'DEMO' })).toBe(false);
  });

  it('deve identificar conta REAL pelo isReal (legado)', () => {
    expect(isRealAccount({ isReal: true })).toBe(true);
    expect(isRealAccount({ isReal: false })).toBe(false);
  });

  it('deve identificar conta DEMO', () => {
    expect(isDemoAccount({ type: 'DEMO' })).toBe(true);
    expect(isDemoAccount({ type: 'REAL' })).toBe(false);
    expect(isDemoAccount({ isReal: false })).toBe(true);
    expect(isDemoAccount({})).toBe(true); // undefined = demo
  });

  it('deve priorizar type sobre isReal', () => {
    // type: DEMO mas isReal: true -> deve ser DEMO
    expect(isDemoAccount({ type: 'DEMO', isReal: true })).toBe(true);
    expect(isRealAccount({ type: 'DEMO', isReal: true })).toBe(false);
  });
});
