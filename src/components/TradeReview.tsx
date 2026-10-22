import { useState } from "react";
import type { Trade, TradeReview as Review } from "../types";
import { dbService } from "../services/dbService";
import { Modal, money, notify } from "./ui/WorkspaceUI";
export default function TradeReview({
  trade,
  onSave,
  onClose,
}: {
  trade: Trade;
  onSave: (t: Trade) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState<Review>(
    trade.review ?? {
      status: "PENDING",
      wentWell: "",
      improve: "",
      lesson: "",
    },
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const result = await dbService.updateDocument<Trade>(
        "trades",
        trade.id!,
        { version: trade.version ?? 0, review: value },
      );
      onSave(result);
      notify("Trade review saved");
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={`Review ${trade.symbol}`} onClose={onClose}>
      <form onSubmit={save} className="form-stack">
        <div className="review-trade-context">
          <strong>
            {trade.symbol} <small>{trade.side}</small>
          </strong>
          <span className={trade.pnl < 0 ? "loss" : "profit"}>
            {money(trade.pnl)}
          </span>
          <p>
            {trade.setupType || "No setup recorded"} ·{" "}
            {trade.exitTime?.slice(0, 10)}
          </p>
        </div>
        <p className="muted">
          Reflect on your execution. Your original trade notes and financial
          results stay unchanged.
        </p>
        <label>
          Review status
          <select
            value={value.status}
            onChange={(e) =>
              setValue({ ...value, status: e.target.value as Review["status"] })
            }
          >
            <option value="PENDING">Pending review</option>
            <option value="REVIEWED">Reviewed</option>
          </select>
        </label>
        <label>
          Execution rating
          <select
            value={value.rating ?? ""}
            onChange={(e) =>
              setValue({
                ...value,
                rating: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          >
            <option value="">Not rated</option>
            {[1, 2, 3, 4, 5].map((v) => (
              <option key={v} value={v}>
                {v} / 5
              </option>
            ))}
          </select>
        </label>
        {(
          [
            ["wentWell", "What went well"],
            ["improve", "What could improve"],
            ["lesson", "Lesson for the next trade"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <textarea
              maxLength={4000}
              value={value[key]}
              onChange={(e) => setValue({ ...value, [key]: e.target.value })}
            />
          </label>
        ))}
        {error && (
          <p role="alert" className="loss">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save review"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
