/**
 * #392 — quatro detectores que existiam só no motor morto, agora no servidor.
 *
 * Escritos em junho (#301) no lado ESM e nunca portados: o cabeçalho do arquivo do
 * servidor afirmava "mesma lógica", mas vieram 10 dos 15. Ficaram escritos, testados e
 * desligados — nunca marcaram um trade em produção.
 *
 * Marcio, 23/08/2026: "ninguém tá passando porque ninguém está acreditando no processo e
 * estou perdendo aluno. Implementa piramidação, pânico no stop, saída tardia e cluster de
 * ganância." FOMO na entrada ficou fora por decisão dele.
 *
 * Cada teste roda a mesma asserção com o trade em fusos distantes: as versões originais
 * comparavam hora de ordem (ingênua) com hora de trade (com offset) sem normalizar, que é
 * o bug que produziu a "Hesitação" fantasma (#388). Aqui isso nasce fechado.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const { analyzeShadowForTradeCF } = require_('../../../../functions/shadow/shadowDetectors');

const OFFSETS = ['-03:00', '-05:00', '+09:00'];
const codigos = (r) => (r?.patterns || []).map((p) => p.code);
const pattern = (r, code) => (r?.patterns || []).find((p) => p.code === code);

const trade = (off, over = {}) => ({
  id: 'T1', studentId: 'S1', side: 'LONG', qty: 10, ticker: 'WINV26', date: '2026-08-21',
  entry: 174000, exit: 173500, result: -500,
  entryTime: `2026-08-21T10:00:00${off}`, exitTime: `2026-08-21T11:00:00${off}`,
  ...over,
});

const entrada = (preco, hora) => ({
  side: 'BUY', status: 'FILLED', isStopOrder: false, filledPrice: preco,
  filledAt: `2026-08-21T${hora}`, submittedAt: `2026-08-21T${hora}`, quantity: 5,
});

describe('#392 — piramidação contra a posição', () => {
  it.each(OFFSETS)('detecta aumento em preço pior com trade em %s', (off) => {
    const orders = [entrada(174000, '10:00:00'), entrada(173800, '10:15:00'), entrada(173600, '10:30:00')];
    const r = analyzeShadowForTradeCF(trade(off), [], orders);
    const p = pattern(r, 'AVERAGING_DOWN');
    expect(p).toBeTruthy();
    expect(p.evidence.averagingCount).toBe(2);
    expect(p.emotionMapping).toBe('DENIAL');
  });

  it('aumentar a favor do movimento NÃO é piramidação', () => {
    const orders = [entrada(173600, '10:00:00'), entrada(173800, '10:15:00'), entrada(174000, '10:30:00')];
    expect(codigos(analyzeShadowForTradeCF(trade('-03:00'), [], orders))).not.toContain('AVERAGING_DOWN');
  });

  it('uma entrada só nunca é piramidação', () => {
    expect(codigos(analyzeShadowForTradeCF(trade('-03:00'), [], [entrada(174000, '10:00:00')])))
      .not.toContain('AVERAGING_DOWN');
  });
});

describe('#392 — pânico no stop', () => {
  const stopMexido = (hora) => ({
    side: 'SELL', status: 'CANCELLED', isStopOrder: true,
    cancelledAt: `2026-08-21T${hora}`, submittedAt: '2026-08-21T10:00:00',
  });

  it.each(OFFSETS)('mexeu no stop e saiu em 2min — trade em %s', (off) => {
    const t = trade(off, { exitTime: `2026-08-21T10:32:00${off}` });
    const r = analyzeShadowForTradeCF(t, [], [entrada(174000, '10:00:00'), stopMexido('10:30:00')]);
    const p = pattern(r, 'STOP_PANIC');
    expect(p).toBeTruthy();
    expect(p.evidence.exitAfterWidenMinutes).toBe(2);
    expect(p.emotionMapping).toBe('PANIC');
  });

  it('saiu 40min depois não é pânico', () => {
    const t = trade('-03:00', { exitTime: '2026-08-21T11:10:00-03:00' });
    expect(codigos(analyzeShadowForTradeCF(t, [], [entrada(174000, '10:00:00'), stopMexido('10:30:00')])))
      .not.toContain('STOP_PANIC');
  });
});

describe('#392 — saída tardia', () => {
  const stopCancelado = { side: 'SELL', status: 'CANCELLED', isStopOrder: true,
    cancelledAt: '2026-08-21T10:20:00', submittedAt: '2026-08-21T10:00:00' };

  it.each(OFFSETS)('cancelou o stop e segurou a perda 40min — trade em %s', (off) => {
    const r = analyzeShadowForTradeCF(trade(off), [], [entrada(174000, '10:00:00'), stopCancelado]);
    const p = pattern(r, 'LATE_EXIT');
    expect(p).toBeTruthy();
    expect(p.evidence.delayMinutes).toBe(40);
    expect(p.emotionMapping).toBe('HOPE');
  });

  it('trade em LUCRO não é saída tardia — o padrão é sobre segurar prejuízo', () => {
    const t = trade('-03:00', { result: 500, exit: 174500 });
    expect(codigos(analyzeShadowForTradeCF(t, [], [entrada(174000, '10:00:00'), stopCancelado])))
      .not.toContain('LATE_EXIT');
  });
});

describe('#392 — cluster de ganância', () => {
  const ganho = (id, hora) => ({
    id, studentId: 'S1', side: 'LONG', qty: 2, date: '2026-08-21', result: 200,
    entryTime: `2026-08-21T${hora}-03:00`, exitTime: `2026-08-21T${hora}-03:00`,
  });

  it('três entradas rápidas depois de ganhos seguidos', () => {
    const alvo = { ...ganho('T4', '10:08:00'), id: 'T1' };
    const vizinhos = [ganho('T2', '10:00:00'), ganho('T3', '10:04:00')];
    const p = pattern(analyzeShadowForTradeCF(alvo, vizinhos, []), 'GREED_CLUSTER');
    expect(p).toBeTruthy();
    expect(p.evidence.consecutiveWinsBefore).toBe(2);
    expect(p.emotionMapping).toBe('GREED');
  });

  it('sem ganho antes não há cluster de ganância', () => {
    const alvo = { ...ganho('T4', '10:08:00'), id: 'T1' };
    const perdas = [{ ...ganho('T2', '10:00:00'), result: -100 }, { ...ganho('T3', '10:04:00'), result: -80 }];
    expect(codigos(analyzeShadowForTradeCF(alvo, perdas, []))).not.toContain('GREED_CLUSTER');
  });
});

describe('#392 — FOMO na entrada ficou fora', () => {
  it('entrada a mercado não vira padrão (decisão de Marcio)', () => {
    const orders = [{ ...entrada(174000, '10:00:00'), orderType: 'MARKET', submittedAt: '2026-08-21T09:45:00' }];
    expect(codigos(analyzeShadowForTradeCF(trade('-03:00'), [], orders))).not.toContain('FOMO_ENTRY');
  });
});

/**
 * #392 — os três falsos positivos que a base real revelou antes de ligar.
 *
 * Rodar os detectores contra produção antes do merge marcou 6 trades. Conferidos um a um,
 * os três padrões eram falsos — inclusive no trade de +R$ 520 que custou o dia inteiro
 * para limpar. Cada guarda abaixo nasceu de um caso concreto.
 */
