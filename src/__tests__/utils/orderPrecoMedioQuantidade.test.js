/**
 * orderPrecoMedioQuantidade.test.js
 * @version 1.0.0 (v1.92.9 — issue #465, épico #462 Fase 2)
 *
 * (1) O preço da ordem é a MÉDIA das execuções ponderada pela quantidade — não o preço
 *     do primeiro evento "Trade" (DT-048). Caso real: 11/09/2026, ordem de 135 contratos,
 *     corretora −250,67, import −250.
 * (2) Quantidade fracionária é lida como número e recusada com motivo explícito — antes
 *     `parseInt('0,03')` dava 0 e a validação dizia só "Quantidade inválida: 0".
 */

import { describe, it, expect } from 'vitest';
import { parseProfitChartPro } from '../../utils/orderParsers';
import { normalizeBatch } from '../../utils/orderNormalizer';
import { validateBatch, validateOrder } from '../../utils/orderValidation';

const HEADER = 'Corretora;Conta;Titular;ClOrdID;Ativo;Lado;Status;Criação;Última Atualização;Preço;Preço Stop;Qtd;Preço Médio;Qtd Executada;Qtd restante;Total;Total Executado;Validade;Data Validade;Estratégia;Mensagem;Carteira;Tipo de Ordem;TaskID;Bolsa;Origem';
const csv = (...linhas) => ['h,01/09/2026,01/09/2026', HEADER, ...linhas].join('\n');

describe('#465 · preço da ordem = média das execuções', () => {
  it('pondera os eventos "Trade" pela quantidade', () => {
    const { orders } = parseProfitChartPro(csv(
      'Simulador;1;M;X.1;WINV26;V;Executada;11/09/2026 16:17:31;11/09/2026 16:17:32;188.600,00;-;10;188.604,00;10;-;-;-;Hoje;-;Normal;;-;Mercado;-;BMF;Gráfico',
      ';;;;;;Trade;11/09/2026 16:17:31;;;;;188.600,00;6',
      ';;;;;;Trade;11/09/2026 16:17:32;;;;;188.610,00;4',
    ));
    expect(orders[0].filledPrice).toBe(188604);
    const { orders: [n] } = normalizeBatch(orders);
    expect(n.price).toBe(188604);
  });

  it('um evento só: o preço dele, como antes', () => {
    const { orders } = parseProfitChartPro(csv(
      'Simulador;1;M;X.2;WINV26;C;Executada;24/09/2026 16:24:31;24/09/2026 17:21:04;184.800,00;-;5;184.800,00;5;-;-;-;Hoje;-;Normal;;-;Limite;-;BMF;Estratégia',
      ';;;;;;Trade;24/09/2026 17:21:04;;;;;184.800,00;5',
    ));
    expect(orders[0].filledPrice).toBe(184800);
  });

  it('sem eventos (export "ordens recentes"): vale o Preço Médio da linha', () => {
    const { orders } = parseProfitChartPro(csv(
      'Clear;1;M;X.3;WINV26;C;Executada;20/08/2026 12:56:35;20/08/2026 12:56:40;171.360,00;-;3;171.355,00;3;-;-;-;Hoje;-;Normal;;-;Limite;-;BMF;Gráfico',
    ));
    expect(orders[0].filledPrice).toBe(171355);
  });
});

describe('#465 · quantidade fracionária', () => {
  const { orders } = parseProfitChartPro(csv(
    'FxGlobe;BA1;Main;NLGC.1;US500;C;Executada;17/09/2026 11:37:48;17/09/2026 11:38:01;7.633,00;-;0,03;7.633,00;0,03;-;-;-;Até cancelar;-;Normal;;-;Mercado;-;FXGlobe;Gráfico',
    ';;;;;;Trade;17/09/2026 11:38:01;;;;;7.633,00;0,03',
  ));

  it('é lida como número, não truncada para 0', () => {
    expect(orders[0].quantity).toBe(0.03);
    expect(orders[0].filledQuantity).toBe(0.03);
  });

  it('é recusada com o motivo escrito', () => {
    const { orders: normalized } = normalizeBatch(orders);
    const v = validateBatch(normalized);
    expect(v.validOrders).toHaveLength(0);
    expect(v.invalidOrders[0].errors.join(' ')).toMatch(/fracionária \(0,03\)/);
  });

  it('quantidade inteira segue válida', () => {
    expect(validateOrder({ instrument: 'WINV26', side: 'BUY', quantity: 5, status: 'CANCELLED', submittedAt: '2026-09-24T10:00:00' }).errors
      .some(e => /fracionária/.test(e))).toBe(false);
  });
});
