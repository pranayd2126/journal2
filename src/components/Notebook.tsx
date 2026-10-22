import { useUnsavedChanges } from "../hooks/useUnsavedChanges";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Trade, NotebookEntry } from "../types";
import { dbService } from "../services/dbService";
import { periodBounds, periodSummary } from "../lib/journalWorkflow";
import { dayKey, groupTrades } from "../lib/tradingAnalytics";
import { Panel, Metric, money, notify, Skeleton } from "./ui/WorkspaceUI";
import DailyHabits from "./DailyHabits";
const blank = (kind: NotebookEntry["kind"], period: string): NotebookEntry => ({
  kind,
  period,
  notes: "",
  observations: "",
  lesson: "",
  focus: "",
  reviewed: false,
});
export default function Notebook({
  trades,
  date: initialDate,
  onOpenTrade,
}: {
  trades: Trade[];
  date?: string;
  onOpenTrade?: (t: Trade) => void;
}) {
  const [kind, setKind] = useState<NotebookEntry["kind"]>("DAY"),
    [date, setDate] = useState(initialDate ?? dayKey(new Date()));
  const [entries, setEntries] = useState<NotebookEntry[]>([]),
    [value, setValue] = useState<NotebookEntry>(blank("DAY", date));
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const dirty = useRef(false);
  useUnsavedChanges(dirty.current);
  const summary = useMemo(
    () => periodSummary(trades, kind, date),
    [trades, kind, date],
  );
  useEffect(() => {
    dbService
      .getCollection<NotebookEntry>("notebook")
      .then((rows) => {
        setEntries(rows);
        setValue(
          rows.find((e) => e.kind === "DAY" && e.period === date) ??
            blank("DAY", date),
        );
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  function changePeriod(nextKind: NotebookEntry["kind"], nextDate: string) {
    if (busy) return;
    if (dirty.current && !window.confirm("Discard unsaved review changes?"))
      return;
    const period = periodBounds(nextKind, nextDate).from;
    setValue(
      entries.find((e) => e.kind === nextKind && e.period === period) ??
        blank(nextKind, period),
    );
    dirty.current = false;
    setKind(nextKind);
    setDate(nextDate);
    setError("");
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const saved = await dbService.saveNotebook(value);
      dirty.current = false;
      setValue(saved);
      setEntries((prev) => [
        ...prev.filter(
          (n) => !(n.kind === saved.kind && n.period === saved.period),
        ),
        saved,
      ]);
      notify("Journal review saved");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const strategies = groupTrades(summary.rows, (t) => t.setupType).sort(
    (a, b) => b.totalPnl - a.totalPnl,
  );
  if (loading) return <Skeleton />;
  return (
    <div className="workspace-stack">
      <div className="section-intro">
        <div>
          <span className="eyebrow">Prepare · reflect · improve</span>
          <h2>Your trading notebook</h2>
          <p>
            One place for daily context and weekly or monthly reflection. No
            generated advice.
          </p>
        </div>
      </div>
      <div className="filter-bar">
        <div className="segmented">
          {(["DAY", "WEEK", "MONTH"] as const).map((k) => (
            <button
              key={k}
              disabled={busy}
              aria-pressed={k === kind}
              onClick={() => changePeriod(k, date)}
            >
              {k === "DAY" ? "Daily" : k === "WEEK" ? "Weekly" : "Monthly"}
            </button>
          ))}
        </div>
        <label>
          Period date
          <input
            type="date"
            disabled={busy}
            required
            value={date}
            onChange={(e) =>
              e.target.value && changePeriod(kind, e.target.value)
            }
          />
        </label>
        <span className="muted">
          {summary.from} — {summary.to} · IST
        </span>
      </div>
      <div className="metric-grid">
        <Metric label="Period net P&L" value={money(summary.stats.totalPnl)} />
        <Metric label="Trades" value={String(summary.stats.count)} />
        <Metric label="Expectancy" value={money(summary.stats.expectancy)} />
        <Metric
          label="Reviewed trades"
          value={`${summary.progress.reviewed}/${summary.progress.count}`}
        />
      </div>
      <div className="workspace-columns">
        <Panel
          title="Reflection"
          subtitle="Save your observations separately from trade notes."
        >
          <form className="form-stack" onSubmit={save}>
            {(
              [
                ["notes", "Journal notes"],
                ["observations", "Market observations / what worked"],
                ["lesson", "Lessons and mistakes"],
                ["focus", "One focus for the next period"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <textarea
                  maxLength={key === "notes" ? 10000 : 4000}
                  value={value[key]}
                  onChange={(e) => {
                    dirty.current = true;
                    setValue({ ...value, [key]: e.target.value });
                  }}
                  placeholder={
                    key === "focus"
                      ? "A specific action you can follow through on"
                      : undefined
                  }
                />
              </label>
            ))}
            <label className="check-label">
              <input
                type="checkbox"
                disabled={busy}
                checked={value.reviewed}
                onChange={(e) => {
                  dirty.current = true;
                  setValue({ ...value, reviewed: e.target.checked });
                }}
              />
              Mark this period reviewed
            </label>
            {error && (
              <p role="alert" className="loss">
                {error}
              </p>
            )}
            <button className="btn-primary" disabled={busy}>
              {busy ? "Saving…" : "Save journal review"}
            </button>
          </form>
        </Panel>
        <div className="workspace-stack">
          <Panel
            title="Period evidence"
            subtitle="Calculated from the same closed-trade population."
          >
            {strategies.length ? (
              <>
                <p className="muted">
                  Best setup by net: <strong>{strategies[0].name}</strong> (
                  {money(strategies[0].totalPnl)}, n={strategies[0].count})
                </p>
                <p className="muted">
                  Lowest setup by net:{" "}
                  <strong>{strategies.at(-1)!.name}</strong> (
                  {money(strategies.at(-1)!.totalPnl)})
                </p>
                <div className="compact-list">
                  {summary.rows
                    .slice(-12)
                    .reverse()
                    .map((t) => (
                      <button key={t.id} onClick={() => onOpenTrade?.(t)}>
                        <span>
                          {t.symbol}
                          <small>{t.setupType || "Uncategorized"}</small>
                        </span>
                        <b className={t.pnl < 0 ? "loss" : "profit"}>
                          {money(t.pnl)}
                        </b>
                      </button>
                    ))}
                </div>
                <p className="caption">
                  Showing up to 12 recent trades. Summary uses all{" "}
                  {summary.stats.count}.
                </p>
              </>
            ) : (
              <p className="muted">
                No closed trades in this period. You can still save preparation
                notes.
              </p>
            )}
          </Panel>
          {kind === "DAY" && <DailyHabits key={date} date={date} />}
          <Panel title="Your review history">
            <div className="compact-list">
              {entries
                .slice()
                .sort((a, b) => b.period.localeCompare(a.period))
                .slice(0, 12)
                .map((e) => (
                  <button
                    key={e.id}
                    onClick={() => changePeriod(e.kind, e.period)}
                  >
                    <span>
                      {e.period}
                      <small>{e.kind.toLowerCase()}</small>
                    </span>
                    <span className="badge">
                      {e.reviewed ? "Reviewed" : "Draft"}
                    </span>
                  </button>
                ))}
              {!entries.length && (
                <p className="muted">Your saved periods will appear here.</p>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
