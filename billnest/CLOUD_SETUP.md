# BillNest Version 23: Cloud backup when online

BillNest remains local-first. Its browser storage is written immediately on every save. Cloud backup is optional and activates only after you connect your own Supabase project and sign in.

## One-time setup

1. Create a Supabase project: https://supabase.com.
2. Open the project **SQL Editor** and run the provided `supabase-schema.sql`. This creates the `billnest_cloud_backups` table with user-scoped Row Level Security (RLS).
3. In **Authentication > Providers > Email**, enable email sign-in. To use numeric OTPs, customize the email template to display `{{ .Token }}`. Configure your SMTP provider/email sending limits.
4. In Supabase project API settings, copy the **Project URL** and the **publishable key** (e.g. `sb_publishable_...`, or legacy public anon key). Never copy a `service_role` or `sb_secret` key into BillNest.
5. Open **BillNest > Settings > Cloud backup**. Paste the URL/public key, optionally name the device, and select **Save cloud connection**.
6. Enter your email, request the sign-in code, and verify it. Automatic cloud backup is enabled. While offline, local saves continue and the newest workspace uploads when online again.
7. To retrieve your data on another device, sign into the same Supabase project and email account, select **Refresh backups**, and manually **Restore** the desired device snapshot with confirmation.

## Behavior and limitations

- Local data saves first in the browser. Cloud uploads are debounced, so rapid edits are combined into one upload. Settings shows pending, offline, saved or error status.
- Each device has **one latest cloud snapshot**, uniquely keyed by its generated device ID. Other devices will not silently overwrite it. A cloud restore replaces local data only after explicit confirmation.
- **This is cloud backup, not live multi-device stock reconciliation.** Separate devices should not process concurrent sales expecting automatic merging. Export a local JSON backup before any restore.
- Uploaded data includes products, invoices, customer data, financial records and any embedded business logo. Snapshots are in your Supabase project, accessible only with your authenticated user session according to the included RLS policies.
- Signing in creates browser-stored session tokens. Sign out on shared devices. Do not publicly share your data, database keys or access tokens.
- Cloud snapshot size is limited to approximately 8 MB per device. Beyond that, a server-managed transactional database, separate file storage, and additional access controls are necessary.
- A cloud upload is not guaranteed until the status explicitly says **Cloud saved**. The browser must be online and a Supabase project must be configured. GitHub Pages itself does not provide database storage.

## Operational notes

Production retail operations need more than per-device backup. For multi-user concurrent billing, migrate inventory and invoice records to a central database with permissions, concurrency controls, audit logs, stock reservation and reliable migrations. Avoid sharing one public device with a permanently signed-in account.