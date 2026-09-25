/**
 * orderInstant464.test.js — o instante único da ordem no import (#464, épico #462 F1).
 *
 * Cada bloco trava um comportamento que mudou:
 *   - execução pela "Última Atualização" quando o export não traz as linhas de evento;
 *   - empate no mesmo segundo nunca resolvido pela ordem das linhas do arquivo;
 *   - operação aberta com o offset do lote, e associação que não depende de qual
 *     operação vem primeiro;
 *   - `orders` gravada com offset sem mudar chave, id nem fingerprint.
 *
 * Roda igual em TZ=UTC e TZ=America/Sao_Paulo (a CI roda em UTC).
 */
import { describe, it, expect } from 'vitest';
import { parseProfitChartPro } from '../../utils/orderParsers';
import { normalizeBatch } from '../../utils/orderNormalizer';
import { reconstructOperations, associateNonFilledOrders } from '../../utils/orderReconstruction';
import { orderInstantsWithOffset, stagingDocsToOrders } from '../../utils/orderImportPipeline';
import { makeOrderKey, makeOrderDocId } from '../../utils/orderKey';
import { orderKeyVariants, indexExistingOrders, detectAlreadyImported } from '../../utils/orderDedup';
import { orderMatchFingerprint } from '../../utils/conversationalIngest';
import { detectHesitation } from '../../utils/shadowBehaviorAnalysis';

const TZ = 'America/Sao_Paulo';
const iso = (s) => new Date(s).toISOString();

// Export "ordens recentes" do Profit: sem linhas de evento, ordens em ordem DECRESCENTE
// de criação. Mesmo desenho do caso real de 21/08/2026 (conta e titular fictícios).
const HEADER = 'Corretora;Conta;Titular;ClOrdID;Ativo;Lado;Status;Criação;Última Atualização;Preço;Preço Stop;Qtd;Preço Médio;Qtd Executada;Qtd restante;Total;Total Executado;Validade;Data Validade;Estratégia;Mensagem;Carteira;Tipo de Ordem;TaskID;Bolsa;Origem';
const linha = (id, lado, status, criacao, atualizacao, preco, qtd, medio, executada, tipo = 'Limite') =>
  `Corretora X;000-0;TITULAR TESTE;NELO.29${id};WINV26;${lado};${status};${criacao};${atualizacao};${preco};-;${qtd};${medio};${executada};-;-;-;Hoje;-;Normal;;-;${tipo};-;BMF;Gráfico`;

const SEM_EVENTOS = [
  'hash,21/08/2026,21/08/2026',
  HEADER,
  linha('20260821150056032478', 'V', 'Executada', '21/08/2026 15:00:56', '21/08/2026 15:01:06', '174.000,00', 5, '174.000,00', 5),
  linha('20260821150022032427', 'V', 'Executada', '21/08/2026 15:00:22', '21/08/2026 15:00:43', '173.900,00', 20, '173.900,00', 20),
  linha('20260821150022032426', 'V', 'Cancelada', '21/08/2026 15:00:22', '21/08/2026 15:00:25', '173.430,00', 20, '-', '-', 'Stop Limite'),
  linha('20260821150022032425', 'C', 'Executada', '21/08/2026 15:00:22', '21/08/2026 15:00:22', '174.075,00', 25, '173.880,00', 25),
].join('\n');

describe('#464 · execução pela "Última Atualização" no export sem linhas de evento', () => {
  const { orders } = parseProfitChartPro(SEM_EVENTOS);
  const porId = (sufixo) => orders.find(o => o.externalOrderId.endsWith(sufixo));

  it('ordem executada sem evento "Trade" recebe filledAt = Última Atualização', () => {
    expect(porId('032427').filledAt).toBe('2026-08-21T15:00:43');
    expect(porId('032427')._instanteDaUltimaAtualizacao).toBe(true);
  });

  it('ordem cancelada sem evento "Cancel" recebe cancelledAt = Última Atualização', () => {
    expect(porId('032426').cancelledAt).toBe('2026-08-21T15:00:25');
    expect(porId('032426').filledAt).toBeNull();
  });

  it('com evento "Trade", o evento continua mandando', () => {
    const csv = [
      'hash,19/03/2026,19/03/2026',
      HEADER,
      linha('1', 'C', 'Executada', '19/03/2026 10:14:08', '19/03/2026 10:14:59', '178.115,00', 2, '177.970,00', 2),
      ';;;;;;Trade;19/03/2026 10:14:15;;;;;177.970,00;2',
    ].join('\n');
    const [o] = parseProfitChartPro(csv).orders;
    expect(o.filledAt).toBe('2026-03-19T10:14:15');
    expect(o._instanteDaUltimaAtualizacao).toBeUndefined();
  });

  it('a compra das 15:00:22 abre a posição: LONG 25, e não um SHORT invertido', () => {
    const { orders: norm } = normalizeBatch(orders);
    const ops = reconstructOperations(norm, { timezone: TZ });
    expect(ops.map(o => [o.side, o.totalQty, o.entryTime, o.exitTime])).toEqual([
      ['LONG', 25, '2026-08-21T15:00:22-03:00', '2026-08-21T15:01:06-03:00'],
    ]);
  });

  it('o marcador vive só em memória: não chega ao staging', () => {
    const { orders: norm } = normalizeBatch(orders);
    expect(norm.find(o => o.externalOrderId.endsWith('032427'))._instanteDaUltimaAtualizacao).toBe(true);
    // Retomada do lote: o staging grava lista fechada de campos (useOrderStaging)
    const docs = stagingDocsToOrders([{ id: 'x', externalOrderId: 'e', submittedAt: '2026-08-21T15:00:22', filledAt: '2026-08-21T15:00:43' }]);
    expect(docs[0]).not.toHaveProperty('_instanteDaUltimaAtualizacao');
  });
});

