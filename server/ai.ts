import { GoogleGenAI } from "@google/genai";
import type { Db } from "mongodb";
import {
  analytics,
  filterTrades,
  type Filters,
} from "../src/lib/tradingAnalytics.js";
import type { Trade } from "../src/types.js";
import { HttpError } from "./security.js";
export async function generateReview(
  db: Db,
  userId: string,
  filters: Filters = {},
) {
  if (process.env.AI_ENABLED !== "true" || !process.env.GEMINI_API_KEY)
    throw new HttpError(
      503,
      "AI reviews are disabled. The administrator must configure and authorize paid API usage.",
    );
  const trades = await db.collection("trades").find({ userId }).toArray();
  const metrics = analytics(
    filterTrades(trades as unknown as Trade[], filters),
  );
  if (!metrics.count)
    throw new HttpError(400, "No closed trades available for this review");
  const summary = {
    count: metrics.count,
    netPnl: metrics.totalPnl,
    winRate: metrics.winRate,
    expectancy: metrics.expectancy,
    profitFactor: metrics.profitFactor,
    maximumCurrencyDrawdown: metrics.maxDrawdown,
    averageR: metrics.averageR,
    rSampleSize: metrics.rCount,
  };
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
      contents: JSON.stringify(summary),
      config: {
        httpOptions: { timeout: 20000 },
        systemInstruction:
          "Interpret only the supplied deterministic trading metrics. Do not calculate or invent additional numbers, trades, risk or causes. Identify sample-size limitations. Give a short review of areas to examine, not trade recommendations. No personal data is provided.",
        maxOutputTokens: 600,
      },
    });
    const content = response.text?.trim();
    if (!content || content.length > 10000) throw Error("Invalid response");
    return {
      content,
      metrics: summary,
      label:
        "AI-generated interpretation — verify against the deterministic metrics",
    };
  } catch {
    throw new HttpError(
      503,
      "AI review unavailable. Your financial records have not changed.",
    );
  }
}
