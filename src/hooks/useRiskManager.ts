import { useMemo } from 'react';
import { Trade, UserSettings } from '../types';
import { startOfDay, startOfMonth, subDays } from 'date-fns';

export function useRiskManager(trades: Trade[], settings: UserSettings) {
  const breaches = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const currMonth = startOfMonth(now);
    
    const todayTrades = trades.filter(t => new Date(t.entryTime) >= today);
    const monthlyTrades = trades.filter(t => new Date(t.entryTime) >= currMonth);
    
    const dailyNet = todayTrades.reduce((acc, t) => acc + t.pnl, 0);
    const dailyLoss = todayTrades.reduce((acc, t) => acc + (t.pnl < 0 ? Math.abs(t.pnl) : 0), 0);
    const monthlyNet = monthlyTrades.reduce((acc, t) => acc + t.pnl, 0);
    
    const maxSingleLoss = Math.max(0, ...todayTrades.map(t => (t.pnl < 0 ? Math.abs(t.pnl) : 0)));
    
    // Consecutive losing days check
    let consecutiveLosingDays = 0;
    const last7Days = Array.from({ length: 7 }, (_, i) => startOfDay(subDays(now, i)));
    for (const day of last7Days) {
      const dayTrades = trades.filter(t => startOfDay(new Date(t.entryTime)).getTime() === day.getTime());
      if (dayTrades.length > 0) {
        const dayNet = dayTrades.reduce((acc, t) => acc + t.pnl, 0);
        if (dayNet < 0) {
          consecutiveLosingDays++;
        } else if (dayNet > 0) {
          break; // Streak broken
        }
      }
    }

    const isDailyBreached = dailyNet <= -settings.dailyLossLimit;
    const isSingleBreached = maxSingleLoss >= settings.singleTradeLossLimit;
    const isMonthlyBreached = monthlyNet <= -settings.monthlyLossLimit;
    const isStreakBreached = consecutiveLosingDays >= 3;

    return {
      isDailyBreached,
      isSingleBreached,
      isMonthlyBreached,
      isStreakBreached,
      isLocked: isDailyBreached || isSingleBreached || isMonthlyBreached || isStreakBreached,
      dailyNet,
      dailyLoss,
      monthlyNet,
      maxSingleLoss,
      consecutiveLosingDays,
      lockReason: isDailyBreached ? "Daily Loss Limit Reached" :
                  isSingleBreached ? "Max Single Trade Loss Reached" :
                  isMonthlyBreached ? "Monthly Drawdown Limit Reached" :
                  isStreakBreached ? "3 Consecutive Losing Days Lock" : null
    };
  }, [trades, settings]);

  return breaches;
}
