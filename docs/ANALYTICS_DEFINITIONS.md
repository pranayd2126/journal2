# Analytics definitions

All analytics use the shared engine in src/lib/tradingAnalytics.ts. Monetary arithmetic uses Decimal; new linear net P&L is rounded to two decimals. Stored historical pnl is the authoritative realized net amount and is never bulk recalculated. A discrepancy count flags differences exceeding ₹0.01. Explicit changes to price, quantity, direction, multiplier or fees recalculate that trade; note-only edits retain stored P&L.

- Population: finite stored P&L, valid exit timestamp, excluding explicit OPEN and PARTIAL states. Legacy records without status are closed if they have a valid exit. Invalid/unclosed rows remain in the journal but do not enter realized metrics.
- Net: signed (exit − entry) × quantity × multiplier − brokerage − other charges. Defaults: multiplier 1, fees 0. Linear fully closed instruments only; no partial-fill accounting is inferred.
- Win rate: positive net trades / all valid closed trades. Zero is breakeven, not loss.
- Profit factor: sum positive net outcomes / absolute sum negative net outcomes. No loss denominator: null, displayed as “No losses” with wins, otherwise N/A. This uses net outcomes, not fee-free price returns.
- Expectancy: total realized net / closed count; equals weighted average win minus weighted average loss using the same population.
- R: stored net / valid explicit initial monetary risk, otherwise directional initial stop distance × quantity × multiplier. Missing, zero and wrong-side stops yield unavailable R. The recorded stop must represent initial risk; later moved stops cannot be distinguished in old data. Risk percentage does not substitute for initial risk.
- Equity chart: cumulative realized net starting at zero, sorted by actual exit timestamp. Equal-time exits are aggregated before drawdown calculation. This is P&L, not account balance.
- Drawdown: highest cumulative realized P&L (including baseline zero) minus current cumulative P&L. Current and maximum are currency amounts. Duration is peak to recovery, or last observed exit for an unrecovered episode. Recovery duration is episode trough to recovery. Initial loss uses first exit as observation origin; time before that is unknown.
- Recovery factor: net / maximum currency drawdown; unavailable when no drawdown. Sharpe, Sortino and percentage account drawdown are deferred: recorded capital is not a cash-flow-adjusted historical equity series.
- Streaks: exit chronological trade outcomes; breakevens reset both streaks. Equal-time trade streak ordering uses record ID; equity drawdown does not depend on it.
- Calendar, date filters, daily/monthly risk and weekly results: realized exit date in Asia/Kolkata. Time-of-day and weekday comparisons group closed trade outcomes by entry time in Asia/Kolkata. Weeks start Monday. Form timestamps are explicitly entered in UTC.
- Group comparisons always show sample counts. Missing behavior is “Unrecorded.” Mistake groups overlap; never add their P&Ls or interpret associated losses as caused by the mistake. No setup-quality score is fabricated from setup name.
- Filtered equity starts at zero for the selected population; does not carry prior filtered-out profits. Calendar and strategy totals reconcile to that population.
- Risk limits warn at >= boundary; zero disables a monetary rule. Daily loss means negative daily net, not total gross losses. Future exits do not count. No broker control exists.
