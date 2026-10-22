# Implementation plan — 2026-10-21

Baseline: main e95dbd3; clean empty workspace fetched into codex/journal-audit. React 19, Vite 6, Express 4, native MongoDB, Recharts confirmed. Build passes; TypeScript fails on two API imports and calendar typing. No tests exist. npm reports 31 vulnerabilities initially. No environment credentials supplied.

## P0
- Consolidate Express and Vercel endpoint behavior; replace browser identity trust with revocable hashed opaque sessions, HttpOnly cookies, origin checks and persistent rate limits.
- Validate payloads and ownership on every private endpoint; avoid leaking database errors; prevent unsafe uploads and client secret injection.
- Preserve historical financial data, timestamps and unrelated fields; add concurrency and submission IDs.

## P1
- Central decimal arithmetic and closed-trade population, exit chronology, explicit timezone, separate breakevens, correct profit factor, expectancy, valid initial risk, currency drawdowns and streaks.
- All analytics use one filter pipeline; useful distributions, strategy, instrument, direction, discipline and behavioral comparisons with sample counts.
- Fix editing data loss, user settings defaults, hidden read errors and misleading risk locks.
- Unit, disposable MongoDB integration, desktop/mobile browser tests.

## P2
- Server-only optional AI interpretation with computed metrics, disabled paid calls by default; graceful error handling.
- Chart loading, empty states, labels, responsive navigation, bounded rendering.
- Document feature inventory, research, definitions, security, migrations, test evidence and remaining limitations.

## P3 / defer until data supports it
- Broker execution controls, partial fills, multi-currency consolidation, return-based Sharpe/Sortino and account percentage drawdown require additional trustworthy data.
- Password recovery requires verified email delivery; never accept email plus new password as ownership proof.

No push, deployment, paid model calls or destructive production changes authorized. Test database must be disposable. Non-destructive indexes only; inspect duplicate legacy data before adding unique legacy indexes.
