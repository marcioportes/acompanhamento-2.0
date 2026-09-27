/**
 * recomputeBehavior477.mjs — issue #477: recalcula o `behaviorProfile` dos trades JÁ
 * GRAVADOS com as regras novas (hesitação só conta tentativa de entrada; montagem de
 * posição é aviso neutro; confronto emocional como hipótese).
 *
 * O cálculo é o MESMO da Cloud Function (`buildBehaviorProfiles`, functions), injetado —
 * este arquivo só escolhe os alunos, compara com o que está gravado, conta e formata.
 *
 * Candidatos (padrão): trades cujo perfil gravado carrega o que o #477 mudou —
 * `HESITATION`, `AVERAGING_DOWN`, ou confronto que elegeu padrão de gravidade BAIXA.
 * O cálculo usa TODOS os trades do aluno (os padrões de janela dependem dos vizinhos,
 * #389); a gravação fica nos candidatos cujo `fingerprint` mudou. `--all` grava todo
 * trade do aluno cujo perfil mudou.
 *
 * Trade DISCUTIDO nunca é escrito (INV-30): entra no cálculo, sai como PRESERVADO. A
 * escrita passa por `updateTradeIfMutable`, que relê o doc e recusa discutido.
 * Escreve só `behaviorProfile` (campo existente, INV-15), fora do guard de
 * `onTradeUpdated` — não re-dispara recompute.
 */

const FAMILIAS_MUDADAS = new Set(['HESITATION', 'AVERAGING_DOWN']);

/** O perfil gravado tem algo que o #477 mudou? */
export function candidato477(trade) {
  const p = trade?.behaviorProfile;
  if (!p) return false;
  const fams = Array.isArray(p.families) ? p.families : [];
  if (fams.some((f) => FAMILIAS_MUDADAS.has(f?.canonicalCode))) return true;
  return p.emotionConfront?.suggested?.severity === 'LOW';
}

const resumoFamilias = (profile) => (profile?.families || [])
  .map((f) => `${f.canonicalCode}${f.severity ? `:${f.severity}` : ''}`)
  .join(',') || '∅';

const resumoConfronto = (profile) => {
  const c = profile?.emotionConfront;
  if (!c) return '∅';
  return `${c.verdict}${c.suggested?.emotion ? `/${c.suggested.emotion}` : ''}`;
};

/**
 * @param {Object} db — admin.firestore() (ou fake com a mesma forma)
 * @param {{apply?:boolean, student?:string|null, trade?:string|null, all?:boolean}} opts
 * @param {{buildBehaviorProfiles:Function, buildGetEmotionConfig:Function,
 *          isTradeImmutable:Function, updateTradeIfMutable:Function, serverTimestamp:Function}} deps
 * @returns {Promise<{linhas:Array, resumo:Object}>}
 */
export async function runRecompute477(db, opts, deps) {
  const {
    buildBehaviorProfiles, buildGetEmotionConfig, isTradeImmutable, updateTradeIfMutable, serverTimestamp,
  } = deps;

  // 1. Alunos a recalcular.
  let alunos;
  if (opts.trade) {
    const s = await db.collection('trades').doc(opts.trade).get();
    alunos = s.exists && s.data()?.studentId ? [s.data().studentId] : [];
  } else if (opts.student) {
    alunos = [opts.student];
  } else {
    const todos = (await db.collection('trades').get()).docs.map((d) => d.data());
    alunos = [...new Set(todos.filter((t) => opts.all || candidato477(t)).map((t) => t.studentId).filter(Boolean))];
  }

  let emotions = [];
  try {
    emotions = (await db.collection('emotions').get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) { /* fallback neutro, como recomputeBehaviorForStudent */ }
  const getEmotionConfig = buildGetEmotionConfig(emotions);

  const linhas = [];
  for (const uid of alunos) {
    const trades = (await db.collection('trades').where('studentId', '==', uid).get()).docs
      .map((d) => ({ id: d.id, ...d.data() }));
    const plans = (await db.collection('plans').where('studentId', '==', uid).get()).docs
      .map((d) => ({ id: d.id, ...d.data() }));
    let orders = [];
    try {
      orders = (await db.collection('orders').where('studentId', '==', uid).get()).docs
        .map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) { /* orders opcional */ }

    const profiles = buildBehaviorProfiles({ trades, orders, plans, getEmotionConfig });
    for (const t of trades) {
      if (opts.trade && t.id !== opts.trade) continue;
      if (!opts.trade && !opts.all && !candidato477(t)) continue;
      const novo = profiles.get(t.id);
      if (!novo) continue;
      const antes = t.behaviorProfile || null;
      const base = {
        tradeId: t.id, studentId: uid, date: t.date ?? null, ticker: t.ticker ?? null,
        antes: `${resumoFamilias(antes)} | ${resumoConfronto(antes)}`,
        depois: `${resumoFamilias(novo)} | ${resumoConfronto(novo)}`,
      };
      if (antes && antes.fingerprint === novo.fingerprint) { linhas.push({ ...base, status: 'SEM_MUDANCA' }); continue; }
      if (isTradeImmutable(t)) { linhas.push({ ...base, status: 'PRESERVADO' }); continue; }
      if (!opts.apply) { linhas.push({ ...base, status: 'MUDARIA' }); continue; }
      const r = await updateTradeIfMutable(db.collection('trades').doc(t.id), {
        behaviorProfile: { ...novo, computedAt: serverTimestamp(), computedBy: 'recalc-477' },
      });
      linhas.push({ ...base, status: r.written ? 'ATUALIZADO' : (r.preserved ? 'PRESERVADO' : 'SEM_DOC') });
    }
  }
  const resumo = { alunos: alunos.length, trades: linhas.length };
  for (const l of linhas) resumo[l.status] = (resumo[l.status] || 0) + 1;
  return { linhas, resumo };
}

const dataBR = (iso) => (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}/.test(iso)
  ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—');

/** Relatório legível: cabeçalho do modo, uma linha por trade que muda ou é preservado, resumo. */
export function formatarRelatorio477({ linhas, resumo }, opts = {}) {
  const out = [opts.apply ? 'APLICADO' : 'DRY-RUN — nada foi escrito'];
  for (const l of linhas.filter((x) => x.status !== 'SEM_MUDANCA')) {
    out.push(`${l.tradeId}  ${dataBR(l.date)}  ${l.ticker ?? ''}  [${l.status}]\n    antes:  ${l.antes}\n    depois: ${l.depois}`);
  }
  out.push(`resumo: ${JSON.stringify(resumo)}`);
  return out.join('\n');
}
