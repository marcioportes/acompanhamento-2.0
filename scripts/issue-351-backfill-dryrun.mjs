#!/usr/bin/env node
/**
 * issue-351-backfill-dryrun.mjs — dry-run do backfill de correlação de ordens órfãs (#351).
 *
 * READ-ONLY. Importa `correlateOrders` de `src/utils/orderCorrelation.js` — a MESMA função
 * corrigida que o import usa em runtime, sem reimplementar a regra. Mede quantos docs de
 * `orders` hoje com `correlatedTradeId: null` passariam a correlacionar com a regra de
 * contenção no intervalo do trade.
 *
 * NÃO escreve nada. Só lê e conta.
 *
 * USO:
 *   node scripts/issue-351-backfill-dryrun.mjs                 # todos os alunos
 *   node scripts/issue-351-backfill-dryrun.mjs <studentId>     # escopa a um aluno
 *
 * PRÉ-REQUISITOS:
 *   gcloud auth application-default login
 *
 * LOG:
 *   scripts/logs/issue-351-backfill-dryrun-<ISO8601>.json
 */

import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { correlateOrders } from '../src/utils/orderCorrelation.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const LOGS_DIR = join(PROJECT_ROOT, 'scripts', 'logs');

const require = createRequire(import.meta.url);
const admin = require(join(PROJECT_ROOT, 'functions', 'node_modules', 'firebase-admin'));

const onlyStudentId = process.argv[2] || null;

admin.initializeApp({ projectId: 'acompanhamento-20' });
const db = admin.firestore();

/** Órfão elegível: fill sem trade associado. Cancelled é escopo de outra regra. */
const isFilledOrphan = (o) =>
  (o.status === 'FILLED' || o.status === 'PARTIALLY_FILLED') && !o.correlatedTradeId;

/**
 * Doc de `orders` → shape que correlateOrders consome. `_rowIndex` carrega o docId:
 * a função só o usa como identificador opaco (`correlation.orderIndex`), então é o
 * caminho de volta do resultado para o doc sem tocar na assinatura dela.
 */
const toCorrelatable = (doc) => {
  const d = doc.data();
  return {
    _rowIndex: doc.id,
    instrument: d.instrument,
    side: d.side,
    status: d.status,
    quantity: d.quantity,
    filledQuantity: d.filledQuantity,
    filledPrice: d.filledPrice,
    submittedAt: d.submittedAt,
    filledAt: d.filledAt,
  };
};