const fill = (over) => ({
  instrument: 'WINV26', status: 'FILLED', orderType: 'LIMIT', quantity: 1, filledQuantity: 1,
  filledPrice: 100, ...over,
});

const permuta = (arr) => {
  if (arr.length <= 1) return [arr];
  return arr.flatMap((x, i) => permuta([...arr.slice(0, i), ...arr.slice(i + 1)]).map(p => [x, ...p]));
};

const resumo = (ops) => ops.map(o => `${o.side}:${o.totalQty}:${o.entryOrders.map(e => e.externalOrderId).join('+')}>${o.exitOrders.map(e => e.externalOrderId).join('+')}`);

describe('#464 · empate no mesmo segundo nunca se resolve pela ordem do arquivo', () => {
  it('execução empatada: decide o envio — e qualquer ordem das linhas dá o mesmo resultado', () => {
    const ordens = [
      fill({ externalOrderId: 'B', side: 'SELL', submittedAt: '2026-09-09T11:00:05', filledAt: '2026-09-09T11:00:10' }),
      fill({ externalOrderId: 'A', side: 'BUY', submittedAt: '2026-09-09T11:00:01', filledAt: '2026-09-09T11:00:10' }),
      fill({ externalOrderId: 'C', side: 'SELL', submittedAt: '2026-09-09T11:01:00', filledAt: '2026-09-09T11:01:00' }),
      fill({ externalOrderId: 'D', side: 'BUY', submittedAt: '2026-09-09T11:02:00', filledAt: '2026-09-09T11:02:00' }),
    ];
    const resultados = new Set(permuta(ordens).map(p => JSON.stringify(resumo(reconstructOperations(p, { timezone: TZ })))));
    expect([...resultados]).toEqual([JSON.stringify(['LONG:1:A>B', 'SHORT:1:C>D'])]);
  });

  it('envio também empatado: decide a sequência da corretora (ClOrdID), não a linha', () => {
    const ordens = [
      fill({ externalOrderId: 'NELO.2920260821150022032427', side: 'SELL', submittedAt: '2026-08-21T15:00:22', filledAt: '2026-08-21T15:00:22' }),
      fill({ externalOrderId: 'NELO.2920260821150022032425', side: 'BUY', submittedAt: '2026-08-21T15:00:22', filledAt: '2026-08-21T15:00:22' }),
    ];
    for (const p of permuta(ordens)) {
      expect(resumo(reconstructOperations(p, { timezone: TZ })))
        .toEqual(['LONG:1:NELO.2920260821150022032425>NELO.2920260821150022032427']);
    }
  });

  it('id numérico compara como número (Tradovate: 999 antes de 1000)', () => {
    const ordens = [
      fill({ externalOrderId: '1000', side: 'SELL', submittedAt: '2026-08-21T15:00:22', filledAt: '2026-08-21T15:00:22' }),
      fill({ externalOrderId: '999', side: 'BUY', submittedAt: '2026-08-21T15:00:22', filledAt: '2026-08-21T15:00:22' }),
    ];
    expect(resumo(reconstructOperations(ordens, { timezone: TZ }))).toEqual(['LONG:1:999>1000']);
  });
});

