/**
 * studentDashboardPlanGating.test.js — invariante de IA (issue #289 Fase 1).
 *
 * Regra: análises que somam `trade.result` / são relativas ao plano só renderizam
 * com plano selecionado (`planSelected = selectedPlanId != null`). Em escopo
 * multi-conta a soma cross-currency é inválida; gate por plano garante moeda única.
 * A Curva de Patrimônio (EquityCurve) é nível-conta (abas por moeda própria) e
 * NUNCA pode ser gated — fica sempre visível.
 *
 * Cerca de fonte (estilo studentDashboardReferences.test.js): barata, sem mount,
 * guarda a regra enquanto não há teste de render page-level.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STUDENT_DASHBOARD = path.resolve(
  __dirname,
  '../../pages/StudentDashboard.jsx',
);

describe('StudentDashboard.jsx — gate de análises por plano (#289)', () => {
  const src = fs.readFileSync(STUDENT_DASHBOARD, 'utf8');

  it('declara o booleano planSelected derivado de selectedPlanId', () => {
    expect(/const planSelected = selectedPlanId != null/.test(src)).toBe(true);
  });

  it('gateia MetricsCards, EmotionAnalysis, TradingCalendar e a linha SWOT/Setup por planSelected', () => {
    // cada analytic que soma result / é relativo ao plano aparece sob planSelected &&
    expect(/planSelected && \(\s*<MetricsCards/.test(src)).toBe(true);
    expect(/planSelected && \(\s*<div[^>]*>\s*<EmotionAnalysis/.test(src)).toBe(true);
    expect(/planSelected && \(\s*<div className="lg:col-span-1">\s*<TradingCalendar/.test(src)).toBe(true);
    // Fase 2: SWOT e Setup vivem juntos numa linha grid gated por plano
    expect(/planSelected && \(\s*<div className="grid[^"]*">\s*<SwotAnalysis/.test(src)).toBe(true);
    expect(/<SetupAnalysis/.test(src)).toBe(true);
  });

  it('SWOT recebe a review do ciclo (cycleReview) e a Maturidade segue o ciclo (#289 Fase 2)', () => {
    // SWOT consome a review elevada (filtrada por cycleKey), não fetch próprio
    expect(/<SwotAnalysis\s+review=\{cycleReview\}/.test(src)).toBe(true);
    // Maturidade exibida = frozen (ciclo passado) vs viva (ciclo ativo)
    expect(/const displayMaturity = isPastCycle/.test(src)).toBe(true);
    expect(/maturity=\{displayMaturity\}/.test(src)).toBe(true);
  });

  it('NÃO gateia a Curva de Patrimônio (EquityCurve sempre visível)', () => {
    // a coluna da curva reflui para full-width quando sem plano, mas a div
    // sempre renderiza (não há guard planSelected envolvendo a coluna). O
    // ternário de col-span é a prova de que a curva aparece nos dois estados.
    expect(/planSelected \? 'lg:col-span-2' : 'lg:col-span-3'/.test(src)).toBe(true);
    // EquityCurve permanece sob o guard de dados, não sob o de plano
    expect(/filteredTrades\.length > 0 \? \(\s*<EquityCurve/.test(src)).toBe(true);
  });

  it('mostra CTA de seleção de plano quando sem plano', () => {
    expect(/!planSelected && \(/.test(src)).toBe(true);
    expect(/Selecione um plano para ver as an[áa]lises/.test(src)).toBe(true);
  });
});
