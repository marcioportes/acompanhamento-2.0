/**
 * forwardActionsHeuristics.js — IA stub heurístico (Forward Actions auto-suggest)
 *
 * Pure function consumida pela etapa 7 (Commit) do wizard. Pré-popula
 * 1-2 commitments comportamentais derivados do top error + valley emocional.
 * Aluno aceita / edita / escreve do zero (max 2 commitments — regra retro).
 *
 * Issue #259 (1A — Ritual completo de Fechamento de Ciclo).
 *
 * Mapeamento canônico (compliance.violations.type → texto):
 *   NO_STOP                    → "Não entrar em trade sem SL definido — gate na UI bloqueia entry"
 *   RR_FAIL                    → "RR < target em todo trade — calcular RR antes de mandar a ordem"
 *   FORA_DO_PLANO (RO)         → "Risco por operação dentro do plano — gate na UI alerta antes do envio"
 *   STOP_TAMPERING             → "Não mexer no SL após entrada (regra firme)"
 *   STOP_BREAKEVEN_TOO_EARLY   → "Não levar SL pra breakeven antes de 50% do alvo"
 *   STOP_HESITATION            → "SL definido na entrada — não reenviar com preço diferente"
 *   STOP_PARTIAL_SIZING        → "Reduzir size só por trigger técnico, nunca por desconforto"
 *   RAPID_REENTRY_POST_STOP    → "Após stop, esperar 15min antes de reentrar no mesmo ativo"
 *   CHASE_REENTRY              → "Não perseguir movimento após stop — esperar setup novo"
 *   HESITATION_PRE_ENTRY       → "Sinal claro = entrada imediata; hesitação = passar"
 *
 * Mapeamento valley emocional (event types → contexto):
 *   TILT após N losses                → "Hard stop do dia após 3 losses consecutivos"
 *   REVENGE                           → "Após stop, fechar plataforma por 15min"
 *   OVERTRADING                       → "Limite máximo de trades por dia conforme plano"
 *   Valley score baixo s/ trigger     → "Notas curtas no journal antes de cada entry"
 */

const ERROR_TO_COMMITMENT = Object.freeze({
  NO_STOP:                  'Não entrar em trade sem SL definido — gate na UI bloqueia entry',
  RR_FAIL:                  'RR < target em todo trade — calcular RR antes de mandar a ordem',
  FORA_DO_PLANO:            'Risco por operação dentro do plano — gate na UI alerta antes do envio',
  STOP_TAMPERING:           'Não mexer no SL após entrada (regra firme)',
  STOP_BREAKEVEN_TOO_EARLY: 'Não levar SL pra breakeven antes de 50% do alvo',
  STOP_HESITATION:          'SL definido na entrada — não reenviar com preço diferente',
  STOP_PARTIAL_SIZING:      'Reduzir size só por trigger técnico, nunca por desconforto',
  RAPID_REENTRY_POST_STOP:  'Após stop, esperar 15min antes de reentrar no mesmo ativo',
  CHASE_REENTRY:            'Não perseguir movimento após stop — esperar setup novo',
  HESITATION_PRE_ENTRY:     'Sinal claro = entrada imediata; hesitação = passar',
});

const VALLEY_TO_COMMITMENT = Object.freeze({
  // Críticos (issue #259 R2) — vêm primeiro porque cortam o padrão autodestrutivo
  STOP_VIOLATION: 'Auto-bloqueio: após hit do stop do ciclo, app rejeita add-trade até o próximo ciclo',
  STOP_TAMPERING_SYS: 'Stop é commit pré-trade: alterar SL após entry não é permitido',
  TILT_SYSTEMIC: 'Pausa de 24h após qualquer dia com tilt detectado (gate disciplinar)',

  // Originais
  TILT:        'Hard stop do dia após 3 losses consecutivos (auto-lock pelo app)',
  REVENGE:     'Após stop, fechar plataforma por 15min antes de qualquer ação',
  OVERTRADING: 'Limite máximo de trades por dia conforme plano (gate na UI)',
});

