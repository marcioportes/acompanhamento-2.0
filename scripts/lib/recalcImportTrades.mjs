/**
 * recalcImportTrades.mjs — issue #468 (épico #462, Fase 5)
 *
 * Núcleo do recálculo dos trades JÁ GRAVADOS pelo import de ordens, com as regras
 * corrigidas nas Fases 1–4 (instante com offset, preço médio, proteção única por perna,
 * stop do lado errado = sem stop). O CLI (`scripts/issue-468-recalc-import-trades.mjs`)
 * só lê argumentos, abre o admin SDK e imprime; a regra mora aqui, testável com
 * Firestore em memória.
 *
 * NÃO reimplementa a reconstrução: usa `reconstructOperations` +
 * `associateNonFilledOrders` + `mapOperationToTradeData` — as MESMAS funções do import
 * (OrderImportPage) — sobre as ordens do lote como estão em `orders`.
 *
 * REGRAS (o relatório repete cada uma no motivo da linha):
 *   1. Trade DISCUTIDO nunca é tocado (INV-30, `tradeImmutability`): listado como
 *      "preservado (discutido)". A escrita ainda passa pelo helper, que relê o doc.
 *   2. Trade sem `orders` ligadas (purgadas, INV-29) → "sem ordens para recalcular".
 *   3. Fill sem instante (#455: export com milissegundos lido como null) → bloqueado:
 *      sem instante não há como saber qual perna abriu a posição. Reimportar o arquivo.
 *   4. O lote inteiro é reconstruído (como no import) e o trade é casado com a operação
 *      cujas ordens executadas apontam para ele (`correlatedTradeId`).
 *   5. Stop: só é trocado quando veio do IMPORT (ver `stopOrigin`). Stop do aluno nunca.
 *   6. Lado, preços, quantidade e horários: só no trade CRIADO pelo import
 *      (`source === 'order_import'`), e só se as parciais gravadas são as mesmas execuções
 *      das ordens (mesmos pares preço×qtd) — senão o aluno editou: ambíguo.
 *   7. Se o RESULTADO do trade mudaria, bloqueado: o saldo da conta (`movements`) é
 *      ajustado só pelo cliente na edição; mexer aqui deixaria saldo e trade divergentes.
 *
 * Escrita: só campos que o trade já tem (INV-15); nada de campo de auditoria (trades não
 * têm convenção de edição do sistema — o JSON do relatório guarda o "antes" para
 * reverter). O update dispara `onTradeUpdated`, que recalcula compliance, riskPercent,
 * rrRatio, redFlags, PL do plano (se o resultado mudasse), prop firm e maturidade (INV-03).
 */

import { createRequire } from 'node:module';
import { reconstructOperations, associateNonFilledOrders } from '../../src/utils/orderReconstruction.js';
import { mapOperationToTradeData } from '../../src/utils/orderTradeCreation.js';
import { stagingDocsToOrders } from '../../src/utils/orderImportPipeline.js';
import { calculateFromPartials } from '../../src/utils/tradeCalculations.js';
import { calculateResultPercent } from '../../src/utils/calculations.js';
import { stopDistanceOf } from '../../src/utils/orderProtection.js';
import { offsetOf, instantAtOffsetMs } from '../../src/utils/orderInstant.js';
import { tzFromStoredIso, defaultTzForTicker } from '../../src/utils/tradeTimezone.js';

const require = createRequire(import.meta.url);
const { isTradeImmutable, updateTradeIfMutable } = require('../../functions/_shared/tradeImmutability.js');

// ============================================
// CATEGORIAS
// ============================================

export const CATEGORIA = Object.freeze({
  RECALCULADO: 'recalculado',
  INALTERADO: 'inalterado',
  DISCUTIDO: 'preservado_discutido',
  STOP_DO_ALUNO: 'preservado_stop_do_aluno',
  AMBIGUO: 'ambiguo',
  BLOQUEADO: 'bloqueado',
  SEM_ORDENS: 'sem_ordens',
});

