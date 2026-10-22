import Decimal from "decimal.js";
import type { Trade } from "../types";
export const TRADING_TIMEZONE = "Asia/Kolkata";
const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
export const sum = (values: number[]) =>
  values.reduce((a, b) => a.plus(b), new Decimal(0)).toNumber();
export function calculatedPnl(t: Partial<Trade>): number | null {
  if (
    ![t.brokerage ?? 0, t.charges ?? 0, t.multiplier ?? 1].every(finite) ||
    (t.multiplier ?? 1) <= 0 ||
    (t.brokerage ?? 0) < 0 ||
    (t.charges ?? 0) < 0
  )
    return null;
  if (
    ![t.entryPrice, t.exitPrice, t.quantity].every(finite) ||
    !["LONG", "SHORT"].includes(t.side) ||
    t.quantity <= 0
  )
    return null;
  return new Decimal(t.exitPrice)
    .minus(t.entryPrice)
    .times(t.side === "LONG" ? 1 : -1)
    .times(t.quantity)
    .times(t.multiplier ?? 1)
    .minus(t.brokerage ?? 0)
    .minus(t.charges ?? 0)
    .toDecimalPlaces(2)
    .toNumber();
}
export function dayKey(
  value: string | Date,
  timezone = TRADING_TIMEZONE,
): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function closedTrades(trades: Trade[]): Trade[] {
  return trades
    .filter(
      (t) =>
        t.status !== "OPEN" &&
        t.status !== "PARTIAL" &&
        finite(t.pnl) &&
        !!t.exitTime &&
        Number.isFinite(Date.parse(t.exitTime)),
    )
    .sort(
      (a, b) =>
        Date.parse(a.exitTime) - Date.parse(b.exitTime) ||
        (a.id ?? "").localeCompare(b.id ?? ""),
    );
}
export function initialRisk(t: Trade): number | null {
  if (finite(t.initialRisk) && t.initialRisk > 0) return t.initialRisk;
  if (
    !finite(t.stopLoss) ||
    !finite(t.entryPrice) ||
    !finite(t.quantity) ||
    t.quantity <= 0 ||
    t.stopLoss <= 0
  )
    return null;
  const distance =
    t.side === "LONG" ? t.entryPrice - t.stopLoss : t.stopLoss - t.entryPrice;
  return distance > 0
    ? new Decimal(distance)
        .times(t.quantity)
        .times(t.multiplier ?? 1)
        .toNumber()
    : null;
}
export function rMultiple(t: Trade) {
  const risk = initialRisk(t);
  return risk ? t.pnl / risk : null;
}
export interface Filters {
  from?: string;
  to?: string;
  symbol?: string;
  setupType?: string;
  side?: string;
  emotion?: string;
  mistake?: string;
  marketCondition?: string;
}
export function filterTrades(trades: Trade[], f: Filters = {}) {
  return closedTrades(trades).filter((t) => {
    const day = dayKey(t.exitTime);
    return (
      (!f.from || day >= f.from) &&
      (!f.to || day <= f.to) &&
      (!f.symbol || t.symbol === f.symbol) &&
      (!f.setupType || t.setupType === f.setupType) &&
      (!f.side || t.side === f.side) &&
      (!f.emotion || t.psychology?.before === f.emotion) &&
      (!f.mistake || t.mistakes?.includes(f.mistake)) &&
      (!f.marketCondition || t.marketCondition === f.marketCondition)
    );
  });
}
export function summarize(trades: Trade[]) {
  const rows = closedTrades(trades),
    wins = rows.filter((t) => t.pnl > 0),
    losses = rows.filter((t) => t.pnl < 0);
  const grossWins = sum(wins.map((t) => t.pnl)),
    grossLosses = -sum(losses.map((t) => t.pnl)),
    totalPnl = sum(rows.map((t) => t.pnl));
  const rs = rows.map(rMultiple).filter((r): r is number => r !== null);
  return {
    count: rows.length,
    totalPnl,
    wins: wins.length,
    losses: losses.length,
    breakevens: rows.length - wins.length - losses.length,
    winRate: rows.length ? (wins.length / rows.length) * 100 : 0,
    avgWin: wins.length ? grossWins / wins.length : 0,
    avgLoss: losses.length ? grossLosses / losses.length : 0,
    profitFactor: grossLosses ? grossWins / grossLosses : null,
    noLosses: grossWins > 0 && grossLosses === 0,
    expectancy: rows.length ? totalPnl / rows.length : 0,
    averageR: rs.length ? sum(rs) / rs.length : null,
    rCount: rs.length,
  };
}
export function groupTrades(trades: Trade[], key: (t: Trade) => string) {
  const groups = new Map<string, Trade[]>();
  for (const t of closedTrades(trades)) {
    const k = key(t) || "Unrecorded";
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(t);
  }
  return [...groups].map(([name, rows]) => ({ name, ...summarize(rows) }));
}
export function analytics(trades: Trade[]) {
  const rows = closedTrades(trades);
  let equity = new Decimal(0),
    peak = 0,
    maxDrawdown = 0,
    currentWins = 0,
    currentLosses = 0,
    maxWins = 0,
    maxLosses = 0;
  let peakAt = rows.length ? Date.parse(rows[0].exitTime) : 0,
    troughAt = peakAt,
    underwaterSince: number | null = null,
    maxDurationMs = 0,
    maxRecoveryMs = 0,
    episodeTrough = 0;
  // Equal-time exits are one equity observation to avoid arbitrary intra-timestamp drawdown.
  const times = new Map<string, number[]>();
  rows.forEach((t) => {
    const time = new Date(t.exitTime).toISOString();
    if (!times.has(time)) times.set(time, []);
    times.get(time)!.push(t.pnl);
  });
  const equityCurve = [...times].map(([time, pnls]) => {
    equity = equity.plus(sum(pnls));
    const value = equity.toNumber(),
      at = Date.parse(time);
    if (value >= peak) {
      if (underwaterSince !== null) {
        maxDurationMs = Math.max(maxDurationMs, at - underwaterSince);
        maxRecoveryMs = Math.max(maxRecoveryMs, at - troughAt);
      }
      peak = value;
      peakAt = at;
      underwaterSince = null;
      episodeTrough = value;
    } else {
      if (underwaterSince === null) {
        underwaterSince = peakAt;
        episodeTrough = value;
        troughAt = at;
      }
      if (value < episodeTrough) {
        episodeTrough = value;
        troughAt = at;
      }
    }
    const dd = new Decimal(peak).minus(value).toNumber();
    if (dd > maxDrawdown) maxDrawdown = dd;
    return {
      date: dayKey(time),
      time,
      equity: value,
      cumulative: value,
      pnl: sum(pnls),
      drawdown: -dd,
    };
  });
  for (const t of rows) {
    currentWins = t.pnl > 0 ? currentWins + 1 : 0;
    currentLosses = t.pnl < 0 ? currentLosses + 1 : 0;
    maxWins = Math.max(maxWins, currentWins);
    maxLosses = Math.max(maxLosses, currentLosses);
  }
  const last = rows.length ? Date.parse(rows.at(-1)!.exitTime) : 0;
  const currentDurationMs =
    underwaterSince === null ? 0 : last - underwaterSince;
  const stats = summarize(rows);
  return {
    ...stats,
    equityCurve,
    maxDrawdown,
    currentDrawdown: -(equityCurve.at(-1)?.drawdown ?? 0),
    currentDurationMs,
    maxDurationMs: Math.max(maxDurationMs, currentDurationMs),
    maxRecoveryMs,
    currentWins,
    currentLosses,
    maxWins,
    maxLosses,
    recoveryFactor: maxDrawdown ? stats.totalPnl / maxDrawdown : null,
    daily: groupTrades(rows, (t) => dayKey(t.exitTime)),
    strategies: groupTrades(rows, (t) => t.setupType),
    discrepancies: rows.filter((t) => {
      const calculated = calculatedPnl(t);
      return calculated !== null && Math.abs(calculated - t.pnl) > 0.01;
    }).length,
  };
}
export function distribution(values: number[], width?: number) {
  if (!values.length) return [];
  const min = values.reduce((a, b) => Math.min(a, b), 0),
    max = values.reduce((a, b) => Math.max(a, b), 0);
  const step =
    width && (max - min) / width <= 100
      ? width
      : Math.max(1, Math.ceil((max - min) / 12));
  const bins = new Map<number, number>();
  for (let i = Math.floor(min / step); i <= Math.floor(max / step); i++)
    bins.set(i, 0);
  values.forEach((v) => {
    const i = Math.floor(v / step);
    bins.set(i, (bins.get(i) ?? 0) + 1);
  });
  return [...bins]
    .sort((a, b) => a[0] - b[0])
    .map(([i, count]) => ({
      name: `[${(i * step).toFixed(1)}, ${((i + 1) * step).toFixed(1)})`,
      count,
    }));
}
export const displayRatio = (v: number | null, noLosses = false) =>
  v === null ? (noLosses ? "No losses" : "N/A") : v.toFixed(2);
export function entryBucket(t: Trade, part: "hour" | "weekday") {
  if (!Number.isFinite(Date.parse(t.entryTime))) return "Unrecorded";
  return new Intl.DateTimeFormat(
    part === "hour" ? "en-GB" : "en",
    part === "hour"
      ? { hour: "2-digit", hourCycle: "h23", timeZone: TRADING_TIMEZONE }
      : { weekday: "short", timeZone: TRADING_TIMEZONE },
  ).format(new Date(t.entryTime));
}
