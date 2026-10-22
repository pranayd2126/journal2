import { useMemo } from "react";
import type { Trade, UserSettings } from "../types";
import { evaluateRisk } from "../lib/riskRules";
export function useRiskManager(trades: Trade[], settings: UserSettings) {
  return useMemo(() => evaluateRisk(trades, settings), [trades, settings]);
}
