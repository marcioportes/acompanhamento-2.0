/**
 * CsvPreviewStep
 * @version 1.0.0 (v1.18.0)
 * @description Etapa 3: preview dos trades mapeados, erros, warnings, incompletos.
 */

import { useState, useMemo } from 'react';
import {
  CheckCircle, XCircle, AlertTriangle, Info,
  TrendingUp, TrendingDown
} from 'lucide-react';

const fmtDate = (iso) => {
  if (!iso) return '-';
  try {
    const [datePart, timePart] = iso.split('T');
    const [y, m, d] = datePart.split('-');
    const time = timePart ? timePart.slice(0, 5) : '';
    return `${d}/${m} ${time}`;
  } catch { return iso; }
};

const CsvPreviewStep = ({
  mappedResult,
  validationResult,
  incompleteSummary,
  importResult,
  masterTickers = [],
}) => {
  const [showErrors, setShowErrors] = useState(true);
  const [showWarnings, setShowWarnings] = useState(false);

  if (!mappedResult || !validationResult) return null;

  const { stats } = validationResult;

  // Ticker validation: warnings para tickers não cadastrados
  const tickerWarnings = useMemo(() => {
    if (!masterTickers || masterTickers.length === 0 || !validationResult.validTrades) return [];
    const tickerNames = new Set(masterTickers.map(t => (t.symbol || '').toUpperCase()));
    const unknown = new Set();
    validationResult.validTrades.forEach(t => {
      const ticker = (t.ticker || '').toUpperCase();
      if (ticker && !tickerNames.has(ticker)) unknown.add(ticker);
    });
    return [...unknown];
  }, [masterTickers, validationResult.validTrades]);

  // Import concluído com sucesso
  if (importResult?.success) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <CheckCircle className="w-16 h-16 text-emerald-400" />
        <h3 className="text-xl font-bold text-white">Importação concluída!</h3>
        <p className="text-slate-400 text-center max-w-md">
          {importResult.count} trades importados com sucesso.
          {incompleteSummary.length > 0 && ' Alguns trades precisam de complemento (emoções, imagens).'}
        </p>
      </div>
    );
  }

  // Erro no import
  if (importResult && !importResult.success) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <XCircle className="w-16 h-16 text-red-400" />
        <h3 className="text-xl font-bold text-red-400">Erro na importação</h3>
        <p className="text-slate-400">{importResult.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/30 text-center">
          <p className="text-2xl font-mono font-bold text-white">{stats.total}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Total</p>
        </div>
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
          <p className="text-2xl font-mono font-bold text-emerald-400">{stats.valid}</p>
          <p className="text-[10px] text-emerald-500/70 uppercase tracking-wider">Válidos</p>
        </div>
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
          <p className="text-2xl font-mono font-bold text-red-400">{stats.invalid}</p>
          <p className="text-[10px] text-red-500/70 uppercase tracking-wider">Com erro</p>
        </div>
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
          <p className="text-2xl font-mono font-bold text-amber-400">{stats.withWarnings}</p>
          <p className="text-[10px] text-amber-500/70 uppercase tracking-wider">Avisos</p>
        </div>
      </div>

      {/* Totalizador para checagem */}
      {validationResult.validTrades.length > 0 && (() => {
        const validTrades = validationResult.validTrades;
        const totalResult = validTrades.reduce((s, t) => s + (t.result ?? 0), 0);
        const grossProfit = validTrades.filter(t => (t.result ?? 0) > 0).reduce((s, t) => s + t.result, 0);
        const grossLoss = validTrades.filter(t => (t.result ?? 0) < 0).reduce((s, t) => s + t.result, 0);
        return (
          <div className="grid grid-cols-4 gap-3">
            <div className="p-2.5 rounded-lg bg-slate-800/30 border border-slate-700/20">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Operações</p>
              <p className="text-sm font-mono font-bold text-white">{validTrades.length}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-800/30 border border-slate-700/20">
              <p className="text-[10px] text-emerald-500/70 uppercase tracking-wider mb-0.5">Lucro Bruto</p>
              <p className="text-sm font-mono font-bold text-emerald-400">+{grossProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-800/30 border border-slate-700/20">
              <p className="text-[10px] text-red-500/70 uppercase tracking-wider mb-0.5">Prejuízo Bruto</p>
              <p className="text-sm font-mono font-bold text-red-400">{grossLoss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-800/30 border border-slate-700/20">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Resultado</p>
              <p className={`text-sm font-mono font-bold ${totalResult >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{totalResult >= 0 ? '+' : ''}{totalResult.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        );
      })()}

      {/* Incompletos */}
      {incompleteSummary.length > 0 && (
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-bold text-blue-400">Campos para completar após import:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {incompleteSummary.map(({ field, count, percent }) => (
              <span key={field} className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-mono">
                {field}: {count} ({percent}%)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tickers não cadastrados */}
      {tickerWarnings.length > 0 && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-bold text-amber-400">Tickers não cadastrados:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {tickerWarnings.map(ticker => (
              <span key={ticker} className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-mono">
                {ticker}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-amber-400/60 mt-1.5">Os trades serão importados, mas compliance (RO/RR) pode não calcular corretamente sem ticker cadastrado.</p>
        </div>
      )}

      {/* Erros */}
      {validationResult.invalidTrades.length > 0 && (
        <div>
          <button
            onClick={() => setShowErrors(!showErrors)}
            className="flex items-center gap-2 text-sm font-bold text-red-400 mb-2"
          >
            <XCircle className="w-4 h-4" />
            {validationResult.invalidTrades.length} trades com erro (não serão importados)
          </button>
          {showErrors && (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {validationResult.invalidTrades.map((t, i) => (
                <div key={i} className="text-xs px-3 py-1.5 rounded bg-red-500/5 border border-red-500/10 text-red-300/80">
                  <span className="font-mono text-red-400">Linha {t._rowIndex}:</span> {t._errors.join('; ')}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tabela preview */}
      <div className="overflow-auto max-h-[40vh] rounded-lg border border-slate-800/50">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-slate-800/80 text-[10px] uppercase text-slate-500 sticky top-0 z-10 font-bold tracking-wider">
            <tr>
              <th className="p-2 w-10 text-center">#</th>
              <th className="p-2">Data</th>
              <th className="p-2">Ticker</th>
              <th className="p-2">Side</th>
              <th className="p-2 text-right">Entrada</th>
              <th className="p-2 text-right">Saída</th>
              <th className="p-2 text-right">Qty</th>
              <th className="p-2 text-right">Resultado</th>
              <th className="p-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/30">
            {validationResult.validTrades.slice(0, 100).map((trade, i) => {
              const result = trade.result ?? 0;
              const hasWarnings = trade._warnings?.length > 0;
              return (
                <tr key={i} className={`hover:bg-slate-800/30 ${hasWarnings ? 'bg-amber-500/[0.02]' : ''}`}>
                  <td className="p-2 text-center text-slate-600 font-mono text-xs">{trade._rowIndex}</td>
                  <td className="p-2 text-slate-300 font-mono text-xs">{fmtDate(trade.entryTime)}</td>
                  <td className="p-2 text-white font-bold">{trade.ticker}</td>
                  <td className="p-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded border ${
                      trade.side === 'LONG' ? 'border-emerald-500/30 text-emerald-400' : 'border-red-500/30 text-red-400'
                    }`}>{trade.side}</span>
                  </td>
                  <td className="p-2 text-right font-mono text-slate-400 text-xs">{trade.entry?.toLocaleString('pt-BR')}</td>
                  <td className="p-2 text-right font-mono text-slate-400 text-xs">{trade.exit?.toLocaleString('pt-BR')}</td>
                  <td className="p-2 text-right font-mono text-slate-400 text-xs">{trade.qty}</td>
                  <td className={`p-2 text-right font-mono font-bold text-xs ${result >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {result >= 0 ? '+' : ''}{result?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-2 text-center">
                    {hasWarnings ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mx-auto" title={trade._warnings.join(', ')} />
                    ) : (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500/50 mx-auto" />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {validationResult.validTrades.length > 100 && (
          <div className="p-3 text-center text-xs text-slate-500 bg-slate-800/20">
            Mostrando 100 de {validationResult.validTrades.length} trades válidos
          </div>
        )}
      </div>
    </div>
  );
};

export default CsvPreviewStep;
