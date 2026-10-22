import { useState } from "react";
export default function AccountSettings() {
  const [current, setCurrent] = useState(""),
    [password, setPassword] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <details className="bg-zinc-950 p-4 rounded-xl">
      <summary>Change password</summary>
      <form
        className="space-y-3 mt-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const r = await fetch("/api/auth/password", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ currentPassword: current, password }),
            });
            const d = await r.json();
            if (!r.ok) throw Error(d.error);
            setCurrent("");
            setPassword("");
            setMessage(
              "Password changed. Other sessions have been signed out.",
            );
          } catch (e) {
            setMessage(
              e instanceof Error ? e.message : "Could not change password",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <input
          aria-label="Current password"
          type="password"
          autoComplete="current-password"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder="Current password"
          className="bg-zinc-900 rounded p-2 w-full"
        />
        <input
          aria-label="New password"
          type="password"
          autoComplete="new-password"
          minLength={6}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password (minimum 6 characters)"
          className="bg-zinc-900 rounded p-2 w-full"
        />
        <button disabled={busy} className="bg-blue-600 rounded px-3 py-2">
          Change password
        </button>
        <p role="status" className="text-sm">
          {message}
        </p>
      </form>
    </details>
  );
}
