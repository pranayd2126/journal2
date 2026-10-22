# Vercel Hobby function-count fix — 22 October 2026

The failed PR #1 preview for commit 5b0e4f6 reports: no more than 12 Serverless Functions per Hobby deployment. This is a per-deployment function limit; deleting unrelated websites does not reduce this app's function count.

The previous API directory had 16 route wrappers plus a database helper. It now has one executable entry, `api/index.ts`. `server/db.ts` holds database setup outside Vercel's route discovery directory. All existing API paths are rewritten to the one function; the adapter supports either original public URLs or rewritten URLs and passes them to the same shared router. Authentication, ownership, validation, uploads and all journal features remain in that router.

Routing parameters are validated; duplicate/malformed/traversal values are rejected. Public paths take priority over any user-supplied routing query. No feature, user data, or account-level website was removed. No plan upgrade is required to address this particular limit.

Validation:
- Production frontend build passed.
- Frontend TypeScript/lint and API TypeScript passed.
- 33 tests passed, zero failed (5 files). Six database-backed security/API tests now exercise the rewritten entry adapter; five new tests check route preservation, rewrite forms, malformed paths, SPA separation and the one-entry deployment structure.
- The first sandboxed test run could not bind MongoDB's local port (EPERM); rerunning with approved local-process permissions passed.
- Browser scenarios were not repeated for this serverless packaging-only change; their previous 15-pass result remains historical.

A successful Vercel preview is still required to verify hosted packaging and routing. Real MongoDB/environment variables and Cloudinary prerequisites remain as documented. Do not interpret local tests as proof that the hosted deployment has succeeded. Main is not merged by this fix.

Reference: [Vercel rewrites](https://vercel.com/docs/routing/rewrites). The observed 12-function limit is taken directly from the failed deployment screenshot supplied by the owner.
