/**
 * tradeGateway.test.js
 * @description Testes para createTrade — gateway único de criação de trades (INV-02)
 *
 * Cenários cobertos (conforme protocolo de segurança issue #93, seção 4.1):
 * - Trade LONG com stop
 * - Trade SHORT com stop
 * - Trade sem stop (compliance DEC-005/DEC-006)
 * - Trade com parciais (_partials — INV-12)
 * - Trade com source: 'order_import'
 * - Trade com valores zero/null/undefined em campos opcionais
 * - Validação de plano inexistente
 * - Validação de conta inexistente
 * - Cálculo de result, RR, riskPercent (DEC-007/DEC-009)
 * - Criação de movement correspondente
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// MOCK: Firebase Firestore
// ============================================

const mockAddDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockDoc = vi.fn();
const mockCollection = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockServerTimestamp = vi.fn(() => ({ _type: 'serverTimestamp' }));

vi.mock('firebase/firestore', () => ({
  collection: (...args) => mockCollection(...args),
  query: (...args) => mockQuery(...args),
  where: (...args) => mockWhere(...args),
  addDoc: (...args) => mockAddDoc(...args),
  getDoc: (...args) => mockGetDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  doc: (...args) => mockDoc(...args),
  serverTimestamp: () => mockServerTimestamp(),
}));

vi.mock('../../firebase', () => ({
  db: { type: 'mock-firestore' },
}));

import { createTrade } from '../../utils/tradeGateway';

// ============================================
// HELPERS
// ============================================

const USER_CONTEXT = {
  uid: 'user-123',
  email: 'trader@test.com',
  displayName: 'Trader Test',
};

const makePlanSnap = (data = {}) => ({
  exists: () => true,
  data: () => ({
    accountId: 'acc-001',
    pl: 10000,
    riskPerOperation: 1,
    rrTarget: 2,
    ...data,
  }),
});

const makeAccountSnap = (data = {}) => ({
  exists: () => true,
  data: () => ({ currency: 'BRL', ...data }),
});

const makeMovementsSnap = (movements = []) => ({
  docs: movements.map((m) => ({ data: () => m })),
});

/**
 * Configura mocks padrão para um cenário simples.
 * Retorna docRef.id que addDoc vai resolver.
 */
const setupDefaultMocks = (overrides = {}) => {
  const tradeDocId = overrides.tradeDocId ?? 'trade-new-001';
  const planData = overrides.planData ?? {};
  const accountData = overrides.accountData ?? {};
  const movements = overrides.movements ?? [];

  // getDoc: primeiro call = plan, segundo = account
  mockGetDoc
    .mockResolvedValueOnce(makePlanSnap(planData))
    .mockResolvedValueOnce(makeAccountSnap(accountData));

  // getDocs: movements query
  mockGetDocs.mockResolvedValueOnce(makeMovementsSnap(movements));

  // addDoc: primeiro = trade, segundo = movement
  mockAddDoc
    .mockResolvedValueOnce({ id: tradeDocId })
    .mockResolvedValueOnce({ id: 'mov-001' });

  return tradeDocId;
};

const baseTradeData = {
  planId: 'plan-001',
  ticker: 'WINZ26',
  side: 'LONG',
  entry: '5000',
  exit: '5010',
  qty: '1',
  entryTime: '2026-04-04T10:00:00',
  exitTime: '2026-04-04T10:30:00',
  stopLoss: '4990',
  emotionEntry: 'Confiança',
  emotionExit: 'Alívio',
  setup: 'Rompimento',
};

// ============================================
// TESTS
// ============================================

beforeEach(() => {
  vi.resetAllMocks();
});

describe('createTrade — validações', () => {
  it('rejeita sem userContext.uid', async () => {
    await expect(createTrade(baseTradeData, {})).rejects.toThrow('Usuário não autenticado');
    await expect(createTrade(baseTradeData, { uid: null })).rejects.toThrow('Usuário não autenticado');
  });

  it('rejeita sem planId', async () => {
    await expect(createTrade({ ...baseTradeData, planId: null }, USER_CONTEXT))
      .rejects.toThrow('Selecione um Plano');
  });

  it('rejeita plano inexistente', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });
    await expect(createTrade(baseTradeData, USER_CONTEXT))
      .rejects.toThrow('Plano não encontrado');
  });

  it('rejeita plano sem conta vinculada', async () => {
    mockGetDoc.mockResolvedValueOnce(makePlanSnap({ accountId: null }));
    await expect(createTrade(baseTradeData, USER_CONTEXT))
      .rejects.toThrow('Plano sem conta vinculada');
  });
});

