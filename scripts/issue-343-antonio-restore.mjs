#!/usr/bin/env node
/**
 * issue-343-antonio-restore.mjs
 *
 * Antonio Pina teve o assessment resetado em 06/08 (DEC-026: onboardingStatus
 * -> 'lead', requiresAssessment -> false) enquanto o modelo Claude aposentado
 * travava o Finalizar. O doc `assessment/questionnaire` foi preservado.
 *
 * Este script devolve o aluno ao fluxo para validar o fix do #343 em produção.
 *
 * MODOS:
 *   node scripts/issue-343-antonio-restore.mjs --backup    # só salva o estado atual
 *   node scripts/issue-343-antonio-restore.mjs --arm       # backup + reativa o assessment
 *   node scripts/issue-343-antonio-restore.mjs --revert    # volta ao estado do backup
 *
 * Sem flag: dry-run (mostra o que faria).
 */

import { createRequire } from 'node:module';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const admin = require(join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));
if (!admin.apps.length) admin.initializeApp({ projectId: 'acompanhamento-20' });
const db = admin.firestore();

const ID = 'NUvy1TCBeaQPqsaI2VNU6WPXwT93';
const LOGS = join(__dirname, 'logs');
const BACKUP = join(LOGS, 'issue-343-antonio-backup.json');

const mode = process.argv[2] || '--dry-run';

const studentRef = db.doc(`students/${ID}`);
const qRef = db.doc(`students/${ID}/assessment/questionnaire`);

async function snapshot() {
  const s = (await studentRef.get()).data();
  const q = (await qRef.get()).data();
  return {
    capturedAt: new Date().toISOString(),
    student: { onboardingStatus: s.onboardingStatus, requiresAssessment: s.requiresAssessment },
    questionnaire: JSON.parse(JSON.stringify(q, (_k, v) => (v && v._seconds ? { __ts: v._seconds } : v))),
  };
}

const snap = await snapshot();
console.log(`aluno .............. Antonio Pina (${ID})`);
console.log(`onboardingStatus ... ${snap.student.onboardingStatus}`);
console.log(`requiresAssessment . ${snap.student.requiresAssessment}`);
console.log(`respostas .......... ${(snap.questionnaire?.responses || []).length}`);
console.log(`completedAt ........ ${snap.questionnaire?.completedAt ? 'preenchido' : 'null'}`);

if (mode === '--backup' || mode === '--arm') {
  if (!existsSync(LOGS)) mkdirSync(LOGS, { recursive: true });
  writeFileSync(BACKUP, JSON.stringify(snap, null, 2));
  console.log(`\n[ok] backup salvo em ${BACKUP}`);
}

if (mode === '--arm') {
  await studentRef.update({ onboardingStatus: 'pre_assessment', requiresAssessment: true });
  const after = (await studentRef.get()).data();
  console.log(`[ok] reativado -> onboardingStatus=${after.onboardingStatus} requiresAssessment=${after.requiresAssessment}`);
  console.log('     as 34 respostas seguem intactas; o aluno cai direto no botão Finalizar');
} else if (mode === '--revert') {
  if (!existsSync(BACKUP)) {
    console.error('[erro] backup não encontrado — rode --backup antes');
    process.exit(1);
  }
  const b = JSON.parse(readFileSync(BACKUP, 'utf8'));
  await studentRef.update({
    onboardingStatus: b.student.onboardingStatus,
    requiresAssessment: b.student.requiresAssessment,
  });
  console.log(`[ok] revertido para onboardingStatus=${b.student.onboardingStatus} requiresAssessment=${b.student.requiresAssessment}`);
  console.log('     NOTA: campos gravados pelo teste no questionnaire (completedAt, aiScore,');
  console.log('     aiModelVersion) não são desfeitos por este revert — ver backup para o estado original.');
} else if (mode === '--dry-run') {
  console.log('\n[dry-run] --arm faria: onboardingStatus -> pre_assessment, requiresAssessment -> true');
}

process.exit(0);
