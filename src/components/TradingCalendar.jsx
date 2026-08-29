import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, XCircle } from 'lucide-react';
import { formatCurrencyCompact } from '../utils/currency';

/**
 * TradingCalendar (Versão Interativa com Contador)
 * * @component
 * @param {Array} trades - Lista de trades para calcular P&L.
 * @param {string|null} selectedDate - Data atualmente selecionada (YYYY-MM-DD).
 * @param {Function} onSelectDate - Callback ao clicar em um dia.
 * @param {string} currency - Moeda dominante do conjunto de trades (ex.: 'BRL', 'USD').
 * @param {Date|string|null} focusDate - Mês inicial exibido; segue o período da barra
 *   de contexto (#289). Navegação manual com as setas persiste até focusDate mudar.
 * @param {Object|null} daysMeta - #101, modo TURMA. Mapa { 'YYYY-MM-DD': {trades, alunos, flags} }
 *   vindo de `buildCalendarDays`. Quando presente, o dia deixa de mostrar dinheiro e passa a
 *   mostrar quantos alunos operaram, colorido por violação — a turma opera em duas moedas, e
 *   somar o P&L de doze pessoas num número só não descreve dia nenhum (#267/#289).
 */
const TradingCalendar = ({ trades = [], selectedDate, onSelectDate, currency = 'BRL', focusDate = null, daysMeta = null }) => {
  const modoTurma = daysMeta !== null;
  const formatCurrency = (value) => formatCurrencyCompact(value, currency);

  const [currentDate, setCurrentDate] = useState(() => (focusDate ? new Date(focusDate) : new Date()));

  // Sincroniza o mês exibido com o período selecionado na barra de contexto (#289).
  // Depende de uma chave ano-mês (primitivo) para não disparar a cada render só
  // porque o objeto Date trocou de identidade; navegação manual persiste até a
  // troca real de ciclo/período.
  const focusMonthKey = focusDate
    ? (() => { const d = new Date(focusDate); return Number.isNaN(d.getTime()) ? null : d.getFullYear() * 12 + d.getMonth(); })()
    : null;
  useEffect(() => {
    if (focusMonthKey != null) setCurrentDate(new Date(focusDate));
  }, [focusMonthKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- ENGINE DE DADOS ---
  const dailyData = useMemo(() => {
    const map = {};
    trades.forEach(trade => {
      // Guard Clause: Ignora trades inválidos
      if (!trade.date || typeof trade.result !== 'number') return;
      
      const dateKey = trade.date; // YYYY-MM-DD do Firebase
      
      if (!map[dateKey]) map[dateKey] = { pnl: 0, count: 0 };
      
      map[dateKey].pnl += trade.result;
      map[dateKey].count += 1;
    });
    return map;
  }, [trades]);

  const monthStats = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    let monthPnL = 0;
    
    Object.keys(dailyData).forEach(key => {
      const [y, m] = key.split('-').map(Number);
      // Mês no split é 1-12, Date é 0-11
      if (y === year && (m - 1) === month) {
        monthPnL += dailyData[key].pnl;
      }
    });
    return monthPnL;
  }, [dailyData, currentDate]);

  // Totais do mês em modo turma: atividade e risco, nunca soma de dinheiro.
  const mesTurma = useMemo(() => {
    if (!modoTurma) return { trades: 0, dias: 0, flags: 0 };
    const ano = currentDate.getFullYear();
    const mes = currentDate.getMonth();
    let trades = 0, dias = 0, flags = 0, gains = 0, losses = 0, r = 0, comR = 0;
    for (const [data, d] of Object.entries(daysMeta)) {
      const [y, m] = data.split('-').map(Number);
      if (y !== ano || m - 1 !== mes) continue;
      trades += d.trades; flags += d.flags; dias += 1;
      gains += d.gains ?? 0; losses += d.losses ?? 0;
      r += d.r ?? 0; comR += d.comR ?? 0;
    }
    return { trades, dias, flags, gains, losses, r: Math.round(r * 10) / 10, comR };
  }, [modoTurma, daysMeta, currentDate]);

  // --- NAVEGAÇÃO ---
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  
  // --- HELPERS DE RENDERIZAÇÃO ---
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  
  const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(currentDate);
  const formattedTitle = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const blanks = Array.from({ length: firstDayOfWeek });
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="glass-card flex flex-col h-full min-h-[420px]">
      
      {/* HEADER */}
      <div className="p-4 border-b border-slate-800/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-800/50 rounded-lg p-0.5 border border-slate-700/50">
            <button onClick={prevMonth} className="p-1 hover:text-white text-slate-400 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={nextMonth} className="p-1 hover:text-white text-slate-400 transition-colors"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <span className="text-sm font-bold text-white capitalize">{formattedTitle}</span>
        </div>
        
        {modoTurma ? (
          /* Stop × Gain do mês, no próprio card: um gráfico de barras por dia da
             semana era um calendário com menos informação. */
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500/80" />
              {mesTurma.gains} {mesTurma.gains === 1 ? 'ganho' : 'ganhos'}
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-red-500/80" />
              {mesTurma.losses} {mesTurma.losses === 1 ? 'perda' : 'perdas'}
            </span>
            {mesTurma.flags > 0 && (
              <span className="flex items-center gap-1.5 text-amber-400/80">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                {mesTurma.flags} fora do plano
              </span>
            )}
            {mesTurma.comR > 0 && (
              <span
                className={`font-mono font-bold px-2.5 py-1 rounded-lg border ${
                  mesTurma.r >= 0
                    ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                    : 'text-red-300 border-red-500/30 bg-red-500/10'
                }`}
                title="Líquido do mês em múltiplos do risco autorizado de cada aluno"
              >
                {mesTurma.r >= 0 ? '+' : ''}{mesTurma.r.toFixed(1)}R
              </span>
            )}
          </div>
        ) : (
          <div className={`text-sm font-mono font-bold ${monthStats >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {monthStats > 0 ? '+' : ''}{formatCurrency(monthStats)}
          </div>
        )}
      </div>

      {/* BODY */}
      <div className="p-4 flex-1 flex flex-col">
        {/* Dias da Semana */}
        <div className="grid grid-cols-7 mb-2">
          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
            <div key={i} className="text-center text-[10px] font-bold text-slate-600">
              {d}
            </div>
          ))}
        </div>

        {/* Grid de Dias */}
        <div className="grid grid-cols-7 gap-1.5 h-full auto-rows-fr">
          {blanks.map((_, i) => <div key={`b-${i}`} />)}

          {daysArray.map(day => {
            const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const meta = modoTurma ? daysMeta[dateString] : null;
            const data = modoTurma ? (meta ? { pnl: 0, count: meta.trades } : undefined) : dailyData[dateString];
            const isSelected = selectedDate === dateString;

            // ── MODO TURMA ────────────────────────────────────────────────────
            // O dia é lido em três camadas, não em quatro números empilhados:
            //   COR   = veredicto (verde ganhou, vermelho perdeu, âmbar violou o plano)
            //   NÚMERO grande = o líquido do dia em R — o que aconteceu
            //   BARRA = proporção ganhos × perdas — como aconteceu
            // Quem operou fica no hover. Antes eram "3 · 0" e "1 aluno" em texto
            // miúdo dentro de um quadrado: planilha, não calendário.
            if (modoTurma) {
              if (!meta) {
                return (
                  <div key={dateString} className="rounded-xl border border-transparent min-h-[74px] p-2">
                    <span className="text-[11px] text-slate-700">{day}</span>
                  </div>
                );
              }

              const positivo = meta.comR ? meta.r >= 0 : meta.gains >= meta.losses;
              const temFalta = meta.flags > 0;
              const total = Math.max(1, meta.gains + meta.losses);
              const pctGanho = (meta.gains / total) * 100;

              const moldura = isSelected
                ? 'border-blue-400 bg-blue-500/20 ring-2 ring-blue-500/40'
                : temFalta
                  ? 'border-amber-500/40 bg-amber-500/[0.07] hover:bg-amber-500/[0.14]'
                  : positivo
                    ? 'border-emerald-500/25 bg-emerald-500/[0.07] hover:bg-emerald-500/[0.14]'
                    : 'border-red-500/25 bg-red-500/[0.07] hover:bg-red-500/[0.14]';

              return (
                <button
                  key={dateString}
                  onClick={() => onSelectDate(dateString)}
                  title={[
                    `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')} · ${meta.gains} ${meta.gains === 1 ? 'ganho' : 'ganhos'} · ${meta.losses} ${meta.losses === 1 ? 'perda' : 'perdas'}${meta.comR ? ` · ${meta.r >= 0 ? '+' : ''}${meta.r.toFixed(1)}R` : ''}`,
                    ...meta.nomes.map((a) => `${a.nome} (${a.trades}${a.flags ? `, ${a.flags} fora do plano` : ''})`),
                  ].join('\n')}
                  className={`group relative rounded-xl border p-2 min-h-[74px] flex flex-col justify-between text-left transition-all duration-150 ${moldura}`}
                >
                  <div className="flex items-start justify-between">
                    <span className={`text-[11px] leading-none ${isSelected ? 'text-white' : 'text-slate-400'}`}>{day}</span>
                    {temFalta && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title={`${meta.flags} fora do plano`} />
                    )}
                  </div>

                  {meta.comR > 0 && (
                    <span className={`text-base font-bold font-mono leading-none ${
                      isSelected ? 'text-white' : positivo ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {meta.r >= 0 ? '+' : ''}{meta.r.toFixed(1)}
                      <span className="text-[10px] font-normal opacity-60">R</span>
                    </span>
                  )}

                  <div>
                    {/* Proporção ganhos × perdas: o dia inteiro numa faixa. */}
                    <div className="h-1.5 w-full rounded-full overflow-hidden bg-slate-800 flex">
                      <div className="bg-emerald-500/80" style={{ width: `${pctGanho}%` }} />
                      <div className="bg-red-500/80" style={{ width: `${100 - pctGanho}%` }} />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[9px] text-slate-500">
                        {meta.gains}<span className="text-slate-700">/</span>{meta.losses}
                      </span>
                      <span className="text-[9px] text-slate-500">
                        {meta.alunos} {meta.alunos === 1 ? 'aluno' : 'alunos'}
                      </span>
                    </div>
                  </div>
                </button>
              );
            }

            // ── MODO ALUNO (inalterado) ───────────────────────────────────────
            let bgClass = "bg-slate-800/20 border-transparent hover:bg-slate-800/50";
            let textClass = "text-slate-500";

            if (data) {
              if (data.pnl > 0) {
                bgClass = isSelected
                  ? "bg-emerald-500 border-emerald-400 shadow-lg shadow-emerald-500/20"
                  : "bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20";
                textClass = isSelected ? "text-white" : "text-emerald-400";
              } else if (data.pnl < 0) {
                bgClass = isSelected
                  ? "bg-red-500 border-red-400 shadow-lg shadow-red-500/20"
                  : "bg-red-500/10 border-red-500/20 hover:bg-red-500/20";
                textClass = isSelected ? "text-white" : "text-red-400";
              } else {
                textClass = "text-slate-300";
              }
            }

            return (
              <button
                key={dateString}
                onClick={() => data && onSelectDate(dateString)}
                disabled={!data}
                className={`
                  relative rounded-lg border p-1 flex flex-col items-center justify-center transition-all duration-200
                  ${bgClass} ${!data ? 'cursor-default' : 'cursor-pointer'}
                `}
              >
                <span className={`text-[10px] absolute top-1 left-1.5 leading-none ${data ? 'text-slate-400' : 'text-slate-700'}`}>
                  {day}
                </span>

                {data && (
                  <span className="absolute top-1 right-1 flex h-3.5 min-w-[14px] items-center justify-center rounded bg-slate-900/60 px-0.5 text-[8px] font-medium text-slate-300 border border-slate-700/30">
                    {data.count}
                  </span>
                )}

                {data && (
                  <span className={`text-[10px] md:text-xs font-bold mt-3 truncate max-w-full px-1 ${textClass}`}>
                    {formatCurrency(data.pnl)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Feedback visual de seleção */}
        {selectedDate && (
          <div className="mt-3 flex justify-center">
            <button 
              onClick={() => onSelectDate(null)}
              className="text-xs flex items-center gap-1 text-slate-400 hover:text-white bg-slate-800/50 px-3 py-1 rounded-full transition-colors border border-slate-700"
            >
              <XCircle className="w-3 h-3" />
              Limpar filtro de dia ({selectedDate.split('-').reverse().join('/')})
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TradingCalendar;