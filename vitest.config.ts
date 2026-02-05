/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // Ambiente jsdom para simular browser
    environment: 'jsdom',
    
    // Setup files executados antes de cada teste
    setupFiles: ['./tests/setup.ts'],
    
    // Glob patterns para encontrar testes
    include: [
      'tests/**/*.{test,spec}.{js,jsx,ts,tsx}',
      'src/**/*.{test,spec}.{js,jsx,ts,tsx}',
    ],
    
    // Coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.{js,jsx,ts,tsx}',
        'src/**/*.spec.{js,jsx,ts,tsx}',
        'src/main.jsx',
        'src/firebase.js', // Configuração externa
      ],
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 60,
        lines: 60,
      },
    },
    
    // Globals para não precisar importar describe, it, expect
    globals: true,
    
    // Timeout para testes
    testTimeout: 10000,
    
    // Watch mode config
    watch: false,
    
    // Reporter
    reporters: ['default', 'html'],
    
    // Mock de CSS e assets
    css: false,
  },
});
