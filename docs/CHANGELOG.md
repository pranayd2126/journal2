# Engineering changelog — 2026-10-21

Changes remain local on codex/journal-audit, based on e95dbd3. Nothing pushed or deployed.

## Security and persistence
- Replace duplicated insecure Express/Vercel logic with a shared authenticated API.
- Add hashed opaque cookie sessions, logout revocation, password changes, six-character minimum, throttling, origin checks, validation, safe errors and security headers.
- Add protected new-image storage/delivery, decoded image validation, ownership and upload limits. Legacy public URLs unchanged.
- Compute new/financially edited trade P&L on server; preserve historical stored P&L on notes-only edits. Preserve unrelated fields, record ownership and timestamps.
- Add submission IDs, optimistic concurrency, deterministic new settings/checklist IDs, and non-destructive query/session indexes.
- Remove client Gemini key substitution and unused vulnerable dependencies. Add scoped dependency overrides; lock dependencies.

## Analytics and UI
- Shared decimal calculations, closed-trade filters, exit chronology, breakevens, profit factor, expectancy, valid-risk R, currency drawdown, recovery and streaks.
- Recharts equity/drawdown, real calendar, P&L/R histograms, daily/weekly consistency, strategy table, instruments, direction, entry time, behavior and overlapping mistake comparisons.
- Correct tooltip/sign behavior, unknown psychology, YTD selection, filter empty states and data reconciliation.
- Trade timestamps, charges and multiplier controls; preserve original timestamps when unchanged; fix comma-separated tag editing.
- Shared IST risk warnings with optional count/streak/initial-risk thresholds, explicit no-broker-control wording.
- Session restoration, default settings merge, save/read error states, habit saving feedback, accessible controls, compact sidebar and empty dashboard.
- Optional server-side AI aggregate review; disabled by default. Add authenticated password-change UI.
- Lazy analytics and separate chart/motion chunks; remove original oversized single-chunk warning. No claim of reduced total downloaded JS.

## Verification and documentation
- Add Vitest analytics/security/integration/mock-provider tests, disposable MongoDB and Chromium desktop/mobile workflows.
- Add research, implementation plan, feature audit, definitions, security audit, test report, completion accounting and deployment instructions.
- Keep unused historical Firebase artifacts; they do not secure or power the MongoDB app. scratch.js is an unused FileReader snippet, not runtime code.

## Files modified or added

- `.env.example`
- `.gitignore`
- `README.md`
- `api/[userId]/checklists/[checklistId].ts`
- `api/[userId]/checklists/index.ts`
- `api/[userId]/insights.ts`
- `api/[userId]/review.ts`
- `api/[userId]/settings.ts`
- `api/[userId]/trades/[tradeId].ts`
- `api/[userId]/trades/index.ts`
- `api/[userId]/uploads/[uploadId].ts`
- `api/_db.ts`
- `api/auth/login.ts`
- `api/auth/logout.ts`
- `api/auth/password.ts`
- `api/auth/session.ts`
- `api/auth/signup.ts`
- `api/health.ts`
- `api/upload.ts`
- `docs/ANALYTICS_DEFINITIONS.md`
- `docs/CHANGELOG.md`
- `docs/COMPLETION_STATUS.md`
- `docs/FEATURE_AUDIT.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/SECURITY_AUDIT.md`
- `docs/TEST_REPORT.md`
- `docs/TRADING_JOURNAL_RESEARCH.md`
- `package-lock.json`
- `package.json`
- `playwright.config.ts`
- `server.ts`
- `server/ai.ts`
- `server/handler.ts`
- `server/security.ts`
- `server/validation.ts`
- `src/App.tsx`
- `src/components/AIReview.tsx`
- `src/components/AccountSettings.tsx`
- `src/components/AnalyticsDashboard.tsx`
- `src/components/Auth.tsx`
- `src/components/CalendarHeatmap.tsx`
- `src/components/DailyHabits.tsx`
- `src/components/Dashboard.tsx`
- `src/components/JournalDashboard.tsx`
- `src/components/RiskRules.tsx`
- `src/components/Trades/TradeJournal.tsx`
- `src/hooks/useRiskManager.ts`
- `src/lib/riskRules.ts`
- `src/lib/tradingAnalytics.ts`
- `src/services/dbService.ts`
- `src/types.ts`
- `tests/ai.test.ts`
- `tests/analytics.test.ts`
- `tests/api.test.ts`
- `tests/browser-server.ts`
- `tests/browser/journal.spec.ts`
- `vercel.json`
- `vite.config.ts`
- `vitest.config.ts`
