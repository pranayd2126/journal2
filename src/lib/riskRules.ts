import type { Trade, UserSettings } from "../types";
import {
  analytics,
  closedTrades,
  dayKey,
  initialRisk,
  summarize,
} from "./tradingAnalytics";
export function evaluateRisk(
  trades: Trade[],
  settings: UserSettings,
  now = new Date(),
) {
  const today = dayKey(now),
    month = today.slice(0, 7);
  const rows = closedTrades(trades).filter(
    (t) => Date.parse(t.exitTime) <= now.getTime(),
  );
  const todayTrades = rows.filter((t) => dayKey(t.exitTime) === today),
    monthlyTrades = rows.filter((t) => dayKey(t.exitTime).startsWith(month));
  const daily = summarize(todayTrades),
    monthly = summarize(monthlyTrades);
  const maxSingleLoss = todayTrades.reduce((m, t) => Math.max(m, -t.pnl), 0);
  const dailyResults = analytics(rows).daily.sort((a, b) =>
    b.name.localeCompare(a.name),
  );
  let consecutiveLosingDays = 0;
  for (const day of dailyResults) {
    if (day.totalPnl < 0) consecutiveLosingDays++;
    else break;
  }
  const entries = trades.filter(
    (t) =>
      dayKey(t.entryTime) === today && Date.parse(t.entryTime) <= now.getTime(),
  );
  const maxRisk = entries.reduce((m, t) => Math.max(m, initialRisk(t) ?? 0), 0);
  const limit = (value: number, threshold: number) =>
    Number.isFinite(threshold) && threshold > 0 && value >= threshold;
  const isDailyBreached = limit(-daily.totalPnl, settings.dailyLossLimit),
    isSingleBreached = limit(maxSingleLoss, settings.singleTradeLossLimit),
    isMonthlyBreached = limit(-monthly.totalPnl, settings.monthlyLossLimit);
  return {
    isDailyBreached,
    isSingleBreached,
    isMonthlyBreached,
    isStreakBreached: consecutiveLosingDays >= 3,
    dailyLossLimitReached: isDailyBreached,
    singleTradeLimitReached: isSingleBreached,
    monthlyLimitReached: isMonthlyBreached,
    dailyNet: daily.totalPnl,
    dailyLoss: daily.avgLoss * daily.losses,
    monthlyNet: monthly.totalPnl,
    maxSingleLoss,
    consecutiveLosingDays,
    isTradeCountBreached: limit(entries.length, settings.maxTradesPerDay),
    isConsecutiveBreached: limit(
      analytics(todayTrades).currentLosses,
      settings.maxConsecutiveLosses,
    ),
    isRiskBreached: limit(maxRisk, settings.maxRiskPerTrade),
    revengeCount: entries.filter((t) => t.psychology?.revengeTrade).length,
    isLocked: false,
    lockReason: null,
  };
}
