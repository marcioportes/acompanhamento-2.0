/**
 * CsvUploadStep
 * @version 1.0.0 (v1.18.0)
 * @description Etapa 1 do wizard: upload CSV, seleção de plano e template.
 */

import { useRef, useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Target, Database, Info, ChevronDown, ChevronUp } from 'lucide-react';

const CsvUploadStep = ({
  csvData,
  plans,
  accounts,
  templates,
  templatesLoading,
  selectedPlanId,
  selectedTemplateId,
  onFileUpload,
  onPlanChange,
  onTemplateChange,
}) => {
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [showTips, setShowTips] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv') && !file.type.includes('csv') && !file.type.includes('text')) {
      setParseError('Arquivo deve ser .csv');
      return;
    }
    setParseError(null);
    try {
      await onFileUpload(file);
    } catch (err) {
      setParseError(err.message);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const activePlans = plans.filter(p => p.active !== false);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Seleção de Plano */}
      <div>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
          <Target className="w-3.5 h-3.5" /> Plano de destino *
        </label>
        <select
          value={selectedPlanId}
          onChange={(e) => onPlanChange(e.target.value)}
          className="w-full bg-slate-800/80 border border-slate-700/50 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
        >
          <option value="">Selecione o plano...</option>
          {activePlans.map(p => {
            const acc = accounts.find(a => a.id === p.accountId);
            return (
              <option key={p.id} value={p.id}>
                {p.name} — {acc?.name || 'Conta não encontrada'} ({acc?.currency || 'BRL'})
              </option>
            );
          })}
        </select>
      </div>

      {/* Template de mapeamento */}
      <div>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
          <Database className="w-3.5 h-3.5" /> Template de mapeamento
        </label>
        <select
          value={selectedTemplateId}
          onChange={(e) => onTemplateChange(e.target.value)}
          disabled={templatesLoading}
          className="w-full bg-slate-800/80 border border-slate-700/50 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
        >
          <option value="">Novo mapeamento (manual)</option>
          {templates.map(t => (
            <option key={t.id} value={t.id}>
              {t.name} {t.platform ? `(${t.platform})` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Dicas sobre o formato do CSV */}
      <div className="rounded-xl border border-slate-700/30 bg-slate-800/20 overflow-hidden">
        <button
          onClick={() => setShowTips(!showTips)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-800/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-slate-300">Como deve ser o arquivo CSV?</span>
          </div>
          {showTips ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </button>
        {showTips && (
          <div className="px-4 pb-4 space-y-3 text-xs text-slate-400 border-t border-slate-700/20 pt-3">
            <div>
              <p className="font-bold text-slate-300 mb-1">Formato esperado:</p>
              <p>A primeira linha deve conter os nomes das colunas (cabeçalho). Cada linha seguinte é um trade.</p>
            </div>
            <div>
              <p className="font-bold text-slate-300 mb-1">Colunas mínimas obrigatórias:</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {['Ativo/Ticker', 'Lado (Compra/Venda)', 'Preço Compra', 'Preço Venda', 'Quantidade', 'Data/Hora Abertura'].map(c => (
                  <span key={c} className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 font-mono">{c}</span>
                ))}
              </div>
              <p className="text-slate-500 mt-1.5">O sistema resolve automaticamente o preço de entrada e saída baseado no Lado (C=Compra/V=Venda).</p>
            </div>
            <div>
              <p className="font-bold text-slate-300 mb-1">Colunas opcionais:</p>
              <p>Data/Hora Saída, Resultado (R$), Stop Loss, Exchange, Setup</p>
            </div>
            <div>
              <p className="font-bold text-slate-300 mb-1">Separador:</p>
              <p>O sistema detecta automaticamente: ponto-e-vírgula (;), vírgula (,) ou tab.</p>
            </div>
            <div>
              <p className="font-bold text-slate-300 mb-1">Exemplo (separador ;):</p>
              <div className="bg-slate-900/80 rounded-lg p-2.5 font-mono text-[10px] text-slate-300 overflow-x-auto border border-slate-700/30">
                <p className="text-blue-400">Ativo;Lado;Preço Compra;Preço Venda;Qtde;Abertura;Resultado</p>
                <p>WINFUT;C;128.500;128.600;1;03/03/2026 10:30;200,00</p>
                <p>WINFUT;V;128.700;128.600;2;03/03/2026 11:15;400,00</p>
              </div>
            </div>
            <div>
              <p className="font-bold text-slate-300 mb-1">Datas:</p>
              <p>Formato brasileiro DD/MM/AAAA ou DD/MM/AAAA HH:mm. O sistema também aceita AAAA-MM-DD (ISO).</p>
            </div>
            <div>
              <p className="font-bold text-slate-300 mb-1">Valores numéricos:</p>
              <p>Aceita formato brasileiro (1.234,56) e internacional (1234.56). Na próxima etapa você mapeia cada coluna.</p>
            </div>
          </div>
        )}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
          dragOver
            ? 'border-blue-500 bg-blue-500/10'
            : csvData
              ? 'border-emerald-500/40 bg-emerald-500/5'
              : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/30'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          onChange={(e) => handleFile(e.target.files[0])}
          className="hidden"
        />
        {csvData ? (
          <div className="space-y-2">
            <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto" />
            <p className="text-emerald-400 font-bold">CSV carregado</p>
            <div className="flex items-center justify-center gap-4 text-sm text-slate-400">
              <span>{csvData.rowCount} linhas</span>
              <span className="text-slate-600">·</span>
              <span>{csvData.headers.length} colunas</span>
              <span className="text-slate-600">·</span>
              <span>sep: "{csvData.delimiter}"</span>
              {csvData.skippedLines > 0 && (
                <>
                  <span className="text-slate-600">·</span>
                  <span className="text-amber-400">{csvData.skippedLines} linhas ignoradas</span>
                </>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Colunas: {csvData.headers.slice(0, 6).join(', ')}{csvData.headers.length > 6 ? `, +${csvData.headers.length - 6}` : ''}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="w-10 h-10 text-slate-500 mx-auto" />
            <p className="text-slate-400 font-medium">Arraste o arquivo CSV aqui</p>
            <p className="text-xs text-slate-500">ou clique para selecionar</p>
          </div>
        )}
      </div>

      {/* Warnings do pipeline de validação (pré-header, BOM, etc) */}
      {csvData?.warnings?.length > 0 && (
        <div className="px-4 py-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm text-blue-400">
          <p className="font-bold mb-1">Observações:</p>
          {csvData.warnings.map((w, i) => (
            <p key={i} className="text-xs text-blue-300/70">• {w}</p>
          ))}
        </div>
      )}

      {/* Erros de parse */}
      {parseError && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {parseError}
        </div>
      )}

      {/* Erros do Papaparse */}
      {csvData?.errors?.length > 0 && (
        <div className="px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400">
          <p className="font-bold mb-1">{csvData.errors.length} aviso(s) no parse:</p>
          {csvData.errors.slice(0, 3).map((e, i) => (
            <p key={i} className="text-xs text-amber-300/70">Linha {e.row}: {e.message}</p>
          ))}
          {csvData.errors.length > 3 && <p className="text-xs text-amber-300/50">+{csvData.errors.length - 3} mais...</p>}
        </div>
      )}
    </div>
  );
};

export default CsvUploadStep;
