# BillNest handoff to Codex

Updated: 2026-11-23
Repository: https://github.com/funnyspace/funnyspace
Project folder: `billnest/`
Existing demo: https://funnyspace.github.io/funnyspace/billnest/#dashboard

## Purpose

Transfer the project *working context and repository instructions* to Codex.
The code is already committed on GitHub. This document does not imply a
Codex Cloud environment or task has been created or linked; the owner must
connect this repository in Codex.

## Product vision

BillNest is a shop-facing billing, inventory and lightweight accounting
product intended to become a reliable multi-shop application. Prior
requests prioritize simple mobile UI, mobile barcode scanning with
auto-detection/focus/torch, GST-aware invoices, UPI receiving QR,
invoice history, reports, customer list, Hindi/English switching,
Google account / phone OTP authentication and optional cloud backup.

Key decisions:
- Keep normal browser **Print / Save as PDF**.
- Bluetooth LE and dedicated thermal receipt printing were removed at
  the owner's explicit request.
- Hindi/English translation and account registration UI should remain.
- Respect existing user data and existing URLs.

## Current implementation

- Static app, source `app.js` plus `logic.mjs`, `accounting.mjs`,
  `barcode-ean.mjs`, `scanner-assist.mjs`, `upi.mjs`.
- Generated browser app: `app.bundle.js` via `scripts/build.mjs`.
- Authentication: `auth-ui.js`, `cloud-backup.js`, `auth-config.js`.
  Email/phone OTP and Google OAuth PKCE have been coded and simulated,
  and public `auth-config.js` is configured with the owner's Supabase public key. Do not
  claim real Google/SMS login works until providers are configured and
  end-to-end tested.
- `supabase-schema.sql` is a reference for the already-deployed per-device JSON backup table with
  RLS on user ID. It is not the transactional business schema.
- Current workspace data is read/written wholesale via `localStorage`;
  credentials are not a substitute for database row access checks.
- Frontend lists have 40-row pagination and debounced searching, but
  searching, accounting and exports still operate on full in-memory arrays.
- `sw.js` caches the installable offline shell; update asset versions
  and cache manifest when modifying static dependencies.

## Run and test

From the repository root:

```sh
cd billnest
node scripts/build.mjs
node --test tests/*.test.mjs
python -m http.server 8000
```

Visit http://localhost:8000/ and check dashboard, inventory, billing,
invoice PDF, scanning, language switch, and responsive layout. Camera
and web OAuth features need an HTTPS context for realistic tests.
See `README.md` and `SCALING.md` for setup and known limits.

## Priority task: production database and tenant security

Build **a staged, reviewed migration** from local-only billing to
Supabase PostgreSQL, not a one-shot rewrite:

1. First produce a schema/RLS migration and automated authorization
   tests for shops, shop_members, products, customers, invoices,
   invoice_items, inventory_movements, payments and accounting_entries.
   Define owner/manager/cashier/viewer roles with least privileges.
2. Enforce tenant IDs in tables, composite tenant-aware foreign keys
   where necessary, and role/membership checks in PostgreSQL RLS.
   Tests must prove Shop A cannot read/write Shop B's data, including
   direct REST/API calls and forged shop IDs. Do not expose privileged
   tables/functions via anonymous grants.
3. Add trusted, atomic invoice-creation logic with server-assigned
   invoice sequence, fixed tax snapshots, stock decrement, ledger
   movements, and idempotency. Verify simultaneous sale of last stock
   unit creates at most one successful sale.
4. Add tenant-scoped indexed queries and server-side pagination,
   avoiding full download of historical records.
5. Introduce safe migration utilities for existing browser backup
   JSON. Import only on explicit owner consent, preserve source
   backups, validate schema, and reconcile invoice numbers, totals,
   stock and accounting before cutover.
6. Design optional offline IndexedDB draft/outbox with conflict
   recovery and clear confirmed/pending status. Never double bill.
7. Configure owner-managed Supabase Auth/Google/SMS separately.
   Never commit any secrets, private token, or real customer data.
8. Move commercial production hosting off GitHub Pages, then run
   staged load tests for 100,000 registered/monthly active users and
   independently for peak concurrency and large invoice histories.
   Measure p95/p99, throughput, errors, data integrity and costs.

Preserve the current local-first prototype while developing the
new backend behind a feature flag. Do not automatically replace
existing local workspaces or enable a production rollout.

## Codex's first task suggestion

Read `billnest/AGENTS.md`, `billnest/CODEX_HANDOFF.md`,
`billnest/README.md`, `billnest/SCALING.md` and
`billnest/supabase-schema.sql`. Inspect the existing code and tests.
Create a **small initial pull request** that adds a reviewed,
versioned multi-tenant schema with RLS and tests, and document
security assumptions. Do not change the current app's data source,
erase browser storage, or deploy to a real Supabase project yet.
Provide test results and a follow-on migration plan.

## External prerequisites

The owner must connect GitHub repo `funnyspace/funnyspace` to a Codex
Cloud environment (or clone locally for Codex CLI/app). The Codex task
must select the `billnest/` folder. Production Supabase project, API
provider settings, secret storage and deployment infrastructure remain
owner-controlled. No credential values are included in this handoff.
