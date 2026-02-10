/**
 * EmotionAnalysis (Refactored to Emotion Performance Matrix)
 * @version 2.0.0
 * @description Substitui o gráfico de pizza por uma Matriz de Performance baseada na Emoção de ENTRADA.
 * Identifica quais sentimentos (Gatilhos) geram lucro ou prejuízo.
 */

import React, { useMemo } from 'react';
import { Brain, TrendingUp, AlertTriangle, ArrowRight, Activity } from 'lucide-react';
import { formatCurrency, formatPercent } from '../utils/calculations';

const EmotionAnalysis = ({ trades }) => {
  
  // Engine de Processamento de Dados Local
  // Processa a lista bruta de trades para extrair inteligência comportamental
  const emotionStats = useMemo(() => {
    if (!trades || trades.length === 0) return [];

    // 1. Agrupamento
    const groups = trades.reduce((acc, trade) => {
      // Prioridade: EmotionEntry (Novo) > Emotion (Legado) > "Não Informado"
      let emotionKey = trade.emotionEntry || trade.emotion || 'Não Informado';
      
      // Normalização de texto (Capitalize)
      if (emotionKey !== 'Não Informado') {
        emotionKey = emotionKey.charAt(0).toUpperCase() + emotionKey.slice(1).toLowerCase();
      }
      
      if (!acc[emotionKey]) {
        acc[emotionKey] = { 
          name: emotionKey, 
          count: 0, 
          wins: 0, 
          totalPL: 0 
        };
      }
      
      const result = Number(trade.result || 0);
      acc[emotionKey].count += 1;
      acc[emotionKey].totalPL += result;
      if (result > 0) acc[emotionKey].wins += 1;
      
      return acc;
    }, {});

    // 2. Cálculo de Derivados (KPIs) e Ordenação
    return Object.values(groups)
      .map(item => ({
        ...item,
        winRate: (item.wins / item.count) * 100,
        avgPL: item.totalPL / item.count, // Expectativa matemática por trade
        impactScore: Math.abs(item.totalPL) // Para decidir relevância visual
      }))
      .sort((a, b) => b.totalPL - a.totalPL); // Do maior Lucro para o maior Prejuízo
  }, [trades]);

  // Renderização de Estado Vazio
  if (!trades || trades.length === 0) {
    return (
      <div className="glass-card p-6 flex flex-col items-center justify-center h-full min-h-[300px] text-slate-500">
        <Brain className="w-12 h-12 mb-3 opacity-20" />
        <p>Sem dados emocionais suficientes.</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 h-full flex flex-col min-h-[350px]">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6 flex-none">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-lg">
            <Brain className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white leading-tight">Matriz Emocional</h3>
            <p className="text-xs text-slate-500">Impacto financeiro por sentimento de entrada</p>
          </div>
        </div>
      </div>

      {/* Lista / Matriz Scrollável */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
        {emotionStats.map((stat) => {
          const isProfitable = stat.totalPL >= 0;
          
          // Estilização Dinâmica baseada no Resultado
          const theme = isProfitable 
            ? { 
                bg: 'bg-emerald-500/5', 
                border: 'border-emerald-500/20', 
                text: 'text-emerald-400', 
                bar: 'bg-emerald-500',
                icon: <TrendingUp className="w-3 h-3" />
              } 
            : { 
                bg: 'bg-red-500/5', 
                border: 'border-red-500/20', 
                text: 'text-red-400', 
                bar: 'bg-red-500',
                icon: <AlertTriangle className="w-3 h-3" />
              };

          return (
            <div 
              key={stat.name} 
              className={`relative p-3 rounded-xl border ${theme.border} ${theme.bg} transition-all hover:bg-opacity-50 group`}
            >
              {/* Linha 1: Nome e Valor Total */}
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-200 text-sm">{stat.name}</span>
                  <span className="text-[10px] text-slate-500 bg-slate-900/50 px-2 py-0.5 rounded-full border border-slate-700/50">
                    {stat.count}x
                  </span>
                </div>
                <span className={`font-mono font-bold text-sm ${theme.text}`}>
                  {formatCurrency(stat.totalPL)}
                </span>
              </div>

              {/* Linha 2: KPIs Detalhados */}
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <div className="flex items-center gap-3">
                  <span title="Taxa de Acerto">
                    WR: <b className="text-slate-300">{formatPercent(stat.winRate)}</b>
                  </span>
                  <span className="w-px h-3 bg-slate-700/50"></span>
                  <span title="Resultado Médio por Trade">
                    Méd: <b className={stat.avgPL >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {formatCurrency(stat.avgPL)}
                    </b>
                  </span>
                </div>
                <div className={`${theme.text} opacity-50 group-hover:opacity-100 transition-opacity`}>
                  {theme.icon}
                </div>
              </div>

              {/* Linha 3: Barra de Intensidade (Win Rate Visual) */}
              <div className="w-full bg-slate-900/50 h-1 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${theme.bar} opacity-60`} 
                  style={{ width: `${Math.min(stat.winRate, 100)}%` }} 
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Rodapé: Insight Automático */}
      {emotionStats.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-800/50 flex-none">
          <div className="flex items-start gap-2 text-xs text-slate-400 leading-relaxed">
            <Activity className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <p>
              Seu melhor estado é 
              <span className="text-emerald-400 font-bold mx-1">{emotionStats[0].name}</span>.
              {emotionStats.length > 1 && emotionStats[emotionStats.length - 1].totalPL < 0 && (
                <> Atenção redobrada com <span className="text-red-400 font-bold mx-1">{emotionStats[emotionStats.length - 1].name}</span>, que é seu maior ofensor.</>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmotionAnalysis;