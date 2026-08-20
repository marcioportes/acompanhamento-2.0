/**
 * OrderStagingManager
 * @version 1.0.0 (v1.83.15 — issue #366)
 * @description Lotes de ordens em rascunho: retomar de onde parou ou descartar.
 *
 * O import de ordens é multi-etapa e o aluno pode sair no meio. Até o #366 sair no
 * meio significava deixar o lote preso no staging para sempre — sem tela, sem aviso,
 * sem caminho de limpeza. Aqui ele vê o que ficou e decide.
 *
 * Padrão espelhado de `csv/CsvImportManager` (CHUNK-07), inclusive o cuidado com o
 * `confirm` do useConfirmDialog: é Promise e recebe objeto — `await confirm({...})`.
 */

import { useState } from 'react';
import { X, FileClock, RotateCcw, Trash2, Loader2 } from 'lucide-react';
import DebugBadge from '../DebugBadge';
import { useConfirmDialog } from '../ConfirmDialog';

const formatarData = (createdAt) => {
  const ms = createdAt?.seconds ? createdAt.seconds * 1000 : null;
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('pt-BR');
};

const OrderStagingManager = ({ isOpen, batches = [], onClose, onResume, onDelete }) => {
  const { confirm, dialog } = useConfirmDialog();
  const [working, setWorking] = useState(null);

  if (!isOpen) return null;

  const handleDelete = async (batch) => {
    const ok = await confirm({
      title: 'Descartar este rascunho?',
      body: `As ${batch.totalCount} ordens de ${batch.fileName || 'arquivo sem nome'} serão removidas. `
        + 'Nada foi importado ainda — o arquivo continua no seu computador.',
      confirmLabel: 'Descartar',
      cancelLabel: 'Manter',
      tone: 'danger',
    });
    if (!ok) return;

    setWorking(batch.batchId);
    try {
      await onDelete(batch.batchId);
    } finally {
      setWorking(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/50 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <FileClock className="w-4 h-4 text-amber-400" />
              Importações não finalizadas
            </h2>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Nenhuma ordem daqui foi gravada. Retome de onde parou ou descarte.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 pb-20">
          {batches.length === 0 && (
            <p className="text-xs text-slate-500">Nenhum rascunho pendente.</p>
          )}

          {batches.map((batch) => (
            <div
              key={batch.batchId}
              className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-700/50 bg-slate-800/40"
            >
              <div className="min-w-0">
                <p className="text-xs text-white font-medium truncate">
                  {batch.fileName || 'Arquivo sem nome'}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {batch.totalCount} {batch.totalCount === 1 ? 'ordem' : 'ordens'}
                  {' · '}{formatarData(batch.createdAt)}
                  {batch.importTimezone ? ` · ${batch.importTimezone}` : ' · fuso não registrado'}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onResume(batch)}
                  disabled={working === batch.batchId}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg transition-colors disabled:opacity-40"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Retomar
                </button>
                <button
                  onClick={() => handleDelete(batch)}
                  disabled={working === batch.batchId}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg transition-colors disabled:opacity-40"
                >
                  {working === batch.batchId
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Trash2 className="w-3.5 h-3.5" />}
                  Descartar
                </button>
              </div>
            </div>
          ))}
        </div>

        {dialog}
        <DebugBadge component="OrderStagingManager" />
      </div>
    </div>
  );
};

export default OrderStagingManager;
