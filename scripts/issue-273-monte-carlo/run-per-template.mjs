// Monte Carlo per template — issue #273
// Generaliza 04-condensed-stats-tips.mjs (issue #201, hardcoded Apex 50K) para
// rodar contra cada template do catálogo, gerando mcStats e recommendedProfile.
//
// Inputs por template:
//   - drawdown.maxAmount  → DD (orçamento de bust)
//   - profitTarget        → TARGET (meta de aprovação)
//   - evalTimeLimit       → derivado em DAYS úteis (~5/7 do calendário; fallback 21)
//
// Modelo comportamental:
//   - Stop-on-win: para o dia no 1º win
//   - Recovery: tenta 2º trade só se max=2 E perdeu o 1º (CONS_*)
//   - Aggressive: max=1 trade (AGRES_*)
//   - RR fixo 1:2 (consistente com profile.rr)
//   - Limitações conhecidas: dailyLossLimit não modelado; trailing DD aproximado como STATIC
//
// Algoritmo de recommendedProfile:
//   - Default: CONS_B (sweet spot histórico)
//   - Substitui só se outro perfil tem pass(WR50) > 1.5× e bust(WR50) ≤ 5%
//
// Output:
//   src/constants/propFirmMcStats.js   — mapa templateId → { recommendedProfile, mcStats }

import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');

// ESM nativo do Node não resolve imports extensionless ('./instrumentsTable').
// Em vez de importar via Vite/vitest, parseamos o array DEFAULT_TEMPLATES com
// regex tolerante. Só precisamos de { id, drawdown.maxAmount, profitTarget,
// evalTimeLimit } — suficiente para o MC.
function loadTemplates() {
  const src = readFileSync(resolve(repoRoot, 'src/constants/propFirmDefaults.js'), 'utf8');
  // Match: blocos { id: '...', name: '...', ..., drawdown: { ..., maxAmount: N, ... },
  //                ..., profitTarget: N, ..., evalTimeLimit: N|null, ... }
  const templates = [];
  const idRegex = /id:\s*'([^']+)'/g;
  // Walk template-by-template via "id: '...'": capture forward window até próximo id ou ']'
  const matches = [...src.matchAll(idRegex)];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : src.length;
    const block = src.slice(start, end);
    const id = matches[i][1];
    const maxAmount = parseFloat(block.match(/maxAmount:\s*([\d.]+)/)?.[1]);
    const profitTarget = parseFloat(block.match(/profitTarget:\s*([\d.]+)/)?.[1]);
    // evalTimeLimit pode ser null
    const evalRaw = block.match(/evalTimeLimit:\s*([\w.]+)/)?.[1];
    const evalTimeLimit = evalRaw === 'null' ? null : parseFloat(evalRaw);
    if (Number.isFinite(maxAmount) && Number.isFinite(profitTarget)) {
      templates.push({
        id,
        drawdown: { maxAmount },
        profitTarget,
        evalTimeLimit: Number.isFinite(evalTimeLimit) ? evalTimeLimit : null,
      });
    }
  }
  return templates;
}

const DEFAULT_TEMPLATES = loadTemplates();

const PROFILES = [
  { code: 'CONS_A', roPct: 0.10, max: 2 },
  { code: 'CONS_B', roPct: 0.15, max: 2 },
  { code: 'CONS_C', roPct: 0.20, max: 2 },
  { code: 'AGRES_A', roPct: 0.25, max: 1 },
  { code: 'AGRES_B', roPct: 0.30, max: 1 },
];
const WR_SAMPLES = [0.45, 0.50, 0.55];
const RR = 2;
const ITER = 100000;
const BUSINESS_DAYS_RATIO = 5 / 7;
const BUST_THRESHOLD = 5;        // bust máximo (%) para considerar perfil recomendável
const TIE_BREAK_MARGIN = 1;       // diferença de pass% considerada empate (tie-break prefere CONS_B)

function simulate({ DD, TARGET, DAYS, profile, wr }) {
  const ro = DD * profile.roPct;
  const win = ro * RR;
  let pass = 0;
  let bust = 0;
  let sumDaysToPass = 0;
  for (let i = 0; i < ITER; i++) {
    let bal = 0;
    let out = null;
    for (let d = 0; d < DAYS && out === null; d++) {
      const w1 = Math.random() < wr;
      bal += w1 ? win : -ro;
      if (bal <= -DD) { out = 'bust'; break; }
      if (bal >= TARGET) { out = 'pass'; sumDaysToPass += (d + 1); break; }
      // 2º trade: só conservador (max=2) e perdeu o 1º (recovery)
      if (profile.max === 2 && !w1) {
        const w2 = Math.random() < wr;
        bal += w2 ? win : -ro;
        if (bal <= -DD) { out = 'bust'; break; }
        if (bal >= TARGET) { out = 'pass'; sumDaysToPass += (d + 1); break; }
      }
    }
    if (out === 'pass') pass += 1;
    else if (out === 'bust') bust += 1;
  }
  return {
    pass: round(pass / ITER * 100, 0),
    bust: round(bust / ITER * 100, 1),
    days: pass > 0 ? round(sumDaysToPass / pass, 1) : null,
  };
}

