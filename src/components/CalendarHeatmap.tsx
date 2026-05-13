import { useMemo, useState } from 'react';
import { Trade } from '../types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subMonths, addMonths, startOfWeek, endOfWeek, isSameMonth } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarHeatmapProps {
  trades: Trade[];
  initialOffset?: number;
}

export default function CalendarHeatmap({ trades, initialOffset = 0 }: CalendarHeatmapProps) {
  const [currentDate, setCurrentDate] = useState(subMonths(new Date(), initialOffset));

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate));
    const end = endOfWeek(endOfMonth(currentDate));
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const dailyPnls = useMemo(() => {
    const pnlMap: Record<string, number> = {};
    trades.forEach(trade => {
      try {
        const d = new Date(trade.entryTime);
        if (!isNaN(d.getTime())) {
          const key = format(d, 'yyyy-MM-dd');
          pnlMap[key] = (pnlMap[key] || 0) + trade.pnl;
        }
      } catch (e) {}
    });
    return pnlMap;
  }, [trades]);

  const maxProfit = Math.max(0, ...Object.values(dailyPnls));
  const maxLoss = Math.min(0, ...Object.values(dailyPnls));

  const getDotStyle = (pnl: number) => {
    if (pnl === 0) return { size: 0, color: 'transparent', opacity: 0 };
    const isProfit = pnl > 0;
    const maxVal = isProfit ? maxProfit : Math.abs(maxLoss);
    const absVal = Math.abs(pnl);
    
    // Scale size from 8px to 24px based on relative P&L magnitude
    const ratio = maxVal === 0 ? 0 : absVal / maxVal;
    const size = 8 + (ratio * 16); 
    
    return {
      size,
      color: isProfit ? '#10b981' : '#ef4444',
      opacity: 0.3 + (ratio * 0.7)
    };
  };

  const currentMonthPnl = useMemo(() => {
    return days.reduce((acc, day) => {
      if (isSameMonth(day, currentDate)) {
        const key = format(day, 'yyyy-MM-dd');
        return acc + (dailyPnls[key] || 0);
      }
      return acc;
    }, 0);
  }, [days, currentDate, dailyPnls]);

  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6 relative shadow-sm flex flex-col h-full">
      <div className="flex items-center justify-between mb-8">
        <button 
          onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          className="p-2 hover:bg-zinc-900 rounded-xl transition-all text-zinc-400 hover:text-white"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-bold text-white uppercase tracking-widest">
          {format(currentDate, 'MMMM yyyy')}
        </h3>
        <button 
          onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          className="p-2 hover:bg-zinc-900 rounded-xl transition-all text-zinc-400 hover:text-white"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-7 gap-y-4 gap-x-2 mb-4">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
            <div key={i} className="text-center text-[10px] font-bold text-zinc-500 uppercase">
              {day}
            </div>
          ))}
          {days.map((day, i) => {
            const key = format(day, 'yyyy-MM-dd');
            const pnl = dailyPnls[key] || 0;
            const style = getDotStyle(pnl);
            const isCurrentMonth = isSameMonth(day, currentDate);

            return (
              <div 
                key={i} 
                className={`relative flex flex-col items-center justify-center h-12 w-full rounded-xl transition-all group ${isCurrentMonth ? 'bg-zinc-900/30' : 'opacity-0 pointer-events-none'}`}
              >
                <span className="absolute top-1 left-1.5 text-[8px] font-mono text-zinc-600 opacity-50">{format(day, 'd')}</span>
                
                {pnl !== 0 && (
                  <div 
                    className="rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                    style={{ 
                      width: `${style.size}px`, 
                      height: `${style.size}px`, 
                      backgroundColor: style.color,
                      opacity: style.opacity,
                      boxShadow: `0 0 ${style.size/2}px ${style.color}40`
                    }}
                  />
                )}
                
                {pnl !== 0 && (
                  <div className="absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 px-3 py-2 bg-black border border-zinc-800 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl whitespace-nowrap">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">{format(day, 'MMM d, yyyy')}</p>
                    <p className={`text-sm font-mono font-bold ${pnl > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {pnl > 0 ? '+' : ''}₹{pnl.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-4 mt-6 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
          <span>Max Loss</span>
          <div className="flex items-center gap-1">
            <div className="w-6 h-6 rounded-full bg-red-500 opacity-100" />
            <div className="w-4 h-4 rounded-full bg-red-500 opacity-60" />
            <div className="w-2 h-2 rounded-full bg-red-500 opacity-30" />
          </div>
          <span className="mx-2">Zero</span>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500 opacity-30" />
            <div className="w-4 h-4 rounded-full bg-emerald-500 opacity-60" />
            <div className="w-6 h-6 rounded-full bg-emerald-500 opacity-100" />
          </div>
          <span>Max Profit</span>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-zinc-900 grid grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Monthly Net P&L</p>
          <p className={`text-xl font-mono font-bold ${currentMonthPnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {currentMonthPnl >= 0 ? '+' : ''}₹{currentMonthPnl.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
