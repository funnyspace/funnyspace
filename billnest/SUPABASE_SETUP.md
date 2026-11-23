# BillNest Supabase production database setup

## Current project connection (2026-11-23)

The owner has created Supabase project `lffgfzgzgrpatlrcctbo` at
`https://lffgfzgzgrpatlrcctbo.supabase.co`. The public project URL is
recorded in `auth-config.js`.

**Still required:** Paste the project's **public publishable**
`sb_publishable_...` key into `auth-config.js`, or connect it using
Settings > Cloud backup for an individual browser. Find the value under
Supabase Dashboard > Project Settings > API Keys (or the Connect dialog).
Do not copy `sb_secret_...`, `service_role`, or the database password.

The project has **not** been accessed, its migrations have **not** been
executed, its RLS policies have **not** been live-tested, and its Google/SMS
providers have **not** been activated by these repository changes.

After testing with local Supabase and reviewing backups, the owner can
use `supabase link --project-ref lffgfzgzgrpatlrcctbo` to select the
remote project explicitly. Review the migration diff before any
`supabase db push`. Never run `supabase db reset` on a live project.



The Supabase shop database is implemented as a **staged integration**. Its
tenant-isolated schema, RLS policies, product/customer RPCs, atomic invoice
and payment RPCs, and shop settings panel are in this repository. No live
Supabase project has been connected or migrated by this change.

**Important:** Existing browser billing, inventory, accounts and invoice
history still use the local workspace, with optional JSON snapshot backups.
The Cloud Shop settings panel intentionally writes to a separate PostgreSQL
catalog. It is NOT a multi-device production checkout yet. Do not run sales
from two cashiers against local stock expecting cloud transactions to sync.

## One-time owner setup

1. Create a Supabase project in https://supabase.com/dashboard.
   Keep its database password, API secret/service_role and Google client
   secret in private provider settings or a secret manager, never GitHub.
2. In Supabase Auth settings, enable Email OTP and/or Google. For phone OTP,
   set up and pay for a compatible SMS provider, including relevant Indian
   DLT requirements. Configure callback/redirect allow-list for the BillNest
   URL or your new production frontend.
3. Install Supabase CLI locally and make sure Docker is available. From
   `billnest/`, use:

   ```sh
   supabase start
   supabase db reset
   supabase test db
   node scripts/build.mjs
   node --test tests/*.test.mjs
   ```

   The `supabase/migrations/` folder contains **three ordered migrations**:
   tenants/RLS, atomic invoice/payment RPCs and staff roles. Database tests
   are under `supabase/tests/`. Test them on the *local* Supabase stack first.
   Do not run `db reset` against production.
4. After reviewing and staging the migrations, link the correct Supabase
   project with `supabase link --project-ref YOUR_PROJECT_REF`, then use
   `supabase db push` to apply pending migrations. Confirm the target project
   and protect backups first. SQL runs with elevated privileges.
5. In `billnest/auth-config.js`, deploy **only** the Project URL and a
   public publishable/legacy anon key, for example:

   ```js
   window.BILLNEST_AUTH_CONFIG = {
     url: 'https://YOUR_PROJECT_REF.supabase.co',
     key: 'sb_publishable_YOUR_PUBLIC_KEY'
   };
   ```

   This is a public key, not the database password or a secret/service_role
   key. You can also test the Project URL and public key in Settings > Cloud
   backup on one browser before site-wide configuration.
6. Sign in. In **Settings > Supabase shop database**, click **Refresh cloud
   shops**. Create a cloud shop, select it and add a test product. Verify the
   shop/product rows in Supabase Table Editor. Test with a second account
   that it cannot list the first shop or its products.
7. The previous `supabase-schema.sql` controls **optional local JSON
   snapshot backups**. If you want that separate backup feature, install
   its table and RLS as described there. It is independent of the new
   `bn_*` business tables.

## Security architecture

- `bn_shops` stores shops. `bn_shop_members` links a verified
  `auth.users` identity to a shop and role.
- Every business row includes `shop_id`; invoice-line/product/customer
  foreign keys also check `shop_id` to prevent cross-tenant references.
- Public authenticated users get **SELECT** privileges with RLS. Every
  mutation is blocked at the table permission level unless made via a
  dedicated, server-authorized RPC.
- The private membership-role helper checks `auth.uid()` inside a fixed
  search-path security-definer function. The public RPCs separately verify
  the current role before making changes.
- Shop owners can add already registered, email-verified staff through
  `bn_add_existing_member`. It does not send an invitation email and does
  not create login accounts. It cannot promote another owner. Staff
  management UI is pending.
- Invoice creation validates product records server-side, locks stock,
  allocates sequential invoice numbers, stores tax and price snapshots,
  and uses idempotency keys. Payments are also idempotent and cannot exceed
  invoice total. **These RPCs are not yet connected to existing checkout.**
- The client sends only a short-lived access token issued by Supabase Auth
  and a public project key. Never expose secret keys in JavaScript.

## Current limits and next development steps

1. Reconcile existing BillNest GST calculation with server tax rounding,
   partial payments, returns, invoice numbering and immutable audit records.
2. Build a **reviewable, consent-based import** from browser JSON backup,
   including customer/product mapping and accounting validation. Never
   silently overwrite or delete local data.
3. Wire billing UI to `bn_issue_invoice` and payment UI to
   `bn_record_payment` only after realistic transaction tests pass.
   Build transactional customer/product reads and writes for the selected
   shop, with server-side pagination and indexes.
4. Build secure role invitation/member management and prove shop isolation
   with browser API tests and the pgTAP database suite.
5. Move production frontend off GitHub Pages, add monitoring, backup
   restoration drills, measured capacity tests and a paid plan suitable
   for the forecast. **100,000 concurrent users are not certified.**

References:
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/api/securing-your-api
- https://supabase.com/docs/guides/local-development/overview
- https://supabase.com/docs/guides/cli/local-development
