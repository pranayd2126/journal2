import { useState } from "react";
import { dbService } from "../services/dbService";
export default function AIReview() {
  const [text, setText] = useState(""),
    [busy, setBusy] = useState(false);
  async function review() {
    setBusy(true);
    try {
      const user = dbService.getCurrentUser();
      const r = await fetch(`/api/${user?.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      setText(`${data.label}\n\n${data.content}`);
    } catch (e) {
      setText(e instanceof Error ? e.message : "Review unavailable");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="p-4 bg-zinc-950 rounded-xl space-y-3">
      <h3>Optional AI review</h3>
      <p className="text-xs text-zinc-400">
        Sends aggregate statistics for all closed trades to Gemini only when
        enabled by the administrator. Interpretations may be inaccurate; records
        and metrics are never changed.
      </p>
      <button
        disabled={busy}
        onClick={review}
        className="bg-zinc-800 px-3 py-2 rounded"
      >
        {busy ? "Reviewing…" : "Request AI review"}
      </button>
      {text && (
        <p role="status" className="whitespace-pre-wrap text-sm">
          {text}
        </p>
      )}
    </div>
  );
}
