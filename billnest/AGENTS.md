# Codex instructions for BillNest

Scope: This file applies to the `billnest/` folder of the repository
`funnyspace/funnyspace`. Do not modify other applications in this monorepo
unless expressly requested.

## Goal and current status

BillNest is a mobile-friendly, local-first inventory, GST-aware billing,
invoicing, customer and accounting prototype written in vanilla HTML, CSS
and JavaScript. Source: `app.js`, `logic.mjs`, `accounting.mjs`,
`barcode-ean.mjs`, `scanner-assist.mjs`, `upi.mjs`.
The browser consumes generated `app.bundle.js`. Authentication and backup
are separate `auth-ui.js`, `cloud-backup.js`, `auth-config.js`; language
switching is in `i18n.js`.

Existing live demo URL:
https://funnyspace.github.io/funnyspace/billnest/

Read `README.md`, `SCALING.md`, and `CODEX_HANDOFF.md` before substantial work.
Do not represent this prototype as production-ready or capable of serving
100,000 concurrent users without load-test evidence.

## Build and test

- Use Node 18+.
- Run from `billnest/`: `node scripts/build.mjs` after edits to any
  source module or `app.js`. Commit the updated `app.bundle.js` too.
- Run `node --test tests/*.test.mjs`.
- For static preview: `python -m http.server 8000` from `billnest/`.
- The app must also remain usable as a static browser page where supported.
- On changed script/style URLs, update `index.html` version parameters
  and the offline service worker `sw.js` cache manifest/version together.
- Check responsive mobile layouts, navigation, billing, and invoice printing.
- Keep standard Print / Save as PDF. Dedicated Bluetooth/thermal receipt
  printing was deliberately removed and should not be reintroduced.

## Data integrity and security

- Existing records currently live primarily in browser `localStorage`.
  Do not erase, silently migrate, or overwrite them. Explicitly preserve
  and validate JSON backups and restore operations.
- Cloud backup is a per-user **snapshot**, not a transactional multi-tenant
  database or real-time sync. `supabase-schema.sql` implements backup
  RLS only. Production database/tenant security is NOT implemented.
- `auth-config.js` has blank public Supabase URL/key until owner setup.
  Never commit a secret/service-role key, DB password, OAuth secret, or
  a real customer's private records. OAuth/SMS live delivery is unverified.
- A verified user is NOT automatically authorized for every shop. Future
  tables need authenticated membership checks, role authorization, tenant
  scoped RLS, cross-tenant tests and least-privilege grants.
- Billing, stock changes, invoice numbering, payments and idempotency must
  be atomic on a trusted backend before multi-cashier deployment.
- Prefer integer paise for money, preserve historical invoice line/tax
  snapshots and audit history, and do not invent GST compliance claims.
- Ask for owner-managed infrastructure details as needed, but never request
  secrets in chat or paste them into the public repository.

## Development workflow

1. Inspect relevant files, test baseline and outline an incremental plan.
2. Make minimal, reversible changes with focused tests.
3. Run build, unit tests, static checks, and UI/browser tests when available.
4. Document limitations and distinguish simulated from live results.
5. Open a PR for review, summarizing changes, tests, risks and deployment
   prerequisites; do not deploy unverified production database changes.
6. Respect the owner's existing feature decisions, including Hindi/English
   interface, barcode scanning, mobile UX, Google/email/phone auth UI,
   UPI invoice QR, cloud backup, and standard PDF printing.

## Deployed Supabase database status

The owner connected Supabase project `lffgfzgzgrpatlrcctbo`.
Six database migrations have been installed; file versions under
`supabase/migrations/` now match remote migration history. Rollback-only
tenant and transaction checks passed. Run `supabase migration list`
against the linked project before creating or pushing a new migration.
Do not re-run the initial migration files or inadvertently reset live data.
The local Billing UI is still separate from the cloud catalog.

## Supabase integration status (2026-11-23)

Versioned migrations now exist in `supabase/migrations/` with table RLS,
trusted shop, product and customer RPCs, atomic invoice/payment RPCs, and
staff role functions. `shop-database.js` provides an opt-in, staged
Cloud Shop panel in Settings, using `BillNestCloud.databaseRequest` with
the authenticated session. Read `SUPABASE_SETUP.md` before modifications.

The old local workspace and invoice checkout are **not** connected to the new
database. Avoid silently blending the two stock ledgers, changing user
invoices, or claiming that transactional migration is complete. Reconcile
GST calculations, add consent-based import and browser/backend tests first.

## Next major workstream

Read `CODEX_HANDOFF.md`. The priority is a staged PostgreSQL/Supabase
production data layer with tenant isolation, atomic billing operations,
safe migration of browser data, tests, and commercial hosting. Implement
incrementally, ideally schema/RLS/tests before API/UI cutover.
