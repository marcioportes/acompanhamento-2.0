/**
 * enrichPreservesStudentData.test.js — issue #371
 *
 * REGRA (Marcio, 21/08/2026): **nunca perca ou sobrescreva dado informado pelo aluno.**
 * Se o registro do aluno divergir das ordens, isso aparece no comportamento como
 * divergência — nunca corrigindo o dado dele por baixo. Se não houver dado informado,
 * aí sim preenche, e avisa que preencheu.
 *
 * O caso que originou: o import mandava `stopLoss: null` quando a operação não tinha
 * ordem marcada como stop, e o patch apagava o stop que o aluno tinha digitado.
 */

import { describe, it, expect, vi } from 'vitest';
import { enrichTrade } from '../../utils/tradeGateway';
import { buildEnrichmentPayload } from '../../utils/conversationalIngest';

const userContext = { uid: 'S1', email: 'a@b.c', displayName: 'Aluno' };

/** Firestore mockado: devolve `before` e captura o patch. */
const makeDeps = (before) => {
  const patches = [];
  return {
    patches,
    deps: {
      docFn: () => ({ id: 'T1' }),
      getDocFn: async () => ({ exists: () => true, data: () => before }),
      updateDocFn: async (_ref, patch) => { patches.push(patch); },
    },
  };
};

const tradeBase = {
  studentId: 'S1',
  side: 'SHORT',
  entry: 169880,
  exit: 170130,
  qty: 5,
  stopLoss: 170130,
  ticker: 'WINV26',
};

const enrichmentBase = {
  entry: 169880,
  exit: 170130,
  qty: 5,
  _partials: [],
  importBatchId: 'b1',
  tickerRule: { tickSize: 5, tickValue: 1 },
};

describe('enrichTrade — dado do aluno é imutável', () => {
  it('NÃO apaga o stop informado quando o import não encontrou proteção', async () => {
    const { deps, patches } = makeDeps(tradeBase);

    await enrichTrade('T1', { ...enrichmentBase, stopLoss: null }, userContext, deps);

    expect('stopLoss' in patches[0]).toBe(false);
  });

  it('NÃO sobrescreve o stop informado quando o import encontrou outro valor', async () => {
    const { deps, patches } = makeDeps(tradeBase);

    await enrichTrade('T1', { ...enrichmentBase, stopLoss: 170280 }, userContext, deps);

    expect('stopLoss' in patches[0]).toBe(false);
  });

  it('registra a divergência entre o que o aluno declarou e o que as ordens mostram', async () => {
    const { deps, patches } = makeDeps(tradeBase);

    await enrichTrade('T1', { ...enrichmentBase, stopLoss: 170280 }, userContext, deps);

    expect(patches[0].importDivergences).toMatchObject({
      stopLoss: { declared: 170130, observed: 170280 },
    });
  });

  it('preenche o stop quando o aluno não informou, e marca que foi o import', async () => {
    const { deps, patches } = makeDeps({ ...tradeBase, stopLoss: null });

    await enrichTrade('T1', { ...enrichmentBase, stopLoss: 170280 }, userContext, deps);

    expect(patches[0].stopLoss).toBe(170280);
    expect(patches[0].stopLossSource).toBe('import');
  });

  it('sem stop dos dois lados, não inventa campo nenhum', async () => {
    const { deps, patches } = makeDeps({ ...tradeBase, stopLoss: null });

    await enrichTrade('T1', { ...enrichmentBase, stopLoss: null }, userContext, deps);

    expect('stopLoss' in patches[0]).toBe(false);
    expect(patches[0].stopLossSource).toBeUndefined();
  });

  it('valor idêntico não vira divergência', async () => {
    const { deps, patches } = makeDeps(tradeBase);

    await enrichTrade('T1', { ...enrichmentBase, stopLoss: 170130 }, userContext, deps);

    expect(patches[0].importDivergences?.stopLoss).toBeUndefined();
  });
});

describe('buildEnrichmentPayload — não emite nulo por cima', () => {
  const operacao = (over = {}) => ({
    operationId: 'OP-1',
    instrument: 'WINV26',
    totalQty: 5,
    avgEntryPrice: 169880,
    avgExitPrice: 170130,
    entryOrders: [{ filledPrice: 169880, filledQuantity: 5, filledAt: '2026-08-20T10:18:54' }],
    exitOrders: [{ filledPrice: 170130, filledQuantity: 5, filledAt: '2026-08-20T10:22:06' }],
    stopOrders: [],
    cancelledOrders: [],
    hasStopProtection: false,
    ...over,
  });

  it('operação sem proteção não manda stopLoss no payload', () => {
    const payload = buildEnrichmentPayload({ operation: operacao(), tradeId: 'T1' }, {});

    expect('stopLoss' in payload).toBe(false);
  });

  it('operação com proteção manda o stop encontrado', () => {
    const op = operacao({
      hasStopProtection: true,
      stopOrders: [{ stopPrice: 170280, quantity: 5 }],
    });

    const payload = buildEnrichmentPayload({ operation: op, tradeId: 'T1' }, {});

    expect(payload.stopLoss).toBe(170280);
  });
});

describe('ajuste explícito do aluno manda em tudo (#371)', () => {
  it('aluno limpando o stop no modal zera de verdade', async () => {
    const { deps, patches } = makeDeps(tradeBase);

    await enrichTrade('T1', {
      ...enrichmentBase, stopLoss: null, stopLossFromUser: true,
    }, userContext, deps);

    expect(patches[0].stopLoss).toBeNull();
    expect(patches[0].stopLossSource).toBe('student');
  });

  it('aluno corrigindo o stop no modal sobrescreve o valor anterior', async () => {
    const { deps, patches } = makeDeps(tradeBase);

    await enrichTrade('T1', {
      ...enrichmentBase, stopLoss: 170200, stopLossFromUser: true,
    }, userContext, deps);

    expect(patches[0].stopLoss).toBe(170200);
    expect(patches[0].importDivergences).toBeUndefined();
  });
});