/** Texto das regras, gravado no JSON — quem revisa o dry-run lê o critério junto. */
export const REGRAS = Object.freeze([
  'Trade DISCUTIDO nunca é alterado (INV-30).',
  'Stop só é trocado quando veio do import: trade criado pelo import com stop vazio ou igual a um preço de ordem ligada; trade enriquecido com stopLossSource="import", stop vazio, ou stop sobrescrito pelo enriquecimento (difere do _enrichmentSnapshot) e igual a preço de ordem.',
  'Stop com stopLossSource="student", stop de trade manual, ou stop do enriquecimento igual ao que o aluno já tinha (snapshot) → do aluno, nunca alterado.',
  'Stop que não bate com nenhum preço das ordens do trade → ambíguo (só entra com --include-ambiguous).',
  'Lado/preços/qtd/horários só no trade criado pelo import e só se as parciais gravadas são as mesmas execuções das ordens; senão ambíguo.',
  'Resultado que mudaria → bloqueado (saldo da conta em movements não é ajustado por script).',
  'Fill sem instante (#455) → bloqueado; trade sem orders → sem ordens para recalcular.',
]);

// ============================================
// HELPERS
// ============================================

const num = (v) => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

/** Stop gravado normalizado: vazio, 0 e lixo = sem stop. */
const stopOf = (v) => {
  const n = num(v);
  return n == null || n === 0 ? null : n;
};

const igual = (a, b, eps = 1e-6) => {
  if (a == null || b == null) return a == null && b == null;
  return Math.abs(a - b) <= eps;
};

const ehFill = (o) => o.status === 'FILLED' || o.status === 'PARTIALLY_FILLED';

/** Trade nascido do import de ordens (`mapOperationToTradeData`). */
export const criadoPeloImport = (t) => t?.source === 'order_import' || t?.importSource === 'order_import';

/** Data do trade em DD/MM/YYYY (INV-06). Data de 1970 (#455) sai como está. */
export const dataBR = (iso) => {
  const m = typeof iso === 'string' && iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
};

/**
 * Mesmo instante? O gravado pode ser ingênuo (legado) — lê no offset do novo.
 */
const mesmoInstante = (gravado, novo) => {
  if (!gravado || !novo) return !gravado && !novo;
  const off = offsetOf(novo);
  const a = instantAtOffsetMs(gravado, off);
  const b = instantAtOffsetMs(novo, off);
  return a != null && a === b;
};

/** Duração em minutos — mesma conta de `tradeGateway.calculateDuration`. */
const duracaoMin = (entryISO, exitISO) => {
  if (!entryISO || !exitISO) return 0;
  const d = new Date(exitISO) - new Date(entryISO);
  return Number.isFinite(d) ? Math.floor(d / 60000) : 0;
};

/**
 * Risco em R$ pela conta do compliance (`calculateTradeCompliance`, CF):
 * distância do stop (lado errado = sem stop, #467) ÷ tickSize × tickValue × qtd.
 * @returns {number|null} null quando não há stop que proteja
 */
export const riscoEmReais = ({ side, entry, qty, stopLoss, tickerRule }) => {
  const dist = stopDistanceOf(side, entry, stopLoss);
  if (dist == null) return null;
  const tickSize = tickerRule?.tickSize || 1;
  const tickValue = tickerRule?.tickValue || 1;
  return Math.round((dist / tickSize) * tickValue * (num(qty) ?? 1) * 100) / 100;
};

/** Pares preço×qtd das parciais, sem papel nem hora — as execuções em si. */
const execucoes = (partials) => (partials || [])
  .map(p => `${num(p.price)}|${num(p.qty)}`)
  .sort()
  .join(',');

/** Todos os preços que as ordens do trade carregam (enviado, gatilho, executado). */
const precosDasOrdens = (ordens) => {
  const s = [];
  for (const o of ordens || []) {
    for (const v of [o.stopPrice, o.limitPrice, o.price, o.filledPrice, o.avgFillPrice]) {
      const n = num(v);
      if (n != null && n > 0) s.push(n);
    }
  }
  return s;
};

/**
 * De onde veio o stop GRAVADO?
 *   'import'  — o import escreveu (pode ser recalculado);
 *   'student' — o aluno digitou (nunca recalcular);
 *   'ambiguo' — não há como afirmar.
 *
 * O que o código grava como evidência:
 *   - `stopLossSource` ('import' | 'student') — só o enriquecimento grava, desde o #371;
 *   - `source: 'order_import'` — trade criado pelo import: o stop nasceu do import
 *     (`mapOperationToTradeData`) e a edição posterior do aluno não deixa marca
 *     (`useTrades.updateTrade`). Stop igual a um preço das próprias ordens = do import;
 *     diferente de todos = alguém digitou → ambíguo;
 *   - `_enrichmentSnapshot.stopLoss` — o stop de ANTES do enriquecimento.
 */
