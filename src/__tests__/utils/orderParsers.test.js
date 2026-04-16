/**
 * orderParsers.test.js
 * @version 2.0.0 (v1.20.0)
 * Testes para parsers de ordens — Clear/Profit (real) + genérico + helpers.
 * Baseado em CSV real exportado da Clear/ProfitPro em 19/03/2026.
 */

import { describe, it, expect } from 'vitest';
import {
  detectOrderFormat,
  parseProfitChartPro,
  parseGenericOrders,
  normalizeSide,
  normalizeOrderType,
  normalizeOrderStatus,
  PROFITCHART_HEADER_SIGNATURE,
} from '../../utils/orderParsers';

// ============================================
// FIXTURE: CSV REAL CLEAR/PROFIT
// ============================================

const CLEAR_CSV_REAL = `c0c1978f2f885404ad01a09d2ddbf6d2,19/03/2026,19/03/2026
Corretora;Conta;Titular;ClOrdID;Ativo;Lado;Status;Criação;Última Atualização;Preço;Preço Stop;Qtd;Preço Médio;Qtd Executada;Qtd restante;Total;Total Executado;Validade;Data Validade;Estratégia;Mensagem;Carteira;Tipo de Ordem;TaskID;Bolsa;Origem
Clear - DayTrade;17375163;Marcio R. Portes;NLGC.9320260319160253892298;WINJ26;V;Cancelada;19/03/2026 16:02:53;19/03/2026 16:03:42;182.390,00;-;2;-;-;-;72.956,00;-;Hoje;-;Normal;;-;Limite;-;BMF;SuperDOM
;;;;;;Cancel;19/03/2026 16:03:42;;;;;0,00;2
Clear - DayTrade;17375163;Marcio R. Portes;NLGC.9320260319160326893767;WINJ26;V;Executada;19/03/2026 16:03:26;19/03/2026 16:03:40;182.200,00;-;2;182.200,00;2;-;72.880,00;72.880,00;Hoje;-;Normal;;-;Limite;-;BMF;SuperDOM
;;;;;;Trade;19/03/2026 16:03:40;;;;;182.200,00;2
Clear - DayTrade;17375163;Marcio R. Portes;NLGC.9320260319101141226983;WINJ26;C;Cancelada;19/03/2026 10:11:41;19/03/2026 10:14:15;178.430,00;178.280,00;1;-;-;-;35.686,00;-;Hoje;-;Normal;;-;Stop Limite;-;BMF;Estratégia
;;;;;;Cancel;19/03/2026 10:14:15;;;;;0,00;1
Clear - DayTrade;17375163;Marcio R. Portes;NLGC.9320260319101408236153;WINJ26;C;Executada;19/03/2026 10:14:08;19/03/2026 10:14:15;178.115,00;177.965,00;2;177.970,00;2;-;71.246,00;71.188,00;Hoje;-;Normal;;-;Limite;-;BMF;SuperDOM
;;;;;;Trade;19/03/2026 10:14:15;;;;;177.970,00;1
;;;;;;Trade;19/03/2026 10:14:15;;;;;177.970,00;1`;

// ============================================
// normalizeSide
// ============================================
describe('normalizeSide', () => {
  it('normaliza C → BUY (formato ProfitChart-Pro)', () => {
    expect(normalizeSide('C')).toBe('BUY');
  });

  it('normaliza V → SELL (formato ProfitChart-Pro)', () => {
    expect(normalizeSide('V')).toBe('SELL');
  });

  it('normaliza Compra/Venda', () => {
    expect(normalizeSide('Compra')).toBe('BUY');
    expect(normalizeSide('Venda')).toBe('SELL');
  });

  it('normaliza Buy/Sell inglês', () => {
    expect(normalizeSide('Buy')).toBe('BUY');
    expect(normalizeSide('Sell')).toBe('SELL');
  });

  it('retorna null para inválido', () => {
    expect(normalizeSide(null)).toBeNull();
    expect(normalizeSide('')).toBeNull();
    expect(normalizeSide('X')).toBeNull();
  });
});

// ============================================
// normalizeOrderType
// ============================================
describe('normalizeOrderType', () => {
  it('normaliza Limite → LIMIT (PT-BR ProfitChart-Pro)', () => {
    expect(normalizeOrderType('Limite')).toBe('LIMIT');
  });

  it('normaliza Stop Limite → STOP_LIMIT (PT-BR ProfitChart-Pro)', () => {
    expect(normalizeOrderType('Stop Limite')).toBe('STOP_LIMIT');
  });

  it('normaliza Mercado → MARKET', () => {
    expect(normalizeOrderType('Mercado')).toBe('MARKET');
  });

  it('normaliza inglês', () => {
    expect(normalizeOrderType('Market')).toBe('MARKET');
    expect(normalizeOrderType('Limit')).toBe('LIMIT');
    expect(normalizeOrderType('Stop')).toBe('STOP');
  });

  it('retorna null para inválido', () => {
    expect(normalizeOrderType(null)).toBeNull();
    expect(normalizeOrderType('XYZ')).toBeNull();
  });
});

