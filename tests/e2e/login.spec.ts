/**
 * Testes E2E - Fluxo de Login
 */

import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('deve exibir página de login', async ({ page }) => {
    // Verificar elementos da página de login
    await expect(page.getByRole('heading', { name: /entrar|login|acompanhamento/i })).toBeVisible();
    await expect(page.getByPlaceholder(/email/i)).toBeVisible();
    await expect(page.getByPlaceholder(/senha/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /entrar|login/i })).toBeVisible();
  });

  test('deve mostrar erro para credenciais inválidas', async ({ page }) => {
    await page.getByPlaceholder(/email/i).fill('invalid@test.com');
    await page.getByPlaceholder(/senha/i).fill('wrongpassword');
    await page.getByRole('button', { name: /entrar|login/i }).click();
    
    // Aguardar mensagem de erro
    await expect(page.getByText(/erro|inválid|incorret/i)).toBeVisible({ timeout: 10000 });
  });

  test('deve validar campo de email vazio', async ({ page }) => {
    await page.getByPlaceholder(/senha/i).fill('somepassword');
    await page.getByRole('button', { name: /entrar|login/i }).click();
    
    // Campo email deve estar em estado de erro ou mensagem aparecer
    const emailInput = page.getByPlaceholder(/email/i);
    await expect(emailInput).toHaveAttribute('required');
  });
});

test.describe('Responsividade', () => {
  test('deve renderizar corretamente em mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await page.goto('/');
    
    // Verificar que a página carregou
    await expect(page.locator('body')).toBeVisible();
    
    // Screenshot para visual regression
    await expect(page).toHaveScreenshot('login-mobile.png', {
      maxDiffPixels: 100,
    });
  });

  test('deve renderizar corretamente em tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad
    await page.goto('/');
    
    await expect(page.locator('body')).toBeVisible();
    
    await expect(page).toHaveScreenshot('login-tablet.png', {
      maxDiffPixels: 100,
    });
  });

  test('deve renderizar corretamente em desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    
    await expect(page.locator('body')).toBeVisible();
    
    await expect(page).toHaveScreenshot('login-desktop.png', {
      maxDiffPixels: 100,
    });
  });
});
