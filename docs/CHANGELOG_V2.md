# Journal2 v2 changes — 22 October 2026

Continued the existing `codex/journal-audit` working tree. No push, deployment, production connection, financial-history migration, or external AI request.

## Product and workflow

- Added quick closed-trade entry with server validation, idempotency, explicit UTC fields and live net preview. Full detailed entry remains available for charges, multipliers, stops, targets, tags, screenshots and context.
- Added manual review status, execution rating, what worked, improvement and lesson fields; pending/reviewed queue; atomic trade-version checks preserve financial records.
- Added a single owner-scoped daily/weekly/monthly notebook. Weekly periods start Monday, months start day 1, and summaries reuse the existing IST closed-trade engine. Notes, observations, lessons, next-period focus and review status persist independently from trade notes.
- Added reusable trading plan, default analytics date range, actual compact row spacing, optional onboarding and review-completion target.
- Added journal search across symbols/setup/reasons/tags/mistakes, combined outcome/setup/review filters and bounded paging. Existing sort/edit/delete workflows remain.
- Rebuilt calendar with signed results, counts, month totals, month navigation and selected-day trades linked to manual reviews and notes.

## Interface

- New slate/teal workspace, labeled collapsible sidebar, horizontally scrollable mobile navigation, consistent headers and settings page.
- Compact overview: net, win rate, profit factor, expectancy, realized curve, risk snapshot, review goal, recent outcomes and habits.
- Shared panels, metrics, native dialogs, status notifications, skeletons, focus styling, reduced-motion support and system fonts (no external font request).
- Native trade-detail dialog replaces the old untrapped overlay. Escape/focus restoration tested. Mobile edit/delete/review controls are visible; they no longer require hover.
- Added unsaved notebook/settings navigation guards. Notebook period/form updates are atomic; period controls are disabled while saving.

## Analytics and correctness

- Preserved Decimal financial calculations, filter populations, drawdown, risk warnings and all unique Analytics sections.
- Added monthly chart, date shortcuts/default preference, metric definitions and paginated source rows.
- Calendar detail rows now use the same valid closed-trade filter as calendar totals.
- Missing target/stop data shows `RR N/A`, not `NaN`; missing plan assessment shows “Not assessed”, not “Disciplined”.
- Detailed entry saves optional assessments only when explicitly selected for that step; untouched legacy assessments are preserved. Quick entry does not invent psychology or execution facts.
- Gross preview restores both brokerage and other charges to net P&L; net remains server-authoritative.

## Safety and verification

- Notebook writes enforce ownership, bounded schemas, valid calendar dates, canonical period starts and optimistic concurrency. No production indexes/data modified.
- Six-character minimum password and existing session/CSRF/rate-limit/upload protections retained.
- AI UI removed from the active workspace. Existing backend remains disabled by default and stored insights are preserved. No AI functionality was developed in v2.
- Cross-browser test harness now uses local HTTPS and disposable MongoDB, so Secure cookies are exercised in WebKit without weakening application security.
- See TEST_REPORT_V2.md for final test totals, limitations and reproducible completion accounting.
