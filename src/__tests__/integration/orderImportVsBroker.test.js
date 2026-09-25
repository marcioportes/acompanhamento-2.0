/**
 * orderImportVsBroker.test.js
 * @version 1.0.0 (v1.92.7 — issue #463, épico #462 Fase 0)
 *
 * O import de ordens contra o relatório de performance da CORRETORA, operação por
 * operação, sobre exports reais do ProfitChart-Pro do Marcio (8 dias, 105 operações).
 * A corretora é a verdade: lado, quantidade, preços e resultado vêm do relatório dela.
 *
 * Três perguntas por operação:
 *   1. corretora — o import reconstrói a mesma operação (lado, qtd, médias, R$)?
 *   2. stop      — o `stopLoss` gravado é defensável pelo critério do épico #462?
 *                  (proteção nasce com a perna, lado oposto, mesmo ativo, adversa ao
 *                  preço executado da perna, não cancelada antes da entrada, não é
 *                  zeragem nem inversão — `violacoesDoStop`)
 *   3. retomada  — retomar o lote do staging dá o mesmo stop que importar direto?
 *
 * O que hoje falha está em `orderImportVsBroker.known.js` com a fase que corrige, e
 * roda como `it.fails`. Quando a fase corrige, o `it.fails` quebra e obriga a tirar a
 * entrada: a lista só encolhe. Entrada nova nessa lista é regressão.
 *
 * Além disso, o stop ESPERADO anotado à mão, lendo o CSV de ordens, nos dias curtos.
 *
 * Roda igual em TZ=UTC e TZ=America/Sao_Paulo (a CI roda em UTC).
 */

import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import {
  replayPair,
  tradeDa,
  violacoesDoStop,
  chaveDaLinha,
} from '../helpers/brokerReplay';
import { FALHAS_CONHECIDAS } from './orderImportVsBroker.known';

const FIXTURES = resolve(__dirname, '../fixtures/broker-replay');

const DIAS = [
  { dia: '2026-03-19', nota: 'Clear, WINJ26, 5 operações' },
  { dia: '2026-03-30', nota: 'Clear, 30/03–01/04, WIN + opções (massa do #93)' },
  { dia: '2026-04-09', nota: 'Clear, 44 operações de WIN + opção (massa do #93)' },
  { dia: '2026-04-20', nota: 'Clear, SEM1 20–22/04' },
  { dia: '2026-05-04', nota: 'Clear, 4 operações com bracket' },
  { dia: '2026-09-01', nota: 'Simulador, 01–16/09, 33 operações, inclui as inversões do #446' },
  { dia: '2026-09-23', nota: 'Simulador, milissegundos no export (#455)' },
  { dia: '2026-09-24', nota: 'Simulador, venda de 10 em duas pernas — o caso do épico #462' },
];

// Operação que o import reconstrói e o relatório não lista — diferença da referência,
// não do import.
const EXTRAS_DA_REFERENCIA = {
  '2026-03-30': [
    { instrument: 'VALED824', aberta: true, motivo: 'opção aberta no fim do período; o relatório só lista operação fechada' },
    { instrument: 'WINJ26', entrada: '2026-03-31T13:42:23', motivo: 'enviada pelo celular: está no export de ordens e não no relatório' },
  ],
};

const explicada = (dia, op) => (EXTRAS_DA_REFERENCIA[dia] || []).some(e =>
  e.instrument === String(op.instrument).toUpperCase()
  && (e.aberta ? op._isOpen === true : String(op.entryTime).startsWith(e.entrada)));

