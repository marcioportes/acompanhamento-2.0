import React, { useState } from 'react';
import DebugBadge from '../DebugBadge';

const SEVERITY_STYLES = {
  HIGH: 'bg-red-500/20 text-red-300 border-red-500/30',
  MEDIUM: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  LOW: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  NONE: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
};

const SEVERITY_LABELS = {
  HIGH: 'Alta',
  MEDIUM: 'Média',
  LOW: 'Baixa',
  NONE: 'Positivo'
};

const EMOTION_LABELS = {
  FEAR: 'Medo',
  REVENGE: 'Vingança',
  GREED: 'Ganância',
  ANXIETY: 'Ansiedade',
  IMPULSIVITY: 'Impulsividade',
  DISCIPLINE: 'Disciplina',
  PATIENCE: 'Paciência',
  PANIC: 'Pânico',
  FOMO: 'FOMO',
  HOPE: 'Esperança',
  DENIAL: 'Negação',
  CONFUSION: 'Confusão / Viés',
  AVOIDANCE: 'Evitação do plano'
};

const PATTERN_LABELS = {
  HOLD_ASYMMETRY: 'Assimetria de tempo',
  REVENGE_CLUSTER: 'Cluster de vingança',
  GREED_CLUSTER: 'Cluster de ganância',
  OVERTRADING: 'Overtrading',
  IMPULSE_CLUSTER: 'Cluster impulsivo',
  CLEAN_EXECUTION: 'Execução limpa',
  TARGET_HIT: 'Alvo atingido',
  DIRECTION_FLIP: 'Virada de mão',
  UNDERSIZED_TRADE: 'Operação subdimensionada',
  HESITATION: 'Hesitação',
  STOP_PANIC: 'Pânico no stop',
  FOMO_ENTRY: 'Entrada por FOMO',
  EARLY_EXIT: 'Saída antecipada',
  LATE_EXIT: 'Saída tardia',
  AVERAGING_DOWN: 'Preço médio'
};

const PATTERN_DESCRIPTIONS = {
  HOLD_ASYMMETRY: 'Trade perdedor mantido muito mais tempo que a média dos ganhadores.',
  REVENGE_CLUSTER: 'Sequência de trades rápidos após uma perda — tentativa de recuperar.',
  GREED_CLUSTER: 'Sequência de trades rápidos após ganhos — excesso de confiança.',
  OVERTRADING: 'Número de trades acima do limite na janela temporal.',
  IMPULSE_CLUSTER: 'Trades executados em sequência muito rápida, sem análise.',
  CLEAN_EXECUTION: 'Trade com stop presente, RR respeitado e sem padrões negativos.',
  TARGET_HIT: 'Saída no alvo planejado — paciência na execução.',
  DIRECTION_FLIP: 'Virou a mão no mesmo instrumento após loss — viés/narrativa quebrada.',
  UNDERSIZED_TRADE: 'Risco real muito abaixo do RO planejado — se há medo do plano, ajuste o plano (não a operação).',
  HESITATION: 'Múltiplas ordens canceladas antes de entrar — indecisão.',
  STOP_PANIC: 'Stop alargado seguido de saída manual rápida.',
  FOMO_ENTRY: 'Entrada tardia com ordem a mercado após hesitação.',
  EARLY_EXIT: 'Saída com lucro muito abaixo do alvo planejado.',
  LATE_EXIT: 'Saída atrasada após remoção do stop — segurou a perda.',
  AVERAGING_DOWN: 'Adição na mesma direção com preço piorando.'
};

const RESOLUTION_LABELS = {
  HIGH: 'Alta (ordens brutas)',
  MEDIUM: 'Média (parciais enriquecidas)',
  LOW: 'Baixa (parciais + contexto)'
};

const RESOLUTION_STYLES = {
  HIGH: 'text-emerald-400',
  MEDIUM: 'text-amber-400',
  LOW: 'text-zinc-400'
};

