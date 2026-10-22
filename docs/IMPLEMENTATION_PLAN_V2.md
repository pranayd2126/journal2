# V2 implementation plan

Continue the existing branch and uncommitted work. No push/deploy, external AI calls, production data writes or destructive migration.

Acceptance work packages (equal weight for final scope accounting):
1. Current official research across seven journals and actual-code gap audit.
2. Consistent design primitives, navigation, feedback and optional onboarding.
3. Compact dashboard with verified metrics, recent outcomes, risk and review progress.
4. Quick entry, searchable/filterable/paged trade management and preserved detailed entry.
5. Versioned manual trade reviews, rating, lessons and pending queue.
6. Interactive signed-P&L/count calendar and day drilldown.
7. Manual daily/weekly/monthly notebook, saved reflections and deterministic summaries.
8. Reusable trading plan and persisted relevant preferences/process goal.
9. Analytics explanations, month grouping, date shortcuts and source-trade visibility without formula changes.
10. Accessibility/performance improvements and desktop/tablet/mobile plus available browser verification.
11. Existing regression suite, new unit/integration/browser tests, build/type checks/security audit.
12. Complete six v2 documents, exact test outcomes and honest external limitations.

Implementation order: research/gaps → additive schema/API fields and tests → reusable UI → workflows → analytics/calendar → visual refinement → regression/cross-browser verification → documentation. Keep legacy components available where they provide unique detail. Do not use arbitrary timezone or currency toggles that would make summaries inconsistent. Ledger remains INR, realized days IST; entry inputs remain explicitly UTC.
