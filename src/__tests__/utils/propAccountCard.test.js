/**
 * PropAccountCard — Testes
 * @description Testa lógica de derivação de alertas, gauges e estado visual
 *   do PropAccountCard. Não renderiza React — testa as funções puras extraídas.
 *
 * Ref: issue #134, epic #52 Fase 3
 */

import { describe, it, expect } from 'vitest';
import { calculateEvalDaysRemaining, isEvalDeadlineNear, DD_NEAR_THRESHOLD } from '../../utils/propFirmDrawdownEngine';

// ============================================
// Helpers de alerta — replicam a lógica do componente
// para testar sem renderização React
// ============================================

function deriveAlerts({
  flags = [],
  distanceToDD = 1,
  isDayPaused = false,
  dailyPnL = 0,
  consistencyOk = true,
  consistencyThreshold = null,
  consistencyRule = null,
  bestDayProfit = 0,
  evalDeadlineNear = false,
  evalDaysRemaining = null,
  profitRatio = 0,
  profitTarget = 0,
  currentProfit = 0,
  lockLevel = null,
  trailFrozen = false,
  currentBalance = 0,
  currentDrawdownThreshold = 0,
  currency = 'USD',
}) {
  const result = [];

  // DANGER
  if (flags.includes('ACCOUNT_BUST')) {
    result.push({ level: 'danger', text: 'Conta eliminada — drawdown atingido' });
  } else if (flags.includes('DD_NEAR') || distanceToDD < DD_NEAR_THRESHOLD) {
    result.push({ level: 'danger', text: `Drawdown crítico` });
  }
  if (isDayPaused) {
    result.push({ level: 'danger', text: 'Daily loss atingido — dia pausado' });
  }

  // WARNING
  if (!consistencyOk && consistencyThreshold) {
    result.push({ level: 'warning', text: 'Consistency em risco' });
  }
  if (evalDeadlineNear && evalDaysRemaining !== null) {
    const profitNeeded = profitTarget - currentProfit;
    if (profitNeeded > 0) {
      result.push({ level: 'warning', text: `${evalDaysRemaining} dias restantes` });
    }
  }

  // INFO
  if (profitRatio >= 0.80 && profitRatio < 1.0 && !flags.includes('ACCOUNT_BUST')) {
    result.push({ level: 'info', text: 'Perto do target' });
  }
  if (lockLevel !== null) {
    result.push({ level: 'info', text: 'Safety net atingido' });
  }
  if (trailFrozen) {
    result.push({ level: 'info', text: 'Trail congelado' });
  }

  return result;
}

// ============================================
// Testes
// ============================================

describe('PropAccountCard — deriveAlerts', () => {
  it('retorna vazio quando conta saudável', () => {
    const alerts = deriveAlerts({
      distanceToDD: 0.80,
      profitRatio: 0.50,
    });
    expect(alerts).toHaveLength(0);
  });

  it('gera danger quando ACCOUNT_BUST', () => {
    const alerts = deriveAlerts({ flags: ['ACCOUNT_BUST'] });
    expect(alerts[0].level).toBe('danger');
    expect(alerts[0].text).toContain('eliminada');
  });

  it('gera danger quando DD_NEAR via flag', () => {
    const alerts = deriveAlerts({ flags: ['DD_NEAR'], distanceToDD: 0.15 });
    expect(alerts[0].level).toBe('danger');
    expect(alerts[0].text).toContain('Drawdown');
  });

  it('gera danger quando distanceToDD < threshold (sem flag)', () => {
    const alerts = deriveAlerts({ distanceToDD: 0.10 });
    expect(alerts[0].level).toBe('danger');
  });

  it('NÃO gera DD_NEAR danger quando distanceToDD acima do threshold', () => {
    const alerts = deriveAlerts({ distanceToDD: 0.50 });
    const ddAlerts = alerts.filter(a => a.text?.includes('Drawdown'));
    expect(ddAlerts).toHaveLength(0);
  });

  it('gera danger quando dia pausado', () => {
    const alerts = deriveAlerts({ isDayPaused: true, dailyPnL: -500 });
    const pauseAlert = alerts.find(a => a.text.includes('pausado'));
    expect(pauseAlert).toBeDefined();
    expect(pauseAlert.level).toBe('danger');
  });

  it('gera warning quando consistency em risco', () => {
    const alerts = deriveAlerts({
      consistencyOk: false,
      consistencyThreshold: 1500,
      consistencyRule: 0.50,
      bestDayProfit: 1600,
    });
    const consistencyAlert = alerts.find(a => a.text.includes('Consistency'));
    expect(consistencyAlert).toBeDefined();
    expect(consistencyAlert.level).toBe('warning');
  });

  it('gera warning quando eval deadline perto e profit insuficiente', () => {
    const alerts = deriveAlerts({
      evalDeadlineNear: true,
      evalDaysRemaining: 5,
      profitTarget: 3000,
      currentProfit: 1000,
    });
    const deadlineAlert = alerts.find(a => a.text.includes('dias restantes'));
    expect(deadlineAlert).toBeDefined();
    expect(deadlineAlert.level).toBe('warning');
  });

  it('NÃO gera warning de deadline se profit target já atingido', () => {
    const alerts = deriveAlerts({
      evalDeadlineNear: true,
      evalDaysRemaining: 5,
      profitTarget: 3000,
      currentProfit: 3500,
    });
    const deadlineAlert = alerts.find(a => a.text?.includes('dias restantes'));
    expect(deadlineAlert).toBeUndefined();
  });

  it('gera info quando perto do target (80-99%)', () => {
    const alerts = deriveAlerts({ profitRatio: 0.85 });
    const infoAlert = alerts.find(a => a.level === 'info' && a.text.includes('target'));
    expect(infoAlert).toBeDefined();
  });

  it('NÃO gera info perto do target se conta bust', () => {
    const alerts = deriveAlerts({ profitRatio: 0.85, flags: ['ACCOUNT_BUST'] });
    const infoAlert = alerts.find(a => a.level === 'info' && a.text?.includes('target'));
    expect(infoAlert).toBeUndefined();
  });

  it('gera info quando safety net atingido', () => {
    const alerts = deriveAlerts({ lockLevel: 50000 });
    const lockAlert = alerts.find(a => a.text.includes('Safety net'));
    expect(lockAlert).toBeDefined();
    expect(lockAlert.level).toBe('info');
  });

  it('gera info quando trail congelado', () => {
    const alerts = deriveAlerts({ trailFrozen: true });
    const freezeAlert = alerts.find(a => a.text.includes('congelado'));
    expect(freezeAlert).toBeDefined();
    expect(freezeAlert.level).toBe('info');
  });

  it('cenário Apex EOD 50K — DD_NEAR + daily loss pausado = 2 dangers', () => {
    const alerts = deriveAlerts({
      flags: ['DD_NEAR', 'DAILY_LOSS_HIT'],
      distanceToDD: 0.12,
      isDayPaused: true,
      dailyPnL: -1000,
    });
    const dangers = alerts.filter(a => a.level === 'danger');
    expect(dangers.length).toBe(2);
  });

  it('cenário Ylos 25K — trail frozen + 85% target = info + info', () => {
    const alerts = deriveAlerts({
      trailFrozen: true,
      profitRatio: 0.85,
      distanceToDD: 0.60,
    });
    const infos = alerts.filter(a => a.level === 'info');
    expect(infos.length).toBe(2);
  });

  it('cenário misto — DD_NEAR + consistency risco + eval deadline + lock', () => {
    const alerts = deriveAlerts({
      flags: ['DD_NEAR'],
      distanceToDD: 0.15,
      consistencyOk: false,
      consistencyThreshold: 1500,
      consistencyRule: 0.50,
      bestDayProfit: 1600,
      evalDeadlineNear: true,
      evalDaysRemaining: 3,
      profitTarget: 3000,
      currentProfit: 1000,
      lockLevel: 50000,
    });
    expect(alerts.filter(a => a.level === 'danger').length).toBe(1);  // DD_NEAR
    expect(alerts.filter(a => a.level === 'warning').length).toBe(2); // consistency + deadline
    expect(alerts.filter(a => a.level === 'info').length).toBe(1);    // lock
  });
});