// ============================================
// normalizeOrderStatus
// ============================================
describe('normalizeOrderStatus', () => {
  it('normaliza Executada → FILLED (PT-BR ProfitChart-Pro)', () => {
    expect(normalizeOrderStatus('Executada')).toBe('FILLED');
  });

  it('normaliza Cancelada → CANCELLED (PT-BR ProfitChart-Pro)', () => {
    expect(normalizeOrderStatus('Cancelada')).toBe('CANCELLED');
  });

  it('normaliza Rejeitada → REJECTED', () => {
    expect(normalizeOrderStatus('Rejeitada')).toBe('REJECTED');
  });

  it('normaliza Pendente → SUBMITTED', () => {
    expect(normalizeOrderStatus('Pendente')).toBe('SUBMITTED');
  });

  it('retorna null para event statuses (Trade/Cancel)', () => {
    // Event statuses should not leak as order-level statuses
    expect(normalizeOrderStatus('Trade')).toBeNull();
    expect(normalizeOrderStatus('Cancel')).toBeNull();
  });

  it('retorna null para inválido', () => {
    expect(normalizeOrderStatus(null)).toBeNull();
    expect(normalizeOrderStatus('UNKNOWN')).toBeNull();
  });
});

// ============================================
// detectOrderFormat
// ============================================
describe('detectOrderFormat', () => {
  it('detecta formato ProfitChart-Pro por headers reais', () => {
    const headers = ['Corretora', 'Conta', 'Titular', 'ClOrdID', 'Ativo', 'Lado', 'Status',
      'Criação', 'Última Atualização', 'Preço', 'Preço Stop', 'Qtd', 'Preço Médio',
      'Qtd Executada', 'Qtd restante', 'Total', 'Total Executado', 'Validade',
      'Data Validade', 'Estratégia', 'Mensagem', 'Carteira', 'Tipo de Ordem',
      'TaskID', 'Bolsa', 'Origem'];
    const result = detectOrderFormat(headers);
    expect(result.format).toBe('profitchart_pro');
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('retorna genérico para headers desconhecidos', () => {
    const result = detectOrderFormat(['Col1', 'Col2', 'Col3']);
    expect(result.format).toBe('generic');
  });

  it('retorna genérico para headers vazios', () => {
    expect(detectOrderFormat([]).format).toBe('generic');
    expect(detectOrderFormat(null).format).toBe('generic');
  });

  // Fase A do #142: registry de parsers — detecção retorna referência ao parser
  it('ProfitChart-Pro: detecção retorna parser referenciado no registry', () => {
    const headers = ['Corretora', 'Conta', 'Titular', 'ClOrdID', 'Ativo', 'Lado', 'Status',
      'Criação', 'Última Atualização', 'Preço', 'Preço Stop', 'Qtd', 'Preço Médio',
      'Qtd Executada', 'Qtd restante', 'Total', 'Total Executado', 'Validade',
      'Data Validade', 'Estratégia', 'Mensagem', 'Carteira', 'Tipo de Ordem',
      'TaskID', 'Bolsa', 'Origem'];
    const result = detectOrderFormat(headers);
    expect(result.parser).toBeTypeOf('function');
    // Parser roteado deve ser parseProfitChartPro — valida chamando com input vazio
    const parseResult = result.parser('');
    expect(parseResult).toHaveProperty('orders');
    expect(parseResult).toHaveProperty('meta');
    expect(parseResult).toHaveProperty('errors');
  });

  it('genérico: parser é null quando nenhum formato bate', () => {
    const result = detectOrderFormat(['foo', 'bar', 'baz']);
    expect(result.format).toBe('generic');
    expect(result.parser).toBeNull();
  });
});

// ============================================
// parseProfitChartPro — CORE (dados reais)
// ============================================
describe('parseProfitChartPro', () => {
  it('parse CSV real ProfitChart-Pro com preamble', () => {
    const { orders, meta, errors } = parseProfitChartPro(CLEAR_CSV_REAL);
    expect(errors).toHaveLength(0);
    expect(orders.length).toBe(4);
    expect(meta.corretora).toBe('Clear - DayTrade');
    expect(meta.conta).toBe('17375163');
    expect(meta.titular).toBe('Marcio R. Portes');
  });

  it('preamble (hash+data) ignorada corretamente', () => {
    const { orders } = parseProfitChartPro(CLEAR_CSV_REAL);
    // Should not create an order from the preamble line
    expect(orders.every(o => o.instrument !== '')).toBe(true);
  });

  it('ordem cancelada: status, evento Cancel, cancelledAt', () => {
    const { orders } = parseProfitChartPro(CLEAR_CSV_REAL);
    const cancelled = orders.find(o => o.externalOrderId === 'NLGC.9320260319160253892298');
    expect(cancelled).toBeTruthy();
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.side).toBe('SELL');
    expect(cancelled.instrument).toBe('WINJ26');
    expect(cancelled.quantity).toBe(2);
    expect(cancelled.events).toHaveLength(1);
    expect(cancelled.events[0].type).toBe('CANCEL');
    expect(cancelled.cancelledAt).toBeTruthy();
  });

  it('ordem executada: status, evento Trade, filledPrice, filledAt', () => {
    const { orders } = parseProfitChartPro(CLEAR_CSV_REAL);
    const filled = orders.find(o => o.externalOrderId === 'NLGC.9320260319160326893767');
    expect(filled).toBeTruthy();
    expect(filled.status).toBe('FILLED');
    expect(filled.side).toBe('SELL');
    expect(filled.quantity).toBe(2);
    expect(filled.events).toHaveLength(1);
    expect(filled.events[0].type).toBe('TRADE');
    expect(filled.filledPrice).toBe(182200);
    expect(filled.filledAt).toBeTruthy();
  });

  it('ordem Stop Limite detectada: isStopOrder=true, stopPrice preenchido', () => {
    const { orders } = parseProfitChartPro(CLEAR_CSV_REAL);
    const stopOrder = orders.find(o => o.externalOrderId === 'NLGC.9320260319101141226983');
    expect(stopOrder).toBeTruthy();
    expect(stopOrder.isStopOrder).toBe(true);
    expect(stopOrder.orderType).toBe('STOP_LIMIT');
    expect(stopOrder.stopPrice).toBe(178280);
  });

  it('execução parcial: 2 Trade events no mesmo order', () => {
    const { orders } = parseProfitChartPro(CLEAR_CSV_REAL);
    const partial = orders.find(o => o.externalOrderId === 'NLGC.9320260319101408236153');
    expect(partial).toBeTruthy();
    expect(partial.events).toHaveLength(2);
    expect(partial.events.every(e => e.type === 'TRADE')).toBe(true);
    // filledQuantity = soma dos trade events = 1+1 = 2
    expect(partial.filledQuantity).toBe(2);
    // avgFillPrice da linha master = 177.970,00
    expect(partial.avgFillPrice).toBe(177970);
    // stopPrice presente (177.965,00)
    expect(partial.stopPrice).toBe(177965);
  });

  it('preços BR parseados corretamente: 182.390,00 → 182390', () => {
    const { orders } = parseProfitChartPro(CLEAR_CSV_REAL);
    const order = orders[0]; // primeira ordem
    expect(order.price).toBe(182390);
  });

  it('timestamps BR parseados: 19/03/2026 16:02:53 → ISO', () => {
    const { orders } = parseProfitChartPro(CLEAR_CSV_REAL);
    const ts = orders[0].submittedAt;
    expect(ts).toBeTruthy();
    expect(ts).toContain('2026');
    expect(ts).toContain('16:02:53');
  });

  it('origin preservada: SuperDOM, Gráfico, Estratégia', () => {
    const { orders } = parseProfitChartPro(CLEAR_CSV_REAL);
    const origins = orders.map(o => o.origin);
    expect(origins).toContain('SuperDOM');
  });

  it('meta.totalOrders e totalEvents contados', () => {
    const { meta } = parseProfitChartPro(CLEAR_CSV_REAL);
    expect(meta.totalOrders).toBe(4);
    expect(meta.totalEvents).toBeGreaterThan(0);
  });
});

// ============================================
// parseProfitChartPro — edge cases
// ============================================
describe('parseProfitChartPro — edge cases', () => {
  it('arquivo vazio retorna erro', () => {
    const { orders, errors } = parseProfitChartPro('');
    expect(orders).toHaveLength(0);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('arquivo sem header retorna erro', () => {
    const { orders, errors } = parseProfitChartPro('linha1\nlinha2\nlinha3');
    expect(orders).toHaveLength(0);
    expect(errors.some(e => e.message.includes('Header'))).toBe(true);
  });

  it('evento órfão (sem master) gera erro', () => {
    const csv = `hash,19/03/2026,19/03/2026
Corretora;Conta;Titular;ClOrdID;Ativo;Lado;Status;Criação;Última Atualização;Preço;Preço Stop;Qtd;Preço Médio;Qtd Executada;Qtd restante;Total;Total Executado;Validade;Data Validade;Estratégia;Mensagem;Carteira;Tipo de Ordem;TaskID;Bolsa;Origem
;;;;;;Trade;19/03/2026 10:00:00;;;;;100,00;1`;
    const { orders, errors } = parseProfitChartPro(csv);
    expect(orders).toHaveLength(0);
    expect(errors.some(e => e.message.includes('sem ordem master'))).toBe(true);
  });

  it('ordem sem eventos é válida (só master row)', () => {
    const csv = `hash,19/03/2026,19/03/2026
Corretora;Conta;Titular;ClOrdID;Ativo;Lado;Status;Criação;Última Atualização;Preço;Preço Stop;Qtd;Preço Médio;Qtd Executada;Qtd restante;Total;Total Executado;Validade;Data Validade;Estratégia;Mensagem;Carteira;Tipo de Ordem;TaskID;Bolsa;Origem
Broker;123;Teste;ORD001;WINJ26;C;Executada;19/03/2026 10:00:00;19/03/2026 10:00:01;100,00;-;1;100,00;1;-;100,00;100,00;Hoje;-;Normal;;-;Limite;-;BMF;SuperDOM`;
    const { orders, errors } = parseProfitChartPro(csv);
    expect(errors).toHaveLength(0);
    expect(orders).toHaveLength(1);
    expect(orders[0].events).toHaveLength(0);
    expect(orders[0].filledPrice).toBe(100); // fallback from avgFillPrice
  });

  it('múltiplas ordens consecutivas sem eventos entre si', () => {
    const csv = `hash,19/03/2026,19/03/2026
Corretora;Conta;Titular;ClOrdID;Ativo;Lado;Status;Criação;Última Atualização;Preço;Preço Stop;Qtd;Preço Médio;Qtd Executada;Qtd restante;Total;Total Executado;Validade;Data Validade;Estratégia;Mensagem;Carteira;Tipo de Ordem;TaskID;Bolsa;Origem
Broker;123;Teste;ORD001;WINJ26;C;Executada;19/03/2026 10:00:00;19/03/2026 10:00:01;100,00;-;1;100,00;1;-;100,00;100,00;Hoje;-;Normal;;-;Limite;-;BMF;SuperDOM
Broker;123;Teste;ORD002;WINJ26;V;Cancelada;19/03/2026 10:01:00;19/03/2026 10:02:00;200,00;-;2;-;-;-;400,00;-;Hoje;-;Normal;;-;Limite;-;BMF;Gráfico`;
    const { orders } = parseProfitChartPro(csv);
    expect(orders).toHaveLength(2);
    expect(orders[0].externalOrderId).toBe('ORD001');
    expect(orders[1].externalOrderId).toBe('ORD002');
  });
});

// ============================================
// parseGenericOrders
// ============================================
describe('parseGenericOrders', () => {
  const mapping = {
    instrument: 'Ativo',
    side: 'Lado',
    quantity: 'Qtd',
    orderType: 'Tipo',
    status: 'Estado',
    submittedAt: 'Data',
    filledPrice: 'Preço Exec',
  };

  it('parse com mapeamento genérico', () => {
    const rows = [{
      'Ativo': 'WINFUT', 'Lado': 'C', 'Qtd': '5',
      'Tipo': 'Mercado', 'Estado': 'Executada', 'Data': '15/03/2026 10:30',
      'Preço Exec': '128.500,00',
    }];
    const { orders, errors } = parseGenericOrders(rows, mapping);
    expect(errors).toHaveLength(0);
    expect(orders).toHaveLength(1);
    expect(orders[0].instrument).toBe('WINFUT');
    expect(orders[0].side).toBe('BUY');
    expect(orders[0].quantity).toBe(5);
    expect(orders[0].orderType).toBe('MARKET');
    expect(orders[0].status).toBe('FILLED');
    expect(orders[0].filledPrice).toBe(128500);
  });

  it('retorna erro sem mapeamento', () => {
    const { orders, errors } = parseGenericOrders([{ 'A': '1' }], {});
    expect(orders).toHaveLength(0);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('pula linhas sem side e status', () => {
    const rows = [{ 'Ativo': 'WINFUT', 'Lado': '', 'Qtd': '1', 'Tipo': '', 'Estado': '', 'Data': '', 'Preço Exec': '' }];
    const { orders, errors } = parseGenericOrders(rows, mapping);
    expect(orders).toHaveLength(0);
    expect(errors).toHaveLength(1);
  });
});