async function main() {
  console.log(`[351-dryrun] iniciando (READ-ONLY)${onlyStudentId ? ` — aluno ${onlyStudentId}` : ' — todos os alunos'}`);

  let ordersSnap;
  if (onlyStudentId) {
    ordersSnap = await db.collection('orders').where('studentId', '==', onlyStudentId).get();
  } else {
    ordersSnap = await db.collection('orders').get();
  }

  const orphans = ordersSnap.docs.filter((d) => isFilledOrphan(d.data()));
  const cancelledOrphans = ordersSnap.docs.filter(
    (d) => !d.data().correlatedTradeId && d.data().status !== 'FILLED' && d.data().status !== 'PARTIALLY_FILLED',
  );

  console.log(`[351-dryrun] ${ordersSnap.size} orders lidas · ${orphans.length} fills órfãos · ${cancelledOrphans.length} não-fills órfãos (fora de escopo)`);

  if (!orphans.length) {
    console.log('[351-dryrun] nada a fazer.');
    return { totals: { orphans: 0, wouldMatch: 0, stillOrphan: 0 }, perStudent: [], samples: [] };
  }

  // Agrupa por plano — a correlação só faz sentido contra os trades do mesmo plano.
  const byPlan = new Map();
  for (const doc of orphans) {
    const planId = doc.data().planId || '__sem_plano__';
    if (!byPlan.has(planId)) byPlan.set(planId, []);
    byPlan.get(planId).push(doc);
  }

  const tradesCache = new Map();
  const loadTrades = async (planId) => {
    if (tradesCache.has(planId)) return tradesCache.get(planId);
    const snap = await db.collection('trades').where('planId', '==', planId).get();
    const trades = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    tradesCache.set(planId, trades);
    return trades;
  };

  const perStudentMap = new Map();
  const samples = [];
  let wouldMatch = 0;
  let stillOrphan = 0;
  // Discrimina a origem do match: a regra nova (#351, contenção no intervalo) ou a regra
  // que já existia (proximidade de ponta). Órfão que casa por PONTA nunca foi um problema
  // de janela — é sintoma de o trade não existir no instante em que a correlação rodou.
  let byContainment = 0;
  let byEndpoint = 0;
  let planWithoutTrades = 0;

  for (const [planId, docs] of byPlan) {
    if (planId === '__sem_plano__') {
      stillOrphan += docs.length;
      continue;
    }

    const trades = await loadTrades(planId);
    const { correlations } = correlateOrders(docs.map(toCorrelatable), trades);
    const byDocId = new Map(correlations.map((c) => [c.orderIndex, c]));

    for (const doc of docs) {
      const d = doc.data();
      const sid = d.studentId || '—';
      if (!perStudentMap.has(sid)) {
        perStudentMap.set(sid, { studentId: sid, orphans: 0, wouldMatch: 0, stillOrphan: 0 });
      }
      const bucket = perStudentMap.get(sid);
      bucket.orphans++;

      const corr = byDocId.get(doc.id);
      if (corr?.tradeId) {
        wouldMatch++;
        bucket.wouldMatch++;
        if (String(corr.details || '').includes('dentro da operação')) byContainment++;
        else byEndpoint++;
        if (samples.length < 25) {
          samples.push({
            orderId: doc.id,
            studentId: sid,
            planId,
            instrument: d.instrument,
            side: d.side,
            qty: d.filledQuantity ?? d.quantity ?? null,
            filledAt: d.filledAt ?? d.submittedAt ?? null,
            tradeId: corr.tradeId,
            role: corr.role,
            confidence: corr.confidence,
            details: corr.details,
          });
        }
      } else {
        stillOrphan++;
        bucket.stillOrphan++;
        if (!trades.length) planWithoutTrades++;
      }
    }
  }

  const perStudent = [...perStudentMap.values()].sort((a, b) => b.wouldMatch - a.wouldMatch);
  const totals = {
    ordersTotal: ordersSnap.size,
    orphans: orphans.length,
    cancelledOrphansOutOfScope: cancelledOrphans.length,
    wouldMatch,
    byContainment,
    byEndpoint,
    stillOrphan,
    stillOrphanInPlanWithoutTrades: planWithoutTrades,
  };

  console.log('');
  console.log(`[351-dryrun] fills órfãos que passariam a correlacionar: ${wouldMatch}`);
  console.log(`[351-dryrun]   · por contenção no intervalo (regra nova do #351): ${byContainment}`);
  console.log(`[351-dryrun]   · por proximidade de ponta (regra que JÁ existia): ${byEndpoint}`);
  console.log(`[351-dryrun] seguem órfãos: ${stillOrphan} (dos quais ${planWithoutTrades} em plano sem nenhum trade)`);
  console.log('');
  console.log('Por aluno:');
  for (const s of perStudent) {
    console.log(`  ${s.studentId}  órfãos=${s.orphans}  corrigíveis=${s.wouldMatch}  restam=${s.stillOrphan}`);
  }

  if (samples.length) {
    console.log('');
    console.log(`Amostra (até 25 de ${wouldMatch}):`);
    for (const s of samples) {
      console.log(`  ${s.instrument} ${s.side} ${s.qty}x @ ${s.filledAt} → trade ${s.tradeId} (${s.role}, ${s.details})`);
    }
  }

  return { totals, perStudent, samples };
}

main()
  .then((result) => {
    if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const path = join(LOGS_DIR, `issue-351-backfill-dryrun-${stamp}.json`);
    writeFileSync(path, JSON.stringify(result, null, 2));
    console.log(`\n[351-dryrun] log: ${path}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('[351-dryrun] ERRO:', err);
    process.exit(1);
  });
