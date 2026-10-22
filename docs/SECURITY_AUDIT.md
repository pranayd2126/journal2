# Security audit

## Original critical findings

User-specific routes trusted any URL user ID and did not verify authentication. Login returned identity only. Patches accepted arbitrary fields. Upload accepted arbitrary external URLs without authentication or limits. Vite explicitly substituted GEMINI_API_KEY into client code when referenced. API errors exposed internal messages. No tests or rate limits existed.

## Implemented

- Opaque 256-bit sessions; only SHA-256 token hashes persisted. Seven-day expiry checked on every request; MongoDB TTL cleanup. HttpOnly, SameSite=Strict cookies; Secure in production. Logout deletes the session; password change revokes all sessions.
- bcrypt work factor 12 for new hashes; legacy bcrypt verifies. At least six Unicode characters, no required character classes. Maximum 72 UTF-8 bytes avoids silent bcrypt truncation. Five rejected, six and longer accepted in tests.
- Verified identity required for private reads/writes/uploads. Route owner must match; body userId cannot transfer ownership. Record queries always include session owner.
- Same-origin JSON mutations, Origin/Fetch Metadata checks, no permissive CORS. APP_ORIGIN is mandatory deployment configuration; local host fallback for development.
- Persistent database rate-limit counters by account email and IP for auth, per authenticated user for writes/uploads/reviews. Production proxy IP requires deployment verification; direct Express does not trust arbitrary X-Forwarded-For.
- Payload schemas, numeric bounds, finite values, chronology validation, 3 MB request limit, safe generic service errors, API no-store/nosniff/frame/referrer headers.
- Uploads decode PNG/JPEG/WebP with sharp, 2 MB input / 16 megapixel limits, metadata-stripping re-encode. No remote URL upload or SVG. Owner-scoped storage records and attachment checks.
- Client secret injection removed; environment ignored; .env.example contains placeholders only.
- New trade idempotency IDs and atomic version checks. Unknown legacy fields are retained; immutable identity fields are not copied from client.

## Deployment prerequisites / residual limits

No production security claim is made. Configure HTTPS, APP_ORIGIN, MongoDB least-privilege credentials, backups and platform request throttling. If the previously deployed bundle actually included a Gemini key, rotate it. No key was read during this work.

New images use Cloudinary authenticated storage and an owner-checked API delivery proxy; provider delivery URLs are not returned to the browser. This path needs a real Cloudinary staging success test. Legacy public Cloudinary URLs remain shareable as in the existing product: possession of an old URL can permit viewing. Legacy public images need a separately reviewed storage migration; none were deleted or modified.

Production MongoDB index compatibility, Vercel packaging/runtime, Cloudinary success and real Gemini responses require staging credentials. Password recovery requires verified email delivery and one-time hashed reset tokens; it is not implemented. Distributed throttling has database counters but infrastructure-level flood protection is still required. This is an engineering audit, not a penetration-test certification.

## Non-destructive data/index plan and rollback

No production connection or migration executed. At first configured connection add non-unique owner/query indexes, unique session hash, session/rate-limit TTL, and partial unique (userId, submissionId) for new submissions. Legacy trades have no submissionId and are excluded. Settings and checklists use deterministic IDs only for new records; existing documents are updated by their existing IDs. Existing duplicate legacy records are not deleted or merged. New email reservations avoid concurrent registration races without creating a unique index over uninspected legacy emails.

Before staging/production: back up, inspect duplicate normalized user emails, duplicate daily checklist records and any preexisting submissionId fields. Trial indexes on a disposable copy first. Rollback code by restoring the previous revision; retain new collections and fields for forensic review, or remove only newly introduced indexes after backup. Reverting to the original unauthenticated API is unsafe; disable public access before any rollback. Do not silently rewrite financial history.

Reference guidance: [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), and [file uploads](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html). SameSite is defense in depth; JSON-only and origin/Fetch Metadata validation additionally protect mutations. Production HTML receives CSP, HSTS, frame and content-type protections through Express and Vercel header configuration.

## V2 follow-up — 22 October 2026

Notebook records use an owner-derived deterministic ID plus the verified session owner in every query. Day/week/month records validate real calendar dates; week/month starts are canonical. Updates require the current version and use an atomic version predicate. Duplicate-create races return 409. Review fields are bounded and validated; trade review PATCHes preserve financial data. Plans/preferences use the existing validated owner-scoped settings endpoint. React renders note strings as text, with no raw HTML renderer.

Verification adds unauthenticated/other-account notebook denials, duplicate/stale version rejection, invalid periods and financial preservation during reviews. Production-mode browser tests use generated temporary localhost TLS certificates with browser certificate validation bypassed **only in tests**. Application cookies retain Secure/HttpOnly/SameSite. The six-character minimum remains unchanged. `npm audit` returned zero advisories for installed dependencies; this is not proof of no vulnerabilities.

No MongoDB or Cloudinary environment credentials were configured when checked. Cloudinary success/delivery remains mocked; no provider calls were made. AI remains outside this task, disabled by default, with no active workspace controls or external calls. Existing insights are not deleted. Earlier AI-specific completion notes are historical, not a commitment to resume development.

Remaining: staging Vercel/Express proxy verification, real Cloudinary round trip, legacy public-image migration, orphan-media cleanup, real MongoDB index/duplicate inspection, backup/restore/load tests, password recovery/email verification/MFA, settings/checklist optimistic concurrency and infrastructure monitoring/throttling. No penetration-test certification or production-readiness claim.
