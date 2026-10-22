import { describe, it, expect } from "vitest";
import {
  analytics,
  calculatedPnl,
  dayKey,
  filterTrades,
  groupTrades,
  rMultiple,
  summarize,
} from "../src/lib/tradingAnalytics";
import { evaluateRisk } from "../src/lib/riskRules";
import type { Trade, UserSettings } from "../src/types";
export const trade = (pnl: number, extra: Partial<Trade> = {}): Trade => ({
  userId: "a",
  symbol: "TEST",
  side: "LONG",
  entryPrice: 100,
  exitPrice: 110,
  quantity: 10,
  brokerage: 0,
  pnl,
  setupType: "Breakout",
  entryTime: "2026-01-01T08:00:00Z",
  exitTime: "2026-01-01T09:00:00Z",
  createdAt: null,
  mistakes: [],
  executionQuality: {
    entry: "PERFECT",
    exit: "PERFECT",
    followedSL: true,
    followedPlan: true,
    respectedRR: true,
  },
  psychology: {
    before: "CALM",
    during: "CALM",
    after: "CALM",
    boredomTrade: false,
    revengeTrade: false,
    pressureToWin: false,
  },
  marketContext: {
    overallTrend: "NEUTRAL",
    volatility: "LOW",
    newsEvent: false,
  },
  ...extra,
});
describe("financial definitions", () => {
  it("calculates decimal long/short net with multiplier and fees", () => {
    expect(
      calculatedPnl(
        trade(0, {
          entryPrice: 0.1,
          exitPrice: 0.3,
          quantity: 3,
          brokerage: 0.1,
        }),
      ),
    ).toBe(0.5);
    expect(
      calculatedPnl(
        trade(0, {
          side: "SHORT",
          entryPrice: 100,
          exitPrice: 90,
          quantity: 2,
          multiplier: 5,
          brokerage: 3,
          charges: 2,
        }),
      ),
    ).toBe(95);
  });
  it("handles empty, all-win, all-loss, and breakeven datasets", () => {
    expect(analytics([]).profitFactor).toBeNull();
    expect(analytics([trade(10)]).noLosses).toBe(true);
    expect(analytics([trade(-10)]).profitFactor).toBe(0);
    expect(analytics([trade(0)]).losses).toBe(0);
    expect(analytics([trade(0)]).breakevens).toBe(1);
  });
  it("uses all closed trades for win rate and expectancy", () => {
    const a = analytics([trade(100), trade(-40), trade(0)]);
    expect(a.totalPnl).toBe(60);
    expect(a.winRate).toBeCloseTo(100 / 3);
    expect(a.expectancy).toBe(20);
    expect(a.profitFactor).toBe(2.5);
    expect(
      (a.avgWin * a.wins) / a.count - (a.avgLoss * a.losses) / a.count,
    ).toBeCloseTo(a.expectancy);
  });
  it("does not fabricate risk; direction and fees are reflected", () => {
    expect(rMultiple(trade(100))).toBeNull();
    expect(rMultiple(trade(100, { stopLoss: 100 }))).toBeNull();
    expect(rMultiple(trade(100, { stopLoss: 110 }))).toBeNull();
    expect(rMultiple(trade(95, { side: "SHORT", stopLoss: 105 }))).toBe(1.9);
  });
  it("excludes open, partial and invalid exits", () => {
    expect(
      analytics([
        trade(10),
        trade(999, { status: "OPEN" }),
        trade(999, { status: "PARTIAL" }),
        trade(999, { exitTime: "invalid" }),
      ]).totalPnl,
    ).toBe(10);
  });
  it("sorts exits and groups simultaneous exits", () => {
    const a = analytics([
      trade(-50, { exitTime: "2026-01-02T09:00:00Z" }),
      trade(100),
      trade(-30),
    ]);
    expect(a.equityCurve.map((p) => p.equity)).toEqual([70, 20]);
    expect(a.maxDrawdown).toBe(50);
    expect(a.currentDrawdown).toBe(50);
  });
  it("handles initial losses and recovery duration", () => {
    const a = analytics([
      trade(-40),
      trade(10, { exitTime: "2026-01-02T09:00:00Z" }),
      trade(50, { exitTime: "2026-01-03T09:00:00Z" }),
    ]);
    expect(a.maxDrawdown).toBe(40);
    expect(a.currentDrawdown).toBe(0);
    expect(a.maxDurationMs).toBe(172800000);
    expect(a.maxRecoveryMs).toBe(172800000);
  });
  it("resets streaks at breakeven", () => {
    const a = analytics(
      [1, 2, 0, -1, -2, -3, 1].map((p, i) =>
        trade(p, { exitTime: `2026-01-0${i + 1}T09:00:00Z` }),
      ),
    );
    expect([a.maxWins, a.maxLosses, a.currentWins, a.currentLosses]).toEqual([
      2, 3, 1, 0,
    ]);
  });
  it("buckets across UTC midnight in IST", () => {
    expect(dayKey("2026-01-01T20:00:00Z")).toBe("2026-01-02");
    expect(dayKey("bad")).toBe("");
  });
  it("reconciles calendar, equity, strategy, filters and edits/deletes", () => {
    let rows = [
      trade(100),
      trade(-40, { setupType: "Reversal", symbol: "OTHER" }),
      trade(0),
    ];
    const a = analytics(rows);
    expect(a.daily.reduce((s, d) => s + d.totalPnl, 0)).toBe(a.totalPnl);
    expect(a.equityCurve.at(-1)?.equity).toBe(a.totalPnl);
    expect(a.strategies.reduce((s, d) => s + d.totalPnl, 0)).toBe(a.totalPnl);
    expect(
      analytics(filterTrades(rows, { setupType: "Breakout" })).totalPnl,
    ).toBe(100);
    expect(filterTrades(rows, { from: "2026-02-01" })).toHaveLength(0);
    rows[0] = { ...rows[0], pnl: 200 };
    expect(analytics(rows).totalPnl).toBe(160);
    rows = rows.slice(1);
    expect(analytics(rows).totalPnl).toBe(-40);
  });
  it("handles 10000 trades with exact cent aggregation", () => {
    expect(
      summarize(Array.from({ length: 10000 }, () => trade(0.1))).totalPnl,
    ).toBe(1000);
  });
  it("risk limits include boundaries and exclude future data", () => {
    const settings = {
      dailyLossLimit: 100,
      singleTradeLossLimit: 100,
      monthlyLossLimit: 500,
    } as UserSettings;
    const r = evaluateRisk(
      [trade(-100), trade(-900, { exitTime: "2027-01-01T10:00:00Z" })],
      settings,
      new Date("2026-01-01T12:00:00Z"),
    );
    expect(r.isDailyBreached).toBe(true);
    expect(r.isSingleBreached).toBe(true);
    expect(r.monthlyNet).toBe(-100);
    expect(r.isLocked).toBe(false);
    expect(
      evaluateRisk([], { ...settings, dailyLossLimit: 0 }, new Date())
        .isDailyBreached,
    ).toBe(false);
  });
});
it("all supported filters select a single consistent population", () => {
  const rows = [
    trade(10, {
      symbol: "ONE",
      side: "SHORT",
      setupType: "S",
      marketCondition: "CHOPPY",
      mistakes: ["FOMO"],
    }),
    trade(-20, { symbol: "TWO" }),
  ];
  expect(
    filterTrades(rows, {
      symbol: "ONE",
      side: "SHORT",
      setupType: "S",
      emotion: "CALM",
      marketCondition: "CHOPPY",
      mistake: "FOMO",
      from: "2026-01-01",
      to: "2026-01-01",
    }),
  ).toHaveLength(1);
});
it("risk entry limits are journal warnings at their boundaries", () => {
  const settings = {
    dailyLossLimit: 1000,
    singleTradeLossLimit: 1000,
    monthlyLossLimit: 1000,
    maxTradesPerDay: 2,
    maxConsecutiveLosses: 2,
    maxRiskPerTrade: 50,
  } as UserSettings;
  const rows = [
    trade(-10, { stopLoss: 95 }),
    trade(-20, { stopLoss: 95, exitTime: "2026-01-01T10:00:00Z" }),
  ];
  const r = evaluateRisk(rows, settings, new Date("2026-01-01T12:00:00Z"));
  expect(r.isTradeCountBreached).toBe(true);
  expect(r.isConsecutiveBreached).toBe(true);
  expect(r.isRiskBreached).toBe(true);
  expect(r.isLocked).toBe(false);
});