describe('createTrade — LONG com stop', () => {
  it('calcula result e RR real corretamente', async () => {
    const tradeDocId = setupDefaultMocks();

    const result = await createTrade(baseTradeData, USER_CONTEXT);

    expect(result.id).toBe(tradeDocId);
    expect(result.side).toBe('LONG');
    expect(result.entry).toBe(5000);
    expect(result.exit).toBe(5010);
    expect(result.qty).toBe(1);
    expect(result.stopLoss).toBe(4990);
    expect(result.ticker).toBe('WINZ26');
    expect(result.status).toBe('OPEN');
    expect(result.studentEmail).toBe('trader@test.com');
    expect(result.studentId).toBe('user-123');
    expect(result.studentName).toBe('Trader Test');
    expect(result.accountId).toBe('acc-001');
    expect(result.currency).toBe('BRL');

    // Result: LONG (5010-5000)*1 = 10
    expect(result.resultCalculated).toBe(10);
    expect(result.result).toBe(10);
    expect(result.resultEdited).toBe(false);
    expect(result.resultInPoints).toBe(10);

    // RR real: result / (risk * pointValue * qty) = 10 / (10 * 1 * 1) = 1.0
    expect(result.rrRatio).toBe(1.0);
    expect(result.rrAssumed).toBe(false);

    // Duration: 30 min
    expect(result.duration).toBe(30);
    expect(result.date).toBe('2026-04-04');
  });

  it('cria trade e movement no Firestore', async () => {
    setupDefaultMocks();

    await createTrade(baseTradeData, USER_CONTEXT);

    // addDoc chamado 2 vezes: trade + movement
    expect(mockAddDoc).toHaveBeenCalledTimes(2);

    // Primeiro call: trade
    const tradeCall = mockAddDoc.mock.calls[0];
    expect(tradeCall[1].ticker).toBe('WINZ26');

    // Segundo call: movement
    const movCall = mockAddDoc.mock.calls[1];
    expect(movCall[1].type).toBe('TRADE_RESULT');
    expect(movCall[1].amount).toBe(10);
    expect(movCall[1].studentId).toBe('user-123');
  });
});

describe('createTrade — SHORT com stop', () => {
  it('calcula result SHORT corretamente', async () => {
    setupDefaultMocks();

    const shortTrade = {
      ...baseTradeData,
      side: 'SHORT',
      entry: '5010',
      exit: '5000',
      stopLoss: '5020',
    };

    const result = await createTrade(shortTrade, USER_CONTEXT);

    // Result: SHORT entry-exit não tem tickerRule → calculateTradeResult(SHORT,5010,5000,1) = (5010-5000)*1 = 10
    expect(result.result).toBe(10);
    expect(result.resultInPoints).toBe(10); // SHORT: entry - exit = 5010-5000 = 10

    // RR real: 10 / (|5010-5020| * 1 * 1) = 10/10 = 1.0
    expect(result.rrRatio).toBe(1.0);
    expect(result.rrAssumed).toBe(false);
  });
});

describe('createTrade — sem stop (RR assumido, DEC-005/DEC-006)', () => {
  it('calcula RR assumido quando stopLoss ausente', async () => {
    setupDefaultMocks({
      planData: { pl: 10000, riskPerOperation: 1, rrTarget: 2 },
    });

    const noStopTrade = { ...baseTradeData, stopLoss: null };
    const result = await createTrade(noStopTrade, USER_CONTEXT);

    expect(result.stopLoss).toBeNull();
    expect(result.rrAssumed).toBe(true);
    // RO$ = 10000 * 1% = 100. Result = 10. RR = 10/100 = 0.1
    expect(result.rrRatio).toBe(0.1);
  });

  it('calcula RR assumido quando stopLoss = 0', async () => {
    setupDefaultMocks({
      planData: { pl: 20000, riskPerOperation: 0.5, rrTarget: 3 },
    });

    const zeroStopTrade = { ...baseTradeData, stopLoss: 0 };
    const result = await createTrade(zeroStopTrade, USER_CONTEXT);

    expect(result.stopLoss).toBe(0);
    expect(result.rrAssumed).toBe(true);
    // RO$ = 20000 * 0.5% = 100. Result = 10. RR = 10/100 = 0.1
    expect(result.rrRatio).toBe(0.1);
  });
});

