/**
 * Firebase Mock — Testes
 * @description Mock das operações Firestore para testes que precisam de setup específico
 */

import { vi } from 'vitest';

export const mockFirestore = {
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn(),
  serverTimestamp: vi.fn(() => new Date().toISOString()),
};

export const createMockDoc = (data, id = 'mock-id') => ({
  id,
  data: () => data,
  exists: true,
  ref: { id, update: vi.fn() }
});

export const createMockSnapshot = (docs) => ({
  empty: docs.length === 0,
  size: docs.length,
  docs: docs.map((d, i) => createMockDoc(d, d.id || `doc-${i}`)),
  forEach: (fn) => docs.forEach((d, i) => fn(createMockDoc(d, d.id || `doc-${i}`))),
});
