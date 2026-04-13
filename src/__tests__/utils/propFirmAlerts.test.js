/**
 * propFirmAlerts — Testes
 * @description Testes para derivePropAlerts e getDangerAlerts.
 *   Cobre os 3 níveis de alertas com cenários reais de templates Apex/Ylos.
 *
 * Ref: issue #134 Fase B, epic #52
 */

import { describe, it, expect } from 'vitest';
import { derivePropAlerts, getDangerAlerts } from '../../utils/propFirmAlerts';

const fmt = (v) => `$${typeof v === 'number' ? v.toFixed(2) : v}`;

describe('derivePropAlerts — DANGER', () => {
  it('ACCOUNT_BUST gera danger', () => {
    const alerts = derivePropAlerts({ flags: ['ACCOUNT_BUST'], fmt });
    expect(alerts[0].level).toBe('danger');
    expect(alerts[0].text).toContain('eliminada');
  });

  it('DD_NEAR flag gera danger com percentual', () => {
    const alerts = derivePropAlerts({
      flags: ['DD_NEAR'],
      distanceToDD: 0.15,
      currentBalance: 48750,
      currentDrawdownThreshold: 47500,
      fmt,
    });
    expect(alerts[0].level).toBe('danger');
    expect(alerts[0].text).toContain('85%'); // (1-0.15)*100
  });

  it('distanceToDD < 0.20 gera danger mesmo sem flag', () => {
    const alerts = derivePropAlerts({ distanceToDD: 0.10, fmt });
    expect(alerts[0].level).toBe('danger');
  });

  it('isDayPaused gera danger', () => {
    const alerts = derivePropAlerts({ isDayPaused: true, dailyPnL: -1000, fmt });
    const pause = alerts.find(a => a.text.includes('pausado'));
    expect(pause).toBeDefined();
    expect(pause.level).toBe('danger');
  });

  it('ACCOUNT_BUST + isDayPaused = 2 dangers', () => {
    const alerts = derivePropAlerts({
      flags: ['ACCOUNT_BUST'],
      isDayPaused: true,
      dailyPnL: -1000,
      fmt,
    });
    const dangers = alerts.filter(a => a.level === 'danger');
    expect(dangers.length).toBe(2);
  });

  it('distanceToDD >= 0.20 NÃO gera DD danger', () => {
    const alerts = derivePropAlerts({ distanceToDD: 0.50, fmt });
    const ddAlerts = alerts.filter(a => a.level === 'danger');
    expect(ddAlerts.length).toBe(0);
  });
});

describe('derivePropAlerts — WARNING', () => {
  it('W1: consistency prestes a violar — melhor dia > 40% do target', () => {
    const alerts = derivePropAlerts({
      bestDayProfit: 1300,
      profitTarget: 3000,
      consistencyRule: 0.50,
      fmt,
    });
    const w = alerts.find(a => a.level === 'warning' && a.text.includes('Consistency'));
    expect(w).toBeDefined();
    expect(w.text).toContain('43%'); // 1300/3000 = 43%
    expect(w.text).toContain('50%');
  });

  it('W1: melhor dia <= 40% do target = SEM warning', () => {
    const alerts = derivePropAlerts({
      bestDayProfit: 1000,
      profitTarget: 3000,
      consistencyRule: 0.50,
      fmt,
    });
    const w = alerts.find(a => a.text?.includes('Consistency'));
    expect(w).toBeUndefined();
  });

  it('W2: eval deadline < 7 dias com profit < 50%', () => {
    const alerts = derivePropAlerts({
      evalDaysRemaining: 5,
      profitTarget: 3000,
      currentProfit: 800,
      profitRatio: 800 / 3000, // ~27%
      fmt,
    });
    const w = alerts.find(a => a.level === 'warning' && a.text.includes('dias restantes'));
    expect(w).toBeDefined();
    expect(w.text).toContain('27%');
  });

  it('W2: eval deadline < 7 dias mas profit >= 50% → warning sem urgência extra', () => {
    const alerts = derivePropAlerts({
      evalDaysRemaining: 5,
      profitTarget: 3000,
      currentProfit: 2000,
      profitRatio: 2000 / 3000, // ~67%
      fmt,
    });
    const w = alerts.find(a => a.level === 'warning' && a.text.includes('dias restantes'));
    expect(w).toBeDefined();
    expect(w.text).not.toContain('apenas');
  });

  it('W2: eval deadline > 7 dias = SEM warning de deadline', () => {
    const alerts = derivePropAlerts({
      evalDaysRemaining: 15,
      profitTarget: 3000,
      currentProfit: 500,
      profitRatio: 500 / 3000,
      fmt,
    });
    const w = alerts.find(a => a.level === 'warning' && a.text?.includes('dias restantes'));
    expect(w).toBeUndefined();
  });

  it('W2: target atingido = SEM warning de deadline', () => {
    const alerts = derivePropAlerts({
      evalDaysRemaining: 3,
      profitTarget: 3000,
      currentProfit: 3500,
      profitRatio: 3500 / 3000,
      fmt,
    });
    const w = alerts.find(a => a.level === 'warning' && a.text?.includes('dias restantes'));
    expect(w).toBeUndefined();
  });
});

