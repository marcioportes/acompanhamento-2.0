/**
 * Test Setup — Vitest
 * @description Configuração global para testes: jest-dom matchers + mock Firebase
 */

import '@testing-library/jest-dom';

// Mock global do Firebase — evita importação real em qualquer teste
vi.mock('../firebase.js', () => ({
  db: {},
  auth: {
    currentUser: { uid: 'test-user-123', email: 'test@test.com' }
  }
}));
