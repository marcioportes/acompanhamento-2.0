import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { TELAS } from './telas.js';

/** Mesma âncora da fixture. Sem travar, a Torre reclassifica a turma em 24h. */
const HOJE = '2026-09-03';
const DESTINO = process.env.SHOTS_DIR || '.screenshots';

/** Recharts anima por rAF (react-smooth): nem reducedMotion nem `animations:'disabled'` param. */
const esperarGraficoParar = async (page) => {
  if (!(await page.locator('.recharts-surface').count())) return;
  let anterior = null;
  for (let i = 0; i < 12; i += 1) {
    const atual = await page.locator('.recharts-surface path').first()
      .getAttribute('d').catch(() => null);
    if (atual && atual === anterior) return;
    anterior = atual;
    await page.waitForTimeout(250);
  }
};

test.describe('telas do mentor', () => {
  for (const tela of TELAS) {
    test(tela.id, async ({ page }, info) => {
      const problemas = [];
      page.on('pageerror', (e) => problemas.push(`pageerror: ${e.message}`));
      page.on('console', (m) => { if (m.type() === 'error') problemas.push(`console: ${m.text()}`); });

      await page.clock.setFixedTime(new Date(`${HOJE}T14:00:00-03:00`));

      const q = new URLSearchParams({ cenario: tela.cenario, hoje: HOJE });
      if (tela.latencia) q.set('latencia', String(tela.latencia));
      if (tela.papel) q.set('papel', tela.papel);
      await page.goto(`/harness.html?${q}`);

      if (!tela.semEspera) {
        await page.waitForFunction(() => window.__HARNESS_READY__, { timeout: 20_000 });
      }

      // O aluno é recebido por um modal bloqueante de pendências. Fotografá-lo é
      // uma tela; passar por ele é pré-requisito de todas as outras do lado dele.
      if (tela.fecharPendencias) {
        await page.locator('[data-fechar-pendencias]').last().click().catch(() => {});
        await page.waitForTimeout(300);
      }

      if (tela.aba) await page.click(`[data-tab="${tela.aba}"]`);
      if (tela.menu) await page.click(`[data-view="${tela.menu}"]`);
      if (tela.visao) await page.click(`[data-visao="${tela.visao}"]`);
      if (tela.cliqueLinhaAluno) {
        await page.locator('tbody tr').first().click().catch(() => {});
      }

      await page.waitForTimeout(tela.semEspera ? 300 : 1200);
      await esperarGraficoParar(page);

      const dir = path.join(DESTINO, info.project.name);
      fs.mkdirSync(dir, { recursive: true });
      await page.screenshot({
        path: path.join(dir, `${tela.id}.png`),
        fullPage: !tela.semEspera,
        animations: 'disabled',
      });

      // O screenshot é o produto; o erro de console é o alarme. Um não substitui
      // o outro — a tela do #421 tinha erro no console e ninguém tinha olhado.
      const graves = problemas.filter((p) => !/ResizeObserver|Download the React/.test(p));
      expect(graves, `erros na tela "${tela.id}":\n${graves.join('\n')}`).toEqual([]);
    });
  }
});
