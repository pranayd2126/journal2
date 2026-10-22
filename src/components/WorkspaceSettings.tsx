import { useUnsavedChanges } from "../hooks/useUnsavedChanges";
import { useState } from "react";
import type { UserSettings } from "../types";
import { dbService } from "../services/dbService";
import { Panel, notify } from "./ui/WorkspaceUI";
import AccountSettings from "./AccountSettings";
export default function WorkspaceSettings({
  settings,
  onSave,
}: {
  settings: UserSettings;
  onSave: (s: UserSettings) => void;
}) {
  const [value, setValue] = useState(settings),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useUnsavedChanges(JSON.stringify(value) !== JSON.stringify(settings));
  const plan = value.tradingPlan ?? {
    strategy: "",
    entry: "",
    exit: "",
    rules: "",
    focus: "",
  };
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await dbService.setDocument("settings", "current", value);
      onSave(value);
      notify("Settings and trading plan saved");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="workspace-stack">
      <div className="section-intro">
        <div>
          <span className="eyebrow">Make the journal yours</span>
          <h2>Settings & trading plan</h2>
          <p>
            Simple preferences and a clear plan you can return to every day.
          </p>
        </div>
      </div>
      <form onSubmit={save} className="workspace-columns">
        <Panel title="Journal preferences">
          <div className="form-stack">
            <label>
              Default analytics range
              <select
                value={value.defaultRange ?? "all"}
                onChange={(e) =>
                  setValue({
                    ...value,
                    defaultRange: e.target
                      .value as UserSettings["defaultRange"],
                  })
                }
              >
                <option value="all">All time</option>
                <option value="30d">Last 30 days</option>
                <option value="month">This month</option>
              </select>
            </label>
            <label>
              Review completion target (%)
              <input
                type="number"
                min={1}
                max={100}
                required
                value={value.reviewTarget ?? 80}
                onChange={(e) =>
                  setValue({ ...value, reviewTarget: Number(e.target.value) })
                }
              />
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={value.compactRows ?? false}
                onChange={(e) =>
                  setValue({ ...value, compactRows: e.target.checked })
                }
              />
              Compact trade rows
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={!value.welcomeDismissed}
                onChange={(e) =>
                  setValue({ ...value, welcomeDismissed: !e.target.checked })
                }
              />
              Show the getting-started checklist
            </label>
            <div className="context-note">
              <strong>Accounting context</strong>
              <p>
                INR accounting · Asia/Kolkata trading days · UTC entry fields.
                Currency conversion and multiple trading timezones are not
                enabled.
              </p>
            </div>
          </div>
        </Panel>
        <Panel
          title="Your trading plan"
          subtitle="A reusable checklist of intentions. This does not alter recorded trades."
        >
          <div className="form-stack">
            {(
              [
                ["strategy", "Strategy / setups"],
                ["entry", "Entry conditions"],
                ["exit", "Exit conditions"],
                ["rules", "Risk and trading rules"],
                ["focus", "Current process goal"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <textarea
                  maxLength={1000}
                  value={plan[key]}
                  onChange={(e) =>
                    setValue({
                      ...value,
                      tradingPlan: { ...plan, [key]: e.target.value },
                    })
                  }
                />
              </label>
            ))}
          </div>
        </Panel>
        <div className="form-actions col-span-full">
          {error && (
            <p role="alert" className="loss">
              {error}
            </p>
          )}
          <button disabled={busy} className="btn-primary">
            {busy ? "Saving…" : "Save preferences"}
          </button>
        </div>
      </form>
      <Panel
        title="Account security"
        subtitle="Minimum six characters. No mandatory uppercase, number or symbol."
      >
        <AccountSettings />
      </Panel>
    </div>
  );
}
