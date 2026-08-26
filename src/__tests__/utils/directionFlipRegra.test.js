/**
 * #402 — virada de mão: dois estados, não um gradiente.
 *
 * A regra antiga era uma escala inventada: qualquer inversão após loss dentro de
 * **2 horas**, com severidade caindo por faixa (≤15' HIGH, ≤60' MEDIUM, resto LOW).
 * Isso acusava releitura de mercado como se fosse reação — uma virada 97 minutos
 * depois, no mesmo instrumento, ainda contava como "narrativa quebrada".
 *
 * Regra de domínio (Marcio, 25/08/2026):
 *   - **desespero** — virou a mão em até **5 minutos** da saída. Não houve tempo
 *     de reler nada; é reação.
 *   - **perdido** — **duas ou mais inversões dentro de 30 minutos**. Comprou,
 *     vendeu em 10', comprou de novo em 23': a direção não para de mudar.
 *   - qualquer outra coisa não é sinal. Em meia hora dá para identificar que o
 *     mercado mudou.
 */
import { describe, it, expect } from 'vitest';
import { detectDirectionFlip } from '../../utils/shadowBehaviorAnalysis';

const t = (id, side, entrada, saida, result, extra = {}) => ({
  id,
  ticker: 'WINV26',
  side,
  result,
  date: '2026-08-25',
  entryTime: `2026-08-25T${entrada}-03:00`,
  exitTime: saida ? `2026-08-25T${saida}-03:00` : null,
  ...extra,
});

describe('desespero — inversão em até 5 minutos', () => {
  it('virou 1 minuto depois de sair no prejuízo', () => {
    const anterior = t('a', 'LONG', '10:00:00', '10:10:00', -250);
    const atual = t('b', 'SHORT', '10:11:00', '10:20:00', -100);
    const r = detectDirectionFlip(atual, [anterior]);
    expect(r).not.toBeNull();
    expect(r.severity).toBe('HIGH');
    expect(r.evidence.trigger).toBe('DESESPERO');
    expect(r.evidence.gapMinutes).toBe(1);
  });

  it('exatamente 5 minutos ainda é desespero', () => {
    const anterior = t('a', 'LONG', '10:00:00', '10:10:00', -250);
    const atual = t('b', 'SHORT', '10:15:00', '10:25:00', -100);
    expect(detectDirectionFlip(atual, [anterior])?.evidence.trigger).toBe('DESESPERO');
  });

  it('5 minutos e um segundo já não é', () => {
    const anterior = t('a', 'LONG', '10:00:00', '10:10:00', -250);
    const atual = t('b', 'SHORT', '10:15:01', '10:25:00', -100);
    expect(detectDirectionFlip(atual, [anterior])).toBeNull();
  });
});

describe('o caso real que originou — 32,7 minutos NÃO é sinal', () => {
  it('Marcio, 25/08: saiu 11:01:20 no SHORT, entrou 11:34:02 no LONG', () => {
    const anterior = {
      id: 'cUG60nG3TOcrC7d2Euwb', ticker: 'WINV26', side: 'SHORT', result: -250,
      date: '2026-08-25',
      entryTime: '2026-08-25T10:51:01-03:00', exitTime: '2026-08-25T11:01:20-03:00',
    };
    const atual = {
      id: 'TIvs3Vh4sEKUc1HYEd7p', ticker: 'WINV26', side: 'LONG', result: -265,
      date: '2026-08-25',
      entryTime: '2026-08-25T11:34:02-03:00', exitTime: '2026-08-25T11:42:52-03:00',
    };
    expect(detectDirectionFlip(atual, [anterior])).toBeNull();
  });

  it('os outros casos da base que deixam de ser sinalizados', () => {
    // 34,2' · 36' · 36' · 36' · 44' · 97' — todos inversão isolada após loss
    for (const min of [34.2, 36, 44, 97]) {
      const anterior = t('a', 'LONG', '10:00:00', '10:10:00', -250);
      const h = 10 * 60 + 10 + min; // minutos desde 00:00
      const hh = String(Math.floor(h / 60)).padStart(2, '0');
      const mm = String(Math.floor(h % 60)).padStart(2, '0');
      const ss = String(Math.round((h % 1) * 60)).padStart(2, '0');
      const atual = t('b', 'SHORT', `${hh}:${mm}:${ss}`, null, -100);
      expect(detectDirectionFlip(atual, [anterior]), `${min} min`).toBeNull();
    }
  });
});

