import { useState, useMemo } from 'react';
import { generateCalendarData, formatCurrency } from '../utils/calculations';

const CalendarHeatmap = ({ trades, weeks = 8 }) => {
  const [tooltip, setTooltip] = useState(null);

  const calendarData = useMemo(() => {
    return generateCalendarData(trades, weeks);
  }, [trades, weeks]);

  // Agrupar por semana
  const weeksData = useMemo(() => {
    const result = [];
    let currentWeek = [];
    
    calendarData.forEach((day, index) => {
      currentWeek.push(day);
      if (day.dayOfWeek === 6 || index === calendarData.length - 1) {
        result.push([...currentWeek]);
        currentWeek = [];
      }
    });
    
    return result;
  }, [calendarData]);

  const getIntensityClass = (pl, count) => {
    if (count === 0) return 'bg-slate-800/50';
    
    const absValue = Math.abs(pl);
    
    if (pl > 0) {
      if (absValue > 1000) return 'bg-emerald-400/80 shadow-emerald-500/30 shadow-sm';
      if (absValue > 500) return 'bg-emerald-500/70';
      if (absValue > 100) return 'bg-emerald-600/60';
      return 'bg-emerald-700/50';
    } else {
      if (absValue > 1000) return 'bg-red-400/80 shadow-red-500/30 shadow-sm';
      if (absValue > 500) return 'bg-red-500/70';
      if (absValue > 100) return 'bg-red-600/60';
      return 'bg-red-700/50';
    }
  };

  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="glass-card p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Calendário de Trades</h3>
      
      <div className="overflow-x-auto">
        <div className="flex gap-4 min-w-max">
          {/* Labels dos dias da semana */}
          <div className="flex flex-col gap-1 pr-2 pt-6">
            {dayNames.map((day, i) => (
              <div key={i} className="h-7 flex items-center text-xs text-slate-500">
                {i % 2 === 1 ? day : ''}
              </div>
            ))}
          </div>

          {/* Grid do calendário */}
          <div className="flex gap-1">
            {weeksData.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-1">
                {/* Mês label na primeira linha */}
                <div className="h-5 text-xs text-slate-500">
                  {week[0]?.dayNumber === '1' || weekIndex === 0 ? week[0]?.month : ''}
                </div>
                
                {/* Dias da semana */}
                {Array.from({ length: 7 }).map((_, dayIndex) => {
                  const day = week.find(d => d.dayOfWeek === dayIndex);
                  
                  if (!day) {
                    return (
                      <div 
                        key={dayIndex} 
                        className="w-7 h-7 rounded-md bg-slate-900/30"
                      />
                    );
                  }

                  return (
                    <div
                      key={dayIndex}
                      className={`
                        w-7 h-7 rounded-md cursor-pointer transition-all duration-200
                        ${getIntensityClass(day.pl, day.count)}
                        hover:ring-2 hover:ring-white/30 hover:scale-110
                      `}
                      onMouseEnter={(e) => {
                        const rect = e.target.getBoundingClientRect();
                        setTooltip({
                          x: rect.left + rect.width / 2,
                          y: rect.top - 10,
                          ...day
                        });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      {day.count > 0 && (
                        <span className="flex items-center justify-center h-full text-[10px] font-bold text-white/80">
                          {day.count}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legenda */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-800/50">
        <span className="text-xs text-slate-500">Menos</span>
        <div className="flex gap-1">
          <div className="w-4 h-4 rounded bg-slate-800/50"></div>
          <div className="w-4 h-4 rounded bg-red-700/50"></div>
          <div className="w-4 h-4 rounded bg-red-500/70"></div>
          <div className="w-4 h-4 rounded bg-emerald-700/50"></div>
          <div className="w-4 h-4 rounded bg-emerald-500/70"></div>
          <div className="w-4 h-4 rounded bg-emerald-400/80"></div>
        </div>
        <span className="text-xs text-slate-500">Mais</span>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div 
          className="fixed z-50 px-3 py-2 bg-slate-800 rounded-lg shadow-xl border border-slate-700/50 pointer-events-none transform -translate-x-1/2 -translate-y-full"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="text-xs font-medium text-white">
            {tooltip.dayNumber} de {tooltip.month}
          </div>
          {tooltip.count > 0 ? (
            <>
              <div className={`text-sm font-bold ${tooltip.pl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatCurrency(tooltip.pl)}
              </div>
              <div className="text-xs text-slate-400">
                {tooltip.count} trade{tooltip.count > 1 ? 's' : ''}
              </div>
            </>
          ) : (
            <div className="text-xs text-slate-500">Sem trades</div>
          )}
        </div>
      )}
    </div>
  );
};

export default CalendarHeatmap;