const PatternCard = ({ pattern }) => {
  const [expanded, setExpanded] = useState(false);
  const isPositive = pattern.code === 'CLEAN_EXECUTION' || pattern.code === 'TARGET_HIT';

  return (
    <div
      className={`border rounded-lg p-3 cursor-pointer transition-colors hover:bg-white/5 ${
        SEVERITY_STYLES[pattern.severity] ?? SEVERITY_STYLES.LOW
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {isPositive ? '✦' : '⚠'} {PATTERN_LABELS[pattern.code] ?? pattern.code}
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded border ${SEVERITY_STYLES[pattern.severity]}`}>
            {SEVERITY_LABELS[pattern.severity] ?? pattern.severity}
          </span>
          {pattern.layer === 2 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
              Ordens
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span>{EMOTION_LABELS[pattern.emotionMapping] ?? pattern.emotionMapping}</span>
          <span>{Math.round(pattern.confidence * 100)}%</span>
          <span className="text-zinc-500">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      <p className="text-xs text-zinc-400 mt-1">
        {PATTERN_DESCRIPTIONS[pattern.code] ?? ''}
      </p>

      {expanded && pattern.evidence && (
        <div className="mt-2 pt-2 border-t border-white/10">
          <div className="grid grid-cols-2 gap-1">
            {Object.entries(pattern.evidence).map(([key, value]) => (
              <div key={key} className="text-xs">
                <span className="text-zinc-500">{key}: </span>
                <span className="text-zinc-300">
                  {Array.isArray(value) ? value.length + ' items' : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const ShadowBehaviorPanel = ({ trade, isMentor = false, embedded = false }) => {
  if (!isMentor) return null;

  const shadow = trade?.shadowBehavior;
  if (!shadow || !shadow.patterns) return null;

  const negativePatterns = shadow.patterns.filter(p =>
    p.code !== 'CLEAN_EXECUTION' && p.code !== 'TARGET_HIT'
  );
  const positivePatterns = shadow.patterns.filter(p =>
    p.code === 'CLEAN_EXECUTION' || p.code === 'TARGET_HIT'
  );

  return (
    <div className="mt-4">
      {!embedded && <DebugBadge component="ShadowBehaviorPanel" />}

      <div className="bg-zinc-800/50 backdrop-blur-sm rounded-xl border border-white/10 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-zinc-200">
            Shadow Behavior
          </h3>
          <div className="flex items-center gap-2">
            <span className={`text-xs ${RESOLUTION_STYLES[shadow.resolution] ?? 'text-zinc-400'}`}>
              {RESOLUTION_LABELS[shadow.resolution] ?? shadow.resolution}
            </span>
            <span className="text-xs text-zinc-500">
              v{shadow.version}
            </span>
          </div>
        </div>

        {shadow.patterns.length === 0 ? (
          <p className="text-xs text-zinc-500">Nenhum padrão detectado.</p>
        ) : (
          <div className="space-y-2">
            {negativePatterns.length > 0 && (
              <div className="space-y-2">
                {negativePatterns.map((p, i) => (
                  <PatternCard key={`neg-${i}`} pattern={p} />
                ))}
              </div>
            )}
            {positivePatterns.length > 0 && (
              <div className="space-y-2">
                {positivePatterns.map((p, i) => (
                  <PatternCard key={`pos-${i}`} pattern={p} />
                ))}
              </div>
            )}
          </div>
        )}

        {shadow.marketContext && (
          <div className="mt-3 pt-2 border-t border-white/10 flex gap-4 text-xs text-zinc-500">
            {shadow.marketContext.instrument && (
              <span>Instrumento: <span className="text-zinc-400">{shadow.marketContext.instrument}</span></span>
            )}
            {shadow.marketContext.session && (
              <span>Sessão: <span className="text-zinc-400">{shadow.marketContext.session}</span></span>
            )}
            {shadow.marketContext.atr != null && (
              <span>ATR: <span className="text-zinc-400">{shadow.marketContext.atr}</span></span>
            )}
            {shadow.orderCount > 0 && (
              <span>Ordens: <span className="text-zinc-400">{shadow.orderCount}</span></span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ShadowBehaviorPanel;
