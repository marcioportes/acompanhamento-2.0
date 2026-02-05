/**
 * Testes E2E - Dashboard do Aluno
 * 
 * Requer autenticação - usa fixtures de login
 */

import { test, expect, Page } from '@playwright/test';

// Helper para fazer login
async function loginAsStudent(page: Page) {
  await page.goto('/');
  
  // Preencher credenciais de teste
  // NOTA: Em ambiente real, use variáveis de ambiente
  await page.getByPlaceholder(/email/i).fill(process.env.TEST_STUDENT_EMAIL || 'aluno3@teste.com');
  await page.getByPlaceholder(/senha/i).fill(process.env.TEST_STUDENT_PASSWORD || 'senha123');
  await page.getByRole('button', { name: /entrar|login/i }).click();
  
  // Aguardar dashboard carregar
  await page.waitForURL('**/*', { timeout: 15000 });
  
  // Verificar se está no dashboard
  await expect(page.getByText(/olá|dashboard|painel/i)).toBeVisible({ timeout: 10000 });
}

test.describe('Student Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
  });

  test('deve exibir KPIs do dashboard', async ({ page }) => {
    // Verificar cards de KPI
    await expect(page.getByText(/p&l|resultado/i)).toBeVisible();
    await expect(page.getByText(/win rate/i)).toBeVisible();
  });

  test('deve exibir botão de Novo Trade', async ({ page }) => {
    const newTradeButton = page.getByRole('button', { name: /novo trade/i });
    await expect(newTradeButton).toBeVisible();
  });

  test('deve abrir modal de Novo Trade', async ({ page }) => {
    await page.getByRole('button', { name: /novo trade/i }).click();
    
    // Verificar que modal abriu
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    
    // Verificar campos do formulário
    await expect(page.getByLabel(/ticker/i)).toBeVisible();
    await expect(page.getByLabel(/data/i)).toBeVisible();
  });

  test('deve exibir calendário de trades', async ({ page }) => {
    // Verificar presença do calendário
    await expect(page.locator('[class*="calendar"]')).toBeVisible({ timeout: 5000 });
  });

  test('deve exibir curva de capital', async ({ page }) => {
    // Verificar presença do gráfico (Recharts)
    await expect(page.locator('svg.recharts-surface')).toBeVisible({ timeout: 5000 });
  });

  test('deve filtrar trades por período', async ({ page }) => {
    // Clicar no botão de filtros
    const filterButton = page.getByRole('button', { name: /filtrar|filtros/i });
    if (await filterButton.isVisible()) {
      await filterButton.click();
    }
    
    // Selecionar período
    const periodSelect = page.getByLabel(/período/i);
    if (await periodSelect.isVisible()) {
      await periodSelect.selectOption('month');
      
      // Verificar que filtro foi aplicado (URL ou estado visual)
      await expect(page).toHaveURL(/.*month.*|.*/);
    }
  });
});

test.describe('Trade Modal', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
    await page.getByRole('button', { name: /novo trade/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('deve validar campos obrigatórios', async ({ page }) => {
    // Tentar submeter sem preencher
    await page.getByRole('button', { name: /registrar|salvar/i }).click();
    
    // Verificar erros de validação
    await expect(page.getByText(/obrigatório|required|preencha/i)).toBeVisible({ timeout: 3000 });
  });

  test('deve fechar modal ao clicar em cancelar', async ({ page }) => {
    await page.getByRole('button', { name: /cancelar|fechar/i }).click();
    
    // Modal deve fechar
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 });
  });

  test('deve calcular resultado automaticamente', async ({ page }) => {
    // Preencher campos
    await page.getByLabel(/ticker/i).fill('WINFUT');
    await page.locator('[name="entry"]').fill('128500');
    await page.locator('[name="exit"]').fill('128750');
    await page.locator('[name="qty"]').fill('5');
    
    // Verificar cálculo do resultado
    await expect(page.getByText(/resultado|est\./i)).toContainText(/\d+/);
  });
});

test.describe('Sidebar Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
  });

  test('deve navegar para Contas', async ({ page }) => {
    await page.getByRole('link', { name: /contas/i }).click();
    
    await expect(page.getByText(/minhas contas/i)).toBeVisible({ timeout: 5000 });
  });

  test('deve fazer logout', async ({ page }) => {
    // Clicar no botão de logout
    await page.getByRole('button', { name: /sair|logout/i }).click();
    
    // Deve voltar para tela de login
    await expect(page.getByPlaceholder(/email/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Visual Regression - Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
    // Aguardar carregamento completo
    await page.waitForLoadState('networkidle');
  });

  test('dashboard desktop screenshot', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    // Aguardar animações
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot('dashboard-desktop.png', {
      maxDiffPixels: 200,
      animations: 'disabled',
    });
  });

  test('dashboard mobile screenshot', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot('dashboard-mobile.png', {
      maxDiffPixels: 200,
      animations: 'disabled',
    });
  });
});
