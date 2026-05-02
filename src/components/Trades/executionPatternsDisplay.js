/**
 * Constantes e helpers compartilhados de exibição dos padrões de execução
 * detectados pelo executionBehaviorEngine. Reusados pelo ExecutionPatternsPanel
 * (visão por trade) e pelo ExecutionPatternsAggregateCard (visão agregada na
 * janela do aluno/mentor). Issue #208.
 */

export const SEVERITY_STYLES = {
  HIGH: 'bg-red-500/15 border-red-500/40 text-red-300',
  MEDIUM: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
  LOW: 'bg-slate-500/15 border-slate-500/40 text-slate-300',
};

export const SEVERITY_DOT = {
  HIGH: 'bg-red-400',
  MEDIUM: 'bg-amber-400',
  LOW: 'bg-slate-400',
};

export const EVENT_LABELS = {
  STOP_TAMPERING: 'Stop reemitido para mais largo',
  STOP_PARTIAL_SIZING: 'Stop dimensionado para meio lote',
  RAPID_REENTRY_POST_STOP: 'Reentrada rápida após stop',
  HESITATION_PRE_ENTRY: 'Hesitação pré-entrada',
  CHASE_REENTRY: 'Reentrada com preço pior (chase)',
  STOP_BREAKEVEN_TOO_EARLY: 'Stop levado pra zero cedo demais',
  STOP_HESITATION: 'Hesitação no stop (reissue sem mudar preço)',
};

export const EVENT_DESCRIPTIONS = {
  STOP_TAMPERING:
    'Stop foi cancelado e reemitido em preço pior durante a vida do trade. Sinal de loss aversion: aceitar mais risco para evitar materializar perda menor.',
  STOP_PARTIAL_SIZING:
    'Stop colocado para fração do tamanho total do trade — disposition sub-protege a posição completa.',
  RAPID_REENTRY_POST_STOP:
    'Nova entrada no mesmo lado e instrumento poucos minutos após sair em prejuízo. Padrão de loss-chasing.',
  HESITATION_PRE_ENTRY:
    'Limite cancelado e re-entrada efetiva pouco depois — heurística operacional, indica indecisão pré-trade.',
  CHASE_REENTRY:
    'Limite cancelado e re-submetido em preço pior antes do fill. Comportamento de overtrading/perseguição de preço.',
  STOP_BREAKEVEN_TOO_EARLY:
    'Stop movido para a entrada antes do trade respirar. Loss aversion + regret aversion: medo de perder o que ainda nem virou lucro. Padrão típico antes de chasing pós-stop.',
  STOP_HESITATION:
    'Stop cancelado e reemitido no mesmo preço múltiplas vezes — trader "mexendo" sem decidir. Sinal sutil de indecisão visível em audit-trail.',
};

export const EVENT_SEVERITY_RANK = { HIGH: 3, MEDIUM: 2, LOW: 1 };

export function formatEvidence(event) {
  const e = event.evidence || {};
  switch (event.type) {
    case 'STOP_TAMPERING':
      return `Stop movido de ${e.from} para ${e.to} (${e.tradeSide || ''} — risco ampliado)`;
    case 'STOP_PARTIAL_SIZING':
      return `Stop qty=${e.stopQty} enquanto trade qty=${e.tradeQty} (cobertura ${Math.round((e.ratio || 0) * 100)}%)`;
    case 'RAPID_REENTRY_POST_STOP':
      return `${e.gapMinutes}min após o trade anterior fechar em prejuízo · ${e.side} ${e.instrument}`;
    case 'HESITATION_PRE_ENTRY':
      return `Cancelamento ${e.gapMinutes}min antes da entrada efetiva`;
    case 'CHASE_REENTRY':
      return `Re-submetida com preço pior em ${e.worseBy} (${e.side} ${e.prevPrice} → ${e.currPrice})`;
    case 'STOP_BREAKEVEN_TOO_EARLY':
      return `Stop movido para entrada (${e.from} → ${e.to}, entry ${e.entry}) em ${e.minutesSinceEntry}min — ${e.side} ${e.ticker || ''}`.trim();
    case 'STOP_HESITATION':
      return `${e.noOpReissues} reissue${e.noOpReissues === 1 ? '' : 's'} de stop sem mudar preço (${e.stopPrice})`;
    default:
      return null;
  }
}

export function formatCitation(event) {
  if (event.source === 'literature' && event.citation) {
    return `Fonte: ${event.citation}`;
  }
  if (event.source === 'heuristic') {
    return event.citation
      ? `Fonte: ${event.citation} (heurística)`
      : 'Fonte: heurística operacional';
  }
  return null;
}

export function highestSeverity(events) {
  let best = 0;
  let label = null;
  for (const ev of events) {
    const r = EVENT_SEVERITY_RANK[ev.severity] || 0;
    if (r > best) {
      best = r;
      label = ev.severity;
    }
  }
  return label;
}
