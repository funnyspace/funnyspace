# BillNest: scaling and production-readiness plan

## Capacity verdict

**The current website cannot responsibly be certified for 100,000 users, simultaneous
sessions, or records per business.** The original application stores a whole
workspace in browser `localStorage`; Supabase is currently configured only for
authentication/optional snapshot backup, not as a transactional database.
The published `auth-config.js` remains blank until the owner connects a project.

GitHub Pages is **not an appropriate commercial SaaS host**. GitHub documents a
soft 100 GB/month Pages bandwidth limit and restricts hosting online businesses
and commercial SaaS applications. Move production hosting to a supported
commercial static/CDN platform with capacity, support and monitoring:
https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits

Supabase pricing, included monthly active users and rates must be checked against
the actual contracted plan and forecast:
https://supabase.com/pricing
https://supabase.com/docs/guides/auth/rate-limits

## Improvements already implemented in the prototype

- Inventory, checkout product suggestions, invoice history, customers, profit
  tables, customer receivables and cashbook now **render 40 rows at a time**
  with Previous/Next controls. Full totals, CSV exports and actual data remain unchanged.
- Billing customer dropdown shows a small subset; a search input lets users
  locate additional customers without building thousands of `<option>` nodes.
- Customer invoice counts are calculated in a single pass through invoice history
  rather than filtering all invoices for every visible customer.
- Dashboard 7-day revenue uses a single invoice-history scan rather than seven.
- Search redraw is slightly delayed to prevent expensive HTML updates on every
  keystroke, and the installed PWA cache is versioned to load these improvements.
- The settings page explicitly warns that browser storage is insufficient for
  very large businesses.

These improvements limit **DOM rendering**, not database or backend capacity.
A full invoice history still resides in memory and is serialized to `localStorage`
on changes. Exporting huge CSV files and computing accounting totals are also
local operations and can remain slow. The 40-row UI limit is not a claim that
100,000 records can be stored safely.

## Staged Supabase implementation update (2026-11-23)

A new version-controlled Supabase migration series defines tenant-scoped
`bn_*` tables with RLS and trusted RPCs for products, customers, invoices,
payments and staff. BillNest Settings has an **opt-in cloud shop catalog
panel** that connects through the existing authenticated Supabase session.

The local billing/stock/expense workspace is not migrated or synchronized
automatically, and its 100,000-record storage limitations remain. The SQL
migrations and pgTAP tests must be executed on a real local Supabase stack
and the results reviewed before any live rollout. See `SUPABASE_SETUP.md`.

## Required architecture for 100,000 users

1. **Hosting:** move the production frontend from GitHub Pages to a commercial
   CDN/static app host with a support agreement, a custom domain, caching,
   access logs, uptime alerts and rollback.
2. **Database:** move products, sales invoices, invoice lines, inventory movements,
   customers, payments and accounting entries from browser JSON into PostgreSQL
   or another transactional backend. Use immutable invoice snapshots and
   explicit migrations from legacy local backups.
3. **Tenant isolation:** create shop/workspace and membership entities. Every
   table should be keyed by tenant. Require authentication and enforce
   tenant-scoped **row-level security** server-side, not just different browser
   `localStorage` keys. Verify access with cross-tenant penetration tests.
4. **Concurrent billing:** issue invoice numbers and deduct stock in one
   database transaction. Add unique constraints, appropriate locking, durable
   idempotency keys and checks against negative stock. Prevent duplicate
   invoices caused by retries, lost connectivity or two cashiers.
5. **Queries:** use indexed `tenant_id,created_at` and `tenant_id,sku`
   columns and server-side keyset/cursor pagination. Avoid downloading all
   historical invoices merely to show a 40-row page. Move aggregation and
   filters to the database, with pre-aggregated reporting where needed.
6. **Realtime and offline:** keep an IndexedDB outbox on each device if offline
   billing is required. Sync through authenticated server APIs, reconcile
   conflicts and only display confirmed backend outcomes for stock/payment.
7. **Authentication:** configure Google and SMS providers, rate limits, verified
   domains, abuse prevention/CAPTCHA and SMS cost controls. Ensure the production
   plan supports your forecast of monthly active users and signup peak rates.
8. **Operations:** versioned backups with recovery drills, structured audit
   logs, performance and error monitoring, infrastructure alerts, a documented
   recovery-point objective and a recovery-time objective.
9. **Payments/compliance:** server-side payment reconciliation, immutable
   invoice audit trail and GST/compliance review before business deployment.

Do not deploy only the current HTML, JavaScript and backup snapshot table
under the assumption that it provides a multi-tenant SaaS backend.

## How to measure the real capacity

Use **separate staging systems** and realistic workloads. Track p50, p95 and p99
latencies, request error rate, auth OTP delivery, storage usage, memory, billing
transaction throughput, duplicate invoice prevention, overselling and recovery
after network loss. Exercise at least these separate scenarios:

| Scenario | What to test |
| --- | --- |
| 100,000 monthly active accounts | Login costs, session renewal, SMS/email volume, bandwidth budget |
| 100,000 concurrent sessions | Ramp traffic progressively with a dedicated load-testing tool and a staging backend |
| 100,000 invoices in one shop | Server-paginated invoice history, search latency, exports and report queries |
| Two or more cashiers selling last unit | Atomic inventory decrement and single valid remaining sale |
| Duplicate/retried payment or invoice request | Idempotency and correct accounting outcomes |
| Lost internet during a sale | Explicit draft/confirmation state, reconnection and conflict handling |
| Restore and disaster recovery | Verified backups and restore time |

Set measurable acceptance targets **before** testing and compare them to
observed results. No request rate, uptime guarantee, 100k-concurrency result
or benchmark is claimed by this prototype.

## Safe near-term use

Until a transactional backend exists, treat BillNest as a *single-device or
low-volume pilot*. Export JSON backups often, avoid storing sensitive customer
data on shared browser profiles and do not trust local-only stock counts
across multiple simultaneous cashiers.
