/**
 * CsvActivationResultModal.jsx
 * @version 1.0.0 (v1.55.1 — issue #240)
 * @description Modal glass com sumário do que aconteceu ao ativar trades do
 *   staging do CSV — substitui os `alert()` browser default.
 *
 * 4 buckets:
 *   - success    (verde)  — trades criados
 *   - enriched   (azul)   — trades existentes que ganharam MEP/MEN do CSV
 *   - skipped    (âmbar)  — duplicatas exatas, sem nada novo a contribuir
 *   - failed     (vermelho) — erros
 *
 * Mostra contagens + listas detalhadas. Fecha com Esc, X ou clique fora.
 */

import { CheckCircle, Sparkles, Copy, AlertCircle, AlertTriangle, X } from 'lucide-react';
import DebugBadge from '../DebugBadge';

const BUCKET_META = {
  success: {
    label: 'Ativados',
    Icon: CheckCircle,
    color: 'emerald',
    description: 'Novos trades criados no diário',
  },
  enriched: {
    label: 'Enriquecidos (MEP/MEN)',
    Icon: Sparkles,
    color: 'blue',
    description: 'Trades existentes ganharam excursão a partir do CSV',
  },
  skipped: {
    label: 'Duplicatas ignoradas',
    Icon: Copy,
    color: 'amber',
    description: 'Já existiam como trade — nada a contribuir',
  },
  excursionStripped: {
    label: 'MEP/MEN descartados',
    Icon: AlertTriangle,
    color: 'orange',
    description: 'Valores inconsistentes no CSV — trade ativado sem MEP/MEN. Yahoo enrichment vai recalcular.',
  },
  failed: {
    label: 'Falhas',
    Icon: AlertCircle,
    color: 'red',
    description: 'Não foi possível ativar',
  },
};

const COLOR_CLASSES = {
  emerald: { border: 'border-emerald-500/20', bg: 'bg-emerald-500/10', text: 'text-emerald-400', textSoft: 'text-emerald-300' },
  blue:    { border: 'border-blue-500/20',    bg: 'bg-blue-500/10',    text: 'text-blue-400',    textSoft: 'text-blue-300' },
  amber:   { border: 'border-amber-500/20',   bg: 'bg-amber-500/10',   text: 'text-amber-400',   textSoft: 'text-amber-300' },
  orange:  { border: 'border-orange-500/20',  bg: 'bg-orange-500/10',  text: 'text-orange-400',  textSoft: 'text-orange-300' },
  red:     { border: 'border-red-500/20',     bg: 'bg-red-500/10',     text: 'text-red-400',     textSoft: 'text-red-300' },
};

const SectionHeader = ({ bucket, count }) => {
  const meta = BUCKET_META[bucket];
  const cls = COLOR_CLASSES[meta.color];
  const { Icon } = meta;
  return (
    <div className="flex items-start gap-2">
      <Icon className={`w-4 h-4 ${cls.text} mt-0.5 shrink-0`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-white">
          {count} {meta.label.toLowerCase()}
        </p>
        <p className="text-[10px] text-slate-500 mt-0.5">{meta.description}</p>
      </div>
    </div>
  );
};

/**
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {Object} props.result — { success: string[], enriched: [], skipped: [], failed: [] }
 *   - success: array de trade IDs criados
 *   - enriched: [{ id, matchedTradeId, fields[] }]
 *   - skipped:  [{ id, matchedTradeId, reason }]
 *   - failed:   [{ id, error }]
 */
const CsvActivationResultModal = ({ isOpen, onClose, result }) => {
  if (!isOpen || !result) return null;

  const success = result.success || [];
  const enriched = result.enriched || [];
  const skipped = result.skipped || [];
  const excursionStripped = result.excursionStripped || [];
  const failed = result.failed || [];

  const hasAnything = success.length + enriched.length + skipped.length + excursionStripped.length + failed.length > 0;
  if (!hasAnything) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm pb-16"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800/50 shrink-0">
          <h2 className="text-sm font-semibold text-white">Importação concluída</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tally */}
        <div className="grid grid-cols-2 gap-2 px-5 py-3 shrink-0">
          {['success', 'enriched', 'skipped', 'excursionStripped', 'failed'].map((bucket) => {
            const counts = { success: success.length, enriched: enriched.length, skipped: skipped.length, excursionStripped: excursionStripped.length, failed: failed.length };
            const count = counts[bucket];
            if (count === 0) return null;
            const meta = BUCKET_META[bucket];
            const cls = COLOR_CLASSES[meta.color];
            return (
              <div key={bucket} className={`px-3 py-2 rounded-lg border ${cls.border} ${cls.bg}`}>
                <SectionHeader bucket={bucket} count={count} />
              </div>
            );
          })}
        </div>

        {/* Detail */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-3">
          {enriched.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-blue-300/80 mb-1.5">Enriquecidos</p>
              <div className="space-y-1">
                {enriched.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/5 border border-blue-500/10">
                    <Sparkles className="w-3 h-3 text-blue-400 shrink-0" />
                    <span className="text-[11px] font-mono text-slate-300 truncate">{item.matchedTradeId}</span>
                    <span className="text-[10px] text-blue-300 ml-auto">{item.fields.join(' · ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {skipped.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-amber-300/80 mb-1.5">Ignorados</p>
              <div className="space-y-1">
                {skipped.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 px-3 py-1.5 rounded-lg bg-amber-500/5 border border-amber-500/10">
                    <Copy className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-mono text-slate-300 truncate">{item.matchedTradeId}</p>
                      {item.reason && <p className="text-[10px] text-amber-300/70 mt-0.5 truncate">{item.reason}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {excursionStripped.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-orange-300/80 mb-1.5">MEP/MEN descartados</p>
              <div className="space-y-1">
                {excursionStripped.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 px-3 py-1.5 rounded-lg bg-orange-500/5 border border-orange-500/10">
                    <AlertTriangle className="w-3 h-3 text-orange-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-mono text-slate-300 truncate">{item.newTradeId || item.id}</p>
                      {item.reason && <p className="text-[10px] text-orange-300/70 mt-0.5">{item.reason}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {failed.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-red-300/80 mb-1.5">Falhas</p>
              <div className="space-y-1">
                {failed.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 px-3 py-1.5 rounded-lg bg-red-500/5 border border-red-500/10">
                    <AlertCircle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-mono text-slate-300 truncate">{item.id}</p>
                      <p className="text-[10px] text-red-300/80 mt-0.5">{item.error}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-5 py-3 border-t border-slate-800/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>

        <DebugBadge component="CsvActivationResultModal" />
      </div>
    </div>
  );
};

export default CsvActivationResultModal;
