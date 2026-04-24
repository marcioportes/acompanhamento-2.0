#!/usr/bin/env node
/**
 * issue-183-repair-orphan-plans.mjs — run-once REMAP de planos órfãos
 *
 * CONTEXTO (issue #183):
 *   Bug em `src/hooks/usePlans.js:141` gravava `studentId = user.uid` mesmo
 *   quando o criador era o mentor atuando em nome do aluno. Resultado:
 *   planos + trades vinculados com `studentId == MENTOR.uid`
 *   que o aluno nunca enxerga (filtra `where studentId == own.uid`).
 *
 * CRITÉRIO DE ÓRFÃO:
 *   plan.studentEmail === MENTOR_EMAIL
 *
 * ESTRATÉGIA: REMAP (não-destrutivo).
 *   Fonte da verdade para o dono correto = `account.studentId` / `account.studentEmail`
 *   / `account.studentName`. Atualiza o `plan` e em cascata todos os `trades`
 *   vinculados via `planId`. Movements não têm studentId/Email — herdam via tradeId.
 *
 * SAFETY NET:
 *   - Plano sem accountId → skip (não dá pra inferir dono)
 *   - Account não encontrado → skip
 *   - Account.studentEmail também == MENTOR_EMAIL → skip (conta do próprio mentor)
 *   - Account sem studentId → skip
 *   Planos skipados aparecem no log com o motivo.
 *
 * MODO DRY-RUN (default):
 *   node scripts/issue-183-repair-orphan-plans.mjs
 *
 * MODO EXECUTE (requer dupla confirmação):
 *   node scripts/issue-183-repair-orphan-plans.mjs --execute --confirm=SIM
 *
 * PRÉ-REQUISITOS:
 *   Application Default Credentials ativas:
 *     gcloud auth application-default login
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

const require = createRequire(import.meta.url);
const admin = require(join(PROJECT_ROOT, 'functions', 'node_modules', 'firebase-admin'));

const MENTOR_EMAIL = 'marcio.portes@me.com';
const PROJECT_ID = 'acompanhamento-20';

const args = process.argv.slice(2);
const EXECUTE = args.includes('--execute');
const CONFIRMED = args.includes('--confirm=SIM');

if (EXECUTE && !CONFIRMED) {
  console.error('\n❌ --execute requer --confirm=SIM (dupla confirmação obrigatória).\n');
  process.exit(1);
}

const MODE = EXECUTE ? 'execute' : 'dryrun';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: PROJECT_ID });
}
const db = admin.firestore();

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function writeLog(payload) {
  if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });
  const path = join(LOGS_DIR, `issue-183-${MODE}-${ts()}.json`);
  writeFileSync(path, JSON.stringify(payload, null, 2));
  return path;
}

function fmt(v, w = 28) {
  if (v == null) return '(null)'.padEnd(w);
  const s = String(v);
  return (s.length > w ? s.slice(0, w - 3) + '...' : s).padEnd(w);
}

async function main() {
  console.log(`\n🔧 issue-183 — REMAP de planos órfãos [${MODE.toUpperCase()}]`);
  console.log(`   Projeto: ${PROJECT_ID}`);
  console.log(`   Critério: plans.studentEmail == "${MENTOR_EMAIL}"`);
  console.log(`   Estratégia: remap studentId/Email/Name a partir de account.studentId\n`);

  // 1) Identificar órfãos
  const orphansSnap = await db
    .collection('plans')
    .where('studentEmail', '==', MENTOR_EMAIL)
    .get();

  if (orphansSnap.empty) {
    console.log('✅ Nenhum plano órfão encontrado.\n');
    writeLog({ mode: MODE, orphansFound: 0, candidates: [] });
    return;
  }

  // 2) Enriquecer com account + contagem de trades
  const candidates = [];
  for (const doc of orphansSnap.docs) {
    const plan = doc.data();
    const entry = {
      planId: doc.id,
      planName: plan.name ?? '(sem nome)',
      currentStudentId: plan.studentId ?? null,
      currentStudentEmail: plan.studentEmail ?? null,
      accountId: plan.accountId ?? null,
      targetStudentId: null,
      targetStudentEmail: null,
      targetStudentName: null,
      tradesCount: 0,
      tradesToUpdate: [],
      skip: false,
      skipReason: null,
    };

    if (!plan.accountId) {
      entry.skip = true;
      entry.skipReason = 'plan sem accountId';
    } else {
      const accDoc = await db.collection('accounts').doc(plan.accountId).get();
      if (!accDoc.exists) {
        entry.skip = true;
        entry.skipReason = `account ${plan.accountId} não existe`;
      } else {
        const acc = accDoc.data();
        if (!acc.studentId) {
          entry.skip = true;
          entry.skipReason = 'account sem studentId';
        } else if (acc.studentEmail === MENTOR_EMAIL) {
          entry.skip = true;
          entry.skipReason = 'account também é do mentor (conta de teste?)';
        } else {
          entry.targetStudentId = acc.studentId;
          entry.targetStudentEmail = acc.studentEmail ?? null;
          entry.targetStudentName = acc.studentName ?? null;
        }
      }
    }

    // Contar trades vinculados ao plano
    const tradesSnap = await db
      .collection('trades')
      .where('planId', '==', doc.id)
      .get();
    entry.tradesCount = tradesSnap.size;
    entry.tradesToUpdate = tradesSnap.docs
      .filter((t) => {
        const d = t.data();
        return d.studentEmail === MENTOR_EMAIL || d.studentId !== entry.targetStudentId;
      })
      .map((t) => t.id);

    candidates.push(entry);
  }

  // 3) Print tabela
  console.log(`📋 ${candidates.length} plano(s) órfão(s) encontrado(s):\n`);
  console.log(
    `  #  planId                       name                         → targetStudentEmail               trades   status`
  );
  console.log(
    `  ── ──────────────────────────── ──────────────────────────── ──────────────────────────────── ──────── ─────────────────────`
  );
  candidates.forEach((c, i) => {
    const status = c.skip ? `⚠️  SKIP: ${c.skipReason}` : '✅ remap';
    console.log(
      `  ${String(i + 1).padStart(2)} ${fmt(c.planId)} ${fmt(c.planName)} ${fmt(c.targetStudentEmail, 32)} ${String(c.tradesCount).padStart(3)}/${String(c.tradesToUpdate.length).padStart(3)} ${status}`
    );
  });

  const remappable = candidates.filter((c) => !c.skip);
  const skipped = candidates.filter((c) => c.skip);
  const totalTrades = remappable.reduce((s, c) => s + c.tradesToUpdate.length, 0);

  console.log(
    `\n  TOTAIS: ${remappable.length} plano(s) remappable · ${totalTrades} trade(s) vão ser atualizados · ${skipped.length} skipado(s)\n`
  );

  if (!EXECUTE) {
    const logPath = writeLog({
      mode: 'dryrun',
      orphansFound: candidates.length,
      candidates,
      totals: { remappable: remappable.length, skipped: skipped.length, trades: totalTrades },
    });
    console.log(`💾 Log JSON: ${logPath}`);
    console.log('\n⚠️  DRY-RUN — nenhum documento foi alterado.');
    console.log('   Para executar: --execute --confirm=SIM\n');
    return;
  }

  // 4) EXECUTE — remap com batch writes (até 500 writes por batch)
  console.log('🔧 EXECUTE ativado — aplicando remap...\n');

  const updated = { plans: [], trades: [] };
  const errors = [];

  for (const c of remappable) {
    try {
      const batch = db.batch();

      // 4.1) plan
      const planRef = db.collection('plans').doc(c.planId);
      batch.update(planRef, {
        studentId: c.targetStudentId,
        studentEmail: c.targetStudentEmail,
        studentName: c.targetStudentName,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        _repairedByIssue183At: admin.firestore.FieldValue.serverTimestamp(),
        _repairedByIssue183PreviousStudentId: c.currentStudentId,
        _repairedByIssue183PreviousStudentEmail: c.currentStudentEmail,
      });

      // 4.2) trades
      for (const tradeId of c.tradesToUpdate) {
        const tradeRef = db.collection('trades').doc(tradeId);
        batch.update(tradeRef, {
          studentId: c.targetStudentId,
          studentEmail: c.targetStudentEmail,
        });
      }

      await batch.commit();

      updated.plans.push(c.planId);
      updated.trades.push(...c.tradesToUpdate);
      console.log(
        `  ✅ ${c.planId} (${c.planName}) → ${c.targetStudentEmail} · ${c.tradesToUpdate.length} trades`
      );
    } catch (err) {
      console.error(`  ❌ ${c.planId} — ${err.message}`);
      errors.push({ planId: c.planId, error: err.message });
    }
  }

  const logPath = writeLog({
    mode: 'execute',
    orphansFound: candidates.length,
    candidates,
    updated: {
      plans: updated.plans.length,
      trades: updated.trades.length,
      planIds: updated.plans,
      tradeIds: updated.trades,
    },
    skipped: skipped.length,
    errors,
  });

  console.log(
    `\n✅ Remap concluído: ${updated.plans.length} plano(s) · ${updated.trades.length} trade(s) atualizados`
  );
  if (skipped.length) console.log(`⚠️  ${skipped.length} plano(s) skipado(s) — ver log.`);
  if (errors.length) console.log(`❌ ${errors.length} erro(s) — ver log.`);
  console.log(`💾 Log JSON: ${logPath}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Erro fatal:', err);
    process.exit(3);
  });
