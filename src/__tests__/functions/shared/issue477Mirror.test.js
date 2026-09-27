/**
 * issue477Mirror.test.js — paridade ESM↔CJS dos três módulos do #477.
 *
 * `entryAttempts` (o que a Hesitação conta), `positionBuild` (montagem de posição, aviso
 * neutro) e `emotionConfront` (regras do confronto) têm o CORPO idêntico no cliente
 * (`src/utils/`) e na CF (`functions/shared/`) — só o cabeçalho, o import e o export
 * mudam. Esta suíte trava o texto e o resultado.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as esmAttempts from '../../../utils/entryAttempts';
import * as esmBuild from '../../../utils/positionBuild';
import * as esmConfront from '../../../utils/emotionConfront';

const cjsAttempts = require('../../../../functions/shared/entryAttempts');
const cjsBuild = require('../../../../functions/shared/positionBuild');
const cjsConfront = require('../../../../functions/shared/emotionConfront');

const RAIZ = resolve(__dirname, '../../../..');
const INICIO = '/** ---- corpo espelhado (#477) ---- */';
const FIM = '/** ---- fim do corpo espelhado ---- */';
const corpo = (arquivo) => {
  const s = readFileSync(resolve(RAIZ, arquivo), 'utf-8');
  return s.slice(s.indexOf(INICIO), s.indexOf(FIM)).trim();
};

describe.each([
  ['entryAttempts', esmAttempts, cjsAttempts],
  ['positionBuild', esmBuild, cjsBuild],
  ['emotionConfront', esmConfront, cjsConfront],
])('#477 · %s — ESM ≡ CJS', (nome, esm, cjs) => {
  it('corpo idêntico (texto)', () => {
    const a = corpo(`src/utils/${nome}.js`);
    const b = corpo(`functions/shared/${nome}.js`);
    expect(a.length).toBeGreaterThan(200);
    expect(a).toBe(b);
  });
  it('mesmos exports', () => {
    expect(Object.keys(esm).sort()).toEqual(Object.keys(cjs).sort());
  });
});

const OFF = '-03:00';
const trade = {
  id: 'T', side: 'SHORT', ticker: 'WINV26', entry: 185070, stopLoss: 185300,
  entryTime: `2026-09-24T15:52:21${OFF}`, exitTime: `2026-09-24T17:40:14${OFF}`,
};
const o = (id, side, status, hora, extra = {}) => ({
  externalOrderId: id, instrument: 'WINV26', side, orderType: 'LIMIT', status, quantity: 5,
  submittedAt: `2026-09-24T${hora}${OFF}`, ...extra,
});
const ORDENS = [
  o('A1', 'SELL', 'CANCELLED', '15:47:00', { limitPrice: 185100, cancelledAt: `2026-09-24T15:47:30${OFF}` }),
  o('A2', 'SELL', 'CANCELLED', '15:49:00', { limitPrice: 185090, quantity: 3, cancelledAt: `2026-09-24T15:49:20${OFF}` }),
  o('A3', 'SELL', 'CANCELLED', '15:49:25', { limitPrice: 185090, cancelledAt: `2026-09-24T15:51:00${OFF}` }),
  o('E1', 'SELL', 'FILLED', '15:52:19', { limitPrice: 185070, filledPrice: 185070, filledQuantity: 5, filledAt: `2026-09-24T15:52:21${OFF}` }),
  o('X1', 'BUY', 'FILLED', '15:52:21', { limitPrice: 185135, filledPrice: 184985, filledQuantity: 5, filledAt: `2026-09-24T17:40:14${OFF}` }),
  o('E2', 'SELL', 'FILLED', '15:49:44', { limitPrice: 185300, filledPrice: 185300, filledQuantity: 5, filledAt: `2026-09-24T16:24:31${OFF}` }),
  o('S2', 'BUY', 'CANCELLED', '16:24:31', { orderType: 'STOP_LIMIT', isStopOrder: true, stopPrice: 185280, limitPrice: 185430, cancelledAt: `2026-09-24T17:21:04${OFF}` }),
];

describe('#477 · resultado ESM ≡ CJS', () => {
  it('entryAttemptsOf', () => {
    const a = esmAttempts.entryAttemptsOf(trade, ORDENS);
    const b = cjsAttempts.entryAttemptsOf(trade, ORDENS);
    expect(a).toEqual(b);
    // A2 foi reenviada em 5 s com a quantidade corrigida (A3) → ajuste. A1 e A3 contam.
    expect(a.adjustments.map((x) => x.externalOrderId)).toEqual(['A2']);
    expect(a.attempts.map((x) => x.externalOrderId)).toEqual(['A1', 'A3']);
  });

  it('positionBuildOf', () => {
    const a = esmBuild.positionBuildOf(trade, ORDENS);
    expect(a).toEqual(cjsBuild.positionBuildOf(trade, ORDENS));
    expect(a.against).toBe(1);
    expect(a.allProtected).toBe(true);
  });

  it('regras do confronto', () => {
    for (const cat of ['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'CRITICAL', null]) {
      for (const sev of ['CLEAN', 'LOW', 'MEDIUM', 'HIGH']) {
        expect(esmConfront.confrontVerdictFor(cat, sev)).toBe(cjsConfront.confrontVerdictFor(cat, sev));
      }
    }
    for (const sev of ['LOW', 'MEDIUM', 'HIGH', null]) {
      expect(esmConfront.isConfrontable('negative', 'FEAR', sev)).toBe(cjsConfront.isConfrontable('negative', 'FEAR', sev));
    }
    expect(esmConfront.isConfrontable('negative', 'FEAR', 'LOW')).toBe(false);
    expect(esmConfront.isConfrontable('neutral', 'DENIAL', 'HIGH')).toBe(false);
  });
});
