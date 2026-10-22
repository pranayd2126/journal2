# Feature audit

Baseline inspected: e95dbd3. “Present” means code exists, not that production works. Verification evidence is in TEST_REPORT.md. No production credentials or records were accessed.

| Area | Baseline findings | Changes / verification scope |
|---|---|---|
| Registration/login | bcrypt hashes, no password minimum or session; browser user ID trusted | Verified cookies, six-character minimum, persistent throttling; API integration tests |
| Logout/session persistence | Local storage only | Server revocation and restore endpoint; browser tests tracked separately |
| Password change/recovery | No change endpoint; Forgot button inert | Authenticated change with old password; verified-ownership recovery deferred; clear explanation on Forgot |
| Protected data | Every user-specific endpoint vulnerable to impersonation | Shared authenticated handler, session-derived owner, reject mismatched route; integration tests |
| Add trade | Linear P&L in browser; server accepted arbitrary values; dates forced to now | Server recomputation, decimal arithmetic, date inputs, multiplier/charges, validation and submission ID |
| Edit trade | UI replaced record without timestamps; no conflicts | Preserve fields and original timestamps; response supplies authoritative P&L; version check |
| Delete trade | Owner ID supplied by browser; missing records reported success | Verified session ownership, real 404; retain screenshots to avoid unsafe shared deletion |
| Details/search/filter/sort | Journal Cards supports search, outcome and tag filtering, detail modal; trade list sorts | Preserve existing controls; signed loss display corrected; analytics has unified filters |
| Notes/tags/screenshots | Notes and tags present; upload accepted arbitrary URLs, no ownership/limits | Notes/tags retained; authenticated byte decoding, image re-encode, size/pixel limits and attachment ownership |
| Psychology/setup/execution | Rich recorded fields, inconsistent treatment of missing values | Before/during/after, plan, stop, R:R, revenge, boredom and execution comparisons; missing = Unrecorded |
| Dashboard | Profit factor wrong with breakevens, invalid infinities; equity unsorted by exit | Shared metrics, separate breakevens, exit-sorted cumulative net |
| Calendar | Entry-day attribution, TypeScript error | Realized exit-day totals in IST; keyboard-accessible value labels |
| Analytics | Fake stops; short R sign wrong; cumulative-profit % mislabeled account drawdown; empty filters hide controls; tooltip erased negative signs; YTD used 365 days | Rebuilt analytics view around centralized definitions; all charts share filtered population |
| Habits | Daily records could duplicate, failed saves not displayed | Deterministic daily IDs for new records; computed score; saving and error states |
| Risk | Duplicated math, future records included; displayed suspension without broker control | Shared exit-day/month rules and entry-count warnings; warnings only; positive thresholds, clear disabled-zero behavior |
| Settings | Empty object replaced defaults; settings could leak across logout | Merge defaults and owner; reset on logout; validated saves |
| AI | Installed SDK/key injection, no actual generation call or AI UI | Server-only opt-in aggregate review; disabled by default; no paid calls tested |
| Serverless | Broken relative database imports; behavior differed from Express | Thin wrappers use the same handler as local server |
| Dependencies | 31 audit findings; unused vulnerable middleware | Remove unused middleware/type runtime dependency; scoped patched overrides; current audit tracked in TEST_REPORT |
| Scale | Unbounded rendering and large bundle | Analytics loaded lazily, chart chunks separated; aggregate processing improved; production large-history load test remains needed |

Not present: broker integration, partial-fill ledger, multi-account balances, verified email recovery, historical cash flows, separate setup-quality rating. No fabricated substitute was added. Currency remains INR; setting different base currencies is rejected until conversion/account separation is implemented.

## Final local verification status

Verified in automated/browser tests: registration/login/logout/session restoration/password change, trade creation/edit/deletion/persistence, duplicate/stale-edit protections, settings persistence, habit toggles, analytics/filter reconciliation, journal-card symbol search/outcome filter/details, two-account isolation and risk boundaries. New-image provider upload and AI responses are mock-tested only; live providers remain unverified. Browser coverage is Chromium at two viewport sizes. The legacy Firebase files and scratch.js are unused artifacts, not application integrations.
