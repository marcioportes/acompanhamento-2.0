/**
 * Guarda de legibilidade de controle de formulário (issue #434).
 *
 * O #428 mandou para produção dois selects cujo texto não cabia na caixa: altura
 * fixa de 32px contra `py-3` (12+12) herdado de `index.css` deixa 8px de conteúdo
 * para uma linha de 19,5px. Build verde, lint limpo, 2.000 testes passando — e o
 * aluno via um traço no lugar do filtro. Nenhum teste de unidade pega isso: jsdom
 * não faz layout, então a única régua honesta é a tela renderizada.
 *
 * O teste é geométrico e vale para qualquer controle: se a caixa de conteúdo é
 * menor que a linha de texto, o texto está cortado. Roda sobre o harness do #427.
 */
import { test, expect } from '@playwright/test';
import { TELAS } from './telas.js';

const HOJE = '2026-09-03';

/** Sobra de 1px absorve arredondamento de subpixel; abaixo disso o glifo corta. */
const FOLGA = 1;

const medirControles = (page) => page.evaluate(() => {
  // `index.css` aplica `py-3` a input/textarea/select — são esses que a altura fixa
  // corta. Elemento com filho é container: o texto que aparece é do filho, e medir
  // a line-height do pai acusa o que está certo (foi o falso positivo da 1a rodada).
  const alvos = [...document.querySelectorAll('select, textarea, input[type="text"], input:not([type]), button, a')];
  return alvos
    .filter((el) => el.offsetParent !== null)
    .filter((el) => ['select', 'input', 'textarea'].includes(el.tagName.toLowerCase()) || el.childElementCount === 0)
    .filter((el) => el.textContent?.trim() || el.value || el.placeholder)
    .map((el) => {
      const cs = getComputedStyle(el);
      const alturaLinha = cs.lineHeight === 'normal'
        ? parseFloat(cs.fontSize) * 1.2
        : parseFloat(cs.lineHeight);
      const caixaConteudo = el.getBoundingClientRect().height
        - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
        - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth);
      return {
        tag: el.tagName.toLowerCase(),
        rotulo: (el.textContent?.trim() || el.value || el.placeholder || '').slice(0, 40),
        classe: el.className?.toString().slice(0, 60),
        caixaConteudo: Math.round(caixaConteudo * 10) / 10,
        alturaLinha: Math.round(alturaLinha * 10) / 10,
      };
    });
});

// Telas com controle de formulário visível. Não é a lista inteira de propósito:
// a foto de cada tela já é conferida em screenshots.spec.js.
const COM_FILTRO = TELAS.filter((t) => ['aluno-feedback', 'aguardando-feedback', 'fila-de-revisao'].includes(t.id));

test.describe('texto cabe no controle', () => {
  for (const tela of COM_FILTRO) {
    test(tela.id, async ({ page }) => {
      await page.clock.setFixedTime(new Date(`${HOJE}T14:00:00-03:00`));
      const q = new URLSearchParams({ cenario: tela.cenario, hoje: HOJE });
      if (tela.papel) q.set('papel', tela.papel);
      await page.goto(`/harness.html?${q}`);
      await page.waitForFunction(() => window.__HARNESS_READY__, { timeout: 20_000 });
      if (tela.fecharPendencias) {
        await page.locator('[data-fechar-pendencias]').last().click().catch(() => {});
        await page.waitForTimeout(300);
      }
      if (tela.aba) await page.click(`[data-tab="${tela.aba}"]`);
      if (tela.menu) await page.click(`[data-view="${tela.menu}"]`);
      await page.waitForTimeout(500);

      // Sem asserção de "achou N controles": tela pode legitimamente não ter campo
      // de formulário, e o clique em [data-tab]/[data-view] acima já explode se a
      // navegação mudar de nome — a garantia de estar na tela certa é aquela.
      const controles = await medirControles(page);
      const cortados = controles.filter((c) => c.caixaConteudo + FOLGA < c.alturaLinha);
      expect(cortados, `texto cortado em ${cortados.length} controle(s):\n${JSON.stringify(cortados, null, 2)}`).toEqual([]);
    });
  }
});
