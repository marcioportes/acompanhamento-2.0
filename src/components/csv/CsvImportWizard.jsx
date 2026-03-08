/**
 * CsvImportWizard
 * @version 2.1.0 (v1.18.1)
 * @description Wizard de importação de CSV em 3 etapas.
 *   Etapa 1: Upload + seleção de plano + template
 *   Etapa 2: Mapeamento de colunas + valueMap + salvar template
 *   Etapa 3: Preview + validação + confirmação → grava em csvStagingTrades
 *
 * CHANGELOG:
 * - 2.1.0: canAdvance relaxado para modo inferência (side + entryTime opcionais).
 *          Carrega exchanges do Firestore internamente.
 *          Exchange default vazio (obrigatório selecionar).
 *          Passa exchanges para CsvMappingStep.
 * - 2.0.0: Grava em csvStagingTrades (staging) em vez de trades. Zero interação com useTrades/CFs.
 * - 1.0.0: Versão inicial (descartada — gravava na collection trades)
 *
 * USAGE:
 *   <CsvImportWizard
 *     plans={plans}
 *     accounts={accounts}
 *     masterTickers={tickers}
 *     addStagingBatch={addStagingBatch}  // from useCsvStaging
 *     onClose={() => {}}
 *   />
 */

import { useState, useMemo, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { X, Upload, Link2, Eye, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import useCsvTemplates from '../../hooks/useCsvTemplates';
import { parseCSV } from '../../utils/csvParser';
import { applyMapping, getMissingFields } from '../../utils/csvMapper';
import { validateBatch, getIncompleteSummary } from '../../utils/csvValidator';
import DebugBadge from '../DebugBadge';

import CsvUploadStep from './CsvUploadStep';
import CsvMappingStep from './CsvMappingStep';
import CsvPreviewStep from './CsvPreviewStep';

const STEPS = [
  { key: 'upload', label: 'Upload', icon: Upload },
  { key: 'mapping', label: 'Mapeamento', icon: Link2 },
  { key: 'preview', label: 'Preview', icon: Eye },
];

const CsvImportWizard = ({ plans = [], accounts = [], masterTickers = [], addStagingBatch, onClose }) => {
  const { templates, loading: templatesLoading, addTemplate } = useCsvTemplates();
  const [currentStep, setCurrentStep] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // === STATE: Exchanges (carregado internamente) ===
  const [exchanges, setExchanges] = useState([]);

  useEffect(() => {
    const loadExchanges = async () => {
      try {
        const q = query(collection(db, 'exchanges'), where('active', '==', true));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
        setExchanges(list);
      } catch (err) {
        console.error('[CsvImportWizard] Erro ao carregar exchanges:', err);
      }
    };
    loadExchanges();
  }, []);

  // === STATE: Etapa 1 (Upload) ===
  const [csvData, setCsvData] = useState(null);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [fileName, setFileName] = useState('');

  // === STATE: Etapa 2 (Mapeamento) ===
  const [mapping, setMapping] = useState({});
  const [valueMap, setValueMap] = useState({ side: { 'C': 'LONG', 'V': 'SHORT', 'Compra': 'LONG', 'Venda': 'SHORT' } });
  const [defaults, setDefaults] = useState({ exchange: '' });
  const [dateFormat, setDateFormat] = useState('');
  const [saveTemplate, setSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templatePlatform, setTemplatePlatform] = useState('');

  // === STATE: Etapa 3 (Preview) ===
  const mappedResult = useMemo(() => {
    if (!csvData || !mapping || Object.keys(mapping).length === 0) return null;
    return applyMapping(csvData.rows, { mapping, valueMap, defaults, dateFormat });
  }, [csvData, mapping, valueMap, defaults, dateFormat]);

  const validationResult = useMemo(() => {
    if (!mappedResult) return null;
    return validateBatch(mappedResult.trades.filter(t => !t._hasErrors));
  }, [mappedResult]);

  const incompleteSummary = useMemo(() => {
    if (!validationResult) return [];
    return getIncompleteSummary(validationResult.validTrades);
  }, [validationResult]);

  // === HANDLERS ===

  const handleFileUpload = async (file) => {
    setFileName(file.name);
    const data = await parseCSV(file);
    setCsvData(data);

    if (selectedTemplateId) {
      const tpl = templates.find(t => t.id === selectedTemplateId);
      if (tpl) applyTemplate(tpl);
    }
  };

  const applyTemplate = (tpl) => {
    if (!tpl) return;
    setMapping(tpl.mapping || {});
    setValueMap(tpl.valueMap || { side: { 'C': 'LONG', 'V': 'SHORT' } });
    setDefaults(tpl.defaults || { exchange: '' });
    setDateFormat(tpl.dateFormat || '');
  };

  const handleTemplateChange = (templateId) => {
    setSelectedTemplateId(templateId);
    if (templateId) {
      const tpl = templates.find(t => t.id === templateId);
      if (tpl) applyTemplate(tpl);
    } else {
      setMapping({});
      setValueMap({ side: { 'C': 'LONG', 'V': 'SHORT', 'Compra': 'LONG', 'Venda': 'SHORT' } });
      setDefaults({ exchange: '' });
    }
  };

  const handleNext = async () => {
    if (currentStep === 1 && saveTemplate && templateName.trim()) {
      try {
        await addTemplate({
          name: templateName.trim(),
          platform: templatePlatform.trim(),
          mapping, valueMap, defaults, dateFormat,
          delimiter: csvData?.delimiter || ';',
        });
      } catch (err) {
        console.error('Erro ao salvar template:', err);
      }
    }
    setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
  };

  const handleBack = () => setCurrentStep(prev => Math.max(prev - 1, 0));

  /**
   * IMPORT v2: grava em csvStagingTrades (staging collection).
   * Não toca em trades, movements, nem CFs.
   */
  const handleImport = async () => {
    if (!validationResult || !selectedPlanId || !addStagingBatch) return;
    setImporting(true);
    setImportResult(null);

    try {
      const tradesToStage = validationResult.validTrades.map(t => {
        const { _rowIndex, _hasErrors, _errors, _warnings, ...cleanTrade } = t;
        return {
          ...cleanTrade,
          resultOverride: cleanTrade.result ?? null,
        };
      });

      const templateNameForMeta = selectedTemplateId
        ? (templates.find(tpl => tpl.id === selectedTemplateId)?.name || 'Manual')
        : 'Manual';

      const batchId = await addStagingBatch(tradesToStage, {
        planId: selectedPlanId,
        importTemplateName: templateNameForMeta,
        importSource: 'csv',
      });

      setImportResult({ success: true, count: tradesToStage.length, batchId });
    } catch (err) {
      setImportResult({ success: false, message: err.message });
    } finally {
      setImporting(false);
    }
  };

  // === VALIDAÇÃO DE STEP ===
  /**
   * canAdvance v2: suporta modo inferência.
   * Modo padrão: ticker + side + qty + entryTime + (buyPrice/sellPrice OU entry/exit)
   * Modo inferência: ticker + qty + buyPrice + sellPrice + buyTimestamp + sellTimestamp (side/entryTime inferidos)
   * Ambos: exchange obrigatório
   */
  const canAdvance = () => {
    if (currentStep === 0) return csvData && csvData.rowCount > 0 && selectedPlanId;
    if (currentStep === 1) {
      // Exchange obrigatório
      if (!defaults.exchange) return false;

      // Ticker e qty sempre obrigatórios
      if (!mapping.ticker || !mapping.qty) return false;

      // Modo inferência: side não mapeado, mas campos de inferência sim
      const hasInference = !mapping.side &&
        mapping.buyTimestamp && mapping.sellTimestamp &&
        mapping.buyPrice && mapping.sellPrice;

      if (hasInference) return true;

      // Modo padrão: side + entryTime + (buyPrice/sellPrice OU entry/exit)
      if (!mapping.side || !mapping.entryTime) return false;
      const hasBuySell = mapping.buyPrice && mapping.sellPrice;
      const hasEntryExit = mapping.entry && mapping.exit;
      return hasBuySell || hasEntryExit;
    }
    return true;
  };

  // === RENDER ===

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-5xl h-[85vh] rounded-xl flex flex-col shadow-2xl ring-1 ring-white/10">

        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-white">Importar Trades via CSV</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {fileName || 'Selecione um arquivo CSV'}
              <span className="text-purple-400/60 ml-2">→ Staging (completar depois)</span>
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper */}
        <div className="px-5 py-3 border-b border-slate-800/50 bg-slate-800/10">
          <div className="flex items-center gap-2">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              const isActive = i === currentStep;
              const isDone = i < currentStep;
              return (
                <div key={step.key} className="flex items-center gap-2">
                  {i > 0 && <div className={`w-8 h-px ${isDone ? 'bg-emerald-500' : 'bg-slate-700'}`} />}
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    isActive ? 'bg-blue-500/20 text-blue-400 border-blue-500/40' :
                    isDone ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                    'bg-slate-800/30 text-slate-500 border-slate-700/30'
                  }`}>
                    <Icon className="w-3.5 h-3.5" />
                    {step.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5">
          {currentStep === 0 && (
            <CsvUploadStep
              csvData={csvData}
              plans={plans}
              accounts={accounts}
              templates={templates}
              templatesLoading={templatesLoading}
              selectedPlanId={selectedPlanId}
              selectedTemplateId={selectedTemplateId}
              onFileUpload={handleFileUpload}
              onPlanChange={setSelectedPlanId}
              onTemplateChange={handleTemplateChange}
            />
          )}
          {currentStep === 1 && csvData && (
            <CsvMappingStep
              headers={csvData.headers}
              sampleRow={csvData.rows[0] || {}}
              mapping={mapping}
              valueMap={valueMap}
              defaults={defaults}
              dateFormat={dateFormat}
              exchanges={exchanges}
              onMappingChange={setMapping}
              onValueMapChange={setValueMap}
              onDefaultsChange={setDefaults}
              onDateFormatChange={setDateFormat}
              saveTemplate={saveTemplate}
              templateName={templateName}
              templatePlatform={templatePlatform}
              onSaveTemplateChange={setSaveTemplate}
              onTemplateNameChange={setTemplateName}
              onTemplatePlatformChange={setTemplatePlatform}
            />
          )}
          {currentStep === 2 && mappedResult && validationResult && (
            <CsvPreviewStep
              mappedResult={mappedResult}
              validationResult={validationResult}
              incompleteSummary={incompleteSummary}
              importResult={importResult}
              masterTickers={masterTickers}
              selectedExchange={defaults.exchange}
            />
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50 backdrop-blur flex justify-between items-center rounded-b-xl">
          {currentStep > 0 && !importResult?.success ? (
            <button onClick={handleBack} className="px-4 py-2 text-slate-400 hover:text-white flex items-center gap-2 text-sm font-medium">
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
          ) : <div />}

          {currentStep < STEPS.length - 1 ? (
            <button
              onClick={handleNext}
              disabled={!canAdvance()}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-lg flex items-center gap-2 text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Próximo <ArrowRight className="w-4 h-4" />
            </button>
          ) : importResult?.success ? (
            <button onClick={onClose} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-lg text-sm font-bold">
              Fechar
            </button>
          ) : (
            <button
              onClick={handleImport}
              disabled={importing || !validationResult?.validTrades?.length}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg shadow-lg flex items-center gap-2 text-sm font-bold disabled:opacity-30"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {importing ? 'Gravando...' : `Enviar ${validationResult?.stats?.valid || 0} para staging`}
            </button>
          )}
        </div>

      </div>
      <div className="fixed bottom-2 right-2 z-[51]">
        <DebugBadge component="CsvImportWizard" />
      </div>
    </div>
  );
};

export default CsvImportWizard;
