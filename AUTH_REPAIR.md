# BillNest authentication repair and deployment

Date: 2026-11-24. Based on the supplied repository archive (commit 8b2fefb292accf72b73e9c8ff18be22621cacba6). This is a source-code update, not a deployed website or a rebuilt APK.

## Findings

- The supplied branch already contained the new project's matching public URL and publishable key in `auth-config.js`. The previously inspected production `main` branch was still using the old project. The repair will only reach visitors after publication to GitHub Pages.
- The static app sends OTP and verification requests directly to Supabase; no Vite environment variables or Resend key belong in the frontend.
- The service worker had versioned cached authentication code; the new cache version is `billnest-shell-v39`. Authentication scripts and online navigation use network-first, no-store requests. The install script requests service-worker updates without HTTP-cache reuse.
- Transport errors now distinguish network failure, timeout, invalid API key and SMTP failure. OTP requests are not automatically retried, since a timed-out request could have delivered a message.
- The deployed project is authoritative. Old-project sessions are discarded without deleting local workspaces. The settings form cannot silently switch the production auth project. Sessions created by this repair record their project URL. The public key checker rejects secret keys and legacy JWTs whose role is not anon.
- Signup still sends `create_user: true`; sign-in sends `create_user: false`. Verification is scoped to the contact for which a code was requested in this page. The app remains locked until Supabase validates the session. The registration screen adds a read-only Check connection button (GET `/auth/v1/settings`); this never sends an email and does not prove SMTP delivery.

## Deploy

1. Back up the current repository and any local shop data. Keep the existing six SQL migrations; do not reapply them to the new project.
2. Extract the ZIP. Copy `billnest/` over the existing BillNest application in the repository, preserving the directory layout. Review the changed files; commit to a branch and merge into `main` after review. Do not replace unrelated files outside the BillNest folder.
3. Confirm that GitHub Pages is publishing from the updated branch and directory. In a browser, open `https://funnyspace.github.io/funnyspace/billnest/auth-config.js?v=4` and confirm that the public URL is `https://lqtpimpgasxlqpiopeqc.supabase.co`. The active publishable key must match that project. Never put the Resend key, a service-role key or database password in this file.
4. Reload `https://funnyspace.github.io/funnyspace/billnest/` with internet access. If necessary, use a private window first, or DevTools > Application > Service Workers > Update/Unregister, then reload. Do not clear all site data: local billing data could be lost. Existing APK is an HTTPS WebView wrapper, so it should load the new website on restart once deployed; no updated binary was built or tested here.
5. Press Check connection in the login dialog. This should report that Supabase Auth is reachable and email signups are enabled. If it fails, inspect DevTools Network for `/auth/v1/settings` (or Android WebView remote debugging). Record the request URL, response status, and any CORS/DNS/TLS errors; redact tokens and personal data.
6. Create account with `billnestofficial@gmail.com` for the initial SMTP test, press Send registration code, and check the email inbox and Resend email logs. Verify the received numeric code in the same open page. Try sign-in with the registered email afterward. A successful connection check is not proof of delivery.

## Hosted Supabase settings (owner dashboard)

- Project: `lqtpimpgasxlqpiopeqc`. Enable Email provider, new user signup and email confirmation. Keep anonymous sign-ins disabled.
- Both Magic Link and Confirm signup templates must include `{{ .Token }}` for numeric OTP flow. Set Auth Site URL to the deployed HTTPS BillNest URL; add it as a redirect URL where required.
- Custom SMTP: `smtp.resend.com`, port `465`, username `resend`, password = a fresh active Resend API key entered privately in Supabase. Sender name `BillNest`. For initial testing use `onboarding@resend.dev` and the registered Resend recipient email only. Production requires a verified domain and matching From address. Do not include SMTP credentials in this repository.
- Mobile OTP requires a separately configured SMS provider; Resend SMTP does not deliver SMS.
- Auth provider and SMTP settings cannot be written through the available database connector. They must be saved in the dashboard. No hosted settings changed by this source repair.

## Migration history

The connected project was previously observed to have 10 RLS-enabled public tables and these six remote migration versions:

| Remote version | Name |
|---|---|
| 20261124071301 | bn_tenants |
| 20261124071303 | bn_atomic_sales |
| 20261124071306 | bn_staff_roles |
| 20261124071310 | bn_restrict_existing_rls_event_helper |
| 20261124071312 | bn_device_backups |
| 20261124071315 | bn_fk_indexes |

Local migration filenames retain their original timestamps. Compare remote history with SQL contents before reconciling; do not automatically rerun or repair history. No SQL changes were required for the authentication fix.

## Validation performed

Node.js 22.16.0. Syntax checks for modified JS. The original suite had 67 passes / 17 failures; some authentication tests had outdated mock DOM, incorrect test path or hard-coded asset versions. Those relevant harnesses were corrected to test the protected workspace flow.

Targeted test command:

```sh
node --test tests/otp-delivery.test.mjs tests/auth-ui.test.mjs tests/cloud-backup.test.mjs tests/install-app.test.mjs tests/supabase-database.test.mjs
```

Result: 29 passed, 0 failed. Covers network error mapping, OTP timeout handling, no automatic retry, correct signup/sign-in payloads, matching verification contact, stale-project config/session, connection check, SMTP and invalid key errors, protected login UI, resend, cache versions and cloud backups.

Full suite: `node --test tests/*.test.mjs`: 87 passed, 7 failed, 94 total. The seven remaining failures were present in the input archive (mobile heading/layout, UPI UI, cloud UI asset loading, brand/asset checks and scanner layout). They are outside this repair and not evidence of a new regression. See `AUTH_TEST_RESULTS.txt` for test names.

Live authentication endpoint could not be reached from the execution environment (DNS resolution failed); no real registration email was sent, no hosted website was deployed, and no Android APK was rebuilt. Complete the live browser test before marking the repair production-ready.
