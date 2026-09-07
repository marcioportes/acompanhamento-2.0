/**
 * Playwright — verificação visual (issue #427)
 *
 * Existe porque duas entregas foram a produção com build verde, lint limpo e a
 * suíte inteira passando, e mesmo assim quebraram a tela. Teste de unidade prova
 * que a função calcula; só a foto prova que a tela existe.
 *
 * `deviceScaleFactor: 2` não é capricho: o redesign é sobre tipografia, e em 1x
 * não dá para julgar peso de fonte nem legibilidade de rótulo de 10px.
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  reporter: [['list']],
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  webServer: {
    command: 'npx vite --config vite.harness.config.js',
    url: 'http://localhost:5310/harness.html',
    reuseExistingServer: true,
    timeout: 60_000,
  },
  use: {
    baseURL: 'http://localhost:5310',
    colorScheme: 'dark',
    // Mata animação CSS. NÃO mata a do recharts, que é JS (react-smooth) — essa
    // é estabilizada por polling no próprio spec.
    reducedMotion: 'reduce',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    deviceScaleFactor: 2,
  },
  projects: [
    { name: 'desktop-1440', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'laptop-1024', use: { viewport: { width: 1024, height: 768 } } },
  ],
});
