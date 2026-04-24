#!/usr/bin/env node
/**
 * issue-183-clean-orphan-plans.mjs — run-once cleanup de planos órfãos
 *
 * CONTEXTO (issue #183):
 *   Bug em `src/hooks/usePlans.js:141` gravava `studentId = user.uid` mesmo
 *   quando o criador era o mentor atuando em nome do aluno. Resultado:
 *   planos com `studentId == MENTOR.uid` / `studentEmail == MENTOR_EMAIL`
 *   que o aluno (filtro `where studentId == user.uid`) nunca enxerga.
 *
 * CRITÉRIO DE ÓRFÃO:
 *   plan.studentEmail === MENTOR_EMAIL  (marcio.portes@me.com)
 *
 * ESTRATÉGIA: delete puro com cascade (movements → trades → plan),
 *   idêntico ao `usePlans.deletePlan`. Sem remap — consistente com DEC-AUTO-183-01.
 *
 * MODO DRY-RUN (default):
 *   node scripts/issue-183-clean-orphan-plans.mjs
 *
 * MODO EXECUTE (destrutivo, requer dupla confirmação):
 *   node scripts/issue-183-clean-orphan-plans.mjs --execute --confirm=SIM
 *
 * PRÉ-REQUISITOS:
 *   Uma das duas opções para credenciais do Firebase Admin SDK:
 *   (a) Application Default Credentials:
 *         gcloud auth application-default login
 *   (b) Service Account Key:
 *         export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
 *
 * LOG:
 *   scripts/logs/issue-183-{dryrun|execute}-<ISO8601>.json
 */

import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const LOGS_DIR = join(PROJECT_ROOT, 'scripts', 'logs');

// firebase-admin está em `functions/node_modules/` (única subprojeto que depende dele).
// Resolvemos via createRequire para evitar adicionar a dep no root apenas para este script run-once.
const require = createRequire(import.meta.url);
const admin = require(join(PROJECT_ROOT, 'functions', 'node_modules', 'firebase-admin'));

const MENTOR_EMAIL = 'marcio.portes@me.com';
const PROJECT_ID = 'acompanhamento-20';

// ---------- CLI args ----------
const args = process.argv.slice(2);
const EXECUTE = args.includes('--execute');
const CONFIRM_FLAG = args.find((a) => a.startsWith('--confirm='));
const CONFIRMED = CONFIRM_FLAG === '--confirm=SIM';

if (EXECUTE && !CONFIRMED) {
  console.error('\n❌ --execute requer --confirm=SIM (dupla confirmação obrigatória).\n');
  console.error('   Uso correto: node scripts/issue-183-clean-orphan-plans.mjs --execute --confirm=SIM\n');
  process.exit(1);
}

const MODE = EXECUTE ? 'execute' : 'dryrun';

// ---------- Init admin SDK ----------
try {
  if (!admin.apps.length) {
    admin.initializeApp({ projectId: PROJECT_ID });
  }
} catch (err) {
  console.error('\n❌ Falha ao inicializar Firebase Admin SDK.');
  console.error('   Verifique credenciais:');
  console.error('   (a) gcloud auth application-default login');
  console.error('   (b) export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json\n');
  console.error('   Erro:', err.message);
  process.exit(2);
}

const db = admin.firestore();

// ---------- Helpers ----------
function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function writeLog(mode, payload) {
  if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });
  const path = join(LOGS_DIR, `issue-183-${mode}-${ts()}.json`);
  writeFileSync(path, JSON.stringify(payload, null, 2));
  return path;
}

function fmt(v) {
  if (v == null) return '(null)';
  if (typeof v === 'string') return v.length > 30 ? v.slice(0, 27) + '...' : v;
  return String(v);
}