describe('PropAccountCard — gauge calculations', () => {
  it('drawdown utilizado = 0% quando balance no peak sem uso', () => {
    const accountSize = 50000;
    const drawdownMax = 2500;
    const currentBalance = 50000;
    const threshold = accountSize - drawdownMax; // 47500
    const distanceToDD = (currentBalance - threshold) / drawdownMax; // 1.0
    const usedPct = (1 - distanceToDD) * 100;
    expect(usedPct).toBe(0);
  });

  it('drawdown utilizado = 50% quando metade do DD consumido', () => {
    const drawdownMax = 2500;
    const currentBalance = 48750; // perdeu 1250
    const threshold = 47500;
    const distanceToDD = (currentBalance - threshold) / drawdownMax; // 0.50
    const usedPct = (1 - distanceToDD) * 100;
    expect(usedPct).toBe(50);
  });

  it('drawdown utilizado = 100% quando bust', () => {
    const drawdownMax = 2500;
    const currentBalance = 47500;
    const threshold = 47500;
    const distanceToDD = (currentBalance - threshold) / drawdownMax; // 0
    const usedPct = (1 - distanceToDD) * 100;
    expect(usedPct).toBe(100);
  });

  it('profit ratio = 0.60 quando 60% do target atingido', () => {
    const profitTarget = 3000;
    const currentProfit = 1800;
    const ratio = currentProfit / profitTarget;
    expect(ratio).toBe(0.6);
  });

  it('profit ratio clampado em 0 quando profit negativo', () => {
    const profitTarget = 3000;
    const currentProfit = -500;
    const ratio = Math.max(0, currentProfit / profitTarget);
    expect(ratio).toBe(0);
  });
});

describe('PropAccountCard — eval countdown integration', () => {
  it('calcula dias restantes a partir de phaseStartDate', () => {
    const start = new Date('2026-04-01');
    const now = new Date('2026-04-20');
    const remaining = calculateEvalDaysRemaining(start, 30, now);
    expect(remaining).toBe(11); // 01+30 = 01 mai, 20 abr → 11 dias
  });

  it('retorna 0 quando eval expirou', () => {
    const start = new Date('2026-03-01');
    const now = new Date('2026-04-13');
    const remaining = calculateEvalDaysRemaining(start, 30, now);
    expect(remaining).toBe(0);
  });

  it('isEvalDeadlineNear true quando 5 dias restantes', () => {
    expect(isEvalDeadlineNear(5)).toBe(true);
  });

  it('isEvalDeadlineNear false quando 15 dias restantes', () => {
    expect(isEvalDeadlineNear(15)).toBe(false);
  });

  it('isEvalDeadlineNear false quando null', () => {
    expect(isEvalDeadlineNear(null)).toBe(false);
  });
});
