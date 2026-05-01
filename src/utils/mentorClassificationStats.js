/**
 * mentorClassificationStats.js — issue #219 (Phase A do épico #218).
 *
 * Helpers puros para agregar `mentorClassification` por aluno/setup/período.
 * Sem dependências React. Chamado por dashboards e setupAnalysisV2.
 *
 * Workflow exception-based: mentor classifica APENAS os trades sorte; resto é
 * presumido técnico (default do sistema). Trades com `mentorClassification`
 * null|'tecnico' contam como técnico; só `'sorte'` é considerado exceção.
 */

import { MENTOR_CLASSIFICATION_FLAGS } from './tradeGateway';

// Justificativa padrão exibida no painel quando trade não tem classificação
// explícita do mentor. Não é gravada automaticamente — só populada na UI.
export const DEFAULT_TECNICO_REASON = 'Operação dentro do modelo operacional padrão.';

/**
 * Estatística geral por trade list. Trades sem classificação explícita são
 * tratados como técnico (default).
 *
 * @param {Array} trades
 * @returns {{total: number, classifiedExplicit: number, tecnico: number, sorte: number,
 *            pctTecnico: number|null, pctSorte: number|null, flagsRanking: Array<{flag, count}>}}
 */
export function computeMentorClassificationStats(trades) {
  const safe = Array.isArray(trades) ? trades : [];
  const total = safe.length;

  const sorte = safe.filter((t) => t?.mentorClassification === 'sorte').length;
  const tecnico = total - sorte; // null e 'tecnico' contam como técnico
  const classifiedExplicit = safe.filter(
    (t) => t?.mentorClassification === 'tecnico' || t?.mentorClassification === 'sorte'
  ).length;

  const pctTecnico = total === 0 ? null : (tecnico / total) * 100;
  const pctSorte = total === 0 ? null : (sorte / total) * 100;

  const flagsCounter = Object.fromEntries(MENTOR_CLASSIFICATION_FLAGS.map((f) => [f, 0]));
  for (const t of safe) {
    if (t?.mentorClassification !== 'sorte') continue;
    const flags = Array.isArray(t.mentorClassificationFlags) ? t.mentorClassificationFlags : [];
    for (const f of flags) {
      if (Object.prototype.hasOwnProperty.call(flagsCounter, f)) {
        flagsCounter[f] += 1;
      }
    }
  }
  const flagsRanking = Object.entries(flagsCounter)
    .map(([flag, count]) => ({ flag, count }))
    .sort((a, b) => b.count - a.count);

  return {
    total,
    classifiedExplicit,
    tecnico,
    sorte,
    pctTecnico,
    pctSorte,
    flagsRanking,
  };
}

/**
 * luckRate por setup (% sorte sobre TOTAL de trades do setup; default = técnico).
 *
 * @param {Array} tradesInSetup - trades já filtrados pelo setup
 * @returns {{total: number, sorte: number, luckRate: number|null}}
 */
export function computeLuckRateForSetup(tradesInSetup) {
  const safe = Array.isArray(tradesInSetup) ? tradesInSetup : [];
  const total = safe.length;
  const sorte = safe.filter((t) => t?.mentorClassification === 'sorte').length;
  const luckRate = total === 0 ? null : sorte / total;
  return { total, sorte, luckRate };
}