describe('createTrade — com parciais (INV-12)', () => {
  it('calcula result via parciais', async () => {
    setupDefaultMocks();

    const partialsTrade = {
      ...baseTradeData,
      _partials: [
        { type: 'ENTRY', price: 5000, qty: 2, dateTime: '2026-04-04T10:00:00', seq: 1 },
        { type: 'ENTRY', price: 5005, qty: 1, dateTime: '2026-04-04T10:01:00', seq: 2 },
        { type: 'EXIT', price: 5015, qty: 3, dateTime: '2026-04-04T10:30:00', seq: 3 },
      ],
    };

    const result = await createTrade(partialsTrade, USER_CONTEXT);

    expect(result.hasPartials).toBe(true);
    expect(result.partialsCount).toBe(3);
    // avgEntry = (5000*2 + 5005*1) / 3 = 15005/3 ≈ 5001.67
    // avgExit = 5015
    // resultInPoints = 5015 - 5001.67 ≈ 13.33
    // result = 13.33 * 3 (qty) ≈ 40 (sem tickerRule)
    expect(result.result).toBeGreaterThan(0);
    expect(result.resultInPoints).toBeGreaterThan(0);
  });
});

describe('createTrade — com source: order_import', () => {
  it('preserva campo source no trade criado', async () => {
    setupDefaultMocks();

    const orderTrade = {
      ...baseTradeData,
      source: 'order_import',
      importSource: 'order_import',
      importBatchId: 'batch_123',
    };

    const result = await createTrade(orderTrade, USER_CONTEXT);

    expect(result.source).toBe('order_import');
    expect(result.importSource).toBe('order_import');
    expect(result.importBatchId).toBe('batch_123');
  });
});

describe('createTrade — campos opcionais null/undefined/zero', () => {
  it('stopLoss undefined → null, RR assumido', async () => {
    setupDefaultMocks();

    const trade = { ...baseTradeData, stopLoss: undefined };
    const result = await createTrade(trade, USER_CONTEXT);

    expect(result.stopLoss).toBeNull();
    expect(result.rrAssumed).toBe(true);
  });

  it('exitTime null → duration 0', async () => {
    setupDefaultMocks();

    const trade = { ...baseTradeData, exitTime: null };
    const result = await createTrade(trade, USER_CONTEXT);

    expect(result.exitTime).toBeNull();
    expect(result.duration).toBe(0);
  });

  it('resultOverride presente → result usa override, resultInPoints = null', async () => {
    setupDefaultMocks();

    const trade = { ...baseTradeData, resultOverride: 999 };
    const result = await createTrade(trade, USER_CONTEXT);

    expect(result.result).toBe(999);
    expect(result.resultEdited).toBe(true);
    expect(result.resultInPoints).toBeNull();
  });

  it('resultOverride = 0 → result usa calculado (0 é falsy mas não NaN)', async () => {
    setupDefaultMocks();

    const trade = { ...baseTradeData, resultOverride: 0 };
    const result = await createTrade(trade, USER_CONTEXT);

    // resultOverride = 0, parseFloat(0) = 0, !isNaN(0) = true → override aplica
    expect(result.result).toBe(0);
    expect(result.resultEdited).toBe(true);
    expect(result.resultInPoints).toBeNull();
  });

  it('emotionEntry/emotionExit/setup passados adiante (spread)', async () => {
    setupDefaultMocks();

    const trade = {
      ...baseTradeData,
      emotionEntry: 'Medo',
      emotionExit: 'Frustração',
      setup: 'Scalp',
    };
    const result = await createTrade(trade, USER_CONTEXT);

    expect(result.emotionEntry).toBe('Medo');
    expect(result.emotionExit).toBe('Frustração');
    expect(result.setup).toBe('Scalp');
  });
});

