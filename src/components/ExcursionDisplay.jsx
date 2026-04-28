/**
 * ExcursionDisplay.jsx — issue #187 Fase 2.5
 *
 * Componente reutilizável para exibir MEP/MEN em qualquer renderização de trade.
 * Storage interno é preço (DEC-AUTO-187-01); display é sempre pts (futures) ou % (equity).
 *
 * Variantes:
 *   compact — inline em tabelas/cards (↑+X pts ↓-Y pts)
 *   full    — grid 3-col em modais/páginas (MEP / MEN / Fonte)
 */

import { detectInstrumentType, derivePtsFromPrice } from '../utils/excursionParsing';
import ExcursionSourceBadge from './ExcursionSourceBadge';

function formatDelta(value, unit) {
  if (value == null) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value} ${unit}`;
}

export default function ExcursionDisplay({ trade, variant = 'compact', className = '' }) {
  if (!trade) return null;
  const { mepPrice, menPrice, excursionSource, ticker, entry, side } = trade;

  if (mepPrice == null && menPrice == null && !excursionSource) return null;

  const instrumentType = detectInstrumentType(ticker);
  const { mepDelta, menDelta, unit } = derivePtsFromPrice({
    mepPrice, menPrice, entry, side, instrumentType,
  });

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 text-[11px] ${className}`}>
        {mepDelta != null && (
          <span className="text-emerald-300" title="MEP — pico favorável durante o trade">
            ↑ {formatDelta(mepDelta, unit)}
          </span>
        )}
        {menDelta != null && (
          <span className="text-rose-300" title="MEN — pior tick adverso durante o trade">
            ↓ {formatDelta(menDelta, unit)}
          </span>
        )}
        {excursionSource && <ExcursionSourceBadge source={excursionSource} />}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-3 gap-4 ${className}`}>
      <div>
        <div className="text-xs text-slate-400 mb-1" title="Pico favorável durante o trade">MEP</div>
        <div className="text-sm font-medium text-emerald-300">
          {formatDelta(mepDelta, unit)}
        </div>
      </div>
      <div>
        <div className="text-xs text-slate-400 mb-1" title="Pior tick adverso durante o trade">MEN</div>
        <div className="text-sm font-medium text-rose-300">
          {formatDelta(menDelta, unit)}
        </div>
      </div>
      <div>
        <div className="text-xs text-slate-400 mb-1">Fonte</div>
        {excursionSource ? <ExcursionSourceBadge source={excursionSource} /> : <span className="text-sm text-slate-500">—</span>}
      </div>
    </div>
  );
}