// Stop esperado, anotado à mão a partir do CSV de ordens (null = sem stop comprovado,
// o aluno informa — regra do #455 e decisão do Marcio de 25/09 para posição em pernas).
const STOP_ANOTADO = {
  '2026-04-20': {
    // LONG 2 @ 200.225; único stop (200.245, 1 contrato) fica ACIMA da entrada: de ganho.
    'WINM26@2026-04-20T12:08:21': null,
    // SHORT 2 @ 198.500; bracket 12s depois, stop 198.750 acima da entrada.
    'WINM26@2026-04-22T10:55:43': 198750,
    // SHORT 2 @ 198.370; stop 198.350 ABAIXO da entrada: movido para o ganho.
    'WINM26@2026-04-22T11:07:52': null,
  },
  '2026-05-04': {
    // LONG 2 @ 190.500; o bracket executou no stop 190.515, acima da entrada: de ganho.
    // O 190.845 de hoje vem de uma COMPRA stop cancelada ANTES da entrada.
    'WINM26@2026-05-04T10:44:46': null,
    'WINM26@2026-05-04T11:32:03': 190130,
    'WINM26@2026-05-04T11:39:20': 190120,
    // SHORT 2 @ 189.830; stop 189.810 abaixo da entrada: movido para o ganho.
    'WINM26@2026-05-04T12:17:16': null,
  },
  '2026-09-23': {
    // LONG 5 @ 189.370; o 189.390 da ordem de stop fica acima da entrada (#455).
    'WINV26@2026-09-23T10:58:06': null,
  },
  '2026-09-24': {
    // Perna 1: venda 5 @ 185.070, proteção 185.135. Perna 2: venda 5 @ 185.300, único
    // stop 185.280 — do lado do ganho. Perna sem stop comprovado → trade sem stop.
    // Hoje sai 188.720: stop de 14:39, cancelado às 15:08, 44 min antes da entrada.
    'WINV26@2026-09-24T15:52:21': null,
  },
};

// #466 (F3) — os quatro stops anotados passaram a conferir; a lista fica para regressão.
const STOP_ANOTADO_FALHA = {};

const itConforme = (falha) => (falha ? it.fails : it);
const rotulo = (base, falha) => (falha ? `${base} — falha conhecida, corrige em ${falha}` : base);

const divergenciasDaCorretora = (row, op, pointValue) => {
  const d = [];
  if (op.side !== row.side) d.push(`lado ${op.side} ≠ ${row.side}`);
  if (op.totalQty !== row.qty) d.push(`qtd ${op.totalQty} ≠ ${row.qty}`);
  if (Math.abs(op.avgEntryPrice - row.entry) > 0.011) d.push(`entrada ${op.avgEntryPrice} ≠ ${row.entry}`);
  if (Math.abs(op.avgExitPrice - row.exit) > 0.011) d.push(`saída ${op.avgExitPrice} ≠ ${row.exit}`);
  const pts = op.side === 'LONG' ? op.avgExitPrice - op.avgEntryPrice : op.avgEntryPrice - op.avgExitPrice;
  const pv = pointValue(row.instrument);
  const res = pv == null ? NaN : pts * op.totalQty * pv;
  if (!(Math.abs(res - row.result) <= 0.02)) d.push(`R$ ${res.toFixed(2)} ≠ ${row.result}`);
  return d;
};