describe('#464 · operação aberta carrega o offset do lote', () => {
  // Opção aberta às 09:00 (vem PRIMEIRO na lista) + um trade fechado às 10:00 de outro ativo.
  const ordens = [
    fill({ externalOrderId: 'opc', instrument: 'VALEX1', side: 'BUY', submittedAt: '2026-03-30T09:00:00', filledAt: '2026-03-30T09:00:00' }),
    fill({ externalOrderId: 'e1', side: 'BUY', submittedAt: '2026-03-30T10:00:00', filledAt: '2026-03-30T10:00:00' }),
    fill({ externalOrderId: 's1', side: 'SELL', submittedAt: '2026-03-30T10:05:00', filledAt: '2026-03-30T10:05:00' }),
  ];
  const cancelada = {
    externalOrderId: 'cx', instrument: 'WINV26', side: 'BUY', status: 'CANCELLED', orderType: 'LIMIT',
    quantity: 1, price: 99, submittedAt: '2026-03-30T10:02:00', cancelledAt: '2026-03-30T10:03:00',
  };

  it('entryTime da aberta sai com -03:00, como o das fechadas', () => {
    const ops = reconstructOperations(ordens, { timezone: TZ });
    const aberta = ops.find(o => o._isOpen);
    expect(aberta.entryTime).toBe('2026-03-30T09:00:00-03:00');
    expect(ops[0]).toBe(aberta);
  });

  it('sem o fuso do chamador, a associação lê o offset das operações — mesmo com a aberta na frente', () => {
    const ops = reconstructOperations(ordens, { timezone: TZ });
    associateNonFilledOrders(ops, [...ordens, cancelada]);
    const win = ops.find(o => o.instrument === 'WINV26');
    expect(win.cancelledOrders.map(o => o.externalOrderId)).toEqual(['cx']);
  });

  it('com o fuso do chamador, o mesmo resultado', () => {
    const ops = reconstructOperations(ordens, { timezone: TZ });
    associateNonFilledOrders(ops, [...ordens, cancelada], { timezone: TZ });
    expect(ops.find(o => o.instrument === 'WINV26').cancelledOrders).toHaveLength(1);
  });
});

describe('#464 · lote americano atravessando o DST — o offset é o da DATA da ordem', () => {
  const ET = 'America/New_York';
  // 06/03 (-05:00) e 10/03 (-04:00): o horário de verão dos EUA começa em 08/03/2026.
  const ordens = [
    fill({ externalOrderId: 'a1', instrument: 'MNQH6', side: 'BUY', submittedAt: '2026-03-06T10:00:00', filledAt: '2026-03-06T10:00:00' }),
    fill({ externalOrderId: 'a2', instrument: 'MNQH6', side: 'SELL', submittedAt: '2026-03-06T10:05:00', filledAt: '2026-03-06T10:05:00' }),
    fill({ externalOrderId: 'b1', instrument: 'MNQH6', side: 'BUY', submittedAt: '2026-03-10T10:00:00', filledAt: '2026-03-10T10:00:00' }),
    fill({ externalOrderId: 'b2', instrument: 'MNQH6', side: 'SELL', submittedAt: '2026-03-10T10:05:00', filledAt: '2026-03-10T10:05:00' }),
  ];
  const cancelada = {
    externalOrderId: 'cx', instrument: 'MNQH6', side: 'BUY', status: 'CANCELLED', orderType: 'LIMIT',
    quantity: 1, price: 99, submittedAt: '2026-03-10T10:02:00', cancelledAt: '2026-03-10T10:03:00',
  };

  for (const [nome, opts] of [['com o fuso do lote', { timezone: ET }], ['só com as operações', {}]]) {
    it(`a cancelada de 10/03 cai no trade de 10/03 — ${nome}`, () => {
      const ops = reconstructOperations(ordens, { timezone: ET });
      expect(ops.map(o => o.entryTime)).toEqual(['2026-03-06T10:00:00-05:00', '2026-03-10T10:00:00-04:00']);
      associateNonFilledOrders(ops, [...ordens, cancelada], opts);
      expect(ops[1].cancelledOrders.map(o => o.externalOrderId)).toEqual(['cx']);
      expect(ops[0].cancelledOrders).toEqual([]);
    });
  }
});

describe('#464 · "mesmo dia" é o dia do pregão, não o do processo', () => {
  it('ordem abortada às 21:30 de Brasília pertence ao trade das 20h do mesmo dia (em UTC já é "amanhã")', () => {
    const ordens = [
      fill({ externalOrderId: 'e', side: 'BUY', submittedAt: '2026-09-10T19:50:00', filledAt: '2026-09-10T19:50:00' }),
      fill({ externalOrderId: 's', side: 'SELL', submittedAt: '2026-09-10T20:00:00', filledAt: '2026-09-10T20:00:00' }),
    ];
    const abortada = {
      externalOrderId: 'x', instrument: 'WINV26', side: 'BUY', status: 'CANCELLED', orderType: 'LIMIT',
      quantity: 1, price: 99, submittedAt: '2026-09-10T21:30:00', cancelledAt: '2026-09-10T21:31:00',
    };
    const ops = reconstructOperations(ordens, { timezone: TZ });
    associateNonFilledOrders(ops, [...ordens, abortada], { timezone: TZ });
    expect(ops[0].cancelledOrders.map(o => o.externalOrderId)).toEqual(['x']);
  });
});