function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function deriveBusinessDays(evalTimeLimit) {
  if (!evalTimeLimit || evalTimeLimit <= 0) return 21;
  return Math.max(1, Math.floor(evalTimeLimit * BUSINESS_DAYS_RATIO));
}

function pickRecommended(profileStats) {
  // Sweet spot adaptativo. Score = pass - 2×bust @ WR50, filtrando bust ≤ BUST_THRESHOLD.
  // Empate (≤ TIE_BREAK_MARGIN pp de diferença em pass) → preferência CONS_B (default histórico).
  const candidates = [];
  for (const code of Object.keys(profileStats)) {
    const s = profileStats[code].wr50;
    if (!s) continue;
    if (s.bust > BUST_THRESHOLD) continue;
    candidates.push({ code, pass: s.pass, bust: s.bust, score: s.pass - 2 * s.bust });
  }
  if (candidates.length === 0) return 'CONS_B';
  candidates.sort((a, b) => b.score - a.score);
  const top = candidates[0];
  // Tie-break: se CONS_B está dentro da margem, prefere CONS_B (preserva sweet spot histórico)
  const consB = candidates.find(c => c.code === 'CONS_B');
  if (consB && consB.code !== top.code && Math.abs(consB.score - top.score) <= TIE_BREAK_MARGIN * 2) {
    return 'CONS_B';
  }
  return top.code;
}

const result = {};
let processed = 0;
const total = DEFAULT_TEMPLATES.length;
console.error(`Rodando MC pra ${total} templates × ${PROFILES.length} perfis × ${WR_SAMPLES.length} WRs × ${ITER} iter...\n`);

for (const tpl of DEFAULT_TEMPLATES) {
  const DD = tpl.drawdown?.maxAmount;
  const TARGET = tpl.profitTarget;
  const DAYS = deriveBusinessDays(tpl.evalTimeLimit);
  if (!DD || !TARGET || DD <= 0 || TARGET <= 0) {
    console.error(`  skip ${tpl.id}: DD=${DD} TARGET=${TARGET} (faltando)`);
    continue;
  }
  const stats = {};
  for (const profile of PROFILES) {
    const byWr = {};
    for (const wr of WR_SAMPLES) {
      byWr[`wr${Math.round(wr * 100)}`] = simulate({ DD, TARGET, DAYS, profile, wr });
    }
    stats[profile.code] = byWr;
  }
  result[tpl.id] = {
    recommendedProfile: pickRecommended(stats),
    days: DAYS,
    DD,
    TARGET,
    mcStats: stats,
  };
  processed += 1;
  if (processed % 10 === 0) console.error(`  ${processed}/${total}`);
}

console.error(`\nFinalizado: ${processed}/${total} templates simulados.\n`);

// Gera o arquivo estático
const banner = `// AUTO-GENERATED por scripts/issue-273-monte-carlo/run-per-template.mjs
// NÃO EDITAR À MÃO. Regenerar com:
//   node scripts/issue-273-monte-carlo/run-per-template.mjs
//
// Modelo: stop-on-win com recovery após loss · RR 1:2 · 100k iter · WR 0.45/0.50/0.55
// Base por template: { DD: drawdown.maxAmount, TARGET: profitTarget, DAYS: evalTimeLimit × 5/7 }
//
// Limitações conhecidas:
//  - dailyLossLimit não modelado (FAIL_ACCOUNT/PAUSE_DAY ignorado)
//  - Trailing drawdown aproximado como STATIC
//  - RNG Math.random() — variação ±0.5pp entre runs
`;

const body = `\nexport const PROP_FIRM_MC_STATS = ${JSON.stringify(result, null, 2)};\n`;

const outPath = resolve(repoRoot, 'src/constants/propFirmMcStats.js');
writeFileSync(outPath, banner + body, 'utf8');
console.error(`Escrito: ${outPath}`);

// Resumo de recomendações por mesa
const byRecommendation = {};
for (const [id, r] of Object.entries(result)) {
  byRecommendation[r.recommendedProfile] = (byRecommendation[r.recommendedProfile] ?? 0) + 1;
}
console.error(`\nDistribuição de recommendedProfile:`);
for (const [code, count] of Object.entries(byRecommendation)) {
  console.error(`  ${code}: ${count} templates`);
}
