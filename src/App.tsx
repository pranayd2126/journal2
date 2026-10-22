import { useState, useEffect, lazy, Suspense, useMemo } from "react";
import {
  BarChart3,
  BookOpen,
  ShieldAlert,
  Plus,
  LayoutDashboard,
  PieChart,
  CalendarDays,
  NotebookPen,
  Settings2,
  PanelLeftClose,
  PanelLeftOpen,
  CheckCheck,
  ArrowRight,
} from "lucide-react";
import Auth from "./components/Auth";
import Overview from "./components/Overview";
import TradeJournal from "./components/Trades/TradeJournal";
import JournalDashboard from "./components/JournalDashboard";
import CalendarHeatmap from "./components/CalendarHeatmap";
import RiskRules from "./components/RiskRules";
import WorkspaceSettings from "./components/WorkspaceSettings";
import QuickTrade from "./components/QuickTrade";
import TradeReview from "./components/TradeReview";
import Notebook from "./components/Notebook";
import {
  Notifications,
  Panel,
  EmptyState,
  Skeleton,
  notify,
  money,
} from "./components/ui/WorkspaceUI";
import { dbService } from "./services/dbService";
import type { Trade, UserSettings } from "./types";
import { dayKey, filterTrades } from "./lib/tradingAnalytics";
import { pageRows, reviewProgress } from "./lib/journalWorkflow";
const AnalyticsDashboard = lazy(
  () => import("./components/AnalyticsDashboard"),
);
const DEFAULT_SETTINGS: UserSettings = {
  userId: "",
  dailyLossLimit: 7000,
  singleTradeLossLimit: 5000,
  monthlyLossLimit: 15000,
  totalCapital: 100000,
  riskBaseCurrency: "INR",
  updatedAt: null,
  reviewTarget: 80,
  defaultRange: "all",
};
const tabs = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "journal", label: "Journal", icon: BookOpen },
  { id: "analytics", label: "Analytics", icon: PieChart },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "reviews", label: "Reviews", icon: CheckCheck },
  { id: "notebook", label: "Notebook", icon: NotebookPen },
  { id: "vault", label: "Journal Cards", icon: LayoutDashboard },
  { id: "risk", label: "Risk Rules", icon: ShieldAlert },
  { id: "settings", label: "Settings", icon: Settings2 },
];
export default function App() {
  const [user, setUser] = useState<any>(null),
    [loading, setLoading] = useState(true),
    [activeTab, setActiveTab] = useState("dashboard"),
    [trades, setTrades] = useState<Trade[]>([]),
    [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS),
    [error, setError] = useState("");
  const [collapsed, setCollapsed] = useState(false),
    [quick, setQuick] = useState(false),
    [review, setReview] = useState<Trade | null>(null),
    [entryRequest, setEntryRequest] = useState(false),
    [selectedDay, setSelectedDay] = useState(dayKey(new Date())),
    [reviewPage, setReviewPage] = useState(1),
    [reviewFilter, setReviewFilter] = useState("PENDING");
  useEffect(() => {
    dbService.restoreSession().then((saved) => {
      if (saved) {
        setUser(saved);
        fetchUserData(saved.id);
      } else setLoading(false);
    });
    const expired = () => {
      setUser(null);
      setTrades([]);
      setSettings(DEFAULT_SETTINGS);
      setQuick(false);
      setReview(null);
      notify("Session expired. Please sign in again.", "error");
    };
    window.addEventListener("session-expired", expired);
    return () => window.removeEventListener("session-expired", expired);
  }, []);
  async function fetchUserData(userId: string) {
    try {
      const [rows, preferences] = await Promise.all([
        dbService.getCollection<Trade>("trades"),
        dbService.getDocument<UserSettings>("settings", "current"),
      ]);
      setTrades(rows);
      setSettings({ ...DEFAULT_SETTINGS, ...preferences, userId });
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  function login(value: any) {
    setUser(value);
    setLoading(true);
    fetchUserData(value.id);
  }
  async function logout() {
    try {
      await dbService.logout();
      setUser(null);
      setTrades([]);
      setSettings(DEFAULT_SETTINGS);
      setActiveTab("dashboard");
      setQuick(false);
      setReview(null);
    } catch {
      notify("Logout failed. Try again.", "error");
    }
  }
  function navigate(tab: string) {
    if (
      !window.dispatchEvent(new Event("journal-navigate", { cancelable: true }))
    )
      return;
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function update(t: Trade) {
    setTrades((prev) => prev.map((p) => (p.id === t.id ? t : p)));
  }
  function add(t: Trade) {
    setTrades((prev) =>
      prev.some((p) => p.id === t.id) ? prev : [t, ...prev],
    );
  }
  const progress = reviewProgress(trades),
    queue = pageRows(
      trades.filter(
        (t) =>
          reviewFilter === "ALL" ||
          (reviewFilter === "REVIEWED"
            ? t.review?.status === "REVIEWED"
            : t.review?.status !== "REVIEWED"),
      ),
      reviewPage,
      20,
    );
  const dailyTrades = useMemo(
    () => filterTrades(trades, { from: selectedDay, to: selectedDay }),
    [trades, selectedDay],
  );
  if (loading)
    return (
      <div className="boot-shell">
        <span className="brand-mark">J2</span>
        <p>Opening your journal</p>
        <Skeleton />
      </div>
    );
  if (!user)
    return (
      <>
        <div className="auth-shell">
          <div className="auth-brand">
            <span className="brand-mark">J2</span>
            <span>
              Journal<span className="profit">2</span>
            </span>
          </div>
          <Auth user={null} onLogin={login} onLogout={logout} />
        </div>
        <Notifications />
      </>
    );
  return (
    <div className={`app-shell ${collapsed ? "rail-collapsed" : ""}`}>
      <a className="skip-link" href="#workspace-main">
        Skip to content
      </a>
      <aside className="workspace-sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark">J2</span>
          <div>
            <strong>Journal2</strong>
            <small>Trade with perspective</small>
          </div>
        </div>
        <div className="sidebar-caption">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              aria-label={tab.label}
              aria-current={activeTab === tab.id ? "page" : undefined}
              onClick={() => navigate(tab.id)}
              title={collapsed ? tab.label : undefined}
            >
              <tab.icon size={19} />
              <span>{tab.label}</span>
              {tab.id === "reviews" && progress.pending > 0 && (
                <b className="nav-count">{progress.pending}</b>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="account-avatar">
            {(user.name || "T").slice(0, 1).toUpperCase()}
          </div>
          <div className="account-label">
            <strong>{user.name || "Trader"}</strong>
            <small>Personal journal · INR</small>
          </div>
          <Auth user={user} onLogin={login} onLogout={logout} />
        </div>
      </aside>
      <main id="workspace-main" className="workspace-main">
        <header className="workspace-header">
          <div className="header-title">
            <button
              className="icon-button collapse-control"
              aria-label={
                collapsed ? "Expand navigation" : "Collapse navigation"
              }
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? (
                <PanelLeftOpen size={20} />
              ) : (
                <PanelLeftClose size={20} />
              )}
            </button>
            <div>
              <span className="header-breadcrumb">
                Workspace <span>/</span>
              </span>
              <h1>{tabs.find((t) => t.id === activeTab)?.label}</h1>
            </div>
          </div>
          <div className="header-actions">
            <button
              className="mobile-logout btn-secondary"
              title="Logout"
              onClick={logout}
            >
              Sign out
            </button>
            <span className="live-context">
              <i />
              Personal trading journal
            </span>
            <button className="btn-primary" onClick={() => setQuick(true)}>
              <Plus size={17} />
              New Trade
            </button>
          </div>
        </header>
        <div className="workspace-content">
          {error && (
            <div role="alert" className="error-banner">
              {error}
              <button
                className="text-button"
                onClick={() => fetchUserData(user.id)}
              >
                Retry
              </button>
            </div>
          )}
          {activeTab === "dashboard" && (
            <Overview
              trades={trades}
              settings={settings}
              onAdd={() => setQuick(true)}
              onNavigate={navigate}
              onReview={setReview}
              onDismiss={async () => {
                const value = { ...settings, welcomeDismissed: true };
                try {
                  await dbService.setDocument("settings", "current", value);
                  setSettings(value);
                } catch (e) {
                  notify((e as Error).message, "error");
                }
              }}
            />
          )}
          {activeTab === "journal" && (
            <TradeJournal
              trades={trades}
              settings={settings}
              openRequested={entryRequest}
              onOpenHandled={() => setEntryRequest(false)}
              onReview={setReview}
              onTradeAdded={(t) => {
                add(t);
                notify("Trade saved");
              }}
              onTradeUpdated={(t) => {
                update(t);
                notify("Trade updated");
              }}
              onTradeDeleted={(id) => {
                setTrades((prev) => prev.filter((t) => t.id !== id));
                notify("Trade deleted");
              }}
            />
          )}
          {activeTab === "analytics" && (
            <Suspense fallback={<Skeleton />}>
              <AnalyticsDashboard
                trades={trades}
                defaultRange={settings.defaultRange}
              />
            </Suspense>
          )}
          {activeTab === "vault" && <JournalDashboard trades={trades} />}
          {activeTab === "risk" && (
            <RiskRules
              trades={trades}
              settings={settings}
              onSettingsUpdate={(s) => {
                setSettings(s);
                notify("Risk settings saved");
              }}
            />
          )}
          {activeTab === "settings" && (
            <WorkspaceSettings settings={settings} onSave={setSettings} />
          )}
          {activeTab === "calendar" && (
            <div className="workspace-stack">
              <div className="section-intro">
                <div>
                  <span className="eyebrow">Every day has a story</span>
                  <h2>Trading calendar</h2>
                  <p>
                    Select a day to review its trades or add your daily
                    reflection.
                  </p>
                </div>
              </div>
              <CalendarHeatmap
                trades={trades}
                selectedDate={selectedDay}
                onSelectDate={setSelectedDay}
              />
              <Panel
                title={selectedDay}
                subtitle={`${dailyTrades.length} closed trades · exit date in IST`}
                action={
                  <button
                    className="btn-secondary"
                    onClick={() => navigate("notebook")}
                  >
                    Write daily notes <ArrowRight size={16} />
                  </button>
                }
              >
                <div className="compact-list">
                  {dailyTrades.map((t) => (
                    <button key={t.id} onClick={() => setReview(t)}>
                      <span>
                        {t.symbol}
                        <small>{t.setupType || "No setup"}</small>
                      </span>
                      <strong className={t.pnl < 0 ? "loss" : "profit"}>
                        {money(t.pnl)}
                      </strong>
                    </button>
                  ))}
                  {!dailyTrades.length && (
                    <p className="muted py-5">
                      No closed trades on this date. Use daily notes for
                      preparation or observations.
                    </p>
                  )}
                </div>
              </Panel>
            </div>
          )}
          {activeTab === "notebook" && (
            <Notebook
              trades={trades}
              date={selectedDay}
              onOpenTrade={setReview}
            />
          )}
          {activeTab === "reviews" && (
            <div className="workspace-stack">
              <div className="section-intro">
                <div>
                  <span className="eyebrow">Build a better next trade</span>
                  <h2>Your review queue</h2>
                  <p>
                    {progress.reviewed} reviewed · {progress.pending} pending.
                    Reflect on execution, not just the outcome.
                  </p>
                </div>
                <label className="sr-only" htmlFor="review-filter">
                  Review queue filter
                </label>
                <select
                  id="review-filter"
                  value={reviewFilter}
                  onChange={(e) => {
                    setReviewFilter(e.target.value);
                    setReviewPage(1);
                  }}
                >
                  <option value="PENDING">Pending reviews</option>
                  <option value="REVIEWED">Reviewed trades</option>
                  <option value="ALL">All trades</option>
                </select>
              </div>
              <Panel title="Trade reviews">
                {queue.total ? (
                  <>
                    <div className="compact-list">
                      {queue.rows.map((t) => (
                        <button key={t.id} onClick={() => setReview(t)}>
                          <span>
                            <b>{t.symbol}</b>
                            <small>
                              {t.setupType || "No setup"} · {dayKey(t.exitTime)}
                            </small>
                          </span>
                          <span className="badge">
                            {t.review?.status === "REVIEWED"
                              ? "Reviewed"
                              : "Pending"}
                          </span>
                          <strong className={t.pnl < 0 ? "loss" : "profit"}>
                            {money(t.pnl)}
                          </strong>
                          <ArrowRight size={16} />
                        </button>
                      ))}
                    </div>
                    <div className="pagination">
                      <button
                        className="btn-secondary"
                        disabled={queue.current === 1}
                        onClick={() => setReviewPage(queue.current - 1)}
                      >
                        Previous page
                      </button>
                      <span>
                        {queue.current} / {queue.pages}
                      </span>
                      <button
                        className="btn-secondary"
                        disabled={queue.current === queue.pages}
                        onClick={() => setReviewPage(queue.current + 1)}
                      >
                        Next page
                      </button>
                    </div>
                  </>
                ) : (
                  <EmptyState
                    title="You’re all caught up"
                    description="No trades match this review status. Switch the filter or record your next trade."
                  />
                )}
              </Panel>
            </div>
          )}
        </div>
        <footer className="workspace-footer">
          Your records. Your process.{" "}
          <span>INR accounting · IST reporting</span>
        </footer>
      </main>
      {quick && (
        <QuickTrade
          onClose={() => setQuick(false)}
          onSaved={add}
          onDetailed={() => {
            setQuick(false);
            setEntryRequest(true);
            navigate("journal");
          }}
        />
      )}
      {review && (
        <TradeReview
          trade={review}
          onSave={update}
          onClose={() => setReview(null)}
        />
      )}
      <Notifications />
    </div>
  );
}
