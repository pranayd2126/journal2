import { z } from "zod";
import { HttpError } from "./security.js";
const n = z.number().finite().min(0).max(1e12);
const text = z.string().max(1000);
const labels = z.array(z.string().max(100)).max(50);
const date = z.string().datetime({ offset: true });
export const tradeSchema = z
  .object({
    review: z
      .object({
        status: z.enum(["PENDING", "REVIEWED"]),
        rating: z.number().int().min(1).max(5).optional(),
        wentWell: z.string().max(4000),
        improve: z.string().max(4000),
        lesson: z.string().max(4000),
      })
      .optional(),
    symbol: z.string().trim().min(1).max(50),
    side: z.enum(["LONG", "SHORT"]),
    entryPrice: n,
    exitPrice: n,
    quantity: n.positive(),
    brokerage: n.default(0),
    charges: n.optional(),
    multiplier: n.positive().optional(),
    initialRisk: n.positive().nullable().optional(),
    stopLoss: n.positive().nullable().optional(),
    targetPrice: n.positive().nullable().optional(),
    entryTime: date,
    exitTime: date,
    status: z.literal("CLOSED").optional(),
    setupType: z.string().max(100).default(""),
    tradeReason: text.optional(),
    tags: labels.optional(),
    mistakes: labels.default([]),
    confirmations: labels.optional(),
    imageUrl: z
      .union([
        z.literal(""),
        z.string().url().max(2048),
        z.string().regex(/^\/api\/[a-f0-9]{24}\/uploads\/[a-f0-9]{24}$/),
      ])
      .optional(),
    riskPercentage: n.max(100).optional(),
    marketCondition: z
      .enum(["TRENDING_UP", "TRENDING_DOWN", "SIDEWAYS", "CHOPPY", "VOLATILE"])
      .optional(),
    executionQuality: z
      .object({
        entry: z.enum(["EARLY", "PERFECT", "LATE"]),
        exit: z.enum(["EARLY", "PERFECT", "LATE"]),
        followedSL: z.boolean(),
        followedPlan: z.boolean(),
        respectedRR: z.boolean(),
      })
      .optional(),
    psychology: z
      .object({
        before: text,
        during: text,
        after: text,
        boredomTrade: z.boolean(),
        revengeTrade: z.boolean(),
        pressureToWin: z.boolean(),
      })
      .optional(),
    marketContext: z
      .object({
        overallTrend: z.enum(["BULLISH", "BEARISH", "NEUTRAL"]),
        volatility: z.enum(["LOW", "HIGH", "MEDIUM"]),
        newsEvent: z.boolean(),
      })
      .optional(),
  })
  .refine((t) => Date.parse(t.exitTime) >= Date.parse(t.entryTime), {
    message: "Exit must be at or after entry",
  });
export const settingsSchema = z.object({
  defaultRange: z.enum(["all", "30d", "month"]).optional(),
  compactRows: z.boolean().optional(),
  welcomeDismissed: z.boolean().optional(),
  reviewTarget: z.number().int().min(1).max(100).optional(),
  tradingPlan: z
    .object({
      strategy: text,
      entry: text,
      exit: text,
      rules: text,
      focus: text,
    })
    .optional(),
  dailyLossLimit: n.optional(),
  singleTradeLossLimit: n.optional(),
  monthlyLossLimit: n.optional(),
  totalCapital: n.optional(),
  riskBaseCurrency: z.literal("INR").optional(),
  maxTradesPerDay: z.number().int().min(0).max(10000).optional(),
  maxConsecutiveLosses: z.number().int().min(0).max(10000).optional(),
  maxRiskPerTrade: n.optional(),
});
export const checklistSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  followedRisk: z.boolean(),
  noFOMO: z.boolean(),
  waitedForConfirmation: z.boolean(),
  avoidedNews: z.boolean(),
  plannedTrade: z.boolean(),
});
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpError(400, result.error.issues[0].message);
  return result.data;
}

export const notebookSchema = z
  .object({
    kind: z.enum(["DAY", "WEEK", "MONTH"]),
    period: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(
        (v) =>
          Number.isFinite(Date.parse(v)) &&
          new Date(v).toISOString().slice(0, 10) === v,
        "Valid calendar date required",
      ),
    notes: z.string().max(10000),
    observations: z.string().max(4000),
    lesson: z.string().max(4000),
    focus: z.string().max(4000),
    reviewed: z.boolean(),
  })
  .refine(
    (v) => v.kind !== "MONTH" || v.period.endsWith("-01"),
    "Month must start on day 1",
  )
  .refine(
    (v) =>
      v.kind !== "WEEK" || new Date(v.period + "T00:00:00Z").getUTCDay() === 1,
    "Week must start on Monday",
  );
