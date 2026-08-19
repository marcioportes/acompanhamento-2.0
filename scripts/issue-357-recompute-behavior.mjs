#!/usr/bin/env node
/**
 * issue-357-recompute-behavior.mjs — recomputa `trade.behaviorProfile` com a regra nova.
 *
 * `behaviorProfile` é snapshot gravado no doc do trade. Corrigir o detector NÃO limpa o
 * passado: trades acusados de STOP_PANIC continuam acusados, com o gate de progressão
 * travado, até este recompute rodar.
 *
 * Reusa `recomputeBehaviorProfiles` (functions/behavior/) — a mesma função que a CF
 * chama em runtime, não uma reimplementação. Só grava onde o fingerprint mudou.
 *
 * USO:
 *   node scripts/issue-357-recompute-behavior.mjs                  # dry-run (não escreve)
 *   node scripts/issue-357-recompute-behavior.mjs --yes            # aplica
 *   node scripts/issue-357-recompute-behavior.mjs --student <uid>  # escopa a um aluno
 *
 * LOG: scripts/logs/issue-357-recompute-<ISO8601>.json
 */

import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const LOGS_DIR = join(ROOT, 'scripts', 'logs');

const require = createRequire(import.meta.url);
const admin = require(join(ROOT, 'functions', 'node_modules', 'firebase-admin'));
const { buildBehaviorProfiles } = require(join(ROOT, 'functions', 'behavior', 'buildBehaviorProfile'));
const { recomputeBehaviorProfiles } = require(join(ROOT, 'functions', 'behavior', 'recomputeBehaviorProfiles'));

const args = process.argv.slice(2);
const APPLY = args.includes('--yes');
const si = args.indexOf('--student');
const ONLY = si >= 0 ? args[si + 1] : null;

admin.initializeApp({ projectId: 'acompanhamento-20' });
const db = admin.firestore();

const all = async (col) => (await db.collection(col).get()).docs.map((d) => ({ id: d.id, ...d.data() }));

const NEGATIVAS_ANTIGAS = ['STOP_PANIC', 'SUB_SIZING'];

async function main() {
  const [plans, orders, emotions] = await Promise.all([all('plans'), all('orders'), all('emotions')]);
  const trades = (await all('trades')).filter((t) => (ONLY ? t.studentId === ONLY : true));
  console.log(`[357] ${trades.length} trades · ${orders.length} orders · ${plans.length} planos\n`);

  const byStudent = new Map();
  for (const t of trades) {
    const k = t.studentId || '—';
    if (!byStudent.has(k)) byStudent.set(k, []);
    byStudent.get(k).push(t);
  }

  const buildGetEmotionConfig = (list) => (name) =>
    list.find((e) => e.name === name) || { name: name || 'Desconhecida', score: 0, analysisCategory: 'NEUTRAL', behavioralPattern: 'OTHER' };

  const changes = [];
  const totals = { scanned: 0, changed: 0, semPerfil: 0, mudouDeVerdade: 0, gatesFreed: 0, newAlerts: 0 };

  for (const [studentId, sTrades] of byStudent) {
    const profiles = buildBehaviorProfiles({
      trades: sTrades, orders, plans, getEmotionConfig: buildGetEmotionConfig(emotions),
    });
    for (const t of sTrades) {
      const novo = profiles.get(t.id);
      if (!novo) continue;
      totals.scanned += 1;
      const antigo = t.behaviorProfile;
      if (antigo && antigo.fingerprint === novo.fingerprint) continue;

      const famAntes = (antigo?.families || []).map((f) => f.canonicalCode);
      const famDepois = novo.families.map((f) => f.canonicalCode);
      const gateAntes = antigo?.gateInputs || [];
      const gateDepois = novo.gateInputs || [];

      const destravou = gateAntes.some((g) => NEGATIVAS_ANTIGAS.includes(g)) && gateDepois.length === 0;
      const novoAlerta = famDepois.some((f) => ['RISK_OVER_RO', 'UNPROTECTED_SIZE'].includes(f))
        && !famAntes.some((f) => ['RISK_OVER_RO', 'UNPROTECTED_SIZE'].includes(f));

      totals.changed += 1;
      if (!antigo) totals.semPerfil += 1; else totals.mudouDeVerdade += 1;
      if (destravou) totals.gatesFreed += 1;
      if (novoAlerta) totals.newAlerts += 1;

      changes.push({
        tinhaPerfil: !!antigo,
        tradeId: t.id, studentId, ticker: t.ticker, result: t.result,
        entryTime: t.entryTime, antes: famAntes, depois: famDepois,
        gateAntes, gateDepois, destravou, novoAlerta,
      });
    }
  }

  console.log(`trades analisados        : ${totals.scanned}`);
  console.log(`perfis que MUDAM         : ${totals.changed}`);
  console.log(`  · nunca tiveram perfil : ${totals.semPerfil}  (backfill, não regressão)`);
  console.log(`  · tinham e MUDARAM     : ${totals.mudouDeVerdade}`);
  console.log(`  · gates que DESTRAVAM  : ${totals.gatesFreed}`);
  console.log(`  · alertas NOVOS        : ${totals.newAlerts}`);

  const porAluno = new Map();
  for (const c of changes) {
    if (!porAluno.has(c.studentId)) porAluno.set(c.studentId, { n: 0, destrava: 0, novos: 0 });
    const b = porAluno.get(c.studentId);
    b.n += 1; if (c.destravou) b.destrava += 1; if (c.novoAlerta) b.novos += 1;
  }
  console.log('\npor aluno:');
  for (const [sid, b] of porAluno) console.log(`  ${sid}  muda=${b.n} destrava=${b.destrava} novos=${b.novos}`);

  const reais = changes.filter((c) => c.tinhaPerfil);
  console.log(`\namostra dos que TINHAM perfil e mudaram (até 15 de ${reais.length}):`);
  for (const c of reais.slice(0, 15)) {
    console.log(`  ${c.ticker} ${String(c.entryTime).slice(0, 16)} result=${c.result}`);
    console.log(`     antes:  [${c.antes.join(', ')}]  gates=[${c.gateAntes.join(', ')}]`);
    console.log(`     depois: [${c.depois.join(', ')}]  gates=[${c.gateDepois.join(', ')}]`);
  }

  if (!APPLY) {
    console.log('\n[357] DRY-RUN — nada foi escrito. Repita com --yes para aplicar.');
    return { applied: false, totals, changes };
  }

  console.log('\n[357] aplicando…');
  let written = 0;
  for (const [studentId, sTrades] of byStudent) {
    const r = await recomputeBehaviorProfiles(db, admin, {
      trades: sTrades, plans, orders, emotions, computedBy: 'backfill',
    });
    written += r.written;
    if (r.written) console.log(`  ${studentId}: ${r.written} gravados`);
  }
  console.log(`[357] concluído — ${written} perfis atualizados`);
  return { applied: true, written, totals, changes };
}

main()
  .then((r) => {
    if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });
    const path = join(LOGS_DIR, `issue-357-recompute-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    writeFileSync(path, JSON.stringify(r, null, 2));
    console.log(`\n[357] log: ${path}`);
    process.exit(0);
  })
  .catch((e) => { console.error('[357] ERRO:', e); process.exit(1); });
