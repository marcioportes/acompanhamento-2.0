/**
 * CsvImportManager
 * @version 3.0.0 (v1.18.0)
 * @description Modal de gestão de trades em staging (csvStagingTrades).
 *   - Agrupa trades por importBatchId
 *   - Checkbox + selecionar todos
 *   - Excluir seleção / excluir batch
 *   - Completar em massa (emotionEntry, emotionExit, setup, stopLoss)
 *   - ATIVAR: move trades do staging para trades via addTrade
 *
 * CHANGELOG:
 * - 3.0.0: Reescrita completa para staging collection. Botão "Ativar" chama addTrade legado.
 * - 2.0.0: Versão v1 (descartada)
 */

import { useState, useMemo } from 'react';
import {
  Package, Trash2, CheckSquare, Square, CheckCircle,
  AlertTriangle, Edit3, X, ChevronDown, ChevronUp, Loader2,
  Play, Zap
} from 'lucide-react';
import DebugBadge from '../DebugBadge';

const fmtTimestamp = (ts) => {
  if (!ts) return '-';
  try {
    const d = ts.toDate ? ts.toDate() : (ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts));
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return '-'; }
};

const fmtTradeTime = (iso) => {
  if (!iso) return '-';
  try {
    const [datePart, timePart] = iso.split('T');
    const [y, m, d] = datePart.split('-');
    const time = timePart ? timePart.slice(0, 5) : '';
    return `${d}/${m} ${time}`;
  } catch { return iso; }
};

