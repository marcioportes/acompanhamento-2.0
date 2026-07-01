/**
 * reviewNotePrefix — prefixo identificador do trade para uma nota da Revisão (#318).
 *
 * Restore do `fmtTradePrefix` do antigo PinToReviewButton (removido no #269 v2).
 * Formato: `[DD/MM HH:MM SÍMBOLO ±RESULT] ` — âncora legível do trade dentro do
 * texto livre de sessionNotes (Notas da Sessão).
 */
export const fmtTradePrefix = (trade) => {
  if (!trade) return '';
  const date = trade.date || (trade.entryTime ? String(trade.entryTime).slice(0, 10) : '');
  const [y, m, d] = String(date || '').split('-');
  const shortDate = y && m && d ? `${d}/${m}` : (date || '?');
  const time = trade.entryTime ? String(trade.entryTime).slice(11, 16) : '';
  const symbol = trade.symbol || trade.ticker || '';
  const result = Number(trade.result) || 0;
  const resultStr = result > 0 ? `+${result.toFixed(2)}` : result.toFixed(2);
  const parts = [shortDate + (time ? ` ${time}` : ''), symbol, resultStr].filter(Boolean);
  return `[${parts.join(' ')}] `;
};
