import type { Trade, NotebookEntry } from "../types";
import { dayKey, filterTrades, summarize } from "./tradingAnalytics";
export function periodBounds(kind: NotebookEntry["kind"], date: string) {
  const d = new Date(date + "T00:00:00Z");
  if (!Number.isFinite(d.getTime())) throw Error("Invalid date");
  if (kind === "WEEK") d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  if (kind === "MONTH") d.setUTCDate(1);
  const from = d.toISOString().slice(0, 10),
    end = new Date(d);
  if (kind === "WEEK") end.setUTCDate(end.getUTCDate() + 6);
  if (kind === "MONTH") {
    end.setUTCMonth(end.getUTCMonth() + 1);
    end.setUTCDate(0);
  }
  return { from, to: end.toISOString().slice(0, 10) };
}
export interface JournalFilters {
  search?: string;
  outcome?: string;
  strategy?: string;
  review?: string;
  date?: string;
}
export function journalRows(trades: Trade[], f: JournalFilters) {
  const query = (f.search ?? "").trim().toLowerCase();
  return trades.filter(
    (t) =>
      (!query ||
        [
          t.symbol,
          t.setupType,
          t.tradeReason,
          ...(t.tags ?? []),
          ...(t.mistakes ?? []),
        ].some((v) => v?.toLowerCase().includes(query))) &&
      (!f.strategy || t.setupType === f.strategy) &&
      (!f.date || dayKey(t.exitTime) === f.date) &&
      (!f.review ||
        (f.review === "REVIEWED"
          ? t.review?.status === "REVIEWED"
          : t.review?.status !== "REVIEWED")) &&
      (!f.outcome ||
        (f.outcome === "win"
          ? t.pnl > 0
          : f.outcome === "loss"
            ? t.pnl < 0
            : t.pnl === 0)),
  );
}
export function pageRows<T>(rows: T[], page: number, size = 25) {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.max(1, Math.min(pages, page));
  return {
    rows: rows.slice((current - 1) * size, current * size),
    pages,
    current,
    total: rows.length,
  };
}
export function reviewProgress(trades: Trade[]) {
  const count = trades.length,
    reviewed = trades.filter((t) => t.review?.status === "REVIEWED").length;
  return {
    count,
    reviewed,
    pending: count - reviewed,
    percent: count ? (reviewed / count) * 100 : 0,
  };
}
export function periodSummary(
  trades: Trade[],
  kind: NotebookEntry["kind"],
  date: string,
) {
  const bounds = periodBounds(kind, date);
  const rows = filterTrades(trades, bounds);
  return {
    ...bounds,
    rows,
    stats: summarize(rows),
    progress: reviewProgress(rows),
  };
}