const CsvImportManager = ({
  isOpen,
  onClose,
  stagingTrades = [],
  emotions = [],
  setups = [],
  onUpdateStagingTrade,
  onDeleteStagingTrade,
  onDeleteStagingBatch,
  onActivateTrade,
  onActivateBatch,
  getBatches,
}) => {
  const [expandedBatch, setExpandedBatch] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completeData, setCompleteData] = useState({ emotionEntry: '', emotionExit: '', setup: '' });
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' });

  const batches = useMemo(() => {
    if (getBatches) return getBatches();
    return [];
  }, [getBatches, stagingTrades]);

  if (!isOpen) return null;

  // === HANDLERS ===

  const toggleSelect = (tradeId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(tradeId)) next.delete(tradeId); else next.add(tradeId);
      return next;
    });
  };

  const toggleSelectAll = (batch) => {
    const batchIds = batch.trades.map(t => t.id);
    const allSelected = batchIds.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) batchIds.forEach(id => next.delete(id)); else batchIds.forEach(id => next.add(id));
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Excluir ${selectedIds.size} trade(s) do staging?`)) return;
    setProcessing(true);
    const ids = [...selectedIds];
    setProgress({ current: 0, total: ids.length, label: 'Excluindo...' });
    try {
      for (let i = 0; i < ids.length; i++) {
        await onDeleteStagingTrade(ids[i]);
        setProgress({ current: i + 1, total: ids.length, label: 'Excluindo...' });
      }
      setSelectedIds(new Set());
    } catch (err) { alert('Erro: ' + err.message); }
    finally { setProcessing(false); setProgress({ current: 0, total: 0, label: '' }); }
  };

  const handleDeleteBatch = async (batch) => {
    if (!confirm(`Excluir TODA a importação (${batch.trades.length} trades do staging)?`)) return;
    setProcessing(true);
    setProgress({ current: 0, total: 1, label: 'Excluindo batch...' });
    try {
      await onDeleteStagingBatch(batch.batchId);
      setSelectedIds(new Set());
      setProgress({ current: 1, total: 1, label: 'Concluído' });
    } catch (err) { alert('Erro: ' + err.message); }
    finally { setProcessing(false); setProgress({ current: 0, total: 0, label: '' }); }
  };

  const handleCompleteSelected = async () => {
    if (selectedIds.size === 0) return;
    setProcessing(true);
    const ids = [...selectedIds];
    setProgress({ current: 0, total: ids.length, label: 'Completando...' });
    try {
      const updates = {};
      if (completeData.emotionEntry) updates.emotionEntry = completeData.emotionEntry;
      if (completeData.emotionExit) updates.emotionExit = completeData.emotionExit;
      if (completeData.setup) updates.setup = completeData.setup;

      for (let i = 0; i < ids.length; i++) {
        await onUpdateStagingTrade(ids[i], updates);
        setProgress({ current: i + 1, total: ids.length, label: 'Completando...' });
      }
      setShowCompleteModal(false);
      setCompleteData({ emotionEntry: '', emotionExit: '', setup: '' });
    } catch (err) { alert('Erro: ' + err.message); }
    finally { setProcessing(false); setProgress({ current: 0, total: 0, label: '' }); }
  };

  /** Ativar trades selecionados (que estejam completos) */
  const handleActivateSelected = async () => {
    const readyIds = [...selectedIds].filter(id => {
      const t = stagingTrades.find(st => st.id === id);
      return t?.isComplete;
    });
    if (readyIds.length === 0) {
      alert('Nenhum trade selecionado está completo (precisa emotionEntry + emotionExit + setup).');
      return;
    }
    if (!confirm(`Ativar ${readyIds.length} trade(s)? O painel será fechado durante o processamento.`)) return;

    // Fechar modal ANTES de processar — evita piscar por re-renders do listener
    setSelectedIds(new Set());
    onClose();

    try {
      const result = await onActivateBatch(readyIds);
      if (result.failed.length > 0) {
        setTimeout(() => alert(`${result.success.length} ativados, ${result.failed.length} falhas:\n${result.failed.map(f => f.error).join('\n')}`), 300);
      }
    } catch (err) {
      setTimeout(() => alert('Erro ao ativar: ' + err.message), 300);
    }
  };

  /** Ativar trade individual — fecha modal, processa, sem piscar */
  const handleActivateSingle = async (trade) => {
    if (!confirm(`Ativar trade ${trade.ticker} ${trade.side}? O painel será fechado durante o processamento.`)) return;
    onClose();
    try {
      await onActivateTrade(trade);
    } catch (err) {
      setTimeout(() => alert('Erro ao ativar: ' + err.message), 300);
    }
  };

  // Contadores globais
  const selectedInBatch = (batch) => [...selectedIds].filter(id => batch.trades.some(t => t.id === id));
  const selectedReadyCount = [...selectedIds].filter(id => stagingTrades.find(t => t.id === id)?.isComplete).length;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl h-[80vh] rounded-xl flex flex-col shadow-2xl ring-1 ring-white/10">

        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-400" />
              Staging — Trades Importados
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {stagingTrades.length} trades em staging • {stagingTrades.filter(t => t.isComplete).length} prontos para ativar
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress bar global */}
        {processing && progress.total > 0 && (
          <div className="px-5 py-2 bg-slate-800/30 border-b border-slate-800/50">
            <div className="flex items-center gap-3">
              <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
              <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-150" style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }} />
              </div>
              <span className="text-xs text-slate-400 font-mono">{progress.label} {progress.current}/{progress.total}</span>
            </div>
          </div>
        )}

        {/* Floating action bar */}
        {selectedIds.size > 0 && (
          <div className="px-5 py-2 bg-blue-500/10 border-b border-blue-500/20 flex items-center justify-between">
            <span className="text-xs text-blue-400 font-bold">{selectedIds.size} selecionado(s)</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowCompleteModal(true)} disabled={processing} className="flex items-center gap-1 px-2.5 py-1 text-xs text-blue-400 hover:bg-blue-500/10 rounded border border-blue-500/20">
                <Edit3 className="w-3 h-3" /> Completar
              </button>
              {selectedReadyCount > 0 && (
                <button onClick={handleActivateSelected} disabled={processing} className="flex items-center gap-1 px-2.5 py-1 text-xs text-emerald-400 hover:bg-emerald-500/10 rounded border border-emerald-500/20 font-bold">
                  <Zap className="w-3 h-3" /> Ativar ({selectedReadyCount})
                </button>
              )}
              <button onClick={handleDeleteSelected} disabled={processing} className="flex items-center gap-1 px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded border border-red-500/20">
                <Trash2 className="w-3 h-3" /> Excluir
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {batches.length === 0 && (
            <div className="text-center py-16 text-slate-500">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Nenhum trade em staging.</p>
              <p className="text-xs text-slate-600 mt-1">Use o botão "Importar CSV" para trazer trades.</p>
            </div>
          )}

          {batches.map(batch => {
            const isExpanded = expandedBatch === batch.batchId;
            const batchIds = batch.trades.map(t => t.id);
            const allSelected = batchIds.length > 0 && batchIds.every(id => selectedIds.has(id));

            return (
              <div key={batch.batchId} className="glass-card overflow-hidden">
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-800/30 transition-colors"
                  onClick={() => setExpandedBatch(isExpanded ? null : batch.batchId)}
                >
                  <div className="flex items-center gap-3">
                    <Package className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-bold text-white">{batch.templateName || 'Manual'}</span>
                    <span className="text-xs text-slate-500">{batch.totalCount}t</span>
                    {batch.completeCount > 0 && (
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        {batch.completeCount} prontos
                      </span>
                    )}
                    {(batch.totalCount - batch.completeCount) > 0 && (
                      <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                        {batch.totalCount - batch.completeCount} pendentes
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 font-mono">{fmtTimestamp(batch.createdAt)}</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-800/50">
                    <div className="flex items-center justify-between px-4 py-2 bg-slate-800/20">
                      <button onClick={(e) => { e.stopPropagation(); toggleSelectAll(batch); }} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white">
                        {allSelected ? <CheckSquare className="w-3.5 h-3.5 text-blue-400" /> : <Square className="w-3.5 h-3.5" />}
                        {allSelected ? 'Desmarcar' : 'Selecionar todos'}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteBatch(batch); }} disabled={processing} className="flex items-center gap-1 px-2 py-1 text-xs text-red-400/60 hover:text-red-400 hover:bg-red-500/10 rounded">
                        <Trash2 className="w-3 h-3" /> Excluir batch
                      </button>
                    </div>

                    <div className="divide-y divide-slate-800/30 max-h-64 overflow-y-auto">
                      {batch.trades.map(trade => {
                        const isSelected = selectedIds.has(trade.id);
                        const isComplete = trade.isComplete;
                        return (
                          <div key={trade.id} className={`flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-800/20 ${!isComplete ? 'bg-amber-500/[0.02]' : ''}`}>
                            <button onClick={() => toggleSelect(trade.id)} className="flex-shrink-0">
                              {isSelected ? <CheckSquare className="w-4 h-4 text-blue-400" /> : <Square className="w-4 h-4 text-slate-600 hover:text-slate-400" />}
                            </button>
                            <span className="text-xs text-slate-500 font-mono w-16">{fmtTradeTime(trade.entryTime)}</span>
                            <span className="text-white font-bold w-20">{trade.ticker}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border w-14 text-center ${trade.side === 'LONG' ? 'border-emerald-500/30 text-emerald-400' : 'border-red-500/30 text-red-400'}`}>{trade.side}</span>
                            <span className={`font-mono text-xs w-24 text-right ${(trade.result ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {(trade.result ?? 0) >= 0 ? '+' : ''}{(trade.result ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                            <span className="flex-1">
                              {isComplete ? (
                                <span className="flex items-center gap-1 text-[10px] text-emerald-400/70"><CheckCircle className="w-3 h-3" /> Pronto</span>
                              ) : (
                                <span className="flex items-center gap-1 text-[10px] text-amber-400"><AlertTriangle className="w-3 h-3" /> Pendente</span>
                              )}
                            </span>
                            {isComplete && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleActivateSingle(trade); }}
                                disabled={processing}
                                className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-emerald-400 hover:bg-emerald-500/10 rounded border border-emerald-500/20 font-bold"
                                title="Ativar este trade"
                              >
                                <Play className="w-3 h-3" /> Ativar
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal completar em massa */}
      {showCompleteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Completar em Massa</h3>
              <button onClick={() => setShowCompleteModal(false)} className="p-1 hover:bg-slate-800 rounded-full text-slate-400"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-slate-400">{selectedIds.size} trade(s). Campos em branco não serão alterados.</p>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider font-bold block mb-1">Emoção Entrada</label>
                <select value={completeData.emotionEntry} onChange={(e) => setCompleteData(p => ({ ...p, emotionEntry: e.target.value }))} className="w-full bg-slate-800/80 border border-slate-700/50 rounded-lg px-3 py-2 text-white text-sm">
                  <option value="">— não alterar —</option>
                  {emotions.map(e => <option key={e.id || e.name} value={e.name}>{e.emoji} {e.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider font-bold block mb-1">Emoção Saída</label>
                <select value={completeData.emotionExit} onChange={(e) => setCompleteData(p => ({ ...p, emotionExit: e.target.value }))} className="w-full bg-slate-800/80 border border-slate-700/50 rounded-lg px-3 py-2 text-white text-sm">
                  <option value="">— não alterar —</option>
                  {emotions.map(e => <option key={e.id || e.name} value={e.name}>{e.emoji} {e.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider font-bold block mb-1">Setup</label>
                <select value={completeData.setup} onChange={(e) => setCompleteData(p => ({ ...p, setup: e.target.value }))} className="w-full bg-slate-800/80 border border-slate-700/50 rounded-lg px-3 py-2 text-white text-sm">
                  <option value="">— não alterar —</option>
                  {setups.map(s => <option key={s.id || s.name} value={s.name}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowCompleteModal(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancelar</button>
              <button onClick={handleCompleteSelected} disabled={processing || (!completeData.emotionEntry && !completeData.emotionExit && !completeData.setup)} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center gap-2 disabled:opacity-30">
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit3 className="w-4 h-4" />}
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-2 right-2 z-[51]">
        <DebugBadge component="CsvImportManager" />
      </div>
    </div>
  );
};

export default CsvImportManager;