describe('#464 · orders gravada com offset — chave, id e fingerprint não mudam', () => {
  const staging = {
    instrument: 'WINV26', side: 'BUY', quantity: 5, filledQuantity: 5,
    submittedAt: '2026-09-09T11:22:02', filledAt: '2026-09-09T11:22:03', cancelledAt: null,
  };
  const gravada = { ...staging, ...orderInstantsWithOffset(staging, TZ) };

  it('orderInstantsWithOffset aplica o fuso do lote a cada instante', () => {
    expect(orderInstantsWithOffset(staging, TZ)).toEqual({
      submittedAt: '2026-09-09T11:22:02-03:00',
      filledAt: '2026-09-09T11:22:03-03:00',
      cancelledAt: null,
    });
    expect(iso(gravada.filledAt)).toBe('2026-09-09T14:22:03.000Z');
  });

  it('offset pela data: lote em ET grava -04:00 no verão e -05:00 no inverno', () => {
    expect(orderInstantsWithOffset({ submittedAt: '2026-07-15T09:30:00' }, 'America/New_York').submittedAt)
      .toBe('2026-07-15T09:30:00-04:00');
    expect(orderInstantsWithOffset({ submittedAt: '2026-01-15T09:30:00' }, 'America/New_York').submittedAt)
      .toBe('2026-01-15T09:30:00-05:00');
  });

  it('lote legado sem fuso e instante que já tem offset passam iguais', () => {
    expect(orderInstantsWithOffset(staging, null)).toEqual({
      submittedAt: '2026-09-09T11:22:02', filledAt: '2026-09-09T11:22:03', cancelledAt: null,
    });
    expect(orderInstantsWithOffset({ filledAt: '2026-09-09T14:22:03Z' }, TZ).filledAt).toBe('2026-09-09T14:22:03Z');
  });

  it('chave composta e id do doc: iguais para a ordem ingênua e para a gravada com offset', () => {
    expect(makeOrderKey(gravada)).toBe(makeOrderKey(staging));
    expect(makeOrderKey(staging)).toBe('comp:WINV26|BUY|2026-09-09T11:22:02|5|2026-09-09T11:22:03');
    expect(makeOrderDocId(gravada, 'aluno')).toBe(makeOrderDocId(staging, 'aluno'));
  });

  it('reimportar reconhece a ordem já gravada com offset (#366)', () => {
    const index = indexExistingOrders([{ ...gravada, studentId: 'aluno' }], 'aluno');
    expect(detectAlreadyImported([staging], index).duplicateIndexes.has(0)).toBe(true);
  });

  it('ordem com ClOrdID segue pela chave eid — o id não depende do instante', () => {
    expect(makeOrderKey({ ...gravada, externalOrderId: 'NELO.1' })).toBe('eid:NELO.1');
  });

  it('fingerprint ordem↔parcial igual para o doc com offset e a ordem do arquivo (#351)', () => {
    expect(orderMatchFingerprint(gravada)).toBe(orderMatchFingerprint(staging));
  });

  it('doc legado do export sem eventos (filledAt nulo) ainda é reconhecido', () => {
    const legado = { ...staging, filledAt: null, studentId: 'aluno' };
    const doArquivo = { ...staging, _instanteDaUltimaAtualizacao: true };
    expect(orderKeyVariants(doArquivo)).toContain(makeOrderKey(legado));
    const index = indexExistingOrders([legado], 'aluno');
    expect(detectAlreadyImported([doArquivo], index).duplicateIndexes.has(0)).toBe(true);
  });
});

describe('#464 · detectores de ordem do cliente leem a ordem no fuso do trade', () => {
  // Trade em ET. Duas ordens canceladas DEPOIS da entrada, no relógio de parede de ET.
  // Lida no fuso do processo (UTC na CI), 11:27 viraria 11:27Z — antes de 15:25Z — e o
  // detector acusaria hesitação que não houve.
  const trade = { entryTime: '2026-08-21T11:25:15-04:00', exitTime: '2026-08-21T11:40:00-04:00' };
  const orders = [
    { status: 'CANCELLED', submittedAt: '2026-08-21T11:26:00', cancelledAt: '2026-08-21T11:27:00' },
    { status: 'CANCELLED', submittedAt: '2026-08-21T11:28:00', cancelledAt: '2026-08-21T11:29:00' },
  ];

  it('cancelada depois da entrada não é hesitação', () => {
    expect(detectHesitation(trade, orders)).toBeNull();
  });

  it('canceladas antes da entrada continuam sendo', () => {
    const antes = orders.map(o => ({ ...o, submittedAt: '2026-08-21T11:10:00', cancelledAt: '2026-08-21T11:12:00' }));
    expect(detectHesitation(trade, antes)?.evidence.cancelledOrdersCount).toBe(2);
  });
});