export const stopOrigin = (trade, ordensDoTrade) => {
  if (trade.stopLossSource === 'student') return 'student';
  if (trade.stopLossSource === 'import') return 'import';
  const gravado = stopOf(trade.stopLoss);
  const deOrdem = gravado != null && precosDasOrdens(ordensDoTrade).some(p => igual(p, gravado, 1e-6));

  if (criadoPeloImport(trade)) {
    if (gravado == null) return 'import';      // o import grava null quando não comprova stop
    return deOrdem ? 'import' : 'ambiguo';
  }
  if (trade.enrichedByImport) {
    if (gravado == null) return 'import';      // enrichTrade preenche vazio com o do import
    const snap = trade._enrichmentSnapshot;
    if (snap && 'stopLoss' in snap && igual(stopOf(snap.stopLoss), gravado)) return 'student';
    if (snap && deOrdem) return 'import';      // enriquecimento pré-#371 sobrescreveu
    return 'ambiguo';
  }
  return 'student';                              // trade manual: o stop é do aluno
};

// ============================================
// RECONSTRUÇÃO DO LOTE
// ============================================

/** Fuso do trade: o offset gravado (#292) ou, sem ele, o padrão do ativo. */
export const fusoDoTrade = (trade) => tzFromStoredIso(trade?.entryTime) || defaultTzForTicker(trade?.ticker);

/**
 * Reconstrói as operações de um conjunto de docs de `orders` exatamente como o import.
 * `stagingDocsToOrders` dá a ordenação determinística e o `_rowIndex`; o `correlatedTradeId`
 * e o id do doc atravessam a reconstrução (`_docId`) para casar operação ↔ trade.
 */
export const reconstruirLote = (docs, timezone) => {
  const ordens = stagingDocsToOrders(docs.map(d => ({ ...d, _docId: d.id })));
  const ops = reconstructOperations(ordens, { timezone });
  associateNonFilledOrders(ops, ordens, { timezone });
  return ops;
};

/** A operação do trade: a que tem mais execuções ligadas a ele. Empate = indecidível. */
export const operacaoDoTrade = (ops, tradeId) => {
  let melhor = null;
  let maior = 0;
  let empate = false;
  for (const op of ops) {
    if (op._isOpen) continue;
    const n = [...(op.entryOrders || []), ...(op.exitOrders || [])]
      .filter(o => o.correlatedTradeId === tradeId).length;
    if (n > maior) { melhor = op; maior = n; empate = false; } else if (n > 0 && n === maior) empate = true;
  }
  return empate ? null : melhor;
};

// ============================================
// PROPOSTA POR TRADE
// ============================================

/**
 * Compara o trade gravado com o que o import produz hoje a partir das mesmas ordens.
 *
 * @param {Object} trade — doc do trade (com `id`)
 * @param {Object[]} ordensDoTrade — docs de `orders` com `correlatedTradeId === trade.id`
 * @param {Object[]} ordensDoLote — docs de `orders` dos lotes (batchId) dessas ordens
 * @returns {{ categoria, motivos: string[], mudancas: Object, patch: Object|null,
 *             riscoAntes: number|null, riscoDepois: number|null, origemStop: string|null }}
 */
