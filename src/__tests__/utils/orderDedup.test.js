/**
 * orderDedup.test.js
 * @description Testes da regra de entrada do Order Import (issue #366).
 *   O import não tinha porta: nada detectava que aquelas ordens já estavam em
 *   `orders`. A dedup precisa ser BI-CHAVE porque `makeOrderKey` devolve `eid:`
 *   quando há externalOrderId e `comp:` quando não há — e doc gravado antes do
 *   #362 não tem externalOrderId. Chave única deixaria todo o legado passar.
 */

import { describe, it, expect } from 'vitest';
import { orderKeyVariants, indexExistingOrders, detectAlreadyImported } from '../../utils/orderDedup';

const ordemBase = {
  externalOrderId: 'CL-9001',
  instrument: 'WDOQ26',
  side: 'BUY',
  submittedAt: '2026-08-19T13:00:00.000Z',
  quantity: 2,
  filledAt: '2026-08-19T13:00:01.000Z',
};

/** Doc de `orders` gravado ANTES do #362: sem externalOrderId no payload. */
const docLegado = {
  studentId: 'S1',
  planId: 'P1',
  batchId: 'ord_antigo',
  instrument: 'WDOQ26',
  side: 'BUY',
  submittedAt: '2026-08-19T13:00:00.000Z',
  quantity: 2,
  filledAt: '2026-08-19T13:00:01.000Z',
};

/** Doc de `orders` gravado a partir do #362: carrega o externalOrderId. */
const docNovo = { ...docLegado, externalOrderId: 'CL-9001', batchId: 'ord_novo' };

describe('orderKeyVariants', () => {
  it('devolve as duas chaves quando há externalOrderId', () => {
    expect(orderKeyVariants(ordemBase)).toEqual([
      'eid:CL-9001',
      'comp:WDOQ26|BUY|2026-08-19T13:00:00.000Z|2|2026-08-19T13:00:01.000Z',
    ]);
  });

  it('devolve só a composta quando não há externalOrderId', () => {
    expect(orderKeyVariants(docLegado)).toEqual([
      'comp:WDOQ26|BUY|2026-08-19T13:00:00.000Z|2|2026-08-19T13:00:01.000Z',
    ]);
  });
});

describe('indexExistingOrders', () => {
  it('escopa por studentId — ordem de outro aluno não entra no índice', () => {
    const index = indexExistingOrders(
      [docNovo, { ...docNovo, studentId: 'S2', externalOrderId: 'CL-OUTRO' }],
      'S1',
    );
    expect(index.has('eid:CL-9001')).toBe(true);
    expect(index.has('eid:CL-OUTRO')).toBe(false);
  });

  it('indexa doc novo pelas duas chaves', () => {
    const index = indexExistingOrders([docNovo], 'S1');
    expect(index.has('eid:CL-9001')).toBe(true);
    expect(index.has('comp:WDOQ26|BUY|2026-08-19T13:00:00.000Z|2|2026-08-19T13:00:01.000Z')).toBe(true);
  });

  it('guarda a proveniência do match', () => {
    const index = indexExistingOrders([docNovo], 'S1');
    expect(index.get('eid:CL-9001')).toMatchObject({ planId: 'P1', batchId: 'ord_novo' });
  });
});

describe('detectAlreadyImported', () => {
  it('detecta ordem já importada pós-#362 pela chave eid', () => {
    const index = indexExistingOrders([docNovo], 'S1');
    const { duplicateIndexes } = detectAlreadyImported([ordemBase], index);
    expect([...duplicateIndexes]).toEqual([0]);
  });

  it('detecta LEGADO sem externalOrderId pela chave composta (o caso que a chave única perde)', () => {
    const index = indexExistingOrders([docLegado], 'S1');
    const { duplicateIndexes, matches } = detectAlreadyImported([ordemBase], index);
    expect([...duplicateIndexes]).toEqual([0]);
    expect(matches[0].key).toMatch(/^comp:/);
  });

  it('não marca ordem de outro aluno com o mesmo ClOrdID', () => {
    const index = indexExistingOrders([{ ...docNovo, studentId: 'S2' }], 'S1');
    const { duplicateIndexes } = detectAlreadyImported([ordemBase], index);
    expect(duplicateIndexes.size).toBe(0);
  });

  it('não marca ordem genuinamente nova', () => {
    const index = indexExistingOrders([docNovo], 'S1');
    const nova = { ...ordemBase, externalOrderId: 'CL-9002', filledAt: '2026-08-19T14:00:00.000Z' };
    expect(detectAlreadyImported([nova], index).duplicateIndexes.size).toBe(0);
  });

  it('os índices retornados apontam para o array ORIGINAL, não para o filtrado', () => {
    const index = indexExistingOrders([docNovo], 'S1');
    const lote = [
      { ...ordemBase, externalOrderId: 'CL-8000', filledAt: '2026-08-19T12:00:00.000Z' },
      ordemBase,
      { ...ordemBase, externalOrderId: 'CL-8002', filledAt: '2026-08-19T15:00:00.000Z' },
    ];
    const { duplicateIndexes, matches } = detectAlreadyImported(lote, index);
    expect([...duplicateIndexes]).toEqual([1]);
    expect(matches[0].index).toBe(1);
  });

  it('chave composta colide entre ordens de atributos idênticos — conhecido e aceito', () => {
    // Mesmo instrumento, lado, horários e quantidade: `comp:` é igual mesmo com
    // ClOrdID diferente. É a mesma granularidade que makeOrderKey usa em todo o
    // pipeline desde o #93; o preço de reconhecer o legado sem externalOrderId.
    // Por isso a duplicata é PRÉ-EXCLUÍDA com aviso, e não bloqueada em silêncio.
    const index = indexExistingOrders([docLegado], 'S1');
    const outraComMesmosAtributos = { ...ordemBase, externalOrderId: 'CL-DIFERENTE' };
    expect(detectAlreadyImported([outraComMesmosAtributos], index).duplicateIndexes.size).toBe(1);
  });

  it('índice vazio não acusa nada (dedup contra lista ainda carregando)', () => {
    const { duplicateIndexes } = detectAlreadyImported([ordemBase], indexExistingOrders([], 'S1'));
    expect(duplicateIndexes.size).toBe(0);
  });
});
