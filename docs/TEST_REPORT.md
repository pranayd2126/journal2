# Verification report — 2026-10-21

Environment: local Node/npm, synthetic fixtures, disposable MongoDB. Branch codex/journal-audit. No production database, deployment, paid model request, or live Cloudinary request was used.

## Final checks

| Check | Result |
|---|---|
| npm run build | PASS; 3,042 modules; largest emitted chunk ~406.49 kB |
| npm run typecheck | PASS |
| npm run lint | PASS (existing command is tsc --noEmit; not independent ESLint) |
| npx tsc -p api/tsconfig.json --noEmit | PASS |
| npm test | 22 passed, 0 failed, 0 skipped; 3 files |
| npm run test:e2e | 4 passed, 0 failed, 0 skipped; final confirmation run completed in 22.0 seconds |
| npm audit | 0 vulnerabilities reported |
| git diff --check | PASS |

The automated test count is **26 passing / 0 failing / 0 skipped** across the final completed suites. Build, type checks, audit and diff checks are separate checks, not added to test counts. Test counts do not represent complete production coverage.

## What was exercised

- Decimal long/short P&L, fees and multiplier; empty, all-win/loss/breakeven, missing/wrong-side/zero risk, invalid exits, open/partial exclusions, equal-time exits, initial loss, recovery and streak resets.
- Calendar/equity/strategy/net reconciliation; every shared filter; edited/deleted totals; 10,000-trade cent aggregation; IST midnight and exact risk-rule boundaries/future exclusions.
- Disposable-MongoDB signup: 5 characters rejected, 6 and longer accepted. Session restoration, incorrect credentials, invalid/expired sessions, logout revocation, authenticated password change and revocation of previous sessions.
- Two-user route ownership for trades/settings/checklists/insights. Client userId cannot transfer ownership; protected image route denies another user.
- Authoritative trade P&L, persisted edits, stale versions, duplicate submission IDs, conflicting retries, delete/not-found, legacy P&L/unknown-field preservation.
- Invalid payloads, ID validation, cross-origin rejection, repeated-login throttling, malformed/oversized image rejection, unauthorized screenshot attachments.
- Real sharp decoding/re-encoding with a mocked Cloudinary upload. Storage configured as authenticated; result is an owner-scoped app URL. Live upload/delivery not verified.
- Mocked Gemini valid/empty/failing responses; disabled/missing configuration, empty trade data, numeric aggregate payload excluding private symbols/notes. No paid request.
- Chromium desktop 1440×1000 and mobile 390×844: registration, reload persistence, login/logout, add/edit/delete, filters, habits, risk-setting persistence, password change, disabled-AI message, known dataset totals (₹250 net, ₹62.50 expectancy), journal-card search/outcome/details, account switching/isolation and 3 MB HTTP body rejection.
- Browser screenshots inspected for desktop/mobile dashboard and analytics; horizontal overflow assertion for the breakdown view. This is not exhaustive accessibility or cross-browser coverage.

## Earlier failures, retained honestly

Baseline TypeScript failed on broken API imports and calendar typing. Initial dependency audit reported 31 issues. A broad esbuild override broke production builds; it was narrowed to tsx, preserving Vite's compatible version. Initial browser setup ran before its download finished; later browser-selector checks exposed unlabeled controls and a transition timing ambiguity. These were corrected.

One later full browser run had two reload timeouts while two analytics/isolation tests passed. A complete rerun passed all four. Traces did not establish a production-code cause; this remains a monitoring item, not a claimed fixed application defect. No retries are configured to conceal failures.

## Unverified

Live Cloudinary and Gemini credentials are absent (presence checked without printing values). Production MongoDB/index compatibility, Vercel runtime/proxy configuration, browser engines other than Chromium, physical devices, production-scale load and security penetration testing are unverified. See COMPLETION_STATUS.md for the full remaining-work list and reproducible percentage calculation.
