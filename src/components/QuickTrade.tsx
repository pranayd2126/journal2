import { useRef, useState } from "react";
import { dbService } from "../services/dbService";
import { calculatedPnl } from "../lib/tradingAnalytics";
import type { Trade } from "../types";
import { Modal, money, notify } from "./ui/WorkspaceUI";
export default function QuickTrade({
  onClose,
  onSaved,
  onDetailed,
}: {
  onClose: () => void;
  onSaved: (t: Trade) => void;
  onDetailed: () => void;
}) {
  const now = new Date().toISOString().slice(0, 16),
    submission = useRef(crypto.randomUUID()),
    lock = useRef(false);
  const [form, setForm] = useState({
    symbol: "",
    side: "LONG",
    entryPrice: "",
    exitPrice: "",
    quantity: "",
    brokerage: "0",
    setupType: "",
    entryTime: now,
    exitTime: now,
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const data = {
    ...form,
    entryPrice: Number(form.entryPrice),
    exitPrice: Number(form.exitPrice),
    quantity: Number(form.quantity),
    brokerage: Number(form.brokerage),
    side: form.side as Trade["side"],
  };
  const pnl = calculatedPnl(data);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const payload = {
        ...data,
        symbol: form.symbol.trim().toUpperCase(),
        entryTime: new Date(form.entryTime + ":00Z").toISOString(),
        exitTime: new Date(form.exitTime + ":00Z").toISOString(),
        mistakes: [],
        review: { status: "PENDING", wentWell: "", improve: "", lesson: "" },
      };
      const id = await dbService.addDocument(
        "trades",
        payload,
        submission.current,
      );
      const saved = await dbService.getDocument<Trade>("trades", id);
      if (!saved)
        throw Error("Saved trade could not be reloaded. Refresh the journal.");
      onSaved(saved);
      notify("Trade saved. Add context when you review it.");
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal title="Quick trade" onClose={onClose}>
      <form className="form-stack" onSubmit={save}>
        <p className="muted">
          Log the essentials now. Add psychology, screenshots and detailed
          context later.
        </p>
        <div className="form-grid">
          {(
            [
              ["symbol", "Symbol", "text"],
              ["quantity", "Quantity", "number"],
              ["entryPrice", "Entry price", "number"],
              ["exitPrice", "Exit price", "number"],
              ["brokerage", "Fees (₹)", "number"],
              ["setupType", "Setup (optional)", "text"],
            ] as const
          ).map(([key, label, type]) => (
            <label key={key}>
              {label}
              <input
                required={key !== "setupType"}
                type={type}
                min={
                  key === "quantity"
                    ? "0.000001"
                    : type === "number"
                      ? "0"
                      : undefined
                }
                step={type === "number" ? "any" : undefined}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                maxLength={key === "symbol" ? 50 : 100}
                placeholder={key === "symbol" ? "e.g. NIFTY" : undefined}
              />
            </label>
          ))}
          <label>
            Direction
            <select
              value={form.side}
              onChange={(e) => setForm({ ...form, side: e.target.value })}
            >
              <option>LONG</option>
              <option>SHORT</option>
            </select>
          </label>
          {(["entryTime", "exitTime"] as const).map((key) => (
            <label key={key}>
              {key === "entryTime" ? "Entry" : "Exit"} time (UTC)
              <input
                type="datetime-local"
                required
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <div className="quick-result">
          <span>Estimated net P&L</span>
          <strong>{pnl === null ? "—" : money(pnl)}</strong>
          <small>
            Linear trade · multiplier 1 · use detailed entry for other charges
            or contract multipliers.
          </small>
        </div>
        {error && (
          <p role="alert" className="loss">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onDetailed}>
            Use detailed entry
          </button>
          <button disabled={busy} className="btn-primary">
            {busy ? "Saving…" : "Save trade"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