describe('derivePropAlerts — INFO', () => {
  it('I1: perto do target (80-99%)', () => {
    const alerts = derivePropAlerts({ profitRatio: 0.85, profitTarget: 3000, currentProfit: 2550, fmt });
    const info = alerts.find(a => a.level === 'info' && a.text.includes('target'));
    expect(info).toBeDefined();
    expect(info.text).toContain('85%');
  });

  it('I1: NÃO gera se conta bust', () => {
    const alerts = derivePropAlerts({
      profitRatio: 0.85,
      flags: ['ACCOUNT_BUST'],
      fmt,
    });
    const info = alerts.find(a => a.level === 'info' && a.text?.includes('target'));
    expect(info).toBeUndefined();
  });

  it('I2: eval countdown contextual (> 7 dias)', () => {
    const alerts = derivePropAlerts({
      evalDaysRemaining: 18,
      profitTarget: 3000,
      currentProfit: 1200,
      fmt,
    });
    const info = alerts.find(a => a.level === 'info' && a.text.includes('18 dias'));
    expect(info).toBeDefined();
  });

  it('I2: NÃO gera quando target atingido', () => {
    const alerts = derivePropAlerts({
      evalDaysRemaining: 18,
      profitTarget: 3000,
      currentProfit: 3200,
      fmt,
    });
    const info = alerts.find(a => a.level === 'info' && a.text?.includes('18 dias'));
    expect(info).toBeUndefined();
  });

  it('I3: lock ativado mostra valor', () => {
    const alerts = derivePropAlerts({ lockLevel: 50000, fmt });
    const info = alerts.find(a => a.text.includes('Lock'));
    expect(info).toBeDefined();
    expect(info.text).toContain('$50000');
  });

  it('I4: trail congelado', () => {
    const alerts = derivePropAlerts({ trailFrozen: true, fmt });
    const info = alerts.find(a => a.text.includes('Trail congelado'));
    expect(info).toBeDefined();
    expect(info.text).toContain('TRAILING_TO_STATIC');
  });
});

describe('derivePropAlerts — cenários reais de templates', () => {
  it('Apex EOD 50K — DD_NEAR + daily loss pausado', () => {
    const alerts = derivePropAlerts({
      flags: ['DD_NEAR', 'DAILY_LOSS_HIT'],
      distanceToDD: 0.12,
      isDayPaused: true,
      dailyPnL: -1000,
      currentBalance: 47800,
      currentDrawdownThreshold: 47500,
      profitTarget: 3000,
      currentProfit: -2200,
      profitRatio: 0,
      bestDayProfit: 500,
      consistencyRule: 0.50,
      fmt,
    });
    const dangers = alerts.filter(a => a.level === 'danger');
    expect(dangers.length).toBe(2); // DD_NEAR + daily loss
  });

  it('Apex EOD 25K eval — 5 dias restantes, 30% do profit, consistency OK', () => {
    const alerts = derivePropAlerts({
      distanceToDD: 0.60,
      evalDaysRemaining: 5,
      profitTarget: 1500,
      currentProfit: 450,
      profitRatio: 0.30,
      bestDayProfit: 300,
      consistencyRule: 0.50,
      fmt,
    });
    const warnings = alerts.filter(a => a.level === 'warning');
    expect(warnings.length).toBe(1); // deadline + profit < 50%
    expect(warnings[0].text).toContain('apenas 30%');
  });

  it('Ylos 25K — trail frozen + 90% target + lock', () => {
    const alerts = derivePropAlerts({
      trailFrozen: true,
      lockLevel: 25000,
      profitRatio: 0.90,
      profitTarget: 1500,
      currentProfit: 1350,
      distanceToDD: 0.70,
      fmt,
    });
    const infos = alerts.filter(a => a.level === 'info');
    expect(infos.length).toBe(3); // perto do target + lock + trail
  });

  it('Conta saudável — zero alertas', () => {
    const alerts = derivePropAlerts({
      distanceToDD: 0.80,
      profitRatio: 0.50,
      profitTarget: 3000,
      currentProfit: 1500,
      evalDaysRemaining: 20,
      bestDayProfit: 400,
      consistencyRule: 0.50,
      fmt,
    });
    // Apenas info nudge "Faltam 20 dias e $1500"
    expect(alerts.filter(a => a.level === 'danger').length).toBe(0);
    expect(alerts.filter(a => a.level === 'warning').length).toBe(0);
  });
});

describe('getDangerAlerts', () => {
  it('filtra apenas dangers', () => {
    const alerts = [
      { level: 'danger', text: 'bust' },
      { level: 'warning', text: 'consistency' },
      { level: 'info', text: 'nudge' },
    ];
    const dangers = getDangerAlerts(alerts);
    expect(dangers).toHaveLength(1);
    expect(dangers[0].text).toBe('bust');
  });

  it('retorna vazio se nenhum danger', () => {
    const alerts = [{ level: 'info', text: 'ok' }];
    expect(getDangerAlerts(alerts)).toHaveLength(0);
  });
});
