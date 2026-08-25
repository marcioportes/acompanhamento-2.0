/**
 * #402 — SSoT de tiles do período. Testes afirmam sobre os OBJETOS retornados,
 * nunca sobre render — mesmo padrão de `cycleMetricTiles.test.jsx`.
 */
import { describe, it, expect } from 'vitest';
import {
  pctVsPlan,
  dayResultContent,
  dayBudgetContent,
  dayStopContent,
  dayGoalContent,
  dayOrderingNotice,
  authorizationNotice,
} from '../../../components/metrics/dayMetricTiles';
import { buildPeriodState } from '../../../utils/dayState';

const PLANO = { pl: 30000, riskPerOperation: 0.84, periodStop: 1.67, periodGoal: 3.35, operationPeriod: 'Diário' };

const A = { id: 'A', date: '2026-08-25', entryTime: '2026-08-25T10:51:01', exchange: 'B3', result: -250, qty: 5 };
const B = { id: 'B', date: '2026-08-25', entryTime: '2026-08-25T11:34:02-03:00', exchange: 'B3', result: -265, qty: 5 };

const t = (id, hora, result, qty = 1) => ({
  id, date: '2026-08-25', entryTime: `2026-08-25T${hora}-03:00`, exchange: 'B3', result, qty,
});

describe('pctVsPlan — precisão do display = precisão do limiar', () => {
  it('o caso que originou: 1,72% contra 1,67%, nunca 1,7%', () => {
    expect(pctVsPlan(1.7183333, 1.67)).toBe('1,72%');
  });

  it('limiar inteiro ainda usa 2 casas — nunca menos que centésimo', () => {
    expect(pctVsPlan(1.7183333, 2)).toBe('1,72%');
  });

  it('limiar com 3 casas leva 3', () => {
    expect(pctVsPlan(1.7183333, 1.675)).toBe('1,718%');
  });

  it('ausência não vira zero', () => {
    expect(pctVsPlan(null, 1.67)).toBe('—');
    expect(pctVsPlan(undefined, 1.67)).toBe('—');
  });
});

describe('dayResultContent — o líquido é a manchete', () => {
  const ps = buildPeriodState([B, A], PLANO);

  it('mostra o líquido do dia do incidente', () => {
    const c = dayResultContent(ps, 'BRL');
    expect(c.value).toContain('515');
    expect(c.theme.text).toBe('text-red-400');
    expect(c.caption).toContain('2 trades');
    expect(c.caption).toContain('10 contratos');
  });

  it('dia lucrativo com perdas grandes mostra o líquido, não o bruto', () => {
    const misto = buildPeriodState([t('a', '09:00:00', 1000), t('b', '10:00:00', -600)], PLANO);
    const c = dayResultContent(misto, 'BRL');
    expect(c.value).toContain('400');
    expect(c.theme.text).toBe('text-emerald-400');
    // o bruto continua legível, subordinado
    expect(c.caption).toContain('1.000');
    expect(c.caption).toContain('600');
  });

  it('dia sem operações não inventa número', () => {
    const c = dayResultContent(buildPeriodState([], PLANO));
    expect(c.isInsufficient).toBe(true);
    expect(c.value).toBe('Sem operações');
  });
});

describe('dayBudgetContent — folga do orçamento', () => {
  it('o dia do incidente esgotou o orçamento', () => {
    const c = dayBudgetContent(buildPeriodState([B, A], PLANO), 'BRL');
    expect(c.value).toContain('501');
    expect(c.bandLabel).toBe('Ultrapassado');
    expect(c.theme.text).toBe('text-red-400');
  });

  it('diz quantas operações o plano comporta', () => {
    const c = dayBudgetContent(buildPeriodState([A], PLANO), 'BRL');
    expect(c.caption).toContain('1 operação por período');
  });

  it('plano que não autoriza nenhuma operação se denuncia', () => {
    const ruim = { ...PLANO, riskPerOperation: 2.0 }; // RO 600 > stop 501
    const c = dayBudgetContent(buildPeriodState([t('a', '09:00:00', -50)], ruim), 'BRL');
    expect(c.caption).toContain('não autoriza nenhuma operação');
  });

  it('plano sem stop de período não finge ter um', () => {
    const c = dayBudgetContent(buildPeriodState([A], { ...PLANO, periodStop: 0 }));
    expect(c.isInsufficient).toBe(true);
  });
});

