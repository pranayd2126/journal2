import { it, expect } from "vitest";
import {
  periodBounds,
  periodSummary,
  journalRows,
  pageRows,
  reviewProgress,
} from "../src/lib/journalWorkflow";
import type { Trade } from "../src/types";
const rows = [
  {
    id: "a",
    symbol: "INDEX",
    setupType: "Breakout",
    pnl: 95,
    exitTime: "2026-10-18T19:00:00Z",
    entryTime: "2026-10-18T18:00:00Z",
    review: { status: "REVIEWED" },
    tags: ["patient"],
  },
  {
    id: "b",
    symbol: "BANK",
    setupType: "Pullback",
    pnl: -50,
    exitTime: "2026-10-20T09:00:00Z",
    entryTime: "2026-10-20T08:00:00Z",
  },
] as Trade[];
it("uses Monday weeks, leap months and year boundaries", () => {
  expect(periodBounds("WEEK", "2027-01-01")).toEqual({
    from: "2026-12-28",
    to: "2027-01-03",
  });
  expect(periodBounds("MONTH", "2024-02-20").to).toBe("2024-02-29");
  expect(() => periodBounds("DAY", "bad")).toThrow();
});
it("reconciles daily weekly monthly summaries using IST exit dates", () => {
  expect(periodSummary(rows, "DAY", "2026-10-19").stats.totalPnl).toBe(95);
  for (const kind of ["WEEK", "MONTH"] as const) {
    const s = periodSummary(rows, kind, "2026-10-20");
    expect(s.stats.totalPnl).toBe(45);
    expect(s.stats.count).toBe(2);
    expect(s.progress.percent).toBe(50);
  }
});
it("combines journal search outcome strategy and review filters", () => {
  expect(
    journalRows(rows, {
      search: "patient",
      review: "REVIEWED",
      outcome: "win",
      strategy: "Breakout",
    }).map((t) => t.id),
  ).toEqual(["a"]);
  expect(
    journalRows(rows, { review: "PENDING", outcome: "loss" }).map((t) => t.id),
  ).toEqual(["b"]);
  expect(journalRows(rows, { search: "missing" })).toEqual([]);
});
it("clamps pages after filtering and handles empty review populations", () => {
  expect(pageRows(rows, 99, 1).rows[0].id).toBe("b");
  expect(pageRows([], 5).current).toBe(1);
  expect(reviewProgress([]).percent).toBe(0);
});
it("bounds rendered pages without changing a large history total", () => {
  const history = Array.from({ length: 10000 }, (_, i) => ({
    ...rows[0],
    id: String(i),
    pnl: i % 2 ? -5 : 10,
  }));
  expect(pageRows(history, 2, 20).rows).toHaveLength(20);
  expect(periodSummary(history, "MONTH", "2026-10-01").stats.totalPnl).toBe(
    25000,
  );
  expect(journalRows(history, { outcome: "loss" })).toHaveLength(5000);
});
