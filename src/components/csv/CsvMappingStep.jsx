/**
 * CsvMappingStep
 * @version 1.0.0 (v1.18.0)
 * @description Etapa 2: associa colunas CSV → campos do sistema.
 *   Mostra amostra da primeira linha para referência.
 *   Permite configurar valueMap (C→LONG, V→SHORT).
 *   Opção de salvar como template.
 */

import { SYSTEM_FIELDS } from '../../utils/csvMapper';
import { Link2, Save, Eye } from 'lucide-react';

const CsvMappingStep = ({
  headers,
  sampleRow,
  mapping,
  valueMap,
  defaults,
  dateFormat,
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

  // Valores únicos da coluna side para valueMap
  const sideColumn = mapping.side;
  const sideValues = sideColumn
    ? [...new Set(headers.includes(sideColumn) ? [sampleRow[sideColumn]] : [])]
    : [];

  return (
    <div className="space-y-6">
      {/* Grid de mapeamento */}
      <div>
        <h3 className="flex items-center gap-2 text-sm font-bold text-white mb-4">
          <Link2 className="w-4 h-4 text-blue-400" /> Mapeamento de Campos
        </h3>
        <div className="space-y-2">
          {SYSTEM_FIELDS.map(field => {
            const currentMapping = mapping[field.key] || '';
            const sampleValue = currentMapping ? sampleRow[currentMapping] : null;

            return (
              <div key={field.key} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 transition-colors">
                {/* Campo do sistema */}
                <div className="w-44 flex-shrink-0">
                  <span className="text-sm text-white font-medium">{field.label}</span>
                  {field.required && <span className="text-red-400 ml-1">*</span>}
                </div>

                {/* Seta */}
                <span className="text-slate-600">←</span>

                {/* Dropdown coluna CSV */}
                <select
                  value={currentMapping}
                  onChange={(e) => handleFieldMapping(field.key, e.target.value)}
                  className={`flex-1 bg-slate-800/80 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 appearance-none cursor-pointer ${
                    currentMapping
                      ? 'border-blue-500/40 text-blue-400'
                      : field.required
                        ? 'border-amber-500/30 text-slate-400'
                        : 'border-slate-700/50 text-slate-500'
                  }`}
                >
                  <option value="">{field.required ? '— selecionar —' : '— não mapear —'}</option>
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
                  ) : (
                    <span className="text-xs text-slate-600">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ValueMap para Side */}
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

      {/* Default para Exchange */}
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800/20">
        <span className="text-sm text-slate-400 w-44">Exchange (default):</span>
        <input
          type="text"
          value={defaults.exchange || ''}
          onChange={(e) => handleDefaultChange('exchange', e.target.value)}
          placeholder="B3"
          className="bg-slate-800/80 border border-slate-700/50 rounded-lg px-3 py-1.5 text-sm text-white w-32 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Formato de data */}
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800/20">
        <span className="text-sm text-slate-400 w-44">Formato de data:</span>
        <select
          value={dateFormat}
          onChange={(e) => onDateFormatChange(e.target.value)}
          className="bg-slate-800/80 border border-slate-700/50 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
        >
          <option value="">Auto-detect (DD/MM/YYYY)</option>
          <option value="DD/MM/YYYY">DD/MM/YYYY (Brasileiro)</option>
          <option value="MM/DD/YYYY">MM/DD/YYYY (Americano)</option>
          <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
        </select>
      </div>

      {/* Salvar como template */}
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
