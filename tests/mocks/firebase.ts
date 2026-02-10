/**
 * Mocks do Firebase para testes unitários
 * Evita chamadas reais ao Firestore/Auth
 */

import { vi } from 'vitest';

// ============ AUTH MOCK ============
export const mockUser = {
  uid: 'test-user-123',
  email: 'aluno@test.com',
  displayName: 'Aluno Teste',
  emailVerified: true,
};

export const mockMentorUser = {
  uid: 'mentor-123',
  email: 'marcio@buske.com.br',
  displayName: 'Marcio Mentor',
  emailVerified: true,
};

export const mockAuth = {
  currentUser: mockUser,
  onAuthStateChanged: vi.fn((callback) => {
    callback(mockUser);
    return vi.fn(); // unsubscribe
  }),
  signInWithEmailAndPassword: vi.fn(() => Promise.resolve({ user: mockUser })),
  signOut: vi.fn(() => Promise.resolve()),
};

// ============ FIRESTORE MOCK ============
export const mockTimestamp = {
  toDate: () => new Date('2026-02-05T12:00:00Z'),
  toMillis: () => 1738756800000,
};

export const mockServerTimestamp = vi.fn(() => mockTimestamp);

// Dados de teste
export const mockAccounts = [
  {
    id: 'account-1',
    name: 'Conta Principal',
    broker: 'XP Investimentos',
    currency: 'BRL',
    type: 'REAL',
    isReal: true,
    initialBalance: 10000,
    currentBalance: 11500,
    studentId: 'test-user-123',
    studentEmail: 'aluno@test.com',
    active: true,
    createdAt: mockTimestamp,
  },
  {
    id: 'account-2',
    name: 'Demo FTMO',
    broker: 'FTMO',
    currency: 'USD',
    type: 'DEMO',
    isReal: false,
    initialBalance: 50000,
    currentBalance: 52000,
    studentId: 'test-user-123',
    studentEmail: 'aluno@test.com',
    active: true,
    createdAt: mockTimestamp,
  },
];

export const mockTrades = [
  {
    id: 'trade-1',
    date: '2026-02-04',
    ticker: 'WINFUT',
    exchange: 'B3',
    side: 'LONG',
    entry: 128500,
    exit: 128750,
    qty: 5,
    result: 250,
    resultPercent: 0.19,
    setup: 'Rompimento',
    emotion: 'Disciplinado',
    accountId: 'account-1',
    studentId: 'test-user-123',
    studentEmail: 'aluno@test.com',
    status: 'PENDING_REVIEW',
    createdAt: mockTimestamp,
  },
  {
    id: 'trade-2',
    date: '2026-02-03',
    ticker: 'WINFUT',
    exchange: 'B3',
    side: 'SHORT',
    entry: 128900,
    exit: 128750,
    qty: 3,
    result: 150,
    resultPercent: 0.12,
    setup: 'Reversão',
    emotion: 'Ansioso',
    accountId: 'account-1',
    studentId: 'test-user-123',
    studentEmail: 'aluno@test.com',
    status: 'REVIEWED',
    mentorFeedback: 'Bom trade!',
    createdAt: mockTimestamp,
  },
];

export const mockMovements = [
  {
    id: 'mov-1',
    accountId: 'account-1',
    type: 'INITIAL_BALANCE',
    amount: 10000,
    balanceBefore: 0,
    balanceAfter: 10000,
    description: 'Saldo inicial',
    date: '2026-02-01',
    createdAt: mockTimestamp,
  },
  {
    id: 'mov-2',
    accountId: 'account-1',
    type: 'TRADE_RESULT',
    amount: 250,
    balanceBefore: 10000,
    balanceAfter: 10250,
    description: 'LONG WINFUT (5x)',
    date: '2026-02-04',
    tradeId: 'trade-1',
    createdAt: mockTimestamp,
  },
];

export const mockPlans = [
  {
    id: 'plan-1',
    name: 'Plano Conservador',
    accountId: 'account-1',
    studentId: 'test-user-123',
    operationPeriod: 'Semanal',
    adjustmentCycle: 'Mensal',
    periodGoal: 2,
    periodStop: 2,
    cycleGoal: 8,
    cycleStop: 6,
    active: true,
    createdAt: mockTimestamp,
  },
];

export const mockSetups = [
  { id: 'setup-1', name: 'Rompimento', active: true },
  { id: 'setup-2', name: 'Reversão', active: true },
  { id: 'setup-3', name: 'Scalp', active: true },
];

export const mockEmotions = [
  { id: 'emotion-1', name: 'Disciplinado', category: 'positive', active: true },
  { id: 'emotion-2', name: 'Ansioso', category: 'negative', active: true },
  { id: 'emotion-3', name: 'Neutro', category: 'neutral', active: true },
];

export const mockExchanges = [
  { id: 'exchange-1', code: 'B3', name: 'Brasil Bolsa Balcão', active: true },
  { id: 'exchange-2', code: 'CME', name: 'Chicago Mercantile Exchange', active: true },
];

// Mock do Firestore query/snapshot
export const createMockSnapshot = (data: any[]) => ({
  docs: data.map((item, index) => ({
    id: item.id || `doc-${index}`,
    data: () => item,
    exists: () => true,
  })),
  empty: data.length === 0,
  size: data.length,
  forEach: (callback: Function) => data.forEach((item, index) => 
    callback({ id: item.id || `doc-${index}`, data: () => item })
  ),
});

// Mock das funções do Firestore
export const mockFirestore = {
  collection: vi.fn(),
  doc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  serverTimestamp: mockServerTimestamp,
};

// Helper para configurar mock responses
export const setupFirestoreMock = (collectionName: string, data: any[]) => {
  mockFirestore.onSnapshot.mockImplementation((query, callback) => {
    callback(createMockSnapshot(data));
    return vi.fn(); // unsubscribe
  });
  
  mockFirestore.getDocs.mockResolvedValue(createMockSnapshot(data));
};

// ============ STORAGE MOCK ============
export const mockStorage = {
  ref: vi.fn(() => ({
    put: vi.fn(() => Promise.resolve()),
    getDownloadURL: vi.fn(() => Promise.resolve('https://example.com/image.jpg')),
    delete: vi.fn(() => Promise.resolve()),
  })),
  uploadBytes: vi.fn(() => Promise.resolve({ ref: {} })),
  getDownloadURL: vi.fn(() => Promise.resolve('https://example.com/image.jpg')),
  deleteObject: vi.fn(() => Promise.resolve()),
};

// ============ FIREBASE CONFIG MOCK ============
export const mockFirebaseConfig = {
  apiKey: 'test-api-key',
  authDomain: 'test.firebaseapp.com',
  projectId: 'test-project',
  storageBucket: 'test.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abc123',
};
