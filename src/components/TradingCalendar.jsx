import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, XCircle } from 'lucide-react';

/**
 * Utilitário local para formatação monetária compacta
 */
const formatCurrency = (value) => 
  new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL',
    minimumFractionDigits: 0, 
    maximumFractionDigits: 2 
  }).format(value);

/**
 * TradingCalendar (Versão Interativa com Contador)
 * * @component
 * @param {Array} trades - Lista de trades para calcular P&L.
 * @param {string|null} selectedDate - Data atualmente selecionada (YYYY-MM-DD).
 * @param {Function} onSelectDate - Callback ao clicar em um dia.
 */
const TradingCalendar = ({ trades = [], selectedDate, onSelectDate }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

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
        
        <div className={`text-sm font-mono font-bold ${monthStats >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {monthStats > 0 ? '+' : ''}{formatCurrency(monthStats)}
        </div>
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
        <div className="grid grid-cols-7 gap-1 h-full auto-rows-fr">
          {blanks.map((_, i) => <div key={`b-${i}`} />)}

          {daysArray.map(day => {
            const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const data = dailyData[dateString];
            const isSelected = selectedDate === dateString;
            
            // Estilos Condicionais
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
                {/* Dia Numérico */}
                <span className={`text-[10px] absolute top-1 left-1.5 leading-none ${data ? 'text-slate-400' : 'text-slate-700'}`}>
                  {day}
                </span>

                {/* Badge de Contador (NOVO REQUISITO) */}
                {data && (
                  <span className="absolute top-1 right-1 flex h-3.5 min-w-[14px] items-center justify-center rounded bg-slate-900/60 px-0.5 text-[8px] font-medium text-slate-300 border border-slate-700/30">
                    {data.count}
                  </span>
                )}
                
                {/* Valor Financeiro */}
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