describe('dayStopContent', () => {
  it('dia dentro do limite', () => {
    const c = dayStopContent(buildPeriodState([t('a', '09:00:00', -100)], PLANO), 'BRL');
    expect(c.value).toBe('Não atingido');
    expect(c.theme.text).toBe('text-emerald-400');
  });

  it('o incidente: ultrapassado por R$ 14, e ninguém abriu depois', () => {
    const c = dayStopContent(buildPeriodState([B, A], PLANO), 'BRL');
    expect(c.value).toContain('Ultrapassado por');
    expect(c.value).toContain('14');
    expect(c.caption).toContain('nenhuma operação aberta depois');
    expect(c.theme.text).toBe('text-amber-400'); // âmbar, não vermelho: ninguém insistiu
  });

  it('abrir depois do stop é o que pinta vermelho', () => {
    const ps = buildPeriodState([
      t('a', '09:00:00', -300), t('b', '10:00:00', -250), t('c', '11:00:00', -100),
    ], PLANO);
    const c = dayStopContent(ps, 'BRL');
    expect(c.caption).toContain('1 operação aberta depois');
    expect(c.theme.text).toBe('text-red-400');
  });
});

describe('dayGoalContent', () => {
  it('meta atingida', () => {
    const c = dayGoalContent(buildPeriodState([t('a', '09:00:00', 600), t('b', '10:00:00', 500)], PLANO), 'BRL');
    expect(c.value).toBe('Atingida');
    expect(c.caption).toContain('2ª operação');
  });

  it('meta não atingida diz quanto faltava', () => {
    const c = dayGoalContent(buildPeriodState([t('a', '09:00:00', 100)], PLANO), 'BRL');
    expect(c.value).toBe('Não atingida');
    expect(c.caption).toContain('905'); // 1005 - 100
  });
});

describe('dayOrderingNotice — honestidade sobre a sequência', () => {
  it('não avisa nada quando a ordem é confiável', () => {
    expect(dayOrderingNotice(buildPeriodState([t('a', '09:00:00', -10), t('b', '10:00:00', -10)], PLANO))).toBeNull();
  });

  it('avisa quando falta horário de entrada', () => {
    const ps = buildPeriodState([t('a', '09:00:00', -10), { id: 'z', date: '2026-08-25', result: -10 }], PLANO);
    const n = dayOrderingNotice(ps);
    expect(n.text).toContain('inferida');
  });

  it('avisa quando o dia mistura fusos', () => {
    const n = dayOrderingNotice(buildPeriodState([B, A], PLANO));
    expect(n.text).toContain('fusos diferentes');
  });
});

describe('authorizationNotice — o fato ATÔMICO, no painel do trade', () => {
  const ps = buildPeriodState([B, A], PLANO);

  it('operação autorizada não gera acusação nenhuma', () => {
    expect(authorizationNotice(ps.rows[0], ps, 'BRL')).toBeNull();
  });

  it('operação sem folga gera AVISO factual, com os dois números', () => {
    const n = authorizationNotice(ps.rows[1], ps, 'BRL');
    expect(n.tone).toBe('warn');
    expect(n.title).toBe('Aberta sem orçamento');
    expect(n.detail).toContain('251'); // folga que restava
    expect(n.detail).toContain('252'); // RO autorizado
  });

  it('operação após o stop gera alerta', () => {
    const depois = buildPeriodState([
      t('a', '09:00:00', -300), t('b', '10:00:00', -250), t('c', '11:00:00', -100),
    ], PLANO);
    const n = authorizationNotice(depois.rows[2], depois, 'BRL');
    expect(n.tone).toBe('alert');
    expect(n.title).toContain('depois do stop');
  });

  it('sem linha ou sem período não explode', () => {
    expect(authorizationNotice(null, ps)).toBeNull();
    expect(authorizationNotice(ps.rows[0], null)).toBeNull();
  });
});