describe.each(DIAS)('#462 F0 · import × corretora · $dia ($nota)', ({ dia }) => {
  const r = replayPair(
    resolve(FIXTURES, `${dia}-ordens.csv`),
    resolve(FIXTURES, `${dia}-performance.csv`),
  );
  const conhecidas = FALHAS_CONHECIDAS[dia] || {};

  it('o arquivo é lido inteiro: formato reconhecido, nenhuma ordem rejeitada', () => {
    expect(r.format).toBe('profitchart_pro');
    expect(r.invalid).toEqual([]);
  });

  it('toda operação da corretora é reconstruída; nenhuma operação a mais sem explicação', () => {
    expect(r.fresh.pares.filter(p => !p.op).map(p => chaveDaLinha(p.row))).toEqual([]);
    const semExplicacao = r.fresh.extras.filter(op => !explicada(dia, op));
    expect(semExplicacao.map(op => `${op.instrument}@${op.entryTime}`)).toEqual([]);
  });

  const pares = r.fresh.pares.filter(p => p.op);

  describe('corretora — lado, qtd, preços médios e R$', () => {
    for (const { row, op } of pares) {
      const falha = conhecidas[chaveDaLinha(row)]?.corretora;
      itConforme(falha)(rotulo(chaveDaLinha(row), falha), () => {
        expect(divergenciasDaCorretora(row, op, r.pointValue)).toEqual([]);
      });
    }
  });

  describe('stop — só proteção que nasceu com a perna', () => {
    for (const { row, op } of pares) {
      const falha = conhecidas[chaveDaLinha(row)]?.stop;
      itConforme(falha)(rotulo(chaveDaLinha(row), falha), () => {
        expect(violacoesDoStop(op)).toEqual([]);
      });
    }
  });

  describe('retomada do staging dá o mesmo stop do import direto', () => {
    for (const { row, op } of pares) {
      const falha = conhecidas[chaveDaLinha(row)]?.retomada;
      itConforme(falha)(rotulo(chaveDaLinha(row), falha), () => {
        const retomada = r.resumed.pares.find(p => chaveDaLinha(p.row) === chaveDaLinha(row))?.op;
        expect(retomada).toBeTruthy();
        expect(tradeDa(retomada).stopLoss).toBe(tradeDa(op).stopLoss);
      });
    }
  });

  const anotados = STOP_ANOTADO[dia];
  if (anotados) {
    describe('stop anotado à mão', () => {
      for (const [chave, esperado] of Object.entries(anotados)) {
        const falha = STOP_ANOTADO_FALHA[dia]?.[chave];
        itConforme(falha)(rotulo(`${chave} → ${esperado ?? 'sem stop'}`, falha), () => {
          const par = pares.find(p => chaveDaLinha(p.row) === chave);
          expect(par).toBeTruthy();
          expect(tradeDa(par.op).stopLoss ?? null).toBe(esperado);
        });
      }
    });
  }
});

describe('#462 F0 · operação aberta no fim do período', () => {
  const r = replayPair(
    resolve(FIXTURES, '2026-03-30-ordens.csv'),
    resolve(FIXTURES, '2026-03-30-performance.csv'),
  );
  const aberta = r.fresh.extras.find(op => op._isOpen);

  it('existe (VALED824 sem zeragem até 01/04)', () => {
    expect(aberta?.instrument).toBe('VALED824');
  });

  // Até o #464 a operação aberta saía em `Z` (`new Date(_ts).toISOString()`) enquanto as
  // fechadas saíam com o offset do lote (#292), e quem lia o offset da PRIMEIRA operação
  // deslocava a associação em 3h. Corrigido em F1 #464.
  it('carrega o offset do lote, como as operações fechadas', () => {
    expect(aberta.entryTime).toMatch(/-03:00$/);
  });
});

// Exports de aluno não entram no repo. Rodam localmente, apontando para a pasta:
//   ORDER_REPLAY_ALUNOS=/mnt/c/000-Marcio npx vitest run orderImportVsBroker
// Sem lista de falhas conhecidas: o objetivo é ver o estrago, não travar a CI.
const PASTA_ALUNOS = process.env.ORDER_REPLAY_ALUNOS;
const PARES_DE_ALUNO = [
  ['Italo 11–20/08 (export sem linhas de execução)', 'Italo/ITALO PROFIT 2026 - ordens recentes.csv', 'Italo/ITALO 11 A 20082026.csv'],
  ['Eduardo julho', 'Temp/LEADS/Ordens julho.csv', 'Temp/LEADS/PERF_JULHO_EDU.csv'],
];

describe.skipIf(!PASTA_ALUNOS).each(PARES_DE_ALUNO)('#462 F0 · aluno · %s', (_nome, ordens, performance) => {
  const r = PASTA_ALUNOS && replayPair(resolve(PASTA_ALUNOS, ordens), resolve(PASTA_ALUNOS, performance));

  it('toda operação da corretora é reconstruída e confere', () => {
    const erros = r.fresh.pares.flatMap(({ row, op }) => (op
      ? divergenciasDaCorretora(row, op, r.pointValue).map(d => `${chaveDaLinha(row)}: ${d}`)
      : [`${chaveDaLinha(row)}: ausente`]));
    expect(erros).toEqual([]);
  });

  it('nenhum stop indefensável', () => {
    const erros = r.fresh.pares.filter(p => p.op)
      .map(({ row, op }) => [chaveDaLinha(row), violacoesDoStop(op)])
      .filter(([, v]) => v.length);
    expect(erros).toEqual([]);
  });
});
