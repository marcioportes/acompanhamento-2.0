import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.js'],
    include: [
      'src/**/*.test.{js,jsx,ts,tsx}',
      'src/__tests__/**/*.test.{js,jsx,ts,tsx}'
    ],
    exclude: ['node_modules'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov'],
      include: ['src/utils/**'],
      // Fase 2: descomentar thresholds
      // thresholds: {
      //   lines: 40,
      //   functions: 40,
      //   branches: 30,
      // }
    }
  }
});