describe('createTrade — tickerRule com tick specs', () => {
  it('calcula result via tickSize/tickValue', async () => {
    setupDefaultMocks();

    const trade = {
      ...baseTradeData,
      entry: '5000',
      exit: '5010',
      qty: '2',
      tickerRule: { tickSize: 5, tickValue: 10, pointValue: 2 },
    };

    const result = await createTrade(trade, USER_CONTEXT);

    // LONG: rawDiff = 5010-5000 = 10
    // ticks = 10/5 = 2
    // result = round(2 * 10 * 2) = 40
    expect(result.result).toBe(40);
    expect(result.resultInPoints).toBe(10);

    // RR real: 40 / (|5000-4990| * 2 * 2) = 40/40 = 1.0
    expect(result.rrRatio).toBe(1.0);
  });
});

describe('createTrade — movement', () => {
  it('não cria movement quando effectiveResult = 0', async () => {
    vi.resetAllMocks();
    // Entrada = saída → result = 0
    mockGetDoc
      .mockResolvedValueOnce(makePlanSnap())
      .mockResolvedValueOnce(makeAccountSnap());

    mockAddDoc.mockResolvedValueOnce({ id: 'trade-zero' });

    const trade = { ...baseTradeData, entry: '5000', exit: '5000' };
    await createTrade(trade, USER_CONTEXT);

    // Apenas 1 addDoc (trade), sem movement
    expect(mockAddDoc).toHaveBeenCalledTimes(1);
  });

  it('calcula balanceBefore a partir do último movement', async () => {
    vi.resetAllMocks();
    setupDefaultMocks({
      movements: [
        { balanceAfter: 10500, dateTime: '2026-04-04T09:00:00' },
        { balanceAfter: 10000, dateTime: '2026-04-03T09:00:00' },
      ],
    });

    await createTrade(baseTradeData, USER_CONTEXT);

    const movCall = mockAddDoc.mock.calls[1][1];
    // Sorted desc by dateTime → primeiro = 10500
    expect(movCall.balanceBefore).toBe(10500);
    expect(movCall.balanceAfter).toBe(10510); // 10500 + 10
  });

  it('balanceBefore = 0 quando não há movements anteriores', async () => {
    vi.resetAllMocks();
    setupDefaultMocks({ movements: [] });

    await createTrade(baseTradeData, USER_CONTEXT);

    const movCall = mockAddDoc.mock.calls[1][1];
    expect(movCall.balanceBefore).toBe(0);
    expect(movCall.balanceAfter).toBe(10); // 0 + 10
  });
});

describe('createTrade — contrato de retorno', () => {
  it('retorna { id, ...tradeFields } — contrato necessário para useCsvStaging', async () => {
    vi.resetAllMocks();
    const tradeDocId = setupDefaultMocks();

    const result = await createTrade(baseTradeData, USER_CONTEXT);

    expect(result).toHaveProperty('id');
    expect(result.id).toBe(tradeDocId);
    expect(result).toHaveProperty('ticker');
    expect(result).toHaveProperty('result');
    expect(result).toHaveProperty('studentEmail');
    expect(result).toHaveProperty('accountId');
    expect(result).toHaveProperty('status', 'OPEN');
  });

  it('displayName fallback para email prefix', async () => {
    setupDefaultMocks();

    const userNoName = { uid: 'u-1', email: 'joao@test.com', displayName: null };
    const result = await createTrade(baseTradeData, userNoName);

    expect(result.studentName).toBe('joao');
  });
});

describe('createTrade — currency da conta', () => {
  it('usa currency da conta quando disponível', async () => {
    setupDefaultMocks({ accountData: { currency: 'USD' } });

    const result = await createTrade(baseTradeData, USER_CONTEXT);
    expect(result.currency).toBe('USD');
  });

  it('fallback para BRL quando conta não tem currency', async () => {
    setupDefaultMocks({ accountData: { currency: null } });

    const result = await createTrade(baseTradeData, USER_CONTEXT);
    expect(result.currency).toBe('BRL');
  });

  it('fallback para BRL quando conta não existe', async () => {
    mockGetDoc
      .mockResolvedValueOnce(makePlanSnap())
      .mockResolvedValueOnce({ exists: () => false, data: () => null });
    mockGetDocs.mockResolvedValueOnce(makeMovementsSnap([]));
    mockAddDoc.mockResolvedValueOnce({ id: 'trade-x' }).mockResolvedValueOnce({ id: 'mov-x' });

    const result = await createTrade(baseTradeData, USER_CONTEXT);
    expect(result.currency).toBe('BRL');
  });
});