// ---------- Main ----------
async function main() {
  console.log(`\n🔍 issue-183 — cleanup de planos órfãos [${MODE.toUpperCase()}]`);
  console.log(`   Projeto: ${PROJECT_ID}`);
  console.log(`   Critério: plans.studentEmail == "${MENTOR_EMAIL}"\n`);

  // 1) Identificar órfãos
  const orphansSnap = await db
    .collection('plans')
    .where('studentEmail', '==', MENTOR_EMAIL)
    .get();

  if (orphansSnap.empty) {
    console.log('✅ Nenhum plano órfão encontrado. Nada a fazer.\n');
    const logPath = writeLog(MODE, {
      mode: MODE,
      mentorEmail: MENTOR_EMAIL,
      orphansFound: 0,
      plans: [],
      deleted: { plans: 0, trades: 0, movements: 0 },
    });
    console.log(`   Log: ${logPath}\n`);
    return;
  }

  // 2) Enriquecer com contagem de trades + movements
  const plans = [];
  let totalTrades = 0;
  let totalMovements = 0;

  for (const doc of orphansSnap.docs) {
    const data = doc.data();
    const tradesSnap = await db
      .collection('trades')
      .where('planId', '==', doc.id)
      .get();

    let movementsCount = 0;
    for (const tradeDoc of tradesSnap.docs) {
      const movSnap = await db
        .collection('movements')
        .where('tradeId', '==', tradeDoc.id)
        .get();
      movementsCount += movSnap.size;
    }

    const createdAt = data.createdAt?.toDate?.()?.toISOString?.() ?? null;

    plans.push({
      id: doc.id,
      name: data.name ?? '(sem nome)',
      accountId: data.accountId ?? null,
      studentId: data.studentId ?? null,
      studentEmail: data.studentEmail ?? null,
      studentName: data.studentName ?? null,
      createdBy: data.createdBy ?? null,
      createdByEmail: data.createdByEmail ?? null,
      createdAt,
      active: data.active ?? null,
      pl: data.pl ?? null,
      currentPl: data.currentPl ?? null,
      tradesCount: tradesSnap.size,
      movementsCount,
    });

    totalTrades += tradesSnap.size;
    totalMovements += movementsCount;
  }

  // 3) Print tabela
  console.log(`📋 ${plans.length} plano(s) órfão(s) encontrado(s):\n`);
  console.log(
    '  #  planId                      name                              accountId                   trades  movs  created'
  );
  console.log(
    '  ── ─────────────────────────── ───────────────────────────────── ─────────────────────────── ─────── ───── ──────────────────────'
  );
  plans.forEach((p, i) => {
    const row = [
      String(i + 1).padStart(2),
      fmt(p.id).padEnd(27),
      fmt(p.name).padEnd(33),
      fmt(p.accountId).padEnd(27),
      String(p.tradesCount).padStart(7),
      String(p.movementsCount).padStart(5),
      fmt(p.createdAt),
    ].join(' ');
    console.log(`  ${row}`);
  });

  console.log(
    `\n  TOTAL: ${plans.length} planos · ${totalTrades} trades · ${totalMovements} movements\n`
  );

  // 4) Dry-run → só loga e sai
  if (!EXECUTE) {
    const logPath = writeLog('dryrun', {
      mode: 'dryrun',
      mentorEmail: MENTOR_EMAIL,
      orphansFound: plans.length,
      plans,
      totals: { plans: plans.length, trades: totalTrades, movements: totalMovements },
    });
    console.log(`💾 Log JSON: ${logPath}`);
    console.log('\n⚠️  DRY-RUN — nenhum documento foi removido.');
    console.log('   Para executar: --execute --confirm=SIM\n');
    return;
  }

  // 5) EXECUTE — cascade delete
  console.log('🗑️  EXECUTE ativado — iniciando cascade delete...\n');

  const deleted = { plans: [], trades: [], movements: [] };
  const errors = [];

  for (const plan of plans) {
    try {
      // 5.1) movements de cada trade
      const tradesSnap = await db
        .collection('trades')
        .where('planId', '==', plan.id)
        .get();

      for (const tradeDoc of tradesSnap.docs) {
        const movSnap = await db
          .collection('movements')
          .where('tradeId', '==', tradeDoc.id)
          .get();
        for (const movDoc of movSnap.docs) {
          await movDoc.ref.delete();
          deleted.movements.push(movDoc.id);
        }
      }

      // 5.2) trades
      for (const tradeDoc of tradesSnap.docs) {
        await tradeDoc.ref.delete();
        deleted.trades.push(tradeDoc.id);
      }

      // 5.3) plan
      await db.collection('plans').doc(plan.id).delete();
      deleted.plans.push(plan.id);

      console.log(
        `  ✅ ${plan.id} (${plan.name}) — ${plan.tradesCount} trades + ${plan.movementsCount} movements`
      );
    } catch (err) {
      console.error(`  ❌ ${plan.id} — ${err.message}`);
      errors.push({ planId: plan.id, error: err.message });
    }
  }

  const logPath = writeLog('execute', {
    mode: 'execute',
    mentorEmail: MENTOR_EMAIL,
    orphansFound: plans.length,
    plans,
    deleted: {
      plans: deleted.plans.length,
      trades: deleted.trades.length,
      movements: deleted.movements.length,
      planIds: deleted.plans,
      tradeIds: deleted.trades,
      movementIds: deleted.movements,
    },
    errors,
  });

  console.log(
    `\n✅ Cleanup concluído: ${deleted.plans.length} planos · ${deleted.trades.length} trades · ${deleted.movements.length} movements`
  );
  if (errors.length) console.log(`⚠️  ${errors.length} erro(s) — ver log.`);
  console.log(`💾 Log JSON: ${logPath}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Erro fatal:', err);
    process.exit(3);
  });
