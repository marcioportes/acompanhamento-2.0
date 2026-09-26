/**
 * stopPendencia475.mjs — issue #475: reavalia o aviso de stop dos trades JÁ GRAVADOS.
 *
 * Trades protegidos pelas ordens e sem stop comprovado carregam `TRADE_SEM_STOP` gravado
 * antes do #475 (o 24/09/2026 entre eles). A regra nova troca por `STOP_INICIAL_A_INFORMAR`
 * (pendência). O recálculo é o MESMO do fechamento do lote (`refreshStopFlag`, functions),
 * injetado aqui — este arquivo só escolhe os trades, conta e formata.
 *
 * Candidatos: trades que hoje carregam algum aviso de stop (violação ou pendência). Trade
 * sem aviso nenhum tem stop que protege ou fechou em loss — a regra nova não muda nada nele.
 * Discutido (INV-30) volta PRESERVADO de `refreshStopFlag` e nunca é escrito.
 */

/**
 * @param {Object} db — admin.firestore() (ou fake com a mesma forma)
 * @param {{apply?:boolean, student?:string|null, trade?:string|null}} opts
 * @param {{refreshStopFlag:Function, isStopFlag:Function}} deps
 * @returns {Promise<{linhas:Array, resumo:Object}>}
 */
export async function runStopFlagRefresh(db, opts, { refreshStopFlag, isStopFlag }) {
  let docs;
  if (opts.trade) {
    const s = await db.collection('trades').doc(opts.trade).get();
    docs = s.exists ? [{ id: opts.trade, data: s.data() }] : [];
  } else {
    const q = opts.student
      ? db.collection('trades').where('studentId', '==', opts.student)
      : db.collection('trades');
    docs = (await q.get()).docs.map((d) => ({ id: d.id, data: d.data() }));
  }

  const candidatos = docs.filter((d) => (Array.isArray(d.data?.redFlags) ? d.data.redFlags : []).some(isStopFlag));
  const linhas = [];
  for (const c of candidatos) {
    const r = await refreshStopFlag(db, c.id, { dryRun: !opts.apply });
    linhas.push({ ...r, date: c.data.date ?? null, ticker: c.data.ticker ?? null, studentId: c.data.studentId ?? null });
  }
  const resumo = { candidatos: candidatos.length };
  for (const l of linhas) resumo[l.status] = (resumo[l.status] || 0) + 1;
  return { linhas, resumo };
}

const dataBR = (iso) => (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}/.test(iso)
  ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—');

/** Relatório legível: cabeçalho do modo, uma linha por trade que muda, resumo. */
export function formatarRelatorio({ linhas, resumo }, opts = {}) {
  const out = [opts.apply ? 'APLICADO' : 'DRY-RUN — nada foi escrito'];
  for (const l of linhas.filter((x) => x.status === 'MUDARIA' || x.status === 'ATUALIZADO')) {
    out.push(`${l.tradeId}  ${dataBR(l.date)}  ${l.ticker ?? ''}  ${l.antes ?? '∅'} → ${l.depois ?? '∅'}  [${l.status}]`);
  }
  out.push(`resumo: ${JSON.stringify(resumo)}`);
  return out.join('\n');
}
