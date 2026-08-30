/**
 * gerar-dicionario-dados.mjs — dicionário de campos a partir da BASE REAL.
 *
 * Motivo (Marcio, 30/08/2026): *"você não mantém um dicionário de dados? Por que
 * fica inferindo nos nomes dos campos?"*. Três erros no mesmo dia — `entryPrice`
 * quando o campo é `entry`, `takeProfit` quando o alvo mora em `plan.rrTarget`, e
 * a projeção `periodTrades` que renomeia tudo e omite `date`/`planId`/`studentId`.
 *
 * O `docs/firestore-schema.md` descreve contratos e regras, não nomes de campo.
 * Este script lê os documentos e reporta campo, tipo e TAXA DE PREENCHIMENTO —
 * que é o dado que evita prescrever sobre campo vazio.
 *
 * Uso: node scripts/gerar-dicionario-dados.mjs > docs/data-dictionary.md
 */
import admin from 'firebase-admin';

admin.initializeApp({ projectId: 'acompanhamento-20' });
const db = admin.firestore();

const tipoDe = (v) => {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (v?.toDate) return 'timestamp';
  if (v && typeof v === 'object') return 'map';
  return typeof v;
};

async function inventario(nome, docs) {
  const campos = new Map();
  for (const d of docs) {
    for (const [k, v] of Object.entries(d)) {
      if (k === 'id') continue;
      const info = campos.get(k) ?? { preenchidos: 0, tipos: new Set(), exemplo: null };
      const vazio = v === null || v === undefined || v === '';
      if (!vazio) {
        info.preenchidos += 1;
        info.tipos.add(tipoDe(v));
        if (info.exemplo === null && typeof v !== 'object') info.exemplo = String(v).slice(0, 28);
      }
      campos.set(k, info);
    }
  }
  console.log(`\n### \`${nome}\` — ${docs.length} documentos\n`);
  console.log('| campo | tipo | preenchido | exemplo |');
  console.log('|---|---|---|---|');
  for (const [k, i] of [...campos.entries()].sort((a, b) => b[1].preenchidos - a[1].preenchidos)) {
    const pct = Math.round((i.preenchidos / docs.length) * 100);
    const alerta = pct === 0 ? ' ⚠ **sempre vazio**' : pct < 30 ? ' ⚠ raro' : '';
    console.log(`| \`${k}\` | ${[...i.tipos].join('/') || '—'} | ${i.preenchidos}/${docs.length} (${pct}%)${alerta} | ${i.exemplo ?? ''} |`);
  }
}

const hoje = new Date().toISOString().slice(0, 10).split('-').reverse().join('/');
console.log(`# Dicionário de dados — campos reais das collections\n`);
console.log(`> Gerado de PRODUÇÃO por \`scripts/gerar-dicionario-dados.mjs\` em ${hoje}.`);
console.log(`> Regenerar antes de escrever qualquer regra que dependa de um campo.`);
console.log(`>`);
console.log(`> **A taxa de preenchimento é parte do contrato.** Campo que existe no schema e`);
console.log(`> está vazio na base não sustenta regra: prescrever sobre ele é adivinhação com`);
console.log(`> cara de análise.`);

for (const col of ['trades', 'plans', 'accounts']) {
  const snap = await db.collection(col).get();
  await inventario(col, snap.docs.map((d) => ({ id: d.id, ...d.data() })));
}
for (const grupo of ['reviews', 'subscriptions']) {
  const snap = await db.collectionGroup(grupo).get();
  await inventario(`${grupo} (collectionGroup)`, snap.docs.map((d) => ({ id: d.id, ...d.data() })));
}

// A projeção que mora DENTRO do snapshot da revisão — não é o trade.
const revs = (await db.collectionGroup('reviews').get()).docs.map((d) => d.data());
const projetados = revs.flatMap((r) => r.frozenSnapshot?.periodTrades ?? []);
if (projetados.length) {
  console.log(`\n---\n`);
  console.log(`## Projeções (shape DIFERENTE do documento de origem)\n`);
  console.log(`\`review.frozenSnapshot.periodTrades\` **não é o trade**: é a projeção de`);
  console.log(`\`weeklyReviewSnapshot.projectTrade\`, com nomes próprios e campos ausentes.`);
  console.log(`Alimentar um motor com ela sem adaptar faz o trade ser descartado em silêncio.`);
  await inventario('frozenSnapshot.periodTrades', projetados);
}
process.exit(0);