export const proporRecalculo = (trade, ordensDoTrade, ordensDoLote) => {
  const base = {
    categoria: CATEGORIA.INALTERADO, motivos: [], mudancas: {}, patch: null,
    riscoAntes: riscoEmReais(trade), riscoDepois: riscoEmReais(trade), origemStop: null,
  };

  if (isTradeImmutable(trade)) {
    return { ...base, categoria: CATEGORIA.DISCUTIDO, motivos: ['trade discutido — imutável (INV-30)'] };
  }
  if (!ordensDoTrade?.length) {
    return { ...base, categoria: CATEGORIA.SEM_ORDENS, motivos: ['sem ordens para recalcular (orders purgadas)'] };
  }
  if (ordensDoTrade.some(o => ehFill(o) && !o.filledAt && !o.submittedAt)) {
    return {
      ...base,
      categoria: CATEGORIA.BLOQUEADO,
      motivos: ['ordem executada sem instante (#455) — não há como saber qual perna abriu; reimportar o arquivo'],
    };
  }

  const ops = reconstruirLote(ordensDoLote?.length ? ordensDoLote : ordensDoTrade, fusoDoTrade(trade));
  const op = operacaoDoTrade(ops, trade.id);
  if (!op) {
    return {
      ...base,
      categoria: CATEGORIA.BLOQUEADO,
      motivos: ['a reconstrução não encontra UMA operação fechada com as execuções deste trade'],
    };
  }

  const td = mapOperationToTradeData(op, trade.planId || '-', null, trade.tickerRule ?? null);
  const motivos = [];
  const mudancas = {};
  const patch = {};
  let ambiguo = false;

  // ---- posição (só trade criado pelo import) ----
  const novo = {
    side: td.side,
    entry: num(td.entry),
    exit: num(td.exit),
    qty: num(td.qty),
    entryTime: td.entryTime,
    exitTime: td.exitTime,
  };
  const posicaoDifere = criadoPeloImport(trade) && (
    trade.side !== novo.side
    || !igual(num(trade.entry), novo.entry, 1e-3)
    || !igual(num(trade.exit), novo.exit, 1e-3)
    || !igual(num(trade.qty), novo.qty, 1e-9)
    || !mesmoInstante(trade.entryTime, novo.entryTime)
    || !mesmoInstante(trade.exitTime, novo.exitTime)
  );
  let ladoFinal = trade.side;
  let entradaFinal = trade.entry;
  let qtdFinal = trade.qty;

  if (posicaoDifere) {
    const mesmasExecucoes = execucoes(trade._partials) === execucoes(td._partials);
    if (!mesmasExecucoes || trade.resultEdited === true) {
      ambiguo = true;
      motivos.push(trade.resultEdited === true
        ? 'posição difere, mas o resultado foi editado pelo aluno'
        : 'posição difere, e as parciais gravadas não são as execuções das ordens (editado pelo aluno?)');
    }
    const calc = calculateFromPartials({ side: novo.side, partials: td._partials, tickerRule: trade.tickerRule || null });
    const resultadoGravado = num(trade.result) ?? 0;
    if (Math.abs(calc.result - resultadoGravado) > 0.01) {
      return {
        ...base,
        categoria: CATEGORIA.BLOQUEADO,
        motivos: [`resultado mudaria (R$ ${resultadoGravado} → ${calc.result}): o saldo em movements não é ajustado por script`],
      };
    }
    for (const campo of ['side', 'entry', 'exit', 'qty', 'entryTime', 'exitTime']) {
      const antes = trade[campo] ?? null;
      const depois = novo[campo] ?? null;
      const mudou = (campo === 'entryTime' || campo === 'exitTime')
        ? !mesmoInstante(antes, depois)
        : (typeof depois === 'number' ? !igual(num(antes), depois, 1e-9) : antes !== depois);
      if (mudou) mudancas[campo] = { antes, depois };
      patch[campo] = depois;
    }
    // Derivados que o createTrade grava junto (todos já existem no doc — INV-15).
    patch.date = novo.entryTime ? novo.entryTime.slice(0, 10) : trade.date;
    patch.duration = duracaoMin(novo.entryTime, novo.exitTime);
    patch._partials = td._partials;
    patch.hasPartials = td._partials.length > 0;
    patch.partialsCount = td._partials.length;
    patch.resultCalculated = Math.round(calc.result * 100) / 100;
    patch.resultInPoints = calc.resultInPoints;
    patch.resultPercent = calculateResultPercent(novo.side, novo.entry, novo.exit);
    if (patch.date !== trade.date) mudancas.date = { antes: trade.date ?? null, depois: patch.date };
    if ('avgEntry' in trade) patch.avgEntry = calc.avgEntry;
    if ('avgExit' in trade) patch.avgExit = calc.avgExit;
    if ('totalQty' in trade) patch.totalQty = calc.realizedQty;
    motivos.push('posição reconstruída das ordens (lado/preço/horário do import antigo)');
    ladoFinal = novo.side;
    entradaFinal = novo.entry;
    qtdFinal = novo.qty;
  }

  // ---- stop ----
  const stopGravado = stopOf(trade.stopLoss);
  const stopNovo = stopOf(td.stopLoss);
  let origem = null;
  let stopDoAluno = false;
  if (!igual(stopGravado, stopNovo)) {
    origem = stopOrigin(trade, ordensDoTrade);
    if (origem === 'student') {
      stopDoAluno = true;
      motivos.push(`stop ${stopGravado ?? 'vazio'} é do aluno — preservado (as ordens dariam ${stopNovo ?? 'sem stop'})`);
    } else {
      if (origem === 'ambiguo') {
        ambiguo = true;
        motivos.push(`stop ${stopGravado} não bate com nenhum preço das ordens — digitado? (ordens dão ${stopNovo ?? 'sem stop'})`);
      } else {
        motivos.push(stopNovo == null
          ? 'stop do import antigo sem comprovação por perna → sem stop (#466)'
          : 'stop recalculado pelas pernas (#466)');
      }
      mudancas.stopLoss = { antes: trade.stopLoss ?? null, depois: stopNovo };
      patch.stopLoss = stopNovo;
    }
  }

  const riscoDepois = riscoEmReais({
    side: ladoFinal,
    entry: entradaFinal,
    qty: qtdFinal,
    stopLoss: 'stopLoss' in patch ? patch.stopLoss : trade.stopLoss,
    tickerRule: trade.tickerRule,
  });

  if (Object.keys(mudancas).length === 0) {
    return {
      ...base,
      categoria: stopDoAluno ? CATEGORIA.STOP_DO_ALUNO : CATEGORIA.INALTERADO,
      motivos,
      origemStop: origem,
    };
  }

  return {
    categoria: ambiguo ? CATEGORIA.AMBIGUO : CATEGORIA.RECALCULADO,
    motivos,
    mudancas,
    patch,
    riscoAntes: base.riscoAntes,
    riscoDepois,
    origemStop: origem,
  };
};

