-- BillNest optional cloud backups.
-- Run ONCE in your own Supabase project: SQL Editor > New query > Run.
-- Use a public publishable/anon key in BillNest, NEVER a service_role/secret key.
-- Each signed-in user can read and replace only their own device backups.
create table if not exists public.billnest_cloud_backups (
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null check (char_length(device_id) between 12 and 64),
  device_name text not null default 'My browser' check (char_length(device_name) <= 60),
  saved_at timestamptz not null default now(),
  size_bytes integer not null check (size_bytes >= 0 and size_bytes <= 8000000),
  backup jsonb not null,
  constraint billnest_cloud_backups_pk primary key (user_id, device_id)
);

alter table public.billnest_cloud_backups enable row level security;

-- Public API must not be able to access backup records without an authenticated user.
revoke all on public.billnest_cloud_backups from anon;
grant select, insert, update on public.billnest_cloud_backups to authenticated;

drop policy if exists billnest_cloud_own_read on public.billnest_cloud_backups;
create policy billnest_cloud_own_read on public.billnest_cloud_backups
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists billnest_cloud_own_insert on public.billnest_cloud_backups;
create policy billnest_cloud_own_insert on public.billnest_cloud_backups
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists billnest_cloud_own_update on public.billnest_cloud_backups;
create policy billnest_cloud_own_update on public.billnest_cloud_backups
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Sign-in: Supabase Dashboard > Authentication > Providers > Email.
-- For six-digit codes instead of a magic link, customize the email template
-- to display the token: {{ .Token }}. Then enter that code in BillNest.
-- Important: This is a private per-device backup, NOT a multi-device live database.