describe('#392 — guardas nascidas da base real', () => {
  const stop = (over) => ({ side: 'SELL', isStopOrder: true, submittedAt: '2026-08-21T11:25:15', ...over });

  it('bracket cancelado NO alvo não é pânico no stop', () => {
    // Trade WINV26 de 21/08, +R$ 520: as duas pernas morreram pelo OCO no instante da
    // saída. "Mexeu no stop e saiu em 0 minuto" era alvo atingido, não pânico.
    const t = trade('-03:00', { result: 520, exitTime: '2026-08-21T11:27:51-03:00' });
    const orders = [
      entrada(174050, '11:25:15'),
      stop({ status: 'CANCELLED', cancelledAt: '2026-08-21T11:27:51' }),
    ];
    expect(codigos(analyzeShadowForTradeCF(t, [], orders))).not.toContain('STOP_PANIC');
  });

  it('entradas da mesma leva não são piramidação', () => {
    // Mesmo trade: 174.050 e 174.010 com TRÊS SEGUNDOS de diferença. É entrada
    // escalonada; o mercado não foi contra — o trade fechou positivo.
    const t = trade('-03:00', { result: 520, exit: 174290 });
    const orders = [entrada(174050, '11:25:15'), entrada(174010, '11:25:18')];
    expect(codigos(analyzeShadowForTradeCF(t, [], orders))).not.toContain('AVERAGING_DOWN');
  });

  it('execução fora da vida da posição não conta', () => {
    // MYMM6 de 18/05: trade viveu 11:27→11:31 e havia uma execução às 12:26 amarrada nele
    // por erro de correlação. Aumentar posição só acontece com a posição aberta.
    const t = {
      id: 'T1', studentId: 'S1', side: 'LONG', qty: 1, date: '2026-05-18',
      entry: 49761, exit: 49748, result: -6.5,
      entryTime: '2026-05-18T11:27:02-04:00', exitTime: '2026-05-18T11:31:44-04:00',
    };
    const orders = [
      { side: 'BUY', status: 'FILLED', isStopOrder: false, filledPrice: 49761, filledAt: '2026-05-18T11:27:02', quantity: 1 },
      { side: 'BUY', status: 'FILLED', isStopOrder: false, filledPrice: 49549, filledAt: '2026-05-18T12:26:25', quantity: 1 },
    ];
    expect(codigos(analyzeShadowForTradeCF(t, [], orders))).not.toContain('AVERAGING_DOWN');
  });

  it('mas piramidação DE VERDADE segue sendo pega', () => {
    // Aumentos espaçados, com o preço indo contra, dentro da vida da posição.
    const t = trade('-03:00');
    const orders = [entrada(174000, '10:00:00'), entrada(173800, '10:15:00'), entrada(173600, '10:30:00')];
    const p = pattern(analyzeShadowForTradeCF(t, [], orders), 'AVERAGING_DOWN');
    expect(p).toBeTruthy();
    expect(p.evidence.averagingCount).toBe(2);
  });

  it('e pânico DE VERDADE segue sendo pego', () => {
    // Stop cancelado às 10:30, saída às 10:32 — dois minutos depois, não simultâneo.
    const t = trade('-03:00', { exitTime: '2026-08-21T10:32:00-03:00' });
    const orders = [entrada(174000, '10:00:00'), stop({ status: 'CANCELLED', cancelledAt: '2026-08-21T10:30:00' })];
    expect(codigos(analyzeShadowForTradeCF(t, [], orders))).toContain('STOP_PANIC');
  });
});
