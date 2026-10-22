import { useMemo, useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  subMonths,
  addMonths,
  startOfWeek,
  endOfWeek,
  isSameMonth,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Trade } from "../types";
import { analytics, dayKey, sum, filterTrades } from "../lib/tradingAnalytics";
import { Panel, money } from "./ui/WorkspaceUI";
export default function CalendarHeatmap({
  trades,
  initialOffset = 0,
  onSelectDate,
  selectedDate,
}: {
  trades: Trade[];
  initialOffset?: number;
  onSelectDate?: (date: string) => void;
  selectedDate?: string;
}) {
  const [month, setMonth] = useState(
      subMonths(new Date(dayKey(new Date()) + "T12:00:00"), initialOffset),
    ),
    [selected, setSelected] = useState("");
  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
      }),
    [month],
  );
  const daily = useMemo(
    () => Object.fromEntries(analytics(trades).daily.map((d) => [d.name, d])),
    [trades],
  );
  const monthRows = Object.values(daily).filter((d) =>
    d.name.startsWith(format(month, "yyyy-MM")),
  );
  const current = selectedDate ?? selected;
  return (
    <Panel
      title={format(month, "MMMM yyyy")}
      subtitle="Realized results · INR · IST"
      action={
        <div className="flex gap-1">
          <button
            className="icon-button"
            aria-label="Previous month"
            onClick={() => setMonth(subMonths(month, 1))}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="icon-button"
            aria-label="Next month"
            onClick={() => setMonth(addMonths(month, 1))}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      }
    >
      <div className="calendar-grid">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <span className="calendar-weekday" key={d}>
            {d}
          </span>
        ))}
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd"),
            row = daily[key],
            active = isSameMonth(d, month);
          return (
            <button
              key={key}
              disabled={!active}
              aria-label={`${key}, ${row?.count ?? 0} trades, ${money(row?.totalPnl ?? 0)}`}
              aria-pressed={current === key}
              className={`calendar-day ${active ? "" : "outside"} ${row ? (row.totalPnl > 0 ? "positive" : row.totalPnl < 0 ? "negative" : "flat") : ""} ${current === key ? "selected" : ""}`}
              onClick={() => {
                setSelected(key);
                onSelectDate?.(key);
              }}
            >
              <span>{format(d, "d")}</span>
              {row ? (
                <>
                  <strong>
                    {row.totalPnl > 0 ? "+" : ""}
                    {money(row.totalPnl)}
                  </strong>
                  <small>
                    {row.count} {row.count === 1 ? "trade" : "trades"}
                  </small>
                </>
              ) : (
                <small>—</small>
              )}
            </button>
          );
        })}
      </div>
      <div className="calendar-footer">
        <span>
          Monthly net{" "}
          <strong
            className={
              sum(monthRows.map((r) => r.totalPnl)) < 0 ? "loss" : "profit"
            }
          >
            {money(sum(monthRows.map((r) => r.totalPnl)))}
          </strong>
        </span>
        <span>
          {monthRows.reduce((n, r) => n + r.count, 0)} trades ·{" "}
          {monthRows.length} active days
        </span>
      </div>
      {current && !onSelectDate && (
        <div className="calendar-selection">
          <h4>{current}</h4>
          <p>
            {daily[current]?.count ?? 0} trades ·{" "}
            {money(daily[current]?.totalPnl ?? 0)}
          </p>
          <div className="compact-list">
            {filterTrades(trades, { from: current, to: current }).map((t) => (
              <div key={t.id} className="flex justify-between py-2 text-sm">
                <span>{t.symbol}</span>
                <b>{money(t.pnl)}</b>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}
