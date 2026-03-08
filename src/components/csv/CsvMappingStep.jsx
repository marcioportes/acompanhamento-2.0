/**
 * CsvMappingStep
 * @version 1.1.0 (v1.18.1)
 * @description Etapa 2: associa colunas CSV → campos do sistema.
 *   Layout redesenhado:
 *   1. Configurações críticas (Exchange obrigatório, formato data) — TOPO
 *   2. Badges de campos obrigatórios faltantes — TOPO (inline)
 *   3. Grid de mapeamento — MEIO
 *   4. ValueMap side (condicional) — ABAIXO
 *   5. Salvar template — FUNDO
 *
 * CHANGELOG:
 * - 1.1.0: Redesign layout. Exchange dropdown carregado de collection.
 *          Badges inline para campos obrigatórios faltantes.
 *          Suporte a modo inferência (side + entryTime opcionais).
 *          Hint visual quando inferência disponível.
 * - 1.0.0: Versão inicial
 */

import { useMemo } from 'react';
import { SYSTEM_FIELDS } from '../../utils/csvMapper';
import { Link2, Save, AlertTriangle, Zap, Globe, Calendar } from 'lucide-react';

const CsvMappingStep = ({
  headers,
  sampleRow,
  mapping,
  valueMap,
  defaults,
  dateFormat,
  exchanges = [],
  onMappingChange,
  onValueMapChange,
  onDefaultsChange,
  onDateFormatChange,
  saveTemplate,
  templateName,
  templatePlatform,
  onSaveTemplateChange,
  onTemplateNameChange,
  onTemplatePlatformChange,
}) => {

  const handleFieldMapping = (fieldKey, csvColumn) => {
    const newMapping = { ...mapping };
    if (csvColumn === '') {
      delete newMapping[fieldKey];
    } else {
      newMapping[fieldKey] = csvColumn;
    }
    onMappingChange(newMapping);
  };

  const handleSideValueMap = (csvValue, systemValue) => {
    const newMap = { ...valueMap };
    if (!newMap.side) newMap.side = {};
    newMap.side[csvValue] = systemValue;
    onValueMapChange(newMap);
  };

  const handleDefaultChange = (fieldKey, value) => {
    onDefaultsChange({ ...defaults, [fieldKey]: value || null });
  };

  // Detectar modo inferência ativo
  const inferenceAvailable = useMemo(() => {
    return !!mapping.buyTimestamp && !!mapping.sellTimestamp && !!mapping.buyPrice && !!mapping.sellPrice;
  }, [mapping]);

  const sideIsMapped = !!mapping.side;

  // Campos obrigatórios faltantes (ajustado para inferência)
  const missingRequired = useMemo(() => {
    const missing = [];
    if (!mapping.ticker) missing.push('ticker');
    if (!mapping.qty) missing.push('qty');

    if (inferenceAvailable && !sideIsMapped) {
      // Modo inferência: side e entryTime vêm de buyTimestamp/sellTimestamp
    } else {
      if (!mapping.side) missing.push('side');
      if (!mapping.entryTime) missing.push('entryTime');
    }

    // Preço: precisa de (buyPrice + sellPrice) OU (entry + exit)
    const hasBuySell = mapping.buyPrice && mapping.sellPrice;
    const hasEntryExit = mapping.entry && mapping.exit;
    if (!hasBuySell && !hasEntryExit) missing.push('preço (Compra/Venda ou Entrada/Saída)');

    return missing;
  }, [mapping, inferenceAvailable, sideIsMapped]);

  // Valores únicos da coluna side para valueMap
  const sideColumn = mapping.side;
  const sideValues = sideColumn
    ? [...new Set(headers.includes(sideColumn) ? [sampleRow[sideColumn]] : [])]
    : [];

  return (
    <div className="space-y-5">

      {/* ====================================== */}
      {/* SEÇÃO 1: CONFIGURAÇÕES CRÍTICAS (TOPO) */}
      {/* ====================================== */}
      <div className="grid grid-cols-2 gap-4">
        {/* Exchange — obrigatório, vazio por default */}
        <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/30">
          <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            <Globe className="w-3 h-3" /> Bolsa / Exchange *
          </label>
          <select
            value={defaults.exchange || ''}
            onChange={(e) => handleDefaultChange('exchange', e.target.value)}
            className={`w-full bg-slate-800/80 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 appearance-none cursor-pointer ${
              defaults.exchange
                ? 'border-blue-500/40 text-white'
                : 'border-amber-500/40 text-slate-400'
            }`}
          >
            <option value="">— selecionar bolsa —</option>
            {exchanges.map(ex => (
              <option key={ex.id} value={ex.code}>{ex.code} — {ex.name}</option>
            ))}
          </select>
          {!defaults.exchange && (
            <p className="text-[10px] text-amber-400/70 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Obrigatório para validar tickers
            </p>
          )}
        </div>

        {/* Formato de data */}
        <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/30">
          <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            <Calendar className="w-3 h-3" /> Formato de Data
          </label>
          <select
            value={dateFormat}
            onChange={(e) => onDateFormatChange(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
          >
            <option value="">Auto-detect (DD/MM/YYYY)</option>
            <option value="DD/MM/YYYY">DD/MM/YYYY (Brasileiro)</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY (Americano)</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
          </select>
        </div>
      </div>

      {/* ====================================== */}
      {/* SEÇÃO 2: STATUS / BADGES              */}
      {/* ====================================== */}
      {missingRequired.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span className="text-xs text-amber-300">
            Campos obrigatórios faltantes: {missingRequired.join(', ')}
          </span>
        </div>
      )}

      {inferenceAvailable && !sideIsMapped && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
          <Zap className="w-4 h-4 text-purple-400 flex-shrink-0" />
          <span className="text-xs text-purple-300">
            Inferência automática ativa — Lado e Data/Hora serão calculados a partir dos timestamps de compra/venda
          </span>
        </div>
      )}

      {/* ====================================== */}
      {/* SEÇÃO 3: GRID DE MAPEAMENTO           */}
      {/* ====================================== */}
      <div>
        <h3 className="flex items-center gap-2 text-sm font-bold text-white mb-3">
          <Link2 className="w-4 h-4 text-blue-400" /> Mapeamento de Campos
        </h3>
        <div className="space-y-1.5">
          {SYSTEM_FIELDS.map(field => {
            const currentMapping = mapping[field.key] || '';
            const sampleValue = currentMapping ? sampleRow[currentMapping] : null;

            // Determinar se o campo é efetivamente required no contexto atual
            const isEffectivelyRequired = (() => {
              if (field.key === 'ticker' || field.key === 'qty') return true;
              if (field.key === 'side' || field.key === 'entryTime') {
                return !(inferenceAvailable && !sideIsMapped);
              }
              if (field.key === 'buyPrice' || field.key === 'sellPrice') {
                return !mapping.entry && !mapping.exit;
              }
              if (field.key === 'entry' || field.key === 'exit') {
                return !mapping.buyPrice && !mapping.sellPrice;
              }
              return false;
            })();

            // Se no modo inferência, os campos de inferência ganham destaque
            const isInferenceField = field.group === 'inference';
            const isInferredField = inferenceAvailable && !sideIsMapped &&
              (field.key === 'side' || field.key === 'entryTime' || field.key === 'exitTime');

            return (
              <div
                key={field.key}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isInferredField
                    ? 'bg-purple-500/5 border border-purple-500/10'
                    : isInferenceField && currentMapping
                      ? 'bg-purple-500/5 border border-purple-500/10'
                      : 'bg-slate-800/30 hover:bg-slate-800/50'
                }`}
              >
                {/* Campo do sistema */}
                <div className="w-48 flex-shrink-0">
                  <span className={`text-sm font-medium ${isInferredField ? 'text-purple-300' : 'text-white'}`}>
                    {field.label}
                  </span>
                  {isEffectivelyRequired && !isInferredField && (
                    <span className="text-red-400 ml-1">*</span>
                  )}
                  {isInferredField && (
                    <span className="text-[10px] text-purple-400/70 ml-1.5">(inferido)</span>
                  )}
                  {/* Badge triângulo se required e não mapeado */}
                  {isEffectivelyRequired && !currentMapping && !isInferredField && (
                    <AlertTriangle className="w-3 h-3 text-amber-400 inline ml-1.5" />
                  )}
                </div>

                {/* Seta */}
                <span className="text-slate-600">←</span>

                {/* Dropdown coluna CSV */}
                <select
                  value={currentMapping}
                  onChange={(e) => handleFieldMapping(field.key, e.target.value)}
                  disabled={isInferredField}
                  className={`flex-1 bg-slate-800/80 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 appearance-none ${
                    isInferredField
                      ? 'border-purple-500/20 text-purple-400/50 cursor-not-allowed'
                      : currentMapping
                        ? 'border-blue-500/40 text-blue-400 cursor-pointer'
                        : isEffectivelyRequired
                          ? 'border-amber-500/30 text-slate-400 cursor-pointer'
                          : 'border-slate-700/50 text-slate-500 cursor-pointer'
                  }`}
                >
                  <option value="">
                    {isInferredField
                      ? '— calculado automaticamente —'
                      : isEffectivelyRequired
                        ? '— selecionar —'
                        : '— não mapear —'
                    }
                  </option>
                  {headers.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>

                {/* Amostra */}
                <div className="w-36 flex-shrink-0 text-right">
                  {sampleValue != null ? (
                    <span className="text-xs font-mono text-slate-400 bg-slate-800/50 px-2 py-0.5 rounded truncate block" title={sampleValue}>
                      {String(sampleValue).slice(0, 20)}
                    </span>
                  ) : isInferredField ? (
                    <span className="text-xs text-purple-400/50 italic">auto</span>
                  ) : (
                    <span className="text-xs text-slate-600">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ====================================== */}
      {/* SEÇÃO 4: VALUEMAP PARA SIDE            */}
      {/* ====================================== */}
      {mapping.side && (
        <div className="p-4 rounded-lg bg-slate-800/30 border border-slate-700/30">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Mapeamento de valores: {mapping.side}
          </h4>
          <div className="grid grid-cols-2 gap-3 max-w-md">
            {Object.entries(valueMap.side || {}).map(([csvVal, sysVal]) => (
              <div key={csvVal} className="flex items-center gap-2 text-sm">
                <span className="text-slate-400 font-mono bg-slate-800/50 px-2 py-0.5 rounded">{csvVal}</span>
                <span className="text-slate-600">→</span>
                <span className={`font-bold ${sysVal === 'LONG' ? 'text-emerald-400' : 'text-red-400'}`}>{sysVal}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              placeholder="Valor CSV (ex: Buy)"
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white w-28"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target.value) {
                  handleSideValueMap(e.target.value, 'LONG');
                  e.target.value = '';
                }
              }}
            />
            <span className="text-[10px] text-slate-500 self-center">Enter para adicionar (default: LONG)</span>
          </div>
        </div>
      )}

      {/* ====================================== */}
      {/* SEÇÃO 5: SALVAR COMO TEMPLATE          */}
      {/* ====================================== */}
      <div className="p-4 rounded-lg border border-dashed border-slate-700/50 bg-slate-800/10">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={saveTemplate}
            onChange={(e) => onSaveTemplateChange(e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-0"
          />
          <Save className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-sm text-slate-300">Salvar como template para reuso</span>
        </label>
        {saveTemplate && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider font-bold block mb-1">Nome do template *</label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => onTemplateNameChange(e.target.value)}
                placeholder="Clear Corretora — Day Trade"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider font-bold block mb-1">Plataforma / Corretora</label>
              <input
                type="text"
                value={templatePlatform}
                onChange={(e) => onTemplatePlatformChange(e.target.value)}
                placeholder="Clear, ProfitChart, Tryd..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CsvMappingStep;
