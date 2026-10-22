import { useMemo, useState, type ReactNode } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { Trade } from "../types";
import {
  entryBucket,
  analytics,
  filterTrades,
  groupTrades,
  distribution,
  rMultiple,
  displayRatio,
  dayKey,
  TRADING_TIMEZONE,
  type Filters,
} from "../lib/tradingAnalytics";
import { pageRows } from "../lib/journalWorkflow";
import CalendarHeatmap from "./CalendarHeatmap";
export default function AnalyticsDashboard({
  trades,
  defaultRange = "all",
}: {
  trades: Trade[];
  defaultRange?: "all" | "30d" | "month";
}) {
  const range = (value: string): Filters => {
    const to = dayKey(new Date());
    const d = new Date(to + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 29);
    return value === "all"
      ? {}
      : {
          from:
            value === "month"
              ? to.slice(0, 7) + "-01"
              : d.toISOString().slice(0, 10),
          to,
        };
  };
  const [filters, setFilters] = useState<Filters>(() => range(defaultRange));
  const rows = useMemo(() => filterTrades(trades, filters), [trades, filters]);
  const a = useMemo(() => analytics(rows), [rows]);
  const [sourcePage, setSourcePage] = useState(1);
  const source = pageRows(rows, sourcePage, 20);
  const [section, setSection] = useState("Performance");
  const set = (key: keyof Filters, value: string) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const groups = (key: (t: Trade) => string) => groupTrades(rows, key);
  const mistakes = [...new Set(rows.flatMap((t) => t.mistakes ?? []))].map(
    (name) => ({
      name,
      with: analytics(rows.filter((t) => t.mistakes?.includes(name))),
      without: analytics(rows.filter((t) => !t.mistakes?.includes(name))),
    }),
  );
  const rs = rows.map(rMultiple).filter((r): r is number => r !== null);
  return (
    <div className="space-y-6 pb-12">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 flex flex-wrap gap-3">
        <select
          aria-label="Date shortcut"
          defaultValue={defaultRange}
          onChange={(e) =>
            setFilters({
              ...filters,
              from: "",
              to: "",
              ...range(e.target.value),
            })
          }
        >
          <option value="all">All time</option>
          <option value="30d">Last 30 days</option>
          <option value="month">This month</option>
        </select>
        <label className="text-xs">
          From (exit date)
          <input
            aria-label="From exit date"
            type="date"
            value={filters.from ?? ""}
            onChange={(e) => set("from", e.target.value)}
            className="block bg-zinc-900 p-2 rounded"
          />
        </label>
        <label className="text-xs">
          To (exit date)
          <input
            aria-label="To exit date"
            type="date"
            value={filters.to ?? ""}
            onChange={(e) => set("to", e.target.value)}
            className="block bg-zinc-900 p-2 rounded"
          />
        </label>
        <button
          onClick={() =>
            setFilters({
              ...filters,
              from: dayKey(new Date()).slice(0, 4) + "-01-01",
              to: dayKey(new Date()),
            })
          }
        >
          Year to date
        </button>
        {(
          [
            ["symbol", "Symbol", trades.map((t) => t.symbol)],
            ["setupType", "Strategy", trades.map((t) => t.setupType)],
            ["side", "Direction", ["LONG", "SHORT"]],
            ["emotion", "Emotion", trades.map((t) => t.psychology?.before)],
            ["mistake", "Mistake", trades.flatMap((t) => t.mistakes ?? [])],
            ["marketCondition", "Market", trades.map((t) => t.marketCondition)],
          ] as [keyof Filters, string, string[]][]
        ).map(([key, label, values]) => (
          <select
            key={key}
            aria-label={label}
            value={filters[key] ?? ""}
            onChange={(e) => set(key, e.target.value)}
            className="bg-zinc-900 p-2 rounded max-w-full"
          >
            <option value="">All {label.toLowerCase()}s</option>
            {[...new Set(values)]
              .filter(Boolean)
              .sort()
              .map((v) => (
                <option key={v}>{v}</option>
              ))}
          </select>
        ))}
        <button onClick={() => setFilters({})}>Reset filters</button>
      </div>
      <p className="text-xs text-zinc-400">
        {a.count} closed trades • Realized net P&L • {TRADING_TIMEZONE}.
        Breakevens are included in the win-rate denominator. Historical stored
        P&L is preserved.
      </p>
      {a.discrepancies > 0 && (
        <p role="status" className="text-amber-400">
          {a.discrepancies} trades differ from the linear price calculation.
          Review fees, multiplier and source data before changing historical
          P&L.
        </p>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ["Net P&L", money(a.totalPnl)],
          ["Win rate", `${a.winRate.toFixed(1)}%`],
          ["Expectancy", money(a.expectancy)],
          ["Profit factor", displayRatio(a.profitFactor, a.noLosses)],
          ["Maximum drawdown", money(a.maxDrawdown)],
          ["Current drawdown", money(a.currentDrawdown)],
          ["Average R", displayRatio(a.averageR) + ` (${a.rCount} trades)`],
          ["W / L / Breakeven", `${a.wins} / ${a.losses} / ${a.breakevens}`],
        ].map(([label, value]) => (
          <div
            key={label}
            className="p-4 bg-zinc-950 border border-zinc-900 rounded-2xl"
          >
            <p className="text-xs text-zinc-400">{label}</p>
            <p className="text-xl font-mono mt-2 break-words">{value}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {["Performance", "Breakdowns", "Behavior"].map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={`px-4 py-2 rounded-xl ${section === s ? "bg-blue-600" : "bg-zinc-900"}`}
          >
            {s}
          </button>
        ))}
      </div>
      {!rows.length ? (
        <p role="status" className="p-10 text-zinc-400">
          No closed trades match these filters. Adjust or reset the filters
          above.
        </p>
      ) : (
        <>
          {section === "Performance" && (
            <>
              <div className="grid lg:grid-cols-2 gap-4">
                <Chart title="Cumulative realized net P&L">
                  <AreaChart data={a.equityCurve}>
                    <Axes x="date" />
                    <Area
                      isAnimationActive={false}
                      type="stepAfter"
                      dataKey="equity"
                      stroke="#3b82f6"
                      fill="#1e3a5f"
                    />
                  </AreaChart>
                </Chart>
                <Chart title="Drawdown from cumulative P&L peak (₹)">
                  <AreaChart data={a.equityCurve}>
                    <Axes x="date" />
                    <Area
                      isAnimationActive={false}
                      type="stepAfter"
                      dataKey="drawdown"
                      stroke="#ef4444"
                      fill="#4c1d24"
                    />
                  </AreaChart>
                </Chart>
              </div>
              <div className="grid lg:grid-cols-2 gap-4">
                <CalendarHeatmap trades={rows} />
                <div className="space-y-3 p-6 bg-zinc-950 rounded-2xl text-sm">
                  <h3>Risk and consistency</h3>
                  <p>
                    Current win / loss streak: {a.currentWins} /{" "}
                    {a.currentLosses}
                  </p>
                  <p>
                    Maximum win / loss streak: {a.maxWins} / {a.maxLosses}
                  </p>
                  <p>
                    Longest observed drawdown:{" "}
                    {(a.maxDurationMs / 86400000).toFixed(1)} days
                  </p>
                  <p>
                    Current observed drawdown:{" "}
                    {(a.currentDurationMs / 86400000).toFixed(1)} days
                  </p>
                  <p>
                    Longest completed trough-to-recovery:{" "}
                    {(a.maxRecoveryMs / 86400000).toFixed(1)} days
                  </p>
                  <p>Recovery factor: {displayRatio(a.recoveryFactor)}</p>
                  <p className="text-zinc-500">
                    Duration ends at the last observed exit. No account-equity
                    percentage, Sharpe or Sortino is shown without a
                    cash-flow-adjusted equity history. Breakevens reset trade
                    streaks.
                  </p>
                </div>
              </div>
              <div className="grid lg:grid-cols-2 gap-4">
                <Bars
                  title="Trade net P&L distribution (count)"
                  data={distribution(rows.map((t) => t.pnl))}
                  value="count"
                />
                <Bars
                  title={`Realized R distribution (${rs.length} valid-risk trades)`}
                  data={distribution(rs, 1)}
                  value="count"
                />
                <Bars title="Daily realized net P&L" data={a.daily} />
                <Bars
                  title="Monthly realized net P&L"
                  data={groups((t) => dayKey(t.exitTime).slice(0, 7))}
                />
                <Bars
                  title="Weekly realized net P&L (Monday start)"
                  data={groups((t) => {
                    const d = new Date(dayKey(t.exitTime) + "T00:00:00Z");
                    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
                    return d.toISOString().slice(0, 10);
                  })}
                />
              </div>
            </>
          )}
          {section === "Breakdowns" && (
            <>
              <Table title="Strategy performance" data={a.strategies} />
              <div className="grid lg:grid-cols-2 gap-4">
                <Bars
                  title="Instrument net P&L"
                  data={groups((t) => t.symbol)}
                />
                <Bars title="Long versus short" data={groups((t) => t.side)} />
                <Bars
                  title="P&L by entry weekday"
                  data={groups((t) => entryBucket(t, "weekday"))}
                />
                <Bars
                  title="P&L by entry hour (IST)"
                  data={groups((t) => entryBucket(t, "hour")).sort((a, b) =>
                    a.name.localeCompare(b.name),
                  )}
                />
                <Bars
                  title="Trade count by entry hour (IST)"
                  data={groups((t) => entryBucket(t, "hour")).sort((a, b) =>
                    a.name.localeCompare(b.name),
                  )}
                  value="count"
                />
              </div>
              <Table
                title="Market condition"
                data={groups((t) => t.marketCondition)}
              />
            </>
          )}
          {section === "Behavior" && (
            <>
              <p className="text-sm text-zinc-400">
                Associations are not proof of causation. Compare sample sizes.
                Unrecorded behavior is kept separate; categories may overlap.
              </p>
              {(["before", "during", "after"] as const).map((stage) => (
                <Table
                  key={stage}
                  title={`Emotion ${stage}`}
                  data={groups((t) => t.psychology?.[stage])}
                />
              ))}
              <Table
                title="Plan adherence"
                data={groups((t) =>
                  flag(
                    t.executionQuality?.followedPlan,
                    "Followed plan",
                    "Violated plan",
                  ),
                )}
              />
              <Table
                title="Stop-loss adherence"
                data={groups((t) =>
                  flag(
                    t.executionQuality?.followedSL,
                    "Followed stop",
                    "Violated stop",
                  ),
                )}
              />
              <Table
                title="Reward/risk adherence"
                data={groups((t) =>
                  flag(
                    t.executionQuality?.respectedRR,
                    "Respected R:R",
                    "Violated R:R",
                  ),
                )}
              />
              <Table
                title="Revenge trades"
                data={groups((t) =>
                  flag(
                    t.psychology?.revengeTrade,
                    "Revenge",
                    "No recorded revenge",
                  ),
                )}
              />
              <Table
                title="Boredom trades"
                data={groups((t) =>
                  flag(
                    t.psychology?.boredomTrade,
                    "Boredom",
                    "No recorded boredom",
                  ),
                )}
              />
              <Table
                title="Entry execution quality"
                data={groups((t) => t.executionQuality?.entry)}
              />
              <Table
                title="Exit execution quality"
                data={groups((t) => t.executionQuality?.exit)}
              />
              <div className="overflow-x-auto bg-zinc-950 p-4 rounded-2xl">
                <h3>
                  Mistake associations — overlapping groups; do not add totals
                </h3>
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr>
                      {[
                        "Mistake",
                        "Tagged N",
                        "Tagged net",
                        "Tagged avg",
                        "Without N",
                        "Without avg",
                      ].map((h) => (
                        <th key={h} className="p-3">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mistakes.map((m) => (
                      <tr key={m.name}>
                        <td>{m.name}</td>
                        <td>{m.with.count}</td>
                        <td>{money(m.with.totalPnl)}</td>
                        <td>{money(m.with.expectancy)}</td>
                        <td>{m.without.count}</td>
                        <td>
                          {m.without.count
                            ? money(m.without.expectancy)
                            : "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
      <details className="panel">
        <summary className="cursor-pointer text-sm">
          Metric definitions & source trades ({rows.length})
        </summary>
        <p className="caption">
          Net P&L is realized after recorded fees. Win rate includes breakevens
          in its denominator. Expectancy is net P&L / closed trades. Profit
          factor compares total positive and absolute negative net outcomes.
          R-multiples exclude trades without valid initial risk. Drawdown is
          measured from cumulative realized peaks, not mark-to-market equity.
          Every table and chart uses the same filters above.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs mt-4">
            <thead>
              <tr>
                <th className="text-left p-2">Exit day (IST)</th>
                <th className="text-left p-2">Symbol</th>
                <th className="text-left p-2">Setup</th>
                <th className="text-right p-2">Net P&L</th>
              </tr>
            </thead>
            <tbody>
              {source.rows.map((t) => (
                <tr key={t.id} className="border-t border-zinc-800">
                  <td className="p-2">{dayKey(t.exitTime)}</td>
                  <td className="p-2">{t.symbol}</td>
                  <td className="p-2">{t.setupType || "Uncategorized"}</td>
                  <td className="p-2 text-right">{money(t.pnl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <button
            className="btn-secondary"
            disabled={source.current === 1}
            onClick={() => setSourcePage(source.current - 1)}
          >
            Previous source page
          </button>
          <span>
            {source.current}/{source.pages}
          </span>
          <button
            className="btn-secondary"
            disabled={source.current === source.pages}
            onClick={() => setSourcePage(source.current + 1)}
          >
            Next source page
          </button>
        </div>
      </details>
    </div>
  );
}
const flag = (value: boolean | undefined, yes: string, no: string) =>
  value === undefined ? "Unrecorded" : value ? yes : no;
const money = (v: number) =>
  `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
function Axes({ x = "name" }: { x?: string }) {
  return (
    <>
      <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
      <XAxis dataKey={x} stroke="#a1a1aa" fontSize={10} />
      <YAxis stroke="#a1a1aa" fontSize={10} />
      <Tooltip
        contentStyle={{ background: "#18181b", border: "1px solid #52525b" }}
      />
    </>
  );
}
function Chart({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0 bg-zinc-950 border border-zinc-900 p-4 rounded-2xl">
      <h3 className="text-sm text-zinc-400 mb-4">{title}</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          {children as any}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
function Bars({
  title,
  data,
  value = "totalPnl",
}: {
  title: string;
  data: any[];
  value?: string;
}) {
  return (
    <Chart title={title}>
      <BarChart data={data}>
        <Axes />
        <Bar isAnimationActive={false} dataKey={value}>
          {data.map((r, i) => (
            <Cell key={i} fill={r[value] < 0 ? "#ef4444" : "#3b82f6"} />
          ))}
        </Bar>
      </BarChart>
    </Chart>
  );
}
function Table({
  title,
  data,
}: {
  title: string;
  data: ReturnType<typeof groupTrades>;
}) {
  return (
    <div className="overflow-x-auto bg-zinc-950 rounded-2xl p-4">
      <h3 className="text-zinc-400 mb-4">{title}</h3>
      <table className="w-full text-sm text-left whitespace-nowrap">
        <thead>
          <tr>
            {[
              "Group",
              "Trades",
              "Net P&L",
              "Win %",
              "Expectancy",
              "Profit factor",
              "Average R",
              "Avg loss",
            ].map((h) => (
              <th key={h} className="p-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.name} className="border-t border-zinc-900">
              <td className="p-3">{r.name}</td>
              <td>{r.count}</td>
              <td>{money(r.totalPnl)}</td>
              <td>{r.winRate.toFixed(1)}</td>
              <td>{money(r.expectancy)}</td>
              <td>{displayRatio(r.profitFactor, r.noLosses)}</td>
              <td>
                {displayRatio(r.averageR)} ({r.rCount})
              </td>
              <td>{money(r.avgLoss)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
