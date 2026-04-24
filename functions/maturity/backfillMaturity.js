#!/usr/bin/env node
// ============================================
// MATURITY ENGINE — Backfill script (issue #119 task 09)
// ============================================
//
// Script one-off que percorre todos os alunos e força recálculo de
// `students/{uid}/maturity/current` + `.../maturity/_historyBucket/history/{date}`.
// Necessário na primeira release: alunos inativos só ganhariam doc `maturity/current`
// no próximo trade CLOSED, então backfill cobre o gap.
//
// Uso:
//   node functions/maturity/backfillMaturity.js [options]
//
// Options:
//   --dry-run           Não grava no Firestore, só lista alunos que seriam processados.
//   --student-id=<id>   Processa apenas um aluno específico (debug/validação).
//   --concurrency=<N>   Chamadas paralelas (default: 5). Ajustar se quotas Firestore pressionarem.
//
// Pré-requisitos:
//   - `GOOGLE_APPLICATION_CREDENTIALS` apontando para service account JSON,
//     OU Application Default Credentials configurado (`gcloud auth application-default login`).
//   - Task 07 (CF `onTradeCreated/Updated` com runMaturityRecompute) já deployada —
//     assim trades novos continuam recomputando automaticamente após o backfill.
//
// Checklist operacional (executar nesta ordem):
//   1. `node functions/maturity/backfillMaturity.js --dry-run`                (lista alunos)
//   2. `node functions/maturity/backfillMaturity.js --student-id=<uid>`      (valida em 1 aluno)
//   3. Revisar logs de (2) — confirmar stage/window coerentes
//   4. `node functions/maturity/backfillMaturity.js`                          (produção)
//   5. Auditoria via Firestore console: `students/{uid}/maturity/current`.

const { recomputeForStudent } = require('./recomputeMaturity');

function parseArgs(argv) {
  const args = { dryRun: false, studentId: null, concurrency: 5 };
  for (const a of argv.slice(2)) {
    if (a === '--dry-run') {
      args.dryRun = true;
    } else if (a.startsWith('--student-id=')) {
      args.studentId = a.slice('--student-id='.length);
    } else if (a.startsWith('--concurrency=')) {
      const n = parseInt(a.slice('--concurrency='.length), 10);
      if (Number.isFinite(n) && n > 0) args.concurrency = n;
    }
  }
  return args;
}

async function listStudentIds(db, filterStudentId) {
  if (filterStudentId) {
    const snap = await db.collection('students').doc(filterStudentId).get();
    return snap.exists ? [filterStudentId] : [];
  }
  const snap = await db.collection('students').get();
  return snap.docs.map((d) => d.id);
}

async function runConcurrent(items, concurrency, handler) {
  const results = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (idx < items.length) {
      const my = idx++;
      results[my] = await handler(items[my], my);
    }
  });
  await Promise.all(workers);
  return results;
}

async function main() {
  const args = parseArgs(process.argv);

  // Lazy require: pure helpers above (parseArgs/listStudentIds/runConcurrent)
  // podem ser testados sem o package firebase-admin instalado.
  // eslint-disable-next-line global-require
  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  const db = admin.firestore();

  const studentIds = await listStudentIds(db, args.studentId);
  console.log(
    `[backfill] ${studentIds.length} aluno(s) para processar${args.dryRun ? ' (DRY-RUN)' : ''}`,
  );

  if (args.dryRun) {
    for (const sid of studentIds) console.log(`[backfill][dry-run] would process ${sid}`);
    console.log('[backfill] dry-run concluído');
    return;
  }

  const started = Date.now();
  const results = await runConcurrent(studentIds, args.concurrency, async (sid) => {
    try {
      const res = await recomputeForStudent(db, sid, { admin });
      if (res.skipped) {
        console.log(`[backfill] ${sid}: SKIP (${res.reason})`);
      } else {
        console.log(
          `[backfill] ${sid}: OK stage=${res.currentStage} window=${res.windowSize}`,
        );
      }
      return res;
    } catch (err) {
      console.error(`[backfill] ${sid}: EXCEPTION`, err);
      return { skipped: true, reason: 'exception', error: err.message };
    }
  });

  const okCount = results.filter((r) => !r.skipped).length;
  const skipCount = results.length - okCount;
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `[backfill] concluído em ${elapsed}s: ${okCount} OK, ${skipCount} SKIP`,
  );
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[backfill] fatal:', err);
    process.exit(1);
  });
}

module.exports = { parseArgs, listStudentIds, runConcurrent, main };
