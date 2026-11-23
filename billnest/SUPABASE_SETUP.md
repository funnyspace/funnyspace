# BillNest Supabase: deployed database and activation

**Project:** `lffgfzgzgrpatlrcctbo`
**URL:** https://lffgfzgzgrpatlrcctbo.supabase.co
**Deployment verified:** 2026-11-23

## Current status

The production Supabase project is connected. The project URL and public
`sb_publishable_` key are already configured in `billnest/auth-config.js`.
All six migrations listed below have been applied successfully to the
remote project. This does **not** mean that Google/SMS provider settings,
the old local-first checkout or a 100,000-user load target are complete.

- Nine `bn_*` shop, membership, product, customer, invoice, invoice item,
  stock movement, payment and accounting tables with RLS
- Separate `billnest_cloud_backups` table, private to each logged-in user
- Eight performance indexes covering foreign keys
- Tenant-aware, role-authorized RPCs for shop/product/customer management,
  invoice issuance, receipts and existing-user staff membership
- Unnecessary anonymous/authenticated `EXECUTE` on the existing
  `public.rls_auto_enable()` event-trigger helper revoked

The database was empty before deployment. The rollback-only security and
transaction tests left no dummy shops, invoices, users or payments in the
remote project. This was verified using SQL.

## Actual remote migration history

These filenames **match the versions recorded by the Supabase project**:

| Version | Migration | Purpose |
| --- | --- | --- |
| 20261123133100 | bn_tenants | Tenant tables, RLS and basic RPCs |
| 20261123133128 | bn_atomic_sales | Idempotent invoice and payment transactions |
| 20261123133139 | bn_staff_roles | Verified staff membership management |
| 20261123133244 | bn_restrict_existing_rls_event_helper | Restrict unnecessary event-trigger API permissions |
| 20261123133417 | bn_device_backups | Per-user cloud backup schema and RLS |
| 20261123133548 | bn_fk_indexes | Cover missing foreign-key indexes |

The corresponding SQL files are in `supabase/migrations/`. The old
`supabase-schema.sql` at the repository root remains as a reference copy
for the cloud backup schema, **not** another migration to reapply.

Before any further remote deployment, run `supabase migration list` and
compare with the remote history. **Do not run old migration filenames
(202611230001/2/3) or reapply these schemas through SQL Editor.**

## Verified database behavior

Executed in a single rollback-only SQL transaction against this project:

- User A cannot select User B's shop, products or shop membership.
- Unrelated users cannot edit another shop's products.
- Authenticated users cannot directly insert into protected business tables.
- Creating an invoice decrements stock and writes a single invoice.
- Repeated invoice requests with the same idempotency key return the
  original invoice without a second stock decrement.
- An oversell attempt is rejected and does not persist changes.
- Payment receipt deduplication prevents duplicate payment rows.
- Payments exceeding the outstanding balance are rejected.
- A Viewer can read permitted shop products but cannot modify products,
  issue invoices or remove the Owner.
- Removing a staff member immediately removes their shop access for
  subsequent database queries.
- Device backups cannot be read or inserted on behalf of another user.

All such tests passed and rolled back. **These tests simulate signed-in
database roles and claims; they do not replace end-to-end browser login
testing, a full local pgTAP run or concurrent load testing.**

The Supabase security advisor still flags the **seven intentional,
authenticated `SECURITY DEFINER` RPC functions**. Those are publicly
addressable via REST only for authenticated roles, and they independently
validate `auth.uid()` and shop membership. Do not blindly remove
`authenticated` EXECUTE grants: BillNest uses these RPCs as its narrowly
scoped mutation API. Re-review every function's body and authorization
when making future changes.

The performance advisor's initial missing-foreign-key-index warnings were
resolved. Newly created indexes can appear as `unused` until real
workloads exercise them.

## Owner's next actions

1. Visit https://supabase.com/dashboard/project/lffgfzgzgrpatlrcctbo/auth/providers
   and enable/configure desired login providers.
   Email may require a verification email template for 6-digit OTPs.
   Google requires an OAuth client ID and secret configured **only** in
   the provider settings; Phone requires an SMS delivery provider and
   may require Indian DLT compliance.
2. In Supabase Auth URL configuration, add the BillNest redirect URL:
   `https://funnyspace.github.io/funnyspace/billnest/`. Use your future
   production domain in place of this when migrated.
3. Open BillNest, sign in, then go to **Settings > Supabase shop database**.
   Create a cloud shop and a test product. Verify the logged-in browser
   sees them and another unrelated account does not.
4. For automatic private JSON device backup, use **Settings > Cloud backup**.
   The matching table is installed. Backups remain optional and separate
   from the production business tables.

## Development and verification

From the `billnest/` directory with Supabase CLI and Docker installed:

```sh
supabase start
supabase db reset           # LOCAL STACK ONLY. NEVER run against live production.
supabase test db
node scripts/build.mjs
node --test tests/*.test.mjs
```

When linking the already deployed remote project, use
`supabase link --project-ref lffgfzgzgrpatlrcctbo`. Compare the
migration list before any `supabase db push`. This project's six
existing migrations have already been applied remotely.

## Critical limitation: local and cloud stock are separate

**Do not assume invoices generated by the existing Billing UI are written
to PostgreSQL.** The original inventory, billing, accounting, saved
invoices and client reports still use browser `localStorage`. The separate
Cloud Shop panel allows authorized shop catalog data in Supabase but does
not automatically synchronize the local workspace.

The following still require further development and validation:

- Explicit, consent-based import of local products, invoices, accounting
  entries and stock movements, with backups and reconciliation
- Match PostgreSQL invoice tax calculations against existing BillNest
  GST-inclusive/exclusive, line-rounding and discount rules
- Wire the old Billing and Payments UI to atomic Supabase RPCs only after
  reconciliation, verification and staff-concurrency testing
- Staff invitation UI, customer management UI, and server-side pagination
- Commercial frontend hosting, monitored backups/restores and measured
  production-capacity tests

Never commit database passwords, OAuth client secrets, `service_role`
or `sb_secret_` values into public code.

References:
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/api/securing-your-api
- https://supabase.com/docs/guides/cli/local-development
- https://supabase.com/docs/guides/database/database-linter
