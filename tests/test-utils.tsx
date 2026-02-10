/**
 * Test utilities para renderização de componentes React
 * Inclui providers de contexto necessários
 */

import React, { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';
import { mockUser, mockMentorUser } from './mocks/firebase';

// ============ AUTH CONTEXT MOCK ============
interface AuthContextValue {
  user: typeof mockUser | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  isMentor: () => boolean;
}

const createAuthContext = (overrides: Partial<AuthContextValue> = {}) => ({
  user: mockUser,
  loading: false,
  signIn: vi.fn(() => Promise.resolve()),
  signOut: vi.fn(() => Promise.resolve()),
  isMentor: () => false,
  ...overrides,
});

// Mock do AuthContext
export const MockAuthContext = React.createContext<AuthContextValue>(createAuthContext());

// Provider wrapper para testes
interface MockAuthProviderProps {
  children: ReactNode;
  value?: Partial<AuthContextValue>;
}

export const MockAuthProvider: React.FC<MockAuthProviderProps> = ({ 
  children, 
  value = {} 
}) => {
  return (
    <MockAuthContext.Provider value={createAuthContext(value)}>
      {children}
    </MockAuthContext.Provider>
  );
};

// ============ ALL PROVIDERS WRAPPER ============
interface AllProvidersProps {
  children: ReactNode;
  authValue?: Partial<AuthContextValue>;
}

export const AllProviders: React.FC<AllProvidersProps> = ({ 
  children,
  authValue = {}
}) => {
  return (
    <MockAuthProvider value={authValue}>
      {children}
    </MockAuthProvider>
  );
};

// ============ CUSTOM RENDER ============
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  authValue?: Partial<AuthContextValue>;
  asMentor?: boolean;
}

/**
 * Renderiza componente com todos os providers necessários
 */
export const renderWithProviders = (
  ui: ReactElement,
  options: CustomRenderOptions = {}
) => {
  const { authValue = {}, asMentor = false, ...renderOptions } = options;

  const finalAuthValue = asMentor
    ? { ...authValue, user: mockMentorUser, isMentor: () => true }
    : authValue;

  const Wrapper: React.FC<{ children: ReactNode }> = ({ children }) => (
    <AllProviders authValue={finalAuthValue}>
      {children}
    </AllProviders>
  );

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    // Retornar helpers extras
    rerender: (newUi: ReactElement) =>
      render(newUi, { wrapper: Wrapper, ...renderOptions }),
  };
};

// ============ UTILITY FUNCTIONS ============

/**
 * Aguardar próximo tick do event loop
 */
export const waitForNextTick = () => 
  new Promise(resolve => setTimeout(resolve, 0));

/**
 * Aguardar um tempo específico
 */
export const waitFor = (ms: number) => 
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Criar mock de evento de input
 */
export const createInputEvent = (value: string) => ({
  target: { value },
  currentTarget: { value },
});

/**
 * Criar mock de evento de select
 */
export const createSelectEvent = (value: string) => ({
  target: { value },
});

/**
 * Criar mock de arquivo para upload
 */
export const createMockFile = (
  name: string = 'test.png',
  type: string = 'image/png',
  size: number = 1024
): File => {
  const blob = new Blob([''], { type });
  return new File([blob], name, { type });
};

/**
 * Mock de FileReader para testes de upload
 */
export const mockFileReader = () => {
  const mockFileReader = {
    readAsDataURL: vi.fn(),
    onloadend: null as (() => void) | null,
    result: 'data:image/png;base64,mockbase64',
  };

  vi.spyOn(global, 'FileReader').mockImplementation(() => mockFileReader as any);

  return {
    triggerLoad: () => {
      if (mockFileReader.onloadend) {
        mockFileReader.onloadend();
      }
    },
    mockFileReader,
  };
};

// Re-export everything from testing-library
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