// ============================================
// EXECUÇÃO (Firestore injetado — admin SDK no CLI, fake nos testes)
// ============================================

const docsDe = (snap) => snap.docs.map(d => ({ id: d.id, ...d.data() }));

/** Trade entra no recálculo: veio do import (criado ou enriquecido) ou tem ordens ligadas. */
const candidato = (t, ligadas) => criadoPeloImport(t) || t.enrichedByImport === true || ligadas.length > 0;

/**
 * `--since`: pela data do trade OU das ordens ligadas — o trade de 1970 (#455) tem a data
 * errada justamente, e data anterior a 2000 é sempre lixo de epoch: entra.
 */
const dentroDoPeriodo = (t, ligadas, since) => {
  if (!since) return true;
  if (typeof t.date === 'string' && t.date >= since) return true;
  if (typeof t.date === 'string' && t.date < '2000-01-01') return true;
  return ligadas.some(o => String(o.filledAt || o.submittedAt || '').slice(0, 10) >= since);
};

/**
 * @param {Object} db — Firestore (admin SDK ou fake com collection/doc/where/get/update)
 * @param {Object} opts — { student, trade, since, apply, includeAmbiguous }
 * @param {Object} [deps] — { recomputeBehaviorForStudent?, admin?, log? }
 * @returns {Promise<{ linhas: Object[], resumo: Object, escritos: string[], preservadosNaEscrita: string[] }>}
 */