const FALLBACK_COMMITMENT = 'Notas curtas no journal antes de cada entry (clarificar tese)';

/**
 * Sugestão 1 — derivada do top 1 erro do ciclo.
 *
 * @param {Array<{type: string, count: number}>} topErrorsList — saída de cycleMetrics.topErrors
 * @returns {string|null}
 */
export function suggestCommitmentFromTopError(topErrorsList) {
  const list = Array.isArray(topErrorsList) ? topErrorsList : [];
  if (list.length === 0) return null;
  const top = list[0];
  if (!top || typeof top.type !== 'string') return null;
  return ERROR_TO_COMMITMENT[top.type] || null;
}

/**
 * Sugestão 2 — derivada do valley emocional / sinais críticos do ciclo.
 *
 * R2 (#259): prioridade reordenada para que sinais críticos (violação de stop
 * com trades pós-breach, stop tampering repetido, tilt sistêmico) venham antes
 * de revenge/tilt isolado. Esses commitments são "auto-defesa" pro próximo ciclo.
 *
 * @param {Object} input
 * @param {Object} input.emotional               — saída de patterns.emotional
 * @param {Object} input.emotional.valley        — { date, score }
 * @param {Object} input.eventCounts             — { tilt, tiltDaysCount, revenge, overtrading, stopTampering, ... }
 * @param {Object} input.stopBreach              — { tradesAfterStop, severity }
 * @returns {string|null}
 */
export function suggestCommitmentFromValley({ emotional, eventCounts, stopBreach }) {
  const counts = eventCounts || {};
  const breach = stopBreach || {};

  // Prioridade R2 — críticos primeiro
  if (breach.tradesAfterStop >= 1) return VALLEY_TO_COMMITMENT.STOP_VIOLATION;
  if ((counts.stopTampering ?? 0) >= 1) return VALLEY_TO_COMMITMENT.STOP_TAMPERING_SYS;
  if ((counts.tiltDaysCount ?? 0) >= 3) return VALLEY_TO_COMMITMENT.TILT_SYSTEMIC;

  // Originais
  if ((counts.revenge ?? 0) > 0) return VALLEY_TO_COMMITMENT.REVENGE;
  if ((counts.tilt ?? 0) > 0) return VALLEY_TO_COMMITMENT.TILT;
  if ((counts.overtrading ?? 0) > 0) return VALLEY_TO_COMMITMENT.OVERTRADING;

  // Sem evento detectado mas com valley emocional baixo → fallback
  if (emotional?.valley && typeof emotional.valley.score === 'number' && emotional.valley.score < 50) {
    return FALLBACK_COMMITMENT;
  }
  return null;
}

/**
 * Conveniência: até 2 commitments deduplicados (sustain/improve regra retro).
 *
 * @param {Object} input
 * @param {Array} input.topErrorsList
 * @param {Object} input.emotional
 * @param {Object} input.eventCounts
 * @param {Object} input.stopBreach
 * @returns {Array<string>} 0..2 commitments
 */
export function suggestForwardCommitments({ topErrorsList, emotional, eventCounts, stopBreach }) {
  const out = [];
  // R2: valley/críticos primeiro — se houve violação de stop ou tilt sistêmico, esse é
  // o commitment de maior prioridade. Erro de compliance vira segundo.
  const fromValley = suggestCommitmentFromValley({ emotional, eventCounts, stopBreach });
  const fromError = suggestCommitmentFromTopError(topErrorsList);

  if (fromValley) out.push(fromValley);
  if (fromError && fromError !== fromValley) out.push(fromError);
  return out.slice(0, 2);
}

export const ERROR_COMMITMENT_MAP = ERROR_TO_COMMITMENT;
export const VALLEY_COMMITMENT_MAP = VALLEY_TO_COMMITMENT;
export const FALLBACK_FORWARD_COMMITMENT = FALLBACK_COMMITMENT;