describe('perdido — virada da virada dentro de 30 minutos', () => {
  it('o exemplo do domínio: comprou, vendeu em 10\', comprou de novo em 23\'', () => {
    const c1 = t('a', 'LONG', '10:00:00', '10:08:00', -100);
    const v = t('b', 'SHORT', '10:10:00', '10:20:00', -50);
    const c2 = t('c', 'LONG', '10:23:00', '10:30:00', -80);
    const r = detectDirectionFlip(c2, [c1, v]);
    expect(r).not.toBeNull();
    expect(r.severity).toBe('HIGH');
    expect(r.evidence.trigger).toBe('PERDIDO');
    expect(r.evidence.reversals).toBe(2);
    expect(r.evidence.spanMinutes).toBe(23);
  });

  it('a mesma sequência esticada além de 30 minutos não é sinal', () => {
    const c1 = t('a', 'LONG', '10:00:00', '10:08:00', -100);
    const v = t('b', 'SHORT', '10:15:00', '10:25:00', -50);
    const c2 = t('c', 'LONG', '10:35:00', '10:45:00', -80);
    expect(detectDirectionFlip(c2, [c1, v])).toBeNull();
  });

  it('uma inversão só, mesmo dentro de 30 minutos, não basta', () => {
    const anterior = t('a', 'LONG', '10:00:00', '10:08:00', -250);
    const atual = t('b', 'SHORT', '10:20:00', '10:30:00', -100);
    expect(detectDirectionFlip(atual, [anterior])).toBeNull();
  });

  it('o caso de 3 inversões em 46 minutos da base continua fora', () => {
    const a = t('a', 'LONG', '10:00:00', '10:05:00', -100);
    const b = t('b', 'SHORT', '10:20:00', '10:25:00', -50);
    const c = t('c', 'LONG', '10:46:00', '10:50:00', -80);
    expect(detectDirectionFlip(c, [a, b])).toBeNull();
  });

  it('quando os dois gatilhos se aplicam, PERDIDO tem precedência', () => {
    // A cadeia descreve um estado; o desespero descreve um evento. O estado manda.
    const c1 = t('a', 'LONG', '10:00:00', '10:08:00', -100);
    const v = t('b', 'SHORT', '10:10:00', '10:20:00', -50);
    const c2 = t('c', 'LONG', '10:22:00', '10:30:00', -80); // gap 2min E cadeia de 2
    const r = detectDirectionFlip(c2, [c1, v]);
    expect(r.evidence.trigger).toBe('PERDIDO');
    expect(r.evidence.gapMinutes).toBe(2);
  });

  it('virada da virada dispara mesmo sem perda no meio — é confusão de direção', () => {
    // O domínio descreveu "perdido" por direção, não por resultado.
    const c1 = t('a', 'LONG', '10:00:00', '10:08:00', -100);
    const v = t('b', 'SHORT', '10:10:00', '10:20:00', 30); // ganho
    const c2 = t('c', 'LONG', '10:23:00', '10:30:00', -80);
    expect(detectDirectionFlip(c2, [c1, v])?.evidence.trigger).toBe('PERDIDO');
  });
});

describe('portas que continuam fechadas', () => {
  const anterior = t('a', 'LONG', '10:00:00', '10:10:00', -250);

  it('mesmo lado não é inversão', () => {
    expect(detectDirectionFlip(t('b', 'LONG', '10:11:00', null, -100), [anterior])).toBeNull();
  });

  it('instrumento diferente não é inversão', () => {
    const outro = { ...t('b', 'SHORT', '10:11:00', null, -100), ticker: 'WDOV26' };
    expect(detectDirectionFlip(outro, [anterior])).toBeNull();
  });

  it('inversão isolada após GANHO não é desespero', () => {
    const ganho = t('a', 'LONG', '10:00:00', '10:10:00', 300);
    expect(detectDirectionFlip(t('b', 'SHORT', '10:11:00', null, -100), [ganho])).toBeNull();
  });

  it('sem trade anterior não há o que comparar', () => {
    expect(detectDirectionFlip(t('b', 'SHORT', '10:11:00', null, -100), [])).toBeNull();
  });

  it('sem horário de entrada ou sem lado', () => {
    expect(detectDirectionFlip({ ...t('b', 'SHORT', '10:11:00', null, -100), entryTime: null }, [anterior])).toBeNull();
    expect(detectDirectionFlip({ ...t('b', 'SHORT', '10:11:00', null, -100), side: null }, [anterior])).toBeNull();
  });
});