export async function runRecalc(db, opts = {}, deps = {}) {
  const log = deps.log || (() => {});

  // 1. Trades no escopo
  let trades;
  if (opts.trade) {
    const s = await db.collection('trades').doc(opts.trade).get();
    trades = s.exists ? [{ id: s.id, ...s.data() }] : [];
  } else if (opts.student) {
    trades = docsDe(await db.collection('trades').where('studentId', '==', opts.student).get());
  } else {
    trades = docsDe(await db.collection('trades').get());
  }

  // 2. Ordens por aluno (uma leitura por aluno; o lote inteiro sai daqui)
  const ordensPorAluno = new Map();
  const ordensDoAluno = async (uid) => {
    if (!ordensPorAluno.has(uid)) {
      ordensPorAluno.set(uid, uid ? docsDe(await db.collection('orders').where('studentId', '==', uid).get()) : []);
    }
    return ordensPorAluno.get(uid);
  };

  const linhas = [];
  for (const t of trades) {
    const doAluno = await ordensDoAluno(t.studentId);
    const ligadas = doAluno.filter(o => o.correlatedTradeId === t.id);
    if (!candidato(t, ligadas)) continue;
    if (!dentroDoPeriodo(t, ligadas, opts.since)) continue;

    const lotes = new Set(ligadas.map(o => o.batchId).filter(Boolean));
    const vistos = new Set();
    const doLote = [];
    for (const o of [...doAluno.filter(o => o.batchId && lotes.has(o.batchId)), ...ligadas]) {
      if (vistos.has(o.id)) continue;
      vistos.add(o.id);
      doLote.push(o);
    }

    const p = proporRecalculo(t, ligadas, doLote);
    linhas.push({
      studentId: t.studentId || null,
      studentName: t.studentName || t.studentEmail || null,
      tradeId: t.id,
      data: t.date || null,
      ticker: t.ticker || null,
      side: t.side || null,
      ...p,
    });
  }

  // 3. Escrita (só --apply). Sempre pelo helper de imutabilidade: ele RELÊ o doc, então
  //    um trade discutido entre o dry-run e o apply continua preservado.
  const escritos = [];
  const preservadosNaEscrita = [];
  if (opts.apply) {
    const aplicaveis = linhas.filter(l => l.patch && (
      l.categoria === CATEGORIA.RECALCULADO
      || (opts.includeAmbiguous && l.categoria === CATEGORIA.AMBIGUO)));
    for (const l of aplicaveis) {
      const ref = db.collection('trades').doc(l.tradeId);
      const r = await updateTradeIfMutable(ref, l.patch);
      if (r.written) { escritos.push(l.tradeId); l.aplicado = true; }
      if (r.preserved) { preservadosNaEscrita.push(l.tradeId); l.aplicado = false; l.motivos.push('discutido no momento da escrita — preservado'); }
      log(`[recalc] ${l.tradeId}: ${r.written ? 'gravado' : 'não gravado'}`);
    }

    // `behaviorProfile` é snapshot no doc do trade e `onTradeUpdated` não o refaz:
    // recompute pela MESMA função da CF, por aluno afetado (discutidos preservados nela).
    if (escritos.length && typeof deps.recomputeBehaviorForStudent === 'function') {
      if (typeof deps.aguardar === 'function') await deps.aguardar();
      const alunos = new Set(linhas.filter(l => l.aplicado).map(l => l.studentId).filter(Boolean));
      for (const uid of alunos) {
        const r = await deps.recomputeBehaviorForStudent(db, deps.admin, uid, { computedBy: 'recalc-468' });
        log(`[recalc] behaviorProfile ${uid}: ${r?.written ?? 0} gravados, ${r?.preserved ?? 0} discutidos preservados`);
      }
    }
  }

  const resumo = {};
  for (const c of Object.values(CATEGORIA)) resumo[c] = 0;
  for (const l of linhas) resumo[l.categoria] += 1;
  resumo.escritos = escritos.length;

  return { linhas, resumo, escritos, preservadosNaEscrita };
}

// ============================================
// RELATÓRIO
// ============================================

const fmt = (v) => {
  if (v == null) return '∅';
  if (typeof v === 'number') return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  return String(v);
};

const fmtCampo = (campo, v) => {
  if (v == null) return '∅';
  if ((campo === 'entryTime' || campo === 'exitTime') && typeof v === 'string') {
    return `${dataBR(v)} ${v.slice(11, 19)}`;
  }
  if (campo === 'date') return dataBR(v);
  return fmt(v);
};

/** Tabela de texto por aluno + resumo. */
export const formatarRelatorio = ({ linhas, resumo }, opts = {}) => {
  const out = [];
  const porAluno = new Map();
  for (const l of linhas) {
    const k = l.studentId || '(sem aluno)';
    if (!porAluno.has(k)) porAluno.set(k, []);
    porAluno.get(k).push(l);
  }
  for (const [uid, ls] of porAluno) {
    out.push('');
    out.push(`== Aluno ${ls[0].studentName || ''} (${uid}) — ${ls.length} trade(s)`);
    for (const l of ls) {
      out.push(`  ${dataBR(l.data)}  ${String(l.ticker || '').padEnd(8)} ${String(l.side || '').padEnd(5)} ${l.tradeId}  [${l.categoria}]${l.aplicado ? ' APLICADO' : ''}`);
      for (const [campo, m] of Object.entries(l.mudancas || {})) {
        out.push(`      ${campo}: ${fmtCampo(campo, m.antes)} → ${fmtCampo(campo, m.depois)}`);
      }
      if (l.patch) out.push(`      risco R$: ${fmt(l.riscoAntes)} → ${fmt(l.riscoDepois)}`);
      for (const m of l.motivos || []) out.push(`      motivo: ${m}`);
    }
  }
  out.push('');
  out.push('== Resumo');
  for (const [k, v] of Object.entries(resumo)) out.push(`  ${k.padEnd(26)} ${v}`);
  out.push('');
  out.push(opts.apply
    ? `APLICADO${opts.includeAmbiguous ? ' (inclui ambíguos)' : ''}.`
    : 'DRY-RUN — nada escrito. Revise e repita com --apply.');
  return out.join('\n');
};
