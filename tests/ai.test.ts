import { it, expect, vi, afterEach } from "vitest";
const generate = vi.hoisted(() => vi.fn());
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: generate };
  },
}));
import { generateReview } from "../server/ai";
const db = (rows: any[]) =>
  ({
    collection: () => ({ find: () => ({ toArray: async () => rows }) }),
  }) as any;
afterEach(() => {
  vi.unstubAllEnvs();
  generate.mockReset();
});
it("does not call a model when disabled or unconfigured", async () => {
  vi.stubEnv("AI_ENABLED", "false");
  await expect(generateReview(db([]), "a")).rejects.toThrow("disabled");
  expect(generate).not.toHaveBeenCalled();
});
it("handles empty data before calling the provider", async () => {
  vi.stubEnv("AI_ENABLED", "true");
  vi.stubEnv("GEMINI_API_KEY", "synthetic-test-key");
  await expect(generateReview(db([]), "a")).rejects.toThrow("No closed");
  expect(generate).not.toHaveBeenCalled();
});
it("sends deterministic aggregates only and handles malformed and failed provider replies", async () => {
  vi.stubEnv("AI_ENABLED", "true");
  vi.stubEnv("GEMINI_API_KEY", "synthetic-test-key");
  const rows = [
    {
      symbol: "PRIVATE",
      tradeReason: "private note",
      pnl: 95,
      entryPrice: 100,
      exitPrice: 110,
      quantity: 10,
      side: "LONG",
      exitTime: "2026-01-01T00:00:00Z",
    },
  ];
  generate.mockResolvedValue({ text: "Review your sample size." });
  const result = await generateReview(db(rows), "a");
  expect(result.metrics.netPnl).toBe(95);
  expect(generate.mock.calls[0][0].contents).not.toContain("PRIVATE");
  expect(generate.mock.calls[0][0].contents).not.toContain("private note");
  generate.mockResolvedValue({ text: "" });
  await expect(generateReview(db(rows), "a")).rejects.toThrow("unavailable");
  generate.mockRejectedValue(new Error("rate limit / network / key failure"));
  await expect(generateReview(db(rows), "a")).rejects.toThrow("unavailable");
});
