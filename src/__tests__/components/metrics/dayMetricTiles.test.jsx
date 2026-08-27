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
  tradePositionInPeriod,
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

  it('diz quantas operações o plano comporta — 1,99 conta como 2', () => {
    const c = dayBudgetContent(buildPeriodState([A], PLANO), 'BRL');
    expect(c.caption).toContain('2 operações por período');
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

  it('não avisa quando naive e offset resolvem para o mesmo fuso', () => {
    // O dia do incidente: A naive em B3, B com offset −03:00. Mesmo fuso.
    expect(dayOrderingNotice(buildPeriodState([B, A], PLANO))).toBeNull();
  });

  it('avisa quando os fusos RESOLVIDOS divergem', () => {
    const nyse = { id: 'us', date: '2026-08-25', entryTime: '2026-08-25T10:00:00', exchange: 'NYSE', result: -10 };
    const n = dayOrderingNotice(buildPeriodState([A, nyse], PLANO));
    expect(n.text).toContain('fusos diferentes');
  });
});

describe('authorizationNotice — o fato ATÔMICO, no painel do trade', () => {
  const ps = buildPeriodState([B, A], PLANO);

  it('operação autorizada não gera acusação nenhuma', () => {
    expect(authorizationNotice(ps.rows[0], ps, 'BRL')).toBeNull();
  });

  it('R$ 251 para um RO de R$ 252 não gera aviso — é manejo', () => {
    expect(authorizationNotice(ps.rows[1], ps, 'BRL')).toBeNull();
  });

  it('mas orçamento realmente insuficiente gera AVISO factual, com os dois números', () => {
    const apertado = buildPeriodState([t('a', '09:00:00', -260), t('b', '10:00:00', -50)], PLANO);
    const n = authorizationNotice(apertado.rows[1], apertado, 'BRL');
    expect(n.tone).toBe('warn');
    expect(n.title).toBe('Aberta sem orçamento');
    expect(n.detail).toContain('241'); // folga que restava
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

describe('tradePositionInPeriod — situar a operação no dia, sem virar painel do dia', () => {
  const ps = buildPeriodState([B, A], PLANO); // A 10:51 (−250), B 11:34 (−265)

  it('a 1ª operação: posição, folga na abertura e onde o dia terminou', () => {
    const r = tradePositionInPeriod(ps.rows[0], ps, 'BRL');
    expect(r.text).toContain('1ª das 2 operações do dia');
    expect(r.text).toContain('limite do dia inteiro');
    expect(r.text).toContain('501');
    expect(r.text).toContain('515'); // onde o dia fechou
    expect(r.text).toContain('14');  // além do stop
  });

  it('a 2ª: quanto o dia já acumulava e quanta folga restava quando ela abriu', () => {
    const r = tradePositionInPeriod(ps.rows[1], ps, 'BRL');
    expect(r.text).toContain('2ª e última das 2 operações do dia');
    expect(r.text).toContain('250'); // o dia estava em −250
    expect(r.text).toContain('251'); // folga restante
  });

  it('dia de uma operação só NÃO repete o resultado do próprio trade', () => {
    // 71% dos dias da base. O card antigo dizia "Resultado do período: −R$250 · 1 trade"
    // logo acima do painel daquele mesmo trade.
    const sozinho = buildPeriodState([A], PLANO);
    const r = tradePositionInPeriod(sozinho.rows[0], sozinho, 'BRL');
    expect(r.text).toContain('Única operação do dia');
    expect(r.text).toContain('501');
    expect(r.text).not.toContain('fechou');
  });

  it('ordem inferida NÃO afirma posição', () => {
    const semHora = { id: 'z', date: '2026-08-25', result: -10, exchange: 'B3' };
    const duvidoso = buildPeriodState([t('a', '09:00:00', -10), semHora], PLANO);
    const r = tradePositionInPeriod(duvidoso.rows[0], duvidoso, 'BRL');
    expect(r.text).toContain('Uma das 2 operações do dia');
    expect(r.text).toContain('sequência foi inferida');
    expect(r.text).not.toMatch(/\d+ª/);
  });

  it('o dia do incidente afirma a sequência — naive e offset no mesmo fuso', () => {
    expect(ps.ordering.reliable).toBe(true);
    expect(tradePositionInPeriod(ps.rows[0], ps, 'BRL').text).toContain('1ª das 2');
  });

  it('semana usa o vocabulário do período', () => {
    const semanal = buildPeriodState([t('a', '09:00:00', -100), t('b', '10:00:00', -50)], { ...PLANO, operationPeriod: 'Semanal' });
    const r = tradePositionInPeriod(semanal.rows[0], semanal, 'BRL');
    expect(r.text).toContain('operações da semana');
  });

  it('sem período ou sem linha não inventa nada', () => {
    expect(tradePositionInPeriod(null, null)).toBeNull();
    expect(tradePositionInPeriod(null, buildPeriodState([], PLANO))).toBeNull();
  });

  it('o tooltip avisa que a posição é transitória e que a Revisão é o registro definitivo', () => {
    const r = tradePositionInPeriod(ps.rows[0], ps, 'BRL');
    expect(r.tooltip).toContain('Revisão');
  });
});
