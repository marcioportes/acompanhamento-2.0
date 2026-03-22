/**
 * OrderUploader.jsx
 * @version 2.0.0 (v1.20.0)
 * @description Upload de CSV de ordens com leitura raw text.
 *   ProfitChart-Pro tem estrutura hierárquica que precisa de parser próprio,
 *   então lemos o arquivo como texto e passamos para OrderImportPage decidir.
 *   Encoding: tenta UTF-8, fallback Latin-1 (padrão ProfitChart-Pro).
 */

import { useState, useRef } from 'react';
import { Upload, FileText, AlertTriangle } from 'lucide-react';

const OrderUploader = ({ onParsed, disabled = false }) => {
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  const fileInputRef = useRef(null);

  const readFileAsText = (file, encoding) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error(`Erro ao ler arquivo com encoding ${encoding}`));
      reader.readAsText(file, encoding);
    });
  };

  const handleFile = async (file) => {
    if (!file) return;
    setParseError(null);
    setParsing(true);
    setFileInfo({ name: file.name, size: file.size });

    try {
      // Try UTF-8 first, fallback to Latin-1 (ProfitChart-Pro default)
      let text;
      try {
        text = await readFileAsText(file, 'UTF-8');
        // Check for garbled chars (common with Latin-1 files read as UTF-8)
        if (text.includes('\ufffd') || text.includes('Ã')) {
          text = await readFileAsText(file, 'ISO-8859-1');
        }
      } catch {
        text = await readFileAsText(file, 'ISO-8859-1');
      }

      // Strip BOM if present
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

      if (!text.trim()) {
        setParseError('Arquivo vazio.');
        return;
      }

      onParsed({ text, fileName: file.name, fileSize: file.size });
    } catch (err) {
      setParseError(err.message);
    } finally {
      setParsing(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  };

  const handleInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
          ${dragOver ? 'border-blue-400 bg-blue-500/10' : 'border-slate-700 hover:border-slate-500 bg-slate-800/30'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
        />

        {parsing ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-slate-400">Analisando arquivo...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload className="w-10 h-10 text-slate-500" />
            <div>
              <p className="text-sm font-medium text-slate-300">
                Arraste o CSV de ordens ou clique para selecionar
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Formatos: ProfitChart-Pro ou genérico (CSV)
              </p>
            </div>
          </div>
        )}
      </div>

      {fileInfo && !parsing && !parseError && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <FileText className="w-3.5 h-3.5" />
          <span>{fileInfo.name}</span>
          <span className="text-slate-600">({(fileInfo.size / 1024).toFixed(1)} KB)</span>
        </div>
      )}

      {parseError && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
          <span className="text-xs text-red-300">{parseError}</span>
        </div>
      )}
    </div>
  );
};

export default OrderUploader;
