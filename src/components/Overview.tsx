import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  ArrowUpRight,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import type { Trade, UserSettings } from "../types";
import { analytics, displayRatio, dayKey } from "../lib/tradingAnalytics";
import { reviewProgress } from "../lib/journalWorkflow";
import { useRiskManager } from "../hooks/useRiskManager";
import { Panel, Metric, EmptyState, money } from "./ui/WorkspaceUI";
import DailyHabits from "./DailyHabits";
export default function Overview({
  trades,
  settings,
  onAdd,
  onNavigate,
  onReview,
  onDismiss,
}: {
  trades: Trade[];
  settings: UserSettings;
  onAdd: () => void;
  onNavigate: (tab: string) => void;
  onReview: (t: Trade) => void;
  onDismiss: () => void;
}) {
  const a = useMemo(() => analytics(trades), [trades]),
    progress = reviewProgress(trades),
    risk = useRiskManager(trades, settings);
  const pending = trades.filter((t) => t.review?.status !== "REVIEWED");
  const breached =
    risk.isDailyBreached ||
    risk.isMonthlyBreached ||
    risk.isSingleBreached ||
    risk.isRiskBreached ||
    risk.isConsecutiveBreached ||
    risk.isTradeCountBreached;
  return (
    <div className="workspace-stack">
      {!settings.welcomeDismissed && (
        <div className="welcome-panel">
          <div>
            <span className="eyebrow">A clearer trading routine</span>
            <h2>Record the trade. Review the decision.</h2>
            <p>
              Start with a quick entry, set your risk rules, then reflect on
              what worked.
            </p>
            <div className="welcome-steps">
              <span>
                <CheckCircle2 size={16} />
                {trades.length
                  ? "First trade recorded"
                  : "1. Log your first trade"}
              </span>
              <button onClick={() => onNavigate("risk")}>
                2. Set risk limits <ArrowUpRight size={14} />
              </button>
              <button onClick={() => onNavigate("notebook")}>
                3. Write your daily review <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
          <button className="btn-secondary" onClick={onDismiss}>
            Dismiss welcome
          </button>
        </div>
      )}
      <div className="section-intro">
        <div>
          <span className="eyebrow">Account overview</span>
          <h2>Your trading, in perspective</h2>
          <p>All-time closed trades. Review the process behind the numbers.</p>
        </div>
        <span className="context-pill">INR · IST trading days</span>
      </div>
      <div className="metric-grid">
        <Metric
          label="Net P&L"
          value={money(a.totalPnl)}
          help="Realized net results after recorded fees, across valid closed trades."
        />
        <Metric
          label="Win rate"
          value={`${a.winRate.toFixed(1)}%`}
          help="Winning closed trades divided by all closed trades, including breakevens."
        />
        <Metric
          label="Profit factor"
          value={displayRatio(a.profitFactor, a.noLosses)}
          help="Positive net outcomes divided by absolute negative net outcomes. No losses is not a finite ratio."
        />
        <Metric
          label="Expectancy"
          value={money(a.expectancy)}
          help="Average realized net P&L per closed trade."
        />
      </div>
      <div className="overview-grid">
        <Panel
          title="Performance over time"
          subtitle="Cumulative realized net P&L"
          action={
            <button
              className="text-button"
              onClick={() => onNavigate("analytics")}
            >
              Explore analytics <ArrowUpRight size={16} />
            </button>
          }
        >
          {a.count ? (
            <div className="overview-chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={a.equityCurve}>
                  <CartesianGrid
                    stroke="#25303c"
                    vertical={false}
                    strokeDasharray="4 4"
                  />
                  <XAxis
                    dataKey="date"
                    stroke="#8795a6"
                    fontSize={11}
                    tickFormatter={(v) => String(v).slice(5)}
                  />
                  <YAxis stroke="#8795a6" fontSize={11} width={60} />
                  <Tooltip
                    formatter={(v) => money(Number(v))}
                    contentStyle={{
                      background: "#17212b",
                      border: "1px solid #344252",
                      borderRadius: 12,
                    }}
                  />
                  <Area
                    isAnimationActive={false}
                    type="stepAfter"
                    dataKey="equity"
                    stroke="#44cfb3"
                    fill="#44cfb3"
                    fillOpacity={0.1}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              title="Your first trade starts the story"
              description="Log an entry to see your performance, review patterns and build your journal."
              action={
                <button className="btn-primary" onClick={onAdd}>
                  Add your first trade <ArrowRight size={16} />
                </button>
              }
            />
          )}
        </Panel>
        <div className="workspace-stack">
          <Panel
            title="Risk snapshot"
            action={
              <ShieldCheck size={19} className={breached ? "loss" : "profit"} />
            }
          >
            <span className={`badge ${breached ? "warning" : ""}`}>
              {breached ? "Review your limits" : "Within recorded limits"}
            </span>
            <div className="stat-pairs">
              <div>
                <span>Today’s net</span>
                <strong>{money(risk.dailyNet)}</strong>
              </div>
              <div>
                <span>Daily loss limit</span>
                <strong>{money(settings.dailyLossLimit)}</strong>
              </div>
              <div>
                <span>Current drawdown</span>
                <strong>{money(a.currentDrawdown)}</strong>
              </div>
            </div>
            <button className="text-button" onClick={() => onNavigate("risk")}>
              View risk rules <ArrowUpRight size={16} />
            </button>
            <p className="caption">
              Journal warnings only. No broker orders are blocked.
            </p>
          </Panel>
          <Panel
            title="Review progress"
            subtitle={`${progress.pending} trades waiting for your attention`}
          >
            <div className="progress-number">
              {progress.percent.toFixed(0)}
              <small>% reviewed</small>
            </div>
            <progress max={100} value={progress.percent} />
            <p className="caption">
              Your process target: {settings.reviewTarget ?? 80}% reviewed
            </p>
            <button
              className="text-button"
              onClick={() => onNavigate("reviews")}
            >
              Open review queue <ArrowUpRight size={16} />
            </button>
          </Panel>
        </div>
      </div>
      <div className="workspace-columns">
        <Panel
          title="Recent outcomes"
          subtitle="Your latest recorded trades"
          action={
            <button
              className="text-button"
              onClick={() => onNavigate("journal")}
            >
              View journal <ArrowUpRight size={16} />
            </button>
          }
        >
          <div className="compact-list">
            {trades
              .slice()
              .sort((a, b) => Date.parse(b.exitTime) - Date.parse(a.exitTime))
              .slice(0, 6)
              .map((t) => (
                <button key={t.id} onClick={() => onReview(t)}>
                  <span>
                    <b>{t.symbol}</b>
                    <small>
                      {t.side} · {t.setupType || "No setup"} ·{" "}
                      {dayKey(t.exitTime)}
                    </small>
                  </span>
                  <span className={t.pnl < 0 ? "loss" : "profit"}>
                    {money(t.pnl)}
                    <small>
                      {t.review?.status === "REVIEWED"
                        ? "Reviewed"
                        : "Needs review"}
                    </small>
                  </span>
                </button>
              ))}
            {!trades.length && (
              <p className="muted py-6">Your recent trades will appear here.</p>
            )}
          </div>
        </Panel>
        <DailyHabits />
      </div>
    </div>
  );
}
