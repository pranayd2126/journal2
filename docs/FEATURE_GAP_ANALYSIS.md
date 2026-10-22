# Feature gaps (actual code reviewed before v2 changes)

| Priority | Current behavior / problem | Expected improvement and benefit | Approach / required verification |
|---|---|---|---|
| P0 | Header New Trade only changes tab | Open entry immediately | Entry request state; browser test |
| P0 | Existing AI card dominates sidebar despite disabled service | No AI development or active AI UI | Remove card from core UI, retain stored insights and disabled backend; no model calls |
| P1 | No quick entry; optional psychology prefilled as facts | Save essentials without inventing behavioral data | Separate compact validated form, add context later; API and browser tests |
| P1 | No review status/rating/lessons | Review queue and explicit completed reviews | Versioned trade review object; conflict and ownership tests |
| P1 | No day/period notes or plans | One manual notebook with deterministic summaries and reusable plan | Owner-scoped period records, optimistic versions; restart/persistence tests |
| P1 | Calendar dots only, no trade counts/day click | Navigate, read signed daily results, inspect rows and write notes | Shared exit-date buckets and day selection; reconciliation/browser tests |
| P1 | Dashboard repeats analytics, no actionable next step | Compact net/equity/risk/review overview | Existing engine; recent rows and review completion; mobile screenshots |
| P1 | Journal list lacks search/filter/paging | Fast management with filters, counts, bounded rows | Pure filter utility and client paging; large synthetic data tests; aggregates unaffected |
| P1 | Icon-only navigation, settings scattered | Labeled sections, collapse/mobile menu, one Settings page | Accessible navigation; preserve key route labels; viewport tests |
| P1 | Inconsistent controls, no common modal/feedback | Reusable cards/buttons/dialogs, focus/escape and status messages | Native dialog + focus restore, CSS tokens, live region; keyboard tests |
| P2 | Analytics explanations verbose, no source drilldown/monthly view | Concise metric help, period shortcuts, filtered source trades | Preserve financial functions; reconciliation tests |
| P2 | No lightweight onboarding or process goals | Optional first-run checklist and review target | Persisted settings; no forced setup or profit promises |
| P2 | Preferences absent | Default analytics range, comfortable/compact rows, process goal | Validated settings; no fake currency conversion/timezone switch |
| P3 | No multi-currency/fills/broker import | Requires expanded accounting model | Explicitly defer; keep INR/IST truthful |

Existing strengths to preserve: six-character password minimum, secure sessions, account isolation, atomic trade version checks, idempotency, decimal P&L, closed/exit-based analytics, risk warnings, psychology fields, habits, protected upload path. External provider testing remains credential-blocked and is not reclassified as complete.

## Delivery disposition

All tabled feasible P0/P1 additions above are implemented locally, with integration/browser verification described in TEST_REPORT_V2. P2 onboarding, review target, default range, compact rows, monthly chart and source table are included. There is no chart-segment-to-trade click handler; the shared filter/source table provides inspection. Plans are reusable text, not versioned per-trade plan snapshots. No monetary profit goal promises, automated discipline recommendations, broker imports, trade replay or arbitrary timezone/currency toggles were added.

Residual work is explicit: live media/provider and production runtime verification; server-side history pagination; large-chart downsampling; full assistive-technology audit; remaining legacy form/component consolidation; settings/checklist conflict detection; legacy-media migration and authenticated email recovery. These are not claimed complete by passing synthetic tests.
